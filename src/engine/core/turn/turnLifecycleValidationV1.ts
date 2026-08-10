import { isCoreBaseId } from '../ids';
import type { CoreObjectId, CorePlayerId } from '../ids';
import { isCanonicalCoreObjectIdV2 } from '../object/objectIdV2';
import {
  validateCoreTurnPositionV1,
} from './turnPositionV1';
import type { CoreTurnPositionV1 } from './turnPositionV1';
import type {
  CorePendingTriggerOrderGroupV1,
  CoreTurnLifecycleSliceV1,
  CoreTurnWindowV1,
} from './turnLifecycleV1';

export type CoreTurnLifecycleValidationCodeV1 =
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

export type CoreTurnLifecycleValidationCode = CoreTurnLifecycleValidationCodeV1;

export type CoreTurnLifecycleValidationIssueV1 = Readonly<{
  readonly code: CoreTurnLifecycleValidationCodeV1;
  readonly path: string;
  readonly message: string;
}>;

export type CoreTurnLifecycleValidationIssue = CoreTurnLifecycleValidationIssueV1;

export type CoreTurnLifecycleValidationResultV1 =
  | Readonly<{ readonly ok: true; readonly value: CoreTurnLifecycleSliceV1 }>
  | Readonly<{
      readonly ok: false;
      readonly issues: readonly CoreTurnLifecycleValidationIssueV1[];
    }>;

export type CoreTurnPositionValidationResultV1 =
  | Readonly<{ readonly ok: true; readonly value: CoreTurnPositionV1 }>
  | Readonly<{
      readonly ok: false;
      readonly issues: readonly CoreTurnLifecycleValidationIssueV1[];
    }>;

export type CoreTurnWindowValidationResultV1 =
  | Readonly<{ readonly ok: true; readonly value: CoreTurnWindowV1 }>
  | Readonly<{
      readonly ok: false;
      readonly issues: readonly CoreTurnLifecycleValidationIssueV1[];
    }>;

export type CoreTurnLifecycleValidationResult = CoreTurnLifecycleValidationResultV1;
export type CoreTurnPositionValidationResult = CoreTurnPositionValidationResultV1;
export type CoreTurnWindowValidationResult = CoreTurnWindowValidationResultV1;

export class CoreTurnLifecycleCreationErrorV1 extends Error {
  readonly issues: readonly CoreTurnLifecycleValidationIssueV1[];

  constructor(issues: readonly CoreTurnLifecycleValidationIssueV1[]) {
    const frozenIssues = Object.freeze(issues.map((issue) => Object.freeze({ ...issue })));
    super(`Invalid Core turn lifecycle slice (${frozenIssues.length} issue(s))`);
    this.name = 'CoreTurnLifecycleCreationErrorV1';
    this.issues = frozenIssues;
  }
}

export type CoreTurnLifecycleCreationError = CoreTurnLifecycleCreationErrorV1;

type RawRecord = Record<string, unknown>;
type Issue = CoreTurnLifecycleValidationIssueV1;

const LIFECYCLE_KIND = 'mode-neutral-core-turn-lifecycle-slice-v1' as const;
const LIFECYCLE_FIELDS = ['kind', 'turnNumber', 'positionSequence', 'position', 'window'] as const;
const WINDOW_KINDS = [
  'turn-based-action-required',
  'sba-check-required',
  'trigger-order-required',
  'priority',
  'resolution-ready',
  'position-advance-ready',
  'cleanup-discard-required',
  'cleanup-state-actions-required',
  'cleanup-repeat-ready',
  'turn-advance-ready',
] as const;
const GROUP_FIELDS = ['stackPlacementBucket', 'controllerPlayerId', 'pendingObjectIds'] as const;

