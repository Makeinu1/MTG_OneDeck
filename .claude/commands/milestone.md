---
description: 欲しいものを1マイルストーンとして起こす(Fable契約→Codexブリーフ→背景実装)
---

ユーザーの要望「$ARGUMENTS」を1マイルストーンとして立ち上げる。CLAUDE.md のトークン経済(Claudeは判断・Codexは作業)を厳守。

手順:
1. **現状調査(最小)**: 関連する既存実装・契約(`docs/engine-spec.md`)・分類器/ストア/UIを必要分だけ読み、再利用できる関数を特定する。新規作成より再利用を優先。
2. **契約執筆(Fable)**: `docs/engine-spec.md` に新セクションを追記(型名・関数名・挙動・不変条件・「エンジン不変か」)。UI挙動なら `docs/acceptance.md` にシナリオも追加。エンジンAPIを変える場合のみ慎重に。
3. **正規表現/データ系はsnapshotで事前裏取り**: 分類器タグ等は `research/scryfall-rules/2026-06-19/raw/...cards.json` の実カード文言で誤発火/取りこぼしを確認してから確定。
4. **Codexブリーフ作成**: `/tmp/<key>_brief.md` に自己完結の指示書(契約参照・対象ファイル・**変更禁止**=`src/engine/`の不要変更/`review.*`/`docs/`/`CLAUDE.md`/`eslint.config.js`/`CACHE_SCHEMA_VERSION`/git・受け入れ条件・必須4チェック)。
5. **レビュー専有テスト `review.<key>` を Fable が先に書く**(採点用・敵対的)。Codex は触らない。
6. **Codex を背景起動**(CLAUDE.md のコマンド)。タスクは TaskCreate で「契約/実装/監査」を起こし in_progress 管理。
7. Codex 完了通知を待って `/audit` へ。

MyDeck デッキ(`MyDeck/`)はローカル保持・未commit。
