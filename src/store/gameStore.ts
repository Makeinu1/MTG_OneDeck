import { create } from 'zustand';
import {
  SNAPSHOT_VERSION,
  clearSnapshot,
  saveSnapshot,
  type GameSnapshot,
} from '../data/gameSnapshot';
import type { CardDef, ManaColor } from '../types/card';
import { applyCommands } from '../engine/batch';
import {
  applyCommand,
  activatedManaAbilityPlanForSource,
  activationPlanForSource,
  EngineError,
  guidedPlanForStackTop,
  type ApplyResult,
  type GameCommand,
} from '../engine/commands';
import { commanderTax, isCommander } from '../engine/commander';
import { initGame, type InitDeckCard } from '../engine/init';
import { planAutoTap } from '../engine/autotap';
import { parseManaCost, solvePayment } from '../engine/mana';
import { orderPendingTriggersApnap, triggerStackPlacementBucketOf } from '../engine/priority';
import { createRng, shuffledOrder } from '../engine/random';
import { parseAbilityIR } from '../engine/grammar/ir';
import {
  buildGuidedCommands,
  compileAbilityIR,
  type EffectPrompt,
} from '../engine/grammar/compile';
import { resolveManaAbilityTransaction } from '../engine/manaTransaction';
import type {
  CardInstance,
  GameState,
  PendingRuleChoice,
  PendingSbaChoice,
  PendingTrigger,
  RuleChoiceSelection,
  TriggerStackPlacementBucket,
  ZoneChangeEvent,
  ZoneId,
} from '../engine/types';
import {
  abilityLineIndexForKind,
  collectAttackPendingTriggers,
  collectPendingTriggers,
  triggerCandidatesFromPendingTriggers,
  type TriggerCandidate,
} from '../engine/triggers';
import {
  fetchAbility,
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
const STACK_TRANSITION_BLOCKED_WARNING = 'スタックに未解決の効果があります。先に解決してください。';
const PRIORITY_TRIGGER_ORDER_INCOMPLETE_WARNING =
  '優先権前に置く誘発の順序が未指定です。すべての pending trigger を順序指定してください。';
const PRIORITY_TRIGGER_FIXED_POINT_MANUAL_WARNING =
  '優先権前の固定点処理で新しい誘発が発生しました。順序を指定してください。';
const PRIORITY_TRIGGER_FIXED_POINT_LIMIT_WARNING =
  '優先権前の固定点処理が上限に達しました。盤面を確認してください。';
const PRIORITY_RULE_CHOICE_PENDING_WARNING =
  '優先権前に解決するルール選択が残っています。先に pending rule choice を解決してください。';

export type { TriggerCandidate } from '../engine/triggers';

export interface PendingGuidedResolution {
  sourceId: string;
  prompts: EffectPrompt[];
  commands: GameCommand[];
  to?: ZoneId;
}

/**
 * Backfill any zone arrays missing from an older snapshot (forward compat).
 * Snapshots saved before a new zone existed (e.g. `stack`, added in M4.27)
 * would otherwise restore a state with `undefined` zone arrays and crash.
 */
function normalizeSnapshotZones(
  zones: Partial<Record<ZoneId, string[]>>,
): Record<ZoneId, string[]> {
  const out = {} as Record<ZoneId, string[]>;
  for (const zone of ALL_ZONES) out[zone] = zones[zone] ?? [];
  return out;
}

function normalizePerTurnCounter(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeMarkedDamage(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function normalizeSnapshotCards(cards: Record<string, CardInstance>): Record<string, CardInstance> {
  let changed = false;
  const out: Record<string, CardInstance> = {};

  for (const [cardId, card] of Object.entries(cards)) {
    const ownerId = card.ownerId ?? 'P1';
    const controllerId = card.controllerId ?? ownerId;
    const zoneChangeCounter =
      typeof card.zoneChangeCounter === 'number' && Number.isFinite(card.zoneChangeCounter)
        ? card.zoneChangeCounter
        : 0;
    const damageMarked = normalizeMarkedDamage(card.damageMarked);
    const hasDeathtouchDamage = card.hasDeathtouchDamage === true;
    const manualKeywords = normalizeKeywords(card.manualKeywords);
    let normalized: CardInstance = card;
    if (
      card.ownerId !== ownerId ||
      card.controllerId !== controllerId ||
      card.zoneChangeCounter !== zoneChangeCounter ||
      card.damageMarked !== damageMarked ||
      card.hasDeathtouchDamage !== hasDeathtouchDamage
    ) {
      normalized = {
        ...normalized,
        ownerId,
        controllerId,
        zoneChangeCounter,
        damageMarked,
        hasDeathtouchDamage,
      };
      changed = true;
    }

    if (manualKeywords.length > 0) {
      const sameLength = normalized.manualKeywords?.length === manualKeywords.length;
      const sameValues =
        sameLength &&
        manualKeywords.every((keyword, index) => normalized.manualKeywords?.[index] === keyword);
      out[cardId] = sameValues ? normalized : { ...normalized, manualKeywords };
      changed = changed || !sameValues;
    } else if (normalized.manualKeywords === undefined) {
      out[cardId] = normalized;
    } else {
      out[cardId] = { ...normalized, manualKeywords: undefined };
      changed = true;
    }
  }

  return changed ? out : cards;
}

function normalizePendingRuleChoices(state: GameState): PendingRuleChoice[] {
  const snapshot = state as Partial<GameState>;
  const current = Array.isArray(snapshot.pendingRuleChoices) ? snapshot.pendingRuleChoices : [];
  const legacy = Array.isArray(snapshot.pendingSbaChoices) ? snapshot.pendingSbaChoices : [];
  const choices: PendingRuleChoice[] = [];
  const seenIds = new Set<string>();

  for (const choice of [...current, ...legacy]) {
    if (seenIds.has(choice.choiceId)) continue;
    choices.push(choice);
    seenIds.add(choice.choiceId);
  }

  return choices;
}

function normalizeTriggerStackPlacementBucket(
  stackPlacementBucket: unknown,
): TriggerStackPlacementBucket {
  return stackPlacementBucket === 'ability-triggered' ? 'ability-triggered' : 'ordinary';
}

function normalizeSnapshotCombat(state: GameState): GameState['combat'] {
  const snapshot = state as Partial<GameState>;
  const combat = snapshot.combat;
  if (!combat || snapshot.phase !== 'combat' || combat.turn !== snapshot.turn) {
    return null;
  }
  return combat;
}

function normalizeSnapshotState(state: GameState): GameState {
  const pendingTriggers = Array.isArray(state.pendingTriggers)
    ? state.pendingTriggers.map((trigger) => {
        const controllerId =
          trigger.controllerId ??
          trigger.sourceSnapshot?.controllerId ??
          trigger.sourceSnapshot?.ownerId ??
          'P1';
        const simultaneousGroupId = trigger.simultaneousGroupId ?? trigger.eventId;
        const stackPlacementBucket = normalizeTriggerStackPlacementBucket(
          trigger.stackPlacementBucket,
        );
        return controllerId === trigger.controllerId &&
          simultaneousGroupId === trigger.simultaneousGroupId &&
          stackPlacementBucket === trigger.stackPlacementBucket
          ? trigger
          : { ...trigger, controllerId, simultaneousGroupId, stackPlacementBucket };
      })
    : [];

  return {
    ...state,
    effectsAuto: typeof state.effectsAuto === 'boolean' ? state.effectsAuto : true,
    activePlayerId: state.activePlayerId ?? 'P1',
    combat: normalizeSnapshotCombat(state),
    cards: normalizeSnapshotCards(state.cards),
    zones: normalizeSnapshotZones(state.zones),
    spellsCastThisTurn: normalizePerTurnCounter(state.spellsCastThisTurn),
    drawnThisTurn: normalizePerTurnCounter(state.drawnThisTurn),
    eventLog: Array.isArray(state.eventLog) ? state.eventLog : [],
    pendingTriggers,
    pendingRuleChoices: normalizePendingRuleChoices(state),
    pendingSbaChoices: [],
  };
}

function appendPendingTriggers(
  state: GameState,
  pendingTriggers: readonly PendingTrigger[],
): GameState {
  if (pendingTriggers.length === 0) {
    return state;
  }
  const existingIds = new Set(state.pendingTriggers.map((trigger) => trigger.pendingTriggerId));
  const additions = pendingTriggers.filter((trigger) => !existingIds.has(trigger.pendingTriggerId));
  if (additions.length === 0) {
    return state;
  }
  return {
    ...state,
    pendingTriggers: [...state.pendingTriggers, ...additions],
  };
}

function clearPendingTriggers(state: GameState): GameState {
  return state.pendingTriggers.length === 0 ? state : { ...state, pendingTriggers: [] };
}

function removePendingTriggersForSource(state: GameState, sourceId: string): GameState {
  const pendingTriggers = state.pendingTriggers.filter((trigger) => trigger.sourceId !== sourceId);
  return pendingTriggers.length === state.pendingTriggers.length
    ? state
    : { ...state, pendingTriggers };
}

function removePendingTriggersById(
  state: GameState,
  pendingTriggerIds: readonly string[],
): GameState {
  if (pendingTriggerIds.length === 0) return state;
  const idSet = new Set(pendingTriggerIds);
  const pendingTriggers = state.pendingTriggers.filter(
    (trigger) => !idSet.has(trigger.pendingTriggerId),
  );
  return pendingTriggers.length === state.pendingTriggers.length
    ? state
    : { ...state, pendingTriggers };
}

function appendPendingRuleChoice(state: GameState, choice: PendingRuleChoice): GameState {
  const choices = Array.isArray(state.pendingRuleChoices) ? state.pendingRuleChoices : [];
  if (choices.some((existing) => existing.choiceId === choice.choiceId)) {
    return state;
  }
  return {
    ...state,
    pendingRuleChoices: [...choices, choice],
    pendingSbaChoices: [],
  };
}

function removePendingRuleChoiceById(state: GameState, choiceId: string): GameState {
  const choices = Array.isArray(state.pendingRuleChoices) ? state.pendingRuleChoices : [];
  const legacyChoices = Array.isArray(state.pendingSbaChoices) ? state.pendingSbaChoices : [];
  const pendingRuleChoices = choices.filter((choice) => choice.choiceId !== choiceId);
  const pendingSbaChoices = legacyChoices.filter((choice) => choice.choiceId !== choiceId);
  return pendingRuleChoices.length === choices.length &&
    pendingSbaChoices.length === legacyChoices.length
    ? state
    : { ...state, pendingRuleChoices, pendingSbaChoices };
}

function lastZoneChangeEventTo(
  state: GameState,
  cardId: string,
  toZone: 'graveyard' | 'exile',
): ZoneChangeEvent | null {
  for (let index = state.eventLog.length - 1; index >= 0; index -= 1) {
    const event = state.eventLog[index];
    if (event.type === 'zoneChange' && event.physicalCardId === cardId && event.toZone === toZone) {
      return event;
    }
  }
  return null;
}

function commanderZoneSbaChoiceFromMove(
  state: GameState,
  cardId: string,
  fromZone: 'graveyard' | 'exile',
): PendingSbaChoice | null {
  const event = lastZoneChangeEventTo(state, cardId, fromZone);
  if (!event) return null;
  const controllerId =
    event.after?.controllerId ?? event.before.controllerId ?? event.before.ownerId;
  const sourceObjectId = event.after?.objectId ?? event.oldObjectId;
  return {
    choiceId: `${event.eventId}:903.9a:${cardId}`,
    kind: 'commander-zone',
    ruleRef: '903.9a',
    cardId,
    fromZone,
    toZone: 'command',
    eventId: event.eventId,
    sourceObjectId,
    controllerId,
  };
}

function commandForPendingTrigger(pending: PendingTrigger): GameCommand {
  return {
    type: 'addAbilityToStack',
    sourceId: pending.sourceId,
    kind: 'triggered',
    ...(pending.abilityLineIndex === undefined
      ? {}
      : { abilityLineIndex: pending.abilityLineIndex }),
    sourceSnapshot: pending.sourceSnapshot,
  };
}

function pendingTriggersForIds(
  state: GameState,
  pendingTriggerIds: readonly string[],
): PendingTrigger[] {
  const pendingById = new Map(
    state.pendingTriggers.map((trigger) => [trigger.pendingTriggerId, trigger]),
  );
  return pendingTriggerIds
    .map((id) => pendingById.get(id))
    .filter((trigger): trigger is PendingTrigger => trigger !== undefined);
}

function applyPendingTriggerStackPlacement(
  state: GameState,
  pendingInOrder: readonly PendingTrigger[],
): ApplyResult {
  const result = applyCommands(state, pendingInOrder.map(commandForPendingTrigger));
  const withNewPending = appendPendingTriggers(
    result.state,
    collectPendingTriggers(state, result.state),
  );
  return {
    state: removePendingTriggersById(
      withNewPending,
      pendingInOrder.map((trigger) => trigger.pendingTriggerId),
    ),
    warnings: result.warnings,
  };
}

function deterministicPendingTriggerOrderForPriority(state: GameState): string[] | null {
  const countsByControllerBucket = new Map<string, number>();
  for (const trigger of state.pendingTriggers) {
    const key = `${triggerStackPlacementBucketOf(trigger)}:${trigger.controllerId}`;
    countsByControllerBucket.set(key, (countsByControllerBucket.get(key) ?? 0) + 1);
  }
  if ([...countsByControllerBucket.values()].some((count) => count > 1)) {
    return null;
  }

  const orderResult = orderPendingTriggersApnap(
    state.pendingTriggers,
    state.pendingTriggers.map((trigger) => trigger.pendingTriggerId),
    state.activePlayerId,
  );
  return orderResult.status === 'ordered' ? orderResult.orderedIds : null;
}

export interface GameStore {
  state: GameState | null;
  warnings: string[];
  triggerCandidates: TriggerCandidate[];
  pendingGuided: PendingGuidedResolution | null;
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
  moveCommanderWithZoneChoice(cardId: string, to: ZoneId, toCommandZone: boolean): void;
  setManualKeywords(cardId: string, keywords: string[]): void;
  tapAllPermanents(): void;
  untapAllPermanents(): void;
  proliferateAll(): void;
  discard(cardIds: string[]): void;
  discardRandom(count: number): void;
  playLand(
    cardId: string,
    opts?: { force?: boolean; entersTapped?: boolean },
  ): 'ok' | 'needs-confirm' | 'needs-tap-choice';
  toggleTap(cardId: string): void;
  tapForMana(cardId: string, color?: ManaColor): 'ok' | 'needs-choice';
  crackTreasure(cardId: string, color: ManaColor): void;
  crackClue(cardId: string): void;
  crackFood(cardId: string): void;
  crackBlood(cardId: string, discardCardId?: string): void;
  castFromHand(
    cardId: string,
    opts?: { xValue?: number; force?: boolean },
  ): 'ok' | { shortfall: number };
  castCommander(
    cardId: string,
    opts?: { xValue?: number; force?: boolean },
  ): 'ok' | { shortfall: number };
  castToStack(
    cardId: string,
    opts?: { xValue?: number; force?: boolean },
  ): 'ok' | { shortfall: number };
  addAbilityToStack(
    sourceId: string,
    kind: 'activated' | 'triggered',
    abilityLineIndex?: number,
  ): void;
  resolveRuleChoice(choiceId: string, selection: RuleChoiceSelection): void;
  putPendingTriggerOnStack(pendingTriggerId: string): void;
  putPendingTriggersOnStack(pendingTriggerIds: string[]): void;
  placePendingTriggersForPriority(pendingTriggerIds: string[]): void;
  activateAbility(sourceId: string, abilityLineIndex?: number): void;
  dismissTriggerCandidates(): void;
  copyStackItem(cardId: string): void;
  copyPermanent(cardId: string, quantity?: number): void;
  resolveTop(to?: ZoneId): void;
  confirmGuidedTarget(cardId: string): void;
  confirmGuidedScrySurveil(topOrder: string[], toBottom: string[], toGraveyard: string[]): void;
  confirmGuidedModal(chosen: number[]): void;
  cancelGuidedPrompt(): void;
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
    },
  ): void;
  announce(message: string): void;
  rollDie(sides: number): void;
  flipCoin(): void;
  clearWarnings(): void;
  cycle(cardId: string, opts?: { force?: boolean }): 'ok' | { shortfall: number };
  activateFetch(sourceId: string, opts: { entersTapped: boolean; lifeCost: number }): void;
  resolveFetch(abilityId: string, targetId: string, opts: { entersTapped: boolean }): void;
  fetchLand(
    sourceId: string,
    targetId: string,
    opts: { entersTapped: boolean; lifeCost: number },
  ): void;
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
  return Math.floor(Math.random() * 0xffffffff) >>> 0 || 1;
}

function cardLabel(state: GameState, cardId: string): string {
  const card = state.cards[cardId];
  if (!card) return '《不明なカード》';
  const def = state.defs[card.defId];
  const face = def?.faces[card.faceIndex] ?? def?.faces[0];
  const name = face?.printedName ?? face?.name ?? def?.printedName ?? def?.name ?? '不明なカード';
  return `《${name}》`;
}

function appendLog(state: GameState, message: string): GameState {
  const maxSeq = state.log.reduce((max, entry) => Math.max(max, entry.seq), -1);
  return {
    ...state,
    log: [
      ...state.log,
      {
        seq: maxSeq + 1,
        turn: state.turn,
        phase: state.phase,
        message,
      },
    ],
  };
}

function resolveRuleChoiceInState(
  state: GameState,
  choiceId: string,
  selection: RuleChoiceSelection,
): ApplyResult {
  const pendingRuleChoices = Array.isArray(state.pendingRuleChoices)
    ? state.pendingRuleChoices
    : [];
  const choice = pendingRuleChoices.find((entry) => entry.choiceId === choiceId);
  if (!choice) {
    return {
      state,
      warnings: [`ルール選択が見つかりません: ${choiceId}`],
    };
  }

  if (choice.kind === 'commander-zone') {
    if (selection.kind !== 'commander-zone') {
      return {
        state,
        warnings: [`ルール選択の種類が一致しません: ${choiceId}`],
      };
    }
    if (!selection.toCommandZone) {
      return {
        state: removePendingRuleChoiceById(state, choiceId),
        warnings: [],
      };
    }

    const card = state.cards[choice.cardId];
    if (!card || card.zone !== choice.fromZone) {
      return {
        state: removePendingRuleChoiceById(state, choiceId),
        warnings: [],
      };
    }

    const moved = applyCommand(state, {
      type: 'moveCard',
      cardId: choice.cardId,
      to: choice.toZone,
      position: 'top',
      reason: 'sba',
      sbaApplied: choice.ruleRef,
      simultaneousGroupId: choice.choiceId,
    });
    return {
      state: removePendingRuleChoiceById(moved.state, choiceId),
      warnings: moved.warnings,
    };
  }

  if (selection.kind !== 'legend-rule') {
    return {
      state,
      warnings: [`ルール選択の種類が一致しません: ${choiceId}`],
    };
  }

  if (!choice.cardIds.includes(selection.keepCardId)) {
    return {
      state,
      warnings: [`レジェンド・ルールで残すカードが選択肢にありません: ${selection.keepCardId}`],
    };
  }

  const commands: GameCommand[] = choice.cardIds.flatMap((cardId) => {
    const card = state.cards[cardId];
    return card && card.zone === 'battlefield' && cardId !== selection.keepCardId
      ? [
          {
            type: 'moveCard',
            cardId,
            to: 'graveyard',
            position: 'bottom',
            reason: 'sba',
            sbaApplied: choice.ruleRef,
            simultaneousGroupId: choice.choiceId,
          } satisfies GameCommand,
        ]
      : [];
  });
  const resolved = commands.length > 0 ? applyCommands(state, commands) : { state, warnings: [] };
  return {
    state: removePendingRuleChoiceById(resolved.state, choiceId),
    warnings: resolved.warnings,
  };
}

function sourceDefFor(state: GameState, sourceId: string): CardDef | null {
  const source = state.cards[sourceId];
  return source ? (state.defs[source.defId] ?? null) : null;
}

function sourceTypeLineFor(state: GameState, sourceId: string): string {
  const source = state.cards[sourceId];
  if (!source) {
    return '';
  }
  const def = state.defs[source.defId];
  const face = def?.faces[source.faceIndex] ?? def?.faces[0];
  return face?.typeLine ?? def?.typeLine ?? '';
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
        /add\s+(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+mana\s+of\s+any/i,
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
  return [{ type: 'nextPhase' }, { type: 'nextPhase' }, { type: 'nextPhase' }];
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

  function commit(
    next: GameState,
    warnings: string[],
    options: { collectPending?: boolean } = {},
  ): void {
    const cur = get().state;
    const shouldCollectPending = options.collectPending ?? true;
    const nextWithPending =
      cur && shouldCollectPending
        ? appendPendingTriggers(next, collectPendingTriggers(cur, next))
        : next;
    if (cur) {
      internal.past.push(cur);
      if (internal.past.length > HISTORY_LIMIT) {
        internal.past.shift();
      }
    }
    internal.future = [];
    const nextStoreState: Partial<GameStore> = {
      state: nextWithPending,
      warnings,
      triggerCandidates: triggerCandidatesFromPendingTriggers(nextWithPending.pendingTriggers),
      canUndo: internal.past.length > 0,
      canRedo: false,
      pendingGuided: null,
    };
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

  function dispatchTurnTransition(
    cmd: Extract<GameCommand, { type: 'nextPhase' | 'nextTurn' }>,
  ): void {
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

  function finishGuidedResolution(pending: PendingGuidedResolution, commands: GameCommand[]): void {
    const cur = get().state;
    if (!cur) return;

    const resolveCommand: GameCommand =
      pending.to === undefined
        ? { type: 'resolveStackTop' }
        : { type: 'resolveStackTop', to: pending.to };
    try {
      const result = applyCommands(cur, [...commands, resolveCommand]);
      const logged = appendLog(
        result.state,
        `${cardLabel(cur, pending.sourceId)}の効果を誘導実行した。`,
      );
      commit(logged, result.warnings);
    } catch (err) {
      console.error(err);
      set({ pendingGuided: null });
    }
  }

  function advanceGuidedResolution(
    extraCommands: readonly GameCommand[],
    prependPrompts: readonly EffectPrompt[] = [],
  ): void {
    const pending = get().pendingGuided;
    if (!pending) return;

    const commands = [...pending.commands, ...extraCommands];
    const prompts = [...prependPrompts, ...pending.prompts.slice(1)];
    if (prompts.length === 0) {
      finishGuidedResolution(pending, commands);
      return;
    }

    set({
      pendingGuided: {
        ...pending,
        prompts,
        commands,
      },
    });
  }

  function compileSelectedModalOptions(
    pending: PendingGuidedResolution,
    chosen: readonly number[],
  ): { commands: GameCommand[]; prompts: EffectPrompt[] } {
    const cur = get().state;
    const currentPrompt = pending.prompts[0];
    if (!cur || currentPrompt?.kind !== 'modal') {
      return { commands: [], prompts: [] };
    }

    const def = sourceDefFor(cur, pending.sourceId);
    if (!def) {
      return { commands: [], prompts: [] };
    }

    const selected = new Set(chosen);
    const commands: GameCommand[] = [];
    const prompts: EffectPrompt[] = [];
    const typeLine = sourceTypeLineFor(cur, pending.sourceId);
    for (const option of currentPrompt.options ?? []) {
      if (!selected.has(option.index)) {
        continue;
      }
      const ir = parseAbilityIR(option.raw, typeLine);
      const compiled = compileAbilityIR(ir, { sourceId: pending.sourceId, def });
      if (compiled.decision === 'auto') {
        commands.push(...compiled.commands);
      } else if (compiled.decision === 'guided') {
        commands.push(...compiled.commands);
        prompts.push(...compiled.prompts);
      }
    }

    return { commands, prompts };
  }

  return {
    state: null,
    warnings: [],
    triggerCandidates: [],
    pendingGuided: null,
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
        pendingGuided: null,
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
        pendingGuided: null,
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
          pendingGuided: null,
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
      const prev = clearPendingTriggers(internal.past.pop() as GameState);
      internal.future.push(clearPendingTriggers(cur));
      if (internal.future.length > HISTORY_LIMIT) {
        internal.future.shift();
      }
      set({
        state: prev,
        triggerCandidates: [],
        pendingGuided: null,
        canUndo: internal.past.length > 0,
        canRedo: internal.future.length > 0,
      });
    },

    redo() {
      const cur = get().state;
      if (internal.future.length === 0 || !cur) return;
      const next = clearPendingTriggers(internal.future.pop() as GameState);
      internal.past.push(clearPendingTriggers(cur));
      if (internal.past.length > HISTORY_LIMIT) {
        internal.past.shift();
      }
      set({
        state: next,
        triggerCandidates: [],
        pendingGuided: null,
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

    moveCommanderWithZoneChoice(cardId, to, toCommandZone) {
      const cur = get().state;
      if (!cur) return;
      const card = cur.cards[cardId];
      if (!card || !isCommander(cur, cardId)) return;

      // CR 903.9a: graveyard/exile are not replacement effects. The commander
      // is put into that zone first, relevant death/LTB pending triggers are
      // collected from the zone-change event, then the generic rule-choice
      // substrate resolves whether to move it to command before priority.
      if (to === 'graveyard' || to === 'exile') {
        try {
          const toDestination = applyCommand(cur, {
            type: 'moveCard',
            cardId,
            to,
            position: 'top',
          });
          const choice = commanderZoneSbaChoiceFromMove(toDestination.state, cardId, to);
          const withPendingChoice = choice
            ? appendPendingRuleChoice(toDestination.state, choice)
            : toDestination.state;
          const resolved = choice
            ? resolveRuleChoiceInState(withPendingChoice, choice.choiceId, {
                kind: 'commander-zone',
                toCommandZone,
              })
            : { state: withPendingChoice, warnings: [] };
          commit(resolved.state, [...toDestination.warnings, ...resolved.warnings]);
        } catch (err) {
          if (err instanceof EngineError) {
            console.error(err.message);
          } else {
            console.error(err);
          }
        }
        return;
      }

      if (!toCommandZone) {
        dispatch({
          type: 'moveCard',
          cardId,
          to,
          position: to === 'stack' ? 'bottom' : 'top',
        });
        return;
      }

      // CR 903.9b: hand/library destinations are replacement effects. Choosing
      // command means the hand/library zone-change never happens.
      dispatch({
        type: 'moveCard',
        cardId,
        to: 'command',
        position: 'top',
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
        const result = resolveManaAbilityTransaction(cur, {
          sourceId: cardId,
          commands: [
            { type: 'setTapped', cardId, tapped: true },
            { type: 'addMana', color: chosen, amount },
          ],
        });
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
        { type: 'draw', count: 1 },
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
        const next = get().state;
        if (!next) return;
        const nextWithoutPending = removePendingTriggersForSource(next, sourceId);
        set({
          state: nextWithoutPending,
          triggerCandidates: triggerCandidatesFromPendingTriggers(
            nextWithoutPending.pendingTriggers,
          ),
        });
      }
    },

    resolveRuleChoice(choiceId, selection) {
      const cur = get().state;
      if (!cur) return;

      try {
        const result = resolveRuleChoiceInState(cur, choiceId, selection);
        commit(result.state, result.warnings);
      } catch (err) {
        if (err instanceof EngineError) {
          console.error(err.message);
        } else {
          console.error(err);
        }
      }
    },

    putPendingTriggerOnStack(pendingTriggerId) {
      get().putPendingTriggersOnStack([pendingTriggerId]);
    },

    putPendingTriggersOnStack(pendingTriggerIds) {
      const before = get().state;
      if (!before || pendingTriggerIds.length === 0) return;

      const seenIds = new Set<string>();
      const orderedIds = pendingTriggerIds.filter((id) => {
        if (seenIds.has(id)) return false;
        seenIds.add(id);
        return true;
      });
      const pendingById = new Map(
        before.pendingTriggers.map((trigger) => [trigger.pendingTriggerId, trigger]),
      );
      const pendingInOrder = orderedIds
        .map((id) => pendingById.get(id))
        .filter((trigger): trigger is PendingTrigger => trigger !== undefined);
      if (pendingInOrder.length === 0) return;

      try {
        const result = applyCommands(before, pendingInOrder.map(commandForPendingTrigger));
        commit(result.state, result.warnings);
        const next = get().state;
        if (!next) return;
        const nextWithoutPending = removePendingTriggersById(
          next,
          pendingInOrder.map((trigger) => trigger.pendingTriggerId),
        );
        set({
          state: nextWithoutPending,
          triggerCandidates: triggerCandidatesFromPendingTriggers(
            nextWithoutPending.pendingTriggers,
          ),
        });
      } catch (err) {
        if (err instanceof EngineError) {
          console.error(err.message);
        } else {
          console.error(err);
        }
      }
    },

    placePendingTriggersForPriority(pendingTriggerIds) {
      const cur = get().state;
      if (!cur) return;
      const pendingRuleChoices = Array.isArray(cur.pendingRuleChoices)
        ? cur.pendingRuleChoices
        : [];
      if (pendingRuleChoices.length > 0) {
        set({
          warnings: [...get().warnings, PRIORITY_RULE_CHOICE_PENDING_WARNING],
        });
        return;
      }
      if (cur.pendingTriggers.length === 0) return;

      const orderResult = orderPendingTriggersApnap(
        cur.pendingTriggers,
        pendingTriggerIds,
        cur.activePlayerId,
      );
      if (orderResult.status !== 'ordered') {
        set({
          warnings: [...get().warnings, PRIORITY_TRIGGER_ORDER_INCOMPLETE_WARNING],
        });
        return;
      }

      let workingState = cur;
      let orderedIds: string[] | null = orderResult.orderedIds;
      const warnings: string[] = [];
      let iterations = 0;
      const maxIterations = 10;

      while (workingState.pendingTriggers.length > 0) {
        if (!orderedIds) {
          warnings.push(PRIORITY_TRIGGER_FIXED_POINT_MANUAL_WARNING);
          break;
        }

        const pendingInOrder = pendingTriggersForIds(workingState, orderedIds);
        if (pendingInOrder.length === 0) break;

        const placement = applyPendingTriggerStackPlacement(workingState, pendingInOrder);
        workingState = placement.state;
        warnings.push(...placement.warnings);
        iterations += 1;

        if (iterations >= maxIterations && workingState.pendingTriggers.length > 0) {
          warnings.push(PRIORITY_TRIGGER_FIXED_POINT_LIMIT_WARNING);
          break;
        }

        orderedIds =
          workingState.pendingTriggers.length === 0
            ? []
            : deterministicPendingTriggerOrderForPriority(workingState);
      }

      commit(workingState, warnings, { collectPending: false });
    },

    activateAbility(sourceId, abilityLineIndex) {
      const cur = get().state;
      if (!cur) return;

      const resolvedAbilityLineIndex =
        abilityLineIndex ?? abilityLineIndexForKind(cur, sourceId, 'activated');
      const manaAbilityPlan = activatedManaAbilityPlanForSource(
        cur,
        sourceId,
        resolvedAbilityLineIndex,
      );
      if (manaAbilityPlan) {
        if (manaAbilityPlan.decision === 'manual') {
          set({
            warnings: [
              ...get().warnings,
              `${cardLabel(cur, sourceId)}のマナ能力はスタックに置かず、手動でコストとマナを反映してください。`,
            ],
          });
          return;
        }

        try {
          const result = resolveManaAbilityTransaction(cur, {
            sourceId,
            ...(resolvedAbilityLineIndex === undefined
              ? {}
              : { abilityLineIndex: resolvedAbilityLineIndex }),
            commands: manaAbilityPlan.commands,
          });
          const warnings = result.warnings.slice();
          if (manaAbilityPlan.manaShortfall > 0) {
            warnings.push(
              `${cardLabel(cur, sourceId)}のマナ能力の起動コストのマナが${manaAbilityPlan.manaShortfall}点不足しています。`,
            );
          }
          const next = appendLog(result.state, `${cardLabel(cur, sourceId)}のマナ能力を起動。`);
          commit(next, warnings);
        } catch (err) {
          if (err instanceof EngineError) {
            console.error(err.message);
          } else {
            console.error(err);
          }
        }
        return;
      }

      const plan = activationPlanForSource(cur, sourceId, resolvedAbilityLineIndex);
      const addCmd: GameCommand = {
        type: 'addAbilityToStack',
        sourceId,
        kind: 'activated',
        ...(resolvedAbilityLineIndex === undefined
          ? {}
          : { abilityLineIndex: resolvedAbilityLineIndex }),
      };
      const commands = plan ? [...plan.commands, addCmd] : [addCmd];

      try {
        const result = applyCommands(cur, commands);
        const warnings = result.warnings.slice();
        if (plan === null || plan.decision === 'manual') {
          warnings.push(`${cardLabel(cur, sourceId)}の起動コストは手払いしてください。`);
        }
        if (plan?.manaShortfall && plan.manaShortfall > 0) {
          warnings.push(
            `${cardLabel(cur, sourceId)}の起動コストのマナが${plan.manaShortfall}点不足しています。`,
          );
        }
        const next =
          plan?.decision === 'auto'
            ? appendLog(result.state, `${cardLabel(cur, sourceId)}の能力を起動(コスト精算)。`)
            : result.state;
        commit(next, warnings);
      } catch (err) {
        if (err instanceof EngineError) {
          console.error(err.message);
        } else {
          console.error(err);
        }
      }
    },

    dismissTriggerCandidates() {
      const cur = get().state;
      set({
        state: cur ? clearPendingTriggers(cur) : cur,
        triggerCandidates: [],
      });
    },

    copyStackItem(cardId) {
      dispatch({ type: 'copyStackItem', cardId });
    },

    copyPermanent(cardId, quantity = 1) {
      dispatch({ type: 'copyPermanent', cardId, quantity });
    },

    resolveTop(to) {
      const cur = get().state;
      if (!cur) return;
      const plan = guidedPlanForStackTop(cur);
      if (plan) {
        set({
          pendingGuided: {
            sourceId: plan.sourceId,
            prompts: plan.prompts,
            commands: [],
            ...(to === undefined ? {} : { to }),
          },
        });
        return;
      }
      dispatch({ type: 'resolveStackTop', to });
    },

    confirmGuidedTarget(cardId) {
      const cur = get().state;
      const pending = get().pendingGuided;
      const prompt = pending?.prompts[0];
      if (!cur || !pending || prompt?.kind !== 'target') {
        return;
      }
      const def = sourceDefFor(cur, pending.sourceId);
      if (!def) {
        advanceGuidedResolution([]);
        return;
      }
      const commands = buildGuidedCommands(
        prompt,
        { kind: 'target', cardIds: [cardId] },
        { sourceId: pending.sourceId, def },
      );
      advanceGuidedResolution(commands);
    },

    confirmGuidedScrySurveil(topOrder, toBottom, toGraveyard) {
      const cur = get().state;
      const pending = get().pendingGuided;
      const prompt = pending?.prompts[0];
      if (!cur || !pending || prompt?.kind !== 'scry-surveil') {
        return;
      }
      const def = sourceDefFor(cur, pending.sourceId);
      if (!def) {
        advanceGuidedResolution([]);
        return;
      }
      const commands = buildGuidedCommands(
        prompt,
        { kind: 'scry-surveil', topOrder, toBottom, toGraveyard },
        { sourceId: pending.sourceId, def },
      );
      advanceGuidedResolution(commands);
    },

    confirmGuidedModal(chosen) {
      const pending = get().pendingGuided;
      const prompt = pending?.prompts[0];
      if (!pending || prompt?.kind !== 'modal') {
        return;
      }
      const def = get().state ? sourceDefFor(get().state as GameState, pending.sourceId) : null;
      if (def) {
        buildGuidedCommands(
          prompt,
          { kind: 'modal', chosen: chosen.slice().sort((a, b) => a - b) },
          { sourceId: pending.sourceId, def },
        );
      }
      const compiled = compileSelectedModalOptions(
        pending,
        chosen.slice().sort((a, b) => a - b),
      );
      advanceGuidedResolution(compiled.commands, compiled.prompts);
    },

    cancelGuidedPrompt() {
      advanceGuidedResolution([]);
    },

    resolveAll() {
      const cur = get().state;
      if (!cur || cur.zones.stack.length === 0) return;

      if (guidedPlanForStackTop(cur)) {
        get().resolveTop();
        return;
      }

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
      const commands: GameCommand[] = [
        { type: 'enterCombat', attackingPlayerId: 'P1', defendingPlayerId: 'OPPONENT_A' },
        {
          type: 'declareAttackers',
          attackers: attackerIds.map((cardId) => ({
            cardId,
            target: { type: 'player', playerId: 'OPPONENT_A', lifeLabel: targetLabel },
          })),
        },
        { type: 'declareBlockers', blockers: [] },
        { type: 'resolveCombatDamage' },
      ];

      try {
        const result = applyCommands(cur, commands);
        commit(result.state, [...result.warnings, ...warnings]);
        const committed = get().state;
        if (!committed) return;
        const nextWithPending = appendPendingTriggers(
          committed,
          collectAttackPendingTriggers(committed, attackerIds),
        );
        set({
          state: nextWithPending,
          triggerCandidates: triggerCandidatesFromPendingTriggers(nextWithPending.pendingTriggers),
        });
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
        },
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
        rng,
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
        rng,
      );

      const commands: GameCommand[] = [];
      if (opts.lifeCost > 0) {
        commands.push({ type: 'adjustLife', delta: -opts.lifeCost });
      }
      commands.push(
        { type: 'moveCard', cardId: sourceId, to: 'graveyard', position: 'top' },
        { type: 'moveCard', cardId: targetId, to: 'battlefield', position: 'top' },
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
