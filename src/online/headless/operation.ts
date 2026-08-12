import {
  coreCanonicalDigestFromValueV1,
  replayCoreCommandsV1,
  runOrdinaryFourPlayerCoreClosureV1,
  type CoreCommandV1,
} from '../../engine/core/index';
import {
  disconnectOnlineRoomParticipantV1,
  type OnlineRoomParticipantV1,
} from '../room/index';
import {
  handleOnlineClientHelloV1,
  handleOnlineCommandEnvelopeV1,
  validateOnlineProtocolStateV1,
  type OnlineProtocolStateV1,
} from '../protocol/index';
import {
  handleOnlineProjectedSnapshotRequestV1,
  validateOnlineParticipantProjectionV1,
} from '../projection/index';
import { CURRENT_CONTRACT_VERSIONS } from '../../versioning/index';
import { OnlineHeadlessRoomGateOperationErrorV1 } from './errors';
import {
  headlessIssue,
  inspectHeadlessPublicGraph,
} from './support';
import {
  ONLINE_HEADLESS_ROOM_GATE_SCHEMA_VERSION_V1,
  type OnlineHeadlessRoomGateClientV1,
  type OnlineHeadlessRoomGateCountsV1,
  type OnlineHeadlessRoomGateCoverageV1,
  type OnlineHeadlessRoomGateIssueV1,
  type OnlineHeadlessRoomGateOperationErrorCodeV1,
  type OnlineHeadlessRoomGateReportClientV1,
  type OnlineHeadlessRoomGateReportV1,
  type OnlineHeadlessRoomGateTransitionV1,
} from './types';
import {
  ONLINE_HEADLESS_ROOM_GATE_DEFERRED_V1,
  validateOnlineHeadlessRoomGateInputV1,
  validateOnlineHeadlessRoomGateReportV1,
} from './validation';

type MutableCounts = { -readonly [Key in keyof OnlineHeadlessRoomGateCountsV1]: number };

type AuthoritySnapshot = Readonly<{
  readonly coreDigest: string;
  readonly receiptsDigest: string;
  readonly roomWithoutPresenceDigest: string;
  readonly stateDigest: string;
  readonly revision: number;
}>;

const COVERAGE_FIELDS: readonly (keyof OnlineHeadlessRoomGateCoverageV1)[] = Object.freeze([
  'fourPlayers',
  'tableDisplay',
  'allClientHellos',
  'allClientProjections',
  'acceptedCommand',
  'rejectedCommand',
  'duplicateCommand',
  'staleRevision',
  'roleIsolation',
  'playerReconnect',
  'tableReconnect',
  'privacyGate',
  'replay',
]);

function operationFailure(
  code: OnlineHeadlessRoomGateOperationErrorCodeV1,
  issueCode: OnlineHeadlessRoomGateIssueV1['code'],
  message: string,
): never {
  throw new OnlineHeadlessRoomGateOperationErrorV1(code, [
    headlessIssue(issueCode, '', message),
  ]);
}

function compositionFailure(): never {
  return operationFailure(
    'COMPOSITION_REJECTED',
    'COMPOSITION_REJECTED',
    'Headless composition was rejected',
  );
}

function privacyFailure(): never {
  return operationFailure(
    'PRIVACY_REJECTED',
    'PRIVACY_REJECTED',
    'Public evidence failed the privacy boundary',
  );
}

function replayFailure(): never {
  return operationFailure(
    'REPLAY_MISMATCH',
    'REPLAY_MISMATCH',
    'Core replay did not match protocol authority',
  );
}

function scanPublicEvidence(input: unknown, capabilities: readonly string[]): void {
  if (inspectHeadlessPublicGraph(input, capabilities) !== 'clear') privacyFailure();
}

function roomWithoutPresence(state: OnlineProtocolStateV1): unknown {
  return {
    lifecycle: state.room.lifecycle,
    roomId: state.room.roomId,
    hostParticipantId: state.room.hostParticipantId,
    participants: state.room.participants.map((participant) => ({
      participantId: participant.participantId,
      role: participant.role,
      seatIndex: participant.seatIndex,
    })),
    seats: state.room.seats,
  };
}

