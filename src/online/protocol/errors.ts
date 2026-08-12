import type { OnlineProtocolIssueV1 } from './types';
import { freezeProtocolIssues } from './support';

export class OnlineProtocolCreationErrorV1 extends Error {
  readonly issues: readonly OnlineProtocolIssueV1[];

  constructor(
    issues: readonly OnlineProtocolIssueV1[],
    configuredCapabilities: readonly string[] = [],
  ) {
    super(`Invalid Online Protocol state creation (${issues.length} issue(s))`);
    this.name = 'OnlineProtocolCreationErrorV1';
    this.issues = freezeProtocolIssues(issues, configuredCapabilities);
    Object.freeze(this);
  }
}

export class OnlineProtocolOperationErrorV1 extends Error {
  readonly issues: readonly OnlineProtocolIssueV1[];

  constructor(
    issues: readonly OnlineProtocolIssueV1[],
    configuredCapabilities: readonly string[] = [],
  ) {
    super(`Invalid Online Protocol operation (${issues.length} issue(s))`);
    this.name = 'OnlineProtocolOperationErrorV1';
    this.issues = freezeProtocolIssues(issues, configuredCapabilities);
    Object.freeze(this);
  }
}
