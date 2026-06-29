# CR Grounding

このディレクトリは、Comprehensive Rules を「参照資料」ではなく「検査器」として使うための成果物を置く。

- 固定CR: 2026-06-19 effective
- 本文: `rule/Magic_The_Gathering_Comprehensive_Rules.txt`
- メタデータ: `rule/Magic_The_Gathering_Comprehensive_Rules.metadata.json`
- 公式URL: `https://media.wizards.com/2026/downloads/MagicCompRules%2020260619.txt`

## 方針

分類器 parity、コーパス被覆、既存 golden replay は有用だが、それだけでは CR 準拠の状態遷移を保証しない。実装判断ごとに根拠CRを置き、その条文から落とした盤面遷移ケースで叩く。

## ファイル

- `golden-cases.json` — S-EVENTS/S-TURN/S-ZONES 実装前に満たすべき CR-grounded golden cases。現時点では既存 `research/golden-replay/cases` に混ぜない。現ハーネスは pending trigger、SBA、object incarnation、commander replacement/SBA をまだ表現できないため。
- `zone-change-study.md` — CR 400/603/704/903.9 を読んだ zone-change substrate の設計スタディ。CRG-5/6/7 へ進む前の正本。
- `sba-inventory.md` — CR 704.5/704.6 を現行 state と照合した SBA 実装棚卸し。`PASS` / `PARTIAL` / `READY` / `BLOCKED` / `SCOPE` を明示し、未実装を緑に混ぜないための定規。
- `m0-r-freeze-readiness.md` — M0-R から M0-FREEZE / S-* 実装へ進む前の凍結前監査。現時点の blocker は個別SBA不足ではなく、rule choice substrate、603.3b second bucket、triggered mana ability、scope partition の設計判断。
- `rule-choice-substrate.md` — R-FREEZE-1 の設計草稿。`pendingSbaChoices` を最終形にせず、903.9a commander choice と 704.5j legend rule を同じ `pendingRuleChoices` レーンへ載せる方針。
- `priority-event-loop.md` — R-FREEZE-2 の設計草稿。CR 603.3b second bucket のため `PendingTrigger.stackPlacementBucket` を追加し、priority boundary を `SBA -> choice -> trigger placement -> repeat` の固定点として扱う方針。
- `mana-ability-substrate.md` — R-FREEZE-3 の設計草稿。CR 605.1b の誘発型マナ能力を通常の `pendingTriggers` / stack placement に混ぜず、mana transaction 内の no-stack 即時解決として扱う方針。
- `scope-partition.md` — R-FREEZE-4 の分類表。CR 400.7 例外群、full effective-characteristics snapshot、full SBA suite、2026-06-19 新語彙、player-specific zones を `S-* carry` / `scope-boundary` / `PASS(core)` に分け、未実装を緑に混ぜない。
- `m0-freeze-handoff.md` — M0-FREEZE レビュー用ハンドオフ。旧 `m-contract-gate` scorecard と CR-grounding overlay を分け、Fableが docs契約・scorecard配線へ反映すべき項目を列挙する。
- `m0-freeze-overlay.json` — M0-FREEZE レビュー用の機械可読 overlay。CRG-1〜8 の status / evidence / freezeTreatment と R-FREEZE-1〜4 の成果物を列挙する。現行 `m-contract-gate` script はまだこのJSONを読まない。
- `m0-freeze-review-packet.md` — Fable / ユーザー向けの最短レビュー入口。読む順番、D1〜D6、Approve後の順序、Reject/Hold時の差戻し先を1枚にまとめる。
- `m0-freeze-execution-queue.md` — M0-FREEZE を判断資料から実行工程へ落とすキュー。Fable/Codexの所有者、触ってよいファイル、コマンド、exit criteria、stop conditionを固定する。
- `project-goal-milestones.md` — プロジェクトゴールから逆算したマイルストーン表。正しい定規、M0-FREEZE、post-freeze実装順、stop rulesを1枚にまとめる。
- `m0-freeze-q1-gap-audit.md` — 現物 `docs/` / scorecard が Q1 を満たしているかの差分監査。現状は overlay JSON 正本化・合成判定契約・acceptance required treatment が未反映。
- `verify-q1-docs-contract.mjs` — Fable が Q1 docs 反映を行った後に、overlay正本化・scorecard合成判定・acceptance required treatment・evidence links が入ったかを検査する読み取り専用 verifier。
- `verify-q1-patch-ready.mjs` — Q1 docs が未反映なら `q1-docs-contract.patch` が現行 docs に適用可能かを検査し、既に反映済みなら二重適用を止める読み取り専用 verifier。
- `verify-q1-patch-effect.mjs` — docs 本体を触らず、一時コピーへ `q1-docs-contract.patch` を仮適用して Q1 docs verifier が通るかを確認する読み取り専用 verifier。
- `q1-fable-one-shot-brief.md` — Fable が Q1 を最小トークンで閉じるための一枚ブリーフ。読む順番、Approve後のdocs反映、post-apply commands、Reject/Hold時の差戻し先を固定する。
- `q1-docs-contract.patch` — Fable が Q1 docs contract update を確認・適用するための unified diff 草案。Codex は docs を直接編集しないため、適用は Fable 側で行う。
- `q1-decision-record-approve.patch` — Fable が D1〜D6 を contract-update stage へ承認する場合にだけ適用する decision record patch 草案。Codex はこの patch を自分では適用しない。
- `verify-q1-decision-record.mjs` — D1〜D6 が `Approve to contract-update stage` として記録済みか検査する読み取り専用 verifier。
- `verify-q1-decision-patch-effect.mjs` — decision record patch を一時コピーへ仮適用し、D1〜D6 approval 記録になるかを確認する読み取り専用 verifier。
- `m0-freeze-review-sheet.md` — Fableが M0-FREEZE の承認/差戻しを判断するための判定票。推奨は「contract-update stage へ承認、S-* 実装はまだ」。
- `m0-freeze-decision-record.md` — Fable / ユーザーが D1〜D6 の承認・差戻しを記録するための判定記録。承認の意味を「contract-update stage」へ限定し、Codex の現時点の作業境界を固定する。
- `q1-fable-command-card.md` — Fable が D1〜D6 を承認する場合に、Q1 decision record と docs 契約反映を最短で実行・検証するためのコマンドカード。
- `m0-freeze-evidence-audit.md` — D1〜D6/CRG-1〜8 の証拠を、ローカル固定CR・JSON・代表テストから監査した結果。contract-update stage へ進む根拠と、S-* 実装へ進まない理由を分ける。
- `m0-freeze-traceability-matrix.md` — CRG-1〜8 を CR refs、golden case、executable test、overlay treatment、残境界まで一列で辿る traceability matrix。CRを検査器にするための対応表。
- `post-freeze-codex-brief.md` — Fable承認後に Codex へ委譲するための実装ブリーフ。Phase 0 は scorecard overlay wiring、S-* はその後。
- `m0-freeze-contract-draft.md` — Fableが docs 契約へ反映するための文言ドラフト。Codexは docs を直接変更しない。
- `docs-contract-update-map.md` — 現行 `docs/engine-spec.md` / `docs/acceptance.md` の既存反映状況を踏まえた、M0-FREEZE契約更新の具体マップ。全面書き換えではなく、overlay正本・decision stage・scorecard合成判定の追記点を示す。
- `docs-contract-update-ready-snippets.md` — D1〜D6 承認後に Fable が docs へ貼り込める粒度の本文候補。現行行アンカー別に E1〜E4 / A1〜A2 を置く。
- `scorecard-overlay-wiring-spec.md` — Fable承認後に `m-contract-gate` へ CR-grounding overlay を接続するための実装仕様。
- `scorecard-overlay-code-map.md` — 現行 `scripts/lib/mContractGate.ts` / `scripts/m-contract-gate.ts` / scorecard 出力を読んだうえでの、overlay配線の具体的なコード変更マップ。承認前には scripts を変更しない。
- `q2-scorecard-overlay-test-plan.md` — Q2 実装時に reviewer-owned test を触らず確認するための通常テスト観点、adversarial fixture、scorecard JSON/Markdown smoke check。
- `q2-scorecard-overlay.patch` — Q1 docs contract update 後に Codex が適用する scorecard overlay wiring の unified diff 草案。`scripts/` 本体と通常テストを対象にし、`review.*` と S-* 実装は触らない。
- `verify-q2-patch-ready.mjs` — Q1 docs contract が反映済みかを確認したうえで、`q2-scorecard-overlay.patch` を適用してよい状態か判定する読み取り専用 verifier。
- `verify-q2-patch-effect.mjs` — `scripts/` 本体を触らず、一時コピーへ `q2-scorecard-overlay.patch` を仮適用して overlay wiring の必須要素と review.* 非変更を確認する読み取り専用 verifier。
- `verify-q2-scorecard-output.mjs` — Q2 適用後に `npm run m-contract-gate` で再生成した scorecard JSON/Markdown が overlay fields、remaining boundary、合成判定を含むか検査する verifier。
- `verify-m0-freeze-preflight.mjs` — Q1/Q2 の現在地を一括判定し、次アクションを表示する読み取り専用 preflight。

