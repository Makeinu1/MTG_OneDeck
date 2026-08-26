import {
  isCanonicalCoreObjectIdV2,
  isCoreBaseId,
  validateCoreRuleZoneRefV1,
  type CoreDecisionContextV1,
  type CoreObjectId,
  type CorePlayerId,
  type CoreRuleZoneRefV1,
} from '../../engine/core/index';
import { validateBuildId, type BuildId } from '../../versioning/index';
import type {
  OnlineProjectionIssueCodeV1,
  OnlineProjectionIssueV1,
} from './types';

export type ReadableRecord = Record<string, unknown>;
const APPLICATION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const CORE_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const CAPABILITY = /^[A-Za-z0-9_-]{32,128}$/;
const CAPABILITY_RUN = /[A-Za-z0-9_-]{32,}/;
const UNSAFE = new Set(['__proto__', 'prototype', 'constructor']);

export function compareCodeUnits(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

export function pointer(path: string, segment: string): string {
  return `${path}/${segment.replaceAll('~', '~0').replaceAll('/', '~1')}`;
}

export function projectionIssue(
  code: OnlineProjectionIssueCodeV1,
  path: string,
  message: string,
): OnlineProjectionIssueV1 {
  return Object.freeze({ code, path, message });
}

function unknownFieldSegment(key: PropertyKey): string {
  if (typeof key === 'symbol') return '<symbol>';
  const segment = String(key);
  return CAPABILITY_RUN.test(segment) ? '<unknown-field>' : segment;
}

export function freezeProjectionIssues(
  issues: readonly OnlineProjectionIssueV1[],
  capabilities: readonly string[] = [],
): readonly OnlineProjectionIssueV1[] {
  const literals = [...new Set(capabilities)]
    .filter(isProjectionCapability)
    .sort((a, b) => b.length - a.length || compareCodeUnits(a, b));
  const redact = (input: string): string => {
    let result = input;
    for (const literal of literals) result = result.replaceAll(literal, '<redacted-capability>');
    return result;
  };
  return Object.freeze(
    issues
      .map((value) => {
        const code = redact(value.code);
        return Object.freeze({
          code: code === value.code ? value.code : ('INVALID_CAPABILITY' as const),
          path: redact(value.path),
          message: redact(value.message),
        });
      })
      .sort(
        (a, b) =>
          compareCodeUnits(a.path, b.path) ||
          compareCodeUnits(a.code, b.code) ||
          compareCodeUnits(a.message, b.message),
      ),
  );
}

export function readExactRecord(
  input: unknown,
  fields: readonly string[],
  path: string,
  issues: OnlineProjectionIssueV1[],
  required: readonly string[] = fields,
): ReadableRecord | null {
  if (input === null || typeof input !== 'object') {
    issues.push(projectionIssue(path === '' ? 'INVALID_ROOT' : 'INVALID_TYPE', path, 'Expected a plain record'));
    return null;
  }
  let array: boolean;
  let prototype: object | null;
  let keys: readonly PropertyKey[];
  try {
    array = Array.isArray(input);
    prototype = Reflect.getPrototypeOf(input);
    keys = Reflect.ownKeys(input);
  } catch {
    issues.push(projectionIssue('INVALID_DESCRIPTOR', path, 'Record inspection is not safe'));
    return null;
  }
  if (array || (prototype !== Object.prototype && prototype !== null)) {
    issues.push(projectionIssue(path === '' ? 'INVALID_ROOT' : 'INVALID_TYPE', path, 'Expected a plain record'));
    return null;
  }
  const allowed = new Set(fields);
  const present = new Set<string>();
  const result = Object.create(null) as ReadableRecord;
  for (const key of keys) {
    const keyPath = pointer(
      path,
      typeof key === 'string' && allowed.has(key)
        ? key
        : unknownFieldSegment(key),
    );
    if (typeof key !== 'string' || !allowed.has(key)) {
      issues.push(projectionIssue('UNKNOWN_FIELD', keyPath, 'Unknown field'));
      continue;
    }
    present.add(key);
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(input, key);
    } catch {
      issues.push(projectionIssue('INVALID_DESCRIPTOR', keyPath, 'Field descriptor is not readable'));
      continue;
    }
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) {
      issues.push(projectionIssue('INVALID_DESCRIPTOR', keyPath, 'Field must be an enumerable data property'));
      continue;
    }
    result[key] = descriptor.value;
  }
  for (const field of required) {
    if (!present.has(field)) issues.push(projectionIssue('MISSING_FIELD', pointer(path, field), 'Required field is missing'));
  }
  return result;
}

