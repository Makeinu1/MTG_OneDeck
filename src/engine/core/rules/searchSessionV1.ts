import type { CoreObjectId, CorePlayerId } from '../ids';
import type { CoreRuleKeyV1 } from './ruleKeyV1';
import type { CoreRuleZoneRefV1 } from './ruleZoneRefV1';
import {
  deepFreezeCoreRuleValueV1,
  makeCoreRuleIssueV1,
  readCoreRuleExactRecordV1,
  sortCoreRuleIssuesV1,
  type CoreRuleValidationIssueV1,
  type CoreRuleValidationResultV1,
} from './ruleValidationSharedV1';
import { validateCoreRuleKeyV1 } from './ruleKeyV1';
import { validateCoreRuleZoneRefV1 } from './ruleZoneRefV1';
import { isCanonicalCoreObjectIdV2 } from '../object/objectIdV2';

export type CoreSearchPortionV1 =
  | Readonly<{ readonly kind: 'all' }>
  | Readonly<{ readonly kind: 'top'; readonly count: number }>;

export type CoreSearchCriteriaV1 =
  | Readonly<{ readonly kind: 'quantity'; readonly minimum: number; readonly maximum: number }>
  | Readonly<{
      readonly kind: 'qualified';
      readonly criteriaKey: CoreRuleKeyV1;
      readonly minimum: number;
      readonly maximum: number;
      readonly mayFailToFind: boolean;
    }>;

export type CoreSearchSessionV1 = Readonly<{
  readonly rulesActorPlayerId: CorePlayerId;
  readonly selectorPlayerId: CorePlayerId;
  readonly zone: CoreRuleZoneRefV1;
  readonly portion: CoreSearchPortionV1;
  readonly candidateObjectIds: readonly CoreObjectId[];
  readonly criteria: CoreSearchCriteriaV1;
  readonly revealFound: boolean;
  readonly shuffleAfter: boolean;
}>;

export type ModeNeutralCoreSearchSessionSliceV1 = Readonly<{
  readonly kind: 'mode-neutral-core-search-session-slice-v1';
  readonly sessionOrder: readonly CoreRuleKeyV1[];
  readonly bySession: Readonly<Record<CoreRuleKeyV1, CoreSearchSessionV1>>;
}>;

const KIND = 'mode-neutral-core-search-session-slice-v1' as const;
type Raw = Record<string, unknown>;
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function boolean(
  value: unknown,
  path: string,
  issues: CoreRuleValidationIssueV1[],
): value is boolean {
  if (typeof value !== 'boolean') {
    issues.push(makeCoreRuleIssueV1('INVALID_TYPE', path, 'Expected a boolean'));
    return false;
  }
  return true;
}

function player(
  value: unknown,
  path: string,
  issues: CoreRuleValidationIssueV1[],
): value is CorePlayerId {
  if (typeof value !== 'string' || !idPattern.test(value)) {
    issues.push(makeCoreRuleIssueV1('INVALID_ID', path, 'Invalid Core player ID'));
    return false;
  }
  return true;
}

function objectId(
  value: unknown,
  path: string,
  issues: CoreRuleValidationIssueV1[],
): value is CoreObjectId {
  if (!isCanonicalCoreObjectIdV2(value)) {
    issues.push(makeCoreRuleIssueV1('INVALID_ID', path, 'Invalid Core object ID'));
    return false;
  }
  return true;
}

function count(value: unknown, path: string, issues: CoreRuleValidationIssueV1[]): value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    issues.push(
      makeCoreRuleIssueV1('INVALID_INTEGER', path, 'Count must be a non-negative safe integer'),
    );
    return false;
  }
  return true;
}

function portion(value: unknown, path: string): CoreRuleValidationResultV1<CoreSearchPortionV1> {
  const read = readCoreRuleExactRecordV1(value, ['kind', 'count'], path, ['kind']);
  const issues = [...read.issues];
  if (!read.record) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  if (read.record.kind === 'all') {
    if (Object.keys(read.record).length !== 1)
      issues.push(makeCoreRuleIssueV1('UNKNOWN_FIELD', path, 'all portion has no count'));
    return issues.length
      ? { ok: false, issues: sortCoreRuleIssuesV1(issues) }
      : { ok: true, value: Object.freeze({ kind: 'all' }) };
  }
  if (read.record.kind !== 'top')
    issues.push(
      makeCoreRuleIssueV1('INVALID_LITERAL', `${path}/kind`, 'Invalid search portion kind'),
    );
  if (!count(read.record.count, `${path}/count`, issues) || read.record.count === 0)
    issues.push(
      makeCoreRuleIssueV1('INVALID_INTEGER', `${path}/count`, 'Top count must be positive'),
    );
  return issues.length
    ? { ok: false, issues: sortCoreRuleIssuesV1(issues) }
    : { ok: true, value: Object.freeze({ kind: 'top', count: read.record.count as number }) };
}

