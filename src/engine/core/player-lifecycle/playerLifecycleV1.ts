import { isCoreBaseId, type CorePlayerId } from '../ids';

export type CorePlayerLifecycleStatusV1 = 'active' | 'exited';
export type CorePlayerExitCauseV1 = 'concession' | 'defeat';

export type CorePlayerLifecycleEntryV1 = Readonly<{
  readonly playerId: CorePlayerId;
  readonly status: CorePlayerLifecycleStatusV1;
  readonly exitCause: CorePlayerExitCauseV1 | null;
}>;

export type CorePlayerLifecycleStateV1 = Readonly<{
  readonly players: readonly CorePlayerLifecycleEntryV1[];
}>;

export type CorePlayerExitRequestV1 = Readonly<{
  readonly playerId: CorePlayerId;
  readonly cause: CorePlayerExitCauseV1;
}>;

export type CorePlayerLifecycleIssueCodeV1 =
  | 'INVALID_ROOT'
  | 'MISSING_FIELD'
  | 'UNKNOWN_FIELD'
  | 'INVALID_DESCRIPTOR'
  | 'INVALID_TYPE'
  | 'INVALID_ID'
  | 'DUPLICATE_PLAYER'
  | 'INVALID_STATUS'
  | 'INVALID_CAUSE'
  | 'INVALID_RELATION'
  | 'UNKNOWN_PLAYER'
  | 'PLAYER_ALREADY_EXITED';

export type CorePlayerLifecycleIssueV1 = Readonly<{
  readonly code: CorePlayerLifecycleIssueCodeV1;
  readonly path: string;
  readonly message: string;
}>;

export class CorePlayerLifecycleErrorV1 extends Error {
  readonly issues: readonly CorePlayerLifecycleIssueV1[];

  constructor(issues: readonly CorePlayerLifecycleIssueV1[]) {
    super(`Invalid Core player lifecycle value (${issues.length} issue(s))`);
    this.name = 'CorePlayerLifecycleErrorV1';
    this.issues = Object.freeze(issues.map((current) => Object.freeze({ ...current })));
    Object.freeze(this);
  }
}

type RawRecord = Record<string, unknown>;

const STATE_FIELDS = ['players'] as const;
const ENTRY_FIELDS = ['playerId', 'status', 'exitCause'] as const;
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
  code: CorePlayerLifecycleIssueCodeV1,
  path: string,
  message: string,
): CorePlayerLifecycleIssueV1 {
  return { code, path, message };
}

