import type { CoreObjectId, CorePlayerId } from '../ids';
import {
  CoreTurnLifecycleCreationErrorV1,
  validateModeNeutralCoreTurnLifecycleSliceV1,
} from './turnLifecycleValidationV1';

export type CoreTurnWindowV1 =
  | Readonly<{
      readonly kind: 'turn-based-action-required';
      readonly action: 'untap-step-actions' | 'draw-step-draw' | 'precombat-main-actions';
      readonly playerId: CorePlayerId;
    }>
  | Readonly<{
      readonly kind: 'sba-check-required';
      readonly priorityRecipientPlayerId: CorePlayerId;
      readonly grantPriorityIfStable: boolean;
    }>
  | Readonly<{
      readonly kind: 'trigger-order-required';
      readonly priorityRecipientPlayerId: CorePlayerId;
      readonly grantPriorityIfStable: true;
      readonly pendingObjectIds: readonly CoreObjectId[];
      readonly ambiguousGroups: readonly CorePendingTriggerOrderGroupV1[];
    }>
  | Readonly<{
      readonly kind: 'priority';
      readonly cycleStartPlayerId: CorePlayerId;
      readonly holderPlayerId: CorePlayerId;
      readonly passedPlayerIds: readonly CorePlayerId[];
    }>
  | Readonly<{ readonly kind: 'resolution-ready'; readonly objectId: CoreObjectId }>
  | Readonly<{ readonly kind: 'position-advance-ready' }>
  | Readonly<{
      readonly kind: 'cleanup-discard-required';
      readonly playerId: CorePlayerId;
      readonly requiredCount: number;
    }>
  | Readonly<{ readonly kind: 'cleanup-state-actions-required'; readonly playerId: CorePlayerId }>
  | Readonly<{ readonly kind: 'cleanup-repeat-ready' }>
  | Readonly<{ readonly kind: 'turn-advance-ready' }>;

export type CorePendingTriggerOrderGroupV1 = Readonly<{
  readonly stackPlacementBucket: 'ordinary' | 'ability-triggered';
  readonly controllerPlayerId: CorePlayerId;
  readonly pendingObjectIds: readonly CoreObjectId[];
}>;

export type CoreTurnLifecycleSliceV1 = Readonly<{
  readonly kind: 'mode-neutral-core-turn-lifecycle-slice-v1';
  readonly turnNumber: number;
  readonly positionSequence: number;
  readonly position: import('./turnPositionV1').CoreTurnPositionV1;
  readonly window: CoreTurnWindowV1;
}>;

export type ModeNeutralCoreTurnLifecycleSliceV1 = CoreTurnLifecycleSliceV1;

export type CreateModeNeutralCoreTurnLifecycleSliceV1Input = Readonly<{
  readonly turnNumber: number;
  readonly positionSequence: number;
  readonly position: import('./turnPositionV1').CoreTurnPositionV1;
  readonly window: CoreTurnWindowV1;
}>;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Reflect.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function hasOwnKind(value: unknown): boolean {
  if (!isPlainRecord(value)) return false;
  try {
    return Reflect.ownKeys(value).some((key) => key === 'kind');
  } catch {
    return false;
  }
}

function candidateWithKind(input: unknown): unknown {
  if (!isPlainRecord(input)) return input;
  const candidate = Object.create(null) as Record<string | symbol, unknown>;
  try {
    for (const key of Reflect.ownKeys(input)) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor !== undefined) Object.defineProperty(candidate, key, descriptor);
    }
    Object.defineProperty(candidate, 'kind', {
      value: 'mode-neutral-core-turn-lifecycle-slice-v1',
      enumerable: true,
      configurable: true,
      writable: true,
    });
    return candidate;
  } catch {
    return input;
  }
}

export function createModeNeutralCoreTurnLifecycleSliceV1(
  input: CreateModeNeutralCoreTurnLifecycleSliceV1Input,
): CoreTurnLifecycleSliceV1 {
  if (hasOwnKind(input)) {
    throw new CoreTurnLifecycleCreationErrorV1([Object.freeze({
      code: 'UNKNOWN_FIELD',
      path: '/kind',
      message: 'Factory input must omit kind',
    })]);
  }
  const validation = validateModeNeutralCoreTurnLifecycleSliceV1(candidateWithKind(input));
  if (!validation.ok) throw new CoreTurnLifecycleCreationErrorV1(validation.issues);
  return validation.value;
}

export {
  CoreTurnLifecycleCreationErrorV1,
  validateCoreTurnWindowV1,
  validateModeNeutralCoreTurnLifecycleSliceV1,
} from './turnLifecycleValidationV1';
export { validateCoreTurnPositionV1 } from './turnPositionV1';
export type {
  CoreTurnLifecycleValidationCodeV1,
  CoreTurnLifecycleValidationIssueV1,
  CoreTurnLifecycleValidationResultV1,
  CoreTurnPositionValidationResultV1,
  CoreTurnWindowValidationResultV1,
} from './turnLifecycleValidationV1';
