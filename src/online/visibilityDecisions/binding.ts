import { coreVisibilityTopLibraryPrefixDigestV1, coreCanonicalDigestFromValueV1, type CoreObjectId } from '../../engine/core/index';
import { createCoreCommandV1, type CoreCommandV1, type CoreRuleDurationV1 } from '../../engine/core/index';
import { validateOnlineVariableProtocolStateV2, type OnlineVariableProtocolStateV2 } from '../protocol/variable';
import { validateOnlineVisibilityIntentV1 } from './validation';
import { onlineProjectedSearchSessionHandleV1 } from './sessionHandle';
import type { OnlineVisibilityBindingInputV1, OnlineVisibilityBindingResultV1 } from './types';

type AnyRecord = Record<string, unknown>;
function record(value: unknown): AnyRecord | null { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as AnyRecord : null; }
function participantSeat(state: OnlineVariableProtocolStateV2, participantId: string) {
  const participant = state.room.participants.find((entry) => entry.participantId === participantId);
  if (!participant || participant.role !== 'player' || participant.seatIndex === null) throw new Error('authorization');
  if (participant.presence !== 'connected') throw new Error('PARTICIPANT_NOT_CONNECTED');
  const seat = state.room.seats[participant.seatIndex]; if (!seat) throw new Error('authorization');
  return seat;
}
function projectedVisibleObjectIds(projection: unknown, allowConcealed = false): ReadonlySet<CoreObjectId> {
  const root = record(projection);
  const game = record(root?.game);
  const zones = record(game?.zones);
  const visible = new Set<CoreObjectId>();
  const collectZone = (value: unknown): void => {
    const zone = record(value);
    const entries = zone?.entries;
    if (!Array.isArray(entries)) return;
    for (const entry of entries) {
      const row = record(entry);
      // A concealed-object projection carries only an opaque object handle
      // (never card identity).  It is still a permitted subject handle for
      // the owning/controlling seat; authoritative ownership/zone checks
      // below remain mandatory before binding the command.
      if ((row?.kind === 'visible-object' || allowConcealed && row?.kind === 'concealed-object') && typeof row.objectId === 'string') visible.add(row.objectId as CoreObjectId);
    }
  };
  const byPlayer = zones?.byPlayer;
  if (Array.isArray(byPlayer)) {
    for (const group of byPlayer) {
      const playerZones = record(record(group)?.zones);
      for (const zone of ['library', 'hand', 'graveyard']) collectZone(playerZones?.[zone]);
    }
  }
  for (const zone of ['battlefield', 'stack', 'exile', 'command']) collectZone(zones?.[zone]);
  const sessions = game?.searchSessions;
  if (Array.isArray(sessions)) {
    for (const session of sessions) collectZone({ entries: record(session)?.candidates });
  }
  return visible;
}
function resolveHandle(state: OnlineVariableProtocolStateV2, handle: string, projection: unknown, allowConcealed = false): CoreObjectId {
  if (projection === undefined) throw new Error('projection');
  const visible = projectedVisibleObjectIds(projection, allowConcealed);
  if (!visible.has(handle as CoreObjectId)) throw new Error('subject');
  const registry = state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
  if (!Object.prototype.hasOwnProperty.call(registry.objects, handle)) throw new Error('subject');
  return handle as CoreObjectId;
}
function command(state: OnlineVariableProtocolStateV2, actorPlayerId: string, decisionMakerPlayerId: string, context: CoreCommandV1['decisionContext'], payload: CoreCommandV1['payload']): CoreCommandV1 {
  return createCoreCommandV1({ schemaVersion: 1, sequence: state.revision + 1, actorPlayerId: actorPlayerId as never, decisionMakerPlayerId: decisionMakerPlayerId as never, decisionContext: context, payload });
}
function activePlayerIds(state: OnlineVariableProtocolStateV2): readonly string[] { return state.room.seats.filter((seat) => seat.outcome === 'pending').map((seat) => seat.corePlayerId); }
function projectedSearchSessionKey(
  state: OnlineVariableProtocolStateV2,
  projection: unknown,
  handle: string,
): string {
  const projectionRecord = record(projection);
  if (projectionRecord?.revision !== state.revision) throw new Error('session');
  const game = record(projectionRecord?.game);
  const projectedSessions = game?.searchSessions;
  if (!Array.isArray(projectedSessions)) throw new Error('session');
  if (projectedSessions.filter((entry) => record(entry)?.sessionId === handle).length !== 1) throw new Error('session');
  return authoritativeSearchSessionKey(state, handle, state.revision);
}
function authoritativeSearchSessionKey(state: OnlineVariableProtocolStateV2, handle: string, projectionRevision: number): string {
  const matches = state.coreRoot.ruleAuthority.searchSessions.sessionOrder.filter((key) => onlineProjectedSearchSessionHandleV1(key, projectionRevision) === handle);
  if (matches.length !== 1) throw new Error('session');
  return matches[0];
}
function visibilityGrantKeyV1(sequence: number, actorPlayerId: string, commandId: string): string {
  return `visibility-${coreCanonicalDigestFromValueV1({ kind: 'visibility-grant-key-v1', sequence, actorPlayerId, commandId }).slice(0, 40)}`;
}
function objectLocation(state: OnlineVariableProtocolStateV2, objectId: CoreObjectId): { kind: 'player-zone'; playerId: string; zone: string } | { kind: 'shared-zone'; zone: string } | null {
  const registry = state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
  for (const playerId of registry.turnOrder) for (const zone of ['library', 'hand', 'graveyard'] as const) if (registry.zones.byPlayer[playerId][zone].includes(objectId)) return { kind: 'player-zone', playerId, zone };
  for (const zone of ['battlefield', 'stack', 'exile', 'command'] as const) if (registry.zones.shared[zone].includes(objectId)) return { kind: 'shared-zone', zone };
  return null;
}
function effectiveController(state: OnlineVariableProtocolStateV2, objectId: CoreObjectId): string | null {
  const registry = state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
  const object = registry.objects[objectId] as unknown as AnyRecord | undefined;
  if (!object) return null;
  let controller = (object.kind === 'spell-copy' ? object.controllerPlayerId : object.baseControllerPlayerId) ?? object.controllerPlayerId ?? null;
  for (const key of state.coreRoot.ruleAuthority.control.effectOrder) {
    const effect = state.coreRoot.ruleAuthority.control.byEffect[key];
    if (effect.targetObjectId === objectId) controller = effect.gainingControllerPlayerId;
  }
  return typeof controller === 'string' ? controller : null;
}
function subjectAuthorized(state: OnlineVariableProtocolStateV2, actor: string, objectId: CoreObjectId): boolean {
  const location = objectLocation(state, objectId); if (location === null) return false;
  const registry = state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
  const object = registry.objects[objectId] as unknown as AnyRecord | undefined; if (!object) return false;
  const owner = object.kind === 'card' ? registry.physicalCards[object.physicalCardId as never]?.ownerPlayerId : object.ownerPlayerId;
  const controller = effectiveController(state, objectId);
  const supported = location.kind === 'player-zone' ? (location.zone === 'hand' || location.zone === 'graveyard') && location.playerId === actor : ['battlefield', 'stack', 'exile', 'command'].includes(location.zone);
  return supported && (owner === actor || controller === actor);
}

