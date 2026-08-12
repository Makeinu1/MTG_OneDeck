import { describe, expect, it } from 'vitest';
import {
  createCoreCommandV1,
  type CoreCommandV1,
  type ModeNeutralCoreRootV1,
} from '../../../engine/core/index';
import {
  activateOnlineRoomV1,
  disconnectOnlineRoomParticipantV1,
  joinOnlineRoomV1,
  startOnlineRoomV1,
  type OnlineRoomV1,
} from '../../room/index';
import { CURRENT_CONTRACT_VERSIONS } from '../../../versioning/index';
import {
  CAPABILITIES,
  PARTICIPANTS,
  makeCoreRoot,
  readyAllPlayers,
} from '../../room/__tests__/testHelpers';
import {
  ONLINE_PROTOCOL_SCHEMA_VERSION_V1,
  OnlineProtocolCreationErrorV1,
  createOnlineProtocolStateV1,
  handleOnlineClientHelloV1,
  handleOnlineCommandEnvelopeV1,
  handleOnlineSnapshotRequestV1,
  isOnlineProtocolCommandIdV1,
  validateOnlineClientHelloV1,
  validateOnlineProtocolStateV1,
  type OnlineProtocolStateV1,
} from '../index';

const SERVER_BUILD = 'server-build-02c';
const CLIENT_BUILD = 'client-build-02c';
const OBSERVER_CAPABILITY = 'observer_capability_AAAAAAAAAAAAA';

function activeRoom(coreRoot: ModeNeutralCoreRootV1 = makeCoreRoot()): OnlineRoomV1 {
  const started = startOnlineRoomV1(readyAllPlayers(), PARTICIPANTS[0]);
  return activateOnlineRoomV1(started, {
    hostParticipantId: PARTICIPANTS[0],
    coreRoot,
  });
}

function protocolState(
  room: OnlineRoomV1 = activeRoom(),
  coreRoot: ModeNeutralCoreRootV1 = makeCoreRoot(),
  observerAuthorizations: readonly unknown[] = [],
): OnlineProtocolStateV1 {
  return createOnlineProtocolStateV1({
    serverBuildId: SERVER_BUILD,
    room,
    coreRoot,
    observerAuthorizations,
  });
}

function command(root: ModeNeutralCoreRootV1, sequence = root.acceptedCommandCount + 1): CoreCommandV1 {
  return createCoreCommandV1({
    schemaVersion: 1,
    sequence,
    actorPlayerId: 'P1' as never,
    decisionMakerPlayerId: 'P1' as never,
    decisionContext: { kind: 'decision', decisionKey: 'protocol-command' },
    payload: {
      kind: 'commander-cast-record',
      physicalCardId: 'PC1' as never,
      origin: 'command-zone',
      accepted: true,
    },
  });
}

function envelope(
  state: OnlineProtocolStateV1,
  commandId: string,
  baseRevision = state.revision,
  coreCommand: CoreCommandV1 = command(state.coreRoot, baseRevision + 1),
): unknown {
  return {
    kind: 'online-command-envelope-v1',
    protocolVersion: CURRENT_CONTRACT_VERSIONS.protocolVersion,
    roomId: state.room.roomId,
    participantId: PARTICIPANTS[0],
    participantCapability: CAPABILITIES[0],
    commandId,
    baseRevision,
    command: coreCommand,
  };
}

function assertDeepFrozen(value: unknown, seen = new Set<object>()): void {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  expect(Object.isFrozen(value)).toBe(true);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && 'value' in descriptor) assertDeepFrozen(descriptor.value, seen);
  }
}

