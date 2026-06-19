# 既存ゲームエンジン リファクタリング提案

目的: M6のルール本文分類・候補提示・半自動操作を入れても、`src/engine/` が完全ルールエンジン化せず、既存のサンドボックス哲学と純粋関数契約を維持できる構造にする。

参照:
- `docs/engine-spec.md`
- `docs/m5-rule-implementation-proposal.md`
- `docs/rule-automation-plan.md`
- `docs/mtg-rule-terms.md`
- `research/scryfall-rules/2026-06-19/analysis/m5-edh-priority-analysis.md`

## 1. 結論

M6の前に、またはM6.1と並行して、既存エンジンを大きく作り替える必要はない。ただし、M6.2以降で候補アクションを増やす前に、以下の薄い分離を入れるべき。

1. `applySequence` 相当を engine の公開純粋ヘルパーにする。
2. store内の複合操作を、純粋な `command builder` へ切り出す。
3. カード本文スキャンを `src/data/` の分類器・静的カード解析へ寄せる。
4. `src/engine/status.ts` は盤面から読める状態投影に絞る。
5. `commands.ts` は公開APIを維持したまま内部モジュール分割する。
6. 誘発候補は自動処理せず、M6.3で event/candidate queue として別レイヤーに置く。

優先度は「挙動を変えずに分離できるもの」から始める。M6.1は分類・表示のみなので、リファクタリング完了を待たずに実装可能。ただしM6.2以降の候補アクションは、先に command builder 化してから追加するほうが安全。

## 2. 現状整理

現在の責務はおおむね次の通り。

| 領域 | 現状 | 評価 |
|---|---|---|
| `src/engine/types.ts` | `GameState` / `CardInstance` / `ZoneId` / phase 等 | engine契約の中心。維持する |
| `src/engine/commands.ts` | `GameCommand`、`applyCommand`、移動、キャスト、スタック、トークン、フェイズ、マリガン等 | 純粋だが肥大化している |
| `src/engine/mana.ts` | マナコスト解析と支払い解決 | 独立性が高い。維持する |
| `src/engine/autotap.ts` | `GameState` から自動タップ案を作る | 純粋 planner として良い |
| `src/engine/status.ts` | キーワード、召喚酔い、有効パワー、fetch/cycling等の検出 | 盤面投影とカード本文解析が混在 |
| `src/store/gameStore.ts` | Zustand、履歴、snapshot、乱数、複合操作、UI向け戻り値 | 薄いラッパーを超えている |
| `src/data/*` | Scryfall、deck parser、cache、stats等 | M6分類器を置くべき場所 |

良い点:
- `applyCommand` は決定的で、入力 `GameState` をミューテートしない。
- undo/redo は snapshot 方式で明快。
- storeの `applySequence` により、複数コマンドを1つの undo 単位にできている。
- `autotap` / `mana` は純粋関数として切り出されている。
- すでに stack、ability object、token、counter、mill、discard、cycling、fetch などM6候補の土台がある。

問題点:
- `commands.ts` が多機能化しており、M6用コマンドを直接足すと reducer が読みにくくなる。
- `gameStore.ts` が state管理、乱数、複合操作、カード本文ヒューリスティック、UI向け分岐を同時に担っている。
- `status.ts` と `gameStore.ts` にカード本文スキャンが散在している。
- `fetchAbility`、`cyclingCost`、`landEntersTapped`、`manaProductionAmount` はM6分類器と重複しやすい。
- 複合操作の組み立てが store private なので、M6の候補アクションから再利用しにくい。
- 誘発候補を扱うイベント境界がまだない。`addAbilityToStack` はあるが、候補検出と積む操作の間にレイヤーがない。

## 3. 目標アーキテクチャ

M6以降の責務境界は次の形にする。

```text
Scryfall / deck import
  -> CardDef
  -> src/data/ruleTextClassifier.ts
  -> RuleTag / RuleDeckSummary

GameState
  -> src/engine/selectors.ts または status.ts
  -> 盤面から読める状態投影

RuleTag + GameState + user selection
  -> src/engine/commandBuilders/*
  -> GameCommand[]
  -> applyCommands
  -> GameState
```

### 3.1 engine

`src/engine/` は「盤面を変えるプリミティブ」と「盤面から計算できる投影」に限定する。

保持する責務:
- `GameState` / `GameCommand` / `applyCommand`
- `applyCommands` のような決定的 batch 適用
- マナコスト解析、支払い解決、自動タップ案
- ゾーン移動、スタック、トークン、counter、phase、turn、mulligan などのプリミティブ
- `effectivePower`、`isSummoningSick` など盤面状態から読める投影

