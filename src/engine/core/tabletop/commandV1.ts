import type {
  CoreCardDefinitionSnapshotV1,
  CoreManaColorV1,
} from '../cardDefinition';
import type { CoreCardDefinitionId } from '../ids';
import type { CoreCardZoneDestinationV1 } from '../transition/zoneDestination';
import type { CoreObjectId } from '../ids';

export type CoreTabletopTurnPositionV1 =
  | Readonly<{ readonly phase: 'beginning'; readonly step: 'untap' | 'upkeep' | 'draw' }>
  | Readonly<{ readonly phase: 'precombat-main'; readonly step: null }>
  | Readonly<{ readonly phase: 'combat'; readonly step: 'beginning-of-combat' | 'declare-attackers' | 'declare-blockers' | 'combat-damage' | 'end-of-combat' }>
  | Readonly<{ readonly phase: 'postcombat-main'; readonly step: null }>
  | Readonly<{ readonly phase: 'ending'; readonly step: 'end' | 'cleanup' }>;

/**
 * The finite ordinary-table command algebra.  These payloads deliberately
 * carry only table facts; authority, room capabilities, and transport data
 * remain in the surrounding Core/Protocol envelopes.
 */
export type CoreTabletopDrawPayloadV1 = Readonly<{
  readonly kind: 'table-draw';
  readonly count: number;
}>;

export type CoreTabletopZoneMovePayloadV1 = Readonly<{
  readonly kind: 'table-zone-move';
  readonly objectId: CoreObjectId;
  readonly destination: CoreCardZoneDestinationV1;
}>;

export type CoreTabletopTapPayloadV1 = Readonly<{
  readonly kind: 'table-tap';
  readonly objectId: CoreObjectId;
  readonly tapped: boolean;
}>;

export type CoreTabletopManaPayloadV1 = Readonly<{
  readonly kind: 'table-mana-adjust';
  readonly color: CoreManaColorV1;
  readonly delta: number;
}>;

export type CoreTabletopCounterPayloadV1 = Readonly<{
  readonly kind: 'table-counter-adjust';
  readonly objectId: CoreObjectId;
  readonly counterKind: string;
  readonly delta: number;
}>;

export type CoreTabletopTokenCreatePayloadV1 = Readonly<{
  readonly kind: 'table-token-create';
  readonly tokenSeed: string;
  readonly definitionId: CoreCardDefinitionId;
  readonly definition: CoreCardDefinitionSnapshotV1;
}>;

export type CoreTabletopTokenRemovePayloadV1 = Readonly<{
  readonly kind: 'table-token-remove';
  readonly objectId: CoreObjectId;
}>;

export type CoreTabletopTurnTransitionV1 =
  | Readonly<{ readonly kind: 'checkpoint' }>
  | Readonly<{ readonly kind: 'position'; readonly nextPosition: CoreTabletopTurnPositionV1 }>
  | Readonly<{ readonly kind: 'next-turn' }>;

export type CoreTabletopTurnPayloadV1 = Readonly<{
  readonly kind: 'table-turn-progress';
  readonly transition: CoreTabletopTurnTransitionV1;
}>;

export type CoreTabletopCommandPayloadV1 =
  | CoreTabletopDrawPayloadV1
  | CoreTabletopZoneMovePayloadV1
  | CoreTabletopTapPayloadV1
  | CoreTabletopManaPayloadV1
  | CoreTabletopCounterPayloadV1
  | CoreTabletopTokenCreatePayloadV1
  | CoreTabletopTokenRemovePayloadV1
  | CoreTabletopTurnPayloadV1;

export type CoreTabletopCommandKindV1 = CoreTabletopCommandPayloadV1['kind'];
