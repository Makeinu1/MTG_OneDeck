import { describe, expect, it } from 'vitest';
import {
  O4P06F_PAGES_ORIGIN_V1,
  O4P06F_WORKER_ORIGIN_V1,
  awaitO4p06fParticipantDisconnectedV1,
  inspectO4p06fParticipantPresenceV1,
  inspectO4p06fProjectionZonesV1,
  isO4p06fRevisionNoticeAtMostV1,
  runO4p06fFourBrowserEvidenceV1,
  validateO4p06fEvidenceSummaryV1,
  type O4p06fBrowserV1,
  type O4p06fContextV1,
  type O4p06fPageV1,
  type O4p06fSocketV1,
} from '../../../../scripts/online/o4p-06f-four-browser-evidence';

const CAPABILITY = `seat_${'S'.repeat(48)}`;

function summary(): Record<string, unknown> {
  return {
    kind: 'o4p-06f-four-browser-production-evidence-v1', schemaVersion: 1,
    pagesOrigin: O4P06F_PAGES_ORIGIN_V1, workerOrigin: O4P06F_WORKER_ORIGIN_V1,
    chromeVersion: 'Google Chrome/140.0.0.0', contextCount: 4,
    decks: ['Celes', 'Gogo', 'Kefka', 'Muldrotha'].map((label) => ({ label, path: `Mydeck/${label}.txt`, sha256: 'a'.repeat(64), byteCount: 10 })),
    publicAssetHashes: ['b'.repeat(64)], httpStatuses: [200, 200, 200, 200, 200], revision: 5, acceptedCommandCount: 5,
    actionKindCounts: { 'table-draw': 4, 'player-exit': 1 },
    reconnect: { participant: 'P2', freshSocket: true, staleKnownRevision: 2, snapshotCount: 1, bounded: true },
    preDeploymentVersionIdentifiers: ['11111111-1111-4111-8111-111111111111'],
    postDeploymentVersionIdentifiers: ['22222222-2222-4222-8222-222222222222'],
    preDeploymentProjectionHashes: { 'audience-1': 'c'.repeat(64), 'audience-2': 'c'.repeat(64), 'audience-3': 'c'.repeat(64), 'audience-4': 'c'.repeat(64) }, postDeploymentProjectionHashes: { 'audience-1': 'c'.repeat(64), 'audience-2': 'c'.repeat(64), 'audience-3': 'c'.repeat(64), 'audience-4': 'c'.repeat(64) },
    recoveryFacts: { checkpointRevision: 0, currentRevision: 5, replayCount: 5, outcome: 'ok', errorCount: 0, exceptionCount: 0, parseFailureCount: 0, secretViolationCount: 0 },
    consoleCounts: { errors: 0, warnings: 0 }, cleanup: { targetsClosed: 4, startupTargetsClosed: 0, contextsClosed: 4, socketsClosed: 10, profileRemoved: true },
  };
}

function inertPage(): O4p06fPageV1 {
  return {
    navigate: () => Promise.resolve(),
    evaluate: <T,>(expression: string): Promise<T> => { void expression; return Promise.resolve({ online: false } as T); },
    fetch: () => Promise.resolve({ status: 503, json: () => Promise.resolve({}) }),
    openWebSocket: () => Promise.resolve({ send: () => undefined, next: () => Promise.resolve({}), close: () => undefined, pendingCount: () => Promise.resolve(0) }),
    close: () => Promise.resolve(),
    consoleCounts: () => ({ errors: 0, warnings: 1 }),
  };
}

function browser(log: string[]): O4p06fBrowserV1 {
  let contextCount = 0;
  return {
    chromeVersion: 'fake-chrome',
    createBrowserContext: (): Promise<O4p06fContextV1> => Promise.resolve({
      browserContextId: `ctx-${String(contextCount++)}`,
      createPage: () => Promise.resolve(inertPage()),
      close: () => { log.push('context cleanup'); return Promise.resolve(); },
    }),
    close: () => { log.push('browser cleanup'); return Promise.resolve(); },
  };
}