## M0 CR Grounding Gate status

2026-06-27 時点の固定ゲート。以後の S-EVENTS/S-TURN/S-ZONES 実装は、この表の「残る境界」を完了条件として扱う。`PASS` は CR refs と実行可能テストで確認済み、`PARTIAL` は明示した境界までのみ合格。

| Gate | Status | Evidence | 残る境界 |
|---|---|---|---|
| CRG-1 CR 2026-06-19 固定 | PASS | `rule/Magic_The_Gathering_Comprehensive_Rules.metadata.json` / SHA-256 固定 | なし |
| CRG-2 CR-golden ケース定義 | PASS | `golden-cases.json` に統率者税・統率者zone選択・マナ能力・トークン・誘発/SBA/優先権・領域移動/LKI・新語彙ケースが存在 | 既存 golden replay への統合は event envelope 対応後 |
| CRG-3 統率者税 CR 903.8 | PASS | `src/engine/__tests__/m431.test.ts` / `src/store/__tests__/review.m431.test.ts` | command 以外から唱える将来ケースは別途拡張 |
| CRG-4 起動型マナ能力 CR 605 | PARTIAL | `activatedManaAbilityPlanForSource` / `review.g4-activate` / `gameStore` tests | 単純な起動型マナ能力は合格。誘発型マナ能力は未実装 |
| CRG-4.5 統率者 zone 選択 903.9a/b | PARTIAL | `moveCommanderWithZoneChoice` bridge / `pendingSbaChoices` substrate v1 / `crGrounding.test.ts` / `Playmat.test.tsx` | 903.9a の deferred choice UI、`stabilizeBeforePriority()` 本体への完全統合、APNAP/fixed-point 統合 |
| CRG-5 トークン死亡 111.7/704.5d | PASS | `cr-token-dies-before-ceases` executable case | full SBA 群は後続 |
| CRG-6 誘発/SBA/優先権 603/704/117 | PARTIAL | `pendingTriggers`、controller/group 保持、no-direct-stack、complete explicit-order priority boundary、APNAP ordering core v1、同一controller内順序選択UI v1、704.5e/704.5f/704.5i/704.5q + deterministic fixed-point v1、`sba-inventory.md` | 603.3b second bucket、remaining full SBA suite |
| CRG-7 領域移動/LKI 400.7/603.10a | PASS(core) | `zoneChangeCounter` / `ObjectSnapshot` / `cr-zone-change-new-object-lki` executable case | CR 400.7 例外群、full effective-characteristics snapshot |
| CRG-8 2026-06-19 新語彙 | PASS(boundary) | `701.69 Heal` valid、Power-up=CR 702.193、Teamwork/Preparation refs | Heal/Power-up/Teamwork/Preparation の実行器は scope-boundary |

