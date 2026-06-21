import { create } from 'zustand';
import {
  SNAPSHOT_VERSION,
  clearSnapshot,
  saveSnapshot,
  type GameSnapshot,
} from '../data/gameSnapshot';
import type { CardDef, ManaColor } from '../types/card';
import { applyCommands } from '../engine/batch';
import { applyCommand, EngineError, type GameCommand } from '../engine/commands';
import { commanderTax, isCommander } from '../engine/commander';
import { initGame, type InitDeckCard } from '../engine/init';
import { planAutoTap } from '../engine/autotap';
import { parseManaCost, solvePayment } from '../engine/mana';
import { createRng, shuffledOrder } from '../engine/random';
import { splitAbilityLines, type AbilityShape } from '../engine/grammar/index';
import type { AbilityKind, CardInstance, GameState, ZoneId } from '../engine/types';
import { classifyCardRules } from '../data/ruleClassifier';
import {
  effectivePower,
  fetchAbility,
  hasVigilance,
  isSummoningSick,
  landEntersTapped,
  cyclingCost,
  normalizeKeywords,
} from '../engine/status';

const HISTORY_LIMIT = 200;
const SNAPSHOT_SAVE_DELAY_MS = 400;
const PLAYER_COUNTER_KINDS: Array<'poison' | 'energy' | 'experience'> = [
  'poison',
  'energy',
  'experience',
];
const CARD_SCAN_ZONES: ZoneId[] = [
  'battlefield',
  'hand',
  'library',
  'graveyard',
  'exile',
  'command',
  'stack',
];
const ALL_ZONES: ZoneId[] = [
  'library',
  'hand',
  'battlefield',
  'graveyard',
  'exile',
  'command',
  'stack',
];
const STACK_TRANSITION_BLOCKED_WARNING =
  'スタックに未解決の効果があります。先に解決してください。';

export interface TriggerCandidate {
  sourceId: string;
  triggerId: string;
  label: string;
  abilityLineIndex?: number;
}

/**
 * Backfill any zone arrays missing from an older snapshot (forward compat).
 * Snapshots saved before a new zone existed (e.g. `stack`, added in M4.27)
 * would otherwise restore a state with `undefined` zone arrays and crash.
 */
function normalizeSnapshotZones(
  zones: Partial<Record<ZoneId, string[]>>
): Record<ZoneId, string[]> {
  const out = {} as Record<ZoneId, string[]>;
  for (const zone of ALL_ZONES) out[zone] = zones[zone] ?? [];
  return out;
}

