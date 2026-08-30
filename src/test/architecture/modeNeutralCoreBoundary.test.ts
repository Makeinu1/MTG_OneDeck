import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ts from 'typescript';

import { describe, expect, it } from 'vitest';

type ReferenceKind = 'import' | 'import-type' | 're-export' | 'dynamic-import' | 'import-equals' | 'type-query';

interface SourceUnit {
  readonly filePath: string;
  readonly sourceText: string;
}

interface ImportReference {
  readonly filePath: string;
  readonly kind: ReferenceKind;
  readonly specifier: string;
  readonly importedNames: readonly string[];
}

interface BoundaryViolation {
  readonly filePath: string;
  readonly kind: ReferenceKind | 'syntax';
  readonly rule: string;
  readonly specifier: string;
}

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const sourceRoot = resolve(repositoryRoot, 'src');
const ignoredDirectoryNames = new Set(['node_modules', 'dist', 'coverage']);
const coreRelativePrefix = 'src/engine/core';

function codeUnitCompare(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function normalizePath(value: string): string {
  return value.replaceAll('\\', '/').split(sep).join('/');
}

function relativeRepositoryPath(filePath: string): string {
  return normalizePath(relative(repositoryRoot, filePath));
}

function sourceFileCandidates(basePath: string): readonly string[] {
  const runtimeExtensions = ['.js', '.jsx', '.mjs', '.cjs'] as const;
  const extensionlessBase = runtimeExtensions.some((extension) => basePath.endsWith(extension))
    ? basePath.slice(0, basePath.lastIndexOf('.'))
    : basePath;
  return [
    basePath,
    extensionlessBase,
    `${extensionlessBase}.ts`,
    `${extensionlessBase}.tsx`,
    `${extensionlessBase}.mts`,
    `${extensionlessBase}.cts`,
    `${extensionlessBase}/index.ts`,
    `${extensionlessBase}/index.tsx`,
  ];
}

function resolveSpecifierBasePath(filePath: string, specifier: string): string | null {
  if (specifier.startsWith('.')) return resolve(dirname(filePath), specifier);
  if (specifier.startsWith('src/')) return resolve(repositoryRoot, specifier);
  return null;
}

function resolveSourceTarget(filePath: string, specifier: string): string | null {
  const basePath = resolveSpecifierBasePath(filePath, specifier);
  if (basePath === null) return null;
  return sourceFileCandidates(basePath).find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

function moduleMatches(specifier: string, moduleName: string): boolean {
  return specifier === moduleName || specifier.startsWith(`${moduleName}/`);
}

function isWithin(parent: string, candidate: string): boolean {
  const child = relative(parent, candidate);
  return child !== '' && !child.startsWith('..') && !isAbsolute(child);
}

function importedNames(node: ts.ImportDeclaration | ts.ExportDeclaration): string[] {
  if (ts.isImportDeclaration(node)) {
    const clause = node.importClause;
    if (!clause) return [];
    if (!clause.namedBindings) return clause.name ? [clause.name.text] : [];
    if (ts.isNamespaceImport(clause.namedBindings)) return ['*'];
    return clause.namedBindings.elements.map((element) => element.propertyName?.text ?? element.name.text);
  }
  const clause = node.exportClause;
  if (!clause || ts.isNamespaceExport(clause)) return ['*'];
  return clause.elements.map((element) => element.propertyName?.text ?? element.name.text);
}

function typeQuerySpecifier(node: ts.ImportTypeNode): string | null {
  const argument = node.argument;
  if (!ts.isLiteralTypeNode(argument) || !ts.isStringLiteral(argument.literal)) return null;
  return argument.literal.text;
}

function importReferences(unit: SourceUnit): readonly ImportReference[] {
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
    } else if (ts.isImportTypeNode(node)) {
      const specifier = typeQuerySpecifier(node);
      if (specifier !== null) {
        references.push({
          filePath: unit.filePath,
          kind: 'type-query',
          specifier,
          importedNames: [],
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return references;
}

function isCorePath(path: string): boolean {
  const normalized = normalizePath(path);
  return normalized === coreRelativePrefix || normalized.startsWith(`${coreRelativePrefix}/`);
}

function isTestPath(path: string): boolean {
  const normalized = normalizePath(path);
  return normalized.includes('/__tests__/') || normalized.startsWith('src/test/');
}

function isVerificationScript(path: string): boolean {
  const normalized = normalizePath(path);
  return normalized === 'scripts/checks/verify-mode-neutral-core-identity-zone.ts'
    || normalized === 'scripts/checks/verify-mode-neutral-core-card-runtime.ts'
    || normalized === 'scripts/checks/verify-mode-neutral-core-zone-transition.ts'
    || normalized === 'scripts/checks/verify-mode-neutral-core-object-registry.ts'
    || normalized === 'scripts/checks/verify-mode-neutral-core-stack-announcement.ts'
    || normalized === 'scripts/checks/verify-mode-neutral-core-stack-transaction.ts'
    || normalized === 'scripts/checks/verify-mode-neutral-core-turn-priority.ts'
    || normalized === 'scripts/checks/verify-mode-neutral-core-rule-authority.ts'
    || normalized === 'scripts/checks/verify-mode-neutral-core-commander-combat-player-exit.ts'
    || normalized === 'scripts/checks/verify-mode-neutral-core-closure.ts'
    || normalized === 'scripts/checks/verify-solo-core-compatibility.ts'
    || normalized === 'scripts/checks/verify-online-four-seat-room.ts'
    || normalized === 'scripts/checks/verify-online-in-memory-protocol.ts'
    || normalized === 'scripts/checks/verify-online-audience-projection.ts'
    || normalized === 'scripts/checks/verify-online-local-room-gate.ts'
    || normalized === 'scripts/online/o4p-03d-evidence.ts';
}

function isFrozenCompatibilityCoreConsumer(path: string, target: string | null): boolean {
  if (target === null) return false;
  return normalizePath(path) === 'src/engine/compatibility/soloCoreCompatibilityV1.ts'
    && relativeRepositoryPath(target) === 'src/engine/core/index.ts';
}

const frozenRoomCoreImports = new Map<string, ReadonlySet<string>>([
  [
    'src/online/room/operations.ts',
    new Set([
      'CorePlayerId',
      'ModeNeutralCoreRootV1',
      'isCoreBaseId',
      'validateModeNeutralCoreRootV1',
    ]),
  ],
  [
    'src/online/room/types.ts',
    new Set(['CorePlayerId', 'ModeNeutralCoreRootV1']),
  ],
  [
    'src/online/room/validation.ts',
    new Set(['CorePlayerId', 'isCoreBaseId']),
  ],
  [
    'src/online/room/variable.ts',
    new Set(['CorePlayerId', 'ModeNeutralCoreRootV1']),
  ],
]);

function isFrozenRoomCoreConsumer(
  path: string,
  target: string | null,
  reference: ImportReference,
): boolean {
  if (target === null || relativeRepositoryPath(target) !== 'src/engine/core/index.ts') {
    return false;
  }
  if (reference.kind !== 'import' && reference.kind !== 'import-type') return false;
  const allowed = frozenRoomCoreImports.get(normalizePath(path));
  return allowed !== undefined
    && reference.importedNames.length > 0
    && reference.importedNames.every((name) => allowed.has(name));
}

const frozenApplicationCoreImports = new Map<string, ReadonlySet<string>>([
  [
    'src/online/application/gameIntentV1.ts',
    new Set(['CoreCommandV1', 'validateCoreCommandV1']),
  ],
  [
    'src/online/application/types.ts',
    new Set(['CoreCommandV1']),
  ],
]);

function isFrozenApplicationCoreConsumer(
  path: string,
  target: string | null,
  reference: ImportReference,
): boolean {
  if (target === null || relativeRepositoryPath(target) !== 'src/engine/core/index.ts') {
    return false;
  }
  if (reference.kind !== 'import' && reference.kind !== 'import-type') return false;
  const allowed = frozenApplicationCoreImports.get(normalizePath(path));
  return allowed !== undefined
    && reference.importedNames.length > 0
    && reference.importedNames.every((name) => allowed.has(name));
}

const frozenProtocolCoreImports = new Map<string, ReadonlySet<string>>([
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
  [
    'src/online/protocol/variable.ts',
    new Set(['CoreObjectId', 'CorePlayerId', 'ModeNeutralCoreRootV1', 'isCanonicalCoreObjectIdV2', 'isCoreBaseId', 'validateModeNeutralCoreRootV1']),
  ],
  [
    'src/online/protocol/variableCommand.ts',
    new Set(['CoreCommandV1', 'CoreDomainEventV1', 'CorePhysicalCardId', 'CorePlayerId', 'applyCoreCommandV1', 'coreCanonicalDigestFromValueV1', 'coreUndoAuthorizedPlayerV1', 'createModeNeutralCoreRootV1']),
  ],
]);

function isFrozenProtocolCoreConsumer(
  path: string,
  target: string | null,
  reference: ImportReference,
): boolean {
  if (target === null || relativeRepositoryPath(target) !== 'src/engine/core/index.ts') {
    return false;
  }
  if (reference.kind !== 'import' && reference.kind !== 'import-type') return false;
  const allowed = frozenProtocolCoreImports.get(normalizePath(path));
  return allowed !== undefined
    && reference.importedNames.length > 0
    && reference.importedNames.every((name) => allowed.has(name));
}

const frozenCloudflareCoreImports = new Map<string, ReadonlySet<string>>([
  [
    'src/online/cloudflare/persistence.ts',
    new Set(['coreSha256HexV1']),
  ],
]);

const frozenDeckSubmissionCoreImports = new Map<string, ReadonlySet<string>>([
  [
    'src/online/deckSubmission/resolution.ts',
    new Set(['coreSha256HexV1']),
  ],
  [
    'src/online/deckSubmission/validation.ts',
    new Set(['coreSha256HexV1']),
  ],
]);

const frozenGenesisCoreImports = new Map<string, ReadonlySet<string>>([
  [
    'src/online/genesis/index.ts',
    new Set([
      'CORE_CLOSURE_VERSION_VECTOR_V1',
      'CoreCardDefinitionSnapshotV1',
      'CoreCardObjectRuntimeStateV1',
      'CoreObjectId',
      'CorePhysicalCardV1',
      'CorePlayerId',
      'ModeNeutralCoreRootV1',
      'coreCanonicalDigestFromValueV1',
      'coreCardObjectIdOf',
      'coreSha256HexV1',
      'createCoreCommanderCastLedgerV1',
      'createCoreCommanderDamageProvenanceLedgerV1',
      'createCoreCommanderDamageStateV1',
      'createCoreCommanderIdentityV1',
      'createCorePlayerLifecycleStateV1',
      'createCoreReplayPackageV1',
      'createCoreRuleAuthorityBundleV1',
      'createCoreStackTransactionBundleV1',
      'createCoreTurnPriorityBundleV1',
      'createModeNeutralCoreControlSliceV1',
      'createModeNeutralCoreDecisionAuthoritySliceV1',
      'createModeNeutralCoreObjectRegistryStateV2',
      'createModeNeutralCoreObjectRuntimeStateV2',
      'createModeNeutralCorePendingTriggerSliceV1',
      'createModeNeutralCorePlayPermissionSliceV1',
      'createModeNeutralCoreRootV1',
      'createModeNeutralCoreSearchSessionSliceV1',
      'createModeNeutralCoreStackAnnouncementSliceV1',
      'createModeNeutralCoreTurnLifecycleSliceV1',
      'createModeNeutralCoreVisibilitySliceV1',
      'replayCoreCommandsV1',
      'serializeModeNeutralCoreRootV1',
    ]),
  ],
  [
    'src/online/genesis/variable.ts',
    new Set([
      'CORE_CLOSURE_VERSION_VECTOR_V1',
      'CoreCardDefinitionSnapshotV1',
      'CoreCardObjectRuntimeStateV1',
      'CoreObjectId',
      'CorePhysicalCardV1',
      'CorePlayerId',
      'ModeNeutralCoreRootV1',
      'coreCanonicalDigestFromValueV1',
      'coreCardObjectIdOf',
      'coreSha256HexV1',
      'createCoreCommanderCastLedgerV1',
      'createCoreCommanderDamageProvenanceLedgerV1',
      'createCoreCommanderDamageStateV1',
      'createCoreCommanderIdentityV1',
      'createCorePlayerLifecycleStateV1',
      'createCoreReplayPackageV1',
      'createCoreRuleAuthorityBundleV1',
      'createCoreStackTransactionBundleV1',
      'createCoreTurnPriorityBundleV1',
      'createModeNeutralCoreControlSliceV1',
      'createModeNeutralCoreDecisionAuthoritySliceV1',
      'createModeNeutralCoreObjectRegistryStateV2',
      'createModeNeutralCoreObjectRuntimeStateV2',
      'createModeNeutralCorePendingTriggerSliceV1',
      'createModeNeutralCorePlayPermissionSliceV1',
      'createModeNeutralCoreRootV1',
      'createModeNeutralCoreSearchSessionSliceV1',
      'createModeNeutralCoreStackAnnouncementSliceV1',
      'createModeNeutralCoreTurnLifecycleSliceV1',
      'createModeNeutralCoreVisibilitySliceV1',
      'replayCoreCommandsV1',
      'serializeModeNeutralCoreRootV1',
    ]),
  ],
]);

function isFrozenGenesisCoreConsumer(
  path: string,
  target: string | null,
  reference: ImportReference,
): boolean {
  if (target === null || relativeRepositoryPath(target) !== 'src/engine/core/index.ts') {
    return false;
  }
  if (reference.kind !== 'import' && reference.kind !== 'import-type') return false;
  const allowed = frozenGenesisCoreImports.get(normalizePath(path));
  return allowed !== undefined
    && reference.importedNames.length > 0
    && reference.importedNames.every((name) => allowed.has(name));
}

function isFrozenDeckSubmissionCoreConsumer(
  path: string,
  target: string | null,
  reference: ImportReference,
): boolean {
  if (target === null || relativeRepositoryPath(target) !== 'src/engine/core/index.ts') {
    return false;
  }
  if (reference.kind !== 'import' && reference.kind !== 'import-type') return false;
  const allowed = frozenDeckSubmissionCoreImports.get(normalizePath(path));
  return allowed !== undefined
    && reference.importedNames.length > 0
    && reference.importedNames.every((name) => allowed.has(name));
}

function isFrozenCloudflareCoreConsumer(
  path: string,
  target: string | null,
  reference: ImportReference,
): boolean {
  if (target === null || relativeRepositoryPath(target) !== 'src/engine/core/index.ts') {
    return false;
  }
  if (reference.kind !== 'import' && reference.kind !== 'import-type') return false;
  const allowed = frozenCloudflareCoreImports.get(normalizePath(path));
  return allowed !== undefined
    && reference.importedNames.length > 0
    && reference.importedNames.every((name) => allowed.has(name));
}

const frozenO4p09DCoreImports = new Map<string, ReadonlySet<string>>([
  ['src/online/cloudflare/runtime.ts|src/engine/core/index.ts|import', new Set(['coreCanonicalDigestFromValueV1'])],
  ['src/online/cloudflare/runtime.ts|src/engine/core/index.ts|import-type', new Set(['CoreCommandV1', 'CoreObjectId', 'CorePlayerId'])],
  ['src/components/online/OnlineTabletopManual.tsx|src/engine/core/index.ts|import-type', new Set(['CoreCardDefinitionSnapshotV1', 'CoreManaColorV1', 'CoreObjectId', 'CorePlayerId'])],
  ['src/components/online/OnlineTabletopManual.tsx|src/engine/core/transition/zoneDestination.ts|import-type', new Set(['CoreCardZoneDestinationV1'])],
  ['src/components/online/tabletopManualViewTypes.ts|src/engine/core/index.ts|import-type', new Set(['CoreCardDefinitionSnapshotV1', 'CoreManaColorV1', 'CoreObjectId', 'CoreObjectIdKindV2', 'CorePlayerId'])],
  ['src/components/online/tabletopManualViewTypes.ts|src/engine/core/transition/zoneDestination.ts|import-type', new Set(['CoreCardZoneDestinationV1'])],
  ['src/dev/visualFixtures/TabletopManualFixture.tsx|src/engine/core/index.ts|import-type', new Set(['CoreCardDefinitionSnapshotV1', 'CoreManaPoolV1', 'CoreObjectId', 'CorePlayerId'])],
  ['src/online/tabletopManual/binding.ts|src/engine/core/index.ts|import', new Set(['CoreCommandPayloadV1', 'CoreCommandV1', 'CoreObjectId', 'CorePlayerId', 'createCoreCommandV1', 'validateCoreCommandV1'])],
  ['src/online/tabletopManual/binding.ts|src/engine/core/rules/decisionAuthorityV1.ts|import-type', new Set(['CoreDecisionContextV1'])],
  ['src/online/tabletopManual/binding.ts|src/engine/core/rules/ruleZoneRefV1.ts|import-type', new Set(['CoreRuleZoneRefV1'])],
  ['src/online/tabletopManual/server.ts|src/engine/core/index.ts|import', new Set([
    'CoreCommandPayloadV1',
    'CoreCommandV1',
    'CoreGameObjectIdentityV2',
    'CoreObjectId',
    'CoreObjectRegistryStateV2',
    'CorePlayerId',
    'CoreTurnPositionV1',
    'coreCanonicalDigestFromValueV1',
    'createCoreCommandV1',
    'currentCoreObjectControllerV1',
  ])],
  ['src/online/tabletopManual/types.ts|src/engine/core/cardDefinition.ts|import-type', new Set(['CoreManaColorV1'])],
  ['src/online/tabletopManual/types.ts|src/engine/core/index.ts|import-type', new Set(['CoreObjectId', 'CorePlayerId', 'CoreRuleZoneRefV1'])],
  ['src/online/tabletopManual/types.ts|src/engine/core/transition/zoneDestination.ts|import-type', new Set(['CoreCardZoneDestinationV1'])],
  ['src/online/tabletopManual/validation.ts|src/engine/core/cardDefinition.ts|import-type', new Set(['CoreCardDefinitionSnapshotV1'])],
  ['src/online/tabletopManual/validation.ts|src/engine/core/ids.ts|import', new Set(['isCoreBaseId', 'isCoreUnsafeRecordKey'])],
  ['src/online/tabletopManual/validation.ts|src/engine/core/object/objectIdV2.ts|import', new Set(['isCanonicalCoreObjectIdV2'])],
  ['src/online/tabletopManual/validation.ts|src/engine/core/transition/zoneDestination.ts|import', new Set(['validateCoreCardZoneDestinationV1'])],
]);

function isFrozenO4p09DCoreConsumer(
  path: string,
  target: string | null,
  reference: ImportReference,
): boolean {
  if (target === null) return false;
  if (reference.kind !== 'import' && reference.kind !== 'import-type') return false;
  const allowed = frozenO4p09DCoreImports.get(
    [normalizePath(path), relativeRepositoryPath(target), reference.kind].join('|'),
  );
  return allowed !== undefined
    && reference.importedNames.length > 0
    && reference.importedNames.every((name) => allowed.has(name));
}

const frozenO4p09ECoreImports = new Map<string, ReadonlySet<string>>([
  [
    'src/online/visibilityDecisions/binding.ts|src/engine/core/index.ts|import',
    new Set([
      'CoreCommandV1',
      'CoreObjectId',
      'CoreRuleDurationV1',
      'coreCanonicalDigestFromValueV1',
      'coreVisibilityTopLibraryPrefixDigestV1',
      'createCoreCommandV1',
    ]),
  ],
  [
    'src/online/visibilityDecisions/sessionHandle.ts|src/engine/core/index.ts|import',
    new Set(['coreCanonicalDigestFromValueV1']),
  ],
  [
    'src/online/visibilityDecisions/types.ts|src/engine/core/index.ts|import-type',
    new Set(['CoreCommandV1', 'CorePlayerId']),
  ],
]);

function isFrozenO4p09ECoreConsumer(
  path: string,
  target: string | null,
  reference: ImportReference,
): boolean {
  if (target === null) return false;
  if (reference.kind !== 'import' && reference.kind !== 'import-type') return false;
  const allowed = frozenO4p09ECoreImports.get(
    [normalizePath(path), relativeRepositoryPath(target), reference.kind].join('|'),
  );
  return allowed !== undefined
    && reference.importedNames.length > 0
    && reference.importedNames.every((name) => allowed.has(name));
}

const frozenProjectionCoreImports = new Map<string, ReadonlySet<string>>([
  [
    'src/online/projection/requestTypes.ts',
    new Set(['CoreDecisionContextV1']),
  ],
  [
    'src/online/projection/variable.ts',
    new Set([
      'CoreObjectId',
      'CorePlayerId',
      'currentCoreObjectControllerV1',
      'isCoreUndoAuthorizedPlayerV1',
    ]),
  ],
  [
    'src/online/projection/project.ts',
    new Set([
      'CoreGameObjectIdentityV2',
      'CoreObjectId',
      'CorePlayerId',
      'CoreRuleDurationV1',
      'CoreVisibilityGrantV1',
      'CoreVisibilitySubjectV1',
      'ModeNeutralCoreObjectRegistrySliceV2',
      'ModeNeutralCoreObjectRuntimeSliceV2',
      'coreCanPlayerAttemptPlayObjectV1',
      'coreCanPlayerViewObjectIdentityV1',
      'coreDecisionMakerForV1',
      'currentCoreObjectControllerV1',
      'parseCoreObjectIdV2',
    ]),
  ],
  [
    'src/online/projection/support.ts',
    new Set([
      'CoreDecisionContextV1',
      'CoreObjectId',
      'CorePlayerId',
      'CoreRuleZoneRefV1',
      'isCanonicalCoreObjectIdV2',
      'isCoreBaseId',
      'validateCoreRuleZoneRefV1',
    ]),
  ],
  [
    'src/online/projection/types.ts',
    new Set([
      'CoreCardDefinitionSnapshotV1',
      'CoreDecisionContextV1',
      'CoreManaPoolV1',
      'CoreObjectId',
      'CoreObjectIdKindV2',
      'CorePlayerExitCauseV1',
      'CorePlayerId',
      'CorePlayerLifecycleStatusV1',
      'CoreRuleZoneRefV1',
      'CoreSearchCriteriaV1',
      'CoreSearchPortionV1',
    ]),
  ],
  [
    'src/online/projection/validation.ts',
    new Set([
      'CoreObjectId',
      'CorePlayerId',
      'isCanonicalCoreObjectIdV2',
      'isCoreBaseId',
      'parseCoreObjectIdV2',
      'validateCoreRuleZoneRefV1',
    ]),
  ],
]);

function isFrozenProjectionCoreConsumer(
  path: string,
  target: string | null,
  reference: ImportReference,
): boolean {
  if (target === null || relativeRepositoryPath(target) !== 'src/engine/core/index.ts') {
    return false;
  }
  if (reference.kind !== 'import' && reference.kind !== 'import-type') return false;
  const allowed = frozenProjectionCoreImports.get(normalizePath(path));
  return allowed !== undefined
    && reference.importedNames.length > 0
    && reference.importedNames.every((name) => allowed.has(name));
}

const frozenPregameCoreImports = new Map<string, ReadonlySet<string>>([
  [
    'src/online/pregame/types.ts',
    new Set([
      'CoreObjectId',
      'CorePhysicalCardId',
      'CorePlayerId',
      'ModeNeutralCoreRootV1',
    ]),
  ],
  [
    'src/online/pregame/validation.ts',
    new Set([
      'CorePhysicalCardId',
      'CorePlayerId',
      'coreSha256HexV1',
      'isCanonicalCoreObjectIdV2',
      'isCoreBaseId',
    ]),
  ],
  [
    'src/online/pregame/operations.ts',
    new Set([
      'CoreObjectId',
      'CorePlayerId',
      'applyCorePregameMulliganWaveV1',
      'commitCorePregameBottomBatchV1',
      'coreSha256HexV1',
      'dealCorePregameOpeningHandsV1',
      'rotateCorePregameTurnOrderV1',
    ]),
  ],
  [
    'src/online/pregame/projection.ts',
    new Set(['CorePlayerId']),
  ],
]);

function isFrozenPregameCoreConsumer(
  path: string,
  target: string | null,
  reference: ImportReference,
): boolean {
  if (target === null || relativeRepositoryPath(target) !== 'src/engine/core/index.ts') {
    return false;
  }
  if (reference.kind !== 'import' && reference.kind !== 'import-type') return false;
  const allowed = frozenPregameCoreImports.get(normalizePath(path));
  return allowed !== undefined
    && reference.importedNames.length > 0
    && reference.importedNames.every((name) => allowed.has(name));
}

const frozenDisplayPairingCoreImports = new Map<string, ReadonlySet<string>>([
  [
    'src/online/displayPairing/model.ts',
    new Set([
      'CoreCommandPayloadV1',
      'CorePlayerId',
      'createCoreCommandV1',
      'isCoreBaseId',
    ]),
  ],
  [
    'src/online/displayPairing/types.ts',
    new Set(['CoreCommandV1', 'CorePlayerId']),
  ],
]);

function isFrozenDisplayPairingCoreConsumer(
  path: string,
  target: string | null,
  reference: ImportReference,
): boolean {
  if (target === null || relativeRepositoryPath(target) !== 'src/engine/core/index.ts') {
    return false;
  }
  if (reference.kind !== 'import' && reference.kind !== 'import-type') return false;
  const allowed = frozenDisplayPairingCoreImports.get(normalizePath(path));
  return allowed !== undefined
    && reference.importedNames.length > 0
    && reference.importedNames.every((name) => allowed.has(name));
}

const frozenGuidedActionsCoreImports = new Map<string, ReadonlySet<string>>([
  [
    'src/online/guidedActions/model.ts',
    new Set([
      'CoreCommandPayloadV1',
      'CoreObjectId',
      'CorePlayerId',
      'createCoreCommandV1',
      'isCanonicalCoreObjectIdV2',
      'isCoreBaseId',
      'validateCoreCommandV1',
    ]),
  ],
  [
    'src/online/guidedActions/types.ts',
    new Set(['CoreObjectId', 'CorePlayerId']),
  ],
]);

function isFrozenGuidedActionsCoreConsumer(
  path: string,
  target: string | null,
  reference: ImportReference,
): boolean {
  if (target === null || relativeRepositoryPath(target) !== 'src/engine/core/index.ts') {
    return false;
  }
  if (reference.kind !== 'import' && reference.kind !== 'import-type') return false;
  const allowed = frozenGuidedActionsCoreImports.get(normalizePath(path));
  return allowed !== undefined
    && reference.importedNames.length > 0
    && reference.importedNames.every((name) => allowed.has(name));
}

const frozenHeadlessCoreImports = new Map<string, ReadonlySet<string>>([
  [
    'src/online/headless/operation.ts',
    new Set([
      'CoreCommandV1',
      'coreCanonicalDigestFromValueV1',
      'replayCoreCommandsV1',
      'runOrdinaryFourPlayerCoreClosureV1',
    ]),
  ],
  [
    'src/online/headless/types.ts',
    new Set(['CoreCommandV1', 'CoreDecisionContextV1', 'CorePlayerId']),
  ],
  [
    'src/online/headless/validation.ts',
    new Set([
      'CoreCommandV1',
      'CoreDecisionContextV1',
      'CorePlayerId',
      'validateCoreCommandV1',
    ]),
  ],
]);

function isFrozenHeadlessCoreConsumer(
  path: string,
  target: string | null,
  reference: ImportReference,
): boolean {
  if (target === null || relativeRepositoryPath(target) !== 'src/engine/core/index.ts') {
    return false;
  }
  if (reference.kind !== 'import' && reference.kind !== 'import-type') return false;
  const allowed = frozenHeadlessCoreImports.get(normalizePath(path));
  return allowed !== undefined
    && reference.importedNames.length > 0
    && reference.importedNames.every((name) => allowed.has(name));
}

const frozenBootstrapCoreImports = new Map<string, ReadonlySet<string>>([
  [
    'src/online/bootstrap/catalog/catalogV1.ts',
    new Set([
      'CoreCardDefinitionSnapshotV1',
      'CoreColorIdentityV1',
      'CoreManaColorV1',
      'CorePlayerId',
      'createModeNeutralCoreObjectRegistryStateV2',
    ]),
  ],
  [
    'src/online/bootstrap/fourDeckBootstrapV1.ts',
    new Set([
      'CORE_CLOSURE_VERSION_VECTOR_V1',
      'CoreCardDefinitionSnapshotV1',
      'CoreCardObjectRuntimeStateV1',
      'CoreObjectId',
      'CorePhysicalCardV1',
      'CorePlayerId',
      'ModeNeutralCoreRootV1',
      'coreCanonicalDigestFromValueV1',
      'coreCardObjectIdOf',
      'createCoreCommanderCastLedgerV1',
      'createCoreCommanderDamageProvenanceLedgerV1',
      'createCoreCommanderDamageStateV1',
      'createCoreCommanderIdentityV1',
      'createCorePlayerLifecycleStateV1',
      'createCoreReplayPackageV1',
      'createCoreRuleAuthorityBundleV1',
      'createCoreStackTransactionBundleV1',
      'createCoreTurnPriorityBundleV1',
      'createModeNeutralCoreControlSliceV1',
      'createModeNeutralCoreDecisionAuthoritySliceV1',
      'createModeNeutralCoreObjectRegistryStateV2',
      'createModeNeutralCoreObjectRuntimeStateV2',
      'createModeNeutralCorePendingTriggerSliceV1',
      'createModeNeutralCorePlayPermissionSliceV1',
      'createModeNeutralCoreRootV1',
      'createModeNeutralCoreSearchSessionSliceV1',
      'createModeNeutralCoreStackAnnouncementSliceV1',
      'createModeNeutralCoreTurnLifecycleSliceV1',
      'createModeNeutralCoreVisibilitySliceV1',
      'replayCoreCommandsV1',
      'serializeModeNeutralCoreRootV1',
    ]),
  ],
]);

function isFrozenBootstrapCoreConsumer(
  path: string,
  target: string | null,
  reference: ImportReference,
): boolean {
  if (target === null || relativeRepositoryPath(target) !== 'src/engine/core/index.ts') {
    return false;
  }
  if (reference.kind !== 'import' && reference.kind !== 'import-type') return false;
  const allowed = frozenBootstrapCoreImports.get(normalizePath(path));
  return allowed !== undefined
    && reference.importedNames.length > 0
    && reference.importedNames.every((name) => allowed.has(name));
}

function isExistingCardTypeModule(target: string | null): boolean {
  if (target === null) return false;
  const normalized = relativeRepositoryPath(target);
  return normalized === 'src/types/card.ts' || normalized === 'src/types/card.tsx';
}

function isExistingEngineTypeModule(target: string | null): boolean {
  if (target === null) return false;
  const normalized = relativeRepositoryPath(target);
  return normalized === 'src/engine/types.ts' || normalized === 'src/engine/types.tsx';
}

function isProductLayerTarget(target: string | null): boolean {
  if (target === null) return false;
  return isWithin(resolve(sourceRoot, 'online'), target)
    || isWithin(resolve(sourceRoot, 'store'), target)
    || isWithin(resolve(sourceRoot, 'components'), target)
    || isWithin(resolve(sourceRoot, 'data'), target)
    || target === resolve(sourceRoot, 'App.tsx');
}

function addViolation(
  violations: BoundaryViolation[],
  reference: ImportReference,
  rule: string,
): void {
  violations.push({
    filePath: relativeRepositoryPath(reference.filePath),
    kind: reference.kind,
    rule,
    specifier: reference.specifier,
  });
}

function hasForbiddenCoreTypeSyntax(unit: SourceUnit, violations: BoundaryViolation[]): void {
  const unitPath = relativeRepositoryPath(unit.filePath);
  if (!isCorePath(unitPath) || isTestPath(unitPath)) return;
  const sourceFile = ts.createSourceFile(
    unit.filePath,
    unit.sourceText,
    ts.ScriptTarget.Latest,
    true,
    unit.filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  function visit(node: ts.Node): void {
    if (ts.isTypeAliasDeclaration(node) && ts.isTypeReferenceNode(node.type)) {
      const name = node.type.typeName.getText(sourceFile);
      if (name === 'GameState' || name === 'CardInstance' || name === 'CardDef') {
        violations.push({
          filePath: relativeRepositoryPath(unit.filePath),
          kind: 'syntax',
          rule: 'core-no-existing-type-alias',
          specifier: name,
        });
      }
    }
    if (ts.isInterfaceDeclaration(node) && node.heritageClauses?.some((clause) =>
      clause.types.some((type) => {
        const name = type.expression.getText(sourceFile);
        return name === 'GameState' || name === 'CardInstance' || name === 'CardDef';
      })
    )) {
      violations.push({
        filePath: relativeRepositoryPath(unit.filePath),
        kind: 'syntax',
        rule: 'core-no-existing-type-extends',
        specifier: node.name.text,
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
}

function inspectReference(
  unit: SourceUnit,
  reference: ImportReference,
  violations: BoundaryViolation[],
): void {
  const unitPath = relativeRepositoryPath(unit.filePath);
  const target = resolveSourceTarget(unit.filePath, reference.specifier);
  const referencedPath = resolveSpecifierBasePath(unit.filePath, reference.specifier);
  const coreUnit = isCorePath(unitPath) && !isTestPath(unitPath);
  const coreTarget = target !== null && isCorePath(relativeRepositoryPath(target));
  if (coreUnit) {
    const boundaryTarget = target ?? referencedPath;
    if (isProductLayerTarget(boundaryTarget)) {
      addViolation(violations, reference, 'core-no-product-layer');
    }
    if (moduleMatches(reference.specifier, 'react')
      || moduleMatches(reference.specifier, 'react-dom')
      || moduleMatches(reference.specifier, 'zustand')
      || moduleMatches(reference.specifier, 'idb')
      || moduleMatches(reference.specifier, 'fake-indexeddb')
      || moduleMatches(reference.specifier, 'ws')
      || moduleMatches(reference.specifier, 'isomorphic-ws')
      || moduleMatches(reference.specifier, 'axios')
      || moduleMatches(reference.specifier, 'ky')
      || reference.specifier.startsWith('cloudflare:')
      || reference.specifier.startsWith('@cloudflare/')
      || reference.specifier.startsWith('node:')) {
      addViolation(violations, reference, 'core-no-runtime-dependency');
    }
    if (isExistingCardTypeModule(target)
      || isExistingEngineTypeModule(target)
      || reference.importedNames.some((name) => name === 'GameState' || name === 'CardInstance' || name === 'CardDef')) {
      addViolation(violations, reference, 'core-no-existing-type-import');
    }
    if (target !== null && !coreTarget && !isProductLayerTarget(target)
      && !isExistingCardTypeModule(target) && !isExistingEngineTypeModule(target)) {
      addViolation(violations, reference, 'core-no-unapproved-import');
    }
    const knownRuntimeDependency = moduleMatches(reference.specifier, 'react')
      || moduleMatches(reference.specifier, 'react-dom')
      || moduleMatches(reference.specifier, 'zustand')
      || moduleMatches(reference.specifier, 'idb')
      || moduleMatches(reference.specifier, 'fake-indexeddb')
      || moduleMatches(reference.specifier, 'ws')
      || moduleMatches(reference.specifier, 'isomorphic-ws')
      || moduleMatches(reference.specifier, 'axios')
      || moduleMatches(reference.specifier, 'ky')
      || reference.specifier.startsWith('cloudflare:')
      || reference.specifier.startsWith('@cloudflare/')
      || reference.specifier.startsWith('node:');
    if (target === null && !knownRuntimeDependency) {
      addViolation(violations, reference, 'core-unresolved-import');
    }
  }
  if (unitPath.startsWith('src/engine/') && !unitPath.includes('/__tests__/') && referencedPath !== null
    && normalizePath(relative(sourceRoot, target ?? referencedPath)).startsWith('online/')) {
    addViolation(violations, reference, 'engine-no-online-reverse-import');
  }
  if (coreTarget && !coreUnit && !isTestPath(unitPath) && !isVerificationScript(unitPath)
    && !isFrozenCompatibilityCoreConsumer(unitPath, target)
    && !isFrozenRoomCoreConsumer(unitPath, target, reference)
    && !isFrozenApplicationCoreConsumer(unitPath, target, reference)
    && !isFrozenProtocolCoreConsumer(unitPath, target, reference)
    && !isFrozenCloudflareCoreConsumer(unitPath, target, reference)
    && !isFrozenO4p09DCoreConsumer(unitPath, target, reference)
    && !isFrozenO4p09ECoreConsumer(unitPath, target, reference)
    && !isFrozenDeckSubmissionCoreConsumer(unitPath, target, reference)
    && !isFrozenGenesisCoreConsumer(unitPath, target, reference)
    && !isFrozenProjectionCoreConsumer(unitPath, target, reference)
    && !isFrozenPregameCoreConsumer(unitPath, target, reference)
    && !isFrozenDisplayPairingCoreConsumer(unitPath, target, reference)
    && !isFrozenGuidedActionsCoreConsumer(unitPath, target, reference)
    && !isFrozenHeadlessCoreConsumer(unitPath, target, reference)
    && !isFrozenBootstrapCoreConsumer(unitPath, target, reference)) {
    addViolation(violations, reference, 'core-no-product-runtime-import');
  }
}

export function analyzeBoundarySources(units: readonly SourceUnit[]): readonly BoundaryViolation[] {
  const violations: BoundaryViolation[] = [];
  for (const unit of units) {
    for (const reference of importReferences(unit)) inspectReference(unit, reference, violations);
    hasForbiddenCoreTypeSyntax(unit, violations);
  }
  return violations.sort((left, right) =>
    codeUnitCompare(left.filePath, right.filePath)
    || codeUnitCompare(left.specifier, right.specifier)
    || codeUnitCompare(left.kind, right.kind)
    || codeUnitCompare(left.rule, right.rule));
}

function collectFiles(directory: string): SourceUnit[] {
  const units: SourceUnit[] = [];
  function visit(current: string): void {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!ignoredDirectoryNames.has(entry.name) && entry.name !== '__tests__') visit(resolve(current, entry.name));
        continue;
      }
      if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        const filePath = resolve(current, entry.name);
        units.push({ filePath, sourceText: readFileSync(filePath, 'utf8') });
      }
    }
  }
  visit(directory);
  return units;
}

function repositoryUnits(): readonly SourceUnit[] {
  return [...collectFiles(sourceRoot), ...collectFiles(resolve(repositoryRoot, 'scripts'))];
}

describe('mode-neutral Core dependency boundary', () => {
  it('passes the current repository boundary', { timeout: 60000 }, () => {
    expect(analyzeBoundarySources(repositoryUnits())).toEqual([]);
    expect(existsSync(resolve(sourceRoot, 'online'))).toBe(true);
  });

  it('detects import, import type, re-export, dynamic import, and engine reverse-import violations', () => {
    const units: SourceUnit[] = [
      {
        filePath: resolve(repositoryRoot, 'src/engine/core/fixture.ts'),
        sourceText: [
          "import type { GameState } from '../../engine/types';",
          "import '../../store/gameStore';",
          "export { value } from '../../components/value';",
          "const online = import('../../online/domain/state');",
          "import 'react';",
          "import 'zustand';",
          "import 'cloudflare:test';",
          'type Alias = GameState;',
        ].join('\n'),
      },
      {
        filePath: resolve(repositoryRoot, 'src/engine/game.ts'),
        sourceText: "import '../online/domain/state';",
      },
      {
        filePath: resolve(repositoryRoot, 'src/components/runtime.tsx'),
        sourceText: "import '../engine/core/index';",
      },
    ];
    const violations = analyzeBoundarySources(units);
    expect(violations).toHaveLength(13);
    expect(violations.map(({ rule }) => rule)).toEqual(expect.arrayContaining([
      'core-no-product-runtime-import',
      'core-no-existing-type-import',
      'core-no-existing-type-alias',
      'core-no-product-layer',
      'core-no-runtime-dependency',
      'core-unresolved-import',
      'engine-no-online-reverse-import',
    ]));
    const keys = violations.map(({ filePath, specifier, kind, rule }) => `${filePath}|${specifier}|${kind}|${rule}`);
    expect(keys).toEqual(keys.slice().sort((left, right) => left < right ? -1 : left > right ? 1 : 0));
    expect(violations.some(({ kind }) => kind === 'import-type')).toBe(true);
    expect(violations.some(({ kind }) => kind === 're-export')).toBe(true);
    expect(violations.some(({ kind }) => kind === 'dynamic-import')).toBe(true);
  });

  it('detects namespace imports, type queries, and star re-exports of existing card types', () => {
    const units: SourceUnit[] = [{
      filePath: resolve(repositoryRoot, 'src/engine/core/fixture.ts'),
      sourceText: [
        "import * as cardTypes from '../../types/card';",
        "export * from '../../types/card';",
        "type ExistingCard = import('../../types/card').CardDef;",
      ].join('\n'),
    }];
    const violations = analyzeBoundarySources(units);
    expect(violations).toHaveLength(3);
    expect(violations.every(({ rule }) => rule === 'core-no-existing-type-import')).toBe(true);
    expect(violations.map(({ kind }) => kind)).toEqual(['import', 're-export', 'type-query']);
  });

  it('detects ambiguous engine-type forms, runtime extensions, and unresolved aliases', () => {
    const units: SourceUnit[] = [{
      filePath: resolve(repositoryRoot, 'src/engine/core/fixture.ts'),
      sourceText: [
        "import * as engineTypes from '../../engine/types.js';",
        "export * from '../../engine/types';",
        "type ExistingCard = import('../../engine/types.js').CardDef;",
        "import { GameState } from '../../engine/types.js';",
        "import { GameState as AliasedGameState } from '@engine/types';",
      ].join('\n'),
    }];
    const violations = analyzeBoundarySources(units);
    expect(violations.filter(({ rule }) => rule === 'core-no-existing-type-import')).toHaveLength(5);
    expect(violations.filter(({ rule }) => rule === 'core-unresolved-import')).toHaveLength(1);
  });

  it('rejects unresolved relative imports and every node builtin subpath', () => {
    const units: SourceUnit[] = [{
      filePath: resolve(repositoryRoot, 'src/engine/core/fixture.ts'),
      sourceText: [
        "import './missing-module';",
        "import 'node:fs/promises';",
        "import type { Pip } from '../../engine/mana';",
        "import type { ZoneId } from '../../engine/types';",
      ].join('\n'),
    }];
    const violations = analyzeBoundarySources(units);
    expect(violations.map(({ rule }) => rule)).toEqual([
      'core-no-unapproved-import',
      'core-no-existing-type-import',
      'core-unresolved-import',
      'core-no-runtime-dependency',
    ]);
  });

  it('does not false-positive permitted Core internal and test imports', () => {
    const units: SourceUnit[] = [
      {
        filePath: resolve(repositoryRoot, 'src/engine/core/fixture.ts'),
        sourceText: "import { coreCardObjectIdOf } from './ids';",
      },
      {
        filePath: resolve(repositoryRoot, 'src/engine/core/__tests__/fixture.test.ts'),
        sourceText: "import { createModeNeutralCoreIdentityZoneSliceV1 } from '../index';",
      },
      {
        filePath: resolve(repositoryRoot, 'src/test/architecture/fixture.test.ts'),
        sourceText: "import type { ModeNeutralCoreIdentityZoneSliceV1 } from '../../engine/core';",
      },
      {
        filePath: resolve(repositoryRoot, 'scripts/checks/verify-mode-neutral-core-identity-zone.ts'),
        sourceText: "import { validateModeNeutralCoreIdentityZoneSliceV1 } from '../../src/engine/core';",
      },
      {
        filePath: resolve(repositoryRoot, 'scripts/checks/verify-mode-neutral-core-card-runtime.ts'),
        sourceText: "import { validateModeNeutralCoreCardRuntimeSliceV1 } from '../../src/engine/core';",
      },
      {
        filePath: resolve(repositoryRoot, 'scripts/checks/verify-mode-neutral-core-zone-transition.ts'),
        sourceText: "import { applyCoreCardZoneTransitionV1 } from '../../src/engine/core/transition/cardZoneTransition';",
      },
      {
        filePath: resolve(repositoryRoot, 'scripts/checks/verify-mode-neutral-core-stack-announcement.ts'),
        sourceText: "import { validateModeNeutralCoreStackAnnouncementSliceV1 } from '../../src/engine/core';",
      },
      {
        filePath: resolve(repositoryRoot, 'scripts/checks/verify-mode-neutral-core-commander-combat-player-exit.ts'),
        sourceText: "import * as Core from '../../src/engine/core';",
      },
      {
        filePath: resolve(repositoryRoot, 'scripts/checks/verify-mode-neutral-core-closure.ts'),
        sourceText: "import * as Core from '../../src/engine/core';",
      },
      {
        filePath: resolve(repositoryRoot, 'scripts/checks/verify-solo-core-compatibility.ts'),
        sourceText: "import * as Core from '../../src/engine/core';",
      },
      {
        filePath: resolve(repositoryRoot, 'scripts/checks/verify-online-four-seat-room.ts'),
        sourceText: "import * as Core from '../../src/engine/core';",
      },
      {
        filePath: resolve(repositoryRoot, 'src/engine/compatibility/soloCoreCompatibilityV1.ts'),
        sourceText: "import { isCoreBaseId } from '../core';",
      },
      {
        filePath: resolve(repositoryRoot, 'src/online/room/operations.ts'),
        sourceText: "import { validateModeNeutralCoreRootV1 } from '../../engine/core/index';",
      },
      {
        filePath: resolve(repositoryRoot, 'src/online/room/types.ts'),
        sourceText: "import type { CorePlayerId } from '../../engine/core/index';",
      },
      {
        filePath: resolve(repositoryRoot, 'src/online/room/validation.ts'),
        sourceText: "import { isCoreBaseId } from '../../engine/core/index';",
      },
      {
        filePath: resolve(repositoryRoot, 'src/online/protocol/command.ts'),
        sourceText: "import { applyCoreCommandV1, coreCanonicalDigestFromValueV1 } from '../../engine/core/index';",
      },
      {
        filePath: resolve(repositoryRoot, 'src/online/protocol/state.ts'),
        sourceText: "import { validateModeNeutralCoreRootV1 } from '../../engine/core/index';",
      },
      {
        filePath: resolve(repositoryRoot, 'src/online/protocol/types.ts'),
        sourceText: "import type { CoreCommandV1, ModeNeutralCoreRootV1 } from '../../engine/core/index';",
      },
      {
        filePath: resolve(repositoryRoot, 'src/online/protocol/validation.ts'),
        sourceText: "import { validateCoreCommandV1, type CoreCommandV1 } from '../../engine/core/index';",
      },
      {
        filePath: resolve(repositoryRoot, 'src/online/cloudflare/persistence.ts'),
        sourceText: "import { coreSha256HexV1 } from '../../engine/core/index';",
      },
      {
        filePath: resolve(repositoryRoot, 'src/online/deckSubmission/resolution.ts'),
        sourceText: "import { coreSha256HexV1 } from '../../engine/core/index';",
      },
      {
        filePath: resolve(repositoryRoot, 'src/online/deckSubmission/validation.ts'),
        sourceText: "import { coreSha256HexV1 } from '../../engine/core/index';",
      },
    ];
    expect(analyzeBoundarySources(units)).toEqual([]);
  });

  it('keeps the compatibility Core allowance exact and public-barrel-only', () => {
    const units: SourceUnit[] = [
      {
        filePath: resolve(repositoryRoot, 'src/engine/compatibility/soloCoreCompatibilityV1.ts'),
        sourceText: "import { isCoreBaseId } from '../core/ids';",
      },
      {
        filePath: resolve(repositoryRoot, 'src/engine/compatibility/unreviewed.ts'),
        sourceText: "import { isCoreBaseId } from '../core';",
      },
    ];
    expect(analyzeBoundarySources(units)).toEqual([
      {
        filePath: 'src/engine/compatibility/soloCoreCompatibilityV1.ts',
        kind: 'import',
        rule: 'core-no-product-runtime-import',
        specifier: '../core/ids',
      },
      {
        filePath: 'src/engine/compatibility/unreviewed.ts',
        kind: 'import',
        rule: 'core-no-product-runtime-import',
        specifier: '../core',
      },
    ]);
  });

  it('keeps the Room Core allowance exact and public-barrel-only', () => {
    const units: SourceUnit[] = [
      {
        filePath: resolve(repositoryRoot, 'src/online/room/operations.ts'),
        sourceText: "import { applyCoreCommandV1 } from '../../engine/core/closure';",
      },
      {
        filePath: resolve(repositoryRoot, 'src/online/room/operations.ts'),
        sourceText: "import { applyCoreCommandV1 as reduce } from '../../engine/core/index'; reduce(root, command);",
      },
      {
        filePath: resolve(repositoryRoot, 'src/online/room/operations.ts'),
        sourceText: "import * as Core from '../../engine/core/index'; Core.applyCoreCommandV1(root, command);",
      },
      {
        filePath: resolve(repositoryRoot, 'src/online/room/unreviewed.ts'),
        sourceText: "import { isCoreBaseId } from '../../engine/core/index';",
      },
    ];
    expect(analyzeBoundarySources(units)).toEqual([
      {
        filePath: 'src/online/room/operations.ts',
        kind: 'import',
        rule: 'core-no-product-runtime-import',
        specifier: '../../engine/core/closure',
      },
      {
        filePath: 'src/online/room/operations.ts',
        kind: 'import',
        rule: 'core-no-product-runtime-import',
        specifier: '../../engine/core/index',
      },
      {
        filePath: 'src/online/room/operations.ts',
        kind: 'import',
        rule: 'core-no-product-runtime-import',
        specifier: '../../engine/core/index',
      },
      {
        filePath: 'src/online/room/unreviewed.ts',
        kind: 'import',
        rule: 'core-no-product-runtime-import',
        specifier: '../../engine/core/index',
      },
    ]);
  });

  it('keeps the Bootstrap Core allowance file-, symbol-, and public-barrel-exact', () => {
    const allowedUnits: SourceUnit[] = [
      {
        filePath: resolve(repositoryRoot, 'src/online/bootstrap/catalog/catalogV1.ts'),
        sourceText: "import { createModeNeutralCoreObjectRegistryStateV2, type CoreCardDefinitionSnapshotV1 } from '../../../engine/core/index';",
      },
      {
        filePath: resolve(repositoryRoot, 'src/online/bootstrap/fourDeckBootstrapV1.ts'),
        sourceText: "import { createModeNeutralCoreRootV1, type ModeNeutralCoreRootV1 } from '../../engine/core/index';",
      },
    ];
    expect(analyzeBoundarySources(allowedUnits)).toEqual([]);

    const rejectedUnits: SourceUnit[] = [
      {
        filePath: resolve(repositoryRoot, 'src/online/bootstrap/unreviewed.ts'),
        sourceText: "import { createModeNeutralCoreRootV1 } from '../../engine/core/index';",
      },
      {
        filePath: resolve(repositoryRoot, 'src/online/bootstrap/fourDeckBootstrapV1.ts'),
        sourceText: "import { applyCoreCommandV1 } from '../../engine/core/index';",
      },
      {
        filePath: resolve(repositoryRoot, 'src/online/bootstrap/fourDeckBootstrapV1.ts'),
        sourceText: "import { createModeNeutralCoreRootV1 } from '../../engine/core/closure';",
      },
    ];
    expect(analyzeBoundarySources(rejectedUnits).map(({ rule }) => rule)).toEqual([
      'core-no-product-runtime-import',
      'core-no-product-runtime-import',
      'core-no-product-runtime-import',
    ]);
  });

  it('keeps the Cloudflare checkpoint-digest allowance file-, symbol-, and public-barrel-exact', () => {
    const allowedUnits: SourceUnit[] = [
      {
        filePath: resolve(repositoryRoot, 'src/online/cloudflare/persistence.ts'),
        sourceText: "import { coreSha256HexV1 } from '../../engine/core/index';",
      },
    ];
    expect(analyzeBoundarySources(allowedUnits)).toEqual([]);

    const rejectedUnits: SourceUnit[] = [
      {
        filePath: resolve(repositoryRoot, 'src/online/cloudflare/unreviewed.ts'),
        sourceText: "import { coreSha256HexV1 } from '../../engine/core/index';",
      },
      {
        filePath: resolve(repositoryRoot, 'src/online/cloudflare/persistence.ts'),
        sourceText: "import { coreCanonicalDigestFromValueV1 } from '../../engine/core/index';",
      },
      {
        filePath: resolve(repositoryRoot, 'src/online/cloudflare/persistence.ts'),
        sourceText: "import { coreSha256HexV1 } from '../../engine/core/closure';",
      },
    ];
    expect(analyzeBoundarySources(rejectedUnits).map(({ rule }) => rule)).toEqual([
      'core-no-product-runtime-import',
      'core-no-product-runtime-import',
      'core-no-product-runtime-import',
    ]);
  });

  it('keeps the deck-submission digest allowance file-, symbol-, and public-barrel-exact', () => {
    const allowedUnits: SourceUnit[] = [
      {
        filePath: resolve(repositoryRoot, 'src/online/deckSubmission/resolution.ts'),
        sourceText: "import { coreSha256HexV1 } from '../../engine/core/index';",
      },
      {
        filePath: resolve(repositoryRoot, 'src/online/deckSubmission/validation.ts'),
        sourceText: "import { coreSha256HexV1 } from '../../engine/core/index';",
      },
    ];
    expect(analyzeBoundarySources(allowedUnits)).toEqual([]);

    const rejectedUnits: SourceUnit[] = [
      {
        filePath: resolve(repositoryRoot, 'src/online/deckSubmission/unreviewed.ts'),
        sourceText: "import { coreSha256HexV1 } from '../../engine/core/index';",
      },
      {
        filePath: resolve(repositoryRoot, 'src/online/deckSubmission/resolution.ts'),
        sourceText: "import { coreCanonicalDigestFromValueV1 } from '../../engine/core/index';",
      },
      {
        filePath: resolve(repositoryRoot, 'src/online/deckSubmission/validation.ts'),
        sourceText: "import { coreSha256HexV1 } from '../../engine/core/closure';",
      },
    ];
    expect(analyzeBoundarySources(rejectedUnits).map(({ rule }) => rule)).toEqual([
      'core-no-product-runtime-import',
      'core-no-product-runtime-import',
      'core-no-product-runtime-import',
    ]);
  });

  it('keeps the dynamic-genesis Core allowance file-, symbol-, and public-barrel-exact', () => {
    const allowedUnits: SourceUnit[] = [
      {
        filePath: resolve(repositoryRoot, 'src/online/genesis/index.ts'),
        sourceText: "import { coreSha256HexV1, createModeNeutralCoreRootV1 } from '../../engine/core/index';",
      },
    ];
    expect(analyzeBoundarySources(allowedUnits)).toEqual([]);

    const rejectedUnits: SourceUnit[] = [
      {
        filePath: resolve(repositoryRoot, 'src/online/genesis/unreviewed.ts'),
        sourceText: "import { coreSha256HexV1 } from '../../engine/core/index';",
      },
      {
        filePath: resolve(repositoryRoot, 'src/online/genesis/index.ts'),
        sourceText: "import { applyCoreCommandV1 } from '../../engine/core/index';",
      },
      {
        filePath: resolve(repositoryRoot, 'src/online/genesis/index.ts'),
        sourceText: "import { coreSha256HexV1 } from '../../engine/core/closure';",
      },
    ];
    expect(analyzeBoundarySources(rejectedUnits).map(({ rule }) => rule)).toEqual([
      'core-no-product-runtime-import',
      'core-no-product-runtime-import',
      'core-no-product-runtime-import',
    ]);
  });

  it('keeps the Protocol Core allowance symbol-exact and command-reducer-only', () => {
    const units: SourceUnit[] = [
      {
        filePath: resolve(repositoryRoot, 'src/online/protocol/state.ts'),
        sourceText: "import { applyCoreCommandV1 as reduce } from '../../engine/core/index'; reduce(root, command);",
      },
      {
        filePath: resolve(repositoryRoot, 'src/online/protocol/command.ts'),
        sourceText: "import * as Core from '../../engine/core/index'; Core.applyCoreCommandV1(root, command);",
      },
      {
        filePath: resolve(repositoryRoot, 'src/online/protocol/unreviewed.ts'),
        sourceText: "import { validateCoreCommandV1 } from '../../engine/core/index';",
      },
    ];
    expect(analyzeBoundarySources(units)).toEqual([
      {
        filePath: 'src/online/protocol/command.ts',
        kind: 'import',
        rule: 'core-no-product-runtime-import',
        specifier: '../../engine/core/index',
      },
      {
        filePath: 'src/online/protocol/state.ts',
        kind: 'import',
        rule: 'core-no-product-runtime-import',
        specifier: '../../engine/core/index',
      },
      {
        filePath: 'src/online/protocol/unreviewed.ts',
        kind: 'import',
        rule: 'core-no-product-runtime-import',
        specifier: '../../engine/core/index',
      },
    ]);
  });

  it('normalizes Windows and POSIX separators and returns every violation in fixed order', () => {
    expect(normalizePath('src\\engine\\core\\ids.ts')).toBe('src/engine/core/ids.ts');
    const units: SourceUnit[] = [
      {
        filePath: resolve(repositoryRoot, 'src/components/z.tsx'),
        sourceText: "import '../engine/core';",
      },
      {
        filePath: resolve(repositoryRoot, 'src/App.tsx'),
        sourceText: "import './engine/core';",
      },
    ];
    const violations = analyzeBoundarySources(units);
    expect(violations).toHaveLength(2);
    expect(violations.map(({ filePath }) => filePath)).toEqual(['src/App.tsx', 'src/components/z.tsx']);
  });
});
