import { coreCardObjectIdOf, isCoreBaseId } from '../ids';
import type { CoreObjectId, CorePhysicalCardId } from '../ids';
import {
  createCoreCardOrientationStateV1,
  validateCoreCardOrientationStateV1,
} from '../runtime/cardOrientation';
import type { CoreCardOrientationStateV1 } from '../runtime/cardOrientation';
import {
  createCoreCounterDamageStateV1,
  validateCoreCounterDamageStateV1,
} from '../runtime/counterDamage';
import type { CoreCounterDamageStateV1 } from '../runtime/counterDamage';
import {
  createCoreAttachmentStateV1,
  validateCoreAttachmentStateV1,
} from '../runtime/attachment';
import type { CoreAttachmentStateV1 } from '../runtime/attachment';
import type { CoreCardObjectRuntimeStateV1 } from '../runtime/cardRuntimeState';

export type CoreCardReincarnationErrorCode =
  | 'INVALID_PHYSICAL_CARD_ID'
  | 'INVALID_CURRENT_INCARNATION'
  | 'INCARNATION_OVERFLOW';

export class CoreCardReincarnationError extends Error {
  readonly code: CoreCardReincarnationErrorCode;

  constructor(code: CoreCardReincarnationErrorCode, message: string) {
    super(message);
    this.name = 'CoreCardReincarnationError';
    this.code = code;
  }
}

export function nextCoreCardIncarnationV1(currentIncarnation: unknown): number {
  if (
    typeof currentIncarnation !== 'number'
    || !Number.isSafeInteger(currentIncarnation)
    || currentIncarnation < 0
  ) {
    throw new CoreCardReincarnationError(
      'INVALID_CURRENT_INCARNATION',
      'Current incarnation must be a non-negative safe integer',
    );
  }

  if (currentIncarnation === Number.MAX_SAFE_INTEGER) {
    throw new CoreCardReincarnationError(
      'INCARNATION_OVERFLOW',
      'Card incarnation cannot advance beyond Number.MAX_SAFE_INTEGER',
    );
  }

  return currentIncarnation + 1;
}

export function nextCoreCardObjectIdV1(
  physicalCardId: unknown,
  currentIncarnation: unknown,
): CoreObjectId {
  if (!isCoreBaseId(physicalCardId)) {
    throw new CoreCardReincarnationError(
      'INVALID_PHYSICAL_CARD_ID',
      'Physical card ID must be a valid Core base ID',
    );
  }

  const nextIncarnation = nextCoreCardIncarnationV1(currentIncarnation);
  return coreCardObjectIdOf(physicalCardId as CorePhysicalCardId, nextIncarnation);
}

const RUNTIME_FIELDS = ['orientation', 'counterDamage', 'attachment'] as const;

type RuntimeField = (typeof RUNTIME_FIELDS)[number];
type RawRecord = Record<string, unknown>;

function isPlainRecord(value: unknown): value is RawRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function readStrictRuntimeState(value: unknown): {
  readonly orientation: unknown;
  readonly counterDamage: unknown;
  readonly attachment: unknown;
} | null {
  if (!isPlainRecord(value)) return null;

  const fields: Partial<Record<RuntimeField, unknown>> = {};
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !(RUNTIME_FIELDS as readonly string[]).includes(key)) return null;

    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      return null;
    }
    fields[key as RuntimeField] = descriptor.value;
  }

  for (const field of RUNTIME_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(fields, field)) return null;
  }

  return {
    orientation: fields.orientation,
    counterDamage: fields.counterDamage,
    attachment: fields.attachment,
  };
}

export function createDefaultCoreCardRuntimeAfterZoneChangeV1(): CoreCardObjectRuntimeStateV1 {
  const orientation: CoreCardOrientationStateV1 = createCoreCardOrientationStateV1({
    faceIndex: 0,
    faceDown: false,
    tapped: false,
    flipped: false,
    phasedOut: false,
  });
  const counterDamage: CoreCounterDamageStateV1 = createCoreCounterDamageStateV1({
    counters: [],
    markedDamage: 0,
  });
  const attachment: CoreAttachmentStateV1 = createCoreAttachmentStateV1({
    attachedTo: null,
  });

  return Object.freeze({ orientation, counterDamage, attachment });
}

export function isDefaultCoreCardRuntimeAfterZoneChangeV1(
  value: unknown,
): value is CoreCardObjectRuntimeStateV1 {
  const raw = readStrictRuntimeState(value);
  if (raw === null) return false;

  const orientation = validateCoreCardOrientationStateV1(raw.orientation);
  const counterDamage = validateCoreCounterDamageStateV1(raw.counterDamage);
  const attachment = validateCoreAttachmentStateV1(raw.attachment);
  if (!orientation.ok || !counterDamage.ok || !attachment.ok) return false;

  const expected = createDefaultCoreCardRuntimeAfterZoneChangeV1();
  return (
    orientation.value.faceIndex === expected.orientation.faceIndex
    && orientation.value.faceDown === expected.orientation.faceDown
    && orientation.value.tapped === expected.orientation.tapped
    && orientation.value.flipped === expected.orientation.flipped
    && orientation.value.phasedOut === expected.orientation.phasedOut
    && counterDamage.value.counters.length === expected.counterDamage.counters.length
    && counterDamage.value.markedDamage === expected.counterDamage.markedDamage
    && attachment.value.attachedTo === expected.attachment.attachedTo
  );
}
