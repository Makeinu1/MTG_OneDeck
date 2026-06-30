import { applyCommands } from './batch';
import {
  performStateBasedActions,
  type ApplyResult,
  type GameCommand,
} from './commands';
import { collectPendingTriggers } from './triggers';
import type {
  GameState,
  PendingTrigger,
  PlayerId,
  TriggerStackPlacementBucket,
} from './types';

export const DEFAULT_TURN_ORDER: readonly PlayerId[] = ['P1', 'OPPONENT_A'];
export const TRIGGER_STACK_PLACEMENT_BUCKETS: readonly TriggerStackPlacementBucket[] = [
  'ordinary',
  'ability-triggered',
];

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

export interface ManualPendingTriggerOrderRequired {
  status: 'manual-order-required';
  pendingTriggerIds: string[];
  ambiguousGroups: Array<{
    controllerId: PlayerId;
    stackPlacementBucket: TriggerStackPlacementBucket;
    pendingTriggerIds: string[];
  }>;
}

export interface PriorityReadyResult {
  status: 'priority-ready';
  state: GameState;
  warnings: string[];
}

export interface PriorityChoiceRequiredResult {
  status: 'choice-required';
  state: GameState;
  warnings: string[];
}

export interface PriorityTriggerOrderRequiredResult {
  status: 'trigger-order-required';
  state: GameState;
  warnings: string[];
  order: IncompletePendingTriggerOrder | ManualPendingTriggerOrderRequired;
}

export type PriorityBoundaryResult =
  | PriorityReadyResult
  | PriorityChoiceRequiredResult
  | PriorityTriggerOrderRequiredResult;

export interface AdvanceToPriorityOptions {
  explicitTriggerOrderIds?: readonly string[];
  maxIterations?: number;
}

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

export function triggerStackPlacementBucketOf(
  trigger: Pick<PendingTrigger, 'stackPlacementBucket'>
): TriggerStackPlacementBucket {
  return trigger.stackPlacementBucket === 'ability-triggered'
    ? 'ability-triggered'
    : 'ordinary';
}

