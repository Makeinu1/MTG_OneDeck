# CR-310 Battles — Contract Draft (judge-owned)

**Milestone**: cr-310-battles-deferred-by-demand
**Base SHA**: f29dc938423cecdba075d9dc9e47ed5b25dc2ec6
**CR refs**: 310.1–310.11b, 704.5v, 704.5w, 704.5x, 508 (attack battles)
**Dependencies (all shipped)**: cr-506-510-combat, cr-player-specific-zones, cr-703-704-sba-turn-based

## 1. Scope

Implement the minimum Battle substrate for normal Commander:

- CardFace gains `defense?: string` (analogous to `loyalty`).
- Scryfall mapping reads `defense` from card_faces / top-level.
- Battle permanent enters with defense counters (CR 310.4b replacement effect).
- Protector designation on enter (CR 310.8a / 310.11a: Siege → must choose opponent).
- Combat can target battles (CombatTarget extended).
- Damage to a battle removes defense counters (CR 310.6).
- SBA 704.5v: defense 0 → graveyard (unless triggered ability on stack from this battle).
- SBA 704.5w: no protector / protector not in game → controller chooses or graveyard.
- SBA 704.5x: Siege controller is also protector → choose opponent or graveyard.
- Siege intrinsic trigger (CR 310.11b): last defense counter removed → exile, may cast transformed.

### Out of scope (honest defer)

- Attacking battles UI (declare-attackers dialog extension) — manual/guided only this slice.
- Blocking creatures attacking a battle (310.8c) — manual.
- Multiple battle types beyond Siege (none exist yet).
- Battle as attachment (310.9) — no card does this.
- "Defending player" relative to battle (310.8d) — deferred to combat-UI slice.

## 2. Type changes

### 2.1 CardFace (src/types/card.ts)

```ts
export interface CardFace {
  // ... existing fields ...
  defense?: string; // printed defense number (battles only)
}
```

### 2.2 ScryfallCard / mapping (src/data/scryfall.ts)

- `ScryfallCardFace` gains `defense?: string`.
- `ScryfallCard` gains `defense?: string`.
- `mapScryfallCardToCardDef` passes `defense` through to CardFace.

### 2.3 CardInstance (src/engine/types.ts)

```ts
export interface CardInstance {
  // ... existing fields ...
  protectorId?: PlayerId; // CR 310.8: designated protector (battles only)
}
```

Defense counters use the existing `counters` map with key `'defense'`.

### 2.4 CombatTarget (src/engine/types.ts)

```ts
export type CombatTarget =
  | { type: 'player'; playerId: PlayerId; lifeLabel?: string }
  | { type: 'battle'; cardId: string; objectId: ObjectId };
```

### 2.5 GameCommand union (src/engine/types.ts)

New command for protector choice on ETB:

```ts
| { type: 'chooseBattleProtector'; cardId: string; protectorId: PlayerId }
```

## 3. State transitions

### 3.1 Battle enters the battlefield (CR 310.4b / 310.8a / 310.11a)

When a Battle spell resolves and the permanent enters:

1. Read printed defense from `CardFace.defense` of the current face.
2. Set `counters.defense = parseInt(defense, 10)`.
3. If typeLine includes 'Siege': protector must be an opponent of the controller.
   - In 2-player (P1 vs OPPONENT_A): deterministic — the opponent is the protector.
   - In N-player: emit a `PendingRuleChoice` for the controller to choose.
4. Set `protectorId` on the CardInstance.

For the current 2-player default game, protector selection is deterministic (the single opponent). No choice UI needed.

### 3.2 Damage to a battle (CR 310.6)

When damage is dealt to a battle permanent (via `markDamage` command or combat):

- Remove that many defense counters (minimum 0).
- This replaces the normal `damageMarked` behavior for battles.
- If the last defense counter is removed and the battle is a Siege → trigger 310.11b.

### 3.3 Siege defeated trigger (CR 310.11b)

"When the last defense counter is removed from this permanent, exile it, then you may cast it transformed without paying its mana cost."

