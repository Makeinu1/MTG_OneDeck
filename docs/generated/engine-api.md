# Generated engine API index

This index is generated from TypeScript export declarations. Semantic meaning is defined by the domain contracts in `docs/contracts/engine/`.

## `src/engine/__tests__/helpers.ts`

- line 4: `export function makeDef(overrides: Partial<CardDef> & { scryfallId: string }): CardDef {`
- line 24: `export function makeDeck(`

## `src/engine/autotap.ts`

- line 16: `export interface AutoTapPlan {`
- line 24: `export interface AutoTapActivation {`
- line 636: `export function planAutoTap(`
- line 646: `export function planAutoManaPayment(`
- line 656: `export function autoTapCommands(`

## `src/engine/batch.ts`

- line 4: `export interface CommandBatch {`
- line 9: `export function applyCommands(`
- line 25: `export function applyCommandBatch(state: GameState, batch: CommandBatch): ApplyResult {`

## `src/engine/cardTypes.ts`

- line 17: `export function distinctCardTypesInGraveyard(`

## `src/engine/caseGrammar.ts`

- line 10: `export interface CaseSections {`
- line 25: `export function isSolvedGatedLine(line: string): boolean {`
- line 34: `export function stripSolvedGatePrefix(line: string): string | null {`
- line 49: `export function parseCaseSections(oracleText: string | undefined | null): CaseSections {`

## `src/engine/classGrammar.ts`

- line 35: `export interface ClassLevelBar {`
- line 54: `export function parseClassLevelBars(oracleText: string | undefined | null): ClassLevelBar[] {`
- line 139: `export function classLevelBarKeywords(bars: ClassLevelBar[], level: number): string[] {`
- line 174: `export function classLevelActivationLegal(state: GameState, cardId: string, barLevel: number): boolean {`

## `src/engine/commander.ts`

- line 6: `export function isCommander(state: GameState, cardId: string): boolean {`
- line 13: `export function commanderTax(state: GameState, cardId: string): number {`

## `src/engine/commands.ts`

- line 94: `export type GameCommand =`
- line 336: `export interface ApplyResult {`
- line 811: `export function objectSnapshotForCard(state: GameState, cardId: string): ObjectSnapshot | null {`
- line 3019: `export function performStateBasedActions(state: GameState): ApplyResult {`
- line 4877: `export function activationTargetPromptsForSource(`
- line 4917: `export function expandPlayerRecipientPrompt(`
- line 4960: `export function guidedPlanForStackTop(`
- line 5043: `export function activationPlanForSource(`
- line 5279: `export function activatedManaAbilityPlanForSource(`
- line 5572: `export function eligibleTargets(`
- line 6826: `export function returnLinkedExileToBattlefield(state: GameState, linkId: string): ApplyResult {`
- line 6833: `export function consumeLinkedExileForSource(`
- line 7296: `export function applyCommand(state: GameState, cmd: GameCommand): ApplyResult {`
- line 7301: `export function applyResolutionCommands(state: GameState, commands: readonly GameCommand[]): ApplyResult {`

## `src/engine/compatibility/soloCoreCompatibilityV1.ts`

- line 17: `export const SOLO_CORE_COMPATIBILITY_SCHEMA_VERSION_V1 = 1 as const;`
- line 19: `export type SoloCoreCompatibilityClassV1 =`
- line 26: `export type SoloCoreCompatibilityConcernV1 =`
- line 48: `export type SoloCoreCompatibilityCatalogEntryV1 = Readonly<{`
- line 77: `export const SOLO_CORE_COMPATIBILITY_CATALOG_V1: readonly SoloCoreCompatibilityCatalogEntryV1[] = Object.freeze(`
- line 81: `export function soloCoreCompatibilityEntryForV1(`
- line 277: `export type SoloCorePlayerMapEntryV1 = Readonly<{`
- line 282: `export type SoloCorePhysicalCardMapEntryV1 = Readonly<{`
- line 287: `export type SoloCoreObjectMapEntryV1 = Readonly<{`
- line 292: `export type SoloCoreIdentityMapV1 = Readonly<{`
- line 404: `export function validateSoloCoreIdentityMapV1(input: unknown):`
- line 411: `export function createSoloCoreIdentityMapV1(`
- line 426: `export type SoloCoreComparableTurnPositionV1 = CoreTurnPositionV1;`
- line 428: `export type SoloCoreComparableZoneV1 = Readonly<{`
- line 434: `export type SoloCoreComparableCommanderV1 = Readonly<{`
- line 440: `export type SoloCoreComparableCombatV1 = Readonly<{`
- line 458: `export type SoloCoreComparableViewV1 = Readonly<{`
- line 1060: `export function projectSoloCompatibilityViewV1(state: unknown, identityMap: unknown): ProjectionResult {`
- line 1070: `export function projectCoreCompatibilityViewV1(root: unknown, identityMap: unknown): ProjectionResult {`
- line 1082: `export type { CompatibilityIssue as SoloCoreCompatibilityIssueV1 };`

## `src/engine/compatibility/soloCoreParityV1.ts`

- line 6: `export type SoloCoreParityIssueV1 = Readonly<{`
- line 24: `export type SoloCoreParityResultV1 = CompatibilityResult;`
- line 339: `export function compareSoloCoreCompatibilityV1(`

## `src/engine/core/__tests__/testHelpers.ts`

- line 14: `export function isRecord(value: unknown): value is Record<string, unknown> {`
- line 20: `export function fixtureUnknown(): unknown {`
- line 24: `export function fixtureRecord(): Record<string, unknown> {`
- line 30: `export function cloneFixture(): Record<string, unknown> {`
- line 36: `export function issueCodes(result: CoreIdentityZoneValidationResult): readonly string[] {`
- line 40: `export function hasIssue(result: CoreIdentityZoneValidationResult, code: string): boolean {`

## `src/engine/core/cardDefinition.ts`

- line 7: `export type CoreManaColorV1 = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';`
- line 8: `export type CoreColorIdentityV1 = Exclude<CoreManaColorV1, 'C'>;`
- line 10: `export type CoreTokenKindV1 =`
- line 23: `export type CoreCardDefinitionSourceV1 =`
- line 33: `export interface CoreCardFaceSnapshotV1 {`
- line 44: `export interface CoreCardDefinitionSnapshotV1 {`
- line 57: `export interface CorePhysicalCardV1 {`
- line 63: `export type CoreCardDefinitionRecordV1 = Readonly<`
- line 67: `export type CorePhysicalCardRecordV1 = Readonly<`

## `src/engine/core/closure/applyCommandV1.ts`

- line 250: `export function applyCoreCommandV1(root: ModeNeutralCoreRootV1, command: CoreCommandV1): CoreCommandResultV1 {`

## `src/engine/core/closure/canonicalV1.ts`

- line 1: `export type CoreCanonicalIssueV1 = Readonly<{`
- line 7: `export class CoreCanonicalizationErrorV1 extends Error {`
- line 145: `export function canonicalizeCoreValueV1(value: unknown): unknown {`
- line 177: `export function serializeCoreCanonicalValueV1(value: unknown): string {`
- line 232: `export function coreSha256HexV1(value: string): string {`
- line 237: `export function coreCanonicalDigestFromValueV1(value: unknown): string {`
- line 241: `export function canonicalizeModeNeutralCoreRootV1(value: import('./rootV1').ModeNeutralCoreRootV1): import('./rootV1').ModeNeutralCoreRootV1 {`
- line 245: `export function serializeModeNeutralCoreRootV1(value: import('./rootV1').ModeNeutralCoreRootV1): string {`
- line 249: `export function serializeCoreDomainEventsV1(value: readonly import('./domainEventV1').CoreDomainEventV1[]): string {`
- line 253: `export function coreCanonicalDigestV1(value: unknown): string {`

## `src/engine/core/closure/commandResultV1.ts`

- line 4: `export type CoreCommandIssueV1 = Readonly<{ readonly code: string; readonly path: string; readonly message: string }>;`
- line 5: `export type CoreCommandWarningV1 = Readonly<{ readonly code: 'MANUAL_CORRECTION_APPLIED'; readonly path: string; readonly message: string }>;`
- line 6: `export type CoreCommandResultV1 =`
- line 11: `export function freezeCoreCommandIssuesV1(issues: readonly CoreCommandIssueV1[]): readonly CoreCommandIssueV1[] {`

## `src/engine/core/closure/commandV1.ts`

- line 19: `export type CoreStackCommitCardSpellPayloadV1 = Readonly<{ readonly kind: 'stack-commit-card-spell'; readonly input: CoreCardSpellCommitInputV1 }>;`
- line 20: `export type CoreStackRemoveObjectPayloadV1 = Readonly<{ readonly kind: 'stack-remove-object'; readonly input: CoreStackRemovalInputV1 }>;`
- line 21: `export type CorePriorityPassPayloadV1 = Readonly<{ readonly kind: 'priority-pass'; readonly playerId: CorePlayerId }>;`
- line 22: `export type CoreSearchOpenPayloadV1 = Readonly<{ readonly kind: 'search-open'; readonly sessionKey: CoreRuleKeyV1; readonly input: CoreSearchSessionInputV1 }>;`
- line 23: `export type CoreSearchCompletePayloadV1 = Readonly<{ readonly kind: 'search-complete'; readonly sessionKey: CoreRuleKeyV1; readonly selectedObjectIds: readonly CoreObjectId[] }>;`
- line 24: `export type CoreControlEffectApplyPayloadV1 = Readonly<{ readonly kind: 'control-effect-apply'; readonly effectKey: CoreRuleKeyV1; readonly effect: CoreControlEffectV1 }>;`
- line 25: `export type CoreCommanderCastRecordPayloadV1 = Readonly<{ readonly kind: 'commander-cast-record'; readonly physicalCardId: CorePhysicalCardId; readonly origin: CoreCommanderCastOriginV1; readonly accepted: boolean }>;`
- line 26: `export type CoreCommanderDamageRecordPayloadV1 = Readonly<{ readonly kind: 'commander-damage-record'; readonly physicalCardId: CorePhysicalCardId; readonly defendingPlayerId: CorePlayerId; readonly damage: number; readonly combatObjectId: CoreObjectId }>;`
- line 27: `export type CoreCombatStepSetPayloadV1 = Readonly<{ readonly kind: 'combat-step-set'; readonly step: CoreCombatContextStepV1 }>;`
- line 28: `export type CoreCombatAttackAddPayloadV1 = Readonly<{ readonly kind: 'combat-attack-add'; readonly attack: CoreCombatContextAttackV1 }>;`
- line 29: `export type CoreCombatBlockAddPayloadV1 = Readonly<{ readonly kind: 'combat-block-add'; readonly block: CoreCombatContextBlockV1 }>;`
- line 30: `export type CorePlayerExitPayloadV1 = Readonly<{ readonly kind: 'player-exit'; readonly playerId: CorePlayerId; readonly cause: 'concession' | 'defeat' }>;`
- line 31: `export type CoreRandomZoneOrderPayloadV1 = Readonly<{ readonly kind: 'random-zone-order'; readonly randomDecisionId: CoreRuleKeyV1; readonly zone: CoreRuleZoneRefV1; readonly beforeOrder: readonly CoreObjectId[]; readonly afterOrder: readonly CoreObjectId[] }>;`
- line 32: `export type CoreCorrectPlayerLifePayloadV1 = Readonly<{ readonly kind: 'correct-player-life'; readonly playerId: CorePlayerId; readonly replacementLifeTotal: number; readonly expectedBeforeStateDigest: string; readonly reason: string }>;`
- line 33: `export type CoreCorrectCommanderDamagePayloadV1 = Readonly<{ readonly kind: 'correct-commander-damage'; readonly physicalCardId: CorePhysicalCardId; readonly defendingPlayerId: CorePlayerId; readonly replacementDamageTotal: number; readonly expectedBeforeStateDigest: string; readonly reason: string }>;`
- line 35: `export type CoreCommandPayloadV1 =`
- line 43: `export type { CoreTabletopCommandPayloadV1 } from '../tabletop/commandV1';`
- line 45: `export type CoreCommandV1 = Readonly<{`
- line 55: `export type CoreCommandValidationIssueV1 = Readonly<{ readonly code: string; readonly path: string; readonly message: string }>;`
- line 56: `export type CoreCommandValidationResultV1 =`
- line 322: `export function validateCoreCommandV1(input: unknown): CoreCommandValidationResultV1 {`
- line 392: `export class CoreCommandCreationErrorV1 extends Error {`
- line 396: `export function createCoreCommandV1(input: Omit<CoreCommandV1, 'kind'>): CoreCommandV1 {`

## `src/engine/core/closure/correctionV1.ts`

