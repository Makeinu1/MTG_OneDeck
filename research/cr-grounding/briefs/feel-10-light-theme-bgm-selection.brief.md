# feel-10 ライトテーマBGM選定・配線

- milestone: `feel-10-light-theme-bgm-selection`
- base SHA: `f1dc005cb0bc0644163471ea20e0f231c797e0a4`
- supersedes: `feel-9-light-theme-audio-wiring` のライトBGM未選択(null)境界
- user ruling: 2026-08-08「ライトテーマ.mp3をsound配下においたこれをBGMにしてくれ」

## Goal

ユーザーが選定した `/sound/ライトテーマ.mp3` をライトテーマのゲームBGMとして、既存のテーマ別TrackManifest・AudioContext・BGM duck・拍同期へ接続する。ダークBGM、既存SE、設定保存、視覚演出は変更しない。

## Frozen behavior

1. 原本の `sound/ライトテーマ.mp3` は変更しない。production配信物は同一内容の `public/audio/bgm/light-theme.mp3` とする。
2. ライトの有効Trackは `LIGHT_GAME_TRACK`。gesture後かつゲーム画面でBGM設定ONなら再生し、既存SEは同じイベント・同じミックスで再利用する。
3. ライトTrackの拍時計で通常SE・commander motif・commander duck・背景の既存transport変数を駆動する。入力とGameStateは待たせない。
4. BGM設定OFF、pre-gesture、game外、AudioContext/media/SFX失敗時は無音へ縮退する。BGM/SFX設定は独立して保存する。
5. メニューの「ライト用BGMは未選択」は削除する。BGM/SFXのON/OFFと音量スライダーは表示・保存する。
6. 新しいPresentationEvent、SFX素材、入力直接発音、依存、ライト視覚演出、reduced-motion変更は追加しない。
7. ダークの `DARK_GAME_TRACK` のsrc/hash/anchors/native-loop/位置保持は完全不変。

## Asset facts

- source: `sound/ライトテーマ.mp3` (user-selected/user-authorized for this app; no external license claim inferred)
- SHA-256: `d73ab88a9a665dd684376d9e167f66297d909a6a63a6de195dcc455023c15148`
- duration: `362.879979` seconds
- format: MP3, 48,000 Hz, stereo, ~192 kbps
- measured global tempo: `117.829641` BPM; manifest uses 713 beats across the full track (`117.890212` effective BPM) with 32-beat anchors.
- runtime gain: existing `-4.5 dB` music bus baseline

## Acceptance

- `LIGHT_GAME_TRACK` validates and points to the production asset with the source hash.
- Light unlocked game policy returns `musicAudible: true`, `eventsAudible: true`, `transportRunning: true`, and the light Track.
- Light BGM runtime creates a media plan for the light asset; null-track guard remains covered for future unselected themes.
- Light semantic SFX delay uses the light Track grid, not 0ms/null fallback; future null-track behavior remains 0ms.
- Dark review pins remain unchanged in their dark values and pass.
- Menu no longer renders the unselected-light-track hint.
- Targeted tests, independent cold audit, browser checks, and one final `npm run check` are required. No push/Pages publication in this milestone.
