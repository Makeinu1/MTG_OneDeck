import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const BASE_SHA = '36237478838695e4cb1753bafaba0bc1aa4fa8f4';

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
  const tracked = execFileSync('git', ['diff', '--name-only', BASE_SHA, '--'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).split(/\r?\n/).filter(Boolean);
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).split(/\r?\n/).filter(Boolean);
  return [...new Set([...tracked, ...untracked])].sort();
}

describe('O4P-04B Table Display architecture boundary', () => {
  it('keeps the pure model on the projection barrel and free of UI, state, transport, and ambient effects', () => {
    const files = filesBelow('src/online/tableDisplay')
      .filter((path) => ['.ts', '.tsx'].includes(extname(path)))
      .filter((path) => !path.includes('__tests__'));
    const text = files.map((path) => readFileSync(path, 'utf8')).join('\n');

    expect(files.length).toBeGreaterThan(1);
    expect(text).toMatch(/from ['"]\.\.\/projection\/index['"]/);
    expect(text).not.toMatch(/from ['"][^'"]*(engine|store|components|workbench|room|protocol|headless|cloudflare)/i);
    expect(text).not.toMatch(/\b(fetch|WebSocket|localStorage|sessionStorage|indexedDB|Date\.now|Math\.random|console\.)\b/);
    expect(text).not.toMatch(/\b(React|document|window|HTMLElement)\b/);
  });

  it('keeps React on the public Table Display barrel and does not couple production UI to other application layers', () => {
    const component = source('src/components/online/TableDisplay.tsx');
    const css = source('src/components/online/tableDisplay.css');
    const text = `${component}\n${css}`;

    expect(component).toMatch(/online\/tableDisplay\/index/);
    expect(text).not.toMatch(/components\/game|gameStore|src\/store|online\/(workbench|cloudflare|protocol|room|headless)|engine\/core/i);
    expect(text).not.toMatch(/\b(fetch|WebSocket|localStorage|sessionStorage|indexedDB)\b/);
    expect(component).not.toMatch(/onAction|onClick|onDoubleClick|draggable=|<button|<form|<input|<select|<textarea/);
  });

  it('provides only a dev fixture entry and leaves existing production entry points untouched', () => {
    expect(source('research/design/table-display/index.html'))
      .toContain('/src/dev/tableDisplay/main.tsx');
    expect(source('src/App.tsx')).not.toMatch(/TableDisplay|tableDisplay/);
    expect(source('src/main.tsx')).not.toMatch(/TableDisplay|tableDisplay/);
    expect(source('src/online/tableDisplay/fixtures/o4p-04b-table-display-v1.json'))
      .toContain('"role": "table"');
    expect(() => statSync(join(ROOT, 'src/online/index.ts'))).toThrow();
  });

  it('rejects reverse production reachability and base-relative scope drift', () => {
    const otherProduction = filesBelow('src')
      .filter((path) => ['.ts', '.tsx'].includes(extname(path)))
      .filter((path) => !path.includes('__tests__'))
      .filter((path) => !/\.test\.[^.]+$/.test(path))
      .filter((path) => !path.includes('/dev/'))
      .filter((path) => !path.includes('/online/tableDisplay/'))
      .filter((path) => !path.includes('/online/displayPairing/'))
      .filter((path) => !path.endsWith('/components/online/TableDisplay.tsx'))
      .filter((path) => !path.endsWith('/components/online/OnlineDisplayPairing.tsx'));
    const reverseText = otherProduction
      .map((path) => `${relative(ROOT, path)}\n${readFileSync(path, 'utf8')}`)
      .join('\n');
    expect(reverseText).not.toMatch(/online\/tableDisplay|o4p-04b-table-display-v1|\bTableDisplay\b/);

    const allowed = [
      /^scripts\/checks\/verify-online-cloudflare-production-gate\.ts$/,
      /^docs\/contracts\/manifest\.json$/,
      /^research\/cr-grounding\/o4p-04b-[a-z0-9-]+(?:\.contract)?\.draft\.md$/,
      /^research\/cr-grounding\/archive\/o4p-04b-cold-audit-record-2026-08-14\.md$/,
      /^research\/cr-grounding\/o4p-04c-[a-z0-9-]+(?:\.contract)?\.draft\.md$/,
      /^research\/cr-grounding\/archive\/o4p-04c-cold-audit-record-2026-08-14\.md$/,
      /^research\/cr-grounding\/o4p-04d-[a-z0-9-]+(?:\.contract)?\.draft\.md$/,
      /^research\/cr-grounding\/archive\/o4p-04d-cold-audit-record-2026-08-14\.md$/,
      /^research\/cr-grounding\/o4p-05a-(?:acceptance-brief|ci-reauthorization|ci-reauthorization-audit-brief|cold-audit-brief|implementation-brief|public-release-ruleset\.contract)\.draft\.md$/,
      /^research\/cr-grounding\/archive\/o4p-05a-cold-audit-record-2026-08-15\.md$/,
      /^research\/cr-grounding\/o4p-05b-(?:acceptance-brief|cold-audit-brief|four-player-release-scenario\.contract|implementation-brief|judge-surgery-1)\.draft\.md$/,
      /^research\/cr-grounding\/archive\/o4p-05b-cold-audit-record-2026-08-15\.md$/,
      /^research\/cr-grounding\/cr-backbone-ledger(?:-history)?\.json$/,
      /^research\/design\/table-display\/index\.html$/,
      /^research\/design\/display-pairing\/index\.html$/,
      /^src\/components\/online\/TableDisplay\.tsx$/,
      /^src\/components\/online\/tableDisplay\.css$/,
      /^src\/components\/online\/OnlineDisplayPairing\.tsx$/,
      /^src\/components\/online\/OnlineGuidedActions\.tsx$/,
      /^src\/components\/online\/onlineDisplayPairing\.css$/,
      /^src\/components\/online\/onlineGuidedActions\.css$/,
      /^src\/components\/online\/__tests__\/(?:review\.o4p-04b-table-display|TableDisplay)\.test\.tsx$/,
      /^src\/components\/online\/__tests__\/(?:review\.o4p-04c-display-pairing|OnlineDisplayPairing)\.test\.tsx$/,
      /^src\/components\/online\/__tests__\/(?:review\.o4p-04d-guided-actions|OnlineGuidedActions)\.test\.tsx$/,
      /^src\/dev\/tableDisplay\/main\.tsx$/,
      /^src\/dev\/displayPairing\//,
      /^src\/online\/tableDisplay\//,
      /^src\/online\/displayPairing\//,
      /^src\/online\/guidedActions\//,
      /^src\/online\/headless\/__tests__\/review\.o4p-05b-four-player-release-scenario\.test\.ts$/,
      /^src\/versioning\/(?:index|publicReleaseRuleset(?:\.test)?|review\.o4p-05a-public-release-ruleset\.test)\.ts$/,
      /^src\/online\/cloudflare\/__tests__\/review\.o4p-03d-cloudflare-production-gate\.test\.ts$/,
      /^src\/test\/architecture\/(?:o4p01iStackAnnouncementBoundary|review\.o4p-01h-core-boundary|review\.o4p-02d-audience-projection-boundary|review\.o4p-02e-local-room-gate-boundary|soloOnlineBoundary)\.test\.ts$/,
      /^src\/test\/architecture\/modeNeutralCoreBoundary\.test\.ts$/,
      /^src\/test\/architecture\/review\.o4p-04b-table-display-boundary\.test\.ts$/,
      /^src\/test\/architecture\/review\.o4p-04c-display-pairing-boundary\.test\.ts$/,
      /^src\/test\/architecture\/review\.o4p-04d-guided-actions-boundary\.test\.ts$/,
    ];
    const unexpected = candidatePaths().filter((path) => !allowed.some((pattern) => pattern.test(path)));
    expect(unexpected).toEqual([]);
    expect(candidatePaths()).not.toEqual(expect.arrayContaining([
      'package.json',
      'package-lock.json',
      'vite.config.ts',
      'src/version.ts',
      'src/card/cache.ts',
      'src/App.tsx',
      'src/main.tsx',
    ]));
  });

  it('uses one adaptive tree, existing variables, and the three contract viewports', () => {
    const css = source('src/components/online/tableDisplay.css');
    const component = source('src/components/online/TableDisplay.tsx');
    expect(component.match(/data-testid="table-display"/g)).toHaveLength(1);
    expect(css).toMatch(/@media[^{]*max-width:\s*600px/s);
    expect(css).toMatch(/@media[^{]*max-height:\s*500px/s);
    expect(css).toMatch(/var\(--(?:surface|text|line|space|radius|shadow|accent|gold)/);
    expect(css).not.toMatch(/position:\s*fixed/);
    expect(css).not.toMatch(/https?:\/\//);
  });
});