- line 1: `export const CORE_MANUAL_CORRECTION_WARNING_CODE_V1 = 'MANUAL_CORRECTION_APPLIED' as const;`
- line 3: `export type CoreCorrectionReasonV1 = string;`
- line 4: `export type CoreCorrectionValidationIssueV1 = Readonly<{ readonly code: string; readonly path: string; readonly message: string }>;`
- line 6: `export function validateCoreCorrectionReasonV1(reason: unknown): readonly CoreCorrectionValidationIssueV1[] {`
- line 12: `export function createCoreCorrectionWarningV1(reason: CoreCorrectionReasonV1): Readonly<{ readonly code: typeof CORE_MANUAL_CORRECTION_WARNING_CODE_V1; readonly path: '/reason'; readonly message: string }> {`

## `src/engine/core/closure/domainEventV1.ts`

- line 4: `export type CoreDomainEventPayloadV1 =`
- line 24: `export type CoreDomainEventV1 = Readonly<{`
- line 34: `export function createCoreDomainEventV1(command: CoreCommandV1, eventIndex: number, payload: CoreDomainEventPayloadV1): CoreDomainEventV1 {`

## `src/engine/core/closure/headlessClosureV1.ts`

- line 8: `export type CoreHeadlessClosureReportV1 = Readonly<{`
- line 20: `export function runOrdinaryFourPlayerCoreClosureV1(initialRoot: ModeNeutralCoreRootV1, commands: readonly CoreCommandV1[] = []): CoreHeadlessClosureReportV1 {`
- line 29: `export const executeOrdinaryFourPlayerCoreClosureV1 = runOrdinaryFourPlayerCoreClosureV1;`

## `src/engine/core/closure/journalV1.ts`

- line 12: `export type CoreCommandJournalEntryV1 = Readonly<{`
- line 22: `export type CoreReplayPackageV1 = Readonly<{`
- line 31: `export type CoreJournalValidationIssueV1 = Readonly<{ readonly code: string; readonly path: string; readonly message: string }>;`
- line 32: `export type CoreJournalValidationResultV1 =`
- line 35: `export type CoreReplayPackageValidationResultV1 =`
- line 83: `export function appendCoreCommandJournalEntryV1(journal: readonly CoreCommandJournalEntryV1[], command: CoreCommandV1, result: CoreCommandResultV1): readonly CoreCommandJournalEntryV1[] {`
- line 90: `export function validateCoreCommandJournalEntryV1(value: unknown): CoreJournalValidationResultV1 {`
- line 103: `export function createCoreReplayPackageV1(initialRoot: ModeNeutralCoreRootV1, journal: readonly CoreCommandJournalEntryV1[]): CoreReplayPackageV1 {`
- line 119: `export function validateCoreReplayPackageV1(value: unknown): CoreReplayPackageValidationResultV1 {`

## `src/engine/core/closure/randomZoneOrderV1.ts`

- line 4: `export type CoreRandomZoneOrderInputV1 = Readonly<{`
- line 10: `export type CoreRandomZoneOrderIssueV1 = Readonly<{ readonly code: string; readonly path: string; readonly message: string }>;`
- line 68: `export function validateCoreRandomZoneOrderV1(input: CoreRandomZoneOrderInputV1, currentOrder: readonly CoreObjectId[]): readonly CoreRandomZoneOrderIssueV1[] {`
- line 72: `export function applyCoreRecordedZoneOrderV1(currentOrder: readonly CoreObjectId[], input: CoreRandomZoneOrderInputV1): readonly CoreObjectId[] {`

## `src/engine/core/closure/replayV1.ts`

- line 8: `export type CoreReplayDivergenceV1 = Readonly<{ readonly code: 'INVALID_PACKAGE' | 'COMMAND_DIGEST_MISMATCH' | 'STATUS_MISMATCH' | 'BEFORE_DIGEST_MISMATCH' | 'AFTER_DIGEST_MISMATCH' | 'EVENT_DIGEST_MISMATCH' | 'FINAL_STATE_DIGEST_MISMATCH' | 'FINAL_EVENT_DIGEST_MISMATCH'; readonly journalIndex: number; readonly expected: string; readonly actual: string }>;`
- line 9: `export type CoreReplayResultV1 =`
- line 16: `export function replayCoreCommandsV1(packageInput: CoreReplayPackageV1): CoreReplayResultV1 {`
- line 39: `export function replayCoreCommandsFromRootV1(initialRoot: ModeNeutralCoreRootV1, journal: readonly CoreCommandJournalEntryV1[]): CoreReplayResultV1 {`

## `src/engine/core/closure/rootV1.ts`

- line 10: `export type ModeNeutralCoreRootV1 = Readonly<{`
- line 24: `export type { CoreRootValidationIssueV1, CoreRootValidationResultV1 } from './rootValidationV1';`

## `src/engine/core/closure/rootValidationV1.ts`

- line 21: `export type CoreRootValidationIssueV1 = Readonly<{`
- line 26: `export type CoreRootValidationResultV1 =`
- line 115: `export function validateModeNeutralCoreRootV1(input: unknown): CoreRootValidationResultV1 {`
- line 187: `export class CoreRootCreationErrorV1 extends Error {`
- line 192: `export function createModeNeutralCoreRootV1(input: Omit<ModeNeutralCoreRootV1, 'kind'>): ModeNeutralCoreRootV1 {`

## `src/engine/core/closure/versionsV1.ts`

- line 1: `export type CoreClosureVersionVectorV1 = Readonly<{`
- line 8: `export const CORE_CLOSURE_VERSION_VECTOR_V1: CoreClosureVersionVectorV1 = Object.freeze({`
- line 15: `export function isCoreClosureVersionVectorV1(value: unknown): value is CoreClosureVersionVectorV1 {`
- line 36: `export function createCoreClosureVersionVectorV1(value: unknown = CORE_CLOSURE_VERSION_VECTOR_V1): CoreClosureVersionVectorV1 {`

## `src/engine/core/combat/combatContextV1.ts`

- line 5: `export type CoreCombatContextStepV1 = 'declare-attackers' | 'declare-blockers';`
- line 7: `export type CoreCombatContextAttackV1 = Readonly<{`
- line 13: `export type CoreCombatContextBlockV1 = Readonly<{`
- line 20: `export type CoreCombatContextV1 = Readonly<{`
- line 30: `export type CoreCombatContextValidationCodeV1 =`
- line 52: `export type CoreCombatContextValidationIssueV1 = Readonly<{`
- line 68: `export class CoreCombatContextCreationErrorV1 extends CoreCombatContextErrorV1 {`
- line 76: `export class CoreCombatContextAdditionErrorV1 extends CoreCombatContextErrorV1 {`
- line 84: `export class CoreCombatContextStepErrorV1 extends CoreCombatContextErrorV1 {`
- line 92: `export class CoreCombatContextReconciliationErrorV1 extends CoreCombatContextErrorV1 {`
- line 468: `export function createCoreCombatContextV1(value: unknown): CoreCombatContextV1 {`
- line 495: `export function addCoreCombatContextAttackV1(`
- line 544: `export function addCoreCombatContextBlockV1(`
- line 619: `export function setCoreCombatContextStepV1(`
- line 642: `export function reconcileCoreCombatContextForPlayerExitV1(`

## `src/engine/core/commander/commanderDamageProvenanceV1.ts`

- line 7: `export type CoreCommanderDamageProvenanceRecordV1 = Readonly<{`
- line 14: `export type CoreCommanderDamageProvenanceLedgerV1 = Readonly<{`
- line 20: `export type CoreCommanderProvenanceValidationCodeV1 =`
- line 27: `export type CoreCommanderProvenanceValidationIssueV1 = Readonly<{`
- line 43: `export class CoreCommanderProvenanceCreationErrorV1 extends CoreCommanderProvenanceErrorV1 {`
- line 51: `export class CoreCommanderProvenanceRecordingErrorV1 extends CoreCommanderProvenanceErrorV1 {`
- line 59: `export class CoreCommanderProvenanceQueryErrorV1 extends CoreCommanderProvenanceErrorV1 {`
- line 211: `export function createCoreCommanderDamageProvenanceLedgerV1(value: unknown): CoreCommanderDamageProvenanceLedgerV1 {`
- line 279: `export function recordCoreCommanderDamageProvenanceV1(state: CoreCommanderDamageProvenanceLedgerV1, input: unknown): CoreCommanderDamageProvenanceLedgerV1 {`
- line 328: `export function coreCommanderProvenanceDamageAgainstV1(state: CoreCommanderDamageProvenanceLedgerV1, commanderPhysicalCardId: unknown, defendingPlayerId: unknown): number {`
- line 333: `export function coreCommanderThresholdReachedFromProvenanceV1(state: CoreCommanderDamageProvenanceLedgerV1, commanderPhysicalCardId: unknown, defendingPlayerId: unknown): boolean {`

## `src/engine/core/commander/commanderDamageV1.ts`

- line 8: `export type CoreCommanderDamageEntryV1 = Readonly<{`
- line 14: `export type CoreCommanderDamageStateV1 = Readonly<{`
- line 20: `export type CoreCommanderDamageValidationCodeV1 =`
- line 33: `export type CoreCommanderDamageValidationIssueV1 = Readonly<{`
- line 49: `export class CoreCommanderDamageCreationErrorV1 extends CoreCommanderDamageErrorV1 {`
- line 57: `export class CoreCommanderDamageRecordingErrorV1 extends CoreCommanderDamageErrorV1 {`
- line 214: `export function createCoreCommanderDamageStateV1(value: unknown): CoreCommanderDamageStateV1 {`
- line 293: `export function recordCoreCommanderDamageV1(`
- line 337: `export function coreCommanderDamageAgainstV1(`

## `src/engine/core/commander/commanderIdentityV1.ts`

- line 4: `export type CoreCommanderIdentityV1 = Readonly<{`
- line 9: `export type CoreCommanderIdentityValidationCodeV1 =`
- line 17: `export type CoreCommanderIdentityValidationIssueV1 = Readonly<{`
- line 23: `export class CoreCommanderIdentityCreationErrorV1 extends Error {`
- line 81: `export function createCoreCommanderIdentityV1(value: unknown): CoreCommanderIdentityV1 {`

## `src/engine/core/commander/commanderReplacementV1.ts`

- line 1: `export type CoreCommanderReplacementKindV1 = 'commander-replacement-903.9a' | 'commander-replacement-903.9b';`
- line 3: `export type CoreCommanderReplacementSourceZoneV1 = 'graveyard' | 'exile' | 'hand' | 'library';`
- line 5: `export type CoreCommanderReplacementChoiceV1 = Readonly<{`
- line 10: `export type CoreCommanderReplacementValidationCodeV1 =`
- line 18: `export type CoreCommanderReplacementValidationIssueV1 = Readonly<{`
- line 24: `export class CoreCommanderReplacementChoiceCreationErrorV1 extends Error {`
- line 88: `export function createCoreCommanderReplacementChoiceV1(`

## `src/engine/core/commander/commanderTaxV1.ts`

- line 7: `export type CoreCommanderCastOriginV1 = 'command-zone' | 'other-zone' | 'copy';`
- line 9: `export type CoreCommanderCastAttemptV1 = Readonly<{`
- line 13: `export type CoreCommanderCastLedgerV1 = Readonly<{`
- line 18: `export type CoreCommanderCastLedgerValidationIssueV1 = Readonly<{`
- line 125: `export class CoreCommanderCastLedgerCreationErrorV1 extends Error {`
- line 136: `export class CoreCommanderCastRecordingErrorV1 extends Error {`
- line 199: `export function createCoreCommanderCastLedgerV1(value: unknown): CoreCommanderCastLedgerV1 {`
- line 224: `export function recordCoreCommanderCastV1(`
- line 246: `export function coreCommanderTaxV1(ledger: CoreCommanderCastLedgerV1): number {`

## `src/engine/core/identityZoneCanonicalization.ts`

- line 187: `export function canonicalizeModeNeutralCoreIdentityZoneSliceV1(`

## `src/engine/core/identityZoneState.ts`

- line 19: `export interface CoreManaPoolV1 {`
- line 28: `export interface CorePlayerStateV1 {`
- line 41: `export interface CoreCardObjectIdentityV1 {`
- line 48: `export type CorePlayerScopedZoneIdV1 = 'library' | 'hand' | 'graveyard';`
- line 49: `export type CoreSharedZoneIdV1 = 'battlefield' | 'stack' | 'exile' | 'command';`
- line 50: `export type CoreZoneIdV1 = CorePlayerScopedZoneIdV1 | CoreSharedZoneIdV1;`
- line 52: `export interface CorePlayerZonesV1 {`
- line 58: `export interface CoreSharedZonesV1 {`
- line 65: `export interface CoreZonesV1 {`
- line 70: `export type CoreZoneScopeV1 = 'player-scoped' | 'shared';`
- line 71: `export type CoreZoneInformationClassV1 = 'hidden-zone' | 'public-zone';`
- line 73: `export interface ModeNeutralCoreIdentityZoneSliceV1 {`
- line 84: `export interface CreateModeNeutralCoreIdentityZoneSliceV1Input {`
- line 94: `export interface CorePlayerScopedLocationV1 {`
- line 101: `export interface CoreSharedLocationV1 {`
- line 107: `export type CoreObjectLocationV1 = CorePlayerScopedLocationV1 | CoreSharedLocationV1;`
- line 121: `export function coreZoneScopeOf(zoneId: CoreZoneIdV1): CoreZoneScopeV1 {`
- line 127: `export function coreZoneInformationClassOf(`
- line 133: `export function locateCoreObjectV1(`
- line 181: `export function createModeNeutralCoreIdentityZoneSliceV1(`
- line 194: `export type {`

