// Reviewer-owned adversarial tests for CR720 Omen Cards (§34.53).
// 実装エージェント(Codex含む)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// CR grounding (pinned CR 2026-06-19):
// - 720.3: casting an omen card chooses normal or Omen characteristics.
// - 720.3b: on the stack as an Omen, only alternative characteristics.
// - 720.3c: a copy of an Omen spell is an Omen with the alternative characteristics.
// - 707.10a: a copy of a spell can never exist outside the stack (ceases to exist).
// - 720.3d: as an Omen spell resolves, shuffle it into its owner's library.
// - 720.4: off the stack, only normal characteristics.
import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { applyCommand, EngineError } from '../commands';
import { initGame } from '../init';
import type { GameState, ManaPool } from '../types';
import { makeDef } from './helpers';

const EMPTY_PAYMENT: ManaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };

function omenDef(id: string, normalType = 'Instant'): CardDef {
  return makeDef({
    scryfallId: id,
    name: id,
    layout: 'omen',
    typeLine: normalType,
    faces: [
      { name: id, typeLine: normalType, oracleText: 'Draw a card.', manaCost: '{2}' },
      { name: `${id}-omen`, typeLine: 'Instant', oracleText: 'Scry 1.', manaCost: '{1}' },
    ],
  });
}

function setup(omenId: string, extraDefs: CardDef[] = []): { state: GameState; cardId: string } {
  const defs = [omenDef(omenId), ...extraDefs];
  let state = initGame(defs.map((def) => ({ def, isCommander: false })), 1);
  const cardId = Object.values(state.cards).find((c) => c.defId === omenId)?.id ?? '';
  state = applyCommand(state, { type: 'moveCard', cardId, to: 'hand', position: 'top' }).state;
  return { state, cardId };
}

function libraryOf(state: GameState, playerId = 'P1'): string[] {
  return state.zonesByPlayer[playerId]?.library ?? [];
}

// --- O1: cast as Omen puts face 1 characteristics on the stack (720.3/720.3b) ---

describe('CR720 Omen Cards: cast choice (720.3)', () => {
  it('O1: castToStack as Omen sets faceIndex 1 and castAsOmen', () => {
    const { state, cardId } = setup('o1-omen');
    const result = applyCommand(state, {
      type: 'castToStack',
      cardId,
      payment: EMPTY_PAYMENT,
      forced: true,
      faceIndex: 1,
      castAsOmen: true,
    });
    const stacked = result.state.cards[cardId];
    expect(stacked?.zone).toBe('stack');
    expect(stacked?.faceIndex).toBe(1);
    expect(stacked?.castAsOmen).toBe(true);
  });

  it('O8: normal cast of an omen card leaves no castAsOmen flag', () => {
    const { state, cardId } = setup('o8-omen');
    let s = applyCommand(state, {
      type: 'castToStack',
      cardId,
      payment: EMPTY_PAYMENT,
      forced: true,
      faceIndex: 0,
    }).state;
    expect(s.cards[cardId]?.castAsOmen).toBeFalsy();
    s = applyCommand(s, { type: 'resolveStackTop' }).state;
    expect(s.cards[cardId]?.zone).toBe('graveyard');
  });

  it('O7: castAsOmen on a non-omen card throws', () => {
    const normal = makeDef({ scryfallId: 'o7-normal', typeLine: 'Instant', faces: [{ name: 'o7-normal', typeLine: 'Instant', oracleText: 'Draw a card.' }] });
    const { state, cardId } = setup('o7-omen-card', [normal]);
    const normalId = Object.values(state.cards).find((c) => c.defId === 'o7-normal')?.id ?? '';
    const s = applyCommand(state, { type: 'moveCard', cardId: normalId, to: 'hand', position: 'top' }).state;
    expect(() =>
      applyCommand(s, { type: 'castToStack', cardId: normalId, payment: EMPTY_PAYMENT, forced: true, castAsOmen: true, faceIndex: 1 }),
    ).toThrow(EngineError);
    // Also: omen layout but faceIndex 0 with castAsOmen must throw.
    expect(() =>
      applyCommand(s, { type: 'castToStack', cardId, payment: EMPTY_PAYMENT, forced: true, castAsOmen: true, faceIndex: 0 }),
    ).toThrow(EngineError);
  });
});

// --- O2/O3: Omen resolution shuffles into the library (720.3d) ---

