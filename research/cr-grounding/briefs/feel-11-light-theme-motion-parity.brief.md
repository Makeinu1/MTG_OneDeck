# feel-11 ライトテーマ・モーション parity

- milestone: `feel-11-light-theme-motion-parity`
- base SHA: `5d790e49a0a89974cdcfcf97fab02aad8e539c1c`
- supersedes: AV5/AV6 の「ライトテーマでは実効無演出」境界
- user ruling: 2026-08-08「カードが踊るなどの実装がダーク版だけだ。ライト版にもその辺り含めた効果を盛り込め」

## Goal

既存の AV5 パーマネント・アンビエントビートと AV6 2フェーズリズム + ダンスフロア照明を、ライトテーマでも同じ拍・位相・フェーズ・設定ゲートで有効化する。ライトの色・背景スキンは維持し、ライト専用の新しい演出や音は追加しない。

## Frozen behavior

1. `:root[data-ambient='on']` かつ `prefers-reduced-motion` 非該当のゲーム画面では、ダーク/ライト双方で既存の土地、非土地パーマネント、戦場の統率者、統率領域の統率者 idle、dance-floor pool が既存の AV5/AV6 CSS choreography を使う。
2. transport の `--bar`、`--transport-bar-phase-delay`、`data-commander-on-battlefield`、`data-just-arrived`、tap mute、密度減衰は変更しない。ライトでも現在のBGMのTrack transportをそのまま共有する。
3. 背景モーション OFF、`prefers-reduced-motion: reduce`、ゲーム画面外では既存どおり静止する。レイアウトを動かすアニメーション、JS毎フレームループ、イベント音、PresentationEvent、SFX素材は追加しない。
4. ダークの色・強度・周期・DOM構造・音響を退行させない。ライトは既存の light skin/token と mana pool 色を使い、暗曲や暗色レイヤーを表示しない。
5. undo/redo/remount/reload は既存どおり履歴・音・演出を再演しない。ライト/ダークを各 375×812、812×375、1440×900 で確認し、console error/warn と横 overflow を0件にする。

## Implementation scope

- `src/components/game/game.css`: AV5/AV6 のライトテーマ停止 override を除去し、共通 selector を両テーマに適用。
- `src/components/game/__tests__/review.av5-permanent-beat.test.ts` と `review.av6-two-phase-beat.test.ts`: 旧ライト無演出 assertion を、両テーマで共通 choreography が成立し、reduced-motion/ambient OFF がなお停止する assertion へ再所有。
- `docs/audio-visual-contract.md`, `docs/acceptance.md`, `docs/design-system.md`: 旧ライト無演出境界を新しい feel slice で supersede。過去の出荷記録は変更しない。
- `research/cr-grounding/ledger-update-feel-11.draft.json`: feel レーンの判定者エントリ草稿。

## Non-goals

- BGM、SFX、音量、AudioContext、TrackManifest の変更。
- 新しい視覚イベント、入力直接演出、依存追加、背景スキンの再設計。
- reduced-motion 契約、背景モーション設定、既存 dark の挙動変更。