function criteria(value: unknown, path: string): CoreRuleValidationResultV1<CoreSearchCriteriaV1> {
  const read = readCoreRuleExactRecordV1(
    value,
    ['kind', 'criteriaKey', 'minimum', 'maximum', 'mayFailToFind'],
    path,
    ['kind'],
  );
  const issues = [...read.issues];
  if (!read.record) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  const minimum = count(read.record.minimum, `${path}/minimum`, issues);
  const maximum = count(read.record.maximum, `${path}/maximum`, issues);
  if (minimum && maximum && (read.record.maximum as number) < (read.record.minimum as number))
    issues.push(makeCoreRuleIssueV1('INVALID_ORDER', path, 'Maximum must be at least minimum'));
  if (read.record.kind === 'quantity') {
    if (Object.keys(read.record).some((key) => !['kind', 'minimum', 'maximum'].includes(key)))
      issues.push(
        makeCoreRuleIssueV1('UNKNOWN_FIELD', path, 'Quantity criteria has fields for another kind'),
      );
    return issues.length
      ? { ok: false, issues: sortCoreRuleIssuesV1(issues) }
      : {
          ok: true,
          value: Object.freeze({
            kind: 'quantity',
            minimum: read.record.minimum as number,
            maximum: read.record.maximum as number,
          }),
        };
  }
  if (read.record.kind !== 'qualified')
    issues.push(
      makeCoreRuleIssueV1('INVALID_LITERAL', `${path}/kind`, 'Invalid search criteria kind'),
    );
  const criteriaKey =
    typeof read.record.criteriaKey === 'string' && idPattern.test(read.record.criteriaKey)
      ? read.record.criteriaKey
      : null;
  if (criteriaKey === null)
    issues.push(
      makeCoreRuleIssueV1('INVALID_STRING', `${path}/criteriaKey`, 'Invalid opaque criteria key'),
    );
  if (!boolean(read.record.mayFailToFind, `${path}/mayFailToFind`, issues))
    return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  if (criteriaKey === null) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  return issues.length
    ? { ok: false, issues: sortCoreRuleIssuesV1(issues) }
    : {
        ok: true,
        value: Object.freeze({
          kind: 'qualified',
          criteriaKey,
          minimum: read.record.minimum as number,
          maximum: read.record.maximum as number,
          mayFailToFind: read.record.mayFailToFind,
        }),
      };
}

function session(value: unknown, path: string): CoreRuleValidationResultV1<CoreSearchSessionV1> {
  const read = readCoreRuleExactRecordV1(
    value,
    [
      'rulesActorPlayerId',
      'selectorPlayerId',
      'zone',
      'portion',
      'candidateObjectIds',
      'criteria',
      'revealFound',
      'shuffleAfter',
    ],
    path,
  );
  const issues = [...read.issues];
  if (!read.record) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  player(read.record.rulesActorPlayerId, `${path}/rulesActorPlayerId`, issues);
  player(read.record.selectorPlayerId, `${path}/selectorPlayerId`, issues);
  const zone = validateCoreRuleZoneRefV1(read.record.zone, `${path}/zone`);
  if (!zone.ok) issues.push(...zone.issues);
  const checkedPortion = portion(read.record.portion, `${path}/portion`);
  if (!checkedPortion.ok) issues.push(...checkedPortion.issues);
  if (!Array.isArray(read.record.candidateObjectIds))
    issues.push(
      makeCoreRuleIssueV1(
        'INVALID_ARRAY',
        `${path}/candidateObjectIds`,
        'Candidates must be an array',
      ),
    );
  const candidates: CoreObjectId[] = [];
  if (Array.isArray(read.record.candidateObjectIds))
    for (const [index, value] of (read.record.candidateObjectIds as readonly unknown[]).entries()) {
      if (objectId(value, `${path}/candidateObjectIds/${index}`, issues)) {
        if (candidates.includes(value))
          issues.push(
            makeCoreRuleIssueV1(
              'DUPLICATE_VALUE',
              `${path}/candidateObjectIds/${index}`,
              'Candidate IDs must be unique',
            ),
          );
        else candidates.push(value);
      }
    }
  const checkedCriteria = criteria(read.record.criteria, `${path}/criteria`);
  if (!checkedCriteria.ok) issues.push(...checkedCriteria.issues);
  boolean(read.record.revealFound, `${path}/revealFound`, issues);
  boolean(read.record.shuffleAfter, `${path}/shuffleAfter`, issues);
  if (!zone.ok || !checkedPortion.ok || !checkedCriteria.ok || issues.length) {
    return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  }
  return {
    ok: true,
    value: Object.freeze({
      rulesActorPlayerId: read.record.rulesActorPlayerId as CorePlayerId,
      selectorPlayerId: read.record.selectorPlayerId as CorePlayerId,
      zone: zone.value,
      portion: checkedPortion.value,
      candidateObjectIds: Object.freeze(candidates),
      criteria: checkedCriteria.value,
      revealFound: read.record.revealFound as boolean,
      shuffleAfter: read.record.shuffleAfter as boolean,
    }),
  };
}

