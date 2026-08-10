export type CoreStackChoiceKeyV1 = string;

export type CoreStackVariableAnnouncementV1 = Readonly<{
  variableKey: CoreStackChoiceKeyV1;
  value: number;
}>;

export type CoreStackAlternativeCostChoiceV1 = Readonly<{
  costKey: CoreStackChoiceKeyV1;
}>;

export type CoreStackAdditionalCostChoiceV1 = Readonly<{
  costKey: CoreStackChoiceKeyV1;
  times: number;
}>;

export type CoreStackCostChoiceSetV1 = Readonly<{
  alternativeCost: CoreStackAlternativeCostChoiceV1 | null;
  additionalCosts: readonly CoreStackAdditionalCostChoiceV1[];
}>;

export type CoreStackChoiceAnnouncementValidationCode =
  | 'INVALID_TYPE'
  | 'INVALID_STRING'
  | 'INVALID_INTEGER'
  | 'INVALID_ARRAY'
  | 'INVALID_ORDER'
  | 'DUPLICATE_VALUE'
  | 'MISSING_FIELD'
  | 'UNKNOWN_FIELD'
  | 'UNSAFE_RECORD_KEY'
  | 'INVALID_COST_CHOICE';

export type CoreStackChoiceAnnouncementValidationIssue = Readonly<{
  code: CoreStackChoiceAnnouncementValidationCode;
  path: string;
  message: string;
}>;

export type CoreStackChoiceAnnouncementValidationResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; issues: readonly CoreStackChoiceAnnouncementValidationIssue[] }>;

export class CoreStackChoiceAnnouncementCreationError extends Error {
  readonly issues: readonly CoreStackChoiceAnnouncementValidationIssue[];

  constructor(issues: readonly CoreStackChoiceAnnouncementValidationIssue[]) {
    super(`Invalid Core stack choice announcement primitive (${issues.length} issue(s))`);
    this.name = 'CoreStackChoiceAnnouncementCreationError';
    this.issues = issues;
  }
}

