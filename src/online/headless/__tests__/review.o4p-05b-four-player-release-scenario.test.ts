import { describe, expect, it } from 'vitest';

import * as Core from '../../../engine/core/index';
import * as DisplayPairing from '../../displayPairing/index';
import * as GuidedActions from '../../guidedActions/index';
import * as Headless from '../../headless/index';
import * as Projection from '../../projection/index';
import * as Protocol from '../../protocol/index';
import * as Room from '../../room/index';
import * as TableDisplay from '../../tableDisplay/index';
import * as Workbench from '../../workbench/index';
import {
  CURRENT_CONTRACT_VERSIONS,
  PUBLIC_RELEASE_RULESET_V1,
} from '../../../versioning/index';
import {
  CAPABILITIES,
  CORE_PLAYERS,
  PARTICIPANTS,
  assertDeepFrozen,
  makeCoreRoot,
  readyAllPlayers,
} from '../../room/__tests__/testHelpers';

const TABLE_ID = 'release-table' as Room.OnlineRoomParticipantIdV1;
const TABLE_CAPABILITY =
  'release_table_capability_TTTTTTTTTTT' as Protocol.OnlineProtocolObserverCapabilityV1;
const SERVER_BUILD_ID = 'server-o4p-05b';
const CLIENT_BUILD_ID = 'client-o4p-05b';
const PLAYER_PARTICIPANT_IDS = Object.freeze(PARTICIPANTS.map((participantId) =>
  participantId as Room.OnlineRoomParticipantIdV1));
const COMMAND_IDS = Object.freeze({
  actorMismatch: 'release-actor-mismatch' as Protocol.OnlineProtocolCommandIdV1,
  tableRole: 'release-table-role' as Protocol.OnlineProtocolCommandIdV1,
  accepted: Object.freeze(CORE_PLAYERS.map((playerId) =>
    `release-accepted-${playerId}` as Protocol.OnlineProtocolCommandIdV1)),
  stale: 'release-stale' as Protocol.OnlineProtocolCommandIdV1,
});
const COMMANDER_PHYSICAL_IDS = Object.freeze({
  P1: 'PC1',
  P2: 'PC3',
  P3: 'PC6',
  P4: 'PC5',
} as const);

type AcceptedProjection = Projection.OnlineProjectedSnapshotTransitionV1 & {
  readonly response: Projection.OnlineProjectedSnapshotAcceptedV1;
};

type ScenarioEvidence = Readonly<{
  readonly transition: Headless.OnlineHeadlessRoomGateTransitionV1;
  readonly acceptedCommands: readonly Core.CoreCommandV1[];
  readonly closure: Core.CoreHeadlessClosureReportV1;
  readonly replay: Extract<Core.CoreReplayResultV1, { readonly ok: true }>;
  readonly projections: readonly Projection.OnlineParticipantProjectionV1[];
  readonly workbenches: readonly Workbench.PersonalWorkbenchViewV1[];
  readonly guided: readonly GuidedActions.OnlineGuidedActionsViewV1[];
  readonly table: TableDisplay.TableDisplayViewV1;
  readonly pairings: readonly DisplayPairing.OnlineDisplayPairingViewV1[];
  readonly ruleset: typeof PUBLIC_RELEASE_RULESET_V1;
}>;

function commanderCast(
  actorPlayerId: (typeof CORE_PLAYERS)[number],
  sequence: number,
): Core.CoreCommandV1 {
  return Core.createCoreCommandV1({
    schemaVersion: 1,
    sequence,
    actorPlayerId: actorPlayerId as Core.CorePlayerId,
    decisionMakerPlayerId: actorPlayerId as Core.CorePlayerId,
    decisionContext: {
      kind: 'decision',
      decisionKey: `o4p-05b-${actorPlayerId}-${String(sequence)}`,
    },
    payload: {
      kind: 'commander-cast-record',
      physicalCardId: COMMANDER_PHYSICAL_IDS[actorPlayerId] as Core.CorePhysicalCardId,
      origin: 'command-zone',
      accepted: true,
    },
  });
}

