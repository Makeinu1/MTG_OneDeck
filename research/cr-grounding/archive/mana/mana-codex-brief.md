# S-EVENTS / MANA — CR 605.1b triggered mana ability 実装ブリーフ(Codex 自己完結)

発行: Fable / 2026-06-30
設計正本: `research/cr-grounding/mana-ability-substrate.md`(R-FREEZE-3)
固定CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19
対象CR: 605.1a / 605.1b / 605.3b / 605.4a / 605.5 / 405.6c

## 目的(1行)

起動型マナ能力(605.1a)に加え、**誘発型マナ能力(605.1b)を `pendingTriggers` / stack に混ぜず、mana ability transaction 内で固定点まで即時解決する** substrate を実装する。

## スコープ境界(Fable 判断・厳守)

- **substrate(transaction 経路)はフル実装**: `ManaAddedEvent` / `ActivatedManaAbilityEvent` 型、`PendingManaTrigger` 型、`resolveManaAbilityTransaction` 固定点ループ(iteration cap + warning 付き)、605.1b 分類判定。
- **実カード検出 observer は DEFER(実装しない)**: 「どの実カードが triggered mana ability(605.1b)を持つか」を実カードから網羅検出する配線は C-GRAMMAR トラックへ。**型定義と transaction 経路は置く。golden ケースは合成盤面(下記)で検査する。** 実カードコーパス分類は作らない。
- **full SBA suite を引き込まない(最大リスク)**: transaction は mana の加算と triggered mana ability 即時解決だけ。新 SBA ルールを足さない。SBA 拡張は別マイルストーン S-SBA。
- **無限ループ防止**: transaction-local queue を固定点まで回すが、iteration cap(例: 256)を超えたら warning / log を残して停止する(設計 §Transaction algorithm)。

## 既存コードの現況(確認済み・Fable)

- 起動型マナ能力 plan = `src/engine/commands.ts` の `activatedManaAbilityPlanForSource`(605.1a/3b・no-stack・実装済)。判定は `isActivatedManaAbilityIR`(targetless + `effect.add-mana` + 非 loyalty)。
- その呼び出し側 = `src/store/gameStore.ts:1681` 付近。ここが mana ability を盤面へ適用する箇所。
- 型: `src/engine/types.ts` に `ManaPool`(L26)・`ObjectSnapshot`(L67)・`PendingTrigger`(L126・既に `stackPlacementBucket` を持つ)。
- pending trigger 生成 = `src/engine/triggers.ts`。

## 対象ファイル

- `src/engine/types.ts` — `ManaAddedEvent` / `ActivatedManaAbilityEvent` 型定義(設計 §推奨イベント)。`PendingManaTrigger` 型定義(設計 §推奨キュー・`ruleRef: '605.1b'`)。**これらは `GameState.pendingTriggers` に保存しない**(別経路)。
- `src/engine/commands.ts` または新規 `src/engine/manaTransaction.ts`(純関数) — `resolveManaAbilityTransaction(state, activatedManaAbility): { state, manaEvents, log }` を設計 §Transaction algorithm に従い実装。補助: `collectTriggeredManaAbilities`(605.1b 分類)、`triggeredManaAbilityPlan`、`collectManaAddedEvents`。**`addAbilityToStack` を使わない・priority boundary へ渡さない。**
- 605.1b 分類器 — targetless + (activated mana ability の activation/resolution か mana-added event から trigger) + 解決時 mana 加算しうる。**`effect.add-mana` だけでは 605.1b にしない**(trigger source が mana-related でないと通常誘発)。**target を取るなら通常誘発**。
- `src/store/gameStore.ts` — `activatedManaAbilityPlanForSource` 適用後に `resolveManaAbilityTransaction` を呼び、起動型 + 誘発型を1 transaction(1 undo 単位)で解決する。snapshot 復元の前方互換(新フィールド追加時は backfill。`PendingManaTrigger` は state に保存しないので snapshot 影響は最小)。
- テスト: golden 3件(下記)。`resolveManaAbilityTransaction` の unit テスト(固定点・cap・分類境界)。

## 追加する golden ケース(`mana-ability-substrate.md` §Golden cases に一致)

`research/cr-grounding/golden-cases.json` へ追記し `src/store/__tests__/crGroundingGoldenCases.test.ts`(既存)で実行可能化。

1. `cr-triggered-mana-ability-no-stack`(605.1b/605.4a) — land A `{T}: Add {G}.` + permanent B `Whenever a player taps a land for mana, that player adds one mana of any type that land produced.`。A 起動 → A も B も stack に置かれない・`pendingTriggers` 増えない・manaPool は A+B 両方を反映・priority boundary を待たない。
2. `cr-add-mana-trigger-from-non-mana-event-is-normal-trigger` — permanent C `Whenever you cast a spell, add {G}.`。spell cast → C は 605.1b でない・通常 pending trigger・stack placement は CR 603/117/704 の priority boundary に従う。
3. `cr-targeted-add-mana-trigger-is-normal-trigger` — target を取る add-mana 誘発 → 605.1b でない・通常 `pendingTriggers` に入る。

## 変更禁止 / 規律

- **`review.*` を名に含むテストは変更禁止**(レビュー担当専有。落ちたら実装コードを直す)。
- **`docs/` を直接編集しない**。engine-spec §34 系へ入れたい型契約は `research/cr-grounding/mana-engine-spec.draft`(CR 条番号併記)へ草稿として出す。Fable が独立監査後に docs へ昇格・commit する。
- **git 操作禁止**(commit/push は Fable)。`CLAUDE.md` に触れない。
- エンジン(`src/engine/`)は純粋関数のみ。GameState はイミュータブル(構造共有)。`applyCommand` は決定的。
- I1〜I7 不変条件を維持。新 state を足したら必要に応じプロパティテストを追加。
- ルール本文の読み取りは英語 `oracleText` を正本とする。

## 受け入れ条件(全て緑)

- 機械チェック4点: `npm run lint` / `npx tsc --noEmit` / `npx vitest run` / `npm run build`。
- 上記3 golden が通る。
- triggered mana ability(605.1b)が `GameState.pendingTriggers` に一切入らない(no-stack)。
- 605.1b 境界が正しい: 非 mana-event 由来の add-mana 誘発・target を取る add-mana 誘発は通常誘発として `pendingTriggers` に入る。
- transaction が mana-added event からの連鎖(605.1b の誘発が更に mana を加える)を固定点まで処理し、cap 超過時は warning を残して停止する。
- 既存テスト緑(回帰なし)。

## 中断時

「実装済み/残作業」を明示して再実行(最大2回)。それでも未完なら Fable が仕上げる。
