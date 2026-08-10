import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

type ReferenceKind = 'import' | 'import-type' | 're-export' | 'dynamic-import' | 'import-equals' | 'type-query';

type ViolationCategory =
  | 'transaction-product-import'
  | 'transaction-runtime-import'
  | 'transaction-nondeterminism'
  | 'transaction-solo-alias'
  | 'registry-reverse-import'
  | 'announcement-reverse-import'
  | 'product-runtime-transaction-import';

interface SourceUnit {
  readonly filePath: string;
  readonly sourceText: string;
}

interface ModuleReference {
  readonly kind: ReferenceKind;
  readonly specifier: string;
  readonly importedNames: readonly string[];
  readonly position: number;
}

interface Violation {
  readonly category: ViolationCategory;
  readonly filePath: string;
  readonly position: number;
  readonly detail: string;
}

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const sourceRoot = resolve(repositoryRoot, 'src');
const coreRoot = resolve(sourceRoot, 'engine/core');
const transactionRoot = resolve(coreRoot, 'stack/transaction');
const registryRoot = resolve(coreRoot, 'object');
const announcementRoot = resolve(coreRoot, 'stack');

const ignoredDirectories = new Set(['node_modules', 'dist', 'coverage', '__tests__']);
const violationCategoryOrder: readonly ViolationCategory[] = [
  'transaction-product-import',
  'transaction-runtime-import',
  'transaction-nondeterminism',
  'transaction-solo-alias',
  'registry-reverse-import',
  'announcement-reverse-import',
  'product-runtime-transaction-import',
];

function normalizePath(value: string): string {
  return value.replaceAll('\\', '/');
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

function pathText(filePath: string): string {
  const repositoryPath = relative(repositoryRoot, filePath);
  if (repositoryPath !== '' && !repositoryPath.startsWith('..') && !isAbsolute(repositoryPath)) {
    return normalizePath(repositoryPath);
  }
  return normalizePath(filePath);
}

function hasPathSequence(filePath: string, sequence: readonly string[]): boolean {
  const parts = normalizePath(filePath).split('/').filter(Boolean);
  for (let start = 0; start <= parts.length - sequence.length; start += 1) {
    if (sequence.every((part, offset) => parts[start + offset] === part)) return true;
  }
  return false;
}

function isTransactionPath(filePath: string): boolean {
  return isWithin(transactionRoot, filePath)
    || hasPathSequence(filePath, ['src', 'engine', 'core', 'stack', 'transaction']);
}

function isCorePath(filePath: string): boolean {
  return isWithin(coreRoot, filePath)
    || hasPathSequence(filePath, ['src', 'engine', 'core']);
}

function isRegistryPath(filePath: string): boolean {
  return isWithin(registryRoot, filePath)
    || hasPathSequence(filePath, ['src', 'engine', 'core', 'object']);
}

function isAnnouncementPath(filePath: string): boolean {
  return (isWithin(announcementRoot, filePath)
    || hasPathSequence(filePath, ['src', 'engine', 'core', 'stack']))
    && !isTransactionPath(filePath)
    && !hasPathSequence(filePath, ['src', 'engine', 'core', 'stack', 'index.ts']);
}

function isProductRuntimePath(filePath: string): boolean {
  return hasPathSequence(filePath, ['src'])
    && !isCorePath(filePath)
    && !hasPathSequence(filePath, ['src', 'test'])
    && !normalizePath(filePath).includes('/__tests__/')
    && !/\.(test|spec)\.(ts|tsx)$/.test(filePath);
}

function isCoreIntegrationBarrel(filePath: string): boolean {
  return hasPathSequence(filePath, ['src', 'engine', 'core', 'index.ts'])
    || hasPathSequence(filePath, ['src', 'engine', 'core', 'stack', 'index.ts']);
}

function sourceFileCandidates(basePath: string): readonly string[] {
  const withoutRuntimeExtension = /\.(c|m)?jsx?$/.test(basePath)
    ? basePath.slice(0, basePath.lastIndexOf('.'))
    : basePath;
  return [
    basePath,
    withoutRuntimeExtension,
    `${withoutRuntimeExtension}.ts`,
    `${withoutRuntimeExtension}.tsx`,
    `${withoutRuntimeExtension}.mts`,
    `${withoutRuntimeExtension}.cts`,
    `${withoutRuntimeExtension}/index.ts`,
    `${withoutRuntimeExtension}/index.tsx`,
  ];
}

function sourceSpecifierBase(filePath: string, specifier: string): string | null {
  if (specifier.startsWith('.')) return resolve(dirname(filePath), specifier);
  if (specifier.startsWith('src/')) return resolve(repositoryRoot, specifier);
  return null;
}

function resolveSourceTarget(filePath: string, specifier: string): string | null {
  const basePath = sourceSpecifierBase(filePath, specifier);
  if (basePath === null) return null;
  return sourceFileCandidates(basePath).find((candidate) => {
    try {
      return statSync(candidate).isFile();
    } catch {
      return false;
    }
  }) ?? basePath;
}

function moduleMatches(specifier: string, moduleName: string): boolean {
  return specifier === moduleName || specifier.startsWith(`${moduleName}/`);
}

function pathMatches(specifierOrPath: string, directory: string): boolean {
  return hasPathSequence(specifierOrPath, ['src', directory])
    || specifierOrPath === directory
    || specifierOrPath.startsWith(`${directory}/`);
}

function forbiddenRuntimeModule(specifier: string): string | null {
  if (moduleMatches(specifier, 'react') || moduleMatches(specifier, 'react-dom')) return 'React';
  if (moduleMatches(specifier, 'zustand')) return 'Zustand';
  if (moduleMatches(specifier, 'dom') || moduleMatches(specifier, 'jsdom')) return 'DOM';
  if (specifier.startsWith('cloudflare:') || moduleMatches(specifier, '@cloudflare') || moduleMatches(specifier, 'workerd')) return 'Cloudflare';
  if (moduleMatches(specifier, 'ws') || moduleMatches(specifier, 'websocket') || moduleMatches(specifier, 'isomorphic-ws')) return 'WebSocket';
  if (moduleMatches(specifier, 'idb') || moduleMatches(specifier, 'fake-indexeddb') || moduleMatches(specifier, 'indexeddb')) return 'IndexedDB';
  if (moduleMatches(specifier, 'scryfall') || specifier.startsWith('@scryfall/')) return 'Scryfall';
  return null;
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

function importLocalNames(sourceFile: ts.SourceFile): ReadonlySet<string> {
  const aliases = new Set<string>(['GameCommand', 'CardInstance']);
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && node.importClause) {
      const clause = node.importClause;
      if (clause.name && (clause.name.text === 'GameCommand' || clause.name.text === 'CardInstance')) aliases.add(clause.name.text);
      if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) {
          const imported = element.propertyName?.text ?? element.name.text;
          if (imported === 'GameCommand' || imported === 'CardInstance') aliases.add(element.name.text);
        }
      }
    } else if (ts.isImportEqualsDeclaration(node)
      && (node.name.text === 'GameCommand' || node.name.text === 'CardInstance')) {
      aliases.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return aliases;
}

