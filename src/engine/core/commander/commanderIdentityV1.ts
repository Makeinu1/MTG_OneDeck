import { isCoreBaseId } from '../ids';
import type { CorePhysicalCardId, CorePlayerId } from '../ids';

export type CoreCommanderIdentityV1 = Readonly<{
  readonly physicalCardId: CorePhysicalCardId;
  readonly ownerPlayerId: CorePlayerId;
}>;

export type CoreCommanderIdentityValidationCodeV1 =
  | 'INVALID_ROOT'
  | 'MISSING_FIELD'
  | 'UNKNOWN_FIELD'
  | 'INVALID_DESCRIPTOR'
  | 'INVALID_TYPE'
  | 'INVALID_ID';

export type CoreCommanderIdentityValidationIssueV1 = Readonly<{
  readonly code: CoreCommanderIdentityValidationCodeV1;
  readonly path: string;
  readonly message: string;
}>;

export class CoreCommanderIdentityCreationErrorV1 extends Error {
  readonly issues: readonly CoreCommanderIdentityValidationIssueV1[];

  constructor(issues: readonly CoreCommanderIdentityValidationIssueV1[]) {
    super(`Invalid Core commander identity (${issues.length} issue(s))`);
    this.name = 'CoreCommanderIdentityCreationErrorV1';
    this.issues = Object.freeze(issues.map((current) => Object.freeze({ ...current })));
    Object.freeze(this);
  }
}

type RawRecord = Record<string, unknown>;

const EXPECTED_FIELDS = ['physicalCardId', 'ownerPlayerId'] as const;
type ExpectedField = (typeof EXPECTED_FIELDS)[number];

function codeUnitCompare(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function compareIssues(
  left: CoreCommanderIdentityValidationIssueV1,
  right: CoreCommanderIdentityValidationIssueV1,
): number {
  return codeUnitCompare(left.path, right.path) || codeUnitCompare(left.code, right.code);
}

function issue(
  code: CoreCommanderIdentityValidationCodeV1,
  path: string,
  message: string,
): CoreCommanderIdentityValidationIssueV1 {
  return Object.freeze({ code, path, message });
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

function fieldPath(field: string): string {
  return `/${field}`;
}

function expectedField(value: string): value is ExpectedField {
  return (EXPECTED_FIELDS as readonly string[]).includes(value);
}

export function createCoreCommanderIdentityV1(value: unknown): CoreCommanderIdentityV1 {
  if (!isPlainRecord(value)) {
    throw new CoreCommanderIdentityCreationErrorV1([
      issue('INVALID_ROOT', '', 'Expected a plain root object'),
    ]);
  }

  const issues: CoreCommanderIdentityValidationIssueV1[] = [];
  const readable: Partial<Record<ExpectedField, unknown>> = {};
  const present = new Set<ExpectedField>();
  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    throw new CoreCommanderIdentityCreationErrorV1([
      issue('INVALID_ROOT', '', 'Object keys are not readable'),
    ]);
  }

  for (const key of keys) {
    if (typeof key !== 'string' || !expectedField(key)) {
      issues.push(issue(
        'UNKNOWN_FIELD',
        typeof key === 'string' ? fieldPath(key) : '/<symbol>',
        'Exact keys must be { physicalCardId, ownerPlayerId }',
      ));
      continue;
    }

    present.add(key);

    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      issues.push(issue('INVALID_DESCRIPTOR', fieldPath(key), 'Field descriptor is not readable'));
      continue;
    }
    if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) {
      issues.push(issue('INVALID_DESCRIPTOR', fieldPath(key), 'Field must be an enumerable data property'));
      continue;
    }
    readable[key] = descriptor.value;
  }

  for (const key of EXPECTED_FIELDS) {
    if (!present.has(key)) {
      issues.push(issue('MISSING_FIELD', fieldPath(key), `Missing field: ${key}`));
    }
  }

  const physicalCardId = readable.physicalCardId;
  if (present.has('physicalCardId') && Object.prototype.hasOwnProperty.call(readable, 'physicalCardId')) {
    if (typeof physicalCardId !== 'string') {
      issues.push(issue('INVALID_TYPE', fieldPath('physicalCardId'), 'Expected a Core physical card ID string'));
    } else if (!isCoreBaseId(physicalCardId)) {
      issues.push(issue('INVALID_ID', fieldPath('physicalCardId'), 'Invalid Core physical card ID'));
    }
  }

  const ownerPlayerId = readable.ownerPlayerId;
  if (present.has('ownerPlayerId') && Object.prototype.hasOwnProperty.call(readable, 'ownerPlayerId')) {
    if (typeof ownerPlayerId !== 'string') {
      issues.push(issue('INVALID_TYPE', fieldPath('ownerPlayerId'), 'Expected a Core player ID string'));
    } else if (!isCoreBaseId(ownerPlayerId)) {
      issues.push(issue('INVALID_ID', fieldPath('ownerPlayerId'), 'Invalid Core player ID'));
    }
  }

  const sortedIssues = Object.freeze(issues.slice().sort(compareIssues));
  if (sortedIssues.length > 0) throw new CoreCommanderIdentityCreationErrorV1(sortedIssues);

  return Object.freeze({
    physicalCardId: physicalCardId as CorePhysicalCardId,
    ownerPlayerId: ownerPlayerId as CorePlayerId,
  });
}
