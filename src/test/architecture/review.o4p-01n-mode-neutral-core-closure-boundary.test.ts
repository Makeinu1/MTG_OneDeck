import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import * as Core from '../../engine/core';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const closureRoot = resolve(repositoryRoot, 'src/engine/core/closure');
const verifierPath = resolve(repositoryRoot, 'scripts/checks/verify-mode-neutral-core-closure.ts');
const fixturePath = resolve(repositoryRoot, 'src/engine/core/fixtures/o4p-01n-mode-neutral-core-closure-v1.json');

const requiredExports = [
  'CORE_CLOSURE_VERSION_VECTOR_V1',
  'createModeNeutralCoreRootV1',
  'validateModeNeutralCoreRootV1',
  'createCoreCommandV1',
  'validateCoreCommandV1',
  'applyCoreCommandV1',
  'createCoreDomainEventV1',
  'appendCoreCommandJournalEntryV1',
  'createCoreReplayPackageV1',
  'validateCoreReplayPackageV1',
  'replayCoreCommandsV1',
  'runOrdinaryFourPlayerCoreClosureV1',
] as const;

const payloadKinds = [
  'stack-commit-card-spell', 'stack-remove-object', 'priority-pass', 'search-open',
  'search-complete', 'control-effect-apply', 'commander-cast-record',
  'commander-damage-record', 'combat-step-set', 'combat-attack-add',
  'combat-block-add', 'player-exit', 'random-zone-order', 'correct-player-life',
  'correct-commander-damage',
] as const;

function normalizedPath(filePath: string): string {
  return relative(repositoryRoot, filePath).split(sep).join('/');
}

function sourceFiles(root: string): readonly string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const filePath = resolve(root, entry.name);
    if (entry.isDirectory() && entry.name !== '__tests__') files.push(...sourceFiles(filePath));
    else if (entry.isFile() && filePath.endsWith('.ts') && !/\.(?:test|spec)\.ts$/.test(filePath)) files.push(filePath);
  }
  return files.sort();
}

function importsOf(filePath: string): readonly string[] {
  const source = ts.createSourceFile(filePath, readFileSync(filePath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const imports: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return imports;
}

describe('O4P-01N Mode-Neutral Core closure boundary', () => {
  it('pins the public root, fixture, verifier, and machine-check registration', () => {
    expect(readFileSync(resolve(repositoryRoot, 'src/engine/core/index.ts'), 'utf8')).toContain("export * from './closure';");
    for (const name of requiredExports) expect(Object.prototype.hasOwnProperty.call(Core, name), name).toBe(true);
    expect(existsSync(verifierPath)).toBe(true);
    const packageJson = JSON.parse(readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8')) as { scripts?: Record<string, unknown> };
    expect(packageJson.scripts?.['verify:mode-neutral-core-closure']).toBe('tsx scripts/checks/verify-mode-neutral-core-closure.ts');
    expect(readFileSync(resolve(repositoryRoot, 'scripts/checks/machine-checks.mjs'), 'utf8')).toContain('verify:mode-neutral-core-closure');
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as { version: string; players: string[]; commanders: unknown[]; payloadKinds: string[]; randomZone: unknown; deferred: string[] };
    expect(fixture.version).toBe('mode-neutral-core-closure-v1');
    expect(fixture.players).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(fixture.commanders).toHaveLength(4);
    expect(fixture.payloadKinds).toEqual(payloadKinds);
    expect(fixture.randomZone).toEqual({ kind: 'player-zone', playerId: 'P1', zone: 'library' });
    expect(fixture.deferred).toEqual(['full-combat-damage', 'arbitrary-manual-state-mutation', 'network', 'room', 'projection', 'ui']);
  });

  it('keeps closure pure, deterministic, mode-neutral, and transport-free', () => {
    const forbiddenImport = /react|zustand|cloudflare|websocket|durable.?object|indexeddb|src\/online|(?:^|\/)store(?:\/|$)|(?:^|\/)data(?:\/|$)|GameState|GameCommand|SNAPSHOT_VERSION/i;
    const forbiddenSource = /Math\.random|Date\.now|new\s+Date|setTimeout|setInterval|localeCompare|connectionId|roomId|participantId|protocolVersion|baseRevision|JSON\s*Patch|reasonLength/i;
    const files = sourceFiles(closureRoot);
    expect(files.length).toBeGreaterThanOrEqual(13);
    for (const filePath of files) {
      const source = readFileSync(filePath, 'utf8');
      expect(source, normalizedPath(filePath)).not.toMatch(forbiddenSource);
      for (const specifier of importsOf(filePath)) expect(`${specifier} ${normalizedPath(filePath)}`).not.toMatch(forbiddenImport);
    }
  });

  it('keeps the command algebra closed and does not introduce event authority', () => {
    const commandSource = readFileSync(resolve(closureRoot, 'commandV1.ts'), 'utf8');
    for (const kind of payloadKinds) expect(commandSource).toContain(`'${kind}'`);
    expect(commandSource).not.toMatch(/payload:\s*unknown|readonly\s+kind:\s*string/);
    const allSource = sourceFiles(closureRoot).map((filePath) => readFileSync(filePath, 'utf8')).join('\n');
    expect(allSource).not.toMatch(/applyDomainEvent|reduceDomainEvent|applyEventToState|setArbitraryPath|replaceWholeState/i);
    expect(allSource).not.toMatch(/ClientHello|ServerHello|WebSocket|PlayerProjection|TableProjection|SpectatorProjection/i);
  });
});