## `src/engine/core/identityZoneValidation.ts`

- line 24: `export type CoreIdentityZoneValidationCode =`
- line 52: `export interface CoreIdentityZoneValidationIssue {`
- line 58: `export type CoreIdentityZoneValidationResult =`
- line 68: `export class CoreIdentityZoneCreationError extends Error {`
- line 681: `export function deepFreezeCoreValue<T>(value: T): T {`
- line 823: `export function validateModeNeutralCoreIdentityZoneSliceV1(value: unknown): CoreIdentityZoneValidationResult {`
- line 842: `export type {`

## `src/engine/core/ids.ts`

- line 6: `export type CorePlayerId = string & { readonly [corePlayerIdBrand]: true };`
- line 7: `export type CoreCardDefinitionId = string & { readonly [coreCardDefinitionIdBrand]: true };`
- line 8: `export type CorePhysicalCardId = string & { readonly [corePhysicalCardIdBrand]: true };`
- line 9: `export type CoreObjectId = string & { readonly [coreObjectIdBrand]: true };`
- line 11: `export const CORE_BASE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;`
- line 12: `export const CORE_UNSAFE_RECORD_KEYS = new Set(['__proto__', 'prototype', 'constructor']);`
- line 14: `export function isCoreBaseId(value: unknown): value is string {`
- line 17: `export function isCoreUnsafeRecordKey(value: string): boolean {`
- line 21: `export function isCoreSafeIncarnation(value: unknown): value is number {`
- line 25: `export function coreCardObjectIdOf(`

## `src/engine/core/index.ts`

- line 2: `export type { CoreCardDefinitionId, CoreObjectId, CorePhysicalCardId, CorePlayerId } from './ids';`
- line 4: `export type {`
- line 22: `export type {`
- line 45: `export type {`
- line 103: `export type {`
- line 126: `export type {`
- line 154: `export type {`
- line 182: `export type {`
- line 194: `export type {`
- line 207: `export type {`
- line 221: `export type {`
- line 237: `export type {`
- line 255: `export type {`
- line 271: `export type {`
- line 289: `export type {`

## `src/engine/core/object/index.ts`

- line 9: `export type {`
- line 25: `export type {`
- line 54: `export type {`
- line 108: `export type {`
- line 127: `export type {`

## `src/engine/core/object/objectIdV2.ts`

- line 4: `export type CoreObjectIdKindV2 =`
- line 11: `export type ParsedCoreObjectIdV2 =`
- line 102: `export function parseCoreObjectIdV2(value: unknown): ParsedCoreObjectIdV2 | null {`
- line 115: `export function isCanonicalCoreObjectIdV2(value: unknown): value is CoreObjectId {`
- line 129: `export function coreTokenObjectIdOfV2(seed: string, incarnation: number): CoreObjectId {`
- line 135: `export function coreSpellCopyObjectIdOfV2(seed: string): CoreObjectId {`
- line 140: `export function coreActivatedAbilityObjectIdOfV2(seed: string): CoreObjectId {`
- line 145: `export function coreTriggeredAbilityObjectIdOfV2(seed: string): CoreObjectId {`

## `src/engine/core/object/objectRegistryCanonicalizationV2.ts`

- line 129: `export function descriptorSnapshot(`
- line 380: `export function canonicalizeModeNeutralCoreObjectRegistryStateV2(`
- line 399: `export function canonicalizeModeNeutralCoreObjectRegistryStateV2AfterValidation(`
- line 405: `export const canonicalizeModeNeutralCoreObjectRegistrySliceV2 =`
- line 407: `export const canonicalizeCoreObjectRegistryStateV2 =`
- line 458: `export function canonicalizeModeNeutralCoreObjectRuntimeStateV2(`
- line 476: `export const canonicalizeModeNeutralCoreObjectRuntimeSliceV2 =`
- line 478: `export const canonicalizeCoreObjectRuntimeStateV2 =`
- line 481: `export class CoreObjectRegistryAdapterErrorV2 extends TypeError {`
- line 513: `export function upgradeModeNeutralCoreIdentityZoneSliceV1ToObjectRegistryV2(`
- line 549: `export const upgradeModeNeutralCoreIdentityZoneSliceV1ToObjectRegistryStateV2 =`
- line 552: `export function upgradeModeNeutralCoreCardRuntimeSliceV1ToObjectRuntimeV2(`
- line 581: `export const upgradeModeNeutralCoreCardRuntimeSliceV1ToObjectRuntimeStateV2 =`

## `src/engine/core/object/objectRegistryStateV2.ts`

- line 35: `export type {`
- line 41: `export type {`
- line 51: `export interface ModeNeutralCoreObjectRegistryStateV2 {`
- line 62: `export type CoreObjectRegistryStateV2 = ModeNeutralCoreObjectRegistryStateV2;`
- line 63: `export type ModeNeutralCoreObjectRegistrySliceV2 = ModeNeutralCoreObjectRegistryStateV2;`
- line 65: `export interface CreateModeNeutralCoreObjectRegistryStateV2Input {`
- line 75: `export type CreateCoreObjectRegistryStateV2Input =`
- line 77: `export type CreateModeNeutralCoreObjectRegistrySliceV2Input =`
- line 80: `export interface ModeNeutralCoreObjectRuntimeStateV2 {`
- line 87: `export type CoreObjectRuntimeStateV2 = ModeNeutralCoreObjectRuntimeStateV2;`
- line 88: `export type ModeNeutralCoreObjectRuntimeSliceV2 = ModeNeutralCoreObjectRuntimeStateV2;`
- line 90: `export interface CreateModeNeutralCoreObjectRuntimeStateV2Input {`
- line 96: `export type CreateCoreObjectRuntimeStateV2Input =`
- line 98: `export type CreateModeNeutralCoreObjectRuntimeSliceV2Input =`
- line 176: `export function createModeNeutralCoreObjectRegistryStateV2(`
- line 193: `export const createCoreObjectRegistryStateV2 =`
- line 195: `export const createModeNeutralCoreObjectRegistrySliceV2 =`
- line 198: `export function createModeNeutralCoreObjectRuntimeStateV2(`
- line 217: `export const createCoreObjectRuntimeStateV2 =`
- line 219: `export const createModeNeutralCoreObjectRuntimeSliceV2 =`
- line 222: `export type {`

## `src/engine/core/object/objectRegistryValidationV2.ts`

- line 61: `export type CoreObjectRegistryValidationCode = string;`
- line 63: `export interface CoreObjectRegistryValidationIssue {`
- line 69: `export type CoreObjectRegistryValidationResult =`
- line 79: `export type CoreObjectRegistryValidationIssueV2 = CoreObjectRegistryValidationIssue;`
- line 80: `export type CoreObjectRegistryValidationResultV2 = CoreObjectRegistryValidationResult;`
- line 82: `export class CoreObjectRegistryCreationErrorV2 extends Error {`
- line 92: `export type CoreObjectRuntimeValidationCode = string;`
- line 94: `export interface CoreObjectRuntimeValidationIssue {`
- line 100: `export type CoreObjectRuntimeValidationResult =`
- line 110: `export type CoreObjectRuntimeValidationIssueV2 = CoreObjectRuntimeValidationIssue;`
- line 111: `export type CoreObjectRuntimeValidationResultV2 = CoreObjectRuntimeValidationResult;`
- line 113: `export class CoreObjectRuntimeCreationErrorV2 extends Error {`
- line 987: `export function validateModeNeutralCoreObjectRegistryStateV2(`
- line 993: `export function validateModeNeutralCoreObjectRegistryForCanonicalization(`
- line 999: `export const validateModeNeutralCoreObjectRegistrySliceV2 =`
- line 1001: `export const validateCoreObjectRegistryStateV2 =`
- line 1003: `export const validateCoreObjectRegistryV2 =`
- line 1018: `export function validateModeNeutralCoreObjectRuntimeStateV2(`
- line 1079: `export const validateModeNeutralCoreObjectRuntimeSliceV2 =`
- line 1081: `export const validateCoreObjectRuntimeStateV2 =`
- line 1083: `export const validateCoreObjectRuntimeV2 =`
- line 1095: `export type {`

## `src/engine/core/object/objectRuntimeV2.ts`

- line 9: `export type {`
- line 41: `export type {`

## `src/engine/core/object/stackObjectV2.ts`

- line 13: `export type { CoreObjectIdKindV2, ParsedCoreObjectIdV2 } from './objectIdV2';`
- line 15: `export interface CoreSpellCopyObjectIdentityV2 {`
- line 22: `export interface CoreActivatedAbilityObjectIdentityV2 {`
- line 29: `export interface CoreTriggeredAbilityObjectIdentityV2 {`
- line 36: `export type CoreStackObjectIdentityV2 =`
- line 41: `export type CoreStackObjectKindV2 = CoreStackObjectIdentityV2['kind'];`
- line 43: `export type CoreStackObjectValidationCode =`
- line 52: `export interface CoreStackObjectValidationIssue {`
- line 58: `export type CoreStackObjectValidationResult =`
- line 68: `export type CoreSpellCopyObjectValidationCode = CoreStackObjectValidationCode;`
- line 69: `export type CoreActivatedAbilityObjectValidationCode = CoreStackObjectValidationCode;`
- line 70: `export type CoreTriggeredAbilityObjectValidationCode = CoreStackObjectValidationCode;`
- line 72: `export type CoreSpellCopyObjectValidationIssue = CoreStackObjectValidationIssue;`
- line 73: `export type CoreActivatedAbilityObjectValidationIssue = CoreStackObjectValidationIssue;`
- line 74: `export type CoreTriggeredAbilityObjectValidationIssue = CoreStackObjectValidationIssue;`
- line 76: `export type CoreSpellCopyObjectValidationResult =`
- line 80: `export type CoreActivatedAbilityObjectValidationResult =`
- line 84: `export type CoreTriggeredAbilityObjectValidationResult =`
- line 88: `export class CoreStackObjectCreationError extends Error {`
- line 98: `export class CoreSpellCopyObjectCreationError extends CoreStackObjectCreationError {`
- line 105: `export class CoreActivatedAbilityObjectCreationError extends CoreStackObjectCreationError {`
- line 112: `export class CoreTriggeredAbilityObjectCreationError extends CoreStackObjectCreationError {`
- line 393: `export function validateCoreSpellCopyObjectIdentityV2(`
- line 399: `export function validateCoreActivatedAbilityObjectIdentityV2(`
- line 405: `export function validateCoreTriggeredAbilityObjectIdentityV2(`
- line 411: `export function validateCoreStackObjectIdentityV2(`
- line 447: `export function createCoreSpellCopyObjectIdentityV2(`
- line 456: `export function createCoreActivatedAbilityObjectIdentityV2(`
- line 465: `export function createCoreTriggeredAbilityObjectIdentityV2(`
- line 474: `export function createCoreStackObjectIdentityV2(input: unknown): CoreStackObjectIdentityV2 {`
- line 535: `export function isCanonicalCoreAbilityKeyV2(value: unknown): value is string {`
- line 539: `export const validateCoreSpellCopyIdentityV2 = validateCoreSpellCopyObjectIdentityV2;`
- line 540: `export const validateCoreActivatedAbilityIdentityV2 = validateCoreActivatedAbilityObjectIdentityV2;`
- line 541: `export const validateCoreTriggeredAbilityIdentityV2 = validateCoreTriggeredAbilityObjectIdentityV2;`
- line 542: `export const createCoreSpellCopyIdentityV2 = createCoreSpellCopyObjectIdentityV2;`
- line 543: `export const createCoreActivatedAbilityIdentityV2 = createCoreActivatedAbilityObjectIdentityV2;`
- line 544: `export const createCoreTriggeredAbilityIdentityV2 = createCoreTriggeredAbilityObjectIdentityV2;`

## `src/engine/core/object/tokenObjectV2.ts`

