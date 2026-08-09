import type {
  CoreCardDefinitionRecordV1,
  CorePhysicalCardRecordV1,
} from "../cardDefinition";
import type {
  CoreCardObjectRuntimeStateV1,
} from "../runtime/cardRuntimeState";
import type {
  CoreCardObjectIdentityV1,
  CorePlayerStateV1,
  CoreZonesV1,
  ModeNeutralCoreIdentityZoneSliceV1,
} from "../identityZoneState";
import type {
  CoreCardDefinitionId,
  CoreObjectId,
  CorePhysicalCardId,
  CorePlayerId,
} from "../ids";
import {
  validateModeNeutralCoreObjectRegistryStateV2,
  validateModeNeutralCoreObjectRuntimeStateV2,
  CoreObjectRegistryCreationErrorV2,
  CoreObjectRuntimeCreationErrorV2,
} from "./objectRegistryValidationV2";
import type {
  CoreGameObjectIdentityV2,
} from "./tokenObjectV2";

export {
  CoreObjectRegistryCreationErrorV2,
  CoreObjectRuntimeCreationErrorV2,
} from "./objectRegistryValidationV2";

export type {
  CoreCardDefinitionId,
  CoreObjectId,
  CorePhysicalCardId,
  CorePlayerId,
};
export type {
  CoreCardObjectIdentityV2,
  CoreGameObjectIdentityV2,
  CoreTokenObjectIdentityV2,
  CoreSpellCopyObjectIdentityV2,
  CoreActivatedAbilityObjectIdentityV2,
  CoreTriggeredAbilityObjectIdentityV2,
  CoreTokenOriginV2,
} from "./tokenObjectV2";

export interface ModeNeutralCoreObjectRegistryStateV2 {
  readonly kind: "mode-neutral-core-object-registry-slice-v2";
  readonly players: Readonly<Record<CorePlayerId, CorePlayerStateV1>>;
  readonly turnOrder: readonly CorePlayerId[];
  readonly activePlayerId: CorePlayerId;
  readonly cardDefinitions: CoreCardDefinitionRecordV1;
  readonly physicalCards: CorePhysicalCardRecordV1;
  readonly objects: Readonly<Record<CoreObjectId, CoreGameObjectIdentityV2>>;
  readonly zones: CoreZonesV1;
}

export type CoreObjectRegistryStateV2 = ModeNeutralCoreObjectRegistryStateV2;
export type ModeNeutralCoreObjectRegistrySliceV2 = ModeNeutralCoreObjectRegistryStateV2;

export interface CreateModeNeutralCoreObjectRegistryStateV2Input {
  readonly players: Readonly<Record<CorePlayerId, CorePlayerStateV1>>;
  readonly turnOrder: readonly CorePlayerId[];
  readonly activePlayerId: CorePlayerId;
  readonly cardDefinitions: CoreCardDefinitionRecordV1;
  readonly physicalCards: CorePhysicalCardRecordV1;
  readonly objects: Readonly<Record<CoreObjectId, CoreGameObjectIdentityV2>>;
  readonly zones: CoreZonesV1;
}

export type CreateCoreObjectRegistryStateV2Input =
  CreateModeNeutralCoreObjectRegistryStateV2Input;
export type CreateModeNeutralCoreObjectRegistrySliceV2Input =
  CreateModeNeutralCoreObjectRegistryStateV2Input;

export interface ModeNeutralCoreObjectRuntimeStateV2 {
  readonly kind: "mode-neutral-core-object-runtime-slice-v2";
  readonly byObject: Readonly<
    Record<CoreObjectId, CoreCardObjectRuntimeStateV1>
  >;
}

export type CoreObjectRuntimeStateV2 = ModeNeutralCoreObjectRuntimeStateV2;
export type ModeNeutralCoreObjectRuntimeSliceV2 = ModeNeutralCoreObjectRuntimeStateV2;

export interface CreateModeNeutralCoreObjectRuntimeStateV2Input {
  readonly byObject: Readonly<
    Record<CoreObjectId, CoreCardObjectRuntimeStateV1>
  >;
}

export type CreateCoreObjectRuntimeStateV2Input =
  CreateModeNeutralCoreObjectRuntimeStateV2Input;
export type CreateModeNeutralCoreObjectRuntimeSliceV2Input =
  CreateModeNeutralCoreObjectRuntimeStateV2Input;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  try {
    const prototype = Reflect.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function factoryCandidate(input: unknown, kind: string): unknown {
  if (!isPlainRecord(input)) return input;
  const candidate = Object.create(null) as Record<string | symbol, unknown>;
  for (const key of Reflect.ownKeys(input)) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (descriptor !== undefined) Object.defineProperty(candidate, key, descriptor);
  }
  Object.defineProperty(candidate, "kind", {
    value: kind,
    enumerable: true,
    configurable: true,
    writable: true,
  });
  return candidate;
}

function factoryInputHasKind(input: unknown): boolean {
  if (!isPlainRecord(input)) return false;
  return Object.prototype.hasOwnProperty.call(input, "kind");
}

function kindIssue(path: "/kind"): {
  readonly code: "UNKNOWN_FIELD";
  readonly path: "/kind";
  readonly message: string;
} {
  return {
    code: "UNKNOWN_FIELD",
    path,
    message: "Factory input must omit kind",
  };
}

export function createModeNeutralCoreObjectRegistryStateV2(
  input: CreateModeNeutralCoreObjectRegistryStateV2Input,
): ModeNeutralCoreObjectRegistryStateV2 {
  if (factoryInputHasKind(input)) {
    throw new CoreObjectRegistryCreationErrorV2([kindIssue("/kind")]);
  }
  const result = validateModeNeutralCoreObjectRegistryStateV2(
    factoryCandidate(input, "mode-neutral-core-object-registry-slice-v2"),
  );
  if (!result.ok) throw new CoreObjectRegistryCreationErrorV2(result.issues);
  return result.value;
}

export const createCoreObjectRegistryStateV2 =
  createModeNeutralCoreObjectRegistryStateV2;
export const createModeNeutralCoreObjectRegistrySliceV2 =
  createModeNeutralCoreObjectRegistryStateV2;

export function createModeNeutralCoreObjectRuntimeStateV2(
  identity: ModeNeutralCoreObjectRegistryStateV2,
  input: CreateModeNeutralCoreObjectRuntimeStateV2Input,
): ModeNeutralCoreObjectRuntimeStateV2 {
  if (factoryInputHasKind(input)) {
    throw new CoreObjectRuntimeCreationErrorV2([kindIssue("/kind")]);
  }
  const result = validateModeNeutralCoreObjectRuntimeStateV2(
    identity,
    factoryCandidate(input, "mode-neutral-core-object-runtime-slice-v2"),
  );
  if (!result.ok) throw new CoreObjectRuntimeCreationErrorV2(result.issues);
  return result.value;
}

export const createCoreObjectRuntimeStateV2 =
  createModeNeutralCoreObjectRuntimeStateV2;
export const createModeNeutralCoreObjectRuntimeSliceV2 =
  createModeNeutralCoreObjectRuntimeStateV2;

export type {
  CoreCardObjectIdentityV1,
  ModeNeutralCoreIdentityZoneSliceV1,
};