type RawRecord = Record<string, unknown>;
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function compareCodeUnits(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function pointer(parent: string, child: string): string {
  return `${parent}/${child.replaceAll('~', '~0').replaceAll('/', '~1')}`;
}

function makeIssue(
  code: CoreStackChoiceAnnouncementValidationCode,
  path: string,
  message: string,
): CoreStackChoiceAnnouncementValidationIssue {
  return Object.freeze({ code, path, message });
}

function sortIssues(
  issues: readonly CoreStackChoiceAnnouncementValidationIssue[],
): readonly CoreStackChoiceAnnouncementValidationIssue[] {
  return Object.freeze([...issues].sort((left, right) =>
    compareCodeUnits(left.path, right.path) || compareCodeUnits(left.code, right.code)));
}

function isPlainRecord(value: unknown): value is RawRecord {
  try {
    return value !== null && typeof value === 'object' && !Array.isArray(value) &&
      (Reflect.getPrototypeOf(value) === Object.prototype || Reflect.getPrototypeOf(value) === null);
  } catch {
    return false;
  }
}

function hasOwn(value: RawRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function readRecord(
  value: unknown,
  path: string,
  fields: readonly string[],
  issues: CoreStackChoiceAnnouncementValidationIssue[],
): RawRecord | null {
  if (!isPlainRecord(value)) {
    issues.push(makeIssue('INVALID_TYPE', path, 'Expected a plain object'));
    return null;
  }
  const result: RawRecord = Object.create(null) as RawRecord;
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    issues.push(makeIssue('INVALID_TYPE', path, 'Object descriptors are not readable'));
    return null;
  }
  for (const key of keys) {
    if (typeof key !== 'string') {
      issues.push(makeIssue('UNKNOWN_FIELD', pointer(path, String(key)), 'Symbol fields are not allowed'));
      continue;
    }
    const fieldPath = pointer(path, key);
    if (UNSAFE_KEYS.has(key)) {
      issues.push(makeIssue('UNSAFE_RECORD_KEY', fieldPath, `Unsafe record key: ${key}`));
      continue;
    }
    if (!fields.includes(key)) {
      issues.push(makeIssue('UNKNOWN_FIELD', fieldPath, `Unknown field: ${key}`));
      continue;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable) {
      issues.push(makeIssue('UNKNOWN_FIELD', fieldPath, 'Non-enumerable fields are not allowed'));
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      issues.push(makeIssue('INVALID_TYPE', fieldPath, 'Accessor properties are not allowed'));
      continue;
    }
    result[key] = descriptor.value;
  }
  for (const field of fields) {
    if (!hasOwn(result, field)) issues.push(makeIssue('MISSING_FIELD', pointer(path, field), `Missing field: ${field}`));
  }
  return result;
}

function readArray(
  value: unknown,
  path: string,
  issues: CoreStackChoiceAnnouncementValidationIssue[],
): readonly unknown[] | null {
  if (!Array.isArray(value)) {
    issues.push(makeIssue('INVALID_ARRAY', path, 'Expected an array'));
    return null;
  }
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    issues.push(makeIssue('INVALID_ARRAY', path, 'Array properties are not readable'));
    return null;
  }
  const expected = new Set<string>(['length']);
  for (let index = 0; index < value.length; index += 1) expected.add(String(index));
  const result: unknown[] = [];
  for (const key of keys) {
    if (typeof key !== 'string') {
      issues.push(makeIssue('INVALID_ARRAY', pointer(path, String(key)), 'Symbol array properties are not allowed'));
      continue;
    }
    if (!expected.has(key)) {
      issues.push(makeIssue('INVALID_ARRAY', pointer(path, key), 'Extra array properties are not allowed'));
      continue;
    }
    if (key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !descriptor.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
      issues.push(makeIssue('INVALID_ARRAY', pointer(path, key), 'Sparse, accessor, or non-enumerable entries are not allowed'));
      continue;
    }
    result[Number(key)] = descriptor.value;
  }
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, String(index))) {
      issues.push(makeIssue('INVALID_ARRAY', path, 'Array must be dense'));
      break;
    }
  }
  return result;
}

function validateKey(
  value: unknown,
  path: string,
  issues: CoreStackChoiceAnnouncementValidationIssue[],
): value is string {
  if (typeof value !== 'string') {
    issues.push(makeIssue('INVALID_TYPE', path, 'Expected a choice key string'));
    return false;
  }
  if (!KEY_PATTERN.test(value)) {
    issues.push(makeIssue('INVALID_STRING', path, 'Invalid choice key grammar'));
    return false;
  }
  if (UNSAFE_KEYS.has(value)) {
    issues.push(makeIssue('UNSAFE_RECORD_KEY', path, `Unsafe record key: ${value}`));
    return false;
  }
  return true;
}

function validateInteger(
  value: unknown,
  path: string,
  issues: CoreStackChoiceAnnouncementValidationIssue[],
  positive: boolean,
): value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || (positive ? value <= 0 : value < 0)) {
    issues.push(makeIssue('INVALID_INTEGER', path, positive ? 'Expected a positive safe integer' : 'Expected a nonnegative safe integer'));
    return false;
  }
  return true;
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor !== undefined && 'value' in descriptor) freezeDeep(descriptor.value);
    }
    Object.freeze(value);
  }
  return value;
}

function result<T>(issues: readonly CoreStackChoiceAnnouncementValidationIssue[], value: T): CoreStackChoiceAnnouncementValidationResult<T> {
  return issues.length > 0
    ? Object.freeze({ ok: false, issues: sortIssues(issues) })
    : Object.freeze({ ok: true, value: freezeDeep(value) });
}

