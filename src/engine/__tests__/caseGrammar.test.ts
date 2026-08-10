// Implementer-owned unit tests for caseGrammar.ts (CR 719 Case cards).
import { describe, expect, it } from 'vitest';

import { isSolvedGatedLine, parseCaseSections, stripSolvedGatePrefix } from '../caseGrammar';
import { applyCommand } from '../commands';
import { initGame } from '../init';
import { effectiveKeywords } from '../status';
import type { GameState } from '../types';
import { makeDef } from './helpers';

// --- parseCaseSections ---

describe('parseCaseSections', () => {
  it('parses To solve condition and Solved lines in order', () => {
    const text = [
      'To solve — You control three or more creatures.',
      'Solved — This Case has flying.',
      'Solved — This Case has vigilance and lifelink.',
    ].join('\n');
    const sections = parseCaseSections(text);
    expect(sections.toSolveCondition).toBe('You control three or more creatures.');
    expect(sections.solvedAbilities).toEqual([
      'This Case has flying.',
      'This Case has vigilance and lifelink.',
    ]);
  });

  it('handles en-dash and hyphen dash variants', () => {
    expect(parseCaseSections('To solve – A.').toSolveCondition).toBe('A.');
    expect(parseCaseSections('Solved – This Case has flying.').solvedAbilities).toEqual([
      'This Case has flying.',
    ]);
    expect(parseCaseSections('To solve - B.').toSolveCondition).toBe('B.');
    expect(parseCaseSections('Solved - This Case has trample.').solvedAbilities).toEqual([
      'This Case has trample.',
    ]);
  });

  it('returns empty sections for empty/missing oracle text', () => {
    expect(parseCaseSections('')).toEqual({ solvedAbilities: [] });
    expect(parseCaseSections(undefined)).toEqual({ solvedAbilities: [] });
    expect(parseCaseSections(null)).toEqual({ solvedAbilities: [] });
  });

  it('ignores lines without To solve/Solved prefixes', () => {
    const sections = parseCaseSections('Flying\nWhenever you cast a spell, draw a card.');
    expect(sections.toSolveCondition).toBeUndefined();
    expect(sections.solvedAbilities).toEqual([]);
  });

  it('keeps the first To solve condition when multiple appear', () => {
    const sections = parseCaseSections('To solve — A.\nTo solve — B.');
    expect(sections.toSolveCondition).toBe('A.');
  });

  it('trims whitespace around prefixes and text', () => {
    const sections = parseCaseSections('  To solve —   You control a land.  ');
    expect(sections.toSolveCondition).toBe('You control a land.');
  });
});

// --- isSolvedGatedLine / stripSolvedGatePrefix ---

describe('isSolvedGatedLine / stripSolvedGatePrefix', () => {
  it('detects Solved-gated lines across dash variants', () => {
    expect(isSolvedGatedLine('Solved — This Case has flying.')).toBe(true);
    expect(isSolvedGatedLine('Solved – This Case has flying.')).toBe(true);
    expect(isSolvedGatedLine('Solved - This Case has flying.')).toBe(true);
  });

  it('rejects To solve lines and unrelated lines', () => {
    expect(isSolvedGatedLine('To solve — You control three or more creatures.')).toBe(false);
    expect(isSolvedGatedLine('This Case has flying.')).toBe(false);
    expect(isSolvedGatedLine('')).toBe(false);
  });

  it('strips the prefix and trims the remainder', () => {
    expect(stripSolvedGatePrefix('Solved — This Case has flying.')).toBe('This Case has flying.');
    expect(stripSolvedGatePrefix('  Solved -   This Case has trample. ')).toBe(
      'This Case has trample.',
    );
    expect(stripSolvedGatePrefix('Not solved gated.')).toBeNull();
  });
});

// --- effectiveKeywords integration (Layer 6 solved gate) ---

const CASE_TEXT = [
  'To solve — You control three or more creatures.',
  'Solved — This Case has flying.',
  'Solved — This Case has vigilance and lifelink.',
].join('\n');

function caseGame(id: string, oracleText: string, typeLine = 'Enchantment — Case') {
  const def = makeDef({
    scryfallId: id,
    name: id,
    typeLine,
    faces: [{ name: id, typeLine, oracleText }],
  });
  let state: GameState = initGame([{ def, isCommander: false }], 1);
  const cardId =
    Object.values(state.cards).find((card) => card.defId === id)?.id ?? '';
  state = applyCommand(state, { type: 'moveCard', cardId, to: 'battlefield', position: 'bottom' }).state;
  return { state, cardId };
}

