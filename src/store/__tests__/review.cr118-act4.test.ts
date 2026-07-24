// REVIEWER-OWNED acceptance contract for CR 118 ACT-4 (engine-spec §33.8).
// Implementation agents must NOT edit this file; fix the engine/store/UI substrate.
//
// CR grounding (rule/ fixed 2026-06-19):
// - 107.1b/107.3a: zero is a number and X is announced before paying its cost.
// - 107.3k: one announced X value is used for every X in the same object.
// - 107.5: the summoning-sickness restriction belongs to the {T} symbol.
// - 118.3/601.2h/602.2b: every resource must exist and the payment is atomic.
// - 605.3b: a mana ability resolves without using the stack.
// - 701.26a: tapping an already-tapped permanent does not pay a tap cost.
// - 733.1: an illegal action returns the game to the state before it began.

import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import type { ManaColor } from '../../types/card';
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
    autoAdvanceToMain: false,
    mulliganDecisionPending: false,
  });
}

function idFor(defId: string): string {
  const card = Object.values(store().state?.cards ?? {}).find((entry) => entry.defId === defId);
  if (!card) throw new Error(`missing card for ${defId}`);
  return card.id;
}

function toBattlefield(cardId: string): void {
  store().moveCard(cardId, 'battlefield', 'bottom');
}

function stateJson(): string {
  return JSON.stringify(store().state);
}

function stackCards() {
  const state = store().state;
  if (!state) throw new Error('game state unavailable');
  return state.zones.stack.map((id) => state.cards[id]);
}

function artifact(id: string, oracleText: string) {
  return makeDef({
    scryfallId: id,
    name: id,
    typeLine: 'Artifact',
    faces: [{ name: id, typeLine: 'Artifact', oracleText }],
  });
}

function creature(id: string, typeLine: string, oracleText?: string) {
  return makeDef({
    scryfallId: id,
    name: id,
    typeLine,
    faces: [{ name: id, typeLine, oracleText }],
  });
}

function chooseMana(color: ManaColor): void {
  expect(store().pendingGuided?.prompts[0]?.kind).toBe('mana');
  store().confirmGuidedMana(color);
}

