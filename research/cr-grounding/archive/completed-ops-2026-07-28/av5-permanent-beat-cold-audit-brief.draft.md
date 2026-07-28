# AV5 パーマネント・アンビエントビート — 冷監査ブリーフ

**監査対象**: AV5 パーマネント・アンビエントビート(統率者ダンス / 土地ベースライン)
**claimed status**: implemented-not-audited → shipped 昇格の可否を判定する
**契約正本**: `docs/audio-visual-contract.md` §10(2026-07-27 ユーザー裁定)
**受け入れ**: `docs/acceptance.md` M-AV5(AV-40〜AV-52)
**視覚参照**: `research/design/mockups/beat-motion.html`(承認済みモック)

## 変更ファイル(10 files, +344/-12)

| ファイル | 変更内容 |
|---|---|
| `docs/audio-visual-contract.md` | §10 追加(パーマネント・アンビエントビート契約) |
| `docs/acceptance.md` | M-AV5 シナリオ追加(AV-40〜AV-52) |
| `docs/design-vision.md` | AV5 行追加 |
| `src/components/game/presentation/presentationTuning.ts` | AV5 TUNABLE フィールド追加 |
| `src/components/game/presentation/permanentBeat.ts` | 新規: `beatDensity()` 純粋関数 |
| `src/components/game/presentation/audioVisualTransport.ts` | `barMs` / `barPhaseDelayMs` 追加 |
| `src/components/game/presentation/AudioVisualProvider.tsx` | `--transport-bar-ms` / `--transport-bar-phase-delay` 設定 |
| `src/components/game/GameCard.tsx` | `game-card--commander` クラス付与 |
| `src/components/game/LandRow.tsx` | `data-beat-index` / `--beat-density` / `data-beat-tapped` |
| `src/components/game/Board.tsx` | `data-beat-index` / `--beat-density` |
| `src/components/game/game.css` | キーフレーム + 適用セレクタ + reduced-motion |
| `src/components/game/__tests__/review.av5-permanent-beat.test.ts` | 判定者専有テスト(25 tests) |

## 監査手順

### 1. 契約整合性(§10 と実装の一致)

- `docs/audio-visual-contract.md` §10 を全文読む
- 実装が §10 の MUST / MUST NOT / TUNABLE / STOP 条件と矛盾しないか検証
- 特に: 音の追加なし・`PresentationEvent.kind` 不追加・戦闘で強度不変・個別トグルなし・ライトテーマ無演出

### 2. Transport 正確性

- `getTransportCssTiming` の `barMs` / `barPhaseDelayMs` 算出ロジックを敵対的に検証
- 小節境界の定義(beatIndex mod 4 == 0)が anchor スパン跨ぎ・ループ巻戻りで正しいか
- 既存の `beatMs` / `phaseDelayMs` に回帰がないか

### 3. CSS 構造検査

- `game.css` の AV5 追加部分を精読
- transform/opacity 以外のプロパティをアニメーションしていないか(filter/box-shadow/background の animation)
- `:root[data-ambient='on']` ゲートが全セレクタにあるか
- reduced-motion 上書きが完全か
- 生カラー(hex/rgb/hsl)がトークン期 CSS に混入していないか(`review.css-token-guard` が緑であること)
- キーフレーム値がモック(`beat-motion.html`)の承認済み値と一致するか

### 4. React 分類の正確性

- `GameCard.tsx`: `game-card--commander` が `isCommander && zone === 'battlefield'` のみで付与されるか(統率領域では付かない)
- `LandRow.tsx`: `data-beat-index` が bundles 配列の index と一致するか
- `Board.tsx`: `data-beat-index` が projection の bundle index と一致するか
- `--beat-density` の算出が `beatDensity()` を使っているか(ハードコードなし)
- `data-beat-tapped` がタップ状態と一致するか

### 5. 密度減衰の正確性

- `beatDensity()` の境界値(6=full, 12=zero, 9=0.5)が正しいか
- 束が1スロットとして数えられるか(LandRow の bundles.length を使っているか)
- CSS 側で `--beat-density` が振幅スケーリングに使われているか

### 6. 性能契約(§7)との整合

- カード1枚あたりの追加 DOM 要素が最大3枚か(glow + overlay + shadow)
- `will-change` がアニメーション対象要素のみに付与されているか
- JS ループ・React state・毎フレームの DOM 操作がないか(純粋 CSS アニメーションか)

### 7. 機械チェック

- `npx tsc -b --noEmit` → 0 errors
- `npx vitest run` → 全緑(302 files / 2472 tests)
- `npx eslint src/` → 0 errors(pre-existing warning は許容)
- `npm run build` → 成功

## 出力形式

各チェック項目ごとに:

```
### [項目名]
**verdict**: SHIPPED-OK / BLOCKER / HIGH / MEDIUM / LOW
**evidence**: (具体的なファイル:行番号、またはテスト出力)
**finding**: (問題がある場合のみ。なければ "なし")
```

## 制約

- **ファイル編集禁止・findings only**
- 契約・盤面・テストを変更しない
- CR 参照先: `rule/Magic_The_Gathering_Comprehensive_Rules.txt`(2026-06-19 版)
- 実装の正当化をしない。「この status 主張を敵対的に検証せよ」
