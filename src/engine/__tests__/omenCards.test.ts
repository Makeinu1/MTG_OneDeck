// Implementer-owned ordinary tests for CR720 Omen Cards (§34.53 design contract
// research/cr-grounding/cr720-omen-cards.draft.md). Judge-owned golden tests
// live in review.cr720-omen-cards.test.ts — do not mirror or modify them here.
//
// CR grounding (pinned CR 2026-06-19):
// - 720.2/720.3: the omen layout defines alternative characteristics; casting
//   chooses either the normal or the Omen characteristics.
// - 720.3b: on the stack as an Omen, only the alternative characteristics apply.
// - 720.3c: a copy of an Omen spell is an Omen with the alternative characteristics.
// - 720.3d: as an Omen spell resolves, it is shuffled into its owner's library.
// - 720.4: off the stack, only the normal characteristics apply.
// - 707.10a: a copy of a spell can never exist in any zone other than the stack.
import { describe, expect, it } from 'vitest';

import type { CardDef } from '../../types/card';
import { applyCommand } from '../commands';
import { initGame, type InitDeckCard } from '../init';
import type { GameState, ManaPool } from '../types';
import { makeDeck, makeDef } from './helpers';

const EMPTY_PAYMENT: ManaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };

const CAST_REJECT_MESSAGE = 'オメンとして唱えられるカードではありません。';
const OMEN_ORDER_WARNING =
  'オメン呪文の解決にはライブラリのシャッフル順列が必要です(一番上に配置)。';
const OMEN_RESOLVE_LOG = 'オメン: ライブラリへシャッフル';

function omenCardDef(id: string): CardDef {
  return makeDef({
    scryfallId: id,
    name: id,
    layout: 'omen',
    typeLine: 'Instant',
    faces: [
      { name: id, typeLine: 'Instant', oracleText: 'You gain 1 life.', manaCost: '{2}' },
      {
        name: `${id}-omen-face`,
        typeLine: 'Instant',
        oracleText: 'You gain 2 life.',
        manaCost: '{1}',
      },
    ],
  });
}

function plainInstantDef(id: string): CardDef {
  return makeDef({
    scryfallId: id,
    name: id,
    typeLine: 'Instant',
    faces: [{ name: id, typeLine: 'Instant', oracleText: 'You gain 1 life.', manaCost: '{2}' }],
  });
}

function omenGame(omenId: string): { state: GameState; omenInstanceId: string } {
  const entries: InitDeckCard[] = [
    { def: omenCardDef(omenId), isCommander: false },
    ...makeDeck(8),
  ];
  const state = initGame(entries, 720);
  const omenInstanceId = Object.values(state.cards).find((c) => c.defId === omenId)?.id ?? '';
  expect(omenInstanceId).not.toBe('');
  return { state, omenInstanceId };
}

function validationGame(): { state: GameState; normalId: string; omenId: string } {
  const entries: InitDeckCard[] = [
    { def: plainInstantDef('validate-normal'), isCommander: false },
    { def: omenCardDef('validate-omen'), isCommander: false },
    ...makeDeck(6),
  ];
  let state = initGame(entries, 720);
  const normalId = Object.values(state.cards).find((c) => c.defId === 'validate-normal')?.id ?? '';
  const omenId = Object.values(state.cards).find((c) => c.defId === 'validate-omen')?.id ?? '';
  expect(normalId).not.toBe('');
  expect(omenId).not.toBe('');
  state = toHand(state, normalId);
  state = toHand(state, omenId);
  return { state, normalId, omenId };
}

function toHand(state: GameState, cardId: string): GameState {
  return applyCommand(state, { type: 'moveCard', cardId, to: 'hand', position: 'top' }).state;
}

function libraryOf(state: GameState): string[] {
  return state.zonesByPlayer['P1']?.library ?? [];
}

function stackTopId(state: GameState): string {
  return state.zones.stack[state.zones.stack.length - 1];
}

function castAsOmenToStack(state: GameState, cardId: string): GameState {
  return applyCommand(state, {
    type: 'castToStack',
    cardId,
    payment: EMPTY_PAYMENT,
    forced: true,
    faceIndex: 1,
    castAsOmen: true,
  }).state;
}

// --- 720.3: cast validation ------------------------------------------------

