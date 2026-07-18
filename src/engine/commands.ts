import type { CardDef, ManaColor } from '../types/card';
import { autoTapCommands, planAutoTap } from './autotap';
import { isCommander } from './commander';
import {
  buildGuidedCommands,
  compileAbilityCost,
  compileAbilityIR,
  graveyardReturnFilterForRaw,
  guidedCounterLeafForManualComposite,
  type AutoDecision,
  type CostDecision,
  type EffectPrompt,
  type TargetFilter,
} from './grammar/compile';
import { splitAbilityLines, type AbilityLine } from './grammar/index';
import { parseAbilityIR, type AbilityCost } from './grammar/ir';
import { parseManaCost } from './mana';
import {
  effectiveKeywords,
  effectivePower,
  effectiveTypeLine,
  graveyardToExileReplacementActive,
  hasVigilance,
  normalizeKeywords,
} from './status';
import {
  hasDelayedPhaseBeginTiming,
  makeScheduledDelayedTrigger,
  promoteDueScheduledTriggers,
} from './triggers';
import type {
  AbilityKind,
  ActivationCostComponent,
  ActivationEnvelope,
  ActivationSourceRef,
  CardInstance,
  CombatAttacker,
  CombatBlocker,
  CombatState,
  CombatTarget,
  CounterChangeEvent,
  DamageEvent,
  DefeatAdvisoryEvent,
  DefeatPlayerRef,
  DefeatReason,
  DefeatRuleRef,
  DrawEvent,
  EventCause,
  EventSourceRef,
  EventTargetRef,
  GameEvent,
  GameState,
  LegendRuleChoice,
  LinkedExileRecord,
  LinkedExileWrite,
  LifeChangeEvent,
  LogEntry,
  ManaPool,
  ObjectSnapshot,
  PendingTrigger,
  Phase,
  PlayerId,
  PlayerPrivateZones,
  PrivateZoneId,
  TargetSelection,
  TargetSelectionKind,
  ZoneChangeEvent,
  ZoneChangeReason,
  ZoneId,
} from './types';
import {
  clonePlayerPrivateZones,
  cloneZonesByPlayer,
  defeatPlayerRefForLifeLabel,
  EngineError,
  objectIdOf,
  PHASE_ORDER,
  playerIdForLifeLabel,
  requirePlayer,
  syncDerivedViews,
} from './types';

export { EngineError } from './types';

export type GameCommand =
  | {
      type: 'moveCard';
      cardId: string;
      to: ZoneId;
      position: 'top' | 'bottom' | number;
      reason?: ZoneChangeReason;
      replacementApplied?: string;
      sbaApplied?: string;
      simultaneousGroupId?: string;
      linkedExileWrite?: LinkedExileWrite;
    }
  | { type: 'setTapped'; cardId: string; tapped: boolean }
  | { type: 'setFace'; cardId: string; faceIndex: number }
  | { type: 'setFaceDown'; cardId: string; faceDown: boolean }
  | { type: 'setManualKeywords'; cardId: string; keywords: string[] }
  | { type: 'setEffectsAuto'; value: boolean }
  | { type: 'setCardEffectsAuto'; cardId: string; value: boolean }
  | { type: 'addCounters'; cardId: string; counterType: string; delta: number }
  | { type: 'markDamage'; cardId: string; amount: number; deathtouch?: boolean }
  | {
      type: 'dealDamage';
      sourceId: string;
      amount: number;
      combatDamage: boolean;
      deathtouch?: boolean;
      targetCardId: string;
      targetPlayerId?: never;
    }
  | {
      type: 'dealDamage';
      sourceId: string;
      amount: number;
      combatDamage: boolean;
      deathtouch?: boolean;
      targetPlayerId: PlayerId;
      targetCardId?: never;
    }
  | { type: 'clearMarkedDamage'; cardId?: string }
  | { type: 'preventCombatDamageThisTurn' }
  | {
      type: 'enterCombat';
      attackingPlayerId?: PlayerId;
      defendingPlayerId?: PlayerId;
      combatId?: string;
    }
  | {
      type: 'declareAttackers';
      attackers: Array<{ cardId: string; target?: CombatTarget }>;
    }
  | {
      type: 'declareBlockers';
      blockers: Array<{ cardId: string; attackerId: string }>;
    }
  | { type: 'resolveCombatDamage' }
  | { type: 'attach'; cardId: string; to: string | undefined }
  | { type: 'setController'; cardId: string; controllerId: PlayerId }
  | { type: 'adjustLife'; delta: number; playerId?: PlayerId }
  | {
      type: 'adjustPlayerCounter';
      kind: 'poison' | 'energy' | 'experience';
      delta: number;
      playerId?: PlayerId;
    }
  | {
      type: 'applyPlayerEffect';
      controllerId: PlayerId;
      recipients: 'you' | 'eachOpponent' | 'eachPlayer';
      effect: 'draw' | 'mill' | 'life';
      amount: number;
    }
  | {
      type: 'applyPlayerEffect';
      controllerId: PlayerId;
      recipients: 'you' | 'eachOpponent' | 'eachPlayer';
      effect: 'counter';
      kind: 'poison' | 'energy' | 'experience';
      amount: number;
    }
  | { type: 'adjustCommanderDamage'; label: string; delta: number }
  | { type: 'adjustOpponentLife'; label: string; delta: number }
  | { type: 'addMana'; color: ManaColor; amount: number; playerId?: PlayerId }
  | { type: 'adjustMana'; color: ManaColor; delta: number; playerId?: PlayerId }
  | { type: 'payMana'; payment: ManaPool; playerId?: PlayerId }
  | { type: 'clearManaPool'; playerId?: PlayerId }
  | { type: 'draw'; count: number; playerId?: PlayerId }
  | { type: 'mill'; count: number; playerId?: PlayerId }
  | { type: 'shuffle'; order: string[]; playerId?: PlayerId }
  | { type: 'untapAll' }
  | { type: 'discard'; cardIds: string[]; playerId?: PlayerId }
  | { type: 'putOnBottom'; cardIds: string[]; playerId?: PlayerId }
  | { type: 'playLand'; cardId: string; forced: boolean; entersTapped?: boolean; playerId?: PlayerId }
  | {
      type: 'arrangeTop';
      topOrder: string[];
      toBottom: string[];
      toGraveyard: string[];
      playerId?: PlayerId;
    }
  | { type: 'crackTreasure'; cardId: string; color: ManaColor }
  | { type: 'castSpell'; cardId: string; payment: ManaPool; forced: boolean; faceIndex?: number; playerId?: PlayerId }
  | { type: 'castCommander'; cardId: string; payment: ManaPool; forced: boolean; faceIndex?: number; playerId?: PlayerId }
  | {
      type: 'castToStack';
      cardId: string;
      payment: ManaPool;
      forced: boolean;
      faceIndex?: number;
      xValue?: number;
      playerId?: PlayerId;
    }
  | {
      type: 'addAbilityToStack';
      sourceId: string;
      kind: AbilityKind;
      abilityLineIndex?: number;
      sourceSnapshot?: ObjectSnapshot;
      targetSelections?: TargetSelection[];
      activationEnvelope?: ActivationEnvelope;
    }
  | { type: 'resolveStackTop'; to?: ZoneId; libraryShuffleOrder?: string[] }
  | { type: 'removeStackItem'; id: string; to?: ZoneId }
  | {
      type: 'setManualTargets';
      stackItemId: string;
      targetIds: string[];
      targetPlayerIds?: PlayerId[];
      allowStackAbilities?: boolean;
    }
  | { type: 'copyStackItem'; cardId: string }
  | { type: 'copyPermanent'; cardId: string; quantity: number }
  | {
      type: 'createToken';
      name: string;
      typeLine: string;
      power?: string;
      toughness?: string;
      quantity: number;
      producedMana?: ManaColor[];
      tokenKind?: 'treasure' | 'clue' | 'food' | 'blood';
      createdBy?: PlayerId;
    }
  | {
      type: 'createDefinedToken';
      name: string;
      typeLine: string;
      power?: string;
      toughness?: string;
      quantity: number;
      createdBy?: PlayerId;
      initialTapped?: boolean;
      tokenKind?: CardDef['tokenKind'];
    }
  | {
      type: 'createScenarioDummy';
      cardId: string;
      defId: string;
      playerId: PlayerId;
      name: string;
      typeLine: string;
      power?: string;
      toughness?: string;
      tapped: boolean;
      counters: Record<string, number>;
      keywords: string[];
      isToken: boolean;
    }
  | { type: 'nextPhase'; drawnHandled?: boolean }
  | { type: 'nextTurn'; advanceTurnOrder?: boolean }
  | { type: 'mulligan'; order: string[]; playerId?: PlayerId };

