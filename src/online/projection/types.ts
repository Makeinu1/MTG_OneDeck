import type {
  CoreCardDefinitionSnapshotV1,
  CoreDecisionContextV1,
  CoreManaPoolV1,
  CoreObjectId,
  CoreObjectIdKindV2,
  CorePlayerExitCauseV1,
  CorePlayerId,
  CorePlayerLifecycleStatusV1,
  CoreRuleZoneRefV1,
  CoreSearchCriteriaV1,
  CoreSearchPortionV1,
} from '../../engine/core/index';
import type {
  OnlineProtocolParticipantCapabilityV1,
  OnlineProtocolRevisionV1,
  OnlineResyncReasonV1,
  OnlineProtocolStateV1,
} from '../protocol/index';
import type {
  OnlineRoomIdV1,
  OnlineRoomLifecycleV1,
  OnlineRoomParticipantIdV1,
  OnlineRoomParticipantRoleV1,
  OnlineRoomPresenceV1,
  OnlineRoomSeatIndexV1,
  OnlineRoomSeatOutcomeV1,
} from '../room/index';
import type { BuildId } from '../../versioning/index';

export const ONLINE_PROJECTION_SCHEMA_VERSION_V1 = 1 as const;

export type OnlineProjectionIssueCodeV1 =
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
  | 'PROTOCOL_VERSION_MISMATCH'
  | 'AUTHORIZATION_REJECTED'
  | 'PROJECTION_REJECTED'
  | 'INVALID_PROTOCOL_STATE'
  | 'INVALID_RELATION'
  | 'DUPLICATE_VALUE';

export type OnlineProjectionIssueV1 = Readonly<{
  readonly code: OnlineProjectionIssueCodeV1;
  readonly path: string;
  readonly message: string;
}>;

export type OnlineProjectionValidationResultV1<T> =
  | Readonly<{ readonly ok: true; readonly value: T }>
  | Readonly<{ readonly ok: false; readonly issues: readonly OnlineProjectionIssueV1[] }>;

export type OnlineProjectionRequestV1 = Readonly<{
  readonly kind: 'online-projection-request-v1';
  readonly protocolVersion: number;
  readonly roomId: OnlineRoomIdV1;
  readonly participantId: OnlineRoomParticipantIdV1;
  readonly participantCapability: OnlineProtocolParticipantCapabilityV1;
  readonly knownRevision: OnlineProtocolRevisionV1;
  readonly clientBuildId: BuildId;
  readonly decisionContext: CoreDecisionContextV1 | null;
}>;

export type OnlineProjectionRequestValidationResultV1 =
  OnlineProjectionValidationResultV1<OnlineProjectionRequestV1>;

export type OnlineProjectedAttachmentV1 =
  | Readonly<{ readonly kind: 'none' }>
  | Readonly<{ readonly kind: 'player'; readonly playerId: CorePlayerId }>
  | Readonly<{ readonly kind: 'object'; readonly objectId: CoreObjectId }>
  | Readonly<{ readonly kind: 'concealed' }>;

export type OnlineProjectedObjectRuntimeV1 = Readonly<{
  readonly faceIndex: number | null;
  readonly faceDown: boolean;
  readonly tapped: boolean;
  readonly flipped: boolean | null;
  readonly phasedOut: boolean;
  readonly counters: readonly Readonly<{ readonly kind: string; readonly count: number }>[];
  readonly markedDamage: number;
  readonly attachment: OnlineProjectedAttachmentV1;
}>;

export type OnlineProjectedHiddenCardV1 = Readonly<{ readonly kind: 'hidden-card' }>;
export type OnlineProjectedConcealedObjectV1 = Readonly<{
  readonly kind: 'concealed-object';
  readonly objectId: CoreObjectId;
  readonly objectKind: CoreObjectIdKindV2;
  readonly runtime: OnlineProjectedObjectRuntimeV1;
}>;
export type OnlineProjectedVisibleObjectV1 = Readonly<{
  readonly kind: 'visible-object';
  readonly objectId: CoreObjectId;
  readonly objectKind: CoreObjectIdKindV2;
  readonly ownerPlayerId: CorePlayerId | null;
  readonly controllerPlayerId: CorePlayerId | null;
  readonly commander: boolean;
  readonly definition: CoreCardDefinitionSnapshotV1 | null;
  readonly runtime: OnlineProjectedObjectRuntimeV1 | null;
}>;
export type OnlineProjectedZoneEntryV1 =
  | OnlineProjectedHiddenCardV1
  | OnlineProjectedConcealedObjectV1
  | OnlineProjectedVisibleObjectV1;

