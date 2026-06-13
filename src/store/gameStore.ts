import { create } from 'zustand';
import type { ManaColor } from '../types/card';
import { applyCommand, EngineError, type GameCommand } from '../engine/commands';
import { commanderTax, isCommander } from '../engine/commander';
import { initGame, type InitDeckCard } from '../engine/init';
import { planAutoTap } from '../engine/autotap';
import { parseManaCost, solvePayment } from '../engine/mana';
import { createRng, shuffledOrder } from '../engine/random';
import type { GameState, ZoneId } from '../engine/types';
import { isSummoningSick } from '../engine/status';

const HISTORY_LIMIT = 200;

export interface GameStore {
  state: GameState | null;
  warnings: string[];
  canUndo: boolean;
  canRedo: boolean;

  newGame(cards: InitDeckCard[], seed?: number): void;
  restart(): void;
  mulligan(): void;
  putBottomForMulligan(cardIds: string[]): void;

  dispatch(cmd: GameCommand): void;
  undo(): void;
  redo(): void;

  draw(count: number): void;
  shuffleLibrary(): void;
  moveCard(cardId: string, to: ZoneId, position?: 'top' | 'bottom' | number): void;
  playLand(cardId: string, opts?: { force?: boolean }): 'ok' | 'needs-confirm';
  toggleTap(cardId: string): void;
  tapForMana(cardId: string, color?: ManaColor): 'ok' | 'needs-choice';
  crackTreasure(cardId: string, color: ManaColor): void;
  castFromHand(
    cardId: string,
    opts?: { xValue?: number; force?: boolean }
  ): 'ok' | { shortfall: number };
  castCommander(
    cardId: string,
    opts?: { xValue?: number; force?: boolean }
  ): 'ok' | { shortfall: number };
  nextPhase(): void;
  nextTurn(): void;
  createToken(
    name: string,
    typeLine: string,
    p?: string,
    t?: string,
    qty?: number,
    opts?: {
      producedMana?: ManaColor[];
      tokenKind?: 'treasure' | 'clue' | 'food' | 'blood';
    }
  ): void;
  clearWarnings(): void;
}

interface InternalState {
  past: GameState[];
  future: GameState[];
  // remembered for restart()
  deck: InitDeckCard[] | null;
  lastSeed: number;
}

function randomSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
}

function cardLabel(state: GameState, cardId: string): string {
  const card = state.cards[cardId];
  if (!card) return '《不明なカード》';
  const def = state.defs[card.defId];
  const face = def?.faces[card.faceIndex] ?? def?.faces[0];
  const name = face?.printedName ?? face?.name ?? def?.printedName ?? def?.name ?? '不明なカード';
  return `《${name}》`;
}

function applySequence(
  initial: GameState,
  commands: GameCommand[]
): { state: GameState; warnings: string[] } {
  let next = initial;
  const warnings: string[] = [];

  for (const cmd of commands) {
    const result = applyCommand(next, cmd);
    next = result.state;
    warnings.push(...result.warnings);
  }

  return { state: next, warnings };
}

