import { describe, expect, it } from 'vitest';
import {
  O4P06F_PAGES_ORIGIN_V1,
  O4P06F_WORKER_ORIGIN_V1,
  inspectO4p06fProjectionZonesV1,
  runO4p06fFourBrowserEvidenceV1,
  validateO4p06fEvidenceSummaryV1,
  type O4p06fBrowserV1,
  type O4p06fContextV1,
  type O4p06fPageV1,
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

describe('O4P-06F four-browser production evidence', () => {
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
