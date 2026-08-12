import { describe, expect, it } from 'vitest';

import * as Core from '../../../engine/core/index';
import * as Room from '../../room/index';
import {
  CAPABILITIES,
  PARTICIPANTS,
  coreCommand,
  joinAllPlayers,
  makeCoreRoot,
  readyAllPlayers,
} from '../../room/__tests__/testHelpers';
import * as Protocol from '../index';

const TABLE_ID = 'table-protocol';
const SPECTATOR_ID = 'spectator-protocol';
const TABLE_CAPABILITY = 'observer_capability_TTTTTTTTTTTTT';
const SPECTATOR_CAPABILITY = 'observer_capability_SSSSSSSSSSSSS';

function activeRoomAndRoot(): Readonly<{
  readonly room: Room.OnlineRoomV1;
  readonly root: Core.ModeNeutralCoreRootV1;
}> {
  let room = joinAllPlayers();
  room = Room.joinOnlineRoomV1(room, { participantId: TABLE_ID, role: 'table' });
  room = Room.joinOnlineRoomV1(room, { participantId: SPECTATOR_ID, role: 'spectator' });
  room = readyAllPlayers(room);
  room = Room.startOnlineRoomV1(room, PARTICIPANTS[0]);
  const root = makeCoreRoot();
  room = Room.activateOnlineRoomV1(room, {
    hostParticipantId: PARTICIPANTS[0],
    coreRoot: root,
  });
  return Object.freeze({ room, root });
}

function protocolState(
  roomOverride?: Room.OnlineRoomV1,
): Protocol.OnlineProtocolStateV1 {
  const { room, root } = activeRoomAndRoot();
  return Protocol.createOnlineProtocolStateV1({
    serverBuildId: 'server-o4p-02c',
    room: roomOverride ?? room,
    coreRoot: root,
    observerAuthorizations: [
      { participantId: TABLE_ID, observerCapability: TABLE_CAPABILITY },
      { participantId: SPECTATOR_ID, observerCapability: SPECTATOR_CAPABILITY },
    ],
  });
}

function playerMessageFields(participantIndex: number): Readonly<{
  readonly roomId: string;
  readonly participantId: string;
  readonly participantCapability: string;
}> {
  return Object.freeze({
    roomId: 'room-02b',
    participantId: PARTICIPANTS[participantIndex],
    participantCapability: CAPABILITIES[participantIndex],
  });
}

function commandEnvelope(
  state: Protocol.OnlineProtocolStateV1,
  commandId: string,
  baseRevision = state.revision,
  command: Core.CoreCommandV1 = coreCommand(
    state.coreRoot,
    'P1',
    {
      kind: 'commander-cast-record',
      physicalCardId: 'PC1' as Core.CorePhysicalCardId,
      origin: 'command-zone',
      accepted: true,
    },
  ),
  participantIndex = 0,
): unknown {
  return {
    kind: 'online-command-envelope-v1',
    protocolVersion: 1,
    ...playerMessageFields(participantIndex),
    commandId,
    baseRevision,
    command,
  };
}

function issueCodes(response: Protocol.OnlineCommandRejectV1): readonly string[] {
  return response.issues.map(({ code }) => code);
}

function assertNoPrivateProtocolData(value: unknown): void {
  const serialized = JSON.stringify(value);
  for (const secret of [
    ...CAPABILITIES,
    TABLE_CAPABILITY,
    SPECTATOR_CAPABILITY,
    'PC6:0',
    'PC1',
    'Actor and payload player must match',
  ]) {
    expect(serialized).not.toContain(secret);
  }
  expect(serialized).not.toMatch(/acceptedCommandCount|beforeStateDigest|afterStateDigest/);
  expect(serialized).not.toMatch(/ruleAuthority|playerLifecycle|seatCapability|observerCapability/);
  expect(serialized).not.toMatch(/requestDigest|payload|events|warnings/);
}