- line 30: `export type {`
- line 44: `export type { CoreObjectIdKindV2, ParsedCoreObjectIdV2 } from "./objectIdV2";`
- line 54: `export type CoreTokenOriginV2 =`
- line 64: `export type CoreCardObjectIdentityV2 = Readonly<{`
- line 71: `export type CoreTokenObjectIdentityV2 = Readonly<{`
- line 80: `export type CoreSpellCopyObjectIdentityV2 = Readonly<{`
- line 87: `export type CoreActivatedAbilityObjectIdentityV2 = Readonly<{`
- line 94: `export type CoreTriggeredAbilityObjectIdentityV2 = Readonly<{`
- line 101: `export type CoreGameObjectIdentityV2 =`
- line 108: `export interface CoreValidationIssueV2 {`
- line 114: `export type CoreValidationResultV2<T> =`
- line 360: `export function validateCoreGameObjectIdentityV2(`
- line 525: `export function validateCoreTokenObjectIdentityV2(`
- line 540: `export function isCoreGameObjectIdentityV2(`
- line 565: `export function coreTokenObjectIdentityOfV2(`
- line 568: `export function coreTokenObjectIdentityOfV2(`
- line 575: `export function coreTokenObjectIdentityOfV2(`
- line 585: `export function coreGameObjectIdentityOfV2(`
- line 607: `export function coreCardObjectIdentityOfV2(`
- line 617: `export function coreSpellCopyObjectIdentityOfV2(`
- line 627: `export function coreActivatedAbilityObjectIdentityOfV2(`
- line 637: `export function coreTriggeredAbilityObjectIdentityOfV2(`
- line 647: `export const createCoreTokenObjectIdentityV2 = coreTokenObjectIdentityOfV2;`
- line 648: `export const createCoreGameObjectIdentityV2 = coreGameObjectIdentityOfV2;`
- line 649: `export const createCoreCardObjectIdentityV2 = coreCardObjectIdentityOfV2;`
- line 650: `export const createCoreSpellCopyObjectIdentityV2 = coreSpellCopyObjectIdentityOfV2;`
- line 651: `export const createCoreActivatedAbilityObjectIdentityV2 =`
- line 653: `export const createCoreTriggeredAbilityObjectIdentityV2 =`
- line 656: `export function canonicalizeCoreGameObjectIdentityV2(`

## `src/engine/core/player-lifecycle/playerExitReconciliationV1.ts`

- line 15: `export type CorePlayerExitReferenceIdV1 = string & { readonly [corePlayerExitReferenceIdBrand]: true };`
- line 17: `export type CorePlayerExitReferenceBundleV1 = Readonly<{`
- line 31: `export type CorePlayerExitReconciliationResultV1 = Readonly<{`
- line 45: `export type CorePlayerExitReconciliationIssueCodeV1 =`
- line 56: `export type CorePlayerExitReconciliationIssueV1 = Readonly<{`
- line 62: `export class CorePlayerExitReconciliationErrorV1 extends Error {`
- line 417: `export function createCorePlayerExitReferenceBundleV1(value: unknown): CorePlayerExitReferenceBundleV1 {`
- line 518: `export function reconcileCorePlayerExitV1(`

## `src/engine/core/player-lifecycle/playerLifecycleV1.ts`

- line 3: `export type CorePlayerLifecycleStatusV1 = 'active' | 'exited';`
- line 4: `export type CorePlayerExitCauseV1 = 'concession' | 'defeat';`
- line 6: `export type CorePlayerLifecycleEntryV1 = Readonly<{`
- line 12: `export type CorePlayerLifecycleStateV1 = Readonly<{`
- line 16: `export type CorePlayerExitRequestV1 = Readonly<{`
- line 21: `export type CorePlayerLifecycleIssueCodeV1 =`
- line 35: `export type CorePlayerLifecycleIssueV1 = Readonly<{`
- line 41: `export class CorePlayerLifecycleErrorV1 extends Error {`
- line 332: `export function createCorePlayerLifecycleStateV1(value: unknown): CorePlayerLifecycleStateV1 {`
- line 339: `export function applyCorePlayerExitV1(`
- line 385: `export function corePlayerLifecycleStatusV1(`
- line 392: `export function corePlayerLifecycleExitCauseV1(`

## `src/engine/core/rules/controlEffectV1.ts`

- line 20: `export type CoreControlEffectDurationV1 =`
- line 35: `export type CoreControlEffectV1 = Readonly<{`
- line 42: `export type CoreControlContinuityV1 = Readonly<{`
- line 47: `export type ModeNeutralCoreControlSliceV1 = Readonly<{`
- line 296: `export function validateModeNeutralCoreControlSliceV1(`
- line 302: `export class CoreControlSliceCreationErrorV1 extends Error {`
- line 311: `export function createModeNeutralCoreControlSliceV1(`
- line 403: `export function currentCoreObjectControllerV1(`
- line 423: `export function applyCoreControlEffectV1(`
- line 453: `export function removeCoreControlEffectV1(`
- line 473: `export function replaceCoreControlEffectOrderV1(`
- line 503: `export function markCoreControlledPermanentsAtTurnStartV1(`
- line 521: `export function expireCoreControlEffectsAtTurnBoundaryV1(`
- line 547: `export function coreHasContinuousControlSinceTurnStartV1(`

## `src/engine/core/rules/decisionAuthorityV1.ts`

- line 14: `export type CoreDecisionAuthorityScopeV1 =`
- line 20: `export type CoreDecisionAuthorityV1 = Readonly<{`
- line 26: `export type ModeNeutralCoreDecisionAuthoritySliceV1 = Readonly<{`
- line 31: `export type CoreDecisionContextV1 =`
- line 150: `export function validateModeNeutralCoreDecisionAuthoritySliceV1(`
- line 218: `export class CoreDecisionAuthorityCreationError extends Error {`
- line 226: `export function createModeNeutralCoreDecisionAuthoritySliceV1(`
- line 253: `export function addCoreDecisionAuthorityV1(`
- line 280: `export function removeCoreDecisionAuthorityV1(`
- line 295: `export function coreDecisionMakerForV1(`
- line 319: `export function activateCorePendingDecisionAuthoritiesAtTurnStartV1(`
- line 345: `export function expireCoreDecisionAuthoritiesAfterTurnV1(`

## `src/engine/core/rules/index.ts`

- line 18: `export type {`

## `src/engine/core/rules/playPermissionV1.ts`

- line 16: `export type CorePlayPermissionActionV1 = 'cast-spell' | 'play-land' | 'play-card';`
- line 17: `export type CorePlayPermissionDurationV1 =`
- line 23: `export type CorePlayPermissionSubjectV1 =`
- line 30: `export type CorePlayPermissionV1 = Readonly<{`
- line 37: `export type ModeNeutralCorePlayPermissionSliceV1 = Readonly<{`
- line 218: `export function validateModeNeutralCorePlayPermissionSliceV1(`
- line 308: `export class CorePlayPermissionSliceCreationErrorV1 extends Error {`
- line 316: `export function createModeNeutralCorePlayPermissionSliceV1(`
- line 339: `export function addCorePlayPermissionV1(`
- line 368: `export function removeCorePlayPermissionV1(`
- line 385: `export function consumeCorePlayPermissionV1(`
- line 391: `export function findCorePlayPermissionsV1(`
- line 460: `export function coreCanPlayerAttemptPlayObjectV1(`

## `src/engine/core/rules/ruleAuthorityBundleV1.ts`

- line 7: `export type CoreRuleAuthorityBundleV1 = Readonly<{`
- line 16: `export type CreateCoreRuleAuthorityBundleV1Input = Readonly<{`
- line 25: `export class CoreRuleAuthorityBundleCreationErrorV1 extends Error {`
- line 48: `export function createCoreRuleAuthorityBundleV1(`
- line 72: `export type {`

## `src/engine/core/rules/ruleAuthorityBundleValidationV1.ts`

- line 39: `export type CoreRuleAuthorityBundleValidationCodeV1 = CoreRuleValidationCodeV1;`
- line 40: `export type CoreRuleAuthorityBundleValidationIssueV1 = CoreRuleValidationIssueV1;`
- line 41: `export type CoreRuleAuthorityBundleValidationResultV1 =`
- line 247: `export function validateCoreRuleAuthorityBundleV1(input: unknown): CoreRuleAuthorityBundleValidationResultV1 {`

## `src/engine/core/rules/ruleAuthorityErrorV1.ts`

- line 1: `export type CoreRuleAuthorityOperationErrorCodeV1 =`
- line 19: `export type CoreRuleAuthorityOperationErrorV1 = Readonly<{`
- line 25: `export class CoreRuleAuthorityOperationError extends Error {`

## `src/engine/core/rules/ruleAuthorityLifecycleV1.ts`

- line 24: `export type CoreRuleAuthorityLifecycleResultV1 = Readonly<{`
- line 129: `export function expireCoreRuleAuthorityAtTurnBoundaryV1(`
- line 177: `export function pruneCoreRuleAuthorityForMissingSourcesV1(`
- line 241: `export function activateCoreRuleAuthorityAtTurnStartV1(`

## `src/engine/core/rules/ruleDurationV1.ts`

- line 10: `export type CoreRuleDurationV1 =`
- line 16: `export function validateCoreRuleDurationV1(`
- line 81: `export function createCoreRuleDurationV1(value: unknown): CoreRuleDurationV1 {`
- line 87: `export class CoreRuleDurationCreationError extends Error {`

## `src/engine/core/rules/ruleKeyV1.ts`

- line 9: `export type CoreRuleKeyV1 = string;`
- line 13: `export function validateCoreRuleKeyV1(`
- line 28: `export function createCoreRuleKeyV1(value: unknown): CoreRuleKeyV1 {`
- line 34: `export class CoreRuleKeyCreationError extends Error {`

## `src/engine/core/rules/ruleValidationSharedV1.ts`

- line 1: `export type CoreRuleValidationCodeV1 =`
- line 36: `export type CoreRuleValidationIssueV1 = Readonly<{`
- line 42: `export type CoreRuleValidationResultV1<T> =`
- line 46: `export type CoreRuleRawRecordV1 = Record<string, unknown>;`
- line 50: `export function isCoreRuleUnsafeRecordKeyV1(key: string): boolean {`
- line 54: `export function compareCoreRuleCodeUnitsV1(left: string, right: string): number {`
- line 63: `export function escapeCoreRuleJsonPointerSegmentV1(value: string): string {`
- line 67: `export function coreRuleJsonPointerV1(path: string, segment?: string): string {`
- line 72: `export function makeCoreRuleIssueV1(`
- line 80: `export function sortCoreRuleIssuesV1(`
- line 94: `export function isCoreRulePlainRecordV1(value: unknown): value is CoreRuleRawRecordV1 {`
- line 112: `export function readCoreRuleExactRecordV1(`
- line 188: `export const readCoreRuleRecordV1 = readCoreRuleExactRecordV1;`
- line 190: `export function hasCoreRuleOwnFieldV1(record: CoreRuleRawRecordV1, field: string): boolean {`
- line 194: `export function canonicalCoreRuleRecordV1<T extends object>(`
- line 203: `export function deepFreezeCoreRuleValueV1<T>(value: T, seen = new Set<object>()): T {`
- line 217: `export function freshCoreRuleJsonValueV1<T>(value: T): T {`

## `src/engine/core/rules/ruleZoneRefV1.ts`

- line 11: `export type CoreRuleZoneRefV1 =`
- line 22: `export function validateCoreRuleZoneRefV1(`
- line 84: `export function createCoreRuleZoneRefV1(value: unknown): CoreRuleZoneRefV1 {`
- line 90: `export class CoreRuleZoneRefCreationError extends Error {`
- line 99: `export function isCoreRuleObjectIdV1(value: unknown): boolean {`

## `src/engine/core/rules/searchSessionOperationsV1.ts`

- line 22: `export type CoreSearchSessionInputV1 = Readonly<{`
- line 161: `export function openCoreSearchSessionV1(`
- line 166: `export function openCoreSearchSessionV1(`
- line 171: `export function openCoreSearchSessionV1(`
- line 195: `export function completeCoreSearchSessionV1(`
- line 200: `export function completeCoreSearchSessionV1(`
- line 205: `export function completeCoreSearchSessionV1(`
- line 262: `export function cancelCoreSearchSessionV1(`
- line 266: `export function cancelCoreSearchSessionV1(`
- line 270: `export function cancelCoreSearchSessionV1(`

## `src/engine/core/rules/searchSessionV1.ts`

- line 16: `export type CoreSearchPortionV1 =`
- line 20: `export type CoreSearchCriteriaV1 =`
- line 30: `export type CoreSearchSessionV1 = Readonly<{`
- line 41: `export type ModeNeutralCoreSearchSessionSliceV1 = Readonly<{`
- line 247: `export function validateModeNeutralCoreSearchSessionSliceV1(`
- line 348: `export class CoreSearchSessionCreationError extends Error {`
- line 357: `export function createModeNeutralCoreSearchSessionSliceV1(`

