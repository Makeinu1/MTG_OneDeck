import type {
  CoreCardDefinitionSnapshotV1,
  CoreManaColorV1,
} from '../cardDefinition';
import type { CoreCardDefinitionId, CorePlayerId } from '../ids';
import type { CoreCardZoneDestinationV1 } from '../transition/zoneDestination';
import type { CoreObjectId } from '../ids';
import type { CoreRuleZoneRefV1 } from '../rules/ruleZoneRefV1';
export type { CoreTabletopManualModeV1 } from './manualStateV1';

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
  readonly manualMode?: unknown;
}>;

export type CoreTabletopZoneMovePayloadV1 = Readonly<{
  readonly kind: 'table-zone-move';
  readonly objectId: CoreObjectId;
  readonly destination: CoreCardZoneDestinationV1;
  readonly manualMode?: unknown;
}>;

/** A legal land play is distinct from a manual zone move so land counters
 * cannot be forged by moving an arbitrary card to the battlefield. */
export type CoreTabletopLandPlayPayloadV1 = Readonly<{
  readonly kind: 'table-land-play';
  readonly objectId: CoreObjectId;
}>;

export type CoreTabletopTapPayloadV1 = Readonly<{
  readonly kind: 'table-tap';
  readonly objectId: CoreObjectId;
  readonly tapped: boolean;
  readonly manualMode?: unknown;
}>;

export type CoreTabletopManaPayloadV1 = Readonly<{
  readonly kind: 'table-mana-adjust';
  readonly color: CoreManaColorV1;
  readonly delta: number;
  readonly manualMode?: unknown;
}>;

export type CoreTabletopCounterPayloadV1 = Readonly<{
  readonly kind: 'table-counter-adjust';
  readonly objectId: CoreObjectId;
  readonly counterKind: string;
  readonly delta: number;
  readonly manualMode?: unknown;
}>;

export type CoreTabletopTokenCreatePayloadV1 = Readonly<{
  readonly kind: 'table-token-create';
  readonly tokenSeed: string;
  readonly definitionId: CoreCardDefinitionId;
  readonly definition: CoreCardDefinitionSnapshotV1;
  readonly manualMode?: unknown;
}>;

export type CoreTabletopTokenRemovePayloadV1 = Readonly<{
  readonly kind: 'table-token-remove';
  readonly objectId: CoreObjectId;
  readonly manualMode?: unknown;
}>;

export type CoreTabletopTurnTransitionV1 =
  | Readonly<{ readonly kind: 'checkpoint' }>
  | Readonly<{ readonly kind: 'position'; readonly nextPosition: CoreTabletopTurnPositionV1 }>
  | Readonly<{ readonly kind: 'first-turn-draw-skip' }>
  | Readonly<{ readonly kind: 'sba-check-outcome'; readonly actionsWereApplied: boolean }>
  | Readonly<{ readonly kind: 'next-turn' }>;

export type CoreTabletopTurnPayloadV1 = Readonly<{
  readonly kind: 'table-turn-progress';
  readonly transition: CoreTabletopTurnTransitionV1;
}>;

export type CoreTabletopShufflePayloadV1 = Readonly<{
  readonly kind: 'table-shuffle';
  readonly manualMode?: unknown;
}>;
export type CoreTabletopReorderPayloadV1 = Readonly<{
  readonly kind: 'table-reorder';
  readonly zone: CoreRuleZoneRefV1;
  readonly order: readonly CoreObjectId[];
  readonly manualMode?: unknown;
}>;
export type CoreTabletopLifePayloadV1 = Readonly<{
  readonly kind: 'table-life-adjust';
  readonly field: 'life' | 'poison' | 'energy' | 'experience';
  readonly delta: number;
  readonly manualMode?: unknown;
}>;
export type CoreTabletopControllerPayloadV1 = Readonly<{
  readonly kind: 'table-controller-change';
  readonly objectId: CoreObjectId;
  readonly gainingControllerPlayerId: CorePlayerId;
  readonly manualMode?: unknown;
}>;
export type CoreTabletopAttachPayloadV1 = Readonly<{
  readonly kind: 'table-attach';
  readonly objectId: CoreObjectId;
  readonly targetObjectId: CoreObjectId | null;
  readonly manualMode?: unknown;
}>;
export type CoreTabletopDamagePayloadV1 = Readonly<{
  readonly kind: 'table-damage-mark';
  readonly objectId: CoreObjectId;
  readonly amount: number;
  readonly manualMode?: unknown;
}>;
export type CoreTabletopNoteSetPayloadV1 = Readonly<{
  readonly kind: 'table-note-set';
  readonly noteId: string;
  readonly text: string;
  readonly manualMode?: unknown;
}>;
export type CoreTabletopNoteClearPayloadV1 = Readonly<{
  readonly kind: 'table-note-clear';
  readonly noteId: string;
  readonly manualMode?: unknown;
}>;
export type CoreTabletopStackEntryPayloadV1 = Readonly<{
  readonly kind: 'table-stack-entry';
  readonly entryId: string;
  readonly label: string;
  readonly sourceObjectId?: CoreObjectId | null;
  readonly manualMode?: unknown;
}>;
export type CoreTabletopManualResolvePayloadV1 = Readonly<{
  readonly kind: 'table-manual-resolve';
  readonly entryId?: string;
  readonly manualMode?: unknown;
}>;
export type CoreTabletopPriorityHoldPayloadV1 = Readonly<{
  readonly kind: 'table-priority-hold';
  readonly held: boolean;
}>;

export type CoreTabletopCommandPayloadV1 =
  | CoreTabletopDrawPayloadV1
  | CoreTabletopZoneMovePayloadV1
  | CoreTabletopLandPlayPayloadV1
  | CoreTabletopTapPayloadV1
  | CoreTabletopManaPayloadV1
  | CoreTabletopCounterPayloadV1
  | CoreTabletopTokenCreatePayloadV1
  | CoreTabletopTokenRemovePayloadV1
  | CoreTabletopShufflePayloadV1
  | CoreTabletopReorderPayloadV1
  | CoreTabletopLifePayloadV1
  | CoreTabletopControllerPayloadV1
  | CoreTabletopAttachPayloadV1
  | CoreTabletopDamagePayloadV1
  | CoreTabletopNoteSetPayloadV1
  | CoreTabletopNoteClearPayloadV1
  | CoreTabletopStackEntryPayloadV1
  | CoreTabletopManualResolvePayloadV1
  | CoreTabletopPriorityHoldPayloadV1
  | CoreTabletopTurnPayloadV1;

export type CoreTabletopCommandKindV1 = CoreTabletopCommandPayloadV1['kind'];
