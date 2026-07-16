# research/archive — 退蔵レーン索引

> **status**: historical(正本ではない)。2026-07-16 の統治リストラで移設。
> M-CONTRACT 期(genesis import 2026-07-06 以前)に生成された計測レーンのうち、以降一度も更新されなかったものを収容する。**削除はしていない**——全ファイルは git 履歴ごとここに残る。

## 再稼働の手順

- 各レーンの生成スクリプトは `scripts/` に現存し、npm script から再実行できる。**再実行すると成果物は元パス `research/<lane>/` に再生成される**(archive 側ではない)。それ自体が「レーン再稼働」のシグナルであり、`.gitignore` の除外パターンも元パスのまま有効。
- 裁定ファイル(`adjudication.json` 等の一回性の人間/LLM 裁定)はスクリプトでは再生成されない。過去の裁定を入力に使う diff 系スクリプトを再実行する場合は、該当レーンを `git mv` で元パスへ戻してから行う。

## 収容レーン

| レーン | 生成スクリプト(npm run) | 最終更新 | 移設時の消費者 |
|---|---|---|---|
| classifier-accuracy | `accuracy` | 2026-07-06 | なし(src 内コメント参照は archive パスへ更新済み) |
| classifier-parity | `classifier-parity` | 2026-07-06 | なし |
| cr-conformance | `cr-conformance` | 2026-07-06 | なし |
| event-coverage | `event-coverage` | 2026-07-06 | なし |
| event-oracle | `event-oracle-sample` / `event-oracle-diff` | 2026-07-06 | なし(review.event-coverage.test.ts のコメント参照のみ) |
| grammar-compile | `grammar-compile` | 2026-07-06 | なし(旧 report.{md,json} のみ収容。**レーン自体は 2026-07-18 に再稼働**=decision-snapshot 計器が元パス `research/grammar-compile/` に現役成果物を保持) |
| grammar-coverage | `grammar-coverage` | 2026-07-06 | なし |
| grammar-ir | `grammar-ir` | 2026-07-06 | なし |
| layer-coverage | `layer-coverage` | 2026-07-06 | なし |
| llm-oracle | `oracle-sample` / `oracle-diff` | 2026-07-06 | なし(review.layer-gold.test.ts のコメント参照のみ) |
| m-contract-gate | `m-contract-gate` | 2026-07-06 | なし(テストのフィクスチャ文字列のみ) |
| timing-coverage | `timing-coverage` | 2026-07-06 | なし |
| timing-oracle | `timing-oracle-sample` / `timing-oracle-diff` | 2026-07-06 | なし |
| zone-coverage | `zone-coverage` | 2026-07-06 | なし |
| zone-oracle | `zone-oracle-sample` / `zone-oracle-diff` | 2026-07-06 | なし |
| cr-conformance-audit.md | (手動監査スナップショット 2026-06-24/26) | 2026-07-06 | docs/engine-spec.md・engine-state-ontology.md の引用は archive パスへ更新済み |

## ⚠ 移動禁止(archive してはならない現役レーン)

- `research/golden-replay/` — `src/engine/__tests__/review.golden-replay.test.ts` が `import.meta.glob` で **32 ケースを毎 CI 消費する現役回帰スイート**。mtime が古いのは安定しているからであって休眠ではない。
- `research/scryfall-rules/` — mydeck-scoring(`scripts/mydeck-scoring/*`)ほか 21 ファイルが読む**凍結入力データ**(2026-06-19 snapshot)。不変データの mtime は常に古い。
- `research/cr-grounding/` / `research/mydeck-scoring/` / `research/design/` — 現役。

`docs/engine-spec.md` §26〜§30 等の歴史的契約文にある `research/<lane>/...` 出力先パスは原文のまま(契約は出荷時点の記述を保存する。再実行時の出力先が元パスであることとも整合)。
