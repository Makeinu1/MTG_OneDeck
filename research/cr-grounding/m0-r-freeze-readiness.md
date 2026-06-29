# M0-R Freeze Readiness Audit

最終更新: 2026-06-27
固定CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19
目的: M0-R(CR grounding) を M0-FREEZE / S-* 実装へ渡してよいかを、CR条文・golden case・現 substrate の証拠で判定する。

## 判定

**M0-R は価値ある定規になっているが、M0-FREEZE へはまだ進めない。**

理由は「実装済みSBAの数が足りない」ではない。凍結前に判断すべき残件は、実装しやすい個別SBAではなく、後戻りしやすい state 設計である。

凍結前の重点は次の3つ。

1. **ルール選択 substrate の一般化**
   - 根拠: CR 903.9a / 704.6d / 704.5j。
   - 現状: `pendingSbaChoices` は commander 903.9a 専用の `CommanderZoneSbaChoice`。
   - 問題: legend rule 704.5j、将来の選択型SBA、APNAP/priority boundary と同じ器で扱うかが未決定。
   - 凍結前に必要な決定: commander 専用のまま進めるのか、`pendingRuleChoices` のような汎用 queue へ広げるのか。

2. **priority / event loop の二段階処理**
   - 根拠: CR 117.5 / 603.3b / 704.3。
   - 現状: pending trigger、APNAP ordering core、明示順 stack placement、deterministic fixed-point v1 は成立。
   - 問題: CR 603.3b の「another ability triggering」second bucket は未表現。
   - 凍結前に必要な決定: `PendingTrigger` に trigger-condition bucket を持たせるか、S-EVENTS の `GameEvent` 設計へ先送りするか。

3. **CR 605 誘発型マナ能力の扱い**
   - 根拠: CR 605.1b / 605.3b。
   - 現状: 単純な起動型マナ能力は no-stack で実装済み。
   - 問題: 誘発型マナ能力は「誘発」だが通常の pending trigger と違い、条件を満たせばスタックに置かず解決する。
   - 凍結前に必要な決定: S-EVENTS の event observer が通常誘発と mana-triggered ability をどこで分岐するか。

したがって、次に `704.5p` のような READY/PARTIAL SBA を実装するのは優先度が低い。`704.5p` は現 state だけで進められるが、定規の凍結可否を左右しない。先に上の3点を設計判断へ落とす。

## Golden case readiness

| Case | CR refs | 現状 | 凍結判断 |
|---|---|---|---|
| `cr-commander-tax-cast-not-return` | 903.8 / 601.2i | 既存 `m431` / `review.m431` で接地済み | PASS。S-EVENTS の blocker ではない |
| `cr-commander-graveyard-exile-sba-not-replacement` | 903.9a / 704.6d / 603.6c / 603.10a / 117.5 | store bridge と `pendingSbaChoices` v1 で部分接地 | PARTIAL。汎用 choice substrate の判断が freeze blocker |
| `cr-commander-hand-library-replacement` | 903.9b / 614.5 / 400.7 | hand/library は replacement として接地済み | PASS(core)。903.9a choice 設計とは分ける |
| `cr-mana-ability-no-stack` | 605.1a / 605.3b / 405.6c | 起動型マナ能力は no-stack で接地済み | PARTIAL。605.1b 誘発型マナ能力の設計が残る |
| `cr-token-dies-before-ceases` | 111.7 / 704.5d / 603.6c / 117.5 | 専用 executable test あり | PASS |
| `cr-trigger-sba-priority-loop` | 117.5 / 603.3 / 603.3b / 704.3 / 704.5f / 704.5i / 704.5q | pending/no-direct-stack、APNAP v1、fixed-point v1 は接地済み | PARTIAL。603.3b second bucket が残る |
| `cr-sba-copy-ceases-outside-stack` | 704.3 / 704.5e / 707.10a / 117.5 | 専用 executable test あり | PASS |
| `cr-sba-zero-loyalty-planeswalker` | 704.3 / 704.5i / 117.5 / 122.1e | 専用 executable test あり | PASS |
| `cr-sba-plus-minus-counter-annihilation` | 704.3 / 704.5q / 117.5 / 122.3 | 専用 executable test あり | PASS |
| `cr-zone-change-new-object-lki` | 400.7 / 603.10a | object incarnation / LKI core は専用 executable test あり | PASS(core)。400.7例外群と full effective-characteristics snapshot は S-* carry |
| `cr-20260619-new-mechanics-boundary` | 701.69 / 702.193 / 702.194 / 722 | 分類・境界確認 | PASS(boundary)。実行器は scope-boundary |

## SBA readiness

`sba-inventory.md` の棚卸しは凍結判断に使える。重要なのは、未実装SBAを緑に混ぜないこと。

凍結前に実装数を増やす必要はない:

