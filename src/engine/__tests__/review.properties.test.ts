/**
 * Reviewer-owned property tests for engine invariants I1-I5 (docs/engine-spec.md §1).
 * Implementation agents must NOT modify this file.
 *
 * Strategy: a PRNG-driven random walk over valid-ish commands generated from the
 * current state. The input state is deep-frozen before every applyCommand call,
 * so any mutation of the previous state throws TypeError (I4).
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { CardDef } from '../../types/card';
import { applyCommand, type GameCommand } from '../commands';
import { initGame, type InitDeckCard } from '../init';
import { createRng, shuffledOrder } from '../random';
import type { GameState, ZoneId } from '../types';
import { useGameStore } from '../../store/gameStore';

const ZONES: ZoneId[] = ['library', 'hand', 'battlefield', 'graveyard', 'exile', 'command'];

function def(name: string, overrides: Partial<CardDef> = {}): CardDef {
  return {
    scryfallId: `sf-${name}`,
    oracleId: `or-${name}`,
    name,
    lang: 'en',
    layout: 'normal',
    cmc: 2,
    colorIdentity: ['R'],
    typeLine: 'Creature — Dragon',
    faces: [{ name, typeLine: 'Creature — Dragon', manaCost: '{1}{R}' }],
    ...overrides,
  };
}

function makeDeck(size: number): InitDeckCard[] {
  const deck: InitDeckCard[] = [];
  deck.push({
    def: def('Commander Dragon', { typeLine: 'Legendary Creature — Dragon' }),
    isCommander: true,
  });
  for (let i = 1; i < size; i++) {
    const kind = i % 4;
    if (kind === 0) {
      deck.push({
        def: def(`Mountain ${i}`, {
          typeLine: 'Basic Land — Mountain',
          cmc: 0,
          producedMana: ['R'],
          faces: [{ name: `Mountain ${i}`, typeLine: 'Basic Land — Mountain' }],
        }),
        isCommander: false,
      });
    } else if (kind === 1) {
      deck.push({
        def: def(`Bolt ${i}`, {
          typeLine: 'Instant',
          faces: [{ name: `Bolt ${i}`, typeLine: 'Instant', manaCost: '{R}' }],
        }),
        isCommander: false,
      });
    } else {
      deck.push({ def: def(`Dragon ${i}`), isCommander: false });
    }
  }
  return deck;
}

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const value of Object.values(obj)) {
      deepFreeze(value);
    }
  }
  return obj;
}

/** Generate a plausible command from the current state, driven by PRNG values. */
function genCommand(state: GameState, rng: () => number): GameCommand {
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const allIds = Object.keys(state.cards);
  const kinds = [
    'moveCard',
    'setTapped',
    'addCounters',
    'adjustLife',
    'adjustPlayerCounter',
    'addMana',
    'payMana',
    'clearManaPool',
    'draw',
    'shuffle',
    'nextPhase',
    'nextTurn',
    'createToken',
    'castSpell',
    'castCommander',
    'mulligan',
    'putOnBottom',
  ] as const;
  const kind = pick([...kinds]);

  switch (kind) {
    case 'moveCard': {
      const cardId = pick(allIds);
      const to = pick(ZONES);
      const position = pick<'top' | 'bottom' | number>(['top', 'bottom', Math.floor(rng() * 10)]);
      return { type: 'moveCard', cardId, to, position };
    }
    case 'setTapped':
      return { type: 'setTapped', cardId: pick(allIds), tapped: rng() < 0.5 };
    case 'addCounters':
      return {
        type: 'addCounters',
        cardId: pick(allIds),
        counterType: pick(['+1/+1', 'charge', 'loyalty']),
        delta: Math.floor(rng() * 7) - 3,
      };
    case 'adjustLife':
      return { type: 'adjustLife', delta: Math.floor(rng() * 21) - 10 };
    case 'adjustPlayerCounter':
      return {
        type: 'adjustPlayerCounter',
        kind: pick(['poison', 'energy', 'experience']),
        delta: Math.floor(rng() * 7) - 3,
      };
    case 'addMana':
      return {
        type: 'addMana',
        color: pick(['W', 'U', 'B', 'R', 'G', 'C']),
        amount: Math.floor(rng() * 3) + 1,
      };
    case 'payMana':
      return {
        type: 'payMana',
        payment: {
          W: 0,
          U: 0,
          B: 0,
          R: Math.floor(rng() * 3),
          G: 0,
          C: Math.floor(rng() * 2),
        },
      };
    case 'clearManaPool':
      return { type: 'clearManaPool' };
    case 'draw':
      return { type: 'draw', count: Math.floor(rng() * 3) };
    case 'shuffle':
      return {
        type: 'shuffle',
        order: shuffledOrder(state.zones.library, rng),
      };
    case 'nextPhase':
      return { type: 'nextPhase' };
    case 'nextTurn':
      return { type: 'nextTurn' };
    case 'createToken':
      return {
        type: 'createToken',
        name: 'Soldier',
        typeLine: 'Token Creature — Soldier',
        power: '1',
        toughness: '1',
        quantity: Math.floor(rng() * 3),
      };
    case 'castSpell': {
      if (state.zones.hand.length === 0) return { type: 'nextPhase' };
      return {
        type: 'castSpell',
        cardId: pick(state.zones.hand),
        payment: { W: 0, U: 0, B: 0, R: Math.floor(rng() * 2), G: 0, C: 0 },
        forced: true,
      };
    }
    case 'castCommander': {
      const inCommand = state.commanders.find(
        (c) => state.cards[c.cardId]?.zone === 'command',
      );
      if (!inCommand) return { type: 'nextPhase' };
      return {
        type: 'castCommander',
        cardId: inCommand.cardId,
        payment: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
        forced: true,
      };
    }
    case 'mulligan': {
      const combined = [...state.zones.hand, ...state.zones.library];
      return { type: 'mulligan', order: shuffledOrder(combined, rng) };
    }
    case 'putOnBottom': {
      if (state.zones.hand.length === 0) return { type: 'nextPhase' };
      return { type: 'putOnBottom', cardIds: [pick(state.zones.hand)] };
    }
  }
}

