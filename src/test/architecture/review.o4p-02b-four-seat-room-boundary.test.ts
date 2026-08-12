import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import * as Room from '../../online/room';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const roomRoot = resolve(repositoryRoot, 'src/online/room');
const fixturePath = resolve(roomRoot, 'fixtures/o4p-02b-four-seat-room-v1.json');
const verifierPath = resolve(repositoryRoot, 'scripts/checks/verify-online-four-seat-room.ts');
const allowedRoomModuleSpecifiers = new Set([
  '../../engine/core/index',
  './errors',
  './operations',
  './types',
  './validation',
  './validationSupport',
]);

const requiredExports = [
  'ONLINE_ROOM_SCHEMA_VERSION_V1',
  'validateOnlineRoomV1',
  'createOnlineRoomV1',
  'joinOnlineRoomV1',
  'disconnectOnlineRoomParticipantV1',
  'rejoinOnlineRoomPlayerV1',
  'setOnlineRoomPlayerReadyV1',
  'startOnlineRoomV1',
  'activateOnlineRoomV1',
  'reconcileOnlineRoomCoreLifecycleV1',
  'OnlineRoomCreationErrorV1',
  'OnlineRoomOperationErrorV1',
] as const;

function normalizedPath(filePath: string): string {
  return relative(repositoryRoot, filePath).split(sep).join('/');
}

function productionFiles(root: string): readonly string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const filePath = resolve(root, entry.name);
    if (entry.isDirectory() && entry.name !== '__tests__' && entry.name !== 'fixtures') {
      files.push(...productionFiles(filePath));
    } else if (entry.isFile()) {
      files.push(filePath);
    }
  }
  return files.sort();
}

