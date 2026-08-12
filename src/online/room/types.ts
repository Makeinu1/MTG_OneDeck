import type { CorePlayerId, ModeNeutralCoreRootV1 } from '../../engine/core/index';

export const ONLINE_ROOM_SCHEMA_VERSION_V1 = 1 as const;

declare const onlineRoomIdBrandV1: unique symbol;
declare const onlineRoomParticipantIdBrandV1: unique symbol;
declare const onlineRoomSeatCapabilityBrandV1: unique symbol;

export type OnlineRoomIdV1 = string & { readonly [onlineRoomIdBrandV1]: true };
export type OnlineRoomParticipantIdV1 = string & {
  readonly [onlineRoomParticipantIdBrandV1]: true;
};
export type OnlineRoomSeatCapabilityV1 = string & {
  readonly [onlineRoomSeatCapabilityBrandV1]: true;
};

export type OnlineRoomSeatIndexV1 = 0 | 1 | 2 | 3;
export type OnlineRoomParticipantRoleV1 = 'player' | 'table' | 'spectator';
export type OnlineRoomPresenceV1 = 'connected' | 'disconnected';
export type OnlineRoomLifecycleV1 = 'forming' | 'ready' | 'started' | 'active' | 'finished';
export type OnlineRoomSeatOutcomeV1 = 'pending' | 'conceded' | 'defeated';

type OnlineRoomParticipantBaseV1 = Readonly<{
  readonly participantId: OnlineRoomParticipantIdV1;
  readonly presence: OnlineRoomPresenceV1;
}>;

export type OnlineRoomParticipantV1 =
  | Readonly<
      OnlineRoomParticipantBaseV1 & {
        readonly role: 'player';
        readonly seatIndex: OnlineRoomSeatIndexV1;
      }
    >
  | Readonly<
      OnlineRoomParticipantBaseV1 & {
        readonly role: 'table' | 'spectator';
        readonly seatIndex: null;
      }
    >;

export type OnlineRoomSeatV1 = Readonly<{
  readonly seatIndex: OnlineRoomSeatIndexV1;
  readonly corePlayerId: CorePlayerId;
  readonly seatCapability: OnlineRoomSeatCapabilityV1;
  readonly participantId: OnlineRoomParticipantIdV1 | null;
  readonly ready: boolean;
  readonly outcome: OnlineRoomSeatOutcomeV1;
}>;

export type OnlineRoomV1 = Readonly<{
  readonly kind: 'online-room-v1';
  readonly schemaVersion: typeof ONLINE_ROOM_SCHEMA_VERSION_V1;
  readonly roomId: OnlineRoomIdV1;
  readonly lifecycle: OnlineRoomLifecycleV1;
  readonly hostParticipantId: OnlineRoomParticipantIdV1;
  readonly participants: readonly OnlineRoomParticipantV1[];
  readonly seats: readonly OnlineRoomSeatV1[];
}>;

export type OnlineRoomValidationCodeV1 =
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
  | 'DUPLICATE_PARTICIPANT'
  | 'DUPLICATE_CORE_PLAYER'
  | 'DUPLICATE_CAPABILITY'
  | 'TOO_MANY_TABLES'
  | 'INVALID_RELATION'
  | 'LIFECYCLE_MISMATCH'
  | 'INVALID_LIFECYCLE'
  | 'PARTICIPANT_NOT_FOUND'
  | 'PARTICIPANT_ALREADY_EXISTS'
  | 'PARTICIPANT_ALREADY_DISCONNECTED'
  | 'PARTICIPANT_NOT_DISCONNECTED'
  | 'CAPABILITY_REJECTED'
  | 'TABLE_ALREADY_PRESENT'
  | 'HOST_AUTHORITY_REQUIRED'
  | 'PLAYER_NOT_CONNECTED'
  | 'PLAYER_NOT_PENDING'
  | 'INVALID_CORE_ROOT'
  | 'CORE_ROSTER_MISMATCH'
  | 'CORE_LIFECYCLE_MISMATCH'
  | 'OUTCOME_REGRESSION';

export type OnlineRoomValidationIssueV1 = Readonly<{
  readonly code: OnlineRoomValidationCodeV1;
  readonly path: string;
  readonly message: string;
}>;

export type OnlineRoomValidationResultV1 =
  | Readonly<{ readonly ok: true; readonly value: OnlineRoomV1 }>
  | Readonly<{ readonly ok: false; readonly issues: readonly OnlineRoomValidationIssueV1[] }>;

export type OnlineRoomSeatAssignmentV1 = Readonly<{
  readonly seatIndex: OnlineRoomSeatIndexV1;
  readonly corePlayerId: CorePlayerId;
  readonly seatCapability: OnlineRoomSeatCapabilityV1;
}>;

export type CreateOnlineRoomV1Input = Readonly<{
  readonly roomId: OnlineRoomIdV1;
  readonly seatAssignments: readonly [
    OnlineRoomSeatAssignmentV1,
    OnlineRoomSeatAssignmentV1,
    OnlineRoomSeatAssignmentV1,
    OnlineRoomSeatAssignmentV1,
  ];
  readonly host: Readonly<{
    readonly participantId: OnlineRoomParticipantIdV1;
    readonly seatCapability: OnlineRoomSeatCapabilityV1;
  }>;
}>;

export type JoinOnlineRoomV1Input =
  | Readonly<{
      readonly participantId: OnlineRoomParticipantIdV1;
      readonly role: 'player';
      readonly seatCapability: OnlineRoomSeatCapabilityV1;
    }>
  | Readonly<{
      readonly participantId: OnlineRoomParticipantIdV1;
      readonly role: 'table' | 'spectator';
    }>;

export type RejoinOnlineRoomPlayerV1Input = Readonly<{
  readonly participantId: OnlineRoomParticipantIdV1;
  readonly seatCapability: OnlineRoomSeatCapabilityV1;
}>;

export type SetOnlineRoomPlayerReadyV1Input = Readonly<{
  readonly participantId: OnlineRoomParticipantIdV1;
  readonly seatCapability: OnlineRoomSeatCapabilityV1;
  readonly ready: boolean;
}>;

export type ActivateOnlineRoomV1Input = Readonly<{
  readonly hostParticipantId: OnlineRoomParticipantIdV1;
  readonly coreRoot: ModeNeutralCoreRootV1;
}>;

export type OnlineRoomCreationInputV1 = CreateOnlineRoomV1Input;
export type OnlineRoomJoinInputV1 = JoinOnlineRoomV1Input;
export type OnlineRoomPlayerRejoinInputV1 = RejoinOnlineRoomPlayerV1Input;
export type OnlineRoomPlayerReadyInputV1 = SetOnlineRoomPlayerReadyV1Input;
export type OnlineRoomActivationInputV1 = ActivateOnlineRoomV1Input;
