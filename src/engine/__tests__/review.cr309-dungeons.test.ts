// Reviewer-owned adversarial tests for CR 309 Dungeons + 701.49 Venture + 704.5t SBA.
// 実装エージェントは本ファイルを変更しないこと。落ちたら実装側を直す。
//
// CR grounding:
// - 309.2a: first venture → choose dungeon, put in command zone, marker on topmost room.
// - 309.3: only one dungeon per player at a time.
// - 309.4c: room ability triggers on marker entry.
// - 309.5a: venture with choice when multiple arrows.
// - 309.5b: venture on bottommost → complete + new dungeon.
// - 309.6 / 704.5t: SBA removes dungeon at bottommost with no pending room ability.
// - 309.7: completing a dungeon increments completion count.
import { describe, expect, it } from 'vitest';

import { applyCommand, performStateBasedActions } from '../commands';
import { initGame } from '../init';
import type { DungeonDef, GameState } from '../types';
import { makeDeck } from './helpers';

const LINEAR: DungeonDef = {
  id: 'rv-linear',
  name: 'Review Linear',
  rooms: [
    { name: 'Top', oracleText: 'Draw a card.', nextRooms: [1] },
    { name: 'Mid', oracleText: 'Gain 2 life.', nextRooms: [2] },
    { name: 'Bottom', oracleText: 'Create a Treasure token.', nextRooms: [] },
  ],
};

const BRANCH: DungeonDef = {
  id: 'rv-branch',
  name: 'Review Branch',
  rooms: [
    { name: 'Start', oracleText: 'Scry 1.', nextRooms: [1, 2] },
    { name: 'Left', oracleText: 'Gain 3 life.', nextRooms: [3] },
    { name: 'Right', oracleText: 'Deal 1 damage.', nextRooms: [3] },
    { name: 'End', oracleText: 'Create a Treasure token.', nextRooms: [] },
  ],
};

function gameWithDungeons(...defs: DungeonDef[]): GameState {
  const state = initGame(makeDeck(20), 1);
  const dungeonDefs = { ...(state.dungeonDefs ?? {}) };
  for (const d of defs) dungeonDefs[d.id] = d;
  return { ...state, dungeonDefs };
}

function venture(state: GameState, dungeonDefId?: string, roomChoice?: number): GameState {
  return applyCommand(state, {
    type: 'ventureIntoDungeon',
    playerId: 'p1',
    dungeonDefId,
    roomChoice,
  }).state;
}

