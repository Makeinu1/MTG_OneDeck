import { classifyCardRules } from '../data/ruleClassifier';
import { splitAbilityLines, type AbilityShape } from './grammar/index';
import { effectivePower } from './status';
import {
  objectIdOf,
  type AbilityKind,
  type DamageEvent,
  type DrawEvent,
  type GameEvent,
  type GameState,
  type LifeChangeEvent,
  type ObjectSnapshot,
  type PendingTrigger,
  type PlayerId,
  type ZoneChangeEvent,
} from './types';

const LAND_ENTERS_TRIGGER_PATTERN =
  /\b(?:when|whenever)\b\s+(?:(?:a|one or more)\s+lands?)\b(?:\s+you control)?\s+enters?\b/i;
const BATTLEFIELD_TO_GRAVEYARD_PATTERN =
  /\b(?:is|are)\s+put\s+into\s+(?:a|an|the|your|their|its owner's|an opponent's)?\s*graveyard\s+from\s+the battlefield\b/i;
const LEAVES_BATTLEFIELD_PATTERN = /\bleaves?\s+the battlefield\b/i;
const ONCE_PER_TURN_TRIGGER_PATTERN =
  /\b(?:this ability\s+)?triggers?\s+only\s+once\s+(?:each|per)\s+turn\b/i;
const LIFE_TRIGGER_PATTERN = /\b(?:gain|gains|gained|lose|loses|lost)\b[^.;]*\blife\b/i;
const DAMAGE_TRIGGER_PATTERN = /\bdeals?\b[^.;]*\bdamage\b/i;
const LEAVES_GRAVEYARD_PATTERN = /\bleaves?\s+(?:your|a|an|the)?\s*graveyard\b/i;
const GRAVEYARD_FROM_NONBATTLEFIELD_PATTERN =
  /\b(?:is|are)\s+put\s+into\s+(?:a|an|the|your|their|its owner's|an opponent's)?\s*graveyard\s+from\s+anywhere\s+other\s+than\s+the battlefield\b/i;

export interface TriggerCandidate {
  sourceId: string;
  triggerId: string;
  label: string;
  pendingTriggerId?: string;
  abilityLineIndex?: number;
}

interface TriggerCollectionContext {
  pending: PendingTrigger[];
  oncePerTurnConsumedKeys: Set<string>;
}

