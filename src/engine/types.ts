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

export type AbilityKind = 'activated' | 'triggered';

export type Phase = 'untap' | 'upkeep' | 'draw' | 'main1' | 'combat' | 'main2' | 'end';

export const PHASE_ORDER: Phase[] = ['untap', 'upkeep', 'draw', 'main1', 'combat', 'main2', 'end'];

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
  isCommander: boolean;
  enteredTurn: number; // battlefield に入ったターン番号。battlefield 外では 0
  manualKeywords?: string[]; // manually granted status Keyword ids
  effectsAuto?: boolean; // undefined = inherit global effectsAuto
  attachedTo?: string; // 装備/オーラの付与先 instance id
  isAbility?: boolean;
  sourceId?: string;
  sourceSnapshot?: ObjectSnapshot;
  abilityKind?: AbilityKind;
  abilityLineIndex?: number;
  targetSelections?: TargetSelection[];
  activationEnvelope?: ActivationEnvelope;
  isCopy?: boolean;
}

export function objectIdOf(card: Pick<CardInstance, 'id' | 'zoneChangeCounter'>): string {
  return `${card.id}:${card.zoneChangeCounter}`;
}

export type PlayerId = 'P1' | 'OPPONENT_A';
export const PLAYER_IDS: readonly PlayerId[] = ['P1', 'OPPONENT_A'];
export const PRIVATE_ZONE_IDS: readonly PrivateZoneId[] = ['library', 'hand', 'graveyard'];

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

export type CombatTarget = { type: 'player'; playerId: PlayerId; lifeLabel?: string };

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

export type TargetSelectionRef =
  | {
      kind: 'object';
      physicalCardId: PhysicalCardId;
      objectId: ObjectId;
      snapshot: ObjectSnapshot;
    }
  | {
      kind: 'player';
      playerId: PlayerId;
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
  | 'discard';
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
  | 'sacrifice';

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

export type KnownEventKind = 'zoneChange' | 'defeatAdvisory' | 'damage' | 'lifeChange' | 'draw';
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

export type GameEvent =
  | ZoneChangeEvent
  | DefeatAdvisoryEvent
  | DamageEvent
  | LifeChangeEvent
  | DrawEvent
  | CounterChangeEvent;

export type TriggerStackPlacementBucket = 'ordinary' | 'ability-triggered';

export interface PendingTriggerSchedule {
  kind: 'phase-begin';
  turn: number;
  phase: 'upkeep' | 'end';
  consumeOnTrigger: true;
  createdAtTurn: number;
  createdAtPhase: Phase;
}

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

export type PendingRuleChoice = CommanderZoneRuleChoice | LegendRuleChoice;

export type PendingSbaChoice = CommanderZoneRuleChoice;

export type RuleChoiceSelection =
  | { kind: 'commander-zone'; toCommandZone: boolean }
  | { kind: 'legend-rule'; keepCardId: PhysicalCardId };

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

export interface GameState {
  defs: Record<string, CardDef>; // defId -> CardDef(ゲーム中不変、トークンdef追加のみ)
  cards: Record<string, CardInstance>;
  zones: Record<ZoneId, string[]>; // 順序付き。library[0] = ライブラリの一番上
  zonesByPlayer: ZonesByPlayer;
  commanders: CommanderInfo[]; // 1〜2体(共闘)
  effectsAuto: boolean;
  activePlayerId: PlayerId;
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
  pendingRuleChoices: PendingRuleChoice[];
  pendingSbaChoices: PendingSbaChoice[];
  linkedExiles: Record<string, LinkedExileRecord>;
  log: LogEntry[];
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
  return {
    P1: clonePlayerPrivateZones(zonesByPlayer?.P1),
    OPPONENT_A: clonePlayerPrivateZones(zonesByPlayer?.OPPONENT_A),
  };
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
