import type { OnlineParticipantProjectionV1 } from '../projection/index';
import type { OnlineBrowserStateV1 } from '../browser/index';

export const PUBLIC_ONLINE_ERROR_V1 = 'オンライン操作を完了できませんでした。' as const;

export type PublicOnlineDeckOptionV1 = Readonly<{
  readonly id: string;
  readonly name: string;
  readonly deckText: string;
}>;

export type PublicOnlineModeV1 = 'entry' | 'forming' | 'started' | 'failed';
export type PublicOnlineConnectionStateV1 = 'connecting' | 'updating' | 'ready' | 'offline' | 'failed';

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
