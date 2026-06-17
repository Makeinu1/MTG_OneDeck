import { beforeEach, describe, expect, it } from 'vitest';
import { applyCommand } from '../commands';
import { initGame } from '../init';
import { useGameStore } from '../../store/gameStore';
import type { GameState } from '../types';
import { makeDef, makeDeck } from './helpers';

function instanceId(state: GameState, defId: string): string {
  return Object.values(state.cards).find((card) => card.defId === defId)!.id;
}

describe('M4.28 engine commands', () => {
  it('copies spells and abilities onto the stack', () => {
    const creature = makeDef({
      scryfallId: 'm428-creature',
      typeLine: 'Creature — Shapeshifter',
      faces: [{ name: 'm428-creature', typeLine: 'Creature — Shapeshifter', manaCost: '{2}{U}' }],
    });
    let state = initGame([{ def: creature, isCommander: false }, ...makeDeck(4)], 1);
    const creatureId = instanceId(state, 'm428-creature');

    state = applyCommand(state, {
      type: 'moveCard',
      cardId: creatureId,
      to: 'battlefield',
      position: 'bottom',
    }).state;
    state = applyCommand(state, {
      type: 'addAbilityToStack',
      sourceId: creatureId,
      kind: 'triggered',
    }).state;

    const abilityId = state.zones.stack[state.zones.stack.length - 1];
    const abilityCopyState = applyCommand(state, {
      type: 'copyStackItem',
      cardId: abilityId,
    }).state;
    const abilityCopyId = abilityCopyState.zones.stack[abilityCopyState.zones.stack.length - 1];

    expect(abilityCopyId).toBe('a2');
    expect(abilityCopyState.cards[abilityCopyId]).toMatchObject({
      isAbility: true,
      sourceId: creatureId,
      abilityKind: 'triggered',
      defId: abilityCopyState.cards[creatureId].defId,
      zone: 'stack',
    });

    const spellStackState = applyCommand(abilityCopyState, {
      type: 'moveCard',
      cardId: creatureId,
      to: 'stack',
      position: 'bottom',
    }).state;
    const spellCopyState = applyCommand(spellStackState, {
      type: 'copyStackItem',
      cardId: creatureId,
    }).state;
    const spellCopyId = spellCopyState.zones.stack[spellCopyState.zones.stack.length - 1];

    expect(spellCopyId).toBe('k1');
    expect(spellCopyState.cards[spellCopyId]).toMatchObject({
      defId: spellCopyState.cards[creatureId].defId,
      zone: 'stack',
      isCopy: true,
      isToken: false,
    });
  });

  it('turns permanent spell copies into battlefield tokens on resolution', () => {
    const creature = makeDef({
      scryfallId: 'm428-resolve-creature',
      typeLine: 'Creature — Beast',
      faces: [{ name: 'm428-resolve-creature', typeLine: 'Creature — Beast', manaCost: '{3}{G}' }],
    });
    let state = initGame([{ def: creature, isCommander: false }, ...makeDeck(4)], 2);
    const creatureId = instanceId(state, 'm428-resolve-creature');

    state = applyCommand(state, {
      type: 'moveCard',
      cardId: creatureId,
      to: 'stack',
      position: 'bottom',
    }).state;
    state = applyCommand(state, {
      type: 'copyStackItem',
      cardId: creatureId,
    }).state;

    const copyId = state.zones.stack[state.zones.stack.length - 1];
    const resolved = applyCommand(state, { type: 'resolveStackTop' }).state;

    expect(resolved.cards[copyId]).toMatchObject({
      id: copyId,
      zone: 'battlefield',
      isToken: true,
      isCopy: false,
    });
    expect(resolved.cards[copyId].enteredTurn).toBe(resolved.turn);
    expect(resolved.zones.graveyard).not.toContain(copyId);
  });

  it('vanishes non-permanent spell copies when they leave the stack', () => {
    const instant = makeDef({
      scryfallId: 'm428-resolve-instant',
      typeLine: 'Instant',
      faces: [{ name: 'm428-resolve-instant', typeLine: 'Instant', manaCost: '{U}' }],
    });
    let state = initGame([{ def: instant, isCommander: false }, ...makeDeck(4)], 3);
    const instantId = instanceId(state, 'm428-resolve-instant');

    state = applyCommand(state, {
      type: 'moveCard',
      cardId: instantId,
      to: 'stack',
      position: 'bottom',
    }).state;
    state = applyCommand(state, {
      type: 'copyStackItem',
      cardId: instantId,
    }).state;

    const copyId = state.zones.stack[state.zones.stack.length - 1];
    const resolved = applyCommand(state, { type: 'resolveStackTop' }).state;

    expect(resolved.cards[copyId]).toBeUndefined();
    expect(resolved.zones.graveyard).not.toContain(copyId);
    expect(resolved.zones.stack).toContain(instantId);
  });

  it('creates permanent copy tokens with ETB counters but without source counters', () => {
    const walker = makeDef({
      scryfallId: 'm428-walker',
      typeLine: 'Legendary Planeswalker — Test',
      faces: [
        {
          name: 'm428-walker',
          typeLine: 'Legendary Planeswalker — Test',
          loyalty: '4',
        },
      ],
    });
    let state = initGame([{ def: walker, isCommander: false }, ...makeDeck(4)], 4);
    const walkerId = instanceId(state, 'm428-walker');

    state = applyCommand(state, {
      type: 'moveCard',
      cardId: walkerId,
      to: 'battlefield',
      position: 'bottom',
    }).state;
    state = applyCommand(state, {
      type: 'addCounters',
      cardId: walkerId,
      counterType: 'loyalty',
      delta: 3,
    }).state;

    const copied = applyCommand(state, {
      type: 'copyPermanent',
      cardId: walkerId,
      quantity: 2,
    }).state;
    const tokenIds = copied.zones.battlefield.filter((id) => id !== walkerId);

    expect(tokenIds).toHaveLength(2);
    for (const tokenId of tokenIds) {
      expect(copied.cards[tokenId]).toMatchObject({
        defId: copied.cards[walkerId].defId,
        zone: 'battlefield',
        isToken: true,
      });
      expect(copied.cards[tokenId].counters.loyalty).toBe(4);
    }
    expect(copied.cards[walkerId].counters.loyalty).toBe(7);
  });
});

