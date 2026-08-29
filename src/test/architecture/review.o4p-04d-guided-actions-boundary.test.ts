import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const BASE_SHA = '1f6a465b859ba64c9961c6fcdae80087e33b9882';
const HISTORICAL_SCOPE_SHA = '04dd0575388d3aa5a09f63ef6123f67b63933fe3';

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
  return execFileSync('git', ['diff', '--name-only', BASE_SHA, HISTORICAL_SCOPE_SHA, '--'], { cwd: ROOT, encoding: 'utf8' })
    .split(/\r?\n/).filter(Boolean);
}

describe('O4P-04D Guided/Manual Actions architecture boundary', () => {
  it('uses only four public barrels in the pure boundary and no ambient effects', () => {
    const files = filesBelow('src/online/guidedActions')
      .filter((path) => ['.ts', '.tsx'].includes(extname(path)))
      .filter((path) => !path.includes('__tests__'));
    expect(files.map((path) => relative(ROOT, path)).sort()).toEqual([
      'src/online/guidedActions/errors.ts',
      'src/online/guidedActions/index.ts',
      'src/online/guidedActions/model.ts',
      'src/online/guidedActions/types.ts',
    ]);
    const text = files.map((path) => readFileSync(path, 'utf8')).join('\n');
    for (const publicImport of [
      '../projection/index', '../protocol/index', '../displayPairing/index',
      '../../engine/core/index',
    ]) expect(text).toContain(publicImport);
    expect(text).not.toMatch(/from ['"][^'"]*(?:room|cloudflare|headless|store|components|engine\/(?!core\/index)|projection\/(?!index)|protocol\/(?!index)|displayPairing\/(?!index))/i);
    expect(text).not.toMatch(/\b(fetch|WebSocket|localStorage|sessionStorage|indexedDB|setTimeout|setInterval|Date\.now|Math\.random|console\.)\b/);
    expect(text).not.toMatch(/\b(React|document|window|HTMLElement)\b/);
  });

  it('keeps React on the public guided barrel and pairing on exact successor composition', () => {
    const component = source('src/components/online/OnlineGuidedActions.tsx');
    const pairing = source('src/components/online/OnlineDisplayPairing.tsx');
    const css = source('src/components/online/onlineGuidedActions.css');
    expect(component).toMatch(/online\/guidedActions\/index/);
    expect(pairing).toMatch(/\.\/OnlineGuidedActions/);
    expect(pairing).toMatch(/onGuidedAction/);
    expect(`${component}\n${pairing}\n${css}`).not.toMatch(/components\/game|gameStore|src\/store|online\/(?:cloudflare|protocol|projection|room|headless)|engine\/core/i);
    expect(`${component}\n${pairing}\n${css}`).not.toMatch(/\b(fetch|WebSocket|localStorage|sessionStorage|indexedDB|setTimeout|setInterval)\b/);
  });

  it('keeps integration dev-only and constrains every base-relative candidate path', () => {
    expect(source('research/design/display-pairing/index.html')).toContain('/src/dev/displayPairing/main.tsx');
    expect(filesBelow('src/dev/displayPairing').map((path) => relative(ROOT, path)).sort()).toEqual([
      'src/dev/displayPairing/displayPairing.css',
      'src/dev/displayPairing/main.tsx',
    ]);
    expect(source('src/dev/displayPairing/main.tsx')).not.toMatch(
      /\b(fetch|WebSocket|localStorage|sessionStorage|indexedDB|setTimeout|setInterval|Date\.now|Math\.random|console\.)\b/,
    );
    expect(source('src/App.tsx')).not.toMatch(/OnlineGuidedActions|guidedActions/);
    expect(source('src/main.tsx')).not.toMatch(/OnlineGuidedActions|guidedActions/);
    expect(() => statSync(join(ROOT, 'src/online/index.ts'))).toThrow();

    const allowed = [
      /^package\.json$/,
      /^tsconfig\.node\.json$/,
      /^docs\/contracts\/manifest\.json$/,
      /^scripts\/checks\/verify-online-cloudflare-production-gate\.ts$/,
      /^scripts\/(?:__tests__\/machine-checks\.test\.mjs|checks\/(?:machine-checks\.mjs|verify-o4p-(?:05c-release-gates|05d-production-release-closure)\.ts))$/,
      /^research\/cr-grounding\/o4p-04d-[a-z0-9-]+(?:\.contract)?\.draft\.md$/,
      /^research\/cr-grounding\/archive\/o4p-04d-cold-audit-record-2026-08-14\.md$/,
      /^research\/cr-grounding\/o4p-05a-(?:acceptance-brief|ci-reauthorization|ci-reauthorization-audit-brief|cold-audit-brief|implementation-brief|public-release-ruleset\.contract)\.draft\.md$/,
      /^research\/cr-grounding\/archive\/o4p-05a-cold-audit-record-2026-08-15\.md$/,
      /^research\/cr-grounding\/o4p-05b-(?:acceptance-brief|cold-audit-brief|four-player-release-scenario\.contract|implementation-brief|judge-surgery-1)\.draft\.md$/,
      /^research\/cr-grounding\/archive\/o4p-05b-cold-audit-record-2026-08-15\.md$/,
      /^research\/cr-grounding\/o4p-05c-(?:acceptance-brief|ci-reauthorization|cold-audit-brief|full-check-repair-1|implementation-brief|judge-surgery-1|release-gates\.contract)\.draft\.md$/,
      /^research\/cr-grounding\/archive\/o4p-05c-cold-audit-record-2026-08-15\.md$/,
      /^research\/cr-grounding\/o4p-05d-[a-z0-9-]+(?:\.contract)?\.draft\.md$/,
      /^research\/cr-grounding\/archive\/o4p-05d-cold-audit-record-2026-08-15\.md$/,
      /^research\/cr-grounding\/o4p-06-playable-four-player-roadmap\.contract\.draft\.md$/,
      /^research\/cr-grounding\/o4p-06-roadmap-ledger-update\.draft\.json$/,
      /^research\/cr-grounding\/o4p-06-roadmap-registration-(?:acceptance|cold-audit-brief|predecessor-gate-repair-1|full-check-repair-1)\.draft\.md$/,
      /^research\/cr-grounding\/planned-sequence-batch-o4p-06\.draft\.md$/,
      /^research\/cr-grounding\/archive\/o4p-06-roadmap-registration-cold-audit-2026-08-15\.md$/,
      /^research\/cr-grounding\/cr-backbone-ledger(?:-history)?\.json$/,
      /^research\/design\/display-pairing\/index\.html$/,
      /^src\/components\/online\/OnlineDisplayPairing\.tsx$/,
      /^src\/components\/online\/OnlineGuidedActions\.tsx$/,
      /^src\/components\/online\/onlineGuidedActions\.css$/,
      /^src\/components\/online\/__tests__\/(?:review\.o4p-04d-guided-actions|OnlineDisplayPairing|OnlineGuidedActions)\.test\.tsx$/,
      /^src\/components\/online\/__tests__\/review\.o4p-04c-display-pairing\.test\.tsx$/,
      /^src\/dev\/displayPairing\/(?:displayPairing\.css|main\.tsx)$/,
      /^src\/online\/guidedActions\//,
      /^src\/online\/headless\/__tests__\/review\.o4p-05b-four-player-release-scenario\.test\.ts$/,
      /^src\/online\/cloudflare\/__tests__\/(?:releaseGateEvidenceV1(?:\.test)?\.ts|review\.o4p-05c-release-gates\.test\.ts)$/,
      /^src\/versioning\/(?:index|publicReleaseRuleset(?:\.test)?|review\.o4p-05a-public-release-ruleset\.test)\.ts$/,
      /^src\/online\/cloudflare\/__tests__\/review\.o4p-03d-cloudflare-production-gate\.test\.ts$/,
      /^src\/test\/architecture\/(?:o4p01iStackAnnouncementBoundary|modeNeutralCoreBoundary|review\.o4p-01h-core-boundary|review\.o4p-02d-audience-projection-boundary|review\.o4p-02e-local-room-gate-boundary|soloOnlineBoundary)\.test\.ts$/,
      /^src\/test\/architecture\/review\.o4p-04b-table-display-boundary\.test\.ts$/,
      /^src\/test\/architecture\/review\.o4p-04[cd]-(?:display-pairing|guided-actions)-boundary\.test\.ts$/,
      /^src\/test\/architecture\/review\.o4p-05c-release-gates\.test\.ts$/,
      /^src\/test\/architecture\/review\.o4p-05d-production-release-closure\.test\.ts$/,
      /^src\/test\/architecture\/review\.o4p-06-roadmap-registration\.test\.ts$/,
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
    expect(changedScripts).toContain('check:release');
    expect(packageAfter.scripts?.['check:release']).toBe('node scripts/checks/release-check.mjs');
    expect(packageAfter.scripts?.['evidence:o4p-06f']).toBe('tsx scripts/online/o4p-06f-four-browser-evidence.ts');
    expect(packageAfter.scripts?.['verify:o4p-07c-production-runtime']).toBe('tsx scripts/checks/verify-o4p-07c-production-runtime.ts');
  });

  it('registers only guidedActions and preserves responsive/manual boundaries', () => {
    for (const path of [
      'src/test/architecture/o4p01iStackAnnouncementBoundary.test.ts',
      'src/test/architecture/review.o4p-02d-audience-projection-boundary.test.ts',
      'src/test/architecture/review.o4p-02e-local-room-gate-boundary.test.ts',
    ]) expect(source(path)).toContain('guidedActions');
    for (const path of [
      'src/test/architecture/review.o4p-01h-core-boundary.test.ts',
      'src/test/architecture/soloOnlineBoundary.test.ts',
    ]) expect(source(path)).toMatch(/OnlineGuidedActions\.tsx[\s\S]*online\/guidedActions\/index/);

    const component = source('src/components/online/OnlineGuidedActions.tsx');
    const css = source('src/components/online/onlineGuidedActions.css');
    expect(component.match(/data-testid="online-guided-actions"/g)).toHaveLength(1);
    expect(component).toContain('手動記録（未送信）');
    expect(css).toMatch(/@media[^{]*max-width:\s*600px/s);
    expect(css).toMatch(/button:focus-visible/);
    expect(css).toMatch(/var\(--(?:surface|text|line|space|radius|shadow|accent|gold)/);
    expect(css).not.toMatch(/position:\s*fixed|https?:\/\//);
  });
});
