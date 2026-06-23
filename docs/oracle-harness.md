# LLM-oracle 盲予測ハーネス(物差し契約)

> M0 モデリング・サイクルの**物差し(ruler)契約**。正本手法 = [`engine-design-method.md`](engine-design-method.md) §3-4、
> KPI = [`engine-spec.md`](engine-spec.md) §34.7、対象モデル = [`engine-state-ontology.md`](engine-state-ontology.md)。
>
> 本文書は **コードではない**。M0-1(有効特性 + 層オントロジー)の分類器(`scripts/lib/layerClassify.ts`)に、
> **Fable と相関しない独立 LLM ルーラー**を当てるための、サンプル抽出・盲予測 prompt・ファクト→層写像・差分/KPI 出力の契約を定める。
> スライス横断で再利用する(イベント語彙スライス等でもファクト schema を差し替えて流用)。

## 0. 設計原則(なぜこの形か)

- **相関エラーの遮断(最重要・method §82)**: オラクルは state モデル設計者 = Fable(Claude)と **別主体・別プロセス**で走らせる。
  予測は **Codex(= Claude と別モデル)が clean-room** で実行する。Fable は予測を兼ねない。
- **盲予測(method §84)**: エンジン出力・分類器出力を一切見せず、**英語 `oracleText` だけ**から挙動を予測する。
- **オントロジー非汚染**: オラクルへ **CR613・「層 / layer」という Fable のタクソノミを見せない**。
  代わりに**平易な挙動ファクト**を尋ね、ファクト→層の写像は**機械的・決定的**に行う(§3)。これで「オラクルは盲・比較は機械」が成立。
- **3状態(method §3 鉄則)**: 各ファクトに `uncertain` を許し、`検証不能` を緑へ混ぜない。検証不能率を安全KPIとして出す。

## 1. サンプル抽出(`scripts/oracle-sample.ts` / iter1 = 約200枚)

入力は2系統を `oracleId` で結合する(`report.json.cards` は `{oracleId,name,layers,cda}` のみで **`oracleText`/`edhrec_rank` を持たない**):
- `research/layer-coverage/report.json` — `cards`(per-card 層マップ)・`adjudication`(`{name,line,reason}`)。
- `research/scryfall-rules/2026-06-19/raw/...cards.json` — 各カードを `mapScryfallCardToCardDef` で写し `oracleId`/`oracleText`/`edhrecRank`/`name` を得る(`layer-coverage.ts` と同経路)。

**決定的・再現可能**に層化抽出する:

| 層化バケット | 件数(iter1) | 抽出規則 |
|---|---:|---|
| 頭(高頻度代表) | 100 | 層保有(`report.cards.layers.length>0`)を **snapshot の `edhrecRank` 昇順**(`oracleId` で結合)。rank 欠落は末尾、同値は `oracleId` 昇順で安定化 |
| 多層カード | 50 | `report.cards.layers.length>=2` を同基準。頭と重複したら次点で補充 |
| adjudication 敵対 | 30 | `adjudication[].name` を snapshot/`cards` の `name` で `oracleId` 解決(複数一致は `oracleId` 昇順の先頭)。継続効果らしいが未分類 = 反証が出やすい |
| ゴールド内包 | (必ず全数) | §4 のゴールド21枚(`oracleId` で照合)を**無条件で sample に含める**。物差し校正の母数 |

- 重複は `oracleId` で排除。総数は約200(ゴールド内包で前後する)。`oracleText` が空のカードは対象外(層を作れない)。
- 出力 `research/llm-oracle/sample.json`:
  ```jsonc
  { "generatedAt": "...", "seedRule": "edhrec_rank asc, oracleId asc",
    "buckets": { "head": 100, "multi": 50, "adjudication": 30, "gold": 21 },
    "cards": [ { "oracleId": "...", "name": "...", "oracleText": "...", "bucket": "head" } ] }
  ```
- **層ラベルは絶対に含めない**(`layers`/`cda` 非出力)。これが盲の担保。`oracleText` は snapshot の英語正本。

## 2. 盲予測 prompt(Codex が clean-room で実行 → `predictions.json`)