describe('O4P-02C in-memory protocol', () => {
  it('exports fixed versions and validates hostile hello input without capability disclosure', () => {
    expect(ONLINE_PROTOCOL_SCHEMA_VERSION_V1).toBe(1);
    expect(isOnlineProtocolCommandIdV1('command-1')).toBe(true);
    expect(isOnlineProtocolCommandIdV1('__proto__')).toBe(false);

    const secret = CAPABILITIES[0];
    const input: Record<string, unknown> = {
      kind: 'online-client-hello-v1',
      protocolVersion: 2,
      roomId: 'room-02b',
      participantId: PARTICIPANTS[0],
      participantCapability: secret,
      clientBuildId: CLIENT_BUILD,
    };
    Object.defineProperty(input, secret, { enumerable: true, value: true });
    const first = validateOnlineClientHelloV1(input);
    const second = validateOnlineClientHelloV1(input);
    expect(first).toEqual(second);
    expect(first).toMatchObject({ ok: false });
    if (first.ok) throw new Error('Expected rejected hello');
    expect(first.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/<redacted-capability>' }),
        expect.objectContaining({ code: 'PROTOCOL_VERSION_MISMATCH' }),
      ]),
    );
    expect(JSON.stringify(first)).not.toContain(secret);
    assertDeepFrozen(first);

    let getterCalled = false;
    const accessor = { ...input };
    Object.defineProperty(accessor, 'participantCapability', {
      enumerable: true,
      get(): string {
        getterCalled = true;
        return secret;
      },
    });
    expect(validateOnlineClientHelloV1(accessor)).toMatchObject({ ok: false });
    expect(getterCalled).toBe(false);
  });

  it('creates and validates the exact active state and rejects relation drift', () => {
    const state = protocolState();
    expect(state).toMatchObject({
      kind: 'online-protocol-state-v1',
      schemaVersion: 1,
      protocolVersion: 1,
      revision: 0,
      receipts: [],
    });
    expect(validateOnlineProtocolStateV1(state)).toMatchObject({ ok: true });
    assertDeepFrozen(state);

    const drifted = JSON.parse(JSON.stringify(state)) as { revision: number };
    drifted.revision = 1;
    const driftedResult = validateOnlineProtocolStateV1(drifted);
    expect(driftedResult.ok).toBe(false);
    if (driftedResult.ok) throw new Error('Expected revision drift rejection');
    expect(driftedResult.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'INVALID_PROTOCOL_STATE', path: '/revision' }),
      ]),
    );

    expect(
      () =>
        createOnlineProtocolStateV1({
          serverBuildId: SERVER_BUILD,
          room: { ...activeRoom(), lifecycle: 'finished' },
          coreRoot: makeCoreRoot(),
          observerAuthorizations: [],
        }),
    ).toThrow(OnlineProtocolCreationErrorV1);
  });

  it('accepts Build ID mismatch, authenticates reconnects, and preserves Core revision', () => {
    const initial = protocolState();
    const disconnectedRoom = disconnectOnlineRoomParticipantV1(initial.room, PARTICIPANTS[0]);
    const disconnected = protocolState(disconnectedRoom, initial.coreRoot);
    const transition = handleOnlineClientHelloV1(disconnected, {
      kind: 'online-client-hello-v1',
      protocolVersion: 1,
      roomId: disconnected.room.roomId,
      participantId: PARTICIPANTS[0],
      participantCapability: CAPABILITIES[0],
      clientBuildId: CLIENT_BUILD,
    });
    expect(transition.response).toMatchObject({
      status: 'accepted',
      clientBuildIdMatch: false,
      revision: disconnected.revision,
    });
    expect(transition.state.coreRoot).toBe(disconnected.coreRoot);
    expect(transition.state.revision).toBe(disconnected.revision);
    expect(transition.state.room.participants[0]?.presence).toBe('connected');

    const observerRoom = disconnectOnlineRoomParticipantV1(
      joinOnlineRoomV1(initial.room, {
        participantId: 'spectator-1',
        role: 'spectator',
      }),
      'spectator-1',
    );
    const observerState = protocolState(observerRoom, initial.coreRoot, [
      { participantId: 'spectator-1', observerCapability: OBSERVER_CAPABILITY },
    ]);
    const observerHello = handleOnlineClientHelloV1(observerState, {
      kind: 'online-client-hello-v1',
      protocolVersion: 1,
      roomId: observerState.room.roomId,
      participantId: 'spectator-1',
      participantCapability: OBSERVER_CAPABILITY,
      clientBuildId: SERVER_BUILD,
    });
    expect(observerHello.response).toMatchObject({ status: 'accepted', role: 'spectator' });
    expect(observerHello.state.room.participants.at(-1)?.presence).toBe('connected');

    const rejected = handleOnlineClientHelloV1(initial, {
      kind: 'online-client-hello-v1',
      protocolVersion: 2,
      roomId: initial.room.roomId,
      participantId: PARTICIPANTS[0],
      participantCapability: 'wrong_capability_AAAAAAAAAAAAAAAA',
      clientBuildId: SERVER_BUILD,
    });
    expect(rejected.state).toBe(initial);
    expect(rejected.response).toMatchObject({
      status: 'rejected',
      issues: [{ code: 'PROTOCOL_VERSION_MISMATCH' }],
    });
  });

  it('canonicalizes mutable valid unknown state while preserving canonical no-change identity', () => {
    const canonical = protocolState();
    const mutable = JSON.parse(JSON.stringify(canonical)) as unknown;
    expect(Object.isFrozen(mutable)).toBe(false);

    const mutableTransition = handleOnlineClientHelloV1(mutable, {
      kind: 'online-client-hello-v1',
      protocolVersion: 1,
      roomId: canonical.room.roomId,
      participantId: PARTICIPANTS[0],
      participantCapability: CAPABILITIES[0],
      clientBuildId: SERVER_BUILD,
    });
    expect(mutableTransition.response).toMatchObject({ status: 'accepted' });
    expect(mutableTransition.state).not.toBe(mutable);
    assertDeepFrozen(mutableTransition.state);

    const canonicalTransition = handleOnlineClientHelloV1(canonical, {
      kind: 'online-client-hello-v1',
      protocolVersion: 1,
      roomId: canonical.room.roomId,
      participantId: PARTICIPANTS[0],
      participantCapability: CAPABILITIES[0],
      clientBuildId: SERVER_BUILD,
    });
    expect(canonicalTransition.state).toBe(canonical);
  });

  it('rejects configured capabilities nested in Core commands before digest or application', () => {
    const state = protocolState();
    const secretCommand = createCoreCommandV1({
      schemaVersion: 1,
      sequence: 1,
      actorPlayerId: 'P1' as never,
      decisionMakerPlayerId: 'P1' as never,
      decisionContext: { kind: 'search-session', searchSessionId: CAPABILITIES[0] },
      payload: {
        kind: 'commander-cast-record',
        physicalCardId: 'PC1' as never,
        origin: 'command-zone',
        accepted: true,
      },
    });
    const transition = handleOnlineCommandEnvelopeV1(
      state,
      envelope(state, 'secret-command', 0, secretCommand),
    );
    expect(transition.state).toBe(state);
    expect(transition.state.receipts).toHaveLength(0);
    expect(transition.state.revision).toBe(0);
    expect(transition.response).toMatchObject({
      kind: 'online-command-reject-v1',
      issues: [{ code: 'INVALID_CAPABILITY', path: '/command' }],
    });
    expect(JSON.stringify(transition.response)).not.toContain(CAPABILITIES[0]);
    expect(JSON.stringify(transition.state.coreRoot)).not.toContain(CAPABILITIES[0]);
  });

  it('applies once, reconstructs duplicates, rejects ID reuse, and stores no capability', () => {
    const state = protocolState();
    const input = envelope(state, 'accepted-command');
    const accepted = handleOnlineCommandEnvelopeV1(state, input);
    expect(accepted.response).toMatchObject({
      kind: 'online-command-ack-v1',
      status: 'accepted',
      duplicate: false,
      baseRevision: 0,
      acceptedRevision: 1,
      currentRevision: 1,
    });
    expect(accepted.state.revision).toBe(1);
    expect(accepted.state.receipts).toHaveLength(1);
    expect(JSON.stringify(accepted.response)).not.toContain(CAPABILITIES[0]);

    const duplicate = handleOnlineCommandEnvelopeV1(accepted.state, input);
    expect(duplicate.state).toBe(accepted.state);
    expect(duplicate.response).toMatchObject({ duplicate: true, acceptedRevision: 1 });
    expect(duplicate.state.receipts).toHaveLength(1);

    const reused = handleOnlineCommandEnvelopeV1(
      accepted.state,
      envelope(
        accepted.state,
        'accepted-command',
        1,
        command(accepted.state.coreRoot, 2),
      ),
    );
    expect(reused.state).toBe(accepted.state);
    expect(reused.response).toMatchObject({
      kind: 'online-command-reject-v1',
      issues: [{ code: 'COMMAND_ID_REUSE_MISMATCH' }],
    });
  });

  it('stores deterministic stale/Core rejects and returns metadata-only resync', () => {
    const initial = protocolState();
    const accepted = handleOnlineCommandEnvelopeV1(
      initial,
      envelope(initial, 'first-command'),
    ).state;
    const staleInput = envelope(accepted, 'stale-command', 0, command(initial.coreRoot, 1));
    const stale = handleOnlineCommandEnvelopeV1(accepted, staleInput);
    expect(stale.response).toMatchObject({
      kind: 'online-command-reject-v1',
      duplicate: false,
      resyncRequired: true,
      issues: [{ code: 'STALE_REVISION' }],
    });
    expect(stale.state.revision).toBe(accepted.revision);
    expect(stale.state.receipts).toHaveLength(2);
    const duplicate = handleOnlineCommandEnvelopeV1(stale.state, staleInput);
    expect(duplicate.state).toBe(stale.state);
    expect(duplicate.response).toMatchObject({ duplicate: true, resyncRequired: true });

    const resync = handleOnlineSnapshotRequestV1(stale.state, {
      kind: 'online-snapshot-request-v1',
      protocolVersion: 1,
      roomId: stale.state.room.roomId,
      participantId: PARTICIPANTS[0],
      participantCapability: CAPABILITIES[0],
      knownRevision: 0,
      clientBuildId: SERVER_BUILD,
    });
    expect(resync.state).toBe(stale.state);
    expect(resync.response).toEqual(
      expect.objectContaining({
        kind: 'online-resync-v1',
        reason: 'snapshot-required',
        projectionRequired: true,
        revision: 1,
      }),
    );
    expect(Object.keys(resync.response)).not.toContain('coreRoot');

    const forged = JSON.parse(JSON.stringify(stale.state)) as {
      receipts: Array<{ outcome: { issues: Array<{ path: string }> } }>;
    };
    forged.receipts[1].outcome.issues[0].path = '/PC6:0';
    expect(validateOnlineProtocolStateV1(forged)).toMatchObject({ ok: false });

    const coreRejectedCommand = createCoreCommandV1({
      schemaVersion: 1,
      sequence: 1,
      actorPlayerId: 'P1' as never,
      decisionMakerPlayerId: 'P1' as never,
      decisionContext: { kind: 'decision', decisionKey: 'protocol-reject' },
      payload: {
        kind: 'commander-cast-record',
        physicalCardId: 'PC3' as never,
        origin: 'command-zone',
        accepted: true,
      },
    });
    const coreRejected = handleOnlineCommandEnvelopeV1(
      initial,
      envelope(initial, 'core-rejected', 0, coreRejectedCommand),
    );
    expect(coreRejected.response).toMatchObject({
      issues: [{ code: 'CORE_COMMAND_REJECTED', path: '/command' }],
      resyncRequired: false,
    });
    expect(coreRejected.state.coreRoot).toBe(initial.coreRoot);
    expect(coreRejected.state.revision).toBe(0);
    expect(coreRejected.state.receipts).toHaveLength(1);
  });
});
