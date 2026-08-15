import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const BASE_SHA = '4b2f4ac534c489ce92d2f3dfce4774679c597502';

function filesBelow(path: string): string[] {
  const absolute = join(ROOT, path);
  const output: string[] = [];
  for (const name of readdirSync(absolute)) {
    const candidate = join(absolute, name);
    if (statSync(candidate).isDirectory()) output.push(...filesBelow(relative(ROOT, candidate)));
    else output.push(candidate);
  }
  return output;
}

function source(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8');
}

function candidatePaths(): string[] {
  const tracked = execFileSync('git', ['diff', '--name-only', BASE_SHA, '--'], { cwd: ROOT, encoding: 'utf8' })
    .split(/\r?\n/).filter(Boolean);
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' })
    .split(/\r?\n/).filter(Boolean);
  return [...new Set([...tracked, ...untracked])].sort();
}

describe('O4P-04C Display Pairing architecture boundary', () => {
  it('keeps the pure pairing boundary on five public barrels without ambient/browser effects', () => {
    const files = filesBelow('src/online/displayPairing')
      .filter((path) => extname(path) === '.ts')
      .filter((path) => !path.includes('__tests__'));
    const text = files.map((path) => readFileSync(path, 'utf8')).join('\n');
    expect(files.length).toBeGreaterThan(1);
    for (const publicImport of [
      '../projection/index', '../workbench/index', '../tableDisplay/index',
      '../protocol/index', '../../engine/core/index',
    ]) expect(text).toContain(publicImport);
    expect(text).not.toMatch(/from ['"][^'"]*(?:room\/(?!index)|cloudflare|headless|store|components|engine\/(?!core\/index)|projection\/(?!index)|workbench\/(?!index)|tableDisplay\/(?!index)|protocol\/(?!index))/i);
    expect(text).not.toMatch(/\b(fetch|WebSocket|localStorage|sessionStorage|indexedDB|setTimeout|setInterval|Date\.now|Math\.random|console\.)\b/);
    expect(text).not.toMatch(/\b(React|document|window|HTMLElement)\b/);
  });

  it('allows only exact React composition and no transport, Store, Solo, or Core access', () => {
    const component = source('src/components/online/OnlineDisplayPairing.tsx');
    const css = source('src/components/online/onlineDisplayPairing.css');
    expect(component).toMatch(/online\/displayPairing\/index/);
    expect(component).toMatch(/\.\/PersonalWorkbench/);
    expect(component).toMatch(/\.\/TableDisplay/);
    expect(`${component}\n${css}`).not.toMatch(/components\/game|gameStore|src\/store|online\/(?:cloudflare|protocol|projection|room|headless)|engine\/core/i);
    expect(`${component}\n${css}`).not.toMatch(/\b(fetch|WebSocket|localStorage|sessionStorage|indexedDB|setTimeout|setInterval)\b/);
  });

  it('keeps integration dev-only and constrains every base-relative candidate path', () => {
    expect(source('research/design/display-pairing/index.html')).toContain('/src/dev/displayPairing/main.tsx');
    expect(source('src/App.tsx')).not.toMatch(/OnlineDisplayPairing|displayPairing/);
    expect(source('src/main.tsx')).not.toMatch(/OnlineDisplayPairing|displayPairing/);
    expect(() => statSync(join(ROOT, 'src/online/index.ts'))).toThrow();

    const allowed = [
      /^package\.json$/,
      /^tsconfig\.node\.json$/,
      /^scripts\/checks\/verify-online-cloudflare-production-gate\.ts$/,
      /^scripts\/(?:__tests__\/machine-checks\.test\.mjs|checks\/(?:machine-checks\.mjs|verify-o4p-05c-release-gates\.ts))$/,
      /^docs\/contracts\/manifest\.json$/,
      /^research\/cr-grounding\/o4p-04c-[a-z0-9-]+(?:\.contract)?\.draft\.md$/,
      /^research\/cr-grounding\/o4p-04d-[a-z0-9-]+(?:\.contract)?\.draft\.md$/,
      /^research\/cr-grounding\/archive\/o4p-04c-cold-audit-record-2026-08-14\.md$/,
      /^research\/cr-grounding\/archive\/o4p-04d-cold-audit-record-2026-08-14\.md$/,
      /^research\/cr-grounding\/o4p-05a-(?:acceptance-brief|ci-reauthorization|ci-reauthorization-audit-brief|cold-audit-brief|implementation-brief|public-release-ruleset\.contract)\.draft\.md$/,
      /^research\/cr-grounding\/archive\/o4p-05a-cold-audit-record-2026-08-15\.md$/,
      /^research\/cr-grounding\/o4p-05b-(?:acceptance-brief|cold-audit-brief|four-player-release-scenario\.contract|implementation-brief|judge-surgery-1)\.draft\.md$/,
      /^research\/cr-grounding\/archive\/o4p-05b-cold-audit-record-2026-08-15\.md$/,
      /^research\/cr-grounding\/o4p-05c-(?:acceptance-brief|ci-reauthorization|cold-audit-brief|full-check-repair-1|implementation-brief|judge-surgery-1|release-gates\.contract)\.draft\.md$/,
      /^research\/cr-grounding\/archive\/o4p-05c-cold-audit-record-2026-08-15\.md$/,
      /^research\/cr-grounding\/cr-backbone-ledger(?:-history)?\.json$/,
      /^research\/design\/display-pairing\/index\.html$/,
      /^src\/components\/online\/OnlineDisplayPairing\.tsx$/,
      /^src\/components\/online\/OnlineGuidedActions\.tsx$/,
      /^src\/components\/online\/onlineDisplayPairing\.css$/,
      /^src\/components\/online\/onlineGuidedActions\.css$/,
      /^src\/components\/online\/__tests__\/(?:review\.o4p-04[cd]-(?:display-pairing|guided-actions)|OnlineDisplayPairing|OnlineGuidedActions)\.test\.tsx$/,
      /^src\/dev\/displayPairing\//,
      /^src\/online\/displayPairing\//,
      /^src\/online\/guidedActions\//,
      /^src\/online\/headless\/__tests__\/review\.o4p-05b-four-player-release-scenario\.test\.ts$/,
      /^src\/online\/cloudflare\/__tests__\/(?:releaseGateEvidenceV1(?:\.test)?\.ts|review\.o4p-05c-release-gates\.test\.ts)$/,
      /^src\/versioning\/(?:index|publicReleaseRuleset(?:\.test)?|review\.o4p-05a-public-release-ruleset\.test)\.ts$/,
      /^src\/online\/cloudflare\/__tests__\/review\.o4p-03d-cloudflare-production-gate\.test\.ts$/,
      /^src\/test\/architecture\/(?:o4p01iStackAnnouncementBoundary|review\.o4p-01h-core-boundary|review\.o4p-02d-audience-projection-boundary|review\.o4p-02e-local-room-gate-boundary|soloOnlineBoundary)\.test\.ts$/,
      /^src\/test\/architecture\/(?:modeNeutralCoreBoundary|review\.o4p-04b-table-display-boundary)\.test\.ts$/,
      /^src\/test\/architecture\/review\.o4p-04c-display-pairing-boundary\.test\.ts$/,
      /^src\/test\/architecture\/review\.o4p-04d-guided-actions-boundary\.test\.ts$/,
      /^src\/test\/architecture\/review\.o4p-05c-release-gates\.test\.ts$/,
    ];
    expect(candidatePaths().filter((path) => !allowed.some((pattern) => pattern.test(path)))).toEqual([]);
    expect(candidatePaths()).not.toEqual(expect.arrayContaining([
      'package-lock.json', 'vite.config.ts', 'src/version.ts',
      'src/App.tsx', 'src/main.tsx', 'src/online/projection/index.ts',
      'src/online/protocol/index.ts', 'src/online/cloudflare/index.ts',
    ]));
    const packageBefore = JSON.parse(execFileSync('git', ['show', `${BASE_SHA}:package.json`], { cwd: ROOT, encoding: 'utf8' })) as { dependencies?: unknown; devDependencies?: unknown; scripts?: Record<string, unknown> };
    const packageAfter = JSON.parse(source('package.json')) as { dependencies?: unknown; devDependencies?: unknown; scripts?: Record<string, unknown> };
    expect(packageAfter.dependencies).toEqual(packageBefore.dependencies);
    expect(packageAfter.devDependencies).toEqual(packageBefore.devDependencies);
    const changedScripts = [...new Set([...Object.keys(packageBefore.scripts ?? {}), ...Object.keys(packageAfter.scripts ?? {})])]
      .filter((key) => packageBefore.scripts?.[key] !== packageAfter.scripts?.[key])
      .sort();
    expect(changedScripts).toEqual(['verify:o4p-05c-release-gates']);
    expect(packageAfter.scripts?.['verify:o4p-05c-release-gates']).toBe('tsx scripts/checks/verify-o4p-05c-release-gates.ts');
  });

  it('registers only the exact new Online root/import and preserves responsive boundaries', () => {
    for (const path of [
      'src/test/architecture/o4p01iStackAnnouncementBoundary.test.ts',
      'src/test/architecture/review.o4p-02d-audience-projection-boundary.test.ts',
      'src/test/architecture/review.o4p-02e-local-room-gate-boundary.test.ts',
    ]) expect(source(path)).toContain('displayPairing');
    for (const path of [
      'src/test/architecture/review.o4p-01h-core-boundary.test.ts',
      'src/test/architecture/soloOnlineBoundary.test.ts',
    ]) {
      expect(source(path)).toMatch(/OnlineDisplayPairing\.tsx[\s\S]*online\/displayPairing\/index/);
      expect(source(path)).toMatch(/OnlineDisplayPairing\.tsx[\s\S]*online\/workbench\/index/);
    }
    const css = source('src/components/online/onlineDisplayPairing.css');
    expect(source('src/components/online/OnlineDisplayPairing.tsx').match(/data-testid="online-display-pairing"/g)).toHaveLength(1);
    expect(css).toMatch(/@media[^{]*max-width:\s*600px/s);
    expect(css).toMatch(/@media[^{]*max-height:\s*500px/s);
    expect(css).toMatch(/var\(--(?:surface|text|line|space|radius|shadow|accent|gold)/);
    expect(css).toMatch(/button:focus-visible/);
    expect(css).not.toMatch(/position:\s*fixed|https?:\/\//);
  });
});
