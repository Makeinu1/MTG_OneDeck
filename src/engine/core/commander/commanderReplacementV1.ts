export type CoreCommanderReplacementKindV1 = 'commander-replacement-903.9a' | 'commander-replacement-903.9b';

export type CoreCommanderReplacementSourceZoneV1 = 'graveyard' | 'exile' | 'hand' | 'library';

export type CoreCommanderReplacementChoiceV1 = Readonly<{
  readonly kind: CoreCommanderReplacementKindV1;
  readonly sourceZone: CoreCommanderReplacementSourceZoneV1;
}>;

export type CoreCommanderReplacementValidationCodeV1 =
  | 'INVALID_TYPE'
  | 'INVALID_KIND'
  | 'INVALID_SOURCE_ZONE'
  | 'INVALID_PAIR'
  | 'UNKNOWN_FIELD'
  | 'INVALID_DESCRIPTOR';

export type CoreCommanderReplacementValidationIssueV1 = Readonly<{
  readonly code: CoreCommanderReplacementValidationCodeV1;
  readonly path: string;
  readonly message: string;
}>;

export class CoreCommanderReplacementChoiceCreationErrorV1 extends Error {
  readonly issues: readonly CoreCommanderReplacementValidationIssueV1[];

  constructor(issues: readonly CoreCommanderReplacementValidationIssueV1[]) {
    super(`Invalid Core commander replacement choice (${issues.length} issue(s))`);
    this.name = 'CoreCommanderReplacementChoiceCreationErrorV1';
    this.issues = frozenIssues(issues);
    Object.freeze(this);
  }
}

type RawRecord = Record<string, unknown>;
const EXPECTED_KEYS = ['kind', 'sourceZone'] as const;
const VALID_KINDS: readonly CoreCommanderReplacementKindV1[] = [
  'commander-replacement-903.9a',
  'commander-replacement-903.9b',
];
const VALID_SOURCE_ZONES: readonly CoreCommanderReplacementSourceZoneV1[] = [
  'graveyard',
  'exile',
  'hand',
  'library',
];

function issue(
  code: CoreCommanderReplacementValidationCodeV1,
  path: string,
  message: string,
): CoreCommanderReplacementValidationIssueV1 {
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
  left: CoreCommanderReplacementValidationIssueV1,
  right: CoreCommanderReplacementValidationIssueV1,
): number {
  return codeUnitCompare(left.path, right.path) || codeUnitCompare(left.code, right.code);
}

function frozenIssues(
  issues: readonly CoreCommanderReplacementValidationIssueV1[],
): readonly CoreCommanderReplacementValidationIssueV1[] {
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

export function createCoreCommanderReplacementChoiceV1(
  value: unknown,
): CoreCommanderReplacementChoiceV1 {
  const issues: CoreCommanderReplacementValidationIssueV1[] = [];
  if (!isPlainRecord(value)) {
    throw new CoreCommanderReplacementChoiceCreationErrorV1([
      issue('INVALID_TYPE', '', 'Expected a plain object'),
    ]);
  }

  let keys: readonly PropertyKey[];
  try {
    keys = Reflect.ownKeys(value);
  } catch {
    throw new CoreCommanderReplacementChoiceCreationErrorV1([
      issue('INVALID_DESCRIPTOR', '', 'Object keys are not readable'),
    ]);
  }

  const readable: Partial<Record<(typeof EXPECTED_KEYS)[number], unknown>> = {};
  const present = new Set<(typeof EXPECTED_KEYS)[number]>();
  for (const key of keys) {
    if (typeof key !== 'string' || !EXPECTED_KEYS.includes(key as (typeof EXPECTED_KEYS)[number])) {
      issues.push(
        issue(
          'UNKNOWN_FIELD',
          typeof key === 'string' ? `/${key}` : '/<symbol>',
          'Exact keys must be { kind, sourceZone }',
        ),
      );
      continue;
    }
    const field = key as (typeof EXPECTED_KEYS)[number];
    present.add(field);
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, field);
    } catch {
      issues.push(issue('INVALID_DESCRIPTOR', `/${field}`, 'Field descriptor is not readable'));
      continue;
    }
    if (descriptor === undefined || !descriptor.enumerable || !('value' in descriptor)) {
      issues.push(issue('INVALID_DESCRIPTOR', `/${field}`, 'Field must be an enumerable data property'));
    } else {
      readable[field] = descriptor.value;
    }
  }

  if (!present.has('kind')) {
    issues.push(issue('UNKNOWN_FIELD', '/kind', 'Missing field: kind'));
  }
  if (!present.has('sourceZone')) {
    issues.push(issue('UNKNOWN_FIELD', '/sourceZone', 'Missing field: sourceZone'));
  }

  const kind = readable.kind;
  if (!VALID_KINDS.includes(kind as CoreCommanderReplacementKindV1)) {
    issues.push(issue('INVALID_KIND', '/kind', 'Expected 903.9a or 903.9b commander replacement kind'));
  }

  const sourceZone = readable.sourceZone;
  if (!VALID_SOURCE_ZONES.includes(sourceZone as CoreCommanderReplacementSourceZoneV1)) {
    issues.push(
      issue(
        'INVALID_SOURCE_ZONE',
        '/sourceZone',
        'Expected graveyard, exile, hand, or library source zone',
      ),
    );
  }

  const isAllowedPair =
    (kind === 'commander-replacement-903.9a' && (sourceZone === 'graveyard' || sourceZone === 'exile')) ||
    (kind === 'commander-replacement-903.9b' && (sourceZone === 'hand' || sourceZone === 'library'));
  if (
    isAllowedPair === false &&
    VALID_KINDS.includes(kind as CoreCommanderReplacementKindV1) &&
    VALID_SOURCE_ZONES.includes(sourceZone as CoreCommanderReplacementSourceZoneV1)
  ) {
    issues.push(
      issue('INVALID_PAIR', '', '903.9a requires graveyard or exile; 903.9b requires hand or library'),
    );
  }

  if (issues.length > 0) throw new CoreCommanderReplacementChoiceCreationErrorV1(frozenIssues(issues));
  return Object.freeze({
    kind: kind as CoreCommanderReplacementKindV1,
    sourceZone: sourceZone as CoreCommanderReplacementSourceZoneV1,
  });
}
