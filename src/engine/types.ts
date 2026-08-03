import type { CardDef } from '../types/card';

export type ZoneId =
  | 'library'
  | 'hand'
  | 'battlefield'
  | 'graveyard'
  | 'exile'
  | 'command'
  | 'stack';

export type PrivateZoneId = 'library' | 'hand' | 'graveyard';
export type ManualTargetZone = Exclude<ZoneId, 'library'>;

export type AbilityKind = 'activated' | 'triggered';

export type Phase = 'untap' | 'upkeep' | 'draw' | 'main1' | 'combat' | 'main2' | 'end' | 'cleanup';

export const PHASE_ORDER: Phase[] = ['untap', 'upkeep', 'draw', 'main1', 'combat', 'main2', 'end', 'cleanup'];

export interface ManaPool {
  W: number;
  U: number;
  B: number;
  R: number;
  G: number;
  C: number;
}

export interface CardInstance {
  id: string; // instance id ('c1', 'c2', ... / tokens: 't1', ... / stack copies: 'k1', ...)
  defId: string; // CardDef.scryfallId(トークンは合成defを defs に登録)
  zone: ZoneId;
  ownerId: PlayerId;
  controllerId: PlayerId;
  zoneChangeCounter: number; // CR 400.7 object incarnation counter; physical id は維持し、領域移動でだけ増やす
  tapped: boolean;
  faceIndex: number; // 表示中フェイス(両面カード用。通常カードは常に0)
  faceDown: boolean;
  counters: Record<string, number>; // '+1/+1', 'loyalty', 'charge' など。値は常に >= 0
  damageMarked: number; // CR 120.6 damage marked on a creature; always >= 0
  hasDeathtouchDamage: boolean; // CR 704.5h damage from a source with deathtouch
  isToken: boolean;
  /** Synthetic permanent authored by the local opponent-setup tool. */
  isScenarioDummy?: boolean;
  isCommander: boolean;
  enteredTurn: number; // battlefield に入ったターン番号。battlefield 外では 0
  manualKeywords?: string[]; // manually granted status Keyword ids
  effectsAuto?: boolean; // undefined = inherit global effectsAuto
  attachedTo?: string; // 装備/オーラの付与先 instance id
  protectorId?: PlayerId; // CR 310.8: designated protector (battles only)
  isAbility?: boolean;
  sourceId?: string;
  sourceSnapshot?: ObjectSnapshot;
  abilityKind?: AbilityKind;
  abilityLineIndex?: number;
  targetSelections?: TargetSelection[];
  /** CR 107.3a/601.2b: X announced while this object is a spell on the stack. */
  announcedX?: number;
  /** CR 702.194b: true when this spell was cast using its teamwork cost. */
  usingTeamwork?: boolean;
  activationEnvelope?: ActivationEnvelope;
  /** CR 603.4 intervening-if condition copied from the pending trigger. */
  triggerCondition?: TriggerCondition;
  /** Isolated effect body for a delayed trigger embedded in another ability. */
  abilityResolutionText?: string;
  isCopy?: boolean;
  /** CR 716.2b: class level designation (not a counter). Defaults to 1 via classLevelOf. */
  classLevel?: number;
}

export function objectIdOf(card: Pick<CardInstance, 'id' | 'zoneChangeCounter'>): string {
  return `${card.id}:${card.zoneChangeCounter}`;
}

export type PlayerId = string;
export const LOCAL_PLAYER_ID = 'P1';
export const DEFAULT_OPPONENT_ID = 'OPPONENT_A';
export const DEFAULT_OPPONENT_LIFE_LABEL = '対戦相手A';
export const PLAYER_IDS: readonly PlayerId[] = ['P1', 'OPPONENT_A'];
export const PRIVATE_ZONE_IDS: readonly PrivateZoneId[] = ['library', 'hand', 'graveyard'];

export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineError';
  }
}

export interface PlayerPrivateZones {
  library: string[];
  hand: string[];
  graveyard: string[];
}

export type ZonesByPlayer = Record<PlayerId, PlayerPrivateZones>;
export type PhysicalCardId = string;
export type ObjectId = string;

export type CombatStep =
  | 'beginningOfCombat'
  | 'declareAttackers'
  | 'declareBlockers'
  | 'combatDamage'
  | 'endOfCombat';

