import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import * as Compatibility from '../../engine/compatibility';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const compatibilityRoot = resolve(repositoryRoot, 'src/engine/compatibility');
const verifierPath = resolve(repositoryRoot, 'scripts/checks/verify-solo-core-compatibility.ts');
const fixturePath = resolve(
  compatibilityRoot,
  'fixtures/o4p-02a-solo-core-compatibility-v1.json',
);

const requiredExports = [
  'SOLO_CORE_COMPATIBILITY_SCHEMA_VERSION_V1',
  'SOLO_CORE_COMPATIBILITY_CATALOG_V1',
  'soloCoreCompatibilityEntryForV1',
  'validateSoloCoreIdentityMapV1',
  'createSoloCoreIdentityMapV1',
  'projectSoloCompatibilityViewV1',
  'projectCoreCompatibilityViewV1',
  'compareSoloCoreCompatibilityV1',
] as const;

const expectedConcerns = [
  ['player-roster', 'lossy'],
  ['active-player', 'transformable'],
  ['turn-position', 'transformable'],
  ['ordered-zones', 'transformable'],
  ['commander-identity', 'transformable'],
  ['commander-cast-count', 'transformable'],
  ['commander-damage', 'lossy'],
  ['combat-assignments', 'transformable'],
  ['general-life', 'lossy'],
  ['stack-subset', 'lossy'],
  ['search-control-subset', 'lossy'],
  ['random-zone-order', 'transformable'],
  ['full-combat-damage', 'unsupported'],
  ['pending-trigger-sba-turn-advance', 'unsupported'],
  ['poison-energy-experience', 'solo-only'],
  ['mana-payment', 'solo-only'],
  ['undo-redo', 'solo-only'],
  ['indexeddb-snapshot', 'solo-only'],
  ['typed-manual-correction', 'core-only'],
  ['core-replay-package', 'core-only'],
] as const;

function normalizedPath(filePath: string): string {
  return relative(repositoryRoot, filePath).split(sep).join('/');
}

function sourceFiles(root: string): readonly string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const filePath = resolve(root, entry.name);
    if (entry.isDirectory() && entry.name !== '__tests__' && entry.name !== 'fixtures') {
      files.push(...sourceFiles(filePath));
    } else if (entry.isFile() && filePath.endsWith('.ts') && !/\.(?:test|spec)\.ts$/.test(filePath)) {
      files.push(filePath);
    }
  }
  return files.sort();
}

function importsOf(filePath: string): readonly string[] {
  const source = ts.createSourceFile(
    filePath,
    readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const imports: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    }
    if (
      ts.isExportDeclaration(node)
      && node.moduleSpecifier
      && ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return imports;
}

describe('O4P-02A Solo/Core compatibility boundary', () => {
  it('pins the additive public barrel, catalog, fixture, verifier, and machine check', () => {
    for (const name of requiredExports) {
      expect(Object.prototype.hasOwnProperty.call(Compatibility, name), name).toBe(true);
    }
    expect(Compatibility.SOLO_CORE_COMPATIBILITY_SCHEMA_VERSION_V1).toBe(1);
    expect(existsSync(verifierPath)).toBe(true);

    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
      version: string;
      schemaVersion: number;
      concerns: Array<{ concern: string; classification: string }>;
      snapshotBoundary: { soloSnapshotVersion: number; coreReplayStoredInSoloSnapshot: boolean };
    };
    expect(fixture.version).toBe('solo-core-compatibility-v1');
    expect(fixture.schemaVersion).toBe(1);
    expect(fixture.concerns.map(({ concern, classification }) => [concern, classification]))
      .toEqual(expectedConcerns);
    expect(fixture.snapshotBoundary).toMatchObject({
      soloSnapshotVersion: 1,
      coreReplayStoredInSoloSnapshot: false,
    });
    expect(Compatibility.SOLO_CORE_COMPATIBILITY_CATALOG_V1.map(
      ({ concern, classification }) => [concern, classification],
    )).toEqual(expectedConcerns);

    const packageJson = JSON.parse(readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, unknown>;
    };
    expect(packageJson.scripts?.['verify:solo-core-compatibility'])
      .toBe('tsx scripts/checks/verify-solo-core-compatibility.ts');
    expect(readFileSync(resolve(repositoryRoot, 'scripts/checks/machine-checks.mjs'), 'utf8'))
      .toContain('verify:solo-core-compatibility');
  });

  it('keeps the adapter observational, deterministic, offline, and outside Core', () => {
    expect(readFileSync(resolve(repositoryRoot, 'src/engine/core/index.ts'), 'utf8'))
      .not.toMatch(/compatibility/i);

    const forbiddenImport = /react|zustand|indexeddb|cloudflare|websocket|durable.?object|(?:^|\/)store(?:\/|$)|(?:^|\/)online(?:\/|$)|(?:^|\/)data(?:\/|$)|(?:^|\/)app(?:\/|$)|node:/i;
    const forbiddenSource = /Math\.random|Date\.now|new\s+Date|setTimeout|setInterval|applyCoreCommandV1\s*\(|applyCommand\s*\(|applyResolutionCommands\s*\(|replayCoreCommandsV1\s*\(|JSON\s*Patch|replaceWholeState|mixed-transition-authority/i;
    const files = sourceFiles(compatibilityRoot);
    expect(files.map(normalizedPath)).toEqual([
      'src/engine/compatibility/index.ts',
      'src/engine/compatibility/soloCoreCompatibilityV1.ts',
      'src/engine/compatibility/soloCoreParityV1.ts',
    ]);
    for (const filePath of files) {
      const source = readFileSync(filePath, 'utf8');
      expect(source, normalizedPath(filePath)).not.toMatch(forbiddenSource);
      for (const specifier of importsOf(filePath)) {
        expect(`${specifier} ${normalizedPath(filePath)}`).not.toMatch(forbiddenImport);
      }
    }
  });

  it('does not route production application code through the compatibility adapter', () => {
    const roots = ['src/App.tsx', 'src/store', 'src/components', 'src/hooks', 'src/online'];
    for (const root of roots) {
      const path = resolve(repositoryRoot, root);
      const files = path.endsWith('.tsx') ? [path] : sourceFiles(path);
      for (const filePath of files) {
        for (const specifier of importsOf(filePath)) {
          expect(`${specifier} ${normalizedPath(filePath)}`).not.toMatch(/engine\/compatibility|\/compatibility(?:\/|$)/i);
        }
      }
    }
  });
});
