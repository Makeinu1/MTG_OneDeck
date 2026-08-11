import {
  CoreCommanderIdentityCreationErrorV1,
  createCoreCommanderIdentityV1,
} from './commanderIdentityV1';
import type { CoreCommanderIdentityV1 } from './commanderIdentityV1';

export type CoreCommanderCastOriginV1 = 'command-zone' | 'other-zone' | 'copy';

export type CoreCommanderCastAttemptV1 = Readonly<{
  readonly origin: CoreCommanderCastOriginV1;
}>;

export type CoreCommanderCastLedgerV1 = Readonly<{
  readonly commander: CoreCommanderIdentityV1;
  readonly castCount: number;
}>;

export type CoreCommanderCastLedgerValidationIssueV1 = Readonly<{
  readonly code:
    | 'INVALID_ROOT'
    | 'MISSING_FIELD'
    | 'UNKNOWN_FIELD'
    | 'INVALID_DESCRIPTOR'
    | 'INVALID_TYPE'
    | 'INVALID_VALUE'
    | 'INVALID_IDENTITY'
    | 'INVALID_ORIGIN'
    | 'TAX_OVERFLOW';
  readonly path: string;
  readonly message: string;
}>;

const EXPECTED_LEDGER_FIELDS = ['commander', 'castCount'] as const;
const EXPECTED_ATTEMPT_FIELDS = ['origin'] as const;
const MAX_TAXABLE_CAST_COUNT = Math.floor(Number.MAX_SAFE_INTEGER / 2);

type RawRecord = Record<string, unknown>;

function issue(
  code: CoreCommanderCastLedgerValidationIssueV1['code'],
  path: string,
  message: string,
): CoreCommanderCastLedgerValidationIssueV1 {
  return Object.freeze({ code, path, message });
}

function codeUnitCompare(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function compareIssues(
  left: CoreCommanderCastLedgerValidationIssueV1,
  right: CoreCommanderCastLedgerValidationIssueV1,
): number {
  return codeUnitCompare(left.path, right.path) || codeUnitCompare(left.code, right.code);
}

function frozenIssues(
  issues: readonly CoreCommanderCastLedgerValidationIssueV1[],
): readonly CoreCommanderCastLedgerValidationIssueV1[] {
  return Object.freeze(issues.slice().sort(compareIssues).map((current) => Object.freeze({ ...current })));
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

function inspectRecord(
  value: RawRecord,
  expected: readonly string[],
  path: string,
  issues: CoreCommanderCastLedgerValidationIssueV1[],
): RawRecord {
  const readable: RawRecord = Object.create(null) as RawRecord;
  const present = new Set<string>();
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    issues.push(issue('INVALID_DESCRIPTOR', path, 'Object keys are not readable'));
    return readable;
  }
  for (const key of keys) {
    if (typeof key !== 'string' || !expected.includes(key)) {
      issues.push(issue(
        'UNKNOWN_FIELD',
        typeof key === 'string' ? `${path}/${key}` : `${path}/<symbol>`,
        `Exact keys must be { ${expected.join(', ')} }`,
      ));
      continue;
    }
    present.add(key);
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      issues.push(issue('INVALID_DESCRIPTOR', `${path}/${key}`, 'Field descriptor is not readable'));
      continue;
    }
    if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) {
      issues.push(issue('INVALID_DESCRIPTOR', `${path}/${key}`, 'Field must be an enumerable data property'));
      continue;
    }
    readable[key] = descriptor.value;
  }
  for (const key of expected) {
    if (!present.has(key)) {
      issues.push(issue('MISSING_FIELD', `${path}/${key}`, `Missing field: ${key}`));
    }
  }
  return readable;
}

export class CoreCommanderCastLedgerCreationErrorV1 extends Error {
  readonly issues: readonly CoreCommanderCastLedgerValidationIssueV1[];

  constructor(issues: readonly CoreCommanderCastLedgerValidationIssueV1[]) {
    super(`Invalid Core commander cast ledger (${issues.length} issue(s))`);
    this.name = 'CoreCommanderCastLedgerCreationErrorV1';
    this.issues = frozenIssues(issues);
    Object.freeze(this);
  }
}

export class CoreCommanderCastRecordingErrorV1 extends Error {
  readonly issues: readonly CoreCommanderCastLedgerValidationIssueV1[];

  constructor(issues: readonly CoreCommanderCastLedgerValidationIssueV1[]) {
    super(`Invalid Core commander cast attempt (${issues.length} issue(s))`);
    this.name = 'CoreCommanderCastRecordingErrorV1';
    this.issues = frozenIssues(issues);
    Object.freeze(this);
  }
}

