import {
  authorizeCockpitOperation,
  cockpitOwnerPresent,
  type CockpitMultiplayer,
} from './cockpitMultiplayer';
import {
  authorizeR4FormalOperation,
  isR4FormalOperation,
  r4OperationCreatesKnowledgeBarrier,
} from './cockpitR4Authority';
import {
  validateManualZoneMeaning,
  type ExpectedInteractionContext,
} from '../../engine/cockpitR31';
import { applyR4TableOperation } from '../../engine/cockpitR4';
import {
  applyR4bRepair,
  classifyR4bOperation,
  r4bRepairCreatesKnowledgeBarrier,
  resolveR4bCause,
  type R4bDeclaredCause,
  type R4bEffectiveCause,
  type R4bObjectRef,
  type R4bOperation,
  type R4bOperationRequest,
  type R4bRepairOperation,
} from '../../engine/cockpitR4b';
import {
  applyTableOperation,
  type CockpitTable,
  type TableOperation,
} from '../../engine/cockpitTable';
import { blockingPublicTableTriggers, triggerTrace } from '../../engine/cockpitTriggers';
import { objectIdOf, type EventProcessRef } from '../../engine/types';

export const R4B_PROTOCOL_VERSION = 2 as const;

export interface R4bCommitEnvelope {
  protocolVersion: typeof R4B_PROTOCOL_VERSION;
  operation: R4bOperation;
  context: ExpectedInteractionContext;
  declaredCause?: R4bDeclaredCause;
}

export interface PreparedR4bCommit {
  request: R4bOperationRequest;
  cause: R4bEffectiveCause;
  crossesKnowledgeBarrier: boolean;
}

function actorCanReadCard(
  table: CockpitTable,
  multi: CockpitMultiplayer,
  actor: string,
  cardId: string,
): boolean {
  const card = table.cards[cardId];
  if (!card) return false;
  if (table.visibility[cardId]?.includes(actor)) return true;
  if (!['hand', 'library'].includes(card.zone)) return true;
  if (card.zone === 'hand' && card.ownerId === actor) return true;
  const peek = multi.members[actor]?.peek;
  if (!peek || peek.seatId !== card.ownerId || peek.zone !== card.zone) return false;
  if (card.zone !== 'library' || peek.count === undefined) return true;
  const library = table.seats.find((seat) => seat.id === card.ownerId)?.zones.library ?? [];
  const index = library.indexOf(cardId);
  return index >= 0 && index < peek.count;
}

function actorCanReadFace(table: CockpitTable, actor: string, cardId: string): boolean {
  const card = table.cards[cardId];
  if (!card) return false;
  if (!card.faceDown) return true;
  return card.controllerId === actor || Boolean(table.visibility[cardId]?.includes(actor));
}

function validObjectRef(table: CockpitTable, ref: R4bObjectRef): boolean {
  const card = table.cards[ref.cardId];
  return Boolean(card && objectIdOf(card) === ref.objectId);
}

function actorCanAddressObject(
  table: CockpitTable,
  multi: CockpitMultiplayer,
  actor: string,
  ref: R4bObjectRef,
  requireFace = false,
): boolean {
  if (!validObjectRef(table, ref)) return false;
  return (
    actorCanReadCard(table, multi, actor, ref.cardId) &&
    (!requireFace || actorCanReadFace(table, actor, ref.cardId))
  );
}

function repairRefs(operation: R4bRepairOperation): R4bObjectRef[] {
  switch (operation.type) {
    case 'repair.location':
      return operation.objects;
    case 'repair.counterCount':
      return operation.target.kind === 'card' ? [operation.target.object] : [];
    case 'repair.tapState':
      return operation.objects.map((entry) => entry.object);
    case 'repair.damageState':
    case 'repair.controller':
    case 'repair.faceState':
    case 'repair.modifier':
    case 'repair.keywordGrant':
    case 'repair.tokenDefinition':
    case 'repair.token.remove':
    case 'repair.copy.remove':
    case 'repair.visibility':
      return [operation.object];
    case 'repair.attachment':
      return [operation.object, ...(operation.target ? [operation.target] : [])];
    case 'repair.linkedExile':
      return operation.value
        ? [operation.value.source, ...operation.value.objects]
        : [];
    case 'repair.copy.create':
      return [operation.source];
    case 'repair.lifeTotal':
    case 'repair.manaPool':
    case 'repair.commanderCount':
    case 'repair.token.create':
      return [];
  }
}

