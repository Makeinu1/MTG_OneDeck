import type { CoreObjectId, CorePlayerId } from '../../ids';
import { isCoreBaseId } from '../../ids';
import { isCanonicalCoreObjectIdV2 } from '../../object/objectIdV2';
import {
  createCoreCardObjectIdentityV2,
  type CoreCardObjectIdentityV2,
} from '../../object/tokenObjectV2';
import {
  createModeNeutralCoreObjectRegistryStateV2,
  createModeNeutralCoreObjectRuntimeStateV2,
  type ModeNeutralCoreObjectRegistrySliceV2,
} from '../../object/objectRegistryStateV2';
import {
  createDefaultCoreCardRuntimeAfterZoneChangeV1,
  nextCoreCardIncarnationV1,
  nextCoreCardObjectIdV1,
} from '../../transition/cardReincarnation';
import type { CoreZonesV1 } from '../../identityZoneState';
import {
  createModeNeutralCoreStackAnnouncementSliceV1,
} from '../stackAnnouncementSliceV1';
import type { CoreStackAnnouncementRecordV1 } from '../stackAnnouncementRecordV1';
import {
  deepFreezeStackTransactionV1,
  locateCoreObjectExactlyOnceV1,
  rebuildArrayWithAppendedValueV1,
  rebuildArrayWithoutIndexV1,
  rebuildRecordWithKeyV1,
  rebuildRecordWithoutKeyV1,
} from './internalStackTransactionV1';
import {
  CoreStackTransactionErrorV1,
} from './stackTransactionErrorV1';
import {
  validateCoreStackTransactionBundleV1,
  type CoreStackTransactionValidationIssueV1,
} from './stackTransactionValidationV1';
import type {
  CoreStackTransactionBundleV1,
} from './stackTransactionBundleV1';

export type CoreCardSpellCommitInputV1 = Readonly<{
  readonly sourceObjectId: CoreObjectId;
  readonly controllerPlayerId: CorePlayerId;
  readonly announcement: Extract<CoreStackAnnouncementRecordV1, { readonly kind: 'card-spell' }>;
}>;

export type CoreCardSpellCommitResultV1 = Readonly<{
  readonly bundle: CoreStackTransactionBundleV1;
  readonly previousObjectId: CoreObjectId;
  readonly committedObjectId: CoreObjectId;
}>;

type RawRecord = Record<string, unknown>;

const OPERATION_FIELDS = ['sourceObjectId', 'controllerPlayerId', 'announcement'] as const;
const ANNOUNCEMENT_FIELDS = [
  'kind',
  'abilityTextSnapshot',
  'chosenModeKeys',
  'targetSelections',
  'announcedVariables',
  'distributions',
  'costChoices',
] as const;

function issue(
  code: 'INVALID_TRANSACTION_BUNDLE' | 'INVALID_OPERATION_INPUT' | 'SOURCE_NOT_FOUND' | 'SOURCE_ALREADY_ON_STACK' | 'OBJECT_KIND_MISMATCH' | 'ANNOUNCEMENT_KIND_MISMATCH' | 'ID_COLLISION' | 'CARD_TRANSITION_FAILED' | 'CANDIDATE_INVALID',
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
  code: 'INVALID_TRANSACTION_BUNDLE' | 'INVALID_OPERATION_INPUT' | 'SOURCE_NOT_FOUND' | 'SOURCE_ALREADY_ON_STACK' | 'OBJECT_KIND_MISMATCH' | 'ANNOUNCEMENT_KIND_MISMATCH' | 'ID_COLLISION' | 'CARD_TRANSITION_FAILED' | 'CANDIDATE_INVALID',
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

function operationInputFailure(path: string, message: string): never {
  fail('INVALID_OPERATION_INPUT', path, message);
}

function readStrictRecord(
  value: unknown,
  allowedFields: readonly string[],
  path: string,
  requiredFields = allowedFields,
): RawRecord {
  if (!isPlainRecord(value)) operationInputFailure(path, 'Expected a plain object');

  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    operationInputFailure(path, 'Object descriptors are not readable');
  }
  const result = Object.create(null) as RawRecord;
  for (const key of keys) {
    if (typeof key !== 'string') operationInputFailure(pointer(path, '[symbol]'), 'Symbol fields are not allowed');
    if (!allowedFields.includes(key)) operationInputFailure(pointer(path, key), `Unknown field: ${key}`);
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      operationInputFailure(pointer(path, key), 'Field descriptor is not readable');
    }
    if (descriptor === undefined || descriptor.enumerable !== true) {
      operationInputFailure(pointer(path, key), 'Fields must be enumerable');
    }
    if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      operationInputFailure(pointer(path, key), 'Accessor properties are not allowed');
    }
    result[key] = descriptor.value;
  }
  for (const field of requiredFields) {
    if (!Object.prototype.hasOwnProperty.call(result, field)) {
      operationInputFailure(pointer(path, field), `Missing field: ${field}`);
    }
  }
  return result;
}

