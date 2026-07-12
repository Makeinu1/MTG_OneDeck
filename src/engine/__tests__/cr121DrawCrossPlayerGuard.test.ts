import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { compileAbilityIR } from '../grammar/compile';
import { parseAbilityIR } from '../grammar/ir';

// CR 121.2c honesty guard regression/adversarial suite.
//
// Background: `hasSupportedPlayerSubject`'s `effect.draw` case previously accepted any raw
// clause containing "draw" or "you draw", even when the same clause also instructed an
// unsupported recipient (target player/opponent, each player/opponent) or an optional/
// conditional draw for another player. Because the engine only has a P1-only `draw` command,
// accepting such a clause silently executed *part* of the instruction (e.g. Tataru Taru's ETB
// "you draw a card and target opponent may draw a card" auto-drew exactly one card for P1 and
// dropped the opponent's optional draw with no prompt, warning, or manual fallback). This
// suite pins the fix: such clauses must classify manual with zero emitted commands, while
// pre-existing fixed self-draw and trigger-origin behavior remains unchanged.

function def(): CardDef {
  return {
    scryfallId: 'cr121-cross-player-source',
    oracleId: 'cr121-cross-player-source',
    name: 'cr121-cross-player-source',
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine: 'Creature — Test',
    faces: [{ name: 'cr121-cross-player-source', typeLine: 'Creature — Test' }],
  };
}

function compile(line: string, typeLine = 'Creature — Test') {
  return compileAbilityIR(parseAbilityIR(line, typeLine), {
    sourceId: 'source-1',
    def: { ...def(), typeLine, faces: [{ ...def().faces[0], typeLine }] },
  });
}

describe('CR 121.2c draw cross-player/optional honesty guard', () => {
  it('classifies the full Tataru Taru ETB clause manual with zero commands', () => {
    expect(
      compile('When Tataru Taru enters, you draw a card and target opponent may draw a card.'),
    ).toMatchObject({
      decision: 'manual',
      commands: [],
    });
  });

  it('never auto-emits the supported self subset of a mixed self/opponent draw clause', () => {
    expect(
      compile('You draw a card and each opponent draws a card.'),
    ).toMatchObject({ decision: 'manual', commands: [] });

    expect(
      compile('You draw two cards and target opponent draws a card.'),
    ).toMatchObject({ decision: 'manual', commands: [] });

    expect(compile('Target player draws two cards.')).toMatchObject({
      decision: 'manual',
      commands: [],
    });
  });

  it('keeps each-player draw clauses manual with zero commands', () => {
    expect(compile('Each player draws a card.')).toMatchObject({
      decision: 'manual',
      commands: [],
    });
    expect(compile('That player draws a card.')).toMatchObject({
      decision: 'manual',
      commands: [],
    });
  });

  it('regression: unqualified fixed self draw remains auto with the correct count', () => {
    expect(compile('Draw a card.')).toMatchObject({
      decision: 'auto',
      commands: [{ type: 'draw', count: 1 }],
    });
    expect(compile('Draw two cards.')).toMatchObject({
      decision: 'auto',
      commands: [{ type: 'draw', count: 2 }],
    });
  });

  it('regression: trigger-origin parity for ETB/attack/upkeep fixed self draw stays auto', () => {
    expect(compile('When this enters, draw two cards.')).toMatchObject({
      decision: 'auto',
      commands: [{ type: 'draw', count: 2 }],
    });
    expect(compile('Whenever this creature attacks, draw two cards.')).toMatchObject({
      decision: 'auto',
      commands: [{ type: 'draw', count: 2 }],
    });
    expect(
      compile('At the beginning of your upkeep, draw two cards.'),
    ).toMatchObject({
      decision: 'auto',
      commands: [{ type: 'draw', count: 2 }],
    });
  });

  it('regression: variable-count and optional/conditional draw clauses remain manual with zero commands', () => {
    expect(compile('Draw X cards.')).toMatchObject({
      decision: 'manual',
      reasons: ['variable-count'],
      commands: [],
    });
    expect(
      compile(
        "Target player draws X cards. Shuffle CARDNAME into its owner's library.",
        'Sorcery',
      ),
    ).toMatchObject({ decision: 'manual', commands: [] });
    expect(
      compile(
        'Whenever you attack, you may pay {1} and discard a card. If you do, draw a card.',
      ),
    ).toMatchObject({ decision: 'manual', commands: [] });
  });

  it('regression: guided discard-then-draw composition is unaffected (no draw prompt added)', () => {
    const compiled = compile('When this creature enters, discard a card, then draw a card.');
    expect(compiled.decision).toBe('guided');
    expect(compiled.commands).toEqual([{ type: 'draw', count: 1 }]);
    expect(compiled.prompts).toEqual([
      expect.objectContaining({ atom: 'effect.discard', kind: 'discard', count: 1 }),
    ]);
  });

  // The recipient/condition guard must scan only the actual draw instruction, not an embedded
  // delayed-trigger condition prefix that stays glued to the draw clause after clause splitting.
  // Words like "opponents"/"may" inside the WHEN condition describe timing, not draw recipients,
  // so they must not false-block a genuine P1-only self draw (CR 121.2c applies to multi-player
  // draw ordering, not trigger timing).
  describe('embedded delayed-trigger draw (false-manual guard)', () => {
    it("keeps Maeve's activated goad+draw ability auto with exactly one P1 draw", () => {
      // "opponents" here is the goad target's attack destination, not a draw recipient.
      expect(
        compile(
          '{2}{U}: Goad target creature. Whenever that creature attacks one of your opponents this turn, you draw a card.',
        ),
      ).toMatchObject({
        decision: 'auto',
        commands: [{ type: 'draw', count: 1 }],
      });
    });

    it('keeps other embedded-trigger P1 self draws auto (condition words are not recipients)', () => {
      expect(compile('Whenever an opponent draws a card, you draw a card.')).toMatchObject({
        decision: 'auto',
        commands: [{ type: 'draw', count: 1 }],
      });
      expect(
        compile("At the beginning of each opponent's upkeep, you draw a card."),
      ).toMatchObject({
        decision: 'auto',
        commands: [{ type: 'draw', count: 1 }],
      });
    });

    it('still blocks genuine cross-player draws that lack an embedded trigger prefix', () => {
      // Contrast case: no leading trigger to strip, so the target-opponent recipient in the
      // actual draw instruction still forces manual with zero commands (Sphinx-of-Enlightenment
      // shape).
      expect(
        compile('When this creature enters, target opponent draws a card and you draw three cards.'),
      ).toMatchObject({ decision: 'manual', commands: [] });
    });
  });
});
