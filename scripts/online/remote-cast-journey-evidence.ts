export type RemoteCastJourneyObservationV1 = Readonly<{
  readonly kind: 'remote-cast-journey-observation-v1';
  readonly castObjectId: string;
  readonly senderReceipt: Readonly<{
    readonly commandId: string;
    readonly operation: 'cast-spell';
    readonly outcome: 'accepted';
    readonly baseRevision: number;
    readonly currentRevision: number;
    readonly acceptedRevision: number;
  }>;
  readonly seats: readonly Readonly<{
    readonly revision: number;
    readonly stackCount: number;
    readonly topObjectId: string | null;
  }>[];
}>;

export type RemoteCastJourneyFactV1 = Readonly<{
  readonly acceptedRevision: number;
  readonly seatCount: 2 | 4;
  readonly receiptAccepted: true;
  readonly revisionsConverged: true;
  readonly sharedStackTop: true;
}>;

export type RemoteCastJourneyValidationV1 =
  | Readonly<{ readonly ok: true; readonly value: RemoteCastJourneyFactV1 }>
  | Readonly<{ readonly ok: false; readonly code: string }>;

const COMMAND_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u;
const OBJECT_ID = /^(?:[A-Za-z0-9][A-Za-z0-9._-]{0,127}:[0-9]+|@(?:token|spell-copy|activated-ability|triggered-ability):[A-Za-z0-9][A-Za-z0-9._:-]{0,127})$/u;
const CARD_OBJECT_ID = /^([A-Za-z0-9][A-Za-z0-9._-]{0,127}):([0-9]+)$/u;

function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype = Reflect.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return false;
    const actual = Reflect.ownKeys(value);
    if (actual.length !== keys.length || actual.some((key) => typeof key !== 'string' || !keys.includes(key))) return false;
    return actual.every((key) => {
      if (typeof key !== 'string') return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor !== undefined && descriptor.enumerable && 'value' in descriptor
        && descriptor.get === undefined && descriptor.set === undefined;
    });
  } catch {
    return false;
  }
}

function revision(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function failure(code: string): RemoteCastJourneyValidationV1 {
  return Object.freeze({ ok: false, code });
}

function isNextCardIncarnation(sourceObjectId: string, stackObjectId: string): boolean {
  const source = CARD_OBJECT_ID.exec(sourceObjectId);
  const stack = CARD_OBJECT_ID.exec(stackObjectId);
  if (source === null || stack === null || source[1] !== stack[1]) return false;
  const sourceIncarnation = Number(source[2]);
  const stackIncarnation = Number(stack[2]);
  return Number.isSafeInteger(sourceIncarnation)
    && Number.isSafeInteger(stackIncarnation)
    && sourceIncarnation >= 0
    && stackIncarnation === sourceIncarnation + 1;
}

/**
 * Validates only visible journey facts. Command/object identities are used for
 * correlation and deliberately omitted from the normalized evidence summary.
 */
export function validateRemoteCastJourneyObservationV1(
  input: unknown,
  expectedSeatCount: 2 | 4,
): RemoteCastJourneyValidationV1 {
  if (!exact(input, ['kind', 'castObjectId', 'senderReceipt', 'seats'])
    || input.kind !== 'remote-cast-journey-observation-v1'
    || typeof input.castObjectId !== 'string' || !OBJECT_ID.test(input.castObjectId)) {
    return failure('INVALID_OBSERVATION');
  }
  const receipt = input.senderReceipt;
  if (!exact(receipt, ['commandId', 'operation', 'outcome', 'baseRevision', 'currentRevision', 'acceptedRevision'])
    || typeof receipt.commandId !== 'string' || !COMMAND_ID.test(receipt.commandId)
    || receipt.operation !== 'cast-spell' || receipt.outcome !== 'accepted') {
    return failure('RECEIPT_NOT_ACCEPTED');
  }
  if (!revision(receipt.baseRevision) || !revision(receipt.currentRevision)
    || !revision(receipt.acceptedRevision)
    || receipt.acceptedRevision <= receipt.baseRevision
    || receipt.currentRevision !== receipt.acceptedRevision) {
    return failure('RECEIPT_RELATION_MISMATCH');
  }
  if (!Array.isArray(input.seats) || input.seats.length !== expectedSeatCount) {
    return failure('SEAT_COUNT_MISMATCH');
  }
  const seats: Array<{ revision: number; stackCount: number; topObjectId: string | null }> = [];
  for (const seat of input.seats) {
    if (!exact(seat, ['revision', 'stackCount', 'topObjectId'])
      || !revision(seat.revision) || !revision(seat.stackCount)
      || (seat.topObjectId !== null && (typeof seat.topObjectId !== 'string' || !OBJECT_ID.test(seat.topObjectId)))) {
      return failure('INVALID_OBSERVATION');
    }
    seats.push({ revision: seat.revision, stackCount: seat.stackCount, topObjectId: seat.topObjectId });
  }
  if (seats.some((seat) => seat.revision !== receipt.acceptedRevision)) return failure('REVISION_DIVERGED');
  const first = seats[0];
  if (first === undefined || first.stackCount < 1 || first.topObjectId === null
    || seats.some((seat) => seat.stackCount !== first.stackCount || seat.topObjectId !== first.topObjectId)) {
    return failure('STACK_DIVERGED');
  }
  // A card becomes a new Core object when it changes from hand to stack. The
  // evidence therefore proves physical-card continuity plus the one-step
  // incarnation transition instead of incorrectly requiring string equality.
  if (!isNextCardIncarnation(input.castObjectId, first.topObjectId)) return failure('CAST_OBJECT_TRANSITION_MISMATCH');
  return Object.freeze({
    ok: true,
    value: Object.freeze({
      acceptedRevision: receipt.acceptedRevision,
      seatCount: expectedSeatCount,
      receiptAccepted: true,
      revisionsConverged: true,
      sharedStackTop: true,
    }),
  });
}
