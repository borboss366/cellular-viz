"""beatd's link to the beat relay (qa/beat-relay.mjs inside conduct-serve, /relay?v=1): a WebSocket client in the
standard library only (no pip), as the pages use it: text frames of JSON, masked, one connection.

What comes in (the relay's hello, the conductor's clock, knobs, levels, ...) is read and dropped by a reader thread,
so the relay never sees beatd as a slow page and cuts it off; pings are answered. send() returns False when the link
is down; the caller reconnects (Link.ensure) with the same backoff as the pages (250 ms doubling to 8 s, jitter).
"""
import base64
import json
import os
import random
import socket
import struct
import threading
import time
import urllib.parse

OP_TEXT, OP_BIN, OP_CLOSE, OP_PING, OP_PONG = 0x1, 0x2, 0x8, 0x9, 0xA


def frame(opcode, payload):
    """one masked client frame (RFC 6455 5.2)"""
    head = bytearray([0x80 | opcode])
    n = len(payload)
    if n < 126:
        head.append(0x80 | n)
    elif n < 65536:
        head.append(0x80 | 126)
        head += struct.pack('!H', n)
    else:
        head.append(0x80 | 127)
        head += struct.pack('!Q', n)
    mask = os.urandom(4)
    head += mask
    return bytes(head) + bytes(b ^ mask[i % 4] for i, b in enumerate(payload))


def backoff_s(retry, rnd=random.random):
    """250 ms doubling to 8 s, with up to 25 % jitter (as experiments/relay-lib.js backoffMs)"""
    base = min(8.0, 0.25 * (2 ** retry))
    return base * (0.75 + 0.25 * rnd())


class Link:
    def __init__(self, url, timeout=5.0, log=print):
        u = urllib.parse.urlsplit(url)
        if u.scheme != 'ws':
            raise ValueError(f'relay url must be ws://host:port/relay?v=1, not {url}')
        self.url, self.host, self.port = url, u.hostname, u.port or 80
        self.path = (u.path or '/') + (f'?{u.query}' if u.query else '')
        self.timeout, self.log = timeout, log
        self.sock, self.lock, self.reader = None, threading.Lock(), None
        self.hello, self.received, self.sent, self.opens, self.retry, self.next_try = None, 0, 0, 0, 0, 0.0

    # ---------- connect ----------
    def connect(self):
        s = socket.create_connection((self.host, self.port), timeout=self.timeout)
        key = base64.b64encode(os.urandom(16)).decode()
        s.sendall((f'GET {self.path} HTTP/1.1\r\nHost: {self.host}:{self.port}\r\nUpgrade: websocket\r\n'
                   f'Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
        buf = b''
        while b'\r\n\r\n' not in buf:
            chunk = s.recv(4096)
            if not chunk:
                s.close()
                raise ConnectionError('relay closed during the handshake')
            buf += chunk
        head, rest = buf.split(b'\r\n\r\n', 1)
        status = head.split(b'\r\n', 1)[0].decode('latin1')
        if ' 101 ' not in status + ' ':
            s.close()
            raise ConnectionError(f'relay answered {status!r} (not a WebSocket upgrade: is it /relay?v=1 on conduct-serve?)')
        s.settimeout(None)
        self.sock, self.opens, self.retry = s, self.opens + 1, 0
        self.reader = threading.Thread(target=self._read, args=(s, rest), daemon=True)
        self.reader.start()

    def ensure(self, now=time.monotonic):
        """connected, or one try when the backoff allows; never raises"""
        if self.sock is not None:
            return True
        if now() < self.next_try:
            return False
        try:
            self.connect()
            self.log(f'beatd: relay {self.url}: connected')
            return True
        except OSError as e:
            wait = backoff_s(self.retry)
            self.retry += 1
            self.next_try = now() + wait
            self.log(f'beatd: relay {self.url}: {e}; next try in {wait:.1f} s')
            return False

    # ---------- out ----------
    def send(self, obj):
        s = self.sock
        if s is None:
            return False
        data = frame(OP_TEXT, json.dumps(obj, separators=(',', ':')).encode())
        try:
            with self.lock:
                s.sendall(data)
            self.sent += 1
            return True
        except OSError:
            self._drop(s)
            return False

    def close(self):
        s = self.sock
        if s is not None:
            try:
                with self.lock:
                    s.sendall(frame(OP_CLOSE, struct.pack('!H', 1000)))
            except OSError:
                pass
            self._drop(s)

    def _drop(self, s):
        if self.sock is s:
            self.sock = None
        try:
            s.close()
        except OSError:
            pass

    # ---------- in (read and drop) ----------
    def _read(self, s, buf):
        def need(n):
            nonlocal buf
            while len(buf) < n:
                chunk = s.recv(65536)
                if not chunk:
                    raise ConnectionError('closed')
                buf += chunk
            out, buf = buf[:n], buf[n:]
            return out
        try:
            while True:
                b0, b1 = need(2)
                op, n = b0 & 0x0F, b1 & 0x7F
                if n == 126:
                    n = struct.unpack('!H', need(2))[0]
                elif n == 127:
                    n = struct.unpack('!Q', need(8))[0]
                mask = need(4) if b1 & 0x80 else None
                payload = need(n)
                if mask:
                    payload = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
                if op == OP_PING:
                    with self.lock:
                        s.sendall(frame(OP_PONG, payload))
                elif op == OP_CLOSE:
                    break
                elif op == OP_TEXT:
                    self.received += 1
                    if self.hello is None:
                        try:
                            m = json.loads(payload)
                            if m.get('type') == 'hello':
                                self.hello = m
                        except ValueError:
                            pass
                else:
                    self.received += 1
        except (OSError, ValueError, ConnectionError):
            pass
        self._drop(s)
