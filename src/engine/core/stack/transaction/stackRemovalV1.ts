import type { CoreObjectId, CorePlayerId } from '../../ids';
import { isCanonicalCoreObjectIdV2 } from '../../object/objectIdV2';
import {
  createCoreCardObjectIdentityV2,
  type CoreCardObjectIdentityV2,
} from '../../object/tokenObjectV2';
import {
  createModeNeutralCoreObjectRegistryStateV2,
  createModeNeutralCoreObjectRuntimeStateV2,
  type ModeNeutralCoreObjectRegistrySliceV2,
  type ModeNeutralCoreObjectRuntimeStateV2,
} from '../../object/objectRegistryStateV2';
import {
  createDefaultCoreCardRuntimeAfterZoneChangeV1,
  nextCoreCardIncarnationV1,
  nextCoreCardObjectIdV1,
} from '../../transition/cardReincarnation';
import {
  validateCoreCardZoneDestinationV1,
  type CoreCardZoneDestinationV1,
} from '../../transition/zoneDestination';
import {
  createModeNeutralCoreStackAnnouncementSliceV1,
} from '../stackAnnouncementSliceV1';
import type { ModeNeutralCoreStackAnnouncementSliceV1 } from '../stackAnnouncementSliceV1';
import type { CoreZonesV1 } from '../../identityZoneState';
import {
  deepFreezeStackTransactionV1,
  locateCoreObjectExactlyOnceV1,
  rebuildArrayWithoutIndexV1,
  rebuildRecordWithKeyV1,
  rebuildRecordWithoutKeyV1,
  rebuildRuntimeForCardObjectReplacementV1,
} from './internalStackTransactionV1';
import type { CoreStackTransactionBundleV1 } from './stackTransactionBundleV1';
import { CoreStackTransactionErrorV1 } from './stackTransactionErrorV1';
import {
  validateCoreStackTransactionBundleV1,
  type CoreStackTransactionValidationCodeV1,
  type CoreStackTransactionValidationIssueV1,
} from './stackTransactionValidationV1';

export type CoreNonStackCardZoneDestinationV1 = Exclude<
  CoreCardZoneDestinationV1,
  { readonly kind: 'stack' }
>;

export type CoreStackRemovalInputV1 =
  | Readonly<{
      readonly kind: 'card-to-zone';
      readonly objectId: CoreObjectId;
      readonly destination: CoreNonStackCardZoneDestinationV1;
    }>
  | Readonly<{
      readonly kind: 'cease';
      readonly objectId: CoreObjectId;
    }>;

export type CoreStackRemovalResultV1 = Readonly<{
  readonly bundle: CoreStackTransactionBundleV1;
  readonly removedObjectId: CoreObjectId;
  readonly nextObjectId: CoreObjectId | null;
}>;

type RawRecord = Record<string, unknown>;
type RemovalOperation =
  | Readonly<{
      readonly kind: 'card-to-zone';
      readonly objectId: CoreObjectId;
      readonly destination: CoreNonStackCardZoneDestinationV1;
    }>
  | Readonly<{
      readonly kind: 'cease';
      readonly objectId: CoreObjectId;
    }>;

const OPERATION_FIELDS = ['kind', 'objectId', 'destination'] as const;
const SYNTHETIC_KINDS = new Set(['spell-copy', 'activated-ability', 'triggered-ability']);
type DestinationLocation =
  | Readonly<{
      readonly scope: 'player-scoped';
      readonly playerId: CorePlayerId;
      readonly zone: 'library' | 'hand' | 'graveyard';
    }>
  | Readonly<{
      readonly scope: 'shared';
      readonly playerId: null;
      readonly zone: 'battlefield' | 'exile' | 'command';
    }>;

function issue(
  code: CoreStackTransactionValidationCodeV1,
  path: string,
  message: string,
  nested?: readonly { readonly code: string; readonly path: string; readonly message: string }[],
): CoreStackTransactionValidationIssueV1 {
  return {
    code,
    path,
    message,
    ...(nested === undefined ? {} : { nested: nested.map((current) => ({ ...current })) }),
  };
}

