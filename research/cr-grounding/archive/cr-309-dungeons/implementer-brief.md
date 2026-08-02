# Implementer Brief: cr-309-dungeons

Milestone: cr-309-dungeons
Base SHA: 4c68375
CR refs: 309, 701.49, 704.5t
Judge: deterministic-cr

## Goal

Implement the Dungeon card type substrate: dungeon definitions, venture marker state, the `ventureIntoDungeon` guided command, room ability triggers, and SBA 704.5t (completed dungeon removal). Prove the full venture lifecycle with a golden replay.

## CR Summary (authoritative: rule/Magic_The_Gathering_Comprehensive_Rules.txt)

- 309.1: Dungeon is a card type on nontraditional cards.
- 309.2: Dungeon cards begin outside the game, enter the command zone via venture.
- 309.2c: Dungeons are not permanents, can't be cast, can't leave command zone except leaving the game.
- 309.3: A player can own only one dungeon in the command zone at a time.
- 309.4: Rooms connected by arrows; venture marker tracks current room.
- 309.4a: Marker starts on topmost room.
- 309.4c: Room abilities: "When you move your venture marker into this room, [effect]." Controlled by dungeon owner.
- 309.5a: Venture with marker not on bottommost → move marker following an arrow (choice if multiple).
- 309.5b: Venture with marker on bottommost → remove dungeon (complete it), choose new dungeon, marker on topmost.
- 309.6 / 704.5t: SBA — if marker is on bottommost room and no room ability from that dungeon is on the stack, remove the dungeon.
- 309.7: A player completes a dungeon as it's removed from the game.
- 701.49a–c: Venture keyword action procedure.
- 701.49d: "Venture into [quality]" variant (e.g., "venture into Undercity").

## State Design

### New types (src/engine/types.ts)

```ts
/** A single room in a dungeon. */
export interface DungeonRoom {
  name: string;           // room name (flavor, 309.4b)
  oracleText: string;     // room ability effect text
  nextRooms: number[];    // indices of rooms reachable via arrows; empty = bottommost
}

/** Definition of a dungeon card (nontraditional). */
export interface DungeonDef {
  id: string;             // unique dungeon def id
  name: string;           // English name
  printedName?: string;   // Japanese name
  rooms: DungeonRoom[];   // room 0 = topmost
}

/** Per-player dungeon state in the command zone. */
export interface DungeonState {
  dungeonDefId: string;   // which DungeonDef is active
  currentRoomIndex: number; // venture marker position (0-based)
  completedCount: number; // number of dungeons completed this game
}
```

### GameState additions

```ts
// Add to GameState interface:
dungeonDefs: Record<string, DungeonDef>;  // dungeonDefId -> DungeonDef (game-invariant)
dungeons: Partial<Record<PlayerId, DungeonState>>;  // per-player active dungeon
```

### CardInstance / CardDef

Dungeon cards are NOT CardInstances. They don't use the card/zone system. They exist only in `dungeons` state. This follows CR 309.2c (not permanents, can't be cast, can't leave command zone).

## Commands

### ventureIntoDungeon

```ts
| {
    type: 'ventureIntoDungeon';
    playerId: PlayerId;
    dungeonDefId?: string;   // required when no active dungeon (309.2a choice)
    roomChoice?: number;     // required when current room has multiple nextRooms (309.5a choice)
  }
```

Behavior:
1. If no active dungeon for playerId:
   - Require dungeonDefId. Validate it exists in dungeonDefs.
   - Set dungeons[playerId] = { dungeonDefId, currentRoomIndex: 0, completedCount: 0 }.
   - Push a VentureEvent to eventLog.
   - Create a PendingTrigger for room 0's room ability (309.4c).
2. If active dungeon exists and marker is NOT on bottommost room:
   - Determine nextRooms from current room.
   - If multiple nextRooms, require roomChoice. Validate it's in nextRooms.
   - Update currentRoomIndex.
   - Push VentureEvent.
   - Create PendingTrigger for new room's ability.
3. If active dungeon exists and marker IS on bottommost room:
   - Remove dungeon (complete it): increment completedCount, clear dungeonDefId/currentRoomIndex.
   - Require dungeonDefId for the new dungeon.
   - Set new dungeon state with currentRoomIndex: 0.
   - Push VentureEvent (with completedDungeonDefId for the old one).
   - Create PendingTrigger for new room 0's ability.