入れない責務:
- Oracle text 全文の分類
- 公式CRの自動適用
- 対象適正の厳密判定
- 置換効果、継続効果、レイヤー計算
- 自動誘発解決

### 3.2 data

`src/data/` はカード定義や本文から静的な分類を作る。

候補:
- `src/data/ruleTextClassifier.ts`
- `src/data/rulePriority.ts`
- `src/data/ruleDeckSummary.ts`
- `src/data/cardText.ts`
- `src/data/staticCardAnalysis.ts`

ここに寄せるもの:
- `cardTexts`
- `splitRulesText`
- Scryfall `keywords` の正規化
- `cyclingCost`
- `fetchAbility`
- `landEntersTapped`
- `manaProductionAmount`
- M6の `RuleTag` 分類

注意: これらは `GameState` に依存しない。入力は原則 `CardDef`。

### 3.3 command builders

store内の複合操作を純粋関数にする。

候補ディレクトリ:
- `src/engine/commandBuilders/cast.ts`
- `src/engine/commandBuilders/mana.ts`
- `src/engine/commandBuilders/library.ts`
- `src/engine/commandBuilders/counters.ts`
- `src/engine/commandBuilders/stack.ts`
- `src/engine/commandBuilders/combat.ts`

例:

```ts
export interface CommandPlan {
  commands: GameCommand[];
  warnings: string[];
  status: 'ready' | 'needs-confirm' | 'needs-choice' | 'blocked';
}

export function buildCastFromHandCommands(
  state: GameState,
  cardId: string,
  opts: { xValue: number; force: boolean }
): CommandPlan;
```

command builder のルール:
- 純粋関数。Zustand、DOM、localStorage、IndexedDB に依存しない。
- 乱数が必要なら、生成済みの順列や選択済みIDを引数で受け取る。
- `GameState` を変更しない。
- 実行はしない。`GameCommand[]` を返すだけ。
- UI確認が必要なら `needs-confirm` / `needs-choice` を返す。

これにより、M6候補アクションは「候補を表示し、ユーザーが確定したら command builder を呼ぶ」だけで済む。

### 3.4 store

`src/store/gameStore.ts` は次の薄い責務に寄せる。

- 現在stateの保持
- undo/redo履歴
- snapshot保存/復元
- 乱数生成と順列確定
- command builder の結果を commit
- UIへ `needs-confirm` / `needs-choice` を返す

store内に残さないもの:
- カード本文の正規表現解析
- 複雑な `GameCommand[]` 組み立て
- ルール分類
- M6候補の優先度計算

## 4. 段階的リファクタリング計画

### R0: 保護テストと現状固定

目的: 挙動変更なしのリファクタリングを可能にする。

作業:
- 既存の主要複合操作の「入力 state -> コマンド列 -> 結果」を固定するテストを追加する。
- `review.` テストはレビュー担当専有のまま維持する。
- M6候補が触る操作を優先してテストする。

対象:
- cast from hand
- cast to stack
- commander tax
- tap for mana
- cycling
- fetch
- proliferate
- create token
- resolve stack
- move token out of battlefield

受け入れ:
- `npm run lint`
- `npx tsc --noEmit`
- `npx vitest run`
- `npm run build`

### R1: batch適用の公開化

目的: store private の `applySequence` を再利用可能にする。

提案:
- `src/engine/batch.ts` を追加する。

```ts
export interface CommandBatch {
  commands: GameCommand[];
  label?: string;
}

export function applyCommands(state: GameState, commands: readonly GameCommand[]): ApplyResult;
export function applyCommandBatch(state: GameState, batch: CommandBatch): ApplyResult;
```

方針:
- 既存 `applyCommand` の挙動は変更しない。
- `applyCommands` は単に順番に `applyCommand` を適用し、warningsを連結する。
- 乱数生成は行わない。
- 失敗時のロールバックは「例外が投げられれば呼び出し側が commit しない」でよい。

効果:
- store、M6候補アクション、テストが同じ batch 適用を使える。
- 「単一undoで戻る」要件を store の commit 単位として扱いやすくなる。

### R2: カード本文解析の集約

目的: M6分類器と既存ヒューリスティックの重複を止める。

移行対象:
- `src/engine/status.ts` の `cardTexts` / `splitRulesText`
- `src/engine/status.ts` の `fetchAbility`
- `src/engine/status.ts` の `landEntersTapped`
- `src/engine/status.ts` の `cyclingCost`
- `src/store/gameStore.ts` の `manaProductionAmount`

