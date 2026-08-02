import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { applyCommand, performStateBasedActions } from '../commands';
import { initGame } from '../init';
import { parseSagaChapters, finalChapterNumber } from '../sagaGrammar';
import type { GameState } from '../types';
import { makeDef } from './helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sagaDef(
  scryfallId: string,
  oracleText: string,
  typeLine = 'Enchantment — Saga',
): CardDef {
  return makeDef({
    scryfallId,
    typeLine,
    faces: [{ name: scryfallId, typeLine, oracleText }],
  });
}

function idOf(s: GameState, scryfallId: string): string {
  const entry = Object.entries(s.cards).find(
    ([, c]) => c.defId === scryfallId || s.defs[c.defId]?.scryfallId === scryfallId,
  );
  if (!entry) throw new Error(`card not found: ${scryfallId}`);
  return entry[0];
}

function setupSaga(oracleText: string): { state: GameState; sagaId: string } {
  const def = sagaDef('test-saga', oracleText);
  let s = initGame([{ def, isCommander: false }], 1);
  s = applyCommand(s, { type: 'draw', count: 1 }).state;
  const sagaId = idOf(s, 'test-saga');
  s = applyCommand(s, { type: 'moveCard', cardId: sagaId, to: 'battlefield', position: 'bottom' }).state;
  return { state: s, sagaId };
}

function advanceToMain1(s: GameState): GameState {
  // From untap: nextPhase → upkeep → draw → main1
  s = applyCommand(s, { type: 'nextPhase' }).state;
  s = applyCommand(s, { type: 'nextPhase' }).state;
  s = applyCommand(s, { type: 'nextPhase' }).state;
  return s;
}

// ---------------------------------------------------------------------------
// A: Grammar (CR 714.2b/714.2c/714.2d)
// ---------------------------------------------------------------------------

