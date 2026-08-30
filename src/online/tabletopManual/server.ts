import {
  coreCanonicalDigestFromValueV1,
  createCoreCommandV1,
  currentCoreObjectControllerV1,
  type CoreCommandPayloadV1,
  type CoreCommandV1,
  type CoreGameObjectIdentityV2,
  type CoreObjectId,
  type CoreObjectRegistryStateV2,
  type CorePlayerId,
  type CoreTurnPositionV1,
} from '../../engine/core/index';
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
  const registry = input.state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
  if (primitive.kind === 'move' && primitive.destination?.kind === 'stack') throw new Error('Cards enter the stack through cast-spell');
  if (primitive.kind === 'play-land' || primitive.kind === 'cast-spell') {
    const objectId = primitive.objectId;
    if (objectId === undefined) throw new Error('Card selection is required');
    const object = registry.objects[objectId];
    const hand = registry.zones.byPlayer[actorPlayerId]?.hand ?? [];
    if (object === undefined || object.kind !== 'card' || !hand.includes(objectId)) throw new Error('Card must be in the actor hand');
    const physical = registry.physicalCards[object.physicalCardId];
    const definition = physical === undefined ? undefined : registry.cardDefinitions[physical.definitionId];
    const typeLine = definition?.faces[0]?.typeLine ?? definition?.typeLine ?? '';
    const isLand = /\bLand\b/u.test(typeLine);
    if (primitive.kind === 'play-land') {
      const turn = input.state.coreRoot.ruleAuthority.turnPriorityBundle;
      const window = turn.lifecycle.window;
      if (!isLand || registry.players[actorPlayerId]?.landsPlayedThisTurn !== 0
        || registry.activePlayerId !== actorPlayerId
        || window.kind !== 'priority' || window.holderPlayerId !== actorPlayerId
        || turn.stackBundle.objectRegistry.zones.shared.stack.length !== 0
        || (turn.lifecycle.position.phase !== 'precombat-main' && turn.lifecycle.position.phase !== 'postcombat-main')) {
        throw new Error('Land play is not legal in the current turn window');
      }
      const payload = { kind: 'table-land-play' as const, objectId };
      const command = createCoreCommandV1({ schemaVersion: 1, sequence: envelope.baseRevision + 1, actorPlayerId, decisionMakerPlayerId: actorPlayerId, decisionContext: { kind: 'decision', decisionKey: 'play-land' }, payload });
      return Object.freeze({ envelope, command });
    }
    if (isLand) throw new Error('Land cards use play-land');
    const turn = input.state.coreRoot.ruleAuthority.turnPriorityBundle;
    if (turn.lifecycle.window.kind !== 'priority' || turn.lifecycle.window.holderPlayerId !== actorPlayerId) {
      throw new Error('The actor must hold priority to cast a spell');
    }
    const isInstant = /\bInstant\b/u.test(typeLine);
    const hasFlash = (definition?.keywords ?? []).some((keyword) => keyword.toLowerCase() === 'flash');
    if (!isInstant && !hasFlash && (registry.activePlayerId !== actorPlayerId
      || (turn.lifecycle.position.phase !== 'precombat-main' && turn.lifecycle.position.phase !== 'postcombat-main')
      || turn.stackBundle.objectRegistry.zones.shared.stack.length !== 0)) {
      throw new Error('Non-Flash spells require the active player during an empty main-phase stack');
    }
    const announcement = {
      kind: 'card-spell' as const,
      abilityTextSnapshot: null,
      chosenModeKeys: [],
      targetSelections: [],
      announcedVariables: [],
      distributions: [],
      costChoices: { alternativeCost: null, additionalCosts: [] },
    };
    const payload = { kind: 'stack-commit-card-spell' as const, input: { sourceObjectId: objectId, controllerPlayerId: actorPlayerId, announcement } };
    const command = createCoreCommandV1({ schemaVersion: 1, sequence: envelope.baseRevision + 1, actorPlayerId, decisionMakerPlayerId: actorPlayerId, decisionContext: { kind: 'decision', decisionKey: 'cast-spell' }, payload });
    return Object.freeze({ envelope, command });
  }
  if (primitive.kind === 'priority-hold') {
    return bindOnlineTabletopIntentToCoreCommandV1({ envelope, binding: { actorPlayerId, decisionMakerPlayerId: actorPlayerId, decisionContext: { kind: 'decision', decisionKey: 'assisted-priority-hold' } } });
  }
  if (primitive.kind === 'stack-entry') {
    const manual = input.state.coreRoot.tabletopManual;
    if ((manual?.priorityHolds ?? []).length > 0) throw new Error('Active priority HOLD blocks source-less manual entries');
    if (primitive.sourceObjectId === undefined || primitive.sourceObjectId === null) {
      const turn = input.state.coreRoot.ruleAuthority.turnPriorityBundle;
      if (registry.activePlayerId !== actorPlayerId || turn.stackBundle.objectRegistry.zones.shared.stack.length !== 0) throw new Error('Source-less manual entries require the active player and an empty Core stack');
    } else {
      const source = registry.objects[primitive.sourceObjectId];
      const steward = source?.kind === 'activated-ability' || source?.kind === 'triggered-ability' || source?.kind === 'spell-copy'
        ? source.controllerPlayerId
        : source?.kind === 'card' || source?.kind === 'token'
          ? currentCoreObjectControllerV1(registry, input.state.coreRoot.ruleAuthority.control, primitive.sourceObjectId)
          : null;
      if (steward !== actorPlayerId) throw new Error('Only the current stack steward may add a source-backed manual entry');
    }
    return bindOnlineTabletopIntentToCoreCommandV1({ envelope, binding: { actorPlayerId, decisionMakerPlayerId: actorPlayerId, decisionContext: { kind: 'decision', decisionKey: 'tabletop-manual' } } });
  }
  if (primitive.kind === 'manual-resolve') {
    const manual = input.state.coreRoot.tabletopManual;
    const entry = manual?.stackEntries.at(-1);
    if (entry === undefined || (primitive.entryId !== undefined && primitive.entryId !== entry.id)) throw new Error('Only the current manual stack top may resolve');
    if (entry.authorPlayerId !== actorPlayerId) throw new Error('Only the manual entry author may resolve');
    if ((manual?.priorityHolds ?? []).length > 0) throw new Error('Active priority HOLD blocks manual resolve');
    const turn = input.state.coreRoot.ruleAuthority.turnPriorityBundle;
    const stack = turn.stackBundle.objectRegistry.zones.shared.stack;
    if (entry.sourceObjectId === null) {
      if (turn.stackBundle.objectRegistry.activePlayerId !== actorPlayerId || stack.length !== 0) throw new Error('Manual resolution requires the active steward and an empty Core stack');
    } else {
      const topObject = turn.stackBundle.objectRegistry.objects[entry.sourceObjectId];
      const steward = topObject?.kind === 'card' ? topObject.baseControllerPlayerId : topObject?.kind === 'spell-copy' || topObject?.kind === 'activated-ability' || topObject?.kind === 'triggered-ability' ? topObject.controllerPlayerId : null;
      if (turn.lifecycle.window.kind !== 'resolution-ready' || turn.lifecycle.window.objectId !== entry.sourceObjectId || stack.at(-1) !== entry.sourceObjectId || steward !== actorPlayerId) throw new Error('Manual source must be the current Core stack top');
    }
    const payload = { kind: 'table-manual-resolve' as const, ...(primitive.entryId === undefined ? {} : { entryId: primitive.entryId }), manualMode: envelope.mode };
    const command = createCoreCommandV1({ schemaVersion: 1, sequence: envelope.baseRevision + 1, actorPlayerId, decisionMakerPlayerId: actorPlayerId, decisionContext: { kind: 'decision', decisionKey: 'assisted-manual-resolve' }, payload });
    return Object.freeze({ envelope, command });
  }
  if (primitive.kind === 'priority-advance' || primitive.kind === 'priority-resolve') {
    const turn = input.state.coreRoot.ruleAuthority.turnPriorityBundle;
    const window = turn.lifecycle.window;
    const stack = turn.stackBundle.objectRegistry.zones.shared.stack;
    const top = stack.at(-1) ?? null;
    const topObject = top === null ? null : turn.stackBundle.objectRegistry.objects[top];
    const stewardPlayerId: CorePlayerId | null = top === null
      ? turn.stackBundle.objectRegistry.activePlayerId
      : topObject?.kind === 'activated-ability' || topObject?.kind === 'triggered-ability'
        ? topObject.controllerPlayerId
        : topObject?.kind === 'spell-copy'
          ? topObject.controllerPlayerId
          : topObject?.kind === 'card'
            ? topObject.baseControllerPlayerId
            : null;
    if (stewardPlayerId !== actorPlayerId) throw new Error('Only the current stack steward may advance or resolve');
    if ((input.state.coreRoot.tabletopManual?.priorityHolds ?? []).length > 0) throw new Error('Active priority HOLD blocks advance or resolve');
    let payload: CoreCommandPayloadV1;
    if (primitive.kind === 'priority-resolve') {
      if (window.kind !== 'resolution-ready' || top === null || window.objectId !== top) throw new Error('Stack is not ready to resolve');
      const object = turn.stackBundle.objectRegistry.objects[top];
      if (object === undefined) throw new Error('Stack object is unavailable');
      payload = object.kind === 'card'
        ? { kind: 'stack-remove-object', input: { kind: 'card-to-zone', objectId: top, destination: isPermanentCard(registry, object) ? { kind: 'battlefield', baseControllerPlayerId: stewardPlayerId } : { kind: 'owner-graveyard' } } }
        : { kind: 'stack-remove-object', input: { kind: 'cease', objectId: top } };
    } else {
      if (window.kind === 'turn-based-action-required') {
        payload = { kind: 'table-turn-progress', transition: { kind: 'checkpoint' } };
      } else if (window.kind === 'position-advance-ready') {
        const firstTurnDrawSkip = turn.lifecycle.turnNumber === 1
          && turn.lifecycle.position.phase === 'beginning'
          && turn.lifecycle.position.step === 'upkeep'
          && turn.stackBundle.objectRegistry.turnOrder.length === 2;
        payload = { kind: 'table-turn-progress', transition: firstTurnDrawSkip ? { kind: 'first-turn-draw-skip' } : { kind: 'position', nextPosition: nextPosition(turn.lifecycle.position) } };
      } else if (window.kind === 'turn-advance-ready' || window.kind === 'cleanup-repeat-ready') {
        payload = { kind: 'table-turn-progress', transition: { kind: 'next-turn' } };
      } else {
        throw new Error('No assisted priority advance is available');
      }
    }
    const command = createCoreCommandV1({ schemaVersion: 1, sequence: envelope.baseRevision + 1, actorPlayerId, decisionMakerPlayerId: actorPlayerId, decisionContext: { kind: 'decision', decisionKey: primitive.kind === 'priority-resolve' ? 'assisted-priority-resolve' : 'assisted-priority-advance' }, payload });
    return Object.freeze({ envelope, command });
  }
  if (primitive.kind !== 'shuffle') return bindOnlineTabletopIntentToCoreCommandV1({ envelope, binding: { actorPlayerId, decisionMakerPlayerId: actorPlayerId, decisionContext: { kind: 'decision', decisionKey: 'tabletop-manual' } } });
  const library = input.state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.zones.byPlayer[actorPlayerId]?.library;
  if (library === undefined) throw new Error('Actor library is unavailable');
  const afterOrder = input.randomize(Object.freeze(library.slice()));
  if (afterOrder.length !== library.length || new Set(afterOrder).size !== library.length || afterOrder.some((id) => !library.includes(id))) throw new Error('Server random source returned an invalid order');
  const randomEnvelope = Object.freeze({ ...envelope, primitive: Object.freeze({ kind: 'shuffle' as const }) });
  const randomDecisionId = `manual-shuffle-${coreCanonicalDigestFromValueV1(envelope.commandId).slice(0, 96)}`;
  return bindOnlineTabletopIntentToCoreCommandV1({ envelope: randomEnvelope, binding: { actorPlayerId, decisionMakerPlayerId: actorPlayerId, decisionContext: { kind: 'decision', decisionKey: 'tabletop-manual' }, random: { randomDecisionId, zone: { kind: 'player-zone', playerId: actorPlayerId, zone: 'library' }, beforeOrder: Object.freeze(library.slice()), afterOrder: Object.freeze(afterOrder.slice()) } } });
}

