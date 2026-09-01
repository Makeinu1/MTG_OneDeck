import type { CoreObjectId, CorePhysicalCardId, CorePlayerId, ModeNeutralCoreRootV1 } from '../../engine/core/index';
import type { OnlineVariableProtocolStateV2 } from '../protocol/index';
import type { OnlineVariableParticipantProjectionV3 } from '../projection/index';

export const ONLINE_PREGAME_SCHEMA_VERSION_V1 = 1 as const;

export type OnlinePregamePhaseV1 =
  | 'commander-reveal'
  | 'mulligan-declaration'
  | 'mulligan-bottom'
  | 'pregame-actions'
  | 'ready'
  | 'complete';

export type OnlinePregameRandomPlanV1 = Readonly<{
  readonly kind: 'online-pregame-random-plan-v1';
  readonly schemaVersion: 1;
  readonly decisionId: string;
  readonly startingPlayerId: CorePlayerId;
  readonly turnOrder: readonly CorePlayerId[];
  readonly libraryPlans: readonly Readonly<{
    readonly playerId: CorePlayerId;
    readonly orders: readonly (readonly CorePhysicalCardId[])[];
  }>[];
}>;

export type OnlinePregamePlayerV1 = Readonly<{
  readonly playerId: CorePlayerId;
  readonly commanderConfirmed: boolean;
  readonly mulliganDecision: 'pending' | 'mulligan' | 'keep';
  readonly mulligansTaken: number;
  readonly bottomCountRequired: number;
  readonly pendingBottomObjectIds: readonly CoreObjectId[];
  readonly manualActionCount: number;
  readonly manualActionsComplete: boolean;
  readonly ready: boolean;
}>;

export type OnlinePregameCommandV1 =
  | Readonly<{ readonly kind: 'confirm-commanders' }>
  | Readonly<{ readonly kind: 'declare-mulligan'; readonly decision: 'mulligan' | 'keep' }>
  | Readonly<{ readonly kind: 'submit-mulligan-bottom'; readonly objectIds: readonly CoreObjectId[] }>
  | Readonly<{ readonly kind: 'record-manual-pregame-action' }>
  | Readonly<{ readonly kind: 'complete-pregame-actions' }>
  | Readonly<{ readonly kind: 'set-ready'; readonly ready: boolean }>;

export type OnlinePregameCommandEnvelopeV1 = Readonly<{
  readonly kind: 'online-pregame-command-envelope-v1';
  readonly schemaVersion: 1;
  readonly roomId: string;
  readonly participantId: string;
  readonly participantCapability: string;
  readonly commandId: string;
  readonly baseRevision: number;
  readonly command: OnlinePregameCommandV1;
}>;

export type OnlinePregameResponseIssueV1 = Readonly<{
  readonly code:
    | 'INVALID_COMMAND'
    | 'ROOM_MISMATCH'
    | 'AUTHORIZATION_REJECTED'
    | 'PARTICIPANT_NOT_CONNECTED'
    | 'STALE_REVISION'
    | 'COMMAND_ID_REUSE_MISMATCH'
    | 'INVALID_PHASE'
    | 'ACTOR_MISMATCH'
    | 'INVALID_CHOICE'
    | 'PLAN_EXHAUSTED'
    | 'INVALID_BOTTOM'
    | 'CAPACITY_EXCEEDED'
    | 'INVALID_STATE';
  readonly path: string;
}>;

export type OnlinePregameCommandAckV1 = Readonly<{
  readonly kind: 'online-pregame-command-ack-v1';
  readonly schemaVersion: 1;
  readonly commandId: string;
  readonly acceptedRevision: number;
  readonly currentRevision: number;
  readonly duplicate: boolean;
}>;

export type OnlinePregameCommandRejectV1 = Readonly<{
  readonly kind: 'online-pregame-command-reject-v1';
  readonly schemaVersion: 1;
  readonly commandId: string | null;
  readonly currentRevision: number;
  readonly resyncRequired: boolean;
  readonly issues: readonly OnlinePregameResponseIssueV1[];
}>;

export type OnlinePregameCommandResponseV1 = OnlinePregameCommandAckV1 | OnlinePregameCommandRejectV1;

export type OnlinePregameJournalEntryV1 = Readonly<{
  readonly command: OnlinePregameCommandV1;
  readonly participantId: string;
  readonly baseRevision: number;
  readonly commandId: string;
  readonly requestDigest: string;
  readonly response: Readonly<{ readonly accepted: boolean; readonly revision: number; readonly duplicate: boolean }>;
}>;

export type OnlinePregameStateV1 = Readonly<{
  readonly kind: 'online-pregame-state-v1';
  readonly schemaVersion: 1;
  readonly protocolState: OnlineVariableProtocolStateV2;
  readonly randomPlan: OnlinePregameRandomPlanV1;
  readonly phase: OnlinePregamePhaseV1;
  readonly currentPlayerId: CorePlayerId | null;
  readonly mulliganRound: number;
  readonly players: readonly OnlinePregamePlayerV1[];
  readonly revision: number;
  readonly journal: readonly OnlinePregameJournalEntryV1[];
}>;

export type OnlinePregameProjectionPlayerV1 = Readonly<{
  readonly playerId: CorePlayerId;
  readonly commanderConfirmed: boolean;
  readonly mulliganDecision: 'pending' | 'mulligan' | 'keep';
  readonly mulligansTaken: number;
  readonly bottomCountRequired: number;
  readonly pendingBottomCount: number;
  readonly manualActionCount: number;
  readonly manualActionsComplete: boolean;
  readonly ready: boolean;
}>;

export type OnlinePregameProjectionV1 = Readonly<{
  readonly kind: 'online-pregame-projection-v1';
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly phase: OnlinePregamePhaseV1;
  readonly currentPlayerId: CorePlayerId | null;
  readonly startingPlayerId: CorePlayerId;
  readonly turnOrder: readonly CorePlayerId[];
  readonly players: readonly OnlinePregameProjectionPlayerV1[];
  readonly protocol: OnlineVariableParticipantProjectionV3;
}>;

export type OnlinePregameValidationIssueV1 = Readonly<{ readonly code: string; readonly path: string; readonly message: string }>;
export type OnlinePregameValidationResultV1<T> =
  | Readonly<{ readonly ok: true; readonly value: T }>
  | Readonly<{ readonly ok: false; readonly issues: readonly OnlinePregameValidationIssueV1[] }>;
export type OnlinePregameTransitionV1 = Readonly<{ readonly state: OnlinePregameStateV1; readonly response: OnlinePregameCommandResponseV1 }>;

export type OnlinePregameCoreRoot = ModeNeutralCoreRootV1;
