# M0-FREEZE Traceability Matrix

最終更新: 2026-06-28
固定CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19
目的: CRG-1〜8 を、CR条文・golden case・executable test・overlay treatment・残境界まで一列で辿れるようにする。これは「CRを検査器にする」ための traceability artifact であり、docs 正本の代替ではない。

## 読み方

- `PASS`: CR refs、状態遷移不変条件、実行可能 golden/test が揃っている。
- `PASS(core)`: core は実行可能だが、CR例外群や完全形は `S-* carry`。
- `PASS(boundary)`: 語彙/境界は固定済みだが、実行器は `scope-boundary`。
- `PARTIAL`: 実装/bridge/設計草稿はあるが、CR完全形ではない。残境界を明示する。

## CRG traceability

| Gate | Overlay status | CR refs | Golden case / artifact | Executable evidence | Freeze treatment | 残境界 |
|---|---|---|---|---|---|---|
| CRG-1 CR 2026-06-19 fixed | PASS | 2026-06-19 CR全体 | `rule/Magic_The_Gathering_Comprehensive_Rules.metadata.json` | SHA-256照合済み: `e99cd70eb64ca854acb6420ebbf06e369e3f258e0cfba4f03f70bd881386f79b` | `required-pass` | なし |
| CRG-2 CR-grounded golden cases defined | PASS | 903.8 / 903.9 / 605 / 111.7 / 603 / 704 / 400.7 / 2026新語彙 | `research/cr-grounding/golden-cases.json` | JSON parse OK。case ID一覧は本ファイル下表。 | `required-pass` | 既存 golden replay への統合は event envelope 対応後 |
| CRG-3 Commander tax | PASS | 903.8 / 601.2i | `cr-commander-tax-cast-not-return` | `src/engine/__tests__/m431.test.ts`; `src/store/__tests__/review.m431.test.ts` | `required-pass` | command 以外から唱える将来ケースは別拡張 |
| CRG-4 Mana abilities | PARTIAL | 605.1a / 605.1b / 605.3b / 605.4a / 405.6c | `cr-mana-ability-no-stack`; `mana-ability-substrate.md` | `src/engine/__tests__/review.g4-activate.test.ts` covers 605.1a/605.3b activated no-stack | `partial-allowed-only-if-605-1b-is-s-carry` | 605.1b/605.4a triggered mana ability は未実装。通常 `pendingTriggers` に混ぜない設計を契約化する |
| CRG-4.5 Commander zone choice | PARTIAL | 903.9a / 903.9b / 704.6d / 614.5 / 603.6c / 603.10a / 117.5 | `cr-commander-graveyard-exile-sba-not-replacement`; `cr-commander-hand-library-replacement`; `rule-choice-substrate.md` | `src/store/__tests__/crGrounding.test.ts`; `src/components/playmat/Playmat.test.tsx` | `partial-allowed-only-if-generic-rule-choice-is-s-carry` | 903.9a bridge はあるが generic `pendingRuleChoices`、deferred SBA choice UI、`stabilizeBeforePriority()` 本体統合は未実装 |
| CRG-5 Token death before cease | PASS | 111.7 / 704.5d / 603.6c / 117.5 | `cr-token-dies-before-ceases` | `src/store/__tests__/crGroundingGoldenCases.test.ts#cr-token-dies-before-ceases` | `required-pass` | full SBA suite は後続 |
| CRG-6 Trigger/SBA/priority | PARTIAL | 117.5 / 603.3 / 603.3b / 704.3 / 704.5e / 704.5f / 704.5i / 704.5q | `cr-trigger-sba-priority-loop`; `cr-sba-copy-ceases-outside-stack`; `cr-sba-zero-loyalty-planeswalker`; `cr-sba-plus-minus-counter-annihilation`; `priority-event-loop.md`; `sba-inventory.md` | `src/store/__tests__/crGroundingGoldenCases.test.ts`; `src/engine/__tests__/priority.test.ts`; `src/components/playmat/Playmat.test.tsx` for UI ordering | `partial-allowed-only-if-second-bucket-and-full-sba-are-s-carry` | 603.3b second bucket と full SBA suite は未実装。`PASS` 禁止 |
| CRG-7 Zone movement and LKI | PASS(core) | 400.7 / 603.10a | `cr-zone-change-new-object-lki`; `scope-partition.md` | `src/store/__tests__/crGroundingGoldenCases.test.ts#cr-zone-change-new-object-lki` | `core-pass-only` | CR 400.7例外群と full effective-characteristics snapshot は `S-* carry` |
| CRG-8 2026-06-19 new vocabulary | PASS(boundary) | 701.69 / 702.193 / 702.194 / 722 | `cr-20260619-new-mechanics-boundary`; `scope-partition.md` | 固定CR本文に条文あり。golden case は境界定義。 | `boundary-pass-only` | Heal / Power-up / Teamwork / Preparation の実行器は `scope-boundary` |

