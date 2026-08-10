export type CoreRuleValidationCodeV1 =
  | 'INVALID_TYPE'
  | 'INVALID_LITERAL'
  | 'INVALID_ID'
  | 'UNSAFE_RECORD_KEY'
  | 'INVALID_STRING'
  | 'INVALID_INTEGER'
  | 'INVALID_ARRAY'
  | 'MISSING_FIELD'
  | 'UNKNOWN_FIELD'
  | 'INVALID_ORDER'
  | 'DUPLICATE_VALUE'
  | 'PLAYER_NOT_SEATED'
  | 'OBJECT_NOT_FOUND'
  | 'OBJECT_NOT_CONTROLLABLE'
  | 'EFFECT_SET_MISMATCH'
  | 'CONTINUITY_SET_MISMATCH'
  | 'CONTINUITY_CONTROLLER_MISMATCH'
  | 'GRANT_SET_MISMATCH'
  | 'SESSION_SET_MISMATCH'
  | 'PERMISSION_SET_MISMATCH'
  | 'AUTHORITY_SET_MISMATCH'
  | 'SEARCH_SNAPSHOT_MISMATCH'
  | 'DECISION_AUTHORITY_MISMATCH'
  | 'VISIBILITY_RULE_MISMATCH'
  | 'PLAY_SUBJECT_MISMATCH'
  | 'CROSS_SLICE_MISMATCH'
  | 'INVALID_ROOT'
  | 'INVALID_TURN_PRIORITY_BUNDLE'
  | 'INVALID_CONTROL_SLICE'
  | 'INVALID_VISIBILITY_SLICE'
  | 'INVALID_SEARCH_SESSION_SLICE'
  | 'INVALID_PLAY_PERMISSION_SLICE'
  | 'INVALID_DECISION_AUTHORITY_SLICE';

export type CoreRuleValidationIssueV1 = Readonly<{
  readonly code: CoreRuleValidationCodeV1;
  readonly path: string;
  readonly message: string;
}>;

export type CoreRuleValidationResultV1<T> =
  | Readonly<{ readonly ok: true; readonly value: T }>
  | Readonly<{ readonly ok: false; readonly issues: readonly CoreRuleValidationIssueV1[] }>;

export type CoreRuleRawRecordV1 = Record<string, unknown>;

const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export function isCoreRuleUnsafeRecordKeyV1(key: string): boolean {
  return UNSAFE_KEYS.has(key);
}

export function compareCoreRuleCodeUnitsV1(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

export function escapeCoreRuleJsonPointerSegmentV1(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

export function coreRuleJsonPointerV1(path: string, segment?: string): string {
  if (segment === undefined) return path;
  return `${path}/${escapeCoreRuleJsonPointerSegmentV1(segment)}`;
}

export function makeCoreRuleIssueV1(
  code: CoreRuleValidationCodeV1,
  path: string,
  message: string,
): CoreRuleValidationIssueV1 {
  return Object.freeze({ code, path, message });
}

export function sortCoreRuleIssuesV1(
  issues: readonly CoreRuleValidationIssueV1[],
): readonly CoreRuleValidationIssueV1[] {
  const unique = new Map<string, CoreRuleValidationIssueV1>();
  for (const issue of issues) unique.set(`${issue.path}\u0000${issue.code}`, issue);
  return Object.freeze(
    [...unique.values()].sort(
      (left, right) =>
        compareCoreRuleCodeUnitsV1(left.path, right.path) ||
        compareCoreRuleCodeUnitsV1(left.code, right.code),
    ),
  );
}

export function isCoreRulePlainRecordV1(value: unknown): value is CoreRuleRawRecordV1 {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Reflect.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function readKeys(value: object): readonly PropertyKey[] | null {
  try {
    return Reflect.ownKeys(value);
  } catch {
    return null;
  }
}

export function readCoreRuleExactRecordV1(
  value: unknown,
  fields: readonly string[],
  path = '',
  requiredFields: readonly string[] = fields,
): {
  readonly record: CoreRuleRawRecordV1 | null;
  readonly issues: readonly CoreRuleValidationIssueV1[];
} {
  if (!isCoreRulePlainRecordV1(value)) {
    return {
      record: null,
      issues: [makeCoreRuleIssueV1('INVALID_TYPE', path, 'Expected a plain object record')],
    };
  }
  const issues: CoreRuleValidationIssueV1[] = [];
  const result = Object.create(null) as CoreRuleRawRecordV1;
  const allowed = new Set(fields);
  const keys = readKeys(value);
  if (keys === null)
    return {
      record: null,
      issues: [makeCoreRuleIssueV1('INVALID_TYPE', path, 'Object keys are not readable')],
    };
  for (const key of keys) {
    const keyText = typeof key === 'string' ? key : `[symbol:${String(key)}]`;
    const fieldPath = coreRuleJsonPointerV1(path, keyText);
    if (typeof key !== 'string') {
      issues.push(makeCoreRuleIssueV1('UNKNOWN_FIELD', fieldPath, 'Symbol fields are not allowed'));
      continue;
    }
    if (isCoreRuleUnsafeRecordKeyV1(key)) {
      issues.push(makeCoreRuleIssueV1('UNSAFE_RECORD_KEY', fieldPath, `Unsafe record key: ${key}`));
      continue;
    }
    if (!allowed.has(key)) {
      issues.push(makeCoreRuleIssueV1('UNKNOWN_FIELD', fieldPath, `Unknown field: ${key}`));
      continue;
    }
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      issues.push(
        makeCoreRuleIssueV1('INVALID_TYPE', fieldPath, 'Field descriptor is not readable'),
      );
      continue;
    }
    if (descriptor === undefined || descriptor.enumerable !== true) {
      issues.push(
        makeCoreRuleIssueV1('UNKNOWN_FIELD', fieldPath, 'Non-enumerable fields are not allowed'),
      );
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      issues.push(
        makeCoreRuleIssueV1('INVALID_TYPE', fieldPath, 'Accessor properties are not allowed'),
      );
      continue;
    }
    result[key] = descriptor.value;
  }
  for (const field of requiredFields) {
    if (!Object.prototype.hasOwnProperty.call(result, field)) {
      issues.push(
        makeCoreRuleIssueV1(
          'MISSING_FIELD',
          coreRuleJsonPointerV1(path, field),
          `Missing field: ${field}`,
        ),
      );
    }
  }
  return { record: result, issues: sortCoreRuleIssuesV1(issues) };
}

export const readCoreRuleRecordV1 = readCoreRuleExactRecordV1;

export function hasCoreRuleOwnFieldV1(record: CoreRuleRawRecordV1, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, field);
}

export function canonicalCoreRuleRecordV1<T extends object>(
  fields: readonly string[],
  read: (field: string) => unknown,
): T {
  const result = Object.create(null) as Record<string, unknown>;
  for (const field of fields) result[field] = read(field);
  return result as T;
}

export function deepFreezeCoreRuleValueV1<T>(value: T, seen = new Set<object>()): T {
  if (value !== null && typeof value === 'object' && !seen.has(value)) {
    seen.add(value);
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        deepFreezeCoreRuleValueV1(descriptor.value, seen);
      }
    }
    Object.freeze(value);
  }
  return value;
}

export function freshCoreRuleJsonValueV1<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
