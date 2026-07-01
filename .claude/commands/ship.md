---
description: 監査合格後にコミット→push→CI→Pages確認(機械的リリースゲート・委譲可)
---

監査(`/audit`)に合格した変更だけをリリースする。

**実行方針(2点)**:
- **自走**: 監査(機械チェック4点 `lint`/`tsc`/`vitest`/`build` + `review.*` 緑)が合格していれば、**その合格を認可とみなし人間の確認を待たず自走でリリースする**(push/Pages 公開を含む)。テストが1つでも落ちていれば ship しない(直してから/audit を最初からやり直す)。
- **委譲(トークン節約)**: 本ワークフローは機械的ゆえ、**Opus を消費せず Haiku または Sonnet のサブエージェント(`Agent` の `model: haiku`/`sonnet`)へ最大1回だけ委譲してよい**。委譲する場合、オーケストレータ(Fable)は次を渡す: ①**ステージ対象ファイルの明示リスト**(`-A` 禁止のため列挙)②**コミットメッセージ全文**(type + 本文・署名なし)③**絶対に含めないファイル**(別セッションの作業・`Mydeck/`・gitignore対象)。サブエージェントは**実行者でありオーケストレータではない**ため、`Agent` で再委譲したり「さらに委譲したので待つ」と返したりしてはならない。再委譲・待機報告・commit SHA/CI/Pages の欠落は no-op 失敗とみなし、Fable が即 inline 実行へ切り替える。

0. **再委譲禁止ゲート**: この `/ship` を実行中のサブエージェントは `Agent` を呼ばない。自分で下記1〜7を実行できない場合は「BLOCKED: ship executor cannot run step N」と報告して止まる。Fable はサブエージェントの結果を信頼せず、下記成功条件を実 git/CI/Pages で独立検証する。
1. **pre-push gate**: 機械チェック4点を各個に再実行する: `npm run lint` / `npx tsc --noEmit` / `npx vitest run` / `npm run build`。1つでも落ちたら ship しない。既に対象 commit が `HEAD == origin/main` にあり worktree clean の場合も、同じゲートを再検証して「already shipped」と報告する(新規 commit は作らない)。
2. **明示ステージング**: `git add <変更ファイルを列挙>`。`-A` 禁止。**`Mydeck/` と gitignore対象(`research/classifier-accuracy/report.json` 等)は含めない**。除外候補は `git grep -n "<name>" -- docs/ research/` で契約参照ゼロを確認してから除外する。`git status --short` で意図どおりか確認し、rename は `R` として出ても旧パス/新パスが明示対象内なら正常扱いにする。
3. **コミット**: conventional commits(`feat:`/`fix:`/`docs:`/`test:`/`chore:` 等)。本文に要点。**Claude 署名は付けない**(プロジェクト規約)。
4. **push + SHA一致確認**: push は `git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push origin main`。push 後に `git fetch origin main` 相当で `HEAD == origin/main` を確認する。SHA が一致しなければ ship 未完了。
5. **CI監視**: `gh run list --branch main --limit 10 --json databaseId,headSha,status,conclusion` で **対象 commit SHA と一致する run** を選び、`gh run watch <id> --exit-status`(test→build→deploy が緑)まで待つ。最新 run でも `headSha` が対象 commit でなければ成功扱いしない。
6. **Pages確認**: `curl -s -o /dev/null -w "%{http_code}" https://makeinu1.github.io/MTG_OneDeck/` が **200**。
7. **完了条件**: 最終報告に commit SHA、`HEAD == origin/main`、対象 SHA の CI conclusion、Pages HTTP 200、`git status --short` clean を含める。どれか欠けた報告は no-op 失敗扱い。関連 Task を completed にし、**ここでセッションを締める**(1セッション=1マイルストーン)。継続が要るなら Claude project memory + plan + `research/cr-grounding/cr-backbone-ledger.json` に残す。
