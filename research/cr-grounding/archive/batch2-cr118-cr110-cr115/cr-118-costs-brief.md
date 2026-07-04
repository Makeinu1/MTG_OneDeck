# Codex ブリーフ — cr-118-costs (batch2-1) Step 1: 契約草稿・測定

- 役割: 実装者(Codex)。判定者在席。
- git 禁止 / docs・review.*・CLAUDE.md・AGENTS.md 変更禁止。出力レーンは research/cr-grounding/ のみ。
- 常設共通則は AGENTS.md 参照(本ブリーフはタスク固有のみ)。
- 本 Step はコードを書かない。測定 + 草稿のみ。

## 目的

MyDeck 実デッキ最大需要(cost:activation 232 / cost:tap 201)に対し、§33 `compileAbilityCost`(src/engine/grammar/compile.ts)の auto カタログに**未写の決定論的起動コストイディオム**を demand 降順で洗い出し、昇格候補 + CR 条番号 + auto/guided/manual 分類 + golden/敵対テスト草稿を **research/cr-grounding/cr-118-costs.draft.md** へ出力する。

現状 auto カタログ: tap-self(`{T}`)/ sac-self(`Sacrifice this/it/~/<name>`)/ mana(非 `{X}`)。それ以外は全て manual(`unmodeled-cost`/`variable-x`)。§34.19 envelope・§34.11 mana catalog は凍結済ゆえ**触らない**。

## 測定タスク

1. `research/mydeck-scoring/gaps.json` と `research/mydeck-scoring/summary.md` から、`missing` に `cost:activation`/`cost:tap`/`cost:nonmana` を含む起動型行を抽出し、**未写コストイディオム**(現 compileAbilityCost が manual に落とす cost.raw 断片)を頻度降順で集計する。カード名・oracle 断片・出現数を表に。
2. 各イディオムを弁別: 「固定量・選択なし・自己言及」= auto 昇格可 / 「量や対象が選択を伴う」= guided / manual。判定は CR 定義条文を引いて根拠づける(auto 詐称なし)。
3. コーパス全体(scripts/grammar-compile 相当・17,491枚)での当該イディオム出現率も併記できれば併記(activation frontier への寄与見積り)。

## 昇格候補(判定者の primary hypothesis・測定で裏取り/反証すること)

- **Pay N life(固定 N)→ auto**: 決定論的・controller 自己言及。既存 `adjustLife`(delta -N)へ写す。CR 118.4 / 119.3。`Pay X life`(可変)は除外=manual。
- **Exile ~/this/it/<name>(自己追放コスト)→ auto**: sac-self と同型。既存 `moveCard`(to exile)へ写す。CR 601.2f / 701.13a。他パーマネント追放は除外=manual。

上記2つで足りるか、他に高 demand の未写決定論イディオムがあるか(例: 固定カウンター系は除外方針)を測定で確定する。

## 草稿 output(research/cr-grounding/cr-118-costs.draft.md)

以下を含める(**すべて CR 条番号併記**):
1. demand 測定表(イディオム × 出現数 × 代表カード × 分類 auto/guided/manual × 根拠 CR)。
2. §33 catalog 追補の契約草稿: `compileAbilityCost` が新 auto 成分をどう認識し(正規表現/トークン除去規則)、どの既存コマンド(`adjustLife`/`moveCard`)へ写すか。純粋・決定的・GameState 非依存・新 GameCommand 型ゼロを維持する記述。
3. reviewer 専有テストの**期待値草稿**(判定者が最終 author。Codex は期待値の素案のみ):
   - `review.grammar-cost`: pay-life-fixed / exile-self が auto、Pay X life / 他者 exile が manual、複合(`{T}, Pay 3 life, Sacrifice this creature`)が auto という pin 候補。
   - `review.g4-activate`: end-to-end golden の素案(Sol Ring / Mother of Runes / Priest of Fell Rites)。
4. defer/scope-boundary 明示: envelope 非再オープン、複雑コスト(convoke/delve/X/counter/discard/他者コスト/`Activate only as a sorcery`)は manual carry。

## 受け入れ条件

- 出力は research/cr-grounding/cr-118-costs.draft.md の1ファイルのみ(git 触らない)。
- 全昇格判定に CR 条番号 + demand 数値。auto 昇格は「固定量・選択なし・自己言及」に厳密限定(1つでも選択を伴えば guided/manual)。
- 実際の gaps.json オラクル文を証拠として引用(捏造しない)。measった数値のみ記載。
- 中断時は「実施済み/残作業」を明示。
