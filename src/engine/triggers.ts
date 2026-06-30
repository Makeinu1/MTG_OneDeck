import { classifyCardRules } from '../data/ruleClassifier';
import { splitAbilityLines, type AbilityShape } from './grammar/index';
import {
  objectIdOf,
  type AbilityKind,
  type GameState,
  type ObjectSnapshot,
  type PendingTrigger,
  type ZoneChangeEvent,
} from './types';

const LAND_ENTERS_TRIGGER_PATTERN =
  /\b(?:when|whenever)\b\s+(?:(?:a|one or more)\s+lands?)\b(?:\s+you control)?\s+enters?\b/i;
const BATTLEFIELD_TO_GRAVEYARD_PATTERN =
  /\b(?:is|are)\s+put\s+into\s+(?:a|an|the|your|their|its owner's|an opponent's)?\s*graveyard\s+from\s+the battlefield\b/i;
const LEAVES_BATTLEFIELD_PATTERN = /\bleaves?\s+the battlefield\b/i;

export interface TriggerCandidate {
  sourceId: string;
  triggerId: string;
  label: string;
  pendingTriggerId?: string;
  abilityLineIndex?: number;
}

function cardLabel(state: GameState, cardId: string): string {
  const card = state.cards[cardId];
  if (!card) return '《不明なカード》';
  const def = state.defs[card.defId];
  const face = def?.faces[card.faceIndex] ?? def?.faces[0];
  const name =
    face?.printedName ?? face?.name ?? def?.printedName ?? def?.name ?? '不明なカード';
  return `《${name}》`;
}

function cardHasRuleTag(state: GameState, cardId: string, tagId: string): boolean {
  const card = state.cards[cardId];
  if (!card) return false;
  return defHasRuleTag(state, card.defId, tagId);
}

function defHasRuleTag(state: GameState, defId: string, tagId: string): boolean {
  const def = state.defs[defId];
  if (!def) return false;
  return classifyCardRules(def).some((tag) => tag.id === tagId);
}

function defHasSelfEtbTrigger(state: GameState, defId: string): boolean {
  const def = state.defs[defId];
  if (!def) return false;
  return splitAbilityLines(def).some((line) => {
    if (line.shape !== 'triggered' && line.shape !== 'delayed-triggered') {
      return false;
    }
    const text = line.text;
    if (!/\benters\b/i.test(text)) {
      return false;
    }
    if (LAND_ENTERS_TRIGGER_PATTERN.test(text)) {
      return false;
    }
    if (/\b(?:another|other)\b/i.test(text)) {
      return false;
    }
    if (/\b(?:a|an|one or more|each)\s+[^.]*\benters\b/i.test(text)) {
      return false;
    }
    return true;
  });
}

function abilityShapesForKind(kind: AbilityKind): AbilityShape[] {
  return kind === 'activated' ? ['activated'] : ['triggered', 'delayed-triggered'];
}

export function abilityLineIndexForKind(
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
  return abilityLineIndexForTriggerDef(state, card.defId, triggerId);
}

