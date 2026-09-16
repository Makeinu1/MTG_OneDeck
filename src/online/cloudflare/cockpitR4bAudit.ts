import type { CockpitTable } from '../../engine/cockpitTable';
import type { R4bObjectRef, R4bRepairOperation } from '../../engine/cockpitR4b';
import type { PreparedR4bCommit } from './cockpitR4bSession';

export type R4bSemanticActionKind =
  | 'formal'
  | 'resolution-step'
  | 'manual-event'
  | 'correction'
  | 'undo'
  | 'redo';

export interface R4bInternalSemanticAction {
  revision: number;
  actorId: string;
  kind: R4bSemanticActionKind;
  audience: 'public' | string[];
  processId?: string;
  groupId?: string;
}

export interface R4bPublicSemanticAction {
  revision: number;
  actorId: string;
  kind: R4bSemanticActionKind;
}

const privateObject = (table: CockpitTable, ref: R4bObjectRef): boolean => {
  const card = table.cards[ref.cardId];
  return Boolean(
    card &&
      `${card.id}:${card.zoneChangeCounter}` === ref.objectId &&
      (card.faceDown || ['hand', 'library'].includes(card.zone)),
  );
};

function repairContainsPrivateState(
  table: CockpitTable,
  operation: R4bRepairOperation,
): boolean {
  switch (operation.type) {
    case 'repair.location':
      return (
        ['hand', 'library'].includes(operation.to) ||
        operation.objects.some((entry) => privateObject(table, entry))
      );
    case 'repair.counterCount':
      return operation.target.kind === 'card' && privateObject(table, operation.target.object);
    case 'repair.tapState':
      return operation.objects.some((entry) => privateObject(table, entry.object));
    case 'repair.damageState':
    case 'repair.controller':
    case 'repair.faceState':
    case 'repair.modifier':
    case 'repair.keywordGrant':
    case 'repair.tokenDefinition':
    case 'repair.token.remove':
    case 'repair.copy.remove':
    case 'repair.visibility':
      return privateObject(table, operation.object);
    case 'repair.attachment':
      return (
        privateObject(table, operation.object) ||
        Boolean(operation.target && privateObject(table, operation.target))
      );
    case 'repair.linkedExile':
      return Boolean(
        operation.value &&
          (privateObject(table, operation.value.source) ||
            operation.value.objects.some((ref) => privateObject(table, ref))),
      );
    case 'repair.copy.create':
      return privateObject(table, operation.source);
    case 'repair.commanderCount': {
      const card = table.cards[operation.cardId];
      return Boolean(card && (card.faceDown || ['hand', 'library'].includes(card.zone)));
    }
    case 'repair.lifeTotal':
    case 'repair.manaPool':
    case 'repair.token.create':
      return false;
  }
}

export function semanticActionForR4bCommit(
  before: CockpitTable,
  prepared: PreparedR4bCommit,
  actorId: string,
  revision: number,
): R4bInternalSemanticAction {
  const cause = prepared.cause;
  const kind: R4bSemanticActionKind =
    cause.kind === 'resolution'
      ? 'resolution-step'
      : cause.kind === 'manual-event'
        ? 'manual-event'
        : cause.kind === 'correction'
          ? 'correction'
          : 'formal';
  const privateCorrection =
    cause.kind === 'correction' &&
    repairContainsPrivateState(before, prepared.request.operation as R4bRepairOperation);
  return {
    revision,
    actorId,
    kind,
    audience: privateCorrection ? [actorId] : 'public',
    ...(cause.kind === 'resolution' ? { processId: cause.entryId } : {}),
    ...(cause.kind === 'manual-event' ? { processId: cause.processId } : {}),
    ...(cause.kind === 'correction' ? { groupId: cause.groupId } : {}),
  };
}

export function semanticHistoryAction(
  kind: 'undo' | 'redo',
  actorId: string,
  revision: number,
): R4bInternalSemanticAction {
  return { revision, actorId, kind, audience: 'public' };
}

export function appendR4bSemanticAction(
  records: R4bInternalSemanticAction[] | undefined,
  record: R4bInternalSemanticAction,
): R4bInternalSemanticAction[] {
  return [...(records ?? []), record].slice(-32);
}

export function projectR4bSemanticActions(
  records: readonly R4bInternalSemanticAction[] | undefined,
  actorId: string,
): R4bPublicSemanticAction[] {
  return (records ?? [])
    .filter((record) => record.audience === 'public' || record.audience.includes(actorId))
    .map(({ revision, actorId: recordActorId, kind }) => ({
      revision,
      actorId: recordActorId,
      kind,
    }));
}
