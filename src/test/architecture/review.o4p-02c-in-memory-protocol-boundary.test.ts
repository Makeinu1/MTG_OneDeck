import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import * as Protocol from '../../online/protocol';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const protocolRoot = resolve(repositoryRoot, 'src/online/protocol');
const fixturePath = resolve(protocolRoot, 'fixtures/o4p-02c-in-memory-protocol-v1.json');
const verifierPath = resolve(repositoryRoot, 'scripts/checks/verify-online-in-memory-protocol.ts');

const requiredRuntimeExports = [
  'ONLINE_PROTOCOL_SCHEMA_VERSION_V1',
  'isOnlineProtocolCommandIdV1',
  'validateOnlineClientHelloV1',
  'validateOnlineCommandEnvelopeV1',
  'validateOnlineSnapshotRequestV1',
  'validateOnlineProtocolStateV1',
  'createOnlineProtocolStateV1',
  'handleOnlineClientHelloV1',
  'handleOnlineCommandEnvelopeV1',
  'handleOnlineSnapshotRequestV1',
  'OnlineProtocolCreationErrorV1',
  'OnlineProtocolOperationErrorV1',
] as const;

const forbiddenRuntimeExports = [
  'authenticateProtocolParticipant',
  'buildProtocolStateV1',
  'freezeProtocolIssues',
  'protocolStateCapabilities',
  'readDenseArray',
  'readExactRecord',
  'requestDigest',
] as const;

const expectedProductionFiles = [
  'src/online/protocol/auth.ts',
  'src/online/protocol/command.ts',
  'src/online/protocol/errors.ts',
  'src/online/protocol/hello.ts',
  'src/online/protocol/index.ts',
  'src/online/protocol/snapshot.ts',
  'src/online/protocol/state.ts',
  'src/online/protocol/support.ts',
  'src/online/protocol/types.ts',
  'src/online/protocol/validation.ts',
] as const;

const allowedModuleSpecifiers = new Set([
  '../../engine/core/index',
  '../../versioning/index',
  '../room/index',
  './auth',
  './command',
  './errors',
  './hello',
  './snapshot',
  './state',
  './support',
  './types',
  './validation',
]);

const exactCoreImports = new Map<string, ReadonlySet<string>>([
  [
    'src/online/protocol/command.ts',
    new Set(['applyCoreCommandV1', 'coreCanonicalDigestFromValueV1']),
  ],
  [
    'src/online/protocol/state.ts',
    new Set(['ModeNeutralCoreRootV1', 'validateModeNeutralCoreRootV1']),
  ],
  [
    'src/online/protocol/types.ts',
    new Set(['CoreCommandV1', 'ModeNeutralCoreRootV1']),
  ],
  [
    'src/online/protocol/validation.ts',
    new Set(['CoreCommandV1', 'validateCoreCommandV1']),
  ],
]);

type ModuleReference = Readonly<{
  readonly kind: 'import' | 'export' | 'import-equals' | 'dynamic' | 'type-query' | 'require';
  readonly specifier: string;
}>;

function normalizedPath(filePath: string): string {
  return relative(repositoryRoot, filePath).split(sep).join('/');
}

function productionFiles(root: string): readonly string[] {
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
  const source = sourceFile(sourceText, filePath);
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
  visit(source);
  return references;
}

function importedBindings(
  sourceText: string,
  filePath: string,
  specifier: string,
): readonly Readonly<{ readonly imported: string; readonly local: string }>[] {
  const bindings: Array<Readonly<{ readonly imported: string; readonly local: string }>> = [];
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
    if (clause.name) bindings.push({ imported: 'default', local: clause.name.text });
    const named = clause.namedBindings;
    if (!named) continue;
    if (ts.isNamespaceImport(named)) {
      bindings.push({ imported: '*', local: named.name.text });
    } else {
      for (const element of named.elements) {
        bindings.push({
          imported: element.propertyName?.text ?? element.name.text,
          local: element.name.text,
        });
      }
    }
  }
  return bindings;
}

function identifierCallCount(sourceText: string, filePath: string, localName: string): number {
  const source = sourceFile(sourceText, filePath);
  let count = 0;
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === localName
    ) {
      count += 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return count;
}

