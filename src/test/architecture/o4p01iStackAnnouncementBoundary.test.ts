import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

type ReferenceKind = 'import' | 'import-type' | 're-export' | 'dynamic-import' | 'import-equals';

interface SourceUnit {
  readonly filePath: string;
  readonly sourceFile: ts.SourceFile;
}

interface ModuleReference {
  readonly kind: ReferenceKind;
  readonly specifier: string;
  readonly position: number;
}

interface Violation {
  readonly category: string;
  readonly filePath: string;
  readonly position: number;
  readonly detail: string;
}

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const sourceRoot = resolve(repositoryRoot, 'src');
const coreRoot = resolve(sourceRoot, 'engine/core');
const stackRoot = resolve(coreRoot, 'stack');
const objectRoot = resolve(coreRoot, 'object');
const closureStackConsumers = new Set([
  resolve(coreRoot, 'closure/applyCommandV1.ts'),
  resolve(coreRoot, 'closure/commandV1.ts'),
]);
const ignoredDirectories = new Set(['node_modules', 'dist', 'coverage', '__tests__']);
const allowedOnlineRootNames = new Set(['architecture', 'headless', 'projection', 'protocol', 'room']);
const categoryOrder = [
  'stack-edge',
  'forbidden-import',
  'forbidden-symbol',
  'object-registry-reverse-import',
  'product-runtime-stack-import',
  'solo-type-alias',
  'card-instance-extends',
  'protocol-command-event-symbol',
  'online-runtime',
] as const;

function pathText(filePath: string): string {
  return relative(repositoryRoot, filePath).split('\\').join('/');
}

function compareCodeUnits(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function isWithin(parent: string, candidate: string): boolean {
  const child = relative(parent, candidate);
  return child !== '' && !child.startsWith('..') && !isAbsolute(child);
}

function sourceUnits(root: string, includeTests = false): SourceUnit[] {
  const units: SourceUnit[] = [];
  function visit(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) visit(resolve(directory, entry.name));
        continue;
      }
      if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name)) continue;
      if (!includeTests && /\.(test|spec)\.(ts|tsx)$/.test(entry.name)) continue;
      const filePath = resolve(directory, entry.name);
      const sourceText = readFileSync(filePath, 'utf8');
      units.push({
        filePath,
        sourceFile: ts.createSourceFile(
          filePath,
          sourceText,
          ts.ScriptTarget.Latest,
          true,
          filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        ),
      });
    }
  }
  visit(root);
  return units.sort((left, right) => compareCodeUnits(pathText(left.filePath), pathText(right.filePath)));
}

function importedNames(node: ts.ImportDeclaration | ts.ExportDeclaration): readonly string[] {
  if (ts.isImportDeclaration(node)) {
    const clause = node.importClause;
    if (!clause) return [];
    if (!clause.namedBindings) return clause.name ? [clause.name.text] : [];
    if (ts.isNamespaceImport(clause.namedBindings)) return [clause.namedBindings.name.text];
    return clause.namedBindings.elements.map((element) => element.propertyName?.text ?? element.name.text);
  }
  if (!node.exportClause || ts.isNamespaceExport(node.exportClause)) return [];
  return node.exportClause.elements.map((element) => element.propertyName?.text ?? element.name.text);
}

function moduleReferences(sourceFile: ts.SourceFile): ModuleReference[] {
  const references: ModuleReference[] = [];
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      references.push({
        kind: node.importClause?.isTypeOnly ? 'import-type' : 'import',
        specifier: node.moduleSpecifier.text,
        position: node.getStart(sourceFile),
      });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      references.push({ kind: 're-export', specifier: node.moduleSpecifier.text, position: node.getStart(sourceFile) });
    } else if (
      ts.isImportEqualsDeclaration(node)
      && ts.isExternalModuleReference(node.moduleReference)
      && ts.isStringLiteral(node.moduleReference.expression)
    ) {
      references.push({ kind: 'import-equals', specifier: node.moduleReference.expression.text, position: node.getStart(sourceFile) });
    } else if (
      ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length === 1
      && ts.isStringLiteral(node.arguments[0])
    ) {
      references.push({ kind: 'dynamic-import', specifier: node.arguments[0].text, position: node.getStart(sourceFile) });
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return references;
}

