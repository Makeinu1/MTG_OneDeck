# Cold Audit Brief: cr-309-dungeons

## Domain

- ID: `cr-309-dungeons`
- CR refs: 309, 701.49, 704.5t
- Lane: late-backbone
- Status under audit: `implemented-not-audited`
- Candidate tree: working tree (uncommitted changes on top of HEAD 4c68375)

## Contract

CR 309 defines the Dungeon card type: nontraditional cards that live in the command zone, tracked by a venture marker moving through rooms connected by arrows. Room abilities trigger when the marker enters. CR 701.49 defines the venture keyword action procedure. CR 704.5t is the SBA that removes a dungeon whose marker is on the bottommost room with no pending room ability.

Key rules:
- 309.2a: First venture → choose dungeon from outside game, put in command zone, marker on topmost room.
- 309.2c: Dungeons are not permanents, can't be cast, can't leave command zone except leaving the game.
- 309.3: Only one dungeon per player at a time.
- 309.4c: Room abilities trigger on marker entry, controlled by dungeon owner.
- 309.5a: Venture with marker not on bottommost → follow arrow (choice if multiple).
- 309.5b: Venture on bottommost → complete dungeon, choose new one, marker on topmost.
- 309.6 / 704.5t: SBA removes dungeon at bottommost with no pending room ability on stack.
- 309.7: Completing a dungeon increments completion count.

## Boundary

- This slice covers the dungeon substrate: DungeonDef/DungeonState types, ventureIntoDungeon command, room ability PendingTriggers, VentureEvent, SBA 704.5t, and restoreGame backfill.
- Room ability EFFECT resolution is explicitly manual/guided only (manualBoundary).
- No UI wiring (engine-only slice).
- "Venture into [quality]" (701.49d) variant is not implemented (no quality filtering).

## Changed files

- `src/engine/types.ts` — DungeonRoom, DungeonDef, DungeonState, VentureEvent interfaces; GameState additions.
- `src/engine/commands.ts` — ventureIntoDungeon command, dungeon helpers, SBA 704.5t, VentureEvent push.
- `src/engine/init.ts` — initial state includes dungeonDefs/dungeons.
- `src/store/gameStore.ts` — normalizeSnapshotState backfill.
- `src/components/game/recentCueModel.ts` — exhaustive switch case for venture event.
- `src/engine/__tests__/cr309-dungeons.test.ts` — 7 implementer acceptance tests.
- `src/engine/__tests__/review.cr309-dungeons.test.ts` — 11 judge-owned adversarial tests.

## Evidence to verify

1. `npx vitest run src/engine/__tests__/review.cr309-dungeons.test.ts --reporter=verbose` — 11 cases must pass.
2. `npx vitest run src/engine/__tests__/cr309-dungeons.test.ts --reporter=verbose` — 7 cases must pass.
3. Read `src/engine/commands.ts` dungeon sections and verify against CR 309/701.49/704.5t.
4. Read `src/engine/types.ts` dungeon types for correctness.

## Adversarial probes the auditor should run

- Venture into a dungeon, advance to bottommost, then run SBA with a pending room trigger → dungeon must survive.
- Venture into a dungeon, advance to bottommost, clear triggers, run SBA → dungeon must be removed.
- Attempt to venture with an invalid dungeonDefId → no-op.
- Attempt to venture on a branch without roomChoice → marker stays.
- Venture on bottommost with a new dungeon → completedCount increments, new dungeon at room 0.
- Check that VentureEvent appears in eventLog with correct playerId/roomIndex.
- Check restoreGame backfill: old snapshot without dungeons → empty defaults.
- Check that dungeon state is properly cloned in makeDraft (immutability).
- Check that room ability triggers have correct triggerId and sourceSnapshot metadata.

## Deliverable

Write findings to `research/cr-grounding/archive/cr-309-dungeons/cold-audit-findings.md` using the standard format. Do NOT edit any source files.
