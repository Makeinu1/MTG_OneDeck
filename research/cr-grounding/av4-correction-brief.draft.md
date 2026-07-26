# AV4 correction brief (implementer lane)

Read only:

- `AGENTS.md`
- `docs/audio-visual-contract.md` §§2.1, 4, 5
- `src/components/game/__tests__/review.av4-commander-ritual.test.ts`
- `src/components/game/presentation/CommanderRitualLayer.tsx`
- `src/components/game/presentation/commanderRitual.ts`
- `src/components/game/presentation/semanticSound.ts`
- `src/components/game/presentation/audioVisualSession.ts`
- `src/components/game/presentation/presentationSequencer.ts`

Do not read the rest of the repository unless a failing targeted test names a direct dependency.

## Role and boundaries

Implementer only. Do not edit `docs/`, `review.*`, `AGENTS.md`, git state, or governance files.
Change only ordinary source/tests needed for this correction. Do not add dependencies or audio assets.

## Findings to correct

1. `CommanderRitualLayer` starts its motif immediately instead of using the same frozen 16th-note snap calculation as other musical events. Compute one `presentationSoundDelayMs(getSessionTransportPositionSec())` value per commander event and use a shared scheduled start for the motif and duck. State and visual cut-in remain immediate and must never await the delay.
2. With `eventSoundsEnabled=false` and BGM enabled, the current code still ducks MusicBus. This is an audible semantic event and violates contract §4 step 2. Duck only when both `eventsAudible` and `musicAudible` are true. Motif still plays when event sounds are enabled and BGM is disabled.
3. Repeated commander casts replace React state but may reuse the same DOM, so CSS animation is not guaranteed to restart. Preserve the sequenced `event.id` in active ritual state and key `CommanderCutIn` by that ID.
4. Do not use `Date.now()` for ritual identity. Reuse the browser-session monotonic presentation event ID. Change `CommanderCutInData` accordingly or remove its unused token.
5. Oscillator/envelope references must be removed and disconnected on `onended`; event count must not cause retained nodes to grow.
6. Duck cancellation must not make muted/light output audible. On policy-off, cancel automation and leave MusicBus at zero; on ordinary completion/recast while effective music remains on, restore the fixed BGM base gain. Keep the existing provider/runtime as the owner of theme and preference policy.

## Acceptance

- Updated judge evidence passes unchanged:
  `npx vitest run src/components/game/__tests__/review.av4-commander-ritual.test.ts`
- AV4 ordinary tests cover the pure delay/envelope calculation or a suitably extracted pure scheduling plan, repeated-event identity, event-sound-off/no-duck policy, and bounded cleanup behavior without source-text tests where a behavior test is practical.
- AV3 evidence and commander store tests remain green.
- Changed files pass ESLint and `tsc -b`.
- No change to turn-transition timing, non-commander events, store APIs, or contract files.

Report only:

1. changed files
2. exact test/check results
3. deferred work
4. concerns
