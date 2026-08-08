export interface RulesetReference {
  readonly rulesetId: string;
  readonly effectiveAsOf: string;
  readonly sha256: string;
}

export interface ContractVersionVector {
  readonly contractSchemaVersion: number;
  readonly ruleset: RulesetReference;
  readonly engineSemanticsVersion: number;
  readonly stateSchemaVersion: number;
  readonly eventSchemaVersion: number;
  readonly protocolVersion: number;
  readonly projectionSchemaVersion: number;
}

export type BuildId = string;

export type VersionValidationCode =
  | 'INVALID_ROOT'
  | 'MISSING_FIELD'
  | 'UNKNOWN_FIELD'
  | 'UNSUPPORTED_CONTRACT_SCHEMA_VERSION'
  | 'INVALID_RULESET_ID'
  | 'INVALID_EFFECTIVE_DATE'
  | 'RULESET_DATE_MISMATCH'
  | 'INVALID_SHA256'
  | 'INVALID_VERSION_INTEGER'
  | 'INVALID_BUILD_ID';

export interface VersionValidationIssue {
  readonly code: VersionValidationCode;
  readonly path: string;
  readonly message: string;
}

export type VersionValidationResult<T = ContractVersionVector> =
  | {
      readonly ok: true;
      readonly value: T;
      readonly issues: readonly [];
    }
  | {
      readonly ok: false;
      readonly issues: readonly VersionValidationIssue[];
    };

export type VersionMismatchCode =
  | 'CONTRACT_SCHEMA_VERSION_MISMATCH'
  | 'RULESET_ID_MISMATCH'
  | 'RULESET_EFFECTIVE_DATE_MISMATCH'
  | 'RULESET_HASH_MISMATCH'
  | 'ENGINE_SEMANTICS_VERSION_MISMATCH'
  | 'STATE_SCHEMA_VERSION_MISMATCH'
  | 'EVENT_SCHEMA_VERSION_MISMATCH'
  | 'PROTOCOL_VERSION_MISMATCH'
  | 'PROJECTION_SCHEMA_VERSION_MISMATCH';

export interface VersionMismatch {
  readonly code: VersionMismatchCode;
  readonly expected: number | string;
  readonly actual: number | string;
}

const SUPPORTED_CONTRACT_SCHEMA_VERSION = 1;
const RULESET_ID_PATTERN = /^mtg-cr-(\d{4}-\d{2}-\d{2})$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const BUILD_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const ROOT_FIELDS = [
  'contractSchemaVersion',
  'ruleset',
  'engineSemanticsVersion',
  'stateSchemaVersion',
  'eventSchemaVersion',
  'protocolVersion',
  'projectionSchemaVersion',
] as const;
const RULESET_FIELDS = ['rulesetId', 'effectiveAsOf', 'sha256'] as const;
const NUMERIC_FIELDS = [
  'contractSchemaVersion',
  'engineSemanticsVersion',
  'stateSchemaVersion',
  'eventSchemaVersion',
  'protocolVersion',
  'projectionSchemaVersion',
] as const;
const NO_ISSUES: readonly VersionValidationIssue[] = Object.freeze([]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function deepFreeze<T>(value: T): T {
  if (isObjectLike(value) && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      if (isObjectLike(child)) deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

function isValidVersionNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}

function matchesEntireString(pattern: RegExp, value: string): boolean {
  const match = pattern.exec(value);
  return match !== null && match[0] === value;
}

function isValidCalendarDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match || match[0] !== value) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
  );
}

function issue(
  code: VersionValidationCode,
  path: string,
  message: string,
): VersionValidationIssue {
  return { code, path, message };
}

function addMissingOrInvalidVersionIssue(
  value: Record<string, unknown>,
  field: string,
  issues: VersionValidationIssue[],
): void {
  if (!Object.hasOwn(value, field)) {
    issues.push(issue('MISSING_FIELD', field, `${field} is required`));
  } else if (!isValidVersionNumber(value[field])) {
    issues.push(issue(
      'INVALID_VERSION_INTEGER',
      field,
      `${field} must be a safe integer greater than or equal to 1`,
    ));
  }
}

