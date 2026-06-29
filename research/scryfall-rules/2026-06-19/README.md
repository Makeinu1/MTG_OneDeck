# Scryfall Rules Dataset 2026-06-19

目的: MTG_OneDeck のルール補助設計で繰り返し分析するためのローカル Scryfall スナップショット。

## Source

- Query: `game:paper date>=2021-06-19`
- Unique mode: `cards`
- API: `https://api.scryfall.com/cards/search`
- Rules source pinned after M-CR-RECONCILE: Magic: The Gathering Comprehensive Rules, effective 2026-06-19 (`rule/Magic_The_Gathering_Comprehensive_Rules.metadata.json`)
- Saved cards: 17,491
- Page count: 100
- Manifest: `manifest.json`

## Files

- `raw/pages/page-001.json` ... `page-100.json`: Scryfall search API のページ応答そのもの。
- `raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.pages.ndjson`: ページ応答を1行1JSONにしたもの。
- `raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json`: 全カードを `cards[]` にまとめた集約版。
- `analysis/m5-edh-priority-analysis.json`: CR分類、Scryfall keywords分離、Oracle text補助検出、EDH順位、A-Eリスクを統合したM5候補分析。
- `analysis/m5-edh-priority-analysis.md`: 人間レビュー用の同分析。
- `analysis/cr-term-analysis.json`: 公式CRのゲーム概念、701キーワード処理、702キーワード能力とカード本文の突き合わせ集計。
- `analysis/cr-term-analysis.md`: 人間レビュー用の同集計。
- `analysis/rule-vocabulary-summary.json`: Scryfall `keywords` とMTGルール語ファミリーの集計。
- `analysis/rule-vocabulary-summary.md`: 人間レビュー用の同集計。

`raw/` は 242MB 程度あるため `.gitignore` で除外している。分析結果と manifest は小さいのでレビュー対象にできる。

注意: `analysis/m5-edh-priority-analysis.*` / `analysis/cr-term-analysis.*` / `analysis/oracle-grammar-analysis.md` は当初 CR 2026-04-17 版を元に生成された。M-CR-RECONCILE 以後は CR 2026-06-19 を正本とし、CR 701/702/722 の語彙や Power-up/Teamwork/Preparation を扱う判断ではこれらを最新版の根拠として使わない。必要なら再生成する。

## Notes

このデータは 2026-06-19 時点のScryfall応答。今後の再分析では、まずこのローカル生データを使い、Scryfall APIへの再アクセスはデータ更新が必要な場合だけ行う。

MTG固有の用語分類は `docs/mtg-rule-terms.md` を基準にする。単語頻度ではなく、CR上の概念、キーワード処理、キーワード能力、能力語、効果種別を分けて評価する。

M5のグローバル実装順は `analysis/m5-edh-priority-analysis.*` を基準にする。優先順位はEDH頻度(`edhrec_rank`)を主軸にし、A-Eリスクは自動化レイヤーの決定に使う。
