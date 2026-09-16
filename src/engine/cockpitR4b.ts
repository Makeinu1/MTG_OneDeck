import type { ExpectedInteractionContext } from './cockpitR31';
import type { R4TableOperation } from './cockpitR4';
import {
  manaColors,
  type CockpitTable,
  type TableGrant,
  type TableModifier,
  type TableTokenCharacteristics,
} from './cockpitTable';
import {
  objectIdOf,
  type CardInstance,
  type ManaPool,
  type ObjectSnapshot,
  type ZoneId,
} from './types';

export interface R4bObjectRef {
  cardId: string;
  objectId: string;
}

export interface R4bRepairLocationStateAfter {
  tapped?: boolean;
  counters?: Record<string, number>;
  controllerId?: string;
  attachmentTargetId?: string | null;
}

export interface R4bRepairLocationEntry extends R4bObjectRef {
  stateAfter?: R4bRepairLocationStateAfter;
}

export type R4bRepairOperation =
  | {
      type: 'repair.location';
      objects: R4bRepairLocationEntry[];
      to: Exclude<ZoneId, 'stack'>;
      position: 'top' | 'bottom';
    }
  | { type: 'repair.lifeTotal'; seatId: string; value: number }
  | {
      type: 'repair.counterCount';
      target:
        | { kind: 'card'; object: R4bObjectRef }
        | { kind: 'seat'; seatId: string };
      name: string;
      value: number;
    }
  | {
      type: 'repair.tapState';
      objects: { object: R4bObjectRef; value: boolean }[];
    }
  | { type: 'repair.manaPool'; seatId: string; value: ManaPool }
  | {
      type: 'repair.damageState';
      object: R4bObjectRef;
      value: { damageMarked: number; hasDeathtouchDamage: boolean };
    }
  | { type: 'repair.controller'; object: R4bObjectRef; controllerId: string }
  | {
      type: 'repair.attachment';
      object: R4bObjectRef;
      target: R4bObjectRef | null;
    }
  | {
      type: 'repair.faceState';
      object: R4bObjectRef;
      faceIndex: number;
      faceDown: boolean;
    }
  | {
      type: 'repair.modifier';
      object: R4bObjectRef;
      modifierId: string;
      value: TableModifier | null;
    }
  | {
      type: 'repair.keywordGrant';
      object: R4bObjectRef;
      grantId: string;
      value: TableGrant | null;
    }
  | {
      type: 'repair.linkedExile';
      linkId: string;
      value:
        | null
        | {
            source: R4bObjectRef;
            objects: R4bObjectRef[];
            duration?: string;
          };
    }
  | { type: 'repair.commanderCount'; cardId: string; value: number }
  | {
      type: 'repair.tokenDefinition';
      object: R4bObjectRef;
      definitionId: string;
      value: TableTokenCharacteristics;
    }
  | {
      type: 'repair.token.create';
      id: string;
      seatId: string;
      value: TableTokenCharacteristics;
    }
  | { type: 'repair.token.remove'; object: R4bObjectRef }
  | {
      type: 'repair.copy.create';
      id: string;
      seatId: string;
      source: R4bObjectRef;
    }
  | { type: 'repair.copy.remove'; object: R4bObjectRef }
  | { type: 'repair.visibility'; object: R4bObjectRef; seatIds: string[] };

export interface R4bCommanderMoveToCommandOperation {
  type: 'commander.moveToCommand';
  cardId: string;
  objectId: string;
}

export type R4bOperation =
  | R4TableOperation
  | R4bRepairOperation
  | R4bCommanderMoveToCommandOperation;

export type R4bDeclaredCause =
  | { kind: 'manual-event' }
  | { kind: 'correction'; groupId: string };

export interface R4bOperationRequest {
  operation: R4bOperation;
  context: ExpectedInteractionContext;
  declaredCause?: R4bDeclaredCause;
}

export type R4bFormalFamily =
  | 'action'
  | 'stack-lifecycle'
  | 'stack-effect'
  | 'combat'
  | 'turn-lifecycle'
  | 'system-transition'
  | 'session-lifecycle'
  | 'information';

