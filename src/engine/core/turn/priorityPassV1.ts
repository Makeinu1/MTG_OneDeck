import type { CoreObjectId, CorePlayerId } from '../ids';
import { validateCoreStackTransactionBundleV1 } from '../stack/transaction/stackTransactionBundleV1';
import type { CoreStackTransactionBundleV1 } from '../stack/transaction/stackTransactionBundleV1';
import {
  createModeNeutralCoreTurnLifecycleSliceV1,
  validateModeNeutralCoreTurnLifecycleSliceV1,
} from './turnLifecycleV1';
import type { CoreTurnLifecycleSliceV1, CoreTurnWindowV1 } from './turnLifecycleV1';
import { CoreTurnPriorityOperationErrorV1 } from './turnPriorityErrorV1';

export type CorePriorityPassComponentInputV1 = Readonly<{
  readonly stackBundle: CoreStackTransactionBundleV1;
  readonly lifecycle: CoreTurnLifecycleSliceV1;
}>;

export type CorePriorityPassComponentResultV1 = CorePriorityPassComponentInputV1;

export type CorePriorityPassComponentValidationIssueV1 = Readonly<{
  readonly code: 'INVALID_TURN_PRIORITY_BUNDLE' | 'INVALID_PASS_SEQUENCE';
  readonly path: string;
  readonly message: string;
}>;

export type CorePriorityPassComponentValidationResultV1 =
  | Readonly<{
      readonly ok: true;
      readonly value: CorePriorityPassComponentResultV1;
    }>
  | Readonly<{
      readonly ok: false;
      readonly issues: readonly CorePriorityPassComponentValidationIssueV1[];
    }>;

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

function issue(
  code: CorePriorityPassComponentValidationIssueV1['code'],
  path: string,
  message: string,
): CorePriorityPassComponentValidationIssueV1 {
  return Object.freeze({ code, path, message });
}

function operationFailure(
  code: ConstructorParameters<typeof CoreTurnPriorityOperationErrorV1>[0],
  message: string,
  path = '',
): never {
  throw new CoreTurnPriorityOperationErrorV1(code, message, [
    Object.freeze({ code, path, message }),
  ]);
}

function readComponentRoot(input: unknown):
  | Readonly<{ readonly stackBundle: unknown; readonly lifecycle: unknown }>
  | null {
  if (!isPlainRecord(input)) return null;
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(input);
  } catch {
    return null;
  }
  const values: RawRecord = Object.create(null) as RawRecord;
  for (const key of keys) {
    if (typeof key !== 'string' || (key !== 'stackBundle' && key !== 'lifecycle')) return null;
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(input, key);
    } catch {
      return null;
    }
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) return null;
    values[key] = descriptor.value;
  }
  if (!Object.prototype.hasOwnProperty.call(values, 'stackBundle')
    || !Object.prototype.hasOwnProperty.call(values, 'lifecycle')) return null;
  return { stackBundle: values.stackBundle, lifecycle: values.lifecycle };
}

function componentFrom(
  stackBundle: CoreStackTransactionBundleV1,
  lifecycle: CoreTurnLifecycleSliceV1,
): CorePriorityPassComponentResultV1 {
  return Object.freeze({ stackBundle, lifecycle });
}

function lifecycleWithWindow(
  lifecycle: CoreTurnLifecycleSliceV1,
  window: CoreTurnWindowV1,
): CoreTurnLifecycleSliceV1 {
  return createModeNeutralCoreTurnLifecycleSliceV1({
    turnNumber: lifecycle.turnNumber,
    positionSequence: lifecycle.positionSequence,
    position: lifecycle.position,
    window,
  });
}