describe('effectiveKeywords: solved gate', () => {
  it('grants nothing while unsolved', () => {
    const { state, cardId } = caseGame('cg-case-unsolved', CASE_TEXT);
    const kws = effectiveKeywords(state, cardId);
    expect(kws).not.toContain('flying');
    expect(kws).not.toContain('vigilance');
    expect(kws).not.toContain('lifelink');
  });

  it('grants all solved-line keywords once solved', () => {
    const setupR = caseGame('cg-case-solved', CASE_TEXT);
    const cardId = setupR.cardId;
    let state = setupR.state;
    state = applyCommand(state, { type: 'setSolved', cardId, solved: true }).state;
    const kws = effectiveKeywords(state, cardId);
    expect(kws).toContain('flying');
    expect(kws).toContain('vigilance');
    expect(kws).toContain('lifelink');
  });

  it('keeps top-section keywords regardless of solved state', () => {
    const text = 'This Case has hexproof.\nTo solve — A.\nSolved — This Case has flying.';
    const setupR = caseGame('cg-case-mixed', text);
    const cardId = setupR.cardId;
    let state = setupR.state;
    expect(effectiveKeywords(state, cardId)).toContain('hexproof');
    expect(effectiveKeywords(state, cardId)).not.toContain('flying');
    state = applyCommand(state, { type: 'setSolved', cardId, solved: true }).state;
    const kws = effectiveKeywords(state, cardId);
    expect(kws).toContain('hexproof');
    expect(kws).toContain('flying');
  });

  it('loses solved keywords after leaving and re-entering (CR 400.7)', () => {
    const setupR = caseGame('cg-case-reentry', CASE_TEXT);
    const cardId = setupR.cardId;
    let state = setupR.state;
    state = applyCommand(state, { type: 'setSolved', cardId, solved: true }).state;
    state = applyCommand(state, { type: 'moveCard', cardId, to: 'hand', position: 'bottom' }).state;
    state = applyCommand(state, { type: 'moveCard', cardId, to: 'battlefield', position: 'bottom' }).state;
    expect(state.cards[cardId]?.solved ?? false).toBe(false);
    expect(effectiveKeywords(state, cardId)).not.toContain('flying');
  });

  it('never grants solved keywords off the battlefield', () => {
    const def = makeDef({
      scryfallId: 'cg-case-library',
      name: 'cg-case-library',
      typeLine: 'Enchantment — Case',
      faces: [{ name: 'cg-case-library', typeLine: 'Enchantment — Case', oracleText: CASE_TEXT }],
    });
    const state = initGame([{ def, isCommander: false }], 1);
    const cardId = Object.values(state.cards).find((card) => card.defId === 'cg-case-library')?.id ?? '';
    expect(effectiveKeywords(state, cardId)).not.toContain('flying');
  });

  it('ignores non-keyword solved lines honestly (deferred)', () => {
    const text = 'To solve — A.\nSolved — You may look at the top card of your library.';
    const setupR = caseGame('cg-case-nonkeyword', text);
    const cardId = setupR.cardId;
    let state = setupR.state;
    state = applyCommand(state, { type: 'setSolved', cardId, solved: true }).state;
    expect(effectiveKeywords(state, cardId)).toEqual([]);
  });
});

// --- setSolved command ---

describe('setSolved command', () => {
  it('sets the designation with a Japanese log', () => {
    const setupR = caseGame('cg-cmd-set', CASE_TEXT);
    const cardId = setupR.cardId;
    let state = setupR.state;
    const before = state.log.length;
    state = applyCommand(state, { type: 'setSolved', cardId, solved: true }).state;
    expect(state.cards[cardId]?.solved).toBe(true);
    expect(state.log.length).toBe(before + 1);
    expect(state.log.at(-1)?.message).toContain('解決された');
  });

  it('is idempotent — same value, no state change, no log', () => {
    const setupR = caseGame('cg-cmd-idempotent', CASE_TEXT);
    const cardId = setupR.cardId;
    let state = setupR.state;
    state = applyCommand(state, { type: 'setSolved', cardId, solved: true }).state;
    const before = state;
    const result = applyCommand(state, { type: 'setSolved', cardId, solved: true });
    expect(result.state.cards[cardId]?.solved).toBe(true);
    expect(result.state.log.length).toBe(before.log.length);
  });

  it('unset path logs the cancellation', () => {
    const setupR = caseGame('cg-cmd-unset', CASE_TEXT);
    const cardId = setupR.cardId;
    let state = setupR.state;
    state = applyCommand(state, { type: 'setSolved', cardId, solved: true }).state;
    state = applyCommand(state, { type: 'setSolved', cardId, solved: false }).state;
    expect(state.cards[cardId]?.solved).toBe(false);
    expect(state.log.at(-1)?.message).toContain('解決状態を取り消した');
  });

  it('same-zone reorder preserves the designation', () => {
    const setupR = caseGame('cg-cmd-reorder', CASE_TEXT);
    const cardId = setupR.cardId;
    let state = setupR.state;
    state = applyCommand(state, { type: 'setSolved', cardId, solved: true }).state;
    state = applyCommand(state, { type: 'moveCard', cardId, to: 'battlefield', position: 'top' }).state;
    expect(state.cards[cardId]?.solved).toBe(true);
    expect(effectiveKeywords(state, cardId)).toContain('flying');
  });

  it('throws for an unknown card', () => {
    const { state } = caseGame('cg-cmd-missing', CASE_TEXT);
    expect(() => applyCommand(state, { type: 'setSolved', cardId: 'nope', solved: true })).toThrow();
  });
});
// verifies: ENG-CMD-004
// verifies: ENG-COMP-003