Codex は `sample.json` の各カードについて、**下記 prompt のみ**を文脈にファクトを推論する。
**layerClassify の出力・engine 出力・本ハーネスの写像表・CR 文書を参照しない**。

> You are reading a Magic: The Gathering card's English oracle text. Without assuming any rules-engine model,
> decide what **continuous or static** effects the card applies to the **characteristics of objects** (itself or others)
> while it / its effect is in place. "Continuous" = lasts over time (static abilities, "as long as", "until end of turn",
> Auras, "becomes"). **Ignore one-shot actions** (deal damage, draw, destroy, exile, create a token, counter a spell,
> add mana, gain life) — those are not continuous characteristic changes.
>
> For each question answer `true` / `false`, or list the key under `uncertain` if the text is genuinely ambiguous.
> Give a one-line `rationale` quoting the relevant text.
>
> - `changesController` — changes who controls one or more permanents?
> - `changesTypes` — adds/removes card types, subtypes, or supertypes?
> - `changesColors` — changes the color(s) of objects?
> - `grantsOrRemovesAbilities` — gives or removes abilities/keywords (incl. quoted activated abilities, or "can't have/gain")?
> - `setsBasePT` — **sets** base power/toughness to a fixed value (e.g. "becomes a 4/4", "base power and toughness 0/1")?
> - `modifiesPTByAmount` — modifies power/toughness by an amount (+N/+N, -N/-N, +1/+1 counters, doubling)?
> - `switchesPT` — switches power and toughness?
> - `definesCharacteristicByCount` — a characteristic (often P/T) is **defined by a dynamic count** (e.g. "* equal to the number of …")?
> - `isCopyEffect` — makes an object a copy of another?
> - `noContinuousEffect` — applies **none** of the above (one-shot only / mana / vanilla)?
>
> **Do not mention card "layers" or comprehensive-rules numbers anywhere.**

出力 `research/llm-oracle/predictions.json`:
```jsonc
{ "model": "<codex model id>", "generatedAt": "...", "promptHash": "<sha256 of §2 prompt>",
  "predictions": [ { "oracleId": "...", "name": "...",
    "facts": { "changesController": false, "changesTypes": true, "...": false,
               "uncertain": ["switchesPT"], "rationale": "..." } } ] }
```
- `predictions.json` は **データ成果物**(LLM 推論ゆえ非決定)。CI で再生成しない。diff の再現性のためコミットして固定する。

## 3. ファクト→層 写像(`scripts/lib/oracleHarness.ts` / 純粋・決定的)

| ファクト(true) | 層 | 備考 |
|---|---|---|
| `changesController` | L2 | |
| `changesTypes` | L4 | |
| `changesColors` | L5 | |
| `grantsOrRemovesAbilities` | L6 | |
| `setsBasePT` | L7b | |
| `modifiesPTByAmount` | L7c | |
| `switchesPT` | L7d | |
| `definesCharacteristicByCount` | L7a(+ `cda=true`) | |
| `isCopyEffect` | L1a | |
| `noContinuousEffect` | (層なし) | 情報用。層は正の各ファクトから導く |

- 出力層集合は**重複排除・`LAYER_ORDER` 昇順**(layerClassify と同順)。
- `uncertain[]` に挙がったファクトは**確定層に寄与しない**が、その写像先層を `uncertainLayers` に記録 → 当該カードを `検証不能` 扱いにする。
- **既知の写像近似(裁定アシスト・自動正規化しない)**: コピー(L1a)は CR 上 L1 が正で、付随する型/色変化を分類器が L4/L5 に二重計上しうる
  (《Mirage Mirror》)。これは差分に現れるが **substrate 誤りではなく「物差し近似/曖昧」として裁定**する。

### 型契約(`scripts/lib/oracleHarness.ts` — review test が import)
```ts
import type { LayerId } from './layerClassify';

export const FACT_KEYS = [
  'changesController','changesTypes','changesColors','grantsOrRemovesAbilities',
  'setsBasePT','modifiesPTByAmount','switchesPT','definesCharacteristicByCount',
  'isCopyEffect','noContinuousEffect',
] as const;
export type FactKey = (typeof FACT_KEYS)[number];

export interface OracleFacts extends Record<Exclude<FactKey, never>, boolean> {
  uncertain: FactKey[];   // 判定不能のファクト名
  rationale?: string;
}
export interface MappedLayers { layers: LayerId[]; cda: boolean; uncertainLayers: LayerId[]; }

// ファクト → 層(純粋・決定的・昇順・重複なし)
export function factsToLayers(facts: OracleFacts): MappedLayers;
```