function abilityLineIndexForTriggerDef(
  state: GameState,
  defId: string,
  triggerId: string,
): number | undefined {
  const def = state.defs[defId];
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
        case 'trigger.death-other':
          return /\bdies\b/i.test(text) || BATTLEFIELD_TO_GRAVEYARD_PATTERN.test(text);
        case 'trigger.leaves':
        case 'trigger.leaves-other':
          return (
            LEAVES_BATTLEFIELD_PATTERN.test(text) ||
            BATTLEFIELD_TO_GRAVEYARD_PATTERN.test(text)
          );
        case 'trigger.landfall':
          return /\blandfall\b/i.test(text) || LAND_ENTERS_TRIGGER_PATTERN.test(text);
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
  const triggeredMatches = splitAbilityLines(def)
    .map((line, index) => ({ line, index }))
    .filter(
      (entry) =>
        entry.line.shape === 'triggered' || entry.line.shape === 'delayed-triggered',
    );
  return triggeredMatches.length === 1 ? triggeredMatches[0].index : undefined;
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

export function detectTriggerCandidates(
  prev: GameState,
  next: GameState,
): TriggerCandidate[] | null {
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
  const leftBattlefield = prev.zones.battlefield.filter(
    (cardId) => !nextBattlefield.has(cardId),
  );
  if (died.length > 0) {
    sawTriggerEvent = true;
    for (const cardId of died) {
      if (cardHasRuleTag(next, cardId, 'trigger.death')) {
        addTriggerCandidate(
          candidates,
          makeTriggerCandidate(next, cardId, 'trigger.death', '死亡したとき'),
        );
      }
    }
    for (const cardId of next.zones.battlefield) {
      if (cardHasRuleTag(next, cardId, 'trigger.death-other')) {
        addTriggerCandidate(
          candidates,
          makeTriggerCandidate(next, cardId, 'trigger.death-other', '他の死亡時'),
        );
      }
      if (cardHasRuleTag(next, cardId, 'trigger.leaves-other')) {
        addTriggerCandidate(
          candidates,
          makeTriggerCandidate(next, cardId, 'trigger.leaves-other', '他が戦場を離れたとき'),
        );
      }
    }
  }

  if (leftBattlefield.length > 0) {
    sawTriggerEvent = true;
    for (const cardId of leftBattlefield) {
      if (cardHasRuleTag(next, cardId, 'trigger.leaves')) {
        addTriggerCandidate(
          candidates,
          makeTriggerCandidate(next, cardId, 'trigger.leaves', '戦場を離れたとき'),
        );
      }
    }
    for (const cardId of next.zones.battlefield) {
      if (cardHasRuleTag(next, cardId, 'trigger.leaves-other')) {
        addTriggerCandidate(
          candidates,
          makeTriggerCandidate(next, cardId, 'trigger.leaves-other', '他が戦場を離れたとき'),
        );
      }
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

export function detectAttackTriggerCandidates(
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

function cardLabelFromSnapshot(state: GameState, snapshot: ObjectSnapshot): string {
  const def = state.defs[snapshot.defId];
  const face = def?.faces[snapshot.faceIndex] ?? def?.faces[0];
  const name =
    face?.printedName ?? face?.name ?? def?.printedName ?? def?.name ?? '不明なカード';
  return `《${name}》`;
}

function snapshotOfCurrentCard(
  state: GameState,
  cardId: string,
): ObjectSnapshot | undefined {
  const card = state.cards[cardId];
  if (!card) return undefined;
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
    isCommander: card.isCommander,
    faceIndex: card.faceIndex,
    tapped: card.tapped,
    counters: { ...card.counters },
    typeLine: (face?.typeLine ?? def?.typeLine ?? '').toString(),
    power: face?.power,
    toughness: face?.toughness,
  };
}

function makePendingTrigger(
  state: GameState,
  sourceSnapshot: ObjectSnapshot,
  triggerId: string,
  label: string,
  eventId: string,
  simultaneousGroupId = eventId,
): PendingTrigger {
  const pending: PendingTrigger = {
    pendingTriggerId: `${eventId}:${triggerId}:${sourceSnapshot.objectId}`,
    eventId,
    simultaneousGroupId,
    triggerId,
    sourceId: sourceSnapshot.physicalCardId,
    sourceObjectId: sourceSnapshot.objectId,
    sourceSnapshot,
    controllerId: sourceSnapshot.controllerId ?? sourceSnapshot.ownerId,
    label: `${label}: ${cardLabelFromSnapshot(state, sourceSnapshot)}`,
    stackPlacementBucket: 'ordinary',
  };
  const abilityLineIndex = abilityLineIndexForTriggerDef(
    state,
    sourceSnapshot.defId,
    triggerId,
  );
  if (abilityLineIndex !== undefined) {
    pending.abilityLineIndex = abilityLineIndex;
  }
  return pending;
}

function addPendingTrigger(
  pending: PendingTrigger[],
  trigger: PendingTrigger,
): void {
  if (pending.some((existing) => existing.pendingTriggerId === trigger.pendingTriggerId)) {
    return;
  }
  pending.push(trigger);
}

function addCurrentPermanentPendingTrigger(
  state: GameState,
  pending: PendingTrigger[],
  sourceId: string,
  triggerId: string,
  label: string,
  eventId: string,
  simultaneousGroupId = eventId,
): void {
  const snapshot = snapshotOfCurrentCard(state, sourceId);
  if (!snapshot) return;
  addPendingTrigger(
    pending,
    makePendingTrigger(state, snapshot, triggerId, label, eventId, simultaneousGroupId)
  );
}

function newZoneChangeEvents(prev: GameState, next: GameState): ZoneChangeEvent[] {
  const prevLog = Array.isArray(prev.eventLog) ? prev.eventLog : [];
  const nextLog = Array.isArray(next.eventLog) ? next.eventLog : [];
  const maxPrevSequence = prevLog.reduce((max, event) => Math.max(max, event.sequence), -1);
  return nextLog.filter(
    (event): event is ZoneChangeEvent =>
      event.type === 'zoneChange' && event.sequence > maxPrevSequence,
  );
}

function collectZoneChangePendingTriggers(
  prev: GameState,
  next: GameState,
  pending: PendingTrigger[],
): void {
  const isLandfallEvent = next.landsPlayedThisTurn > prev.landsPlayedThisTurn;

  for (const event of newZoneChangeEvents(prev, next)) {
    const eventId = event.eventId;
    const simultaneousGroupId = event.simultaneousGroupId ?? eventId;

    if (event.toZone === 'battlefield' && event.after) {
      if (defHasSelfEtbTrigger(next, event.after.defId)) {
        addPendingTrigger(
          pending,
          makePendingTrigger(
            next,
            event.after,
            'trigger.etb',
            '戦場に出たとき',
            eventId,
            simultaneousGroupId,
          ),
        );
      }

      for (const cardId of next.zones.battlefield) {
        if (cardId === event.physicalCardId) continue;
        if (isLandfallEvent && cardHasRuleTag(next, cardId, 'trigger.landfall')) continue;
        if (!cardHasRuleTag(next, cardId, 'trigger.etb-other')) continue;
        addCurrentPermanentPendingTrigger(
          next,
          pending,
          cardId,
          'trigger.etb-other',
          '他が戦場に出たとき',
          eventId,
          simultaneousGroupId,
        );
      }

      if (isLandfallEvent && /\bLand\b/i.test(event.after.typeLine)) {
        for (const cardId of next.zones.battlefield) {
          if (!cardHasRuleTag(next, cardId, 'trigger.landfall')) continue;
          addCurrentPermanentPendingTrigger(
            next,
            pending,
            cardId,
            'trigger.landfall',
            '上陸',
            eventId,
            simultaneousGroupId,
          );
        }
      }
    }

    const died = event.fromZone === 'battlefield' && event.toZone === 'graveyard';
    const leftBattlefield =
      event.fromZone === 'battlefield' && event.toZone !== undefined && event.toZone !== 'battlefield';

    if (died) {
      if (defHasRuleTag(next, event.before.defId, 'trigger.death')) {
        addPendingTrigger(
          pending,
          makePendingTrigger(
            next,
            event.before,
            'trigger.death',
            '死亡したとき',
            eventId,
            simultaneousGroupId,
          ),
        );
      }
      for (const cardId of next.zones.battlefield) {
        if (cardHasRuleTag(next, cardId, 'trigger.death-other')) {
          addCurrentPermanentPendingTrigger(
            next,
            pending,
            cardId,
            'trigger.death-other',
            '他の死亡時',
            eventId,
            simultaneousGroupId,
          );
        }
        if (cardHasRuleTag(next, cardId, 'trigger.leaves-other')) {
          addCurrentPermanentPendingTrigger(
            next,
            pending,
            cardId,
            'trigger.leaves-other',
            '他が戦場を離れたとき',
            eventId,
            simultaneousGroupId,
          );
        }
      }
    }

    if (leftBattlefield) {
      if (defHasRuleTag(next, event.before.defId, 'trigger.leaves')) {
        addPendingTrigger(
          pending,
          makePendingTrigger(
            next,
            event.before,
            'trigger.leaves',
            '戦場を離れたとき',
            eventId,
            simultaneousGroupId,
          ),
        );
      }
      for (const cardId of next.zones.battlefield) {
        if (!cardHasRuleTag(next, cardId, 'trigger.leaves-other')) continue;
        addCurrentPermanentPendingTrigger(
          next,
          pending,
          cardId,
          'trigger.leaves-other',
          '他が戦場を離れたとき',
          eventId,
          simultaneousGroupId,
        );
      }
    }

    if (
      event.reason === 'cast' &&
      event.toZone === 'stack' &&
      event.after &&
      !next.cards[event.physicalCardId]?.isAbility
    ) {
      if (defHasRuleTag(next, event.after.defId, 'trigger.cast')) {
        addPendingTrigger(
          pending,
          makePendingTrigger(
            next,
            event.after,
            'trigger.cast',
            '唱えたとき',
            eventId,
            simultaneousGroupId,
          ),
        );
      }
      for (const cardId of next.zones.battlefield) {
        if (!cardHasRuleTag(next, cardId, 'trigger.cast-watcher')) continue;
        addCurrentPermanentPendingTrigger(
          next,
          pending,
          cardId,
          'trigger.cast-watcher',
          '呪文を唱えるたび',
          eventId,
          simultaneousGroupId,
        );
      }
    }
  }
}

function collectImplicitPendingTriggers(
  prev: GameState,
  next: GameState,
  pending: PendingTrigger[],
): void {
  if (prev.phase !== 'upkeep' && next.phase === 'upkeep') {
    const eventId = `implicit:upkeep:${next.turn}:${next.log.length}`;
    for (const cardId of next.zones.battlefield) {
      if (!cardHasRuleTag(next, cardId, 'trigger.upkeep')) continue;
      addCurrentPermanentPendingTrigger(
        next,
        pending,
        cardId,
        'trigger.upkeep',
        'アップキープ開始時',
        eventId,
      );
    }
  }

  if (prev.phase !== 'end' && next.phase === 'end') {
    const eventId = `implicit:end:${next.turn}:${next.log.length}`;
    for (const cardId of next.zones.battlefield) {
      if (!cardHasRuleTag(next, cardId, 'trigger.end-step')) continue;
      addCurrentPermanentPendingTrigger(
        next,
        pending,
        cardId,
        'trigger.end-step',
        'エンドステップ開始時',
        eventId,
      );
    }
  }

  if (next.drawnThisTurn > prev.drawnThisTurn) {
    const eventId = `implicit:draw:${next.turn}:${next.drawnThisTurn}:${next.log.length}`;
    for (const cardId of next.zones.battlefield) {
      if (!cardHasRuleTag(next, cardId, 'trigger.draw')) continue;
      addCurrentPermanentPendingTrigger(
        next,
        pending,
        cardId,
        'trigger.draw',
        'カードを引いたとき',
        eventId,
      );
    }
  }
}

export function collectPendingTriggers(
  prev: GameState,
  next: GameState,
): PendingTrigger[] {
  const pending: PendingTrigger[] = [];
  collectZoneChangePendingTriggers(prev, next, pending);
  collectImplicitPendingTriggers(prev, next, pending);
  return pending;
}

export function collectAttackPendingTriggers(
  state: GameState,
  attackerIds: string[],
): PendingTrigger[] {
  const pending: PendingTrigger[] = [];
  const eventId = `implicit:attack:${state.turn}:${state.phase}:${state.log.length}:${attackerIds.join(',')}`;

  for (const cardId of attackerIds) {
    if (!cardHasRuleTag(state, cardId, 'trigger.attack')) continue;
    addCurrentPermanentPendingTrigger(
      state,
      pending,
      cardId,
      'trigger.attack',
      '攻撃したとき',
      eventId,
    );
  }

  for (const cardId of state.zones.battlefield) {
    if (!cardHasRuleTag(state, cardId, 'trigger.attack-watcher')) continue;
    addCurrentPermanentPendingTrigger(
      state,
      pending,
      cardId,
      'trigger.attack-watcher',
      'クリーチャー攻撃時',
      eventId,
    );
  }

  return pending;
}

export function triggerCandidatesFromPendingTriggers(
  pendingTriggers: readonly PendingTrigger[],
): TriggerCandidate[] {
  return pendingTriggers.map((pending) => {
    const candidate: TriggerCandidate = {
      sourceId: pending.sourceId,
      triggerId: pending.triggerId,
      label: pending.label,
    };
    Object.defineProperty(candidate, 'pendingTriggerId', {
      value: pending.pendingTriggerId,
      enumerable: false,
      configurable: true,
    });
    if (pending.abilityLineIndex !== undefined) {
      Object.defineProperty(candidate, 'abilityLineIndex', {
        value: pending.abilityLineIndex,
        enumerable: false,
        configurable: true,
      });
    }
    return candidate;
  });
}
