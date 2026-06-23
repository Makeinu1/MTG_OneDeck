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

---

## スライス2: イベント語彙(誘発/観測者/介在条件)

> ESO = [`engine-state-ontology.md`](engine-state-ontology.md) スライス2。下記はトリガ節→イベント軸の**雛形**。
> コーパス需要(頻度・代表)は `event-coverage` 抽出が確定させ、未分類の誘発節は adjudication 経由で本表へ追補する。
> 読みは英語 `oracleText` 正本のみ。注釈文・引用能力内のネスト誘発は当該カード自身の誘発と区別する。

| 構文(誘発節パターン) | → ESO | read | write(発行イベント/購読) | 備考 |
|---|---|---|---|---|
| `When/Whenever <obj> enters` | E-EV-ENTERS | ゾーン遷移(→戦場) | enters イベント購読 | ETB。最大族(≈5,036)。`enters tapped`/`enters with N counters` は別効果(置換)で族は enters |
| `Whenever <obj> dies` | E-EV-DIES | 戦場→墓地 | dies 購読 | CR700.4。`is put into a graveyard from the battlefield` も同族 |
| `When/Whenever <obj> leaves the battlefield` | E-EV-LEAVES | ゾーン遷移(戦場→) | leaves 購読 | dies は LTB の特化(別族で保持) |
| `Whenever <obj> is put into … / is exiled / returns to … hand / mills` | E-EV-ZONE | ゾーン遷移(非戦場) | zone 購読 | enters/leaves/dies 以外のゾーン移動 |
| `Whenever <player> casts <spell>` | E-EV-CAST | スタックへ | cast 購読 | 観測者スコープが重要(自/対戦相手/任意) |
| `Whenever <obj> attacks` | E-EV-ATTACKS | 戦闘・攻撃宣言 | attacks 購読 | `attacks alone`/`attacks a player` は絞り込み修飾 |
| `Whenever <obj> blocks (or becomes blocked)` | E-EV-BLOCKS | 戦闘・ブロック | blocks 購読 | — |
| `Whenever <obj> deals (combat) damage` | E-EV-DAMAGE | ダメージ発生 | damage 購読 | `deals combat damage to a player` は絞り込み |
| `Whenever <player> draws a card` | E-EV-DRAW | ドロー処理 | draw 購読 | 観測者スコープ重要 |
| `Whenever <player> discards` | E-EV-DISCARD | 捨て処理 | discard 購読 | — |
| `Whenever <obj> is/are sacrificed` / `Whenever you sacrifice` | E-EV-SAC | 生け贄処理 | sacrifice 購読 | 生け贄は**コスト**でもイベントを発行する |
| `Whenever <obj> becomes tapped/untapped` | E-EV-TAP | タップ状態遷移 | tap 購読 | — |
| `Whenever (one or more) counter(s) … placed on <obj>` | E-EV-COUNTER | カウンター設置 | counter 購読 | **スライス1 L7c(自身が +N/+N される)と区別**=ここは「設置イベントの観測」 |
| `Whenever <player> gains/loses life` | E-EV-LIFE | ライフ増減 | life 購読 | — |
| `At the beginning of [your/each] <upkeep/draw/combat/end step/…>` | E-EV-PHASE | ステップ juncture | phase 購読(CR703) | 観測者スコープ = `your`(self)/`each player's`(any)/`each opponent's`(opponent) |
| `When … , if <condition>` | E-INTERVENING-IF | 誘発時+解決時の二点条件 | (族は別途) | **`as long as …`(継続=スライス1 層)と弁別**。介在条件は誘発の一部 |

### 観測者スコープ(read 列の主体フィルタ — E-EVENT-OBSERVER)
| 構文 | observer | 備考 |
|---|---|---|
| `you …` / `a <obj> you control` / `this <obj>` | self | 既定。コントローラ=あなた |
| `an/each/target opponent …` / `<obj> an opponent controls` / `your opponents` | opponent | **多人数で各対戦相手へ分配**(V4) |
| `a player` / `each player` / `another <obj>`(コントローラ不問) | any | 自分も対戦相手も含む |
| `each other creature you control` 等の自軍集合 | controlled-set | self の集合版 |
| 判定不能(複合主体等) | unknown | 逃さない箱(force しない) |

### スコープ境界(本スライスでカタログ化しない)
- 反射誘発(CR603.12)・遅延誘発(CR603.7)・LKI 参照(「死亡したそれ」CR603.10)= 概念登録のみ(ESO 既知欠落)。
- SBA(CR704)・ターンベース処理(CR703)は**条文駆動の固定リスト**でカタログ対象外(コーパス頻度では測らない=ESO E-SBA/E-TBA)。
- 置換効果によるイベント発行抑止(CR614)= スライス1と同じく初期非対応(engine-spec §34.5)。
- 多人数の観測者分配の精密化は V4 スコープ。**だが observer 軸自体は本スライスで state に刻む**(後付けは最も戻しにくい再設計)。
