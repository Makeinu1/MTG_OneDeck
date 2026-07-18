# 台帳ダイエット草稿レポート

## サイズ

| 対象 | bytes | KiB |
|---|---:|---:|
| before: `cr-backbone-ledger.json` | 129,512 | 126.5 |
| after: `cr-backbone-ledger.proposed.json` | 66,799 | 65.2 |
| 履歴: `cr-backbone-ledger-history.proposed.json` | 74,860 | 73.1 |

本体草稿は 129,512 bytes から 66,799 bytes へ縮小（48.4% 削減）。刈り込み対象は手法上のプローズフィールドのうち、300文字超かつ3文以上のものに限定した。各値は第一文（括弧内の句点では括弧が閉じる文まで）または最小限の要旨へ短縮し、原文は履歴へ逐語退避した。

## 刈ったフィールド（49件）

- `plannedSequenceProvenance`: 4367 → 64 文字
- `selectionRule`: 1743 → 42 文字
- `plannedSequence[0:d0-groundwork].note`: 1041 → 93 文字
- `plannedSequence[1:d1-design-system-card-sheet].note`: 1319 → 19 文字
- `plannedSequence[2:d2-portrait-layout].note`: 2000 → 531 文字
- `plannedSequence[3:d3-primary-action-feed].note`: 1440 → 438 文字
- `plannedSequence[4:d4a-pc-affordance-recovery].note`: 897 → 92 文字
- `plannedSequence[7:d5-celebration].note`: 1510 → 487 文字
- `plannedSequence[8:d6-chain-feel].note`: 646 → 92 文字
- `plannedSequence[9:d7-sound-session].note`: 514 → 92 文字
- `plannedSequence[10:cr-121-drawing].note`: 1895 → 112 文字
- `plannedSequence[11:cr-121-drawing].note`: 864 → 58 文字
- `plannedSequence[12:cr-400-408-zones-lki].note`: 1799 → 134 文字
- `plannedSequence[13:cr-122-counters].note`: 579 → 159 文字
- `plannedSequence[14:cr-121-drawing].note`: 664 → 65 文字
- `plannedSequence[15:cr-609-one-shot-mass].note`: 382 → 79 文字
- `plannedSequence[16:cr-115-targets].note`: 704 → 72 文字
- `plannedSequence[17:cr-player-specific-zones].note`: 757 → 54 文字
- `plannedSequence[18:cr-605-mana-abilities].note`: 959 → 75 文字
- `plannedSequence[19:cr-602-activated-abilities].note`: 1136 → 105 文字
- `plannedSequence[20:cr-702-keyword-abilities-frequent].note`: 629 → 56 文字
- `domains[score-ts-demand-catalog-repair].boundary`: 1090 → 134 文字
- `domains[score-ts-credit-nonability-paths].boundary`: 1549 → 103 文字
- `domains[score-ts-credit-nonability-paths].nextGate`: 613 → 90 文字
- `domains[cr-701-fetchland-search].boundary`: 1312 → 64 文字
- `domains[cr-701-fetchland-search].note`: 322 → 83 文字
- `domains[cr-102-players].boundary`: 673 → 61 文字
- `domains[cr-110-permanents].boundary`: 487 → 183 文字
- `domains[cr-111-tokens].boundary`: 701 → 172 文字
- `domains[cr-115-targets].boundary`: 851 → 148 文字
- `domains[cr-118-costs].boundary`: 527 → 20 文字
- `domains[cr-119-life].boundary`: 474 → 60 文字
- `domains[cr-120-damage].boundary`: 590 → 137 文字
- `domains[cr-121-drawing].boundary`: 490 → 76 文字
- `domains[cr-122-counters].boundary`: 944 → 269 文字
- `domains[cr-400-408-zones-lki].boundary`: 1045 → 61 文字
- `domains[cr-400-408-zones-lki].nextGate`: 1507 → 100 文字
- `domains[cr-500-514-turn-structure].boundary`: 727 → 40 文字
- `domains[cr-703-704-sba-turn-based].boundary`: 818 → 109 文字
- `domains[cr-601-casting-stack].boundary`: 392 → 32 文字
- `domains[cr-602-activated-abilities].boundary`: 509 → 306 文字
- `domains[cr-605-mana-abilities].boundary`: 564 → 25 文字
- `domains[cr-608-resolution].boundary`: 427 → 184 文字
- `domains[cr-603-triggers-apnap].boundary`: 805 → 55 文字
- `domains[cr-604-611-612-613-layers-continuous].boundary`: 733 → 81 文字
- `domains[cr-614-615-616-replacement-prevention].boundary`: 943 → 119 文字
- `domains[cr-701-keyword-actions-frequent].boundary`: 1465 → 313 文字
- `domains[cr-702-keyword-abilities-frequent].boundary`: 536 → 14 文字
- `domains[cr-modal-target-optional-variable].boundary`: 487 → 73 文字

## verify.mjs 実行結果

実行コマンド:

```sh
node research/cr-grounding/ledger-diet.draft/verify.mjs
```

終了コード: 0

```text
PASS (d) source ledger is valid JSON — 129512 bytes
PASS (d) proposed ledger is valid JSON — 66799 bytes
PASS (d) history ledger is valid JSON — 74860 bytes
PASS (a) domains count and order match source — 53 domains
PASS (a) plannedSequence count and order match source — 23 entries
PASS (b) every non-pruned field is byte-identical — SHA-256 d826ff839ba591b83b155494b9780a5d569ca3d48c4688002cb442d88a00d577
PASS (c) every shortened prose value is preserved verbatim in history — 49 shortened fields; 0 bad mappings; 0 orphan mappings
PASS (c) history note identifies diet date and current source of truth — 2026-07-18 の台帳ダイエットで退避・現在状態の正本は cr-backbone-ledger.json。長文プローズを無削除・逐語で保持する。
ALL PASS
```

## 適用記録(判定者・2026-07-18)

判定者修正1件の上で本体へ再オーナー化: selectionRule の一文要約は運用則
(type別消費・heldPending・補充手順・demand信頼度・STOP①格上げ・design-slice gate)を
喪失するため棄却し、運用則全文を保持+消化済み履歴注記(2026-07-15)のみ退避へ変更。
verify.mjs は適用前の草稿検証スクリプト(proposed.json 削除済みのため再実行不可・上記結果が正)。
