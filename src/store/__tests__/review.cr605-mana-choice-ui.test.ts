import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import type { ManaColor } from '../../types/card';
import {
  buildGuidedCommands,
  compileAbilityIR,
  type CompileContext,
} from '../../engine/grammar/compile';
import { parseAbilityIR } from '../../engine/grammar/ir';
import { useGameStore } from '../gameStore';

/**
 * Review pins (judge-owned) for cr-605-mana-choice-ui.
 *
 * Contract under test:
 *   CR 605.1  — mana ability: activated ability that adds mana, no target, not loyalty
 *   CR 605.3b — mana abilities resolve without using the stack
 *   CR 106.7  — some abilities produce mana of a chosen color
 *
 * The guided mana prompt flow (compiler → pendingGuided → confirmGuidedMana)
 * and the tapForMana shortcut flow (needs-choice → ManaChoiceDialog) are pinned.
 *
 * These assertions are behavioral (public store/compiler API + zone outcomes)
 * so they bind the contract, not an implementation's internal field names.
 */

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

function cardDef(overrides: Record<string, unknown> = {}) {
  return makeDef({
    scryfallId: 'mana-choice-source',
    typeLine: 'Land',
    ...overrides,
  });
}

function compileCtx(): CompileContext {
  return {
    sourceId: 'c1',
    def: cardDef(),
    commanderColorIdentity: [],
  };
}

function compile(line: string, ctx = compileCtx()) {
  return compileAbilityIR(parseAbilityIR(line, 'Land'), ctx);
}

describe('review.cr605-mana-choice-ui: compiler guided mana prompts (CR 605.1/106.7)', () => {
  it('"Add one mana of any color" produces a guided mana prompt with 5 options', () => {
    const result = compile('{T}: Add one mana of any color.');
    expect(result.decision).toBe('guided');
    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0]).toMatchObject({
      kind: 'mana',
      count: 1,
      manaOptions: ['W', 'U', 'B', 'R', 'G'],
    });
  });

  it('"Add two mana of any one color" produces count=2 guided prompt', () => {
    const result = compile('{T}: Add two mana of any one color.');
    expect(result.decision).toBe('guided');
    expect(result.prompts[0]).toMatchObject({ kind: 'mana', count: 2 });
  });

  it('commander color identity restricts mana options', () => {
    const ctx: CompileContext = {
      sourceId: 'c1',
      def: cardDef(),
      commanderColorIdentity: ['U', 'B'] as ManaColor[],
    };
    const result = compile(
      "{T}: Add one mana of any color in your commander's color identity.",
      ctx,
    );
    expect(result.decision).toBe('guided');
    expect(result.prompts[0]).toMatchObject({
      kind: 'mana',
      manaOptions: ['U', 'B'],
    });
  });

  it('"Add one mana of the chosen color" (CR 607.2 linked) produces guided prompt', () => {
    const result = compile('{T}: Add one mana of the chosen color.');
    expect(result.decision).toBe('guided');
    expect(result.prompts[0]).toMatchObject({ kind: 'mana', count: 1 });
  });

  it('"Add five mana in any combination of colors" produces guided prompt', () => {
    const result = compile('{5}, {T}: Add five mana in any combination of colors.');
    expect(result.decision).toBe('guided');
    expect(result.prompts[0]).toMatchObject({ kind: 'mana', count: 5 });
  });

  it('restricted mana stays manual (no fake guided)', () => {
    const result = compile(
      '{T}: Add one mana of any color. Spend this mana only to cast creature spells.',
    );
    expect(result.decision).toBe('manual');
    expect(result.prompts).toEqual([]);
  });

  it('variable-count mana stays manual (no fake guided)', () => {
    const result = compile(
      '{T}: Add X mana in any combination of colors, where X is the number of creatures you control.',
    );
    expect(result.decision).toBe('manual');
    expect(result.prompts).toEqual([]);
  });

  it('buildGuidedCommands maps mana answer to addMana command', () => {
    const result = compile('{T}: Add one mana of any color.');
    const prompt = result.prompts[0];
    const commands = buildGuidedCommands(prompt, { kind: 'mana', color: 'G' }, compileCtx());
    expect(commands).toEqual([{ type: 'addMana', color: 'G', amount: 1 }]);
  });

  it('buildGuidedCommands rejects invalid color not in options', () => {
    const ctx: CompileContext = {
      sourceId: 'c1',
      def: cardDef(),
      commanderColorIdentity: ['U', 'B'] as ManaColor[],
    };
    const result = compile(
      "{T}: Add one mana of any color in your commander's color identity.",
      ctx,
    );
    const prompt = result.prompts[0];
    // 'R' is not in ['U', 'B']
    const commands = buildGuidedCommands(prompt, { kind: 'mana', color: 'R' }, ctx);
    expect(commands).toEqual([]);
  });
});

