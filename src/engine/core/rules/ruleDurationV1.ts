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
  | Readonly<{ readonly kind: 'until-end-of-turn'; readonly turnNumber: number }>
  | Readonly<{ readonly kind: 'while-source-exists'; readonly sourceObjectId: CoreObjectId }>
  | Readonly<{ readonly kind: 'manual' }>;

export function validateCoreRuleDurationV1(
  value: unknown,
  path = '',
): CoreRuleValidationResultV1<CoreRuleDurationV1> {
  const read = readCoreRuleExactRecordV1(value, ['kind', 'turnNumber', 'sourceObjectId'], path, [
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