## `src/engine/core/rules/visibilityGrantV1.ts`

- line 19: `export type CoreVisibilitySubjectV1 =`
- line 28: `export type CoreVisibilityAudienceV1 =`
- line 31: `export type CoreVisibilityModeV1 = 'look' | 'reveal';`
- line 32: `export type CoreVisibilityGrantV1 = Readonly<{`
- line 39: `export type ModeNeutralCoreVisibilitySliceV1 = Readonly<{`
- line 209: `export function validateModeNeutralCoreVisibilitySliceV1(`
- line 272: `export class CoreVisibilitySliceCreationErrorV1 extends Error {`
- line 283: `export function createModeNeutralCoreVisibilitySliceV1(`
- line 300: `export const createCoreVisibilitySliceV1 = createModeNeutralCoreVisibilitySliceV1;`

## `src/engine/core/rules/visibilityQueryV1.ts`

- line 10: `export type CoreVisibilityDecisionContextV1 = Readonly<{`
- line 18: `export type CoreVisibilityQueryBundleV1 = Readonly<{`
- line 100: `export function coreCanPlayerViewObjectIdentityV1(...args: unknown[]): boolean {`

## `src/engine/core/runtime/attachment.ts`

- line 4: `export type CoreAttachmentTargetV1 =`
- line 14: `export interface CoreAttachmentStateV1 {`
- line 18: `export type CoreAttachmentValidationCode =`
- line 26: `export interface CoreAttachmentValidationIssue {`
- line 32: `export type CoreAttachmentValidationResult =`
- line 42: `export class CoreAttachmentCreationError extends Error {`
- line 158: `export function isCanonicalCoreObjectIdV1(value: unknown): value is CoreObjectId {`
- line 248: `export function validateCoreAttachmentStateV1(value: unknown): CoreAttachmentValidationResult {`
- line 270: `export function createCoreAttachmentStateV1(input: unknown): CoreAttachmentStateV1 {`

## `src/engine/core/runtime/cardOrientation.ts`

- line 1: `export interface CoreCardOrientationStateV1 {`
- line 9: `export type CoreCardOrientationValidationCode =`
- line 16: `export interface CoreCardOrientationValidationIssue {`
- line 22: `export type CoreCardOrientationValidationResult =`
- line 32: `export class CoreCardOrientationCreationError extends Error {`
- line 164: `export function validateCoreCardOrientationStateV1(`
- line 177: `export function createCoreCardOrientationStateV1(`

## `src/engine/core/runtime/cardRuntimeState.ts`

- line 11: `export interface CoreCardObjectRuntimeStateV1 {`
- line 17: `export interface ModeNeutralCoreCardRuntimeSliceV1 {`
- line 22: `export interface CreateModeNeutralCoreCardRuntimeSliceV1Input {`
- line 60: `export function createModeNeutralCoreCardRuntimeSliceV1(`

## `src/engine/core/runtime/cardRuntimeValidation.ts`

- line 26: `export type CoreCardRuntimeValidationCode =`
- line 43: `export interface CoreCardRuntimeValidationIssue {`
- line 49: `export type CoreCardRuntimeValidationResult =`
- line 53: `export class CoreCardRuntimeCreationError extends Error {`
- line 377: `export function validateModeNeutralCoreCardRuntimeSliceV1(`

## `src/engine/core/runtime/counterDamage.ts`

- line 1: `export interface CoreCounterEntryV1 {`
- line 6: `export interface CoreCounterDamageStateV1 {`
- line 11: `export type CoreCounterDamageValidationCode =`
- line 21: `export interface CoreCounterDamageValidationIssue {`
- line 27: `export type CoreCounterDamageValidationResult =`
- line 37: `export class CoreCounterDamageCreationError extends Error {`
- line 240: `export function validateCoreCounterDamageStateV1(value: unknown): CoreCounterDamageValidationResult {`
- line 282: `export function createCoreCounterDamageStateV1(value: unknown): CoreCounterDamageStateV1 {`

## `src/engine/core/runtime/index.ts`

- line 6: `export type {`
- line 18: `export type {`
- line 32: `export type {`
- line 43: `export type {`
- line 53: `export type {`

## `src/engine/core/stack/announcementPrimitivesV1.ts`

- line 5: `export type CoreStackChoiceKeyV1 = string;`
- line 7: `export type CoreStackTargetRefV1 =`
- line 11: `export type CoreStackPrimitiveValidationCode =`
- line 18: `export interface CoreStackPrimitiveValidationIssue {`
- line 24: `export type CoreStackChoiceKeyValidationResult =`
- line 28: `export type CoreStackTargetRefValidationResult =`
- line 32: `export class CoreStackChoiceKeyCreationError extends Error {`
- line 42: `export class CoreStackTargetRefCreationError extends Error {`
- line 150: `export function validateCoreStackChoiceKeyV1(value: unknown): CoreStackChoiceKeyValidationResult {`
- line 163: `export function createCoreStackChoiceKeyV1(value: unknown): CoreStackChoiceKeyV1 {`
- line 169: `export function validateCoreStackTargetRefV1(value: unknown): CoreStackTargetRefValidationResult {`
- line 203: `export function createCoreStackTargetRefV1(value: unknown): CoreStackTargetRefV1 {`

## `src/engine/core/stack/choiceAnnouncementV1.ts`

- line 1: `export type CoreStackChoiceKeyV1 = string;`
- line 3: `export type CoreStackVariableAnnouncementV1 = Readonly<{`
- line 8: `export type CoreStackAlternativeCostChoiceV1 = Readonly<{`
- line 12: `export type CoreStackAdditionalCostChoiceV1 = Readonly<{`
- line 17: `export type CoreStackCostChoiceSetV1 = Readonly<{`
- line 22: `export type CoreStackChoiceAnnouncementValidationCode =`
- line 34: `export type CoreStackChoiceAnnouncementValidationIssue = Readonly<{`
- line 40: `export type CoreStackChoiceAnnouncementValidationResult<T> =`
- line 44: `export class CoreStackChoiceAnnouncementCreationError extends Error {`
- line 280: `export function validateCoreStackChosenModeKeysV1(value: unknown): CoreStackChoiceAnnouncementValidationResult<readonly CoreStackChoiceKeyV1[]> {`
- line 284: `export function createCoreStackChosenModeKeysV1(value: unknown): readonly CoreStackChoiceKeyV1[] {`
- line 290: `export function validateCoreStackVariableAnnouncementsV1(value: unknown): CoreStackChoiceAnnouncementValidationResult<readonly CoreStackVariableAnnouncementV1[]> {`
- line 294: `export function createCoreStackVariableAnnouncementsV1(value: unknown): readonly CoreStackVariableAnnouncementV1[] {`
- line 300: `export function validateCoreStackVariableAnnouncementV1(value: unknown): CoreStackChoiceAnnouncementValidationResult<CoreStackVariableAnnouncementV1> {`
- line 306: `export function createCoreStackVariableAnnouncementV1(value: unknown): CoreStackVariableAnnouncementV1 {`
- line 312: `export function validateCoreStackAlternativeCostChoiceV1(value: unknown): CoreStackChoiceAnnouncementValidationResult<CoreStackAlternativeCostChoiceV1> {`
- line 322: `export function createCoreStackAlternativeCostChoiceV1(value: unknown): CoreStackAlternativeCostChoiceV1 {`
- line 328: `export function validateCoreStackAdditionalCostChoiceV1(value: unknown): CoreStackChoiceAnnouncementValidationResult<CoreStackAdditionalCostChoiceV1> {`
- line 340: `export function createCoreStackAdditionalCostChoiceV1(value: unknown): CoreStackAdditionalCostChoiceV1 {`
- line 346: `export function validateCoreStackCostChoiceSetV1(value: unknown): CoreStackChoiceAnnouncementValidationResult<CoreStackCostChoiceSetV1> {`
- line 375: `export function createCoreStackCostChoiceSetV1(value: unknown): CoreStackCostChoiceSetV1 {`

## `src/engine/core/stack/index.ts`

- line 1: `export type {`
- line 18: `export type {`
- line 26: `export type {`

## `src/engine/core/stack/stackAnnouncementCanonicalizationV1.ts`

- line 68: `export function canonicalizeModeNeutralCoreStackAnnouncementEntriesV1(`
- line 79: `export function canonicalizeModeNeutralCoreStackAnnouncementSliceV1(`

## `src/engine/core/stack/stackAnnouncementRecordV1.ts`

- line 4: `export type {`
- line 11: `export type { CoreStackTargetRefV1 } from './announcementPrimitivesV1';`
- line 12: `export type { CoreStackTargetSelectionV1 } from './targetAnnouncementV1';`
- line 14: `export type CoreStackDistributionAssignmentV1 = Readonly<{`
- line 19: `export type CoreStackDistributionAnnouncementV1 = Readonly<{`
- line 33: `export type CoreStackAnnouncementRecordV1 =`

## `src/engine/core/stack/stackAnnouncementSliceV1.ts`

- line 7: `export type ModeNeutralCoreStackAnnouncementSliceV1 = Readonly<{`
- line 12: `export type CreateModeNeutralCoreStackAnnouncementSliceV1Input = Readonly<{`
- line 33: `export class CoreStackAnnouncementCreationError extends Error {`
- line 43: `export function createModeNeutralCoreStackAnnouncementSliceV1(`

## `src/engine/core/stack/stackAnnouncementValidationV1.ts`

- line 23: `export type CoreStackAnnouncementValidationCode =`
- line 32: `export type CoreStackAnnouncementValidationIssue = Readonly<{`
- line 38: `export type CoreStackAnnouncementValidationResult =`
- line 208: `export function validateModeNeutralCoreStackAnnouncementSliceV1(`

## `src/engine/core/stack/targetAnnouncementV1.ts`

- line 11: `export type CoreStackTargetSelectionV1 = Readonly<{`
- line 17: `export type CoreStackTargetSelectionValidationCode =`
- line 23: `export type CoreStackTargetSelectionValidationIssue = Readonly<{`
- line 29: `export type CoreStackTargetSelectionValidationResult =`
- line 33: `export type CoreStackTargetSelectionsValidationResult =`
- line 37: `export class CoreStackTargetSelectionCreationError extends Error {`
- line 149: `export function validateCoreStackTargetSelectionV1(`
- line 183: `export function createCoreStackTargetSelectionV1(value: unknown): CoreStackTargetSelectionV1 {`
- line 238: `export function validateCoreStackTargetSelectionsV1(`
- line 277: `export function createCoreStackTargetSelectionsV1(value: unknown): readonly CoreStackTargetSelectionV1[] {`
- line 283: `export const validateCoreStackTargetAnnouncementV1 = validateCoreStackTargetSelectionsV1;`
- line 284: `export const createCoreStackTargetAnnouncementV1 = createCoreStackTargetSelectionsV1;`

## `src/engine/core/stack/transaction/cardSpellCommitV1.ts`

- line 46: `export type CoreCardSpellCommitInputV1 = Readonly<{`
- line 52: `export type CoreCardSpellCommitResultV1 = Readonly<{`
- line 476: `export function commitCoreCardSpellToStackV1(`

## `src/engine/core/stack/transaction/index.ts`

- line 5: `export type {`
- line 11: `export type { CoreStackTransactionErrorCodeV1 } from './stackTransactionErrorV1';`
- line 12: `export type {`
- line 20: `export type {`
- line 26: `export type {`
- line 33: `export type {`
- line 40: `export type {`

## `src/engine/core/stack/transaction/internalStackTransactionV1.ts`

- line 10: `export type StackTransactionNestedIssueV1 = Readonly<{`
- line 16: `export type StackTransactionBundlePartsV1 = Readonly<{`
- line 35: `export function sortTransactionIssues<T extends StackTransactionNestedIssueV1>(`
- line 70: `export function inspectStackTransactionBundleInputV1(`
- line 138: `export function nestedTransactionIssuesV1(`
- line 145: `export function inspectionFailureIssueV1(): StackTransactionNestedIssueV1 {`
- line 149: `export function deepFreezeStackTransactionV1<T>(value: T, seen = new Set<object>()): T {`
- line 162: `export function cloneTransactionIssuesV1(`
- line 180: `export function freezeStackTransactionResultV1<T extends CoreStackTransactionValidationResultV1>(`
- line 186: `export type CoreStackTransactionZoneV1 =`
- line 195: `export type CoreStackTransactionObjectLocationV1 = Readonly<{`
- line 202: `export function locateCoreObjectExactlyOnceV1(`
- line 228: `export function rebuildRecordWithoutKeyV1<T>(`
- line 239: `export function rebuildRecordWithKeyV1<T>(`
- line 258: `export function rebuildRuntimeForCardObjectReplacementV1(`
- line 280: `export function rebuildArrayWithoutIndexV1<T>(`
- line 287: `export function rebuildArrayWithAppendedValueV1<T>(`

