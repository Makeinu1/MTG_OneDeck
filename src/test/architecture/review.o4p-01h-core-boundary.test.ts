import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

interface SourceUnit {
  readonly filePath: string;
  readonly sourceText: string;
}

interface ImportReference {
  readonly filePath: string;
  readonly specifier: string;
  readonly dynamic: boolean;
}

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const sourceRoot = resolve(repositoryRoot, 'src');
const coreRoot = resolve(sourceRoot, 'engine/core');
const objectRoot = resolve(coreRoot, 'object');
const ignoredDirectories = new Set(['node_modules', 'dist', 'coverage', '__tests__']);

function normalized(value: string): string {
  return value.split(sep).join('/');
}

function codeUnitCompare(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function isWithin(parent: string, candidate: string): boolean {
  const child = relative(parent, candidate);
  return child !== '' && !child.startsWith('..') && !isAbsolute(child);
}

function sourceCandidates(basePath: string): readonly string[] {
  return [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.mts`,
    `${basePath}.cts`,
    `${basePath}/index.ts`,
    `${basePath}/index.tsx`,
  ];
}

function resolveSourceTarget(filePath: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const basePath = resolve(dirname(filePath), specifier);
  return sourceCandidates(basePath).find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

function collectSourceUnits(root: string): readonly SourceUnit[] {
  const units: SourceUnit[] = [];
  function visit(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) visit(resolve(directory, entry.name));
        continue;
      }
      if (
        entry.isFile()
        && /\.(ts|tsx)$/.test(entry.name)
        && !entry.name.endsWith('.d.ts')
        && !/\.(test|spec)\.(ts|tsx)$/.test(entry.name)
      ) {
        const filePath = resolve(directory, entry.name);
        units.push({ filePath, sourceText: readFileSync(filePath, 'utf8') });
      }
    }
  }
  visit(root);
  return units.sort((left, right) => codeUnitCompare(left.filePath, right.filePath));
}

function importReferences(unit: SourceUnit): readonly ImportReference[] {
  const sourceFile = ts.createSourceFile(
    unit.filePath,
    unit.sourceText,
    ts.ScriptTarget.Latest,
    true,
    unit.filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const references: ImportReference[] = [];
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      references.push({ filePath: unit.filePath, specifier: node.moduleSpecifier.text, dynamic: false });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      references.push({ filePath: unit.filePath, specifier: node.moduleSpecifier.text, dynamic: false });
    } else if (
      ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length === 1
      && ts.isStringLiteral(node.arguments[0])
    ) {
      references.push({ filePath: unit.filePath, specifier: node.arguments[0].text, dynamic: true });
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return references;
}

function productionImportViolations(units: readonly SourceUnit[]): readonly string[] {
  const violations: string[] = [];
  for (const unit of units) {
    const sourcePath = normalized(relative(repositoryRoot, unit.filePath));
    const targetIsCore = isWithin(coreRoot, unit.filePath);
    const isSolo = sourcePath === 'src/App.tsx'
      || sourcePath.startsWith('src/components/')
      || sourcePath.startsWith('src/store/')
      || sourcePath.startsWith('src/data/');
    for (const reference of importReferences(unit)) {
      const target = resolveSourceTarget(unit.filePath, reference.specifier);
      const targetPath = target === null ? '' : normalized(relative(repositoryRoot, target));
      const isOnlineReference = reference.specifier.includes('/online')
        || targetPath.startsWith('src/online/')
        || targetPath === 'src/online';
      const isAuthorizedOnlineDisplayPublicImport = (
        sourcePath === 'src/components/online/PersonalWorkbench.tsx'
        && targetPath === 'src/online/workbench/index.ts'
      ) || (
        sourcePath === 'src/components/online/TableDisplay.tsx'
        && targetPath === 'src/online/tableDisplay/index.ts'
      ) || (
        sourcePath === 'src/components/online/OnlineGuidedActions.tsx'
        && (
          targetPath === 'src/online/guidedActions/index.ts'
          || targetPath === 'src/components/online/onlineGuidedActions.css'
        )
      ) || (
        sourcePath === 'src/components/online/OnlineDisplayPairing.tsx'
        && (
          targetPath === 'src/online/displayPairing/index.ts'
          || targetPath === 'src/online/workbench/index.ts'
          || targetPath === 'src/online/guidedActions/index.ts'
          || targetPath === 'src/components/online/onlineDisplayPairing.css'
        )
      ) || (
        sourcePath === 'src/components/online/OnlineTabletopManual.tsx'
        && targetPath === 'src/components/online/onlineTabletopManual.css'
      ) || (
        sourcePath === 'src/components/online/OnlineVisibilityDecisions.tsx'
        && (
          targetPath === 'src/online/projection/index.ts'
          || targetPath === 'src/online/visibilityDecisions/index.ts'
          || targetPath === 'src/components/online/onlineVisibilityDecisions.css'
        )
      ) || (
        sourcePath === 'src/App.tsx'
        && targetPath === 'src/components/online/PublicOnlineApp.tsx'
      ) || (
        sourcePath === 'src/components/online/PublicOnlineApp.tsx'
        && targetPath === 'src/online/publicApp/index.ts'
      );
      if (targetIsCore && isOnlineReference) {
        violations.push(`${sourcePath}|core-online|${reference.specifier}|${reference.dynamic ? 'dynamic' : 'static'}`);
      }
      if (targetIsCore && (
        targetPath.startsWith('src/store/')
        || targetPath.startsWith('src/components/')
        || targetPath === 'src/App.tsx'
        || /^(react|react-dom|zustand|idb|fake-indexeddb|node:)/.test(reference.specifier)
      )) {
        violations.push(`${sourcePath}|core-product-or-runtime|${reference.specifier}`);
      }
      if (isSolo && isOnlineReference && !isAuthorizedOnlineDisplayPublicImport) {
        violations.push(`${sourcePath}|solo-online|${reference.specifier}`);
      }
      if (isSolo && (targetPath === 'src/engine/core/object/index.ts' || targetPath.startsWith('src/engine/core/object/'))) {
        violations.push(`${sourcePath}|solo-object-integration|${reference.specifier}`);
      }
    }
  }
  return violations.sort();
}

function objectCreationCommandViolations(units: readonly SourceUnit[]): readonly string[] {
  const violations: string[] = [];
  const creationCommand = /\b(?:GameCommand|applyCommand|CommandFactory|create(?:Token|SpellCopy|ActivatedAbility|TriggeredAbility|Object)\w*Command|(?:cast|activate|trigger|resolve)\w*Command)\b/;
  for (const unit of units) {
    if (!isWithin(objectRoot, unit.filePath)) continue;
    const relativePath = normalized(relative(repositoryRoot, unit.filePath));
    if (/command/i.test(relativePath)) violations.push(`${relativePath}|command-file`);
    if (creationCommand.test(unit.sourceText)) violations.push(`${relativePath}|creation-command-symbol`);
  }
  return violations.sort();
}

describe('O4P-01H Core/Solo/Online boundary', () => {
  it('pin-14 keeps Online runtime and UI absent while retaining only architecture', () => {
    expect(existsSync(resolve(sourceRoot, 'online/architecture/stateArchitecture.ts'))).toBe(true);
    for (const directory of ['domain', 'server', 'transport', 'ui']) {
      expect(existsSync(resolve(sourceRoot, 'online', directory))).toBe(false);
    }
    expect(existsSync(resolve(sourceRoot, 'online/index.ts'))).toBe(false);
  });

  it('pin-15 keeps Solo production files independent of Online runtime and V2 object integration', () => {
    const violations = productionImportViolations(collectSourceUnits(sourceRoot));
    expect(violations).toEqual([]);
  });

  it('pin-16 keeps the Core object substrate mode-neutral and runtime-free', () => {
    const units = collectSourceUnits(coreRoot);
    const violations = productionImportViolations(units);
    expect(violations).toEqual([]);
    for (const unit of units) {
      if (!isWithin(objectRoot, unit.filePath)) continue;
      expect(unit.sourceText).not.toMatch(/\b(?:React|Zustand|window|document|localStorage|fetch)\b/);
    }
  });

  it('pin-17 excludes object creation commands and deferred stack execution from this substrate', () => {
    expect(objectCreationCommandViolations(collectSourceUnits(objectRoot))).toEqual([]);
  });
});
