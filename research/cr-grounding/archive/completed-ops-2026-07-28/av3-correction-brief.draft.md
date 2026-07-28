# AV3 correction brief — attempt 2 (final implementer retry)

Correct the current AV3 implementation. Do not broaden scope. Read the current changed AV3 files and both `review.av3-*` tests only.

Required fixes:

1. A deleted `CelebrationLayer.tsx` still breaks `HudInteractions.test.tsx`. Remove the obsolete chain test/import/mock and remove the now-unused `celebrationTimelineModel.ts`, its test, and `sound.ts`. Remove the unused sound mock in `CommanderAltar.test.tsx`. These are ordinary production/test files, not judge files.
2. Cast/land publication must prove a **new appended** zone change:
   - capture `beforeEventCount` immediately before every store call that may commit;
   - inspect only `after.eventLog.slice(beforeEventCount)`;
   - publish only a matching new cast-to-stack (`reason === 'cast'`) or play-land-to-battlefield event;
   - cover ordinary, forced-payment, and pending-target confirmation paths;
   - never search the whole historical log, so errors/no-ops cannot replay a stale success.
3. `presentationSoundDelayMs` must delegate to `getNextGridDelayMs(positionSec, DARK_GAME_TRACK, AUDIO_VISUAL_TUNING)` so sparse anchors, loop wrapping, 60ms snap and 80ms ceiling remain one source of truth.
4. Expose the AV2 music runtime position through `audioVisualSession.ts` as `getSessionTransportPositionSec()`. Register the getter only after MusicRuntime creation succeeds and clear it on disposal/failure. Semantic sound must use that media/Transport position, not `AudioContext.currentTime % trackLength`.
5. Schedule event oscillators with Web Audio time (`osc.start(ctx.currentTime + delayMs / 1000)`), not `setTimeout`. Choke prior same-kind voice. If event audio becomes ineffective or the layer unmounts, stop/disconnect all scheduled/current voices so light mode and route exit are immediately silent.
6. Make spell pulse target the rendered StackBand and land settle target the newly rendered card. Use a layout effect and `getBoundingClientRect()` against the game root; source-coordinate absence must degrade to the stack/board center without blocking. Keep land at exactly 240ms. Reduced motion is fade-only.
7. `presentationRuntime` must use a monotonic clock only; do not fall back to `Date.now`.
8. Add/update ordinary tests for stale-event rejection, force/pending paths where practical, transport-derived delay, voice scheduling/cleanup helpers, and semantic layer behavior. Do not edit any `review.*`, `docs/`, `AGENTS.md`, ledger, or git.

Run:

- both AV3 judge tests;
- `HudInteractions.test.tsx`;
- relevant AV0–AV2 presentation tests;
- lint;
- build.

Stop after a terse changed-files/results/defer/concerns report.
