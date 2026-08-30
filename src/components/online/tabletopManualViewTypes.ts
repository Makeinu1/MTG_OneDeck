import type {
  CoreCardDefinitionSnapshotV1,
  CoreManaColorV1,
  CoreObjectId,
  CoreObjectIdKindV2,
  CorePlayerId,
} from '../../engine/core';
import type { CoreCardZoneDestinationV1 } from '../../engine/core/transition/zoneDestination';
import type { OnlineProjectedGameV1 } from '../../online/projection';

/** Keep this view-only contract on the projection's public barrel. */
type OnlineProjectedCommonResponseWindowV1 = NonNullable<NonNullable<OnlineProjectedGameV1['assistedPriority']>['responseWindow']>;

export type OnlineTabletopManualInteractionStateV1 = 'ready' | 'updating' | 'offline';
export type OnlineTabletopManualModeV1 = 'structured' | 'freeform';

export type OnlineTabletopManualRuntimeV1 = Readonly<{
  readonly faceIndex: number | null;
  readonly faceDown: boolean;
  readonly tapped: boolean;
  readonly flipped: boolean | null;
  readonly phasedOut: boolean;
  readonly counters: readonly Readonly<{ readonly kind: string; readonly count: number }>[];
  readonly markedDamage: number;
  readonly attachment: Readonly<{
    readonly kind: 'none' | 'concealed' | 'player' | 'object';
    readonly playerId?: CorePlayerId;
    readonly objectId?: CoreObjectId;
  }>;
}>;

export type OnlineTabletopManualVisibleEntryV1 = Readonly<{
  readonly kind: 'visible-object';
  readonly objectId: CoreObjectId;
  readonly objectKind: CoreObjectIdKindV2;
  readonly ownerPlayerId: CorePlayerId | null;
  readonly controllerPlayerId: CorePlayerId | null;
  readonly commander: boolean;
  readonly definition: CoreCardDefinitionSnapshotV1 | null;
  readonly runtime: OnlineTabletopManualRuntimeV1 | null;
}>;
export type OnlineTabletopManualConcealedEntryV1 = Readonly<{
  readonly kind: 'concealed-object';
  readonly objectId: CoreObjectId;
  readonly objectKind: CoreObjectIdKindV2;
  readonly runtime: OnlineTabletopManualRuntimeV1;
}>;
export type OnlineTabletopManualZoneEntryV1 = Readonly<{ readonly kind: 'hidden-card' }>
  | OnlineTabletopManualVisibleEntryV1
  | OnlineTabletopManualConcealedEntryV1;
export type OnlineTabletopManualZoneV1 = Readonly<{
  readonly count: number;
  readonly entries: readonly OnlineTabletopManualZoneEntryV1[];
}>;
export type OnlineTabletopManualProjectionV1 = Readonly<{
  readonly corePlayerId: CorePlayerId | null;
  readonly revision: number;
  readonly game: Readonly<{
    readonly players: readonly Readonly<{ readonly playerId: CorePlayerId; readonly status: 'active' | 'exited' }>[];
    readonly zones: Readonly<{
      readonly byPlayer: readonly Readonly<{
        readonly playerId: CorePlayerId;
        readonly zones: Readonly<{ readonly library: OnlineTabletopManualZoneV1; readonly hand: OnlineTabletopManualZoneV1; readonly graveyard: OnlineTabletopManualZoneV1 }>;
      }>[];
      readonly battlefield: OnlineTabletopManualZoneV1;
      readonly stack: OnlineTabletopManualZoneV1;
      readonly exile: OnlineTabletopManualZoneV1;
      readonly command: OnlineTabletopManualZoneV1;
    }>;
    readonly notes?: readonly Readonly<{ readonly id: string; readonly authorPlayerId: CorePlayerId; readonly text: string; readonly creationRevision: number }>[];
    readonly manualStack?: readonly Readonly<{ readonly id: string; readonly label: string; readonly provenance: OnlineTabletopManualModeV1; readonly sourceObjectId: CoreObjectId | null; readonly authorPlayerId: CorePlayerId; readonly creationRevision: number }>[];
    readonly priorityHolds?: readonly Readonly<{ readonly playerId: CorePlayerId; readonly setRevision: number }>[];
    readonly assistedPriority?: Readonly<{ readonly holderPlayerId: CorePlayerId | null; readonly stewardPlayerId: CorePlayerId | null; readonly windowKind: string; readonly holds: readonly CorePlayerId[]; readonly responseWindow?: OnlineProjectedCommonResponseWindowV1 | null; readonly topStackObjectId?: CoreObjectId | null }>;
  }>;
}>;

export type OnlineTabletopManualPrimitiveV1 =
  | Readonly<{ readonly kind: 'move'; readonly objectId: CoreObjectId; readonly destination: CoreCardZoneDestinationV1 }>
  | Readonly<{ readonly kind: 'draw'; readonly count: number }>
  | Readonly<{ readonly kind: 'shuffle' }>
  | Readonly<{ readonly kind: 'reorder'; readonly zone: Readonly<{ readonly kind: 'shared-zone'; readonly zone: 'battlefield' | 'stack' | 'exile' | 'command' }>; readonly order: readonly CoreObjectId[] }>
  | Readonly<{ readonly kind: 'tap'; readonly objectId: CoreObjectId; readonly tapped: boolean }>
  | Readonly<{ readonly kind: 'counter'; readonly objectId: CoreObjectId; readonly counterKind: string; readonly delta: number }>
  | Readonly<{ readonly kind: 'mana'; readonly color: CoreManaColorV1; readonly delta: number }>
  | Readonly<{ readonly kind: 'life'; readonly field: 'life' | 'poison' | 'energy' | 'experience'; readonly delta: number }>
  | Readonly<{ readonly kind: 'token-create'; readonly tokenSeed: string; readonly definitionId: string; readonly definition: CoreCardDefinitionSnapshotV1 }>
  | Readonly<{ readonly kind: 'token-remove'; readonly objectId: CoreObjectId }>
  | Readonly<{ readonly kind: 'controller'; readonly objectId: CoreObjectId; readonly gainingControllerPlayerId: CorePlayerId }>
  | Readonly<{ readonly kind: 'attach'; readonly objectId: CoreObjectId; readonly targetObjectId: CoreObjectId | null }>
  | Readonly<{ readonly kind: 'damage'; readonly objectId: CoreObjectId; readonly amount: number }>
  | Readonly<{ readonly kind: 'note-set'; readonly noteId: string; readonly text: string }>
  | Readonly<{ readonly kind: 'note-clear'; readonly noteId: string }>
  | Readonly<{ readonly kind: 'stack-entry'; readonly entryId: string; readonly label: string; readonly sourceObjectId: CoreObjectId | null }>
  | Readonly<{ readonly kind: 'manual-resolve'; readonly entryId: string }>
  | Readonly<{ readonly kind: 'priority-hold'; readonly held: boolean }>
  | Readonly<{ readonly kind: 'priority-advance' }>
  | Readonly<{ readonly kind: 'priority-resolve' }>
  | Readonly<{ readonly kind: 'play-land'; readonly objectId: CoreObjectId }>
  | Readonly<{ readonly kind: 'cast-spell'; readonly objectId: CoreObjectId }>;

export type OnlineTabletopManualIntentEnvelopeV1 = Readonly<{
  readonly kind: 'online-tabletop-intent-envelope-v1';
  readonly schemaVersion: 1;
  readonly commandId: string;
  readonly baseRevision: number;
  readonly mode: OnlineTabletopManualModeV1;
  readonly primitive: OnlineTabletopManualPrimitiveV1;
}>;
