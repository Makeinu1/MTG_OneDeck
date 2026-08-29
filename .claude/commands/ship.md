---
description: 明示許可済みリリースの互換入口
---

`.agents/skills/mtg-onedeck-release/SKILL.md` を読み、四段階（権限と clean state、
一度のローカル check、exact-SHA の push/deploy、CI/Pages の一度の確認）を実行する。
呼出し自体は commit、push、deploy、publish の権限を生成しない。