export type DenseArrayRead = Readonly<{ readonly length: number; readonly values: readonly unknown[] }>;
export function readDenseArray(
  input: unknown,
  path: string,
  issues: OnlineProjectionIssueV1[],
  maxLength = Number.MAX_SAFE_INTEGER,
): DenseArrayRead | null {
  let array: boolean;
  try {
    array = Array.isArray(input);
  } catch {
    issues.push(projectionIssue('INVALID_DESCRIPTOR', path, 'Array inspection is not safe'));
    return null;
  }
  if (!array) {
    issues.push(projectionIssue('INVALID_ARRAY', path, 'Expected an ordinary dense array'));
    return null;
  }
  const object = input as object;
  let prototype: object | null;
  let keys: readonly PropertyKey[];
  let lengthDescriptor: PropertyDescriptor | undefined;
  try {
    prototype = Reflect.getPrototypeOf(object);
    keys = Reflect.ownKeys(object);
    lengthDescriptor = Object.getOwnPropertyDescriptor(object, 'length');
  } catch {
    issues.push(projectionIssue('INVALID_DESCRIPTOR', path, 'Array descriptors are not readable'));
    return null;
  }
  if (prototype !== Array.prototype) issues.push(projectionIssue('INVALID_ARRAY', path, 'Expected an ordinary dense array'));
  if (lengthDescriptor === undefined || !('value' in lengthDescriptor) || typeof lengthDescriptor.value !== 'number') {
    issues.push(projectionIssue('INVALID_ARRAY', pointer(path, 'length'), 'Invalid array length'));
    return null;
  }
  const length = lengthDescriptor.value;
  if (!Number.isSafeInteger(length) || length < 0) {
    issues.push(projectionIssue('INVALID_ARRAY', pointer(path, 'length'), 'Invalid array length'));
    return null;
  }
  if (length > maxLength) {
    issues.push(projectionIssue('INVALID_ARRAY', pointer(path, 'length'), 'Array exceeds the bounded projection limit'));
    return null;
  }
  const values: unknown[] = [];
  const present = new Set<number>();
  for (const key of keys) {
    if (key === 'length') continue;
    const numeric = typeof key === 'string' && /^(0|[1-9][0-9]*)$/.test(key) ? Number(key) : -1;
    if (!Number.isSafeInteger(numeric) || numeric < 0 || numeric >= length) {
      issues.push(projectionIssue(
        'UNKNOWN_FIELD',
        pointer(path, unknownFieldSegment(key)),
        'Unknown array property',
      ));
      continue;
    }
    present.add(numeric);
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(object, key);
    } catch {
      issues.push(projectionIssue('INVALID_DESCRIPTOR', pointer(path, String(key)), 'Array entry is not readable'));
      continue;
    }
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) {
      issues.push(projectionIssue('INVALID_DESCRIPTOR', pointer(path, String(key)), 'Invalid array entry descriptor'));
      continue;
    }
    values[numeric] = descriptor.value;
  }
  if (present.size !== length) {
    let missing = 0;
    while (present.has(missing)) missing += 1;
    issues.push(projectionIssue('NON_DENSE_ARRAY', pointer(path, String(missing)), 'Array is sparse'));
  }
  return Object.freeze({ length, values: Object.freeze(values.slice()) });
}

export function isApplicationId(value: unknown): value is string {
  return typeof value === 'string' && APPLICATION_ID.test(value) && !UNSAFE.has(value);
}
export function isCoreKey(value: unknown): value is string {
  return typeof value === 'string' && CORE_KEY.test(value) && !UNSAFE.has(value);
}
export function isProjectionCapability(value: unknown): value is string {
  return typeof value === 'string' && CAPABILITY.test(value);
}
export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
export function checkedBuildId(value: unknown): BuildId | null {
  const checked = validateBuildId(value);
  return checked.ok ? checked.value : null;
}