- PASS: 704.5d / 704.5e / 704.5f / 704.5i / 704.5q。
- PARTIAL: 704.6d / 903.9a。
- READY/PARTIAL: 704.5p。
- BLOCKED(choice): 704.5j。
- BLOCKED(state): 敗北、damage、world timestamp、Aura/Equipment legality、counter cap、Saga、Battle、Role など。
- SCOPE: dungeon、sector、battle protector、speed など。

判断:

- `704.5p` は次の「実装候補」ではあるが、M0-FREEZE の blocker ではない。
- `704.5j` は choice substrate を要求するため、903.9a と同じ設計レーンで扱う。
- full SBA suite は M0-FREEZE 条件ではなく、`PASS/PARTIAL/BLOCKED/SCOPE` の区別を維持することが条件。

## M0-FREEZE へ進む前の必須タスク

### R-FREEZE-1: Rule choice substrate の設計判断

設計草稿: `rule-choice-substrate.md`。

成果物:

- `pendingSbaChoices` を維持するか、汎用 `pendingRuleChoices` にするかの決定。
- commander 903.9a と legend rule 704.5j を同じ queue へ載せられるかの判断。
- choice pending 中の priority boundary / undo / restoreGame backfill 方針。

合格条件:

- 903.9a が「store bridge だから動く」ではなく、「将来のSBA choiceと同じ設計で説明できる」状態。
- 704.5j を実装するときに state を作り直さない。

### R-FREEZE-2: 603.3b second bucket の設計判断

設計草稿: `priority-event-loop.md`。

成果物:

- `PendingTrigger` に bucket を持たせるか、S-EVENTS の event schema で吸収するかの決定。
- 「trigger condition が another ability triggering であるか」をどう分類するかの方針。
- second bucket の最小 golden case。

合格条件:

- CR 603.3b の二段階処理を `APNAP ordering core v1` の残境界として明示できる。
- 現行の同一controller順序UIと矛盾しない。

### R-FREEZE-3: triggered mana ability の設計判断

設計草稿: `mana-ability-substrate.md`。

成果物:

- CR 605.1b の誘発型マナ能力を、通常の pending trigger と区別する設計。
- 「スタックに置かないが、誘発条件を event から読む」経路の設計。
- 起動型マナ能力 605.1a の現行 no-stack 実装との差分表。

合格条件:

- CR 605 を「起動型だけPASS」と誤表示しない。
- S-EVENTS 実装時に通常誘発として誤って stack へ積まない。

### R-FREEZE-4: Scope partition の確定

分類表: `scope-partition.md`。

成果物:

- CR 400.7 例外群、full effective-characteristics snapshot、full SBA suite、新語彙実行器を、`freeze-blocker` / `S-* carry` / `scope-boundary` に分類。

合格条件:

- `検証不能` を PASS に混ぜない。
- 実装しないものが「忘れられた未実装」ではなく、明示された境界として残る。

## 次の一手

R-FREEZE-1 は `rule-choice-substrate.md` に設計草稿を置いた。判断の方向は、`pendingSbaChoices` を最終形にせず、903.9a commander choice と 704.5j legend rule を `pendingRuleChoices` へ一般化すること。

R-FREEZE-2 は `priority-event-loop.md` に設計草稿を置いた。判断の方向は、`PendingTrigger` に `stackPlacementBucket` を持たせ、603.3b の ordering を `bucket -> APNAP -> controller chosen order` として扱うこと。

R-FREEZE-3 は `mana-ability-substrate.md` に設計草稿を置いた。判断の方向は、605.1b の誘発型マナ能力を通常の `pendingTriggers` / stack placement へ混ぜず、mana transaction 内の no-stack 即時解決として扱うこと。

R-FREEZE-4 は `scope-partition.md` に分類表を置いた。判断の方向は、未実装を消すのではなく、CR 400.7 例外群、full effective-characteristics snapshot、full SBA suite、2026-06-19 新語彙、player-specific zones を `S-* carry` / `scope-boundary` / `PASS(core)` に分け、`PASS` に混ぜないこと。

M0-FREEZE 判定用の scorecard / 契約ハンドオフは `m0-freeze-handoff.md` に置いた。

次は個別SBA実装ではなく、**Fable の M0-FREEZE レビュー**へ進む。

理由:

- R-FREEZE-1 により、choice 系の手戻りリスクは設計上の方向が見えた。
- R-FREEZE-2 により、603.3b の二段階 stack placement と 117.5/704.3 の固定点ループの方向が見えた。
- R-FREEZE-3 により、605.1b の誘発型マナ能力を通常誘発としてstackへ積む事故は設計上防げる。
- R-FREEZE-4 により、400.7例外群、full effective-characteristics snapshot、full SBA suite、新語彙実行器を freeze-blocker / S-* carry / scope-boundary に分けないまま凍結する事故は防げる。
- `704.5p` のような deterministic SBA は後から足しても state 設計の手戻りが小さい。

M0-FREEZE 判定までは、これらの草稿を `PASS` 主張ではなくハンドオフ材料として扱う。Codex は docs 正本・review.*・git を触らないため、契約反映と scorecard 配線の承認は Fable 側で行う。
