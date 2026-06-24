---
description: 監査合格後にコミット→push→CI→Pages確認(機械的リリースゲート・委譲可)
---

監査(`/audit`)に合格した変更だけをリリースする。

**実行方針(2点)**:
- **自走**: 監査(機械チェック4点 `lint`/`tsc`/`vitest`/`build` + `review.*` 緑)が合格していれば、**その合格を認可とみなし人間の確認を待たず自走でリリースする**(push/Pages 公開を含む)。テストが1つでも落ちていれば ship しない(直してから/audit を最初からやり直す)。
- **委譲(トークン節約)**: 本ワークフローは機械的ゆえ、**Opus を消費せず Haiku または Sonnet のサブエージェント(`Agent` の `model: haiku`/`sonnet`)へ委譲して実行してよい**。委譲する場合、オーケストレータ(Fable)は次を渡す: ①**ステージ対象ファイルの明示リスト**(`-A` 禁止のため列挙)②**コミットメッセージ全文**(type + 本文・署名なし)③**絶対に含めないファイル**(別セッションの作業・`MyDeck/`・gitignore対象)。サブエージェントは下記1〜6をそのまま回し、最後に `git log --oneline -1` / CI結果 / Pages HTTP コードを報告する。リリースの*是非*(何を出すか)は Fable が決め、*実行*をサブエージェントが担う。

1. **明示ステージング**: `git add <変更ファイルを列挙>`。`-A` 禁止。**`MyDeck/` と gitignore対象(`research/classifier-accuracy/report.json` 等)は含めない**。`git status --short` で意図どおりか確認。
2. **コミット**: conventional commits(`feat:`/`fix:`/`docs:`/`test:`/`chore:` 等)。本文に要点。**Claude 署名は付けない**(プロジェクト規約)。
3. **push**(osxkeychain回避): `git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push origin main`
4. **CI監視**: `gh run list --branch main --limit 1 --json databaseId --jq '.[0].databaseId'` → `gh run watch <id> --exit-status`(test→build→deploy が緑)。
5. **Pages確認**: `curl -s -o /dev/null -w "%{http_code}" https://makeinu1.github.io/MTG_OneDeck/` が **200**。
6. 関連 Task を completed に。**ここでセッションを締める**(1セッション=1マイルストーン)。継続が要るならメモリ/planに残す。
