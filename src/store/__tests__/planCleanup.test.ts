import { beforeEach, describe, expect, it } from 'vitest';

import { SNAPSHOT_VERSION, type GameSnapshot } from '../../data/gameSnapshot';
import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import { effectiveMaximumHandSize } from '../../engine/handSize';
import type { CleanupDiscardRuleChoice, GameState } from '../../engine/types';
import { useGameStore } from '../gameStore';

function store() {
  return useGameStore.getState();
}

function state(): GameState {
  const current = store().state;
  if (!current) throw new Error('game state unavailable');
  return current;
}

function reset(): void {
  useGameStore.setState({
    state: null,
    warnings: [],
    triggerCandidates: [],
    pendingGuided: null,
    canUndo: false,
    canRedo: false,
    autoAdvanceToMain: false,
    mulliganDecisionPending: false,
  });
}

function start(count = 24): void {
  store().newGame(makeDeck(count), 17);
}

function setHandSize(count: number): void {
  const current = state();
  const allPrivate = [
    ...current.zones.hand,
    ...current.zones.library,
    ...current.zones.graveyard,
  ];
  for (const cardId of allPrivate.slice(0, count)) store().moveCard(cardId, 'hand', 'bottom');
  for (const cardId of state().zones.hand.slice(count)) store().moveCard(cardId, 'library', 'bottom');
}

function enterEnd(): void {
  useGameStore.setState({ state: { ...state(), phase: 'end' } });
}

function cleanupChoice(): CleanupDiscardRuleChoice {
  const choice = state().pendingRuleChoices.find(
    (candidate): candidate is CleanupDiscardRuleChoice => candidate.kind === 'cleanup-discard',
  );
  if (!choice) throw new Error('cleanup choice missing');
  return choice;
}

