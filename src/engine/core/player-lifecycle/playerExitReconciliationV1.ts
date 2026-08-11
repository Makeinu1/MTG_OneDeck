import { isCoreBaseId, type CoreObjectId, type CorePlayerId } from '../ids';
import { parseCoreObjectIdV2 } from '../object/objectIdV2';
import { validateCoreRuleKeyV1 } from '../rules/ruleKeyV1';
import {
  applyCorePlayerExitV1,
  createCorePlayerLifecycleStateV1,
  type CorePlayerExitCauseV1,
  type CorePlayerExitRequestV1,
  type CorePlayerLifecycleEntryV1,
  type CorePlayerLifecycleStateV1,
  CorePlayerLifecycleErrorV1,
} from './playerLifecycleV1';

declare const corePlayerExitReferenceIdBrand: unique symbol;
export type CorePlayerExitReferenceIdV1 = string & { readonly [corePlayerExitReferenceIdBrand]: true };

export type CorePlayerExitReferenceBundleV1 = Readonly<{
  readonly turnOrder: readonly CorePlayerId[];
  readonly eligiblePlayerIds: readonly CorePlayerId[];
  readonly activePlayerId: CorePlayerId | null;
  readonly priorityHolderPlayerId: CorePlayerId | null;
  readonly ownedObjectIds: readonly CoreObjectId[];
  readonly controlledObjectIds: readonly CoreObjectId[];
  readonly nonCardStackObjectIds: readonly CoreObjectId[];
  readonly combatParticipantObjectIds: readonly CoreObjectId[];
  readonly controlEffectIds: readonly CorePlayerExitReferenceIdV1[];
  readonly decisionAuthorityIds: readonly CorePlayerExitReferenceIdV1[];
  readonly searchSessionIds: readonly CorePlayerExitReferenceIdV1[];
}>;

export type CorePlayerExitReconciliationResultV1 = Readonly<{
  readonly lifecycleState: CorePlayerLifecycleStateV1;
  readonly survivingTurnOrder: readonly CorePlayerId[];
  readonly activePlayerAfterExit: CorePlayerId | null;
  readonly priorityHandoffPlayerId: CorePlayerId | null;
  readonly ownedObjectsToLeaveGame: readonly CoreObjectId[];
  readonly controlEffectIdsToEnd: readonly CorePlayerExitReferenceIdV1[];
  readonly nonCardStackObjectsToCease: readonly CoreObjectId[];
  readonly controlledObjectsToExile: readonly CoreObjectId[];
  readonly combatParticipantObjectIdsToClear: readonly CoreObjectId[];
  readonly decisionAuthorityIdsToClear: readonly CorePlayerExitReferenceIdV1[];
  readonly searchSessionIdsToClose: readonly CorePlayerExitReferenceIdV1[];
}>;

export type CorePlayerExitReconciliationIssueCodeV1 =
  | 'INVALID_ROOT'
  | 'MISSING_FIELD'
  | 'UNKNOWN_FIELD'
  | 'INVALID_DESCRIPTOR'
  | 'INVALID_TYPE'
  | 'INVALID_ID'
  | 'INVALID_CAUSE'
  | 'DUPLICATE_ID'
  | 'INVALID_RELATION';

export type CorePlayerExitReconciliationIssueV1 = Readonly<{
  readonly code: CorePlayerExitReconciliationIssueCodeV1;
  readonly path: string;
  readonly message: string;
}>;

export class CorePlayerExitReconciliationErrorV1 extends Error {
  readonly issues: readonly CorePlayerExitReconciliationIssueV1[];

  constructor(issues: readonly CorePlayerExitReconciliationIssueV1[]) {
    super(`Invalid Core player exit reconciliation value (${issues.length} issue(s))`);
    this.name = 'CorePlayerExitReconciliationErrorV1';
    this.issues = Object.freeze(issues.map((current) => Object.freeze({ ...current })));
    Object.freeze(this);
  }
}

type RawRecord = Record<string, unknown>;
type BundleField = keyof CorePlayerExitReferenceBundleV1;

