// Implementer-owned unit tests for classGrammar.ts (CR 716).
import { describe, expect, it } from 'vitest';

import {
  parseClassLevelBars,
  classLevelBarKeywords,
  classLevelActivationLegal,
} from '../classGrammar';
import type { ClassLevelBar } from '../classGrammar';
import { applyCommand, EngineError } from '../commands';
import { initGame } from '../init';
import { classLevelOf, effectiveKeywords, STATUS_KEYWORDS } from '../status';
import { KEYWORD_DEFINITIONS } from '../keywordGrammar';
import type { GameState } from '../types';
import { makeDef } from './helpers';

// --- parseClassLevelBars ---

describe('parseClassLevelBars', () => {
  it('parses standard Rogue Class text', () => {
    const text = [
      'Whenever you cast this spell, target creature you control gains deathtouch until end of turn.',
      '{1}{R}: Level 2 — When this Class becomes level 2, target creature you control gets +1/+0 and gains haste until end of turn.',
      '{2}{R}: Level 3 — Creatures you control get +1/+0.',
    ].join('\n');
    const bars = parseClassLevelBars(text);
    expect(bars).toHaveLength(2);
    expect(bars[0]).toEqual({
      level: 2,
      costText: '{1}{R}',
      abilitiesText: 'When this Class becomes level 2, target creature you control gets +1/+0 and gains haste until end of turn.',
    });
    expect(bars[1]).toEqual({
      level: 3,
      costText: '{2}{R}',
      abilitiesText: 'Creatures you control get +1/+0.',
    });
  });

  it('returns [] for empty string', () => {
    expect(parseClassLevelBars('')).toEqual([]);
  });

  it('returns [] for undefined', () => {
    expect(parseClassLevelBars(undefined)).toEqual([]);
  });

  it('returns [] for null', () => {
    expect(parseClassLevelBars(null)).toEqual([]);
  });

  it('ignores non-bar lines', () => {
    const text = 'Flying\nWhenever this creature attacks, draw a card.';
    expect(parseClassLevelBars(text)).toEqual([]);
  });

  it('handles en-dash variant', () => {
    const text = '{2}{W}: Level 2 – This Class gains flying.';
    const bars = parseClassLevelBars(text);
    expect(bars).toHaveLength(1);
    expect(bars[0].level).toBe(2);
    expect(bars[0].abilitiesText).toBe('This Class gains flying.');
  });

  it('handles hyphen variant', () => {
    const text = '{2}{W}: Level 2 - This Class gains flying.';
    const bars = parseClassLevelBars(text);
    expect(bars).toHaveLength(1);
    expect(bars[0].level).toBe(2);
  });

  it('handles multi-digit level numbers', () => {
    const text = '{5}: Level 10 — This Class gains indestructible.';
    const bars = parseClassLevelBars(text);
    expect(bars).toHaveLength(1);
    expect(bars[0].level).toBe(10);
  });

  it('trims whitespace from cost and abilities', () => {
    const text = '  {1}{G} :  Level 2  —  This Class gains trample.  ';
    const bars = parseClassLevelBars(text);
    expect(bars).toHaveLength(1);
    expect(bars[0].costText).toBe('{1}{G}');
    expect(bars[0].abilitiesText).toBe('This Class gains trample.');
  });
});

// --- classLevelBarKeywords ---