M0 の凍結条件:
- 新規ルール実装は CR refs、状態遷移不変条件、実行可能 golden/test を同時に追加する。
- `restoreGame` 前方互換を伴う state 追加は backfill test を必須にする。
- 未実装機構を coverage/pass に混ぜない。`manual` / `scope-boundary` / `PARTIAL` として残す。
- 機械チェック4点(`npm run lint` / `npx tsc --noEmit` / `npx vitest run` / `npm run build`)をゲートにする。
- M0-FREEZE へ進む前に `m0-r-freeze-readiness.md` の R-FREEZE-1〜4 を解決する。R-FREEZE-1 は `rule-choice-substrate.md`、R-FREEZE-2 は `priority-event-loop.md`、R-FREEZE-3 は `mana-ability-substrate.md`、R-FREEZE-4 は `scope-partition.md` に草稿を置いた。M0-FREEZE 判定用の scorecard / 契約ハンドオフは `m0-freeze-handoff.md`、最短レビュー入口は `m0-freeze-review-packet.md`、実行順キューは `m0-freeze-execution-queue.md`、Fable判定票は `m0-freeze-review-sheet.md`、判定記録は `m0-freeze-decision-record.md`、traceability matrix は `m0-freeze-traceability-matrix.md`、契約文ドラフトは `m0-freeze-contract-draft.md`、承認後のCodex委譲案は `post-freeze-codex-brief.md`、scorecard配線仕様は `scorecard-overlay-wiring-spec.md` に置いた。次手は `704.5p` の追加実装ではなく、FableのM0-FREEZEレビュー。

