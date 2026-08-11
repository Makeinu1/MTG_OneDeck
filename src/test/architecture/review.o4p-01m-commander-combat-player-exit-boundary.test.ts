import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const coreRoot = resolve(repositoryRoot, 'src/engine/core');
const ownedRoots = [
  resolve(coreRoot, 'commander'),
  resolve(coreRoot, 'combat'),
  resolve(coreRoot, 'player-lifecycle'),
];
const verifierPath = resolve(
  repositoryRoot,
  'scripts/checks/verify-mode-neutral-core-commander-combat-player-exit.ts',
);

const requiredExports = [
  'createCoreCommanderIdentityV1',
  'createCoreCommanderReplacementChoiceV1',
  'createCoreCommanderCastLedgerV1',
  'recordCoreCommanderCastV1',
  'coreCommanderTaxV1',
  'createCoreCommanderDamageStateV1',
  'recordCoreCommanderDamageV1',
  'coreCommanderDamageAgainstV1',
  'createCoreCommanderDamageProvenanceLedgerV1',
  'recordCoreCommanderDamageProvenanceV1',
  'coreCommanderProvenanceDamageAgainstV1',
  'coreCommanderThresholdReachedFromProvenanceV1',
  'createCoreCombatContextV1',
  'addCoreCombatContextAttackV1',
  'addCoreCombatContextBlockV1',
  'setCoreCombatContextStepV1',
  'reconcileCoreCombatContextForPlayerExitV1',
  'CoreCombatContextValidationCodeV1',
  'createCorePlayerLifecycleStateV1',
  'applyCorePlayerExitV1',
  'corePlayerLifecycleStatusV1',
  'corePlayerLifecycleExitCauseV1',
  'CorePlayerExitRequestV1',
  'createCorePlayerExitReferenceBundleV1',
  'reconcileCorePlayerExitV1',
  'CorePlayerExitReconciliationResultV1',
] as const;

function normalizedPath(filePath: string): string {
  return relative(repositoryRoot, filePath).split(sep).join('/');
}

function sourceFiles(root: string): readonly string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const filePath = resolve(directory, entry.name);
      if (entry.isDirectory() && !['__tests__', 'fixtures'].includes(entry.name)) visit(filePath);
      else if (entry.isFile() && filePath.endsWith('.ts') && !/\.(?:test|spec)\.ts$/.test(filePath)) {
        files.push(filePath);
      }
    }
  };
  visit(root);
  return files.sort((left, right) => normalizedPath(left).localeCompare(normalizedPath(right)));
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
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return imports;
}

describe('O4P-01M additive Core architecture boundary', () => {
  it('pins every frozen public operation at the Core root and the registered verifier', () => {
    const coreIndex = readFileSync(resolve(coreRoot, 'index.ts'), 'utf8');
    for (const name of requiredExports) expect(coreIndex).toMatch(new RegExp(`\\b${name}\\b`));
    expect(coreIndex).not.toMatch(
      /combatAssignmentV1|CoreMultiplayerCombatAssignment|addCoreCombatAttackAssignment|addCoreCombatBlockAssignment/,
    );
    expect(existsSync(verifierPath)).toBe(true);

    const packageJson = JSON.parse(readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, unknown>;
    };
    expect(packageJson.scripts?.['verify:mode-neutral-core-commander-combat-player-exit'])
      .toBe('tsx scripts/checks/verify-mode-neutral-core-commander-combat-player-exit.ts');
    const machineChecks = readFileSync(resolve(repositoryRoot, 'scripts/checks/machine-checks.mjs'), 'utf8');
    expect(machineChecks).toContain('verify:mode-neutral-core-commander-combat-player-exit');
  });

  it('keeps all O4P-01M source pure and excludes Solo, application, transport, UI, clock, and randomness imports', () => {
    const files = ownedRoots.flatMap((root) => sourceFiles(root));
    expect(files.length).toBeGreaterThanOrEqual(8);
    const forbidden =
      /(^|[/._-])(store|online|components|ui|data|dom)([/._-]|$)|react|zustand|cloudflare|websocket|durable.?object|indexeddb|scryfall|Date\.now|Math\.random|fetch\s*\(|GameState|GameCommand|SNAPSHOT_VERSION/i;
    for (const filePath of files) {
      const source = readFileSync(filePath, 'utf8');
      expect(source, normalizedPath(filePath)).not.toMatch(forbidden);
      for (const specifier of importsOf(filePath)) {
        expect(`${specifier} ${normalizedPath(filePath)}`).not.toMatch(forbidden);
      }
    }
  });

  it('keeps transport identity and later command/protocol authority out while retaining Core SearchSession cleanup', () => {
    const source = ownedRoots
      .flatMap((root) => sourceFiles(root))
      .map((filePath) => readFileSync(filePath, 'utf8'))
      .join('\n');
    expect(source).toContain('searchSessionIds');
    expect(source).not.toMatch(
      /connectionId|participantId|roomId|protocolVersion|commandId|baseRevision|reconnect|ClientHello|ServerHello|PlayerProjection|TableProjection|SpectatorProjection/i,
    );
    expect(source).not.toMatch(/applyCommand|CommandResult|DomainEvent|ReplayLog|JSON\s*Patch/i);
  });

  it('keeps combat structural and does not claim automatic damage, SBA, turn, or priority ownership', () => {
    const combatSource = sourceFiles(resolve(coreRoot, 'combat'))
      .map((filePath) => readFileSync(filePath, 'utf8'))
      .join('\n');
    expect(combatSource).toMatch(/attackingPlayerId/);
    expect(combatSource).toMatch(/attackerControllerPlayerId/);
    expect(combatSource).toMatch(/defendingPlayerIds/);
    expect(combatSource).toMatch(/blockerControllerPlayerId/);
    expect(combatSource).toMatch(/attackedObjectId/);
    expect(combatSource).toMatch(/combatId/);
    expect(combatSource).toMatch(/turnNumber/);
    expect(combatSource).not.toMatch(
      /calculateCombatDamage|applyCombatDamage|damageAssignmentOrder|firstStrikeDamage|doubleStrikeDamage|stateBasedAction|performSba|priorityHolderPlayerId/i,
    );
    const verifierSource = readFileSync(verifierPath, 'utf8');
    expect(verifierSource).toMatch(/Object\.keys\(Core\)/);
    expect(verifierSource).not.toMatch(/explicitDefers/);
  });
});
