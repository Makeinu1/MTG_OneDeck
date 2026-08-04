# 全体CRカバレッジ査察 findings (2026-08-04)

- 監査者: Sagan(冷サブエージェント・fork_context=false・実装文脈なし)
- ブリーフ: `research/cr-grounding/cr-coverage-audit-brief-2026-08-04.md`
- Base SHA: `2f30dba0af4eb742554c465d01775e932a20f055`
- モード: release full check前のsemantic cold audit。`npm run check`は未実行(ブリーフ禁止)。`check:forbidden`=FORBIDDEN 0・NEEDS-REAUTH 2件(台帳+ブリーフ=判定者再オーナー化対象で想定どおり)。vitest個別3ファイル=33/33緑。
- **判定: BLOCKER/HIGH 0・AUDIT-OK-PENDING-FULL-CHECK。台帳編集はコミット可。**

## Findings

**F1[MEDIUM] CR114 Emblem: 未登録・通常Commander到達可能・実装なし。**
対象: 台帳(cr-114 domainなし)・`src/engine/types.ts`(emblem型なし・`rg -i emblem src/`=0件)。PW ultimate(「−10: You get an emblem with…」、census.json:6924に実在)を解決してもemblemを表現するGameStateが存在せず自動化が黙って欠落する。→ 判定者裁定: cr-114-emblems登録(userGate付き)。

**F2[LOW] shipped backbone 10 domainのevidenceがreview.*命名ファイルに解決しない(fake-greenではない)。**
対象: cr-104-loss-advisory, cr-106-mana, cr-108-cards, cr-109-objects, cr-112-spells, cr-113-abilities, cr-117-priority, cr-121-drawing, cr-506-510-combat, cr-903-9-commander-zone-choice。実拘束はcrGroundingGoldenCases.test.ts(36)・crGrounding.test.ts(14)・review.sba-defeat(10)・review.903-10a(11)・review.combat(8)に実在しvacuityなし。ただしgolden ID一部(cr-mana-ability-no-stack・cr-commander-tax-cast-not-return・cr-commander-graveyard-exile-sba-not-replacement・cr-commander-hand-library-replacement・cr-sba-defeat-commander-damage-*・cr-20260619-new-mechanics-boundary)は参照テスト0件で別名ファイルがカバー。→ 判定者裁定: maintenanceエントリで再マッピング。

**F3[LOW] golden-cases.jsonのimplementationRefsに廃パス2件。**
`src/components/playmat/Playmat.test.ts`・`Playmat.tsx`(既に削除済み)。実害は文書陳腐化のみ(挙動はcrGrounding.test.ts:65/487がカバー)。→ 判定者裁定: 現行パスへ修正。

**F4[LOW・既存] plannedSequenceのcr-121-drawing重複(2エントリ)。**
selectionRule②統合則抵触・実害なし。本次編集の導入ではない。→ 判定者裁定: evidence保有エントリへマージ。

**F5[LOW・既存] 台帳evidenceの草稿パス2件がarchive移動未追従。**
score-ts-demand-catalog-repair.draft.md・cr-400-408-linked-exile.draft.mdの実体はarchive/replenishment-2026-07-20/配下。→ 判定者裁定: パス修正。

**F6[LOW・情報] provenance文言が実変更より過大。**
716/719/720のseqはHEAD時点で既にshippedで、本次変更はnote注記のみ。→ 判定者裁定: 文言是正。

**F7[LOW・分類注記] cr-733-illegal-actionsはpending+依存充足で形式的に選定可能。**
nextGate(部分支払い経路導入時)が事実上の先行条件。→ 判定者裁定: nextGate尊重のnote付与。

## B層(問題なしの実証)

- B.2 vacuity: 直近shipped 6件(cr-310/303-704/714/716/719/720)は全て実装公開関数をimportし状態フィールドへ非自明assert(it数9/2/13/18/13/8・expect数16/7/27/34/34/28)。3ファイル実走33/33緑(vitest 4.1.8)。
- B.3 manualBoundary正直さ4件=漏洩なし: heal=guided単対象のみ(compile.ts:2320・mass表現null→manual)、power-up=gameStore.ts:4341 onceガード+commands.ts:5155 enteredTurn条件、teamwork=commands.ts:3836-3857 cast transaction原子実行のみ、omen=commands.ts:3595 validateCastAsOmen(compile.tsにomen経路0件)。

## 台帳追加分14件の判定

全14件承認(各domainのCR照合一致: 705.1-3/706.1-3・7/8、707.2/2b/5/9/10/10a/12-14・613.2a、708.2a/3/4/8/9、709.2-4・709.5/5e/5j・702.102、710.1b/1c/2/4、711.2a/2b、713.1-3、715.2b/3/3a/3b/3d、718.3/3a-d/5・702.160、723.1-3、724.1a-f・724.2、730.2/2a-c/3・702.140、732.1/1a/1b、733.1)。cr-733のみF7注記付き。

## カバレッジマップ(要約・完全版は監査者報告)

- 第1章: 100-123で114 Emblemのみgap(F1)。103 mulligan/105色/106は暗黙カバー。
- 第2章: 200-213はCardDef/faces+layersで暗黙カバー。gapなし。
- 第3章: 303.7 Roles/309 Dungeons/310 Battles shipped。311-315 pruned。308 KindredはcardTypes.ts暗黙。
- 第4章: 400-408 shipped。407 Ante pruned。
- 第5章: 500-514 shipped(combat含む)。
- 第6章: 601-616 shipped。607 linked abilitiesはcompile.ts暗黙カバー(境界記録推奨)。
- 第7章: 700-704 shipped(頻出subset)。705-711/715/718/724/730/733 pending(本次登録)。712/714/716/719/720 shipped。721/722/725-726/728/731 pending(既存)。713/717/723/727/729/732 pruned/deferred。
- 第8章: 806 FFA=903.2の既定で暗黙カバー(review.mp-* 58ケース)。810 pruned。
- 第9章: 903.8/9/10a shipped。901/904/905 pruned。902 VanguardはcrRefs欠落(情報付記)。
