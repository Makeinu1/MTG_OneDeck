import { describe, expect, it } from 'vitest';
import {
  createCoreCommandV1,
  type CoreCommandV1,
} from '../../../engine/core/index';
import {
  createOnlineProtocolStateV1,
  handleOnlineCommandEnvelopeV1,
  type OnlineProtocolStateV1,
} from '../../protocol/index';
import {
  activateOnlineRoomV1,
  joinOnlineRoomV1,
  startOnlineRoomV1,
  type OnlineRoomParticipantIdV1,
} from '../../room/index';
import {
  CAPABILITIES,
  PARTICIPANTS,
  makeCoreRoot,
  readyAllPlayers,
} from '../../room/__tests__/testHelpers';
import {
  ONLINE_HEADLESS_ROOM_GATE_SCHEMA_VERSION_V1,
  OnlineHeadlessRoomGateOperationErrorV1,
  runLocalOnlineHeadlessRoomGateV1,
  validateOnlineHeadlessRoomGateInputV1,
  validateOnlineHeadlessRoomGateReportV1,
  type OnlineHeadlessRoomGateInputV1,
} from '../index';

const TABLE_ID = 'table-display';
const TABLE_CAPABILITY = 'observer_capability_TTTTTTTTTTTTT';
const SERVER_BUILD = 'server-o4p-02e';
const CLIENT_BUILD = 'client-o4p-02e';

function participantId(value: string): OnlineRoomParticipantIdV1 {
  return value as OnlineRoomParticipantIdV1;
}

function state(): OnlineProtocolStateV1 {
  const coreRoot = makeCoreRoot();
  const room = activateOnlineRoomV1(
    startOnlineRoomV1(
      joinOnlineRoomV1(readyAllPlayers(), { participantId: TABLE_ID, role: 'table' }),
      PARTICIPANTS[0],
    ),
    { hostParticipantId: PARTICIPANTS[0], coreRoot },
  );
  return createOnlineProtocolStateV1({
    serverBuildId: SERVER_BUILD,
    room,
    coreRoot,
    observerAuthorizations: [
      { participantId: TABLE_ID, observerCapability: TABLE_CAPABILITY },
    ],
  });
}

function command(
  sequence: number,
  decisionKey: string,
  physicalCardId: 'PC1' | 'PC3' = 'PC1',
): CoreCommandV1 {
  return createCoreCommandV1({
    schemaVersion: 1,
    sequence,
    actorPlayerId: 'P1' as never,
    decisionMakerPlayerId: 'P1' as never,
    decisionContext: { kind: 'decision', decisionKey },
    payload: {
      kind: 'commander-cast-record',
      physicalCardId: physicalCardId as never,
      origin: 'command-zone',
      accepted: true,
    },
  });
}

function validInput(): OnlineHeadlessRoomGateInputV1 {
  const initial = state();
  const first = command(1, 'headless-first');
  const stale = command(1, 'headless-stale');
  const tableRole = command(2, 'headless-table-role');
  const playerReject = command(2, 'headless-player-reject', 'PC3');
  const second = command(2, 'headless-second');
  return {
    kind: 'online-local-headless-room-gate-input-v1',
    schemaVersion: 1,
    state: initial,
    clients: [
      ...PARTICIPANTS.map((participantId, index) => ({
        participantId: participantId as OnlineRoomParticipantIdV1,
        participantCapability: CAPABILITIES[index] as never,
        clientBuildId: CLIENT_BUILD,
      })),
      {
        participantId: participantId(TABLE_ID),
        participantCapability: TABLE_CAPABILITY as never,
        clientBuildId: CLIENT_BUILD,
      },
    ],
    actions: [
      ...[...PARTICIPANTS, TABLE_ID].map((participantId) => ({
        kind: 'client-hello' as const,
        participantId: participantId as OnlineRoomParticipantIdV1,
      })),
      {
        kind: 'command',
        participantId: participantId(PARTICIPANTS[0]),
        commandId: 'accepted-first' as never,
        baseRevision: 0,
        command: first,
      },
      {
        kind: 'command',
        participantId: participantId(PARTICIPANTS[0]),
        commandId: 'accepted-first' as never,
        baseRevision: 0,
        command: first,
      },
      {
        kind: 'command',
        participantId: participantId(PARTICIPANTS[0]),
        commandId: 'stale-command' as never,
        baseRevision: 0,
        command: stale,
      },
      {
        kind: 'projection',
        participantId: participantId(PARTICIPANTS[0]),
        knownRevision: 0,
        decisionContext: null,
      },
      {
        kind: 'command',
        participantId: participantId(TABLE_ID),
        commandId: 'table-role-command' as never,
        baseRevision: 1,
        command: tableRole,
      },
      {
        kind: 'command',
        participantId: participantId(PARTICIPANTS[0]),
        commandId: 'player-rejected-command' as never,
        baseRevision: 1,
        command: playerReject,
      },
      {
        kind: 'command',
        participantId: participantId(PARTICIPANTS[0]),
        commandId: 'accepted-second' as never,
        baseRevision: 1,
        command: second,
      },
      { kind: 'disconnect', participantId: participantId(PARTICIPANTS[1]) },
      {
        kind: 'projection',
        participantId: participantId(PARTICIPANTS[1]),
        knownRevision: 2,
        decisionContext: null,
      },
      {
        kind: 'projection',
        participantId: participantId(PARTICIPANTS[2]),
        knownRevision: 2,
        decisionContext: null,
      },
      {
        kind: 'projection',
        participantId: participantId(PARTICIPANTS[3]),
        knownRevision: 2,
        decisionContext: null,
      },
      { kind: 'disconnect', participantId: participantId(TABLE_ID) },
      {
        kind: 'projection',
        participantId: participantId(TABLE_ID),
        knownRevision: 2,
        decisionContext: null,
      },
    ],
  };
}

function assertDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && 'value' in descriptor) {
      assertDeepFrozen(descriptor.value, seen);
    }
  }
}

describe('O4P-02E local headless room gate', () => {
  it('validates a fresh exact input without mutation and rejects secret-shaped hostile fields', () => {
    expect(ONLINE_HEADLESS_ROOM_GATE_SCHEMA_VERSION_V1).toBe(1);
    const input = validInput();
    const before = JSON.stringify(input);
    const result = validateOnlineHeadlessRoomGateInputV1(input);
    expect(result).toMatchObject({ ok: true });
    expect(JSON.stringify(input)).toBe(before);
    if (!result.ok) throw new Error('Expected valid headless input');
    expect(result.value).not.toBe(input);
    assertDeepFrozen(result);

    let getterCalled = false;
    const hostile: Record<string, unknown> = { ...input };
    Object.defineProperty(hostile, 'actions', {
      enumerable: true,
      get(): unknown {
        getterCalled = true;
        return [];
      },
    });
    Object.defineProperty(hostile, CAPABILITIES[0], { enumerable: true, value: true });
    const first = validateOnlineHeadlessRoomGateInputV1(hostile);
    const second = validateOnlineHeadlessRoomGateInputV1(hostile);
    expect(first).toEqual(second);
    expect(first.ok).toBe(false);
    expect(getterCalled).toBe(false);
    if (first.ok) throw new Error('Expected hostile input rejection');
    expect(first.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'UNKNOWN_FIELD', path: '/<unknown-field>' }),
      expect.objectContaining({ code: 'INVALID_DESCRIPTOR', path: '/actions' }),
    ]));
    expect(JSON.stringify(first)).not.toContain(CAPABILITIES[0]);
    assertDeepFrozen(first);
  });

  it('redacts possible capability-fragment unknown keys before canonical extraction', () => {
    const input = validInput();
    const capabilityFragment = CAPABILITIES[0].slice(0, 8);
    const result = validateOnlineHeadlessRoomGateInputV1({
      ...input,
      state: { ...input.state, serverBuildId: 'invalid build id' },
      clients: [],
      actions: [],
      extra: true,
      [capabilityFragment]: true,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected invalid input rejection');
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'UNKNOWN_FIELD', path: '/<unknown-field>' }),
      expect.objectContaining({ code: 'UNKNOWN_FIELD', path: '/extra' }),
      expect.objectContaining({ code: 'INVALID_PROTOCOL_STATE', path: '/state' }),
    ]));
    expect(JSON.stringify(result)).not.toContain(capabilityFragment);
    assertDeepFrozen(result);
  });

  it('rejects configured capabilities nested in the action graph', () => {
    const input = validInput();
    const firstAction = input.actions.find((action) => action.kind === 'command');
    if (firstAction?.kind !== 'command') throw new Error('Expected command action');
    const capabilityFragment = CAPABILITIES[0].slice(0, 8);
    const secretCommand = command(firstAction.command.sequence, capabilityFragment);
    const actions = input.actions.map((action) =>
      action === firstAction
        ? { ...action, commandId: capabilityFragment, command: secretCommand }
        : action);
    const result = validateOnlineHeadlessRoomGateInputV1({ ...input, actions });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected action capability rejection');
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INVALID_CAPABILITY', path: '/actions/5' }),
    ]));
    expect(JSON.stringify(result)).not.toContain(CAPABILITIES[0]);
  });

  it('rejects oversized actions before entries and rejects already-exited canonical authority', () => {
    const input = validInput();
    let getterCalled = false;
    const oversized = new Array<unknown>(257);
    Object.defineProperty(oversized, '0', {
      enumerable: true,
      get(): unknown {
        getterCalled = true;
        return input.actions[0];
      },
    });
    const oversizedResult = validateOnlineHeadlessRoomGateInputV1({
      ...input,
      actions: oversized,
    });
    expect(oversizedResult.ok).toBe(false);
    expect(getterCalled).toBe(false);
    if (oversizedResult.ok) throw new Error('Expected oversized action rejection');
    expect(oversizedResult.issues).toEqual([
      expect.objectContaining({ code: 'INVALID_ARRAY', path: '/actions/length' }),
    ]);

    const exitCommand = createCoreCommandV1({
      schemaVersion: 1,
      sequence: 1,
      actorPlayerId: 'P4' as never,
      decisionMakerPlayerId: 'P4' as never,
      decisionContext: { kind: 'decision', decisionKey: 'headless-exited-start' },
      payload: {
        kind: 'player-exit',
        playerId: 'P4' as never,
        cause: 'concession',
      },
    });
    const exitedState = handleOnlineCommandEnvelopeV1(input.state, {
      kind: 'online-command-envelope-v1',
      protocolVersion: 1,
      roomId: input.state.room.roomId,
      participantId: PARTICIPANTS[3],
      participantCapability: CAPABILITIES[3],
      commandId: 'headless-exited-start',
      baseRevision: 0,
      command: exitCommand,
    }).state;
    const exitedResult = validateOnlineHeadlessRoomGateInputV1({
      ...input,
      state: exitedState,
    });
    expect(exitedResult.ok).toBe(false);
    if (exitedResult.ok) throw new Error('Expected exited authority rejection');
    expect(exitedResult.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'INVALID_RELATION',
        path: '/state/coreRoot/playerLifecycle',
      }),
    ]));
  });

  it('fails closed when a public Room identifier contains an eight-unit capability fragment', () => {
    const input = validInput();
    const capabilityFragment = CAPABILITIES[0].slice(0, 8);
    const fragmentState = createOnlineProtocolStateV1({
      serverBuildId: input.state.serverBuildId,
      room: { ...input.state.room, roomId: `room-${capabilityFragment}` },
      coreRoot: input.state.coreRoot,
      observerAuthorizations: input.state.observerAuthorizations,
    });
    const fragmentInput = { ...input, state: fragmentState };
    expect(validateOnlineHeadlessRoomGateInputV1(fragmentInput)).toMatchObject({ ok: true });
    expect(() => runLocalOnlineHeadlessRoomGateV1(fragmentInput)).toThrowError(
      expect.objectContaining({ code: 'PRIVACY_REJECTED' }),
    );
  });

  it('runs the complete serial composition and returns only the safe exact report', () => {
    const input = validInput();
    const transition = runLocalOnlineHeadlessRoomGateV1(input);
    expect(transition.state.revision).toBe(2);
    expect(transition.report).toMatchObject({
      kind: 'online-local-headless-room-gate-report-v1',
      schemaVersion: 1,
      protocolVersion: 1,
      initialRevision: 0,
      finalRevision: 2,
      finalRoomLifecycle: 'active',
      counts: {
        clientHellosAccepted: 5,
        clientHellosRejected: 0,
        commandsAccepted: 2,
        commandsRejected: 3,
        commandDuplicates: 1,
        staleRevisionRejections: 1,
        roleRejections: 1,
        projectionsAccepted: 5,
        projectionsRejected: 0,
        disconnects: 2,
        playerRejoins: 1,
        tableRejoins: 1,
      },
    });
    expect(transition.report.clients.map((client) => client.corePlayerId)).toEqual([
      'P1', 'P2', 'P3', 'P4', null,
    ]);
    expect(transition.report.clients.every((client) => client.presence === 'connected')).toBe(true);
    expect(Object.values(transition.report.coverage).every((value) => value === true)).toBe(true);
    expect(Object.keys(transition.report)).toEqual([
      'kind',
      'schemaVersion',
      'protocolVersion',
      'roomId',
      'initialRevision',
      'finalRevision',
      'finalRoomLifecycle',
      'clients',
      'counts',
      'coverage',
      'deferred',
    ]);
    expect(JSON.stringify(transition.report)).not.toContain('capability');
    for (const capability of [...CAPABILITIES, TABLE_CAPABILITY]) {
      expect(JSON.stringify(transition.report)).not.toContain(capability);
    }
    expect(validateOnlineHeadlessRoomGateReportV1(transition.report)).toMatchObject({ ok: true });
    assertDeepFrozen(transition);
  });

  it('rejects publicly impossible report action and reconnect counts', () => {
    const report = runLocalOnlineHeadlessRoomGateV1(validInput()).report;
    const excessiveActions = validateOnlineHeadlessRoomGateReportV1({
      ...structuredClone(report),
      counts: {
        ...report.counts,
        clientHellosAccepted: 257,
      },
    });
    expect(excessiveActions.ok).toBe(false);
    if (excessiveActions.ok) throw new Error('Expected aggregate action count rejection');
    expect(excessiveActions.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INVALID_RELATION', path: '/counts' }),
    ]));
    assertDeepFrozen(excessiveActions);

    const excessiveRejoins = validateOnlineHeadlessRoomGateReportV1({
      ...structuredClone(report),
      counts: {
        ...report.counts,
        disconnects: 2,
        playerRejoins: 10,
        tableRejoins: 10,
        projectionsAccepted: 20,
      },
    });
    expect(excessiveRejoins.ok).toBe(false);
    if (excessiveRejoins.ok) throw new Error('Expected reconnect count rejection');
    expect(excessiveRejoins.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INVALID_RELATION', path: '/counts/playerRejoins' }),
    ]));
    assertDeepFrozen(excessiveRejoins);
  });

  it('rejects public report order drift and freezes generic operation errors', () => {
    const report = runLocalOnlineHeadlessRoomGateV1(validInput()).report;
    const firstCanonical = validateOnlineHeadlessRoomGateReportV1(report);
    const secondCanonical = validateOnlineHeadlessRoomGateReportV1(report);
    expect(firstCanonical.ok).toBe(true);
    expect(secondCanonical.ok).toBe(true);
    if (!firstCanonical.ok || !secondCanonical.ok) throw new Error('Expected canonical reports');
    expect(firstCanonical.value).not.toBe(report);
    expect(firstCanonical.value.deferred).not.toBe(report.deferred);
    expect(firstCanonical.value.deferred).not.toBe(secondCanonical.value.deferred);

    const swapped = structuredClone(report);
    const swappedClients = [...swapped.clients];
    [swappedClients[0], swappedClients[1]] = [swappedClients[1], swappedClients[0]];
    const result = validateOnlineHeadlessRoomGateReportV1({
      ...swapped,
      clients: swappedClients,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected swapped report rejection');
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INVALID_RELATION', path: '/clients' }),
    ]));

    const formingResult = validateOnlineHeadlessRoomGateReportV1({
      ...structuredClone(report),
      finalRoomLifecycle: 'forming',
    });
    expect(formingResult.ok).toBe(false);
    if (formingResult.ok) throw new Error('Expected unreachable lifecycle rejection');
    expect(formingResult.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INVALID_LITERAL', path: '/finalRoomLifecycle' }),
    ]));

    let thrown: unknown;
    try {
      runLocalOnlineHeadlessRoomGateV1({
        ...validInput(),
        actions: [],
      });
    } catch (error: unknown) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(OnlineHeadlessRoomGateOperationErrorV1);
    const operationError = thrown as OnlineHeadlessRoomGateOperationErrorV1;
    expect(operationError.code).toBe('COVERAGE_MISSING');
    expect(operationError.name).toBe('OnlineHeadlessRoomGateOperationErrorV1');
    expect(Object.keys(operationError)).not.toEqual(expect.arrayContaining([
      'cause', 'request', 'response', 'state', 'projection', 'stack',
    ]));
    assertDeepFrozen(operationError);
  });
});