function hangingCleanupBrowser(log: string[]): O4p06fBrowserV1 {
  let contextCount = 0;
  return {
    chromeVersion: 'fake-chrome',
    createBrowserContext: (): Promise<O4p06fContextV1> => Promise.resolve({
      browserContextId: `hanging-ctx-${String(contextCount++)}`,
      createPage: () => Promise.resolve({
        ...inertPage(),
        assetFacts: () => Promise.resolve({ href: O4P06F_PAGES_ORIGIN_V1, origin: new URL(O4P06F_PAGES_ORIGIN_V1).origin, statuses: [200], hashes: ['d'.repeat(64)] }),
        fetch: () => Promise.resolve({ status: 503, text: () => Promise.resolve('{}'), json: () => Promise.resolve({}) }),
        close: () => new Promise<void>(() => undefined),
      }),
      close: () => { log.push('hanging context cleanup'); return Promise.resolve(); },
    }),
    close: () => { log.push('hanging browser cleanup'); return Promise.resolve(); },
  };
}

function presenceProjection(presence: 'connected' | 'disconnected', participants = ['p1', 'p2', 'p3', 'p4', 'table']): Record<string, unknown> {
  const zone = () => ({ count: 0, entries: [] });
  return {
    kind: 'online-participant-projection-v1', schemaVersion: 1, protocolVersion: 1, roomId: 'room-observer', participantId: 'p1', role: 'player', corePlayerId: 'P1', revision: 4,
    room: {
      lifecycle: 'active', hostParticipantId: 'p1', participants: participants.map((participantId, index) => ({ participantId, role: index === 4 ? 'table' : 'player', presence: participantId === 'p2' ? presence : 'connected', seatIndex: index === 4 ? null : index })),
      seats: [0, 1, 2, 3].map((seatIndex) => ({ seatIndex, corePlayerId: `P${String(seatIndex + 1)}`, participantId: participants[seatIndex], ready: true, outcome: 'active' })),
    },
    game: { turnOrder: ['P1', 'P2', 'P3', 'P4'], turn: { activePlayerId: 'P1', phase: 'main', step: 'precombat' }, players: [], zones: { byPlayer: [0, 1, 2, 3].map((index) => ({ playerId: `P${String(index + 1)}`, zones: { library: zone(), hand: zone(), graveyard: zone() } })) }, visibilityGrants: [], searchSessions: [], playPermissions: [] },
  };
}

function presenceSnapshot(presence: 'connected' | 'disconnected'): Record<string, unknown> {
  return { kind: 'online-projected-snapshot-v1', status: 'accepted', revision: 4, projection: presenceProjection(presence) };
}

function observerSocket(frames: readonly unknown[], sent: unknown[]): O4p06fSocketV1 {
  let index = 0;
  return {
    send: (value) => { sent.push(value); },
    next: () => Promise.resolve(frames[index++]),
    close: () => undefined,
    pendingCount: () => Promise.resolve(0),
  };
}

function hangingObserverSendSocket(sent: unknown[]): O4p06fSocketV1 {
  return {
    send: (value) => { sent.push(value); return new Promise<void>(() => undefined); },
    next: () => Promise.resolve(undefined),
    close: () => undefined,
    pendingCount: () => Promise.resolve(0),
  };
}