export type R4bGateClass =
  | { kind: 'formal'; family: R4bFormalFamily }
  | { kind: 'effect'; manualEventCapable: boolean }
  | { kind: 'repair' }
  | { kind: 'meta' }
  | { kind: 'retired'; replacement: string };

export type R4bEffectiveCause =
  | { kind: 'formal'; parentResolutionId?: string }
  | { kind: 'resolution'; entryId: string }
  | { kind: 'manual-event'; processId: string }
  | { kind: 'correction'; groupId: string }
  | { kind: 'meta' };

function assertNever(value: never): never {
  throw new Error(`UNCLASSIFIED_R4B_OPERATION:${JSON.stringify(value)}`);
}

export function classifyR4bOperation(operation: R4bOperation): R4bGateClass {
  switch (operation.type) {
    case 'playLand':
    case 'special.turnFaceUp':
    case 'activate':
    case 'generate':
    case 'generateBatch':
    case 'commander.moveToCommand':
      return { kind: 'formal', family: 'action' };
    case 'cast':
      return 'sourceZone' in operation
        ? { kind: 'formal', family: 'action' }
        : { kind: 'retired', replacement: 'R4 cast with explicit sourceZone' };
    case 'trigger.manualAdd':
    case 'trigger.place':
    case 'trigger.link':
    case 'trigger.dismiss':
    case 'resolve.begin':
    case 'resolve.end':
    case 'resolve.finish':
    case 'resolve.fetch':
      return { kind: 'formal', family: 'stack-lifecycle' };
    case 'copyStack':
    case 'stack.remove':
      return { kind: 'formal', family: 'stack-effect' };
    case 'battle.attack':
    case 'battle.block':
    case 'battle.assign':
    case 'battle.apply':
    case 'battle.nextDamage':
    case 'battle.end':
      return { kind: 'formal', family: 'combat' };
    case 'shortcut':
    case 'turn.ready':
    case 'cleanup':
    case 'mulligan':
    case 'keep':
    case 'phase':
    case 'turn':
      return { kind: 'formal', family: 'turn-lifecycle' };
    case 'state.apply':
      return { kind: 'formal', family: 'system-transition' };
    case 'end':
      return { kind: 'formal', family: 'session-lifecycle' };
    case 'move':
    case 'draw':
    case 'tap':
    case 'life':
    case 'counter':
      return { kind: 'effect', manualEventCapable: true };
    case 'damage':
      return operation.sourceId
        ? { kind: 'effect', manualEventCapable: true }
        : { kind: 'retired', replacement: 'repair.damageState' };
    case 'shuffle':
    case 'randomDiscard':
    case 'arrange':
    case 'proliferate':
    case 'mana':
    case 'emptyMana':
    case 'token':
    case 'copyPermanent':
    case 'control':
    case 'attach':
    case 'modifier':
    case 'keyword':
    case 'face':
    case 'link':
      return { kind: 'effect', manualEventCapable: false };
    case 'token.edit':
      return { kind: 'retired', replacement: 'repair.tokenDefinition' };
    case 'commanderCount':
      return { kind: 'retired', replacement: 'repair.commanderCount' };
    case 'visibility':
      return { kind: 'effect', manualEventCapable: false };
    case 'hold':
      return { kind: 'retired', replacement: 'CockpitControl.hold' };
    case 'eliminate':
      return { kind: 'retired', replacement: 'CockpitControl.eliminate' };
    case 'repair.location':
    case 'repair.lifeTotal':
    case 'repair.counterCount':
    case 'repair.tapState':
    case 'repair.manaPool':
    case 'repair.damageState':
    case 'repair.controller':
    case 'repair.attachment':
    case 'repair.faceState':
    case 'repair.modifier':
    case 'repair.keywordGrant':
    case 'repair.linkedExile':
    case 'repair.commanderCount':
    case 'repair.tokenDefinition':
    case 'repair.token.create':
    case 'repair.token.remove':
    case 'repair.copy.create':
    case 'repair.copy.remove':
    case 'repair.visibility':
      return { kind: 'repair' };
    default:
      return assertNever(operation);
  }
}

