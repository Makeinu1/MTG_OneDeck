import type { PendingTrigger, PlayerId } from './types';

export const DEFAULT_TURN_ORDER: readonly PlayerId[] = ['P1', 'OPPONENT_A'];

export interface OrderedPendingTriggers {
  status: 'ordered';
  orderedIds: string[];
}

export interface IncompletePendingTriggerOrder {
  status: 'incomplete';
  missingIds: string[];
  unknownIds: string[];
  duplicateIds: string[];
}

export type PendingTriggerOrderResult =
  | OrderedPendingTriggers
  | IncompletePendingTriggerOrder;

export function apnapPlayerOrder(
  activePlayerId: PlayerId,
  turnOrder: readonly PlayerId[] = DEFAULT_TURN_ORDER
): PlayerId[] {
  const activeIndex = turnOrder.indexOf(activePlayerId);
  if (activeIndex < 0) {
    return [...turnOrder];
  }
  return [...turnOrder.slice(activeIndex), ...turnOrder.slice(0, activeIndex)];
}

/**
 * CR 603.3b / 101.4 v1.
 *
 * Current PendingTrigger records only model ordinary triggered abilities; the
 * second 603.3b bucket ("another ability triggering") is a future extension.
 * The caller-provided order is treated as each controller's chosen relative
 * order, while controller groups are normalized to APNAP order.
 */
export function orderPendingTriggersApnap(
  pendingTriggers: readonly PendingTrigger[],
  explicitOrderIds: readonly string[],
  activePlayerId: PlayerId,
  turnOrder: readonly PlayerId[] = DEFAULT_TURN_ORDER
): PendingTriggerOrderResult {
  const pendingById = new Map(
    pendingTriggers.map((trigger) => [trigger.pendingTriggerId, trigger])
  );
  const seenIds = new Set<string>();
  const duplicateIds: string[] = [];
  const unknownIds: string[] = [];
  const explicitUniquePendingIds: string[] = [];

  for (const id of explicitOrderIds) {
    if (seenIds.has(id)) {
      duplicateIds.push(id);
      continue;
    }
    seenIds.add(id);

    if (!pendingById.has(id)) {
      unknownIds.push(id);
      continue;
    }

    explicitUniquePendingIds.push(id);
  }

  const missingIds = pendingTriggers
    .map((trigger) => trigger.pendingTriggerId)
    .filter((id) => !seenIds.has(id));

  if (
    missingIds.length > 0 ||
    unknownIds.length > 0 ||
    duplicateIds.length > 0 ||
    explicitUniquePendingIds.length !== pendingTriggers.length
  ) {
    return {
      status: 'incomplete',
      missingIds,
      unknownIds,
      duplicateIds,
    };
  }

  const idsByController = new Map<PlayerId, string[]>();
  for (const id of explicitUniquePendingIds) {
    const pending = pendingById.get(id);
    if (!pending) continue;
    const current = idsByController.get(pending.controllerId) ?? [];
    current.push(id);
    idsByController.set(pending.controllerId, current);
  }

  const orderedIds = apnapPlayerOrder(activePlayerId, turnOrder).flatMap(
    (playerId) => idsByController.get(playerId) ?? []
  );

  return {
    status: 'ordered',
    orderedIds,
  };
}