function moduleSpecifiersOf(sourceText: string, filePath: string): readonly string[] {
  const source = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const specifiers: string[] = [];
  const recordCallSpecifier = (node: ts.CallExpression): void => {
    const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
    const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
    if (!isDynamicImport && !isRequire) return;
    const [argument] = node.arguments;
    if (node.arguments.length === 1 && argument && ts.isStringLiteral(argument)) {
      specifiers.push(argument.text);
    } else {
      specifiers.push('<dynamic-module-specifier>');
    }
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    }
    if (ts.isImportEqualsDeclaration(node)) {
      const reference = node.moduleReference;
      if (ts.isExternalModuleReference(reference) && reference.expression) {
        specifiers.push(
          ts.isStringLiteral(reference.expression)
            ? reference.expression.text
            : '<dynamic-module-specifier>',
        );
      }
    }
    if (ts.isImportTypeNode(node)) {
      const argument = node.argument;
      specifiers.push(
        ts.isLiteralTypeNode(argument) && ts.isStringLiteral(argument.literal)
          ? argument.literal.text
          : '<dynamic-module-specifier>',
      );
    }
    if (ts.isCallExpression(node)) recordCallSpecifier(node);
    if (
      ts.isIdentifier(node) &&
      node.text === 'require' &&
      !(ts.isCallExpression(node.parent) && node.parent.expression === node)
    ) {
      specifiers.push('<indirect-require>');
    }
    if (
      ts.isStringLiteral(node) &&
      node.text === 'require' &&
      ts.isElementAccessExpression(node.parent) &&
      node.parent.argumentExpression === node
    ) {
      specifiers.push('<indirect-require>');
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
}

function moduleSpecifiersOfFile(filePath: string): readonly string[] {
  return moduleSpecifiersOf(readFileSync(filePath, 'utf8'), filePath);
}

describe('O4P-02B four-seat Room architecture boundary', () => {
  it('pins the public surface, fixture, verifier, machine step, and domain lane', () => {
    for (const name of requiredExports) {
      expect(Object.prototype.hasOwnProperty.call(Room, name), name).toBe(true);
    }
    expect(Room.ONLINE_ROOM_SCHEMA_VERSION_V1).toBe(1);
    expect(existsSync(fixturePath)).toBe(true);
    expect(existsSync(verifierPath)).toBe(true);

    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
      version: string;
      schemaVersion: number;
      seatAssignments: Array<{ seatIndex: number; corePlayerId: string }>;
      lifecycle: string[];
      coreBoundary: Record<string, unknown>;
    };
    expect(fixture).toMatchObject({
      version: 'online-four-seat-room-v1',
      schemaVersion: 1,
      lifecycle: ['forming', 'ready', 'started', 'active', 'finished'],
      coreBoundary: {
        disconnectIsCoreExit: false,
        storesCoreRoot: false,
        storesConnectionMetadataInCore: false,
      },
    });
    expect(fixture.seatAssignments.map(({ seatIndex, corePlayerId }) => [seatIndex, corePlayerId]))
      .toEqual([[0, 'P1'], [1, 'P2'], [2, 'P3'], [3, 'P4']]);

    const packageJson = JSON.parse(readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8')) as {
      scripts?: Record<string, unknown>;
    };
    expect(packageJson.scripts?.['verify:online-four-seat-room'])
      .toBe('tsx scripts/checks/verify-online-four-seat-room.ts');
    expect(readFileSync(resolve(repositoryRoot, 'scripts/checks/machine-checks.mjs'), 'utf8'))
      .toContain('verify:online-four-seat-room');
    const domains = JSON.parse(
      readFileSync(resolve(repositoryRoot, 'scripts/checks/validation-domains.json'), 'utf8'),
    ) as { domains?: Array<{ id?: string }> };
    expect(domains.domains?.some(({ id }) => id === 'online-room')).toBe(true);
  });

  it('keeps Room pure, offline, outside Core, and before protocol/projection', () => {
    expect(existsSync(resolve(repositoryRoot, 'src/online/index.ts'))).toBe(false);
    expect(readFileSync(resolve(repositoryRoot, 'src/engine/core/index.ts'), 'utf8'))
      .not.toMatch(/online\/room|four-seat-room/i);

    const files = productionFiles(roomRoot);
    expect(files.map(normalizedPath)).toEqual([
      'src/online/room/errors.ts',
      'src/online/room/index.ts',
      'src/online/room/operations.ts',
      'src/online/room/types.ts',
      'src/online/room/validation.ts',
      'src/online/room/validationSupport.ts',
    ]);
    const forbiddenSource = /Math\.random|Date\.now|new\s+Date|setTimeout|setInterval|fetch\s*\(|new\s+WebSocket|applyCoreCommandV1\s*\(|replayCoreCommandsV1\s*\(|protocolVersion|projectionSchemaVersion|localStorage|indexedDB/i;
    for (const filePath of files) {
      const source = readFileSync(filePath, 'utf8');
      expect(source, normalizedPath(filePath)).not.toMatch(forbiddenSource);
      for (const specifier of moduleSpecifiersOfFile(filePath)) {
        expect(
          allowedRoomModuleSpecifiers.has(specifier),
          `${normalizedPath(filePath)} imports ${specifier}`,
        ).toBe(true);
      }
    }
  });

  it('fails closed on non-public, escaping, and dynamic module references', () => {
    const probes = [
      "import '../../engine/commands';",
      "export * from '../protocol';",
      "const moduleName = './types'; import(moduleName);",
      "require('react');",
      'type Hidden = typeof import("../../engine/commands");',
      'const load = require; load("../../engine/commands");',
      'module.require("../../engine/commands");',
      'const load = globalThis["require"]; load("../../engine/commands");',
    ];
    for (const [index, source] of probes.entries()) {
      const specifiers = moduleSpecifiersOf(source, `probe-${index}.tsx`);
      expect(specifiers.length, source).toBeGreaterThan(0);
      expect(specifiers.some((specifier) => !allowedRoomModuleSpecifiers.has(specifier)), source)
        .toBe(true);
    }
  });
});
