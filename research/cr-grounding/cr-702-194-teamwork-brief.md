# cr-702-194-teamwork 実装ブリーフ

- milestone: cr-702-194-teamwork
- baseSha: a6ffd9f
- brief: research/cr-grounding/cr-702-194-teamwork.draft.md
- lane: leaf-compiler
- judge: deterministic-cr

## Goal

CR 702.194 Teamwork キーワードの cast-time 追加コスト(任意・クリーチャータップ)を認識し、既存 pendingCast transaction 上で原子実行する。stack item に `usingTeamwork` フラグを記録する。

## Constraints

- `src/engine/` は純粋関数のみ。React/DOM/Zustand 依存禁止。
- TypeScript strict、`any` 禁止。UI文言は日本語、コード/コメント/識別子は英語。
- `review.*` テストは変更禁止。`AGENTS.md`、`docs/`、台帳、git 操作禁止。
- 既存の non-teamwork カードのキャストフローに影響を与えない。
- 効果本体の "if cast using teamwork" 条件分岐は本スライスでは manual のまま。
- `SNAPSHOT_VERSION` / `CACHE_SCHEMA_VERSION` は変更しない。

## 実装ファイル(変更許可)

1. `src/engine/keywordGrammar.ts` — teamwork キーワード定義追加 + `parseTeamworkThreshold` エクスポート
2. `src/engine/types.ts` — `CardInstance.usingTeamwork?: boolean` 追加
3. `src/engine/commands.ts` — `castToStack` variant に `teamworkTappedIds?: string[]` 追加 + `applyCastToStack` でタップ処理
4. `src/store/gameStore.ts` — `PendingCastTransaction` 拡張 + `castToStack()` 内 teamwork 検出 + `answerPendingCastTeamwork` アクション + `confirmPendingCast` 拡張
5. `src/components/game/gameController.tsx` — teamwork cost-tap prompt の UI 統合
6. 通常テスト(任意): `src/engine/__tests__/teamworkKeyword.test.ts`、`src/store/__tests__/teamworkCast.test.ts`

## Done when

- `parseTeamworkThreshold('Teamwork 4 (As an additional cost...)')` === 4
- `parseTeamworkThreshold('Flying')` === null
- `KEYWORD_DEFINITIONS` に teamwork が存在
- Teamwork カードの castToStack が pendingCast を設定し、cost-tap prompt を含む
- answerPendingCastTeamwork が合計パワー検証(threshold 未満は拒否)
- confirmPendingCast が teamworkTappedIds 付きコマンドを dispatch
- クリーチャーがタップされ、stack item に usingTeamwork: true
- teamwork 不使用(0件)でもキャスト成功、usingTeamwork は undefined
- undo でタップ+キャストが同時巻き戻り
- 既存テスト全緑(`npx vitest run --project engine --project dom` で対象テスト)
