import { applyTableOperation, type CockpitTable, type TableOperation } from './cockpitTable';
import { triggerTrace } from './cockpitTriggers';
import type { EventProcessRef, ZoneChangeReason, ZoneId } from './types';

export type ExpectedInteractionContext =
  | { kind: 'resolution'; entryId: string }
  | { kind: 'unbound' };

export type ManualZoneMeaning = 'move' | 'discard' | 'mill' | 'sacrifice' | 'destroy';

type ReplacedOperation = Extract<
  TableOperation,
  { type: 'resolve.begin' | 'resolve.end' | 'move' }
>;
type UnchangedOperation = Exclude<TableOperation, ReplacedOperation>;

export type R31TableOperation =
  | UnchangedOperation
  | { type: 'resolve.begin'; entryId: string }
  | { type: 'resolve.end'; entryId: string; to: ZoneId }
  | {
      type: 'move';
      ids: string[];
      to: ZoneId;
      position: 'top' | 'bottom';
      reason?: ManualZoneMeaning;
    };

export interface R31OperationRequest {
  operation: R31TableOperation;
  context: ExpectedInteractionContext;
}

export function captureExpectedInteractionContext(table: CockpitTable): ExpectedInteractionContext {
  return table.resolution
    ? { kind: 'resolution', entryId: table.resolution.id }
    : { kind: 'unbound' };
}

export function requireExpectedInteractionContext(
  table: CockpitTable,
  context: ExpectedInteractionContext,
): void {
  if (context.kind === 'resolution') {
    if (table.resolution?.id !== context.entryId)
      throw new Error('STALE_INTERACTION_CONTEXT');
    return;
  }
  if (table.resolution) throw new Error('STALE_INTERACTION_CONTEXT');
}

export function resolutionProcess(
  entryId: string,
  role: 'effect' | 'lifecycle' = 'effect',
): EventProcessRef {
  return { kind: 'resolution', id: entryId, role };
}

export function validateManualZoneMeaning(
  table: CockpitTable,
  ids: readonly string[],
  meaning: ManualZoneMeaning,
): ZoneChangeReason {
  if (!ids.length || new Set(ids).size !== ids.length) throw new Error('INVALID_ZONE_MEANING');
  const sourceZone =
    meaning === 'discard'
      ? 'hand'
      : meaning === 'mill'
        ? 'library'
        : meaning === 'sacrifice' || meaning === 'destroy'
          ? 'battlefield'
          : null;
  for (const id of ids) {
    const card = table.cards[id];
    if (!card || (sourceZone && card.zone !== sourceZone)) throw new Error('INVALID_ZONE_MEANING');
  }
  return meaning;
}

function requireAtomicResolutionTarget(table: CockpitTable, entryId: string): void {
  if (table.resolution || table.stack[0]?.id !== entryId)
    throw new Error('STALE_INTERACTION_CONTEXT');
}

/**
 * R3.1 compatibility seam. The current reducer still owns the board mutation,
 * while this adapter makes lifecycle identity and expected-context validation
 * explicit before the reducer runs. The legacy resolve payload is never exposed
 * to new callers.
 */
function traceFor(
  table: CockpitTable,
  commandId: string | undefined,
  process: EventProcessRef,
) {
  return triggerTrace(
    table,
    commandId ?? 'local-' + ((table.triggers?.sequence ?? 0) + 1),
    process,
  );
}

export function applyR31TableOperation(
  table: CockpitTable,
  request: R31OperationRequest,
  commandId?: string,
): CockpitTable {
  const { operation, context } = request;

  if (operation.type === 'resolve.begin') {
    if (context.kind !== 'unbound') throw new Error('STALE_INTERACTION_CONTEXT');
    requireExpectedInteractionContext(table, context);
    requireAtomicResolutionTarget(table, operation.entryId);
    return applyTableOperation(table, { type: 'resolve.begin' }, commandId);
  }

  if (operation.type === 'resolve.end') {
    if (context.kind !== 'resolution' || context.entryId !== operation.entryId)
      throw new Error('STALE_INTERACTION_CONTEXT');
    requireExpectedInteractionContext(table, context);
    const process = resolutionProcess(operation.entryId, 'lifecycle');
    return applyTableOperation(
      table,
      { type: 'resolve.end', to: operation.to },
      commandId,
      traceFor(table, commandId, process),
    );
  }

  if (operation.type === 'resolve.finish' || operation.type === 'resolve.fetch') {
    if (context.kind !== 'unbound') throw new Error('STALE_INTERACTION_CONTEXT');
    requireExpectedInteractionContext(table, context);
    requireAtomicResolutionTarget(table, operation.entryId);
    const process = resolutionProcess(operation.entryId, 'lifecycle');
    return applyTableOperation(
      table,
      operation,
      commandId,
      traceFor(table, commandId, process),
    );
  }

  requireExpectedInteractionContext(table, context);
  const process =
    context.kind === 'resolution' ? resolutionProcess(context.entryId, 'effect') : undefined;
  const trace = process ? traceFor(table, commandId, process) : undefined;

  if (operation.type === 'move' && operation.reason)
    validateManualZoneMeaning(table, operation.ids, operation.reason);

  return applyTableOperation(table, operation, commandId, trace);
}