export function validateModeNeutralCoreSearchSessionSliceV1(
  input: unknown,
): CoreRuleValidationResultV1<ModeNeutralCoreSearchSessionSliceV1> {
  const read = readCoreRuleExactRecordV1(input, ['kind', 'sessionOrder', 'bySession']);
  const issues = [...read.issues];
  if (!read.record) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  if (read.record.kind !== KIND)
    issues.push(
      makeCoreRuleIssueV1('INVALID_LITERAL', '/kind', 'Invalid search session slice kind'),
    );
  if (!Array.isArray(read.record.sessionOrder))
    issues.push(
      makeCoreRuleIssueV1('INVALID_ARRAY', '/sessionOrder', 'sessionOrder must be an array'),
    );
  const order: string[] = [];
  const seen = new Set<string>();
  if (Array.isArray(read.record.sessionOrder))
    for (const [index, value] of (read.record.sessionOrder as readonly unknown[]).entries()) {
      const checked = validateCoreRuleKeyV1(value, `/sessionOrder/${index}`);
      if (checked.ok) {
        if (seen.has(checked.value))
          issues.push(
            makeCoreRuleIssueV1(
              'DUPLICATE_VALUE',
              `/sessionOrder/${index}`,
              'Duplicate session key',
            ),
          );
        else {
          seen.add(checked.value);
          order.push(checked.value);
        }
      } else issues.push(...checked.issues);
    }
  if (
    read.record.bySession === null ||
    typeof read.record.bySession !== 'object' ||
    Array.isArray(read.record.bySession)
  )
    issues.push(makeCoreRuleIssueV1('INVALID_TYPE', '/bySession', 'bySession must be a record'));
  const checked: Record<string, CoreSearchSessionV1> = Object.create(null) as Record<
    string,
    CoreSearchSessionV1
  >;
  if (
    read.record.bySession &&
    typeof read.record.bySession === 'object' &&
    !Array.isArray(read.record.bySession)
  ) {
    for (const key of Reflect.ownKeys(read.record.bySession)) {
      if (typeof key !== 'string') {
        issues.push(
          makeCoreRuleIssueV1(
            'UNKNOWN_FIELD',
            '/bySession/[symbol]',
            'Symbol fields are not allowed',
          ),
        );
        continue;
      }
      const validKey = validateCoreRuleKeyV1(key, `/bySession/${key}`);
      if (!validKey.ok) issues.push(...validKey.issues);
      const checkedSession = session((read.record.bySession as Raw)[key], `/bySession/${key}`);
      if (checkedSession.ok) checked[key] = checkedSession.value;
      else issues.push(...checkedSession.issues);
    }
    for (const key of order)
      if (!Object.prototype.hasOwnProperty.call(read.record.bySession, key))
        issues.push(
          makeCoreRuleIssueV1(
            'SESSION_SET_MISMATCH',
            '/sessionOrder',
            `Missing bySession entry: ${key}`,
          ),
        );
    for (const key of Object.keys(read.record.bySession))
      if (!seen.has(key))
        issues.push(
          makeCoreRuleIssueV1(
            'SESSION_SET_MISMATCH',
            '/bySession',
            `Unordered session entry: ${key}`,
          ),
        );
  }
  if (issues.length) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  const by: Record<string, CoreSearchSessionV1> = Object.create(null) as Record<
    string,
    CoreSearchSessionV1
  >;
  for (const key of order) by[key] = checked[key];
  return {
    ok: true,
    value: deepFreezeCoreRuleValueV1({
      kind: KIND,
      sessionOrder: Object.freeze(order),
      bySession: by,
    }),
  };
}

export class CoreSearchSessionCreationError extends Error {
  readonly issues: readonly CoreRuleValidationIssueV1[];
  constructor(issues: readonly CoreRuleValidationIssueV1[]) {
    super(`Invalid Core search session slice (${issues.length} issue(s))`);
    this.name = 'CoreSearchSessionCreationError';
    this.issues = issues;
  }
}

export function createModeNeutralCoreSearchSessionSliceV1(
  input: Omit<ModeNeutralCoreSearchSessionSliceV1, 'kind'>,
): ModeNeutralCoreSearchSessionSliceV1 {
  const result = validateModeNeutralCoreSearchSessionSliceV1({ ...input, kind: KIND });
  if (!result.ok) throw new CoreSearchSessionCreationError(result.issues);
  return result.value;
}
