import type {
  CoreCommandV1,
  CorePlayerId,
} from '../../engine/core/index';
import type {
  OnlineCommandEnvelopeV1,
  OnlineProtocolCommandIdV1,
  OnlineProtocolParticipantCapabilityV1,
  OnlineProtocolRevisionV1,
} from '../protocol/index';
import type { OnlineProjectionRequestV1 } from '../projection/index';
import type {
  PersonalWorkbenchActionV1,
} from '../workbench/index';

export const ONLINE_DISPLAY_PAIRING_SCHEMA_VERSION_V1 = 1 as const;

export type OnlineDisplayPairingOpponentV1 = Readonly<{
  readonly playerId: CorePlayerId;
  readonly seatIndex: number;
  readonly isFocused: boolean;
  readonly isActive: boolean;
  readonly presence: 'connected' | 'disconnected';
  readonly outcome: 'pending' | 'conceded' | 'defeated';
  readonly status: 'active' | 'exited';
  readonly life: number;
  readonly poison: number;
}>;

export type OnlineDisplayPairingViewV1 = Readonly<{
  readonly kind: 'online-display-pairing-view-v1';
  readonly schemaVersion: typeof ONLINE_DISPLAY_PAIRING_SCHEMA_VERSION_V1;
  readonly revision: OnlineProtocolRevisionV1;
  readonly ownPlayerId: CorePlayerId;
  readonly ownSeatIndex: number;
  readonly opponents: readonly OnlineDisplayPairingOpponentV1[];
  readonly focusedOpponent: OnlineDisplayPairingOpponentV1 | null;
}>;

export type OnlineOpponentFocusActionV1 = Readonly<{
  readonly kind: 'focus-opponent';
  readonly playerId: CorePlayerId;
  readonly revision: OnlineProtocolRevisionV1;
}>;

export type OnlineDisplayPairingInputV1 = Readonly<{
  readonly personalProjection: unknown;
  readonly tableProjection: unknown;
  readonly focusedPlayerId: string | null;
}>;

export type OnlineDisplayPairingSessionV1 = Readonly<{
  readonly protocolVersion: number;
  readonly roomId: string;
  readonly participantId: string;
  readonly participantCapability: OnlineProtocolParticipantCapabilityV1;
  readonly clientBuildId: string;
  readonly corePlayerId: CorePlayerId;
}>;

export type OnlineDisplayPairingBindingInputV1 = Readonly<{
  readonly session: OnlineDisplayPairingSessionV1;
  readonly action: PersonalWorkbenchActionV1;
  readonly commandId: string | null;
}>;

export type OnlineDisplayPairingProtocolFrameV1 =
  | OnlineProjectionRequestV1
  | OnlineCommandEnvelopeV1;

export type OnlineDisplayPairingCoreCommandV1 = CoreCommandV1;
export type OnlineDisplayPairingCommandIdV1 = OnlineProtocolCommandIdV1;