export type CombatTarget =
  | { type: 'player'; playerId: PlayerId; lifeLabel?: string }
  | { type: 'battle'; playerId: PlayerId; cardId: string; objectId: ObjectId };

export interface CombatAttacker {
  cardId: string;
  objectId: ObjectId;
  controllerId: PlayerId;
  target: CombatTarget;
  blockedBy: string[];
  declaredOrder: number;
}

export interface CombatBlocker {
  cardId: string;
  objectId: ObjectId;
  controllerId: PlayerId;
  blocking: string[];
  declaredOrder: number;
}

export interface CombatState {
  combatId: string;
  turn: number;
  step: CombatStep;
  attackingPlayerId: PlayerId;
  defendingPlayerId: PlayerId;
  attackers: CombatAttacker[];
  blockers: CombatBlocker[];
}

export interface ObjectSnapshot {
  physicalCardId: PhysicalCardId;
  objectId: ObjectId;
  defId: string;
  zone: ZoneId;
  ownerId: PlayerId;
  controllerId?: PlayerId;
  isToken: boolean;
  isScenarioDummy?: boolean;
  isCommander: boolean;
  faceIndex: number;
  tapped: boolean;
  counters: Record<string, number>;
  typeLine: string;
  manaValue?: number;
  power?: string;
  toughness?: string;
}

export type LinkedExilePurpose = 'exiled-with-source' | 'temporary-return';

export interface LinkedExileRecord {
  linkId: string;
  purpose: LinkedExilePurpose;
  sourceObjectId: ObjectId;
  sourcePhysicalId: PhysicalCardId;
  exiledPhysicalIds: PhysicalCardId[];
  exiledObjectIds: ObjectId[];
  snapshot: ObjectSnapshot;
  createdSequence: number;
}

export interface LinkedExileWrite {
  linkId: string;
  purpose: LinkedExilePurpose;
  sourceObjectId: ObjectId;
  sourcePhysicalId: PhysicalCardId;
}

export type TargetSelectionKind = 'object' | 'player' | 'object-or-player';
export type TargetSelectionLegalityMode = 'checked' | 'unchecked-warning' | 'forced';
export type ManualTargetPlayerId = PlayerId;

export type TargetSelectionRef =
  | {
      kind: 'object';
      physicalCardId: PhysicalCardId;
      objectId: ObjectId;
      snapshot: ObjectSnapshot;
    }
  | {
      kind: 'player';
      playerId: ManualTargetPlayerId;
    };

export interface TargetSelection {
  slotId: string;
  raw: string;
  kind: TargetSelectionKind;
  selection: TargetSelectionRef;
  legalityMode: TargetSelectionLegalityMode;
}

export type ActivationPaymentMode = 'rules-legal' | 'forced';
export type ActivationStackPolicy = 'stack' | 'mana-transaction-no-stack';

export interface ActivationSourceRef {
  physicalCardId: PhysicalCardId;
  objectId: ObjectId;
  snapshot: ObjectSnapshot;
}

export type ActivationCostComponentKind =
  | 'mana'
  | 'tap-self'
  | 'sacrifice-self'
  | 'sacrifice-object'
  | 'pay-life'
  | 'discard'
  | 'tap-object'
  | 'remove-counter'
  | 'mill';
export type ActivationCostComponentStatus = 'auto' | 'guided' | 'manual' | 'unparsed';

export interface ActivationCostComponent {
  kind: ActivationCostComponentKind;
  raw: string;
  payerId: PlayerId;
  status: ActivationCostComponentStatus;
  amount?: number;
  slotId?: string;
  subjectRef?: ActivationSourceRef;
  subjectRefs?: ActivationSourceRef[];
  manaCost?: string;
  counterType?: string;
}

export interface ActivationEnvelope {
  sourceRef: ActivationSourceRef;
  abilityLineIndex?: number;
  cost: ActivationCostComponent[];
  targetSelections: TargetSelection[];
  stackPolicy: ActivationStackPolicy;
  paymentMode: ActivationPaymentMode;
}

export type ZoneChangeReason =
  | 'move'
  | 'cast'
  | 'resolve'
  | 'cost'
  | 'sba'
  | 'replacement'
  | 'token-cease'
  | 'copy-cease'
  | 'discard'
  | 'mill'
  | 'sacrifice'
  | 'destroy';