describe('M4.28 store actions', () => {
  beforeEach(() => {
    useGameStore.setState({
      state: null,
      warnings: [],
      canUndo: false,
      canRedo: false,
      autoAdvanceToMain: false,
      mulliganDecisionPending: false,
    });
  });

  it('copies stack spells through the store and undoes in one step', () => {
    const creature = makeDef({
      scryfallId: 'm428-store-creature',
      typeLine: 'Creature — Wizard',
      faces: [{ name: 'm428-store-creature', typeLine: 'Creature — Wizard', manaCost: '{1}{U}' }],
    });
    useGameStore.getState().newGame([{ def: creature, isCommander: false }, ...makeDeck(8)], 11);
    const state = useGameStore.getState().state!;
    const creatureId = instanceId(state, 'm428-store-creature');

    useGameStore.getState().moveCard(creatureId, 'stack', 'bottom');
    useGameStore.getState().copyStackItem(creatureId);

    let current = useGameStore.getState().state!;
    const copyId = current.zones.stack[current.zones.stack.length - 1];
    expect(current.cards[copyId]).toMatchObject({
      zone: 'stack',
      isCopy: true,
      defId: current.cards[creatureId].defId,
    });

    useGameStore.getState().undo();
    current = useGameStore.getState().state!;
    expect(current.zones.stack).toEqual([creatureId]);
    expect(Object.values(current.cards).some((card) => card.id === copyId)).toBe(false);
  });

  it('copies permanents through the store and undoes in one step', () => {
    const walker = makeDef({
      scryfallId: 'm428-store-walker',
      typeLine: 'Legendary Planeswalker — Store',
      faces: [
        {
          name: 'm428-store-walker',
          typeLine: 'Legendary Planeswalker — Store',
          loyalty: '5',
        },
      ],
    });
    useGameStore.getState().newGame([{ def: walker, isCommander: false }, ...makeDeck(8)], 12);
    const walkerId = instanceId(useGameStore.getState().state!, 'm428-store-walker');

    useGameStore.getState().moveCard(walkerId, 'battlefield', 'bottom');
    useGameStore.getState().dispatch({
      type: 'addCounters',
      cardId: walkerId,
      counterType: 'loyalty',
      delta: 2,
    });

    useGameStore.getState().copyPermanent(walkerId, 2);
    let current = useGameStore.getState().state!;
    const tokenIds = current.zones.battlefield.filter((id) => id !== walkerId);

    expect(tokenIds).toHaveLength(2);
    expect(tokenIds.every((id) => current.cards[id].counters.loyalty === 5)).toBe(true);

    useGameStore.getState().undo();
    current = useGameStore.getState().state!;
    expect(current.zones.battlefield).toEqual([walkerId]);
  });

  it('activates and resolves fetch abilities with single-step undo', () => {
    const fetchLand = makeDef({
      scryfallId: 'm428-fetch',
      typeLine: 'Land',
      faces: [
        {
          name: 'm428-fetch',
          typeLine: 'Land',
          oracleText:
            'Pay 1 life, Sacrifice m428-fetch: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.',
        },
      ],
    });
    const targetLand = makeDef({
      scryfallId: 'm428-target',
      typeLine: 'Basic Land — Island',
      faces: [{ name: 'm428-target', typeLine: 'Basic Land — Island' }],
    });
    useGameStore.getState().newGame(
      [
        { def: fetchLand, isCommander: false },
        { def: targetLand, isCommander: false },
        ...makeDeck(28),
      ],
      13
    );

    const sourceId = instanceId(useGameStore.getState().state!, 'm428-fetch');
    useGameStore.getState().moveCard(sourceId, 'battlefield', 'bottom');

    const beforeActivate = useGameStore.getState().state!;
    useGameStore.getState().activateFetch(sourceId, { entersTapped: true, lifeCost: 1 });
    let current = useGameStore.getState().state!;
    const abilityId = current.zones.stack[current.zones.stack.length - 1];

    expect(current.life).toBe(beforeActivate.life - 1);
    expect(current.cards[sourceId].zone).toBe('graveyard');
    expect(current.cards[abilityId]).toMatchObject({
      isAbility: true,
      sourceId,
      zone: 'stack',
    });

    useGameStore.getState().undo();
    current = useGameStore.getState().state!;
    expect(current.life).toBe(beforeActivate.life);
    expect(current.cards[sourceId].zone).toBe('battlefield');
    expect(current.zones.stack).toEqual([]);

    useGameStore.getState().activateFetch(sourceId, { entersTapped: true, lifeCost: 1 });
    const afterActivate = useGameStore.getState().state!;
    const stackedAbilityId = afterActivate.zones.stack[afterActivate.zones.stack.length - 1];
    const targetId = afterActivate.zones.library.find((cardId) => afterActivate.cards[cardId].defId === 'm428-target')!;

    useGameStore.getState().resolveFetch(stackedAbilityId, targetId, { entersTapped: true });
    current = useGameStore.getState().state!;

    expect(current.cards[targetId].zone).toBe('battlefield');
    expect(current.cards[targetId].tapped).toBe(true);
    expect(current.cards[stackedAbilityId]).toBeUndefined();

    useGameStore.getState().undo();
    current = useGameStore.getState().state!;
    expect(current).toEqual(afterActivate);
  });

  it('stops resolveAll before a fetch ability reaches the top', () => {
    const fetchLand = makeDef({
      scryfallId: 'm428-fetch-stop',
      typeLine: 'Land',
      faces: [
        {
          name: 'm428-fetch-stop',
          typeLine: 'Land',
          oracleText:
            'Pay 1 life, Sacrifice m428-fetch-stop: Search your library for an Island or Swamp card, put it onto the battlefield, then shuffle.',
        },
      ],
    });
    const instant = makeDef({
      scryfallId: 'm428-fetch-stop-spell',
      typeLine: 'Instant',
      faces: [{ name: 'm428-fetch-stop-spell', typeLine: 'Instant', manaCost: '{U}' }],
    });
    useGameStore.getState().newGame(
      [
        { def: fetchLand, isCommander: false },
        { def: instant, isCommander: false },
        ...makeDeck(20),
      ],
      14
    );

    const sourceId = instanceId(useGameStore.getState().state!, 'm428-fetch-stop');
    const spellId = instanceId(useGameStore.getState().state!, 'm428-fetch-stop-spell');
    useGameStore.getState().moveCard(sourceId, 'battlefield', 'bottom');
    useGameStore.getState().activateFetch(sourceId, { entersTapped: false, lifeCost: 1 });
    useGameStore.getState().moveCard(spellId, 'stack', 'bottom');

    useGameStore.getState().resolveAll();
    const current = useGameStore.getState().state!;
    const topId = current.zones.stack[current.zones.stack.length - 1];

    expect(current.cards[spellId].zone).toBe('graveyard');
    expect(current.cards[topId]).toMatchObject({
      isAbility: true,
      sourceId,
      zone: 'stack',
    });
  });
});
