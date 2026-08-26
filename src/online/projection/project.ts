import {
  coreCanPlayerAttemptPlayObjectV1,
  coreCanPlayerViewObjectIdentityV1,
  coreDecisionMakerForV1,
  currentCoreObjectControllerV1,
  parseCoreObjectIdV2,
  type CoreGameObjectIdentityV2,
  type CoreObjectId,
  type CorePlayerId,
  type CoreRuleDurationV1,
  type CoreVisibilityGrantV1,
  type CoreVisibilitySubjectV1,
  type ModeNeutralCoreObjectRegistrySliceV2,
  type ModeNeutralCoreObjectRuntimeSliceV2,
} from '../../engine/core/index';
import type { OnlineProtocolStateV1 } from '../protocol/index';
import type { OnlineRoomParticipantV1 } from '../room/index';
import { CURRENT_CONTRACT_VERSIONS } from '../../versioning/index';
import { deepFreezeCopy } from './support';
import {
  ONLINE_PROJECTION_SCHEMA_VERSION_V1,
  type OnlineParticipantProjectionV1,
  type OnlineProjectedDurationV1,
  type OnlineProjectedGameV1,
  type OnlineProjectedObjectRuntimeV1,
  type OnlineProjectedPlayPermissionV1,
  type OnlineProjectedSearchSessionV1,
  type OnlineProjectedVisibilityGrantV1,
  type OnlineProjectedVisibleObjectV1,
  type OnlineProjectedZoneEntryV1,
  type OnlineProjectedZoneV1,
  type OnlineProjectionRequestV1,
} from './types';

class ProjectionConstructionError extends Error {}

type ProjectionContext = Readonly<{
  readonly state: OnlineProtocolStateV1;
  readonly request: OnlineProjectionRequestV1;
  readonly participant: OnlineRoomParticipantV1;
  readonly registry: ModeNeutralCoreObjectRegistrySliceV2;
  readonly runtime: ModeNeutralCoreObjectRuntimeSliceV2;
  readonly playerId: CorePlayerId | null;
  readonly effectiveViewerIds: readonly CorePlayerId[];
}>;

function effectiveViewers(
  state: OnlineProtocolStateV1,
  request: OnlineProjectionRequestV1,
  participant: OnlineRoomParticipantV1,
): readonly CorePlayerId[] {
  if (participant.role !== 'player') return Object.freeze([]);
  const playerId = state.room.seats[participant.seatIndex]?.corePlayerId;
  if (playerId === undefined) throw new ProjectionConstructionError();
  const values = new Set<CorePlayerId>([playerId]);
  if (request.decisionContext !== null) {
    for (const controlled of state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.turnOrder) {
      if (
        controlled !== playerId &&
        coreDecisionMakerForV1(
          state.coreRoot.ruleAuthority.decisionAuthorities,
          controlled,
          request.decisionContext,
        ) === playerId
      ) values.add(controlled);
    }
  }
  const turnOrder = state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.turnOrder;
  return Object.freeze(turnOrder.filter((candidate) => values.has(candidate)));
}

function observerGrantMatches(
  grant: CoreVisibilityGrantV1,
  registry: ModeNeutralCoreObjectRegistrySliceV2,
  objectId: CoreObjectId,
): boolean {
  if (grant.mode !== 'reveal' || grant.audience.kind !== 'all-players') return false;
  if (grant.subject.kind === 'object') return grant.subject.objectId === objectId;
  for (const playerId of registry.turnOrder) {
    const zones = registry.zones.byPlayer[playerId];
    for (const zone of ['library', 'hand', 'graveyard'] as const) {
      const index = zones[zone].indexOf(objectId);
      if (index < 0) continue;
      if (grant.subject.kind === 'zone') {
        return grant.subject.zone.kind === 'player-zone' &&
          grant.subject.zone.playerId === playerId && grant.subject.zone.zone === zone;
      }
      return zone === 'library' && grant.subject.playerId === playerId && index < grant.subject.count;
    }
  }
  for (const zone of ['battlefield', 'stack', 'exile', 'command'] as const) {
    if (!registry.zones.shared[zone].includes(objectId)) continue;
    return grant.subject.kind === 'zone' && grant.subject.zone.kind === 'shared-zone' && grant.subject.zone.zone === zone;
  }
  return false;
}