### Room ability PendingTriggers

Room abilities use the existing PendingTrigger system:
- triggerId: `'trigger.dungeon-room'`
- sourceSnapshot: a synthetic ObjectSnapshot with defId = dungeonDefId, zone = 'command'
- The room's oracleText is the ability text.
- Room abilities are controlled by the dungeon owner (309.4c).

For this slice, room ability EFFECTS are not auto-resolved (manualBoundary). The PendingTrigger is created and surfaced, but resolution is guided/manual. The golden replay proves the trigger is created with correct metadata.

## SBA 704.5t

Add to `performStateBasedActionsOnce`:

```
For each player with an active dungeon:
  If currentRoomIndex is on a bottommost room (nextRooms.length === 0)
  AND no PendingTrigger with triggerId 'trigger.dungeon-room' from this dungeon exists:
    Remove the dungeon (complete it). Log it.
```

This is a cleanup SBA — it removes completed dungeons that have no pending room abilities.

## EventLog

Add a VentureEvent type:

```ts
| {
    type: 'VentureEvent';
    seq: number;
    playerId: PlayerId;
    dungeonDefId: string;
    roomIndex: number;
    completedDungeonDefId?: string;  // set when 309.5b completes old dungeon
  }
```

## restoreGame backfill

Add to restoreGame:
- `dungeonDefs: snapshot.dungeonDefs ?? {}`
- `dungeons: snapshot.dungeons ?? {}`

## Constraints

- src/engine/ is pure functions only. No React/DOM/Zustand imports.
- GameState is immutable (structural sharing). applyCommand is deterministic.
- TypeScript strict, no `any`.
- UI text in Japanese, code/comments/identifiers in English.
- Do NOT modify review.* test files.
- Do NOT modify AGENTS.md, CLAUDE.md, eslint.config.js, docs/, or the ledger.
- Do NOT use git.

## Acceptance Cases

Write ordinary tests in `src/engine/__tests__/cr309-dungeons.test.ts`:

1. **First venture**: ventureIntoDungeon with no active dungeon → creates DungeonState at room 0, creates PendingTrigger for room 0.
2. **Linear advance**: venture on a linear dungeon (each room has exactly 1 nextRoom) → marker advances, room ability trigger created.
3. **Branch choice**: venture on a branching room without roomChoice → error/no-op. With valid roomChoice → marker moves to chosen room.
4. **Bottommost venture (309.5b)**: venture when marker is on bottommost → old dungeon completed (completedCount incremented), new dungeon starts at room 0.
5. **SBA 704.5t**: dungeon at bottommost with no pending room trigger → SBA removes it. With pending room trigger → SBA does NOT remove it.
6. **One dungeon per player (309.3)**: second ventureIntoDungeon with a different dungeonDefId while one is active → uses existing dungeon (does not create a second one).
7. **restoreGame backfill**: old snapshot without dungeons/dungeonDefs → restored with empty defaults.

## Dungeon fixtures for tests

Use a simplified 3-room linear dungeon and a 4-room branching dungeon:

```ts
const LINEAR_DUNGEON: DungeonDef = {
  id: 'test-linear',
  name: 'Test Linear Dungeon',
  rooms: [
    { name: 'Entrance', oracleText: 'Draw a card.', nextRooms: [1] },
    { name: 'Middle', oracleText: 'Gain 2 life.', nextRooms: [2] },
    { name: 'Exit', oracleText: 'Create a Treasure token.', nextRooms: [] },
  ],
};

const BRANCH_DUNGEON: DungeonDef = {
  id: 'test-branch',
  name: 'Test Branch Dungeon',
  rooms: [
    { name: 'Start', oracleText: 'Draw a card.', nextRooms: [1, 2] },
    { name: 'Left Path', oracleText: 'Gain 3 life.', nextRooms: [3] },
    { name: 'Right Path', oracleText: 'Deal 1 damage to target.', nextRooms: [3] },
    { name: 'End', oracleText: 'Create a Treasure token.', nextRooms: [] },
  ],
};
```

## Done when

- All 7 acceptance tests pass.
- `npx tsc -b --noEmit` passes.
- No regressions in existing engine tests (run `npx vitest run src/engine/ --reporter=verbose`).
- Report: changed files, acceptance results, defers, unresolved points.
