export interface CoreCounterEntryV1 {
  readonly kind: string;
  readonly count: number;
}

export interface CoreCounterDamageStateV1 {
  readonly counters: readonly CoreCounterEntryV1[];
  readonly markedDamage: number;
}

export type CoreCounterDamageValidationCode =
  | 'INVALID_ROOT'
  | 'MISSING_FIELD'
  | 'UNKNOWN_FIELD'
  | 'INVALID_TYPE'
  | 'INVALID_STRING'
  | 'INVALID_INTEGER'
  | 'DUPLICATE_COUNTER_KIND'
  | 'INVALID_ORDER';

export interface CoreCounterDamageValidationIssue {
  readonly code: CoreCounterDamageValidationCode;
  readonly path: string;
  readonly message: string;
}

export type CoreCounterDamageValidationResult =
  | {
      readonly ok: true;
      readonly value: CoreCounterDamageStateV1;
    }
  | {
      readonly ok: false;
      readonly issues: readonly CoreCounterDamageValidationIssue[];
    };

export class CoreCounterDamageCreationError extends Error {
  readonly issues: readonly CoreCounterDamageValidationIssue[];

  constructor(issues: readonly CoreCounterDamageValidationIssue[]) {
    super(`Invalid Core counter/damage state (${issues.length} issue(s))`);
    this.name = 'CoreCounterDamageCreationError';
    this.issues = issues;
  }
}

const ROOT_FIELDS = ['counters', 'markedDamage'] as const;
const ENTRY_FIELDS = ['kind', 'count'] as const;

type RawRecord = Record<string, unknown>;

function codeUnitCompare(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function escapePointerSegment(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

function pointer(...segments: readonly string[]): string {
  if (segments.length === 0) return '';
  const [base, ...children] = segments;
  return `${base}${children.map((segment) => `/${escapePointerSegment(segment)}`).join('')}`;
}

function isPlainRecord(value: unknown): value is RawRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): { readonly value: unknown } | null {
  if (descriptor === undefined || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null;
  return { value: descriptor.value };
}

class IssueCollector {
  private readonly values: CoreCounterDamageValidationIssue[] = [];
  private readonly seen = new Set<string>();

  add(code: CoreCounterDamageValidationCode, path: string, message: string): void {
    const identity = `${path}\u0000${code}`;
    if (this.seen.has(identity)) return;
    this.seen.add(identity);
    this.values.push({ code, path, message });
  }

  sorted(): readonly CoreCounterDamageValidationIssue[] {
    return this.values.slice().sort((left, right) =>
      codeUnitCompare(left.path, right.path) || codeUnitCompare(left.code, right.code));
  }
}

function readObject(
  value: unknown,
  path: string,
  fields: readonly string[],
  issues: IssueCollector,
): RawRecord | null {
  if (!isPlainRecord(value)) {
    issues.add('INVALID_TYPE', path, 'Expected a plain object');
    return null;
  }

  const expected = new Set(fields);
  const result: RawRecord = Object.create(null) as RawRecord;
  const present = new Set<string>();
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') {
      issues.add('UNKNOWN_FIELD', `${path}/${escapePointerSegment(String(key))}`, 'Symbol fields are not allowed');
      continue;
    }
    const fieldPath = pointer(path, key);
    if (!expected.has(key)) {
      issues.add('UNKNOWN_FIELD', fieldPath, `Unknown field: ${key}`);
      continue;
    }

    present.add(key);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable) {
      issues.add('UNKNOWN_FIELD', fieldPath, 'Non-enumerable fields are not allowed');
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
    if (!present.has(field)) {
      issues.add('MISSING_FIELD', pointer(path, field), `Missing field: ${field}`);
    }
  }
  return result;
}

function readArray(value: unknown, path: string, issues: IssueCollector): readonly unknown[] {
  if (!Array.isArray(value)) {
    issues.add('INVALID_TYPE', path, 'Expected an array');
    return [];
  }

  const length = isDataDescriptor(Object.getOwnPropertyDescriptor(value, 'length'))?.value;
  if (typeof length !== 'number' || !Number.isSafeInteger(length) || length < 0) {
    issues.add('INVALID_TYPE', path, 'Expected an ordinary array length');
    return [];
  }

  for (const key of Reflect.ownKeys(value)) {
    if (key === 'length') continue;
    if (typeof key !== 'string') {
      issues.add('UNKNOWN_FIELD', `${path}/${escapePointerSegment(String(key))}`, 'Symbol array properties are not allowed');
      continue;
    }
    const index = Number(key);
    if (!Number.isSafeInteger(index) || index < 0 || index >= length || String(index) !== key) {
      issues.add('UNKNOWN_FIELD', pointer(path, key), `Unknown array property: ${key}`);
    }
  }

  const result: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const itemPath = pointer(path, String(index));
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !descriptor.enumerable || isDataDescriptor(descriptor) === null) {
      issues.add('INVALID_TYPE', itemPath, 'Array elements must be enumerable data properties');
      result.push(undefined);
      continue;
    }
    result.push(isDataDescriptor(descriptor)?.value);
  }
  return result;
}

