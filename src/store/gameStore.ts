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
  activationTargetPromptsForSource,
  consumeLinkedExileForSource as consumeLinkedExileForSourceInState,
  EngineError,
  eligibleTargets,
  guidedPlanForStackTop,
  objectSnapshotForCard,
  returnLinkedExileToBattlefield,
  type ApplyResult,
  type GameCommand,
} from '../engine/commands';
import { commanderTax, isCommander } from '../engine/commander';
import { initGame, type InitDeckCard } from '../engine/init';
import { planAutoTap } from '../engine/autotap';
import { parseManaCost, solvePayment } from '../engine/mana';
import { orderPendingTriggersApnap, triggerStackPlacementBucketOf } from '../engine/priority';
import { createRng, shuffledOrder } from '../engine/random';
import { splitAbilityLines } from '../engine/grammar';
import { parseAbilityIR } from '../engine/grammar/ir';
import {
  buildGuidedCommands,
  compileAbilityIR,
  type EffectPrompt,
  type LibrarySearchFilter,
} from '../engine/grammar/compile';
import { resolveManaAbilityTransaction } from '../engine/manaTransaction';
import {
  emptyPlayerPrivateZones,
  playerPrivateZonesFromFlatZones,
  syncP1ZonesByPlayerFromFlatZones,
  type CardInstance,
  type ActivationCostComponent,
  type ActivationEnvelope,
  type ActivationPaymentMode,
  type ActivationSourceRef,
  type DefeatAdvisoryRecord,
  type DefeatPlayerRef,
  type DefeatReason,
  type DefeatRuleRef,
  type GameState,
  type LinkedExileRecord,
  type PendingRuleChoice,
  type PendingSbaChoice,
  type PendingTrigger,
  type PendingTriggerSchedule,
  type Phase,
  type PlayerPrivateZones,
  type PlayerId,
  type RuleChoiceSelection,
  type TargetSelection,
  type TriggerStackPlacementBucket,
  type ZoneChangeEvent,
  type ZoneId,
} from '../engine/types';
import {
  abilityLineIndexForKind,
  collectAttackPendingTriggers,
  collectPendingTriggerUpdate,
  readyPendingTriggers,
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
const DEFEAT_RULE_REFS: Record<DefeatReason, DefeatRuleRef> = {
  lifeZero: '704.5a',
  emptyLibraryDraw: '704.5b',
  poison: '704.5c',
  commanderDamage: '903.10a',
};
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

export interface PendingActivation {
  sourceId: string;
  abilityLineIndex?: number;
  commands: GameCommand[];
  costComponents: ActivationEnvelope['cost'];
  costPrompts: EffectPrompt[];
  sourceSnapshot: NonNullable<ActivationEnvelope['sourceRef']['snapshot']>;
  targetSelections: TargetSelection[];
  paymentMode: ActivationPaymentMode;
  manaShortfall: number;
  costDecision: 'auto' | 'manual' | 'disabled';
}

export interface PendingManaAbility {
  abilityLineIndex?: number;
  manaShortfall: number;
}

export interface PendingGuidedResolution {
  mode?: 'resolution' | 'activation' | 'mana-ability';
  sourceId: string;
  prompts: EffectPrompt[];
  commands: GameCommand[];
  warnings?: string[];
  to?: ZoneId;
  activation?: PendingActivation;
  manaAbility?: PendingManaAbility;
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

function normalizePlayerPrivateZones(value: unknown): PlayerPrivateZones {
  const rawZones = unknownRecord(value);
  const library = rawZones?.library;
  const hand = rawZones?.hand;
  const graveyard = rawZones?.graveyard;
  return {
    library: isStringArray(library) ? library.slice() : [],
    hand: isStringArray(hand) ? hand.slice() : [],
    graveyard: isStringArray(graveyard) ? graveyard.slice() : [],
  };
}

function normalizeZonesByPlayer(
  value: unknown,
  flatZones: Record<ZoneId, string[]>,
): GameState['zonesByPlayer'] {
  const rawZonesByPlayer = unknownRecord(value);
  if (!rawZonesByPlayer) {
    return {
      P1: playerPrivateZonesFromFlatZones(flatZones),
      OPPONENT_A: emptyPlayerPrivateZones(),
    };
  }

  return {
    P1: normalizePlayerPrivateZones(rawZonesByPlayer.P1),
    OPPONENT_A: normalizePlayerPrivateZones(rawZonesByPlayer.OPPONENT_A),
  };
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

function isPhase(value: unknown): value is Phase {
  return (
    value === 'untap' ||
    value === 'upkeep' ||
    value === 'draw' ||
    value === 'main1' ||
    value === 'combat' ||
    value === 'main2' ||
    value === 'end'
  );
}

function isScheduledPhase(value: unknown): value is PendingTriggerSchedule['phase'] {
  return value === 'upkeep' || value === 'end';
}

function normalizePendingTriggerSchedule(value: unknown): PendingTriggerSchedule | undefined {
  const rawSchedule = unknownRecord(value);
  if (!rawSchedule) {
    return undefined;
  }
  if (
    rawSchedule.kind !== 'phase-begin' ||
    typeof rawSchedule.turn !== 'number' ||
    !Number.isFinite(rawSchedule.turn) ||
    !isScheduledPhase(rawSchedule.phase) ||
    typeof rawSchedule.createdAtTurn !== 'number' ||
    !Number.isFinite(rawSchedule.createdAtTurn) ||
    !isPhase(rawSchedule.createdAtPhase)
  ) {
    return undefined;
  }
  return {
    kind: 'phase-begin',
    turn: rawSchedule.turn,
    phase: rawSchedule.phase,
    consumeOnTrigger: true,
    createdAtTurn: rawSchedule.createdAtTurn,
    createdAtPhase: rawSchedule.createdAtPhase,
  };
}

function normalizeSnapshotCombat(state: GameState): GameState['combat'] {
  const snapshot = state as Partial<GameState>;
  const combat = snapshot.combat;
  if (!combat || snapshot.phase !== 'combat' || combat.turn !== snapshot.turn) {
    return null;
  }
  return combat;
}

function unknownRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isDefeatReason(value: unknown): value is DefeatReason {
  return (
    value === 'lifeZero' ||
    value === 'emptyLibraryDraw' ||
    value === 'poison' ||
    value === 'commanderDamage'
  );
}

function isDefeatPlayerRef(value: string): value is DefeatPlayerRef {
  return value === 'P1' || (value.startsWith('opponent:') && value.length > 'opponent:'.length);
}

function normalizeSnapshotDefeat(value: unknown): GameState['defeat'] {
  const rawDefeat = unknownRecord(value);
  if (!rawDefeat) return {};

  const defeat: GameState['defeat'] = {};
  for (const [playerRef, rawRecord] of Object.entries(rawDefeat)) {
    if (!isDefeatPlayerRef(playerRef)) continue;
    const record = unknownRecord(rawRecord);
    if (!record || !Array.isArray(record.reasons)) continue;

    const reasons: DefeatReason[] = [];
    for (const rawReason of record.reasons) {
      if (!isDefeatReason(rawReason) || reasons.includes(rawReason)) continue;
      reasons.push(rawReason);
    }
    if (reasons.length === 0) continue;

    const ruleRefs: DefeatAdvisoryRecord['ruleRefs'] = {};
    for (const reason of reasons) {
      ruleRefs[reason] = DEFEAT_RULE_REFS[reason];
    }
    defeat[playerRef] = {
      reasons,
      ruleRefs,
      advisory: true,
    };
  }

  return defeat;
}

function isPlayerId(value: string): value is PlayerId {
  return value === 'P1' || value === 'OPPONENT_A';
}

function normalizeEmptyLibraryDrawFlags(
  value: unknown,
): GameState['emptyLibraryDrawAttemptedSinceLastSba'] {
  const rawFlags = unknownRecord(value);
  if (!rawFlags) return {};

  const flags: GameState['emptyLibraryDrawAttemptedSinceLastSba'] = {};
  for (const [playerId, flag] of Object.entries(rawFlags)) {
    if (!isPlayerId(playerId) || typeof flag !== 'boolean') continue;
    flags[playerId] = flag;
  }
  return flags;
}

function normalizeOncePerTurnTriggerLedger(
  value: unknown,
  turn: number,
): GameState['oncePerTurnTriggerLedger'] {
  const rawLedger = unknownRecord(value);
  if (!rawLedger) {
    return { turn, consumedKeys: [] };
  }
  const rawTurn = rawLedger.turn;
  if (typeof rawTurn !== 'number' || !Number.isFinite(rawTurn) || rawTurn !== turn) {
    return { turn, consumedKeys: [] };
  }
  const consumedKeys = isStringArray(rawLedger.consumedKeys)
    ? [...new Set(rawLedger.consumedKeys)]
    : [];
  return { turn, consumedKeys };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isLinkedExilePurpose(value: unknown): value is LinkedExileRecord['purpose'] {
  return value === 'exiled-with-source' || value === 'temporary-return';
}

function isSnapshotLike(value: unknown): value is LinkedExileRecord['snapshot'] {
  const snapshot = unknownRecord(value);
  return (
    snapshot !== null &&
    typeof snapshot.physicalCardId === 'string' &&
    typeof snapshot.objectId === 'string' &&
    typeof snapshot.defId === 'string' &&
    typeof snapshot.zone === 'string' &&
    typeof snapshot.ownerId === 'string' &&
    typeof snapshot.isToken === 'boolean' &&
    typeof snapshot.isCommander === 'boolean' &&
    typeof snapshot.faceIndex === 'number' &&
    typeof snapshot.tapped === 'boolean' &&
    unknownRecord(snapshot.counters) !== null &&
    typeof snapshot.typeLine === 'string'
  );
}

function normalizeLinkedExiles(value: unknown): GameState['linkedExiles'] {
  const rawLinkedExiles = unknownRecord(value);
  if (!rawLinkedExiles) return {};

  const linkedExiles: GameState['linkedExiles'] = {};
  for (const [linkId, rawRecord] of Object.entries(rawLinkedExiles)) {
    const record = unknownRecord(rawRecord);
    if (!record) continue;
    if (
      record.linkId !== linkId ||
      !isLinkedExilePurpose(record.purpose) ||
      typeof record.sourceObjectId !== 'string' ||
      typeof record.sourcePhysicalId !== 'string' ||
      !isStringArray(record.exiledPhysicalIds) ||
      !isStringArray(record.exiledObjectIds) ||
      !isSnapshotLike(record.snapshot) ||
      typeof record.createdSequence !== 'number' ||
      !Number.isFinite(record.createdSequence)
    ) {
      continue;
    }

    linkedExiles[linkId] = {
      linkId,
      purpose: record.purpose,
      sourceObjectId: record.sourceObjectId,
      sourcePhysicalId: record.sourcePhysicalId,
      exiledPhysicalIds: record.exiledPhysicalIds.slice(),
      exiledObjectIds: record.exiledObjectIds.slice(),
      snapshot: record.snapshot,
      createdSequence: record.createdSequence,
    };
  }
  return linkedExiles;
}

function normalizeSnapshotState(state: GameState): GameState {
  const snapshot = state as Partial<GameState>;
  const zones = normalizeSnapshotZones(snapshot.zones ?? {});
  const zonesByPlayer = normalizeZonesByPlayer(snapshot.zonesByPlayer, zones);
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
        const schedule = normalizePendingTriggerSchedule(trigger.schedule);
        const normalized =
          controllerId === trigger.controllerId &&
          simultaneousGroupId === trigger.simultaneousGroupId &&
          stackPlacementBucket === trigger.stackPlacementBucket
            ? trigger
            : { ...trigger, controllerId, simultaneousGroupId, stackPlacementBucket };
        if (schedule === undefined) {
          if (normalized.schedule === undefined) {
            return normalized;
          }
          const withoutSchedule = { ...normalized };
          delete withoutSchedule.schedule;
          return withoutSchedule;
        }
        return schedule === normalized.schedule ? normalized : { ...normalized, schedule };
      })
    : [];

  return syncP1ZonesByPlayerFromFlatZones({
    ...state,
    effectsAuto: typeof state.effectsAuto === 'boolean' ? state.effectsAuto : true,
    activePlayerId: state.activePlayerId ?? 'P1',
    combat: normalizeSnapshotCombat(state),
    cards: normalizeSnapshotCards(state.cards),
    zones,
    zonesByPlayer,
    spellsCastThisTurn: normalizePerTurnCounter(state.spellsCastThisTurn),
    drawnThisTurn: normalizePerTurnCounter(state.drawnThisTurn),
    eventLog: Array.isArray(state.eventLog) ? state.eventLog : [],
    defeat: normalizeSnapshotDefeat(snapshot.defeat),
    emptyLibraryDrawAttemptedSinceLastSba: normalizeEmptyLibraryDrawFlags(
      snapshot.emptyLibraryDrawAttemptedSinceLastSba,
    ),
    pendingTriggers,
    oncePerTurnTriggerLedger: normalizeOncePerTurnTriggerLedger(
      snapshot.oncePerTurnTriggerLedger,
      state.turn,
    ),
    pendingRuleChoices: normalizePendingRuleChoices(state),
    pendingSbaChoices: [],
    linkedExiles: normalizeLinkedExiles(snapshot.linkedExiles),
  });
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

function appendCollectedPendingTriggers(prev: GameState, next: GameState): GameState {
  const triggerUpdate = collectPendingTriggerUpdate(prev, next);
  return appendPendingTriggers(triggerUpdate.state, triggerUpdate.pendingTriggers);
}

function clearPendingTriggers(state: GameState): GameState {
  const pendingTriggers = state.pendingTriggers.filter((trigger) => trigger.schedule !== undefined);
  return pendingTriggers.length === state.pendingTriggers.length
    ? state
    : { ...state, pendingTriggers };
}

function removePendingTriggersForSource(state: GameState, sourceId: string): GameState {
  const pendingTriggers = state.pendingTriggers.filter(
    (trigger) => trigger.schedule !== undefined || trigger.sourceId !== sourceId,
  );
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
    readyPendingTriggers(state.pendingTriggers).map((trigger) => [
      trigger.pendingTriggerId,
      trigger,
    ]),
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
  const withNewPending = appendCollectedPendingTriggers(state, result.state);
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
  const pendingTriggers = readyPendingTriggers(state.pendingTriggers);
  for (const trigger of pendingTriggers) {
    const key = `${triggerStackPlacementBucketOf(trigger)}:${trigger.controllerId}`;
    countsByControllerBucket.set(key, (countsByControllerBucket.get(key) ?? 0) + 1);
  }
  if ([...countsByControllerBucket.values()].some((count) => count > 1)) {
    return null;
  }

  const orderResult = orderPendingTriggersApnap(
    pendingTriggers,
    pendingTriggers.map((trigger) => trigger.pendingTriggerId),
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
  returnLinkedExile(linkId: string): void;
  consumeLinkedExileForSource(linkId: string, sourcePhysicalId: string): void;
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
  activateAbility(sourceId: string, abilityLineIndex?: number, opts?: { force?: boolean }): void;
  dismissTriggerCandidates(): void;
  copyStackItem(cardId: string): void;
  copyPermanent(cardId: string, quantity?: number): void;
  resolveTop(to?: ZoneId): void;
  confirmGuidedTarget(cardId: string): void;
  confirmGuidedDiscard(cardId: string): void;
  confirmGuidedLibrarySearch(cardId?: string): void;
  confirmGuidedSacrifice(cardId: string): void;
  confirmGuidedCostSubject(cardId: string): void;
  confirmGuidedPlayerTarget(playerId: PlayerId): void;
  confirmGuidedScrySurveil(topOrder: string[], toBottom: string[], toGraveyard: string[]): void;
  confirmGuidedModal(chosen: number[]): void;
  confirmGuidedMana(color: ManaColor): void;
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

function guidedTapStatusWarnings(
  state: GameState,
  prompt: EffectPrompt,
  cardIds: readonly string[],
): string[] {
  if (prompt.atom !== 'effect.tap' && prompt.atom !== 'effect.untap') {
    return [];
  }

  return cardIds.flatMap((cardId) => {
    const card = state.cards[cardId];
    if (!card) {
      return [];
    }
    if (prompt.atom === 'effect.tap' && card.tapped) {
      return [`${cardLabel(state, cardId)}はすでにタップされています(CR 701.26a)。`];
    }
    if (prompt.atom === 'effect.untap' && !card.tapped) {
      return [`${cardLabel(state, cardId)}はアンタップ状態です(CR 701.26b)。`];
    }
    return [];
  });
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

function cardTypeLinesForState(state: GameState, cardId: string): string[] {
  const card = state.cards[cardId];
  const def = card ? state.defs[card.defId] : undefined;
  if (!def) {
    return [];
  }
  return [def.typeLine, ...def.faces.map((face) => face.typeLine)].filter((line) => line !== '');
}

function isLandTypeLine(line: string): boolean {
  return /\bLand\b/i.test(line);
}

function matchesLibrarySearchFilter(
  state: GameState,
  cardId: string,
  filter: LibrarySearchFilter,
): boolean {
  const typeLines = cardTypeLinesForState(state, cardId);
  if (!typeLines.some((line) => isLandTypeLine(line))) {
    return false;
  }
  if (filter.kind === 'basic-land') {
    return typeLines.some((line) => isLandTypeLine(line) && /\bBasic\b/i.test(line));
  }
  return typeLines.some(
    (line) => isLandTypeLine(line) && new RegExp(`\\b${filter.subtype}\\b`, 'i').test(line),
  );
}

function isPureSelfLibraryShuffleLine(raw: string): boolean {
  return /^(?:you\s+)?shuffle(?:\s+(?:your|the)\s+library)?[.。]?$/i.test(
    raw.replace(/\s+/g, ' ').trim(),
  );
}

function stackTopHasPureSelfLibraryShuffle(state: GameState): boolean {
  if (state.effectsAuto !== true) {
    return false;
  }
  const topId = state.zones.stack[state.zones.stack.length - 1];
  const card = topId ? state.cards[topId] : undefined;
  if (!card) {
    return false;
  }
  const sourceId = card.isAbility ? card.sourceId : card.id;
  if (!sourceId || state.cards[sourceId]?.effectsAuto === false) {
    return false;
  }
  const def = state.defs[card.defId];
  if (!def) {
    return false;
  }
  const lines = splitAbilityLines(def);
  if (card.isAbility) {
    const line = card.abilityLineIndex === undefined ? undefined : lines[card.abilityLineIndex];
    return line ? isPureSelfLibraryShuffleLine(line.text) : false;
  }
  return lines.some((line) => line.shape === 'spell' && isPureSelfLibraryShuffleLine(line.text));
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

function withMoveReason(commands: readonly GameCommand[], reason: 'sacrifice'): GameCommand[] {
  return commands.map((cmd) =>
    cmd.type === 'moveCard' && cmd.to === 'graveyard' && cmd.reason === undefined
      ? { ...cmd, reason }
      : cmd,
  );
}

function guidedCommandsWithSemanticReasons(
  prompt: EffectPrompt,
  commands: readonly GameCommand[],
): GameCommand[] {
  return prompt.kind === 'sacrifice' || prompt.atom === 'effect.sacrifice'
    ? withMoveReason(commands, 'sacrifice')
    : commands.slice();
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
      cur && shouldCollectPending ? appendCollectedPendingTriggers(cur, next) : next;
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

  function resolveStackTopCommandForState(cur: GameState, to?: ZoneId): GameCommand {
    const base: GameCommand =
      to === undefined ? { type: 'resolveStackTop' } : { type: 'resolveStackTop', to };
    if (!stackTopHasPureSelfLibraryShuffle(cur)) {
      return base;
    }
    const rng = createRng(randomSeed());
    return {
      ...base,
      libraryShuffleOrder: shuffledOrder(cur.zones.library, rng),
    };
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

    const resolveCommand = resolveStackTopCommandForState(cur, pending.to);
    try {
      const result = applyCommands(cur, [...commands, resolveCommand]);
      const logged = appendLog(
        result.state,
        `${cardLabel(cur, pending.sourceId)}の効果を誘導実行した。`,
      );
      commit(logged, [...(pending.warnings ?? []), ...result.warnings]);
    } catch (err) {
      console.error(err);
      set({ pendingGuided: null });
    }
  }

  function advanceGuidedResolution(
    extraCommands: readonly GameCommand[],
    prependPrompts: readonly EffectPrompt[] = [],
    extraWarnings: readonly string[] = [],
  ): void {
    const pending = get().pendingGuided;
    if (!pending) return;

    const commands = [...pending.commands, ...extraCommands];
    const prompts = [...prependPrompts, ...pending.prompts.slice(1)];
    const warnings = [...(pending.warnings ?? []), ...extraWarnings];
    const nextPending: PendingGuidedResolution = {
      ...pending,
      prompts,
      commands,
      ...(warnings.length > 0 ? { warnings } : {}),
    };
    if (prompts.length === 0) {
      finishGuidedResolution(nextPending, commands);
      return;
    }

    set({
      pendingGuided: nextPending,
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
      const compiled = compileAbilityIR(ir, {
        sourceId: pending.sourceId,
        def,
        allowLibrarySearchComposite: false,
      });
      if (compiled.decision === 'auto') {
        commands.push(...compiled.commands);
      } else if (compiled.decision === 'guided') {
        commands.push(...compiled.commands);
        prompts.push(...compiled.prompts);
      }
    }

    return { commands, prompts };
  }

  function isActivationPending(
    pending: PendingGuidedResolution | null,
  ): pending is PendingGuidedResolution & { mode: 'activation'; activation: PendingActivation } {
    return pending?.mode === 'activation' && pending.activation !== undefined;
  }

  function isManaAbilityPending(
    pending: PendingGuidedResolution | null,
  ): pending is PendingGuidedResolution & {
    mode: 'mana-ability';
    manaAbility: PendingManaAbility;
  } {
    return pending?.mode === 'mana-ability' && pending.manaAbility !== undefined;
  }

  function finishGuidedManaAbility(
    pending: PendingGuidedResolution & { mode: 'mana-ability'; manaAbility: PendingManaAbility },
    commands: readonly GameCommand[],
  ): void {
    const cur = get().state;
    if (!cur) return;

    try {
      const result = resolveManaAbilityTransaction(cur, {
        sourceId: pending.sourceId,
        ...(pending.manaAbility.abilityLineIndex === undefined
          ? {}
          : { abilityLineIndex: pending.manaAbility.abilityLineIndex }),
        commands,
      });
      const warnings = result.warnings.slice();
      if (pending.manaAbility.manaShortfall > 0) {
        warnings.push(
          `${cardLabel(cur, pending.sourceId)}のマナ能力の起動コストのマナが${pending.manaAbility.manaShortfall}点不足しています。`,
        );
      }
      const next = appendLog(result.state, `${cardLabel(cur, pending.sourceId)}のマナ能力を起動。`);
      commit(next, warnings);
    } catch (err) {
      const message = err instanceof EngineError ? err.message : String(err);
      set({ warnings: [...get().warnings, message], pendingGuided: null });
    }
  }

  function advanceGuidedManaAbility(extraCommands: readonly GameCommand[]): void {
    const pending = get().pendingGuided;
    if (!isManaAbilityPending(pending)) {
      return;
    }

    const commands = [...pending.commands, ...extraCommands];
    const prompts = pending.prompts.slice(1);
    if (prompts.length === 0) {
      finishGuidedManaAbility(pending, commands);
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

  function targetSlotId(prompt: EffectPrompt, fallbackIndex: number): string {
    return prompt.slotId ?? `target-${fallbackIndex}`;
  }

  function costComponentSlotIdForPrompt(prompt: EffectPrompt): string | null {
    const slotId = prompt.slotId;
    if (!slotId) {
      return null;
    }
    const match = /^(cost-\d+)-choice-\d+$/.exec(slotId);
    return match?.[1] ?? slotId;
  }

  function activationSubjectRefFromSnapshot(
    snapshot: NonNullable<ActivationSourceRef['snapshot']>,
  ): ActivationSourceRef {
    return {
      physicalCardId: snapshot.physicalCardId,
      objectId: snapshot.objectId,
      snapshot,
    };
  }

  function selectedCostSubjectIds(activation: PendingActivation): Set<string> {
    const ids = new Set<string>();
    for (const component of activation.costComponents) {
      if (component.subjectRef) {
        ids.add(component.subjectRef.physicalCardId);
      }
      for (const subjectRef of component.subjectRefs ?? []) {
        ids.add(subjectRef.physicalCardId);
      }
    }
    return ids;
  }

  function eligibleCostSubjectIds(
    state: GameState,
    pending: PendingActivation,
    prompt: EffectPrompt,
    options: { excludeSelected?: boolean } = {},
  ): string[] {
    const selected =
      options.excludeSelected === false ? new Set<string>() : selectedCostSubjectIds(pending);
    if (prompt.kind === 'cost-discard') {
      return state.zones.hand.filter((cardId) => !selected.has(cardId));
    }
    if (prompt.kind === 'cost-sacrifice') {
      return eligibleTargets(
        state,
        prompt.filter ?? { types: ['permanent'], controller: 'you' },
      ).filter((cardId) => cardId !== pending.sourceId && !selected.has(cardId));
    }
    return [];
  }

  function appendSubjectRef(
    component: ActivationCostComponent,
    subjectRef: ActivationSourceRef,
  ): ActivationCostComponent {
    const subjectRefs = [...(component.subjectRefs ?? []), subjectRef];
    return {
      ...component,
      subjectRef: component.subjectRef ?? subjectRef,
      subjectRefs,
    };
  }

  function costComponentsWithSubject(
    components: readonly ActivationCostComponent[],
    prompt: EffectPrompt,
    subjectRef: ActivationSourceRef,
  ): ActivationCostComponent[] {
    const componentSlotId = costComponentSlotIdForPrompt(prompt);
    if (!componentSlotId) {
      return components.map((component) => ({ ...component }));
    }
    return components.map((component) =>
      component.slotId === componentSlotId
        ? appendSubjectRef(component, subjectRef)
        : { ...component },
    );
  }

  function activationEnvelopeFromPending(
    pending: PendingActivation,
    targetSelections: readonly TargetSelection[],
  ): ActivationEnvelope {
    return {
      sourceRef: {
        physicalCardId: pending.sourceSnapshot.physicalCardId,
        objectId: pending.sourceSnapshot.objectId,
        snapshot: pending.sourceSnapshot,
      },
      ...(pending.abilityLineIndex === undefined
        ? {}
        : { abilityLineIndex: pending.abilityLineIndex }),
      cost: pending.costComponents,
      targetSelections: targetSelections.map((selection) => ({ ...selection })),
      stackPolicy: 'stack',
      paymentMode: pending.paymentMode,
    };
  }

  function activationCostWarnings(state: GameState, pending: PendingActivation): string[] {
    const warnings: string[] = [];
    if (pending.manaShortfall > 0) {
      warnings.push(
        `${cardLabel(state, pending.sourceId)}の起動コストのマナが${pending.manaShortfall}点不足しています。`,
      );
    }

    const source = state.cards[pending.sourceId];
    const paysTapSelf = pending.commands.some(
      (cmd) => cmd.type === 'setTapped' && cmd.cardId === pending.sourceId && cmd.tapped,
    );
    if (paysTapSelf && source?.tapped) {
      warnings.push(`${cardLabel(state, pending.sourceId)}はすでにタップされています。`);
    }
    for (const component of pending.costComponents) {
      const amount = component.amount ?? 0;
      if (component.kind === 'pay-life' && state.life < amount) {
        warnings.push(
          `${cardLabel(state, pending.sourceId)}の起動コストのライフが${amount - state.life}点不足しています。`,
        );
      }
      if (component.kind === 'discard' && state.zones.hand.length < amount) {
        warnings.push(
          `${cardLabel(state, pending.sourceId)}の起動コストで捨てる手札が${amount - state.zones.hand.length}枚不足しています。`,
        );
      }
      if (component.kind === 'sacrifice-object') {
        const prompt = pending.costPrompts.find(
          (entry) =>
            entry.kind === 'cost-sacrifice' &&
            costComponentSlotIdForPrompt(entry) === component.slotId,
        );
        const eligibleCount = prompt
          ? eligibleCostSubjectIds(state, pending, prompt, { excludeSelected: false }).length
          : 0;
        if (eligibleCount < amount) {
          warnings.push(
            `${cardLabel(state, pending.sourceId)}の起動コストで生け贄に捧げるパーマネントが${amount - eligibleCount}体不足しています。`,
          );
        }
      }
    }
    return warnings;
  }

  function missingTargetWarnings(
    state: GameState,
    pending: PendingActivation,
    prompts: readonly EffectPrompt[],
    targetSelections: readonly TargetSelection[],
  ): string[] {
    const selectedSlots = new Set(targetSelections.map((selection) => selection.slotId));
    const missing = prompts.filter(
      (prompt, index) => !selectedSlots.has(targetSlotId(prompt, index)),
    );
    return missing.length === 0
      ? []
      : [`${cardLabel(state, pending.sourceId)}の対象が未選択です。`];
  }

  function uncheckedTargetWarnings(
    state: GameState,
    pending: PendingActivation,
    targetSelections: readonly TargetSelection[],
  ): string[] {
    return targetSelections.some((selection) => selection.legalityMode !== 'checked')
      ? [`${cardLabel(state, pending.sourceId)}の対象が現在の候補にありません。`]
      : [];
  }

  function costSubjectWarnings(state: GameState, pending: PendingActivation): string[] {
    const warnings: string[] = [];
    for (const component of pending.costComponents) {
      if (component.kind !== 'discard' && component.kind !== 'sacrifice-object') {
        continue;
      }
      const amount = component.amount ?? 0;
      const subjectRefs =
        component.subjectRefs ?? (component.subjectRef ? [component.subjectRef] : []);
      if (subjectRefs.length < amount) {
        warnings.push(`${cardLabel(state, pending.sourceId)}の起動コストの選択が未完了です。`);
        continue;
      }
      if (component.kind === 'discard') {
        const invalid = subjectRefs.some(
          (subjectRef) => !state.zones.hand.includes(subjectRef.physicalCardId),
        );
        if (invalid) {
          warnings.push(
            `${cardLabel(state, pending.sourceId)}の捨てるカードが現在の手札にありません。`,
          );
        }
        continue;
      }

      const prompt = pending.costPrompts.find(
        (entry) =>
          entry.kind === 'cost-sacrifice' &&
          costComponentSlotIdForPrompt(entry) === component.slotId,
      );
      const eligible = new Set(
        prompt ? eligibleCostSubjectIds(state, pending, prompt, { excludeSelected: false }) : [],
      );
      const invalid = subjectRefs.some((subjectRef) => {
        const snapshot = objectSnapshotForCard(state, subjectRef.physicalCardId);
        return (
          !snapshot ||
          snapshot.objectId !== subjectRef.objectId ||
          !eligible.has(subjectRef.physicalCardId)
        );
      });
      if (invalid) {
        warnings.push(
          `${cardLabel(state, pending.sourceId)}の生け贄コストの選択が現在の候補にありません。`,
        );
      }
    }
    return warnings;
  }

  function forcedActivationWarning(state: GameState, pending: PendingActivation): string {
    return `${cardLabel(state, pending.sourceId)}の能力を強行起動しました。CR-legalとして扱いません。`;
  }

  function commitActivation(
    pending: PendingActivation,
    remainingPrompts: readonly EffectPrompt[],
    targetSelections: readonly TargetSelection[],
  ): void {
    const cur = get().state;
    if (!cur) return;

    const warnings = [
      ...activationCostWarnings(cur, pending),
      ...missingTargetWarnings(cur, pending, remainingPrompts, targetSelections),
      ...uncheckedTargetWarnings(cur, pending, targetSelections),
      ...costSubjectWarnings(cur, pending),
    ];
    const forced = pending.paymentMode === 'forced';
    if (!forced && warnings.length > 0) {
      set({ warnings: [...get().warnings, ...warnings], pendingGuided: null });
      return;
    }

    const activationEnvelope = activationEnvelopeFromPending(pending, targetSelections);
    const addCmd: GameCommand = {
      type: 'addAbilityToStack',
      sourceId: pending.sourceId,
      kind: 'activated',
      ...(pending.abilityLineIndex === undefined
        ? {}
        : { abilityLineIndex: pending.abilityLineIndex }),
      sourceSnapshot: pending.sourceSnapshot,
      targetSelections: targetSelections.map((selection) => ({ ...selection })),
      activationEnvelope,
    };

    try {
      const result = applyCommands(cur, [...pending.commands, addCmd]);
      const next =
        pending.costDecision === 'auto'
          ? appendLog(
              result.state,
              forced
                ? `${cardLabel(cur, pending.sourceId)}の能力を強行起動(コスト精算)。`
                : `${cardLabel(cur, pending.sourceId)}の能力を起動(コスト精算)。`,
            )
          : result.state;
      const manualWarning =
        pending.costDecision === 'auto'
          ? []
          : [
              `${cardLabel(cur, pending.sourceId)}の起動コストは手払いしてください。CR-legalとして扱いません。`,
            ];
      commit(next, [
        ...result.warnings,
        ...warnings,
        ...manualWarning,
        ...(forced ? [forcedActivationWarning(cur, pending)] : []),
      ]);
    } catch (err) {
      const message = err instanceof EngineError ? err.message : String(err);
      set({ warnings: [...get().warnings, message], pendingGuided: null });
    }
  }

  function targetSelectionForCard(
    state: GameState,
    prompt: EffectPrompt,
    cardId: string,
    forced: boolean,
    fallbackIndex: number,
    sourceId: string,
  ): TargetSelection | null {
    const snapshot = objectSnapshotForCard(state, cardId);
    if (!snapshot) {
      return null;
    }
    const legal = eligibleTargets(state, prompt.filter ?? {}, { sourceId }).includes(cardId);
    return {
      slotId: targetSlotId(prompt, fallbackIndex),
      raw: prompt.raw,
      kind: prompt.targetKind ?? 'object',
      selection: {
        kind: 'object',
        physicalCardId: snapshot.physicalCardId,
        objectId: snapshot.objectId,
        snapshot,
      },
      legalityMode: legal ? 'checked' : forced ? 'forced' : 'unchecked-warning',
    };
  }

  function targetSelectionForPlayer(
    prompt: EffectPrompt,
    playerId: PlayerId,
    fallbackIndex: number,
  ): TargetSelection {
    return {
      slotId: targetSlotId(prompt, fallbackIndex),
      raw: prompt.raw,
      kind: prompt.targetKind ?? 'player',
      selection: {
        kind: 'player',
        playerId,
      },
      legalityMode: 'checked',
    };
  }

  function advanceActivationTarget(selection: TargetSelection): void {
    const pendingGuided = get().pendingGuided;
    if (!isActivationPending(pendingGuided)) {
      return;
    }
    const activation = pendingGuided.activation;
    const targetSelections = [...activation.targetSelections, selection];
    const prompts = pendingGuided.prompts.slice(1);
    if (prompts.length === 0) {
      commitActivation(activation, [], targetSelections);
      return;
    }

    set({
      pendingGuided: {
        ...pendingGuided,
        prompts,
        activation: {
          ...activation,
          targetSelections,
        },
      },
    });
  }

  function advanceActivationCostSubject(
    command: GameCommand,
    costComponents: ActivationCostComponent[],
  ): void {
    const pendingGuided = get().pendingGuided;
    if (!isActivationPending(pendingGuided)) {
      return;
    }
    const activation: PendingActivation = {
      ...pendingGuided.activation,
      commands: [...pendingGuided.activation.commands, command],
      costComponents,
    };
    const prompts = pendingGuided.prompts.slice(1);
    if (prompts.length === 0) {
      commitActivation(activation, [], activation.targetSelections);
      return;
    }

    set({
      pendingGuided: {
        ...pendingGuided,
        prompts,
        activation,
      },
    });
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

    returnLinkedExile(linkId) {
      const cur = get().state;
      if (!cur) return;
      try {
        const result = returnLinkedExileToBattlefield(cur, linkId);
        commit(result.state, result.warnings);
      } catch (err) {
        if (err instanceof EngineError) {
          console.error(err.message);
        } else {
          console.error(err);
        }
      }
    },

    consumeLinkedExileForSource(linkId, sourcePhysicalId) {
      const cur = get().state;
      if (!cur) return;
      try {
        const result = consumeLinkedExileForSourceInState(cur, linkId, sourcePhysicalId);
        commit(result.state, result.warnings);
      } catch (err) {
        if (err instanceof EngineError) {
          console.error(err.message);
        } else {
          console.error(err);
        }
      }
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
        readyPendingTriggers(before.pendingTriggers).map((trigger) => [
          trigger.pendingTriggerId,
          trigger,
        ]),
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
      const readyTriggers = readyPendingTriggers(cur.pendingTriggers);
      if (readyTriggers.length === 0) return;

      const orderResult = orderPendingTriggersApnap(
        readyTriggers,
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

      while (readyPendingTriggers(workingState.pendingTriggers).length > 0) {
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

        if (
          iterations >= maxIterations &&
          readyPendingTriggers(workingState.pendingTriggers).length > 0
        ) {
          warnings.push(PRIORITY_TRIGGER_FIXED_POINT_LIMIT_WARNING);
          break;
        }

        orderedIds =
          readyPendingTriggers(workingState.pendingTriggers).length === 0
            ? []
            : deterministicPendingTriggerOrderForPriority(workingState);
      }

      commit(workingState, warnings, { collectPending: false });
    },

    activateAbility(sourceId, abilityLineIndex, opts) {
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
        // CR 118.3/602.2: the no-stack mana path enforces the same cost atomicity as the
        // normal activation path for modeled costs. Rules-legal blocks; forced may proceed
        // but is marked non-CR-legal (sandbox escape).
        const costTapsSelf = manaAbilityPlan.commands.some(
          (command) =>
            command.type === 'setTapped' && command.cardId === sourceId && command.tapped,
        );
        if (costTapsSelf && cur.cards[sourceId]?.tapped) {
          if (!opts?.force) {
            set({
              warnings: [
                ...get().warnings,
                `${cardLabel(cur, sourceId)}はすでにタップされているため{T}コストを支払えません。`,
              ],
              pendingGuided: null,
            });
            return;
          }
          set({
            warnings: [
              ...get().warnings,
              `${cardLabel(cur, sourceId)}の{T}コストは支払えないため、この起動をCR-legalとして扱いません(強行)。`,
            ],
          });
        }
        if (manaAbilityPlan.lifeCost > cur.life) {
          if (!opts?.force) {
            set({
              warnings: [
                ...get().warnings,
                `${cardLabel(cur, sourceId)}のマナ能力のライフコストが${manaAbilityPlan.lifeCost - cur.life}点不足しています。`,
              ],
              pendingGuided: null,
            });
            return;
          }
          set({
            warnings: [
              ...get().warnings,
              `${cardLabel(cur, sourceId)}のライフコストは支払えないため、この起動をCR-legalとして扱いません(強行)。`,
            ],
          });
        }
        if (manaAbilityPlan.decision === 'manual') {
          set({
            warnings: [
              ...get().warnings,
              `${cardLabel(cur, sourceId)}のマナ能力はスタックに置かず、手動でコストとマナを反映してください。`,
            ],
          });
          return;
        }
        if (manaAbilityPlan.decision === 'guided') {
          set({
            pendingGuided: {
              mode: 'mana-ability',
              sourceId,
              prompts: manaAbilityPlan.prompts,
              commands: manaAbilityPlan.commands,
              manaAbility: {
                ...(resolvedAbilityLineIndex === undefined
                  ? {}
                  : { abilityLineIndex: resolvedAbilityLineIndex }),
                manaShortfall: manaAbilityPlan.manaShortfall,
              },
            },
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
      const sourceSnapshot = objectSnapshotForCard(cur, sourceId);
      if (!sourceSnapshot) {
        set({ warnings: [...get().warnings, `能力の発生源が存在しません: ${sourceId}`] });
        return;
      }

      const paymentMode: ActivationPaymentMode = opts?.force === true ? 'forced' : 'rules-legal';
      const pendingActivation: PendingActivation = {
        sourceId,
        ...(resolvedAbilityLineIndex === undefined
          ? {}
          : { abilityLineIndex: resolvedAbilityLineIndex }),
        commands: plan?.commands ?? [],
        costComponents: plan?.costComponents ?? [],
        costPrompts: plan?.costPrompts ?? [],
        sourceSnapshot,
        targetSelections: [],
        paymentMode,
        manaShortfall: plan?.manaShortfall ?? 0,
        costDecision: plan === null ? 'disabled' : plan.decision,
      };

      const targetPrompts = activationTargetPromptsForSource(
        cur,
        sourceId,
        resolvedAbilityLineIndex,
      );
      const costWarnings = activationCostWarnings(cur, pendingActivation);
      if (paymentMode === 'rules-legal' && costWarnings.length > 0) {
        set({ warnings: [...get().warnings, ...costWarnings], pendingGuided: null });
        return;
      }

      // Targets are chosen as the ability is activated (CR 115.1c/602.2b), regardless of
      // paymentMode: the `forced` sandbox escape bypasses unpayable COSTS, not target choice.
      // So a targeted ability always routes through the target picker before commit.
      const activationPrompts = [...targetPrompts, ...pendingActivation.costPrompts];
      if (activationPrompts.length > 0) {
        set({
          pendingGuided: {
            mode: 'activation',
            sourceId,
            prompts: activationPrompts,
            commands: [],
            activation: pendingActivation,
          },
        });
        return;
      }

      commitActivation(pendingActivation, [], []);
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
            // Deterministic commands of the guided lines ride along so mixed auto+guided
            // lines are not half-executed (§32 mixed→guided; CR 608.2c).
            commands: plan.commands,
            ...(to === undefined ? {} : { to }),
          },
        });
        return;
      }
      dispatch(resolveStackTopCommandForState(cur, to));
    },

    confirmGuidedTarget(cardId) {
      const cur = get().state;
      const pending = get().pendingGuided;
      const prompt = pending?.prompts[0];
      if (!cur || !pending || prompt?.kind !== 'target') {
        return;
      }
      if (isActivationPending(pending)) {
        const selection = targetSelectionForCard(
          cur,
          prompt,
          cardId,
          pending.activation.paymentMode === 'forced',
          pending.activation.targetSelections.length,
          pending.sourceId,
        );
        if (!selection) {
          set({ warnings: [...get().warnings, `対象が存在しません: ${cardId}`] });
          return;
        }
        advanceActivationTarget(selection);
        return;
      }
      const legalIds = new Set(
        eligibleTargets(cur, prompt.filter ?? {}, { sourceId: pending.sourceId }),
      );
      if (!legalIds.has(cardId)) {
        set({ warnings: [...get().warnings, `${cardLabel(cur, cardId)}は対象候補にありません。`] });
        return;
      }
      const def = sourceDefFor(cur, pending.sourceId);
      if (!def) {
        advanceGuidedResolution([]);
        return;
      }
      const sourceSnapshot = objectSnapshotForCard(cur, pending.sourceId);
      const commands = buildGuidedCommands(
        prompt,
        { kind: 'target', cardIds: [cardId] },
        {
          sourceId: pending.sourceId,
          def,
          ...(sourceSnapshot ? { sourceObjectId: sourceSnapshot.objectId } : {}),
        },
      );
      advanceGuidedResolution(
        guidedCommandsWithSemanticReasons(prompt, commands),
        [],
        guidedTapStatusWarnings(cur, prompt, [cardId]),
      );
    },

    confirmGuidedDiscard(cardId) {
      const cur = get().state;
      const pending = get().pendingGuided;
      const prompt = pending?.prompts[0];
      if (!cur || !pending || prompt?.kind !== 'discard') {
        return;
      }
      if (!cur.zones.hand.includes(cardId)) {
        set({
          warnings: [...get().warnings, `${cardLabel(cur, cardId)}は現在の手札にありません。`],
        });
        return;
      }
      const def = sourceDefFor(cur, pending.sourceId);
      if (!def) {
        advanceGuidedResolution([]);
        return;
      }
      const commands = buildGuidedCommands(
        prompt,
        { kind: 'discard', cardIds: [cardId] },
        { sourceId: pending.sourceId, def },
      );
      advanceGuidedResolution(guidedCommandsWithSemanticReasons(prompt, commands));
    },

    confirmGuidedLibrarySearch(cardId) {
      const cur = get().state;
      const pending = get().pendingGuided;
      const prompt = pending?.prompts[0];
      const spec = prompt?.librarySearch;
      if (!cur || !pending || prompt?.kind !== 'library-search' || !spec) {
        return;
      }
      if (cardId !== undefined) {
        if (!cur.zones.library.includes(cardId)) {
          set({
            warnings: [
              ...get().warnings,
              `${cardLabel(cur, cardId)}は現在のライブラリにありません。`,
            ],
          });
          return;
        }
        if (!matchesLibrarySearchFilter(cur, cardId, spec.filter)) {
          set({
            warnings: [...get().warnings, `${cardLabel(cur, cardId)}はサーチ条件に合いません。`],
          });
          return;
        }
      }

      const def = sourceDefFor(cur, pending.sourceId);
      if (!def) {
        advanceGuidedResolution([]);
        return;
      }

      const rng = createRng(randomSeed());
      const order = shuffledOrder(
        cardId === undefined ? cur.zones.library : cur.zones.library.filter((id) => id !== cardId),
        rng,
      );
      const commands = buildGuidedCommands(
        prompt,
        { kind: 'library-search', cardIds: cardId === undefined ? [] : [cardId] },
        { sourceId: pending.sourceId, def, libraryShuffleOrder: order },
      );
      if (commands.length === 0) {
        set({
          warnings: [
            ...get().warnings,
            `${cardLabel(cur, pending.sourceId)}のサーチを実行できません。`,
          ],
        });
        return;
      }
      advanceGuidedResolution(commands);
    },

    confirmGuidedSacrifice(cardId) {
      const cur = get().state;
      const pending = get().pendingGuided;
      const prompt = pending?.prompts[0];
      if (!cur || !pending || prompt?.kind !== 'sacrifice') {
        return;
      }
      const legalIds = new Set(
        eligibleTargets(cur, prompt.filter ?? { types: ['permanent'], controller: 'you' }),
      );
      if (!legalIds.has(cardId)) {
        set({
          warnings: [...get().warnings, `${cardLabel(cur, cardId)}は生け贄の候補にありません。`],
        });
        return;
      }
      const def = sourceDefFor(cur, pending.sourceId);
      if (!def) {
        advanceGuidedResolution([]);
        return;
      }
      const commands = buildGuidedCommands(
        prompt,
        { kind: 'sacrifice', cardIds: [cardId] },
        { sourceId: pending.sourceId, def },
      );
      advanceGuidedResolution(guidedCommandsWithSemanticReasons(prompt, commands));
    },

    confirmGuidedCostSubject(cardId) {
      const cur = get().state;
      const pending = get().pendingGuided;
      const prompt = pending?.prompts[0];
      if (
        !cur ||
        !isActivationPending(pending) ||
        (prompt?.kind !== 'cost-discard' && prompt?.kind !== 'cost-sacrifice')
      ) {
        return;
      }

      const snapshot = objectSnapshotForCard(cur, cardId);
      if (!snapshot) {
        set({ warnings: [...get().warnings, `コストに選択したカードが存在しません: ${cardId}`] });
        return;
      }
      if (selectedCostSubjectIds(pending.activation).has(cardId)) {
        set({ warnings: [...get().warnings, `コストに同じカードは選択できません: ${cardId}`] });
        return;
      }

      const forced = pending.activation.paymentMode === 'forced';
      const legalIds = new Set(eligibleCostSubjectIds(cur, pending.activation, prompt));
      if (!legalIds.has(cardId) && !forced) {
        set({
          warnings: [
            ...get().warnings,
            `${cardLabel(cur, cardId)}は起動コストの候補にありません。`,
          ],
        });
        return;
      }
      if (prompt.kind === 'cost-discard' && !cur.zones.hand.includes(cardId)) {
        set({
          warnings: [...get().warnings, `${cardLabel(cur, cardId)}は現在の手札にありません。`],
        });
        return;
      }
      if (
        prompt.kind === 'cost-sacrifice' &&
        (cardId === pending.activation.sourceId || cur.cards[cardId]?.zone !== 'battlefield')
      ) {
        set({
          warnings: [
            ...get().warnings,
            `${cardLabel(cur, cardId)}は生け贄コストの候補にありません。`,
          ],
        });
        return;
      }

      const subjectRef = activationSubjectRefFromSnapshot(snapshot);
      const costComponents = costComponentsWithSubject(
        pending.activation.costComponents,
        prompt,
        subjectRef,
      );
      const command: GameCommand =
        prompt.kind === 'cost-discard'
          ? { type: 'discard', cardIds: [cardId] }
          : { type: 'moveCard', cardId, to: 'graveyard', position: 'top', reason: 'sacrifice' };
      advanceActivationCostSubject(command, costComponents);
    },

    confirmGuidedPlayerTarget(playerId) {
      const pending = get().pendingGuided;
      const prompt = pending?.prompts[0];
      if (!isActivationPending(pending) || prompt?.kind !== 'target') {
        return;
      }
      advanceActivationTarget(
        targetSelectionForPlayer(prompt, playerId, pending.activation.targetSelections.length),
      );
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

    confirmGuidedMana(color) {
      const cur = get().state;
      const pending = get().pendingGuided;
      const prompt = pending?.prompts[0];
      if (!cur || !pending || prompt?.kind !== 'mana') {
        return;
      }
      const manaOptions: ManaColor[] = prompt.manaOptions ?? ['W', 'U', 'B', 'R', 'G'];
      if (!manaOptions.includes(color)) {
        set({ warnings: [...get().warnings, `${color}マナは選択肢にありません。`] });
        return;
      }

      const def = sourceDefFor(cur, pending.sourceId);
      if (!def) {
        if (isManaAbilityPending(pending)) {
          advanceGuidedManaAbility([]);
        } else {
          advanceGuidedResolution([]);
        }
        return;
      }
      const commands = buildGuidedCommands(
        prompt,
        { kind: 'mana', color },
        { sourceId: pending.sourceId, def },
      );
      if (isManaAbilityPending(pending)) {
        advanceGuidedManaAbility(commands);
        return;
      }
      advanceGuidedResolution(commands);
    },

    cancelGuidedPrompt() {
      const pending = get().pendingGuided;
      if (isActivationPending(pending) || isManaAbilityPending(pending)) {
        set({ pendingGuided: null });
        return;
      }
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