describe('classLevelBarKeywords', () => {
  const bars: ClassLevelBar[] = [
    { level: 2, costText: '{1}{W}', abilitiesText: 'This Class gains flying.' },
    { level: 3, costText: '{2}{W}', abilitiesText: 'This Class gains vigilance and lifelink.' },
  ];

  it('returns [] when level is below all bars', () => {
    expect(classLevelBarKeywords(bars, 1)).toEqual([]);
  });

  it('returns keywords from bars at or below level', () => {
    expect(classLevelBarKeywords(bars, 2)).toEqual(['flying']);
  });

  it('returns keywords from all qualifying bars', () => {
    const kws = classLevelBarKeywords(bars, 3);
    expect(kws).toContain('flying');
    expect(kws).toContain('vigilance');
    expect(kws).toContain('lifelink');
  });

  it('deduplicates keywords across bars', () => {
    const dupeBars: ClassLevelBar[] = [
      { level: 2, costText: '{1}', abilitiesText: 'This Class gains flying.' },
      { level: 3, costText: '{2}', abilitiesText: 'This Class gains flying.' },
    ];
    expect(classLevelBarKeywords(dupeBars, 3)).toEqual(['flying']);
  });

  it('ignores non-keyword text', () => {
    const nonKwBars: ClassLevelBar[] = [
      { level: 2, costText: '{1}', abilitiesText: 'Creatures you control get +1/+0.' },
    ];
    expect(classLevelBarKeywords(nonKwBars, 2)).toEqual([]);
  });

  it('recognizes multi-word keywords (double strike)', () => {
    const dsBars: ClassLevelBar[] = [
      { level: 2, costText: '{1}', abilitiesText: 'This Class gains double strike.' },
    ];
    expect(classLevelBarKeywords(dsBars, 2)).toEqual(['double-strike']);
  });

  it('returns [] for empty bars array', () => {
    expect(classLevelBarKeywords([], 5)).toEqual([]);
  });

  it('does not grant keywords mentioned in triggered/temporary ability sentences', () => {
    const triggeredBars: ClassLevelBar[] = [
      {
        level: 2,
        costText: '{1}{R}',
        abilitiesText:
          'When this Class becomes level 2, target creature you control gets +1/+0 and gains haste until end of turn.',
      },
    ];
    expect(classLevelBarKeywords(triggeredBars, 2)).toEqual([]);
  });

  it('does not grant keywords from grants to other objects ("Creatures you control have trample.")', () => {
    const otherObjectBars: ClassLevelBar[] = [
      { level: 2, costText: '{1}{G}', abilitiesText: 'Creatures you control have trample.' },
    ];
    expect(classLevelBarKeywords(otherObjectBars, 2)).toEqual([]);
  });

  it('mixed sentences: only the strict self-grant sentence contributes', () => {
    const mixedBars: ClassLevelBar[] = [
      {
        level: 2,
        costText: '{1}{U}',
        abilitiesText: 'This Class gains flying. Whenever you cast this spell, draw a card.',
      },
    ];
    expect(classLevelBarKeywords(mixedBars, 2)).toEqual(['flying']);
  });

  it('unrecognized word in a grant sentence fails the whole sentence (all-or-nothing)', () => {
    const unknownBars: ClassLevelBar[] = [
      { level: 2, costText: '{1}', abilitiesText: 'This Class gains flying and superpower.' },
    ];
    expect(classLevelBarKeywords(unknownBars, 2)).toEqual([]);
  });

  // Cold-audit FINDING-4 parity guard: the duplicated STATUS_KEYWORD_IDS set in
  // classGrammar.ts must stay in sync with STATUS_KEYWORDS in status.ts and with
  // the display names in KEYWORD_DEFINITIONS. For every status keyword id, the
  // canonical "This Class gains <display name>." sentence must grant that id.
  it('parity: every STATUS_KEYWORDS id is granted by its KEYWORD_DEFINITIONS display name', () => {
    for (const id of STATUS_KEYWORDS) {
      const definition = KEYWORD_DEFINITIONS.find((entry) => entry.id === id);
      expect(definition, `missing KEYWORD_DEFINITIONS entry for ${id}`).toBeDefined();
      if (!definition) continue;
      const bar: ClassLevelBar = {
        level: 2,
        costText: '{1}',
        abilitiesText: `This Class gains ${definition.name}.`,
      };
      expect(classLevelBarKeywords([bar], bar.level), `bar grant missing for ${id}`).toContain(id);
    }
  });
});

// --- classLevelActivationLegal ---

