import { describe, expect, it } from 'vitest';
import { runEvidencePhase, type EvidenceDeps, type EvidenceSocket } from '../../../../scripts/online/o4p-03d-evidence';

class FakeSocket implements EvidenceSocket {
  private readonly listeners = new Map<string, Array<(event: { readonly data: unknown }) => void>>();
  private readonly revision: { value: number };
  private readonly wrongAudience: boolean;
  private readonly leakCapability: boolean;
  private readonly leakFragment: boolean;
  private readonly unsolicitedLeak: boolean;
  private readonly finalUnsolicitedLeak: boolean;
  constructor(revision: { value: number }, options: { readonly wrongAudience?: boolean; readonly leakCapability?: boolean; readonly leakFragment?: boolean; readonly unsolicitedLeak?: boolean; readonly finalUnsolicitedLeak?: boolean } = {}) {
    this.revision = revision;
    this.wrongAudience = options.wrongAudience === true;
    this.leakCapability = options.leakCapability === true;
    this.leakFragment = options.leakFragment === true;
    this.unsolicitedLeak = options.unsolicitedLeak === true;
    this.finalUnsolicitedLeak = options.finalUnsolicitedLeak === true;
  }
  closed = false;
  readonly sent: string[] = [];
  addEventListener(type: string, listener: (event: { readonly data: unknown }) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  send(data: string): void {
    this.sent.push(data);
    const frame = JSON.parse(data) as { readonly kind?: string; readonly roomId?: string; readonly participantId?: string; readonly participantCapability?: string; readonly baseRevision?: number };
    const participantId = this.wrongAudience ? 'wrong-participant' : frame.participantId;
    const corePlayerId = frame.participantId === 'host' ? 'P1' : frame.participantId === 'player-2' ? 'P2' : frame.participantId === 'player-3' ? 'P3' : 'P4';
    const message = frame.kind === 'online-client-hello-v1'
      ? { kind: 'online-server-hello-v1', status: 'accepted', roomId: frame.roomId, participantId, role: 'player', revision: this.revision.value }
      : frame.kind === 'online-projection-request-v1'
        ? {
            kind: 'online-projected-snapshot-v1', status: 'accepted', roomId: frame.roomId, participantId, role: 'player', revision: this.revision.value,
            projection: { kind: 'online-participant-projection-v1', roomId: frame.roomId, participantId, role: 'player', corePlayerId, revision: this.revision.value },
            ...(this.leakCapability ? { participantCapability: frame.participantCapability } : {}),
            ...(this.leakFragment ? { leakedHint: frame.participantCapability?.slice(8, 24) } : {}),
          }
        : { kind: 'online-command-ack-v1', duplicate: false, acceptedRevision: this.revision.value + 1 };
    if (frame.kind === 'online-command-envelope-v1') this.revision.value += 1;
    for (const listener of this.listeners.get('message') ?? []) queueMicrotask(() => listener({ data: JSON.stringify(message) }));
    if ((this.unsolicitedLeak || (this.finalUnsolicitedLeak && frame.baseRevision === 95)) && frame.kind === 'online-command-envelope-v1') {
      for (const listener of this.listeners.get('message') ?? []) queueMicrotask(() => listener({ data: JSON.stringify({ kind: 'online-cloudflare-revision-v1', leakedHint: frame.participantCapability?.slice(-16) }) }));
    }
  }
  close(): void { this.closed = true; }
}

function deps(options: { readonly mismatchAt?: number; readonly wrongAudience?: boolean; readonly leakCapability?: boolean; readonly leakFragment?: boolean; readonly unsolicitedLeak?: boolean; readonly finalUnsolicitedLeak?: boolean; readonly invalidPlatform?: boolean; readonly hangFetch?: boolean; readonly hangBarrier?: boolean } = {}): EvidenceDeps & { readonly sockets: FakeSocket[]; readonly sleeps: number[]; readonly barriers: number; readonly observations: number } {
  const sockets: FakeSocket[] = [];
  const revision = { value: 0 };
  const sleeps: number[] = [];
  let barriers = 0;
  let observations = 0;
  let commandCount = 0;
  let initializedRoomId = '';
  return {
    messageTimeoutMs: 50,
    requestTimeoutMs: 50,
    operatorTimeoutMs: 50,
    sockets,
    sleeps,
    get barriers() { return barriers; },
    get observations() { return observations; },
    fetch: (_url, init) => {
      if (options.hangFetch) return new Promise(() => undefined);
      if (init?.method === 'PUT') {
        if (typeof init.body !== 'string') throw new Error('missing initialization body');
        const body = JSON.parse(init.body) as { readonly state: { readonly room: { readonly roomId: string } } };
        initializedRoomId = body.state.room.roomId;
        return Promise.resolve({ status: 200, text: () => Promise.resolve(JSON.stringify({ roomId: initializedRoomId, revision: 0, acceptedCommandCount: 0 })) });
      }
      return Promise.resolve({ status: 200, text: () => Promise.resolve(JSON.stringify({ revision: 96, acceptedCommandCount: 96 })) });
    },
    openSocket: () => {
      const socket = new FakeSocket(revision, options);
      const originalSend = socket.send.bind(socket);
      socket.send = (data: string): void => {
        const frame = JSON.parse(data) as { readonly kind?: string };
        if (frame.kind === 'online-command-envelope-v1') {
          commandCount += 1;
          if (options.mismatchAt === commandCount) {
            socket.send = (): void => undefined;
            return;
          }
        }
        originalSend(data);
      };
      sockets.push(socket);
      return Promise.resolve(socket);
    },
    sleep: (milliseconds) => { sleeps.push(milliseconds); return Promise.resolve(); },
    barrier: () => {
      barriers += 1;
      return options.hangBarrier ? new Promise(() => undefined) : Promise.resolve();
    },
    observePlatformEvidence: (summary) => {
      observations += 1;
      const phase = summary.phase === 'hibernation' ? 'hibernation' : 'deployment-reconnect';
      return Promise.resolve({
        kind: 'o4p-03d-platform-evidence-v1',
        phase,
        roomCorrelationId: initializedRoomId,
        checkpointRevision: options.invalidPlatform ? 63 : 64,
        currentRevision: 96,
        replaySuffixLength: 32,
        preDeployVersionIdentifier: '11111111-1111-4111-8111-111111111111',
        postDeployVersionIdentifier: phase === 'hibernation' ? '11111111-1111-4111-8111-111111111111' : '22222222-2222-4222-8222-222222222222',
        preDeployRuntimeStartCount: 2,
        postDeployRuntimeStartCount: phase === 'hibernation' ? 0 : 1,
        recoveryFactCount: 1,
        tailEventCount: 120,
        tailErrorCount: 0,
        tailExceptionCount: 0,
        tailParseFailureCount: 0,
        tailFactViolationCount: 0,
      });
    },
  };
}

describe('O4P-03D evidence harness', () => {
  it('runs four-seat init/load with injectable network and no secret-bearing summary', async () => {
    const injected = deps();
    const summary = await runEvidencePhase('init-load', 'http://localhost:8787', injected);
    expect(summary).toMatchObject({ status: 200, revision: 96, acceptedCommandCount: 96, checkpointRevision: null, replaySuffixLength: null, tailEvidenceSource: null, hibernationObserved: false, socketCount: 4 });
    expect(JSON.stringify(summary)).not.toMatch(/participantCapability|Authorization/);
    expect(injected.sockets).toHaveLength(5);
    expect(injected.sleeps).toEqual([]);
    expect(injected.barriers).toBe(0);
    expect(injected.observations).toBe(0);
  }, 30_000);

  it('holds the idle socket for hibernation and pauses at the deployment barrier', async () => {
    const injected = deps();
    const summary = await runEvidencePhase('deployment-reconnect', 'http://localhost:8787', injected);
    expect(injected.sleeps).toEqual([70_000]);
    expect(injected.barriers).toBe(1);
    expect(injected.observations).toBe(1);
    expect(summary).toMatchObject({ checkpointRevision: 64, replaySuffixLength: 32, hibernationObserved: true });
    expect(summary.preDeployVersionIdentifier).not.toBe(summary.postDeployVersionIdentifier);
    expect(injected.sockets.every((socket) => socket.closed)).toBe(true);
  }, 30_000);

  it('stops on the first command mismatch and performs no external mutation', async () => {
    const injected = deps({ mismatchAt: 5 });
    await expect(runEvidencePhase('init-load', 'http://localhost:8787', injected)).rejects.toThrow();
    expect(injected.sockets.flatMap((socket) => socket.sent).filter((value) => value.includes('evidence-command-')).length).toBe(4);
    expect(injected.sleeps).toEqual([]);
    expect(injected.barriers).toBe(0);
  }, 30_000);

  it('rejects wrong-audience, secret-bearing, and unverified platform evidence', async () => {
    await expect(runEvidencePhase('init-load', 'http://localhost:8787', deps({ wrongAudience: true }))).rejects.toThrow('hello mismatch');
    await expect(runEvidencePhase('init-load', 'http://localhost:8787', deps({ leakCapability: true }))).rejects.toThrow('secret-bearing output');
    await expect(runEvidencePhase('init-load', 'http://localhost:8787', deps({ leakFragment: true }))).rejects.toThrow('secret-bearing output');
    await expect(runEvidencePhase('init-load', 'http://localhost:8787', deps({ unsolicitedLeak: true }))).rejects.toThrow('secret-bearing output');
    await expect(runEvidencePhase('init-load', 'http://localhost:8787', deps({ finalUnsolicitedLeak: true }))).rejects.toThrow('secret-bearing output');
    await expect(runEvidencePhase('deployment-reconnect', 'http://localhost:8787', deps({ invalidPlatform: true }))).rejects.toThrow('platform evidence mismatch');
  }, 30_000);

  it('keeps the hibernation phase independent from the deployment barrier', async () => {
    const injected = deps();
    const summary = await runEvidencePhase('hibernation', 'http://localhost:8787', injected);
    expect(injected.barriers).toBe(0);
    expect(injected.observations).toBe(1);
    expect(summary.preDeployVersionIdentifier).toBe(summary.postDeployVersionIdentifier);
  }, 30_000);

  it('fails boundedly when HTTP or the operator deployment barrier stalls', async () => {
    await expect(runEvidencePhase('init-load', 'http://localhost:8787', deps({ hangFetch: true }))).rejects.toThrow('initialization request timeout');
    await expect(runEvidencePhase('deployment-reconnect', 'http://localhost:8787', deps({ hangBarrier: true }))).rejects.toThrow('deployment barrier timeout');
  }, 30_000);
});
