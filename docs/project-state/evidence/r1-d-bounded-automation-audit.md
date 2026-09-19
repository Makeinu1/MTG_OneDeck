# R1-D bounded automation audit

Repository: Makeinu1/MTG_OneDeck  
Base main: `6840a19cee6f6be0c3936e697a0e65bf00aedca8`  
Reviewed watched-root candidate: `1fb38c9b62bc249c3315a733de08e8c37a2b6179`

## Purpose

R1-D closes the residual gameplay-automation execution defects identified after R1-A and reconstructs the bounded production automation ownership used by CR-15. It does not claim a repository-wide proof that every possible automation path has been exhaustively enumerated.

## Confirmed and repaired residuals

1. Mixed guided deterministic commands could be dropped when every target prompt had already been stored at cast time. `guidedPlanForStackTop()` returned `null` solely because no unresolved prompt remained, even though deterministic commands remained.
2. Stored-target resolution could report success when `buildGuidedCommands()` generated no executable command.

R1-D changes the first boundary to return a plan when unresolved prompts **or deterministic commands** remain, and the second boundary to count stored-target execution as applied only after at least one executable command is generated.

## Bounded automation surfaces reconstructed

### Legacy/local compatibility path

- `src/engine/grammar/compile.ts`: parser/compiler boundary. Ambiguous or unsupported semantics fail to guided/manual rather than fabricating a command.
- `src/engine/commands.ts`: canonical GameCommand mutation owner, auto/guided resolution helpers, stored-target execution.
- `src/store/gameStore.ts`: guided-resolution transaction orchestration and grouped command commit.

### Cockpit primary path

- `src/engine/cockpitTriggersCore.ts`: semantic event collection and trigger candidate detection. The compatibility GameState used for detection has `effectsAuto: false`.
- `src/engine/cockpitTriggers.ts`: reviewed trigger occurrence materialization after explicit place/link operations.
- `src/engine/cockpitR31.ts`: conservative lifecycle-only resolution shortcut; uncertain semantic work falls back to Manual Resolution.

## Verification ownership

- `src/store/__tests__/stackControl.test.ts`
- `src/engine/__tests__/review.grammar-compile.test.ts`
- `src/engine/__tests__/review.grammar-guided.test.ts`
- `src/store/__tests__/review.feel-2-silent-skip-honesty.test.ts`
- `src/engine/__tests__/cockpitTriggers.test.ts`
- `src/engine/__tests__/cockpitR31Lifecycle.test.ts`

## Reconciliation

R1-B exact pair:

- base: `6840a19cee6f6be0c3936e697a0e65bf00aedca8`
- head: `1fb38c9b62bc249c3315a733de08e8c37a2b6179`
- outcome: `OWNER_REVIEW_REQUIRED`
- M3 coverage: `VERIFIED_WITHIN_DECLARED_COVERAGE`
- `PRESERVATION_CANDIDATE=15`
- `REVIEW_REQUIRED=0`
- `UNKNOWN=0`
- Project State control changes before reconciliation: none
- semantic blockers: none

Owner review preserves all existing capability verdicts. CR-15 is explicitly reviewed despite the planner's current direct-ref blind spot.

## CR-15 conclusion

CR-15 remains `UNKNOWN / UNKNOWN`.

This is intentional and narrower than before R1-D: the current known production automation ownership is now explicitly registered, and the confirmed R1 execution defects are closed. What remains unproved is **exhaustive completeness** across every production-reachable legacy/supporting path, not the ownership of the R1-reviewed paths above.

This residual UNKNOWN is a visible M6 input, not an R1 execution blocker.
