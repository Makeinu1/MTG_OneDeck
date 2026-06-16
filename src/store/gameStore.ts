import { create } from 'zustand';
import {
  SNAPSHOT_VERSION,
  clearSnapshot,
  saveSnapshot,
  type GameSnapshot,
} from '../data/gameSnapshot';
import type { CardDef, ManaColor } from '../types/card';
import { applyCommand, EngineError, type GameCommand } from '../engine/commands';
import { commanderTax, isCommander } from '../engine/commander';
import { initGame, type InitDeckCard } from '../engine/init';
import { planAutoTap } from '../engine/autotap';
import { parseManaCost, solvePayment } from '../engine/mana';
import { createRng, shuffledOrder } from '../engine/random';
import type { GameState, ZoneId } from '../engine/types';
import {
  effectivePower,
  hasVigilance,
  isSummoningSick,
  landEntersTapped,
  cyclingCost,
} from '../engine/status';

const HISTORY_LIMIT = 200;
const SNAPSHOT_SAVE_DELAY_MS = 400;

export interface GameStore {
  state: GameState | null;
  warnings: string[];
  canUndo: boolean;
  canRedo: boolean;
  autoAdvanceToMain: boolean;
  mulliganDecisionPending: boolean;

  newGame(cards: InitDeckCard[], seed?: number): void;
  restoreGame(snapshot: GameSnapshot): void;
  restart(): void;
  mulligan(): void;
  beginFirstTurn(): void;
  keepOpeningHand(): void;
  putBottomForMulligan(cardIds: string[]): void;
  setAutoAdvance(on: boolean): void;
  addOpponent(label: string): void;

  dispatch(cmd: GameCommand): void;
  undo(): void;
  redo(): void;

  draw(count: number): void;
  mill(count: number): void;
  shuffleLibrary(): void;
  moveCard(cardId: string, to: ZoneId, position?: 'top' | 'bottom' | number): void;
  untapAllPermanents(): void;
  discard(cardIds: string[]): void;
  discardRandom(count: number): void;
  playLand(
    cardId: string,
    opts?: { force?: boolean; entersTapped?: boolean }
  ): 'ok' | 'needs-confirm' | 'needs-tap-choice';
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
  declareAttack(attackerIds: string[], targetLabel: string): void;
  adjustOpponentLife(label: string, delta: number): void;
  adjustMana(color: ManaColor, delta: number): void;
  arrangeTop(topOrder: string[], toBottom: string[], toGraveyard: string[]): void;
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
  announce(message: string): void;
  rollDie(sides: number): void;
  flipCoin(): void;
  clearWarnings(): void;
  cycle(cardId: string, opts?: { force?: boolean }): 'ok' | { shortfall: number };
  fetchLand(sourceId: string, targetId: string, opts: { entersTapped: boolean; lifeCost: number }): void;
}

interface InternalState {
  past: GameState[];
  future: GameState[];
  // remembered for restart()
  deck: InitDeckCard[] | null;
  lastSeed: number;
}

let snapshotInternal: InternalState | null = null;
let snapshotSaveTimer: ReturnType<typeof setTimeout> | undefined;

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

function cardTexts(def: CardDef | undefined): string[] {
  if (!def) return [];
  return def.faces.flatMap((face) => [face.oracleText ?? '', face.printedText ?? '']);
}

