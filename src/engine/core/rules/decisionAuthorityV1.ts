import { isCoreBaseId, type CoreObjectId, type CorePlayerId } from '../ids';
import { isCanonicalCoreObjectIdV2 } from '../object/objectIdV2';
import type { CoreRuleKeyV1 } from './ruleKeyV1';
import {
  deepFreezeCoreRuleValueV1,
  makeCoreRuleIssueV1,
  readCoreRuleExactRecordV1,
  sortCoreRuleIssuesV1,
  type CoreRuleValidationIssueV1,
  type CoreRuleValidationResultV1,
} from './ruleValidationSharedV1';
import { CoreRuleAuthorityOperationError } from './ruleAuthorityErrorV1';

export type CoreDecisionAuthorityScopeV1 =
  | Readonly<{ readonly kind: 'pending-next-turn' }>
  | Readonly<{ readonly kind: 'active-turn'; readonly turnNumber: number }>
  | Readonly<{ readonly kind: 'decision'; readonly decisionKey: CoreRuleKeyV1 }>
  | Readonly<{ readonly kind: 'search-session'; readonly searchSessionId: CoreRuleKeyV1 }>
  | Readonly<{ readonly kind: 'all-game-decisions' }>;
export type CoreDecisionAuthorityV1 = Readonly<{
  readonly controlledPlayerId: CorePlayerId;
  readonly decisionMakerPlayerId: CorePlayerId;
  readonly sourceObjectId: CoreObjectId | null;
  readonly scope: CoreDecisionAuthorityScopeV1;
}>;
export type ModeNeutralCoreDecisionAuthoritySliceV1 = Readonly<{
  readonly kind: 'mode-neutral-core-decision-authority-slice-v1';
  readonly authorityOrder: readonly CoreRuleKeyV1[];
  readonly byAuthority: Readonly<Record<CoreRuleKeyV1, CoreDecisionAuthorityV1>>;
}>;
export type CoreDecisionContextV1 =
  | Readonly<{
      readonly kind: 'decision';
      readonly decisionKey: CoreRuleKeyV1;
      readonly turnNumber?: number;
    }>
  | Readonly<{
      readonly kind: 'search-session';
      readonly searchSessionId: CoreRuleKeyV1;
      readonly turnNumber?: number;
    }>;

type Raw = Record<string, unknown>;
const KIND = 'mode-neutral-core-decision-authority-slice-v1' as const;
const AUTHORITY_FIELDS = [
  'controlledPlayerId',
  'decisionMakerPlayerId',
  'sourceObjectId',
  'scope',
] as const;
const SCOPE_FIELDS = ['kind', 'turnNumber', 'decisionKey', 'searchSessionId'] as const;
const KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const issue = (code: CoreRuleValidationIssueV1['code'], path: string, message: string) =>
  makeCoreRuleIssueV1(code, path, message);
const validInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

