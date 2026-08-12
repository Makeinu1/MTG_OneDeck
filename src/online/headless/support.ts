import type {
  OnlineHeadlessRoomGateIssueCodeV1,
  OnlineHeadlessRoomGateIssueV1,
} from './types';

export type HeadlessReadableRecord = Record<string, unknown>;

export type HeadlessDenseArray = Readonly<{
  readonly length: number;
  readonly values: readonly unknown[];
}>;

const CAPABILITY_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const CAPABILITY_RUN_PATTERN = /[A-Za-z0-9_-]{32,}/;
const POSSIBLE_CAPABILITY_FRAGMENT_PATTERN = /[A-Za-z0-9_-]{8,}/;
const APPLICATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const CORE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const UNSAFE_IDS = new Set(['__proto__', 'prototype', 'constructor']);
const MINIMUM_PRIVATE_FRAGMENT_LENGTH = 8;

export function compareHeadlessCodeUnits(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

export function headlessIssue(
  code: OnlineHeadlessRoomGateIssueCodeV1,
  path: string,
  message: string,
): OnlineHeadlessRoomGateIssueV1 {
  return Object.freeze({ code, path, message });
}

export function isHeadlessCapability(value: unknown): value is string {
  return typeof value === 'string' && CAPABILITY_PATTERN.test(value);
}

export function isHeadlessApplicationId(value: unknown): value is string {
  return typeof value === 'string'
    && APPLICATION_ID_PATTERN.test(value)
    && !UNSAFE_IDS.has(value);
}

export function isHeadlessCoreKey(value: unknown): value is string {
  return typeof value === 'string' && CORE_KEY_PATTERN.test(value) && !UNSAFE_IDS.has(value);
}

export function isHeadlessNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function headlessPointer(path: string, segment: string): string {
  return `${path}/${segment.replaceAll('~', '~0').replaceAll('/', '~1')}`;
}

export function containsHeadlessCapabilityFragment(
  value: string,
  capabilities: readonly string[],
): boolean {
  for (const capability of capabilities) {
    if (!isHeadlessCapability(capability)) continue;
    for (
      let offset = 0;
      offset <= capability.length - MINIMUM_PRIVATE_FRAGMENT_LENGTH;
      offset += 1
    ) {
      if (value.includes(capability.slice(offset, offset + MINIMUM_PRIVATE_FRAGMENT_LENGTH))) {
        return true;
      }
    }
  }
  return false;
}

function capabilityUnknownKey(key: PropertyKey, capabilities: readonly string[]): boolean {
  if (typeof key !== 'string') return false;
  if (POSSIBLE_CAPABILITY_FRAGMENT_PATTERN.test(key)) return true;
  return containsHeadlessCapabilityFragment(key, capabilities);
}

function unknownPath(path: string, key: PropertyKey, capabilities: readonly string[]): string {
  if (capabilityUnknownKey(key, capabilities)) return '/<unknown-field>';
  return headlessPointer(path, typeof key === 'string' ? key : '<symbol>');
}

export function freezeHeadlessIssues(
  issues: readonly OnlineHeadlessRoomGateIssueV1[],
  capabilities: readonly string[] = [],
): readonly OnlineHeadlessRoomGateIssueV1[] {
  const literals = [...new Set(capabilities)]
    .filter(isHeadlessCapability)
    .sort((left, right) => right.length - left.length || compareHeadlessCodeUnits(left, right));
  const redact = (value: string): string => {
    if (containsHeadlessCapabilityFragment(value, literals)) return '<redacted-capability>';
    let result = value;
    for (const capability of literals) result = result.replaceAll(capability, '<redacted-capability>');
    return result.replace(CAPABILITY_RUN_PATTERN, '<redacted-capability>');
  };
  return Object.freeze(
    issues
      .map((current) => {
        const redactedPath = current.code === 'UNKNOWN_FIELD'
          && (CAPABILITY_RUN_PATTERN.test(current.path)
            || containsHeadlessCapabilityFragment(current.path, literals))
          ? '/<unknown-field>'
          : redact(current.path);
        return Object.freeze({
          code: current.code,
          path: redactedPath,
          message: redact(current.message),
        });
      })
      .sort((left, right) =>
        compareHeadlessCodeUnits(left.path, right.path)
        || compareHeadlessCodeUnits(left.code, right.code)
        || compareHeadlessCodeUnits(left.message, right.message)),
  );
}

export function hasHeadlessField(record: HeadlessReadableRecord, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, field);
}