const BUNDLE_FIELDS = [
  'turnOrder',
  'eligiblePlayerIds',
  'activePlayerId',
  'priorityHolderPlayerId',
  'ownedObjectIds',
  'controlledObjectIds',
  'nonCardStackObjectIds',
  'combatParticipantObjectIds',
  'controlEffectIds',
  'decisionAuthorityIds',
  'searchSessionIds',
] as const satisfies readonly BundleField[];
const REQUEST_FIELDS = ['playerId', 'cause'] as const;
const CAUSES = ['concession', 'defeat'] as const;

function codeUnitCompare(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function pointer(path: string, segment: string): string {
  return `${path}/${segment.replaceAll('~', '~0').replaceAll('/', '~1')}`;
}

function issue(
  code: CorePlayerExitReconciliationIssueCodeV1,
  path: string,
  message: string,
): CorePlayerExitReconciliationIssueV1 {
  return { code, path, message };
}

function sortedIssues(
  issues: readonly CorePlayerExitReconciliationIssueV1[],
): readonly CorePlayerExitReconciliationIssueV1[] {
  return Object.freeze([...issues].sort((left, right) => (
    codeUnitCompare(left.path, right.path) || codeUnitCompare(left.code, right.code)
  )));
}

function isPlainRecord(value: unknown): value is RawRecord {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Reflect.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function readRecord(
  value: unknown,
  fields: readonly string[],
  path: string,
  issues: CorePlayerExitReconciliationIssueV1[],
): RawRecord | null {
  if (!isPlainRecord(value)) {
    issues.push(issue(path === '' ? 'INVALID_ROOT' : 'INVALID_TYPE', path, 'Expected a plain record'));
    return null;
  }

  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    issues.push(issue('INVALID_DESCRIPTOR', path, 'Object keys are not readable'));
    return null;
  }

  const expected = new Set(fields);
  const present = new Set<string>();
  const readable = Object.create(null) as RawRecord;
  for (const key of keys) {
    if (typeof key !== 'string' || !expected.has(key)) {
      issues.push(issue(
        'UNKNOWN_FIELD',
        typeof key === 'string' ? pointer(path, key) : pointer(path, '<symbol>'),
        'Unknown field',
      ));
      continue;
    }
    present.add(key);
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      issues.push(issue('INVALID_DESCRIPTOR', pointer(path, key), 'Field descriptor is not readable'));
      continue;
    }
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) {
      issues.push(issue(
        'INVALID_DESCRIPTOR',
        pointer(path, key),
        'Field must be an enumerable data property',
      ));
      continue;
    }
    readable[key] = descriptor.value;
  }
  for (const field of fields) {
    if (!present.has(field)) issues.push(issue('MISSING_FIELD', pointer(path, field), `Missing field: ${field}`));
  }
  return readable;
}

function canonicalArrayIndex(key: string, length: number): boolean {
  if (key !== '0' && !/^[1-9][0-9]*$/.test(key)) return false;
  return Number(key) < length;
}

