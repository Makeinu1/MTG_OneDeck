import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';

import { describe, expect, it } from 'vitest';

type ImportReferenceKind = 'import' | 'import-type' | 're-export' | 'dynamic-import' | 'import-equals';

interface SourceUnit {
  filePath: string;
  sourceText: string;
}

interface ImportReference {
  filePath: string;
  kind: ImportReferenceKind;
  specifier: string;
  importedNames: readonly string[];
}

interface BoundaryViolation {
  filePath: string;
  kind: ImportReferenceKind;
  rule: string;
  specifier: string;
}

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const sourceRoot = resolve(repositoryRoot, 'src');
const ignoredDirectoryNames = new Set(['node_modules', 'dist', 'coverage']);

function normalizedPath(value: string): string {
  return value.split('\\').join('/').split(sep).join('/');
}

function relativeSourcePath(filePath: string): string {
  const unitSourceRoot = sourceRootForFile(filePath);
  return normalizedPath(relative(dirname(unitSourceRoot), filePath));
}

function sourceRootForFile(filePath: string): string {
  const normalized = normalizedPath(filePath);
  const marker = '/src/';
  const sourceIndex = normalized.lastIndexOf(marker);
  return sourceIndex >= 0 ? normalized.slice(0, sourceIndex + '/src'.length) : sourceRoot;
}

function isWithin(parent: string, candidate: string): boolean {
  const child = relative(parent, candidate);
  return child !== '' && !child.startsWith('..') && !isAbsolute(child);
}

function sourceFileCandidates(basePath: string): string[] {
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
  let basePath: string;
  if (specifier.startsWith('.')) {
    basePath = resolve(dirname(filePath), specifier);
  } else if (specifier.startsWith('src/')) {
    basePath = resolve(repositoryRoot, specifier);
  } else {
    return null;
  }

  return sourceFileCandidates(basePath).find((candidate) => {
    try {
      return statSync(candidate).isFile();
    } catch {
      return false;
    }
  }) ?? basePath;
}

function importedNames(node: ts.ImportDeclaration | ts.ExportDeclaration): string[] {
  if (ts.isImportDeclaration(node)) {
    const clause = node.importClause;
    if (!clause) return [];
    if (!clause.namedBindings) return clause.name ? [clause.name.text] : [];
    if (ts.isNamespaceImport(clause.namedBindings)) return [clause.namedBindings.name.text];
    return clause.namedBindings.elements.map((element) => element.propertyName?.text ?? element.name.text);
  }

  const clause = node.exportClause;
  if (!clause || ts.isNamespaceExport(clause)) return [];
  return clause.elements.map((element) => element.propertyName?.text ?? element.name.text);
}

function importReferences(unit: SourceUnit): ImportReference[] {
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
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return references;
}

function moduleMatches(specifier: string, moduleName: string): boolean {
  return specifier === moduleName || specifier.startsWith(`${moduleName}/`);
}

function isReactOrZustand(specifier: string): boolean {
  return moduleMatches(specifier, 'react')
    || moduleMatches(specifier, 'react-dom')
    || moduleMatches(specifier, 'zustand');
}

function isDomRuntime(specifier: string): boolean {
  return moduleMatches(specifier, 'dom') || moduleMatches(specifier, 'jsdom');
}

function sourceTargetMatches(targetPath: string, basePath: string): boolean {
  const normalizedTarget = normalizedPath(targetPath);
  const normalizedBase = normalizedPath(basePath);
  return normalizedTarget === normalizedBase
    || normalizedTarget === `${normalizedBase}.ts`
    || normalizedTarget === `${normalizedBase}.tsx`;
}

function isCloudflareRuntime(specifier: string): boolean {
  return specifier.startsWith('cloudflare:')
    || specifier.startsWith('@cloudflare/')
    || moduleMatches(specifier, 'workerd');
}

function targetHasSegment(targetPath: string, segment: string): boolean {
  return normalizedPath(targetPath).split('/').includes(segment);
}

function addViolation(
  violations: BoundaryViolation[],
  reference: ImportReference,
  rule: string,
): void {
  violations.push({
    filePath: relativeSourcePath(reference.filePath),
    kind: reference.kind,
    rule,
    specifier: reference.specifier,
  });
}

function isSoloUiUnit(unit: SourceUnit): boolean {
  const path = relativeSourcePath(unit.filePath);
  return path === 'src/App.tsx' || path.startsWith('src/components/');
}

