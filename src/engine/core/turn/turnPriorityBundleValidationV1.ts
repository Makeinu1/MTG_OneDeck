import type { CoreObjectId, CorePlayerId } from '../ids';
import {
  validateCoreStackTransactionBundleV1,
} from './stackTransactionAccessV1';
import type { CoreStackTransactionBundleV1 } from './stackTransactionAccessV1';
import {
  validateModeNeutralCorePendingTriggerSliceV1,
} from './pendingTriggerValidationV1';
import type { ModeNeutralCorePendingTriggerSliceV1 } from './pendingTriggerV1';
import {
  analyzeCorePendingTriggerPlacementV1,
} from './triggerApnapV1';
import {
  validateModeNeutralCoreTurnLifecycleSliceV1,
} from './turnLifecycleValidationV1';
import type {
  CorePendingTriggerOrderGroupV1,
  CoreTurnLifecycleSliceV1,
} from './turnLifecycleV1';
import type { CoreTurnPriorityBundleV1 } from './turnPriorityBundleV1';

export type CoreTurnPriorityBundleValidationCodeV1 =
  | 'INVALID_ROOT'
  | 'INVALID_STACK_BUNDLE'
  | 'INVALID_PENDING_TRIGGER_SLICE'
  | 'INVALID_LIFECYCLE_SLICE'
  | 'MISSING_FIELD'
  | 'UNKNOWN_FIELD'
  | 'INVALID_TYPE'
  | 'INVALID_LITERAL'
  | 'INVALID_ID'
  | 'INVALID_INTEGER'
  | 'INVALID_ARRAY'
  | 'INVALID_ORDER'
  | 'DUPLICATE_VALUE'
  | 'INVALID_POSITION'
  | 'INVALID_WINDOW_FOR_POSITION'
  | 'INVALID_PRIORITY_PLAYER'
  | 'INVALID_PASS_SEQUENCE'
  | 'RESOLUTION_OBJECT_MISMATCH'
  | 'PENDING_TRIGGER_SET_MISMATCH'
  | 'PENDING_TRIGGER_KIND_MISMATCH'
  | 'PENDING_TRIGGER_COLLISION'
  | 'INVALID_TRIGGER_ORDER'
  | 'INVALID_CLEANUP_REQUIREMENT'
  | 'CROSS_SLICE_MISMATCH';

export type CoreTurnPriorityBundleValidationIssueV1 = Readonly<{
  readonly code: CoreTurnPriorityBundleValidationCodeV1;
  readonly path: string;
  readonly message: string;
}>;

export type CoreTurnPriorityBundleValidationResultV1 =
  | Readonly<{ readonly ok: true; readonly value: CoreTurnPriorityBundleV1 }>
  | Readonly<{
      readonly ok: false;
      readonly issues: readonly CoreTurnPriorityBundleValidationIssueV1[];
    }>;

type RawRecord = Record<string, unknown>;
type Issue = CoreTurnPriorityBundleValidationIssueV1;

const ROOT_FIELDS = ['stackBundle', 'pendingTriggers', 'lifecycle'] as const;

function issue(
  code: CoreTurnPriorityBundleValidationCodeV1,
  path: string,
  message: string,
): Issue {
  return Object.freeze({ code, path, message });
}

function sortedIssues(issues: readonly Issue[]): readonly Issue[] {
  return Object.freeze(issues.map((current) => Object.freeze({ ...current })));
}

function isPlainRecord(value: unknown): value is RawRecord {
  try {
    return value !== null
      && typeof value === 'object'
      && !Array.isArray(value)
      && (Reflect.getPrototypeOf(value) === Object.prototype || Reflect.getPrototypeOf(value) === null);
  } catch {
    return false;
  }
}

function readRoot(input: unknown): Readonly<{
  readonly stackBundle: unknown;
  readonly pendingTriggers: unknown;
  readonly lifecycle: unknown;
}> | null {
  if (!isPlainRecord(input)) return null;
  const values = Object.create(null) as RawRecord;
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(input);
  } catch {
    return null;
  }
  for (const key of keys) {
    if (typeof key !== 'string' || !ROOT_FIELDS.includes(key as typeof ROOT_FIELDS[number])) return null;
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (descriptor === undefined || descriptor.enumerable !== true
      || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null;
    values[key] = descriptor.value;
  }
  if (ROOT_FIELDS.some((field) => !Object.prototype.hasOwnProperty.call(values, field))) return null;
  return {
    stackBundle: values.stackBundle,
    pendingTriggers: values.pendingTriggers,
    lifecycle: values.lifecycle,
  };
}

function mapNestedPath(path: string): string {
  if (path === '') return '';
  if (path.startsWith('$')) return path.slice(1).replaceAll('.', '/');
  return path;
}

function isSeated(
  registry: CoreStackTransactionBundleV1['objectRegistry'],
  playerId: CorePlayerId,
): boolean {
  return Object.prototype.hasOwnProperty.call(registry.players, playerId);
}

