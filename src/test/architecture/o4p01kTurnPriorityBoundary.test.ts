import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

type ReferenceKind =
  | 'static'
  | 'type-only'
  | 'dynamic'
  | 'dynamic-type'
  | 're-export'
  | 'type-re-export';

type SourceUnit = Readonly<{
  filePath: string;
  sourceFile: ts.SourceFile;
}>;

type ImportReference = Readonly<{
  filePath: string;
  node: ts.Node;
  specifier: string;
  kind: ReferenceKind;
}>;

type ViolationCode =
  | 'forbidden-runtime-import'
  | 'forbidden-time-random'
  | 'legacy-type-boundary'
  | 'reverse-import'
  | 'product-runtime-import';

type Violation = Readonly<{
  code: ViolationCode;
  detail: string;
  filePath: string;
  kind: ReferenceKind | null;
  position: number;
  specifier: string | null;
}>;

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const sourceRoot = resolve(repositoryRoot, 'src');
const coreRoot = resolve(sourceRoot, 'engine/core');
const turnRoot = resolve(coreRoot, 'turn');
const compilerOptions = applicationCompilerOptions();
const productionFilePaths = sourceFilePaths(sourceRoot);
const productionProgram = ts.createProgram({
  options: compilerOptions,
  rootNames: productionFilePaths,
});
const productionUnits = sourceFiles(productionFilePaths);

const violationCodeOrder: Readonly<Record<ViolationCode, number>> = {
  'forbidden-runtime-import': 0,
  'forbidden-time-random': 1,
  'legacy-type-boundary': 2,
  'reverse-import': 3,
  'product-runtime-import': 4,
};

const referenceKindOrder: Readonly<Record<ReferenceKind, number>> = {
  static: 0,
  'type-only': 1,
  dynamic: 2,
  'dynamic-type': 3,
  're-export': 4,
  'type-re-export': 5,
};

const legacyTypeNames = new Set(['GameState', 'PendingTrigger', 'Phase']);

function applicationCompilerOptions(): ts.CompilerOptions {
  const configPath = resolve(repositoryRoot, 'tsconfig.app.json');
  const config = ts.readConfigFile(configPath, (fileName) => ts.sys.readFile(fileName));
  if (config.error !== undefined) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  return ts.parseJsonConfigFileContent(config.config, ts.sys, dirname(configPath)).options;
}

function normalized(value: string): string {
  return value.replaceAll('\\', '/');
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function relativePath(filePath: string): string {
  return normalized(relative(repositoryRoot, filePath));
}

function isWithin(filePath: string, root: string): boolean {
  return filePath === root || filePath.startsWith(`${root}/`);
}

function sourceFilePaths(root: string): readonly string[] {
  if (!existsSync(root)) return [];
  const result: string[] = [];

  function visit(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!['__tests__', 'coverage', 'dist', 'node_modules', 'test'].includes(entry.name)) {
          visit(resolve(directory, entry.name));
        }
        continue;
      }
      if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name) || /\.(spec|test)\.(ts|tsx)$/.test(entry.name)) continue;
      result.push(resolve(directory, entry.name));
    }
  }

  visit(root);
  return result.sort((left, right) => compare(relativePath(left), relativePath(right)));
}

function sourceFiles(filePaths: readonly string[]): readonly SourceUnit[] {
  return filePaths.map((filePath) => ({
    filePath,
    sourceFile: productionProgramSourceFile(filePath),
  }));
}