function splitRulesText(text: string): string[] {
  return text
    .split(/[.\n。]/)
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function normalizeDigits(text: string): string {
  return text.replace(/[０-９]/g, (digit) => String(digit.charCodeAt(0) - 0xff10));
}

function parseAmountToken(token: string): number | null {
  const normalized = normalizeDigits(token).toLowerCase();
  if (NUMBER_WORDS[normalized] !== undefined) {
    return NUMBER_WORDS[normalized];
  }
  if (/^\d+$/.test(normalized)) {
    return Number.parseInt(normalized, 10);
  }
  return null;
}

function manaProductionAmount(def: CardDef | undefined, color: ManaColor): number {
  for (const text of cardTexts(def)) {
    for (const clause of splitRulesText(text)) {
      if (!/\badd\b/i.test(clause) && !/を加える/.test(clause)) {
        continue;
      }

      const matches = clause.match(new RegExp(`\\{${color}\\}`, 'gi'));
      if (matches && matches.length > 0) {
        return matches.length;
      }

      const englishAmount = clause.match(
        /add\s+(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+mana\s+of\s+any/i
      );
      if (englishAmount) {
        const parsed = parseAmountToken(englishAmount[1]);
        if (parsed !== null) {
          return parsed;
        }
      }

      const japaneseAmount = clause.match(
        /(?:好きな色|いずれか(?:の)?[0-9０-９]?色|あなたが選んだ色)[^。]*?マナ\s*([0-9０-９]+)\s*点/
      );
      if (japaneseAmount) {
        const parsed = parseAmountToken(japaneseAmount[1]);
        if (parsed !== null) {
          return parsed;
        }
      }
    }
  }

  return 1;
}

function tapCommands(taps: { cardId: string; color: ManaColor }[]): GameCommand[] {
  return taps.flatMap((tap) => [
    { type: 'setTapped', cardId: tap.cardId, tapped: true } satisfies GameCommand,
    { type: 'addMana', color: tap.color, amount: 1 } satisfies GameCommand,
  ]);
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

function untapToMainCommands(): GameCommand[] {
  return [
    { type: 'nextPhase' },
    { type: 'nextPhase' },
    { type: 'nextPhase' },
  ];
}

export function freeMulliganBottomCount(mulliganCount: number): number {
  return Math.max(0, mulliganCount - 1);
}

export const useGameStore = create<GameStore>((set, get) => {
  // History stacks live in the closure (not part of the public store shape).
  const internal: InternalState = {
    past: [],
    future: [],
    deck: null,
    lastSeed: 0,
  };
  snapshotInternal = internal;

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

  function dispatchTurnTransition(cmd: Extract<GameCommand, { type: 'nextPhase' | 'nextTurn' }>): void {
    const cur = get().state;
    if (!cur) return;

    const commands: GameCommand[] = [cmd];
    if (get().autoAdvanceToMain && (cmd.type === 'nextTurn' || cur.phase === 'end')) {
      commands.push(...untapToMainCommands());
    }

    try {
      const result =
        commands.length === 1 ? applyCommand(cur, cmd) : applySequence(cur, commands);
      commit(result.state, result.warnings);
    } catch (err) {
      console.error(err);
    }
  }

  return {
    state: null,
    warnings: [],
    canUndo: false,
    canRedo: false,
    autoAdvanceToMain: true,
    mulliganDecisionPending: false,

    newGame(cards, seed) {
      const usedSeed = seed ?? randomSeed();
      internal.deck = cards;
      internal.lastSeed = usedSeed;
      internal.past = [];
      internal.future = [];

      const base = initGame(cards, usedSeed);
      // Build the initial board state as a single non-undoable setup step.
      const openingHand = applyCommand(base, { type: 'draw', count: 7 });
      set({
        state: openingHand.state,
        warnings: openingHand.warnings,
        canUndo: false,
        canRedo: false,
        mulliganDecisionPending: true,
      });
    },

    restoreGame(snapshot) {
      const lastSeed = internal.lastSeed;
      internal.deck = snapshot.deck;
      internal.lastSeed = lastSeed;
      internal.past = [];
      internal.future = [];
      set({
        state: snapshot.state,
        warnings: [],
        canUndo: false,
        canRedo: false,
        autoAdvanceToMain: snapshot.autoAdvanceToMain,
        mulliganDecisionPending: false,
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

    beginFirstTurn() {
      const cur = get().state;
      if (!cur || !get().autoAdvanceToMain) return;

      try {
        const result = applySequence(cur, untapToMainCommands());
        internal.past = [];
        internal.future = [];
        set({
          state: result.state,
          warnings: result.warnings,
          canUndo: false,
          canRedo: false,
        });
      } catch (err) {
        console.error(err);
      }
    },

    keepOpeningHand() {
      set({ mulliganDecisionPending: false });
    },

    putBottomForMulligan(cardIds) {
      dispatch({ type: 'putOnBottom', cardIds });
    },

    setAutoAdvance(on) {
      set({ autoAdvanceToMain: on });
    },

    addOpponent(label) {
      const cur = get().state;
      if (!cur) return;
      const trimmed = label.trim();
      if (trimmed === '') return;
      if (cur.opponentLife[trimmed] !== undefined && cur.commanderDamage[trimmed] !== undefined) {
        return;
      }

      try {
        const result = applySequence(cur, [
          { type: 'adjustOpponentLife', label: trimmed, delta: 0 },
          { type: 'adjustCommanderDamage', label: trimmed, delta: 0 },
        ]);
        commit(result.state, result.warnings);
      } catch (err) {
        console.error(err);
      }
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

    mill(count) {
      dispatch({ type: 'mill', count });
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

    untapAllPermanents() {
      dispatch({ type: 'untapAll' });
    },

    discard(cardIds) {
      dispatch({ type: 'discard', cardIds });
    },

    discardRandom(count) {
      const cur = get().state;
      if (!cur) return;

      const requested = Math.max(0, Math.floor(count));
      const discardCount = Math.min(requested, cur.zones.hand.length);
      if (discardCount <= 0) return;

      const rng = createRng(randomSeed());
      const selected = shuffledOrder(cur.zones.hand, rng).slice(0, discardCount);
      dispatch({ type: 'discard', cardIds: selected });
    },

    playLand(cardId, opts) {
      const cur = get().state;
      if (!cur) return 'ok';
      if (cur.landsPlayedThisTurn >= 1 && !opts?.force) {
        return 'needs-confirm';
      }
      const card = cur.cards[cardId];
      const def = card ? cur.defs[card.defId] : undefined;
      const entersTappedStatus = landEntersTapped(def);

      let entersTapped = opts?.entersTapped;
      if (entersTappedStatus === 'always') {
        entersTapped = true;
      } else if (entersTappedStatus === 'never') {
        entersTapped = false;
      } else if (entersTapped === undefined) {
        return 'needs-tap-choice';
      }

      dispatch({
        type: 'playLand',
        cardId,
        forced: opts?.force === true,
        entersTapped,
      });
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
        const amount = Math.max(1, manaProductionAmount(def, chosen));
        const result = applySequence(cur, [
          { type: 'setTapped', cardId, tapped: true },
          { type: 'addMana', color: chosen, amount },
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
          ...tapCommands(plan.taps),
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
          ...tapCommands(plan.taps),
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

    declareAttack(attackerIds, targetLabel) {
      const cur = get().state;
      if (!cur) return;

      const warnings = attackerIds.flatMap((cardId) => warningForSummoningSickness(cur, cardId));
      const damage = attackerIds.reduce((total, cardId) => total + effectivePower(cur, cardId), 0);
      const tapCommands: GameCommand[] = attackerIds
        .filter((cardId) => !hasVigilance(cur, cardId))
        .map((cardId) => ({ type: 'setTapped', cardId, tapped: true }));

      try {
        const result = applySequence(cur, [
          { type: 'adjustOpponentLife', label: targetLabel, delta: -damage },
          ...tapCommands,
        ]);
        commit(result.state, [...result.warnings, ...warnings]);
      } catch (err) {
        console.error(err);
      }
    },

    adjustOpponentLife(label, delta) {
      dispatch({ type: 'adjustOpponentLife', label, delta });
    },

    adjustMana(color, delta) {
      dispatch({ type: 'adjustMana', color, delta });
    },

    arrangeTop(topOrder, toBottom, toGraveyard) {
      dispatch({ type: 'arrangeTop', topOrder, toBottom, toGraveyard });
    },

    nextPhase() {
      dispatchTurnTransition({ type: 'nextPhase' });
    },

    nextTurn() {
      dispatchTurnTransition({ type: 'nextTurn' });
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

    announce(message) {
      set({ warnings: [...get().warnings, message] });
    },

    rollDie(sides) {
      const result = Math.floor(Math.random() * sides) + 1;
      get().announce(`🎲 d${sides} → ${result}`);
    },

    flipCoin() {
      get().announce(Math.random() < 0.5 ? '🪙 コイン → 表' : '🪙 コイン → 裏');
    },

    clearWarnings() {
      set({ warnings: [] });
    },

    cycle(cardId, opts) {
      const cur = get().state;
      if (!cur) return 'ok';
      const card = cur.cards[cardId];
      if (!card || card.zone !== 'hand') return 'ok';

      const def = cur.defs[card.defId];
      const costLabel = cyclingCost(def);
      if (!costLabel) return 'ok';

      const cost = parseManaCost(costLabel);
      const directPayment = solvePayment(cur.manaPool, cost, 0);
      if (directPayment.ok) {
        try {
          const result = applySequence(cur, [
            { type: 'payMana', payment: directPayment.payment },
            { type: 'discard', cardIds: [cardId] },
            { type: 'draw', count: 1 },
          ]);
          commit(result.state, result.warnings);
        } catch (err) {
          console.error(err);
        }
        return 'ok';
      }

      const plan = planAutoTap(cur, cost, 0);
      if (!plan.ok && !opts?.force) {
        return { shortfall: plan.shortfall };
      }

      try {
        const result = applySequence(cur, [
          ...tapCommands(plan.taps),
          { type: 'payMana', payment: plan.payment },
          { type: 'discard', cardIds: [cardId] },
          { type: 'draw', count: 1 },
        ]);
        commit(result.state, result.warnings);
      } catch (err) {
        console.error(err);
      }

      return 'ok';
    },

    fetchLand(sourceId, targetId, opts) {
      const cur = get().state;
      if (!cur) return;

      const rng = createRng(randomSeed());
      const order = shuffledOrder(
        cur.zones.library.filter((cardId) => cardId !== targetId),
        rng
      );

      const commands: GameCommand[] = [];
      if (opts.lifeCost > 0) {
        commands.push({ type: 'adjustLife', delta: -opts.lifeCost });
      }
      commands.push(
        { type: 'moveCard', cardId: sourceId, to: 'graveyard', position: 'top' },
        { type: 'moveCard', cardId: targetId, to: 'battlefield', position: 'top' }
      );
      if (opts.entersTapped) {
        commands.push({ type: 'setTapped', cardId: targetId, tapped: true });
      }
      commands.push({ type: 'shuffle', order });

      try {
        const result = applySequence(cur, commands);
        commit(result.state, result.warnings);
      } catch (err) {
        if (err instanceof EngineError) {
          console.error(err.message);
        } else {
          console.error(err);
        }
      }
    },
  };
});

useGameStore.subscribe((state, prevState) => {
  if (state.state === prevState.state && state.autoAdvanceToMain === prevState.autoAdvanceToMain) {
    return;
  }

  if (snapshotSaveTimer) {
    clearTimeout(snapshotSaveTimer);
  }

  snapshotSaveTimer = setTimeout(() => {
    const s = useGameStore.getState();
    if (s.state === null) {
      void clearSnapshot();
      return;
    }

    void saveSnapshot({
      version: SNAPSHOT_VERSION,
      state: s.state,
      deck: snapshotInternal?.deck ?? [],
      autoAdvanceToMain: s.autoAdvanceToMain,
    });
  }, SNAPSHOT_SAVE_DELAY_MS);
});