function readDenseArray(
  value: unknown,
  path: string,
  issues: CorePlayerExitReconciliationIssueV1[],
): readonly unknown[] | null {
  let isArray: boolean;
  try {
    isArray = Array.isArray(value);
  } catch {
    issues.push(issue('INVALID_DESCRIPTOR', path, 'Array inspection is not safe'));
    return null;
  }
  if (!isArray) {
    issues.push(issue('INVALID_TYPE', path, 'Expected an ordinary dense array'));
    return null;
  }

  const arrayValue = value as object;
  let prototype: object | null;
  let keys: readonly PropertyKey[];
  let lengthDescriptor: PropertyDescriptor | undefined;
  try {
    prototype = Reflect.getPrototypeOf(arrayValue);
    keys = Reflect.ownKeys(arrayValue);
    lengthDescriptor = Object.getOwnPropertyDescriptor(arrayValue, 'length');
  } catch {
    issues.push(issue('INVALID_DESCRIPTOR', path, 'Array inspection is not safe'));
    return null;
  }
  if (prototype !== Array.prototype) issues.push(issue('INVALID_TYPE', path, 'Expected an ordinary array'));
  if (lengthDescriptor === undefined || !('value' in lengthDescriptor)) {
    issues.push(issue('INVALID_DESCRIPTOR', pointer(path, 'length'), 'Array length must be a data property'));
    return null;
  }

  const rawLength: unknown = lengthDescriptor.value;
  if (typeof rawLength !== 'number' || !Number.isSafeInteger(rawLength) || rawLength < 0) {
    issues.push(issue('INVALID_DESCRIPTOR', pointer(path, 'length'), 'Array length must be a data property'));
    return null;
  }

  const length = rawLength;
  const ownIndexes: number[] = [];
  const indexValues = new Map<number, unknown>();
  for (const key of keys) {
    if (key === 'length') continue;
    if (typeof key !== 'string' || !canonicalArrayIndex(key, length)) {
      issues.push(issue(
        'UNKNOWN_FIELD',
        typeof key === 'string' ? pointer(path, key) : pointer(path, '<symbol>'),
        'Unknown array property',
      ));
      continue;
    }
    const index = Number(key);
    ownIndexes.push(index);
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(arrayValue, key);
    } catch {
      issues.push(issue('INVALID_DESCRIPTOR', pointer(path, key), 'Array entry descriptor is not readable'));
      continue;
    }
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) {
      issues.push(issue('INVALID_DESCRIPTOR', pointer(path, key), 'Array entries must be enumerable data properties'));
      continue;
    }
    indexValues.set(index, descriptor.value);
  }

  const sortedIndexes = [...ownIndexes].sort((left, right) => left - right);
  if (sortedIndexes.length !== length) {
    let expectedIndex = 0;
    for (const index of sortedIndexes) {
      if (index !== expectedIndex) break;
      expectedIndex += 1;
    }
    issues.push(issue(
      'INVALID_TYPE',
      pointer(path, String(expectedIndex)),
      'Array entries must be dense enumerable data properties',
    ));
    const sparseValues: unknown[] = [];
    for (const index of sortedIndexes) {
      if (indexValues.has(index)) sparseValues.push(indexValues.get(index));
    }
    return sparseValues;
  }

  const values: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    if (indexValues.has(index)) values.push(indexValues.get(index));
  }
  return values;
}

function isAllowedNonCardObjectId(value: unknown): value is CoreObjectId {
  const parsed = parseCoreObjectIdV2(value);
  return parsed !== null && (
    parsed.kind === 'spell-copy'
    || parsed.kind === 'activated-ability'
    || parsed.kind === 'triggered-ability'
  );
}

function readIdArray(
  root: RawRecord,
  field: BundleField,
  path: string,
  valid: (value: unknown) => boolean,
  issues: CorePlayerExitReconciliationIssueV1[],
): readonly string[] | null {
  const values = readDenseArray(root[field], path, issues);
  if (values === null) return null;
  const result: string[] = [];
  const seen = new Set<string>();
  for (const [index, value] of values.entries()) {
    const itemPath = pointer(path, String(index));
    if (!valid(value)) {
      issues.push(issue('INVALID_ID', itemPath, 'Invalid ID for this collection'));
      continue;
    }
    if (typeof value !== 'string') {
      issues.push(issue('INVALID_ID', itemPath, 'Collection values must be strings'));
      continue;
    }
    if (seen.has(value)) issues.push(issue('DUPLICATE_ID', itemPath, 'Duplicate ID'));
    seen.add(value);
    result.push(value);
  }
  return result;
}

