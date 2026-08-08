# feel-7 audio start on game start

## Goal

Align the first audible transport/SFX gesture with the `ゲーム開始` action so the initial seven-card deal can emit the existing draw cue instead of waiting for a later interaction.

## User ruling and contract

The user confirmed that selecting `ゲーム開始` must start audio immediately and that the first deal sound must not be lost. `docs/audio-visual-contract.md` revision 2026-08-08 is the normative ruling.

## Scope

- `src/App.tsx`
- `src/components/game/GameScreen.tsx`
- `src/components/game/presentation/AudioVisualProvider.tsx`
- `src/components/game/presentation/SemanticPresentationLayer.tsx`
- ordinary tests for the above; do not edit `review.*`

## Acceptance

1. The `ゲーム開始` handler invokes a module-level audio-start helper before `newGame(deck)`; the helper does not prevent or stop the click and never awaits audio before GameState initialization.
2. The helper marks the page-session gesture unlocked, creates/resumes the AudioContext/runtime on that same gesture, applies saved BGM/SFX settings, and begins asynchronous SFX preload. Provider mount reuses the already-unlocked session without requiring another input.
3. A newly started game emits exactly one existing `draw-completed` presentation cue for the seven-card opening deal after the semantic subscriber is mounted. It does not replay on React remount, restore, mulligan, undo, or redo. If light theme, event sounds OFF, or audio load failure applies, it remains silent without affecting state.
4. Existing provider placement, game actions, settings, reduced-motion behavior, and responsive layout remain unchanged. No new `PresentationEvent.kind`, audio asset, dependency, or GameState field is introduced.
5. Targeted review and ordinary tests pass; browser evidence at 375x812, 812x375, and 1440x900 has no new console errors and the first start click requires no follow-up gesture.

## Out of scope

Do not move the provider to the import screen, make GameState await decoding, add a separate game-start sound asset, or broaden semantic audio beyond the initial draw cue.
