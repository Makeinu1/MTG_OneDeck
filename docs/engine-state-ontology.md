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

## 物差し: LLM-oracle 盲予測(M0-O1・スライス1の trust 校正)

> 契約 = [`oracle-harness.md`](oracle-harness.md)。method §3 の「独立した第2の物差し」を初稼働させ、
> 層分類(`layerClassify`)に **Fable と相関しない盲予測ルーラー**(Codex が clean-room 実行)を当てる。

- **盲予測の純度**: オラクルへ CR613・「層」を見せず、平易な**挙動ファクト**(controller/types/colors/abilities/
  base-PT/PT-modify/switch/CDA/copy)だけを尋ね、ファクト→層の写像は機械的・決定的に行う(相関遮断)。
- **trust 更新手順(監査後 Fable が各 E-LAYER に記入)**:
  - オラクルと分類器が**一致** → 当該層を `検証済`(弱い陽性だが第2物差しで裏取り)。
  - **割れ**(`discrepancies` に出現) → `不一致`。`deltaSignature` クラスタを帰属裁定(下記)。
  - オラクルが `uncertain` → `検証不能`(緑に混ぜない。`unverifiableRate` = silent divergence の上限)。
- **帰属(method §4-2)**: 各不一致クラスタを `{substrate誤り(層モデル) / compiler誤訳(分類器regex) / 物差し誤り(prompt/写像) / 曖昧}` へ。
  ゴールド21上の `goldCalibration`(層別 precision/recall)が低い層は**物差し誤り**を疑い prompt/写像を改訂する。
- **既知の写像近似**: コピー(L1a)に付随する型/色変化を分類器が L4/L5 に二重計上しうる(《Mirage Mirror》)。
  差分に出るが substrate 誤りではなく「物差し近似/曖昧」として裁定(自動正規化しない)。
### iter1 結果・裁定(2026-06-23・監査合格)
192枚層化サンプル(頭100/多層50/adjudication 30/ゴールド18・`unresolvedGold` 0)。`research/llm-oracle/report.{md,json}`。
機械チェック4点緑 + `review.oracle-harness` 13/13。**盲性確認**: `sample.json` に層ラベル非含、予測 rationale が「層/CR」に言及 0 件。

**KPI 初値**:
- **オラクル間不一致率 18.23%**(35/192)。**検証不能率 0.00%**(オラクルは一度も hedge せず=尾での過信兆候・method §76)。
- **物差し校正(ゴールド18・meta-KPI)= 全支持層で precision/recall 100%**(L2/L4/L5/L6/L7a/L7b/L7c)。
  → オラクルは検証済部分集合で信頼でき、**非ゴールドでの不一致は信号として credible**。

**クラスタ裁定(帰属。per-card attribution は本ログを正本とし `report.json` は機械出力=null のまま)**:
1. **`+L7a`(7枚)= 物差し誤り(系統的)**: Faeburrow Elder / All That Glitters / Banner of Kinship 等の
   「**gets +N/+N for each …**」は L7c(カウント由来の修整)。オラクルが `definesCharacteristicByCount`→L7a を
   誤発火(分類器は L7c で正)。検証不能率0%と整合(過信)。**→ prompt 改訂**: `definesCharacteristicByCount` は
   **印刷 P/T が `*`(基底自体がカウント)**の時のみ。「+N/+N for each」は `modifiesPTByAmount`。
2. **`+L1a`/`-L4` の copy 群(計~14枚)= substrate誤り(被覆漏れ)+ compiler誤訳(copy→L4 過剰)**: Spark Double /
   Phyrexian Metamorph / Sculpting Steel / Mirrormade / Helm of the Host / Mirage Mirror / Cursed Mirror /
   Mycosynth Gardens / Shifting Woodland。オラクルは copy(L1a)を正しく検出、分類器は L1a を「概念登録のみ」で
   取り逃し、かつ copy を **L4 に二重計上**(既知近似の顕在化)。**本ルーラー最大の発見。→ 次反復で L1a を実被覆へ昇格**。
3. **`-L1b`/`-L6`/`-L7c` 等の singleton = compiler誤訳(regex 過発火 FP)**: Necropotence→L1b(exile コストの
   「face down」を面伏せパーマネントと誤認)、Bitterblossom→L6(生成トークンの「flying」が既存物への付与に漏れた)、
   Marvin→L2、Inspiring Call→L7c(「+1/+1 counter」の言及)。**特に L1b 代表が Necropotence の誤タグ**=
   `layer-coverage` の L1b=62 はベースライン自体が疑わしく**再監査対象**。**→ 次反復で probe 厳格化**
   (トークン生成文の除外・"face down" はパーマネント限定・カウンター設置のみ L7c)。
4. **`+L4`(2枚)= compiler誤訳(FN)/ 周辺**: Enduring Vitality/Courage「dies → return as an enchantment」の
   型変更を取り逃し(遅延/条件付き型変更のモデル化要否は次反復で判断)。

**trust 更新(本ルーラー iter1 基準)**:
- **L5 / L7b / L7c**: `検証済`(ゴールド100% + 高 agreeBoth、ノイズ少)。
- **L2 / L4 / L6**: `検証済`(ゴールド100%)だが**既知 FP 源あり**(L4=copy 過剰計上 / L6=トークン文漏れ / L2=Marvin)。
- **L1a**: `不一致`(系統的・被覆漏れ。最優先 substrate 課題)。**L1b**: `不一致`(分類器 FP 疑い・ベースライン再監査)。
- **L7a**: `不一致`(オラクル物差し誤り起因。分類器 L7a=`*` 由来 CDA は妥当だが本反復では certify 不能)。
- **L3 / L7d**: `検証不能`(ゴールド母数0・サンプル該当0)。

**次の一手(本ルーラーが指し示す優先順)**: ①prompt 改訂(`definesCharacteristicByCount` の厳格化)で物差し誤りを除去 →
②L1a copy を実被覆へ昇格 + copy→L4 過剰計上を解消(分類器)→ ③regex FP(L1b/L6/L7c)の probe 厳格化 →
④再抽出して churn と不一致率の低下を確認。**これは分類器(compiler)修正を伴うため次反復(Codex)で実施**。

### iter4 裁定(2026-06-23・改善ループ)— 帰属確定 + 分類器修正
正本 = [`research/llm-oracle/adjudication.json`](../research/llm-oracle/adjudication.json)(Fable 裁定・oracleId キー)。
iter1 の暫定読みを per-card で確定し、**§7 一変数(物差し=LLM予測を凍結・ルール=分類器のみ改変)**で修正へ繋ぐ。

**帰属分布(§4-2 KPI 初確定・35件)**: `compiler 21 / oracle 9 / ambiguous 5 / substrate 0`。
- **substrate 0** = 層オントロジー自体は健全。誤りは抽出(compiler regex)と物差し(oracle prompt)に局在。スライス1の層モデルを支持。