describe('classLevelActivationLegal', () => {
  function setupClass(oracleText: string): { state: GameState; id: string } {
    const def = makeDef({
      scryfallId: 'test-class',
      name: 'test-class',
      typeLine: 'Enchantment — Class',
      faces: [{ name: 'test-class', typeLine: 'Enchantment — Class', oracleText }],
    });
    let state = initGame([{ def, isCommander: false }], 1);
    const id = Object.values(state.cards).find((c) => c.defId === 'test-class')?.id ?? '';
    state = applyCommand(state, { type: 'moveCard', cardId: id, to: 'battlefield', position: 'bottom' }).state;
    return { state, id };
  }

  const TEXT = '{1}{W}: Level 2 — This Class gains flying.\n{2}{W}: Level 3 — This Class gains vigilance.';

  it('legal: level 1 → bar level 2', () => {
    const { state, id } = setupClass(TEXT);
    expect(classLevelActivationLegal(state, id, 2)).toBe(true);
  });

  it('illegal: level 2 → bar level 2 (already at N)', () => {
    const setupR = setupClass(TEXT);
    const id = setupR.id;
    let state = setupR.state;
    state = applyCommand(state, { type: 'setClassLevel', cardId: id, level: 2 }).state;
    expect(classLevelActivationLegal(state, id, 2)).toBe(false);
  });

  it('illegal: level 1 → bar level 3 (must be N-1)', () => {
    const { state, id } = setupClass(TEXT);
    expect(classLevelActivationLegal(state, id, 3)).toBe(false);
  });

  it('legal: level 2 → bar level 3', () => {
    const setupR = setupClass(TEXT);
    const id = setupR.id;
    let state = setupR.state;
    state = applyCommand(state, { type: 'setClassLevel', cardId: id, level: 2 }).state;
    expect(classLevelActivationLegal(state, id, 3)).toBe(true);
  });
});

// --- classLevelOf ---

describe('classLevelOf', () => {
  it('defaults to 1 for cards without classLevel', () => {
    const def = makeDef({ scryfallId: 'plain-card' });
    const state = initGame([{ def, isCommander: false }], 1);
    const id = Object.values(state.cards).find((c) => c.defId === 'plain-card')?.id ?? '';
    expect(classLevelOf(state, id)).toBe(1);
  });

  it('returns 1 for unknown cardId', () => {
    const def = makeDef({ scryfallId: 'x' });
    const state = initGame([{ def, isCommander: false }], 1);
    expect(classLevelOf(state, 'nonexistent')).toBe(1);
  });

  it('reflects setClassLevel', () => {
    const def = makeDef({ scryfallId: 'cl-card' });
    let state = initGame([{ def, isCommander: false }], 1);
    const id = Object.values(state.cards).find((c) => c.defId === 'cl-card')?.id ?? '';
    state = applyCommand(state, { type: 'moveCard', cardId: id, to: 'battlefield', position: 'bottom' }).state;
    state = applyCommand(state, { type: 'setClassLevel', cardId: id, level: 3 }).state;
    expect(classLevelOf(state, id)).toBe(3);
  });
});

// --- setClassLevel command ---

describe('setClassLevel command', () => {
  function setup(): { state: GameState; id: string } {
    const def = makeDef({ scryfallId: 'cmd-class' });
    let state = initGame([{ def, isCommander: false }], 1);
    const id = Object.values(state.cards).find((c) => c.defId === 'cmd-class')?.id ?? '';
    state = applyCommand(state, { type: 'moveCard', cardId: id, to: 'battlefield', position: 'bottom' }).state;
    return { state, id };
  }

  it('sets classLevel and emits log', () => {
    const { state, id } = setup();
    const logBefore = state.log.length;
    const result = applyCommand(state, { type: 'setClassLevel', cardId: id, level: 2 });
    expect(result.state.cards[id]?.classLevel).toBe(2);
    expect(result.state.log.length).toBe(logBefore + 1);
  });

  it('is idempotent (same level → no change, no log)', () => {
    const setupR = setup();
    const id = setupR.id;
    let state = setupR.state;
    state = applyCommand(state, { type: 'setClassLevel', cardId: id, level: 2 }).state;
    const logLen = state.log.length;
    const result = applyCommand(state, { type: 'setClassLevel', cardId: id, level: 2 });
    expect(result.state.cards[id]?.classLevel).toBe(2);
    expect(result.state.log.length).toBe(logLen);
  });

  it('is absolute (not additive)', () => {
    const setupR = setup();
    const id = setupR.id;
    let state = setupR.state;
    state = applyCommand(state, { type: 'setClassLevel', cardId: id, level: 3 }).state;
    state = applyCommand(state, { type: 'setClassLevel', cardId: id, level: 2 }).state;
    expect(state.cards[id]?.classLevel).toBe(2);
  });

  it('does not interact with counters (CR 716.4)', () => {
    const setupR = setup();
    const id = setupR.id;
    let state = setupR.state;
    state = applyCommand(state, { type: 'addCounters', cardId: id, counterType: 'level', delta: 5 }).state;
    expect(classLevelOf(state, id)).toBe(1);
    expect(state.cards[id]?.counters['level']).toBe(5);
  });

  // Cold-audit FINDING-3: invalid levels are rejected before any state change.
  it.each([0, -2, 1.5])('rejects invalid level %s with EngineError', (level) => {
    const { state, id } = setup();
    const logBefore = state.log.length;
    expect(() => applyCommand(state, { type: 'setClassLevel', cardId: id, level })).toThrow(EngineError);
    // No state change must be observable.
    expect(state.cards[id]?.classLevel).toBeUndefined();
    expect(state.log.length).toBe(logBefore);
    expect(classLevelOf(state, id)).toBe(1);
  });
});