function authorizeRepair(
  table: CockpitTable,
  multi: CockpitMultiplayer,
  actor: string,
  operation: R4bRepairOperation,
): boolean {
  if (!repairRefs(operation).every((ref) => actorCanAddressObject(table, multi, actor, ref)))
    return false;

  if (operation.type === 'repair.commanderCount') {
    const card = table.cards[operation.cardId];
    if (!card || !actorCanReadCard(table, multi, actor, card.id)) return false;
  }

  if (operation.type === 'repair.visibility') {
    const card = table.cards[operation.object.cardId];
    if (!card) return false;
    const before = new Set(table.visibility[card.id] ?? []);
    const addsAudience = operation.seatIds.some((seatId) => !before.has(seatId));
    if (
      addsAudience &&
      (['hand', 'library'].includes(card.zone) || card.faceDown) &&
      card.ownerId !== actor &&
      card.controllerId !== actor
    )
      return false;
  }

  if (operation.type === 'repair.faceState')
    return actorCanReadFace(table, actor, operation.object.cardId);

  if (operation.type === 'repair.copy.create')
    return actorCanAddressObject(table, multi, actor, operation.source, true);

  return true;
}

function authorizeEffectObjects(
  table: CockpitTable,
  multi: CockpitMultiplayer,
  actor: string,
  operation: R4bOperation,
): boolean {
  switch (operation.type) {
    case 'move':
      return operation.ids.every((id) => actorCanReadCard(table, multi, actor, id));
    case 'damage':
      return !operation.sourceId || actorCanReadCard(table, multi, actor, operation.sourceId);
    case 'modifier':
      return !operation.modifier.sourceId || actorCanReadCard(table, multi, actor, operation.modifier.sourceId);
    case 'keyword':
      return !operation.grant.sourceId || actorCanReadCard(table, multi, actor, operation.grant.sourceId);
    case 'link':
      return actorCanReadCard(table, multi, actor, operation.sourceId) &&
        operation.ids.every((id) => actorCanReadCard(table, multi, actor, id));
    case 'copyPermanent':
      return actorCanReadCard(table, multi, actor, operation.sourceId) &&
        actorCanReadFace(table, actor, operation.sourceId);
    case 'face':
      return actorCanReadCard(table, multi, actor, operation.cardId) &&
        actorCanReadFace(table, actor, operation.cardId);
    case 'visibility':
      return operation.ids.every((id) => actorCanReadCard(table, multi, actor, id));
    default:
      return true;
  }
}

function baseMultiplayerAuthority(
  table: CockpitTable,
  multi: CockpitMultiplayer,
  actor: string,
  now: number,
): boolean {
  return Boolean(
    cockpitOwnerPresent(multi, now) &&
      multi.started &&
      !table.ended &&
      actor === multi.masterId &&
      !table.seats.find((seat) => seat.id === actor)?.eliminated,
  );
}

function existingOperationAuthority(
  table: CockpitTable,
  multi: CockpitMultiplayer,
  actor: string,
  operation: R4bOperation,
  now: number,
): boolean {
  if (operation.type === 'commander.moveToCommand') {
    const card = table.cards[operation.cardId];
    return Boolean(
      card?.isCommander &&
        objectIdOf(card) === operation.objectId &&
        card.zone !== 'stack' &&
        actorCanReadCard(table, multi, actor, card.id),
    );
  }
  const r4Formal = authorizeR4FormalOperation(table, multi, actor, operation as never, now);
  if (r4Formal !== undefined) return r4Formal;
  return authorizeCockpitOperation(table, multi, actor, operation as TableOperation, now);
}

function operationCreatesKnowledgeBarrier(
  table: CockpitTable,
  operation: R4bOperation,
): boolean {
  if (isR4FormalOperation(operation as never))
    return r4OperationCreatesKnowledgeBarrier(table, operation as never);
  switch (operation.type) {
    case 'draw':
    case 'shuffle':
    case 'randomDiscard':
    case 'mulligan':
    case 'arrange':
    case 'resolve.fetch':
    case 'shortcut':
    case 'turn.ready':
      return true;
    case 'phase':
      return table.phase === 'upkeep';
    case 'visibility':
      return operation.ids.some((id) => {
        const card = table.cards[id];
        if (!card) return false;
        const before = new Set(table.visibility[id] ?? []);
        const addsAudience = operation.seatIds.some((seatId) => !before.has(seatId));
        return addsAudience && (['hand', 'library'].includes(card.zone) || card.faceDown);
      });
    case 'move':
      return operation.ids.some((id) => ['hand', 'library'].includes(table.cards[id]?.zone ?? ''));
    case 'playLand':
      return table.cards[operation.cardId]?.zone === 'hand';
    case 'cast':
      return (
        table.cards[operation.cardId]?.zone === 'hand' ||
        operation.paymentPlan.some(
          (command) =>
            command.type === 'discard' ||
            (command.type === 'moveCard' &&
              ['hand', 'library'].includes(table.cards[command.cardId]?.zone ?? '')),
        )
      );
    case 'activate':
      return operation.paymentPlan.some(
        (command) =>
          command.type === 'discard' ||
          (command.type === 'moveCard' &&
            ['hand', 'library'].includes(table.cards[command.cardId]?.zone ?? '')),
      );
    case 'cleanup':
      return operation.discardIds.length > 0;
    case 'commander.moveToCommand':
      return ['hand', 'library'].includes(table.cards[operation.cardId]?.zone ?? '');
    default:
      return false;
  }
}

