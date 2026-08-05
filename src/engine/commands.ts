import type { CardDef, ManaColor } from '../types/card';
import { autoTapCommands, planAutoTap } from './autotap';
import { isCommander } from './commander';
import { finalChapterNumber, numberToRoman, parseSagaChapters } from './sagaGrammar';
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
import { parseManaCost, reduceManaCost } from './mana';
import { effectiveMaximumHandSize } from './handSize';
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
  splitDelayedPhaseBeginText,
  triggerConditionSatisfied,
} from './triggers';
import type {
  AbilityKind,
  ActivationCostComponent,
  ActivationEnvelope,
  ActivationSourceRef,
  AttackDeclarationEvent,
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
  DungeonDef,
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
  ManualTargetZone,
  ObjectSnapshot,
  PendingTrigger,
  Phase,
  PlayerId,
  PlayerPrivateZones,
  PrivateZoneId,
  TargetSelection,
  TargetSelectionKind,
  TriggerCondition,
  VentureEvent,
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
      type: 'destroyPermanents';
      selector:
        | { kind: 'cards'; cardIds: string[] }
        | {
            kind: 'battlefield-filter';
            typesAnyOf?: string[];
            excludedTypesAnyOf?: string[];
            controller?: { kind: 'is' | 'is-not'; playerId: PlayerId };
            maxManaValue?: number;
          };
    }
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
      type: 'setMaximumHandSizeOverride';
      value?: number | 'none';
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
  | {
      type: 'applyPlayerEffect';
      controllerId: PlayerId;
      recipients: 'you' | 'eachOpponent' | 'eachPlayer';
      effect: 'damage';
      sourceId: string;
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
  | {
      type: 'discard';
      cardIds: string[];
      playerId?: PlayerId;
      simultaneousGroupId?: string;
    }
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
  | {
      type: 'castSpell';
      cardId: string;
      payment: ManaPool;
      forced: boolean;
      faceIndex?: number;
      playerId?: PlayerId;
      /** CR 720.3: cast the card using its Omen characteristics (face 1). */
      castAsOmen?: boolean;
      /** CR 720.3d: shuffle permutation of the owner library including the card. */
      libraryShuffleOrder?: string[];
    }
  | { type: 'castCommander'; cardId: string; payment: ManaPool; forced: boolean; faceIndex?: number; playerId?: PlayerId }
  | {
      type: 'castToStack';
      cardId: string;
      payment: ManaPool;
      forced: boolean;
      faceIndex?: number;
      xValue?: number;
      playerId?: PlayerId;
      targetSelections?: TargetSelection[];
      /** CR 702.194a: creature ids tapped to pay the optional teamwork additional cost. */
      teamworkTappedIds?: string[];
      /** CR 720.3: cast the card using its Omen characteristics (face 1). */
      castAsOmen?: boolean;
    }
  | {
      type: 'addAbilityToStack';
      sourceId: string;
      kind: AbilityKind;
      abilityLineIndex?: number;
      sourceSnapshot?: ObjectSnapshot;
      targetSelections?: TargetSelection[];
      activationEnvelope?: ActivationEnvelope;
      triggerCondition?: TriggerCondition;
      resolutionText?: string;
      announcedX?: number;
    }
  | {
      type: 'resolveStackTop';
      to?: ZoneId;
      libraryShuffleOrder?: string[];
      /**
       * engine-spec §34.55.1 (feel-2): present only when the store's guided plan
       * presented every prompt and each was answered legally. True suppresses the
       * generic manual-remainder warning for guided lines at resolution (§34.55.2).
       * Raw-engine callers leave it undefined, preserving existing behavior.
       */
      guidedHandled?: boolean;
    }
  | { type: 'removeStackItem'; id: string; to?: ZoneId }
  | {
      type: 'setManualTargets';
      stackItemId: string;
      targetIds: string[];
      targetPlayerIds?: PlayerId[];
      allowStackAbilities?: boolean;
      allowedZones?: ManualTargetZone[];
    }
  | { type: 'copyStackItem'; cardId: string; quantity?: number }
  | { type: 'copyPermanent'; cardId: string; quantity: number }
  | {
      type: 'createToken';
      name: string;
      typeLine: string;
      power?: string;
      toughness?: string;
      quantity: number;
      producedMana?: ManaColor[];
      tokenKind?: CardDef['tokenKind'];
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
  | { type: 'nextPhase'; drawnHandled?: boolean; manualCleanupHandled?: boolean }
  | { type: 'nextTurn'; advanceTurnOrder?: boolean }
  | { type: 'completeCleanupStateActions' }
  | { type: 'mulligan'; order: string[]; playerId?: PlayerId }
  | {
      type: 'ventureIntoDungeon';
      playerId: PlayerId;
      dungeonDefId?: string; // required when no active dungeon (309.2a choice)
      roomChoice?: number; // required when current room has multiple nextRooms (309.5a)
    }
  | { type: 'setClassLevel'; cardId: string; level: number }
  | { type: 'setSolved'; cardId: string; solved: boolean }
  | { type: 'chooseBattleProtector'; cardId: string; protectorId: PlayerId };

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
  | Omit<CounterChangeEvent, 'eventId' | 'sequence'>
  | Omit<AttackDeclarationEvent, 'eventId' | 'sequence'>
  | Omit<VentureEvent, 'eventId' | 'sequence'>;

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
      dungeonDefs: { ...(state.dungeonDefs ?? {}) },
      dungeons: { ...(state.dungeons ?? {}) },
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
    case 'attackDeclaration': {
      const fullEvent: AttackDeclarationEvent = {
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
    case 'venture': {
      const fullEvent: VentureEvent = {
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
    // CR 400.7 / 716.2d (cold-audit FINDING-2): a zone change creates a new
    // object with no memory of its previous level designation. A bounced,
    // blinked, or re-cast Class re-enters the battlefield at level 1.
    classLevel: undefined,
    // CR 400.7 / 719.3b: the solved designation does not survive a zone
    // change. A Case that leaves the battlefield and returns is unsolved.
    solved: undefined,
    // CR 400.7: a true zone change creates a new object with no memory of
    // targets chosen for the spell/object in its previous zone. In particular,
    // unchecked manual stack annotations must not reappear after resolve/recast.
    targetSelections: undefined,
    announcedX: undefined,
    // CR 720.4 / 720.2: off the stack, only the normal characteristics apply.
    // The Omen cast choice does not survive leaving the stack — a countered or
    // bounced card reverts to its front face without the castAsOmen flag.
    castAsOmen: undefined,
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

const WORD_TO_NUMBER: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

const ETB_COUNTER_PATTERN = new RegExp(
  'enters (?:the battlefield )?with (a|an|one|two|three|four|five|six|seven|eight|nine|ten|\\d+) ([\\w+/-]+) counters?', 'i',
);

function parseEtbCounters(oracleText: string): { counterType: string; count: number }[] {
  const results: { counterType: string; count: number }[] = [];
  for (const line of oracleText.split('\n')) {
    const match = ETB_COUNTER_PATTERN.exec(line);
    if (!match) continue;
    if (/\bfor each\b/i.test(line)) continue;
    const count = WORD_TO_NUMBER[match[1].toLowerCase()] ?? Number.parseInt(match[1], 10);
    if (Number.isNaN(count) || count <= 0) continue;
    results.push({ counterType: match[2], count });
  }
  return results;
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

  // CR 310.4b: a Battle enters with defense counters equal to its printed defense.
  if (typeLine.includes('Battle') && typeof face?.defense === 'string') {
    const defense = Number.parseInt(face.defense, 10);
    if (!Number.isNaN(defense) && defense > 0) {
      counters.defense = defense;
    }
  }

  if (typeLine.includes('Saga')) {
    counters.lore = 1;
    pushLog(draft, `${nameOfCard(draft, card)}は第I章で戦場に出た。`);
  }

  const oracleText = face?.oracleText;
  if (oracleText) {
    for (const spec of parseEtbCounters(oracleText)) {
      counters[spec.counterType] = (counters[spec.counterType] ?? 0) + spec.count;
    }
  }

  let updated: CardInstance = {
    ...card,
    enteredTurn: draft.state.turn,
    counters,
  };

  // CR 310.8a / 310.11a: a Siege's protector must be an opponent of its controller.
  // In the current 2-player model the protector is deterministic (the opponent).
  if (typeLine.includes('Battle')) {
    const protectorId = defaultBattleProtector(draft.state, updated.controllerId);
    if (protectorId !== undefined) {
      updated = { ...updated, protectorId };
    }
  }

  // CR 714.2b: a Saga entering the battlefield gets a lore counter (set above),
  // which may trigger chapter abilities.
  if (typeLine.includes('Saga')) {
    emitSagaChapterTriggers(draft, updated, 0, 1);
  }

  return updated;
}

/**
 * CR 310.8a: default protector for a battle — the next player in turn order
 * after the controller (the opponent in a 2-player game). Returns undefined
 * when no other player exists.
 */
function defaultBattleProtector(state: GameState, controllerId: PlayerId): PlayerId | undefined {
  const index = state.turnOrder.indexOf(controllerId);
  if (index < 0 || state.turnOrder.length < 2) {
    return undefined;
  }
  return state.turnOrder[(index + 1) % state.turnOrder.length];
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
  battlefieldEntryTapped?: boolean,
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
    if (battlefieldEntryTapped !== undefined) {
      updated = { ...updated, tapped: battlefieldEntryTapped };
    }
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

function destroyCandidateIds(
  draft: Draft,
  selector: Extract<GameCommand, { type: 'destroyPermanents' }>['selector'],
): string[] {
  const candidates = selector.kind === 'cards'
    ? [...new Set(selector.cardIds)]
    : Object.keys(draft.state.cards);
  const maxManaValue = selector.kind === 'battlefield-filter' ? selector.maxManaValue : undefined;
  if (maxManaValue !== undefined && (!Number.isInteger(maxManaValue) || maxManaValue < 0)) {
    return [];
  }
  return candidates.filter((cardId) => {
    const card = draft.state.cards[cardId];
    if (!card || card.zone !== 'battlefield') return false;
    if (selector.kind === 'cards') return true;
    const typeWords = new Set(typeLineOf(draft, card).toLowerCase().split(/[\s—]+/));
    const types = selector.typesAnyOf?.map((type) => type.toLowerCase());
    const excluded = selector.excludedTypesAnyOf?.map((type) => type.toLowerCase()) ?? [];
    if (types && (types.length === 0 || !types.some((type) => typeWords.has(type)))) return false;
    if (excluded.some((type) => typeWords.has(type))) return false;
    if (
      selector.controller
      && (selector.controller.kind === 'is'
        ? card.controllerId !== selector.controller.playerId
        : card.controllerId === selector.controller.playerId)
    ) return false;
    return maxManaValue === undefined || (objectSnapshotOf(draft, card).manaValue ?? 0) <= maxManaValue;
  }).sort((left, right) => left.localeCompare(right));
}

function applyDestroyPermanents(
  draft: Draft,
  selector: Extract<GameCommand, { type: 'destroyPermanents' }>['selector'],
): void {
  // Freeze all eligibility and replacement decisions before the first zone change.
  const destroyed = destroyCandidateIds(draft, selector).flatMap((cardId) => {
    const card = draft.state.cards[cardId];
    if (!card || effectiveKeywords(draft.state, cardId).includes('indestructible')) return [];
    const to = graveyardToExileReplacementActive(draft.state, card.ownerId ?? 'P1') && !isCommander(draft.state, cardId)
      ? 'exile' as const
      : 'graveyard' as const;
    return [{ cardId, to }];
  });
  const simultaneousGroupId = `destroy-${draft.nextEventSeq}`;
  for (const { cardId, to } of destroyed) {
    moveCardInternal(draft, cardId, to, 'bottom', false, 'destroy', {
      simultaneousGroupId,
      ...(to === 'exile' ? { replacementApplied: '614.6:grave-to-exile' } : {}),
    });
    pushLog(draft, `${nameOf(draft, cardId)}を破壊しました。`);
  }
}

function applyMarkDamage(draft: Draft, cardId: string, amount: number, deathtouch?: boolean): void {
  const card = requireCard(draft, cardId);
  const markedAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;

  // CR 310.6: damage to a battle removes defense counters, not damageMarked.
  if (isBattlefieldBattle(draft, card)) {
    if (markedAmount > 0) {
      applyBattleDamage(draft, card, markedAmount);
    }
    return;
  }

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

const SIEGE_DEFEATED_TRIGGER_ID = 'trigger.siege-defeated';

/**
 * CR 310.6: damage dealt to a battle removes that many defense counters.
 * CR 310.11b: when the last defense counter is removed from a Siege, its
 * intrinsic triggered ability fires ("exile it, then you may cast it
 * transformed without paying its mana cost").
 */
function applyBattleDamage(draft: Draft, card: CardInstance, amount: number): void {
  const current = draft.state.cards[card.id];
  if (!current || current.zone !== 'battlefield') return;

  const before = current.counters.defense ?? 0;
  const after = Math.max(0, before - amount);
  if (after === before) return;

  recordCounterChangeIntent(draft, current, 'defense', before);
  setCard(draft, {
    ...current,
    counters: { ...current.counters, defense: after },
  });

  pushLog(
    draft,
    `${nameOf(draft, card.id)}から防御カウンター${before - after}個を取り除いた（残り${after}）。`,
  );

  // CR 310.11b: last defense counter removed from a Siege → intrinsic trigger.
  if (after === 0 && before > 0 && isSiege(draft, current)) {
    pushSiegeDefeatedTrigger(draft, current);
  }
}

function pushSiegeDefeatedTrigger(draft: Draft, card: CardInstance): void {
  const snapshot = objectSnapshotOf(draft, card);
  const eventId = `e${draft.nextEventSeq}`;
  const pending: PendingTrigger = {
    pendingTriggerId: `${eventId}:${SIEGE_DEFEATED_TRIGGER_ID}:${snapshot.objectId}`,
    eventId,
    simultaneousGroupId: `siege-${draft.nextEventSeq}`,
    triggerId: SIEGE_DEFEATED_TRIGGER_ID,
    sourceId: card.id,
    sourceObjectId: snapshot.objectId,
    sourceSnapshot: snapshot,
    controllerId: card.controllerId,
    label: `${nameOfCard(draft, card)}の包囲陥落誘発`,
    stackPlacementBucket: 'ability-triggered',
    resolutionText:
      'Exile this permanent, then you may cast it transformed without paying its mana cost.',
  };
  appendPendingTrigger(draft, pending);
  pushLog(draft, `${nameOfCard(draft, card)}の最後の防御カウンターが取り除かれた。誘発型能力がスタックに置かれる。`);
}

// ---------------------------------------------------------------------------
// CR 714.2b: Saga chapter ability triggers
// ---------------------------------------------------------------------------

/** Resolve the oracle text for a card's current face. */
function oracleTextOf(draft: Draft, card: CardInstance): string | undefined {
  const face = currentFaceOf(draft, card);
  return face?.oracleText;
}

/**
 * CR 714.2b: after lore counters are put on a Saga, emit chapter ability
 * triggers for each ability whose chapter numbers fall within
 * (previousLore, newLore].
 */
function emitSagaChapterTriggers(
  draft: Draft,
  card: CardInstance,
  previousLore: number,
  newLore: number,
): void {
  const oracleText = oracleTextOf(draft, card);
  const abilities = parseSagaChapters(oracleText);
  if (abilities.length === 0) return;

  const snapshot = objectSnapshotOf(draft, card);
  const eventId = `e${draft.nextEventSeq}`;
  const simultaneousGroupId = `saga-chapter-${draft.nextEventSeq}`;

  for (const [abilityIndex, ability] of abilities.entries()) {
    const crossed = ability.chapters.some((n) => previousLore < n && newLore >= n);
    if (!crossed) continue;

    const displayChapter = numberToRoman(ability.chapters[0]);
    const pending: PendingTrigger = {
      pendingTriggerId: `${eventId}:saga-chapter:${snapshot.objectId}:${abilityIndex}`,
      eventId,
      simultaneousGroupId,
      triggerId: `saga-chapter-${card.id}-${abilityIndex}`,
      sourceId: card.id,
      sourceObjectId: snapshot.objectId,
      sourceSnapshot: snapshot,
      controllerId: card.controllerId,
      label: `${nameOfCard(draft, card)}の第${displayChapter}章`,
      abilityLineIndex: abilityIndex,
      stackPlacementBucket: 'ability-triggered',
      resolutionText: ability.effectText,
    };
    appendPendingTrigger(draft, pending);
    pushLog(draft, `${nameOfCard(draft, card)}の第${displayChapter}章が誘発した。`);
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

function isBattlefieldBattle(draft: Draft, card: CardInstance): boolean {
  return card.zone === 'battlefield' && typeLineOf(draft, card).includes('Battle');
}

function isSiege(draft: Draft, card: CardInstance): boolean {
  return typeLineOf(draft, card).includes('Siege');
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
  target: Extract<CombatTarget, { type: 'player' }>;
  amount: number;
}

function addCombatPlayerDamage(
  totals: Map<string, CombatPlayerDamageTotal>,
  target: Extract<CombatTarget, { type: 'player' }>,
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
    if (target.type === 'player') {
      requirePlayer(draft.state, target.playerId);
      if (target.playerId === card.controllerId) {
        throw new EngineError('自分自身を攻撃先プレイヤーにはできません。');
      }
    } else {
      // CR 310.8b: validate battle target exists on battlefield
      const battleCard = draft.state.cards[target.cardId];
      if (!battleCard || battleCard.zone !== 'battlefield') {
        throw new EngineError('攻撃先のバトルが戦場に存在しません。');
      }
      // CR 310.8b: a battle's protector can never attack it.
      if (battleCard.protectorId === card.controllerId) {
        throw new EngineError('バトルの保護者はそのバトルを攻撃できません。');
      }
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
  const declaredSnapshots = declared.flatMap((entry) => {
    const current = draft.state.cards[entry.cardId];
    return current ? [objectSnapshotOf(draft, current)] : [];
  });
  pushEvent(draft, {
    type: 'attackDeclaration',
    turn: draft.state.turn,
    combatId: combat.combatId,
    attackingPlayerId: combat.attackingPlayerId,
    attackers: declaredSnapshots,
    battlefield: draft.state.zones.battlefield.flatMap((cardId) => {
      const current = draft.state.cards[cardId];
      return current ? [objectSnapshotOf(draft, current)] : [];
    }),
  });
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
  const combatDamagePrevented = draft.state.combatDamagePreventedUntilEndOfTurn;
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
      if (attackerCard) {
        const power = Math.max(0, effectivePower(draft.state, attackerCard.id));
        if (!combatDamagePrevented) {
          if (attacker.target.type === 'battle') {
            // CR 310.6: unblocked attacker deals damage to the battle (remove defense counters).
            applyBattleDamage(draft, requireCard(draft, attacker.target.cardId), power);
          } else {
            addCombatPlayerDamage(playerDamageTotals, attacker.target, power);
          }
          if (effectiveKeywords(draft.state, attackerCard.id).includes('lifelink')) {
            gainLifeForController(draft, attacker.controllerId, power);
          }
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
    if (attackerHasTrample) {
      ({ toBlocker, overflow } = trampleLethalAssignment(
        draft,
        blockerCard,
        attackerHasDeathtouch,
        attackerPower,
      ));
    }

    if (!combatDamagePrevented) {
      applyPositiveCombatDamage(
        draft,
        blockerCard.id,
        attackerCard.id,
        attacker.controllerId,
        toBlocker,
      );
      if (overflow > 0) {
        if (attacker.target.type === 'battle') {
          // CR 310.6: trample overflow to a battle removes defense counters.
          applyBattleDamage(draft, requireCard(draft, attacker.target.cardId), overflow);
        } else {
          addCombatPlayerDamage(playerDamageTotals, attacker.target, overflow);
        }
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

/**
 * CR 704.5y / 303.7a: collect Role token ids that must be put into the
 * graveyard because a permanent has more than one Role controlled by the
 * same player attached to it. The Role with the most recent timestamp
 * (highest (enteredTurn, zoneChangeCounter) tuple) is kept; the rest are
 * returned for removal.
 */
function collectDuplicateRoleIds(draft: Draft): string[] {
  // Group battlefield Role tokens by (attachedTo, controllerId).
  const groups = new Map<string, CardInstance[]>();
  for (const card of Object.values(draft.state.cards)) {
    if (card.zone !== 'battlefield' || !card.isToken || !card.attachedTo) continue;
    const def = draft.state.defs[card.defId];
    if (!def || !def.typeLine.includes('Role')) continue;
    const key = `${card.attachedTo}|${card.controllerId}`;
    const group = groups.get(key);
    if (group) {
      group.push(card);
    } else {
      groups.set(key, [card]);
    }
  }

  const toRemove: string[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    // Keep the one with the highest (enteredTurn, zoneChangeCounter) tuple.
    let newest = group[0];
    for (let i = 1; i < group.length; i++) {
      const candidate = group[i];
      if (
        candidate.enteredTurn > newest.enteredTurn ||
        (candidate.enteredTurn === newest.enteredTurn &&
          candidate.zoneChangeCounter > newest.zoneChangeCounter)
      ) {
        newest = candidate;
      }
    }
    for (const card of group) {
      if (card.id !== newest.id) {
        toRemove.push(card.id);
      }
    }
  }
  return toRemove;
}

// ---------------------------------------------------------------------------
// Dungeons (CR 309) — venture substrate.
//
// Dungeons are nontraditional cards that live outside the normal card/zone
// system (309.2c: not permanents, can't be cast, can't leave the command zone
// except by leaving the game). Their state is tracked in `state.dungeons`
// rather than as CardInstances.
// ---------------------------------------------------------------------------

const DUNGEON_ROOM_TRIGGER_ID = 'trigger.dungeon-room';

function dungeonDefOf(state: GameState, dungeonDefId: string): DungeonDef | undefined {
  return state.dungeonDefs?.[dungeonDefId];
}

function dungeonName(def: DungeonDef | undefined): string {
  if (!def) return '不明なダンジョン';
  return `《${def.printedName ?? def.name}》`;
}

function playerVentureLabel(playerId: PlayerId): string {
  return playerId === 'P1' ? 'あなた' : `プレイヤー${playerId}`;
}

/** True when the given room index is a bottommost room (no outgoing arrows). */
function isBottommostRoom(def: DungeonDef, roomIndex: number): boolean {
  const room = def.rooms[roomIndex];
  return room !== undefined && room.nextRooms.length === 0;
}

/**
 * Build a synthetic ObjectSnapshot representing a dungeon room ability source.
 * Dungeons are not CardInstances, so we fabricate stable identifiers from the
 * dungeon def id and the owning player (309.4c: controlled by the dungeon owner).
 */
function dungeonRoomSnapshot(dungeonDefId: string, ownerId: PlayerId): ObjectSnapshot {
  const physicalCardId = `dungeon:${dungeonDefId}`;
  return {
    physicalCardId,
    objectId: physicalCardId,
    defId: dungeonDefId,
    zone: 'command',
    ownerId,
    controllerId: ownerId,
    isToken: false,
    isCommander: false,
    faceIndex: 0,
    tapped: false,
    counters: {},
    typeLine: 'Dungeon',
  };
}

/** Create and append the PendingTrigger for a room ability (309.4c). */
function appendDungeonRoomTrigger(
  draft: Draft,
  playerId: PlayerId,
  def: DungeonDef,
  roomIndex: number,
): void {
  const room = def.rooms[roomIndex];
  if (!room) return;
  const sourceSnapshot = dungeonRoomSnapshot(def.id, playerId);
  const eventId = `e${draft.nextEventSeq}`;
  const pending: PendingTrigger = {
    pendingTriggerId: `${eventId}:${DUNGEON_ROOM_TRIGGER_ID}:${sourceSnapshot.objectId}:room-${roomIndex}`,
    eventId,
    simultaneousGroupId: eventId,
    triggerId: DUNGEON_ROOM_TRIGGER_ID,
    sourceId: sourceSnapshot.physicalCardId,
    sourceObjectId: sourceSnapshot.objectId,
    sourceSnapshot,
    controllerId: playerId,
    label: `${dungeonName(def)}「${room.name}」の部屋能力`,
    stackPlacementBucket: 'ability-triggered',
    resolutionText: room.oracleText,
  };
  appendPendingTrigger(draft, pending);
}

/** Whether a pending room ability from this player's specific dungeon exists (CR 309.6: "that dungeon card"). */
function hasPendingDungeonRoomTrigger(state: GameState, playerId: PlayerId, dungeonDefId: string): boolean {
  return state.pendingTriggers.some(
    (trigger) =>
      trigger.triggerId === DUNGEON_ROOM_TRIGGER_ID &&
      trigger.controllerId === playerId &&
      trigger.sourceSnapshot?.defId === dungeonDefId,
  );
}

/** Players whose active dungeon is completed and ready for SBA removal (704.5t). */
function collectCompletedDungeonPlayerIds(draft: Draft): PlayerId[] {
  const result: PlayerId[] = [];
  for (const [playerId, dungeon] of Object.entries(draft.state.dungeons ?? {})) {
    if (!dungeon) continue;
    const def = dungeonDefOf(draft.state, dungeon.dungeonDefId);
    if (!def) continue;
    if (!isBottommostRoom(def, dungeon.currentRoomIndex)) continue;
    if (hasPendingDungeonRoomTrigger(draft.state, playerId, dungeon.dungeonDefId)) continue;
    result.push(playerId);
  }
  return result;
}

/** Remove a completed dungeon from the game, preserving completedCount (309.7). */
function removeDungeon(draft: Draft, playerId: PlayerId): void {
  const existing = draft.state.dungeons?.[playerId];
  const completedCount = (existing?.completedCount ?? 0) + 1;
  draft.state.dungeons = {
    ...draft.state.dungeons,
    [playerId]: { dungeonDefId: '', currentRoomIndex: 0, completedCount },
  };
}

/** SBA 704.5t: complete a dungeon whose marker is on the bottommost room. */
function completeDungeonBySba(draft: Draft, playerId: PlayerId): void {
  const dungeon = draft.state.dungeons?.[playerId];
  if (!dungeon) return;
  const def = dungeonDefOf(draft.state, dungeon.dungeonDefId);
  removeDungeon(draft, playerId);
  pushLog(
    draft,
    `${playerVentureLabel(playerId)}は${dungeonName(def)}を踏破しました(状況起因処理704.5t)。`,
  );
}

function applyVentureIntoDungeon(
  draft: Draft,
  playerId: PlayerId,
  dungeonDefId: string | undefined,
  roomChoice: number | undefined,
): void {
  const existing = draft.state.dungeons?.[playerId];
  // An entry whose def is missing (e.g. cleared by SBA 704.5t) behaves like no
  // active dungeon, but its completedCount must carry over.
  const existingDef = existing ? dungeonDefOf(draft.state, existing.dungeonDefId) : undefined;
  const priorCompletedCount = existing?.completedCount ?? 0;

  // Case 1: no active dungeon — choose and enter a new dungeon (309.2a).
  if (!existing || !existingDef) {
    if (!dungeonDefId) {
      draft.warnings.push('ダンジョンが選択されていません(309.2a)。');
      return;
    }
    const def = dungeonDefOf(draft.state, dungeonDefId);
    if (!def) {
      draft.warnings.push(`不明なダンジョンです: ${dungeonDefId}`);
      return;
    }
    draft.state.dungeons = {
      ...draft.state.dungeons,
      [playerId]: { dungeonDefId: def.id, currentRoomIndex: 0, completedCount: priorCompletedCount },
    };
    pushVentureEvent(draft, playerId, def.id, 0);
    appendDungeonRoomTrigger(draft, playerId, def, 0);
    pushLog(draft, `${playerVentureLabel(playerId)}は${dungeonName(def)}にベンチャーしました。`);
    return;
  }

  const def = existingDef;
  const currentRoom = def.rooms[existing.currentRoomIndex];
  if (!currentRoom) {
    draft.warnings.push(`ダンジョンの部屋が無効です: ${existing.dungeonDefId}`);
    return;
  }

  // Case 2: marker not on bottommost — advance along an arrow (309.5a).
  if (currentRoom.nextRooms.length > 0) {
    if (currentRoom.nextRooms.length > 1) {
      if (roomChoice === undefined) {
        draft.warnings.push('進む部屋を選択してください(309.5a)。');
        return;
      }
      if (!currentRoom.nextRooms.includes(roomChoice)) {
        draft.warnings.push(`選べない部屋です: ${roomChoice}`);
        return;
      }
    }
    const nextRoomIndex =
      currentRoom.nextRooms.length === 1 ? currentRoom.nextRooms[0] : (roomChoice as number);
    draft.state.dungeons = {
      ...draft.state.dungeons,
      [playerId]: { ...existing, currentRoomIndex: nextRoomIndex },
    };
    pushVentureEvent(draft, playerId, def.id, nextRoomIndex);
    appendDungeonRoomTrigger(draft, playerId, def, nextRoomIndex);
    const nextRoom = def.rooms[nextRoomIndex];
    pushLog(
      draft,
      `${playerVentureLabel(playerId)}は${dungeonName(def)}の「${nextRoom?.name ?? ''}」へ進みました。`,
    );
    return;
  }

  // Case 3: marker on bottommost — complete old dungeon, start a new one (309.5b).
  if (!dungeonDefId) {
    draft.warnings.push('次のダンジョンが選択されていません(309.5b)。');
    return;
  }
  const newDef = dungeonDefOf(draft.state, dungeonDefId);
  if (!newDef) {
    draft.warnings.push(`不明なダンジョンです: ${dungeonDefId}`);
    return;
  }
  const completedCount = existing.completedCount + 1; // 309.7 completes the old dungeon
  removeDungeon(draft, playerId);
  draft.state.dungeons = {
    ...draft.state.dungeons,
    [playerId]: { dungeonDefId: newDef.id, currentRoomIndex: 0, completedCount },
  };
  pushVentureEvent(draft, playerId, newDef.id, 0, def.id);
  appendDungeonRoomTrigger(draft, playerId, newDef, 0);
  pushLog(
    draft,
    `${playerVentureLabel(playerId)}は${dungeonName(def)}を踏破し、${dungeonName(newDef)}にベンチャーしました(309.5b)。`,
  );
}

function pushVentureEvent(
  draft: Draft,
  playerId: PlayerId,
  dungeonDefId: string,
  roomIndex: number,
  completedDungeonDefId?: string,
): void {
  pushEvent(draft, {
    type: 'venture',
    playerId,
    dungeonDefId,
    roomIndex,
    ...(completedDungeonDefId !== undefined ? { completedDungeonDefId } : {}),
  } satisfies Omit<VentureEvent, 'eventId' | 'sequence'>);
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
    return toughness !== null && toughness > 0 &&
      !effectiveKeywords(draft.state, card.id).includes('indestructible') &&
      markedDamageOf(card) >= toughness
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
      !effectiveKeywords(draft.state, card.id).includes('indestructible') &&
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

  // CR 704.5y / 303.7a: duplicate Role tokens controlled by the same player
  // attached to the same permanent — keep only the most recent timestamp.
  const duplicateRoleIds = collectDuplicateRoleIds(draft);

  // CR 704.5t / 309.6: a dungeon whose venture marker is on its bottommost room
  // and has no pending room ability is completed (removed from the game).
  const completedDungeonPlayerIds = collectCompletedDungeonPlayerIds(draft);

  // CR 704.5v: a battle with 0 defense counters is put into its owner's graveyard
  // unless a triggered ability from it is on the stack (Siege defeated trigger).
  const zeroDefenseBattleIds = Object.values(draft.state.cards).flatMap((card) => {
    if (!isBattlefieldBattle(draft, card)) return [];
    if ((card.counters.defense ?? 0) !== 0) return [];
    const hasPendingTrigger = draft.state.pendingTriggers.some(
      (trigger) => trigger.sourceId === card.id,
    );
    return hasPendingTrigger ? [] : [card.id];
  });

  // CR 704.5w: a battle with no protector (or protector not in the game) needs
  // a new protector. In 2-player this auto-resolves; otherwise graveyard.
  const noProtectorBattleIds = Object.values(draft.state.cards).flatMap((card) => {
    if (!isBattlefieldBattle(draft, card)) return [];
    if (card.protectorId && draft.state.players[card.protectorId]) return [];
    // CR 704.5w: skip battles currently being attacked.
    const isAttacked = draft.state.combat?.attackers.some(
      (a) => a.target.type === 'battle' && a.target.cardId === card.id,
    );
    if (isAttacked) return [];
    return [card.id];
  });

  // CR 704.5x: a Siege whose protector is also its controller needs a new
  // protector who is an opponent. In 2-player this auto-resolves.
  const siegeControllerProtectorIds = Object.values(draft.state.cards).flatMap((card) => {
    if (!isBattlefieldBattle(draft, card) || !isSiege(draft, card)) return [];
    if (card.protectorId !== card.controllerId) return [];
    return [card.id];
  });

  // CR 714.4: a Saga whose lore counters >= final chapter number is sacrificed
  // unless it has a chapter ability that has triggered but not yet left the stack.
  const sagaSacrificeIds = Object.values(draft.state.cards).flatMap((card) => {
    if (card.zone !== 'battlefield') return [];
    if (!typeLineOf(draft, card).includes('Saga')) return [];
    const oracleText = oracleTextOf(draft, card);
    const abilities = parseSagaChapters(oracleText);
    const finalChapter = finalChapterNumber(abilities);
    if (finalChapter === 0) return []; // 714.2d: no chapter abilities
    const lore = card.counters.lore ?? 0;
    if (lore < finalChapter) return [];
    // CR 714.4: skip if a chapter ability from this Saga has triggered but not
    // yet left the stack. Check both pending triggers (awaiting placement) and
    // ability objects already on the stack zone. Per CR 714.2, all triggered
    // abilities of a Saga are chapter abilities.
    const hasPendingChapter = draft.state.pendingTriggers.some(
      (t) => t.sourceId === card.id && t.triggerId.startsWith('saga-chapter-'),
    );
    if (hasPendingChapter) return [];
    const hasStackedChapter = draft.state.zones.stack.some((stackId) => {
      const obj = draft.state.cards[stackId];
      return (
        obj !== undefined &&
        obj.isAbility === true &&
        obj.abilityKind === 'triggered' &&
        obj.sourceId === card.id
      );
    });
    return hasStackedChapter ? [] : [card.id];
  });

  if (
    zeroToughnessCreatureIds.length === 0 &&
    lethalDamageCreatureIds.length === 0 &&
    deathtouchDamageCreatureIds.length === 0 &&
    zeroLoyaltyPlaneswalkerIds.length === 0 &&
    invalidCopyIds.length === 0 &&
    offBattlefieldTokenIds.length === 0 &&
    counterPairIds.length === 0 &&
    duplicateRoleIds.length === 0 &&
    completedDungeonPlayerIds.length === 0 &&
    zeroDefenseBattleIds.length === 0 &&
    noProtectorBattleIds.length === 0 &&
    siegeControllerProtectorIds.length === 0 &&
    sagaSacrificeIds.length === 0
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

  // CR 704.5y: move older duplicate Roles to graveyard.
  for (const cardId of duplicateRoleIds) {
    const card = draft.state.cards[cardId];
    if (!card || card.zone !== 'battlefield') continue;

    moveCardInternal(draft, cardId, 'graveyard', 'bottom', false, 'sba', {
      simultaneousGroupId,
      sbaApplied: '704.5y',
    });
    pushLog(
      draft,
      `${nameOf(draft, cardId)}は同じプレイヤーがコントロールする役割トークンが同一パーマネントに複数付いているため状況起因処理で墓地に置かれました。`,
    );
  }

  // CR 704.5t: complete dungeons whose marker rests on the bottommost room with
  // no pending room ability left to resolve.
  for (const playerId of completedDungeonPlayerIds) {
    completeDungeonBySba(draft, playerId);
  }

  // CR 704.5w: auto-assign protector for battles without one.
  for (const cardId of noProtectorBattleIds) {
    const card = draft.state.cards[cardId];
    if (!card || !isBattlefieldBattle(draft, card)) continue;
    const protector = defaultBattleProtector(draft.state, card.controllerId);
    if (protector && draft.state.players[protector]) {
      setCard(draft, { ...card, protectorId: protector });
      pushLog(draft, `${nameOf(draft, cardId)}の保護者に${protector}を指定しました。`);
    } else {
      moveCardInternal(draft, cardId, 'graveyard', 'bottom', false, 'sba', {
        simultaneousGroupId,
        sbaApplied: '704.5w',
      });
      pushLog(draft, `${nameOf(draft, cardId)}は保護者がいないため状況起因処理で墓地に置かれました。`);
    }
  }

  // CR 704.5x: auto-reassign protector for Sieges whose controller is the protector.
  for (const cardId of siegeControllerProtectorIds) {
    const card = draft.state.cards[cardId];
    if (!card || !isBattlefieldBattle(draft, card)) continue;
    const opponent = draft.state.turnOrder.find((id) => id !== card.controllerId);
    if (opponent && draft.state.players[opponent]) {
      setCard(draft, { ...card, protectorId: opponent });
      pushLog(draft, `${nameOf(draft, cardId)}の保護者に${opponent}を再指定しました。`);
    } else {
      moveCardInternal(draft, cardId, 'graveyard', 'bottom', false, 'sba', {
        simultaneousGroupId,
        sbaApplied: '704.5x',
      });
      pushLog(draft, `${nameOf(draft, cardId)}は適正な保護者がいないため状況起因処理で墓地に置かれました。`);
    }
  }

  // CR 704.5v: battles with 0 defense counters go to owner's graveyard.
  for (const cardId of zeroDefenseBattleIds) {
    const card = draft.state.cards[cardId];
    if (!card || card.zone !== 'battlefield') continue;

    moveCardInternal(draft, cardId, 'graveyard', 'bottom', false, 'sba', {
      simultaneousGroupId,
      sbaApplied: '704.5v',
    });
    pushLog(draft, `${nameOf(draft, cardId)}は防御カウンターが0のため状況起因処理で墓地に置かれました。`);
  }

  // CR 714.4: Sagas at final chapter with no pending chapter triggers are sacrificed.
  for (const cardId of sagaSacrificeIds) {
    const card = draft.state.cards[cardId];
    if (!card || card.zone !== 'battlefield') continue;

    moveCardInternal(draft, cardId, 'graveyard', 'bottom', false, 'sba', {
      simultaneousGroupId,
      sbaApplied: '714.4',
    });
    pushLog(draft, `${nameOf(draft, cardId)}は最終章に達したため生贄に捧げられた(状況起因処理714.4)。`);
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
  cleanup: 'クリーンナップ',
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

/** CR 502.2 exception: "[This permanent] doesn't untap during your untap step." */
function hasSelfDoesntUntapClause(state: GameState, card: CardInstance): boolean {
  const def = state.defs[card.defId];
  if (!def) return false;
  const face = def.faces[card.faceIndex] ?? def.faces[0];
  const oracleText = face?.oracleText;
  if (!oracleText) return false;
  for (const line of oracleText.split('\n')) {
    if (/doesn't untap during your untap step/i.test(line)
      && !/\benchanted\b|\bequipped\b|\bfortified\b|\btarget\b/i.test(line)) {
      return true;
    }
  }
  return false;
}

function untapControlledPermanents(draft: Draft, playerId: PlayerId): void {
  let changed = false;
  const skipped: string[] = [];
  const cards = { ...draft.state.cards };
  for (const id of draft.state.zones.battlefield) {
    const card = cards[id];
    if (card?.controllerId === playerId && card.tapped) {
      if (hasSelfDoesntUntapClause(draft.state, card)) {
        skipped.push(nameOf(draft, id));
        continue;
      }
      cards[id] = { ...card, tapped: false };
      changed = true;
    }
  }
  if (changed) {
    draft.state.cards = cards;
    pushLog(draft, `${requirePlayer(draft.state, playerId).label}のパーマネントをアンタップした。`);
  }
  for (const name of skipped) {
    pushLog(draft, `${name}はアンタップしない（CR 502.2例外）。`);
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
}

/**
 * CR 714.3c: "As a player's precombat main phase begins, that player puts a
 * lore counter on each Saga they control." This fires at main1 entry, not untap.
 */
function handlePrecombatMainEntry(draft: Draft): void {
  const cards = { ...draft.state.cards };
  let changed = false;

  for (const id of draft.state.zones.battlefield) {
    const card = cards[id];
    if (
      !card ||
      card.controllerId !== draft.state.activePlayerId ||
      !typeLineOf(draft, card).includes('Saga')
    ) continue;
    const previousLore = card.counters.lore ?? 0;
    const nextLore = previousLore + 1;
    const updated = {
      ...card,
      counters: {
        ...card.counters,
        lore: nextLore,
      },
    };
    cards[id] = updated;
    changed = true;
    pushLog(draft, `${nameOf(draft, id)}の章カウンターが${nextLore}になった。`);
    emitSagaChapterTriggers(draft, updated, previousLore, nextLore);
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

function applyMill(
  draft: Draft,
  count: number,
  playerId: PlayerId,
  simultaneousGroupId = `mill-${draft.nextEventSeq}`,
): void {
  requirePlayer(draft.state, playerId);
  const requested = Math.max(0, Math.floor(count));
  if (requested <= 0) return;

  const library = readZone(draft, 'library', playerId);
  const available = library.length;
  const milled = Math.min(requested, available);
  const topIds = library.slice(0, milled);

  for (const cardId of topIds) {
    moveCardInternal(
      draft,
      cardId,
      'graveyard',
      'bottom',
      false,
      'mill',
      { simultaneousGroupId },
    );
  }

  pushLog(draft, `切削: ライブラリの上から${milled}枚を墓地に置いた。`);
  if (requested > available) {
    draft.warnings.push(`ライブラリが${requested}枚に満たないため${milled}枚を切削した。`);
  }
}

function applyDiscard(
  draft: Draft,
  cardIds: string[],
  playerId?: PlayerId,
  simultaneousGroupId?: string,
): void {
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
      simultaneousGroupId ? { simultaneousGroupId } : undefined,
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
  const simultaneousGroupId = cmd.effect === 'mill' ? `mill-${draft.nextEventSeq}` : undefined;
  for (const playerId of orderedRecipients(draft, cmd.controllerId, cmd.recipients)) {
    switch (cmd.effect) {
      case 'draw': {
        const requested = Math.max(0, Math.floor(cmd.amount));
        const drawn = drawCards(draft, requested, commandCause(cmd.type), playerId);
        incrementDrawnThisTurn(draft, playerId, drawn);
        break;
      }
      case 'mill':
        applyMill(draft, cmd.amount, playerId, simultaneousGroupId);
        break;
      case 'life':
        applyLifeDeltaForPlayer(draft, playerId, cmd.amount, commandCause(cmd.type));
        break;
      case 'counter':
        applyPlayerCounterDelta(draft, playerId, cmd.kind, cmd.amount);
        break;
      case 'damage':
        applyLifeDeltaForPlayer(draft, playerId, -cmd.amount, commandCause(cmd.type));
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
  if (phase === 'main1') {
    handlePrecombatMainEntry(draft);
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

function ensureCleanupDiscardChoice(draft: Draft): boolean {
  const playerId = draft.state.activePlayerId;
  const maximum = effectiveMaximumHandSize(draft.state, playerId);
  if (maximum === null) return false;
  const hand = draft.state.zonesByPlayer[playerId]?.hand ?? [];
  const requiredCount = Math.max(0, hand.length - maximum);
  if (requiredCount === 0) return false;
  const existing = draft.state.pendingRuleChoices.find(
    (choice) => choice.kind === 'cleanup-discard' && choice.playerId === playerId,
  );
  if (existing) return true;
  draft.state.pendingRuleChoices = [
    ...draft.state.pendingRuleChoices,
    {
      choiceId: `cleanup-discard:${draft.state.turn}:${playerId}:${draft.nextSeq}`,
      kind: 'cleanup-discard',
      ruleRef: '514.1',
      playerId,
      cardIds: hand.slice(),
      requiredCount,
    },
  ];
  pushLog(draft, `クリーンナップで手札を${requiredCount}枚捨てる必要があります。`);
  return true;
}

function beginCleanup(draft: Draft): void {
  enterPhase(draft, 'cleanup', true);
  ensureCleanupDiscardChoice(draft);
  pushLog(draft, 'クリーンナップ・ステップを開始しました。');
}

function completeCleanupStateActions(draft: Draft): void {
  clearMarkedDamageInternal(draft);
  draft.state.combatDamagePreventedUntilEndOfTurn = false;
}

function finishTurnAfterCleanup(draft: Draft, drawnHandled: boolean): void {
  draft.state.turn += 1;
  resetOncePerTurnTriggerLedger(draft);
  enterPhase(draft, 'untap', drawnHandled);
  pushLog(draft, `ターン${draft.state.turn}に移行しました。`);
}

function applyNextPhase(
  draft: Draft,
  drawnHandled: boolean,
  manualCleanupHandled = false,
): void {
  clearPool(
    draft,
    'フェイズ移行によりマナプールが空になりました。',
    draft.state.activePlayerId,
  );
  const idx = PHASE_ORDER.indexOf(draft.state.phase);
  if (draft.state.phase === 'end') {
    beginCleanup(draft);
    if (!draft.state.pendingRuleChoices.some((choice) => choice.kind === 'cleanup-discard')) {
      completeCleanupStateActions(draft);
      finishTurnAfterCleanup(draft, drawnHandled);
    }
  } else if (draft.state.phase === 'cleanup') {
    if (manualCleanupHandled) {
      completeCleanupStateActions(draft);
      finishTurnAfterCleanup(draft, drawnHandled);
    } else if (!ensureCleanupDiscardChoice(draft)) {
      completeCleanupStateActions(draft);
      finishTurnAfterCleanup(draft, drawnHandled);
    }
  } else if (idx === PHASE_ORDER.length - 1) {
    finishTurnAfterCleanup(draft, drawnHandled);
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
  if (draft.state.phase !== 'cleanup') beginCleanup(draft);
  // CR 514.1 準拠: cleanup の手札調整はプレイヤーの選択が必要。
  // nextTurn の本来の意図「各フェイズを自動パスして次ターンへ」は、
  // cleanup の手札調整の前で止まるべき(陳腐化是正 2026-07-21)。
  // cleanup-discard が生成されていればここで return し、UI がダイアログを表示。
  // ユーザーが解決すると resolveRuleChoice 経路で finishTurnAfterCleanup が走る。
  if (draft.state.pendingRuleChoices.some((choice) => choice.kind === 'cleanup-discard')) {
    return;
  }
  completeCleanupStateActions(draft);
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

  // The zone-change event's `after` snapshot must already include the chosen
  // entry state; ETB conditions such as Mystic Sanctuary inspect that snapshot.
  moveCardInternal(
    draft,
    cardId,
    'battlefield',
    'bottom',
    false,
    'move',
    undefined,
    entersTapped ?? false,
  );
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

/**
 * CR 720.3: validate a castAsOmen request. Only a card with the omen layout
 * can be cast using its Omen characteristics, and the chosen face must be the
 * Omen face (face index 1).
 */
function validateCastAsOmen(def: CardDef | undefined, chosenFaceIndex: number): void {
  if (def?.layout !== 'omen' || chosenFaceIndex !== 1) {
    throw new EngineError('オメンとして唱えられるカードではありません。');
  }
}

/**
 * CR 720.3d: after moving an Omen spell into its owner's library, apply the
 * provided shuffle permutation (which must include the card) or honestly
 * degrade to top-of-library with a warning.
 */
function applyOmenLibraryPlacement(
  draft: Draft,
  cardId: string,
  libraryShuffleOrder?: readonly string[],
): void {
  const card = requireCard(draft, cardId);
  if (libraryShuffleOrder && libraryShuffleOrder.length > 0) {
    applyShuffle(draft, [...libraryShuffleOrder], card.ownerId);
    return;
  }
  draft.warnings.push('オメン呪文の解決にはライブラリのシャッフル順列が必要です(一番上に配置)。');
}

function applyCast(
  draft: Draft,
  cardId: string,
  payment: ManaPool,
  forced: boolean,
  commander: boolean,
  faceIndex?: number,
  requestedPlayerId?: PlayerId,
  castAsOmen?: boolean,
  libraryShuffleOrder?: readonly string[],
): void {
  let card = requireCard(draft, cardId);
  const def = draft.state.defs[card.defId];
  const chosenFaceIndex = faceIndex ?? 0;
  if (!Number.isInteger(chosenFaceIndex) || !def?.faces[chosenFaceIndex]) {
    throw new EngineError(`唱える面が存在しません: ${cardId} face=${chosenFaceIndex}`);
  }
  // CR 720.3: casting as an Omen requires the omen layout and the Omen face.
  if (castAsOmen === true) {
    validateCastAsOmen(def, chosenFaceIndex);
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
    return;
  }

  // CR 720.3d: an Omen spell that resolves immediately shuffles into its
  // owner's library instead of going to its usual resolution zone.
  if (castAsOmen === true) {
    moveCardInternal(draft, cardId, 'library', 'top', false, 'resolve');
    applyOmenLibraryPlacement(draft, cardId, libraryShuffleOrder);
    incrementPlayerTurnCounter(draft, playerId, 'spellsCastThisTurn');
    pushLog(draft, `${name}をキャストし解決しました(オメン: ライブラリへシャッフル)。`);
    return;
  }

  moveCardInternal(draft, cardId, dest, 'bottom', false, 'cast');
  incrementPlayerTurnCounter(draft, playerId, 'spellsCastThisTurn');
  pushLog(draft, `${name}をキャストしました(支払い: ${payStr})。`);
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
  triggerCondition?: TriggerCondition,
  abilityResolutionText?: string,
  announcedX?: number,
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
    triggerCondition,
    abilityResolutionText,
    announcedX,
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
  targetSelections: readonly TargetSelection[] = [],
  teamworkTappedIds: readonly string[] = [],
  castAsOmen?: boolean,
): void {
  let card = requireCard(draft, cardId);
  const def = draft.state.defs[card.defId];
  const chosenFaceIndex = faceIndex ?? 0;
  if (!Number.isInteger(chosenFaceIndex) || !def?.faces[chosenFaceIndex]) {
    throw new EngineError(`唱える面が存在しません: ${cardId} face=${chosenFaceIndex}`);
  }
  // CR 720.3: casting as an Omen requires the omen layout and the Omen face.
  if (castAsOmen === true) {
    validateCastAsOmen(def, chosenFaceIndex);
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
  if (xValue !== undefined || targetSelections.length > 0) {
    const stacked = requireCard(draft, cardId);
    setCard(draft, {
      ...stacked,
      ...(xValue === undefined ? {} : { announcedX: Math.max(0, Math.floor(xValue)) }),
      ...(targetSelections.length === 0
        ? {}
        : { targetSelections: targetSelections.map((selection) => ({ ...selection })) }),
    });
  }
  // CR 720.3b: mark the stack object as cast using Omen characteristics.
  if (castAsOmen === true) {
    const stackedOmen = requireCard(draft, cardId);
    setCard(draft, { ...stackedOmen, castAsOmen: true });
  }
  // CR 702.194a: tap creatures chosen for the optional teamwork additional cost.
  if (teamworkTappedIds.length > 0) {
    for (const tapId of teamworkTappedIds) {
      const creature = requireCard(draft, tapId);
      if (creature.zone !== 'battlefield') {
        throw new EngineError(`チームワークの対象が戦場にありません: ${tapId}`);
      }
      if (creature.controllerId !== playerId) {
        throw new EngineError(`チームワークの対象をコントロールしていません: ${tapId}`);
      }
      if (creature.tapped) {
        throw new EngineError(`チームワークの対象が既にタップされています: ${tapId}`);
      }
      const tapDef = draft.state.defs[creature.defId];
      const tapFace = tapDef?.faces[creature.faceIndex] ?? tapDef?.faces[0];
      if (!tapFace?.typeLine?.includes('Creature')) {
        throw new EngineError(`チームワークの対象がクリーチャーではありません: ${tapId}`);
      }
      setCard(draft, { ...creature, tapped: true });
    }
    const stackedSpell = requireCard(draft, cardId);
    setCard(draft, { ...stackedSpell, usingTeamwork: true });
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
  allowedZones?: ManualTargetZone[],
): void {
  const source = requireCard(draft, stackItemId);
  if (source.zone !== 'stack') {
    throw new EngineError('手動対象を設定できるのはスタック上の項目だけです。');
  }
  if (source.isAbility && !allowStackAbilities) {
    throw new EngineError('手動対象を設定できるのは呪文だけです(能力は対象外)。');
  }
  const allowed = new Set<ManualTargetZone>(allowedZones ?? ['battlefield', 'stack']);
  const uniqueIds = [...new Set(targetIds)];
  const manualObjectSelections = uniqueIds.map((targetId, index): TargetSelection => {
    const target = requireCard(draft, targetId);
    if (target.zone === 'stack' && target.id === stackItemId) {
      throw new EngineError('手動対象には他のスタック上の呪文・能力を選んでください。');
    }
    const isPermanent = target.zone === 'battlefield' && !target.isAbility;
    const isOtherStackObject = target.zone === 'stack'
      && target.id !== stackItemId
      && (allowStackAbilities || !target.isAbility);
    const isAdditionalZone = target.zone !== 'battlefield'
      && target.zone !== 'stack'
      && target.zone !== 'library'
      && allowed.has(target.zone);
    const isOwnHand = target.zone !== 'hand' || target.ownerId === draft.state.localPlayerId;
    if (!allowed.has(target.zone as ManualTargetZone)
      || (!isPermanent && !isOtherStackObject && !isAdditionalZone)
      || !isOwnHand) {
      throw new EngineError('手動対象に指定できない領域または非公開カードです。');
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
  triggerCondition?: TriggerCondition,
  resolutionText?: string,
  announcedX?: number,
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
    triggerCondition,
    resolutionText,
    announcedX,
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
    if (card.abilityResolutionText) {
      return [{
        sourceId,
        def,
        line: {
          faceIndex: card.sourceSnapshot?.faceIndex ?? 0,
          text: card.abilityResolutionText,
          shape: 'triggered',
        },
        typeLine: def.faces[card.sourceSnapshot?.faceIndex ?? 0]?.typeLine ?? def.typeLine,
      }];
    }
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

  // CR 712.8f / 720.3b: a spell on the stack has ONLY the characteristics of
  // its chosen face (for Omen spells, the alternative face). Without this
  // filter a resolving face-1 spell would also compile every other face's
  // lines (e.g. an Omen spell would additionally apply its normal face text).
  return lines
    .filter((line) => line.shape === 'spell' && line.faceIndex === card.faceIndex)
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
    loyaltyDelta: null,
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
  const sourceNames = sourceName
    .split(/\s+\/\/\s+/)
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name !== '');
  const normalizedLower = normalized.toLowerCase();
  if (sourceNames.includes(normalizedLower)) {
    return true;
  }
  const compactSubject = normalizedLower.replace(/[^a-z0-9]/g, '');
  return compactSubject.length > 0 && sourceNames.some((name) => {
    const compactName = name.replace(/[^a-z0-9]/g, '');
    return compactName.includes(compactSubject) || compactSubject.includes(compactName);
  });
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

function tapObjectCostFilter(subject: string): TargetFilter {
  const normalized = subject
    .replace(/\b(tokens?|permanents?)\b/gi, (word) => word.toLowerCase())
    .replace(/\s+/g, ' ')
    .trim();
  const lower = normalized.toLowerCase();
  const types = COST_OBJECT_TYPES.filter((type) =>
    new RegExp(`\\b${type}s?\\b`, 'i').test(lower),
  );
  const hasSupportedTypeDisjunction =
    /^(?:legendary\s+)?artifacts?\s+(?:and\/or|or)\s+creatures?$/i.test(normalized);
  const tokenOnly = /\btokens?\b/i.test(normalized);
  const legendary = /\blegendary\b/i.test(normalized);
  const descriptorWords = normalized
    .replace(/\blegendary\b/gi, '')
    .replace(/\b(?:artifact|creature|enchantment|land|planeswalker|permanent|token)s?\b/gi, '')
    .replace(/\b(?:and\/or|or)\b/gi, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (types.length > 1 && !hasSupportedTypeDisjunction) {
    return { types: [], controller: 'you' };
  }
  if (descriptorWords.length > 1) {
    return { types: [], controller: 'you' };
  }
  return {
    types: types.length > 0 ? types : ['permanent'],
    controller: 'you',
    ...(legendary ? { supertypes: ['legendary'] } : {}),
    ...(descriptorWords.length === 1 ? { subtypes: [descriptorWords[0].toLowerCase()] } : {}),
    ...(tokenOnly ? { tokenOnly: true } : {}),
  };
}

function parseTapObjectCostElement(
  element: string,
  payerId: PlayerId,
  slotId: string,
  announcedX?: number,
): { component: ActivationCostComponent; prompts: EffectPrompt[] } | null {
  const match =
    /^Tap\s+(a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+|X)\s+(other\s+)?(untapped\s+)?(.+?)\s+you\s+control$/i.exec(
      element,
    );
  if (!match) {
    return null;
  }
  const amountToken = match[1];
  const other = match[2] !== undefined;
  const objectPhrase = match[4].trim();
  if (/^(?:this|it|self|~)$/i.test(objectPhrase)) {
    return null;
  }
  const amount =
    /^X$/i.test(amountToken) ? announcedX ?? null : parseCostAmountToken(amountToken);
  if (amount === null || !Number.isInteger(amount) || amount < 0) {
    return null;
  }
  const parsedFilter = tapObjectCostFilter(objectPhrase);
  if (parsedFilter.types?.length === 0) {
    return null;
  }
  const filter: TargetFilter = {
    ...parsedFilter,
    zone: 'battlefield',
    excludeSource: other,
  };
  return {
    component: {
      kind: 'tap-object',
      raw: element,
      payerId,
      status: 'guided',
      amount,
      slotId,
    },
    prompts: Array.from({ length: amount }, (_, index) => ({
      atom: null,
      kind: 'cost-tap' as const,
      count: amount,
      slotId: promptSlotId(slotId, index),
      filter,
      raw: element,
    })),
  };
}

function normalizeCounterType(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().toLowerCase();
}

function counterSourceFilter(subject: string): TargetFilter | null {
  const match = /^(?:a|an|one)\s+(permanent|artifact|creature)\s+you\s+control$/i.exec(
    subject.trim(),
  );
  if (!match) {
    return null;
  }
  return {
    types: [match[1].toLowerCase()],
    controller: 'you',
  };
}

function parseRemoveCounterCostElement(
  state: GameState,
  element: string,
  payerId: PlayerId,
  slotId: string,
  sourceName: string,
  sourceSnapshot: ObjectSnapshot,
  announcedX?: number,
): {
  component: ActivationCostComponent;
  commands: GameCommand[];
  prompts: EffectPrompt[];
} | null {
  const match =
    /^Remove\s+(one or more|a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+|X)\s+(.+?)\s+counters?\s+from\s+(.+)$/i.exec(
      element,
    );
  if (!match) {
    return null;
  }
  const amountToken = match[1];
  const counterType = normalizeCounterType(match[2]);
  const subject = match[3].trim();
  if (!counterType || /\b(?:any|chosen)\b/i.test(counterType)) {
    return null;
  }

  const sourceRef = activationSourceRefFromSnapshot(sourceSnapshot);
  const strictSelf = isSelfSacrificeSubject(subject, sourceName);
  if (/^one or more$/i.test(amountToken)) {
    if (!strictSelf) {
      return null;
    }
    const max = state.cards[sourceSnapshot.physicalCardId]?.counters[counterType] ?? 0;
    return {
      component: {
        kind: 'remove-counter',
        raw: element,
        payerId,
        status: 'guided',
        slotId,
        subjectRef: sourceRef,
        subjectRefs: [sourceRef],
        counterType,
      },
      commands: [],
      prompts: [{
        atom: null,
        kind: 'cost-remove-counter',
        count: 1,
        slotId: promptSlotId(slotId, 0),
        counterCost: {
          interaction: 'amount',
          counterType,
          amount: { kind: 'one-or-more', min: 1, max },
          sourceId: sourceSnapshot.physicalCardId,
        },
        raw: element,
      }],
    };
  }

  const amount =
    /^X$/i.test(amountToken) ? announcedX ?? null : parseCostAmountToken(amountToken);
  if (amount === null || !Number.isInteger(amount) || amount < 0) {
    return null;
  }
  if (strictSelf) {
    return {
      component: {
        kind: 'remove-counter',
        raw: element,
        payerId,
        status: 'auto',
        amount,
        slotId,
        subjectRef: sourceRef,
        subjectRefs: [sourceRef],
        counterType,
      },
      commands:
        amount > 0
          ? [{
              type: 'addCounters',
              cardId: sourceSnapshot.physicalCardId,
              counterType,
              delta: -amount,
            }]
          : [],
      prompts: [],
    };
  }

  if (amount <= 0) {
    return null;
  }
  const filter = counterSourceFilter(subject);
  if (!filter) {
    return null;
  }
  return {
    component: {
      kind: 'remove-counter',
      raw: element,
      payerId,
      status: 'guided',
      amount,
      slotId,
      counterType,
    },
    commands: [],
    prompts: [{
      atom: null,
      kind: 'cost-remove-counter',
      count: 1,
      slotId: promptSlotId(slotId, 0),
      filter,
      counterCost: {
        interaction: 'source',
        counterType,
        amount: { kind: 'fixed', value: amount },
      },
      raw: element,
    }],
  };
}

function parseMillCostElement(
  element: string,
  payerId: PlayerId,
  slotId: string,
): { component: ActivationCostComponent; commands: GameCommand[] } | null {
  const match = /^Mill\s+(a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+cards?$/i.exec(
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
      kind: 'mill',
      raw: element,
      payerId,
      status: 'auto',
      amount,
      slotId,
    },
    commands: [{
      type: 'mill',
      count: amount,
      ...(payerId !== 'P1' ? { playerId: payerId } : {}),
    }],
  };
}

function activationNonmanaCosts(
  state: GameState,
  rawCost: string,
  sourceSnapshot: ObjectSnapshot,
  announcedX?: number,
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

    const tapObject = parseTapObjectCostElement(element, payerId, slotId, announcedX);
    if (tapObject) {
      components.push(tapObject.component);
      prompts.push(...tapObject.prompts);
      return;
    }

    const removeCounter = parseRemoveCounterCostElement(
      state,
      element,
      payerId,
      slotId,
      sourceName,
      sourceSnapshot,
      announcedX,
    );
    if (removeCounter) {
      components.push(removeCounter.component);
      commands.push(...removeCounter.commands);
      prompts.push(...removeCounter.prompts);
      return;
    }

    const mill = parseMillCostElement(element, payerId, slotId);
    if (mill) {
      components.push(mill.component);
      commands.push(...mill.commands);
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
    const parsedMana = parseManaCost(manaCost);
    components.push({
      kind: 'mana',
      raw: manaCost,
      payerId,
      status,
      manaCost,
      amount: parsedMana.generic + parsedMana.pips.length,
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
  if (/\btarget activated or triggered ability you control\b/i.test(raw)) {
    return {
      zone: 'stack',
      stackKinds: ['activated-ability', 'triggered-ability'],
      controller: 'you',
      excludeManaAbilities: true,
    };
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

export function expandPlayerRecipientPrompt(
  state: GameState,
  sourceId: string,
  controllerId: PlayerId,
  prompt: EffectPrompt,
  simultaneousGroupId: string,
): EffectPrompt[] {
  if (!prompt.recipients) return [prompt];
  const activeIndex = state.turnOrder.indexOf(state.activePlayerId);
  const apnap = activeIndex < 0
    ? state.turnOrder.slice()
    : [...state.turnOrder.slice(activeIndex), ...state.turnOrder.slice(0, activeIndex)];
  const recipients = prompt.recipients === 'eachPlayer'
    ? apnap
    : apnap.filter((playerId) => playerId !== controllerId);
  return recipients.map((playerId) => {
    const available = prompt.kind === 'discard'
      ? state.zonesByPlayer[playerId]?.hand.length ?? 0
      : prompt.kind === 'sacrifice'
        ? eligibleTargets(
            state,
            prompt.filter ?? { types: ['permanent'], controller: 'you' },
            { sourceId, controllerId: playerId },
          ).length
        : prompt.count;
    return {
      ...prompt,
      count: Math.min(prompt.count, available),
      playerId,
      simultaneousGroupId,
    };
  });
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
      ...(card.announcedX === undefined ? {} : { announcedX: card.announcedX }),
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
    for (const [promptIndex, prompt] of compiled.prompts.entries()) {
      if (prompt.recipients) {
        const simultaneousGroupId = `guided-${topId}-${state.eventLog.length}-${promptIndex}`;
        prompts.push(...expandPlayerRecipientPrompt(
          state,
          effectLine.sourceId,
          card.controllerId,
          prompt,
          simultaneousGroupId,
        ));
        continue;
      }
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
  announcedX?: number,
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
  const costHasX = /\{X\}|\bX\b/i.test(ir.cost?.raw ?? '');
  if (
    costHasX
    && (
      announcedX === undefined
      || !Number.isInteger(announcedX)
      || announcedX < 0
    )
  ) {
    return {
      commands: [],
      decision: 'manual',
      manaShortfall: 0,
      costComponents: [],
      costPrompts: [],
    };
  }
  const resolvedCostRaw = (ir.cost?.raw ?? '').replace(
    /\{X\}/gi,
    `{${announcedX ?? 0}}`,
  );
  const commanderColorIdentity = commanderColorIdentityForState(state);
  const sourceSnapshot = objectSnapshotForCard(state, sourceId);
  // CR 606.4: strip the loyalty cost from the raw text before passing to the
  // nonmana cost parser. The loyalty command is added separately below.
  const costRawWithoutLoyalty = ir.cost?.loyaltyDelta != null
    ? resolvedCostRaw.replace(/^\s*[+−-]\d+\s*$/, '').trim()
    : resolvedCostRaw;
  const nonmanaCost =
    sourceSnapshot && ir.cost
      ? activationNonmanaCosts(state, costRawWithoutLoyalty, sourceSnapshot, announcedX)
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
  // CR 702.193a: Power-up cost reduction when permanent entered this turn.
  let effectiveManaCost = compiledCost.manaCost;
  if (
    effectiveManaCost !== null
    && line.keywordId === 'power-up'
    && source.enteredTurn === state.turn
  ) {
    const face = def.faces[source.faceIndex];
    const permanentManaCost = face?.manaCost ?? '';
    if (permanentManaCost) {
      effectiveManaCost = reduceManaCost(effectiveManaCost, permanentManaCost);
    }
  }
  if (effectiveManaCost !== null) {
    const plan = planAutoTap(state, parseManaCost(effectiveManaCost), 0, source.controllerId);
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

  // CR 606.4: loyalty cost = add/remove loyalty counters on the source permanent.
  if (ir.cost?.loyaltyDelta != null && ir.cost.loyaltyDelta !== 0) {
    commands.push({
      type: 'addCounters',
      cardId: sourceId,
      counterType: 'loyalty',
      delta: ir.cost.loyaltyDelta,
    });
  }

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
            effectiveManaCost,
            commands,
            'auto',
          ),
          ...nonmanaCost.components,
        ]
      : [],
    costPrompts: nonmanaCost.prompts,
  };
}

const JEWELED_AMULET_MANA_PATTERN =
  /add one mana of the last noted type/i;

function jeweledAmuletManaCommands(
  state: GameState,
  sourceId: string,
  effectText: string,
  controllerId?: PlayerId,
): GameCommand[] | null {
  if (!JEWELED_AMULET_MANA_PATTERN.test(effectText)) return null;
  const source = state.cards[sourceId];
  if (!source) return null;
  const notedEntry = Object.entries(source.counters).find(([key]) => key.startsWith('noted-'));
  const color = (notedEntry ? notedEntry[0].slice('noted-'.length) : 'C').toUpperCase() as 'W' | 'U' | 'B' | 'R' | 'G' | 'C';
  const commands: GameCommand[] = [
    { type: 'addCounters', cardId: sourceId, counterType: 'charge', delta: -1 },
    {
      type: 'addMana',
      color,
      amount: 1,
      ...(controllerId && controllerId !== 'P1' ? { playerId: controllerId } : {}),
    },
  ];
  return commands;
}

const COUNTER_SCALED_MANA_PATTERN =
  /add\s+(\{[WUBRGC]\})\s+for each\s+(\w+(?:\/\w+)*)\s+counters?\s+on\b/i;

function counterScaledManaCommands(
  state: GameState,
  sourceId: string,
  effectText: string,
  controllerId?: PlayerId,
): GameCommand[] | null {
  const match = COUNTER_SCALED_MANA_PATTERN.exec(effectText);
  if (!match) return null;
  const color = match[1].slice(1, -1).toUpperCase() as 'W' | 'U' | 'B' | 'R' | 'G' | 'C';
  const counterType = match[2];
  const source = state.cards[sourceId];
  if (!source) return null;
  const count = source.counters[counterType] ?? 0;
  if (count <= 0) return [];
  const commands: GameCommand[] = [];
  for (let i = 0; i < count; i++) {
    commands.push({
      type: 'addMana',
      color,
      amount: 1,
      ...(controllerId && controllerId !== 'P1' ? { playerId: controllerId } : {}),
    });
  }
  return commands;
}

export function activatedManaAbilityPlanForSource(
  state: GameState,
  sourceId: string,
  abilityLineIndex?: number,
  announcedX?: number,
): {
  commands: GameCommand[];
  decision: AutoDecision | 'assisted';
  prompts: EffectPrompt[];
  costComponents: ActivationCostComponent[];
  costPrompts: EffectPrompt[];
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
  const costHasX = /\{X\}|\bX\b/i.test(ir.cost?.raw ?? '');
  if (
    costHasX
    && (
      announcedX === undefined
      || !Number.isInteger(announcedX)
      || announcedX < 0
    )
  ) {
    return null;
  }

  const amuletEffectRaw = ir.effects.map((e) => e.raw).join(' ');
  const amuletPlan = jeweledAmuletManaCommands(state, sourceId, amuletEffectRaw, source.controllerId);
  if (amuletPlan !== null) {
    const tapCommand: GameCommand = { type: 'setTapped', cardId: sourceId, tapped: true };
    return {
      commands: [tapCommand, ...amuletPlan],
      decision: 'auto',
      prompts: [],
      costComponents: [],
      costPrompts: [],
      manaShortfall: 0,
      lifeCost: 0,
    };
  }

  const commanderColorIdentity = commanderColorIdentityForState(state);
  const sourceSnapshot = objectSnapshotForCard(state, sourceId);
  const resolvedCostRaw = (ir.cost?.raw ?? '').replace(
    /\{X\}/gi,
    `{${announcedX ?? 0}}`,
  );
  const nonmanaCost =
    sourceSnapshot && ir.cost
      ? activationNonmanaCosts(state, resolvedCostRaw, sourceSnapshot, announcedX)
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
      prompts: [],
      costComponents: [],
      costPrompts: [],
      manaShortfall: 0,
      lifeCost: 0,
    };
  }

  const compiledEffect = compileAbilityIR(ir, {
    sourceId,
    def,
    controllerId: source.controllerId,
    commanderColorIdentity,
    ...(announcedX === undefined ? {} : { announcedX }),
  });
  const baseCostCommands: GameCommand[] = autoCost?.sacrificesSelf
    ? withSelfSacrificeReason(compiledCost.commands, sourceId)
    : compiledCost.commands.slice();
  let manaShortfall = 0;
  if (compiledCost.manaCost !== null) {
    const plan = planAutoTap(
      state,
      parseManaCost(compiledCost.manaCost),
      0,
      source.controllerId,
    );
    baseCostCommands.push(
      ...autoTapCommands(plan, source.controllerId),
      {
        type: 'payMana',
        payment: plan.payment,
        ...(source.controllerId !== 'P1' ? { playerId: source.controllerId } : {}),
      },
    );
    manaShortfall = plan.shortfall;
  }
  baseCostCommands.push(...nonmanaCost.commands);
  const costComponents = sourceSnapshot
    ? [
        ...activationCostComponents(
          sourceId,
          sourceSnapshot,
          ir.cost?.raw ?? '',
          compiledCost.manaCost,
          baseCostCommands,
          'auto',
        ),
        ...nonmanaCost.components,
      ]
    : [];
  const costPrompts = nonmanaCost.prompts;
  const lifeCost = baseCostCommands.reduce(
    (total, command) =>
      total + (command.type === 'adjustLife' && command.delta < 0 ? -command.delta : 0),
    0,
  );

  if (compiledEffect.decision === 'manual') {
    const effectRaw = ir.effects.map((e) => e.raw).join(' ');
    const amuletMana = jeweledAmuletManaCommands(state, sourceId, effectRaw, source.controllerId);
    if (amuletMana !== null) {
      return {
        commands: [...baseCostCommands, ...amuletMana],
        decision: costPrompts.length > 0 ? 'guided' : 'auto',
        prompts: costPrompts,
        costComponents,
        costPrompts,
        manaShortfall,
        lifeCost,
      };
    }
    const scaledMana = counterScaledManaCommands(state, sourceId, effectRaw, source.controllerId);
    if (scaledMana !== null) {
      return {
        commands: [...baseCostCommands, ...scaledMana],
        decision: costPrompts.length > 0 ? 'guided' : 'auto',
        prompts: costPrompts,
        costComponents,
        costPrompts,
        manaShortfall,
        lifeCost,
      };
    }
    const restrictionText = restrictedLiteralManaAssistText(ir, compiledEffect.commands);
    if (restrictionText === null) {
      return {
        commands: [],
        decision: 'manual',
        prompts: [],
        costComponents: [],
        costPrompts: [],
        manaShortfall: 0,
        lifeCost: 0,
      };
    }
    return {
      commands: [...baseCostCommands, ...compiledEffect.commands],
      decision: costPrompts.length > 0 ? 'guided' : 'assisted',
      prompts: costPrompts,
      costComponents,
      costPrompts,
      manaShortfall,
      lifeCost,
      restrictionText,
    };
  }
  if (
    compiledEffect.decision === 'guided' &&
    compiledEffect.prompts.some((prompt) => prompt.kind !== 'mana')
  ) {
    return {
      commands: [],
      decision: 'manual',
      prompts: [],
      costComponents: [],
      costPrompts: [],
      manaShortfall: 0,
      lifeCost: 0,
    };
  }

  const prompts = [...costPrompts, ...compiledEffect.prompts];

  return {
    commands: [...baseCostCommands, ...compiledEffect.commands],
    decision: prompts.length > 0 ? 'guided' : compiledEffect.decision,
    prompts,
    costComponents,
    costPrompts,
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

function stackObjectIsManaAbility(state: GameState, card: CardInstance): boolean {
  if (!card.isAbility || card.abilityKind !== 'activated' || card.abilityLineIndex === undefined) {
    return false;
  }
  const def = state.defs[card.defId];
  const line = def ? splitAbilityLines(def)[card.abilityLineIndex] : undefined;
  if (!def || !line) return false;
  const typeLine = def.faces[line.faceIndex]?.typeLine ?? def.typeLine;
  return isActivatedManaAbilityIR(parseAbilityIR(line.text, typeLine));
}

export function eligibleTargets(
  state: GameState,
  filter: TargetFilter,
  context: { sourceId?: string; controllerId?: PlayerId } = {},
): string[] {
  const sourceControllerId = context.controllerId ?? (context.sourceId
    ? state.cards[context.sourceId]?.controllerId ?? state.localPlayerId
    : state.localPlayerId);
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
      if (filter.excludeManaAbilities && stackObjectIsManaAbility(state, card)) return false;
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
      if (filter.tokenOnly && !card.isToken) {
        return false;
      }

      // Ability objects have only their ability text (CR 405.4), so card-type filters apply
      // exclusively to spells. Ability-aware callers use stackKinds without types.
      if (card.isAbility && types.length > 0) return false;
      const typeLine = typeLineForStateCard(state, card);
      if (
        filter.supertypes?.some((supertype) => !typeLineHasType(typeLine, supertype))
      ) {
        return false;
      }
      if (filter.subtypes?.some((subtype) => !typeLineHasType(typeLine, subtype))) {
        return false;
      }
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
    // CR 109.2a: the untyped noun "card" ("Return target card from your graveyard to
    // your hand.") matches any card in the zone — no type-line restriction applies.
    const supportsAnyCard = types.includes('card');
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
      if (filter.tokenOnly && !card.isToken) {
        return false;
      }
      if (!supportsCreatureCard && !supportsPermanentCard && !supportsAnyCard) {
        return false;
      }
      const def = state.defs[card.defId];
      const face = def?.faces[card.faceIndex] ?? def?.faces[0];
      const typeLine = (face?.typeLine ?? def?.typeLine ?? '').toLowerCase();
      if (
        filter.supertypes?.some((supertype) => !typeLineHasType(typeLine, supertype))
      ) {
        return false;
      }
      if (filter.subtypes?.some((subtype) => !typeLineHasType(typeLine, subtype))) {
        return false;
      }
      if (excludedTypes.some((type) => typeLine.includes(type.toLowerCase()))) {
        return false;
      }
      const matchesRequestedCard = supportsAnyCard
        ? true
        : supportsCreatureCard
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
    if (filter.tokenOnly && !card.isToken) {
      return false;
    }
    if (filter.supertypes?.some((supertype) => !typeLineHasType(typeLine, supertype))) {
      return false;
    }
    if (filter.subtypes?.some((subtype) => !typeLineHasType(typeLine, subtype))) {
      return false;
    }
    if (excludedTypes.some((type) => typeLineHasType(typeLine, type))) {
      return false;
    }
    // CR 115.1/115.2: a mana-value ceiling ("with mana value N or less") is part of the
    // target legality check — candidates above the ceiling must never be offered. Mana
    // value comes from the card definition (faces' mana cost falling back to the printed
    // mana value, CR 202.3); undefined mana value (e.g. face-down / uncosted objects)
    // fails closed and is excluded, matching the graveyard branch above.
    if (filter.maxManaValue !== undefined) {
      const def = state.defs[card.defId];
      const face = def?.faces[card.faceIndex] ?? def?.faces[0];
      const manaValue = manaValueOfStackObject(card, face?.manaCost, def?.cmc);
      if (manaValue === undefined || manaValue > filter.maxManaValue) {
        return false;
      }
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

function applyMaximumHandSizeOverride(
  draft: Draft,
  value: number | 'none' | undefined,
  requestedPlayerId?: PlayerId,
): void {
  const playerId = requestedPlayerId ?? draft.state.localPlayerId;
  const player = requirePlayer(draft.state, playerId);
  const normalized = typeof value === 'number'
    ? Math.max(0, Math.floor(value))
    : value;
  draft.state.players = {
    ...draft.state.players,
    [playerId]: { ...player, maximumHandSizeOverride: normalized },
  };
  pushLog(
    draft,
    normalized === undefined
      ? `${player.label}の手札上限をカード効果から自動判定します。`
      : normalized === 'none'
        ? `${player.label}の手札上限を「上限なし」に手動補正しました。`
        : `${player.label}の手札上限を${normalized}枚に手動補正しました。`,
  );
}

function applyAutoCommand(draft: Draft, cmd: GameCommand): void {
  switch (cmd.type) {
    case 'destroyPermanents': {
      applyDestroyPermanents(draft, cmd.selector);
      break;
    }
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
    case 'setMaximumHandSizeOverride': {
      applyMaximumHandSizeOverride(draft, cmd.value, cmd.playerId);
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
): { scheduled: boolean; immediateText?: string } | null {
  if (!hasDelayedPhaseBeginTiming(effectLine.line.text)) {
    return null;
  }
  const split = splitDelayedPhaseBeginText(effectLine.line.text);
  if (!split) {
    draft.warnings.push(`${stackNameOf(draft, stackItem)}の複合遅延効果を分割できないため手動扱いにしました。`);
    return { scheduled: false };
  }

  const sourceSnapshot = sourceSnapshotForResolvedEffectLine(draft, stackItem, effectLine.sourceId);
  if (!sourceSnapshot) {
    draft.warnings.push(`${stackNameOf(draft, stackItem)}の遅延誘発の発生源を特定できません。`);
    return { scheduled: false };
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
    draft.warnings.push(`${stackNameOf(draft, stackItem)}の遅延誘発を安全に予約できないため手動扱いにしました。`);
    return { scheduled: false };
  }

  appendPendingTrigger(draft, pending);
  pushLog(
    draft,
    `《${cardName(draft.state.defs[sourceSnapshot.defId])}》の遅延誘発を予約しました。`,
  );
  return {
    scheduled: true,
    ...(split.immediateText === undefined ? {} : { immediateText: split.immediateText }),
  };
}

function applyModeledStackCopyEffect(draft: Draft, card: CardInstance): boolean {
  const text = stackItemRulesText(draft.state, card);
  if (!/\bcopy target activated or triggered ability you control X times\b/i.test(text)) {
    return false;
  }
  const quantity = card.announcedX ?? 0;
  const target = card.targetSelections?.find(
    (selection) => selection.selection.kind === 'object',
  );
  if (quantity < 1 || target?.selection.kind !== 'object') {
    draft.warnings.push(`${stackNameOf(draft, card)}のコピー回数または対象が記録されていません。`);
    return true;
  }
  applyCopyStackItem(draft, target.selection.physicalCardId, quantity);
  pushLog(draft, `${stackNameOf(draft, card)}により対象の能力を${quantity}回コピーした。`);
  return true;
}

const COUNTER_PUT_THEN_DRAW_PATTERN =
  /put (?:a|an|one|\d+) (\w+(?:\/\w+)*) counters? on .+?\.\s*(?:then\s+)?draw (?:a|one) cards? for each (\w+(?:\/\w+)*) counters? on/i;
const COUNTER_SCALED_DRAW_PATTERN =
  /draw (?:a|one|\d+) cards? for each (\w+(?:\/\w+)*) counters? on/i;
const COUNTER_SCALED_LIFE_LOSS_PATTERN =
  /lose (?:a|one|\d+) life for each (\w+(?:\/\w+)*) counters? on/i;

function tryCounterScaledResolution(
  draft: Draft,
  card: CardInstance,
  effectText: string,
  sourceId: string,
  controllerId: PlayerId,
): boolean {
  const putThenDraw = COUNTER_PUT_THEN_DRAW_PATTERN.exec(effectText);
  if (putThenDraw) {
    const counterType = putThenDraw[1];
    const source = draft.state.cards[sourceId];
    if (!source) return false;
    applyAutoCommands(draft, [{ type: 'addCounters', cardId: sourceId, counterType, delta: 1 }]);
    const updatedCount = (draft.state.cards[sourceId]?.counters[counterType] ?? 0);
    if (updatedCount > 0) {
      applyAutoCommands(draft, [{
        type: 'applyPlayerEffect',
        controllerId,
        recipients: 'you' as const,
        effect: 'draw',
        amount: updatedCount,
      }]);
    }
    pushLog(draft, `${stackNameOf(draft, card)}の効果を解決した(カウンター${updatedCount}個ぶんドロー)。`);
    return true;
  }
  const scaledDraw = COUNTER_SCALED_DRAW_PATTERN.exec(effectText);
  if (scaledDraw) {
    const counterType = scaledDraw[1];
    const source = draft.state.cards[sourceId];
    if (!source) return false;
    const count = source.counters[counterType] ?? 0;
    if (count > 0) {
      applyAutoCommands(draft, [{
        type: 'applyPlayerEffect',
        controllerId,
        recipients: 'you' as const,
        effect: 'draw',
        amount: count,
      }]);
    }
    pushLog(draft, `${stackNameOf(draft, card)}の効果を解決した(カウンター${count}個ぶんドロー)。`);
    return true;
  }
  const jeweledNote = /put a charge counter on .+?\. note the type of mana spent/i.exec(effectText);
  if (jeweledNote) {
    applyAutoCommands(draft, [{ type: 'addCounters', cardId: sourceId, counterType: 'charge', delta: 1 }]);
    const hasNoted = Object.keys(draft.state.cards[sourceId]?.counters ?? {}).some((k) => k.startsWith('noted-'));
    if (!hasNoted) {
      applyAutoCommands(draft, [{ type: 'addCounters', cardId: sourceId, counterType: 'noted-C', delta: 1 }]);
    }
    pushLog(draft, `${stackNameOf(draft, card)}に蓄積カウンターを置いた。マナ種別は右クリックメニューのカウンター操作で記録してください。`);
    return true;
  }

  const scaledLifeLoss = COUNTER_SCALED_LIFE_LOSS_PATTERN.exec(effectText);
  if (scaledLifeLoss) {
    const counterType = scaledLifeLoss[1];
    const source = draft.state.cards[sourceId];
    if (!source) return false;
    const count = source.counters[counterType] ?? 0;
    if (count > 0) {
      applyAutoCommands(draft, [{
        type: 'applyPlayerEffect',
        controllerId,
        recipients: 'you' as const,
        effect: 'life',
        amount: -count,
      }]);
    }
    pushLog(draft, `${stackNameOf(draft, card)}の効果を解決した(カウンター${count}個ぶんのライフ喪失)。`);
    return true;
  }
  return false;
}

function applyCompiledEffectsForStackItem(
  draft: Draft,
  card: CardInstance,
  effectLines: readonly ResolvableEffectLine[],
  libraryShuffleOrder?: readonly string[],
  guidedHandled?: boolean,
): void {
  if (applyModeledStackCopyEffect(draft, card)) return;
  const commanderColorIdentity = commanderColorIdentityForState(draft.state);
  // §34.55.2: one generic manual-remainder warning per resolving item. When the guided
  // plan was fully answered (guidedHandled === true), guided lines contribute no warning
  // at all — only manual lines still may, deduplicated to a single occurrence.
  let manualRemainderWarningEmitted = false;
  for (const [lineIndex, effectLine] of effectLines.entries()) {
    const delayed = scheduleDelayedTriggerForEffectLine(draft, card, effectLine, lineIndex);
    if (delayed && (!delayed.scheduled || delayed.immediateText === undefined)) continue;
    const resolvedLine = delayed?.immediateText === undefined
      ? effectLine.line
      : { ...effectLine.line, text: delayed.immediateText };
    const ir = parseAbilityIR(resolvedLine.text, effectLine.typeLine);
    const compiled = compileAbilityIR(ir, {
      sourceId: effectLine.sourceId,
      def: effectLine.def,
      controllerId: card.controllerId,
      commanderColorIdentity,
      ...(card.announcedX === undefined ? {} : { announcedX: card.announcedX }),
      ...(isPureSelfLibraryShuffleLine(effectLine.line.text) && libraryShuffleOrder
        ? { libraryShuffleOrder }
        : {}),
    });
    if (compiled.decision !== 'auto') {
      if (tryCounterScaledResolution(draft, card, resolvedLine.text, effectLine.sourceId, card.controllerId)) {
        continue;
      }
      const warningCountBeforeManualHandling = draft.warnings.length;
      if (delayed?.scheduled) {
        draft.warnings.push(
          `${stackNameOf(draft, card)}の遅延誘発は予約しましたが、即時部分は手動で処理してください。`,
        );
      }
      let appliedStoredTargets = false;
      if (compiled.decision === 'guided') {
        appliedStoredTargets = applyStoredTargetCommands(
          draft,
          card,
          compiled.prompts,
          effectLine.sourceId,
          effectLine.def,
        );
        if (appliedStoredTargets) {
          pushLog(draft, `${stackNameOf(draft, card)}の保存済み対象への効果を実行した。`);
        }
      }
      if (
        !delayed?.scheduled
        && !appliedStoredTargets
        && draft.warnings.length === warningCountBeforeManualHandling
        // §34.55.2: a guided line whose prompts were all answered legally leaves no
        // remainder, so the generic "please handle parts manually" warning is a false
        // positive there and must not fire. Manual lines keep their honest warning.
        && !(guidedHandled === true && compiled.decision === 'guided')
        && !manualRemainderWarningEmitted
      ) {
        draft.warnings.push(
          `${stackNameOf(draft, card)}の効果には自動化未対応部分があります。一部手動で処理してください。`,
        );
        manualRemainderWarningEmitted = true;
      }
      continue;
    }
    applyAutoCommands(
      draft,
      lineHasSelfSacrifice(resolvedLine.text)
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

/**
 * CR 310.11b: resolve a Siege's defeated trigger — exile the battle permanent,
 * then emit a guided warning for the "may cast transformed" part (honest defer
 * for this slice; the exile is fully automated).
 */
function applySiegeDefeatedResolution(draft: Draft, abilityCard: CardInstance): void {
  const sourceId = abilityCard.sourceId;
  const sourceName = sourceId ? nameOf(draft, sourceId) : 'バトル';
  pushLog(draft, `${sourceName}の包囲陥落能力を解決した。`);

  if (!sourceId) return;
  const battle = draft.state.cards[sourceId];
  if (!battle || battle.zone !== 'battlefield') {
    pushLog(draft, `${sourceName}はすでに戦場にないため追放できない。`);
    return;
  }

  moveCardInternal(draft, sourceId, 'exile', 'bottom', false, 'move', {
    replacementApplied: '310.11b:siege-defeated',
  });
  pushLog(draft, `${sourceName}を追放した。変身して唱えるかどうかは手動で処理してください。`);
  draft.warnings.push(
    `siege-defeated: ${sourceId} を追放しました。` +
    '変身してマナ・コストを支払わずに唱えるかどうかは手動で処理してください。',
  );
}

function applyResolveStackTop(
  draft: Draft,
  to?: ZoneId,
  libraryShuffleOrder?: readonly string[],
  guidedHandled?: boolean,
): void {
  const stack = draft.state.zones.stack;
  if (stack.length === 0) return;

  const topId = stack[stack.length - 1];
  const card = requireCard(draft, topId);
  const effectLines = effectLinesForResolvedStackItem(draft, card);

  if (card.isAbility) {
    deleteCardFromState(draft, topId);
    if (card.triggerCondition && !triggerConditionSatisfied(draft.state, card.triggerCondition)) {
      pushLog(draft, `${stackNameOf(draft, card)}の能力は解決時の条件を満たさず効果を発生しなかった。`);
      return;
    }
    // CR 310.11b: Siege defeated trigger — exile the battle, then the controller
    // may cast it transformed without paying its mana cost (guided/manual defer).
    if (card.abilityResolutionText?.includes('Exile this permanent')) {
      applySiegeDefeatedResolution(draft, card);
      return;
    }
    pushLog(draft, `${stackNameOf(draft, card)}の能力を解決した。`);
    applyCompiledEffectsForStackItem(draft, card, effectLines, libraryShuffleOrder, guidedHandled);
    return;
  }

  // CR 720.3d: as an Omen spell resolves, its controller shuffles it into its
  // owner's library instead of putting it into its usual resolution zone.
  if (card.castAsOmen === true) {
    const name = stackNameOf(draft, card);
    if (card.isCopy === true) {
      // CR 707.10a: a copy of a spell can never exist outside the stack, so
      // the 720.3d shuffle has no physical card to move. The resolving Omen
      // copy applies its effects and then ceases to exist (moveCardInternal's
      // copy branch performs the deletion).
      moveCardInternal(draft, topId, 'library', 'top', false, 'resolve');
      pushLog(draft, `${name}(コピー)を解決した(オメン: コピーは消滅する)。`);
      applyCompiledEffectsForStackItem(draft, card, effectLines, libraryShuffleOrder, guidedHandled);
      return;
    }
    moveCardInternal(draft, topId, 'library', 'top', false, 'resolve');
    applyOmenLibraryPlacement(draft, topId, libraryShuffleOrder);
    pushLog(draft, `${name}を解決した(オメン: ライブラリへシャッフル)。`);
    applyCompiledEffectsForStackItem(draft, card, effectLines, libraryShuffleOrder, guidedHandled);
    return;
  }

  const destination = to ?? defaultStackResolveDestination(draft, card);
  moveCardInternal(draft, topId, destination, 'bottom', false, 'resolve');
  pushLog(draft, `${stackNameOf(draft, card)}を解決した(→${ZONE_LABELS[destination]})。`);
  applyCompiledEffectsForStackItem(draft, card, effectLines, libraryShuffleOrder, guidedHandled);
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

function stackItemRulesText(state: GameState, card: CardInstance): string {
  if (card.abilityResolutionText) return card.abilityResolutionText;
  const def = state.defs[card.defId];
  if (!def) return '';
  if (card.isAbility && card.abilityLineIndex !== undefined) {
    return splitAbilityLines(def)[card.abilityLineIndex]?.text ?? '';
  }
  const face = def.faces[card.faceIndex] ?? def.faces[0];
  return face?.oracleText ?? '';
}

function applyCopyStackItemOnce(draft: Draft, cardId: string): void {
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
    source.triggerCondition,
    source.abilityResolutionText,
    source.announcedX,
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
    // CR 720.3c: a copy of a spell cast as an Omen is an Omen with the
    // alternative characteristics.
    castAsOmen: source.castAsOmen,
  };
  draft.state.cards = cards;
  stack.push(copyId);
  pushLog(draft, `${stackNameOf(draft, source)}をコピーした(スタックへ)。`);
}

function applyCopyStackItem(draft: Draft, cardId: string, quantity = 1): void {
  if (!draft.state.zones.stack.includes(cardId)) {
    throw new EngineError(`スタックに存在しないカードです: ${cardId}`);
  }
  const source = requireCard(draft, cardId);
  if (/\b(?:this (?:ability|spell)|it)\s+(?:can['’]t|cannot)\s+be copied\b/i.test(
    stackItemRulesText(draft.state, source),
  )) {
    draft.warnings.push(`${stackNameOf(draft, source)}はコピーできません。`);
    return;
  }
  const count = Math.max(0, Math.floor(quantity));
  for (let index = 0; index < count; index += 1) {
    applyCopyStackItemOnce(draft, cardId);
  }
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

// CR 111.10j–r: predefined Role token definitions.
const ROLE_TOKEN_DEFS: Record<
  string,
  { name: string; oracleText: string }
> = {
  'cursed-role': {
    name: 'Cursed Role',
    oracleText: 'Enchanted creature has base power and toughness 1/1.',
  },
  'monster-role': {
    name: 'Monster Role',
    oracleText: 'Enchanted creature gets +1/+1 and has trample.',
  },
  'royal-role': {
    name: 'Royal Role',
    oracleText: 'Enchanted creature gets +1/+1 and has ward {1}.',
  },
  'sorcerer-role': {
    name: 'Sorcerer Role',
    oracleText:
      "Enchanted creature gets +1/+1 and has 'Whenever this creature attacks, scry 1.'",
  },
  'virtuous-role': {
    name: 'Virtuous Role',
    oracleText: 'Enchanted creature gets +1/+1 for each enchantment you control.',
  },
  'wicked-role': {
    name: 'Wicked Role',
    oracleText:
      'Enchanted creature gets +1/+1\nWhen this token is put into a graveyard from the battlefield, each opponent loses 1 life.',
  },
  'young-hero-role': {
    name: 'Young Hero Role',
    oracleText:
      "Enchanted creature has 'Whenever this creature attacks, if its toughness is 3 or less, put a +1/+1 counter on it.'",
  },
};

const ROLE_TYPE_LINE = 'Enchantment Token — Aura Role';

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
  const roleDef = tokenKind ? ROLE_TOKEN_DEFS[tokenKind] : undefined;
  const effectiveName = roleDef ? roleDef.name : name;
  const effectiveTypeLine = roleDef ? ROLE_TYPE_LINE : typeLine;
  const def: CardDef = {
    scryfallId: defId,
    oracleId: defId,
    name: effectiveName,
    lang: 'en',
    layout: 'token',
    cmc: 0,
    colorIdentity: [],
    typeLine: effectiveTypeLine,
    producedMana,
    tokenKind,
    faces: [
      {
        name: effectiveName,
        typeLine: effectiveTypeLine,
        oracleText: roleDef?.oracleText,
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

function applyCommandInternal(
  state: GameState,
  cmd: GameCommand,
  stabilize: boolean,
): ApplyResult {
  const draft = makeDraft(state);

  switch (cmd.type) {
    case 'destroyPermanents': {
      applyDestroyPermanents(draft, cmd.selector);
      break;
    }
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
    case 'setMaximumHandSizeOverride': {
      applyMaximumHandSizeOverride(draft, cmd.value, cmd.playerId);
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
      applyDiscard(draft, cmd.cardIds, cmd.playerId, cmd.simultaneousGroupId);
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
      applyCast(
        draft,
        cmd.cardId,
        cmd.payment,
        cmd.forced,
        false,
        cmd.faceIndex,
        cmd.playerId,
        cmd.castAsOmen,
        cmd.libraryShuffleOrder,
      );
      break;
    }
    case 'castCommander': {
      applyCast(draft, cmd.cardId, cmd.payment, cmd.forced, true, cmd.faceIndex, cmd.playerId);
      break;
    }
    case 'castToStack': {
      applyCastToStack(
        draft,
        cmd.cardId,
        cmd.payment,
        cmd.forced,
        cmd.faceIndex,
        cmd.xValue,
        cmd.playerId,
        cmd.targetSelections,
        cmd.teamworkTappedIds,
        cmd.castAsOmen,
      );
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
        cmd.triggerCondition,
        cmd.resolutionText,
        cmd.announcedX,
      );
      break;
    }
    case 'resolveStackTop': {
      applyResolveStackTop(draft, cmd.to, cmd.libraryShuffleOrder, cmd.guidedHandled);
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
        cmd.allowedZones,
      );
      break;
    }
    case 'copyStackItem': {
      applyCopyStackItem(draft, cmd.cardId, cmd.quantity);
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
      applyNextPhase(draft, cmd.drawnHandled ?? false, cmd.manualCleanupHandled ?? false);
      break;
    }
    case 'nextTurn': {
      applyNextTurn(draft, cmd.advanceTurnOrder ?? false);
      break;
    }
    case 'completeCleanupStateActions': {
      completeCleanupStateActions(draft);
      break;
    }
    case 'mulligan': {
      applyMulligan(draft, cmd.order, cmd.playerId);
      break;
    }
    case 'ventureIntoDungeon': {
      applyVentureIntoDungeon(draft, cmd.playerId, cmd.dungeonDefId, cmd.roomChoice);
      break;
    }
    case 'chooseBattleProtector': {
      const card = requireCard(draft, cmd.cardId);
      if (!isBattlefieldBattle(draft, card)) {
        throw new EngineError('バトルではないパーマネントの保護者は指定できません。');
      }
      requirePlayer(draft.state, cmd.protectorId);
      setCard(draft, { ...card, protectorId: cmd.protectorId });
      pushLog(draft, `${nameOf(draft, cmd.cardId)}の保護者に${cmd.protectorId}を指定しました。`);
      break;
    }
    case 'setClassLevel': {
      // Cold-audit FINDING-3: reject invalid levels before any state change
      // (invariant I51: classLevelOf >= 1).
      if (!Number.isInteger(cmd.level) || cmd.level < 1) {
        throw new EngineError('クラスレベルは1以上の整数である必要があります。');
      }
      const card = requireCard(draft, cmd.cardId);
      if (card.classLevel === cmd.level) {
        break;
      }
      setCard(draft, { ...card, classLevel: cmd.level });
      pushLog(draft, `${nameOf(draft, cmd.cardId)}のクラスレベルを${cmd.level}にしました。`);
      break;
    }
    case 'setSolved': {
      // CR 719.3b: solved is a designation, not a counter. Idempotent: the
      // same value (undefined treated as false) makes no state change and
      // emits no log. setSolved(false) is a sandbox/setup correction escape
      // hatch; CR 719.3b itself only loses the designation by leaving the
      // battlefield (handled by resetCardForZoneChange).
      const card = requireCard(draft, cmd.cardId);
      if ((card.solved ?? false) === cmd.solved) {
        break;
      }
      setCard(draft, { ...card, solved: cmd.solved });
      pushLog(
        draft,
        cmd.solved
          ? `${nameOf(draft, cmd.cardId)}は解決された。`
          : `${nameOf(draft, cmd.cardId)}の解決状態を取り消した。`,
      );
      break;
    }
  }

  if (stabilize) {
    stabilizeBeforePriority(draft);
  }
  flushCounterChangeEvents(draft);
  return { state: syncDerivedViews(draft.state), warnings: draft.warnings };
}

export function applyCommand(state: GameState, cmd: GameCommand): ApplyResult {
  return applyCommandInternal(state, cmd, true);
}

/** Applies a resolution command list without inserting an SBA/priority boundary between items. */
export function applyResolutionCommands(state: GameState, commands: readonly GameCommand[]): ApplyResult {
  let next = state;
  const warnings: string[] = [];
  for (const [index, command] of commands.entries()) {
    const result = applyCommandInternal(next, command, index === commands.length - 1);
    next = result.state;
    warnings.push(...result.warnings);
  }
  return { state: next, warnings };
}
