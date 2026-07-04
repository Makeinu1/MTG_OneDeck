import { beforeEach, describe, expect, it } from 'vitest';

import { guidedPlanForStackTop } from '../../engine/commands';
import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import { objectIdOf } from '../../engine/types';
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

function moveToBattlefield(cardId: string): void {
  store().moveCard(cardId, 'battlefield', 'bottom');
}

function stateSnapshot(): string {
  return JSON.stringify(store().state);
}

describe('activated ability activation envelope', () => {
  beforeEach(() => {
    resetStore();
  });

  it('stores activation-time object targets on the stack ability and uses them on resolution', () => {
    const source = makeDef({
      scryfallId: 'env-tapper',
      typeLine: 'Artifact',
      faces: [
        {
          name: 'env-tapper',
          typeLine: 'Artifact',
          oracleText: '{T}: Tap target creature.',
        },
      ],
    });
    const target = makeDef({
      scryfallId: 'env-bear',
      typeLine: 'Creature',
      faces: [{ name: 'env-bear', typeLine: 'Creature' }],
    });

    store().newGame(
      [{ def: source, isCommander: false }, { def: target, isCommander: false }, ...makeDeck(10)],
      1,
    );
    const sourceId = findInstanceId('env-tapper');
    const targetId = findInstanceId('env-bear');
    moveToBattlefield(sourceId);
    moveToBattlefield(targetId);
    store().clearWarnings();

    const beforeTargetObjectId = objectIdOf(store().state!.cards[targetId]);
    const beforeActivation = stateSnapshot();
    store().activateAbility(sourceId, 0);

    expect(stateSnapshot()).toBe(beforeActivation);
    expect(store().pendingGuided?.mode).toBe('activation');
    expect(store().state!.zones.stack).toHaveLength(0);

    store().confirmGuidedTarget(targetId);

    const state = store().state!;
    const abilityId = state.zones.stack[0];
    const ability = state.cards[abilityId];
    expect(state.cards[sourceId].tapped).toBe(true);
    expect(ability.targetSelections).toHaveLength(1);
    expect(ability.targetSelections?.[0]).toMatchObject({
      slotId: 'target-0',
      kind: 'object',
      selection: {
        kind: 'object',
        physicalCardId: targetId,
        objectId: beforeTargetObjectId,
      },
      legalityMode: 'checked',
    });
    expect(ability.activationEnvelope?.targetSelections).toHaveLength(1);
    expect(guidedPlanForStackTop(state)).toBeNull();

    store().resolveTop();
    expect(store().state!.cards[targetId].tapped).toBe(true);
  });

  it('rules-legal mode does not commit any part when a modeled tap cost is unpayable', () => {
    const source = makeDef({
      scryfallId: 'env-tapped-cost',
      typeLine: 'Artifact',
      faces: [
        {
          name: 'env-tapped-cost',
          typeLine: 'Artifact',
          oracleText: '{T}: Draw a card.',
        },
      ],
    });

    store().newGame([{ def: source, isCommander: false }, ...makeDeck(10)], 1);
    const sourceId = findInstanceId('env-tapped-cost');
    moveToBattlefield(sourceId);
    store().dispatch({ type: 'setTapped', cardId: sourceId, tapped: true });
    store().clearWarnings();
    const before = stateSnapshot();

    store().activateAbility(sourceId, 0);

    expect(stateSnapshot()).toBe(before);
    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().warnings.some((warning) => warning.includes('すでにタップ'))).toBe(true);
  });

  it('forced mode may commit but warns that the activation is not CR-legal', () => {
    const source = makeDef({
      scryfallId: 'env-forced',
      typeLine: 'Artifact',
      faces: [
        {
          name: 'env-forced',
          typeLine: 'Artifact',
          oracleText: '{T}: Draw a card.',
        },
      ],
    });

    store().newGame([{ def: source, isCommander: false }, ...makeDeck(10)], 1);
    const sourceId = findInstanceId('env-forced');
    moveToBattlefield(sourceId);
    store().dispatch({ type: 'setTapped', cardId: sourceId, tapped: true });
    store().clearWarnings();

    store().activateAbility(sourceId, 0, { force: true });

    expect(store().state!.zones.stack).toHaveLength(1);
    expect(store().warnings.some((warning) => warning.includes('CR-legalとして扱いません'))).toBe(
      true,
    );
  });

  it('targetless activated mana abilities still resolve without a stack object', () => {
    const source = makeDef({
      scryfallId: 'env-mana',
      typeLine: 'Creature — Elf Druid',
      faces: [
        {
          name: 'env-mana',
          typeLine: 'Creature — Elf Druid',
          oracleText: '{T}: Add {G}.',
        },
      ],
    });

    store().newGame([{ def: source, isCommander: false }, ...makeDeck(10)], 1);
    const sourceId = findInstanceId('env-mana');
    moveToBattlefield(sourceId);
    store().clearWarnings();

    store().activateAbility(sourceId, 0);

    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().state!.cards[sourceId].tapped).toBe(true);
    expect(store().state!.manaPool.G).toBe(1);
  });

  it('targeted add-mana abilities are ordinary stack abilities with a player target selection', () => {
    const source = makeDef({
      scryfallId: 'env-targeted-mana',
      typeLine: 'Artifact',
      faces: [
        {
          name: 'env-targeted-mana',
          typeLine: 'Artifact',
          oracleText: '{T}: Target player adds {G}.',
        },
      ],
    });

    store().newGame([{ def: source, isCommander: false }, ...makeDeck(10)], 1);
    const sourceId = findInstanceId('env-targeted-mana');
    moveToBattlefield(sourceId);
    store().clearWarnings();

    store().activateAbility(sourceId, 0);

    expect(store().pendingGuided?.mode).toBe('activation');
    expect(store().pendingGuided?.prompts[0]?.targetKind).toBe('player');
    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().state!.manaPool.G).toBe(0);

    store().confirmGuidedPlayerTarget('P1');

    const state = store().state!;
    const ability = state.cards[state.zones.stack[0]];
    expect(state.cards[sourceId].tapped).toBe(true);
    expect(state.manaPool.G).toBe(0);
    expect(ability.targetSelections?.[0]).toMatchObject({
      kind: 'player',
      selection: { kind: 'player', playerId: 'P1' },
    });
  });

  it('blocks unpayable pay-life costs in rules-legal mode but forced mode commits with warning', () => {
    const source = makeDef({
      scryfallId: 'env-pay-life',
      typeLine: 'Artifact',
      faces: [
        {
          name: 'env-pay-life',
          typeLine: 'Artifact',
          oracleText: 'Pay 3 life: Draw a card.',
        },
      ],
    });

    store().newGame([{ def: source, isCommander: false }, ...makeDeck(10)], 1);
    const sourceId = findInstanceId('env-pay-life');
    moveToBattlefield(sourceId);
    useGameStore.setState({ state: { ...store().state!, life: 2 } });
    store().clearWarnings();
    const before = stateSnapshot();

    store().activateAbility(sourceId, 0);

    expect(stateSnapshot()).toBe(before);
    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().warnings.some((warning) => warning.includes('ライフ'))).toBe(true);

    store().clearWarnings();
    store().activateAbility(sourceId, 0, { force: true });

    const state = store().state!;
    const ability = state.cards[state.zones.stack[0]];
    expect(state.life).toBe(-1);
    expect(ability.activationEnvelope?.cost).toContainEqual(
      expect.objectContaining({
        kind: 'pay-life',
        status: 'guided',
        amount: 3,
        raw: 'Pay 3 life',
      }),
    );
    expect(store().warnings.some((warning) => warning.includes('CR-legalとして扱いません'))).toBe(
      true,
    );
  });

  it('guides discard costs and records the chosen hand card in the cost envelope', () => {
    const source = makeDef({
      scryfallId: 'env-discard',
      typeLine: 'Artifact',
      faces: [
        {
          name: 'env-discard',
          typeLine: 'Artifact',
          oracleText: '{T}, Discard a card: Draw a card.',
        },
      ],
    });

    store().newGame([{ def: source, isCommander: false }, ...makeDeck(12)], 2);
    const sourceId = findInstanceId('env-discard');
    moveToBattlefield(sourceId);
    const discardId = store().state!.zones.hand.find((cardId) => cardId !== sourceId);
    if (!discardId) throw new Error('discard fixture did not draw a spare hand card');
    store().clearWarnings();
    const before = stateSnapshot();

    store().activateAbility(sourceId, 0);

    expect(stateSnapshot()).toBe(before);
    expect(store().pendingGuided?.mode).toBe('activation');
    expect(store().pendingGuided?.prompts[0]?.kind).toBe('cost-discard');
    expect(store().state!.zones.stack).toHaveLength(0);

    store().confirmGuidedCostSubject(discardId);

    const state = store().state!;
    const ability = state.cards[state.zones.stack[0]];
    const discardCost = ability.activationEnvelope?.cost.find((cost) => cost.kind === 'discard');
    expect(state.cards[sourceId].tapped).toBe(true);
    expect(state.cards[discardId].zone).toBe('graveyard');
    expect(discardCost).toMatchObject({
      status: 'guided',
      amount: 1,
      subjectRef: { physicalCardId: discardId },
    });
  });

  it('guides non-self sacrifice costs and sacrifices the selected permanent', () => {
    const source = makeDef({
      scryfallId: 'env-sacrifice-source',
      typeLine: 'Artifact',
      faces: [
        {
          name: 'env-sacrifice-source',
          typeLine: 'Artifact',
          oracleText: '{T}, Sacrifice a creature: Draw a card.',
        },
      ],
    });
    const creature = makeDef({
      scryfallId: 'env-sacrifice-creature',
      typeLine: 'Creature',
      faces: [{ name: 'env-sacrifice-creature', typeLine: 'Creature' }],
    });

    store().newGame(
      [{ def: source, isCommander: false }, { def: creature, isCommander: false }, ...makeDeck(12)],
      3,
    );
    const sourceId = findInstanceId('env-sacrifice-source');
    const creatureId = findInstanceId('env-sacrifice-creature');
    moveToBattlefield(sourceId);
    moveToBattlefield(creatureId);
    store().clearWarnings();

    store().activateAbility(sourceId, 0);

    expect(store().pendingGuided?.prompts[0]?.kind).toBe('cost-sacrifice');
    store().confirmGuidedCostSubject(creatureId);

    const state = store().state!;
    const ability = state.cards[state.zones.stack[0]];
    const sacrificeCost = ability.activationEnvelope?.cost.find(
      (cost) => cost.kind === 'sacrifice-object',
    );
    expect(state.cards[sourceId].tapped).toBe(true);
    expect(state.cards[creatureId].zone).toBe('graveyard');
    expect(sacrificeCost).toMatchObject({
      status: 'guided',
      amount: 1,
      subjectRef: { physicalCardId: creatureId },
    });
  });

  it('pays strict self-exile costs before putting the activated ability on the stack', () => {
    const source = makeDef({
      scryfallId: 'env-self-exile',
      typeLine: 'Artifact',
      faces: [
        {
          name: 'env-self-exile',
          typeLine: 'Artifact',
          oracleText: 'Exile this artifact: Draw a card.',
        },
      ],
    });

    store().newGame([{ def: source, isCommander: false }, ...makeDeck(10)], 4);
    const sourceId = findInstanceId('env-self-exile');
    moveToBattlefield(sourceId);
    store().clearWarnings();
    const beforeObjectId = objectIdOf(store().state!.cards[sourceId]);

    store().activateAbility(sourceId, 0);

    const state = store().state!;
    const ability = state.cards[state.zones.stack[0]];
    expect(state.cards[sourceId].zone).toBe('exile');
    expect(state.zones.exile).toContain(sourceId);
    expect(state.zones.stack).toHaveLength(1);
    expect(ability.activationEnvelope?.sourceRef).toMatchObject({
      physicalCardId: sourceId,
      objectId: beforeObjectId,
    });
  });

  it('keeps multiple nonmana costs atomic when one modeled component cannot be paid', () => {
    const source = makeDef({
      scryfallId: 'env-atomic-nonmana',
      typeLine: 'Artifact',
      faces: [
        {
          name: 'env-atomic-nonmana',
          typeLine: 'Artifact',
          oracleText: 'Pay 5 life, Discard a card: Draw a card.',
        },
      ],
    });

    store().newGame([{ def: source, isCommander: false }, ...makeDeck(12)], 4);
    const sourceId = findInstanceId('env-atomic-nonmana');
    moveToBattlefield(sourceId);
    const discardId = store().state!.zones.hand.find((cardId) => cardId !== sourceId);
    if (!discardId) throw new Error('atomic fixture did not draw a spare hand card');
    useGameStore.setState({ state: { ...store().state!, life: 2 } });
    store().clearWarnings();
    const before = stateSnapshot();

    store().activateAbility(sourceId, 0);

    expect(stateSnapshot()).toBe(before);
    expect(store().pendingGuided).toBeNull();
    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().state!.cards[discardId].zone).toBe('hand');
    expect(store().state!.life).toBe(2);
    expect(store().warnings.some((warning) => warning.includes('ライフ'))).toBe(true);
  });
});
