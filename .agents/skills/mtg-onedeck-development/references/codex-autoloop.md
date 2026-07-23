# Codex CLI 向け自律マイルストーン・ループ

`.claude/commands/autoloop.md`(Claude Code 固有)の Codex CLI 翻案。判定者セッションが1周を回す手順は同一。背景エージェントの代わりに**別ターミナルの Codex CLI セッション**を使う。

## 前提

- 判定者 = 本 Codex CLI セッション(qwen3.8-max-preview)。
- 実装者・冷監査者 = ユーザーが別ターミナルで起動する Codex CLI セッション。
- ブリーフの受け渡し = `/tmp/<key>_brief.md`(判定者が書き出し、ユーザーが別セッションへ渡す)。
- 相関遮断: 実装者セッションは判定者セッションの文脈を持たない。冷監査者は実装文脈も持たない。

## 1周の手順(判定者がやるのは判断4点だけ)

### 0. Bootstrap(判定者・薄)

**0a. 台帳健全性ガード(每ループ必須)**:
1. `cr-backbone-ledger.json` が parse 可能な JSON で、期待トップレベルキー(`object`/`plannedSequence`/`domains`/`selectionRule`/`statusDefinitions`/`judgePolicy`)が揃うことを確認。
2. `domains` 件数と `plannedSequence` 長を `git show HEAD:research/cr-grounding/cr-backbone-ledger.json` と比較。意図しない減少 = 喪失/上書きの兆候 → STOP③(データ損失=不可逆)→ `git checkout HEAD -- <ledger>` で復元。
3. 前ループから未 commit の台帳 delta があれば `git diff` で確認。競合書換なら判定者の版を正とし再オーナー化。

**0b. 最終ゴールから逆算 → 台帳更新(每ループ・薄)**:
台帳(正本) + `docs/judge-protocol.md` を読み、北極星(①CR完全性・②遊びの快感)と §2 優先度式(通常Commander scopeのCR章順+最小依存先行)から逆算。plannedSequence 順序・boundary・nextGate・status が今も最終ゴールと整合するか自問し、ズレを台帳へ反映。MyDeck需要は受け入れfixture/同CR順位tie-breakとして扱う。更新は当該周の ship commit に同梱(なければ小 `docs:` commit)。

**0c. 次スライス選定**:
台帳から次スライスを一意に選ぶ(`selectionRule` に従う)。`domains` と `plannedSequence` の live entry を `domainId` で統合し、`domains.status` を正、`crOrder` と `dependsOn` を選定キーとする。`plannedSequence` の配列位置は履歴であり優先順位ではない。候補枯渇時は補充手順(草稿→判定者照合・judge-protocol §2)。選定の STOP① は judge-protocol §2 の3ケース(真の同点・scope変更・北極星/契約原則変更)だけ。CR曖昧・不可逆判断・実装2連敗を含むループ全体の停止条件は `AGENTS.md` の4類を参照する。

### 1. 契約起案(実装者草稿 → 判定者承認)

実装者セッションへブリーフを出し、既存設計から **engine-spec セクション草稿 + golden/敵対テスト草稿**を `research/cr-grounding/*.draft`(CR 条番号併記)へ出させる。判定者は CR 照合して承認し、`review.<key>` の最終 author だけ担い(=要石)、契約を `docs/` へ昇格。

**review.* は契約承認直後・実装待ちの間に authoring する**(実装完了後ではない)。

実装者ブリーフの書き出し先: `/tmp/<key>_brief.md`。含めるのは**タスク固有のみ**(4行ヘッダ・目的・契約参照・スコープ境界・対象ファイル・golden ケース・受け入れ条件)。共通則は `AGENTS.md` が常設で伝えるため再掲しない。

### 2. 実装(別セッション)

ユーザーに「別ターミナルで Codex CLI を起動し、`/tmp/<key>_brief.md` を渡してください」と指示。実装者の完了報告を待つ。

実装者の不可侵(再掲不要・AGENTS.md 常設): git 操作禁止・`review.*` 変更禁止・`docs/` 直接変更禁止・`CLAUDE.md`/`AGENTS.md`/`eslint.config.js` 変更禁止。

### 3. 判定者独立照合(実装完了後)

実装者の完了報告を受け、判定者が独立に:
1. diff scope がブリーフ通りか確認(`git diff --stat`)。
2. `review.*` 未編集を確認。
3. 機械4点(`npm run check`)を独立に実行。
4. 実装者の「テスト通過」自己申告は合否判定に使わない。

### 4. Tier-1 冷監査(別セッション)

ユーザーに「別ターミナルで Codex CLI を起動し、`.claude/audit-standing.md` を読ませて凍結 diff を監査させてください」と指示。監査者は findings only でコード・契約を変更しない。

### 5. Tier-2 裁定(判定者)

findings を5分類(implementation / compiler / substrate / contract / ambiguity)。HIGH 以上は差し戻し。MEDIUM 以下は判定者裁量で許容または修正。

### 6. 修正→再検証

差し戻し時は実装者セッションへ修正ブリーフ。修正後は再検証に invalidated なチェックのみ再実行し、最終フルチェックは1回。

### 7. Ship(判定者)

`npm run check` 全緑 + `review.*` 緑を確認後、git add(明示ファイル指定)→ commit(conventional commits)→ push。CI success + Pages 200 を確認。台帳の status を `shipped` へ更新。

## ループ内状態の外部化

各 step 遷移(0→1→…→7)のたびに `.claude/loop-state.md` へ上書き(数行のみ: 現スライス key / 現 step / 別セッション実行中の作業 / 次アクション / 台帳未反映の中間判断)。step 7 完了時は「milestone complete・次スライス=台帳参照」へリセット。

**圧縮・セッション切断後の復旧**: `AGENTS.md`(自動読込) → 台帳 → `.claude/loop-state.md` → skill references の順で再読。loop-state は gitignore 済みの一時スクラッチ(commit しない)。

## STOP 条件(止まってユーザーに聞く=これだけ)

1. ロードマップ分岐の真の価値判断(judge-protocol §2 の優先度式で一意に決まらない同点分岐)。
2. CR 解釈の真の曖昧(CR で決定論的に解けない=人間 ruling)。
3. 不可逆・外部書込(通常 Pages push を超える=依存追加/更新・データ削除・外部 API 書込・秘密情報・北極星/契約原則の変更)。
4. 実装者2連敗かつ判定者が有界な外科修正で仕上げられない。

上記以外は無人続行。

## 判定者-spend 規律(自己監視)

判定者が raw ソース精読 / 機械チェック自走 / diff 行読み / 契約・テスト初稿の自筆をしていたら委譲漏れのシグナル。即 実装者セッション/スクリプトへ寄せる。

## 周期メタレビュー

各フェーズ境界(or 3マイルストーンごと)に判定者が全5問を薄く自問:
①CR 完全性への最短路か ②袋小路でないか ③委譲は最大か ④両予算は均衡へ向かうか ⑤製品価値=MyDeck 実デッキで遊ぶ人が直近3スライスの差に気づくか。
ドリフト検知時は STOP 条件1へ。