function readStrictArray(
  value: unknown,
  path: string,
  mapValue: (value: unknown, index: number) => unknown,
): readonly unknown[] {
  let isArray: boolean;
  try {
    isArray = Array.isArray(value);
  } catch {
    operationInputFailure(path, 'Array shape is not readable');
  }
  if (!isArray) operationInputFailure(path, 'Expected an array');
  try {
    if (Reflect.getPrototypeOf(value as object) !== Array.prototype) {
      operationInputFailure(path, 'Expected an ordinary array');
    }
  } catch {
    operationInputFailure(path, 'Array prototype is not readable');
  }

  let length: unknown;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, 'length');
    length = descriptor?.value;
  } catch {
    operationInputFailure(pointer(path, 'length'), 'Array length is not readable');
  }
  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) {
    operationInputFailure(pointer(path, 'length'), 'Array length must be a nonnegative safe integer');
  }

  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(value as object);
  } catch {
    operationInputFailure(path, 'Array descriptors are not readable');
  }
  const allowed = new Set<string>(['length']);
  for (let index = 0; index < length; index += 1) allowed.add(String(index));
  for (const key of keys) {
    if (typeof key !== 'string' || !allowed.has(key)) {
      operationInputFailure(pointer(path, typeof key === 'string' ? key : '[symbol]'), 'Extra array properties are not allowed');
    }
  }
  const result: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const key = String(index);
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      operationInputFailure(pointer(path, key), 'Array entry descriptor is not readable');
    }
    if (descriptor === undefined || descriptor.enumerable !== true) {
      operationInputFailure(pointer(path, key), 'Sparse or non-enumerable array entry');
    }
    if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      operationInputFailure(pointer(path, key), 'Accessor array entries are not allowed');
    }
    result.push(mapValue(descriptor.value, index));
  }
  return result;
}

function scalar(value: unknown, path: string): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  operationInputFailure(path, 'Expected a scalar value');
}

function snapshotTarget(value: unknown, path: string): unknown {
  const initial = readStrictRecord(value, ['kind', 'objectId', 'playerId'], path, ['kind']);
  if (initial.kind === 'object') {
    const target = readStrictRecord(value, ['kind', 'objectId'], path);
    return { kind: target.kind, objectId: scalar(target.objectId, pointer(path, 'objectId')) };
  }
  if (initial.kind === 'player') {
    const target = readStrictRecord(value, ['kind', 'playerId'], path);
    return { kind: target.kind, playerId: scalar(target.playerId, pointer(path, 'playerId')) };
  }
  operationInputFailure(pointer(path, 'kind'), 'Invalid target kind');
}

