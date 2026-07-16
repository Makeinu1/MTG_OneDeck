---
description: 自律マイルストーン・ループ(無人で milestone→実装→audit→ship→更新 を同一セッションで回す。判定者は判断だけ)
---

`$ARGUMENTS` があれば今回の起点マイルストーン指定として使う。無ければロードマップから自動選定。

**目的**: マイルストーン・サイクルを無人で回す。判定者(=CLAUDE.md「役割 = 資源状態 → 割当」の判定者席)は希少資源ゆえ**判断にだけ**使い、機械作業は全部 実装者/サブエージェント/Explore(別 transcript=判定者文脈を汚さない)へ寄せる。理想状態=**実装者-bound**(両予算を均衡消費)。起動は `/loop /autoloop`(interval 無し=自己ペース)。**「1セッション=1マイルストーン」は手動運用の既定であり、本ループは同一セッション継続が意図された例外**(継続性は loop-state+台帳が担保=§ループ内状態の外部化)。

## 1周の手順(判定者がやるのは判断4点だけ)

### 0. Bootstrap(判定者・薄)

**0a. 台帳健全性ガード(每ループ必須・機械・過去事故対策)**: スライス選定の前に台帳の喪失/腐敗を検査する(過去に**台帳内容が全部消えた**事故・背景セッションの競合上書き=memory `ledger-is-judge-owned`)。機械チェック(python/git・判定者は結果だけ見る): (1) `cr-backbone-ledger.json` が parse 可能な JSON で、期待トップレベルキー(`object`/`plannedSequence`/`domains`/`selectionRule`/`statusDefinitions`/`judgePolicy`)が揃う。(2) `domains` 件数と `plannedSequence` 長を `git show HEAD:research/cr-grounding/cr-backbone-ledger.json` と比較し、**この周で意図した編集なしに件数が減っていたら喪失/上書きの兆候=STOP③(データ損失=不可逆)**→ `git checkout HEAD -- <ledger>` 等で復元し reconcile してから続行。(3) 前ループから未 commit の台帳 delta があれば `git diff` で中身を確認し、背景/並行セッションの競合書換でないことを確かめる(競合なら判定者の版を正とし再オーナー化)。異常なしなら 0b へ。

**0b. 最終ゴールから逆算 → 台帳更新(每ループ・薄)**: memory index(`.../memory/MEMORY.md`) + **台帳(正本)** + **`docs/judge-protocol.md`** を読み、**北極星(①CR完全性・②遊びの快感)と §2 優先度式(最上位=MyDeck 実プレイ需要)から逆算**して1–2行で自問: この選定候補は CR完全性への最短路上か/袋小路でないか/`plannedSequence` の順序・`boundary`・`nextGate`・`status` は今も最終ゴールと整合するか。**ズレを見つけたら台帳へ反映**(plannedSequence 再順序・boundary/nextGate 更新・新たに stale になった entry の status 訂正)。これは §周期メタレビュー ① を**每ループ薄く前倒し**したもの(全5問レビューは従来どおり境界)。台帳更新は当該周の ship commit に同梱(その周にスライスが出荷されないなら小さな `docs:` 単独 commit)。

**0c. 次スライス選定**: 台帳から**次スライスを一意に選ぶ**(`selectionRule` に従う)。優先=**`plannedSequence` を先に消費**(判定者の standing 裁定)。枯渇時は `selectionRule` の**補充手順**(草稿→判定者照合・judge-protocol §2。常駐判定者で可・草稿は現行の実装者=CLAUDE.md 役割表の現在値)で充填して続行。**STOP→`AskUserQuestion` は judge-protocol §2 の4類のみ**(優先度式で真の同点/Phase S/C 境界の「V4 前進 vs V1 磨き込み」/北極星・契約原則の変更/judge=user-stop domain)。要件化は「起案」でなく「台帳 lookup」。

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

`/ship` の委譲・成功検証の正本 = `.claude/commands/ship.md`(最大1回委譲・再委譲禁止・no-op 検出時は判定者が即 inline 切替。ここでは重複させない)。**CI 緑=本番 Pages 公開まで自走**(監査合格=認可)。

### 6. Post-ship 独立検証(判定者・薄)
ship 報告を鵜呑みにせず、判定者が実状態で `HEAD == origin/main`、対象 commit SHA の GitHub Actions success、Pages 200、`git status --short` clean を確認する。ここで repo mutation はしない。失敗した場合は次スライスへ進まず、fix/revert で台帳と実リリース状態を再整合してから `/audit`→`/ship` をやり直す。

### 7. Handoff & 継続(判定者・薄)
出荷結果と次フェーズ状態を Claude project memory + plan + `research/cr-grounding/cr-backbone-ledger.json` の次スライス lookup に記録・照合する。台帳の出荷済み status や archive 集約は Step 5 の ship commit に含め済みでなければならない。**每ループ standing(§腐敗ハイジーン)の #3 腐敗ドキュメント検査を回し**、見つかった腐敗の外科修正を当該周の ship commit(or 小 `docs:` commit)へ同梱する(次周の Step 0a/0b の健全性ガード・ゴール逆算更新へバトンを渡す)。STOP 条件未該当なら次イテレーションへ継続——**背景作業の完了通知が主・`ScheduleWakeup` はフォールバック**(scoping 草稿待ち 600–900s / 実装待ち 1500–1800s / idle 1200–1800s)。STOP 該当なら一時停止して `AskUserQuestion`。