// --- effectiveKeywords integration ---

describe('effectiveKeywords with Class level bars', () => {
  function setupClass(oracleText: string, level?: number): { state: GameState; id: string } {
    const def = makeDef({
      scryfallId: 'kw-class',
      name: 'kw-class',
      typeLine: 'Enchantment — Class',
      faces: [{ name: 'kw-class', typeLine: 'Enchantment — Class', oracleText }],
    });
    let state = initGame([{ def, isCommander: false }], 1);
    const id = Object.values(state.cards).find((c) => c.defId === 'kw-class')?.id ?? '';
    state = applyCommand(state, { type: 'moveCard', cardId: id, to: 'battlefield', position: 'bottom' }).state;
    if (level !== undefined) {
      state = applyCommand(state, { type: 'setClassLevel', cardId: id, level }).state;
    }
    return { state, id };
  }

  const TEXT = '{1}{W}: Level 2 — This Class gains flying.\n{2}{W}: Level 3 — This Class gains vigilance and lifelink.';

  it('level 1: no bar keywords', () => {
    const { state, id } = setupClass(TEXT);
    const kws = effectiveKeywords(state, id);
    expect(kws).not.toContain('flying');
    expect(kws).not.toContain('vigilance');
    expect(kws).not.toContain('lifelink');
  });

  it('level 2: only bar level 2 keywords', () => {
    const { state, id } = setupClass(TEXT, 2);
    const kws = effectiveKeywords(state, id);
    expect(kws).toContain('flying');
    expect(kws).not.toContain('vigilance');
    expect(kws).not.toContain('lifelink');
  });

  it('level 3: all bar keywords', () => {
    const { state, id } = setupClass(TEXT, 3);
    const kws = effectiveKeywords(state, id);
    expect(kws).toContain('flying');
    expect(kws).toContain('vigilance');
    expect(kws).toContain('lifelink');
  });

  it('non-Class permanent does not get bar keywords even with classLevel set', () => {
    const def = makeDef({
      scryfallId: 'not-class',
      name: 'not-class',
      typeLine: 'Creature — Bear',
      faces: [{ name: 'not-class', typeLine: 'Creature — Bear', oracleText: TEXT }],
    });
    let state = initGame([{ def, isCommander: false }], 1);
    const id = Object.values(state.cards).find((c) => c.defId === 'not-class')?.id ?? '';
    state = applyCommand(state, { type: 'moveCard', cardId: id, to: 'battlefield', position: 'bottom' }).state;
    state = applyCommand(state, { type: 'setClassLevel', cardId: id, level: 3 }).state;
    const kws = effectiveKeywords(state, id);
    expect(kws).not.toContain('flying');
  });

  it('top-section keyword grant still works alongside class bars', () => {
    const text = 'This Class has hexproof.\n{1}{W}: Level 2 — This Class gains flying.';
    const { state, id } = setupClass(text);
    const kws = effectiveKeywords(state, id);
    expect(kws).toContain('hexproof');
    expect(kws).not.toContain('flying');
  });

  it('class not on battlefield: no bar keywords', () => {
    const def = makeDef({
      scryfallId: 'hand-class',
      name: 'hand-class',
      typeLine: 'Enchantment — Class',
      faces: [{ name: 'hand-class', typeLine: 'Enchantment — Class', oracleText: TEXT }],
    });
    const state = initGame([{ def, isCommander: false }], 1);
    const id = Object.values(state.cards).find((c) => c.defId === 'hand-class')?.id ?? '';
    // Card is in library by default, not battlefield
    const kws = effectiveKeywords(state, id);
    expect(kws).not.toContain('flying');
  });

  // Cold-audit FINDING-1 reproduction: the Rogue Class level 2 bar mentions
  // "gains haste until end of turn" inside a triggered ability — that must NOT
  // grant haste to the Class itself at level 2.
  it('Rogue Class at level 2: no haste granted by the triggered level 2 bar', () => {
    const rogueText = [
      'Whenever you cast this spell, target creature you control gains deathtouch until end of turn.',
      '{1}{R}: Level 2 — When this Class becomes level 2, target creature you control gets +1/+0 and gains haste until end of turn.',
      '{2}{R}: Level 3 — Creatures you control get +1/+0.',
    ].join('\n');
    const { state, id } = setupClass(rogueText, 2);
    const kws = effectiveKeywords(state, id);
    expect(kws).not.toContain('haste');
    expect(kws).not.toContain('deathtouch');
  });

  it('grant text addressing other objects ("Creatures you control have trample.") grants nothing to the Class', () => {
    const text = '{1}{G}: Level 2 — Creatures you control have trample.';
    const { state, id } = setupClass(text, 2);
    expect(effectiveKeywords(state, id)).not.toContain('trample');
  });
});

