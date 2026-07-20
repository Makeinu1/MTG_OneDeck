# D8 + nextTurn 是正 — 冷監査チェックリスト

**作成**: 2026-07-21 qwen 判定者席
**対象コミット**: `89de89b` (D8 AmbientLayer) + `8179161` (nextTurn 陳腐化是正)
**監査者**: 実装文脈を持たない別セッション（冷監査者席）

## 監査スコープ

### D8 AmbientLayer
1. **既存 UI 不変**: カード配置・クローム・メニュー・配置に差分ゼロ。`AmbientBackdrop` は `z-index:-1` + `pointer-events:none` + `aria-hidden` で全クロムの下に積層。
2. **トークンガード準拠**: `game.css` に生カラーゼロ（`review.css-token-guard.test.ts` 緑）。全色は `tokens.css` の `--ambient-*` に集約。
3. **パフォーマンス**: `feTurbulence`/`will-change`/`mix-blend-mode` が `game.css` と `AmbientBackdrop.tsx` に存在しない。
4. **reduced-motion**: `data-reduced` + `@media (prefers-reduced-motion: reduce)` の二重安全網。アンビエント全静止 + 流れ星非表示。
5. **トグル**: `menu-ambient` ボタンが ThumbZone に存在。OFF で `AmbientBackdrop` が null を返す。`document[data-ambient]` が同期。
6. **二スキン**: `html[data-theme='light']` でダーク層が非表示・ライト層が表示。逆も同様。
7. **ターン演出**: 光輪（rays/ring）が CSS/TSX/テストに存在しない。スウィープ+スタンプ+描き線のみ。
8. **ドロー被りズレ**: `.turn-transition-layer[data-kind='turn']` で `translate: 0` が効く。
9. **cleanup-discard 解決後の演出**: `gameController.tsx` の `onConfirm`/`onManualHandled` で `announceTransition` が呼ばれる。

### nextTurn 陳腐化是正
10. **CR 514.1 準拠**: `applyNextTurn` が cleanup-discard 生成時に return する（スキップしない）。
11. **review.* 更新の正当性**: `review.m430.test.ts` と `review.cr603-triggers-sliceA.test.ts` の変更が「cleanup-discard 解決後にターン進行を検証」する形に限定されている（テストの本質的意図を損なわない）。
12. **多人数戦**: `advanceTurnOrder` パラメータが `applyNextTurn` で正しく処理される（cleanup-discard がない場合の turn+1 経路）。
13. **store レベルのガード**: `dispatchTurnTransition` が `pendingRuleChoices.length > 0` でブロックする（nextTurn 呼び出し前に cleanup-discard があれば store 側で弾かれる）。

## 監査手順
1. 上記13項目をコード読んで確認。
2. `npm run check` 全緑を確認。
3. 実機ブラウザで: ダーク/ライト切替・トグルOFF/ON・ターン交代・cleanup-discard ダイアログ・reduced-motion を目視。
4. findings only で報告（契約・盤面を変えない）。