function observerCanView(ctx: ProjectionContext, objectId: CoreObjectId): boolean {
  const { registry, runtime } = ctx;
  for (const playerId of registry.turnOrder) {
    const zones = registry.zones.byPlayer[playerId];
    if (zones.graveyard.includes(objectId)) return true;
    if (zones.hand.includes(objectId) || zones.library.includes(objectId)) break;
  }
  const shared = registry.zones.shared;
  if (shared.command.includes(objectId)) return true;
  if (shared.battlefield.includes(objectId) || shared.stack.includes(objectId) || shared.exile.includes(objectId)) {
    const orientation = runtime.byObject[objectId]?.orientation;
    if (shared.exile.includes(objectId) ? orientation !== undefined && !orientation.faceDown : orientation?.faceDown !== true) return true;
  }
  return ctx.state.coreRoot.ruleAuthority.visibility.grantOrder.some((key) =>
    observerGrantMatches(ctx.state.coreRoot.ruleAuthority.visibility.byGrant[key], registry, objectId));
}

function playerCanView(ctx: ProjectionContext, objectId: CoreObjectId): boolean {
  const bundle = {
    objectRegistry: ctx.registry,
    objectRuntime: ctx.runtime,
    visibility: ctx.state.coreRoot.ruleAuthority.visibility,
    control: ctx.state.coreRoot.ruleAuthority.control,
  };
  for (const viewer of ctx.effectiveViewerIds) {
    if (coreCanPlayerViewObjectIdentityV1(bundle, viewer, objectId)) return true;
    const searches = ctx.state.coreRoot.ruleAuthority.searchSessions;
    for (const sessionId of searches.sessionOrder) {
      const session = searches.bySession[sessionId];
      if (!session.candidateObjectIds.includes(objectId)) continue;
      const direct = viewer === ctx.playerId &&
        (session.rulesActorPlayerId === viewer || session.selectorPlayerId === viewer);
      const controlled = ctx.request.decisionContext?.kind === 'search-session' &&
        ctx.request.decisionContext.searchSessionId === sessionId &&
        coreDecisionMakerForV1(
          ctx.state.coreRoot.ruleAuthority.decisionAuthorities,
          session.rulesActorPlayerId,
          ctx.request.decisionContext,
        ) === ctx.playerId && viewer === session.rulesActorPlayerId;
      if (!direct && !controlled) continue;
      if (coreCanPlayerViewObjectIdentityV1(bundle, viewer, objectId, {
        rulesActorPlayerId: session.rulesActorPlayerId,
        selectorPlayerId: session.selectorPlayerId,
        candidateObjectIds: session.candidateObjectIds,
      })) return true;
    }
  }
  return false;
}

function canView(ctx: ProjectionContext, objectId: CoreObjectId): boolean {
  return ctx.playerId === null ? observerCanView(ctx, objectId) : playerCanView(ctx, objectId);
}

function identityFacts(
  ctx: ProjectionContext,
  objectId: CoreObjectId,
  identity: CoreGameObjectIdentityV2,
): Readonly<{
  readonly ownerPlayerId: CorePlayerId | null;
  readonly controllerPlayerId: CorePlayerId | null;
  readonly commander: boolean;
  readonly definition: OnlineProjectedVisibleObjectV1['definition'];
}> {
  let ownerPlayerId: CorePlayerId | null = null;
  let commander = false;
  let definitionId: string | null = null;
  if (identity.kind === 'card') {
    const physical = ctx.registry.physicalCards[identity.physicalCardId];
    if (physical === undefined) throw new ProjectionConstructionError();
    ownerPlayerId = physical.ownerPlayerId;
    commander = ctx.state.coreRoot.commanders.some((entry) => entry.physicalCardId === identity.physicalCardId);
    definitionId = physical.definitionId;
  } else if (identity.kind === 'token') {
    ownerPlayerId = identity.ownerPlayerId;
    definitionId = identity.definitionId;
  } else if (identity.kind === 'spell-copy') definitionId = identity.definitionId;
  const definition = definitionId === null ? null : ctx.registry.cardDefinitions[definitionId as never];
  if (definitionId !== null && definition === undefined) throw new ProjectionConstructionError();
  const controllerPlayerId = identity.kind === 'activated-ability' || identity.kind === 'triggered-ability'
    ? identity.controllerPlayerId
    : currentCoreObjectControllerV1(
        ctx.registry,
        ctx.state.coreRoot.ruleAuthority.control,
        objectId,
      );
  return Object.freeze({
    ownerPlayerId,
    controllerPlayerId,
    commander,
    definition: definition === null || definition === undefined ? null : deepFreezeCopy(definition),
  });
}

