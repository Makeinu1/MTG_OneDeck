import type {
  CoreCommandV1,
  CoreDecisionContextV1,
  CorePlayerId,
} from '../../engine/core/index';
import type {
  OnlineProtocolCommandIdV1,
  OnlineProtocolParticipantCapabilityV1,
  OnlineProtocolRevisionV1,
  OnlineProtocolStateV1,
} from '../protocol/index';
import type {
  OnlineRoomIdV1,
  OnlineRoomParticipantIdV1,
  OnlineRoomPresenceV1,
} from '../room/index';
import type { BuildId } from '../../versioning/index';

export const ONLINE_HEADLESS_ROOM_GATE_SCHEMA_VERSION_V1 = 1 as const;

export type OnlineHeadlessRoomGateClientV1 = Readonly<{
  readonly participantId: OnlineRoomParticipantIdV1;
  readonly participantCapability: OnlineProtocolParticipantCapabilityV1;
  readonly clientBuildId: BuildId;
}>;

export type OnlineHeadlessRoomGateClientHelloActionV1 = Readonly<{
  readonly kind: 'client-hello';
  readonly participantId: OnlineRoomParticipantIdV1;
}>;

export type OnlineHeadlessRoomGateDisconnectActionV1 = Readonly<{
  readonly kind: 'disconnect';
  readonly participantId: OnlineRoomParticipantIdV1;
}>;

export type OnlineHeadlessRoomGateCommandActionV1 = Readonly<{
  readonly kind: 'command';
  readonly participantId: OnlineRoomParticipantIdV1;
  readonly commandId: OnlineProtocolCommandIdV1;
  readonly baseRevision: OnlineProtocolRevisionV1;
  readonly command: CoreCommandV1;
}>;

export type OnlineHeadlessRoomGateProjectionActionV1 = Readonly<{
  readonly kind: 'projection';
  readonly participantId: OnlineRoomParticipantIdV1;
  readonly knownRevision: OnlineProtocolRevisionV1;
  readonly decisionContext: CoreDecisionContextV1 | null;
}>;

export type OnlineHeadlessRoomGateActionV1 =
  | OnlineHeadlessRoomGateClientHelloActionV1
  | OnlineHeadlessRoomGateDisconnectActionV1
  | OnlineHeadlessRoomGateCommandActionV1
  | OnlineHeadlessRoomGateProjectionActionV1;

export type OnlineHeadlessRoomGateInputV1 = Readonly<{
  readonly kind: 'online-local-headless-room-gate-input-v1';
  readonly schemaVersion: typeof ONLINE_HEADLESS_ROOM_GATE_SCHEMA_VERSION_V1;
  readonly state: OnlineProtocolStateV1;
  readonly clients: readonly OnlineHeadlessRoomGateClientV1[];
  readonly actions: readonly OnlineHeadlessRoomGateActionV1[];
}>;

export type OnlineHeadlessRoomGateReportClientV1 = Readonly<{
  readonly participantId: OnlineRoomParticipantIdV1;
  readonly role: 'player' | 'table';
  readonly corePlayerId: CorePlayerId | null;
  readonly presence: OnlineRoomPresenceV1;
}>;

export type OnlineHeadlessRoomGateCountsV1 = Readonly<{
  readonly clientHellosAccepted: number;
  readonly clientHellosRejected: number;
  readonly commandsAccepted: number;
  readonly commandsRejected: number;
  readonly commandDuplicates: number;
  readonly staleRevisionRejections: number;
  readonly roleRejections: number;
  readonly projectionsAccepted: number;
  readonly projectionsRejected: number;
  readonly disconnects: number;
  readonly playerRejoins: number;
  readonly tableRejoins: number;
}>;

export type OnlineHeadlessRoomGateCoverageV1 = Readonly<{
  readonly fourPlayers: true;
  readonly tableDisplay: true;
  readonly allClientHellos: true;
  readonly allClientProjections: true;
  readonly acceptedCommand: true;
  readonly rejectedCommand: true;
  readonly duplicateCommand: true;
  readonly staleRevision: true;
  readonly roleIsolation: true;
  readonly playerReconnect: true;
  readonly tableReconnect: true;
  readonly privacyGate: true;
  readonly replay: true;
}>;

export type OnlineHeadlessRoomGateReportV1 = Readonly<{
  readonly kind: 'online-local-headless-room-gate-report-v1';
  readonly schemaVersion: typeof ONLINE_HEADLESS_ROOM_GATE_SCHEMA_VERSION_V1;
  readonly protocolVersion: 1;
  readonly roomId: OnlineRoomIdV1;
  readonly initialRevision: 0;
  readonly finalRevision: OnlineProtocolRevisionV1;
  readonly finalRoomLifecycle: 'active' | 'finished';
  readonly clients: readonly OnlineHeadlessRoomGateReportClientV1[];
  readonly counts: OnlineHeadlessRoomGateCountsV1;
  readonly coverage: OnlineHeadlessRoomGateCoverageV1;
  readonly deferred: readonly [
    'cloudflare',
    'worker',
    'durable-object',
    'sqlite',
    'websocket',
    'persistence',
    'ui',
  ];
}>;

export type OnlineHeadlessRoomGateTransitionV1 = Readonly<{
  readonly state: OnlineProtocolStateV1;
  readonly report: OnlineHeadlessRoomGateReportV1;
}>;

export type OnlineHeadlessRoomGateIssueCodeV1 =
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
  | 'INVALID_CLIENT_SET'
  | 'INVALID_ACTION'
  | 'INVALID_RELATION'
  | 'COMPOSITION_REJECTED'
  | 'COVERAGE_MISSING'
  | 'PRIVACY_REJECTED'
  | 'REPLAY_MISMATCH';

export type OnlineHeadlessRoomGateIssueV1 = Readonly<{
  readonly code: OnlineHeadlessRoomGateIssueCodeV1;
  readonly path: string;
  readonly message: string;
}>;

export type OnlineHeadlessRoomGateValidationResultV1<T> =
  | Readonly<{ readonly ok: true; readonly value: T }>
  | Readonly<{ readonly ok: false; readonly issues: readonly OnlineHeadlessRoomGateIssueV1[] }>;

export type OnlineHeadlessRoomGateInputValidationResultV1 =
  OnlineHeadlessRoomGateValidationResultV1<OnlineHeadlessRoomGateInputV1>;

export type OnlineHeadlessRoomGateReportValidationResultV1 =
  OnlineHeadlessRoomGateValidationResultV1<OnlineHeadlessRoomGateReportV1>;

export type OnlineHeadlessRoomGateOperationErrorCodeV1 =
  | 'INVALID_INPUT'
  | 'COMPOSITION_REJECTED'
  | 'COVERAGE_MISSING'
  | 'PRIVACY_REJECTED'
  | 'REPLAY_MISMATCH';
