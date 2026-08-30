import { Script } from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  O4P09I_DEFAULT_TIMEOUT_MS_V1,
  O4P09I_PAGES_ORIGIN_V1,
  O4P09I_PUBLIC_DECK_TEXTS_V1,
  O4P09I_START_SURFACE_TIMEOUT_MS_V1,
  O4P09I_WORKER_ORIGIN_V1,
  runO4p09iFullMatchEvidenceV1 as runO4p09iFullMatchEvidenceProductionV1,
  runO4p09iFullMatchEvidenceTestDriverV1 as runO4p09iFullMatchEvidenceV1,
  validateO4p09iFullMatchEvidenceV1,
  type O4p09iBrowserV1,
  type O4p09iContextV1,
  type O4p09iPageV1,
} from '../../../../scripts/online/o4p-09i-full-match-evidence';

type FakeOptions = Readonly<{
  readonly missingControl?: string;
  readonly savedStateError?: boolean;
  readonly savedResolutionPending?: boolean;
  readonly savedResolutionError?: boolean;
  readonly missingSaveNotification?: boolean;
  readonly freshCreateRemount?: boolean;
  readonly savedImportRuntimeFailure?: boolean;
  readonly savedImportRuntimeError?: boolean;
  readonly alreadyOnline?: boolean;
  readonly productErrorBoundary?: boolean;
  readonly importSurfaceDisappeared?: boolean;
  readonly invalidWorkflow?: boolean;
  readonly hiddenControl?: string;
  readonly overflow?: number;
  readonly stagnantRevision?: boolean;
  readonly stagnantPhase?: boolean;
  readonly missingWinner?: boolean;
  readonly missingWorker?: boolean;
  readonly leak?: boolean;
  readonly privateChoiceLeak?: boolean;
  readonly privateChoiceCandidateLeak?: boolean;
  readonly privateChoiceCandidateLeakBeyondBound?: boolean;
  readonly privateChoiceScanBoundExceeded?: boolean;
  readonly privateChoiceCandidateTokenLeak?: boolean;
  readonly privateChoiceCaptureBoundExceeded?: boolean;
  readonly leakScanBoundExceeded?: boolean;
  readonly geometryFailure?: 'vertical-collision' | 'offscreen-panel' | 'inaccessible-scroll' | 'non-scrollable' | 'focus-inaccessible' | 'obscured-battlefield' | 'clipped-primary';
  readonly consoleErrors?: number;
  readonly consoleWarnings?: number;
  readonly consoleSecretViolations?: number;
  readonly consoleWarningContext?: number;
  readonly consoleSecretContext?: number;
  readonly consoleWarningReplacement?: boolean;
  readonly consoleSecretReplacement?: boolean;
  readonly closeFailure?: boolean;
  readonly asyncInviteRender?: boolean;
  readonly asyncStartProbe?: boolean;
  readonly startedSurfaceFailure?: 'game-screen-missing/count' | 'horizontal-overflow' | 'opponent-leak' | 'console-error' | 'host-revision-missing' | 'start-rejected' | 'start-pending' | 'start-not-accepted';
}>;