function snapshotAnnouncement(
  value: unknown,
): Extract<CoreStackAnnouncementRecordV1, { readonly kind: 'card-spell' }> {
  const record = readStrictRecord(value, ANNOUNCEMENT_FIELDS, '/announcement');
  if (record.kind !== 'card-spell') {
    fail('ANNOUNCEMENT_KIND_MISMATCH', '/announcement/kind', 'Card spell commit requires a card-spell announcement');
  }
  const chosenModeKeys = readStrictArray(
    record.chosenModeKeys,
    '/announcement/chosenModeKeys',
    (entry, index) => scalar(entry, `/announcement/chosenModeKeys/${index}`),
  );
  const targetSelections = readStrictArray(
    record.targetSelections,
    '/announcement/targetSelections',
    (entry, index) => {
      const path = `/announcement/targetSelections/${index}`;
      const selection = readStrictRecord(entry, ['selectionId', 'groupKey', 'target'], path);
      return {
        selectionId: scalar(selection.selectionId, pointer(path, 'selectionId')),
        groupKey: scalar(selection.groupKey, pointer(path, 'groupKey')),
        target: snapshotTarget(selection.target, pointer(path, 'target')),
      };
    },
  );
  const announcedVariables = readStrictArray(
    record.announcedVariables,
    '/announcement/announcedVariables',
    (entry, index) => {
      const path = `/announcement/announcedVariables/${index}`;
      const variable = readStrictRecord(entry, ['variableKey', 'value'], path);
      return {
        variableKey: scalar(variable.variableKey, pointer(path, 'variableKey')),
        value: scalar(variable.value, pointer(path, 'value')),
      };
    },
  );
  const distributions = readStrictArray(
    record.distributions,
    '/announcement/distributions',
    (entry, index) => {
      const path = `/announcement/distributions/${index}`;
      const distribution = readStrictRecord(entry, ['distributionKey', 'assignments'], path);
      const assignments = readStrictArray(
        distribution.assignments,
        pointer(path, 'assignments'),
        (assignment, assignmentIndex) => {
          const assignmentPath = `${path}/assignments/${assignmentIndex}`;
          const row = readStrictRecord(assignment, ['targetSelectionId', 'amount'], assignmentPath);
          return {
            targetSelectionId: scalar(row.targetSelectionId, pointer(assignmentPath, 'targetSelectionId')),
            amount: scalar(row.amount, pointer(assignmentPath, 'amount')),
          };
        },
      );
      return {
        distributionKey: scalar(distribution.distributionKey, pointer(path, 'distributionKey')),
        assignments,
      };
    },
  );
  const costs = readStrictRecord(record.costChoices, ['alternativeCost', 'additionalCosts'], '/announcement/costChoices');
  const alternativeCost = costs.alternativeCost === null
    ? null
    : (() => {
      const alternative = readStrictRecord(costs.alternativeCost, ['costKey'], '/announcement/costChoices/alternativeCost');
      return { costKey: scalar(alternative.costKey, '/announcement/costChoices/alternativeCost/costKey') as string };
    })();
  const additionalCosts = readStrictArray(
    costs.additionalCosts,
    '/announcement/costChoices/additionalCosts',
    (entry, index) => {
      const path = `/announcement/costChoices/additionalCosts/${index}`;
      const cost = readStrictRecord(entry, ['costKey', 'times'], path);
      return {
        costKey: scalar(cost.costKey, pointer(path, 'costKey')),
        times: scalar(cost.times, pointer(path, 'times')),
      };
    },
  );

  if (record.abilityTextSnapshot !== null) {
    operationInputFailure('/announcement/abilityTextSnapshot', 'Card spell abilityTextSnapshot must be null');
  }
  return {
    kind: 'card-spell',
    abilityTextSnapshot: null,
    chosenModeKeys: chosenModeKeys as readonly string[],
    targetSelections: targetSelections as CoreStackAnnouncementRecordV1['targetSelections'],
    announcedVariables: announcedVariables as CoreStackAnnouncementRecordV1['announcedVariables'],
    distributions: distributions as CoreStackAnnouncementRecordV1['distributions'],
    costChoices: {
      alternativeCost,
      additionalCosts: additionalCosts as CoreStackAnnouncementRecordV1['costChoices']['additionalCosts'],
    },
  };
}

function readOperationInput(value: unknown): CoreCardSpellCommitInputV1 {
  const record = readStrictRecord(value, OPERATION_FIELDS, '');
  if (!isCanonicalCoreObjectIdV2(record.sourceObjectId)) {
    operationInputFailure('/sourceObjectId', 'sourceObjectId must be a canonical Core object ID V2');
  }
  if (!isCoreBaseId(record.controllerPlayerId)) {
    operationInputFailure('/controllerPlayerId', 'controllerPlayerId must be a canonical Core player ID');
  }
  return {
    sourceObjectId: record.sourceObjectId,
    controllerPlayerId: record.controllerPlayerId as CorePlayerId,
    announcement: snapshotAnnouncement(record.announcement),
  };
}

