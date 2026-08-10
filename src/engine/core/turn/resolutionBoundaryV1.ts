import { isCanonicalCoreObjectIdV2 } from '../object/objectIdV2';
import { validateCoreStackTransactionBundleV1 } from './stackTransactionAccessV1';
import type { CoreStackRemovalResultV1 } from './stackTransactionAccessV1';
import type { CoreObjectId } from '../ids';
import {
  normalizeCorePriorityPassComponentV1,
  type CorePriorityPassComponentInputV1,
  type CorePriorityPassComponentResultV1,
} from './priorityPassV1';
import { createModeNeutralCoreTurnLifecycleSliceV1 } from './turnLifecycleV1';
import { CoreTurnPriorityOperationErrorV1 } from './turnPriorityErrorV1';

type RawRecord = Record<string, unknown>;

function isPlainRecord(value: unknown): value is RawRecord {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Reflect.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function fail(
  code: ConstructorParameters<typeof CoreTurnPriorityOperationErrorV1>[0],
  message: string,
  path = '',
): never {
  throw new CoreTurnPriorityOperationErrorV1(code, message, [Object.freeze({ code, path, message })]);
}

function readDataField(root: RawRecord, field: string): unknown {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(root, field);
  } catch {
    fail('INVALID_OPERATION_INPUT', `Removal result field ${field} could not be inspected`, `/${field}`);
  }
  if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) {
    fail('INVALID_OPERATION_INPUT', `Removal result field ${field} must be enumerable data`, `/${field}`);
  }
  return descriptor.value;
}

function normalizeRemovalResult(input: unknown): CoreStackRemovalResultV1 {
  if (!isPlainRecord(input)) fail('INVALID_OPERATION_INPUT', 'Removal result must be a plain object');
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(input);
  } catch {
    fail('INVALID_OPERATION_INPUT', 'Removal result descriptors could not be inspected');
  }
  for (const key of keys) {
    if (typeof key !== 'string' || !['bundle', 'removedObjectId', 'nextObjectId'].includes(key)) {
      fail('INVALID_OPERATION_INPUT', 'Removal result contains an unknown field');
    }
  }
  const bundleInput = readDataField(input, 'bundle');
  const removedObjectId = readDataField(input, 'removedObjectId');
  const nextObjectId = readDataField(input, 'nextObjectId');
  if (!isCanonicalCoreObjectIdV2(removedObjectId)) {
    fail('INVALID_OPERATION_INPUT', 'Removal result removedObjectId is not canonical', '/removedObjectId');
  }
  if (nextObjectId !== null && !isCanonicalCoreObjectIdV2(nextObjectId)) {
    fail('INVALID_OPERATION_INPUT', 'Removal result nextObjectId is not canonical or null', '/nextObjectId');
  }
  let bundleResult: ReturnType<typeof validateCoreStackTransactionBundleV1>;
  try {
    bundleResult = validateCoreStackTransactionBundleV1(bundleInput);
  } catch {
    fail('INVALID_OPERATION_INPUT', 'Removal result bundle could not be inspected', '/bundle');
  }
  if (!bundleResult.ok) fail('INVALID_OPERATION_INPUT', 'Removal result bundle is invalid', '/bundle');
  return Object.freeze({
    bundle: bundleResult.value,
    removedObjectId,
    nextObjectId,
  });
}

function resultStillContainsObject(
  bundle: CoreStackRemovalResultV1['bundle'],
  objectId: CoreObjectId,
): boolean {
  const registry = bundle.objectRegistry;
  if (Object.prototype.hasOwnProperty.call(registry.objects, objectId)) return true;
  const zones = registry.zones;
  if (zones.shared.battlefield.includes(objectId)
    || zones.shared.stack.includes(objectId)
    || zones.shared.exile.includes(objectId)
    || zones.shared.command.includes(objectId)) return true;
  return registry.turnOrder.some((playerId) => {
    const playerZones = zones.byPlayer[playerId];
    return playerZones.library.includes(objectId)
      || playerZones.hand.includes(objectId)
      || playerZones.graveyard.includes(objectId);
  });
}

export function completeCoreResolutionAfterRemovalV1(
  input: CorePriorityPassComponentInputV1,
  removalInput: CoreStackRemovalResultV1,
): CorePriorityPassComponentResultV1 {
  const component = normalizeCorePriorityPassComponentV1(input);
  if (component.lifecycle.window.kind !== 'resolution-ready') {
    fail('WINDOW_MISMATCH', 'Resolution completion requires a resolution-ready window', '/lifecycle/window');
  }
  const capturedObjectId = component.lifecycle.window.objectId;
  const stack = component.stackBundle.objectRegistry.zones.shared.stack;
  if (stack.length === 0 || stack[stack.length - 1] !== capturedObjectId) {
    fail('TOP_STACK_MISMATCH', 'Resolution-ready object is not the current stack top', '/lifecycle/window/objectId');
  }
  const removal = normalizeRemovalResult(removalInput);
  if (removal.removedObjectId !== capturedObjectId
    || resultStillContainsObject(removal.bundle, capturedObjectId)) {
    fail('RESOLUTION_REMOVAL_MISMATCH', 'Removal result does not remove the captured stack top', '/removedObjectId');
  }

  const lifecycle = createModeNeutralCoreTurnLifecycleSliceV1({
    turnNumber: component.lifecycle.turnNumber,
    positionSequence: component.lifecycle.positionSequence,
    position: component.lifecycle.position,
    window: {
      kind: 'sba-check-required',
      priorityRecipientPlayerId: component.stackBundle.objectRegistry.activePlayerId,
      grantPriorityIfStable: true,
    },
  });
  return Object.freeze({ stackBundle: removal.bundle, lifecycle });
}