function inspectReference(
  unit: SourceUnit,
  reference: ImportReference,
  violations: BoundaryViolation[],
): void {
  const unitSourceRoot = sourceRootForFile(unit.filePath);
  const targetPath = resolveSourceTarget(unit.filePath, reference.specifier);
  const isEngine = targetHasSegment(unit.filePath, 'engine') && isWithin(unitSourceRoot, unit.filePath);
  const isStore = targetHasSegment(unit.filePath, 'store') && isWithin(unitSourceRoot, unit.filePath);
  const isSnapshot = normalizedPath(unit.filePath) === normalizedPath(resolve(unitSourceRoot, 'data/gameSnapshot.ts'));
  const isOnlineDomain = targetHasSegment(unit.filePath, 'domain')
    && targetHasSegment(unit.filePath, 'online')
    && isWithin(unitSourceRoot, unit.filePath);
  const isOnlineServer = targetHasSegment(unit.filePath, 'server')
    && targetHasSegment(unit.filePath, 'online')
    && isWithin(unitSourceRoot, unit.filePath);
  const isOnlineUi = targetHasSegment(unit.filePath, 'ui')
    && targetHasSegment(unit.filePath, 'online')
    && isWithin(unitSourceRoot, unit.filePath);

  if (isEngine) {
    if (targetPath && isWithin(resolve(unitSourceRoot, 'store'), targetPath)) addViolation(violations, reference, 'engine-no-store');
    if (targetPath && isWithin(resolve(unitSourceRoot, 'components'), targetPath)) addViolation(violations, reference, 'engine-no-components');
    if (targetPath && isWithin(resolve(unitSourceRoot, 'online'), targetPath)) addViolation(violations, reference, 'engine-no-online');
    if (isReactOrZustand(reference.specifier)) addViolation(violations, reference, 'engine-no-react-zustand');
    if (isCloudflareRuntime(reference.specifier)) addViolation(violations, reference, 'engine-no-cloudflare-runtime');
  }

  if (isStore) {
    if (targetPath && isWithin(resolve(unitSourceRoot, 'online/server'), targetPath)) addViolation(violations, reference, 'store-no-online-server');
    if (targetPath && isWithin(resolve(unitSourceRoot, 'online/transport'), targetPath)) addViolation(violations, reference, 'store-no-online-transport');
    if (isCloudflareRuntime(reference.specifier)) addViolation(violations, reference, 'store-no-cloudflare-runtime');
  }

  if (isSoloUiUnit(unit) && targetPath && isWithin(resolve(unitSourceRoot, 'online'), targetPath)) {
    addViolation(violations, reference, 'solo-ui-no-online');
  }

  if (isSnapshot) {
    if (targetPath && isWithin(resolve(unitSourceRoot, 'online'), targetPath)) addViolation(violations, reference, 'snapshot-no-online');
    if (reference.importedNames.includes('protocolVersion') || reference.importedNames.includes('stateSchemaVersion')) {
      addViolation(violations, reference, 'snapshot-no-online-version-substitute');
    }
  }

  if (isOnlineDomain) {
    if (targetPath && isWithin(resolve(unitSourceRoot, 'store'), targetPath)) addViolation(violations, reference, 'online-domain-no-store');
    if (targetPath && isWithin(resolve(unitSourceRoot, 'components'), targetPath)) addViolation(violations, reference, 'online-domain-no-components');
    if (targetPath && isSnapshotTarget(targetPath, unitSourceRoot)) addViolation(violations, reference, 'online-domain-no-snapshot');
    if (isReactOrZustand(reference.specifier)) addViolation(violations, reference, 'online-domain-no-react-zustand');
    if (isDomRuntime(reference.specifier)) addViolation(violations, reference, 'online-domain-no-dom');
    if (isCloudflareRuntime(reference.specifier)) addViolation(violations, reference, 'online-domain-no-cloudflare-runtime');
  }

  if (isOnlineServer) {
    if (targetPath && isWithin(resolve(unitSourceRoot, 'store'), targetPath)) addViolation(violations, reference, 'online-server-no-store');
    if (targetPath && isWithin(resolve(unitSourceRoot, 'components'), targetPath)) addViolation(violations, reference, 'online-server-no-components');
    if (targetPath && sourceTargetMatches(targetPath, resolve(unitSourceRoot, 'App'))) addViolation(violations, reference, 'online-server-no-app');
  }

  if (isOnlineUi) {
    if (targetPath && sourceTargetMatches(targetPath, resolve(unitSourceRoot, 'store/gameStore'))) addViolation(violations, reference, 'online-ui-no-game-store');
    if (targetPath && isSnapshotTarget(targetPath, unitSourceRoot)) addViolation(violations, reference, 'online-ui-no-snapshot');
    if (targetPath && isWithin(resolve(unitSourceRoot, 'online/server'), targetPath)) addViolation(violations, reference, 'online-ui-no-server');
    if (targetPath && isDurableObjectTarget(targetPath)) addViolation(violations, reference, 'online-ui-no-durable-object');
  }
}