function fail(
  code: CoreStackTransactionValidationCodeV1,
  path: string,
  message: string,
  nested?: readonly { readonly code: string; readonly path: string; readonly message: string }[],
): never {
  throw new CoreStackTransactionErrorV1(code, [issue(code, path, message, nested)]);
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

function pointer(path: string, field: string): string {
  return `${path}/${field.replaceAll('~', '~0').replaceAll('/', '~1')}`;
}

function hasOwn(record: RawRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function operationFailure(path: string, message: string): never {
  fail('INVALID_OPERATION_INPUT', path, message);
}

function readStrictRecord(value: unknown): RawRecord {
  if (!isPlainRecord(value)) operationFailure('', 'Removal input must be a plain object');

  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    operationFailure('', 'Removal input descriptors are not readable');
  }

  const result = Object.create(null) as RawRecord;
  for (const key of keys) {
    if (typeof key !== 'string') operationFailure('/[symbol]', 'Symbol fields are not allowed');
    if (!OPERATION_FIELDS.includes(key as (typeof OPERATION_FIELDS)[number])) {
      operationFailure(pointer('', key), `Unknown field: ${key}`);
    }
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      operationFailure(pointer('', key), 'Field descriptor is not readable');
    }
    if (descriptor === undefined || descriptor.enumerable !== true) {
      operationFailure(pointer('', key), 'Fields must be enumerable');
    }
    if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      operationFailure(pointer('', key), 'Accessor properties are not allowed');
    }
    result[key] = descriptor.value;
  }
  for (const field of ['kind', 'objectId'] as const) {
    if (!hasOwn(result, field)) operationFailure(pointer('', field), `Missing field: ${field}`);
  }
  return result;
}

function readOperation(input: unknown): RemovalOperation {
  const record = readStrictRecord(input);
  if (record.kind !== 'card-to-zone' && record.kind !== 'cease') {
    operationFailure('/kind', 'Removal kind must be card-to-zone or cease');
  }
  if (!isCanonicalCoreObjectIdV2(record.objectId)) {
    operationFailure('/objectId', 'Object ID must be a canonical Core object ID V2');
  }

  if (record.kind === 'cease') {
    if (hasOwn(record, 'destination')) {
      operationFailure('/destination', 'Cease input must not contain a destination');
    }
    return { kind: 'cease', objectId: record.objectId };
  }

  if (!hasOwn(record, 'destination')) operationFailure('/destination', 'Card-to-zone input requires a destination');
  let destinationValidation: ReturnType<typeof validateCoreCardZoneDestinationV1>;
  try {
    destinationValidation = validateCoreCardZoneDestinationV1(record.destination);
  } catch {
    fail('INVALID_DESTINATION', '/destination', 'Zone destination could not be inspected safely');
  }
  if (!destinationValidation.ok) {
    fail(
      'INVALID_DESTINATION',
      '/destination',
      'Zone destination is invalid',
      destinationValidation.issues,
    );
  }
  if (destinationValidation.value.kind === 'stack') {
    fail('INVALID_DESTINATION', '/destination/kind', 'Stack is not a removal destination');
  }
  return {
    kind: 'card-to-zone',
    objectId: record.objectId,
    destination: destinationValidation.value,
  };
}

function invalidBundle(input: unknown): CoreStackTransactionBundleV1 {
  let result: ReturnType<typeof validateCoreStackTransactionBundleV1>;
  try {
    result = validateCoreStackTransactionBundleV1(input);
  } catch {
    fail('INVALID_TRANSACTION_BUNDLE', '', 'Transaction bundle input could not be inspected safely');
  }
  if (!result.ok) {
    fail(
      'INVALID_TRANSACTION_BUNDLE',
      '',
      'Transaction bundle input is invalid',
      result.issues.flatMap((current) => current.nested ?? [{
        code: current.code,
        path: current.path,
        message: current.message,
      }]),
    );
  }
  return result.value;
}

function candidateFailure(message: string, error: unknown): never {
  const nested = error instanceof CoreStackTransactionErrorV1
    ? error.issues.flatMap((current) => current.nested ?? [{
      code: current.code,
      path: current.path,
      message: current.message,
    }])
    : [{
      code: 'INVALID_CANDIDATE',
      path: '',
      message: error instanceof Error && error.message.length > 0
        ? `${message}: ${error.message}`
        : message,
    }];
  fail('CANDIDATE_INVALID', '', message, nested);
}

function stackWithout(
  registry: ModeNeutralCoreObjectRegistrySliceV2,
  stackIndex: number,
): CoreZonesV1 {
  return {
    byPlayer: registry.zones.byPlayer,
    shared: {
      ...registry.zones.shared,
      stack: rebuildArrayWithoutIndexV1(registry.zones.shared.stack, stackIndex),
    },
  };
}

function destinationZone(
  registry: ModeNeutralCoreObjectRegistrySliceV2,
  card: CoreCardObjectIdentityV2,
  destination: CoreNonStackCardZoneDestinationV1,
): DestinationLocation {
  const ownerPlayerId = registry.physicalCards[card.physicalCardId].ownerPlayerId;
  if (destination.kind === 'owner-library') return { scope: 'player-scoped', playerId: ownerPlayerId, zone: 'library' };
  if (destination.kind === 'owner-hand') return { scope: 'player-scoped', playerId: ownerPlayerId, zone: 'hand' };
  if (destination.kind === 'owner-graveyard') return { scope: 'player-scoped', playerId: ownerPlayerId, zone: 'graveyard' };
  return { scope: 'shared', playerId: null, zone: destination.kind };
}

