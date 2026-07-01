---
description: 欲しいものを1マイルストーンとして起こす(Fable契約→Codexブリーフ→背景実装)
---

ユーザーの要望「$ARGUMENTS」を1マイルストーンとして立ち上げる。CLAUDE.md のトークン経済(Claudeは判断・Codexは作業)を厳守。

**要件化=ロードマップ参照(自律モード)**: 次フェーズは substrate-first 順で `research/cr-grounding/project-goal-milestones.md` が既に決め、設計も R-FREEZE 文書が既存のことが多い。その場合 Fable の仕事は「起案」でなく「**承認**」。一意に決まらない/価値判断が要る時だけ STOP→ユーザーへ質問。

**冒頭で必ず宣言する(4行ヘッダ)**: マイルストーンが実装に接続しているかの gate。埋まらない項目があれば、それは CR 読みがまだ GameState へ接地していないシグナル。
1. **レーン**: 背骨 / 後期背骨 / 葉(compiler) / 剪定解除 のどれか(`cr-backbone-ledger.json` の当該 domain と一致)。
2. **安定化する GameState field**: このスライスで確定する状態フィールド(例: `defeat`, `commanderDamage`)。
3. **残す未実装境界**: 明示的に defer する範囲(台帳 `boundary` へ反映)。
4. **増える compiler 着地先**: このスライス後に文法コンパイラが出せるようになる command/event(無ければ「なし=substrate専念」)。

手順:
1. **現状調査(最小・委譲可)**: 再利用できる既存関数・契約の特定は Explore/Codex に結論だけ出させてよい(Fable は raw ファイルを精読しない)。新規作成より再利用を優先。
2. **契約は Codex 草稿 → Fable 承認**: Codex に既存 R-FREEZE 設計から `docs/engine-spec.md` 新セクション草稿 + golden/敵対テスト草稿を `research/cr-grounding/*.draft`(**CR 条番号併記**)へ出させる。Fable は **CR 照合して承認**し docs へ昇格(型名・関数名・挙動・不変条件・「エンジン不変か」)。UI挙動なら `docs/acceptance.md` も。
3. **正規表現/データ系はsnapshotで事前裏取り**: 分類器タグ等は `research/scryfall-rules/2026-06-19/raw/...cards.json` の実カード文言で誤発火/取りこぼしを Codex に確認させ、Fable は誤りの承認だけ。
4. **Codexブリーフ作成**: `/tmp/<key>_brief.md` に自己完結の指示書(契約参照・対象ファイル・**変更禁止**=`src/engine/`の不要変更/`review.*`/`docs/`/`CLAUDE.md`/`eslint.config.js`/`CACHE_SCHEMA_VERSION`/git・受け入れ条件・必須4チェック・defer/隔離の明示)。
5. **レビュー専有テスト `review.<key>` の最終 author は Fable**(=要石。実装者≠受け入れ基準作者)。Codex に敵対アサーション草稿は出させてよいが、CR 照合して Fable が確定し所有する。Codex は `review.*` を触らない。
6. **Codex を背景起動**(CLAUDE.md のコマンド・`< /dev/null`)。タスクは TaskCreate で「契約/実装/監査」を起こし in_progress 管理。
7. Codex 完了通知を待って `/audit` へ(Tier-1 は委譲)。

MyDeck デッキ(`MyDeck/`)はローカル保持。**ただし `docs/`・`research/` の契約が参照しているソースデッキ(`Mydeck/*.txt`)は版管理下に置く**(除外前に `git grep` で契約参照を確認)。
