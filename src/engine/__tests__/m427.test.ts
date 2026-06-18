import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyCommand } from '../commands';
import { initGame } from '../init';
import type { GameState, ManaPool } from '../types';
import { makeDef, makeDeck } from './helpers';
import { useGameStore } from '../../store/gameStore';

function pool(partial: Partial<ManaPool>): ManaPool {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, ...partial };
}

function drawCards(state: GameState, count: number): GameState {
  return applyCommand(state, { type: 'draw', count }).state;
}

describe('M4.27 engine commands', () => {
  it('casts a commander to the stack without incrementing castCount from the command zone', () => {
    const commander = makeDef({
      scryfallId: 'cmd-stack',
      typeLine: 'Legendary Creature',
      faces: [{ name: 'cmd-stack', typeLine: 'Legendary Creature', manaCost: '{2}{G}' }],
    });
    const state = initGame(makeDeck(4, [commander]), 1);
    const commanderId = state.commanders[0].cardId;

    const result = applyCommand(state, {
      type: 'castToStack',
      cardId: commanderId,
      payment: pool({}),
      forced: true,
    });

    expect(result.state.cards[commanderId].zone).toBe('stack');
    expect(result.state.zones.stack[result.state.zones.stack.length - 1]).toBe(commanderId);
    expect(result.state.commanders[0].castCount).toBe(0);
    expect(result.state.zones.battlefield).toHaveLength(0);
  });

  it('creates and resolves ability objects on the stack', () => {
    let state = drawCards(initGame(makeDeck(6), 1), 1);
    const sourceId = state.zones.hand[0];
    state = applyCommand(state, {
      type: 'moveCard',
      cardId: sourceId,
      to: 'battlefield',
      position: 'bottom',
    }).state;

    const stacked = applyCommand(state, {
      type: 'addAbilityToStack',
      sourceId,
      kind: 'activated',
    }).state;
    const abilityId = stacked.zones.stack[0];

    expect(abilityId).toBe('a1');
    expect(stacked.cards[abilityId]).toMatchObject({
      isAbility: true,
      sourceId,
      abilityKind: 'activated',
      defId: stacked.cards[sourceId].defId,
      zone: 'stack',
    });

    const resolved = applyCommand(stacked, { type: 'resolveStackTop' }).state;
    expect(resolved.cards[abilityId]).toBeUndefined();
    expect(resolved.zones.stack).toEqual([]);
  });

  it('resolves stack spells by card type', () => {
    const instant = makeDef({
      scryfallId: 'm427-instant',
      typeLine: 'Instant',
      faces: [{ name: 'm427-instant', typeLine: 'Instant', manaCost: '{U}' }],
    });
    const creature = makeDef({
      scryfallId: 'm427-creature',
      typeLine: 'Creature',
      faces: [{ name: 'm427-creature', typeLine: 'Creature', manaCost: '{2}{G}' }],
    });
    let state = drawCards(
      initGame(
        [
          { def: instant, isCommander: false },
          { def: creature, isCommander: false },
        ],
        1
      ),
      2
    );
    const instantId = Object.values(state.cards).find((card) => card.defId === 'm427-instant')!.id;
    const creatureId = Object.values(state.cards).find((card) => card.defId === 'm427-creature')!.id;

    state = applyCommand(state, { type: 'moveCard', cardId: instantId, to: 'stack', position: 'bottom' }).state;
    state = applyCommand(state, { type: 'moveCard', cardId: creatureId, to: 'stack', position: 'bottom' }).state;

    const creatureResolved = applyCommand(state, { type: 'resolveStackTop' }).state;
    expect(creatureResolved.cards[creatureId].zone).toBe('battlefield');
    expect(creatureResolved.cards[creatureId].enteredTurn).toBe(creatureResolved.turn);

    const instantResolved = applyCommand(creatureResolved, { type: 'resolveStackTop' }).state;
    expect(instantResolved.cards[instantId].zone).toBe('graveyard');
  });

  it('removes spells and abilities from the stack with the correct destination rules', () => {
    const spell = makeDef({
      scryfallId: 'm427-remove',
      typeLine: 'Sorcery',
      faces: [{ name: 'm427-remove', typeLine: 'Sorcery', manaCost: '{R}' }],
    });
    let state = drawCards(initGame([{ def: spell, isCommander: false }, ...makeDeck(4)], 1), 1);
    const spellId = Object.values(state.cards).find((card) => card.defId === 'm427-remove')!.id;
    state = applyCommand(state, { type: 'moveCard', cardId: spellId, to: 'stack', position: 'bottom' }).state;

    const removedSpell = applyCommand(state, {
      type: 'removeStackItem',
      id: spellId,
      to: 'hand',
    }).state;
    expect(removedSpell.cards[spellId].zone).toBe('hand');
    expect(removedSpell.zones.stack).toEqual([]);

    let abilityState = drawCards(initGame(makeDeck(6), 1), 1);
    const sourceId = abilityState.zones.hand[0];
    abilityState = applyCommand(abilityState, {
      type: 'moveCard',
      cardId: sourceId,
      to: 'battlefield',
      position: 'bottom',
    }).state;
    abilityState = applyCommand(abilityState, {
      type: 'addAbilityToStack',
      sourceId,
      kind: 'triggered',
    }).state;
    const abilityId = abilityState.zones.stack[0];

    const vanished = applyCommand(abilityState, {
      type: 'moveCard',
      cardId: abilityId,
      to: 'graveyard',
      position: 'top',
    }).state;
    expect(vanished.cards[abilityId]).toBeUndefined();
    expect(vanished.zones.stack).toEqual([]);
    expect(vanished.zones.graveyard).not.toContain(abilityId);
  });
});

