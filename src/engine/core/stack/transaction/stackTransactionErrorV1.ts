import type {
  CoreStackTransactionValidationCodeV1,
  CoreStackTransactionValidationIssueV1,
} from './stackTransactionValidationV1';
import { cloneTransactionIssuesV1 } from './internalStackTransactionV1';

export type CoreStackTransactionErrorCodeV1 = CoreStackTransactionValidationCodeV1;

export class CoreStackTransactionErrorV1 extends Error {
  readonly code: CoreStackTransactionErrorCodeV1;
  readonly issues: readonly CoreStackTransactionValidationIssueV1[];

  constructor(
    code: CoreStackTransactionErrorCodeV1,
    issues: readonly CoreStackTransactionValidationIssueV1[],
  ) {
    const frozenIssues = cloneTransactionIssuesV1(issues);
    super(`Core stack transaction failed: ${code} (${frozenIssues.length} issue(s))`);
    this.name = 'CoreStackTransactionErrorV1';
    this.code = code;
    this.issues = frozenIssues;
  }
}