function sortedIssues(
  issues: readonly CorePlayerLifecycleIssueV1[],
): readonly CorePlayerLifecycleIssueV1[] {
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
  issues: CorePlayerLifecycleIssueV1[],
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
  issues: CorePlayerLifecycleIssueV1[],
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

function normalizeLifecycle(
  value: unknown,
  issues: CorePlayerLifecycleIssueV1[],
): readonly CorePlayerLifecycleEntryV1[] | null {
  const root = readRecord(value, STATE_FIELDS, '', issues);
  if (root === null) return null;
  const rawPlayers = readDenseArray(root.players, '/players', issues);
  if (rawPlayers === null) return null;

  const entries: CorePlayerLifecycleEntryV1[] = [];
  const seen = new Set<string>();
  for (const [index, rawEntry] of rawPlayers.entries()) {
    const path = `/players/${index}`;
    const entry = readRecord(rawEntry, ENTRY_FIELDS, path, issues);
    if (entry === null) continue;
    const playerId = entry.playerId;
    const status = entry.status;
    const exitCause = entry.exitCause;
    const validPlayer = isCoreBaseId(playerId);
    const validStatus = status === 'active' || status === 'exited';
    const validCause = exitCause === null || CAUSES.includes(exitCause as CorePlayerExitCauseV1);
    if (!validPlayer) issues.push(issue('INVALID_ID', `${path}/playerId`, 'Invalid Core player ID'));
    if (!validStatus) issues.push(issue('INVALID_STATUS', `${path}/status`, 'Invalid lifecycle status'));
    if (!validCause) issues.push(issue('INVALID_CAUSE', `${path}/exitCause`, 'Invalid exit cause'));
    if (validStatus && validCause) {
      if (status === 'active' && exitCause !== null) {
        issues.push(issue('INVALID_RELATION', path, 'Active players must have a null exit cause'));
      }
      if (status === 'exited' && exitCause === null) {
        issues.push(issue('INVALID_RELATION', path, 'Exited players must have an exit cause'));
      }
    }
    if (validPlayer) {
      if (seen.has(playerId)) issues.push(issue('DUPLICATE_PLAYER', `${path}/playerId`, 'Duplicate player ID'));
      seen.add(playerId);
    }
    if (validPlayer && validStatus && validCause
      && ((status === 'active' && exitCause === null) || (status === 'exited' && exitCause !== null))) {
      entries.push({
        playerId: playerId as CorePlayerId,
        status,
        exitCause: exitCause as CorePlayerExitCauseV1 | null,
      });
    }
  }
  return entries;
}

function normalizeRequest(
  value: unknown,
  issues: CorePlayerLifecycleIssueV1[],
): CorePlayerExitRequestV1 | null {
  const request = readRecord(value, REQUEST_FIELDS, '', issues);
  if (request === null) return null;
  const playerId = request.playerId;
  const cause = request.cause;
  const validPlayer = isCoreBaseId(playerId);
  const validCause = CAUSES.includes(cause as CorePlayerExitCauseV1);
  if (!validPlayer) issues.push(issue('INVALID_ID', '/playerId', 'Invalid Core player ID'));
  if (!validCause) issues.push(issue('INVALID_CAUSE', '/cause', 'Invalid exit cause'));
  if (!validPlayer || !validCause) return null;
  return Object.freeze({ playerId: playerId as CorePlayerId, cause: cause as CorePlayerExitCauseV1 });
}

function freezeState(entries: readonly CorePlayerLifecycleEntryV1[]): CorePlayerLifecycleStateV1 {
  return Object.freeze({
    players: Object.freeze(entries.map((entry) => Object.freeze({
      playerId: entry.playerId,
      status: entry.status,
      exitCause: entry.exitCause,
    }))),
  });
}

function throwIfIssues(issues: readonly CorePlayerLifecycleIssueV1[]): void {
  if (issues.length > 0) throw new CorePlayerLifecycleErrorV1(sortedIssues(issues));
}

export function createCorePlayerLifecycleStateV1(value: unknown): CorePlayerLifecycleStateV1 {
  const issues: CorePlayerLifecycleIssueV1[] = [];
  const entries = normalizeLifecycle(value, issues);
  throwIfIssues(issues);
  return freezeState(entries ?? []);
}

export function applyCorePlayerExitV1(
  state: unknown,
  request: unknown,
): CorePlayerLifecycleStateV1 {
  const issues: CorePlayerLifecycleIssueV1[] = [];
  const entries = normalizeLifecycle(state, issues);
  const normalizedRequest = normalizeRequest(request, issues);
  if (entries !== null && normalizedRequest !== null) {
    const current = entries.find((entry) => entry.playerId === normalizedRequest.playerId);
    if (current === undefined) {
      issues.push(issue('UNKNOWN_PLAYER', '/playerId', 'Player is not registered'));
    } else if (current.status !== 'active') {
      issues.push(issue('PLAYER_ALREADY_EXITED', '/playerId', 'Player has already exited'));
    }
  }
  throwIfIssues(issues);
  const exitRequest = normalizedRequest as CorePlayerExitRequestV1;
  const normalizedEntries = entries as readonly CorePlayerLifecycleEntryV1[];
  return freezeState(normalizedEntries.map((entry) => (
    entry.playerId === exitRequest.playerId
      ? { playerId: entry.playerId, status: 'exited', exitCause: exitRequest.cause }
      : entry
  )));
}

function normalizedEntriesForQuery(state: unknown): readonly CorePlayerLifecycleEntryV1[] {
  const issues: CorePlayerLifecycleIssueV1[] = [];
  const entries = normalizeLifecycle(state, issues);
  throwIfIssues(issues);
  return entries ?? [];
}

function entryForQuery(state: unknown, playerId: unknown): CorePlayerLifecycleEntryV1 {
  const entries = normalizedEntriesForQuery(state);
  const issues: CorePlayerLifecycleIssueV1[] = [];
  if (!isCoreBaseId(playerId)) issues.push(issue('INVALID_ID', '/playerId', 'Invalid Core player ID'));
  const entry = isCoreBaseId(playerId)
    ? entries.find((current) => current.playerId === playerId)
    : undefined;
  if (entry === undefined && isCoreBaseId(playerId)) {
    issues.push(issue('UNKNOWN_PLAYER', '/playerId', 'Player is not registered'));
  }
  throwIfIssues(issues);
  return entry as CorePlayerLifecycleEntryV1;
}

export function corePlayerLifecycleStatusV1(
  state: unknown,
  playerId: unknown,
): CorePlayerLifecycleStatusV1 {
  return entryForQuery(state, playerId).status;
}

export function corePlayerLifecycleExitCauseV1(
  state: unknown,
  playerId: unknown,
): CorePlayerExitCauseV1 | null {
  return entryForQuery(state, playerId).exitCause;
}