describe('review.cr118-act4: tap-object cost transaction', () => {
  beforeEach(resetStore);

  it('Relic of Legends is reachable through the real no-stack path and cancels atomically', () => {
    const relic = artifact(
      'act4-relic',
      '{T}: Add {C}.\nTap an untapped legendary creature you control: Add one mana of any color.',
    );
    const legend = creature(
      'act4-legend',
      'Legendary Creature — Human Wizard',
    );
    const ordinary = creature('act4-ordinary', 'Creature — Human Wizard');
    const opposingLegend = creature(
      'act4-opposing-legend',
      'Legendary Creature — Human Wizard',
    );
    store().newGame([
      { def: relic, isCommander: false },
      { def: legend, isCommander: false },
      { def: ordinary, isCommander: false },
      { def: opposingLegend, isCommander: false },
      ...makeDeck(16),
    ], 118);
    const relicId = idFor('act4-relic');
    const legendId = idFor('act4-legend');
    const ordinaryId = idFor('act4-ordinary');
    const opposingId = idFor('act4-opposing-legend');
    [relicId, legendId, ordinaryId, opposingId].forEach(toBattlefield);
    store().addOpponent('Opponent');
    const opponentId = store().state!.turnOrder.find((playerId) => playerId !== 'P1');
    if (!opponentId) throw new Error('opponent setup failed');
    store().dispatch({ type: 'setController', cardId: opposingId, controllerId: opponentId });
    store().clearWarnings();
    const baseline = stateJson();

    store().activateAbility(relicId, 1);

    expect(stateJson()).toBe(baseline);
    expect(store().pendingGuided?.mode).toBe('mana-ability');
    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      kind: 'cost-tap',
      count: 1,
      filter: {
        controller: 'you',
        zone: 'battlefield',
        supertypes: ['legendary'],
        types: ['creature'],
      },
    });

    store().confirmGuidedCostSubject(ordinaryId);
    expect(stateJson()).toBe(baseline);
    expect(store().pendingGuided?.prompts[0]?.kind).toBe('cost-tap');
    store().confirmGuidedCostSubject(opposingId);
    expect(stateJson()).toBe(baseline);
    expect(store().pendingGuided?.prompts[0]?.kind).toBe('cost-tap');

    store().confirmGuidedCostSubject(legendId);
    expect(stateJson()).toBe(baseline);
    expect(store().pendingGuided?.prompts[0]?.kind).toBe('mana');
    store().cancelGuidedPrompt();
    expect(stateJson()).toBe(baseline);
    expect(store().pendingGuided).toBeNull();

    store().activateAbility(relicId, 1);
    store().confirmGuidedCostSubject(legendId);
    chooseMana('U');

    expect(store().state!.cards[legendId].tapped).toBe(true);
    expect(store().state!.cards[relicId].tapped).toBe(false);
    expect(store().state!.manaPool.U).toBe(1);
    expect(store().state!.zones.stack).toHaveLength(0);
    const committed = stateJson();

    store().undo();
    expect(stateJson()).toBe(baseline);
    store().redo();
    expect(stateJson()).toBe(committed);
  });

  it('does not categorically exclude the source when prose permits tapping it', () => {
    const source = artifact(
      'act4-self-eligible',
      'Tap an untapped artifact you control: Draw a card.',
    );
    store().newGame([{ def: source, isCommander: false }, ...makeDeck(12)], 119);
    const sourceId = idFor('act4-self-eligible');
    toBattlefield(sourceId);
    const baseline = stateJson();

    store().activateAbility(sourceId, 0);
    expect(stateJson()).toBe(baseline);
    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      kind: 'cost-tap',
      filter: { excludeSource: false },
    });
    store().confirmGuidedCostSubject(sourceId);

    expect(store().state!.cards[sourceId].tapped).toBe(true);
    expect(stackCards()).toHaveLength(1);
    const tapComponent = stackCards()[0].activationEnvelope?.cost.find(
      (component) => component.kind === 'tap-object',
    );
    expect(tapComponent).toMatchObject({
      kind: 'tap-object',
      status: 'guided',
      amount: 1,
    });
    expect(tapComponent?.subjectRef?.physicalCardId).toBe(sourceId);
  });

  it('requires exactly two distinct matching permanents and leaks no partial tap', () => {
    const clock = artifact(
      'act4-clock',
      'Tap two untapped artifacts you control: Untap target artifact.',
    );
    const first = artifact('act4-clock-a', '');
    const second = artifact('act4-clock-b', '');
    const creatureOnly = creature('act4-clock-creature', 'Creature — Goat');
    store().newGame([
      { def: clock, isCommander: false },
      { def: first, isCommander: false },
      { def: second, isCommander: false },
      { def: creatureOnly, isCommander: false },
      ...makeDeck(12),
    ], 120);
    const clockId = idFor('act4-clock');
    const firstId = idFor('act4-clock-a');
    const secondId = idFor('act4-clock-b');
    const creatureId = idFor('act4-clock-creature');
    [clockId, firstId, secondId, creatureId].forEach(toBattlefield);
    const baseline = stateJson();

    store().activateAbility(clockId, 0);
    // Target selection precedes cost payment under CR 602.2b.
    expect(store().pendingGuided?.prompts[0]?.kind).toBe('target');
    store().confirmGuidedTarget(firstId);
    expect(store().pendingGuided?.prompts[0]).toMatchObject({ kind: 'cost-tap', count: 2 });
    store().confirmGuidedCostSubject(creatureId);
    expect(stateJson()).toBe(baseline);
    store().confirmGuidedCostSubject(secondId);
    expect(stateJson()).toBe(baseline);
    store().confirmGuidedCostSubject(secondId);
    expect(stateJson()).toBe(baseline);
    store().cancelGuidedPrompt();
    expect(stateJson()).toBe(baseline);

    store().activateAbility(clockId, 0);
    store().confirmGuidedTarget(firstId);
    store().confirmGuidedCostSubject(secondId);
    store().confirmGuidedCostSubject(firstId);
    expect(store().state!.cards[secondId].tapped).toBe(true);
    expect(store().state!.cards[firstId].tapped).toBe(true);
    expect(stackCards()).toHaveLength(1);
    const subjects = stackCards()[0].activationEnvelope?.cost
      .find((component) => component.kind === 'tap-object')?.subjectRefs
      ?.map((subject) => subject.physicalCardId);
    expect(subjects).toEqual([secondId, firstId]);
  });
});

