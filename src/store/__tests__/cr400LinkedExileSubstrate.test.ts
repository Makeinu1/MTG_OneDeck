import { beforeEach, describe, expect, it } from 'vitest';

import { SNAPSHOT_VERSION, type GameSnapshot } from '../../data/gameSnapshot';
import { makeDef } from '../../engine/__tests__/helpers';
import { objectIdOf, type GameState } from '../../engine/types';
import { useGameStore } from '../gameStore';

const store = () => useGameStore.getState();

function resetStore(): void {
  useGameStore.setState({
    state: null,
    warnings: [],
    triggerCandidates: [],
    pendingGuided: null,
    canUndo: false,
    canRedo: false,
    autoAdvanceToMain: true,
    mulliganDecisionPending: false,
  });
}

function findInstanceId(defId: string): string {
  const card = Object.values(store().state?.cards ?? {}).find(
    (instance) => instance.defId === defId,
  );
  if (!card) {
    throw new Error(`card instance not found for ${defId}`);
  }
  return card.id;
}

describe('CR 400/406/607 linked exile store integration', () => {
  beforeEach(() => {
    resetStore();
  });

  it('restoreGame backfills legacy snapshots without linkedExiles', () => {
    const card = makeDef({ scryfallId: 'legacy-card' });
    store().newGame([{ def: card, isCommander: false }], 1);
    const deck = [{ def: card, isCommander: false }];
    const legacyState = { ...store().state! } as Partial<GameState>;
    delete legacyState.linkedExiles;
    const snapshot: GameSnapshot = {
      version: SNAPSHOT_VERSION,
      state: legacyState as GameState,
      deck,
      autoAdvanceToMain: true,
    };

    expect(() => store().restoreGame(snapshot)).not.toThrow();
    expect(store().state!.linkedExiles).toEqual({});
  });

  it('resolves Thassa-style same-resolution temporary return and consumes the record', () => {
    const thassa = makeDef({
      scryfallId: 'test-thassa',
      typeLine: 'Legendary Enchantment Creature',
      faces: [
        {
          name: 'test-thassa',
          typeLine: 'Legendary Enchantment Creature',
          oracleText:
            "At the beginning of your end step, exile up to one target creature you control, then return that card to the battlefield under its owner's control.",
        },
      ],
    });
    const target = makeDef({ scryfallId: 'blink-target', typeLine: 'Creature' });
    store().newGame(
      [
        { def: thassa, isCommander: false },
        { def: target, isCommander: false },
      ],
      1,
    );
    const sourceId = findInstanceId('test-thassa');
    const targetId = findInstanceId('blink-target');
    store().moveCard(sourceId, 'battlefield', 'bottom');
    store().moveCard(targetId, 'battlefield', 'bottom');
    const beforeObjectId = objectIdOf(store().state!.cards[targetId]);

    store().addAbilityToStack(sourceId, 'triggered');
    store().resolveTop();
    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      kind: 'target',
      linkedExile: { purpose: 'temporary-return' },
    });

    store().confirmGuidedTarget(targetId);

    const state = store().state!;
    expect(store().pendingGuided).toBeNull();
    expect(state.cards[targetId].zone).toBe('battlefield');
    expect(objectIdOf(state.cards[targetId])).not.toBe(beforeObjectId);
    expect(state.linkedExiles).toEqual({});
    expect(
      state.eventLog
        .filter((event) => event.type === 'zoneChange' && event.physicalCardId === targetId)
        .slice(-2)
        .map((event) => (event.type === 'zoneChange' ? event.toZone : null)),
    ).toEqual(['exile', 'battlefield']);
  });

  it('exiled-with-source consume rejects the same physical source after a zone change', () => {
    const source = makeDef({ scryfallId: 'test-exiler', typeLine: 'Creature' });
    const target = makeDef({ scryfallId: 'test-target', typeLine: 'Creature' });
    store().newGame(
      [
        { def: source, isCommander: false },
        { def: target, isCommander: false },
      ],
      1,
    );
    const sourceId = findInstanceId('test-exiler');
    const targetId = findInstanceId('test-target');
    store().moveCard(sourceId, 'battlefield', 'bottom');
    store().moveCard(targetId, 'battlefield', 'bottom');
    const sourceObjectId = objectIdOf(store().state!.cards[sourceId]);

    store().dispatch({
      type: 'moveCard',
      cardId: targetId,
      to: 'exile',
      position: 'bottom',
      reason: 'resolve',
      linkedExileWrite: {
        linkId: 'exiled-with-source-test',
        purpose: 'exiled-with-source',
        sourceObjectId,
        sourcePhysicalId: sourceId,
      },
    });
    expect(store().state!.linkedExiles['exiled-with-source-test']).toBeDefined();

    store().moveCard(sourceId, 'graveyard', 'bottom');
    store().consumeLinkedExileForSource('exiled-with-source-test', sourceId);
    expect(store().state!.linkedExiles['exiled-with-source-test']).toBeDefined();
    expect(store().warnings.at(-1)).toContain('source object');
  });

  it('guided Path to Exile style simple exile does not write linkedExiles', () => {
    const path = makeDef({
      scryfallId: 'test-path',
      typeLine: 'Instant',
      faces: [
        {
          name: 'test-path',
          typeLine: 'Instant',
          oracleText: 'Exile target creature.',
        },
      ],
    });
    const target = makeDef({ scryfallId: 'path-target', typeLine: 'Creature' });
    store().newGame(
      [
        { def: path, isCommander: false },
        { def: target, isCommander: false },
      ],
      1,
    );
    const spellId = findInstanceId('test-path');
    const targetId = findInstanceId('path-target');
    store().moveCard(spellId, 'stack', 'bottom');
    store().moveCard(targetId, 'battlefield', 'bottom');

    store().resolveTop();
    store().confirmGuidedTarget(targetId);

    expect(store().state!.cards[targetId].zone).toBe('exile');
    expect(store().state!.linkedExiles).toEqual({});
  });
});