function createState(): Protocol.OnlineProtocolStateV1 {
  const coreRoot = makeCoreRoot();
  let room = Room.joinOnlineRoomV1(readyAllPlayers(), {
    participantId: TABLE_ID,
    role: 'table',
  });
  room = Room.startOnlineRoomV1(room, PLAYER_PARTICIPANT_IDS[0]);
  room = Room.activateOnlineRoomV1(room, {
    hostParticipantId: PLAYER_PARTICIPANT_IDS[0],
    coreRoot,
  });
  return Protocol.createOnlineProtocolStateV1({
    serverBuildId: SERVER_BUILD_ID,
    room,
    coreRoot,
    observerAuthorizations: [{
      participantId: TABLE_ID,
      observerCapability: TABLE_CAPABILITY,
    }],
  });
}

function clients(): readonly Headless.OnlineHeadlessRoomGateClientV1[] {
  return Object.freeze([
    ...PLAYER_PARTICIPANT_IDS.map((participantId, index) => Object.freeze({
      participantId,
      participantCapability: CAPABILITIES[index] as Protocol.OnlineProtocolParticipantCapabilityV1,
      clientBuildId: CLIENT_BUILD_ID,
    })),
    Object.freeze({
      participantId: TABLE_ID,
      participantCapability: TABLE_CAPABILITY,
      clientBuildId: CLIENT_BUILD_ID,
    }),
  ]);
}

function canonicalInput(): Headless.OnlineHeadlessRoomGateInputV1 {
  const state = createState();
  const scenarioClients = clients();
  const accepted = CORE_PLAYERS.map((playerId, index) =>
    commanderCast(playerId, index + 1));
  const actions: Headless.OnlineHeadlessRoomGateActionV1[] = [
    ...scenarioClients.map((client) => ({
      kind: 'client-hello' as const,
      participantId: client.participantId,
    })),
    ...scenarioClients.map((client) => ({
      kind: 'projection' as const,
      participantId: client.participantId,
      knownRevision: 0,
      decisionContext: null,
    })),
    {
      kind: 'command',
      participantId: PLAYER_PARTICIPANT_IDS[0],
      commandId: COMMAND_IDS.actorMismatch,
      baseRevision: 0,
      command: commanderCast('P2', 1),
    },
    {
      kind: 'command',
      participantId: TABLE_ID,
      commandId: COMMAND_IDS.tableRole,
      baseRevision: 0,
      command: accepted[0],
    },
    {
      kind: 'command',
      participantId: PLAYER_PARTICIPANT_IDS[0],
      commandId: COMMAND_IDS.accepted[0],
      baseRevision: 0,
      command: accepted[0],
    },
    {
      kind: 'command',
      participantId: PLAYER_PARTICIPANT_IDS[0],
      commandId: COMMAND_IDS.accepted[0],
      baseRevision: 0,
      command: accepted[0],
    },
    {
      kind: 'command',
      participantId: PLAYER_PARTICIPANT_IDS[1],
      commandId: COMMAND_IDS.stale,
      baseRevision: 0,
      command: commanderCast('P2', 1),
    },
    {
      kind: 'projection',
      participantId: PLAYER_PARTICIPANT_IDS[1],
      knownRevision: 1,
      decisionContext: null,
    },
    ...accepted.slice(1).map((command, offset) => ({
      kind: 'command' as const,
      participantId: PLAYER_PARTICIPANT_IDS[offset + 1],
      commandId: COMMAND_IDS.accepted[offset + 1],
      baseRevision: offset + 1,
      command,
    })),
    {
      kind: 'disconnect',
      participantId: PLAYER_PARTICIPANT_IDS[2],
    },
    {
      kind: 'projection',
      participantId: PLAYER_PARTICIPANT_IDS[2],
      knownRevision: 4,
      decisionContext: null,
    },
    { kind: 'disconnect', participantId: TABLE_ID },
    {
      kind: 'projection',
      participantId: TABLE_ID,
      knownRevision: 4,
      decisionContext: null,
    },
  ];
  const input = {
    kind: 'online-local-headless-room-gate-input-v1' as const,
    schemaVersion: Headless.ONLINE_HEADLESS_ROOM_GATE_SCHEMA_VERSION_V1,
    state,
    clients: scenarioClients,
    actions,
  };
  const checked = Headless.validateOnlineHeadlessRoomGateInputV1(input);
  if (!checked.ok) throw new Error('Canonical O4P-05B input must validate');
  return checked.value;
}

