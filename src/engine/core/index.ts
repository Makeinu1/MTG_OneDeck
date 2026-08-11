export { coreCardObjectIdOf } from './ids';
export type { CoreCardDefinitionId, CoreObjectId, CorePhysicalCardId, CorePlayerId } from './ids';

export type {
  CoreCardDefinitionRecordV1,
  CoreCardDefinitionSnapshotV1,
  CoreCardDefinitionSourceV1,
  CoreCardFaceSnapshotV1,
  CoreColorIdentityV1,
  CoreManaColorV1,
  CorePhysicalCardRecordV1,
  CorePhysicalCardV1,
  CoreTokenKindV1,
} from './cardDefinition';

export {
  coreZoneInformationClassOf,
  coreZoneScopeOf,
  createModeNeutralCoreIdentityZoneSliceV1,
  locateCoreObjectV1,
} from './identityZoneState';
export type {
  CoreCardObjectIdentityV1,
  CoreManaPoolV1,
  CoreObjectLocationV1,
  CorePlayerScopedLocationV1,
  CorePlayerScopedZoneIdV1,
  CorePlayerStateV1,
  CorePlayerZonesV1,
  CoreSharedLocationV1,
  CoreSharedZoneIdV1,
  CoreSharedZonesV1,
  CoreZoneIdV1,
  CoreZoneInformationClassV1,
  CoreZonesV1,
  CoreZoneScopeV1,
  CreateModeNeutralCoreIdentityZoneSliceV1Input,
  ModeNeutralCoreIdentityZoneSliceV1,
} from './identityZoneState';

export {
  CoreIdentityZoneCreationError,
  validateModeNeutralCoreIdentityZoneSliceV1,
} from './identityZoneValidation';
export type {
  CoreIdentityZoneValidationCode,
  CoreIdentityZoneValidationIssue,
  CoreIdentityZoneValidationResult,
} from './identityZoneValidation';

export {
  CoreCardOrientationCreationError,
  createCoreCardOrientationStateV1,
  validateCoreCardOrientationStateV1,
  CoreCounterDamageCreationError,
  createCoreCounterDamageStateV1,
  validateCoreCounterDamageStateV1,
  CoreAttachmentCreationError,
  createCoreAttachmentStateV1,
  isCanonicalCoreObjectIdV1,
  validateCoreAttachmentStateV1,
  createModeNeutralCoreCardRuntimeSliceV1,
  CoreCardRuntimeCreationError,
  validateModeNeutralCoreCardRuntimeSliceV1,
} from './runtime';

