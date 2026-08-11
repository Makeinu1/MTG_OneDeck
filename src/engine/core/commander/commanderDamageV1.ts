import { isCoreBaseId } from '../ids';
import type { CorePhysicalCardId, CorePlayerId } from '../ids';
import {
  createCoreCommanderIdentityV1,
} from './commanderIdentityV1';
import type { CoreCommanderIdentityV1 } from './commanderIdentityV1';

export type CoreCommanderDamageEntryV1 = Readonly<{
  readonly commanderPhysicalCardId: CorePhysicalCardId;
  readonly defendingPlayerId: CorePlayerId;
  readonly damage: number;
}>;

export type CoreCommanderDamageStateV1 = Readonly<{
  readonly commanders: readonly CoreCommanderIdentityV1[];
  readonly defendingPlayerIds: readonly CorePlayerId[];
  readonly entries: readonly CoreCommanderDamageEntryV1[];
}>;

export type CoreCommanderDamageValidationCodeV1 =
  | 'INVALID_ROOT'
  | 'MISSING_FIELD'
  | 'UNKNOWN_FIELD'
  | 'INVALID_TYPE'
  | 'INVALID_ID'
  | 'INVALID_DAMAGE'
  | 'DUPLICATE_COMMANDER'
  | 'DUPLICATE_DEFENDING_PLAYER'
  | 'DUPLICATE_ENTRY'
  | 'UNREGISTERED_COMMANDER'
  | 'UNREGISTERED_DEFENDING_PLAYER';

export type CoreCommanderDamageValidationIssueV1 = Readonly<{
  readonly code: CoreCommanderDamageValidationCodeV1;
  readonly path: string;
  readonly message: string;
}>;

class CoreCommanderDamageErrorV1 extends Error {
  readonly issues: readonly CoreCommanderDamageValidationIssueV1[];

  constructor(message: string, issues: readonly CoreCommanderDamageValidationIssueV1[]) {
    super(message);
    this.name = 'CoreCommanderDamageErrorV1';
    this.issues = Object.freeze(issues.map((current) => Object.freeze({ ...current })));
  }
}

export class CoreCommanderDamageCreationErrorV1 extends CoreCommanderDamageErrorV1 {
  constructor(issues: readonly CoreCommanderDamageValidationIssueV1[]) {
    super(`Invalid Core commander damage state (${issues.length} issue(s))`, issues);
    this.name = 'CoreCommanderDamageCreationErrorV1';
    Object.freeze(this);
  }
}

export class CoreCommanderDamageRecordingErrorV1 extends CoreCommanderDamageErrorV1 {
  constructor(issues: readonly CoreCommanderDamageValidationIssueV1[]) {
    super(`Invalid Core commander damage record (${issues.length} issue(s))`, issues);
    this.name = 'CoreCommanderDamageRecordingErrorV1';
    Object.freeze(this);
  }
}

type RawRecord = Record<string, unknown>;

