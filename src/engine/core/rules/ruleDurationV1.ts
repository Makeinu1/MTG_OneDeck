import { isCanonicalCoreObjectIdV2 } from '../object/objectIdV2';
import type { CoreObjectId } from '../ids';
import type { CoreRuleValidationResultV1 } from './ruleValidationSharedV1';
import {
  makeCoreRuleIssueV1,
  readCoreRuleExactRecordV1,
  sortCoreRuleIssuesV1,
} from './ruleValidationSharedV1';

export type CoreRuleDurationV1 =
  | Readonly<{ readonly kind: 'indefinite' }>
  /** A network visibility grant remains valid for the command that opened it. */
  | Readonly<{ readonly kind: 'until-next-command'; readonly openingSequence: number }>
  | Readonly<{ readonly kind: 'until-end-of-turn'; readonly turnNumber: number }>
  | Readonly<{ readonly kind: 'while-source-exists'; readonly sourceObjectId: CoreObjectId }>
  /** A visibility grant remains valid while the named search session is open. */
  | Readonly<{ readonly kind: 'until-search-completes'; readonly searchSessionId: string }>
  | Readonly<{ readonly kind: 'manual' }>;

export function validateCoreRuleDurationV1(
  value: unknown,
  path = '',
): CoreRuleValidationResultV1<CoreRuleDurationV1> {
  const read = readCoreRuleExactRecordV1(value, ['kind', 'turnNumber', 'sourceObjectId', 'openingSequence', 'searchSessionId'], path, [
    'kind',
  ]);
  const issues = [...read.issues];
  if (read.record === null) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  const record = read.record;
  if (record.kind === 'indefinite' || record.kind === 'manual') {
    if (Object.keys(record).some((key) => key !== 'kind'))
      issues.push(
        makeCoreRuleIssueV1('UNKNOWN_FIELD', path, 'Duration has fields for another kind'),
      );
    if (issues.length === 0)
      return { ok: true, value: Object.freeze({ kind: record.kind }) as CoreRuleDurationV1 };
  } else if (record.kind === 'until-next-command') {
    if (!Object.prototype.hasOwnProperty.call(record, 'openingSequence'))
      issues.push(makeCoreRuleIssueV1('MISSING_FIELD', `${path}/openingSequence`, 'Missing field: openingSequence'));
    if (typeof record.openingSequence !== 'number' || !Number.isSafeInteger(record.openingSequence) || record.openingSequence < 0)
      issues.push(makeCoreRuleIssueV1('INVALID_INTEGER', `${path}/openingSequence`, 'Opening sequence must be a non-negative safe integer'));
    if (issues.length === 0)
      return { ok: true, value: Object.freeze({ kind: record.kind, openingSequence: record.openingSequence as number }) as CoreRuleDurationV1 };
  } else if (record.kind === 'until-end-of-turn') {
    if (!Object.prototype.hasOwnProperty.call(record, 'turnNumber'))
      issues.push(
        makeCoreRuleIssueV1('MISSING_FIELD', `${path}/turnNumber`, 'Missing field: turnNumber'),
      );
    if (typeof record.turnNumber !== 'number' || !Number.isSafeInteger(record.turnNumber))
      issues.push(
        makeCoreRuleIssueV1(
          'INVALID_INTEGER',
          `${path}/turnNumber`,
          'Turn number must be a safe integer',
        ),
      );
    if (issues.length === 0)
      return {
        ok: true,
        value: Object.freeze({
          kind: 'until-end-of-turn',
          turnNumber: record.turnNumber as number,
        }),
      };
  } else if (record.kind === 'while-source-exists') {
    if (!Object.prototype.hasOwnProperty.call(record, 'sourceObjectId'))
      issues.push(
        makeCoreRuleIssueV1(
          'MISSING_FIELD',
          `${path}/sourceObjectId`,
          'Missing field: sourceObjectId',
        ),
      );
    if (!isCanonicalCoreObjectIdV2(record.sourceObjectId))
      issues.push(
        makeCoreRuleIssueV1('INVALID_ID', `${path}/sourceObjectId`, 'Invalid Core object ID'),
      );
    if (issues.length === 0)
      return {
        ok: true,
        value: Object.freeze({
          kind: 'while-source-exists',
          sourceObjectId: record.sourceObjectId as CoreObjectId,
        }),
      };
  } else if (record.kind === 'until-search-completes') {
    if (!Object.prototype.hasOwnProperty.call(record, 'searchSessionId'))
      issues.push(makeCoreRuleIssueV1('MISSING_FIELD', `${path}/searchSessionId`, 'Missing field: searchSessionId'));
    if (typeof record.searchSessionId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(record.searchSessionId))
      issues.push(makeCoreRuleIssueV1('INVALID_STRING', `${path}/searchSessionId`, 'Invalid search session ID'));
    if (issues.length === 0)
      return { ok: true, value: Object.freeze({ kind: record.kind, searchSessionId: record.searchSessionId as string }) as CoreRuleDurationV1 };
  } else {
    issues.push(makeCoreRuleIssueV1('INVALID_LITERAL', `${path}/kind`, 'Invalid duration kind'));
  }
  return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
}

export function createCoreRuleDurationV1(value: unknown): CoreRuleDurationV1 {
  const result = validateCoreRuleDurationV1(value);
  if (!result.ok) throw new CoreRuleDurationCreationError(result.issues);
  return result.value;
}

export class CoreRuleDurationCreationError extends Error {
  readonly issues: readonly ReturnType<typeof makeCoreRuleIssueV1>[];
  constructor(issues: readonly ReturnType<typeof makeCoreRuleIssueV1>[]) {
    super(`Invalid Core rule duration (${issues.length} issue(s))`);
    this.name = 'CoreRuleDurationCreationError';
    this.issues = issues;
  }
}
