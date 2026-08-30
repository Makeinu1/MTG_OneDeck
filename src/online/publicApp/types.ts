import type { OnlineParticipantProjectionV1 } from '../projection/index';
import type { OnlineBrowserStateV1 } from '../browser/index';
import type { SavedDeckEntry } from '../../data/savedDecks';
import type { OnlinePregameCommandV1, OnlinePregameProjectionV1 } from '../pregame/index';
import type { OnlineTabletopIntentEnvelopeV1 } from '../tabletopManual/index';
import type { OnlineVisibilityIntentEnvelopeV1 } from '../visibilityDecisions/index';

export const PUBLIC_ONLINE_ERROR_V1 = 'オンライン操作を完了できませんでした。' as const;

export type PublicOnlineDeckOptionV1 = Readonly<{
  readonly id: string;
  readonly name: string;
  readonly deckText: string;
}>;

export type PublicOnlineModeV1 = 'entry' | 'forming' | 'started' | 'failed';
export type PublicOnlineConnectionStateV1 =
  | 'connecting'
  | 'updating'
  | 'ready'
  | 'offline'
  | 'failed';

export type PublicOnlineSnapshotV1 = Readonly<{
  readonly mode: PublicOnlineModeV1;
  readonly roomId: string | null;
  readonly participantId: string | null;
  readonly isHost: boolean;
  readonly lifecycle: 'forming' | 'ready' | 'started' | null;
  readonly projection: Readonly<Record<string, unknown>> | null;
  readonly invites: readonly string[];
  readonly selectedDeckId: string;
  readonly busy: 'create' | 'join' | 'refresh' | 'deck' | 'ready' | 'start' | null;
  readonly connection: PublicOnlineConnectionStateV1;
  readonly player: OnlineBrowserStateV1 | null;
  readonly table: OnlineBrowserStateV1 | null;
  readonly error: string | null;
}>;

export type PublicOnlineControllerV1 = Readonly<{
  readonly getSnapshot: () => PublicOnlineSnapshotV1;
  readonly subscribe: (listener: (snapshot: PublicOnlineSnapshotV1) => void) => () => void;
  readonly create: () => Promise<void>;
  readonly join: (roomId: string, inviteCapability: string) => Promise<void>;
  readonly refresh: () => Promise<void>;
  readonly submitDeck: (deck: PublicOnlineDeckOptionV1) => Promise<void>;
  readonly toggleReady: () => Promise<void>;
  readonly start: () => Promise<void>;
  readonly copyInvite: (invite: string) => Promise<void>;
  readonly submitPersonalAction: (action: unknown) => void;
  readonly submitGuidedAction: (action: unknown) => void;
  readonly disconnect: () => void;
}>;

export type PublicOnlineValidationResultV1<T> =
  | Readonly<{ readonly ok: true; readonly value: T }>
  | Readonly<{ readonly ok: false }>;

export type PublicOnlineProjectionV1 = OnlineParticipantProjectionV1;

export type PublicOnlineDeckOptionV2 = Readonly<{
  readonly id: string;
  readonly name: string;
  readonly entries: readonly SavedDeckEntry[];
}>;
export type PublicOnlineIssueV2 = Readonly<{
  readonly code: string;
  readonly entryIndex: number | null;
  readonly retryable: boolean;
  readonly message: string;
}>;
export type PublicOnlineErrorIssueV2 = Readonly<{
  readonly code: string;
  readonly retryable: boolean;
  readonly message: string;
  readonly correlationId: string;
  readonly action: string;
}>;
export type PublicOnlineSeatV2 = Readonly<{
  readonly seatIndex: 0 | 1 | 2 | 3;
  readonly corePlayerId: 'P1' | 'P2' | 'P3' | 'P4';
  readonly participantId: string | null;
  readonly deckState: 'none' | 'resolving' | 'accepted' | 'needs-attention';
  readonly ready: boolean;
}>;
export type PublicOnlineProjectionV2 = Readonly<{
  readonly kind: 'online-forming-lobby-projection-v2';
  readonly schemaVersion: 2;
  readonly lifecycle: 'forming' | 'ready' | 'started';
  readonly roomId: string;
  readonly serverBuildId: string;
  readonly hostParticipantId: string;
  readonly seats: readonly [
    PublicOnlineSeatV2,
    PublicOnlineSeatV2,
    PublicOnlineSeatV2,
    PublicOnlineSeatV2,
  ];
}>;
export type PublicOnlineSnapshotV2 = Readonly<{
  readonly mode: PublicOnlineModeV1;
  readonly roomId: string | null;
  readonly isHost: boolean;
  readonly ownSeatIndex: 0 | 1 | 2 | 3 | null;
  readonly lifecycle: PublicOnlineProjectionV2['lifecycle'] | null;
  readonly projection: PublicOnlineProjectionV2 | null;
  readonly invites: readonly string[];
  readonly selectedDeckId: string;
  readonly busy:
    | 'create'
    | 'join'
    | 'refresh'
    | 'deck'
    | 'ready'
    | 'start'
    | 'rotate'
    | 'close'
    | 'kick'
    | null;
  readonly connection: 'lobby' | 'connecting' | 'online' | 'reconnecting' | 'failed';
  readonly ownerIssue: PublicOnlineIssueV2 | null;
  readonly error: string | null;
  readonly errorIssue: PublicOnlineErrorIssueV2 | null;
  readonly recoveryAvailable: boolean;
  readonly admissionOpen: boolean | null;
  readonly player: OnlineBrowserStateV1 | null;
  readonly table: OnlineBrowserStateV1 | null;
}>;
export type PublicOnlineControllerV2 = Readonly<{
  readonly getSnapshot: () => PublicOnlineSnapshotV2;
  readonly subscribe: (listener: (snapshot: PublicOnlineSnapshotV2) => void) => () => void;
  readonly create: () => Promise<void>;
  readonly join: (roomId: string, inviteCapability: string) => Promise<void>;
  readonly createShared: () => Promise<void>;
  readonly joinShared: (inviteCode: string) => Promise<void>;
  readonly refresh: () => Promise<void>;
  readonly submitDeck: (deck: PublicOnlineDeckOptionV2) => Promise<void>;
  readonly toggleReady: () => Promise<void>;
  readonly start: () => Promise<void>;
  readonly rotateInvite: () => Promise<void>;
  readonly closeAdmission: () => Promise<void>;
  readonly kick: (targetParticipantId: string) => Promise<void>;
  readonly recover: () => Promise<void>;
  readonly leave: () => Promise<void>;
  readonly retry: () => Promise<void>;
  readonly displayDeckName: (name: string, index: number) => string;
  readonly copyInvite: (invite: string) => Promise<boolean>;
  readonly submitPersonalAction: (action: unknown) => void;
  readonly submitGuidedAction: (action: unknown) => void;
  readonly disconnect: () => void;
}>;

