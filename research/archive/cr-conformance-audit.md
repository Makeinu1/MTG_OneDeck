# CR 準拠監査(Slice1/2/3 分類器 + runtime エンジン)

> 2026-06-24・Fable。手法改訂(`docs/engine-design-method.md` §3「CR を一次の決定論的権威に」)を受け、
> 既存の分類器と runtime を総合ルール `rule/Magic_The_Gathering_Comprehensive_Rules.txt` の決定論的条文に対して点検した。
> 目的 = LLM/直感に肩代わりさせていた決定論的判断が CR と食い違っていないかを炙り出す。

## 所見サマリ

M-CR-RECONCILE note(2026-06-26): 本監査は主に分類器/用語/既存 runtime 誘発検出の CR 接地を扱ったものであり、CR 状態遷移そのものの完全な検査ではない。CR 2026-06-19 固定後、統率者税(CR903.8)、マナ能力(CR605)、トークンの領域移動と消滅(CR111.7/704.5d)、誘発/SBA/優先権(CR603/704/117)、領域移動の新オブジェクト性(CR400.7)について、別途 `research/cr-grounding/golden-cases.json` を正本とする。

| 対象 | CR 条文 | 状態 | 措置 |
|---|---|---|---|
| Slice3 `zoneClassify` destroy/sacrifice | 701.8a / 701.21a | **🔴 違反→修正済** | destroy/sacrifice が `graveyard` を欠落(battlefield→owner's graveyard を取りこぼし)。iter3-b で CR 準拠化(本セッション・graveyard +1945) |
| Slice3 `zoneClassify` draw/discard/dies | 121.1 / 701.9a / 700.4 | ✅ 準拠 | iter3-a で導入・CR 一致 |
| Slice2 `eventClassify` dies/leaves | 700.4 | ✅ 準拠 | dies=creature 限定・非creature の戦場→墓地は `leaves` と弁別(iter3 ESO 裁定済) |
| Slice1 `layerClassify` | 613 | ✅ 準拠方向 | 層は CR613 と1対1。本監査での新規違反なし |
| **runtime `ruleClassifier.ts`/`triggers.ts` `trigger.death`** | **700.4 / 603.6c** | **🔴 違反→修正済** | 非クリーチャーの戦場→墓地を `trigger.death` と誤分類。`trigger.leaves`/`-other` を新設し death を creature/PW 限定へ(下記)。dies parity 14.23%→6.20% |
| **runtime `trigger.landfall`** | 401/603 | **🟡 緩い→精密化済** | `a land (you control) enters` を要求し ETB 土地サーチ誤検出を抑制(下記) |
| runtime SBA(状況起因処理) | 704 | ⚪ 不在(設計) | サンドボックス哲学=ルール非強制。M-CONTRACT 後の S-SBA で実装(既知欠落・バグでない) |
| runtime owner/controller フィールド | 108.4 / 110 | ⚪ 不在(設計) | `CardInstance` に owner/controller なし=Slice3 が今モデリング中の構造軸。substrate 未実装(バグでない) |
| runtime ゾーン分割(プレイヤー別) | 400.1 | ⚪ 不在(設計) | `zones: Record<ZoneId,string[]>` 全体共有。S-ZONES で実装(既知欠落) |

## ✅ 修正済: `trigger.death` の CR 準拠化(`src/data/ruleClassifier.ts` / `src/engine/triggers.ts`)

> **2026-06-24 解決**: パリティの母体は `ruleClassifier.ts`(既に `from the battlefield` を要求済)で、真の乖離は
> 「非クリーチャー permanent の戦場→墓地」を `trigger.death` と誤分類していたこと(CR 700.4 用語集=dies は creature/PW 限定、
> CR 603.6c=非クリーチャーの戦場→墓地/leaves the battlefield は leaves-the-battlefield 誘発)。
> `trigger.leaves` / `trigger.leaves-other` を新設し、`trigger.death` / `-other` を creature/PW 主語へ限定。
> 研究 `eventClassify` の dies/leaves 規則を runtime へミラー。結果: **dies parity 14.23%→6.20%**・leaves(research-only=0)を新規マッピング・
> card divergence 4.44%→3.49%・golden-replay 13/13 無回帰・機械4点緑。landfall も `a land (you control) enters` へ精密化。

### 当初の所見(参考・修正前)

```ts
case 'trigger.death':
  return /\b(?:dies|put into (?:a )?graveyard)\b/i.test(text);
```

- **CR 700.4**: 「The term *dies* means "is put into a graveyard **from the battlefield**."」= 死亡は**戦場から**墓地へ置かれた**クリーチャー**に限る。
- **違反**: `put into (?:a )?graveyard` 分岐が「**from the battlefield**」を要求していない。ゆえに
  - ライブラリ→墓地(mill)「a creature card is put into a graveyard from a library」
  - 手札→墓地(discard)「put into your graveyard」(任意ゾーン)
  を**死亡誘発として誤検出**する(CR 上は dies でない)。さらに creature 限定もない。
- **既知性**: 研究側 `eventClassify` は CR 準拠(dies/leaves 弁別済)。`classifierParity.ts`(eventFamily `dies` ↔ runtime `trigger.death`/`trigger.death-other`)が
  この乖離を**計測している**(過去計測=dies 族 ~14% 乖離。Rancor/Ichor Wellspring/Titania 等)。**メーターは鳴っているが runtime 未修正**。
- **修正方針**(別タスク・要 golden-replay + parity 再計測): `put into (?:a )?graveyard` 分岐に「`from the battlefield`(または `from anywhere` を含まない明示の戦場由来)」を要求。
  研究 `eventClassify` の `isDiesCondition` / leaves 規則を runtime へ伝播し parity 乖離を縮める(method §3 条件6=研究⇄runtime 乖離0 へ)。

## 🟡 `trigger.landfall`(`src/engine/triggers.ts:82`)
```ts
case 'trigger.landfall':
  return /\bland\b/i.test(text) && /\benters\b/i.test(text);
```
- 「land」と「enters」の共起だけ=「When this creature **enters**, search for a **land**」のような ETB 土地サーチを landfall と誤検出しうる。
- landfall = 「a land **you control** enters」(CR 準拠の上面 = 研究分類器側)。runtime は緩い。parity 対象に追加候補。

## 結論
- **能動実装の CR 違反は runtime `trigger.death`(確定)+ `trigger.landfall`(緩い)に集約**。いずれも研究分類器が CR 準拠で、parity メーターが乖離を見ている=
  「研究で正した分類を runtime へ伝播する」既定タスク(メモリ既出)で閉じる。**本監査は CR 接地でこれを再確認し landfall を追加**した。
- **SBA・owner/controller・ゾーン分割の不在は設計**(サンドボックス哲学 + substrate 未実装)であってバグでない。これらは M0 が今モデリングしている対象そのもの。
- **最大の収穫 = 手法の是正**: 決定論的問い(ゾーン遷移)を LLM-oracle で「予測」していたのを CR 真理テーブルへ移したこと(`zoneClassify` の destroy/sacrifice 違反はこの是正で初めて閉じた)。
