import { describe, expect, it } from 'vitest';

import { SNAPSHOT_VERSION, type GameSnapshot } from '../../data/gameSnapshot';
import { useGameStore } from '../../store/gameStore';
import { applyCommand, performStateBasedActions } from '../commands';
import { initGame } from '../init';
import type { DungeonDef, GameState } from '../types';
import { makeDeck } from './helpers';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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

function baseState(): GameState {
  const state = initGame(makeDeck(4), 42);
  return {
    ...state,
    dungeonDefs: {
      [LINEAR_DUNGEON.id]: LINEAR_DUNGEON,
      [BRANCH_DUNGEON.id]: BRANCH_DUNGEON,
    },
    dungeons: {},
  };
}

function dungeonTriggers(state: GameState, playerId: string) {
  return (state.pendingTriggers ?? []).filter(
    (t) => t.triggerId === 'trigger.dungeon-room' && t.controllerId === playerId,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CR 309 dungeons substrate', () => {
  it('1. first venture creates DungeonState at room 0 with PendingTrigger', () => {
    const state = baseState();
    const result = applyCommand(state, {
      type: 'ventureIntoDungeon',
      playerId: 'P1',
      dungeonDefId: 'test-linear',
    });

    const dungeon = result.state.dungeons?.P1;
    expect(dungeon).toBeDefined();
    expect(dungeon!.dungeonDefId).toBe('test-linear');
    expect(dungeon!.currentRoomIndex).toBe(0);
    expect(dungeon!.completedCount).toBe(0);

    const triggers = dungeonTriggers(result.state, 'P1');
    expect(triggers.length).toBe(1);
    expect(triggers[0].resolutionText).toBe('Draw a card.');
    expect(triggers[0].sourceSnapshot.zone).toBe('command');
    expect(triggers[0].sourceSnapshot.typeLine).toBe('Dungeon');
  });

  it('2. linear advance moves marker and creates room ability trigger', () => {
    let state = baseState();
    state = applyCommand(state, {
      type: 'ventureIntoDungeon',
      playerId: 'P1',
      dungeonDefId: 'test-linear',
    }).state;

    // Advance from room 0 to room 1
    const result = applyCommand(state, {
      type: 'ventureIntoDungeon',
      playerId: 'P1',
    });

    const dungeon = result.state.dungeons?.P1;
    expect(dungeon!.currentRoomIndex).toBe(1);

    const triggers = dungeonTriggers(result.state, 'P1');
    // Both room 0 and room 1 triggers should exist
    expect(triggers.length).toBe(2);
    expect(triggers[1].resolutionText).toBe('Gain 2 life.');
  });

  it('3. branch choice: no roomChoice → warning; valid roomChoice → moves', () => {
    let state = baseState();
    state = applyCommand(state, {
      type: 'ventureIntoDungeon',
      playerId: 'P1',
      dungeonDefId: 'test-branch',
    }).state;

    // Room 0 has nextRooms [1, 2] — requires choice
    const noChoice = applyCommand(state, {
      type: 'ventureIntoDungeon',
      playerId: 'P1',
    });
    expect(noChoice.warnings.length).toBeGreaterThan(0);
    expect(noChoice.state.dungeons?.P1?.currentRoomIndex).toBe(0); // unchanged

    // With valid roomChoice
    const withChoice = applyCommand(state, {
      type: 'ventureIntoDungeon',
      playerId: 'P1',
      roomChoice: 2,
    });
    expect(withChoice.warnings.length).toBe(0);
    expect(withChoice.state.dungeons?.P1?.currentRoomIndex).toBe(2);

    const triggers = dungeonTriggers(withChoice.state, 'P1');
    expect(triggers[triggers.length - 1].resolutionText).toBe('Deal 1 damage to target.');
  });

  it('4. bottommost venture completes old dungeon and starts new one (309.5b)', () => {
    let state = baseState();
    // Enter linear dungeon
    state = applyCommand(state, {
      type: 'ventureIntoDungeon',
      playerId: 'P1',
      dungeonDefId: 'test-linear',
    }).state;
    // Advance to room 1
    state = applyCommand(state, {
      type: 'ventureIntoDungeon',
      playerId: 'P1',
    }).state;
    // Advance to room 2 (bottommost)
    state = applyCommand(state, {
      type: 'ventureIntoDungeon',
      playerId: 'P1',
    }).state;
    expect(state.dungeons?.P1?.currentRoomIndex).toBe(2);

    // Venture while on bottommost → complete old, start new
    const result = applyCommand(state, {
      type: 'ventureIntoDungeon',
      playerId: 'P1',
      dungeonDefId: 'test-branch',
    });

    const dungeon = result.state.dungeons?.P1;
    expect(dungeon!.dungeonDefId).toBe('test-branch');
    expect(dungeon!.currentRoomIndex).toBe(0);
    expect(dungeon!.completedCount).toBe(1);

    // VentureEvent with completedDungeonDefId
    const ventureEvents = result.state.eventLog.filter((e) => e.type === 'venture');
    const last = ventureEvents[ventureEvents.length - 1];
    expect(last.type).toBe('venture');
    if (last.type === 'venture') {
      expect(last.completedDungeonDefId).toBe('test-linear');
      expect(last.dungeonDefId).toBe('test-branch');
    }
  });

  it('5. SBA 704.5t removes completed dungeon without pending trigger; keeps with trigger', () => {
    let state = baseState();
    // Enter linear dungeon and advance to bottommost
    state = applyCommand(state, {
      type: 'ventureIntoDungeon',
      playerId: 'P1',
      dungeonDefId: 'test-linear',
    }).state;
    state = applyCommand(state, {
      type: 'ventureIntoDungeon',
      playerId: 'P1',
    }).state;
    state = applyCommand(state, {
      type: 'ventureIntoDungeon',
      playerId: 'P1',
    }).state;
    expect(state.dungeons?.P1?.currentRoomIndex).toBe(2);

    // With pending room trigger → SBA does NOT remove
    expect(dungeonTriggers(state, 'P1').length).toBeGreaterThan(0);
    const withTrigger = performStateBasedActions(state);
    expect(withTrigger.state.dungeons?.P1).toBeDefined();
    expect(withTrigger.state.dungeons?.P1?.currentRoomIndex).toBe(2);

    // Remove the pending trigger manually, then SBA should remove the dungeon
    const noTrigger: GameState = {
      ...state,
      pendingTriggers: (state.pendingTriggers ?? []).filter(
        (t) => !(t.triggerId === 'trigger.dungeon-room' && t.controllerId === 'P1'),
      ),
    };
    const removed = performStateBasedActions(noTrigger);
    // dungeon entry remains for completedCount tracking but has no active dungeon
    expect(removed.state.dungeons?.P1?.dungeonDefId).toBe('');
    expect(removed.state.dungeons?.P1?.completedCount).toBe(1);
  });

  it('6. one dungeon per player (309.3): venture with different defId uses existing', () => {
    let state = baseState();
    state = applyCommand(state, {
      type: 'ventureIntoDungeon',
      playerId: 'P1',
      dungeonDefId: 'test-linear',
    }).state;

    // Try to venture with a different dungeonDefId while one is active
    const result = applyCommand(state, {
      type: 'ventureIntoDungeon',
      playerId: 'P1',
      dungeonDefId: 'test-branch',
    });

    // Should advance the existing linear dungeon, not create a new branch one
    const dungeon = result.state.dungeons?.P1;
    expect(dungeon!.dungeonDefId).toBe('test-linear');
    expect(dungeon!.currentRoomIndex).toBe(1); // advanced from 0 to 1
  });

  it('7. restoreGame backfills missing dungeons/dungeonDefs to empty defaults', () => {
    const storeApi = useGameStore.getState();
    storeApi.newGame(makeDeck(14), 7);
    const current = useGameStore.getState().state!;

    // Simulate a legacy snapshot without dungeon fields
    const legacy = { ...current } as Record<string, unknown>;
    delete legacy.dungeonDefs;
    delete legacy.dungeons;

    const snapshot: GameSnapshot = {
      version: SNAPSHOT_VERSION,
      state: legacy as unknown as GameState,
      deck: makeDeck(14),
      autoAdvanceToMain: false,
    };

    useGameStore.getState().restoreGame(snapshot);
    const restored = useGameStore.getState().state!;
    expect(restored.dungeonDefs).toEqual({});
    expect(restored.dungeons).toEqual({});
  });
});