function codeUnitCompare(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function issue(
  code: CoreCommanderDamageValidationCodeV1,
  path: string,
  message: string,
): CoreCommanderDamageValidationIssueV1 {
  return Object.freeze({ code, path, message });
}

function sortedIssues(
  issues: readonly CoreCommanderDamageValidationIssueV1[],
): readonly CoreCommanderDamageValidationIssueV1[] {
  return Object.freeze(issues.slice().sort((left, right) =>
    codeUnitCompare(left.path, right.path) || codeUnitCompare(left.code, right.code)));
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

function hasOwn(record: RawRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function readDataRecord(value: unknown, fields: readonly string[], path: string): {
  readonly record: RawRecord | null;
  readonly issues: readonly CoreCommanderDamageValidationIssueV1[];
} {
  if (!isPlainRecord(value)) return { record: null, issues: [issue('INVALID_ROOT', path, 'Expected a plain object')] };
  const record: RawRecord = Object.create(null) as RawRecord;
  const issues: CoreCommanderDamageValidationIssueV1[] = [];
  try {
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string' || !fields.includes(key)) {
        issues.push(issue('UNKNOWN_FIELD', `${path}/${typeof key === 'string' ? key : '<symbol>'}`, 'Unknown field'));
        continue;
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) {
        issues.push(issue('INVALID_TYPE', `${path}/${key}`, 'Field must be an enumerable data property'));
        continue;
      }
      record[key] = descriptor.value;
    }
  } catch {
    return { record: null, issues: [issue('INVALID_TYPE', path, 'Unable to inspect object')] };
  }
  for (const field of fields) {
    if (!hasOwn(record, field)) issues.push(issue('MISSING_FIELD', `${path}/${field}`, `Missing field: ${field}`));
  }
  return { record, issues };
}

function readArray(value: unknown, path: string): {
  readonly values: readonly unknown[] | null;
  readonly issues: readonly CoreCommanderDamageValidationIssueV1[];
} {
  try {
    if (!Array.isArray(value)) return { values: null, issues: [issue('INVALID_TYPE', path, 'Expected an array')] };
    if (Reflect.getPrototypeOf(value) !== Array.prototype) {
      return { values: null, issues: [issue('INVALID_TYPE', path, 'Expected an ordinary array')] };
    }

    const keys = Reflect.ownKeys(value);
    const descriptors = new Map<string, PropertyDescriptor>();
    for (const key of keys) {
      if (typeof key !== 'string' || (key !== 'length' && !/^0$|^[1-9][0-9]*$/.test(key))) {
        return { values: null, issues: [issue('INVALID_TYPE', path, 'Array must contain only length and canonical data indices')] };
      }
      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, key);
      } catch {
        return { values: null, issues: [issue('INVALID_TYPE', path, 'Array property descriptor is not readable')] };
      }
      if (descriptor === undefined) {
        return { values: null, issues: [issue('INVALID_TYPE', path, 'Array property descriptor is missing')] };
      }
      descriptors.set(key, descriptor);
    }

    const lengthDescriptor = descriptors.get('length');
    const rawLength: unknown = lengthDescriptor?.value;
    if (lengthDescriptor === undefined || !('value' in lengthDescriptor) || lengthDescriptor.enumerable ||
      typeof rawLength !== 'number' || !Number.isSafeInteger(rawLength) || rawLength < 0) {
      return { values: null, issues: [issue('INVALID_TYPE', path, 'Array length must be a non-enumerable data property')] };
    }
    const length = rawLength;
    if (descriptors.size !== length + 1) {
      return { values: null, issues: [issue('INVALID_TYPE', path, 'Array must be dense')] };
    }
    const values: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors.get(String(index));
      if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) {
        return { values: null, issues: [issue('INVALID_TYPE', path, 'Array indices must be enumerable data properties')] };
      }
      values.push(descriptor.value);
    }
    return { values: Object.freeze(values), issues: [] };
  } catch {
    return { values: null, issues: [issue('INVALID_TYPE', path, 'Unable to inspect array')] };
  }
}

function validPhysicalCardId(value: unknown): value is CorePhysicalCardId {
  return isCoreBaseId(value);
}

function validPlayerId(value: unknown): value is CorePlayerId {
  return isCoreBaseId(value);
}

function validDamage(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
}

function pairKey(commanderPhysicalCardId: string, defendingPlayerId: string): string {
  return `${commanderPhysicalCardId}\u0000${defendingPlayerId}`;
}

function frozenEntries(entries: readonly CoreCommanderDamageEntryV1[]): readonly CoreCommanderDamageEntryV1[] {
  return Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));
}

function commanderAllowlist(commanders: readonly CoreCommanderIdentityV1[]): Set<string> {
  return new Set(commanders.map((commander) => commander.physicalCardId));
}

function defendingPlayerAllowlist(defendingPlayerIds: readonly CorePlayerId[]): Set<string> {
  return new Set(defendingPlayerIds);
}