function normalizeBundle(
  value: unknown,
  issues: CorePlayerExitReconciliationIssueV1[],
): CorePlayerExitReferenceBundleV1 | null {
  const root = readRecord(value, BUNDLE_FIELDS, '', issues);
  if (root === null) return null;

  const turnOrder = readIdArray(root, 'turnOrder', '/turnOrder', isCoreBaseId, issues);
  const eligiblePlayerIds = readIdArray(root, 'eligiblePlayerIds', '/eligiblePlayerIds', isCoreBaseId, issues);
  const ownedObjectIds = readIdArray(root, 'ownedObjectIds', '/ownedObjectIds', (item) => parseCoreObjectIdV2(item) !== null, issues);
  const controlledObjectIds = readIdArray(root, 'controlledObjectIds', '/controlledObjectIds', (item) => parseCoreObjectIdV2(item) !== null, issues);
  const nonCardStackObjectIds = readIdArray(root, 'nonCardStackObjectIds', '/nonCardStackObjectIds', isAllowedNonCardObjectId, issues);
  const combatParticipantObjectIds = readIdArray(root, 'combatParticipantObjectIds', '/combatParticipantObjectIds', (item) => parseCoreObjectIdV2(item) !== null, issues);
  const controlEffectIds = readIdArray(root, 'controlEffectIds', '/controlEffectIds', (item) => validateCoreRuleKeyV1(item).ok, issues);
  const decisionAuthorityIds = readIdArray(root, 'decisionAuthorityIds', '/decisionAuthorityIds', (item) => validateCoreRuleKeyV1(item).ok, issues);
  const searchSessionIds = readIdArray(root, 'searchSessionIds', '/searchSessionIds', (item) => validateCoreRuleKeyV1(item).ok, issues);

  const activePlayerId = root.activePlayerId;
  const priorityHolderPlayerId = root.priorityHolderPlayerId;
  if (activePlayerId !== null && !isCoreBaseId(activePlayerId)) {
    issues.push(issue('INVALID_ID', '/activePlayerId', 'Expected a Core player ID or null'));
  }
  if (priorityHolderPlayerId !== null && !isCoreBaseId(priorityHolderPlayerId)) {
    issues.push(issue('INVALID_ID', '/priorityHolderPlayerId', 'Expected a Core player ID or null'));
  }

  if (turnOrder === null || eligiblePlayerIds === null || ownedObjectIds === null || controlledObjectIds === null
    || nonCardStackObjectIds === null || combatParticipantObjectIds === null || controlEffectIds === null
    || decisionAuthorityIds === null || searchSessionIds === null) return null;
  if ((activePlayerId !== null && !isCoreBaseId(activePlayerId))
    || (priorityHolderPlayerId !== null && !isCoreBaseId(priorityHolderPlayerId))) return null;

  return Object.freeze({
    turnOrder: Object.freeze(turnOrder as CorePlayerId[]),
    eligiblePlayerIds: Object.freeze(eligiblePlayerIds as CorePlayerId[]),
    activePlayerId: activePlayerId as CorePlayerId | null,
    priorityHolderPlayerId: priorityHolderPlayerId as CorePlayerId | null,
    ownedObjectIds: Object.freeze(ownedObjectIds as CoreObjectId[]),
    controlledObjectIds: Object.freeze(controlledObjectIds as CoreObjectId[]),
    nonCardStackObjectIds: Object.freeze(nonCardStackObjectIds as CoreObjectId[]),
    combatParticipantObjectIds: Object.freeze(combatParticipantObjectIds as CoreObjectId[]),
    controlEffectIds: Object.freeze(controlEffectIds as CorePlayerExitReferenceIdV1[]),
    decisionAuthorityIds: Object.freeze(decisionAuthorityIds as CorePlayerExitReferenceIdV1[]),
    searchSessionIds: Object.freeze(searchSessionIds as CorePlayerExitReferenceIdV1[]),
  });
}

function normalizeRequest(
  value: unknown,
  issues: CorePlayerExitReconciliationIssueV1[],
): CorePlayerExitRequestV1 | null {
  const request = readRecord(value, REQUEST_FIELDS, '', issues);
  if (request === null) return null;
  const playerId = request.playerId;
  const cause = request.cause;
  if (!isCoreBaseId(playerId)) issues.push(issue('INVALID_ID', '/playerId', 'Invalid Core player ID'));
  if (!CAUSES.includes(cause as CorePlayerExitCauseV1)) issues.push(issue('INVALID_CAUSE', '/cause', 'Invalid exit cause'));
  if (!isCoreBaseId(playerId) || !CAUSES.includes(cause as CorePlayerExitCauseV1)) return null;
  return Object.freeze({ playerId: playerId as CorePlayerId, cause: cause as CorePlayerExitCauseV1 });
}

