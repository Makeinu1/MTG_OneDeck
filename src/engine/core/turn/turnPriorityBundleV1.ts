import type { CoreStackTransactionBundleV1 } from './stackTransactionAccessV1';
import {
  validateCoreTurnPriorityBundleV1,
} from './turnPriorityBundleValidationV1';
import type {
  CoreTurnPriorityBundleValidationIssueV1,
} from './turnPriorityBundleValidationV1';
import type {
  ModeNeutralCorePendingTriggerSliceV1,
} from './pendingTriggerV1';
import type { ModeNeutralCoreTurnLifecycleSliceV1 } from './turnLifecycleV1';

export type CoreTurnPriorityBundleV1 = Readonly<{
  readonly stackBundle: CoreStackTransactionBundleV1;
  readonly pendingTriggers: ModeNeutralCorePendingTriggerSliceV1;
  readonly lifecycle: ModeNeutralCoreTurnLifecycleSliceV1;
}>;

export type CreateCoreTurnPriorityBundleV1Input = Readonly<{
  readonly stackBundle: CoreStackTransactionBundleV1;
  readonly pendingTriggers: ModeNeutralCorePendingTriggerSliceV1;
  readonly lifecycle: ModeNeutralCoreTurnLifecycleSliceV1;
}>;

export class CoreTurnPriorityBundleCreationErrorV1 extends Error {
  readonly issues: readonly CoreTurnPriorityBundleValidationIssueV1[];

  constructor(issues: readonly CoreTurnPriorityBundleValidationIssueV1[]) {
    super(`Invalid Core turn priority bundle (${issues.length} issue(s))`);
    this.name = 'CoreTurnPriorityBundleCreationErrorV1';
    this.issues = Object.freeze(issues.map((current) => Object.freeze({ ...current })));
  }
}

function hasOwnField(input: unknown, field: string): boolean {
  try {
    return input !== null && typeof input === 'object' && !Array.isArray(input)
      && Object.prototype.hasOwnProperty.call(input, field);
  } catch {
    return false;
  }
}

export function createCoreTurnPriorityBundleV1(
  input: CreateCoreTurnPriorityBundleV1Input,
): CoreTurnPriorityBundleV1 {
  if (hasOwnField(input, 'kind')) {
    throw new CoreTurnPriorityBundleCreationErrorV1([Object.freeze({
      code: 'UNKNOWN_FIELD',
      path: '/kind',
      message: 'Bundle factory input must not contain kind',
    })]);
  }
  const result = validateCoreTurnPriorityBundleV1(input);
  if (!result.ok) throw new CoreTurnPriorityBundleCreationErrorV1(result.issues);
  return result.value;
}

export { validateCoreTurnPriorityBundleV1 } from './turnPriorityBundleValidationV1';
export type {
  CoreTurnPriorityBundleValidationCodeV1,
  CoreTurnPriorityBundleValidationIssueV1,
  CoreTurnPriorityBundleValidationResultV1,
} from './turnPriorityBundleValidationV1';