export interface ApplyResult {
  state: GameState;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Internal mutable working copy. We build a shallow-cloned state, mutate only
// the parts we touch (structural sharing), then return it. The input `state`
// is never mutated (I4).
// ---------------------------------------------------------------------------

interface Draft {
  state: GameState;
  warnings: string[];
  nextSeq: number;
  nextEventSeq: number;
  pendingCounterChanges: CounterChangeIntent[];
}

interface CounterChangeIntent {
  cardId: string;
  objectId: string;
  counterType: string;
  before: number;
}

type GameEventPayload =
  | Omit<ZoneChangeEvent, 'eventId' | 'sequence'>
  | Omit<DefeatAdvisoryEvent, 'eventId' | 'sequence'>
  | Omit<LifeChangeEvent, 'eventId' | 'sequence'>
  | Omit<DamageEvent, 'eventId' | 'sequence'>
  | Omit<DrawEvent, 'eventId' | 'sequence'>
  | Omit<CounterChangeEvent, 'eventId' | 'sequence'>;

const ZONE_LABELS: Record<ZoneId, string> = {
  library: 'ライブラリ',
  hand: '手札',
  battlefield: '戦場',
  graveyard: '墓地',
  exile: '追放',
  command: '統率',
  stack: 'スタック',
};

const ABILITY_KIND_LABELS: Record<AbilityKind, string> = {
  activated: '起動',
  triggered: '誘発',
};
const COLORED_MANA: readonly ManaColor[] = ['W', 'U', 'B', 'R', 'G'];
const DEFEAT_RULE_REFS: Record<DefeatReason, DefeatRuleRef> = {
  lifeZero: '704.5a',
  emptyLibraryDraw: '704.5b',
  poison: '704.5c',
  commanderDamage: '903.10a',
};
const DEFEAT_REASON_LABELS: Record<DefeatReason, string> = {
  lifeZero: 'ライフが0以下',
  emptyLibraryDraw: '空のライブラリからのドロー',
  poison: '毒カウンター10個以上',
  commanderDamage: '統率者ダメージ21点以上',
};

function emptyManaPool(): ManaPool {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
}

function cloneCombatState(combat: CombatState | null | undefined): CombatState | null {
  if (!combat) return null;
  return {
    ...combat,
    attackers: combat.attackers.map((attacker) => ({
      ...attacker,
      target: { ...attacker.target },
      blockedBy: attacker.blockedBy.slice(),
    })),
    blockers: combat.blockers.map((blocker) => ({
      ...blocker,
      blocking: blocker.blocking.slice(),
    })),
  };
}

function cloneDefeat(defeat: GameState['defeat'] | undefined): GameState['defeat'] {
  if (!defeat) return {};
  return Object.fromEntries(
    Object.entries(defeat).flatMap(([playerRef, record]) =>
      record
        ? [
            [
              playerRef,
              {
                reasons: record.reasons.slice(),
                ruleRefs: { ...record.ruleRefs },
                advisory: true,
              },
            ],
          ]
        : [],
    ),
  );
}

function cloneOncePerTurnTriggerLedger(state: GameState): GameState['oncePerTurnTriggerLedger'] {
  const ledger = (state as Partial<GameState>).oncePerTurnTriggerLedger;
  if (!ledger || ledger.turn !== state.turn || !Array.isArray(ledger.consumedKeys)) {
    return { turn: state.turn, consumedKeys: [] };
  }
  return {
    turn: state.turn,
    consumedKeys: ledger.consumedKeys.slice(),
  };
}

function resetOncePerTurnTriggerLedger(draft: Draft): void {
  draft.state.oncePerTurnTriggerLedger = {
    turn: draft.state.turn,
    consumedKeys: [],
  };
}

/** Shallow clone of state for editing. Sub-collections cloned lazily. */
function makeDraft(state: GameState): Draft {
  const maxSeq = state.log.reduce((m, e) => Math.max(m, e.seq), -1);
  const eventLog = Array.isArray(state.eventLog) ? state.eventLog : [];
  const maxEventSeq = eventLog.reduce((m, e) => Math.max(m, e.sequence), -1);
  return {
    state: {
      ...state,
      combat: cloneCombatState(state.combat),
      cards: { ...state.cards },
      zones: { ...state.zones },
      zonesByPlayer: cloneZonesByPlayer((state as Partial<GameState>).zonesByPlayer),
      manaPool: { ...state.manaPool },
      commanders: state.commanders,
      commanderDamage: { ...state.commanderDamage },
      opponentLife: { ...state.opponentLife },
      defeat: cloneDefeat(state.defeat),
      emptyLibraryDrawAttemptedSinceLastSba: {
        ...(state.emptyLibraryDrawAttemptedSinceLastSba ?? {}),
      },
      eventLog: eventLog.slice(),
      pendingTriggers: Array.isArray(state.pendingTriggers) ? state.pendingTriggers.slice() : [],
      oncePerTurnTriggerLedger: cloneOncePerTurnTriggerLedger(state),
      pendingRuleChoices: Array.isArray(state.pendingRuleChoices)
        ? state.pendingRuleChoices.slice()
        : [],
      pendingSbaChoices: Array.isArray(state.pendingSbaChoices)
        ? state.pendingSbaChoices.slice()
        : [],
      linkedExiles: { ...(state.linkedExiles ?? {}) },
      log: state.log.slice(),
    },
    warnings: [],
    nextSeq: maxSeq + 1,
    nextEventSeq: maxEventSeq + 1,
    pendingCounterChanges: [],
  };
}

function cardName(def: CardDef | undefined): string {
  if (!def) return '不明なカード';
  return def.printedName ?? def.name;
}

function nameOfCard(draft: Draft, card: CardInstance): string {
  return `《${cardName(draft.state.defs[card.defId])}》`;
}

function nameOf(draft: Draft, cardId: string): string {
  const card = draft.state.cards[cardId];
  if (!card) return '不明なカード';
  return nameOfCard(draft, card);
}

function stackNameOf(draft: Draft, card: CardInstance): string {
  if (card.isAbility && card.sourceId && draft.state.cards[card.sourceId]) {
    return nameOf(draft, card.sourceId);
  }
  return nameOfCard(draft, card);
}

function pushLog(draft: Draft, message: string): void {
  const entry: LogEntry = {
    seq: draft.nextSeq++,
    turn: draft.state.turn,
    phase: draft.state.phase,
    message,
  };
  draft.state.log = [...draft.state.log, entry];
}

function appendPendingTrigger(draft: Draft, trigger: PendingTrigger): void {
  if (
    draft.state.pendingTriggers.some(
      (existing) => existing.pendingTriggerId === trigger.pendingTriggerId,
    )
  ) {
    return;
  }
  draft.state.pendingTriggers = [...draft.state.pendingTriggers, trigger];
}

function pushEvent(draft: Draft, event: GameEventPayload): GameEvent {
  const sequence = draft.nextEventSeq++;
  const eventId = `e${sequence}`;
  switch (event.type) {
    case 'zoneChange': {
      const fullEvent: ZoneChangeEvent = {
        ...event,
        eventId,
        sequence,
      };
      draft.state.eventLog = [...draft.state.eventLog, fullEvent];
      return fullEvent;
    }
    case 'defeatAdvisory': {
      const fullEvent: DefeatAdvisoryEvent = {
        ...event,
        eventId,
        sequence,
      };
      draft.state.eventLog = [...draft.state.eventLog, fullEvent];
      return fullEvent;
    }
    case 'lifeChange': {
      const fullEvent: LifeChangeEvent = {
        ...event,
        eventId,
        sequence,
      };
      draft.state.eventLog = [...draft.state.eventLog, fullEvent];
      return fullEvent;
    }
    case 'damage': {
      const fullEvent: DamageEvent = {
        ...event,
        eventId,
        sequence,
      };
      draft.state.eventLog = [...draft.state.eventLog, fullEvent];
      return fullEvent;
    }
    case 'draw': {
      const fullEvent: DrawEvent = {
        ...event,
        eventId,
        sequence,
      };
      draft.state.eventLog = [...draft.state.eventLog, fullEvent];
      return fullEvent;
    }
    case 'counterChange': {
      const fullEvent: CounterChangeEvent = {
        ...event,
        eventId,
        sequence,
      };
      draft.state.eventLog = [...draft.state.eventLog, fullEvent];
      return fullEvent;
    }
  }
}

function requireCard(draft: Draft, cardId: string): CardInstance {
  const card = draft.state.cards[cardId];
  if (!card) {
    throw new EngineError(`カードが存在しません: ${cardId}`);
  }
  return card;
}

/** Replace a card instance in the draft (clones the cards map entry). */
function setCard(draft: Draft, card: CardInstance): void {
  draft.state.cards = { ...draft.state.cards, [card.id]: card };
}

function isPrivateZone(zone: ZoneId): zone is PrivateZoneId {
  return zone === 'library' || zone === 'hand' || zone === 'graveyard';
}

function privateZonesFor(draft: Draft, playerId: PlayerId): PlayerPrivateZones {
  requirePlayer(draft.state, playerId);
  const zones = draft.state.zonesByPlayer[playerId];
  if (!zones) {
    throw new EngineError(`プレイヤーのprivate zoneが存在しません: ${playerId}`);
  }
  return zones;
}

function readZone(draft: Draft, zone: ZoneId, playerId = draft.state.localPlayerId): string[] {
  return isPrivateZone(zone) ? privateZonesFor(draft, playerId)[zone] : draft.state.zones[zone];
}

/** Get a mutable clone of a zone array, installing it into the draft. */
function editZone(draft: Draft, zone: ZoneId, playerId = draft.state.localPlayerId): string[] {
  if (!isPrivateZone(zone)) {
    const arr = draft.state.zones[zone].slice();
    draft.state.zones = { ...draft.state.zones, [zone]: arr };
    return arr;
  }

  const playerZones = clonePlayerPrivateZones(privateZonesFor(draft, playerId));
  const arr = playerZones[zone];
  draft.state.zonesByPlayer = {
    ...draft.state.zonesByPlayer,
    [playerId]: playerZones,
  };
  if (playerId === draft.state.localPlayerId) {
    draft.state.zones = { ...draft.state.zones, [zone]: arr };
  }
  return arr;
}

function removeFromCurrentZone(draft: Draft, cardId: string): ZoneId {
  const card = draft.state.cards[cardId];
  const from = card.zone;
  let zonePlayerId = draft.state.localPlayerId;
  if (isPrivateZone(from)) {
    const ownerZones = privateZonesFor(draft, card.ownerId);
    if (!ownerZones[from].includes(cardId)) {
      const containingPlayer = Object.entries(draft.state.zonesByPlayer).find(([, zones]) =>
        zones[from].includes(cardId),
      );
      if (containingPlayer) zonePlayerId = containingPlayer[0];
      else zonePlayerId = card.ownerId;
    } else {
      zonePlayerId = card.ownerId;
    }
  }
  const arr = editZone(draft, from, zonePlayerId);
  const idx = arr.indexOf(cardId);
  if (idx >= 0) arr.splice(idx, 1);
  return from;
}

function deleteCardFromState(draft: Draft, cardId: string): ZoneId {
  const from = removeFromCurrentZone(draft, cardId);
  const cards = { ...draft.state.cards };
  delete cards[cardId];

  for (const [id, card] of Object.entries(cards)) {
    if (!card.isAbility || card.sourceId !== cardId) continue;
    const stack = editZone(draft, 'stack');
    const idx = stack.indexOf(id);
    if (idx >= 0) stack.splice(idx, 1);
    delete cards[id];
  }

  draft.state.cards = cards;
  return from;
}

function insertIntoZone(arr: string[], cardId: string, position: 'top' | 'bottom' | number): void {
  if (position === 'top') {
    arr.unshift(cardId);
  } else if (position === 'bottom') {
    arr.push(cardId);
  } else {
    const clamped = Math.max(0, Math.min(position, arr.length));
    arr.splice(clamped, 0, cardId);
  }
}

/** Reset card state on a true zone change (not same-zone reordering). */
function resetCardForZoneChange(
  card: CardInstance,
  to: ZoneId,
  options: { preserveFace?: boolean } = {},
): CardInstance {
  return {
    ...card,
    zone: to,
    zoneChangeCounter: card.zoneChangeCounter + 1,
    tapped: false,
    faceDown: false,
    faceIndex: options.preserveFace ? card.faceIndex : 0,
    counters: {},
    damageMarked: 0,
    hasDeathtouchDamage: false,
    attachedTo: undefined,
    enteredTurn: 0,
    // CR 400.7: a true zone change creates a new object with no memory of
    // targets chosen for the spell/object in its previous zone. In particular,
    // unchecked manual stack annotations must not reappear after resolve/recast.
    targetSelections: undefined,
    announcedX: undefined,
  };
}

function currentFaceOf(draft: Draft, card: CardInstance) {
  const def = draft.state.defs[card.defId];
  return def?.faces[card.faceIndex] ?? def?.faces[0];
}

function printedTypeLineOf(draft: Draft, card: CardInstance): string {
  const def = draft.state.defs[card.defId];
  const face = currentFaceOf(draft, card);
  return (face?.typeLine ?? def?.typeLine ?? '').toString();
}

function stateWithCardForTypeRead(state: GameState, card: CardInstance): GameState {
  if (state.cards[card.id] === card) {
    return state;
  }
  return { ...state, cards: { ...state.cards, [card.id]: card } };
}

function typeLineOf(draft: Draft, card: CardInstance): string {
  return effectiveTypeLine(stateWithCardForTypeRead(draft.state, card), card.id);
}

function manaValueOfStackObject(card: CardInstance, manaCost: string | undefined, baseManaValue: number | undefined) {
  if (card.zone !== 'stack' || card.announcedX === undefined) return baseManaValue;
  const xSymbols = parseManaCost(manaCost ?? '').x;
  return (baseManaValue ?? 0) + xSymbols * card.announcedX;
}

function objectSnapshotOf(draft: Draft, card: CardInstance): ObjectSnapshot {
  const def = draft.state.defs[card.defId];
  const face = def?.faces[card.faceIndex] ?? def?.faces[0];
  const ownerId = card.ownerId ?? 'P1';
  const controllerId = card.controllerId ?? ownerId;
  return {
    physicalCardId: card.id,
    objectId: objectIdOf(card),
    defId: card.defId,
    zone: card.zone,
    ownerId,
    controllerId,
    isToken: card.isToken,
    isScenarioDummy: card.isScenarioDummy,
    isCommander: card.isCommander,
    faceIndex: card.faceIndex,
    tapped: card.tapped,
    counters: { ...card.counters },
    typeLine: printedTypeLineOf(draft, card),
    manaValue: manaValueOfStackObject(card, face?.manaCost, def?.cmc),
    power: face?.power,
    toughness: face?.toughness,
  };
}

export function objectSnapshotForCard(state: GameState, cardId: string): ObjectSnapshot | null {
  const card = state.cards[cardId];
  if (!card) {
    return null;
  }
  const def = state.defs[card.defId];
  const face = def?.faces[card.faceIndex] ?? def?.faces[0];
  const ownerId = card.ownerId ?? 'P1';
  const controllerId = card.controllerId ?? ownerId;
  return {
    physicalCardId: card.id,
    objectId: objectIdOf(card),
    defId: card.defId,
    zone: card.zone,
    ownerId,
    controllerId,
    isToken: card.isToken,
    isScenarioDummy: card.isScenarioDummy,
    isCommander: card.isCommander,
    faceIndex: card.faceIndex,
    tapped: card.tapped,
    counters: { ...card.counters },
    typeLine: (face?.typeLine ?? def?.typeLine ?? '').toString(),
    manaValue: manaValueOfStackObject(card, face?.manaCost, def?.cmc),
    power: face?.power,
    toughness: face?.toughness,
  };
}

function effectiveToughnessForSba(draft: Draft, card: CardInstance): number | null {
  const face = currentFaceOf(draft, card);
  const baseToughness = Number.parseInt(face?.toughness ?? '', 10);
  if (Number.isNaN(baseToughness)) {
    return null;
  }

  return baseToughness + (card.counters['+1/+1'] ?? 0) - (card.counters['-1/-1'] ?? 0);
}

function markedDamageOf(card: CardInstance): number {
  return typeof card.damageMarked === 'number' && Number.isFinite(card.damageMarked)
    ? Math.max(0, card.damageMarked)
    : 0;
}

function hasDeathtouchDamage(card: CardInstance): boolean {
  return card.hasDeathtouchDamage === true;
}

function pushZoneChangeEvent(
  draft: Draft,
  before: ObjectSnapshot,
  after: ObjectSnapshot | undefined,
  fromZone: ZoneId,
  toZone: ZoneId | undefined,
  reason: ZoneChangeReason,
  options?: Pick<ZoneChangeEvent, 'replacementApplied' | 'sbaApplied' | 'simultaneousGroupId'>,
): ZoneChangeEvent {
  return pushEvent(draft, {
    type: 'zoneChange',
    reason,
    physicalCardId: before.physicalCardId,
    oldObjectId: before.objectId,
    newObjectId: after?.objectId,
    fromZone,
    toZone,
    ...options,
    before,
    after,
  }) as ZoneChangeEvent;
}

function pushDefeatAdvisoryEvent(
  draft: Draft,
  playerRef: DefeatPlayerRef,
  defeatReason: DefeatReason,
  simultaneousGroupId: string,
): void {
  pushEvent(draft, {
    type: 'defeatAdvisory',
    reason: 'sba',
    sbaApplied: DEFEAT_RULE_REFS[defeatReason],
    simultaneousGroupId,
    playerRef,
    defeatReason,
    advisory: true,
  } satisfies Omit<DefeatAdvisoryEvent, 'eventId' | 'sequence'>);
}

function commandCause(commandType: GameCommand['type']): EventCause {
  return { type: 'command', commandType };
}

function pushLifeChangeEvent(
  draft: Draft,
  playerId: PlayerId,
  previousLife: number,
  nextLife: number,
  cause: EventCause,
  options?: Pick<LifeChangeEvent, 'lifeLabel' | 'source' | 'sourceEventId' | 'causeEventId'>,
): LifeChangeEvent | null {
  const delta = nextLife - previousLife;
  if (delta === 0) {
    return null;
  }

  return pushEvent(draft, {
    type: 'lifeChange',
    playerId,
    delta,
    previousLife,
    nextLife,
    direction: delta > 0 ? 'gain' : 'loss',
    cause,
    ...options,
  } satisfies Omit<LifeChangeEvent, 'eventId' | 'sequence'>) as LifeChangeEvent;
}

function pushDrawEvent(
  draft: Draft,
  playerId: PlayerId,
  result: 'drawn' | 'empty-library-attempt',
  drawOrdinal: number,
  cause: EventCause,
  zoneChangeEvent?: ZoneChangeEvent,
): void {
  pushEvent(draft, {
    type: 'draw',
    playerId,
    result,
    drawOrdinal,
    cause,
    ...(zoneChangeEvent
      ? {
          physicalCardId: zoneChangeEvent.physicalCardId,
          oldObjectId: zoneChangeEvent.oldObjectId,
          newObjectId: zoneChangeEvent.newObjectId,
          zoneChangeEventId: zoneChangeEvent.eventId,
          before: zoneChangeEvent.before,
          after: zoneChangeEvent.after,
        }
      : {}),
  } satisfies Omit<DrawEvent, 'eventId' | 'sequence'>);
}

function objectSourceRefForCard(draft: Draft, card: CardInstance): EventSourceRef {
  const snapshot = objectSnapshotOf(draft, card);
  return {
    kind: 'object',
    physicalCardId: snapshot.physicalCardId,
    objectId: snapshot.objectId,
    snapshot,
  };
}

function objectTargetRefForCard(draft: Draft, card: CardInstance): EventTargetRef {
  const snapshot = objectSnapshotOf(draft, card);
  return {
    kind: 'object',
    physicalCardId: snapshot.physicalCardId,
    objectId: snapshot.objectId,
    snapshot,
  };
}

function recordCounterChangeIntent(
  draft: Draft,
  card: CardInstance,
  counterType: string,
  before: number,
): void {
  draft.pendingCounterChanges.push({
    cardId: card.id,
    objectId: objectIdOf(card),
    counterType,
    before,
  });
}

function finalCounterValueForIntent(draft: Draft, intent: CounterChangeIntent): number {
  const card = draft.state.cards[intent.cardId];
  if (!card || objectIdOf(card) !== intent.objectId) {
    return 0;
  }
  return card.counters[intent.counterType] ?? 0;
}

function flushCounterChangeEvents(draft: Draft): void {
  if (draft.pendingCounterChanges.length === 0) {
    return;
  }
  const intents = draft.pendingCounterChanges;
  draft.pendingCounterChanges = [];

  for (const intent of intents) {
    const after = finalCounterValueForIntent(draft, intent);
    const delta = after - intent.before;
    if (delta === 0) {
      continue;
    }
    const target = draft.state.cards[intent.cardId];
    if (!target || objectIdOf(target) !== intent.objectId) {
      continue;
    }
    pushEvent(draft, {
      type: 'counterChange',
      target: objectTargetRefForCard(draft, target),
      counterType: intent.counterType,
      delta,
      before: intent.before,
      after,
    } satisfies Omit<CounterChangeEvent, 'eventId' | 'sequence'>);
  }
}

function playerTargetRef(draft: Draft, playerId: PlayerId): EventTargetRef {
  const player = requirePlayer(draft.state, playerId);
  return playerId === draft.state.localPlayerId
    ? { kind: 'player', playerId }
    : { kind: 'player', playerId, lifeLabel: player.label };
}

function pushDamageEvent(
  draft: Draft,
  source: EventSourceRef,
  target: EventTargetRef,
  amount: number,
  combatDamage: boolean,
  cause: EventCause,
): DamageEvent {
  return pushEvent(draft, {
    type: 'damage',
    source,
    target,
    amount,
    combatDamage,
    cause,
  } satisfies Omit<DamageEvent, 'eventId' | 'sequence'>) as DamageEvent;
}

function setDamageResultEventIds(
  draft: Draft,
  damageEventId: string,
  damageResultEventIds: string[],
): void {
  const index = draft.state.eventLog.findIndex(
    (event) => event.type === 'damage' && event.eventId === damageEventId,
  );
  if (index < 0) {
    return;
  }

  const event = draft.state.eventLog[index];
  if (event.type !== 'damage') {
    return;
  }

  draft.state.eventLog = [
    ...draft.state.eventLog.slice(0, index),
    { ...event, damageResultEventIds },
    ...draft.state.eventLog.slice(index + 1),
  ];
}

function playerDefeatLabel(playerRef: DefeatPlayerRef): string {
  if (playerRef === 'P1') return 'あなた';
  return playerRef.slice('opponent:'.length);
}

function addDefeatAdvisory(
  draft: Draft,
  playerRef: DefeatPlayerRef,
  reason: DefeatReason,
  simultaneousGroupId: string,
): boolean {
  const existing = draft.state.defeat[playerRef];
  if (existing?.reasons.includes(reason)) {
    return false;
  }

  const nextRecord = {
    reasons: [...(existing?.reasons ?? []), reason],
    ruleRefs: {
      ...(existing?.ruleRefs ?? {}),
      [reason]: DEFEAT_RULE_REFS[reason],
    },
    advisory: true,
  } satisfies NonNullable<GameState['defeat'][DefeatPlayerRef]>;

  draft.state.defeat = {
    ...draft.state.defeat,
    [playerRef]: nextRecord,
  };
  pushDefeatAdvisoryEvent(draft, playerRef, reason, simultaneousGroupId);

  const message = `${playerDefeatLabel(playerRef)}は${DEFEAT_REASON_LABELS[reason]}のため敗北条件を満たしました(警告のみ)。`;
  draft.warnings.push(message);
  pushLog(draft, message);
  return true;
}

function applyBattlefieldEntryEffects(draft: Draft, card: CardInstance): CardInstance {
  const face = currentFaceOf(draft, card);
  const counters = { ...card.counters };
  const typeLine = typeLineOf(draft, card);

  if (typeLine.includes('Planeswalker') && typeof face?.loyalty === 'string') {
    const loyalty = Number.parseInt(face.loyalty, 10);
    if (!Number.isNaN(loyalty)) {
      counters.loyalty = loyalty;
    }
  }

  if (typeLine.includes('Saga')) {
    counters.lore = 1;
    pushLog(draft, `${nameOfCard(draft, card)}は第I章で戦場に出た。`);
  }

  return {
    ...card,
    enteredTurn: draft.state.turn,
    counters,
  };
}

function nameForLegendRule(draft: Draft, card: CardInstance): string {
  const def = draft.state.defs[card.defId];
  const face = currentFaceOf(draft, card);
  return face?.name ?? def?.name ?? card.defId;
}

function isLegendaryPermanent(draft: Draft, card: CardInstance): boolean {
  return card.zone === 'battlefield' && /\bLegendary\b/i.test(typeLineOf(draft, card));
}

function legendRuleChoiceId(
  controllerId: LegendRuleChoice['controllerId'],
  name: string,
  cardIds: readonly string[],
): string {
  return `704.5j:${controllerId}:${name}:${cardIds.slice().sort().join(',')}`;
}

function pendingLegendRuleChoices(draft: Draft): LegendRuleChoice[] {
  const groups = new Map<
    string,
    { controllerId: LegendRuleChoice['controllerId']; name: string; cardIds: string[] }
  >();

  for (const card of Object.values(draft.state.cards)) {
    if (!isLegendaryPermanent(draft, card)) continue;
    const controllerId = card.controllerId;
    const name = nameForLegendRule(draft, card);
    const key = `${controllerId}\u0000${name}`;
    const group = groups.get(key) ?? { controllerId, name, cardIds: [] };
    group.cardIds.push(card.id);
    groups.set(key, group);
  }

  return [...groups.values()]
    .filter((group) => group.cardIds.length >= 2)
    .map((group) => {
      const cardIds = group.cardIds.slice().sort();
      return {
        choiceId: legendRuleChoiceId(group.controllerId, group.name, cardIds),
        kind: 'legend-rule',
        ruleRef: '704.5j',
        controllerId: group.controllerId,
        name: group.name,
        cardIds,
      } satisfies LegendRuleChoice;
    })
    .sort((left, right) => left.choiceId.localeCompare(right.choiceId));
}

function appendPendingRuleChoices(draft: Draft, choices: readonly LegendRuleChoice[]): boolean {
  if (choices.length === 0) return false;

  const existingIds = new Set(draft.state.pendingRuleChoices.map((choice) => choice.choiceId));
  const additions = choices.filter((choice) => !existingIds.has(choice.choiceId));
  if (additions.length === 0) return false;

  draft.state.pendingRuleChoices = [...draft.state.pendingRuleChoices, ...additions];
  return true;
}

/** Core move. Handles disappearance rules, state reset, and destination ordering. */
function moveCardInternal(
  draft: Draft,
  cardId: string,
  to: ZoneId,
  position: 'top' | 'bottom' | number,
  log: boolean,
  reason: ZoneChangeReason = 'move',
  eventOptions?: Pick<ZoneChangeEvent, 'replacementApplied' | 'sbaApplied' | 'simultaneousGroupId'>,
): ZoneChangeEvent | undefined {
  const card = requireCard(draft, cardId);
  // CR 614.1a/614.5/614.6 (design-lock §34.35): the Emet-Selch-family static
  // replacement rewrites a graveyard-bound destination to exile ONCE, up front —
  // every graveyard path in the engine funnels through this function (mill, discard,
  // surveil, sacrifice, destroy, SBA death all verified), so this single gate is
  // complete. Rewriting `to` before anything below runs means dies-triggers
  // (battlefield→graveyard) correctly never see the replaced event, and no code
  // after this line needs to know a replacement happened beyond the event marker.
  // Commanders are exempt (Tier-1 finding): the store's CR 903.9a zone-choice flow
  // detects the graveyard-bound event AFTER this function runs, and rewriting here
  // would silently suppress that already-shipped prompt. Full CR 616.1 ordering
  // (owner chooses which replacement applies first) is the domain's declared
  // boundary; failing toward the pre-existing commander behavior is least-surprise.
  if (
    to === 'graveyard' &&
    !isCommander(draft.state, cardId) &&
    graveyardToExileReplacementActive(draft.state, card.ownerId ?? 'P1')
  ) {
    to = 'exile';
    eventOptions = {
      ...eventOptions,
      replacementApplied: eventOptions?.replacementApplied ?? '614.6:grave-to-exile',
    };
  }
  const from = card.zone;
  const sameZone = from === to;

  if (card.isAbility && to !== 'stack') {
    const name = stackNameOf(draft, card);
    let zoneChangeEvent: ZoneChangeEvent | undefined;
    if (!sameZone) {
      zoneChangeEvent = pushZoneChangeEvent(
        draft,
        objectSnapshotOf(draft, card),
        undefined,
        from,
        to,
        reason,
        eventOptions,
      );
    }
    deleteCardFromState(draft, cardId);
    if (log) {
      pushLog(draft, `${name}の能力が${ZONE_LABELS[to]}へ移動したため消滅しました。`);
    }
    return zoneChangeEvent;
  }

  if (card.isCopy) {
    if (!sameZone && to !== 'battlefield') {
      const name = nameOfCard(draft, card);
      const before = objectSnapshotOf(draft, card);
      const after = objectSnapshotOf(draft, resetCardForZoneChange(card, to));
      const zoneChangeEvent = pushZoneChangeEvent(
        draft,
        before,
        after,
        from,
        to,
        reason,
        eventOptions,
      );
      deleteCardFromState(draft, cardId);
      if (log) {
        pushLog(draft, `コピー${name}は消滅した。`);
      }
      return zoneChangeEvent;
    }
  }

  removeFromCurrentZone(draft, cardId);
  const destinationPlayerId = isPrivateZone(to) ? card.ownerId : draft.state.localPlayerId;
  const dest = editZone(draft, to, destinationPlayerId);

  // battlefield destination always appended (UI manages order otherwise).
  const effectivePosition: 'top' | 'bottom' | number = to === 'battlefield' ? 'bottom' : position;
  insertIntoZone(dest, cardId, effectivePosition);

  const before = sameZone ? undefined : objectSnapshotOf(draft, card);
  // CR 712.8c/712.8f/712.11b: the chosen face is an intrinsic characteristic
  // of a double-faced spell on the stack and of the permanent it becomes.
  // Other true zone changes still reset the physical card to its front face.
  const preserveFace =
    !sameZone && ((reason === 'cast' && (to === 'stack' || to === 'battlefield'))
      || (reason === 'resolve' && from === 'stack' && to === 'battlefield'));
  let updated = sameZone
    ? { ...card, zone: to }
    : resetCardForZoneChange(card, to, { preserveFace });
  if (!sameZone && to === 'battlefield') {
    updated = applyBattlefieldEntryEffects(draft, updated);
    if (card.isCopy) {
      updated = {
        ...updated,
        isToken: true,
        isCopy: false,
      };
    }
  }
  setCard(draft, updated);
  let zoneChangeEvent: ZoneChangeEvent | undefined;
  if (!sameZone && before) {
    zoneChangeEvent = pushZoneChangeEvent(
      draft,
      before,
      objectSnapshotOf(draft, updated),
      from,
      to,
      reason,
      eventOptions,
    );
  }

  if (log && !sameZone) {
    pushLog(
      draft,
      `${nameOf(draft, cardId)}を${ZONE_LABELS[from]}から${ZONE_LABELS[to]}へ移動しました。`,
    );
  }
  return zoneChangeEvent;
}

type MoveCardCommand = Extract<GameCommand, { type: 'moveCard' }>;
type DealDamageCommand = Extract<GameCommand, { type: 'dealDamage' }>;

function zoneChangeEventOptionsForMove(
  cmd: MoveCardCommand,
): Pick<ZoneChangeEvent, 'replacementApplied' | 'sbaApplied' | 'simultaneousGroupId'> {
  return {
    ...(cmd.replacementApplied === undefined ? {} : { replacementApplied: cmd.replacementApplied }),
    ...(cmd.sbaApplied === undefined ? {} : { sbaApplied: cmd.sbaApplied }),
    ...(cmd.simultaneousGroupId === undefined
      ? {}
      : { simultaneousGroupId: cmd.simultaneousGroupId }),
  };
}

function currentCardMatchesObject(
  draft: Draft,
  physicalCardId: string,
  zone: ZoneId,
  objectId: string,
): boolean {
  const current = draft.state.cards[physicalCardId];
  return current !== undefined && current.zone === zone && objectIdOf(current) === objectId;
}

function deleteLinkedExileRecord(draft: Draft, linkId: string): void {
  if (!draft.state.linkedExiles[linkId]) {
    return;
  }
  const linkedExiles = { ...draft.state.linkedExiles };
  delete linkedExiles[linkId];
  draft.state.linkedExiles = linkedExiles;
}

function writeLinkedExileRecordFromEvent(
  draft: Draft,
  event: ZoneChangeEvent | undefined,
  write: LinkedExileWrite,
): LinkedExileRecord | null {
  if (
    !event ||
    event.toZone !== 'exile' ||
    !event.after ||
    !event.newObjectId ||
    !currentCardMatchesObject(draft, event.physicalCardId, 'exile', event.newObjectId)
  ) {
    draft.warnings.push(
      'linked exile record は、実際に追放された現在のオブジェクトからだけ作成できます。',
    );
    return null;
  }

  const record: LinkedExileRecord = {
    linkId: write.linkId,
    purpose: write.purpose,
    sourceObjectId: write.sourceObjectId,
    sourcePhysicalId: write.sourcePhysicalId,
    exiledPhysicalIds: [event.physicalCardId],
    exiledObjectIds: [event.newObjectId],
    snapshot: event.before,
    createdSequence: event.sequence,
  };
  draft.state.linkedExiles = {
    ...draft.state.linkedExiles,
    [write.linkId]: record,
  };
  return record;
}

function returnTemporaryLinkedExileInDraft(draft: Draft, linkId: string): void {
  const record = draft.state.linkedExiles[linkId];
  if (!record) {
    draft.warnings.push(`linked exile record が存在しません: ${linkId}`);
    return;
  }
  if (record.purpose !== 'temporary-return') {
    draft.warnings.push(`temporary-return ではない linked exile record は戻せません: ${linkId}`);
    return;
  }

  const physicalCardId = record.exiledPhysicalIds[0];
  const exiledObjectId = record.exiledObjectIds[0];
  if (!physicalCardId || !exiledObjectId) {
    draft.warnings.push(`linked exile record に戻す対象がありません: ${linkId}`);
    deleteLinkedExileRecord(draft, linkId);
    return;
  }

  if (!currentCardMatchesObject(draft, physicalCardId, 'exile', exiledObjectId)) {
    draft.warnings.push(`linked exile の対象は現在の追放オブジェクトではありません: ${linkId}`);
    deleteLinkedExileRecord(draft, linkId);
    return;
  }

  const zoneChangeEvent = moveCardInternal(
    draft,
    physicalCardId,
    'battlefield',
    'bottom',
    true,
    'resolve',
  );
  const returned = draft.state.cards[physicalCardId];
  if (zoneChangeEvent?.toZone === 'battlefield' && returned) {
    setCard(draft, { ...returned, controllerId: returned.ownerId });
  }
  deleteLinkedExileRecord(draft, linkId);
}

function applyMoveCardCommand(draft: Draft, cmd: MoveCardCommand): void {
  requireCard(draft, cmd.cardId);
  const zoneChangeEvent = moveCardInternal(
    draft,
    cmd.cardId,
    cmd.to,
    cmd.position,
    true,
    cmd.reason ?? 'move',
    zoneChangeEventOptionsForMove(cmd),
  );
  if (!cmd.linkedExileWrite) {
    return;
  }

  const record = writeLinkedExileRecordFromEvent(draft, zoneChangeEvent, cmd.linkedExileWrite);
  if (record?.purpose === 'temporary-return') {
    returnTemporaryLinkedExileInDraft(draft, record.linkId);
  }
}

function applyMarkDamage(draft: Draft, cardId: string, amount: number, deathtouch?: boolean): void {
  const card = requireCard(draft, cardId);
  const markedAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const nextDamage = markedDamageOf(card) + markedAmount;
  const nextHasDeathtouchDamage =
    hasDeathtouchDamage(card) || (deathtouch === true && markedAmount > 0);

  if (nextDamage === card.damageMarked && nextHasDeathtouchDamage === card.hasDeathtouchDamage) {
    return;
  }

  setCard(draft, {
    ...card,
    damageMarked: nextDamage,
    hasDeathtouchDamage: nextHasDeathtouchDamage,
  });

  if (markedAmount > 0) {
    const deathtouchLabel = deathtouch === true ? '(接死)' : '';
    pushLog(
      draft,
      `${nameOf(draft, cardId)}に${markedAmount}点のダメージ${deathtouchLabel}を記録しました。`,
    );
  }
}

function normalizedDamageAmount(amount: number): number {
  return Number.isFinite(amount) ? amount : 0;
}

function applyDealDamage(draft: Draft, cmd: DealDamageCommand): void {
  const amount = normalizedDamageAmount(cmd.amount);
  if (amount <= 0) {
    return;
  }

  if (cmd.targetCardId !== undefined && cmd.targetPlayerId !== undefined) {
    throw new EngineError('ダメージの対象がカードとプレイヤーの両方に指定されています。');
  }

  const sourceCard = requireCard(draft, cmd.sourceId);
  const source = objectSourceRefForCard(draft, sourceCard);
  const cause = commandCause(cmd.type);
  // CR 615.1/615.1a/615.6: a prevention shield stops the damage event from having its
  // effect, but the event itself may still be observed (advisory). Only combat damage is
  // ever gated here — see docs/engine-spec.md §34.34 (exact-phrase gate covers only the
  // global "prevent all combat damage this turn" shape).
  const prevented = cmd.combatDamage && draft.state.combatDamagePreventedUntilEndOfTurn;

  if (cmd.targetCardId !== undefined) {
    const targetCard = requireCard(draft, cmd.targetCardId);
    if (typeLineOf(draft, targetCard).includes('Planeswalker')) {
      // CR 120.3c: planeswalker への忠誠カウンター除去はこのスライスの対象外(サイレント誤マークを防ぐ)。
      throw new EngineError('プレースウォーカーへのダメージはこのスライスでは未対応です。');
    }
    pushDamageEvent(
      draft,
      source,
      objectTargetRefForCard(draft, targetCard),
      amount,
      cmd.combatDamage,
      cause,
    );
    if (prevented) {
      pushLog(draft, `${nameOf(draft, targetCard.id)}への戦闘ダメージ${amount}点を防いだ。`);
      return;
    }
    applyMarkDamage(draft, targetCard.id, amount, cmd.deathtouch);
    return;
  }

  if (cmd.targetPlayerId === undefined) {
    throw new EngineError('ダメージの対象が指定されていません。');
  }

  const damageEvent = pushDamageEvent(
    draft,
    source,
    playerTargetRef(draft, cmd.targetPlayerId),
    amount,
    cmd.combatDamage,
    cause,
  );
  if (prevented) {
    pushLog(draft, `${cmd.targetPlayerId}への戦闘ダメージ${amount}点を防いだ。`);
    return;
  }
  const resultCause = {
    type: 'event',
    eventId: damageEvent.eventId,
    eventType: 'damage',
  } satisfies EventCause;
  const resultOptions = {
    source,
    causeEventId: damageEvent.eventId,
  } satisfies Pick<LifeChangeEvent, 'source' | 'causeEventId'>;
  const resultEvent = applyLifeDeltaForPlayer(
    draft,
    cmd.targetPlayerId,
    -amount,
    resultCause,
    resultOptions,
  );

  if (resultEvent) {
    setDamageResultEventIds(draft, damageEvent.eventId, [resultEvent.eventId]);
  }
}

function applyAddCounters(
  draft: Draft,
  cardId: string,
  counterType: string,
  delta: number,
): void {
  const target = requireCard(draft, cardId);
  const current = target.counters[counterType] ?? 0;
  const next = Math.max(0, current + delta);
  const counters = { ...target.counters };
  if (next === 0) {
    delete counters[counterType];
  } else {
    counters[counterType] = next;
  }
  setCard(draft, { ...target, counters });
  recordCounterChangeIntent(draft, target, counterType, current);
  pushLog(draft, `${nameOf(draft, cardId)}の${counterType}カウンターを${next}個にしました。`);
}

function clearMarkedDamageInternal(draft: Draft, cardId?: string): boolean {
  const cardIds =
    cardId === undefined
      ? draft.state.zones.battlefield.filter((id) => {
          const card = draft.state.cards[id];
          return card && typeLineOf(draft, card).includes('Creature');
        })
      : [requireCard(draft, cardId).id];

  let changed = false;
  for (const id of cardIds) {
    const card = draft.state.cards[id];
    if (!card) continue;
    if (markedDamageOf(card) === 0 && !hasDeathtouchDamage(card)) continue;
    setCard(draft, {
      ...card,
      damageMarked: 0,
      hasDeathtouchDamage: false,
    });
    changed = true;
  }

  return changed;
}

function applyClearMarkedDamage(draft: Draft, cardId?: string): void {
  if (clearMarkedDamageInternal(draft, cardId)) {
    pushLog(draft, 'クリーチャーのダメージ記録を消しました。');
  }
}

function applyLifeDeltaForPlayer(
  draft: Draft,
  playerId: PlayerId,
  delta: number,
  cause: EventCause,
  options?: Pick<LifeChangeEvent, 'lifeLabel' | 'source' | 'sourceEventId' | 'causeEventId'>,
): LifeChangeEvent | null {
  const player = requirePlayer(draft.state, playerId);
  const previousLife =
    playerId === draft.state.localPlayerId ? draft.state.life : player.life;
  const nextLife = previousLife + delta;
  if (playerId === draft.state.localPlayerId) {
    draft.state.life = nextLife;
  } else {
    draft.state.players = {
      ...draft.state.players,
      [playerId]: { ...player, life: nextLife },
    };
    draft.state.opponentLife = {
      ...draft.state.opponentLife,
      [player.label]: nextLife,
    };
  }
  const event = pushLifeChangeEvent(draft, playerId, previousLife, nextLife, cause, {
    ...(playerId === draft.state.localPlayerId ? {} : { lifeLabel: player.label }),
    ...options,
  });
  const sign = delta >= 0 ? '+' : '';
  const subject = playerId === draft.state.localPlayerId ? '' : `${player.label}の`;
  pushLog(draft, `${subject}ライフが${sign}${delta}(現在${nextLife})。`);
  return event;
}

function applyOpponentLifeDelta(
  draft: Draft,
  label: string,
  delta: number,
  cause: EventCause,
  options?: Pick<LifeChangeEvent, 'source' | 'sourceEventId' | 'causeEventId'>,
): LifeChangeEvent | null {
  const playerId = playerIdForLifeLabel(label);
  if (!draft.state.players[playerId]) {
    draft.state.opponentLife = {
      ...draft.state.opponentLife,
      [label]: draft.state.opponentLife[label] ?? 40,
    };
    draft.state = syncDerivedViews(draft.state);
  }
  return applyLifeDeltaForPlayer(draft, playerId, delta, cause, { ...options, lifeLabel: label });
}

function applyPlayerCounterDelta(
  draft: Draft,
  playerId: PlayerId,
  kind: 'poison' | 'energy' | 'experience',
  delta: number,
): void {
  const player = requirePlayer(draft.state, playerId);
  const next = Math.max(0, player[kind] + delta);
  if (playerId === draft.state.localPlayerId) {
    draft.state[kind] = next;
  } else {
    draft.state.players = {
      ...draft.state.players,
      [playerId]: { ...player, [kind]: next },
    };
  }
  const label = kind === 'poison' ? '毒' : kind === 'energy' ? 'エネルギー' : '経験';
  const subject = playerId === draft.state.localPlayerId ? '' : `${player.label}の`;
  pushLog(draft, `${subject}${label}カウンターを${next}個にしました。`);
}

// ---------------------------------------------------------------------------
// Combat handling (CR 506-510 first slice)
// ---------------------------------------------------------------------------

function defaultDefendingPlayer(state: GameState, attackingPlayerId: PlayerId): PlayerId {
  const attackingIndex = state.turnOrder.indexOf(attackingPlayerId);
  if (attackingIndex < 0) {
    throw new EngineError(`攻撃プレイヤーがturnOrderに存在しません: ${attackingPlayerId}`);
  }
  return state.turnOrder[(attackingIndex + 1) % state.turnOrder.length] ?? state.localPlayerId;
}

function defaultCombatTarget(defendingPlayerId: PlayerId): CombatTarget {
  return { type: 'player', playerId: defendingPlayerId };
}

function nextCombatId(draft: Draft): string {
  return `combat-${draft.state.turn}-${draft.nextSeq}`;
}

function requireCombat(draft: Draft): CombatState {
  const combat = draft.state.combat;
  if (!combat || draft.state.phase !== 'combat') {
    throw new EngineError('戦闘が開始されていません。');
  }
  return combat;
}

function isBattlefieldCreature(draft: Draft, card: CardInstance): boolean {
  return card.zone === 'battlefield' && typeLineOf(draft, card).includes('Creature');
}

function warnIfNotBattlefieldCreature(draft: Draft, card: CardInstance): void {
  if (isBattlefieldCreature(draft, card)) return;
  draft.warnings.push(`${nameOfCard(draft, card)}は戦場のクリーチャーではありません。`);
}

function liveCombatCreature(
  draft: Draft,
  cardId: string,
  declaredObjectId: string,
): CardInstance | null {
  const card = draft.state.cards[cardId];
  if (!card || !isBattlefieldCreature(draft, card) || objectIdOf(card) !== declaredObjectId) {
    return null;
  }
  return card;
}

function sourceHasDeathtouch(draft: Draft, cardId: string): boolean {
  return effectiveKeywords(draft.state, cardId).includes('deathtouch');
}

interface CombatPlayerDamageTotal {
  target: CombatTarget;
  amount: number;
}

function addCombatPlayerDamage(
  totals: Map<string, CombatPlayerDamageTotal>,
  target: CombatTarget,
  amount: number,
): void {
  if (amount <= 0) return;
  const existing = totals.get(target.playerId);
  totals.set(target.playerId, {
    target: { ...target },
    amount: (existing?.amount ?? 0) + amount,
  });
}

function applyCombatPlayerDamageTotals(
  draft: Draft,
  totals: Iterable<CombatPlayerDamageTotal>,
): void {
  for (const total of totals) {
    if (total.amount <= 0) continue;
    applyLifeDeltaForPlayer(
      draft,
      total.target.playerId,
      -total.amount,
      commandCause('resolveCombatDamage'),
    );
  }
}

function applyEnterCombat(
  draft: Draft,
  attackingPlayerId?: PlayerId,
  defendingPlayerId?: PlayerId,
  combatId?: string,
): void {
  if (draft.state.phase !== 'combat') {
    clearPool(draft, 'フェイズ移行によりマナプールが空になりました。');
  }

  const attacking = attackingPlayerId ?? draft.state.activePlayerId;
  requirePlayer(draft.state, attacking);
  const defending = defendingPlayerId ?? defaultDefendingPlayer(draft.state, attacking);
  requirePlayer(draft.state, defending);
  // Sets phase directly (bypasses enterPhase/promoteDueScheduledTriggers). Harmless today
  // because PendingTriggerSchedule.phase only accepts 'upkeep'|'end', but if a future slice
  // adds 'combat' as a schedule target, this call site will also need promotion wiring.
  draft.state.phase = 'combat';
  draft.state.combat = {
    combatId: combatId ?? nextCombatId(draft),
    turn: draft.state.turn,
    step: 'beginningOfCombat',
    attackingPlayerId: attacking,
    defendingPlayerId: defending,
    attackers: [],
    blockers: [],
  };
  pushLog(draft, '戦闘を開始しました。');
}

function applyDeclareAttackers(
  draft: Draft,
  attackers: Array<{ cardId: string; target?: CombatTarget }>,
): void {
  const combat = requireCombat(draft);
  const seen = new Set<string>();
  const declared: CombatAttacker[] = [];

  for (const attacker of attackers) {
    if (seen.has(attacker.cardId)) {
      draft.warnings.push(`攻撃クリーチャーが重複しています: ${attacker.cardId}`);
      continue;
    }
    seen.add(attacker.cardId);

    const card = requireCard(draft, attacker.cardId);
    warnIfNotBattlefieldCreature(draft, card);
    const target = attacker.target ?? defaultCombatTarget(combat.defendingPlayerId);
    requirePlayer(draft.state, target.playerId);
    if (target.playerId === card.controllerId) {
      throw new EngineError('自分自身を攻撃先プレイヤーにはできません。');
    }
    if (isBattlefieldCreature(draft, card) && !hasVigilance(draft.state, card.id) && !card.tapped) {
      setCard(draft, { ...card, tapped: true });
      pushLog(draft, `${nameOfCard(draft, card)}は攻撃のためタップされました。`);
    }

    declared.push({
      cardId: card.id,
      objectId: objectIdOf(card),
      controllerId: card.controllerId,
      target,
      blockedBy: [],
      declaredOrder: declared.length,
    });
  }

  draft.state.combat = {
    ...combat,
    step: 'declareBlockers',
    attackers: declared,
    blockers: [],
  };
  pushLog(draft, `${declared.length}体の攻撃クリーチャーを宣言しました。`);
}

function applyDeclareBlockers(
  draft: Draft,
  blockers: Array<{ cardId: string; attackerId: string }>,
): void {
  const combat = requireCombat(draft);
  const attackers: CombatAttacker[] = combat.attackers.map((attacker) => ({
    ...attacker,
    blockedBy: [],
  }));
  const attackersById = new Map(attackers.map((attacker) => [attacker.cardId, attacker]));
  const seenBlockers = new Set<string>();
  const declared: CombatBlocker[] = [];

  for (const blocker of blockers) {
    if (seenBlockers.has(blocker.cardId)) {
      draft.warnings.push(`ブロック・クリーチャーが重複しています: ${blocker.cardId}`);
      continue;
    }
    seenBlockers.add(blocker.cardId);

    const attacker = attackersById.get(blocker.attackerId);
    if (!attacker) {
      draft.warnings.push(`ブロック先の攻撃クリーチャーが見つかりません: ${blocker.attackerId}`);
      continue;
    }

    const card = requireCard(draft, blocker.cardId);
    warnIfNotBattlefieldCreature(draft, card);
    attacker.blockedBy = [...attacker.blockedBy, card.id];
    declared.push({
      cardId: card.id,
      objectId: objectIdOf(card),
      controllerId: card.controllerId,
      blocking: [attacker.cardId],
      declaredOrder: declared.length,
    });
  }

  draft.state.combat = {
    ...combat,
    step: 'combatDamage',
    attackers,
    blockers: declared,
  };
  pushLog(draft, `${declared.length}体のブロック・クリーチャーを宣言しました。`);
}

function gainLifeForController(draft: Draft, controllerId: PlayerId, amount: number): void {
  if (amount <= 0) return;
  const cause = commandCause('resolveCombatDamage');
  applyLifeDeltaForPlayer(draft, controllerId, amount, cause);
}

// CR 702.15b: lifelink causes the source's controller to gain life equal to the damage
// actually dealt, in addition to that damage's other results.
function applyPositiveCombatDamage(
  draft: Draft,
  recipientId: string,
  sourceId: string,
  sourceControllerId: PlayerId,
  amount: number,
): void {
  const positiveAmount = Math.max(0, amount);
  if (positiveAmount <= 0) return;
  applyMarkDamage(draft, recipientId, positiveAmount, sourceHasDeathtouch(draft, sourceId));
  if (effectiveKeywords(draft.state, sourceId).includes('lifelink')) {
    gainLifeForController(draft, sourceControllerId, positiveAmount);
  }
}

// CR 702.19b: with a single blocker, trample lets the attacker assign only the amount of
// damage needed to be lethal to that blocker, sending the rest to the player/planeswalker
// it's attacking. Lethality accounts for damage already marked and deathtouch (CR 702.19b,
// 704.5h). If the blocker's toughness can't be determined, fall back to no overflow (honest
// defer) rather than guess.
function trampleLethalAssignment(
  draft: Draft,
  blockerCard: CardInstance,
  attackerHasDeathtouch: boolean,
  attackerPower: number,
): { toBlocker: number; overflow: number } {
  const toughness = effectiveToughnessForSba(draft, blockerCard);
  if (toughness === null) {
    return { toBlocker: attackerPower, overflow: 0 };
  }
  const alreadyMarked = markedDamageOf(blockerCard);
  const lethalNeeded = attackerHasDeathtouch
    ? 1
    : Math.max(0, toughness - alreadyMarked);
  const toBlocker = Math.min(attackerPower, lethalNeeded);
  const overflow = Math.max(0, attackerPower - toBlocker);
  return { toBlocker, overflow };
}

function applyResolveCombatDamage(draft: Draft): void {
  const combat = requireCombat(draft);
  const blockersById = new Map(combat.blockers.map((blocker) => [blocker.cardId, blocker]));
  const attackers = combat.attackers.slice().sort((left, right) => {
    const declared = left.declaredOrder - right.declaredOrder;
    return declared !== 0 ? declared : left.cardId.localeCompare(right.cardId);
  });
  const playerDamageTotals = new Map<string, CombatPlayerDamageTotal>();
  let deferredCount = 0;

  for (const attacker of attackers) {
    if (attacker.blockedBy.length === 0) {
      const attackerCard = liveCombatCreature(draft, attacker.cardId, attacker.objectId);
      if (attackerCard && attacker.target.type === 'player') {
        const power = Math.max(0, effectivePower(draft.state, attackerCard.id));
        addCombatPlayerDamage(playerDamageTotals, attacker.target, power);
        if (effectiveKeywords(draft.state, attackerCard.id).includes('lifelink')) {
          gainLifeForController(draft, attacker.controllerId, power);
        }
      }
      continue;
    }

    if (attacker.blockedBy.length > 1) {
      deferredCount += 1;
      const warning =
        `manual-combat-damage: ${attacker.cardId} は複数のブロッカーにブロックされています。` +
        '戦闘ダメージ割当を手動で行ってください。';
      draft.warnings.push(warning);
      pushLog(draft, warning);
      continue;
    }

    const blocker = blockersById.get(attacker.blockedBy[0]);
    if (!blocker || blocker.blocking.length !== 1 || blocker.blocking[0] !== attacker.cardId) {
      continue;
    }

    const attackerCard = liveCombatCreature(draft, attacker.cardId, attacker.objectId);
    const blockerCard = liveCombatCreature(draft, blocker.cardId, blocker.objectId);
    if (!attackerCard || !blockerCard) {
      continue;
    }

    const attackerPower = Math.max(0, effectivePower(draft.state, attackerCard.id));
    const attackerHasTrample = effectiveKeywords(draft.state, attackerCard.id).includes('trample');
    const attackerHasDeathtouch = sourceHasDeathtouch(draft, attackerCard.id);

    let toBlocker = attackerPower;
    let overflow = 0;
    if (attackerHasTrample && attacker.target.type === 'player') {
      ({ toBlocker, overflow } = trampleLethalAssignment(
        draft,
        blockerCard,
        attackerHasDeathtouch,
        attackerPower,
      ));
    }

    applyPositiveCombatDamage(
      draft,
      blockerCard.id,
      attackerCard.id,
      attacker.controllerId,
      toBlocker,
    );
    if (overflow > 0) {
      addCombatPlayerDamage(playerDamageTotals, attacker.target, overflow);
      if (effectiveKeywords(draft.state, attackerCard.id).includes('lifelink')) {
        gainLifeForController(draft, attacker.controllerId, overflow);
      }
    }
    applyPositiveCombatDamage(
      draft,
      attackerCard.id,
      blockerCard.id,
      blocker.controllerId,
      effectivePower(draft.state, blockerCard.id),
    );
  }

  applyCombatPlayerDamageTotals(draft, playerDamageTotals.values());

  draft.state.combat = {
    ...combat,
    step: 'endOfCombat',
  };
  if (deferredCount === 0) {
    pushLog(draft, '戦闘ダメージを解決しました。');
  }
}

function applyDefeatStateBasedActions(draft: Draft, simultaneousGroupId: string): boolean {
  let added = false;

  const defeatRefForPlayer = (playerId: PlayerId): DefeatPlayerRef =>
    playerId === draft.state.localPlayerId
      ? 'P1'
      : defeatPlayerRefForLifeLabel(requirePlayer(draft.state, playerId).label);

  if (draft.state.life <= 0) {
    added = addDefeatAdvisory(draft, 'P1', 'lifeZero', simultaneousGroupId) || added;
  }

  for (const [label, life] of Object.entries(draft.state.opponentLife).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (life > 0) continue;
    added =
      addDefeatAdvisory(
        draft,
        defeatPlayerRefForLifeLabel(label),
        'lifeZero',
        simultaneousGroupId,
      ) || added;
  }

  const emptyDrawFlags = draft.state.emptyLibraryDrawAttemptedSinceLastSba;
  if (Object.keys(emptyDrawFlags).length > 0) {
    draft.state.emptyLibraryDrawAttemptedSinceLastSba = {};
  }
  for (const playerId of Object.keys(emptyDrawFlags).sort()) {
    if (emptyDrawFlags[playerId] !== true || !draft.state.players[playerId]) continue;
    added =
      addDefeatAdvisory(
        draft,
        defeatRefForPlayer(playerId),
        'emptyLibraryDraw',
        simultaneousGroupId,
      ) || added;
  }

  for (const playerId of draft.state.turnOrder) {
    const player = requirePlayer(draft.state, playerId);
    const poison = playerId === draft.state.localPlayerId ? draft.state.poison : player.poison;
    if (poison < 10) continue;
    added =
      addDefeatAdvisory(draft, defeatRefForPlayer(playerId), 'poison', simultaneousGroupId) || added;
  }

  for (const value of Object.values(draft.state.commanderDamage)) {
    if (value >= 21) {
      added = addDefeatAdvisory(draft, 'P1', 'commanderDamage', simultaneousGroupId) || added;
      break;
    }
  }

  return added;
}

function performStateBasedActionsOnce(draft: Draft): boolean {
  if (draft.state.pendingRuleChoices.length > 0) {
    return false;
  }

  const simultaneousGroupId = `sba-${draft.nextEventSeq}`;
  const defeatAdvisoryAdded = applyDefeatStateBasedActions(draft, simultaneousGroupId);
  const zeroToughnessCreatureIds = Object.values(draft.state.cards).flatMap((card) => {
    if (card.zone !== 'battlefield' || !typeLineOf(draft, card).includes('Creature')) {
      return [];
    }
    const toughness = effectiveToughnessForSba(draft, card);
    return toughness !== null && toughness <= 0 ? [card.id] : [];
  });
  const lethalDamageCreatureIds = Object.values(draft.state.cards).flatMap((card) => {
    if (card.zone !== 'battlefield' || !typeLineOf(draft, card).includes('Creature')) {
      return [];
    }
    const toughness = effectiveToughnessForSba(draft, card);
    return toughness !== null && toughness > 0 && markedDamageOf(card) >= toughness
      ? [card.id]
      : [];
  });
  const deathtouchDamageCreatureIds = Object.values(draft.state.cards).flatMap((card) => {
    if (card.zone !== 'battlefield' || !typeLineOf(draft, card).includes('Creature')) {
      return [];
    }
    const toughness = effectiveToughnessForSba(draft, card);
    return toughness !== null &&
      toughness > 0 &&
      hasDeathtouchDamage(card) &&
      markedDamageOf(card) >= 1
      ? [card.id]
      : [];
  });
  const zeroLoyaltyPlaneswalkerIds = Object.values(draft.state.cards).flatMap((card) => {
    if (card.zone !== 'battlefield' || !typeLineOf(draft, card).includes('Planeswalker')) {
      return [];
    }
    return (card.counters.loyalty ?? 0) === 0 ? [card.id] : [];
  });
  const invalidCopyIds = Object.values(draft.state.cards).flatMap((card) =>
    card.isCopy && card.zone !== 'stack' ? [card.id] : [],
  );
  const offBattlefieldTokenIds = Object.values(draft.state.cards).flatMap((card) =>
    card.isToken && card.zone !== 'battlefield' ? [card.id] : [],
  );
  const counterPairIds = Object.values(draft.state.cards).flatMap((card) => {
    const plus = card.counters['+1/+1'] ?? 0;
    const minus = card.counters['-1/-1'] ?? 0;
    return card.zone === 'battlefield' && plus > 0 && minus > 0 ? [card.id] : [];
  });

  if (
    zeroToughnessCreatureIds.length === 0 &&
    lethalDamageCreatureIds.length === 0 &&
    deathtouchDamageCreatureIds.length === 0 &&
    zeroLoyaltyPlaneswalkerIds.length === 0 &&
    invalidCopyIds.length === 0 &&
    offBattlefieldTokenIds.length === 0 &&
    counterPairIds.length === 0
  ) {
    if (defeatAdvisoryAdded) {
      return true;
    }
    return appendPendingRuleChoices(draft, pendingLegendRuleChoices(draft));
  }

  for (const cardId of zeroToughnessCreatureIds) {
    const card = draft.state.cards[cardId];
    if (!card || card.zone !== 'battlefield') continue;

    moveCardInternal(draft, cardId, 'graveyard', 'bottom', false, 'sba', {
      simultaneousGroupId,
      sbaApplied: '704.5f',
    });
    pushLog(
      draft,
      `${nameOf(draft, cardId)}はタフネスが0以下のため状況起因処理で墓地に置かれました。`,
    );
  }

  for (const cardId of lethalDamageCreatureIds) {
    const card = draft.state.cards[cardId];
    if (!card || card.zone !== 'battlefield') continue;

    moveCardInternal(draft, cardId, 'graveyard', 'bottom', false, 'sba', {
      simultaneousGroupId,
      sbaApplied: '704.5g',
    });
    pushLog(
      draft,
      `${nameOf(draft, cardId)}は致死ダメージを受けているため状況起因処理で墓地に置かれました。`,
    );
  }

  for (const cardId of deathtouchDamageCreatureIds) {
    const card = draft.state.cards[cardId];
    if (!card || card.zone !== 'battlefield') continue;

    moveCardInternal(draft, cardId, 'graveyard', 'bottom', false, 'sba', {
      simultaneousGroupId,
      sbaApplied: '704.5h',
    });
    pushLog(
      draft,
      `${nameOf(draft, cardId)}は接死を持つ発生源からダメージを受けているため状況起因処理で墓地に置かれました。`,
    );
  }

  for (const cardId of zeroLoyaltyPlaneswalkerIds) {
    const card = draft.state.cards[cardId];
    if (!card || card.zone !== 'battlefield') continue;

    moveCardInternal(draft, cardId, 'graveyard', 'bottom', false, 'sba', {
      simultaneousGroupId,
      sbaApplied: '704.5i',
    });
    pushLog(draft, `${nameOf(draft, cardId)}は忠誠度が0のため状況起因処理で墓地に置かれました。`);
  }

  for (const cardId of invalidCopyIds) {
    const card = draft.state.cards[cardId];
    if (!card || !card.isCopy || card.zone === 'stack') continue;

    const before = objectSnapshotOf(draft, card);
    const name = nameOfCard(draft, card);
    pushZoneChangeEvent(draft, before, undefined, card.zone, undefined, 'copy-cease', {
      simultaneousGroupId,
      sbaApplied: '704.5e',
    });
    deleteCardFromState(draft, card.id);
    pushLog(draft, `コピー${name}は状況起因処理により消滅しました。`);
  }

  for (const cardId of offBattlefieldTokenIds) {
    const card = draft.state.cards[cardId];
    if (!card || !card.isToken || card.zone === 'battlefield') continue;

    const before = objectSnapshotOf(draft, card);
    const name = nameOfCard(draft, card);
    pushZoneChangeEvent(draft, before, undefined, card.zone, undefined, 'token-cease', {
      simultaneousGroupId,
      sbaApplied: '704.5d',
    });
    deleteCardFromState(draft, card.id);
    pushLog(draft, `トークン${name}は状況起因処理により消滅しました。`);
  }

  for (const cardId of counterPairIds) {
    const card = draft.state.cards[cardId];
    if (!card || card.zone !== 'battlefield') continue;
    const plus = card.counters['+1/+1'] ?? 0;
    const minus = card.counters['-1/-1'] ?? 0;
    const removeCount = Math.min(plus, minus);
    if (removeCount <= 0) continue;

    // CR 704.5q mutates both counter types directly. Record intents (matching
    // applyAddCounters's pattern) before mutating, so flushCounterChangeEvents emits
    // an accurate CounterChangeEvent for this SBA-driven removal instead of leaving a
    // stale/incorrect prior event uncorrected (Tier-1 audit finding, batch3-1c).
    recordCounterChangeIntent(draft, card, '+1/+1', plus);
    recordCounterChangeIntent(draft, card, '-1/-1', minus);

    const counters = { ...card.counters };
    const nextPlus = plus - removeCount;
    const nextMinus = minus - removeCount;
    if (nextPlus === 0) {
      delete counters['+1/+1'];
    } else {
      counters['+1/+1'] = nextPlus;
    }
    if (nextMinus === 0) {
      delete counters['-1/-1'];
    } else {
      counters['-1/-1'] = nextMinus;
    }
    setCard(draft, { ...card, counters });
    pushLog(
      draft,
      `${nameOf(draft, cardId)}の+1/+1カウンターと-1/-1カウンターを${removeCount}個ずつ取り除きました。`,
    );
  }

  return true;
}

function stabilizeBeforePriority(draft: Draft): void {
  while (performStateBasedActionsOnce(draft)) {
    // CR 704.3 repeats state-based action checks until none apply.
  }
}

export function performStateBasedActions(state: GameState): ApplyResult {
  const draft = makeDraft(state);
  stabilizeBeforePriority(draft);
  return { state: syncDerivedViews(draft.state), warnings: draft.warnings };
}

function manaPoolFor(draft: Draft, playerId: PlayerId): ManaPool {
  const player = requirePlayer(draft.state, playerId);
  return playerId === draft.state.localPlayerId ? draft.state.manaPool : player.manaPool;
}

function setManaPoolFor(draft: Draft, playerId: PlayerId, manaPool: ManaPool): void {
  const player = requirePlayer(draft.state, playerId);
  if (playerId === draft.state.localPlayerId) {
    draft.state.manaPool = manaPool;
    return;
  }
  draft.state.players = {
    ...draft.state.players,
    [playerId]: { ...player, manaPool },
  };
}

function clearPool(draft: Draft, reason: string | null, playerId = draft.state.localPlayerId): void {
  const pool = manaPoolFor(draft, playerId);
  const total = pool.W + pool.U + pool.B + pool.R + pool.G + pool.C;
  setManaPoolFor(draft, playerId, emptyManaPool());
  if (reason && total > 0) {
    pushLog(draft, reason);
  }
}

function subtractPayment(
  draft: Draft,
  payment: ManaPool,
  playerId = draft.state.localPlayerId,
): { shortfall: number } {
  const pool = { ...manaPoolFor(draft, playerId) };
  let shortfall = 0;
  for (const color of ['W', 'U', 'B', 'R', 'G', 'C'] as ManaColor[]) {
    const want = payment[color];
    if (want <= 0) continue;
    const have = pool[color];
    const pay = Math.min(want, have);
    pool[color] = have - pay;
    shortfall += want - pay;
  }
  setManaPoolFor(draft, playerId, pool);
  return { shortfall };
}

type TurnCounterKey = 'landsPlayedThisTurn' | 'spellsCastThisTurn' | 'mulliganCount';

function incrementPlayerTurnCounter(
  draft: Draft,
  playerId: PlayerId,
  key: TurnCounterKey,
): number {
  const player = requirePlayer(draft.state, playerId);
  const next = player[key] + 1;
  if (playerId === draft.state.localPlayerId) {
    draft.state[key] = next;
  } else {
    draft.state.players = {
      ...draft.state.players,
      [playerId]: { ...player, [key]: next },
    };
  }
  return next;
}

function describePayment(payment: ManaPool): string {
  const parts: string[] = [];
  for (const color of ['W', 'U', 'B', 'R', 'G', 'C'] as ManaColor[]) {
    if (payment[color] > 0) parts.push(`${color}${payment[color]}`);
  }
  return parts.length ? parts.join('') : '0';
}

// ---------------------------------------------------------------------------
// Phase / turn handling
// ---------------------------------------------------------------------------

const PHASE_LABELS: Record<Phase, string> = {
  untap: 'アンタップ',
  upkeep: 'アップキープ',
  draw: 'ドロー',
  main1: 'メイン1',
  combat: '戦闘',
  main2: 'メイン2',
  end: '終了',
};

function untapAll(draft: Draft): void {
  let changed = false;
  const cards = { ...draft.state.cards };
  for (const id of draft.state.zones.battlefield) {
    const c = cards[id];
    if (c && c.tapped) {
      cards[id] = { ...c, tapped: false };
      changed = true;
    }
  }
  if (changed) {
    draft.state.cards = cards;
    pushLog(draft, 'すべてのパーマネントをアンタップした。');
  }
}

function untapControlledPermanents(draft: Draft, playerId: PlayerId): void {
  let changed = false;
  const cards = { ...draft.state.cards };
  for (const id of draft.state.zones.battlefield) {
    const card = cards[id];
    if (card?.controllerId === playerId && card.tapped) {
      cards[id] = { ...card, tapped: false };
      changed = true;
    }
  }
  if (changed) {
    draft.state.cards = cards;
    pushLog(draft, `${requirePlayer(draft.state, playerId).label}のパーマネントをアンタップした。`);
  }
}

function resetActivePlayerTurnCounters(draft: Draft): void {
  const playerId = draft.state.activePlayerId;
  const player = requirePlayer(draft.state, playerId);
  if (playerId === draft.state.localPlayerId) {
    draft.state.landsPlayedThisTurn = 0;
    draft.state.spellsCastThisTurn = 0;
    draft.state.drawnThisTurn = 0;
  } else {
    draft.state.players = {
      ...draft.state.players,
      [playerId]: {
        ...player,
        landsPlayedThisTurn: 0,
        spellsCastThisTurn: 0,
        drawnThisTurn: 0,
      },
    };
  }
}

function handleUntapEntry(draft: Draft): void {
  untapControlledPermanents(draft, draft.state.activePlayerId);
  resetActivePlayerTurnCounters(draft);
  draft.state.combatDamagePreventedUntilEndOfTurn = false;

  const cards = { ...draft.state.cards };
  let changed = false;

  for (const id of draft.state.zones.battlefield) {
    const card = cards[id];
    if (
      !card ||
      card.controllerId !== draft.state.activePlayerId ||
      !typeLineOf(draft, card).includes('Saga')
    ) continue;
    const nextLore = (card.counters.lore ?? 0) + 1;
    cards[id] = {
      ...card,
      counters: {
        ...card.counters,
        lore: nextLore,
      },
    };
    changed = true;
    pushLog(draft, `${nameOf(draft, id)}の章カウンターが${nextLore}になった。`);
  }

  if (changed) {
    draft.state.cards = cards;
  }
}

function markEmptyLibraryDrawAttempt(draft: Draft, playerId: PlayerId): void {
  if (draft.state.emptyLibraryDrawAttemptedSinceLastSba[playerId] === true) {
    return;
  }
  draft.state.emptyLibraryDrawAttemptedSinceLastSba = {
    ...draft.state.emptyLibraryDrawAttemptedSinceLastSba,
    [playerId]: true,
  };
}

function incrementDrawnThisTurn(draft: Draft, playerId: PlayerId, drawn: number): void {
  if (drawn === 0) return;
  const player = requirePlayer(draft.state, playerId);
  if (playerId === draft.state.localPlayerId) {
    draft.state.drawnThisTurn += drawn;
    return;
  }
  draft.state.players = {
    ...draft.state.players,
    [playerId]: { ...player, drawnThisTurn: player.drawnThisTurn + drawn },
  };
}

function drawCards(draft: Draft, count: number, cause: EventCause, playerId: PlayerId): number {
  requirePlayer(draft.state, playerId);
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    const lib = readZone(draft, 'library', playerId);
    if (lib.length === 0) {
      markEmptyLibraryDrawAttempt(draft, playerId);
      pushDrawEvent(draft, playerId, 'empty-library-attempt', i + 1, cause);
      continue;
    }
    const topId = lib[0];
    const zoneChangeEvent = moveCardInternal(draft, topId, 'hand', 'bottom', false);
    if (zoneChangeEvent) {
      pushDrawEvent(draft, playerId, 'drawn', i + 1, cause, zoneChangeEvent);
    }
    drawn++;
  }
  return drawn;
}