function acceptedCommandsFor(
  input: Headless.OnlineHeadlessRoomGateInputV1,
  state: Protocol.OnlineProtocolStateV1,
): readonly Core.CoreCommandV1[] {
  const commands: Core.CoreCommandV1[] = [];
  for (const receipt of state.receipts) {
    if (receipt.outcome.kind !== 'accepted') continue;
    const action = input.actions.find((candidate) =>
      candidate.kind === 'command'
      && candidate.participantId === receipt.participantId
      && candidate.commandId === receipt.commandId
      && Core.coreCanonicalDigestFromValueV1({
        kind: 'online-command-envelope-v1',
        protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion,
        roomId: input.state.room.roomId,
        participantId: candidate.participantId,
        commandId: candidate.commandId,
        baseRevision: candidate.baseRevision,
        command: candidate.command,
      }) === receipt.requestDigest);
    if (action?.kind !== 'command') throw new Error('Accepted receipt lost command authority');
    commands.push(action.command);
  }
  expect(commands).toHaveLength(4);
  expect(commands.map((command) => command.actorPlayerId)).toEqual(CORE_PLAYERS);
  expect(commands.map((command) => command.sequence)).toEqual([1, 2, 3, 4]);
  return Object.freeze(commands);
}

function finalProjection(
  state: Protocol.OnlineProtocolStateV1,
  client: Headless.OnlineHeadlessRoomGateClientV1,
): AcceptedProjection {
  const transition = Projection.handleOnlineProjectedSnapshotRequestV1(state, {
    kind: 'online-projection-request-v1',
    protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion,
    roomId: state.room.roomId,
    participantId: client.participantId,
    participantCapability: client.participantCapability,
    knownRevision: state.revision,
    clientBuildId: client.clientBuildId,
    decisionContext: null,
  });
  expect(transition.response.status).toBe('accepted');
  if (transition.response.status !== 'accepted') throw new Error('Final projection rejected');
  return transition as AcceptedProjection;
}

function executeScenario(input: Headless.OnlineHeadlessRoomGateInputV1): ScenarioEvidence {
  const transition = Headless.runLocalOnlineHeadlessRoomGateV1(input);
  const acceptedCommands = acceptedCommandsFor(input, transition.state);
  const closure = Core.runOrdinaryFourPlayerCoreClosureV1(
    input.state.coreRoot,
    acceptedCommands,
  );
  const replayPackage = JSON.parse(
    JSON.stringify(closure.replayPackage),
  ) as Core.CoreReplayPackageV1;
  const replay = Core.replayCoreCommandsV1(replayPackage);
  expect(replay.ok).toBe(true);
  if (!replay.ok) throw new Error('Release replay diverged');
  const finalDigest = Core.coreCanonicalDigestFromValueV1(transition.state.coreRoot);
  expect(closure.finalStateDigest).toBe(finalDigest);
  expect(replay.finalStateDigest).toBe(finalDigest);
  expect(replay.eventTranscriptDigest).toBe(
    Core.coreCanonicalDigestFromValueV1(closure.events),
  );

  const scenarioClients = input.clients;
  const projected = scenarioClients.map((client) => finalProjection(transition.state, client));
  const projections = Object.freeze(projected.map(({ response }) => response.projection));
  const personal = Object.freeze(projections.filter(
    (projection): projection is Projection.OnlineParticipantProjectionV1 & {
      readonly role: 'player';
      readonly corePlayerId: Core.CorePlayerId;
    } => projection.role === 'player' && projection.corePlayerId !== null,
  ));
  const tableProjection = projections.find((projection) => projection.role === 'table');
  if (personal.length !== 4 || tableProjection === undefined) {
    throw new Error('Release projection coverage is incomplete');
  }
  const workbenches = Object.freeze(personal.map((projection) =>
    Workbench.buildPersonalWorkbenchViewV1(projection)));
  const guided = Object.freeze(personal.map((projection) =>
    GuidedActions.buildOnlineGuidedActionsViewV1(projection)));
  const table = TableDisplay.buildTableDisplayViewV1(tableProjection);
  const pairings = Object.freeze(personal.map((projection) =>
    DisplayPairing.buildOnlineDisplayPairingViewV1({
      personalProjection: projection,
      tableProjection,
      focusedPlayerId: null,
    })));
  const evidence = Object.freeze({
    transition,
    acceptedCommands,
    closure,
    replay,
    projections,
    workbenches,
    guided,
    table,
    pairings,
    ruleset: PUBLIC_RELEASE_RULESET_V1,
  });
  assertDeepFrozen(transition);
  assertDeepFrozen(projections);
  assertDeepFrozen(workbenches);
  assertDeepFrozen(guided);
  assertDeepFrozen(table);
  assertDeepFrozen(pairings);
  assertDeepFrozen(PUBLIC_RELEASE_RULESET_V1);
  return evidence;
}