function authoritySnapshot(state: OnlineProtocolStateV1): AuthoritySnapshot {
  return Object.freeze({
    coreDigest: coreCanonicalDigestFromValueV1(state.coreRoot),
    receiptsDigest: coreCanonicalDigestFromValueV1(state.receipts),
    roomWithoutPresenceDigest: coreCanonicalDigestFromValueV1(roomWithoutPresence(state)),
    stateDigest: coreCanonicalDigestFromValueV1(state),
    revision: state.revision,
  });
}

function preservesCoreRevision(
  before: AuthoritySnapshot,
  after: OnlineProtocolStateV1,
): boolean {
  return before.revision === after.revision
    && before.coreDigest === coreCanonicalDigestFromValueV1(after.coreRoot);
}

function preservesReconnectBoundary(
  before: AuthoritySnapshot,
  after: OnlineProtocolStateV1,
): boolean {
  return preservesCoreRevision(before, after)
    && before.receiptsDigest === coreCanonicalDigestFromValueV1(after.receipts)
    && before.roomWithoutPresenceDigest
      === coreCanonicalDigestFromValueV1(roomWithoutPresence(after));
}

function participantFor(
  state: OnlineProtocolStateV1,
  participantId: string,
): OnlineRoomParticipantV1 | null {
  return state.room.participants.find((participant) =>
    participant.participantId === participantId) ?? null;
}

function freshCounts(): MutableCounts {
  return {
    clientHellosAccepted: 0,
    clientHellosRejected: 0,
    commandsAccepted: 0,
    commandsRejected: 0,
    commandDuplicates: 0,
    staleRevisionRejections: 0,
    roleRejections: 0,
    projectionsAccepted: 0,
    projectionsRejected: 0,
    disconnects: 0,
    playerRejoins: 0,
    tableRejoins: 0,
  };
}

function freezeCounts(counts: MutableCounts): OnlineHeadlessRoomGateCountsV1 {
  return Object.freeze({ ...counts });
}

function sameState(before: AuthoritySnapshot, after: OnlineProtocolStateV1): boolean {
  return before.stateDigest === coreCanonicalDigestFromValueV1(after);
}

function issueCodes(response: Readonly<{ readonly issues: readonly { readonly code: string }[] }>): Set<string> {
  return new Set(response.issues.map((issue) => issue.code));
}

function reportClients(
  state: OnlineProtocolStateV1,
): readonly OnlineHeadlessRoomGateReportClientV1[] {
  const clients: OnlineHeadlessRoomGateReportClientV1[] = [];
  for (const seat of state.room.seats) {
    if (seat.participantId === null) compositionFailure();
    const participant = participantFor(state, seat.participantId);
    if (participant === null || participant.role !== 'player'
      || participant.seatIndex !== seat.seatIndex) compositionFailure();
    clients.push(Object.freeze({
      participantId: participant.participantId,
      role: 'player' as const,
      corePlayerId: seat.corePlayerId,
      presence: participant.presence,
    }));
  }
  const table = state.room.participants.find((participant) => participant.role === 'table');
  if (table === undefined) compositionFailure();
  clients.push(Object.freeze({
    participantId: table.participantId,
    role: 'table' as const,
    corePlayerId: null,
    presence: table.presence,
  }));
  return Object.freeze(clients);
}

function coverageIssues(
  status: Readonly<Record<keyof OnlineHeadlessRoomGateCoverageV1, boolean>>,
): readonly OnlineHeadlessRoomGateIssueV1[] {
  return Object.freeze(COVERAGE_FIELDS
    .filter((field) => !status[field])
    .map((field) => headlessIssue(
      'COVERAGE_MISSING',
      `/coverage/${field}`,
      'Required headless coverage witness is missing',
    )));
}

