# QA index — 04 Lenia metronome

Videos live in `videos/`. Score is the harness auto score (0–10); verdict is the user's.

| date | variant | params (query) | video | score | cover | motion | fps | verdict | notes |
|---|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — | no sweep run yet |

Known user feedback so far (from chat, pre-harness):
- Fills up then freezes with σ 0.028 → fixed by block coverage + stillness threshold (PR #15).
- Clear-out effect liked; refill was too slow → refill speed slider (PR #16).
