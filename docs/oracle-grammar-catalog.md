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
| `you control [enchanted/target] <perm>` / `gain control of` | E-LAYER-L2 | 対象集合 | controller | 期間=静的/until |
| `<obj> is/are/becomes a(n) <type/subtype>` / `Nonbasic lands are Mountains` | E-LAYER-L4 | 該当オブジェクト | cardTypes/subtypes/supertypes | 既存サブタイプ除去を伴う場合あり |
| `<obj> is/are/becomes <color|colorless>` | E-LAYER-L5 | 該当オブジェクト | colors | 明示的な色語のみ |
| `<obj> have/has/gain(s) <keyword>` / `lose(s) all abilities` / `can't have or gain` | E-LAYER-L6 | 該当オブジェクト | abilities / keyword set | キーワードカウンターも |
| `<this>'s power is equal to <count> ...`(P/T ボックス `*`) | E-LAYER-L7a + E-CDA | 動的カウント(墓地型数 等) | power/toughness | **CDA**・全領域機能 |
| `base power and toughness [is/are] X/Y` | E-LAYER-L7b | — | power/toughness | 設定(CR613.4b) |
| `<obj> gets +N/+N (until end of turn)` / `+1/+1 counter` | E-LAYER-L7c | — | power/toughness | 修整・解決由来の duration 含む |
| `switch <obj>'s power and toughness` | E-LAYER-L7d | power/toughness | power/toughness | 入替 |

### スコープ境界(本スライスでカタログ化しない)
- 層内依存関係の解決順(CR613.8)・置換効果の相互作用(CR616)= 初期非対応(engine-spec §34.5)。
- L1(コピー/裏向き)・L3(テキスト変更)は概念登録のみ。コーパス頻度を見てから着地先を詰める。
