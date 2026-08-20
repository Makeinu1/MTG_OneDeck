import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import * as Headless from '../../online/headless/index';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const onlineRoot = resolve(repositoryRoot, 'src/online');
const headlessRoot = resolve(onlineRoot, 'headless');
const fixturePath = resolve(headlessRoot, 'fixtures/o4p-02e-local-room-gate-v1.json');
const verifierPath = resolve(repositoryRoot, 'scripts/checks/verify-online-local-room-gate.ts');

const requiredRuntimeExports = [
  'ONLINE_HEADLESS_ROOM_GATE_SCHEMA_VERSION_V1',
  'validateOnlineHeadlessRoomGateInputV1',
  'validateOnlineHeadlessRoomGateReportV1',
  'runLocalOnlineHeadlessRoomGateV1',
  'OnlineHeadlessRoomGateOperationErrorV1',
] as const;

const forbiddenRuntimeExports = [
  'applyCoreCommandV1',
  'buildOnlineHeadlessRoomGateReportV1',
  'configuredCapabilitiesV1',
  'deepFreezeOnlineHeadlessRoomGateV1',
  'readOnlineHeadlessRoomGateRecordV1',
  'sanitizeOnlineHeadlessRoomGateIssuesV1',
] as const;

const publicBarrels = new Set([
  '../../engine/core/index',
  '../../versioning/index',
  '../projection/index',
  '../protocol/index',
  '../room/index',
]);

const allowedCoreImports = new Set([
  'CoreCommandV1',
  'CoreDecisionContextV1',
  'CoreHeadlessClosureReportV1',
  'CorePlayerId',
  'CoreReplayPackageV1',
  'ModeNeutralCoreRootV1',
  'coreCanonicalDigestFromValueV1',
  'replayCoreCommandsV1',
  'runOrdinaryFourPlayerCoreClosureV1',
  'validateCoreCommandV1',
]);

const requiredCoreVerifierSymbols = new Set([
  'coreCanonicalDigestFromValueV1',
  'replayCoreCommandsV1',
  'runOrdinaryFourPlayerCoreClosureV1',
]);

type ModuleReference = Readonly<{
  readonly kind: 'import' | 'export' | 'import-equals' | 'dynamic' | 'type-query' | 'require';
  readonly specifier: string;
}>;

type ImportedBinding = Readonly<{
  readonly imported: string;
  readonly local: string;
  readonly typeOnly: boolean;
}>;

function normalizedPath(filePath: string): string {
  return relative(repositoryRoot, filePath).split(sep).join('/');
}

function productionFiles(root: string): readonly string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const filePath = resolve(root, entry.name);
    if (entry.isDirectory() && entry.name !== '__tests__' && entry.name !== 'fixtures') {
      files.push(...productionFiles(filePath));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(filePath);
    }
  }
  return files.sort();
}

function sourceFile(sourceText: string, filePath: string): ts.SourceFile {
  return ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function moduleReferences(sourceText: string, filePath: string): readonly ModuleReference[] {
  const references: ModuleReference[] = [];
  const literal = (value: ts.Expression | undefined): string =>
    value !== undefined && ts.isStringLiteral(value) ? value.text : '<dynamic-module-specifier>';
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      references.push({ kind: 'import', specifier: literal(node.moduleSpecifier) });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      references.push({ kind: 'export', specifier: literal(node.moduleSpecifier) });
    } else if (ts.isImportEqualsDeclaration(node)) {
      const reference = node.moduleReference;
      references.push({
        kind: 'import-equals',
        specifier:
          ts.isExternalModuleReference(reference) && reference.expression
            ? literal(reference.expression)
            : '<dynamic-module-specifier>',
      });
    } else if (ts.isImportTypeNode(node)) {
      const argument = node.argument;
      references.push({
        kind: 'type-query',
        specifier:
          ts.isLiteralTypeNode(argument) && ts.isStringLiteral(argument.literal)
            ? argument.literal.text
            : '<dynamic-module-specifier>',
      });
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      references.push({ kind: 'dynamic', specifier: literal(node.arguments[0]) });
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require'
    ) {
      references.push({ kind: 'require', specifier: literal(node.arguments[0]) });
    } else if (
      ts.isIdentifier(node) &&
      node.text === 'require' &&
      !(ts.isCallExpression(node.parent) && node.parent.expression === node)
    ) {
      references.push({ kind: 'require', specifier: '<indirect-require>' });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile(sourceText, filePath));
  return references;
}