function applyMill(draft: Draft, count: number, playerId: PlayerId): void {
  requirePlayer(draft.state, playerId);
  const requested = Math.max(0, Math.floor(count));
  if (requested <= 0) return;

  const library = readZone(draft, 'library', playerId);
  const available = library.length;
  const milled = Math.min(requested, available);
  const topIds = library.slice(0, milled);

  for (const cardId of topIds) {
    moveCardInternal(draft, cardId, 'graveyard', 'bottom', false);
  }

  pushLog(draft, `切削: ライブラリの上から${milled}枚を墓地に置いた。`);
  if (requested > available) {
    draft.warnings.push(`ライブラリが${requested}枚に満たないため${milled}枚を切削した。`);
  }
}

function applyDiscard(draft: Draft, cardIds: string[], playerId?: PlayerId): void {
  const subjectHand = playerId === undefined ? undefined : new Set(readZone(draft, 'hand', playerId));
  let discarded = 0;

  for (const cardId of cardIds) {
    const card = draft.state.cards[cardId];
    if (!card) continue;
    if (subjectHand && (!subjectHand.has(cardId) || card.zone !== 'hand')) continue;
    moveCardInternal(
      draft,
      cardId,
      'graveyard',
      'bottom',
      false,
      card.zone === 'hand' ? 'discard' : 'move',
    );
    discarded += 1;
  }

  if (discarded > 0) {
    pushLog(draft, `${discarded}枚を捨てた。`);
  }
}

