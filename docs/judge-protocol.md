# 判定プロトコル（Judge Protocol）

判定者が CR と製品契約を同じ基準で照合するための簡潔な裁定準則。作業開始時は
`AGENTS.md` と `docs/generated/project-state.md` / `docs/project-state/index.json` で現在地・active milestone・next gate・pending judgment を確認し、対象契約を読む。`research/cr-grounding/cr-backbone-ledger.json` は CR scope・履歴・根拠の参照が必要な場合だけ使い、現在の作業選定や NOW authority には使わない。CR-grounding側のauthority境界は `research/cr-grounding/AUTHORITY.md` に従う。

## 1. 権威と決定論

権威の順序は、固定版 CR（`rule/Magic_The_Gathering_Comprehensive_Rules.txt`、
2026-06-19 版）> 人間の gold 判定 > LLM の解釈。決定論的な問いに LLM の予測を
物差しとして使わない。

次の三問で分類する。

| 問い | Yes の場合 |
| --- | --- |
| CR の条番号一つで結論が出るか | 決定論的。条番号を記録して終了 |
| 盤面状態と規則だけで結論が出るか | 決定論的。状態遷移の不変条件を記録 |
| 言い回しで結論が揺れうるか | 解釈的。以下の準則で判断 |

## 2. スコープと優先順位

対象は通常の Commander/EDH。ante、2HG、Planechase などの variant は既存CR-grounding資料で明示した境界の外に置く。

**現在どの作業を進めるかは Project State の active milestone / next gate / next work が上位の選定入力である。** 旧CR ledgerの planned sequence、activeProgram、nextGate相当の記録は履歴・候補・根拠であり、Project Stateを上書きしない。

Project StateがCR裁定またはCR-grounding内の候補選定を要求した場合だけ、次の順で判断する。

1. fake-green、既存自動化の破綻、未監査の実装を閉じる。
2. 前提が満たされた最も若い CR 章・節を選ぶ。前提不足なら、その CR を閉じる最小の substrate だけを先に実装する。
3. 同じ CR と依存順位なら、実プレイの摩擦が大きいものを先にする。
4. さらに同値なら、実カード受け入れ fixture の頻度と `edhValue` で決める。

この式で一意に決まらない scope の拡張・縮小、北極星や契約原則の変更、不可逆な変更は
ユーザーへ停止して確認する。CR-grounding資料の planned sequence に項目を補充する場合は、CR 条番号、
通常 Commander の scope、依存関係を明記し、判定者が原文と照合してから登録する。ただしその登録だけで Project State の next work は変わらない。

ユーザーの実プレイ報告は、まず Project State の既知 GAP / CONFLICT / pending judgment と active contract を照合する。既知なら予定を案内して現行作業を継続し、未知なら再現・CR 照合・原因層の特定を行い、必要ならCR-grounding資料の既存 domain note または補充候補へ記録してから Project State の作業選定へ戻す。キャスト経路を凍結する致命的不具合だけは現行作業へ割り込む。

## 3. allowance と不一致

新しい allowance は追加せず、`divergent === 0` を目標にする。不一致を CR に当て、
実装が CR を満たすなら物差し誤りとして却下し、CR が実装の誤りを示すなら修正する。
「粒度差だから正当」という理由だけで allowance を増やさない。新設が必要なら契約変更として
ユーザーへ格上げする。

## 4. ESO 境界

1. CR の定義条文を引く（例: dies=CR 700.4、destroy=701.8a、sacrifice=701.21a）。
2. 定義がない場合はCR-grounding資料の `judgeNote` または `docs/engine-state-ontology.md` の判例を引く。
3. なお曖昧なら、実装に必要な最小の read/write だけを採り、境界裁定を `judgeNote` に記録する。

ESO の境界は undo と履歴資料で戻せるため、誤って大きく自動化せず最小解釈で進める。

## 5. 自動化の境界

規則は「有界・決定的・可逆」の三条件をすべて満たす場合だけ slice 化する。満たさないものは
active contractの guided/manual 境界へ落とし、silent drop や半端な自動実行をしない。対応形は CR 根拠付きで列挙し、それ以外を明示的に手動境界へ送る。

### 抽象昇格

新しい `GameCommand` や `GameState` フィールドを求めるときは、先に既存 primitive
（cost、search、move、shuffle など）の合成で表現できるか確認する。合成できる一体型 command は
作らない。合成不能なら、CR 根拠、golden、review、実デッキ需要を揃えて昇格する。
`GameState` の意味変更は契約変更として扱う。

## 6. findings の帰属

赤旗ごとに、再現しない誤検出、CR が実装を支持する物差し誤り、state モデルの substrate 誤り、
oracle 文から command 列への compiler 誤訳、CR やシナリオが一意でない曖昧の順で分類する。
substrate 誤りと compiler 誤訳は実装修正へ渡し、曖昧は §4 の判例化を行う。

## 7. 還元不能な判断

まず Project State の pending judgment と active contract / traceability / acceptance を照合し、次に固定版CR、必要な判例・CR-grounding資料の順に確認する。旧ledgerの note や planned sequence は歴史的根拠として参照できるが、現在の milestone / next gate を決めない。

それでも決められない場合、契約・アーキテクチャ・価値判断・外部書込みはユーザーへ停止して
確認する。LLM は助言に限り、盤面・契約・Project Stateの裁定結果を勝手に確定しない。

## 8. grammar レーン

- 節カバレッジ検査は auto と guided の両経路で無条件に行う。
- manual への降格は信頼回復として扱い、制約の silent drop、順序違反、過剰拒否を分類する。
- engine 外メカニクスを昇格する場合は構文と CR 対応を併記し、状態変更は契約レビューを通す。
- 構文カバレッジは意味の正しさを代替しない。review テスト、冷たい読み取り専用レビュー、
  snapshot 遷移の三層を維持する。
- 汎用英語パーサの導入は北極星と active contract に反するため、ユーザー判断へ格上げする。
- 既存の行・文節・カード単位の計器を流用し、重複計器を追加しない。
