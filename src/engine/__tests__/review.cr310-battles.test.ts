/**
 * Judge-owned review test for CR 310 Battles.
 * Pins golden cases G1–G5 and invariants I-BATTLE-1..4 from the contract
 * (research/cr-grounding/cr-310-battles.draft.md).
 *
 * CR refs: 310.4b, 310.6, 310.8a, 310.11a, 310.11b, 704.5v, 704.5w, 704.5x
 */
import { describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from './helpers';
import { applyCommand, performStateBasedActions, type GameCommand } from '../commands';
import { initGame } from '../init';
import { objectIdOf, DEFAULT_OPPONENT_ID, LOCAL_PLAYER_ID, type GameState } from '../types';

// --- fixtures ---

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

function plainBattleDef(id: string, defense: string) {
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

// --- helpers ---

function findInstance(state: GameState, defId: string): string {
  const card = Object.values(state.cards).find((c) => c.defId === defId);
  if (!card) throw new Error(`no instance for defId=${defId}`);
  return card.id;
}

function apply(state: GameState, cmds: readonly GameCommand[]): GameState {
  return cmds.reduce((s, cmd) => applyCommand(s, cmd).state, state);
}

function setup(defs: ReturnType<typeof makeDef>[]): GameState {
  let state = initGame([...defs.map((d) => ({ def: d, isCommander: false })), ...makeDeck(8)], 1);
  for (const d of defs) {
    state = applyCommand(state, {
      type: 'moveCard',
      cardId: findInstance(state, d.scryfallId),
      to: 'battlefield',
      position: 'bottom',
    }).state;
  }
  return state;
}

// --- tests ---

describe('review: CR 310 battles', () => {
  describe('G1: Siege ETB — defense counters + protector', () => {
    it('enters with defense counters equal to printed defense', () => {
      const siege = siegeDef('gobakhan', '3');
      const state = setup([siege]);
      const card = state.cards[findInstance(state, 'gobakhan')];
      expect(card.counters.defense).toBe(3);
    });

    it('protector is the opponent (CR 310.11a)', () => {
      const siege = siegeDef('gobakhan-prot', '3');
      const state = setup([siege]);
      const card = state.cards[findInstance(state, 'gobakhan-prot')];
      expect(card.protectorId).toBe(DEFAULT_OPPONENT_ID);
      expect(card.protectorId).not.toBe(card.controllerId);
    });
  });

  describe('G2: damage removes defense counters (CR 310.6)', () => {
    it('dealDamage reduces defense, never damageMarked', () => {
      const siege = siegeDef('dmg-siege', '5');
      const src = creatureDef('dmg-src', '3', '3');
      let state = setup([siege, src]);
      const siegeId = findInstance(state, 'dmg-siege');
      const srcId = findInstance(state, 'dmg-src');

      state = apply(state, [
        { type: 'dealDamage', sourceId: srcId, amount: 3, combatDamage: false, targetCardId: siegeId },
      ]);

      const card = state.cards[siegeId];
      expect(card.counters.defense).toBe(2);
      expect(card.damageMarked).toBe(0); // I-BATTLE-3
    });
  });

  describe('G3: Siege defeated trigger (CR 310.11b)', () => {
    it('last counter removed → trigger on stack → exile on resolution', () => {
      const siege = siegeDef('trigger-siege', '1');
      const src = creatureDef('trigger-src', '1', '1');
      let state = setup([siege, src]);
      const siegeId = findInstance(state, 'trigger-siege');
      const srcId = findInstance(state, 'trigger-src');

      state = apply(state, [
        { type: 'dealDamage', sourceId: srcId, amount: 1, combatDamage: false, targetCardId: siegeId },
      ]);

      // defense is 0
      expect(state.cards[siegeId].counters.defense).toBe(0);

      // trigger exists
      const trigger = state.pendingTriggers.find((t) => t.sourceId === siegeId);
      expect(trigger).toBeDefined();
      expect(trigger!.triggerId).toBe('trigger.siege-defeated');

      // put on stack and resolve
      state = apply(state, [
        {
          type: 'addAbilityToStack',
          sourceId: siegeId,
          kind: 'triggered',
          resolutionText: trigger!.resolutionText,
        },
        { type: 'resolveStackTop' },
      ]);

      expect(state.cards[siegeId].zone).toBe('exile');
    });
  });

  describe('G4: SBA 704.5v — non-Siege battle at 0 defense → graveyard', () => {
    it('non-Siege battle with 0 defense goes to graveyard', () => {
      const battle = plainBattleDef('plain-battle', '1');
      const src = creatureDef('sba-src', '1', '1');
      let state = setup([battle, src]);
      const battleId = findInstance(state, 'plain-battle');
      const srcId = findInstance(state, 'sba-src');

      state = apply(state, [
        { type: 'dealDamage', sourceId: srcId, amount: 1, combatDamage: false, targetCardId: battleId },
      ]);

      // No trigger for non-Siege → SBA sends to graveyard
      expect(state.cards[battleId].zone).toBe('graveyard');
    });
  });

  describe('G5: SBA 704.5x — Siege controller-as-protector corrected', () => {
    it('auto-reassigns protector to opponent', () => {
      const siege = siegeDef('x-siege', '3');
      let state = setup([siege]);
      const siegeId = findInstance(state, 'x-siege');

      // Force invalid state: controller is protector
      state = apply(state, [
        { type: 'chooseBattleProtector', cardId: siegeId, protectorId: LOCAL_PLAYER_ID },
      ]);

      // SBA 704.5x should have corrected it
      expect(state.cards[siegeId].protectorId).toBe(DEFAULT_OPPONENT_ID);
    });
  });

  describe('combat: unblocked attacker vs battle', () => {
    it('removes defense counters equal to power', () => {
      const siege = siegeDef('combat-siege', '4');
      const atk = creatureDef('combat-atk', '2', '2');
      let state = setup([siege, atk]);
      const siegeId = findInstance(state, 'combat-siege');
      const atkId = findInstance(state, 'combat-atk');
      const siegeObjId = objectIdOf(state.cards[siegeId]);

      state = apply(state, [
        { type: 'enterCombat' },
        {
          type: 'declareAttackers',
          attackers: [{
            cardId: atkId,
            target: { type: 'battle', playerId: DEFAULT_OPPONENT_ID, cardId: siegeId, objectId: siegeObjId },
          }],
        },
        { type: 'resolveCombatDamage' },
      ]);

      expect(state.cards[siegeId].counters.defense).toBe(2);
      expect(state.cards[siegeId].damageMarked).toBe(0);
    });
  });

  describe('invariants', () => {
    it('I-BATTLE-1: defense counters never negative', () => {
      const siege = siegeDef('inv-neg', '1');
      const src = creatureDef('inv-neg-src', '5', '5');
      let state = setup([siege, src]);
      const siegeId = findInstance(state, 'inv-neg');
      const srcId = findInstance(state, 'inv-neg-src');

      // Overkill damage
      state = apply(state, [
        { type: 'dealDamage', sourceId: srcId, amount: 5, combatDamage: false, targetCardId: siegeId },
      ]);

      expect(state.cards[siegeId].counters.defense).toBe(0);
    });

    it('I-BATTLE-4: battle with defense > 0 stays on battlefield after SBA', () => {
      const siege = siegeDef('inv-stay', '3');
      const src = creatureDef('inv-stay-src', '1', '1');
      let state = setup([siege, src]);
      const siegeId = findInstance(state, 'inv-stay');
      const srcId = findInstance(state, 'inv-stay-src');

      state = apply(state, [
        { type: 'dealDamage', sourceId: srcId, amount: 1, combatDamage: false, targetCardId: siegeId },
      ]);

      // Run SBA explicitly
      const result = performStateBasedActions(state);
      expect(result.state.cards[siegeId].zone).toBe('battlefield');
      expect(result.state.cards[siegeId].counters.defense).toBe(2);
    });
  });
});