function addUnknownFieldIssues(
  value: Record<string, unknown>,
  knownFields: readonly string[],
  prefix: string,
  issues: VersionValidationIssue[],
): void {
  const known = new Set(knownFields);
  for (const field of Object.keys(value).filter((key) => !known.has(key)).sort()) {
    const path = prefix ? `${prefix}.${field}` : field;
    issues.push(issue('UNKNOWN_FIELD', path, `${path} is not part of the contract`));
  }
}

function success<T>(value: T): VersionValidationResult<T> {
  return { ok: true, value, issues: NO_ISSUES as readonly [] };
}

function failure(issues: VersionValidationIssue[]): VersionValidationResult {
  return { ok: false, issues: Object.freeze([...issues]) };
}

export const CURRENT_CONTRACT_VERSIONS: ContractVersionVector = deepFreeze({
  contractSchemaVersion: 1,
  ruleset: {
    rulesetId: 'mtg-cr-2026-06-19',
    effectiveAsOf: '2026-06-19',
    sha256: 'e99cd70eb64ca854acb6420ebbf06e369e3f258e0cfba4f03f70bd881386f79b',
  },
  engineSemanticsVersion: 1,
  stateSchemaVersion: 1,
  eventSchemaVersion: 1,
  protocolVersion: 1,
  projectionSchemaVersion: 1,
});

export function validateContractVersionVector(
  input: unknown,
): VersionValidationResult {
  if (!isPlainObject(input)) {
    return failure([issue('INVALID_ROOT', 'root', 'contract version vector must be a plain object')]);
  }

  const issues: VersionValidationIssue[] = [];
  addMissingOrInvalidVersionIssue(input, 'contractSchemaVersion', issues);
  if (
    isValidVersionNumber(input.contractSchemaVersion)
    && input.contractSchemaVersion !== SUPPORTED_CONTRACT_SCHEMA_VERSION
  ) {
    issues.push(issue(
      'UNSUPPORTED_CONTRACT_SCHEMA_VERSION',
      'contractSchemaVersion',
      `contract schema version ${input.contractSchemaVersion} is not supported`,
    ));
  }

  const rulesetValue = input.ruleset;
  if (!Object.hasOwn(input, 'ruleset')) {
    issues.push(issue('MISSING_FIELD', 'ruleset', 'ruleset is required'));
  } else if (!isPlainObject(rulesetValue)) {
    issues.push(issue('INVALID_ROOT', 'ruleset', 'ruleset must be a plain object'));
  } else {
    const ruleset = rulesetValue;
    const rulesetId = ruleset.rulesetId;
    const effectiveAsOf = ruleset.effectiveAsOf;
    const rulesetIdMatch = typeof rulesetId === 'string'
      ? RULESET_ID_PATTERN.exec(rulesetId)
      : null;

    if (!Object.hasOwn(ruleset, 'rulesetId')) {
      issues.push(issue('MISSING_FIELD', 'ruleset.rulesetId', 'rulesetId is required'));
    } else if (
      typeof rulesetId !== 'string'
      || !rulesetIdMatch
      || rulesetIdMatch[0] !== rulesetId
      || !isValidCalendarDate(rulesetIdMatch[1])
    ) {
      issues.push(issue(
        'INVALID_RULESET_ID',
        'ruleset.rulesetId',
        'rulesetId must match mtg-cr-YYYY-MM-DD and contain a real calendar date',
      ));
    }

    if (!Object.hasOwn(ruleset, 'effectiveAsOf')) {
      issues.push(issue(
        'MISSING_FIELD',
        'ruleset.effectiveAsOf',
        'effectiveAsOf is required',
      ));
    } else if (typeof effectiveAsOf !== 'string' || !isValidCalendarDate(effectiveAsOf)) {
      issues.push(issue(
        'INVALID_EFFECTIVE_DATE',
        'ruleset.effectiveAsOf',
        'effectiveAsOf must be a real YYYY-MM-DD calendar date',
      ));
    }

    if (
      rulesetIdMatch
      && isValidCalendarDate(rulesetIdMatch[1])
      && typeof effectiveAsOf === 'string'
      && isValidCalendarDate(effectiveAsOf)
      && rulesetIdMatch[1] !== effectiveAsOf
    ) {
      issues.push(issue(
        'RULESET_DATE_MISMATCH',
        'ruleset.effectiveAsOf',
        'rulesetId date must match effectiveAsOf',
      ));
    }

    if (!Object.hasOwn(ruleset, 'sha256')) {
      issues.push(issue('MISSING_FIELD', 'ruleset.sha256', 'sha256 is required'));
    } else if (
      typeof ruleset.sha256 !== 'string'
      || !matchesEntireString(SHA256_PATTERN, ruleset.sha256)
    ) {
      issues.push(issue(
        'INVALID_SHA256',
        'ruleset.sha256',
        'sha256 must be 64 lowercase hexadecimal characters',
      ));
    }
  }

  for (const field of NUMERIC_FIELDS.slice(1)) {
    addMissingOrInvalidVersionIssue(input, field, issues);
  }

  addUnknownFieldIssues(input, ROOT_FIELDS, '', issues);
  if (isPlainObject(rulesetValue)) {
    addUnknownFieldIssues(rulesetValue, RULESET_FIELDS, 'ruleset', issues);
  }

  if (issues.length > 0) return failure(issues);

  const ruleset = input.ruleset as Record<string, string>;
  const validated: ContractVersionVector = {
    contractSchemaVersion: input.contractSchemaVersion as number,
    ruleset: {
      rulesetId: ruleset.rulesetId,
      effectiveAsOf: ruleset.effectiveAsOf,
      sha256: ruleset.sha256,
    },
    engineSemanticsVersion: input.engineSemanticsVersion as number,
    stateSchemaVersion: input.stateSchemaVersion as number,
    eventSchemaVersion: input.eventSchemaVersion as number,
    protocolVersion: input.protocolVersion as number,
    projectionSchemaVersion: input.projectionSchemaVersion as number,
  };
  return success(deepFreeze(validated));
}

