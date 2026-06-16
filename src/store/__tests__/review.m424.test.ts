/**
 * Reviewer-owned adversarial tests for M4.24: in-progress game persistence.
 * Implementation agents must NOT modify this file.
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '../gameStore';
import {
  SNAPSHOT_VERSION,
  clearSnapshot,
  loadSnapshot,
  saveSnapshot,
  type GameSnapshot,
} from '../../data/gameSnapshot';
import { initGame, type InitDeckCard } from '../../engine/init';
import { makeDef } from '../../engine/__tests__/helpers';

function deck(n: number): InitDeckCard[] {
  return Array.from({ length: n }, (_, i) => ({
    def: makeDef({ scryfallId: `c-${i}`, typeLine: 'Creature' }),
    isCommander: false,
  }));
}

beforeEach(async () => {
  await clearSnapshot();
  useGameStore.setState({ autoAdvanceToMain: false });
});

describe('gameSnapshot persistence layer', () => {
  it('round-trips a snapshot through IndexedDB', async () => {
    const d = deck(20);
    const snap: GameSnapshot = {
      version: SNAPSHOT_VERSION,
      state: initGame(d, 7),
      deck: d,
      autoAdvanceToMain: true,
    };
    await saveSnapshot(snap);
    const loaded = await loadSnapshot();
    expect(loaded).not.toBeNull();
    expect(loaded!.state.turn).toBe(snap.state.turn);
    expect(loaded!.state.zones.library.length).toBe(snap.state.zones.library.length);
    expect(loaded!.autoAdvanceToMain).toBe(true);
    expect(loaded!.deck.length).toBe(d.length);
  });

  it('returns null on version mismatch', async () => {
    const d = deck(10);
    await saveSnapshot({
      version: SNAPSHOT_VERSION + 999,
      state: initGame(d, 1),
      deck: d,
      autoAdvanceToMain: false,
    });
    expect(await loadSnapshot()).toBeNull();
  });

  it('clearSnapshot removes the saved snapshot', async () => {
    const d = deck(10);
    await saveSnapshot({ version: SNAPSHOT_VERSION, state: initGame(d, 1), deck: d, autoAdvanceToMain: false });
    expect(await loadSnapshot()).not.toBeNull();
    await clearSnapshot();
    expect(await loadSnapshot()).toBeNull();
  });
});

describe('store.restoreGame', () => {
  it('restores the snapshot state with a clean undo history', () => {
    const d = deck(30);
    const snapshotState = initGame(d, 3);
    // create some undo history first to prove it is cleared on restore
    useGameStore.getState().newGame(deck(30), 9);
    useGameStore.getState().dispatch({ type: 'adjustLife', delta: -5 });
    expect(useGameStore.getState().canUndo).toBe(true);

    useGameStore.getState().restoreGame({
      version: SNAPSHOT_VERSION,
      state: snapshotState,
      deck: d,
      autoAdvanceToMain: true,
    });

    const s = useGameStore.getState();
    expect(s.state).toBe(snapshotState);
    expect(s.canUndo).toBe(false);
    expect(s.canRedo).toBe(false);
    expect(s.autoAdvanceToMain).toBe(true);
    expect(s.mulliganDecisionPending).toBe(false);

    // restart uses the restored deck (does not throw / re-deals from it)
    useGameStore.getState().restart();
    expect(useGameStore.getState().state).not.toBeNull();
  });
});
