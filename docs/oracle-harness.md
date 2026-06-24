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

---

# 8. Slice3 流用: ゾーン+プレイヤーオラクル(M0-Z-O / `ZoneFacts` schema)

> Slice1(層)・Slice2(イベント)の物差し設計(§0〜§7)を**そのまま流用**し、`facts` schema を差し替えてゾーン+プレイヤー軸に当てる。
> 対象分類器 = `scripts/lib/zoneClassify.ts`(`classifyCardZones`、7ゾーン・crossPlayer・ownership4値・7 playerScope)。
> 下面抽出(`zone-coverage`)は iter1 完了(commit cf95600・mappingFailures0・**cross率0.74%は照応FNで過小評価と既知**)。
> **本節の主目的 = 独立物差し(別主体オラクル)で `their <zone>` 照応 FN を露呈し、真のクロスプレイヤー率を出す**(下面抽出 floor の反証)。

## 8.0 Slice1/2 との差(なぜ写像が恒等か)
- Slice2 同様、ゾーン参照・クロスプレイヤー・所有者/コントローラー・プレイヤー参照は**観測可能なテキスト事象**であり隠れ Fable タクソノミでない。よって**写像は恒等**=オラクルは各軸を直接予測し集合差/値一致で比較。
- ただし `ownership` 4値(owner/controller/both/none)は、オラクルに**2つの素朴 boolean**(`refersToOwner`/`refersToController`)を予測させ、分類器と**同じ導出規則**(both/owner/controller/none)で 4値へ機械写像してから比較する(LLM に 'both' を直接推論させない=曖昧化を避ける)。
- 相関遮断は §0 のまま:オラクルは**別主体(Codex clean-room)**・**oracleText のみ**・`zoneClassify.ts`/`zone-coverage` 出力を**読まない**。

## 8.1 サンプル抽出(`scripts/zone-oracle-sample.ts` / ≈ 190枚)
入力2系統を `oracleId` 結合(`research/zone-coverage/report.json.cards` は `{oracleId,name,zones,crossPlayer,ownership,playerScopes}`、`oracleText`/`edhrecRank` 非保有 → snapshot を `mapScryfallCardToCardDef` で写す。Slice1 §1 と同経路):

| 層化バケット | 件数 | 抽出規則 |
|---|---:|---|
| `gold` | (全数) | §8.4 のゴールド16枚を `name`→`oracleId` 解決し**無条件内包**。校正母数 |
| `head` | 90 | ゾーン保有(`zones.length>0`)を **snapshot `edhrecRank` 昇順**(同値 `oracleId` 昇順) |
| `cross` | 40 | `crossPlayer=true`(分類器が cross と判定した母数。約130枚から rank 昇順)。cross 軸の確証母数 |
| `cross-suspect` | 30 | **`crossPlayer=false` かつ `playerScopes` に `each-opponent`/`each-player`/`target-player` を含み `zones.length>0`**。= **照応 FN の主たる母数**(オラクルが cross を立てれば FN 露呈) |
| `tail` | 20 | `ownership` が `owner`/`both`、または `zones` に `command`/`stack` を含む低頻度(裾の反証) |

- 重複は `oracleId` 排除。`zones` 空かつ `playerScopes` 空のカードは `gold` 負例以外は対象外。総数 ≈ 190(gold 内包で前後)。
- 出力 `research/zone-oracle/sample.json`(Slice2 §7.1 と同形・**ゾーン/プレイヤーラベルは絶対に出力しない**=盲の担保)。

## 8.2 盲予測 prompt(Codex clean-room → `research/zone-oracle/predictions.json`)
`sample.json` の各カードを下記 prompt **のみ**で推論。`zoneClassify.ts`・`zone-coverage` 出力・engine 出力を参照しない。