describe('CR720 Omen Cards: cast validation (720.3)', () => {
  it('rejects castAsOmen on a non-omen layout from both cast commands', () => {
    const { state, normalId } = validationGame();
    // faceIndex stays 0 so the failure is the omen-layout validation itself,
    // not the face-existence check.
    expect(() =>
      applyCommand(state, {
        type: 'castToStack',
        cardId: normalId,
        payment: EMPTY_PAYMENT,
        forced: true,
        faceIndex: 0,
        castAsOmen: true,
      }),
    ).toThrow(CAST_REJECT_MESSAGE);
    expect(() =>
      applyCommand(state, {
        type: 'castSpell',
        cardId: normalId,
        payment: EMPTY_PAYMENT,
        forced: true,
        faceIndex: 0,
        castAsOmen: true,
      }),
    ).toThrow(CAST_REJECT_MESSAGE);
    // A rejected cast must leave the game state untouched.
    expect(state.cards[normalId]?.zone).toBe('hand');
    expect(state.zones.stack).toHaveLength(0);
    expect(state.spellsCastThisTurn).toBe(0);
  });

  it('rejects castAsOmen when the normal face (index 0) is chosen', () => {
    const { state, omenId } = validationGame();
    expect(() =>
      applyCommand(state, {
        type: 'castToStack',
        cardId: omenId,
        payment: EMPTY_PAYMENT,
        forced: true,
        faceIndex: 0,
        castAsOmen: true,
      }),
    ).toThrow(CAST_REJECT_MESSAGE);
    expect(() =>
      applyCommand(state, {
        type: 'castSpell',
        cardId: omenId,
        payment: EMPTY_PAYMENT,
        forced: true,
        faceIndex: 0,
        castAsOmen: true,
      }),
    ).toThrow(CAST_REJECT_MESSAGE);
    expect(state.cards[omenId]?.zone).toBe('hand');
    expect(state.zones.stack).toHaveLength(0);
    expect(state.spellsCastThisTurn).toBe(0);
  });

  it('normal cast of an omen card keeps the graveyard path without the flag', () => {
    const { state, omenInstanceId } = omenGame('omen-normal-cast');
    let s = toHand(state, omenInstanceId);
    const castsBefore = s.spellsCastThisTurn;
    s = applyCommand(s, {
      type: 'castToStack',
      cardId: omenInstanceId,
      payment: EMPTY_PAYMENT,
      forced: true,
      faceIndex: 0,
    }).state;
    expect(s.cards[omenInstanceId]?.castAsOmen).toBeFalsy();
    expect(s.spellsCastThisTurn).toBe(castsBefore + 1);
    s = applyCommand(s, { type: 'resolveStackTop' }).state;
    expect(s.cards[omenInstanceId]).toMatchObject({ zone: 'graveyard', faceIndex: 0 });
    expect(s.life).toBe(41); // face-0 effect applied through the normal path
    expect(s.log.some((entry) => entry.message.includes(OMEN_RESOLVE_LOG))).toBe(false);
  });
});

// --- 720.3b: Omen characteristics on the stack ------------------------------

describe('CR720 Omen Cards: Omen characteristics on the stack (720.3b)', () => {
  it('marks the stack object with faceIndex 1 and castAsOmen', () => {
    const { state, omenInstanceId } = omenGame('omen-stack-flag');
    const s0 = toHand(state, omenInstanceId);
    const castsBefore = s0.spellsCastThisTurn;
    const s = castAsOmenToStack(s0, omenInstanceId);
    const stacked = s.cards[omenInstanceId];
    expect(stacked).toMatchObject({ zone: 'stack', faceIndex: 1, castAsOmen: true });
    // The stacked object's characteristics come from face 1 (the Omen face).
    const def = s.defs['omen-stack-flag'];
    expect(def).toBeDefined();
    expect(def?.faces[stacked?.faceIndex ?? 0]).toMatchObject({
      name: 'omen-stack-flag-omen-face',
      typeLine: 'Instant',
    });
    expect(s.spellsCastThisTurn).toBe(castsBefore + 1);
  });
});

// --- 720.3d: Omen resolution shuffles into the library ----------------------

