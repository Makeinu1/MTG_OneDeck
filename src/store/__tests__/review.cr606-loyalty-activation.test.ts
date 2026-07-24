import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import { useGameStore } from '../gameStore';

/**
 * Review pins (judge-owned) for cr-606-loyalty-activation.
 *
 * Contract under test:
 *   CR 606.2 — loyalty ability = activated ability with loyalty symbol cost
 *   CR 606.3 — once per turn per permanent, sorcery speed
 *   CR 606.4 — cost = add/remove loyalty counters
 *   CR 606.6 — negative cost requires sufficient loyalty
 *
 * These assertions are behavioral (public store API + zone outcomes) so they
 * bind the contract, not an implementation's internal field names.
 */

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

function planeswalkerDef(
  scryfallId: string,
  loyalty: string,
  abilities: string[],
) {
  return makeDef({
    scryfallId,
    typeLine: 'Legendary Planeswalker — Test',
    faces: [{
      name: scryfallId,
      typeLine: 'Legendary Planeswalker — Test',
      loyalty,
      oracleText: abilities.join('\n'),
    }],
  });
}

function gameWithPlaneswalker(
  scryfallId: string,
  loyalty: string,
  abilities: string[],
) {
  const def = planeswalkerDef(scryfallId, loyalty, abilities);
  store().newGame([{ def, isCommander: false }, ...makeDeck(24)], 42);
  const state = store().state!;
  const pwId = Object.values(state.cards).find(
    (c) => c.defId === scryfallId,
  )?.id;
  if (!pwId) throw new Error(`planeswalker not found: ${scryfallId}`);
  store().moveCard(pwId, 'battlefield', 'bottom');
  return pwId;
}

describe('review.cr606-loyalty-activation: loyalty cost payment (CR 606.4)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('+1 ability adds a loyalty counter on activation', () => {
    const pwId = gameWithPlaneswalker('pw-plus', '3', [
      '+1: Draw a card.',
    ]);
    const state = store().state!;
    expect(state.cards[pwId].counters.loyalty).toBe(3);

    store().activateAbility(pwId, 0);

    // Loyalty cost paid: 3 + 1 = 4
    expect(store().state!.cards[pwId].counters.loyalty).toBe(4);
    // Ability on the stack
    expect(store().state!.zones.stack.length).toBeGreaterThan(0);
  });

  it('-2 ability removes loyalty counters on activation', () => {
    const pwId = gameWithPlaneswalker('pw-minus', '4', [
      '-2: You gain 2 life.',
    ]);
    const state = store().state!;
    expect(state.cards[pwId].counters.loyalty).toBe(4);

    store().activateAbility(pwId, 0);

    // Loyalty cost paid: 4 - 2 = 2
    expect(store().state!.cards[pwId].counters.loyalty).toBe(2);
  });

  it('-7 ultimate removes loyalty counters on activation', () => {
    const pwId = gameWithPlaneswalker('pw-ult', '7', [
      '-7: You gain 7 life.',
    ]);
    const state = store().state!;
    expect(state.cards[pwId].counters.loyalty).toBe(7);

    store().activateAbility(pwId, 0);

    // Loyalty cost paid: 7 - 7 = 0 (counter key removed at zero)
    expect(store().state!.cards[pwId].counters.loyalty ?? 0).toBe(0);
  });
});

describe('review.cr606-loyalty-activation: insufficient loyalty (CR 606.6)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('blocks activation when loyalty is insufficient for negative cost', () => {
    const pwId = gameWithPlaneswalker('pw-insufficient', '1', [
      '-2: You gain 2 life.',
    ]);
    const state = store().state!;
    expect(state.cards[pwId].counters.loyalty).toBe(1);

    store().activateAbility(pwId, 0);

    // Should be blocked: 1 < 2
    expect(store().state!.cards[pwId].counters.loyalty).toBe(1);
    // Warning issued
    expect(store().warnings.length).toBeGreaterThan(0);
  });

  it('allows activation when loyalty exactly equals negative cost', () => {
    const pwId = gameWithPlaneswalker('pw-exact', '2', [
      '-2: You gain 2 life.',
    ]);

    store().activateAbility(pwId, 0);

    // 2 - 2 = 0, should succeed (counter key removed at zero)
    expect(store().state!.cards[pwId].counters.loyalty ?? 0).toBe(0);
  });
});

describe('review.cr606-loyalty-activation: once per turn (CR 606.3)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('blocks second loyalty activation of the same permanent in the same turn', () => {
    const pwId = gameWithPlaneswalker('pw-once', '5', [
      '+1: Draw a card.',
      '-1: Scry 1.',
    ]);

    // First activation succeeds
    store().activateAbility(pwId, 0);
    expect(store().state!.cards[pwId].counters.loyalty).toBe(6);

    // Second activation of the same permanent should be blocked
    store().activateAbility(pwId, 1);
    // Loyalty should NOT change again (still 6, not 5)
    expect(store().state!.cards[pwId].counters.loyalty).toBe(6);
    expect(store().warnings.length).toBeGreaterThan(0);
  });
});

describe('review.cr606-loyalty-activation: undo/redo atomicity', () => {
  beforeEach(() => {
    resetStore();
  });

  it('loyalty activation is a single undo snapshot', () => {
    const pwId = gameWithPlaneswalker('pw-undo', '3', [
      '+1: Draw a card.',
    ]);

    store().activateAbility(pwId, 0);
    expect(store().state!.cards[pwId].counters.loyalty).toBe(4);

    // Undo restores loyalty
    store().undo();
    expect(store().state!.cards[pwId].counters.loyalty).toBe(3);

    // Redo re-applies
    store().redo();
    expect(store().state!.cards[pwId].counters.loyalty).toBe(4);
  });
});
