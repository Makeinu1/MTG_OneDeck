import {
  createCoreCommandV1,
  isCanonicalCoreObjectIdV2,
  isCoreBaseId,
  validateCoreCommandV1,
  type CoreCommandPayloadV1,
  type CoreObjectId,
  type CorePlayerId,
} from '../../engine/core/index';
import {
  validateOnlineClientHelloV1,
  validateOnlineCommandEnvelopeV1,
  isOnlineProtocolCommandIdV1,
  type OnlineCommandEnvelopeV1,
} from '../protocol/index';
import {
  validateOnlineParticipantProjectionAny,
  type OnlineParticipantProjectionV1,
  type OnlineProjectedPlayerV1,
  type OnlineProjectedVisibleObjectV1,
  type OnlineProjectedZoneEntryV1,
} from '../projection/index';
import type { OnlineDisplayPairingSessionV1 } from '../displayPairing/index';
import { OnlineGuidedActionsErrorV1, OnlineGuidedActionBindingErrorV1 } from './errors';
import {
  ONLINE_GUIDED_ACTIONS_SCHEMA_VERSION_V1,
  type OnlineGuidedActionV1,
  type OnlineGuidedActionsViewV1,
  type OnlineGuidedControlCandidateV1,
  type OnlineGuidedCounterV1,
  type OnlineGuidedPlayerSummaryV1,
  type OnlineGuidedSearchCandidateV1,
} from './types';

type SafeRecord = Record<string, unknown>;

const ACTION_FIELDS = [
  'kind', 'actorPlayerId', 'baseRevision', 'sessionId', 'selectedObjectIds', 'effectKey',
  'targetObjectId', 'gainingControllerPlayerId', 'sourceObjectId', 'duration',
  'attackerObjectId', 'defendingPlayerId', 'blockerObjectId', 'attackedObjectId',
  'objectId', 'note', 'playerId', 'replacementLifeTotal', 'reason', 'commanderObjectId',
  'replacementDamageTotal',
] as const;

function freezeDeep<T>(value: T): T {
  const visited = new WeakSet<object>();
  const freeze = (current: unknown): void => {
    if (current === null || typeof current !== 'object' || visited.has(current)) return;
    visited.add(current);
    for (const child of Object.values(current)) freeze(child);
    Object.freeze(current);
  };
  freeze(value);
  return value;
}

function unavailable(): never {
  throw new OnlineGuidedActionsErrorV1();
}

function bindingUnavailable(): never {
  throw new OnlineGuidedActionBindingErrorV1();
}

function plain(value: unknown): value is object {
  try {
    return value !== null && typeof value === 'object' && !Array.isArray(value) &&
      (Reflect.getPrototypeOf(value) === Object.prototype || Reflect.getPrototypeOf(value) === null);
  } catch {
    return false;
  }
}

function exactRecord(value: unknown, fields: readonly string[]): SafeRecord | null {
  if (!plain(value)) return null;
  try {
    const keys = Reflect.ownKeys(value);
    const allowed = new Set(fields);
    const record = Object.create(null) as SafeRecord;
    for (const key of keys) {
      if (typeof key !== 'string' || !allowed.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) return null;
      record[key] = descriptor.value;
    }
    if (keys.length !== fields.length || fields.some((field) => !Object.prototype.hasOwnProperty.call(record, field))) return null;
    return record;
  } catch {
    return null;
  }
}

function exactRecordWithRequired(
  value: unknown,
  fields: readonly string[],
  required: readonly string[] = fields,
): SafeRecord | null {
  if (!plain(value)) return null;
  try {
    const keys = Reflect.ownKeys(value);
    const allowed = new Set(fields);
    const record = Object.create(null) as SafeRecord;
    for (const key of keys) {
      if (typeof key !== 'string' || !allowed.has(key)) return null;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) return null;
      record[key] = descriptor.value;
    }
    if (required.some((field) => !Object.prototype.hasOwnProperty.call(record, field))) return null;
    return record;
  } catch {
    return null;
  }
}

function validRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function validRuleKey(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value);
}