/**
 * CR 603.3b / 101.4.
 *
 * The caller-provided order is treated as each controller's chosen relative
 * order. Stack placement is normalized to bucket -> APNAP controller ->
 * controller chosen order, and legacy triggers without a bucket are treated as
 * ordinary for snapshot compatibility.
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

  const orderedIds = TRIGGER_STACK_PLACEMENT_BUCKETS.flatMap((bucket) =>
    apnapPlayerOrder(activePlayerId, turnOrder).flatMap((playerId) =>
      explicitUniquePendingIds.filter((id) => {
        const pending = pendingById.get(id);
        return (
          pending?.controllerId === playerId &&
          triggerStackPlacementBucketOf(pending) === bucket
        );
      })
    )
  );

  return {
    status: 'ordered',
    orderedIds,
  };
}

function triggerOrderGroupKey(
  controllerId: PlayerId,
  stackPlacementBucket: TriggerStackPlacementBucket
): string {
  return `${stackPlacementBucket}:${controllerId}`;
}

export function deterministicPendingTriggerOrderForPriority(
  state: Pick<GameState, 'pendingTriggers' | 'activePlayerId'>
): string[] | null {
  const groups = new Map<
    string,
    {
      controllerId: PlayerId;
      stackPlacementBucket: TriggerStackPlacementBucket;
      pendingTriggerIds: string[];
    }
  >();

  for (const trigger of state.pendingTriggers) {
    const stackPlacementBucket = triggerStackPlacementBucketOf(trigger);
    const key = triggerOrderGroupKey(trigger.controllerId, stackPlacementBucket);
    const group = groups.get(key) ?? {
      controllerId: trigger.controllerId,
      stackPlacementBucket,
      pendingTriggerIds: [],
    };
    group.pendingTriggerIds.push(trigger.pendingTriggerId);
    groups.set(key, group);
  }

  if ([...groups.values()].some((group) => group.pendingTriggerIds.length > 1)) {
    return null;
  }

  const orderResult = orderPendingTriggersApnap(
    state.pendingTriggers,
    state.pendingTriggers.map((trigger) => trigger.pendingTriggerId),
    state.activePlayerId
  );
  return orderResult.status === 'ordered' ? orderResult.orderedIds : null;
}

function manualOrderRequired(state: GameState): ManualPendingTriggerOrderRequired {
  const groups = new Map<
    string,
    {
      controllerId: PlayerId;
      stackPlacementBucket: TriggerStackPlacementBucket;
      pendingTriggerIds: string[];
    }
  >();

  for (const trigger of state.pendingTriggers) {
    const stackPlacementBucket = triggerStackPlacementBucketOf(trigger);
    const key = triggerOrderGroupKey(trigger.controllerId, stackPlacementBucket);
    const group = groups.get(key) ?? {
      controllerId: trigger.controllerId,
      stackPlacementBucket,
      pendingTriggerIds: [],
    };
    group.pendingTriggerIds.push(trigger.pendingTriggerId);
    groups.set(key, group);
  }

  return {
    status: 'manual-order-required',
    pendingTriggerIds: state.pendingTriggers.map((trigger) => trigger.pendingTriggerId),
    ambiguousGroups: [...groups.values()].filter(
      (group) => group.pendingTriggerIds.length > 1
    ),
  };
}

function commandForPendingTrigger(pending: PendingTrigger): GameCommand {
  return {
    type: 'addAbilityToStack',
    sourceId: pending.sourceId,
    kind: 'triggered',
    ...(pending.abilityLineIndex === undefined
      ? {}
      : { abilityLineIndex: pending.abilityLineIndex }),
    sourceSnapshot: pending.sourceSnapshot,
  };
}

function pendingTriggersForIds(
  state: GameState,
  pendingTriggerIds: readonly string[]
): PendingTrigger[] {
  const pendingById = new Map(
    state.pendingTriggers.map((trigger) => [trigger.pendingTriggerId, trigger])
  );
  return pendingTriggerIds
    .map((id) => pendingById.get(id))
    .filter((trigger): trigger is PendingTrigger => trigger !== undefined);
}

function appendPendingTriggers(
  state: GameState,
  pendingTriggers: readonly PendingTrigger[]
): GameState {
  if (pendingTriggers.length === 0) {
    return state;
  }
  const existingIds = new Set(
    state.pendingTriggers.map((trigger) => trigger.pendingTriggerId)
  );
  const additions = pendingTriggers.filter(
    (trigger) => !existingIds.has(trigger.pendingTriggerId)
  );
  if (additions.length === 0) {
    return state;
  }
  return {
    ...state,
    pendingTriggers: [...state.pendingTriggers, ...additions],
  };
}

function removePendingTriggersById(
  state: GameState,
  pendingTriggerIds: readonly string[]
): GameState {
  if (pendingTriggerIds.length === 0) return state;
  const idSet = new Set(pendingTriggerIds);
  const pendingTriggers = state.pendingTriggers.filter(
    (trigger) => !idSet.has(trigger.pendingTriggerId)
  );
  return pendingTriggers.length === state.pendingTriggers.length
    ? state
    : { ...state, pendingTriggers };
}

function applySbaAndCollectTriggers(state: GameState): ApplyResult {
  const result = performStateBasedActions(state);
  return {
    state: appendPendingTriggers(
      result.state,
      collectPendingTriggers(state, result.state)
    ),
    warnings: result.warnings,
  };
}

export function placePendingTriggersOnStackAsBatch(
  state: GameState,
  orderedIds: readonly string[]
): ApplyResult {
  const pendingInOrder = pendingTriggersForIds(state, orderedIds);
  if (pendingInOrder.length === 0) {
    return { state, warnings: [] };
  }

  const result = applyCommands(state, pendingInOrder.map(commandForPendingTrigger));
  const withNewPending = appendPendingTriggers(
    result.state,
    collectPendingTriggers(state, result.state)
  );
  return {
    state: removePendingTriggersById(
      withNewPending,
      pendingInOrder.map((trigger) => trigger.pendingTriggerId)
    ),
    warnings: result.warnings,
  };
}

export function advanceToPriority(
  state: GameState,
  options: AdvanceToPriorityOptions = {}
): PriorityBoundaryResult {
  let workingState = state;
  const warnings: string[] = [];
  let explicitTriggerOrderIds = options.explicitTriggerOrderIds;
  const maxIterations = options.maxIterations ?? 20;

  for (let iterations = 0; iterations < maxIterations; iterations += 1) {
    const sbaResult = applySbaAndCollectTriggers(workingState);
    workingState = sbaResult.state;
    warnings.push(...sbaResult.warnings);

    if (workingState.pendingRuleChoices.length > 0) {
      return {
        status: 'choice-required',
        state: workingState,
        warnings,
      };
    }

    if (workingState.pendingTriggers.length === 0) {
      return {
        status: 'priority-ready',
        state: workingState,
        warnings,
      };
    }

    const orderedIds = explicitTriggerOrderIds
      ? orderPendingTriggersApnap(
          workingState.pendingTriggers,
          explicitTriggerOrderIds,
          workingState.activePlayerId
        )
      : null;
    explicitTriggerOrderIds = undefined;

    if (orderedIds?.status === 'incomplete') {
      return {
        status: 'trigger-order-required',
        state: workingState,
        warnings,
        order: orderedIds,
      };
    }

    const deterministicOrder =
      orderedIds?.status === 'ordered'
        ? orderedIds.orderedIds
        : deterministicPendingTriggerOrderForPriority(workingState);

    if (!deterministicOrder) {
      return {
        status: 'trigger-order-required',
        state: workingState,
        warnings,
        order: manualOrderRequired(workingState),
      };
    }

    const placement = placePendingTriggersOnStackAsBatch(
      workingState,
      deterministicOrder
    );
    workingState = placement.state;
    warnings.push(...placement.warnings);
  }

  return {
    status: 'trigger-order-required',
    state: workingState,
    warnings,
    order: manualOrderRequired(workingState),
  };
}
