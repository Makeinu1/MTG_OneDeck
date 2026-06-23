# オラクル文法 ⇄ 状態変異カタログ

> M0 モデリング・サイクルの生きた成果物②。正本手法 = [`engine-design-method.md`](engine-design-method.md) §1。
> ESO = [`engine-state-ontology.md`](engine-state-ontology.md)。
>
> 本文書は **コードではない**。各文法構文(効果アトム・誘発条件・期間・対象フィルタ・モード・コスト節…)を、
> **ESO のどの変数の read/write 列に1対1で写すか**を定義する。これが将来のコンパイラ(IR→commands)の
> 着地先契約になる。M0 各スライスで増補し、収束後に engine-spec §34 へ凍結する。

## 規約

| 列 | 意味 |
|---|---|
| 構文(オラクル節パターン) | 英語 `oracleText` 正本での節の形 |
| → ESO エントリ | 写し先の ESO 変数(`engine-state-ontology.md`) |
| read | 読む有効特性 |
| write | 書く有効特性(= 該当層) |
| 備考 | duration / CDA / スコープ境界 等 |

---

## スライス1: 有効特性 + 層オントロジー

> 下記は層スライスの**雛形**。コーパス需要(頻度・代表)は `layer-coverage` 抽出が確定させ、
> 未分類の節は ESO の adjudication リスト経由で本表へ追補する。

| 構文(節パターン) | → ESO | read | write(層) | 備考 |
|---|---|---|---|---|
| `<this> enters as a copy of <obj>` / `<obj> becomes a copy of <obj>` / `have it become a copy of` | E-LAYER-L1a | 該当オブジェクト | コピー可能値(基点) | **iter4昇格**(概念登録→実被覆)。自オブジェクトが恒久/期限付きでコピーになる(CR707)。**コピー節は L4/L6 を発火させない**(型・能力はコピー可能値=L1 で処理)。`except it's a(n) <type> in addition`(Metamorph/Mockingbird)等の**明示的追加節があるときのみ** L4/L6 を併記 |
| `you control [enchanted/target] <perm>` / `gain control of` | E-LAYER-L2 | 対象集合 | controller | 期間=静的/until。**`you control that/this …`(関係節)は control 変更でない**=L2 を発火させない(iter4: Marvin 誤発火) |
| `<obj> is/are/becomes a(n) <type/subtype>` / `Nonbasic lands are Mountains` | E-LAYER-L4 | 該当オブジェクト | cardTypes/subtypes/supertypes | 既存サブタイプ除去を伴う場合あり。**iter4境界**: `a(n)` の後の語が層を決める。`copy`/`additional` 等の**小文字一般語は型でない**(大文字サブタイプ=Goblin/Elemental 等、または既知 type-word のみ L4)。`It's a(n) <type>`(縮約 It's)も型変更=L4(Enduring 系) |
| `<obj> (isn't\| is no longer) a(n) <type>`(条件付き否定) | E-LAYER-L4 | 該当オブジェクト | cardTypes | **iter2追加**。「as long as … isn't a creature」(Purphoros/Heliod)。条件付きゆえ CDA ではない(CR604.3a-5) |
| `<obj> is/are/becomes <color|colorless>` | E-LAYER-L5 | 該当オブジェクト | colors | 明示的な色語のみ |
| `<obj> have/has/gain(s) <keyword>` / `lose(s) all abilities` / `can't have or gain` | E-LAYER-L6 | 該当オブジェクト | abilities / keyword set | キーワードカウンターも |
| `<obj> have/has/gain(s) "<引用された能力>"`(非キーワード/起動型の付与) | E-LAYER-L6 | 該当オブジェクト | abilities | **iter2追加**。「Lands you control have "{T}: Add …"」(Chromatic Lantern/Cryptolith Rite)。**カード自身の能力行(同文の非付与版)は付与でない**ため誤計上しない |
| `<this>'s power is equal to <count> ...`(P/T ボックス `*`) | E-LAYER-L7a + E-CDA | 動的カウント(墓地型数 等) | power/toughness | **CDA**・全領域機能 |
| `base power and toughness [is/are] X/Y` | E-LAYER-L7b | — | power/toughness | 設定(CR613.4b) |
| `becomes a(n) N/N … <type>`(アニメート) | E-LAYER-L7b + E-LAYER-L4 | — | power/toughness + cardTypes | **iter3追加**。「This land becomes a 1/1 … artifact creature」(Blinkmoth Nexus 等マンランド)。P/T設定(L7b)かつ型変更(L4) |
| `<obj> gets +N/+N (until end of turn)` / `put a +1/+1 counter on <obj>` | E-LAYER-L7c | — | power/toughness | 修整・解決由来の duration 含む。**iter4境界(L7c 誤発火を除外)**: (a) 注釈文 `(… gets +1/+1 …)`、(b) 生成トークンの入れ子引用能力 `token with "… gets +1/+1 …"`、(c) **条件参照** `creature … with a +1/+1 counter on it`(カウンター設置でなく保有判定)は当該カードの継続 P/T 修整**でない**=発火させない。**`gets +N/+N for each <count>` は L7c(修整)であって L7a(CDA)ではない** |
| `double the power and toughness of <obj>`(乗算) | E-LAYER-L7c | power/toughness | power/toughness | **iter2追加**。+N/+N 形でない倍化(Unnatural Growth) |
| `switch <obj>'s power and toughness` | E-LAYER-L7d | power/toughness | power/toughness | 入替 |

### スコープ境界(本スライスでカタログ化しない)
- 層内依存関係の解決順(CR613.8)・置換効果の相互作用(CR616)= 初期非対応(engine-spec §34.5)。
- **L1a コピー(継続)は iter4 で実被覆へ昇格**(上表)。L1b(裏向き)・L3(テキスト変更)は概念登録のみ。
- **ワンショットのコピー/カウンター操作は継続層スコープ外**(iter4 裁定 = ambiguous):
  - `create a token that's a copy of <obj>`(Helm of the Host / Caretaker's Talent)= トークン生成時のコピー値設定。`classifyContinuousLayers` は `isOneShotCopyTokenLine` で除外=妥当。
  - カウンターの**移動/連動付与**(The Ozolith / Spymaster's Vault の connive)= カウンター・オブジェクト操作であり当該カードの継続 P/T 効果でない。
  - これらは将来 ESO の別エントリ(イベント語彙=スライス2)で扱う。
- iter2 残ギャップ「becomes a N/N creature」(base 表記なし)は **iter3 で閉鎖**(上表 L7b+L4 行)。
