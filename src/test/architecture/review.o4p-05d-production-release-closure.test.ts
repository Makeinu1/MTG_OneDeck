import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../..');
const BASE_SHA = 'e5b426fe93e4c4d0b25c76f51d1ca877351f8b8c';
const REVIEW_PATH = 'src/test/architecture/review.o4p-05d-production-release-closure.test.ts';
const PRODUCTION_RECORD = 'research/cr-grounding/archive/o4p-05d-cold-audit-record-2026-08-15.md';

function text(path: string): string {
  return readFileSync(resolve(ROOT, path), 'utf8');
}

describe('O4P-05D production-release closure boundary', () => {
  it('keeps the O4P-05 serial ledger unique and status-synchronized', () => {
    const ledger = JSON.parse(text('research/cr-grounding/cr-backbone-ledger.json')) as {
      domains: Array<{ id: string; status: string; dependsOn?: string[] }>;
      plannedSequence: Array<{ domainId: string; status: string; dependsOn?: string[] }>;
      goalPolicy?: { activeProgram?: { id?: string; domainIds?: string[] } };
    };
    const ids = ['O4P-05A', 'O4P-05B', 'O4P-05C', 'O4P-05D'];
    expect(ledger.goalPolicy?.activeProgram).toEqual({ id: 'O4P-05', domainIds: ids });
    for (const [index, id] of ids.entries()) {
      const domains = ledger.domains.filter((entry) => entry.id === id);
      const planned = ledger.plannedSequence.filter((entry) => entry.domainId === id);
      expect(domains, id).toHaveLength(1);
      expect(planned, id).toHaveLength(1);
      expect(domains[0]?.status, id).toBe(planned[0]?.status);
      if (index < 3) expect(domains[0]?.status, id).toBe('shipped');
      else {
        expect(['pending', 'shipped'], id).toContain(domains[0]?.status);
        if (domains[0]?.status === 'shipped') {
          expect(existsSync(resolve(ROOT, PRODUCTION_RECORD))).toBe(true);
          const record = text(PRODUCTION_RECORD);
          expect(record).toContain('Production-closure audit: BLOCKER 0 / HIGH 0');
          expect(record).toContain('Cloudflare active version');
          expect(record).toContain('fresh init-load');
        }
      }
      if (index > 0) expect(domains[0]?.dependsOn, id).toEqual([ids[index - 1]]);
    }
  });

  it('admits only the Judge review path under src and freezes product/configuration bytes', () => {
    const tracked = execFileSync('git', ['diff', '--name-only', BASE_SHA, '--', 'src', 'rule', 'wrangler.jsonc', 'package-lock.json'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim().split(/\r?\n/).filter(Boolean);
    const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', 'src', 'rule', 'wrangler.jsonc', 'package-lock.json'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim().split(/\r?\n/).filter(Boolean);
    const drift = [...new Set([...tracked, ...untracked])].sort();
    expect(drift).toEqual([REVIEW_PATH]);

    const before = JSON.parse(execFileSync('git', ['show', `${BASE_SHA}:package.json`], { cwd: ROOT, encoding: 'utf8' })) as Record<string, unknown>;
    const after = JSON.parse(text('package.json')) as Record<string, unknown>;
    expect(after.dependencies).toEqual(before.dependencies);
    expect(after.devDependencies).toEqual(before.devDependencies);
    expect(after.version).toBe(before.version);
    expect(text('package-lock.json')).toBe(
      execFileSync('git', ['show', `${BASE_SHA}:package-lock.json`], { cwd: ROOT, encoding: 'utf8' }),
    );
  });

  it('keeps Cloudflare deployment out of CI and preserves both release surfaces', () => {
    const workflow = text('.github/workflows/deploy-pages.yml');
    expect(workflow).toContain('npm run check -- --build-base=/MTG_OneDeck/');
    expect(workflow).toContain('npm run check:forbidden -- --diff');
    expect(workflow).toContain('actions/upload-pages-artifact@v5');
    expect(workflow).toContain('actions/deploy-pages@v5');
    expect(workflow).not.toMatch(/wrangler|cloudflare|CLOUDFLARE_/i);

    const config = text('wrangler.jsonc');
    expect(config).toContain('"name": "mtg-onedeck-online"');
    expect(config).toContain('"name": "ONLINE_ROOMS"');
    expect(config).toContain('"binding": "CF_VERSION_METADATA"');
    expect(config).toContain('"storage": "sqlite"');
    expect(config).not.toMatch(/account_id|zone_id|routes|token|secret/i);
  });

  it('orders the final verifier after O4P-05C and before lint', () => {
    const pkg = JSON.parse(text('package.json')) as { scripts?: Record<string, unknown> };
    expect(pkg.scripts?.['verify:o4p-05d-production-release-closure']).toBe(
      'tsx scripts/checks/verify-o4p-05d-production-release-closure.ts',
    );
    const checks = text('scripts/checks/machine-checks.mjs');
    const predecessor = "args: ['run', 'verify:o4p-05c-release-gates']";
    const current = "args: ['run', 'verify:o4p-05d-production-release-closure']";
    const lint = "{ name: 'lint', cmd: 'npm', args: ['run', 'lint'] }";
    expect(checks.split(current)).toHaveLength(2);
    expect(checks.indexOf(predecessor)).toBeLessThan(checks.indexOf(current));
    expect(checks.indexOf(current)).toBeLessThan(checks.indexOf(lint));
  });

  it('keeps secrets out of frozen release records and preserves the failure boundary', () => {
    const contract = text('research/cr-grounding/o4p-05d-production-release-closure.contract.draft.md');
    const acceptance = text('research/cr-grounding/o4p-05d-acceptance-brief.draft.md');
    expect(contract).toContain('Any failed production smoke triggers STOP-before-promotion');
    expect(contract).toContain('former version for a bounded Cloudflare rollback');
    expect(contract).toContain('24-hour wall-clock soak remain outside');
    expect(`${contract}\n${acceptance}`).not.toMatch(/\b[0-9a-f]{32}\b|gho_[A-Za-z0-9]{20,}|Bearer[ \t]+[A-Za-z0-9._-]{20,}/i);
  });
});