## `src/engine/core/stack/transaction/stackRemovalV1.ts`

- line 43: `export type CoreNonStackCardZoneDestinationV1 = Exclude<`
- line 48: `export type CoreStackRemovalInputV1 =`
- line 59: `export type CoreStackRemovalResultV1 = Readonly<{`
- line 470: `export function removeCoreStackObjectV1(`

## `src/engine/core/stack/transaction/stackRetargetV1.ts`

- line 34: `export type CoreStackTargetReplacementV1 = Readonly<{`
- line 39: `export type CoreStackRetargetInputV1 = Readonly<{`
- line 44: `export type CoreStackRetargetResultV1 = Readonly<{`
- line 565: `export function retargetCoreStackObjectV1(`

## `src/engine/core/stack/transaction/stackTransactionBundleV1.ts`

- line 6: `export type CoreStackTransactionBundleV1 = Readonly<{`
- line 12: `export type CreateCoreStackTransactionBundleV1Input = Readonly<{`
- line 19: `export type {`
- line 26: `export type { CoreStackTransactionErrorCodeV1 } from './stackTransactionErrorV1';`
- line 28: `export function createCoreStackTransactionBundleV1(`

## `src/engine/core/stack/transaction/stackTransactionErrorV1.ts`

- line 7: `export type CoreStackTransactionErrorCodeV1 = CoreStackTransactionValidationCodeV1;`
- line 9: `export class CoreStackTransactionErrorV1 extends Error {`

## `src/engine/core/stack/transaction/stackTransactionValidationV1.ts`

- line 15: `export type CoreStackTransactionValidationCodeV1 =`
- line 32: `export type CoreStackTransactionValidationNestedIssueV1 = Readonly<{`
- line 38: `export type CoreStackTransactionValidationIssueV1 = Readonly<{`
- line 45: `export type CoreStackTransactionValidationResultV1 =`
- line 153: `export function validateCoreStackTransactionBundleV1(`

## `src/engine/core/stack/transaction/syntheticStackCommitV1.ts`

- line 29: `export type CoreSyntheticStackObjectIdentityV1 =`
- line 34: `export type CoreSyntheticStackCommitInputV1 = Readonly<{`
- line 43: `export type CoreSyntheticStackCommitResultV1 = Readonly<{`
- line 396: `export function commitCoreSyntheticStackObjectV1(`

## `src/engine/core/tabletop/commandV1.ts`

- line 9: `export type CoreTabletopTurnPositionV1 =`
- line 21: `export type CoreTabletopDrawPayloadV1 = Readonly<{`
- line 26: `export type CoreTabletopZoneMovePayloadV1 = Readonly<{`
- line 32: `export type CoreTabletopTapPayloadV1 = Readonly<{`
- line 38: `export type CoreTabletopManaPayloadV1 = Readonly<{`
- line 44: `export type CoreTabletopCounterPayloadV1 = Readonly<{`
- line 51: `export type CoreTabletopTokenCreatePayloadV1 = Readonly<{`
- line 58: `export type CoreTabletopTokenRemovePayloadV1 = Readonly<{`
- line 63: `export type CoreTabletopTurnTransitionV1 =`
- line 68: `export type CoreTabletopTurnPayloadV1 = Readonly<{`
- line 73: `export type CoreTabletopCommandPayloadV1 =`
- line 83: `export type CoreTabletopCommandKindV1 = CoreTabletopCommandPayloadV1['kind'];`

## `src/engine/core/tabletop/operationsV1.ts`

- line 48: `export type CoreTabletopOperationResultV1 = Readonly<{`
- line 53: `export class CoreTabletopOperationErrorV1 extends Error {`
- line 287: `export function drawCoreTabletopCardsV1(`
- line 510: `export function untapCoreTabletopPermanentsV1(`
- line 530: `export function applyCoreTabletopPayloadV1(`

## `src/engine/core/transition/cardReincarnation.ts`

- line 20: `export type CoreCardReincarnationErrorCode =`
- line 25: `export class CoreCardReincarnationError extends Error {`
- line 35: `export function nextCoreCardIncarnationV1(currentIncarnation: unknown): number {`
- line 57: `export function nextCoreCardObjectIdV1(`
- line 112: `export function createDefaultCoreCardRuntimeAfterZoneChangeV1(): CoreCardObjectRuntimeStateV1 {`
- line 131: `export function isDefaultCoreCardRuntimeAfterZoneChangeV1(`

## `src/engine/core/transition/cardZoneTransition.ts`

- line 29: `export interface CoreCardZoneTransitionInputV1 {`
- line 34: `export interface CoreCardZoneTransitionResultV1 {`
- line 39: `export type CoreCardZoneTransitionErrorCodeV1 =`
- line 50: `export class CoreCardZoneTransitionErrorV1 extends Error {`
- line 205: `export function applyCoreCardZoneTransitionV1(`

## `src/engine/core/transition/zoneDestination.ts`

- line 4: `export type CoreLibraryPlacementV1 =`
- line 9: `export type CoreCardZoneDestinationV1 =`
- line 18: `export type CoreZoneDestinationValidationCode =`
- line 27: `export interface CoreZoneDestinationValidationIssue {`
- line 33: `export type CoreZoneDestinationValidationResult =`
- line 43: `export class CoreZoneDestinationCreationError extends Error {`
- line 348: `export function validateCoreCardZoneDestinationV1(`
- line 363: `export function createCoreCardZoneDestinationV1(`

## `src/engine/core/transition/zoneOrder.ts`

- line 3: `export type CorePermutationV1 = readonly number[];`
- line 5: `export type CoreZoneOrderErrorCode =`
- line 16: `export class CoreZoneOrderError extends Error {`
- line 32: `export interface CorePermutationValidationIssue {`
- line 38: `export type CorePermutationValidationResult =`
- line 157: `export function validateCorePermutationV1(`
- line 291: `export function removeCoreObjectIdExactlyOnceV1<T extends string>(`
- line 304: `export function insertCoreObjectIdAtV1<T extends string>(`
- line 320: `export function moveCoreObjectIdWithinZoneV1<T extends string>(`
- line 336: `export function applyCorePermutationV1<T extends string>(`
- line 347: `export type { CoreObjectId };`

## `src/engine/core/turn/cleanupV1.ts`

- line 59: `export function completeCoreCleanupDiscardCheckpointV1<TPending extends CoreTurnPendingTriggerComponentV1>(`
- line 99: `export function applyCoreCleanupStateActionsV1<TPending extends CoreTurnPendingTriggerComponentV1>(`
- line 130: `export function startCoreRepeatedCleanupV1<TPending extends CoreTurnPendingTriggerComponentV1>(`

## `src/engine/core/turn/index.ts`

- line 83: `export type { CoreTurnPositionV1 } from './turnPositionV1';`
- line 84: `export type {`
- line 97: `export type {`
- line 105: `export function createModeNeutralCorePendingTriggerSliceV1(`
- line 108: `export function createModeNeutralCorePendingTriggerSliceV1(`
- line 112: `export function createModeNeutralCorePendingTriggerSliceV1(`
- line 126: `export type {`
- line 216: `export type {`
- line 224: `export type {`
- line 230: `export function coreApnapPlayerOrderV1(`
- line 240: `export function analyzeCorePendingTriggerPlacementV1(`
- line 247: `export function appendCorePendingTriggeredAbilitiesV1(`
- line 258: `export type { CoreSbaCheckOutcomeV1 } from './sbaTriggerBoundaryV1';`
- line 260: `export function startCorePriorityCycleV1(`
- line 267: `export function passCorePriorityV1(`
- line 275: `export function resumeCoreAfterPriorityActionV1(`
- line 283: `export function completeCoreResolutionAfterRemovalV1(`
- line 294: `export type CoreTurnPositionAdvanceInputV1 = Readonly<{`
- line 308: `export type {`
- line 313: `export type {`

## `src/engine/core/turn/pendingTriggerV1.ts`

- line 16: `export type CoreTriggerStackPlacementBucketV1 = 'ordinary' | 'ability-triggered';`
- line 18: `export type CorePendingTriggeredAbilityV1 = Readonly<{`
- line 27: `export type ModeNeutralCorePendingTriggerSliceV1 = Readonly<{`
- line 33: `export type CorePendingTriggerSliceV1 = ModeNeutralCorePendingTriggerSliceV1;`
- line 35: `export type CreateModeNeutralCorePendingTriggerSliceV1Input = Readonly<{`
- line 40: `export class CorePendingTriggerCreationErrorV1 extends Error {`
- line 50: `export class CorePendingTriggerOperationErrorV1 extends Error {`
- line 89: `export function createModeNeutralCorePendingTriggerSliceV1(`
- line 105: `export type CorePendingTriggeredAbilityAppendInputV1 = Readonly<{`
- line 177: `export function appendCorePendingTriggeredAbilitiesV1(`
- line 221: `export type {`

## `src/engine/core/turn/pendingTriggerValidationV1.ts`

- line 25: `export type CorePendingTriggerValidationCodeV1 =`
- line 41: `export type CorePendingTriggerValidationIssueV1 = Readonly<{`
- line 47: `export type CorePendingTriggerValidationResultV1 =`
- line 451: `export function validateModeNeutralCorePendingTriggerSliceV1(`
- line 556: `export const validateCorePendingTriggerSliceV1 = validateModeNeutralCorePendingTriggerSliceV1;`
- line 557: `export type { CoreObjectId, CorePlayerId };`

## `src/engine/core/turn/priorityPassV1.ts`

- line 11: `export type CorePriorityPassComponentInputV1 = Readonly<{`
- line 16: `export type CorePriorityPassComponentResultV1 = CorePriorityPassComponentInputV1;`
- line 18: `export type CorePriorityPassComponentValidationIssueV1 = Readonly<{`
- line 24: `export type CorePriorityPassComponentValidationResultV1 =`
- line 199: `export function validateCorePriorityPassComponentV1(`
- line 205: `export function normalizeCorePriorityPassComponentV1(`
- line 241: `export function startCorePriorityCycleV1(`
- line 257: `export function passCorePriorityV1(`
- line 289: `export function resumeCoreAfterPriorityActionV1(`
- line 307: `export const resetCorePriorityAfterActionV1 = resumeCoreAfterPriorityActionV1;`
- line 309: `export type { CoreObjectId, CorePlayerId };`

## `src/engine/core/turn/resolutionBoundaryV1.ts`

- line 101: `export function completeCoreResolutionAfterRemovalV1(`

## `src/engine/core/turn/sbaTriggerBoundaryV1.ts`

- line 17: `export type CoreSbaCheckOutcomeV1 = Readonly<{`
- line 79: `export function recordCoreSbaCheckOutcomeV1(`

## `src/engine/core/turn/stackAnnouncementAccessV1.ts`

- line 5: `export type {`

## `src/engine/core/turn/stackTransactionAccessV1.ts`

- line 7: `export type {`

## `src/engine/core/turn/triggerApnapV1.ts`

- line 17: `export type CorePendingTriggerOrderGroupV1 = Readonly<{`
- line 23: `export type CorePendingTriggerPlacementAnalysisV1 = Readonly<{`
- line 29: `export type CorePendingTriggerOrderValidationCodeV1 =`
- line 37: `export type CorePendingTriggerOrderValidationIssueV1 = Readonly<{`
- line 43: `export type CorePendingTriggerOrderValidationResultV1 =`
- line 81: `export function coreApnapPlayerOrderV1(`
- line 102: `export function analyzeCorePendingTriggerPlacementV1(`
- line 199: `export function validateCorePendingTriggerOrderV1(`
- line 204: `export function validateCorePendingTriggerOrderV1(`
- line 208: `export function validateCorePendingTriggerOrderV1(`
- line 260: `export const validateCorePendingTriggerPlacementOrderV1 = validateCorePendingTriggerOrderV1;`
- line 261: `export const analyzeCorePendingTriggerOrderV1 = analyzeCorePendingTriggerPlacementV1;`
- line 262: `export type { CorePendingTriggerValidationIssueV1 };`

## `src/engine/core/turn/triggerPlacementV1.ts`

- line 40: `export function analyzeCorePendingTriggerPlacementOnBundleV1(`
- line 47: `export function appendCorePendingTriggeredAbilitiesToBundleV1(`
- line 69: `export function placeCorePendingTriggersOnStackV1(`
- line 120: `export const appendCorePendingTriggeredAbilitiesV1 = appendCorePendingTriggeredAbilitiesToBundleV1;`

## `src/engine/core/turn/turnAdvanceV1.ts`