describe('review.cr605-mana-choice-ui: tapForMana needs-choice flow (CR 605.3b)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('multi-color land returns needs-choice without color, ok with color', () => {
    const dualLand = makeDef({
      scryfallId: 'dual-land',
      typeLine: 'Land',
      producedMana: ['R', 'G'] as ManaColor[],
    });
    store().newGame([{ def: dualLand, isCommander: false }, ...makeDeck(24)], 42);

    const state = store().state!;
    const landId = Object.values(state.cards).find(
      (c) => c.defId === 'dual-land',
    )?.id;
    expect(landId).toBeDefined();

    // Without color: needs-choice
    expect(store().tapForMana(landId!)).toBe('needs-choice');
    // State unchanged (not tapped)
    expect(store().state!.cards[landId!].tapped).toBe(false);

    // With valid color: ok
    expect(store().tapForMana(landId!, 'R')).toBe('ok');
    expect(store().state!.cards[landId!].tapped).toBe(true);
    expect(store().state!.manaPool.R).toBe(1);
  });

  it('single-color land auto-resolves without needs-choice', () => {
    const forest = makeDef({
      scryfallId: 'forest',
      typeLine: 'Basic Land — Forest',
      producedMana: ['G'] as ManaColor[],
    });
    store().newGame([{ def: forest, isCommander: false }, ...makeDeck(24)], 42);

    const state = store().state!;
    const forestId = Object.values(state.cards).find(
      (c) => c.defId === 'forest',
    )?.id;
    expect(forestId).toBeDefined();

    // Single color: auto-resolves
    expect(store().tapForMana(forestId!)).toBe('ok');
    expect(store().state!.cards[forestId!].tapped).toBe(true);
    expect(store().state!.manaPool.G).toBe(1);
  });

  it('invalid color for multi-color land still returns needs-choice', () => {
    const dualLand = makeDef({
      scryfallId: 'dual-land-2',
      typeLine: 'Land',
      producedMana: ['W', 'U'] as ManaColor[],
    });
    store().newGame([{ def: dualLand, isCommander: false }, ...makeDeck(24)], 42);

    const state = store().state!;
    const landId = Object.values(state.cards).find(
      (c) => c.defId === 'dual-land-2',
    )?.id;
    expect(landId).toBeDefined();

    // 'R' is not in ['W', 'U'] — should still be needs-choice (not ok)
    expect(store().tapForMana(landId!, 'R')).toBe('needs-choice');
    expect(store().state!.cards[landId!].tapped).toBe(false);
  });
});

describe('review.cr605-mana-choice-ui: mana ability no-stack (CR 605.3b)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('mana ability with guided prompt does not use the stack', () => {
    // Set up a game with a mana-producing creature
    const manaCreature = makeDef({
      scryfallId: 'mana-bird',
      typeLine: 'Creature — Bird',
      faces: [{
        name: 'mana-bird',
        typeLine: 'Creature — Bird',
        oracleText: '{T}: Add one mana of any color.',
      }],
    });
    store().newGame([{ def: manaCreature, isCommander: false }, ...makeDeck(24)], 42);

    const state = store().state!;
    const birdId = Object.values(state.cards).find(
      (c) => c.defId === 'mana-bird',
    )?.id;
    expect(birdId).toBeDefined();

    // Move to battlefield
    store().moveCard(birdId!, 'battlefield', 'bottom');
    const stackBefore = store().state!.zones.stack.length;

    // Activate the mana ability
    store().activateAbility(birdId!);

    // Should have a pendingGuided with mana prompt
    const pending = store().pendingGuided;
    expect(pending).not.toBeNull();
    expect(pending!.prompts[0]).toMatchObject({ kind: 'mana' });
    // Stack should NOT have grown (mana ability = no stack)
    expect(store().state!.zones.stack.length).toBe(stackBefore);

    // Confirm the mana choice
    store().confirmGuidedMana('G');
    expect(store().state!.manaPool.G).toBe(1);
    // Still no stack entry
    expect(store().state!.zones.stack.length).toBe(stackBefore);
  });
});
