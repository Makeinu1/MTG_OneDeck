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
});
