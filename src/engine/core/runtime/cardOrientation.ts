export interface CoreCardOrientationStateV1 {
  readonly faceIndex: number;
  readonly faceDown: boolean;
  readonly tapped: boolean;
  readonly flipped: boolean;
  readonly phasedOut: boolean;
}

export type CoreCardOrientationValidationCode =
  | 'INVALID_ROOT'
  | 'MISSING_FIELD'
  | 'UNKNOWN_FIELD'
  | 'INVALID_TYPE'
  | 'INVALID_INTEGER';

export interface CoreCardOrientationValidationIssue {
  readonly code: CoreCardOrientationValidationCode;
  readonly path: string;
  readonly message: string;
}

export type CoreCardOrientationValidationResult =
  | {
      readonly ok: true;
      readonly value: CoreCardOrientationStateV1;
    }
  | {
      readonly ok: false;
      readonly issues: readonly CoreCardOrientationValidationIssue[];
    };

export class CoreCardOrientationCreationError extends Error {
  readonly issues: readonly CoreCardOrientationValidationIssue[];

  constructor(issues: readonly CoreCardOrientationValidationIssue[]) {
    super(`Invalid Core card orientation state (${issues.length} issue(s))`);
    this.name = 'CoreCardOrientationCreationError';
    this.issues = issues;
  }
}

const ORIENTATION_FIELDS = [
  'faceIndex',
  'faceDown',
  'tapped',
  'flipped',
  'phasedOut',
] as const;

type RawRecord = Record<string, unknown>;

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
  private readonly values: CoreCardOrientationValidationIssue[] = [];
  private readonly seen = new Set<string>();

  add(code: CoreCardOrientationValidationCode, path: string, message: string): void {
    const key = `${path}\u0000${code}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.values.push({ code, path, message });
  }

  sorted(): readonly CoreCardOrientationValidationIssue[] {
    return this.values.slice().sort((left, right) =>
      codeUnitCompare(left.path, right.path) || codeUnitCompare(left.code, right.code));
  }
}

function readRoot(value: unknown, issues: IssueCollector): RawRecord | null {
  if (!isPlainRecord(value)) {
    issues.add('INVALID_ROOT', '', 'Expected a plain root object');
    return null;
  }

  const expected = new Set<string>(ORIENTATION_FIELDS);
  const result: RawRecord = Object.create(null) as RawRecord;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') {
      issues.add('UNKNOWN_FIELD', pointer('', String(key)), 'Symbol fields are not allowed');
      continue;
    }
    const fieldPath = pointer('', key);
    if (!expected.has(key)) {
      issues.add('UNKNOWN_FIELD', fieldPath, `Unknown field: ${key}`);
      continue;
    }
    const propertyDescriptor = Object.getOwnPropertyDescriptor(value, key);
    if (propertyDescriptor === undefined || !propertyDescriptor.enumerable) {
      issues.add('UNKNOWN_FIELD', fieldPath, 'Non-enumerable fields are not allowed');
      continue;
    }
    const descriptor = isDataDescriptor(propertyDescriptor);
    if (descriptor === null) {
      issues.add('INVALID_TYPE', fieldPath, 'Accessor properties are not allowed');
      continue;
    }
    result[key] = descriptor.value;
  }

  for (const field of ORIENTATION_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(result, field)) {
      issues.add('MISSING_FIELD', pointer('', field), `Missing field: ${field}`);
    }
  }
  return result;
}

function validateValues(root: RawRecord, issues: IssueCollector): void {
  const faceIndexPath = pointer('', 'faceIndex');
  const faceIndex = root.faceIndex;
  if (typeof faceIndex !== 'number') {
    issues.add('INVALID_TYPE', faceIndexPath, 'Expected a number');
  } else if (!Number.isSafeInteger(faceIndex) || faceIndex < 0) {
    issues.add('INVALID_INTEGER', faceIndexPath, 'Expected a non-negative safe integer');
  }

  for (const field of ['faceDown', 'tapped', 'flipped', 'phasedOut'] as const) {
    if (typeof root[field] !== 'boolean') {
      issues.add('INVALID_TYPE', pointer('', field), 'Expected a boolean');
    }
  }
}

function frozenOrientationValue(root: RawRecord): CoreCardOrientationStateV1 {
  const value: RawRecord = Object.create(null) as RawRecord;
  for (const field of ORIENTATION_FIELDS) {
    Object.defineProperty(value, field, {
      value: root[field],
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return Object.freeze(value) as unknown as CoreCardOrientationStateV1;
}

export function validateCoreCardOrientationStateV1(
  input: unknown,
): CoreCardOrientationValidationResult {
  const issues = new IssueCollector();
  const root = readRoot(input, issues);
  if (root === null) return { ok: false, issues: issues.sorted() };

  validateValues(root, issues);
  const sortedIssues = issues.sorted();
  if (sortedIssues.length > 0) return { ok: false, issues: sortedIssues };
  return { ok: true, value: frozenOrientationValue(root) };
}

export function createCoreCardOrientationStateV1(
  input: unknown,
): CoreCardOrientationStateV1 {
  const validation = validateCoreCardOrientationStateV1(input);
  if (!validation.ok) throw new CoreCardOrientationCreationError(validation.issues);
  return validation.value;
}
