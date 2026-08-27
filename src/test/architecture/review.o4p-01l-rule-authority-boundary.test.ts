import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const coreRoot = resolve(repositoryRoot, 'src/engine/core');
const rulesRoot = resolve(coreRoot, 'rules');
const requiredExports = [
  'validateCoreRuleAuthorityBundleV1',
  'createCoreRuleAuthorityBundleV1',
  'expireCoreRuleAuthorityAtTurnBoundaryV1',
  'pruneCoreRuleAuthorityForMissingSourcesV1',
  'activateCoreRuleAuthorityAtTurnStartV1',
  'currentCoreObjectControllerV1',
  'applyCoreControlEffectV1',
  'removeCoreControlEffectV1',
  'replaceCoreControlEffectOrderV1',
  'markCoreControlledPermanentsAtTurnStartV1',
  'coreHasContinuousControlSinceTurnStartV1',
  'expireCoreControlEffectsAtTurnBoundaryV1',
  'coreCanPlayerViewObjectIdentityV1',
  'openCoreSearchSessionV1',
  'completeCoreSearchSessionV1',
  'cancelCoreSearchSessionV1',
  'addCorePlayPermissionV1',
  'removeCorePlayPermissionV1',
  'consumeCorePlayPermissionV1',
  'findCorePlayPermissionsV1',
  'coreCanPlayerAttemptPlayObjectV1',
  'addCoreDecisionAuthorityV1',
  'removeCoreDecisionAuthorityV1',
  'coreDecisionMakerForV1',
  'activateCorePendingDecisionAuthoritiesAtTurnStartV1',
  'expireCoreDecisionAuthoritiesAfterTurnV1',
];

function pathOf(filePath: string): string {
  return relative(repositoryRoot, filePath).split(sep).join('/');
}
function sourceFiles(root: string): readonly string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const filePath = resolve(directory, entry.name);
      if (
        entry.isDirectory() &&
        !['__tests__', 'fixtures', 'node_modules', 'dist', 'coverage'].includes(entry.name)
      )
        visit(filePath);
      else if (entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name))
        files.push(filePath);
    }
  };
  visit(root);
  return files.sort((a, b) => (pathOf(a) < pathOf(b) ? -1 : 1));
}
function imports(filePath: string): readonly string[] {
  const source = ts.createSourceFile(
    filePath,
    readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier))
      found.push(node.moduleSpecifier.text);
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      found.push(node.moduleSpecifier.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe('O4P-01L additive Core rule-authority architecture boundary', () => {
  it('pins the additive rules module and every frozen public operation export', () => {
    expect(existsSync(rulesRoot)).toBe(true);
    const index = existsSync(resolve(rulesRoot, 'index.ts'))
      ? readFileSync(resolve(rulesRoot, 'index.ts'), 'utf8')
      : '';
    const coreIndex = readFileSync(resolve(coreRoot, 'index.ts'), 'utf8');
    for (const name of requiredExports) {
      expect(`${index}\n${coreIndex}`).toMatch(new RegExp(`\\b${name}\\b`));
    }
  });

  it('keeps rules pure and excludes Solo, Online, UI, network, clock, randomness, and mutable runtime imports', () => {
    const units = sourceFiles(rulesRoot);
    expect(units.length).toBeGreaterThan(0);
    const forbidden =
      /(^|[/._-])(store|online|components|ui)([/._-]|$)|react|zustand|dom|cloudflare|websocket|indexeddb|scryfall|Date\.now|Math\.random|fetch\s*\(|GameState|Solo|PlayerProjection|TableProjection|SpectatorProjection/i;
    for (const filePath of units) {
      const source = readFileSync(filePath, 'utf8');
      expect(source).not.toMatch(forbidden);
      for (const specifier of imports(filePath)) {
        expect(`${specifier} ${pathOf(filePath)}`).not.toMatch(forbidden);
      }
    }
  });

  it('pins O4P-01G through O4P-01K and Solo/Online preservation: registry/turn priority are consumed, never duplicated or replaced', () => {
    const units = sourceFiles(rulesRoot);
    const source = units.map((filePath) => readFileSync(filePath, 'utf8')).join('\n');
    expect(source).toMatch(/turnPriorityBundle/);
    expect(source).toMatch(/continuityByObject/);
    expect(source).not.toMatch(/activePlayerId\s*:\s*[^,}]+/);
    expect(source).not.toMatch(/(?:^|[,{])\s*zones\s*:/m);
    const authorizedOrderChangeComment = 'Accepted library shuffle/reorder operations invalidate every top grant,';
    expect(source.split(authorizedOrderChangeComment)).toHaveLength(2);
    expect(source.replace(authorizedOrderChangeComment, ''))
      .not.toMatch(/\b(move|shuffle)\b|Reveal Event|\bCast\s+command\b|Play command/i);
    expect(source).not.toMatch(/O4P-01[GHJK]|O4P-01G|O4P-01H|O4P-01I|O4P-01J|O4P-01K/);
    for (const directory of [
      'src/online/domain',
      'src/online/server',
      'src/online/transport',
    ]) {
      expect(existsSync(resolve(repositoryRoot, directory))).toBe(false);
    }
  });

  it('pins the six-field root order and explicit deferred surfaces without extension fields', () => {
    const source = sourceFiles(rulesRoot)
      .map((filePath) => readFileSync(filePath, 'utf8'))
      .join('\n');
    expect(source).toMatch(/turnPriorityBundle/);
    expect(source).toMatch(/control/);
    expect(source).toMatch(/visibility/);
    expect(source).toMatch(/searchSessions/);
    expect(source).toMatch(/playPermissions/);
    expect(source).toMatch(/decisionAuthorities/);
    expect(source).not.toMatch(
      /revision|commandId|WebSocket|authentication|capabilityToken|\breplay\b|deterministicRandomness/i,
    );
  });
});
