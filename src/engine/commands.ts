import type { CardDef, ManaColor } from '../types/card';
import { planAutoTap } from './autotap';
import { isCommander } from './commander';
import {
  compileAbilityCost,
  compileAbilityIR,
  type CostDecision,
  type EffectPrompt,
  type TargetFilter,
} from './grammar/compile';
import { splitAbilityLines, type AbilityLine } from './grammar/index';
import { parseAbilityIR } from './grammar/ir';
import { parseManaCost } from './mana';
import { normalizeKeywords } from './status';
import type {
  AbilityKind,
  CardInstance,
  GameState,
  LegendRuleChoice,
  LogEntry,
  ManaPool,
  ObjectSnapshot,
  Phase,
  ZoneChangeEvent,
  ZoneChangeReason,
  ZoneId,
} from './types';
import { objectIdOf, PHASE_ORDER } from './types';

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
    }
  | { type: 'setTapped'; cardId: string; tapped: boolean }
  | { type: 'setFace'; cardId: string; faceIndex: number }
  | { type: 'setFaceDown'; cardId: string; faceDown: boolean }
  | { type: 'setManualKeywords'; cardId: string; keywords: string[] }
  | { type: 'setEffectsAuto'; value: boolean }
  | { type: 'setCardEffectsAuto'; cardId: string; value: boolean }
  | { type: 'addCounters'; cardId: string; counterType: string; delta: number }
  | { type: 'markDamage'; cardId: string; amount: number; deathtouch?: boolean }
  | { type: 'clearMarkedDamage'; cardId?: string }
  | { type: 'attach'; cardId: string; to: string | undefined }
  | { type: 'adjustLife'; delta: number }
  | { type: 'adjustPlayerCounter'; kind: 'poison' | 'energy' | 'experience'; delta: number }
  | { type: 'adjustCommanderDamage'; label: string; delta: number }
  | { type: 'adjustOpponentLife'; label: string; delta: number }
  | { type: 'addMana'; color: ManaColor; amount: number }
  | { type: 'adjustMana'; color: ManaColor; delta: number }
  | { type: 'payMana'; payment: ManaPool }
  | { type: 'clearManaPool' }
  | { type: 'draw'; count: number }
  | { type: 'mill'; count: number }
  | { type: 'shuffle'; order: string[] }
  | { type: 'untapAll' }
  | { type: 'discard'; cardIds: string[] }
  | { type: 'putOnBottom'; cardIds: string[] }
  | { type: 'playLand'; cardId: string; forced: boolean; entersTapped?: boolean }
  | { type: 'arrangeTop'; topOrder: string[]; toBottom: string[]; toGraveyard: string[] }
  | { type: 'crackTreasure'; cardId: string; color: ManaColor }
  | { type: 'castSpell'; cardId: string; payment: ManaPool; forced: boolean }
  | { type: 'castCommander'; cardId: string; payment: ManaPool; forced: boolean }
  | { type: 'castToStack'; cardId: string; payment: ManaPool; forced: boolean }
  | {
      type: 'addAbilityToStack';
      sourceId: string;
      kind: AbilityKind;
      abilityLineIndex?: number;
      sourceSnapshot?: ObjectSnapshot;
    }
  | { type: 'resolveStackTop'; to?: ZoneId }
  | { type: 'removeStackItem'; id: string; to?: ZoneId }
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
    }
  | { type: 'nextPhase'; drawnHandled?: boolean }
  | { type: 'nextTurn' }
  | { type: 'mulligan'; order: string[] };

export interface ApplyResult {
  state: GameState;
  warnings: string[];
}

export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineError';
  }
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
}

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

function emptyManaPool(): ManaPool {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
}

