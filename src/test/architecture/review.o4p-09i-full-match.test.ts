import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../..');
const HARNESS = resolve(ROOT, 'scripts/online/o4p-09i-full-match-evidence.ts');
const TS_CONFIG = resolve(ROOT, 'scripts/online/tsconfig.json');
const PACKAGE = resolve(ROOT, 'package.json');
const BRIEF = resolve(ROOT, 'research/cr-grounding/o4p-09i-acceptance-brief.draft.md');
const CONTRACT = resolve(ROOT, 'scripts/journeys/contracts/o4p-09i-full-match.json');
const REGISTRY = resolve(ROOT, 'scripts/journeys/registry.json');
const CDP = resolve(ROOT, 'scripts/online/o4p-06f-four-browser-evidence.ts');

function text(path: string): string { return readFileSync(path, 'utf8'); }

function evaluatedPayloads(source: string): readonly string[] {
  return [...source.matchAll(/page\.evaluate(?:<[^>]+>)?\(`([\s\S]*?)`(?:\s*,|\s*\))/gu)]
    .map((match) => match[1] ?? '');
}

describe('review O4P-09I full-match production evidence', () => {
  it('registers only the bounded evidence harness and machine contract', () => {
    expect(existsSync(HARNESS)).toBe(true);
    expect(existsSync(BRIEF)).toBe(true);
    expect(existsSync(CONTRACT)).toBe(true);
    const registry = JSON.parse(text(REGISTRY)) as {
      journeys?: readonly { id?: unknown; designSource?: unknown; acceptanceSource?: unknown }[];
    };
    expect(registry.journeys?.find((entry) => entry.id === 'O4P-09I')).toMatchObject({
      designSource: 'scripts/journeys/contracts/o4p-09i-full-match.json',
      acceptanceSource: 'scripts/journeys/contracts/o4p-09i-full-match.json',
    });
    const packageJson = JSON.parse(text(PACKAGE)) as { scripts?: Record<string, unknown>; dependencies?: unknown; devDependencies?: unknown;
    };
    expect(packageJson.scripts?.['evidence:o4p-09i']).toBe('tsx scripts/online/o4p-09i-full-match-evidence.ts');
    const config = JSON.parse(text(TS_CONFIG)) as { include?: readonly string[] };
    expect(config.include).toContain('./o4p-09i-full-match-evidence.ts');
    const cdpSource = text(CDP);
    expect(cdpSource).toContain('const createPage = async');
    expect(cdpSource).not.toMatch(/\n\s+await this\.createAttachedPage\(browserContextId\);\n/u);
    expect(cdpSource).toContain('private async navigateRaw');
    expect(cdpSource).toContain('async navigateForUiEvidence(url: string): Promise<void>');
    expect(cdpSource).toContain('await this.navigateRaw(url);');
    expect(cdpSource).toContain('async navigate(url: string): Promise<void>');
    expect(cdpSource).toContain('await this.navigateBase(url);');
  });

  it('keeps production evidence UI-driven, secret-safe, and dependency-free', () => {
    const source = text(HARNESS);
    expect(source).toContain('Runtime.evaluate');
    expect(source).toContain('document.querySelector');
    expect(source).toContain('setViewport');
    expect(source).toContain('launchO4p06fCdpBrowserV1');
    expect(source).toContain('navigateForUiEvidence');
    expect(source).toContain('importDeckAndOpenOnline');
    expect(source).toContain("'deck-input'");
    expect(source).toContain('deck-save-status');
    expect(source).toContain("'open-online-mode'");
    expect(source).toContain('O4P09I_PUBLIC_DECK_TEXTS_V1');
    expect(source).toContain('O4P09I_START_SURFACE_TIMEOUT_MS_V1');
    expect(source).not.toContain('Mydeck/');
    expect(source).not.toContain('readFileSync');
    expect(source).toContain('runO4p09iFullMatchEvidenceTestDriverV1');
    expect(source).toContain('o4p-09i-full-match-test-evidence-v1');
    expect(source).toContain('production evidence does not accept injected seams');
    expect(source).toContain('drivePregamePhase');
    expect(source).toContain('pregameActorControlProbe');
    expect(source).toContain('pageGeometries');
    expect(source).toContain('seatRects');
    expect(source).toContain('boardRects');
    expect(source).toContain('recoveredProbes');
    expect(source).toContain('roomFingerprint');
    expect(source).toContain('MAX_DOM_SCAN_NODES_V1');
    expect(source).toContain('MAX_DOM_SCAN_ATTRIBUTES_V1');
    expect(source).toContain('MAX_DOM_SCAN_BYTES_V1');
    expect(source).toContain('MAX_RESOURCE_ENTRIES_V1');
    expect(source).toContain('leakScanComplete');
    expect(source).toContain('snapshotConsole');
    expect(source).toContain('consoleSnapshots');
    expect(source).toContain('lifetimeConsole');
    expect(source).toContain('initialRevision');
    expect(source).toContain('scrollMoved');
    expect(source).toContain('focusReachable');
    expect(source).toContain('MAX_PRIVATE_ROOTS_V1');
    expect(source).toContain('MAX_PRIVATE_ATTRIBUTES_PER_ROOT_V1');
    expect(source).toContain('MAX_PRIVATE_VALUES_PER_ROOT_V1');
    expect(source).toContain('MAX_PRIVATE_TOKENS_V1');
    expect(source).toContain('MAX_PRIVATE_CAPTURE_BYTES_V1');
    expect(source).toContain('private choice capture incomplete');
    const pollingStart = source.indexOf('async function waitForVisible');
    const pollingEnd = source.indexOf('type O4p09iActorProbeV1');
    const pollingSource = source.slice(pollingStart, pollingEnd);
    expect(pollingSource).toContain('for (;;)');
    expect(pollingSource).toContain('await page.evaluate<boolean>');
    expect(pollingSource).not.toContain('Promise.race');
    const advanceActorProbe = source.slice(
      source.indexOf('type O4p09iActorProbeV1'),
      source.indexOf('async function findAdvanceActorPage')
    );
    expect(advanceActorProbe).toContain('Promise.race');
    expect(source).toContain('advance actor authority ambiguous');
    expect(source).toContain('manual stack actor authority ambiguous');
    expect(source).toContain('manual resolve actor authority ambiguous');
    expect(source).toContain('probes.length !== pages.length');
    expect(source).toContain('probes.length === pages.length');
    const inviteControlPolling = source.slice(source.indexOf('async function clickButtonByText'), source.indexOf('async function fillVisible'));
    expect(inviteControlPolling).toContain('for (;;)');
    expect(inviteControlPolling).toContain('await page.evaluate<boolean>');
    const inviteValuePolling = source.slice(source.indexOf('async function readInvite'), source.indexOf('async function waitForRevisionAdvance'));
    expect(inviteValuePolling).toContain('for (;;)');
    expect(inviteValuePolling).toContain('await page.evaluate<string | null>');
    expect(inviteValuePolling).not.toContain('Promise.race');
    const startPolling = source.slice(source.indexOf('async function waitForStartedSurface'), source.indexOf('async function waitForSavedDeck'));
    expect(startPolling).toContain('for (;;)');
    expect(startPolling).toContain('await probePage');
    expect(startPolling).toContain('safeRevision(probe.revision)');
    expect(source).toContain('production UI stage failed: deck input');
    expect(source).toContain('production UI stage failed: deck storage unavailable');
    expect(source).toContain('production UI stage failed: deck resolution unavailable');
    expect(source).toContain('production UI stage failed: deck resolution pending');
    expect(source).toContain('production UI stage failed: deck save notification missing');
    expect(source).toContain('production UI stage failed: deck import runtime failed');
    expect(source).toContain('production UI stage failed: deck import runtime error');
    expect(source).toContain('production UI stage failed: product error boundary');
    expect(source).toContain('production UI stage failed: import surface disappeared');
    expect(source).toContain('production UI stage failed: invalid workflow state');
    expect(source).toContain('page.consoleCounts().errors');
    expect(source).toContain("workflow === 'empty' && importButtonVisible");
    expect(source).toContain('alreadyOnlineSurfaceProbe');
    expect(source).not.toContain('candidate: Element | null');
    expect(source).not.toContain('candidate is HTMLElement');
    expect(source).toContain('open-online-mode');
    expect(source).toContain('production UI stage failed: deck saved state');
    expect(source).toContain('production UI stage failed: online entry');
    expect(source).toContain('getBoundingClientRect');
    expect(source).toContain('workerObserved');
    expect(source).toContain('browser profile cleanup incomplete');
    expect(source).toContain('reconnect continuity probe failed');
    expect(source).toContain('visible action acknowledgement timeout');
    expect(source).toContain('waitForJourneyEvidence');
    expect(source).toContain('SCENARIO_STAGES');
    expect(source).toContain('production scenario stage failed: ${stage}');
    expect(source).toContain('production scenario stage failed: start-probe/${startedSurfaceFailureState.reason}');
    for (const reason of ['game-screen-missing/count', 'horizontal-overflow', 'opponent-leak', 'console-error', 'host-revision-missing'] as const) {
      expect(source).toContain(`'${reason}'`);
    }
    for (const reason of ['start-rejected', 'start-pending', 'start-not-accepted'] as const) {
      expect(source).toContain(`'${reason}'`);
    }
    expect(source).toContain('startedSurfaceTerminalProbe');
    expect(source).toContain('online-error');
    for (const stage of ['import', 'lobby-probe', 'create-room', 'reveal-invite', 'read-invite', 'host-deck-submit', 'host-ready', 'join-seat-import', 'join-seat-join', 'join-seat-deck', 'join-seat-ready', 'start-game', 'pregame-control', 'advance', 'land', 'cast', 'HOLD-pass-resolve', 'attacker', 'manual-damage', 'manual-stack', 'visibility', 'private-leak-check', 'post-actions', 'viewport-geometry', 'reconnect'] as const) {
      expect(source).toContain(`'${stage}'`);
    }
    expect(source).toContain('advanceUntilPhase');
    expect(source).toContain('phase-indicator');
    expect(source).toContain('online-pregame-revision');
    expect(source).toContain("advanceUntilPhase(pages, 'main1'");
    expect(source).toContain("advanceUntilPhase(pages, 'combat'");
    expect(source).toContain('targetCount === snapshots.length && matchingRevision');
    expect(source).toContain('privateLookControl');
    expect(source).toContain('manualStackControl');
    expect(source).toContain('invite read timeout');
    expect(source).toContain('online-remote-hold');
    expect(source).toContain('online-manual-damage-submit');
    expect(source).toContain('visibility-look');
    expect(source).toContain('online-tabletop-submit-manual-resolve');
    expect(source).toContain('disconnect/reconnect');
    expect(source).toContain('containsSecret');
    expect(source).toContain('profileRemoved');
    expect(source).toContain('readPrivateChoicePayload');
    expect(source).toContain('privateChoicePayload');
    expect(source).toContain('candidateHandles');
    expect(source).toContain('readUnauthorizedDomSurfaces');
    expect(source).toContain('cross-seat private choice leak');
    expect(source).toContain('railHandCollision');
    expect(source).toContain('panelOutsideViewport');
    expect(source).toContain('scrollAccessible');
    expect(source).toContain('battlefieldObscured');
    expect(source).not.toMatch(/from ['"](?:playwright|@playwright\/test|puppeteer|ws)['"]/u);
    expect(source).not.toMatch(/Promise\.all\(VIEWPORTS\.map/u);
  });

  it('keeps every Runtime.evaluate payload pure browser JavaScript', () => {
    const payloads = evaluatedPayloads(text(HARNESS));
    expect(payloads.length).toBeGreaterThan(10);
    for (const payload of payloads) {
      expect(payload).not.toMatch(/\bas\s+(?:const|[A-Z][A-Za-z0-9_$.[\]<>| ]*)/u);
      expect(payload).not.toMatch(/\([A-Za-z_$][A-Za-z0-9_$]*\s*:\s*(?:string|number|boolean|Element|HTMLElement|typeof|[A-Z])/u);
      expect(payload).not.toMatch(/\)\s*:\s*(?:string|number|boolean|Element|HTMLElement|typeof|[A-Z])/u);
      expect(payload).not.toMatch(/\bis\s+[A-Za-z_$][A-Za-z0-9_$]*/u);
    }
  });

  it('pins one shared surface, responsive matrix, and truthful manual boundaries', () => {
    const source = text(HARNESS);
    expect(source.match(/gameScreens/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(source).toContain('horizontalOverflow');
    expect(source).toContain('375');
    expect(source).toContain('812');
    expect(source).toContain('1440');
    expect(source).toContain('unsupportedManual');
    expect(source).toContain('privateLookChoose');
    expect(source).toContain('geometry');
    expect(source).toContain('primaryAction');
    expect(source.indexOf("'online-guided-declare-attacker'")).toBeLessThan(source.indexOf("'online-manual-damage-submit'"));
    expect(source).toContain("manualDamageCount === 0 ? '1' : '120'");
    const confirmIndex = source.indexOf("await clickVisible(hostPage, 'visibility-confirm'");
    const privateChoiceIndex = source.indexOf('const privateChoicePayload = await readPrivateChoicePayload');
    const sequenceStart = source.indexOf('const UI_SEQUENCE');
    const sequenceEnd = source.indexOf('] as const', sequenceStart);
    const chooseSequenceIndex = source.lastIndexOf("'visibility-look'", sequenceEnd);
    const finalDamageSequenceIndex = source.lastIndexOf("'online-manual-damage-submit'", sequenceEnd);
    expect(confirmIndex).toBeGreaterThan(-1);
    expect(privateChoiceIndex).toBeGreaterThan(confirmIndex);
    expect(chooseSequenceIndex).toBeGreaterThan(sequenceStart);
    expect(finalDamageSequenceIndex).toBeGreaterThan(chooseSequenceIndex);
  });
});
