// REVIEWER-OWNED store acceptance for engine-spec §34.53 / acceptance G9.
// Implementers must not edit this file; fix implementation when it fails.
// CR grounding: 101.3, 101.4, 608.2e-f, 701.9a-b, 701.21a.
import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import {
  DEFAULT_OPPONENT_ID,
  playerIdForLifeLabel,
  syncDerivedViews,
  type GameState,
  type PlayerId,
  type PrivateZoneId,
} from '../../engine/types';
import { useGameStore } from '../gameStore';

const store = () => useGameStore.getState();

function resetStore(): void {
  useGameStore.setState({
    state: null,
    warnings: [],
    triggerCandidates: [],
    pendingGuided: null,
    pendingCast: null,
    resolutionSession: null,
    pendingCommanderResolution: null,
    pendingForceActivation: null,
    canUndo: false,
    canRedo: false,
    canUndoInteraction: false,
    canRedoInteraction: false,
    autoAdvanceToMain: true,
    mulliganDecisionPending: false,
  });
  localStorage.clear();
}

function source(oracleText: string) {
  return makeDef({
    scryfallId: `review-cr701-source-${oracleText.length}`,
    name: 'CR701 Review Source',
    typeLine: 'Sorcery',
    faces: [{ name: 'CR701 Review Source', typeLine: 'Sorcery', oracleText }],
  });
}

function cardId(defId: string): string {
  const id = Object.values(store().state?.cards ?? {}).find((card) => card.defId === defId)?.id;
  if (!id) throw new Error(`missing card: ${defId}`);
  return id;
}

function state(): GameState {
  const current = store().state;
  if (!current) throw new Error('missing state');
  return current;
}

function assignPrivateCards(
  current: GameState,
  playerId: PlayerId,
  zone: PrivateZoneId,
  cardIds: readonly string[],
): GameState {
  const moved = new Set(cardIds);
  const zonesByPlayer = Object.fromEntries(
    current.turnOrder.map((id) => {
      const zones = current.zonesByPlayer[id];
      return [id, {
        library: zones.library.filter((cardId) => !moved.has(cardId)),
        hand: zones.hand.filter((cardId) => !moved.has(cardId)),
        graveyard: zones.graveyard.filter((cardId) => !moved.has(cardId)),
      }];
    }),
  );
  zonesByPlayer[playerId][zone].push(...cardIds);
  const cards = { ...current.cards };
  for (const id of cardIds) {
    cards[id] = {
      ...cards[id],
      zone,
      ownerId: playerId,
      controllerId: playerId,
    };
  }
  return syncDerivedViews({ ...current, cards, zonesByPlayer });
}

function setActivePlayer(playerId: PlayerId): void {
  useGameStore.setState({ state: { ...state(), activePlayerId: playerId } });
}

function createCreature(cardId: string, playerId: PlayerId, isToken: boolean): void {
  store().dispatch({
    type: 'createScenarioDummy',
    cardId,
    defId: `${cardId}-def`,
    playerId,
    name: cardId,
    typeLine: 'Creature',
    power: '2',
    toughness: '2',
    tapped: false,
    counters: {},
    keywords: [],
    isToken,
  });
}

function relevantEvents(ids: readonly string[], reason: 'discard' | 'sacrifice') {
  return state().eventLog.filter(
    (event) => event.type === 'zoneChange'
      && ids.includes(event.physicalCardId)
      && event.reason === reason,
  );
}

describe('review.cr701-cross-player-actions: APNAP discard', () => {
  beforeEach(resetStore);

  it('collects opponent then P1 choices without mutating GameState, then discards simultaneously with one undo', () => {
    const spell = source('Each player discards a card.');
    store().newGame([{ def: spell, isCommander: false }, ...makeDeck(16)], 9);
    const sourceId = cardId(spell.scryfallId);
    store().moveCard(sourceId, 'stack', 'bottom');
    const [p1Choice, opponentChoice] = state().zones.library.slice(0, 2);
    let seeded = assignPrivateCards(state(), 'P1', 'hand', [p1Choice]);
    seeded = assignPrivateCards(seeded, DEFAULT_OPPONENT_ID, 'hand', [opponentChoice]);
    useGameStore.setState({ state: seeded });
    setActivePlayer(DEFAULT_OPPONENT_ID);

    store().resolveTop();
    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      atom: 'effect.discard', kind: 'discard', playerId: DEFAULT_OPPONENT_ID,
    });
    expect(store().pendingGuided?.prompts[0]?.simultaneousGroupId).toBeTruthy();
    const beforeChoices = JSON.stringify(state());
    store().confirmGuidedDiscard(opponentChoice);
    expect(JSON.stringify(state())).toBe(beforeChoices);
    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      atom: 'effect.discard', kind: 'discard', playerId: 'P1',
    });
    store().confirmGuidedDiscard(p1Choice);

    expect(store().pendingGuided).toBeNull();
    expect(state().cards[p1Choice].zone).toBe('graveyard');
    expect(state().cards[opponentChoice].zone).toBe('graveyard');
    expect(state().cards[sourceId].zone).toBe('graveyard');
    const events = relevantEvents([p1Choice, opponentChoice], 'discard');
    expect(events).toHaveLength(2);
    expect(events.every((event) => Boolean(event.simultaneousGroupId))).toBe(true);
    expect(new Set(events.map((event) => event.simultaneousGroupId)).size).toBe(1);

    store().undo();
    expect(state().cards[p1Choice].zone).toBe('hand');
    expect(state().cards[opponentChoice].zone).toBe('hand');
    expect(state().cards[sourceId].zone).toBe('stack');
    store().redo();
    expect(state().cards[p1Choice].zone).toBe('graveyard');
    expect(state().cards[opponentChoice].zone).toBe('graveyard');
  });

  it('expands a roster-independent each-opponent prompt across a wrapped four-player APNAP order', () => {
    const spell = source('Each opponent discards a card.');
    store().newGame([{ def: spell, isCommander: false }, ...makeDeck(20)], 11);
    store().dispatch({ type: 'adjustOpponentLife', label: 'Bob', delta: 0 });
    store().dispatch({ type: 'adjustOpponentLife', label: 'Carol', delta: 0 });
    const bobId = playerIdForLifeLabel('Bob');
    const carolId = playerIdForLifeLabel('Carol');
    const sourceId = cardId(spell.scryfallId);
    store().moveCard(sourceId, 'stack', 'bottom');
    const choices = state().zonesByPlayer.P1.library.slice(0, 3);
    let seeded = assignPrivateCards(state(), bobId, 'hand', [choices[0]]);
    seeded = assignPrivateCards(seeded, carolId, 'hand', [choices[1]]);
    seeded = assignPrivateCards(seeded, DEFAULT_OPPONENT_ID, 'hand', [choices[2]]);
    useGameStore.setState({ state: seeded });
    setActivePlayer(bobId);

    store().resolveTop();
    const beforeChoices = JSON.stringify(state());
    for (const [expectedPlayerId, choice] of [
      [bobId, choices[0]],
      [carolId, choices[1]],
      [DEFAULT_OPPONENT_ID, choices[2]],
    ] as const) {
      expect(store().pendingGuided?.prompts[0]?.playerId).toBe(expectedPlayerId);
      store().confirmGuidedDiscard(choice);
      if (store().pendingGuided) expect(JSON.stringify(state())).toBe(beforeChoices);
    }

    expect(store().pendingGuided).toBeNull();
    expect(choices.every((id) => state().cards[id].zone === 'graveyard')).toBe(true);
    const events = relevantEvents(choices, 'discard');
    expect(events).toHaveLength(3);
    expect(new Set(events.map((event) => event.simultaneousGroupId)).size).toBe(1);
  });
});

