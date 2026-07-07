# MyDeck Playability Play-through Summary

Generated: 2026-07-07T12:09:24.283Z

## Re-run

`npx tsx --loader ./scripts/mydeck-scoring/dir-import-loader.mjs scripts/mydeck-scoring/playthrough.ts`

(the extra `--loader` flag works around a pre-existing tsx/Node directory-import gap — see scripts/mydeck-scoring/dir-import-loader.mjs header and the final report's "blockers" section; `npm run golden-replay` hits the same crash today for the same reason)

## Method

Deterministic seeded heuristic (seed=1), 10 turns per deck. Per turn: advance through all phases (draw on the draw step), play the first untapped land in hand in main1, then repeatedly cast the cheapest affordable non-land card (hand first, commander from command zone included) using the real autotap solver (`planAutoTap`/`solvePayment`) to build payment, cast via `castToStack`/`castCommander`, then fully resolve the stack via `resolveStackTop` before considering the next cast. Not an attempt to play well — the goal is to exercise real resolution machinery turn after turn.

## Per-deck results

| deck | turns completed | spells cast | interventions | warnings | crashed |
|---|---|---:|---:|---:|---|
| Celes | 10/10 | 11 | 1 | 0 | no |
| Gogo | 10/10 | 11 | 0 | 0 | no |
| Kefka | 10/10 | 10 | 1 | 0 | no |
| Muldrotha | 10/10 | 7 | 1 | 0 | no |

## Notes

- "interventions" = number of stack-resolve steps where `guidedPlanForStackTop` reported at least one prompt (i.e. the line needed a target/choice the heuristic did not supply). The line itself is silently skipped by the engine (not crashed) — see per-deck JSON `turns[].pendingGuidedPrompts` and `boardStateAfterTurn` for eyeballing wrong automations.
- Full turn-by-turn logs and board-state snapshots are in `research/mydeck-scoring/playability/playthrough-<deck>.json`.
