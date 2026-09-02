import { describe, expect, it } from 'vitest';

import * as Core from '../../../engine/core/index';
import {
  createOnlineProtocolStateV1,
  type OnlineCommandAckV1,
} from '../../protocol/index';
import {
  handleOnlineProjectedSnapshotRequestV1,
  type OnlineProjectedSnapshotAcceptedV1,
} from '../../projection/index';
import {
  activateOnlineRoomV1,
  startOnlineRoomV1,
} from '../../room/index';
import {
  CAPABILITIES,
  PARTICIPANTS,
  makeCoreRoot,
  readyAllPlayers,
} from '../../room/__tests__/testHelpers';
import * as Browser from '../index';
import type { OnlineTabletopIntentEnvelopeV1 } from '../../tabletopManual/types';
import type { OnlineVisibilityIntentEnvelopeV1 } from '../../visibilityDecisions/types';

const ROOM_ID = 'room-02b';
const PARTICIPANT_ID = PARTICIPANTS[0];
const CAPABILITY = CAPABILITIES[0];
const CLIENT_BUILD = 'client-build-06d';

class TestSocket implements Browser.OnlineBrowserSocketV1 {
  readonly sent: string[] = [];
  closeCount = 0;
  failSend = false;
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: Readonly<{ readonly data: unknown }>) => void) | null = null;
  onclose: ((event: Readonly<{ readonly code: number; readonly reason: string; readonly wasClean: boolean }>) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  send(data: string): void { if (this.failSend) throw new Error('send failure'); this.sent.push(data); }
  close(): void { this.closeCount += 1; }
  open(): void { this.onopen?.({}); }
  frame(value: unknown): void { this.onmessage?.({ data: JSON.stringify(value) }); }
  closeUnexpectedly(): void { this.onclose?.({ code: 1006, reason: '', wasClean: false }); }
}

function protocolState() {
  const coreRoot = makeCoreRoot();
  const room = activateOnlineRoomV1(
    startOnlineRoomV1(readyAllPlayers(), PARTICIPANT_ID),
    { hostParticipantId: PARTICIPANT_ID, coreRoot },
  );
  return createOnlineProtocolStateV1({
    serverBuildId: 'server-build-06d',
    room,
    coreRoot,
    observerAuthorizations: [],
  });
}

function projectionResponse(): OnlineProjectedSnapshotAcceptedV1 {
  const state = protocolState();
  const transition = handleOnlineProjectedSnapshotRequestV1(state, {
    kind: 'online-projection-request-v1',
    protocolVersion: 1,
    roomId: ROOM_ID,
    participantId: PARTICIPANT_ID,
    participantCapability: CAPABILITY,
    knownRevision: 0,
    clientBuildId: CLIENT_BUILD,
    decisionContext: null,
  });
  if (transition.response.status !== 'accepted') throw new Error('Expected an accepted projection');
  return transition.response;
}

function projectionResponseAt(revision: number): OnlineProjectedSnapshotAcceptedV1 {
  const response = projectionResponse();
  return { ...response, revision, knownRevision: revision, projection: { ...response.projection, revision } };
}

function command(sequence: number): Core.CoreCommandV1 {
  return Core.createCoreCommandV1({
    schemaVersion: 1,
    sequence,
    actorPlayerId: 'P1' as Core.CorePlayerId,
    decisionMakerPlayerId: 'P1' as Core.CorePlayerId,
    decisionContext: { kind: 'decision', decisionKey: `browser-test-${String(sequence)}` },
    payload: {
      kind: 'commander-cast-record',
      physicalCardId: 'PC1' as Core.CorePhysicalCardId,
      origin: 'command-zone',
      accepted: true,
    },
  });
}

function harness() {
  const sockets: TestSocket[] = [];
  const scheduled: Array<Readonly<{ readonly delayMs: number; readonly task: () => void }>> = [];
  const client = Browser.createOnlineBrowserWebSocketClientV1({
    webSocketUrl: `wss://example.test/api/online/rooms/${ROOM_ID}/websocket`,
    protocolVersion: 1,
    roomId: ROOM_ID as never,
    participantId: PARTICIPANT_ID as never,
    participantCapability: CAPABILITY as never,
    clientBuildId: CLIENT_BUILD,
    socketFactory: () => {
      const socket = new TestSocket();
      sockets.push(socket);
      return socket;
    },
    schedule: (delayMs, task) => {
      scheduled.push({ delayMs, task });
      return scheduled.length;
    },
    cancelSchedule: () => undefined,
  });
  return { client, sockets, scheduled };
}