describe('M4.27 store actions', () => {
  beforeEach(() => {
    useGameStore.setState({
      state: null,
      warnings: [],
      canUndo: false,
      canRedo: false,
      autoAdvanceToMain: true,
      mulliganDecisionPending: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('casts to the stack with auto-tap and undoes in a single step', () => {
    const mountain = makeDef({
      scryfallId: 'm427-mountain',
      typeLine: 'Basic Land — Mountain',
      producedMana: ['R'],
      faces: [{ name: 'm427-mountain', typeLine: 'Basic Land — Mountain' }],
    });
    const bolt = makeDef({
      scryfallId: 'm427-bolt',
      typeLine: 'Instant',
      faces: [{ name: 'm427-bolt', typeLine: 'Instant', manaCost: '{R}' }],
    });
    useGameStore.getState().newGame(
      [
        { def: mountain, isCommander: false },
        { def: bolt, isCommander: false },
        ...makeDeck(5),
      ],
      1
    );

    const mountainId = Object.values(useGameStore.getState().state!.cards).find(
      (card) => card.defId === 'm427-mountain'
    )!.id;
    const boltId = Object.values(useGameStore.getState().state!.cards).find(
      (card) => card.defId === 'm427-bolt'
    )!.id;

    useGameStore.getState().playLand(mountainId);
    useGameStore.getState().clearWarnings();

    expect(useGameStore.getState().castToStack(boltId)).toBe('ok');
    expect(useGameStore.getState().state!.cards[mountainId].tapped).toBe(true);
    expect(useGameStore.getState().state!.cards[boltId].zone).toBe('stack');

    useGameStore.getState().undo();
    expect(useGameStore.getState().state!.cards[mountainId].zone).toBe('battlefield');
    expect(useGameStore.getState().state!.cards[mountainId].tapped).toBe(false);
    expect(useGameStore.getState().state!.cards[boltId].zone).toBe('hand');
  });

  it('applies commander tax after a commander returns to the command zone', () => {
    const commander = makeDef({
      scryfallId: 'm427-commander',
      typeLine: 'Legendary Creature',
      faces: [{ name: 'm427-commander', typeLine: 'Legendary Creature', manaCost: '{1}{G}' }],
    });
    useGameStore.getState().newGame(makeDeck(5, [commander]), 1);
    const commanderId = useGameStore.getState().state!.commanders[0].cardId;

    useGameStore.getState().dispatch({ type: 'addMana', color: 'G', amount: 2 });
    expect(useGameStore.getState().castToStack(commanderId)).toBe('ok');
    expect(useGameStore.getState().state!.cards[commanderId].zone).toBe('stack');
    expect(useGameStore.getState().state!.commanders[0].castCount).toBe(0);

    useGameStore.getState().moveCard(commanderId, 'command', 'top');
    expect(useGameStore.getState().state!.commanders[0].castCount).toBe(1);
    useGameStore.getState().dispatch({ type: 'addMana', color: 'G', amount: 3 });
    expect(useGameStore.getState().castToStack(commanderId)).toEqual({ shortfall: 1 });
  });

  it('resolves the whole stack as a single undo step', () => {
    const instant = makeDef({
      scryfallId: 'm427-store-instant',
      typeLine: 'Instant',
      faces: [{ name: 'm427-store-instant', typeLine: 'Instant', manaCost: '{U}' }],
    });
    const creature = makeDef({
      scryfallId: 'm427-store-creature',
      typeLine: 'Creature',
      faces: [{ name: 'm427-store-creature', typeLine: 'Creature', manaCost: '{2}{G}' }],
    });
    useGameStore.getState().newGame(
      [
        { def: instant, isCommander: false },
        { def: creature, isCommander: false },
        ...makeDeck(5),
      ],
      1
    );

    const instantId = Object.values(useGameStore.getState().state!.cards).find(
      (card) => card.defId === 'm427-store-instant'
    )!.id;
    const creatureId = Object.values(useGameStore.getState().state!.cards).find(
      (card) => card.defId === 'm427-store-creature'
    )!.id;

    useGameStore.getState().moveCard(instantId, 'stack', 'bottom');
    useGameStore.getState().moveCard(creatureId, 'stack', 'bottom');
    const beforeResolve = JSON.stringify(useGameStore.getState().state);

    useGameStore.getState().resolveAll();
    expect(useGameStore.getState().state!.zones.stack).toEqual([]);
    expect(useGameStore.getState().state!.cards[creatureId].zone).toBe('battlefield');
    expect(useGameStore.getState().state!.cards[instantId].zone).toBe('graveyard');

    useGameStore.getState().undo();
    expect(JSON.stringify(useGameStore.getState().state)).toBe(beforeResolve);
  });

  it('adds ability objects to the stack through the store', () => {
    useGameStore.getState().newGame(makeDeck(8), 1);
    const sourceId = useGameStore.getState().state!.zones.hand[0];

    useGameStore.getState().moveCard(sourceId, 'battlefield', 'bottom');
    useGameStore.getState().addAbilityToStack(sourceId, 'triggered');

    const current = useGameStore.getState().state!;
    const abilityId = current.zones.stack[0];
    expect(current.cards[abilityId]).toMatchObject({
      isAbility: true,
      sourceId,
      abilityKind: 'triggered',
      zone: 'stack',
    });
  });
});