function isSnapshotTarget(targetPath: string, unitSourceRoot: string): boolean {
  return sourceTargetMatches(targetPath, resolve(unitSourceRoot, 'data/gameSnapshot'))
    || normalizedPath(targetPath).endsWith('/data/gameSnapshot');
}

function isDurableObjectTarget(targetPath: string): boolean {
  return normalizedPath(targetPath).split('/').some((segment) => /durable[-_]?object/i.test(segment));
}

function sortViolations(left: BoundaryViolation, right: BoundaryViolation): number {
  return left.filePath.localeCompare(right.filePath)
    || left.specifier.localeCompare(right.specifier)
    || left.kind.localeCompare(right.kind)
    || left.rule.localeCompare(right.rule);
}

function sortViolationKeys(left: string, right: string): number {
  const [, leftFile, leftKind, leftSpecifier] = left.split('|');
  const [, rightFile, rightKind, rightSpecifier] = right.split('|');
  return leftFile.localeCompare(rightFile)
    || leftSpecifier.localeCompare(rightSpecifier)
    || leftKind.localeCompare(rightKind)
    || left.localeCompare(right);
}

function analyzeSources(units: readonly SourceUnit[]): BoundaryViolation[] {
  const violations: BoundaryViolation[] = [];
  for (const unit of units) {
    for (const reference of importReferences(unit)) {
      inspectReference(unit, reference, violations);
    }
  }
  return violations.sort(sortViolations);
}

function collectSourceUnits(root: string): SourceUnit[] {
  const files: string[] = [];
  function visit(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        // Engine test fixtures intentionally exercise the Store; this gate is
        // for production dependency direction, while synthetic fixtures below
        // cover prohibited forms without importing them into the repository.
        if (!ignoredDirectoryNames.has(entry.name) && entry.name !== '__tests__') visit(resolve(directory, entry.name));
        continue;
      }
      if (
        !entry.isFile()
        || !/\.(ts|tsx)$/.test(entry.name)
        || entry.name.endsWith('.d.ts')
        || /\.(test|spec)\.(ts|tsx)$/.test(entry.name)
      ) continue;
      files.push(resolve(directory, entry.name));
    }
  }
  visit(resolve(root, 'src'));
  return files.sort().map((filePath) => ({ filePath, sourceText: readFileSync(filePath, 'utf8') }));
}