**裁定の確定(iter1 からの精緻化)**:
1. **copy 群(`+L1a` 5 + `-L4` の copy 5)= compiler(被覆漏れではなく抽出バグ)**。iter1 は「substrate誤り(被覆漏れ)」としたが、L1a 層は正しく定義済で**分類器が `enters as a copy of`(動詞 is/are/becomes を伴わない)を取りこぼし**ていただけ=compiler。
2. **L4 過貪欲 = 単一 regex バグに収斂**。`layerClassify.ts:98-99` の `[A-Z][A-Za-z'-]+` 部分節が **`i` フラグで小文字語にも一致**し、`becomes a copy`・`is an additional combat phase` が L4 を誤発火(copy 5 + Karlach/Genji/Great Train Heist)。capitalized サブタイプを **case-sensitive 化**して解消。正の L4(`Elemental`・`in addition to its other types`)は維持。
3. **`+L7a`(7)= oracle(系統的物差し誤り)を確定**。`gets +N/+N for each` は修整=L7c であり CDA 定義=L7a でない(CR604.3/613.4c)。分類器は正。**§7 によりプロンプト改訂(物差し改変)は本反復では行わず**、次反復の oracle バッチへ繰り越し(§4-4 物差し校正の確定信号)。
4. **`-L7c`(3)= compiler FP**: 注釈文(Not Dead After All)・入れ子トークン引用(Urza's Saga)・条件参照「with a +1/+1 counter on it」(Inspiring Call)。
5. **`+L4`(2)= compiler FN**: Enduring 系「It's an enchantment.」の縮約 `It's` を型変更動詞として取りこぼし。
6. **ambiguous 5 = スコープ境界**: ワンショットのトークン複製(Helm/Caretaker)・カウンター移動/連動(Ozolith/Spymaster)・アニメート×count(Destiny Spinner)。継続層スコープ外として据え置き、カタログ「スコープ境界」へ明文化。
7. **未修整の既知ノイズ(2・compiler だが据え置き)**: Necropotence(L1b「exile face down」FP)・Bitterblossom(トークン「flying」L6 FP・発火経路未確定)。単発・regex 修正の回帰リスクを優先し本反復は触らない。

**修正範囲(本反復で分類器=ルールのみ動かす)**: P1 = copy 検出(L1a probe 拡張)+ L4 case-sensitive 化。P2 = L7c FP 除外・Enduring の `It's a <type>`・Marvin の L2 関係節・Thespian's の `has this ability`。
受け入れゴールド = [`review.layer-gold`](../src/engine/__tests__/review.layer-gold.test.ts)(P1 12 + 物差し誤りの**回帰ガード** 7=L7a を紛れ込ませない)。

**trust 更新(iter4 後の見込み・監査で確定)**:
- **L1a**: `不一致`→(分類器修正後)`検証済`見込み。被覆を 60→実コピー検出へ。
- **L4**: 既知 FP(copy 過剰)を解消。`検証済`(FP 源縮小)。
- **L7a**: `不一致`(**物差し誤り**起因に確定)。分類器側は正。trust は次反復の prompt 改訂後に再評価。
- **L7c**: FP 源(注釈/入れ子/条件参照)を縮小=ベースライン精度向上。
- **L1b**: `不一致`(Necropotence FP・ベースライン要再監査)継続。本反復は未修整。

**iter4 結果(2026-06-23・監査合格)**: 機械チェック4点緑(Fable 独立再実行)+ `review.layer-gold` 19/19 + `review.layer-coverage` 21/21 + 全 721 テスト緑。
- **不一致率 18.23% → 8.33%(16/192)**。残 16 = oracle 9(`+L7a` 等の物差し誤り)+ ambiguous 5(スコープ境界)+ compiler 2(既知ノイズ Necropotence/Bitterblossom・据え置き)。**残不一致はすべて裁定済みで説明可能**。
- **churn(iter3→iter4)= 2.15%(376/17,491)**。byLayer = `L1a +51 / L2 −91 / L4 −113 / L6 −4 / L7c −109`。分類器を意図的に大きく直したため iter3 の 0.68% より上昇=想定内。**凍結シグナルではない**(被覆≥90%・スライス1〜4一巡が未達)。corpus スポット監査で L2 −91 と copy/「is an additional」由来 L4 は**すべて正当な FP 除去**と確認。
- **帰属分布 KPI 初出力**(§4-2): `compiler 21 / oracle 9 / ambiguous 5 / substrate 0`(裁定全体)。report.json/md に残不一致の attribution 列も配線済。

**iter4 が新規に持ち込んだ既知欠落(= iter5 の種・監査が炙り出した過剰一般化)**:
1. **L4 上位型先行アニメート(3枚)**: `becomes a legendary/<color> N/N … <Type> creature`(Sarkhan the Dragonspeaker / Fractalize / The Irencrag)。case-sensitive 化で『a』直後が小文字 supertype/color/数値だと大文字サブタイプ probe に届かず L4 を取りこぼす。旧分類器は i フラグ事故で偶発的に拾っていた(不完全)。**iter5**: `a (legendary|<color>|N/N)…` を跨いで後続の大文字サブタイプ/`creature` を見る probe を追加。
2. **L7c キーワード・カウンター(reminder 内・13枚)**: Outlast/Adapt/earthbend/Support 等、カードが**自分で +1/+1 カウンターを置く**が、その行為が**注釈文(括弧)に書かれている**ため `isQuotedOrReminderOnlyPowerToughness` の reminder 除去で L7c を落とす。カタログ規則「`put a +1/+1 counter` → L7c」に反する。**iter5**: 注釈内であっても**カウンター設置キーワード**(引用された付与能力とは区別)は L7c を維持する。
- いずれも狭域(計16枚 / 17,491)。FP 除去 ~290枚・正当な L1a 付与 51枚に対し純益は大。誤謬予算(§5)内として本反復は据え置き、iter5 で閉じる。

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

---

## スライス2: イベント語彙(誘発/ターンベース/SBA・観測者スコープ)(CR603 / CR700.6 / CR703 / CR704)

> 開始 2026-06-23。スライス1(有効特性=「盤面がどうあるか」)が churn 2.15% / substrate 誤り 0 で実質収束したのを受け、
> 本スライスは「盤面で**何が起きたか**」=イベント語彙へ移る。**本スライスでも runtime コードは書かない**
> (S-EVENTS は M-CONTRACT 凍結後)。確定させるのは「エンジンが認識・配信すべきイベントの最小十分タクソノミ」と
> 「それを誘発文がどう読むか(観測者スコープ・介在条件)」。

### 設計の核(イベント = エンジンの「物語」)

スライス1の有効特性は**静的なスナップショット**だった。だが MTG の大半の効果は**変化に反応する**:
誘発型能力(CR603)・状況起因処理(SBA, CR704)・ターンベース処理(CR703)。これらが読む state は特性ではなく
**「直前に何が起きたか」=イベント**である。エンジンは盤面遷移を**イベントとして発行**し、誘発の観測者へ配る
(CR603.3 の「直前に観測」)。将来の runtime ではこれを `emitEvent(state, event)` → `collectTriggers(state, event)`
(`src/engine/events.ts`、S-EVENTS で実装)が担う。**本スライスはそのために必要なイベント軸を CR とコーパスから確定する。**

EDH 多人数(最終ゴール V4=4人)では**観測者スコープ**(self / 各対戦相手 / 任意のプレイヤー)が一級の state 軸になる。
「あなたがコントロールするクリーチャーが死亡するたび」と「クリーチャーが死亡するたび」は別の購読集合であり、
2人戦では潰れるが多人数では潰れない。**この区別を物差しが測れる形でモデルに刻むのが本スライスの肝**。

> **コーパス需要は本スライスの `event-coverage` 抽出(17,491枚)で確定する**(`research/event-coverage/report.{md,json}`)。
> 下記「枚数」は Fable が snapshot で事前裏取りした**粗概算**(oracle_text への素朴な部分一致・誤差大)。harness が層別に厳密化する。

### ESO エントリ

#### E-EVENT-TRIGGER-SHAPE: 誘発の形(CR603.2 / 603.3 / 603.8)
- **CR根拠**: 603.2(`When/Whenever/At` の誘発型能力)、603.3(誘発はイベント直後に一度観測)、603.8(状況誘発=条件が真の間に一度)
- **コーパス需要**: `Whenever` ≈ 4,904 / `When` ≈ 4,356 / `At the beginning of …` ≈ 1,677(粗概算)
- **state read/write**: read = 発行済イベント列 + 現ステップ/フェイズ。誘発は state を**直接書かない**(スタックへ誘発オブジェクトを積む=将来の `GameCommand`)
- **検証手段**: ゴールド `review.event-coverage` + コーパス頻度 + LLM-oracle 盲予測(別主体)
- **trust**: 未検証(下面抽出前)
- **既知欠落**: 反射誘発(reflexive, CR603.12)・遅延誘発(delayed, CR603.7)は概念登録のみ。本スライスは「直近イベント→誘発」の素形に限定

#### E-EVENT-FAMILY: イベント族(エンジンが発行する遷移の有界語彙)
イベント族は「何が起きたか」の最小十分な型集合。**有界・決定的**(下表で閉じる。未知文は `other` へ落とし silent divergence を作らない)。
コーパス需要は `event-coverage` が族別に頻度・代表カードを埋める。

| ID | 族 | CR根拠 | 発行契機(read 元) | 代表(snapshot) | 概算需要(枚) |
|---|---|---|---|---|---|
| E-EV-ENTERS | enters(ETB) | 603.6e / 603.10 | パーマネントが戦場へ | 《最大族》ETB 多数 | ≈ 5,036 |
| E-EV-LEAVES | leaves(LTB) | 603.6d | パーマネントが戦場を離れる | — | TBD |
| E-EV-DIES | dies(死亡) | 700.4 / 603.6e | クリーチャーが戦場→墓地 | — | ≈ 879 |
| E-EV-ZONE | その他ゾーン移動 | 603.6 / 400.7 | 追放/手札へ戻る/切削/墓地から | — | TBD |
| E-EV-CAST | spell cast | 603.2 / 601 | プレイヤーが呪文を唱える | — | ≈ 3,771 |
| E-EV-ATTACKS | attacks | 508 / 603.2 | クリーチャーが攻撃する | — | ≈ 1,463 |
| E-EV-BLOCKS | blocks / blocked | 509 | ブロック/被ブロック | — | TBD |
| E-EV-DAMAGE | deals/dealt damage | 119 / 603.2 | ダメージ発生 | — | TBD |
| E-EV-DRAW | draws | 120.2 / 121 | カードを引く | — | TBD |
| E-EV-DISCARD | discards | 701.8 | カードを捨てる | — | TBD |
| E-EV-SAC | sacrifices | 701.17 | パーマネントを生け贄 | — | ≈ 2,440 |
| E-EV-TAP | becomes tapped/untapped | 701.21 | タップ/アンタップ | — | TBD |
| E-EV-COUNTER | カウンター設置 | 122 / 603.2 | +1/+1 等カウンターが置かれる | — | TBD |
| E-EV-LIFE | gains/loses life | 119.3 / 118 | ライフ増減 | — | TBD |
| E-EV-PHASE | フェイズ/ステップ juncture | 703(ターンベース) | 各ステップ開始 = `At the beginning of` | — | ≈ 1,677 |
| E-EV-OTHER | 未分類(逃さない箱) | — | 上記以外 | — | 残余 |

- **既知欠落**: 多重イベント(LKI 参照=「死亡した**それ**」CR603.10)・置換による発行抑止(CR614)は概念登録のみ。本スライスは「単一イベント→族」割当の精度を測る

#### E-EVENT-OBSERVER: 観測者スコープ(CR603.2c の誘発主体フィルタ)
- **CR根拠**: 603.2c(誘発文が指定する「誰の」イベントか)、800.4(多人数での所有者退出)
- **コーパス需要**: 対戦相手スコープ語(`an/each/target opponent`, `opponents control`)≈ 2,235 / `each player` ≈ 400(粗概算)
- **state read/write**: read = イベントの主体プレイヤー/オブジェクトのコントローラ + 誘発元のコントローラ。スコープで購読を絞る
- **値域(有界)**: `self`(you / this / あなたがコントロール) | `opponent`(各/いずれかの対戦相手) | `any`(プレイヤー/各プレイヤー=コントローラ不問) | `controlled-set`(「あなたがコントロールするクリーチャー」等の自軍集合) | `unknown`(判定不能=逃さない箱)
- **検証手段**: ゴールド `review.event-coverage`(self/opponent/any の弁別を敵対的に固定)
- **trust**: 未検証
- **既知欠落**: 「あなたや、あなたがコントロールするパーマネント」等の複合主体は近似(self に寄せる)。**多人数での精密化は V4 スコープ**。だが**軸自体は今スライスで刻む**(後付けは state 再設計=最も戻しにくい)

##### iter3 ESO 境界裁定(2026-06-24・Fable)— ambiguous 10 を確定
iter2-b の残差 ambiguous 10(物差し誤りは尽き ESO 未決のみ)を以下に裁定する。3決定はいずれも**「主体(subject)の開集合性」**という一貫した原理から導かれる。

1. **被付与/装備パーマネント主体 → `any`(not `unknown`)**。`Whenever enchanted/equipped <X> …` の観測者は、付着先パーマネントのコントローラ。テキストで自軍にも相手にも固定されず(`Enchant creature`/`Equip` は両陣営に付き得る・コントロール奪取もある)=**コントローラ不問の開集合** → 値域 `any`。`unknown` は「判定不能=逃さない箱」であり**確定可能なものを残してはならない**(箱を空に保つ)。対象6件: Utopia Sprawl / Wild Growth / Fertile Ground / Skullclamp / Sword of Feast and Famine / Sword of the Animist。**注**: 「被付与プレイヤー」(`enchanted player is attacked` = Curse of Opulence)は別扱い=**観測者 `unknown` 維持**。enchanted permanent は「誰が controller でも当該 permanent の事象で発火」=コントローラ不問の `any` だが、enchanted player は「特定だがテキスト不定の単一プレイヤー」(各プレイヤーの攻撃では発火しない)で `any`(各/任意プレイヤー)に当たらず、確定不能=`unknown`(物差しも uncertain として保留)。Curse の compiler 修正対象は族のみ(`other`→`attacks`=受動 `is attacked`)。
2. **非creature の戦場→墓地 → `leaves`(LTB)、`dies` ではない**(E-EVENT-FAMILY の `E-EV-DIES` は **CR700.4 = creature 限定**)。`<non-creature> is put into a graveyard from the battlefield` は leaves-the-battlefield 事象。主体が creature と非creature の**両方**を含む文(`creature or artifact you control …`)は **`dies` + `leaves` の双方**を発行する。対象3件: Marionette Apprentice(creature+artifact → dies+leaves)/ Ichor Wellspring(artifact → leaves)/ Titania, Protector of Argoth(land → leaves)。**`from anywhere`(戦場由来でない)は `leaves` でなく `zone`**(例 Gitrog/Syr Konrad)。
3. **観測者は主体スコープ。`to an opponent / to a player`(受け手=recipient)は観測者にしない**。`Whenever <X> deals damage to an opponent …` の観測者は damage の**行為者** `<X>`(Curiosity=enchanted creature → 上記1より `any`)であって受け手 opponent ではない。**`an opponent <verb>s`(opponent が主語)は opponent を維持**(Smothering Tithe/Sheoldred の `each opponent's upkeep` 等)— 受け手除外は主語スコープ規則の精密化であって opponent 検出の撤回ではない。対象1件: Curiosity(`opponent` → `any`)。iter2-a の `review.event-coverage` opponent 回帰 pin のうち Curiosity を本裁定へ訂正(Sheoldred/Bloodchief が opponent 主語ガードを継続担保)。

> 帰結: ambiguous 10 → 0。観測者 `unknown` 箱は本スライスで空(確定不能事象が出れば再開)。分類器への落とし込みは iter3 compiler 修正(`eventClassify.ts`)で実施し、`review.event-coverage` の敵対 gold が CR 準拠を固定する。

#### E-INTERVENING-IF: 介在条件(CR603.4)
- **CR根拠**: 603.4(`When … , if <条件>` は誘発時と解決時の二度チェック)
- **コーパス需要**: `if you control / if you have / if …`(誘発直後の条件節)≈ 512(粗概算・上限)
- **state read/write**: read = 誘発時 state と解決時 state の二点での条件評価。**SBA/通常条件と区別**(介在条件は誘発の一部)
- **検証手段**: ゴールド + LLM-oracle。**`as long as …`(継続・スライス1の層境界)と混同しないことを敵対的に固定**
- **trust**: 未検証
- **既知欠落**: 複数条件の合成は素朴 boolean のみ

#### E-SBA: 状況起因処理(CR704)
- **CR根拠**: 704(優先権授受の直前に自動チェック。誘発ではない=スタックに乗らない)
- **コーパス需要**: per-card の「需要」ではなく**グローバル規則**。コーパスは**相互作用カード**で間接計測(`0 toughness` / `state the game` / poison `10` 等)
- **state read/write**: read = 全 SBA 条件(0以下タフネス・致死ダメージ・0ライフ・毒10・レジェンド rule・トークン消滅 等 CR704.5x)。検出時に該当 `GameCommand` を自動発行
- **検証手段**: CR704.5 の条文と1対1で対応する固定リスト(コーパス物差しは補助)
- **trust**: 未検証(条文駆動なので corpus churn の対象外。**被覆は CR704.5 列挙で測る**)
- **既知欠落**: 多人数同時 SBA の解決順(CR704.7)は概念登録のみ

#### E-TBA: ターンベース処理(CR703)
- **CR根拠**: 703(各ステップで自動発生する処理。アンタップ・ドロー・戦闘ダメージ 等)
- **コーパス需要**: グローバル規則。`At the beginning of <step>` 誘発(E-EV-PHASE)が**観測する juncture** を提供
- **state read/write**: read = 現フェイズ/ステップ。各 juncture で規定処理を発行(アンタップ・ターン頭ドロー 等)
- **検証手段**: CR703.4 のステップ列と1対1
- **trust**: 未検証(条文駆動)
- **既知欠落**: フェイズ追加・ステップ飛ばし(CR720/500.8)は概念登録のみ

### 抽出タクソノミ + 出力スキーマ(`event-coverage` への契約)
`scripts/lib/eventClassify.ts` の純関数 `classifyCardEvents(def): CardEventSummary` が下記を満たす(GameState 非依存・決定的・scripts 配下):
- `families: EventFamily[]` — 上表 E-EV-* の族 ID(昇順・重複排除)。誘発文を持たないカードは空配列
- `observers: ObserverScope[]` — `self|opponent|any|controlled-set|unknown`(昇順)
- `triggerShapes: TriggerShape[]` — `when|whenever|at`(昇順)
- `hasInterveningIf: boolean` — CR603.4 の介在条件を含むか
- 抽出は英語 `oracleText` 正本のみ。注釈文(括弧)・引用能力内のネスト誘発は**当該カード自身の誘発と区別**(スライス1の reminder/quote 除去パターンを踏襲)
- `event-coverage` レポートは族別・観測者別の頻度、`triggerShape` 分布、介在条件率、多族カード数、mappingFailures(=0必須)、churn(前反復比)を出す(`layer-coverage` と同形式)

### 収束メモ(本スライスの進捗)
- [x] 下面抽出(`event-coverage`)実行 → 各 E-EV-* / 観測者の「コーパス需要」を数値で確定(2026-06-23 iter1)
- [x] ゴールド `review.event-coverage` 全件 pass(16/16)+ 機械チェック4点緑(Fable 独立採点)
- [x] iter1 ベースライン裁定 → 族/観測者の系統的ギャップを抽出(下記)
- [ ] LLM-oracle 盲予測(別主体)で族/観測者分類に物差しを当てる(相関エラー遮断)
- [ ] churn 算出(次反復 N→N+1)→ スライス1と合算で凍結可否を判定

### iter1 抽出結果ベースライン(2026-06-23・監査合格)
機械チェック4点緑(Fable 独立再実行)+ `review.event-coverage` 16/16 + `review.layer-coverage` 23/23 + 全 739 テスト緑。
- トリガ行 9,067 / mappingFailures 0。誘発カードの頭は **enters 3,418(38.6%)・attacks 1,223(13.7%)・phase 1,056(12.1%)**。
- 観測者: self 5,478 / any 1,190 / unknown 870 / controlled-set 555 / opponent 322。介在条件 670枚(3.83%)。
- 誘発形: whenever 3,974 / when 3,542 / at 1,056。多族カード 1,179、`other` 560(6.42%)。
- **解釈**: 実装優先度は **enters(ETB)→ attacks → phase juncture** が頭。観測者は self 圧倒だが any/opponent も合計 1,500枚超
  = **多人数スコープ軸を state に刻んだ判断は corpus 加重でも正当**(2人戦に潰す近似では 1,500枚を取りこぼす)。

### 裁定・既知欠落(iter1 が炙り出した系統的ギャップ = iter2 の種)
Fable が `other`/`zone` バケットを敵対的にスポット監査(独立 tsx 実行)。`other` は「逃さない箱」が機能している証拠で、
中身に**正当な other**(Class レベルアップ・土地プレイ・mana タップ・ライブラリ探索)と**系統的 FN/FP** が混在:
1. **dies FN(複数形/受動)**: 「one or more (other) creatures **die**」(Morbid Opportunist)が `other` へ。
   dies probe が単数 `dies` のみ一致(`Dictate of Erebos`「creature you control dies」は正しく dies)。**iter2**: 複数動詞 `die`/`they die` を dies へ。
2. **counter FN(受動)**: 「+1/+1 counters **are put on**」(Evolution Witness)が `other` へ。counter probe が能動「you put」のみ。
   **iter2**: 受動「counters are put on」を E-EV-COUNTER へ。
3. **cast+zone FP**: 「cast a spell **from exile**」(Nalfeshnee)が `cast`(正)に加え `zone`(誤)を併発。
   zone probe が cast 修飾の「exile」を拾う。**iter2**: cast 文脈の「from exile/from your graveyard」は zone を発火させない。
- いずれも狭域・規則明快。誤謬予算(method §5)内として iter1 は据え置き、**iter2 で閉じる**(Slice 1 の iter2-4 と同じ反復 cadence)。
- **既知の設計境界(iter1 では未実装で正)**: 遅延誘発(`At the beginning of your next upkeep`= Pact of Negation)を phase に計上=
  素形では許容(CR603.7 の精密化は後)。LKI 参照・反射誘発は ESO E-EVENT-TRIGGER-SHAPE 既知欠落のまま。

### iter2 結果(2026-06-23・監査合格)
上記3系統 FN/FP を `scripts/lib/eventClassify.ts` で閉鎖。機械4点緑(Fable 独立)+ `review.event-coverage` 20/20 + 全 743 緑。
ゴールド pin 4件追加(Morbid Opportunist / Evolution Witness / Nalfeshnee / Poison-Tip Archer)。
- **churn(iter1→iter2)= 0.34%(60/17,491)**, byFamily = `dies +14 / counter +38 / zone -8 / other -51`。
- `other` **560 → 509**(2.91%)へ縮小。dies 759→773、counter 22→60、zone 93→85(cast-from-exile FP 除去)。
- **解釈**: 3系統が狙い通り移動し副作用なし。残 `other` は「逃さない箱」が機能し、**系統的 FN は枯渇傾向**。

### iter3 の種(iter2 監査が残した残ギャップ)
`other`(509)の残差を Fable がスポット監査。**明確な分類器 FN は1系統のみに収斂**=収束の兆候:
1. **cast FN(列挙型)**: 「cast a/an **\<Type1\>, \<Type2\>, or \<Type3\> spell**」(Sram「cast an Aura, Equipment, or Vehicle spell」)が
   `other` へ。cast probe が列挙の途中で `spell` 到達前に切れる。**iter3**: 列挙型リスト後の `spell` を見て cast を発火。
- **残りは「真の other」または ESO 設計判断(新族の要否)**で分類器バグではない:
  - クラスタ(新族候補・Fable 判断): mana-tap(「you tap a land/permanent for mana」= Crypt Ghast/Mirari's Wake)、
    サイクリング(「When you cycle this card」= Shark Typhoon/Decree of Pain)、トークン生成(「Whenever you create a token」= Rosie Cotton)。
    族を増やすか `other` 据え置きかは次スライス/反復の統合判断。
  - 真の other(据え置きで正): Class レベルアップ・ライブラリ探索・土地プレイ・呪文打ち消し(counter-a-spell)・mana 追加。
- 誤謬予算内。次セッションで iter3(cast 列挙型 1系統)+ 新族要否の統合判断 → その後 LLM-oracle 盲予測へ。

### iter3 結果(2026-06-23・監査合格)
cast 列挙型 FN を `scripts/lib/eventClassify.ts` で閉鎖(`castEnumeratedSpellConditionCommaIndex`= cast が条件先頭側にある時のみ
列挙型リスト後の `spell` まで条件境界を延ばす)。ゴールド pin = Sram。機械4点緑(Fable 独立)+ `review.event-coverage` 21/21 + 全 744 緑。
- **churn(iter2→iter3)= 0.05%(9/17,491)**, byFamily = `cast +9 / other -9`。cast 728→737、other 509→**500**(トリガ行比 5.74%)。
- **過剰一致なし(敵対監査で確定)**: 「dies → 効果で cast」(条件は dies)は cast を発火しない(境界ガード `firstComma <= castMatch.index` が有効)。

### 新族の統合判断(Fable・2026-06-23・確定)
`other`(500)残差クラスタのコーパス需要を snapshot で実測し、**新族は本スライスでは追加しない**と裁定:
- トークン生成(観測)=小(696 はほぼ効果側「create a token」、観測トリガは僅少)/ サイクリング 40 / mana-tap 32 / land-play 12 / counter-a-spell 24。
- いずれも `other`(逃さない箱)で**可視化済=silent divergence ではない**。「最小十分」原則に照らし、需要小の微族 4-5 個追加はオントロジー肥大。
  将来エンジンが必要とすれば後付け可能(family 値域の拡張は state 再設計でなく追記)。

### スライス2 分類器の収束所見(3反復)
- **churn 逓減**: iter1→2 = 0.34% → iter2→3 = 0.05%。**系統的 FN は枯渇**(dies複数形/counter受動/zone-FP/cast列挙を逐次閉鎖)。
- 残 `other`(500・5.74%)は「真の other + 需要小クラスタ」で**分類器バグではない**。被覆頭は enters 38.6% / attacks 13.7% / phase 12.1%。
- **スライス2 の下面抽出器は実質収束**。次は **LLM-oracle 盲予測(別主体)** で族/観測者分類に独立物差しを当て(相関エラー遮断)、
  不一致裁定 → trust 更新。その後スライス3(ゾーン+プレイヤー)へ。**M-CONTRACT 凍結はスライス1〜4一巡後**(method §5)。

### 物差し iter1 結果(M0-O2・LLM-oracle 盲予測・2026-06-23・監査合格)
契約 = [`oracle-harness.md`](oracle-harness.md) §7。別主体(gpt-5-codex clean-room)が oracleText のみから族/観測者/介在条件を盲予測 →
`eventClassify` と3軸独立集合差で比較。正本 = [`research/event-oracle/adjudication.json`](../research/event-oracle/adjudication.json)。機械4点緑(Fable 独立)+ `review.event-oracle` 16/16 + 全 760 緑。
- **KPI(サンプル203)**: familyDiscrepancyRate **10.84%** / observerDiscrepancyRate **18.23%** / interveningIfDiscrepancyRate **0%** / unverifiableRate **0%**。
  ゴールド校正 = supported 全族で **precision=recall=100%**(物差しは人手 gold18 で完全校正)。
- **帰属(46不一致)**: `substrate 0 / compiler 21 / oracle 24 / ambiguous 1`。**substrate 0 = スライス2 ESO(族/観測者/介在条件の3軸)は健全**。介在条件は完全一致で state 次元の欠落なし。
- **trust 更新**:
  - `検証済`(物差し一致): dies / cast / attacks / damage / enters / counter / life / sacrifice / zone 族(confusion で classifierOnly=oracleOnly=0)、観測者 opponent、介在条件。
  - `不一致=物差し誤り(oracle)`(分類器は正・iter2 で §7.2 prompt 改訂): combat-damage→phase 過剰付与(13)、phase juncture 観測者 self↔unknown(5)、tap-for-mana 族(3)。
  - `不一致=分類器誤り(compiler)`(iter2 で `eventClassify` 修正): 自己名→self(P1・7)、非creature「X you control」→controlled-set(P2・7)、「this X or another X you control」→self(P3・2)、tap-for-mana の tap/other 内部不整合(P5・3)、leaves/other 取りこぼし(P4・2)。
  - `要 ESO 判断(ambiguous)`: observer の定義(誘発の**行為者** vs **観測対象**=Terrasymbiosis)。mana-tap を独立族にするか `other` 留置かと併せ確定。
- **物差し故障モード**: `unverifiableRate=0%`=物差しが uncertain を一度も使わず(過信傾向・method §3.1)。iter2 prompt で uncertain 使用を促す。
- **次の一手(method §7 flip-flop=ルールと物差しを同時に変えない)**: iter2-a = compiler 帰属(P1〜P5)を `eventClassify` 修正 → `event-coverage` churn 再算出。iter2-b = §7.2 prompt を oracle 帰属に基づき改訂 → 盲予測再実行 → 不一致率再測。両方収束後にスライス1と合算で凍結可否判定。

### 物差し iter2-a 結果(compiler 修正・物差し凍結・2026-06-23・監査合格)
P1〜P5 を `scripts/lib/eventClassify.ts` で修正(Codex)。物差し `predictions.json` は凍結のまま再測。Fable 監査で opponent 検出の回帰を発見し外科修正(`isOpponentScope` の `^` アンカーを `\b` へ revert・`review.event-coverage` に opponent 回帰ガード3 pin 追加)。正本 = `research/event-oracle/adjudication.json` `iter2aResult`。
- **不一致率**: family 10.84%→**7.88%** / observer 18.23%→**12.32%** / interveningIf 0%。**帰属 compiler 21→0**(全解消)。残 29 不一致 = oracle 28 + ambiguous 1 = **すべて物差し側**。flip-flop が綺麗に分離(ルール修正完了・残差は純粋に物差し誤り)。
- **🔴 最重要発見=偽の収束の崩壊**: **iter3→iter2-a の真の churn = 13.55%(2,370/17,491)**(family 912枚・observer 2,185枚変化。enters +293/other +219/phase +141/cast +96/attacks +88)。**下面抽出単独の churn 0.05% は「収束」を誤報していた**。独立物差し(たった203枚の盲予測)が、`event-coverage` が見落としていた**構造的 FN を露呈**:
  - **P2a ability-word 接頭辞**(`Landfall —`/`Survival —`/`Revolt —`/`Psionic Spells —` 等)が**誘発行を丸ごと脱落**させていた(enters/phase の大量 FN)。ability-word は MTG に多数存在し、**毎反復が同一に取りこぼす=churn が立たない=自己計測では永久に発見不能**だった。
  - **P4 行内2誘発**・**P3 複合主語**・**P1 自己名**も corpus 全体で多数を回収。
  - スポット監査(Aberrant Mind Sorcerer/Adventuring Gear/Aesi/Acrobatic Cheerleader/Aid from the Cowl/Architect of the Untamed 他)で**回収はすべて正当な FN**(過剰発火でない)と確認。
  - **method §3 の実証**: 自己計測の低 churn は「弱い陽性」に過ぎず、故障モードの異なる独立物差しが偽の収束を破る。**Slice2 は未収束**(凍結不可)。
- **収束への含意**: iter2-a で分類器が大きく変わったため、**新出力を新ベースラインに下面抽出 churn を再安定化**させる必要(次反復で 0.05% 方向へ戻るはず)。iter2-b(物差し prompt 改訂)と合わせて family/observer 不一致率 + churn が共に低下したら凍結候補。
- 監査: 機械4点緑(Fable独立)+ `review.event-coverage` 31/31 + `review.event-oracle` 16/16 + 全 770 緑。Codex は git/docs/review/src/engine/predictions.json 不可侵を遵守。

### 物差し iter2-b 結果(prompt 改訂・ルール凍結・2026-06-23・監査合格)
flip-flop の後半:**ルール `eventClassify` を凍結し物差し(§7.2 prompt)を v2 へ改訂**(combat-damage≠phase / phase juncture 観測者 your→self・each opponent's→opponent・each→any / tap-for-mana→other / 観測者=主語スコープで recipient 除外 / uncertain 積極使用)。Codex が全203枚を clean-room 再予測(新 promptHash)。正本 = `adjudication.json` `iter2bResult`。
- **不一致率の推移**: family **10.84%→7.88%(iter2-a)→3.94%(iter2-b)** / observer **18.23%→12.32%→6.40%** / interveningIf 0% / **unverifiable 0%→2.46%**(物差しが uncertain を使い始めた=過信故障の是正)。discrepancies 46→29→**20**。
- **帰属(20不一致)**: substrate 0 / compiler 9 / **oracle 1** / ambiguous 10。prompt v2 が iter1 の大型 oracle 誤り(combat-damage→phase 13・phase juncture 観測者 5・tap-for-mana 3)を**ほぼ一掃**(oracle 残 1 = Animate Dead の mid-line leaves)。
- **残差の質的変化**: もはや物差し誤りは尽き、残るは(a)**compiler 9**=複合『A, or B, or C』列挙トリガの取りこぼし(Trouble in Pairs/Syr Konrad/Mirkwood Bats/Blood Artist)・any 過剰付与・unpossessed phase の at→self・causes-you・is-attacked、(b)**ambiguous 10**=ESO 境界の未決:
  - **unknown vs any**(6): 被付与/装備 perm の不特定 controller(`enchanted/equipped X`)。observer 不一致の主因。**1判断で約6件解消**。
  - **dies vs leaves**(3): 非creature(artifact/land)の『put into graveyard from battlefield』(CR700.4 の dies は creature 限定)。Marionette/Ichor/Titania。
  - **recipient-opponent**(1): 『deals damage to an opponent』の受け手 opponent を観測者にするか(subject-scope なら否)。Curiosity。iter2-a の opponent 回帰 pin と要整合。
- **substrate なお 0** = 3軸の ESO state モデルは2反復・物差し2改訂を経ても健全。
- **収束読み**: 物差しが信頼域に入り(family 3.94%・oracle 帰属ほぼ消滅)、残差は「分類器の複合トリガ処理(iter3 compiler)」と「ESO 境界の Fable 決定(unknown-vs-any 他)」に**綺麗に二分**。**Slice2 は凍結に近いが未到達**(observer 6.40% > 5%)。次 iter3 = ESO 境界3決定 + compiler 複合トリガ修正 → 下面抽出 churn 再安定化 → family/observer 共に <5% 安定で Slice1 と合算し M-CONTRACT 凍結判定。
- 監査: 機械4点緑(Fable独立)+ 全770緑。ルール凍結を `git diff scripts/lib/eventClassify.ts`(差分なし)で確認・`predictions.json` は新 promptHash(18a3c20a)。

### 物差し iter3(ESO 境界裁定 + compiler 複合トリガ修正・2026-06-24)
iter2-b で残差が **compiler 9 + ambiguous 10** に綺麗に二分されたのを受け、両方を閉じる反復。
- **Fable 裁定**(上記「iter3 ESO 境界裁定」): ambiguous 10 を確定(enchanted/equipped X → `any` / 非creature LTB → `leaves` / recipient 除外 → 主体スコープ)。`review.event-coverage` に CR 準拠 gold を追加・Utopia Sprawl(unknown→any)/Curiosity(opponent→any)を訂正。
- **Codex compiler 修正**(`eventClassify.ts`): 裁定の落とし込み(any/leaves/recipient除外)+ compiler 9 FN クラスタを閉鎖 —(a)**複合『A, or B, or C』列挙トリガ**の中位/末尾条件取りこぼし(Trouble in Pairs=attacks/cast/draw・Syr Konrad=dies/zone・Mirkwood Bats=other/sacrifice・Blood Artist の `another creature`(無所有格)→ any)、(b)**unpossessed phase**(`at the beginning of the end step` 無 `your` → `any` = Underworld Breach)、(c)**causes-you**(`a land's ability causes you to add` → self = Caged Sun)、(d)**is-attacked 受動**(`enchanted player is attacked` → `attacks` 族 = Curse of Opulence)、(e)Laelia/Gitrog の `your library/graveyard` → self(any 過剰の是正)。
- **再計測**: `event-coverage` で churn 再算出(iter2→iter3。分類器変更後 0.05% 方向へ再安定するはず)→ `event-oracle-sample` 再生成 → **clean-room 再予測**(Fable と別主体・相関エラー遮断)→ `event-oracle-diff` で新 KPI。
- **凍結判定基準**: family<5% & observer<5%(現 6.40%)& churn 低位 & substrate=0 & ambiguous=0 & compiler=0 を満たせば Slice2 凍結候補 → Slice1 と合算で M-CONTRACT 凍結判定。未達なら iter4。正本 = `adjudication.json` `iter3Result`。

---

## スライス3: ゾーン + プレイヤー(所有者/コントローラー/クロスプレイヤー/プレイヤースコープ)(CR400 / CR108 / CR110 / CR800)

> 開始 2026-06-24。スライス1(盤面がどうあるか=有効特性)・スライス2(何が起きたか=イベント語彙)が凍結候補に到達したのを受け、
> 本スライスは「**どのゾーンを・誰のものとして読み書きするか**」=ゾーンとプレイヤー帰属の state 軸を確定する。
> **本スライスでも runtime コードは書かない**(プレイヤー別ゾーン=S-ZONES・ダミー相手=S5 は M-CONTRACT 凍結後)。
> 確定させるのは「エンジンが持つべきゾーン分割(プレイヤー別/共有)と所有者・コントローラー・プレイヤー参照の最小十分軸」。

### 設計の核(ゾーンとプレイヤーは「最も戻しにくい」state 設計)

現エンジンは `zones: Record<ZoneId, string[]>`(全体共有・プレイヤー別でない)で、`CardInstance` に owner/controller フィールドを持たない
=**単一プレイヤー前提**。だが MTG は CR400.1 で **library/hand/graveyard は各プレイヤー固有**・battlefield/stack/exile/command は共有、と定める。
さらに CR108.4(owner=ゲーム開始時の所有者)と CR110(controller=現在の操作者)は**別概念**(コントロール奪取で乖離する)。
これらを後から足すと前方互換と全 read/write 経路の再設計=最大の代償(method §0)。ゆえに**紙の上で先に需要を確定**する。

> **read-timing / object-identity を第一級に持つ**(architecture §2.1)。「どのゾーンの・どの時点の・誰の」オブジェクトを読むかは値ではなく
> 構造であり、Slice3 はこの構造軸をコーパス需要で裏取りする。LKI(object-identity の極北)は本スライスでは既知欠落(概念登録のみ)。

EDH 多人数(最終ゴール V4=4人)では、**「あなた」以外のプレイヤーのゾーンに触れる効果**(相手の手札・墓地・ライブラリ)が
ダミー相手(S5)とプレイヤー別ゾーン(S-ZONES)を必須化する。**この「クロスプレイヤー率」を測るのが本スライスの肝**
(2人戦に潰す近似では取りこぼす枚数=戻せない設計の規模)。

> **コーパス需要は本スライスの `zone-coverage` 抽出(17,491枚)で確定する**(`research/zone-coverage/report.{md,json}`)。
> 下記「枚数」は粗概算(oracle_text への素朴な部分一致・誤差大)。harness が軸別に厳密化する。

### ESO エントリ

#### E-ZONE-REF: ゾーン参照(カード文が read/write するゾーン集合)
- **CR根拠**: 400(ゾーンの定義)、400.7(ゾーン間移動=新オブジェクト)、608(解決時のゾーン移動)
- **コーパス需要**: graveyard 参照 ≈ 4,300 / library ≈ 3,500 / exile ≈ 2,600 / hand ≈ 3,800(粗概算・`zone-coverage` が確定)
- **state read/write**: read = 対象ゾーンのカード列。write = ゾーン間移動(`from <zone>` → `to <zone>`)
- **値域(有界)**: `library | hand | graveyard | battlefield | exile | command | stack`(現 `ZoneId` と一致)
- **検証手段**: ゴールド `review.zone-coverage`(ゾーン語彙の弁別を敵対的に固定)+ LLM-oracle 盲予測(次反復)
- **trust**: 未検証(下面抽出前)
- **既知欠落**: 領域変更の連鎖(708 face-down・612 文章変更で生じる擬似ゾーン)は概念登録のみ

#### E-ZONE-PARTITION: ゾーン分割(プレイヤー別 vs 共有)
- **CR根拠**: 400.1(library/hand/graveyard = 各プレイヤー固有、battlefield/stack/exile/command = 共有)
- **コーパス需要**: per-card の需要ではなく**構造規則**。`E-ZONE-REF` の各参照が「誰の」ゾーンかで分割側に振り分く
- **state read/write**: 現 `zones[zone]` を **`zones[playerId][zone]`(個別)+ `zones[zone]`(共有)** へ一般化する根拠
- **値域**: `per-player`(library/hand/graveyard)| `shared`(battlefield/stack/exile/command)
- **検証手段**: CR400.1 と1対1の固定対応(コーパスは `E-ZONE-CROSS` 経由で間接計測)
- **trust**: 未検証(条文駆動)
- **既知欠落**: 統率者領域の所有者別区画(各プレイヤーが自分の統率者を持つ)は S-ZONES の実装詳細

#### E-ZONE-CROSS: クロスプレイヤー参照(「あなた」以外のゾーンに触れるか)
イベント族の `other` と同じ「最重要メトリック」枠。**単一プレイヤー前提が崩れる枚数**を測る。
- **CR根拠**: 400.1(他プレイヤーの固有ゾーン)、800(多人数)
- **コーパス需要**: `an/each/target opponent's <zone>` / `each player's <zone>` / `opponents' <zone>` ≈ 1,500(粗概算・`zone-coverage` が確定)
- **state read/write**: read = イベント/効果の対象プレイヤーのゾーン。あなた以外を含めばダミー相手(S5)の実体が要る
- **値域**: `boolean`(touches a non-you zone)
- **検証手段**: ゴールド `review.zone-coverage`(`opponent's graveyard` 等を cross=true に固定)
- **trust**: 未検証
- **既知欠落**: `their <zone>`(代名詞照応=直前のプレイヤー参照の引き継ぎ)の解決は粗。**iter2 の主たる種候補**

#### E-OWNER / E-CONTROLLER: 所有者 vs コントローラー
- **CR根拠**: 108.4(owner=デッキ提供者・ゲーム外で固定)、110.2(controller=現在操作するプレイヤー)、613 L2(コントロール変更層)
- **コーパス需要**: `you control` / `gain control` ≈ 4,000(controller)/ `its owner('s)` / `return … to its owner` ≈ 900(owner)(粗概算)
- **state read/write**: read = オブジェクトの owner と controller(別フィールド)。write = コントロール奪取(controller のみ変更・owner 不変)
- **値域**: `owner | controller | both | none`(その文がどちらの帰属を読むか)
- **検証手段**: ゴールド `review.zone-coverage`(`gain control`=controller と `to its owner's hand`=owner を弁別)。スライス1 `E-LAYER-L2`(コントロール変更層)と整合
- **trust**: 未検証
- **既知欠落**: owner と controller が乖離した状態のカード移動先(「コントローラーが失っても owner の墓地へ」CR400.7c)は概念登録のみ。
  **ゾーン由来 owner 含意**(明示 owner 語がなく `from an opponent's <zone> … under your control` のみで owner を含む = Puppeteer Clique 系)は
  照応の一種で controller のみを floor とする(iter2 ESO 境界裁定1。明示 owner 語があれば `both`)

#### E-PLAYER-SCOPE: プレイヤー参照(効果側の主体・対象プレイヤー)
スライス2 `E-EVENT-OBSERVER`(誘発の観測者)と**別軸**=効果が指す/対象とするプレイヤー。語彙は流用する。
- **CR根拠**: 102(プレイヤー)、601.2c(対象=target player)、800.4(各プレイヤー/各対戦相手)
- **コーパス需要**: `you/your` 圧倒 / `each opponent` ≈ 1,300 / `target player|opponent` ≈ 1,100 / `each player` ≈ 700(粗概算)
- **state read/write**: read = 効果が読む/書くプレイヤー集合。対象プレイヤーは将来 `GameCommand` のターゲットに束縛
- **値域(有界)**: `you | target-player | each-opponent | each-player | owner | controller | unknown`(判定不能=逃さない箱)
- **検証手段**: ゴールド `review.zone-coverage`
- **trust**: 未検証
- **既知欠落**: `target player` の auto コンパイルは現状 manual 据え置き(engine-spec §34 / 盤面パーマネント以外は初期非対応)。本スライスは**需要計測のみ**(実装はしない)

### 抽出タクソノミ + 出力スキーマ(`zone-coverage` への契約)
`scripts/lib/zoneClassify.ts` の純関数 `classifyCardZones(def): CardZoneSummary` が下記を満たす(GameState 非依存・決定的・scripts 配下):
- `zones: ZoneId[]` — 上記 E-ZONE-REF の参照ゾーン(昇順・重複排除)。ゾーン言及の無いカードは空配列
- `crossPlayer: boolean` — E-ZONE-CROSS(あなた以外のプレイヤーのゾーンに触れるか)
- `ownership: 'owner' | 'controller' | 'both' | 'none'` — E-OWNER/E-CONTROLLER
- `playerScopes: PlayerScope[]` — `you|target-player|each-opponent|each-player|owner|controller|unknown`(昇順)
- 抽出は英語 `oracleText` 正本のみ。注釈文(括弧)・引用能力内のネストは当該カード自身と区別(スライス1/2 の reminder/quote 除去パターンを踏襲)
- `zone-coverage` レポートはゾーン別需要、**クロスプレイヤー率**、ownership 分布、playerScope 別頻度、複数ゾーン保有数、mappingFailures(=0必須)、churn(前反復比)を出す(`event-coverage` と同形式)

### 収束メモ(本スライスの進捗)
- [x] 下面抽出(`zone-coverage`)実行 → 各軸の「コーパス需要」を数値で確定(2026-06-24 iter1)
- [x] ゴールド `review.zone-coverage` 全件 pass(18/18)+ 機械チェック4点緑(Fable 独立採点)
- [x] iter1 ベースライン裁定 → 系統的 FN(`their` 照応)を抽出(下記=iter2 の種)
- [x] LLM-oracle 盲予測(別主体)で軸に物差しを当てる(相関エラー遮断)= iter1(v1)+ iter2-b(v2)実施済
- [x] churn 算出(iter1→iter2-a = 17.45%・独立物差しへ収束方向)。**Slice3 未収束**(zone 22.99%)=凍結保留。iter3 で暗黙移動 FN を閉鎖後に再判定

### iter1 抽出結果ベースライン(2026-06-24・監査合格)
機械チェック4点緑(Fable 独立再実行 = lint/tsc/vitest 822/build)+ `review.zone-coverage` 18/18 + 全 822 緑。mappingFailures 0。
- **ゾーン保有 8,864枚(50.68%)・複数ゾーン 3,978(22.74%)**。ゾーン需要頭 = battlefield 6,084(34.8%)・graveyard 2,255(12.9%)・hand 2,067(11.8%)・library 1,794(10.3%)・exile 1,788(10.2%)・stack 208・command 36。
- **ownership**: none 10,547(60.3%)・controller 6,145(35.1%)・both 439・owner 360。**owner/controller の弁別軸は corpus でも実在**(owner 語 360+both 439 = 約800枚が owner≠controller を要求)。
- **playerScope**: you 11,422 圧倒 / each-opponent 1,881 / each-player 1,116 / target-player 811 / owner 799 / controller 395 / unknown 158。
- **クロスプレイヤー率 130枚(0.74%)** ← **解釈に注意(method §4 churn 規律)**: これは**下面抽出単独の floor であって真値ではない**。

### 裁定・既知欠落(iter1 が炙り出した系統的 FN = iter2 の種)
Fable が cross-player バケットを敵対スポット監査(独立 grep)。**最重要 = クロスプレイヤー率の過小評価**:
1. **`their <zone>` 照応 FN(iter2 の主たる種)**: 分類器の `touchesCrossPlayerZone` は**所有格 + ゾーン語の隣接**(`an opponent's graveyard`)のみ cross 判定する。
   `Target player reveals their hand` / `Each player … their graveyard` の **`their`(直前のプレイヤー参照の照応)を取りこぼす**。
   コーパス裏取り: `their hand/graveyard/library` を含む **484枚**、opponent 語と zone 語の共起 **809枚** に対し、cross 検出は **130枚のみ**。
   = **真のクロスプレイヤー率は 0.74% の数倍**(概ね 1.5〜4% 域)と推定。**照応解決(`their`=you/opponent/each-player のどれか)は単なる regex 追加でなく object/player 同一性のモデル決定**ゆえ iter2 で扱う。
2. **`from a graveyard`(不特定所有者)**: 現状 cross=false で正(opponent 確定でない)。だが「実際は他者墓地も射程」のカードは LLM-oracle で再評価対象。
3. **owner scope と ownership=owner の連動**: playerScope owner 799 vs ownership owner 360+both 439=799 で整合(健全)。
- **method §3/§4 の実証(再掲)**: 0.74% を「収束」と読んではならない。**独立物差し(LLM-oracle 盲予測=次マイルストーン)が照応 FN を露呈して初めて真のクロス率が出る**。Slice2 の churn 0.05%→13.55% と同型の罠を予防的に明記。
- **churn 0%**(初回=baseline なし)。次反復で iter1 出力を baseline に算出する。

### オラクル iter1(独立物差し=別主体盲予測・2026-06-24・監査合格)
契約 = `docs/oracle-harness.md` §8。別主体(gpt-5-codex clean-room・promptHash 82483561)が oracleText のみから4軸(zones/crossPlayer/ownership/playerScopes)を盲予測 → `zoneClassify` と4軸独立集合差(`scripts/lib/zoneOracleHarness.ts`)。sample 189(gold16+head90+cross40+cross-suspect30+tail20)、compared 187。正本 = `research/zone-oracle/{report.md,adjudication.json}`。
- **KPI**: zone 不一致 **19.79%** / **crossPlayer 不一致 6.42%(classifierOnly 0・oracleOnly 12)** / ownership 5.88% / playerScope 13.90% / 検証不能 0.00%。discrepancies 61。
- **帰属(61・`adjudication.json`)= substrate 0 / compiler 21 / oracle 21 / ambiguous 19**。**🟢 substrate=0 = Slice3 の5軸 ESO モデルは独立物差しでも健全**(軸の欠落なし)。
- **🔴 仮説の確証(クロス率の floor 崩壊)**: **crossPlayer oracleOnly 12・classifierOnly 0** = 分類器は cross を過剰検出せず、`their/its owner/that player's <zone>` の**照応を系統的に取りこぼす**(Thoughtseize/Windfall/Path to Exile/Assassin's Trophy/Chaos Warp/Living Death/Cyclonic Rift 他)。**0.74% は真値でない**ことを独立物差しが実証=method §4 の churn 規律どおり。
- **裁定の系統的発見(3クラスタ)**:
  1. **compiler 21**(分類器 FN)= (a)**クロス照応**12(iter2 で `zoneClassify` の `touchesCrossPlayerZone` を `their/its owner/that player's` 照応へ拡張)(b)**battlefield 取りこぼし**7(`destroy/exile target <permanent>`・トークン創出→battlefield)(c)scope 取りこぼし2。
  2. **oracle 21**(物差し過剰一般化)= **`cast`/`can't be countered`→stack** の過剰付与(Etali/Jeska's Will/The One Ring 他12+複合)。**ESO 意図では stack ゾーン参照=明示的スタック操作(counter/return-from-stack)であり、`cast` は Slice2 のイベント軸**(ゾーン軸 stack に含めない)。**iter2 物差し: §8.2 prompt v2 で「cast 単独は stack-zone でない」を明記**(Slice2 の combat-damage≠phase と同型の prompt 改訂)。
  3. **ambiguous 19**(ESO 境界=Fable 裁定保留)= (a)**owner≠controller**(他者のカードを唱える: Brainstealer/Laughing Jasper/Valgavoth/Dauthi/Puppeteer Clique=owner は相手・controller はあなた=`both`。ESO で「他者所有カードのキャスト」の owner/controller 同時保有を裁定要)(b)**you-control の scope**(`creatures you control`→playerScope を `you` とするか `controller` とするか: Titania's Command/Captain N'ghathrod)(c)MDFC 面集約の `you`。
- **物差し故障**: 検証不能率 0.00% = オラクルが `uncertain` を使わず(過信・Slice2 iter1 と同型)。**iter2 prompt で uncertain 使用を促す**。
- **trust 更新**: E-ZONE-REF(zones)= **不一致**(stack 物差し過剰 + battlefield FN を iter2 で解消後に再測)。E-ZONE-CROSS= **不一致**(照応 FN 確定・iter2 で分類器拡張)。E-OWNER/E-CONTROLLER= **不一致**(owner≠controller 境界裁定保留)。E-PLAYER-SCOPE= **不一致**(controller scope 境界)。**substrate 健全だが各軸 trust は未収束**=Slice3 継続(iter2)。
- **収束読み**: Slice2 と同型に「物差し過剰(oracle 21)+ 分類器 FN(compiler 21)+ ESO 境界(ambiguous 19)」へ綺麗に三分。substrate=0 で**モデルは正しい**。iter2 = flip-flop(分類器 compiler 21 修正 → churn 再算出 / 物差し prompt v2 → 再予測)で各軸不一致率を <5% 方向へ。**Slice3 は未収束=凍結不可**(method §4)。

#### iter2 ESO 境界裁定(2026-06-24・Fable)— ambiguous 19 を確定
iter1 の ambiguous 19(substrate 健全ゆえ ESO 境界決定のみ)を以下に裁定する。3つの境界はいずれも
**「帰属(owner/controller/scope)は主体(subject)の同一性で決まり、目的語・受け手・ゾーン由来は別軸」**という
一貫した原理から導かれる(iter3 の「主体スコープ」裁定の Slice3 版)。各裁定は iter2-a(ルール)/iter2-b(物差し)へ振り分ける。

1. **他者所有カードの取得/キャスト/プレイ → ownership `both`**(owner≠controller の真の境界)。CR108.4(owner=ゲーム外固定)/
   110(controller=現在操作者)が乖離するのは、**他者が所有するカードを「あなたのコントロール下で」戦場に出す/唱える/プレイする**時。
   その文は owner(=相手=カードの所有者)と controller(=あなた)の**双方を読む** → `both`。
   - **分類器が検出すべき規則(iter2-a)**: **明示 owner 語**(`an opponent owns` / `its owner` / `owned by`)が
     **controller 語**(`under your control` / `you control` / `you may play/cast`)と共起する文で `both`。対象:
     Brainstealer Dragon(`a nonland permanent an opponent owns enters the battlefield under your control`)/
     Dauthi Voidwalker(`an exiled card an opponent owns … You may play it`)。
   - **floor として現状維持を許容(既知欠落)**: owner が**ゾーン由来でのみ含意**され明示 owner 語が無い文
     (`put … from an opponent's graveyard onto the battlefield under your control` = Puppeteer Clique。persist の
     `its owner's control` は reminder 除去で消える)は controller のみで可。「ゾーン所有の含意からの owner 推論」は
     照応の一種で本反復スコープ外(E-OWNER 既知欠落へ追記)。Laughing Jasper Flint / Valgavoth / Kefka も owner 語の
     明示有無で同枠に振り分け(明示語があれば `both`)。
2. **`<X> you control` → playerScope `you`(`controller` スコープにしない)**。`creatures you control` 等の**主体はあなた**
   = playerScope `you`。コントロール関係は **ownership `controller`** が担う。`controller` **playerScope は不定の
   `its/their controller`(第三者の不定コントローラ)専用**に予約し、`you control` には付けない。
   → **分類器は既に正**(`you` を立て controller scope を立てない)。**oracle が `controller` scope を付与したのが誤り** = iter2-b
   §8.2 prompt v2 で是正。対象: Titania's Command / Captain N'ghathrod / Lord Skitter / Massacre Wurm / Urza's Saga。
3. **MDFC は全面集約 = 分類器正**。`splitAbilityLines` が両面の能力行を読む = カードが読み書きするゾーン/プレイヤーは**両面の和**。
   土地面の `your` も `you` に含めるのが ESO 定義。→ oracle が呪文面のみ解釈したのが不足 = iter2-b §8.2 に「全 face を読む」を明示。
   対象: Witch Enchanter // Witch-Blessed Meadow / Boggart Trawler // Boggart Bog。
4. **each-player / you 主体境界(個別・原理 = 主語がスコープ)**。`each player <verb>s`(主語=各プレイヤー)は `each-player`、
   `you <verb>`(主語=あなた)は `you`。両主語が別文に出れば双方。`a player` も `each-player`。受け手・目的語はスコープに数えない。
   対象 6(Nautiloid Ship / Blasphemous Edict / Ashiok, Dream Render / Portent / Flusterstorm / Gonti)は実テキストで主語を確認し、
   分類器正なら iter2-a の `review.zone-coverage` pin、oracle 正なら iter2-b prompt 注記へ振り分け。Gonti は分類器の battlefield(enters)が正・
   oracle の stack(cast 過剰)が誤り(裁定の cast≠stack と同根 → iter2-b)。

> 帰結: ambiguous 19 → (iter2-a ルールで解消)owner-both 明示語 2〜数件 + each-player 主語境界の分類器正分 /(iter2-b 物差しで解消)
> you-control scope 5 + MDFC 2 + cast→stack 系 + each-player の oracle 正分 /(既知欠落として ESO 記載)ゾーン由来 owner 含意。
> **substrate=0 は不変**(軸の欠落でなく境界の確定)。落とし込み = iter2-a `zoneClassify.ts`(裁定1の明示 owner 語)+
> `review.zone-coverage` 敵対 gold(CR 準拠固定)/ iter2-b §8.2 prompt v2(裁定2/3/4 の oracle 側)。

#### iter2-a 結果(ルール半=分類器修正・物差し凍結・2026-06-24・監査合格)
flip-flop の前半。物差し(`predictions.json`/`sample.json`/`adjudication.json`)を**1バイトも触らず**、分類器
`scripts/lib/zoneClassify.ts` の compiler 21 を修正(Codex 実装・カード名ハードコード無し=全汎用パターン)。
- **修正3カテゴリ**: (a)クロス照応=`touchesCrossPlayerZone` を `their/its owner['’]s/its controller['’]s/that(/defending) player['’]s <zone>`
  + 非you 先行詞ガード付き `their <zone>` + `from anywhere` へ拡張。(b)battlefield FN=`destroy/exile target <permanent型>`・
  `return target <permanent型> to (hand|owner)`・`create(s) … token(s)` を `detectZones` に追加(`target … card from <zone>` は除外ガード)。
  (c)owner 語彙=`hasOwnershipReference` に `owns?/owned` 追加(ownership 軸のみ。`owner` playerScope は名詞 `owner('s)` 限定の別関数へ分離=`you own` で owner scope を立てない)。
- **churn(iter1→iter2-a)= 3,052/17,491 = 17.45%**(byZone battlefield **+2,402**・crossPlayer 130→**675**(+545)・mappingFailures 0)。
  **これは自己計測ドリフトでなく独立物差しへ収束する churn**: 同反復で独立オラクル不一致が後述どおり激減=「真の FN の是正」(method §4)。
  Slice2 iter3 の意図的 dies→leaves 再分類と同型(規模は battlefield FN が系統的に大きいぶん大)。
- **独立物差し再差分(物差し凍結のまま分類器のみ更新)**: crossPlayer 不一致 **6.42%→0.53%**(oracleOnly **12→0** = 照応 FN 完全回収・
  classifierOnly 0→1=Hullbreaker Horror で分類器が正・oracle FN)/ ownership **5.88%→3.74%** / zone 19.79%→19.25% / playerScope 13.90%(据置)/
  検証不能 0.00%(据置)。discrepancies 61→**53**。**残差は oracle 側**(cast→stack 過剰 21・you-control scope・unknown 過信)=iter2-b の物差し対象=想定どおり。
- **敵対スポット監査(Fable 独立・コーパス全 17,491 走査)**: battlefield 過剰発火 **0**(新規 battlefield 2,258 は全て destroy/exile-permanent/
  return/token の正当な戦場参照。墓地カード exile+battlefield の 25 件は全て `target creature`(カウンター/ダメージの戦場対象)を持ち battlefield 正)。
  cross 過剰発火 **0**(信号なし cross=0)。機械4点 Fable 独立緑(lint/tsc/vitest 845/build)+ `review.zone-coverage` **25/25**(新規 7 gold pin)+ `review.zone-oracle` 緑。
- **trust(iter2-a 後)**: E-ZONE-CROSS = **検証済方向**(独立物差し一致 99.5%)。E-OWNER/E-CONTROLLER = 改善(3.74%)だが残差 oracle。
  E-ZONE-REF(zones)= battlefield 軸は分類器が正(oracle FN)・残差 stack は oracle 過剰=iter2-b 後に再測。E-PLAYER-SCOPE = iter2-b 物差し待ち。

#### iter2-b 結果(物差し半=prompt v2 で clean-room 再予測・ルール凍結・2026-06-24・監査合格)
flip-flop の後半。分類器(`zoneClassify.ts`)を iter2-a で凍結し、§8.2 prompt を v2 へ改訂(cast≠stack-zone /
`<X> you control`→`you` scope / MDFC 全 face / `uncertain` 促進)→ **同一 sample 189 枚**を独立オラクルが clean-room 再予測
(別主体 gpt-5-codex-clean-room-v2・promptHash e5930f9e・分類器/coverage/gold 非参照)。動かした変数は物差し prompt のみ。
- **v2 は狙いを達成**: cast→stack 過剰(iter1 oracle21)が**消滅**、playerScope 不一致 **13.90→10.16%**(you-control→you が効いた)、
  ownership **3.74→2.67%**、`unverifiableRate` **0→11.64%**(uncertain 22/189=過信の是正)。
- **🔴 だが zone 不一致 19.25→22.99%(悪化)= より良い物差しが新クラスタ2つを露呈**(method §4 = 物差し改善が次の FN を炙る):
  帰属(59・`adjudication.json` version `M0-Z-O-iter2`)= **substrate 0 / compiler 38 / oracle 14 / ambiguous 7**。
  1. **compiler 38 = 暗黙のゾーン移動 FN(iter3 ルール種)**: 分類器は**明示的なゾーン語/動詞**のみ拾い、`draw`→hand /
     `discard`→graveyard / `dies`→graveyard / **bare `target permanent` の bounce/play**→battlefield を取りこぼす(Ponder/Thoughtseize/
     Windfall/Boomerang/Aetherize/Solemn/Meathook 他)。これらは真のゾーン移動=分類器 FN。cross 照応の残差(Syphon Mind/Orcish Bowmasters の
     `discard`→他者 graveyard)も同根。
  2. **oracle 14 = v2 prompt の過剰補正2(prompt v3 種)**: (a)**静的 read を battlefield 化**(`creatures you control get +1/+1`=Gaea's Anthem /
     `you control enchanted creature`=Control Magic / land 計数=Land Tax)。**E-ZONE-REF 定義裁定(下記)で非参照=物差し過剰**。
     (b)**recipient-scope の脱落**(`deals damage to each opponent`=Impact Tremors 等で v2 の「recipient は subject scope でない」行が過剰に効き、
     対象プレイヤー each-opponent/each-player/you を物差しが落とした)。E-PLAYER-SCOPE は**対象プレイヤーも参照に含む**=prompt v3 で是正。
  3. **ambiguous 7 = owner 境界**(Puppeteer=ゾーン由来 owner floor / Urza's Saga=you-control ownership / Brainstealer・Dauthi・Kefka・
     Laughing Jasper・Ragavan=`an opponent owns` の owner scope 境界=分類器の owner scope は名詞限定の設計)。
  - **substrate=0 維持 = 5軸モデルは健全**(露呈したのは軸の欠落でなく分類器 FN と物差し過剰補正)。

##### iter2-b ESO 境界裁定: E-ZONE-REF = 移動/探索志向(静的 read は非参照)(2026-06-24・Fable)
oracle 14(a)の静的 read 過剰を解くため E-ZONE-REF の射程を確定する。**Slice3 が存在する目的**は
「プレイヤー別ゾーン(S-ZONES)・ダミー相手(S5)・クロスプレイヤーを構造として必要化する read/write を測る」こと(本節冒頭)。
ゆえに **E-ZONE-REF が数えるのは「ゾーン間の移動・探索・明示的なゾーン操作」**であって、戦場に在るパーマネントへの**静的参照**
(`creatures you control get +X`・`you control enchanted creature`・land の計数)は**ゾーン参照に数えない**(移動を起こさない=構造需要を生まない)。
- 帰結: Gaea's Anthem / Control Magic / Land Tax / Fierce Guardianship の battlefield は**物差し過剰**(分類器・gold が正で zones=[] か非 battlefield)。
  `review.zone-coverage` の Gaea's Anthem(zones=[])/Control Magic(zones=[])が本裁定を CR-truth として既に固定済。prompt v3 へ「静的 P/T・コントロール・計数は zone 参照でない」を明記。
- **対比**: `draw`/`discard`/`dies`/`destroy`/`exile`/`bounce`/`token 生成`は**移動**ゆえ E-ZONE-REF に数える(= compiler 38 が分類器 FN たる所以)。
- **trust(iter2-b 後)**: E-ZONE-CROSS = **検証済方向**(不一致 1.60%・残差は暗黙 discard 照応=compiler)。E-OWNER/E-CONTROLLER = **改善**(2.67%・残差 ambiguous owner 境界)。
  E-PLAYER-SCOPE = **改善方向**(10.16%・残差は recipient-scope の物差し過剰=prompt v3)。E-ZONE-REF(zones)= **未収束**(22.99%・暗黙移動 compiler 38 = iter3 ルール種が最大の残差)。
- **収束判定**: **Slice3 は未収束**(zone 22.99% ≫ 5%)。だが残差は綺麗に二分(compiler=暗黙移動・iter3 ルール / oracle=過剰補正2・prompt v3)。substrate=0。
  **次マイルストーン = iter3**(flip-flop: ルール半=`zoneClassify` に暗黙移動 draw/discard/dies/bare-permanent-bounce を追加 → churn 再算出 / 物差し半=prompt v3 で静的 read 除外・recipient-scope 算入)。**0.74%/低 churn を収束と読まない**(method §4)。

##### iter3-a 暗黙移動マッピング(独立物差しで較正・2026-06-24・Fable)
compiler 38 を閉じる前に、各移動動詞が**どのゾーンへ写るか**を独立物差し(=収束先)の予測で較正して確定した
(オラクルが既に当該ゾーンを予測=分類器を寄せれば oracleOnly が減る=収束)。
- **`draw … card(s)` → `library` + `hand`**(top of library を hand へ移す=両ゾーン write。Brainstorm/Ponder/Gitaxian Probe で物差し一致)。
- **`discard` → `hand` + `graveyard`**(hand→graveyard。Thoughtseize/Syphon Mind)。
- **`dies` / `put into a graveyard from the battlefield` → `battlefield` + `graveyard`**(battlefield→graveyard。Bastion/Meathook/Massacre Wurm)。
- **bare `target permanent` の bounce → `battlefield`**(`return target permanent to … (hand|owner)` の bare permanent。iter2-a は permanent 型限定で取りこぼし。Boomerang/Aetherize)。
- **クロス連動**: discard/draw の**主語が非you**(`each (other) player` / `target player` / `(an|each) opponent`)なら、含意される hand/graveyard/library は**他者ゾーン=cross**(Syphon Mind/Windfall/Thoughtseize)。
- **🚫 `sacrifice` は除外**: 物差しは `sacrifice` を graveyard に写さない(Evolving Wilds/フェッチランド全て battlefield+library・graveyard なし)。
  かつ sacrifice 系は battlefield/library を明示語(`onto the battlefield`/`your library`)で既に拾うため**新 FN でない**。追加すれば逆に classifierOnly を生む=収束を損なう。**移動だが本反復では数えない**(E-ZONE-REF 既知の保守境界)。
- gold = `review.zone-coverage` を本マッピングへ更新(Syphon Mind/Thoughtseize/Windfall/Boomerang)+ 新規(Divination=draw / Faithless Looting=draw+discard / Mind Rot=discard-cross / Doomed Traveler=dies)。

##### iter3-a 結果(ルール半=暗黙移動追加・物差し凍結・2026-06-24・監査合格)
分類器に暗黙移動(draw/discard/dies/bare-permanent bounce)+ 非you 主語の draw/discard cross を追加(物差し v2 凍結)。
- **churn(iter2-a→iter3-a)= 3,559/17,491 = 20.35%**(hand +2,310・library +2,282・graveyard +1,338・battlefield +334。crossPlayerCards 675→1,067)。
  独立物差しへ収束する churn(下記)。**過剰発火 0**(コーパス全走査=否定文脈 `can't be discarded`/`doesn't die` 等で誤発火 0・`draw … card` で draw step を除外)。
- **独立物差し再差分(v2 凍結のまま分類器のみ更新)**: **zone 不一致 22.99→10.70%**・**crossPlayer 1.60→0.00%(完全一致)**・ownership 2.67%(据置)。
  compiler 帰属 38→17(暗黙移動 FN を回収)。**残差はほぼ完全に oracle 側**: zoneClassifierOnly わずか 2・**zoneOracleOnly 18 = v2 物差しの静的 read battlefield 過剰**(Gaea's Anthem/Control Magic/Land Tax/Fierce Guardianship 他)・**scopeClassifierOnly 14 = v2 物差しの recipient-scope 脱落**。**両者とも iter3-b prompt v3 で是正**。
- gold `review.zone-coverage` **29/29**。機械4点 Fable 独立緑(lint/tsc/vitest 849/build)+ review 全緑。`hasImplicitYou`(imperative draw/discard・token 生成トリガ→you scope)は gold(Divination/Doomed Traveler の `you`)が駆動した正当な追加。

##### iter3 CR ゾーン遷移真理テーブル(決定論的・総合ルール正本・2026-06-24・Fable)
**手法改訂(method §3「CR を一次の決定論的権威に」)の適用**。暗黙ゾーン移動は LLM-oracle で「予測」する対象でなく、
総合ルール `rule/Magic_The_Gathering_Comprehensive_Rules.txt` が**一意に定義**する。下表を分類器・gold・オラクル prompt の三者すべての**正本**とする。

| 動作 | CR 条文 | 触れるゾーン(E-ZONE-REF) | 備考 |
|---|---|---|---|
| draw | **121.1** | `library` + `hand` | top of library を hand へ |
| discard | **701.9a** | `hand` + `graveyard` | hand → **owner's** graveyard |
| dies | **700.4** | `battlefield` + `graveyard` | =「is put into a graveyard from the battlefield」(creature 限定) |
| **destroy** | **701.8a** | `battlefield` + `graveyard` | battlefield → **owner's** graveyard |
| **sacrifice** | **701.21a** | `battlefield` + `graveyard` | battlefield → **owner's** graveyard |
| exile | 406 | `exile`(+ 起点ゾーン) | 「exile」は語が明示=既出 |
| mill | 701.13a | `library` + `graveyard` | top of library → graveyard |
| put onto the battlefield | 303/608 | `battlefield`(+ 起点) | 明示句で既出 |

- **🔴 iter3-a の誤りを CR が正す**: iter3-a は「sacrifice は graveyard に写さない/destroy は battlefield のみ」とした(オラクルの揺れと分類器都合に
  合わせた誤収束)。**CR 701.21a/701.8a は destroy も sacrifice も `battlefield → owner's graveyard`** と定義=**両者とも `graveyard` を取りこぼした FN**。
  iter3-b で分類器に `sacrifice`→`battlefield`+`graveyard`、`destroy`→`graveyard` 追加を CR 準拠として実装する。
- **owner's graveyard のクロス含意**: destroy/sacrifice/discard の行き先は**owner の**墓地(108.4)。owner=あなたなら非cross、owner=相手ならcross。
  ただしテキストが owner を establish しない無制限 target(`destroy target creature`)では cross は条件付き=**保守的に false**(established 非you のみ true)。
  これは E-ZONE-CROSS の解釈的部分(zone-SET は決定論的に確定、cross の帰属は文の establish 次第)。
- **gold(CR-truth)**: Doom Blade(destroy→`battlefield`+`graveyard`)/ Fling(sacrifice→`battlefield`+`graveyard`)を追加し CR 準拠を固定。
- **オラクル prompt v4**: 上表の CR 写像を**明示**(v3.1/v3.2 の「destroy/sacrifice は graveyard を推論しない」は **CR 違反ゆえ撤回**)。
  これでオラクルは決定論的軸で CR と一致し、その価値は**認識**(この prose が sacrifice/draw を発動しているか)と解釈的軸に限定される。

##### iter3-b 結果(CR 基盤化・分類器+gold+prompt を CR へ同時 anchor・2026-06-24・監査合格)
flip-flop の射程外(method §3:外部真理 CR が在るため分類器とオラクル prompt を同時に CR へ寄せてよい=交絡しない)。
- **CR 修正の churn(iter3-a→iter3-b)= 2,074/17,491 = 11.86%**(graveyard **+1,945**・battlefield +698)= **分類器が全 destroy/sacrifice で
  owner's graveyard を欠落していた規模**(CR 701.8a/701.21a 違反の実数)。cardsWithZones 11,997→12,372。
- **独立物差し差分(オラクル v4・CR 写像明示・promptHash 別)**: **zone 6.95%**(CR 誤り v3 初稿の 25.67% から解消)/ **crossPlayer 2.67%** /
  ownership 2.67% / **playerScope 8.02%** / **unverifiable 5.29%**(uncertain 健全)。discrepancies **32**。帰属(`adjudication.json` M0-Z-O-iter3)=
  **substrate 0 / compiler 18 / oracle 5 / ambiguous 9**。**決定論的混乱が消え、残差は解釈的・小粒**:compiler=小さな認識 FN(no-target bounce=Aetherize /
  return spell→stack=Sink・Hullbreaker / scry→library / 相手の dies→相手墓地 cross)/ oracle=destroy/sacrifice の battlefield 認識漏れ(Blasphemous Act 等で**分類器が CR 正**)/ ambiguous=owner 境界。
- 機械4点 Fable 独立緑(lint/tsc/**vitest 851**/build)+ review.zone-coverage **31/31**(Doom Blade/Fling CR-pin)+ review.zone-oracle 緑。
- **trust(iter3-b 後)**: E-ZONE-REF = **CR 接地で大幅収束**(6.95%・残差は認識 FN)。E-ZONE-CROSS = 良好(2.67%・残差は相手 dies の cross 照応)。
  E-OWNER/E-CONTROLLER = 良好(2.67%・残差 ambiguous owner)。E-PLAYER-SCOPE = 改善(8.02%・残差 recipient/owner-scope 認識)。
- **収束読み**: zone 6.95%/scope 8.02% は 5% 閾値に**接近(未達)**。だが**最大の成果は手法の是正** = 決定論的軸を CR 真理テーブルへ移し、LLM-oracle を認識・解釈に限定したこと(本件以前は決定論的問いを物差しで予測し誤収束・3回の prompt 再走を浪費)。残差は認識精度(compiler 小)と owner 境界(ambiguous)で、いずれも substrate を脅かさない。**Slice3 は CR 接地で実質収束方向**。次の小改善 = 認識 FN(no-target bounce/return-spell-stack/相手 dies cross)。**Slice4(タイミング/SBA)前進可**。CR 準拠監査 = `research/cr-conformance-audit.md`(runtime `trigger.death` の CR700.4 違反を別タスク化)。

---

## スライス4: タイミング + SBA(CR500 / CR704)

> 開始 2026-06-24。Slice1(盤面がどうあるか)・Slice2(何が起きたか)・Slice3(どのゾーン/誰のものか)が
> 実質収束したのを受け、本スライスは「**いつ**起きるか」=ターン構造のタイミング(フェイズ/ステップ/juncture)と
> **状況起因処理(SBA, CR704)**へ移る。**本スライスでも runtime コードは書かない**(S-TURN は M-CONTRACT 凍結後)。
> 確定させるのは「エンジンが持つべきタイミング/SBA state の最小十分タクソノミ」と「誘発/キャストがどの juncture・
> どのタイミング窓を読むか(認識軸)」。

### 設計の核 — 決定論的軸と解釈的軸の弁別(method §3・2026-06-24 改訂を厳守)

Slice4 の問いは2種に截然と分かれる。**混同すると物差し(LLM)で決定論的答えを「予測」しようとして浪費・誤収束する**
(Slice3 iter3-b の precedent)。

- **決定論的(rules-defined)= CR が一意に答える** → **LLM で予測しない。CR 真理テーブルで固定する**:
  - **ターン構造**(CR500): フェイズ/ステップの列・順序・各 juncture が `at the beginning of` 誘発を購読する事実。
  - **SBA 条件**(CR704.5): どの状態でどの SBA が発火するか(0ライフ敗北・タフネス≤0・忠誠0・レジェンド・ルール…)。
- **解釈的(recognition)= カード文の認識** → **独立オラクルで測る軸**:
  - **誘発 juncture の認識**: `at the beginning of [your/each] <step>` / `during <step>` がどのステップを指すか(Slice2 の
    粗い `phase` 族を**特定ステップへ細分化**)・誰のターンの juncture か。
  - **キャスト/起動のタイミング制限の認識**: `only as a sorcery` / `Flash` / `only during your turn` / `only during combat` /
    `only once each turn` 等のタイミング窓(CR307/601/602.5)。

**∴ 計測対象(分類器+オラクル)の中心は「タイミング認識」**。SBA は CR 真理テーブル + コーパス改変需要で固定し
**カード文から予測しない**(SBA の発火は engine 内部処理であってカード文の認識対象でない)。

### iter3 CR ターン構造真理テーブル(決定論的・CR500 正本・2026-06-24・Fable)

CR500.1(5フェイズ)/ 501.1・506・512(ステップ)/ **500.6(`at the beginning of` 誘発の購読)** を正本とし、
分類器・gold・オラクル prompt の三者すべての**正本**とする。`TimingStep` の値域はこの表から導出する。

| フェイズ(CR) | ステップ(CR) | `TimingStep` | 代表的な juncture 言及 |
|---|---|---|---|
| beginning(501) | untap(502) | `untap` | "during [each player's] untap step"(Seedborn Muse・no-priority step だが効果は掛かる) |
| beginning(501) | upkeep(503) | `upkeep` | "at the beginning of [your/each] upkeep"(**最頻**) |
| beginning(501) | draw(504) | `draw` | "at the beginning of [each player's] draw step" |
| precombat main(505) | —(ステップなし) | `main-precombat` | "at the beginning of your precombat main phase" |
| combat(506) | begin combat(507) | `begin-combat` | "at the beginning of combat on your turn" |
| combat(506) | declare attackers(508) | `declare-attackers` | "at the beginning of the declare attackers step"(希少) |
| combat(506) | declare blockers(509) | `declare-blockers` | 同上(希少) |
| combat(506) | combat damage(510) | —(**juncture にしない**) | **`deals/dealt combat damage` は Slice2 `damage` イベント**(CR510 ステップの `at the beginning of` 誘発はほぼ存在しない)。combat damage ≠ combat phase(Slice2 prompt と同根) |
| combat(506) | end of combat(511) | `end-combat` | "at the beginning of the end of combat step" |
| postcombat main(505) | —(ステップなし) | `main-postcombat` | "at the beginning of your postcombat main phase" |
| ending(512) | end step(513) | `end-step` | "at the beginning of [your/each] end step"(高頻度) |
| ending(512) | cleanup(514) | `cleanup` | "at the beginning of [the/each] cleanup step"(希少・優先権なし) |
| —(汎用) | — | `turn` | "at the beginning of [your/each] turn"(特定ステップ非明示) |
| —(逃さない箱) | — | `other` | juncture らしいが上記外 |

- **🔴 combat-damage を juncture にしない理由**: カード文の `deals/dealt combat damage` 誘発は**イベント駆動**(Slice2
  `E-EV-DAMAGE`)であって「combat damage **ステップ**の開始」誘発ではない。これを juncture に数えると Slice2 の
  `damage` 族と二重計上され、`combat damage ≠ combat phase`(Slice2 §7.2 prompt)の規律を破る。Sword of Feast and Famine
  (`Whenever equipped creature deals combat damage to a player …`)は **juncture なし**=本スライスの代表的負例。
- **owner 不在の delayed/extra juncture**: 追加フェイズ(CR500.8-500.10)・延期誘発(`at the beginning of the next …`)は
  **概念登録のみ**(本スライスは「直近のターン構造 juncture」の認識精度を測る)。

### SBA 真理テーブル(決定論的・CR704.5 正本・2026-06-24・Fable)

SBA は engine が**優先権取得のたびに**(CR704.3)決定論的にチェックする固定リスト。**カード文から「予測」しない**。
本スライスはこのチェックリストを ESO に固定し、コーパスからは **SBA の発火を改変するカードの需要**だけを数える。

| SBA | CR | 条件 → 結果 | runtime read/write(将来 S-SBA) |
|---|---|---|---|
| 敗北(0ライフ) | 704.5a | life ≤ 0 → そのプレイヤー敗北 | read player.life |
| 敗北(空ライブラリドロー) | 704.5b | 空ライブラリから引いた → 敗北 | read drawFromEmpty フラグ |
| 敗北(毒10) | 704.5c | poison ≥ 10 → 敗北 | read player.poison |
| トークン消滅 | 704.5d | token が battlefield 外 → 消滅 | read object.isToken + zone |
| コピー消滅 | 704.5e | spell/card コピーが正規ゾーン外 → 消滅 | read object.isCopy + zone |
| タフネス0死 | 704.5f | creature toughness ≤ 0 → owner's graveyard(**再生不可**) | read 有効 toughness(Slice1 層適用後) |
| 致死ダメージ | 704.5g | damage ≥ toughness(>0)→ 破壊(再生可) | read damage marked + 有効 toughness |
| 接死ダメージ | 704.5h | deathtouch 源のダメージ → 破壊 | read damage source deathtouch |
| 忠誠0 | 704.5i | planeswalker loyalty 0 → owner's graveyard | read loyalty counter |
| レジェンド・ルール | 704.5j | 同名 legendary 複数 → 1つ残し残りを墓地 | read legendary + name + controller |
| ワールド・ルール | 704.5k | world 複数 → 最新以外を墓地 | read supertype world + timestamp |
| オーラ不正付着 | 704.5m | Aura が不正/未付着 → owner's graveyard | read attachment 合法性 |
| 装備/城砦の剥離 | 704.5n | Equipment/Fortification が不正付着 → 外れる | read attachment |
| +1/+1 と -1/-1 相殺 | 704.5q | 両カウンター共存 → N 個ずつ除去 | write counters |
| カウンター上限 | 704.5r | 上限超過カウンター → 除去 | write counters |
| Saga 生け贄 | 704.5s | lore ≥ 最終章 → controller が生け贄 | read lore counter(Slice1 既出) |

> **本スライスで初期非対応(既知欠落・§34.5)**: 704.5k(world)・704.5t-z(dungeon/space sculptor/battle/Role/speed)等の
> 稀少 SBA は概念登録のみ。EDH 頭被覆に効く 704.5a/c/f/g/i/j/q/s を最小集合とする。

### ESO エントリ

#### E-PHASE-STEP: ターン構造(フェイズ/ステップ列)
- **CR根拠**: 500.1(5フェイズ)、501.1/506/512(ステップ分解)、500.6(`at the beginning of` 誘発)、500.12(イベントはステップ間で起きない)
- **コーパス需要**: 全カードが間接的に依存(基点)。`at the beginning of` ≈ 1,677(Slice2 E-EV-PHASE の coarse 計数)を本スライスがステップ別に細分化
- **state read/write**: write = `currentPhase` / `currentStep` / `activePlayer`(将来 `src/engine/turn.ts`)。**TimingStep 値域 = 上記真理テーブル**
- **検証手段**: CR500 真理テーブル(決定論的・LLM 非適用)
- **trust**: 検証済(CR 列挙=一意。物差し不要)
- **既知欠落**: 追加フェイズ/ステップ(500.8-500.10)・スキップ(500.11)・延期誘発は概念登録のみ

#### E-JUNCTURE: 誘発 juncture(どのステップに掛かるか)= 解釈的・オラクル測定軸
- **CR根拠**: 500.6(juncture 誘発)、603.2(`At the beginning of` の誘発型能力)
- **コーパス需要**: `timing-coverage` 抽出が `TimingStep` 別に頻度・代表カードを埋める(本スライスで確定)
- **state read/write**: read = `currentStep` + `activePlayer`。Slice2 `E-EV-PHASE` を**特定ステップへ細分化**(`phase` 族 → upkeep/end-step/begin-combat/…)
- **値域**: `TimingStep[]`(真理テーブル)+ `junctureScope`(誰のターンか= Slice2 `ObserverScope` 再利用: self/opponent/any/unknown)
- **検証手段**: ゴールド `review.timing-coverage` + LLM-oracle 盲予測(別主体・§9)。**`deals combat damage` は juncture でない**(Slice2 damage)を敵対的に固定
- **trust**: 未検証(下面抽出+物差し前)
- **既知欠落**: cumulative upkeep 等**キーワードが juncture を含意するが本文が注釈のみ**のケース(Mystic Remora)は reminder 除去で取りこぼす=keyword→juncture 写像は概念登録のみ。延期/追加 combat の juncture も近似

#### E-CAST-TIMING: キャスト/起動のタイミング制限 = 解釈的・オラクル測定軸
- **CR根拠**: 307(sorcery のタイミング)、601.3e/602.5(起動の制限)、702.8(Flash)、117.1(優先権)
- **コーパス需要**: `Flash` / `only as a sorcery` / `only during your turn` / `only once each turn` / `as though … flash` を `timing-coverage` が計数
- **state read/write**: read = `currentStep`(main かつ stack 空か)+ `activePlayer`(自分のターンか)+ 当該起動の今ターン使用回数。将来 `GameCommand` の適法性ガード
- **値域**: `CastTiming[]` = `sorcery-speed | flash | combat-only | your-turn-only | once-per-turn | none`
- **検証手段**: ゴールド `review.timing-coverage`(`only as a sorcery`=sorcery-speed と `Flash`=flash を弁別)+ LLM-oracle
- **trust**: 未検証
- **既知欠落**: 他者へタイミング制限を**課す**静的効果(Teferi, Time Raveler の `each opponent can cast spells only any time they could cast a sorcery` / `cast as though they had flash` の付与)は recognition 上 sorcery-speed/flash として拾うが、**主体(自分/他者)の弁別は近似**(本スライスは「制限語の認識」に限定・誰に課すかの精密化は後続)

#### E-SBA: 状況起因処理(CR704.5 チェックリスト)= 決定論的
- **CR根拠**: 704.3(優先権取得ごとにチェック)、704.5a-z(条件リスト)、704.7(再チェック)
- **コーパス需要**: SBA **チェック自体**は全ゲーム共通(カード非依存)。コーパスから数えるのは **SBA 改変カードの需要**=
  `indestructible`(致死/タフネス0の結果を変える)・`poison/infect/toxic`(704.5c)・`regenerate`(704.5g/h 置換)・
  `can't lose the game` / `can't win the game`(704.5a/c の無効化)・`loses the game` / `wins the game`(明示敗北/勝利)
- **state read/write**: read = 有効特性(Slice1 層適用後の toughness/loyalty)+ damage marked + counters + life/poison + 合法付着。write = owner's graveyard 移動 / カウンター除去
- **検証手段**: CR704.5 真理テーブル(決定論的)。改変カードの計数のみ `timing-coverage`(`review.timing-coverage` の SBA-modifier 区分)
- **trust**: 検証済(CR 列挙)。改変需要のみ未計測→本スライスで確定
- **既知欠落**: 704.5k/t-z(world/dungeon/battle/Role/speed/space sculptor)は初期非対応(§34.5)。SBA の APNAP 選択順(704.5j/k の同時複数)は S-SBA 実装時に決定

### 抽出タクソノミ + 出力スキーマ(`timing-coverage` への契約)
`scripts/lib/timingClassify.ts` の純関数 `classifyCardTiming(def): CardTimingSummary` が下記を満たす(GameState 非依存・決定的・scripts 配下):
- `junctures: TimingStep[]` — 誘発が掛かるステップ(昇順・重複排除)。juncture 言及の無いカードは空配列。**`deals/dealt combat damage` は数えない**(Slice2 damage)
- `junctureScope: ObserverScope[]` — **juncture を持つ行から**導く「誰のターンか」(`your`→self / `each player`→any / `each other player`/`each opponent`→opponent)。juncture 無しなら空(ETB 等の非 juncture 行の観測者は数えない)
- `castTiming: CastTiming[]` — キャスト/起動のタイミング制限(昇順・重複排除)。制限語が無ければ `[none]`(空配列でなく明示 none=「制限なし」を表す)
- 抽出は英語 `oracleText` 正本のみ。注釈文(括弧)・引用能力内のネストは当該カード自身と区別(Slice1〜3 の reminder/quote 除去パターンを踏襲)。ただし **Flash・cumulative upkeep 等キーワード行**は除去後も残る語(`Flash` / `Cumulative upkeep`)から拾う(既知欠落の cumulative upkeep を除く)
- `timing-coverage` レポートは TimingStep 別需要・junctureScope 分布・CastTiming 別頻度・**SBA-modifier 区分の計数**(indestructible/poison/regenerate/can't-lose 等)・複数 juncture 保有数・mappingFailures(=0必須)・churn(前反復比)を出す(`zone-coverage` と同形式)

### 収束メモ(本スライスの進捗)
- [x] 下面抽出(`timing-coverage`)実行 → 各軸の「コーパス需要」を数値で確定(2026-06-25 iter1)
- [x] ゴールド `review.timing-coverage`(16)+ `review.timing-oracle` 全件 pass + 機械チェック4点緑(Fable 独立採点)
- [x] LLM-oracle 盲予測(別主体・§9)で juncture/castTiming/scope に物差しを当てる(相関エラー遮断)= iter1
- [x] churn 初算出(0.84%)。**低 churn を収束と読まない**(method §4・本反復は baseline 確立)
- 物差し契約 = `docs/oracle-harness.md` §9(`TimingFacts` schema・3軸比較・KPI)

#### iter1 抽出結果ベースライン(2026-06-25・監査合格)
機械チェック4点緑(Fable 独立再実行 = lint/tsc/**vitest 896**/build)+ `review.timing-coverage` 16 + `review.timing-oracle` + 全 896 緑。mappingFailures 0。churn 0.84%。
- **juncture 需要頭** = end-step 413 / upkeep 397 / begin-combat 211 / untap 102。希少 = draw 16・declare-attackers 8・main-postcombat 8・declare-blockers 2・end-combat 1。cleanup/turn 0。
  **🔴 `main-precombat 0` と `other 74` は分類器 FN の徴候**(`first main phase`・`each combat` が `other` へ落ちている。下記オラクルが露呈)。
- **castTiming 分布**: none 16,526 / flash 484 / sorcery-speed 386 / once-per-turn 66 / your-turn-only 34 / combat-only 7。**flash/sorcery-speed の弁別軸は corpus で実在**。
- **junctureScope**: self 918 圧倒 / unknown 151 / any 125 / opponent 34。controlled-set 0(juncture は誰のターンか=permanent スコープでない・健全)。
- **SBA-modifier 需要(E-SBA・決定論的計数)**: indestructible 393 / poison 121 / regenerate 49 / losesGame 26 / cantLose 8 / cantWin 7 / winsGame 0。EDH 頭は indestructible(致死/タフネス0 SBA を改変)・poison(704.5c)。

#### オラクル iter1(独立物差し=別主体盲予測・2026-06-25・監査合格)
契約 = `docs/oracle-harness.md` §9。別主体(gpt-5.5 clean-room・promptHash 0ec68246)が oracleText のみから3軸(junctures/junctureScope/castTiming)を盲予測 → `timingClassify` と3軸独立集合差(`scripts/lib/timingOracleHarness.ts`)。sample 196(gold16+head90+cast40+scope30+tail20)、compared 195。正本 = `research/timing-oracle/{report.md,adjudication.json}`。
- **KPI**: juncture 不一致 **14.87%** / junctureScope 不一致 **1.54%** / castTiming 不一致 **3.08%** / 検証不能 **1.53%**(uncertain 3=健全に hedge)。discrepancies 37(scored 34 + uncertain 3)。
- **物差し校正(gold・meta-KPI)= 支持全ステップで precision/recall 100%**(upkeep 4 / untap 1 / draw 1 / end-step 1 / begin-combat 1)。→ オラクルは検証済部分集合で信頼でき、**非ゴールドの不一致は信号として credible**。
- **帰属(34・`adjudication.json` M0-T-O-iter1)= substrate 0 / compiler 24 / oracle 2 / ambiguous 8**。**🟢 substrate=0 = Slice4 の3軸 ESO モデル(TimingStep/CastTiming/ObserverScope)は独立物差しでも健全**(軸の欠落なし)。
- **裁定の系統的発見(compiler 24 = iter2 ルール種)**:
  1. **begin-combat FN 6**(`at the beginning of (each|the|that) combat` を隣接限定 regex が `other` へ落とす: Moraug/Full Throttle/Odric/Sting/Zopandrel/Unnatural Growth)。
  2. **main-phase FN 8**(`first/second main phase`・`each of your main phases` を main-precombat/postcombat へ写せず `other`: Black Market/Party Thrasher/Hulking Raptor/Carpet of Flowers 他)。**`main-precombat 0` の正体**。
  3. **untap FP 5**(否定 `doesn't/don't untap during ... untap step`(静的制限)を untap juncture と誤発火: Mana Vault/Basalt Monolith/Junk Winder/Vorinclex/Tamiyo)。Seedborn Muse の肯定 untap とは区別。
  4. **cast-clause juncture FP 2**(Savage Beating の `Cast … only during combat on your turn`=cast 制限 / Misleading Signpost の `When … during the declare attackers step`=enters 条件 を juncture と誤認)。
  5. **castTiming FN/FP 3**(sorcery-speed level FN: Innkeeper's Talent/Dazzling Theater / flash FP: Waterlogged Teachings)。
- **oracle 2**(物差し過剰): Rite of the Raging Storm(**引用トークン能力**の end-step をカード juncture と誤帰属=Slice2 quoted-trigger 除外と同根・**分類器が CR 正**)/ Forge Anew(equip への instant 許可付与を your-turn-only 制限と誤読)。
- **ambiguous 8**(ESO 境界=Fable 裁定保留): (a)**遅延誘発 end-step** 4(`at the beginning of the next end step`=CR603.7 遅延=E-JUNCTURE 既知欠落: Whip of Erebos/Lagomos/Urabrask's Forge/Rionya)(b)**scope 照応** 3(`that turn`→self / 所有者なし `the end step`→any: Final Fortune/Phelia/Underworld Breach)(c)**他者へ課す cast-timing** 1(Teferi, Time Raveler=相手に sorcery-speed を課す・主体弁別が E-CAST-TIMING 既知欠落)。
- **物差し故障の兆候なし**: 検証不能率 1.53%(Slice1/3 iter1 の 0% 過信と違い適切に hedge)。gold 校正 100%。
- **trust 更新**: E-PHASE-STEP = **検証済**(CR500 決定論)。E-SBA = **検証済**(CR704.5 決定論・改変需要計数済)。E-JUNCTURE = **不一致**(14.87%・残差は分類器認識 FN/FP=iter2 ルール / オラクル credible)。E-CAST-TIMING = **不一致**(3.08%・sorcery-speed level FN + flash FP + 境界)。junctureScope = **ほぼ検証済**(1.54%・残差照応)。**substrate 健全だが juncture/castTiming の trust は未収束**=Slice4 継続(iter2)。
- **収束読み**: Slice2/3 と同型に「分類器 FN/FP(compiler 24)+ 物差し過剰(oracle 2)+ ESO 境界(ambiguous 8)」へ綺麗に三分。substrate=0 で**モデルは正しい**。**次マイルストーン = iter2**(flip-flop ルール半: `timingClassify` の begin-combat/main-phase/untap-否定/cast-clause を CR500 準拠へ拡張 → churn 再算出 / 物差し半: 必要なら prompt で quoted-token と permission-grant の除外を明記)。**14.87% を未収束として凍結保留**(method §4)。Slice1〜4 一巡が揃ったため、iter2 収束後に **M-CONTRACT 凍結ゲート**(§5 の7条件)の本格判定へ。

##### iter2-a CR juncture 認識裁定(分類器拡張・物差し凍結・2026-06-25・Fable)
iter1 の compiler 24 を CR500 接地で閉じる(flip-flop ルール半=`predictions.json`/`sample.json` を**1バイトも触らず**分類器のみ更新)。
各裁定は CR の決定論的写像で、分類器・gold を同時に CR へ anchor する(method §3=外部真理ゆえ交絡しない)。

| iter1 不一致 | CR 写像 | iter2-a 分類器規則 | gold pin |
|---|---|---|---|
| begin-combat FN 6 | CR507(begin combat step)。`each/the/that combat` も begin-combat | `at the beginning of (each\|the\|that) combat` → begin-combat(隣接限定を撤回)。`each combat`→scope any | Full Throttle / Zopandrel |
| main-phase FN 8 | **CR505.1**(precombat=first / postcombat=second main phase) | `first main phase`→main-precombat / `second main phase`→main-postcombat / `each of (your) main phases`→両方 | Black Market Connections / Lost Monarch of Ifnir / Carpet of Flowers |
| untap FP 5 | CR502(untap step は turn-based)。**否定 untap は juncture でない** | `(doesn't\|don't\|do not\|won't\|can't\|cannot) untap during … untap step` を untap juncture から除外(Seedborn Muse の肯定 untap は維持) | Mana Vault(draw+upkeep のみ・untap 否定を除外)/ Basalt Monolith |
| cast-clause FP 2 | juncture は誘発(CR603.2)であって cast/enters 条件でない | `Cast/Activate … only during <combat\|your turn>` と `When … enters during the … step` を juncture 検出から除外 → 前者は castTiming へ | Savage Beating / Misleading Signpost |
| flash FP 1 | flash 付与(CR702.8)≠ 検索フィルタ名詞 | `cards? with flash`(名詞フィルタ)を flash castTiming から除外 | Waterlogged Teachings |

- **castTiming 追補(cast-clause 由来)**: `only during combat`→combat-only / `only during your turn` または `during combat on your turn`→`your-turn-only`(+`combat-only`)。
- **iter2-a で触れない(裁定で据え置き)**:
  - **遅延誘発 end-step**(CR603.7 `at the beginning of the next end step`=Whip/Lagomos 他)= **E-JUNCTURE 既知欠落のまま**(「次の <step>」の所有者解決が未確定。iter2-b 以降で判断)。
  - **reminder 埋め込み `as a sorcery`**(Room 機構=Dazzling Theater / cumulative upkeep / Class level)= reminder 除去で消える=**keyword→timing 写像の既知欠落**(物差しは reminder を読むため不一致が残るが分類器は据え置き)。
  - **scope 照応**(`that turn`/所有者なし `the end step`)= junctureScope 既知欠落(1.54% 微小)。
- **E-CAST-TIMING スコープ確定(iter2-a ESO 裁定)**: **castTiming はそのオブジェクト自身の唱える/起動するタイミング制限に限る**。
  他者へ課す制限(Teferi, Time Raveler の `each opponent can cast … only … sorcery`)は**別事象=対象外**(分類器は none で正)。
  → iter1 ambiguous の Teferi は **oracle 過剰**へ再帰属(物差し半 iter2-b の prompt で除外明記)。同様に quoted-token(Rite)・permission-grant(Forge Anew)も oracle=物差し半対象。
- **帰結**: iter2-a は **compiler の begin-combat6 + main-phase8 + untap-FP5 + cast-clause2 + flash1 = 22 を CR 接地で閉じる**見込み。
  残差 = 遅延 end-step(既知欠落)+ scope 照応 + 物差し過剰(oracle・iter2-b)。**churn 再算出 + 独立物差し(v1 凍結)再差分で juncture 不一致率の低下を確認**(0.84% 低 churn を収束と読まない・method §4)。

##### iter2-a 結果(ルール半=分類器 CR 拡張・物差し凍結・2026-06-25・監査合格)
flip-flop の前半。物差し(`sample.json`/`predictions.json`・promptHash **0ec68246** 不変=SHA-256 照合済)を**1バイトも触らず**、分類器
`scripts/lib/timingClassify.ts` の compiler 22 を CR500 接地で修正(Codex 実装・カード名ハードコード無し=全汎用パターン・否定 untap ガード/`first|second|each ... main phase`/`(each|the|that) combat`/cast-clause 除外/`cards with flash` 除外)。
- **churn(iter1→iter2-a)= 180/17,491 = 1.03%**(主に `other`→main-precombat/begin-combat への再分類。`main-precombat` **0→42**・mappingFailures 0)。
  **独立物差しへ収束する churn**: 同反復で独立オラクル不一致が後述どおり激減=「真の認識 FN/FP の是正」(method §4)。
- **独立物差し再差分(物差し凍結のまま分類器のみ更新)**: **juncture 不一致 14.87%→4.10%**・castTiming **3.08%→2.05%**(flash FP/cast-clause 解消)・
  junctureScope 1.54%**→2.05%**(Moraug の begin-combat を新検出した結果 `that combat` の scope 照応が露呈=想定内の次層残差)・検証不能 1.53%(据置)。discrepancies **37→16**。
- **帰属(scored 13・`adjudication.json` M0-T-O-iter2)= substrate 0 / compiler 0 / oracle 3 / ambiguous 10**。**🟢 compiler 0 = 分類器は CR500 準拠化が完了**(iter1 の認識 FN/FP 22 が全て解消)。
  - **ambiguous 10(ESO 境界・据え置き)**: 遅延 end-step 4(Whip/Lagomos/Urabrask/Rionya=CR603.7 既知欠落)/ scope 照応 4(Phelia/Moraug/Final Fortune/Underworld Breach=`that turn`/`the end step`)/ reminder 埋め込み `as a sorcery` 2(Innkeeper's Talent/Dazzling Theater=Room/Class・cumulative upkeep と同根)。
  - **oracle 3(物差し過剰・iter2-b prompt 対象)**: Rite of the Raging Storm(引用トークン能力)/ Teferi, Time Raveler(他者へ課す cast-timing=E-CAST-TIMING 裁定で対象外)/ Forge Anew(permission-grant 誤読)。**いずれも分類器が正**。
  - 検証不能 3(Necromancy/Mana Drain/The Scarab God=uncertain)。
- **敵対スポット監査(Fable 独立)**: gold `review.timing-coverage` **26**(iter2-a 新 CR-pin 10=begin-combat each/main first・second・each/untap 否定FP/cast-clause/flash-filter)+ `review.timing-oracle` 緑。機械4点 Fable 独立緑(lint/tsc/**vitest 906**/build)。
- **trust(iter2-a 後)**: E-JUNCTURE = **検証済方向**(4.10%・残差は遅延誘発の既知欠落と oracle quoted-token のみ=分類器 FN/FP 0)。
  E-CAST-TIMING = **改善**(2.05%・残差は reminder 埋め込みと imposed-on-others=oracle/既知欠落)。junctureScope = scope 照応(2.05%)が次層残差。E-PHASE-STEP/E-SBA = 検証済(CR 決定論)。
- **収束読み**: **juncture 4.10% は 5% 閾値を下回り、残差に分類器バグ(compiler)はゼロ**。残るは (a)ESO 既知欠落(遅延誘発/scope 照応/reminder=意図的スコープ外)(b)物差し過剰 3(iter2-b prompt v2 で quoted-token/imposed/permission を除外可)。**Slice4 は CR 接地で実質収束方向**(Slice3 と同じ着地)。
  **iter2-b(物差し半=prompt v2 で oracle 3 を是正)は任意の小改善**(残差の大半は ESO 既知欠落ゆえ prompt では動かない)。**Slice1〜4 一巡が CR 接地で揃った** → 次は **M-CONTRACT 凍結ゲート**(§5 の7条件:非LLM独立物差し・ゴールデン再生・parity=0 等)の本格判定トラックへ。**0.84%/1.03% 低 churn を単独で収束と読まない**(method §4)。