function validText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function ordinaryArray(value: unknown): readonly unknown[] | null {
  if (!Array.isArray(value)) return null;
  try {
    if (Reflect.getPrototypeOf(value) !== Array.prototype) return null;
    const keys = Reflect.ownKeys(value);
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
    if (lengthDescriptor === undefined || !('value' in lengthDescriptor) ||
      typeof lengthDescriptor.value !== 'number' || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) return null;
    const length = lengthDescriptor.value;
    if (keys.length !== length + 1 || keys.some((key) => key !== 'length' && (typeof key !== 'string' || !/^\d+$/.test(key) || Number(key) >= length))) return null;
    const result: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor)) return null;
      result.push(descriptor.value);
    }
    return result;
  } catch {
    return null;
  }
}

function id(value: unknown): value is CoreObjectId {
  return isCanonicalCoreObjectIdV2(value);
}

function playerId(value: unknown): value is CorePlayerId {
  return isCoreBaseId(value);
}

function labelFor(entry: OnlineProjectedVisibleObjectV1): string {
  if (entry.definition !== null) return `《${entry.definition.name}》`;
  const labels: Readonly<Record<string, string>> = {
    'spell-copy': '呪文のコピー',
    'activated-ability': '起動型能力',
    'triggered-ability': '誘発型能力',
  };
  return labels[entry.objectKind] ?? '公開オブジェクト';
}

function counterValues(
  values: readonly Readonly<{ readonly kind: string; readonly count: number }>[],
): readonly OnlineGuidedCounterV1[] {
  return values.map((current) => ({ kind: current.kind, count: current.count }));
}

function playerSummary(
  player: OnlineProjectedPlayerV1,
  actorPlayerId: CorePlayerId,
): OnlineGuidedPlayerSummaryV1 {
  return {
    playerId: player.playerId,
    isSelf: player.playerId === actorPlayerId,
    isActive: player.status === 'active',
    life: player.life,
    poison: player.poison,
  };
}

function ownParticipant(projection: OnlineParticipantProjectionV1): void {
  if (projection.role !== 'player' || projection.corePlayerId === null) unavailable();
  const actor = projection.corePlayerId;
  const ownPlayers = projection.game.players.filter((current) => current.playerId === actor);
  if (ownPlayers.length !== 1 || ownPlayers[0]?.status !== 'active') unavailable();
  const participants = projection.room.participants.filter(
    (current) => current.participantId === projection.participantId,
  );
  if (
    participants.length !== 1 ||
    participants[0]?.role !== 'player' ||
    participants[0].presence !== 'connected' ||
    participants[0].seatIndex === null
  ) unavailable();
  const seats = projection.room.seats.filter(
    (current) => current.participantId === projection.participantId && current.corePlayerId === actor,
  );
  if (
    seats.length !== 1 ||
    seats[0]?.seatIndex !== participants[0].seatIndex ||
    seats[0].outcome !== 'pending' ||
    (projection.room.lifecycle !== 'active' && projection.room.lifecycle !== 'finished')
  ) unavailable();
}

function visible(entry: OnlineProjectedZoneEntryV1): entry is OnlineProjectedVisibleObjectV1 {
  return entry.kind === 'visible-object';
}

function visibleCandidates(
  entries: readonly OnlineProjectedZoneEntryV1[],
): readonly OnlineGuidedControlCandidateV1[] {
  return entries.filter(visible).map((entry) => ({
    objectId: entry.objectId,
    label: labelFor(entry),
    controllerPlayerId: entry.controllerPlayerId,
  }));
}

