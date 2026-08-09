import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

import {
  GAME_STATE_FIELD_POLICY,
  ONLINE_STATE_ARCHITECTURE,
  summarizeGameStateFieldPolicy,
  type GameStateFieldDisposition,
  type GameStateFieldPolicyEntry,
} from '../../online/architecture/stateArchitecture';
import type { GameState } from '../../engine/types';

type GameStateFieldName = keyof GameState;

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const sourceRoot = resolve(repositoryRoot, 'src');
const architectureRoot = resolve(sourceRoot, 'online/architecture');
const engineTypesPath = resolve(sourceRoot, 'engine/types.ts');

const EXPECTED_FIELDS_BY_DISPOSITION = {
  CORE_DIRECT: [
    'effectsAuto',
    'activePlayerId',
    'turnOrder',
    'turn',
    'phase',
    'emptyLibraryDrawAttemptedSinceLastSba',
    'combatDamagePreventedUntilEndOfTurn',
    'oncePerTurnTriggerLedger',
    'powerUpActivated',
  ],
  CORE_NORMALIZE: [
    'defs',
    'cards',
    'zones',
    'zonesByPlayer',
    'players',
    'eventLog',
    'pendingTriggers',
    'pendingRuleChoices',
    'linkedExiles',
    'dungeonDefs',
    'dungeons',
  ],
  SOLO_FACADE: [
    'localPlayerId',
    'life',
    'poison',
    'energy',
    'experience',
    'opponentLife',
    'manaPool',
    'mulliganCount',
    'landsPlayedThisTurn',
    'spellsCastThisTurn',
    'drawnThisTurn',
    'pendingSbaChoices',
    'log',
  ],
  BLOCKED_REDESIGN: [
    'commanders',
    'combat',
    'commanderDamage',
    'defeat',
  ],
} as const satisfies {
  readonly [K in GameStateFieldDisposition]: readonly GameStateFieldName[];
};

const DISPOSITIONS: readonly GameStateFieldDisposition[] = [
  'CORE_DIRECT',
  'CORE_NORMALIZE',
  'SOLO_FACADE',
  'BLOCKED_REDESIGN',
];

const ALL_GAME_STATE_FIELDS: readonly GameStateFieldName[] = [
  ...EXPECTED_FIELDS_BY_DISPOSITION.CORE_DIRECT,
  ...EXPECTED_FIELDS_BY_DISPOSITION.CORE_NORMALIZE,
  ...EXPECTED_FIELDS_BY_DISPOSITION.SOLO_FACADE,
  ...EXPECTED_FIELDS_BY_DISPOSITION.BLOCKED_REDESIGN,
];

const EXPECTED_ENTRY_BY_DISPOSITION = {
  CORE_DIRECT: {
    reasonCode: 'RULE_SEMANTIC_DIRECT',
    persistInModeNeutralCore: true,
    requiresExplicitFollowUp: false,
  },
  CORE_NORMALIZE: {
    reasonCode: 'NORMALIZATION_REQUIRED',
    persistInModeNeutralCore: true,
    requiresExplicitFollowUp: true,
  },
  SOLO_FACADE: {
    reasonCode: 'SOLO_COMPATIBILITY_VIEW',
    persistInModeNeutralCore: false,
    requiresExplicitFollowUp: false,
  },
  BLOCKED_REDESIGN: {
    reasonCode: 'MULTIPLAYER_REDESIGN_REQUIRED',
    persistInModeNeutralCore: false,
    requiresExplicitFollowUp: true,
  },
} as const satisfies {
  readonly [K in GameStateFieldDisposition]: Pick<
    GameStateFieldPolicyEntry,
    'reasonCode' | 'persistInModeNeutralCore' | 'requiresExplicitFollowUp'
  >;
};

interface ModuleReference {
  readonly filePath: string;
  readonly kind: 'import' | 're-export' | 'dynamic-import' | 'import-equals';
  readonly specifier: string;
  readonly typeOnly: boolean;
}

function collectTypeScriptFiles(root: string): string[] {
  const files: string[] = [];
  function visit(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        visit(entryPath);
      } else if (
        entry.isFile()
        && /\.tsx?$/.test(entry.name)
        && !entry.name.endsWith('.d.ts')
      ) {
        files.push(entryPath);
      }
    }
  }
  visit(root);
  return files.sort();
}

