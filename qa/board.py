#!/usr/bin/env python3
"""Move cards on the cellular-viz board (GitHub Projects v2, user borboss366, project 1).

  python3 qa/board.py set 45=QA 49=QA 20="Your review"     # add if missing, set Status
  python3 qa/board.py sync                                 # closed/merged → Done, missing open items → Ideas
  python3 qa/board.py show

Uses the box's gh login (needs the project scope). QA box's rule after every run:
new PR → QA, check passed → Your review, check failed → In progress.
"""
import json, subprocess, sys

OWNER, REPO, NUMBER = 'borboss366', 'cellular-viz', 1

def gql(q, **v):
    args = ['gh', 'api', 'graphql', '-f', f'query={q}']
    for k, x in v.items(): args += ['-F' if isinstance(x, int) else '-f', f'{k}={x}']
    out = subprocess.run(args, capture_output=True, text=True)
    if out.returncode: raise SystemExit(out.stderr)
    return json.loads(out.stdout)['data']

def project():
    d = gql('''query($o:String!,$n:Int!){ user(login:$o){ projectV2(number:$n){ id
      field(name:"Status"){ ... on ProjectV2SingleSelectField { id options { id name } } }
      items(first:100){ nodes{ id fieldValueByName(name:"Status"){ ... on ProjectV2ItemFieldSingleSelectValue{ name } }
        content{ ... on Issue{ number state title } ... on PullRequest{ number state title } } } } } } }''', o=OWNER, n=NUMBER)['user']['projectV2']
    opts = {o['name']: o['id'] for o in d['field']['options']}
    items = {}
    for it in d['items']['nodes']:
        c = it['content'] or {}
        if 'number' in c: items[c['number']] = {'item': it['id'], 'status': (it['fieldValueByName'] or {}).get('name'), 'state': c['state'], 'title': c['title']}
    return d['id'], d['field']['id'], opts, items

def node_id(n):
    d = gql('query($o:String!,$r:String!,$n:Int!){ repository(owner:$o,name:$r){ issueOrPullRequest(number:$n){ ... on Issue{id state title} ... on PullRequest{id state title} } } }', o=OWNER, r=REPO, n=n)
    return d['repository']['issueOrPullRequest']

def set_status(pid, fid, opts, items, n, status):
    it = items.get(n, {}).get('item')
    if not it:
        it = gql('mutation($p:ID!,$c:ID!){ addProjectV2ItemById(input:{projectId:$p,contentId:$c}){ item{ id } } }', p=pid, c=node_id(n)['id'])['addProjectV2ItemById']['item']['id']
    gql('mutation($p:ID!,$i:ID!,$f:ID!,$o:String!){ updateProjectV2ItemFieldValue(input:{projectId:$p,itemId:$i,fieldId:$f,value:{singleSelectOptionId:$o}}){ projectV2Item{ id } } }', p=pid, i=it, f=fid, o=opts[status])
    print(f'#{n} → {status}')

cmd = sys.argv[1] if len(sys.argv) > 1 else 'show'
pid, fid, opts, items = project()
if cmd == 'set':
    for a in sys.argv[2:]:
        n, s = a.split('=', 1); set_status(pid, fid, opts, items, int(n), s)
elif cmd == 'sync':
    lst = json.loads(subprocess.run(['gh', 'issue', 'list', '-R', f'{OWNER}/{REPO}', '--state', 'all', '--limit', '200', '--json', 'number,state'], capture_output=True, text=True).stdout)
    lst += json.loads(subprocess.run(['gh', 'pr', 'list', '-R', f'{OWNER}/{REPO}', '--state', 'all', '--limit', '200', '--json', 'number,state'], capture_output=True, text=True).stdout)
    for x in sorted(lst, key=lambda x: x['number']):
        n, st = x['number'], x['state']
        cur = items.get(n, {}).get('status')
        if st in ('CLOSED', 'MERGED') and n in items and cur != 'Done': set_status(pid, fid, opts, items, n, 'Done')
        elif st == 'OPEN' and n not in items: set_status(pid, fid, opts, items, n, 'Ideas')
else:
    for n, v in sorted(items.items()): print(f"#{n:<3} {v['status'] or '—':12} {v['state']:7} {v['title'][:60]}")