export interface ZoneChangeEvent {
  type: 'zoneChange';
  eventId: string;
  sequence: number;
  simultaneousGroupId?: string;
  causeCommandId?: string;
  reason: ZoneChangeReason;
  physicalCardId: PhysicalCardId;
  oldObjectId: ObjectId;
  newObjectId?: ObjectId;
  fromZone: ZoneId;
  toZone?: ZoneId;
  replacementApplied?: string;
  sbaApplied?: string;
  before: ObjectSnapshot;
  after?: ObjectSnapshot;
}

export type KnownEventKind =
  | 'zoneChange'
  | 'defeatAdvisory'
  | 'damage'
  | 'lifeChange'
  | 'draw'
  | 'attackDeclaration';
export type NewEnvelopeEventKind = 'damage' | 'lifeChange' | 'draw';

export type EventCause =
  | { type: 'command'; commandType: string }
  | { type: 'system'; ruleRef: string }
  | { type: 'event'; eventId: string; eventType: KnownEventKind };

export type EventDeterminismRef =
  | { kind: 'command-payload'; commandType: string; fieldPath?: string }
  | { kind: 'event-log-sequence' };

export interface EventEnvelopeBase<T extends NewEnvelopeEventKind = NewEnvelopeEventKind> {
  type: T;
  eventId: string;
  sequence: number;
  simultaneousGroupId?: string;
  causeCommandId?: string;
  causeEventId?: string;
  cause: EventCause;
  replacementApplied?: string | string[];
  preventionApplied?: string | string[];
  determinismRef?: EventDeterminismRef;
  reason?: never;
  fromZone?: never;
  toZone?: never;
  sbaApplied?: never;
}

export type EventSourceRef =
  | {
      kind: 'object';
      physicalCardId: PhysicalCardId;
      objectId: ObjectId;
      snapshot?: ObjectSnapshot;
    }
  | { kind: 'player'; playerId: PlayerId }
  | { kind: 'command'; commandType: string }
  | { kind: 'system'; ruleRef: string };

export type EventTargetRef =
  | { kind: 'player'; playerId: PlayerId; lifeLabel?: string }
  | {
      kind: 'object';
      physicalCardId: PhysicalCardId;
      objectId: ObjectId;
      snapshot?: ObjectSnapshot;
    }
  | { kind: 'zone'; zone: ZoneId; zoneOwnerId?: PlayerId };

export interface LifeChangeEvent extends EventEnvelopeBase<'lifeChange'> {
  type: 'lifeChange';
  playerId: PlayerId;
  lifeLabel?: string;
  delta: number;
  previousLife: number;
  nextLife: number;
  direction: 'gain' | 'loss';
  source?: EventSourceRef;
  sourceEventId?: string;
  physicalCardId?: never;
  oldObjectId?: never;
  newObjectId?: never;
  before?: never;
  after?: never;
}

export interface DamageEvent extends EventEnvelopeBase<'damage'> {
  type: 'damage';
  source: EventSourceRef;
  target: EventTargetRef;
  amount: number;
  combatDamage: boolean;
  damageResultEventIds?: string[];
  physicalCardId?: never;
  oldObjectId?: never;
  newObjectId?: never;
  before?: never;
  after?: never;
}

export interface DrawEvent extends EventEnvelopeBase<'draw'> {
  type: 'draw';
  playerId: PlayerId;
  result: 'drawn' | 'empty-library-attempt';
  drawOrdinal?: number;
  physicalCardId?: PhysicalCardId;
  oldObjectId?: ObjectId;
  newObjectId?: ObjectId;
  fromZoneOwnerId?: PlayerId;
  toZoneOwnerId?: PlayerId;
  zoneChangeEventId?: string;
  before?: ObjectSnapshot;
  after?: ObjectSnapshot;
}

/** CR 508.1m: emitted after attackers are declared and before later combat steps. */
export interface AttackDeclarationEvent {
  type: 'attackDeclaration';
  eventId: string;
  sequence: number;
  turn: number;
  combatId: string;
  attackingPlayerId: PlayerId;
  attackers: ObjectSnapshot[];
  battlefield: ObjectSnapshot[];
  simultaneousGroupId?: never;
  causeCommandId?: never;
  physicalCardId?: never;
  oldObjectId?: never;
  newObjectId?: never;
  fromZone?: never;
  toZone?: never;
  reason?: never;
  replacementApplied?: never;
  preventionApplied?: never;
  sbaApplied?: never;
  before?: never;
  after?: never;
}