function candidateNestedIssues(error: unknown): readonly { readonly code: string; readonly path: string; readonly message: string }[] {
  if (error instanceof CoreStackTransactionErrorV1) {
    return error.issues.flatMap((current) => current.nested ?? [{
      code: current.code,
      path: current.path,
      message: current.message,
    }]);
  }
  return [{ code: 'CANDIDATE_ERROR', path: '', message: 'Candidate construction failed' }];
}

function replaceSourceInZones(
  registry: ModeNeutralCoreObjectRegistrySliceV2,
  sourceLocation: ReturnType<typeof locateCoreObjectExactlyOnceV1> & object,
  committedObjectId: CoreObjectId,
): CoreZonesV1 {
  const byPlayer: Record<string, ModeNeutralCoreObjectRegistrySliceV2['zones']['byPlayer'][CorePlayerId]> = Object.create(null) as Record<string, ModeNeutralCoreObjectRegistrySliceV2['zones']['byPlayer'][CorePlayerId]>;
  for (const playerId of registry.turnOrder) {
    const current = registry.zones.byPlayer[playerId];
    byPlayer[playerId] = {
      library: sourceLocation.scope === 'player-scoped' && sourceLocation.playerId === playerId && sourceLocation.zone === 'library'
        ? rebuildArrayWithoutIndexV1(current.library, sourceLocation.index) : current.library.slice(),
      hand: sourceLocation.scope === 'player-scoped' && sourceLocation.playerId === playerId && sourceLocation.zone === 'hand'
        ? rebuildArrayWithoutIndexV1(current.hand, sourceLocation.index) : current.hand.slice(),
      graveyard: sourceLocation.scope === 'player-scoped' && sourceLocation.playerId === playerId && sourceLocation.zone === 'graveyard'
        ? rebuildArrayWithoutIndexV1(current.graveyard, sourceLocation.index) : current.graveyard.slice(),
    };
  }
  const shared = {
    battlefield: sourceLocation.scope === 'shared' && sourceLocation.zone === 'battlefield'
      ? rebuildArrayWithoutIndexV1(registry.zones.shared.battlefield, sourceLocation.index) : registry.zones.shared.battlefield.slice(),
    stack: sourceLocation.scope === 'shared' && sourceLocation.zone === 'stack'
      ? rebuildArrayWithoutIndexV1(registry.zones.shared.stack, sourceLocation.index) : registry.zones.shared.stack.slice(),
    exile: sourceLocation.scope === 'shared' && sourceLocation.zone === 'exile'
      ? rebuildArrayWithoutIndexV1(registry.zones.shared.exile, sourceLocation.index) : registry.zones.shared.exile.slice(),
    command: sourceLocation.scope === 'shared' && sourceLocation.zone === 'command'
      ? rebuildArrayWithoutIndexV1(registry.zones.shared.command, sourceLocation.index) : registry.zones.shared.command.slice(),
  };
  return {
    byPlayer,
    shared: {
      ...shared,
      stack: rebuildArrayWithAppendedValueV1(shared.stack, committedObjectId),
    },
  };
}

function buildCandidateBundle(
  bundle: CoreStackTransactionBundleV1,
  input: CoreCardSpellCommitInputV1,
  sourceLocation: ReturnType<typeof locateCoreObjectExactlyOnceV1> & object,
  committedObjectId: CoreObjectId,
  nextIncarnation: number,
): CoreStackTransactionBundleV1 {
  const source = bundle.objectRegistry.objects[input.sourceObjectId] as CoreCardObjectIdentityV2;
  const nextCard = createCoreCardObjectIdentityV2({
    kind: 'card',
    physicalCardId: source.physicalCardId,
    incarnation: nextIncarnation,
    baseControllerPlayerId: input.controllerPlayerId,
  });
  const nextObjects = rebuildRecordWithKeyV1(
    rebuildRecordWithoutKeyV1(bundle.objectRegistry.objects, input.sourceObjectId),
    committedObjectId,
    nextCard,
  );
  const nextRegistry = createModeNeutralCoreObjectRegistryStateV2({
    players: bundle.objectRegistry.players,
    turnOrder: bundle.objectRegistry.turnOrder,
    activePlayerId: bundle.objectRegistry.activePlayerId,
    cardDefinitions: bundle.objectRegistry.cardDefinitions,
    physicalCards: bundle.objectRegistry.physicalCards,
    objects: nextObjects,
    zones: replaceSourceInZones(bundle.objectRegistry, sourceLocation, committedObjectId),
  });
  const nextRuntime = createModeNeutralCoreObjectRuntimeStateV2(
    nextRegistry,
    {
      byObject: rebuildRecordWithKeyV1(
        rebuildRecordWithoutKeyV1(bundle.objectRuntime.byObject, input.sourceObjectId),
        committedObjectId,
        createDefaultCoreCardRuntimeAfterZoneChangeV1(),
      ),
    },
  );
  const nextAnnouncements = createModeNeutralCoreStackAnnouncementSliceV1(
    nextRegistry,
    {
      byObject: rebuildRecordWithKeyV1(
        bundle.stackAnnouncements.byObject,
        committedObjectId,
        input.announcement,
      ),
    },
  );
  const candidate = validateCoreStackTransactionBundleV1({
    objectRegistry: nextRegistry,
    objectRuntime: nextRuntime,
    stackAnnouncements: nextAnnouncements,
  });
  if (!candidate.ok) {
    fail('CANDIDATE_INVALID', '', 'Card spell commit candidate bundle is invalid', candidate.issues.flatMap((current) => current.nested ?? [{
      code: current.code,
      path: current.path,
      message: current.message,
    }]));
  }
  return candidate.value;
}

