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
  applyResolutionCommands,
  activatedManaAbilityPlanForSource,
  activationPlanForSource,
  activationTargetPromptsForSource,
  consumeLinkedExileForSource as consumeLinkedExileForSourceInState,
  EngineError,
  eligibleTargets,
  expandPlayerRecipientPrompt,
  guidedPlanForStackTop,
  objectSnapshotForCard,
  returnLinkedExileToBattlefield,
  type ApplyResult,
  type GameCommand,
} from '../engine/commands';
import { commanderTax, isCommander } from '../engine/commander';
import { initGame, type InitDeckCard } from '../engine/init';
import {
  autoTapCommands,
  planAutoManaPayment,
  type AutoTapPlan,
} from '../engine/autotap';
import { parseManaCost, solvePayment } from '../engine/mana';
import { orderPendingTriggersApnap, triggerStackPlacementBucketOf } from '../engine/priority';
import { createRng, shuffledOrder } from '../engine/random';
import {
  compileOpponentSetupCommands,
  type OpponentSetupDraft,
} from '../engine/scenario';
import { splitAbilityLines } from '../engine/grammar';
import { parseAbilityIR } from '../engine/grammar/ir';
import { hasActivatedAddManaLine, naiveTapManaColors } from '../engine/grammar/manaShortcut';
import {
  buildGuidedCommands,
  compileAbilityIR,
  guidedCounterLeafForManualComposite,
  type EffectPrompt,
  type LibrarySearchFilter,
} from '../engine/grammar/compile';
import { resolveManaAbilityTransaction } from '../engine/manaTransaction';
import {
  DEFAULT_OPPONENT_LIFE_LABEL,
  DEFAULT_OPPONENT_ID,
  emptyPlayerPrivateZones,
  LOCAL_PLAYER_ID,
  playerIdForLifeLabel,
  playerPrivateZonesFromFlatZones,
  objectIdOf,
  syncDerivedViews,
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
  type ManaPool,
  type ManualTargetZone,
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
  collectPendingTriggerUpdate,
  readyPendingTriggers,
  triggerCandidatesFromPendingTriggers,
  type TriggerCandidate,
} from '../engine/triggers';
import {
  fetchAbility,
  isSummoningSick,
  landEntersTapped,
  cyclingInfo,
  normalizeKeywords,
  effectivePower,
} from '../engine/status';
import { parseTeamworkThreshold } from '../engine/keywordGrammar';

const HISTORY_LIMIT = 200;
const SNAPSHOT_SAVE_DELAY_MS = 400;
let snapshotPersistenceDisabledForDevelopment = false;
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
const TRIGGER_TRANSITION_BLOCKED_WARNING = '未処理の誘発があります。先にスタックへ置いてください。';
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
  announcedX?: number;
}

export interface PendingManaAbility {
  abilityLineIndex?: number;
  manaShortfall: number;
  sourceSnapshot: NonNullable<ActivationEnvelope['sourceRef']['snapshot']>;
  costComponents: ActivationCostComponent[];
  costPrompts: EffectPrompt[];
  paymentMode: ActivationPaymentMode;
  announcedX?: number;
}

type PendingCostState = Pick<
  PendingActivation,
  'sourceSnapshot' | 'costComponents' | 'costPrompts' | 'paymentMode'
>;

/**
 * ACT-2: 支払えない起動コストの強行候補(サンドボックス哲学=禁止せず確認する)。
 * `confirmForceActivation`/`cancelForceActivation` で解消する。
 */
export interface PendingForceActivation {
  sourceId: string;
  abilityLineIndex?: number;
  assistRestrictedMana?: boolean;
  xValue?: number;
  warnings: string[];
}

export interface ActivateAbilityOptions {
  force?: boolean;
  assistRestrictedMana?: boolean;
  xValue?: number;
}

export interface PendingGuidedResolution {
  mode?: 'resolution' | 'activation' | 'mana-ability';
  resolutionMode?: 'top' | 'all';
  sourceId: string;
  prompts: EffectPrompt[];
  commands: GameCommand[];
  warnings?: string[];
  to?: ZoneId;
  activation?: PendingActivation;
  manaAbility?: PendingManaAbility;
}

export interface PendingCastTransaction {
  cardId: string;
  faceIndex: number;
  xValue: number;
  forced: boolean;
  payment: ManaPool;
  prompts: EffectPrompt[];
  targetSelections: TargetSelection[];
  warnings: string[];
  autoTapPlan?: AutoTapPlan;
  /** CR 702.194a: creature ids tapped for the optional teamwork additional cost. */
  teamworkTappedIds?: string[];
  /** CR 702.194a: teamwork threshold N parsed from oracle text. */
  teamworkThreshold?: number;
}

export interface ResolutionTask {
  id: string;
  message: string;
}

export interface ResolutionSession {
  mode: 'top' | 'all';
  sourceId: string;
  baseline: GameState;
  stage: 'resolving' | 'manual-required';
  reason?: 'unsupported' | 'partial' | 'runtime-failure';
  tasks: ResolutionTask[];
  stepPast: GameState[];
  stepFuture: GameState[];
}

export interface PendingCommanderResolution {
  token: number;
  cardId: string;
  objectId: string;
  defId: string;
  faceIndex: number;
  name: string;
  typeLine: string;
  imageUrl?: string;
}

export function guidedControllerId(
  state: GameState,
  pending: Pick<PendingGuidedResolution, 'sourceId' | 'activation' | 'prompts'>,
): PlayerId {
  return pending.prompts[0]?.playerId
    ?? pending.activation?.sourceSnapshot.controllerId
    ?? state.cards[pending.sourceId]?.controllerId
    ?? state.localPlayerId;
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

  const normalized: GameState['zonesByPlayer'] = {};
  for (const [playerId, privateZones] of Object.entries(rawZonesByPlayer)) {
    normalized[playerId] = normalizePlayerPrivateZones(privateZones);
  }
  normalized.P1 ??= emptyPlayerPrivateZones();
  normalized.OPPONENT_A ??= emptyPlayerPrivateZones();
  return normalized;
}

