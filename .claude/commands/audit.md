---
description: 高リスク変更を独立レビューする互換入口
---

`.claude/audit-standing.md` を読み、対象変更のリスクに応じた読み取り専用レビューを行う。
認証/セキュリティ、共有マルチプレイヤー状態・protocol、永続化/移行、主要 CR 意味論、
release/deploy 基盤の変更以外では、通常の targeted tests で十分とする。

レビュー者は実装者と別の文脈で、具体的な失敗シナリオ付き findings のみを返す。
修正後は影響を受けた主張と targeted tests だけを再確認し、ship は release Skill の権限と
最終 check に従う。