- line 24: `export type CoreTurnPendingTriggerComponentV1 = Readonly<{`
- line 28: `export type CoreTurnAdvanceBundleV1<`
- line 36: `export type CoreTurnBasedActionV1 =`
- line 122: `export function rebuildCoreTurnAdvanceBundleV1<`
- line 141: `export function assertCoreTurnAdvanceBundleV1<TPending extends CoreTurnPendingTriggerComponentV1>(`
- line 208: `export function registryWithEmptyManaV1(`
- line 347: `export function advanceCoreTurnPositionV1<TPending extends CoreTurnPendingTriggerComponentV1>(`
- line 378: `export function completeCoreTurnBasedActionCheckpointV1<TPending extends CoreTurnPendingTriggerComponentV1>(`
- line 419: `export function advanceCoreToNextTurnV1<TPending extends CoreTurnPendingTriggerComponentV1>(`
- line 455: `export type {`

## `src/engine/core/turn/turnLifecycleV1.ts`

- line 7: `export type CoreTurnWindowV1 =`
- line 42: `export type CorePendingTriggerOrderGroupV1 = Readonly<{`
- line 48: `export type CoreTurnLifecycleSliceV1 = Readonly<{`
- line 56: `export type ModeNeutralCoreTurnLifecycleSliceV1 = CoreTurnLifecycleSliceV1;`
- line 58: `export type CreateModeNeutralCoreTurnLifecycleSliceV1Input = Readonly<{`
- line 104: `export function createModeNeutralCoreTurnLifecycleSliceV1(`
- line 125: `export type {`

## `src/engine/core/turn/turnLifecycleValidationV1.ts`

- line 14: `export type CoreTurnLifecycleValidationCodeV1 =`
- line 40: `export type CoreTurnLifecycleValidationCode = CoreTurnLifecycleValidationCodeV1;`
- line 42: `export type CoreTurnLifecycleValidationIssueV1 = Readonly<{`
- line 48: `export type CoreTurnLifecycleValidationIssue = CoreTurnLifecycleValidationIssueV1;`
- line 50: `export type CoreTurnLifecycleValidationResultV1 =`
- line 57: `export type CoreTurnPositionValidationResultV1 =`
- line 64: `export type CoreTurnWindowValidationResultV1 =`
- line 71: `export type CoreTurnLifecycleValidationResult = CoreTurnLifecycleValidationResultV1;`
- line 72: `export type CoreTurnPositionValidationResult = CoreTurnPositionValidationResultV1;`
- line 73: `export type CoreTurnWindowValidationResult = CoreTurnWindowValidationResultV1;`
- line 75: `export class CoreTurnLifecycleCreationErrorV1 extends Error {`
- line 86: `export type CoreTurnLifecycleCreationError = CoreTurnLifecycleCreationErrorV1;`
- line 442: `export function validateCoreTurnWindowV1(input: unknown): CoreTurnWindowValidationResultV1 {`
- line 601: `export function validateModeNeutralCoreTurnLifecycleSliceV1(`

## `src/engine/core/turn/turnPositionV1.ts`

- line 7: `export type CoreTurnPositionV1 =`
- line 197: `export function validateCoreTurnPositionV1(`
- line 210: `export type {`

## `src/engine/core/turn/turnPriorityBundleV1.ts`

- line 13: `export type CoreTurnPriorityBundleV1 = Readonly<{`
- line 19: `export type CreateCoreTurnPriorityBundleV1Input = Readonly<{`
- line 25: `export class CoreTurnPriorityBundleCreationErrorV1 extends Error {`
- line 44: `export function createCoreTurnPriorityBundleV1(`
- line 60: `export type {`

## `src/engine/core/turn/turnPriorityBundleValidationV1.ts`

- line 22: `export type CoreTurnPriorityBundleValidationCodeV1 =`
- line 48: `export type CoreTurnPriorityBundleValidationIssueV1 = Readonly<{`
- line 54: `export type CoreTurnPriorityBundleValidationResultV1 =`
- line 237: `export function validateCoreTurnPriorityBundleV1(`

## `src/engine/core/turn/turnPriorityErrorV1.ts`

- line 1: `export type CoreTurnPriorityOperationCodeV1 =`
- line 19: `export type CoreTurnPriorityErrorCodeV1 = CoreTurnPriorityOperationCodeV1;`
- line 20: `export type CoreTurnPriorityOperationErrorCodeV1 = CoreTurnPriorityOperationCodeV1;`
- line 21: `export type CoreTurnPriorityOperationCode = CoreTurnPriorityOperationCodeV1;`
- line 22: `export type CoreTurnPriorityErrorCode = CoreTurnPriorityOperationCodeV1;`
- line 24: `export type CoreTurnPriorityOperationIssueV1 = Readonly<{`
- line 30: `export class CoreTurnPriorityErrorV1 extends Error {`
- line 47: `export class CoreTurnPriorityOperationErrorV1 extends CoreTurnPriorityErrorV1 {`

## `src/engine/goldenReplay.ts`

- line 72: `export interface GoldenInitialCard {`
- line 81: `export interface GoldenInitialState {`
- line 98: `export type GoldenUnverifiableKind = 'scope-boundary' | 'runtime-gap';`
- line 100: `export interface GoldenUnverifiable {`
- line 106: `export interface GoldenReplayCase {`
- line 119: `export type ReplayEventType =`
- line 133: `export interface ReplayEvent {`
- line 145: `export interface ExpectedReplayEvent extends Partial<Omit<ReplayEvent, 'type'>> {`
- line 149: `export interface ReplayTriggerCandidate {`
- line 157: `export interface ExpectedTriggerCandidate extends Partial<`
- line 163: `export interface GoldenReplayDiff {`
- line 170: `export interface GoldenReplayResult {`
- line 181: `export interface GoldenReplayClassification {`
- line 187: `export function parseGoldenReplayCase(value: unknown, source: string): GoldenReplayCase {`
- line 232: `export function classifyGoldenReplay(`
- line 244: `export function replayGoldenCase(testCase: GoldenReplayCase): GoldenReplayResult {`
- line 318: `export function formatGoldenReplayDiffs(diffs: readonly GoldenReplayDiff[]): string {`

## `src/engine/grammar/abilityText.ts`

- line 6: `export function hasAbilityWordLabel(raw: string): boolean {`
- line 10: `export function stripAbilityWordLabel(raw: string): string {`

## `src/engine/grammar/activatedKeyword.ts`

- line 1: `export type KeywordActivationZone = 'battlefield' | 'graveyard' | 'hand' | 'command';`
- line 3: `export interface CanonicalKeywordActivation {`
- line 38: `export function canonicalizeActivatedKeyword(core: string): CanonicalKeywordActivation[] | null {`

## `src/engine/grammar/compile.ts`

- line 8: `export interface CompileContext {`
- line 20: `export type AutoDecision = 'auto' | 'guided' | 'manual';`
- line 21: `export type CostDecision = 'auto' | 'manual';`
- line 22: `export type RiskLevel = 'low' | 'medium' | 'high';`
- line 23: `export type PromptKind =`
- line 36: `export interface TargetFilter {`
- line 58: `export type LibrarySearchFilter =`
- line 62: `export interface LibrarySearchSpec {`
- line 69: `export interface ModalOption {`
- line 74: `export type CounterCostPrompt =`
- line 87: `export interface EffectPrompt {`
- line 116: `export type GuidedAnswer =`
- line 125: `export interface CompiledEffect {`
- line 134: `export interface CompiledCost {`
- line 324: `export function compileAbilityCost(cost: AbilityCost | null, ctx: CompileContext): CompiledCost {`
- line 425: `export function compileAbilityIR(ir: AbilityIR, ctx: CompileContext): CompiledEffect {`
- line 2134: `export function guidedCounterLeafForManualComposite(`
- line 2202: `export function graveyardReturnFilterForRaw(raw: string): TargetFilter | null {`
- line 2476: `export function buildGuidedCommands(`

## `src/engine/grammar/index.ts`

- line 10: `export type AbilityShape =`
- line 19: `export interface AbilityLine {`
- line 29: `export type EffectAtomId = string;`
- line 30: `export type ConstructId = string;`
- line 38: `export interface EffectAtomDefinition extends ProbeDefinition<EffectAtomId> {`
- line 41: `export type ConstructDefinition = ProbeDefinition<ConstructId>;`
- line 43: `export const EFFECT_ATOM_DEFINITIONS: readonly EffectAtomDefinition[] = [`
- line 124: `export const CONSTRUCT_DEFINITIONS: readonly ConstructDefinition[] = [`
- line 154: `export function splitAbilityLines(def: CardDef): AbilityLine[] {`
- line 194: `export interface ActivatedAbilityLine {`
- line 216: `export function activatedAbilityLines(`
- line 255: `export function classifyAbilityShape(line: string, typeLine: string): AbilityShape {`
- line 283: `export function detectEffectAtoms(line: string): EffectAtomId[] {`
- line 288: `export function detectConstructs(line: string): ConstructId[] {`

## `src/engine/grammar/ir.ts`

- line 13: `export type CountSpec =`
- line 39: `export interface EffectClause {`
- line 47: `export interface AbilityCost {`
- line 56: `export interface TriggerCondition {`
- line 61: `export type ParseStatus = 'full' | 'partial' | 'none';`
- line 63: `export interface AbilityIR {`
- line 100: `export function parseAbilityIR(line: string, typeLine: string): AbilityIR {`

## `src/engine/grammar/manaShortcut.ts`

- line 23: `export type NaiveManaOutput = Partial<Record<ManaColor, number>>;`
- line 103: `export function manaOutputsForAddManaClause(raw: string, def: CardDef): NaiveManaOutput[] {`
- line 160: `export function intrinsicBasicLandColors(def: CardDef): ManaColor[] {`
- line 239: `export function naiveTapManaColors(def: CardDef | undefined): ManaColor[] {`
- line 247: `export function naiveTapManaOutputs(def: CardDef | undefined): readonly NaiveManaOutput[] {`
- line 253: `export function hasActivatedAddManaLine(def: CardDef | undefined): boolean {`

## `src/engine/grammar/partialImplementation.ts`

- line 13: `export function isPartiallyImplemented(def: CardDef): boolean {`

## `src/engine/grammar/rule-refs.ts`

- line 1: `export const CR_KEYWORD_ACTIONS: ReadonlyArray<{ id: string; name: string }> = [`
- line 86: `export function isValidRuleRef(ref: string): boolean {`

## `src/engine/handSize.ts`

- line 3: `export function effectiveMaximumHandSize(state: GameState, playerId: PlayerId): number | null {`

## `src/engine/init.ts`

- line 17: `export interface InitDeckCard {`
- line 44: `export function initGame(deck: InitDeckCard[], seed: number): GameState {`

## `src/engine/keywordGrammar.ts`

- line 3: `export interface KeywordDefinition {`
- line 11: `export interface KeywordClause {`
- line 16: `export const KEYWORD_DEFINITIONS: readonly KeywordDefinition[] = [`
- line 243: `export function parseTeamworkThreshold(oracleText: string): number | null {`
- line 249: `export function cardOracleTexts(def: CardDef | undefined): string[] {`
- line 263: `export function possessedKeywords(def: CardDef | undefined): string[] {`
- line 283: `export function splitParagraphs(text: string): string[] {`
- line 290: `export function removeReminderAndQuotes(text: string): string {`
- line 341: `export function parsePureKeywordLine(core: string): KeywordClause[] | null {`

## `src/engine/mana.ts`

- line 4: `export type Pip =`
- line 12: `export interface ParsedCost {`
- line 28: `export function parseManaCost(cost: string): ParsedCost {`
- line 98: `export interface PaymentSolution {`
- line 111: `export function reduceManaCost(cost: string, reduction: string): string {`
- line 213: `export function solvePayment(pool: ManaPool, cost: ParsedCost, xValue: number): PaymentSolution {`

## `src/engine/manaTransaction.ts`

- line 19: `export type ManaAbilityTransactionEvent = ActivatedManaAbilityEvent | ManaAddedEvent;`
- line 21: `export interface ManaAbilityTransactionInput {`
- line 28: `export type ManaAbilityTransactionLogEntry =`
- line 52: `export interface ManaAbilityTransactionResult {`
- line 79: `export function resolveManaAbilityTransaction(`
- line 215: `export function collectTriggeredManaAbilities(`
- line 264: `export function triggeredManaAbilityPlan(`

## `src/engine/priority.ts`