export function commitCoreCardSpellToStackV1(
  bundleInput: unknown,
  input: unknown,
): CoreCardSpellCommitResultV1 {
  let bundleResult: ReturnType<typeof validateCoreStackTransactionBundleV1>;
  try {
    bundleResult = validateCoreStackTransactionBundleV1(bundleInput);
  } catch {
    fail('INVALID_TRANSACTION_BUNDLE', '', 'Transaction bundle input is invalid');
  }
  if (!bundleResult.ok) {
    throw new CoreStackTransactionErrorV1('INVALID_TRANSACTION_BUNDLE', bundleResult.issues);
  }
  const bundle = bundleResult.value;
  const operation = readOperationInput(input);
  const sourceObject = bundle.objectRegistry.objects[operation.sourceObjectId];
  if (sourceObject === undefined) {
    fail('SOURCE_NOT_FOUND', '/sourceObjectId', 'Source object is not present in the registry');
  }
  if (sourceObject.kind !== 'card') {
    fail('OBJECT_KIND_MISMATCH', '/sourceObjectId', 'Card spell commit source must be a card object');
  }
  const sourceLocation = locateCoreObjectExactlyOnceV1(bundle.objectRegistry, operation.sourceObjectId);
  if (sourceLocation === null) {
    fail('SOURCE_NOT_FOUND', '/sourceObjectId', 'Source object is not present in exactly one zone');
  }
  if (sourceLocation.zone === 'stack') {
    fail('SOURCE_ALREADY_ON_STACK', '/sourceObjectId', 'Source card is already on the shared stack');
  }
  if (!Object.prototype.hasOwnProperty.call(bundle.objectRegistry.players, operation.controllerPlayerId)) {
    fail('SOURCE_NOT_FOUND', '/controllerPlayerId', 'Controller player is not present in the registry');
  }

  let committedObjectId: CoreObjectId;
  let nextIncarnation: number;
  try {
    nextIncarnation = nextCoreCardIncarnationV1(sourceObject.incarnation);
    committedObjectId = nextCoreCardObjectIdV1(sourceObject.physicalCardId, sourceObject.incarnation);
  } catch {
    fail('CARD_TRANSITION_FAILED', '/sourceObjectId', 'Card incarnation transition could not be derived');
  }
  if (Object.prototype.hasOwnProperty.call(bundle.objectRegistry.objects, committedObjectId)) {
    fail('ID_COLLISION', '/committedObjectId', 'Derived card ObjectId already exists');
  }

  let candidate: CoreStackTransactionBundleV1;
  try {
    candidate = buildCandidateBundle(bundle, operation, sourceLocation, committedObjectId, nextIncarnation);
  } catch (error: unknown) {
    if (error instanceof CoreStackTransactionErrorV1) throw error;
    fail('CANDIDATE_INVALID', '', 'Card spell commit candidate construction failed', candidateNestedIssues(error));
  }
  return deepFreezeStackTransactionV1({
    bundle: candidate,
    previousObjectId: operation.sourceObjectId,
    committedObjectId,
  });
}