describe('CR720 Omen Cards: Omen resolution (720.3d)', () => {
  it('resolving with a shuffle order permutes the library exactly', () => {
    const { state, omenInstanceId } = omenGame('omen-resolve-order');
    let s = castAsOmenToStack(toHand(state, omenInstanceId), omenInstanceId);
    const libBefore = libraryOf(s);
    expect(libBefore).not.toContain(omenInstanceId);
    // Drop the Omen three cards from the top to prove the permutation is used.
    const order = [...libBefore.slice(0, 2), omenInstanceId, ...libBefore.slice(2)];
    s = applyCommand(s, { type: 'resolveStackTop', libraryShuffleOrder: order }).state;
    expect(s.cards[omenInstanceId]).toMatchObject({ zone: 'library', faceIndex: 0 });
    expect(libraryOf(s)).toEqual(order);
    expect(s.zones.graveyard).not.toContain(omenInstanceId);
    // The face-1 compiled effect still applies during Omen resolution.
    expect(s.life).toBe(42);
    expect(s.log.some((entry) => entry.message.includes(OMEN_RESOLVE_LOG))).toBe(true);
  });

  it('resolving without an order degrades to library top + honest warning', () => {
    const { state, omenInstanceId } = omenGame('omen-resolve-no-order');
    let s = castAsOmenToStack(toHand(state, omenInstanceId), omenInstanceId);
    const result = applyCommand(s, { type: 'resolveStackTop' });
    s = result.state;
    expect(s.cards[omenInstanceId]).toMatchObject({ zone: 'library', faceIndex: 0 });
    expect(libraryOf(s)[0]).toBe(omenInstanceId);
    expect(result.warnings).toContain(OMEN_ORDER_WARNING);
    expect(s.life).toBe(42);
  });
});

// --- 720.4: countered Omen reverts to the normal card -----------------------

describe('CR720 Omen Cards: countered spell (720.4)', () => {
  it('a countered Omen spell goes to the graveyard as a normal card', () => {
    const { state, omenInstanceId } = omenGame('omen-countered');
    let s = castAsOmenToStack(toHand(state, omenInstanceId), omenInstanceId);
    expect(s.cards[omenInstanceId]?.castAsOmen).toBe(true);
    s = applyCommand(s, { type: 'removeStackItem', id: omenInstanceId }).state;
    expect(s.cards[omenInstanceId]).toMatchObject({ zone: 'graveyard', faceIndex: 0 });
    expect(s.cards[omenInstanceId]?.castAsOmen).toBeUndefined();
    expect(s.life).toBe(40); // nothing resolved
    expect(s.log.some((entry) => entry.message.includes(OMEN_RESOLVE_LOG))).toBe(false);
  });
});

// --- 720.3c + 707.10a: copies ------------------------------------------------

describe('CR720 Omen Cards: copies (720.3c + 707.10a)', () => {
  it('propagates castAsOmen and faceIndex to the copy (720.3c)', () => {
    const { state, omenInstanceId } = omenGame('omen-copy-props');
    let s = castAsOmenToStack(toHand(state, omenInstanceId), omenInstanceId);
    s = applyCommand(s, { type: 'copyStackItem', cardId: omenInstanceId, quantity: 1 }).state;
    const copyId = stackTopId(s);
    expect(copyId).not.toBe(omenInstanceId);
    const copy = s.cards[copyId];
    expect(copy).toMatchObject({ isCopy: true, faceIndex: 1, castAsOmen: true });
    expect(copy?.defId).toBe('omen-copy-props');
  });

  it('resolving the copy deletes it and leaves the library untouched (707.10a)', () => {
    const { state, omenInstanceId } = omenGame('omen-copy-resolve');
    let s = castAsOmenToStack(toHand(state, omenInstanceId), omenInstanceId);
    s = applyCommand(s, { type: 'copyStackItem', cardId: omenInstanceId, quantity: 1 }).state;
    const copyId = stackTopId(s);
    const libBefore = libraryOf(s);
    const lifeBefore = s.life;
    // No libraryShuffleOrder is required: a spell copy can never enter the
    // library, so 720.3d has no physical card to shuffle.
    const copyResult = applyCommand(s, { type: 'resolveStackTop' });
    s = copyResult.state;
    expect(s.cards[copyId]).toBeUndefined();
    expect(libraryOf(s)).toEqual(libBefore);
    expect(copyResult.warnings).not.toContain(OMEN_ORDER_WARNING);
    expect(s.life).toBe(lifeBefore + 2); // the copy's face-1 effect still applies
    // The original remains on the stack with its cast choice intact.
    expect(s.zones.stack).toContain(omenInstanceId);
    expect(s.cards[omenInstanceId]?.castAsOmen).toBe(true);
    // Only the physical card shuffles into the library when it resolves.
    const order = [...libraryOf(s), omenInstanceId];
    s = applyCommand(s, { type: 'resolveStackTop', libraryShuffleOrder: order }).state;
    expect(s.cards[omenInstanceId]?.zone).toBe('library');
    expect(libraryOf(s)).toContain(omenInstanceId);
    expect(s.life).toBe(lifeBefore + 4);
  });
});