export function readHeadlessExactRecord(
  input: unknown,
  fields: readonly string[],
  path: string,
  issues: OnlineHeadlessRoomGateIssueV1[],
  required: readonly string[] = fields,
  capabilities: readonly string[] = [],
): HeadlessReadableRecord | null {
  if (input === null || typeof input !== 'object') {
    issues.push(headlessIssue(
      path === '' ? 'INVALID_ROOT' : 'INVALID_TYPE',
      path,
      'Expected a plain record',
    ));
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
    issues.push(headlessIssue('INVALID_DESCRIPTOR', path, 'Record inspection is not safe'));
    return null;
  }
  if (array || (prototype !== Object.prototype && prototype !== null)) {
    issues.push(headlessIssue(
      path === '' ? 'INVALID_ROOT' : 'INVALID_TYPE',
      path,
      'Expected a plain record',
    ));
    return null;
  }
  const allowed = new Set(fields);
  const present = new Set<string>();
  const record = Object.create(null) as HeadlessReadableRecord;
  for (const key of keys) {
    if (typeof key !== 'string' || !allowed.has(key)) {
      issues.push(headlessIssue(
        'UNKNOWN_FIELD',
        unknownPath(path, key, capabilities),
        'Unknown field',
      ));
      continue;
    }
    present.add(key);
    const keyPath = headlessPointer(path, key);
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(input, key);
    } catch {
      issues.push(headlessIssue('INVALID_DESCRIPTOR', keyPath, 'Field descriptor is not readable'));
      continue;
    }
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) {
      issues.push(headlessIssue(
        'INVALID_DESCRIPTOR',
        keyPath,
        'Field must be an enumerable data property',
      ));
      continue;
    }
    record[key] = descriptor.value;
  }
  for (const field of required) {
    if (!present.has(field)) {
      issues.push(headlessIssue(
        'MISSING_FIELD',
        headlessPointer(path, field),
        'Required field is missing',
      ));
    }
  }
  return record;
}

export function readHeadlessDenseArray(
  input: unknown,
  path: string,
  issues: OnlineHeadlessRoomGateIssueV1[],
  maxLength: number,
  capabilities: readonly string[] = [],
): HeadlessDenseArray | null {
  let array: boolean;
  try {
    array = Array.isArray(input);
  } catch {
    issues.push(headlessIssue('INVALID_DESCRIPTOR', path, 'Array inspection is not safe'));
    return null;
  }
  if (!array) {
    issues.push(headlessIssue('INVALID_ARRAY', path, 'Expected an array'));
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
    issues.push(headlessIssue('INVALID_DESCRIPTOR', path, 'Array descriptors are not readable'));
    return null;
  }
  if (prototype !== Array.prototype) {
    issues.push(headlessIssue('INVALID_ARRAY', path, 'Expected an ordinary array'));
  }
  if (lengthDescriptor === undefined || !('value' in lengthDescriptor)
    || !isHeadlessNonNegativeInteger(lengthDescriptor.value)) {
    issues.push(headlessIssue('INVALID_ARRAY', headlessPointer(path, 'length'), 'Invalid array length'));
    return null;
  }
  const length = lengthDescriptor.value;
  if (length > maxLength) {
    issues.push(headlessIssue(
      'INVALID_ARRAY',
      headlessPointer(path, 'length'),
      'Array exceeds the maximum supported length',
    ));
    return null;
  }
  const expected = new Set<string>();
  for (let index = 0; index < length; index += 1) expected.add(String(index));
  for (const key of keys) {
    if (key === 'length') continue;
    if (typeof key !== 'string' || !expected.has(key)) {
      issues.push(headlessIssue(
        'UNKNOWN_FIELD',
        unknownPath(path, key, capabilities),
        'Arrays must not have extra fields',
      ));
    }
  }
  const values: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const key = String(index);
    const keyPath = headlessPointer(path, key);
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(object, key);
    } catch {
      issues.push(headlessIssue('INVALID_DESCRIPTOR', keyPath, 'Array entry is not readable'));
      continue;
    }
    if (descriptor === undefined) {
      issues.push(headlessIssue('NON_DENSE_ARRAY', keyPath, 'Array is sparse'));
      continue;
    }
    if (descriptor.enumerable !== true || !('value' in descriptor)) {
      issues.push(headlessIssue(
        'INVALID_DESCRIPTOR',
        keyPath,
        'Array entry must be an enumerable data property',
      ));
      continue;
    }
    values[index] = descriptor.value;
  }
  return Object.freeze({ length, values: Object.freeze(values.slice()) });
}

export type HeadlessGraphInspection = 'clear' | 'contains-capability' | 'unsafe';

export function inspectHeadlessPublicGraph(
  input: unknown,
  capabilities: readonly string[],
): HeadlessGraphInspection {
  const literals = [...new Set(capabilities)].filter(isHeadlessCapability);
  const seen = new Set<object>();
  const visit = (value: unknown): HeadlessGraphInspection => {
    if (typeof value === 'string') {
      return containsHeadlessCapabilityFragment(value, literals)
        ? 'contains-capability'
        : 'clear';
    }
    if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
      return 'clear';
    }
    const object = value;
    if (seen.has(object)) return 'clear';
    seen.add(object);
    let keys: readonly PropertyKey[];
    try {
      keys = Reflect.ownKeys(object);
    } catch {
      return 'unsafe';
    }
    for (const key of keys) {
      if (typeof key === 'string'
        && containsHeadlessCapabilityFragment(key, literals)) {
        return 'contains-capability';
      }
      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Object.getOwnPropertyDescriptor(object, key);
      } catch {
        return 'unsafe';
      }
      if (descriptor === undefined || !('value' in descriptor)) return 'unsafe';
      const result = visit(descriptor.value);
      if (result !== 'clear') return result;
    }
    return 'clear';
  };
  try {
    return visit(input);
  } catch {
    return 'unsafe';
  }
}