function zonesWithCardDestination(
  registry: ModeNeutralCoreObjectRegistrySliceV2,
  card: CoreCardObjectIdentityV2,
  destination: CoreNonStackCardZoneDestinationV1,
  stackIndex: number,
  nextObjectId: CoreObjectId,
): ModeNeutralCoreObjectRegistrySliceV2['zones'] {
  const target = destinationZone(registry, card, destination);
  const byPlayer: Record<string, { readonly library: readonly CoreObjectId[]; readonly hand: readonly CoreObjectId[]; readonly graveyard: readonly CoreObjectId[] }> = Object.create(null) as Record<string, { readonly library: readonly CoreObjectId[]; readonly hand: readonly CoreObjectId[]; readonly graveyard: readonly CoreObjectId[] }>;
  for (const playerId of registry.turnOrder) {
    const current = registry.zones.byPlayer[playerId];
    const zones = {
      library: current.library.slice(),
      hand: current.hand.slice(),
      graveyard: current.graveyard.slice(),
    };
    if (target.scope === 'player-scoped' && target.playerId === playerId) {
      const zone = zones[target.zone];
      if (target.zone === 'library' && destination.kind === 'owner-library') {
        const index = destination.placement.kind === 'top'
          ? 0
          : destination.placement.kind === 'bottom'
            ? zone.length
            : destination.placement.index;
        if (index > zone.length) fail('INVALID_DESTINATION', '/destination/placement/index', 'Library placement index exceeds the destination length');
        zone.splice(index, 0, nextObjectId);
      } else {
        zone.push(nextObjectId);
      }
    }
    byPlayer[playerId] = zones;
  }

  const shared: {
    battlefield: CoreObjectId[];
    stack: CoreObjectId[];
    exile: CoreObjectId[];
    command: CoreObjectId[];
  } = {
    battlefield: registry.zones.shared.battlefield.slice(),
    stack: rebuildArrayWithoutIndexV1(registry.zones.shared.stack, stackIndex).slice(),
    exile: registry.zones.shared.exile.slice(),
    command: registry.zones.shared.command.slice(),
  };
  if (target.scope === 'shared') shared[target.zone].push(nextObjectId);
  return { byPlayer, shared };
}

function zonesWithCeasedObject(
  registry: ModeNeutralCoreObjectRegistrySliceV2,
  stackIndex: number,
): ModeNeutralCoreObjectRegistrySliceV2['zones'] {
  return stackWithout(registry, stackIndex);
}

function buildCandidate(
  bundle: CoreStackTransactionBundleV1,
  operation: RemovalOperation,
  stackIndex: number,
  nextObjectId: CoreObjectId | null,
): CoreStackTransactionBundleV1 {
  const source = bundle.objectRegistry.objects[operation.objectId];
  let nextRegistry: ModeNeutralCoreObjectRegistrySliceV2;
  let nextRuntime: ModeNeutralCoreObjectRuntimeStateV2;
  let nextAnnouncements: ModeNeutralCoreStackAnnouncementSliceV1;

  try {
    let nextCard: CoreCardObjectIdentityV2 | null = null;
    if (operation.kind === 'card-to-zone') {
      const nextCardInput = {
        kind: 'card' as const,
        physicalCardId: (source as CoreCardObjectIdentityV2).physicalCardId,
        incarnation: nextCoreCardIncarnationV1((source as CoreCardObjectIdentityV2).incarnation),
        baseControllerPlayerId: operation.destination.kind === 'battlefield'
          ? operation.destination.baseControllerPlayerId
          : null,
      };
      nextCard = createCoreCardObjectIdentityV2(nextCardInput);
    }
    const nextObjects = operation.kind === 'cease'
      ? rebuildRecordWithoutKeyV1(bundle.objectRegistry.objects, operation.objectId)
      : rebuildRecordWithKeyV1(
        rebuildRecordWithoutKeyV1(bundle.objectRegistry.objects, operation.objectId),
        nextObjectId as CoreObjectId,
        nextCard as CoreCardObjectIdentityV2,
      );
    const zones = operation.kind === 'cease'
      ? zonesWithCeasedObject(bundle.objectRegistry, stackIndex)
      : zonesWithCardDestination(
        bundle.objectRegistry,
        source as CoreCardObjectIdentityV2,
        operation.destination,
        stackIndex,
        nextObjectId as CoreObjectId,
      );
    nextRegistry = createModeNeutralCoreObjectRegistryStateV2({
      players: bundle.objectRegistry.players,
      turnOrder: bundle.objectRegistry.turnOrder,
      activePlayerId: bundle.objectRegistry.activePlayerId,
      cardDefinitions: bundle.objectRegistry.cardDefinitions,
      physicalCards: bundle.objectRegistry.physicalCards,
      objects: nextObjects,
      zones,
    });

    const runtimeByObject = operation.kind === 'cease'
      ? rebuildRecordWithoutKeyV1(bundle.objectRuntime.byObject, '__no_runtime_removed__')
      : rebuildRuntimeForCardObjectReplacementV1(
        bundle.objectRuntime.byObject,
        operation.objectId,
        nextObjectId as CoreObjectId,
        createDefaultCoreCardRuntimeAfterZoneChangeV1(),
      );
    nextRuntime = createModeNeutralCoreObjectRuntimeStateV2(nextRegistry, { byObject: runtimeByObject });

    nextAnnouncements = createModeNeutralCoreStackAnnouncementSliceV1(nextRegistry, {
      byObject: rebuildRecordWithoutKeyV1(bundle.stackAnnouncements.byObject, operation.objectId),
    });
  } catch (error: unknown) {
    candidateFailure('Stack removal candidate construction failed', error);
  }

  let finalResult: ReturnType<typeof validateCoreStackTransactionBundleV1>;
  try {
    finalResult = validateCoreStackTransactionBundleV1({
      objectRegistry: nextRegistry,
      objectRuntime: nextRuntime,
      stackAnnouncements: nextAnnouncements,
    });
  } catch (error: unknown) {
    candidateFailure('Stack removal candidate could not be inspected safely', error);
  }
  if (!finalResult.ok) {
    fail(
      'CANDIDATE_INVALID',
      '',
      'Stack removal candidate bundle is invalid',
      finalResult.issues.flatMap((current) => current.nested ?? [{
        code: current.code,
        path: current.path,
        message: current.message,
      }]),
    );
  }
  return finalResult.value;
}

