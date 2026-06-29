# Project Goal and Milestones

最終更新: 2026-06-28
固定CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19

## Project goal

このプロジェクトのルールエンジン側のゴールは、MTGの全ルールを丸ごと自動裁定することではない。

ゴールは次の状態を作ること。

> CR 2026-06-19 を検査器として使い、EDH一人回しで価値の高い範囲だけを、根拠条文・状態不変条件・実行可能golden/test付きで安全に自動化する。

このゴールでは、便利な自動化より先に正しい定規を作る。未実装領域は消すのではなく、`S-* carry` / `scope-boundary` / `manual` として見える場所に置く。`PASS` は「未実装がない」ではなく、「その範囲と境界がCR根拠付きで検査できる」という意味でだけ使う。

## Current verdict

現時点の進め方は理念に沿っている。

理由:

- CR 2026-06-19 固定、CR refs、golden cases、traceability、overlay、R-FREEZE設計草稿は揃っている。
- 直近の次手は追加SBAや新機能ではなく、M0-FREEZE判定器を docs 契約と scorecard に接続することになっている。
- `PARTIAL` / `PASS(core)` / `PASS(boundary)` を plain `PASS` に潰さない設計になっている。

ただし、まだ「定規を作れた」とは言わない。現在は定規の部品が揃い、Fableの契約判断へ渡せる状態である。定規が完成するのは、overlay が docs 契約と `m-contract-gate` の両方に接続され、scorecard 出力が未実装境界を表示し、Fable が final approval を記録した後である。

## Non-negotiable invariant

すべてのルール自動化マイルストーンは、次の4点を同時に満たす。

1. 根拠CR条文を明記する。
2. GameState / event / command に落ちる状態不変条件を明記する。
3. 実行可能 golden/test を追加する。
4. 未実装境界を `PASS` に混ぜない。

この4点のどれかを欠く実装は、短期的に動いても正しいエンジンへ接続できないため差し戻す。

## Milestone map

| Milestone | Goal | Owner | Current status | Exit criteria |
|---|---|---|---|---|
| M0-R: CR grounding research | CRを読むだけでなく、CRG-1〜8の検査観点・golden・境界へ落とす | Codex | Done as research | `m0-freeze-overlay.json`、`golden-cases.json`、traceability、R-FREEZE草稿が存在する |
| M0-FREEZE Q1: Contract decision | CR-grounding overlay を docs 契約へ昇格できるか判断する | Fable | Pending | D1〜D6 decision recorded; docsが overlay JSON、合成freeze判定、status語彙、required treatmentを持つ |
| M0-FREEZE Q2: Scorecard wiring | `m-contract-gate` を旧7条件 + CR-grounding overlay の判定器にする | Codex after Q1 | Pending | `legacyFrozen`、`crGroundingOverlayApproved`、`crGroundingOverlayProblems`、総合 `frozen` が出る |
| M0-FREEZE Q3: Scorecard regeneration | overlay込みの scorecard JSON/Markdown を生成する | Codex after Q2 | Pending | Markdown/JSONにCR-grounding overlayと残境界が表示される |
| M0-FREEZE Q4: Final audit | docs、overlay、scorecard、tests が同じ判定をしているか確認する | Fable + Codex checks | Pending | targeted review、機械チェック4点、Fable final approval |
| S-CHOICE / S-TURN | 903.9a と 704.5j を汎用 `pendingRuleChoices` に載せる | Codex after final approval | Not started | commander choice と legend rule が同じchoice substrateで説明できる |
| S-EVENTS / PRIORITY | CR 603.3b second bucket をAPNAP順序とpriority loopへ接続する | Codex | Not started | bucket -> APNAP -> controller order が実行可能testで固定される |
| S-EVENTS / MANA | CR 605.1b triggered mana ability をno-stack transactionとして扱う | Codex | Not started | 605.1bが通常 `pendingTriggers` に混ざらない |
| S-SBA incremental | full SBA suite を一括ではなく価値順に増やす | Codex | Not started | 各SBAがCR refs、event metadata、golden/test付きで追加される |
| S-ZONES / S-LAYERS | 400.7例外群とeffective snapshotを境界から実装対象へ移す | Codex | Not started | public-zone exception / LKI / layer-applied snapshot が個別testで固定される |
| C-GRAMMAR | Oracle compiler の対応構文を増やす | Codex | Not started | compiler誤訳がGameStateを直接書かず、command列とundoで閉じる |

## Immediate next action

次に進むべき実作業は Fable 側の Q1 である。

1. `m0-freeze-decision-record.md` の D1〜D6 を contract-update stage として承認または差し戻す。
2. 承認なら `q1-decision-record-approve.patch` と `q1-docs-contract.patch` を確認・適用する。
3. `verify-q1-docs-contract.mjs` と `review.m-contract-gate` を走らせる。
4. Q1 が通った後にだけ、Codex が Q2 scorecard overlay wiring へ進む。

Codex は Q1 が完了するまで、`docs/`、`review.*`、`scripts/m-contract-gate.ts`、`scripts/lib/mContractGate.ts`、scorecard再生成、S-* 実装、git操作を行わない。

## How CR is used

CR全文をアプリに実装するのではなく、CRを検査器にする。

現在の使い方:

- 2026-06-19版に固定する。
- 仕様判断ごとにCR refsを置く。
- CR refsを golden case と traceability matrix へ接続する。
- 実装済み、部分合格、境界、未実装を overlay status で区別する。
- `m-contract-gate` が overlay を読むことで、CR-grounding が機械判定へ入る。

この形が現段階では最上である。全文パーサ化や完全ルールエンジン化へ進むと、EDH一人回しの価値に対して実装負荷と誤裁定リスクが大きすぎる。次に磨くべき点はCR読解量ではなく、読解結果を docs契約と scorecard 判定器へ接続すること。

## Stop rules

以下の状態では、便利な自動化へ進まない。

- Q1 decision が未記録。
- docs 契約に overlay 判定がない。
- scorecard が overlay を読まずに `frozen: true` を出せる。
- `PARTIAL` / `PASS(core)` / `PASS(boundary)` が出力から消える。
- `remainingBoundary` が空のまま部分合格を承認できる。
- 実装案にCR refs、state invariant、実行可能golden/testのいずれかがない。

## Session rule

1セッションは1マイルストーンに閉じる。今のセッションのマイルストーンは M0-FREEZE Q1/Q2 の接続準備までであり、S-* 実装へは広げない。
