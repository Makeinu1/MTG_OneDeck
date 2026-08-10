import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { loadSnapshot, saveSnapshot, SNAPSHOT_VERSION } from '../../data/gameSnapshot';
import { initGame } from '../../engine/init';
import { makeDef } from '../../engine/__tests__/helpers';
import {
  disableSnapshotPersistenceForDevelopment,
  useGameStore,
} from '../gameStore';

describe('development fixture snapshot isolation', () => {
  it('does not overwrite the normal saved game after a fixture restore', async () => {
    const def = makeDef({ scryfallId: 'snapshot-isolation', typeLine: 'Creature' });
    const deck = [{ def, isCommander: false }];
    const normal = {
      version: SNAPSHOT_VERSION,
      state: initGame(deck, 1),
      deck,
      autoAdvanceToMain: false,
    };
    await saveSnapshot(normal);

    disableSnapshotPersistenceForDevelopment();
    useGameStore.getState().restoreGame({
      ...normal,
      state: { ...normal.state, life: 1 },
      deck: [],
    });
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect((await loadSnapshot())?.state.life).toBe(normal.state.life);
    expect((await loadSnapshot())?.deck).toHaveLength(1);
  });
});
// verifies: ENG-STATE-004
