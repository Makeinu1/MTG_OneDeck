# 判定プロトコル(judge-protocol)— 判定者席の標準裁定準則

**正本性**: 判定者専有(実装エージェントは変更禁止)。判定者席の裁定様式を「判断の先払い」として lookup 可能な形に固めたもの。在席する判定者が誰であれ、**裁定の前にまずこの文書を引く**。ここに書いてある判断は判定者の地力を使わずそのまま適用してよい。権威順序 = CR(`rule/Magic_The_Gathering_Comprehensive_Rules.txt` 2026-06-19版)> 人間 gold > LLM(解釈のみ)。役割・フェイルオーバーの正本 = `AGENTS.md`「役割 = 能力で定義」節。

## 0. 判断が来たら最初にやること(コールドスタート手順)

新しい判定者セッションおよび圧縮復旧時の読込順（**本節が唯一の正本**）: `AGENTS.md`（自動読込）→ `npm run codex:context -- [--domain <id>]` の検証済み投影 → active brief → 本文書の該当節 → `.agents/skills/mtg-onedeck-development/references/document-governance.md`。投影は台帳SHA、健全性、選定domain、依存、active program、`.claude/loop-state.md`整合性だけを返す。通常はこの投影を使い、**台帳全文**を読むのは次の場合だけとする: コマンドがintegrity error/真の同点を返した、scope/北極星/契約原則を変える、履歴上の裁定を再確認する、または指定domainが投影不能。履歴は必要時だけ`cr-backbone-ledger-history.json`を読む。staleと判定されたloop-stateや圧縮要約のnext stepを正本扱いしない。その上で:

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

standing 裁定(2026-07-23ユーザー裁定): 最終ゴールを「通常Commander/EDHに必要なCR領域を、検査可能なGameStateと可逆なGameCommandへ章順に落とす」へ固定する。MyDeck実プレイ需要は順序の主因ではなく、実カード受け入れfixtureと同順位tie-breakに使う。ante・2HG・Planechase等の既存variant/pruned境界は明示scope外のまま維持する。

**優先度式** = ① fake-green/壊れた既存自動化/未監査実装を先に閉じる → ② 通常Commander/EDH scope 内で前提が満たされた**最若番CR章・節** → ③ 前提不足なら、そのCRを閉じるために必要な最小substrateだけ先行して元のCRへ戻る → ④ 同一CR・同一依存順位ならMyDeck実プレイ摩擦 → ⑤ さらに同値ならCommander実カードコーパス頻度(`score.ts` demandを含む) → ⑥ `edhValue`。

- この式で一意に決まる限り**自走してよい**(STOP しない)。
- 明示的なprogram優先は台帳の`goalPolicy.activeProgram.id`と順序付き`domainIds`だけを機械権威とする。`nextGate`、note、草稿、会話文は選定器が解釈しない。active programの先頭未完了entryがblockedなら別entryへskipせずfail closedし、全entryが`shipped`なら通常CR列へ戻る。
- ユーザーがactive program全体の完遂を明示認可した場合、判定者は同じsupervisor taskでserial cycleを継続してよい。各cycleのship後にexact-head release証拠・clean worktree・次domainの明示投影・新base/fingerprint/六項目envelopeを要求し、前cycle未完了中の後続作業は禁止する。
- ユーザーがprogram継続を明示しているのに`activeProgram`が未設定、壊れている、または自動投影がprogram外を返す場合、その自動選定は採用しない。在席判定者が`--domain <adjudicated-id>`で一意な対象を投影し、active-program台帳更新をjudge-owned作業として別に閉じる。
- design-slice(D0〜D7)の standing 裁定は `docs/design-playbook.md` にあるが、同文書は **historical**(D4 回復契約の再承認まで新規実行に使わない。現況 = `docs/README.md`)。新規 D-slice はこの式と北極星②で裁定する。
- STOP① に該当するのは次の3つだけ: (a) 上式でも真の同点かつ性質の異なる分岐 (b) 通常Commander/EDH scopeそのものの拡張・縮小 (c) 北極星・契約原則そのものの変更。旧 `judge: user-stop` / demand gateは、variant等のscope判断を表すものだけ維持する。
- **plannedSequence 補充手順**(常駐判定者で可): 実装者が候補草稿(`research/cr-grounding/planned-sequence-batch*.draft.md`・CR 条番号+通常Commander scope+依存関係必須、MyDeck fixtureは任意の受け入れ証拠)→ 在席判定者がCR原文・scope・依存へ照合し、上式で台帳へ充填する。複数CRを跨ぐcarryはCR領域ごとに分割する。

