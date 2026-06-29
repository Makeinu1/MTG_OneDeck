# M6 ルール自動化計画

目的: EDH 一人回しで頻出するカード本文を、完全ルールエンジンではなく「安全な手動補助・警告・候補提示」として段階的に組み込む。

関連:
- `docs/mtg-rule-terms.md` — MTGルール用語の分類。分類器・優先度付けの正本。
- `docs/m5-rule-implementation-proposal.md` — M6で実装すべきルール補助の提言と実装担当への分割案。
- `research/scryfall-rules/2026-06-19/analysis/m5-edh-priority-analysis.md` — M6へ反映するEDH優先順位分析。
- `research/scryfall-rules/2026-06-19/analysis/cr-term-analysis.md` — 公式CR 701/702とScryfall本文を突き合わせた集計。
- `research/scryfall-rules/2026-06-19/analysis/rule-vocabulary-summary.md` — Scryfall `keywords` と頻出本文句の集計。

M-CR-RECONCILE note(2026-06-26): 上記 `m5-edh-priority-analysis` と `cr-term-analysis` は CR 2026-04-17 で生成された研究資産。最新の仕様判断・語彙境界は CR 2026-06-19 (`rule/Magic_The_Gathering_Comprehensive_Rules.metadata.json`) と `research/cr-grounding/golden-cases.json` を優先する。

前提:
- サンドボックス哲学を維持する。アプリは警告・候補提示・一括操作を提供するが、ユーザーの強行操作を妨げない。
- `src/engine/` は純粋関数のみ。カード本文分類は状態を書き換えず、実際の盤面変更は既存/追加コマンドを store から明示実行する。
- M6グローバル実装順はEDH 人気度(`edhrec_rank`)を主軸にする。実際にユーザーがインポートしたデッキ内カードは、デッキ別レポートで「このデッキに出る候補」を強調するために使う。

## 1. 調査結果

実行日: 2026-06-19

Scryfall 検索:
- Oracle単位の分類母集団: `game:paper date>=2021-06-19&unique=cards`
- 取得件数: 17,491 cards
- `edhrec_rank` あり: 17,380 cards
- Oracle text あり: 17,444 cards
- 印刷単位の参考母集団: `unique=prints` は 43,601 prints

API:
- `https://api.scryfall.com/cards/search?q=game%3Apaper%20date%3E%3D2021-06-19&unique=cards`
- `https://api.scryfall.com/bulk-data`

保存済みローカルデータ:
- `research/scryfall-rules/2026-06-19/manifest.json`
- `research/scryfall-rules/2026-06-19/raw/` — API応答そのもの。大容量のため git 管理外。
- `research/scryfall-rules/2026-06-19/analysis/m5-edh-priority-analysis.json`
- `research/scryfall-rules/2026-06-19/analysis/m5-edh-priority-analysis.md`
- `research/scryfall-rules/2026-06-19/analysis/cr-term-analysis.json`
- `research/scryfall-rules/2026-06-19/analysis/cr-term-analysis.md`
- `research/scryfall-rules/2026-06-19/analysis/rule-vocabulary-summary.json`
- `research/scryfall-rules/2026-06-19/analysis/rule-vocabulary-summary.md`

分類は3段階で扱う。
- CR用語分析: 公式CRのゲーム概念、701キーワード処理、702キーワード能力を正規語彙として使う。分類器の基準はこちらを優先する。
- Scryfall語彙分析: Scryfall `keywords` と Oracle text の本文句を使い、CRだけでは拾えない能力語・製品固有語・定型表現を補う。
- EDH重み付け: Scryfall `edhrec_rank` を主軸にする。現在インポート済みデッキは、グローバル実装順の上書きではなく、デッキ別候補レポートの強調に使う。

### EDH重み込みで目立つカテゴリ