function moduleReferences(sourceFile: ts.SourceFile): readonly ModuleReference[] {
  const references: ModuleReference[] = [];
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      references.push({
        kind: node.importClause?.isTypeOnly ? 'import-type' : 'import',
        specifier: node.moduleSpecifier.text,
        importedNames: importedNames(node),
        position: node.getStart(sourceFile),
      });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      references.push({
        kind: 're-export',
        specifier: node.moduleSpecifier.text,
        importedNames: importedNames(node),
        position: node.getStart(sourceFile),
      });
    } else if (ts.isImportEqualsDeclaration(node)
      && ts.isExternalModuleReference(node.moduleReference)
      && ts.isStringLiteral(node.moduleReference.expression)) {
      references.push({
        kind: 'import-equals',
        specifier: node.moduleReference.expression.text,
        importedNames: [node.name.text],
        position: node.getStart(sourceFile),
      });
    } else if (ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length === 1
      && ts.isStringLiteral(node.arguments[0])) {
      references.push({
        kind: 'dynamic-import',
        specifier: node.arguments[0].text,
        importedNames: [],
        position: node.getStart(sourceFile),
      });
    } else if (ts.isImportTypeNode(node)
      && ts.isLiteralTypeNode(node.argument)
      && ts.isStringLiteral(node.argument.literal)) {
      references.push({
        kind: 'type-query',
        specifier: node.argument.literal.text,
        importedNames: [],
        position: node.getStart(sourceFile),
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return references;
}

function createProgramFromUnits(units: readonly SourceUnit[]): ts.Program {
  const options: ts.CompilerOptions = {
    noLib: true,
    noResolve: true,
    target: ts.ScriptTarget.ES2023,
    module: ts.ModuleKind.ESNext,
  };
  const defaultHost = ts.createCompilerHost(options, true);
  const virtualSources = new Map(units.map((unit) => [unit.filePath, unit.sourceText]));
  const defaultGetSourceFile = defaultHost.getSourceFile.bind(defaultHost);
  const defaultFileExists = defaultHost.fileExists.bind(defaultHost);
  const defaultReadFile = defaultHost.readFile.bind(defaultHost);
  defaultHost.fileExists = (filePath) => virtualSources.has(filePath) || defaultFileExists(filePath);
  defaultHost.readFile = (filePath) => virtualSources.get(filePath) ?? defaultReadFile(filePath);
  defaultHost.getSourceFile = (filePath, languageVersion, onError, shouldCreateNewSourceFile) => {
    const sourceText = virtualSources.get(filePath);
    if (sourceText !== undefined) {
      return ts.createSourceFile(
        filePath,
        sourceText,
        languageVersion,
        true,
        filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
    }
    return defaultGetSourceFile(filePath, languageVersion, onError, shouldCreateNewSourceFile);
  };
  return ts.createProgram(units.map((unit) => unit.filePath), options, defaultHost);
}

function collectProductionUnits(root: string): SourceUnit[] {
  const units: SourceUnit[] = [];
  function visit(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const filePath = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) visit(filePath);
        continue;
      }
      if (!entry.isFile()
        || !/\.(ts|tsx)$/.test(entry.name)
        || /\.(test|spec)\.(ts|tsx)$/.test(entry.name)
        || normalizePath(filePath).includes('/src/test/')) continue;
      units.push({ filePath, sourceText: readFileSync(filePath, 'utf8') });
    }
  }
  if (existsSync(root)) visit(root);
  return units.sort((left, right) => compareCodeUnits(pathText(left.filePath), pathText(right.filePath)));
}

