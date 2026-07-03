# S-COMBAT: combat structure (first slice) — 実装ブリーフ(Codex 自己完結)

発行: Fable / 2026-06-30
設計正本(承認済): `research/cr-grounding/combat-structure-design.draft`(Option A 採用)
固定CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19
対象CR: 506.1 / 508.1a / 508.1f / 508.1k / 509.1a / 509.1g / 509.1h / 510.1a / 510.1b / 510.1c / 510.1d / 510.2 / 120.6 / 514.2 / 704.5g / 704.5h

## 目的(1行)

combat 構造 substrate(`GameState.combat`)を起こし、攻撃宣言→ブロック宣言→**atomic な combat damage** が既存 `markDamage` セマンティクスを発行して、既存 704.5g/h が destroy を解決する最小スライスを実装する。

## Fable 裁定(固定制約・変更不可)

1. **state model = Option A**: `GameState.combat: CombatState | null`。`CardInstance` に attacking/blocking フラグを足さない。型は design draft の `CombatState`/`CombatAttacker`/`CombatBlocker`(`combatId`/`turn`/`step`/`attackingPlayerId`/`defendingPlayerId`/`attackers[]`/`blockers[]`、各 participant に `objectId` と `declaredOrder`)。
2. **atomicity(CR 510.2・最重要)**: combat damage は**単一の public command `resolveCombatDamage`**で実装する。`applyCommand` は末尾で必ず `stabilizeBeforePriority` を呼ぶため、serial な `markDamage` 連発(applyCommands)は SBA を途中で走らせ CR 510.2 を破る。`resolveCombatDamage` の内部で全 assignment を**1 draft 上で**マークしてから、通常の end-of-command stabilize を1回だけ走らせる(既存 `markDamage` の内部ロジックを再利用。`addMana` 等のように draft を直接編集)。**新しい汎用 atomic-batch primitive は作らない。**
3. **first slice = 単一ブロッカー + 未ブロックのみ**:
   - 攻撃側コントローラの宣言で attackers を記録(CR 508.1a/508.1k)。non-vigilance attacker は tap する(CR 508.1f・決定的)。
   - blocker 宣言は **1 blocker が 1 attacker をブロック**(CR 509.1a/509.1g)。blocked/unblocked は宣言時に確定(CR 509.1h)。
   - combat damage(CR 510.1a–d):①未ブロック attacker → creature markDamage は発生させない(player damage は **first slice 対象外**=下記 defer)②1体にブロックされた attacker → attacker は全 power を blocker へ、blocker は全 power を attacker へ、**両方を atomic にマーク**(CR 510.1c/510.1d/510.2)。deathtouch source は既存の effective keyword 判定で `deathtouch:true` を渡す(CR 704.5h)。power<=0 は割当0(CR 510.1a/120.8)。
   - damage 後は既存 `performStateBasedActionsOnce`/`advanceToPriority` が 704.5g/h を解決。**新 SBA は足さない**。
4. **multi-blocker = defer(manual)**: attacker が複数 blocker にブロックされた場合、blocked とは認識するが **damage 割当は自動でやらない**(CR 510.1c の「コントローラが分割」は真の選択ゆえ、silent な「先頭へ全部」は禁止=北極星「決定論を捏造しない」)。warning/log に「manual-combat-damage」を残し、creature markDamage を出さない。golden はこの defer を pin する。
5. **player damage は first slice 対象外**: 未ブロック attacker の player へのダメージ、および既存 store `declareAttack`(life 調整・attack trigger 収集・tap)との統合は **follow slice**。本スライスは既存 store `declareAttack` を壊さず併存させる(engine combat substrate が新経路)。attack trigger 収集・life 調整は engine combat command に入れない。

## 対象ファイル(調査して確定)

- `src/engine/types.ts` — `CombatState`/`CombatAttacker`/`CombatBlocker`/`CombatStep`/`CombatTarget` 型、`GameState.combat: CombatState | null`。
- `src/engine/commands.ts` — `GameCommand` union に `enterCombat`(or beginCombat)・`declareAttackers`・`declareBlockers`・`resolveCombatDamage`。`applyCommand` の case。`resolveCombatDamage` は内部 mark を1 draft で行う(markDamage 内部関数を抽出/再利用)。
- `src/engine/commands.ts` の `nextPhase`/cleanup — `phase !== 'combat'` 遷移 or combat 終了で `combat` を `null` 化(CR 511 end of combat の最小=combat 構造クリア)。
- `src/store/gameStore.ts` — snapshot 復元 backfill: `combat` 欠落 → `null`。`combat.turn !== state.turn` or `phase !== 'combat'` → `null` 正規化(design draft の backfill rule)。
- 初期化(`init.ts`)で `combat: null`。
- テスト: golden(下記4件)+ unit(commands/combat)。

## golden ケース(`golden-cases.json` → `crGroundingGoldenCases.test.ts`)

1. `cr-combat-single-block-lethal-mutual-damage`(506.1/508.1k/509.1g/509.1h/510.1c/510.1d/510.2/704.5g/120.6): P1 2/2 attacker・opp 2/2 blocker→ enterCombat→declareAttackers→declareBlockers→resolveCombatDamage。両者 damageMarked=2 を atomic に受け、SBA で両方 graveyard(`sbaApplied:'704.5g'`)。**回帰 pin=serial 適用で先に死んだ方が反撃 damage を出さない事態を起こさない(atomic)**。
2. `cr-combat-single-block-sublethal-survives`(510.1c/510.1d/510.2/704.5g): 2/2 attacker・1/3 blocker → 双方 assigned damage を受けるが toughness 未満は 704.5g 非発火・battlefield 残存。
3. `cr-combat-unblocked-attacker-no-creature-mark`(509.1h/510.1b/120.3a): attacker 宣言・blocker なし → unblocked・creature damageMarked 不変(player damage は本スライス対象外)。
4. `cr-combat-multiple-blockers-deferred`(509.1g/509.1h/510.1c): 1 attacker を 2 blocker がブロック → blocked と認識・**combat damage 割当は manual/deferred**(creature markDamage 出さず warning/log)。silent 自動割当をしない pin。

## 変更禁止 / 規律

- **`review.*` を名に含むテストは変更禁止**(レビュー担当専有)。
- **`docs/` を直接編集しない**。型契約草稿は `research/cr-grounding/combat-engine-spec.draft`(CR 条番号併記)へ。Fable が監査後に engine-spec §34.13 へ昇格。
- **git 操作禁止**。`CLAUDE.md` に触れない。
- エンジンは純粋関数・GameState イミュータブル(構造共有)・`applyCommand` 決定的・乱数はペイロード埋め込み。
- I1〜I7 不変条件維持。`GameState.combat` 追加に伴い必要なら不変条件(combat participant の cardId は cards に存在 等)を検討し draft に記す(review.* への反映は Fable)。
- 既存 store `declareAttack` を壊さない(併存)。

## 受け入れ条件(全て緑)

- 機械チェック4点: `npm run lint` / `npx tsc --noEmit` / `npx vitest run` / `npm run build`。
- golden 4件が通る。
- combat damage が atomic(単一コマンド・SBA は damage 全マーク後に1回)=CR 510.2。golden#1 が serial では落ちる形であること。
- 旧 snapshot 復元が緑(combat backfill 効いている)。
- 新 SBA を足していない(704.5g/h 再利用)。multi-blocker は自動割当しない。
- 既存テスト回帰なし。

## 中断時

「実装済み/残作業」を明示して再実行(最大2回)。それでも未完なら Fable が仕上げる。
