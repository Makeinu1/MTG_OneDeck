import type { OnlineRoomValidationCodeV1, OnlineRoomValidationIssueV1 } from './types';

export type ReadableRecord = Record<string, unknown>;

const READ_FIELD_ISSUE_CODES = new Set(['MISSING_FIELD', 'INVALID_DESCRIPTOR']);

export type IndexedArrayEntry = Readonly<{
  readonly index: number;
  readonly value: unknown;
}>;

export type DenseArrayRead = Readonly<{
  readonly length: number;
  readonly entries: readonly IndexedArrayEntry[];
}>;

const APPLICATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const CAPABILITY_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const CAPABILITY_SHAPED_RUN_PATTERN = /[A-Za-z0-9_-]{32,}/g;
const UNSAFE_APPLICATION_IDS = new Set(['__proto__', 'prototype', 'constructor']);
const REDACTED_CAPABILITY = '<redacted-capability>';

export function codeUnitCompare(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

export function roomIssue(
  code: OnlineRoomValidationCodeV1,
  path: string,
  message: string,
): OnlineRoomValidationIssueV1 {
  return Object.freeze({ code, path, message });
}

export function sortedRoomIssues(
  issues: readonly OnlineRoomValidationIssueV1[],
  configuredCapabilities: readonly string[] = [],
): readonly OnlineRoomValidationIssueV1[] {
  const capabilityLiterals = [...new Set(configuredCapabilities)]
    .filter(isOnlineRoomSeatCapabilityV1)
    .sort(
      (left, right) =>
        right.length - left.length || codeUnitCompare(left, right),
    );
  const redactLiterals = (value: string): string => {
    let redacted = value;
    for (const capability of capabilityLiterals) {
      redacted = redacted.replaceAll(capability, REDACTED_CAPABILITY);
    }
    return redacted.replace(CAPABILITY_SHAPED_RUN_PATTERN, REDACTED_CAPABILITY);
  };
  return Object.freeze(
    issues
      .map((current) => {
        const redactedCode = redactLiterals(current.code);
        return Object.freeze({
          code:
            redactedCode === current.code
              ? current.code
              : 'INVALID_CAPABILITY',
          path: redactLiterals(current.path),
          message: redactLiterals(current.message),
        });
      })
      .sort(
        (left, right) =>
          codeUnitCompare(left.path, right.path) || codeUnitCompare(left.code, right.code),
      ),
  );
}

export function pointer(path: string, segment: string): string {
  return `${path}/${segment.replaceAll('~', '~0').replaceAll('/', '~1')}`;
}

export function hasReadableField(record: ReadableRecord, field: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, field);
}

export function hasFieldReadIssue(
  issues: readonly OnlineRoomValidationIssueV1[],
  path: string,
): boolean {
  return issues.some(
    (current) => current.path === path && READ_FIELD_ISSUE_CODES.has(current.code),
  );
}

export function readExactRecord(
  input: unknown,
  fields: readonly string[],
  path: string,
  issues: OnlineRoomValidationIssueV1[],
  requiredFields: readonly string[] = fields,
): ReadableRecord | null {
  if (input === null || typeof input !== 'object') {
    issues.push(
      roomIssue(path === '' ? 'INVALID_ROOT' : 'INVALID_TYPE', path, 'Expected a plain record'),
    );
    return null;
  }

  let array: boolean;
  try {
    array = Array.isArray(input);
  } catch {
    issues.push(roomIssue('INVALID_DESCRIPTOR', path, 'Record inspection is not safe'));
    return null;
  }
  if (array) {
    issues.push(
      roomIssue(path === '' ? 'INVALID_ROOT' : 'INVALID_TYPE', path, 'Expected a plain record'),
    );
    return null;
  }

  let prototype: object | null;
  try {
    prototype = Reflect.getPrototypeOf(input);
  } catch {
    issues.push(roomIssue('INVALID_DESCRIPTOR', path, 'Record prototype is not readable'));
    return null;
  }
  if (prototype !== Object.prototype && prototype !== null) {
    issues.push(
      roomIssue(
        path === '' ? 'INVALID_ROOT' : 'INVALID_TYPE',
        path,
        'Expected an ordinary plain record',
      ),
    );
    return null;
  }

  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(input);
  } catch {
    issues.push(roomIssue('INVALID_DESCRIPTOR', path, 'Record keys are not readable'));
    return null;
  }

  const allowed = new Set(fields);
  const present = new Set<string>();
  const readable = Object.create(null) as ReadableRecord;
  for (const key of keys) {
    const keyPath = pointer(path, typeof key === 'string' ? key : '<symbol>');
    if (typeof key !== 'string' || !allowed.has(key)) {
      issues.push(roomIssue('UNKNOWN_FIELD', keyPath, 'Unknown field'));
      continue;
    }
    present.add(key);
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(input, key);
    } catch {
      issues.push(roomIssue('INVALID_DESCRIPTOR', keyPath, 'Field descriptor is not readable'));
      continue;
    }
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) {
      issues.push(
        roomIssue('INVALID_DESCRIPTOR', keyPath, 'Field must be an enumerable data property'),
      );
      continue;
    }
    readable[key] = descriptor.value;
  }
  for (const field of requiredFields) {
    if (!present.has(field)) {
      issues.push(roomIssue('MISSING_FIELD', pointer(path, field), `Missing field: ${field}`));
    }
  }
  return readable;
}