type ApplyPlayerEffectCommand = Extract<GameCommand, { type: 'applyPlayerEffect' }>;

function orderedRecipients(
  draft: Draft,
  controllerId: PlayerId,
  recipients: ApplyPlayerEffectCommand['recipients'],
): PlayerId[] {
  requirePlayer(draft.state, controllerId);
  const activeIndex = draft.state.turnOrder.indexOf(draft.state.activePlayerId);
  const apnapOrder = activeIndex < 0
    ? draft.state.turnOrder.slice()
    : [
        ...draft.state.turnOrder.slice(activeIndex),
        ...draft.state.turnOrder.slice(0, activeIndex),
      ];
  if (recipients === 'you') return [controllerId];
  return recipients === 'eachPlayer'
    ? apnapOrder
    : apnapOrder.filter((playerId) => playerId !== controllerId);
}

function applyPlayerEffect(draft: Draft, cmd: ApplyPlayerEffectCommand): void {
  for (const playerId of orderedRecipients(draft, cmd.controllerId, cmd.recipients)) {
    switch (cmd.effect) {
      case 'draw': {
        const requested = Math.max(0, Math.floor(cmd.amount));
        const drawn = drawCards(draft, requested, commandCause(cmd.type), playerId);
        incrementDrawnThisTurn(draft, playerId, drawn);
        break;
      }
      case 'mill':
        applyMill(draft, cmd.amount, playerId);
        break;
      case 'life':
        applyLifeDeltaForPlayer(draft, playerId, cmd.amount, commandCause(cmd.type));
        break;
      case 'counter':
        applyPlayerCounterDelta(draft, playerId, cmd.kind, cmd.amount);
        break;
    }
  }
}

function enterPhase(draft: Draft, phase: Phase, drawnHandled: boolean): void {
  draft.state.phase = phase;
  if (phase !== 'combat' && draft.state.combat !== null) {
    draft.state.combat = null;
  }
  if (phase === 'untap') {
    handleUntapEntry(draft);
  }
  if (phase === 'draw' && !drawnHandled) {
    const drawn = drawCards(draft, 1, commandCause('nextPhase'), draft.state.activePlayerId);
    incrementDrawnThisTurn(draft, draft.state.activePlayerId, drawn);
    if (drawn > 0) {
      pushLog(draft, 'カードを1枚引きました。');
    } else {
      draft.warnings.push('ライブラリが空のためドローできません。');
    }
  }
  draft.state = promoteDueScheduledTriggers(draft.state);
}

function applyNextPhase(draft: Draft, drawnHandled: boolean): void {
  clearPool(
    draft,
    'フェイズ移行によりマナプールが空になりました。',
    draft.state.activePlayerId,
  );
  const idx = PHASE_ORDER.indexOf(draft.state.phase);
  if (idx === PHASE_ORDER.length - 1) {
    // end -> next turn untap
    clearMarkedDamageInternal(draft);
    draft.state.turn += 1;
    resetOncePerTurnTriggerLedger(draft);
    enterPhase(draft, 'untap', drawnHandled);
    pushLog(draft, `ターン${draft.state.turn}に移行しました。`);
  } else {
    const next = PHASE_ORDER[idx + 1];
    enterPhase(draft, next, drawnHandled);
    pushLog(draft, `${PHASE_LABELS[next]}フェイズに移行しました。`);
  }
}