function importedBindings(
  sourceText: string,
  filePath: string,
  specifier: string,
): readonly ImportedBinding[] {
  const bindings: ImportedBinding[] = [];
  for (const statement of sourceFile(sourceText, filePath).statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== specifier
    ) {
      continue;
    }
    const clause = statement.importClause;
    if (!clause) continue;
    if (clause.name) {
      bindings.push({ imported: 'default', local: clause.name.text, typeOnly: clause.isTypeOnly });
    }
    const named = clause.namedBindings;
    if (!named) continue;
    if (ts.isNamespaceImport(named)) {
      bindings.push({ imported: '*', local: named.name.text, typeOnly: clause.isTypeOnly });
    } else {
      for (const element of named.elements) {
        bindings.push({
          imported: element.propertyName?.text ?? element.name.text,
          local: element.name.text,
          typeOnly: clause.isTypeOnly || element.isTypeOnly,
        });
      }
    }
  }
  return bindings;
}

function callCounts(sourceText: string, filePath: string): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      counts.set(node.expression.text, (counts.get(node.expression.text) ?? 0) + 1);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile(sourceText, filePath));
  return counts;
}

function architectureAllowsProbe(sourceText: string): boolean {
  const filePath = resolve(headlessRoot, 'probe.ts');
  const references = moduleReferences(sourceText, filePath);
  if (
    references.length === 0 ||
    references.some(({ kind, specifier }) => {
      const local = specifier.startsWith('./') && !specifier.includes('..');
      return (
        !['import', 'export', 'type-query'].includes(kind) ||
        (!local && !publicBarrels.has(specifier))
      );
    })
  ) {
    return false;
  }
  return importedBindings(sourceText, filePath, '../../engine/core/index').every(
    ({ imported }) => imported !== '*' && allowedCoreImports.has(imported),
  );
}