export type PublicOnlinePlayerCountV3 = 2 | 4;
export type PublicOnlineStartingLifeV3 = 20 | 40;
export type PublicOnlineConfigurationV3 = Readonly<{
  readonly playerCount: PublicOnlinePlayerCountV3;
  readonly startingLife: PublicOnlineStartingLifeV3;
}>;
export type PublicOnlineSeatV3 = Readonly<{
  readonly seatIndex: 0 | 1 | 2 | 3;
  readonly corePlayerId: 'P1' | 'P2' | 'P3' | 'P4';
  readonly participantId: string | null;
  readonly acceptedDeck: boolean;
  readonly ready: boolean;
}>;
export type PublicOnlineProjectionV3 = Readonly<{
  readonly kind: 'online-forming-lobby-projection-v4';
  readonly schemaVersion: 4;
  readonly lifecycle: 'forming' | 'ready' | 'started';
  readonly roomId: string;
  readonly serverBuildId: string;
  readonly hostParticipantId: string;
  readonly configuration: PublicOnlineConfigurationV3;
  readonly seats: readonly PublicOnlineSeatV3[];
}>;
export type PublicOnlineSnapshotV3 = Readonly<{
  readonly mode: PublicOnlineModeV1;
  readonly roomId: string | null;
  readonly participantId: string | null;
  readonly isHost: boolean;
  readonly ownSeatIndex: 0 | 1 | 2 | 3 | null;
  readonly lifecycle: PublicOnlineProjectionV3['lifecycle'] | null;
  readonly configuration: PublicOnlineConfigurationV3 | null;
  readonly projection: PublicOnlineProjectionV3 | null;
  readonly invites: readonly string[];
  readonly selectedDeckId: string;
  readonly busy: 'create' | 'join' | 'refresh' | 'deck' | 'ready' | 'start' | 'rotate' | 'close' | 'kick' | 'leave' | 'pregame' | 'tabletop' | 'visibility' | 'undo' | null;
  readonly connection: 'lobby' | 'connecting' | 'online' | 'reconnecting' | 'failed';
  readonly error: string | null;
  readonly errorIssue: PublicOnlineErrorIssueV2 | null;
  readonly recoveryAvailable: boolean;
  readonly ownerIssue: PublicOnlineIssueV2 | null;
  readonly admissionOpen: boolean | null;
  readonly player: OnlineBrowserStateV1 | null;
  readonly table: OnlineBrowserStateV1 | null;
  readonly pregame: OnlinePregameProjectionV1 | null;
}>;
export type PublicOnlineControllerV3 = Readonly<{
  readonly getSnapshot: () => PublicOnlineSnapshotV3;
  readonly subscribe: (listener: (snapshot: PublicOnlineSnapshotV3) => void) => () => void;
  readonly createShared: (configuration?: PublicOnlineConfigurationV3) => Promise<void>;
  readonly joinShared: (inviteCode: string) => Promise<void>;
  readonly recover: () => Promise<void>;
  readonly refresh: () => Promise<void>;
  readonly submitDeck: (deck: PublicOnlineDeckOptionV2) => Promise<void>;
  readonly toggleReady: () => Promise<void>;
  readonly start: () => Promise<void>;
  readonly rotateInvite: () => Promise<void>;
  readonly closeAdmission: () => Promise<void>;
  readonly kick: (targetParticipantId: string) => Promise<void>;
  readonly leave: () => Promise<void>;
  readonly retry: () => Promise<void>;
  readonly displayDeckName: (name: string, index: number) => string;
  readonly copyInvite: (invite: string) => Promise<boolean>;
  readonly submitPersonalAction: (action: unknown) => void;
  readonly submitGuidedAction: (action: unknown) => void;
  readonly submitTabletopIntent: (intent: OnlineTabletopIntentEnvelopeV1) => Promise<void>;
  readonly submitVisibilityIntent: (intent: OnlineVisibilityIntentEnvelopeV1) => Promise<void>;
  /** Request rollback of the latest server-owned shared checkpoint. */
  readonly submitSharedUndo: (baseRevision?: number, commandId?: string) => Promise<void>;
  readonly submitManualCombatDamage: (input: PublicOnlineManualCombatDamageInputV1) => Promise<void>;
  readonly submitPregame: (command: OnlinePregameCommandV1) => Promise<void>;
  readonly disconnect: () => void;
}>;

export type PublicOnlineManualCombatDamageInputV1 = Readonly<{
  readonly defendingPlayerId: string;
  readonly damage: number;
  readonly commanderObjectId: string | null;
  readonly baseRevision?: number;
  readonly commandId?: string;
}>;
