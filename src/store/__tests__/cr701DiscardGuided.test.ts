import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import {
  DEFAULT_OPPONENT_ID,
  syncDerivedViews,
  type GameState,
  type PlayerId,
} from '../../engine/types';
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

function assignHand(
  current: GameState,
  playerId: PlayerId,
  cardIds: readonly string[],
): GameState {
  const moved = new Set(cardIds);
  const zonesByPlayer = Object.fromEntries(current.turnOrder.map((id) => [id, {
    library: current.zonesByPlayer[id].library.filter((cardId) => !moved.has(cardId)),
    hand: current.zonesByPlayer[id].hand.filter((cardId) => !moved.has(cardId)),
    graveyard: current.zonesByPlayer[id].graveyard.filter((cardId) => !moved.has(cardId)),
  }]));
  zonesByPlayer[playerId].hand.push(...cardIds);
  const cards = { ...current.cards };
  for (const id of cardIds) {
    cards[id] = { ...cards[id], zone: 'hand', ownerId: playerId, controllerId: playerId };
  }
  return syncDerivedViews({ ...current, cards, zonesByPlayer });
}

describe('CR 701.9 guided discard resolution', () => {
  beforeEach(() => {
    resetStore();
  });

  it('prompts for a hand card and resolves the stack item through discard command', () => {
    const spell = makeDef({
      scryfallId: 'cr701-discard-spell',
      typeLine: 'Sorcery',
      faces: [
        {
          name: 'cr701-discard-spell',
          typeLine: 'Sorcery',
          oracleText: 'Discard a card.',
        },
      ],
    });

    store().newGame([{ def: spell, isCommander: false }, ...makeDeck(12)], 1);
    const sourceId = findInstanceId('cr701-discard-spell');
    store().moveCard(sourceId, 'stack', 'bottom');
    const discardId = store().state?.zones.hand.find((cardId) => cardId !== sourceId);
    if (!discardId) {
      throw new Error('discard fixture did not leave a spare hand card');
    }

    store().resolveTop();

    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      atom: 'effect.discard',
      kind: 'discard',
      count: 1,
    });

    store().confirmGuidedDiscard(discardId);

    const state = store().state;
    expect(store().pendingGuided).toBeNull();
    expect(state?.cards[discardId].zone).toBe('graveyard');
    expect(state?.cards[sourceId].zone).toBe('graveyard');
    expect(state?.zones.stack).not.toContain(sourceId);
  });

  it('collects a capped multi-card opponent choice without mutating state, then groups discard events', () => {
    const spell = makeDef({
      scryfallId: 'cr701-cross-player-discard-spell',
      typeLine: 'Sorcery',
      faces: [{
        name: 'cr701-cross-player-discard-spell',
        typeLine: 'Sorcery',
        oracleText: 'Each opponent discards three cards.',
      }],
    });
    store().newGame([{ def: spell, isCommander: false }, ...makeDeck(14)], 31);
    const sourceId = findInstanceId(spell.scryfallId);
    store().moveCard(sourceId, 'stack', 'bottom');
    const current = store().state;
    if (!current) throw new Error('missing state');
    const choices = current.zonesByPlayer.P1.library.slice(0, 2);
    useGameStore.setState({ state: assignHand(current, DEFAULT_OPPONENT_ID, choices) });

    store().resolveTop();
    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      playerId: DEFAULT_OPPONENT_ID,
      count: 2,
    });
    const before = JSON.stringify(store().state);
    store().confirmGuidedDiscard(choices[0]);
    expect(JSON.stringify(store().state)).toBe(before);
    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      playerId: DEFAULT_OPPONENT_ID,
      count: 1,
    });
    store().confirmGuidedDiscard(choices[1]);

    expect(store().pendingGuided).toBeNull();
    const events = store().state?.eventLog.filter(
      (event) => event.type === 'zoneChange'
        && choices.includes(event.physicalCardId)
        && event.reason === 'discard',
    ) ?? [];
    expect(events).toHaveLength(2);
    expect(new Set(events.map((event) => event.simultaneousGroupId)).size).toBe(1);
    expect(events[0]?.simultaneousGroupId).toBeTruthy();
  });
});