export function prepareR4bCommit(
  table: CockpitTable,
  multi: CockpitMultiplayer | undefined,
  actor: string,
  envelope: R4bCommitEnvelope,
  requestId: string,
  now: number,
): PreparedR4bCommit {
  const request: R4bOperationRequest = {
    operation: envelope.operation,
    context: envelope.context,
    ...(envelope.declaredCause ? { declaredCause: envelope.declaredCause } : {}),
  };
  const cause = resolveR4bCause(table, request, requestId);
  const gate = classifyR4bOperation(envelope.operation);

  if (gate.kind === 'formal' && gate.family === 'stack-effect' && envelope.context.kind !== 'resolution')
    throw new Error('R4B_STACK_EFFECT_REQUIRES_RESOLUTION');

  if (cause.kind === 'manual-event' && blockingPublicTableTriggers(table).length)
    throw new Error('R4B_BLOCKING_TRIGGER');

  if (multi) {
    const pregameFormal =
      !multi.started &&
      gate.kind === 'formal' &&
      (envelope.operation.type === 'keep' || envelope.operation.type === 'mulligan');
    if (pregameFormal) {
      if (!existingOperationAuthority(table, multi, actor, envelope.operation, now))
        throw new Error('R4B_NOT_AUTHORIZED');
    } else {
      if (!baseMultiplayerAuthority(table, multi, actor, now))
        throw new Error('R4B_NOT_AUTHORIZED');
      if (cause.kind === 'correction') {
        if (!multi.holds.length) throw new Error('R4B_CORRECTION_REQUIRES_HOLD');
        if (
          gate.kind !== 'repair' ||
          !authorizeRepair(table, multi, actor, envelope.operation as R4bRepairOperation)
        )
          throw new Error('R4B_NOT_AUTHORIZED');
      } else {
        if (multi.holds.length) throw new Error('R4B_HOLD_BLOCKS_OPERATION');
        if (
          gate.kind === 'effect' &&
          !authorizeEffectObjects(table, multi, actor, envelope.operation)
        )
          throw new Error('R4B_NOT_AUTHORIZED');
        if (
          gate.kind === 'formal' &&
          !existingOperationAuthority(table, multi, actor, envelope.operation, now)
        )
          throw new Error('R4B_NOT_AUTHORIZED');
      }
    }
  }

  return {
    request,
    cause,
    crossesKnowledgeBarrier:
      gate.kind === 'repair'
        ? r4bRepairCreatesKnowledgeBarrier(table, envelope.operation as R4bRepairOperation)
        : operationCreatesKnowledgeBarrier(table, envelope.operation),
  };
}

function manualEventProcessRef(id: string): EventProcessRef {
  return { kind: 'manual-event', id };
}

function applyR4bManualEvent(
  before: CockpitTable,
  prepared: PreparedR4bCommit,
  requestId: string,
): CockpitTable {
  const operation = prepared.request.operation as TableOperation;
  if (operation.type === 'move' && operation.reason)
    validateManualZoneMeaning(before, operation.ids, operation.reason);
  return applyTableOperation(
    before,
    operation,
    requestId,
    triggerTrace(before, requestId, manualEventProcessRef(prepared.cause.kind === 'manual-event' ? prepared.cause.processId : requestId)),
  );
}

export function applyPreparedR4bCommit(
  before: CockpitTable,
  prepared: PreparedR4bCommit,
  requestId: string,
): CockpitTable {
  if (prepared.cause.kind === 'correction')
    return applyR4bRepair(before, prepared.request.operation as R4bRepairOperation);

  if (prepared.cause.kind === 'manual-event')
    return applyR4bManualEvent(before, prepared, requestId);

  if (prepared.request.operation.type === 'commander.moveToCommand') {
    const card = before.cards[prepared.request.operation.cardId];
    if (
      !card ||
      !card.isCommander ||
      objectIdOf(card) !== prepared.request.operation.objectId ||
      card.zone === 'stack'
    )
      throw new Error('INVALID_R4B_COMMANDER_MOVE');
    const process = {
      kind: 'action' as const,
      id: requestId,
      actionType: 'other-formal' as const,
      role: 'action' as const,
      ...(prepared.request.context.kind === 'resolution'
        ? { parentResolutionId: prepared.request.context.entryId }
        : {}),
    };
    return applyTableOperation(
      before,
      { type: 'move', ids: [card.id], to: 'command', position: 'top' },
      requestId,
      triggerTrace(before, requestId, process),
    );
  }

  return applyR4TableOperation(
    before,
    {
      operation: prepared.request.operation as never,
      context: prepared.request.context,
    },
    requestId,
  );
}