function validatePrioritySequence(
  lifecycle: CoreTurnLifecycleSliceV1,
  registry: CoreStackTransactionBundleV1['objectRegistry'],
  issues: Issue[],
): void {
  if (lifecycle.window.kind !== 'priority') return;
  const { cycleStartPlayerId, holderPlayerId, passedPlayerIds } = lifecycle.window;
  if (!isSeated(registry, cycleStartPlayerId)
    || !isSeated(registry, holderPlayerId)
    || passedPlayerIds.some((playerId) => !isSeated(registry, playerId))) {
    issues.push(issue('INVALID_PRIORITY_PLAYER', '/lifecycle/window', 'Priority players must be seated'));
    return;
  }
  const startIndex = registry.turnOrder.indexOf(cycleStartPlayerId);
  const holderIndex = registry.turnOrder.indexOf(holderPlayerId);
  if (startIndex < 0 || holderIndex < 0) return;
  const expected = passedPlayerIds.map((_, index) =>
    registry.turnOrder[(startIndex + index) % registry.turnOrder.length]);
  const expectedHolder = registry.turnOrder[(startIndex + passedPlayerIds.length) % registry.turnOrder.length];
  if (new Set(passedPlayerIds).size !== passedPlayerIds.length
    || passedPlayerIds.includes(holderPlayerId)
    || passedPlayerIds.some((playerId, index) => playerId !== expected[index])
    || holderPlayerId !== expectedHolder
    || passedPlayerIds.length >= registry.turnOrder.length) {
    issues.push(issue('INVALID_PASS_SEQUENCE', '/lifecycle/window/passedPlayerIds', 'Passed players must be the contiguous turn-order interval before the holder'));
  }
}

function sameIds(left: readonly CoreObjectId[], right: readonly CoreObjectId[]): boolean {
  return left.length === right.length && left.every((objectId, index) => objectId === right[index]);
}

function sameGroups(
  left: readonly CorePendingTriggerOrderGroupV1[],
  right: readonly CorePendingTriggerOrderGroupV1[],
): boolean {
  return left.length === right.length && left.every((group, index) => {
    const expected = right[index];
    return group.stackPlacementBucket === expected.stackPlacementBucket
      && group.controllerPlayerId === expected.controllerPlayerId
      && sameIds(group.pendingObjectIds, expected.pendingObjectIds);
  });
}

function validateCrossSlice(
  stackBundle: CoreStackTransactionBundleV1,
  pendingTriggers: ModeNeutralCorePendingTriggerSliceV1,
  lifecycle: CoreTurnLifecycleSliceV1,
): readonly Issue[] {
  const issues: Issue[] = [];
  const registry = stackBundle.objectRegistry;
  const window = lifecycle.window;
  const seated = (playerId: CorePlayerId, path: string): void => {
    if (!isSeated(registry, playerId)) issues.push(issue('INVALID_PRIORITY_PLAYER', path, 'Player must be seated'));
  };

  if (window.kind === 'turn-based-action-required') seated(window.playerId, '/lifecycle/window/playerId');
  if (window.kind === 'sba-check-required') {
    seated(window.priorityRecipientPlayerId, '/lifecycle/window/priorityRecipientPlayerId');
  }
  if (window.kind === 'trigger-order-required') {
    seated(window.priorityRecipientPlayerId, '/lifecycle/window/priorityRecipientPlayerId');
    if (!sameIds(window.pendingObjectIds, pendingTriggers.pendingObjectIds)) {
      issues.push(issue('PENDING_TRIGGER_SET_MISMATCH', '/lifecycle/window/pendingObjectIds', 'Trigger window IDs must equal pendingObjectIds in order'));
    }
    try {
      const expected = analyzeCorePendingTriggerPlacementV1(registry, pendingTriggers).groups;
      if (!sameGroups(window.ambiguousGroups, expected)) {
        issues.push(issue('INVALID_TRIGGER_ORDER', '/lifecycle/window/ambiguousGroups', 'Trigger groups must match APNAP analysis'));
      }
    } catch {
      issues.push(issue('CROSS_SLICE_MISMATCH', '/lifecycle/window/ambiguousGroups', 'Trigger groups could not be cross-validated'));
    }
  }
  if (window.kind === 'priority') validatePrioritySequence(lifecycle, registry, issues);
  if (window.kind === 'resolution-ready') {
    const stack = registry.zones.shared.stack;
    if (stack.length === 0 || stack[stack.length - 1] !== window.objectId) {
      issues.push(issue('RESOLUTION_OBJECT_MISMATCH', '/lifecycle/window/objectId', 'Resolution object must equal the stack top'));
    }
  }
  if (window.kind === 'position-advance-ready' || window.kind === 'cleanup-repeat-ready') {
    if (registry.zones.shared.stack.length !== 0) {
      issues.push(issue('CROSS_SLICE_MISMATCH', '/stackBundle/objectRegistry/zones/shared/stack', 'This window requires an empty stack'));
    }
  }
  const isCleanup = lifecycle.position.phase === 'ending' && lifecycle.position.step === 'cleanup';
  if (window.kind === 'turn-advance-ready') {
    if (!isCleanup || registry.zones.shared.stack.length !== 0 || pendingTriggers.pendingObjectIds.length !== 0) {
      issues.push(issue('INVALID_CLEANUP_REQUIREMENT', '/lifecycle/window', 'Turn advance requires cleanup, empty stack, and empty pending triggers'));
    }
  }
  if (window.kind === 'cleanup-discard-required' || window.kind === 'cleanup-state-actions-required') {
    if (!isCleanup || window.playerId !== registry.activePlayerId) {
      issues.push(issue('INVALID_CLEANUP_REQUIREMENT', '/lifecycle/window/playerId', 'Cleanup player must be the Registry active player'));
    }
  }
  return issues;
}

