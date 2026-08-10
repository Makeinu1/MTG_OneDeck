import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';

import { describe, expect, it } from 'vitest';

type ReferenceKind = 'import' | 'import-type' | 're-export' | 'dynamic-import' | 'import-equals' | 'type-query';

interface SourceUnit {
  readonly filePath: string;
  readonly sourceText: string;
}

interface ImportReference {
  readonly filePath: string;
  readonly kind: ReferenceKind;
  readonly specifier: string;
  readonly importedNames: readonly string[];
}

interface BoundaryViolation {
  readonly filePath: string;
  readonly kind: ReferenceKind | 'syntax';
  readonly rule: string;
  readonly specifier: string;
}

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const sourceRoot = resolve(repositoryRoot, 'src');
const ignoredDirectoryNames = new Set(['node_modules', 'dist', 'coverage']);
const coreRelativePrefix = 'src/engine/core';

function codeUnitCompare(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function normalizePath(value: string): string {
  return value.replaceAll('\\', '/').split(sep).join('/');
}

function relativeRepositoryPath(filePath: string): string {
  return normalizePath(relative(repositoryRoot, filePath));
}

function sourceFileCandidates(basePath: string): readonly string[] {
  const runtimeExtensions = ['.js', '.jsx', '.mjs', '.cjs'] as const;
  const extensionlessBase = runtimeExtensions.some((extension) => basePath.endsWith(extension))
    ? basePath.slice(0, basePath.lastIndexOf('.'))
    : basePath;
  return [
    basePath,
    extensionlessBase,
    `${extensionlessBase}.ts`,
    `${extensionlessBase}.tsx`,
    `${extensionlessBase}.mts`,
    `${extensionlessBase}.cts`,
    `${extensionlessBase}/index.ts`,
    `${extensionlessBase}/index.tsx`,
  ];
}

function resolveSpecifierBasePath(filePath: string, specifier: string): string | null {
  if (specifier.startsWith('.')) return resolve(dirname(filePath), specifier);
  if (specifier.startsWith('src/')) return resolve(repositoryRoot, specifier);
  return null;
}

function resolveSourceTarget(filePath: string, specifier: string): string | null {
  const basePath = resolveSpecifierBasePath(filePath, specifier);
  if (basePath === null) return null;
  return sourceFileCandidates(basePath).find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

function moduleMatches(specifier: string, moduleName: string): boolean {
  return specifier === moduleName || specifier.startsWith(`${moduleName}/`);
}

function isWithin(parent: string, candidate: string): boolean {
  const child = relative(parent, candidate);
  return child !== '' && !child.startsWith('..') && !isAbsolute(child);
}

function importedNames(node: ts.ImportDeclaration | ts.ExportDeclaration): string[] {
  if (ts.isImportDeclaration(node)) {
    const clause = node.importClause;
    if (!clause) return [];
    if (!clause.namedBindings) return clause.name ? [clause.name.text] : [];
    if (ts.isNamespaceImport(clause.namedBindings)) return ['*'];
    return clause.namedBindings.elements.map((element) => element.propertyName?.text ?? element.name.text);
  }
  const clause = node.exportClause;
  if (!clause || ts.isNamespaceExport(clause)) return ['*'];
  return clause.elements.map((element) => element.propertyName?.text ?? element.name.text);
}

function typeQuerySpecifier(node: ts.ImportTypeNode): string | null {
  const argument = node.argument;
  if (!ts.isLiteralTypeNode(argument) || !ts.isStringLiteral(argument.literal)) return null;
  return argument.literal.text;
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
      references.push({
        filePath: unit.filePath,
        kind: node.importClause?.isTypeOnly ? 'import-type' : 'import',
        specifier: node.moduleSpecifier.text,
        importedNames: importedNames(node),
      });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      references.push({
        filePath: unit.filePath,
        kind: 're-export',
        specifier: node.moduleSpecifier.text,
        importedNames: importedNames(node),
      });
    } else if (
      ts.isImportEqualsDeclaration(node)
      && ts.isExternalModuleReference(node.moduleReference)
      && ts.isStringLiteral(node.moduleReference.expression)
    ) {
      references.push({
        filePath: unit.filePath,
        kind: 'import-equals',
        specifier: node.moduleReference.expression.text,
        importedNames: [node.name.text],
      });
    } else if (
      ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length === 1
      && ts.isStringLiteral(node.arguments[0])
    ) {
      references.push({
        filePath: unit.filePath,
        kind: 'dynamic-import',
        specifier: node.arguments[0].text,
        importedNames: [],
      });
    } else if (ts.isImportTypeNode(node)) {
      const specifier = typeQuerySpecifier(node);
      if (specifier !== null) {
        references.push({
          filePath: unit.filePath,
          kind: 'type-query',
          specifier,
          importedNames: [],
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return references;
}

function isCorePath(path: string): boolean {
  const normalized = normalizePath(path);
  return normalized === coreRelativePrefix || normalized.startsWith(`${coreRelativePrefix}/`);
}

function isTestPath(path: string): boolean {
  const normalized = normalizePath(path);
  return normalized.includes('/__tests__/') || normalized.startsWith('src/test/');
}

function isVerificationScript(path: string): boolean {
  const normalized = normalizePath(path);
  return normalized === 'scripts/checks/verify-mode-neutral-core-identity-zone.ts'
    || normalized === 'scripts/checks/verify-mode-neutral-core-card-runtime.ts'
    || normalized === 'scripts/checks/verify-mode-neutral-core-zone-transition.ts'
    || normalized === 'scripts/checks/verify-mode-neutral-core-object-registry.ts'
    || normalized === 'scripts/checks/verify-mode-neutral-core-stack-announcement.ts'
    || normalized === 'scripts/checks/verify-mode-neutral-core-stack-transaction.ts'
    || normalized === 'scripts/checks/verify-mode-neutral-core-turn-priority.ts'
    || normalized === 'scripts/checks/verify-mode-neutral-core-rule-authority.ts';
}

function isExistingCardTypeModule(target: string | null): boolean {
  if (target === null) return false;
  const normalized = relativeRepositoryPath(target);
  return normalized === 'src/types/card.ts' || normalized === 'src/types/card.tsx';
}

function isExistingEngineTypeModule(target: string | null): boolean {
  if (target === null) return false;
  const normalized = relativeRepositoryPath(target);
  return normalized === 'src/engine/types.ts' || normalized === 'src/engine/types.tsx';
}

function isProductLayerTarget(target: string | null): boolean {
  if (target === null) return false;
  return isWithin(resolve(sourceRoot, 'online'), target)
    || isWithin(resolve(sourceRoot, 'store'), target)
    || isWithin(resolve(sourceRoot, 'components'), target)
    || isWithin(resolve(sourceRoot, 'data'), target)
    || target === resolve(sourceRoot, 'App.tsx');
}

function addViolation(
  violations: BoundaryViolation[],
  reference: ImportReference,
  rule: string,
): void {
  violations.push({
    filePath: relativeRepositoryPath(reference.filePath),
    kind: reference.kind,
    rule,
    specifier: reference.specifier,
  });
}

function hasForbiddenCoreTypeSyntax(unit: SourceUnit, violations: BoundaryViolation[]): void {
  const unitPath = relativeRepositoryPath(unit.filePath);
  if (!isCorePath(unitPath) || isTestPath(unitPath)) return;
  const sourceFile = ts.createSourceFile(
    unit.filePath,
    unit.sourceText,
    ts.ScriptTarget.Latest,
    true,
    unit.filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  function visit(node: ts.Node): void {
    if (ts.isTypeAliasDeclaration(node) && ts.isTypeReferenceNode(node.type)) {
      const name = node.type.typeName.getText(sourceFile);
      if (name === 'GameState' || name === 'CardInstance' || name === 'CardDef') {
        violations.push({
          filePath: relativeRepositoryPath(unit.filePath),
          kind: 'syntax',
          rule: 'core-no-existing-type-alias',
          specifier: name,
        });
      }
    }
    if (ts.isInterfaceDeclaration(node) && node.heritageClauses?.some((clause) =>
      clause.types.some((type) => {
        const name = type.expression.getText(sourceFile);
        return name === 'GameState' || name === 'CardInstance' || name === 'CardDef';
      })
    )) {
      violations.push({
        filePath: relativeRepositoryPath(unit.filePath),
        kind: 'syntax',
        rule: 'core-no-existing-type-extends',
        specifier: node.name.text,
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

function inspectReference(
  unit: SourceUnit,
  reference: ImportReference,
  violations: BoundaryViolation[],
): void {
  const unitPath = relativeRepositoryPath(unit.filePath);
  const target = resolveSourceTarget(unit.filePath, reference.specifier);
  const referencedPath = resolveSpecifierBasePath(unit.filePath, reference.specifier);
  const coreUnit = isCorePath(unitPath) && !isTestPath(unitPath);
  const coreTarget = target !== null && isCorePath(relativeRepositoryPath(target));
  if (coreUnit) {
    const boundaryTarget = target ?? referencedPath;
    if (isProductLayerTarget(boundaryTarget)) {
      addViolation(violations, reference, 'core-no-product-layer');
    }
    if (moduleMatches(reference.specifier, 'react')
      || moduleMatches(reference.specifier, 'react-dom')
      || moduleMatches(reference.specifier, 'zustand')
      || moduleMatches(reference.specifier, 'idb')
      || moduleMatches(reference.specifier, 'fake-indexeddb')
      || moduleMatches(reference.specifier, 'ws')
      || moduleMatches(reference.specifier, 'isomorphic-ws')
      || moduleMatches(reference.specifier, 'axios')
      || moduleMatches(reference.specifier, 'ky')
      || reference.specifier.startsWith('cloudflare:')
      || reference.specifier.startsWith('@cloudflare/')
      || reference.specifier.startsWith('node:')) {
      addViolation(violations, reference, 'core-no-runtime-dependency');
    }
    if (isExistingCardTypeModule(target)
      || isExistingEngineTypeModule(target)
      || reference.importedNames.some((name) => name === 'GameState' || name === 'CardInstance' || name === 'CardDef')) {
      addViolation(violations, reference, 'core-no-existing-type-import');
    }
    if (target !== null && !coreTarget && !isProductLayerTarget(target)
      && !isExistingCardTypeModule(target) && !isExistingEngineTypeModule(target)) {
      addViolation(violations, reference, 'core-no-unapproved-import');
    }
    const knownRuntimeDependency = moduleMatches(reference.specifier, 'react')
      || moduleMatches(reference.specifier, 'react-dom')
      || moduleMatches(reference.specifier, 'zustand')
      || moduleMatches(reference.specifier, 'idb')
      || moduleMatches(reference.specifier, 'fake-indexeddb')
      || moduleMatches(reference.specifier, 'ws')
      || moduleMatches(reference.specifier, 'isomorphic-ws')
      || moduleMatches(reference.specifier, 'axios')
      || moduleMatches(reference.specifier, 'ky')
      || reference.specifier.startsWith('cloudflare:')
      || reference.specifier.startsWith('@cloudflare/')
      || reference.specifier.startsWith('node:');
    if (target === null && !knownRuntimeDependency) {
      addViolation(violations, reference, 'core-unresolved-import');
    }
  }
  if (unitPath.startsWith('src/engine/') && !unitPath.includes('/__tests__/') && referencedPath !== null
    && normalizePath(relative(sourceRoot, target ?? referencedPath)).startsWith('online/')) {
    addViolation(violations, reference, 'engine-no-online-reverse-import');
  }
  if (coreTarget && !coreUnit && !isTestPath(unitPath) && !isVerificationScript(unitPath)) {
    addViolation(violations, reference, 'core-no-product-runtime-import');
  }
}

export function analyzeBoundarySources(units: readonly SourceUnit[]): readonly BoundaryViolation[] {
  const violations: BoundaryViolation[] = [];
  for (const unit of units) {
    for (const reference of importReferences(unit)) inspectReference(unit, reference, violations);
    hasForbiddenCoreTypeSyntax(unit, violations);
  }
  return violations.sort((left, right) =>
    codeUnitCompare(left.filePath, right.filePath)
    || codeUnitCompare(left.specifier, right.specifier)
    || codeUnitCompare(left.kind, right.kind)
    || codeUnitCompare(left.rule, right.rule));
}

function collectFiles(directory: string): SourceUnit[] {
  const units: SourceUnit[] = [];
  function visit(current: string): void {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!ignoredDirectoryNames.has(entry.name) && entry.name !== '__tests__') visit(resolve(current, entry.name));
        continue;
      }
      if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        const filePath = resolve(current, entry.name);
        units.push({ filePath, sourceText: readFileSync(filePath, 'utf8') });
      }
    }
  }
  visit(directory);
  return units;
}

function repositoryUnits(): readonly SourceUnit[] {
  return [...collectFiles(sourceRoot), ...collectFiles(resolve(repositoryRoot, 'scripts'))];
}

describe('mode-neutral Core dependency boundary', () => {
  it('passes the current repository boundary', { timeout: 60000 }, () => {
    expect(analyzeBoundarySources(repositoryUnits())).toEqual([]);
    expect(existsSync(resolve(sourceRoot, 'online'))).toBe(true);
  });

  it('detects import, import type, re-export, dynamic import, and engine reverse-import violations', () => {
    const units: SourceUnit[] = [
      {
        filePath: resolve(repositoryRoot, 'src/engine/core/fixture.ts'),
        sourceText: [
          "import type { GameState } from '../../engine/types';",
          "import '../../store/gameStore';",
          "export { value } from '../../components/value';",
          "const online = import('../../online/domain/state');",
          "import 'react';",
          "import 'zustand';",
          "import 'cloudflare:test';",
          'type Alias = GameState;',
        ].join('\n'),
      },
      {
        filePath: resolve(repositoryRoot, 'src/engine/game.ts'),
        sourceText: "import '../online/domain/state';",
      },
      {
        filePath: resolve(repositoryRoot, 'src/components/runtime.tsx'),
        sourceText: "import '../engine/core/index';",
      },
    ];
    const violations = analyzeBoundarySources(units);
    expect(violations).toHaveLength(13);
    expect(violations.map(({ rule }) => rule)).toEqual(expect.arrayContaining([
      'core-no-product-runtime-import',
      'core-no-existing-type-import',
      'core-no-existing-type-alias',
      'core-no-product-layer',
      'core-no-runtime-dependency',
      'core-unresolved-import',
      'engine-no-online-reverse-import',
    ]));
    const keys = violations.map(({ filePath, specifier, kind, rule }) => `${filePath}|${specifier}|${kind}|${rule}`);
    expect(keys).toEqual(keys.slice().sort((left, right) => left < right ? -1 : left > right ? 1 : 0));
    expect(violations.some(({ kind }) => kind === 'import-type')).toBe(true);
    expect(violations.some(({ kind }) => kind === 're-export')).toBe(true);
    expect(violations.some(({ kind }) => kind === 'dynamic-import')).toBe(true);
  });

  it('detects namespace imports, type queries, and star re-exports of existing card types', () => {
    const units: SourceUnit[] = [{
      filePath: resolve(repositoryRoot, 'src/engine/core/fixture.ts'),
      sourceText: [
        "import * as cardTypes from '../../types/card';",
        "export * from '../../types/card';",
        "type ExistingCard = import('../../types/card').CardDef;",
      ].join('\n'),
    }];
    const violations = analyzeBoundarySources(units);
    expect(violations).toHaveLength(3);
    expect(violations.every(({ rule }) => rule === 'core-no-existing-type-import')).toBe(true);
    expect(violations.map(({ kind }) => kind)).toEqual(['import', 're-export', 'type-query']);
  });

  it('detects ambiguous engine-type forms, runtime extensions, and unresolved aliases', () => {
    const units: SourceUnit[] = [{
      filePath: resolve(repositoryRoot, 'src/engine/core/fixture.ts'),
      sourceText: [
        "import * as engineTypes from '../../engine/types.js';",
        "export * from '../../engine/types';",
        "type ExistingCard = import('../../engine/types.js').CardDef;",
        "import { GameState } from '../../engine/types.js';",
        "import { GameState as AliasedGameState } from '@engine/types';",
      ].join('\n'),
    }];
    const violations = analyzeBoundarySources(units);
    expect(violations.filter(({ rule }) => rule === 'core-no-existing-type-import')).toHaveLength(5);
    expect(violations.filter(({ rule }) => rule === 'core-unresolved-import')).toHaveLength(1);
  });

  it('rejects unresolved relative imports and every node builtin subpath', () => {
    const units: SourceUnit[] = [{
      filePath: resolve(repositoryRoot, 'src/engine/core/fixture.ts'),
      sourceText: [
        "import './missing-module';",
        "import 'node:fs/promises';",
        "import type { Pip } from '../../engine/mana';",
        "import type { ZoneId } from '../../engine/types';",
      ].join('\n'),
    }];
    const violations = analyzeBoundarySources(units);
    expect(violations.map(({ rule }) => rule)).toEqual([
      'core-no-unapproved-import',
      'core-no-existing-type-import',
      'core-unresolved-import',
      'core-no-runtime-dependency',
    ]);
  });

  it('does not false-positive permitted Core internal and test imports', () => {
    const units: SourceUnit[] = [
      {
        filePath: resolve(repositoryRoot, 'src/engine/core/fixture.ts'),
        sourceText: "import { coreCardObjectIdOf } from './ids';",
      },
      {
        filePath: resolve(repositoryRoot, 'src/engine/core/__tests__/fixture.test.ts'),
        sourceText: "import { createModeNeutralCoreIdentityZoneSliceV1 } from '../index';",
      },
      {
        filePath: resolve(repositoryRoot, 'src/test/architecture/fixture.test.ts'),
        sourceText: "import type { ModeNeutralCoreIdentityZoneSliceV1 } from '../../engine/core';",
      },
      {
        filePath: resolve(repositoryRoot, 'scripts/checks/verify-mode-neutral-core-identity-zone.ts'),
        sourceText: "import { validateModeNeutralCoreIdentityZoneSliceV1 } from '../../src/engine/core';",
      },
      {
        filePath: resolve(repositoryRoot, 'scripts/checks/verify-mode-neutral-core-card-runtime.ts'),
        sourceText: "import { validateModeNeutralCoreCardRuntimeSliceV1 } from '../../src/engine/core';",
      },
      {
        filePath: resolve(repositoryRoot, 'scripts/checks/verify-mode-neutral-core-zone-transition.ts'),
        sourceText: "import { applyCoreCardZoneTransitionV1 } from '../../src/engine/core/transition/cardZoneTransition';",
      },
      {
        filePath: resolve(repositoryRoot, 'scripts/checks/verify-mode-neutral-core-stack-announcement.ts'),
        sourceText: "import { validateModeNeutralCoreStackAnnouncementSliceV1 } from '../../src/engine/core';",
      },
    ];
    expect(analyzeBoundarySources(units)).toEqual([]);
  });

  it('normalizes Windows and POSIX separators and returns every violation in fixed order', () => {
    expect(normalizePath('src\\engine\\core\\ids.ts')).toBe('src/engine/core/ids.ts');
    const units: SourceUnit[] = [
      {
        filePath: resolve(repositoryRoot, 'src/components/z.tsx'),
        sourceText: "import '../engine/core';",
      },
      {
        filePath: resolve(repositoryRoot, 'src/App.tsx'),
        sourceText: "import './engine/core';",
      },
    ];
    const violations = analyzeBoundarySources(units);
    expect(violations).toHaveLength(2);
    expect(violations.map(({ filePath }) => filePath)).toEqual(['src/App.tsx', 'src/components/z.tsx']);
  });
});
