---
description: 監査合格後のcommit・push・CI・Pages確認互換入口
---

`.agents/skills/mtg-onedeck-development/references/codex-autoloop.md` §6–7を実行する。

監査BLOCKER/HIGH = 0、`review.*`緑、凍結treeの`npm run check`緑が前提。明示ファイルだけをstageし、監査者id入りcommit、push、`HEAD == origin/main`、対象SHAのCI success、Pages HTTP 200、worktree clean、loop-state resetを全て満たして完了とする。
