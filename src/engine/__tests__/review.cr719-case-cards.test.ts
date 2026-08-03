// Reviewer-owned adversarial tests for CR719 Case Cards (§34.52).
// 実装エージェント(Codex含む)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// CR grounding (pinned CR 2026-06-19):
// - 719.2: Case frame has no additional rules meaning.
// - 719.3a: "To solve — [Condition]" (automatic evaluation deferred to guided/manual).
// - 719.3b: Solved is a designation; persists until leaving the battlefield; not copiable.
// - 719.3c / 702.169b: "Solved — [static]" = "As long as this Case is solved, [ability]."
// - 702.169c/d: triggered/activated Solved gating deferred.
import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { applyCommand } from '../commands';
import { initGame } from '../init';
import { effectiveKeywords } from '../status';
import { parseCaseSections } from '../caseGrammar';
import type { GameState } from '../types';
import { makeDef } from './helpers';

// --- Fixtures ---

function caseDef(id: string, oracleText: string, typeLine = 'Enchantment — Case'): CardDef {
  return makeDef({ scryfallId: id, name: id, typeLine, faces: [{ name: id, typeLine, oracleText }] });
}

function move(state: GameState, cardId: string, to: 'battlefield' | 'hand' | 'graveyard'): GameState {
  return applyCommand(state, { type: 'moveCard', cardId, to, position: 'bottom' }).state;
}

function idOf(state: GameState, defId: string): string {
  return Object.values(state.cards).find((card) => card.defId === defId)?.id ?? '';
}

// Synthetic Case with a solved-gated keyword grant:
const CASE_TEXT = [
  'To solve — You control three or more creatures.',
  'Solved — This Case has flying.',
  'Solved — This Case has vigilance and lifelink.',
].join('\n');

// --- C1–C2: solved designation + gated keywords ---

describe('CR719 Case Cards: solved designation (719.3b)', () => {
  it('C1: Case enters unsolved; no solved-gated keywords', () => {
    const def = caseDef('c1-case', CASE_TEXT);
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'c1-case');
    state = move(state, id, 'battlefield');
    expect(state.cards[id]?.solved ?? false).toBe(false);
    const kws = effectiveKeywords(state, id);
    expect(kws).not.toContain('flying');
    expect(kws).not.toContain('vigilance');
  });

  it('C2: setSolved(true) grants static keywords from Solved lines (702.169b)', () => {
    const def = caseDef('c2-case', CASE_TEXT);
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'c2-case');
    state = move(state, id, 'battlefield');
    state = applyCommand(state, { type: 'setSolved', cardId: id, solved: true }).state;
    expect(state.cards[id]?.solved).toBe(true);
    const kws = effectiveKeywords(state, id);
    expect(kws).toContain('flying');
    expect(kws).toContain('vigilance');
    expect(kws).toContain('lifelink');
  });

  it('C3: setSolved idempotent — no duplicate log on same value', () => {
    const def = caseDef('c3-case', CASE_TEXT);
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'c3-case');
    state = move(state, id, 'battlefield');
    state = applyCommand(state, { type: 'setSolved', cardId: id, solved: true }).state;
    const logLen = state.log.length;
    const result = applyCommand(state, { type: 'setSolved', cardId: id, solved: true });
    expect(result.state.log.length).toBe(logLen);
  });

  it('C3b: setSolved emits Japanese log on change', () => {
    const def = caseDef('c3b-case', CASE_TEXT);
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'c3b-case');
    state = move(state, id, 'battlefield');
    const result = applyCommand(state, { type: 'setSolved', cardId: id, solved: true });
    expect(result.state.log.length).toBeGreaterThan(state.log.length);
    expect(result.state.log.at(-1)?.message).toContain('解決');
  });
});

// --- C4–C5: zone-change semantics (400.7 / 719.3b) ---

