---
description: 凍結成果物を独立cold auditする互換入口
---

`.claude/audit-standing.md`と`.agents/skills/mtg-onedeck-development/references/cycle.md`に従う。

- 判定者の一次照合後にtreeを凍結する。
- `fork_context: false`の冷監査者1名へ監査ブリーフのパスだけを渡す。
- 監査者はfindings only。判定者が赤旗を分類し、BLOCKER/HIGH = 0までshipしない。
