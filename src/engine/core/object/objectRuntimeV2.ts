/**
 * Public additive V2 runtime surface.
 *
 * The canonical implementation lives beside the registry validator so the
 * identity/runtime cross-invariant is checked in one place. This module is
 * the runtime-only import boundary used by later integration work.
 */

export type {
  CoreObjectRuntimeStateV2,
  CreateCoreObjectRuntimeStateV2Input,
  CreateModeNeutralCoreObjectRuntimeSliceV2Input,
  CreateModeNeutralCoreObjectRuntimeStateV2Input,
  ModeNeutralCoreObjectRuntimeSliceV2,
  ModeNeutralCoreObjectRuntimeStateV2,
} from "./objectRegistryStateV2";

export {
  createCoreObjectRuntimeStateV2,
  createModeNeutralCoreObjectRuntimeSliceV2,
  createModeNeutralCoreObjectRuntimeStateV2,
} from "./objectRegistryStateV2";

export {
  validateCoreObjectRuntimeStateV2,
  validateCoreObjectRuntimeV2,
  validateModeNeutralCoreObjectRuntimeSliceV2,
  validateModeNeutralCoreObjectRuntimeStateV2,
} from "./objectRegistryValidationV2";

export {
  canonicalizeCoreObjectRuntimeStateV2,
  canonicalizeModeNeutralCoreObjectRuntimeSliceV2,
  canonicalizeModeNeutralCoreObjectRuntimeStateV2,
  upgradeModeNeutralCoreCardRuntimeSliceV1ToObjectRuntimeStateV2,
  upgradeModeNeutralCoreCardRuntimeSliceV1ToObjectRuntimeV2,
  upgradeModeNeutralCoreIdentityZoneSliceV1ToObjectRegistryStateV2,
  upgradeModeNeutralCoreIdentityZoneSliceV1ToObjectRegistryV2,
} from "./objectRegistryCanonicalizationV2";

export type {
  CoreObjectRuntimeCreationErrorV2,
  CoreObjectRuntimeValidationCode,
  CoreObjectRuntimeValidationIssue,
  CoreObjectRuntimeValidationIssueV2,
  CoreObjectRuntimeValidationResult,
  CoreObjectRuntimeValidationResultV2,
} from "./objectRegistryValidationV2";
