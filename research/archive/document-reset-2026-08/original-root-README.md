# MTG OneDeck

統率者戦(EDH)のデッキを一人回し(ゴールドフィッシュ)するためのWebアプリです。
サーバー不要の純フロントエンド(React + TypeScript + Vite)で、カードデータと画像は [Scryfall API](https://scryfall.com/docs/api) から取得します(日本語版カード優先)。

**Demo (GitHub Pages):** https://makeinu1.github.io/MTG_OneDeck/

## 主な機能

- **デッキインポート**: Arena/Moxfield形式のテキスト(`1 Sol Ring (C21) 263` 等)、日本語カード名対応。IndexedDBにキャッシュ
- **プレイマット**: 1画面完結レイアウト。戦場(非土地/土地)・手札・統率領域・ライブラリ/墓地/追放・折りたたみログ
- **半自動ルール**: ターン/フェイズ進行(アンタップ・ドロー自動)、マナプールとコスト自動支払い(混成・ファイレクシア・X対応)、統率者税、各種カウンター。ルールを強制しないサンドボックス方針(不足時も強行可)
- **操作**: 右クリック=全操作メニュー / ダブルクリック=クイック操作(土地プレイ・キャスト・マナ生成タップ等) / ドラッグ&ドロップ / キーボードショートカット(Space=次のフェイズ、Cmd+Z=undo、D=ドロー)
- **その他**: ロンドンマリガン、undo/redo(スナップショット履歴)、トークン生成、ホバー拡大プレビュー、デッキのlocalStorage保存

## 開発

```bash
npm install
npm run dev        # 開発サーバー (http://localhost:5173)
npm test           # ユニットテスト + プロパティテスト (vitest + fast-check)
npm run build      # 本番ビルド (dist/)
```

## デプロイ

- **GitHub Pages**: `main` への push で GitHub Actions が自動ビルド・デプロイ
- **Hugging Face Spaces (Static)**: `npm run build` の `dist/` をそのままアップロード可能

## アーキテクチャ

```
src/
├─ data/      Scryfallクライアント・デッキリストパーサ・IndexedDBキャッシュ
├─ engine/    ゲームエンジン(純粋関数・イミュータブル。docs/engine-spec.md が仕様)
├─ store/     Zustandストア(スナップショット undo/redo)
├─ components/ プレイマットUI
└─ hooks/     ショートカット・ホバープレビュー
```

カードデータ・画像は Scryfall のAPIを利用しています。本プロジェクトは Wizards of the Coast 非公式のファンコンテンツです。
