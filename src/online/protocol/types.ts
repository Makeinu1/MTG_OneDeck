import type { CoreCommandV1, ModeNeutralCoreRootV1 } from '../../engine/core/index';
import type {
  OnlineRoomIdV1,
  OnlineRoomParticipantIdV1,
  OnlineRoomParticipantRoleV1,
  OnlineRoomSeatCapabilityV1,
  OnlineRoomV1,
} from '../room/index';
import type { BuildId } from '../../versioning/index';

export const ONLINE_PROTOCOL_SCHEMA_VERSION_V1 = 1 as const;

declare const onlineProtocolCommandIdBrandV1: unique symbol;
declare const onlineProtocolObserverCapabilityBrandV1: unique symbol;

export type OnlineProtocolCommandIdV1 = string & {
  readonly [onlineProtocolCommandIdBrandV1]: true;
};

export type OnlineProtocolObserverCapabilityV1 = string & {
  readonly [onlineProtocolObserverCapabilityBrandV1]: true;
};

export type OnlineProtocolParticipantCapabilityV1 =
  | OnlineRoomSeatCapabilityV1
  | OnlineProtocolObserverCapabilityV1;

export type OnlineProtocolRevisionV1 = number;

export type OnlineProtocolIssueCodeV1 =
  | 'INVALID_ROOT'
  | 'MISSING_FIELD'
  | 'UNKNOWN_FIELD'
  | 'INVALID_DESCRIPTOR'
  | 'INVALID_TYPE'
  | 'INVALID_LITERAL'
  | 'INVALID_VERSION'
  | 'INVALID_ID'
  | 'INVALID_CAPABILITY'
  | 'INVALID_INTEGER'
  | 'INVALID_ARRAY'
  | 'NON_DENSE_ARRAY'
  | 'INVALID_BUILD_ID'
  | 'INVALID_PROTOCOL_STATE'
  | 'PROTOCOL_VERSION_MISMATCH'
  | 'ROOM_MISMATCH'
  | 'AUTHORIZATION_REJECTED'
  | 'PARTICIPANT_NOT_CONNECTED'
  | 'ROLE_NOT_ALLOWED'
  | 'ROOM_NOT_ACTIVE'
  | 'PLAYER_NOT_PENDING'
  | 'ACTOR_MISMATCH'
  | 'COMMAND_SEQUENCE_MISMATCH'
  | 'COMMAND_ID_REUSE_MISMATCH'
  | 'STALE_REVISION'
  | 'CORE_COMMAND_REJECTED'
  | 'CORE_RECONCILIATION_REJECTED';

export type OnlineProtocolIssueV1 = Readonly<{
  readonly code: OnlineProtocolIssueCodeV1;
  readonly path: string;
  readonly message: string;
}>;

export type OnlineProtocolValidationResultV1<T> =
  | Readonly<{ readonly ok: true; readonly value: T }>
  | Readonly<{ readonly ok: false; readonly issues: readonly OnlineProtocolIssueV1[] }>;

export type OnlineProtocolObserverAuthorizationV1 = Readonly<{
  readonly participantId: OnlineRoomParticipantIdV1;
  readonly observerCapability: OnlineProtocolObserverCapabilityV1;
}>;

export type OnlineProtocolAcceptedReceiptOutcomeV1 = Readonly<{
  readonly kind: 'accepted';
  readonly roomId: OnlineRoomIdV1;
  readonly baseRevision: OnlineProtocolRevisionV1;
  readonly acceptedRevision: OnlineProtocolRevisionV1;
  readonly status: 'accepted' | 'accepted-with-warning';
}>;

export type OnlineProtocolRejectedReceiptOutcomeV1 = Readonly<{
  readonly kind: 'rejected';
  readonly roomId: OnlineRoomIdV1;
  readonly baseRevision: OnlineProtocolRevisionV1;
  readonly resyncRequired: boolean;
  readonly issues: readonly OnlineProtocolIssueV1[];
}>;

export type OnlineProtocolCommandReceiptOutcomeV1 =
  | OnlineProtocolAcceptedReceiptOutcomeV1
  | OnlineProtocolRejectedReceiptOutcomeV1;

export type OnlineProtocolCommandReceiptV1 = Readonly<{
  readonly participantId: OnlineRoomParticipantIdV1;
  readonly commandId: OnlineProtocolCommandIdV1;
  readonly requestDigest: string;
  readonly outcome: OnlineProtocolCommandReceiptOutcomeV1;
}>;

export type OnlineProtocolStateV1 = Readonly<{
  readonly kind: 'online-protocol-state-v1';
  readonly schemaVersion: typeof ONLINE_PROTOCOL_SCHEMA_VERSION_V1;
  readonly protocolVersion: number;
  readonly serverBuildId: BuildId;
  readonly room: OnlineRoomV1;
  readonly coreRoot: ModeNeutralCoreRootV1;
  readonly revision: OnlineProtocolRevisionV1;
  readonly observerAuthorizations: readonly OnlineProtocolObserverAuthorizationV1[];
  readonly receipts: readonly OnlineProtocolCommandReceiptV1[];
}>;

export type CreateOnlineProtocolStateV1Input = Readonly<{
  readonly serverBuildId: BuildId;
  readonly room: OnlineRoomV1;
  readonly coreRoot: ModeNeutralCoreRootV1;
  readonly observerAuthorizations: readonly OnlineProtocolObserverAuthorizationV1[];
}>;