/** Shallow clone of state for editing. Sub-collections cloned lazily. */
function makeDraft(state: GameState): Draft {
  const maxSeq = state.log.reduce((m, e) => Math.max(m, e.seq), -1);
  const eventLog = Array.isArray(state.eventLog) ? state.eventLog : [];
  const maxEventSeq = eventLog.reduce((m, e) => Math.max(m, e.sequence), -1);
  return {
    state: {
      ...state,
      cards: { ...state.cards },
      zones: { ...state.zones },
      manaPool: { ...state.manaPool },
      commanders: state.commanders,
      commanderDamage: { ...state.commanderDamage },
      opponentLife: { ...state.opponentLife },
      eventLog: eventLog.slice(),
      pendingTriggers: Array.isArray(state.pendingTriggers) ? state.pendingTriggers.slice() : [],
      pendingRuleChoices: Array.isArray(state.pendingRuleChoices)
        ? state.pendingRuleChoices.slice()
        : [],
      pendingSbaChoices: Array.isArray(state.pendingSbaChoices)
        ? state.pendingSbaChoices.slice()
        : [],
      log: state.log.slice(),
    },
    warnings: [],
    nextSeq: maxSeq + 1,
    nextEventSeq: maxEventSeq + 1,
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

function pushEvent(draft: Draft, event: Omit<ZoneChangeEvent, 'eventId' | 'sequence'>): void {
  const sequence = draft.nextEventSeq++;
  draft.state.eventLog = [
    ...draft.state.eventLog,
    {
      ...event,
      eventId: `e${sequence}`,
      sequence,
    },
  ];
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

/** Get a mutable clone of a zone array, installing it into the draft. */
function editZone(draft: Draft, zone: ZoneId): string[] {
  const arr = draft.state.zones[zone].slice();
  draft.state.zones = { ...draft.state.zones, [zone]: arr };
  return arr;
}

function removeFromCurrentZone(draft: Draft, cardId: string): ZoneId {
  const card = draft.state.cards[cardId];
  const from = card.zone;
  const arr = editZone(draft, from);
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
function resetCardForZoneChange(card: CardInstance, to: ZoneId): CardInstance {
  return {
    ...card,
    zone: to,
    zoneChangeCounter: card.zoneChangeCounter + 1,
    tapped: false,
    faceDown: false,
    faceIndex: 0,
    counters: {},
    damageMarked: 0,
    hasDeathtouchDamage: false,
    attachedTo: undefined,
    enteredTurn: 0,
  };
}

function currentFaceOf(draft: Draft, card: CardInstance) {
  const def = draft.state.defs[card.defId];
  return def?.faces[card.faceIndex] ?? def?.faces[0];
}

function typeLineOf(draft: Draft, card: CardInstance): string {
  const def = draft.state.defs[card.defId];
  const face = currentFaceOf(draft, card);
  return (face?.typeLine ?? def?.typeLine ?? '').toString();
}

function objectSnapshotOf(draft: Draft, card: CardInstance): ObjectSnapshot {
  const face = currentFaceOf(draft, card);
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
    typeLine: typeLineOf(draft, card),
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
): void {
  pushEvent(draft, {
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
  });
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
): void {
  const card = requireCard(draft, cardId);
  const from = card.zone;
  const sameZone = from === to;

  if (card.isAbility && to !== 'stack') {
    const name = stackNameOf(draft, card);
    if (!sameZone) {
      pushZoneChangeEvent(
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
    return;
  }

  if (card.isCopy) {
    if (!sameZone && to !== 'battlefield') {
      const name = nameOfCard(draft, card);
      const before = objectSnapshotOf(draft, card);
      const after = objectSnapshotOf(draft, resetCardForZoneChange(card, to));
      pushZoneChangeEvent(draft, before, after, from, to, reason, eventOptions);
      deleteCardFromState(draft, cardId);
      if (log) {
        pushLog(draft, `コピー${name}は消滅した。`);
      }
      return;
    }
  }

  removeFromCurrentZone(draft, cardId);
  const dest = editZone(draft, to);

  // battlefield destination always appended (UI manages order otherwise).
  const effectivePosition: 'top' | 'bottom' | number = to === 'battlefield' ? 'bottom' : position;
  insertIntoZone(dest, cardId, effectivePosition);

  const before = sameZone ? undefined : objectSnapshotOf(draft, card);
  let updated = sameZone ? { ...card, zone: to } : resetCardForZoneChange(card, to);
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
  if (!sameZone && before) {
    pushZoneChangeEvent(
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

function performStateBasedActionsOnce(draft: Draft): boolean {
  if (draft.state.pendingRuleChoices.length > 0) {
    return false;
  }

  const simultaneousGroupId = `sba-${draft.nextEventSeq}`;
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
  return { state: draft.state, warnings: draft.warnings };
}

function clearPool(draft: Draft, reason: string | null): void {
  const pool = draft.state.manaPool;
  const total = pool.W + pool.U + pool.B + pool.R + pool.G + pool.C;
  draft.state.manaPool = emptyManaPool();
  if (reason && total > 0) {
    pushLog(draft, reason);
  }
}

function subtractPayment(draft: Draft, payment: ManaPool): { shortfall: number } {
  const pool = { ...draft.state.manaPool };
  let shortfall = 0;
  for (const color of ['W', 'U', 'B', 'R', 'G', 'C'] as ManaColor[]) {
    const want = payment[color];
    if (want <= 0) continue;
    const have = pool[color];
    const pay = Math.min(want, have);
    pool[color] = have - pay;
    shortfall += want - pay;
  }
  draft.state.manaPool = pool;
  return { shortfall };
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

function handleUntapEntry(draft: Draft): void {
  untapAll(draft);
  draft.state.landsPlayedThisTurn = 0;
  draft.state.spellsCastThisTurn = 0;
  draft.state.drawnThisTurn = 0;

  const cards = { ...draft.state.cards };
  let changed = false;

  for (const id of draft.state.zones.battlefield) {
    const card = cards[id];
    if (!card || !typeLineOf(draft, card).includes('Saga')) continue;
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

function drawCards(draft: Draft, count: number): number {
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    const lib = draft.state.zones.library;
    if (lib.length === 0) break;
    const topId = lib[0];
    moveCardInternal(draft, topId, 'hand', 'bottom', false);
    drawn++;
  }
  return drawn;
}

function applyMill(draft: Draft, count: number): void {
  const requested = Math.max(0, Math.floor(count));
  if (requested <= 0) return;

  const available = draft.state.zones.library.length;
  const milled = Math.min(requested, available);
  const topIds = draft.state.zones.library.slice(0, milled);

  for (const cardId of topIds) {
    moveCardInternal(draft, cardId, 'graveyard', 'bottom', false);
  }

  pushLog(draft, `切削: ライブラリの上から${milled}枚を墓地に置いた。`);
  if (requested > available) {
    draft.warnings.push(`ライブラリが${requested}枚に満たないため${milled}枚を切削した。`);
  }
}

function applyDiscard(draft: Draft, cardIds: string[]): void {
  let discarded = 0;

  for (const cardId of cardIds) {
    if (!draft.state.cards[cardId]) continue;
    moveCardInternal(draft, cardId, 'graveyard', 'bottom', false);
    discarded += 1;
  }

  if (discarded > 0) {
    pushLog(draft, `${discarded}枚を捨てた。`);
  }
}

function enterPhase(draft: Draft, phase: Phase, drawnHandled: boolean): void {
  draft.state.phase = phase;
  if (phase === 'untap') {
    handleUntapEntry(draft);
  }
  if (phase === 'draw' && !drawnHandled) {
    const drawn = drawCards(draft, 1);
    if (drawn > 0) {
      pushLog(draft, 'カードを1枚引きました。');
    } else {
      draft.warnings.push('ライブラリが空のためドローできません。');
    }
  }
}

function applyNextPhase(draft: Draft, drawnHandled: boolean): void {
  clearPool(draft, 'フェイズ移行によりマナプールが空になりました。');
  const idx = PHASE_ORDER.indexOf(draft.state.phase);
  if (idx === PHASE_ORDER.length - 1) {
    // end -> next turn untap
    clearMarkedDamageInternal(draft);
    draft.state.turn += 1;
    enterPhase(draft, 'untap', drawnHandled);
    pushLog(draft, `ターン${draft.state.turn}に移行しました。`);
  } else {
    const next = PHASE_ORDER[idx + 1];
    enterPhase(draft, next, drawnHandled);
    pushLog(draft, `${PHASE_LABELS[next]}フェイズに移行しました。`);
  }
}

function applyNextTurn(draft: Draft): void {
  clearPool(draft, 'ターン移行によりマナプールが空になりました。');
  clearMarkedDamageInternal(draft);
  draft.state.turn += 1;
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

function applyPlayLand(draft: Draft, cardId: string, entersTapped?: boolean): void {
  const card = requireCard(draft, cardId);
  if (card.zone !== 'hand') {
    throw new EngineError(`土地は手札からのみプレイできます: ${cardId}`);
  }
  if (!typeLineOf(draft, card).includes('Land')) {
    throw new EngineError(`土地ではないカードです: ${cardId}`);
  }

  moveCardInternal(draft, cardId, 'battlefield', 'bottom', false);
  if (entersTapped) {
    const entered = requireCard(draft, cardId);
    setCard(draft, { ...entered, tapped: true });
  }
  draft.state.landsPlayedThisTurn += 1;
  pushLog(draft, `${nameOf(draft, cardId)}を土地としてプレイしました。`);
  if (draft.state.landsPlayedThisTurn >= 2) {
    draft.warnings.push(`このターン${draft.state.landsPlayedThisTurn}枚目の土地です。`);
  }
}

function applyArrangeTop(
  draft: Draft,
  topOrder: string[],
  toBottom: string[],
  toGraveyard: string[],
): void {
  const originalLibrary = draft.state.zones.library.slice();
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

  draft.state.zones = {
    ...draft.state.zones,
    library: [...topOrder, ...originalLibrary.slice(count), ...toBottom],
  };
  pushLog(draft, `ライブラリの上から${count}枚を並べ替えました。`);
}

function applyCast(
  draft: Draft,
  cardId: string,
  payment: ManaPool,
  forced: boolean,
  commander: boolean,
): void {
  const card = requireCard(draft, cardId);

  if (commander) {
    if (!isCommander(draft.state, cardId)) {
      throw new EngineError(`統率者ではないカードです: ${cardId}`);
    }
    if (card.zone !== 'command') {
      throw new EngineError(`統率者は統率領域からのみキャストできます: ${cardId}`);
    }
  }

  const { shortfall } = subtractPayment(draft, payment);
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
    draft.state.spellsCastThisTurn += 1;
    pushLog(draft, `統率者${name}をキャストしました(支払い: ${payStr})。`);
  } else {
    moveCardInternal(draft, cardId, dest, 'bottom', false, 'cast');
    draft.state.spellsCastThisTurn += 1;
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
    abilityKind: kind,
    abilityLineIndex,
  };
}

function applyCastToStack(draft: Draft, cardId: string, payment: ManaPool, forced: boolean): void {
  const card = requireCard(draft, cardId);
  const fromCommand = card.zone === 'command' && isCommander(draft.state, cardId);

  const { shortfall } = subtractPayment(draft, payment);
  if (shortfall > 0) {
    const msg = forced
      ? `マナが${shortfall}点不足していますが強行しました。`
      : `マナが${shortfall}点不足(強行)。`;
    draft.warnings.push(msg);
  } else if (forced) {
    draft.warnings.push('マナ不足のまま強行で唱えました。');
  }

  moveCardInternal(draft, cardId, 'stack', 'bottom', false, 'cast');
  if (fromCommand) {
    incrementCommanderCastCount(draft, cardId);
  }
  draft.state.spellsCastThisTurn += 1;
  pushLog(draft, `${nameOf(draft, cardId)}を唱えた(スタックへ)。`);
}

function applyAddAbilityToStack(
  draft: Draft,
  sourceId: string,
  kind: AbilityKind,
  abilityLineIndex?: number,
  sourceSnapshot?: ObjectSnapshot,
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

export function guidedPlanForStackTop(
  state: GameState,
): { sourceId: string; prompts: EffectPrompt[] } | null {
  const topId = state.zones.stack[state.zones.stack.length - 1];
  if (!topId) {
    return null;
  }
  const card = state.cards[topId];
  if (!card) {
    return null;
  }

  const prompts: EffectPrompt[] = [];
  let sourceId: string | null = null;
  for (const effectLine of effectLinesForStackItemState(state, card)) {
    const ir = parseAbilityIR(effectLine.line.text, effectLine.typeLine);
    const compiled = compileAbilityIR(ir, {
      sourceId: effectLine.sourceId,
      def: effectLine.def,
    });
    if (compiled.decision !== 'guided') {
      continue;
    }
    sourceId = sourceId ?? effectLine.sourceId;
    prompts.push(...compiled.prompts);
  }

  return sourceId && prompts.length > 0 ? { sourceId, prompts } : null;
}

export function activationPlanForSource(
  state: GameState,
  sourceId: string,
  abilityLineIndex?: number,
): { commands: GameCommand[]; decision: CostDecision; manaShortfall: number } | null {
  const source = state.cards[sourceId];
  if (state.effectsAuto === false || source?.effectsAuto === false) {
    return null;
  }
  if (!source) {
    return { commands: [], decision: 'manual', manaShortfall: 0 };
  }

  const def = state.defs[source.defId];
  if (!def) {
    return { commands: [], decision: 'manual', manaShortfall: 0 };
  }

  const resolvedIndex = abilityLineIndex ?? abilityLineIndexForKind(state, sourceId, 'activated');
  if (resolvedIndex === undefined) {
    return { commands: [], decision: 'manual', manaShortfall: 0 };
  }

  const line = splitAbilityLines(def)[resolvedIndex];
  if (!line || line.shape !== 'activated') {
    return { commands: [], decision: 'manual', manaShortfall: 0 };
  }

  const typeLine = def.faces[line.faceIndex]?.typeLine ?? def.typeLine;
  const ir = parseAbilityIR(line.text, typeLine);
  const compiledCost = compileAbilityCost(ir.cost, { sourceId, def });
  if (compiledCost.decision === 'manual') {
    return { commands: [], decision: 'manual', manaShortfall: 0 };
  }

  const commands: GameCommand[] = compiledCost.commands.slice();
  let manaShortfall = 0;
  if (compiledCost.manaCost !== null) {
    const plan = planAutoTap(state, parseManaCost(compiledCost.manaCost), 0);
    commands.push(...tapCommands(plan.taps), { type: 'payMana', payment: plan.payment });
    manaShortfall = plan.shortfall;
  }

  return { commands, decision: 'auto', manaShortfall };
}

export function activatedManaAbilityPlanForSource(
  state: GameState,
  sourceId: string,
  abilityLineIndex?: number,
): { commands: GameCommand[]; decision: CostDecision; manaShortfall: number } | null {
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

  const compiledCost = compileAbilityCost(ir.cost, { sourceId, def });
  if (compiledCost.decision === 'manual') {
    return { commands: [], decision: 'manual', manaShortfall: 0 };
  }

  const compiledEffect = compileAbilityIR(ir, { sourceId, def });
  if (compiledEffect.decision !== 'auto') {
    return { commands: [], decision: 'manual', manaShortfall: 0 };
  }

  const commands: GameCommand[] = compiledCost.commands.slice();
  let manaShortfall = 0;
  if (compiledCost.manaCost !== null) {
    const plan = planAutoTap(state, parseManaCost(compiledCost.manaCost), 0);
    commands.push(...tapCommands(plan.taps), { type: 'payMana', payment: plan.payment });
    manaShortfall = plan.shortfall;
  }
  commands.push(...compiledEffect.commands);

  return { commands, decision: 'auto', manaShortfall };
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

export function eligibleTargets(state: GameState, filter: TargetFilter): string[] {
  if (filter.controller === 'opponent') {
    return [];
  }
  const types = filter.types ?? ['permanent'];
  const acceptsAnyPermanent = types.length === 0 || types.includes('permanent');

  return state.zones.battlefield.filter((cardId) => {
    const card = state.cards[cardId];
    if (!card || card.isAbility) {
      return false;
    }
    if (acceptsAnyPermanent) {
      return true;
    }
    const def = state.defs[card.defId];
    const face = def?.faces[card.faceIndex] ?? def?.faces[0];
    const typeLine = (face?.typeLine ?? def?.typeLine ?? '').toLowerCase();
    return types.some((type) => typeLine.includes(type.toLowerCase()));
  });
}

function tapCommands(taps: { cardId: string; color: ManaColor }[]): GameCommand[] {
  return taps.flatMap((tap) => [
    { type: 'setTapped', cardId: tap.cardId, tapped: true } satisfies GameCommand,
    { type: 'addMana', color: tap.color, amount: 1 } satisfies GameCommand,
  ]);
}

function applyAutoCommand(draft: Draft, cmd: GameCommand): void {
  switch (cmd.type) {
    case 'draw': {
      const drawn = drawCards(draft, Math.max(0, cmd.count));
      draft.state.drawnThisTurn += drawn;
      pushLog(draft, `カードを${drawn}枚引きました。`);
      if (drawn < cmd.count) {
        draft.warnings.push('ライブラリが足りずすべて引けませんでした。');
      }
      break;
    }
    case 'mill': {
      applyMill(draft, cmd.count);
      break;
    }
    case 'adjustLife': {
      draft.state.life += cmd.delta;
      const sign = cmd.delta >= 0 ? '+' : '';
      pushLog(draft, `ライフが${sign}${cmd.delta}(現在${draft.state.life})。`);
      break;
    }
    case 'adjustPlayerCounter': {
      const current = draft.state[cmd.kind];
      const next = Math.max(0, current + cmd.delta);
      draft.state[cmd.kind] = next;
      const label = cmd.kind === 'poison' ? '毒' : cmd.kind === 'energy' ? 'エネルギー' : '経験';
      pushLog(draft, `${label}カウンターを${next}個にしました。`);
      break;
    }
    case 'addMana': {
      const amount = Math.max(0, cmd.amount);
      if (amount > 0) {
        const pool = { ...draft.state.manaPool };
        pool[cmd.color] += amount;
        draft.state.manaPool = pool;
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
      );
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

function applyCompiledEffectsForStackItem(
  draft: Draft,
  card: CardInstance,
  effectLines: readonly ResolvableEffectLine[],
): void {
  for (const effectLine of effectLines) {
    const ir = parseAbilityIR(effectLine.line.text, effectLine.typeLine);
    const compiled = compileAbilityIR(ir, {
      sourceId: effectLine.sourceId,
      def: effectLine.def,
    });
    if (compiled.decision !== 'auto') {
      continue;
    }
    applyAutoCommands(draft, compiled.commands);
    pushLog(draft, `${stackNameOf(draft, card)}の効果を自動実行した。`);
  }
}

function applyResolveStackTop(draft: Draft, to?: ZoneId): void {
  const stack = draft.state.zones.stack;
  if (stack.length === 0) return;

  const topId = stack[stack.length - 1];
  const card = requireCard(draft, topId);
  const effectLines = effectLinesForResolvedStackItem(draft, card);

  if (card.isAbility) {
    deleteCardFromState(draft, topId);
    pushLog(draft, `${stackNameOf(draft, card)}の能力を解決した。`);
    applyCompiledEffectsForStackItem(draft, card, effectLines);
    return;
  }

  const destination = to ?? defaultStackResolveDestination(draft, card);
  moveCardInternal(draft, topId, destination, 'bottom', false, 'resolve');
  pushLog(draft, `${stackNameOf(draft, card)}を解決した(→${ZONE_LABELS[destination]})。`);
  applyCompiledEffectsForStackItem(draft, card, effectLines);
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

  draft.state.manaPool = {
    ...draft.state.manaPool,
    [color]: draft.state.manaPool[color] + 1,
  };
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

function applyCreateToken(
  draft: Draft,
  name: string,
  typeLine: string,
  power: string | undefined,
  toughness: string | undefined,
  quantity: number,
  producedMana: ManaColor[] | undefined,
  tokenKind: CardDef['tokenKind'],
): void {
  const qty = Math.max(0, Math.floor(quantity));
  if (qty === 0) return;

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
      ownerId: 'P1',
      controllerId: 'P1',
      zoneChangeCounter: 0,
      tapped: false,
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

function applyMulligan(draft: Draft, order: string[]): void {
  const hand = draft.state.zones.hand.slice();
  // Move all hand cards back into library (state reset), then reorder library
  // by the provided permutation (hand + library combined).
  for (const id of hand) {
    moveCardInternal(draft, id, 'library', 'bottom', false);
  }
  // Validate + apply order as the new library permutation.
  const lib = draft.state.zones.library;
  const valid =
    order.length === lib.length &&
    new Set(order).size === order.length &&
    order.every((id) => lib.includes(id));
  if (valid) {
    draft.state.zones = { ...draft.state.zones, library: order.slice() };
  } else {
    throw new EngineError('mulligan の order がライブラリの順列ではありません。');
  }
  draft.state.mulliganCount += 1;
  pushLog(draft, `マリガンしました(${draft.state.mulliganCount}回目)。`);
}

function applyShuffle(draft: Draft, order: string[]): void {
  const lib = draft.state.zones.library;
  const valid =
    order.length === lib.length &&
    new Set(order).size === order.length &&
    order.every((id) => lib.includes(id));
  if (!valid) {
    throw new EngineError('shuffle の order がライブラリの順列ではありません。');
  }
  draft.state.zones = { ...draft.state.zones, library: order.slice() };
  pushLog(draft, 'ライブラリをシャッフルしました。');
}

function applyPutOnBottom(draft: Draft, cardIds: string[]): void {
  for (const id of cardIds) {
    requireCard(draft, id);
    moveCardInternal(draft, id, 'library', 'bottom', false);
  }
  if (cardIds.length > 0) {
    pushLog(draft, `${cardIds.length}枚をライブラリの一番下に置きました。`);
  }
}

// ---------------------------------------------------------------------------
// applyCommand
// ---------------------------------------------------------------------------

export function applyCommand(state: GameState, cmd: GameCommand): ApplyResult {
  const draft = makeDraft(state);

  switch (cmd.type) {
    case 'moveCard': {
      requireCard(draft, cmd.cardId);
      moveCardInternal(draft, cmd.cardId, cmd.to, cmd.position, true, cmd.reason ?? 'move', {
        ...(cmd.replacementApplied === undefined
          ? {}
          : { replacementApplied: cmd.replacementApplied }),
        ...(cmd.sbaApplied === undefined ? {} : { sbaApplied: cmd.sbaApplied }),
        ...(cmd.simultaneousGroupId === undefined
          ? {}
          : { simultaneousGroupId: cmd.simultaneousGroupId }),
      });
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
      const card = requireCard(draft, cmd.cardId);
      const current = card.counters[cmd.counterType] ?? 0;
      const next = Math.max(0, current + cmd.delta);
      const counters = { ...card.counters };
      if (next === 0) {
        delete counters[cmd.counterType];
      } else {
        counters[cmd.counterType] = next;
      }
      setCard(draft, { ...card, counters });
      pushLog(
        draft,
        `${nameOf(draft, cmd.cardId)}の${cmd.counterType}カウンターを${next}個にしました。`,
      );
      break;
    }
    case 'markDamage': {
      applyMarkDamage(draft, cmd.cardId, cmd.amount, cmd.deathtouch);
      break;
    }
    case 'clearMarkedDamage': {
      applyClearMarkedDamage(draft, cmd.cardId);
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
    case 'adjustLife': {
      draft.state.life += cmd.delta;
      const sign = cmd.delta >= 0 ? '+' : '';
      pushLog(draft, `ライフが${sign}${cmd.delta}(現在${draft.state.life})。`);
      break;
    }
    case 'adjustPlayerCounter': {
      const current = draft.state[cmd.kind];
      const next = Math.max(0, current + cmd.delta);
      draft.state[cmd.kind] = next;
      const label = cmd.kind === 'poison' ? '毒' : cmd.kind === 'energy' ? 'エネルギー' : '経験';
      pushLog(draft, `${label}カウンターを${next}個にしました。`);
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
      const current = draft.state.opponentLife[cmd.label] ?? 40;
      const next = current + cmd.delta;
      draft.state.opponentLife = {
        ...draft.state.opponentLife,
        [cmd.label]: next,
      };
      pushLog(draft, `対戦相手ライフ(${cmd.label})を${next}にしました。`);
      break;
    }
    case 'addMana': {
      const amount = Math.max(0, cmd.amount);
      if (amount > 0) {
        const pool = { ...draft.state.manaPool };
        pool[cmd.color] += amount;
        draft.state.manaPool = pool;
        pushLog(draft, `${cmd.color}マナを${amount}点加えました。`);
      }
      break;
    }
    case 'adjustMana': {
      if (cmd.delta === 0) break;
      const current = draft.state.manaPool[cmd.color];
      const next = Math.max(0, current + cmd.delta);
      if (next === current) break;
      draft.state.manaPool = {
        ...draft.state.manaPool,
        [cmd.color]: next,
      };
      const deltaLabel = cmd.delta > 0 ? `+${cmd.delta}` : `${cmd.delta}`;
      pushLog(draft, `${cmd.color}マナを${deltaLabel}した(現在${next})。`);
      break;
    }
    case 'payMana': {
      const { shortfall } = subtractPayment(draft, cmd.payment);
      if (shortfall > 0) {
        draft.warnings.push(`マナが${shortfall}点不足(強行)。`);
      }
      pushLog(draft, `マナを支払いました(${describePayment(cmd.payment)})。`);
      break;
    }
    case 'clearManaPool': {
      clearPool(draft, 'マナプールを空にしました。');
      break;
    }
    case 'draw': {
      const drawn = drawCards(draft, Math.max(0, cmd.count));
      draft.state.drawnThisTurn += drawn;
      pushLog(draft, `カードを${drawn}枚引きました。`);
      if (drawn < cmd.count) {
        draft.warnings.push('ライブラリが足りずすべて引けませんでした。');
      }
      break;
    }
    case 'mill': {
      applyMill(draft, cmd.count);
      break;
    }
    case 'shuffle': {
      applyShuffle(draft, cmd.order);
      break;
    }
    case 'untapAll': {
      untapAll(draft);
      break;
    }
    case 'discard': {
      applyDiscard(draft, cmd.cardIds);
      break;
    }
    case 'putOnBottom': {
      applyPutOnBottom(draft, cmd.cardIds);
      break;
    }
    case 'playLand': {
      applyPlayLand(draft, cmd.cardId, cmd.entersTapped);
      break;
    }
    case 'arrangeTop': {
      applyArrangeTop(draft, cmd.topOrder, cmd.toBottom, cmd.toGraveyard);
      break;
    }
    case 'crackTreasure': {
      applyCrackTreasure(draft, cmd.cardId, cmd.color);
      break;
    }
    case 'castSpell': {
      applyCast(draft, cmd.cardId, cmd.payment, cmd.forced, false);
      break;
    }
    case 'castCommander': {
      applyCast(draft, cmd.cardId, cmd.payment, cmd.forced, true);
      break;
    }
    case 'castToStack': {
      applyCastToStack(draft, cmd.cardId, cmd.payment, cmd.forced);
      break;
    }
    case 'addAbilityToStack': {
      applyAddAbilityToStack(
        draft,
        cmd.sourceId,
        cmd.kind,
        cmd.abilityLineIndex,
        cmd.sourceSnapshot,
      );
      break;
    }
    case 'resolveStackTop': {
      applyResolveStackTop(draft, cmd.to);
      break;
    }
    case 'removeStackItem': {
      applyRemoveStackItem(draft, cmd.id, cmd.to);
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
      );
      break;
    }
    case 'nextPhase': {
      applyNextPhase(draft, cmd.drawnHandled ?? false);
      break;
    }
    case 'nextTurn': {
      applyNextTurn(draft);
      break;
    }
    case 'mulligan': {
      applyMulligan(draft, cmd.order);
      break;
    }
  }

  stabilizeBeforePriority(draft);
  return { state: draft.state, warnings: draft.warnings };
}
