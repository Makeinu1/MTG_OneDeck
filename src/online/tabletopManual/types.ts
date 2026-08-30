import type { CoreObjectId, CorePlayerId, CoreRuleZoneRefV1 } from '../../engine/core/index';
import type { CoreCardZoneDestinationV1 } from '../../engine/core/transition/zoneDestination';
import type { CoreManaColorV1 } from '../../engine/core/cardDefinition';

export const ONLINE_TABLETOP_INTENT_SCHEMA_VERSION_V1 = 1 as const;
export type OnlineTabletopManualModeV1 = 'structured' | 'freeform';

export type OnlineTabletopDisabledKindV1 = 'look' | 'reveal' | 'choose';
export type OnlineTabletopPrimitiveKindV1 =
  | 'move' | 'draw' | 'shuffle' | 'reorder' | 'tap' | 'counter' | 'mana' | 'life'
  | 'token-create' | 'token-remove' | 'controller' | 'attach' | 'damage'
  | 'note-set' | 'note-clear' | 'stack-entry' | 'manual-resolve'
  | 'priority-hold' | 'priority-advance' | 'priority-resolve' | 'play-land' | 'cast-spell'
  | OnlineTabletopDisabledKindV1;

export type OnlineTabletopPrimitiveV1 = Readonly<{
  readonly kind: OnlineTabletopPrimitiveKindV1;
  readonly objectId?: CoreObjectId;
  readonly targetObjectId?: CoreObjectId | null;
  readonly destination?: CoreCardZoneDestinationV1;
  readonly zone?: CoreRuleZoneRefV1;
  readonly order?: readonly CoreObjectId[];
  readonly count?: number;
  readonly tapped?: boolean;
  readonly counterKind?: string;
  readonly color?: CoreManaColorV1;
  readonly field?: 'life' | 'poison' | 'energy' | 'experience';
  readonly delta?: number;
  readonly gainingControllerPlayerId?: CorePlayerId;
  readonly amount?: number;
  readonly noteId?: string;
  readonly entryId?: string;
  readonly text?: string;
  readonly label?: string;
  readonly sourceObjectId?: CoreObjectId | null;
  readonly tokenSeed?: string;
  readonly definitionId?: string;
  readonly definition?: unknown;
  readonly held?: boolean;
}>;

export type OnlineTabletopIntentEnvelopeV1 = Readonly<{
  readonly kind: 'online-tabletop-intent-envelope-v1';
  readonly schemaVersion: typeof ONLINE_TABLETOP_INTENT_SCHEMA_VERSION_V1;
  readonly commandId: string;
  readonly baseRevision: number;
  readonly mode: OnlineTabletopManualModeV1;
  readonly primitive: OnlineTabletopPrimitiveV1;
}>;


export type OnlineTabletopIntentValidationIssueV1 = Readonly<{ readonly code: string; readonly path: string; readonly message: string }>;
export type OnlineTabletopIntentValidationResultV1 =
  | Readonly<{ readonly ok: true; readonly value: OnlineTabletopIntentEnvelopeV1 }>
  | Readonly<{ readonly ok: false; readonly issues: readonly OnlineTabletopIntentValidationIssueV1[] }>;
