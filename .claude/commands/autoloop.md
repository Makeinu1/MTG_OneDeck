---
description: 旧 autoloop 呼出しを開発 Skill へ転送する互換入口
---

過去の状態機械は使わず、`$ARGUMENTS` を Goal として
`.agents/skills/mtg-onedeck-development/SKILL.md` を実行する。成果の完了後に別の Goal を
自動開始しない。外部書込みは明示許可がある場合に限り release Skill へ渡す。
