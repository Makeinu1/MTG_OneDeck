import type { CoreObjectId } from '../ids';
import {
  commitCoreSyntheticStackObjectV1,
} from '../stack/transaction/syntheticStackCommitV1';
import {
  CoreStackTransactionErrorV1,
} from '../stack/transaction/stackTransactionErrorV1';
import {
  appendCorePendingTriggeredAbilitiesV1 as appendCorePendingTriggeredAbilitiesComponentV1,
  createModeNeutralCorePendingTriggerSliceV1,
} from './pendingTriggerV1';
import {
  analyzeCorePendingTriggerPlacementV1,
  validateCorePendingTriggerOrderV1,
} from './triggerApnapV1';
import {
  createCoreTurnPriorityBundleV1,
  validateCoreTurnPriorityBundleV1,
} from './turnPriorityBundleV1';
import type { CoreTurnPriorityBundleV1 } from './turnPriorityBundleV1';
import {
  createModeNeutralCoreTurnLifecycleSliceV1,
} from './turnLifecycleV1';
import {
  CoreTurnPriorityOperationErrorV1,
} from './turnPriorityErrorV1';

function operationFailure(
  code: ConstructorParameters<typeof CoreTurnPriorityOperationErrorV1>[0],
  message: string,
  path = '',
): never {
  throw new CoreTurnPriorityOperationErrorV1(code, message, [Object.freeze({ code, path, message })]);
}

function normalizeBundle(input: unknown): CoreTurnPriorityBundleV1 {
  const result = validateCoreTurnPriorityBundleV1(input);
  if (!result.ok) operationFailure('INVALID_TURN_PRIORITY_BUNDLE', 'Turn priority bundle is invalid');
  return result.value;
}

export function analyzeCorePendingTriggerPlacementOnBundleV1(
  input: CoreTurnPriorityBundleV1,
) {
  const bundle = normalizeBundle(input);
  return analyzeCorePendingTriggerPlacementV1(bundle.stackBundle.objectRegistry, bundle.pendingTriggers);
}

export function appendCorePendingTriggeredAbilitiesToBundleV1(
  input: CoreTurnPriorityBundleV1,
  additions: Parameters<typeof import('./pendingTriggerV1')['appendCorePendingTriggeredAbilitiesV1']>[2],
): CoreTurnPriorityBundleV1 {
  const bundle = normalizeBundle(input);
  try {
    const pendingTriggers = appendCorePendingTriggeredAbilitiesComponentV1(
      bundle.stackBundle.objectRegistry,
      bundle.pendingTriggers,
      additions,
    );
    return createCoreTurnPriorityBundleV1({
      stackBundle: bundle.stackBundle,
      pendingTriggers,
      lifecycle: bundle.lifecycle,
    });
  } catch (error: unknown) {
    if (error instanceof CoreTurnPriorityOperationErrorV1) throw error;
    operationFailure('TRIGGER_COMMIT_FAILED', 'Pending trigger append failed', '/additions');
  }
}

export function placeCorePendingTriggersOnStackV1(
  input: CoreTurnPriorityBundleV1,
  orderedObjectIds: readonly CoreObjectId[],
): CoreTurnPriorityBundleV1 {
  const bundle = normalizeBundle(input);
  const window = bundle.lifecycle.window;
  if (window.kind !== 'trigger-order-required') {
    operationFailure('WINDOW_MISMATCH', 'Trigger placement requires a trigger-order-required window', '/lifecycle/window');
  }
  const order = validateCorePendingTriggerOrderV1(
    bundle.stackBundle.objectRegistry,
    bundle.pendingTriggers,
    orderedObjectIds,
  );
  if (!order.ok) operationFailure('TRIGGER_ORDER_INVALID', 'Ordered pending IDs are invalid', '/orderedObjectIds');

  let stackBundle = bundle.stackBundle;
  try {
    for (const objectId of order.value) {
      const pending = bundle.pendingTriggers.byObject[objectId];
      const result = commitCoreSyntheticStackObjectV1(stackBundle, {
        objectId,
        object: pending.object,
        announcement: pending.announcement,
      });
      stackBundle = result.bundle;
    }
  } catch (error: unknown) {
    if (error instanceof CoreStackTransactionErrorV1) {
      operationFailure('TRIGGER_COMMIT_FAILED', 'Pending trigger stack commit failed', '/orderedObjectIds');
    }
    operationFailure('TRIGGER_COMMIT_FAILED', 'Pending trigger stack commit failed', '/orderedObjectIds');
  }

  const pendingTriggers = createModeNeutralCorePendingTriggerSliceV1(
    stackBundle.objectRegistry,
    { pendingObjectIds: [], byObject: {} },
  );
  const lifecycle = createModeNeutralCoreTurnLifecycleSliceV1({
    turnNumber: bundle.lifecycle.turnNumber,
    positionSequence: bundle.lifecycle.positionSequence,
    position: bundle.lifecycle.position,
    window: {
      kind: 'sba-check-required' as const,
      priorityRecipientPlayerId: window.priorityRecipientPlayerId,
      grantPriorityIfStable: true as const,
    },
  });
  return createCoreTurnPriorityBundleV1({ stackBundle, pendingTriggers, lifecycle });
}

export const appendCorePendingTriggeredAbilitiesV1 = appendCorePendingTriggeredAbilitiesToBundleV1;
