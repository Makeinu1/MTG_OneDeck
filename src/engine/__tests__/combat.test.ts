import { describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from './helpers';
import { applyCommand, type GameCommand } from '../commands';
import { initGame } from '../init';
import { objectIdOf, type GameState } from '../types';

function combatCreature(id: string, power: string, toughness: string, oracleText = '') {
  return makeDef({
    scryfallId: id,
    typeLine: 'Creature',
    faces: [
      {
        name: id,
        typeLine: 'Creature',
        power,
        toughness,
        oracleText,
      },
    ],
  });
}

function instanceId(state: GameState, defId: string): string {
  const card = Object.values(state.cards).find((entry) => entry.defId === defId);
  if (!card) throw new Error(`missing instance for ${defId}`);
  return card.id;
}

function apply(state: GameState, commands: readonly GameCommand[]): GameState {
  return commands.reduce((current, command) => applyCommand(current, command).state, state);
}

function battlefieldState(defs: ReturnType<typeof combatCreature>[]): GameState {
  let state = initGame([...defs.map((def) => ({ def, isCommander: false })), ...makeDeck(8)], 1);
  for (const def of defs) {
    state = applyCommand(state, {
      type: 'moveCard',
      cardId: instanceId(state, def.scryfallId),
      to: 'battlefield',
      position: 'bottom',
    }).state;
  }
  return state;
}

describe('combat commands', () => {
  it('records attackers and taps only non-vigilance attackers', () => {
    const bear = combatCreature('combat-bear', '2', '2');
    const sentinel = combatCreature('combat-vigilance', '2', '2', 'Vigilance');
    let state = battlefieldState([bear, sentinel]);
    const bearId = instanceId(state, bear.scryfallId);
    const sentinelId = instanceId(state, sentinel.scryfallId);
    const bearObjectId = objectIdOf(state.cards[bearId]);

    state = apply(state, [
      { type: 'enterCombat' },
      {
        type: 'declareAttackers',
        attackers: [{ cardId: bearId }, { cardId: sentinelId }],
      },
    ]);

    expect(state.phase).toBe('combat');
    expect(state.cards[bearId].tapped).toBe(true);
    expect(state.cards[sentinelId].tapped).toBe(false);
    expect(state.combat?.attackers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cardId: bearId,
          objectId: bearObjectId,
          blockedBy: [],
          declaredOrder: 0,
        }),
      ]),
    );
  });

  it('marks reciprocal single-blocker combat damage before one SBA pass', () => {
    const attacker = combatCreature('combat-2-2-attacker', '2', '2');
    const blocker = combatCreature('combat-2-2-blocker', '2', '2');
    let state = battlefieldState([attacker, blocker]);
    const attackerId = instanceId(state, attacker.scryfallId);
    const blockerId = instanceId(state, blocker.scryfallId);

    state = apply(state, [
      { type: 'enterCombat' },
      { type: 'declareAttackers', attackers: [{ cardId: attackerId }] },
      { type: 'declareBlockers', blockers: [{ cardId: blockerId, attackerId }] },
      { type: 'resolveCombatDamage' },
    ]);

    const sbaEvents = state.eventLog.filter(
      (event) =>
        (event.physicalCardId === attackerId || event.physicalCardId === blockerId) &&
        event.reason === 'sba' &&
        event.sbaApplied === '704.5g',
    );
    expect(state.cards[attackerId].zone).toBe('graveyard');
    expect(state.cards[blockerId].zone).toBe('graveyard');
    expect(sbaEvents).toHaveLength(2);
    expect(new Set(sbaEvents.map((event) => event.simultaneousGroupId)).size).toBe(1);
  });

  it('clears combat when the phase leaves combat', () => {
    const attacker = combatCreature('combat-phase-attacker', '1', '1');
    let state = battlefieldState([attacker]);

    state = applyCommand(state, { type: 'enterCombat' }).state;
    expect(state.combat).not.toBeNull();

    state = applyCommand(state, { type: 'nextPhase' }).state;
    expect(state.phase).toBe('main2');
    expect(state.combat).toBeNull();
  });
});