function normalizeLifecycle(
  value: unknown,
  issues: CorePlayerExitReconciliationIssueV1[],
): CorePlayerLifecycleStateV1 | null {
  try {
    return createCorePlayerLifecycleStateV1(value);
  } catch (error) {
    if (error instanceof CorePlayerLifecycleErrorV1) {
      for (const current of error.issues) {
        issues.push({
          code: current.code === 'INVALID_ROOT' || current.code === 'MISSING_FIELD' || current.code === 'UNKNOWN_FIELD'
            || current.code === 'INVALID_DESCRIPTOR' || current.code === 'INVALID_TYPE' || current.code === 'INVALID_ID'
            || current.code === 'INVALID_RELATION'
            ? current.code
            : current.code === 'DUPLICATE_PLAYER'
              ? 'DUPLICATE_ID'
            : 'INVALID_RELATION',
          path: current.path,
          message: current.message,
        });
      }
      return null;
    }
    issues.push(issue('INVALID_DESCRIPTOR', '', 'Lifecycle inspection is not safe'));
    return null;
  }
}

function throwIfIssues(issues: readonly CorePlayerExitReconciliationIssueV1[]): void {
  if (issues.length > 0) throw new CorePlayerExitReconciliationErrorV1(sortedIssues(issues));
}

export function createCorePlayerExitReferenceBundleV1(value: unknown): CorePlayerExitReferenceBundleV1 {
  const issues: CorePlayerExitReconciliationIssueV1[] = [];
  const bundle = normalizeBundle(value, issues);
  throwIfIssues(issues);
  return bundle as CorePlayerExitReferenceBundleV1;
}

function activeEntry(
  lifecycleState: CorePlayerLifecycleStateV1,
  playerId: CorePlayerId,
): CorePlayerLifecycleEntryV1 | undefined {
  return lifecycleState.players.find((entry) => entry.playerId === playerId);
}

function validateRelations(
  lifecycleState: CorePlayerLifecycleStateV1,
  bundle: CorePlayerExitReferenceBundleV1,
  request: CorePlayerExitRequestV1,
  issues: CorePlayerExitReconciliationIssueV1[],
): void {
  const turnOrderSet = new Set(bundle.turnOrder);
  const eligibleSet = new Set(bundle.eligiblePlayerIds);
  for (const [index, playerId] of bundle.turnOrder.entries()) {
    const entry = activeEntry(lifecycleState, playerId);
    if (entry === undefined || entry.status !== 'active') {
      issues.push(issue('INVALID_RELATION', `/turnOrder/${index}`, 'Turn-order player must be registered and active'));
    }
  }
  for (const [index, playerId] of bundle.eligiblePlayerIds.entries()) {
    const entry = activeEntry(lifecycleState, playerId);
    if (!turnOrderSet.has(playerId) || entry === undefined || entry.status !== 'active') {
      issues.push(issue('INVALID_RELATION', `/eligiblePlayerIds/${index}`, 'Eligible player must be active and in turn order'));
    }
  }

  const exitingEntry = activeEntry(lifecycleState, request.playerId);
  if (exitingEntry === undefined) {
    issues.push(issue('INVALID_RELATION', '/playerId', 'Exiting player is not registered'));
  } else if (exitingEntry.status !== 'active') {
    issues.push(issue('INVALID_RELATION', '/playerId', 'Exiting player must be active'));
  }
  if (!turnOrderSet.has(request.playerId)) {
    issues.push(issue('INVALID_RELATION', '/turnOrder', 'Turn order must contain the exiting player'));
  }
  if (eligibleSet.has(request.playerId)) {
    issues.push(issue('INVALID_RELATION', '/eligiblePlayerIds', 'Eligible players must exclude the exiting player'));
  }

  for (const field of ['activePlayerId', 'priorityHolderPlayerId'] as const) {
    const playerId = bundle[field];
    if (playerId !== null && playerId !== request.playerId && !eligibleSet.has(playerId)) {
      issues.push(issue('INVALID_RELATION', `/${field}`, 'Reference must be the exiting or an eligible player'));
    }
  }
}

function priorityHandoff(
  turnOrder: readonly CorePlayerId[],
  eligiblePlayerIds: readonly CorePlayerId[],
  priorityHolderPlayerId: CorePlayerId | null,
  exitingPlayerId: CorePlayerId,
): CorePlayerId | null {
  if (priorityHolderPlayerId !== exitingPlayerId) return priorityHolderPlayerId;
  const start = turnOrder.indexOf(exitingPlayerId);
  if (start < 0) return null;
  const eligible = new Set(eligiblePlayerIds);
  for (let offset = 1; offset <= turnOrder.length; offset += 1) {
    const candidate = turnOrder[(start + offset) % turnOrder.length];
    if (eligible.has(candidate)) return candidate;
  }
  return null;
}