function buildGuidedView(input: unknown): OnlineGuidedActionsViewV1 {
  const validation = validateOnlineParticipantProjectionAny(input);
  if (!validation.ok) unavailable();
  const projection = validation.value;
  ownParticipant(projection);
  const actorPlayerId = projection.corePlayerId;
  if (actorPlayerId === null) unavailable();

  const players = projection.game.turnOrder
    .map((player) => projection.game.players.find((current) => current.playerId === player))
    .filter((player): player is OnlineProjectedPlayerV1 => player !== undefined && player.status === 'active')
    .map((player) => playerSummary(player, actorPlayerId));
  const correctionPlayers = projection.game.turnOrder
    .map((player) => projection.game.players.find((current) => current.playerId === player))
    .filter((player): player is OnlineProjectedPlayerV1 => player !== undefined)
    .map((player) => playerSummary(player, actorPlayerId));

  const searchSessions = projection.game.searchSessions
    .filter((session) => session.rulesActorPlayerId === actorPlayerId && session.selectorPlayerId === actorPlayerId)
    .map((session) => {
      const quantity = session.criteria;
      return {
        sessionId: session.sessionId,
        zone: freezeDeep({ ...session.zone }),
        minimum: quantity.minimum,
        maximum: quantity.maximum,
        mayFailToFind: quantity.kind === 'qualified' ? quantity.mayFailToFind : false,
        revealFound: session.revealFound,
        shuffleAfter: session.shuffleAfter,
        candidates: session.candidates.map((candidate) => ({ objectId: candidate.objectId, label: labelFor(candidate) })),
      };
    });

  const battlefield = projection.game.zones.battlefield.entries;
  const stack = projection.game.zones.stack.entries;
  const exile = projection.game.zones.exile.entries;
  const controlCandidates = [...visibleCandidates(battlefield), ...visibleCandidates(stack)];
  const faceDownItems = ([
    ['battlefield', battlefield],
    ['stack', stack],
    ['exile', exile],
  ] as const).flatMap(([zone, entries]) => entries.filter((entry) => entry.kind === 'concealed-object').map((entry) => ({
    objectId: entry.objectId,
    zone,
    label: '《裏向きのカード》' as const,
    tapped: entry.runtime.tapped,
    phasedOut: entry.runtime.phasedOut,
    counters: counterValues(entry.runtime.counters),
    markedDamage: entry.runtime.markedDamage,
  })));

  const ownObjects = battlefield.filter(
    (entry): entry is OnlineProjectedVisibleObjectV1 => visible(entry) && entry.controllerPlayerId === actorPlayerId,
  ).map((entry) => ({ objectId: entry.objectId, label: labelFor(entry), controllerPlayerId: entry.controllerPlayerId }));
  const attackedObjects = battlefield.filter(visible).map((entry) => ({ objectId: entry.objectId, label: labelFor(entry), controllerPlayerId: entry.controllerPlayerId }));
  const defendingPlayers = correctionPlayers.filter((player) => !player.isSelf && player.isActive);

  const commanderEntries: OnlineGuidedSearchCandidateV1[] = [];
  const commanderZones: readonly (readonly OnlineProjectedZoneEntryV1[])[] = [
    battlefield,
    exile,
    ...projection.game.zones.byPlayer.map((group) => group.zones.graveyard.entries),
    stack,
    projection.game.zones.command.entries,
  ];
  for (const entries of commanderZones) {
    for (const entry of entries) {
      if (visible(entry) && entry.commander) commanderEntries.push({ objectId: entry.objectId, label: labelFor(entry) });
    }
  }

  return freezeDeep({
    kind: 'online-guided-actions-view-v1' as const,
    schemaVersion: ONLINE_GUIDED_ACTIONS_SCHEMA_VERSION_V1,
    revision: projection.revision,
    actorPlayerId,
    roomLifecycle: projection.room.lifecycle,
    turn: {
      activePlayerId: projection.game.turn.activePlayerId,
      turnNumber: projection.game.turn.turnNumber,
      phase: projection.game.turn.position.phase,
      step: projection.game.turn.position.step,
    },
    players,
    searchSessions,
    controlCandidates,
    faceDownItems,
    combat: { ownObjects, attackedObjects, defendingPlayers },
    corrections: { players: correctionPlayers, commanders: commanderEntries },
  });
}

export function buildOnlineGuidedActionsViewV1(input: unknown): OnlineGuidedActionsViewV1 {
  try {
    return buildGuidedView(input);
  } catch (error: unknown) {
    if (error instanceof OnlineGuidedActionsErrorV1) throw error;
    return unavailable();
  }
}