describe('O4P-02C judge-owned in-memory protocol evidence', () => {
  it('accepts exact V1 hello with diagnostic-only Build ID mismatch', () => {
    const state = protocolState();
    const transition = Protocol.handleOnlineClientHelloV1(state, {
      kind: 'online-client-hello-v1',
      protocolVersion: 1,
      ...playerMessageFields(0),
      clientBuildId: 'different-client-build',
    });
    expect(transition.response).toMatchObject({
      kind: 'online-server-hello-v1',
      protocolVersion: 1,
      status: 'accepted',
      revision: 0,
      role: 'player',
      clientBuildIdMatch: false,
    });
    expect(transition.state).toBe(state);
    expect(state.revision).toBe(state.coreRoot.acceptedCommandCount);
    expect(Protocol.validateOnlineProtocolStateV1(state)).toMatchObject({ ok: true });
    assertNoPrivateProtocolData(transition.response);

    for (const observer of [
      { participantId: TABLE_ID, capability: TABLE_CAPABILITY, role: 'table' },
      {
        participantId: SPECTATOR_ID,
        capability: SPECTATOR_CAPABILITY,
        role: 'spectator',
      },
    ] as const) {
      const hello = Protocol.handleOnlineClientHelloV1(state, {
        kind: 'online-client-hello-v1',
        protocolVersion: 1,
        roomId: state.room.roomId,
        participantId: observer.participantId,
        participantCapability: observer.capability,
        clientBuildId: 'server-o4p-02c',
      });
      expect(hello.response).toMatchObject({ status: 'accepted', role: observer.role });
      expect(hello.state).toBe(state);
      assertNoPrivateProtocolData(hello.response);
    }

    const mismatch = Protocol.handleOnlineClientHelloV1(state, {
      kind: 'online-client-hello-v1',
      protocolVersion: 2,
      ...playerMessageFields(0),
      clientBuildId: 'server-o4p-02c',
    });
    expect(mismatch.response).toMatchObject({
      status: 'rejected',
      roomId: null,
      participantId: null,
      role: null,
    });
    expect(mismatch.state).toBe(state);
    assertNoPrivateProtocolData(mismatch.response);
  });

  it('rejoins a player and observer without touching Core, revision, or receipts', () => {
    const initial = activeRoomAndRoot();
    const playerDisconnected = Room.disconnectOnlineRoomParticipantV1(
      initial.room,
      PARTICIPANTS[1],
    );
    const playerState = protocolState(playerDisconnected);
    const beforeCoreDigest = Core.coreCanonicalDigestFromValueV1(playerState.coreRoot);
    const playerHello = Protocol.handleOnlineClientHelloV1(playerState, {
      kind: 'online-client-hello-v1',
      protocolVersion: 1,
      ...playerMessageFields(1),
      clientBuildId: 'server-o4p-02c',
    });
    expect(playerHello.response).toMatchObject({ status: 'accepted', role: 'player' });
    expect(
      playerHello.state.room.participants.find(
        ({ participantId }) => participantId === PARTICIPANTS[1],
      )?.presence,
    ).toBe('connected');
    expect(Core.coreCanonicalDigestFromValueV1(playerHello.state.coreRoot)).toBe(beforeCoreDigest);
    expect(playerHello.state.revision).toBe(0);
    expect(playerHello.state.receipts).toEqual([]);

    const observerDisconnected = Room.disconnectOnlineRoomParticipantV1(initial.room, TABLE_ID);
    const observerState = protocolState(observerDisconnected);
    const observerResync = Protocol.handleOnlineSnapshotRequestV1(observerState, {
      kind: 'online-snapshot-request-v1',
      protocolVersion: 1,
      roomId: observerState.room.roomId,
      participantId: TABLE_ID,
      participantCapability: TABLE_CAPABILITY,
      knownRevision: 0,
      clientBuildId: 'different-client-build',
    });
    expect(observerResync.response).toMatchObject({
      kind: 'online-resync-v1',
      role: 'table',
      reason: 'rejoined',
      projectionRequired: false,
      clientBuildIdMatch: false,
    });
    expect(
      observerResync.state.room.participants.find(
        ({ participantId }) => participantId === TABLE_ID,
      )?.presence,
    ).toBe('connected');
    expect(observerResync.state.revision).toBe(0);
    expect(observerResync.state.receipts).toEqual([]);
    assertNoPrivateProtocolData(observerResync.response);
  });

  it('applies once, ACKs, deduplicates before stale, and rejects ID reuse', () => {
    const state = protocolState();
    const envelope = commandEnvelope(state, 'review-command-1');
    const accepted = Protocol.handleOnlineCommandEnvelopeV1(state, envelope);
    expect(accepted.response).toMatchObject({
      kind: 'online-command-ack-v1',
      commandId: 'review-command-1',
      baseRevision: 0,
      acceptedRevision: 1,
      currentRevision: 1,
      status: 'accepted',
      duplicate: false,
    });
    expect(accepted.state.revision).toBe(1);
    expect(accepted.state.coreRoot.acceptedCommandCount).toBe(1);
    expect(accepted.state.receipts).toHaveLength(1);
    assertNoPrivateProtocolData(accepted.response);

    const duplicate = Protocol.handleOnlineCommandEnvelopeV1(accepted.state, envelope);
    expect(duplicate.response).toMatchObject({
      kind: 'online-command-ack-v1',
      acceptedRevision: 1,
      currentRevision: 1,
      duplicate: true,
    });
    expect(duplicate.state).toBe(accepted.state);
    expect(duplicate.state.receipts).toHaveLength(1);

    const reused = Protocol.handleOnlineCommandEnvelopeV1(
      accepted.state,
      commandEnvelope(accepted.state, 'review-command-1'),
    );
    expect(reused.response.kind).toBe('online-command-reject-v1');
    if (reused.response.kind !== 'online-command-reject-v1') {
      throw new Error('Expected command reject');
    }
    expect(issueCodes(reused.response)).toContain('COMMAND_ID_REUSE_MISMATCH');
    expect(reused.state).toBe(accepted.state);
    expect(reused.state.receipts).toHaveLength(1);
    assertNoPrivateProtocolData(reused.response);
  });

  it('records stale rejection once and exposes only resync control metadata', () => {
    const initial = protocolState();
    const firstEnvelope = commandEnvelope(initial, 'review-current-1');
    const current = Protocol.handleOnlineCommandEnvelopeV1(initial, firstEnvelope).state;
    const staleEnvelope = commandEnvelope(
      current,
      'review-stale-1',
      0,
      coreCommand(initial.coreRoot, 'P1', {
        kind: 'commander-cast-record',
        physicalCardId: 'PC1' as Core.CorePhysicalCardId,
        origin: 'command-zone',
        accepted: true,
      }),
    );
    const stale = Protocol.handleOnlineCommandEnvelopeV1(current, staleEnvelope);
    expect(stale.response.kind).toBe('online-command-reject-v1');
    if (stale.response.kind !== 'online-command-reject-v1') throw new Error('Expected reject');
    expect(stale.response).toMatchObject({
      currentRevision: 1,
      duplicate: false,
      resyncRequired: true,
    });
    expect(issueCodes(stale.response)).toContain('STALE_REVISION');
    expect(stale.state.coreRoot).toBe(current.coreRoot);
    expect(stale.state.room).toBe(current.room);
    expect(stale.state.revision).toBe(1);
    expect(stale.state.receipts).toHaveLength(2);

    const duplicate = Protocol.handleOnlineCommandEnvelopeV1(stale.state, staleEnvelope);
    expect(duplicate.response).toMatchObject({ duplicate: true, resyncRequired: true });
    expect(duplicate.state).toBe(stale.state);

    const resync = Protocol.handleOnlineSnapshotRequestV1(stale.state, {
      kind: 'online-snapshot-request-v1',
      protocolVersion: 1,
      ...playerMessageFields(1),
      knownRevision: 0,
      clientBuildId: 'server-o4p-02c',
    });
    expect(resync.response).toMatchObject({
      kind: 'online-resync-v1',
      knownRevision: 0,
      revision: 1,
      reason: 'snapshot-required',
      projectionRequired: true,
    });
    expect(resync.state).toBe(stale.state);
    assertNoPrivateProtocolData(resync.response);

    const synchronized = Protocol.handleOnlineSnapshotRequestV1(stale.state, {
      kind: 'online-snapshot-request-v1',
      protocolVersion: 1,
      ...playerMessageFields(1),
      knownRevision: stale.state.revision,
      clientBuildId: 'server-o4p-02c',
    });
    expect(synchronized.response).toMatchObject({
      kind: 'online-resync-v1',
      knownRevision: 1,
      revision: 1,
      reason: 'synchronized',
      projectionRequired: false,
    });
    expect(synchronized.state).toBe(stale.state);
    assertNoPrivateProtocolData(synchronized.response);
  });

  it('keeps authorization and Core rejection generic and atomic', () => {
    const state = protocolState();
    const wrongCapability = 'foreign_capability_XXXXXXXXXXXXXXXX';
    const unauthorizedEnvelope = {
      ...(commandEnvelope(state, 'review-auth-1') as Record<string, unknown>),
      participantCapability: wrongCapability,
    };
    const unauthorized = Protocol.handleOnlineCommandEnvelopeV1(state, unauthorizedEnvelope);
    expect(unauthorized.response.kind).toBe('online-command-reject-v1');
    if (unauthorized.response.kind !== 'online-command-reject-v1') {
      throw new Error('Expected command reject');
    }
    expect(issueCodes(unauthorized.response)).toEqual(['AUTHORIZATION_REJECTED']);
    expect(JSON.stringify(unauthorized.response)).not.toContain(wrongCapability);
    expect(unauthorized.state).toBe(state);

    const coreRejectedCommand = coreCommand(state.coreRoot, 'P1', {
      kind: 'commander-cast-record',
      physicalCardId: 'PC3' as Core.CorePhysicalCardId,
      origin: 'command-zone',
      accepted: true,
    });
    const coreRejected = Protocol.handleOnlineCommandEnvelopeV1(
      state,
      commandEnvelope(state, 'review-core-reject-1', 0, coreRejectedCommand),
    );
    expect(coreRejected.response.kind).toBe('online-command-reject-v1');
    if (coreRejected.response.kind !== 'online-command-reject-v1') {
      throw new Error('Expected command reject');
    }
    expect(issueCodes(coreRejected.response)).toEqual(['CORE_COMMAND_REJECTED']);
    expect(coreRejected.state.coreRoot).toBe(state.coreRoot);
    expect(coreRejected.state.room).toBe(state.room);
    expect(coreRejected.state.revision).toBe(0);
    expect(coreRejected.state.receipts).toHaveLength(1);
    assertNoPrivateProtocolData(coreRejected.response);
  });

  it('rejects observer, actor, and sequence violations before Core without receipts', () => {
    const state = protocolState();
    const tableEnvelope = {
      ...(commandEnvelope(state, 'review-table-role-1') as Record<string, unknown>),
      participantId: TABLE_ID,
      participantCapability: TABLE_CAPABILITY,
    };
    const tableRejected = Protocol.handleOnlineCommandEnvelopeV1(state, tableEnvelope);
    expect(tableRejected.response.kind).toBe('online-command-reject-v1');
    if (tableRejected.response.kind !== 'online-command-reject-v1') {
      throw new Error('Expected table command reject');
    }
    expect(issueCodes(tableRejected.response)).toEqual(['ROLE_NOT_ALLOWED']);
    expect(tableRejected.state).toBe(state);
    expect(tableRejected.state.receipts).toEqual([]);

    const p2Command = coreCommand(state.coreRoot, 'P2', {
      kind: 'commander-cast-record',
      physicalCardId: 'PC3' as Core.CorePhysicalCardId,
      origin: 'command-zone',
      accepted: true,
    });
    const actorRejected = Protocol.handleOnlineCommandEnvelopeV1(
      state,
      commandEnvelope(state, 'review-actor-mismatch-1', 0, p2Command),
    );
    expect(actorRejected.response.kind).toBe('online-command-reject-v1');
    if (actorRejected.response.kind !== 'online-command-reject-v1') {
      throw new Error('Expected actor mismatch reject');
    }
    expect(issueCodes(actorRejected.response)).toEqual(['ACTOR_MISMATCH']);
    expect(actorRejected.state).toBe(state);
    expect(actorRejected.state.receipts).toEqual([]);

    const wrongSequenceCommand: Core.CoreCommandV1 = Object.freeze({
      ...coreCommand(state.coreRoot, 'P1', {
        kind: 'commander-cast-record',
        physicalCardId: 'PC1' as Core.CorePhysicalCardId,
        origin: 'command-zone',
        accepted: true,
      }),
      sequence: 2,
    });
    const sequenceRejected = Protocol.handleOnlineCommandEnvelopeV1(
      state,
      commandEnvelope(state, 'review-sequence-mismatch-1', 0, wrongSequenceCommand),
    );
    expect(sequenceRejected.response.kind).toBe('online-command-reject-v1');
    if (sequenceRejected.response.kind !== 'online-command-reject-v1') {
      throw new Error('Expected sequence mismatch reject');
    }
    expect(issueCodes(sequenceRejected.response)).toEqual(['COMMAND_SEQUENCE_MISMATCH']);
    expect(sequenceRejected.state).toBe(state);
    expect(sequenceRejected.state.receipts).toEqual([]);

    const disconnectedRoom = Room.disconnectOnlineRoomParticipantV1(
      state.room,
      PARTICIPANTS[1],
    );
    const disconnectedState = protocolState(disconnectedRoom);
    const disconnectedCommand = coreCommand(disconnectedState.coreRoot, 'P2', {
      kind: 'commander-cast-record',
      physicalCardId: 'PC3' as Core.CorePhysicalCardId,
      origin: 'command-zone',
      accepted: true,
    });
    const disconnectedRejected = Protocol.handleOnlineCommandEnvelopeV1(
      disconnectedState,
      commandEnvelope(
        disconnectedState,
        'review-disconnected-1',
        0,
        disconnectedCommand,
        1,
      ),
    );
    expect(disconnectedRejected.response.kind).toBe('online-command-reject-v1');
    if (disconnectedRejected.response.kind !== 'online-command-reject-v1') {
      throw new Error('Expected disconnected participant reject');
    }
    expect(issueCodes(disconnectedRejected.response)).toEqual(['PARTICIPANT_NOT_CONNECTED']);
    expect(disconnectedRejected.state).toBe(disconnectedState);
    expect(disconnectedRejected.state.receipts).toEqual([]);

    const malformedEnvelope = {
      ...(commandEnvelope(state, 'review-malformed-core-1') as Record<string, unknown>),
      command: Object.freeze({ kind: 'mode-neutral-core-command-v1' }),
    };
    const malformedRejected = Protocol.handleOnlineCommandEnvelopeV1(state, malformedEnvelope);
    expect(malformedRejected.response.kind).toBe('online-command-reject-v1');
    if (malformedRejected.response.kind !== 'online-command-reject-v1') {
      throw new Error('Expected malformed Core command reject');
    }
    expect(issueCodes(malformedRejected.response)).toEqual(['INVALID_TYPE']);
    expect(malformedRejected.state).toBe(state);
    expect(malformedRejected.state.receipts).toEqual([]);
    assertNoPrivateProtocolData(malformedRejected.response);
  });

  it('reconciles accepted player exits through Room finished and rejects terminal rejoin', () => {
    let state = protocolState();
    const exitCases = [
      { participantIndex: 3, playerId: 'P4', cause: 'concession', outcome: 'conceded' },
      { participantIndex: 2, playerId: 'P3', cause: 'defeat', outcome: 'defeated' },
      { participantIndex: 0, playerId: 'P1', cause: 'defeat', outcome: 'defeated' },
    ] as const;

    for (const exitCase of exitCases) {
      const command = coreCommand(state.coreRoot, exitCase.playerId, {
        kind: 'player-exit',
        playerId: exitCase.playerId as Core.CorePlayerId,
        cause: exitCase.cause,
      });
      const transition = Protocol.handleOnlineCommandEnvelopeV1(
        state,
        commandEnvelope(
          state,
          `review-exit-${exitCase.playerId}`,
          state.revision,
          command,
          exitCase.participantIndex,
        ),
      );
      expect(transition.response.kind).toBe('online-command-ack-v1');
      if (transition.response.kind !== 'online-command-ack-v1') {
        throw new Error(`Expected ${exitCase.playerId} exit ACK`);
      }
      state = transition.state;
      expect(state.room.seats[exitCase.participantIndex]?.outcome).toBe(exitCase.outcome);
      expect(state.revision).toBe(state.coreRoot.acceptedCommandCount);
    }

    expect(state.revision).toBe(3);
    expect(state.receipts).toHaveLength(3);
    expect(state.room.lifecycle).toBe('finished');
    expect(state.room.seats.map(({ outcome }) => outcome)).toEqual([
      'defeated',
      'pending',
      'defeated',
      'conceded',
    ]);

    const disconnectedRoom = Room.disconnectOnlineRoomParticipantV1(
      state.room,
      PARTICIPANTS[3],
    );
    const disconnectedValidation = Protocol.validateOnlineProtocolStateV1({
      ...state,
      room: disconnectedRoom,
    });
    expect(disconnectedValidation.ok).toBe(true);
    if (!disconnectedValidation.ok) throw new Error('Expected valid disconnected terminal state');
    const rejoin = Protocol.handleOnlineClientHelloV1(disconnectedValidation.value, {
      kind: 'online-client-hello-v1',
      protocolVersion: 1,
      ...playerMessageFields(3),
      clientBuildId: 'server-o4p-02c',
    });
    expect(rejoin.response).toMatchObject({
      status: 'rejected',
      roomId: null,
      participantId: null,
      role: null,
      issues: [{ code: 'AUTHORIZATION_REJECTED' }],
    });
    expect(rejoin.state).toBe(disconnectedValidation.value);
    assertNoPrivateProtocolData(rejoin.response);
  });

  it('fails closed on hostile descriptors and state relation drift', () => {
    let getterCalled = false;
    const hostile = {
      kind: 'online-client-hello-v1',
      protocolVersion: 1,
      ...playerMessageFields(0),
      clientBuildId: 'server-o4p-02c',
    } as Record<string, unknown>;
    Object.defineProperty(hostile, 'participantCapability', {
      enumerable: true,
      get(): string {
        getterCalled = true;
        return CAPABILITIES[0];
      },
    });
    const validation = Protocol.validateOnlineClientHelloV1(hostile);
    expect(validation.ok).toBe(false);
    expect(getterCalled).toBe(false);
    if (validation.ok) throw new Error('Expected invalid hello');
    expect(Object.isFrozen(validation.issues)).toBe(true);
    expect(JSON.stringify(validation.issues)).not.toContain(CAPABILITIES[0]);

    const state = protocolState();
    const drift = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    drift.revision = 1;
    const driftValidation = Protocol.validateOnlineProtocolStateV1(drift);
    expect(driftValidation.ok).toBe(false);
    if (driftValidation.ok) throw new Error('Expected invalid protocol state');
    expect(driftValidation.issues.map(({ code }) => code)).toContain('INVALID_PROTOCOL_STATE');
    expect(state.revision).toBe(0);
  });

  it('rejects truncated and gapped accepted-receipt history', () => {
    let state = protocolState();
    for (const commandId of ['review-history-1', 'review-history-2', 'review-history-3']) {
      const transition = Protocol.handleOnlineCommandEnvelopeV1(
        state,
        commandEnvelope(state, commandId),
      );
      expect(transition.response.kind).toBe('online-command-ack-v1');
      state = transition.state;
    }
    expect(state.revision).toBe(3);
    expect(state.receipts).toHaveLength(3);

    const truncated = Protocol.validateOnlineProtocolStateV1({
      ...state,
      receipts: state.receipts.slice(0, -1),
    });
    expect(truncated.ok).toBe(false);
    if (truncated.ok) throw new Error('Expected truncated receipt history rejection');
    expect(truncated.issues).toContainEqual(
      expect.objectContaining({
        code: 'INVALID_PROTOCOL_STATE',
        path: '/receipts/1/outcome/acceptedRevision',
      }),
    );

    const gapped = Protocol.validateOnlineProtocolStateV1({
      ...state,
      receipts: [state.receipts[0], state.receipts[2]],
    });
    expect(gapped.ok).toBe(false);
    if (gapped.ok) throw new Error('Expected gapped receipt history rejection');
    expect(gapped.issues).toContainEqual(
      expect.objectContaining({
        code: 'INVALID_PROTOCOL_STATE',
        path: '/receipts/1/outcome/acceptedRevision',
      }),
    );
  });
});