function resolveSourceTarget(filePath: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const basePath = resolve(dirname(filePath), specifier);
  const candidates = [basePath, `${basePath}.ts`, `${basePath}.tsx`, `${basePath}.mts`, `${basePath}.cts`, `${basePath}/index.ts`, `${basePath}/index.tsx`];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

function moduleMatches(specifier: string, moduleName: string): boolean {
  return specifier === moduleName || specifier.startsWith(`${moduleName}/`);
}

function add(violations: Violation[], category: Violation['category'], filePath: string, position: number, detail: string): void {
  violations.push({ category, filePath: pathText(filePath), position, detail });
}

function sortedViolations(violations: readonly Violation[]): Violation[] {
  return [...violations].sort((left, right) =>
    categoryOrder.indexOf(left.category as (typeof categoryOrder)[number])
      - categoryOrder.indexOf(right.category as (typeof categoryOrder)[number])
    || compareCodeUnits(left.filePath, right.filePath)
    || left.position - right.position
    || compareCodeUnits(left.detail, right.detail));
}

function isForbiddenModule(specifier: string): string | null {
  if (moduleMatches(specifier, 'react') || moduleMatches(specifier, 'react-dom')) return 'React';
  if (moduleMatches(specifier, 'zustand')) return 'Zustand';
  if (moduleMatches(specifier, 'dom') || moduleMatches(specifier, 'jsdom')) return 'DOM';
  if (moduleMatches(specifier, 'cloudflare:') || moduleMatches(specifier, '@cloudflare') || moduleMatches(specifier, 'workerd')) return 'Cloudflare';
  if (moduleMatches(specifier, 'ws') || moduleMatches(specifier, 'websocket')) return 'WebSocket';
  if (moduleMatches(specifier, 'idb') || moduleMatches(specifier, 'fake-indexeddb')) return 'IndexedDB';
  if (moduleMatches(specifier, 'scryfall')) return 'Scryfall';
  return null;
}

function inspectForbiddenSymbols(sourceFile: ts.SourceFile): readonly { position: number; name: string }[] {
  const found: { position: number; name: string }[] = [];
  const forbiddenIdentifiers = new Set(['React', 'Zustand', 'Cloudflare', 'WebSocket', 'IndexedDB', 'Scryfall', 'window', 'document', 'HTMLElement', 'localStorage', 'indexedDB']);
  function visit(node: ts.Node): void {
    if (ts.isIdentifier(node) && forbiddenIdentifiers.has(node.text)) found.push({ position: node.getStart(sourceFile), name: node.text });
    if (ts.isPropertyAccessExpression(node)) {
      const fullName = node.getText(sourceFile);
      if (fullName === 'Date.now' || fullName === 'Math.random') found.push({ position: node.getStart(sourceFile), name: fullName });
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return found;
}

function inspectStackBoundary(): Violation[] {
  const violations: Violation[] = [];
  for (const unit of sourceUnits(stackRoot)) {
    for (const reference of moduleReferences(unit.sourceFile)) {
      const forbiddenModule = isForbiddenModule(reference.specifier);
      if (forbiddenModule) add(violations, 'forbidden-import', unit.filePath, reference.position, `${reference.kind}:${forbiddenModule}:${reference.specifier}`);
      const target = resolveSourceTarget(unit.filePath, reference.specifier);
      if (target && ['store', 'components', 'online'].some((segment) => pathText(target).split('/').includes(segment))) {
        add(violations, 'stack-edge', unit.filePath, reference.position, `${reference.kind}:${pathText(target)}`);
      }
      for (const name of ['TargetSelection', 'CardInstance']) {
        if (importedNamesForReference(unit.sourceFile, reference).includes(name)) add(violations, 'solo-type-alias', unit.filePath, reference.position, `${reference.kind}:${name}`);
      }
    }
    for (const symbol of inspectForbiddenSymbols(unit.sourceFile)) add(violations, 'forbidden-symbol', unit.filePath, symbol.position, symbol.name);
    inspectDeclarations(unit.sourceFile, violations, unit.filePath);
  }
  return violations;
}

function importedNamesForReference(sourceFile: ts.SourceFile, reference: ModuleReference): readonly string[] {
  let names: readonly string[] = [];
  function visit(node: ts.Node): void {
    if (node.getStart(sourceFile) !== reference.position) {
      ts.forEachChild(node, visit);
      return;
    }
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) names = importedNames(node);
  }
  visit(sourceFile);
  return names;
}

function inspectDeclarations(sourceFile: ts.SourceFile, violations: Violation[], filePath: string): void {
  function visit(node: ts.Node): void {
    if (ts.isTypeAliasDeclaration(node) && node.name.text === 'TargetSelection') add(violations, 'solo-type-alias', filePath, node.getStart(sourceFile), 'TargetSelection');
    if (ts.isHeritageClause(node) && node.token === ts.SyntaxKind.ExtendsKeyword) {
      for (const type of node.types) {
        if (type.expression.getText(sourceFile) === 'CardInstance') add(violations, 'card-instance-extends', filePath, type.getStart(sourceFile), 'CardInstance');
      }
    }
    const protocolSymbols = new Set(['GameCommand', 'GameEvent', 'DecisionAuthority', 'CommandEnvelope', 'EventEnvelope', 'Protocol', 'pendingPayment', 'paymentComplete', 'readyToResolve']);
    if (ts.isIdentifier(node) && protocolSymbols.has(node.text)) add(violations, 'protocol-command-event-symbol', filePath, node.getStart(sourceFile), node.text);
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

function inspectObjectRegistryReverseImports(): Violation[] {
  const violations: Violation[] = [];
  for (const unit of sourceUnits(objectRoot)) {
    for (const reference of moduleReferences(unit.sourceFile)) {
      const target = resolveSourceTarget(unit.filePath, reference.specifier);
      if (target && isWithin(stackRoot, target)) add(violations, 'object-registry-reverse-import', unit.filePath, reference.position, `${reference.kind}:${pathText(target)}`);
    }
  }
  return violations;
}

function inspectProductRuntimeImports(): Violation[] {
  const violations: Violation[] = [];
  for (const unit of sourceUnits(sourceRoot)) {
    if (isWithin(stackRoot, unit.filePath)) continue;
    if (closureStackConsumers.has(unit.filePath)) continue;
    if (unit.filePath === resolve(coreRoot, 'index.ts')) continue;
    for (const reference of moduleReferences(unit.sourceFile)) {
      const target = resolveSourceTarget(unit.filePath, reference.specifier);
      if (target && isWithin(stackRoot, target)) add(violations, 'product-runtime-stack-import', unit.filePath, reference.position, `${reference.kind}:${pathText(target)}`);
    }
  }
  return violations;
}

function inspectSoloAliasOutsideStack(): Violation[] {
  const violations: Violation[] = [];
  for (const unit of sourceUnits(sourceRoot)) {
    if (isWithin(stackRoot, unit.filePath)) continue;
    function visit(node: ts.Node): void {
      if (ts.isTypeAliasDeclaration(node) && node.name.text === 'CoreStackTargetSelectionV1') add(violations, 'solo-type-alias', unit.filePath, node.getStart(unit.sourceFile), 'CoreStackTargetSelectionV1 outside stack');
      ts.forEachChild(node, visit);
    }
    visit(unit.sourceFile);
  }
  return violations;
}

function inspectOnlineRuntime(): Violation[] {
  const violations: Violation[] = [];
  const onlineRoot = resolve(sourceRoot, 'online');
  if (existsSync(onlineRoot)) {
    for (const entry of readdirSync(onlineRoot, { withFileTypes: true })) {
      if (!allowedOnlineRootNames.has(entry.name)) {
        add(violations, 'online-runtime', resolve(onlineRoot, entry.name), 0, entry.name);
      }
    }
  }
  return violations;
}

function allBoundaryViolations(): Violation[] {
  return sortedViolations([
    ...inspectStackBoundary(),
    ...inspectObjectRegistryReverseImports(),
    ...inspectProductRuntimeImports(),
    ...inspectSoloAliasOutsideStack(),
    ...inspectOnlineRuntime(),
  ]);
}

describe('O4P-01I-K architecture boundary gate', () => {
  it('uses the TypeScript AST to discover all import forms', () => {
    const sourceFile = ts.createSourceFile(
      'probe.ts',
      [
        "import value from './value';",
        "import type { Value } from './types';",
        "export { value as reExported } from './value';",
        "void import('./lazy');",
      ].join('\n'),
      ts.ScriptTarget.Latest,
      true,
    );
    expect(moduleReferences(sourceFile).map((reference) => reference.kind)).toEqual([
      'import', 'import-type', 're-export', 'dynamic-import',
    ]);
  });

  it('reports every architecture violation in the pinned fixed order', () => {
    expect([...allowedOnlineRootNames]).toEqual([
      'architecture',
      'headless',
      'projection',
      'protocol',
      'room',
    ]);
    expect(allBoundaryViolations().map((violation) => `${violation.category}|${violation.filePath}|${violation.detail}`)).toEqual([]);
  });
});