export interface CounterChangeEvent {
  type: 'counterChange';
  eventId: string;
  sequence: number;
  simultaneousGroupId?: string;
  causeCommandId?: string;
  target: EventTargetRef;
  counterType: string;
  delta: number;
  before: number;
  after: number;
  reason?: never;
  physicalCardId?: never;
  oldObjectId?: never;
  newObjectId?: never;
  fromZone?: never;
  toZone?: never;
  replacementApplied?: never;
  sbaApplied?: never;
}

export interface AbilityTriggeredEvent {
  type: 'abilityTriggered';
  eventId: string;
  sequence: number;
  pendingTriggerId: string;
  sourceObjectId: ObjectId;
  controllerId: PlayerId;
  causeEventId?: string;
}

export interface ActivatedManaAbilityEvent {
  type: 'activatedManaAbility';
  eventId: string;
  sequence: number;
  sourceObjectId: ObjectId;
  sourceSnapshot: ObjectSnapshot;
  controllerId: PlayerId;
  abilityLineIndex?: number;
  stage: 'activated' | 'resolved';
}

export interface ManaAddedEvent {
  type: 'manaAdded';
  eventId: string;
  sequence: number;
  playerId: PlayerId;
  sourceObjectId?: ObjectId;
  sourceSnapshot?: ObjectSnapshot;
  amount: ManaPool;
  causeEventId?: string;
}

export type DefeatReason = 'lifeZero' | 'emptyLibraryDraw' | 'poison' | 'commanderDamage';
export type DefeatRuleRef = '704.5a' | '704.5b' | '704.5c' | '903.10a';
export type DefeatPlayerRef = 'P1' | `opponent:${string}`;

export interface DefeatAdvisoryRecord {
  reasons: DefeatReason[];
  ruleRefs: Partial<Record<DefeatReason, DefeatRuleRef>>;
  advisory: true;
}

export interface DefeatAdvisoryEvent {
  type: 'defeatAdvisory';
  eventId: string;
  sequence: number;
  reason: 'sba';
  sbaApplied: DefeatRuleRef;
  simultaneousGroupId: string;
  playerRef: DefeatPlayerRef;
  defeatReason: DefeatReason;
  advisory: true;
  physicalCardId?: never;
  oldObjectId?: never;
  newObjectId?: never;
  fromZone?: never;
  toZone?: never;
  before?: never;
  after?: never;
  replacementApplied?: never;
  preventionApplied?: never;
}

/** A single room in a dungeon (CR 309.4). */
export interface DungeonRoom {
  name: string; // room name (flavor, 309.4b)
  oracleText: string; // room ability effect text (309.4c)
  nextRooms: number[]; // indices of rooms reachable via arrows; empty = bottommost
}

/** Definition of a dungeon card (nontraditional, CR 309.1). */
export interface DungeonDef {
  id: string; // unique dungeon def id
  name: string; // English name
  printedName?: string; // Japanese name
  rooms: DungeonRoom[]; // room 0 = topmost (309.4a)
}

/** Per-player dungeon state in the command zone (CR 309.2). */
export interface DungeonState {
  dungeonDefId: string; // which DungeonDef is active
  currentRoomIndex: number; // venture marker position (0-based, 309.4)
  completedCount: number; // number of dungeons completed this game (309.7)
}

/** Logged when a player ventures into a dungeon (CR 701.49). */
export interface VentureEvent {
  type: 'venture';
  eventId: string;
  sequence: number;
  playerId: PlayerId;
  dungeonDefId: string;
  roomIndex: number;
  completedDungeonDefId?: string; // set when 309.5b completes the old dungeon
  // Fields unused by venture events; declared as optional never so the GameEvent
  // union keeps a coherent common-property surface for existing consumers.
  simultaneousGroupId?: never;
  physicalCardId?: never;
  oldObjectId?: never;
  newObjectId?: never;
  fromZone?: never;
  toZone?: never;
  before?: never;
  after?: never;
  reason?: never;
  sbaApplied?: never;
  replacementApplied?: never;
  preventionApplied?: never;
}