// --- zone-change reset (cold-audit FINDING-2: CR 400.7 / 716.2d) ---

describe('classLevel resets on zone change', () => {
  const TEXT = '{1}{W}: Level 2 — This Class gains flying.';

  function setupClass(oracleText: string): { state: GameState; id: string } {
    const def = makeDef({
      scryfallId: 'zc-class',
      name: 'zc-class',
      typeLine: 'Enchantment — Class',
      faces: [{ name: 'zc-class', typeLine: 'Enchantment — Class', oracleText }],
    });
    let state = initGame([{ def, isCommander: false }], 1);
    const id = Object.values(state.cards).find((c) => c.defId === 'zc-class')?.id ?? '';
    state = applyCommand(state, { type: 'moveCard', cardId: id, to: 'battlefield', position: 'bottom' }).state;
    return { state, id };
  }

  it('bounce to hand and back: re-enters at level 1 with no bar keywords', () => {
    const setupR = setupClass(TEXT);
    const id = setupR.id;
    let state = setupR.state;
    state = applyCommand(state, { type: 'setClassLevel', cardId: id, level: 3 }).state;
    expect(classLevelOf(state, id)).toBe(3);

    state = applyCommand(state, { type: 'moveCard', cardId: id, to: 'hand', position: 'bottom' }).state;
    expect(state.cards[id]?.classLevel).toBeUndefined();

    state = applyCommand(state, { type: 'moveCard', cardId: id, to: 'battlefield', position: 'bottom' }).state;
    expect(classLevelOf(state, id)).toBe(1);
    expect(effectiveKeywords(state, id)).not.toContain('flying');
  });

  it('same-zone reorder does not reset classLevel', () => {
    const setupR = setupClass(TEXT);
    const id = setupR.id;
    let state = setupR.state;
    state = applyCommand(state, { type: 'setClassLevel', cardId: id, level: 2 }).state;
    state = applyCommand(state, { type: 'moveCard', cardId: id, to: 'battlefield', position: 'top' }).state;
    expect(classLevelOf(state, id)).toBe(2);
    expect(effectiveKeywords(state, id)).toContain('flying');
  });
});
