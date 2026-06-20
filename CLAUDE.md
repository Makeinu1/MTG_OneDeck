# MTG_OneDeck プロジェクト規約

統率者戦(EDH)一人回しWebアプリ。React + TypeScript + Vite のサーバーレスSPA。
カードデータは Scryfall API(日本語版優先、IndexedDBキャッシュ)。
公開先: https://makeinu1.github.io/MTG_OneDeck/ (GitHub Pages、main への push で自動デプロイ)

## 役割分担(最重要・厳守)

- **メインセッション(Fable)**: プランニング・仕様書(契約)の執筆・監査・レビュー・コミット/プッシュに**専念**する。機能実装はしない。
- **実装担当**: 第一候補は **Codex CLI**、代替として Sonnet/Opus サブエージェント。
  - Codex 起動: `/Applications/Codex.app/Contents/Resources/codex exec --cd /Users/shumpeiabe/Desktop/MTG_OneDeck --sandbox workspace-write "<指示>"`(バックグラウンド実行)
  - 指示は自己完結の指示書(対象ファイル・変更禁止・受け入れ条件・必須テスト)で渡す。
  - 中断・失敗した場合は「実装済み部分」と「残作業」を明示して再実行する(最大2回、それでも完了しなければメインセッションが仕上げる)。
- **例外**: 監査中に見つけた数行規模の外科的修正のみ、メインセッションが直接行ってよい。
- **実装エージェント(Codex 含む)の git 操作は禁止**。コミットはレビュー合格後にメインセッションが行う。

## 契約ドキュメント

- `docs/engine-spec.md` — エンジンAPI契約。型名・関数名・挙動の変更は**実装前に**レビュー担当(メインセッション)の承認が必要。仕様変更はまず spec を更新してから実装する。
- `docs/acceptance.md` — 受け入れシナリオ(レビュー担当が維持)。受け入れゲートでは**1項目でも失敗したら修正後にシナリオ全体を最初から再実行**する。

## 設計原則

- **サンドボックス哲学**: ルールは強制しない。警告・確認ダイアログは出すが、ユーザーは常に強行できる(土地2枚目、マナ不足の強行キャスト等)。
- エンジン(`src/engine/`)は純粋関数のみ。React/DOM/Zustand に依存しない。GameState はイミュータブル(構造共有)。
- 乱数はコマンド生成時に確定(ペイロードに順列を埋め込む)。`applyCommand` は決定的。
- undo/redo はスナップショット方式(ストア層が履歴を保持、上限200)。
- 完全ルールエンジン(スタック自動解決・誘発・置換効果)には踏み込まない。LLMジャッジは助言のみで盤面を変更しない。
- すべての操作に右クリックメニューの代替を用意する(D&D・ダブルクリック専用の操作を作らない)。
- **ルール本文の読み取りは英語 `oracleText` を正本とする**(`printedText`(日本語)は表示専用)。実カードは Scryfall の Oracle(英語)を常に持つため、キーワード保有判定・各種ルール解析は英語のみで行う。

## 検証プロトコル

- 実装側の「テスト通過」報告は合否判定に**使わない**。レビュー担当が独立に敵対的テストを書いて判定する。
- ファイル名に `review.` を含むテストはレビュー担当専有。**実装エージェントは変更禁止**(これが落ちたら実装側のコードを直す)。
- fast-check プロパティテストの不変条件 **I1〜I7**(`docs/engine-spec.md` 参照)を維持する。GameState に状態を追加したら対応する不変条件も追加する。
- 機械チェック4点セット(すべて通ること): `npm run lint` / `npx tsc --noEmit` / `npx vitest run` / `npm run build`
- UI変更はブラウザ実機(Claude Preview、`.claude/launch.json` の `mtg-onedeck`)で確認。**コンソールエラー0件**が合格条件。
- Scryfall 連携の変更は実APIで裏取りしてから仕様化する(過去にAPIドキュメントと実挙動の差で重大バグが複数出ている)。

## コーディング規約

- TypeScript strict。`any` 禁止(やむを得なければ `unknown`+型ガード)。
- UI文言は日本語、コード・コメント・識別子は英語。カード名表示は `printedName ?? name` を《》で囲む。
- conventional commits(`feat:` / `fix:` / `docs:` / `chore:` 等)。Claude 署名は付けない。
- `git add` は変更ファイルを明示指定する(`-A` 禁止)。
- 主要UI要素には `data-testid` を付与する(レビューのブラウザ自動操作で使用)。

## デプロイ

- main へ push すると GitHub Actions が `npm test` → ビルド(`--base=/MTG_OneDeck/`)→ Pages デプロイを実行する(テストが落ちるとデプロイされない)。
- デプロイ後は https://makeinu1.github.io/MTG_OneDeck/ が 200 を返すことを確認する。
- Hugging Face Spaces(Static)へは `npm run build` の `dist/` をそのままアップロード可能。