function validateKeys(value: unknown): CoreStackChoiceAnnouncementValidationResult<readonly CoreStackChoiceKeyV1[]> {
  const issues: CoreStackChoiceAnnouncementValidationIssue[] = [];
  const input = readArray(value, '', issues);
  const output: string[] = [];
  input?.forEach((entry, index) => { if (validateKey(entry, pointer('', String(index)), issues)) output.push(entry); });
  return result(issues, Object.freeze(output));
}

function validateVariableArray(value: unknown): CoreStackChoiceAnnouncementValidationResult<readonly CoreStackVariableAnnouncementV1[]> {
  const issues: CoreStackChoiceAnnouncementValidationIssue[] = [];
  const input = readArray(value, '', issues);
  const output: CoreStackVariableAnnouncementV1[] = [];
  const keys: string[] = [];
  input?.forEach((entry, index) => {
    const path = pointer('', String(index));
    const row = readRecord(entry, path, ['variableKey', 'value'], issues);
    if (row === null) return;
    const key = row.variableKey;
    const valueNumber = row.value;
    const keyOk = validateKey(key, `${path}/variableKey`, issues);
    const valueOk = validateInteger(valueNumber, `${path}/value`, issues, false);
    if (keyOk) keys.push(key);
    if (keyOk && valueOk) output.push(Object.freeze({ variableKey: key, value: valueNumber }));
  });
  validateSortedUnique(keys, issues);
  return result(issues, Object.freeze(output));
}

function validateSortedUnique(keys: readonly string[], issues: CoreStackChoiceAnnouncementValidationIssue[]): void {
  const seen = new Set<string>();
  keys.forEach((key, index) => {
    if (seen.has(key)) issues.push(makeIssue('DUPLICATE_VALUE', pointer('', String(index)), 'Duplicate key'));
    seen.add(key);
    if (index > 0 && compareCodeUnits(keys[index - 1], key) >= 0) issues.push(makeIssue('INVALID_ORDER', pointer('', String(index)), 'Keys must be strictly code-unit ascending'));
  });
}

export function validateCoreStackChosenModeKeysV1(value: unknown): CoreStackChoiceAnnouncementValidationResult<readonly CoreStackChoiceKeyV1[]> {
  return validateKeys(value);
}

export function createCoreStackChosenModeKeysV1(value: unknown): readonly CoreStackChoiceKeyV1[] {
  const validation = validateCoreStackChosenModeKeysV1(value);
  if (!validation.ok) throw new CoreStackChoiceAnnouncementCreationError(validation.issues);
  return validation.value;
}

export function validateCoreStackVariableAnnouncementsV1(value: unknown): CoreStackChoiceAnnouncementValidationResult<readonly CoreStackVariableAnnouncementV1[]> {
  return validateVariableArray(value);
}

export function createCoreStackVariableAnnouncementsV1(value: unknown): readonly CoreStackVariableAnnouncementV1[] {
  const validation = validateCoreStackVariableAnnouncementsV1(value);
  if (!validation.ok) throw new CoreStackChoiceAnnouncementCreationError(validation.issues);
  return validation.value;
}

export function validateCoreStackVariableAnnouncementV1(value: unknown): CoreStackChoiceAnnouncementValidationResult<CoreStackVariableAnnouncementV1> {
  const validation = validateVariableArray([value]);
  if (!validation.ok) return validation;
  return Object.freeze({ ok: true, value: validation.value[0] });
}

export function createCoreStackVariableAnnouncementV1(value: unknown): CoreStackVariableAnnouncementV1 {
  const validation = validateCoreStackVariableAnnouncementV1(value);
  if (!validation.ok) throw new CoreStackChoiceAnnouncementCreationError(validation.issues);
  return validation.value;
}

export function validateCoreStackAlternativeCostChoiceV1(value: unknown): CoreStackChoiceAnnouncementValidationResult<CoreStackAlternativeCostChoiceV1> {
  const issues: CoreStackChoiceAnnouncementValidationIssue[] = [];
  const row = readRecord(value, '', ['costKey'], issues);
  const key = row?.costKey;
  if (row !== null) {
    if (validateKey(key, '/costKey', issues)) return result(issues, Object.freeze({ costKey: key }));
  }
  return result(issues, Object.freeze({ costKey: '' }));
}