describe('review: CR 309 dungeons — adversarial', () => {
  it('309.2a: first venture places marker on room 0 and creates room ability trigger', () => {
    const state = gameWithDungeons(LINEAR);
    const after = venture(state, 'rv-linear');
    const ds = after.dungeons?.['p1'];
    expect(ds).toBeDefined();
    expect(ds!.dungeonDefId).toBe('rv-linear');
    expect(ds!.currentRoomIndex).toBe(0);
    // room ability trigger must exist
    const roomTrigger = after.pendingTriggers.find(
      (t) => t.triggerId === 'trigger.dungeon-room',
    );
    expect(roomTrigger).toBeDefined();
  });

  it('309.3: cannot create a second dungeon while one is active', () => {
    let state = gameWithDungeons(LINEAR, BRANCH);
    state = venture(state, 'rv-linear');
    // attempt to venture into a different dungeon — should use existing
    const after = venture(state, 'rv-branch');
    const ds = after.dungeons?.['p1'];
    expect(ds!.dungeonDefId).toBe('rv-linear');
    // marker should have advanced to room 1 (linear), not reset to 0
    expect(ds!.currentRoomIndex).toBe(1);
  });

  it('309.4c: each room transition creates exactly one new room ability trigger', () => {
    let state = gameWithDungeons(LINEAR);
    state = venture(state, 'rv-linear'); // room 0
    const count0 = state.pendingTriggers.filter((t) => t.triggerId === 'trigger.dungeon-room').length;
    state = venture(state); // room 1
    const count1 = state.pendingTriggers.filter((t) => t.triggerId === 'trigger.dungeon-room').length;
    expect(count1).toBe(count0 + 1);
  });

  it('309.5a: branch without roomChoice does not advance marker', () => {
    let state = gameWithDungeons(BRANCH);
    state = venture(state, 'rv-branch'); // room 0 (branching)
    const before = state.dungeons?.['p1']?.currentRoomIndex;
    const after = venture(state); // no roomChoice
    expect(after.dungeons?.['p1']?.currentRoomIndex).toBe(before);
  });

  it('309.5a: branch with invalid roomChoice does not advance marker', () => {
    let state = gameWithDungeons(BRANCH);
    state = venture(state, 'rv-branch'); // room 0, nextRooms = [1, 2]
    const after = venture(state, undefined, 3); // invalid
    expect(after.dungeons?.['p1']?.currentRoomIndex).toBe(0);
  });

  it('309.5a: branch with valid roomChoice advances to chosen room', () => {
    let state = gameWithDungeons(BRANCH);
    state = venture(state, 'rv-branch'); // room 0
    const after = venture(state, undefined, 2); // choose right path
    expect(after.dungeons?.['p1']?.currentRoomIndex).toBe(2);
  });

  it('309.5b: venture on bottommost completes dungeon and starts new one', () => {
    let state = gameWithDungeons(LINEAR, BRANCH);
    state = venture(state, 'rv-linear'); // room 0
    state = venture(state); // room 1
    state = venture(state); // room 2 (bottommost)
    expect(state.dungeons?.['p1']?.currentRoomIndex).toBe(2);
    // venture again on bottommost → complete + new
    const after = venture(state, 'rv-branch');
    const ds = after.dungeons?.['p1'];
    expect(ds!.dungeonDefId).toBe('rv-branch');
    expect(ds!.currentRoomIndex).toBe(0);
    expect(ds!.completedCount).toBe(1);
  });

  it('309.6 / 704.5t: SBA removes dungeon at bottommost with no pending room trigger', () => {
    let state = gameWithDungeons(LINEAR);
    state = venture(state, 'rv-linear'); // room 0
    state = venture(state); // room 1
    state = venture(state); // room 2 (bottommost)
    // clear pending triggers to simulate resolved room abilities
    state = { ...state, pendingTriggers: [] };
    const after = performStateBasedActions(state).state;
    // dungeon entry remains for completedCount tracking but has no active dungeon
    const ds = after.dungeons?.['p1'];
    expect(ds?.dungeonDefId).toBe('');
    expect(ds?.completedCount).toBe(1);
  });

  it('309.6 / 704.5t: SBA does NOT remove dungeon with pending room trigger', () => {
    let state = gameWithDungeons(LINEAR);
    state = venture(state, 'rv-linear'); // room 0
    state = venture(state); // room 1
    state = venture(state); // room 2 (bottommost) — room trigger pending
    const hasPending = state.pendingTriggers.some((t) => t.triggerId === 'trigger.dungeon-room');
    expect(hasPending).toBe(true);
    const after = performStateBasedActions(state).state;
    expect(after.dungeons?.['p1']).toBeDefined();
    expect(after.dungeons?.['p1']!.currentRoomIndex).toBe(2);
  });

  it('VentureEvent is pushed to eventLog on each venture', () => {
    let state = gameWithDungeons(LINEAR);
    state = venture(state, 'rv-linear');
    const events = state.eventLog.filter((e) => e.type === 'venture');
    expect(events.length).toBeGreaterThanOrEqual(1);
    const last = events[events.length - 1] as { playerId: string; roomIndex: number };
    expect(last.playerId).toBe('p1');
    expect(last.roomIndex).toBe(0);
  });

  it('venture with unknown dungeonDefId is a no-op', () => {
    const state = gameWithDungeons(LINEAR);
    const after = venture(state, 'nonexistent');
    expect(after.dungeons?.['p1']).toBeUndefined();
  });
});