describe('O4P-02E local headless room gate architecture boundary', () => {
  it('pins the public surface, capability-free fixture, verifier, machine step, and domain lane', () => {
    for (const name of requiredRuntimeExports) {
      expect(Object.prototype.hasOwnProperty.call(Headless, name), name).toBe(true);
    }
    for (const name of forbiddenRuntimeExports) {
      expect(Object.prototype.hasOwnProperty.call(Headless, name), name).toBe(false);
    }
    expect(Headless.ONLINE_HEADLESS_ROOM_GATE_SCHEMA_VERSION_V1).toBe(1);
    expect(existsSync(fixturePath)).toBe(true);
    expect(existsSync(verifierPath)).toBe(true);

    const fixtureText = readFileSync(fixturePath, 'utf8');
    const fixture = JSON.parse(fixtureText) as Record<string, unknown>;
    expect(fixture).toMatchObject({
      version: 'o4p-02e-local-room-gate-v1',
      schemaVersion: 1,
      protocolVersion: 1,
      privacyWitness: {
        distinctPlayerHands: 4,
        distinctPlayerLibraries: 4,
        tableHasCorePlayerId: false,
        projectionsExcludedFromReport: true,
      },
      replayWitness: {
        acceptedUniqueCommands: 2,
        duplicateExcluded: true,
        tamperedFails: true,
        reorderedFails: true,
        omittedFails: true,
      },
      transportBoundary: {
        inMemoryOnly: true,
        network: false,
        clockOrRandomness: false,
        persistence: false,
        ui: false,
      },
    });
    expect(fixtureText).not.toMatch(/(?:seat|observer|participant)[_-]?capabilit/i);
    expect(fixtureText).not.toMatch(/(?:AAAAAAAA|BBBBBBBB|CCCCCCCC|DDDDDDDD|TTTTTTTT)/);

    const packageJson = JSON.parse(
      readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'),
    ) as {
      scripts?: Record<string, unknown>;
    };
    expect(packageJson.scripts?.['verify:online-local-room-gate']).toBe(
      'tsx scripts/checks/verify-online-local-room-gate.ts',
    );
    expect(
      readFileSync(resolve(repositoryRoot, 'scripts/checks/machine-checks.mjs'), 'utf8'),
    ).toContain("args: ['run', 'verify:online-local-room-gate']");
    expect(readFileSync(resolve(repositoryRoot, 'scripts/checks/tsconfig.json'), 'utf8')).toContain(
      'verify-online-local-room-gate.ts',
    );
    const domains = JSON.parse(
      readFileSync(resolve(repositoryRoot, 'scripts/checks/validation-domains.json'), 'utf8'),
    ) as { domains?: Array<{ id?: string; sourcePatterns?: string[] }> };
    expect(domains.domains?.filter(({ id }) => id === 'online-headless')).toEqual([
      expect.objectContaining({ sourcePatterns: ['src/online/headless/**'] }),
    ]);
  });

  it('allows only local modules and the five frozen public barrels without ambient effects', () => {
    expect(existsSync(resolve(onlineRoot, 'index.ts'))).toBe(false);
    const files = productionFiles(headlessRoot);
    expect(files.length).toBeGreaterThanOrEqual(2);
    expect(files.map(normalizedPath)).toContain('src/online/headless/index.ts');
    const forbiddenSource =
      /Math\.random|Date\.now|new\s+Date|setTimeout|setInterval|fetch\s*\(|new\s+WebSocket|WebSocket\s*\(|cloudflare:|@cloudflare|localStorage|indexedDB|sessionStorage|process\.env|import\.meta\.env|from\s+['"](?:react|react-dom|zustand|idb)|console\./i;
    for (const filePath of files) {
      const sourceText = readFileSync(filePath, 'utf8');
      expect(sourceText, normalizedPath(filePath)).not.toMatch(forbiddenSource);
      for (const reference of moduleReferences(sourceText, filePath)) {
        expect(
          ['import', 'export', 'type-query'],
          `${normalizedPath(filePath)} ${reference.kind}`,
        ).toContain(reference.kind);
        const local = reference.specifier.startsWith('./') && !reference.specifier.includes('..');
        expect(
          local || publicBarrels.has(reference.specifier),
          `${normalizedPath(filePath)} ${reference.kind} ${reference.specifier}`,
        ).toBe(true);
      }
    }
  });

  it('permits only the named Core closure, digest, replay, validation, and type surface', () => {
    const seenRuntimeVerifierSymbols = new Set<string>();
    let coreImportCount = 0;
    for (const filePath of productionFiles(headlessRoot)) {
      const sourceText = readFileSync(filePath, 'utf8');
      const calls = callCounts(sourceText, filePath);
      for (const binding of importedBindings(sourceText, filePath, '../../engine/core/index')) {
        coreImportCount += 1;
        expect(binding.imported, normalizedPath(filePath)).not.toBe('*');
        expect(allowedCoreImports.has(binding.imported), normalizedPath(filePath)).toBe(true);
        if (!binding.typeOnly && requiredCoreVerifierSymbols.has(binding.imported)) {
          seenRuntimeVerifierSymbols.add(binding.imported);
          expect(calls.get(binding.local) ?? 0, `${binding.imported} call count`).toBeGreaterThan(
            0,
          );
        }
      }
    }
    expect(coreImportCount).toBeGreaterThan(0);
    expect(seenRuntimeVerifierSymbols).toEqual(requiredCoreVerifierSymbols);
  });

  it('rejects reducers, mutation aliases, namespaces, dynamic forms, and escaping modules', () => {
    const probes = [
      "import { applyCoreCommandV1 as reduce } from '../../engine/core/index'; reduce(root, command);",
      "import { createModeNeutralCoreRootV1 as mutate } from '../../engine/core/index'; mutate(input);",
      "import * as Core from '../../engine/core/index'; Core.applyCoreCommandV1(root, command);",
      "const target = '../../engine/core/index'; void import(target);",
      "require('../../engine/core/index');",
      "import '../../engine/core/closure';",
      "import '../../../store/gameStore';",
      "import '../protocol/command';",
    ];
    for (const probe of probes) expect(architectureAllowsProbe(probe), probe).toBe(false);
  });

  it('uses D projection exactly once per projection action and no separate C snapshot operation', () => {
    let projectedSnapshotImports = 0;
    let projectedSnapshotCalls = 0;
    for (const filePath of productionFiles(headlessRoot)) {
      const sourceText = readFileSync(filePath, 'utf8');
      const calls = callCounts(sourceText, filePath);
      for (const binding of importedBindings(sourceText, filePath, '../projection/index')) {
        if (binding.imported === 'handleOnlineProjectedSnapshotRequestV1') {
          projectedSnapshotImports += 1;
          projectedSnapshotCalls += calls.get(binding.local) ?? 0;
        }
      }
      for (const binding of importedBindings(sourceText, filePath, '../protocol/index')) {
        expect(binding.imported).not.toBe('handleOnlineSnapshotRequestV1');
      }
    }
    expect(projectedSnapshotImports).toBe(1);
    expect(projectedSnapshotCalls).toBe(1);
  });

  it('prevents reverse dependencies and limits src/online to the registered module kinds', () => {
    for (const root of [
      resolve(repositoryRoot, 'src/engine/core'),
      resolve(onlineRoot, 'room'),
      resolve(onlineRoot, 'protocol'),
      resolve(onlineRoot, 'projection'),
    ]) {
      for (const filePath of productionFiles(root)) {
        expect(readFileSync(filePath, 'utf8'), normalizedPath(filePath)).not.toMatch(
          /online\/headless|\.\.\/headless/,
        );
      }
    }
    const onlineKinds = readdirSync(onlineRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map(({ name }) => name)
      .sort();
    expect(onlineKinds).toEqual(['architecture', 'bootstrap', 'cloudflare', 'displayPairing', 'guidedActions', 'headless', 'lobby', 'projection', 'protocol', 'room', 'tableDisplay', 'workbench']);
  });
});