function programSourceFiles(program: ts.Program, units: readonly SourceUnit[]): readonly ts.SourceFile[] {
  return units.map((unit) => {
    const sourceFile = program.getSourceFile(unit.filePath);
    if (!sourceFile) throw new Error(`Compiler API did not create ${unit.filePath}`);
    return sourceFile;
  });
}

function addViolation(
  violations: Violation[],
  category: ViolationCategory,
  sourceFile: ts.SourceFile,
  position: number,
  detail: string,
): void {
  violations.push({
    category,
    filePath: pathText(sourceFile.fileName),
    position,
    detail,
  });
}

function targetPathForReference(sourceFile: ts.SourceFile, reference: ModuleReference): string | null {
  return resolveSourceTarget(sourceFile.fileName, reference.specifier) ?? reference.specifier;
}

function inspectTransactionSource(sourceFile: ts.SourceFile, violations: Violation[]): void {
  const localSoloNames = importLocalNames(sourceFile);
  for (const reference of moduleReferences(sourceFile)) {
    const targetPath = targetPathForReference(sourceFile, reference);
    if (pathMatches(targetPath ?? reference.specifier, 'store')
      || pathMatches(targetPath ?? reference.specifier, 'components')
      || pathMatches(targetPath ?? reference.specifier, 'online')) {
      addViolation(violations, 'transaction-product-import', sourceFile, reference.position, `${reference.kind}:${reference.specifier}`);
    }
    const runtimeModule = forbiddenRuntimeModule(reference.specifier);
    if (runtimeModule !== null) {
      addViolation(violations, 'transaction-runtime-import', sourceFile, reference.position, `${reference.kind}:${runtimeModule}:${reference.specifier}`);
    }
    for (const importedName of reference.importedNames) {
      if (importedName === 'GameCommand' || importedName === 'CardInstance') {
        addViolation(violations, 'transaction-solo-alias', sourceFile, reference.position, `${reference.kind}:import:${importedName}`);
      }
    }
  }

  function visit(node: ts.Node): void {
    if (ts.isPropertyAccessExpression(node)) {
      const expression = node.expression.getText(sourceFile);
      const name = `${expression}.${node.name.text}`;
      if (name === 'Date.now' || name === 'Math.random') {
        addViolation(violations, 'transaction-nondeterminism', sourceFile, node.getStart(sourceFile), name);
      }
    }
    if (ts.isTypeReferenceNode(node)) {
      const typeName = node.typeName.getText(sourceFile);
      const terminalName = typeName.split('.').at(-1) ?? typeName;
      if (localSoloNames.has(terminalName)) {
        addViolation(violations, 'transaction-solo-alias', sourceFile, node.getStart(sourceFile), `type-reference:${terminalName}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

function inspectReverseImports(
  sourceFiles: readonly ts.SourceFile[],
  category: 'registry-reverse-import' | 'announcement-reverse-import',
  violations: Violation[],
): void {
  for (const sourceFile of sourceFiles) {
    for (const reference of moduleReferences(sourceFile)) {
      if (isTransactionPath(targetPathForReference(sourceFile, reference) ?? reference.specifier)) {
        addViolation(violations, category, sourceFile, reference.position, `${reference.kind}:${reference.specifier}`);
      }
    }
  }
}

function inspectProductRuntimeImports(sourceFiles: readonly ts.SourceFile[], violations: Violation[]): void {
  for (const sourceFile of sourceFiles) {
    if (isCoreIntegrationBarrel(sourceFile.fileName)) continue;
    for (const reference of moduleReferences(sourceFile)) {
      if (isTransactionPath(targetPathForReference(sourceFile, reference) ?? reference.specifier)) {
        addViolation(violations, 'product-runtime-transaction-import', sourceFile, reference.position, `${reference.kind}:${reference.specifier}`);
      }
    }
  }
}

function sortViolations(violations: readonly Violation[]): Violation[] {
  return [...violations].sort((left, right) =>
    violationCategoryOrder.indexOf(left.category) - violationCategoryOrder.indexOf(right.category)
    || compareCodeUnits(left.filePath, right.filePath)
    || left.position - right.position
    || compareCodeUnits(left.detail, right.detail));
}

function analyzeProgram(program: ts.Program, units: readonly SourceUnit[]): readonly Violation[] {
  const sourceFiles = programSourceFiles(program, units);
  const violations: Violation[] = [];
  for (const sourceFile of sourceFiles) {
    if (isTransactionPath(sourceFile.fileName)) inspectTransactionSource(sourceFile, violations);
  }
  inspectReverseImports(sourceFiles.filter((sourceFile) => isRegistryPath(sourceFile.fileName)), 'registry-reverse-import', violations);
  inspectReverseImports(sourceFiles.filter((sourceFile) => isAnnouncementPath(sourceFile.fileName)), 'announcement-reverse-import', violations);
  inspectProductRuntimeImports(sourceFiles.filter((sourceFile) => isProductRuntimePath(sourceFile.fileName)), violations);
  return sortViolations(violations);
}

function fixtureUnits(): readonly SourceUnit[] {
  const root = '/virtual/o4p01j';
  return [
    {
      filePath: `${root}/src/engine/core/stack/transaction/fixture.ts`,
      sourceText: [
        "import type { GameCommand as SoloCommand } from '../../../../store/gameStore';",
        "export { CardInstance as LegacyCard } from '../../types/card';",
        "const online = import('../../../../online/domain/state');",
        "export * from '../../../../components/Board';",
        "import React from 'react';",
        "import type { create } from 'zustand';",
        "export { document } from 'dom';",
        "const cloud = import('cloudflare:workers');",
        "import 'ws';",
        "import 'idb';",
        "export * from 'scryfall';",
        'const timestamp = Date.now();',
        'const random = Math.random();',
        'type CommandAlias = SoloCommand;',
        'type CardAlias = CardInstance;',
        'void [online, React, create, document, cloud, timestamp, random, CommandAlias, CardAlias];',
      ].join('\n'),
    },
    {
      filePath: `${root}/src/engine/core/object/registry.ts`,
      sourceText: "export { value } from '../stack/transaction/index';",
    },
    {
      filePath: `${root}/src/engine/core/stack/announcement.ts`,
      sourceText: "import type { Value } from './transaction/index';",
    },
    {
      filePath: `${root}/src/components/product.tsx`,
      sourceText: "const load = () => import('../engine/core/stack/transaction/index');",
    },
  ];
}

describe('O4P-01J-L atomic stack transaction architecture boundary', () => {
  it('passes the current transaction module boundary', () => {
    const units = collectProductionUnits(sourceRoot);
    const program = createProgramFromUnits(units);
    expect(analyzeProgram(program, units)).toEqual([]);
  });

  it('uses Compiler API AST traversal for every import form and returns all violations in fixed order', () => {
    const units = fixtureUnits();
    const program = createProgramFromUnits(units);
    const violations = analyzeProgram(program, units);
    expect(violations.map(({ category, detail }) => `${category}|${detail}`)).toEqual([
      'transaction-product-import|import-type:../../../../store/gameStore',
      'transaction-product-import|dynamic-import:../../../../online/domain/state',
      'transaction-product-import|re-export:../../../../components/Board',
      'transaction-runtime-import|import:React:react',
      'transaction-runtime-import|import-type:Zustand:zustand',
      'transaction-runtime-import|re-export:DOM:dom',
      'transaction-runtime-import|dynamic-import:Cloudflare:cloudflare:workers',
      'transaction-runtime-import|import:WebSocket:ws',
      'transaction-runtime-import|import:IndexedDB:idb',
      'transaction-runtime-import|re-export:Scryfall:scryfall',
      'transaction-nondeterminism|Date.now',
      'transaction-nondeterminism|Math.random',
      'transaction-solo-alias|import-type:import:GameCommand',
      'transaction-solo-alias|re-export:import:CardInstance',
      'transaction-solo-alias|type-reference:SoloCommand',
      'transaction-solo-alias|type-reference:CardInstance',
      'registry-reverse-import|re-export:../stack/transaction/index',
      'announcement-reverse-import|import-type:./transaction/index',
      'product-runtime-transaction-import|dynamic-import:../engine/core/stack/transaction/index',
    ]);
    expect(violations).toEqual(sortViolations(violations));
    expect(new Set(violations.map(({ category }) => category))).toEqual(new Set(violationCategoryOrder));
  });
});
