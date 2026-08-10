import {
  type CoreRuleValidationIssueV1,
  type CoreRuleValidationResultV1,
  deepFreezeCoreRuleValueV1,
  makeCoreRuleIssueV1,
  sortCoreRuleIssuesV1,
} from './ruleValidationSharedV1';

export type CoreRuleKeyV1 = string;
const PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const UNSAFE = new Set(['__proto__', 'prototype', 'constructor']);

export function validateCoreRuleKeyV1(
  value: unknown,
  path = '',
): CoreRuleValidationResultV1<CoreRuleKeyV1> {
  const issues: CoreRuleValidationIssueV1[] = [];
  if (typeof value !== 'string')
    issues.push(makeCoreRuleIssueV1('INVALID_TYPE', path, 'Expected a rule key string'));
  else if (!PATTERN.test(value))
    issues.push(makeCoreRuleIssueV1('INVALID_STRING', path, 'Invalid Core rule key'));
  else if (UNSAFE.has(value))
    issues.push(makeCoreRuleIssueV1('UNSAFE_RECORD_KEY', path, `Unsafe record key: ${value}`));
  if (issues.length > 0) return { ok: false, issues: sortCoreRuleIssuesV1(issues) };
  return { ok: true, value: deepFreezeCoreRuleValueV1(value as string) };
}

export function createCoreRuleKeyV1(value: unknown): CoreRuleKeyV1 {
  const result = validateCoreRuleKeyV1(value);
  if (!result.ok) throw new CoreRuleKeyCreationError(result.issues);
  return result.value;
}

export class CoreRuleKeyCreationError extends Error {
  readonly issues: readonly CoreRuleValidationIssueV1[];
  constructor(issues: readonly CoreRuleValidationIssueV1[]) {
    super(`Invalid Core rule key (${issues.length} issue(s))`);
    this.name = 'CoreRuleKeyCreationError';
    this.issues = issues;
  }
}