- line 6: `export const DEFAULT_TURN_ORDER: readonly PlayerId[] = ['P1', 'OPPONENT_A'];`
- line 7: `export const TRIGGER_STACK_PLACEMENT_BUCKETS: readonly TriggerStackPlacementBucket[] = [`
- line 12: `export interface OrderedPendingTriggers {`
- line 17: `export interface IncompletePendingTriggerOrder {`
- line 25: `export type PendingTriggerOrderResult = OrderedPendingTriggers | IncompletePendingTriggerOrder;`
- line 27: `export interface ManualPendingTriggerOrderRequired {`
- line 37: `export interface PriorityReadyResult {`
- line 43: `export interface PriorityChoiceRequiredResult {`
- line 49: `export interface PriorityTriggerOrderRequiredResult {`
- line 56: `export type PriorityBoundaryResult =`
- line 61: `export interface AdvanceToPriorityOptions {`
- line 66: `export function apnapPlayerOrder(`
- line 77: `export function triggerStackPlacementBucketOf(`
- line 91: `export function orderPendingTriggersApnap(`
- line 161: `export function deterministicPendingTriggerOrderForPriority(`
- line 297: `export function placePendingTriggersOnStackAsBatch(`
- line 318: `export function advanceToPriority(`

## `src/engine/random.ts`

- line 5: `export function createRng(seed: number): () => number {`
- line 19: `export function shuffledOrder(ids: string[], rng: () => number): string[] {`

## `src/engine/sagaGrammar.ts`

- line 9: `export interface ChapterAbility {`
- line 34: `export function numberToRoman(n: number): string {`
- line 54: `export function parseSagaChapters(oracleText: string | undefined | null): ChapterAbility[] {`
- line 94: `export function finalChapterNumber(abilities: ChapterAbility[]): number {`

## `src/engine/scenario.ts`

- line 10: `export const SCENARIO_CARD_TYPES = [`
- line 18: `export type ScenarioCardType = (typeof SCENARIO_CARD_TYPES)[number];`
- line 20: `export interface ScenarioPermanentDraft {`
- line 33: `export interface OpponentSetupDraft {`
- line 69: `export function opponentSetupFingerprint(state: GameState, playerId: PlayerId): string {`
- line 104: `export function opponentSetupDraftFromState(`
- line 203: `export function compileOpponentSetupCommands(`
- line 294: `export function emptyScenarioPermanent(draftId: string): ScenarioPermanentDraft {`

## `src/engine/status.ts`

- line 8: `export type Keyword =`
- line 24: `export const STATUS_KEYWORDS: readonly Keyword[] = [`
- line 46: `export function isKeyword(value: string): value is Keyword {`
- line 51: `export function classLevelOf(state: GameState, cardId: string): number {`
- line 55: `export function normalizeKeywords(values: readonly unknown[] | undefined): Keyword[] {`
- line 264: `export interface FetchAbility {`
- line 367: `export function fetchAbility(def: CardDef | undefined): FetchAbility | null {`
- line 396: `export function fetchEntersTapped(`
- line 411: `export function keywords(def: CardDef | undefined): Keyword[] {`
- line 451: `export function effectiveKeywords(state: GameState, cardId: string): Keyword[] {`
- line 504: `export function effectiveTypeLine(state: GameState, cardId: string): string {`
- line 538: `export function graveyardToExileReplacementActive(state: GameState, ownerId: PlayerId): boolean {`
- line 558: `export function hasVigilance(state: GameState, cardId: string): boolean {`
- line 564: `export function landEntersTapped(def: CardDef | undefined): 'always' | 'never' | 'conditional' {`
- line 586: `export interface CyclingInfo {`
- line 600: `export function cyclingInfo(def: CardDef | undefined): CyclingInfo | null {`
- line 618: `export function cyclingCost(def: CardDef | undefined): string | null {`
- line 622: `export function effectivePower(state: GameState, cardId: string): number {`
- line 632: `export function isSummoningSick(state: GameState, cardId: string): boolean {`

## `src/engine/triggerCondition.ts`

- line 4: `export type TriggerWord = 'when' | 'whenever' | 'at';`
- line 6: `export interface ParsedTriggerConditionLine {`
- line 134: `export function parseTriggerConditionLine(`
- line 215: `export function parseTriggerConditionLines(`

## `src/engine/triggers.ts`

- line 49: `export interface TriggerCandidate {`
- line 223: `export function abilityLineIndexForKind(`
- line 375: `export function detectTriggerCandidates(`
- line 536: `export function detectAttackTriggerCandidates(`
- line 673: `export function delayedPhaseBeginScheduleForText(`
- line 681: `export function hasDelayedPhaseBeginTiming(text: string): boolean {`
- line 685: `export interface DelayedPhaseBeginTextSplit {`
- line 690: `export function splitDelayedPhaseBeginText(text: string): DelayedPhaseBeginTextSplit | null {`
- line 713: `export function makeScheduledDelayedTrigger(`
- line 750: `export function isPendingTriggerReady(trigger: PendingTrigger): boolean {`
- line 754: `export function readyPendingTriggers(pendingTriggers: readonly PendingTrigger[]): PendingTrigger[] {`
- line 766: `export function promoteDueScheduledTriggers(state: GameState): GameState {`
- line 1428: `export function triggerConditionSatisfied(state: GameState, condition: TriggerCondition): boolean {`
- line 1944: `export function collectPendingTriggers(prev: GameState, next: GameState): PendingTrigger[] {`
- line 1948: `export function collectPendingTriggerUpdate(`
- line 1969: `export function triggerCandidatesFromPendingTriggers(`

## `src/engine/types.ts`

- line 3: `export type ZoneId =`
- line 12: `export type PrivateZoneId = 'library' | 'hand' | 'graveyard';`
- line 13: `export type ManualTargetZone = Exclude<ZoneId, 'library'>;`
- line 15: `export type AbilityKind = 'activated' | 'triggered';`
- line 17: `export type Phase = 'untap' | 'upkeep' | 'draw' | 'main1' | 'combat' | 'main2' | 'end' | 'cleanup';`
- line 19: `export const PHASE_ORDER: Phase[] = ['untap', 'upkeep', 'draw', 'main1', 'combat', 'main2', 'end', 'cleanup'];`
- line 21: `export interface ManaPool {`
- line 30: `export interface CardInstance {`
- line 80: `export function objectIdOf(card: Pick<CardInstance, 'id' | 'zoneChangeCounter'>): string {`
- line 84: `export type PlayerId = string;`
- line 85: `export const LOCAL_PLAYER_ID = 'P1';`
- line 86: `export const DEFAULT_OPPONENT_ID = 'OPPONENT_A';`
- line 87: `export const DEFAULT_OPPONENT_LIFE_LABEL = '対戦相手A';`
- line 88: `export const PLAYER_IDS: readonly PlayerId[] = ['P1', 'OPPONENT_A'];`
- line 89: `export const PRIVATE_ZONE_IDS: readonly PrivateZoneId[] = ['library', 'hand', 'graveyard'];`
- line 91: `export class EngineError extends Error {`
- line 98: `export interface PlayerPrivateZones {`
- line 104: `export type ZonesByPlayer = Record<PlayerId, PlayerPrivateZones>;`
- line 105: `export type PhysicalCardId = string;`
- line 106: `export type ObjectId = string;`
- line 108: `export type CombatStep =`
- line 115: `export type CombatTarget =`
- line 119: `export interface CombatAttacker {`
- line 128: `export interface CombatBlocker {`
- line 136: `export interface CombatState {`
- line 146: `export interface ObjectSnapshot {`
- line 165: `export type LinkedExilePurpose = 'exiled-with-source' | 'temporary-return';`
- line 167: `export interface LinkedExileRecord {`
- line 178: `export interface LinkedExileWrite {`
- line 185: `export type TargetSelectionKind = 'object' | 'player' | 'object-or-player';`
- line 186: `export type TargetSelectionLegalityMode = 'checked' | 'unchecked-warning' | 'forced';`
- line 187: `export type ManualTargetPlayerId = PlayerId;`
- line 189: `export type TargetSelectionRef =`
- line 201: `export interface TargetSelection {`
- line 209: `export type ActivationPaymentMode = 'rules-legal' | 'forced';`
- line 210: `export type ActivationStackPolicy = 'stack' | 'mana-transaction-no-stack';`
- line 212: `export interface ActivationSourceRef {`
- line 218: `export type ActivationCostComponentKind =`
- line 228: `export type ActivationCostComponentStatus = 'auto' | 'guided' | 'manual' | 'unparsed';`
- line 230: `export interface ActivationCostComponent {`
- line 243: `export interface ActivationEnvelope {`
- line 252: `export type ZoneChangeReason =`
- line 266: `export interface ZoneChangeEvent {`
- line 284: `export type KnownEventKind =`
- line 291: `export type NewEnvelopeEventKind = 'damage' | 'lifeChange' | 'draw';`
- line 293: `export type EventCause =`
- line 298: `export type EventDeterminismRef =`
- line 302: `export interface EventEnvelopeBase<T extends NewEnvelopeEventKind = NewEnvelopeEventKind> {`
- line 319: `export type EventSourceRef =`
- line 330: `export type EventTargetRef =`
- line 340: `export interface LifeChangeEvent extends EventEnvelopeBase<'lifeChange'> {`
- line 357: `export interface DamageEvent extends EventEnvelopeBase<'damage'> {`
- line 371: `export interface DrawEvent extends EventEnvelopeBase<'draw'> {`
- line 387: `export interface AttackDeclarationEvent {`
- line 411: `export interface CounterChangeEvent {`
- line 432: `export interface AbilityTriggeredEvent {`
- line 442: `export interface ActivatedManaAbilityEvent {`
- line 453: `export interface ManaAddedEvent {`
- line 464: `export type DefeatReason = 'lifeZero' | 'emptyLibraryDraw' | 'poison' | 'commanderDamage';`
- line 465: `export type DefeatRuleRef = '704.5a' | '704.5b' | '704.5c' | '903.10a';`
- line 466: `export type DefeatPlayerRef = 'P1' | `opponent:${string}`;`
- line 468: `export interface DefeatAdvisoryRecord {`
- line 474: `export interface DefeatAdvisoryEvent {`
- line 496: `export interface DungeonRoom {`
- line 503: `export interface DungeonDef {`
- line 511: `export interface DungeonState {`
- line 518: `export interface VentureEvent {`
- line 542: `export type GameEvent =`
- line 552: `export type TriggerStackPlacementBucket = 'ordinary' | 'ability-triggered';`
- line 554: `export interface PendingTriggerSchedule {`
- line 563: `export type TriggerCondition =`
- line 574: `export interface PendingTrigger {`
- line 593: `export interface OncePerTurnTriggerLedger {`
- line 598: `export interface PendingManaTrigger {`
- line 610: `export interface CommanderZoneRuleChoice {`
- line 622: `export interface LegendRuleChoice {`
- line 631: `export interface CleanupDiscardRuleChoice {`
- line 640: `export type PendingRuleChoice = CommanderZoneRuleChoice | LegendRuleChoice | CleanupDiscardRuleChoice;`
- line 642: `export type PendingSbaChoice = CommanderZoneRuleChoice;`
- line 644: `export type RuleChoiceSelection =`
- line 649: `export interface CommanderInfo {`
- line 654: `export interface LogEntry {`
- line 661: `export interface PlayerState {`
- line 676: `export interface GameState {`
- line 716: `export function emptyPlayerPrivateZones(): PlayerPrivateZones {`
- line 720: `export function clonePlayerPrivateZones(`
- line 730: `export function cloneZonesByPlayer(`
- line 742: `export function playerPrivateZonesFromFlatZones(`
- line 752: `export function zonesByPlayerWithP1Mirror(`
- line 762: `export function syncP1ZonesByPlayerFromFlatZones(state: GameState): GameState {`
- line 772: `export function syncFlatPrivateZonesFromPlayers(state: GameState): GameState {`
- line 785: `export function requirePlayer(state: GameState, id: PlayerId): PlayerState {`
- line 793: `export function playerIdForLifeLabel(label: string): PlayerId {`
- line 799: `export function defeatPlayerRefForLifeLabel(label: string): DefeatPlayerRef {`
- line 825: `export function syncPlayersFromLegacyScalars(state: GameState): GameState {`
- line 886: `export function syncDerivedViews(state: DerivedViewsInput): GameState {`

## `src/store/gameStore.ts`

- line 146: `export type { TriggerCandidate } from '../engine/triggers';`
- line 148: `export interface PendingActivation {`
- line 162: `export interface PendingManaAbility {`
- line 181: `export interface PendingForceActivation {`
- line 189: `export interface ActivateAbilityOptions {`
- line 195: `export interface PendingGuidedResolution {`
- line 214: `export interface PendingCastTransaction {`
- line 230: `export interface ResolutionTask {`
- line 235: `export interface ResolutionSession {`
- line 246: `export interface PendingCommanderResolution {`
- line 257: `export function guidedControllerId(`
- line 954: `export interface GameStore {`
- line 1672: `export function freeMulliganBottomCount(mulliganCount: number): number {`
- line 1676: `export const useGameStore = create<GameStore>((set, get) => {`
- line 5679: `export function disableSnapshotPersistenceForDevelopment(): void {`