export function validateCoreTurnPriorityBundleV1(
  input: unknown,
): CoreTurnPriorityBundleValidationResultV1 {
  const root = readRoot(input);
  if (root === null) {
    return Object.freeze({ ok: false, issues: Object.freeze([issue('INVALID_ROOT', '', 'Bundle must contain exactly stackBundle, pendingTriggers, and lifecycle')]) });
  }

  const issues: Issue[] = [];
  let stackBundle: CoreStackTransactionBundleV1 | null = null;
  let pendingTriggers: ModeNeutralCorePendingTriggerSliceV1 | null = null;
  let lifecycle: CoreTurnLifecycleSliceV1 | null = null;

  const stackResult = validateCoreStackTransactionBundleV1(root.stackBundle);
  if (!stackResult.ok) {
    issues.push(issue('INVALID_STACK_BUNDLE', '/stackBundle', 'Stack transaction bundle is invalid'));
  } else {
    stackBundle = stackResult.value;
  }

  if (stackBundle !== null) {
    const pendingResult = validateModeNeutralCorePendingTriggerSliceV1(
      stackBundle.objectRegistry,
      root.pendingTriggers,
    );
    if (!pendingResult.ok) {
      for (const current of pendingResult.issues) {
        issues.push(issue(
          current.code === 'PENDING_TRIGGER_COLLISION' ? 'PENDING_TRIGGER_COLLISION' : 'INVALID_PENDING_TRIGGER_SLICE',
          `/pendingTriggers${mapNestedPath(current.path)}`,
          current.message,
        ));
      }
    } else {
      pendingTriggers = pendingResult.value;
    }
  } else {
    issues.push(issue('INVALID_PENDING_TRIGGER_SLICE', '/pendingTriggers', 'Pending trigger slice cannot be validated without a valid stack bundle'));
  }

  const lifecycleResult = validateModeNeutralCoreTurnLifecycleSliceV1(root.lifecycle);
  if (!lifecycleResult.ok) {
    issues.push(issue('INVALID_LIFECYCLE_SLICE', '/lifecycle', 'Turn lifecycle slice is invalid'));
    for (const current of lifecycleResult.issues) {
      const allowed: CoreTurnPriorityBundleValidationCodeV1 = current.code === 'INVALID_PASS_SEQUENCE'
        ? 'INVALID_PASS_SEQUENCE'
        : current.code === 'INVALID_PRIORITY_PLAYER'
          ? 'INVALID_PRIORITY_PLAYER'
          : current.code === 'RESOLUTION_OBJECT_MISMATCH'
            ? 'RESOLUTION_OBJECT_MISMATCH'
            : current.code === 'INVALID_TRIGGER_ORDER'
              ? 'INVALID_TRIGGER_ORDER'
              : current.code === 'INVALID_CLEANUP_REQUIREMENT'
                ? 'INVALID_CLEANUP_REQUIREMENT'
                : current.code === 'INVALID_POSITION'
                  ? 'INVALID_POSITION'
                  : current.code === 'INVALID_WINDOW_FOR_POSITION'
                    ? 'INVALID_WINDOW_FOR_POSITION'
                    : current.code;
      issues.push(issue(allowed, `/lifecycle${current.path}`, current.message));
    }
  } else {
    lifecycle = lifecycleResult.value;
  }

  if (stackBundle !== null && pendingTriggers !== null && lifecycle !== null) {
    issues.push(...validateCrossSlice(stackBundle, pendingTriggers, lifecycle));
  }
  const ordered = sortedIssues(issues);
  if (ordered.length > 0 || stackBundle === null || pendingTriggers === null || lifecycle === null) {
    return Object.freeze({ ok: false, issues: ordered });
  }
  return Object.freeze({
    ok: true,
    value: Object.freeze({
      stackBundle,
      pendingTriggers,
      lifecycle,
    }),
  });
}