export type OnlineClientHelloV1 = Readonly<{
  readonly kind: 'online-client-hello-v1';
  readonly protocolVersion: number;
  readonly roomId: OnlineRoomIdV1;
  readonly participantId: OnlineRoomParticipantIdV1;
  readonly participantCapability: OnlineProtocolParticipantCapabilityV1;
  readonly clientBuildId: BuildId;
}>;

export type OnlineCommandEnvelopeV1 = Readonly<{
  readonly kind: 'online-command-envelope-v1';
  readonly protocolVersion: number;
  readonly roomId: OnlineRoomIdV1;
  readonly participantId: OnlineRoomParticipantIdV1;
  readonly participantCapability: OnlineRoomSeatCapabilityV1;
  readonly commandId: OnlineProtocolCommandIdV1;
  readonly baseRevision: OnlineProtocolRevisionV1;
  readonly command: CoreCommandV1;
}>;

export type OnlineSnapshotRequestV1 = Readonly<{
  readonly kind: 'online-snapshot-request-v1';
  readonly protocolVersion: number;
  readonly roomId: OnlineRoomIdV1;
  readonly participantId: OnlineRoomParticipantIdV1;
  readonly participantCapability: OnlineProtocolParticipantCapabilityV1;
  readonly knownRevision: OnlineProtocolRevisionV1;
  readonly clientBuildId: BuildId;
}>;

type OnlineServerHelloBaseV1 = Readonly<{
  readonly kind: 'online-server-hello-v1';
  readonly protocolVersion: number;
  readonly revision: OnlineProtocolRevisionV1;
  readonly serverBuildId: BuildId;
}>;

export type OnlineServerHelloAcceptedV1 = Readonly<
  OnlineServerHelloBaseV1 & {
    readonly status: 'accepted';
    readonly roomId: OnlineRoomIdV1;
    readonly participantId: OnlineRoomParticipantIdV1;
    readonly role: OnlineRoomParticipantRoleV1;
    readonly clientBuildIdMatch: boolean;
    readonly issues: readonly [];
  }
>;

export type OnlineServerHelloRejectedV1 = Readonly<
  OnlineServerHelloBaseV1 & {
    readonly status: 'rejected';
    readonly roomId: null;
    readonly participantId: null;
    readonly role: null;
    readonly clientBuildIdMatch: null;
    readonly issues: readonly OnlineProtocolIssueV1[];
  }
>;

export type OnlineServerHelloV1 = OnlineServerHelloAcceptedV1 | OnlineServerHelloRejectedV1;

export type OnlineCommandAckV1 = Readonly<{
  readonly kind: 'online-command-ack-v1';
  readonly protocolVersion: number;
  readonly roomId: OnlineRoomIdV1;
  readonly participantId: OnlineRoomParticipantIdV1;
  readonly commandId: OnlineProtocolCommandIdV1;
  readonly baseRevision: OnlineProtocolRevisionV1;
  readonly acceptedRevision: OnlineProtocolRevisionV1;
  readonly currentRevision: OnlineProtocolRevisionV1;
  readonly status: 'accepted' | 'accepted-with-warning';
  readonly duplicate: boolean;
}>;

export type OnlineCommandRejectV1 = Readonly<{
  readonly kind: 'online-command-reject-v1';
  readonly protocolVersion: number;
  readonly roomId: OnlineRoomIdV1 | null;
  readonly participantId: OnlineRoomParticipantIdV1 | null;
  readonly commandId: OnlineProtocolCommandIdV1 | null;
  readonly baseRevision: OnlineProtocolRevisionV1 | null;
  readonly currentRevision: OnlineProtocolRevisionV1;
  readonly duplicate: boolean;
  readonly resyncRequired: boolean;
  readonly issues: readonly OnlineProtocolIssueV1[];
}>;

export type OnlineResyncReasonV1 = 'synchronized' | 'snapshot-required' | 'rejoined';

export type OnlineResyncV1 = Readonly<{
  readonly kind: 'online-resync-v1';
  readonly protocolVersion: number;
  readonly roomId: OnlineRoomIdV1;
  readonly participantId: OnlineRoomParticipantIdV1;
  readonly role: OnlineRoomParticipantRoleV1;
  readonly knownRevision: OnlineProtocolRevisionV1;
  readonly revision: OnlineProtocolRevisionV1;
  readonly serverBuildId: BuildId;
  readonly clientBuildIdMatch: boolean;
  readonly reason: OnlineResyncReasonV1;
  readonly projectionRequired: boolean;
}>;

export type OnlineProtocolTransitionV1<Response> = Readonly<{
  readonly state: OnlineProtocolStateV1;
  readonly response: Response;
}>;

export type OnlineClientHelloTransitionV1 = OnlineProtocolTransitionV1<OnlineServerHelloV1>;
export type OnlineCommandTransitionV1 = OnlineProtocolTransitionV1<
  OnlineCommandAckV1 | OnlineCommandRejectV1
>;
export type OnlineSnapshotTransitionV1 = OnlineProtocolTransitionV1<
  OnlineResyncV1 | OnlineCommandRejectV1
>;

export type OnlineClientHelloValidationResultV1 =
  OnlineProtocolValidationResultV1<OnlineClientHelloV1>;
export type OnlineCommandEnvelopeValidationResultV1 =
  OnlineProtocolValidationResultV1<OnlineCommandEnvelopeV1>;
export type OnlineSnapshotRequestValidationResultV1 =
  OnlineProtocolValidationResultV1<OnlineSnapshotRequestV1>;
export type OnlineProtocolStateValidationResultV1 =
  OnlineProtocolValidationResultV1<OnlineProtocolStateV1>;