function completeCoverage(): OnlineHeadlessRoomGateCoverageV1 {
  return Object.freeze({
    fourPlayers: true,
    tableDisplay: true,
    allClientHellos: true,
    allClientProjections: true,
    acceptedCommand: true,
    rejectedCommand: true,
    duplicateCommand: true,
    staleRevision: true,
    roleIsolation: true,
    playerReconnect: true,
    tableReconnect: true,
    privacyGate: true,
    replay: true,
  });
}

export function runLocalOnlineHeadlessRoomGateV1(
  input: unknown,
): OnlineHeadlessRoomGateTransitionV1 {
  const validation = validateOnlineHeadlessRoomGateInputV1(input);
  if (!validation.ok) {
    throw new OnlineHeadlessRoomGateOperationErrorV1('INVALID_INPUT', validation.issues);
  }
  const canonical = validation.value;
  const configuredCapabilities = Object.freeze(
    canonical.clients.map((client) => client.participantCapability),
  );
  const clientsById = new Map<string, OnlineHeadlessRoomGateClientV1>(
    canonical.clients.map((client) => [client.participantId, client]),
  );
  const initialCoreRoot = canonical.state.coreRoot;
  const acceptedCommands: CoreCommandV1[] = [];
  const counts = freshCounts();
  const helloParticipants = new Set<string>();
  const projectionParticipants = new Set<string>();
  const disconnectedParticipants = new Set<string>();
  const playerRejoinParticipants = new Set<string>();
  const tableRejoinParticipants = new Set<string>();
  const staleRecoveredParticipants = new Set<string>();
  const pendingStaleCounts = new Map<string, number>();
  let otherNonStalePlayerRejection = false;
  let state = canonical.state;

  try {
    for (const action of canonical.actions) {
      const client = clientsById.get(action.participantId);
      if (client === undefined) compositionFailure();
      if (action.kind === 'client-hello') {
        const beforeParticipant = participantFor(state, action.participantId);
        const transition = handleOnlineClientHelloV1(state, {
          kind: 'online-client-hello-v1',
          protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion,
          roomId: state.room.roomId,
          participantId: action.participantId,
          participantCapability: client.participantCapability,
          clientBuildId: client.clientBuildId,
        });
        scanPublicEvidence(transition.response, configuredCapabilities);
        state = transition.state;
        if (transition.response.status === 'accepted') {
          counts.clientHellosAccepted += 1;
          helloParticipants.add(action.participantId);
          if (beforeParticipant?.presence === 'disconnected') {
            disconnectedParticipants.delete(action.participantId);
          }
        } else {
          counts.clientHellosRejected += 1;
        }
        continue;
      }

      if (action.kind === 'disconnect') {
        const before = authoritySnapshot(state);
        const room = disconnectOnlineRoomParticipantV1(state.room, action.participantId);
        const candidate = {
          kind: 'online-protocol-state-v1',
          schemaVersion: state.schemaVersion,
          protocolVersion: state.protocolVersion,
          serverBuildId: state.serverBuildId,
          room,
          coreRoot: state.coreRoot,
          revision: state.revision,
          observerAuthorizations: state.observerAuthorizations,
          receipts: state.receipts,
        };
        const checked = validateOnlineProtocolStateV1(candidate);
        if (!checked.ok || !preservesReconnectBoundary(before, checked.value)) compositionFailure();
        state = checked.value;
        counts.disconnects += 1;
        disconnectedParticipants.add(action.participantId);
        continue;
      }

      if (action.kind === 'command') {
        const before = authoritySnapshot(state);
        const participant = participantFor(state, action.participantId);
        if (participant === null) compositionFailure();
        const transition = handleOnlineCommandEnvelopeV1(state, {
          kind: 'online-command-envelope-v1',
          protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion,
          roomId: state.room.roomId,
          participantId: action.participantId,
          participantCapability: client.participantCapability,
          commandId: action.commandId,
          baseRevision: action.baseRevision,
          command: action.command,
        });
        scanPublicEvidence(transition.response, configuredCapabilities);
        if (transition.response.kind === 'online-command-ack-v1') {
          if (transition.response.duplicate) {
            if (!sameState(before, transition.state)) compositionFailure();
            counts.commandDuplicates += 1;
          } else {
            if (transition.state.revision !== before.revision + 1
              || transition.response.acceptedRevision !== transition.state.revision) {
              compositionFailure();
            }
            counts.commandsAccepted += 1;
            acceptedCommands.push(action.command);
          }
        } else {
          counts.commandsRejected += 1;
          if (!preservesCoreRevision(before, transition.state)) compositionFailure();
          const codes = issueCodes(transition.response);
          const stale = codes.has('STALE_REVISION')
            && transition.response.resyncRequired
            && action.command.sequence === action.baseRevision + 1;
          if (stale) {
            pendingStaleCounts.set(
              action.participantId,
              (pendingStaleCounts.get(action.participantId) ?? 0) + 1,
            );
          }
          if (participant.role === 'table' && codes.has('ROLE_NOT_ALLOWED')) {
            if (before.receiptsDigest !== coreCanonicalDigestFromValueV1(transition.state.receipts)) {
              compositionFailure();
            }
            counts.roleRejections += 1;
          }
          if (participant.role === 'player' && !stale) {
            otherNonStalePlayerRejection = true;
          }
        }
        state = transition.state;
        continue;
      }

      const before = authoritySnapshot(state);
      const beforeParticipant = participantFor(state, action.participantId);
      if (beforeParticipant === null) compositionFailure();
      const transition = handleOnlineProjectedSnapshotRequestV1(state, {
        kind: 'online-projection-request-v1',
        protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion,
        roomId: state.room.roomId,
        participantId: action.participantId,
        participantCapability: client.participantCapability,
        knownRevision: action.knownRevision,
        clientBuildId: client.clientBuildId,
        decisionContext: action.decisionContext,
      });
      scanPublicEvidence(transition.response, configuredCapabilities);
      scanPublicEvidence(transition.log, configuredCapabilities);
      state = transition.state;
      if (transition.response.status === 'accepted') {
        const projectionValidation = validateOnlineParticipantProjectionV1(
          transition.response.projection,
        );
        if (!projectionValidation.ok
          || transition.response.participantId !== action.participantId
          || transition.response.projection.participantId !== action.participantId
          || transition.response.roomId !== state.room.roomId
          || transition.response.projection.roomId !== state.room.roomId
          || transition.response.role !== beforeParticipant.role
          || transition.response.projection.role !== beforeParticipant.role) {
          compositionFailure();
        }
        if (beforeParticipant.role === 'player') {
          const seat = state.room.seats[beforeParticipant.seatIndex];
          if (seat === undefined
            || transition.response.projection.corePlayerId !== seat.corePlayerId) {
            compositionFailure();
          }
        } else if (transition.response.projection.corePlayerId !== null) {
          compositionFailure();
        }
        counts.projectionsAccepted += 1;
        projectionParticipants.add(action.participantId);
        if (transition.response.reason === 'rejoined') {
          if (!disconnectedParticipants.has(action.participantId)
            || beforeParticipant.presence !== 'disconnected'
            || !preservesReconnectBoundary(before, state)) {
            compositionFailure();
          }
          disconnectedParticipants.delete(action.participantId);
          if (beforeParticipant.role === 'player') {
            counts.playerRejoins += 1;
            playerRejoinParticipants.add(action.participantId);
          } else if (beforeParticipant.role === 'table') {
            counts.tableRejoins += 1;
            tableRejoinParticipants.add(action.participantId);
          }
        } else if (beforeParticipant.presence === 'disconnected') {
          compositionFailure();
        }
        const pendingStale = pendingStaleCounts.get(action.participantId) ?? 0;
        if (pendingStale > 0 && transition.response.revision === state.revision) {
          counts.staleRevisionRejections += pendingStale;
          pendingStaleCounts.delete(action.participantId);
          staleRecoveredParticipants.add(action.participantId);
        }
      } else {
        if (!preservesCoreRevision(before, state)) compositionFailure();
        counts.projectionsRejected += 1;
      }
    }

    if (acceptedCommands.length >= 2) {
      try {
        const closure = runOrdinaryFourPlayerCoreClosureV1(initialCoreRoot, acceptedCommands);
        const replay = replayCoreCommandsV1(closure.replayPackage);
        const authorityDigest = coreCanonicalDigestFromValueV1(state.coreRoot);
        if (!replay.ok
          || closure.finalStateDigest !== authorityDigest
          || replay.finalStateDigest !== authorityDigest) replayFailure();
      } catch (error: unknown) {
        if (error instanceof OnlineHeadlessRoomGateOperationErrorV1
          && error.code === 'REPLAY_MISMATCH') throw error;
        replayFailure();
      }
    }

    const finalParticipantsConnected = state.room.participants.length === 5
      && state.room.participants.every((participant) => participant.presence === 'connected');
    const coverageStatus: Readonly<Record<keyof OnlineHeadlessRoomGateCoverageV1, boolean>> =
      Object.freeze({
        fourPlayers: state.room.seats.length === 4
          && state.room.participants.filter((participant) => participant.role === 'player').length === 4,
        tableDisplay: state.room.participants.filter((participant) => participant.role === 'table').length === 1,
        allClientHellos: canonical.clients.every((client) =>
          helloParticipants.has(client.participantId)),
        allClientProjections: canonical.clients.every((client) =>
          projectionParticipants.has(client.participantId)),
        acceptedCommand: acceptedCommands.length >= 2,
        rejectedCommand: counts.commandsRejected
          >= counts.staleRevisionRejections + counts.roleRejections + 1
          && otherNonStalePlayerRejection,
        duplicateCommand: counts.commandDuplicates >= 1,
        staleRevision: counts.staleRevisionRejections >= 1
          && staleRecoveredParticipants.size >= 1,
        roleIsolation: counts.roleRejections >= 1,
        playerReconnect: counts.playerRejoins >= 1 && playerRejoinParticipants.size >= 1,
        tableReconnect: counts.tableRejoins >= 1 && tableRejoinParticipants.size >= 1,
        privacyGate: true,
        replay: acceptedCommands.length >= 2,
      });
    const missing = coverageIssues(coverageStatus);
    if (missing.length > 0 || !finalParticipantsConnected) {
      throw new OnlineHeadlessRoomGateOperationErrorV1(
        'COVERAGE_MISSING',
        missing.length > 0
          ? missing
          : [headlessIssue(
              'COVERAGE_MISSING',
              '/clients',
              'Final connected client coverage is missing',
            )],
      );
    }

    const frozenCounts = freezeCounts(counts);
    const finalRoomLifecycle = state.room.lifecycle;
    if (finalRoomLifecycle !== 'active' && finalRoomLifecycle !== 'finished') {
      compositionFailure();
    }
    const report: OnlineHeadlessRoomGateReportV1 = Object.freeze({
      kind: 'online-local-headless-room-gate-report-v1',
      schemaVersion: ONLINE_HEADLESS_ROOM_GATE_SCHEMA_VERSION_V1,
      protocolVersion: 1,
      roomId: state.room.roomId,
      initialRevision: 0,
      finalRevision: state.revision,
      finalRoomLifecycle,
      clients: reportClients(state),
      counts: frozenCounts,
      coverage: completeCoverage(),
      deferred: ONLINE_HEADLESS_ROOM_GATE_DEFERRED_V1,
    });
    scanPublicEvidence(report, configuredCapabilities);
    const reportValidation = validateOnlineHeadlessRoomGateReportV1(report);
    if (!reportValidation.ok) compositionFailure();
    return Object.freeze({ state, report: reportValidation.value });
  } catch (error: unknown) {
    if (error instanceof OnlineHeadlessRoomGateOperationErrorV1) throw error;
    return compositionFailure();
  }
}