| カテゴリ | 全体件数 | EDH上位1000 | EDH上位3000 | 推奨扱い |
|---|---:|---:|---:|---|
| 対象依存 | 6,775 | 213 | 785 | 助言止まり |
| ETB誘発 | 5,036 | 279 | 770 | 誘発候補 |
| マナ能力/産出 | 1,848 | 382 | 762 | 自動/半自動 |
| ドロー | 2,575 | 143 | 448 | 自動/半自動 |
| トークン生成 | 2,803 | 80 | 387 | 半自動 |
| 生け贄コスト/効果 | 2,263 | 110 | 351 | 半自動 |
| 置換/常在/継続効果 | 1,992 | 122 | 351 | 助言/警告 |
| カード上カウンター | 2,840 | 54 | 288 | 自動/半自動 |
| サーチ/シャッフル | 787 | 85 | 215 | 半自動 |
| アップキープ/終了ステップ誘発 | 1,195 | 30 | 201 | 誘発候補 |
| 唱えた時誘発 | 951 | 35 | 165 | 誘発候補 |
| コスト変更/追加コスト | 994 | 62 | 163 | 警告/助言 |
| 死亡/離場誘発 | 1,236 | 37 | 158 | 誘発候補 |
| 攻撃誘発 | 1,586 | 22 | 149 | 誘発候補 |
| 装備/付ける | 1,056 | 43 | 149 | 半自動 |
| コピー | 739 | 35 | 139 | 半自動 |
| 墓地/追放から戻す | 818 | 22 | 108 | 半自動 |
| 捨てる | 819 | 21 | 108 | 自動/半自動 |
| 墓地/追放/山札上からプレイ | 536 | 16 | 75 | 半自動 |
| 占術/諜報 | 497 | 29 | 60 | 自動/半自動 |
| 切削 | 369 | 11 | 52 | 自動/半自動 |
| サイクリング/魂力等 | 209 | 23 | 47 | 半自動 |
| 土地上陸系誘発 | 113 | 15 | 37 | 誘発候補 |
| プレイヤーカウンター | 236 | 1 | 29 | 自動/半自動 |

読み取り:
- 件数だけなら「対象依存」が最大だが、対象適正・相手盤面・置換効果が絡むため自動判定には不向き。
- EDH上位ではマナ能力、ETB、ドローが非常に強い。ここは既存機能と接続しやすい。
- トークン・カウンター・生け贄・サーチは件数もEDH重みも高いが、対象選択が必要なので「候補アクションを出してユーザーが確定」がよい。
- 置換/常在/継続効果は多いが、レイヤー処理へ踏み込むため、M6では警告/助言に留める。

### 公式CR用語からの結論

公式 Comprehensive Rules の構造上、アプリ実装に直結する語彙は次の順で扱う。

| 層 | CR | 分類での扱い | M6での扱い |
|---|---|---|---|
| ゲーム概念 | 100-123 | card/object/permanent/spell/ability/counter/mana等 | `GameState` とUI表示の基礎 |
| ゾーン | 400-408 | library/hand/battlefield/graveyard/stack/exile/command | 既存ゾーン移動コマンドへ接続 |
| 能力と効果 | 600-616 | activated/triggered/static/mana/loyalty, one-shot/continuous/replacement/prevention | one-shot以外は原則 warning/advisory |
| キーワード処理 | 701 | cast/create/sacrifice/exile/search/shuffle/destroy/discard等 | primitive/semi-automatic候補の中心 |
| キーワード能力 | 702 | flying/equip/cycling/flashback/ward/kicker等 | 能力ごとに warning/semi-automatic/trigger-assist へ分岐 |
| 統率者 | 903 | command zone, commander tax, commander damage | 既存EDH状態と警告/候補に接続 |

重要な注意:
- `counter` は CR 701.6 の「打ち消す」と CR 122 の「カウンター」を分離する。単語検索だけでは誤分類する。
- `play` は土地プレイと呪文キャストへ分岐する。M6では最初から別タグにする。
- 置換効果・継続効果・レイヤーは頻出だが、完全自動化の費用が高い。自動判定対象ではなく、警告/助言対象として分類する。

### MTGルール語ベースの分析

Scryfall の `keywords` は、単語検索より MTG の固有ルール語に近い。M6の分類器はまず `keywords` を使い、足りない部分を Oracle text の句解析で補う。

| ファミリー | 件数 | EDH上位1000 | EDH上位3000 | 実装方針 |
|---|---:|---:|---:|---|
| evergreen | 4,586 | 86 | 498 | 表示/警告。飛行等は原則自動解決しないが、警戒/速攻/防衛など一人回し補助に効くものは個別使用 |
| keyword-action | 1,570 | 58 | 195 | 既存プリミティブに接続。Scry/Surveil/Mill/Proliferate/Investigate/Explore等 |
| object-state | 1,491 | 40 | 157 | 装備/付ける/変身/搭乗/偽装等。UI操作候補として扱う |
| resource-token | 454 | 26 | 104 | 宝物/食物/手掛かり/血等。既存トークン導線を拡張 |
| cost-and-cast | 730 | 22 | 91 | コスト変更/代替コスト。自動適用せず warning/advisory から開始 |
| ability-word-condition | 485 | 30 | 82 | Landfall/Magecraft/Revolt等。誘発候補キューへ接続 |
| alternate-activation | 262 | 24 | 52 | Cycling/Channel等。サイクリング実装を拡張し、ユーザー確定で実行 |
| zone-recursion | 133 | 3 | 13 | Escape/Unearth/Disturb等。ゾーン横断候補として扱う |

