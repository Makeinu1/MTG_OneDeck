# エンジン状態オントロジー (ESO)

> M0 モデリング・サイクルの生きた成果物①。正本手法 = [`engine-design-method.md`](engine-design-method.md) §1、
> アーキ = [`architecture-substrate-compiler.md`](architecture-substrate-compiler.md)、契約 = [`engine-spec.md`](engine-spec.md) §34。
>
> 本文書は **コードではない**。「MTG を再現するためにエンジンが持つべき変数の最小十分集合」を
> CR(上から)とコーパス需要(下から)の二面分析で収束させるための台帳である。
> M0 が churn 閾値・頭被覆を満たした時点で、確定エントリを engine-spec §34 へ凍結する。

## 文書規約(列定義 — method §1 準拠)

各エントリは次の列を持つ:

| 列 | 意味 |
|---|---|
| 変数/概念 | オブジェクト特性・ゾーン・ゲーム/プレイヤー変数・イベント語彙・層・juncture・SBA条件 等 |
| CR根拠(上から) | どの総合ルールが要求するか(CR条番号) |
| コーパス需要(下から) | 何枚のカードが実際に要求するか(頻度・代表カード)。**`layer-coverage` 抽出で埋める** |
| state read/write | エンジンのどの状態を読む/書くか(将来の compiler 着地先) |
| 検証手段(物差し) | この正しさをどの oracle で確かめるか(method §3) |
| trust | `検証済 / 不一致 / 検証不能`(初期は多くが未確定) |
| 既知欠落 | 意図的に落とす相互作用(誤謬予算の在処) |

trust は本スライス時点では原則 `未検証`(物差し未適用)。下面抽出(コーパス需要)→ ゴールド採点 →
LLM-oracle 盲予測の順に物差しを当てて更新する。

---

## スライス1: 有効特性 + 層オントロジー (CR611 / CR613 / CR604.3)

### 設計の核(印刷特性 vs 有効特性)

MTG の特性は「印刷値(actual)」をそのまま読んではならない。盤面のオブジェクトの**有効特性**は、
印刷値を基点に**継続効果を層システム(CR613)でタイムスタンプ順に適用した結果**である(CR110.3 /
CR613.5)。キーワード保有判定・P/T・型・色・SBA・キャスト適法性は**すべて有効特性で判定する**。

将来の runtime ではこれを `computeEffectiveCharacteristics(state, objId)`(`src/engine/layers.ts`、
S-LAYERS で実装)が一手に引き受ける(契約 = engine-spec §34.1 C-B)。本スライスは**そのために
どの層・どの read/write をエンジン state が持つ必要があるか**を、CR とコーパス分布から確定する。
**本スライスでは runtime コードを書かない**(S-LAYERS は M-CONTRACT 凍結後)。

### ESO エントリ

#### E-CHAR-1: printedCharacteristics(印刷特性 / actual)
- **CR根拠**: 109.3(特性の定義)、110.3(パーマネントの特性 = 印刷値 as modified by 継続効果)
- **コーパス需要**: 全カード(基点)。TBD(`layer-coverage` 抽出待ち)
- **state read/write**: read = `CardDef.faces[*]`(name/typeLine/oracleText/power/toughness/manaCost)。層適用の**基点**であり書き換えない
- **検証手段**: Scryfall snapshot(英語 oracle 正本)
- **trust**: 検証済(印刷値は既存 `CardDef` で保持済)
- **既知欠落**: コピー/裏向きで基点が差し替わるケース(L1)は本スライスで概念登録のみ

#### E-CHAR-2: effectiveCharacteristics(有効特性 / 層適用後)
- **CR根拠**: 613.1(7層の起点 = actual)、613.3(層2-6 は CDA 先、その後タイムスタンプ順)、613.5(自動・即時)
- **コーパス需要**: TBD(全継続効果カードが寄与。`layer-coverage` 抽出待ち)
- **state read/write**: write = 派生値(エンジンが各 objId について算出する有効 P/T・型・色・キーワード集合・コントローラ)。**正本 = 将来の `computeEffectiveCharacteristics(state, objId)`**。現状 `src/data/status.ts` の `effectivePower`/`effectiveKeywords` は移行対象(parity 確認まで併存)
- **検証手段**: ゴールド(`review.layer-coverage`)+ コーパス頻度 + 将来 Forge 差分
- **trust**: 未検証(runtime 未実装)
- **既知欠落**: 層依存(CR613.8)・置換相互作用(CR616)は §34.5 の初期非対応

