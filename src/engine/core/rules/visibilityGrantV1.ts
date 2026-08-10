import type { CoreObjectId, CorePlayerId } from '../ids';
import { isCoreBaseId } from '../ids';
import { isCanonicalCoreObjectIdV2 } from '../object/objectIdV2';
import type { CoreRuleKeyV1 } from './ruleKeyV1';
import { validateCoreRuleKeyV1 } from './ruleKeyV1';
import type { CoreRuleZoneRefV1 } from './ruleZoneRefV1';
import { validateCoreRuleZoneRefV1 } from './ruleZoneRefV1';
import type { CoreRuleDurationV1 } from './ruleDurationV1';
import { validateCoreRuleDurationV1 } from './ruleDurationV1';
import {
  deepFreezeCoreRuleValueV1,
  makeCoreRuleIssueV1,
  readCoreRuleExactRecordV1,
  sortCoreRuleIssuesV1,
  type CoreRuleValidationIssueV1,
  type CoreRuleValidationResultV1,
} from './ruleValidationSharedV1';

export type CoreVisibilitySubjectV1 =
  | Readonly<{ readonly kind: 'object'; readonly objectId: CoreObjectId }>
  | Readonly<{ readonly kind: 'zone'; readonly zone: CoreRuleZoneRefV1 }>
  | Readonly<{
      readonly kind: 'top-of-library';
      readonly playerId: CorePlayerId;
      readonly count: number;
    }>;

export type CoreVisibilityAudienceV1 =
  | Readonly<{ readonly kind: 'all-players' }>
  | Readonly<{ readonly kind: 'players'; readonly playerIds: readonly CorePlayerId[] }>;
export type CoreVisibilityModeV1 = 'look' | 'reveal';
export type CoreVisibilityGrantV1 = Readonly<{
  readonly subject: CoreVisibilitySubjectV1;
  readonly audience: CoreVisibilityAudienceV1;
  readonly mode: CoreVisibilityModeV1;
  readonly sourceObjectId: CoreObjectId | null;
  readonly duration: CoreRuleDurationV1;
}>;
export type ModeNeutralCoreVisibilitySliceV1 = Readonly<{
  readonly kind: 'mode-neutral-core-visibility-slice-v1';
  readonly grantOrder: readonly CoreRuleKeyV1[];
  readonly byGrant: Readonly<Record<CoreRuleKeyV1, CoreVisibilityGrantV1>>;
}>;

const KIND = 'mode-neutral-core-visibility-slice-v1' as const;
type Raw = Record<string, unknown>;
const player = (v: unknown, p: string, i: CoreRuleValidationIssueV1[]): v is CorePlayerId => {
  if (!isCoreBaseId(v)) i.push(makeCoreRuleIssueV1('INVALID_ID', p, 'Invalid Core player ID'));
  return isCoreBaseId(v);
};
const object = (v: unknown, p: string, i: CoreRuleValidationIssueV1[]): v is CoreObjectId => {
  if (!isCanonicalCoreObjectIdV2(v))
    i.push(makeCoreRuleIssueV1('INVALID_ID', p, 'Invalid Core object ID'));
  return isCanonicalCoreObjectIdV2(v);
};

function audience(
  value: unknown,
  path: string,
): CoreRuleValidationResultV1<CoreVisibilityAudienceV1> {
  const read = readCoreRuleExactRecordV1(value, ['kind', 'playerIds'], path, ['kind']);
  const issues = [...read.issues];
  if (!read.record) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  if (read.record.kind === 'all-players') {
    if (Object.keys(read.record).length !== 1)
      issues.push(makeCoreRuleIssueV1('UNKNOWN_FIELD', path, 'all-players has no playerIds'));
    return issues.length
      ? { ok: false, issues: sortCoreRuleIssuesV1(issues) }
      : { ok: true, value: Object.freeze({ kind: 'all-players' }) };
  }
  if (read.record.kind !== 'players' || !Array.isArray(read.record.playerIds)) {
    issues.push(
      makeCoreRuleIssueV1(
        read.record.kind === 'players' ? 'INVALID_ARRAY' : 'INVALID_LITERAL',
        `${path}/kind`,
        'Invalid visibility audience',
      ),
    );
    return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  }
  const ids: string[] = [];
  for (let n = 0; n < read.record.playerIds.length; n += 1) {
    const valueAt = read.record.playerIds[n];
    if (player(valueAt, `${path}/playerIds/${n}`, issues)) {
      if (ids.includes(valueAt))
        issues.push(
          makeCoreRuleIssueV1(
            'DUPLICATE_VALUE',
            `${path}/playerIds/${n}`,
            'Audience player IDs must be unique',
          ),
        );
      else ids.push(valueAt);
    }
  }
  ids.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return issues.length
    ? { ok: false, issues: sortCoreRuleIssuesV1(issues) }
    : {
        ok: true,
        value: Object.freeze({
          kind: 'players',
          playerIds: Object.freeze(ids) as readonly CorePlayerId[],
        }),
      };
}

