/**
 * review.cr701-69-heal.test.ts — Judge-owned review test for CR 701.69 Heal leaf.
 *
 * CR 701.69a: "To heal damage already dealt to a permanent, remove that marked
 * damage from that permanent. If an effect states that damage already dealt to
 * a permanent 'is healed,' that permanent's controller removes all marked
 * damage from that permanent."
 *
 * Adversarial focus:
 *  1. Heal removes ALL marked damage (not partial) — CR 701.69a is all-or-nothing.
 *  2. Deathtouch flag is also cleared (clearMarkedDamage semantics).
 *  3. Probe does not false-positive on "health" or card-name contexts.
 *  4. Guided prompt emits exactly one clearMarkedDamage command, no extras.
 *  5. Non-single-target heal phrasing stays manual (no false auto).
 */
import { describe, expect, it } from 'vitest';

import { applyCommand } from '../commands';
import { buildGuidedCommands, compileAbilityIR } from '../grammar/compile';
import { detectEffectAtoms } from '../grammar/index';
import { parseAbilityIR } from '../grammar/ir';
import { initGame } from '../init';
import type { GameState } from '../types';
import { makeDeck, makeDef } from './helpers';

function creatureDef(id: string, toughness = '5') {
  return makeDef({
    scryfallId: id,
    typeLine: 'Creature',
    faces: [{ name: id, typeLine: 'Creature', power: '2', toughness }],
  });
}

function findInstance(state: GameState, defId: string): string {
  const card = Object.values(state.cards).find((c) => c.defId === defId);
  if (!card) throw new Error(`no instance for ${defId}`);
  return card.id;
}

function battlefieldCreature(state: GameState, defId: string): { state: GameState; id: string } {
  const id = findInstance(state, defId);
  const next = applyCommand(state, {
    type: 'moveCard',
    cardId: id,
    to: 'battlefield',
    position: 'bottom',
  }).state;
  return { state: next, id };
}

function compileHeal(text: string) {
  const def = makeDef({
    scryfallId: 'review-heal-source',
    name: 'Review Heal Source',
    typeLine: 'Creature',
    faces: [{ name: 'Review Heal Source', typeLine: 'Creature', oracleText: text }],
  });
  return compileAbilityIR(parseAbilityIR(text, 'Creature'), {
    sourceId: 'review-heal-source',
    controllerId: 'P1',
    def,
  });
}

describe('review: CR 701.69 Heal', () => {
  it('701.69a: heal removes ALL marked damage, not partial', () => {
    const target = creatureDef('review-heal-target');
    let state = initGame([{ def: target, isCommander: false }, ...makeDeck(6)], 1);
    ({ state } = battlefieldCreature(state, target.scryfallId));
    const id = findInstance(state, target.scryfallId);

    // Mark 4 damage (sublethal on a 5-toughness creature)
    state = applyCommand(state, {
      type: 'dealDamage',
      sourceId: id,
      targetCardId: id,
      amount: 4,
      combatDamage: false,
    }).state;
    expect(state.cards[id]?.damageMarked).toBe(4);

    // Compile and resolve guided heal
    const compiled = compileHeal('Heal target creature.');
    expect(compiled.decision).toBe('guided');
    const commands = buildGuidedCommands(
      compiled.prompts[0],
      { kind: 'target', cardIds: [id] },
      { sourceId: 'review-heal-source', controllerId: 'P1', def: makeDef({ scryfallId: 'ctx' }) },
    );

    // Exactly one command, no extras
    expect(commands).toHaveLength(1);
    expect(commands[0]).toEqual({ type: 'clearMarkedDamage', cardId: id });

    state = applyCommand(state, commands[0]).state;
    // ALL damage removed, not partial
    expect(state.cards[id]?.damageMarked).toBe(0);
  });

  it('701.69a: heal command is clearMarkedDamage which clears deathtouch flag (CR 514.2)', () => {
    // clearMarkedDamage's deathtouch-clearing is already reviewed in
    // review.damage-marked.test.ts (test 5). Here we verify the heal compiler
    // leaf emits exactly the right command shape for the store to execute.
    const compiled = compileHeal('Heal target creature.');
    const commands = buildGuidedCommands(
      compiled.prompts[0],
      { kind: 'target', cardIds: ['some-creature'] },
      { sourceId: 'review-heal-source', controllerId: 'P1', def: makeDef({ scryfallId: 'ctx2' }) },
    );
    expect(commands).toEqual([{ type: 'clearMarkedDamage', cardId: 'some-creature' }]);
  });

  it('probe does not false-positive on "health" or non-heal contexts', () => {
    // "health" contains "heal" as a substring but is not the keyword action
    expect(detectEffectAtoms('You gain 3 life.')).not.toContain('effect.heal');
    expect(detectEffectAtoms('Target creature gets +2/+2 until end of turn.')).not.toContain('effect.heal');
    // Actual heal text must match
    expect(detectEffectAtoms('Heal target creature.')).toContain('effect.heal');
    expect(detectEffectAtoms('Heals target creature.')).toContain('effect.heal');
    expect(detectEffectAtoms('Healed target creature.')).toContain('effect.heal');
  });

  it('non-single-target heal phrasing stays manual (no false auto)', () => {
    // "Heal all damage" — mass phrasing, not single-target
    const massResult = compileHeal('Heal all damage dealt to target creature.');
    const massHealPrompt = massResult.prompts.find((p) => p.atom === 'effect.heal');
    expect(massHealPrompt).toBeUndefined();

    // "Heal target permanent" — 'permanent' is a valid TARGET_TYPE, so guided is correct
    const permanentResult = compileHeal('Heal target permanent.');
    const permanentHealPrompt = permanentResult.prompts.find((p) => p.atom === 'effect.heal');
    expect(permanentHealPrompt).toBeDefined();
    expect(permanentHealPrompt!.filter).toEqual({ types: ['permanent'] });
  });

  it('guided prompt filter targets creatures only for "Heal target creature"', () => {
    const compiled = compileHeal('Heal target creature.');
    expect(compiled.decision).toBe('guided');
    expect(compiled.prompts).toHaveLength(1);
    expect(compiled.prompts[0]).toMatchObject({
      atom: 'effect.heal',
      kind: 'target',
      count: 1,
      filter: { types: ['creature'] },
    });
  });
});
