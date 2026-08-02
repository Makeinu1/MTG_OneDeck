# CR-310 Battles — Implementer Brief

**Milestone**: cr-310-battles-deferred-by-demand
**Base SHA**: f29dc938423cecdba075d9dc9e47ed5b25dc2ec6
**Contract**: `research/cr-grounding/cr-310-battles.draft.md`

## Goal

Implement the Battle permanent substrate in the engine: defense counters, protector designation, combat damage to battles, Siege defeated trigger, and SBA 704.5v/w/x.

## Constraints

- Do NOT touch git, `review.*` tests, `AGENTS.md`, `docs/`, ledger, or eslint config.
- Do NOT add new GameState top-level fields. Use existing `counters` map (`'defense'` key) and optional `protectorId` on CardInstance.
- TypeScript strict, no `any`. UI text in Japanese, code/comments/identifiers in English.
- Engine (`src/engine/`) is pure functions only — no React/DOM/Zustand imports.
- All existing tests must remain green.
- No UI changes this slice.

## Implementation steps

### Step 1: CardFace + Scryfall mapping

In `src/types/card.ts`, add `defense?: string` to `CardFace` (after `loyalty`).

In `src/data/scryfall.ts`:
- Add `defense?: string` to `ScryfallCardFace` interface (after `loyalty`).
- Add `defense?: string` to `ScryfallCard` interface (after `loyalty`).
- In `mapScryfallCardToCardDef`, pass `defense: face.defense` for card_faces and `defense: card.defense` for single-face cards.

### Step 2: Engine types

In `src/engine/types.ts`:

1. Add `protectorId?: PlayerId` to `CardInstance` (after `attachedTo`).

2. Extend `CombatTarget`:
```ts
export type CombatTarget =
  | { type: 'player'; playerId: PlayerId; lifeLabel?: string }
  | { type: 'battle'; cardId: string; objectId: ObjectId };
```

3. Add to GameCommand union:
```ts
| { type: 'chooseBattleProtector'; cardId: string; protectorId: PlayerId }
```

### Step 3: ETB defense counters + protector (in commands.ts)

Find where planeswalker loyalty counters are set on ETB (around line 1096-1101, the block that checks `typeLine.includes('Planeswalker')`). Add an analogous block for battles:

```ts
+if (typeLine.includes('Battle') && typeof face?.defense === 'string') {
+  const defense = Number.parseInt(face.defense, 10);
+  if (!Number.isNaN(defense) && defense > 0) {
+    counters.defense = defense;
+  }
+}
```

For protector assignment: after the battle enters the battlefield, set `protectorId`. For a Siege in the current 2-player model, the protector is the opponent of the controller. Use the existing player infrastructure:

- If controllerId === localPlayerId, protector = DEFAULT_OPPONENT_ID (or first opponent in turnOrder).
- If controllerId !== localPlayerId, protector = localPlayerId.
- For N-player: emit a PendingRuleChoice (but this can be a documented defer since current games are 2-player).

The protector assignment should happen in the same code path where the permanent enters (where loyalty counters are set). Set it directly on the CardInstance.

### Step 4: Combat damage to battles

In `applyResolveCombatDamage` (around line 2008+):

When an unblocked attacker has `target.type === 'battle'`:
- Look up the battle card by `target.cardId`.
- Remove defense counters equal to the attacker's power (min 0).
- If defense reaches 0 and the battle is a Siege → push a Siege-defeated trigger.
- Do NOT set `damageMarked` on battles (CR 310.6: damage removes counters, not marked).
- Lifelink still applies (controller gains life).

When a blocked attacker has `target.type === 'battle'`:
- Same as above for the overflow/unblocked portion.
- For single-blocker: damage to blocker works normally; if attacker survives and is unblocked equivalent, damage goes to battle.
- Actually per CR, blocked attackers assign damage to blockers first. If the attacker is blocked, it deals damage to the blocker (not the battle) unless it has trample. Trample overflow to a battle → remove defense counters. For this slice: treat trample overflow to battle same as unblocked damage to battle. Non-trample blocked attackers deal no damage to the battle.

### Step 5: Siege defeated trigger (CR 310.11b)

When the last defense counter is removed from a Siege:
- Push a PendingTrigger (use existing PendingTrigger infrastructure).
- The trigger's resolution: exile the battle, then the controller may cast it transformed (faceIndex = 1) without paying mana cost.
- Use the existing `linkedExiles` or a simple zone move to exile, then a cast-transform command.

If implementing the full "may cast transformed" is too complex for this slice, implement the exile part and emit a warning/guided message for the cast-transform part. The golden test should verify at minimum: defense → 0, trigger fires, battle is exiled.

### Step 6: SBA additions

In `performStateBasedActionsOnce`:

Add after the existing SBA checks (planeswalker loyalty, etc.):

**704.5v**: For each battle on battlefield with `(counters.defense ?? 0) === 0`:
- Check if it has a pending trigger on the stack (sourceId match in pendingTriggers). If yes, skip.
- Otherwise move to owner's graveyard with sbaApplied '704.5v'.

**704.5w**: For each battle on battlefield with no `protectorId` or protector not in `state.players`:
- If not currently attacked (no combat attacker targeting this battle):
  - In 2-player: auto-assign the opponent as protector (for Siege) or controller (for non-Siege).
  - If no valid protector possible: graveyard with sbaApplied '704.5w'.

**704.5x**: For each Siege on battlefield where `protectorId === controllerId`:
- In 2-player: auto-assign the other player.
- If no opponent available: graveyard with sbaApplied '704.5x'.

### Step 7: chooseBattleProtector command

Add handler in the command switch:
```ts
+case 'chooseBattleProtector': {
+  const card = requireCard(draft, cmd.cardId);
+  // validate battle on battlefield, protectorId is valid
+  setCard(draft, { ...card, protectorId: cmd.protectorId });
+  pushLog(draft, `${nameOf(draft, cmd.cardId)}の保護者に${cmd.protectorId}を指定しました。`);
+  break;
+}
```

### Step 8: Helper — isBattle check

Add a helper analogous to `isBattlefieldCreature`:
```ts
+function isBattlefieldBattle(draft: Draft, card: CardInstance): boolean {
+  return card.zone === 'battlefield' && typeLineOf(draft, card).includes('Battle');
+}
```

### Step 9: Tests

Create `src/engine/__tests__/cr310-battles.test.ts` (NOT a review.* file — that's judge-owned):

Test cases:
1. Battle enters with defense counters (use a synthetic CardDef with typeLine "Battle — Siege", defense "3").
2. Protector is auto-assigned to opponent for Siege.
3. markDamage on a battle removes defense counters (not damageMarked).
4. Defense reaching 0 on a Siege pushes a trigger / exiles.
5. SBA 704.5v moves a 0-defense non-Siege battle to graveyard.
6. Combat: unblocked attacker targeting a battle removes defense counters.

Use the existing test patterns (see `src/engine/__tests__/combat.test.ts` for combat setup patterns).

## Done when

- All new tests pass.
- All existing tests pass (`npx vitest run` in the engine project).
- `npx tsc -b` passes.
- Report: changed files, test results, any defers.
