# AV3 implementer brief — semantic sound and restrained feedback

Implement only AV3 against the frozen `docs/audio-visual-contract.md`.

Read only these production areas plus the named judge tests:

- `src/components/game/gameController.tsx`
- `src/components/game/GameScreen.tsx`
- `src/components/game/PresentationLayer.tsx`
- `src/components/game/CelebrationLayer.tsx`
- `src/components/game/celebrationTimelineModel.ts`
- `src/components/game/sound.ts`
- `src/components/game/ThumbZone.tsx`
- `src/components/game/HandRibbon.tsx`
- `src/components/game/presentation/*`
- `src/components/game/game.css`
- `src/components/game/__tests__/review.av3-legacy-removal.test.ts`
- `src/components/game/__tests__/review.av3-semantic-runtime.test.ts`

Required result:

1. Add `presentation/presentationRuntime.ts`. Export `createPresentationRuntime(sessionNonce, clock)` and a browser-session singleton `presentationRuntime`. It projects through AV1, sequences monotonically, and provides future-only subscriptions. Reload/remount/history cannot replay old events.
2. Publish exactly once after successful commits in the existing controller paths for:
   - cast to stack (including payment-force and pending-target confirmation paths);
   - land play to battlefield (including confirmation/tap-choice paths);
   - actual turn-number advance.
   Use appended `zoneChange` evidence for successful casts and its `eventId`; do not infer from log text. Commander cast must be classified exclusively as `commander-cast`.
3. Add `presentation/semanticSound.ts`. Export deterministic `semanticSoundSpec(kind)` and `presentationSoundDelayMs(positionSec)`. Ordinary sound exists only for spell, land, turn. Commander returns null here (AV4 owns it). Schedule to the next 16th only when <=60ms, always <=80ms, and replace/choke same-kind voices rather than adding intensity.
4. Connect semantic sound to the AV2 EventBus only while the derived policy says events are audible. State and visuals never wait for audio.
5. Add `SemanticPresentationLayer`: spell gets one restrained blue-white stack endpoint pulse; land gets one card-local gold settle for 240ms; turn adds no second fullscreen visual because the existing transition cue is reused. Same-kind feedback restarts/replaces. Use transform/opacity, no particles/frame-clock arrays. Reduced motion is fade-only.
6. Remove `CelebrationLayer` from production and all legacy `celebrate('primary'|'draw'|'resolve'|'chain'|'commander')` calls. Draw/resolve/tap/mana/life/phase/settings produce no semantic sound. Keep functional causality/focus/failure UI.
7. Ordinary tests may be added/updated. Do not edit `review.*`, `docs/`, `AGENTS.md`, ledger, or git state.

Run the two AV3 judge tests, relevant ordinary tests, lint, and build. Report only:

- changed files
- exact test/build results
- deferred items (AV4 commander ritual is expected)
- concerns
