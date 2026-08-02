/**
 * review.cr702-194-teamwork — CR 702.194 Teamwork cast transaction (store integration).
 *
 * REVIEWER-OWNED: implementers must NOT edit this file; fix the engine.
 *
 * CR grounding (pinned 2026-06-19):
 *   702.194a: optional additional cost — tap any number of creatures with
 *     total power N or more.
 *   702.194b: "using teamwork" = declared intention to pay the teamwork cost.
 *   601.2f-h: additional costs are paid as part of the cast transaction.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { makeDef } from '../../engine/__tests__/helpers';
import { useGameStore } from '../gameStore';

const store = () => useGameStore.getState();

function resetStore(): void {
  useGameStore.setState({
    state: null,
    warnings: [],
    triggerCandidates: [],
    pendingGuided: null,
    pendingCast: null,
    canUndo: false,
    canRedo: false,
    autoAdvanceToMain: true,
    mulliganDecisionPending: false,
  });
}

const teamworkDef = makeDef({
  scryfallId: 'tw-beast-mode',
  typeLine: 'Instant',
  faces: [{
    name: 'Beast Mode',
    typeLine: 'Instant',
    manaCost: '{1}{G}',
    oracleText:
      'Teamwork 1 (As an additional cost to cast this spell, you may tap any number of creatures you control with total power 1 or more.)\nTarget creature gets +2/+2 and gains trample until end of turn. Also put a +1/+1 counter on that creature if this spell was cast using teamwork.',
  }],
});

const creatureDef = makeDef({
  scryfallId: 'tw-bear',
  typeLine: 'Creature — Bear',
  faces: [{
    name: 'Grizzly Bears',
    typeLine: 'Creature — Bear',
    manaCost: '{1}{G}',
    power: '2',
    toughness: '2',
  }],
});

const vanillaDef = makeDef({
  scryfallId: 'tw-vanilla',
  typeLine: 'Instant',
  faces: [{
    name: 'Lightning Bolt',
    typeLine: 'Instant',
    manaCost: '{R}',
    oracleText: 'Lightning Bolt deals 3 damage to any target.',
  }],
});

function setupGame(): void {
  resetStore();
  const deck = [
    { def: teamworkDef, isCommander: false },
    { def: creatureDef, isCommander: false },
    { def: creatureDef, isCommander: false },
    { def: vanillaDef, isCommander: false },
  ];
  store().newGame(deck);
  store().beginFirstTurn();
}

function findCard(defId: string): string {
  const state = store().state!;
  const card = Object.values(state.cards).find((c) => c.defId === defId);
  if (!card) throw new Error(`no card for ${defId}`);
  return card.id;
}

function findAllCards(defId: string): string[] {
  const state = store().state!;
  return Object.values(state.cards)
    .filter((c) => c.defId === defId)
    .map((c) => c.id);
}

function moveToHand(cardId: string): void {
  store().moveCard(cardId, 'hand', 'bottom');
}

function moveToBattlefield(cardId: string): void {
  store().moveCard(cardId, 'battlefield', 'bottom');
}

function addMana(color: 'W' | 'U' | 'B' | 'R' | 'G' | 'C', amount: number): void {
  store().dispatch({ type: 'addMana', color, amount });
}

describe('review.cr702-194 — Teamwork store integration', () => {
  beforeEach(() => {
    setupGame();
  });

  it('R8: castToStack with Teamwork card sets pendingCast with cost-tap prompt', () => {
    const spellId = findCard('tw-beast-mode');
    moveToHand(spellId);
    addMana('G', 5);

    const result = store().castToStack(spellId, {});
    expect(result).toBe('needs-choice');

    const pending = store().pendingCast;
    expect(pending).not.toBeNull();
    expect(pending!.cardId).toBe(spellId);
    expect(pending!.teamworkThreshold).toBe(1);
    expect(pending!.prompts.length).toBeGreaterThanOrEqual(1);
    expect(pending!.prompts[0].kind).toBe('cost-tap');
  });

  it('R9: answerPendingCastTeamwork rejects insufficient power', () => {
    const spellId = findCard('tw-beast-mode');
    moveToHand(spellId);
    addMana('G', 5);
    store().castToStack(spellId, {});

    // No creatures on battlefield — selecting nothing is legal (decline),
    // but selecting a non-existent card should warn.
    store().answerPendingCastTeamwork(['nonexistent-id']);
    expect(store().warnings.length).toBeGreaterThan(0);
    // Prompt should still be present (not consumed).
    expect(store().pendingCast!.prompts[0].kind).toBe('cost-tap');
  });

  it('R10: answerPendingCastTeamwork accepts sufficient power and confirmPendingCast taps + records usingTeamwork', () => {
    const spellId = findCard('tw-beast-mode');
    const bears = findAllCards('tw-bear');
    moveToHand(spellId);
    moveToBattlefield(bears[0]);
    addMana('G', 5);

    store().castToStack(spellId, {});
    expect(store().pendingCast).not.toBeNull();

    // Select one bear (power 2 >= threshold 1).
    store().answerPendingCastTeamwork([bears[0]]);
    // Prompt consumed.
    expect(store().pendingCast!.prompts.length).toBe(0);
    expect(store().pendingCast!.teamworkTappedIds).toEqual([bears[0]]);

    store().confirmPendingCast();

    const state = store().state!;
    // Bear should be tapped.
    expect(state.cards[bears[0]].tapped).toBe(true);
    // Spell should be on stack with usingTeamwork.
    const stackedSpell = state.cards[spellId];
    expect(stackedSpell.zone).toBe('stack');
    expect(stackedSpell.usingTeamwork).toBe(true);
  });

  it('R11: declining teamwork (empty selection) casts without usingTeamwork', () => {
    const spellId = findCard('tw-beast-mode');
    moveToHand(spellId);
    addMana('G', 5);

    store().castToStack(spellId, {});
    store().answerPendingCastTeamwork([]);
    store().confirmPendingCast();

    const state = store().state!;
    const stackedSpell = state.cards[spellId];
    expect(stackedSpell.zone).toBe('stack');
    expect(stackedSpell.usingTeamwork).toBeUndefined();
  });

  it('R12: undo reverses both tap and cast atomically', () => {
    const spellId = findCard('tw-beast-mode');
    const bears = findAllCards('tw-bear');
    moveToHand(spellId);
    moveToBattlefield(bears[0]);
    addMana('G', 5);

    store().castToStack(spellId, {});
    store().answerPendingCastTeamwork([bears[0]]);
    store().confirmPendingCast();

    // Verify cast happened.
    expect(store().state!.cards[spellId].zone).toBe('stack');
    expect(store().state!.cards[bears[0]].tapped).toBe(true);

    store().undo();

    // Both should be reversed.
    const state = store().state!;
    expect(state.cards[spellId].zone).toBe('hand');
    expect(state.cards[bears[0]].tapped).toBe(false);
    expect(state.cards[spellId].usingTeamwork).toBeUndefined();
  });

  it('R13: non-teamwork card casts directly without pendingCast', () => {
    const boltId = findCard('tw-vanilla');
    moveToHand(boltId);
    addMana('R', 5);

    const result = store().castToStack(boltId, {});
    expect(result).toBe('ok');
    expect(store().pendingCast).toBeNull();
    expect(store().state!.cards[boltId].zone).toBe('stack');
  });

  it('R14: multiple creatures can be tapped for teamwork', () => {
    // Use a higher threshold scenario: both bears (power 2+2=4) for threshold 1.
    const spellId = findCard('tw-beast-mode');
    const bears = findAllCards('tw-bear');
    moveToHand(spellId);
    moveToBattlefield(bears[0]);
    moveToBattlefield(bears[1]);
    addMana('G', 5);

    store().castToStack(spellId, {});
    store().answerPendingCastTeamwork([bears[0], bears[1]]);
    store().confirmPendingCast();

    const state = store().state!;
    expect(state.cards[bears[0]].tapped).toBe(true);
    expect(state.cards[bears[1]].tapped).toBe(true);
    expect(state.cards[spellId].usingTeamwork).toBe(true);
  });
});