#### E-LAYER-*: 継続効果の層(CR613.1 の7層 + サブ層)
各層は「どの有効特性を書き換える継続効果か」を表す state 軸。本スライスのコーパス需要は
`layer-coverage` 抽出が層別に頻度・代表カードを埋める。

> **コーパス需要は `layer-coverage` 抽出(2026-06-23, 17,491枚)で確定**(`research/layer-coverage/report.{md,json}`)。
> 分類済み継続効果行 = 5,318。**頭は L6(50.2%)と L7c(48.6%)が圧倒**、L3/L7d は希少(CR の直感と整合)。

| ID | 層 | CR根拠 | write(有効特性) | 代表(snapshot確認済) | コーパス需要(枚) |
|---|---|---|---|---|---|
| E-LAYER-L1a | L1a コピー可能(コピー) | 613.2a | 基点そのもの | 《Mirage Mirror》 | 60 |
| E-LAYER-L1b | L1b 裏向き | 613.2b | 基点(2/2無名等) | 《Necropotence》 | 62 |
| E-LAYER-L2 | L2 コントロール変更 | 613.1b | controller | 《Hellkite Tyrant》《Homeward Path》 | 281 |
| E-LAYER-L3 | L3 テキスト変更 | 613.1c / 612 | rules text | 《Mind Bend》《Magical Hack》 | 4(希少) |
| E-LAYER-L4 | L4 型変更(型/サブ/スーパー) | 613.1d | cardTypes / subtypes / supertypes | 《Urborg, Tomb of Yawgmoth》《Phyrexian Metamorph》 | 506 |
| E-LAYER-L5 | L5 色変更 | 613.1e | colors | 《Kenrith's Transformation》《Song of the Dryads》 | 64 |
| E-LAYER-L6 | L6 能力付与/除去・can't have・キーワードカウンター | 613.1f | abilities / keyword set | 《Swiftfoot Boots》《Lightning Greaves》 | **2,574(頭)** |
| E-LAYER-L7a | L7a CDA 定義 P/T | 613.4a | power / toughness | 《Tarmogoyf》《Adeline, Resplendent Cathar》 | 124 |
| E-LAYER-L7b | L7b base P/T 設定 | 613.4b | power / toughness | 《Darksteel Mutation》《Lignify》 | 147 |
| E-LAYER-L7c | L7c P/T 修整(get +N/+N・+1/+1カウンター) | 613.4c | power / toughness | 《Skullclamp》《Craterhoof Behemoth》 | **2,506(頭)** |
| E-LAYER-L7d | L7d P/T 入替 | 613.4d | power / toughness | 《Twisted Image》 | 10(希少) |

- **検証手段(全層共通)**: `review.layer-coverage` ゴールド(14件pass) + コーパス頻度。trust: 未検証(runtime 未実装)
- **既知欠落(全層共通)**: 層内依存関係の解決順(CR613.8)・置換効果(CR616)は初期非対応(§34.5)

#### E-CDA: 特性定義能力(Characteristic-Defining Ability)
- **CR根拠**: 604.3(色・サブタイプ・P/T を定義する静的能力。全領域で機能)、613.3 / 613.4a(層内で先に適用)
- **コーパス需要**: 128枚(`cda:true`。主に L7a 自己定義 P/T)
- **state read/write**: read = 動的条件(墓地のカードタイプ数 等)→ write = 該当層(L7a/L5/L4)
- **検証手段**: ゴールド(《Tarmogoyf》= L7a + CDA)+ コーパス
- **trust**: 未検証
- **既知欠落**: 全領域機能(手札/墓地での P/T 定義)は runtime では S-LAYERS 以降

---

## 抽出タクソノミ + 出力スキーマ(= `layer-coverage` の受け入れ条件)

