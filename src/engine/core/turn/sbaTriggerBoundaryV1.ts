import {
  analyzeCorePendingTriggerPlacementV1,
} from './triggerApnapV1';
import {
  createModeNeutralCoreTurnLifecycleSliceV1,
} from './turnLifecycleV1';
import type { CoreTurnWindowV1 } from './turnLifecycleV1';
import {
  CoreTurnPriorityOperationErrorV1,
} from './turnPriorityErrorV1';
import {
  createCoreTurnPriorityBundleV1,
  validateCoreTurnPriorityBundleV1,
} from './turnPriorityBundleV1';
import type { CoreTurnPriorityBundleV1 } from './turnPriorityBundleV1';

export type CoreSbaCheckOutcomeV1 = Readonly<{
  readonly actionsWereApplied: boolean;
}>;

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

function readOutcome(input: unknown): CoreSbaCheckOutcomeV1 {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    operationFailure('INVALID_OPERATION_INPUT', 'SBA outcome must be a plain record', '/outcome');
  }
  const keys = Reflect.ownKeys(input);
  if (keys.length !== 1 || keys[0] !== 'actionsWereApplied') {
    operationFailure('INVALID_OPERATION_INPUT', 'SBA outcome must contain exactly actionsWereApplied', '/outcome');
  }
  const descriptor = Object.getOwnPropertyDescriptor(input, 'actionsWereApplied');
  if (descriptor === undefined || descriptor.enumerable !== true
    || !Object.prototype.hasOwnProperty.call(descriptor, 'value')
    || typeof descriptor.value !== 'boolean') {
    operationFailure('INVALID_OPERATION_INPUT', 'actionsWereApplied must be a boolean data property', '/outcome/actionsWereApplied');
  }
  return { actionsWereApplied: descriptor.value };
}

function replaceWindow(
  bundle: CoreTurnPriorityBundleV1,
  window: CoreTurnWindowV1,
): CoreTurnPriorityBundleV1 {
  const lifecycle = createModeNeutralCoreTurnLifecycleSliceV1({
    turnNumber: bundle.lifecycle.turnNumber,
    positionSequence: bundle.lifecycle.positionSequence,
    position: bundle.lifecycle.position,
    window,
  });
  return createCoreTurnPriorityBundleV1({
    stackBundle: bundle.stackBundle,
    pendingTriggers: bundle.pendingTriggers,
    lifecycle,
  });
}

export function recordCoreSbaCheckOutcomeV1(
  input: CoreTurnPriorityBundleV1,
  outcomeInput: CoreSbaCheckOutcomeV1,
): CoreTurnPriorityBundleV1 {
  const bundle = normalizeBundle(input);
  const outcome = readOutcome(outcomeInput);
  const current = bundle.lifecycle.window;
  if (current.kind !== 'sba-check-required') {
    operationFailure('WINDOW_MISMATCH', 'SBA outcome requires an SBA-check-required window', '/lifecycle/window');
  }

  if (outcome.actionsWereApplied) {
    const nextWindow: CoreTurnWindowV1 = {
      kind: 'sba-check-required',
      priorityRecipientPlayerId: current.priorityRecipientPlayerId,
      grantPriorityIfStable: current.grantPriorityIfStable || bundle.lifecycle.position.step === 'cleanup',
    };
    return replaceWindow(bundle, nextWindow);
  }

  if (bundle.pendingTriggers.pendingObjectIds.length > 0) {
    const analysis = analyzeCorePendingTriggerPlacementV1(
      bundle.stackBundle.objectRegistry,
      bundle.pendingTriggers,
    );
    return replaceWindow(bundle, {
      kind: 'trigger-order-required',
      priorityRecipientPlayerId: current.priorityRecipientPlayerId,
      grantPriorityIfStable: true,
      pendingObjectIds: bundle.pendingTriggers.pendingObjectIds,
      ambiguousGroups: analysis.groups,
    });
  }

  if (current.grantPriorityIfStable) {
    return replaceWindow(bundle, {
      kind: 'priority',
      cycleStartPlayerId: current.priorityRecipientPlayerId,
      holderPlayerId: current.priorityRecipientPlayerId,
      passedPlayerIds: [],
    });
  }
  return replaceWindow(bundle, { kind: 'turn-advance-ready' });
}
