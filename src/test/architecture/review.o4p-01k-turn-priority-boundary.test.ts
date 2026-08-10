import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

type SourceUnit = Readonly<{ filePath: string; sourceText: string }>;
type ImportReference = Readonly<{ filePath: string; specifier: string; kind: 'static' | 'type-only' | 'dynamic' | 're-export' }>;

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const sourceRoot = resolve(repositoryRoot, 'src');
const coreRoot = resolve(sourceRoot, 'engine/core');
const turnRoot = resolve(coreRoot, 'turn');

function normalized(value: string): string {
  return value.split(sep).join('/');
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sourceFiles(root: string): readonly SourceUnit[] {
  if (!existsSync(root)) return [];
  const result: SourceUnit[] = [];
  function visit(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!['__tests__', 'node_modules', 'dist', 'coverage'].includes(entry.name)) visit(resolve(directory, entry.name));
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) {
        const filePath = resolve(directory, entry.name);
        result.push({ filePath, sourceText: readFileSync(filePath, 'utf8') });
      }
    }
  }
  visit(root);
  return result.sort((left, right) => compare(normalized(relative(repositoryRoot, left.filePath)), normalized(relative(repositoryRoot, right.filePath))));
}

function sourceFile(unit: SourceUnit): ts.SourceFile {
  return ts.createSourceFile(
    unit.filePath,
    unit.sourceText,
    ts.ScriptTarget.Latest,
    true,
    unit.filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function references(unit: SourceUnit): readonly ImportReference[] {
  const file = sourceFile(unit);
  const result: ImportReference[] = [];
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const typeOnly = node.importClause?.isTypeOnly === true
        || (node.importClause?.namedBindings !== undefined
          && ts.isNamedImports(node.importClause.namedBindings)
          && node.importClause.namedBindings.elements.some((element) => element.isTypeOnly));
      result.push({
        filePath: unit.filePath,
        specifier: node.moduleSpecifier.text,
        kind: typeOnly ? 'type-only' : 'static',
      });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      result.push({
        filePath: unit.filePath,
        specifier: node.moduleSpecifier.text,
        kind: node.isTypeOnly ? 'type-only' : 're-export',
      });
    } else if (
      ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length === 1
      && ts.isStringLiteral(node.arguments[0])
    ) {
      result.push({ filePath: unit.filePath, specifier: node.arguments[0].text, kind: 'dynamic' });
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return result;
}

function sourceTarget(unit: SourceUnit, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(dirname(unit.filePath), specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

function forbiddenDependency(specifier: string, target: string | null): string | null {
  const value = `${specifier} ${target === null ? '' : normalized(relative(repositoryRoot, target))}`.toLowerCase();
  if (/(^|[/.])store([/.]|$)|components|src\/online|\/online\/|\breact\b|\bzustand\b|dom|cloudflare|websocket|indexeddb|scryfall/.test(value)) return 'forbidden-runtime-import';
  return null;
}

function boundaryViolations(units: readonly SourceUnit[], scanAllUnits = false): readonly string[] {
  const violations: string[] = [];
  const turnFiles = scanAllUnits ? units : units.filter((unit) => {
    const path = normalized(relative(repositoryRoot, unit.filePath));
    return path === 'src/engine/core/turn' || path.startsWith('src/engine/core/turn/');
  });
  for (const unit of turnFiles) {
    const path = normalized(relative(repositoryRoot, unit.filePath));
    const file = sourceFile(unit);
    for (const reference of references(unit)) {
      const target = sourceTarget(unit, reference.specifier);
      const dependency = forbiddenDependency(reference.specifier, target);
      if (dependency !== null) violations.push(`${path}|${dependency}|${reference.kind}|${reference.specifier}`);
      const targetPath = target === null ? '' : normalized(relative(repositoryRoot, target));
      if (targetPath.startsWith('src/engine/core/turn/') === false && targetPath.startsWith('src/engine/core/turn') === false && !reference.specifier.startsWith('.')) {
        if (/^(react|react-dom|zustand|idb|fake-indexeddb|node:|src\/store|src\/components|src\/online)/.test(reference.specifier)) {
          violations.push(`${path}|product-runtime-import|${reference.kind}|${reference.specifier}`);
        }
      }
    }
    function visit(node: ts.Node): void {
      if (ts.isPropertyAccessExpression(node)) {
        const text = node.getText(file);
        if (text === 'Date.now' || text === 'Math.random') violations.push(`${path}|forbidden-time-random|${text}`);
      }
      if (ts.isImportSpecifier(node)) {
        const alias = node.name.text;
        const original = node.propertyName?.text;
        if (alias === 'Solo' || alias.startsWith('Solo') || original === 'Solo') violations.push(`${path}|solo-alias|${alias}`);
      }
      if (ts.isNamespaceImport(node) || ts.isImportClause(node)) {
        const alias = ts.isNamespaceImport(node) ? node.name.text : node.name?.text;
        if (alias !== undefined && (alias === 'Solo' || alias.startsWith('Solo'))) violations.push(`${path}|solo-alias|${alias}`);
      }
      if (ts.isHeritageClause(node)) {
        for (const type of node.types) {
          const expression = type.expression.getText(file);
          if (expression === 'Solo' || expression.startsWith('Solo')) violations.push(`${path}|solo-extends|${expression}`);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(file);
  }

  for (const unit of units) {
    const path = normalized(relative(repositoryRoot, unit.filePath));
    if (path === 'src/engine/core/index.ts' || path.startsWith('src/engine/core/turn/')) continue;
    for (const reference of references(unit)) {
      const target = sourceTarget(unit, reference.specifier);
      const targetPath = target === null ? '' : normalized(relative(repositoryRoot, target));
      if (targetPath.startsWith('src/engine/core/turn/')
        && !path.startsWith('src/engine/core/rules/')) {
        violations.push(`${path}|reverse-import|${reference.kind}|${reference.specifier}`);
      }
    }
  }
  return violations.sort(compare);
}

function syntheticViolations(): readonly string[] {
  const unit: SourceUnit = {
    filePath: resolve(repositoryRoot, 'synthetic-boundary.ts'),
    sourceText: [
      "import type { State as SoloState } from 'src/store/state';",
      "import { ReactNode } from 'react';",
      "export type { OnlineState } from './online/runtime';",
      "const load = import('zustand');",
      'class Derived extends SoloBase {}',
      'Date.now(); Math.random();',
    ].join('\n'),
  };
  return boundaryViolations([unit], true);
}

describe('O4P-01K pure Core turn architecture boundary', () => {
  it('uses the TypeScript Compiler API and returns all actual boundary violations in fixed order', () => {
    expect(existsSync(turnRoot)).toBe(true);
    expect(syntheticViolations()).toEqual([
      'synthetic-boundary.ts|forbidden-runtime-import|dynamic|zustand',
      'synthetic-boundary.ts|forbidden-runtime-import|static|react',
      'synthetic-boundary.ts|forbidden-runtime-import|type-only|./online/runtime',
      'synthetic-boundary.ts|forbidden-runtime-import|type-only|src/store/state',
      'synthetic-boundary.ts|forbidden-time-random|Date.now',
      'synthetic-boundary.ts|forbidden-time-random|Math.random',
      'synthetic-boundary.ts|product-runtime-import|dynamic|zustand',
      'synthetic-boundary.ts|product-runtime-import|static|react',
      'synthetic-boundary.ts|product-runtime-import|type-only|src/store/state',
      'synthetic-boundary.ts|solo-alias|SoloState',
      'synthetic-boundary.ts|solo-extends|SoloBase',
    ]);
  });

  it('keeps turn production imports, dynamic imports, type-only imports, and re-exports inside pure Core', () => {
    const violations = boundaryViolations(sourceFiles(turnRoot));
    expect(violations).toEqual([]);
  });

  it('pins reverse-import absence and product runtime absence across the whole source tree', () => {
    const violations = boundaryViolations(sourceFiles(sourceRoot));
    expect(violations).toEqual([]);
    for (const directory of ['domain', 'server', 'transport', 'ui']) {
      expect(existsSync(resolve(sourceRoot, 'online', directory))).toBe(false);
    }
    expect(existsSync(resolve(sourceRoot, 'online/index.ts'))).toBe(false);
  }, 20000);

  it('pins the additive boundary without changing Solo or version/package surfaces', () => {
    expect(existsSync(resolve(sourceRoot, 'App.tsx'))).toBe(true);
    expect(existsSync(resolve(repositoryRoot, 'package.json'))).toBe(true);
    expect(existsSync(resolve(repositoryRoot, 'package-lock.json'))).toBe(true);
    const turnSources = sourceFiles(turnRoot);
    expect(turnSources.every((unit) => !/CURRENT_CONTRACT_VERSIONS|SNAPSHOT_VERSION|GameState|Solo|Date\.now|Math\.random/.test(unit.sourceText))).toBe(true);
  });
});
