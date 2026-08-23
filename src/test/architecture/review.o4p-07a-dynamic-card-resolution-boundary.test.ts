import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const baseSha = '55fe011700bd6bb10a699e1bd431f0bf12cc40cb';
const closureSha = 'ead2ed875e84b932fb56e04055dd9621a6cecb39';

function source(path: string): string {
  return readFileSync(resolve(repositoryRoot, path), 'utf8');
}

function sourceAt(sha: string, path: string): string {
  return execFileSync('git', ['show', `${sha}:${path}`], { cwd: repositoryRoot, encoding: 'utf8' });
}

function normalized(path: string): string {
  return relative(repositoryRoot, path).split(sep).join('/');
}

function productionFiles(root: string): readonly string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') files.push(...productionFiles(path));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) files.push(path);
  }
  return files.sort();
}

function moduleSpecifiers(text: string): readonly string[] {
  return [...text.matchAll(/(?:from\s+|import\s*\()(['"])([^'"]+)\1/g)].map((match) => match[2] ?? '');
}

describe('O4P-07A dynamic card resolution architecture boundary', () => {
  it('adds the closed dependency-free lower and server resolver surfaces', () => {
    expect(productionFiles(resolve(repositoryRoot, 'src/online/deckSubmission')).map(normalized)).toEqual([
      'src/online/deckSubmission/index.ts',
      'src/online/deckSubmission/resolution.ts',
      'src/online/deckSubmission/types.ts',
      'src/online/deckSubmission/validation.ts',
    ]);
    expect(productionFiles(resolve(repositoryRoot, 'src/online/cloudflare')).map(normalized)).toContain(
      'src/online/cloudflare/scryfallResolver.ts',
    );
    const before = JSON.parse(execFileSync('git', ['show', `${baseSha}:package.json`], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    })) as Record<string, unknown>;
    const after = JSON.parse(source('package.json')) as Record<string, unknown>;
    expect(after.dependencies).toEqual(before.dependencies);
    expect(after.devDependencies).toEqual(before.devDependencies);
    expect(source('package-lock.json')).not.toMatch(/@cloudflare|wrangler|miniflare|workerd/);
  });

  it('keeps deck submission below Cloudflare and Cloudflare on public lower barrels', () => {
    for (const path of productionFiles(resolve(repositoryRoot, 'src/online/deckSubmission'))) {
      const text = readFileSync(path, 'utf8');
      expect(text, normalized(path)).not.toMatch(/online\/cloudflare|\.\.\/cloudflare|react|react-dom|zustand|indexeddb|localstorage|console\.|node:/i);
    }
    const allowed = new Set([
      '../protocol/index',
      '../projection/index',
      '../room/index',
      '../room/validationSupport',
      '../lobby/index',
      '../deckSubmission/index',
      '../genesis/index',
      '../../engine/core/index',
    ]);
    for (const path of productionFiles(resolve(repositoryRoot, 'src/online/cloudflare'))) {
      for (const specifier of moduleSpecifiers(readFileSync(path, 'utf8'))) {
        const local = specifier.startsWith('./') && !specifier.includes('..');
        expect(local || allowed.has(specifier), `${normalized(path)} -> ${specifier}`).toBe(true);
      }
    }
  });

  it('keeps client input identity-only and makes Scryfall the server definition authority', () => {
    const types = source('src/online/deckSubmission/types.ts');
    const resolution = source('src/online/deckSubmission/resolution.ts');
    const resolverBoundary = source('src/online/cloudflare/scryfallResolver.ts');
    expect(types).toMatch(/kind:\s*'online-forming-lobby-deck-submit-v2'/);
    expect(types).toMatch(/section:\s*OnlineDeckSubmissionSectionV2[\s\S]*quantity:\s*number[\s\S]*scryfallId:\s*string[\s\S]*oracleId:\s*string/);
    const request = types.match(/export type OnlineDeckSubmitV2[\s\S]*?\n\}>;/)?.[0] ?? '';
    expect(request).not.toBe('');
    expect(request).not.toMatch(/CardDef|name|oracleText|printedText|faces|definition/);
    expect(resolution).toContain('https://api.scryfall.com/cards/collection');
    expect(resolution).toMatch(/(?:BATCH_SIZE|MAX_COLLECTION_IDENTIFIERS)\s*=\s*75/);
    expect(resolution).toMatch(/'User-Agent'/);
    expect(resolution).toMatch(/Accept:/);
    expect(resolverBoundary).toMatch(/OnlineDeckScryfallResolverV2/);
  });

  it('freezes three seat-scoped STRICT tables, CAS completion, and bounded immutable bytes', () => {
    const persistence = source('src/online/cloudflare/persistence.ts');
    const validation = source('src/online/deckSubmission/validation.ts');
    const types = source('src/online/deckSubmission/types.ts');
    for (const table of [
      'online_deck_submission_head_v2',
      'online_deck_submission_history_v2',
      'online_deck_submission_snapshot_v2',
    ]) {
      expect(persistence).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS ${table}[^\u0060]+STRICT`));
    }
    expect(persistence).toMatch(/UPDATE online_deck_submission_head_v2[\s\S]*WHERE room_id = \? AND seat_index = \? AND revision = \? RETURNING seat_index/);
    expect(persistence).toMatch(/UPDATE online_deck_submission_history_v2[\s\S]*WHERE room_id = \? AND seat_index = \? AND submission_id = \? RETURNING submission_id/);
    expect(persistence).toMatch(/UPDATE online_deck_submission_head_v2 SET revision = \?, state = \?, snapshot_digest = NULL WHERE room_id = \? AND seat_index = \? AND revision = \? RETURNING seat_index/);
    expect(persistence).toMatch(/UPDATE online_application_migration[\s\S]*RETURNING singleton/);
    expect(types).toMatch(/ONLINE_DECK_SUBMISSION_MAX_CANONICAL_BYTES_V2\s*=\s*262_144/);
    expect(validation).toMatch(/TextEncoder/);
    const tableDeclarations = [...persistence.matchAll(/const CREATE_DECK_[A-Z_]+ = `([^`]+)`/g)].map((match) => match[1] ?? '').join('\n');
    expect(tableDeclarations).not.toMatch(/capability|bearer|deck_text|card_name|oracle_text/i);
  });

  it('does not switch public UI, fixed bootstrap, or start genesis during 07A', () => {
    const baseApp = sourceAt(baseSha, 'src/App.tsx');
    expect(sourceAt(closureSha, 'src/App.tsx')).toBe(baseApp);
    const runtime = sourceAt(closureSha, 'src/online/cloudflare/runtime.ts');
    const persistence = sourceAt(closureSha, 'src/online/cloudflare/persistence.ts');
    const resolution = sourceAt(closureSha, 'src/online/deckSubmission/resolution.ts');
    expect(`${runtime}\n${persistence}\n${resolution}`).not.toMatch(/catalogV1|fourDeckBootstrapV1|parseBootstrapDeckTextV1|ONLINE_BOOTSTRAP_DECK/);
    expect(runtime).toMatch(/searchParams\.get\('schemaVersion'\) === '2'[\s\S]*projectLobbyV2[\s\S]*projectOnlineFormingLobbyV1/);
    expect(runtime).toMatch(/kind === 'online-forming-lobby-start-v1'/);
  });
});