function codeUnitCompare(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function escapePointerSegment(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

function pointer(path: string, segment: string): string {
  return `${path}/${escapePointerSegment(segment)}`;
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

function isDataDescriptor(descriptor: PropertyDescriptor | undefined): { readonly value: unknown } | null {
  if (descriptor === undefined || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null;
  return { value: descriptor.value };
}

class IssueCollector {
  private readonly values: Issue[] = [];
  private readonly seen = new Set<string>();

  add(code: CoreTurnLifecycleValidationCodeV1, path: string, message: string): void {
    const identity = `${path}\u0000${code}`;
    if (this.seen.has(identity)) return;
    this.seen.add(identity);
    this.values.push(Object.freeze({ code, path, message }));
  }

  append(path: string, issues: readonly Issue[]): void {
    for (const issue of issues) this.add(issue.code, `${path}${issue.path}`, issue.message);
  }

  sorted(): readonly Issue[] {
    return Object.freeze(this.values.slice().sort((left, right) =>
      codeUnitCompare(left.path, right.path)
      || codeUnitCompare(left.code, right.code)
      || codeUnitCompare(left.message, right.message)));
  }
}

function readRecord(
  value: unknown,
  path: string,
  fields: readonly string[],
  issues: IssueCollector,
  invalidRootCode: CoreTurnLifecycleValidationCodeV1 = 'INVALID_TYPE',
): RawRecord | null {
  if (!isPlainRecord(value)) {
    issues.add(invalidRootCode, path, 'Expected a plain object');
    return null;
  }

  let keys: readonly (string | symbol)[];
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    issues.add(invalidRootCode, path, 'Object descriptors are not readable');
    return null;
  }
  const expected = new Set(fields);
  const result = Object.create(null) as RawRecord;
  for (const key of keys) {
    if (typeof key !== 'string') {
      issues.add('UNKNOWN_FIELD', pointer(path, '[symbol]'), 'Symbol fields are not allowed');
      continue;
    }
    const fieldPath = pointer(path, key);
    if (!expected.has(key)) {
      issues.add('UNKNOWN_FIELD', fieldPath, `Unknown field: ${key}`);
      continue;
    }
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      issues.add('INVALID_TYPE', fieldPath, 'Field descriptor is not readable');
      continue;
    }
    if (descriptor === undefined || descriptor.enumerable !== true) {
      issues.add('UNKNOWN_FIELD', fieldPath, 'Fields must be enumerable');
      continue;
    }
    const data = isDataDescriptor(descriptor);
    if (data === null) {
      issues.add('INVALID_TYPE', fieldPath, 'Accessor properties are not allowed');
      continue;
    }
    result[key] = data.value;
  }
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(result, field)) {
      issues.add('MISSING_FIELD', pointer(path, field), `Missing field: ${field}`);
    }
  }
  return result;
}

function readKind(value: unknown, path: string, issues: IssueCollector): RawRecord | null {
  if (!isPlainRecord(value)) {
    issues.add('INVALID_ROOT', path, 'Expected a plain lifecycle/window object');
    return null;
  }
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(value, 'kind');
  } catch {
    issues.add('INVALID_TYPE', pointer(path, 'kind'), 'Kind descriptor is not readable');
    return null;
  }
  if (descriptor === undefined || descriptor.enumerable !== true) {
    issues.add('MISSING_FIELD', pointer(path, 'kind'), 'Missing field: kind');
    return null;
  }
  const data = isDataDescriptor(descriptor);
  if (data === null) {
    issues.add('INVALID_TYPE', pointer(path, 'kind'), 'Accessor properties are not allowed');
    return null;
  }
  const result = Object.create(null) as RawRecord;
  result.kind = data.value;
  return result;
}

function literal(
  value: unknown,
  expected: string,
  path: string,
  issues: IssueCollector,
): boolean {
  if (value !== expected) {
    issues.add('INVALID_LITERAL', path, `Expected ${expected}`);
    return false;
  }
  return true;
}

function booleanValue(value: unknown, path: string, issues: IssueCollector): value is boolean {
  if (typeof value !== 'boolean') {
    issues.add('INVALID_TYPE', path, 'Expected a boolean');
    return false;
  }
  return true;
}

function playerId(value: unknown, path: string, issues: IssueCollector): value is CorePlayerId {
  if (typeof value !== 'string') {
    issues.add('INVALID_TYPE', path, 'Expected a Core player ID');
    return false;
  }
  if (!isCoreBaseId(value)) {
    issues.add('INVALID_ID', path, 'Expected a canonical Core player ID');
    return false;
  }
  return true;
}