describe('review: CR 714.2b/2c/2d — chapter grammar', () => {
  it('A1: parses standard 3-chapter Saga', () => {
    const abilities = parseSagaChapters(
      'I — Draw a card.\nII — Each opponent loses 2 life.\nIII — You gain 4 life.',
    );
    expect(abilities).toHaveLength(3);
    expect(abilities[0].chapters).toEqual([1]);
    expect(abilities[1].chapters).toEqual([2]);
    expect(abilities[2].chapters).toEqual([3]);
  });

  it('A2: multi-chapter line (714.2c)', () => {
    const abilities = parseSagaChapters('I — Scry 1.\nII, III — Each opponent loses 2 life.');
    expect(abilities).toHaveLength(2);
    expect(abilities[1].chapters).toEqual([2, 3]);
  });

  it('A3: finalChapterNumber returns max (714.2d)', () => {
    const abilities = parseSagaChapters('I — A.\nII, III — B.\nIV — C.');
    expect(finalChapterNumber(abilities)).toBe(4);
  });

  it('A4: empty oracle → no abilities, finalChapter 0', () => {
    expect(parseSagaChapters('')).toEqual([]);
    expect(finalChapterNumber([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// B: ETB lore counter + chapter I trigger (CR 714.3a + 714.2b)
// ---------------------------------------------------------------------------

describe('review: CR 714.3a/714.2b — ETB chapter trigger', () => {
  it('B1: Saga enters with lore=1 and chapter I triggers', () => {
    const { state, sagaId } = setupSaga('I — Draw a card.\nII — You gain 3 life.');
    expect(state.cards[sagaId].counters.lore).toBe(1);
    const triggers = state.pendingTriggers.filter((t) => t.sourceId === sagaId);
    expect(triggers.length).toBeGreaterThanOrEqual(1);
    expect(triggers[0].triggerId).toContain('saga-chapter');
    expect(triggers[0].resolutionText).toBe('Draw a card.');
  });

  it('B2: Saga with no chapter abilities enters with lore=1 but no trigger', () => {
    const { state, sagaId } = setupSaga('This Saga has no chapters.');
    expect(state.cards[sagaId].counters.lore).toBe(1);
    const triggers = state.pendingTriggers.filter((t) => t.sourceId === sagaId);
    expect(triggers).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// C: Turn-based lore increment at main1 (CR 714.3c)
// ---------------------------------------------------------------------------

describe('review: CR 714.3c — precombat main lore increment', () => {
  it('C1: lore does NOT increase at untap', () => {
    const { state, sagaId } = setupSaga('I — A.\nII — B.\nIII — C.');
    // nextTurn lands at untap
    const s2 = applyCommand(state, { type: 'nextTurn' }).state;
    expect(s2.phase).toBe('untap');
    expect(s2.cards[sagaId].counters.lore).toBe(1); // unchanged at untap
  });

  it('C2: lore increases at main1 entry', () => {
    const { state, sagaId } = setupSaga('I — A.\nII — B.\nIII — C.');
    let s = applyCommand(state, { type: 'nextTurn' }).state;
    s = advanceToMain1(s);
    expect(s.phase).toBe('main1');
    expect(s.cards[sagaId].counters.lore).toBe(2);
  });

  it('C3: chapter II trigger fires at main1 when lore crosses 2', () => {
    const { state, sagaId } = setupSaga('I — A.\nII — B.\nIII — C.');
    let s = applyCommand(state, { type: 'nextTurn' }).state;
    s = advanceToMain1(s);
    const ch2 = s.pendingTriggers.find(
      (t) => t.sourceId === sagaId && t.resolutionText === 'B.',
    );
    expect(ch2).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// D: SBA 714.4 — final chapter sacrifice
// ---------------------------------------------------------------------------

describe('review: CR 714.4 — final chapter sacrifice SBA', () => {
  it('D1: Saga at final chapter with no pending trigger is sacrificed', () => {
    // 2-chapter Saga: ETB → lore=1, ch I triggers.
    const { state, sagaId } = setupSaga('I — A.\nII — B.');
    // Resolve chapter I trigger (simulate stack resolution)
    let s: GameState = {
      ...state,
      pendingTriggers: state.pendingTriggers.filter((t) => t.sourceId !== sagaId),
    };
    // Advance to next turn main1: lore 1→2 = final chapter, ch II triggers
    s = applyCommand(s, { type: 'nextTurn' }).state;
    s = advanceToMain1(s);
    expect(s.cards[sagaId].counters.lore).toBe(2);
    // Ch II trigger is pending → SBA correctly holds sacrifice
    expect(s.cards[sagaId].zone).toBe('battlefield');
    // Resolve ch II trigger → next SBA check sacrifices
    s = {
      ...s,
      pendingTriggers: s.pendingTriggers.filter((t) => t.sourceId !== sagaId),
    };
    // Trigger SBA via performStateBasedActions
    s = performStateBasedActions(s).state;
    expect(s.cards[sagaId].zone).toBe('graveyard');
  });

  it('D2: Saga at final chapter WITH pending trigger is NOT sacrificed', () => {
    const { state, sagaId } = setupSaga('I — A.\nII — B.');
    // Resolve chapter I trigger
    let s: GameState = {
      ...state,
      pendingTriggers: state.pendingTriggers.filter((t) => t.sourceId !== sagaId),
    };
    s = applyCommand(s, { type: 'nextTurn' }).state;
    s = advanceToMain1(s);
    // Chapter II trigger should be pending — SBA must NOT sacrifice yet
    const ch2 = s.pendingTriggers.find(
      (t) => t.sourceId === sagaId && t.triggerId.startsWith('saga-chapter-'),
    );
    expect(ch2).toBeDefined();
    expect(s.cards[sagaId].zone).toBe('battlefield');
  });

  it('D3: Saga below final chapter is NOT sacrificed', () => {
    const { state, sagaId } = setupSaga('I — A.\nII — B.\nIII — C.');
    // lore=1, final=3 → safe
    expect(state.cards[sagaId].zone).toBe('battlefield');
  });

  it('D4: SBA log mentions 714.4', () => {
    const { state, sagaId } = setupSaga('I — A.\nII — B.');
    let s: GameState = {
      ...state,
      pendingTriggers: state.pendingTriggers.filter((t) => t.sourceId !== sagaId),
    };
    s = applyCommand(s, { type: 'nextTurn' }).state;
    s = advanceToMain1(s);
    // Resolve pending chapter trigger first
    s = {
      ...s,
      pendingTriggers: s.pendingTriggers.filter((t) => t.sourceId !== sagaId),
    };
    s = performStateBasedActions(s).state;
    const logEntry = s.log.find((l) => l.message.includes('714.4'));
    expect(logEntry).toBeDefined();
  });
});