## 次にやること

CRG-5 トークン死亡へ直行しない。先に `zone-change-study.md` の Z1〜Z4 を順に進める。Z1/Z2/Z3/Z4 の最小 substrate と Z5 の実行可能サブセットは完了済み。

1. Z1: `zoneChangeCounter` / `objectIdOf` を追加し、CR 400.7 の object incarnation を表現可能にする。実装済み(2026-06-27)。
2. Z2: `ZoneChangeEvent` と `ObjectSnapshot` を発行する。実装済み(2026-06-27)。
3. Z3: `pendingTriggers` を GameState に導入し、UI の trigger candidate を adapter 化する。実装済み(2026-06-27)。
4. Z4: `stabilizeBeforePriority()` に token cease の最小SBAを載せる。実装済み(2026-06-27)。commander 903.9a は `pendingSbaChoices` substrate v1 を store transaction 内で生成・解決し、command への後続移動を `reason:'sba'` / `sbaApplied:'903.9a'` の event として残す。deferred choice UI と `stabilizeBeforePriority()` 本体への完全統合は後続。
5. Z5: `golden-cases.json` の token / trigger-SBA-priority / zone-object-LKI を実行可能 test へ移す。サブセット実装済み(2026-06-27): `src/store/__tests__/crGroundingGoldenCases.test.ts`。pending trigger の explicit-order stack placement も `pendingTriggerId` 指定で実装済み。

## M1/M2 実装状況