function objectId(value: unknown, path: string, issues: IssueCollector): value is CoreObjectId {
  if (typeof value !== 'string') {
    issues.add('INVALID_TYPE', path, 'Expected a Core object ID');
    return false;
  }
  if (!isCanonicalCoreObjectIdV2(value)) {
    issues.add('INVALID_ID', path, 'Expected a canonical Core ObjectId V2');
    return false;
  }
  return true;
}

function readArray(value: unknown, path: string, issues: IssueCollector): readonly unknown[] | null {
  let isArray: boolean;
  try {
    isArray = Array.isArray(value);
  } catch {
    issues.add('INVALID_ARRAY', path, 'Array shape is not readable');
    return null;
  }
  if (!isArray) {
    issues.add('INVALID_ARRAY', path, 'Expected an array');
    return null;
  }

  let prototype: object | null;
  try {
    prototype = Reflect.getPrototypeOf(value as object);
  } catch {
    issues.add('INVALID_ARRAY', path, 'Array prototype is not readable');
    return null;
  }
  if (prototype !== Array.prototype) {
    issues.add('INVALID_ARRAY', path, 'Expected an ordinary array');
    return null;
  }

  let lengthDescriptor: PropertyDescriptor | undefined;
  let keys: readonly (string | symbol)[];
  try {
    const arrayObject = value as object;
    lengthDescriptor = Object.getOwnPropertyDescriptor(arrayObject, 'length');
    keys = Reflect.ownKeys(arrayObject);
  } catch {
    issues.add('INVALID_ARRAY', path, 'Array descriptors are not readable');
    return null;
  }
  const lengthValue = isDataDescriptor(lengthDescriptor)?.value;
  if (typeof lengthValue !== 'number' || !Number.isSafeInteger(lengthValue) || lengthValue < 0) {
    issues.add('INVALID_ARRAY', path, 'Array length is invalid');
    return null;
  }

  for (const key of keys) {
    if (typeof key !== 'string') {
      issues.add('UNKNOWN_FIELD', pointer(path, '[symbol]'), 'Symbol fields are not allowed');
      continue;
    }
    if (key === 'length') continue;
    const numericIndex = Number(key);
    if (!Number.isSafeInteger(numericIndex) || numericIndex < 0 || numericIndex >= lengthValue || String(numericIndex) !== key) {
      issues.add('INVALID_ARRAY', pointer(path, key), 'Array extra properties are not allowed');
      continue;
    }
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      issues.add('INVALID_ARRAY', pointer(path, key), 'Array element descriptor is not readable');
      continue;
    }
    if (descriptor === undefined || descriptor.enumerable !== true || isDataDescriptor(descriptor) === null) {
      issues.add('INVALID_ARRAY', pointer(path, key), 'Array elements must be enumerable data properties');
    }
  }

  const values: unknown[] = [];
  for (let index = 0; index < lengthValue; index += 1) {
    const indexPath = pointer(path, String(index));
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    } catch {
      issues.add('INVALID_ARRAY', indexPath, 'Array element descriptor is not readable');
      values.push(undefined);
      continue;
    }
    if (descriptor === undefined) {
      issues.add('INVALID_ARRAY', indexPath, 'Sparse arrays are not allowed');
      values.push(undefined);
      continue;
    }
    if (descriptor.enumerable !== true) {
      issues.add('INVALID_ARRAY', indexPath, 'Array elements must be enumerable');
      values.push(undefined);
      continue;
    }
    const data = isDataDescriptor(descriptor);
    if (data === null) {
      issues.add('INVALID_ARRAY', indexPath, 'Accessor array elements are not allowed');
      values.push(undefined);
      continue;
    }
    values.push(data.value);
  }
  return values;
}

function hasDuplicate(values: readonly string[], path: string, issues: IssueCollector): void {
  const seen = new Set<string>();
  for (let index = 0; index < values.length; index += 1) {
    if (seen.has(values[index])) issues.add('DUPLICATE_VALUE', pointer(path, String(index)), 'Duplicate value');
    seen.add(values[index]);
  }
}