describe('review.cr118-act4: remove-counter cost transaction', () => {
  beforeEach(resetStore);

  it('Dragon’s Hoard removes the exact named counter, commits one stack object, and is undoable', () => {
    const hoard = artifact(
      'act4-dragons-hoard',
      "{T}, Remove a gold counter from Dragon's Hoard: Draw a card.",
    );
    store().newGame([{ def: hoard, isCommander: false }, ...makeDeck(14)], 121);
    const sourceId = idFor('act4-dragons-hoard');
    toBattlefield(sourceId);
    store().dispatch({ type: 'addCounters', cardId: sourceId, counterType: 'gold', delta: 1 });
    store().dispatch({ type: 'addCounters', cardId: sourceId, counterType: 'charge', delta: 1 });
    const baseline = stateJson();

    store().activateAbility(sourceId, 0);

    expect(store().state!.cards[sourceId].counters.gold ?? 0).toBe(0);
    expect(store().state!.cards[sourceId].counters.charge).toBe(1);
    expect(store().state!.cards[sourceId].tapped).toBe(true);
    expect(stackCards()).toHaveLength(1);
    const counterComponent = stackCards()[0].activationEnvelope?.cost.find(
      (component) => component.kind === 'remove-counter',
    );
    expect(counterComponent).toMatchObject({
      kind: 'remove-counter',
      counterType: 'gold',
      amount: 1,
      status: 'auto',
    });
    expect(counterComponent?.subjectRef?.physicalCardId).toBe(sourceId);
    const committed = stateJson();
    store().undo();
    expect(stateJson()).toBe(baseline);
    store().redo();
    expect(stateJson()).toBe(committed);
  });

  it('never uses addCounters clamping as partial payment', () => {
    const vial = artifact(
      'act4-vial',
      'Remove four charge counters from this artifact: Draw a card.',
    );
    store().newGame([{ def: vial, isCommander: false }, ...makeDeck(12)], 122);
    const sourceId = idFor('act4-vial');
    toBattlefield(sourceId);
    store().dispatch({ type: 'addCounters', cardId: sourceId, counterType: 'charge', delta: 3 });
    store().clearWarnings();
    const baseline = stateJson();

    store().activateAbility(sourceId, 0);

    expect(stateJson()).toBe(baseline);
    expect(stackCards()).toHaveLength(0);
    expect(store().warnings.length).toBeGreaterThan(0);
  });

  it('selects one controlled counter source and rejects the wrong exact counter type', () => {
    const source = artifact(
      'act4-counter-selector',
      'Remove a gold counter from an artifact you control: Draw a card.',
    );
    const gold = artifact('act4-gold-source', '');
    const charge = artifact('act4-charge-source', '');
    store().newGame([
      { def: source, isCommander: false },
      { def: gold, isCommander: false },
      { def: charge, isCommander: false },
      ...makeDeck(12),
    ], 123);
    const sourceId = idFor('act4-counter-selector');
    const goldId = idFor('act4-gold-source');
    const chargeId = idFor('act4-charge-source');
    [sourceId, goldId, chargeId].forEach(toBattlefield);
    store().dispatch({ type: 'addCounters', cardId: goldId, counterType: 'gold', delta: 1 });
    store().dispatch({ type: 'addCounters', cardId: chargeId, counterType: 'charge', delta: 1 });
    const baseline = stateJson();

    store().activateAbility(sourceId, 0);
    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      kind: 'cost-remove-counter',
      counterCost: {
        interaction: 'source',
        counterType: 'gold',
        amount: { kind: 'fixed', value: 1 },
      },
    });
    store().confirmGuidedCostSubject(chargeId);
    expect(stateJson()).toBe(baseline);
    expect(store().pendingGuided?.prompts[0]?.kind).toBe('cost-remove-counter');
    store().confirmGuidedCostSubject(goldId);

    expect(store().state!.cards[goldId].counters.gold ?? 0).toBe(0);
    expect(store().state!.cards[chargeId].counters.charge).toBe(1);
    expect(stackCards()).toHaveLength(1);
  });

  it('one-or-more records a concrete integer amount and rejects invalid answers atomically', () => {
    const arcee = creature(
      'act4-arcee',
      'Legendary Artifact Creature — Robot',
      'Remove one or more +1/+1 counters from Arcee: Draw a card.',
    );
    store().newGame([{ def: arcee, isCommander: false }, ...makeDeck(12)], 124);
    const sourceId = idFor('act4-arcee');
    toBattlefield(sourceId);
    store().dispatch({ type: 'addCounters', cardId: sourceId, counterType: '+1/+1', delta: 3 });
    const baseline = stateJson();

    store().activateAbility(sourceId, 0);
    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      kind: 'cost-remove-counter',
      counterCost: {
        interaction: 'amount',
        counterType: '+1/+1',
        amount: { kind: 'one-or-more', min: 1, max: 3 },
        sourceId,
      },
    });
    store().confirmGuidedCounterAmount(0);
    expect(stateJson()).toBe(baseline);
    expect(store().pendingGuided?.prompts[0]?.kind).toBe('cost-remove-counter');
    store().confirmGuidedCounterAmount(4);
    expect(stateJson()).toBe(baseline);
    expect(store().pendingGuided?.prompts[0]?.kind).toBe('cost-remove-counter');
    store().confirmGuidedCounterAmount(1.5);
    expect(stateJson()).toBe(baseline);
    expect(store().pendingGuided?.prompts[0]?.kind).toBe('cost-remove-counter');
    store().cancelGuidedPrompt();
    expect(stateJson()).toBe(baseline);

    store().activateAbility(sourceId, 0);
    store().confirmGuidedCounterAmount(2);
    expect(store().state!.cards[sourceId].counters['+1/+1']).toBe(1);
    expect(stackCards()).toHaveLength(1);
    expect(stackCards()[0].activationEnvelope?.cost).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'remove-counter',
          counterType: '+1/+1',
          amount: 2,
          status: 'guided',
        }),
      ]),
    );
  });
});

