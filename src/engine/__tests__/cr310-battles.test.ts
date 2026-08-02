import { describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from './helpers';
import { applyCommand, type GameCommand } from '../commands';
import { initGame } from '../init';
import { objectIdOf, DEFAULT_OPPONENT_ID, type GameState } from '../types';

function siegeDef(id: string, defense: string) {
  return makeDef({
    scryfallId: id,
    typeLine: 'Battle — Siege',
    layout: 'transform',
    faces: [
      { name: `${id} Front`, typeLine: 'Battle — Siege', defense },
      { name: `${id} Back`, typeLine: 'Enchantment' },
    ],
  });
}

function nonSiegeBattleDef(id: string, defense: string) {
  return makeDef({
    scryfallId: id,
    typeLine: 'Battle',
    faces: [{ name: id, typeLine: 'Battle', defense }],
  });
}

function creatureDef(id: string, power: string, toughness: string) {
  return makeDef({
    scryfallId: id,
    typeLine: 'Creature',
    faces: [{ name: id, typeLine: 'Creature', power, toughness }],
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

function setupBattlefield(defs: ReturnType<typeof makeDef>[]): GameState {
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

describe('CR 310 battles', () => {
  it('G1: Siege enters with defense counters and protector assigned to opponent', () => {
    const siege = siegeDef('invasion-of-gobakhan', '3');
    const state = setupBattlefield([siege]);
    const cardId = instanceId(state, siege.scryfallId);
    const card = state.cards[cardId];

    expect(card.counters.defense).toBe(3);
    expect(card.protectorId).toBe(DEFAULT_OPPONENT_ID);
  });

  it('G2: markDamage on a battle removes defense counters, not damageMarked', () => {
    const siege = siegeDef('siege-damage-test', '3');
    const source = creatureDef('damage-source', '2', '2');
    let state = setupBattlefield([siege, source]);
    const siegeId = instanceId(state, siege.scryfallId);
    const sourceId = instanceId(state, source.scryfallId);

    state = apply(state, [
      { type: 'dealDamage', sourceId, amount: 2, combatDamage: false, targetCardId: siegeId },
    ]);

    const card = state.cards[siegeId];
    expect(card.counters.defense).toBe(1);
    expect(card.damageMarked).toBe(0);
  });

  it('G3: defense reaching 0 on a Siege pushes a trigger; resolving exiles the battle', () => {
    const siege = siegeDef('siege-trigger-test', '1');
    const source = creatureDef('trigger-source', '1', '1');
    let state = setupBattlefield([siege, source]);
    const siegeId = instanceId(state, siege.scryfallId);
    const sourceId = instanceId(state, source.scryfallId);

    state = apply(state, [
      { type: 'dealDamage', sourceId, amount: 1, combatDamage: false, targetCardId: siegeId },
    ]);

    // Defense should be 0
    expect(state.cards[siegeId].counters.defense).toBe(0);

    // A pending trigger should exist for the siege
    const siegeTrigger = state.pendingTriggers.find(
      (trigger) => trigger.sourceId === siegeId,
    );
    expect(siegeTrigger).toBeDefined();
    expect(siegeTrigger?.triggerId).toBe('trigger.siege-defeated');

    // Put the trigger on the stack and resolve it
    state = apply(state, [
      {
        type: 'addAbilityToStack',
        sourceId: siegeId,
        kind: 'triggered',
        resolutionText: siegeTrigger?.resolutionText,
      },
    ]);
    state = apply(state, [{ type: 'resolveStackTop' }]);

    // Battle should be exiled
    expect(state.cards[siegeId].zone).toBe('exile');
  });

  it('G4: SBA 704.5v moves a 0-defense non-Siege battle to graveyard', () => {
    const battle = nonSiegeBattleDef('non-siege-battle', '1');
    const source = creatureDef('sba-source', '1', '1');
    let state = setupBattlefield([battle, source]);
    const battleId = instanceId(state, battle.scryfallId);
    const sourceId = instanceId(state, source.scryfallId);

    // Remove the last defense counter
    state = apply(state, [
      { type: 'dealDamage', sourceId, amount: 1, combatDamage: false, targetCardId: battleId },
    ]);

    // Non-Siege battle at 0 defense: no trigger fires, SBA sends to graveyard
    expect(state.cards[battleId].zone).toBe('graveyard');
  });

  it('G5: SBA 704.5x reassigns protector when controller is protector', () => {
    const siege = siegeDef('siege-protector-test', '3');
    let state = setupBattlefield([siege]);
    const siegeId = instanceId(state, siege.scryfallId);

    // Manually set protector to the controller (simulating an invalid state)
    state = apply(state, [
      { type: 'chooseBattleProtector', cardId: siegeId, protectorId: 'P1' },
    ]);

    // SBA 704.5x should have auto-reassigned to the opponent
    // (chooseBattleProtector triggers SBA stabilization)
    expect(state.cards[siegeId].protectorId).toBe(DEFAULT_OPPONENT_ID);
  });

  it('combat: unblocked attacker targeting a battle removes defense counters', () => {
    const siege = siegeDef('combat-siege', '3');
    const attacker = creatureDef('combat-attacker', '2', '2');
    let state = setupBattlefield([siege, attacker]);
    const siegeId = instanceId(state, siege.scryfallId);
    const attackerId = instanceId(state, attacker.scryfallId);
    const siegeObjectId = objectIdOf(state.cards[siegeId]);

    state = apply(state, [
      { type: 'enterCombat' },
      {
        type: 'declareAttackers',
        attackers: [
          {
            cardId: attackerId,
            target: { type: 'battle', playerId: DEFAULT_OPPONENT_ID, cardId: siegeId, objectId: siegeObjectId },
          },
        ],
      },
      { type: 'resolveCombatDamage' },
    ]);

    expect(state.cards[siegeId].counters.defense).toBe(1);
    expect(state.cards[siegeId].damageMarked).toBe(0);
  });

  it('chooseBattleProtector command sets protectorId', () => {
    const siege = siegeDef('protector-cmd-test', '3');
    let state = setupBattlefield([siege]);
    const siegeId = instanceId(state, siege.scryfallId);

    // Default protector is opponent
    expect(state.cards[siegeId].protectorId).toBe(DEFAULT_OPPONENT_ID);

    // Change protector (in 2-player this triggers 704.5x auto-reassign,
    // but setting to opponent again is valid)
    state = apply(state, [
      { type: 'chooseBattleProtector', cardId: siegeId, protectorId: DEFAULT_OPPONENT_ID },
    ]);
    expect(state.cards[siegeId].protectorId).toBe(DEFAULT_OPPONENT_ID);
  });

  it('I-BATTLE-3: damage to a battle never increases damageMarked', () => {
    const siege = siegeDef('invariant-damage', '5');
    const source = creatureDef('invariant-source', '3', '3');
    let state = setupBattlefield([siege, source]);
    const siegeId = instanceId(state, siege.scryfallId);
    const sourceId = instanceId(state, source.scryfallId);

    state = apply(state, [
      { type: 'dealDamage', sourceId, amount: 3, combatDamage: false, targetCardId: siegeId },
    ]);

    expect(state.cards[siegeId].damageMarked).toBe(0);
    expect(state.cards[siegeId].counters.defense).toBe(2);
  });

  it('I-BATTLE-4: a battle with defense > 0 is never moved to graveyard by SBA', () => {
    const siege = siegeDef('invariant-sba', '2');
    const source = creatureDef('invariant-sba-source', '1', '1');
    let state = setupBattlefield([siege, source]);
    const siegeId = instanceId(state, siege.scryfallId);
    const sourceId = instanceId(state, source.scryfallId);

    // Deal 1 damage: defense goes from 2 to 1, still on battlefield
    state = apply(state, [
      { type: 'dealDamage', sourceId, amount: 1, combatDamage: false, targetCardId: siegeId },
    ]);

    expect(state.cards[siegeId].zone).toBe('battlefield');
    expect(state.cards[siegeId].counters.defense).toBe(1);
  });
});
