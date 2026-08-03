// Reviewer-owned adversarial tests for CR716 Class Cards (§34.51).
// 実装エージェント(Codex含む)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// CR grounding (pinned CR 2026-06-19):
// - 716.2: class level bar = activated ability + static ability.
// - 716.2a: "[Cost]: Level N — [Abilities]" → level becomes N; activate only if level N-1, sorcery.
//           Static: "As long as this Class is level N or greater, it has [abilities]."
// - 716.2b: level is a designation, not a counter; not copiable; retained if stops being a Class.
// - 716.2d: permanent without a level → treated as level 1.
// - 716.3: abilities not preceded by a class level bar are treated normally.
// - 716.4: level counters ≠ class levels; no interaction.
import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { applyCommand } from '../commands';
import { initGame } from '../init';
import { classLevelOf, effectiveKeywords } from '../status';
import { parseClassLevelBars, classLevelActivationLegal } from '../classGrammar';
import type { GameState } from '../types';
import { makeDef } from './helpers';

// --- Fixtures ---

function classDef(id: string, oracleText: string, typeLine = 'Enchantment — Class'): CardDef {
  return makeDef({ scryfallId: id, name: id, typeLine, faces: [{ name: id, typeLine, oracleText }] });
}

function move(state: GameState, cardId: string, to: 'battlefield' | 'hand' | 'graveyard'): GameState {
  return applyCommand(state, { type: 'moveCard', cardId, to, position: 'bottom' }).state;
}

function idOf(state: GameState, defId: string): string {
  return Object.values(state.cards).find((card) => card.defId === defId)?.id ?? '';
}

// Rogue Class oracle text (real card, AFR):
const ROGUE_CLASS_TEXT = [
  'Whenever you cast this spell, target creature you control gains deathtouch until end of turn.',
  '{1}{R}: Level 2 — When this Class becomes level 2, target creature you control gets +1/+0 and gains haste until end of turn.',
  '{2}{R}: Level 3 — Creatures you control get +1/+0.',
].join('\n');

// Synthetic Class with keyword-granting level bars for Layer 6 testing:
const KEYWORD_CLASS_TEXT = [
  'Whenever you cast this spell, draw a card.',
  '{1}{W}: Level 2 — This Class gains flying.',
  '{2}{W}: Level 3 — This Class gains vigilance and lifelink.',
].join('\n');

// --- G1–G3: classLevelOf and setClassLevel ---

describe('CR716 Class Cards: level designation (716.2b/716.2d)', () => {
  it('G1: Class enters battlefield with no level set → classLevelOf returns 1', () => {
    const def = classDef('g1-class', KEYWORD_CLASS_TEXT);
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'g1-class');
    state = move(state, id, 'battlefield');
    expect(classLevelOf(state, id)).toBe(1);
  });

  it('G2: setClassLevel to 2 → classLevelOf returns 2 and log emitted', () => {
    const def = classDef('g2-class', KEYWORD_CLASS_TEXT);
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'g2-class');
    state = move(state, id, 'battlefield');
    const result = applyCommand(state, { type: 'setClassLevel', cardId: id, level: 2 });
    expect(classLevelOf(result.state, id)).toBe(2);
    expect(result.state.log.length).toBeGreaterThan(state.log.length);
  });

  it('G3: setClassLevel idempotent (same level) → no state change, no log', () => {
    const def = classDef('g3-class', KEYWORD_CLASS_TEXT);
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'g3-class');
    state = move(state, id, 'battlefield');
    state = applyCommand(state, { type: 'setClassLevel', cardId: id, level: 2 }).state;
    const logLen = state.log.length;
    const result = applyCommand(state, { type: 'setClassLevel', cardId: id, level: 2 });
    expect(classLevelOf(result.state, id)).toBe(2);
    expect(result.state.log.length).toBe(logLen);
  });
});

// --- G4–G8: Layer 6 keyword grants gated by class level ---

describe('CR716 Class Cards: level-gated keyword grants (716.2a static half)', () => {
  it('G4: at level 1, bar level 2 keyword NOT granted', () => {
    const def = classDef('g4-class', KEYWORD_CLASS_TEXT);
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'g4-class');
    state = move(state, id, 'battlefield');
    // level defaults to 1
    expect(effectiveKeywords(state, id)).not.toContain('flying');
  });

  it('G5: at level 2, bar level 2 keyword IS granted', () => {
    const def = classDef('g5-class', KEYWORD_CLASS_TEXT);
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'g5-class');
    state = move(state, id, 'battlefield');
    state = applyCommand(state, { type: 'setClassLevel', cardId: id, level: 2 }).state;
    expect(effectiveKeywords(state, id)).toContain('flying');
  });

  it('G6: at level 3, bar level 2 keyword still granted (level >= N)', () => {
    const def = classDef('g6-class', KEYWORD_CLASS_TEXT);
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'g6-class');
    state = move(state, id, 'battlefield');
    state = applyCommand(state, { type: 'setClassLevel', cardId: id, level: 3 }).state;
    expect(effectiveKeywords(state, id)).toContain('flying');
  });

  it('G7: at level 2, bar level 2 keyword yes, bar level 3 keyword no', () => {
    const def = classDef('g7-class', KEYWORD_CLASS_TEXT);
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'g7-class');
    state = move(state, id, 'battlefield');
    state = applyCommand(state, { type: 'setClassLevel', cardId: id, level: 2 }).state;
    const kws = effectiveKeywords(state, id);
    expect(kws).toContain('flying');
    expect(kws).not.toContain('vigilance');
    expect(kws).not.toContain('lifelink');
  });

  it('G8: at level 3, both bar level 2 and bar level 3 keywords granted', () => {
    const def = classDef('g8-class', KEYWORD_CLASS_TEXT);
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'g8-class');
    state = move(state, id, 'battlefield');
    state = applyCommand(state, { type: 'setClassLevel', cardId: id, level: 3 }).state;
    const kws = effectiveKeywords(state, id);
    expect(kws).toContain('flying');
    expect(kws).toContain('vigilance');
    expect(kws).toContain('lifelink');
  });
});

