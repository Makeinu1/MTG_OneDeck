# MTG_OneDeck — Claude 利用時の互換入口

**統治の正本は [`AGENTS.md`](AGENTS.md)**(モデル非依存)。Claude(Claude Code 等)を使う場合も、役割・不可侵・北極星・受け入れ標準・検証プロトコル・コーディング規約はすべて `AGENTS.md` に従う。このファイルは独自の優先順位・モデル表・復帰待ち条件を**持たない**——それらは 2026-07-20 に `AGENTS.md` へ一本化した(ChatGPT 完結ガバナンスへの移行・ユーザー裁定)。

## Claude 固有のブートストラップ

- 反復ワークフローの正本 = `.agents/skills/mtg-onedeck-development/references/document-governance.md`。SKILL と旧 references、`.claude/commands/{milestone,audit,ship,autoloop}.md` は互換入口。
- 裁定準則・優先度式・コールドスタート読込順 = `docs/judge-protocol.md`(読込順の正本は §0)。
- Tier-1 監査の常設規約 = `.claude/audit-standing.md`。
- 機械チェック = `npm run check` / 禁止ファイル走査 = `npm run check:forbidden`。

## 役割(要約・正本 = `AGENTS.md`「役割」節)

判定者(judge)/実装者(implementer)/冷監査者(cold auditor)の3席は**どの席も ChatGPT で担当でき、Claude は任意の助言・追加監査として使ってよいが正式 green の必須資源ではない**。相関遮断(実装者≠受け入れ基準作者≠監査者)と「凍結・信頼・最終コミットの前に別の冷たいセッションで独立監査を1回」は全状態で不変の要石。詳細・不可侵・自律境界・北極星は `AGENTS.md` を読むこと。
