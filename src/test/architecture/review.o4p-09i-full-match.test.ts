import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../..');
const HARNESS = resolve(ROOT, 'scripts/online/o4p-09i-full-match-evidence.ts');
const TS_CONFIG = resolve(ROOT, 'scripts/online/tsconfig.json');
const PACKAGE = resolve(ROOT, 'package.json');
const BRIEF = resolve(ROOT, 'research/cr-grounding/o4p-09i-acceptance-brief.draft.md');
const CDP = resolve(ROOT, 'scripts/online/o4p-06f-four-browser-evidence.ts');

function text(path: string): string { return readFileSync(path, 'utf8'); }

describe('review O4P-09I full-match production evidence', () => {
  it('registers only the bounded evidence harness and acceptance brief', () => {
    expect(existsSync(HARNESS)).toBe(true);
    expect(existsSync(BRIEF)).toBe(true);
    const packageJson = JSON.parse(text(PACKAGE)) as { scripts?: Record<string, unknown>; dependencies?: unknown; devDependencies?: unknown };
    expect(packageJson.scripts?.['evidence:o4p-09i']).toBe('tsx scripts/online/o4p-09i-full-match-evidence.ts');
    const config = JSON.parse(text(TS_CONFIG)) as { include?: readonly string[] };
    expect(config.include).toContain('./o4p-09i-full-match-evidence.ts');
    const cdpSource = text(CDP);
    expect(cdpSource).toContain('const createPage = async');
    expect(cdpSource).not.toMatch(/\n\s+await this\.createAttachedPage\(browserContextId\);\n/u);
  });

  it('keeps production evidence UI-driven, secret-safe, and dependency-free', () => {
    const source = text(HARNESS);
    expect(source).toContain('Runtime.evaluate');
    expect(source).toContain('document.querySelector');
    expect(source).toContain('setViewport');
    expect(source).toContain('launchO4p06fCdpBrowserV1');
    expect(source).toContain('navigateForUiEvidence');
    expect(source).toContain('getBoundingClientRect');
    expect(source).toContain('workerObserved');
    expect(source).toContain('browser profile cleanup incomplete');
    expect(source).toContain('reconnect continuity probe failed');
    expect(source).toContain('visible action acknowledgement timeout');
    expect(source).toContain('waitForJourneyEvidence');
    expect(source).toContain('advanceUntilPhase');
    expect(source).toContain('phase-indicator');
    expect(source).toContain("advanceUntilPhase(hostPage, 'main1'");
    expect(source).toContain("advanceUntilPhase(hostPage, 'combat'");
    expect(source).toContain('privateLookControl');
    expect(source).toContain('manualStackControl');
    expect(source).toContain('visible invite');
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