移行先:
- `src/data/cardText.ts`
- `src/data/staticCardAnalysis.ts`
- M6実装後は `src/data/ruleTextClassifier.ts` と共有できる正規化テーブル

互換方針:
- 既存 import を急に壊さないため、`engine/status.ts` から当面 re-export してもよい。
- 最終的には `status.ts` から Oracle text 正規表現を減らす。

注意:
- `hasVigilance` / `isSummoningSick` は盤面状態も見るので engine 側に残してよい。
- ただしキーワード検出自体は `CardDef.keywords` と分類器側に寄せる。

### R3: 既存複合操作の command builder 化

目的: M6候補アクションから既存操作を安全に再利用する。

優先順:
1. `tapForMana`
2. `castFromHand` / `castCommander` / `castToStack`
3. `cycle`
4. `fetchLand` / `activateFetch` / `resolveFetch`
5. `proliferateAll`
6. `declareAttack`
7. `tapAllPermanents`

例:
- `buildTapForManaCommands`
- `buildCastCommands`
- `buildCycleCommands`
- `buildFetchCommands`
- `buildProliferateCommands`
- `buildDeclareAttackCommands`

store側は次の形へ寄せる。

```ts
const plan = buildCastFromHandCommands(cur, cardId, opts);
if (plan.status !== 'ready') return plan.status;
commit(applyCommands(cur, plan.commands));
```

効果:
- storeの分岐が減る。
- UI、右クリックメニュー、M6候補パネルが同じ操作計画を使える。
- 単一undoの境界を統一できる。

### R4: commands.ts の内部モジュール分割

目的: reducerを読みやすくし、M6でプリミティブを追加しても見通しを保つ。

公開APIは維持:
- `src/engine/commands.ts` から `GameCommand` / `ApplyResult` / `EngineError` / `applyCommand` を引き続き export する。

内部候補:
- `src/engine/commands/types.ts`
- `src/engine/commands/draft.ts`
- `src/engine/commands/move.ts`
- `src/engine/commands/mana.ts`
- `src/engine/commands/turn.ts`
- `src/engine/commands/stack.ts`
- `src/engine/commands/token.ts`
- `src/engine/commands/reducer.ts`

方針:
- まず関数移動だけ。挙動変更しない。
- `GameCommand` union は一箇所に残す。
- switch分割は急がない。ハンドラテーブル化は型安全性が落ちるなら不要。

### R5: M6.1の分類レポート接続

目的: engine に触らず、分類器とデッキ別レポートを導入する。

作業:
- `CardDef.edhrecRank` / `keywords` を Scryfall mapping に追加。
- `classifyCardRules(def)` を追加。
- `summarizeDeckRuleTags(entries)` を追加。
- import画面に `RuleAutomationReport` を表示。

engine側変更:
- 原則なし。

理由:
- M6.1は盤面変更なし。
- ここでengineを触ると分類と実行の境界が曖昧になる。

### R6: M6.2候補アクション

目的: Risk A/B の安全な操作候補を、既存プリミティブへ接続する。

候補:
- draw
- scry / surveil / mill
- Treasure / Food / Clue / Blood
- discard
- proliferate
- search / shuffle
- sacrifice / exile
- add/remove counters

実装方針:
- `RuleTag` から直接 `applyCommand` しない。
- `RuleTag -> action candidate -> user params -> command builder -> applyCommands` の順にする。
- 対象・数量・移動先はユーザーに確定させる。
- 置換/継続/対象適正は warning/advisory に留める。

### R7: M6.3誘発候補キュー

目的: ETB、死亡、唱えた時、攻撃、landfall等を「候補」として出す。

提案:
- 最初は `ApplyResult` を変更せず、UI/store側で直近操作後の差分から候補を作る。
- 十分に必要になったら、契約変更として `ApplyResult.events?: GameEvent[]` を検討する。

候補イベント:

```ts
type GameEvent =
  | { type: 'enteredBattlefield'; cardId: string; from: ZoneId }
  | { type: 'leftBattlefield'; cardId: string; to: ZoneId }
  | { type: 'spellCast'; cardId: string; from: ZoneId }
  | { type: 'cardDrawn'; cardId: string }
  | { type: 'landPlayed'; cardId: string };
```

注意:
- `events` を入れる場合は `docs/engine-spec.md` の契約変更が必要。
- 自動で stack に積まない。
- 候補を無視できる。
- ユーザー選択時だけ `addAbilityToStack` を使う。

## 5. M6分析との対応

EDH優先の上位候補を、どのレイヤーで受けるか。

