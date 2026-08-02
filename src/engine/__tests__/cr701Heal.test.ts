import { describe, expect, it } from 'vitest';

import { applyCommand } from '../commands';
import { buildGuidedCommands, compileAbilityIR } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';
import { initGame } from '../init';
import type { GameState } from '../types';
import { makeDeck, makeDef } from './helpers';

function healCreature(id: string, toughness = '5') {
  return makeDef({
    scryfallId: id,
    typeLine: 'Creature',
    faces: [{ name: id, typeLine: 'Creature', power: '2', toughness }],
  });
}

function instanceId(state: GameState, defId: string): string {
  const card = Object.values(state.cards).find((entry) => entry.defId === defId);
  if (!card) {
    throw new Error(`missing instance for ${defId}`);
  }
  return card.id;
}

describe('CR 701.69 Heal integration', () => {
  it('clears marked damage on a creature via guided heal prompt', () => {
    const target = healCreature('heal-int-target');
    let state = initGame(
      [{ def: target, isCommander: false }, ...makeDeck(6)],
      1,
    );

    // Move creature to battlefield
    const targetId = instanceId(state, target.scryfallId);
    state = applyCommand(state, {
      type: 'moveCard',
      cardId: targetId,
      to: 'battlefield',
      position: 'bottom',
    }).state;

    // Deal 2 damage to mark it
    state = applyCommand(state, {
      type: 'dealDamage',
      sourceId: targetId,
      targetCardId: targetId,
      amount: 2,
      combatDamage: false,
    }).state;

    expect(state.cards[targetId]?.damageMarked).toBe(2);

    // Compile "Heal target creature." via grammar compiler
    const def = makeDef({
      scryfallId: 'heal-int-source',
      name: 'Heal Source',
      typeLine: 'Creature',
      faces: [{ name: 'Heal Source', typeLine: 'Creature', oracleText: 'Heal target creature.' }],
    });
    const ir = parseAbilityIR('Heal target creature.', 'Creature');
    const compiled = compileAbilityIR(ir, {
      sourceId: 'heal-int-source',
      controllerId: 'P1',
      def,
    });

    expect(compiled.decision).toBe('guided');
    expect(compiled.prompts).toHaveLength(1);

    // Resolve the guided prompt with the damaged creature's cardId
    const commands = buildGuidedCommands(
      compiled.prompts[0],
      { kind: 'target', cardIds: [targetId] },
      { sourceId: 'heal-int-source', controllerId: 'P1', def },
    );

    expect(commands).toHaveLength(1);
    expect(commands[0]).toEqual({ type: 'clearMarkedDamage', cardId: targetId });

    // Apply the resulting command
    state = applyCommand(state, commands[0]).state;

    // Assert damage is cleared
    expect(state.cards[targetId]?.damageMarked).toBe(0);
  });
});