function removeStackObject(
  bundleInput: unknown,
  operationInput: unknown,
): CoreStackRemovalResultV1 {
  const bundle = invalidBundle(bundleInput);
  const operation = readOperation(operationInput);
  const source = bundle.objectRegistry.objects[operation.objectId];
  if (source === undefined) fail('SOURCE_NOT_FOUND', '/objectId', 'Source object is not present in the Registry');

  const location = locateCoreObjectExactlyOnceV1(bundle.objectRegistry, operation.objectId);
  if (location === null || location.zone !== 'stack') {
    fail('SOURCE_NOT_ON_STACK', '/objectId', 'Source object is not present on the shared stack');
  }

  if (operation.kind === 'card-to-zone' && source.kind !== 'card') {
    fail('OBJECT_KIND_MISMATCH', '/objectId', 'Card-to-zone removal requires a card object');
  }
  if (operation.kind === 'cease' && !SYNTHETIC_KINDS.has(source.kind)) {
    fail('OBJECT_KIND_MISMATCH', '/objectId', 'Cease removal requires a synthetic stack object');
  }

  let nextObjectId: CoreObjectId | null = null;
  if (operation.kind === 'card-to-zone') {
    try {
      nextCoreCardIncarnationV1((source as CoreCardObjectIdentityV2).incarnation);
      nextObjectId = nextCoreCardObjectIdV1(
        (source as CoreCardObjectIdentityV2).physicalCardId,
        (source as CoreCardObjectIdentityV2).incarnation,
      );
    } catch {
      fail('CARD_TRANSITION_FAILED', '/objectId', 'Card incarnation transition could not be derived');
    }
    if (Object.prototype.hasOwnProperty.call(bundle.objectRegistry.objects, nextObjectId)) {
      fail('ID_COLLISION', '/nextObjectId', 'Derived card ObjectId already exists');
    }
  }

  const candidate = buildCandidate(bundle, operation, location.index, nextObjectId);
  return deepFreezeStackTransactionV1({
    bundle: candidate,
    removedObjectId: operation.objectId,
    nextObjectId,
  });
}

export function removeCoreStackObjectV1(
  bundleInput: unknown,
  operationInput: unknown,
): CoreStackRemovalResultV1 {
  try {
    return removeStackObject(bundleInput, operationInput);
  } catch (error: unknown) {
    if (error instanceof CoreStackTransactionErrorV1) throw error;
    throw new CoreStackTransactionErrorV1('INVALID_OPERATION_INPUT', [
      issue(
        'INVALID_OPERATION_INPUT',
        '',
        'Stack removal input could not be inspected safely',
        [{ code: 'INVALID_TYPE', path: '', message: 'Input descriptors are not readable' }],
      ),
    ]);
  }
}