## 4. 差分 / KPI(`scripts/oracle-diff.ts` + `scripts/lib/oracleHarness.ts`)

分類器側 = `report.json.cards`(`{oracleId,name,layers,cda}`)。オラクル側 = `factsToLayers(predictions[*].facts)`。
ゴールド = §4 の人手確定ラベル(下表・`oracleId` で照合)。

```ts
export interface CardDiff {
  oracleId: string; name: string;
  classifierLayers: LayerId[]; oracleLayers: LayerId[];
  classifierOnly: LayerId[];   // 分類器のみ(オラクル基準で FP)
  oracleOnly: LayerId[];       // オラクルのみ(オラクル基準で FN)
  agree: boolean;              // 集合一致(uncertainLayers を除外して比較)
  hasUncertain: boolean;
  deltaSignature: string;      // クラスタ用。例 "+L4,-L7c"(昇順・空なら "=")
  attribution: null;           // Fable が監査で {substrate|compiler|oracle|ambiguous} を記入
}
export interface LayerConfusion { layer: LayerId; classifierOnly: number; oracleOnly: number; agreeBoth: number; }
export interface GoldCalibration { layer: LayerId; precision: number; recall: number; support: number; } // oracle vs gold
export interface Cluster { signature: string; count: number; examples: string[] }
export interface OracleReport {
  sampleSize: number; comparedCount: number;
  discrepancyRate: number;     // (agree=false かつ uncertain でない)/ comparedCount
  unverifiableRate: number;    // hasUncertain なカード / sampleSize(安全KPI)
  perLayerConfusion: LayerConfusion[];
  goldCalibration: GoldCalibration[];
  clusters: Cluster[];         // deltaSignature 別・count 降順
  discrepancies: CardDiff[];   // agree=false を deltaSignature, oracleId でソート
}
export function computeReport(
  classifier: { oracleId: string; name: string; layers: LayerId[]; cda: boolean }[],
  predictions: { oracleId: string; name: string; facts: OracleFacts }[],
  gold: { oracleId: string; layers: LayerId[] }[],
): OracleReport;
```

