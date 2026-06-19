# M6 ルール補助実装提言

目的: EDHでよく使われるカード本文を、完全ルールエンジンではなく「分類、候補提示、警告、ユーザー確定の一括操作」として段階的に実装する。

参照:
- `docs/mtg-rule-terms.md`
- `docs/rule-automation-plan.md`
- `docs/engine-refactoring-plan.md`
- `research/scryfall-rules/2026-06-19/analysis/m5-edh-priority-analysis.md`
- `research/scryfall-rules/2026-06-19/analysis/m5-edh-priority-analysis.json`

## 1. 方針

M6の実装順は EDH頻度(`edhrec_rank`)を主軸にする。A-Eリスクは優先度の減点ではなく、実装レイヤーを決めるために使う。

| Risk | Layer | 方針 |
|---|---|---|
| A | primitive | 既存コマンドへ候補として接続。実行はユーザー確定 |
| B | semi-automatic | 対象/移動先/数量をユーザーが確定してから単一undoで実行 |
| C | trigger-assist | 自動でstackに積まない。イベント後に誘発候補として表示 |
| D | warning | 追加/代替コスト、タイミング、ward等の警告 |
| E | advisory | 対象適正、置換、継続効果、レイヤー等。盤面変更しない |

M6で守ること:
- `src/engine/` にカード本文解釈を入れない。分類器は `src/data/` の純粋関数にする。
- 分類・候補表示だけでは `GameState` を変更しない。
- 実行系は既存コマンド/既存store操作の合成を使い、undo単位を明確にする。
- 自動で誘発をstackに積まない。ユーザーが候補を選んだ場合だけ `addAbilityToStack` を使う。
- 対象適正、置換効果、継続効果、APNAP、優先権、レイヤー計算は実装しない。

## 2. EDH優先順位からの採用候補

EDH上位の出現が多いが、そのまま自動化すべきでないものもある。採用順は「EDHでよく使う」かつ「サンドボックス哲学に沿って安全に出せる」ものを優先する。

| 実装順 | 候補 | Risk | 理由 |
|---:|---|---|---|
| 1 | ルール分類器 + デッキ別候補レポート | - | 全M6の基盤。盤面変更なしで安全 |
| 2 | ETB / enters trigger | C | EDH上位3000で471。誘発候補として価値が高い |
| 3 | Mana / mana abilities | A | EDH上位3000で762。既存マナ操作と接続しやすい |
| 4 | CR 701 Cast | B | EDH上位3000で571。ゾーン外キャスト/代替コストの警告に必要 |
| 5 | Draw cards | A | EDH上位3000で448。既存 `draw` 候補化が容易 |
| 6 | Create token / Treasure等 | A/B | EDH頻度が高く、既存トークン導線を拡張しやすい |
| 7 | Sacrifice / Exile / Card counters | B | 対象選択後に単一undoで処理できる |
| 8 | Search / Shuffle | A/B | fetch/ramp/tutorで頻出。検索条件はユーザー確定 |
| 9 | Cast/copy, death/leave, attack, landfall triggers | C | 既存stack/能力オブジェクトと相性がよい |
| 10 | Equip / Cycling / Scry / Mill / Proliferate | A/B | 既存操作の候補化で効果が出る |

上位でもM6では助言止まり:
- Target-dependent text: 対象適正は相手盤面と継続/置換効果に依存する。
- Continuous effects / layers: レイヤー計算を始めると完全ルールエンジン化する。
- Replacement / prevention effects: `would` / `instead` / `prevent` は自動適用しない。
- Cost / payment modifiers: cost reduction、additional cost、alternative costは警告・選択UIに留める。

## 3. M6.1: 分類器とデッキ別候補レポート

最初に実装すべき単位。盤面を変更しないためリスクが低く、以後の候補表示の土台になる。

### 3.1 Scryfallデータ拡張

`CardDef` に任意フィールドを追加する。

```ts
edhrecRank?: number;
keywords?: string[];
```

Scryfall API mapping:
- `edhrec_rank` → `edhrecRank`
- `keywords` → `keywords`

要件:
- 旧IndexedDBキャッシュにこの2フィールドが無くてもクラッシュしない。
- Japanese print合成後も、英語版から得た `edhrecRank` / `keywords` を保持する。
- エンジンの `GameState` 不変条件は増やさない。

### 3.2 分類器

新規候補:
- `src/data/ruleTextClassifier.ts`
- `src/data/rulePriority.ts`

型:

```ts
export type RuleRisk = 'A' | 'B' | 'C' | 'D' | 'E';

export type RuleAutomationLayer =
  | 'primitive'
  | 'semi-automatic'
  | 'trigger-assist'
  | 'warning'
  | 'advisory';

export type RuleTagKind =
  | 'game-concept'
  | 'effect-kind'
  | 'keyword-action'
  | 'keyword-ability'
  | 'ability-word'
  | 'resource-token'
  | 'oracle-phrase';

export interface RuleTag {
  id: string;
  label: string;
  kind: RuleTagKind;
  risk: RuleRisk;
  layer: RuleAutomationLayer;
  source: 'oracleText' | 'printedText' | 'keyword' | 'typeLine' | 'scryfallField';
  confidence: 'high' | 'medium' | 'low';
  ruleRef?: string;
  matchedText?: string;
}

export function classifyCardRules(def: CardDef): RuleTag[];
```