function validateScope(
  value: unknown,
  at: string,
): CoreRuleValidationResultV1<CoreDecisionAuthorityScopeV1> {
  const read = readCoreRuleExactRecordV1(value, SCOPE_FIELDS, at, ['kind']);
  const issues = [...read.issues];
  if (!read.record) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  const record = read.record;
  if (record.kind === 'pending-next-turn' || record.kind === 'all-game-decisions') {
    if (Object.keys(record).some((key) => key !== 'kind'))
      issues.push(issue('UNKNOWN_FIELD', at, 'Scope has fields for another kind'));
  } else if (record.kind === 'active-turn') {
    if (!Object.prototype.hasOwnProperty.call(record, 'turnNumber'))
      issues.push(issue('MISSING_FIELD', `${at}/turnNumber`, 'Missing turnNumber'));
    else if (!validInteger(record.turnNumber))
      issues.push(
        issue(
          'INVALID_INTEGER',
          `${at}/turnNumber`,
          'Turn number must be a non-negative safe integer',
        ),
      );
  } else if (record.kind === 'decision') {
    if (!Object.prototype.hasOwnProperty.call(record, 'decisionKey'))
      issues.push(issue('MISSING_FIELD', `${at}/decisionKey`, 'Missing decisionKey'));
    else if (typeof record.decisionKey !== 'string' || !KEY.test(record.decisionKey))
      issues.push(issue('INVALID_STRING', `${at}/decisionKey`, 'Invalid decision key'));
  } else if (record.kind === 'search-session') {
    if (!Object.prototype.hasOwnProperty.call(record, 'searchSessionId'))
      issues.push(issue('MISSING_FIELD', `${at}/searchSessionId`, 'Missing searchSessionId'));
    else if (typeof record.searchSessionId !== 'string' || !KEY.test(record.searchSessionId))
      issues.push(issue('INVALID_STRING', `${at}/searchSessionId`, 'Invalid search session ID'));
  } else
    issues.push(issue('INVALID_LITERAL', `${at}/kind`, 'Invalid decision authority scope kind'));
  if (issues.length) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  if (record.kind === 'active-turn')
    return {
      ok: true,
      value: Object.freeze({ kind: record.kind, turnNumber: record.turnNumber as number }),
    };
  if (record.kind === 'decision')
    return {
      ok: true,
      value: Object.freeze({ kind: record.kind, decisionKey: record.decisionKey as CoreRuleKeyV1 }),
    };
  if (record.kind === 'search-session')
    return {
      ok: true,
      value: Object.freeze({
        kind: record.kind,
        searchSessionId: record.searchSessionId as CoreRuleKeyV1,
      }),
    };
  return { ok: true, value: Object.freeze({ kind: record.kind }) as CoreDecisionAuthorityScopeV1 };
}

function validateAuthority(
  value: unknown,
  at: string,
): CoreRuleValidationResultV1<CoreDecisionAuthorityV1> {
  const read = readCoreRuleExactRecordV1(value, AUTHORITY_FIELDS, at);
  const issues = [...read.issues];
  if (!read.record) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  const record = read.record;
  if (typeof record.controlledPlayerId !== 'string' || !isCoreBaseId(record.controlledPlayerId))
    issues.push(issue('INVALID_ID', `${at}/controlledPlayerId`, 'Invalid controlled player ID'));
  if (
    typeof record.decisionMakerPlayerId !== 'string' ||
    !isCoreBaseId(record.decisionMakerPlayerId)
  )
    issues.push(
      issue('INVALID_ID', `${at}/decisionMakerPlayerId`, 'Invalid decision maker player ID'),
    );
  if (record.sourceObjectId !== null && !isCanonicalCoreObjectIdV2(record.sourceObjectId))
    issues.push(issue('INVALID_ID', `${at}/sourceObjectId`, 'Invalid source object ID'));
  const scope = validateScope(record.scope, `${at}/scope`);
  if (!scope.ok) {
    issues.push(...scope.issues);
    return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  }
  if (issues.length) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  return {
    ok: true,
    value: Object.freeze({
      controlledPlayerId: record.controlledPlayerId as CorePlayerId,
      decisionMakerPlayerId: record.decisionMakerPlayerId as CorePlayerId,
      sourceObjectId: record.sourceObjectId as CoreObjectId | null,
      scope: scope.value,
    }),
  };
}

