type PriorityOperationV1 = 'priority-hold' | 'priority-pass' | 'priority-resolve';

type PriorityReceiptV1 = Readonly<{
  readonly commandId: string;
  readonly operation: PriorityOperationV1;
  readonly outcome: 'accepted';
  readonly baseRevision: number;
  readonly currentRevision: number;
  readonly acceptedRevision: number;
}>;

type PrioritySeatObservationV1 = Readonly<{
  readonly revision: number;
  readonly holds: readonly string[];
  readonly holderPlayerId: string | null;
  readonly stewardPlayerId: string | null;
  readonly windowKind: string;
  readonly stackCount: number;
  readonly topObjectId: string | null;
  readonly recentResolutionObjectId: string | null;
  readonly recentResolutionRevision: number | null;
}>;

type PriorityStepObservationV1 = Readonly<{
  readonly operation: PriorityOperationV1;
  readonly actorPlayerId: string;
  readonly receipt: PriorityReceiptV1;
  readonly seats: readonly PrioritySeatObservationV1[];
}>;

export type RemotePriorityJourneyObservationV1 = Readonly<{
  readonly kind: 'remote-priority-journey-observation-v1';
  readonly playerIds: readonly [string, string];
  readonly capturedTopObjectId: string;
  readonly steps: readonly [
    PriorityStepObservationV1,
    PriorityStepObservationV1,
    PriorityStepObservationV1,
    PriorityStepObservationV1,
    PriorityStepObservationV1,
  ];
}>;

export type RemotePriorityJourneyFactV1 = Readonly<{
  readonly startRevision: number;
  readonly resolvedRevision: number;
  readonly seatCount: 2;
  readonly receiptsAccepted: true;
  readonly revisionsConverged: true;
  readonly holdConverged: true;
  readonly priorityCycleComplete: true;
  readonly capturedTopResolved: true;
}>;

export type RemotePriorityJourneyValidationV1 =
  | Readonly<{ readonly ok: true; readonly value: RemotePriorityJourneyFactV1 }>
  | Readonly<{ readonly ok: false; readonly code: string }>;

const COMMAND_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u;
const PLAYER_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const OBJECT_ID = /^(?:[A-Za-z0-9][A-Za-z0-9._-]{0,127}:[0-9]+|@(?:token|spell-copy|activated-ability|triggered-ability):[A-Za-z0-9][A-Za-z0-9._:-]{0,127})$/u;

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

function identifier(value: unknown, pattern: RegExp): value is string {
  return typeof value === 'string' && pattern.test(value);
}

function failure(code: string): RemotePriorityJourneyValidationV1 {
  return Object.freeze({ ok: false, code });
}

function sameSeat(left: PrioritySeatObservationV1, right: PrioritySeatObservationV1): boolean {
  return left.revision === right.revision
    && left.holderPlayerId === right.holderPlayerId
    && left.stewardPlayerId === right.stewardPlayerId
    && left.windowKind === right.windowKind
    && left.stackCount === right.stackCount
    && left.topObjectId === right.topObjectId
    && left.recentResolutionObjectId === right.recentResolutionObjectId
    && left.recentResolutionRevision === right.recentResolutionRevision
    && left.holds.length === right.holds.length
    && left.holds.every((playerId, index) => playerId === right.holds[index]);
}

function readStep(input: unknown, expectedOperation: PriorityOperationV1): PriorityStepObservationV1 | null {
  if (!exact(input, ['operation', 'actorPlayerId', 'receipt', 'seats'])
    || input.operation !== expectedOperation
    || !identifier(input.actorPlayerId, PLAYER_ID)) return null;
  const receipt = input.receipt;
  if (!exact(receipt, ['commandId', 'operation', 'outcome', 'baseRevision', 'currentRevision', 'acceptedRevision'])
    || !identifier(receipt.commandId, COMMAND_ID)
    || receipt.operation !== expectedOperation
    || receipt.outcome !== 'accepted'
    || !revision(receipt.baseRevision)
    || !revision(receipt.currentRevision)
    || !revision(receipt.acceptedRevision)
    || receipt.acceptedRevision !== receipt.baseRevision + 1
    || receipt.currentRevision !== receipt.acceptedRevision) return null;
  if (!Array.isArray(input.seats) || input.seats.length !== 2) return null;
  const seats: PrioritySeatObservationV1[] = [];
  for (const seat of input.seats) {
    if (!exact(seat, [
      'revision', 'holds', 'holderPlayerId', 'stewardPlayerId', 'windowKind',
      'stackCount', 'topObjectId', 'recentResolutionObjectId', 'recentResolutionRevision',
    ])
      || !revision(seat.revision)
      || !Array.isArray(seat.holds)
      || !seat.holds.every((playerId) => identifier(playerId, PLAYER_ID))
      || (seat.holderPlayerId !== null && !identifier(seat.holderPlayerId, PLAYER_ID))
      || (seat.stewardPlayerId !== null && !identifier(seat.stewardPlayerId, PLAYER_ID))
      || typeof seat.windowKind !== 'string' || seat.windowKind.length === 0
      || !revision(seat.stackCount)
      || (seat.topObjectId !== null && !identifier(seat.topObjectId, OBJECT_ID))
      || (seat.recentResolutionObjectId !== null && !identifier(seat.recentResolutionObjectId, OBJECT_ID))
      || (seat.recentResolutionRevision !== null && !revision(seat.recentResolutionRevision))) return null;
    seats.push(seat as unknown as PrioritySeatObservationV1);
  }
  if (seats.some((seat) => seat.revision !== receipt.acceptedRevision)
    || seats[0] === undefined || seats[1] === undefined || !sameSeat(seats[0], seats[1])) return null;
  return Object.freeze({
    operation: expectedOperation,
    actorPlayerId: input.actorPlayerId,
    receipt: receipt as unknown as PriorityReceiptV1,
    seats: Object.freeze(seats),
  });
}

