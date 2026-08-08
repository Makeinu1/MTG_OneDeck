# feel-9 ライトテーマ音響対応とBGM差し替え配線

- milestone: `feel-9-light-theme-audio-wiring`
- base SHA: `f1dc005cb0bc0644163471ea20e0f231c797e0a4`
- contract: `docs/audio-visual-contract.md` revision 2026-08-08-light-audio
- ledger proposal: `research/cr-grounding/ledger-update.draft.json`
- role: implementer; git、`docs/`、ledger、`AGENTS.md`、`CLAUDE.md`、`eslint.config.js`、`review.*` testは変更禁止

## Goal

ダークテーマで承認済みの意味イベントSEを、ライトテーマのゲーム画面でも同じ素材・同じミックス・同じ設定で有効化する。ライト用BGMは選定・生成・追加せず、将来の任意TrackManifestを接続できるテーマ別プロファイルだけを実装する。

## Frozen behavior

1. ゲーム画面かつ初回gesture解除済みなら、両テーマで `eventSoundsEnabled` に従い既存SFXを再生する。
2. BGMはテーマの有効TrackManifestがあるときだけ可聴。ダークは現行 `DARK_GAME_TRACK`、ライトは `null` のまま。
3. ライトでTrackが `null` の間、SEは即時再生(遅延0ms)。ダークの曲をライトの仮BGM・無音拍時計・同期ソースに使わない。
4. `transportRunning` は実TrackによるBGM/拍時計用。SEの発火条件は `eventsAudible` とし、BGMなしライトでもSEを止めない。
5. 有効Trackがある場合、`presentationSoundDelayMs` はそのTrackのanchor/gridを使い、commander duckは `musicAudible` のときだけ行う。
6. GameState、GameCommand、PresentationEvent kind、SFX asset、依存、入力直接発音は追加しない。失敗・pre-gesture・game外・設定OFFは無音へ縮退する。
7. ライトの背景motion、AV5/AV6の視覚ゲート、reduced-motion、ダークの既存挙動は変更しない。
8. メニューのBGM設定は保存・表示し、ライトでTrackがない場合だけ `ライト用BGMは未選択` を表示する。ゲーム進行音に「ライトテーマでは音は流れません」は表示しない。

## Implementation scope

- `src/components/game/presentation/trackManifest.ts`: theme profile (`dark` track / `light` null)を追加。
- `audioVisualPreferences.ts`: light event audibility、optional track-aware runtime policy、dark-only ambient transportを分離。
- `AudioVisualProvider.tsx` / `musicBus.ts`: 共通AudioContext/SFX busと任意BGM runtimeを分離し、light null trackでMediaElementを作らない。dark trackのpage-session position retentionを維持。
- `semanticSound.ts` / `SemanticPresentationLayer.tsx` / `CommanderRitualLayer.tsx`: active Trackまたはnullを受け、null時は0ms、active時は既存grid/duckを使う。SEは `eventsAudible` のみで発火する。
- `ThumbZone.tsx`: track-aware hintへ変更。
- ordinary tests only: policy/profile/timing/runtime/menu testsを追加・更新する。`review.*` testは触らない。

## Acceptance

- dark `DARK_GAME_TRACK` manifest/hash/anchors/native-loop behavior unchanged.
- light + gesture + event sounds ON => existing SFX can schedule/play; no BGM MediaElement is created for light null track.
- light null track => sound delay 0; no dark-track timing dependency.
- gesture前、game外、event OFF、SFX load/decode failure => no success sound and no thrown game error.
- theme switch/remount/undo/redo/reload does not replay old presentation events; dark BGM position behavior remains intact.
- menu contains current controls, only BGM has the unselected-light-track hint, obsolete light-silence copy is absent.
- targeted tests and `npx tsc -b` pass; no full check during implementation.

## Report

Report changed source/ordinary-test files, targeted test commands and counts, any defer, and any unresolved runtime/browser limitation. Do not claim audited or shipped.