function normalizePerTurnCounter(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeOpponentLife(value: unknown): Record<string, number> {
  const fallback = { [DEFAULT_OPPONENT_LIFE_LABEL]: 40 };
  const rawOpponentLife = unknownRecord(value);
  if (!rawOpponentLife) return fallback;

  const opponentLife: Record<string, number> = {};
  for (const [label, life] of Object.entries(rawOpponentLife)) {
    if (typeof life !== 'number' || !Number.isFinite(life)) return fallback;
    opponentLife[label] = life;
  }
  opponentLife[DEFAULT_OPPONENT_LIFE_LABEL] ??= 40;
  return opponentLife;
}

function normalizeManaPool(value: unknown): GameState['manaPool'] {
  const rawManaPool = unknownRecord(value);
  const finiteMana = (color: keyof GameState['manaPool']): number => {
    const amount = rawManaPool?.[color];
    return typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
  };
  return {
    W: finiteMana('W'),
    U: finiteMana('U'),
    B: finiteMana('B'),
    R: finiteMana('R'),
    G: finiteMana('G'),
    C: finiteMana('C'),
  };
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
    value === 'end' ||
    value === 'cleanup'
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

function normalizeEmptyLibraryDrawFlags(
  value: unknown,
): GameState['emptyLibraryDrawAttemptedSinceLastSba'] {
  const rawFlags = unknownRecord(value);
  if (!rawFlags) return {};

  const flags: GameState['emptyLibraryDrawAttemptedSinceLastSba'] = {};
  for (const [playerId, flag] of Object.entries(rawFlags)) {
    if (typeof flag !== 'boolean') continue;
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
  const opponentLife = normalizeOpponentLife(snapshot.opponentLife);
  const rawPlayers = unknownRecord(snapshot.players);
  const requestedLocalPlayerId = snapshot.localPlayerId;
  const localPlayerId =
    typeof requestedLocalPlayerId === 'string' &&
    (requestedLocalPlayerId === LOCAL_PLAYER_ID || rawPlayers?.[requestedLocalPlayerId] !== undefined)
      ? requestedLocalPlayerId
      : LOCAL_PLAYER_ID;
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

  const normalized = syncDerivedViews({
    ...state,
    effectsAuto: typeof state.effectsAuto === 'boolean' ? state.effectsAuto : true,
    activePlayerId: state.activePlayerId ?? 'P1',
    localPlayerId,
    combat: normalizeSnapshotCombat(state),
    cards: normalizeSnapshotCards(state.cards),
    zones,
    zonesByPlayer,
    life: typeof snapshot.life === 'number' && Number.isFinite(snapshot.life) ? snapshot.life : 40,
    poison: normalizePerTurnCounter(snapshot.poison),
    energy: normalizePerTurnCounter(snapshot.energy),
    experience: normalizePerTurnCounter(snapshot.experience),
    opponentLife,
    manaPool: normalizeManaPool(snapshot.manaPool),
    mulliganCount: normalizePerTurnCounter(snapshot.mulliganCount),
    landsPlayedThisTurn: normalizePerTurnCounter(snapshot.landsPlayedThisTurn),
    spellsCastThisTurn: normalizePerTurnCounter(state.spellsCastThisTurn),
    drawnThisTurn: normalizePerTurnCounter(state.drawnThisTurn),
    combatDamagePreventedUntilEndOfTurn: state.combatDamagePreventedUntilEndOfTurn === true,
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
    dungeonDefs: snapshot.dungeonDefs ?? {},
    dungeons: snapshot.dungeons ?? {},
    powerUpActivated: snapshot.powerUpActivated ?? {},
  });
  const withValidActivePlayer = normalized.players[normalized.activePlayerId]
    ? normalized
    : { ...normalized, activePlayerId: normalized.localPlayerId };
  assertPrivateZoneIntegrity(withValidActivePlayer);
  assertPlayerReferenceIntegrity(withValidActivePlayer);
  return withValidActivePlayer;
}

function assertPrivateZoneIntegrity(state: GameState): void {
  const privateZones = ['library', 'hand', 'graveyard'] as const;
  const seen = new Set<string>();
  for (const [playerId, zones] of Object.entries(state.zonesByPlayer)) {
    if (!state.players[playerId]) {
      throw new EngineError(`保存データの非公開領域に未参加プレイヤーがいます: ${playerId}`);
    }
    for (const zone of privateZones) {
      for (const cardId of zones[zone]) {
        const card = state.cards[cardId];
        if (!card || card.zone !== zone || card.ownerId !== playerId || seen.has(cardId)) {
          throw new EngineError(`保存データの非公開領域が不整合です: ${cardId}`);
        }
        seen.add(cardId);
      }
    }
  }
  for (const card of Object.values(state.cards)) {
    if (privateZones.includes(card.zone as (typeof privateZones)[number]) && !seen.has(card.id)) {
      throw new EngineError(`保存データの非公開領域にカードがありません: ${card.id}`);
    }
  }
}

const SNAPSHOT_PLAYER_REFERENCE_KEYS = new Set([
  'ownerId',
  'controllerId',
  'playerId',
  'attackingPlayerId',
  'defendingPlayerId',
  'createdBy',
]);

function assertPlayerReferenceIntegrity(state: GameState): void {
  const visited = new WeakSet<object>();
  const inspect = (value: unknown, path: string): void => {
    if (typeof value !== 'object' || value === null || visited.has(value)) return;
    visited.add(value);
    for (const [key, nested] of Object.entries(value)) {
      if (
        SNAPSHOT_PLAYER_REFERENCE_KEYS.has(key)
        && typeof nested === 'string'
        && !state.players[nested]
      ) {
        throw new EngineError(`保存データのPlayerId参照が不整合です: ${path}.${key}=${nested}`);
      }
      inspect(nested, `${path}.${key}`);
    }
  };
  inspect(state.cards, 'cards');
  inspect(state.pendingTriggers, 'pendingTriggers');
  inspect(state.combat, 'combat');
  inspect(state.eventLog, 'eventLog');
  inspect(state.pendingRuleChoices, 'pendingRuleChoices');
  inspect(state.linkedExiles, 'linkedExiles');
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

function appendCommanderZoneChoicesFromTransition(previous: GameState, next: GameState): GameState {
  let result = next;
  for (const event of next.eventLog.slice(previous.eventLog.length)) {
    if (event.type !== 'zoneChange' || (event.toZone !== 'graveyard' && event.toZone !== 'exile')) continue;
    if (!isCommander(previous, event.physicalCardId)) continue;
    const current = result.cards[event.physicalCardId];
    if (!current || current.zone !== event.toZone || !event.after || objectIdOf(current) !== event.after.objectId) continue;
    const choice = commanderZoneSbaChoiceFromMove(result, event.physicalCardId, event.toZone);
    if (choice) result = appendPendingRuleChoice(result, choice);
  }
  return result;
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
    ...(pending.condition === undefined ? {} : { triggerCondition: pending.condition }),
    ...(pending.resolutionText === undefined ? {} : { resolutionText: pending.resolutionText }),
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
    state.turnOrder,
  );
  return orderResult.status === 'ordered' ? orderResult.orderedIds : null;
}

export interface GameStore {
  state: GameState | null;
  warnings: string[];
  triggerCandidates: TriggerCandidate[];
  pendingGuided: PendingGuidedResolution | null;
  pendingCast: PendingCastTransaction | null;
  resolutionSession: ResolutionSession | null;
  pendingCommanderResolution: PendingCommanderResolution | null;
  pendingForceActivation: PendingForceActivation | null;
  canUndo: boolean;
  canRedo: boolean;
  canUndoInteraction: boolean;
  canRedoInteraction: boolean;
  autoAdvanceToMain: boolean;
  mulliganDecisionPending: boolean;

  newGame(cards: InitDeckCard[], seed?: number): void;
  restoreGame(snapshot: GameSnapshot): void;
  takeSnapshot(): GameSnapshot;
  restart(): void;
  mulligan(): void;
  beginFirstTurn(): void;
  keepOpeningHand(): void;
  putBottomForMulligan(cardIds: string[]): void;
  setAutoAdvance(on: boolean): void;
  setEffectsAuto(on: boolean): void;
  setCardEffectsAuto(cardId: string, on: boolean): void;
  addOpponent(label: string): void;
  applyOpponentSetup(draft: OpponentSetupDraft): boolean;
  applyOpponentSetups(drafts: readonly OpponentSetupDraft[]): boolean;

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
    opts?: { xValue?: number; force?: boolean; faceIndex?: number },
  ): 'ok' | 'error' | { shortfall: number };
  castCommander(
    cardId: string,
    opts?: { xValue?: number; force?: boolean; faceIndex?: number },
  ): 'ok' | 'error' | { shortfall: number };
  castToStack(
    cardId: string,
    opts?: { xValue?: number; force?: boolean; faceIndex?: number },
  ): 'ok' | 'error' | 'needs-choice' | { shortfall: number };
  answerPendingCastTarget(cardId: string): void;
  answerPendingCastTeamwork(cardIds: string[]): void;
  confirmPendingCast(): void;
  cancelPendingCast(): void;
  addAbilityToStack(
    sourceId: string,
    kind: 'activated' | 'triggered',
    abilityLineIndex?: number,
  ): void;
  resolveRuleChoice(choiceId: string, selection: RuleChoiceSelection): void;
  putPendingTriggerOnStack(pendingTriggerId: string): void;
  putPendingTriggersOnStack(pendingTriggerIds: string[]): void;
  placePendingTriggersForPriority(pendingTriggerIds: string[]): void;
  activateAbility(sourceId: string, abilityLineIndex?: number, opts?: ActivateAbilityOptions): void;
  confirmForceActivation(): void;
  cancelForceActivation(): void;
  dismissTriggerCandidates(): void;
  copyStackItem(cardId: string, quantity?: number): void;
  copyPermanent(cardId: string, quantity?: number): void;
  resolveTop(to?: ZoneId): void;
  completeManualResolution(): void;
  commitCommanderResolution(token: number): void;
  confirmGuidedTarget(cardId: string): void;
  confirmGuidedDiscard(cardId: string): void;
  confirmGuidedLibrarySearch(cardId?: string): void;
  confirmGuidedSacrifice(cardId: string): void;
  confirmGuidedCostSubject(cardId: string): void;
  confirmGuidedCounterAmount(amount: number): void;
  confirmGuidedPlayerTarget(playerId: PlayerId): void;
  confirmGuidedScrySurveil(topOrder: string[], toBottom: string[], toGraveyard: string[]): void;
  confirmGuidedModal(chosen: number[]): void;
  confirmGuidedMana(color: ManaColor): void;
  cancelGuidedPrompt(): void;
  resolveAll(): void;
  removeStackItem(id: string, to?: ZoneId): void;
  setManualTargets(
    stackItemId: string,
    targetIds: string[],
    targetPlayerIds?: PlayerId[],
    allowedZones?: ManualTargetZone[],
  ): void;
  declareAttack(
    attackerIds: string[],
    targetLabel: string,
    blockers?: Array<{ cardId: string; attackerId: string }>,
  ): void;
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
      tokenKind?: CardDef['tokenKind'];
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
  pendingPast: PendingGuidedResolution[];
  pendingFuture: PendingGuidedResolution[];
  // remembered for restart()
  deck: InitDeckCard[] | null;
  lastSeed: number;
  resolutionGroupAnchor: GameState | null;
  /** resolveAll開始前のglobal undo。中断時だけ復元し、正常完了時は破棄する。 */
  resolutionGroupPast: GameState[] | null;
  /** resolveAll開始前のglobal redo。中断時だけ復元し、正常完了時は破棄する。 */
  resolutionGroupFuture: GameState[] | null;
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

interface CounterCastPlan {
  prompt: EffectPrompt;
  warnings: string[];
  partial: boolean;
}

function counterCastPlanForCard(
  state: GameState,
  cardId: string,
  faceIndex?: number,
): CounterCastPlan | null {
  const card = state.cards[cardId];
  if (!card || card.isAbility) return null;
  const def = state.defs[card.defId];
  const chosenFaceIndex = faceIndex ?? card.faceIndex;
  const face = def?.faces[chosenFaceIndex] ?? def?.faces[0];
  if (!def || !face?.oracleText) return null;
  const ir = parseAbilityIR(face.oracleText, face.typeLine ?? def.typeLine);
  const compiled = compileAbilityIR(ir, {
    sourceId: cardId,
    def,
    controllerId: card.controllerId,
  });
  if (compiled.decision === 'guided') {
    const prompt = compiled.prompts.find(
      (candidate) => candidate.kind === 'target' && candidate.atom === 'effect.counter-spell',
    );
    return prompt
      ? { prompt: { ...prompt, slotId: 'target-0' }, warnings: [], partial: false }
      : null;
  }
  if (compiled.decision !== 'manual') return null;
  const assist = guidedCounterLeafForManualComposite(ir);
  return assist
    ? {
        prompt: { ...assist.prompt, slotId: 'target-0' },
        warnings: [assist.warning],
        partial: true,
      }
    : null;
}

function stackItemRulesForStore(
  state: GameState,
  cardId: string,
): { text: string; typeLine: string; def: CardDef } | null {
  const card = state.cards[cardId];
  if (!card) return null;
  const def = state.defs[card.defId];
  if (!def) return null;
  if (card.abilityResolutionText) {
    return { text: card.abilityResolutionText, typeLine: def.typeLine, def };
  }
  if (card.isAbility && card.abilityLineIndex !== undefined) {
    const line = splitAbilityLines(def)[card.abilityLineIndex];
    if (!line) return null;
    const face = def.faces[line.faceIndex] ?? def.faces[0];
    return { text: line.text, typeLine: face?.typeLine ?? def.typeLine, def };
  }
  const face = def.faces[card.faceIndex] ?? def.faces[0];
  return face ? { text: face.oracleText ?? '', typeLine: face.typeLine ?? def.typeLine, def } : null;
}

function stackItemIsWhollyUnsupported(state: GameState, cardId: string): boolean {
  const card = state.cards[cardId];
  if (!card || state.effectsAuto === false || card.effectsAuto === false) return true;
  const rules = stackItemRulesForStore(state, cardId);
  if (!rules) return true;
  // A vanilla permanent spell has no effect body to automate; resolving the
  // stack object to the battlefield is already fully modeled.
  if (rules.text.trim() === '') return false;
  // CR 608.3: resolving a permanent spell = put onto battlefield. Static/triggered/
  // activated abilities printed on it do NOT resolve on the stack — they become
  // active after the permanent enters. If there are no 'spell'-shape effect lines,
  // there is nothing to automate beyond the battlefield move (already modeled).
  if (!card.isAbility && !/Instant|Sorcery/i.test(rules.typeLine)) {
    const hasSpellEffect = splitAbilityLines(rules.def)
      .filter((line) => line.faceIndex === card.faceIndex)
      .some((line) => line.shape === 'spell');
    if (!hasSpellEffect) return false;
  }
  // This exact effect has a dedicated deterministic engine path even though
  // the generic compiler intentionally classifies the sentence as manual.
  if (/\bcopy target activated or triggered ability you control X times\b/i.test(rules.text)) {
    return false;
  }
  if (isPureSelfLibraryShuffleLine(rules.text)) return false;
  const compiled = compileAbilityIR(parseAbilityIR(rules.text, rules.typeLine), {
    sourceId: card.sourceId ?? cardId,
    def: rules.def,
    controllerId: card.controllerId,
    ...(card.announcedX === undefined ? {} : { announcedX: card.announcedX }),
  });
  return compiled.decision === 'manual';
}

function manualResolutionDestination(state: GameState, cardId: string): ZoneId {
  const card = state.cards[cardId];
  if (!card || card.isAbility) return 'graveyard';
  const def = state.defs[card.defId];
  const face = def?.faces[card.faceIndex] ?? def?.faces[0];
  const typeLine = face?.typeLine ?? def?.typeLine ?? '';
  return /Instant|Sorcery/i.test(typeLine) ? 'graveyard' : 'battlefield';
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

  if (choice.kind === 'cleanup-discard') {
    if (selection.kind !== 'cleanup-discard') {
      return { state, warnings: [`ルール選択の種類が一致しません: ${choiceId}`] };
    }
    if (selection.manualHandled) {
      const withoutChoice = removePendingRuleChoiceById(state, choiceId);
      const advanced = applyCommand(withoutChoice, {
        type: 'nextPhase',
        manualCleanupHandled: true,
      });
      return {
        state: advanced.state,
        warnings: [
          ...advanced.warnings,
          'クリーンナップの手札調整を手動処理済みとして続行しました。',
        ],
      };
    }
    const uniqueCardIds = [...new Set(selection.cardIds)];
    const currentHand = state.zonesByPlayer[choice.playerId]?.hand ?? [];
    if (uniqueCardIds.length !== choice.requiredCount) {
      return {
        state,
        warnings: [`クリーンナップでは手札をちょうど${choice.requiredCount}枚選んでください。`],
      };
    }
    if (uniqueCardIds.some((cardId) => !currentHand.includes(cardId))) {
      return { state, warnings: ['クリーンナップで現在の手札以外が選ばれています。'] };
    }
    const discarded = applyCommand(state, {
      type: 'discard',
      cardIds: uniqueCardIds,
      playerId: choice.playerId,
    });
    const withoutChoice = removePendingRuleChoiceById(discarded.state, choiceId);
    const completed = applyCommand(withoutChoice, { type: 'completeCleanupStateActions' });
    return {
      state: completed.state,
      warnings: [...discarded.warnings, ...completed.warnings],
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

function applyAutoManaPaymentAndCommands(
  state: GameState,
  plan: AutoTapPlan,
  finalCommands: readonly GameCommand[],
): ApplyResult {
  let workingState = state;
  const warnings: string[] = [];

  for (const activation of plan.activations) {
    const commands = autoTapCommands({ activations: [activation] });
    const resolved = resolveManaAbilityTransaction(workingState, {
      sourceId: activation.cardId,
      ...(activation.abilityLineIndex === undefined
        ? {}
        : { abilityLineIndex: activation.abilityLineIndex }),
      commands,
    });
    workingState = resolved.state;
    warnings.push(...resolved.warnings);
  }

  const finalized = applyCommands(workingState, finalCommands);
  return { state: finalized.state, warnings: [...warnings, ...finalized.warnings] };
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

// CR608.2h variable loot support: the guided discard prompt for "discard up to N / any
// number of cards, then draw that many cards" is answered one card at a time and
// re-presented (see confirmGuidedDiscard/cancelGuidedPrompt below) with each already-chosen
// discard accumulating as its own `{type:'discard', cardIds:[id]}` command in
// `pending.commands`. Since the underlying GameState is not mutated until the whole guided
// resolution finishes (finishGuidedResolution applies all commands together), `cur.zones.hand`
// still lists every card already picked in this same resolution — this scans the
// accumulated commands so a card can't be picked (and discarded) twice in one loot resolution.
function variableLootDiscardedCardIds(commands: readonly GameCommand[]): string[] {
  return commands.flatMap((command) => (command.type === 'discard' ? command.cardIds : []));
}

function selectedCrossPlayerCardIds(
  commands: readonly GameCommand[],
  prompt: EffectPrompt,
): string[] {
  if (!prompt.simultaneousGroupId || !prompt.playerId) return [];
  return commands.flatMap((command) => {
    if (
      command.type === 'discard'
      && command.simultaneousGroupId === prompt.simultaneousGroupId
      && command.playerId === prompt.playerId
    ) return command.cardIds;
    if (
      command.type === 'moveCard'
      && command.simultaneousGroupId === prompt.simultaneousGroupId
      && command.reason === 'sacrifice'
    ) return [command.cardId];
    return [];
  });
}

function guidedCommandsWithSemanticReasons(
  prompt: EffectPrompt,
  commands: readonly GameCommand[],
): GameCommand[] {
  if (prompt.kind === 'sacrifice' || prompt.atom === 'effect.sacrifice') {
    return withMoveReason(commands, 'sacrifice').map((command) =>
      command.type === 'moveCard' && prompt.simultaneousGroupId
        ? { ...command, simultaneousGroupId: prompt.simultaneousGroupId }
        : command,
    );
  }
  return commands.slice();
}

export function freeMulliganBottomCount(mulliganCount: number): number {
  return Math.max(0, mulliganCount - 1);
}

export const useGameStore = create<GameStore>((set, get) => {
  // History stacks live in the closure (not part of the public store shape).
  const internal: InternalState = {
    past: [],
    future: [],
    pendingPast: [],
    pendingFuture: [],
    deck: null,
    lastSeed: 0,
    resolutionGroupAnchor: null,
    resolutionGroupPast: null,
    resolutionGroupFuture: null,
  };
  let pendingCommanderCommit: {
    token: number;
    sourceState: GameState;
    nextState: GameState;
    warnings: string[];
    continueResolveAll: boolean;
    groupedHistory: boolean;
  } | null = null;
  let requestedResolutionMode: ResolutionSession['mode'] = 'top';

  /** Drop any staged commander-resolution commit and close the grouped-history window. */
  function discardPendingCommanderResolution(): void {
    pendingCommanderCommit = null;
    internal.resolutionGroupAnchor = null;
    internal.resolutionGroupPast = null;
    internal.resolutionGroupFuture = null;
  }
  snapshotInternal = internal;

  function clearPendingInteractionHistory(): void {
    internal.pendingPast = [];
    internal.pendingFuture = [];
  }

  function startPendingGuided(pending: PendingGuidedResolution): void {
    clearPendingInteractionHistory();
    const prompts = pending.prompts.filter(
      (prompt) => !(prompt.playerId && prompt.simultaneousGroupId && prompt.count === 0),
    );
    if (prompts.length === 0) {
      finishGuidedResolution({ ...pending, prompts }, pending.commands);
      return;
    }
    set({
      pendingGuided: { ...pending, prompts },
      canUndoInteraction: true,
      canRedoInteraction: false,
    });
  }

  function advancePendingGuided(next: PendingGuidedResolution): void {
    const current = get().pendingGuided;
    if (current) {
      internal.pendingPast.push(current);
      if (internal.pendingPast.length > HISTORY_LIMIT) internal.pendingPast.shift();
    }
    internal.pendingFuture = [];
    const prompts = next.prompts.filter(
      (prompt) => !(prompt.playerId && prompt.simultaneousGroupId && prompt.count === 0),
    );
    if (prompts.length === 0) {
      finishGuidedResolution({ ...next, prompts }, next.commands);
      return;
    }
    set({
      pendingGuided: { ...next, prompts },
      canUndoInteraction: true,
      canRedoInteraction: false,
    });
  }

  function discardPendingGuided(): void {
    clearPendingInteractionHistory();
    set({
      pendingGuided: null,
      canUndoInteraction: false,
      canRedoInteraction: false,
    });
  }

  /** EngineError=ユーザー向けの拒否理由(日本語)なので warnings へ可視化する。
      それ以外は実装バグとして console に残す(2026-07-19 腐敗掃除: 従来は
      EngineError も console 行きでユーザーに何も見えなかった)。 */
  function reportActionError(err: unknown): void {
    if (err instanceof EngineError) {
      set({ warnings: [err.message] });
    } else {
      console.error(err);
    }
  }

  function commit(
    next: GameState,
    warnings: string[],
    options: { collectPending?: boolean; groupedHistory?: boolean } = {},
  ): void {
    const cur = get().state;
    const resolutionSession = get().resolutionSession;
    if (cur && resolutionSession?.stage === 'manual-required') {
      const stepPast = [...resolutionSession.stepPast, cur].slice(-HISTORY_LIMIT);
      set({
        state: next,
        warnings,
        triggerCandidates: [],
        pendingCast: null,
        resolutionSession: {
          ...resolutionSession,
          stepPast,
          stepFuture: [],
        },
        canUndoInteraction: true,
        canRedoInteraction: false,
        canRedo: false,
      });
      return;
    }
    clearPendingInteractionHistory();
    const shouldCollectPending = options.collectPending ?? true;
    let nextWithPending =
      cur && shouldCollectPending ? appendCollectedPendingTriggers(cur, next) : next;
    if (cur) {
      nextWithPending = appendCommanderZoneChoicesFromTransition(cur, nextWithPending);
    }
    let commitWarnings = warnings;
    if (
      nextWithPending.phase === 'cleanup'
      && nextWithPending.zones.stack.length === 0
      && readyPendingTriggers(nextWithPending.pendingTriggers).length === 0
      && nextWithPending.pendingRuleChoices.length === 0
    ) {
      const advanced = applyCommand(nextWithPending, { type: 'nextPhase' });
      nextWithPending = appendCollectedPendingTriggers(nextWithPending, advanced.state);
      commitWarnings = [...commitWarnings, ...advanced.warnings];
    }
    if (cur && (!options.groupedHistory || internal.resolutionGroupAnchor === null)) {
      internal.past.push(cur);
      if (internal.past.length > HISTORY_LIMIT) {
        internal.past.shift();
      }
    }
    if (cur && options.groupedHistory && internal.resolutionGroupAnchor === null) {
      internal.resolutionGroupAnchor = cur;
    }
    if (!options.groupedHistory) {
      internal.resolutionGroupAnchor = null;
      internal.resolutionGroupPast = null;
      internal.resolutionGroupFuture = null;
    }
    internal.future = [];
    const nextStoreState: Partial<GameStore> = {
      state: nextWithPending,
      warnings: commitWarnings,
      triggerCandidates: triggerCandidatesFromPendingTriggers(nextWithPending.pendingTriggers),
      canUndo: internal.past.length > 0,
      canRedo: false,
      pendingGuided: null,
      pendingCast: null,
      canUndoInteraction: false,
      canRedoInteraction: false,
      pendingCommanderResolution: null,
      // ACT-2: 成功した起動(=commit まで到達した)は強行ダイアログを引きずらない
      // (誤ダイアログを出さない)。commit() は全ての成功コミットの単一 chokepoint。
      pendingForceActivation: null,
    };
    set(nextStoreState);
  }

  function startManualResolutionSession(
    baseline: GameState,
    working: GameState,
    sourceId: string,
    reason: NonNullable<ResolutionSession['reason']>,
    message: string,
    mode: ResolutionSession['mode'] = 'top',
  ): void {
    clearPendingInteractionHistory();
    set({
      state: working,
      warnings: [],
      triggerCandidates: [],
      pendingGuided: null,
      pendingCast: null,
      resolutionSession: {
        mode,
        sourceId,
        baseline,
        stage: 'manual-required',
        reason,
        tasks: [{ id: `${sourceId}:${reason}`, message }],
        stepPast: [],
        stepFuture: [],
      },
      canUndoInteraction: true,
      canRedoInteraction: false,
      canRedo: false,
    });
  }

  function abortManualResolutionSession(session: ResolutionSession): void {
    const groupAnchor = session.mode === 'all' ? internal.resolutionGroupAnchor : null;
    const baseline = groupAnchor ?? session.baseline;
    const groupedPast = session.mode === 'all' ? internal.resolutionGroupPast : null;
    const groupedFuture = session.mode === 'all' ? internal.resolutionGroupFuture : null;
    // A grouped resolve pushes the exact anchor object once. Remove only that
    // entry; older global history must remain available after the abort.
    if (groupedPast) {
      internal.past = groupedPast;
    } else if (groupAnchor && internal.past.at(-1) === groupAnchor) {
      internal.past.pop();
    }
    if (groupedFuture) {
      internal.future = groupedFuture;
    }
    internal.resolutionGroupAnchor = null;
    internal.resolutionGroupPast = null;
    internal.resolutionGroupFuture = null;
    clearPendingInteractionHistory();
    set({
      state: baseline,
      warnings: [],
      triggerCandidates: triggerCandidatesFromPendingTriggers(baseline.pendingTriggers),
      pendingGuided: null,
      pendingCast: null,
      resolutionSession: null,
      pendingCommanderResolution: null,
      pendingForceActivation: null,
      canUndoInteraction: false,
      canRedoInteraction: false,
      canUndo: internal.past.length > 0,
      canRedo: internal.future.length > 0,
    });
  }

  function commitCompletedResolutionSession(next: GameState, warnings: string[]): void {
    const session = get().resolutionSession;
    if (!session) return;
    let finalized = appendCollectedPendingTriggers(session.baseline, next);
    if (
      finalized.phase === 'cleanup'
      && finalized.zones.stack.length === 0
      && readyPendingTriggers(finalized.pendingTriggers).length === 0
      && finalized.pendingRuleChoices.length === 0
    ) {
      const advanced = applyCommand(finalized, { type: 'nextPhase' });
      finalized = appendCollectedPendingTriggers(finalized, advanced.state);
      warnings = [...warnings, ...advanced.warnings];
    }
    if (session.mode !== 'all' || internal.resolutionGroupAnchor === null) {
      internal.past.push(session.baseline);
      if (internal.past.length > HISTORY_LIMIT) internal.past.shift();
    }
    if (session.mode === 'all' && internal.resolutionGroupAnchor === null) {
      internal.resolutionGroupAnchor = session.baseline;
    }
    internal.future = [];
    if (session.mode === 'top') {
      internal.resolutionGroupAnchor = null;
      internal.resolutionGroupPast = null;
      internal.resolutionGroupFuture = null;
    }
    clearPendingInteractionHistory();
    set({
      state: finalized,
      warnings,
      triggerCandidates: triggerCandidatesFromPendingTriggers(finalized.pendingTriggers),
      pendingGuided: null,
      pendingCast: null,
      resolutionSession: null,
      pendingCommanderResolution: null,
      pendingForceActivation: null,
      canUndoInteraction: false,
      canRedoInteraction: false,
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
      reportActionError(err);
    }
  }

  function resolveStackTopCommandForState(cur: GameState, to?: ZoneId): GameCommand {
    const base: GameCommand =
      to === undefined ? { type: 'resolveStackTop' } : { type: 'resolveStackTop', to };
    if (!stackTopHasPureSelfLibraryShuffle(cur)) {
      return base;
    }
    const stackTopId = cur.zones.stack[cur.zones.stack.length - 1];
    const controllerId = stackTopId
      ? (cur.cards[stackTopId]?.controllerId ?? cur.localPlayerId)
      : cur.localPlayerId;
    const rng = createRng(randomSeed());
    return {
      ...base,
      libraryShuffleOrder: shuffledOrder(cur.zonesByPlayer[controllerId].library, rng),
    };
  }



  function continueResolveAll(): void {
    while (true) {
      const cur = get().state;
      if (
        !cur
        || cur.zones.stack.length === 0
        || readyPendingTriggers(cur.pendingTriggers).length > 0
      ) {
        // A ready trigger must be put on the stack before the next lower item
        // can resolve (CR 603.3). Closing the group here preserves the single
        // undo entry already anchored at the start of this resolve-all batch.
        internal.resolutionGroupAnchor = null;
        internal.resolutionGroupPast = null;
        internal.resolutionGroupFuture = null;
        return;
      }
      const topId = cur.zones.stack[cur.zones.stack.length - 1];
      if (isFetchAbilityStackItem(cur, topId)) {
        return;
      }
      requestedResolutionMode = 'all';
      get().resolveTop();
      requestedResolutionMode = 'top';
      const next = get();
      if (next.resolutionSession || next.pendingGuided) return;
      if (next.state === cur) {
        internal.resolutionGroupAnchor = null;
        internal.resolutionGroupPast = null;
        internal.resolutionGroupFuture = null;
        return;
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
    if (get().resolutionSession) {
      set({ warnings: ['手動処理を完了してからゲームを進めてください。'] });
      return;
    }
    if (cur.zones.stack.length > 0) {
      set({ warnings: [STACK_TRANSITION_BLOCKED_WARNING] });
      return;
    }
    if (readyPendingTriggers(cur.pendingTriggers).length > 0) {
      set({ warnings: [TRIGGER_TRANSITION_BLOCKED_WARNING] });
      return;
    }
    if (cur.pendingRuleChoices.length > 0) {
      set({ warnings: [PRIORITY_RULE_CHOICE_PENDING_WARNING] });
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
      reportActionError(err);
    }
  }

  function finishGuidedResolution(pending: PendingGuidedResolution, commands: GameCommand[]): void {
    const cur = get().state;
    if (!cur) return;

    const resolveCommand = resolveStackTopCommandForState(cur, pending.to);
    try {
      const result = applyResolutionCommands(cur, [...commands, resolveCommand]);
      const logged = appendLog(
        result.state,
        `${cardLabel(cur, pending.sourceId)}の効果を誘導実行した。`,
      );
      const warnings = [...(pending.warnings ?? []), ...result.warnings];
      const resolvingAll = pending.resolutionMode === 'all';
      commit(logged, warnings, { groupedHistory: resolvingAll });
      if (resolvingAll) continueResolveAll();
    } catch (err) {
      reportActionError(err);
      discardPendingGuided();
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

    advancePendingGuided(nextPending);
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
        controllerId: cur.cards[pending.sourceId]?.controllerId,
        allowLibrarySearchComposite: false,
      });
      if (compiled.decision === 'auto') {
        commands.push(...compiled.commands);
      } else if (compiled.decision === 'guided') {
        commands.push(...compiled.commands);
        const controllerId = cur.cards[pending.sourceId]?.controllerId ?? 'P1';
        for (const [promptIndex, prompt] of compiled.prompts.entries()) {
          prompts.push(...expandPlayerRecipientPrompt(
            cur,
            pending.sourceId,
            controllerId,
            prompt,
            `guided-${pending.sourceId}-${cur.eventLog.length}-modal-${option.index}-${promptIndex}`,
          ));
        }
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

    const costCheck: PendingActivation = {
      sourceId: pending.sourceId,
      ...(pending.manaAbility.abilityLineIndex === undefined
        ? {}
        : { abilityLineIndex: pending.manaAbility.abilityLineIndex }),
      commands: commands.slice(),
      costComponents: pending.manaAbility.costComponents,
      costPrompts: pending.manaAbility.costPrompts,
      sourceSnapshot: pending.manaAbility.sourceSnapshot,
      targetSelections: [],
      paymentMode: pending.manaAbility.paymentMode,
      manaShortfall: pending.manaAbility.manaShortfall,
      costDecision: 'auto',
      ...(pending.manaAbility.announcedX === undefined
        ? {}
        : { announcedX: pending.manaAbility.announcedX }),
    };
    const preflightWarnings = [
      ...activationCostWarnings(cur, costCheck),
      ...costSubjectWarnings(cur, pending.sourceId, pending.manaAbility),
    ];
    if (
      hasUnpayableCounterRemoval(cur, pending.manaAbility)
      || (
        pending.manaAbility.paymentMode === 'rules-legal'
        && preflightWarnings.length > 0
      )
    ) {
      discardPendingGuided();
      set({ warnings: [...get().warnings, ...preflightWarnings] });
      return;
    }

    try {
      const result = resolveManaAbilityTransaction(cur, {
        sourceId: pending.sourceId,
        ...(pending.manaAbility.abilityLineIndex === undefined
          ? {}
          : { abilityLineIndex: pending.manaAbility.abilityLineIndex }),
        commands,
      });
      const warnings = [...result.warnings, ...preflightWarnings];
      if (pending.manaAbility.manaShortfall > 0) {
        warnings.push(
          `${cardLabel(cur, pending.sourceId)}のマナ能力の起動コストのマナが${pending.manaAbility.manaShortfall}点不足しています。`,
        );
      }
      const next = appendLog(result.state, `${cardLabel(cur, pending.sourceId)}のマナ能力を起動。`);
      commit(next, warnings);
    } catch (err) {
      const message = err instanceof EngineError ? err.message : String(err);
      discardPendingGuided();
      set({ warnings: [...get().warnings, message] });
    }
  }

  function advanceGuidedManaAbility(
    extraCommands: readonly GameCommand[],
    costComponents?: readonly ActivationCostComponent[],
  ): void {
    const pending = get().pendingGuided;
    if (!isManaAbilityPending(pending)) {
      return;
    }

    const commands = [...pending.commands, ...extraCommands];
    const prompts = pending.prompts.slice(1);
    if (prompts.length === 0) {
      finishGuidedManaAbility(
        costComponents
          ? {
              ...pending,
              manaAbility: {
                ...pending.manaAbility,
                costComponents: costComponents.slice(),
              },
            }
          : pending,
        commands,
      );
      return;
    }

    advancePendingGuided({
        ...pending,
        prompts,
        commands,
        ...(costComponents
          ? {
              manaAbility: {
                ...pending.manaAbility,
                costComponents: costComponents.slice(),
              },
            }
          : {}),
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

  function selectedCostSubjectIds(activation: PendingCostState): Set<string> {
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
    sourceId: string,
    pending: PendingCostState,
    prompt: EffectPrompt,
    options: { excludeSelected?: boolean } = {},
  ): string[] {
    const selected =
      options.excludeSelected === false ? new Set<string>() : selectedCostSubjectIds(pending);
    if (prompt.kind === 'cost-discard') {
      const controllerId = pending.sourceSnapshot.controllerId ?? state.localPlayerId;
      return state.zonesByPlayer[controllerId].hand.filter((cardId) => !selected.has(cardId));
    }
    if (prompt.kind === 'cost-sacrifice') {
      return eligibleTargets(
        state,
        prompt.filter ?? { types: ['permanent'], controller: 'you' },
        { sourceId },
      ).filter((cardId) => cardId !== sourceId && !selected.has(cardId));
    }
    if (prompt.kind === 'cost-tap') {
      return eligibleTargets(
        state,
        prompt.filter ?? { types: ['permanent'], controller: 'you' },
        { sourceId },
      ).filter(
        (cardId) =>
          state.cards[cardId]?.tapped !== true &&
          !selected.has(cardId),
      );
    }
    if (
      prompt.kind === 'cost-remove-counter'
      && prompt.counterCost?.interaction === 'source'
    ) {
      const required = prompt.counterCost.amount.value;
      const counterType = prompt.counterCost.counterType;
      return eligibleTargets(
        state,
        prompt.filter ?? { types: ['permanent'], controller: 'you' },
        { sourceId },
      ).filter(
        (cardId) =>
          (state.cards[cardId]?.counters[counterType] ?? 0) >= required
          && !selected.has(cardId),
      );
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

  function hasUnpayableCounterRemoval(
    state: GameState,
    pending: PendingCostState,
  ): boolean {
    const reservations = new Map<string, number>();
    for (const component of pending.costComponents) {
      if (component.kind !== 'remove-counter') continue;
      const amountPrompt = pending.costPrompts.find(
        (entry) =>
          entry.kind === 'cost-remove-counter'
          && entry.counterCost?.interaction === 'amount'
          && costComponentSlotIdForPrompt(entry) === component.slotId,
      );
      if (
        amountPrompt?.counterCost?.interaction === 'amount'
        && amountPrompt.counterCost.amount.max < amountPrompt.counterCost.amount.min
      ) {
        return true;
      }
      if (component.amount === undefined || !component.subjectRef || !component.counterType) {
        continue;
      }
      const { physicalCardId, objectId } = component.subjectRef;
      const snapshot = objectSnapshotForCard(state, physicalCardId);
      const card = state.cards[physicalCardId];
      const key = `${objectId}\u0000${component.counterType}`;
      const reserved = (reservations.get(key) ?? 0) + component.amount;
      reservations.set(key, reserved);
      if (
        !snapshot
        || snapshot.objectId !== objectId
        || card?.zone !== 'battlefield'
        || card.controllerId !== component.payerId
        || (card.counters[component.counterType] ?? 0) < reserved
      ) {
        return true;
      }
    }
    return false;
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
    const counterReservations = new Map<string, number>();
    for (const component of pending.costComponents) {
      const amount = component.amount ?? 0;
      const payerId = component.payerId
        ?? pending.sourceSnapshot.controllerId
        ?? state.localPlayerId;
      const payerLife = payerId === state.localPlayerId
        ? state.life
        : (state.players[payerId]?.life ?? 0);
      const payerHand = state.zonesByPlayer[payerId].hand;
      if (component.kind === 'pay-life' && payerLife < amount) {
        warnings.push(
          `${cardLabel(state, pending.sourceId)}の起動コストのライフが${amount - payerLife}点不足しています。`,
        );
      }
      if (component.kind === 'discard' && payerHand.length < amount) {
        warnings.push(
          `${cardLabel(state, pending.sourceId)}の起動コストで捨てる手札が${amount - payerHand.length}枚不足しています。`,
        );
      }
      if (component.kind === 'sacrifice-object') {
        const prompt = pending.costPrompts.find(
          (entry) =>
            entry.kind === 'cost-sacrifice' &&
            costComponentSlotIdForPrompt(entry) === component.slotId,
        );
        const eligibleCount = prompt
          ? eligibleCostSubjectIds(
              state,
              pending.sourceId,
              pending,
              prompt,
              { excludeSelected: false },
            ).length
          : 0;
        if (eligibleCount < amount) {
          warnings.push(
            `${cardLabel(state, pending.sourceId)}の起動コストで生け贄に捧げるパーマネントが${amount - eligibleCount}体不足しています。`,
          );
        }
      }
      if (component.kind === 'tap-object') {
        const prompt = pending.costPrompts.find(
          (entry) =>
            entry.kind === 'cost-tap'
            && costComponentSlotIdForPrompt(entry) === component.slotId,
        );
        const eligibleCount = prompt
          ? eligibleCostSubjectIds(
              state,
              pending.sourceId,
              pending,
              prompt,
              { excludeSelected: false },
            ).length
          : 0;
        if (eligibleCount < amount) {
          warnings.push(
            `${cardLabel(state, pending.sourceId)}の起動コストでタップするパーマネントが${amount - eligibleCount}体不足しています。`,
          );
        }
      }
      if (component.kind === 'remove-counter') {
        const amountPrompt = pending.costPrompts.find(
          (entry) =>
            entry.kind === 'cost-remove-counter'
            && entry.counterCost?.interaction === 'amount'
            && costComponentSlotIdForPrompt(entry) === component.slotId,
        );
        if (
          amountPrompt?.counterCost?.interaction === 'amount'
          && amountPrompt.counterCost.amount.max < amountPrompt.counterCost.amount.min
        ) {
          warnings.push(
            `${cardLabel(state, pending.sourceId)}の${component.counterType ?? ''}カウンターが不足しています。`,
          );
        }
        if (component.amount === undefined || !component.subjectRef || !component.counterType) {
          continue;
        }
        const subject = component.subjectRef;
        const snapshot = objectSnapshotForCard(state, subject.physicalCardId);
        const key = `${subject.objectId}\u0000${component.counterType}`;
        const reserved = (counterReservations.get(key) ?? 0) + component.amount;
        counterReservations.set(key, reserved);
        const card = state.cards[subject.physicalCardId];
        if (
          !snapshot
          || snapshot.objectId !== subject.objectId
          || card?.zone !== 'battlefield'
          || card.controllerId !== component.payerId
          || (card.counters[component.counterType] ?? 0) < reserved
        ) {
          warnings.push(
            `${cardLabel(state, pending.sourceId)}の${component.counterType}カウンターが不足しています。`,
          );
        }
      }
    }



    return warnings;
  }

  function sorcerySpeedWarning(state: GameState, pending: PendingActivation): string | null {
    const source = state.cards[pending.sourceId];
    if (!source) return null;
    const def = state.defs[source.defId];
    if (!def) return null;
    const lineIndex = pending.abilityLineIndex;
    if (lineIndex === undefined) return null;
    const line = splitAbilityLines(def)[lineIndex];
    if (!line || !/activate (?:this ability )?only as a sorcery/i.test(line.text)) return null;
    const isMainPhase = state.phase === 'main1' || state.phase === 'main2';
    const isYourTurn = state.activePlayerId === state.localPlayerId;
    const stackEmpty = state.zones.stack.length === 0;
    if (isMainPhase && isYourTurn && stackEmpty) return null;
    return `${cardLabel(state, pending.sourceId)}の能力はソーサリーとしてのみ起動できます(あなたのメインフェイズ・スタックが空)。`;
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

  function costSubjectWarnings(
    state: GameState,
    sourceId: string,
    pending: PendingCostState,
  ): string[] {
    const warnings: string[] = [];
    const counterReservations = new Map<string, number>();
    for (const component of pending.costComponents) {
      if (
        component.kind !== 'discard'
        && component.kind !== 'sacrifice-object'
        && component.kind !== 'tap-object'
        && component.kind !== 'remove-counter'
      ) {
        continue;
      }
      const amount = component.amount ?? 0;
      const subjectRefs =
        component.subjectRefs ?? (component.subjectRef ? [component.subjectRef] : []);
      if (component.kind === 'remove-counter') {
        const subjectRef = component.subjectRef;
        const counterType = component.counterType;
        if (!subjectRef || !counterType || component.amount === undefined) {
          warnings.push(`${cardLabel(state, sourceId)}のカウンター除去コストの選択が未完了です。`);
          continue;
        }
        const snapshot = objectSnapshotForCard(state, subjectRef.physicalCardId);
        const card = state.cards[subjectRef.physicalCardId];
        const key = `${subjectRef.objectId}\u0000${counterType}`;
        const reserved = (counterReservations.get(key) ?? 0) + component.amount;
        counterReservations.set(key, reserved);
        if (
          !snapshot
          || snapshot.objectId !== subjectRef.objectId
          || card?.zone !== 'battlefield'
          || card.controllerId !== component.payerId
          || (card.counters[counterType] ?? 0) < reserved
        ) {
          warnings.push(`${cardLabel(state, sourceId)}の${counterType}カウンターが不足しています。`);
        }
        continue;
      }
      if (subjectRefs.length < amount) {
        warnings.push(`${cardLabel(state, sourceId)}の起動コストの選択が未完了です。`);
        continue;
      }
      if (component.kind === 'discard') {
        const payerId = component.payerId
          ?? pending.sourceSnapshot.controllerId
          ?? state.localPlayerId;
        const payerHand = state.zonesByPlayer[payerId].hand;
        const invalid = subjectRefs.some(
          (subjectRef) => !payerHand.includes(subjectRef.physicalCardId),
        );
        if (invalid) {
          warnings.push(`${cardLabel(state, sourceId)}の捨てるカードが現在の手札にありません。`);
        }
        continue;
      }

      const promptKind =
        component.kind === 'tap-object' ? 'cost-tap' : 'cost-sacrifice';
      const prompt = pending.costPrompts.find(
        (entry) =>
          entry.kind === promptKind
          && costComponentSlotIdForPrompt(entry) === component.slotId,
      );
      const eligible = new Set(
        prompt
          ? eligibleCostSubjectIds(
              state,
              sourceId,
              pending,
              prompt,
              { excludeSelected: false },
            )
          : [],
      );
      const invalid = subjectRefs.some((subjectRef) => {
        const snapshot = objectSnapshotForCard(state, subjectRef.physicalCardId);
        return (
          !snapshot
          || snapshot.objectId !== subjectRef.objectId
          || !eligible.has(subjectRef.physicalCardId)
        );
      });
      if (invalid) {
        warnings.push(
          component.kind === 'tap-object'
            ? `${cardLabel(state, sourceId)}のタップコストの選択が現在の候補にありません。`
            : `${cardLabel(state, sourceId)}の生け贄コストの選択が現在の候補にありません。`,
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
      ...costSubjectWarnings(cur, pending.sourceId, pending),
    ];
    const forced = pending.paymentMode === 'forced';
    if (
      hasUnpayableCounterRemoval(cur, pending)
      || (!forced && warnings.length > 0)
    ) {
      discardPendingGuided();
      set({ warnings: [...get().warnings, ...warnings] });
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
      ...(pending.announcedX === undefined ? {} : { announcedX: pending.announcedX }),
    };

    try {
      const result = applyCommands(cur, [...pending.commands, addCmd]);
      // CR 606.3: record loyalty activation in the once-per-turn ledger.
      const hasLoyaltyCost = pending.commands.some(
        (cmd) => cmd.type === 'addCounters' && cmd.counterType === 'loyalty',
      );
      const withLedger = hasLoyaltyCost
        ? {
            ...result.state,
            oncePerTurnTriggerLedger: {
              turn: result.state.turn,
              consumedKeys: [
                ...(result.state.oncePerTurnTriggerLedger?.turn === result.state.turn
                  ? result.state.oncePerTurnTriggerLedger.consumedKeys
                  : []),
                `loyalty-activation:${pending.sourceId}`,
              ],
            },
          }
        : result.state;
      // CR 702.193a: mark power-up ability as activated for this battlefield object.
      const committedSource = withLedger.cards[pending.sourceId];
      const committedDef = committedSource ? withLedger.defs[committedSource.defId] : undefined;
      const committedLine = committedDef && pending.abilityLineIndex !== undefined
        ? splitAbilityLines(committedDef)[pending.abilityLineIndex]
        : undefined;
      const withPowerUp = committedLine?.keywordId === 'power-up' && committedSource
        ? {
            ...withLedger,
            powerUpActivated: {
              ...withLedger.powerUpActivated,
              [objectIdOf(committedSource)]: true as const,
            },
          }
        : withLedger;
      const next =
        pending.costDecision === 'auto'
          ? appendLog(
              withPowerUp,
              forced
                ? `${cardLabel(cur, pending.sourceId)}の能力を強行起動(コスト精算)。`
                : `${cardLabel(cur, pending.sourceId)}の能力を起動(コスト精算)。`,
            )
          : withPowerUp;
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
      discardPendingGuided();
      set({ warnings: [...get().warnings, message] });
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
    const state = get().state;
    if (!state?.players[playerId]) {
      throw new EngineError('対象プレイヤーが現在のゲームに存在しません。');
    }
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

    advancePendingGuided({
        ...pendingGuided,
        prompts,
        activation: {
          ...activation,
          targetSelections,
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

    advancePendingGuided({
        ...pendingGuided,
        prompts,
        activation,
    });
  }

  return {
    state: null,
    warnings: [],
    triggerCandidates: [],
    pendingGuided: null,
    pendingCast: null,
    resolutionSession: null,
    pendingCommanderResolution: null,
    pendingForceActivation: null,
    canUndo: false,
    canRedo: false,
    canUndoInteraction: false,
    canRedoInteraction: false,
    autoAdvanceToMain: true,
    mulliganDecisionPending: false,

    newGame(cards, seed) {
      const usedSeed = seed ?? randomSeed();
      internal.deck = cards;
      internal.lastSeed = usedSeed;
      internal.past = [];
      internal.future = [];
      clearPendingInteractionHistory();
      discardPendingCommanderResolution();

      const base = initGame(cards, usedSeed);
      // Build the initial board state as a single non-undoable setup step.
      const openingHand = applyCommand(base, { type: 'draw', count: 7 });
      set({
        state: openingHand.state,
        warnings: openingHand.warnings,
        triggerCandidates: [],
        pendingGuided: null,
        pendingCast: null,
        resolutionSession: null,
        canUndoInteraction: false,
        canRedoInteraction: false,
        pendingCommanderResolution: null,
        // ACT-2: 新しいゲームへ残留した強行ダイアログを持ち越さない。
        pendingForceActivation: null,
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
      clearPendingInteractionHistory();
      discardPendingCommanderResolution();
      set({
        state: normalizeSnapshotState(snapshot.state),
        warnings: [],
        triggerCandidates: [],
        pendingGuided: null,
        pendingCast: null,
        resolutionSession: null,
        canUndoInteraction: false,
        canRedoInteraction: false,
        pendingCommanderResolution: null,
        pendingForceActivation: null,
        canUndo: false,
        canRedo: false,
        autoAdvanceToMain: snapshot.autoAdvanceToMain,
        mulliganDecisionPending: false,
      });
    },

    takeSnapshot() {
      const s = get().state;
      if (!s) {
        throw new EngineError('ゲームが開始されていません。');
      }
      return {
        version: SNAPSHOT_VERSION,
        state: JSON.parse(JSON.stringify(s)) as GameState,
        deck: internal.deck ?? [],
        autoAdvanceToMain: get().autoAdvanceToMain,
      };
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
        reportActionError(err);
      }
    },

    beginFirstTurn() {
      const cur = get().state;
      if (!cur || !get().autoAdvanceToMain) return;

      try {
        const result = applyCommands(cur, untapToMainCommands());
        internal.past = [];
        internal.future = [];
        clearPendingInteractionHistory();
        set({
          state: result.state,
          warnings: result.warnings,
          triggerCandidates: [],
          pendingGuided: null,
          canUndoInteraction: false,
          canRedoInteraction: false,
          pendingForceActivation: null,
          canUndo: false,
          canRedo: false,
        });
      } catch (err) {
        reportActionError(err);
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
        reportActionError(err);
      }
    },

    applyOpponentSetup(draft) {
      return get().applyOpponentSetups([draft]);
    },

    applyOpponentSetups(drafts) {
      const cur = get().state;
      if (!cur) return false;
      try {
        const byPlayer = new Map<PlayerId, OpponentSetupDraft>();
        for (const draft of drafts) {
          if (byPlayer.has(draft.playerId)) {
            throw new EngineError(`同じプレイヤーのセットアップが重複しています: ${draft.playerId}`);
          }
          byPlayer.set(draft.playerId, draft);
        }
        const orderedDrafts = cur.turnOrder.flatMap((playerId) => {
          const draft = byPlayer.get(playerId);
          return draft ? [draft] : [];
        });
        if (orderedDrafts.length !== drafts.length) {
          throw new EngineError('参加していないプレイヤーのセットアップは反映できません。');
        }

        let working = cur;
        const warnings: string[] = [];
        let commandCount = 0;
        for (const draft of orderedDrafts) {
          const commands = compileOpponentSetupCommands(working, draft);
          commandCount += commands.length;
          if (commands.length === 0) continue;
          const result = applyCommands(working, commands);
          working = result.state;
          warnings.push(...result.warnings);
        }
        if (commandCount === 0) return true;
        commit(working, warnings);
        return true;
      } catch (err) {
        const message = err instanceof EngineError ? err.message : String(err);
        set({ warnings: [...get().warnings, message] });
        return false;
      }
    },

    dispatch,

    undo() {
      if (get().pendingCast) {
        set({ pendingCast: null, canUndoInteraction: false, canRedoInteraction: false });
        return;
      }
      const resolutionSession = get().resolutionSession;
      const resolutionState = get().state;
      if (resolutionSession && resolutionState) {
        const previous = resolutionSession.stepPast.at(-1);
        if (!previous) {
          abortManualResolutionSession(resolutionSession);
          return;
        }
        set({
          state: previous,
          triggerCandidates: [],
          resolutionSession: {
            ...resolutionSession,
            stepPast: resolutionSession.stepPast.slice(0, -1),
            stepFuture: [...resolutionSession.stepFuture, resolutionState].slice(-HISTORY_LIMIT),
          },
          // Even after the final local step is undone, one more Undo remains:
          // aborting the unfinished resolution session itself.
          canUndoInteraction: true,
          canRedoInteraction: true,
          canRedo: false,
        });
        return;
      }
      if (get().pendingCommanderResolution) {
        discardPendingCommanderResolution();
        set({ pendingCommanderResolution: null });
        return;
      }
      discardPendingCommanderResolution();
      const pending = get().pendingGuided;
      if (pending) {
        internal.pendingFuture.push(pending);
        if (internal.pendingFuture.length > HISTORY_LIMIT) internal.pendingFuture.shift();
        const previous = internal.pendingPast.pop() ?? null;
        set({
          pendingGuided: previous,
          canUndoInteraction: previous !== null,
          canRedoInteraction: true,
        });
        return;
      }
      const cur = get().state;
      if (internal.past.length === 0 || !cur) return;
      clearPendingInteractionHistory();
      const prev = clearPendingTriggers(internal.past.pop() as GameState);
      internal.future.push(clearPendingTriggers(cur));
      if (internal.future.length > HISTORY_LIMIT) {
        internal.future.shift();
      }
      set({
        state: prev,
        triggerCandidates: [],
        pendingGuided: null,
        canUndoInteraction: false,
        canRedoInteraction: false,
        pendingCommanderResolution: null,
        pendingForceActivation: null,
        canUndo: internal.past.length > 0,
        canRedo: internal.future.length > 0,
      });
    },

    redo() {
      const resolutionSession = get().resolutionSession;
      const resolutionState = get().state;
      if (resolutionSession && resolutionState) {
        const next = resolutionSession.stepFuture.at(-1);
        if (!next) return;
        set({
          state: next,
          triggerCandidates: [],
          resolutionSession: {
            ...resolutionSession,
            stepPast: [...resolutionSession.stepPast, resolutionState].slice(-HISTORY_LIMIT),
            stepFuture: resolutionSession.stepFuture.slice(0, -1),
          },
          canUndoInteraction: true,
          canRedoInteraction: resolutionSession.stepFuture.length > 1,
          canRedo: false,
        });
        return;
      }
      discardPendingCommanderResolution();
      const pendingInteraction = internal.pendingFuture.pop();
      if (pendingInteraction) {
        const current = get().pendingGuided;
        if (current) internal.pendingPast.push(current);
        set({
          pendingGuided: pendingInteraction,
          canUndoInteraction: true,
          canRedoInteraction: internal.pendingFuture.length > 0,
        });
        return;
      }
      const cur = get().state;
      if (internal.future.length === 0 || !cur) return;
      clearPendingInteractionHistory();
      const next = clearPendingTriggers(internal.future.pop() as GameState);
      internal.past.push(clearPendingTriggers(cur));
      if (internal.past.length > HISTORY_LIMIT) {
        internal.past.shift();
      }
      set({
        state: next,
        triggerCandidates: [],
        pendingGuided: null,
        canUndoInteraction: false,
        canRedoInteraction: false,
        pendingCommanderResolution: null,
        pendingForceActivation: null,
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
          reportActionError(err);
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
        reportActionError(err);
      }
    },

    consumeLinkedExileForSource(linkId, sourcePhysicalId) {
      const cur = get().state;
      if (!cur) return;
      try {
        const result = consumeLinkedExileForSourceInState(cur, linkId, sourcePhysicalId);
        commit(result.state, result.warnings);
      } catch (err) {
        reportActionError(err);
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
        reportActionError(err);
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
        reportActionError(err);
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
        reportActionError(err);
      }
    },

    tapForMana(cardId, color) {
      const cur = get().state;
      if (!cur) return 'ok';
      const card = cur.cards[cardId];
      if (!card) return 'ok';
      const def = cur.defs[card.defId];

      // single committed step: tap + add mana. Apply sequentially on a state
      // and commit once so undo reverts both.
      const commitTapAndAdd = (chosen: ManaColor): void => {
        try {
          const amount = Math.max(1, manaProductionAmount(def, chosen));
          const result = resolveManaAbilityTransaction(cur, {
            sourceId: cardId,
            commands: [
              { type: 'setTapped', cardId, tapped: true },
              {
                type: 'addMana',
                color: chosen,
                amount,
                ...(card.controllerId !== cur.localPlayerId
                  ? { playerId: card.controllerId }
                  : {}),
              },
            ],
          });
          commit(result.state, [...result.warnings, ...warningForSummoningSickness(cur, cardId)]);
        } catch (err) {
          reportActionError(err);
        }
      };

      if (!hasActivatedAddManaLine(def)) {
        const produced = def?.producedMana ?? [];
        if (produced.length === 0) {
          // nothing to add; just tap
          dispatch({ type: 'setTapped', cardId, tapped: true });
          return 'ok';
        }
        if (produced.length === 1) {
          commitTapAndAdd(produced[0]);
          return 'ok';
        }
        if (color && produced.includes(color)) {
          commitTapAndAdd(color);
          return 'ok';
        }
        return 'needs-choice';
      }

      // CR118.3/602.2: a costed activated mana ability (sacrifice, additional mana, ...) may
      // not be naively tapped+added — route through activateAbility so the cost is paid.
      const naive = naiveTapManaColors(def);
      if (naive.length === 0) {
        get().activateAbility(cardId);
        return 'ok';
      }
      if (color) {
        if (!naive.includes(color)) {
          get().activateAbility(cardId);
          return 'ok';
        }
        commitTapAndAdd(color);
        return 'ok';
      }
      if (naive.length === 1) {
        commitTapAndAdd(naive[0]);
        return 'ok';
      }
      return 'needs-choice';
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
        reportActionError(err);
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
        reportActionError(err);
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
        reportActionError(err);
      }
    },

    castFromHand(cardId, opts) {
      const cur = get().state;
      if (!cur) return 'ok';
      const card = cur.cards[cardId];
      if (!card) return 'ok';
      const def = cur.defs[card.defId];
      const faceIndex = opts?.faceIndex ?? card.faceIndex;
      const face = def?.faces[faceIndex] ?? def?.faces[0];
      const cost = parseManaCost(face?.manaCost ?? '');
      const xValue = opts?.xValue ?? 0;
      const sol = solvePayment(cur.manaPool, cost, xValue);
      if (sol.ok) {
        dispatch({
          type: 'castSpell',
          cardId,
          payment: sol.payment,
          forced: false,
          faceIndex,
        });
        return 'ok';
      }

      const plan = planAutoManaPayment(cur, cost, xValue);
      if (!plan.ok && !opts?.force) {
        return { shortfall: plan.shortfall };
      }

      try {
        const result = applyAutoManaPaymentAndCommands(cur, plan, [
          {
            type: 'castSpell',
            cardId,
            payment: plan.payment,
            forced: !plan.ok,
            faceIndex,
          },
        ]);
        commit(result.state, result.warnings);
      } catch (err) {
        // 例外時は state 不変。'ok' を返すと呼び出し側が成功と誤認するため
        // 'error' で区別する(理由は reportActionError が warnings へ可視化済み)。
        reportActionError(err);
        return 'error';
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
      const faceIndex = opts?.faceIndex ?? card.faceIndex;
      const face = def?.faces[faceIndex] ?? def?.faces[0];
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
          faceIndex,
        });
        return 'ok';
      }

      const plan = planAutoManaPayment(cur, taxedCost, xValue);
      if (!plan.ok && !opts?.force) {
        return { shortfall: plan.shortfall };
      }

      try {
        const result = applyAutoManaPaymentAndCommands(cur, plan, [
          {
            type: 'castCommander',
            cardId,
            payment: plan.payment,
            forced: !plan.ok,
            faceIndex,
          },
        ]);
        commit(result.state, result.warnings);
      } catch (err) {
        // 例外時は state 不変。'ok' を返すと呼び出し側が成功と誤認するため
        // 'error' で区別する(理由は reportActionError が warnings へ可視化済み)。
        reportActionError(err);
        return 'error';
      }
      return 'ok';
    },

    castToStack(cardId, opts) {
      const cur = get().state;
      if (!cur) return 'ok';
      if (get().resolutionSession) {
        set({ warnings: ['手動処理を完了してから、この操作を行ってください。'] });
        return 'error';
      }
      const card = cur.cards[cardId];
      if (!card) return 'ok';

      const def = cur.defs[card.defId];
      const faceIndex = opts?.faceIndex ?? card.faceIndex;
      const face = def?.faces[faceIndex] ?? def?.faces[0];
      const cost = parseManaCost(face?.manaCost ?? '');
      const isCommandCommander = card.zone === 'command' && isCommander(cur, cardId);
      const taxedCost = isCommandCommander
        ? { ...cost, generic: cost.generic + commanderTax(cur, cardId) }
        : cost;
      const xValue = opts?.xValue ?? 0;
      const directPayment = solvePayment(cur.manaPool, taxedCost, xValue);
      const counterPlan = counterCastPlanForCard(cur, cardId, faceIndex);
      const teamworkThreshold = parseTeamworkThreshold(face?.oracleText ?? '');
      const teamworkPrompt: EffectPrompt | null = teamworkThreshold !== null
        ? {
            atom: null,
            kind: 'cost-tap',
            count: 0,
            raw: `チームワーク — 合計パワー${teamworkThreshold}以上のクリーチャーをタップしてもよい`,
          }
        : null;

      if (directPayment.ok) {
        if (teamworkPrompt || counterPlan) {
          set({
            pendingCast: {
              cardId,
              faceIndex,
              xValue,
              forced: false,
              payment: directPayment.payment,
              prompts: [
                ...(teamworkPrompt ? [teamworkPrompt] : []),
                ...(counterPlan ? [counterPlan.prompt] : []),
              ],
              targetSelections: [],
              warnings: counterPlan?.warnings ?? [],
              ...(teamworkThreshold !== null ? { teamworkThreshold } : {}),
            },
            canUndoInteraction: true,
            canRedoInteraction: false,
          });
          return 'needs-choice';
        }
        dispatch({
          type: 'castToStack',
          cardId,
          payment: directPayment.payment,
          forced: false,
          faceIndex,
          xValue: cost.x > 0 ? xValue : undefined,
        });
        return 'ok';
      }

      const plan = planAutoManaPayment(cur, taxedCost, xValue);
      if (!plan.ok && !opts?.force) {
        return { shortfall: plan.shortfall };
      }

      if (teamworkPrompt || counterPlan) {
        set({
          pendingCast: {
            cardId,
            faceIndex,
            xValue,
            forced: !plan.ok,
            payment: plan.payment,
            prompts: [
              ...(teamworkPrompt ? [teamworkPrompt] : []),
              ...(counterPlan ? [counterPlan.prompt] : []),
            ],
            targetSelections: [],
            warnings: counterPlan?.warnings ?? [],
            autoTapPlan: plan,
            ...(teamworkThreshold !== null ? { teamworkThreshold } : {}),
          },
          canUndoInteraction: true,
          canRedoInteraction: false,
        });
        return 'needs-choice';
      }

      try {
        const result = applyAutoManaPaymentAndCommands(cur, plan, [
          {
            type: 'castToStack',
            cardId,
            payment: plan.payment,
            forced: !plan.ok,
            faceIndex,
            xValue: cost.x > 0 ? xValue : undefined,
          },
        ]);
        commit(result.state, result.warnings);
      } catch (err) {
        // 例外時は state 不変。'ok' を返すと呼び出し側が成功と誤認するため
        // 'error' で区別する(理由は reportActionError が warnings へ可視化済み)。
        reportActionError(err);
        return 'error';
      }

      return 'ok';
    },

    answerPendingCastTarget(cardId) {
      const cur = get().state;
      const pending = get().pendingCast;
      const prompt = pending?.prompts[0];
      if (!cur || !pending || prompt?.kind !== 'target') return;
      if (!eligibleTargets(cur, prompt.filter ?? {}, { sourceId: pending.cardId }).includes(cardId)) {
        set({ warnings: [...get().warnings, `${cardLabel(cur, cardId)}は対象候補にありません。`] });
        return;
      }
      const selection = targetSelectionForCard(
        cur,
        prompt,
        cardId,
        false,
        pending.targetSelections.length,
        pending.cardId,
      );
      if (!selection || selection.legalityMode !== 'checked') return;
      set({
        pendingCast: {
          ...pending,
          prompts: pending.prompts.slice(1),
          targetSelections: [...pending.targetSelections, selection],
        },
      });
    },

    answerPendingCastTeamwork(cardIds) {
      const cur = get().state;
      const pending = get().pendingCast;
      const prompt = pending?.prompts[0];
      if (!cur || !pending || prompt?.kind !== 'cost-tap') return;
      const threshold = pending.teamworkThreshold ?? 0;

      // Empty selection = decline teamwork (always legal).
      if (cardIds.length === 0) {
        set({
          pendingCast: {
            ...pending,
            teamworkTappedIds: [],
            prompts: pending.prompts.slice(1),
          },
        });
        return;
      }

      // Validate each selected card.
      const warnings: string[] = [];
      let totalPower = 0;
      for (const id of cardIds) {
        const card = cur.cards[id];
        if (!card || card.zone !== 'battlefield') {
          warnings.push(`${id}は戦場にありません。`);
          continue;
        }
        if (card.controllerId !== cur.localPlayerId) {
          warnings.push(`${id}はあなたがコントロールしていません。`);
          continue;
        }
        if (card.tapped) {
          warnings.push(`${id}は既にタップされています。`);
          continue;
        }
        const def = cur.defs[card.defId];
        const face = def?.faces[card.faceIndex] ?? def?.faces[0];
        if (!face?.typeLine?.includes('Creature')) {
          warnings.push(`${id}はクリーチャーではありません。`);
          continue;
        }
        totalPower += effectivePower(cur, id);
      }

      if (warnings.length > 0) {
        set({ warnings: [...get().warnings, ...warnings] });
        return;
      }

      if (totalPower < threshold) {
        set({
          warnings: [
            ...get().warnings,
            `合計パワー${totalPower}はチームワークの閾値${threshold}未満です。`,
          ],
        });
        return;
      }

      set({
        pendingCast: {
          ...pending,
          teamworkTappedIds: cardIds,
          prompts: pending.prompts.slice(1),
        },
      });
    },

    confirmPendingCast() {
      const cur = get().state;
      const pending = get().pendingCast;
      if (!cur || !pending || pending.prompts.length > 0) return;
      const command: GameCommand = {
        type: 'castToStack',
        cardId: pending.cardId,
        payment: pending.payment,
        forced: pending.forced,
        faceIndex: pending.faceIndex,
        ...(parseManaCost(
          cur.defs[cur.cards[pending.cardId]?.defId ?? '']?.faces[pending.faceIndex]?.manaCost ?? '',
        ).x > 0 ? { xValue: pending.xValue } : {}),
        targetSelections: pending.targetSelections.map((selection) => ({ ...selection })),
        ...(pending.teamworkTappedIds && pending.teamworkTappedIds.length > 0
          ? { teamworkTappedIds: pending.teamworkTappedIds }
          : {}),
      };
      try {
        const result = pending.autoTapPlan
          ? applyAutoManaPaymentAndCommands(cur, pending.autoTapPlan, [command])
          : applyCommand(cur, command);
        commit(result.state, result.warnings);
      } catch (err) {
        reportActionError(err);
      }
    },

    cancelPendingCast() {
      set({ pendingCast: null, canUndoInteraction: false, canRedoInteraction: false });
    },

    addAbilityToStack(sourceId, kind, abilityLineIndex) {
      if (get().resolutionSession) {
        set({ warnings: ['手動処理を完了してから、この操作を行ってください。'] });
        return;
      }
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
        reportActionError(err);
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
        reportActionError(err);
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
      if (get().resolutionSession) {
        set({ warnings: ['手動処理を完了してから、能力を起動してください。'] });
        return;
      }
      const cur = get().state;
      if (!cur) return;

      const resolvedAbilityLineIndex =
        abilityLineIndex ?? abilityLineIndexForKind(cur, sourceId, 'activated');
      const source = cur.cards[sourceId];
      const def = source ? cur.defs[source.defId] : undefined;
      const abilityLine = resolvedAbilityLineIndex === undefined || !def
        ? undefined
        : splitAbilityLines(def)[resolvedAbilityLineIndex];
      const costText = abilityLine?.text.split(':', 1)[0] ?? '';
      const costHasX = /\{X\}|\bX\b/i.test(costText);
      let announcedX: number | undefined;
      if (costHasX) {
        const requestedX = opts?.xValue;
        const minimum = /\bX can['’]t be 0\b|\bX cannot be 0\b/i.test(abilityLine?.text ?? '') ? 1 : 0;
        if (requestedX === undefined || !Number.isInteger(requestedX) || requestedX < minimum) {
          set({
            warnings: [
              ...get().warnings,
              `${cardLabel(cur, sourceId)}のXには${minimum}以上の整数を指定してください。`,
            ],
            pendingGuided: null,
          });
          return;
        }
        announcedX = requestedX;
      }
      const manaAbilityPlan = activatedManaAbilityPlanForSource(
        cur,
        sourceId,
        resolvedAbilityLineIndex,
        announcedX,
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
              // ACT-2: 強行可能なブロック点。UI が強行ダイアログを提示できるよう対象の
              // 行つきで pending を持つ(サンドボックス哲学=禁止せず確認する)。
              pendingForceActivation: {
                sourceId,
                ...(resolvedAbilityLineIndex === undefined
                  ? {}
                  : { abilityLineIndex: resolvedAbilityLineIndex }),
                ...(opts?.assistRestrictedMana ? { assistRestrictedMana: true } : {}),
                warnings: [`${cardLabel(cur, sourceId)}はすでにタップされているため{T}コストを支払えません。`],
              },
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
        const manaAbilityControllerId = cur.cards[sourceId]?.controllerId ?? cur.localPlayerId;
        const manaAbilityControllerLife = manaAbilityControllerId === cur.localPlayerId
          ? cur.life
          : (cur.players[manaAbilityControllerId]?.life ?? 0);
        if (manaAbilityPlan.lifeCost > manaAbilityControllerLife) {
          if (!opts?.force) {
            const shortfallWarning = `${cardLabel(cur, sourceId)}のマナ能力のライフコストが${manaAbilityPlan.lifeCost - manaAbilityControllerLife}点不足しています。`;
            set({
              warnings: [...get().warnings, shortfallWarning],
              pendingGuided: null,
              // ACT-2: 強行可能なブロック点(ライフコスト不足)。
              pendingForceActivation: {
                sourceId,
                ...(resolvedAbilityLineIndex === undefined
                  ? {}
                  : { abilityLineIndex: resolvedAbilityLineIndex }),
                ...(opts?.assistRestrictedMana ? { assistRestrictedMana: true } : {}),
                warnings: [shortfallWarning],
              },
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
        const manaSourceSnapshot = objectSnapshotForCard(cur, sourceId);
        if (!manaSourceSnapshot) {
          set({
            warnings: [...get().warnings, `能力の発生源が存在しません: ${sourceId}`],
            pendingGuided: null,
          });
          return;
        }
        const paymentMode: ActivationPaymentMode =
          opts?.force === true ? 'forced' : 'rules-legal';
        const costCheck: PendingActivation = {
          sourceId,
          ...(resolvedAbilityLineIndex === undefined
            ? {}
            : { abilityLineIndex: resolvedAbilityLineIndex }),
          commands: manaAbilityPlan.commands,
          costComponents: manaAbilityPlan.costComponents,
          costPrompts: manaAbilityPlan.costPrompts,
          sourceSnapshot: manaSourceSnapshot,
          targetSelections: [],
          paymentMode,
          manaShortfall: manaAbilityPlan.manaShortfall,
          costDecision: 'auto',
          ...(announcedX === undefined ? {} : { announcedX }),
        };
        const costWarnings = activationCostWarnings(cur, costCheck);
        const hardCounterFailure = hasUnpayableCounterRemoval(cur, costCheck);
        if (
          hardCounterFailure
          || (paymentMode === 'rules-legal' && costWarnings.length > 0)
        ) {
          set({
            warnings: [...get().warnings, ...costWarnings],
            pendingGuided: null,
            pendingForceActivation: hardCounterFailure
              ? null
              : {
                  sourceId,
                  ...(resolvedAbilityLineIndex === undefined
                    ? {}
                    : { abilityLineIndex: resolvedAbilityLineIndex }),
                  ...(announcedX === undefined ? {} : { xValue: announcedX }),
                  warnings: costWarnings,
                },
          });
          return;
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
        if (manaAbilityPlan.decision === 'assisted' && !opts?.assistRestrictedMana) {
          set({
            warnings: [
              ...get().warnings,
              `${cardLabel(cur, sourceId)}の用途制限付きマナ能力は手動で反映してください。`,
            ],
          });
          return;
        }
        if (manaAbilityPlan.decision === 'guided') {
          startPendingGuided({
              mode: 'mana-ability',
              sourceId,
              prompts: manaAbilityPlan.prompts,
              commands: manaAbilityPlan.commands,
              manaAbility: {
                ...(resolvedAbilityLineIndex === undefined
                  ? {}
                  : { abilityLineIndex: resolvedAbilityLineIndex }),
                manaShortfall: manaAbilityPlan.manaShortfall,
                sourceSnapshot: manaSourceSnapshot,
                costComponents: manaAbilityPlan.costComponents,
                costPrompts: manaAbilityPlan.costPrompts,
                paymentMode,
                ...(announcedX === undefined ? {} : { announcedX }),
              },
          });
          set({
            // ACT-2: この起動は成功経路(guided)に入った。誤ダイアログを残さない。
            pendingForceActivation: null,
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
          if (manaAbilityPlan.decision === 'assisted' && manaAbilityPlan.restrictionText) {
            const activationOnly = /\bonly to activate abilities\b/i.test(manaAbilityPlan.restrictionText);
            warnings.push(
              activationOnly
                ? `${cardLabel(cur, sourceId)}が生成したマナは能力の起動にのみ使用できます。用途制限は手動で管理してください。`
                : `${cardLabel(cur, sourceId)}が生成したマナには用途制限があります。使用先は手動で確認してください。`,
            );
          }
          if (manaAbilityPlan.manaShortfall > 0) {
            warnings.push(
              `${cardLabel(cur, sourceId)}のマナ能力の起動コストのマナが${manaAbilityPlan.manaShortfall}点不足しています。`,
            );
          }
          const next = appendLog(result.state, `${cardLabel(cur, sourceId)}のマナ能力を起動。`);
          commit(next, warnings);
        } catch (err) {
          reportActionError(err);
        }
        return;
      }

      const plan = activationPlanForSource(cur, sourceId, resolvedAbilityLineIndex, announcedX);
      const sourceSnapshot = objectSnapshotForCard(cur, sourceId);
      if (!sourceSnapshot) {
        set({ warnings: [...get().warnings, `能力の発生源が存在しません: ${sourceId}`] });
        return;
      }

      // CR 606.6: loyalty ability with negative cost requires sufficient loyalty counters.
      const loyaltyCostCmd = plan?.commands.find(
        (cmd): cmd is Extract<GameCommand, { type: 'addCounters' }> =>
          cmd.type === 'addCounters' && cmd.counterType === 'loyalty',
      );
      if (loyaltyCostCmd && loyaltyCostCmd.delta < 0 && !opts?.force) {
        const currentLoyalty = source?.counters.loyalty ?? 0;
        if (currentLoyalty < Math.abs(loyaltyCostCmd.delta)) {
          set({
            warnings: [
              ...get().warnings,
              `${cardLabel(cur, sourceId)}の忠誠度が${Math.abs(loyaltyCostCmd.delta)}に足りません(現在${currentLoyalty})。`,
            ],
            pendingGuided: null,
          });
          return;
        }
      }

      // CR 606.3: only one loyalty ability per permanent per turn.
      const loyaltyLedger = cur.oncePerTurnTriggerLedger;
      const loyaltyActivationKey = `loyalty-activation:${sourceId}`;
      if (
        loyaltyCostCmd
        && loyaltyLedger
        && loyaltyLedger.turn === cur.turn
        && loyaltyLedger.consumedKeys.includes(loyaltyActivationKey)
        && !opts?.force
      ) {
        set({
          warnings: [
            ...get().warnings,
            `${cardLabel(cur, sourceId)}の忠誠度能力はこのターンにすでに起動されています(CR 606.3)。`,
          ],
          pendingGuided: null,
        });
        return;
      }

      // CR 702.193a: Power-up abilities can only be activated once per battlefield object.
      if (abilityLine?.keywordId === 'power-up' && source && !opts?.force) {
        const objId = objectIdOf(source);
        if (cur.powerUpActivated[objId]) {
          set({
            warnings: [
              ...get().warnings,
              `${cardLabel(cur, sourceId)}のパワーアップ能力はすでに起動済みです（1回のみ）。`,
            ],
            pendingGuided: null,
          });
          return;
        }
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
        ...(announcedX === undefined ? {} : { announcedX }),
      };

      const targetPrompts = activationTargetPromptsForSource(
        cur,
        sourceId,
        resolvedAbilityLineIndex,
      );
      const costWarnings = activationCostWarnings(cur, pendingActivation);
      const timingWarning = sorcerySpeedWarning(cur, pendingActivation);
      const hardCounterFailure = hasUnpayableCounterRemoval(cur, pendingActivation);
      if (
        hardCounterFailure
        || (paymentMode === 'rules-legal' && costWarnings.length > 0)
      ) {
        set({
          warnings: [...get().warnings, ...costWarnings],
          pendingGuided: null,
          // ACT-2: 強行可能なブロック点(一般経路の起動コスト不足・CR118.3)。UI が
          // 強行ダイアログを提示できるよう対象の行つきで pending を持つ。
          pendingForceActivation: hardCounterFailure
            ? null
            : {
                sourceId,
                ...(resolvedAbilityLineIndex === undefined
                  ? {}
                  : { abilityLineIndex: resolvedAbilityLineIndex }),
                ...(opts?.assistRestrictedMana ? { assistRestrictedMana: true } : {}),
                ...(announcedX === undefined ? {} : { xValue: announcedX }),
                warnings: costWarnings,
              },
        });
        return;
      }
      if (timingWarning && paymentMode === 'rules-legal') {
        set({ warnings: [...get().warnings, timingWarning] });
      }
      if (paymentMode === 'forced' && costWarnings.length > 0) {
        // Mirrors the mana-ability sandbox escape idiom above: forced activation must
        // record the CR-legal disclaimer immediately, since a targeted ability defers
        // the actual commit to the guided target picker (below) and would otherwise
        // leave no trace of the sandbox escape until that picker resolves.
        set({
          warnings: [
            ...get().warnings,
            `${cardLabel(cur, sourceId)}の起動コストは支払えないため、この起動をCR-legalとして扱いません(強行)。`,
          ],
        });
      }

      // Targets are chosen as the ability is activated (CR 115.1c/602.2b), regardless of
      // paymentMode: the `forced` sandbox escape bypasses unpayable COSTS, not target choice.
      // So a targeted ability always routes through the target picker before commit.
      const activationPrompts = [...targetPrompts, ...pendingActivation.costPrompts];
      if (activationPrompts.length > 0) {
        startPendingGuided({
            mode: 'activation',
            sourceId,
            prompts: activationPrompts,
            commands: [],
            activation: pendingActivation,
        });
        set({
          // ACT-2: この起動は成功経路(guided target選択)に入った。誤ダイアログを残さない。
          pendingForceActivation: null,
        });
        return;
      }

      commitActivation(pendingActivation, [], []);
    },

    confirmForceActivation() {
      const pending = get().pendingForceActivation;
      if (!pending) return;
      set({ pendingForceActivation: null });
      get().activateAbility(pending.sourceId, pending.abilityLineIndex, {
        force: true,
        ...(pending.assistRestrictedMana ? { assistRestrictedMana: true } : {}),
        ...(pending.xValue === undefined ? {} : { xValue: pending.xValue }),
      });
    },

    cancelForceActivation() {
      // 盤面は変えない。ダイアログを解くだけ(サンドボックス哲学=強行しないことも自由)。
      set({ pendingForceActivation: null });
    },

    dismissTriggerCandidates() {
      const cur = get().state;
      set({
        state: cur ? clearPendingTriggers(cur) : cur,
        triggerCandidates: [],
      });
    },

    copyStackItem(cardId, quantity = 1) {
      const cur = get().state;
      if (!cur) return;
      if (get().resolutionSession) {
        set({ warnings: ['手動処理を完了してから、この操作を行ってください。'] });
        return;
      }
      try {
        const result = applyCommand(cur, { type: 'copyStackItem', cardId, quantity });
        const noOp = result.state.zones.stack.length === cur.zones.stack.length
          && result.state.log.length === cur.log.length;
        if (noOp) {
          set({ warnings: result.warnings });
          return;
        }
        commit(result.state, result.warnings);
      } catch (err) {
        reportActionError(err);
      }
    },

    copyPermanent(cardId, quantity = 1) {
      dispatch({ type: 'copyPermanent', cardId, quantity });
    },

    resolveTop(to) {
      const cur = get().state;
      if (!cur || get().resolutionSession) return;
      const resolutionMode = requestedResolutionMode;
      const topId = cur.zones.stack.at(-1);
      if (!topId) return;
      const topCard = cur.cards[topId];
      const counterPlan = counterCastPlanForCard(cur, topId, topCard?.faceIndex);
      const storedCounterTarget = topCard?.targetSelections?.find(
        (selection) => selection.slotId === counterPlan?.prompt.slotId,
      );
      if (counterPlan && storedCounterTarget) {
        if (
          storedCounterTarget.legalityMode !== 'checked'
          || storedCounterTarget.selection.kind !== 'object'
        ) {
          startManualResolutionSession(
            cur,
            cur,
            topId,
            'unsupported',
            `${cardLabel(cur, topId)}の対象は未検証です。効果を手動で処理してください。`,
            resolutionMode,
          );
          return;
        }
        const targetId = storedCounterTarget.selection.physicalCardId;
        const currentTarget = cur.cards[targetId];
        const legal = currentTarget
          && objectSnapshotForCard(cur, targetId)?.objectId === storedCounterTarget.selection.objectId
          && eligibleTargets(cur, counterPlan.prompt.filter ?? {}, { sourceId: topId }).includes(targetId);
        if (!legal) {
          try {
            const result = applyCommand(cur, resolveStackTopCommandForState(cur, to));
            const logged = appendLog(
              result.state,
              `${cardLabel(cur, topId)}は対象不適正で不発になりました。`,
            );
            commit(logged, [], { groupedHistory: resolutionMode === 'all' });
          } catch {
            startManualResolutionSession(
              cur,
              cur,
              topId,
              'runtime-failure',
              `${cardLabel(cur, topId)}を自動処理できませんでした。手動で処理してください。`,
              resolutionMode,
            );
          }
          return;
        }
        if (counterPlan.partial) {
          const def = topCard ? cur.defs[topCard.defId] : undefined;
          if (!def) return;
          try {
            const commands = buildGuidedCommands(
              counterPlan.prompt,
              {
                kind: 'target',
                cardIds: [targetId],
                targetSnapshots: [storedCounterTarget.selection.snapshot],
              },
              {
                sourceId: topId,
                controllerId: topCard?.controllerId,
                def,
              },
            );
            const result = applyCommands(cur, commands);
            startManualResolutionSession(
              cur,
              result.state,
              topId,
              'partial',
              counterPlan.warnings[0]
                ?? `${cardLabel(cur, topId)}の残りの効果を手動で処理してください。`,
              resolutionMode,
            );
          } catch {
            startManualResolutionSession(
              cur,
              cur,
              topId,
              'runtime-failure',
              `${cardLabel(cur, topId)}を自動処理できませんでした。手動で処理してください。`,
              resolutionMode,
            );
          }
          return;
        }
      }
      const plan = guidedPlanForStackTop(cur);
      if (plan) {
        startPendingGuided({
            sourceId: plan.sourceId,
            prompts: plan.prompts,
            // Deterministic commands of the guided lines ride along so mixed auto+guided
            // lines are not half-executed (§32 mixed→guided; CR 608.2c).
            commands: plan.commands,
            ...(plan.warnings.length > 0 ? { warnings: plan.warnings } : {}),
            ...(to === undefined ? {} : { to }),
            resolutionMode,
        });
        return;
      }
      if (stackItemIsWhollyUnsupported(cur, topId)) {
        startManualResolutionSession(
          cur,
          cur,
          topId,
          'unsupported',
          `${cardLabel(cur, topId)}の効果は自動化未対応です。手動で処理してください。`,
          resolutionMode,
        );
        return;
      }
      try {
        const result = applyCommand(cur, resolveStackTopCommandForState(cur, to));
        const resolvingAll = resolutionMode === 'all';
        commit(result.state, result.warnings, { groupedHistory: resolvingAll });
      } catch {
        startManualResolutionSession(
          cur,
          cur,
          topId,
          'runtime-failure',
          `${cardLabel(cur, topId)}を自動処理できませんでした。手動で処理してください。`,
          resolutionMode,
        );
      }
    },

    completeManualResolution() {
      const session = get().resolutionSession;
      const cur = get().state;
      if (!session || !cur) return;
      const source = cur.cards[session.sourceId];
      try {
        let next = cur;
        let warnings: string[] = [];
        if (source?.zone === 'stack') {
          const result = source.isAbility
            ? applyCommand(cur, { type: 'removeStackItem', id: session.sourceId })
            : applyCommand(cur, {
                type: 'moveCard',
                cardId: session.sourceId,
                to: manualResolutionDestination(cur, session.sourceId),
                position: 'bottom',
                reason: 'resolve',
              });
          next = result.state;
          warnings = result.warnings;
        }
        next = appendLog(next, `${cardLabel(cur, session.sourceId)}の手動処理を完了しました。`);
        const continueAll = session.mode === 'all';
        commitCompletedResolutionSession(next, warnings);
        if (continueAll) continueResolveAll();
      } catch (err) {
        set({
          resolutionSession: {
            ...session,
            stage: 'manual-required',
            reason: 'runtime-failure',
            tasks: [{
              id: `${session.sourceId}:runtime-failure`,
              message: `${cardLabel(cur, session.sourceId)}を完了できませんでした。手動操作を確認してください。`,
            }],
          },
        });
        reportActionError(err);
      }
    },

    commitCommanderResolution(token) {
      const prepared = pendingCommanderCommit;
      const current = get().state;
      if (!prepared || prepared.token !== token) return;
      if (current !== prepared.sourceState) {
        pendingCommanderCommit = null;
        set({ pendingCommanderResolution: null });
        return;
      }
      pendingCommanderCommit = null;
      commit(prepared.nextState, prepared.warnings, { groupedHistory: prepared.groupedHistory });
      if (prepared.continueResolveAll) continueResolveAll();
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
      const controllerId = guidedControllerId(cur, pending);
      const targetSnapshot = objectSnapshotForCard(cur, cardId);
      const commands = buildGuidedCommands(
        prompt,
        {
          kind: 'target',
          cardIds: [cardId],
          targetSnapshots: targetSnapshot ? [targetSnapshot] : [],
        },
        {
          sourceId: pending.sourceId,
          controllerId,
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
      const controllerId = guidedControllerId(cur, pending);
      const variableLoot = prompt.variableLoot;
      // Only computed (non-empty) for a variableLoot prompt — every pre-existing single-shot
      // discard prompt has no `variableLoot`, so `alreadyDiscarded` stays `[]` and the guard
      // below collapses to the original hand-membership check unchanged.
      const alreadyDiscarded = variableLoot
        ? variableLootDiscardedCardIds(pending.commands)
        : selectedCrossPlayerCardIds(pending.commands, prompt);
      if (!cur.zonesByPlayer[controllerId].hand.includes(cardId) || alreadyDiscarded.includes(cardId)) {
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
      const discardCommands = buildGuidedCommands(
        prompt,
        { kind: 'discard', cardIds: [cardId] },
        { sourceId: pending.sourceId, controllerId, def },
      );
      if (!variableLoot) {
        const commands = guidedCommandsWithSemanticReasons(prompt, discardCommands);
        advanceGuidedResolution(
          commands,
          prompt.count > 1 ? [{ ...prompt, count: prompt.count - 1 }] : [],
        );
        return;
      }

      // CR608.2h: the draw count is the number of cards the player *actually* discarded, not
      // the declared "up to"/"any number of" upper bound — so it can only be finalized once
      // discarding stops (max reached, hand exhausted, or the player cancels/declines to
      // discard more). Until then, re-present the same prompt with `discarded` incremented
      // instead of consuming it (prependPrompts keeps it at slot 0; see advanceGuidedResolution).
      const discardedCount = variableLoot.discarded + 1;
      // MP: hand exhaustion and the finalizing draw belong to the prompt's controller,
      // not the local player (CR121.2 — each player draws from their own library).
      const remainingHand = cur.zonesByPlayer[controllerId].hand.length - alreadyDiscarded.length - 1;
      const reachedMax = Number.isFinite(variableLoot.max) && discardedCount >= variableLoot.max;
      if (reachedMax || remainingHand <= 0) {
        const drawCount = Math.max(0, discardedCount + variableLoot.drawDelta);
        advanceGuidedResolution([
          ...discardCommands,
          { type: 'draw', count: drawCount, playerId: controllerId },
        ]);
        return;
      }
      advanceGuidedResolution(discardCommands, [
        { ...prompt, variableLoot: { ...variableLoot, discarded: discardedCount } },
      ]);
    },

    confirmGuidedLibrarySearch(cardId) {
      const cur = get().state;
      const pending = get().pendingGuided;
      const prompt = pending?.prompts[0];
      const spec = prompt?.librarySearch;
      if (!cur || !pending || prompt?.kind !== 'library-search' || !spec) {
        return;
      }
      const controllerId = guidedControllerId(cur, pending);
      const library = cur.zonesByPlayer[controllerId].library;
      if (cardId !== undefined) {
        if (!library.includes(cardId)) {
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
        cardId === undefined ? library : library.filter((id) => id !== cardId),
        rng,
      );
      const commands = buildGuidedCommands(
        prompt,
        { kind: 'library-search', cardIds: cardId === undefined ? [] : [cardId] },
        { sourceId: pending.sourceId, controllerId, def, libraryShuffleOrder: order },
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
        eligibleTargets(
          cur,
          prompt.filter ?? { types: ['permanent'], controller: 'you' },
          { sourceId: pending.sourceId, controllerId: prompt.playerId },
        ),
      );
      if (selectedCrossPlayerCardIds(pending.commands, prompt).includes(cardId)) {
        set({ warnings: [...get().warnings, `${cardLabel(cur, cardId)}はすでに選ばれています。`] });
        return;
      }
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
        { sourceId: pending.sourceId, controllerId: guidedControllerId(cur, pending), def },
      );
      const semanticCommands = guidedCommandsWithSemanticReasons(prompt, commands);
      advanceGuidedResolution(
        semanticCommands,
        prompt.count > 1 ? [{ ...prompt, count: prompt.count - 1 }] : [],
      );
    },

    confirmGuidedCostSubject(cardId) {
      const cur = get().state;
      const pending = get().pendingGuided;
      const prompt = pending?.prompts[0];
      const costState = isActivationPending(pending)
        ? pending.activation
        : isManaAbilityPending(pending)
          ? pending.manaAbility
          : null;
      if (
        !cur ||
        !pending ||
        !costState ||
        (
          prompt?.kind !== 'cost-discard'
          && prompt?.kind !== 'cost-sacrifice'
          && prompt?.kind !== 'cost-tap'
          && prompt?.kind !== 'cost-remove-counter'
        )
      ) {
        return;
      }
      if (
        prompt.kind === 'cost-remove-counter'
        && prompt.counterCost?.interaction !== 'source'
      ) {
        return;
      }

      const snapshot = objectSnapshotForCard(cur, cardId);
      if (!snapshot) {
        set({ warnings: [...get().warnings, `コストに選択したカードが存在しません: ${cardId}`] });
        return;
      }
      if (selectedCostSubjectIds(costState).has(cardId)) {
        set({ warnings: [...get().warnings, `コストに同じカードは選択できません: ${cardId}`] });
        return;
      }

      const forced = costState.paymentMode === 'forced';
      const legalIds = new Set(
        eligibleCostSubjectIds(cur, pending.sourceId, costState, prompt),
      );
      if (
        !legalIds.has(cardId)
        && (prompt.kind === 'cost-remove-counter' || !forced)
      ) {
        set({
          warnings: [
            ...get().warnings,
            `${cardLabel(cur, cardId)}は起動コストの候補にありません。`,
          ],
        });
        return;
      }
      const controllerId = costState.sourceSnapshot.controllerId ?? cur.localPlayerId;
      if (
        prompt.kind === 'cost-discard'
        && !cur.zonesByPlayer[controllerId].hand.includes(cardId)
      ) {
        set({
          warnings: [...get().warnings, `${cardLabel(cur, cardId)}は現在の手札にありません。`],
        });
        return;
      }
      if (
        prompt.kind === 'cost-sacrifice' &&
        (cardId === pending.sourceId || cur.cards[cardId]?.zone !== 'battlefield')
      ) {
        set({
          warnings: [
            ...get().warnings,
            `${cardLabel(cur, cardId)}は生け贄コストの候補にありません。`,
          ],
        });
        return;
      }
      if (
        prompt.kind === 'cost-tap' &&
        (cur.cards[cardId]?.zone !== 'battlefield'
          || cur.cards[cardId]?.tapped === true)
      ) {
        set({
          warnings: [
            ...get().warnings,
            `${cardLabel(cur, cardId)}はタップコストの候補にありません。`,
          ],
        });
        return;
      }

      const subjectRef = activationSubjectRefFromSnapshot(snapshot);
      const costComponents = costComponentsWithSubject(
        costState.costComponents,
        prompt,
        subjectRef,
      );
      let command: GameCommand;
      if (prompt.kind === 'cost-discard') {
        command = { type: 'discard', cardIds: [cardId], playerId: controllerId };
      } else if (prompt.kind === 'cost-tap') {
        command = { type: 'setTapped', cardId, tapped: true };
      } else if (prompt.kind === 'cost-remove-counter') {
        const counterCost = prompt.counterCost;
        if (counterCost?.interaction !== 'source') {
          return;
        }
        command = {
          type: 'addCounters',
          cardId,
          counterType: counterCost.counterType,
          delta: -counterCost.amount.value,
        };
      } else {
        command = {
          type: 'moveCard',
          cardId,
          to: 'graveyard',
          position: 'top',
          reason: 'sacrifice',
        };
      }
      if (isManaAbilityPending(pending)) {
        advanceGuidedManaAbility([command], costComponents);
      } else {
        advanceActivationCostSubject(command, costComponents);
      }
    },

    confirmGuidedCounterAmount(amount) {
      const cur = get().state;
      const pending = get().pendingGuided;
      const prompt = pending?.prompts[0];
      const costState = isActivationPending(pending)
        ? pending.activation
        : isManaAbilityPending(pending)
          ? pending.manaAbility
          : null;
      if (
        !cur
        || !pending
        || !costState
        || prompt?.kind !== 'cost-remove-counter'
        || prompt.counterCost?.interaction !== 'amount'
      ) {
        return;
      }
      const { min, max } = prompt.counterCost.amount;
      if (!Number.isInteger(amount) || amount < min || amount > max) {
        set({
          warnings: [
            ...get().warnings,
            `取り除くカウンター数は${min}以上${max}以下の整数で指定してください。`,
          ],
        });
        return;
      }
      const sourceId = prompt.counterCost.sourceId;
      const snapshot = objectSnapshotForCard(cur, sourceId);
      if (
        !snapshot
        || snapshot.objectId !== costState.sourceSnapshot.objectId
        || cur.cards[sourceId]?.zone !== 'battlefield'
        || (cur.cards[sourceId]?.counters[prompt.counterCost.counterType] ?? 0) < amount
      ) {
        set({
          warnings: [
            ...get().warnings,
            `${cardLabel(cur, sourceId)}の${prompt.counterCost.counterType}カウンターが不足しています。`,
          ],
        });
        return;
      }
      const componentSlotId = costComponentSlotIdForPrompt(prompt);
      const costComponents = costState.costComponents.map((component) =>
        component.slotId === componentSlotId
          ? { ...component, amount }
          : { ...component },
      );
      const command: GameCommand = {
        type: 'addCounters',
        cardId: sourceId,
        counterType: prompt.counterCost.counterType,
        delta: -amount,
      };
      if (isManaAbilityPending(pending)) {
        advanceGuidedManaAbility([command], costComponents);
      } else {
        advanceActivationCostSubject(command, costComponents);
      }
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
        {
          sourceId: pending.sourceId,
          controllerId: guidedControllerId(cur, pending),
          def,
        },
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
        {
          sourceId: pending.sourceId,
          controllerId: guidedControllerId(cur, pending),
          def,
        },
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
        discardPendingGuided();
        return;
      }
      // CR608.2h: cancelling a variable-loot discard prompt means "done discarding" (not
      // "abandon the ability") — finalize with a draw for however many were actually
      // discarded so far (0 if none), floored at 0 after the signed delta.
      const variableLoot = pending?.prompts[0]?.variableLoot;
      if (variableLoot && pending) {
        const cur = get().state;
        const drawCount = Math.max(0, variableLoot.discarded + variableLoot.drawDelta);
        advanceGuidedResolution([{
          type: 'draw',
          count: drawCount,
          // MP: the finalizing draw belongs to the prompt's controller (CR121.2).
          ...(cur ? { playerId: guidedControllerId(cur, pending) } : {}),
        }]);
        return;
      }
      advanceGuidedResolution([]);
    },

    resolveAll() {
      const cur = get().state;
      if (
        !cur
        || cur.zones.stack.length === 0
        || get().resolutionSession
      ) return;
      internal.resolutionGroupAnchor = null;
      internal.resolutionGroupPast = internal.past.slice();
      internal.resolutionGroupFuture = internal.future.slice();
      continueResolveAll();
    },

    removeStackItem(id, to) {
      dispatch({ type: 'removeStackItem', id, to });
    },

    setManualTargets(stackItemId, targetIds, targetPlayerIds = [], allowedZones = [
      'battlefield',
      'stack',
      'hand',
      'graveyard',
      'exile',
      'command',
    ]) {
      dispatch({
        type: 'setManualTargets',
        stackItemId,
        targetIds,
        targetPlayerIds,
        allowStackAbilities: true,
        allowedZones,
      });
    },

    declareAttack(attackerIds, targetLabel, blockers = []) {
      const cur = get().state;
      if (!cur) return;
      const requestedDefender = playerIdForLifeLabel(targetLabel);
      const defendingPlayerId = cur.players[requestedDefender]
        ? requestedDefender
        : targetLabel === '対戦相手'
          ? DEFAULT_OPPONENT_ID
          : undefined;
      if (!defendingPlayerId || defendingPlayerId === cur.localPlayerId) {
        set({ warnings: [...get().warnings, `攻撃先プレイヤーが見つかりません: ${targetLabel}`] });
        return;
      }

      const warnings = attackerIds.flatMap((cardId) => warningForSummoningSickness(cur, cardId));
      const commands: GameCommand[] = [
        {
          type: 'enterCombat',
          attackingPlayerId: cur.localPlayerId,
          defendingPlayerId,
        },
        {
          type: 'declareAttackers',
          attackers: attackerIds.map((cardId) => ({
            cardId,
            target: { type: 'player', playerId: defendingPlayerId, lifeLabel: targetLabel },
          })),
        },
        { type: 'declareBlockers', blockers },
        { type: 'resolveCombatDamage' },
      ];

      try {
        // CR 508.1m triggers are observed at declaration time, before blockers,
        // damage, and SBA can remove their sources. Keep the public one-click
        // combat transaction and one undo entry while collecting at that boundary.
        const declaration = applyCommands(cur, commands.slice(0, 2));
        const declarationTriggers = collectPendingTriggerUpdate(cur, declaration.state);
        const afterDeclaration = appendPendingTriggers(
          declarationTriggers.state,
          declarationTriggers.pendingTriggers,
        );
        const resolution = applyCommands(afterDeclaration, commands.slice(2));
        const resolutionTriggers = collectPendingTriggerUpdate(afterDeclaration, resolution.state);
        const finalState = appendPendingTriggers(
          resolutionTriggers.state,
          resolutionTriggers.pendingTriggers,
        );
        commit(
          finalState,
          [...declaration.warnings, ...resolution.warnings, ...warnings],
          { collectPending: false },
        );
      } catch (err) {
        reportActionError(err);
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
      const info = cyclingInfo(def);
      if (!info) return 'ok';

      // Plain cycling (CR 702.29a) draws a card. [Type]cycling (CR 702.29e) instead
      // tutors a matching card to hand + shuffles — not automated yet (guided library
      // search only supports destination:'battlefield'), so fail-closed: pay the cost
      // and discard, but skip the (incorrect) draw and warn the user to search manually.
      const effectCommands: GameCommand[] = info.isTypecycling
        ? [{ type: 'discard', cardIds: [cardId] }]
        : [{ type: 'discard', cardIds: [cardId] }, { type: 'draw', count: 1 }];
      const typecyclingWarnings = info.isTypecycling
        ? [
            `${cardLabel(cur, cardId)}のタイプサイクリングは自動化未対応です。ライブラリから該当タイプのカードを1枚手札に加え、シャッフルしてください。`,
          ]
        : [];

      const cost = parseManaCost(info.cost);
      const directPayment = solvePayment(cur.manaPool, cost, 0);
      if (directPayment.ok) {
        try {
          const result = applyCommands(cur, [
            { type: 'payMana', payment: directPayment.payment },
            ...effectCommands,
          ]);
          commit(result.state, [...result.warnings, ...typecyclingWarnings]);
        } catch (err) {
          reportActionError(err);
        }
        return 'ok';
      }

      const plan = planAutoManaPayment(cur, cost, 0);
      if (!plan.ok && !opts?.force) {
        return { shortfall: plan.shortfall };
      }

      try {
        const result = applyAutoManaPaymentAndCommands(cur, plan, [
          { type: 'payMana', payment: plan.payment },
          ...effectCommands,
        ]);
        commit(result.state, [...result.warnings, ...typecyclingWarnings]);
      } catch (err) {
        reportActionError(err);
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
        reportActionError(err);
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
        reportActionError(err);
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
        reportActionError(err);
      }
    },
  };
});

useGameStore.subscribe((state, prevState) => {
  if (snapshotPersistenceDisabledForDevelopment) return;
  if (state.state === prevState.state && state.autoAdvanceToMain === prevState.autoAdvanceToMain) {
    return;
  }

  if (snapshotSaveTimer) {
    clearTimeout(snapshotSaveTimer);
  }

  snapshotSaveTimer = setTimeout(() => {
    if (snapshotPersistenceDisabledForDevelopment) return;
    const s = useGameStore.getState();
    if (s.state === null) {
      void clearSnapshot();
      return;
    }

    void saveSnapshot({
      version: SNAPSHOT_VERSION,
      state: s.resolutionSession?.baseline ?? s.state,
      deck: snapshotInternal?.deck ?? [],
      autoAdvanceToMain: s.autoAdvanceToMain,
    });
  }, SNAPSHOT_SAVE_DELAY_MS);
});

/** Prevent isolated development fixtures from overwriting the user's normal save. */
export function disableSnapshotPersistenceForDevelopment(): void {
  if (!import.meta.env.DEV) return;
  snapshotPersistenceDisabledForDevelopment = true;
  if (snapshotSaveTimer) {
    clearTimeout(snapshotSaveTimer);
    snapshotSaveTimer = undefined;
  }
}