function counterKindValue(value: unknown, path: string, issues: IssueCollector): string | null {
  if (typeof value !== 'string') {
    issues.add('INVALID_TYPE', path, 'Expected a string');
    return null;
  }

  let invalid = value.length === 0 || value.trim() !== value;
  let codePointCount = 0;
  for (const character of value) {
    codePointCount += 1;
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) continue;
    if (codePoint <= 0x1f || codePoint === 0x7f || (codePoint >= 0x80 && codePoint <= 0x9f)) {
      invalid = true;
    }
  }
  if (codePointCount < 1 || codePointCount > 80) invalid = true;
  if (invalid) issues.add('INVALID_STRING', path, 'Invalid counter kind');
  return value;
}

function counterCountValue(value: unknown, path: string, issues: IssueCollector): number | null {
  if (typeof value !== 'number') {
    issues.add('INVALID_TYPE', path, 'Expected a number');
    return null;
  }
  if (!Number.isSafeInteger(value) || value < 1) {
    issues.add('INVALID_INTEGER', path, 'Counter count must be a positive safe integer');
    return null;
  }
  return value;
}

function markedDamageValue(value: unknown, path: string, issues: IssueCollector): number | null {
  if (typeof value !== 'number') {
    issues.add('INVALID_TYPE', path, 'Expected a number');
    return null;
  }
  if (!Number.isSafeInteger(value) || value < 0) {
    issues.add('INVALID_INTEGER', path, 'Marked damage must be a non-negative safe integer');
    return null;
  }
  return value;
}

function freezeState(
  entries: readonly CoreCounterEntryV1[],
  markedDamage: number,
): CoreCounterDamageStateV1 {
  const frozenEntries = entries.map((entry) => Object.freeze({
    kind: entry.kind,
    count: entry.count,
  }));
  const counters = Object.freeze(frozenEntries) as readonly CoreCounterEntryV1[];
  return Object.freeze({ counters, markedDamage });
}

export function validateCoreCounterDamageStateV1(value: unknown): CoreCounterDamageValidationResult {
  const issues = new IssueCollector();
  if (!isPlainRecord(value)) {
    issues.add('INVALID_ROOT', '', 'Expected a plain root object');
    return { ok: false, issues: issues.sorted() };
  }

  const root = readObject(value, '', ROOT_FIELDS, issues);
  if (root === null) return { ok: false, issues: issues.sorted() };

  const rawCounters = readArray(root.counters, '/counters', issues);
  const entries: CoreCounterEntryV1[] = [];
  const seenKinds = new Set<string>();
  let previousKind: string | null = null;
  for (let index = 0; index < rawCounters.length; index += 1) {
    const entryPath = pointer('/counters', String(index));
    const entry = readObject(rawCounters[index], entryPath, ENTRY_FIELDS, issues);
    if (entry === null) continue;

    const kindPath = pointer(entryPath, 'kind');
    const countPath = pointer(entryPath, 'count');
    const kind = counterKindValue(entry.kind, kindPath, issues);
    const count = counterCountValue(entry.count, countPath, issues);
    if (kind !== null) {
      if (seenKinds.has(kind)) issues.add('DUPLICATE_COUNTER_KIND', kindPath, 'Counter kind must be unique');
      seenKinds.add(kind);
      if (previousKind !== null && codeUnitCompare(previousKind, kind) > 0) {
        issues.add('INVALID_ORDER', kindPath, 'Counter kinds must be code-unit sorted');
      }
      previousKind = kind;
    }
    if (kind !== null && count !== null) entries.push({ kind, count });
  }

  const markedDamage = markedDamageValue(root.markedDamage, '/markedDamage', issues);
  const sortedIssues = issues.sorted();
  if (sortedIssues.length > 0 || markedDamage === null || entries.length !== rawCounters.length) {
    return { ok: false, issues: sortedIssues };
  }
  return { ok: true, value: freezeState(entries, markedDamage) };
}

export function createCoreCounterDamageStateV1(value: unknown): CoreCounterDamageStateV1 {
  const validation = validateCoreCounterDamageStateV1(value);
  if (!validation.ok) throw new CoreCounterDamageCreationError(validation.issues);
  return validation.value;
}