export type GameEvent =
  | ZoneChangeEvent
  | DefeatAdvisoryEvent
  | DamageEvent
  | LifeChangeEvent
  | DrawEvent
  | AttackDeclarationEvent
  | CounterChangeEvent
  | VentureEvent;

export type TriggerStackPlacementBucket = 'ordinary' | 'ability-triggered';

export interface PendingTriggerSchedule {
  kind: 'phase-begin';
  turn: number;
  phase: 'upkeep' | 'end';
  consumeOnTrigger: true;
  createdAtTurn: number;
  createdAtPhase: Phase;
}

export type TriggerCondition =
  | {
      kind: 'graveyard-card-types-at-least';
      playerId: PlayerId;
      minimum: number;
    }
  | {
      kind: 'source-is-tapped';
      sourceId: string;
    };

export interface PendingTrigger {
  pendingTriggerId: string;
  eventId: string;
  simultaneousGroupId: string;
  triggerId: string;
  sourceId: string;
  sourceObjectId: ObjectId;
  sourceSnapshot: ObjectSnapshot;
  controllerId: PlayerId;
  label: string;
  abilityLineIndex?: number;
  stackPlacementBucket: TriggerStackPlacementBucket;
  triggeredByPendingTriggerId?: string;
  triggeredByAbilityEventId?: string;
  schedule?: PendingTriggerSchedule;
  condition?: TriggerCondition;
  resolutionText?: string;
}

export interface OncePerTurnTriggerLedger {
  turn: number;
  consumedKeys: string[];
}

export interface PendingManaTrigger {
  kind: 'triggered-mana-ability';
  ruleRef: '605.1b';
  triggerEventId: string;
  sourceId: PhysicalCardId;
  sourceObjectId: ObjectId;
  sourceSnapshot: ObjectSnapshot;
  controllerId: PlayerId;
  abilityLineIndex?: number;
  label: string;
}

export interface CommanderZoneRuleChoice {
  choiceId: string;
  kind: 'commander-zone';
  ruleRef: '903.9a';
  cardId: PhysicalCardId;
  fromZone: 'graveyard' | 'exile';
  toZone: 'command';
  eventId: string;
  sourceObjectId: ObjectId;
  controllerId: PlayerId;
}

export interface LegendRuleChoice {
  choiceId: string;
  kind: 'legend-rule';
  ruleRef: '704.5j';
  controllerId: PlayerId;
  name: string;
  cardIds: PhysicalCardId[];
}

export interface CleanupDiscardRuleChoice {
  choiceId: string;
  kind: 'cleanup-discard';
  ruleRef: '514.1';
  playerId: PlayerId;
  cardIds: PhysicalCardId[];
  requiredCount: number;
}

export type PendingRuleChoice = CommanderZoneRuleChoice | LegendRuleChoice | CleanupDiscardRuleChoice;

export type PendingSbaChoice = CommanderZoneRuleChoice;

export type RuleChoiceSelection =
  | { kind: 'commander-zone'; toCommandZone: boolean }
  | { kind: 'legend-rule'; keepCardId: PhysicalCardId }
  | { kind: 'cleanup-discard'; cardIds: PhysicalCardId[]; manualHandled?: boolean };

export interface CommanderInfo {
  cardId: string; // CardInstance.id
  castCount: number; // 統率領域から唱えた回数(CR 903.8)。税 = 2 * castCount
}

export interface LogEntry {
  seq: number;
  turn: number;
  phase: Phase;
  message: string; // 日本語。カード名は printedName ?? name を《》で囲む
}

export interface PlayerState {
  id: PlayerId;
  label: string;
  life: number;
  poison: number;
  energy: number;
  experience: number;
  manaPool: ManaPool;
  landsPlayedThisTurn: number;
  spellsCastThisTurn: number;
  drawnThisTurn: number;
  mulliganCount: number;
  maximumHandSizeOverride?: number | 'none';
}

