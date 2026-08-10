export type CoreRuleAuthorityOperationErrorCodeV1 =
  | 'INVALID_RULE_AUTHORITY_BUNDLE'
  | 'INVALID_OPERATION_INPUT'
  | 'ID_COLLISION'
  | 'EFFECT_NOT_FOUND'
  | 'GRANT_NOT_FOUND'
  | 'SESSION_NOT_FOUND'
  | 'PERMISSION_NOT_FOUND'
  | 'AUTHORITY_NOT_FOUND'
  | 'EFFECT_ORDER_INVALID'
  | 'OBJECT_NOT_CONTROLLABLE'
  | 'SEARCH_SNAPSHOT_STALE'
  | 'SEARCH_SELECTION_INVALID'
  | 'DECISION_AUTHORITY_MISSING'
  | 'PLAY_PERMISSION_MISSING'
  | 'TURN_BOUNDARY_MISMATCH'
  | 'CANDIDATE_INVALID';

export type CoreRuleAuthorityOperationErrorV1 = Readonly<{
  readonly code: CoreRuleAuthorityOperationErrorCodeV1;
  readonly path: string;
  readonly message: string;
}>;

export class CoreRuleAuthorityOperationError extends Error {
  readonly code: CoreRuleAuthorityOperationErrorCodeV1;
  readonly path: string;
  readonly issues: readonly CoreRuleAuthorityOperationErrorV1[];
  constructor(
    issues: readonly CoreRuleAuthorityOperationErrorV1[] | CoreRuleAuthorityOperationErrorV1,
  ) {
    const list: readonly CoreRuleAuthorityOperationErrorV1[] =
      issues instanceof Array ? issues : [issues];
    super(
      `${list[0]?.code ?? 'INVALID_OPERATION_INPUT'}: Core rule authority operation failed (${list.length} issue(s))`,
    );
    this.name = 'CoreRuleAuthorityOperationError';
    this.issues = Object.freeze(list.slice());
    this.code = list[0]?.code ?? 'INVALID_OPERATION_INPUT';
    this.path = list[0]?.path ?? '';
  }
}