function productionProgramSourceFile(filePath: string): ts.SourceFile {
  const sourceFile = productionProgram.getSourceFile(filePath);
  if (sourceFile !== undefined) return sourceFile;
  return ts.createSourceFile(
    filePath,
    readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function syntheticSourceUnit(filePath: string, sourceText: string): SourceUnit {
  return {
    filePath: resolve(repositoryRoot, filePath),
    sourceFile: ts.createSourceFile(
      resolve(repositoryRoot, filePath),
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    ),
  };
}

function importTypeSpecifier(node: ts.ImportTypeNode): string | null {
  if (!ts.isLiteralTypeNode(node.argument) || !ts.isStringLiteralLike(node.argument.literal)) return null;
  return node.argument.literal.text;
}

function namedImportsAreTypeOnly(bindings: ts.NamedImports): boolean {
  return bindings.elements.length > 0 && bindings.elements.every((element) => element.isTypeOnly);
}

function namedExportsAreTypeOnly(node: ts.ExportDeclaration): boolean {
  return node.exportClause !== undefined
    && ts.isNamedExports(node.exportClause)
    && node.exportClause.elements.length > 0
    && node.exportClause.elements.every((element) => element.isTypeOnly);
}

function references(unit: SourceUnit): readonly ImportReference[] {
  const result: ImportReference[] = [];

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      const clause = node.importClause;
      const isTypeOnly = clause?.isTypeOnly === true
        || (clause !== undefined
          && clause.name === undefined
          && clause.namedBindings !== undefined
          && ts.isNamedImports(clause.namedBindings)
          && namedImportsAreTypeOnly(clause.namedBindings));
      result.push({
        filePath: unit.filePath,
        kind: isTypeOnly ? 'type-only' : 'static',
        node,
        specifier: node.moduleSpecifier.text,
      });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined && ts.isStringLiteralLike(node.moduleSpecifier)) {
      const isTypeOnly = node.isTypeOnly || namedExportsAreTypeOnly(node);
      result.push({
        filePath: unit.filePath,
        kind: isTypeOnly ? 'type-re-export' : 're-export',
        node,
        specifier: node.moduleSpecifier.text,
      });
    } else if (ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length === 1
      && ts.isStringLiteralLike(node.arguments[0])) {
      result.push({
        filePath: unit.filePath,
        kind: 'dynamic',
        node,
        specifier: node.arguments[0].text,
      });
    } else if (ts.isImportTypeNode(node)) {
      const specifier = importTypeSpecifier(node);
      if (specifier !== null) {
        result.push({
          filePath: unit.filePath,
          kind: 'dynamic-type',
          node,
          specifier,
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(unit.sourceFile);
  return result;
}

function resolvedTarget(reference: ImportReference): string | null {
  return ts.resolveModuleName(reference.specifier, reference.filePath, compilerOptions, ts.sys).resolvedModule?.resolvedFileName ?? null;
}

function pathSegments(value: string): readonly string[] {
  return normalized(value).toLowerCase().split('/').filter((segment) => segment.length > 0);
}

function hasPathSegment(value: string, segment: string): boolean {
  return pathSegments(value).includes(segment);
}

function hasPackage(value: string, pattern: RegExp): boolean {
  return pattern.test(value.toLowerCase());
}

function isForbiddenRuntimeImport(specifier: string, target: string | null): boolean {
  const targetPath = target === null ? '' : relativePath(target);
  const pathValues = [specifier, targetPath];
  const hasSegment = (segment: string): boolean => pathValues.some((value) => hasPathSegment(value, segment));
  return hasSegment('store')
    || hasSegment('components')
    || hasSegment('online')
    || hasSegment('dom')
    || hasPackage(specifier, /^(?:@types\/)?react(?:-dom)?(?:\/|$)/)
    || hasPackage(specifier, /(?:^|[/@._-])zustand(?:[/@._-]|$)/)
    || hasPackage(specifier, /(?:^|[/@._-])cloudflare(?:[/@._-]|$)/)
    || hasPackage(specifier, /(?:^|[/@._-])(?:websocket|isomorphic-ws|ws)(?:[/@._-]|$)/)
    || hasPackage(specifier, /(?:^|[/@._-])(?:idb|fake-indexeddb|indexeddb)(?:[/@._-]|$)/)
    || hasPackage(specifier, /(?:^|[/@._-])scryfall(?:[/@._-]|$)/);
}

function legacyNameParts(value: string): readonly string[] {
  return value.split('.').map((part) => part.trim()).filter((part) => part.length > 0);
}

function isLegacyTypeName(value: string): boolean {
  return legacyNameParts(value).some((part) => legacyTypeNames.has(part) || part === 'Solo' || part.startsWith('Solo'));
}

function addViolation(
  result: Violation[],
  unit: SourceUnit,
  code: ViolationCode,
  detail: string,
  node: ts.Node,
  kind: ReferenceKind | null = null,
  specifier: string | null = null,
): void {
  result.push({
    code,
    detail,
    filePath: relativePath(unit.filePath),
    kind,
    position: node.getStart(unit.sourceFile),
    specifier,
  });
}

function legacyTypeViolations(unit: SourceUnit, result: Violation[]): void {
  function visit(node: ts.Node): void {
    if (ts.isImportSpecifier(node)) {
      const importedName = node.propertyName?.text ?? node.name.text;
      if (isLegacyTypeName(importedName) || isLegacyTypeName(node.name.text)) {
        addViolation(result, unit, 'legacy-type-boundary', `import:${importedName}->${node.name.text}`, node);
      }
    } else if (ts.isNamespaceImport(node) && isLegacyTypeName(node.name.text)) {
      addViolation(result, unit, 'legacy-type-boundary', `namespace:${node.name.text}`, node);
    } else if (ts.isImportClause(node) && node.name !== undefined && isLegacyTypeName(node.name.text)) {
      addViolation(result, unit, 'legacy-type-boundary', `default:${node.name.text}`, node);
    } else if (ts.isTypeReferenceNode(node)) {
      const typeName = node.typeName.getText(unit.sourceFile);
      if (isLegacyTypeName(typeName)) {
        addViolation(result, unit, 'legacy-type-boundary', `type:${typeName}`, node);
      }
    } else if (ts.isHeritageClause(node)) {
      for (const type of node.types) {
        const heritageName = type.expression.getText(unit.sourceFile);
        if (isLegacyTypeName(heritageName)) {
          addViolation(result, unit, 'legacy-type-boundary', `heritage:${heritageName}`, type);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(unit.sourceFile);
}

function forbiddenTimeRandomViolations(unit: SourceUnit, result: Violation[]): void {
  function visit(node: ts.Node): void {
    if (ts.isPropertyAccessExpression(node)
      && ts.isIdentifier(node.expression)
      && ((node.expression.text === 'Date' && node.name.text === 'now')
        || (node.expression.text === 'Math' && node.name.text === 'random'))) {
      addViolation(result, unit, 'forbidden-time-random', `${node.expression.text}.${node.name.text}`, node);
    }
    ts.forEachChild(node, visit);
  }

  visit(unit.sourceFile);
}

function reverseLayer(filePath: string): string | null {
  const path = relativePath(filePath);
  if (isWithin(path, 'src/engine/core/object')) return 'Object Registry';
  if (isWithin(path, 'src/engine/core/stack/transaction')) return 'Stack Transaction';
  if (isWithin(path, 'src/engine/core/stack')) return 'Stack Announcement';
  return null;
}

function sortViolations(left: Violation, right: Violation): number {
  return compare(left.filePath, right.filePath)
    || violationCodeOrder[left.code] - violationCodeOrder[right.code]
    || (left.kind === null ? -1 : right.kind === null ? 1 : referenceKindOrder[left.kind] - referenceKindOrder[right.kind])
    || compare(left.specifier ?? '', right.specifier ?? '')
    || compare(left.detail, right.detail)
    || left.position - right.position;
}

function boundaryViolations(units: readonly SourceUnit[]): readonly Violation[] {
  const result: Violation[] = [];
  const turnUnits = units.filter((unit) => isWithin(unit.filePath, turnRoot));

  for (const unit of turnUnits) {
    for (const reference of references(unit)) {
      const target = resolvedTarget(reference);
      if (isForbiddenRuntimeImport(reference.specifier, target)) {
        addViolation(result, unit, 'forbidden-runtime-import', 'turn-dependency', reference.node, reference.kind, reference.specifier);
      }
    }
    legacyTypeViolations(unit, result);
    forbiddenTimeRandomViolations(unit, result);
  }

  for (const unit of units) {
    if (isWithin(unit.filePath, turnRoot)) continue;
    for (const reference of references(unit)) {
      const target = resolvedTarget(reference);
      if (target === null || !isWithin(target, turnRoot)) continue;
      const layer = reverseLayer(unit.filePath);
      if (layer !== null) {
        addViolation(result, unit, 'reverse-import', layer, reference.node, reference.kind, reference.specifier);
      } else if (!isWithin(unit.filePath, coreRoot)) {
        addViolation(result, unit, 'product-runtime-import', 'turn', reference.node, reference.kind, reference.specifier);
      } else {
        addViolation(result, unit, 'reverse-import', 'Core', reference.node, reference.kind, reference.specifier);
      }
    }
  }

  return result.sort(sortViolations);
}

function formattedViolations(violations: readonly Violation[]): readonly string[] {
  return violations.map((violation) => [
    violation.filePath,
    violation.code,
    violation.detail,
    violation.kind ?? '',
    violation.specifier ?? '',
  ].join('|'));
}

function syntheticUnits(): readonly SourceUnit[] {
  return [
    syntheticSourceUnit('src/engine/core/turn/__synthetic-boundary.ts', [
      "import type { Store } from '../../../store/gameStore';",
      "import type { Component } from '../../../components/game/GameScreen';",
      "import type { Online } from 'online/runtime';",
      "import type { Phase as SoloPhase, PendingTrigger as TriggerAlias, GameState as StateAlias } from 'legacy-types';",
      "import { ReactNode } from 'react';",
      "import type { DomNode } from 'dom';",
      "export { Worker } from '@cloudflare/workers-types';",
      "export * from 'websocket';",
      "const loadZustand = import('zustand');",
      "const loadIndexedDb = import('fake-indexeddb');",
      "type Card = import('scryfall-sdk').Card;",
      'type PhaseAlias = Phase;',
      'type PendingAlias = PendingTrigger;',
      'type StateAlias = GameState;',
      'interface SoloDerived extends SoloBase {}',
      'interface StateDerived extends GameState {}',
      'Date.now(); Math.random();',
      'void [Store, Component, Online, SoloPhase, TriggerAlias, StateAlias, ReactNode, DomNode, Worker, loadZustand, loadIndexedDb, Card, PhaseAlias, PendingAlias, StateAlias, SoloDerived, StateDerived];',
    ].join('\n')),
    syntheticSourceUnit('src/engine/core/object/__synthetic-boundary.ts',
      "import type { CoreTurnPositionV1 } from '../turn/turnPositionV1';\nvoid (0 as unknown as CoreTurnPositionV1);"),
    syntheticSourceUnit('src/engine/core/stack/__synthetic-boundary.ts',
      "export { CoreTurnPositionV1 } from '../turn/turnPositionV1';"),
    syntheticSourceUnit('src/engine/core/stack/transaction/__synthetic-boundary.ts',
      "const loadTurn = import('../../turn/turnPositionV1');\nvoid loadTurn;"),
    syntheticSourceUnit('src/store/__synthetic-boundary.ts',
      "export * from '../engine/core/turn/turnPositionV1';"),
    syntheticSourceUnit('src/components/__synthetic-boundary.ts',
      "import type { CoreTurnPositionV1 } from '../engine/core/turn/turnPositionV1';\nvoid (0 as unknown as CoreTurnPositionV1);"),
    syntheticSourceUnit('src/online/__synthetic-boundary.ts',
      "const loadTurn = import('../engine/core/turn/turnPositionV1');\nvoid loadTurn;"),
  ];
}

describe('O4P-01K-K pure Core turn architecture boundary', () => {
  it('uses the Compiler API to enumerate every production turn module and import form', () => {
    const turnUnits = productionUnits.filter((unit) => isWithin(unit.filePath, turnRoot));
    const actualKinds = [...new Set(turnUnits.flatMap((unit) => references(unit).map((reference) => reference.kind)))].sort(compare);

    expect(turnUnits.length).toBeGreaterThan(0);
    expect(productionProgram.getSourceFile(turnUnits[0]?.filePath ?? '')).toBeDefined();
    expect(actualKinds).toEqual(['dynamic-type', 're-export', 'static', 'type-only', 'type-re-export']);
  });

  it('has no forbidden turn dependency, legacy type, time/random, reverse, or product runtime violation', () => {
    expect(boundaryViolations(productionUnits)).toEqual([]);
  }, 20000);

  it('reports all requested boundary violations in deterministic fixed order', () => {
    const violations = boundaryViolations(syntheticUnits());

    expect(formattedViolations(violations)).toEqual([
      'src/components/__synthetic-boundary.ts|product-runtime-import|turn|type-only|../engine/core/turn/turnPositionV1',
      'src/engine/core/object/__synthetic-boundary.ts|reverse-import|Object Registry|type-only|../turn/turnPositionV1',
      'src/engine/core/stack/__synthetic-boundary.ts|reverse-import|Stack Announcement|re-export|../turn/turnPositionV1',
      'src/engine/core/stack/transaction/__synthetic-boundary.ts|reverse-import|Stack Transaction|dynamic|../../turn/turnPositionV1',
      'src/engine/core/turn/__synthetic-boundary.ts|forbidden-runtime-import|turn-dependency|static|react',
      'src/engine/core/turn/__synthetic-boundary.ts|forbidden-runtime-import|turn-dependency|type-only|../../../components/game/GameScreen',
      'src/engine/core/turn/__synthetic-boundary.ts|forbidden-runtime-import|turn-dependency|type-only|../../../store/gameStore',
      'src/engine/core/turn/__synthetic-boundary.ts|forbidden-runtime-import|turn-dependency|type-only|dom',
      'src/engine/core/turn/__synthetic-boundary.ts|forbidden-runtime-import|turn-dependency|type-only|online/runtime',
      'src/engine/core/turn/__synthetic-boundary.ts|forbidden-runtime-import|turn-dependency|dynamic|fake-indexeddb',
      'src/engine/core/turn/__synthetic-boundary.ts|forbidden-runtime-import|turn-dependency|dynamic|zustand',
      'src/engine/core/turn/__synthetic-boundary.ts|forbidden-runtime-import|turn-dependency|dynamic-type|scryfall-sdk',
      'src/engine/core/turn/__synthetic-boundary.ts|forbidden-runtime-import|turn-dependency|re-export|@cloudflare/workers-types',
      'src/engine/core/turn/__synthetic-boundary.ts|forbidden-runtime-import|turn-dependency|re-export|websocket',
      'src/engine/core/turn/__synthetic-boundary.ts|forbidden-time-random|Math.random||',
      'src/engine/core/turn/__synthetic-boundary.ts|forbidden-time-random|Date.now||',
      'src/engine/core/turn/__synthetic-boundary.ts|legacy-type-boundary|heritage:GameState||',
      'src/engine/core/turn/__synthetic-boundary.ts|legacy-type-boundary|heritage:SoloBase||',
      'src/engine/core/turn/__synthetic-boundary.ts|legacy-type-boundary|type:GameState||',
      'src/engine/core/turn/__synthetic-boundary.ts|legacy-type-boundary|type:PendingTrigger||',
      'src/engine/core/turn/__synthetic-boundary.ts|legacy-type-boundary|type:Phase||',
      'src/engine/core/turn/__synthetic-boundary.ts|legacy-type-boundary|import:GameState->StateAlias||',
      'src/engine/core/turn/__synthetic-boundary.ts|legacy-type-boundary|import:PendingTrigger->TriggerAlias||',
      'src/engine/core/turn/__synthetic-boundary.ts|legacy-type-boundary|import:Phase->SoloPhase||',
      'src/online/__synthetic-boundary.ts|product-runtime-import|turn|dynamic|../engine/core/turn/turnPositionV1',
      'src/store/__synthetic-boundary.ts|product-runtime-import|turn|re-export|../engine/core/turn/turnPositionV1',
    ]);
  });
});