function openClient(client: Browser.OnlineBrowserWebSocketClientV1, socket: TestSocket, reason?: 'synchronized' | 'snapshot-required' | 'rejoined'): void {
  socket.open();
  socket.frame({
    kind: 'online-cloudflare-websocket-ready-v1',
    schemaVersion: 1,
    roomId: ROOM_ID,
    revision: 0,
    transport: 'hibernation',
    authenticationRequired: true,
  });
  socket.frame({
    kind: 'online-server-hello-v1',
    protocolVersion: 1,
    revision: 0,
    serverBuildId: 'server-build-06d',
    status: 'accepted',
    roomId: ROOM_ID,
    participantId: PARTICIPANT_ID,
    role: 'player',
    clientBuildIdMatch: true,
    issues: [],
  });
  const response = projectionResponse();
  socket.frame(reason === undefined ? response : { ...response, reason });
  expect(client.getSnapshot().phase).toBe('open');
}

describe('O4P-06D ordinary browser client coverage', () => {
  it('sends the server-owned shared undo intent without a Core snapshot', () => {
    const { client, sockets } = harness();
    client.connect();
    const socket = sockets[0];
    if (socket === undefined) throw new Error('Missing socket');
    openClient(client, socket);
    expect(client.submitSharedUndo({
      kind: 'online-shared-undo-intent-v1', schemaVersion: 1,
      commandId: 'browser-shared-undo', baseRevision: 0,
    })).toEqual({ ok: true });
    const frame = JSON.parse(socket.sent.at(-1) ?? '{}') as Record<string, unknown>;
    expect(Object.keys(frame).sort()).toEqual([
      'baseRevision', 'commandId', 'kind', 'participantCapability',
      'participantId', 'protocolVersion', 'roomId', 'schemaVersion',
    ]);
    expect(frame).toMatchObject({ kind: 'online-shared-undo-intent-v1', schemaVersion: 1, protocolVersion: 1, roomId: ROOM_ID, participantId: PARTICIPANT_ID, commandId: 'browser-shared-undo', baseRevision: 0 });
    expect(JSON.stringify(frame)).not.toContain('coreRoot');
    socket.frame({ kind: 'online-command-ack-v1', protocolVersion: 1, roomId: ROOM_ID, participantId: PARTICIPANT_ID, commandId: 'browser-shared-undo', baseRevision: 0, acceptedRevision: 1, currentRevision: 1, status: 'accepted', duplicate: false });
    expect(client.getSnapshot().pendingCommands).toEqual([]);
  });

  it('queues manual combat damage without exposing a physical card identity', () => {
    const { client, sockets } = harness();
    client.connect();
    const socket = sockets[0];
    if (socket === undefined) throw new Error('Missing socket');
    openClient(client, socket);
    expect(client.submitManualCombatDamage({ kind: 'online-manual-combat-damage-intent-v1', schemaVersion: 1, commandId: 'browser-combat-damage', baseRevision: 0, defendingPlayerId: 'P3', damage: 3, commanderObjectId: 'PC1:0' })).toEqual({ ok: true });
    const frame = JSON.parse(socket.sent.at(-1) ?? '{}') as Record<string, unknown>;
    expect(frame).toMatchObject({ kind: 'online-manual-combat-damage-intent-v1', schemaVersion: 1, defendingPlayerId: 'P3', damage: 3, commanderObjectId: 'PC1:0' });
    expect(frame.physicalCardId).toBeUndefined();
    socket.frame({ kind: 'online-command-ack-v1', protocolVersion: 1, roomId: ROOM_ID, participantId: PARTICIPANT_ID, commandId: 'browser-combat-damage', baseRevision: 0, acceptedRevision: 1, currentRevision: 1, status: 'accepted', duplicate: false });
    expect(client.getSnapshot().pendingCommands).toEqual([]);
  });

  it('queues a high-level tabletop intent on the same authenticated socket and replays it without Core data', () => {
    const { client, sockets } = harness();
    const intent: OnlineTabletopIntentEnvelopeV1 = {
      kind: 'online-tabletop-intent-envelope-v1', schemaVersion: 1,
      commandId: 'browser-tabletop-shuffle', baseRevision: 0, mode: 'structured',
      primitive: { kind: 'shuffle' },
    };
    expect(client.submitTabletop(intent)).toEqual({ ok: true });
    client.connect();
    const socket = sockets[0];
    if (socket === undefined) throw new Error('Missing socket');
    openClient(client, socket);
    const frame = JSON.parse(socket.sent.at(-1) ?? '{}') as Record<string, unknown>;
    expect(frame).toMatchObject({ kind: 'online-tabletop-intent-envelope-v1', protocolVersion: 1, commandId: intent.commandId, baseRevision: 0, mode: 'structured', primitive: { kind: 'shuffle' } });
    expect(frame.command).toBeUndefined();
    expect(frame.participantCapability).toBe(CAPABILITY);
    expect(JSON.stringify(frame)).not.toContain('order');
    socket.frame({ kind: 'online-command-ack-v1', protocolVersion: 1, roomId: ROOM_ID, participantId: PARTICIPANT_ID, commandId: intent.commandId, baseRevision: 0, acceptedRevision: 1, currentRevision: 1, status: 'accepted', duplicate: false });
    expect(client.getSnapshot().pendingCommands).toEqual([]);
    expect(client.getSnapshot().lastCommandSettlement).toEqual({
      commandId: intent.commandId,
      baseRevision: 0,
      currentRevision: 1,
      acceptedRevision: 1,
      commandKind: 'tabletop',
      operation: 'shuffle',
      outcome: 'accepted',
      issueCode: null,
    });
    expect(Object.isFrozen(client.getSnapshot().lastCommandSettlement)).toBe(true);
    socket.frame(projectionResponseAt(1));
    expect(client.getSnapshot().phase).toBe('open');
    const normal = { commandId: 'browser-after-tabletop' as never, baseRevision: 1, command: command(2) };
    expect(client.submit(normal)).toEqual({ ok: true });
    expect(JSON.parse(socket.sent.at(-1) ?? '{}')).toMatchObject({ kind: 'online-command-envelope-v1', commandId: normal.commandId, baseRevision: 1 });
  });

  it('sends an exact ten-field Shuffle frame after opening and authenticating', () => {
    const { client, sockets } = harness();
    client.connect();
    const socket = sockets[0];
    if (socket === undefined) throw new Error('Missing socket');
    openClient(client, socket);
    const intent: OnlineTabletopIntentEnvelopeV1 = {
      kind: 'online-tabletop-intent-envelope-v1', schemaVersion: 1,
      commandId: 'browser-live-shuffle', baseRevision: 0, mode: 'freeform',
      primitive: { kind: 'shuffle' },
    };
    expect(client.submitTabletop(intent)).toEqual({ ok: true });
    const frame = JSON.parse(socket.sent.at(-1) ?? '{}') as Record<string, unknown>;
    expect(Object.keys(frame).sort()).toEqual([
      'baseRevision', 'commandId', 'kind', 'mode', 'participantCapability',
      'participantId', 'primitive', 'protocolVersion', 'roomId', 'schemaVersion',
    ]);
    expect(frame).toMatchObject({
      kind: 'online-tabletop-intent-envelope-v1',
      schemaVersion: 1,
      protocolVersion: 1,
      roomId: ROOM_ID,
      participantId: PARTICIPANT_ID,
      commandId: intent.commandId,
      baseRevision: 0,
      mode: 'freeform',
      primitive: { kind: 'shuffle' },
    });
    expect(frame.command).toBeUndefined();
  });

  it('replays an unacknowledged tabletop intent byte-for-byte after reconnect', () => {
    const { client, sockets, scheduled } = harness();
    const intent: OnlineTabletopIntentEnvelopeV1 = {
      kind: 'online-tabletop-intent-envelope-v1', schemaVersion: 1,
      commandId: 'browser-tabletop-reconnect', baseRevision: 0, mode: 'freeform', primitive: { kind: 'shuffle' },
    };
    expect(client.submitTabletop(intent)).toEqual({ ok: true });
    client.connect();
    const first = sockets[0];
    if (first === undefined) throw new Error('Missing first socket');
    openClient(client, first);
    const firstFrame = first.sent.at(-1);
    if (firstFrame === undefined) throw new Error('Missing first tabletop frame');
    first.closeUnexpectedly();
    scheduled[0]?.task();
    const second = sockets[1];
    if (second === undefined) throw new Error('Missing reconnect socket');
    openClient(client, second);
    expect(second.sent.at(-1)).toBe(firstFrame);
    const reconnectFrame: unknown = JSON.parse(second.sent.at(-1) ?? '{}');
    expect(reconnectFrame !== null && typeof reconnectFrame === 'object' && !Array.isArray(reconnectFrame) && !Object.prototype.hasOwnProperty.call(reconnectFrame, 'command')).toBe(true);
  });

  it('replays an unacknowledged visibility intent byte-for-byte without optimistic identity', () => {
    const { client, sockets, scheduled } = harness();
    const intent: OnlineVisibilityIntentEnvelopeV1 = {
      kind: 'online-visibility-intent-v1', schemaVersion: 1,
      commandId: 'browser-visibility-reconnect', baseRevision: 0,
      look: {
        subject: { kind: 'top-of-library', count: 1 },
        viewerPlayerIds: ['P1'], duration: { kind: 'next-command' },
      },
    };
    expect(client.submitVisibility(intent)).toEqual({ ok: true });
    expect(client.getSnapshot().projection).toBeNull();
    client.connect();
    const first = sockets[0];
    if (first === undefined) throw new Error('Missing first socket');
    openClient(client, first);
    const firstFrame = first.sent.at(-1);
    if (firstFrame === undefined) throw new Error('Missing first visibility frame');
    expect(JSON.parse(firstFrame)).toMatchObject({ kind: intent.kind, look: intent.look });
    first.closeUnexpectedly();
    scheduled[0]?.task();
    const second = sockets[1];
    if (second === undefined) throw new Error('Missing reconnect socket');
    openClient(client, second);
    expect(second.sent.at(-1)).toBe(firstFrame);
    expect(client.getSnapshot().projection).not.toBeNull();
  });

  it('uses the shipped projection operation and never optimistically changes authority', () => {
    const { client, sockets } = harness();
    const intent = { commandId: 'browser-test-command' as never, baseRevision: 0, command: command(1) };
    expect(client.submit(intent)).toEqual({ ok: true });
    client.connect();
    const socket = sockets[0];
    if (socket === undefined) throw new Error('Missing socket');
    openClient(client, socket);
    const projection = client.getSnapshot().projection;
    expect(projection).not.toBeNull();
    expect(JSON.parse(socket.sent.at(-1) ?? '{}')).toMatchObject({ kind: 'online-command-envelope-v1', commandId: 'browser-test-command' });
    const ack: OnlineCommandAckV1 = {
      kind: 'online-command-ack-v1',
      protocolVersion: 1,
      roomId: ROOM_ID as never,
      participantId: PARTICIPANT_ID as never,
      commandId: 'browser-test-command' as never,
      baseRevision: 0,
      acceptedRevision: 1,
      currentRevision: 1,
      status: 'accepted',
      duplicate: false,
    };
    socket.frame(ack);
    expect(client.getSnapshot().pendingCommands).toEqual([]);
    expect(client.getSnapshot().projection).toBe(projection);
    socket.frame(projectionResponseAt(1));
    expect(client.getSnapshot().phase).toBe('open');
    expect(client.submit(intent)).toEqual({ ok: true });
    expect(client.submit({ ...intent, command: command(99) })).toEqual({ ok: false, code: 'COMMAND_ID_REUSE' });
    socket.frame({ ...ack, acceptedRevision: 1, currentRevision: 1, duplicate: true });
    expect(client.submit({ commandId: 'out-of-order-command' as never, baseRevision: 1, command: command(2) })).toEqual({ ok: true });
    socket.frame({ ...ack, commandId: 'out-of-order-command', baseRevision: 1, acceptedRevision: 1, currentRevision: 0 });
    expect(client.getSnapshot().pendingCommands).toHaveLength(1);
    socket.frame({ ...ack, commandId: 'out-of-order-command', baseRevision: 1, acceptedRevision: 1, currentRevision: 1, duplicate: true });
    expect(client.getSnapshot().pendingCommands).toEqual([]);
  });

  it('resynchronizes after Worker ACK-then-revision ordering without mutating projection optimistically', () => {
    const { client, sockets } = harness();
    expect(client.submit({ commandId: 'ordered-command' as never, baseRevision: 0, command: command(1) })).toEqual({ ok: true });
    client.connect();
    const socket = sockets[0];
    if (socket === undefined) throw new Error('Missing socket');
    openClient(client, socket);
    const before = client.getSnapshot().projection;
    const ack: OnlineCommandAckV1 = {
      kind: 'online-command-ack-v1', protocolVersion: 1, roomId: ROOM_ID as never,
      participantId: PARTICIPANT_ID as never, commandId: 'ordered-command' as never,
      baseRevision: 0, acceptedRevision: 1, currentRevision: 1, status: 'accepted', duplicate: false,
    };
    socket.frame(ack);
    expect(client.getSnapshot().projection).toBe(before);
    const frameCountAfterAck = socket.sent.length;
    expect(client.getSnapshot().phase).toBe('resyncing');
    expect(JSON.parse(socket.sent.at(-1) ?? '{}')).toMatchObject({ kind: 'online-projection-request-v1', knownRevision: 1 });
    socket.frame({ kind: 'online-cloudflare-revision-v1', schemaVersion: 1, roomId: ROOM_ID, revision: 1 });
    expect(socket.sent).toHaveLength(frameCountAfterAck);
    socket.frame(projectionResponseAt(1));
    expect(client.getSnapshot().phase).toBe('open');
    expect(client.getSnapshot().projection?.revision).toBe(1);
  });

  it('settles a pending command when the revision notice arrives before its ACK', () => {
    const { client, sockets } = harness();
    client.connect();
    const socket = sockets[0];
    if (socket === undefined) throw new Error('Missing socket');
    openClient(client, socket);
    expect(client.submit({ commandId: 'revision-first-command' as never, baseRevision: 0, command: command(1) })).toEqual({ ok: true });

    socket.frame({ kind: 'online-cloudflare-revision-v1', schemaVersion: 1, roomId: ROOM_ID, revision: 1 });
    expect(client.getSnapshot()).toMatchObject({ phase: 'resyncing', pendingCommands: [{ commandId: 'revision-first-command', baseRevision: 0 }] });
    socket.frame({
      kind: 'online-command-ack-v1', protocolVersion: 1, roomId: ROOM_ID,
      participantId: PARTICIPANT_ID, commandId: 'revision-first-command',
      baseRevision: 0, acceptedRevision: 1, currentRevision: 1, status: 'accepted', duplicate: false,
    });
    expect(client.getSnapshot()).toMatchObject({ phase: 'resyncing', pendingCommands: [] });
    socket.frame(projectionResponseAt(1));
    expect(client.getSnapshot()).toMatchObject({ phase: 'open', knownRevision: 1, pendingCommands: [] });
  });

  it('follows a newer revision while a snapshot is in flight with one storm-free follow-up', () => {
    const { client, sockets } = harness();
    client.connect();
    const socket = sockets[0];
    if (socket === undefined) throw new Error('Missing socket');
    openClient(client, socket);
    const initialSent = socket.sent.length;
    socket.frame({ kind: 'online-cloudflare-revision-v1', schemaVersion: 1, roomId: ROOM_ID, revision: 1 });
    expect(socket.sent).toHaveLength(initialSent + 1);
    socket.frame({ kind: 'online-cloudflare-revision-v1', schemaVersion: 1, roomId: ROOM_ID, revision: 2 });
    socket.frame({ kind: 'online-cloudflare-revision-v1', schemaVersion: 1, roomId: ROOM_ID, revision: 2 });
    socket.frame(projectionResponseAt(1));
    expect(socket.sent).toHaveLength(initialSent + 2);
    expect(JSON.parse(socket.sent.at(-1) ?? '{}')).toMatchObject({ kind: 'online-projection-request-v1', knownRevision: 2 });
    socket.frame(projectionResponseAt(1));
    expect(socket.sent).toHaveLength(initialSent + 2);
    socket.frame(projectionResponseAt(2));
    expect(client.getSnapshot()).toMatchObject({ phase: 'open', knownRevision: 2 });
  });

  it('replays a lost ACK byte-for-byte and fences stale epochs and duplicate responses', () => {
    const { client, sockets, scheduled } = harness();
    expect(client.submit({ commandId: 'lost-ack-command' as never, baseRevision: 0, command: command(1) })).toEqual({ ok: true });
    client.connect();
    const first = sockets[0];
    if (first === undefined) throw new Error('Missing first socket');
    openClient(client, first);
    const firstCommand = first.sent.at(-1);
    if (firstCommand === undefined) throw new Error('Missing first command');
    first.closeUnexpectedly();
    expect(scheduled.map(({ delayMs }) => delayMs)).toEqual([250]);
    scheduled[0]?.task();
    const second = sockets[1];
    if (second === undefined) throw new Error('Missing second socket');
    first.frame({ kind: 'online-command-ack-v1' });
    expect(client.getSnapshot().pendingCommands).toHaveLength(1);
    openClient(client, second);
    expect(second.sent.at(-1)).toBe(firstCommand);
    const ack: OnlineCommandAckV1 = {
      kind: 'online-command-ack-v1', protocolVersion: 1, roomId: ROOM_ID as never,
      participantId: PARTICIPANT_ID as never, commandId: 'lost-ack-command' as never,
      baseRevision: 0, acceptedRevision: 1, currentRevision: 1, status: 'accepted', duplicate: true,
    };
    second.frame(ack);
    const settled = client.getSnapshot();
    expect(settled.pendingCommands).toEqual([]);
    second.frame(ack);
    expect(client.getSnapshot()).toBe(settled);
  });

  it('surfaces reconnect success only from the validated server rejoined reason', () => {
    const { client, sockets, scheduled } = harness();
    client.connect();
    const first = sockets[0];
    if (first === undefined) throw new Error('Missing first socket');
    openClient(client, first, 'synchronized');
    expect(client.getSnapshot().recoveryOutcome).toBeNull();
    const beforePresenceNotice = first.sent.length;
    first.frame({ kind: 'online-cloudflare-revision-v1', schemaVersion: 1, roomId: ROOM_ID, revision: 0 });
    expect(first.sent).toHaveLength(beforePresenceNotice + 1);
    expect(JSON.parse(first.sent.at(-1) ?? '{}')).toMatchObject({ kind: 'online-projection-request-v1', knownRevision: 0 });
    first.frame(projectionResponse());
    expect(client.getSnapshot()).toMatchObject({ phase: 'open', recoveryOutcome: null });

    first.closeUnexpectedly();
    expect(client.getSnapshot()).toMatchObject({ phase: 'recovering', recoveryOutcome: null });
    scheduled[0]?.task();
    const second = sockets[1];
    if (second === undefined) throw new Error('Missing recovery socket');
    openClient(client, second, 'rejoined');
    expect(client.getSnapshot()).toMatchObject({ phase: 'open', recoveryOutcome: 'rejoined' });

    second.closeUnexpectedly();
    expect(client.getSnapshot()).toMatchObject({ phase: 'recovering', recoveryOutcome: null });
    client.disconnect();
    expect(client.getSnapshot()).toMatchObject({ phase: 'closed', recoveryOutcome: null });
  });

  it('settles a resync-required reject and emits one projection request', () => {
    const { client, sockets } = harness();
    const rejectIntent = { commandId: 'reject-command' as never, baseRevision: 0, command: command(1) };
    expect(client.submit(rejectIntent)).toEqual({ ok: true });
    client.connect();
    const socket = sockets[0];
    if (socket === undefined) throw new Error('Missing socket');
    openClient(client, socket);
    const beforeReject = socket.sent.length;
    socket.frame({
      kind: 'online-command-reject-v1', protocolVersion: 1, roomId: ROOM_ID,
      participantId: PARTICIPANT_ID, commandId: 'reject-command', baseRevision: 0,
      currentRevision: 1, duplicate: false, resyncRequired: true,
      issues: [{ code: 'STALE_REVISION', path: '/baseRevision', message: 'stale' }],
    });
    expect(client.getSnapshot()).toMatchObject({ phase: 'resyncing', issueCode: 'STALE_REVISION', pendingCommands: [] });
    expect(client.getSnapshot().lastCommandSettlement).toMatchObject({
      commandId: 'reject-command',
      outcome: 'rejected',
      acceptedRevision: null,
      issueCode: 'STALE_REVISION',
    });
    expect(socket.sent.length).toBe(beforeReject + 1);
    const refreshed = projectionResponse();
    socket.frame({ ...refreshed, revision: 1, knownRevision: 1, projection: { ...refreshed.projection, revision: 1 } });
    expect(client.getSnapshot().phase).toBe('open');
    expect(client.submit(rejectIntent)).toEqual({ ok: true });
    expect(client.submit({ ...rejectIntent, command: command(77) })).toEqual({ ok: false, code: 'COMMAND_ID_REUSE' });
  });

  it('fails closed on revision regressions and accepts nondecreasing handshake revisions', () => {
    const initial = harness();
    initial.client.connect();
    const initialSocket = initial.sockets[0];
    if (initialSocket === undefined) throw new Error('Missing initial socket');
    initialSocket.open();
    initialSocket.frame({ kind: 'online-cloudflare-websocket-ready-v1', schemaVersion: 1, roomId: ROOM_ID, revision: 5, transport: 'hibernation', authenticationRequired: true });
    initialSocket.frame({ kind: 'online-server-hello-v1', protocolVersion: 1, revision: 0, serverBuildId: 'server-build-06d', status: 'accepted', roomId: ROOM_ID, participantId: PARTICIPANT_ID, role: 'player', clientBuildIdMatch: true, issues: [] });
    expect(initial.client.getSnapshot()).toMatchObject({ phase: 'failed', issueCode: 'INVALID_FRAME' });

    const reconnect = harness();
    reconnect.client.connect();
    const first = reconnect.sockets[0];
    if (first === undefined) throw new Error('Missing reconnect socket');
    openClient(reconnect.client, first);
    first.frame({ kind: 'online-cloudflare-revision-v1', schemaVersion: 1, roomId: ROOM_ID, revision: 5 });
    first.frame(projectionResponseAt(5));
    first.closeUnexpectedly();
    reconnect.scheduled[0]?.task();
    const second = reconnect.sockets[1];
    if (second === undefined) throw new Error('Missing second reconnect socket');
    second.open();
    second.frame({ kind: 'online-cloudflare-websocket-ready-v1', schemaVersion: 1, roomId: ROOM_ID, revision: 0, transport: 'hibernation', authenticationRequired: true });
    expect(reconnect.client.getSnapshot()).toMatchObject({ phase: 'failed', issueCode: 'INVALID_FRAME' });

    const increasing = harness();
    increasing.client.connect();
    const increasingSocket = increasing.sockets[0];
    if (increasingSocket === undefined) throw new Error('Missing increasing socket');
    increasingSocket.open();
    increasingSocket.frame({ kind: 'online-cloudflare-websocket-ready-v1', schemaVersion: 1, roomId: ROOM_ID, revision: 5, transport: 'hibernation', authenticationRequired: true });
    increasingSocket.frame({ kind: 'online-server-hello-v1', protocolVersion: 1, revision: 6, serverBuildId: 'server-build-06d', status: 'accepted', roomId: ROOM_ID, participantId: PARTICIPANT_ID, role: 'player', clientBuildIdMatch: true, issues: [] });
    increasingSocket.frame(projectionResponseAt(6));
    expect(increasing.client.getSnapshot()).toMatchObject({ phase: 'open', knownRevision: 6 });
  });

  it('follows fixed recovery delays, exhaustion, cancellation, and hostile boundaries', () => {
    const first = harness();
    first.client.connect();
    const firstSocket = first.sockets[0];
    if (firstSocket === undefined) throw new Error('Missing socket');
    firstSocket.closeUnexpectedly();
    for (let index = 0; index < Browser.ONLINE_BROWSER_RECONNECT_DELAYS_MS_V1.length; index += 1) {
      first.scheduled[index]?.task();
      const socket = first.sockets[index + 1];
      if (socket === undefined) throw new Error('Missing recovery socket');
      socket.closeUnexpectedly();
    }
    expect(first.scheduled.map(({ delayMs }) => delayMs)).toEqual([...Browser.ONLINE_BROWSER_RECONNECT_DELAYS_MS_V1]);
    expect(first.client.getSnapshot()).toMatchObject({ phase: 'failed', issueCode: 'RECONNECT_EXHAUSTED' });

    const cancelled = harness();
    cancelled.client.connect();
    cancelled.sockets[0]?.closeUnexpectedly();
    cancelled.client.disconnect();
    cancelled.scheduled[0]?.task();
    expect(cancelled.sockets).toHaveLength(1);
    expect(cancelled.client.getSnapshot().phase).toBe('closed');

    const invalid = Browser.createOnlineBrowserWebSocketClientV1({
      webSocketUrl: 'https://example.test/api/online/rooms/room-02b/websocket',
      protocolVersion: 1,
      roomId: ROOM_ID as never,
      participantId: PARTICIPANT_ID as never,
      participantCapability: CAPABILITY as never,
      clientBuildId: CLIENT_BUILD,
    });
    expect(invalid.getSnapshot()).toMatchObject({ phase: 'failed', issueCode: 'INVALID_URL' });
    const snapshot = invalid.getSnapshot();
    expect(JSON.stringify(snapshot)).not.toContain(CAPABILITY);
    const leakingRoom = `room-${CAPABILITY}`;
    const leaking = Browser.createOnlineBrowserWebSocketClientV1({
      webSocketUrl: `wss://example.test/api/online/rooms/${leakingRoom}/websocket`,
      protocolVersion: 1,
      roomId: leakingRoom as never,
      participantId: PARTICIPANT_ID as never,
      participantCapability: CAPABILITY as never,
      clientBuildId: CLIENT_BUILD,
    });
    let observed: Browser.OnlineBrowserStateV1 | null = null;
    leaking.subscribe((value) => { observed = value; });
    expect(JSON.stringify(leaking.getSnapshot())).not.toContain(CAPABILITY);
    leaking.disconnect();
    expect(observed).not.toBeNull();
    expect(JSON.stringify(observed)).not.toContain(CAPABILITY);
    const fragment = CAPABILITY.slice(0, 8);
    const fragmentLeak = Browser.createOnlineBrowserWebSocketClientV1({
      webSocketUrl: `wss://example.test/api/online/rooms/${ROOM_ID}/websocket?cap=${CAPABILITY}`,
      protocolVersion: 1,
      roomId: ROOM_ID as never,
      participantId: `player-${fragment}` as never,
      participantCapability: CAPABILITY as never,
      clientBuildId: `build-${fragment}`,
    });
    expect(JSON.stringify(fragmentLeak.getSnapshot())).not.toContain(CAPABILITY);
    expect(() => first.sockets[0]?.onmessage?.({
      get data(): unknown { throw new Error('hostile accessor'); },
    })).not.toThrow();

    const failedSend = harness();
    failedSend.client.connect();
    const sendSocket = failedSend.sockets[0];
    if (sendSocket === undefined) throw new Error('Missing send socket');
    openClient(failedSend.client, sendSocket);
    sendSocket.failSend = true;
    expect(failedSend.client.submit({ commandId: 'send-failure' as never, baseRevision: 0, command: command(1) })).toEqual({ ok: true });
    expect(sendSocket.closeCount).toBe(1);
    expect(failedSend.client.getSnapshot().phase).toBe('recovering');

    const serverError = harness();
    serverError.client.connect();
    const serverErrorSocket = serverError.sockets[0];
    if (serverErrorSocket === undefined) throw new Error('Missing server error socket');
    openClient(serverError.client, serverErrorSocket);
    serverErrorSocket.frame({ kind: 'online-cloudflare-websocket-error-v1', schemaVersion: 1, code: 'INTERNAL_ERROR' });
    expect(serverError.client.getSnapshot()).toMatchObject({ phase: 'failed', issueCode: 'SERVER_INTERNAL_ERROR' });
  });

  it('enforces command ID collision and the immutable 64-entry bound', () => {
    const { client } = harness();
    const first = { commandId: 'collision-command' as never, baseRevision: 0, command: command(1) };
    expect(client.submit(first)).toEqual({ ok: true });
    expect(client.submit(first)).toEqual({ ok: true });
    expect(client.submit({ ...first, command: command(2) })).toEqual({ ok: false, code: 'COMMAND_ID_REUSE' });
    for (let index = 1; index < Browser.ONLINE_BROWSER_MAX_OUTBOX_ENTRIES_V1; index += 1) {
      expect(client.submit({ commandId: `bound-${String(index)}` as never, baseRevision: 0, command: command(index + 1) })).toEqual({ ok: true });
    }
    const before = client.getSnapshot();
    expect(client.submit({ commandId: 'overflow' as never, baseRevision: 0, command: command(100) })).toEqual({ ok: false, code: 'OUTBOX_FULL' });
    expect(client.getSnapshot()).toBe(before);
    expect(Object.isFrozen(before)).toBe(true);
    expect(Object.isFrozen(before.pendingCommands)).toBe(true);
    expect(JSON.stringify(before)).not.toContain(CAPABILITY);

    let toJsonInvoked = false;
    const hostileCommand = { ...command(101) } as Record<string, unknown>;
    Object.defineProperty(hostileCommand, 'toJSON', {
      enumerable: true,
      value: () => { toJsonInvoked = true; return command(101); },
    });
    expect(client.submit({ commandId: 'hostile-to-json' as never, baseRevision: 0, command: hostileCommand as never })).toEqual({ ok: false, code: 'INVALID_COMMAND' });
    expect(toJsonInvoked).toBe(false);

    let accessorInvoked = false;
    const accessorCommand = { ...command(102) } as Record<string, unknown>;
    Object.defineProperty(accessorCommand, 'payload', {
      enumerable: true,
      get: () => { accessorInvoked = true; return command(102).payload; },
    });
    expect(client.submit({ commandId: 'hostile-accessor' as never, baseRevision: 0, command: accessorCommand as never })).toEqual({ ok: false, code: 'INVALID_COMMAND' });
    expect(accessorInvoked).toBe(false);

    const oversizedCommand = { ...command(103), decisionContext: { kind: 'decision', decisionKey: 'x'.repeat(70_000) } } as never;
    expect(client.submit({ commandId: 'hostile-oversized' as never, baseRevision: 0, command: oversizedCommand })).toEqual({ ok: false, code: 'INVALID_COMMAND' });
  });
});