export function createCoreCommanderDamageStateV1(value: unknown): CoreCommanderDamageStateV1 {
  const root = readDataRecord(value, ['commanders', 'defendingPlayerIds', 'entries'], '');
  if (root.record === null || root.issues.length > 0) throw new CoreCommanderDamageCreationErrorV1(sortedIssues(root.issues));

  const commanderArray = readArray(root.record.commanders, '/commanders');
  const defendingPlayerArray = readArray(root.record.defendingPlayerIds, '/defendingPlayerIds');
  const entryArray = readArray(root.record.entries, '/entries');
  const issues = [...root.issues, ...commanderArray.issues, ...defendingPlayerArray.issues, ...entryArray.issues];
  const commanders: CoreCommanderIdentityV1[] = [];
  const defendingPlayerIds: CorePlayerId[] = [];
  const commanderIds = new Set<string>();
  const defendingPlayerIdsSet = new Set<string>();
  if (commanderArray.values !== null) {
    commanderArray.values.forEach((current, index) => {
      try {
        const commander = createCoreCommanderIdentityV1(current);
        if (commanderIds.has(commander.physicalCardId)) {
          issues.push(issue('DUPLICATE_COMMANDER', `/commanders/${index}/physicalCardId`, 'Commander physical ID is duplicated'));
        } else {
          commanderIds.add(commander.physicalCardId);
          commanders.push(commander);
        }
      } catch {
        issues.push(issue('INVALID_TYPE', `/commanders/${index}`, 'Invalid Core commander identity'));
      }
    });
  }

  defendingPlayerArray.values?.forEach((current, index) => {
    const path = `/defendingPlayerIds/${index}`;
    if (!validPlayerId(current)) {
      issues.push(issue('INVALID_ID', path, 'Invalid Core player ID'));
    } else if (defendingPlayerIdsSet.has(current)) {
      issues.push(issue('DUPLICATE_DEFENDING_PLAYER', path, 'Defending player ID is duplicated'));
    } else {
      defendingPlayerIdsSet.add(current);
      defendingPlayerIds.push(current);
    }
  });

  const rawEntries: CoreCommanderDamageEntryV1[] = [];
  const entryPairs = new Set<string>();
  if (entryArray.values !== null) {
    entryArray.values.forEach((current, index) => {
      const read = readDataRecord(current, ['commanderPhysicalCardId', 'defendingPlayerId', 'damage'], `/entries/${index}`);
      issues.push(...read.issues);
      if (read.record === null || read.issues.length > 0) return;
      const commanderPhysicalCardId = read.record.commanderPhysicalCardId;
      const defendingPlayerId = read.record.defendingPlayerId;
      const damage = read.record.damage;
      if (!validPhysicalCardId(commanderPhysicalCardId)) issues.push(issue('INVALID_ID', `/entries/${index}/commanderPhysicalCardId`, 'Invalid Core physical card ID'));
      else if (!commanderIds.has(commanderPhysicalCardId)) issues.push(issue('UNREGISTERED_COMMANDER', `/entries/${index}/commanderPhysicalCardId`, 'Commander physical ID is not registered'));
      if (!validPlayerId(defendingPlayerId)) issues.push(issue('INVALID_ID', `/entries/${index}/defendingPlayerId`, 'Invalid Core player ID'));
      else if (!defendingPlayerIdsSet.has(defendingPlayerId)) issues.push(issue('UNREGISTERED_DEFENDING_PLAYER', `/entries/${index}/defendingPlayerId`, 'Defending player ID is not registered'));
      if (!validDamage(damage)) issues.push(issue('INVALID_DAMAGE', `/entries/${index}/damage`, 'Damage must be a nonnegative safe integer'));
      const pair = validPhysicalCardId(commanderPhysicalCardId) && validPlayerId(defendingPlayerId)
        ? pairKey(commanderPhysicalCardId, defendingPlayerId)
        : null;
      if (pair !== null && entryPairs.has(pair)) {
        issues.push(issue('DUPLICATE_ENTRY', `/entries/${index}`, 'Commander damage pair is duplicated'));
      } else if (pair !== null && validPhysicalCardId(commanderPhysicalCardId) && commanderIds.has(commanderPhysicalCardId) &&
        validPlayerId(defendingPlayerId) && defendingPlayerIdsSet.has(defendingPlayerId) && validDamage(damage)) {
        entryPairs.add(pair);
        rawEntries.push(Object.freeze({
          commanderPhysicalCardId,
          defendingPlayerId,
          damage,
        }));
      }
    });
  }
  if (issues.length > 0) throw new CoreCommanderDamageCreationErrorV1(sortedIssues(issues));
  return Object.freeze({
    commanders: Object.freeze(commanders.slice()),
    defendingPlayerIds: Object.freeze(defendingPlayerIds.slice()),
    entries: frozenEntries(rawEntries),
  });
}

