import type { CoreTurnPriorityBundleV1 } from '../turn/turnPriorityBundleV1';
import {
  validateCoreRuleAuthorityBundleV1,
  type CoreRuleAuthorityBundleValidationIssueV1,
} from './ruleAuthorityBundleValidationV1';

export type CoreRuleAuthorityBundleV1 = Readonly<{
  readonly turnPriorityBundle: CoreTurnPriorityBundleV1;
  readonly control: import('./controlEffectV1').ModeNeutralCoreControlSliceV1;
  readonly visibility: import('./visibilityGrantV1').ModeNeutralCoreVisibilitySliceV1;
  readonly searchSessions: import('./searchSessionV1').ModeNeutralCoreSearchSessionSliceV1;
  readonly playPermissions: import('./playPermissionV1').ModeNeutralCorePlayPermissionSliceV1;
  readonly decisionAuthorities: import('./decisionAuthorityV1').ModeNeutralCoreDecisionAuthoritySliceV1;
}>;

export type CreateCoreRuleAuthorityBundleV1Input = Readonly<{
  readonly turnPriorityBundle: CoreTurnPriorityBundleV1;
  readonly control: CoreRuleAuthorityBundleV1['control'];
  readonly visibility: CoreRuleAuthorityBundleV1['visibility'];
  readonly searchSessions: CoreRuleAuthorityBundleV1['searchSessions'];
  readonly playPermissions: CoreRuleAuthorityBundleV1['playPermissions'];
  readonly decisionAuthorities: CoreRuleAuthorityBundleV1['decisionAuthorities'];
}>;

export class CoreRuleAuthorityBundleCreationErrorV1 extends Error {
  readonly issues: readonly CoreRuleAuthorityBundleValidationIssueV1[];

  constructor(issues: readonly CoreRuleAuthorityBundleValidationIssueV1[]) {
    super(`Invalid Core rule authority bundle (${issues.length} issue(s))`);
    this.name = 'CoreRuleAuthorityBundleCreationErrorV1';
    this.issues = Object.freeze(issues.map((issue) => Object.freeze({ ...issue })));
  }
}

function hasOwnKind(input: unknown): boolean {
  try {
    return (
      input !== null &&
      typeof input === 'object' &&
      !Array.isArray(input) &&
      Object.prototype.hasOwnProperty.call(input, 'kind')
    );
  } catch {
    return false;
  }
}

export function createCoreRuleAuthorityBundleV1(
  input: CreateCoreRuleAuthorityBundleV1Input,
): CoreRuleAuthorityBundleV1 {
  if (hasOwnKind(input)) {
    throw new CoreRuleAuthorityBundleCreationErrorV1([
      Object.freeze({
        code: 'UNKNOWN_FIELD',
        path: '/kind',
        message: 'Bundle factory input must not contain kind',
      }),
    ]);
  }
  const result = validateCoreRuleAuthorityBundleV1(input);
  if (!result.ok) throw new CoreRuleAuthorityBundleCreationErrorV1(result.issues);
  if (Object.isFrozen(input.turnPriorityBundle)) {
    return Object.freeze({
      ...result.value,
      turnPriorityBundle: input.turnPriorityBundle,
    });
  }
  return result.value;
}

export { validateCoreRuleAuthorityBundleV1 } from './ruleAuthorityBundleValidationV1';
export type {
  CoreRuleAuthorityBundleValidationCodeV1,
  CoreRuleAuthorityBundleValidationIssueV1,
  CoreRuleAuthorityBundleValidationResultV1,
} from './ruleAuthorityBundleValidationV1';