KPI 対応(method §4):
- **オラクル間不一致率**(主指標 #1)= `discrepancyRate`。層別内訳 = `perLayerConfusion`。
- **帰属分布**(#2)= `discrepancies[].attribution`(Fable が監査で埋める。本スクリプトは `null`)。
- **クラスタリング**(#3)= `clusters`(同じ `deltaSignature` で割れる束 = 系統的誤りの候補)。
- **物差し校正**(#4・meta)= `goldCalibration`(ゴールド21を真値とした層別 precision/recall)。
- **検証不能率**(#6・安全)= `unverifiableRate`。

出力 `research/llm-oracle/report.{md,json}`。`report.md` は不一致率・層別 confusion・ゴールド校正・クラスタ上位・discrepancy 一覧の人間可読サマリ。

### ゴールド真値(物差し校正の母数 = 人手確定ラベル)
`review.layer-coverage` と同一の人手確定値。`oracleId` は `name` で snapshot/`report.cards` に照合して付与する。
**これを真値**としてオラクル予測の層別 precision/recall を測る(校正に分類器は使わない=循環回避)。

| name | layers | cda |
|---|---|---|
| Gaea's Anthem | L7c | false |
| Control Magic | L2 | false |
| Blood Moon | L4 | false |
| Archetype of Imagination | L6 | false |
| Giant Growth | L7c | false |
| Tarmogoyf | L7a | true |
| Darksteel Mutation | L4,L6,L7b | false |
| Lignify | L4,L6,L7b | false |
| Song of the Dryads | L4,L5 | false |
| Lightning Bolt | (なし) | false |
| Llanowar Elves | (なし) | false |
| Chromatic Lantern | L6 | false |
| Cryptolith Rite | L6 | false |
| Purphoros, God of the Forge | L4,L7c | false |
| Heliod, Sun-Crowned | L4,L6,L7c | false |
| Unnatural Growth | L7c | false |
| Alloy Animist | L4,L7b | false |
| Cyberdrive Awakener | L4,L6,L7b | false |

- 負例(Lightning Bolt / Llanowar Elves = 層なし)も含める(オラクルが誤って層を立てれば校正の FP として効く)。
- 名前解決できないゴールドは校正母数から除外し `report.md` に明示(silent に落とさない)。

## 5. 分担・変更禁止

- **Fable(契約・採点・裁定)**: 本文書 / `engine-state-ontology.md` の trust 更新 / `engine-spec.md` §34.9 ログ /
  `review.oracle-harness.test.ts` / 監査での帰属裁定。
- **Codex(機械作業・`scripts/` のみ)**: `scripts/oracle-sample.ts` / `scripts/oracle-diff.ts` /
  `scripts/lib/oracleHarness.ts`(`factsToLayers`/`computeReport`)/ clean-room 予測 `predictions.json` /
  `package.json` script 追加。既存 `splitAbilityLines`・`mapScryfallCardToCardDef`・`layerClassify` の `LayerId` を再利用。
- **Codex 変更禁止**: `src/engine/`・`review.*`・`docs/`・`CLAUDE.md`・`eslint.config.js`・`CACHE_SCHEMA_VERSION`・git 操作。

## 6. iter1 の収束判定(監査後 Fable)

discrepancy クラスタを裁定し帰属する:
- 同 `deltaSignature` が**多数同方向**に割れる → **系統的 substrate/分類器誤り**(層モデル or regex を直す)。
- ゴールド校正で**オラクルの precision/recall が低い層** → **物差し誤り**(prompt/写像を改訂。物差しも第一級改善対象 = method §6)。
- 単発の割れ → ノイズ(曖昧/オラクル誤り)。
- 結果を ESO の `trust` 列(層別)へ反映:一致=`検証済` / 割れ=`不一致` / `uncertain`=`検証不能`。

## スコープ外(iter1)
- 全 17,491 への拡大(iter1 は200枚層化)。Forge/XMage 差分との交差(第3物差し)。イベント語彙スライスへの流用(schema 差し替え=後続)。

---

# 7. Slice2 流用: イベント語彙オラクル(M0-O2 / `EventFacts` schema)

> Slice1(層)の物差し設計(§0〜§6)を**そのまま流用**し、`facts` schema を差し替えてイベント語彙(誘発/観測者/介在条件)に当てる。
> 対象分類器 = `scripts/lib/eventClassify.ts`(`classifyCardEvents`、16族・5観測者・3形・介在条件)。
> 下面抽出(`event-coverage`)は収束済(commit d852b9b、churn 0.05%、Gold `review.event-coverage` 21/21)。本節は**独立物差し**を当てて被覆/帰属を測る。

## 7.0 Slice1 との差(なぜ写像が無いか)
- 層(L1〜L7d)は CR 内部のタクソノミなのでオラクルに見せず**平易な挙動ファクト→層**へ機械写像した(§3)。
- **イベント族/観測者は観測可能事象そのもの**(「a creature dies に誘発」「対戦相手のドローに誘発」)であり、隠れた Fable タクソノミではない。よって**写像は恒等**=オラクルは族/観測者集合を直接予測し、比較は集合差で行う。
- 相関遮断は §0 のまま:オラクルは**別主体(Codex clean-room)**・**oracleText のみ**・`eventClassify.ts`/`event-coverage` 出力を**読まない**。

## 7.1 サンプル抽出(`scripts/event-oracle-sample.ts` / iter1 ≈ 192枚)
入力2系統を `oracleId` 結合(`research/event-coverage/report.json.cards` は `{oracleId,name,families,observers,triggerShapes,hasInterveningIf}`、`oracleText`/`edhrecRank` 非保有 → snapshot を `mapScryfallCardToCardDef` で写す。Slice1 §1 と同経路):

| 層化バケット | 件数 | 抽出規則 |
|---|---:|---|
| `gold` | (全数) | §7.4 のゴールド18枚を `name`→`oracleId` 解決し**無条件内包**。校正母数 |
| `head` | 100 | 高頻度族(enters/attacks/phase/cast/dies)保有を **snapshot `edhrecRank` 昇順**(同値 `oracleId` 昇順)。族間で概ね均す |
| `multi-family` | 40 | `families.length>=2` を同基準(複合誘発で族の取り違えが出やすい) |
| `observer` | 30 | `observers` に `opponent` または `any` を含むを同基準(観測者スコープの反証母数) |
| `tail` | 22 | `other`/`zone`/`counter`/`discard`/`life`/`sacrifice`/`tap`/`blocks`/`leaves` の低頻度族(反証が出やすい裾) |

- 重複は `oracleId` 排除。`families` 空(誘発なし)のカードも `gold` の負例(Gaea's Anthem)以外は対象外(イベントを作れない)。総数 ≈ 192(gold 内包で前後)。
- 出力 `research/event-oracle/sample.json`:
  ```jsonc
  { "generatedAt": "...", "seedRule": "edhrec_rank asc, oracleId asc",
    "buckets": { "gold": 18, "head": 100, "multi-family": 40, "observer": 30, "tail": 22 },
    "cards": [ { "oracleId": "...", "name": "...", "oracleText": "...", "bucket": "head" } ] }
  ```
- **族/観測者ラベルは絶対に出力しない**(盲の担保)。`oracleText` は snapshot 英語正本。

## 7.2 盲予測 prompt(Codex clean-room → `research/event-oracle/predictions.json`)
`sample.json` の各カードを下記 prompt **のみ**で推論。`eventClassify.ts`・`event-coverage` 出力・engine 出力を参照しない。

> **prompt v2(iter2-b 改訂)**。iter1 の oracle 帰属(combat-damage→phase 過剰付与・phase juncture 観測者の取り違え・tap-for-mana・recipient を観測者にする誤り)を是正。
>
> You are reading a Magic: The Gathering card's English oracle text. List the **triggered abilities** the card itself has
> (lines starting "When / Whenever / At the beginning of ..."), and classify only the **trigger condition** of each — never the effect that follows the comma.
> Ignore static abilities, activated abilities ("{cost}: ..."), reminder text in parentheses, and any trigger quoted inside an effect.
>
> Answer three things. **Prefer listing a token under `uncertain` over guessing** when a family or observer is genuinely ambiguous. Give a one-line `rationale`.
>
> 1. `families` — which event kinds the card triggers on (a set; a card may have several). Choose from:
>    `enters` (a permanent enters the battlefield), `leaves` (leaves the battlefield), `dies` (a creature dies / is put into a graveyard from the battlefield),
>    `zone` (an object changes a non-battlefield zone: mill/exile/return to hand/graveyard), `cast` (a spell is cast), `attacks`, `blocks`,
>    `damage` (damage is dealt or received), `draw` (a card is drawn), `discard`, `sacrifice`,
>    `tap` (a permanent **becomes tapped or untapped as a state change** — NOTE: tapping a permanent **for mana** is NOT `tap`, classify it as `other`),
>    `counter` (a +1/+1 or other counter is placed),
>    `life` (a player gains or loses life **as the trigger condition**),
>    `phase` (**only** a turn-based juncture written "at the beginning of … upkeep/draw step/combat/end step/main phase" — a trigger on **dealing or being dealt combat damage is `damage`, NEVER `phase`**; combat damage ≠ the combat phase),
>    `other` (a triggered event not in this list — e.g. cycling, a land is played, a spell is countered, a token is created, mana is added, a permanent becomes the target of a spell).
> 2. `observers` — whose event is observed (a set). **Decide from the grammatical SUBJECT of the trigger condition (who/what performs the triggering action), NOT from objects or recipients.**
>    A player named only as the **recipient** of an effect ("deals damage **to** a player / **to** an opponent") does not by itself set the observer — use the **subject's** scope.
>    - `self` — you / this permanent (incl. the card's own name, e.g. "Whenever Etali attacks") / "a creature you control" only when the **subject is singularly you**.
>    - `opponent` — the subject or its scope is an opponent ("an opponent draws", "an opponent's graveyard", "each opponent's upkeep", "deals damage to an opponent" where opponent qualifies the event).
>    - `controlled-set` — the triggering object is one you control ("a creature/land/Equipment/artifact you control enters/dies/deals …").
>    - `any` — the subject is an unspecified player or object ("a player casts", "each player", "another creature", a juncture "at the beginning of each end step").
>    - `unknown` — genuinely ambiguous/composite (and consider listing `unknown` in `uncertain` too).
>    For a turn-based juncture: "at the beginning of **your** [phase]" → `self`; "**each opponent's** [phase]" → `opponent`; "**each** [phase]" (all players) → `any`.
>    A card may have multiple observers across its triggers (e.g. "your upkeep" + "each opponent's upkeep" → `self` and `opponent`).
> 3. `hasInterveningIf` — does any triggered ability use an **intervening "if" clause** (an `if` condition placed **immediately after the trigger event, before the effect**, e.g. "When X enters, **if you control another Knight,** …")? `true`/`false`.
>
> **Do not mention comprehensive-rules numbers. Classify the trigger condition (its subject), not the effect or its recipient.**

出力 `predictions.json`(LLM 推論=非決定。再生成せずコミット固定):
```jsonc
{ "model": "<codex model id>", "generatedAt": "...", "promptHash": "<sha256 of §7.2 prompt>",
  "predictions": [ { "oracleId": "...", "name": "...",
    "facts": { "families": ["dies","enters"], "observers": ["self"], "hasInterveningIf": false,
               "uncertain": ["zone"], "rationale": "..." } } ] }
```

## 7.3 差分 / KPI(`scripts/event-oracle-diff.ts` + `scripts/lib/eventOracleHarness.ts` / 純粋・決定的)
分類器側 = `event-coverage/report.json.cards`。オラクル側 = `predictions[*].facts`。ゴールド = §7.4。
比較は**3軸独立**(族集合・観測者集合・介在条件 boolean)。`uncertain` に挙がったトークン(族値/観測者値/`'hasInterveningIf'`)は**その軸の比較から除外**し当該カードを検証不能に数える(Slice1 の uncertain マスクと同型)。

```ts
import type { EventFamily, ObserverScope } from './eventClassify';

export interface EventFacts {
  families: EventFamily[];
  observers: ObserverScope[];
  hasInterveningIf: boolean;
  uncertain: string[];        // EventFamily | ObserverScope | 'hasInterveningIf'
  rationale?: string;
}

export interface EventCardDiff {
  oracleId: string; name: string;
  classifierFamilies: EventFamily[]; oracleFamilies: EventFamily[];
  familyClassifierOnly: EventFamily[];     // 分類器のみ(オラクル基準 FP)
  familyOracleOnly: EventFamily[];         // オラクルのみ(オラクル基準 FN)
  classifierObservers: ObserverScope[]; oracleObservers: ObserverScope[];
  observerClassifierOnly: ObserverScope[]; observerOracleOnly: ObserverScope[];
  classifierInterveningIf: boolean; oracleInterveningIf: boolean;
  familyAgree: boolean; observerAgree: boolean; interveningIfAgree: boolean;
  agree: boolean;             // 3軸とも一致(uncertain マスク後)
  hasUncertain: boolean;
  deltaSignature: string;     // 族 "+dies,-zone" → 観測者 "+@opponent,-@self" → 介在 "+if"/"-if"。昇順・空なら "="
  attribution: null;          // Fable が監査で {substrate|compiler|oracle|ambiguous} を記入
}
export interface FamilyConfusion { family: EventFamily; classifierOnly: number; oracleOnly: number; agreeBoth: number; }
export interface ObserverConfusion { observer: ObserverScope; classifierOnly: number; oracleOnly: number; agreeBoth: number; }
export interface FamilyCalibration { family: EventFamily; precision: number; recall: number; support: number; } // oracle vs gold
export interface Cluster { signature: string; count: number; examples: string[]; }
export interface EventOracleReport {
  sampleSize: number; comparedCount: number;
  familyDiscrepancyRate: number;        // familyAgree=false かつ族 uncertain でない / comparedCount
  observerDiscrepancyRate: number;      // 同上(観測者軸)
  interveningIfDiscrepancyRate: number; // 介在条件の不一致(uncertain でない)/ comparedCount
  unverifiableRate: number;             // uncertain を持つカード / sampleSize(安全KPI)
  perFamilyConfusion: FamilyConfusion[];     // EVENT_FAMILIES 順
  perObserverConfusion: ObserverConfusion[]; // self/opponent/any/controlled-set/unknown 順
  goldCalibration: FamilyCalibration[];      // ゴールド真値の族別 precision/recall
  clusters: Cluster[];                       // deltaSignature 別・count 降順
  discrepancies: EventCardDiff[];            // agree=false を deltaSignature, oracleId でソート
}
export function computeEventReport(
  classifier: { oracleId: string; name: string; families: EventFamily[]; observers: ObserverScope[]; hasInterveningIf: boolean }[],
  predictions: { oracleId: string; name: string; facts: EventFacts }[],
  gold: { oracleId: string; families: EventFamily[]; observers: ObserverScope[]; hasInterveningIf: boolean }[],
): EventOracleReport;
```

KPI 対応(method §4):**主指標**= `familyDiscrepancyRate`/`observerDiscrepancyRate`(構文クラスタ `clusters` で系統誤りを炙る)/**帰属**= `discrepancies[].attribution`(Fable 監査)/**物差し校正**= `goldCalibration`/**検証不能**= `unverifiableRate`。出力 `research/event-oracle/report.{md,json}`。

## 7.4 ゴールド真値(校正母数 = `review.event-coverage` と同一の人手確定値)
`name`→`oracleId` 解決して付与。**これを真値**にオラクル予測の族別 precision/recall を測る(校正に分類器を使わない=循環回避)。

| name | families | observers | hasInterveningIf |
|---|---|---|---|
| Solemn Simulacrum | dies, enters | self | false |
| Grave Pact | dies | controlled-set | false |
| Smothering Tithe | draw | opponent | false |
| Guttersnipe | cast | self | false |
| Bitterblossom | phase | self | false |
| Necropotence | discard | self | false |
| Mentor of the Meek | enters | controlled-set | false |
| Court of Grace | enters, phase | self | false |
| Felidar Guardian | enters | self | false |
| Acclaimed Contender | enters | self | true |
| Adrenaline Jockey | cast, other | any, self | true |
| Agent of Treachery | enters, phase | self | true |
| Morbid Opportunist | dies | any | false |
| Evolution Witness | counter | self | false |
| Nalfeshnee | cast | self | false |
| Poison-Tip Archer | dies | any | false |
| Sram, Senior Edificer | cast | self | false |
| Gaea's Anthem | (なし) | (なし) | false |

- 負例(Gaea's Anthem=誘発なし)も含める(オラクルが誤って族を立てれば校正 FP として効く)。
- 名前解決できないゴールドは校正母数から除外し `report.md` に明示(silent に落とさない)。

## 7.5 分担・変更禁止(Slice1 §5 と同一)
- **Fable**: 本節 / ESO・カタログの trust 更新 / `engine-spec.md` §34.9 ログ / `review.event-oracle.test.ts` / 監査帰属。
- **Codex(`scripts/` のみ)**: `scripts/event-oracle-sample.ts` / `scripts/event-oracle-diff.ts` / `scripts/lib/eventOracleHarness.ts`(`computeEventReport`)/ clean-room `predictions.json` / `package.json` script `event-oracle-sample`・`event-oracle-diff` 追加。`splitAbilityLines`・`mapScryfallCardToCardDef`・`eventClassify` の `EventFamily`/`ObserverScope`/`EVENT_FAMILIES` を再利用。
- **Codex 変更禁止**: `src/engine/`・`review.*`・`docs/`・`CLAUDE.md`・`eslint.config.js`・`CACHE_SCHEMA_VERSION`・git。

## 7.6 iter1 収束判定(監査後 Fable)
- 同 `deltaSignature` が多数同方向に割れる → 系統的 substrate/分類器誤り(ESO or eventClassify regex を直す)。
- ゴールド校正で族別 precision/recall が低い → 物差し誤り(§7.2 prompt 改訂)。
- 単発 → ノイズ(曖昧/オラクル誤り)。
- 結果を ESO Slice2 の `trust` 列へ反映(族別:一致=検証済/割れ=不一致/uncertain=検証不能)。family/observer 不一致率・churn・被覆で Slice2 継続 or Slice3 前進を判断。
