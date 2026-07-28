---
description: 1タスク1マイルストーンの契約→実装→監査→ship互換入口
---

`$ARGUMENTS`をmilestone idまたはgoalとして使い、`.agents/skills/mtg-onedeck-development/references/codex-autoloop.md`をそのまま実行する。

- 1回の呼び出しで1マイルストーンだけを扱う。
- 開始時は`npm run codex:context -- [--domain <id>]`、実装者と冷監査者は各1名・`fork_context: false`。
- 次マイルストーンを同一タスクで開始しない。shipとloop-state reset後に終了する。