**儀式予算(集約規律・凍結/出荷境界ごと)**: 出荷済みマイルストーンが `research/cr-grounding/` に残した packet 群(handoff/review-sheet/decision-record/execution-queue/one-shot-brief/verify-*.mjs/patch 等の**判断履歴**)は、台帳の1行(`evidence`+`status`)に畳んだ上で `research/cr-grounding/archive/<key>/` へ移す。ディレクトリは**生きた契約**(台帳・golden-cases・現行 draft)のみを写し、決定履歴を溜めない。CLAUDE.md が真のボトルネックと呼ぶ「累積文脈の再読で判定者トークンを消尽」への直接の対策。**台帳・golden-cases・review.* は畳まない**(生きた正本)。

## 腐敗ハイジーン + 実装前カバレッジ検証(每ループ standing・過去事故対策)
過去に (a) **台帳内容の全喪失**(背景セッションの競合上書き等)、(b) **長期未整理での docs 腐敗**(shipped code と docs の乖離が溜まる)が起きた。恒久対策として以下を每ループの**薄い** standing に組み込む(重い部分は機械/委譲=判定者トークンを守る。ユーザー裁定 2026-07-12)。

1. **台帳健全性ガード**(=Step 0a・每ループ機械): 喪失/競合上書きを JSON妥当性 + git HEAD との件数比較で検出し、異常なら STOP③(データ損失=不可逆)→ git 復元・reconcile。
2. **最終ゴール逆算 → 台帳更新**(=Step 0b・每ループ薄): 北極星①(CR完全性)から逆算して plannedSequence 順序・boundary・nextGate・status が今も最終ゴールと整合するか都度自問し、ズレを台帳へ反映。更新は当該周の ship commit(なければ小 `docs:` commit)に同梱。
3. **腐敗ドキュメント検査**(每ループ・委譲・findings only): 各周 docs/台帳の腐敗・stale を薄くスキャン(Explore/Sonnet へ委譲・判定者は findings 裁定のみ)。軸=(a) docs↔shipped code の矛盾(例: status=drafted なのに実装 shipped=cr-player-specific-zones で実検出した型)、(b) consumed draft が archive されず残存、(c) 台帳 note の stale(古い前提・誤記・誤番号)、(d) docs 内の dead file path / dangling `[[link]]` / 壊れた相互参照。**delta 検査に絞る**(前周からの差分・新規 stale のみ。全 docs のフル再監査は境界で行う=每回はしない)。外科修正は当該周の ship commit に同梱。
4. **実装前カバレッジ検証**(candidate-1 の学び・2026-07-12): 実装者へブリーフを出す**前に**、選定スライスが**実コーパス(約17,491枚 snapshot)に真のカバレッジを持つか**を軽い probe で確認(Explore/Sonnet・実カード件数と代表名)。**demand 数値だけを信じない**(demand 計器は上限・census 盲点で over/under-report する)。**カバレッジ 0/極小なら実装前に破棄・再スコープ**。前例=candidate-1「discard 固定N, draw that many」型は実カード**0件**を Tier-1 監査で初めて発見し実装+監査サイクルを浪費した(実 loot は全て up-to/any-number=別配線)。これで「作る前に需要を確かめる」(北極星③)を**実装コストの前**に効かせる。

## ループ内状態の外部化(compaction 耐性)
auto-compact は閾値変更も無効化もできず、マイルストーン途中で宣言なしに発火しうる。台帳・memory・plan はマイルストーン粒度ゆえ、**ループ内位置は各 step 遷移(0→1→…→7)のたびに `.claude/loop-state.md` へ上書き**する(数行のみ: 現スライス key / 現 step / 背景実行中の作業(Codex・サブエージェント)/ 次アクション / 台帳未反映の中間判断)。step 7 完了時は「milestone complete・次スライス=台帳参照」へリセット。圧縮・clear 後は SessionStart hook(`.claude/hooks/session-recovery.sh`)が復旧手順を注入する——**圧縮要約の next step は仮説、台帳と loop-state が正**。loop-state は gitignore 済みの一時スクラッチ(commit しない)。

## STOP 条件(止まってユーザーに聞く=これだけ)
CI ゲート + git revert 可逆性が安全網。以下のみ停止:
1. **ロードマップ分岐の真の価値判断**(`docs/judge-protocol.md` §2 の優先度式=plannedSequence→MyDeck 実プレイ摩擦→demand[補助]→edhValue→S-phase 依存順で一意に決まらない同点分岐・Phase S/C 境界の「V4 前進 vs V1 磨き込み」。**式で決まる選定は STOP せず自走**)。
2. **CR 解釈の真の曖昧**(CR で決定論的に解けない=人間 ruling。決定論的なら CR を引いて自走)。
3. **不可逆・外部書込**(通常 Pages push を超える=依存追加/更新・データ削除・外部 API 書込・秘密情報・北極星/契約原則の変更)。
4. **実装者2連敗**かつ判定者が有界な外科修正で仕上げられない / CI が有界変更で直らない。

上記以外は無人続行。

## 判定者-spend 規律(自己監視)
判定者が **raw ソース精読 / 機械チェック自走 / diff 行読み / 契約・テスト初稿の自筆**をしていたら委譲漏れのシグナル。即 Codex/Sonnet/Explore へ寄せる。

## 周期メタレビュー
**①CR 完全性への最短路か**(§0b)と**腐敗検査**(§腐敗ハイジーン #3)は**每ループ薄く**前倒し実施する(過去事故対策・ユーザー裁定 2026-07-12)。それに加えて各フェーズ境界(or 3マイルストーンごと)に判定者が**全5問**を薄く自問: ①CR 完全性への最短路か ②袋小路でないか ③委譲は最大か ④両予算は均衡へ向かうか ⑤**製品価値**=MyDeck 実デッキで遊ぶ人が直近3スライスの差に気づくか(実プレイ需要は §2 式で**常時最上位入力**[2026-07-16 ユーザー裁定]ゆえ、ここでは式②の反映が実際に起きているかの遵守確認)。ドリフト検知時は STOP 条件1へ。