function requireR4b(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function integer(value: number, min = -100000, max = 100000): void {
  requireR4b(Number.isSafeInteger(value) && value >= min && value <= max, 'INVALID_R4B_VALUE');
}

function seatOf(table: CockpitTable, seatId: string) {
  const seat = table.seats.find((seat) => seat.id === seatId && !seat.eliminated);
  requireR4b(seat, 'INVALID_R4B_SEAT');
  return seat;
}

function cardOf(table: CockpitTable, cardId: string): CardInstance {
  const card = table.cards[cardId];
  requireR4b(card, 'INVALID_R4B_OBJECT');
  return card;
}

function objectOf(table: CockpitTable, ref: R4bObjectRef): CardInstance {
  const card = cardOf(table, ref.cardId);
  requireR4b(objectIdOf(card) === ref.objectId, 'STALE_R4B_OBJECT');
  return card;
}

function unique(values: readonly string[], message = 'INVALID_R4B_SELECTION'): void {
  requireR4b(values.length > 0 && values.length <= 100 && new Set(values).size === values.length, message);
}

function validId(value: string): boolean {
  return /^[a-zA-Z0-9-]{1,100}$/.test(value);
}

function validateCounters(counters: Record<string, number>): void {
  for (const [name, value] of Object.entries(counters)) {
    requireR4b(
      name.trim().length > 0 &&
        name.length <= 100 &&
        !['__proto__', 'constructor', 'prototype'].includes(name),
      'INVALID_R4B_COUNTER',
    );
    integer(value, 0);
  }
}

function validateManaPool(pool: ManaPool): void {
  for (const color of manaColors) integer(pool[color], 0);
}

function validateTokenCharacteristics(value: TableTokenCharacteristics): void {
  for (const text of [value.name, value.typeLine, value.power, value.toughness, value.text])
    requireR4b(typeof text === 'string' && text.length <= 2000, 'INVALID_R4B_TOKEN');
  requireR4b(value.name.trim().length > 0 && value.typeLine.trim().length > 0, 'INVALID_R4B_TOKEN');
  requireR4b(
    value.colors === undefined ||
      (Array.isArray(value.colors) && value.colors.every((color) => color !== 'C' && manaColors.includes(color))),
    'INVALID_R4B_TOKEN',
  );
}

function removeCombatant(table: CockpitTable, id: string): void {
  const combat = table.combat;
  if (!combat) return;
  const affected =
    [...combat.attackers, ...combat.blockers].some((entry) => entry.cardId === id) ||
    combat.attackers.some((entry) => entry.targetId === id) ||
    combat.assignments.some((entry) => entry.sourceId === id || entry.targetId === id);
  if (!affected) return;
  for (const attacker of combat.attackers) {
    if (combat.blockers.some((blocker) => blocker.attackerIds.includes(attacker.cardId)))
      attacker.blocked = true;
    if (attacker.targetId === id) attacker.targetRemoved = true;
  }
  combat.attackers = combat.attackers.filter((entry) => entry.cardId !== id);
  const attackers = new Set(combat.attackers.map((entry) => entry.cardId));
  combat.blockers = combat.blockers
    .filter((entry) => entry.cardId !== id)
    .map((entry) => ({
      ...entry,
      attackerIds: entry.attackerIds.filter((value) => attackers.has(value)),
    }));
  combat.assignments = [];
}

function validateAttachmentGraph(table: CockpitTable): void {
  for (const card of Object.values(table.cards)) {
    const seen = new Set<string>();
    let next: CardInstance | undefined = card;
    while (next?.attachedTo) {
      requireR4b(!seen.has(next.id), 'INVALID_R4B_ATTACHMENT_CYCLE');
      seen.add(next.id);
      next = table.cards[next.attachedTo];
      requireR4b(next?.zone === 'battlefield', 'INVALID_R4B_ATTACHMENT');
    }
  }
}

function sourceSnapshot(table: CockpitTable, source: CardInstance): ObjectSnapshot {
  const face = table.defs[source.defId]?.faces[source.faceIndex];
  return {
    physicalCardId: source.id,
    objectId: objectIdOf(source),
    defId: source.defId,
    zone: source.zone,
    ownerId: source.ownerId,
    controllerId: source.controllerId,
    isToken: source.isToken,
    isCommander: source.isCommander,
    faceIndex: source.faceIndex,
    tapped: source.tapped,
    counters: { ...source.counters },
    typeLine: face?.typeLine ?? '',
    power: face?.power,
    toughness: face?.toughness,
  };
}

function removeSyntheticObject(table: CockpitTable, ref: R4bObjectRef, kind: 'token' | 'copy'): void {
  const card = objectOf(table, ref);
  requireR4b(card.zone === 'battlefield' && card.isToken, 'INVALID_R4B_SYNTHETIC');
  if (kind === 'copy') requireR4b(card.isCopy === true, 'INVALID_R4B_SYNTHETIC');
  if (kind === 'token') requireR4b(card.isCopy !== true, 'INVALID_R4B_SYNTHETIC');
  removeCombatant(table, card.id);
  for (const seat of table.seats)
    for (const zone of Object.keys(seat.zones) as ZoneId[])
      seat.zones[zone] = seat.zones[zone].filter((id) => id !== card.id);
  table.grants = table.grants.filter((grant) => grant.cardId !== card.id);
  table.modifiers = table.modifiers.filter((modifier) => modifier.cardId !== card.id);
  table.linkedExiles = table.linkedExiles.filter(
    (link) =>
      link.sourcePhysicalId !== card.id && !link.exiledPhysicalIds.includes(card.id),
  );
  delete table.visibility[card.id];
  delete table.commanderCasts[card.id];
  for (const other of Object.values(table.cards))
    if (other.attachedTo === card.id) delete other.attachedTo;
  const defId = card.defId;
  delete table.cards[card.id];
  if (!Object.values(table.cards).some((other) => other.defId === defId)) delete table.defs[defId];
}

function applyLocationRepair(table: CockpitTable, operation: Extract<R4bRepairOperation, { type: 'repair.location' }>): void {
  unique(operation.objects.map((entry) => entry.cardId));
  requireR4b(['top', 'bottom'].includes(operation.position), 'INVALID_R4B_LOCATION');
  const cards = operation.objects.map((entry) => objectOf(table, entry));
  for (const [index, card] of cards.entries()) {
    requireR4b(card.zone !== 'stack', 'R4B_STACK_REPAIR_NOT_SUPPORTED');
    requireR4b(!card.isToken, 'USE_R4B_SYNTHETIC_REPAIR');
    if (operation.objects[index].stateAfter)
      requireR4b(operation.to === 'battlefield', 'INVALID_R4B_LOCATION_STATE');
  }

  const groups = new Map<string, string[]>();
  for (const card of cards) {
    for (const seat of table.seats)
      for (const zone of Object.keys(seat.zones) as ZoneId[])
        seat.zones[zone] = seat.zones[zone].filter((id) => id !== card.id);
    if (card.zone !== operation.to) {
      if (card.zone === 'battlefield') removeCombatant(table, card.id);
      card.zoneChangeCounter += 1;
      card.counters = {};
      card.damageMarked = 0;
      card.hasDeathtouchDamage = false;
      card.tapped = false;
      card.faceDown = false;
      card.manualKeywords = [];
      delete card.attachedTo;
      delete card.protectorId;
      table.grants = table.grants.filter((grant) => grant.cardId !== card.id);
      table.modifiers = table.modifiers.filter((modifier) => modifier.cardId !== card.id);
      delete table.visibility[card.id];
      for (const other of Object.values(table.cards))
        if (other.attachedTo === card.id) delete other.attachedTo;
      card.controllerId = card.ownerId;
      card.enteredTurn = operation.to === 'battlefield' ? table.turn : 0;
    }
    card.zone = operation.to;
    const owner = seatOf(table, card.ownerId);
    const group = groups.get(owner.id) ?? [];
    group.push(card.id);
    groups.set(owner.id, group);
  }
  for (const [ownerId, ids] of groups) {
    const zone = seatOf(table, ownerId).zones[operation.to];
    if (operation.position === 'top') zone.unshift(...ids);
    else zone.push(...ids);
  }

  for (const entry of operation.objects) {
    const state = entry.stateAfter;
    if (!state) continue;
    const card = cardOf(table, entry.cardId);
    if (state.tapped !== undefined) card.tapped = state.tapped;
    if (state.counters !== undefined) {
      validateCounters(state.counters);
      card.counters = { ...state.counters };
    }
    if (state.controllerId !== undefined) {
      seatOf(table, state.controllerId);
      card.controllerId = state.controllerId;
    }
    if (state.attachmentTargetId !== undefined) {
      if (state.attachmentTargetId === null) delete card.attachedTo;
      else {
        const target = cardOf(table, state.attachmentTargetId);
        requireR4b(
          target.zone === 'battlefield' && target.id !== card.id,
          'INVALID_R4B_ATTACHMENT',
        );
        card.attachedTo = target.id;
      }
    }
  }
  validateAttachmentGraph(table);
}

export function applyR4bRepair(before: CockpitTable, operation: R4bRepairOperation): CockpitTable {
  requireR4b(!before.ended, 'SESSION_ENDED');
  const table = structuredClone(before);

  switch (operation.type) {
    case 'repair.location':
      applyLocationRepair(table, operation);
      break;
    case 'repair.lifeTotal':
      integer(operation.value);
      seatOf(table, operation.seatId).life = operation.value;
      break;
    case 'repair.counterCount': {
      requireR4b(
        operation.name.trim().length > 0 &&
          operation.name.length <= 100 &&
          !['__proto__', 'constructor', 'prototype'].includes(operation.name),
        'INVALID_R4B_COUNTER',
      );
      integer(operation.value, 0);
      const target =
        operation.target.kind === 'card'
          ? objectOf(table, operation.target.object)
          : seatOf(table, operation.target.seatId);
      target.counters[operation.name] = operation.value;
      break;
    }
    case 'repair.tapState':
      unique(operation.objects.map((entry) => entry.object.cardId));
      for (const entry of operation.objects) {
        const card = objectOf(table, entry.object);
        requireR4b(card.zone === 'battlefield', 'INVALID_R4B_OBJECT_ZONE');
        card.tapped = entry.value;
      }
      break;
    case 'repair.manaPool':
      validateManaPool(operation.value);
      seatOf(table, operation.seatId).mana = { ...operation.value };
      break;
    case 'repair.damageState': {
      integer(operation.value.damageMarked, 0);
      requireR4b(
        typeof operation.value.hasDeathtouchDamage === 'boolean',
        'INVALID_R4B_DAMAGE_STATE',
      );
      const card = objectOf(table, operation.object);
      requireR4b(card.zone === 'battlefield', 'INVALID_R4B_OBJECT_ZONE');
      card.damageMarked = operation.value.damageMarked;
      card.hasDeathtouchDamage = operation.value.hasDeathtouchDamage;
      break;
    }
    case 'repair.controller': {
      const card = objectOf(table, operation.object);
      requireR4b(card.zone === 'battlefield', 'INVALID_R4B_OBJECT_ZONE');
      seatOf(table, operation.controllerId);
      if (card.controllerId !== operation.controllerId) {
        removeCombatant(table, card.id);
        card.controllerId = operation.controllerId;
        card.enteredTurn = table.turn;
      }
      break;
    }
    case 'repair.attachment': {
      const card = objectOf(table, operation.object);
      requireR4b(card.zone === 'battlefield', 'INVALID_R4B_OBJECT_ZONE');
      if (operation.target === null) delete card.attachedTo;
      else {
        const target = objectOf(table, operation.target);
        requireR4b(
          target.zone === 'battlefield' && target.id !== card.id,
          'INVALID_R4B_ATTACHMENT',
        );
        card.attachedTo = target.id;
      }
      validateAttachmentGraph(table);
      break;
    }
    case 'repair.faceState': {
      const card = objectOf(table, operation.object);
      integer(operation.faceIndex, 0, (table.defs[card.defId]?.faces.length ?? 0) - 1);
      requireR4b(typeof operation.faceDown === 'boolean', 'INVALID_R4B_FACE');
      card.faceIndex = operation.faceIndex;
      card.faceDown = operation.faceDown;
      break;
    }
    case 'repair.modifier': {
      const card = objectOf(table, operation.object);
      requireR4b(card.zone === 'battlefield', 'INVALID_R4B_OBJECT_ZONE');
      requireR4b(validId(operation.modifierId), 'INVALID_R4B_MODIFIER');
      table.modifiers = table.modifiers.filter((item) => item.id !== operation.modifierId);
      if (operation.value) {
        const value = operation.value;
        requireR4b(
          value.id === operation.modifierId &&
            value.cardId === card.id &&
            typeof value.duration === 'string' &&
            value.duration.length <= 200,
          'INVALID_R4B_MODIFIER',
        );
        integer(value.power);
        integer(value.toughness);
        const source = value.sourceId ? cardOf(table, value.sourceId) : undefined;
        table.modifiers.push({
          ...structuredClone(value),
          sourceSnapshot: source ? structuredClone(source) : undefined,
        });
      }
      break;
    }
    case 'repair.keywordGrant': {
      const card = objectOf(table, operation.object);
      requireR4b(card.zone === 'battlefield', 'INVALID_R4B_OBJECT_ZONE');
      requireR4b(validId(operation.grantId), 'INVALID_R4B_GRANT');
      const priorGranted = new Set(
        table.grants.filter((item) => item.cardId === card.id).map((item) => item.keyword),
      );
      const retained = (card.manualKeywords ?? []).filter((keyword) => !priorGranted.has(keyword));
      table.grants = table.grants.filter((item) => item.id !== operation.grantId);
      if (operation.value) {
        const value = operation.value;
        requireR4b(
          value.id === operation.grantId &&
            value.cardId === card.id &&
            value.keyword.length <= 100 &&
            value.value.length <= 100 &&
            value.duration.length <= 200,
          'INVALID_R4B_GRANT',
        );
        requireR4b(value.keyword !== 'ward' || value.value.trim().length > 0, 'INVALID_R4B_GRANT');
        const source = value.sourceId ? cardOf(table, value.sourceId) : undefined;
        table.grants.push({
          ...structuredClone(value),
          sourceSnapshot: source ? structuredClone(source) : undefined,
        });
      }
      card.manualKeywords = [
        ...new Set([
          ...retained,
          ...table.grants.filter((item) => item.cardId === card.id).map((item) => item.keyword),
        ]),
      ];
      break;
    }
    case 'repair.linkedExile': {
      requireR4b(validId(operation.linkId), 'INVALID_R4B_LINK');
      table.linkedExiles = table.linkedExiles.filter((link) => link.linkId !== operation.linkId);
      if (operation.value) {
        const source = objectOf(table, operation.value.source);
        unique(operation.value.objects.map((ref) => ref.cardId));
        const objects = operation.value.objects.map((ref) => objectOf(table, ref));
        requireR4b(objects.every((card) => card.zone === 'exile'), 'INVALID_R4B_LINK');
        requireR4b(
          operation.value.duration === undefined || operation.value.duration.length <= 200,
          'INVALID_R4B_LINK',
        );
        table.linkedExiles.push({
          linkId: operation.linkId,
          purpose: 'exiled-with-source',
          sourceObjectId: objectIdOf(source),
          sourcePhysicalId: source.id,
          exiledPhysicalIds: objects.map((card) => card.id),
          exiledObjectIds: objects.map((card) => objectIdOf(card)),
          snapshot: sourceSnapshot(table, source),
          createdSequence: table.turn,
          ...(operation.value.duration !== undefined
            ? { duration: operation.value.duration }
            : {}),
        });
      }
      break;
    }
    case 'repair.commanderCount': {
      integer(operation.value, 0);
      const card = cardOf(table, operation.cardId);
      requireR4b(card.isCommander, 'INVALID_R4B_COMMANDER');
      table.commanderCasts[card.id] = operation.value;
      break;
    }
    case 'repair.tokenDefinition': {
      const card = objectOf(table, operation.object);
      requireR4b(
        card.isToken && card.zone === 'battlefield' && !card.faceDown,
        'INVALID_R4B_TOKEN',
      );
      validateTokenCharacteristics(operation.value);
      requireR4b(
        validId(operation.definitionId) && !Object.hasOwn(table.defs, operation.definitionId),
        'INVALID_R4B_TOKEN',
      );
      const previous = table.defs[card.defId];
      requireR4b(previous, 'INVALID_R4B_TOKEN');
      const value = operation.value;
      table.defs[operation.definitionId] = {
        ...structuredClone(previous),
        scryfallId: operation.definitionId,
        oracleId: operation.definitionId,
        name: value.name,
        printedName: value.name,
        typeLine: value.typeLine,
        ...(value.text !== previous.faces[card.faceIndex]?.oracleText
          ? { keywords: [], producedMana: undefined }
          : {}),
        faces: [
          {
            ...previous.faces[card.faceIndex],
            name: value.name,
            printedName: value.name,
            typeLine: value.typeLine,
            printedTypeLine: undefined,
            oracleText: value.text,
            printedText: undefined,
            power: value.power,
            toughness: value.toughness,
            colors: [...(value.colors ?? [])],
          },
        ],
      };
      card.defId = operation.definitionId;
      card.faceIndex = 0;
      break;
    }
    case 'repair.token.create': {
      validateTokenCharacteristics(operation.value);
      requireR4b(
        validId(operation.id) &&
          !Object.hasOwn(table.cards, operation.id) &&
          !Object.hasOwn(table.defs, operation.id) &&
          !table.stack.some((entry) => entry.id === operation.id) &&
          !table.seats.some((seat) => seat.id === operation.id),
        'INVALID_R4B_TOKEN',
      );
      const owner = seatOf(table, operation.seatId);
      const value = operation.value;
      table.defs[operation.id] = {
        scryfallId: operation.id,
        oracleId: operation.id,
        name: value.name,
        printedName: value.name,
        lang: 'ja',
        layout: 'token',
        cmc: 0,
        colorIdentity: [],
        typeLine: value.typeLine,
        faces: [
          {
            name: value.name,
            typeLine: value.typeLine,
            power: value.power,
            toughness: value.toughness,
            oracleText: value.text,
            colors: [...(value.colors ?? [])],
          },
        ],
      };
      table.cards[operation.id] = {
        id: operation.id,
        defId: operation.id,
        zone: 'battlefield',
        ownerId: owner.id,
        controllerId: owner.id,
        zoneChangeCounter: 0,
        tapped: false,
        faceIndex: 0,
        faceDown: false,
        counters: {},
        damageMarked: 0,
        hasDeathtouchDamage: false,
        isToken: true,
        isCommander: false,
        enteredTurn: table.turn,
      };
      owner.zones.battlefield.push(operation.id);
      break;
    }
    case 'repair.token.remove':
      removeSyntheticObject(table, operation.object, 'token');
      break;
    case 'repair.copy.create': {
      requireR4b(
        validId(operation.id) &&
          !Object.hasOwn(table.cards, operation.id) &&
          !Object.hasOwn(table.defs, operation.id) &&
          !table.stack.some((entry) => entry.id === operation.id) &&
          !table.seats.some((seat) => seat.id === operation.id),
        'INVALID_R4B_COPY',
      );
      const owner = seatOf(table, operation.seatId);
      const source = objectOf(table, operation.source);
      requireR4b(
        source.zone === 'battlefield' && !source.faceDown,
        'INVALID_R4B_COPY',
      );
      const original = table.defs[source.defId];
      const face = structuredClone(original.faces[source.faceIndex]);
      table.defs[operation.id] = {
        ...structuredClone(original),
        scryfallId: operation.id,
        oracleId: operation.id,
        name: face.name,
        printedName: face.printedName,
        layout: 'normal',
        typeLine: face.typeLine,
        faces: [face],
      };
      table.cards[operation.id] = {
        id: operation.id,
        defId: operation.id,
        zone: 'battlefield',
        ownerId: owner.id,
        controllerId: owner.id,
        zoneChangeCounter: 0,
        tapped: false,
        faceIndex: 0,
        faceDown: false,
        counters: {},
        damageMarked: 0,
        hasDeathtouchDamage: false,
        isToken: true,
        isCommander: false,
        enteredTurn: table.turn,
        isCopy: true,
        sourceId: source.id,
      };
      owner.zones.battlefield.push(operation.id);
      break;
    }
    case 'repair.copy.remove':
      removeSyntheticObject(table, operation.object, 'copy');
      break;
    case 'repair.visibility': {
      const card = objectOf(table, operation.object);
      requireR4b(
        new Set(operation.seatIds).size === operation.seatIds.length &&
          operation.seatIds.length <= 100,
        'INVALID_R4B_VISIBILITY',
      );
      operation.seatIds.forEach((id) => seatOf(table, id));
      table.visibility[card.id] = [...operation.seatIds];
      break;
    }
    default:
      assertNever(operation);
  }

  return table;
}

export function resolveR4bCause(
  table: CockpitTable,
  request: R4bOperationRequest,
  requestId: string,
): R4bEffectiveCause {
  requireR4b(/^[a-zA-Z0-9-]{16,80}$/.test(requestId), 'INVALID_R4B_REQUEST_ID');
  const gate = classifyR4bOperation(request.operation);

  if (request.context.kind === 'resolution') {
    requireR4b(table.resolution?.id === request.context.entryId, 'STALE_INTERACTION_CONTEXT');
  } else {
    requireR4b(!table.resolution, 'STALE_INTERACTION_CONTEXT');
  }

  if (gate.kind === 'retired') throw new Error(`R4B_OPERATION_RETIRED:${gate.replacement}`);
  if (gate.kind === 'meta') {
    requireR4b(request.declaredCause === undefined, 'INVALID_R4B_CAUSE');
    return { kind: 'meta' };
  }
  if (gate.kind === 'repair') {
    requireR4b(request.declaredCause?.kind === 'correction', 'R4B_CORRECTION_REQUIRED');
    requireR4b(
      /^[a-zA-Z0-9-]{16,80}$/.test(request.declaredCause.groupId),
      'INVALID_R4B_CORRECTION_GROUP',
    );
    return { kind: 'correction', groupId: request.declaredCause.groupId };
  }
  if (gate.kind === 'effect') {
    if (request.context.kind === 'resolution') {
      requireR4b(request.declaredCause === undefined, 'INVALID_R4B_CAUSE');
      return { kind: 'resolution', entryId: request.context.entryId };
    }
    requireR4b(
      gate.manualEventCapable && request.declaredCause?.kind === 'manual-event',
      'R4B_MANUAL_EVENT_REQUIRED',
    );
    return { kind: 'manual-event', processId: requestId };
  }

  requireR4b(request.declaredCause === undefined, 'INVALID_R4B_CAUSE');
  return {
    kind: 'formal',
    ...(request.context.kind === 'resolution'
      ? { parentResolutionId: request.context.entryId }
      : {}),
  };
}

export function r4bRepairCreatesKnowledgeBarrier(
  table: CockpitTable,
  operation: R4bRepairOperation,
): boolean {
  const privateOrHidden = (ref: R4bObjectRef) => {
    const card = table.cards[ref.cardId];
    return Boolean(
      card &&
        objectIdOf(card) === ref.objectId &&
        (['hand', 'library'].includes(card.zone) || card.faceDown),
    );
  };

  switch (operation.type) {
    case 'repair.location':
      return (
        ['hand', 'library'].includes(operation.to) ||
        operation.objects.some((entry) => privateOrHidden(entry))
      );
    case 'repair.visibility': {
      const card = table.cards[operation.object.cardId];
      if (!card || objectIdOf(card) !== operation.object.objectId) return true;
      const before = new Set(table.visibility[card.id] ?? []);
      return (
        ['hand', 'library'].includes(card.zone) ||
        card.faceDown ||
        operation.seatIds.some((id) => !before.has(id))
      );
    }
    case 'repair.faceState': {
      const card = table.cards[operation.object.cardId];
      return Boolean(card?.faceDown && !operation.faceDown);
    }
    case 'repair.attachment':
      return privateOrHidden(operation.object) || Boolean(operation.target && privateOrHidden(operation.target));
    case 'repair.linkedExile':
      return Boolean(
        operation.value &&
          (privateOrHidden(operation.value.source) || operation.value.objects.some(privateOrHidden)),
      );
    case 'repair.copy.create':
      return privateOrHidden(operation.source);
    case 'repair.token.remove':
    case 'repair.copy.remove':
    case 'repair.controller':
    case 'repair.damageState':
    case 'repair.modifier':
    case 'repair.keywordGrant':
      return privateOrHidden(operation.object);
    case 'repair.lifeTotal':
    case 'repair.counterCount':
    case 'repair.tapState':
    case 'repair.manaPool':
    case 'repair.commanderCount':
    case 'repair.tokenDefinition':
    case 'repair.token.create':
      return false;
    default:
      return assertNever(operation);
  }
}
