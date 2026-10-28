#!/bin/sh
# Test a runner PR before it is merged, in a scratch clone at /tmp/test-pr: the runner's unit tests
# (node --test qa/runner/test/*.test.mjs) and a syntax check (node --check) of every qa/runner/*.mjs file, then a
# one-line summary. Writes nothing to the QA tree, the runner clone or GitHub. No arguments; the PR is
#   1. the number in ~/.cache/cellular-viz-runner/test-pr (or $TEST_PR_FILE), written by QA box's file tool, else
#   2. the newest open PR labelled runner-test (gh, the box's login).
# It never takes the PR from an argument. Like the runner (guard rail 2 in runner.mjs) it only runs a PR that is open,
# whose head branch is in this repo (no forks) and whose author is on RUNNER_AUTHORS (runner.env, default borboss366),
# and only the exact commit the API showed; anything else exits 2 before any of the PR's code is fetched.
# QA box types it the same way every time:
#   sh /path/to/cellular-viz-runner/qa/test-pr.sh
set -u
REPO=borboss366/cellular-viz
DIR=/tmp/test-pr
PR_FILE=${TEST_PR_FILE:-$HOME/.cache/cellular-viz-runner/test-pr}
ENV_FILE=${RUNNER_ENV:-$HOME/.config/cellular-viz-runner.env}
[ -f "$ENV_FILE" ] || ENV_FILE=$HOME/.cache/cellular-viz-runner/runner.env
AUTHORS=""
[ -f "$ENV_FILE" ] && AUTHORS=$(sed -n 's/^RUNNER_AUTHORS=//p' "$ENV_FILE" | tail -n 1 | tr -d '"'"'"' ')
AUTHORS=${AUTHORS:-borboss366}

PR=""
if [ -f "$PR_FILE" ]; then
  PR=$(tr -cd '0-9' < "$PR_FILE")
  [ -n "$PR" ] && echo "PR #$PR (from $PR_FILE)"
fi
if [ -z "$PR" ]; then
  PR=$(gh pr list --repo "$REPO" --label runner-test --state open --limit 1 --json number --jq '.[0].number // empty' 2>/dev/null)
  [ -n "$PR" ] && echo "PR #$PR (newest open PR labelled runner-test)"
fi
if [ -z "$PR" ]; then
  echo "test-pr: no PR: write its number to $PR_FILE or label it runner-test"
  exit 2
fi

# the guard: ask the anonymous REST API about the PR before fetching anything from it
SHA=$(PR="$PR" REPO="$REPO" AUTHORS="$AUTHORS" node -e '
  const { PR, REPO, AUTHORS } = process.env;
  const authors = AUTHORS.split(",").map(s => s.trim()).filter(Boolean);
  fetch(`https://api.github.com/repos/${REPO}/pulls/${PR}`, { headers: { accept: "application/vnd.github+json", "user-agent": "cellular-viz-test-pr" } })
    .then(async r => {
      if (!r.ok) throw new Error(`GitHub API ${r.status} for PR #${PR}`);
      const p = await r.json();
      const why = p.state !== "open" ? `state is ${p.state}`
        : !p.head || !p.head.repo || p.head.repo.full_name !== REPO ? `head branch is not in ${REPO} (fork: ${p.head && p.head.repo ? p.head.repo.full_name : "deleted"})`
        : !authors.includes(p.user && p.user.login) ? `author ${p.user && p.user.login} is not on RUNNER_AUTHORS (${authors.join(",")})`
        : null;
      if (why) throw new Error(`refused PR #${PR}: ${why}`);
      console.log(p.head.sha);
    })
    .catch(e => { console.error(`test-pr: ${e.message}`); process.exit(2); });
') || exit 2
echo "guard ok: open, branch in $REPO, author on RUNNER_AUTHORS, head ${SHA%${SHA#???????}}"

if [ ! -d "$DIR/.git" ]; then
  rm -rf "$DIR"
  git clone -q "https://github.com/$REPO.git" "$DIR" || { echo "test-pr: clone failed"; exit 2; }
fi
git -C "$DIR" fetch -q --force origin "+pull/$PR/head:refs/remotes/origin/pr/$PR" || { echo "test-pr: fetch of pull/$PR/head failed"; exit 2; }
# only the commit the guard looked at: a push in between would bring code nobody checked
GOT=$(git -C "$DIR" rev-parse "origin/pr/$PR")
if [ "$GOT" != "$SHA" ]; then
  echo "test-pr: refused PR #$PR: pull/$PR/head is $GOT but the API showed $SHA (pushed just now? run it again)"
  exit 2
fi
git -C "$DIR" checkout -q -f --detach "$SHA" && git -C "$DIR" clean -q -fdx
echo "at $(git -C "$DIR" log -1 --format='%h %s')"
cd "$DIR" || exit 2

FAIL=0
echo "== node --check qa/runner/*.mjs"
CHECKED=0
for f in qa/runner/*.mjs; do
  [ -f "$f" ] || continue
  CHECKED=$((CHECKED + 1))
  node --check "$f" || { echo "syntax error: $f"; FAIL=1; }
done
echo "$CHECKED files checked"

echo "== node --test qa/runner/test/*.test.mjs"
TESTS=$(ls qa/runner/test/*.test.mjs 2>/dev/null)
if [ -z "$TESTS" ]; then
  echo "no test files"
  FAIL=1
else
  OUT=$(mktemp)
  # the TAP tail (# tests, # pass, # fail …) is the summary; failing tests are listed before it
  node --test --test-reporter=tap $TESTS > "$OUT" 2>&1
  RC=$?
  grep -E '^not ok|^# (tests|suites|pass|fail|cancelled|skipped|todo|duration_ms)' "$OUT"
  if [ $RC -ne 0 ]; then
    FAIL=1
    echo "-- first failure:"
    awk '/^ *not ok/{p=1} p{print; if (++n >= 25) exit}' "$OUT"
  fi
  rm -f "$OUT"
fi

if [ $FAIL -eq 0 ]; then echo "PASS: PR #$PR"; else echo "FAIL: PR #$PR"; fi
exit $FAIL