## Golden case inventory

| Case ID | CR refs | Current treatment |
|---|---|---|
| `cr-commander-tax-cast-not-return` | 903.8 / 601.2i | CRG-3 PASS。m431/review.m431で実行確認。 |
| `cr-commander-graveyard-exile-sba-not-replacement` | 903.9a / 704.6d / 603.6c / 603.10a / 117.5 | CRG-4.5 PARTIAL。store bridge 実行確認、generic choice は S-CHOICE carry。 |
| `cr-commander-hand-library-replacement` | 903.9b / 614.5 / 400.7 | CRG-4.5 PARTIAL内の replacement core。store testで代表確認。 |
| `cr-mana-ability-no-stack` | 605.1a / 605.3b / 405.6c | CRG-4 PARTIAL。activated mana ability のみ実行確認。605.1b は S-* carry。 |
| `cr-token-dies-before-ceases` | 111.7 / 704.5d / 603.6c / 117.5 | CRG-5 PASS。executable。 |
| `cr-trigger-sba-priority-loop` | 117.5 / 603.3 / 603.3b / 704.3 / 704.5f / 704.5i / 704.5q | CRG-6 PARTIAL。pending/no-direct-stack/APNAP/fixed-point subset は executable。603.3b second bucket は S-* carry。 |
| `cr-sba-copy-ceases-outside-stack` | 704.3 / 704.5e / 707.10a / 117.5 | CRG-6 PARTIAL内の SBA subset。executable。 |
| `cr-sba-zero-loyalty-planeswalker` | 704.3 / 704.5i / 117.5 / 122.1e | CRG-6 PARTIAL内の SBA subset。executable。 |
| `cr-sba-plus-minus-counter-annihilation` | 704.3 / 704.5q / 117.5 / 122.3 | CRG-6 PARTIAL内の SBA subset。executable。 |
| `cr-zone-change-new-object-lki` | 400.7 / 603.10a | CRG-7 PASS(core)。object incarnation / LKI core は executable。 |
| `cr-20260619-new-mechanics-boundary` | 701.69 / 702.193 / 702.194 / 722 | CRG-8 PASS(boundary)。語彙/境界定義。実行器は scope-boundary。 |

## Trace gaps that must remain visible

以下は未実装・未統合であり、`PASS` に混ぜない。

1. 605.1b / 605.4a triggered mana ability。
2. 903.9a の generic `pendingRuleChoices` 化と deferred choice UI。
3. 704.5j legend rule choice。
4. 603.3b second bucket。
5. Full SBA suite。
6. CR 400.7例外群。
7. Full effective-characteristics snapshot。
8. 2026-06-19新語彙の実行器。
9. Existing golden replay harness への CR-grounding cases 統合。

## Contract-update implication

Fable が contract-update stage を承認する場合、docs と scorecard はこの matrix と同じ読みを保つ必要がある。

- CRG-1 / 2 / 3 / 5 は required PASS。
- CRG-4 / 4.5 / 6 は `PARTIAL` のまま。残境界が `S-* carry` として明示されている場合のみ M0-FREEZE へ進める。
- CRG-7 は `PASS(core)`。400.7例外群と full effective snapshot を完了扱いにしない。
- CRG-8 は `PASS(boundary)`。新語彙実行器を完了扱いにしない。
- `m-contract-gate` は `m0-freeze-overlay.json` を読み、`PARTIAL` / `PASS(core)` / `PASS(boundary)` を plain `PASS` に変換しない。