function validateContiguousPriority(
  window: Extract<CoreTurnWindowV1, { readonly kind: 'priority' }>,
  turnOrder: readonly CorePlayerId[],
): CorePriorityPassComponentValidationIssueV1 | null {
  const cycleStartIndex = turnOrder.indexOf(window.cycleStartPlayerId);
  const holderIndex = turnOrder.indexOf(window.holderPlayerId);
  if (cycleStartIndex < 0 || holderIndex < 0) {
    return issue('INVALID_PASS_SEQUENCE', '/lifecycle/window', 'Priority players must be seated');
  }

  const seen = new Set<string>();
  for (let index = 0; index < window.passedPlayerIds.length; index += 1) {
    const playerId = window.passedPlayerIds[index];
    if (turnOrder.indexOf(playerId) < 0) {
      return issue('INVALID_PASS_SEQUENCE', `/lifecycle/window/passedPlayerIds/${index}`, 'Passed player must be seated');
    }
    if (seen.has(playerId)) {
      return issue('INVALID_PASS_SEQUENCE', `/lifecycle/window/passedPlayerIds/${index}`, 'Passed players must be unique');
    }
    seen.add(playerId);
    if (playerId === window.holderPlayerId) {
      return issue('INVALID_PASS_SEQUENCE', `/lifecycle/window/passedPlayerIds/${index}`, 'Passed players must not include the holder');
    }
    const expected = turnOrder[(cycleStartIndex + index) % turnOrder.length];
    if (playerId !== expected) {
      return issue('INVALID_PASS_SEQUENCE', `/lifecycle/window/passedPlayerIds/${index}`, 'Passed players must form a contiguous turn-order interval');
    }
  }

  const expectedHolder = turnOrder[(cycleStartIndex + window.passedPlayerIds.length) % turnOrder.length];
  if (window.holderPlayerId !== expectedHolder) {
    return issue('INVALID_PASS_SEQUENCE', '/lifecycle/window/holderPlayerId', 'Holder must follow the contiguous passed chain');
  }
  return null;
}

function validateComponent(input: unknown): CorePriorityPassComponentValidationResultV1 {
  const root = readComponentRoot(input);
  if (root === null) {
    return Object.freeze({
      ok: false,
      issues: Object.freeze([issue('INVALID_TURN_PRIORITY_BUNDLE', '', 'Priority component must contain only stackBundle and lifecycle')]),
    });
  }

  let stackResult: ReturnType<typeof validateCoreStackTransactionBundleV1>;
  let lifecycleResult: ReturnType<typeof validateModeNeutralCoreTurnLifecycleSliceV1>;
  try {
    stackResult = validateCoreStackTransactionBundleV1(root.stackBundle);
    lifecycleResult = validateModeNeutralCoreTurnLifecycleSliceV1(root.lifecycle);
  } catch {
    return Object.freeze({
      ok: false,
      issues: Object.freeze([issue('INVALID_TURN_PRIORITY_BUNDLE', '', 'Priority component could not be inspected safely')]),
    });
  }
  if (!stackResult.ok) {
    return Object.freeze({
      ok: false,
      issues: Object.freeze([issue('INVALID_TURN_PRIORITY_BUNDLE', '', 'Stack bundle or lifecycle is invalid')]),
    });
  }
  if (!lifecycleResult.ok) {
    const passIssue = lifecycleResult.issues.find((current) => current.code === 'INVALID_PASS_SEQUENCE'
      || current.path.startsWith('/window/cycleStartPlayerId')
      || current.path.startsWith('/window/holderPlayerId')
      || current.path.startsWith('/window/passedPlayerIds'));
    return Object.freeze({
      ok: false,
      issues: Object.freeze([issue(
        passIssue === undefined ? 'INVALID_TURN_PRIORITY_BUNDLE' : 'INVALID_PASS_SEQUENCE',
        passIssue?.path ?? '',
        passIssue?.message ?? 'Stack bundle or lifecycle is invalid',
      )]),
    });
  }

  const window = lifecycleResult.value.window;
  if (window.kind === 'priority') {
    const passIssue = validateContiguousPriority(window, stackResult.value.objectRegistry.turnOrder);
    if (passIssue !== null) return Object.freeze({ ok: false, issues: Object.freeze([passIssue]) });
  }

  return Object.freeze({
    ok: true,
    value: componentFrom(stackResult.value, lifecycleResult.value),
  });
}

export function validateCorePriorityPassComponentV1(
  input: unknown,
): CorePriorityPassComponentValidationResultV1 {
  return validateComponent(input);
}

export function normalizeCorePriorityPassComponentV1(
  input: unknown,
): CorePriorityPassComponentResultV1 {
  const result = validateComponent(input);
  if (!result.ok) {
    const first = result.issues[0];
    operationFailure(first.code, first.message, first.path);
  }
  return result.value;
}

