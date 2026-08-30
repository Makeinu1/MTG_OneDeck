import { describe, expect, it } from 'vitest';
import {
  O4P09I_PAGES_ORIGIN_V1,
  O4P09I_WORKER_ORIGIN_V1,
  runO4p09iFullMatchEvidenceV1,
  validateO4p09iFullMatchEvidenceV1,
  type O4p09iBrowserV1,
  type O4p09iContextV1,
  type O4p09iPageV1,
} from '../../../../scripts/online/o4p-09i-full-match-evidence';

type FakeOptions = Readonly<{
  readonly missingControl?: string;
  readonly hiddenControl?: string;
  readonly overflow?: number;
  readonly stagnantRevision?: boolean;
  readonly stagnantPhase?: boolean;
  readonly missingWinner?: boolean;
  readonly missingWorker?: boolean;
  readonly leak?: boolean;
  readonly privateChoiceLeak?: boolean;
  readonly privateChoiceCandidateLeak?: boolean;
  readonly geometryFailure?: 'vertical-collision' | 'offscreen-panel' | 'inaccessible-scroll' | 'obscured-battlefield' | 'clipped-primary';
  readonly consoleErrors?: number;
  readonly closeFailure?: boolean;
}>;

function fakeBrowser(expressions: string[], options: FakeOptions = {}): O4p09iBrowserV1 {
  let contextIndex = 0;
  const page = (contextOrdinal: number, pageOrdinal: number): O4p09iPageV1 => {
    let advanceClicks = 0;
    let phase = 'beginning';
    let viewportWidth = 1440;
    let viewportHeight = 900;
    return {
    navigate: () => Promise.resolve(),
    evaluate: <T,>(expression: string): Promise<T> => {
      expressions.push(expression);
      const missingControl = options.missingControl ?? '__missing__';
      if (expression.includes(`data-testid="${missingControl}"`)) return Promise.reject(new Error('visible control missing'));
      const hiddenControl = options.hiddenControl ?? '__hidden__';
      if (expression.includes(`data-testid="${hiddenControl}"`)) return Promise.reject(new Error('visible control hidden'));
      if (expression.includes('data-testid="online-remote-advance"')) {
        advanceClicks += 1;
        if (options.stagnantPhase !== true) phase = advanceClicks === 1 ? 'main1' : 'combat';
      }
      if (expression.includes('privateChoicePayload')) {
        const hostContext = contextOrdinal === 0 || contextOrdinal === 2;
        const payload = options.privateChoiceLeak === true || (hostContext && pageOrdinal === 0)
          ? { identifiers: ['visibility-choose-fixture'], candidateHandles: ['private-card-handle'], serialized: 'private-choice-host-payload' }
          : { identifiers: [], candidateHandles: [], serialized: 'private-choice-empty-payload' };
        return Promise.resolve(payload as T);
      }
      if (expression.includes('privateChoiceIdentifiers')) {
        // The harness runs the two-player scenario first (contexts 0/1) and
        // the four-player scenario second (contexts 2/3/4/5); only each
        // scenario's host is authorized to render the private choice.
        const hostContext = contextOrdinal === 0 || contextOrdinal === 2;
        const identifiers = options.privateChoiceLeak === true || (hostContext && pageOrdinal === 0) ? ['visibility-choose-fixture'] : [];
        return Promise.resolve(identifiers as T);
      }
      if (expression.includes('privateChoiceDomSurfaces')) {
        const leaked = options.privateChoiceCandidateLeak === true && contextOrdinal !== 0 && contextOrdinal !== 2;
        return Promise.resolve((leaked ? ['private-card-handle'] : []) as T);
      }
      if (expression.includes('invite span')) return Promise.resolve('fixture-invite' as T);
      if (expression.includes('gameScreens')) {
        const revision = options.stagnantRevision ? 0 : expressions.filter((entry) => entry.includes('gameScreens')).length;
        const handHeight = Math.min(80, Math.max(40, viewportHeight * 0.12));
        const handY = viewportHeight - handHeight - 5;
        const railY = Math.max(8, handY - Math.min(300, viewportHeight * 0.5));
        const railHeight = Math.max(1, handY - 5 - railY);
        const boardY = 8;
        const boardBottom = Math.max(boardY + 1, railY - 8);
        const panelHeight = Math.min(220, Math.max(80, viewportHeight * 0.45));
        const geometryFailure = options.geometryFailure;
        const geometry = {
          viewport: { x: 0, y: 0, width: viewportWidth, height: viewportHeight, right: viewportWidth, bottom: viewportHeight },
          rail: { x: 8, y: railY, width: Math.max(1, viewportWidth - 16), height: railHeight, right: viewportWidth - 8, bottom: railY + railHeight },
          hand: { x: 8, y: handY, width: Math.max(1, viewportWidth - 16), height: handHeight, right: viewportWidth - 8, bottom: handY + handHeight },
          battlefield: { x: 8, y: boardY, width: Math.max(1, viewportWidth - 16), height: boardBottom - boardY, right: viewportWidth - 8, bottom: boardBottom },
          primaryAction: { rect: { x: 16, y: railY + 8, width: 120, height: 32, right: 136, bottom: railY + 40 }, enabled: true as const },
          panel: { x: 16, y: 16, width: Math.max(1, viewportWidth - 32), height: Math.min(panelHeight, viewportHeight - 20), right: viewportWidth - 16, bottom: 16 + Math.min(panelHeight, viewportHeight - 20) },
          scroll: { rect: { x: 8, y: railY, width: Math.max(1, viewportWidth - 16), height: railHeight, right: viewportWidth - 8, bottom: railY + railHeight }, scrollWidth: viewportWidth, scrollHeight: railHeight * 2, clientWidth: Math.max(1, viewportWidth - 16), clientHeight: railHeight },
          clippedPrimaryAction: geometryFailure === 'clipped-primary',
          railHandCollision: geometryFailure === 'vertical-collision',
          panelOutsideViewport: geometryFailure === 'offscreen-panel',
          scrollAccessible: geometryFailure !== 'inaccessible-scroll',
          battlefieldObscured: geometryFailure === 'obscured-battlefield',
        };
        return Promise.resolve({ gameScreens: 1, overflow: options.overflow ?? 0, geometry, revision, phase, winner: options.missingWinner !== true, outcomeVisible: options.missingWinner !== true, activeSeatCount: 3, eliminatedSeats: options.missingWinner === true ? [] : ['P2'], opponentLeak: options.leak === true, privateLookControl: true, chooseControl: true, manualStackControl: true, manualResolveControl: true, consoleErrors: options.consoleErrors ?? 0, workerObserved: options.missingWorker !== true } as T);
      }
      return Promise.resolve(true as T);
    },
    setViewport: (viewport) => { viewportWidth = viewport.width; viewportHeight = viewport.height; },
    close: () => Promise.resolve(),
    consoleCounts: () => ({ errors: options.consoleErrors ?? 0, warnings: 0, secretViolations: 0 }),
    setSecretFragments: () => undefined,
    };
  };
  const context = (): O4p09iContextV1 => {
    const contextOrdinal = contextIndex++;
    const id = `fixture-context-${String(contextOrdinal)}`;
    let pageOrdinal = 0;
    return { browserContextId: id, createPage: () => Promise.resolve(page(contextOrdinal, pageOrdinal++)), close: () => Promise.resolve() };
  };
  return {
    chromeVersion: 'fixture-chrome',
    createBrowserContext: () => Promise.resolve(context()),
    close: () => options.closeFailure ? Promise.reject(new Error('cleanup failed')) : Promise.resolve(),
  };
}

