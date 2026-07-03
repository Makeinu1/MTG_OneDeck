# Q5 Phase 2 — S-EVENTS / PRIORITY 実装ブリーフ(Codex 自己完結)

発行: Fable / 2026-06-30
設計正本: `research/cr-grounding/priority-event-loop.md`(R-FREEZE-2)
固定CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19
対象CR: 117.5 / 603.3 / 603.3b / 704.3 / 101.4

## 目的(1行)

優先権境界を「pending trigger を APNAP 順に積める」だけで終わらせず、**priority fixed-point loop(`SBA → choice → trigger placement → repeat`)+ `PendingTrigger.stackPlacementBucket` substrate + bucket-aware ordering** を実装する。

## スコープ境界(Fable 判断・厳守)

- **substrate はフル実装**: bucket field・bucket-aware ordering・fixed-point loop・backfill。
- **detection observer は DEFER(実装しない)**: 「どの実カードが second bucket(誘発の誘発条件が *別の能力の誘発*)を populate するか」を判定する `AbilityTriggeredEvent` 検出 observer は C-GRAMMAR トラックへ送る。理由: substrate の field は ordinary backfill で前方互換なので、後付けが zero-rework。**`AbilityTriggeredEvent` 型の *定義* は置いてよいが、それを発火させる observer 配線・実カード分類は作らない。**
- **full SBA suite を引き込まない(最大リスク)**: loop は既存の `performStateBasedActions` 系を呼ぶだけ。新しい SBA ルールを足さない。SBA 拡張は別マイルストーン S-SBA。

## 対象ファイル

- `src/engine/types.ts` — `PendingTrigger` に `stackPlacementBucket: TriggerStackPlacementBucket` 追加。`type TriggerStackPlacementBucket = 'ordinary' | 'ability-triggered';` 追加。任意で `triggeredByPendingTriggerId?`/`triggeredByAbilityEventId?`。`AbilityTriggeredEvent` 型定義(発火配線なし)。
- `src/engine/priority.ts` — `orderPendingTriggersApnap` を `bucket -> APNAP controller -> controller chosen order` へ拡張(設計の擬似コード参照)。`ordinary` を先、`ability-triggered` を後。各 bucket 内で既存の APNAP+explicit order ロジックを再利用。
- `src/engine/triggers.ts` または pending trigger 生成箇所 — 新規生成 pending trigger は既定で `stackPlacementBucket: 'ordinary'`(現行 observer は zone-change/phase/attack/cast 由来=全て ordinary)。
- 新規 or 既存の priority モジュール — `advanceToPriority(state)` 固定点ループを純粋関数で追加(設計 `priority-event-loop.md` の `advanceToPriority` 擬似コードに従う。戻り値 union: `priority-ready` / `choice-required` / `trigger-order-required`)。`pendingRuleChoices`(Phase 1 既存)を読む。
- `src/store/gameStore.ts` — snapshot 復元(`restoreGame` 系)で **既存 snapshot の `PendingTrigger` に `stackPlacementBucket: 'ordinary'` を backfill**(前方互換。これを怠ると旧 snapshot 復元でクラッシュ/型不整合)。`orderPendingTriggersApnap` 呼び出し側の追従。
- テスト: `src/engine/__tests__/priority.test.ts` 拡張、golden は下記3件。

## 追加する golden ケース(`priority-event-loop.md` の定義に一致させる)

1. `cr-trigger-6033b-two-bucket-order` — explicit `[B, A]`(B=ability-triggered, A=ordinary)を渡しても placement は `[A, B]` に正規化。bucket 境界が controller explicit order より上位。
2. `cr-trigger-6033b-apnap-per-bucket` — P1:A(ord)/OPP:B(ord)/P1:C(ab-trig)/OPP:D(ab-trig)→ 全体 `[A, B, C, D]`(bucket ごとに APNAP)。
3. `cr-priority-loop-trigger-placement-rechecks-sba` — trigger を stack へ置いた後に必ず SBA へ戻る固定点。choice/order が要るところで止まる。

golden 定義は `research/cr-grounding/golden-cases.json` へ追記し、`src/store/__tests__/crGroundingGoldenCases.test.ts` で実行可能化する。

## 変更禁止 / 規律

- **`review.*` を名に含むテストは変更禁止**(レビュー担当専有。落ちたら実装コードを直す)。
- **`docs/` を直接編集しない**。engine-spec §34 系へ入れたい型契約は `research/cr-grounding/phase2-engine-spec.draft`(CR 条番号併記)へ草稿として出す。Fable が独立監査後に docs へ昇格・commit する。
- **git 操作禁止**(commit/push は Fable)。`CLAUDE.md` に触れない。
- I1〜I7 不変条件を維持。新 state を足したら必要に応じプロパティテストを追加。

## 受け入れ条件(全て緑)

- 機械チェック4点: `npm run lint` / `npx tsc --noEmit` / `npx vitest run` / `npm run build`。
- 上記3 golden が通る。
- 既存 snapshot 由来テストが緑(backfill 効いている)。
- `stackPlacementBucket` 未指定の既存 pending trigger が ordinary 扱いで従来挙動を保つ(回帰なし)。
- `advanceToPriority` が `pendingRuleChoices.length>0` で `choice-required`、order 不能で `trigger-order-required`、両方解消で `priority-ready` を返す。

## 中断時

「実装済み/残作業」を明示して再実行(最大2回)。それでも未完なら Fable が仕上げる。