describe('O4P-06F four-browser production evidence', () => {
  it('accepts only an exact same-room non-future revision notice', () => {
    const roomId = 'room-ordinary-revision-notice';
    const notice = { kind: 'online-cloudflare-revision-v1', schemaVersion: 1, roomId, revision: 3 };
    expect(isO4p06fRevisionNoticeAtMostV1(notice, roomId, 3)).toBe(true);
    expect(isO4p06fRevisionNoticeAtMostV1({ ...notice, revision: 4 }, roomId, 3)).toBe(false);
    expect(isO4p06fRevisionNoticeAtMostV1({ ...notice, revision: -0 }, roomId, 3)).toBe(false);
    expect(isO4p06fRevisionNoticeAtMostV1({ ...notice, roomId: 'room-other' }, roomId, 3)).toBe(false);
    expect(isO4p06fRevisionNoticeAtMostV1({ ...notice, schemaVersion: 2 }, roomId, 3)).toBe(false);
    expect(isO4p06fRevisionNoticeAtMostV1({ ...notice, extra: true }, roomId, 3)).toBe(false);
  });

  it('observes delayed P2 close propagation through a surviving Player read-only projection', async () => {
    const sent: unknown[] = [];
    await awaitO4p06fParticipantDisconnectedV1({ socket: observerSocket([presenceSnapshot('connected'), presenceSnapshot('disconnected')], sent), roomId: 'room-observer', observerParticipantId: 'p1', observerParticipantCapability: 'seat-secret-p1', targetParticipantId: 'p2', targetExpectedSeatIndex: 1, ownPlayerId: 'P1', fragments: [], timeoutMs: 100, runtime: { now: () => Date.now(), schedule: (milliseconds, task) => setTimeout(task, milliseconds), cancel: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>) } });
    expect(sent).toHaveLength(2);
    expect(sent.every((frame) => (frame as Record<string, unknown>).kind === 'online-projection-request-v1' && (frame as Record<string, unknown>).knownRevision === 4 && (frame as Record<string, unknown>).participantId === 'p1' && (frame as Record<string, unknown>).participantCapability === 'seat-secret-p1')).toBe(true);
  });

  it('rejects malformed and duplicate participant rows before reconnect evidence', () => {
    const malformed = presenceProjection('disconnected');
    (malformed.room as Record<string, unknown>).participants = [...(malformed.room as Record<string, unknown>).participants as unknown[], { participantId: 'extra', role: 'player', presence: 'connected', seatIndex: 4 }];
    expect(() => inspectO4p06fParticipantPresenceV1(malformed, 'p2', 1)).toThrow('projection participant rows incomplete');
    const duplicate = presenceProjection('disconnected', ['p1', 'p2', 'p2', 'p4', 'table']);
    expect(() => inspectO4p06fParticipantPresenceV1(duplicate, 'p2', 1)).toThrow('projection participant ID malformed');
    const invalid = presenceProjection('disconnected');
    ((invalid.room as Record<string, unknown>).participants as Record<string, unknown>[])[1].presence = 'unknown';
    expect(() => inspectO4p06fParticipantPresenceV1(invalid, 'p2', 1)).toThrow('projection participant presence malformed');
    const tableTarget = presenceProjection('disconnected', ['p1', 'table', 'p3', 'p4', 'p2']);
    expect(() => inspectO4p06fParticipantPresenceV1(tableTarget, 'p2', 1)).toThrow('projection target participant relation malformed');
    const wrongSeat = presenceProjection('disconnected');
    const wrongSeatRows = (wrongSeat.room as Record<string, unknown>).participants as Record<string, unknown>[];
    wrongSeatRows[0].seatIndex = 1; wrongSeatRows[1].seatIndex = 0;
    expect(() => inspectO4p06fParticipantPresenceV1(wrongSeat, 'p2', 1)).toThrow('projection target participant relation malformed');
  });

  it('bounds disconnect observation attempts and fails closed when P2 remains connected', async () => {
    const sent: unknown[] = [];
    const runtime = { now: () => Date.now(), schedule: (milliseconds: number, task: () => void) => setTimeout(task, milliseconds), cancel: (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>) };
    const input = { socket: observerSocket([presenceSnapshot('connected'), presenceSnapshot('connected')], sent), roomId: 'room-observer', observerParticipantId: 'p1', observerParticipantCapability: 'seat-secret-p1', targetParticipantId: 'p2', targetExpectedSeatIndex: 1, ownPlayerId: 'P1', fragments: [], timeoutMs: 100, maxAttempts: 2, runtime };
    await expect(awaitO4p06fParticipantDisconnectedV1(input)).rejects.toThrow('P2 disconnect observation exhausted');
    expect(sent).toHaveLength(2);
    await expect(awaitO4p06fParticipantDisconnectedV1({ ...input, timeoutMs: Number.NaN })).rejects.toThrow('disconnect observation timeout invalid');
    await expect(awaitO4p06fParticipantDisconnectedV1({ ...input, timeoutMs: Number.POSITIVE_INFINITY })).rejects.toThrow('disconnect observation timeout invalid');
  });

  it('bounds a never-resolving observer send with the injected deadline', async () => {
    const sent: unknown[] = []; let now = 0; const timers = new Map<() => void, number>();
    const runtime = {
      now: () => now,
      schedule: (milliseconds: number, task: () => void) => { timers.set(task, milliseconds); return task; },
      cancel: (handle: unknown) => { timers.delete(handle as () => void); },
    };
    const completion = awaitO4p06fParticipantDisconnectedV1({ socket: hangingObserverSendSocket(sent), roomId: 'room-observer', observerParticipantId: 'p1', observerParticipantCapability: 'seat-secret-p1', targetParticipantId: 'p2', targetExpectedSeatIndex: 1, ownPlayerId: 'P1', fragments: [], timeoutMs: 10, runtime });
    for (let index = 0; index < 20; index += 1) await Promise.resolve();
    expect(timers.size).toBe(1);
    const [timer, milliseconds] = timers.entries().next().value as [() => void, number];
    now += milliseconds;
    timer();
    await expect(completion).rejects.toThrow('P2 disconnect observation send timeout');
    expect(sent).toHaveLength(1);
    expect(now).toBe(10);
  });

  it('recomputes the cumulative deadline after a delayed observer send', async () => {
    let now = 0; let resolveSend: (() => void) | null = null; const timers = new Map<() => void, number>();
    const runtime = {
      now: () => now,
      schedule: (milliseconds: number, task: () => void) => { timers.set(task, milliseconds); return task; },
      cancel: (handle: unknown) => { timers.delete(handle as () => void); },
    };
    const socket: O4p06fSocketV1 = {
      send: () => new Promise<void>((resolve) => { resolveSend = resolve; }),
      next: () => new Promise<unknown>(() => undefined),
      close: () => undefined,
      pendingCount: () => Promise.resolve(0),
    };
    const completion = awaitO4p06fParticipantDisconnectedV1({ socket, roomId: 'room-observer', observerParticipantId: 'p1', observerParticipantCapability: 'seat-secret-p1', targetParticipantId: 'p2', targetExpectedSeatIndex: 1, ownPlayerId: 'P1', fragments: [], timeoutMs: 10, runtime });
    for (let index = 0; index < 20; index += 1) await Promise.resolve();
    now = 9; (resolveSend as (() => void) | null)?.();
    for (let index = 0; index < 20; index += 1) await Promise.resolve();
    expect([...timers.values()]).toEqual([1]);
    const timer = timers.keys().next().value as () => void; now = 10; timer();
    await expect(completion).rejects.toThrow('P2 disconnect observation timeout');
  });

  it('accepts a closed secret-free summary and freezes a fresh copy', () => {
    const input = summary();
    const result = validateO4p06fEvidenceSummaryV1(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toBe(input);
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(JSON.stringify(result.value)).not.toContain(CAPABILITY);
  });

  it('uses the shipped count/entries projection zones and rejects malformed or identity-bearing opponent cards', () => {
    const zone = (count: number, entries: unknown[]) => ({ count, entries });
    const projection = {
      game: { zones: { byPlayer: [
        { playerId: 'P1', zones: { hand: zone(1, [{ kind: 'concealed-object', objectId: 'O1' }]), library: zone(2, [{ kind: 'hidden-card' }, { kind: 'hidden-card' }]), graveyard: zone(0, []) } },
        { playerId: 'P2', zones: { hand: zone(1, [{ kind: 'hidden-card' }]), library: zone(2, [{ kind: 'hidden-card' }, { kind: 'hidden-card' }]), graveyard: zone(0, []) } },
        { playerId: 'P3', zones: { hand: zone(1, [{ kind: 'hidden-card' }]), library: zone(2, [{ kind: 'hidden-card' }, { kind: 'hidden-card' }]), graveyard: zone(0, []) } },
        { playerId: 'P4', zones: { hand: zone(1, [{ kind: 'hidden-card' }]), library: zone(2, [{ kind: 'hidden-card' }, { kind: 'hidden-card' }]), graveyard: zone(0, []) } },
      ] } },
    };
    expect(inspectO4p06fProjectionZonesV1(projection, 'P1')).toEqual({ hand: 1, library: 2 });
    const leaked = structuredClone(projection);
    leaked.game.zones.byPlayer[1].zones.hand.entries[0] = { kind: 'concealed-object', objectId: 'O2' };
    expect(() => inspectO4p06fProjectionZonesV1(leaked, 'P1')).toThrow('opponent hidden-card entry malformed');
    const oldArrayShape = structuredClone(projection);
    oldArrayShape.game.zones.byPlayer[1].zones.hand = [] as unknown as { count: number; entries: { kind: string; objectId?: string }[] };
    expect(() => inspectO4p06fProjectionZonesV1(oldArrayShape, 'P1')).toThrow('projection hand malformed');
    let traps = 0;
    const hostile = structuredClone(projection);
    hostile.game.zones.byPlayer[1].zones.hand.entries[0] = new Proxy({ kind: 'hidden-card' }, { getPrototypeOf: () => { traps += 1; throw new Error('trap'); } });
    expect(() => inspectO4p06fProjectionZonesV1(hostile, 'P1')).toThrow('proxy canonical value');
    expect(traps).toBe(0);
    const omitted = structuredClone(projection);
    omitted.game.zones.byPlayer.splice(2, 1);
    expect(() => inspectO4p06fProjectionZonesV1(omitted, 'P1')).toThrow('projection player zones incomplete');
  });

  it('rejects fabricated cleanup target totals', () => {
    const fabricated = summary();
    (fabricated.cleanup as Record<string, unknown>).targetsClosed = 999;
    expect(validateO4p06fEvidenceSummaryV1(fabricated).ok).toBe(false);
  });

  it('rejects a capability fragment, wrong revision, and accessor without invoking hostile code; projection hash remains closed', () => {
    const leaked = summary();
    (leaked.preDeploymentProjectionHashes as Record<string, unknown>)['leak'] = CAPABILITY.slice(0, 8);
    expect(validateO4p06fEvidenceSummaryV1(leaked).ok).toBe(false);
    const wrongRevision = summary(); wrongRevision.revision = 4;
    expect(validateO4p06fEvidenceSummaryV1(wrongRevision).ok).toBe(false);
    const hostile = summary(); let invoked = false;
    Object.defineProperty(hostile, 'chromeVersion', { enumerable: true, get: () => { invoked = true; throw new Error('hostile accessor'); } });
    expect(validateO4p06fEvidenceSummaryV1(hostile).ok).toBe(false);
    expect(invoked).toBe(false);
    let trapCount = 0;
    const proxied = new Proxy(summary(), { ownKeys: () => { trapCount += 1; throw new Error('proxy trap'); }, getPrototypeOf: () => { trapCount += 1; throw new Error('proxy trap'); } });
    expect(validateO4p06fEvidenceSummaryV1(proxied).ok).toBe(false);
    expect(trapCount).toBe(0);
    const nested = summary(); let nestedTrapCount = 0;
    nested.preDeploymentProjectionHashes = new Proxy(nested.preDeploymentProjectionHashes as Record<string, unknown>, { ownKeys: () => { nestedTrapCount += 1; throw new Error('nested proxy trap'); }, getPrototypeOf: () => { nestedTrapCount += 1; throw new Error('nested proxy trap'); } });
    expect(validateO4p06fEvidenceSummaryV1(nested).ok).toBe(false);
    expect(nestedTrapCount).toBe(0);
  });

  it('rejects aliases, cycles, sparse arrays, symbols, nonfinite numbers, and missing operator evidence', async () => {
    const alias = summary();
    alias.postDeploymentProjectionHashes = alias.preDeploymentProjectionHashes;
    expect(validateO4p06fEvidenceSummaryV1(alias).ok).toBe(false);
    const sparse = summary();
    const decks = sparse.decks as unknown[];
    Reflect.deleteProperty(decks, '2');
    expect(validateO4p06fEvidenceSummaryV1(sparse).ok).toBe(false);
    const symbol = summary();
    Object.defineProperty(symbol, Symbol('hostile'), { enumerable: true, value: 'x' });
    expect(validateO4p06fEvidenceSummaryV1(symbol).ok).toBe(false);
    const nonfinite = summary(); (nonfinite.consoleCounts as Record<string, unknown>).errors = -0;
    expect(validateO4p06fEvidenceSummaryV1(nonfinite).ok).toBe(false);
    await expect(runO4p06fFourBrowserEvidenceV1({ readDeck: () => 'x' })).rejects.toThrow('operator barrier');
  });

  it('fails boundedly on a console warning/control drift and closes all four distinct contexts', async () => {
    const cleanup: string[] = [];
    await expect(runO4p06fFourBrowserEvidenceV1({ browser: browser(cleanup), timeoutMs: 25, readDeck: () => 'Commander\n1 Celes\n', barrier: () => Promise.resolve(), observePlatformEvidence: () => Promise.resolve({}) })).rejects.toThrow();
    expect(cleanup.filter((value) => value === 'context cleanup')).toHaveLength(4);
    expect(cleanup).toContain('browser cleanup');
  });

  it('bounds a never-settling target close and still attempts remaining cleanup resources', async () => {
    const cleanup: string[] = [];
    let clock = 0;
    await expect(runO4p06fFourBrowserEvidenceV1({ browser: hangingCleanupBrowser(cleanup), timeoutMs: 10, now: () => clock, schedule: (milliseconds, task) => { clock += milliseconds; task(); return milliseconds; }, cancelSchedule: () => undefined, readDeck: () => 'Commander\n1 Celes\n', barrier: () => Promise.resolve(), observePlatformEvidence: () => Promise.resolve({}) })).rejects.toThrow();
    expect(clock).toBeGreaterThanOrEqual(40);
    expect(cleanup.filter((value) => value === 'hanging context cleanup')).toHaveLength(4);
    expect(cleanup).toContain('hanging browser cleanup');
  });
});