export function validateDecisionContext(
  input: unknown,
  path: string,
  issues: OnlineProjectionIssueV1[],
): CoreDecisionContextV1 | null {
  if (input === null) return null;
  const record = readExactRecord(input, ['kind', 'decisionKey', 'searchSessionId', 'turnNumber'], path, issues, ['kind']);
  if (record === null) return null;
  const optionalTurn = Object.prototype.hasOwnProperty.call(record, 'turnNumber');
  if (optionalTurn && !isNonNegativeInteger(record.turnNumber)) {
    issues.push(projectionIssue('INVALID_INTEGER', pointer(path, 'turnNumber'), 'Turn number must be a non-negative safe integer'));
  }
  if (record.kind === 'decision') {
    if (!Object.prototype.hasOwnProperty.call(record, 'decisionKey')) issues.push(projectionIssue('MISSING_FIELD', pointer(path, 'decisionKey'), 'Required field is missing'));
    if (!isCoreKey(record.decisionKey)) issues.push(projectionIssue('INVALID_ID', pointer(path, 'decisionKey'), 'Invalid decision key'));
    if (Object.prototype.hasOwnProperty.call(record, 'searchSessionId')) issues.push(projectionIssue('UNKNOWN_FIELD', pointer(path, 'searchSessionId'), 'Field is not valid for this context'));
    if (isCoreKey(record.decisionKey) && (!optionalTurn || isNonNegativeInteger(record.turnNumber))) {
      return Object.freeze({ kind: 'decision', decisionKey: record.decisionKey as never, ...(optionalTurn ? { turnNumber: record.turnNumber as number } : {}) });
    }
  } else if (record.kind === 'search-session') {
    if (!Object.prototype.hasOwnProperty.call(record, 'searchSessionId')) issues.push(projectionIssue('MISSING_FIELD', pointer(path, 'searchSessionId'), 'Required field is missing'));
    if (!isCoreKey(record.searchSessionId)) issues.push(projectionIssue('INVALID_ID', pointer(path, 'searchSessionId'), 'Invalid search session ID'));
    if (Object.prototype.hasOwnProperty.call(record, 'decisionKey')) issues.push(projectionIssue('UNKNOWN_FIELD', pointer(path, 'decisionKey'), 'Field is not valid for this context'));
    if (isCoreKey(record.searchSessionId) && (!optionalTurn || isNonNegativeInteger(record.turnNumber))) {
      return Object.freeze({ kind: 'search-session', searchSessionId: record.searchSessionId as never, ...(optionalTurn ? { turnNumber: record.turnNumber as number } : {}) });
    }
  } else issues.push(projectionIssue('INVALID_LITERAL', pointer(path, 'kind'), 'Invalid decision context kind'));
  return null;
}

export function deepFreezeCopy<T>(input: T): T {
  if (input === null || typeof input !== 'object') return input;
  try {
    if (Array.isArray(input)) {
      const lengthDescriptor = Object.getOwnPropertyDescriptor(input, 'length');
      if (
        lengthDescriptor === undefined ||
        !('value' in lengthDescriptor) ||
        typeof lengthDescriptor.value !== 'number' ||
        !Number.isSafeInteger(lengthDescriptor.value) ||
        lengthDescriptor.value < 0
      ) throw new TypeError('Invalid array descriptor');
      const values: unknown[] = [];
      for (let index = 0; index < lengthDescriptor.value; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
        if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) {
          throw new TypeError('Invalid array entry descriptor');
        }
        values.push(deepFreezeCopy(descriptor.value));
      }
      return Object.freeze(values) as unknown as T;
    }
    const output = Object.create(null) as Record<string, unknown>;
    const keys = Reflect.ownKeys(input);
    if (keys.some((key) => typeof key !== 'string')) throw new TypeError('Symbol keys are not canonical');
    const stringKeys = keys as readonly string[];
    for (const key of stringKeys.slice().sort(compareCodeUnits)) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) {
        throw new TypeError('Invalid record field descriptor');
      }
      output[key] = deepFreezeCopy(descriptor.value);
    }
    return Object.freeze(output) as T;
  } catch (error: unknown) {
    if (error instanceof TypeError) throw error;
    throw new TypeError('Value could not be copied safely', { cause: error });
  }
}

