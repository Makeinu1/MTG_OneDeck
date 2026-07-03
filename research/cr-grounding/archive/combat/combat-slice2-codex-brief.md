# S-COMBAT slice 2 — unblocked player damage + declareAttack 統合(Codex 自己完結)

発行: Fable / 2026-07-01
設計正本(承認済): `research/cr-grounding/combat-slice2-design.draft`(Option A 採用)
固定CR: Magic: The Gathering Comprehensive Rules, effective 2026-06-19
対象CR: 506.1 / 508.1b / 508.1f / 509.1h / 510.1a / 510.1b / 510.2 / 120.3a / 120.8

## 目的(1行)

未ブロック attacker が defending player に combat damage(life 減)を与えるようにし、既存 store `declareAttack` を combat substrate の薄い互換ラッパへ統合して**二重ダメージ経路を解消**する。

## Fable 裁定(固定制約・変更不可)

1. **player damage は `resolveCombatDamage` 内で**(`applyResolveCombatDamage`)。store ショートカットに別の public life command を足さない。未ブロック attacker(`blockedBy.length===0`)で、stored object が live battlefield creature かつ target が player なら `max(0, effectivePower(state, attacker.cardId))` をその player へ割当(CR 510.1a/510.1b/120.8)。**player ごとに集計してから**、creature damage と同じ **single draft** 上で life を減算(CR 510.2 atomic)。`P1`→`state.life`、`OPPONENT_A`→`state.opponentLife[label]`(欠落は 40 default=既存 `adjustOpponentLife` と同じ)。**public `adjustLife`/`adjustOpponentLife` を applyCommands で連発して combat damage を表さない**。コード再利用したいなら内部 draft helper を抽出し public command と `resolveCombatDamage` の両方から呼ぶ。新 SBA は足さない。opponent life は0未満可。
2. **target-label bridge = `CombatTarget.lifeLabel?: string`**(Option 1)。型: `CombatTarget = { type: 'player'; playerId: PlayerId; lifeLabel?: string }`(**planeswalker variant は今回足さない**=player only)。`resolveCombatDamage` は `OPPONENT_A` に対し `lifeLabel ?? '対戦相手A'` を使う。
3. **declareAttack = 互換ラッパ(Option A)**。`src/store/gameStore.ts` の `declareAttack(attackerIds, targetLabel)` を、内部で次の単一トランザクションへ書き換える:
   ```ts
   applyCommands(cur, [
     { type: 'enterCombat', attackingPlayerId: 'P1', defendingPlayerId: 'OPPONENT_A' },
     { type: 'declareAttackers', attackers: attackerIds.map((cardId) => ({
         cardId, target: { type: 'player', playerId: 'OPPONENT_A', lifeLabel: targetLabel } })) },
     { type: 'declareBlockers', blockers: [] },
     { type: 'resolveCombatDamage' },
   ])
   ```
   1回 commit(単一 undo 維持)→ 従来通り `collectAttackPendingTriggers(committed, attackerIds)` で attack pending triggers を append・`triggerCandidates` 設定。**non-vigilance tap は `declareAttackers`(CR508.1f)が担う**(declareAttack 側の重複 tap を除去)。summoning-sickness warning は従来通り出す。
4. **defer(scope-boundary・engine-spec に明記)**: planeswalker target damage・trample-to-player(CR702.19/120.4a)・first/double strike・damage prevention/replacement/redirection(CR614.9/615)・infect/toxic/lifelink/wither の damage 結果(plain life-loss のみ=これらキーワードで CR PASS を主張しない・golden は vanilla creature)・combat-damage trigger 検出・commander damage 自動集計・battle。

## 既存挙動を壊さない(最優先・回帰)

以下の既存テストは全て緑を維持(declareAttack 依存):
- `src/engine/__tests__/m47.test.ts` / `review.m47.test.ts`(power 合算・non-vigilance tap・vigilance 非tap・summoning sickness warning・指定 opponent ドレイン)
- `src/store/__tests__/review.m6_10.test.ts`(`trigger.attack` surface)
- `src/store/__tests__/review.phaseC.test.ts`(attack 宣言だけでは `trigger.combat-damage` candidate を作らない)
- `src/store/__tests__/triggerCandidates.test.ts`(attack candidates 出現 → undo/redo で消える)

互換 pin(設計 draft 由来): `declareAttack([4-power, 2-power vigilance], '対戦相手A')` → opponent life 34・non-vigilance のみ tap・warning 維持・attack trigger candidates 出現/undo・redo で clear・`trigger.combat-damage` を作らない。

**`review.*` を名に含むテストは変更禁止**(レビュー担当専有)。もし review.combat / review.m47 / review.m6_10 / review.phaseC の期待が新挙動で割れるなら、**コードでなく Fable へ報告**(実装で勝手に直さない)。ただし非 review の golden(crGroundingGoldenCases / golden-cases.json)は更新してよい(下記)。

## golden 更新/追加(`golden-cases.json` → `crGroundingGoldenCases.test.ts`)

- **置換**: slice 1 の `cr-combat-unblocked-attacker-no-creature-mark`(opponentLife 不変を主張)→ `cr-combat-unblocked-attacker-damages-defending-player`(CR509.1h/510.1a/510.1b/510.2/120.3a/120.8): P1 3/3 未ブロック → attacker は creature mark 無しで battlefield 残存・`opponentLife['対戦相手A']` 40→37・step `endOfCombat`。**旧 id は削除し新 id へ**。
- 追加 `cr-combat-blocked-attacker-does-not-damage-player`: 3/3 attacker・1/4 blocker → creature mark は slice1 通り・opponent life 40 のまま(blocked)。
- 追加 `cr-combat-multiple-unblocked-attackers-aggregate-player-damage`: 2/2 + 4/4 未ブロック → opponent life 40→34。

## 対象ファイル(調査して確定)

- `src/engine/types.ts` — `CombatTarget` に `lifeLabel?: string`。
- `src/engine/commands.ts` — `applyResolveCombatDamage` に未ブロック player damage(集計・single draft・clamp≥0)。内部 life helper 抽出。
- `src/store/gameStore.ts` — `declareAttack` を互換ラッパへ。
- `golden-cases.json` / `crGroundingGoldenCases.test.ts` — 上記 golden。
- 型契約草稿は `research/cr-grounding/combat-slice2-engine-spec.draft`(CR 条番号併記)へ。

## 変更禁止 / 規律

- `docs/` 直接編集禁止・`review.*` 変更禁止・git 操作禁止・`CLAUDE.md` 不可侵。
- エンジン純粋関数・GameState イミュータブル・`applyCommand` 決定的。combat damage は単一 command で atomic(CR510.2)維持。
- I1〜I7 + combat 不変条件維持。

## 受け入れ条件(全て緑)

- 機械チェック4点: `npm run lint` / `npx tsc --noEmit` / `npx vitest run` / `npm run build`。
- 新/更新 golden 3件が通る。
- 上記「既存挙動を壊さない」テスト群が全緑(回帰なし)。
- player damage が atomic(`resolveCombatDamage` 単一 command・SBA 1回)。
- declareAttack が二重ダメージしない(life は resolveCombatDamage 経路のみで減る)。

## 中断時

「実装済み/残作業」を明示して再実行(最大2回)。それでも未完なら Fable が仕上げる。