describe('review.cr118-act4: bound X and honest manual fallback', () => {
  beforeEach(resetStore);

  it('treats announced X=0 as legal for Pernicious Deed and preserves it on the stack', () => {
    const deed = makeDef({
      scryfallId: 'act4-deed',
      name: 'Pernicious Deed',
      typeLine: 'Enchantment',
      faces: [{
        name: 'Pernicious Deed',
        typeLine: 'Enchantment',
        oracleText: '{X}, Sacrifice this enchantment: Destroy each artifact, creature, and enchantment with mana value X or less.',
      }],
    });
    store().newGame([{ def: deed, isCommander: false }, ...makeDeck(12)], 125);
    const sourceId = idFor('act4-deed');
    toBattlefield(sourceId);
    const baseline = stateJson();

    store().activateAbility(sourceId, 0, { xValue: 0 });

    expect(store().state!.cards[sourceId].zone).toBe('graveyard');
    expect(stackCards()).toHaveLength(1);
    expect(stackCards()[0]).toMatchObject({ announcedX: 0 });
    expect(stackCards()[0].activationEnvelope?.cost).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'mana', amount: 0 }),
        expect.objectContaining({ kind: 'sacrifice-self' }),
      ]),
    );
    const committed = stateJson();
    store().undo();
    expect(stateJson()).toBe(baseline);
    store().redo();
    expect(stateJson()).toBe(committed);
  });

  it('uses the one announced value for repeated X and refuses an insufficient legal payment', () => {
    const source = artifact(
      'act4-double-x',
      '{X}{X}, {T}: Draw a card.',
    );
    store().newGame([{ def: source, isCommander: false }, ...makeDeck(12)], 126);
    const sourceId = idFor('act4-double-x');
    toBattlefield(sourceId);
    store().adjustMana('C', 5);
    const baseline = stateJson();

    store().activateAbility(sourceId, 0, { xValue: 3 });

    expect(stateJson()).toBe(baseline);
    expect(store().state!.cards[sourceId].tapped).toBe(false);
    expect(stackCards()).toHaveLength(0);
    expect(store().warnings.length).toBeGreaterThan(0);

    store().adjustMana('C', 1);
    store().activateAbility(sourceId, 0, { xValue: 3 });
    expect(store().state!.manaPool.C).toBe(0);
    expect(store().state!.cards[sourceId].tapped).toBe(true);
    expect(stackCards()[0]).toMatchObject({ announcedX: 3 });
  });

  it('keeps an unsupported variable nonmana composite wholly manual', () => {
    const nightmare = makeDef({
      scryfallId: 'act4-nightmare',
      name: 'Chthonian Nightmare',
      typeLine: 'Enchantment',
      faces: [{
        name: 'Chthonian Nightmare',
        typeLine: 'Enchantment',
        oracleText: "Pay X {E}, Sacrifice a creature, Return this enchantment to its owner's hand: Return target creature card with mana value X from your graveyard to the battlefield. Activate only as a sorcery.",
      }],
    });
    const victim = creature('act4-nightmare-victim', 'Creature — Goat');
    store().newGame([
      { def: nightmare, isCommander: false },
      { def: victim, isCommander: false },
      ...makeDeck(12),
    ], 127);
    const sourceId = idFor('act4-nightmare');
    const victimId = idFor('act4-nightmare-victim');
    [sourceId, victimId].forEach(toBattlefield);
    store().dispatch({ type: 'adjustPlayerCounter', kind: 'energy', delta: 5 });
    const energyBefore = store().state!.energy;
    const baselineVictimZone = store().state!.cards[victimId].zone;
    const baselineSourceZone = store().state!.cards[sourceId].zone;

    store().activateAbility(sourceId, 0, { xValue: 2 });

    expect(store().state!.energy).toBe(energyBefore);
    expect(store().state!.cards[victimId].zone).toBe(baselineVictimZone);
    expect(store().state!.cards[sourceId].zone).toBe(baselineSourceZone);
    expect(store().warnings.length).toBeGreaterThan(0);
  });
});