function runtimeFor(
  ctx: ProjectionContext,
  objectId: CoreObjectId,
  identityVisible: boolean,
  publicHandles: ReadonlySet<CoreObjectId>,
): OnlineProjectedObjectRuntimeV1 | null {
  const runtime = ctx.runtime.byObject[objectId];
  if (runtime === undefined) return null;
  const target = runtime.attachment.attachedTo;
  const attachment = target === null
    ? Object.freeze({ kind: 'none' as const })
    : target.kind === 'player'
      ? Object.freeze({ kind: 'player' as const, playerId: target.playerId })
      : publicHandles.has(target.objectId)
        ? Object.freeze({ kind: 'object' as const, objectId: target.objectId })
        : Object.freeze({ kind: 'concealed' as const });
  return Object.freeze({
    faceIndex: identityVisible ? runtime.orientation.faceIndex : null,
    faceDown: runtime.orientation.faceDown,
    tapped: runtime.orientation.tapped,
    flipped: identityVisible ? runtime.orientation.flipped : null,
    phasedOut: runtime.orientation.phasedOut,
    counters: Object.freeze(runtime.counterDamage.counters.map((counter) => Object.freeze({ ...counter }))),
    markedDamage: runtime.counterDamage.markedDamage,
    attachment,
  });
}

function visibleObject(
  ctx: ProjectionContext,
  objectId: CoreObjectId,
  publicHandles: ReadonlySet<CoreObjectId>,
): OnlineProjectedVisibleObjectV1 {
  const identity = ctx.registry.objects[objectId];
  const parsed = parseCoreObjectIdV2(objectId);
  if (identity === undefined || parsed === null) throw new ProjectionConstructionError();
  return Object.freeze({
    kind: 'visible-object',
    objectId,
    objectKind: parsed.kind,
    ...identityFacts(ctx, objectId, identity),
    runtime: runtimeFor(ctx, objectId, true, publicHandles),
  });
}

function zoneEntry(
  ctx: ProjectionContext,
  objectId: CoreObjectId,
  hiddenZone: boolean,
  publicHandles: ReadonlySet<CoreObjectId>,
): OnlineProjectedZoneEntryV1 {
  if (canView(ctx, objectId)) return visibleObject(ctx, objectId, publicHandles);
  if (hiddenZone) return Object.freeze({ kind: 'hidden-card' });
  const identity = ctx.registry.objects[objectId];
  const parsed = parseCoreObjectIdV2(objectId);
  if (identity === undefined || parsed === null) throw new ProjectionConstructionError();
  const runtime = runtimeFor(ctx, objectId, false, publicHandles);
  if (runtime === null) throw new ProjectionConstructionError();
  return Object.freeze({
    kind: 'concealed-object',
    objectId,
    objectKind: parsed.kind,
    runtime,
  });
}

function zone(
  ids: readonly CoreObjectId[],
  ctx: ProjectionContext,
  hiddenZone: boolean,
  publicHandles: ReadonlySet<CoreObjectId>,
): OnlineProjectedZoneV1 {
  const entries = Object.freeze(ids.map((id) => zoneEntry(ctx, id, hiddenZone, publicHandles)));
  return Object.freeze({ count: entries.length, entries });
}

function normalizedDuration(
  duration: CoreRuleDurationV1 | { readonly kind: string; readonly turnNumber?: number },
): OnlineProjectedDurationV1 {
  if (duration.kind === 'until-end-of-turn') return Object.freeze({ kind: duration.kind, turnNumber: duration.turnNumber as number });
  if (duration.kind === 'while-source-exists') return Object.freeze({ kind: 'source-bound' });
  if (duration.kind === 'single-use') return Object.freeze({ kind: 'single-use' });
  if (duration.kind === 'manual') return Object.freeze({ kind: 'manual' });
  return Object.freeze({ kind: 'indefinite' });
}

function safeVisibilitySubject(
  ctx: ProjectionContext,
  subject: CoreVisibilitySubjectV1,
): OnlineProjectedVisibilityGrantV1['subject'] | null {
  if (subject.kind !== 'object') return deepFreezeCopy(subject);
  return canView(ctx, subject.objectId) ? Object.freeze({ kind: 'object', objectId: subject.objectId }) : null;
}

function visibilityGrants(ctx: ProjectionContext): readonly OnlineProjectedVisibilityGrantV1[] {
  const output: OnlineProjectedVisibilityGrantV1[] = [];
  const slice = ctx.state.coreRoot.ruleAuthority.visibility;
  for (const key of slice.grantOrder) {
    const grant = slice.byGrant[key];
    const effectiveForPlayerIds = ctx.playerId === null
      ? Object.freeze([]) as readonly CorePlayerId[]
      : Object.freeze(ctx.effectiveViewerIds.filter((id) =>
          grant.audience.kind === 'all-players' || grant.audience.playerIds.includes(id)));
    if (ctx.playerId === null) {
      if (grant.mode !== 'reveal' || grant.audience.kind !== 'all-players') continue;
    } else if (effectiveForPlayerIds.length === 0) continue;
    const subject = safeVisibilitySubject(ctx, grant.subject);
    if (subject === null) throw new ProjectionConstructionError();
    output.push(Object.freeze({
      effectiveForPlayerIds,
      mode: grant.mode,
      subject,
      duration: normalizedDuration(grant.duration),
    }));
  }
  return Object.freeze(output);
}