export type OnlineProjectedZoneV1 = Readonly<{
  readonly count: number;
  readonly entries: readonly OnlineProjectedZoneEntryV1[];
}>;
export type OnlineProjectedPlayerZonesV1 = Readonly<{
  readonly library: OnlineProjectedZoneV1;
  readonly hand: OnlineProjectedZoneV1;
  readonly graveyard: OnlineProjectedZoneV1;
}>;
export type OnlineProjectedPlayerZoneGroupV1 = Readonly<{
  readonly playerId: CorePlayerId;
  readonly zones: OnlineProjectedPlayerZonesV1;
}>;
export type OnlineProjectedZonesV1 = Readonly<{
  readonly byPlayer: readonly OnlineProjectedPlayerZoneGroupV1[];
  readonly battlefield: OnlineProjectedZoneV1;
  readonly stack: OnlineProjectedZoneV1;
  readonly exile: OnlineProjectedZoneV1;
  readonly command: OnlineProjectedZoneV1;
}>;

export type OnlineProjectedPlayerV1 = Readonly<{
  readonly playerId: CorePlayerId;
  readonly life: number;
  readonly poison: number;
  readonly energy: number;
  readonly experience: number;
  readonly manaPool: CoreManaPoolV1;
  readonly mulliganCount: number;
  readonly landsPlayedThisTurn: number;
  readonly spellsCastThisTurn: number;
  readonly drawnThisTurn: number;
  readonly maximumHandSizeOverride: number | 'none' | null;
  readonly status: CorePlayerLifecycleStatusV1;
  readonly exitCause: CorePlayerExitCauseV1 | null;
}>;

export type OnlineProjectedTurnV1 = Readonly<{
  readonly activePlayerId: CorePlayerId;
  readonly turnNumber: number;
  readonly positionSequence: number;
  readonly position: Readonly<{
    readonly phase: 'beginning' | 'precombat-main' | 'combat' | 'postcombat-main' | 'ending';
    readonly step: string | null;
  }>;
}>;

export type OnlineProjectedDurationV1 =
  | Readonly<{ readonly kind: 'indefinite' }>
  | Readonly<{ readonly kind: 'until-end-of-turn'; readonly turnNumber: number }>
  | Readonly<{ readonly kind: 'source-bound' }>
  | Readonly<{ readonly kind: 'single-use' }>
  | Readonly<{ readonly kind: 'manual' }>;

export type OnlineProjectedVisibilitySubjectV1 =
  | Readonly<{ readonly kind: 'object'; readonly objectId: CoreObjectId }>
  | Readonly<{ readonly kind: 'zone'; readonly zone: CoreRuleZoneRefV1 }>
  | Readonly<{
      readonly kind: 'top-of-library';
      readonly playerId: CorePlayerId;
      readonly count: number;
    }>;
export type OnlineProjectedVisibilityGrantV1 = Readonly<{
  readonly effectiveForPlayerIds: readonly CorePlayerId[];
  readonly mode: 'look' | 'reveal';
  readonly subject: OnlineProjectedVisibilitySubjectV1;
  readonly duration: OnlineProjectedDurationV1;
}>;

export type OnlineProjectedSearchSessionV1 = Readonly<{
  readonly sessionId: string;
  readonly rulesActorPlayerId: CorePlayerId;
  readonly selectorPlayerId: CorePlayerId;
  readonly zone: CoreRuleZoneRefV1;
  readonly portion: CoreSearchPortionV1;
  readonly criteria: CoreSearchCriteriaV1;
  readonly revealFound: boolean;
  readonly shuffleAfter: boolean;
  readonly candidates: readonly OnlineProjectedVisibleObjectV1[];
}>;

export type OnlineProjectedPlayPermissionSubjectV1 =
  | Readonly<{
      readonly kind: 'object';
      readonly objectId: CoreObjectId;
      readonly expectedZone: CoreRuleZoneRefV1;
    }>
  | Readonly<{
      readonly kind: 'top-of-library';
      readonly playerId: CorePlayerId;
      readonly topObjectId: CoreObjectId | null;
    }>;
export type OnlineProjectedPlayPermissionV1 = Readonly<{
  readonly permissionId: string;
  readonly allowedPlayerId: CorePlayerId;
  readonly action: 'cast-spell' | 'play-land' | 'play-card';
  readonly subject: OnlineProjectedPlayPermissionSubjectV1;
  readonly duration: OnlineProjectedDurationV1;
}>;