function subject(
  value: unknown,
  path: string,
): CoreRuleValidationResultV1<CoreVisibilitySubjectV1> {
  const read = readCoreRuleExactRecordV1(
    value,
    ['kind', 'objectId', 'zone', 'playerId', 'count'],
    path,
    ['kind'],
  );
  const issues = [...read.issues];
  if (!read.record) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  if (read.record.kind === 'object') {
    object(read.record.objectId, `${path}/objectId`, issues);
    if (issues.length === 0)
      return {
        ok: true,
        value: Object.freeze({ kind: 'object', objectId: read.record.objectId as CoreObjectId }),
      };
  } else if (read.record.kind === 'zone') {
    const checked = validateCoreRuleZoneRefV1(read.record.zone, `${path}/zone`);
    if (!checked.ok) issues.push(...checked.issues);
    else if (issues.length === 0)
      return { ok: true, value: Object.freeze({ kind: 'zone', zone: checked.value }) };
  } else if (read.record.kind === 'top-of-library') {
    player(read.record.playerId, `${path}/playerId`, issues);
    if (
      typeof read.record.count !== 'number' ||
      !Number.isSafeInteger(read.record.count) ||
      read.record.count <= 0
    )
      issues.push(
        makeCoreRuleIssueV1(
          'INVALID_INTEGER',
          `${path}/count`,
          'Top count must be a positive safe integer',
        ),
      );
    if (issues.length === 0)
      return {
        ok: true,
        value: Object.freeze({
          kind: 'top-of-library',
          playerId: read.record.playerId as CorePlayerId,
          count: read.record.count as number,
        }),
      };
  } else
    issues.push(
      makeCoreRuleIssueV1('INVALID_LITERAL', `${path}/kind`, 'Invalid visibility subject kind'),
    );
  return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
}

function grant(value: unknown, path: string): CoreRuleValidationResultV1<CoreVisibilityGrantV1> {
  const read = readCoreRuleExactRecordV1(
    value,
    ['subject', 'audience', 'mode', 'sourceObjectId', 'duration'],
    path,
  );
  const issues = [...read.issues];
  if (!read.record) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  const checkedSubject = subject(read.record.subject, `${path}/subject`);
  const checkedAudience = audience(read.record.audience, `${path}/audience`);
  const checkedDuration = validateCoreRuleDurationV1(read.record.duration, `${path}/duration`);
  if (!checkedSubject.ok) issues.push(...checkedSubject.issues);
  if (!checkedAudience.ok) issues.push(...checkedAudience.issues);
  if (!checkedDuration.ok) issues.push(...checkedDuration.issues);
  if (read.record.mode !== 'look' && read.record.mode !== 'reveal')
    issues.push(makeCoreRuleIssueV1('INVALID_LITERAL', `${path}/mode`, 'Invalid visibility mode'));
  if (read.record.sourceObjectId !== null && !isCanonicalCoreObjectIdV2(read.record.sourceObjectId))
    issues.push(
      makeCoreRuleIssueV1('INVALID_ID', `${path}/sourceObjectId`, 'Invalid source object ID'),
    );
  if (
    read.record.mode === 'reveal' &&
    checkedAudience.ok &&
    checkedAudience.value.kind !== 'all-players'
  )
    issues.push(
      makeCoreRuleIssueV1(
        'INVALID_LITERAL',
        `${path}/audience/kind`,
        'Reveal requires all players',
      ),
    );
  if (issues.length || !checkedSubject.ok || !checkedAudience.ok || !checkedDuration.ok)
    return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  return {
    ok: true,
    value: Object.freeze({
      subject: checkedSubject.value,
      audience: checkedAudience.value,
      mode: read.record.mode as CoreVisibilityModeV1,
      sourceObjectId: read.record.sourceObjectId as CoreObjectId | null,
      duration: checkedDuration.value,
    }),
  };
}