Implementation:
- When defense counters reach 0 on a Siege, push a PendingTrigger with kind `'siege-defeated'`.
- On resolution: exile the battle, then the controller may cast it transformed (faceIndex = 1) without paying mana cost.
- If the controller declines, the card stays exiled.

### 3.4 SBA 704.5v — defense 0

In `performStateBasedActionsOnce`:
- For each battle on the battlefield with `counters.defense === 0`:
  - If it has a triggered ability on the stack (pendingTriggers with sourceId matching), skip.
  - Otherwise, move to owner's graveyard.

Note: For Sieges, the 310.11b trigger fires first, so 704.5v typically doesn't apply to Sieges (the trigger exiles them). 704.5v catches non-Siege battles or edge cases.

### 3.5 SBA 704.5w — no protector

- For each battle on the battlefield with no `protectorId` or whose protector is not in the game:
  - If not currently being attacked: controller chooses an appropriate protector.
  - If no player can be chosen: move to owner's graveyard.

### 3.6 SBA 704.5x — Siege controller is protector

- For each Siege on the battlefield whose `protectorId === controllerId`:
  - Controller must choose an opponent.
  - If no opponent available: move to owner's graveyard.

## 4. Combat integration (minimal)

- `CombatTarget` gains `{ type: 'battle'; cardId; objectId }`.
- `applyDeclareAttackers`: validate that the battle exists, is on the battlefield, and the attacker's controller is not the battle's protector (CR 310.8b).
- `applyResolveCombatDamage`: when an unblocked attacker targets a battle, deal damage to the battle (remove defense counters) instead of a player.
- Trample overflow from a battle goes to the battle's protector (CR 310.8d analog) — deferred; for now, no overflow (honest defer, same as multi-blocker).

## 5. Golden cases

### G1: Siege enters with defense counters and protector

- P1 casts Invasion of Gobakhan (defense 3, Siege).
- On resolution: enters battlefield with `counters.defense = 3`, `protectorId = 'OPPONENT_A'`.

### G2: Damage removes defense counters

- A 2/2 creature attacks the Siege (defense 3).
- Unblocked: defense goes 3 → 1.

### G3: Last counter removed → Siege trigger → exile + transform cast

- Siege has defense 1. Takes 1 damage.
- Defense → 0. Trigger fires.
- On resolution: battle exiled, controller may cast transformed (Lightshield Array).

### G4: SBA 704.5v — non-Siege battle at defense 0

- Hypothetical non-Siege battle at defense 0 with no trigger on stack → graveyard.

### G5: SBA 704.5x — controller is protector

- Siege's protector is somehow its controller → must choose opponent or graveyard.

## 6. Invariant conditions

- I-BATTLE-1: A battle on the battlefield always has `counters.defense >= 0`.
- I-BATTLE-2: A Siege on the battlefield always has a `protectorId` that is an opponent of its controller (after SBA).
- I-BATTLE-3: Damage to a battle never increases `damageMarked`; it only removes defense counters.
- I-BATTLE-4: A battle with defense > 0 is never moved to graveyard by SBA.

## 7. Acceptance

- `review.cr310-battles.test.ts` pins G1–G5 and I-BATTLE-1..4.
- Existing tests remain green (no regression).
- `npm run check` passes.
- No UI changes this slice (engine substrate only).

## 8. File change surface (predicted)

- `src/types/card.ts`: add `defense` to CardFace.
- `src/data/scryfall.ts`: map `defense` from Scryfall.
- `src/engine/types.ts`: `protectorId` on CardInstance, CombatTarget union, new command.
- `src/engine/commands.ts`: ETB defense counters, protector assignment, combat damage to battles, SBA 704.5v/w/x, Siege trigger.
- `src/engine/init.ts`: no change expected (no new GameState field).
- `src/engine/__tests__/review.cr310-battles.test.ts`: golden + invariants.

## 9. Restore/backfill

- `protectorId` is optional on CardInstance → old snapshots simply lack it. No SNAPSHOT_VERSION bump needed.
- `counters.defense` uses existing counters map → no migration.
- CombatTarget union extension is backward-compatible (existing targets are all `type: 'player'`).