function parseAction(root: SafeRecord, view: OnlineGuidedActionsViewV1): OnlineGuidedActionV1 {
  const rawKind = root.kind;
  if (typeof rawKind !== 'string') unavailable();
  const actorPlayerId = root.actorPlayerId;
  const baseRevision = root.baseRevision;
  if (!playerId(actorPlayerId) || actorPlayerId !== view.actorPlayerId || !validRevision(baseRevision) || baseRevision !== view.revision) unavailable();

  if (rawKind === 'complete-search') {
    const action = exactRecord(root, ['kind', 'actorPlayerId', 'baseRevision', 'sessionId', 'selectedObjectIds']);
    if (action === null || typeof action.sessionId !== 'string') unavailable();
    const session = view.searchSessions.find((current) => current.sessionId === action.sessionId);
    if (session === undefined) unavailable();
    const selected = ordinaryArray(action.selectedObjectIds);
    if (selected === null) unavailable();
    const candidateIds = new Set(session.candidates.map((candidate) => candidate.objectId));
    const selectedObjectIds: CoreObjectId[] = [];
    for (const current of selected) {
      if (!id(current) || !candidateIds.has(current) || selectedObjectIds.includes(current)) unavailable();
      selectedObjectIds.push(current);
    }
    return freezeDeep({ kind: rawKind, actorPlayerId, baseRevision, sessionId: action.sessionId, selectedObjectIds });
  }
  if (rawKind === 'apply-control') {
    const action = exactRecord(root, ['kind', 'actorPlayerId', 'baseRevision', 'effectKey', 'targetObjectId', 'gainingControllerPlayerId', 'sourceObjectId', 'duration']);
    if (action === null || !validRuleKey(action.effectKey) || !id(action.targetObjectId) || !playerId(action.gainingControllerPlayerId) || (action.sourceObjectId !== null && !id(action.sourceObjectId))) unavailable();
    const target = view.controlCandidates.some((candidate) => candidate.objectId === action.targetObjectId);
    const controller = view.players.some((player) => player.playerId === action.gainingControllerPlayerId && player.isActive);
    const source = action.sourceObjectId === null || view.controlCandidates.some((candidate) => candidate.objectId === action.sourceObjectId);
    const duration = exactRecord(action.duration, ['kind']);
    if (!target || !controller || !source || duration?.kind !== 'manual') unavailable();
    return freezeDeep({ kind: rawKind, actorPlayerId, baseRevision, effectKey: action.effectKey, targetObjectId: action.targetObjectId, gainingControllerPlayerId: action.gainingControllerPlayerId, sourceObjectId: action.sourceObjectId, duration: { kind: 'manual' as const } });
  }
  if (rawKind === 'declare-attacker') {
    const action = exactRecord(root, ['kind', 'actorPlayerId', 'baseRevision', 'attackerObjectId', 'defendingPlayerId']);
    if (action === null || !id(action.attackerObjectId) || !playerId(action.defendingPlayerId)) unavailable();
    if (!view.combat.ownObjects.some((candidate) => candidate.objectId === action.attackerObjectId) || !view.combat.defendingPlayers.some((player) => player.playerId === action.defendingPlayerId)) unavailable();
    return freezeDeep({ kind: rawKind, actorPlayerId, baseRevision, attackerObjectId: action.attackerObjectId, defendingPlayerId: action.defendingPlayerId });
  }
  if (rawKind === 'declare-blocker') {
    const action = exactRecord(root, ['kind', 'actorPlayerId', 'baseRevision', 'blockerObjectId', 'attackedObjectId', 'defendingPlayerId']);
    if (action === null || !id(action.blockerObjectId) || !id(action.attackedObjectId) || !playerId(action.defendingPlayerId)) unavailable();
    if (!view.combat.ownObjects.some((candidate) => candidate.objectId === action.blockerObjectId) || !view.combat.attackedObjects.some((candidate) => candidate.objectId === action.attackedObjectId) || !view.combat.defendingPlayers.some((player) => player.playerId === action.defendingPlayerId)) unavailable();
    return freezeDeep({ kind: rawKind, actorPlayerId, baseRevision, blockerObjectId: action.blockerObjectId, attackedObjectId: action.attackedObjectId, defendingPlayerId: action.defendingPlayerId });
  }
  if (rawKind === 'note-face-down') {
    const action = exactRecord(root, ['kind', 'actorPlayerId', 'baseRevision', 'objectId', 'note']);
    if (action === null || !id(action.objectId) || !validText(action.note) || !view.faceDownItems.some((item) => item.objectId === action.objectId)) unavailable();
    return freezeDeep({ kind: rawKind, actorPlayerId, baseRevision, objectId: action.objectId, note: action.note });
  }
  if (rawKind === 'request-life-correction') {
    const action = exactRecord(root, ['kind', 'actorPlayerId', 'baseRevision', 'playerId', 'replacementLifeTotal', 'reason']);
    if (action === null || !playerId(action.playerId) || !Number.isSafeInteger(action.replacementLifeTotal) || typeof action.replacementLifeTotal !== 'number' || !validText(action.reason) || !view.corrections.players.some((player) => player.playerId === action.playerId)) unavailable();
    return freezeDeep({ kind: rawKind, actorPlayerId, baseRevision, playerId: action.playerId, replacementLifeTotal: action.replacementLifeTotal, reason: action.reason });
  }
  if (rawKind === 'note-commander-damage-correction') {
    const action = exactRecord(root, ['kind', 'actorPlayerId', 'baseRevision', 'commanderObjectId', 'defendingPlayerId', 'replacementDamageTotal', 'reason']);
    if (action === null || !id(action.commanderObjectId) || !playerId(action.defendingPlayerId) || !Number.isSafeInteger(action.replacementDamageTotal) || typeof action.replacementDamageTotal !== 'number' || action.replacementDamageTotal < 0 || !validText(action.reason) || !view.corrections.commanders.some((commander) => commander.objectId === action.commanderObjectId) || !view.corrections.players.some((player) => player.playerId === action.defendingPlayerId)) unavailable();
    return freezeDeep({ kind: rawKind, actorPlayerId, baseRevision, commanderObjectId: action.commanderObjectId, defendingPlayerId: action.defendingPlayerId, replacementDamageTotal: action.replacementDamageTotal, reason: action.reason });
  }
  unavailable();
}