export {
  canonicalizeCoreGameObjectIdentityV2,
  canonicalizeCoreObjectRegistryStateV2,
  canonicalizeCoreObjectRuntimeStateV2,
  canonicalizeModeNeutralCoreObjectRegistrySliceV2,
  canonicalizeModeNeutralCoreObjectRegistryStateV2,
  canonicalizeModeNeutralCoreObjectRuntimeSliceV2,
  canonicalizeModeNeutralCoreObjectRuntimeStateV2,
  coreActivatedAbilityObjectIdOfV2,
  coreSpellCopyObjectIdOfV2,
  coreTokenObjectIdOfV2,
  coreTriggeredAbilityObjectIdOfV2,
  createCoreActivatedAbilityObjectIdentityV2,
  createCoreCardObjectIdentityV2,
  createCoreGameObjectIdentityV2,
  createCoreObjectRegistryStateV2,
  createCoreObjectRuntimeStateV2,
  createCoreSpellCopyObjectIdentityV2,
  createCoreTokenObjectIdentityV2,
  createCoreTriggeredAbilityObjectIdentityV2,
  createModeNeutralCoreObjectRegistrySliceV2,
  createModeNeutralCoreObjectRegistryStateV2,
  createModeNeutralCoreObjectRuntimeSliceV2,
  createModeNeutralCoreObjectRuntimeStateV2,
  isCanonicalCoreAbilityKeyV2,
  isCanonicalCoreObjectIdV2,
  isCoreGameObjectIdentityV2,
  parseCoreObjectIdV2,
  upgradeModeNeutralCoreCardRuntimeSliceV1ToObjectRuntimeV2,
  upgradeModeNeutralCoreIdentityZoneSliceV1ToObjectRegistryV2,
  validateCoreGameObjectIdentityV2,
  validateCoreObjectRegistryStateV2,
  validateCoreObjectRuntimeStateV2,
  validateModeNeutralCoreObjectRegistrySliceV2,
  validateModeNeutralCoreObjectRuntimeSliceV2,
} from './object';
export type {
  CoreActivatedAbilityObjectIdentityV2,
  CoreCardObjectIdentityV2,
  CoreGameObjectIdentityV2,
  CoreObjectIdKindV2,
  CoreObjectRegistryStateV2,
  CoreObjectRegistryValidationCode,
  CoreObjectRegistryValidationIssue,
  CoreObjectRegistryValidationResult,
  CoreObjectRuntimeStateV2,
  CoreObjectRuntimeValidationCode,
  CoreObjectRuntimeValidationIssue,
  CoreObjectRuntimeValidationResult,
  CoreSpellCopyObjectIdentityV2,
  CoreTokenObjectIdentityV2,
  CoreTokenOriginV2,
  CoreTriggeredAbilityObjectIdentityV2,
  CreateModeNeutralCoreObjectRegistrySliceV2Input,
  CreateModeNeutralCoreObjectRuntimeSliceV2Input,
  ModeNeutralCoreObjectRegistrySliceV2,
  ModeNeutralCoreObjectRuntimeSliceV2,
  ParsedCoreObjectIdV2,
} from './object';
export type {
  CoreCardOrientationStateV1,
  CoreCardOrientationValidationCode,
  CoreCardOrientationValidationIssue,
  CoreCardOrientationValidationResult,
  CoreCounterDamageStateV1,
  CoreCounterDamageValidationCode,
  CoreCounterDamageValidationIssue,
  CoreCounterDamageValidationResult,
  CoreCounterEntryV1,
  CoreAttachmentStateV1,
  CoreAttachmentTargetV1,
  CoreAttachmentValidationCode,
  CoreAttachmentValidationIssue,
  CoreAttachmentValidationResult,
  CoreCardObjectRuntimeStateV1,
  CreateModeNeutralCoreCardRuntimeSliceV1Input,
  ModeNeutralCoreCardRuntimeSliceV1,
  CoreCardRuntimeValidationCode,
  CoreCardRuntimeValidationIssue,
  CoreCardRuntimeValidationResult,
} from './runtime';

export {
  CoreStackAnnouncementCreationError,
  createModeNeutralCoreStackAnnouncementSliceV1,
  validateModeNeutralCoreStackAnnouncementSliceV1,
} from './stack';
export type {
  CoreStackAlternativeCostChoiceV1,
  CoreStackAdditionalCostChoiceV1,
  CoreStackAnnouncementRecordV1,
  CoreStackAnnouncementValidationCode,
  CoreStackAnnouncementValidationIssue,
  CoreStackAnnouncementValidationResult,
  CoreStackChoiceKeyV1,
  CoreStackCostChoiceSetV1,
  CoreStackDistributionAssignmentV1,
  CoreStackDistributionAnnouncementV1,
  CoreStackTargetRefV1,
  CoreStackTargetSelectionV1,
  CoreStackVariableAnnouncementV1,
  CreateModeNeutralCoreStackAnnouncementSliceV1Input,
  ModeNeutralCoreStackAnnouncementSliceV1,
} from './stack';

export * from './stack/transaction';

export * from './turn';

export * from './rules';

export {
  CoreCommanderReplacementChoiceCreationErrorV1,
  createCoreCommanderReplacementChoiceV1,
} from './commander/commanderReplacementV1';
export type {
  CoreCommanderReplacementChoiceV1,
  CoreCommanderReplacementKindV1,
  CoreCommanderReplacementSourceZoneV1,
  CoreCommanderReplacementValidationCodeV1,
  CoreCommanderReplacementValidationIssueV1,
} from './commander/commanderReplacementV1';