function validateIdArray(
  value: unknown,
  path: string,
  issues: IssueCollector,
  kind: 'player' | 'object',
): readonly string[] | null {
  const values = readArray(value, path, issues);
  if (values === null) return null;
  const result: string[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const at = pointer(path, String(index));
    const valid = kind === 'player'
      ? playerId(values[index], at, issues)
      : objectId(values[index], at, issues);
    if (valid) result.push(values[index] as string);
  }
  hasDuplicate(result, path, issues);
  return result;
}

function validateGroup(value: unknown, path: string, issues: IssueCollector): CorePendingTriggerOrderGroupV1 | null {
  const root = readRecord(value, path, GROUP_FIELDS, issues);
  if (root === null) return null;
  const bucketValid = root.stackPlacementBucket === 'ordinary' || root.stackPlacementBucket === 'ability-triggered';
  if (!bucketValid) issues.add('INVALID_LITERAL', pointer(path, 'stackPlacementBucket'), 'Expected a trigger placement bucket');
  const controllerValid = playerId(root.controllerPlayerId, pointer(path, 'controllerPlayerId'), issues);
  const ids = validateIdArray(root.pendingObjectIds, pointer(path, 'pendingObjectIds'), issues, 'object');
  if (!bucketValid || !controllerValid || ids === null) return null;
  return Object.freeze({
    stackPlacementBucket: root.stackPlacementBucket,
    controllerPlayerId: root.controllerPlayerId,
    pendingObjectIds: Object.freeze(ids.map((value) => value as CoreObjectId)),
  }) as CorePendingTriggerOrderGroupV1;
}

function windowFields(kind: string): readonly string[] {
  switch (kind) {
    case 'turn-based-action-required': return ['kind', 'action', 'playerId'];
    case 'sba-check-required': return ['kind', 'priorityRecipientPlayerId', 'grantPriorityIfStable'];
    case 'trigger-order-required': return ['kind', 'priorityRecipientPlayerId', 'grantPriorityIfStable', 'pendingObjectIds', 'ambiguousGroups'];
    case 'priority': return ['kind', 'cycleStartPlayerId', 'holderPlayerId', 'passedPlayerIds'];
    case 'resolution-ready': return ['kind', 'objectId'];
    case 'position-advance-ready': return ['kind'];
    case 'cleanup-discard-required': return ['kind', 'playerId', 'requiredCount'];
    case 'cleanup-state-actions-required': return ['kind', 'playerId'];
    case 'cleanup-repeat-ready': return ['kind'];
    case 'turn-advance-ready': return ['kind'];
    default: return ['kind'];
  }
}

