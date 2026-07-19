// Reviewer-owned adversarial tests for the cleanup step + hand-size limit
// (CR 402.2 / 514.1 / 514.2 / 514.3a). engine-spec §34.50.
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// These pin the *contract*, not the implementer's happy paths: exact-count discard
// enforcement, that turn-based cleanup state actions do NOT run while a discard is
// still owed, override precedence, re-cleanup after a resolution-time draw, forward
// compatibility of old snapshots, and undo.
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

describe('cleanup step + hand-size limit (CR 402.2/514)', () => {
  beforeEach(reset);

  it('rejects discarding MORE than the required excess and leaves the choice pending', () => {
    store().newGame(makeDeck(30), 31);
    setHandSize(8);
    enterEnd();
    store().nextPhase();
    expect(cleanupChoice().requiredCount).toBe(1);
    const twoCards = state().zones.hand.slice(0, 2);
    store().resolveRuleChoice(cleanupChoice().choiceId, { kind: 'cleanup-discard', cardIds: twoCards });
    // Over-discard must be refused: still in cleanup, still owes exactly 1, nothing moved.
    expect(state().phase).toBe('cleanup');
    expect(cleanupChoice().requiredCount).toBe(1);
    expect(state().zones.hand).toHaveLength(8);
    expect(store().warnings.at(-1)).toContain('ちょうど1枚');
  });

  it('rejects a card that is not in hand', () => {
    store().newGame(makeDeck(30), 32);
    setHandSize(8);
    enterEnd();
    store().nextPhase();
    const foreign = state().zones.library[0];
    store().resolveRuleChoice(cleanupChoice().choiceId, { kind: 'cleanup-discard', cardIds: [foreign] });
    expect(state().phase).toBe('cleanup');
    expect(state().zones.hand).toHaveLength(8);
    expect(store().warnings.at(-1)).toContain('現在の手札以外');
  });

  it('does NOT run cleanup turn-based actions (514.2 damage removal) while a discard is still owed', () => {
    const creature = makeDef({
      scryfallId: 'cleanup-damage-hold',
      typeLine: 'Creature',
      faces: [{ name: 'Damage Hold', typeLine: 'Creature', power: '4', toughness: '4' }],
    });
    store().newGame([{ def: creature, isCommander: false }, ...makeDeck(29)], 33);
    const creatureId = Object.values(state().cards).find((c) => c.defId === creature.scryfallId)!.id;
    store().moveCard(creatureId, 'battlefield');
    store().dispatch({ type: 'markDamage', cardId: creatureId, amount: 3 });
    setHandSize(9);
    enterEnd();
    store().nextPhase();
    // Halted in cleanup owing 2: damage must still be marked (514.2 has not fired yet).
    expect(state().phase).toBe('cleanup');
    expect(cleanupChoice().requiredCount).toBe(2);
    expect(state().cards[creatureId].damageMarked).toBe(3);

    const discards = state().zones.hand.slice(0, 2);
    store().resolveRuleChoice(cleanupChoice().choiceId, { kind: 'cleanup-discard', cardIds: discards });
    // Now the state actions run and the turn advances.
    expect(state()).toMatchObject({ turn: 2, phase: 'untap' });
    expect(state().cards[creatureId].damageMarked).toBe(0);
  });

  it('treats override "none" as no maximum even with no permanent granting it', () => {
    store().newGame(makeDeck(30), 34);
    store().dispatch({ type: 'setMaximumHandSizeOverride', value: 'none' });
    expect(effectiveMaximumHandSize(state(), 'P1')).toBeNull();
    setHandSize(10);
    enterEnd();
    store().nextPhase();
    expect(state()).toMatchObject({ turn: 2, phase: 'untap', pendingRuleChoices: [] });
  });

  it('lets a numeric override WIN over a permanent that grants no maximum hand size', () => {
    const vessel = makeDef({
      scryfallId: 'cleanup-vessel',
      typeLine: 'Artifact',
      faces: [{ name: 'Vessel', typeLine: 'Artifact', oracleText: 'You have no maximum hand size.\n{T}: Add {C}.' }],
    });
    store().newGame([{ def: vessel, isCommander: false }, ...makeDeck(29)], 35);
    const vesselId = Object.values(state().cards).find((c) => c.defId === vessel.scryfallId)!.id;
    store().moveCard(vesselId, 'battlefield');
    expect(effectiveMaximumHandSize(state(), 'P1')).toBeNull();
    store().dispatch({ type: 'setMaximumHandSizeOverride', value: 4 });
    expect(effectiveMaximumHandSize(state(), 'P1')).toBe(4);
    setHandSize(7);
    enterEnd();
    store().nextPhase();
    expect(cleanupChoice().requiredCount).toBe(3);
  });

  it('starts a fresh cleanup discard after a resolution-time draw pushes the hand back over the limit (514.3a)', () => {
    const looter = makeDef({
      scryfallId: 'cleanup-draw-on-discard',
      typeLine: 'Creature',
      faces: [{
        name: 'Draw On Discard',
        typeLine: 'Creature',
        oracleText: 'Whenever you discard a card, draw a card.',
        power: '2',
        toughness: '2',
      }],
    });
    store().newGame([{ def: looter, isCommander: false }, ...makeDeck(29)], 36);
    const looterId = Object.values(state().cards).find((c) => c.defId === looter.scryfallId)!.id;
    store().moveCard(looterId, 'battlefield');
    setHandSize(8);
    enterEnd();
    store().nextPhase();
    const firstDiscard = state().zones.hand[0];
    store().resolveRuleChoice(cleanupChoice().choiceId, { kind: 'cleanup-discard', cardIds: [firstDiscard] });
    // Discard trigger fires; resolving it draws a card, so we are still in cleanup owing 1.
    expect(state().phase).toBe('cleanup');
    const pending = state().pendingTriggers.find((trigger) => trigger.sourceId === looterId);
    expect(pending?.triggerId).toBe('trigger.discard');
    store().putPendingTriggerOnStack(pending!.pendingTriggerId);
    store().resolveTop();
    expect(state().phase).toBe('cleanup');
    expect(state().zones.hand).toHaveLength(8);
    expect(cleanupChoice().requiredCount).toBe(1);
  });

  it('restores an old snapshot with no override field and defaults to 7; discard-then-advance undoes cleanly', () => {
    const deck = makeDeck(30);
    store().newGame(deck, 37);
    setHandSize(8);
    enterEnd();
    store().nextPhase();
    const discardId = state().zones.hand[0];
    store().resolveRuleChoice(cleanupChoice().choiceId, { kind: 'cleanup-discard', cardIds: [discardId] });
    expect(state()).toMatchObject({ turn: 2, phase: 'untap' });
    expect(state().zones.graveyard).toContain(discardId);

    store().undo();
    expect(state().phase).toBe('cleanup');
    expect(state().zones.hand).toContain(discardId);

    const legacy = structuredClone(state());
    delete legacy.players.P1?.maximumHandSizeOverride;
    const snapshot: GameSnapshot = { version: SNAPSHOT_VERSION, state: legacy, deck, autoAdvanceToMain: false };
    expect(() => store().restoreGame(snapshot)).not.toThrow();
    expect(state().players.P1?.maximumHandSizeOverride).toBeUndefined();
    expect(effectiveMaximumHandSize(state(), 'P1')).toBe(7);
  });

  it('lets the manual escape advance the turn without discarding (sandbox 強行) and warns', () => {
    store().newGame(makeDeck(30), 38);
    setHandSize(9);
    enterEnd();
    store().nextPhase();
    expect(cleanupChoice().requiredCount).toBe(2);
    store().resolveRuleChoice(cleanupChoice().choiceId, {
      kind: 'cleanup-discard',
      cardIds: [],
      manualHandled: true,
    });
    expect(state()).toMatchObject({ turn: 2, phase: 'untap' });
    expect(state().zones.hand).toHaveLength(9);
    expect(store().warnings.some((warning) => warning.includes('手動処理済み'))).toBe(true);
  });
});
