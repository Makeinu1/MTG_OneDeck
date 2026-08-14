import type { CoreObjectId, CorePlayerId } from '../../engine/core/index';
import type {
  OnlineCommandEnvelopeV1,
  OnlineProtocolCommandIdV1,
  OnlineProtocolRevisionV1,
} from '../protocol/index';
import type { OnlineDisplayPairingSessionV1 } from '../displayPairing/index';

export const ONLINE_GUIDED_ACTIONS_SCHEMA_VERSION_V1 = 1 as const;

export type OnlineGuidedCounterV1 = Readonly<{
  readonly kind: string;
  readonly count: number;
}>;

export type OnlineGuidedPlayerSummaryV1 = Readonly<{
  readonly playerId: CorePlayerId;
  readonly isSelf: boolean;
  readonly isActive: boolean;
  readonly life: number;
  readonly poison: number;
}>;

export type OnlineGuidedSearchCandidateV1 = Readonly<{
  readonly objectId: CoreObjectId;
  readonly label: string;
}>;

export type OnlineGuidedSearchSessionV1 = Readonly<{
  readonly sessionId: string;
  readonly zone: unknown;
  readonly minimum: number;
  readonly maximum: number;
  readonly mayFailToFind: boolean;
  readonly revealFound: boolean;
  readonly shuffleAfter: boolean;
  readonly candidates: readonly OnlineGuidedSearchCandidateV1[];
}>;

export type OnlineGuidedControlCandidateV1 = Readonly<{
  readonly objectId: CoreObjectId;
  readonly label: string;
  readonly controllerPlayerId: CorePlayerId | null;
}>;

export type OnlineGuidedFaceDownItemV1 = Readonly<{
  readonly objectId: CoreObjectId;
  readonly zone: 'battlefield' | 'stack' | 'exile';
  readonly label: '《裏向きのカード》';
  readonly tapped: boolean;
  readonly phasedOut: boolean;
  readonly counters: readonly OnlineGuidedCounterV1[];
  readonly markedDamage: number;
}>;

export type OnlineGuidedCombatObjectV1 = Readonly<{
  readonly objectId: CoreObjectId;
  readonly label: string;
  readonly controllerPlayerId: CorePlayerId | null;
}>;

export type OnlineGuidedActionsViewV1 = Readonly<{
  readonly kind: 'online-guided-actions-view-v1';
  readonly schemaVersion: typeof ONLINE_GUIDED_ACTIONS_SCHEMA_VERSION_V1;
  readonly revision: OnlineProtocolRevisionV1;
  readonly actorPlayerId: CorePlayerId;
  readonly roomLifecycle: string;
  readonly turn: Readonly<{
    readonly activePlayerId: CorePlayerId;
    readonly turnNumber: number;
    readonly phase: string;
    readonly step: string | null;
  }>;
  readonly players: readonly OnlineGuidedPlayerSummaryV1[];
  readonly searchSessions: readonly OnlineGuidedSearchSessionV1[];
  readonly controlCandidates: readonly OnlineGuidedControlCandidateV1[];
  readonly faceDownItems: readonly OnlineGuidedFaceDownItemV1[];
  readonly combat: Readonly<{
    readonly ownObjects: readonly OnlineGuidedCombatObjectV1[];
    readonly attackedObjects: readonly OnlineGuidedCombatObjectV1[];
    readonly defendingPlayers: readonly OnlineGuidedPlayerSummaryV1[];
  }>;
  readonly corrections: Readonly<{
    readonly players: readonly OnlineGuidedPlayerSummaryV1[];
    readonly commanders: readonly OnlineGuidedSearchCandidateV1[];
  }>;
}>;

export type OnlineGuidedActionV1 =
  | Readonly<{
      readonly kind: 'complete-search';
      readonly actorPlayerId: CorePlayerId;
      readonly baseRevision: OnlineProtocolRevisionV1;
      readonly sessionId: string;
      readonly selectedObjectIds: readonly CoreObjectId[];
    }>
  | Readonly<{
      readonly kind: 'apply-control';
      readonly actorPlayerId: CorePlayerId;
      readonly baseRevision: OnlineProtocolRevisionV1;
      readonly effectKey: string;
      readonly targetObjectId: CoreObjectId;
      readonly gainingControllerPlayerId: CorePlayerId;
      readonly sourceObjectId: CoreObjectId | null;
      readonly duration: Readonly<{ readonly kind: 'manual' }>;
    }>
  | Readonly<{
      readonly kind: 'declare-attacker';
      readonly actorPlayerId: CorePlayerId;
      readonly baseRevision: OnlineProtocolRevisionV1;
      readonly attackerObjectId: CoreObjectId;
      readonly defendingPlayerId: CorePlayerId;
    }>
  | Readonly<{
      readonly kind: 'declare-blocker';
      readonly actorPlayerId: CorePlayerId;
      readonly baseRevision: OnlineProtocolRevisionV1;
      readonly blockerObjectId: CoreObjectId;
      readonly attackedObjectId: CoreObjectId;
      readonly defendingPlayerId: CorePlayerId;
    }>
  | Readonly<{
      readonly kind: 'note-face-down';
      readonly actorPlayerId: CorePlayerId;
      readonly baseRevision: OnlineProtocolRevisionV1;
      readonly objectId: CoreObjectId;
      readonly note: string;
    }>
  | Readonly<{
      readonly kind: 'request-life-correction';
      readonly actorPlayerId: CorePlayerId;
      readonly baseRevision: OnlineProtocolRevisionV1;
      readonly playerId: CorePlayerId;
      readonly replacementLifeTotal: number;
      readonly reason: string;
    }>
  | Readonly<{
      readonly kind: 'note-commander-damage-correction';
      readonly actorPlayerId: CorePlayerId;
      readonly baseRevision: OnlineProtocolRevisionV1;
      readonly commanderObjectId: CoreObjectId;
      readonly defendingPlayerId: CorePlayerId;
      readonly replacementDamageTotal: number;
      readonly reason: string;
    }>;

export type OnlineGuidedActionCreationInputV1 = Readonly<{
  readonly projection: unknown;
  readonly action: unknown;
}>;

export type OnlineGuidedCommandBindingInputV1 = Readonly<{
  readonly session: OnlineDisplayPairingSessionV1;
  readonly action: OnlineGuidedActionV1;
  readonly commandId: OnlineProtocolCommandIdV1;
}>;

export type OnlineGuidedCommandFrameV1 = OnlineCommandEnvelopeV1;

export type OnlineGuidedActionErrorKindV1 =
  | 'view'
  | 'action'
  | 'binding';

export type OnlineGuidedActionBindingCommandIdV1 = OnlineProtocolCommandIdV1;
