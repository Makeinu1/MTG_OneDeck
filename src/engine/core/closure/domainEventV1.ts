import type { CoreObjectId, CorePhysicalCardId, CorePlayerId } from '../ids';
import type { CoreCommandV1 } from './commandV1';
import type { CoreTabletopManualModeV1 } from '../tabletop/manualStateV1';

/**
 * The private, typed outcome of a completed search.  The event/journal keeps
 * this value so protocol persistence can carry the result after the active
 * search session has been retired; projections redact the IDs when
 * `revealFound` is false.
 */
export type CoreSearchCompletionResultV1 = Readonly<{
  readonly kind: 'core-search-completion-result-v1';
  readonly sessionKey: string;
  readonly selectedObjectIds: readonly CoreObjectId[];
  readonly selectedCount: number;
  readonly revealFound: boolean;
}>;

export type CoreDomainEventPayloadV1 =
  | Readonly<{ readonly kind: 'stack-changed'; readonly operation: 'commit' | 'remove'; readonly objectId: CoreObjectId }>
  | Readonly<{ readonly kind: 'priority-changed'; readonly holderPlayerId: CorePlayerId | null; readonly windowKind: string }>
  | Readonly<{ readonly kind: 'search-session-changed'; readonly sessionKey: string; readonly operation: 'open' | 'complete'; readonly selectedCount: number; readonly selectedObjectIds?: readonly CoreObjectId[]; readonly revealFound?: boolean; readonly completionResult?: CoreSearchCompletionResultV1 }>
  | Readonly<{ readonly kind: 'visibility-opened'; readonly grantKey: string; readonly mode: 'look' | 'reveal'; readonly duration: string }>
  | Readonly<{ readonly kind: 'visibility-closed'; readonly grantKey: string; readonly reason: string }>
  | Readonly<{ readonly kind: 'control-changed'; readonly effectKey: string; readonly targetObjectId: CoreObjectId }>
  | Readonly<{ readonly kind: 'commander-cast-recorded'; readonly physicalCardId: CorePhysicalCardId; readonly accepted: boolean; readonly castCount: number }>
  | Readonly<{ readonly kind: 'commander-damage-recorded'; readonly physicalCardId: CorePhysicalCardId; readonly defendingPlayerId: CorePlayerId; readonly damage: number; readonly combatObjectId: CoreObjectId }>
  | Readonly<{ readonly kind: 'combat-changed'; readonly operation: 'step' | 'attack' | 'block' }>
  | Readonly<{ readonly kind: 'player-exited'; readonly playerId: CorePlayerId; readonly cause: 'concession' | 'defeat' }>
  | Readonly<{ readonly kind: 'zone-randomized'; readonly randomDecisionId: string; readonly zoneKind: string; readonly count: number; readonly manualMode?: CoreTabletopManualModeV1 }>
  | Readonly<{ readonly kind: 'manual-correction-applied'; readonly correction: 'player-life' | 'commander-damage' }>
  | Readonly<{ readonly kind: 'table-draw'; readonly playerId: CorePlayerId; readonly count: number; readonly manualMode?: CoreTabletopManualModeV1 }>
  | Readonly<{ readonly kind: 'table-zone-moved'; readonly objectId: CoreObjectId; readonly newObjectId: CoreObjectId; readonly destination: string; readonly manualMode?: CoreTabletopManualModeV1 }>
  | Readonly<{ readonly kind: 'table-tap-changed'; readonly objectId: CoreObjectId; readonly tapped: boolean; readonly manualMode?: CoreTabletopManualModeV1 }>
  | Readonly<{ readonly kind: 'table-mana-adjusted'; readonly playerId: CorePlayerId; readonly color: string; readonly delta: number; readonly resultingAmount: number; readonly manualMode?: CoreTabletopManualModeV1 }>
  | Readonly<{ readonly kind: 'table-counter-adjusted'; readonly objectId: CoreObjectId; readonly counterKind: string; readonly delta: number; readonly resultingCount: number; readonly manualMode?: CoreTabletopManualModeV1 }>
  | Readonly<{ readonly kind: 'table-token-created'; readonly objectId: CoreObjectId; readonly definitionId: string; readonly controllerPlayerId: CorePlayerId; readonly manualMode?: CoreTabletopManualModeV1 }>
  | Readonly<{ readonly kind: 'table-token-removed'; readonly objectId: CoreObjectId; readonly manualMode?: CoreTabletopManualModeV1 }>
  | Readonly<{ readonly kind: 'table-shuffled'; readonly playerId: CorePlayerId; readonly count: number; readonly manualMode?: CoreTabletopManualModeV1 }>
  | Readonly<{ readonly kind: 'table-reordered'; readonly zone: string; readonly count: number; readonly manualMode?: CoreTabletopManualModeV1 }>
  | Readonly<{ readonly kind: 'table-life-adjusted'; readonly playerId: CorePlayerId; readonly field: 'life' | 'poison' | 'energy' | 'experience'; readonly delta: number; readonly resultingAmount: number; readonly manualMode?: CoreTabletopManualModeV1 }>
  | Readonly<{ readonly kind: 'table-controller-changed'; readonly objectId: CoreObjectId; readonly gainingControllerPlayerId: CorePlayerId; readonly manualMode?: CoreTabletopManualModeV1 }>
  | Readonly<{ readonly kind: 'table-attachment-changed'; readonly objectId: CoreObjectId; readonly targetObjectId: CoreObjectId | null; readonly manualMode?: CoreTabletopManualModeV1 }>
  | Readonly<{ readonly kind: 'table-damage-marked'; readonly objectId: CoreObjectId; readonly amount: number; readonly resultingAmount: number; readonly manualMode?: CoreTabletopManualModeV1 }>
  | Readonly<{ readonly kind: 'table-note-set'; readonly noteId: string; readonly authorPlayerId: CorePlayerId; readonly creationRevision: number; readonly manualMode?: CoreTabletopManualModeV1 }>
  | Readonly<{ readonly kind: 'table-note-cleared'; readonly noteId: string; readonly authorPlayerId: CorePlayerId; readonly manualMode?: CoreTabletopManualModeV1 }>
  | Readonly<{ readonly kind: 'table-stack-entry-added'; readonly entryId: string; readonly authorPlayerId: CorePlayerId; readonly creationRevision: number; readonly manualMode?: CoreTabletopManualModeV1 }>
  | Readonly<{ readonly kind: 'table-manual-resolved'; readonly entryId: string; readonly objectId: CoreObjectId | null; readonly manualMode?: CoreTabletopManualModeV1 }>
  | Readonly<{ readonly kind: 'table-turn-progressed'; readonly transition: Readonly<Record<string, unknown>> }>;

export type CoreDomainEventV1 = Readonly<{
  readonly kind: 'mode-neutral-core-domain-event-v1';
  readonly schemaVersion: 1;
  readonly commandSequence: number;
  readonly eventIndex: number;
  readonly actorPlayerId: CorePlayerId;
  readonly decisionMakerPlayerId: CorePlayerId;
  readonly payload: CoreDomainEventPayloadV1;
}>;

export function createCoreDomainEventV1(command: CoreCommandV1, eventIndex: number, payload: CoreDomainEventPayloadV1): CoreDomainEventV1 {
  return Object.freeze({ kind: 'mode-neutral-core-domain-event-v1', schemaVersion: 1, commandSequence: command.sequence, eventIndex, actorPlayerId: command.actorPlayerId, decisionMakerPlayerId: command.decisionMakerPlayerId, payload: Object.freeze({ ...payload }) });
}