function canonicalArrayIndex(key: string, length: number): boolean {
  if (key !== '0' && !/^[1-9][0-9]*$/.test(key)) return false;
  const numeric = Number(key);
  return Number.isSafeInteger(numeric) && numeric >= 0 && numeric < length;
}

export function readDenseArray(
  input: unknown,
  path: string,
  issues: OnlineRoomValidationIssueV1[],
): DenseArrayRead | null {
  let array: boolean;
  try {
    array = Array.isArray(input);
  } catch {
    issues.push(roomIssue('INVALID_DESCRIPTOR', path, 'Array inspection is not safe'));
    return null;
  }
  if (!array) {
    issues.push(roomIssue('INVALID_ARRAY', path, 'Expected an ordinary dense array'));
    return null;
  }

  const arrayObject = input as object;
  let prototype: object | null;
  try {
    prototype = Reflect.getPrototypeOf(arrayObject);
  } catch {
    issues.push(roomIssue('INVALID_DESCRIPTOR', path, 'Array prototype is not readable'));
    return null;
  }
  if (prototype !== Array.prototype) {
    issues.push(roomIssue('INVALID_ARRAY', path, 'Expected an ordinary dense array'));
  }

  let keys: readonly PropertyKey[];
  let lengthDescriptor: PropertyDescriptor | undefined;
  try {
    keys = Reflect.ownKeys(arrayObject);
    lengthDescriptor = Object.getOwnPropertyDescriptor(arrayObject, 'length');
  } catch {
    issues.push(roomIssue('INVALID_DESCRIPTOR', path, 'Array descriptors are not readable'));
    return null;
  }
  if (lengthDescriptor === undefined || !('value' in lengthDescriptor)) {
    issues.push(
      roomIssue(
        'INVALID_DESCRIPTOR',
        pointer(path, 'length'),
        'Array length is not a data property',
      ),
    );
    return null;
  }
  const rawLength: unknown = lengthDescriptor.value;
  if (typeof rawLength !== 'number' || !Number.isSafeInteger(rawLength) || rawLength < 0) {
    issues.push(
      roomIssue(
        'INVALID_ARRAY',
        pointer(path, 'length'),
        'Array length must be a non-negative safe integer',
      ),
    );
    return null;
  }

  const length = rawLength;
  const entriesByIndex = new Map<number, IndexedArrayEntry>();
  const presentIndexes = new Set<number>();
  for (const key of keys) {
    if (key === 'length') continue;
    if (typeof key !== 'string' || !canonicalArrayIndex(key, length)) {
      issues.push(
        roomIssue(
          'UNKNOWN_FIELD',
          pointer(path, typeof key === 'string' ? key : '<symbol>'),
          'Unknown array property',
        ),
      );
      continue;
    }
    const index = Number(key);
    presentIndexes.add(index);
    const indexPath = pointer(path, key);
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(arrayObject, key);
    } catch {
      issues.push(
        roomIssue('INVALID_DESCRIPTOR', indexPath, 'Array entry descriptor is not readable'),
      );
      continue;
    }
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) {
      issues.push(
        roomIssue(
          'INVALID_DESCRIPTOR',
          indexPath,
          'Array entries must be enumerable data properties',
        ),
      );
      continue;
    }
    const descriptorRecord = descriptor as unknown as Record<string, unknown>;
    entriesByIndex.set(index, Object.freeze({ index, value: descriptorRecord.value }));
  }

  const sortedPresentIndexes = [...presentIndexes].sort((left, right) => left - right);
  if (sortedPresentIndexes.length !== length) {
    let firstMissingIndex = 0;
    for (const index of sortedPresentIndexes) {
      if (index !== firstMissingIndex) break;
      firstMissingIndex += 1;
    }
    issues.push(
      roomIssue(
        'NON_DENSE_ARRAY',
        pointer(path, String(firstMissingIndex)),
        'Array entries must be dense',
      ),
    );
  }
  const sortedIndexes = [...entriesByIndex.keys()].sort((left, right) => left - right);
  const entries = sortedIndexes.map((index) => entriesByIndex.get(index) as IndexedArrayEntry);
  return Object.freeze({ length, entries: Object.freeze(entries) });
}

export function isOnlineRoomApplicationIdV1(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    APPLICATION_ID_PATTERN.test(value) &&
    !UNSAFE_APPLICATION_IDS.has(value)
  );
}

export function isOnlineRoomSeatCapabilityV1(value: unknown): value is string {
  return typeof value === 'string' && CAPABILITY_PATTERN.test(value);
}

export function isOnlineRoomSeatIndexV1(value: unknown): value is 0 | 1 | 2 | 3 {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 3;
}