**ユーザー実プレイ報告のトリアージ(standing・2026-07-20 ユーザー裁定)**:

1. 報告を受けたら、まず台帳(domains の note/boundary・plannedSequence・carry 群)と既知 gap 一覧(`research/mydeck-scoring/playability/top-10-v1-gaps.md`)を grep する。
2. **既知**(台帳・spec 境界・DEFER 記録に載っている)→ ユーザーへ「既知。台帳の◯◯・対応予定は△△」と**差し返して**、現行スライスを中断せず続行する。差し返しは STOP ではない。
3. **未知** → 有界の調査(再現・CR 照合・原因の層の特定)を行い、結果を台帳へ記載(既存 domain の note か、replenishment レーンの plannedSequence 候補)してから続行する。実プレイを止める致命(キャスト経路凍結級)なら現行スライスに割り込んで外科修正してよい(既存の「数行規模の外科的修正」例外の範囲)。それ以外は記載のみ行い、優先度は §2 の式で通常どおり並ぶ。
4. いずれの場合も、報告は実カード受け入れfixtureと同CR順位tie-breakの一次ソースなので、記載時に頻度・退屈さ・深刻度のメモを残す(top-10 更新の入力になる)。

## 3. 許容差(allowance) vs 修正可能バグ

standing 裁定(2026-06 M0-Z で確定・以後不変): **新規 allowance 追加 0 件・divergent===0 を目標とする**。

判定手順: 不一致を CR に当てる →
- CR がこちらの実装を支持 → **物差し誤り**(却下・条番号併記)。
- CR がこちらの誤りを示す → **修正可能バグ**(直す)。
- 「粒度差として正当」という主張は**却下が既定**(過去に granularity-allowance 下書き3クラスタが全て修正可能バグだった実例)。
- どうしても allowance を新設したい場合は契約変更に相当 → §7 の格上げ手順へ。

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

standing 裁定(2026-07-08・北極星③「メタは遊びに従属する」): 実装ブリーフや spec 変更要求が**新しい GameCommand・GameState フィールド**を求めてきたら——

1. **分解可能性テストを先に課す**: 既存プリミティブ列(cost+search+move+shuffle 等)の合成で表現できるか実装者に試させる。表現できるなら**新抽象は却下**(合成で実装する。例: fetchland に `fetchLand` 一体コマンドを作らない)。
2. 合成不能の証明(**どのプリミティブが欠けるか**の特定)があるときのみ昇格。昇格時は **CR根拠 + golden + review + 実デッキ需要のセット**が必須(欠けたまま進めない=空の抽象の禁止)。
3. GameState フィールド追加は spec の意味変更 = **§7 の格上げ事項**。GameCommand 追加のみで有界・決定的・可逆(§5)を満たすなら常駐判定者で裁定可。
4. 本体 = `docs/engine-design-method.md` §9(6ステップ原則・A/B/C/D ルーティング・空のメタの禁止)。

## 6. Tier-2 帰属フローチャート(findings 赤旗の5分類)

赤旗1件ごとに上から順に問う(最初に Yes になった分類で確定):

1. 自分で1回再現を試して**再現しない** → `誤検出`
2. CR 条文と突き合わせて**実装が正しい** → `物差し誤り`(条番号を付けて却下)
3. 誤りが state モデル(zone/event/不変条件)にある → `substrate誤り`(spec 修正→実装修正の順)
4. state は正しいが oracle 文→コマンド列の翻訳が誤り → `compiler誤訳`(leaf の分類/filter/count を修正。undo 可逆=低リスク)
5. CR が一意に答えない/シナリオが underspecified → `曖昧`(§4 の手順へ)

