# MTG_OneDeck — qwen3.8-max-preview (Codex CLI) 利用時の互換入口

**統治の正本は [`AGENTS.md`](AGENTS.md)**(モデル非依存)。qwen3.8-max-preview を Codex CLI 経由で使う場合も、役割・不可侵・北極星・受け入れ標準・検証プロトコル・コーディング規約はすべて `AGENTS.md` に従う。このファイルは独自の優先順位・モデル表・復帰待ち条件を**持たない**。

## Codex CLI 固有のブートストラップ

- `AGENTS.md` は Codex CLI が起動時に自動読込する(手動で読む必要なし)。
- 反復ワークフローの正本 = `.agents/skills/mtg-onedeck-development/`(SKILL.md + references/{cycle,token-economy,codex-autoloop}.md)。
- `.claude/commands/{milestone,audit,ship,autoloop}.md` は Claude Code 固有の歴史的参照。Codex CLI では `references/codex-autoloop.md` が運用手順の正本。
- 裁定準則・優先度式・コールドスタート読込順 = `docs/judge-protocol.md`(読込順の正本は §0)。
- Tier-1 監査の常設規約 = `.claude/audit-standing.md`(モデル非依存・そのまま有効)。
- 機械チェック = `npm run check` / 禁止ファイル走査 = `npm run check:forbidden`。

## セッション運用(Codex CLI)

- **判定者**: 本セッション。契約承認・CR 裁定・`review.*` 自筆・台帳更新・git commit/push/出荷を所有。
- **実装者**: 別ターミナルで Codex CLI セッションを起動し、`/tmp/<key>_brief.md` のブリーフを渡す。
- **冷監査者**: 実装文脈を持たない別ターミナルで Codex CLI セッションを起動し、`.claude/audit-standing.md` + 凍結 diff を渡す。
- **相関遮断**: 実装者≠受け入れ基準作者≠監査者。同一セッション内での役割兼任は禁止。

## 役割(要約・正本 = `AGENTS.md`「役割」節)

判定者(judge)/実装者(implementer)/冷監査者(cold auditor)の3席は**どの席も qwen3.8-max-preview で担当でき、Claude/ChatGPT は任意の助言・追加監査として使ってよいが正式 green の必須資源ではない**。相関遮断と「凍結・信頼・最終コミットの前に別の冷たいセッションで独立監査を1回」は全状態で不変の要石。詳細・不可侵・自律境界・北極星は `AGENTS.md` を読むこと。