上位キーワード例:
- Treasure: 324件、EDH上位3000に89件。宝物/手掛かり/食物/血のプリセットは高優先。
- Equip: 411件、EDH上位3000に75件。`attach` 操作のUI候補強化が有効。
- Mill: 398件、EDH上位3000に61件。既存 `mill` を本文候補から呼べるようにする。
- Cycling: 224件、EDH上位3000に43件。既存 `cycle` を typecycling/channel へ広げる価値がある。
- Landfall: 111件、EDH上位3000に37件。自動解決でなく誘発候補として十分価値がある。
- Proliferate: 82件、EDH上位3000に31件。既存 `proliferateAll` との接続が自然。

ルール句解析で特に重いもの:
- ETB/enters trigger: 5,036件、EDH上位3000に770件。
- target-dependent text: 6,775件、EDH上位3000に785件。ただし対象適正は自動化しない。
- draw cards: 2,575件、EDH上位3000に448件。
- create token: 2,961件、EDH上位3000に422件。
- search library + shuffle: search 653件/EDH上位3000に192件、shuffle 785件/214件。
- replacement/static: `would/instead` 829件、能力付与/anthem 781件。M6では助言止まり。

### M6反映済みEDH優先順位

`m5-edh-priority-analysis` では、保存済み17,491枚に対し、CR概念、CR 701、CR 702、Scryfall `keywords`、Oracle text補助分類をカード単位で正規タグ化した。優先順位は `edhrec_rank` を主軸にし、A-Eリスクは並び替えではなく実装方法の決定にだけ使う。

EDH上位で強いタグ:

| 順位 | タグ | Risk | Layer | EDH上位1000 | EDH上位3000 | 方針 |
|---:|---|---|---|---:|---:|---|
| 1 | Mana / mana abilities | A | primitive | 382 | 762 | 既存 `tapForMana` / `addMana` と分類レポートへ接続 |
| 2 | Zone movement / zone references | B | semi-automatic | 311 | 1,020 | ゾーン横断候補。ただし移動先/対象はユーザー確定 |
| 3 | Target-dependent text | E | advisory | 213 | 785 | 対象適正は自動判定せず助言/警告 |
| 4 | Cost / payment modifiers | D | warning | 132 | 349 | 追加/代替/軽減コストは自動適用せず警告 |
| 5 | CR 701 Cast | B | semi-automatic | 156 | 571 | 通常キャスト/ゾーン外キャスト/代替コストを分岐 |
| 6 | CR 701 Sacrifice | B | semi-automatic | 126 | 402 | 生け贄対象選択後に一括処理 |
| 7 | Draw cards | A | primitive | 143 | 448 | 既存 `draw` 候補 |
| 8 | CR 701 Shuffle | A | primitive | 87 | 226 | 既存/追加シャッフル候補 |
| 9 | Continuous effects / layers | E | advisory | 149 | 488 | レイヤー計算せず助言 |
| 10 | CR 701 Search | B | semi-automatic | 82 | 199 | 検索条件/公開/移動先をユーザー確定 |

実装キューは、EDH頻度が高く、既存アプリのサンドボックス哲学と接続しやすい順に切る。

| 優先 | 候補 | Risk | Layer | EDH上位3000 | 実装方針 |
|---:|---|---|---|---:|---|
| 1 | ETB / enters trigger | C | trigger-assist | 471 | 戦場に出た後、誘発候補を表示してユーザー選択でstackへ |
| 2 | Mana / mana abilities | A | primitive | 762 | マナ能力分類と既存マナ操作候補 |
| 3 | CR 701 Cast | B | semi-automatic | 571 | ゾーン外キャスト/代替コストを候補化 |
| 4 | Draw cards | A | primitive | 448 | 本文候補から `draw` を呼ぶ |
| 5 | Create token / CR 701 Create | B | semi-automatic | 431/432 | トークン生成ダイアログへ渡す |
| 6 | CR 701 Sacrifice | B | semi-automatic | 402 | 対象選択後に単一undoで処理 |
| 7 | CR 701 Exile | B | semi-automatic | 304 | 追放候補。戻る期限や追放元は警告 |
| 8 | Card counters | B | semi-automatic | 270 | +1/+1等。打ち消しとは別タグ |
| 9 | CR 701 Shuffle / Search | A/B | primitive / semi-automatic | 226/199 | fetch/ramp/tutor導線へ |
| 10 | Cast/copy, death/leave, attack triggers | C | trigger-assist | 167/159/149 | イベント後に誘発候補キュー |
| 11 | Treasure / Food / Clue / Blood | A | primitive | Treasure 89 | トークンプリセットを拡張 |
| 12 | Equip / Cycling / Scry / Mill / Proliferate | A/B | primitive / semi-automatic | 31-75 | 既存操作の本文候補化 |

