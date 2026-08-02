# cr-702-194-teamwork 冷監査ブリーフ

- milestone: cr-702-194-teamwork
- baseSha: a6ffd9f
- candidateFingerprint: a38535927a2b7d3ee40bccf0cd57ed3aca54735f69fbd850dd6ff98f39645f24
- contract: research/cr-grounding/cr-702-194-teamwork.draft.md
- CR refs: 702.194a, 702.194b, 702.194c, 601.2b, 601.2f-h

## 変更ファイル(6)

1. `src/engine/keywordGrammar.ts` — teamwork キーワード定義 + `parseTeamworkThreshold()`
2. `src/engine/types.ts` — `CardInstance.usingTeamwork?: boolean`
3. `src/engine/commands.ts` — `castToStack` に `teamworkTappedIds` + タップ処理
4. `src/store/gameStore.ts` — pendingCast teamwork 統合 + `answerPendingCastTeamwork`
5. `src/components/game/gameController.tsx` — teamwork UI
6. `src/components/game/DecisionBar.tsx` — チームワークボタン

## 監査観点

1. CR 702.194a 準拠: 任意追加コストとして「合計パワーN以上のクリーチャーをタップ」が正しく実装されているか。
2. CR 702.194b 準拠: `usingTeamwork` フラグがキャスト時の意図宣言を正しく記録しているか。
3. 原子性: タップとキャストが一つの transaction として実行され、undo で同時に巻き戻るか。
4. 既存回帰: non-teamwork カードのキャストフローに影響がないか。
5. 型安全性: `any` なし、strict mode 準拠。
6. engine 純粋性: `src/engine/` に React/DOM/Zustand 依存がないか。
7. 検証ロジック: パワー合計の閾値検証、タップ済み/非クリーチャー/相手コントロールの除外。
8. UI 統合: pendingCast prompt の消費順、既存 target prompt との共存。

## 監査コマンド

```bash
npx vitest run src/engine/__tests__/review.cr702-194-teamwork.test.ts src/store/__tests__/review.cr702-194-teamwork.test.ts
npx vitest run --project engine --project dom
npx tsc -b
```

## 判定基準

- BLOCKER/HIGH = 0 なら `AUDIT-OK-PENDING-FULL-CHECK`
- findings は重要度(BLOCKER/HIGH/MEDIUM/LOW)と分類(implementation/compiler/substrate/contract/ambiguity)を付与