function equalStringArray(left: unknown, right: readonly string[]): boolean {
  if (!Array.isArray(left) || left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

/**
 * Match a retrying high-level intent against the command that was accepted for
 * the same command ID.  The protocol receipt digest protects the bound
 * command, so this check must ensure that a changed E intent cannot reuse the
 * old command merely by keeping its command ID and base revision.
 */
function visibilityDuplicateMatchesV1(
  state: OnlineVariableProtocolStateV2,
  participantId: string,
  envelope: import('./types').OnlineVisibilityIntentEnvelopeV1,
  existingValue: unknown,
  projection: unknown,
): existingValue is CoreCommandV1 {
  const existing = record(existingValue);
  const payload = record(existing?.payload);
  if (existing === null || payload === null
    || existing.kind !== 'mode-neutral-core-command-v1'
    || existing.sequence !== envelope.baseRevision + 1
    || typeof existing.actorPlayerId !== 'string'
    || typeof existing.decisionMakerPlayerId !== 'string') return false;
  const participant = state.room.participants.find((entry) => entry.participantId === participantId);
  const seat = participant === undefined || participant.role !== 'player' || participant.seatIndex === null
    ? undefined
    : state.room.seats[participant.seatIndex];
  if (seat === undefined) return false;
  const actor = existing.actorPlayerId;
  if (envelope.look !== undefined || envelope.reveal !== undefined) {
    const branch = envelope.look ?? envelope.reveal;
    if (branch === undefined || payload.kind !== 'visibility-open') return false;
    const grant = record(payload.grant);
    if (actor !== seat.corePlayerId || existing.decisionMakerPlayerId !== seat.corePlayerId
      || grant === null
      || payload.grantKey !== visibilityGrantKeyV1(existing.sequence, actor, envelope.commandId)
      || grant.mode !== (envelope.look === undefined ? 'reveal' : 'look')
      || grant.networkBound !== true) return false;
    const grantSubject = record(grant.subject);
    if (grantSubject === null) return false;
    let expectedSubjectObjectId: string | null = null;
    if (branch.subject.kind === 'top-of-library') {
      if (grantSubject.kind !== 'top-of-library' || grantSubject.playerId !== actor || grantSubject.count !== branch.subject.count) return false;
    } else {
      if (grantSubject.kind !== 'object' || typeof grantSubject.objectId !== 'string') return false;
      let expectedObjectId = branch.subject.handle;
      try { expectedObjectId = resolveHandle(state, branch.subject.handle, projection, true); } catch { /* A completed retry may no longer project the original handle. */ }
      expectedSubjectObjectId = expectedObjectId;
      if (grantSubject.objectId !== expectedObjectId) return false;
    }
    const audience = record(grant.audience);
    if (audience === null) return false;
    if (envelope.look !== undefined) {
      if (audience.kind !== 'players' || !equalStringArray(audience.playerIds, envelope.look.viewerPlayerIds)) return false;
    } else if (audience.kind !== 'all-players') return false;
    const duration = record(grant.duration);
    if (duration === null) return false;
    let expectedSourceObjectId: string | null = branch.subject.kind === 'object' ? expectedSubjectObjectId : null;
    if (branch.duration.kind === 'source-bound') {
      let expectedSourceId = branch.duration.sourceHandle;
      try { expectedSourceId = resolveHandle(state, branch.duration.sourceHandle, projection); } catch { /* See object-subject retry note above. */ }
      expectedSourceObjectId = expectedSourceId;
      if (duration.kind !== 'while-source-exists' || duration.sourceObjectId !== expectedSourceId) return false;
    } else if (branch.duration.kind === 'next-command') {
      if (duration.kind !== 'until-next-command' || duration.openingSequence !== existing.sequence) return false;
    } else if (branch.duration.kind === 'end-of-turn') {
      if (duration.kind !== 'until-end-of-turn') return false;
    } else if (duration.kind !== 'until-search-completes' || typeof duration.searchSessionId !== 'string' || onlineProjectedSearchSessionHandleV1(duration.searchSessionId, envelope.baseRevision) !== branch.duration.searchSessionId) return false;
    if (grant.sourceObjectId !== expectedSourceObjectId) return false;
    return true;
  }
  if (envelope.choose !== undefined) {
    if (payload.kind !== 'search-complete' || existing.decisionMakerPlayerId !== seat.corePlayerId || typeof payload.sessionKey !== 'string' || onlineProjectedSearchSessionHandleV1(payload.sessionKey, envelope.baseRevision) !== envelope.choose.searchSessionId) return false;
    return equalStringArray(payload.selectedObjectIds, envelope.choose.candidateHandles);
  }
  return false;
}

export function bindOnlineVisibilityV1(input: OnlineVisibilityBindingInputV1): OnlineVisibilityBindingResultV1 {
  const stateResult = validateOnlineVariableProtocolStateV2(input.state); if (!stateResult.ok) throw new Error('state');
  const state = stateResult.value; const checked = validateOnlineVisibilityIntentV1(input.envelope); if (!checked.ok) throw new Error('intent');
  const envelope = checked.value; const seat = participantSeat(state, input.participantId); const actor = seat.corePlayerId as string;
  const active = activePlayerIds(state);
  if (envelope.baseRevision !== state.revision) {
    if (input.existingCommand !== undefined && input.existingCommand !== null) {
      if (visibilityDuplicateMatchesV1(state, input.participantId, envelope, input.existingCommand, input.projection)) {
        const existing = input.existingCommand;
        return Object.freeze({ command: existing, actorPlayerId: existing.actorPlayerId, decisionMakerPlayerId: existing.decisionMakerPlayerId });
      }
    }
    throw new Error('stale');
  }
  if (envelope.look !== undefined || envelope.reveal !== undefined) {
    const branch = envelope.look ?? envelope.reveal;
    if (!branch) throw new Error('intent');
    const subject = branch.subject.kind === 'object' ? { kind: 'object' as const, objectId: resolveHandle(state, branch.subject.handle, input.projection, true) } : { kind: 'top-of-library' as const, playerId: seat.corePlayerId as never, count: branch.subject.count };
    const registry = state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
    if (subject.kind === 'object' && !subjectAuthorized(state, actor, subject.objectId)) throw new Error('subject');
    if (subject.kind === 'top-of-library' && subject.count > registry.zones.byPlayer[seat.corePlayerId].library.length) throw new Error('subject');
    const openingObjectIds = subject.kind === 'top-of-library' ? registry.zones.byPlayer[seat.corePlayerId].library.slice(0, subject.count) : undefined;
    const durationSpec = branch.duration;
    const sourceObjectId = durationSpec.kind === 'source-bound' ? resolveHandle(state, durationSpec.sourceHandle, input.projection) : null;
    if (durationSpec.kind === 'source-bound' && sourceObjectId === null) throw new Error('source');
    let resolvedChoiceSessionKey: string | null = null;
    let duration: CoreRuleDurationV1;
    if (durationSpec.kind === 'next-command') duration = { kind: 'until-next-command', openingSequence: state.revision + 1 };
    else if (durationSpec.kind === 'end-of-turn') duration = { kind: 'until-end-of-turn', turnNumber: state.coreRoot.ruleAuthority.turnPriorityBundle.lifecycle.turnNumber };
    else if (durationSpec.kind === 'source-bound') duration = { kind: 'while-source-exists', sourceObjectId: sourceObjectId as CoreObjectId };
    else {
      try {
        resolvedChoiceSessionKey = projectedSearchSessionKey(state, input.projection, durationSpec.searchSessionId);
      } catch {
        throw new Error('choice');
      }
      duration = { kind: 'until-search-completes', searchSessionId: resolvedChoiceSessionKey };
    }
    if (durationSpec.kind === 'source-bound') {
      const sourceLocation = objectLocation(state, sourceObjectId as CoreObjectId);
      if (sourceLocation === null || sourceLocation.kind !== 'shared-zone' || !['battlefield', 'stack', 'exile', 'command'].includes(sourceLocation.zone)) throw new Error('source');
      const sourceRegistry = state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
      const sourceObject = sourceRegistry.objects[sourceObjectId as CoreObjectId] as unknown as AnyRecord | undefined;
      const owner = sourceObject?.kind === 'card' ? sourceRegistry.physicalCards[sourceObject.physicalCardId as never]?.ownerPlayerId : sourceObject?.ownerPlayerId;
      const controller = effectiveController(state, sourceObjectId as CoreObjectId);
      if (owner !== actor && controller !== actor) throw new Error('source');
    }
    if (durationSpec.kind === 'choice-bound') {
      const choiceSession = resolvedChoiceSessionKey === null ? undefined : state.coreRoot.ruleAuthority.searchSessions.bySession[resolvedChoiceSessionKey as never];
      if (!choiceSession || (choiceSession.rulesActorPlayerId !== seat.corePlayerId && choiceSession.selectorPlayerId !== seat.corePlayerId)) throw new Error('choice');
    }
    const requestedViewers = envelope.look?.viewerPlayerIds ?? [];
    const canonicalViewers = active.slice().filter((id) => requestedViewers.includes(id)).sort();
    if (envelope.look !== undefined && canonicalViewers.length !== requestedViewers.length) throw new Error('audience');
    const audience = envelope.look !== undefined ? { kind: 'players' as const, playerIds: canonicalViewers as never } : { kind: 'all-players' as const };
    const grantKey = visibilityGrantKeyV1(state.revision + 1, actor, envelope.commandId);
    // `sourceObjectId` is the independently bound source for source-bound
    // durations.  For other durations retain the existing object-subject
    // linkage used by Core's subject/invalidation contract.
    const grantSourceObjectId = durationSpec.kind === 'source-bound'
      ? sourceObjectId
      : subject.kind === 'object' ? subject.objectId : null;
    const grant = { subject, audience, mode: envelope.look !== undefined ? 'look' as const : 'reveal' as const, sourceObjectId: grantSourceObjectId, duration, networkBound: true, ...(openingObjectIds === undefined ? {} : { openingObjectIds, topLibraryPrefixDigest: coreVisibilityTopLibraryPrefixDigestV1(openingObjectIds) }) };
    const bound = command(state, actor, actor, { kind: 'decision', decisionKey: 'visibility' }, { kind: 'visibility-open', grantKey: grantKey, grant });
    return Object.freeze({ command: bound, actorPlayerId: seat.corePlayerId, decisionMakerPlayerId: seat.corePlayerId, grantKey });
  }
  if (envelope.choose !== undefined) {
    const authoritativeSessionKey = authoritativeSearchSessionKey(state, envelope.choose.searchSessionId, state.revision);
    const session = state.coreRoot.ruleAuthority.searchSessions.bySession[authoritativeSessionKey]; if (!session) throw new Error('session');
    if (session.selectorPlayerId !== seat.corePlayerId) throw new Error('selector');
    const sessionKey = projectedSearchSessionKey(state, input.projection, envelope.choose.searchSessionId);
    if (sessionKey !== authoritativeSessionKey) throw new Error('session');
    // The Core criteria key is opaque and has no evaluator in this slice.
    // Qualified choices are therefore only allowed to complete with an empty
    // result when the server-owned may-fail flag explicitly permits it.
    if (session.criteria.kind === 'qualified' && (session.criteria.mayFailToFind !== true || envelope.choose.candidateHandles.length > 0)) throw new Error('criteria');
    const projectionRecord = record(input.projection);
    const projectedGame = record(projectionRecord?.game);
    const projectedSessions: readonly unknown[] = Array.isArray(projectedGame?.searchSessions) ? projectedGame.searchSessions : [];
    const projectedSession = projectedSessions.find((entry: unknown) => record(entry)?.sessionId === envelope.choose?.searchSessionId);
    if (projectedSession === undefined) throw new Error('session');
    const projectedCandidateIds = new Set<string>();
    const projectedCandidates = projectedSession === undefined ? [] : record(projectedSession)?.candidates;
    if (Array.isArray(projectedCandidates)) for (const candidate of projectedCandidates) { const id = record(candidate)?.objectId; if (typeof id === 'string') projectedCandidateIds.add(id); }
    const selected = envelope.choose.candidateHandles.map((handle) => resolveHandle(state, handle, input.projection));
    if (new Set(selected).size !== selected.length || selected.some((id) => !session.candidateObjectIds.includes(id) || input.projection !== undefined && !projectedCandidateIds.has(id))) throw new Error('candidate');
    const bound = command(state, session.rulesActorPlayerId, seat.corePlayerId, { kind: 'search-session', searchSessionId: sessionKey }, { kind: 'search-complete', sessionKey, selectedObjectIds: selected });
    return Object.freeze({ command: bound, actorPlayerId: session.rulesActorPlayerId, decisionMakerPlayerId: seat.corePlayerId });
  }
  throw new Error('intent');
}

export const bindOnlineVisibilityIntentV1 = bindOnlineVisibilityV1;