export interface GameState {
  defs: Record<string, CardDef>; // defId -> CardDef(ゲーム中不変、トークンdef追加のみ)
  cards: Record<string, CardInstance>;
  zones: Record<ZoneId, string[]>; // 順序付き。library[0] = ライブラリの一番上
  zonesByPlayer: ZonesByPlayer;
  commanders: CommanderInfo[]; // 1〜2体(共闘)
  effectsAuto: boolean;
  activePlayerId: PlayerId;
  players: Partial<Record<PlayerId, PlayerState>>;
  turnOrder: PlayerId[];
  localPlayerId: PlayerId;
  turn: number; // 1始まり
  phase: Phase;
  combat: CombatState | null;
  life: number; // 初期40
  poison: number;
  energy: number;
  experience: number;
  commanderDamage: Record<string, number>; // key: 対戦相手統率者のラベル(自由文字列)
  opponentLife: Record<string, number>;
  defeat: Partial<Record<DefeatPlayerRef, DefeatAdvisoryRecord>>;
  emptyLibraryDrawAttemptedSinceLastSba: Partial<Record<PlayerId, boolean>>;
  manaPool: ManaPool;
  mulliganCount: number;
  landsPlayedThisTurn: number;
  spellsCastThisTurn: number;
  drawnThisTurn: number;
  combatDamagePreventedUntilEndOfTurn: boolean;
  eventLog: GameEvent[];
  pendingTriggers: PendingTrigger[];
  oncePerTurnTriggerLedger: OncePerTurnTriggerLedger;
  powerUpActivated: Record<string, true>;
  pendingRuleChoices: PendingRuleChoice[];
  pendingSbaChoices: PendingSbaChoice[];
  linkedExiles: Record<string, LinkedExileRecord>;
  log: LogEntry[];
  dungeonDefs?: Record<string, DungeonDef>; // dungeonDefId -> DungeonDef (game-invariant)
  dungeons?: Partial<Record<PlayerId, DungeonState>>; // per-player active dungeon
}

export function emptyPlayerPrivateZones(): PlayerPrivateZones {
  return { library: [], hand: [], graveyard: [] };
}

export function clonePlayerPrivateZones(
  zones: Partial<PlayerPrivateZones> | undefined,
): PlayerPrivateZones {
  return {
    library: zones?.library?.slice() ?? [],
    hand: zones?.hand?.slice() ?? [],
    graveyard: zones?.graveyard?.slice() ?? [],
  };
}

export function cloneZonesByPlayer(
  zonesByPlayer: Partial<Record<PlayerId, Partial<PlayerPrivateZones>>> | undefined,
): ZonesByPlayer {
  const cloned: ZonesByPlayer = {};
  for (const [playerId, zones] of Object.entries(zonesByPlayer ?? {})) {
    cloned[playerId] = clonePlayerPrivateZones(zones);
  }
  cloned[LOCAL_PLAYER_ID] ??= emptyPlayerPrivateZones();
  cloned[DEFAULT_OPPONENT_ID] ??= emptyPlayerPrivateZones();
  return cloned;
}

export function playerPrivateZonesFromFlatZones(
  zones: Pick<Record<ZoneId, string[]>, PrivateZoneId>,
): PlayerPrivateZones {
  return {
    library: zones.library.slice(),
    hand: zones.hand.slice(),
    graveyard: zones.graveyard.slice(),
  };
}

export function zonesByPlayerWithP1Mirror(
  zonesByPlayer: Partial<Record<PlayerId, Partial<PlayerPrivateZones>>> | undefined,
  zones: Pick<Record<ZoneId, string[]>, PrivateZoneId>,
): ZonesByPlayer {
  return {
    ...cloneZonesByPlayer(zonesByPlayer),
    P1: playerPrivateZonesFromFlatZones(zones),
  };
}

export function syncP1ZonesByPlayerFromFlatZones(state: GameState): GameState {
  return {
    ...state,
    zonesByPlayer: zonesByPlayerWithP1Mirror(
      (state as Partial<GameState>).zonesByPlayer,
      state.zones,
    ),
  };
}

export function syncFlatPrivateZonesFromPlayers(state: GameState): GameState {
  const localZones = clonePlayerPrivateZones(state.zonesByPlayer[state.localPlayerId]);
  return {
    ...state,
    zones: {
      ...state.zones,
      library: localZones.library,
      hand: localZones.hand,
      graveyard: localZones.graveyard,
    },
  };
}

export function requirePlayer(state: GameState, id: PlayerId): PlayerState {
  const player = state.players[id];
  if (!player) {
    throw new EngineError(`プレイヤーが存在しません: ${id}`);
  }
  return player;
}