function normalizePerTurnCounter(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeSnapshotCards(cards: Record<string, CardInstance>): Record<string, CardInstance> {
  let changed = false;
  const out: Record<string, CardInstance> = {};

  for (const [cardId, card] of Object.entries(cards)) {
    const manualKeywords = normalizeKeywords(card.manualKeywords);
    if (manualKeywords.length > 0) {
      const sameLength = card.manualKeywords?.length === manualKeywords.length;
      const sameValues =
        sameLength && manualKeywords.every((keyword, index) => card.manualKeywords?.[index] === keyword);
      out[cardId] = sameValues ? card : { ...card, manualKeywords };
      changed = changed || !sameValues;
    } else if (card.manualKeywords === undefined) {
      out[cardId] = card;
    } else {
      out[cardId] = { ...card, manualKeywords: undefined };
      changed = true;
    }
  }

  return changed ? out : cards;
}

function normalizeSnapshotState(state: GameState): GameState {
  return {
    ...state,
    effectsAuto: typeof state.effectsAuto === 'boolean' ? state.effectsAuto : true,
    cards: normalizeSnapshotCards(state.cards),
    zones: normalizeSnapshotZones(state.zones),
    spellsCastThisTurn: normalizePerTurnCounter(state.spellsCastThisTurn),
    drawnThisTurn: normalizePerTurnCounter(state.drawnThisTurn),
  };
}

export interface GameStore {
  state: GameState | null;
  warnings: string[];
  triggerCandidates: TriggerCandidate[];
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
  setEffectsAuto(on: boolean): void;
  setCardEffectsAuto(cardId: string, on: boolean): void;
  addOpponent(label: string): void;

  dispatch(cmd: GameCommand): void;
  undo(): void;
  redo(): void;

  draw(count: number): void;
  mill(count: number): void;
  shuffleLibrary(): void;
  moveCard(cardId: string, to: ZoneId, position?: 'top' | 'bottom' | number): void;
  setManualKeywords(cardId: string, keywords: string[]): void;
  tapAllPermanents(): void;
  untapAllPermanents(): void;
  proliferateAll(): void;
  discard(cardIds: string[]): void;
  discardRandom(count: number): void;
  playLand(
    cardId: string,
    opts?: { force?: boolean; entersTapped?: boolean }
  ): 'ok' | 'needs-confirm' | 'needs-tap-choice';
  toggleTap(cardId: string): void;
  tapForMana(cardId: string, color?: ManaColor): 'ok' | 'needs-choice';
  crackTreasure(cardId: string, color: ManaColor): void;
  crackClue(cardId: string): void;
  crackFood(cardId: string): void;
  crackBlood(cardId: string, discardCardId?: string): void;
  castFromHand(
    cardId: string,
    opts?: { xValue?: number; force?: boolean }
  ): 'ok' | { shortfall: number };
  castCommander(
    cardId: string,
    opts?: { xValue?: number; force?: boolean }
  ): 'ok' | { shortfall: number };
  castToStack(
    cardId: string,
    opts?: { xValue?: number; force?: boolean }
  ): 'ok' | { shortfall: number };
  addAbilityToStack(
    sourceId: string,
    kind: 'activated' | 'triggered',
    abilityLineIndex?: number
  ): void;
  dismissTriggerCandidates(): void;
  copyStackItem(cardId: string): void;
  copyPermanent(cardId: string, quantity?: number): void;
  resolveTop(to?: ZoneId): void;
  resolveAll(): void;
  removeStackItem(id: string, to?: ZoneId): void;
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
  activateFetch(sourceId: string, opts: { entersTapped: boolean; lifeCost: number }): void;
  resolveFetch(abilityId: string, targetId: string, opts: { entersTapped: boolean }): void;
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
  if (!def?.faces) return [];
  return def.faces.flatMap((face) => (face.oracleText ? [face.oracleText] : []));
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
      if (!/\badd\b/i.test(clause)) {
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

function isFetchAbilityStackItem(state: GameState, cardId: string): boolean {
  const card = state.cards[cardId];
  if (!card?.isAbility || !card.sourceId) return false;
  const source = state.cards[card.sourceId];
  if (!source) return false;
  return fetchAbility(state.defs[source.defId]) !== null;
}

function untapToMainCommands(): GameCommand[] {
  return [
    { type: 'nextPhase' },
    { type: 'nextPhase' },
    { type: 'nextPhase' },
  ];
}

function cardHasRuleTag(state: GameState, cardId: string, tagId: string): boolean {
  const card = state.cards[cardId];
  if (!card) return false;
  const def = state.defs[card.defId];
  if (!def) return false;
  return classifyCardRules(def).some((tag) => tag.id === tagId);
}

function abilityShapesForKind(kind: AbilityKind): AbilityShape[] {
  return kind === 'activated' ? ['activated'] : ['triggered', 'delayed-triggered'];
}

function abilityLineIndexForKind(
  state: GameState,
  sourceId: string,
  kind: AbilityKind,
): number | undefined {
  const card = state.cards[sourceId];
  if (!card) return undefined;
  const def = state.defs[card.defId];
  if (!def) return undefined;

  const shapes = abilityShapesForKind(kind);
  const matches = splitAbilityLines(def)
    .map((line, index) => ({ line, index }))
    .filter((entry) => shapes.includes(entry.line.shape));

  return matches.length === 1 ? matches[0].index : undefined;
}

function abilityLineIndexForTrigger(
  state: GameState,
  sourceId: string,
  triggerId: string,
): number | undefined {
  const card = state.cards[sourceId];
  if (!card) return undefined;
  const def = state.defs[card.defId];
  if (!def) return undefined;

  const triggerMatches = splitAbilityLines(def)
    .map((line, index) => ({ line, index }))
    .filter((entry) => {
      if (entry.line.shape !== 'triggered' && entry.line.shape !== 'delayed-triggered') {
        return false;
      }
      const text = entry.line.text;
      switch (triggerId) {
        case 'trigger.etb':
          return /\benters\b/i.test(text);
        case 'trigger.etb-other':
          return /\benters\b/i.test(text) && /\b(?:another|other)\b/i.test(text);
        case 'trigger.death':
          return /\b(?:dies|put into (?:a )?graveyard)\b/i.test(text);
        case 'trigger.death-other':
          return /\b(?:dies|put into (?:a )?graveyard)\b/i.test(text) && /\b(?:another|other)\b/i.test(text);
        case 'trigger.landfall':
          return /\bland\b/i.test(text) && /\benters\b/i.test(text);
        case 'trigger.upkeep':
          return /\bupkeep\b/i.test(text);
        case 'trigger.end-step':
          return /\bend step\b/i.test(text);
        case 'trigger.draw':
          return /\bdraw\b/i.test(text);
        case 'trigger.cast':
        case 'trigger.cast-watcher':
          return /\bcast\b/i.test(text);
        case 'trigger.attack':
        case 'trigger.attack-watcher':
          return /\battack/i.test(text);
        default:
          return false;
      }
    });

  if (triggerMatches.length === 1) {
    return triggerMatches[0].index;
  }
  return abilityLineIndexForKind(state, sourceId, 'triggered');
}

function makeTriggerCandidate(
  state: GameState,
  sourceId: string,
  triggerId: string,
  label: string,
): TriggerCandidate {
  const candidate: TriggerCandidate = {
    sourceId,
    triggerId,
    label: `${label}: ${cardLabel(state, sourceId)}`,
  };
  const abilityLineIndex = abilityLineIndexForTrigger(state, sourceId, triggerId);
  if (abilityLineIndex !== undefined) {
    Object.defineProperty(candidate, 'abilityLineIndex', {
      value: abilityLineIndex,
      enumerable: false,
      configurable: true,
    });
  }
  return candidate;
}

function addTriggerCandidate(
  candidates: TriggerCandidate[],
  candidate: TriggerCandidate,
): void {
  const duplicate = candidates.some(
    (existing) =>
      existing.sourceId === candidate.sourceId && existing.triggerId === candidate.triggerId,
  );
  if (!duplicate) {
    candidates.push(candidate);
  }
}

function detectTriggerCandidates(prev: GameState, next: GameState): TriggerCandidate[] | null {
  const candidates: TriggerCandidate[] = [];
  let sawTriggerEvent = false;

  const prevBattlefield = new Set(prev.zones.battlefield);
  const nextBattlefield = new Set(next.zones.battlefield);
  const nextGraveyard = new Set(next.zones.graveyard);
  const isLandfallEvent = next.landsPlayedThisTurn > prev.landsPlayedThisTurn;

  const enteredBattlefield = next.zones.battlefield.filter(
    (cardId) => !prevBattlefield.has(cardId),
  );
  if (enteredBattlefield.length > 0) {
    sawTriggerEvent = true;
    const enteredBattlefieldSet = new Set(enteredBattlefield);
    for (const cardId of enteredBattlefield) {
      if (!cardHasRuleTag(next, cardId, 'trigger.etb')) continue;
      addTriggerCandidate(
        candidates,
        makeTriggerCandidate(next, cardId, 'trigger.etb', '戦場に出たとき'),
      );
    }
    for (const cardId of next.zones.battlefield) {
      if (enteredBattlefieldSet.has(cardId)) continue;
      if (isLandfallEvent && cardHasRuleTag(next, cardId, 'trigger.landfall')) continue;
      if (!cardHasRuleTag(next, cardId, 'trigger.etb-other')) continue;
      addTriggerCandidate(
        candidates,
        makeTriggerCandidate(next, cardId, 'trigger.etb-other', '他が戦場に出たとき'),
      );
    }
  }

  const died = prev.zones.battlefield.filter(
    (cardId) => !nextBattlefield.has(cardId) && nextGraveyard.has(cardId),
  );
  if (died.length > 0) {
    sawTriggerEvent = true;
    for (const cardId of died) {
      if (!cardHasRuleTag(next, cardId, 'trigger.death')) continue;
      addTriggerCandidate(
        candidates,
        makeTriggerCandidate(next, cardId, 'trigger.death', '死亡したとき'),
      );
    }
    for (const cardId of next.zones.battlefield) {
      if (!cardHasRuleTag(next, cardId, 'trigger.death-other')) continue;
      addTriggerCandidate(
        candidates,
        makeTriggerCandidate(next, cardId, 'trigger.death-other', '他の死亡時'),
      );
    }
  }

  if (isLandfallEvent) {
    sawTriggerEvent = true;
    for (const cardId of next.zones.battlefield) {
      if (!cardHasRuleTag(next, cardId, 'trigger.landfall')) continue;
      addTriggerCandidate(
        candidates,
        makeTriggerCandidate(next, cardId, 'trigger.landfall', '上陸'),
      );
    }
  }

  if (prev.phase !== 'upkeep' && next.phase === 'upkeep') {
    sawTriggerEvent = true;
    for (const cardId of next.zones.battlefield) {
      if (!cardHasRuleTag(next, cardId, 'trigger.upkeep')) continue;
      addTriggerCandidate(
        candidates,
        makeTriggerCandidate(next, cardId, 'trigger.upkeep', 'アップキープ開始時'),
      );
    }
  }

  if (prev.phase !== 'end' && next.phase === 'end') {
    sawTriggerEvent = true;
    for (const cardId of next.zones.battlefield) {
      if (!cardHasRuleTag(next, cardId, 'trigger.end-step')) continue;
      addTriggerCandidate(
        candidates,
        makeTriggerCandidate(next, cardId, 'trigger.end-step', 'エンドステップ開始時'),
      );
    }
  }

  if (next.drawnThisTurn > prev.drawnThisTurn) {
    sawTriggerEvent = true;
    for (const cardId of next.zones.battlefield) {
      if (!cardHasRuleTag(next, cardId, 'trigger.draw')) continue;
      addTriggerCandidate(
        candidates,
        makeTriggerCandidate(next, cardId, 'trigger.draw', 'カードを引いたとき'),
      );
    }
  }

  if (next.spellsCastThisTurn > prev.spellsCastThisTurn) {
    sawTriggerEvent = true;
    const prevStack = new Set(prev.zones.stack);
    const topStackId = next.zones.stack[next.zones.stack.length - 1];
    const topStackCard = topStackId ? next.cards[topStackId] : undefined;
    if (topStackId && topStackCard && !topStackCard.isAbility && !prevStack.has(topStackId)) {
      if (cardHasRuleTag(next, topStackId, 'trigger.cast')) {
        addTriggerCandidate(
          candidates,
          makeTriggerCandidate(next, topStackId, 'trigger.cast', '唱えたとき'),
        );
      }
    }
    for (const cardId of next.zones.battlefield) {
      if (!cardHasRuleTag(next, cardId, 'trigger.cast-watcher')) continue;
      addTriggerCandidate(
        candidates,
        makeTriggerCandidate(next, cardId, 'trigger.cast-watcher', '呪文を唱えるたび'),
      );
    }
  }

  return sawTriggerEvent ? candidates : null;
}

function detectAttackTriggerCandidates(
  state: GameState,
  attackerIds: string[],
): TriggerCandidate[] {
  const candidates: TriggerCandidate[] = [];

  for (const cardId of attackerIds) {
    if (!cardHasRuleTag(state, cardId, 'trigger.attack')) continue;
    addTriggerCandidate(
      candidates,
      makeTriggerCandidate(state, cardId, 'trigger.attack', '攻撃したとき'),
    );
  }

  for (const cardId of state.zones.battlefield) {
    if (!cardHasRuleTag(state, cardId, 'trigger.attack-watcher')) continue;
    addTriggerCandidate(
      candidates,
      makeTriggerCandidate(state, cardId, 'trigger.attack-watcher', 'クリーチャー攻撃時'),
    );
  }

  return candidates;
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
    const detectedTriggerCandidates = cur ? detectTriggerCandidates(cur, next) : null;
    if (cur) {
      internal.past.push(cur);
      if (internal.past.length > HISTORY_LIMIT) {
        internal.past.shift();
      }
    }
    internal.future = [];
    const nextStoreState: Partial<GameStore> = {
      state: next,
      warnings,
      canUndo: internal.past.length > 0,
      canRedo: false,
    };
    if (detectedTriggerCandidates !== null) {
      nextStoreState.triggerCandidates = detectedTriggerCandidates;
    }
    set(nextStoreState);
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
    if (cur.zones.stack.length > 0) {
      set({ warnings: [STACK_TRANSITION_BLOCKED_WARNING] });
      return;
    }

    const commands: GameCommand[] = [cmd];
    if (get().autoAdvanceToMain && (cmd.type === 'nextTurn' || cur.phase === 'end')) {
      commands.push(...untapToMainCommands());
    }

    try {
      const result = applyCommands(cur, commands);
      commit(result.state, result.warnings);
    } catch (err) {
      console.error(err);
    }
  }

  return {
    state: null,
    warnings: [],
    triggerCandidates: [],
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
        triggerCandidates: [],
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
        state: normalizeSnapshotState(snapshot.state),
        warnings: [],
        triggerCandidates: [],
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
        const result = applyCommands(cur, [
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
        const result = applyCommands(cur, untapToMainCommands());
        internal.past = [];
        internal.future = [];
        set({
          state: result.state,
          warnings: result.warnings,
          triggerCandidates: [],
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

    setEffectsAuto(on) {
      dispatch({ type: 'setEffectsAuto', value: on });
    },

    setCardEffectsAuto(cardId, on) {
      dispatch({ type: 'setCardEffectsAuto', cardId, value: on });
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
        const result = applyCommands(cur, [
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
        triggerCandidates: [],
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
        triggerCandidates: [],
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

    moveCard(cardId, to, position) {
      dispatch({
        type: 'moveCard',
        cardId,
        to,
        position: position ?? (to === 'stack' ? 'bottom' : 'top'),
      });
    },

    setManualKeywords(cardId, keywords) {
      dispatch({ type: 'setManualKeywords', cardId, keywords });
    },

    tapAllPermanents() {
      const cur = get().state;
      if (!cur) return;

      const commands: GameCommand[] = cur.zones.battlefield.flatMap((cardId) => {
        const card = cur.cards[cardId];
        return card && !card.tapped
          ? [{ type: 'setTapped', cardId, tapped: true } satisfies GameCommand]
          : [];
      });

      if (commands.length === 0) return;

      try {
        const result = applyCommands(cur, commands);
        commit(result.state, result.warnings);
      } catch (err) {
        console.error(err);
      }
    },

    untapAllPermanents() {
      dispatch({ type: 'untapAll' });
    },

    proliferateAll() {
      const cur = get().state;
      if (!cur) return;

      const commands: GameCommand[] = [];

      for (const zone of CARD_SCAN_ZONES) {
        for (const cardId of cur.zones[zone]) {
          const card = cur.cards[cardId];
          if (!card) continue;

          for (const [counterType, value] of Object.entries(card.counters)) {
            if (value !== 0) {
              commands.push({ type: 'addCounters', cardId, counterType, delta: 1 });
            }
          }
        }
      }

      for (const kind of PLAYER_COUNTER_KINDS) {
        if (cur[kind] > 0) {
          commands.push({ type: 'adjustPlayerCounter', kind, delta: 1 });
        }
      }

      if (commands.length === 0) return;

      try {
        const result = applyCommands(cur, commands);
        commit(result.state, result.warnings);
      } catch (err) {
        console.error(err);
      }
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
        const result = applyCommands(cur, [
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

    crackClue(cardId) {
      const cur = get().state;
      if (!cur) return;
      const card = cur.cards[cardId];
      const def = card ? cur.defs[card.defId] : undefined;
      if (def?.tokenKind !== 'clue') return;

      try {
        const result = applyCommands(cur, [
          { type: 'moveCard', cardId, to: 'graveyard', position: 'top' },
          { type: 'draw', count: 1 },
        ]);
        commit(result.state, result.warnings);
      } catch (err) {
        console.error(err);
      }
    },

    crackFood(cardId) {
      const cur = get().state;
      if (!cur) return;
      const card = cur.cards[cardId];
      const def = card ? cur.defs[card.defId] : undefined;
      if (def?.tokenKind !== 'food') return;

      try {
        const result = applyCommands(cur, [
          { type: 'moveCard', cardId, to: 'graveyard', position: 'top' },
          { type: 'adjustLife', delta: 3 },
        ]);
        commit(result.state, result.warnings);
      } catch (err) {
        console.error(err);
      }
    },

    crackBlood(cardId, discardCardId) {
      const cur = get().state;
      if (!cur) return;
      const card = cur.cards[cardId];
      const def = card ? cur.defs[card.defId] : undefined;
      if (def?.tokenKind !== 'blood') return;

      const commands: GameCommand[] = [];
      const shouldDiscard = discardCardId !== undefined && cur.zones.hand.includes(discardCardId);
      if (shouldDiscard) {
        commands.push({ type: 'discard', cardIds: [discardCardId] });
      }
      commands.push(
        { type: 'moveCard', cardId, to: 'graveyard', position: 'top' },
        { type: 'draw', count: 1 }
      );

      try {
        const result = applyCommands(cur, commands);
        const warnings = shouldDiscard
          ? result.warnings
          : [...result.warnings, '捨てるカードがありません'];
        commit(result.state, warnings);
      } catch (err) {
        console.error(err);
      }
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
        const result = applyCommands(cur, commands);
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
        const result = applyCommands(cur, commands);
        commit(result.state, result.warnings);
      } catch (err) {
        console.error(err);
      }
      return 'ok';
    },

    castToStack(cardId, opts) {
      const cur = get().state;
      if (!cur) return 'ok';
      const card = cur.cards[cardId];
      if (!card) return 'ok';

      const def = cur.defs[card.defId];
      const face = def?.faces[card.faceIndex] ?? def?.faces[0];
      const cost = parseManaCost(face?.manaCost ?? '');
      const isCommandCommander = card.zone === 'command' && isCommander(cur, cardId);
      const taxedCost = isCommandCommander
        ? { ...cost, generic: cost.generic + commanderTax(cur, cardId) }
        : cost;
      const xValue = opts?.xValue ?? 0;
      const directPayment = solvePayment(cur.manaPool, taxedCost, xValue);

      if (directPayment.ok) {
        dispatch({
          type: 'castToStack',
          cardId,
          payment: directPayment.payment,
          forced: false,
        });
        return 'ok';
      }

      const plan = planAutoTap(cur, taxedCost, xValue);
      if (!plan.ok && !opts?.force) {
        return { shortfall: plan.shortfall };
      }

      try {
        const result = applyCommands(cur, [
          ...tapCommands(plan.taps),
          {
            type: 'castToStack',
            cardId,
            payment: plan.payment,
            forced: !plan.ok,
          },
        ]);
        commit(result.state, result.warnings);
      } catch (err) {
        console.error(err);
      }

      return 'ok';
    },

    addAbilityToStack(sourceId, kind, abilityLineIndex) {
      const before = get().state;
      const resolvedAbilityLineIndex =
        abilityLineIndex ?? (before ? abilityLineIndexForKind(before, sourceId, kind) : undefined);
      dispatch({
        type: 'addAbilityToStack',
        sourceId,
        kind,
        ...(resolvedAbilityLineIndex === undefined
          ? {}
          : { abilityLineIndex: resolvedAbilityLineIndex }),
      });
      if (kind === 'triggered' && get().state !== before) {
        set({
          triggerCandidates: get().triggerCandidates.filter(
            (candidate) => candidate.sourceId !== sourceId,
          ),
        });
      }
    },

    dismissTriggerCandidates() {
      set({ triggerCandidates: [] });
    },

    copyStackItem(cardId) {
      dispatch({ type: 'copyStackItem', cardId });
    },

    copyPermanent(cardId, quantity = 1) {
      dispatch({ type: 'copyPermanent', cardId, quantity });
    },

    resolveTop(to) {
      dispatch({ type: 'resolveStackTop', to });
    },

    resolveAll() {
      const cur = get().state;
      if (!cur || cur.zones.stack.length === 0) return;

      const commands: GameCommand[] = [];
      for (let i = cur.zones.stack.length - 1; i >= 0; i--) {
        if (isFetchAbilityStackItem(cur, cur.zones.stack[i])) {
          break;
        }
        commands.push({ type: 'resolveStackTop' });
      }
      if (commands.length === 0) return;

      try {
        const result = applyCommands(cur, commands);
        commit(result.state, result.warnings);
      } catch (err) {
        console.error(err);
      }
    },

    removeStackItem(id, to) {
      dispatch({ type: 'removeStackItem', id, to });
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
        const result = applyCommands(cur, [
          { type: 'adjustOpponentLife', label: targetLabel, delta: -damage },
          ...tapCommands,
        ]);
        commit(result.state, [...result.warnings, ...warnings]);
        set({ triggerCandidates: detectAttackTriggerCandidates(result.state, attackerIds) });
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
          const result = applyCommands(cur, [
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
        const result = applyCommands(cur, [
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

    activateFetch(sourceId, opts) {
      const cur = get().state;
      if (!cur) return;

      const commands: GameCommand[] = [];
      const abilityLineIndex = abilityLineIndexForKind(cur, sourceId, 'activated');
      if (opts.lifeCost > 0) {
        commands.push({ type: 'adjustLife', delta: -opts.lifeCost });
      }
      commands.push(
        { type: 'moveCard', cardId: sourceId, to: 'graveyard', position: 'top' },
        {
          type: 'addAbilityToStack',
          sourceId,
          kind: 'activated',
          ...(abilityLineIndex === undefined ? {} : { abilityLineIndex }),
        }
      );

      try {
        const result = applyCommands(cur, commands);
        commit(result.state, result.warnings);
      } catch (err) {
        if (err instanceof EngineError) {
          console.error(err.message);
        } else {
          console.error(err);
        }
      }
    },

    resolveFetch(abilityId, targetId, opts) {
      const cur = get().state;
      if (!cur) return;

      const rng = createRng(randomSeed());
      const order = shuffledOrder(
        cur.zones.library.filter((cardId) => cardId !== targetId),
        rng
      );

      const commands: GameCommand[] = [
        { type: 'moveCard', cardId: targetId, to: 'battlefield', position: 'top' },
      ];
      if (opts.entersTapped) {
        commands.push({ type: 'setTapped', cardId: targetId, tapped: true });
      }
      commands.push({ type: 'shuffle', order }, { type: 'removeStackItem', id: abilityId });

      try {
        const result = applyCommands(cur, commands);
        commit(result.state, result.warnings);
      } catch (err) {
        if (err instanceof EngineError) {
          console.error(err.message);
        } else {
          console.error(err);
        }
      }
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
        const result = applyCommands(cur, commands);
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
