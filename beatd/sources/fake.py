"""The fake source: a metronome at a set tempo, no audio. It ships first and is what the tests use (brief task 2).

Every source plug-in has the same three calls:
  start(rate)                  the audio rate it will be fed (a fake ignores it)
  feed(samples, t_wall_ms)     a block of mono float audio whose first sample was heard at t_wall_ms (a fake ignores it)
  read(now_wall_ms)            its state now, or None while it has nothing: { t, beats, bpm, confidence, state }
                               t: wall time in ms (the pages' clock); beats: beats since its start at t (fractional)
"""


class FakeMetronome:
    kind = 'fake'
    needs_audio = False

    def __init__(self, bpm=120.0, id='fake', phase_ms=0.0):
        if not (20.0 <= float(bpm) <= 300.0):
            raise ValueError(f'fake tempo {bpm}: 20-300 bpm')
        self.id, self.bpm, self.phase_ms, self.t0 = id, float(bpm), float(phase_ms), None

    def start(self, rate=None):
        self.t0 = None

    def feed(self, samples, t_wall_ms):
        pass

    def read(self, now_ms):
        if self.t0 is None:
            self.t0 = now_ms - self.phase_ms
        beats = (now_ms - self.t0) * self.bpm / 60000.0
        return {'t': round(now_ms, 3), 'beats': round(beats, 6), 'bpm': self.bpm, 'confidence': 1.0, 'state': 'locked'}