describe('CR719 Case Cards: zone-change semantics', () => {
  it('C4: Case leaving the battlefield loses solved; re-entry is unsolved', () => {
    const def = caseDef('c4-case', CASE_TEXT);
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'c4-case');
    state = move(state, id, 'battlefield');
    state = applyCommand(state, { type: 'setSolved', cardId: id, solved: true }).state;
    expect(state.cards[id]?.solved).toBe(true);
    state = move(state, id, 'hand');
    expect(state.cards[id]?.solved ?? false).toBe(false);
    state = move(state, id, 'battlefield');
    expect(state.cards[id]?.solved ?? false).toBe(false);
    expect(effectiveKeywords(state, id)).not.toContain('flying');
  });

  it('C5: same-zone reorder preserves solved (no new object)', () => {
    const def = caseDef('c5-case', CASE_TEXT);
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'c5-case');
    state = move(state, id, 'battlefield');
    state = applyCommand(state, { type: 'setSolved', cardId: id, solved: true }).state;
    state = applyCommand(state, { type: 'moveCard', cardId: id, to: 'battlefield', position: 'top' }).state;
    expect(state.cards[id]?.solved).toBe(true);
    expect(effectiveKeywords(state, id)).toContain('flying');
  });
});

// --- C6: parseCaseSections grammar (719.3) ---

describe('CR719 Case Cards: parseCaseSections', () => {
  it('C6: parses To solve condition and Solved lines', () => {
    const sections = parseCaseSections(CASE_TEXT);
    expect(sections.toSolveCondition).toBe('You control three or more creatures.');
    expect(sections.solvedAbilities).toEqual([
      'This Case has flying.',
      'This Case has vigilance and lifelink.',
    ]);
  });

  it('C6b: en-dash and hyphen variants', () => {
    const a = parseCaseSections('To solve – A.\nSolved – This Case has flying.');
    expect(a.toSolveCondition).toBe('A.');
    expect(a.solvedAbilities).toEqual(['This Case has flying.']);
    const b = parseCaseSections('To solve - B.\nSolved - This Case has trample.');
    expect(b.toSolveCondition).toBe('B.');
    expect(b.solvedAbilities).toEqual(['This Case has trample.']);
  });

  it('C6c: empty/missing oracle text → empty sections', () => {
    expect(parseCaseSections('')).toEqual({ solvedAbilities: [] });
    expect(parseCaseSections(undefined)).toEqual({ solvedAbilities: [] });
    expect(parseCaseSections(null)).toEqual({ solvedAbilities: [] });
  });

  it('C6d: non-Case text without prefixes → empty sections', () => {
    const sections = parseCaseSections('Flying\nWhenever you cast a spell, draw a card.');
    expect(sections.toSolveCondition).toBeUndefined();
    expect(sections.solvedAbilities).toEqual([]);
  });
});

// --- C7–C8: boundaries ---

describe('CR719 Case Cards: boundaries', () => {
  it('C7: non-Case permanent can carry the designation but gates only its own Solved lines', () => {
    const def = makeDef({
      scryfallId: 'c7-creature',
      name: 'c7-creature',
      typeLine: 'Creature — Bear',
      faces: [{ name: 'c7-creature', typeLine: 'Creature — Bear', oracleText: 'Just a bear.' }],
    });
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'c7-creature');
    state = move(state, id, 'battlefield');
    state = applyCommand(state, { type: 'setSolved', cardId: id, solved: true }).state;
    expect(state.cards[id]?.solved).toBe(true);
    // No Solved lines in its text → no keyword change.
    expect(effectiveKeywords(state, id)).not.toContain('flying');
  });

  it('C8: top-section static line unaffected by solved state', () => {
    const text = 'This Case has hexproof.\nTo solve — A.\nSolved — This Case has flying.';
    const def = caseDef('c8-case', text);
    let state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'c8-case');
    state = move(state, id, 'battlefield');
    expect(effectiveKeywords(state, id)).toContain('hexproof');
    expect(effectiveKeywords(state, id)).not.toContain('flying');
    state = applyCommand(state, { type: 'setSolved', cardId: id, solved: true }).state;
    expect(effectiveKeywords(state, id)).toContain('hexproof');
    expect(effectiveKeywords(state, id)).toContain('flying');
  });

  it('C9: off-battlefield Case never grants solved-gated keywords', () => {
    const def = caseDef('c9-case', CASE_TEXT);
    const state = initGame([{ def, isCommander: false }], 1);
    const id = idOf(state, 'c9-case');
    // in library by default, not solved
    expect(effectiveKeywords(state, id)).not.toContain('flying');
  });
});
