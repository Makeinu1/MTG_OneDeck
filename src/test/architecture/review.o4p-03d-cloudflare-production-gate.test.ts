import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

function text(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('O4P-03D architecture boundary', () => {
  it('adds no package dependency, CI Cloudflare deploy, custom route, account identifier, or legacy migration', () => {
    const packageJson = JSON.parse(text('package.json')) as {
      dependencies?: Record<string, unknown>;
      devDependencies?: Record<string, unknown>;
    };
    const dependencyNames = [
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.devDependencies ?? {}),
    ];
    expect(dependencyNames).not.toContain('wrangler');
    expect(dependencyNames.every((name) => !name.toLowerCase().includes('cloudflare'))).toBe(true);
    const workflow = text('.github/workflows/deploy-pages.yml');
    expect(workflow).not.toMatch(/wrangler|cloudflare|CLOUDFLARE_/i);
    const config = text('wrangler.jsonc');
    expect(config).not.toMatch(/account_id|zone_id|routes|migrations|token|secret/i);
  });

  it('keeps the production gate headless and out of Solo, UI, engine, and deployment mutation code', () => {
    const harness = text('scripts/online/o4p-03d-evidence.ts');
    expect(harness).not.toMatch(/wrangler\s+(?:deploy|rollback)|git\s|gh\s|\brm\s|deleteAll|restore/);
    const worker = text('src/online/cloudflare/worker.ts');
    const runtime = text('src/online/cloudflare/runtime.ts');
    const persistence = text('src/online/cloudflare/persistence.ts');
    const productionGate = [worker, runtime, persistence].join('\n');
    expect(productionGate).not.toMatch(/react|zustand|indexeddb/i);
    expect(productionGate).not.toMatch(/https:\/\/api\.scryfall\.com/i);
  });
});