## 2. 優先度モデル

優先度はカード本文カテゴリではなく、ユーザーのデッキ内で実際に役立つ操作候補を並べるためのスコアとして扱う。

入力:
- EDH popularity: Scryfall の `edhrec_rank`。低いほど高重み。M6グローバル実装順の主軸。
- Current deck: 現在インポート済みの `InitDeckCard[]`。グローバル順ではなく、デッキ別候補レポートの強調に使う。
- Recent local decks: localStorage / IndexedDB に保存済みの直近デッキ。ローカルのみで処理し、参考表示に使う。
- Global frequency: 直近5年カード本文のカテゴリ頻度。最後の補助信号。
- Automation safety: 自動実行しても盤面破壊リスクが低いか。優先順位を下げるためではなく、自動化レイヤーを決めるために使う。

推奨スコア:

```text
score =
  top100 * 1000
  + top101To500 * 250
  + top501To1000 * 100
  + top1001To3000 * 20
  + top3001To10000 * 2
  + rankWeight
```

`rankWeight = sum(1000 / (edhrec_rank + 999))`。

A-Eリスクは優先順位のペナルティではなく、表示/実行レイヤーとして使う。
- A: 既存プリミティブで決定的に処理できる。例: mana, draw, mill, shuffle。
- B: ユーザーの対象選択があれば安全。例: create token, sacrifice, search, exile。
- C: 誘発タイミング候補のみ。例: ETB, upkeep, attack, death, cast trigger。
- D: コスト/タイミング警告。例: kicker, overload, flashback, convoke, ward。
- E: 助言止まり。例: target legality, replacement effects, continuous effects, layers。

## 3. M6実装レイヤー

### M6.1 分類器 + Scryfallデータ拡張 + デッキ別レポート

M6.1 は次の3つを1マイルストーン単位として実装する(分類のみで盤面を変更しないため安全)。番号は提言doc(`docs/m5-rule-implementation-proposal.md`)と統一する。構成要素:
- 分類器(本節)
- Scryfallデータ拡張(下記「Scryfallデータ拡張」)
- デッキ別「自動化候補」レポート(下記「デッキ別『自動化候補』レポート」)

新規の純粋モジュール候補:
- `src/data/ruleTextClassifier.ts`
- `src/data/rulePriority.ts`

型(`docs/m5-rule-implementation-proposal.md` の正本と同一):

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

