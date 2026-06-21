---
description: 監査合格後にコミット→push→CI→Pages確認(Fable専任のリリースゲート)
---

監査(`/audit`)に合格した変更だけをリリースする。

1. **明示ステージング**: `git add <変更ファイルを列挙>`。`-A` 禁止。**`MyDeck/` と gitignore対象(`research/classifier-accuracy/report.json` 等)は含めない**。`git status --short` で意図どおりか確認。
2. **コミット**: conventional commits(`feat:`/`fix:`/`docs:`/`test:`/`chore:` 等)。本文に要点。**Claude 署名は付けない**(プロジェクト規約)。
3. **push**(osxkeychain回避): `git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push origin main`
4. **CI監視**: `gh run list --branch main --limit 1 --json databaseId --jq '.[0].databaseId'` → `gh run watch <id> --exit-status`(test→build→deploy が緑)。
5. **Pages確認**: `curl -s -o /dev/null -w "%{http_code}" https://makeinu1.github.io/MTG_OneDeck/` が **200**。
6. 関連 Task を completed に。**ここでセッションを締める**(1セッション=1マイルストーン)。継続が要るならメモリ/planに残す。