- M1 Priority Boundary v1: 実装済み。`placePendingTriggersForPriority(pendingTriggerIds)` は全pending指定を要求し、渡された順序を各 controller 内の選択順として扱う。controller 間は `activePlayerId` と `PendingTrigger.controllerId` を使って APNAP 順に正規化し、単一バッチで stack へ置く。
- R1 APNAP ordering core v1: 実装済み。`src/engine/priority.ts` の `orderPendingTriggersApnap` が CR 603.3b/101.4 の controller 間順序を決める。現 substrate では 603.3b の「another ability triggering」bucket は未表現のため後続。
- R2 同一controller内順序選択UI v1: 実装済み。`TriggerCandidatePanel` は複数 pending trigger がある場合に上下移動と「この順でスタックへ」を表示し、選択順を `placePendingTriggersForPriority` へ渡す。UI上の順序は「先に置く順=スタック下から上への順」。
- R3/R4 deterministic fixed-point v1: 実装済み。`stabilizeBeforePriority()` は CR 704.5d token cease、CR 704.5e copy cease、CR 704.5f toughness 0 以下、CR 704.5i loyalty 0 planeswalker、CR 704.5q +1/+1/-1/-1 counter annihilation の SBA を反復し、`placePendingTriggersForPriority` は priority boundary 中に新規 pending trigger が生じた場合、順序が一意なら同じ境界内で stack へ置く。複数同一controllerなど選択が必要なら pending を残して止める。
- M2 Player/Controller substrate: 実装済み。`GameState.activePlayerId`、`CardInstance.ownerId`、`CardInstance.controllerId` を追加し、旧snapshotは P1 に backfill する。`ObjectSnapshot` と `PendingTrigger.controllerId` は発生時点の card controller を読む。
- 未実装: 603.3b second bucket、full SBA suite、commander 903.9a の deferred choice UI / `stabilizeBeforePriority()` 本体統合、player-specific zones、dummy opponent の実体化。

## Z5 実行可能化状況

- `cr-token-dies-before-ceases`: 実行可能。battlefield→graveyard event、death pending trigger、CR 704.5d token-cease event、最終 token 消滅、source 消滅後の `sourceSnapshot` 由来 stack placement を検査。
- `cr-trigger-sba-priority-loop`: 部分実行可能。event直後に stack へ直積みせず pending trigger に置くこと、pending trigger が `eventId` / `simultaneousGroupId` / `controllerId` を持つこと、全pending明示順の priority boundary で複数 pending trigger を stack に置けること、混在 controller の pending trigger が APNAP 順で stack に置かれることを検査。card の `controllerId` は event/pending へ保存され、pending trigger 由来の ability object は `sourceSnapshot.controllerId` を優先する。同一controller内順序選択UI v1 は `Playmat.test.tsx` で検査。704.5f 由来 death trigger が priority boundary の deterministic fixed-point で stack へ置かれること、704.5e/704.5i/704.5q の deterministic SBA も検査。remaining full SBA suite は未実装。
- `cr-zone-change-new-object-lki`: 実行可能。physical card id と object incarnation の分離、before snapshot/LKI を検査。

## 実装移行条件

S-EVENTS に入る前に、少なくとも次を実行可能 replay/test へ移植する。現時点で unit test 化済みなのは 1、2 のうち「単純な起動型マナ能力」、3、4 のうち pending 化/no-direct-stack、controller/group 保持、activePlayer/card owner/controller substrate、complete explicit-order priority boundary、APNAP ordering core v1、同一controller内順序選択UI v1、704.5e/704.5f/704.5i/704.5q + deterministic fixed-point v1、5 の object incarnation/LKI 部分。誘発型マナ能力、remaining full SBA suite は未実装に残す。

1. 統率者税: CR 903.8。戻し時ではなく command からの cast 完了時に増える。
2. マナ能力: CR 605。スタックに置かず即解決。単純な起動型は実装済み、誘発型マナ能力は未実装。
3. トークン死亡: CR 111.7/704.5d。移動イベントと誘発確認後に消滅。
4. 誘発/SBA/優先権: CR 603/704/117。pending triggers と `stabilizeBeforePriority()`。
5. 領域移動/LKI: CR 400.7/603.10a。physical card と object incarnation を分離。
6. 統率者 zone 選択: CR 903.9a/b。graveyard/exile は SBA、hand/library は replacement。現時点では `moveCommanderWithZoneChoice` が中間状態で死亡/離場 pending trigger を保持し、`pendingSbaChoices` substrate v1 を生成・解決したうえで command への後続移動を `sbaApplied:'903.9a'` として残す。deferred choice UI と `stabilizeBeforePriority()` 本体への完全統合は後続に残す。
