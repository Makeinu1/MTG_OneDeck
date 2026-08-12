import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import * as Projection from '../../online/projection';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const projectionRoot = resolve(repositoryRoot, 'src/online/projection');
const fixturePath = resolve(projectionRoot, 'fixtures/o4p-02d-audience-projection-v1.json');
const verifierPath = resolve(repositoryRoot, 'scripts/checks/verify-online-audience-projection.ts');

const requiredRuntimeExports = [
  'ONLINE_PROJECTION_SCHEMA_VERSION_V1',
  'validateOnlineProjectionRequestV1',
  'validateOnlineParticipantProjectionV1',
  'handleOnlineProjectedSnapshotRequestV1',
  'OnlineProjectionOperationErrorV1',
] as const;

const forbiddenRuntimeExports = [
  'buildAudienceProjectionV1',
  'configuredCapabilitiesV1',
  'deepFreezeProjectionV1',
  'projectObjectV1',
  'readProjectionRecordV1',
  'sanitizeProjectionIssuesV1',
] as const;

type ModuleReference = Readonly<{
  readonly kind: 'import' | 'export' | 'import-equals' | 'dynamic' | 'type-query' | 'require';
  readonly specifier: string;
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
): readonly Readonly<{ readonly imported: string; readonly local: string }>[] {
  const bindings: Array<Readonly<{ readonly imported: string; readonly local: string }>> = [];
  for (const statement of sourceFile(sourceText, filePath).statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== specifier
    ) continue;
    const clause = statement.importClause;
    if (!clause) continue;
    if (clause.name) bindings.push({ imported: 'default', local: clause.name.text });
    const named = clause.namedBindings;
    if (!named) continue;
    if (ts.isNamespaceImport(named)) bindings.push({ imported: '*', local: named.name.text });
    else {
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

const allowedCoreImports = new Set([
  'CoreCardDefinitionSnapshotV1',
  'CoreDecisionContextV1',
  'CoreGameObjectIdentityV2',
  'CoreManaPoolV1',
  'CoreObjectId',
  'CoreObjectIdKindV2',
  'CorePlayerExitCauseV1',
  'CorePlayerId',
  'CorePlayerLifecycleStatusV1',
  'CoreRuleDurationV1',
  'CoreRuleZoneRefV1',
  'CoreSearchCriteriaV1',
  'CoreSearchPortionV1',
  'CoreVisibilityGrantV1',
  'CoreVisibilitySubjectV1',
  'ModeNeutralCoreObjectRegistrySliceV2',
  'ModeNeutralCoreObjectRuntimeSliceV2',
  'coreCanPlayerAttemptPlayObjectV1',
  'coreCanPlayerViewObjectIdentityV1',
  'coreDecisionMakerForV1',
  'currentCoreObjectControllerV1',
  'isCanonicalCoreObjectIdV2',
  'isCoreBaseId',
  'parseCoreObjectIdV2',
  'validateCoreRuleZoneRefV1',
]);

describe('O4P-02D audience projection architecture boundary', () => {
  it('pins public surface, fixture, verifier, machine step, and domain lane', () => {
    for (const name of requiredRuntimeExports) {
      expect(Object.prototype.hasOwnProperty.call(Projection, name), name).toBe(true);
    }
    for (const name of forbiddenRuntimeExports) {
      expect(Object.prototype.hasOwnProperty.call(Projection, name), name).toBe(false);
    }
    expect(existsSync(fixturePath)).toBe(true);
    expect(existsSync(verifierPath)).toBe(true);

    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as Record<string, unknown>;
    expect(fixture).toMatchObject({
      version: 'online-audience-projection-v1',
      schemaVersion: 1,
      protocolVersion: 1,
      privacyBoundary: {
        hiddenCardHasObjectId: false,
        hiddenCardHasRuntime: false,
        physicalCardIdsReturned: false,
        definitionIdsReturned: false,
        capabilitiesReturned: false,
        tableAndSpectatorPublicGameParity: true,
      },
      authorityBoundary: {
        ownHand: true,
        libraryDefaultHidden: true,
        allPlayerRevealForObservers: true,
        playerLookForObservers: false,
        searchActorSelectorOnly: true,
        playPermissionAttemptOnly: true,
      },
      transportBoundary: {
        inMemoryOnly: true,
        webSocket: false,
        cloudflare: false,
        storage: false,
        clockOrRandomness: false,
        loggingSideEffect: false,
      },
    });

    const packageJson = JSON.parse(readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, unknown>;
    };
    expect(packageJson.scripts?.['verify:online-audience-projection'])
      .toBe('tsx scripts/checks/verify-online-audience-projection.ts');
    expect(readFileSync(resolve(repositoryRoot, 'scripts/checks/machine-checks.mjs'), 'utf8'))
      .toContain("args: ['run', 'verify:online-audience-projection']");
    expect(readFileSync(resolve(repositoryRoot, 'scripts/checks/tsconfig.json'), 'utf8'))
      .toContain('verify-online-audience-projection.ts');
    const domains = JSON.parse(
      readFileSync(resolve(repositoryRoot, 'scripts/checks/validation-domains.json'), 'utf8'),
    ) as { domains?: Array<{ id?: string; sourcePatterns?: string[] }> };
    expect(domains.domains?.filter(({ id }) => id === 'online-projection')).toEqual([
      expect.objectContaining({ sourcePatterns: ['src/online/projection/**'] }),
    ]);
  });

  it('allows only local siblings and shipped public barrels without ambient effects', () => {
    expect(existsSync(resolve(repositoryRoot, 'src/online/index.ts'))).toBe(false);
    const files = productionFiles(projectionRoot);
    expect(files.length).toBeGreaterThanOrEqual(2);
    const allowedExternal = new Set([
      '../../engine/core/index',
      '../../versioning/index',
      '../protocol/index',
      '../room/index',
    ]);
    const forbiddenSource = /Math\.random|Date\.now|new\s+Date|setTimeout|setInterval|fetch\s*\(|WebSocket|cloudflare:|@cloudflare|localStorage|indexedDB|sessionStorage|process\.env|import\.meta\.env|from\s+['"](?:react|react-dom|zustand|idb)|console\./i;
    for (const filePath of files) {
      const sourceText = readFileSync(filePath, 'utf8');
      expect(sourceText, normalizedPath(filePath)).not.toMatch(forbiddenSource);
      for (const reference of moduleReferences(sourceText, filePath)) {
        expect(['import', 'export', 'type-query'], `${normalizedPath(filePath)} ${reference.kind}`)
          .toContain(reference.kind);
        const local = reference.specifier.startsWith('./') && !reference.specifier.includes('..');
        expect(
          local || allowedExternal.has(reference.specifier),
          `${normalizedPath(filePath)} ${reference.kind} ${reference.specifier}`,
        ).toBe(true);
      }
    }
  });

  it('imports no Core reducer or mutation symbol and detects alias/namespace/dynamic probes', () => {
    const files = productionFiles(projectionRoot);
    let publicCoreImportCount = 0;
    for (const filePath of files) {
      const sourceText = readFileSync(filePath, 'utf8');
      const bindings = importedBindings(sourceText, filePath, '../../engine/core/index');
      publicCoreImportCount += bindings.length;
      for (const binding of bindings) {
        expect(binding.imported, normalizedPath(filePath)).not.toBe('*');
        expect(allowedCoreImports.has(binding.imported), normalizedPath(filePath)).toBe(true);
      }
    }
    expect(publicCoreImportCount).toBeGreaterThan(0);

    const probes = [
      "import { applyCoreCommandV1 as reduce } from '../../engine/core/index'; reduce(root, command);",
      "import * as Core from '../../engine/core/index'; Core.applyCoreCommandV1(root, command);",
      "const target = '../../engine/core/index'; void import(target);",
      "require('../../engine/core/index');",
      "import '../../engine/core/closure';",
      "import '../../../store/gameStore';",
    ];
    for (const source of probes) {
      const filePath = resolve(projectionRoot, 'probe.ts');
      const references = moduleReferences(source, filePath);
      const bindings = importedBindings(source, filePath, '../../engine/core/index');
      const allowedReference = references.length > 0 && references.every(({ kind, specifier }) =>
        (kind === 'import' || kind === 'export' || kind === 'type-query') &&
        (specifier.startsWith('./') || [
          '../../engine/core/index',
          '../../versioning/index',
          '../protocol/index',
          '../room/index',
        ].includes(specifier)),
      );
      const allowedBindings = bindings.every(({ imported }) =>
        imported !== '*' && allowedCoreImports.has(imported),
      );
      expect(allowedReference && allowedBindings, source).toBe(false);
    }
  });

  it('prevents reverse projection dependencies and limits Online application modules', () => {
    for (const root of [
      resolve(repositoryRoot, 'src/engine/core'),
      resolve(repositoryRoot, 'src/online/room'),
      resolve(repositoryRoot, 'src/online/protocol'),
    ]) {
      for (const filePath of productionFiles(root)) {
        expect(readFileSync(filePath, 'utf8'), normalizedPath(filePath))
          .not.toMatch(/online\/projection|\.\.\/projection/);
      }
    }
    const onlineKinds = readdirSync(resolve(repositoryRoot, 'src/online'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map(({ name }) => name)
      .sort();
    expect(onlineKinds).toEqual(['architecture', 'headless', 'projection', 'protocol', 'room']);
  });
});