describe('CR 514 cleanup substrate', () => {
  beforeEach(reset);

  it('skips UI at seven cards and asks for the exact excess at eight or more', () => {
    start();
    setHandSize(7);
    enterEnd();
    store().nextPhase();
    expect(state()).toMatchObject({ turn: 2, phase: 'untap', pendingRuleChoices: [] });

    store().undo();
    setHandSize(8);
    enterEnd();
    store().nextPhase();
    expect(state().phase).toBe('cleanup');
    expect(cleanupChoice()).toMatchObject({ ruleRef: '514.1', requiredCount: 1 });

    store().resolveRuleChoice(cleanupChoice().choiceId, {
      kind: 'cleanup-discard',
      cardIds: [],
    });
    expect(cleanupChoice()).toMatchObject({ requiredCount: 1 });
    expect(store().warnings.at(-1)).toContain('ちょうど1枚');

    const cardId = state().zones.hand[0];
    store().resolveRuleChoice(cleanupChoice().choiceId, {
      kind: 'cleanup-discard',
      cardIds: [cardId],
    });
    expect(state()).toMatchObject({ turn: 2, phase: 'untap', pendingRuleChoices: [] });
    expect(state().zones.hand).toHaveLength(7);
    expect(state().zones.graveyard).toContain(cardId);

    store().undo();
    expect(state().phase).toBe('cleanup');
    expect(state().zones.hand).toHaveLength(8);
    expect(cleanupChoice().requiredCount).toBe(1);
  });

  it('handles multiple excess cards and the warning-only manual escape', () => {
    start();
    setHandSize(10);
    enterEnd();
    store().nextPhase();
    const choice = cleanupChoice();
    expect(choice.requiredCount).toBe(3);
    store().resolveRuleChoice(choice.choiceId, {
      kind: 'cleanup-discard',
      cardIds: [],
      manualHandled: true,
    });
    expect(state()).toMatchObject({ turn: 2, phase: 'untap' });
    expect(store().warnings.some((warning) => warning.includes('手動処理済み'))).toBe(true);
  });

  it('recognizes no maximum hand size and prioritizes the manual override', () => {
    const vessel = makeDef({
      scryfallId: 'cleanup-thought-vessel',
      typeLine: 'Artifact',
      faces: [{
        name: 'Thought Vessel',
        typeLine: 'Artifact',
        oracleText: 'You have no maximum hand size.\n{T}: Add {C}.',
      }],
    });
    store().newGame([{ def: vessel, isCommander: false }, ...makeDeck(23)], 18);
    const vesselId = Object.values(state().cards).find((card) => card.defId === vessel.scryfallId)?.id;
    if (!vesselId) throw new Error('vessel missing');
    store().moveCard(vesselId, 'battlefield');
    setHandSize(10);
    expect(effectiveMaximumHandSize(state(), 'P1')).toBeNull();
    enterEnd();
    store().nextPhase();
    expect(state()).toMatchObject({ turn: 2, phase: 'untap' });

    store().dispatch({ type: 'setMaximumHandSizeOverride', value: 5 });
    useGameStore.setState({ state: { ...state(), phase: 'end' } });
    store().nextPhase();
    expect(cleanupChoice().requiredCount).toBe(5);
    store().undo();
    store().undo();
    expect(effectiveMaximumHandSize(state(), 'P1')).toBeNull();
  });

  it('grants priority for discard triggers and repeats cleanup after the trigger draws', () => {
    const watcher = makeDef({
      scryfallId: 'cleanup-discard-watcher',
      typeLine: 'Creature',
      faces: [{
        name: 'Cleanup Watcher',
        typeLine: 'Creature',
        oracleText: 'Whenever you discard a card, draw a card.',
        power: '3',
        toughness: '3',
      }],
    });
    store().newGame([{ def: watcher, isCommander: false }, ...makeDeck(23)], 19);
    const watcherId = Object.values(state().cards).find((card) => card.defId === watcher.scryfallId)?.id;
    if (!watcherId) throw new Error('watcher missing');
    store().moveCard(watcherId, 'battlefield');
    store().dispatch({ type: 'markDamage', cardId: watcherId, amount: 1 });
    setHandSize(8);
    enterEnd();
    store().nextPhase();
    expect(state().cards[watcherId].damageMarked).toBe(1);
    const discardId = state().zones.hand[0];
    store().resolveRuleChoice(cleanupChoice().choiceId, {
      kind: 'cleanup-discard', cardIds: [discardId],
    });
    expect(state().phase).toBe('cleanup');
    expect(state().cards[watcherId].damageMarked).toBe(0);
    const pending = state().pendingTriggers.find((trigger) => trigger.sourceId === watcherId);
    expect(pending?.triggerId).toBe('trigger.discard');

    store().putPendingTriggerOnStack(pending?.pendingTriggerId ?? 'missing');
    store().resolveTop();
    expect(state().phase).toBe('cleanup');
    expect(state().zones.hand).toHaveLength(8);
    expect(cleanupChoice().requiredCount).toBe(1);
  });

  it('removes marked damage in cleanup and restores old snapshots without an override', () => {
    const creature = makeDef({
      scryfallId: 'cleanup-damaged-creature',
      typeLine: 'Creature',
      faces: [{ name: 'Damaged Creature', typeLine: 'Creature', power: '3', toughness: '3' }],
    });
    const deck = [{ def: creature, isCommander: false }, ...makeDeck(23)];
    store().newGame(deck, 20);
    const creatureId = Object.values(state().cards).find((card) => card.defId === creature.scryfallId)?.id;
    if (!creatureId) throw new Error('creature missing');
    store().moveCard(creatureId, 'battlefield');
    store().dispatch({ type: 'markDamage', cardId: creatureId, amount: 2 });
    setHandSize(7);
    enterEnd();
    store().nextPhase();
    expect(state().cards[creatureId].damageMarked).toBe(0);

    const legacyState = structuredClone(state());
    delete legacyState.players.P1?.maximumHandSizeOverride;
    const snapshot: GameSnapshot = {
      version: SNAPSHOT_VERSION,
      state: legacyState,
      deck,
      autoAdvanceToMain: false,
    };
    expect(() => store().restoreGame(snapshot)).not.toThrow();
    expect(state().players.P1?.maximumHandSizeOverride).toBeUndefined();
    expect(effectiveMaximumHandSize(state(), 'P1')).toBe(7);
  });
});