> 本節は Codex 実装(`scripts/layer-coverage.ts` + `scripts/lib/layerClassify.ts`)の契約である。
> ゴールド `src/engine/__tests__/review.layer-coverage.test.ts` が本節の分類規則を採点する。

### 分類対象
**継続効果を作る能力行/節**を分類する。判定はオラクル文の**節の意味**で行い、能力 shape
(static/triggered/spell)に依存しない。`until end of turn` / `as long as` / 静的のいずれも対象。
**一回限りの行動**(damage/draw/destroy/exile/tap/counter-spell/create-token 等)は**対象外**。

### 層判定規則(英語 `oracleText` 正本・正規表現は実装側)
- **L2** ← `you control [enchanted/target] ...` / `gain control of` / `exchange control`
- **L3** ← `text ... becomes` / テキスト変更(CR612)
- **L4** ← `is/are/becomes a(n) ... [card type/subtype/supertype]`(land/creature/artifact/enchantment/
  基本でない土地が `Mountains` 等になる / `in addition to its other types`)
- **L5** ← `is/are/becomes [white|blue|black|red|green|colorless]`(明示的な色語)
- **L6** ← `have/has/gain(s) [keyword or "ability"]` / `lose(s) [all] abilities` / `can't have or gain` /
  `keyword counter`(能力の付与・除去・can't have)
- **L7a** ← P/T が特性で定義される(`power is equal to ...` / P/T ボックスが `*`)→ **`cda:true`** も立てる
- **L7b** ← `base power and toughness [is/are] X/Y` / `power and toughness ... equal to`(設定)
- **L7c** ← `gets +N/+N` / `gets -N/-N` / `+1/+1 counter` / `-1/-1 counter`(修整)
- **L7d** ← `switch ... power and toughness`(入替)
- **CDA**(`cda:true`)← 色/サブタイプ/P/T を定義する静的能力(CR604.3)。L7a・該当 L5/L4 と併記
- 1行が複数節を含む場合は**各節をそれぞれ分類**(《Darksteel Mutation》= L4+L6+L7b 等)

### 関数契約(純粋・決定的・GameState 非依存)
```ts
// scripts/lib/layerClassify.ts
export type LayerId =
  | 'L1a' | 'L1b' | 'L2' | 'L3' | 'L4' | 'L5'
  | 'L6'  | 'L7a' | 'L7b' | 'L7c' | 'L7d';

export interface LayerTag {
  layer: LayerId;
  cda: boolean;          // CR604.3 特性定義能力か
  reads: string[];       // 読む有効特性のファセット標識(例 'controller','power','count-graveyard')。report 用・自由記述可
  matchedText: string;   // 検出根拠の部分文字列
}

export interface CardLayerSummary {
  layers: LayerId[];     // 行を跨いだ和集合・重複なし・昇順(LayerId の辞書順)
  cda: boolean;          // いずれかの行で cda
}

// 1能力行を分類(既存 splitAbilityLines の AbilityLine を受ける)
export function classifyContinuousLayers(line: AbilityLine, def: CardDef): LayerTag[];

// カード単位の集約(faces 全行を splitAbilityLines → 分類 → 和集合)
export function classifyCardLayers(def: CardDef): CardLayerSummary;
```
- 既存 `src/engine/grammar`(`splitAbilityLines`)・`src/data/scryfall`(`mapScryfallCardToCardDef`)を再利用。
- 同入力 → 同出力。入力文字列を破壊しない。エンジン(`src/engine/`)は変更しない。

### 出力(`research/layer-coverage/report.{md,json}`)
- `report.json`: `{ totalCards, mappedCards, perLayer: { [LayerId]: { cardCount, lineCount, effectLineRate, examples: [{name, edhrecRank, matchedText}] } }, cdaCardCount, multiLayer: [{name, layers[]}], adjudication: [{name, line, reason}], cards: [{oracleId, name, layers: LayerId[], cda}] }`
  - `examples` は edhrec_rank 昇順上位 N(代表カード)
  - `multiLayer` = 2層以上を同時に書くカード一覧
  - `adjudication` = 継続効果らしいが未分類の行(人手裁定対象 = Fable が ESO「既知欠落/コーパス需要」へ反映)
  - **`cards`(iter2追加)= 全 mappedCards の per-card 層マップ**。連続反復間の **churn**(N→N+1 で層集合が変わったカード割合)を算出する土台。`oracleId` をキーに前版と突き合わせる
  - **`churn`(iter3追加)= `{ baselineCardCount, comparedCardCount, changedCount, rate, byLayer }`**。再抽出時に**既存 report.json の `cards` を前版ベースラインとして読み**、`oracleId` 一致カードの層集合(+cda)が変わった割合を算出。`byLayer` は層別の純増減
- `report.md`: 層別頻度・被覆曲線・代表例の人間可読サマリ

### iteration 2(2026-06-23)— ギャップ閉鎖
iter1 の adjudication から裁定した系統的ギャップ3つをカタログへ追補し再抽出する:
1. **L6 非キーワード能力付与**(引用された起動型: 「have "{T}: Add …"」)
2. **L4 条件付き否定型変更**(「isn't a creature」)
3. **L7c 乗算 P/T**(「double the power and toughness」)
- `report.json` に per-card 層マップ(`cards`、17,491件)を追加し、iter3 以降の churn 算出を可能にする。
- iter1→iter2 のデルタ(層別 cardCount 増分・adjudication 縮小)を Fable が監査で記録。
  churn の厳密値は per-card マップが2版そろう **iter3 から**算出(本反復は土台確立)。

#### iteration 2 結果(2026-06-23・監査合格)
ゴールド 19/19 + 機械チェック4点緑。per-card マップ 17,491件。

| 層 | iter1 | iter2 | Δ | 要因 |
|---|---:|---:|---:|---|
| L4 | 506 | 550 | +44 | 条件付き否定型変更(isn't a creature) |
| L6 | 2,574 | 2,921 | +347 | 引用された非キーワード能力の付与 |
| L7c | 2,506 | **4,391** | **+1,885** | 大半は**潜在バグ修正**(下記)。+ 乗算 P/T |
| adjudication | 1,396 | 988 | **−408** | ギャップ閉鎖が効いた |
| multiLayer | 1,244 | 1,708 | +464 | 主に L7c 修正の波及 |

- **重要な発見(ゴールドが炙り出した潜在バグ)**: iter1 の L7c カウンター正規表現 `\b[+-]…counter` は
  **空白に前置された「+1/+1 counter」を取りこぼしていた**(EDH で最頻の形)。Heliod ゴールドが露見させ修正。
  iter1 の L7c=2,506(14%)は過小で、iter2 の 4,391(25%)が正。**敵対的ゴールドが計測自体の誤りを検出した好例**
  (= method §4「物差し校正」の実地)。
- **収束シグナル**: adjudication 1,396→988(−29%)。残 988 の主因は「becomes a N/N creature」型 P/T 設定
  (L7b 取りこぼし)・プレイヤー継続効果・置換効果(CR616 範囲外)。次反復候補は前者。

### iteration 3(2026-06-23)— 残 L7b 閉鎖 + churn 初算出
1. **「becomes a N/N creature」(base 表記なし)を L7b(P/T設定)+ L4(型変更)へ**。マンランド/アニメート系
   149枚相当(Blinkmoth Nexus・Alloy Animist・Cyberdrive Awakener 等)。
2. **churn を初算出**(iter2→iter3)。per-card マップが2版そろうため、`oracleId` 一致カードの層集合変化率を
   `report.json.churn` に出力。これが M0 収束の本指標(method §4/§5。閾値 < 5% は凍結ゲート)。
- ゴールド 19→21(Alloy Animist=L4,L7b / Cyberdrive Awakener=L4,L6,L7b)。

#### iteration 3 結果(2026-06-23・監査合格)
ゴールド 21/21 + 機械チェック4点緑。

| 指標 | iter2 | iter3 | Δ |
|---|---:|---:|---:|
| L4 | 550 | 645 | +95 |
| L7b | 151 | 269 | +118 |
| adjudication | 988 | 912 | −76 |
| **churn(iter2→iter3)** | — | **0.68%(119/17,491)** | 初算出 |

- **churn 初値 0.68%**:変化は **L4(+95)/ L7b(+118)に限局**、他層は完全に 0。狙ったアニメート系のみが動き、
  巻き添えなし=**外科的に健全な反復**。
- **重要な留保(収束の誤読防止)**: この 0.68% は凍結閾値 5% を下回るが、**凍結シグナルではない**。
  本反復は意図的に1ギャップだけ変えたため churn が小さいのは当然。method §5 の凍結は
  **(churn<5% かつ 頭被覆≥90% かつ スライス1〜4を一巡)**を要し、現状は**スライス1のみ**。
- **収束の実シグナル**は adjudication の逓減(1,396→988→912、減り幅も 408→76 と縮小)。
  スライス1の層モデルは安定方向。残 912 はプレイヤー継続効果・置換効果(CR616 範囲外)・少数の長尾。
- **次の一手**: スライス2(イベント語彙)へ進むか、LLM-oracle 盲予測(別主体)で層分類に物差しを当てる。

---

## 収束メモ(本スライスの進捗)
- [x] 下面抽出(`layer-coverage`)実行 → 各 E-LAYER の「コーパス需要」を数値で確定(2026-06-23)
- [x] ゴールド `review.layer-coverage` 全件 pass(14/14)+ 機械チェック4点緑(Fable 独立採点)
- [x] `adjudication`(1,396件)の塊を Fable が裁定 → 下記「裁定・既知欠落」へ反映
- [x] 被覆の初期値を記録(下記)。**churn は次反復(N→N+1)で初めて算出**=本スライス単体では未確定
- [ ] LLM-oracle 盲予測(別主体)は次手で後続(相関エラー遮断)

### 抽出結果ベースライン(2026-06-23)
- 分類済み継続効果行 5,318 / mappingFailures 0。被覆(K=all)= **層保有カード 4,937枚(全体の 28.2%)**。
- 頭は L6(2,574)+ L7c(2,506)で層保有の大半。多層カード 1,244、CDA 128。
- **解釈**: 有効特性スライスの実装優先度は **L6(能力付与/除去)→ L7c(P/T修整)→ L4(型)** が頭。
  これは §34.2 の S-LAYERS 最小(層 7/6/4/5)と整合し、L3/L7d は希少で後回し可と裏取れた。

### 裁定・既知欠落(adjudication クラスタ = 系統的ギャップ)
`adjudication` は「継続効果らしいが層未付与」= 正直な検証不能/未分類バケット。Fable 裁定:
1. **能力(非キーワード/起動型)の付与** ← 「Lands you control have《{T}: Add》」「Creatures you control have …」等。
   現分類器は付与語の直後にキーワード語が要るため取り逃す。**L6 の真の拡張対象**(次反復でカタログ追補)。
2. **条件付き/否定の型変更** ← 「isn't a creature as long as devotion < 5」(Purphoros/Heliod)等 → **L4 ギャップ**。
3. **乗算系 P/T** ← 「double the power and toughness」(Unnatural Growth)= +N/+N 形でないため未付与 → **L7c ギャップ**。
4. **置換効果**(+1/+1カウンター倍化: Hardened Scales/Branching Evolution 等)= **CR616 で初期非対応**(§34.5)。
   層ではなく置換イベント。force-分類せず adjudication に置いたのは正しい(silent divergence を作らない)。
5. **プレイヤー継続効果**(「You have no maximum hand size」)= 特性層(CR613)ではなくプレイヤー変数 → 層対象外で正。
- **既知の過剰タグ(精度メモ)**: コピー効果(L1a)を型変更(L4)にも二重計上(《Mirage Mirror》= L1a+L4)。
  CR上コピーは L1 が正で L4 は近似。計測用途では許容、カタログ確定時に L1 優先で整理する。

### 次反復への引き継ぎ
- ①L6 の能力付与(非キーワード/起動型)②L4 条件付き型変更 をカタログへ追補し再抽出 → churn 算出。
- LLM-oracle 盲予測を**別主体**で起こし、本層分類に物差しを当てる(相関エラー遮断)。