export function createOnlineGuidedActionV1(input: unknown): OnlineGuidedActionV1 {
  try {
    const root = exactRecord(input, ['projection', 'action']);
    if (root === null) return unavailable();
    const view = buildGuidedView(root.projection);
    const actionRoot = exactRecordWithRequired(root.action, ACTION_FIELDS, ['kind']);
    if (actionRoot === null) return unavailable();
    return parseAction(actionRoot, view);
  } catch (error: unknown) {
    if (error instanceof OnlineGuidedActionsErrorV1) throw error;
    return unavailable();
  }
}

function capabilityFragment(value: string, capability: string): boolean {
  for (let length = 8; length <= capability.length; length += 1) {
    for (let start = 0; start + length <= capability.length; start += 1) {
      if (value.includes(capability.slice(start, start + length))) return true;
    }
  }
  return false;
}

function parseBindingRoot(input: unknown): Readonly<{ session: SafeRecord; action: SafeRecord; commandId: string | null }> | null {
  const root = exactRecord(input, ['session', 'action', 'commandId']);
  if (root === null || (root.commandId !== null && typeof root.commandId !== 'string')) return null;
  const session = exactRecord(root.session, ['protocolVersion', 'roomId', 'participantId', 'participantCapability', 'clientBuildId', 'corePlayerId', 'personalProjection']);
  if (session === null || !plain(root.action)) return null;
  const actionKeys = Reflect.ownKeys(root.action);
  if (actionKeys.some((key) => typeof key !== 'string')) return null;
  const action = root.action as SafeRecord;
  return { session, action, commandId: root.commandId };
}

