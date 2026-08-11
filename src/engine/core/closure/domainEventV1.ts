import type { CoreObjectId, CorePhysicalCardId, CorePlayerId } from '../ids';
import type { CoreCommandV1 } from './commandV1';

export type CoreDomainEventPayloadV1 =
  | Readonly<{ readonly kind: 'stack-changed'; readonly operation: 'commit' | 'remove'; readonly objectId: CoreObjectId }>
  | Readonly<{ readonly kind: 'priority-changed'; readonly holderPlayerId: CorePlayerId | null; readonly windowKind: string }>
  | Readonly<{ readonly kind: 'search-session-changed'; readonly sessionKey: string; readonly operation: 'open' | 'complete'; readonly selectedCount: number }>
  | Readonly<{ readonly kind: 'control-changed'; readonly effectKey: string; readonly targetObjectId: CoreObjectId }>
  | Readonly<{ readonly kind: 'commander-cast-recorded'; readonly physicalCardId: CorePhysicalCardId; readonly accepted: boolean; readonly castCount: number }>
  | Readonly<{ readonly kind: 'commander-damage-recorded'; readonly physicalCardId: CorePhysicalCardId; readonly defendingPlayerId: CorePlayerId; readonly damage: number; readonly combatObjectId: CoreObjectId }>
  | Readonly<{ readonly kind: 'combat-changed'; readonly operation: 'step' | 'attack' | 'block' }>
  | Readonly<{ readonly kind: 'player-exited'; readonly playerId: CorePlayerId; readonly cause: 'concession' | 'defeat' }>
  | Readonly<{ readonly kind: 'zone-randomized'; readonly randomDecisionId: string; readonly zoneKind: string; readonly count: number }>
  | Readonly<{ readonly kind: 'manual-correction-applied'; readonly correction: 'player-life' | 'commander-damage' }>;

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