> You are reading a Magic: The Gathering card's English oracle text. Identify which **game zones** and which **players** the card's text reads from or writes to. Resolve pronouns ("their", "its", "that player") to whoever they refer to. If the card has **multiple faces** (MDFC / split / transform), read **all faces** and report the union.
> Answer the following. **Prefer listing a key under `uncertain` over guessing** when genuinely ambiguous. Give a one-line `rationale` quoting the relevant text.
>
> 1. `zones` — the set of zones a card is **moved between, searched, or explicitly operated on**. Choose from:
>    `library`, `hand`, `graveyard`, `battlefield`, `exile`, `command` (the command zone), `stack`.
>    Mark `battlefield` ONLY when a permanent **moves or changes existence on it**: "enters", is "destroyed"/"dies", "exile/return/destroy target <permanent>" from the battlefield, put "onto the battlefield", or a token is "created". **Do NOT mark `battlefield` for a purely static reference to permanents already there** — e.g. "creatures you control get +1/+1", "you control enchanted creature", "if an opponent controls more lands than you". Those read a permanent's characteristics but move nothing.
>    Mark `stack` ONLY for an explicit operation on a spell/ability already on the stack ("counter target spell", "return target spell from the stack", "copy target spell"). Do NOT mark `stack` for merely _casting_/_playing_ a card, "can't be countered", or a cost reduction.
>    Implicit moves count (these are fixed by the game rules): "draw" touches `library`+`hand`; "discard" touches `hand`+`graveyard`; **"dies", "destroy", and "sacrifice" each move a permanent from the battlefield to its owner's graveyard, so each touches `battlefield`+`graveyard`**; "mill" touches `library`+`graveyard`; "exile" touches `exile` (plus the zone it leaves).
> 2. `crossPlayer` — `true` if any zone touched belongs to a player **other than you** (e.g. "an opponent's graveyard", "target player's hand", "each player's library", "their hand" where the referent is an opponent; also "each other player discards" → their hand/graveyard). `false` if every zone touched is yours, a zone of **a permanent you control / you own** (its owner is you), or an unowned shared zone. **For "its owner's hand" of an _unrestricted_ target ("return target permanent/creature to its owner's hand") the owner may be you or an opponent and the text does not say — list `crossPlayer` under `uncertain` rather than guessing `true`.** Mark `true` only when the target is established as not yours ("you don't control", "an opponent controls", "target opponent's").
> 3. `refersToOwner` — does the text reference a card's **owner** (e.g. "its owner's hand", "an opponent owns", "owned by", "return it to its owner")? `true`/`false`.
> 4. `refersToController` — does the text reference who **controls** an object (e.g. "you control", "creatures you control", "gain control of", "under your control", "its controller")? `true`/`false`.
> 5. `playerScopes` — every player the text references, whether as **subject or as target/recipient**. Choose from:
>    `you` (you/your, **incl. "<X> you control"**), `target-player` ("target player"/"target opponent"), `each-opponent` ("an/each opponent", "opponents"; **a player dealt damage / forced to discard / otherwise targeted**), `each-player` ("each player"/"a player"/"each other player"), `owner` (a card's owner), `controller` (an object's **indefinite** controller, i.e. "its/their controller" — **NOT** "you control"), `unknown` (a referenced player genuinely unresolved → prefer `uncertain`).
>    Include both the player **performing** an action and the player it is **done to** (e.g. "deals damage to each opponent" → `each-opponent`).
>
> **Do not mention comprehensive-rules numbers or any "zone partition / ontology" model. Resolve pronouns to real players.**

> **v3 改訂(iter3-b・2026-06-24)**: v2(promptHash e5930f9e)→v3 の差分は (a)**静的 read を `zones` から除外**(`creatures you control get +X`・`you control enchanted creature`・land 計数 = battlefield にしない。移動志向=ESO iter2-b 裁定の物差し側反映)(b)**recipient/対象プレイヤーを `playerScopes` に算入**(`deals damage to each opponent` → each-opponent。v2 の「recipient は subject scope でない」過剰補正を撤回)(c)不定 owner バウンス(`return target permanent to its owner's hand`)の crossPlayer は uncertain(owner=自分/相手 不定)。v2 の (stack 限定 / you-control→you / MDFC 全 face / uncertain 促進)は維持。
> **v4 改訂(iter3-b CR 基盤化・2026-06-24)**: 手法改訂(method §3「CR を一次の決定論的権威に」)を適用。暗黙ゾーン移動は CR 真理テーブル(ESO「iter3 CR ゾーン遷移真理テーブル」)で**一意に確定**: **`dies`/`destroy`/`sacrifice` は battlefield→owner's graveyard ゆえ `battlefield`+`graveyard`**(初稿 v3.1/v3.2 が CR 701.8a/701.21a に反して destroy/sacrifice の graveyard を抑制した誤りを撤回)。**分類器とオラクル prompt の両方を同時に CR へ anchor する**(外部真理=CR が在るため flip-flop の交絡は起きない=method §3)。オラクルの価値は決定論的軸でなく**認識**と解釈的軸に限定。

