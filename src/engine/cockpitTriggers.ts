import { materializeReviewedTriggerOccurrence } from './cockpitTriggerOccurrence';
import {
  checkpointTableTriggers as checkpointTableTriggersCore,
  type TableTriggerTrace,
} from './cockpitTriggersCore';
import type { CockpitTable } from './cockpitTable';
import type { ZoneChangeReason } from './types';

export {
  blockingPublicTableTriggers,
  emptyTableTriggers,
  nextTriggerController,
  readyTableTriggers,
  tableObjectReference,
  tableObjectSnapshot,
  triggerTrace,
} from './cockpitTriggersCore';
export type {
  TableTrigger,
  TableTriggerState,
  TableTriggerTrace,
  TriggerOperation,
} from './cockpitTriggersCore';

/**
 * R5a-1 Cockpit occurrence boundary.
 *
 * The existing trigger collector remains unchanged in cockpitTriggersCore.
 * A manual-ruling candidate becomes an occurrence only after a successful
 * place/link operation. Dismiss is a review rejection and never consumes an
 * occurrence restriction. The operation itself is applied before this
 * checkpoint, so failed placement/link remains atomic and cannot consume the
 * ledger.
 */
export function checkpointTableTriggers(
  table: CockpitTable,
  trace: TableTriggerTrace | undefined,
  meaning: string,
  reason: ZoneChangeReason = 'move',
): void {
  if (!trace) return;
  const before = trace.last;
  const reviewedOccurrence =
    meaning === 'trigger.place' || meaning === 'trigger.link'
      ? table.triggers?.candidates.find((candidate) => {
          if (!candidate.requiresManualRuling || !['placed', 'linked'].includes(candidate.status))
            return false;
          return before.triggers?.candidates.some(
            (previous) =>
              previous.pendingTriggerId === candidate.pendingTriggerId && previous.status === 'pending',
          );
        })
      : undefined;

  checkpointTableTriggersCore(table, trace, meaning, reason);

  if (reviewedOccurrence && table.triggers) {
    table.triggers.ledger = materializeReviewedTriggerOccurrence(
      table.turn,
      table.triggers.ledger,
      reviewedOccurrence,
    );
  }
}