function resolveSourceTarget(filePath: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const basePath = resolve(dirname(filePath), specifier);
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}/index.ts`,
    `${basePath}/index.tsx`,
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function isWithin(parent: string, candidate: string): boolean {
  const child = relative(parent, candidate);
  return child !== '' && !child.startsWith('..') && !child.startsWith('/');
}

function collectModuleReferences(filePath: string): ModuleReference[] {
  const sourceText = readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const references: ModuleReference[] = [];

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      references.push({
        filePath,
        kind: 'import',
        specifier: node.moduleSpecifier.text,
        typeOnly: node.importClause?.isTypeOnly ?? false,
      });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      references.push({
        filePath,
        kind: 're-export',
        specifier: node.moduleSpecifier.text,
        typeOnly: node.isTypeOnly,
      });
    } else if (
      ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length === 1
      && ts.isStringLiteral(node.arguments[0])
    ) {
      references.push({
        filePath,
        kind: 'dynamic-import',
        specifier: node.arguments[0].text,
        typeOnly: false,
      });
    } else if (
      ts.isImportEqualsDeclaration(node)
      && ts.isExternalModuleReference(node.moduleReference)
      && ts.isStringLiteral(node.moduleReference.expression)
    ) {
      references.push({
        filePath,
        kind: 'import-equals',
        specifier: node.moduleReference.expression.text,
        typeOnly: false,
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return references;
}

function architectureReferences(): ModuleReference[] {
  return collectTypeScriptFiles(architectureRoot).flatMap(collectModuleReferences);
}

function policyFixtureText(stateType: string, fields: readonly string[]): string {
  const objectFields = fields.map((field) => `  ${field}: entry,`).join('\n');
  return [
    `import type { GameState } from ${JSON.stringify(engineTypesPath)};`,
    'type GameStateFieldPolicyEntry = {',
    "  disposition: 'CORE_DIRECT' | 'CORE_NORMALIZE' | 'SOLO_FACADE' | 'BLOCKED_REDESIGN';",
    "  reasonCode: 'RULE_SEMANTIC_DIRECT' | 'NORMALIZATION_REQUIRED' | 'SOLO_COMPATIBILITY_VIEW' | 'MULTIPLAYER_REDESIGN_REQUIRED';",
    '  persistInModeNeutralCore: boolean;',
    '  requiresExplicitFollowUp: boolean;',
    '};',
    `type CandidateGameState = ${stateType};`,
    'type CandidatePolicy = {',
    '  readonly [K in keyof CandidateGameState]-?: GameStateFieldPolicyEntry;',
    '};',
    'const entry = {',
    "  disposition: 'CORE_DIRECT',",
    "  reasonCode: 'RULE_SEMANTIC_DIRECT',",
    '  persistInModeNeutralCore: true,',
    '  requiresExplicitFollowUp: false,',
    '} as const;',
    'const policy = {',
    objectFields,
    '} satisfies CandidatePolicy;',
    'void policy;',
  ].join('\n');
}

function compilePolicyFixture(stateType: string, fields: readonly string[]): readonly ts.Diagnostic[] {
  const fixturePath = resolve(repositoryRoot, 'node_modules/.tmp/o4p-01c-policy-fixture.ts');
  const sourceText = policyFixtureText(stateType, fields);
  const options: ts.CompilerOptions = {
    allowImportingTsExtensions: true,
    module: ts.ModuleKind.ESNext,
    moduleDetection: ts.ModuleDetectionKind.Force,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    skipLibCheck: true,
    strict: true,
    target: ts.ScriptTarget.ES2023,
  };
  const compilerHost = ts.createCompilerHost(options, true);
  const originalGetSourceFile = compilerHost.getSourceFile.bind(compilerHost);
  compilerHost.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    if (fileName === fixturePath) {
      return ts.createSourceFile(fileName, sourceText, languageVersion, true, ts.ScriptKind.TS);
    }
    return originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
  };
  const program = ts.createProgram([fixturePath], options, compilerHost);
  return ts.getPreEmitDiagnostics(program).filter((diagnostic) => diagnostic.file?.fileName === fixturePath);
}

function formatDiagnostics(diagnostics: readonly ts.Diagnostic[]): string {
  return diagnostics
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
    .join('\n');
}

describe('Online state architecture contract', () => {
  it('exports the frozen mode-neutral architecture literal', () => {
    expect(ONLINE_STATE_ARCHITECTURE).toBe('mode-neutral-core-with-solo-facade-and-online-envelope');
  });

  it('covers every GameState root key with no surplus policy key', () => {
    expect(Object.keys(GAME_STATE_FIELD_POLICY).sort()).toEqual([...ALL_GAME_STATE_FIELDS].sort());
    expect(ALL_GAME_STATE_FIELDS).toHaveLength(37);
  });

  it('matches the exact four classification sets', () => {
    for (const disposition of DISPOSITIONS) {
      const actual = Object.entries(GAME_STATE_FIELD_POLICY)
        .filter(([, entry]) => entry.disposition === disposition)
        .map(([field]) => field)
        .sort();
      expect(actual).toEqual([...EXPECTED_FIELDS_BY_DISPOSITION[disposition]].sort());
    }
  });

  it('returns a policy-derived, order-independent summary', () => {
    const summary = summarizeGameStateFieldPolicy();
    expect(summary).toEqual({
      total: 37,
      CORE_DIRECT: 9,
      CORE_NORMALIZE: 11,
      SOLO_FACADE: 13,
      BLOCKED_REDESIGN: 4,
    });

    const reorderedFields = [...ALL_GAME_STATE_FIELDS].reverse();
    const reorderedSummary = {
      total: 0,
      CORE_DIRECT: 0,
      CORE_NORMALIZE: 0,
      SOLO_FACADE: 0,
      BLOCKED_REDESIGN: 0,
    };
    for (const field of reorderedFields) {
      reorderedSummary.total += 1;
      reorderedSummary[GAME_STATE_FIELD_POLICY[field].disposition] += 1;
    }
    expect(reorderedSummary).toEqual(summary);
  });

  it('enforces the disposition reason and persistence combinations', () => {
    for (const field of ALL_GAME_STATE_FIELDS) {
      const entry = GAME_STATE_FIELD_POLICY[field];
      expect({
        reasonCode: entry.reasonCode,
        persistInModeNeutralCore: entry.persistInModeNeutralCore,
        requiresExplicitFollowUp: entry.requiresExplicitFollowUp,
      }).toEqual(EXPECTED_ENTRY_BY_DISPOSITION[entry.disposition]);
    }
  });

  it('deep-freezes the policy, every entry, and the summary', () => {
    expect(Object.isFrozen(GAME_STATE_FIELD_POLICY)).toBe(true);
    for (const entry of Object.values(GAME_STATE_FIELD_POLICY)) {
      expect(Object.isFrozen(entry)).toBe(true);
    }
    const summary = summarizeGameStateFieldPolicy();
    expect(Object.isFrozen(summary)).toBe(true);
  });

  it('does not change when mutation is attempted', () => {
    const summary = summarizeGameStateFieldPolicy();
    expect(Reflect.set(GAME_STATE_FIELD_POLICY, 'effectsAuto', GAME_STATE_FIELD_POLICY.commanders)).toBe(false);
    expect(Reflect.set(GAME_STATE_FIELD_POLICY.effectsAuto, 'disposition', 'SOLO_FACADE')).toBe(false);
    expect(Reflect.set(summary, 'total', 0)).toBe(false);
    expect(GAME_STATE_FIELD_POLICY.effectsAuto.disposition).toBe('CORE_DIRECT');
    expect(summary.total).toBe(37);
  });

  it('includes optional dungeon fields in the policy', () => {
    expect(GAME_STATE_FIELD_POLICY.dungeonDefs.disposition).toBe('CORE_NORMALIZE');
    expect(GAME_STATE_FIELD_POLICY.dungeons.disposition).toBe('CORE_NORMALIZE');
  });

  it('rejects a compile fixture when a GameState field is added without policy', () => {
    const diagnostics = compilePolicyFixture(
      'GameState & { addedField: string }',
      ALL_GAME_STATE_FIELDS,
    );
    expect(formatDiagnostics(diagnostics)).toMatch(/addedField/);
  });

  it('rejects a compile fixture when a GameState field is deleted but policy remains', () => {
    const diagnostics = compilePolicyFixture(
      "Omit<GameState, 'defs'>",
      ALL_GAME_STATE_FIELDS,
    );
    expect(formatDiagnostics(diagnostics)).toMatch(/defs/);
  });

  it('accepts the current GameState-to-policy compile fixture', () => {
    expect(compilePolicyFixture('GameState', ALL_GAME_STATE_FIELDS)).toEqual([]);
  });

  it('keeps architecture dependencies type-only and runtime-free', () => {
    const references = architectureReferences();
    const engineTypeReferences = references.filter((reference) => {
      const target = resolveSourceTarget(reference.filePath, reference.specifier);
      return target === engineTypesPath;
    });
    expect(engineTypeReferences).toEqual([
      expect.objectContaining({ kind: 'import', typeOnly: true }),
    ]);

    const unexpectedReferences = references.filter((reference) => {
      if (!reference.specifier.startsWith('.')) return true;
      const target = resolveSourceTarget(reference.filePath, reference.specifier);
      return target !== engineTypesPath && !(target && isWithin(architectureRoot, target));
    });
    expect(unexpectedReferences).toEqual([]);
  });

  it('keeps the engine free of reverse imports into Online architecture', () => {
    const reverseReferences = collectTypeScriptFiles(resolve(sourceRoot, 'engine'))
      .flatMap(collectModuleReferences)
      .filter((reference) => {
        const target = resolveSourceTarget(reference.filePath, reference.specifier);
        return target !== null && isWithin(architectureRoot, target);
      });
    expect(reverseReferences).toEqual([]);
  });
});