export interface RulePriorityInput {
  tagId: string;
  top100: number;
  top500: number;
  top1000: number;
  top3000: number;
  top10000: number;
  rankWeight: number;
  deckCount: number;
  recentDeckCount: number;
  globalCount: number;
  risk: RuleRisk;
}
```

`classifyCardRules(def)` は状態を読まない。`CardDef` だけから `RuleTag[]` を返す。

#### Scryfallデータ拡張(M6.1 構成要素)

`CardDef` に任意フィールドを追加する:

```ts
edhrecRank?: number;
keywords?: string[];
```

方針:
- Scryfall の `edhrec_rank` と `keywords` を保存する。
- 既存 IndexedDB キャッシュは後方互換。欠落時は `undefined` / `[]` として扱う。
- UI表示・分類優先度以外には使わない。エンジン状態の不変条件は増やさない。

#### デッキ別「自動化候補」レポート(M6.1 構成要素)

インポート完了後、デッキ統計の近くに「自動化候補」を出す。

表示例:
- `ETB誘発: 18枚`
- `トークン生成: 9枚`
- `サーチ/シャッフル: 7枚`
- `置換/常在効果: 6枚(助言のみ)`

目的:
- グローバル実装順はEDH優先のまま、現在デッキで出る候補を強調する。
- ルール補助がなぜ出ているかをカード本文に戻って確認できる。
- まだ自動化されていないカテゴリを「次に実装すべき候補」として可視化する。

### M6.2 安全なプリミティブへの接続

既存コマンドへ接続しやすい順:
1. draw / mill / discard
2. scry / surveil / look at top
3. counters / player counters
4. token presets + custom token
5. search / shuffle / fetch-like search
6. attach / equip
7. return from graveyard / exile

ルール本文を読んで即実行するのではなく、右クリックメニューや候補パネルに「実行候補」を出してユーザーが確定する。

### M6.3 誘発候補キュー

既存の stack / ability object を利用する。

検出イベント:
- battlefield entry: ETB
- phase/turn: upkeep, end step
- castToStack: cast trigger
- declareAttack: attack trigger, combat damage trigger candidate
- moveCard from battlefield: death/leave trigger
- playLand / moveCard land to battlefield: landfall

挙動:
- 自動で盤面変更しない。
- 画面上に「誘発候補」を出し、ユーザーが選ぶと `addAbilityToStack(sourceId, 'triggered')` を実行する。
- 既存の手動「誘発を積む」は残す。

## 4. 実装しない範囲

M6では以下を完全自動化しない。
- 対象適正の検証
- 優先権・誘発順・APNAP順の厳密処理
- 置換効果と継続効果のレイヤー計算
- 相手盤面を前提にした適正判定
- 自動スタック解決
- 無限ループ検出

これらは `advisory` / `warning` として表示し、LLMジャッジを使う場合も盤面は変更しない。

## 5. 推奨マイルストーン

### M6.1: 分類器と優先度

成果物:
- `CardDef.edhrecRank` / `keywords` の保存
- `classifyCardRules`
- `computeRulePriority`
- インポート画面の候補レポート

受け入れ:
- モックカードでカテゴリ分類が決定的。
- `docs/mtg-rule-terms.md` のA-Eリスク分類と CR 701/702分類に沿う。
- 旧キャッシュカードでもクラッシュしない。
- グローバル順はEDH優先を維持しつつ、現在デッキ内の該当枚数が表示される。

### M6.2: プリミティブ候補アクション

成果物:
- カードメニューに draw / mill / discard / counter / token / search 系の候補を追加。
- 実行はユーザー確定後のみ。
- undo 1回で戻る。

受け入れ:
- 候補表示だけでは GameState が変化しない。
- 実行時は既存コマンド/既存 store 操作を使う。

### M6.3: 誘発候補キュー

成果物:
- ETB / upkeep / cast / attack / death / landfall の候補を表示。
- 候補から stack に能力オブジェクトを積める。

受け入れ:
- 自動で能力を積まない設定を既定にする。
- 候補から積む操作は単一undoで戻る。
- `resolveAll` の既存挙動を壊さない。

### M6.4: ゾーン横断アクション

成果物:
- 墓地/追放から手札・戦場へ戻す候補。
- 山札上/墓地/追放から唱える補助。
- 追加コスト・代替コストは warning/advisory。

受け入れ:
- コスト変更を自動適用しない。
- 強行キャストの既存フローを維持する。

## 6. 実装担当への渡し方

メインセッションはこの計画をもとに、各M6を小さい実装単位へ分けて Codex CLI に渡す。

指示に必ず含める:
- 対象ファイル
- 変更禁止ファイル(`review.` テスト)
- 受け入れ条件
- 必須テスト: `npm run lint` / `npx tsc --noEmit` / `npx vitest run` / `npm run build`
- 「分類器は盤面を変更しない」
- 「候補実行は既存コマンド経由」

レビュー担当は実装報告を信用せず、独立した `review.` テストで分類ミス・旧キャッシュ互換・undo単位・GameState不変条件を確認する。

## 7. 再分析手順

次回以降はScryfall APIへ再アクセスせず、まず保存済みの `research/scryfall-rules/2026-06-19/raw/` を使う。

分析順:
1. 公式CR用語(`docs/mtg-rule-terms.md`)を基準に、CR 701/702のタグを付ける。
2. Scryfall `keywords` を keyword ability / keyword action / ability word / resource token へ分離する。
3. Oracle text の定型句で、ETB、死亡誘発、唱えた時誘発、置換効果、対象依存を補う。
4. `edhrec_rank` でM6グローバル優先順位を付ける。現在デッキ内カードはデッキ別レポートで交差させる。
5. A-Eリスク分類を付け、実装候補を primitive / semi-automatic / trigger-assist / warning / advisory に落とす。
