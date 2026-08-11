# O4P-01N judge acceptance brief

Status: frozen by the Sol judge on 2026-08-12; not an implementer write lane.

Base SHA: `435b691b63492ebb66389cfa37c8a5a3d6d102b4`

Contract:
`research/cr-grounding/o4p-01n-mode-neutral-core-closure.contract.draft.md`

## Judge-owned evidence paths

- `src/engine/core/closure/__tests__/review.o4p-01n-mode-neutral-core-closure.test.ts`
- `src/test/architecture/review.o4p-01n-mode-neutral-core-closure-boundary.test.ts`
- `src/engine/core/fixtures/o4p-01n-mode-neutral-core-closure-v1.json`
- `scripts/checks/verify-mode-neutral-core-closure.ts`
- package registration selected by the Sol judge after the implementation
  candidate is frozen

These paths are not available to the Luna implementer. They are added serially
after the lane-local ordinary tests pass.

## Acceptance IDs

### N-ROOT-01 exact canonical root

- Four-player root validates all nested J/K/L/M bundles.
- Registry players, player-zone keys, and turn order exactly match the
  lifecycle-active subset in order; lifecycle itself remains the stable full
  historical roster after player exit.
- Missing, unknown, duplicated, stale, exited, or cross-slice IDs fail with
  deterministic complete frozen issues.
- Accepted root is fresh, deeply frozen, and canonical across JSON round trip.

### N-CMD-01 command authority and atomicity

- Command sequence is contiguous and independent of future Room revision.
- Actor and decision maker are both active registered players.
- Decision maker equals the shipped L authority query for the supplied context.
- Wrong maker, stale sequence, malformed payload, or shipped-operation failure
  returns `rejected`, exact input-root identity, no events, and unchanged digest.
- Accepted command increments the count once and produces only the events
  prescribed by its closed handler.

### N-CMD-02 closed adapters

Exercise every V1 payload kind at least once across positive or reject vectors:

- card-spell stack commit and stack removal;
- priority pass;
- search open and complete;
- control effect application;
- four registered Commander identities, Commander cast, and provenance-gated
  Commander damage whose combat object matches the physical Commander;
- combat step, attack, and block;
- concession and defeat player exit;
- deterministic player-library order;
- both typed correction kinds.

Assert that no event, handler, or public type claims any DEFERred adapter or
full combat-damage automation.

### N-RANDOM-01 recorded outcome only

- `Math.random`, clocks, seeds, environment state, and replay redraw are absent.
- Only a player library is accepted; shared zones and other player zones reject.
- Before-order must equal the current library exactly.
- After-order must be a dense exact permutation; missing, duplicate, foreign,
  accessor, sparse, or reordered-before input rejects atomically.
- Replaying the same command yields the same root/event bytes and digest.

### N-CORRECT-01 typed correction

- Life and Commander-damage corrections are closed typed commands.
- Matching before digest plus non-empty reason yields
  `accepted-with-warning` and `MANUAL_CORRECTION_APPLIED`.
- Whitespace-only reason, stale digest, wrong authority, invalid target/value,
  duplicate sequence, and invariant break reject without mutation.
- No arbitrary path, JSON Patch, whole-state replacement, or generic payload is
  exported.

### N-EVENT-01 derived event transcript

- Events are generated only after successful semantic change.
- Event sequence/index ordering is stable and deeply frozen.
- Rejected commands emit zero events.
- Events do not contain complete roots, full hidden-zone contents, card
  definitions, transport fields, or arbitrary input echoes.
- Event data is never accepted by replay as a state-transition input.

### N-DIGEST-01 canonical SHA-256

- Standard empty-string and `abc` SHA-256 vectors match lowercase hex.
- Record keys use UTF-16 code-unit order; arrays retain order.
- Unsupported JSON values, accessors, symbols, sparse arrays, non-enumerable
  data, non-finite numbers, and proxy traps fail closed.
- Browser-safe source contains no `node:*` or new dependency import.

### N-REPLAY-01 save, load, and divergence

- Authoritative input is initial canonical root plus ordered typed commands.
- Journal result/event digests are evidence, never reducers.
- JSON round-trip package validates and replays to exact final state and event
  transcript digests.
- Tampered command, random order, status, before/after digest, event digest,
  version, or command sequence reports the first typed divergence.
- Solo `GameSnapshot` and `SNAPSHOT_VERSION` remain byte-for-byte untouched.

### N-4P-01 four-player single-process closure

One scenario uses P1–P4 and `applyCoreCommandV1` only for command transitions.
It covers priority, stack commit/removal, separated actor/decision maker,
search, control, Commander cast/tax, multiplayer combat, Commander damage,
deterministic zone order, correction, concession/player exit, ordinary reject,
save/load/replay, and final state/event digest equality.

After exit, surviving turn order, active player, priority, combat, search,
control, and decision references satisfy the shipped J/K/L/M validators. The
full lifecycle roster and Commander-damage/provenance player history remain;
the shipped Object Registry contains only active participants. The
scenario explicitly records disconnect, Room, projection, network, UI, generic
mutation, and full combat damage as DEFERred.

### N-ARCH-01 dependency boundary

Compiler-API inspection of `src/engine/core/closure/**` rejects imports from:

- React, DOM, Zustand, store, components, hooks, UI;
- Solo `GameState`, Solo `GameCommand`, `src/data/gameSnapshot.ts`;
- `src/online/**`, Cloudflare, Worker, Durable Object, WebSocket;
- Node-only crypto/runtime modules.

It also rejects ambient `Math.random`, `Date`, timers, locale ordering, open
payload records, `any`, generic patch/path setters, and a second event reducer.

## Candidate gate order

1. Luna ordinary targeted tests, targeted lint, build, and diff check.
2. Sol source review and serial public-root integration.
3. Judge fixture, verifier, architecture and review tests.
4. Targeted domain checks and candidate fingerprint freeze.
5. Independent Luna cold audit with only the audit brief path.
6. Close all BLOCKER/HIGH findings, refreeze, and re-audit as required.
7. `AUDIT-OK-PENDING-FULL-CHECK` on the final fingerprint.
8. One fingerprint-matched full `npm run check`.
9. Manifest/ledger/release work only under explicit publication authority.
