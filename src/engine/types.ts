import type { CardDef } from '../types/card';

export type ZoneId =
  | 'library'
  | 'hand'
  | 'battlefield'
  | 'graveyard'
  | 'exile'
  | 'command'
  | 'stack';

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
  abilityKind?: AbilityKind;
  abilityLineIndex?: number;
  isCopy?: boolean;
}

export function objectIdOf(card: Pick<CardInstance, 'id' | 'zoneChangeCounter'>): string {
  return `${card.id}:${card.zoneChangeCounter}`;
}

export type PlayerId = 'P1' | 'OPPONENT_A';
export type PhysicalCardId = string;
export type ObjectId = string;

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
  power?: string;
  toughness?: string;
}

export type ZoneChangeReason =
  | 'move'
  | 'cast'
  | 'resolve'
  | 'cost'
  | 'sba'
  | 'replacement'
  | 'token-cease'
  | 'copy-cease';

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

export type GameEvent = ZoneChangeEvent;

export type TriggerStackPlacementBucket = 'ordinary' | 'ability-triggered';

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
  commanders: CommanderInfo[]; // 1〜2体(共闘)
  effectsAuto: boolean;
  activePlayerId: PlayerId;
  turn: number; // 1始まり
  phase: Phase;
  life: number; // 初期40
  poison: number;
  energy: number;
  experience: number;
  commanderDamage: Record<string, number>; // key: 対戦相手統率者のラベル(自由文字列)
  opponentLife: Record<string, number>;
  manaPool: ManaPool;
  mulliganCount: number;
  landsPlayedThisTurn: number;
  spellsCastThisTurn: number;
  drawnThisTurn: number;
  eventLog: GameEvent[];
  pendingTriggers: PendingTrigger[];
  pendingRuleChoices: PendingRuleChoice[];
  pendingSbaChoices: PendingSbaChoice[];
  log: LogEntry[];
}
