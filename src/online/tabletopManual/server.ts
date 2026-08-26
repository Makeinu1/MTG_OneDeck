import { coreCanonicalDigestFromValueV1, type CoreCommandV1, type CoreObjectId } from '../../engine/core/index';
import type { OnlineProtocolStateV1, OnlineVariableProtocolStateV2 } from '../protocol/index';
import { bindOnlineTabletopIntentToCoreCommandV1, type OnlineTabletopCommandResultV1 } from './binding';
import { validateOnlineTabletopIntentEnvelopeV1 } from './validation';
import type { OnlineTabletopIntentEnvelopeV1 } from './types';

export type OnlineTabletopServerBindingInputV1 = Readonly<{
  readonly state: Pick<OnlineProtocolStateV1, 'room' | 'coreRoot' | 'revision'> | Pick<OnlineVariableProtocolStateV2, 'room' | 'coreRoot' | 'revision'>;
  readonly participantId: string;
  readonly envelope: unknown;
  /** Injected server-only entropy source. A production shuffle must never use a client or deterministic fallback. */
  readonly randomize: (order: readonly CoreObjectId[]) => readonly CoreObjectId[];
}>;

/** Binds a public intent after seat authorization; the client never supplies authority or order. */
export function bindOnlineTabletopIntentOnServerV1(input: OnlineTabletopServerBindingInputV1): OnlineTabletopCommandResultV1 {
  const checked = validateOnlineTabletopIntentEnvelopeV1(input.envelope);
  if (!checked.ok) throw new Error('Invalid tabletop intent');
  const envelope: OnlineTabletopIntentEnvelopeV1 = checked.value;
  if (envelope.baseRevision !== input.state.revision) throw new Error('Stale tabletop revision');
  if (input.state.room.lifecycle !== 'active') throw new Error('Tabletop room is not active');
  const participant = input.state.room.participants.find((entry) => entry.participantId === input.participantId);
  if (participant === undefined || participant.role !== 'player' || participant.seatIndex === null) throw new Error('Participant is not an authorized player');
  const seat = input.state.room.seats[participant.seatIndex];
  if (seat === undefined || seat.outcome !== 'pending') throw new Error('Participant seat is unavailable');
  const actorPlayerId = seat.corePlayerId;
  const primitive = envelope.primitive;
  if (primitive.kind !== 'shuffle') return bindOnlineTabletopIntentToCoreCommandV1({ envelope, binding: { actorPlayerId, decisionMakerPlayerId: actorPlayerId, decisionContext: { kind: 'decision', decisionKey: 'tabletop-manual' } } });
  const library = input.state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.zones.byPlayer[actorPlayerId]?.library;
  if (library === undefined) throw new Error('Actor library is unavailable');
  const afterOrder = input.randomize(Object.freeze(library.slice()));
  if (afterOrder.length !== library.length || new Set(afterOrder).size !== library.length || afterOrder.some((id) => !library.includes(id))) throw new Error('Server random source returned an invalid order');
  const randomEnvelope = Object.freeze({ ...envelope, primitive: Object.freeze({ kind: 'shuffle' as const }) });
  const randomDecisionId = `manual-shuffle-${coreCanonicalDigestFromValueV1(envelope.commandId).slice(0, 96)}`;
  return bindOnlineTabletopIntentToCoreCommandV1({ envelope: randomEnvelope, binding: { actorPlayerId, decisionMakerPlayerId: actorPlayerId, decisionContext: { kind: 'decision', decisionKey: 'tabletop-manual' }, random: { randomDecisionId, zone: { kind: 'player-zone', playerId: actorPlayerId, zone: 'library' }, beforeOrder: Object.freeze(library.slice()), afterOrder: Object.freeze(afterOrder.slice()) } } });
}

export type OnlineTabletopServerBoundCommandV1 = CoreCommandV1;