function capabilityFragments(): readonly string[] {
  const values = [...CAPABILITIES, TABLE_CAPABILITY];
  return Object.freeze(values.flatMap((capability) =>
    Array.from({ length: capability.length - 7 }, (_, index) => capability.slice(index, index + 8))));
}

function assertAudienceSafe(evidence: ScenarioEvidence): void {
  const visibleEvidence = [
    ...evidence.projections,
    ...evidence.workbenches,
    ...evidence.guided,
    evidence.table,
    ...evidence.pairings,
  ];
  const serialized = JSON.stringify(visibleEvidence);
  for (const fragment of capabilityFragments()) expect(serialized).not.toContain(fragment);
  expect(serialized).not.toMatch(/observerAuthorization|participantCapability|seatCapability/i);
  for (const projection of evidence.projections) {
    for (const group of projection.game.zones.byPlayer) {
      if (projection.role !== 'player' || group.playerId !== projection.corePlayerId) {
        expect(group.zones.hand.entries.every((entry) => entry.kind === 'hidden-card')).toBe(true);
        expect(group.zones.library.entries.every((entry) => entry.kind === 'hidden-card')).toBe(true);
      }
    }
  }
}

describe('O4P-05B four-player release scenario', () => {
  it('replays the same final Core state and events through all finished local layers', () => {
    const input = canonicalInput();
    const before = JSON.stringify(input);
    const evidence = executeScenario(input);

    assertDeepFrozen(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(evidence.ruleset).toBe(PUBLIC_RELEASE_RULESET_V1);
    expect(evidence.ruleset.contractVersions).toBe(CURRENT_CONTRACT_VERSIONS);
    expect(evidence.ruleset.source).toBe('repository-local-pin');
    expect(evidence.ruleset.contractVersions.ruleset.rulesetId).toBe('mtg-cr-2026-06-19');
    expect(evidence.transition.state.revision).toBe(4);
    expect(evidence.transition.state.coreRoot.commanders).toHaveLength(4);
    expect(evidence.transition.report.coverage).toEqual(
      expect.objectContaining({ fourPlayers: true, tableDisplay: true, replay: true }),
    );
    expect(evidence.projections).toHaveLength(5);
    expect(evidence.workbenches).toHaveLength(4);
    expect(evidence.guided).toHaveLength(4);
    expect(evidence.pairings).toHaveLength(4);
    expect(evidence.pairings.every((pairing) => pairing.opponents.length === 3)).toBe(true);
    expect(evidence.table.revision).toBe(4);
    expect([
      ...evidence.workbenches,
      ...evidence.guided,
      ...evidence.pairings,
    ].every((view) => view.revision === 4)).toBe(true);
    expect(evidence.workbenches.map((view) => view.corePlayerId)).toEqual(CORE_PLAYERS);
    expect(evidence.workbenches.map((view) => view.seatIndex)).toEqual([0, 1, 2, 3]);
    assertAudienceSafe(evidence);

    const repeated = executeScenario(JSON.parse(before) as Headless.OnlineHeadlessRoomGateInputV1);
    expect(repeated.closure.finalStateDigest).toBe(evidence.closure.finalStateDigest);
    expect(Core.coreCanonicalDigestFromValueV1(repeated.closure.events)).toBe(
      Core.coreCanonicalDigestFromValueV1(evidence.closure.events),
    );
  });

  it('keeps rejected and duplicate commands outside ordered replay authority', () => {
    const input = canonicalInput();
    const evidence = executeScenario(input);
    expect(evidence.transition.report.counts).toEqual(expect.objectContaining({
      commandsAccepted: 4,
      commandsRejected: 3,
      commandDuplicates: 1,
      staleRevisionRejections: 1,
      roleRejections: 1,
    }));
    expect(evidence.closure.journal).toHaveLength(4);
    expect(evidence.closure.journal.map((entry) => entry.command.actorPlayerId)).toEqual(CORE_PLAYERS);
  });

  it('turns omission, reorder, substitution, and replay drift red', () => {
    const input = canonicalInput();
    const p4Id = COMMAND_IDS.accepted[3];
    const omitted = {
      ...input,
      actions: input.actions.filter((action) =>
        action.kind !== 'command' || action.commandId !== p4Id),
    };
    expect(() => executeScenario(omitted)).toThrow();

    const commandIndexes = input.actions
      .map((action, index) => action.kind === 'command' &&
        (action.commandId === COMMAND_IDS.accepted[2] || action.commandId === COMMAND_IDS.accepted[3])
        ? index
        : -1)
      .filter((index) => index >= 0);
    const reorderedActions = input.actions.slice();
    const firstIndex = commandIndexes[0];
    const secondIndex = commandIndexes[1];
    if (firstIndex === undefined || secondIndex === undefined) throw new Error('Expected command indexes');
    [reorderedActions[firstIndex], reorderedActions[secondIndex]] = [
      reorderedActions[secondIndex],
      reorderedActions[firstIndex],
    ];
    expect(() => executeScenario({ ...input, actions: reorderedActions })).toThrow();

    const substituted = input.actions.map((action) =>
      action.kind === 'command' && action.commandId === COMMAND_IDS.accepted[2]
        ? { ...action, command: commanderCast('P4', 3) }
        : action);
    expect(() => executeScenario({ ...input, actions: substituted })).toThrow();

    const evidence = executeScenario(input);
    const drifted = JSON.parse(JSON.stringify(evidence.closure.replayPackage)) as {
      expectedFinalStateDigest: string;
    };
    drifted.expectedFinalStateDigest = '0'.repeat(64);
    expect(Core.replayCoreCommandsV1(drifted as Core.CoreReplayPackageV1)).toMatchObject({
      ok: false,
      divergence: { code: 'FINAL_STATE_DIGEST_MISMATCH' },
    });

    const acceptedReceiptIndex = evidence.transition.state.receipts.findIndex(
      (receipt) => receipt.outcome.kind === 'accepted',
    );
    if (acceptedReceiptIndex < 0) throw new Error('Expected accepted receipt');
    const driftedRequestDigest = {
      ...evidence.transition.state,
      receipts: evidence.transition.state.receipts.map((receipt, index) =>
        index === acceptedReceiptIndex
          ? { ...receipt, requestDigest: 'f'.repeat(64) }
          : receipt),
    };
    expect(Protocol.validateOnlineProtocolStateV1(driftedRequestDigest).ok).toBe(true);
    expect(() => acceptedCommandsFor(input, driftedRequestDigest)).toThrow(
      'Accepted receipt lost command authority',
    );

    const driftedParticipant = {
      ...evidence.transition.state,
      receipts: evidence.transition.state.receipts.map((receipt, index) =>
        index === acceptedReceiptIndex
          ? { ...receipt, participantId: PLAYER_PARTICIPANT_IDS[1] }
          : receipt),
    };
    expect(Protocol.validateOnlineProtocolStateV1(driftedParticipant).ok).toBe(true);
    expect(() => acceptedCommandsFor(input, driftedParticipant)).toThrow(
      'Accepted receipt lost command authority',
    );
  });

  it('adds no production release-scenario surface and keeps later gates deferred', () => {
    expect(PUBLIC_RELEASE_RULESET_V1.schemaVersion).toBe(1);
    expect(CURRENT_CONTRACT_VERSIONS.protocolVersion).toBe(1);
    expect(CURRENT_CONTRACT_VERSIONS.projectionSchemaVersion).toBe(1);
    expect(Headless.runLocalOnlineHeadlessRoomGateV1).toBeTypeOf('function');
    expect(Projection.handleOnlineProjectedSnapshotRequestV1).toBeTypeOf('function');
  });
});