export function descriptorSafeStructuralEqual(left: unknown, right: unknown): boolean {
  const ancestors = new WeakMap<object, object>();
  const equal = (leftValue: unknown, rightValue: unknown): boolean => {
    if (Object.is(leftValue, rightValue)) return true;
    if (
      leftValue === null ||
      rightValue === null ||
      typeof leftValue !== 'object' ||
      typeof rightValue !== 'object'
    ) return false;
    if (ancestors.get(leftValue) === rightValue) return true;
    ancestors.set(leftValue, rightValue);
    try {
      const leftArray = Array.isArray(leftValue);
      const rightArray = Array.isArray(rightValue);
      if (leftArray !== rightArray) return false;
      const leftKeys = Reflect.ownKeys(leftValue);
      const rightKeys = Reflect.ownKeys(rightValue);
      if (
        leftKeys.some((key) => typeof key !== 'string') ||
        rightKeys.some((key) => typeof key !== 'string')
      ) return false;
      const leftStrings = (leftKeys as readonly string[])
        .filter((key) => key !== 'length')
        .slice()
        .sort(compareCodeUnits);
      const rightStrings = (rightKeys as readonly string[])
        .filter((key) => key !== 'length')
        .slice()
        .sort(compareCodeUnits);
      if (
        leftStrings.length !== rightStrings.length ||
        leftStrings.some((key, index) => key !== rightStrings[index])
      ) return false;
      for (const key of leftStrings) {
        const leftDescriptor = Object.getOwnPropertyDescriptor(leftValue, key);
        const rightDescriptor = Object.getOwnPropertyDescriptor(rightValue, key);
        if (
          leftDescriptor === undefined ||
          rightDescriptor === undefined ||
          leftDescriptor.enumerable !== true ||
          rightDescriptor.enumerable !== true ||
          !('value' in leftDescriptor) ||
          !('value' in rightDescriptor) ||
          !equal(leftDescriptor.value, rightDescriptor.value)
        ) return false;
      }
      if (leftArray) {
        const leftLength = Object.getOwnPropertyDescriptor(leftValue, 'length');
        const rightLength = Object.getOwnPropertyDescriptor(rightValue, 'length');
        if (
          leftLength === undefined ||
          rightLength === undefined ||
          !('value' in leftLength) ||
          !('value' in rightLength) ||
          leftLength.value !== rightLength.value
        ) return false;
      }
      return true;
    } catch {
      return false;
    } finally {
      ancestors.delete(leftValue);
    }
  };
  return equal(left, right);
}

export function graphContainsCapability(input: unknown, capabilities: readonly string[]): boolean {
  const ancestors = new WeakSet<object>();
  const inspect = (value: unknown): boolean => {
    if (typeof value === 'string') return capabilities.some((capability) => value.includes(capability));
    if (value === null || typeof value !== 'object') return false;
    if (ancestors.has(value)) return true;
    ancestors.add(value);
    try {
      const keys = Reflect.ownKeys(value);
      for (const key of keys) {
        if (typeof key === 'string' && capabilities.some((capability) => key.includes(capability))) return true;
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor === undefined || !('value' in descriptor) || inspect(descriptor.value)) return true;
      }
      return false;
    } catch {
      return true;
    } finally {
      ancestors.delete(value);
    }
  };
  return inspect(input);
}

export function isDeeplyFrozenDescriptorSafe(input: unknown): boolean {
  const ancestors = new WeakSet<object>();
  const inspect = (value: unknown): boolean => {
    if (value === null || typeof value !== 'object') return true;
    if (ancestors.has(value)) return false;
    ancestors.add(value);
    try {
      if (!Object.isFrozen(value)) return false;
      for (const key of Reflect.ownKeys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (descriptor === undefined || !('value' in descriptor) || !inspect(descriptor.value)) return false;
      }
      return true;
    } catch {
      return false;
    } finally {
      ancestors.delete(value);
    }
  };
  return inspect(input);
}

export function validatePlayerId(value: unknown): value is CorePlayerId {
  return isCoreBaseId(value);
}
export function validateObjectId(value: unknown): value is CoreObjectId {
  return isCanonicalCoreObjectIdV2(value);
}
export function checkedZoneRef(value: unknown): CoreRuleZoneRefV1 | null {
  const result = validateCoreRuleZoneRefV1(value);
  return result.ok ? result.value : null;
}
