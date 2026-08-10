import { isCoreBaseId } from '../ids';
import { isCanonicalCoreObjectIdV2 } from '../object/objectIdV2';
import type { CorePlayerId } from '../ids';
import type { CoreRuleValidationResultV1 } from './ruleValidationSharedV1';
import {
  makeCoreRuleIssueV1,
  readCoreRuleExactRecordV1,
  sortCoreRuleIssuesV1,
} from './ruleValidationSharedV1';

export type CoreRuleZoneRefV1 =
  | Readonly<{
      readonly kind: 'player-zone';
      readonly playerId: CorePlayerId;
      readonly zone: 'library' | 'hand' | 'graveyard';
    }>
  | Readonly<{
      readonly kind: 'shared-zone';
      readonly zone: 'battlefield' | 'stack' | 'exile' | 'command';
    }>;

export function validateCoreRuleZoneRefV1(
  value: unknown,
  path = '',
): CoreRuleValidationResultV1<CoreRuleZoneRefV1> {
  const read = readCoreRuleExactRecordV1(value, ['kind', 'playerId', 'zone'], path, ['kind']);
  const issues = [...read.issues];
  if (read.record === null) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  const record = read.record;
  if (record.kind === 'player-zone') {
    if (!Object.prototype.hasOwnProperty.call(record, 'playerId'))
      issues.push(
        makeCoreRuleIssueV1('MISSING_FIELD', `${path}/playerId`, 'Missing field: playerId'),
      );
    if (!Object.prototype.hasOwnProperty.call(record, 'zone'))
      issues.push(makeCoreRuleIssueV1('MISSING_FIELD', `${path}/zone`, 'Missing field: zone'));
    if (typeof record.playerId !== 'string' || !isCoreBaseId(record.playerId))
      issues.push(makeCoreRuleIssueV1('INVALID_ID', `${path}/playerId`, 'Invalid Core player ID'));
    if (record.zone !== 'library' && record.zone !== 'hand' && record.zone !== 'graveyard')
      issues.push(makeCoreRuleIssueV1('INVALID_LITERAL', `${path}/zone`, 'Invalid player zone'));
    if (issues.length === 0)
      return {
        ok: true,
        value: Object.freeze({
          kind: 'player-zone',
          playerId: record.playerId as CorePlayerId,
          zone: record.zone as 'library' | 'hand' | 'graveyard',
        }),
      };
  } else if (record.kind === 'shared-zone') {
    if (Object.prototype.hasOwnProperty.call(record, 'playerId'))
      issues.push(
        makeCoreRuleIssueV1(
          'UNKNOWN_FIELD',
          `${path}/playerId`,
          'playerId is not valid for a shared zone',
        ),
      );
    if (!Object.prototype.hasOwnProperty.call(record, 'zone'))
      issues.push(makeCoreRuleIssueV1('MISSING_FIELD', `${path}/zone`, 'Missing field: zone'));
    else if (
      record.zone !== 'battlefield' &&
      record.zone !== 'stack' &&
      record.zone !== 'exile' &&
      record.zone !== 'command'
    )
      issues.push(makeCoreRuleIssueV1('INVALID_LITERAL', `${path}/zone`, 'Invalid shared zone'));
    if (issues.length === 0)
      return {
        ok: true,
        value: Object.freeze({
          kind: 'shared-zone',
          zone: record.zone as 'battlefield' | 'stack' | 'exile' | 'command',
        }),
      };
  } else {
    issues.push(
      makeCoreRuleIssueV1('INVALID_LITERAL', `${path}/kind`, 'Invalid zone reference kind'),
    );
  }
  return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
}

export function createCoreRuleZoneRefV1(value: unknown): CoreRuleZoneRefV1 {
  const result = validateCoreRuleZoneRefV1(value);
  if (!result.ok) throw new CoreRuleZoneRefCreationError(result.issues);
  return result.value;
}

export class CoreRuleZoneRefCreationError extends Error {
  readonly issues: readonly ReturnType<typeof makeCoreRuleIssueV1>[];
  constructor(issues: readonly ReturnType<typeof makeCoreRuleIssueV1>[]) {
    super(`Invalid Core rule zone reference (${issues.length} issue(s))`);
    this.name = 'CoreRuleZoneRefCreationError';
    this.issues = issues;
  }
}

export function isCoreRuleObjectIdV1(value: unknown): boolean {
  return isCanonicalCoreObjectIdV2(value);
}