describe('O4P-02C in-memory protocol architecture boundary', () => {
  it('pins the public surface, fixture, verifier, machine step, and domain lane', () => {
    for (const name of requiredRuntimeExports) {
      expect(Object.prototype.hasOwnProperty.call(Protocol, name), name).toBe(true);
    }
    for (const name of forbiddenRuntimeExports) {
      expect(Object.prototype.hasOwnProperty.call(Protocol, name), name).toBe(false);
    }
    expect(Protocol.ONLINE_PROTOCOL_SCHEMA_VERSION_V1).toBe(1);
    expect(existsSync(fixturePath)).toBe(true);
    expect(existsSync(verifierPath)).toBe(true);

    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
      version: string;
      schemaVersion: number;
      protocolVersion: number;
      deduplicationKey: string[];
      privacyBoundary: Record<string, unknown>;
      transportBoundary: Record<string, unknown>;
    };
    expect(fixture).toMatchObject({
      version: 'online-in-memory-protocol-v1',
      schemaVersion: 1,
      protocolVersion: 1,
      deduplicationKey: ['participantId', 'commandId'],
      privacyBoundary: {
        responsesAreMetadataOnly: true,
        capabilitiesReturned: false,
        coreRootReturned: false,
        projectionDeferredTo: 'O4P-02D',
      },
      transportBoundary: {
        inMemoryOnly: true,
        webSocket: false,
        cloudflare: false,
        storage: false,
        clockOrRandomness: false,
      },
    });

    const packageJson = JSON.parse(readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, unknown>;
    };
    expect(packageJson.scripts?.['verify:online-in-memory-protocol'])
      .toBe('tsx scripts/checks/verify-online-in-memory-protocol.ts');
    expect(readFileSync(resolve(repositoryRoot, 'scripts/checks/machine-checks.mjs'), 'utf8'))
      .toContain("args: ['run', 'verify:online-in-memory-protocol']");
    expect(readFileSync(resolve(repositoryRoot, 'scripts/checks/tsconfig.json'), 'utf8'))
      .toContain('verify-online-in-memory-protocol.ts');
    const domains = JSON.parse(
      readFileSync(resolve(repositoryRoot, 'scripts/checks/validation-domains.json'), 'utf8'),
    ) as { domains?: Array<{ id?: string; sourcePatterns?: string[] }> };
    expect(domains.domains?.filter(({ id }) => id === 'online-protocol')).toEqual([
      expect.objectContaining({ sourcePatterns: ['src/online/protocol/**'] }),
    ]);
  });

  it('keeps production additive, pure, offline, and on exact public barrels', () => {
    expect(existsSync(resolve(repositoryRoot, 'src/online/index.ts'))).toBe(false);
    expect(readFileSync(resolve(repositoryRoot, 'src/engine/core/index.ts'), 'utf8'))
      .not.toMatch(/online\/protocol|in-memory-protocol/i);
    const files = productionFiles(protocolRoot);
    expect(files.map(normalizedPath)).toEqual(expectedProductionFiles);
    const forbiddenSource = /Math\.random|Date\.now|new\s+Date|setTimeout|setInterval|fetch\s*\(|WebSocket|cloudflare:|@cloudflare|localStorage|indexedDB|sessionStorage|process\.env|import\.meta\.env|from\s+['"](?:react|react-dom|zustand|idb)|projectionSchemaVersion|console\./i;
    for (const filePath of files) {
      const sourceText = readFileSync(filePath, 'utf8');
      expect(sourceText, normalizedPath(filePath)).not.toMatch(forbiddenSource);
      for (const reference of moduleReferences(sourceText, filePath)) {
        expect(
          ['import', 'export', 'type-query'],
          `${normalizedPath(filePath)} ${reference.kind}`,
        ).toContain(
          reference.kind,
        );
        expect(
          allowedModuleSpecifiers.has(reference.specifier),
          `${normalizedPath(filePath)} ${reference.kind} ${reference.specifier}`,
        ).toBe(true);
      }
    }
  });

  it('pins Core symbols and calls the reducer exactly once from command handling only', () => {
    const files = productionFiles(protocolRoot);
    let reducerImportCount = 0;
    let reducerCallCount = 0;
    for (const filePath of files) {
      const path = normalizedPath(filePath);
      const sourceText = readFileSync(filePath, 'utf8');
      const bindings = importedBindings(sourceText, filePath, '../../engine/core/index');
      const allowed = exactCoreImports.get(path);
      if (allowed === undefined) {
        expect(bindings, `${path} imports Core`).toEqual([]);
        continue;
      }
      expect(bindings.length, `${path} has a non-vacuous Core import`).toBeGreaterThan(0);
      for (const binding of bindings) {
        expect(allowed.has(binding.imported), `${path} imports ${binding.imported}`).toBe(true);
        if (binding.imported === 'applyCoreCommandV1') {
          reducerImportCount += 1;
          expect(path).toBe('src/online/protocol/command.ts');
          reducerCallCount += identifierCallCount(sourceText, filePath, binding.local);
        }
      }
    }
    expect(reducerImportCount).toBe(1);
    expect(reducerCallCount).toBe(1);
  });

  it('fails closed on aliases outside command, namespaces, dynamic imports, and escaping modules', () => {
    const probes = [
      {
        path: 'src/online/protocol/state.ts',
        source: "import { applyCoreCommandV1 as reduce } from '../../engine/core/index'; reduce(root, command);",
      },
      {
        path: 'src/online/protocol/command.ts',
        source: "import * as Core from '../../engine/core/index'; Core.applyCoreCommandV1(root, command);",
      },
      {
        path: 'src/online/protocol/command.ts',
        source: "const target = '../../engine/core/index'; void import(target);",
      },
      {
        path: 'src/online/protocol/command.ts',
        source: "require('../../engine/core/index');",
      },
      {
        path: 'src/online/protocol/command.ts',
        source: "import '../../engine/core/closure';",
      },
      {
        path: 'src/online/protocol/command.ts',
        source: "import '../../../store/gameStore';",
      },
    ];
    for (const probe of probes) {
      const filePath = resolve(repositoryRoot, probe.path);
      const references = moduleReferences(probe.source, filePath);
      const coreBindings = importedBindings(probe.source, filePath, '../../engine/core/index');
      const allowed = exactCoreImports.get(probe.path);
      const validReferences =
        references.length > 0 &&
        references.every(
          ({ kind, specifier }) =>
            (kind === 'import' || kind === 'export') && allowedModuleSpecifiers.has(specifier),
        );
      const validBindings =
        allowed !== undefined &&
        coreBindings.length > 0 &&
        coreBindings.every(({ imported }) => allowed.has(imported));
      expect(validReferences && validBindings, probe.source).toBe(false);
    }
  });
});
