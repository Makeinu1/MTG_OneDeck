---
description: 自律マイルストーン・ループ(無人で clear→milestone→codex→audit→ship→更新 を回す。判定者は判断だけ)
---

`$ARGUMENTS` があれば今回の起点マイルストーン指定として使う。無ければロードマップから自動選定。

**目的**: マイルストーン・サイクルを無人で回す。判定者(=CLAUDE.md「判定者ラダー」の在席最上位 Claude。最低ティア表に従う)は希少資源ゆえ**判断にだけ**使い、機械作業は全部 Codex/Sonnet/Explore(別 transcript=判定者文脈を汚さない)へ寄せる。理想状態=**Codex-bound**(両者の5時間予算を均衡消費)。起動は `/loop /autoloop`(interval 無し=自己ペース)。

## 1周の手順(判定者がやるのは判断4点だけ)

### 0. Bootstrap(判定者・薄)
Claude project memory index(`.../memory/MEMORY.md`) + **`research/cr-grounding/cr-backbone-ledger.json`(正本)** + **`docs/judge-protocol.md`(判定準則)** を読み、**次スライスを台帳から一意に選ぶ**(台帳の `selectionRule` に従う)。優先=**`plannedSequence` を先に消費**(判定者の standing 裁定)。枯渇時は `selectionRule` の**補充手順**(Codex 草稿→判定者照合・judge-protocol §2。J3 で可)で充填して続行。**STOP→`AskUserQuestion` は judge-protocol §2 の4類のみ**(優先度式で真の同点/Phase S/C 境界の「V4 前進 vs V1 磨き込み」/北極星・契約原則の変更/judge=user-stop domain)。要件化は「起案」でなく「台帳 lookup」。

### 1. 契約起案(Codex 草稿 → 判定者承認)
Codex を背景起動し、既存 R-FREEZE 設計から **engine-spec セクション草稿 + golden/敵対テスト草稿**を `research/cr-grounding/*.draft`(**CR 条番号併記**)へ出させる。判定者は **CR 照合して承認**し、`review.<key>` の最終 author だけ担い(=要石。実装者に書かせない)、契約を `docs/` へ昇格。**review.* は契約承認直後・実装待ちの間に、承認済み契約の形(コマンド名・shape・境界)から authoring する**——実装完了後に impl テストを読んでから書くのは①待ち時間を捨て②実装を見てピンを書く=独立性を弱める、の二重損。実装が契約から正当に逸脱した場合のみ Tier-2 裁定でピンを直す。Codex は `docs/`・`review.*`・`CLAUDE.md`・`AGENTS.md`・git 不可侵(共通則は `AGENTS.md` が常設で伝える=ブリーフはタスク固有のみ)。

### 2. 実装(Codex 背景・ハーネス追跡起動)
自己完結ブリーフ(対象ファイル・変更禁止・受け入れ条件・必須4チェック・defer/隔離の明示)を渡して Codex を**ハーネス追跡のバックグラウンド**で起動する: Bash ツール `run_in_background: true` で `codex exec --cd <repo> --sandbox workspace-write "$(cat <brief>)" < /dev/null 2>&1 | tee <scratchpad>/<key>-codex.log`。**`nohup`/`&` での切り離し起動は禁止**——切り離すと完了通知が来ず、復帰が常に wakeup フォールバック頼みになる(実測: ラウンドあたり10〜15分の純アイドル)。追跡起動ならプロセス終了=判定者が即再起動される。ログパスは loop-state に記録(compaction/clear 後の復旧用は従来どおり)。`ScheduleWakeup` は**純フォールバック**(1800s。完了通知が主・wakeup はハング/compaction 時の保険)。wakeup が鳴ってもまだ走っている時はログ tail の確認だけで再スケジュールする(深い文脈再読をしない)。

**パイプライン先行発注**: 実装 Codex を起動した直後、`plannedSequence[1]` の scoping 草稿を**並行の別 Codex セッション**へ発注する(出力は `research/cr-grounding/*.draft` レーンのみ・**src/ 書込み禁止をブリーフに明記**=スライス絡まりの構造的防止。前例: cr-120 は前置き草稿があったため scoping ラウンドを丸ごとスキップできた)。実装待ちの間、判定者は step 1 の契約先行 review.* authoring を行う。中断時は再実行(最大2回、それでも未完なら判定者外科仕上げ)。

### 3. 監査 Tier-1(別 Codex/Sonnet・委譲)
完了通知で起動。**実装の文脈を持たない別の冷たいセッション**へ**自己批判的・敵対的プロンプト**で出す(詳細=`/audit` Tier-1)。findings を `research/cr-grounding/<key>-tier1-findings.md` へ。**契約は変えない(findings only)**。判定者はここで raw diff を読まない。

### 4. 監査 Tier-2(判定者・薄)
findings の**赤旗だけ**読み `{substrate誤り/compiler誤訳/物差し誤り/曖昧/誤検出}` を裁定(`docs/judge-protocol.md` §6 のフローチャートに従う)。草稿 docs を独立に CR へ当てて**再オーナー化**(commit 前必須1回=judge-absent 条件の充足)。全緑なら次へ。差し戻しは Codex へ(理由明示)。