function advanceActivePlayer(draft: Draft): void {
  const currentIndex = draft.state.turnOrder.indexOf(draft.state.activePlayerId);
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % draft.state.turnOrder.length;
  const nextPlayerId = draft.state.turnOrder[nextIndex];
  if (!nextPlayerId) {
    throw new EngineError('turnOrderに次のプレイヤーが存在しません。');
  }
  requirePlayer(draft.state, nextPlayerId);
  draft.state.activePlayerId = nextPlayerId;
}

function applyNextTurn(draft: Draft, advanceTurnOrder: boolean): void {
  clearPool(
    draft,
    'ターン移行によりマナプールが空になりました。',
    draft.state.activePlayerId,
  );
  clearMarkedDamageInternal(draft);
  draft.state.turn += 1;
  if (advanceTurnOrder) advanceActivePlayer(draft);
  resetOncePerTurnTriggerLedger(draft);
  enterPhase(draft, 'untap', false);
  pushLog(draft, `ターン${draft.state.turn}(アンタップ)に移行しました。`);
}

// ---------------------------------------------------------------------------
// Cast handling
// ---------------------------------------------------------------------------

function castDestination(typeLine: string): ZoneId {
  if (/Instant|Sorcery/i.test(typeLine)) return 'graveyard';
  return 'battlefield';
}

function applyPlayLand(
  draft: Draft,
  cardId: string,
  entersTapped?: boolean,
  requestedPlayerId?: PlayerId,
): void {
  const card = requireCard(draft, cardId);
  const playerId = requestedPlayerId ?? card.controllerId;
  requirePlayer(draft.state, playerId);
  if (card.controllerId !== playerId) {
    throw new EngineError(`プレイヤー${playerId}は${cardId}をコントロールしていません。`);
  }
  // CR 601.2a-style play permission (design-lock §34.36): Muldrotha/Icetill Explorer/
  // Crucible of Worlds/Serra Paragon grant "play a land from your graveyard". Per this
  // project's sandbox philosophy (no per-card condition enforcement — see cast-from-
  // graveyard, which already has no zone check at all), the origin zone is widened
  // rather than gated behind a specific granting permanent. Exile is not included:
  // no golden card in current demand needs it (honest defer).
  if (card.zone !== 'hand' && card.zone !== 'graveyard') {
    throw new EngineError(`土地は手札か墓地からのみプレイできます: ${cardId}`);
  }
  if (!typeLineOf(draft, card).includes('Land')) {
    throw new EngineError(`土地ではないカードです: ${cardId}`);
  }

  moveCardInternal(draft, cardId, 'battlefield', 'bottom', false);
  if (entersTapped) {
    const entered = requireCard(draft, cardId);
    setCard(draft, { ...entered, tapped: true });
  }
  const landsPlayed = incrementPlayerTurnCounter(draft, playerId, 'landsPlayedThisTurn');
  pushLog(draft, `${nameOf(draft, cardId)}を土地としてプレイしました。`);
  if (landsPlayed >= 2) {
    draft.warnings.push(`このターン${landsPlayed}枚目の土地です。`);
  }
}

function applyArrangeTop(
  draft: Draft,
  topOrder: string[],
  toBottom: string[],
  toGraveyard: string[],
  playerId = draft.state.localPlayerId,
): void {
  const originalLibrary = readZone(draft, 'library', playerId).slice();
  const count = topOrder.length + toBottom.length + toGraveyard.length;
  const originalTop = originalLibrary.slice(0, count);
  const provided = [...topOrder, ...toBottom, ...toGraveyard];
  const providedSet = new Set(provided);
  const originalSet = new Set(originalTop);

  const isExactMatch =
    provided.length === count &&
    providedSet.size === count &&
    originalTop.length === count &&
    originalSet.size === count &&
    provided.every((id) => originalSet.has(id));

  if (!isExactMatch) {
    throw new EngineError('arrangeTop の対象がライブラリ先頭N枚と一致しません。');
  }

  for (const cardId of toGraveyard) {
    moveCardInternal(draft, cardId, 'graveyard', 'bottom', false);
  }

  const library = editZone(draft, 'library', playerId);
  library.splice(0, library.length, ...topOrder, ...originalLibrary.slice(count), ...toBottom);
  pushLog(draft, `ライブラリの上から${count}枚を並べ替えました。`);
}

function applyCast(
  draft: Draft,
  cardId: string,
  payment: ManaPool,
  forced: boolean,
  commander: boolean,
  faceIndex?: number,
  requestedPlayerId?: PlayerId,
): void {
  let card = requireCard(draft, cardId);
  const def = draft.state.defs[card.defId];
  const chosenFaceIndex = faceIndex ?? 0;
  if (!Number.isInteger(chosenFaceIndex) || !def?.faces[chosenFaceIndex]) {
    throw new EngineError(`唱える面が存在しません: ${cardId} face=${chosenFaceIndex}`);
  }
  if (card.faceIndex !== chosenFaceIndex) {
    card = { ...card, faceIndex: chosenFaceIndex };
    setCard(draft, card);
  }
  const playerId = requestedPlayerId ?? card.controllerId;
  requirePlayer(draft.state, playerId);
  if (card.controllerId !== playerId) {
    throw new EngineError(`プレイヤー${playerId}は${cardId}をコントロールしていません。`);
  }

  if (commander) {
    if (!isCommander(draft.state, cardId)) {
      throw new EngineError(`統率者ではないカードです: ${cardId}`);
    }
    if (card.zone !== 'command') {
      throw new EngineError(`統率者は統率領域からのみキャストできます: ${cardId}`);
    }
  }

  const { shortfall } = subtractPayment(draft, payment, playerId);
  if (shortfall > 0) {
    const msg = forced
      ? `マナが${shortfall}点不足していますが強行しました。`
      : `マナが${shortfall}点不足(強行)。`;
    draft.warnings.push(msg);
  } else if (forced) {
    // The store passes forced=true when the solver could not fully pay; the
    // payment itself never exceeds the pool, so warn off the flag, not the
    // pool subtraction.
    draft.warnings.push('マナ不足のまま強行でキャストしました。');
  }

  const typeLine = typeLineOf(draft, card);
  const dest = castDestination(typeLine);

  const name = nameOf(draft, cardId);
  const payStr = describePayment(payment);

  if (commander) {
    draft.state.commanders = draft.state.commanders.map((c) =>
      c.cardId === cardId ? { ...c, castCount: c.castCount + 1 } : c,
    );
    moveCardInternal(draft, cardId, dest, 'bottom', false, 'cast');
    incrementPlayerTurnCounter(draft, playerId, 'spellsCastThisTurn');
    pushLog(draft, `統率者${name}をキャストしました(支払い: ${payStr})。`);
  } else {
    moveCardInternal(draft, cardId, dest, 'bottom', false, 'cast');
    incrementPlayerTurnCounter(draft, playerId, 'spellsCastThisTurn');
    pushLog(draft, `${name}をキャストしました(支払い: ${payStr})。`);
  }
}

