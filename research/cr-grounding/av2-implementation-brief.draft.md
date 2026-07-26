# AV2 implementation brief — streaming runtime, settings, and ambient transport

## Role and boundaries

You are the `qwen3.8-max-preview` implementer. Implement AV2 only. Do not use git and
do not modify `review.*`, `docs/`, `AGENTS.md`, the ledger, game engine/store APIs,
semantic controller actions, ordinary event sounds, cast/land/turn effects, or the
commander ritual.

Read only:

- `AGENTS.md`
- `docs/audio-visual-contract.md` §§4, 6
- `docs/ui-architecture-v2.md` §§7.4–7.6
- `src/components/game/__tests__/review.av2-runtime-settings.test.ts`
- current AV0/AV1 modules under `src/components/game/presentation/`
- `GameScreen.tsx`, `ThumbZone.tsx`, `AmbientBackdrop.tsx`, `ambientMotion.ts`,
  their ordinary tests, and the relevant ambient/menu blocks in `game.css`
- `src/ui/theme.ts` and `src/components/ThemeToggle.tsx`

## Required result

1. Add `musicBus.ts` with a streaming `HTMLMediaElement` runtime connected through
   `MediaElementAudioSourceNode`; use exactly two media elements and the 40ms
   equal-power boundary. Never decode the full MP3 and never set native `loop=true`.
   Preserve current position in module memory for same-page unmount/remount and start
   a new page load at track start.
2. Add `AudioVisualProvider.tsx` and mount it once around the game screen subtree.
   Unlock on the first game-screen `pointerdown` or non-modifier `keydown` in capture
   phase, without cancelling the underlying action. Theme/route/settings only alter
   effective output, not saved preferences. Pause outside dark game scope; resume the
   remembered full-track position on return. Failure is contained as audio status.
3. Music, event, commander, and master buses must be separate gain lanes even though
   AV2 only uses the music lane. BGM gain is -4.5dB. Keep an inaudible transport when
   dark-game ambient motion is ON and BGM/event sound are OFF.
4. Expose current transport phase to the game root with CSS custom properties. Ready
   transport supplies quarter-note duration and negative phase delay; unavailable or
   pre-gesture transport leaves the existing 700ms background fallback. No React or
   Zustand frame clock. Runtime FFT is forbidden.
5. Remove the combat 525ms, combat core, heat edge, fire/full-screen flash branch.
   Central core stays `0.4↔0.92`, `1↔1.05`; vignette is inverse; status/stack use the
   same clock. Make the heart a fixed two-hit pattern in one four-beat bar. Stars,
   gas, aurora, and shooting stars retain independent slow timing.
6. Move the settings immediately after the theme row, in this order:
   `BGM`, `ゲーム進行音`, `背景モーション`. Use test IDs `menu-bgm`,
   `menu-event-sounds`, `menu-ambient`. Persist BGM/event independently through the
   AV0 preference module; migrate the legacy event-sound value. Keep ambient storage.
   In light theme show `ライトテーマでは音は流れません`. Only inside the menu show
   `最初の操作で再生` while waiting and `音を開始できませんでした` on failure.
7. Motion OFF or reduced-motion stops continuous transform/scale animations without
   muting audio. Do not add a volume slider, player, new HUD, track picker, dependency,
   or light-theme BGM.

The runtime must tolerate jsdom/unsupported Web Audio, media play rejection, provider
remount, theme switches, and duplicate effect execution without throwing or spawning
duplicate playback.

## Verification/report

Update ordinary tests for changed behavior. Run AV2 judge pin, relevant ordinary
tests, all AV0/AV1 pins/tests, and lint. Report only:

1. changed files
2. exact test results
3. deferred items
4. unresolved concerns
