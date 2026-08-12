import type { OnlineRoomValidationIssueV1 } from './types';
import { sortedRoomIssues } from './validationSupport';

export class OnlineRoomCreationErrorV1 extends Error {
  readonly issues: readonly OnlineRoomValidationIssueV1[];

  constructor(
    issues: readonly OnlineRoomValidationIssueV1[],
    configuredCapabilities: readonly string[] = [],
  ) {
    super(`Invalid Online Room creation (${issues.length} issue(s))`);
    this.name = 'OnlineRoomCreationErrorV1';
    this.issues = sortedRoomIssues(issues, configuredCapabilities);
    Object.freeze(this);
  }
}

export class OnlineRoomOperationErrorV1 extends Error {
  readonly issues: readonly OnlineRoomValidationIssueV1[];

  constructor(
    issues: readonly OnlineRoomValidationIssueV1[],
    configuredCapabilities: readonly string[] = [],
  ) {
    super(`Invalid Online Room operation (${issues.length} issue(s))`);
    this.name = 'OnlineRoomOperationErrorV1';
    this.issues = sortedRoomIssues(issues, configuredCapabilities);
    Object.freeze(this);
  }
}
