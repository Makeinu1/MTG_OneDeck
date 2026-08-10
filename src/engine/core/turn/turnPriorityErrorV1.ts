export type CoreTurnPriorityOperationCodeV1 =
  | 'INVALID_TURN_PRIORITY_BUNDLE'
  | 'INVALID_OPERATION_INPUT'
  | 'WINDOW_MISMATCH'
  | 'PLAYER_NOT_SEATED'
  | 'NOT_PRIORITY_HOLDER'
  | 'INVALID_PASS_SEQUENCE'
  | 'TOP_STACK_MISMATCH'
  | 'TRIGGER_ORDER_INVALID'
  | 'TRIGGER_COMMIT_FAILED'
  | 'POSITION_TRANSITION_INVALID'
  | 'TURN_BASED_ACTION_MISMATCH'
  | 'CLEANUP_DISCARD_INCOMPLETE'
  | 'RESOLUTION_REMOVAL_MISMATCH'
  | 'TURN_NUMBER_OVERFLOW'
  | 'POSITION_SEQUENCE_OVERFLOW'
  | 'CANDIDATE_INVALID';

export type CoreTurnPriorityErrorCodeV1 = CoreTurnPriorityOperationCodeV1;
export type CoreTurnPriorityOperationErrorCodeV1 = CoreTurnPriorityOperationCodeV1;
export type CoreTurnPriorityOperationCode = CoreTurnPriorityOperationCodeV1;
export type CoreTurnPriorityErrorCode = CoreTurnPriorityOperationCodeV1;

export type CoreTurnPriorityOperationIssueV1 = Readonly<{
  readonly code: CoreTurnPriorityOperationCodeV1;
  readonly path: string;
  readonly message: string;
}>;

export class CoreTurnPriorityErrorV1 extends Error {
  readonly code: CoreTurnPriorityOperationCodeV1;
  readonly issues: readonly CoreTurnPriorityOperationIssueV1[];

  constructor(
    code: CoreTurnPriorityOperationCodeV1,
    message: string,
    issues: readonly CoreTurnPriorityOperationIssueV1[] = [],
  ) {
    const frozenIssues = Object.freeze(issues.map((issue) => Object.freeze({ ...issue })));
    super(message);
    this.name = 'CoreTurnPriorityErrorV1';
    this.code = code;
    this.issues = frozenIssues;
  }
}

export class CoreTurnPriorityOperationErrorV1 extends CoreTurnPriorityErrorV1 {
  constructor(
    code: CoreTurnPriorityOperationCodeV1,
    message: string,
    issues: readonly CoreTurnPriorityOperationIssueV1[] = [],
  ) {
    super(code, message, issues);
    this.name = 'CoreTurnPriorityOperationErrorV1';
  }
}

export { CoreTurnPriorityErrorV1 as CoreTurnPriorityError };