/** Validates only public, two-seat journey facts and returns no player/object identities. */
export function validateRemotePriorityJourneyObservationV1(
  input: unknown,
): RemotePriorityJourneyValidationV1 {
  if (!exact(input, ['kind', 'playerIds', 'capturedTopObjectId', 'steps'])
    || input.kind !== 'remote-priority-journey-observation-v1'
    || !Array.isArray(input.playerIds) || input.playerIds.length !== 2
    || !input.playerIds.every((playerId) => identifier(playerId, PLAYER_ID))
    || input.playerIds[0] === input.playerIds[1]
    || !identifier(input.capturedTopObjectId, OBJECT_ID)
    || !Array.isArray(input.steps) || input.steps.length !== 5) return failure('INVALID_OBSERVATION');
  const operations = ['priority-hold', 'priority-hold', 'priority-pass', 'priority-pass', 'priority-resolve'] as const;
  const steps = input.steps.map((step, index) => readStep(step, operations[index]));
  if (steps.some((step) => step === null)) return failure('STEP_OR_RECEIPT_INVALID');
  const [holdSet, holdClear, firstPass, finalPass, resolve] = steps as readonly PriorityStepObservationV1[];
  if (holdSet === undefined || holdClear === undefined || firstPass === undefined || finalPass === undefined || resolve === undefined) return failure('INVALID_OBSERVATION');
  const playerIds = input.playerIds as readonly string[];
  if (steps.some((step) => step === null || !playerIds.includes(step.actorPlayerId))) return failure('ACTOR_NOT_SEATED');
  if (steps.some((step) => step !== null && step.seats.some((seat) =>
    (seat.holderPlayerId !== null && !playerIds.includes(seat.holderPlayerId))
    || (seat.stewardPlayerId !== null && !playerIds.includes(seat.stewardPlayerId))
    || seat.holds.some((playerId) => !playerIds.includes(playerId))))) {
    return failure('STATE_ID_NOT_SEATED');
  }
  for (let index = 1; index < steps.length; index += 1) {
    const previous = steps[index - 1];
    const current = steps[index];
    if (previous === null || current === null || current.receipt.baseRevision !== previous.receipt.acceptedRevision) return failure('REVISION_SEQUENCE_BROKEN');
  }
  const setSeat = holdSet.seats[0];
  const clearSeat = holdClear.seats[0];
  const firstSeat = firstPass.seats[0];
  const finalSeat = finalPass.seats[0];
  const resolvedSeat = resolve.seats[0];
  if (setSeat === undefined || clearSeat === undefined || firstSeat === undefined || finalSeat === undefined || resolvedSeat === undefined) return failure('INVALID_OBSERVATION');
  if (setSeat.holds.length !== 1 || setSeat.holds[0] !== holdSet.actorPlayerId) return failure('HOLD_SET_DIVERGED');
  if (holdClear.actorPlayerId !== holdSet.actorPlayerId || clearSeat.holds.length !== 0) return failure('HOLD_CLEAR_DIVERGED');
  if (setSeat.windowKind !== 'priority' || clearSeat.windowKind !== 'priority'
    || setSeat.holderPlayerId === null || setSeat.holderPlayerId !== clearSeat.holderPlayerId
    || setSeat.stewardPlayerId === null || setSeat.stewardPlayerId !== clearSeat.stewardPlayerId) {
    return failure('HOLD_WINDOW_DIVERGED');
  }
  if ([setSeat, clearSeat, firstSeat, finalSeat].some((seat) => seat.stackCount !== 1 || seat.topObjectId !== input.capturedTopObjectId)) return failure('CAPTURED_TOP_DIVERGED');
  if (firstPass.actorPlayerId !== clearSeat.holderPlayerId
    || firstSeat.windowKind !== 'priority'
    || firstSeat.holderPlayerId === null
    || firstSeat.holderPlayerId === firstPass.actorPlayerId) return failure('PRIORITY_DID_NOT_ADVANCE');
  if (finalPass.actorPlayerId !== firstSeat.holderPlayerId
    || finalSeat.windowKind !== 'resolution-ready'
    || finalSeat.holderPlayerId !== null) return failure('RESOLUTION_NOT_READY');
  if (resolve.actorPlayerId !== finalSeat.stewardPlayerId) return failure('RESOLVE_ACTOR_NOT_STEWARD');
  if (resolvedSeat.stackCount !== 0 || resolvedSeat.topObjectId !== null
    || resolvedSeat.recentResolutionObjectId !== input.capturedTopObjectId
    || resolvedSeat.recentResolutionRevision !== resolve.receipt.acceptedRevision) return failure('CAPTURED_TOP_NOT_RESOLVED');
  return Object.freeze({
    ok: true,
    value: Object.freeze({
      startRevision: holdSet.receipt.baseRevision,
      resolvedRevision: resolve.receipt.acceptedRevision,
      seatCount: 2,
      receiptsAccepted: true,
      revisionsConverged: true,
      holdConverged: true,
      priorityCycleComplete: true,
      capturedTopResolved: true,
    }),
  });
}