必須タグ:
- `cr.concept.mana`
- `cr.concept.zone`
- `cr.concept.target`
- `cr.cost.payment`
- `cr.effect.continuous`
- `cr.effect.replacement`
- `cr701.cast`
- `cr701.create`
- `cr701.sacrifice`
- `cr701.exile`
- `cr701.shuffle`
- `cr701.search`
- `cr701.destroy`
- `cr701.discard`
- `cr701.counter`
- `cr701.scry`
- `cr701.surveil`
- `cr701.mill`
- `cr701.investigate`
- `cr701.proliferate`
- `oracle.trigger.etb`
- `oracle.trigger.cast-copy`
- `oracle.trigger.death-leave`
- `oracle.trigger.attack`
- `oracle.trigger.phase`
- `oracle.trigger.landfall`
- `oracle.action.draw`
- `oracle.action.create-token`
- `oracle.action.card-counters`
- `scryfall.resource-token.treasure`
- `scryfall.resource-token.food`
- `scryfall.resource-token.clue`
- `scryfall.resource-token.blood`
- `scryfall.keyword-ability.equip`
- `scryfall.keyword-ability.cycling`

重要な分類ルール:
- `counter target spell/ability` は `cr701.counter`。
- `+1/+1 counter` 等は `oracle.action.card-counters`。
- `play` は土地プレイと呪文キャストに分け、曖昧なら `warning` 以上にしない。
- `Scry` / `Mill` / `Surveil` / `Proliferate` はA層扱い。
- `Flying` / `Trample` / `Flash` などの常在寄りキーワード能力は原則E層。既存で使う速攻/警戒などは別途UI補助に使う。

### 3.3 デッキ別候補レポート

インポート完了後、`DeckStats` の近くに「ルール補助候補」を表示する。

候補コンポーネント:
- `src/components/RuleAutomationReport.tsx`
- `src/data/ruleDeckSummary.ts`

表示要件:
- `data-testid="rule-automation-report"` を付ける。
- 上位候補をA-E別または実装キュー順に表示する。
- 各行に `data-testid="rule-tag-<tagId>"` を付ける。`.` は `-` に正規化してよい。
- 行には「デッキ内枚数」「Risk」「Layer」「代表カード」を出す。
- E層は「助言のみ」と明示する。
- 表示だけでは `GameState` を作成/変更しない。

最小表示例:
- `ETB誘発: 18枚 / C / trigger-assist`
- `ドロー: 9枚 / A / primitive`
- `トークン生成: 7枚 / B / semi-automatic`
- `対象依存: 22枚 / E / 助言のみ`

## 4. M6.2: 安全な候補アクション

M6.1後に実装する。分類タグから右クリックメニューや候補パネルに操作候補を出す。

対象:
- draw
- scry / surveil
- mill
- shuffle
- Treasure / Food / Clue / Bloodプリセット
- discard
- proliferate

要件:
- 候補表示だけでは `GameState` を変更しない。
- 実行はユーザー確定後。
- 既存store操作を使う。
- undo 1回で戻る。

## 5. M6.3: 誘発候補キュー

対象:
- ETB
- upkeep / end step
- cast / copy trigger
- dies / leaves battlefield
- attack trigger
- landfall

要件:
- イベント後に候補を表示するだけで、自動でstackへ積まない。
- ユーザー選択時のみ `addAbilityToStack(sourceId, 'triggered')` を使う。
- 候補を無視できる。
- `resolveAll` の既存挙動を壊さない。

## 6. M6.4: 半自動アクション

対象:
- create token
- sacrifice
- exile
- destroy
- card counters
- search
- return from graveyard / exile
- equip / attach
- cycling拡張

要件:
- 対象、数量、移動先、公開有無などはユーザーが確定する。
- 破壊不能、ward、置換効果等は警告のみ。
- 可能な限り単一undo。
- エンジンにカード固有ルールを追加しない。

## 7. 実装しない範囲

M6では以下を実装しない。
- 対象適正の厳密判定
- 継続効果のレイヤー計算
- 置換効果/軽減効果の自動適用
- APNAP順、優先権、自動スタック解決
- 相手盤面を前提にしたルール強制
- 無限ループ検出
- 公式CR全文を実行可能ルールとして組み込むこと

## 8. 実装担当への最初の指示単位

最初に Codex CLI へ渡すべき単位は M6.1 のみ。

対象ファイル候補:
- `src/types/card.ts`
- `src/data/scryfall.ts`
- `src/data/cache.ts`(必要なら旧キャッシュ正規化のみ)
- `src/data/ruleTextClassifier.ts`
- `src/data/rulePriority.ts`
- `src/data/ruleDeckSummary.ts`
- `src/components/RuleAutomationReport.tsx`
- `src/components/ImportScreen.tsx`
- `src/App.css`
- M6.1用テスト。`review.` を含むテストは変更禁止

必須受け入れ:
- `CardDef.edhrecRank` / `keywords` が保存される。
- 旧キャッシュカードでも分類器がクラッシュしない。
- `classifyCardRules` は決定的で `GameState` に依存しない。
- `counter` の打ち消しとカード上カウンターを分離する。
- インポート後に `rule-automation-report` が表示される。
- レポート表示だけではゲーム開始前/開始後の盤面を変更しない。
- `npm run lint` / `npx tsc --noEmit` / `npx vitest run` / `npm run build` が通る。

レビュー担当が追加すべき敵対的テスト:
- 旧 `CardDef` 互換。
- `Counterspell` は `cr701.counter`、`Hardened Scales` は `oracle.action.card-counters` / `cr.effect.replacement` で、打ち消しに誤分類しない。
- `Rhystic Study` は cast trigger / draw / cost-payment系の警告候補を返すが、盤面変更しない。
- `Swords to Plowshares` は target / exile を返すが、対象適正を判定しない。
- `Smothering Tithe` は Treasure / trigger / replacement-adjacent warning を候補化するが、自動生成しない。