### 5. リリース準備 + ship(最大1回だけ委譲)
`/ship` 前に、出荷スライスの台帳 `status`/`evidence`/`plannedSequence` 更新と `research/cr-grounding/archive/<key>/` への packet 集約を同じ ship diff に含める。判定者は**ステージ明示リスト+コミットメッセージ+除外ファイル**を確定し、除外前に `git grep -n "<name>" -- docs/ research/` で契約参照を確認する。小さな隣接リーフ2件までの ship 同梱は判定者裁量で可(gate+ship+CI の固定費約15分を償却。前例=batch2 の1コミット出荷。監査スコープが広がるため義務ではない)。

`/ship` は Sonnet サブエージェント(`Agent` `model: sonnet`)へ**最大1回だけ**委譲してよい。ただし ship サブエージェントは実行者であり、`Agent` で再委譲してはならない。サブエージェントが「さらに委譲した」「待つ」と返した、commit SHA/`HEAD == origin/main`/対象 SHA の CI/Pages 200/worktree clean のいずれかを報告しない、または明らかに短時間・少数 tool-use で no-op と判断できる場合、判定者が即 inline 実行に切り替える。**CI 緑=本番 Pages 公開まで自走**(監査合格=認可)。

### 6. Post-ship 独立検証(判定者・薄)
ship 報告を鵜呑みにせず、判定者が実状態で `HEAD == origin/main`、対象 commit SHA の GitHub Actions success、Pages 200、`git status --short` clean を確認する。ここで repo mutation はしない。失敗した場合は次スライスへ進まず、fix/revert で台帳と実リリース状態を再整合してから `/audit`→`/ship` をやり直す。

### 7. Handoff & 継続(判定者・薄)
出荷結果と次フェーズ状態を Claude project memory + plan + `research/cr-grounding/cr-backbone-ledger.json` の次スライス lookup に記録・照合する。台帳の出荷済み status や archive 集約は Step 5 の ship commit に含め済みでなければならない。STOP 条件未該当なら次イテレーションへ継続——**背景作業の完了通知が主・`ScheduleWakeup` はフォールバック**(scoping 草稿待ち 600–900s / 実装待ち 1500–1800s / idle 1200–1800s)。STOP 該当なら一時停止して `AskUserQuestion`。

**儀式予算(集約規律・凍結/出荷境界ごと)**: 出荷済みマイルストーンが `research/cr-grounding/` に残した packet 群(handoff/review-sheet/decision-record/execution-queue/one-shot-brief/verify-*.mjs/patch 等の**判断履歴**)は、台帳の1行(`evidence`+`status`)に畳んだ上で `research/cr-grounding/archive/<key>/` へ移す。ディレクトリは**生きた契約**(台帳・golden-cases・現行 draft)のみを写し、決定履歴を溜めない。CLAUDE.md が真のボトルネックと呼ぶ「累積文脈の再読で判定者トークンを消尽」への直接の対策。**台帳・golden-cases・review.* は畳まない**(生きた正本)。

## ループ内状態の外部化(compaction 耐性)
auto-compact は閾値変更も無効化もできず、マイルストーン途中で宣言なしに発火しうる。台帳・memory・plan はマイルストーン粒度ゆえ、**ループ内位置は各 step 遷移(0→1→…→7)のたびに `.claude/loop-state.md` へ上書き**する(数行のみ: 現スライス key / 現 step / 背景実行中の作業(Codex・サブエージェント)/ 次アクション / 台帳未反映の中間判断)。step 7 完了時は「milestone complete・次スライス=台帳参照」へリセット。圧縮・clear 後は SessionStart hook(`.claude/hooks/session-recovery.sh`)が復旧手順を注入する——**圧縮要約の next step は仮説、台帳と loop-state が正**。loop-state は gitignore 済みの一時スクラッチ(commit しない)。

## STOP 条件(止まってユーザーに聞く=これだけ)
CI ゲート + git revert 可逆性が安全網。以下のみ停止:
1. **ロードマップ分岐の真の価値判断**(`docs/judge-protocol.md` §2 の優先度式=plannedSequence→demand 降順→edhValue→S-phase 依存順で一意に決まらない同点分岐・Phase S/C 境界の「V4 前進 vs V1 磨き込み」。**式で決まる選定は STOP せず自走**)。
2. **CR 解釈の真の曖昧**(CR で決定論的に解けない=人間 ruling。決定論的なら CR を引いて自走)。
3. **不可逆・外部書込**(通常 Pages push を超える=依存追加/更新・データ削除・外部 API 書込・秘密情報・北極星/契約原則の変更)。
4. **Codex 2連敗**かつ判定者が有界な外科修正で仕上げられない / CI が有界変更で直らない。

上記以外は無人続行。

## 判定者-spend 規律(自己監視)
判定者が **raw ソース精読 / 機械チェック自走 / diff 行読み / 契約・テスト初稿の自筆**をしていたら委譲漏れのシグナル。即 Codex/Sonnet/Explore へ寄せる。

## 周期メタレビュー
各フェーズ境界(or 3マイルストーンごと)に判定者が薄く自問: ①CR 完全性への最短路か ②袋小路でないか ③委譲は最大か ④両予算は均衡へ向かうか ⑤**製品価値**=MyDeck 実デッキで遊ぶ人が直近3スライスの差に気づくか。⑤が2回連続 No なら実デッキ需要(MyDeck 4デッキが踏む CR 領域)を `edhValue` より上位の優先度信号にする。ドリフト検知時は STOP 条件1へ。