describe('O4P-09I full-match production evidence', () => {
  it('runs an injected UI-only harness for both player-count scenarios', async () => {
    const expressions: string[] = [];
    const summary = await runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser(expressions), readDeck: () => 'fixture deck' });
    expect(summary.pagesOrigin).toBe(O4P09I_PAGES_ORIGIN_V1);
    expect(summary.workerOrigin).toBe(O4P09I_WORKER_ORIGIN_V1);
    expect(summary.scenarios.twoPlayer.playerCount).toBe(2);
    expect(summary.scenarios.twoPlayer.outcome).toBe('winner');
    expect(summary.scenarios.fourPlayer.playerCount).toBe(4);
    expect(summary.scenarios.fourPlayer.outcome).toBe('three-continue');
    expect(expressions.some((expression) => expression.includes('document.querySelector'))).toBe(true);
    expect(expressions.some((expression) => expression.includes('applyCommand') || /\bdispatch\s*\(/u.test(expression) || /\bfetch\s*\(/u.test(expression))).toBe(false);
  });

  it('rejects malformed, secret-bearing, and incomplete cleanup summaries', async () => {
    const summary = await runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser([]), readDeck: () => 'fixture deck' });
    expect(validateO4p09iFullMatchEvidenceV1({ ...summary, schemaVersion: 2 })).toMatchObject({ ok: false });
    expect(validateO4p09iFullMatchEvidenceV1({ ...summary, chromeVersion: 'seat_secret_12345678' })).toMatchObject({ ok: false });
    expect(validateO4p09iFullMatchEvidenceV1({ ...summary, cleanup: { ...summary.cleanup, pagesClosed: 1 } })).toMatchObject({ ok: false });
    expect(validateO4p09iFullMatchEvidenceV1({ ...summary, consoleCounts: { errors: 1, warnings: 0, secretViolations: 0 } })).toMatchObject({ ok: false });
    expect(validateO4p09iFullMatchEvidenceV1({
      ...summary,
      scenarios: {
        ...summary.scenarios,
        twoPlayer: { ...summary.scenarios.twoPlayer, revision: { ...summary.scenarios.twoPlayer.revision, afterReconnect: 0 } },
      },
    })).toMatchObject({ ok: false });
  });

  it.each([
    ['missing visible control', { missingControl: 'online-remote-hold' }],
    ['hidden visible control', { hiddenControl: 'online-remote-hold' }],
    ['horizontal overflow', { overflow: 4 }],
    ['stagnant revision', { stagnantRevision: true }],
    ['phase never advances', { stagnantPhase: true }],
    ['missing winner', { missingWinner: true }],
    ['missing worker origin observation', { missingWorker: true }],
    ['opponent leak', { leak: true }],
    ['cross-seat private choice leak', { privateChoiceLeak: true }],
    ['private choice candidate leak without choose testid', { privateChoiceCandidateLeak: true }],
    ['vertical geometry collision', { geometryFailure: 'vertical-collision' }],
    ['offscreen active panel', { geometryFailure: 'offscreen-panel' }],
    ['inaccessible scroll region', { geometryFailure: 'inaccessible-scroll' }],
    ['obscured battlefield', { geometryFailure: 'obscured-battlefield' }],
    ['clipped primary action', { geometryFailure: 'clipped-primary' }],
    ['console error', { consoleErrors: 1 }],
  ] as const)('fails closed for %s', async (_label, options) => {
    const shortFailure = ('stagnantRevision' in options && options.stagnantRevision === true) || ('stagnantPhase' in options && options.stagnantPhase === true) || ('missingWinner' in options && options.missingWinner === true);
    await expect(runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser([], options), readDeck: () => 'fixture deck', timeoutMs: shortFailure ? 250 : undefined })).rejects.toThrow();
  });

  it('fails closed when the browser profile cannot be cleaned up', async () => {
    await expect(runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser([], { closeFailure: true }), readDeck: () => 'fixture deck' })).rejects.toThrow('cleanup failed');
  });
});