function checkInvariants(state: GameState, deckSize: number, label: string): void {
  // I1: each card id appears in exactly one zone, zones <-> cards consistent
  const seen = new Map<string, ZoneId>();
  for (const zone of ZONES) {
    for (const id of state.zones[zone]) {
      expect(seen.has(id), `${label}: ${id} appears in ${seen.get(id)} and ${zone}`).toBe(false);
      seen.set(id, zone);
      expect(state.cards[id], `${label}: ${id} in zones but not in cards`).toBeDefined();
      expect(state.cards[id].zone, `${label}: ${id} zone field mismatch`).toBe(zone);
    }
  }
  expect(Object.keys(state.cards).length, `${label}: cards not all in zones`).toBe(seen.size);

  // I2: non-token card count is constant
  const nonTokens = Object.values(state.cards).filter((c) => !c.isToken).length;
  expect(nonTokens, `${label}: non-token count drifted`).toBe(deckSize);

  // I2b: tokens only ever exist on the battlefield
  for (const c of Object.values(state.cards)) {
    if (c.isToken) {
      expect(c.zone, `${label}: token ${c.id} in non-battlefield zone`).toBe('battlefield');
    }
  }

  // I3: non-negative pools and counters (life may go negative)
  for (const v of Object.values(state.manaPool)) {
    expect(v, `${label}: negative mana`).toBeGreaterThanOrEqual(0);
  }
  expect(state.poison).toBeGreaterThanOrEqual(0);
  expect(state.energy).toBeGreaterThanOrEqual(0);
  expect(state.experience).toBeGreaterThanOrEqual(0);
  for (const c of Object.values(state.cards)) {
    for (const v of Object.values(c.counters)) {
      expect(v, `${label}: negative card counter`).toBeGreaterThanOrEqual(0);
    }
  }
  for (const v of Object.values(state.commanderDamage)) {
    expect(v).toBeGreaterThanOrEqual(0);
  }
}

const DECK_SIZE = 24;

describe('engine invariants I1-I5 (property)', () => {
  it('hold under random command walks; applyCommand never mutates its input (I4)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2 ** 31 - 1 }),
        fc.integer({ min: 1, max: 60 }),
        (seed, steps) => {
          const rng = createRng(seed);
          const deck = makeDeck(DECK_SIZE);
          let state = initGame(deck, seed);
          checkInvariants(state, DECK_SIZE, 'init');

          for (let i = 0; i < steps; i++) {
            const cmd = genCommand(state, rng);
            deepFreeze(state); // I4: any in-place mutation throws TypeError
            const poolWasCleared = cmd.type === 'nextPhase' || cmd.type === 'nextTurn';
            const result = applyCommand(state, cmd);
            state = result.state;
            checkInvariants(state, DECK_SIZE, `step ${i} ${cmd.type}`);
            if (poolWasCleared && state.phase === 'untap') {
              // I5: phase/turn transitions clear the pool. (Entering draw may
              // not re-add mana either; untap is the easy guaranteed check.)
              const total =
                state.manaPool.W +
                state.manaPool.U +
                state.manaPool.B +
                state.manaPool.R +
                state.manaPool.G +
                state.manaPool.C;
              expect(total, `step ${i}: pool not cleared on turn change`).toBe(0);
            }
          }
        },
      ),
      { numRuns: 40 },
    );
  });

  it('I5: every nextPhase clears the pool before entering the next phase', () => {
    const deck = makeDeck(DECK_SIZE);
    let state = initGame(deck, 7);
    state = applyCommand(state, { type: 'addMana', color: 'R', amount: 3 }).state;
    for (let i = 0; i < 14; i++) {
      const before = state.phase;
      state = applyCommand(state, { type: 'nextPhase' }).state;
      const p = state.manaPool;
      const total = p.W + p.U + p.B + p.R + p.G + p.C;
      // pool may only contain mana added during this command (auto effects add none)
      expect(total, `after ${before} -> ${state.phase}`).toBe(0);
      state = applyCommand(state, { type: 'addMana', color: 'G', amount: 2 }).state;
    }
  });
});

describe('store history (snapshot undo/redo)', () => {
  it('undoing everything returns exactly to the opening state; redo restores the end state', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2 ** 31 - 1 }), fc.integer({ min: 1, max: 30 }), (seed, steps) => {
        const store = useGameStore.getState();
        store.newGame(makeDeck(DECK_SIZE), seed);
        const opening = useGameStore.getState().state;
        expect(opening).not.toBeNull();

        const rng = createRng(seed ^ 0x9e3779b9);
        let dispatched = 0;
        for (let i = 0; i < steps; i++) {
          const cur = useGameStore.getState().state;
          if (!cur) break;
          const cmd = genCommand(cur, rng);
          useGameStore.getState().dispatch(cmd);
          dispatched++;
        }

        const endState = useGameStore.getState().state;
        for (let i = 0; i < dispatched; i++) useGameStore.getState().undo();
        expect(useGameStore.getState().state).toEqual(opening);
        expect(useGameStore.getState().canUndo).toBe(false);

        for (let i = 0; i < dispatched; i++) useGameStore.getState().redo();
        expect(useGameStore.getState().state).toEqual(endState);
        expect(useGameStore.getState().canRedo).toBe(false);
      }),
      { numRuns: 25 },
    );
  });
});