// --- G9–G11: designation semantics ---

describe('CR716 Class Cards: designation semantics (716.2b/716.3/716.4)', () => {
  it('G9: non-Class permanent with classLevel set → classLevelOf returns set value', () => {
    const def = classDef('g9-creature', 'Just a bear.', 'Creature — Bear');
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'g9-creature');
    state = move(state, id, 'battlefield');
    state = applyCommand(state, { type: 'setClassLevel', cardId: id, level: 3 }).state;
    expect(classLevelOf(state, id)).toBe(3);
  });

  it('G10: level counters do not affect classLevel (716.4)', () => {
    const def = classDef('g10-class', KEYWORD_CLASS_TEXT);
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'g10-class');
    state = move(state, id, 'battlefield');
    state = applyCommand(state, { type: 'addCounters', cardId: id, counterType: 'level', delta: 3 }).state;
    // classLevelOf must still be 1 (default), not 3
    expect(classLevelOf(state, id)).toBe(1);
    // counters are independent
    expect(state.cards[id]?.counters['level']).toBe(3);
  });

  it('G11: top-section ability unaffected by class level (716.3)', () => {
    // A Class with a top-section keyword grant (not behind a level bar)
    const text = 'This Class has hexproof.\n{1}{W}: Level 2 — This Class gains flying.';
    const def = classDef('g11-class', text);
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'g11-class');
    state = move(state, id, 'battlefield');
    // At level 1, hexproof (top-section) should be active via existing Layer 6 path
    // (the "This Class has hexproof." line is a normal static ability line)
    // Note: this tests that the existing static ability path is not broken by Class parsing.
    // The top-section line "This Class has hexproof." should be parsed by the existing
    // parseLayer6AdditiveKeywordLine as a self-grant.
    const kws = effectiveKeywords(state, id);
    expect(kws).toContain('hexproof');
    expect(kws).not.toContain('flying'); // level 2 bar not yet active
  });
});

// --- G12–G13: parser ---

describe('CR716 Class Cards: parseClassLevelBars (716.2)', () => {
  it('G12: parses Rogue Class text correctly', () => {
    const bars = parseClassLevelBars(ROGUE_CLASS_TEXT);
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

  it('G13: ignores non-bar lines (716.3)', () => {
    const bars = parseClassLevelBars(ROGUE_CLASS_TEXT);
    // The first line ("Whenever you cast this spell...") is NOT a level bar
    for (const bar of bars) {
      expect(bar.abilitiesText).not.toContain('Whenever you cast this spell');
    }
  });

  it('G13b: empty/missing oracleText → []', () => {
    expect(parseClassLevelBars('')).toEqual([]);
    expect(parseClassLevelBars(undefined)).toEqual([]);
    expect(parseClassLevelBars(null)).toEqual([]);
  });
});

// --- G14–G16: activation legality ---

describe('CR716 Class Cards: classLevelActivationLegal (716.2a)', () => {
  it('G14: level 1, bar level 2 → legal (N-1 = 1)', () => {
    const def = classDef('g14-class', KEYWORD_CLASS_TEXT);
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'g14-class');
    state = move(state, id, 'battlefield');
    expect(classLevelActivationLegal(state, id, 2)).toBe(true);
  });

  it('G15: level 2, bar level 2 → illegal (already at N)', () => {
    const def = classDef('g15-class', KEYWORD_CLASS_TEXT);
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'g15-class');
    state = move(state, id, 'battlefield');
    state = applyCommand(state, { type: 'setClassLevel', cardId: id, level: 2 }).state;
    expect(classLevelActivationLegal(state, id, 2)).toBe(false);
  });

  it('G16: level 1, bar level 3 → illegal (must be N-1, not N-2)', () => {
    const def = classDef('g16-class', KEYWORD_CLASS_TEXT);
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'g16-class');
    state = move(state, id, 'battlefield');
    expect(classLevelActivationLegal(state, id, 3)).toBe(false);
  });
});

// --- G17: snapshot round-trip ---

describe('CR716 Class Cards: snapshot preservation (716.2b)', () => {
  it('G17: classLevel preserved through normalizeSnapshotState', () => {
    // normalizeSnapshotState is not exported from engine; test via applyCommand round-trip
    // (the field is on CardInstance, which is structurally preserved by applyCommand).
    const def = classDef('g17-class', KEYWORD_CLASS_TEXT);
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'g17-class');
    state = move(state, id, 'battlefield');
    state = applyCommand(state, { type: 'setClassLevel', cardId: id, level: 3 }).state;
    // Verify the field is on the card instance
    expect(state.cards[id]?.classLevel).toBe(3);
    // Verify classLevelOf reads it
    expect(classLevelOf(state, id)).toBe(3);
    // Verify keywords reflect level 3
    const kws = effectiveKeywords(state, id);
    expect(kws).toContain('flying');
    expect(kws).toContain('vigilance');
    expect(kws).toContain('lifelink');
  });
});
