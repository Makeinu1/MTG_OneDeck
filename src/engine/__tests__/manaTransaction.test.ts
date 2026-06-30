import { describe, expect, it } from 'vitest';

import {
  collectTriggeredManaAbilities,
  resolveManaAbilityTransaction,
} from '../manaTransaction';
import { applyCommand } from '../commands';
import { initGame } from '../init';
import type { GameState, ManaAddedEvent } from '../types';
import { objectIdOf } from '../types';
import { makeDef, makeDeck } from './helpers';

function findInstanceId(state: GameState, defId: string): string {
  const card = Object.values(state.cards).find((entry) => entry.defId === defId);
  if (!card) {
    throw new Error(`card instance not found for ${defId}`);
  }
  return card.id;
}

function moveToBattlefield(state: GameState, cardId: string): GameState {
  return applyCommand(state, {
    type: 'moveCard',
    cardId,
    to: 'battlefield',
    position: 'bottom',
  }).state;
}

function stateWithManaWatcher(oracleText: string): { state: GameState; landId: string } {
  const land = makeDef({
    scryfallId: 'mana-land',
    typeLine: 'Land',
    producedMana: ['G'],
    faces: [
      {
        name: 'Mana Land',
        typeLine: 'Land',
        oracleText: '{T}: Add {G}.',
      },
    ],
  });
  const watcher = makeDef({
    scryfallId: 'mana-watcher',
    typeLine: 'Enchantment',
    faces: [
      {
        name: 'Mana Watcher',
        typeLine: 'Enchantment',
        oracleText,
      },
    ],
  });
  let state = initGame(
    [
      { def: land, isCommander: false },
      { def: watcher, isCommander: false },
      ...makeDeck(8),
    ],
    1,
  );
  const landId = findInstanceId(state, land.scryfallId);
  const watcherId = findInstanceId(state, watcher.scryfallId);
  state = moveToBattlefield(state, landId);
  state = moveToBattlefield(state, watcherId);
  return { state, landId };
}

describe('mana ability transaction (CR 605)', () => {
  it('resolves triggered mana abilities to a fixed point without pendingTriggers or stack', () => {
    const { state, landId } = stateWithManaWatcher(
      'Whenever a player taps a land for mana, that player adds one mana of any type that land produced.',
    );

    const result = resolveManaAbilityTransaction(state, {
      sourceId: landId,
      commands: [
        { type: 'setTapped', cardId: landId, tapped: true },
        { type: 'addMana', color: 'G', amount: 1 },
      ],
    });

    expect(result.state.manaPool.G).toBe(2);
    expect(result.state.pendingTriggers).toEqual([]);
    expect(result.state.zones.stack).toEqual([]);
    expect(result.manaEvents).toHaveLength(2);
    expect(result.log).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'resolved-triggered-mana-ability' }),
      ]),
    );
  });

  it('stops the fixed-point loop at the transaction cap and leaves a warning', () => {
    const { state, landId } = stateWithManaWatcher('Whenever you add mana, add {G}.');

    const result = resolveManaAbilityTransaction(state, {
      sourceId: landId,
      commands: [
        { type: 'setTapped', cardId: landId, tapped: true },
        { type: 'addMana', color: 'G', amount: 1 },
      ],
      iterationCap: 3,
    });

    expect(result.state.manaPool.G).toBe(4);
    expect(result.warnings.some((warning) => warning.includes('上限'))).toBe(true);
    expect(result.log).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'iteration-cap' })]),
    );
  });

  it('does not classify targeted add-mana triggers as CR 605.1b mana abilities', () => {
    const { state, landId } = stateWithManaWatcher(
      'Whenever a land is tapped for mana, target player adds {G}.',
    );
    const land = state.cards[landId];
    const landSnapshot = {
      physicalCardId: land.id,
      objectId: objectIdOf(land),
      defId: land.defId,
      zone: land.zone,
      ownerId: land.ownerId,
      controllerId: land.controllerId,
      isToken: land.isToken,
      isCommander: land.isCommander,
      faceIndex: land.faceIndex,
      tapped: land.tapped,
      counters: { ...land.counters },
      typeLine: 'Land',
    };
    const manaEvent: ManaAddedEvent = {
      type: 'manaAdded',
      eventId: 'mana-test',
      sequence: 1,
      playerId: 'P1',
      sourceObjectId: landSnapshot.objectId,
      sourceSnapshot: landSnapshot,
      amount: { W: 0, U: 0, B: 0, R: 0, G: 1, C: 0 },
    };

    expect(collectTriggeredManaAbilities(state, [manaEvent])).toEqual([]);
  });
});
