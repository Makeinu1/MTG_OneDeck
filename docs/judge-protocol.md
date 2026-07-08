# 判定プロトコル(judge-protocol)— 判定者席の標準裁定準則

**正本性**: 判定者専有(実装エージェントは変更禁止)。Fable 5(J1・〜2026-07-07)が自らの裁定様式を「判断の先払い」として lookup 可能な形に固めたもの。以後の判定者(J2 Opus / J3 Sonnet / J0)は、**裁定の前にまずこの文書を引く**。ここに書いてある判断は判定者の地力を使わずそのまま適用してよい。権威順序 = CR(`rule/Magic_The_Gathering_Comprehensive_Rules.txt` 2026-06-19版)> 人間 gold > LLM(解釈のみ)。

## 0. 判断が来たら最初にやること(コールドスタート手順)

新しい判定者セッションの読込順: `CLAUDE.md` → 本文書 → 台帳 `research/cr-grounding/cr-backbone-ledger.json`(plannedSequence / selectionRule / judgePolicy)→ 直近 memory。**圧縮(auto-compact)後の復旧にも同じ読込順を適用**し、`.claude/loop-state.md` が存在すればループ内位置(autoloop の現 step・背景作業)の正とする(圧縮要約の next step は仮説として扱う)。その上で:

1. その判断は**決定論的か**? → §1 の3問テスト
2. 決定論的 → **CR を引いて終了**(条番号を成果物に併記)。prompt 再走・再考・多数決をしない
3. 解釈的/価値判断 → §2〜§8 の該当準則を lookup してそのまま適用
4. どの準則にも当たらない → §7 の還元不能手順(格上げ)

## 1. 決定論/解釈の弁別3問テスト

| 問 | Yes なら |
|---|---|
| Q1. CR が一意に答えるか(条番号1つを引けば結論が出るか) | 決定論的 |
| Q2. 盤面状態+規則だけで結論が出るか(好み・美観・優先度が混ざらないか) | 決定論的 |
| Q3. プロンプトの言い回しを変えると答えが揺れうるか | 解釈的 |

- Q1 or Q2 = Yes → CR を引いて自走終了。**LLM 物差しに予測させない**(決定論的軸への LLM は純粋ノイズ)。
- Q3 = Yes → 解釈的。物差し(LLM-oracle 盲予測・人間 gold)や本文書の準則の対象。
- precedent: 「sacrifice→graveyard か?」を物差し prompt 3回再走で誤収束しかけた(CR 701.21a 一行で即決だった)。迷ったらまず条番号を探す。

## 2. スライス選定(autoloop step 0 / STOP① の運用)

standing 裁定(ユーザー委譲済み: 2026-06-30 北極星=CR完全性・2026-07-02 demand-first 再優先):

**優先度式** = ① `plannedSequence` 先頭を消費 → ② 枯渇時: MyDeck demand 実測値(`research/mydeck-scoring/` の read/write カウント)降順 → ③ 同値なら `edhValue` → ④ 同値なら S-phase 依存順(substrate が下のものから)。

> **⚠ 計器故障の暫定則(2026-07-07 J2 Opus・`score-ts-demand-catalog-repair` 出荷まで有効)**: 式②の demand 実測値は、`scripts/mydeck-scoring/score.ts` が実コンパイラ(`compile.ts`)を参照せず並行テキスト分類器のみで coverage 判定する構造欠陥により、`cost:*`/`mana:*`/`action:*`/`tap-state:*`/`damage:*`/`life:*`/`counter:*`/`target:*`/`token:*` の9 family で**実装済みでも常に「未対応」と誤計上される**(例: Sol Ring `{T}: Add {C}` すら gap)。この修復が出荷されるまで、**式②の demand 信号は classifier-backed family(`event:*`/`zone:*`/`layer:*`/`timing:*`)のみ信頼**する。9 family の大きな数値は優先度信号にせず「unknown=要 `compile.ts` 手動 spot-check」として扱う。修復仕様=`research/cr-grounding/score-ts-demand-catalog-repair.draft.md`。

- この式で一意に決まる限り**自走してよい**(STOP しない)。
- **design-slice(D0〜D7)の裁定は、まず `docs/design-playbook.md` を引く**(実行カード§3・裁量境界§4・検証レシピ§2。デザインの価値判断はFableが先払い済み=後継は照合と検証のみ。2026-07-09 ユーザー裁定でD-トラック先行)。
- STOP① に該当するのは次の4つだけ: (a) 式で真の同点かつ性質の異なる分岐 (b) Phase S/C 完了境界の「V4 前進 vs V1 磨き込み」(予約済み価値判断) (c) 北極星・契約原則そのものの変更 (d) `judge: user-stop` マークの domain。
- **plannedSequence 補充手順**(J3 で可): Codex が demand データから候補草稿(`research/cr-grounding/planned-sequence-batch*.draft.md`・CR 条番号+demand 数値必須)→ 在席判定者が CR 原文と demand 数値へ照合して台帳へ充填。真の価値分岐のみ STOP①。

## 3. 許容差(allowance) vs 修正可能バグ

standing 裁定(2026-06 M0-Z で確定・以後不変): **新規 allowance 追加 0 件・divergent===0 を目標とする**。

判定手順: 不一致を CR に当てる →
- CR がこちらの実装を支持 → **物差し誤り**(却下・条番号併記)。
- CR がこちらの誤りを示す → **修正可能バグ**(直す)。
- 「粒度差として正当」という主張は**却下が既定**(過去に granularity-allowance 下書き3クラスタが全て修正可能バグだった実例)。
- どうしても allowance を新設したい場合は契約変更に相当 → J2 召喚 or STOP。