出力 `predictions.json`(LLM 推論=非決定。再生成せずコミット固定):
```jsonc
{ "model": "<codex model id>", "generatedAt": "...", "promptHash": "<sha256 of §8.2 prompt>",
  "predictions": [ { "oracleId": "...", "name": "...",
    "facts": { "zones": ["exile","graveyard"], "crossPlayer": true,
               "refersToOwner": false, "refersToController": false,
               "playerScopes": ["target-player"], "uncertain": [], "rationale": "..." } } ] }
```

## 8.3 差分 / KPI(`scripts/zone-oracle-diff.ts` + `scripts/lib/zoneOracleHarness.ts` / 純粋・決定的)
分類器側 = `zone-coverage/report.json.cards`。オラクル側 = `predictions[*].facts`(`refersToOwner`/`refersToController` → `ownership` 4値へ §8.0 規則で写像)。ゴールド = §8.4。
比較は**4軸独立**(zones 集合差・crossPlayer boolean・ownership 値一致・playerScopes 集合差)。`uncertain` のトークン(zone 値/`'crossPlayer'`/`'ownership'`(= owner/controller いずれか uncertain なら ownership 軸除外)/playerScope 値)は**その軸の比較から除外**し当該カードを検証不能に数える(Slice1/2 の uncertain マスクと同型)。

```ts
import type { ZoneId } from '../../src/engine/types';
import type { PlayerScope, OwnershipKind } from './zoneClassify';

export interface ZoneFacts {
  zones: ZoneId[];
  crossPlayer: boolean;
  refersToOwner: boolean;
  refersToController: boolean;
  playerScopes: PlayerScope[];
  uncertain: string[];        // ZoneId | 'crossPlayer' | 'ownership' | PlayerScope
  rationale?: string;
}
export interface ZoneCardDiff {
  oracleId: string; name: string;
  classifierZones: ZoneId[]; oracleZones: ZoneId[];
  zoneClassifierOnly: ZoneId[]; zoneOracleOnly: ZoneId[];
  classifierCrossPlayer: boolean; oracleCrossPlayer: boolean;
  classifierOwnership: OwnershipKind; oracleOwnership: OwnershipKind;
  classifierPlayerScopes: PlayerScope[]; oraclePlayerScopes: PlayerScope[];
  playerScopeClassifierOnly: PlayerScope[]; playerScopeOracleOnly: PlayerScope[];
  zoneAgree: boolean; crossPlayerAgree: boolean; ownershipAgree: boolean; playerScopeAgree: boolean;
  agree: boolean;             // 4軸とも一致(uncertain マスク後)
  hasUncertain: boolean;
  deltaSignature: string;     // zones "+graveyard" → cross "+x"/"-x" → own "@owner" → scope "+@each-opponent"。昇順・空なら "="
  attribution: null;          // Fable が監査で {substrate|compiler|oracle|ambiguous} を記入
}
export interface ZoneConfusion { zone: ZoneId; classifierOnly: number; oracleOnly: number; agreeBoth: number; }
export interface ScopeConfusion { scope: PlayerScope; classifierOnly: number; oracleOnly: number; agreeBoth: number; }
export interface ZoneCalibration { zone: ZoneId; precision: number; recall: number; support: number; } // oracle vs gold
export interface Cluster { signature: string; count: number; examples: string[]; }
export interface ZoneOracleReport {
  sampleSize: number; comparedCount: number;
  zoneDiscrepancyRate: number;          // zoneAgree=false かつ zone uncertain でない / comparedCount
  crossPlayerDiscrepancyRate: number;   // crossPlayerAgree=false(uncertain でない)/ comparedCount  ← 照応 FN の主指標
  ownershipDiscrepancyRate: number;
  playerScopeDiscrepancyRate: number;
  unverifiableRate: number;             // uncertain を持つカード / sampleSize(安全KPI)
  perZoneConfusion: ZoneConfusion[];       // ZONE_IDS 順
  perScopeConfusion: ScopeConfusion[];     // PLAYER_SCOPES 順
  goldCalibration: ZoneCalibration[];      // ゴールド真値のゾーン別 precision/recall
  clusters: Cluster[];                     // deltaSignature 別・count 降順
  discrepancies: ZoneCardDiff[];           // agree=false を deltaSignature, oracleId でソート
}
export function computeZoneReport(
  classifier: { oracleId: string; name: string; zones: ZoneId[]; crossPlayer: boolean; ownership: OwnershipKind; playerScopes: PlayerScope[] }[],
  predictions: { oracleId: string; name: string; facts: ZoneFacts }[],
  gold: { oracleId: string; zones: ZoneId[]; crossPlayer: boolean; ownership: OwnershipKind; playerScopes: PlayerScope[] }[],
): ZoneOracleReport;
```

