/**
 * review.feel-1-guided-target.test.ts — Judge-owned review test for feel-1
 * guided target sweep (user ruling 2026-08-04 feel-queue-first).
 *
 * CR grounding (pinned CR 2026-06-19):
 * - 115.1/115.2: targets must be legal; guided prompts must never offer illegal targets.
 * - 115.6: choosing zero targets when "up to" allows is legal.
 * - 608.2h: honest execution; no guessing.
 *
 * Contract: research/cr-grounding/archive/feel-1-guided-target-sweep/contract.draft.md
 * Implementer agents do NOT modify this file. Fix the implementation instead.
 */
import { describe, expect, it } from 'vitest';

import { eligibleTargets, applyCommand } from '../commands';
import { compileAbilityIR } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';
import { initGame } from '../init';
import type { GameState } from '../types';
import { makeDeck, makeDef } from './helpers';
import type { CardDef } from '../../types/card';

function compile(text: string, typeLine = 'Instant') {
  const def = makeDef({ scryfallId: 'feel1-source', typeLine });
  return compileAbilityIR(parseAbilityIR(text, typeLine), {
    sourceId: 'feel1-source',
    controllerId: 'P1',
    def,
  });
}

function firstTargetPrompt(result: ReturnType<typeof compile>) {
  return result.prompts.find((p) => p.kind === 'target') ?? null;
}

// --- Battlefield fixture helpers ---

function creatureDef(id: string, opts: { mv?: number; token?: boolean } = {}): CardDef {
  return makeDef({
    scryfallId: id,
    typeLine: 'Creature',
    cmc: opts.mv ?? 2,
    faces: [{ name: id, typeLine: 'Creature', power: '2', toughness: '2' }],
  });
}

function battlefield(state: GameState, defId: string): { state: GameState; id: string } {
  const card = Object.values(state.cards).find((c) => c.defId === defId);
  if (!card) throw new Error(`missing ${defId}`);
  const next = applyCommand(state, {
    type: 'moveCard',
    cardId: card.id,
    to: 'battlefield',
    position: 'bottom',
  }).state;
  return { state: next, id: card.id };
}

