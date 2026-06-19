# MTG_OneDeck エージェント規約

統率者戦(EDH)一人回しWebアプリ。React + TypeScript + Vite のサーバーレスSPA。
公開先: https://makeinu1.github.io/MTG_OneDeck/ (GitHub Pages、main への push で自動デプロイ)

## 正本は CLAUDE.md

プロジェクトの**規約・役割分担・設計原則・検証プロトコル・コーディング規約・デプロイ手順の正本は [CLAUDE.md](CLAUDE.md)**。
実装エージェント(Codex CLI を含む)は CLAUDE.md を厳守すること。本ファイルを CLAUDE.md と二重管理せず、規約はすべて CLAUDE.md 側で更新する。

特に重要(詳細は CLAUDE.md):
- **役割分担**: メインセッション(Fable)はプランニング・契約執筆・監査・レビュー・コミットに専念。機能実装は Codex CLI 等の実装担当が行う。
- **実装担当の禁止事項**: git 操作、`docs/`(契約)の変更、`review.*` テストの変更。
- **契約**: `docs/engine-spec.md`(エンジンAPI契約)/ `docs/acceptance.md`(受け入れシナリオ)。変更はレビュー担当の承認後に Fable が行う。
- **検証**: 機械チェック4点(`npm run lint` / `npx tsc --noEmit` / `npx vitest run` / `npm run build`)とブラウザ実機確認(コンソールエラー0件)。