export function validateCoreTurnWindowV1(input: unknown): CoreTurnWindowValidationResultV1 {
  const issues = new IssueCollector();
  const kindRoot = readKind(input, '', issues);
  if (kindRoot === null) return Object.freeze({ ok: false, issues: issues.sorted() });
  const kind = kindRoot.kind;
  if (typeof kind !== 'string' || !WINDOW_KINDS.includes(kind as (typeof WINDOW_KINDS)[number])) {
    issues.add('INVALID_LITERAL', '/kind', 'Unknown lifecycle window kind');
    return Object.freeze({ ok: false, issues: issues.sorted() });
  }
  const root = readRecord(input, '', windowFields(kind), issues);
  if (root === null) return Object.freeze({ ok: false, issues: issues.sorted() });

  let result: CoreTurnWindowV1 | null = null;
  switch (kind) {
    case 'turn-based-action-required': {
      const actionValid = root.action === 'untap-step-actions'
        || root.action === 'draw-step-draw'
        || root.action === 'precombat-main-actions';
      if (!actionValid) issues.add('INVALID_LITERAL', '/action', 'Expected a turn-based action');
      const playerValid = playerId(root.playerId, '/playerId', issues);
      if (actionValid && playerValid) {
        result = Object.freeze({
          kind,
          action: root.action as 'untap-step-actions' | 'draw-step-draw' | 'precombat-main-actions',
          playerId: root.playerId as CorePlayerId,
        });
      }
      break;
    }
    case 'sba-check-required': {
      const recipientValid = playerId(root.priorityRecipientPlayerId, '/priorityRecipientPlayerId', issues);
      const flagValid = booleanValue(root.grantPriorityIfStable, '/grantPriorityIfStable', issues);
      if (recipientValid && flagValid) {
        result = Object.freeze({
          kind,
          priorityRecipientPlayerId: root.priorityRecipientPlayerId as CorePlayerId,
          grantPriorityIfStable: root.grantPriorityIfStable as boolean,
        });
      }
      break;
    }
    case 'trigger-order-required': {
      const recipientValid = playerId(root.priorityRecipientPlayerId, '/priorityRecipientPlayerId', issues);
      const flagValid = root.grantPriorityIfStable === true;
      if (!flagValid) issues.add('INVALID_LITERAL', '/grantPriorityIfStable', 'Expected true');
      const pendingIds = validateIdArray(root.pendingObjectIds, '/pendingObjectIds', issues, 'object');
      const groupsInput = readArray(root.ambiguousGroups, '/ambiguousGroups', issues);
      const groups: CorePendingTriggerOrderGroupV1[] = [];
      if (groupsInput !== null) {
        const idsAcrossGroups = new Set<string>();
        for (let index = 0; index < groupsInput.length; index += 1) {
          const group = validateGroup(groupsInput[index], pointer('/ambiguousGroups', String(index)), issues);
          if (group !== null) {
            for (const id of group.pendingObjectIds) {
              if (idsAcrossGroups.has(id)) issues.add('DUPLICATE_VALUE', pointer('/ambiguousGroups', String(index)), 'Pending ObjectId appears in more than one group');
              idsAcrossGroups.add(id);
            }
            groups.push(group);
          }
        }
      }
      if (recipientValid && flagValid && pendingIds !== null && groupsInput !== null && groups.length === groupsInput.length) {
        result = Object.freeze({
          kind,
          priorityRecipientPlayerId: root.priorityRecipientPlayerId as CorePlayerId,
          grantPriorityIfStable: true,
          pendingObjectIds: Object.freeze(pendingIds.map((value) => value as CoreObjectId)),
          ambiguousGroups: Object.freeze(groups),
        });
      }
      break;
    }
    case 'priority': {
      const cycleValid = playerId(root.cycleStartPlayerId, '/cycleStartPlayerId', issues);
      const holderValid = playerId(root.holderPlayerId, '/holderPlayerId', issues);
      const passed = validateIdArray(root.passedPlayerIds, '/passedPlayerIds', issues, 'player');
      if (cycleValid && holderValid && passed !== null) {
        if (passed.includes(root.holderPlayerId as string)) issues.add('INVALID_PASS_SEQUENCE', '/passedPlayerIds', 'Passed IDs must not include the holder');
        result = Object.freeze({
          kind,
          cycleStartPlayerId: root.cycleStartPlayerId as CorePlayerId,
          holderPlayerId: root.holderPlayerId as CorePlayerId,
          passedPlayerIds: Object.freeze(passed.map((value) => value as CorePlayerId)),
        });
      }
      break;
    }
    case 'resolution-ready': {
      const valid = objectId(root.objectId, '/objectId', issues);
      if (valid) result = Object.freeze({ kind, objectId: root.objectId as CoreObjectId });
      break;
    }
    case 'position-advance-ready':
    case 'cleanup-repeat-ready':
    case 'turn-advance-ready':
      result = Object.freeze({ kind });
      break;
    case 'cleanup-discard-required': {
      const playerValid = playerId(root.playerId, '/playerId', issues);
      const countValid = typeof root.requiredCount === 'number'
        && Number.isSafeInteger(root.requiredCount)
        && root.requiredCount >= 0
        && !Object.is(root.requiredCount, -0);
      if (!countValid) issues.add(typeof root.requiredCount === 'number' ? 'INVALID_INTEGER' : 'INVALID_TYPE', '/requiredCount', 'Expected a non-negative safe integer');
      if (playerValid && countValid) {
        result = Object.freeze({
          kind,
          playerId: root.playerId as CorePlayerId,
          requiredCount: root.requiredCount as number,
        });
      }
      break;
    }
    case 'cleanup-state-actions-required': {
      const playerValid = playerId(root.playerId, '/playerId', issues);
      if (playerValid) result = Object.freeze({ kind, playerId: root.playerId as CorePlayerId });
      break;
    }
    default:
      break;
  }

  const sortedIssues = issues.sorted();
  if (sortedIssues.length > 0 || result === null) return Object.freeze({ ok: false, issues: sortedIssues });
  return Object.freeze({ ok: true, value: result });
}