export {
  CoreCommanderIdentityCreationErrorV1,
  createCoreCommanderIdentityV1,
} from './commander/commanderIdentityV1';
export type {
  CoreCommanderIdentityV1,
  CoreCommanderIdentityValidationCodeV1,
  CoreCommanderIdentityValidationIssueV1,
} from './commander/commanderIdentityV1';

export {
  CoreCommanderCastLedgerCreationErrorV1,
  CoreCommanderCastRecordingErrorV1,
  coreCommanderTaxV1,
  createCoreCommanderCastLedgerV1,
  recordCoreCommanderCastV1,
} from './commander/commanderTaxV1';
export type {
  CoreCommanderCastAttemptV1,
  CoreCommanderCastLedgerV1,
  CoreCommanderCastLedgerValidationIssueV1,
  CoreCommanderCastOriginV1,
} from './commander/commanderTaxV1';

export {
  CoreCommanderDamageCreationErrorV1,
  CoreCommanderDamageRecordingErrorV1,
  coreCommanderDamageAgainstV1,
  createCoreCommanderDamageStateV1,
  recordCoreCommanderDamageV1,
} from './commander/commanderDamageV1';
export type {
  CoreCommanderDamageEntryV1,
  CoreCommanderDamageStateV1,
  CoreCommanderDamageValidationCodeV1,
  CoreCommanderDamageValidationIssueV1,
} from './commander/commanderDamageV1';

export {
  CoreCommanderProvenanceCreationErrorV1,
  CoreCommanderProvenanceRecordingErrorV1,
  CoreCommanderProvenanceQueryErrorV1,
  coreCommanderProvenanceDamageAgainstV1,
  coreCommanderThresholdReachedFromProvenanceV1,
  createCoreCommanderDamageProvenanceLedgerV1,
  recordCoreCommanderDamageProvenanceV1,
} from './commander/commanderDamageProvenanceV1';
export type {
  CoreCommanderDamageProvenanceLedgerV1,
  CoreCommanderDamageProvenanceRecordV1,
  CoreCommanderProvenanceValidationCodeV1,
  CoreCommanderProvenanceValidationIssueV1,
} from './commander/commanderDamageProvenanceV1';

export {
  CoreCombatContextAdditionErrorV1,
  CoreCombatContextCreationErrorV1,
  CoreCombatContextReconciliationErrorV1,
  CoreCombatContextStepErrorV1,
  addCoreCombatContextAttackV1,
  addCoreCombatContextBlockV1,
  createCoreCombatContextV1,
  reconcileCoreCombatContextForPlayerExitV1,
  setCoreCombatContextStepV1,
} from './combat/combatContextV1';
export type {
  CoreCombatContextAttackV1,
  CoreCombatContextBlockV1,
  CoreCombatContextStepV1,
  CoreCombatContextV1,
  CoreCombatContextValidationCodeV1,
  CoreCombatContextValidationIssueV1,
} from './combat/combatContextV1';

export {
  CorePlayerLifecycleErrorV1,
  applyCorePlayerExitV1,
  corePlayerLifecycleStatusV1,
  corePlayerLifecycleExitCauseV1,
  createCorePlayerLifecycleStateV1,
} from './player-lifecycle/playerLifecycleV1';
export type {
  CorePlayerExitCauseV1,
  CorePlayerExitRequestV1,
  CorePlayerLifecycleEntryV1,
  CorePlayerLifecycleIssueCodeV1,
  CorePlayerLifecycleIssueV1,
  CorePlayerLifecycleStateV1,
  CorePlayerLifecycleStatusV1,
} from './player-lifecycle/playerLifecycleV1';

export {
  CorePlayerExitReconciliationErrorV1,
  createCorePlayerExitReferenceBundleV1,
  reconcileCorePlayerExitV1,
} from './player-lifecycle/playerExitReconciliationV1';

export * from './closure';
export type {
  CorePlayerExitReconciliationResultV1,
  CorePlayerExitReconciliationIssueCodeV1,
  CorePlayerExitReconciliationIssueV1,
  CorePlayerExitReferenceBundleV1,
  CorePlayerExitReferenceIdV1,
} from './player-lifecycle/playerExitReconciliationV1';
