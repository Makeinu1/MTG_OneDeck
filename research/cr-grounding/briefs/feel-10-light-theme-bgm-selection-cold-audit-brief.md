# feel-10 light theme BGM selection — cold audit brief

- milestone: `feel-10-light-theme-bgm-selection`
- base SHA: `f1dc005cb0bc0644163471ea20e0f231c797e0a4`
- audit mode: findings only; do not edit files, docs, review tests, ledger, or git
- audit standing: read `.claude/audit-standing.md` first
- candidate fingerprint: judge will provide the frozen fingerprint after this brief and the candidate are finalized

## Contract claims to adversarially verify

1. The user-selected `sound/ライトテーマ.mp3` is copied byte-for-byte to `public/audio/bgm/light-theme.mp3`, the production manifest points to that asset, and the recorded SHA-256 is exact. Do not infer or certify an external license.
2. In an unlocked light game screen with both preferences ON, the effective policy selects the light Track, makes BGM and existing semantic SFX audible, and runs the selected Track transport. BGM OFF, event-sounds OFF, pre-gesture, outside-game, and audio load failure remain silent in their respective lanes.
3. Light semantic SFX use the existing event allowlist, samples, mix, and commander ritual. Ordinary SFX and commander motif use the selected light Track grid; commander duck occurs only when music is audible. No direct input sound or new PresentationEvent/SFX asset is introduced.
4. The light runtime creates one native-loop media element for the selected asset and does not use the dark Track as fallback. A future `null` theme Track still creates no media runtime and uses immediate SFX timing.
5. Dark `DARK_GAME_TRACK` source/hash/anchors/native-loop, dark BGM-off ambient transport, BGM/SFX settings, and per-track page-session position retention remain unchanged. Theme switch, gesture, remount, reload, undo, redo, and failed actions do not replay old semantic events.
6. The menu keeps BGM and game-sound ON/OFF plus volume controls in light mode, has no obsolete `ライト用BGMは未選択` or `ライトテーマでは音は流れません` copy, and does not alter the existing light visual-motion or reduced-motion contract.
7. The selected BGM asset is the only new production audio asset for this milestone. No dependency, visual choreography, or unrelated contract is added.

## Required evidence

- Run `npm run check:forbidden` and report all output, distinguishing judge-owned review files from implementer-owned files.
- Run the related judge-owned review files, including feel-9/10 light audio, AV0/AV2/AV3/AV4/AV7/AV8 pins, and inspect for deleted or weakened assertions.
- Inspect source and diff for dark-track leakage, policy/transport mistakes, native-loop or track-position lifecycle leaks, asset/hash mismatch, stale menu copy, and vacuous tests.
- Perform the required browser checks in one session for light/dark at 375×812, 812×375, and 1440×900. Inspect console error/warn counts, overflow/layout, menu controls, light game-start/opening-deal/semantic interaction path, and dark BGM regression. If the environment lacks AudioContext or media playback, report that limitation precisely instead of treating it as an audible pass.
- Do not run `npm run check`; the judge runs it after findings close on the same final fingerprint.

## Verdict format

Return findings only with severity and `file:line` plus an input→wrong-result scenario. If BLOCKER/HIGH are zero, return exactly `AUDIT-OK-PENDING-FULL-CHECK` and list evidence plus MEDIUM/LOW caveats. Do not claim shipped.