export function validateModeNeutralCoreVisibilitySliceV1(
  input: unknown,
): CoreRuleValidationResultV1<ModeNeutralCoreVisibilitySliceV1> {
  const read = readCoreRuleExactRecordV1(input, ['kind', 'grantOrder', 'byGrant']);
  const issues = [...read.issues];
  if (!read.record) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  if (read.record.kind !== KIND)
    issues.push(makeCoreRuleIssueV1('INVALID_LITERAL', '/kind', 'Invalid visibility slice kind'));
  const order: string[] = [];
  if (!Array.isArray(read.record.grantOrder))
    issues.push(makeCoreRuleIssueV1('INVALID_ARRAY', '/grantOrder', 'grantOrder must be an array'));
  else
    for (let n = 0; n < read.record.grantOrder.length; n += 1) {
      const key = validateCoreRuleKeyV1(read.record.grantOrder[n], `/grantOrder/${n}`);
      if (!key.ok) issues.push(...key.issues);
      else if (order.includes(key.value))
        issues.push(
          makeCoreRuleIssueV1('DUPLICATE_VALUE', `/grantOrder/${n}`, 'Duplicate grant key'),
        );
      else order.push(key.value);
    }
  const by = Object.create(null) as Record<string, CoreVisibilityGrantV1>;
  const raw = read.record.byGrant;
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw))
    issues.push(makeCoreRuleIssueV1('INVALID_TYPE', '/byGrant', 'byGrant must be a record'));
  else
    for (const key of Reflect.ownKeys(raw)) {
      if (typeof key !== 'string') {
        issues.push(
          makeCoreRuleIssueV1(
            'UNKNOWN_FIELD',
            '/byGrant/[symbol]',
            'Symbol fields are not allowed',
          ),
        );
        continue;
      }
      const validKey = validateCoreRuleKeyV1(key, `/byGrant/${key}`);
      if (!validKey.ok) issues.push(...validKey.issues);
      const checked = grant((raw as Raw)[key], `/byGrant/${key}`);
      if (!checked.ok) issues.push(...checked.issues);
      else if (validKey.ok) by[key] = checked.value;
    }
  const keys = raw && typeof raw === 'object' && !Array.isArray(raw) ? Object.keys(raw) : [];
  for (const key of order)
    if (!Object.prototype.hasOwnProperty.call(by, key))
      issues.push(
        makeCoreRuleIssueV1('GRANT_SET_MISMATCH', '/byGrant', `Missing grant entry: ${key}`),
      );
  for (const key of keys)
    if (!order.includes(key))
      issues.push(
        makeCoreRuleIssueV1('GRANT_SET_MISMATCH', '/grantOrder', `Unordered grant entry: ${key}`),
      );
  if (issues.length) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  const canonical = Object.create(null) as Record<string, CoreVisibilityGrantV1>;
  for (const key of order) canonical[key] = by[key] as CoreVisibilityGrantV1;
  return {
    ok: true,
    value: deepFreezeCoreRuleValueV1({ kind: KIND, grantOrder: [...order], byGrant: canonical }),
  };
}

export class CoreVisibilitySliceCreationErrorV1 extends Error {
  readonly issues: readonly CoreRuleValidationIssueV1[];
  constructor(issues: readonly CoreRuleValidationIssueV1[]) {
    super(
      `${issues.map((issue) => issue.code).join(',') || 'INVALID_TYPE'}: Invalid Core visibility slice (${issues.length} issue(s))`,
    );
    this.name = 'CoreVisibilitySliceCreationErrorV1';
    this.issues = issues;
  }
}

export function createModeNeutralCoreVisibilitySliceV1(
  input: Omit<ModeNeutralCoreVisibilitySliceV1, 'kind'>,
): ModeNeutralCoreVisibilitySliceV1 {
  if (
    input !== null &&
    typeof input === 'object' &&
    !Array.isArray(input) &&
    Object.prototype.hasOwnProperty.call(input, 'kind')
  )
    throw new CoreVisibilitySliceCreationErrorV1([
      makeCoreRuleIssueV1('UNKNOWN_FIELD', '/kind', 'Factory input must omit kind'),
    ]);
  const result = validateModeNeutralCoreVisibilitySliceV1({ ...input, kind: KIND });
  if (!result.ok) throw new CoreVisibilitySliceCreationErrorV1(result.issues);
  return result.value;
}

export const createCoreVisibilitySliceV1 = createModeNeutralCoreVisibilitySliceV1;
