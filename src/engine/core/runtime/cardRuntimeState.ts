import {
  CoreCardRuntimeCreationError,
  validateModeNeutralCoreCardRuntimeSliceV1,
} from './cardRuntimeValidation';
import type { CoreObjectId } from '../ids';
import type { ModeNeutralCoreIdentityZoneSliceV1 } from '../identityZoneState';
import type { CoreAttachmentStateV1 } from './attachment';
import type { CoreCardOrientationStateV1 } from './cardOrientation';
import type { CoreCounterDamageStateV1 } from './counterDamage';

export interface CoreCardObjectRuntimeStateV1 {
  readonly orientation: CoreCardOrientationStateV1;
  readonly counterDamage: CoreCounterDamageStateV1;
  readonly attachment: CoreAttachmentStateV1;
}

export interface ModeNeutralCoreCardRuntimeSliceV1 {
  readonly kind: 'mode-neutral-core-card-runtime-slice-v1';
  readonly byObject: Readonly<Record<CoreObjectId, CoreCardObjectRuntimeStateV1>>;
}

export interface CreateModeNeutralCoreCardRuntimeSliceV1Input {
  readonly byObject: Readonly<Record<CoreObjectId, CoreCardObjectRuntimeStateV1>>;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function factoryInputKindIssue(): {
  readonly code: 'UNKNOWN_FIELD';
  readonly path: '/kind';
  readonly message: string;
} {
  return {
    code: 'UNKNOWN_FIELD',
    path: '/kind',
    message: 'Factory input must omit kind',
  };
}

function candidateFromInput(input: unknown): unknown {
  if (!isPlainRecord(input)) return input;
  const candidate: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of Reflect.ownKeys(input)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (descriptor !== undefined) Object.defineProperty(candidate, key, descriptor);
  }
  Object.defineProperty(candidate, 'kind', {
    value: 'mode-neutral-core-card-runtime-slice-v1',
    enumerable: true,
    configurable: true,
    writable: true,
  });
  return candidate;
}

export function createModeNeutralCoreCardRuntimeSliceV1(
  identityState: ModeNeutralCoreIdentityZoneSliceV1,
  input: CreateModeNeutralCoreCardRuntimeSliceV1Input,
): ModeNeutralCoreCardRuntimeSliceV1 {
  if (isPlainRecord(input) && Object.prototype.hasOwnProperty.call(input, 'kind')) {
    throw new CoreCardRuntimeCreationError([factoryInputKindIssue()]);
  }

  const validation = validateModeNeutralCoreCardRuntimeSliceV1(identityState, candidateFromInput(input));
  if (!validation.ok) throw new CoreCardRuntimeCreationError(validation.issues);
  return validation.value;
}
