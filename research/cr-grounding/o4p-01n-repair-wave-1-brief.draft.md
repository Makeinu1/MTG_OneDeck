# O4P-01N repair wave 1 brief

Role: return to the same Luna implementer. This is not a new implementation
lane, contract-author task, audit, or release task.

Base SHA: `435b691b63492ebb66389cfa37c8a5a3d6d102b4`

Frozen authority:

- `research/cr-grounding/o4p-01n-mode-neutral-core-closure.contract.draft.md`
  including the 2026-08-12 first-review amendment
- `research/cr-grounding/o4p-01n-acceptance-brief.draft.md`

Allowed writes remain exactly:

- `src/engine/core/closure/**`
- ordinary tests under `src/engine/core/closure/__tests__/**`

## Findings to close

### HIGH N-R1-01 shallow command normalization

`commandV1.ts` casts `input`, `effect`, `zone`, `attack`, and `block` into
shipped types without strict nested normalization; `createCoreCommandV1` uses
spread on untrusted input; array validation does not reject all extra/symbol
properties. Implement the amended strict structural boundary and add hostile
getter, proxy, sparse, extra-field, symbol, malformed nested input, and deep
freeze tests. Return deterministic complete issues without invoking getters.

### HIGH N-R1-02 invalid rejection digest

`applyCoreCommandV1` rejects a malformed command before calculating the valid
root digest, returning empty before/after digest strings. Calculate the real
unchanged digest for every rejection against a valid root and test malformed
command, stale sequence, wrong authority, and operation failure.

### HIGH N-R1-03 authority not bound to payload

Generic active-player and decision-authority checks do not prevent one actor
from conceding another player, correcting another player's life, passing for a
different player, or opening search under a mismatched rules actor. Implement
the exact envelope/payload bindings in the amendment and focused reject tests.

### HIGH N-R1-04 guessed player-exit transition

`handlePlayerExit` recomputes cleanup and chooses `activeIds[0]` instead of
consuming the shipped M reconciliation result. Use the returned lists and
handoff values. Reject active-player and unresolved priority-holder exit using
the frozen stable codes. Add accepted non-active/non-priority exit and both
reject vectors, asserting exact root identity and no events on rejection.

### HIGH N-R1-05 correction reason exposure

`createCoreCorrectionWarningV1` places the user reason in warning `message`.
Replace it with fixed safe text, validate expected digest syntax, and prove the
reason is absent from serialized result warnings/events/issues while remaining
in the typed journal command.

### HIGH N-R1-06 replay validation is not hostile-safe/exact

`validateCoreCommandJournalEntryV1` and `validateCoreReplayPackageV1` read
untrusted properties directly, do not enforce every required field or package
unknown field, and use ordinary array iteration. Implement exact-record,
dense-array, descriptor/proxy-safe canonical validation and contiguous command
sequence checks. Add tampered status/digests/version/sequence/random order and
getter/proxy tests with first-divergence assertions.

### BLOCKER N-R1-07 four-player closure evidence is vacuous

The current ordinary suite has only four tests, and the headless test executes
one Commander-cast command. Add the complete deterministic four-player
scenario frozen in contract section `Four-player closure vectors` and
acceptance `N-4P-01`. Every V1 payload kind must be covered positively or by an
intentional typed reject. Assert save/load/replay equality and final state/event
digests. Do not weaken or remove any DEFER.

## Required checks

- all ordinary closure tests
- targeted ESLint for the closure lane
- `npm run build`
- `git diff --check`
- exact changed-file and forbidden-path comparison against the Base SHA

Do not run full `npm run check`, edit judge-owned files, change the frozen
contract, or perform git operations.

Return the original implementation packet plus a finding-by-finding closure
table for N-R1-01 through N-R1-07. STOP if any finding requires a new payload
kind, root field, dependency, or write outside the lane.