export function validateModeNeutralCoreDecisionAuthoritySliceV1(
  input: unknown,
): CoreRuleValidationResultV1<ModeNeutralCoreDecisionAuthoritySliceV1> {
  const read = readCoreRuleExactRecordV1(input, ['kind', 'authorityOrder', 'byAuthority']);
  const issues = [...read.issues];
  if (!read.record) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  const root = read.record;
  if (root.kind !== KIND)
    issues.push(issue('INVALID_LITERAL', '/kind', 'Invalid decision authority slice kind'));
  if (!Array.isArray(root.authorityOrder))
    issues.push(issue('INVALID_ARRAY', '/authorityOrder', 'authorityOrder must be an array'));
  const order = Array.isArray(root.authorityOrder) ? root.authorityOrder : [];
  const seen = new Set<string>();
  order.forEach((key, index) => {
    if (typeof key !== 'string' || !KEY.test(key))
      issues.push(issue('INVALID_STRING', `/authorityOrder/${index}`, 'Invalid authority key'));
    else if (seen.has(key))
      issues.push(issue('DUPLICATE_VALUE', `/authorityOrder/${index}`, 'Duplicate authority key'));
    else seen.add(key);
  });
  const raw = root.byAuthority;
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw))
    issues.push(issue('INVALID_TYPE', '/byAuthority', 'byAuthority must be a record'));
  const checked: Record<string, CoreDecisionAuthorityV1> = Object.create(null) as Record<
    string,
    CoreDecisionAuthorityV1
  >;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const key of Reflect.ownKeys(raw)) {
      if (typeof key !== 'string') {
        issues.push(
          issue('UNKNOWN_FIELD', '/byAuthority/[symbol]', 'Symbol fields are not allowed'),
        );
        continue;
      }
      const result = validateAuthority((raw as Raw)[key], `/byAuthority/${key}`);
      if (result.ok) checked[key] = result.value;
      else issues.push(...result.issues);
    }
    const keys = Object.keys(raw);
    for (const key of order)
      if (typeof key === 'string' && !Object.prototype.hasOwnProperty.call(raw, key))
        issues.push(
          issue('AUTHORITY_SET_MISMATCH', '/authorityOrder', `Missing byAuthority entry: ${key}`),
        );
    for (const key of keys)
      if (!seen.has(key))
        issues.push(
          issue('AUTHORITY_SET_MISMATCH', '/byAuthority', `Unordered authority entry: ${key}`),
        );
  }
  if (issues.length) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  const canonical: Record<string, CoreDecisionAuthorityV1> = Object.create(null) as Record<
    string,
    CoreDecisionAuthorityV1
  >;
  for (const key of order as readonly string[])
    canonical[key] = checked[key];
  return {
    ok: true,
    value: deepFreezeCoreRuleValueV1({
      kind: KIND,
      authorityOrder: Object.freeze((order as readonly string[]).slice()),
      byAuthority: canonical,
    }),
  };
}