describe('review feel-1: guided target filter grammar sweep', () => {
  // --- R1: regression pins (existing guided forms must not change) ---

  it('R1: "Destroy target creature." stays guided with creature filter', () => {
    const r = compile('Destroy target creature.');
    expect(r.decision).toBe('guided');
    const p = firstTargetPrompt(r);
    expect(p?.filter?.types).toEqual(['creature']);
  });

  it('R2: "Counter target spell" stays guided with stack filter', () => {
    const r = compile('Counter target spell');
    expect(r.decision).toBe('guided');
    const p = firstTargetPrompt(r);
    expect(p?.filter?.zone).toBe('stack');
  });

  it('R3: "Put a +1/+1 counter on target creature." stays guided', () => {
    const r = compile('Put a +1/+1 counter on target creature.');
    expect(r.decision).toBe('guided');
    expect(firstTargetPrompt(r)?.filter?.types).toEqual(['creature']);
  });

  it('R4: "Destroy target creature you control." keeps controller=you', () => {
    const r = compile('Destroy target creature you control.');
    expect(r.decision).toBe('guided');
    const p = firstTargetPrompt(r);
    expect(p?.filter?.controller).toBe('you');
    expect(p?.filter?.types).toEqual(['creature']);
  });

  // --- R5: up-to-N support ---

  it('R5: "Exile up to one target permanent." is guided with minCount 0', () => {
    const r = compile('Exile up to one target permanent.');
    expect(r.decision).toBe('guided');
    const p = firstTargetPrompt(r);
    expect(p?.filter?.types).toEqual(['permanent']);
    expect(p?.minCount).toBe(0);
    expect(p?.count).toBe(1);
  });

  // --- R6: mana value ceiling survives controller modifier (CR 115 legality) ---

  it('R6: "Exile target permanent you don\'t control with mana value 3 or less." retains maxManaValue', () => {
    const r = compile("Exile target permanent you don't control with mana value 3 or less.");
    expect(r.decision).toBe('guided');
    const p = firstTargetPrompt(r);
    expect(p?.filter?.controller).toBe('opponent');
    expect(p?.filter?.maxManaValue).toBe(3);
  });

  it('R7: Skyclave shape — up-to-one + nonland nontoken + opponent + mv2 is fully guided', () => {
    const r = compile(
      "Exile up to one target nonland, nontoken permanent you don't control with mana value 2 or less.",
    );
    expect(r.decision).toBe('guided');
    const p = firstTargetPrompt(r);
    expect(p?.minCount).toBe(0);
    expect(p?.filter?.excludedTypes).toContain('land');
    expect(p?.filter?.excludeTokens).toBe(true);
    expect(p?.filter?.controller).toBe('opponent');
    expect(p?.filter?.maxManaValue).toBe(2);
  });

  // --- R8: graveyard return grammar ---

  it('R8: "Return target card from your graveyard to your hand." is guided with graveyard zone', () => {
    const r = compile('Return target card from your graveyard to your hand.');
    expect(r.decision).toBe('guided');
    const p = firstTargetPrompt(r);
    expect(p?.filter?.zone).toBe('graveyard');
  });

  // --- R9: eligibleTargets end-to-end (mv ceiling excludes illegal targets) ---

  it('R9: maxManaValue filter excludes permanents above the ceiling', () => {
    const small = creatureDef('feel1-small', { mv: 2 });
    const big = creatureDef('feel1-big', { mv: 5 });
    let state = initGame([{ def: small, isCommander: false }, { def: big, isCommander: false }, ...makeDeck(4)], 1);
    ({ state } = battlefield(state, 'feel1-small'));
    ({ state } = battlefield(state, 'feel1-big'));
    const ids = eligibleTargets(
      state,
      { types: ['creature'], maxManaValue: 3 },
      { controllerId: 'P1' },
    );
    const smallId = Object.values(state.cards).find((c) => c.defId === 'feel1-small')?.id;
    const bigId = Object.values(state.cards).find((c) => c.defId === 'feel1-big')?.id;
    expect(ids).toContain(smallId);
    expect(ids).not.toContain(bigId);
  });

  // --- R10: fail-closed (compound with unsupported clause stays manual) ---

  it('R10: compound with unsupported search clause stays manual (no partial execution)', () => {
    const r = compile(
      'Exile target creature. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle.',
    );
    expect(r.decision).toBe('manual');
    expect(r.prompts.length).toBe(0);
  });

  it('R11: unrecognizable target phrase stays manual', () => {
    const r = compile('Target player reveals their hand. You choose a card from it.');
    expect(r.decision).toBe('manual');
  });

  // --- R12: CR 608.2c clause-order fail-closed guard (cold-audit finding F1) ---

  it('R12: target clause followed by an immediate-command clause stays manual (order fidelity)', () => {
    // The guided runtime applies immediate commands before prompt-derived commands, so a
    // target clause with any later immediate-command clause would execute out of oracle
    // order (Plunge into Winter shape: the immediate draw ran before the target/scry
    // prompts resolved). Fail closed to manual (cold-audit F1, CR 608.2c).
    const r = compile('Tap up to one target creature. Scry 1, then draw a card.');
    expect(r.decision).toBe('manual');
    expect(r.reasons).toContain('needs-parse');
    const r2 = compile('Destroy target artifact. Create two Treasure tokens.');
    expect(r2.decision).toBe('manual');
  });

  it('R12b: prompt-only compounds stay guided (no immediate commands to reorder)', () => {
    const r = compile('Destroy up to one target artifact. Put a +1/+1 counter on up to one target creature.');
    expect(r.decision).toBe('guided');
    expect(r.prompts.filter((p) => p.kind === 'target')).toHaveLength(2);
  });
});
