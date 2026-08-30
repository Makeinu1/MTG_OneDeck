import type {
  OnlineParticipantProjectionV1,
  OnlineProjectionIssueCodeV1,
} from '../projection/index';
import type {
  OnlineCommandEnvelopeV1,
  OnlineProtocolCommandIdV1,
  OnlineProtocolIssueCodeV1,
  OnlineProtocolParticipantCapabilityV1,
  OnlineProtocolRevisionV1,
} from '../protocol/index';
import type { OnlineRoomIdV1, OnlineRoomParticipantIdV1 } from '../room/index';
import type { BuildId } from '../../versioning/index';
import type { OnlineTabletopIntentEnvelopeV1 } from '../tabletopManual/types';
import type { OnlineVisibilityIntentEnvelopeV1 } from '../visibilityDecisions/types';

export const ONLINE_BROWSER_CLIENT_SCHEMA_VERSION_V1 = 1 as const;
export const ONLINE_BROWSER_MAX_OUTBOX_ENTRIES_V1 = 64 as const;
export const ONLINE_BROWSER_RECONNECT_DELAYS_MS_V1 = Object.freeze([
  250,
  500,
  1000,
  2000,
  4000,
  8000,
] as const);

export type OnlineBrowserPhaseV1 =
  | 'idle'
  | 'connecting'
  | 'awaiting-ready'
  | 'authenticating'
  | 'resyncing'
  | 'open'
  | 'recovering'
  | 'failed'
  | 'closed';

export interface OnlineBrowserSocketV1 {
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: Readonly<{ readonly data: unknown }>) => void) | null;
  onclose: ((event: Readonly<{ readonly code: number; readonly reason: string; readonly wasClean: boolean }>) => void) | null;
  onerror: ((event: unknown) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export type OnlineBrowserSocketFactoryV1 = (url: string) => OnlineBrowserSocketV1;
export type OnlineBrowserScheduleHandleV1 = object | number | string | undefined;
export type OnlineBrowserScheduleV1 = (
  delayMs: number,
  task: () => void,
) => OnlineBrowserScheduleHandleV1;
export type OnlineBrowserCancelScheduleV1 = (handle: OnlineBrowserScheduleHandleV1) => void;

export type OnlineBrowserCommandIntentV1 = Readonly<{
  readonly commandId: OnlineProtocolCommandIdV1;
  readonly baseRevision: OnlineProtocolRevisionV1;
  readonly command: OnlineCommandEnvelopeV1['command'];
}>;

export type OnlineBrowserTabletopIntentV1 = OnlineTabletopIntentEnvelopeV1;
export type OnlineBrowserVisibilityIntentV1 = OnlineVisibilityIntentEnvelopeV1;
/** Client payload for the server-owned shared undo intent. Transport context
 * and participant capability are supplied by the configured client. */
export type OnlineBrowserSharedUndoIntentV1 = Readonly<{
  readonly kind: 'online-shared-undo-intent-v1';
  readonly schemaVersion: 1;
  readonly commandId: string;
  readonly baseRevision: OnlineProtocolRevisionV1;
}>;
/** Public combat fact; physical card identity is intentionally absent. */
export type OnlineBrowserManualCombatDamageIntentV1 = Readonly<{
  readonly kind: 'online-manual-combat-damage-intent-v1';
  readonly schemaVersion: 1;
  readonly commandId: string;
  readonly baseRevision: OnlineProtocolRevisionV1;
  readonly defendingPlayerId: string;
  readonly damage: number;
  readonly commanderObjectId: string | null;
}>;

export type OnlineBrowserPendingCommandV1 = Readonly<{
  readonly commandId: OnlineProtocolCommandIdV1;
  readonly baseRevision: OnlineProtocolRevisionV1;
}>;

export type OnlineBrowserSubmitErrorCodeV1 =
  | 'INVALID_COMMAND'
  | 'OUTBOX_FULL'
  | 'COMMAND_ID_REUSE';

export type OnlineBrowserSubmitResultV1 =
  | Readonly<{ readonly ok: true }>
  | Readonly<{ readonly ok: false; readonly code: OnlineBrowserSubmitErrorCodeV1 }>;

export type OnlineBrowserIssueCodeV1 =
  | 'INVALID_CONFIG'
  | 'INVALID_URL'
  | 'INVALID_FRAME'
  | 'INVALID_COMMAND'
  | 'AUTHENTICATION_REJECTED'
  | 'PROJECTION_REJECTED'
  | 'SOCKET_ERROR'
  | 'SOCKET_CLOSED'
  | 'SEND_FAILED'
  | 'RECONNECT_EXHAUSTED'
  | OnlineProtocolIssueCodeV1
  | OnlineProjectionIssueCodeV1;

export type OnlineBrowserStateV1 = Readonly<{
  readonly phase: OnlineBrowserPhaseV1;
  readonly roomId: OnlineRoomIdV1;
  readonly participantId: OnlineRoomParticipantIdV1;
  readonly connectionEpoch: number;
  readonly knownRevision: OnlineProtocolRevisionV1;
  readonly projection: OnlineParticipantProjectionV1 | null;
  readonly pendingCommands: readonly OnlineBrowserPendingCommandV1[];
  readonly recoveryAttempt: number;
  readonly issueCode: OnlineBrowserIssueCodeV1 | null;
}>;

export type OnlineBrowserSubscriptionV1 = (snapshot: OnlineBrowserStateV1) => void;
export type OnlineBrowserUnsubscribeV1 = () => void;

export type OnlineBrowserWebSocketClientV1 = Readonly<{
  readonly connect: () => void;
  readonly disconnect: () => void;
  readonly submit: (intent: OnlineBrowserCommandIntentV1) => OnlineBrowserSubmitResultV1;
  readonly submitTabletop: (intent: OnlineBrowserTabletopIntentV1) => OnlineBrowserSubmitResultV1;
  readonly submitVisibility: (intent: OnlineBrowserVisibilityIntentV1) => OnlineBrowserSubmitResultV1;
  readonly submitSharedUndo: (intent: OnlineBrowserSharedUndoIntentV1) => OnlineBrowserSubmitResultV1;
  readonly submitManualCombatDamage: (intent: OnlineBrowserManualCombatDamageIntentV1) => OnlineBrowserSubmitResultV1;
  readonly getSnapshot: () => OnlineBrowserStateV1;
  readonly subscribe: (
    listener: OnlineBrowserSubscriptionV1,
  ) => OnlineBrowserUnsubscribeV1;
}>;

export type OnlineBrowserWebSocketClientConfigV1 = Readonly<{
  readonly webSocketUrl: string;
  readonly protocolVersion: number;
  readonly roomId: OnlineRoomIdV1;
  readonly participantId: OnlineRoomParticipantIdV1;
  readonly participantCapability: OnlineProtocolParticipantCapabilityV1;
  readonly clientBuildId: BuildId;
  readonly socketFactory?: OnlineBrowserSocketFactoryV1;
  readonly schedule?: OnlineBrowserScheduleV1;
  readonly cancelSchedule?: OnlineBrowserCancelScheduleV1;
}>;

// Short aliases keep the public v1 surface discoverable without introducing
// unversioned protocol names.
export type OnlineBrowserClientConfigV1 = OnlineBrowserWebSocketClientConfigV1;
export type OnlineBrowserClientV1 = OnlineBrowserWebSocketClientV1;
export type OnlineBrowserState = OnlineBrowserStateV1;
export type OnlineBrowserCommandIntent = OnlineBrowserCommandIntentV1;