function fakeBrowser(expressions: string[], options: FakeOptions = {}): O4p09iBrowserV1 {
  let contextIndex = 0;
  const sharedRevisions = [0, 0];
  const pregameStates = [{ phaseIndex: 0, actorIndex: 0 }, { phaseIndex: 0, actorIndex: 0 }];
  const pregameControls = ['pregame-confirm-commanders', 'pregame-keep', 'pregame-complete-actions', 'pregame-ready'];
  const page = (contextOrdinal: number, pageOrdinal: number): O4p09iPageV1 => {
    let advanceClicks = 0;
    let revealButtonProbes = 0;
    let inviteReads = 0;
    let startClicks = 0;
    let startedSurfaceProbes = 0;
    const scenarioIndex = contextOrdinal >= 2 ? 1 : 0;
    const seatIndex = scenarioIndex === 0 ? contextOrdinal : contextOrdinal - 2;
    let phase = 'beginning';
    let viewportWidth = 1440;
    let viewportHeight = 900;
    return {
    navigate: () => Promise.resolve(),
    evaluate: <T,>(expression: string): Promise<T> => {
      expressions.push(expression);
      const missingControl = options.missingControl ?? '__missing__';
      if (expression.includes(`data-testid="${missingControl}"`) && !(missingControl === 'open-online-mode' && expression.includes('savedDeckProbe'))) return Promise.reject(new Error('visible control missing'));
      const hiddenControl = options.hiddenControl ?? '__hidden__';
      if (expression.includes(`data-testid="${hiddenControl}"`)) return Promise.reject(new Error('visible control hidden'));
      if (expression.includes('import-screen__save-status--error') && !expression.includes('savedDeckProbe')) return Promise.resolve((options.savedStateError === true ? 'storage-error' : 'ready') as T);
      if (expression.includes('savedDeckProbe')) {
        if (options.savedStateError === true) return Promise.resolve('storage-error' as T);
        if (options.savedResolutionError === true) return Promise.resolve('resolution-error' as T);
        if (options.missingSaveNotification === true) return Promise.resolve('notification-missing' as T);
        if (options.productErrorBoundary === true) return Promise.resolve('error-boundary' as T);
        if (options.alreadyOnline === true) return Promise.resolve('already-online' as T);
        if (options.freshCreateRemount === true) return Promise.resolve('ready' as T);
        if (options.savedImportRuntimeFailure === true || options.savedImportRuntimeError === true || options.importSurfaceDisappeared === true || options.invalidWorkflow === true) return Promise.resolve('pending' as T);
        return Promise.resolve((options.savedResolutionPending === true ? 'pending' : 'ready') as T);
      }
      if (expression.includes('savedDeckTerminalProbe')) {
        if (options.savedImportRuntimeFailure === true) return Promise.resolve('import-runtime-failed' as T);
        if (options.productErrorBoundary === true) return Promise.resolve('error-boundary' as T);
        if (options.importSurfaceDisappeared === true) return Promise.resolve('import-surface-disappeared' as T);
        if (options.invalidWorkflow === true) return Promise.resolve('invalid-workflow' as T);
        if (options.savedResolutionPending === true) return Promise.resolve('resolution-pending' as T);
        return Promise.resolve('saved-state' as T);
      }
      if (expression.includes('startedSurfaceTerminalProbe')) return Promise.resolve((options.startedSurfaceFailure ?? 'game-screen-missing/count') as T);
      const pregameControlIndex = pregameControls.findIndex((control) => expression.includes(`data-testid="${control}"`));
      if (pregameControlIndex >= 0) {
        const state = pregameStates[scenarioIndex];
        const playerCount = scenarioIndex === 0 ? 2 : 4;
        const actorControl = state.phaseIndex === pregameControlIndex && state.actorIndex === seatIndex;
        if (expression.includes('pregameActorControlProbe')) {
          if (!actorControl) return Promise.resolve(false as T);
          sharedRevisions[scenarioIndex] += 1;
          state.actorIndex += 1;
          if (state.actorIndex >= playerCount) { state.actorIndex = 0; state.phaseIndex += 1; }
          return Promise.resolve(true as T);
        }
        if (!actorControl) return Promise.reject(new Error('pregame actor mismatch'));
        sharedRevisions[scenarioIndex] += 1;
        state.actorIndex += 1;
        if (state.actorIndex >= playerCount) { state.actorIndex = 0; state.phaseIndex += 1; }
        return Promise.resolve(true as T);
      }
      if (expression.includes('alreadyOnlineSurfaceProbe')) return Promise.resolve((options.alreadyOnline === true) as T);
      if (expression.includes('data-testid="online-start-game"')) startClicks += 1;
      if (expression.includes('node.click(); return true') || expression.includes('target.click(); return true')) sharedRevisions[scenarioIndex] += 1;
      if (expression.includes('data-testid="online-remote-advance"')) {
        advanceClicks += 1;
        if (options.stagnantPhase !== true) phase = advanceClicks === 1 ? 'main1' : 'combat';
      }
      if (expression.includes('privateChoicePayload')) {
        const hostContext = contextOrdinal === 0 || contextOrdinal === 2;
        if (options.privateChoiceCaptureBoundExceeded === true && hostContext && pageOrdinal === 0) return Promise.resolve({ identifiers: [], candidateHandles: [], serialized: '', complete: false, roots: 129, attributes: 0, values: 0, tokens: 0, bytes: 0 } as T);
        const payload = options.privateChoiceLeak === true || (hostContext && pageOrdinal === 0)
          ? { identifiers: ['visibility-choose-fixture'], candidateHandles: [options.privateChoiceCandidateTokenLeak === true ? 'non-handle-public-token' : 'private-card-handle'], serialized: 'private-choice-host-payload', complete: true, roots: 1, attributes: 2, values: 1, tokens: 4, bytes: 64 }
          : { identifiers: [], candidateHandles: [], serialized: 'private-choice-empty-payload', complete: true, roots: 0, attributes: 0, values: 0, tokens: 0, bytes: 0 };
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
        if (options.privateChoiceScanBoundExceeded === true) return Promise.resolve({ surfaces: [], complete: false } as T);
        if ((options.privateChoiceCandidateLeakBeyondBound === true || options.privateChoiceCandidateTokenLeak === true) && contextOrdinal !== 0 && contextOrdinal !== 2) return Promise.resolve({ surfaces: Array.from({ length: options.privateChoiceCandidateLeakBeyondBound === true ? 2_049 : 1 }, (_entry, index) => index === (options.privateChoiceCandidateLeakBeyondBound === true ? 2_048 : 0) ? (options.privateChoiceCandidateTokenLeak === true ? 'non-handle-public-token' : 'private-card-handle') : `surface-${index}`), complete: true } as T);
        return Promise.resolve({ surfaces: leaked ? ['private-card-handle'] : [], complete: true } as T);
      }
      if (expression.includes('コードを表示')) {
        const delayed = options.asyncInviteRender === true && revealButtonProbes++ === 0;
        return Promise.resolve((!delayed) as T);
      }
      if (expression.includes('invite span')) {
        const delayed = options.asyncInviteRender === true && inviteReads++ === 0;
        return Promise.resolve((delayed ? null : 'fixture-invite') as T);
      }
      if (expression.includes('inviteFingerprintProbe')) return Promise.resolve('0d4a7e5bd65dbfd5c46b1d6a579fa5384ca7d9cc4cd6591e58da18bc087b3a77' as T);
      if (expression.includes('gameScreens')) {
        const waitingForStartedSurface = options.asyncStartProbe === true && startClicks > 0 && startedSurfaceProbes++ === 0;
        const forcedStartedSurfaceFailure = options.startedSurfaceFailure !== undefined && startClicks > 0;
        const gameScreenMissing = options.startedSurfaceFailure === 'game-screen-missing/count' || options.startedSurfaceFailure === 'start-rejected' || options.startedSurfaceFailure === 'start-pending' || options.startedSurfaceFailure === 'start-not-accepted';
        const gameScreenCount = forcedStartedSurfaceFailure && gameScreenMissing ? 0 : waitingForStartedSurface ? 0 : 1;
        const overflow = forcedStartedSurfaceFailure && options.startedSurfaceFailure === 'horizontal-overflow' ? 1 : options.overflow ?? 0;
        const opponentLeak = forcedStartedSurfaceFailure && options.startedSurfaceFailure === 'opponent-leak' ? true : options.leak === true;
        const consoleErrors = forcedStartedSurfaceFailure && options.startedSurfaceFailure === 'console-error' ? 1 : options.consoleErrors ?? 0;
        const revision = options.stagnantRevision ? 0 : sharedRevisions[scenarioIndex];
        const probeRevision = forcedStartedSurfaceFailure && options.startedSurfaceFailure === 'host-revision-missing' ? Number.NaN : revision;
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
          seatRects: Array.from({ length: (scenarioIndex === 0 ? 2 : 4) - 1 }, (_entry, index) => ({ x: 16 + index * 8, y: railY + 8, width: 120, height: 32, right: 136 + index * 8, bottom: railY + 40 })),
          boardRects: Array.from({ length: (scenarioIndex === 0 ? 2 : 4) - 1 }, (_entry, index) => ({ x: 16 + index * 8, y: boardY + 8, width: 120, height: 64, right: 136 + index * 8, bottom: boardY + 72 })),
          primaryAction: { rect: { x: 16, y: railY + 8, width: 120, height: 32, right: 136, bottom: railY + 40 }, enabled: true as const },
          panel: { x: 16, y: 16, width: Math.max(1, viewportWidth - 32), height: Math.min(panelHeight, viewportHeight - 20), right: viewportWidth - 16, bottom: 16 + Math.min(panelHeight, viewportHeight - 20) },
          scroll: { rect: { x: 8, y: railY, width: Math.max(1, viewportWidth - 16), height: railHeight, right: viewportWidth - 8, bottom: railY + railHeight }, scrollWidth: viewportWidth, scrollHeight: railHeight * 2, clientWidth: Math.max(1, viewportWidth - 16), clientHeight: railHeight, scrollMoved: geometryFailure !== 'non-scrollable', focusReachable: geometryFailure !== 'focus-inaccessible' },
          clippedPrimaryAction: geometryFailure === 'clipped-primary',
          railHandCollision: geometryFailure === 'vertical-collision',
          panelOutsideViewport: geometryFailure === 'offscreen-panel',
          scrollAccessible: geometryFailure !== 'inaccessible-scroll',
          battlefieldObscured: geometryFailure === 'obscured-battlefield',
        };
        return Promise.resolve({ gameScreens: gameScreenCount, overflow, geometry, revision: probeRevision, phase, winner: options.missingWinner !== true, outcomeVisible: options.missingWinner !== true, activeSeatCount: 3, eliminatedSeats: options.missingWinner === true ? [] : ['P2'], opponentLeak, leakScanComplete: options.leakScanBoundExceeded !== true, privateLookControl: true, chooseControl: true, manualStackControl: true, manualResolveControl: true, consoleErrors, workerObserved: options.missingWorker !== true } as T);
      }
      return Promise.resolve(true as T);
    },
    setViewport: (viewport) => { viewportWidth = viewport.width; viewportHeight = viewport.height; },
    close: () => Promise.resolve(),
    consoleCounts: () => ({
      errors: options.consoleErrors ?? (options.savedImportRuntimeError === true || (options.startedSurfaceFailure === 'console-error' && startClicks > 0) ? 1 : 0),
      warnings: options.consoleWarningContext === contextOrdinal || (options.consoleWarningReplacement === true && contextOrdinal === 0 && pageOrdinal > 0) ? 1 : options.consoleWarnings ?? 0,
      secretViolations: options.consoleSecretContext === contextOrdinal || (options.consoleSecretReplacement === true && contextOrdinal === 0 && pageOrdinal > 0) ? 1 : options.consoleSecretViolations ?? 0,
    }),
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
  it('keeps injected harness output separate from production attestation', async () => {
    const synthetic = await runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser([]), readDeck: () => 'fixture deck', timeoutMs: 250 });
    expect(synthetic.kind).toBe('o4p-09i-full-match-test-evidence-v1');
    await expect(runO4p09iFullMatchEvidenceProductionV1({ browser: fakeBrowser([]), readDeck: () => 'fixture deck', timeoutMs: 250 })).rejects.toThrow('production evidence does not accept injected seams');
  });

  it('provides four distinct non-sensitive 100-card public deck inputs', () => {
    expect(O4P09I_PUBLIC_DECK_TEXTS_V1).toHaveLength(4);
    const commanders = O4P09I_PUBLIC_DECK_TEXTS_V1.map((text) => text.match(/Commander\n1 ([^\n]+)/u)?.[1] ?? '');
    expect(commanders).toEqual(['Celes, Rune Knight', 'Gogo, Master of Mimicry', 'Kefka, Court Mage', 'Muldrotha, the Gravetide']);
    const lands = ['Plains', 'Island', 'Mountain', 'Forest'];
    const creatures = ['Mother of Runes', 'Omen Hawker', 'Ragavan, Nimble Pilferer', 'Spore Frog'];
    for (const [index, text] of O4P09I_PUBLIC_DECK_TEXTS_V1.entries()) {
      const main = text.match(/Deck\n(\d+) ([^\n]+)\n(\d+) ([^\n]+)/u);
      expect(main).not.toBeNull();
      expect(main?.[2]).toBe(lands[index]);
      expect(main?.[4]).toBe(creatures[index]);
      expect(Number(main?.[1]) + Number(main?.[3]) + 1).toBe(100);
    }
  });

  it('keeps the production timeout bounded above the 100-card import budget', () => {
    expect(O4P09I_DEFAULT_TIMEOUT_MS_V1).toBeGreaterThan(15_000);
    expect(O4P09I_DEFAULT_TIMEOUT_MS_V1).toBeLessThanOrEqual(120_000);
    expect(O4P09I_START_SURFACE_TIMEOUT_MS_V1).toBeGreaterThan(O4P09I_DEFAULT_TIMEOUT_MS_V1);
    expect(O4P09I_START_SURFACE_TIMEOUT_MS_V1).toBeLessThanOrEqual(120_000);
  });

  it.each([
    ['deck-input', 'production scenario stage failed: import'],
    ['import-button', 'production scenario stage failed: import'],
    ['deck-save-status', 'production scenario stage failed: import'],
    ['open-online-mode', 'production scenario stage failed: import'],
  ] as const)('classifies the %s import/open stage without exposing browser errors', async (missingControl, message) => {
    await expect(runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser([], { missingControl }), readDeck: () => 'fixture deck', timeoutMs: 250 })).rejects.toThrow(message);
  });

  it('classifies a visible deck storage error without exposing its page text', async () => {
    await expect(runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser([], { savedStateError: true }), readDeck: () => 'fixture deck', timeoutMs: 250 })).rejects.toThrow('production scenario stage failed: import');
  });

  it.each([
    [{ savedResolutionError: true }, 'production scenario stage failed: import'],
    [{ missingSaveNotification: true }, 'production scenario stage failed: import'],
    [{ savedResolutionPending: true }, 'production scenario stage failed: import'],
  ] as const)('classifies saved-state control failures without exposing page content', async (options, message) => {
    await expect(runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser([], options), readDeck: () => 'fixture deck', timeoutMs: 250 })).rejects.toThrow(message);
  });

  it.each([
    [{ savedImportRuntimeFailure: true }, 'production scenario stage failed: import'],
    [{ savedImportRuntimeError: true }, 'production scenario stage failed: import'],
  ] as const)('classifies import runtime failures without exposing browser details', async (options, message) => {
    await expect(runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser([], options), readDeck: () => 'fixture deck', timeoutMs: 250 })).rejects.toThrow(message);
  });

  it('accepts an already-online surface when the import remount completed earlier', async () => {
    const summary = await runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser([], { alreadyOnline: true }), readDeck: () => 'fixture deck', timeoutMs: 250 });
    expect(summary.scenarios.twoPlayer.playerCount).toBe(2);
  });

  it.each([
    [{ productErrorBoundary: true }, 'production scenario stage failed: import'],
    [{ importSurfaceDisappeared: true }, 'production scenario stage failed: import'],
    [{ invalidWorkflow: true }, 'production scenario stage failed: import'],
  ] as const)('classifies terminal app surfaces without exposing page content', async (options, message) => {
    await expect(runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser([], options), readDeck: () => 'fixture deck', timeoutMs: 250 })).rejects.toThrow(message);
  });

  it('accepts the visible Online entry after a fresh-create remount clears save status', async () => {
    const summary = await runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser([], { freshCreateRemount: true }), readDeck: () => 'fixture deck', timeoutMs: 250 });
    expect(summary.scenarios.twoPlayer.playerCount).toBe(2);
    expect(summary.scenarios.fourPlayer.playerCount).toBe(4);
  });

  it('runs an injected UI-only harness for both player-count scenarios', async () => {
    const expressions: string[] = [];
    const summary = await runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser(expressions), readDeck: () => 'fixture deck' });
    expect(summary.pagesOrigin).toBe(O4P09I_PAGES_ORIGIN_V1);
    expect(summary.workerOrigin).toBe(O4P09I_WORKER_ORIGIN_V1);
    expect(summary.scenarios.twoPlayer.playerCount).toBe(2);
    expect(summary.scenarios.twoPlayer.outcome).toBe('winner');
    expect(summary.scenarios.twoPlayer.revision.start).toBeGreaterThan(0);
    expect(summary.scenarios.twoPlayer.revision.start).toBeLessThanOrEqual(summary.scenarios.twoPlayer.revision.afterSharedMutation);
    expect(summary.scenarios.fourPlayer.playerCount).toBe(4);
    expect(summary.scenarios.fourPlayer.outcome).toBe('three-continue');
    expect(summary.scenarios.twoPlayer.eliminatedSeats).toHaveLength(1);
    expect(summary.scenarios.fourPlayer.eliminatedSeats).toHaveLength(1);
    for (const viewport of summary.scenarios.fourPlayer.viewportFacts) {
      expect(viewport.pageGeometries).toHaveLength(4);
      for (const pageGeometry of viewport.pageGeometries) {
        expect(pageGeometry.seatRects).toHaveLength(3);
        expect(pageGeometry.boardRects).toHaveLength(3);
      }
    }
    expect(expressions.some((expression) => expression.includes('document.querySelector'))).toBe(true);
    const firstDeckInput = expressions.findIndex((expression) => expression.includes('data-testid="deck-input"'));
    const firstImport = expressions.findIndex((expression) => expression.includes('data-testid="import-button"'));
    const firstSaved = expressions.findIndex((expression) => expression.includes('data-testid="deck-save-status"'));
    const firstOnline = expressions.findIndex((expression) => expression.includes('data-testid="open-online-mode"') && !expression.includes('savedDeckProbe'));
    expect(firstDeckInput).toBeGreaterThanOrEqual(0);
    expect(firstImport).toBeGreaterThan(firstDeckInput);
    expect(firstSaved).toBeGreaterThan(firstImport);
    expect(firstOnline).toBeGreaterThan(firstSaved);
    expect(expressions.some((expression) => expression.includes('applyCommand') || /\bdispatch\s*\(/u.test(expression) || /\bfetch\s*\(/u.test(expression))).toBe(false);
  });

  it('syntax-compiles every browser evaluate payload collected by the injected harness', async () => {
    const expressions: string[] = [];
    await runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser(expressions), readDeck: () => 'fixture deck' });
    for (const [index, expression] of expressions.entries()) {
      try {
        new Script(`(async () => { const argument = undefined; return (${expression}); })()`);
      } catch (error) {
        throw new Error(`browser evaluate payload ${index} is not valid JavaScript: ${error instanceof Error ? error.message : 'syntax error'}`, { cause: error });
      }
    }
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
    expect(validateO4p09iFullMatchEvidenceV1({
      ...summary,
      scenarios: {
        ...summary.scenarios,
        twoPlayer: { ...summary.scenarios.twoPlayer, revision: { ...summary.scenarios.twoPlayer.revision, start: summary.scenarios.twoPlayer.revision.afterSharedMutation + 1 } },
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
    ['private choice candidate leak beyond legacy scan bound', { privateChoiceCandidateLeakBeyondBound: true }],
    ['private choice scan bound exhaustion', { privateChoiceScanBoundExceeded: true }],
    ['authorized private capture bound exhaustion', { privateChoiceCaptureBoundExceeded: true }],
    ['private choice non-handle attribute/text token leak', { privateChoiceCandidateTokenLeak: true }],
    ['probe leak scan bound exhaustion', { leakScanBoundExceeded: true }],
    ['vertical geometry collision', { geometryFailure: 'vertical-collision' }],
    ['offscreen active panel', { geometryFailure: 'offscreen-panel' }],
    ['inaccessible scroll region', { geometryFailure: 'inaccessible-scroll' }],
    ['non-scrollable region', { geometryFailure: 'non-scrollable' }],
    ['focus-inaccessible region', { geometryFailure: 'focus-inaccessible' }],
    ['obscured battlefield', { geometryFailure: 'obscured-battlefield' }],
    ['clipped primary action', { geometryFailure: 'clipped-primary' }],
    ['console error', { consoleErrors: 1 }],
    ['console warning before reconnect', { consoleWarnings: 1 }],
    ['secret violation before reconnect', { consoleSecretViolations: 1 }],
    ['peer-only console warning before reconnect', { consoleWarningContext: 1 }],
    ['peer-only secret violation before reconnect', { consoleSecretContext: 1 }],
    ['replacement-only console warning', { consoleWarningReplacement: true }],
    ['replacement-only secret violation', { consoleSecretReplacement: true }],
  ] as const)('fails closed for %s', async (_label, options) => {
    const shortFailure = ('stagnantRevision' in options && options.stagnantRevision === true) || ('stagnantPhase' in options && options.stagnantPhase === true) || ('missingWinner' in options && options.missingWinner === true);
    await expect(runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser([], options), readDeck: () => 'fixture deck', timeoutMs: shortFailure ? 250 : undefined })).rejects.toThrow();
  });

  it.each([
    [{ missingControl: 'online-create-shared' }, 'production scenario stage failed: create-room'],
    [{ missingControl: 'online-remote-hold' }, 'production scenario stage failed: HOLD-pass-resolve'],
  ] as const)('reports only the finite scenario stage for a UI failure', async (options, message) => {
    await expect(runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser([], options), readDeck: () => 'fixture deck', timeoutMs: 250 })).rejects.toThrow(message);
  });

  it('waits for asynchronously rendered invite controls and values', async () => {
    const expressions: string[] = [];
    const summary = await runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser(expressions, { asyncInviteRender: true }), readDeck: () => 'fixture deck', timeoutMs: 250 });
    expect(summary.scenarios.twoPlayer.playerCount).toBe(2);
    expect(expressions.filter((expression) => expression.includes('コードを表示')).length).toBeGreaterThan(1);
    expect(expressions.filter((expression) => expression.includes('invite span')).length).toBeGreaterThan(1);
  });

  it('waits for the shared game surface after start before recording host revision', async () => {
    const expressions: string[] = [];
    const summary = await runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser(expressions, { asyncStartProbe: true }), readDeck: () => 'fixture deck', timeoutMs: 250 });
    expect(summary.scenarios.twoPlayer.revision.afterSharedMutation).toBeGreaterThan(0);
    const gameScreenProbes = expressions.filter((expression) => expression.includes('gameScreens'));
    expect(gameScreenProbes.length).toBeGreaterThan(4);
  });

  it.each([
    'game-screen-missing/count', 'horizontal-overflow', 'opponent-leak', 'console-error', 'host-revision-missing',
  ] as const)('reports only the bounded start-probe subreason: %s', async (reason) => {
    await expect(runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser([], { startedSurfaceFailure: reason }), readDeck: () => 'fixture deck', timeoutMs: 250 })).rejects.toThrow(`production scenario stage failed: start-probe/${reason}`);
  });

  it.each([
    'start-rejected', 'start-pending', 'start-not-accepted',
  ] as const)('classifies a missing game surface from visible start controls: %s', async (reason) => {
    await expect(runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser([], { startedSurfaceFailure: reason }), readDeck: () => 'fixture deck', timeoutMs: 250 })).rejects.toThrow(`production scenario stage failed: start-probe/${reason}`);
  });

  it('fails closed when the browser profile cannot be cleaned up', async () => {
    await expect(runO4p09iFullMatchEvidenceV1({ browser: fakeBrowser([], { closeFailure: true }), readDeck: () => 'fixture deck' })).rejects.toThrow('cleanup failed');
  });
});