describe('review.cr701-cross-player-actions: APNAP multi-sacrifice', () => {
  beforeEach(resetStore);

  it('collects two nontoken creatures per player, excludes tokens, and applies all sacrifices simultaneously', () => {
    const spell = source('Each player sacrifices two nontoken creatures of their choice.');
    store().newGame([{ def: spell, isCommander: false }, ...makeDeck(10)], 13);
    const sourceId = cardId(spell.scryfallId);
    for (const [id, playerId, isToken] of [
      ['p1-a', 'P1', false],
      ['p1-b', 'P1', false],
      ['p1-token', 'P1', true],
      ['opp-a', DEFAULT_OPPONENT_ID, false],
      ['opp-b', DEFAULT_OPPONENT_ID, false],
      ['opp-token', DEFAULT_OPPONENT_ID, true],
    ] as const) {
      createCreature(id, playerId, isToken);
    }
    store().moveCard(sourceId, 'stack', 'bottom');
    setActivePlayer(DEFAULT_OPPONENT_ID);

    store().resolveTop();
    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      atom: 'effect.sacrifice', kind: 'sacrifice', count: 2,
      playerId: DEFAULT_OPPONENT_ID,
      filter: { excludeTokens: true },
    });
    store().confirmGuidedSacrifice('opp-a');
    expect(state().cards['opp-a'].zone).toBe('battlefield');
    expect(store().pendingGuided?.prompts[0]?.playerId).toBe(DEFAULT_OPPONENT_ID);
    store().confirmGuidedSacrifice('opp-b');
    expect(store().pendingGuided?.prompts[0]?.playerId).toBe('P1');
    store().confirmGuidedSacrifice('p1-a');
    expect(state().cards['p1-a'].zone).toBe('battlefield');
    expect(store().pendingGuided?.prompts[0]?.playerId).toBe('P1');
    store().confirmGuidedSacrifice('p1-b');

    const sacrificed = ['p1-a', 'p1-b', 'opp-a', 'opp-b'];
    for (const id of sacrificed) expect(state().cards[id].zone).toBe('graveyard');
    expect(state().cards['p1-token'].zone).toBe('battlefield');
    expect(state().cards['opp-token'].zone).toBe('battlefield');
    expect(state().cards[sourceId].zone).toBe('graveyard');
    const events = relevantEvents(sacrificed, 'sacrifice');
    expect(events).toHaveLength(4);
    expect(events.every((event) => Boolean(event.simultaneousGroupId))).toBe(true);
    expect(new Set(events.map((event) => event.simultaneousGroupId)).size).toBe(1);
  });

  it('advances after the affected player has fewer legal permanents than the written count', () => {
    const spell = source('Each opponent sacrifices two creatures of their choice.');
    store().newGame([{ def: spell, isCommander: false }, ...makeDeck(10)], 14);
    const sourceId = cardId(spell.scryfallId);
    createCreature('only-opponent-creature', DEFAULT_OPPONENT_ID, false);
    store().moveCard(sourceId, 'stack', 'bottom');

    store().resolveTop();
    expect(store().pendingGuided?.prompts[0]?.playerId).toBe(DEFAULT_OPPONENT_ID);
    store().confirmGuidedSacrifice('only-opponent-creature');
    expect(store().pendingGuided).toBeNull();
    expect(state().cards['only-opponent-creature'].zone).toBe('graveyard');
    expect(state().cards[sourceId].zone).toBe('graveyard');
  });
});