export type OnlineProjectedParticipantV1 = Readonly<{
  readonly participantId: OnlineRoomParticipantIdV1;
  readonly role: OnlineRoomParticipantRoleV1;
  readonly presence: OnlineRoomPresenceV1;
  readonly seatIndex: OnlineRoomSeatIndexV1 | null;
}>;
export type OnlineProjectedSeatV1 = Readonly<{
  readonly seatIndex: OnlineRoomSeatIndexV1;
  readonly corePlayerId: CorePlayerId;
  readonly participantId: OnlineRoomParticipantIdV1 | null;
  readonly ready: boolean;
  readonly outcome: OnlineRoomSeatOutcomeV1;
}>;
export type OnlineProjectedRoomV1 = Readonly<{
  readonly lifecycle: OnlineRoomLifecycleV1;
  readonly hostParticipantId: OnlineRoomParticipantIdV1;
  readonly participants: readonly OnlineProjectedParticipantV1[];
  readonly seats: readonly OnlineProjectedSeatV1[];
}>;

export type OnlineProjectedGameV1 = Readonly<{
  readonly turnOrder: readonly CorePlayerId[];
  readonly turn: OnlineProjectedTurnV1;
  readonly players: readonly OnlineProjectedPlayerV1[];
  readonly zones: OnlineProjectedZonesV1;
  readonly visibilityGrants: readonly OnlineProjectedVisibilityGrantV1[];
  readonly searchSessions: readonly OnlineProjectedSearchSessionV1[];
  readonly playPermissions: readonly OnlineProjectedPlayPermissionV1[];
}>;

export type OnlineParticipantProjectionV1 = Readonly<{
  readonly kind: 'online-participant-projection-v1';
  readonly schemaVersion: typeof ONLINE_PROJECTION_SCHEMA_VERSION_V1;
  readonly protocolVersion: number;
  readonly roomId: OnlineRoomIdV1;
  readonly participantId: OnlineRoomParticipantIdV1;
  readonly role: OnlineRoomParticipantRoleV1;
  readonly corePlayerId: CorePlayerId | null;
  readonly revision: OnlineProtocolRevisionV1;
  readonly room: OnlineProjectedRoomV1;
  readonly game: OnlineProjectedGameV1;
}>;
export type OnlineParticipantProjectionValidationResultV1 =
  OnlineProjectionValidationResultV1<OnlineParticipantProjectionV1>;

type OnlineProjectedSnapshotBaseV1 = Readonly<{
  readonly kind: 'online-projected-snapshot-v1';
  readonly protocolVersion: number;
  readonly revision: OnlineProtocolRevisionV1;
  readonly serverBuildId: BuildId;
}>;
export type OnlineProjectedSnapshotAcceptedV1 = Readonly<
  OnlineProjectedSnapshotBaseV1 & {
    readonly status: 'accepted';
    readonly roomId: OnlineRoomIdV1;
    readonly participantId: OnlineRoomParticipantIdV1;
    readonly role: OnlineRoomParticipantRoleV1;
    readonly knownRevision: OnlineProtocolRevisionV1;
    readonly clientBuildIdMatch: boolean;
    readonly reason: OnlineResyncReasonV1;
    readonly projection: OnlineParticipantProjectionV1;
    readonly issues: readonly [];
  }
>;
export type OnlineProjectedSnapshotRejectedV1 = Readonly<
  OnlineProjectedSnapshotBaseV1 & {
    readonly status: 'rejected';
    readonly roomId: null;
    readonly participantId: null;
    readonly role: null;
    readonly knownRevision: null;
    readonly clientBuildIdMatch: null;
    readonly reason: null;
    readonly projection: null;
    readonly issues: readonly OnlineProjectionIssueV1[];
  }
>;
export type OnlineProjectedSnapshotResponseV1 =
  | OnlineProjectedSnapshotAcceptedV1
  | OnlineProjectedSnapshotRejectedV1;

export type OnlineProjectionLogEntryV1 = Readonly<{
  readonly kind: 'online-projection-log-v1';
  readonly status: 'accepted' | 'rejected';
  readonly revision: OnlineProtocolRevisionV1;
  readonly role: OnlineRoomParticipantRoleV1 | null;
  readonly reason: OnlineResyncReasonV1 | null;
  readonly issueCodes: readonly OnlineProjectionIssueCodeV1[];
}>;

export type OnlineProjectedSnapshotTransitionV1 = Readonly<{
  readonly state: OnlineProtocolStateV1;
  readonly response: OnlineProjectedSnapshotResponseV1;
  readonly log: OnlineProjectionLogEntryV1;
}>;