function validatePositionWindowPair(
  position: CoreTurnPositionV1,
  window: CoreTurnWindowV1,
  issues: IssueCollector,
): void {
  const kind = window.kind;
  const isCleanup = position.phase === 'ending' && position.step === 'cleanup';
  const cleanupWindow = kind === 'cleanup-discard-required'
    || kind === 'cleanup-state-actions-required'
    || kind === 'cleanup-repeat-ready'
    || kind === 'turn-advance-ready';

  if (position.phase === 'beginning' && position.step === 'untap'
    && (kind !== 'turn-based-action-required' || window.action !== 'untap-step-actions')) {
    issues.add('INVALID_WINDOW_FOR_POSITION', '/window', 'Untap permits only its turn-based action window');
  }
  if (kind === 'turn-based-action-required') {
    const expected = position.phase === 'beginning' && position.step === 'untap'
      ? 'untap-step-actions'
      : position.phase === 'beginning' && position.step === 'draw'
        ? 'draw-step-draw'
        : position.phase === 'precombat-main' && position.step === null
          ? 'precombat-main-actions'
          : null;
    if (expected !== window.action) {
      issues.add('INVALID_WINDOW_FOR_POSITION', '/window/action', 'Turn-based action does not match position');
    }
  }
  if (cleanupWindow && !isCleanup) issues.add('INVALID_WINDOW_FOR_POSITION', '/window', 'Cleanup windows require cleanup position');
  if (isCleanup && kind === 'position-advance-ready') issues.add('INVALID_WINDOW_FOR_POSITION', '/window', 'Cleanup cannot use position-advance-ready');
}

export function validateModeNeutralCoreTurnLifecycleSliceV1(
  input: unknown,
): CoreTurnLifecycleValidationResultV1 {
  const issues = new IssueCollector();
  const root = readRecord(input, '', LIFECYCLE_FIELDS, issues, 'INVALID_ROOT');
  if (root === null) return Object.freeze({ ok: false, issues: issues.sorted() });
  literal(root.kind, LIFECYCLE_KIND, '/kind', issues);

  const turnNumberValid = typeof root.turnNumber === 'number'
    && Number.isSafeInteger(root.turnNumber)
    && root.turnNumber >= 1
    && !Object.is(root.turnNumber, -0);
  if (!turnNumberValid) issues.add(typeof root.turnNumber === 'number' ? 'INVALID_INTEGER' : 'INVALID_TYPE', '/turnNumber', 'Expected a safe integer greater than or equal to one');

  const sequenceValid = typeof root.positionSequence === 'number'
    && Number.isSafeInteger(root.positionSequence)
    && root.positionSequence >= 0
    && !Object.is(root.positionSequence, -0);
  if (!sequenceValid) issues.add(typeof root.positionSequence === 'number' ? 'INVALID_INTEGER' : 'INVALID_TYPE', '/positionSequence', 'Expected a non-negative safe integer');

  const position = validateCoreTurnPositionV1(root.position);
  if (!position.ok) issues.append('/position', position.issues);
  const window = validateCoreTurnWindowV1(root.window);
  if (!window.ok) issues.append('/window', window.issues);

  if (position.ok && window.ok) validatePositionWindowPair(position.value, window.value, issues);
  const sortedIssues = issues.sorted();
  if (sortedIssues.length > 0 || !position.ok || !window.ok || !turnNumberValid || !sequenceValid || root.kind !== LIFECYCLE_KIND) {
    return Object.freeze({ ok: false, issues: sortedIssues });
  }

  const value: CoreTurnLifecycleSliceV1 = Object.freeze({
    kind: LIFECYCLE_KIND,
    turnNumber: root.turnNumber as number,
    positionSequence: root.positionSequence as number,
    position: position.value,
    window: window.value,
  });
  return Object.freeze({ ok: true, value });
}