function nextPosition(position: CoreTurnPositionV1): CoreTurnPositionV1 {
  if (position.phase === 'beginning') {
    if (position.step === 'untap') return { phase: 'beginning', step: 'upkeep' };
    if (position.step === 'upkeep') return { phase: 'beginning', step: 'draw' };
    return { phase: 'precombat-main', step: null };
  }
  if (position.phase === 'precombat-main') return { phase: 'combat', step: 'beginning-of-combat' };
  if (position.phase === 'combat') {
    if (position.step === 'beginning-of-combat') return { phase: 'combat', step: 'declare-attackers' };
    if (position.step === 'declare-attackers') return { phase: 'combat', step: 'declare-blockers' };
    if (position.step === 'declare-blockers') return { phase: 'combat', step: 'combat-damage' };
    if (position.step === 'combat-damage') return { phase: 'combat', step: 'end-of-combat' };
    return { phase: 'postcombat-main', step: null };
  }
  if (position.phase === 'postcombat-main') return { phase: 'ending', step: 'end' };
  return position.step === 'end' ? { phase: 'ending', step: 'cleanup' } : { phase: 'beginning', step: 'untap' };
}

function isPermanentCard(
  registry: CoreObjectRegistryStateV2,
  object: Extract<CoreGameObjectIdentityV2, { readonly kind: 'card' }>,
): boolean {
  const physical = registry.physicalCards[object.physicalCardId];
  const definition = physical === undefined ? undefined : registry.cardDefinitions[physical.definitionId];
  const typeLine = definition?.faces[0]?.typeLine ?? definition?.typeLine ?? '';
  return !/\b(?:Instant|Sorcery)\b/u.test(typeLine);
}

export type OnlineTabletopServerBoundCommandV1 = CoreCommandV1;