## 4. ESO 境界(ambiguous)裁定手順

1. CR の定義条文を引く(例: dies=CR 700.4、destroy=701.8a、sacrifice=701.21a)→ 定義があれば決定論的=終了。
2. なければ台帳 judgeNote / `docs/engine-state-ontology.md` の判例を lookup。
3. 判例もなければ: **最小解釈**(実装が要求する最小の read/write に限定)で自走し、judgeNote へ境界裁定を必ず記録(次回から判例=lookup になる)。STOP しない — ESO 境界は可逆(undo/台帳で戻せる)。

## 5. スコープ境界の一般基準

テスト: その規則は「**有界・決定的・可逆**」に盤面再現できるか。

| 条件 | 意味 |
|---|---|
| 有界 | 対象カード集合/構文形が列挙可能 |
| 決定的 | 同入力同出力(乱数はコマンド生成時に確定) |
| 可逆 | undo で必ず戻る(コンパイラは `GameCommand` 列のみ生成) |

- 3つとも Yes → スライス化してよい。1つでも No → engine-spec §34.5 の初期非対応(層相互作用 CR613.8・複数置換 CR616 等は既定で非対応)。
- 境界の**縮小**(defer 追加)は判定者裁量。境界の**拡張**(§34.5 から外す)は STOP①。
- 各 leaf は「**auto 詐称なし**」規律: 対応形を CR 根拠付きで列挙し、それ以外は manual へ落とす(silent drop・半端実行の禁止)。

## 5.1 抽象昇格テスト(新 GameCommand / GameState 追加の裁定)

standing 裁定(2026-07-08 J1・北極星③「メタは遊びに従属する」): 実装ブリーフや spec 変更要求が**新しい GameCommand・GameState フィールド**を求めてきたら——

1. **分解可能性テストを先に課す**: 既存プリミティブ列(cost+search+move+shuffle 等)の合成で表現できるか Codex に試させる。表現できるなら**新抽象は却下**(合成で実装する。例: fetchland に `fetchLand` 一体コマンドを作らない)。
2. 合成不能の証明(**どのプリミティブが欠けるか**の特定)があるときのみ昇格。昇格時は **CR根拠 + golden + review + 実デッキ需要のセット**が必須(欠けたまま進めない=空の抽象の禁止)。
3. GameState フィールド追加は spec の意味変更 = **J2 召喚**事項(§7)。GameCommand 追加のみで有界・決定的・可逆(§5)を満たすなら J3 で裁定可。
4. 本体 = `docs/engine-design-method.md` §9(6ステップ原則・A/B/C/D ルーティング・空のメタの禁止)。

## 6. Tier-2 帰属フローチャート(findings 赤旗の5分類)

赤旗1件ごとに上から順に問う(最初に Yes になった分類で確定):

1. 自分で1回再現を試して**再現しない** → `誤検出`
2. CR 条文と突き合わせて**実装が正しい** → `物差し誤り`(条番号を付けて却下)
3. 誤りが state モデル(zone/event/不変条件)にある → `substrate誤り`(spec 修正→実装修正の順)
4. state は正しいが oracle 文→コマンド列の翻訳が誤り → `compiler誤訳`(leaf の分類/filter/count を修正。undo 可逆=低リスク)
5. CR が一意に答えない/シナリオが underspecified → `曖昧`(§4 の手順へ)

後続アクション: `substrate誤り`/`compiler誤訳` → Codex へ修正ブリーフ(最大2回・2連敗なら STOP④)。`曖昧` → 判定者が判例化。`誤検出`/`物差し誤り` → findings へ却下理由を書き戻す。

## 7. 還元不能時の手順(下位判定者は背伸びしない)

1. 台帳の plannedSequence note・judgeNote・judgePolicy を lookup
2. 本文書を lookup
3. `docs/`(engine-spec §34・engine-design-method §3・architecture-substrate-compiler)を grep して standing 裁定を探す
4. なお残る場合の格上げ先:

| 判断の種類 | 格上げ先 |
|---|---|
| 凍結判定・契約(spec の意味変更)承認・アーキ判断 | **J2(Opus 4.8)を召喚**(その判断のセッションだけ) |
| 価値判断・北極星/契約原則の変更・不可逆・外部書込 | **STOP→ユーザー**(autoloop 4類は不変) |

- 「照合に還元できるか自体が分からない」ときは §1 に戻る。それでも曖昧なら**格上げする**(誤って裁定するより1段譲る方が安い)。

## 8. タクソノミー/計測器の追加採否

テスト: 「**同型の裁定が台帳/findings に2回以上出現したか**」

- 2回以上 → 採用候補(preset 化すれば判定者の再発判断が1つ消える)。
- 1回以下 → 却下(判断を増やすだけの分類は作らない)。
- 採用時も lookup 化が条件(判定者が毎回考え直す分類は不可)。

## 9. モデル×役割の既定

CLAUDE.md「判定者ラダー」と「トークン経済」の表が正本(本文書では重複させない)。要点のみ: **7/8 以降の既定は J3 Sonnet 5 が判定者席に常駐**し、§7 の表に該当する判断だけ J2 Opus 4.8 を召喚する。機械作業(抽出・草稿・Tier-1・ship)は Codex/Haiku/Sonnet サブエージェントへ。判定者が raw ソース精読・diff 行読み・契約初稿の自筆を始めたら委譲漏れのシグナル。