describe('CR720 Omen Cards: Omen resolution (720.3d)', () => {
  it('O2: resolving an Omen spell shuffles it into the owner library', () => {
    const { state, cardId } = setup('o2-omen');
    let s = applyCommand(state, {
      type: 'castToStack',
      cardId,
      payment: EMPTY_PAYMENT,
      forced: true,
      faceIndex: 1,
      castAsOmen: true,
    }).state;
    const libBefore = libraryOf(s);
    const order = [...libBefore.slice(1), cardId, ...libBefore.slice(0, 1)];
    expect(order).toHaveLength(libBefore.length + 1);
    s = applyCommand(s, { type: 'resolveStackTop', libraryShuffleOrder: order }).state;
    expect(s.cards[cardId]?.zone).toBe('library');
    expect(libraryOf(s)).toContain(cardId);
    expect(s.zones.graveyard).not.toContain(cardId);
  });

  it('O3: resolving an Omen spell without a shuffle order degrades to library top + warning', () => {
    const { state, cardId } = setup('o3-omen');
    let s = applyCommand(state, {
      type: 'castToStack',
      cardId,
      payment: EMPTY_PAYMENT,
      forced: true,
      faceIndex: 1,
      castAsOmen: true,
    }).state;
    const result = applyCommand(s, { type: 'resolveStackTop' });
    s = result.state;
    expect(s.cards[cardId]?.zone).toBe('library');
    expect(libraryOf(s)[0]).toBe(cardId);
    expect(result.warnings.some((w) => w.includes('オメン'))).toBe(true);
  });
});

// --- O4: countered Omen goes to graveyard as a normal card (720.4) ---

describe('CR720 Omen Cards: leaving the stack (720.4)', () => {
  it('O4: countered Omen spell goes to graveyard, flags cleared', () => {
    const { state, cardId } = setup('o4-omen');
    let s = applyCommand(state, {
      type: 'castToStack',
      cardId,
      payment: EMPTY_PAYMENT,
      forced: true,
      faceIndex: 1,
      castAsOmen: true,
    }).state;
    s = applyCommand(s, { type: 'removeStackItem', id: cardId }).state;
    const card = s.cards[cardId];
    expect(card?.zone).toBe('graveyard');
    expect(card?.castAsOmen).toBeFalsy();
    expect(card?.faceIndex).toBe(0);
  });
});

// --- O5: copy propagation (720.3c) ---

describe('CR720 Omen Cards: copy (720.3c)', () => {
  it('O5: copying an Omen spell produces an Omen copy', () => {
    const { state, cardId } = setup('o5-omen');
    let s = applyCommand(state, {
      type: 'castToStack',
      cardId,
      payment: EMPTY_PAYMENT,
      forced: true,
      faceIndex: 1,
      castAsOmen: true,
    }).state;
    s = applyCommand(s, { type: 'copyStackItem', cardId, quantity: 1 }).state;
    const stackIds = s.zones.stack.filter((id) => id !== cardId);
    expect(stackIds).toHaveLength(1);
    const copy = s.cards[stackIds[0]];
    expect(copy?.castAsOmen).toBe(true);
    expect(copy?.faceIndex).toBe(1);
    expect(copy?.isCopy).toBe(true);
    // CR 707.10a: resolving the Omen copy applies its effects, then the copy
    // ceases to exist — a spell copy can never exist in a library.
    const copyId = stackIds[0];
    const libBefore = libraryOf(s);
    s = applyCommand(s, { type: 'resolveStackTop', libraryShuffleOrder: [...libBefore, copyId] }).state;
    expect(s.cards[copyId]).toBeUndefined();
    expect(libraryOf(s)).not.toContain(copyId);
    // The original Omen spell is still on the stack with its cast choice intact.
    expect(s.zones.stack).toContain(cardId);
    expect(s.cards[cardId]?.castAsOmen).toBe(true);
    // Resolving the original shuffles it into the library (720.3d).
    const order = [...libraryOf(s), cardId];
    s = applyCommand(s, { type: 'resolveStackTop', libraryShuffleOrder: order }).state;
    expect(s.cards[cardId]?.zone).toBe('library');
  });
});

// --- O6: immediate castSpell path (720.3d) ---

describe('CR720 Omen Cards: immediate castSpell (720.3d)', () => {
  it('O6: castSpell as Omen lands in the library, not the graveyard', () => {
    const { state, cardId } = setup('o6-omen');
    const libBefore = libraryOf(state);
    const order = [...libBefore, cardId];
    const s = applyCommand(state, {
      type: 'castSpell',
      cardId,
      payment: EMPTY_PAYMENT,
      forced: true,
      faceIndex: 1,
      castAsOmen: true,
      libraryShuffleOrder: order,
    }).state;
    expect(s.cards[cardId]?.zone).toBe('library');
    expect(s.zones.graveyard).not.toContain(cardId);
  });
});
