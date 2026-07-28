# AGENTS.md context diet record — 2026-07-28

`M-OPS-TOKEN-EFFICIENCY`で、常時注入される`AGENTS.md`から履歴説明と重複した実行手順を退避した。

- 変更前の逐語正本: git object `5b0856229e6b4cfc799dd8920f4b7f2f9bf8ced1:AGENTS.md`
- 冷監査precedent: Wave 0–2 Gibbs `019f86f2`。13 domain監査でboundary stale HIGH 2件とMEDIUM 2件を捕捉し、実装文脈と監査文脈の分離が必要と確認した。
- 旧モデル割当・Claude解約履歴は運用上の正本ではない。役割は能力で定義し、現行割当はセッション設定へ委ねる。
- 詳細な1セッション監査ループは`.agents/skills/mtg-onedeck-development/references/cycle.md`と`.claude/audit-standing.md`を正本とする。

削除した規則はない。北極星、不可侵、STOP4類、shipped 5条件、エンジン不変条件、受け入れ・出荷条件はroot canonに保持した。
