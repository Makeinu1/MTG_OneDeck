# feel-9 light theme audio wiring — cold audit brief

- milestone: `feel-9-light-theme-audio-wiring`
- base SHA: `f1dc005cb0bc0644163471ea20e0f231c797e0a4`
- frozen candidate tree fingerprint: `3a58635d20fdbe035ec3e132682418d593075f026e31dd4f2be22c225805e6d3`
- audit mode: findings only; do not edit files, docs, review tests, ledger, or git
- audit standing: read `.claude/audit-standing.md` first

## Contract claims to adversarially verify

1. Existing dark BGM/SFX behavior remains unchanged, including dark track hash/anchors/native loop, dark BGM-off silent transport when another dark consumer is active, independent preferences, and dark position retention.
2. In the unlocked game screen, light theme event SFX use the existing semantic event allowlist and fixed SFX palette. Light BGM is currently unselected and must be effectively silent.
3. A null light TrackManifest does not instantiate or play the dark BGM as fallback or clock. Light semantic SFX are scheduled immediately and do not require `transportRunning`.
4. If a future theme TrackManifest is supplied, timing routes through that track and commander duck remains conditional on audible music.
5. Pre-gesture, outside-game, event-sounds-OFF, SFX load/decode failure, remount, undo, redo, reload, and failed actions remain silent/non-replaying without delaying GameState.
6. No new PresentationEvent kind, SFX asset, dependency, direct input sound, light visual choreography, or reduced-motion regression was introduced.
7. Menu controls preserve independent BGM/SFX settings; only the light BGM control reports `ライト用BGMは未選択`; obsolete `ライトテーマでは音は流れません` is absent from active UI.

## Required evidence

- Run `npm run check:forbidden` and report all output.
- Run the related judge-owned review files, including `review.feel-9-light-theme-audio`, AV0/AV2/AV3/AV4/AV7/AV8 pins, and inspect test deletions/weakening.
- Inspect source and diff for vacuous assertions, dark fallback track leakage, policy gating mistakes, and theme-switch lifecycle leaks.
- Perform the required browser checks for light/dark at 375x812, 812x375, and 1440x900 with console error/warn inspection. Verify actual light game-start/opening-deal/semantic SFX path if the environment exposes audio; distinguish environment inability from product failure.
- Do not run `npm run check`; the judge runs it after findings close on the same fingerprint.

## Re-audit delta

The previous audit reported: judge-owned review files requiring re-ownership, stale pending draw SFX retry behavior, and a static-only light fallback assertion. The judge re-owned the review pins, the implementer changed pending draw retry failure handling to clear stale cues and emit at most one retry cue, and the judge expanded the light review with runtime/profile/timing assertions. The judge additionally pinned the null media-runtime boundary by directly asserting `createMusicRuntime(null, ...) === null`. Re-check those claims against the new fingerprint.

## Verdict

Return findings only with severity and `file:line` plus an input→wrong-result scenario. If BLOCKER/HIGH are zero, return exactly `AUDIT-OK-PENDING-FULL-CHECK` and list evidence and any MEDIUM/LOW caveats. Do not claim shipped.