function nextAbilityId(state: GameState): string {
  let max = 0;
  for (const id of Object.keys(state.cards)) {
    if (!id.startsWith('a')) continue;
    const n = Number.parseInt(id.slice(1), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `a${max + 1}`;
}

function nextCopyId(state: GameState): string {
  let max = 0;
  for (const id of Object.keys(state.cards)) {
    if (!id.startsWith('k')) continue;
    const n = Number.parseInt(id.slice(1), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `k${max + 1}`;
}

function incrementCommanderCastCount(draft: Draft, cardId: string): void {
  draft.state.commanders = draft.state.commanders.map((commander) =>
    commander.cardId === cardId ? { ...commander, castCount: commander.castCount + 1 } : commander,
  );
}

function createAbilityObject(
  abilityId: string,
  sourceId: string,
  defId: string,
  kind: AbilityKind,
  abilityLineIndex?: number,
  ownerId: CardInstance['ownerId'] = 'P1',
  controllerId: CardInstance['controllerId'] = ownerId,
  sourceSnapshot?: ObjectSnapshot,
  targetSelections: TargetSelection[] = [],
  activationEnvelope?: ActivationEnvelope,
): CardInstance {
  return {
    id: abilityId,
    defId,
    zone: 'stack',
    ownerId,
    controllerId,
    zoneChangeCounter: 0,
    tapped: false,
    faceIndex: 0,
    faceDown: false,
    counters: {},
    isToken: false,
    isCommander: false,
    enteredTurn: 0,
    damageMarked: 0,
    hasDeathtouchDamage: false,
    isAbility: true,
    sourceId,
    sourceSnapshot,
    abilityKind: kind,
    abilityLineIndex,
    targetSelections: targetSelections.map((selection) => ({ ...selection })),
    activationEnvelope,
  };
}

function applyCastToStack(
  draft: Draft,
  cardId: string,
  payment: ManaPool,
  forced: boolean,
  faceIndex?: number,
  xValue?: number,
  requestedPlayerId?: PlayerId,
): void {
  let card = requireCard(draft, cardId);
  const def = draft.state.defs[card.defId];
  const chosenFaceIndex = faceIndex ?? 0;
  if (!Number.isInteger(chosenFaceIndex) || !def?.faces[chosenFaceIndex]) {
    throw new EngineError(`唱える面が存在しません: ${cardId} face=${chosenFaceIndex}`);
  }
  if (card.faceIndex !== chosenFaceIndex) {
    card = { ...card, faceIndex: chosenFaceIndex };
    setCard(draft, card);
  }
  const playerId = requestedPlayerId ?? card.controllerId;
  requirePlayer(draft.state, playerId);
  if (card.controllerId !== playerId) {
    throw new EngineError(`プレイヤー${playerId}は${cardId}をコントロールしていません。`);
  }
  const fromCommand = card.zone === 'command' && isCommander(draft.state, cardId);

  const { shortfall } = subtractPayment(draft, payment, playerId);
  if (shortfall > 0) {
    const msg = forced
      ? `マナが${shortfall}点不足していますが強行しました。`
      : `マナが${shortfall}点不足(強行)。`;
    draft.warnings.push(msg);
  } else if (forced) {
    draft.warnings.push('マナ不足のまま強行で唱えました。');
  }

  moveCardInternal(draft, cardId, 'stack', 'bottom', false, 'cast');
  if (xValue !== undefined) {
    const stacked = requireCard(draft, cardId);
    setCard(draft, { ...stacked, announcedX: Math.max(0, Math.floor(xValue)) });
  }
  if (fromCommand) {
    incrementCommanderCastCount(draft, cardId);
  }
  incrementPlayerTurnCounter(draft, playerId, 'spellsCastThisTurn');
  pushLog(draft, `${nameOf(draft, cardId)}を唱えた(スタックへ)。`);
}

function applySetManualTargets(
  draft: Draft,
  stackItemId: string,
  targetIds: string[],
  targetPlayerIds: PlayerId[] = [],
  allowStackAbilities = false,
): void {
  const source = requireCard(draft, stackItemId);
  if (source.zone !== 'stack') {
    throw new EngineError('手動対象を設定できるのはスタック上の項目だけです。');
  }
  if (source.isAbility && !allowStackAbilities) {
    throw new EngineError('手動対象を設定できるのは呪文だけです(能力は対象外)。');
  }
  const uniqueIds = [...new Set(targetIds)];
  const manualObjectSelections = uniqueIds.map((targetId, index): TargetSelection => {
    const target = requireCard(draft, targetId);
    const isPermanent = target.zone === 'battlefield' && !target.isAbility;
    const isOtherStackObject = target.zone === 'stack'
      && target.id !== stackItemId
      && (allowStackAbilities || !target.isAbility);
    if (!isPermanent && !isOtherStackObject) {
      throw new EngineError('手動対象には戦場のパーマネントか、他のスタック上の呪文・能力を選んでください。');
    }
    const snapshot = objectSnapshotOf(draft, target);
    return {
      slotId: `manual-target-${index}`,
      raw: '手動で指定した対象',
      kind: 'object',
      selection: {
        kind: 'object',
        physicalCardId: snapshot.physicalCardId,
        objectId: snapshot.objectId,
        snapshot,
      },
      legalityMode: 'unchecked-warning',
    };
  });
  const uniquePlayerIds = [...new Set(targetPlayerIds)];
  const manualPlayerSelections = uniquePlayerIds.map((playerId, index): TargetSelection => {
    if (!draft.state.players[playerId]) {
      throw new EngineError('手動対象には自分か対戦相手を選んでください。');
    }
    return {
      slotId: `manual-target-player-${index}`,
      raw: '手動で指定したプレイヤー対象',
      kind: 'player',
      selection: { kind: 'player', playerId },
      legalityMode: 'unchecked-warning',
    };
  });
  const manualSelections = [...manualObjectSelections, ...manualPlayerSelections];
  const retainedSelections = (source.targetSelections ?? []).filter(
    (selection) => !selection.slotId.startsWith('manual-target-'),
  );
  setCard(draft, { ...source, targetSelections: [...retainedSelections, ...manualSelections] });
  pushLog(draft, `${nameOf(draft, stackItemId)}の対象を手動で${manualSelections.length}件記録した。`);
}

function applyAddAbilityToStack(
  draft: Draft,
  sourceId: string,
  kind: AbilityKind,
  abilityLineIndex?: number,
  sourceSnapshot?: ObjectSnapshot,
  targetSelections: TargetSelection[] = [],
  activationEnvelope?: ActivationEnvelope,
): void {
  const source = draft.state.cards[sourceId];
  const defId = source?.defId ?? sourceSnapshot?.defId;
  if (!defId) {
    throw new EngineError(`能力の発生源が存在しません: ${sourceId}`);
  }
  const ownerId = sourceSnapshot?.ownerId ?? source?.ownerId ?? 'P1';
  const controllerId = sourceSnapshot?.controllerId ?? source?.controllerId ?? ownerId;
  const abilityId = nextAbilityId(draft.state);
  const cards = { ...draft.state.cards };
  const stack = editZone(draft, 'stack');

  cards[abilityId] = createAbilityObject(
    abilityId,
    sourceId,
    defId,
    kind,
    abilityLineIndex,
    ownerId,
    controllerId,
    sourceSnapshot,
    targetSelections,
    activationEnvelope,
  );
  draft.state.cards = cards;
  stack.push(abilityId);
  const sourceName = source ? nameOf(draft, sourceId) : `《${cardName(draft.state.defs[defId])}》`;

  pushLog(draft, `${sourceName}の${ABILITY_KIND_LABELS[kind]}能力をスタックに積んだ。`);
}

function defaultStackResolveDestination(draft: Draft, card: CardInstance): ZoneId {
  return castDestination(typeLineOf(draft, card));
}

interface ResolvableEffectLine {
  sourceId: string;
  def: CardDef;
  line: AbilityLine;
  typeLine: string;
}

function effectLinesForStackItemState(
  state: GameState,
  card: CardInstance,
): ResolvableEffectLine[] {
  if (state.effectsAuto !== true) {
    return [];
  }

  const sourceId = card.isAbility ? card.sourceId : card.id;
  if (!sourceId) {
    return [];
  }

  const source = state.cards[sourceId];
  if (source?.effectsAuto === false) {
    return [];
  }
  if (!source && !card.isAbility) {
    return [];
  }

  const def = state.defs[card.defId];
  if (!def) {
    return [];
  }

  const lines = splitAbilityLines(def);
  if (card.isAbility) {
    if (card.abilityLineIndex === undefined) {
      return [];
    }
    const line = lines[card.abilityLineIndex];
    if (!line) {
      return [];
    }
    return [
      {
        sourceId,
        def,
        line,
        typeLine: def.faces[line.faceIndex]?.typeLine ?? def.typeLine,
      },
    ];
  }

  return lines
    .filter((line) => line.shape === 'spell')
    .map((line) => ({
      sourceId,
      def,
      line,
      typeLine: def.faces[line.faceIndex]?.typeLine ?? def.typeLine,
    }));
}

function effectLinesForResolvedStackItem(draft: Draft, card: CardInstance): ResolvableEffectLine[] {
  return effectLinesForStackItemState(draft.state, card);
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

  const shapes =
    kind === 'activated' ? new Set(['activated']) : new Set(['triggered', 'delayed-triggered']);
  const matches = splitAbilityLines(def)
    .map((line, index) => ({ line, index }))
    .filter((entry) => shapes.has(entry.line.shape));

  return matches.length === 1 ? matches[0].index : undefined;
}

function activationSourceRefFromSnapshot(snapshot: ObjectSnapshot): ActivationSourceRef {
  return {
    physicalCardId: snapshot.physicalCardId,
    objectId: snapshot.objectId,
    snapshot,
  };
}

const COST_NUMBER_WORDS = new Map<string, number>([
  ['a', 1],
  ['an', 1],
  ['one', 1],
  ['two', 2],
  ['three', 3],
  ['four', 4],
  ['five', 5],
  ['six', 6],
  ['seven', 7],
  ['eight', 8],
  ['nine', 9],
  ['ten', 10],
]);

const COST_OBJECT_TYPES = [
  'creature',
  'artifact',
  'enchantment',
  'land',
  'planeswalker',
  'permanent',
];

interface ParsedActivationNonmanaCost {
  components: ActivationCostComponent[];
  commands: GameCommand[];
  prompts: EffectPrompt[];
  remainingRaw: string;
}

function parseCostAmountToken(token: string): number | null {
  const normalized = token.toLowerCase();
  if (COST_NUMBER_WORDS.has(normalized)) {
    return COST_NUMBER_WORDS.get(normalized) ?? null;
  }
  if (/^\d+$/.test(normalized)) {
    return Number.parseInt(normalized, 10);
  }
  return null;
}

function costElements(rawCost: string): string[] {
  return rawCost
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

function abilityCostFromRaw(raw: string): AbilityCost {
  const costSymbols = raw.match(/\{[^}]+\}/g) ?? [];
  const mana = costSymbols.filter((symbol) => !/^\{T\}$/i.test(symbol)).join('');
  return {
    raw,
    mana: mana === '' ? null : mana,
    tap: /\{T\}/i.test(raw),
    sacrificesSelf: /^Sacrifice\b.*\b(?:this|it|self)\b/i.test(raw),
  };
}

function componentSlotId(elementIndex: number): string {
  return `cost-${elementIndex}`;
}

function promptSlotId(slotId: string, choiceIndex: number): string {
  return `${slotId}-choice-${choiceIndex}`;
}

function isSelfSacrificeSubject(subject: string, sourceName: string): boolean {
  const normalized = subject
    .replace(/\s+/g, ' ')
    .replace(/[.。]\s*$/, '')
    .trim();
  if (/^(?:it|self|~)$/i.test(normalized)) {
    return true;
  }
  if (/^this\b/i.test(normalized)) {
    return true;
  }
  return sourceName
    .split(/\s+\/\/\s+/)
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name !== '')
    .includes(normalized.toLowerCase());
}

function sacrificeCostFilter(subject: string): TargetFilter {
  const lower = subject.toLowerCase();
  const types = COST_OBJECT_TYPES.filter((type) => new RegExp(`\\b${type}\\b`, 'i').test(lower));
  return {
    types: types.length > 0 ? types : ['permanent'],
    controller: 'you',
  };
}

function parsePayLifeCostElement(
  element: string,
  payerId: PlayerId,
  slotId: string,
): { component: ActivationCostComponent; commands: GameCommand[] } | null {
  const match = /^Pay\s+(a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+life$/i.exec(
    element,
  );
  if (!match) {
    return null;
  }
  const amount = parseCostAmountToken(match[1]);
  if (amount === null) {
    return null;
  }
  return {
    component: {
      kind: 'pay-life',
      raw: element,
      payerId,
      status: 'guided',
      amount,
      slotId,
    },
    commands: [{
      type: 'adjustLife',
      delta: -amount,
      ...(payerId !== 'P1' ? { playerId: payerId } : {}),
    }],
  };
}

function parseDiscardCostElement(
  state: GameState,
  element: string,
  payerId: PlayerId,
  slotId: string,
): { component: ActivationCostComponent; commands: GameCommand[]; prompts: EffectPrompt[] } | null {
  if (/\brandom\b/i.test(element)) {
    return null;
  }

  if (/^Discard\s+your\s+hand$/i.test(element)) {
    const hand = state.zonesByPlayer[payerId].hand;
    const subjectRefs = hand.flatMap((cardId) => {
      const snapshot = objectSnapshotForCard(state, cardId);
      return snapshot ? [activationSourceRefFromSnapshot(snapshot)] : [];
    });
    return {
      component: {
        kind: 'discard',
        raw: element,
        payerId,
        status: 'guided',
        amount: hand.length,
        slotId,
        subjectRefs,
        ...(subjectRefs[0] ? { subjectRef: subjectRefs[0] } : {}),
      },
      commands:
        hand.length > 0
          ? [{
              type: 'discard',
              cardIds: hand.slice(),
              ...(payerId !== 'P1' ? { playerId: payerId } : {}),
            }]
          : [],
      prompts: [],
    };
  }

  const match =
    /^Discard\s+(a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+cards?$/i.exec(
      element,
    );
  if (!match) {
    return null;
  }
  const amount = parseCostAmountToken(match[1]);
  if (amount === null) {
    return null;
  }
  return {
    component: {
      kind: 'discard',
      raw: element,
      payerId,
      status: 'guided',
      amount,
      slotId,
    },
    commands: [],
    prompts: Array.from({ length: amount }, (_, index) => ({
      atom: null,
      kind: 'cost-discard',
      count: 1,
      slotId: promptSlotId(slotId, index),
      raw: element,
    })),
  };
}

function parseSacrificeObjectCostElement(
  element: string,
  payerId: PlayerId,
  slotId: string,
  sourceName: string,
): { component: ActivationCostComponent; prompts: EffectPrompt[] } | null {
  const match = /^Sacrifice\s+(.+)$/i.exec(element);
  if (!match) {
    return null;
  }
  const subject = match[1].trim();
  if (isSelfSacrificeSubject(subject, sourceName)) {
    return null;
  }

  const countMatch = /^(a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(.+)$/i.exec(
    subject,
  );
  const anotherMatch = /^another\s+(.+)$/i.exec(subject);
  const amount = countMatch ? parseCostAmountToken(countMatch[1]) : anotherMatch ? 1 : null;
  const objectPhrase = countMatch
    ? countMatch[2].trim()
    : anotherMatch
      ? anotherMatch[1].trim()
      : subject;
  if (amount === null) {
    return null;
  }

  const filter = sacrificeCostFilter(objectPhrase);
  return {
    component: {
      kind: 'sacrifice-object',
      raw: element,
      payerId,
      status: 'guided',
      amount,
      slotId,
    },
    prompts: Array.from({ length: amount }, (_, index) => ({
      atom: null,
      kind: 'cost-sacrifice',
      count: 1,
      slotId: promptSlotId(slotId, index),
      filter,
      raw: element,
    })),
  };
}

function activationNonmanaCosts(
  state: GameState,
  rawCost: string,
  sourceSnapshot: ObjectSnapshot,
): ParsedActivationNonmanaCost {
  const payerId = sourceSnapshot.controllerId ?? sourceSnapshot.ownerId;
  const sourceDef = state.defs[sourceSnapshot.defId];
  const sourceFace = sourceDef?.faces[sourceSnapshot.faceIndex] ?? sourceDef?.faces[0];
  const sourceName = sourceFace?.name ?? sourceDef?.name ?? '';
  const components: ActivationCostComponent[] = [];
  const commands: GameCommand[] = [];
  const prompts: EffectPrompt[] = [];
  const remaining: string[] = [];

  costElements(rawCost).forEach((element, index) => {
    const slotId = componentSlotId(index);
    const payLife = parsePayLifeCostElement(element, payerId, slotId);
    if (payLife) {
      components.push(payLife.component);
      commands.push(...payLife.commands);
      return;
    }

    const discard = parseDiscardCostElement(state, element, payerId, slotId);
    if (discard) {
      components.push(discard.component);
      commands.push(...discard.commands);
      prompts.push(...discard.prompts);
      return;
    }

    const sacrifice = parseSacrificeObjectCostElement(element, payerId, slotId, sourceName);
    if (sacrifice) {
      components.push(sacrifice.component);
      prompts.push(...sacrifice.prompts);
      return;
    }

    remaining.push(element);
  });

  return {
    components,
    commands,
    prompts,
    remainingRaw: remaining.join(', '),
  };
}

function activationCostComponents(
  sourceId: string,
  sourceSnapshot: ObjectSnapshot,
  rawCost: string,
  manaCost: string | null,
  commands: readonly GameCommand[],
  status: ActivationCostComponent['status'],
): ActivationCostComponent[] {
  const payerId = sourceSnapshot.controllerId ?? sourceSnapshot.ownerId;
  const sourceRef = activationSourceRefFromSnapshot(sourceSnapshot);
  const components: ActivationCostComponent[] = [];

  if (manaCost !== null) {
    components.push({
      kind: 'mana',
      raw: manaCost,
      payerId,
      status,
      manaCost,
    });
  }

  if (
    commands.some(
      (cmd) => cmd.type === 'setTapped' && cmd.cardId === sourceId && cmd.tapped === true,
    )
  ) {
    components.push({
      kind: 'tap-self',
      raw: rawCost,
      payerId,
      status,
      subjectRef: sourceRef,
    });
  }

  if (
    commands.some(
      (cmd) =>
        cmd.type === 'moveCard' &&
        cmd.cardId === sourceId &&
        cmd.to === 'graveyard' &&
        cmd.reason !== 'resolve',
    )
  ) {
    components.push({
      kind: 'sacrifice-self',
      raw: rawCost,
      payerId,
      status,
      subjectRef: sourceRef,
    });
  }

  return components;
}

function targetKindForRaw(raw: string): TargetSelectionKind {
  if (/\bany target\b/i.test(raw)) {
    return 'object-or-player';
  }
  const match = /\btarget\b([\s\S]*)/i.exec(raw);
  const afterTarget = match?.[1] ?? '';
  const nounPhrase = afterTarget
    .split(/\b(?:adds?|to|with|from|until|gets?|gains?|loses?|can't|cannot|deals?)\b|[.;]/i)[0]
    .toLowerCase();
  return /\bplayers?\b/i.test(nounPhrase) ? 'player' : 'object';
}

function targetFilterForActivationRaw(raw: string, kind: TargetSelectionKind): TargetFilter {
  if (kind === 'player') {
    return {};
  }
  // Reuse the single graveyard-return recognizer shared with the compile-time guided path
  // (compile.ts). This keeps the activation-time target prompt in lockstep with the compiled
  // decision — a desync here silently drops the activation-time target selection (CR 602.2b).
  const graveyardReturnFilter = graveyardReturnFilterForRaw(raw);
  if (graveyardReturnFilter) {
    return graveyardReturnFilter;
  }
  const match = /\btarget\b([\s\S]*)/i.exec(raw);
  const afterTarget = match?.[1] ?? '';
  const nounPhrase = afterTarget
    .split(/\b(?:to|with|from|until|gets?|gains?|loses?|can't|cannot|deals?)\b|[.;]/i)[0]
    .toLowerCase();
  const supportedTypes = [
    'creature',
    'artifact',
    'enchantment',
    'land',
    'planeswalker',
    'permanent',
  ];
  const types = supportedTypes.filter((type) => new RegExp(`\\b${type}\\b`, 'i').test(nounPhrase));
  const excludedTypes = supportedTypes.filter((type) =>
    new RegExp(`\\bnon[-\\s]?${type}\\b`, 'i').test(nounPhrase),
  );
  const filter: TargetFilter = {
    types: types.length > 0 ? types : ['permanent'],
    ...(excludedTypes.length > 0 ? { excludedTypes } : {}),
    ...(/\bnontoken\b/i.test(nounPhrase) ? { excludeTokens: true } : {}),
    ...(/\banother\s+target\b|\bother\s+target\b/i.test(raw) ? { excludeSource: true } : {}),
  };
  if (/\byou control\b/i.test(raw)) {
    filter.controller = 'you';
  } else if (/\byou (?:don['’]t|do not) control\b|\bopponents? controls?\b/i.test(raw)) {
    filter.controller = 'opponent';
  }
  return filter;
}

function isSingleActivationTargetClause(raw: string): boolean {
  // The recognized graveyard-return shapes (exact-match + fixed-integer MV ceiling) are
  // single-target by construction; admit them before the generic guards below, whose
  // `target ... card` rejection would otherwise exclude the zone-scoped "card" noun phrase.
  if (graveyardReturnFilterForRaw(raw)) {
    return true;
  }
  if (!/\btarget\b/i.test(raw)) {
    return false;
  }
  if (/\bup to\b/i.test(raw)) {
    return false;
  }
  if (/\b(?:two|three|four|five|six|seven|eight|nine|ten|\d+)\s+target\b/i.test(raw)) {
    return false;
  }
  if (/\beach target\b/i.test(raw)) {
    return false;
  }
  if (/\bany number of target\b/i.test(raw)) {
    return false;
  }
  if (/\btarget\b[^.]*\bcard\b/i.test(raw)) {
    return false;
  }
  const targetMatches = raw.match(/\btarget\b/gi) ?? [];
  return targetMatches.length === 1;
}

function activationTargetPrompt(
  raw: string,
  atom: EffectPrompt['atom'],
  slotIndex: number,
): EffectPrompt | null {
  if (!isSingleActivationTargetClause(raw)) {
    return null;
  }
  const targetKind = targetKindForRaw(raw);
  return {
    atom,
    kind: 'target',
    count: 1,
    slotId: `target-${slotIndex}`,
    targetKind,
    filter: targetFilterForActivationRaw(raw, targetKind),
    raw,
  };
}

export function activationTargetPromptsForSource(
  state: GameState,
  sourceId: string,
  abilityLineIndex?: number,
): EffectPrompt[] {
  const source = state.cards[sourceId];
  if (!source) {
    return [];
  }
  const def = state.defs[source.defId];
  if (!def) {
    return [];
  }

  const resolvedIndex = abilityLineIndex ?? abilityLineIndexForKind(state, sourceId, 'activated');
  if (resolvedIndex === undefined) {
    return [];
  }

  const line = splitAbilityLines(def)[resolvedIndex];
  if (!line || line.shape !== 'activated') {
    return [];
  }

  const typeLine = def.faces[line.faceIndex]?.typeLine ?? def.typeLine;
  const ir = parseAbilityIR(line.text, typeLine);
  const prompts: EffectPrompt[] = [];
  for (const effect of ir.effects) {
    const prompt = activationTargetPrompt(effect.raw, effect.atom, prompts.length);
    if (prompt) {
      prompts.push(prompt);
    }
  }
  return prompts;
}

function targetSlotId(prompt: EffectPrompt, targetIndex: number): string {
  return prompt.slotId ?? `target-${targetIndex}`;
}

function storedTargetSelectionFor(
  card: CardInstance,
  prompt: EffectPrompt,
  targetIndex: number,
): TargetSelection | undefined {
  const selections = card.targetSelections ?? [];
  return selections.find((selection) => selection.slotId === targetSlotId(prompt, targetIndex));
}

export function guidedPlanForStackTop(
  state: GameState,
): { sourceId: string; prompts: EffectPrompt[]; commands: GameCommand[]; warnings: string[] } | null {
  const topId = state.zones.stack[state.zones.stack.length - 1];
  if (!topId) {
    return null;
  }
  const card = state.cards[topId];
  if (!card) {
    return null;
  }

  const prompts: EffectPrompt[] = [];
  // A guided line may mix deterministic effects with its choices (§32: mixed auto+guided is
  // still guided overall). Those compiled commands must ride the guided plan — they are
  // applied by finishGuidedResolution and NOT re-applied at resolveStackTop, which skips
  // non-auto lines. Dropping them would silently half-execute the line (CR 608.2c).
  const commands: GameCommand[] = [];
  const warnings: string[] = [];
  let sourceId: string | null = null;
  let targetIndex = 0;
  const commanderColorIdentity = commanderColorIdentityForState(state);
  for (const effectLine of effectLinesForStackItemState(state, card)) {
    const ir = parseAbilityIR(effectLine.line.text, effectLine.typeLine);
    const compiled = compileAbilityIR(ir, {
      sourceId: effectLine.sourceId,
      def: effectLine.def,
      controllerId: card.controllerId,
      commanderColorIdentity,
    });
    if (compiled.decision === 'manual') {
      const counterAssist = guidedCounterLeafForManualComposite(ir);
      if (counterAssist) {
        sourceId = sourceId ?? effectLine.sourceId;
        const normalizedPrompt = {
          ...counterAssist.prompt,
          slotId: targetSlotId(counterAssist.prompt, targetIndex),
        };
        if (!storedTargetSelectionFor(card, normalizedPrompt, targetIndex)) {
          prompts.push(normalizedPrompt);
        }
        targetIndex += 1;
        warnings.push(counterAssist.warning);
      }
      continue;
    }
    if (compiled.decision !== 'guided') {
      continue;
    }
    sourceId = sourceId ?? effectLine.sourceId;
    commands.push(
      ...(lineHasSelfSacrifice(effectLine.line.text)
        ? withSelfSacrificeReason(compiled.commands, effectLine.sourceId)
        : compiled.commands),
    );
    for (const prompt of compiled.prompts) {
      if (prompt.kind === 'target') {
        const normalizedPrompt = { ...prompt, slotId: targetSlotId(prompt, targetIndex) };
        if (!storedTargetSelectionFor(card, normalizedPrompt, targetIndex)) {
          prompts.push(normalizedPrompt);
        }
        targetIndex += 1;
      } else {
        prompts.push(prompt);
      }
    }
  }

  return sourceId && prompts.length > 0 ? { sourceId, prompts, commands, warnings } : null;
}

export function activationPlanForSource(
  state: GameState,
  sourceId: string,
  abilityLineIndex?: number,
): {
  commands: GameCommand[];
  decision: CostDecision;
  manaShortfall: number;
  costComponents: ActivationCostComponent[];
  costPrompts: EffectPrompt[];
} | null {
  const source = state.cards[sourceId];
  if (state.effectsAuto === false || source?.effectsAuto === false) {
    return null;
  }
  if (!source) {
    return {
      commands: [],
      decision: 'manual',
      manaShortfall: 0,
      costComponents: [],
      costPrompts: [],
    };
  }

  const def = state.defs[source.defId];
  if (!def) {
    return {
      commands: [],
      decision: 'manual',
      manaShortfall: 0,
      costComponents: [],
      costPrompts: [],
    };
  }

  const resolvedIndex = abilityLineIndex ?? abilityLineIndexForKind(state, sourceId, 'activated');
  if (resolvedIndex === undefined) {
    return {
      commands: [],
      decision: 'manual',
      manaShortfall: 0,
      costComponents: [],
      costPrompts: [],
    };
  }

  const line = splitAbilityLines(def)[resolvedIndex];
  if (!line || line.shape !== 'activated') {
    return {
      commands: [],
      decision: 'manual',
      manaShortfall: 0,
      costComponents: [],
      costPrompts: [],
    };
  }

  const typeLine = def.faces[line.faceIndex]?.typeLine ?? def.typeLine;
  const ir = parseAbilityIR(line.text, typeLine);
  const commanderColorIdentity = commanderColorIdentityForState(state);
  const sourceSnapshot = objectSnapshotForCard(state, sourceId);
  const nonmanaCost =
    sourceSnapshot && ir.cost
      ? activationNonmanaCosts(state, ir.cost.raw, sourceSnapshot)
      : { components: [], commands: [], prompts: [], remainingRaw: ir.cost?.raw ?? '' };
  const autoCost = ir.cost ? abilityCostFromRaw(nonmanaCost.remainingRaw) : null;
  const compiledCost = compileAbilityCost(autoCost, {
    sourceId,
    def,
    controllerId: source.controllerId,
    commanderColorIdentity,
  });
  if (compiledCost.decision === 'manual') {
    return {
      commands: [],
      decision: 'manual',
      manaShortfall: 0,
      costComponents: sourceSnapshot
        ? activationCostComponents(
            sourceId,
            sourceSnapshot,
            ir.cost?.raw ?? '',
            compiledCost.manaCost,
            compiledCost.commands,
            'manual',
          )
        : [],
      costPrompts: [],
    };
  }

  const commands: GameCommand[] = autoCost?.sacrificesSelf
    ? withSelfSacrificeReason(compiledCost.commands, sourceId)
    : compiledCost.commands.slice();
  let manaShortfall = 0;
  if (compiledCost.manaCost !== null) {
    const plan = planAutoTap(state, parseManaCost(compiledCost.manaCost), 0, source.controllerId);
    commands.push(
      ...autoTapCommands(plan, source.controllerId),
      {
        type: 'payMana',
        payment: plan.payment,
        ...(source.controllerId !== 'P1' ? { playerId: source.controllerId } : {}),
      },
    );
    manaShortfall = plan.shortfall;
  }
  commands.push(...nonmanaCost.commands);

  return {
    commands,
    decision: 'auto',
    manaShortfall,
    costComponents: sourceSnapshot
      ? [
          ...activationCostComponents(
            sourceId,
            sourceSnapshot,
            ir.cost?.raw ?? '',
            compiledCost.manaCost,
            commands,
            'auto',
          ),
          ...nonmanaCost.components,
        ]
      : [],
    costPrompts: nonmanaCost.prompts,
  };
}

export function activatedManaAbilityPlanForSource(
  state: GameState,
  sourceId: string,
  abilityLineIndex?: number,
): {
  commands: GameCommand[];
  decision: AutoDecision | 'assisted';
  prompts: EffectPrompt[];
  manaShortfall: number;
  lifeCost: number;
  restrictionText?: string;
} | null {
  const source = state.cards[sourceId];
  if (!source) {
    return null;
  }

  const def = state.defs[source.defId];
  if (!def) {
    return null;
  }

  const resolvedIndex = abilityLineIndex ?? abilityLineIndexForKind(state, sourceId, 'activated');
  if (resolvedIndex === undefined) {
    return null;
  }

  const line = splitAbilityLines(def)[resolvedIndex];
  if (!line || line.shape !== 'activated') {
    return null;
  }

  const typeLine = def.faces[line.faceIndex]?.typeLine ?? def.typeLine;
  if (isLoyaltyAbilityLine(line.text, typeLine)) {
    return null;
  }

  const ir = parseAbilityIR(line.text, typeLine);
  if (!isActivatedManaAbilityIR(ir)) {
    return null;
  }

  const commanderColorIdentity = commanderColorIdentityForState(state);
  const compiledCost = compileAbilityCost(ir.cost, {
    sourceId,
    def,
    controllerId: source.controllerId,
    commanderColorIdentity,
  });
  if (compiledCost.decision === 'manual') {
    return { commands: [], decision: 'manual', prompts: [], manaShortfall: 0, lifeCost: 0 };
  }

  const compiledEffect = compileAbilityIR(ir, {
    sourceId,
    def,
    controllerId: source.controllerId,
    commanderColorIdentity,
  });
  if (compiledEffect.decision === 'manual') {
    const restrictionText = restrictedLiteralManaAssistText(ir, compiledEffect.commands);
    if (restrictionText === null) {
      return { commands: [], decision: 'manual', prompts: [], manaShortfall: 0, lifeCost: 0 };
    }
    const costCommands = ir.cost?.sacrificesSelf
      ? withSelfSacrificeReason(compiledCost.commands, sourceId)
      : compiledCost.commands.slice();
    return {
      commands: [...costCommands, ...compiledEffect.commands],
      decision: 'assisted',
      prompts: [],
      manaShortfall: 0,
      lifeCost: compiledCost.commands.reduce(
        (total, command) =>
          total + (command.type === 'adjustLife' && command.delta < 0 ? -command.delta : 0),
        0,
      ),
      restrictionText,
    };
  }
  if (
    compiledEffect.decision === 'guided' &&
    compiledEffect.prompts.some((prompt) => prompt.kind !== 'mana')
  ) {
    return { commands: [], decision: 'manual', prompts: [], manaShortfall: 0, lifeCost: 0 };
  }

  const commands: GameCommand[] = ir.cost?.sacrificesSelf
    ? withSelfSacrificeReason(compiledCost.commands, sourceId)
    : compiledCost.commands.slice();
  const lifeCost = compiledCost.commands.reduce(
    (total, command) =>
      total + (command.type === 'adjustLife' && command.delta < 0 ? -command.delta : 0),
    0,
  );
  let manaShortfall = 0;
  if (compiledCost.manaCost !== null) {
    const plan = planAutoTap(state, parseManaCost(compiledCost.manaCost), 0, source.controllerId);
    commands.push(
      ...autoTapCommands(plan, source.controllerId),
      {
        type: 'payMana',
        payment: plan.payment,
        ...(source.controllerId !== 'P1' ? { playerId: source.controllerId } : {}),
      },
    );
    manaShortfall = plan.shortfall;
  }
  commands.push(...compiledEffect.commands);

  return {
    commands,
    decision: compiledEffect.decision,
    prompts: compiledEffect.prompts,
    manaShortfall,
    lifeCost,
  };
}

function restrictedLiteralManaAssistText(
  ir: ReturnType<typeof parseAbilityIR>,
  commands: readonly GameCommand[],
): string | null {
  if (
    !ir.constructs.includes('construct.mana-restriction') ||
    ir.constructs.some((construct) => construct !== 'construct.mana-restriction') ||
    ir.effects.some((effect) => effect.atom !== 'effect.add-mana') ||
    commands.length === 0 ||
    commands.some((command) => command.type !== 'addMana')
  ) {
    return null;
  }
  return ir.effectClauses.find((clause) =>
    /\b(?:spend|use) this mana only\b|\bthis mana (?:can't|cannot) be spent\b|\bspend (?:that|this) mana\b/i.test(clause),
  ) ?? null;
}

function commanderColorIdentityForState(state: GameState): ManaColor[] {
  const colors = new Set<ManaColor>();
  for (const commander of state.commanders) {
    const card = state.cards[commander.cardId];
    const def = card ? state.defs[card.defId] : undefined;
    for (const color of def?.colorIdentity ?? []) {
      if (isColoredMana(color)) {
        colors.add(color);
      }
    }
  }
  return COLORED_MANA.filter((color) => colors.has(color));
}

function isColoredMana(value: string): value is ManaColor {
  return COLORED_MANA.includes(value as ManaColor);
}

function isActivatedManaAbilityIR(ir: ReturnType<typeof parseAbilityIR>): boolean {
  if (ir.shape !== 'activated') {
    return false;
  }
  if (ir.constructs.includes('construct.target')) {
    return false;
  }
  return ir.effects.some((effect) => effect.atom === 'effect.add-mana');
}

function isLoyaltyAbilityLine(text: string, typeLine: string): boolean {
  return /\bPlaneswalker\b/i.test(typeLine) && /^\s*[+−-]\d+\s*:/.test(text);
}

// CR 108.2: card types that could exist as a permanent if put onto the battlefield. Used only
// to evaluate the "permanent" pseudo-type for graveyard-zone target filters (e.g. "Return
// target permanent card ... from your graveyard to the battlefield"); instant/sorcery cards
// are excluded, matching the "permanent card" wording.
const GRAVEYARD_PERMANENT_CARD_TYPES = ['artifact', 'creature', 'enchantment', 'land', 'planeswalker'];

export function eligibleTargets(
  state: GameState,
  filter: TargetFilter,
  context: { sourceId?: string } = {},
): string[] {
  const sourceControllerId = context.sourceId
    ? state.cards[context.sourceId]?.controllerId ?? state.localPlayerId
    : state.localPlayerId;
  const zone = filter.zone ?? 'battlefield';
  const types = filter.types ?? (zone === 'stack' ? [] : ['permanent']);
  const excludedTypes = filter.excludedTypes ?? [];
  if (zone === 'stack') {
    const acceptsAnySpell = types.length === 0;
    const acceptedKinds = filter.stackKinds ?? ['spell'];
    return state.zones.stack.filter((cardId) => {
      const card = state.cards[cardId];
      if (!card || card.zone !== 'stack') {
        return false;
      }
      const stackKind = !card.isAbility
        ? 'spell'
        : card.abilityKind === 'activated'
          ? 'activated-ability'
          : card.abilityKind === 'triggered'
            ? 'triggered-ability'
            : null;
      if (!stackKind || !acceptedKinds.includes(stackKind)) return false;
      if (context.sourceId === cardId) {
        return false;
      }
      if (filter.controller === 'you' && card.controllerId !== sourceControllerId) {
        return false;
      }
      if (filter.controller === 'opponent' && card.controllerId === sourceControllerId) {
        return false;
      }
      if (filter.owner === 'you' && card.ownerId !== sourceControllerId) {
        return false;
      }
      if (filter.owner === 'opponent' && card.ownerId === sourceControllerId) {
        return false;
      }
      if (filter.excludeTokens && card.isToken) {
        return false;
      }

      // Ability objects have only their ability text (CR 405.4), so card-type filters apply
      // exclusively to spells. Ability-aware callers use stackKinds without types.
      if (card.isAbility && types.length > 0) return false;
      const typeLine = typeLineForStateCard(state, card);
      if (excludedTypes.some((type) => typeLineHasType(typeLine, type))) {
        return false;
      }
      return acceptsAnySpell || types.some((type) => typeLineHasType(typeLine, type));
    });
  }
  if (zone === 'graveyard') {
    const supportsCreatureCard = types.includes('creature');
    // CR 108.2: "permanent card" = a card whose card type could enter the battlefield
    // (excludes instant/sorcery). Only reached when the filter's noun is "permanent"
    // (e.g. the "Return target permanent card with mana value N or less ..." leaf);
    // additive alongside the pre-existing creature-only path so unfiltered/creature
    // filters are unaffected.
    const supportsPermanentCard = types.includes('permanent');
    const graveyardIds = state.turnOrder.flatMap(
      (playerId) => state.zonesByPlayer[playerId]?.graveyard ?? [],
    );
    return graveyardIds.filter((cardId) => {
      const card = state.cards[cardId];
      if (!card || card.isAbility || card.zone !== 'graveyard') {
        return false;
      }
      if (filter.excludeSource && context.sourceId === cardId) {
        return false;
      }
      if (filter.owner === 'you' && card.ownerId !== sourceControllerId) {
        return false;
      }
      if (filter.owner === 'opponent' && card.ownerId === sourceControllerId) {
        return false;
      }
      if (filter.excludeTokens && card.isToken) {
        return false;
      }
      if (!supportsCreatureCard && !supportsPermanentCard) {
        return false;
      }
      const def = state.defs[card.defId];
      const face = def?.faces[card.faceIndex] ?? def?.faces[0];
      const typeLine = (face?.typeLine ?? def?.typeLine ?? '').toLowerCase();
      if (excludedTypes.some((type) => typeLine.includes(type.toLowerCase()))) {
        return false;
      }
      const matchesRequestedCard = supportsCreatureCard
        ? typeLine.includes('creature')
        : GRAVEYARD_PERMANENT_CARD_TYPES.some((type) => typeLine.includes(type));
      if (!matchesRequestedCard) {
        return false;
      }
      if (filter.maxManaValue !== undefined) {
        const manaValue = manaValueOfStackObject(card, face?.manaCost, def?.cmc);
        if (manaValue === undefined || manaValue > filter.maxManaValue) {
          return false;
        }
      }
      return true;
    });
  }
  const acceptsAnyPermanent = types.length === 0 || types.includes('permanent');

  return state.zones.battlefield.filter((cardId) => {
    const card = state.cards[cardId];
    if (!card || card.isAbility) {
      return false;
    }
    if (filter.excludeSource && context.sourceId === cardId) {
      return false;
    }
    if (filter.controller === 'you' && card.controllerId !== sourceControllerId) {
      return false;
    }
    if (filter.controller === 'opponent' && card.controllerId === sourceControllerId) {
      return false;
    }
    if (filter.owner === 'you' && card.ownerId !== sourceControllerId) {
      return false;
    }
    if (filter.owner === 'opponent' && card.ownerId === sourceControllerId) {
      return false;
    }
    const typeLine = typeLineForStateCard(state, card);
    if (filter.excludeTokens && card.isToken) {
      return false;
    }
    if (excludedTypes.some((type) => typeLineHasType(typeLine, type))) {
      return false;
    }
    if (acceptsAnyPermanent) {
      return true;
    }
    return types.some((type) => typeLineHasType(typeLine, type));
  });
}

function typeLineForStateCard(state: GameState, card: CardInstance): string {
  return effectiveTypeLine(stateWithCardForTypeRead(state, card), card.id);
}

function typeLineHasType(typeLine: string, type: string): boolean {
  return new RegExp(`\\b${type}\\b`, 'i').test(typeLine);
}

function withMoveReason(
  commands: readonly GameCommand[],
  reason: ZoneChangeReason,
): GameCommand[] {
  return commands.map((cmd) =>
    cmd.type === 'moveCard' && cmd.to === 'graveyard' && cmd.reason === undefined
      ? { ...cmd, reason }
      : cmd,
  );
}

function withSelfSacrificeReason(
  commands: readonly GameCommand[],
  sourceId: string,
): GameCommand[] {
  return commands.map((cmd) =>
    cmd.type === 'moveCard' &&
    cmd.cardId === sourceId &&
    cmd.to === 'graveyard' &&
    cmd.reason === undefined
      ? { ...cmd, reason: 'sacrifice' }
      : cmd,
  );
}

function lineHasSelfSacrifice(raw: string): boolean {
  return /\bsacrifice\b[^.。]*(?:\b(?:this|it|itself|self)\b|~)/i.test(raw);
}

function applyAutoCommand(draft: Draft, cmd: GameCommand): void {
  switch (cmd.type) {
    case 'moveCard': {
      applyMoveCardCommand(draft, cmd);
      break;
    }
    case 'setTapped': {
      const target = requireCard(draft, cmd.cardId);
      if (target.tapped !== cmd.tapped) {
        setCard(draft, { ...target, tapped: cmd.tapped });
        pushLog(
          draft,
          `${nameOf(draft, cmd.cardId)}を${cmd.tapped ? 'タップ' : 'アンタップ'}しました。`,
        );
      }
      break;
    }
    case 'addCounters': {
      applyAddCounters(draft, cmd.cardId, cmd.counterType, cmd.delta);
      break;
    }
    case 'dealDamage': {
      applyDealDamage(draft, cmd);
      break;
    }
    case 'draw': {
      const playerId = cmd.playerId ?? draft.state.localPlayerId;
      const drawn = drawCards(draft, Math.max(0, cmd.count), commandCause(cmd.type), playerId);
      incrementDrawnThisTurn(draft, playerId, drawn);
      pushLog(draft, `カードを${drawn}枚引きました。`);
      if (drawn < cmd.count) {
        draft.warnings.push('ライブラリが足りずすべて引けませんでした。');
      }
      break;
    }
    case 'mill': {
      applyMill(draft, cmd.count, cmd.playerId ?? draft.state.localPlayerId);
      break;
    }
    case 'shuffle': {
      applyShuffle(draft, cmd.order, cmd.playerId ?? draft.state.localPlayerId);
      break;
    }
    case 'adjustLife': {
      applyLifeDeltaForPlayer(
        draft,
        cmd.playerId ?? draft.state.localPlayerId,
        cmd.delta,
        commandCause(cmd.type),
      );
      break;
    }
    case 'adjustPlayerCounter': {
      applyPlayerCounterDelta(
        draft,
        cmd.playerId ?? draft.state.localPlayerId,
        cmd.kind,
        cmd.delta,
      );
      break;
    }
    case 'applyPlayerEffect': {
      applyPlayerEffect(draft, cmd);
      break;
    }
    case 'addMana': {
      const amount = Math.max(0, cmd.amount);
      if (amount > 0) {
        const playerId = cmd.playerId ?? draft.state.localPlayerId;
        const pool = { ...manaPoolFor(draft, playerId) };
        pool[cmd.color] += amount;
        setManaPoolFor(draft, playerId, pool);
        pushLog(draft, `${cmd.color}マナを${amount}点加えました。`);
      }
      break;
    }
    case 'createToken': {
      applyCreateToken(
        draft,
        cmd.name,
        cmd.typeLine,
        cmd.power,
        cmd.toughness,
        cmd.quantity,
        cmd.producedMana,
        cmd.tokenKind,
        { createdBy: cmd.createdBy },
      );
      break;
    }
    case 'createDefinedToken': {
      applyCreateDefinedToken(draft, cmd);
      break;
    }
    default:
      break;
  }
}

function applyAutoCommands(draft: Draft, commands: readonly GameCommand[]): void {
  for (const cmd of commands) {
    applyAutoCommand(draft, cmd);
  }
}

function cardIdForStoredObjectTarget(draft: Draft, selection: TargetSelection): string | null {
  if (selection.selection.kind !== 'object') {
    return null;
  }
  const card = draft.state.cards[selection.selection.physicalCardId];
  if (!card || objectIdOf(card) !== selection.selection.objectId) {
    return null;
  }
  return card.id;
}

function sourceObjectIdForGuidedContext(
  draft: Draft,
  stackItem: CardInstance,
  sourceId: string,
): string | undefined {
  const source = draft.state.cards[sourceId];
  return source ? objectIdOf(source) : stackItem.sourceSnapshot?.objectId;
}

function applyStoredTargetCommands(
  draft: Draft,
  card: CardInstance,
  compiledPrompts: readonly EffectPrompt[],
  sourceId: string,
  def: CardDef,
): boolean {
  let applied = false;
  let targetIndex = 0;
  for (const prompt of compiledPrompts) {
    if (prompt.kind !== 'target') {
      continue;
    }
    const normalizedPrompt = { ...prompt, slotId: targetSlotId(prompt, targetIndex) };
    const selection = storedTargetSelectionFor(card, normalizedPrompt, targetIndex);
    targetIndex += 1;
    if (!selection) {
      continue;
    }

    const targetCardId = cardIdForStoredObjectTarget(draft, selection);
    if (!targetCardId) {
      draft.warnings.push(
        `${stackNameOf(draft, card)}の保存済み対象は現在のオブジェクトではありません。`,
      );
      continue;
    }
    const expectedZone = normalizedPrompt.filter?.zone;
    if (expectedZone && draft.state.cards[targetCardId]?.zone !== expectedZone) {
      draft.warnings.push(`${stackNameOf(draft, card)}の保存済み対象は期待した領域にありません。`);
      continue;
    }

    const commands = buildGuidedCommands(
      normalizedPrompt,
      {
        kind: 'target',
        cardIds: [targetCardId],
        targetSnapshots:
          selection.selection.kind === 'object' ? [selection.selection.snapshot] : [],
      },
      {
        sourceId,
        def,
        sourceObjectId: sourceObjectIdForGuidedContext(draft, card, sourceId),
        ...(card.abilityLineIndex === undefined
          ? {}
          : { abilityLineIndex: card.abilityLineIndex }),
      },
    );
    applyAutoCommands(
      draft,
      normalizedPrompt.atom === 'effect.sacrifice'
        ? withMoveReason(commands, 'sacrifice')
        : commands,
    );
    applied = true;
  }
  return applied;
}

function sourceSnapshotForResolvedEffectLine(
  draft: Draft,
  stackItem: CardInstance,
  sourceId: string,
): ObjectSnapshot | null {
  if (stackItem.isAbility && stackItem.sourceSnapshot) {
    return stackItem.sourceSnapshot;
  }
  const source = draft.state.cards[sourceId];
  if (source) {
    return objectSnapshotOf(draft, source);
  }
  if (!stackItem.isAbility) {
    return objectSnapshotOf(draft, stackItem);
  }
  return null;
}

function scheduleDelayedTriggerForEffectLine(
  draft: Draft,
  stackItem: CardInstance,
  effectLine: ResolvableEffectLine,
  lineIndex: number,
): boolean {
  if (!hasDelayedPhaseBeginTiming(effectLine.line.text)) {
    return false;
  }

  const sourceSnapshot = sourceSnapshotForResolvedEffectLine(draft, stackItem, effectLine.sourceId);
  if (!sourceSnapshot) {
    draft.warnings.push(`${stackNameOf(draft, stackItem)}の遅延誘発の発生源を特定できません。`);
    return true;
  }

  const eventId = [
    'delayed',
    draft.state.turn,
    draft.state.phase,
    draft.nextSeq,
    sourceSnapshot.objectId,
    lineIndex,
  ].join(':');
  const pending = makeScheduledDelayedTrigger(
    draft.state,
    sourceSnapshot,
    effectLine.line.text,
    eventId,
  );
  if (!pending) {
    return false;
  }

  appendPendingTrigger(draft, pending);
  pushLog(
    draft,
    `《${cardName(draft.state.defs[sourceSnapshot.defId])}》の遅延誘発を予約しました。`,
  );
  return true;
}

function applyCompiledEffectsForStackItem(
  draft: Draft,
  card: CardInstance,
  effectLines: readonly ResolvableEffectLine[],
  libraryShuffleOrder?: readonly string[],
): void {
  const commanderColorIdentity = commanderColorIdentityForState(draft.state);
  for (const [lineIndex, effectLine] of effectLines.entries()) {
    if (scheduleDelayedTriggerForEffectLine(draft, card, effectLine, lineIndex)) {
      continue;
    }
    const ir = parseAbilityIR(effectLine.line.text, effectLine.typeLine);
    const compiled = compileAbilityIR(ir, {
      sourceId: effectLine.sourceId,
      def: effectLine.def,
      controllerId: card.controllerId,
      commanderColorIdentity,
      ...(isPureSelfLibraryShuffleLine(effectLine.line.text) && libraryShuffleOrder
        ? { libraryShuffleOrder }
        : {}),
    });
    if (compiled.decision !== 'auto') {
      if (compiled.decision === 'guided') {
        const applied = applyStoredTargetCommands(
          draft,
          card,
          compiled.prompts,
          effectLine.sourceId,
          effectLine.def,
        );
        if (applied) {
          pushLog(draft, `${stackNameOf(draft, card)}の保存済み対象への効果を実行した。`);
        }
      }
      continue;
    }
    applyAutoCommands(
      draft,
      lineHasSelfSacrifice(effectLine.line.text)
        ? withSelfSacrificeReason(compiled.commands, effectLine.sourceId)
        : compiled.commands,
    );
    pushLog(draft, `${stackNameOf(draft, card)}の効果を自動実行した。`);
  }
}

function isPureSelfLibraryShuffleLine(raw: string): boolean {
  return /^(?:you\s+)?shuffle(?:\s+(?:your|the)\s+library)?[.。]?$/i.test(
    raw.replace(/\s+/g, ' ').trim(),
  );
}

function applyResolveStackTop(
  draft: Draft,
  to?: ZoneId,
  libraryShuffleOrder?: readonly string[],
): void {
  const stack = draft.state.zones.stack;
  if (stack.length === 0) return;

  const topId = stack[stack.length - 1];
  const card = requireCard(draft, topId);
  const effectLines = effectLinesForResolvedStackItem(draft, card);

  if (card.isAbility) {
    deleteCardFromState(draft, topId);
    pushLog(draft, `${stackNameOf(draft, card)}の能力を解決した。`);
    applyCompiledEffectsForStackItem(draft, card, effectLines, libraryShuffleOrder);
    return;
  }

  const destination = to ?? defaultStackResolveDestination(draft, card);
  moveCardInternal(draft, topId, destination, 'bottom', false, 'resolve');
  pushLog(draft, `${stackNameOf(draft, card)}を解決した(→${ZONE_LABELS[destination]})。`);
  applyCompiledEffectsForStackItem(draft, card, effectLines, libraryShuffleOrder);
}

function applyRemoveStackItem(draft: Draft, id: string, to?: ZoneId): void {
  if (!draft.state.zones.stack.includes(id)) {
    throw new EngineError(`スタックに存在しないカードです: ${id}`);
  }

  const card = requireCard(draft, id);
  if (card.isAbility) {
    deleteCardFromState(draft, id);
    pushLog(draft, `${stackNameOf(draft, card)}の能力を取り除いた。`);
    return;
  }

  const destination = to ?? 'graveyard';
  moveCardInternal(draft, id, destination, 'bottom', false);
  pushLog(draft, `${stackNameOf(draft, card)}を打ち消した(→${ZONE_LABELS[destination]})。`);
}

function applyCopyStackItem(draft: Draft, cardId: string): void {
  if (!draft.state.zones.stack.includes(cardId)) {
    throw new EngineError(`スタックに存在しないカードです: ${cardId}`);
  }

  const source = requireCard(draft, cardId);
  const stack = editZone(draft, 'stack');
  const cards = { ...draft.state.cards };

  if (source.isAbility) {
    const abilityId = nextAbilityId(draft.state);
    cards[abilityId] = createAbilityObject(
      abilityId,
      source.sourceId ?? cardId,
      source.defId,
      source.abilityKind ?? 'activated',
      source.abilityLineIndex,
      source.ownerId,
      source.controllerId,
      source.sourceSnapshot,
      source.targetSelections ?? [],
      source.activationEnvelope,
    );
    draft.state.cards = cards;
    stack.push(abilityId);
    pushLog(draft, `${stackNameOf(draft, source)}の能力をコピーした。`);
    return;
  }

  const copyId = nextCopyId(draft.state);
  cards[copyId] = {
    id: copyId,
    defId: source.defId,
    zone: 'stack',
    ownerId: source.ownerId,
    controllerId: source.controllerId,
    zoneChangeCounter: 0,
    tapped: false,
    faceIndex: source.faceIndex,
    faceDown: source.faceDown,
    counters: {},
    damageMarked: 0,
    hasDeathtouchDamage: false,
    isToken: false,
    isCommander: false,
    enteredTurn: 0,
    isCopy: true,
    // CR 707.10: copying a spell copies choices made for it, including
    // targets. A later "new targets" effect may replace them separately.
    targetSelections: source.targetSelections?.map((selection) => ({ ...selection })),
    // CR 707.10: the announced value of X is one of the copied choices.
    announcedX: source.announcedX,
  };
  draft.state.cards = cards;
  stack.push(copyId);
  pushLog(draft, `${stackNameOf(draft, source)}をコピーした(スタックへ)。`);
}

function applyCopyPermanent(draft: Draft, cardId: string, quantity: number): void {
  const source = requireCard(draft, cardId);
  const qty = Math.max(0, Math.floor(quantity));
  if (qty === 0) return;

  const genId = nextTokenId(draft.state);
  const cards = { ...draft.state.cards };
  const battlefield = editZone(draft, 'battlefield');

  for (let i = 1; i <= qty; i++) {
    const token = applyBattlefieldEntryEffects(draft, {
      id: genId(i),
      defId: source.defId,
      zone: 'battlefield',
      ownerId: source.ownerId,
      controllerId: source.controllerId,
      zoneChangeCounter: 0,
      tapped: false,
      faceIndex: source.faceIndex,
      faceDown: source.faceDown,
      counters: {},
      damageMarked: 0,
      hasDeathtouchDamage: false,
      isToken: true,
      isCommander: false,
      enteredTurn: 0,
    });
    cards[token.id] = token;
    battlefield.push(token.id);
  }

  draft.state.cards = cards;
  pushLog(draft, `${nameOf(draft, cardId)}のコピー・トークンを${qty}個作った。`);
}

// ---------------------------------------------------------------------------
// Treasure / token handling
// ---------------------------------------------------------------------------

function applyCrackTreasure(draft: Draft, cardId: string, color: ManaColor): void {
  const card = requireCard(draft, cardId);
  const def = draft.state.defs[card.defId];
  if (def?.tokenKind !== 'treasure') {
    throw new EngineError(`宝物ではないカードです: ${cardId}`);
  }
  if (card.zone !== 'battlefield') {
    throw new EngineError(`宝物は戦場でのみ割れます: ${cardId}`);
  }

  const pool = manaPoolFor(draft, card.controllerId);
  setManaPoolFor(draft, card.controllerId, { ...pool, [color]: pool[color] + 1 });
  moveCardInternal(draft, cardId, 'graveyard', 'top', false, 'cost');
  pushLog(draft, `${nameOfCard(draft, card)}を割って${color}マナを1点加えました。`);
}

// ---------------------------------------------------------------------------
// Token creation
// ---------------------------------------------------------------------------

function nextTokenId(state: GameState): (offset: number) => string {
  let max = 0;
  for (const id of Object.keys(state.cards)) {
    if (id.startsWith('t')) {
      const n = parseInt(id.slice(1), 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return (offset: number) => `t${max + offset}`;
}

function nextTokenDefId(state: GameState): string {
  let max = 0;
  for (const id of Object.keys(state.defs)) {
    if (id.startsWith('token:')) {
      const n = parseInt(id.slice('token:'.length), 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return `token:${max + 1}`;
}

type CreateDefinedTokenCommand = Extract<GameCommand, { type: 'createDefinedToken' }>;

interface CreateTokenOptions {
  createdBy?: PlayerId;
  initialTapped?: boolean;
}

function applyCreateDefinedToken(draft: Draft, cmd: CreateDefinedTokenCommand): void {
  applyCreateToken(
    draft,
    cmd.name,
    cmd.typeLine,
    cmd.power,
    cmd.toughness,
    cmd.quantity,
    undefined,
    cmd.tokenKind,
    {
      createdBy: cmd.createdBy,
      initialTapped: cmd.initialTapped,
    },
  );
}

type CreateScenarioDummyCommand = Extract<GameCommand, { type: 'createScenarioDummy' }>;

function applyCreateScenarioDummy(draft: Draft, cmd: CreateScenarioDummyCommand): void {
  requirePlayer(draft.state, cmd.playerId);
  if (draft.state.cards[cmd.cardId]) {
    throw new EngineError(`scenario dummyのcardIdが重複しています: ${cmd.cardId}`);
  }
  if (draft.state.defs[cmd.defId]) {
    throw new EngineError(`scenario dummyのdefIdが重複しています: ${cmd.defId}`);
  }
  const name = cmd.name.trim();
  const typeLine = cmd.typeLine.trim();
  if (name === '' || typeLine === '') {
    throw new EngineError('scenario dummyの名前とカードタイプは必須です。');
  }
  const scenarioTypes = new Set(['Creature', 'Artifact', 'Enchantment', 'Land', 'Planeswalker']);
  if (typeLine.split(/\s+/).some((type) => !scenarioTypes.has(type))) {
    throw new EngineError('scenario dummyに指定できないカードタイプが含まれています。');
  }
  if (
    typeLine.includes('Creature')
    && (!/^[+-]?\d+$/.test((cmd.power ?? '0').trim())
      || !/^[+-]?\d+$/.test((cmd.toughness ?? '0').trim()))
  ) {
    throw new EngineError('scenario dummy creatureの基礎P/Tには整数が必要です。');
  }
  const counters = Object.fromEntries(
    Object.entries(cmd.counters)
      .filter(([counterType, amount]) => counterType.trim() !== '' && Number.isFinite(amount) && amount > 0)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([counterType, amount]) => [counterType.trim(), Math.floor(amount)]),
  );
  const def: CardDef = {
    scryfallId: cmd.defId,
    oracleId: cmd.defId,
    name,
    lang: 'en',
    layout: 'scenario',
    cmc: 0,
    colorIdentity: [],
    typeLine,
    keywords: normalizeKeywords(cmd.keywords),
    faces: [{
      name,
      typeLine,
      ...(typeLine.includes('Creature')
        ? { power: cmd.power ?? '0', toughness: cmd.toughness ?? '0' }
        : {}),
    }],
  };
  const permanent = applyBattlefieldEntryEffects(draft, {
    id: cmd.cardId,
    defId: cmd.defId,
    zone: 'battlefield',
    ownerId: cmd.playerId,
    controllerId: cmd.playerId,
    zoneChangeCounter: 0,
    tapped: cmd.tapped,
    faceIndex: 0,
    faceDown: false,
    counters,
    damageMarked: 0,
    hasDeathtouchDamage: false,
    isToken: cmd.isToken,
    isScenarioDummy: true,
    isCommander: false,
    enteredTurn: 0,
    manualKeywords: normalizeKeywords(cmd.keywords),
  });
  draft.state.defs = { ...draft.state.defs, [cmd.defId]: def };
  draft.state.cards = { ...draft.state.cards, [cmd.cardId]: permanent };
  editZone(draft, 'battlefield').push(cmd.cardId);
  pushLog(draft, `${requirePlayer(draft.state, cmd.playerId).label}のダミー《${name}》を作成した。`);
}

function applyCreateToken(
  draft: Draft,
  name: string,
  typeLine: string,
  power: string | undefined,
  toughness: string | undefined,
  quantity: number,
  producedMana: ManaColor[] | undefined,
  tokenKind: CardDef['tokenKind'],
  options: CreateTokenOptions = {},
): void {
  const qty = Math.max(0, Math.floor(quantity));
  if (qty === 0) return;
  const ownerController = options.createdBy ?? draft.state.localPlayerId;
  requirePlayer(draft.state, ownerController);
  const initialTapped = options.initialTapped ?? false;

  const defId = nextTokenDefId(draft.state);
  const def: CardDef = {
    scryfallId: defId,
    oracleId: defId,
    name,
    lang: 'en',
    layout: 'token',
    cmc: 0,
    colorIdentity: [],
    typeLine,
    producedMana,
    tokenKind,
    faces: [
      {
        name,
        typeLine,
        power,
        toughness,
      },
    ],
  };
  draft.state.defs = { ...draft.state.defs, [defId]: def };

  const genId = nextTokenId(draft.state);
  const cards = { ...draft.state.cards };
  const battlefield = editZone(draft, 'battlefield');
  for (let i = 1; i <= qty; i++) {
    const id = genId(i);
    const token = applyBattlefieldEntryEffects(draft, {
      id,
      defId,
      zone: 'battlefield',
      ownerId: ownerController,
      controllerId: ownerController,
      zoneChangeCounter: 0,
      tapped: initialTapped,
      faceIndex: 0,
      faceDown: false,
      counters: {},
      damageMarked: 0,
      hasDeathtouchDamage: false,
      isToken: true,
      isCommander: false,
      enteredTurn: 0,
    });
    cards[id] = token;
    battlefield.push(id);
  }
  draft.state.cards = cards;
  pushLog(draft, `トークン《${name}》を${qty}個生成しました。`);
}

// ---------------------------------------------------------------------------
// Mulligan
// ---------------------------------------------------------------------------

function applyMulligan(
  draft: Draft,
  order: string[],
  playerId = draft.state.localPlayerId,
): void {
  const hand = readZone(draft, 'hand', playerId).slice();
  // Move all hand cards back into library (state reset), then reorder library
  // by the provided permutation (hand + library combined).
  for (const id of hand) {
    moveCardInternal(draft, id, 'library', 'bottom', false);
  }
  // Validate + apply order as the new library permutation.
  const lib = readZone(draft, 'library', playerId);
  const valid =
    order.length === lib.length &&
    new Set(order).size === order.length &&
    order.every((id) => lib.includes(id));
  if (valid) {
    const library = editZone(draft, 'library', playerId);
    library.splice(0, library.length, ...order);
  } else {
    throw new EngineError('mulligan の order がライブラリの順列ではありません。');
  }
  const mulliganCount = incrementPlayerTurnCounter(draft, playerId, 'mulliganCount');
  pushLog(draft, `マリガンしました(${mulliganCount}回目)。`);
}

function applyShuffle(draft: Draft, order: string[], playerId: PlayerId): void {
  const lib = readZone(draft, 'library', playerId);
  const valid =
    order.length === lib.length &&
    new Set(order).size === order.length &&
    order.every((id) => lib.includes(id));
  if (!valid) {
    throw new EngineError('shuffle の order がライブラリの順列ではありません。');
  }
  const library = editZone(draft, 'library', playerId);
  library.splice(0, library.length, ...order);
  pushLog(draft, 'ライブラリをシャッフルしました。');
}

function applyPutOnBottom(
  draft: Draft,
  cardIds: string[],
  playerId = draft.state.localPlayerId,
): void {
  requirePlayer(draft.state, playerId);
  for (const id of cardIds) {
    const card = requireCard(draft, id);
    if (card.ownerId !== playerId) {
      throw new EngineError('putOnBottom のカード所有者とplayerIdが一致しません。');
    }
    moveCardInternal(draft, id, 'library', 'bottom', false);
  }
  if (cardIds.length > 0) {
    pushLog(draft, `${cardIds.length}枚をライブラリの一番下に置きました。`);
  }
}

export function returnLinkedExileToBattlefield(state: GameState, linkId: string): ApplyResult {
  const draft = makeDraft(state);
  returnTemporaryLinkedExileInDraft(draft, linkId);
  stabilizeBeforePriority(draft);
  return { state: syncDerivedViews(draft.state), warnings: draft.warnings };
}

export function consumeLinkedExileForSource(
  state: GameState,
  linkId: string,
  sourcePhysicalId: string,
): ApplyResult {
  const draft = makeDraft(state);
  const record = draft.state.linkedExiles[linkId];
  if (!record) {
    draft.warnings.push(`linked exile record が存在しません: ${linkId}`);
    return { state: syncDerivedViews(draft.state), warnings: draft.warnings };
  }
  if (record.purpose !== 'exiled-with-source') {
    draft.warnings.push(
      `exiled-with-source ではない linked exile record は消費できません: ${linkId}`,
    );
    return { state: syncDerivedViews(draft.state), warnings: draft.warnings };
  }

  const source = draft.state.cards[sourcePhysicalId];
  const sourceMatches =
    sourcePhysicalId === record.sourcePhysicalId &&
    source !== undefined &&
    source.id === record.sourcePhysicalId &&
    objectIdOf(source) === record.sourceObjectId;
  if (!sourceMatches) {
    draft.warnings.push(`linked exile の source object が一致しません: ${linkId}`);
    return { state: syncDerivedViews(draft.state), warnings: draft.warnings };
  }

  deleteLinkedExileRecord(draft, linkId);
  return { state: syncDerivedViews(draft.state), warnings: draft.warnings };
}

// ---------------------------------------------------------------------------
// applyCommand
// ---------------------------------------------------------------------------

export function applyCommand(state: GameState, cmd: GameCommand): ApplyResult {
  const draft = makeDraft(state);

  switch (cmd.type) {
    case 'moveCard': {
      applyMoveCardCommand(draft, cmd);
      break;
    }
    case 'setTapped': {
      const card = requireCard(draft, cmd.cardId);
      if (card.tapped !== cmd.tapped) {
        setCard(draft, { ...card, tapped: cmd.tapped });
        pushLog(
          draft,
          `${nameOf(draft, cmd.cardId)}を${cmd.tapped ? 'タップ' : 'アンタップ'}しました。`,
        );
      }
      break;
    }
    case 'setFace': {
      const card = requireCard(draft, cmd.cardId);
      if (card.faceIndex !== cmd.faceIndex) {
        setCard(draft, { ...card, faceIndex: cmd.faceIndex });
        pushLog(draft, `${nameOf(draft, cmd.cardId)}のフェイスを切り替えました。`);
      }
      break;
    }
    case 'setFaceDown': {
      const card = requireCard(draft, cmd.cardId);
      if (card.faceDown !== cmd.faceDown) {
        setCard(draft, { ...card, faceDown: cmd.faceDown });
        pushLog(
          draft,
          `${nameOf(draft, cmd.cardId)}を${cmd.faceDown ? '裏向き' : '表向き'}にしました。`,
        );
      }
      break;
    }
    case 'setManualKeywords': {
      const card = requireCard(draft, cmd.cardId);
      const manualKeywords = normalizeKeywords(cmd.keywords);
      setCard(draft, {
        ...card,
        manualKeywords: manualKeywords.length > 0 ? manualKeywords : undefined,
      });
      pushLog(draft, `${nameOf(draft, cmd.cardId)}の手動キーワードを更新した。`);
      break;
    }
    case 'setEffectsAuto': {
      if (draft.state.effectsAuto !== cmd.value) {
        draft.state.effectsAuto = cmd.value;
        pushLog(draft, `効果自動実行を${cmd.value ? 'ON' : 'OFF'}にしました。`);
      }
      break;
    }
    case 'setCardEffectsAuto': {
      const card = requireCard(draft, cmd.cardId);
      if (card.effectsAuto !== cmd.value) {
        setCard(draft, { ...card, effectsAuto: cmd.value });
        pushLog(
          draft,
          `${nameOf(draft, cmd.cardId)}の効果自動実行を${cmd.value ? 'ON' : 'OFF'}にしました。`,
        );
      }
      break;
    }
    case 'addCounters': {
      applyAddCounters(draft, cmd.cardId, cmd.counterType, cmd.delta);
      break;
    }
    case 'markDamage': {
      applyMarkDamage(draft, cmd.cardId, cmd.amount, cmd.deathtouch);
      break;
    }
    case 'dealDamage': {
      applyDealDamage(draft, cmd);
      break;
    }
    case 'clearMarkedDamage': {
      applyClearMarkedDamage(draft, cmd.cardId);
      break;
    }
    case 'preventCombatDamageThisTurn': {
      if (!draft.state.combatDamagePreventedUntilEndOfTurn) {
        draft.state.combatDamagePreventedUntilEndOfTurn = true;
        pushLog(draft, 'このターンの戦闘ダメージをすべて防ぐ。');
      }
      break;
    }
    case 'enterCombat': {
      applyEnterCombat(draft, cmd.attackingPlayerId, cmd.defendingPlayerId, cmd.combatId);
      break;
    }
    case 'declareAttackers': {
      applyDeclareAttackers(draft, cmd.attackers);
      break;
    }
    case 'declareBlockers': {
      applyDeclareBlockers(draft, cmd.blockers);
      break;
    }
    case 'resolveCombatDamage': {
      applyResolveCombatDamage(draft);
      break;
    }
    case 'attach': {
      const card = requireCard(draft, cmd.cardId);
      if (cmd.to !== undefined) {
        requireCard(draft, cmd.to);
      }
      setCard(draft, { ...card, attachedTo: cmd.to });
      if (cmd.to !== undefined) {
        pushLog(draft, `${nameOf(draft, cmd.cardId)}を${nameOf(draft, cmd.to)}に付けました。`);
      } else {
        pushLog(draft, `${nameOf(draft, cmd.cardId)}の装備/付与を外しました。`);
      }
      break;
    }
    case 'setController': {
      const card = requireCard(draft, cmd.cardId);
      requirePlayer(draft.state, cmd.controllerId);
      setCard(draft, { ...card, controllerId: cmd.controllerId });
      pushLog(draft, `${nameOf(draft, cmd.cardId)}のコントローラーを${requirePlayer(draft.state, cmd.controllerId).label}に変更した。`);
      break;
    }
    case 'adjustLife': {
      applyLifeDeltaForPlayer(
        draft,
        cmd.playerId ?? draft.state.localPlayerId,
        cmd.delta,
        commandCause(cmd.type),
      );
      break;
    }
    case 'adjustPlayerCounter': {
      applyPlayerCounterDelta(
        draft,
        cmd.playerId ?? draft.state.localPlayerId,
        cmd.kind,
        cmd.delta,
      );
      break;
    }
    case 'applyPlayerEffect': {
      applyPlayerEffect(draft, cmd);
      break;
    }
    case 'adjustCommanderDamage': {
      const current = draft.state.commanderDamage[cmd.label] ?? 0;
      const next = Math.max(0, current + cmd.delta);
      const cd = { ...draft.state.commanderDamage };
      cd[cmd.label] = next;
      draft.state.commanderDamage = cd;
      pushLog(draft, `統率者ダメージ(${cmd.label})を${next}にしました。`);
      break;
    }
    case 'adjustOpponentLife': {
      applyOpponentLifeDelta(draft, cmd.label, cmd.delta, commandCause(cmd.type));
      break;
    }
    case 'addMana': {
      const amount = Math.max(0, cmd.amount);
      if (amount > 0) {
        const playerId = cmd.playerId ?? draft.state.localPlayerId;
        const pool = { ...manaPoolFor(draft, playerId) };
        pool[cmd.color] += amount;
        setManaPoolFor(draft, playerId, pool);
        pushLog(draft, `${cmd.color}マナを${amount}点加えました。`);
      }
      break;
    }
    case 'adjustMana': {
      if (cmd.delta === 0) break;
      const playerId = cmd.playerId ?? draft.state.localPlayerId;
      const pool = manaPoolFor(draft, playerId);
      const current = pool[cmd.color];
      const next = Math.max(0, current + cmd.delta);
      if (next === current) break;
      setManaPoolFor(draft, playerId, { ...pool, [cmd.color]: next });
      const deltaLabel = cmd.delta > 0 ? `+${cmd.delta}` : `${cmd.delta}`;
      pushLog(draft, `${cmd.color}マナを${deltaLabel}した(現在${next})。`);
      break;
    }
    case 'payMana': {
      const { shortfall } = subtractPayment(
        draft,
        cmd.payment,
        cmd.playerId ?? draft.state.localPlayerId,
      );
      if (shortfall > 0) {
        draft.warnings.push(`マナが${shortfall}点不足(強行)。`);
      }
      pushLog(draft, `マナを支払いました(${describePayment(cmd.payment)})。`);
      break;
    }
    case 'clearManaPool': {
      clearPool(
        draft,
        'マナプールを空にしました。',
        cmd.playerId ?? draft.state.localPlayerId,
      );
      break;
    }
    case 'draw': {
      const playerId = cmd.playerId ?? draft.state.localPlayerId;
      const drawn = drawCards(draft, Math.max(0, cmd.count), commandCause(cmd.type), playerId);
      incrementDrawnThisTurn(draft, playerId, drawn);
      pushLog(draft, `カードを${drawn}枚引きました。`);
      if (drawn < cmd.count) {
        draft.warnings.push('ライブラリが足りずすべて引けませんでした。');
      }
      break;
    }
    case 'mill': {
      applyMill(draft, cmd.count, cmd.playerId ?? draft.state.localPlayerId);
      break;
    }
    case 'shuffle': {
      applyShuffle(draft, cmd.order, cmd.playerId ?? draft.state.localPlayerId);
      break;
    }
    case 'untapAll': {
      untapAll(draft);
      break;
    }
    case 'discard': {
      applyDiscard(draft, cmd.cardIds, cmd.playerId);
      break;
    }
    case 'putOnBottom': {
      applyPutOnBottom(draft, cmd.cardIds, cmd.playerId);
      break;
    }
    case 'playLand': {
      applyPlayLand(draft, cmd.cardId, cmd.entersTapped, cmd.playerId);
      break;
    }
    case 'arrangeTop': {
      applyArrangeTop(draft, cmd.topOrder, cmd.toBottom, cmd.toGraveyard, cmd.playerId);
      break;
    }
    case 'crackTreasure': {
      applyCrackTreasure(draft, cmd.cardId, cmd.color);
      break;
    }
    case 'castSpell': {
      applyCast(draft, cmd.cardId, cmd.payment, cmd.forced, false, cmd.faceIndex, cmd.playerId);
      break;
    }
    case 'castCommander': {
      applyCast(draft, cmd.cardId, cmd.payment, cmd.forced, true, cmd.faceIndex, cmd.playerId);
      break;
    }
    case 'castToStack': {
      applyCastToStack(draft, cmd.cardId, cmd.payment, cmd.forced, cmd.faceIndex, cmd.xValue, cmd.playerId);
      break;
    }
    case 'addAbilityToStack': {
      applyAddAbilityToStack(
        draft,
        cmd.sourceId,
        cmd.kind,
        cmd.abilityLineIndex,
        cmd.sourceSnapshot,
        cmd.targetSelections,
        cmd.activationEnvelope,
      );
      break;
    }
    case 'resolveStackTop': {
      applyResolveStackTop(draft, cmd.to, cmd.libraryShuffleOrder);
      break;
    }
    case 'removeStackItem': {
      applyRemoveStackItem(draft, cmd.id, cmd.to);
      break;
    }
    case 'setManualTargets': {
      applySetManualTargets(
        draft,
        cmd.stackItemId,
        cmd.targetIds,
        cmd.targetPlayerIds,
        cmd.allowStackAbilities,
      );
      break;
    }
    case 'copyStackItem': {
      applyCopyStackItem(draft, cmd.cardId);
      break;
    }
    case 'copyPermanent': {
      applyCopyPermanent(draft, cmd.cardId, cmd.quantity);
      break;
    }
    case 'createToken': {
      applyCreateToken(
        draft,
        cmd.name,
        cmd.typeLine,
        cmd.power,
        cmd.toughness,
        cmd.quantity,
        cmd.producedMana,
        cmd.tokenKind,
        { createdBy: cmd.createdBy },
      );
      break;
    }
    case 'createDefinedToken': {
      applyCreateDefinedToken(draft, cmd);
      break;
    }
    case 'createScenarioDummy': {
      applyCreateScenarioDummy(draft, cmd);
      break;
    }
    case 'nextPhase': {
      applyNextPhase(draft, cmd.drawnHandled ?? false);
      break;
    }
    case 'nextTurn': {
      applyNextTurn(draft, cmd.advanceTurnOrder ?? false);
      break;
    }
    case 'mulligan': {
      applyMulligan(draft, cmd.order, cmd.playerId);
      break;
    }
  }

  stabilizeBeforePriority(draft);
  flushCounterChangeEvents(draft);
  return { state: syncDerivedViews(draft.state), warnings: draft.warnings };
}
