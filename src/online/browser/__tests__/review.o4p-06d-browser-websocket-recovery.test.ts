import { describe, expect, it } from 'vitest';

import * as Core from '../../../engine/core/index';
import * as Browser from '../index';

const SECRET = 'seat_capability_BROWSER_REVIEW_AAAAA';

class ReviewSocket implements Browser.OnlineBrowserSocketV1 {
  readonly sent: string[] = [];
  readonly closes: Array<Readonly<{ code?: number; reason?: string }>> = [];
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: Readonly<{ readonly data: unknown }>) => void) | null = null;
  onclose: ((event: Readonly<{ readonly code: number; readonly reason: string; readonly wasClean: boolean }>) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;

  send(data: string): void { this.sent.push(data); }
  close(code?: number, reason?: string): void { this.closes.push({ code, reason }); }
  open(): void { this.onopen?.({}); }
  message(value: unknown): void { this.onmessage?.({ data: JSON.stringify(value) }); }
  unexpectedClose(): void { this.onclose?.({ code: 1006, reason: '', wasClean: false }); }
}

function coreCommand(sequence: number): Core.CoreCommandV1 {
  return Core.createCoreCommandV1({
    schemaVersion: 1,
    sequence,
    actorPlayerId: 'P1' as Core.CorePlayerId,
    decisionMakerPlayerId: 'P1' as Core.CorePlayerId,
    decisionContext: { kind: 'decision', decisionKey: `browser-review-${String(sequence)}` },
    payload: {
      kind: 'commander-cast-record',
      physicalCardId: 'PC1' as Core.CorePhysicalCardId,
      origin: 'command-zone',
      accepted: true,
    },
  });
}

function harness() {
  const sockets: ReviewSocket[] = [];
  const scheduled: Array<Readonly<{ delayMs: number; task: () => void }>> = [];
  const client = Browser.createOnlineBrowserWebSocketClientV1({
    webSocketUrl: 'wss://example.test/api/online/rooms/room-browser-review/websocket',
    protocolVersion: 1,
    roomId: 'room-browser-review' as never,
    participantId: 'host' as never,
    participantCapability: SECRET as never,
    clientBuildId: 'browser-build-review',
    socketFactory: () => {
      const socket = new ReviewSocket();
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

describe('O4P-06D browser WebSocket, outbox, and recovery', () => {
  it('performs the ordered secret-free handshake and fences stale socket epochs', () => {
    expect(Browser.ONLINE_BROWSER_CLIENT_SCHEMA_VERSION_V1).toBe(1);
    expect(Browser.ONLINE_BROWSER_MAX_OUTBOX_ENTRIES_V1).toBe(64);
    expect(Browser.ONLINE_BROWSER_RECONNECT_DELAYS_MS_V1).toEqual([250, 500, 1000, 2000, 4000, 8000]);

    const { client, sockets, scheduled } = harness();
    expect(client.getSnapshot()).toMatchObject({ phase: 'idle', connectionEpoch: 0, projection: null });
    client.connect();
    expect(sockets).toHaveLength(1);
    expect(client.getSnapshot()).toMatchObject({ phase: 'connecting', connectionEpoch: 1 });
    expect(JSON.stringify(client.getSnapshot())).not.toContain(SECRET);

    const first = sockets[0];
    expect(first).toBeDefined();
    if (first === undefined) throw new Error('missing first socket');
    first.open();
    expect(client.getSnapshot().phase).toBe('awaiting-ready');
    expect(first.sent).toEqual([]);

    first.message({
      kind: 'online-cloudflare-websocket-ready-v1',
      schemaVersion: 1,
      roomId: 'room-browser-review',
      revision: 0,
      transport: 'hibernation',
      authenticationRequired: true,
    });
    expect(client.getSnapshot().phase).toBe('authenticating');
    expect(JSON.parse(first.sent[0] ?? '{}')).toMatchObject({
      kind: 'online-client-hello-v1',
      roomId: 'room-browser-review',
      participantId: 'host',
      participantCapability: SECRET,
    });

    first.message({
      kind: 'online-server-hello-v1',
      protocolVersion: 1,
      revision: 0,
      serverBuildId: 'server-build-review',
      status: 'accepted',
      roomId: 'room-browser-review',
      participantId: 'host',
      role: 'player',
      clientBuildIdMatch: false,
      issues: [],
    });
    expect(client.getSnapshot().phase).toBe('resyncing');
    expect(JSON.parse(first.sent[1] ?? '{}')).toMatchObject({
      kind: 'online-projection-request-v1',
      roomId: 'room-browser-review',
      participantId: 'host',
      participantCapability: SECRET,
      knownRevision: 0,
    });

    first.unexpectedClose();
    expect(client.getSnapshot()).toMatchObject({ phase: 'recovering', connectionEpoch: 1, projection: null });
    expect(scheduled.map(({ delayMs }) => delayMs)).toEqual([250]);
    scheduled[0]?.task();
    expect(sockets).toHaveLength(2);
    expect(client.getSnapshot()).toMatchObject({ phase: 'connecting', connectionEpoch: 2, projection: null });

    first.message({ kind: 'online-cloudflare-revision-v1', schemaVersion: 1, roomId: 'room-browser-review', revision: 99 });
    expect(client.getSnapshot()).toMatchObject({ phase: 'connecting', connectionEpoch: 2, knownRevision: 0, projection: null });
  });

  it('keeps a capability-free immutable outbox bounded without optimistic authority', () => {
    const { client } = harness();
    for (let index = 0; index < Browser.ONLINE_BROWSER_MAX_OUTBOX_ENTRIES_V1; index += 1) {
      expect(client.submit({
        commandId: `browser-command-${String(index)}` as never,
        baseRevision: 0,
        command: coreCommand(index + 1),
      })).toEqual({ ok: true });
    }
    const before = client.getSnapshot();
    expect(before.pendingCommands).toHaveLength(64);
    expect(before.projection).toBeNull();
    expect(Object.isFrozen(before)).toBe(true);
    expect(Object.isFrozen(before.pendingCommands)).toBe(true);
    expect(JSON.stringify(before)).not.toContain(SECRET);
    expect(JSON.stringify(before)).not.toContain('participantCapability');

    expect(client.submit({
      commandId: 'browser-command-overflow' as never,
      baseRevision: 0,
      command: coreCommand(65),
    })).toEqual({ ok: false, code: 'OUTBOX_FULL' });
    expect(client.getSnapshot()).toBe(before);
  });
});