export function validateBuildId(input: unknown): VersionValidationResult<BuildId> {
  if (typeof input !== 'string' || !matchesEntireString(BUILD_ID_PATTERN, input)) {
    return failure([issue(
      'INVALID_BUILD_ID',
      'buildId',
      'BuildId must be 1-64 ASCII letters, digits, periods, underscores, or hyphens',
    )]) as VersionValidationResult<BuildId>;
  }
  return success(input);
}

export function diffContractVersionVectors(
  expected: ContractVersionVector,
  actual: ContractVersionVector,
): VersionMismatch[] {
  const mismatches: VersionMismatch[] = [];
  const compare = <T extends number | string>(
    code: VersionMismatchCode,
    expectedValue: T,
    actualValue: T,
  ): void => {
    if (expectedValue !== actualValue) {
      mismatches.push({ code, expected: expectedValue, actual: actualValue });
    }
  };

  compare(
    'CONTRACT_SCHEMA_VERSION_MISMATCH',
    expected.contractSchemaVersion,
    actual.contractSchemaVersion,
  );
  compare('RULESET_ID_MISMATCH', expected.ruleset.rulesetId, actual.ruleset.rulesetId);
  compare(
    'RULESET_EFFECTIVE_DATE_MISMATCH',
    expected.ruleset.effectiveAsOf,
    actual.ruleset.effectiveAsOf,
  );
  compare('RULESET_HASH_MISMATCH', expected.ruleset.sha256, actual.ruleset.sha256);
  compare(
    'ENGINE_SEMANTICS_VERSION_MISMATCH',
    expected.engineSemanticsVersion,
    actual.engineSemanticsVersion,
  );
  compare(
    'STATE_SCHEMA_VERSION_MISMATCH',
    expected.stateSchemaVersion,
    actual.stateSchemaVersion,
  );
  compare(
    'EVENT_SCHEMA_VERSION_MISMATCH',
    expected.eventSchemaVersion,
    actual.eventSchemaVersion,
  );
  compare('PROTOCOL_VERSION_MISMATCH', expected.protocolVersion, actual.protocolVersion);
  compare(
    'PROJECTION_SCHEMA_VERSION_MISMATCH',
    expected.projectionSchemaVersion,
    actual.projectionSchemaVersion,
  );
  return mismatches;
}