function mayReceiveSearch(ctx: ProjectionContext, sessionId: string): boolean {
  if (ctx.playerId === null) return false;
  const session = ctx.state.coreRoot.ruleAuthority.searchSessions.bySession[sessionId as never];
  if (session.rulesActorPlayerId === ctx.playerId || session.selectorPlayerId === ctx.playerId) return true;
  return ctx.request.decisionContext?.kind === 'search-session' &&
    ctx.request.decisionContext.searchSessionId === sessionId &&
    coreDecisionMakerForV1(
      ctx.state.coreRoot.ruleAuthority.decisionAuthorities,
      session.rulesActorPlayerId,
      ctx.request.decisionContext,
    ) === ctx.playerId;
}

function searchSessions(
  ctx: ProjectionContext,
  publicHandles: ReadonlySet<CoreObjectId>,
): readonly OnlineProjectedSearchSessionV1[] {
  if (ctx.playerId === null) return Object.freeze([]);
  const output: OnlineProjectedSearchSessionV1[] = [];
  const slice = ctx.state.coreRoot.ruleAuthority.searchSessions;
  for (const sessionId of slice.sessionOrder) {
    if (!mayReceiveSearch(ctx, sessionId)) continue;
    const session = slice.bySession[sessionId];
    const candidates = session.candidateObjectIds.map((objectId) => {
      if (!canView(ctx, objectId)) throw new ProjectionConstructionError();
      return visibleObject(ctx, objectId, publicHandles);
    });
    output.push(Object.freeze({
      sessionId,
      rulesActorPlayerId: session.rulesActorPlayerId,
      selectorPlayerId: session.selectorPlayerId,
      zone: deepFreezeCopy(session.zone),
      portion: deepFreezeCopy(session.portion),
      criteria: deepFreezeCopy(session.criteria),
      revealFound: session.revealFound,
      shuffleAfter: session.shuffleAfter,
      candidates: Object.freeze(candidates),
    }));
  }
  return Object.freeze(output);
}

function playPermissions(ctx: ProjectionContext): readonly OnlineProjectedPlayPermissionV1[] {
  if (ctx.playerId === null) return Object.freeze([]);
  const output: OnlineProjectedPlayPermissionV1[] = [];
  const slice = ctx.state.coreRoot.ruleAuthority.playPermissions;
  for (const permissionId of slice.permissionOrder) {
    const permission = slice.byPermission[permissionId];
    if (!ctx.effectiveViewerIds.includes(permission.allowedPlayerId)) continue;
    const objectId = permission.subject.kind === 'object'
      ? permission.subject.objectId
      : ctx.registry.zones.byPlayer[permission.subject.playerId]?.library[0];
    if (objectId === undefined || !coreCanPlayerAttemptPlayObjectV1(
      ctx.registry,
      ctx.state.coreRoot.ruleAuthority.visibility,
      slice,
      permission.allowedPlayerId,
      objectId,
    )) continue;
    if (permission.subject.kind === 'object') {
      if (!canView(ctx, objectId)) continue;
      output.push(Object.freeze({
        permissionId,
        allowedPlayerId: permission.allowedPlayerId,
        action: permission.action,
        subject: Object.freeze({
          kind: 'object',
          objectId,
          expectedZone: deepFreezeCopy(permission.subject.expectedZone),
        }),
        duration: normalizedDuration(permission.duration),
      }));
    } else {
      output.push(Object.freeze({
        permissionId,
        allowedPlayerId: permission.allowedPlayerId,
        action: permission.action,
        subject: Object.freeze({
          kind: 'top-of-library',
          playerId: permission.subject.playerId,
          topObjectId: canView(ctx, objectId) ? objectId : null,
        }),
        duration: normalizedDuration(permission.duration),
      }));
    }
  }
  return Object.freeze(output);
}

