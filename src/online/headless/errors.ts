import {
  freezeHeadlessIssues,
  headlessIssue,
} from './support';
import type {
  OnlineHeadlessRoomGateIssueV1,
  OnlineHeadlessRoomGateOperationErrorCodeV1,
} from './types';

const MESSAGES: Readonly<Record<OnlineHeadlessRoomGateOperationErrorCodeV1, string>> =
  Object.freeze({
    INVALID_INPUT: 'Online headless room gate input was rejected',
    COMPOSITION_REJECTED: 'Online headless room gate composition was rejected',
    COVERAGE_MISSING: 'Online headless room gate coverage is incomplete',
    PRIVACY_REJECTED: 'Online headless room gate privacy check was rejected',
    REPLAY_MISMATCH: 'Online headless room gate replay did not match authority',
  });

export class OnlineHeadlessRoomGateOperationErrorV1 extends Error {
  readonly code: OnlineHeadlessRoomGateOperationErrorCodeV1;
  readonly issues: readonly OnlineHeadlessRoomGateIssueV1[];

  constructor(
    code: OnlineHeadlessRoomGateOperationErrorCodeV1,
    issues: readonly OnlineHeadlessRoomGateIssueV1[] = Object.freeze([]),
  ) {
    super(MESSAGES[code]);
    this.name = 'OnlineHeadlessRoomGateOperationErrorV1';
    this.code = code;
    this.issues = freezeHeadlessIssues(
      issues.length > 0
        ? issues
        : [headlessIssue(
            code === 'INVALID_INPUT' ? 'INVALID_ROOT' : code,
            '',
            MESSAGES[code],
          )],
    );
    Object.freeze(this);
  }
}