| M6候補 | 受け皿 | engine変更 |
|---|---|---|
| Mana / mana abilities | `autotap` + `buildTapForManaCommands` + static analysis | 既存維持。本文解析はdataへ |
| ETB | rule candidate queue | M6.3まで不要 |
| Cast | `buildCastCommands` | 既存cast系コマンド維持 |
| Draw | 既存 `draw` command | 不要 |
| Create token | 既存 `createToken` command + token presets | presetはdata/UI側 |
| Sacrifice | `moveCard` to graveyard候補 | 専用commandは急がない |
| Exile | `moveCard` to exile候補 | 不要 |
| Search / Shuffle | library chooser + `moveCard` + `shuffle` batch | builder化が必要 |
| Card counters | 既存 `addCounters` | 不要 |
| Scry / Surveil | `arrangeTop` 拡張候補 | 必要ならbuilder追加 |
| Mill | 既存 `mill` | 不要 |
| Proliferate | 既存 store実装をbuilder化 | engine command追加は不要 |
| Equip / Attach | 既存 `attach` | 対象適正は助言のみ |
| Replacement / continuous | advisory | engine変更しない |

## 6. やらないこと

このリファクタリングでは以下をしない。

- `GameState` の大幅な再設計
- `GameCommand` の破壊的リネーム
- undo/redo方式の変更
- stack自動解決
- 誘発の自動stack投入
- 対象適正の厳密判定
- 置換効果/継続効果/レイヤーの自動適用
- 公式CR全文を実行可能ルール化すること
- UI文言や画面構造の大規模変更

## 7. 受け入れ基準

各リファクタリング単位の受け入れ基準。

- 公開契約を変える場合は、先に `docs/engine-spec.md` を更新する。
- 既存テストに加え、レビュー担当が対象操作の敵対的テストを追加する。
- `review.` を含むテストは実装担当が変更しない。
- `npm run lint` が通る。
- `npx tsc --noEmit` が通る。
- `npx vitest run` が通る。
- `npm run build` が通る。
- snapshot互換を壊さない。
- `applyCommand` は決定的なまま。
- 乱数は引き続きコマンド生成時に確定する。
- 複合操作は1回の undo で戻る。
- 分類・候補表示だけでは `GameState` を変更しない。

## 8. 実装担当への渡し方

メインセッションは仕様・監査・レビューに専念する。実装担当へ渡す単位は小さく分ける。

### H1: batch helper抽出

対象:
- `src/engine/batch.ts`
- `src/store/gameStore.ts`
- batch用テスト

禁止:
- `GameCommand` の変更
- `applyCommand` の挙動変更
- UI変更

受け入れ:
- 既存 `applySequence` と同じ結果になる。
- storeの複合操作の挙動が変わらない。

### H2: カード本文解析のdata移動

対象:
- `src/data/cardText.ts`
- `src/data/staticCardAnalysis.ts`
- `src/engine/status.ts`
- `src/store/gameStore.ts`

禁止:
- M6分類タグの本実装を混ぜること
- engineからIndexedDB/localStorageへ依存すること

受け入れ:
- `fetchAbility` / `cyclingCost` / `landEntersTapped` / `manaProductionAmount` の既存挙動が変わらない。
- 旧 import 互換が必要なら re-export で維持する。

### H3: command builder化

対象:
- `src/engine/commandBuilders/*`
- `src/store/gameStore.ts`
- builder用テスト

禁止:
- UI変更
- M6候補UIの追加
- 既存操作名の削除

受け入れ:
- `castFromHand`、`castToStack`、`cycle`、`fetch`、`proliferate` が既存通り動く。
- command builder は純粋関数で、実行しない。

### H4: commands.ts内部分割

対象:
- `src/engine/commands.ts`
- `src/engine/commands/*`

禁止:
- 公開 import path の破壊
- `GameCommand` union の挙動変更

受け入れ:
- public API は `src/engine/commands.ts` のまま。
- 既存テストがすべて通る。

## 9. 推奨順序

最短でM6へ進むなら次の順序。

1. M6.1を先に実装する。engine変更なし。
2. R1 batch helperを抽出する。
3. R2 カード本文解析をdataへ寄せる。
4. R3 command builder化を、M6.2で使う操作から順に行う。
5. M6.2候補アクションを追加する。
6. 必要になった時点でR4 commands.ts分割を行う。
7. M6.3で誘発候補キューを検討する。

大きな理由は、M6.1の価値は分類と可視化にあり、既存エンジン変更を必要としないため。逆にM6.2以降は候補アクションがstoreへ流れ込みやすいため、先に command builder と batch 適用を整えてから進めるべき。