function game(ctx: ProjectionContext): OnlineProjectedGameV1 {
  const registry = ctx.registry;
  const allPublic = new Set<CoreObjectId>([
    ...registry.zones.shared.battlefield,
    ...registry.zones.shared.stack,
    ...registry.zones.shared.exile,
    ...registry.zones.shared.command,
  ]);
  for (const playerId of registry.turnOrder) {
    for (const zoneIds of [registry.zones.byPlayer[playerId].library, registry.zones.byPlayer[playerId].hand]) {
      for (const objectId of zoneIds) if (canView(ctx, objectId)) allPublic.add(objectId);
    }
    for (const objectId of registry.zones.byPlayer[playerId].graveyard) allPublic.add(objectId);
  }
  const publicHandles = allPublic as ReadonlySet<CoreObjectId>;
  const lifecycle = ctx.state.coreRoot.playerLifecycle;
  const manual = ctx.state.coreRoot.tabletopManual;
  return Object.freeze({
    turnOrder: Object.freeze(registry.turnOrder.slice()),
    turn: Object.freeze({
      activePlayerId: registry.activePlayerId,
      turnNumber: ctx.state.coreRoot.ruleAuthority.turnPriorityBundle.lifecycle.turnNumber,
      positionSequence: ctx.state.coreRoot.ruleAuthority.turnPriorityBundle.lifecycle.positionSequence,
      position: deepFreezeCopy(ctx.state.coreRoot.ruleAuthority.turnPriorityBundle.lifecycle.position),
    }),
    players: Object.freeze(registry.turnOrder.map((playerId) => {
      const player = registry.players[playerId];
      const status = lifecycle.players.find((entry) => entry.playerId === playerId);
      if (player === undefined || status === undefined) throw new ProjectionConstructionError();
      return Object.freeze({
        playerId,
        ...player,
        manaPool: Object.freeze({ ...player.manaPool }),
        status: status.status,
        exitCause: status.exitCause,
      });
    })),
    zones: Object.freeze({
      byPlayer: Object.freeze(registry.turnOrder.map((playerId) => Object.freeze({
        playerId,
        zones: Object.freeze({
          library: zone(registry.zones.byPlayer[playerId].library, ctx, true, publicHandles),
          hand: zone(registry.zones.byPlayer[playerId].hand, ctx, true, publicHandles),
          graveyard: zone(registry.zones.byPlayer[playerId].graveyard, ctx, false, publicHandles),
        }),
      }))),
      battlefield: zone(registry.zones.shared.battlefield, ctx, false, publicHandles),
      stack: zone(registry.zones.shared.stack, ctx, false, publicHandles),
      exile: zone(registry.zones.shared.exile, ctx, false, publicHandles),
      command: zone(registry.zones.shared.command, ctx, false, publicHandles),
    }),
    visibilityGrants: visibilityGrants(ctx),
    searchSessions: searchSessions(ctx, publicHandles),
    playPermissions: playPermissions(ctx),
    ...(manual === undefined ? {} : {
      notes: Object.freeze(manual.noteOrder.map((id) => manual.notes[id]).filter((entry): entry is NonNullable<typeof entry> => entry !== undefined).map((entry) => Object.freeze({ ...entry }))),
      manualStack: Object.freeze(manual.stackEntries.map((entry) => Object.freeze({ ...entry }))),
    }),
  });
}

export function constructParticipantProjectionV1(
  state: OnlineProtocolStateV1,
  request: OnlineProjectionRequestV1,
  participant: OnlineRoomParticipantV1,
): OnlineParticipantProjectionV1 {
  const registry = state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
  const runtime = state.coreRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRuntime;
  const playerId = participant.role === 'player'
    ? state.room.seats[participant.seatIndex]?.corePlayerId ?? null
    : null;
  if (participant.role === 'player' && playerId === null) throw new ProjectionConstructionError();
  const ctx: ProjectionContext = Object.freeze({
    state,
    request,
    participant,
    registry,
    runtime,
    playerId,
    effectiveViewerIds: effectiveViewers(state, request, participant),
  });
  return Object.freeze({
    kind: 'online-participant-projection-v1',
    schemaVersion: ONLINE_PROJECTION_SCHEMA_VERSION_V1,
    protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion,
    roomId: state.room.roomId,
    participantId: participant.participantId,
    role: participant.role,
    corePlayerId: playerId,
    revision: state.revision,
    room: Object.freeze({
      lifecycle: state.room.lifecycle,
      hostParticipantId: state.room.hostParticipantId,
      participants: Object.freeze(state.room.participants.map((value) => Object.freeze({ ...value }))),
      seats: Object.freeze(state.room.seats.map((value) => Object.freeze({
        seatIndex: value.seatIndex,
        corePlayerId: value.corePlayerId,
        participantId: value.participantId,
        ready: value.ready,
        outcome: value.outcome,
      }))),
    }),
    game: game(ctx),
  });
}