interface TriggerAbilityEntry {
  abilityLineIndex: number;
  text: string;
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

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function selfNamesForDef(state: GameState, defId: string): string[] {
  const def = state.defs[defId];
  if (!def) return [];
  const names = new Set<string>();
  for (const name of [def.name, ...def.faces.map((face) => face.name)]) {
    for (const faceName of name.split(' // ')) {
      const trimmed = faceName.trim();
      if (trimmed === '') continue;
      names.add(trimmed);
      const shortName = trimmed.split(',')[0]?.trim();
      if (shortName) {
        names.add(shortName);
      }
    }
  }
  return [...names];
}

function textReferencesSelf(state: GameState, defId: string, text: string): boolean {
  if (/\b(?:this|it|itself)\b/i.test(text)) {
    return true;
  }
  return selfNamesForDef(state, defId).some((name) =>
    new RegExp(`\\b${escapeRegExp(name)}\\b`, 'i').test(text),
  );
}

function triggeredAbilityEntries(state: GameState, defId: string): TriggerAbilityEntry[] {
  const def = state.defs[defId];
  if (!def) return [];
  return splitAbilityLines(def)
    .map((line, index) => ({ line, index }))
    // Intentionally excludes 'delayed-triggered' lines: delayed-trigger scheduling
    // (batch3-1b) has no future turn/phase primitive yet, so this leaf must not
    // pull those lines into the ordinary event-subscription path.
    .filter((entry) => entry.line.shape === 'triggered')
    .map((entry) => ({ abilityLineIndex: entry.index, text: entry.line.text }));
}

function abilityLineText(
  state: GameState,
  defId: string,
  abilityLineIndex: number | undefined,
): string | undefined {
  if (abilityLineIndex === undefined) return undefined;
  const def = state.defs[defId];
  if (!def) return undefined;
  return splitAbilityLines(def)[abilityLineIndex]?.text;
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
        case 'trigger.life':
        case 'trigger.life-gain':
        case 'trigger.life-loss':
          return LIFE_TRIGGER_PATTERN.test(text);
        case 'trigger.damage':
          return DAMAGE_TRIGGER_PATTERN.test(text);
        case 'trigger.cast':
        case 'trigger.cast-watcher':
          return /\bcast\b/i.test(text);
        case 'trigger.leaves-graveyard':
          return (
            LEAVES_GRAVEYARD_PATTERN.test(text) ||
            GRAVEYARD_FROM_NONBATTLEFIELD_PATTERN.test(text)
          );
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
  abilityLineIndexOverride?: number,
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
  const abilityLineIndex =
    abilityLineIndexOverride ??
    abilityLineIndexForTriggerDef(state, sourceSnapshot.defId, triggerId);
  if (abilityLineIndex !== undefined) {
    pending.abilityLineIndex = abilityLineIndex;
  }
  return pending;
}

function oncePerTurnConsumedKeysForState(state: GameState): Set<string> {
  const ledger = (state as Partial<GameState>).oncePerTurnTriggerLedger;
  if (!ledger || ledger.turn !== state.turn || !Array.isArray(ledger.consumedKeys)) {
    return new Set();
  }
  return new Set(ledger.consumedKeys);
}

// Keyed by `sourceObjectId` (CR 400.7 object identity), not a physical-card/permanent
// concept. This is intentional: a genuine blink (leave + re-enter within the same turn)
// produces a new object with no memory of the old object's consumption, so the "new"
// incarnation can trigger again immediately even though a player might describe it as
// "the same permanent." Do not key on `physicalCardId` instead to "fix" this — that would
// be the actual CR violation (CR 400.7).
function oncePerTurnTriggerKey(
  state: GameState,
  trigger: PendingTrigger,
): string | null {
  const lineText = abilityLineText(
    state,
    trigger.sourceSnapshot.defId,
    trigger.abilityLineIndex,
  );
  if (!lineText || !ONCE_PER_TURN_TRIGGER_PATTERN.test(lineText)) {
    return null;
  }
  const abilityKey =
    trigger.abilityLineIndex === undefined
      ? trigger.triggerId
      : `line-${trigger.abilityLineIndex}`;
  return [
    state.turn,
    trigger.sourceObjectId,
    abilityKey,
    trigger.controllerId,
  ].join('|');
}

function stateWithOncePerTurnLedger(
  state: GameState,
  context: TriggerCollectionContext,
): GameState {
  const consumedKeys = [...context.oncePerTurnConsumedKeys];
  const ledger = (state as Partial<GameState>).oncePerTurnTriggerLedger;
  const alreadyNormalized =
    ledger?.turn === state.turn &&
    Array.isArray(ledger.consumedKeys) &&
    ledger.consumedKeys.length === consumedKeys.length &&
    ledger.consumedKeys.every((key, index) => key === consumedKeys[index]);
  if (alreadyNormalized) {
    return state;
  }
  return {
    ...state,
    oncePerTurnTriggerLedger: {
      turn: state.turn,
      consumedKeys,
    },
  };
}

function addPendingTrigger(
  context: TriggerCollectionContext,
  state: GameState,
  trigger: PendingTrigger,
): void {
  if (
    context.pending.some((existing) => existing.pendingTriggerId === trigger.pendingTriggerId)
  ) {
    return;
  }

  const oncePerTurnKey = oncePerTurnTriggerKey(state, trigger);
  if (
    oncePerTurnKey !== null &&
    context.oncePerTurnConsumedKeys.has(oncePerTurnKey)
  ) {
    return;
  }

  context.pending.push(trigger);
  if (oncePerTurnKey !== null) {
    context.oncePerTurnConsumedKeys.add(oncePerTurnKey);
  }
}

function addCurrentPermanentPendingTrigger(
  state: GameState,
  context: TriggerCollectionContext,
  sourceId: string,
  triggerId: string,
  label: string,
  eventId: string,
  simultaneousGroupId = eventId,
  abilityLineIndex?: number,
): void {
  const snapshot = snapshotOfCurrentCard(state, sourceId);
  if (!snapshot) return;
  addPendingTrigger(
    context,
    state,
    makePendingTrigger(
      state,
      snapshot,
      triggerId,
      label,
      eventId,
      simultaneousGroupId,
      abilityLineIndex,
    ),
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

function newEventsOfType<T extends GameEvent['type']>(
  prev: GameState,
  next: GameState,
  type: T,
): Extract<GameEvent, { type: T }>[] {
  const prevLog = Array.isArray(prev.eventLog) ? prev.eventLog : [];
  const nextLog = Array.isArray(next.eventLog) ? next.eventLog : [];
  const maxPrevSequence = prevLog.reduce((max, event) => Math.max(max, event.sequence), -1);
  return nextLog.filter(
    (event): event is Extract<GameEvent, { type: T }> =>
      event.type === type && event.sequence > maxPrevSequence,
  );
}

function controllerOf(snapshot: ObjectSnapshot): PlayerId {
  return snapshot.controllerId ?? snapshot.ownerId;
}

function triggerConditionText(lineText: string): string {
  const match = /\b(?:when|whenever)\b\s+([^,.;]+)/i.exec(lineText);
  return normalizeWhitespace(match?.[1] ?? lineText);
}

function typeLineHas(snapshot: Pick<ObjectSnapshot, 'typeLine'> | undefined, word: string): boolean {
  return new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i').test(snapshot?.typeLine ?? '');
}

function enteredPower(state: GameState, entered: ObjectSnapshot): number {
  const card = state.cards[entered.physicalCardId];
  if (card?.zone === 'battlefield') {
    return effectivePower(state, card.id);
  }
  const parsed = Number.parseInt(entered.power ?? '', 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function etbOtherLineMatchesEvent(
  state: GameState,
  sourceSnapshot: ObjectSnapshot,
  lineText: string,
  entered: ObjectSnapshot,
): boolean {
  const condition = triggerConditionText(lineText);
  if (!/\benters?\b/i.test(condition)) {
    return false;
  }
  const entersIndex = condition.search(/\benters?\b/i);
  const subject = entersIndex < 0 ? condition : condition.slice(0, entersIndex);
  if (
    textReferencesSelf(state, sourceSnapshot.defId, subject) &&
    !/\b(?:another|other)\b/i.test(subject)
  ) {
    return false;
  }
  if (sourceSnapshot.physicalCardId === entered.physicalCardId) {
    return false;
  }
  if (/\bcreatures?\b/i.test(condition) && !typeLineHas(entered, 'Creature')) {
    return false;
  }
  if (/\blands?\b/i.test(condition) && !typeLineHas(entered, 'Land')) {
    return false;
  }
  if (/\bartifacts?\b/i.test(condition) && !typeLineHas(entered, 'Artifact')) {
    return false;
  }
  if (/\benchantments?\b/i.test(condition) && !typeLineHas(entered, 'Enchantment')) {
    return false;
  }
  const sourceController = controllerOf(sourceSnapshot);
  const enteredController = controllerOf(entered);
  if (/\b(?:you control|under your control)\b/i.test(condition) && enteredController !== sourceController) {
    return false;
  }
  if (/\b(?:an opponent controls|opponents? control|under an opponent's control)\b/i.test(condition) && enteredController === sourceController) {
    return false;
  }
  const maxPower = /power\s+(\d+)\s+or\s+less\b/i.exec(condition);
  if (maxPower?.[1] && enteredPower(state, entered) > Number.parseInt(maxPower[1], 10)) {
    return false;
  }
  if (/\bnontoken\b/i.test(condition) && entered.isToken) {
    return false;
  }
  return true;
}

function matchingEtbOtherAbilityLineIndex(
  state: GameState,
  sourceId: string,
  entered: ObjectSnapshot,
): number | undefined {
  const sourceSnapshot = snapshotOfCurrentCard(state, sourceId);
  if (!sourceSnapshot) return undefined;
  return triggeredAbilityEntries(state, sourceSnapshot.defId).find((entry) =>
    etbOtherLineMatchesEvent(state, sourceSnapshot, entry.text, entered),
  )?.abilityLineIndex;
}

function drawLineMatchesEvent(
  sourceController: PlayerId,
  lineText: string,
  event: DrawEvent,
): boolean {
  const condition = triggerConditionText(lineText);
  if (!/\bdraws?\b[^.;]*\bcards?\b/i.test(condition)) {
    return false;
  }
  if (event.result !== 'drawn') {
    return /\bempty library\b|\b(?:can't|cannot)\s+draw\b/i.test(condition);
  }
  if (/\bopponents?\b|\ban opponent\b/i.test(condition)) {
    return event.playerId !== sourceController;
  }
  if (/\byou\b/i.test(condition)) {
    return event.playerId === sourceController;
  }
  return true;
}

function lifeLineMatchesEvent(
  sourceController: PlayerId,
  lineText: string,
  event: LifeChangeEvent,
): boolean {
  const condition = triggerConditionText(lineText);
  if (!LIFE_TRIGGER_PATTERN.test(condition)) {
    return false;
  }
  const wantsGain = /\bgain(?:s|ed)?\b/i.test(condition);
  const wantsLoss = /\b(?:lose|loses|lost)\b/i.test(condition);
  if (event.direction === 'gain' && !wantsGain) {
    return false;
  }
  if (event.direction === 'loss' && !wantsLoss) {
    return false;
  }
  if (/\bopponents?\b|\ban opponent\b/i.test(condition)) {
    return event.playerId !== sourceController;
  }
  if (/\byou\b/i.test(condition)) {
    return event.playerId === sourceController;
  }
  const minimum = /(\d+)\s+or\s+more\s+life\b/i.exec(condition);
  if (minimum?.[1] && Math.abs(event.delta) < Number.parseInt(minimum[1], 10)) {
    return false;
  }
  return true;
}

function damageSourceMatchesCondition(
  state: GameState,
  sourceSnapshot: ObjectSnapshot,
  condition: string,
  event: DamageEvent,
): boolean {
  const dealsIndex = condition.search(/\bdeals?\b/i);
  const subject = dealsIndex < 0 ? condition : condition.slice(0, dealsIndex);
  if (textReferencesSelf(state, sourceSnapshot.defId, subject)) {
    return event.source.kind === 'object' && event.source.objectId === sourceSnapshot.objectId;
  }
  if (event.source.kind !== 'object') {
    return false;
  }
  const eventSourceSnapshot = event.source.snapshot;
  if (/\bcreatures?\b/i.test(subject) && !typeLineHas(eventSourceSnapshot, 'Creature')) {
    return false;
  }
  if (/\b(?:you control|source you control|creature you control)\b/i.test(subject)) {
    return eventSourceSnapshot?.controllerId === controllerOf(sourceSnapshot);
  }
  if (/\b(?:opponent controls|opponent's)\b/i.test(subject)) {
    return eventSourceSnapshot?.controllerId !== controllerOf(sourceSnapshot);
  }
  return true;
}

function damageTargetMatchesCondition(
  sourceController: PlayerId,
  condition: string,
  event: DamageEvent,
): boolean {
  if (/\bto you\b/i.test(condition)) {
    return event.target.kind === 'player' && event.target.playerId === sourceController;
  }
  if (/\bto (?:an |each )?opponents?\b/i.test(condition)) {
    return event.target.kind === 'player' && event.target.playerId !== sourceController;
  }
  if (/\bto (?:a |target )?players?\b/i.test(condition)) {
    return event.target.kind === 'player';
  }
  if (/\bto (?:a |another |target )?creatures?\b/i.test(condition)) {
    return event.target.kind === 'object' && typeLineHas(event.target.snapshot, 'Creature');
  }
  return true;
}

function damageLineMatchesEvent(
  state: GameState,
  sourceSnapshot: ObjectSnapshot,
  lineText: string,
  event: DamageEvent,
): boolean {
  const condition = triggerConditionText(lineText);
  if (!DAMAGE_TRIGGER_PATTERN.test(condition)) {
    return false;
  }
  if (/\bcombat damage\b/i.test(condition) && !event.combatDamage) {
    return false;
  }
  return (
    damageSourceMatchesCondition(state, sourceSnapshot, condition, event) &&
    damageTargetMatchesCondition(controllerOf(sourceSnapshot), condition, event)
  );
}

function leavesGraveyardLineMatchesEvent(
  sourceSnapshot: ObjectSnapshot,
  lineText: string,
  event: ZoneChangeEvent,
): boolean {
  const condition = triggerConditionText(lineText);
  const leavesYourGraveyard =
    event.fromZone === 'graveyard' &&
    event.toZone !== undefined &&
    event.toZone !== 'graveyard' &&
    LEAVES_GRAVEYARD_PATTERN.test(condition);
  const graveyardFromElsewhere =
    event.toZone === 'graveyard' &&
    event.fromZone !== 'battlefield' &&
    GRAVEYARD_FROM_NONBATTLEFIELD_PATTERN.test(condition);
  if (!leavesYourGraveyard && !graveyardFromElsewhere) {
    return false;
  }
  if (/\byour graveyard\b/i.test(condition) && event.before.ownerId !== controllerOf(sourceSnapshot)) {
    return false;
  }
  if (/\bcreature cards?\b/i.test(condition) && !typeLineHas(event.before, 'Creature')) {
    return false;
  }
  if (/\bcards?\b/i.test(condition) && event.before.isToken) {
    return false;
  }
  return true;
}

function matchingLeavesGraveyardAbilityLineIndex(
  state: GameState,
  sourceId: string,
  event: ZoneChangeEvent,
): number | undefined {
  const sourceSnapshot = snapshotOfCurrentCard(state, sourceId);
  if (!sourceSnapshot) return undefined;
  return triggeredAbilityEntries(state, sourceSnapshot.defId).find((entry) =>
    leavesGraveyardLineMatchesEvent(sourceSnapshot, entry.text, event),
  )?.abilityLineIndex;
}

function collectZoneChangePendingTriggers(
  prev: GameState,
  next: GameState,
  context: TriggerCollectionContext,
): void {
  const isLandfallEvent = next.landsPlayedThisTurn > prev.landsPlayedThisTurn;

  for (const event of newZoneChangeEvents(prev, next)) {
    const eventId = event.eventId;
    const simultaneousGroupId = event.simultaneousGroupId ?? eventId;

    if (event.toZone === 'battlefield' && event.after) {
      if (defHasSelfEtbTrigger(next, event.after.defId)) {
        addPendingTrigger(
          context,
          next,
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
        const abilityLineIndex = matchingEtbOtherAbilityLineIndex(next, cardId, event.after);
        if (abilityLineIndex === undefined) continue;
        addCurrentPermanentPendingTrigger(
          next,
          context,
          cardId,
          'trigger.etb-other',
          '他が戦場に出たとき',
          eventId,
          simultaneousGroupId,
          abilityLineIndex,
        );
      }

      if (isLandfallEvent && /\bLand\b/i.test(event.after.typeLine)) {
        for (const cardId of next.zones.battlefield) {
          if (!cardHasRuleTag(next, cardId, 'trigger.landfall')) continue;
          addCurrentPermanentPendingTrigger(
            next,
            context,
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
          context,
          next,
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
            context,
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
            context,
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
          context,
          next,
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
          context,
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
          context,
          next,
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
          context,
          cardId,
          'trigger.cast-watcher',
          '呪文を唱えるたび',
          eventId,
          simultaneousGroupId,
        );
      }
    }

    for (const cardId of next.zones.battlefield) {
      const abilityLineIndex = matchingLeavesGraveyardAbilityLineIndex(next, cardId, event);
      if (abilityLineIndex === undefined) continue;
      addCurrentPermanentPendingTrigger(
        next,
        context,
        cardId,
        'trigger.leaves-graveyard',
        '墓地を離れたとき',
        eventId,
        simultaneousGroupId,
        abilityLineIndex,
      );
    }
  }
}

function collectDrawPendingTriggers(
  prev: GameState,
  next: GameState,
  context: TriggerCollectionContext,
): void {
  for (const event of newEventsOfType(prev, next, 'draw')) {
    const eventId = event.eventId;
    const simultaneousGroupId = event.simultaneousGroupId ?? eventId;
    for (const cardId of next.zones.battlefield) {
      const sourceSnapshot = snapshotOfCurrentCard(next, cardId);
      if (!sourceSnapshot) continue;
      const abilityLineIndex = triggeredAbilityEntries(next, sourceSnapshot.defId).find((entry) =>
        drawLineMatchesEvent(controllerOf(sourceSnapshot), entry.text, event),
      )?.abilityLineIndex;
      if (abilityLineIndex === undefined) continue;
      addCurrentPermanentPendingTrigger(
        next,
        context,
        cardId,
        'trigger.draw',
        'カードを引いたとき',
        eventId,
        simultaneousGroupId,
        abilityLineIndex,
      );
    }
  }
}

function collectLifeChangePendingTriggers(
  prev: GameState,
  next: GameState,
  context: TriggerCollectionContext,
): void {
  for (const event of newEventsOfType(prev, next, 'lifeChange')) {
    const eventId = event.eventId;
    const simultaneousGroupId = event.simultaneousGroupId ?? eventId;
    for (const cardId of next.zones.battlefield) {
      const sourceSnapshot = snapshotOfCurrentCard(next, cardId);
      if (!sourceSnapshot) continue;
      const abilityLineIndex = triggeredAbilityEntries(next, sourceSnapshot.defId).find((entry) =>
        lifeLineMatchesEvent(controllerOf(sourceSnapshot), entry.text, event),
      )?.abilityLineIndex;
      if (abilityLineIndex === undefined) continue;
      const triggerId = event.direction === 'gain' ? 'trigger.life-gain' : 'trigger.life-loss';
      const label = event.direction === 'gain' ? 'ライフを得たとき' : 'ライフを失ったとき';
      addCurrentPermanentPendingTrigger(
        next,
        context,
        cardId,
        triggerId,
        label,
        eventId,
        simultaneousGroupId,
        abilityLineIndex,
      );
    }
  }
}

function collectDamagePendingTriggers(
  prev: GameState,
  next: GameState,
  context: TriggerCollectionContext,
): void {
  for (const event of newEventsOfType(prev, next, 'damage')) {
    const eventId = event.eventId;
    const simultaneousGroupId = event.simultaneousGroupId ?? eventId;
    for (const cardId of next.zones.battlefield) {
      const sourceSnapshot = snapshotOfCurrentCard(next, cardId);
      if (!sourceSnapshot) continue;
      const abilityLineIndex = triggeredAbilityEntries(next, sourceSnapshot.defId).find((entry) =>
        damageLineMatchesEvent(next, sourceSnapshot, entry.text, event),
      )?.abilityLineIndex;
      if (abilityLineIndex === undefined) continue;
      addCurrentPermanentPendingTrigger(
        next,
        context,
        cardId,
        'trigger.damage',
        'ダメージを与えたとき',
        eventId,
        simultaneousGroupId,
        abilityLineIndex,
      );
    }
  }
}

function collectImplicitPendingTriggers(
  prev: GameState,
  next: GameState,
  context: TriggerCollectionContext,
): void {
  if (prev.phase !== 'upkeep' && next.phase === 'upkeep') {
    const eventId = `implicit:upkeep:${next.turn}:${next.log.length}`;
    for (const cardId of next.zones.battlefield) {
      if (!cardHasRuleTag(next, cardId, 'trigger.upkeep')) continue;
      addCurrentPermanentPendingTrigger(
        next,
        context,
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
        context,
        cardId,
        'trigger.end-step',
        'エンドステップ開始時',
        eventId,
      );
    }
  }

  if (
    next.drawnThisTurn > prev.drawnThisTurn &&
    newEventsOfType(prev, next, 'draw').length === 0
  ) {
    const eventId = `implicit:draw:${next.turn}:${next.drawnThisTurn}:${next.log.length}`;
    for (const cardId of next.zones.battlefield) {
      if (!cardHasRuleTag(next, cardId, 'trigger.draw')) continue;
      addCurrentPermanentPendingTrigger(
        next,
        context,
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
  return collectPendingTriggerUpdate(prev, next).pendingTriggers;
}

export function collectPendingTriggerUpdate(
  prev: GameState,
  next: GameState,
): { state: GameState; pendingTriggers: PendingTrigger[] } {
  const context: TriggerCollectionContext = {
    pending: [],
    oncePerTurnConsumedKeys: oncePerTurnConsumedKeysForState(next),
  };
  collectZoneChangePendingTriggers(prev, next, context);
  collectDrawPendingTriggers(prev, next, context);
  collectLifeChangePendingTriggers(prev, next, context);
  collectDamagePendingTriggers(prev, next, context);
  collectImplicitPendingTriggers(prev, next, context);
  return {
    state: stateWithOncePerTurnLedger(next, context),
    pendingTriggers: context.pending,
  };
}

export function collectAttackPendingTriggers(
  state: GameState,
  attackerIds: string[],
): PendingTrigger[] {
  const context: TriggerCollectionContext = {
    pending: [],
    oncePerTurnConsumedKeys: oncePerTurnConsumedKeysForState(state),
  };
  const eventId = `implicit:attack:${state.turn}:${state.phase}:${state.log.length}:${attackerIds.join(',')}`;

  for (const cardId of attackerIds) {
    if (!cardHasRuleTag(state, cardId, 'trigger.attack')) continue;
    addCurrentPermanentPendingTrigger(
      state,
      context,
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
      context,
      cardId,
      'trigger.attack-watcher',
      'クリーチャー攻撃時',
      eventId,
    );
  }

  return context.pending;
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
