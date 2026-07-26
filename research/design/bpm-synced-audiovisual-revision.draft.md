# BPM同期オーディオビジュアル議論 — superseded pointer

**status**: superseded / 実装禁止  
**作成・凍結**: 2026-07-26  
**役割**: 議論が正式契約へ移されたことだけを示すポインタ。実装仕様を持たない。

## 実装者の読込先

1. 意味・STOP・TUNABLE: `docs/audio-visual-contract.md`
2. HOW: `docs/ui-architecture-v2.md` §7
3. VERIFY: `docs/acceptance.md` M-AV
4. WHY: `docs/design-vision.md` §2

本ファイルから値・イベント・演出・実装順を推測してはならない。

## 正式契約へ移したユーザー裁定

- 通常操作を履歴、連鎖、カード強度で盛らず、同じ意味へ同じ手触りを返す。
- 初期musical eventは成功済みの通常cast、土地プレイ、ターン進行だけ。
- stack解決、draw、tap/untap、mana、life/counter、combat、入力イベント自体は初期musical eventにしない。
- 統率者castだけは専用音・既存cut-in・BGM duckを持つ固有儀式とする。
- GameStateと即時因果表示は拍同期を待たない。
- ダーク曲は短い断片でなく全曲が周期復帰するloopとし、音源制作は別タスクで行う。
- Webブラウザ性能とユーザーの不快感判定を合否条件にする。

## 撤回済みであり復活させない候補

- 「デッキが動き出す瞬間だけ一段盛る」という旧北極星
- chain / participation densityによる自動高揚
- stack解決音
- クリック、PrimaryAction、drawへの直接音
- 戦闘中だけ背景を加速・増幅すること
- commanderの解決時までゲームを待たせること
- 固定BPMだけから作る未裁定の拍細分・秒数表
- MP3のraw `loop=true`

議論の最終結果は上記active contractだけに存在する。