function validatedBindingSession(session: SafeRecord): Readonly<{ readonly raw: OnlineDisplayPairingSessionV1; readonly view: OnlineGuidedActionsViewV1 }> {
  if (!playerId(session.corePlayerId)) bindingUnavailable();
  const hello = {
    kind: 'online-client-hello-v1' as const,
    protocolVersion: session.protocolVersion,
    roomId: session.roomId,
    participantId: session.participantId,
    participantCapability: session.participantCapability,
    clientBuildId: session.clientBuildId,
  };
  const checkedHello = validateOnlineClientHelloV1(hello);
  if (!checkedHello.ok) bindingUnavailable();
  const view = buildGuidedView(session.personalProjection);
  const projectionValidation = validateOnlineParticipantProjectionAny(session.personalProjection);
  if (!projectionValidation.ok) bindingUnavailable();
  const projection = projectionValidation.value;
  if (
    view.actorPlayerId !== session.corePlayerId ||
    projection.protocolVersion !== checkedHello.value.protocolVersion ||
    projection.roomId !== checkedHello.value.roomId ||
    projection.participantId !== checkedHello.value.participantId ||
    projection.revision !== view.revision ||
    view.revision < 0
  ) bindingUnavailable();
  const raw = session as OnlineDisplayPairingSessionV1;
  return { raw, view };
}

function boundAction(input: SafeRecord, view: OnlineGuidedActionsViewV1): OnlineGuidedActionV1 {
  const action = exactRecordWithRequired(input, ACTION_FIELDS, ['kind', 'actorPlayerId', 'baseRevision']);
  if (action === null) bindingUnavailable();
  try {
    return parseAction(action, view);
  } catch {
    bindingUnavailable();
  }
}

export function bindOnlineGuidedCommandActionV1(input: unknown): OnlineCommandEnvelopeV1 {
  try {
    const parsed = parseBindingRoot(input);
    if (parsed === null) return bindingUnavailable();
    const session = validatedBindingSession(parsed.session);
    const action = boundAction(parsed.action, session.view);
    if (
      action.kind === 'note-face-down' ||
      action.kind === 'request-life-correction' ||
      action.kind === 'note-commander-damage-correction'
    ) return bindingUnavailable();
    const commandId = parsed.commandId;
    if (commandId === null || !isOnlineProtocolCommandIdV1(commandId) || capabilityFragment(commandId, String(parsed.session.participantCapability))) return bindingUnavailable();
    const payload: CoreCommandPayloadV1 = action.kind === 'complete-search'
      ? { kind: 'search-complete', sessionKey: action.sessionId, selectedObjectIds: action.selectedObjectIds }
      : action.kind === 'apply-control'
        ? { kind: 'control-effect-apply', effectKey: action.effectKey, effect: { targetObjectId: action.targetObjectId, gainingControllerPlayerId: action.gainingControllerPlayerId, sourceObjectId: action.sourceObjectId, duration: { kind: 'manual' } } }
        : action.kind === 'declare-attacker'
          ? { kind: 'combat-attack-add', attack: { attackerObjectId: action.attackerObjectId, attackerControllerPlayerId: session.view.actorPlayerId, defendingPlayerId: action.defendingPlayerId } }
          : { kind: 'combat-block-add', block: { blockerObjectId: action.blockerObjectId, blockerControllerPlayerId: session.view.actorPlayerId, attackedObjectId: action.attackedObjectId, defendingPlayerId: action.defendingPlayerId } };
    const decisionContext = action.kind === 'complete-search'
      ? { kind: 'search-session' as const, searchSessionId: action.sessionId }
      : { kind: 'decision' as const, decisionKey: commandId };
    const command = createCoreCommandV1({
      schemaVersion: 1,
      sequence: action.baseRevision + 1,
      actorPlayerId: session.view.actorPlayerId,
      decisionMakerPlayerId: session.view.actorPlayerId,
      decisionContext,
      payload,
    });
    const commandValidation = validateCoreCommandV1(command);
    if (!commandValidation.ok) return bindingUnavailable();
    const envelope = {
      kind: 'online-command-envelope-v1' as const,
      protocolVersion: session.raw.protocolVersion,
      roomId: session.raw.roomId,
      participantId: session.raw.participantId,
      participantCapability: session.raw.participantCapability,
      commandId,
      baseRevision: action.baseRevision,
      command: commandValidation.value,
    };
    const checked = validateOnlineCommandEnvelopeV1(envelope);
    if (!checked.ok) return bindingUnavailable();
    return freezeDeep(checked.value);
  } catch (error: unknown) {
    if (error instanceof OnlineGuidedActionBindingErrorV1) throw error;
    return bindingUnavailable();
  }
}