export function recordCoreCommanderDamageV1(
  state: CoreCommanderDamageStateV1,
  input: unknown,
): CoreCommanderDamageStateV1 {
  const normalizedState = createCoreCommanderDamageStateV1(state);
  const parsed = readDataRecord(input, ['commanderPhysicalCardId', 'defendingPlayerId', 'damage'], '');
  const issues = [...parsed.issues];
  if (parsed.record === null || parsed.issues.length > 0) throw new CoreCommanderDamageRecordingErrorV1(sortedIssues(issues));
  const commanderPhysicalCardId = parsed.record.commanderPhysicalCardId;
  const defendingPlayerId = parsed.record.defendingPlayerId;
  const damage = parsed.record.damage;
  const commanderIds = commanderAllowlist(normalizedState.commanders);
  const defendingPlayerIds = defendingPlayerAllowlist(normalizedState.defendingPlayerIds);
  if (!validPhysicalCardId(commanderPhysicalCardId)) issues.push(issue('INVALID_ID', '/commanderPhysicalCardId', 'Invalid Core physical card ID'));
  else if (!commanderIds.has(commanderPhysicalCardId)) issues.push(issue('UNREGISTERED_COMMANDER', '/commanderPhysicalCardId', 'Commander physical ID is not registered'));
  if (!validPlayerId(defendingPlayerId)) issues.push(issue('INVALID_ID', '/defendingPlayerId', 'Invalid Core player ID'));
  else if (!defendingPlayerIds.has(defendingPlayerId)) issues.push(issue('UNREGISTERED_DEFENDING_PLAYER', '/defendingPlayerId', 'Defending player ID is not registered'));
  if (!validDamage(damage)) issues.push(issue('INVALID_DAMAGE', '/damage', 'Damage must be a nonnegative safe integer'));
  if (issues.length > 0) throw new CoreCommanderDamageRecordingErrorV1(sortedIssues(issues));
  if (!validPhysicalCardId(commanderPhysicalCardId) || !validPlayerId(defendingPlayerId) || !validDamage(damage)) {
    throw new CoreCommanderDamageRecordingErrorV1(sortedIssues(issues));
  }
  if (damage === 0) return normalizedState;
  const existingIndex = normalizedState.entries.findIndex((entry) =>
    entry.commanderPhysicalCardId === commanderPhysicalCardId && entry.defendingPlayerId === defendingPlayerId);
  const current = existingIndex === -1 ? 0 : normalizedState.entries[existingIndex].damage;
  if (!Number.isSafeInteger(current + damage)) throw new CoreCommanderDamageRecordingErrorV1([
    issue('INVALID_DAMAGE', '/damage', 'Damage total exceeds the safe integer range'),
  ]);
  const nextEntry = Object.freeze({
    commanderPhysicalCardId,
    defendingPlayerId,
    damage: current + damage,
  });
  const nextEntries = normalizedState.entries.slice();
  if (existingIndex === -1) nextEntries.push(nextEntry);
  else nextEntries[existingIndex] = nextEntry;
  return Object.freeze({
    commanders: normalizedState.commanders,
    defendingPlayerIds: normalizedState.defendingPlayerIds,
    entries: frozenEntries(nextEntries),
  });
}

export function coreCommanderDamageAgainstV1(
  state: CoreCommanderDamageStateV1,
  commanderPhysicalCardId: unknown,
  defendingPlayerId: unknown,
): number {
  const normalizedState = createCoreCommanderDamageStateV1(state);
  const issues: CoreCommanderDamageValidationIssueV1[] = [];
  const commanderIds = commanderAllowlist(normalizedState.commanders);
  const defendingPlayerIds = defendingPlayerAllowlist(normalizedState.defendingPlayerIds);
  if (!validPhysicalCardId(commanderPhysicalCardId)) issues.push(issue('INVALID_ID', '/commanderPhysicalCardId', 'Invalid Core physical card ID'));
  if (!validPlayerId(defendingPlayerId)) issues.push(issue('INVALID_ID', '/defendingPlayerId', 'Invalid Core player ID'));
  if (validPhysicalCardId(commanderPhysicalCardId) && !commanderIds.has(commanderPhysicalCardId)) {
    issues.push(issue('UNREGISTERED_COMMANDER', '/commanderPhysicalCardId', 'Commander physical ID is not registered'));
  }
  if (validPlayerId(defendingPlayerId) && !defendingPlayerIds.has(defendingPlayerId)) {
    issues.push(issue('UNREGISTERED_DEFENDING_PLAYER', '/defendingPlayerId', 'Defending player ID is not registered'));
  }
  if (issues.length > 0) throw new CoreCommanderDamageRecordingErrorV1(sortedIssues(issues));
  if (!validPhysicalCardId(commanderPhysicalCardId) || !validPlayerId(defendingPlayerId)) {
    throw new CoreCommanderDamageRecordingErrorV1(sortedIssues(issues));
  }
  return normalizedState.entries.find((entry) =>
    entry.commanderPhysicalCardId === commanderPhysicalCardId && entry.defendingPlayerId === defendingPlayerId)?.damage ?? 0;
}