describe('Solo/Online dependency boundary', () => {
  it('passes for the current repository without creating an Online runtime', () => {
    expect(existsSync(resolve(sourceRoot, 'online'))).toBe(false);
    expect(analyzeSources(collectSourceUnits(repositoryRoot))).toEqual([]);
  });

  it('detects type-only imports, re-exports, dynamic imports, and every forbidden boundary', () => {
    const root = '/virtual/repository';
    const fixtures: SourceUnit[] = [
      {
        filePath: `${root}/src/engine/forbidden.ts`,
        sourceText: [
          "import type { GameStore } from '../store/gameStore';",
          "export { Board } from '../components/Board';",
          "const load = () => import('../online/domain/state');",
          "import React from 'react';",
          "import 'cloudflare:workers';",
        ].join('\n'),
      },
      {
        filePath: `${root}/src/store/forbidden.ts`,
        sourceText: [
          "import type { Room } from '../online/server/room';",
          "export { connect } from '../online/transport/client';",
          "import 'cloudflare:workers';",
        ].join('\n'),
      },
      {
        filePath: `${root}/src/data/gameSnapshot.ts`,
        sourceText: [
          "import { protocolVersion, stateSchemaVersion } from '../versioning/contractVersions';",
          "export type { OnlineState } from '../online/domain/state';",
        ].join('\n'),
      },
      {
        filePath: `${root}/src/online/domain/state.ts`,
        sourceText: [
          "import type { GameStore } from '../../store/gameStore';",
          "export type { Board } from '../../components/Board';",
          "const snapshot = () => import('../../data/gameSnapshot');",
          "import React from 'react';",
          "import { create } from 'zustand';",
          "import 'cloudflare:workers';",
          "import 'jsdom';",
        ].join('\n'),
      },
      {
        filePath: `${root}/src/online/server/room.ts`,
        sourceText: [
          "import { useGameStore } from '../../store/gameStore';",
          "export { Board } from '../../components/Board';",
          "import '../../App';",
        ].join('\n'),
      },
      {
        filePath: `${root}/src/online/ui/view.ts`,
        sourceText: [
          "import { useGameStore } from '../../store/gameStore';",
          "export { loadSnapshot } from '../../data/gameSnapshot';",
          "import '../../online/server/room';",
          "import '../../online/server/durable-object';",
        ].join('\n'),
      },
      {
        filePath: `${root}/src/engine/allowed.ts`,
        sourceText: "import { initGame } from './init';\nimport type { GameState } from './types';",
      },
      {
        filePath: `${root}/src/App.tsx`,
        sourceText: "import type { OnlineState } from './online/domain/state';",
      },
      {
        filePath: `${root}/src/components/SoloView.tsx`,
        sourceText: "const load = () => import('../online/transport/client');",
      },
    ];

    const violations = analyzeSources(fixtures);
    const violationKeys = violations.map((violation) => [
      violation.rule,
      violation.filePath,
      violation.kind,
      violation.specifier,
    ].join('|'));
    const expectedKeys = [
      'engine-no-store|src/engine/forbidden.ts|import-type|../store/gameStore',
      'engine-no-components|src/engine/forbidden.ts|re-export|../components/Board',
      'engine-no-online|src/engine/forbidden.ts|dynamic-import|../online/domain/state',
      'engine-no-react-zustand|src/engine/forbidden.ts|import|react',
      'engine-no-cloudflare-runtime|src/engine/forbidden.ts|import|cloudflare:workers',
      'store-no-online-server|src/store/forbidden.ts|import-type|../online/server/room',
      'store-no-online-transport|src/store/forbidden.ts|re-export|../online/transport/client',
      'store-no-cloudflare-runtime|src/store/forbidden.ts|import|cloudflare:workers',
      'snapshot-no-online-version-substitute|src/data/gameSnapshot.ts|import|../versioning/contractVersions',
      'snapshot-no-online|src/data/gameSnapshot.ts|re-export|../online/domain/state',
      'online-domain-no-store|src/online/domain/state.ts|import-type|../../store/gameStore',
      'online-domain-no-components|src/online/domain/state.ts|re-export|../../components/Board',
      'online-domain-no-snapshot|src/online/domain/state.ts|dynamic-import|../../data/gameSnapshot',
      'online-domain-no-react-zustand|src/online/domain/state.ts|import|react',
      'online-domain-no-react-zustand|src/online/domain/state.ts|import|zustand',
      'online-domain-no-dom|src/online/domain/state.ts|import|jsdom',
      'online-domain-no-cloudflare-runtime|src/online/domain/state.ts|import|cloudflare:workers',
      'online-server-no-store|src/online/server/room.ts|import|../../store/gameStore',
      'online-server-no-components|src/online/server/room.ts|re-export|../../components/Board',
      'online-server-no-app|src/online/server/room.ts|import|../../App',
      'online-ui-no-game-store|src/online/ui/view.ts|import|../../store/gameStore',
      'online-ui-no-snapshot|src/online/ui/view.ts|re-export|../../data/gameSnapshot',
      'online-ui-no-server|src/online/ui/view.ts|import|../../online/server/room',
      'online-ui-no-server|src/online/ui/view.ts|import|../../online/server/durable-object',
      'online-ui-no-durable-object|src/online/ui/view.ts|import|../../online/server/durable-object',
      'solo-ui-no-online|src/App.tsx|import-type|./online/domain/state',
      'solo-ui-no-online|src/components/SoloView.tsx|dynamic-import|../online/transport/client',
    ].sort(sortViolationKeys);

    expect(violationKeys).toEqual(expectedKeys);
    expect(violations).toEqual([...violations].sort(sortViolations));
    expect(analyzeSources([fixtures[6]])).toEqual([]);
  });

  it('normalizes Windows and POSIX separators before ordering paths', () => {
    expect(normalizedPath('src\\online\\domain\\state.ts')).toBe('src/online/domain/state.ts');
    expect(normalizedPath('src/engine/allowed.ts')).toBe('src/engine/allowed.ts');
  });
});
