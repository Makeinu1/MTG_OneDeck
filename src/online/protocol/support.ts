import type {
  OnlineProtocolCommandIdV1,
  OnlineProtocolIssueCodeV1,
  OnlineProtocolIssueV1,
  OnlineProtocolObserverCapabilityV1,
  OnlineProtocolRevisionV1,
} from './types';

export type ReadableRecord = Record<string, unknown>;

export type DenseArrayRead = Readonly<{
  readonly length: number;
  readonly entries: readonly Readonly<{ readonly index: number; readonly value: unknown }>[];
}>;

const APPLICATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const CAPABILITY_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const CAPABILITY_RUN_PATTERN = /[A-Za-z0-9_-]{32,}/g;
const MINIMUM_CAPABILITY_FRAGMENT_LENGTH = 8;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const UNSAFE_IDS = new Set(['__proto__', 'prototype', 'constructor']);
const REDACTED_CAPABILITY = '<redacted-capability>';

export function compareCodeUnits(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

export function protocolIssue(
  code: OnlineProtocolIssueCodeV1,
  path: string,
  message: string,
): OnlineProtocolIssueV1 {
  return Object.freeze({ code, path, message });
}

export function freezeProtocolIssues(
  issues: readonly OnlineProtocolIssueV1[],
  configuredCapabilities: readonly string[] = [],
): readonly OnlineProtocolIssueV1[] {
  const literals = [...new Set(configuredCapabilities)]
    .filter(isProtocolCapability)
    .sort((left, right) => right.length - left.length || compareCodeUnits(left, right));
  const redact = (input: string): string => {
    let output = input;
    for (const literal of literals) output = output.replaceAll(literal, REDACTED_CAPABILITY);
    return output.replace(CAPABILITY_RUN_PATTERN, REDACTED_CAPABILITY);
  };
  return Object.freeze(
    issues
      .map((current) => {
        const code = redact(current.code);
        return Object.freeze({
          code: code === current.code ? current.code : 'INVALID_CAPABILITY',
          path: redact(current.path),
          message: redact(current.message),
        });
      })
      .sort(
        (left, right) =>
          compareCodeUnits(left.path, right.path) || compareCodeUnits(left.code, right.code),
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
  issues: readonly OnlineProtocolIssueV1[],
  path: string,
): boolean {
  return issues.some(
    (current) =>
      current.path === path &&
      (current.code === 'MISSING_FIELD' || current.code === 'INVALID_DESCRIPTOR'),
  );
}

export function readExactRecord(
  input: unknown,
  fields: readonly string[],
  path: string,
  issues: OnlineProtocolIssueV1[],
  requiredFields: readonly string[] = fields,
): ReadableRecord | null {
  if (input === null || typeof input !== 'object') {
    issues.push(
      protocolIssue(path === '' ? 'INVALID_ROOT' : 'INVALID_TYPE', path, 'Expected a plain record'),
    );
    return null;
  }
  let array: boolean;
  let prototype: object | null;
  try {
    array = Array.isArray(input);
    prototype = Reflect.getPrototypeOf(input);
  } catch {
    issues.push(protocolIssue('INVALID_DESCRIPTOR', path, 'Record inspection is not safe'));
    return null;
  }
  if (array || (prototype !== Object.prototype && prototype !== null)) {
    issues.push(
      protocolIssue(path === '' ? 'INVALID_ROOT' : 'INVALID_TYPE', path, 'Expected a plain record'),
    );
    return null;
  }
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(input);
  } catch {
    issues.push(protocolIssue('INVALID_DESCRIPTOR', path, 'Record keys are not readable'));
    return null;
  }
  const allowed = new Set(fields);
  const present = new Set<string>();
  const readable = Object.create(null) as ReadableRecord;
  for (const key of keys) {
    const keyPath = pointer(path, typeof key === 'string' ? key : '<symbol>');
    if (typeof key !== 'string' || !allowed.has(key)) {
      issues.push(protocolIssue('UNKNOWN_FIELD', keyPath, 'Unknown field'));
      continue;
    }
    present.add(key);
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(input, key);
    } catch {
      issues.push(protocolIssue('INVALID_DESCRIPTOR', keyPath, 'Field descriptor is not readable'));
      continue;
    }
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) {
      issues.push(
        protocolIssue(
          'INVALID_DESCRIPTOR',
          keyPath,
          'Field must be an enumerable data property',
        ),
      );
      continue;
    }
    readable[key] = descriptor.value;
  }
  for (const field of requiredFields) {
    if (!present.has(field)) {
      issues.push(protocolIssue('MISSING_FIELD', pointer(path, field), 'Required field is missing'));
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
  issues: OnlineProtocolIssueV1[],
): DenseArrayRead | null {
  let array: boolean;
  try {
    array = Array.isArray(input);
  } catch {
    issues.push(protocolIssue('INVALID_DESCRIPTOR', path, 'Array inspection is not safe'));
    return null;
  }
  if (!array) {
    issues.push(protocolIssue('INVALID_ARRAY', path, 'Expected an ordinary dense array'));
    return null;
  }
  const objectValue = input as object;
  let prototype: object | null;
  let keys: readonly PropertyKey[];
  let lengthDescriptor: PropertyDescriptor | undefined;
  try {
    prototype = Reflect.getPrototypeOf(objectValue);
    keys = Reflect.ownKeys(objectValue);
    lengthDescriptor = Object.getOwnPropertyDescriptor(objectValue, 'length');
  } catch {
    issues.push(protocolIssue('INVALID_DESCRIPTOR', path, 'Array descriptors are not readable'));
    return null;
  }
  if (prototype !== Array.prototype) {
    issues.push(protocolIssue('INVALID_ARRAY', path, 'Expected an ordinary dense array'));
  }
  if (
    lengthDescriptor === undefined ||
    !('value' in lengthDescriptor) ||
    typeof lengthDescriptor.value !== 'number' ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0
  ) {
    issues.push(protocolIssue('INVALID_ARRAY', pointer(path, 'length'), 'Invalid array length'));
    return null;
  }
  const length = lengthDescriptor.value;
  const present = new Set<number>();
  const entries = new Map<number, Readonly<{ readonly index: number; readonly value: unknown }>>();
  for (const key of keys) {
    if (key === 'length') continue;
    if (typeof key !== 'string' || !canonicalArrayIndex(key, length)) {
      issues.push(
        protocolIssue(
          'UNKNOWN_FIELD',
          pointer(path, typeof key === 'string' ? key : '<symbol>'),
          'Unknown array property',
        ),
      );
      continue;
    }
    const index = Number(key);
    present.add(index);
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(objectValue, key);
    } catch {
      issues.push(
        protocolIssue('INVALID_DESCRIPTOR', pointer(path, key), 'Array entry is not readable'),
      );
      continue;
    }
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) {
      issues.push(
        protocolIssue('INVALID_DESCRIPTOR', pointer(path, key), 'Invalid array entry descriptor'),
      );
      continue;
    }
    const descriptorRecord = descriptor as unknown as Record<string, unknown>;
    entries.set(index, Object.freeze({ index, value: descriptorRecord.value }));
  }
  if (present.size !== length) {
    let missing = 0;
    while (present.has(missing)) missing += 1;
    issues.push(protocolIssue('NON_DENSE_ARRAY', pointer(path, String(missing)), 'Array is sparse'));
  }
  return Object.freeze({
    length,
    entries: Object.freeze(
      [...entries.values()].sort((left, right) => left.index - right.index),
    ),
  });
}