export function createCoreStackAlternativeCostChoiceV1(value: unknown): CoreStackAlternativeCostChoiceV1 {
  const validation = validateCoreStackAlternativeCostChoiceV1(value);
  if (!validation.ok) throw new CoreStackChoiceAnnouncementCreationError(validation.issues);
  return validation.value;
}

export function validateCoreStackAdditionalCostChoiceV1(value: unknown): CoreStackChoiceAnnouncementValidationResult<CoreStackAdditionalCostChoiceV1> {
  const issues: CoreStackChoiceAnnouncementValidationIssue[] = [];
  const row = readRecord(value, '', ['costKey', 'times'], issues);
  const key = row?.costKey;
  const times = row?.times;
  const keyOk = row !== null && validateKey(key, '/costKey', issues);
  const timesOk = row !== null && validateInteger(times, '/times', issues, true);
  if (keyOk && timesOk) return result(issues, Object.freeze({ costKey: key, times }));
  issues.push(makeIssue('INVALID_COST_CHOICE', '', 'Invalid additional cost choice'));
  return result(issues, Object.freeze({ costKey: '', times: 0 }));
}

export function createCoreStackAdditionalCostChoiceV1(value: unknown): CoreStackAdditionalCostChoiceV1 {
  const validation = validateCoreStackAdditionalCostChoiceV1(value);
  if (!validation.ok) throw new CoreStackChoiceAnnouncementCreationError(validation.issues);
  return validation.value;
}

export function validateCoreStackCostChoiceSetV1(value: unknown): CoreStackChoiceAnnouncementValidationResult<CoreStackCostChoiceSetV1> {
  const issues: CoreStackChoiceAnnouncementValidationIssue[] = [];
  const row = readRecord(value, '', ['alternativeCost', 'additionalCosts'], issues);
  let alternativeCost: CoreStackAlternativeCostChoiceV1 | null = null;
  if (row?.alternativeCost !== null && row !== null) {
    const alternative = validateCoreStackAlternativeCostChoiceV1(row.alternativeCost);
    if (alternative.ok) alternativeCost = alternative.value;
    else issues.push(...alternative.issues);
  }
  const additional = validateVariableCostArray(row?.additionalCosts, issues);
  if (alternativeCost !== null && additional.value.some((item) => item.costKey === alternativeCost?.costKey)) {
    issues.push(makeIssue('DUPLICATE_VALUE', '/alternativeCost/costKey', 'Alternative and additional cost keys must be unique'));
  }
  return result(issues, Object.freeze({ alternativeCost, additionalCosts: additional.value }));
}

function validateVariableCostArray(value: unknown, issues: CoreStackChoiceAnnouncementValidationIssue[]): { readonly value: readonly CoreStackAdditionalCostChoiceV1[] } {
  const input = readArray(value, '/additionalCosts', issues);
  const output: CoreStackAdditionalCostChoiceV1[] = [];
  const keys: string[] = [];
  input?.forEach((entry, index) => {
    const item = validateCoreStackAdditionalCostChoiceV1(entry);
    if (item.ok) { output.push(item.value); keys.push(item.value.costKey); }
    else issues.push(...item.issues.map((found) => makeIssue(found.code, `/additionalCosts/${index}${found.path}`, found.message)));
  });
  validateSortedUnique(keys, issues);
  return { value: Object.freeze(output) };
}

export function createCoreStackCostChoiceSetV1(value: unknown): CoreStackCostChoiceSetV1 {
  const validation = validateCoreStackCostChoiceSetV1(value);
  if (!validation.ok) throw new CoreStackChoiceAnnouncementCreationError(validation.issues);
  return validation.value;
}