function freezeResult(
  lifecycleState: CorePlayerLifecycleStateV1,
  survivingTurnOrder: readonly CorePlayerId[],
  activePlayerAfterExit: CorePlayerId | null,
  priorityHandoffPlayerId: CorePlayerId | null,
  ownedObjectsToLeaveGame: readonly CoreObjectId[],
  controlEffectIdsToEnd: readonly CorePlayerExitReferenceIdV1[],
  nonCardStackObjectsToCease: readonly CoreObjectId[],
  controlledObjectsToExile: readonly CoreObjectId[],
  combatParticipantObjectIdsToClear: readonly CoreObjectId[],
  decisionAuthorityIdsToClear: readonly CorePlayerExitReferenceIdV1[],
  searchSessionIdsToClose: readonly CorePlayerExitReferenceIdV1[],
): CorePlayerExitReconciliationResultV1 {
  return Object.freeze({
    lifecycleState,
    survivingTurnOrder: Object.freeze([...survivingTurnOrder]),
    activePlayerAfterExit,
    priorityHandoffPlayerId,
    ownedObjectsToLeaveGame: Object.freeze([...ownedObjectsToLeaveGame]),
    controlEffectIdsToEnd: Object.freeze([...controlEffectIdsToEnd]),
    nonCardStackObjectsToCease: Object.freeze([...nonCardStackObjectsToCease]),
    controlledObjectsToExile: Object.freeze([...controlledObjectsToExile]),
    combatParticipantObjectIdsToClear: Object.freeze([...combatParticipantObjectIdsToClear]),
    decisionAuthorityIdsToClear: Object.freeze([...decisionAuthorityIdsToClear]),
    searchSessionIdsToClose: Object.freeze([...searchSessionIdsToClose]),
  });
}

export function reconcileCorePlayerExitV1(
  lifecycleState: unknown,
  referenceBundle: unknown,
  exitRequest: unknown,
): CorePlayerExitReconciliationResultV1 {
  const issues: CorePlayerExitReconciliationIssueV1[] = [];
  const normalizedLifecycle = normalizeLifecycle(lifecycleState, issues);
  const normalizedBundle = normalizeBundle(referenceBundle, issues);
  const normalizedRequest = normalizeRequest(exitRequest, issues);
  if (normalizedLifecycle !== null && normalizedBundle !== null && normalizedRequest !== null) {
    validateRelations(normalizedLifecycle, normalizedBundle, normalizedRequest, issues);
  }
  throwIfIssues(issues);

  const lifecycle = normalizedLifecycle as CorePlayerLifecycleStateV1;
  const bundle = normalizedBundle as CorePlayerExitReferenceBundleV1;
  const request = normalizedRequest as CorePlayerExitRequestV1;
  const transitionedLifecycle = applyCorePlayerExitV1(lifecycle, request);
  const owned = new Set(bundle.ownedObjectIds);
  const nonCard = new Set(bundle.nonCardStackObjectIds);
  const survivingTurnOrder = bundle.turnOrder.filter((playerId) => playerId !== request.playerId);
  const nonCardStackObjectsToCease = bundle.nonCardStackObjectIds.filter((objectId) => !owned.has(objectId));
  const controlledObjectsToExile = bundle.controlledObjectIds.filter((objectId) => (
    !owned.has(objectId) && !nonCard.has(objectId)
  ));
  return freezeResult(
    transitionedLifecycle,
    survivingTurnOrder,
    bundle.activePlayerId === request.playerId ? null : bundle.activePlayerId,
    priorityHandoff(bundle.turnOrder, bundle.eligiblePlayerIds, bundle.priorityHolderPlayerId, request.playerId),
    bundle.ownedObjectIds,
    bundle.controlEffectIds,
    nonCardStackObjectsToCease,
    controlledObjectsToExile,
    bundle.combatParticipantObjectIds,
    bundle.decisionAuthorityIds,
    bundle.searchSessionIds,
  );
}