export function isProtocolApplicationId(value: unknown): value is string {
  return (
    typeof value === 'string' && APPLICATION_ID_PATTERN.test(value) && !UNSAFE_IDS.has(value)
  );
}

export function isProtocolCapability(
  value: unknown,
): value is OnlineProtocolObserverCapabilityV1 {
  return typeof value === 'string' && CAPABILITY_PATTERN.test(value);
}

export function isOnlineProtocolCommandIdV1(
  value: unknown,
): value is OnlineProtocolCommandIdV1 {
  return isProtocolApplicationId(value);
}

export function isProtocolRevision(value: unknown): value is OnlineProtocolRevisionV1 {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function isProtocolDigest(value: unknown): value is string {
  return typeof value === 'string' && DIGEST_PATTERN.test(value);
}

export function containsConfiguredCapability(
  value: string,
  configuredCapabilities: readonly string[],
): boolean {
  return configuredCapabilities.some(
    (capability) => isProtocolCapability(capability) && value.includes(capability),
  );
}

function containsConfiguredCapabilityFragment(
  value: string,
  configuredCapabilities: readonly string[],
): boolean {
  return configuredCapabilities.some((capability) => {
    if (!isProtocolCapability(capability)) return false;
    for (
      let offset = 0;
      offset <= capability.length - MINIMUM_CAPABILITY_FRAGMENT_LENGTH;
      offset += 1
    ) {
      const fragment = capability.slice(offset, offset + MINIMUM_CAPABILITY_FRAGMENT_LENGTH);
      if (value.includes(fragment)) return true;
    }
    return false;
  });
}

export type SafeGraphInspectionResult = 'clear' | 'contains-configured-capability' | 'unreadable';

export function inspectGraphForConfiguredCapability(
  input: unknown,
  configuredCapabilities: readonly string[],
): SafeGraphInspectionResult {
  const ancestors = new WeakSet<object>();
  const inspect = (value: unknown): SafeGraphInspectionResult => {
    if (typeof value === 'string') {
      return containsConfiguredCapabilityFragment(value, configuredCapabilities)
        ? 'contains-configured-capability'
        : 'clear';
    }
    if (value === null || typeof value !== 'object') return 'clear';
    if (ancestors.has(value)) return 'unreadable';
    ancestors.add(value);
    try {
      let keys: readonly PropertyKey[];
      try {
        keys = Reflect.ownKeys(value);
      } catch {
        return 'unreadable';
      }
      for (const key of keys) {
        if (
          typeof key === 'string'
          && containsConfiguredCapabilityFragment(key, configuredCapabilities)
        ) {
          return 'contains-configured-capability';
        }
        let descriptor: PropertyDescriptor | undefined;
        try {
          descriptor = Object.getOwnPropertyDescriptor(value, key);
        } catch {
          return 'unreadable';
        }
        if (descriptor === undefined || !('value' in descriptor)) return 'unreadable';
        const result = inspect(descriptor.value);
        if (result !== 'clear') return result;
      }
      return 'clear';
    } finally {
      ancestors.delete(value);
    }
  };
  return inspect(input);
}

export function isDeeplyFrozenDescriptorSafe(input: unknown): boolean {
  const visited = new WeakSet<object>();
  const inspect = (value: unknown): boolean => {
    if (value === null || typeof value !== 'object') return true;
    if (visited.has(value)) return true;
    visited.add(value);
    let keys: readonly PropertyKey[];
    try {
      if (!Object.isFrozen(value)) return false;
      keys = Reflect.ownKeys(value);
    } catch {
      return false;
    }
    for (const key of keys) {
      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, key);
      } catch {
        return false;
      }
      if (descriptor === undefined || !('value' in descriptor) || !inspect(descriptor.value)) {
        return false;
      }
    }
    return true;
  };
  return inspect(input);
}

export function emptyFrozenArray<T>(): readonly T[] {
  return Object.freeze([] as T[]);
}

export function frozenTransition<State, Response>(
  state: State,
  response: Response,
): Readonly<{ readonly state: State; readonly response: Response }> {
  return Object.freeze({ state, response });
}