export function playerIdForLifeLabel(label: string): PlayerId {
  return label === DEFAULT_OPPONENT_LIFE_LABEL
    ? DEFAULT_OPPONENT_ID
    : `opponent:${label}`;
}

export function defeatPlayerRefForLifeLabel(label: string): DefeatPlayerRef {
  return `opponent:${label}`;
}

function playerStateFromLegacyLife(
  id: PlayerId,
  label: string,
  life: number,
  prior?: PlayerState,
): PlayerState {
  return {
    id,
    label,
    life,
    poison: prior?.poison ?? 0,
    energy: prior?.energy ?? 0,
    experience: prior?.experience ?? 0,
    manaPool: prior ? { ...prior.manaPool } : { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    landsPlayedThisTurn: prior?.landsPlayedThisTurn ?? 0,
    spellsCastThisTurn: prior?.spellsCastThisTurn ?? 0,
    drawnThisTurn: prior?.drawnThisTurn ?? 0,
    mulliganCount: prior?.mulliganCount ?? 0,
    maximumHandSizeOverride: prior?.maximumHandSizeOverride,
  };
}

export function syncPlayersFromLegacyScalars(state: GameState): GameState {
  const priorPlayers = (state as Partial<GameState>).players ?? {};
  const localPlayerId = (state as Partial<GameState>).localPlayerId ?? LOCAL_PLAYER_ID;
  const localPrior = priorPlayers[localPlayerId];
  const players: Partial<Record<PlayerId, PlayerState>> = {
    [localPlayerId]: {
      id: localPlayerId,
      label: localPrior?.label ?? 'あなた',
      life: state.life,
      poison: state.poison,
      energy: state.energy,
      experience: state.experience,
      manaPool: { ...state.manaPool },
      landsPlayedThisTurn: state.landsPlayedThisTurn,
      spellsCastThisTurn: state.spellsCastThisTurn,
      drawnThisTurn: state.drawnThisTurn,
      mulliganCount: state.mulliganCount,
      maximumHandSizeOverride: localPrior?.maximumHandSizeOverride,
    },
  };

  const opponents = new Map<string, { id: PlayerId; state: PlayerState }>();
  for (const [label, life] of Object.entries(state.opponentLife)) {
    const id = playerIdForLifeLabel(label);
    opponents.set(label, {
      id,
      state: playerStateFromLegacyLife(id, label, life, priorPlayers[id]),
    });
  }
  opponents.set(DEFAULT_OPPONENT_LIFE_LABEL, {
    id: DEFAULT_OPPONENT_ID,
    state: playerStateFromLegacyLife(
      DEFAULT_OPPONENT_ID,
      DEFAULT_OPPONENT_LIFE_LABEL,
      state.opponentLife[DEFAULT_OPPONENT_LIFE_LABEL] ?? 40,
      priorPlayers[DEFAULT_OPPONENT_ID],
    ),
  });

  const defaultOpponent = opponents.get(DEFAULT_OPPONENT_LIFE_LABEL);
  if (defaultOpponent) {
    players[DEFAULT_OPPONENT_ID] = defaultOpponent.state;
  }
  const extras = [...opponents.entries()]
    .filter(([label]) => label !== DEFAULT_OPPONENT_LIFE_LABEL)
    .sort(([left], [right]) => left.localeCompare(right));
  for (const [, opponent] of extras) {
    players[opponent.id] = opponent.state;
  }

  return {
    ...state,
    players,
    turnOrder: [localPlayerId, DEFAULT_OPPONENT_ID, ...extras.map(([, opponent]) => opponent.id)],
    localPlayerId,
  };
}

type DerivedViewsInput = Omit<GameState, 'players' | 'turnOrder'> &
  Partial<Pick<GameState, 'players' | 'turnOrder'>>;

export function syncDerivedViews(state: DerivedViewsInput): GameState {
  const completeState = syncPlayersFromLegacyScalars({
    ...state,
    players: state.players ?? {},
    turnOrder: state.turnOrder ?? [],
  });
  const zonesByPlayer = cloneZonesByPlayer(completeState.zonesByPlayer);
  for (const playerId of completeState.turnOrder) {
    zonesByPlayer[playerId] ??= emptyPlayerPrivateZones();
  }
  return syncFlatPrivateZonesFromPlayers({ ...completeState, zonesByPlayer });
}