後続アクション: `substrate誤り`/`compiler誤訳` → 実装者へ修正ブリーフ(最大2回・2連敗なら STOP④)。`曖昧` → 判定者が判例化。`誤検出`/`物差し誤り` → findings へ却下理由を書き戻す。

## 7. 還元不能時の手順(判定者は背伸びしない)

1. 台帳の plannedSequence note・judgeNote・judgePolicy を lookup
2. 本文書を lookup
3. `docs/`(engine-spec §34・engine-design-method §3・architecture-substrate-compiler)を grep して standing 裁定を探す
4. なお残る場合の格上げ先:

| 判断の種類 | 格上げ先 |
|---|---|
| 凍結判定・契約(spec の意味変更)承認・アーキ判断 | 判定者が決定・再オーナー化を保持。生の分析が要れば**実装者側の最上位モデルへ助言照会**(冷たい別セッション・助言のみ・盤面/契約は変えない=AGENTS.md「助言≠決定」)。判定者の**格上げ召喚は任意**(助言で足りなければ。現在値 = AGENTS.md「役割」節)|
| 価値判断・北極星/契約原則の変更・不可逆・外部書込 | **STOP→ユーザー**(`AGENTS.md` のループ全体4類。スライス選定STOP①だけは本書§2の3ケース) |

- 「照合に還元できるか自体が分からない」ときは §1 に戻る。それでも曖昧なら**格上げする**(誤って裁定するより1段譲る方が安い)。

## 8. タクソノミー/計測器の追加採否

テスト: 「**同型の裁定が台帳/findings に2回以上出現したか**」

- 2回以上 → 採用候補(preset 化すれば判定者の再発判断が1つ消える)。
- 1回以下 → 却下(判断を増やすだけの分類は作らない)。
- 採用時も lookup 化が条件(判定者が毎回考え直す分類は不可)。

## 9. モデル×役割の既定

`AGENTS.md`「役割 = 能力で定義」節が正本(本文書では重複させない)。機械作業(抽出・草稿・Tier-1・ship)+難草稿+助言はfresh-context実装者・別セッションへ。委譲要否・モデル/effort routing・上限・待機規律の正本 = `.agents/skills/mtg-onedeck-development/references/document-governance.md`「Roles and write ownership」「Execution and context budget」。

## 10. grammar レーン裁定準則(fail-closed 常設・2026-08-05 feel-1 教訓)

grammar レーン(oracle 文→command 変換)の選定・契約・監査で常時適用する:

1. **カバレッジゲートは decision 横断で完全か**: 節カバレッジ検査(engine-spec §34.54.2)が auto/guided 両経路で無条件に発動することを確認する。片方の decision だけ守るゲートは「緑に見える危険」を生む。
2. **g→m 遷移は fake-green 是正と分類する**: manual への降格は回帰ではなく信頼の回復。判定者は全件を「制約 silent drop 是正」「順序違反是正」「過剰拒否」の三類に分類し、過剰拒否ゼロを evidence に残す。
3. **allowlist 昇格は CR 対応付き**: engine 外メカニクス節の昇格には構文+CR 対応の明記と snapshot 遷移承認が要る。GameState 変更節は allowlist 不可。
4. **構文カバレッジと意味の正しさを混同しない**: カバレッジゲートは必要だが十分ではない。意味誤りは review.* テスト・冷監査・snapshot 遷移承認の三層で検出する。構文層を厚くしてもこの三層は省略できない。
5. **汎用英語パーサの提案は STOP①相当**: grammar レーンへの汎用パーサ(正規表現ベース・ライブラリベース問わず)導入提案は、北極星①と engine-spec §34.54.4 の standing に反する。ユーザー裁定(AGENTS.md 自律境界3類)へ格上げする。
6. **計器は流用優先**: 行レベル(`partialImplementation.ts`)・文節レベル(§34.54.2 カバレッジ)・カードレベル(行レベル派生)は同軸の別粒度。重複計器を追加せず、既存計器を流用する。