export class CoreDecisionAuthorityCreationError extends Error {
  readonly issues: readonly CoreRuleValidationIssueV1[];
  constructor(issues: readonly CoreRuleValidationIssueV1[]) {
    super(`Invalid Core decision authority slice (${issues.length} issue(s))`);
    this.name = 'CoreDecisionAuthorityCreationError';
    this.issues = issues;
  }
}
export function createModeNeutralCoreDecisionAuthoritySliceV1(
  input: Omit<ModeNeutralCoreDecisionAuthoritySliceV1, 'kind'>,
): ModeNeutralCoreDecisionAuthoritySliceV1 {
  const result = validateModeNeutralCoreDecisionAuthoritySliceV1({ ...input, kind: KIND });
  if (!result.ok) throw new CoreDecisionAuthorityCreationError(result.issues);
  return result.value;
}
function checked(
  input: ModeNeutralCoreDecisionAuthoritySliceV1,
): ModeNeutralCoreDecisionAuthoritySliceV1 {
  const result = validateModeNeutralCoreDecisionAuthoritySliceV1(input);
  if (!result.ok)
    throw new CoreRuleAuthorityOperationError({
      code: 'INVALID_OPERATION_INPUT',
      path: '',
      message: 'Invalid decision authority slice',
    });
  return result.value;
}
function output(order: readonly string[], by: Readonly<Record<string, CoreDecisionAuthorityV1>>) {
  return Object.freeze({
    value: createModeNeutralCoreDecisionAuthoritySliceV1({
      authorityOrder: order,
      byAuthority: by,
    }),
  });
}
export function addCoreDecisionAuthorityV1(
  sliceInput: ModeNeutralCoreDecisionAuthoritySliceV1,
  authorityKey: CoreRuleKeyV1,
  authority: CoreDecisionAuthorityV1,
) {
  const slice = checked(sliceInput);
  if (
    !KEY.test(authorityKey) ||
    Object.prototype.hasOwnProperty.call(slice.byAuthority, authorityKey)
  )
    throw new CoreRuleAuthorityOperationError({
      code: 'ID_COLLISION',
      path: `/byAuthority/${authorityKey}`,
      message: 'Authority key already exists or is invalid',
    });
  const valid = validateAuthority(authority, `/byAuthority/${authorityKey}`);
  if (!valid.ok)
    throw new CoreRuleAuthorityOperationError({
      code: 'INVALID_OPERATION_INPUT',
      path: `/byAuthority/${authorityKey}`,
      message: 'Invalid authority',
    });
  return output([...slice.authorityOrder, authorityKey], {
    ...slice.byAuthority,
    [authorityKey]: valid.value,
  });
}
export function removeCoreDecisionAuthorityV1(
  sliceInput: ModeNeutralCoreDecisionAuthoritySliceV1,
  authorityKey: CoreRuleKeyV1,
) {
  const slice = checked(sliceInput);
  if (!Object.prototype.hasOwnProperty.call(slice.byAuthority, authorityKey))
    throw new CoreRuleAuthorityOperationError({
      code: 'AUTHORITY_NOT_FOUND',
      path: `/byAuthority/${authorityKey}`,
      message: 'Authority not found',
    });
  const order = slice.authorityOrder.filter((key) => key !== authorityKey);
  const by = Object.fromEntries(order.map((key) => [key, slice.byAuthority[key]]));
  return output(order, by);
}
export function coreDecisionMakerForV1(
  sliceInput: ModeNeutralCoreDecisionAuthoritySliceV1,
  controlledPlayerId: CorePlayerId,
  decisionContext: CoreDecisionContextV1,
): CorePlayerId {
  const slice = checked(sliceInput);
  let maker = controlledPlayerId;
  for (const key of slice.authorityOrder) {
    const authority = slice.byAuthority[key];
    const scope = authority.scope;
    const matches =
      scope.kind === 'all-game-decisions' ||
      (scope.kind === 'decision' &&
        decisionContext.kind === 'decision' &&
        scope.decisionKey === decisionContext.decisionKey) ||
      (scope.kind === 'search-session' &&
        decisionContext.kind === 'search-session' &&
        scope.searchSessionId === decisionContext.searchSessionId) ||
      (scope.kind === 'active-turn' && decisionContext.turnNumber === scope.turnNumber);
    if (authority.controlledPlayerId === controlledPlayerId && matches)
      maker = authority.decisionMakerPlayerId;
  }
  return maker;
}
export function activateCorePendingDecisionAuthoritiesAtTurnStartV1(
  sliceInput: ModeNeutralCoreDecisionAuthoritySliceV1,
  controlledPlayerId: CorePlayerId,
  turnNumber: number,
) {
  const slice = checked(sliceInput);
  if (!validInteger(turnNumber))
    throw new CoreRuleAuthorityOperationError({
      code: 'TURN_BOUNDARY_MISMATCH',
      path: '/turnNumber',
      message: 'Invalid turn number',
    });
  const by: Record<string, CoreDecisionAuthorityV1> = Object.create(null) as Record<
    string,
    CoreDecisionAuthorityV1
  >;
  for (const key of slice.authorityOrder) {
    const authority = slice.byAuthority[key];
    by[key] =
      authority.controlledPlayerId === controlledPlayerId &&
      authority.scope.kind === 'pending-next-turn'
        ? { ...authority, scope: { kind: 'active-turn', turnNumber } }
        : authority;
  }
  return output(slice.authorityOrder, by);
}
export function expireCoreDecisionAuthoritiesAfterTurnV1(
  sliceInput: ModeNeutralCoreDecisionAuthoritySliceV1,
  turnNumber: number,
) {
  const slice = checked(sliceInput);
  if (!validInteger(turnNumber))
    throw new CoreRuleAuthorityOperationError({
      code: 'TURN_BOUNDARY_MISMATCH',
      path: '/turnNumber',
      message: 'Invalid turn number',
    });
  const order = slice.authorityOrder.filter(
    (key) =>
      slice.byAuthority[key].scope.kind !== 'active-turn' ||
      slice.byAuthority[key].scope.turnNumber !== turnNumber,
  );
  const by = Object.fromEntries(order.map((key) => [key, slice.byAuthority[key]]));
  return output(order, by);
}