export const useGameStore = create<GameStore>((set, get) => {
  // History stacks live in the closure (not part of the public store shape).
  const internal: InternalState = {
    past: [],
    future: [],
    deck: null,
    lastSeed: 0,
  };

  function commit(next: GameState, warnings: string[]): void {
    const cur = get().state;
    if (cur) {
      internal.past.push(cur);
      if (internal.past.length > HISTORY_LIMIT) {
        internal.past.shift();
      }
    }
    internal.future = [];
    set({
      state: next,
      warnings,
      canUndo: internal.past.length > 0,
      canRedo: false,
    });
  }

  function dispatch(cmd: GameCommand): void {
    const cur = get().state;
    if (!cur) return;
    try {
      const result = applyCommand(cur, cmd);
      commit(result.state, result.warnings);
    } catch (err) {
      if (err instanceof EngineError) {
        console.error(err.message);
      } else {
        console.error(err);
      }
    }
  }

  function warningForSummoningSickness(state: GameState, cardId: string): string[] {
    if (!isSummoningSick(state, cardId)) return [];
    return [`${cardLabel(state, cardId)}は召喚酔い中です。`];
  }

  return {
    state: null,
    warnings: [],
    canUndo: false,
    canRedo: false,

    newGame(cards, seed) {
      const usedSeed = seed ?? randomSeed();
      internal.deck = cards;
      internal.lastSeed = usedSeed;
      internal.past = [];
      internal.future = [];

      const base = initGame(cards, usedSeed);
      // draw opening 7 as a single committed step
      const result = applyCommand(base, { type: 'draw', count: 7 });
      set({
        state: result.state,
        warnings: result.warnings,
        canUndo: false,
        canRedo: false,
      });
    },

    restart() {
      if (!internal.deck) return;
      get().newGame(internal.deck, randomSeed());
    },

    mulligan() {
      const cur = get().state;
      if (!cur) return;
      // Combine hand + library, shuffle, set as new library, then draw 7.
      const combined = [...cur.zones.hand, ...cur.zones.library];
      const rng = createRng(randomSeed());
      const order = shuffledOrder(combined, rng);
      try {
        const result = applySequence(cur, [
          { type: 'mulligan', order },
          { type: 'draw', count: 7 },
        ]);
        commit(result.state, result.warnings);
      } catch (err) {
        console.error(err);
      }
    },

    putBottomForMulligan(cardIds) {
      dispatch({ type: 'putOnBottom', cardIds });
    },

    dispatch,

    undo() {
      const cur = get().state;
      if (internal.past.length === 0 || !cur) return;
      const prev = internal.past.pop() as GameState;
      internal.future.push(cur);
      if (internal.future.length > HISTORY_LIMIT) {
        internal.future.shift();
      }
      set({
        state: prev,
        canUndo: internal.past.length > 0,
        canRedo: internal.future.length > 0,
      });
    },

    redo() {
      const cur = get().state;
      if (internal.future.length === 0 || !cur) return;
      const next = internal.future.pop() as GameState;
      internal.past.push(cur);
      if (internal.past.length > HISTORY_LIMIT) {
        internal.past.shift();
      }
      set({
        state: next,
        canUndo: internal.past.length > 0,
        canRedo: internal.future.length > 0,
      });
    },

    draw(count) {
      dispatch({ type: 'draw', count });
    },

    shuffleLibrary() {
      const cur = get().state;
      if (!cur) return;
      const rng = createRng(randomSeed());
      const order = shuffledOrder(cur.zones.library, rng);
      dispatch({ type: 'shuffle', order });
    },

    moveCard(cardId, to, position = 'top') {
      dispatch({ type: 'moveCard', cardId, to, position });
    },

    playLand(cardId, opts) {
      const cur = get().state;
      if (!cur) return 'ok';
      if (cur.landsPlayedThisTurn >= 1 && !opts?.force) {
        return 'needs-confirm';
      }
      dispatch({ type: 'playLand', cardId, forced: opts?.force === true });
      return 'ok';
    },

    toggleTap(cardId) {
      const cur = get().state;
      if (!cur) return;
      const card = cur.cards[cardId];
      if (!card) return;
      try {
        const result = applyCommand(cur, { type: 'setTapped', cardId, tapped: !card.tapped });
        commit(result.state, [...result.warnings, ...warningForSummoningSickness(cur, cardId)]);
      } catch (err) {
        console.error(err);
      }
    },

    tapForMana(cardId, color) {
      const cur = get().state;
      if (!cur) return 'ok';
      const card = cur.cards[cardId];
      if (!card) return 'ok';
      const def = cur.defs[card.defId];
      const produced = def?.producedMana ?? [];
      if (produced.length === 0) {
        // nothing to add; just tap
        dispatch({ type: 'setTapped', cardId, tapped: true });
        return 'ok';
      }
      let chosen: ManaColor;
      if (produced.length === 1) {
        chosen = produced[0];
      } else if (color && produced.includes(color)) {
        chosen = color;
      } else {
        return 'needs-choice';
      }
      // single committed step: tap + add mana. Apply sequentially on a state
      // and commit once so undo reverts both.
      try {
        const result = applySequence(cur, [
          { type: 'setTapped', cardId, tapped: true },
          { type: 'addMana', color: chosen, amount: 1 },
        ]);
        commit(result.state, [...result.warnings, ...warningForSummoningSickness(cur, cardId)]);
      } catch (err) {
        console.error(err);
      }
      return 'ok';
    },

    crackTreasure(cardId, color) {
      dispatch({ type: 'crackTreasure', cardId, color });
    },

    castFromHand(cardId, opts) {
      const cur = get().state;
      if (!cur) return 'ok';
      const card = cur.cards[cardId];
      if (!card) return 'ok';
      const def = cur.defs[card.defId];
      const face = def?.faces[card.faceIndex] ?? def?.faces[0];
      const cost = parseManaCost(face?.manaCost ?? '');
      const xValue = opts?.xValue ?? 0;
      const sol = solvePayment(cur.manaPool, cost, xValue);
      if (sol.ok) {
        dispatch({
          type: 'castSpell',
          cardId,
          payment: sol.payment,
          forced: false,
        });
        return 'ok';
      }

      const plan = planAutoTap(cur, cost, xValue);
      if (!plan.ok && !opts?.force) {
        return { shortfall: plan.shortfall };
      }

      try {
        const commands: GameCommand[] = [
          ...plan.taps.flatMap((tap) => [
            { type: 'setTapped', cardId: tap.cardId, tapped: true } satisfies GameCommand,
            { type: 'addMana', color: tap.color, amount: 1 } satisfies GameCommand,
          ]),
          {
            type: 'castSpell',
            cardId,
            payment: plan.payment,
            forced: !plan.ok,
          },
        ];
        const result = applySequence(cur, commands);
        commit(result.state, result.warnings);
      } catch (err) {
        console.error(err);
      }
      return 'ok';
    },

    castCommander(cardId, opts) {
      const cur = get().state;
      if (!cur) return 'ok';
      const card = cur.cards[cardId];
      if (!card) return 'ok';
      if (!isCommander(cur, cardId)) return 'ok';
      const def = cur.defs[card.defId];
      const face = def?.faces[card.faceIndex] ?? def?.faces[0];
      const cost = parseManaCost(face?.manaCost ?? '');
      // add commander tax to generic
      const tax = commanderTax(cur, cardId);
      const taxedCost = { ...cost, generic: cost.generic + tax };
      const xValue = opts?.xValue ?? 0;
      const sol = solvePayment(cur.manaPool, taxedCost, xValue);
      if (sol.ok) {
        dispatch({
          type: 'castCommander',
          cardId,
          payment: sol.payment,
          forced: false,
        });
        return 'ok';
      }

      const plan = planAutoTap(cur, taxedCost, xValue);
      if (!plan.ok && !opts?.force) {
        return { shortfall: plan.shortfall };
      }

      try {
        const commands: GameCommand[] = [
          ...plan.taps.flatMap((tap) => [
            { type: 'setTapped', cardId: tap.cardId, tapped: true } satisfies GameCommand,
            { type: 'addMana', color: tap.color, amount: 1 } satisfies GameCommand,
          ]),
          {
            type: 'castCommander',
            cardId,
            payment: plan.payment,
            forced: !plan.ok,
          },
        ];
        const result = applySequence(cur, commands);
        commit(result.state, result.warnings);
      } catch (err) {
        console.error(err);
      }
      return 'ok';
    },

    nextPhase() {
      dispatch({ type: 'nextPhase' });
    },

    nextTurn() {
      dispatch({ type: 'nextTurn' });
    },

    createToken(name, typeLine, p, t, qty = 1, opts) {
      dispatch({
        type: 'createToken',
        name,
        typeLine,
        power: p,
        toughness: t,
        quantity: qty,
        producedMana: opts?.producedMana,
        tokenKind: opts?.tokenKind,
      });
    },

    clearWarnings() {
      set({ warnings: [] });
    },
  };
});