KPI 対応(method §4):**主指標**= `zoneDiscrepancyRate`/**`crossPlayerDiscrepancyRate`(照応 FN の露呈)**/`ownershipDiscrepancyRate`/`playerScopeDiscrepancyRate`(`clusters` で系統誤りを炙る)/**帰属**= `discrepancies[].attribution`(Fable 監査)/**物差し校正**= `goldCalibration`/**検証不能**= `unverifiableRate`。出力 `research/zone-oracle/report.{md,json}`。report.json は大型ブロブのため `.gitignore` 追加(report.md は残す)。

## 8.4 ゴールド真値(校正母数 = `review.zone-coverage` と同一の人手確定値)
`name`→`oracleId` 解決して付与。**これを真値**にオラクル予測のゾーン別 precision/recall を測る(校正に分類器を使わない=循環回避)。

| name | zones | crossPlayer | ownership | playerScopes |
|---|---|---|---|---|
| Demonic Tutor | hand, library | false | none | you |
| Vampiric Tutor | library | false | none | you |
| Brainstorm | hand, library | false | none | you |
| Regrowth | graveyard, hand | false | none | you |
| Cultivate | battlefield, hand, library | false | none | you |
| Eternal Witness | battlefield, graveyard, hand | false | none | you |
| Bojuka Bog | battlefield, exile, graveyard | true | none | target-player |
| Agonizing Remorse | exile, graveyard, hand | true | none | each-opponent, you |
| Control Magic | (なし) | false | controller | you |
| Reanimate | battlefield, graveyard | false | controller | you |
| Boomerang | hand | false | owner | owner |
| Gaea's Anthem | (なし) | false | controller | you |
| Grizzly Bears | (なし) | false | none | (なし) |
| Syphon Mind | (なし) | false | none | each-player, you |
| Entomb | graveyard, library | false | none | you |
| Thoughtseize | hand | true | none | target-player, you |

- 負例(Grizzly Bears=ゾーン/プレイヤー参照なし)も含める。**Thoughtseize は照応の真値テスト**(`their hand`=target player → crossPlayer **true**。分類器は false=FN ゆえ gold には含めるが §8.1 cross-suspect の確証にも使う)。
- 名前解決できないゴールドは校正母数から除外し `report.md` に明示(silent に落とさない)。

## 8.5 分担・変更禁止(§5/§7.5 と同一)
- **Fable**: 本節 / ESO Slice3 の trust 更新 / `engine-spec.md` §34.9 ログ / `review.zone-oracle.test.ts` / 監査帰属。
- **Codex(`scripts/` のみ)**: `scripts/zone-oracle-sample.ts` / `scripts/zone-oracle-diff.ts` / `scripts/lib/zoneOracleHarness.ts`(`computeZoneReport`)/ clean-room `predictions.json` / `package.json` script `zone-oracle-sample`・`zone-oracle-diff` 追加 / `.gitignore` に `research/zone-oracle/report.json`。`splitAbilityLines`・`mapScryfallCardToCardDef`・`zoneClassify` の `ZoneId`/`PlayerScope`/`OwnershipKind`/`ZONE_IDS`/`PLAYER_SCOPES` を再利用。
- **Codex 変更禁止**: `src/engine/`・`review.*`・`docs/`・`CLAUDE.md`・`eslint.config.js`・`CACHE_SCHEMA_VERSION`・git。

## 8.6 iter1 収束判定(監査後 Fable)
- **`crossPlayerDiscrepancyRate` の oracleOnly(オラクルが cross・分類器が非cross)= 照応 FN の規模**。これが大きければ予測どおり=分類器の cross 検出を iter2 で `their`/`that player's` 照応へ拡張(`zoneClassify.ts`)。
- 同 `deltaSignature` が多数同方向 → 系統的 substrate/分類器誤り。ゴールド校正で軸別 precision/recall が低い → 物差し誤り(§8.2 prompt 改訂)。単発 → ノイズ。
- 結果を ESO Slice3 の `trust` 列へ反映(軸別:一致=検証済/割れ=不一致/uncertain=検証不能)。真クロス率と各軸不一致率で Slice3 継続 or Slice4 前進を判断。**0.74% を収束と読まない**(method §4)。

---

# 9. Slice4 流用: タイミングオラクル(M0-T-O / `TimingFacts` schema)

> Slice1(層)・Slice2(イベント)・Slice3(ゾーン)の物差し設計(§0〜§8)を**そのまま流用**し、`facts` schema を
> 差し替えてタイミング軸に当てる。対象分類器 = `scripts/lib/timingClassify.ts`(`classifyCardTiming`、TimingStep 列挙・
> junctureScope= Slice2 ObserverScope 再利用・CastTiming 6値)。下面抽出(`timing-coverage`)は本マイルストーンで iter1 実行。
> **計測の中心 = タイミング認識**(juncture と cast/起動の制限)。**SBA(CR704)・ターン構造(CR500)は決定論的ゆえ
> ESO の CR 真理テーブルで固定し、本オラクルは予測しない**(method §3「CR を一次の決定論的権威に」)。

## 9.0 Slice2/3 との差(なぜ写像が恒等か)
- juncture(どのステップ)・junctureScope(誰のターン)・castTiming(制限窓)は**観測可能なテキスト事象**であり
  隠れた Fable タクソノミでない(Slice2/3 と同じ)。よって**写像は恒等**=オラクルは各軸を直接予測し集合差で比較。
- **TimingStep の値域は CR500 真理テーブル**(ESO「iter3 CR ターン構造真理テーブル」)から導出=決定論的に固定。
  オラクルにはこの**ステップ写像を明示**(`at the beginning of your upkeep`→`upkeep` 等)してノイズ源を断つ(§9.2)。
  これは Slice3 v4 が CR ゾーン遷移写像を明示したのと同型(決定論的軸の anchor は CR=交絡しない)。
- 相関遮断は §0 のまま:オラクルは**別主体(Codex clean-room)**・**oracleText のみ**・`timingClassify.ts`/`timing-coverage`
  出力を**読まない**。

## 9.1 サンプル抽出(`scripts/timing-oracle-sample.ts` / ≈ 190枚)
入力2系統を `oracleId` 結合(`research/timing-coverage/report.json.cards` は `{oracleId,name,junctures,junctureScope,castTiming}`、
`oracleText`/`edhrecRank` 非保有 → snapshot を `mapScryfallCardToCardDef` で写す。§1 と同経路):

| 層化バケット | 件数 | 抽出規則 |
|---|---:|---|
| `gold` | (全数) | §9.4 のゴールドを `name`→`oracleId` 解決し**無条件内包**。校正母数 |
| `head` | 90 | juncture 保有(`junctures.length>0`)を **snapshot `edhrecRank` 昇順**(同値 `oracleId` 昇順)。ステップ間で概ね均す |
| `cast` | 40 | `castTiming` が `none` 以外(sorcery-speed/flash/your-turn-only/combat-only/once-per-turn)を同基準。タイミング制限軸の確証母数 |
| `scope` | 30 | `junctureScope` に `opponent` または `any` を含むを同基準(誰のターンか軸の反証母数) |
| `tail` | 20 | 希少ステップ(`draw`/`untap`/`begin-combat`/`declare-attackers`/`declare-blockers`/`end-combat`/`cleanup`/`main-precombat`/`main-postcombat`/`turn`/`other`)保有(裾の反証) |

- 重複は `oracleId` 排除。`junctures` 空かつ `castTiming=[none]` のカードは `gold` 負例以外は対象外。総数 ≈ 190(gold 内包で前後)。
- 出力 `research/timing-oracle/sample.json`(§8.1 と同形・**タイミングラベルは絶対に出力しない**=盲の担保)。

## 9.2 盲予測 prompt(Codex clean-room → `research/timing-oracle/predictions.json`)
`sample.json` の各カードを下記 prompt **のみ**で推論。`timingClassify.ts`・`timing-coverage` 出力・engine 出力を参照しない。

> You are reading a Magic: The Gathering card's English oracle text. Identify **when** the card's abilities happen in the turn,
> and any **timing restriction** on casting or activating it. Read **all faces** (MDFC / split / transform) and report the union.
> Answer the following. **Prefer listing a key under `uncertain` over guessing** when genuinely ambiguous. Give a one-line `rationale` quoting the relevant text.
>
> 1. `junctures` — the set of **turn-structure steps** at which the card's **triggered abilities** fire. A triggered ability that
>    starts "At the beginning of …" or "during [a/each] … step" names a step. Map the named step to one of:
>    `untap` ("untap step"), `upkeep` ("upkeep"), `draw` ("draw step"),
>    `main-precombat` ("precombat main phase"), `main-postcombat` ("postcombat main phase"),
>    `begin-combat` ("beginning of combat" / "combat on your turn"), `declare-attackers` ("declare attackers step"),
>    `declare-blockers` ("declare blockers step"), `end-combat` ("end of combat step"),
>    `end-step` ("end step" / "beginning of the end step"), `cleanup` ("cleanup step"),
>    `turn` ("at the beginning of your/each turn" with no specific step), `other` (a step-like juncture not listed).
>    **A trigger on dealing or being dealt combat damage is NOT a juncture** — combat damage is an event, not "the beginning of a step";
>    leave such triggers out of `junctures`. Static/activated abilities and "When this enters / dies / attacks" triggers are **not** junctures either.
>    If the card has no turn-structure-step trigger, `junctures` is the empty set.
> 2. `junctureScope` — for the steps in `junctures`, **whose turn** the step belongs to (a set). Decide from the text:
>    `self` ("**your** upkeep/end step", "combat on **your** turn"), `opponent` ("**each opponent's** upkeep", "**each other player's** untap step"),
>    `any` ("**each** player's upkeep", "**each** end step" with no owner = all players), `unknown` (genuinely ambiguous).
>    Empty if `junctures` is empty. A card may have several (e.g. "your upkeep" + "each opponent's upkeep" → `self` and `opponent`).
> 3. `castTiming` — timing restrictions on **casting this spell or activating its abilities** (a set). Choose from:
>    `sorcery-speed` ("only as a sorcery", "only during your main phase … stack empty", "any time you could cast a sorcery"),
>    `flash` (the keyword **Flash**, "any time you could cast an instant", "as though it/they had flash"),
>    `combat-only` ("only during combat"), `your-turn-only` ("only during your turn"),
>    `once-per-turn` ("only once each turn"), `none` (no such restriction stated in the text).
>    A plain Instant or Sorcery with **no explicit restriction text** is `none` (its card type alone is not a `castTiming` token).
>    If none apply, answer `["none"]`.
>
> **Do not mention comprehensive-rules numbers. A "deals combat damage" trigger is an event, never a juncture.**

出力 `predictions.json`(LLM 推論=非決定。再生成せずコミット固定):
```jsonc
{ "model": "<codex model id>", "generatedAt": "...", "promptHash": "<sha256 of §9.2 prompt>",
  "predictions": [ { "oracleId": "...", "name": "...",
    "facts": { "junctures": ["upkeep"], "junctureScope": ["self"], "castTiming": ["none"],
               "uncertain": [], "rationale": "..." } } ] }
```

## 9.3 差分 / KPI(`scripts/timing-oracle-diff.ts` + `scripts/lib/timingOracleHarness.ts` / 純粋・決定的)
分類器側 = `timing-coverage/report.json.cards`。オラクル側 = `predictions[*].facts`。ゴールド = §9.4。
比較は**3軸独立**(junctures 集合差・junctureScope 集合差・castTiming 集合差)。`uncertain` に挙がったトークン
(`TimingStep` 値 / `ObserverScope` 値 / `CastTiming` 値)は**その軸の比較から除外**し当該カードを検証不能に数える
(Slice1〜3 の uncertain マスクと同型)。**`castTiming` は `[none]` を「制限なし」の確定値**として比較(空集合と区別しない:
分類器・オラクルとも制限なしは `['none']` を出す)。

```ts
import type { ObserverScope } from './eventClassify';
import type { TimingStep, CastTiming } from './timingClassify';

export interface TimingFacts {
  junctures: TimingStep[];
  junctureScope: ObserverScope[];
  castTiming: CastTiming[];
  uncertain: string[];        // TimingStep | ObserverScope | CastTiming
  rationale?: string;
}
export interface TimingCardDiff {
  oracleId: string; name: string;
  classifierJunctures: TimingStep[]; oracleJunctures: TimingStep[];
  junctureClassifierOnly: TimingStep[];     // 分類器のみ(オラクル基準 FP)
  junctureOracleOnly: TimingStep[];         // オラクルのみ(オラクル基準 FN)
  classifierScope: ObserverScope[]; oracleScope: ObserverScope[];
  scopeClassifierOnly: ObserverScope[]; scopeOracleOnly: ObserverScope[];
  classifierCastTiming: CastTiming[]; oracleCastTiming: CastTiming[];
  castTimingClassifierOnly: CastTiming[]; castTimingOracleOnly: CastTiming[];
  junctureAgree: boolean; scopeAgree: boolean; castTimingAgree: boolean;
  agree: boolean;             // 3軸とも一致(uncertain マスク後)
  hasUncertain: boolean;
  deltaSignature: string;     // juncture "+upkeep,-end-step" → scope "+@opponent" → cast "+flash,-none"。昇順・空なら "="
  attribution: null;          // Fable が監査で {substrate|compiler|oracle|ambiguous} を記入
}
export interface JunctureConfusion { step: TimingStep; classifierOnly: number; oracleOnly: number; agreeBoth: number; }
export interface ScopeConfusion { scope: ObserverScope; classifierOnly: number; oracleOnly: number; agreeBoth: number; }
export interface CastTimingConfusion { cast: CastTiming; classifierOnly: number; oracleOnly: number; agreeBoth: number; }
export interface JunctureCalibration { step: TimingStep; precision: number; recall: number; support: number; } // oracle vs gold
export interface Cluster { signature: string; count: number; examples: string[]; }
export interface TimingOracleReport {
  sampleSize: number; comparedCount: number;
  junctureDiscrepancyRate: number;      // junctureAgree=false かつ juncture uncertain でない / comparedCount
  junctureScopeDiscrepancyRate: number; // 同上(scope 軸)
  castTimingDiscrepancyRate: number;    // 同上(castTiming 軸)
  unverifiableRate: number;             // uncertain を持つカード / sampleSize(安全KPI)
  perJunctureConfusion: JunctureConfusion[];   // TIMING_STEPS 順
  perScopeConfusion: ScopeConfusion[];         // ObserverScope 順
  perCastTimingConfusion: CastTimingConfusion[]; // CAST_TIMINGS 順
  goldCalibration: JunctureCalibration[];      // ゴールド真値の juncture 別 precision/recall
  clusters: Cluster[];                         // deltaSignature 別・count 降順
  discrepancies: TimingCardDiff[];             // agree=false を deltaSignature, oracleId でソート
}
export function computeTimingReport(
  classifier: { oracleId: string; name: string; junctures: TimingStep[]; junctureScope: ObserverScope[]; castTiming: CastTiming[] }[],
  predictions: { oracleId: string; name: string; facts: TimingFacts }[],
  gold: { oracleId: string; junctures: TimingStep[]; junctureScope: ObserverScope[]; castTiming: CastTiming[] }[],
): TimingOracleReport;
```

KPI 対応(method §4):**主指標**= `junctureDiscrepancyRate`/`junctureScopeDiscrepancyRate`/`castTimingDiscrepancyRate`
(`clusters` で系統誤りを炙る)/**帰属**= `discrepancies[].attribution`(Fable 監査)/**物差し校正**= `goldCalibration`/
**検証不能**= `unverifiableRate`。出力 `research/timing-oracle/report.{md,json}`。report.json が大型なら `.gitignore`(report.md は残す)。

## 9.4 ゴールド真値(校正母数 = `review.timing-coverage` と同一の人手確定値)
`name`→`oracleId` 解決して付与。**これを真値**にオラクル予測の juncture 別 precision/recall を測る(校正に分類器を使わない=循環回避)。

| name | junctures | junctureScope | castTiming |
|---|---|---|---|
| Phyrexian Arena | upkeep | self | none |
| Bitterblossom | upkeep | self | none |
| Court of Grace | upkeep | self | none |
| Sulfuric Vortex | upkeep | any | none |
| Goblin Rabblemaster | begin-combat | self | none |
| Wilderness Reclamation | end-step | self | none |
| Seedborn Muse | untap | opponent | none |
| Dictate of Kruphix | draw | any | flash |
| Sword of Feast and Famine | (なし) | (なし) | none |
| Aggravated Assault | (なし) | (なし) | sorcery-speed |
| Seedtime | (なし) | (なし) | your-turn-only |
| Leyline of Anticipation | (なし) | (なし) | flash |
| Sol Ring | (なし) | (なし) | none |
| Llanowar Elves | (なし) | (なし) | none |
| Approach of the Second Sun | (なし) | (なし) | none |
| Grizzly Bears | (なし) | (なし) | none |

- **Sword of Feast and Famine は juncture の真値負例**(`deals combat damage` = Slice2 damage であって juncture でない。
  オラクル/分類器が `combat-damage` juncture を立てれば校正の FP として効く)。
- 負例(Grizzly Bears/Sol Ring/Llanowar Elves=タイミング参照なし→ `castTiming=[none]`)も含める。
- **Dictate of Kruphix は Flash キーワード + draw-step juncture の複合真値**(reminder 除去後も `Flash` 語が残る)。
- 名前解決できないゴールドは校正母数から除外し `report.md` に明示(silent に落とさない)。

## 9.5 分担・変更禁止(§5/§7.5/§8.5 と同一)
- **Fable**: 本節 / ESO Slice4 の trust 更新 / `engine-spec.md` §34.9 ログ / `review.timing-oracle.test.ts`・`review.timing-coverage.test.ts` / 監査帰属。
- **Codex(`scripts/` のみ)**: `scripts/lib/timingClassify.ts`(`classifyCardTiming`)/ `scripts/timing-coverage.ts` / `scripts/timing-oracle-sample.ts` / `scripts/timing-oracle-diff.ts` / `scripts/lib/timingOracleHarness.ts`(`computeTimingReport`)/ clean-room `predictions.json` / `package.json` script `timing-coverage`・`timing-oracle-sample`・`timing-oracle-diff` 追加 / 必要なら `.gitignore` に `research/timing-oracle/report.json`。`splitAbilityLines`・`mapScryfallCardToCardDef`・`removeReminderAndQuotes`・`eventClassify` の `ObserverScope` を再利用。
- **Codex 変更禁止**: `src/engine/`・`src/data/`・`review.*`・`docs/`・`CLAUDE.md`・`eslint.config.js`・`CACHE_SCHEMA_VERSION`・git。

## 9.6 iter1 収束判定(監査後 Fable)
- 同 `deltaSignature` が多数同方向に割れる → 系統的 substrate/分類器誤り(ESO or timingClassify regex を直す)。
- ゴールド校正で juncture/castTiming の precision/recall が低い → 物差し誤り(§9.2 prompt 改訂)。単発 → ノイズ。
- **`junctureOracleOnly` に `combat-damage` 類が出ないこと**(出れば prompt の damage≠juncture 注記を強化)。
- 結果を ESO Slice4 の `trust` 列へ反映(軸別:一致=検証済/割れ=不一致/uncertain=検証不能)。juncture/castTiming 不一致率・churn・被覆で Slice4 継続 or 収束方向を判断。**低 churn を収束と読まない**(method §4)。