function nextPlayer(
  turnOrder: readonly CorePlayerId[],
  playerId: CorePlayerId,
): CorePlayerId {
  const index = turnOrder.indexOf(playerId);
  if (index < 0) operationFailure('PLAYER_NOT_SEATED', 'Player is not seated', '/playerId');
  return turnOrder[(index + 1) % turnOrder.length];
}

function requirePriority(
  component: CorePriorityPassComponentResultV1,
): Extract<CoreTurnWindowV1, { readonly kind: 'priority' }> {
  if (component.lifecycle.window.kind !== 'priority') {
    operationFailure('WINDOW_MISMATCH', 'Operation requires a priority window', '/lifecycle/window');
  }
  return component.lifecycle.window;
}

function requireSeated(
  turnOrder: readonly CorePlayerId[],
  playerId: CorePlayerId,
): void {
  if (!turnOrder.includes(playerId)) operationFailure('PLAYER_NOT_SEATED', 'Player is not seated', '/playerId');
}

export function startCorePriorityCycleV1(
  input: CorePriorityPassComponentInputV1,
): CorePriorityPassComponentResultV1 {
  const component = normalizeCorePriorityPassComponentV1(input);
  const activePlayerId = component.stackBundle.objectRegistry.activePlayerId;
  const turnOrder = component.stackBundle.objectRegistry.turnOrder;
  requireSeated(turnOrder, activePlayerId);
  const lifecycle = lifecycleWithWindow(component.lifecycle, {
    kind: 'priority',
    cycleStartPlayerId: activePlayerId,
    holderPlayerId: activePlayerId,
    passedPlayerIds: [],
  });
  return componentFrom(component.stackBundle, lifecycle);
}

export function passCorePriorityV1(
  input: CorePriorityPassComponentInputV1,
  playerId: CorePlayerId,
): CorePriorityPassComponentResultV1 {
  const component = normalizeCorePriorityPassComponentV1(input);
  const window = requirePriority(component);
  const turnOrder = component.stackBundle.objectRegistry.turnOrder;
  requireSeated(turnOrder, playerId);
  if (playerId !== window.holderPlayerId) {
    operationFailure('NOT_PRIORITY_HOLDER', 'Only the current priority holder may pass', '/playerId');
  }

  const passedPlayerIds = [...window.passedPlayerIds, window.holderPlayerId] as CorePlayerId[];
  if (passedPlayerIds.length === turnOrder.length) {
    const stack = component.stackBundle.objectRegistry.zones.shared.stack;
    const nextWindow: CoreTurnWindowV1 = stack.length > 0
      ? { kind: 'resolution-ready', objectId: stack[stack.length - 1] }
      : component.lifecycle.position.phase === 'ending' && component.lifecycle.position.step === 'cleanup'
        ? { kind: 'cleanup-repeat-ready' }
        : { kind: 'position-advance-ready' };
    return componentFrom(component.stackBundle, lifecycleWithWindow(component.lifecycle, nextWindow));
  }

  const nextWindow: CoreTurnWindowV1 = {
    kind: 'priority',
    cycleStartPlayerId: window.cycleStartPlayerId,
    holderPlayerId: nextPlayer(turnOrder, window.holderPlayerId),
    passedPlayerIds,
  };
  return componentFrom(component.stackBundle, lifecycleWithWindow(component.lifecycle, nextWindow));
}

export function resumeCoreAfterPriorityActionV1(
  input: CorePriorityPassComponentInputV1,
  actingPlayerId: CorePlayerId,
): CorePriorityPassComponentResultV1 {
  const component = normalizeCorePriorityPassComponentV1(input);
  const window = requirePriority(component);
  const turnOrder = component.stackBundle.objectRegistry.turnOrder;
  requireSeated(turnOrder, actingPlayerId);
  if (actingPlayerId !== window.holderPlayerId) {
    operationFailure('NOT_PRIORITY_HOLDER', 'Only the current priority holder may act', '/actingPlayerId');
  }
  return componentFrom(component.stackBundle, lifecycleWithWindow(component.lifecycle, {
    kind: 'sba-check-required',
    priorityRecipientPlayerId: actingPlayerId,
    grantPriorityIfStable: true,
  }));
}

export const resetCorePriorityAfterActionV1 = resumeCoreAfterPriorityActionV1;

export type { CoreObjectId, CorePlayerId };