function normalizeLedger(value: unknown): CoreCommanderCastLedgerV1 {
  if (!isPlainRecord(value)) {
    throw new CoreCommanderCastLedgerCreationErrorV1([
      issue('INVALID_ROOT', '', 'Expected a plain root object'),
    ]);
  }

  const issues: CoreCommanderCastLedgerValidationIssueV1[] = [];
  const readable = inspectRecord(value, EXPECTED_LEDGER_FIELDS, '', issues);
  const commanderValue = Object.prototype.hasOwnProperty.call(readable, 'commander')
    ? readable.commander
    : undefined;
  const castCountValue = Object.prototype.hasOwnProperty.call(readable, 'castCount')
    ? readable.castCount
    : undefined;

  let commander: CoreCommanderIdentityV1 | undefined;
  if (Object.prototype.hasOwnProperty.call(readable, 'commander')) {
    try {
      commander = createCoreCommanderIdentityV1(commanderValue);
    } catch (error) {
      if (error instanceof CoreCommanderIdentityCreationErrorV1) {
        for (const current of error.issues) {
          issues.push(issue(
            current.code === 'INVALID_ID' ? 'INVALID_IDENTITY' : current.code,
            `/commander${current.path}`,
            current.message,
          ));
        }
      } else {
        issues.push(issue('INVALID_IDENTITY', '/commander', 'Invalid commander identity'));
      }
    }
  }

  if (typeof castCountValue !== 'number') {
    if (Object.prototype.hasOwnProperty.call(readable, 'castCount')) {
      issues.push(issue('INVALID_TYPE', '/castCount', 'Expected a non-negative safe integer'));
    }
  } else if (!Number.isSafeInteger(castCountValue) || castCountValue < 0 || Object.is(castCountValue, -0)) {
    issues.push(issue('INVALID_VALUE', '/castCount', 'Expected a non-negative safe integer'));
  } else if (castCountValue > MAX_TAXABLE_CAST_COUNT) {
    issues.push(issue('TAX_OVERFLOW', '/castCount', 'Commander tax must remain a safe integer'));
  }

  if (issues.length > 0 || commander === undefined || typeof castCountValue !== 'number') {
    throw new CoreCommanderCastLedgerCreationErrorV1(issues);
  }

  return Object.freeze({ commander, castCount: castCountValue });
}

export function createCoreCommanderCastLedgerV1(value: unknown): CoreCommanderCastLedgerV1 {
  return normalizeLedger(value);
}

function readAttempt(value: unknown): CoreCommanderCastAttemptV1 {
  if (!isPlainRecord(value)) {
    throw new CoreCommanderCastRecordingErrorV1([
      issue('INVALID_ROOT', '', 'Expected a plain root object'),
    ]);
  }
  const issues: CoreCommanderCastLedgerValidationIssueV1[] = [];
  const readable = inspectRecord(value, EXPECTED_ATTEMPT_FIELDS, '', issues);
  const originValue = Object.prototype.hasOwnProperty.call(readable, 'origin')
    ? readable.origin
    : undefined;
  if (originValue !== 'command-zone' && originValue !== 'other-zone' && originValue !== 'copy') {
    issues.push(issue('INVALID_ORIGIN', '/origin', 'Invalid Commander cast origin'));
  }
  if (originValue === 'command-zone' || originValue === 'other-zone' || originValue === 'copy') {
    if (issues.length > 0) throw new CoreCommanderCastRecordingErrorV1(issues);
    return Object.freeze({ origin: originValue });
  }
  throw new CoreCommanderCastRecordingErrorV1(issues);
}

export function recordCoreCommanderCastV1(
  ledger: CoreCommanderCastLedgerV1,
  attempt: unknown,
): CoreCommanderCastLedgerV1 {
  const normalizedLedger = normalizeLedger(ledger);
  const normalizedAttempt = readAttempt(attempt);
  if (normalizedAttempt.origin !== 'command-zone') {
    throw new CoreCommanderCastRecordingErrorV1([
      issue('INVALID_ORIGIN', '/origin', 'Only command-zone Commander casts are recorded'),
    ]);
  }
  if (normalizedLedger.castCount >= MAX_TAXABLE_CAST_COUNT) {
    throw new CoreCommanderCastRecordingErrorV1([
      issue('TAX_OVERFLOW', '/castCount', 'Commander tax must remain a safe integer'),
    ]);
  }
  return Object.freeze({
    commander: normalizedLedger.commander,
    castCount: normalizedLedger.castCount + 1,
  });
}

export function coreCommanderTaxV1(ledger: CoreCommanderCastLedgerV1): number {
  const normalizedLedger = normalizeLedger(ledger);
  return normalizedLedger.castCount * 2;
}
