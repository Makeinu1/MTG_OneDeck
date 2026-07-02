---
description: 自律マイルストーン・ループ(無人で clear→milestone→codex→audit→ship→更新 を回す。判定者は判断だけ)
---

`$ARGUMENTS` があれば今回の起点マイルストーン指定として使う。無ければロードマップから自動選定。

**目的**: マイルストーン・サイクルを無人で回す。判定者(=CLAUDE.md「判定者ラダー」の在席最上位 Claude。最低ティア表に従う)は希少資源ゆえ**判断にだけ**使い、機械作業は全部 Codex/Sonnet/Explore(別 transcript=判定者文脈を汚さない)へ寄せる。理想状態=**Codex-bound**(両者の5時間予算を均衡消費)。起動は `/loop /autoloop`(interval 無し=自己ペース)。

## 1周の手順(判定者がやるのは判断4点だけ)

### 0. Bootstrap(判定者・薄)
Claude project memory index(`.../memory/MEMORY.md`) + **`research/cr-grounding/cr-backbone-ledger.json`(正本)** を読み、**次スライスを台帳から一意に選ぶ**(台帳の `selectionRule` に従う)。優先=**`plannedSequence` を先に消費**(判定者の standing 裁定)。空なら `lane ∈ {backbone, late-backbone}` かつ `status < shipped`(drafted/implemented-not-green/review-green・`deferred` 除外)かつ `nextGate` 明確 の**最高 `edhValue`** へフォールバック。同点・`nextGate` 不明・価値トレードオフなら **STOP→`AskUserQuestion`**(下記 STOP 条件1=plannedSequence の次バッチ裁定)。要件化は「起案」でなく「台帳 lookup」。

### 1. 契約起案(Codex 草稿 → 判定者承認)
Codex を背景起動し、既存 R-FREEZE 設計から **engine-spec セクション草稿 + golden/敵対テスト草稿**を `research/cr-grounding/*.draft`(**CR 条番号併記**)へ出させる。判定者は **CR 照合して承認**し、`review.<key>` の最終 author だけ担い(=要石。実装者に書かせない)、契約を `docs/` へ昇格。Codex は `docs/`・`review.*`・`CLAUDE.md`・`AGENTS.md`・git 不可侵(共通則は `AGENTS.md` が常設で伝える=ブリーフはタスク固有のみ)。

### 2. 実装(Codex 背景)
自己完結ブリーフ(対象ファイル・変更禁止・受け入れ条件・必須4チェック・defer/隔離の明示)を渡して Codex 背景起動。`ScheduleWakeup` で待機(判定者非消費)。中断時は再実行(最大2回、それでも未完なら判定者外科仕上げ)。

### 3. 監査 Tier-1(別 Codex/Sonnet・委譲)
完了通知で起動。**実装の文脈を持たない別の冷たいセッション**へ**自己批判的・敵対的プロンプト**で出す(詳細=`/audit` Tier-1)。findings を `research/cr-grounding/<key>-tier1-findings.md` へ。**契約は変えない(findings only)**。判定者はここで raw diff を読まない。

### 4. 監査 Tier-2(判定者・薄)
findings の**赤旗だけ**読み `{substrate誤り/compiler誤訳/物差し誤り/曖昧/誤検出}` を裁定。草稿 docs を独立に CR へ当てて**再オーナー化**(commit 前必須1回=judge-absent 条件の充足)。全緑なら次へ。差し戻しは Codex へ(理由明示)。

### 5. リリース準備 + ship(最大1回だけ委譲)
`/ship` 前に、出荷スライスの台帳 `status`/`evidence`/`plannedSequence` 更新と `research/cr-grounding/archive/<key>/` への packet 集約を同じ ship diff に含める。判定者は**ステージ明示リスト+コミットメッセージ+除外ファイル**を確定し、除外前に `git grep -n "<name>" -- docs/ research/` で契約参照を確認する。

`/ship` は Sonnet サブエージェント(`Agent` `model: sonnet`)へ**最大1回だけ**委譲してよい。ただし ship サブエージェントは実行者であり、`Agent` で再委譲してはならない。サブエージェントが「さらに委譲した」「待つ」と返した、commit SHA/`HEAD == origin/main`/対象 SHA の CI/Pages 200/worktree clean のいずれかを報告しない、または明らかに短時間・少数 tool-use で no-op と判断できる場合、判定者が即 inline 実行に切り替える。**CI 緑=本番 Pages 公開まで自走**(監査合格=認可)。

### 6. Post-ship 独立検証(判定者・薄)
ship 報告を鵜呑みにせず、判定者が実状態で `HEAD == origin/main`、対象 commit SHA の GitHub Actions success、Pages 200、`git status --short` clean を確認する。ここで repo mutation はしない。失敗した場合は次スライスへ進まず、fix/revert で台帳と実リリース状態を再整合してから `/audit`→`/ship` をやり直す。

### 7. Handoff & 継続(判定者・薄)
出荷結果と次フェーズ状態を Claude project memory + plan + `research/cr-grounding/cr-backbone-ledger.json` の次スライス lookup に記録・照合する。台帳の出荷済み status や archive 集約は Step 5 の ship commit に含め済みでなければならない。STOP 条件未該当なら `ScheduleWakeup`(idle は 1200–1800s)でループ継続。該当なら一時停止して `AskUserQuestion`。

**儀式予算(集約規律・凍結/出荷境界ごと)**: 出荷済みマイルストーンが `research/cr-grounding/` に残した packet 群(handoff/review-sheet/decision-record/execution-queue/one-shot-brief/verify-*.mjs/patch 等の**判断履歴**)は、台帳の1行(`evidence`+`status`)に畳んだ上で `research/cr-grounding/archive/<key>/` へ移す。ディレクトリは**生きた契約**(台帳・golden-cases・現行 draft)のみを写し、決定履歴を溜めない。CLAUDE.md が真のボトルネックと呼ぶ「累積文脈の再読で判定者トークンを消尽」への直接の対策。**台帳・golden-cases・review.* は畳まない**(生きた正本)。

## STOP 条件(止まってユーザーに聞く=これだけ)
CI ゲート + git revert 可逆性が安全網。以下のみ停止:
1. **ロードマップ分岐の価値判断**(substrate-first 順で一意に決まらない・価値トレードオフ)。
2. **CR 解釈の真の曖昧**(CR で決定論的に解けない=人間 ruling。決定論的なら CR を引いて自走)。
3. **不可逆・外部書込**(通常 Pages push を超える=依存追加/更新・データ削除・外部 API 書込・秘密情報・北極星/契約原則の変更)。
4. **Codex 2連敗**かつ判定者が有界な外科修正で仕上げられない / CI が有界変更で直らない。

上記以外は無人続行。

## 判定者-spend 規律(自己監視)
判定者が **raw ソース精読 / 機械チェック自走 / diff 行読み / 契約・テスト初稿の自筆**をしていたら委譲漏れのシグナル。即 Codex/Sonnet/Explore へ寄せる。

## 周期メタレビュー
各フェーズ境界(or 3マイルストーンごと)に判定者が薄く自問: ①CR 完全性への最短路か ②袋小路でないか ③委譲は最大か ④両予算は均衡へ向かうか ⑤**製品価値**=MyDeck 実デッキで遊ぶ人が直近3スライスの差に気づくか。⑤が2回連続 No なら実デッキ需要(MyDeck 4デッキが踏む CR 領域)を `edhValue` より上位の優先度信号にする。ドリフト検知時は STOP 条件1へ。