// --- 720.3d: immediate castSpell path ----------------------------------------

describe('CR720 Omen Cards: immediate castSpell (720.3d)', () => {
  it('moves to the library via the permutation and counts the cast', () => {
    const { state, omenInstanceId } = omenGame('omen-immediate');
    const s0 = toHand(state, omenInstanceId);
    const castsBefore = s0.spellsCastThisTurn;
    const libBefore = libraryOf(s0);
    expect(libBefore.length).toBeGreaterThan(1);
    // Bury the Omen one card below the top to prove the permutation is used.
    const order = [libBefore[0], omenInstanceId, ...libBefore.slice(1)];
    const s = applyCommand(s0, {
      type: 'castSpell',
      cardId: omenInstanceId,
      payment: EMPTY_PAYMENT,
      forced: true,
      faceIndex: 1,
      castAsOmen: true,
      libraryShuffleOrder: order,
    }).state;
    expect(s.cards[omenInstanceId]).toMatchObject({ zone: 'library', faceIndex: 0 });
    expect(libraryOf(s)).toEqual(order);
    expect(s.zones.graveyard).not.toContain(omenInstanceId);
    expect(s.spellsCastThisTurn).toBe(castsBefore + 1);
    // applyCast performs only the zone move for immediate casts; compiled
    // effects ride castToStack + resolveStackTop (judge ruling 2026-08-04).
    expect(s.life).toBe(40);
  });

  it('degrades to library top + warning when no order is provided', () => {
    const { state, omenInstanceId } = omenGame('omen-immediate-no-order');
    const s0 = toHand(state, omenInstanceId);
    const result = applyCommand(s0, {
      type: 'castSpell',
      cardId: omenInstanceId,
      payment: EMPTY_PAYMENT,
      forced: true,
      faceIndex: 1,
      castAsOmen: true,
    });
    expect(result.state.cards[omenInstanceId]?.zone).toBe('library');
    expect(libraryOf(result.state)[0]).toBe(omenInstanceId);
    expect(result.warnings).toContain(OMEN_ORDER_WARNING);
  });
});

// --- 720.4 / I57: off-stack invariant ----------------------------------------

describe('CR720 Omen Cards: off-stack invariant (720.4 / I57)', () => {
  it('bouncing an Omen spell from the stack clears the flag and restores face 0', () => {
    const { state, omenInstanceId } = omenGame('omen-bounce');
    let s = castAsOmenToStack(toHand(state, omenInstanceId), omenInstanceId);
    expect(s.cards[omenInstanceId]?.castAsOmen).toBe(true);
    s = applyCommand(s, {
      type: 'moveCard',
      cardId: omenInstanceId,
      to: 'hand',
      position: 'top',
    }).state;
    expect(s.cards[omenInstanceId]).toMatchObject({ zone: 'hand', faceIndex: 0 });
    expect(s.cards[omenInstanceId]?.castAsOmen).toBeUndefined();
  });

  it('no off-stack card ever carries castAsOmen after repeated zone changes', () => {
    const { state, omenInstanceId } = omenGame('omen-invariant');
    let s = castAsOmenToStack(toHand(state, omenInstanceId), omenInstanceId);
    // Counter the Omen spell, re-cast it, then bounce it to exile.
    s = applyCommand(s, { type: 'removeStackItem', id: omenInstanceId }).state;
    s = castAsOmenToStack(s, omenInstanceId);
    s = applyCommand(s, {
      type: 'moveCard',
      cardId: omenInstanceId,
      to: 'exile',
      position: 'bottom',
    }).state;
    expect(s.cards[omenInstanceId]).toMatchObject({ zone: 'exile', faceIndex: 0 });
    expect(s.cards[omenInstanceId]?.castAsOmen).toBeUndefined();
    for (const card of Object.values(s.cards)) {
      if (card.zone !== 'stack') {
        expect(card.castAsOmen).toBeFalsy();
      }
    }
  });
});
