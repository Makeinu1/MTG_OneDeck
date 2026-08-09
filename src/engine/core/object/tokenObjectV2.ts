/**
 * Additive, local V2 identity primitives for non-card objects.
 *
 * This module deliberately has no registry, runtime, command, or allocator
 * dependency. Callers provide every seed and incarnation explicitly.
 */

import {
  isCoreBaseId,
  isCoreSafeIncarnation,
} from "../ids";
import type {
  CoreCardDefinitionId,
  CoreObjectId,
  CorePhysicalCardId,
  CorePlayerId,
} from "../ids";
import {
  coreActivatedAbilityObjectIdOfV2,
  coreSpellCopyObjectIdOfV2,
  coreTokenObjectIdOfV2,
  coreTriggeredAbilityObjectIdOfV2,
  isCanonicalCoreObjectIdV2,
  parseCoreObjectIdV2,
} from "./objectIdV2";
import type {
  CoreObjectIdKindV2,
} from "./objectIdV2";

export type {
  CoreCardDefinitionId,
  CoreObjectId,
  CorePhysicalCardId,
  CorePlayerId,
} from "../ids";
export {
  coreActivatedAbilityObjectIdOfV2,
  coreSpellCopyObjectIdOfV2,
  coreTokenObjectIdOfV2,
  coreTriggeredAbilityObjectIdOfV2,
  isCanonicalCoreObjectIdV2,
  parseCoreObjectIdV2,
};
export type { CoreObjectIdKindV2, ParsedCoreObjectIdV2 } from "./objectIdV2";

const CORE_OBJECT_ID_KINDS_V2: readonly CoreObjectIdKindV2[] = Object.freeze([
  "card",
  "token",
  "spell-copy",
  "activated-ability",
  "triggered-ability",
]);

export type CoreTokenOriginV2 =
  | Readonly<{
      kind: "created";
      sourceObjectId: CoreObjectId | null;
    }>
  | Readonly<{
      kind: "copy";
      sourceObjectId: CoreObjectId;
    }>;

export type CoreCardObjectIdentityV2 = Readonly<{
  kind: "card";
  physicalCardId: CorePhysicalCardId;
  incarnation: number;
  baseControllerPlayerId: CorePlayerId | null;
}>;

export type CoreTokenObjectIdentityV2 = Readonly<{
  kind: "token";
  definitionId: CoreCardDefinitionId;
  ownerPlayerId: CorePlayerId;
  incarnation: number;
  baseControllerPlayerId: CorePlayerId;
  origin: CoreTokenOriginV2;
}>;

export type CoreSpellCopyObjectIdentityV2 = Readonly<{
  kind: "spell-copy";
  definitionId: CoreCardDefinitionId;
  controllerPlayerId: CorePlayerId;
  copiedFromObjectId: CoreObjectId;
}>;

export type CoreActivatedAbilityObjectIdentityV2 = Readonly<{
  kind: "activated-ability";
  controllerPlayerId: CorePlayerId;
  sourceObjectId: CoreObjectId | null;
  abilityKey: string;
}>;

export type CoreTriggeredAbilityObjectIdentityV2 = Readonly<{
  kind: "triggered-ability";
  controllerPlayerId: CorePlayerId;
  sourceObjectId: CoreObjectId | null;
  abilityKey: string;
}>;

export type CoreGameObjectIdentityV2 =
  | CoreCardObjectIdentityV2
  | CoreTokenObjectIdentityV2
  | CoreSpellCopyObjectIdentityV2
  | CoreActivatedAbilityObjectIdentityV2
  | CoreTriggeredAbilityObjectIdentityV2;

export interface CoreValidationIssueV2 {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export type CoreValidationResultV2<T> =
  | Readonly<{
      ok: true;
      value: T;
    }>
  | Readonly<{
      ok: false;
      issues: readonly CoreValidationIssueV2[];
    }>;

function isCoreObjectIdKindV2(value: unknown): value is CoreObjectIdKindV2 {
  return (
    typeof value === "string" &&
    (CORE_OBJECT_ID_KINDS_V2 as readonly string[]).includes(value)
  );
}

function isCanonicalIncarnation(value: unknown): value is number {
  return isCoreSafeIncarnation(value) && !Object.is(value, -0);
}

function invalidFactoryInput(message: string): never {
  throw new TypeError(message);
}

type DataRecord = Record<string, unknown>;

function makeIssue(
  path: string,
  code: string,
  message: string,
): CoreValidationIssueV2 {
  return { path, code, message };
}

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sortIssues(issues: CoreValidationIssueV2[]): readonly CoreValidationIssueV2[] {
  const sorted = [...issues].sort((left, right) => {
    const pathOrder = compareCodeUnits(left.path, right.path);
    if (pathOrder !== 0) return pathOrder;
    const codeOrder = compareCodeUnits(left.code, right.code);
    if (codeOrder !== 0) return codeOrder;
    return compareCodeUnits(left.message, right.message);
  });
  return Object.freeze(sorted.map((issue) => Object.freeze({ ...issue })));
}

function inspectPlainRecord(
  value: unknown,
  path: string,
  issues: CoreValidationIssueV2[],
): DataRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    issues.push(makeIssue(path, "invalid-record", "expected a plain record"));
    return null;
  }

  let prototype: object | null;
  let descriptors: PropertyDescriptorMap;
  try {
    prototype = Object.getPrototypeOf(value) as object | null;
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    issues.push(makeIssue(path, "unsafe-record", "record descriptors are not readable"));
    return null;
  }

  if (prototype !== Object.prototype && prototype !== null) {
    issues.push(makeIssue(path, "invalid-record", "expected a plain record"));
  }

  const record = Object.create(null) as DataRecord;
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== "string") {
      issues.push(
        makeIssue(
          `${path}[symbol]`,
          "unknown-field",
          "symbol keys are not allowed",
        ),
      );
      continue;
    }

    if (key === "__proto__" || key === "prototype" || key === "constructor") {
      issues.push(makeIssue(`${path}.${key}`, "unsafe-key", "unsafe keys are not allowed"));
    }

    const descriptor = descriptors[key];
    if (descriptor.enumerable !== true) {
      issues.push(
        makeIssue(`${path}.${key}`, "non-enumerable", "fields must be enumerable"),
      );
    }
    if (descriptor.get !== undefined || descriptor.set !== undefined) {
      issues.push(makeIssue(`${path}.${key}`, "accessor", "accessor fields are not allowed"));
      continue;
    }

    record[key] = descriptor.value;
  }

  return record;
}

function validateExactKeys(
  record: DataRecord,
  expectedKeys: readonly string[],
  path: string,
  issues: CoreValidationIssueV2[],
): void {
  const expected = new Set(expectedKeys);
  for (const key of Object.keys(record)) {
    if (!expected.has(key)) {
      issues.push(makeIssue(`${path}.${key}`, "unknown-field", "unknown field"));
    }
  }
  for (const key of expectedKeys) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) {
      issues.push(makeIssue(`${path}.${key}`, "missing-field", "required field is missing"));
    }
  }
}

function validateBaseId<T extends string = string>(
  value: unknown,
  path: string,
  label: string,
  issues: CoreValidationIssueV2[],
): value is T {
  if (!isCoreBaseId(value)) {
    issues.push(
      makeIssue(
        path,
        "invalid-id",
        `${label} must be a canonical Core base ID`,
      ),
    );
    return false;
  }
  return true;
}

function validateObjectId(
  value: unknown,
  path: string,
  label: string,
  issues: CoreValidationIssueV2[],
): value is CoreObjectId {
  if (!isCanonicalCoreObjectIdV2(value)) {
    issues.push(
      makeIssue(path, "invalid-object-id", `${label} must be a canonical Core object ID`),
    );
    return false;
  }
  return true;
}

function validateIncarnation(
  value: unknown,
  path: string,
  issues: CoreValidationIssueV2[],
): value is number {
  if (!isCanonicalIncarnation(value)) {
    issues.push(
      makeIssue(
        path,
        "invalid-incarnation",
        "incarnation must be a non-negative safe integer",
      ),
    );
    return false;
  }
  return true;
}

function validateNullablePlayerId(
  value: unknown,
  path: string,
  issues: CoreValidationIssueV2[],
): value is CorePlayerId | null {
  if (value === null) return true;
  return validateBaseId<CorePlayerId>(value, path, "player ID", issues);
}

function validatePlayerId(
  value: unknown,
  path: string,
  issues: CoreValidationIssueV2[],
): value is CorePlayerId {
  return validateBaseId<CorePlayerId>(value, path, "player ID", issues);
}

function validateOrigin(
  value: unknown,
  path: string,
  issues: CoreValidationIssueV2[],
): CoreTokenOriginV2 | null {
  const origin = inspectPlainRecord(value, path, issues);
  if (origin === null) return null;

  validateExactKeys(origin, ["kind", "sourceObjectId"], path, issues);
  if (origin.kind === "created") {
    if (origin.sourceObjectId !== null) {
      validateObjectId(origin.sourceObjectId, `${path}.sourceObjectId`, "sourceObjectId", issues);
    }
    if (origin.sourceObjectId === null || isCanonicalCoreObjectIdV2(origin.sourceObjectId)) {
      return Object.freeze({
        kind: "created",
        sourceObjectId: origin.sourceObjectId,
      });
    }
    return null;
  }

  if (origin.kind === "copy") {
    if (validateObjectId(origin.sourceObjectId, `${path}.sourceObjectId`, "sourceObjectId", issues)) {
      return Object.freeze({ kind: "copy", sourceObjectId: origin.sourceObjectId });
    }
    return null;
  }

  issues.push(makeIssue(`${path}.kind`, "invalid-discriminant", "origin kind must be created or copy"));
  return null;
}

function successfulResult<T>(value: T): CoreValidationResultV2<T> {
  return Object.freeze({ ok: true, value });
}

function failedResult<T>(issues: CoreValidationIssueV2[]): CoreValidationResultV2<T> {
  return Object.freeze({ ok: false, issues: sortIssues(issues) });
}

export function validateCoreGameObjectIdentityV2(
  value: unknown,
): CoreValidationResultV2<CoreGameObjectIdentityV2> {
  const issues: CoreValidationIssueV2[] = [];
  const record = inspectPlainRecord(value, "$", issues);
  if (record === null) return failedResult(issues);

  if (!isCoreObjectIdKindV2(record.kind)) {
    issues.push(makeIssue("$.kind", "invalid-discriminant", "unknown object identity kind"));
    return failedResult(issues);
  }

  let canonical: CoreGameObjectIdentityV2 | null = null;
  switch (record.kind) {
    case "card": {
      validateExactKeys(
        record,
        ["kind", "physicalCardId", "incarnation", "baseControllerPlayerId"],
        "$",
        issues,
      );
      const validPhysicalCardId = validateBaseId<CorePhysicalCardId>(
        record.physicalCardId,
        "$.physicalCardId",
        "physicalCardId",
        issues,
      );
      const validIncarnation = validateIncarnation(record.incarnation, "$.incarnation", issues);
      const validController = validateNullablePlayerId(
        record.baseControllerPlayerId,
        "$.baseControllerPlayerId",
        issues,
      );
      if (validPhysicalCardId && validIncarnation && validController) {
        const physicalCardId = record.physicalCardId as CorePhysicalCardId;
        const incarnation = record.incarnation as number;
        const baseControllerPlayerId = record.baseControllerPlayerId as CorePlayerId | null;
        canonical = Object.freeze({
          kind: "card",
          physicalCardId,
          incarnation,
          baseControllerPlayerId,
        });
      }
      break;
    }
    case "token": {
      validateExactKeys(
        record,
        [
          "kind",
          "definitionId",
          "ownerPlayerId",
          "incarnation",
          "baseControllerPlayerId",
          "origin",
        ],
        "$",
        issues,
      );
      const validDefinition = validateBaseId<CoreCardDefinitionId>(
        record.definitionId,
        "$.definitionId",
        "definitionId",
        issues,
      );
      const validOwner = validatePlayerId(record.ownerPlayerId, "$.ownerPlayerId", issues);
      const validIncarnation = validateIncarnation(record.incarnation, "$.incarnation", issues);
      const validController = validatePlayerId(
        record.baseControllerPlayerId,
        "$.baseControllerPlayerId",
        issues,
      );
      const origin = validateOrigin(record.origin, "$.origin", issues);
      if (validDefinition && validOwner && validIncarnation && validController && origin !== null) {
        const definitionId = record.definitionId as CoreCardDefinitionId;
        const ownerPlayerId = record.ownerPlayerId as CorePlayerId;
        const incarnation = record.incarnation as number;
        const baseControllerPlayerId = record.baseControllerPlayerId as CorePlayerId;
        canonical = Object.freeze({
          kind: "token",
          definitionId,
          ownerPlayerId,
          incarnation,
          baseControllerPlayerId,
          origin,
        });
      }
      break;
    }
    case "spell-copy": {
      validateExactKeys(
        record,
        ["kind", "definitionId", "controllerPlayerId", "copiedFromObjectId"],
        "$",
        issues,
      );
      const validDefinition = validateBaseId<CoreCardDefinitionId>(
        record.definitionId,
        "$.definitionId",
        "definitionId",
        issues,
      );
      const validController = validatePlayerId(
        record.controllerPlayerId,
        "$.controllerPlayerId",
        issues,
      );
      const validSource = validateObjectId(
        record.copiedFromObjectId,
        "$.copiedFromObjectId",
        "copiedFromObjectId",
        issues,
      );
      if (validDefinition && validController && validSource) {
        const definitionId = record.definitionId as CoreCardDefinitionId;
        const controllerPlayerId = record.controllerPlayerId as CorePlayerId;
        const copiedFromObjectId = record.copiedFromObjectId as CoreObjectId;
        canonical = Object.freeze({
          kind: "spell-copy",
          definitionId,
          controllerPlayerId,
          copiedFromObjectId,
        });
      }
      break;
    }
    case "activated-ability":
    case "triggered-ability": {
      validateExactKeys(
        record,
        ["kind", "controllerPlayerId", "sourceObjectId", "abilityKey"],
        "$",
        issues,
      );
      const validController = validatePlayerId(
        record.controllerPlayerId,
        "$.controllerPlayerId",
        issues,
      );
      const validSource =
        record.sourceObjectId === null ||
        validateObjectId(record.sourceObjectId, "$.sourceObjectId", "sourceObjectId", issues);
      const validAbilityKey = validateBaseId<string>(record.abilityKey, "$.abilityKey", "abilityKey", issues);
      if (validController && validSource && validAbilityKey) {
        const controllerPlayerId = record.controllerPlayerId as CorePlayerId;
        const sourceObjectId = record.sourceObjectId as CoreObjectId | null;
        const abilityKey = record.abilityKey as string;
        canonical = Object.freeze({
          kind: record.kind,
          controllerPlayerId,
          sourceObjectId,
          abilityKey,
        });
      }
      break;
    }
  }

  return canonical === null || issues.length > 0
    ? failedResult(issues)
    : successfulResult(canonical);
}

export function validateCoreTokenObjectIdentityV2(
  value: unknown,
): CoreValidationResultV2<CoreTokenObjectIdentityV2> {
  const result = validateCoreGameObjectIdentityV2(value);
  if (!result.ok) {
    return Object.freeze({ ok: false, issues: result.issues });
  }
  if (result.value.kind !== "token") {
    return failedResult([
      makeIssue("$.kind", "invalid-discriminant", "expected a token object identity"),
    ]);
  }
  return successfulResult(result.value);
}

export function isCoreGameObjectIdentityV2(
  value: unknown,
): value is CoreGameObjectIdentityV2 {
  return validateCoreGameObjectIdentityV2(value).ok;
}

function tokenIdentityInputFromArgs(args: readonly unknown[]): unknown {
  if (args.length === 1) {
    return args[0];
  }
  if (args.length === 5) {
    return {
      kind: "token",
      definitionId: args[0],
      ownerPlayerId: args[1],
      incarnation: args[2],
      baseControllerPlayerId: args[3],
      origin: args[4],
    };
  }
  invalidFactoryInput(
    "token identity factory expects one record or definition, owner, incarnation, controller, origin",
  );
}

export function coreTokenObjectIdentityOfV2(
  input: CoreTokenObjectIdentityV2,
): CoreTokenObjectIdentityV2;
export function coreTokenObjectIdentityOfV2(
  definitionId: CoreCardDefinitionId,
  ownerPlayerId: CorePlayerId,
  incarnation: number,
  baseControllerPlayerId: CorePlayerId,
  origin: CoreTokenOriginV2,
): CoreTokenObjectIdentityV2;
export function coreTokenObjectIdentityOfV2(
  ...args: readonly unknown[]
): CoreTokenObjectIdentityV2 {
  const result = validateCoreTokenObjectIdentityV2(tokenIdentityInputFromArgs(args));
  if (!result.ok) {
    throw new TypeError(result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "));
  }
  return result.value;
}

export function coreGameObjectIdentityOfV2(
  input: unknown,
): CoreGameObjectIdentityV2 {
  const result = validateCoreGameObjectIdentityV2(input);
  if (!result.ok) {
    throw new TypeError(result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "));
  }
  return result.value;
}

function identityFactoryError(
  result: CoreValidationResultV2<CoreGameObjectIdentityV2>,
  expectedKind: CoreObjectIdKindV2,
): TypeError {
  if (!result.ok) {
    return new TypeError(
      result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "),
    );
  }
  return new TypeError(`expected a ${expectedKind} object identity`);
}

export function coreCardObjectIdentityOfV2(
  input: unknown,
): CoreCardObjectIdentityV2 {
  const result = validateCoreGameObjectIdentityV2(input);
  if (!result.ok || result.value.kind !== "card") {
    throw identityFactoryError(result, "card");
  }
  return result.value;
}

export function coreSpellCopyObjectIdentityOfV2(
  input: unknown,
): CoreSpellCopyObjectIdentityV2 {
  const result = validateCoreGameObjectIdentityV2(input);
  if (!result.ok || result.value.kind !== "spell-copy") {
    throw identityFactoryError(result, "spell-copy");
  }
  return result.value;
}

export function coreActivatedAbilityObjectIdentityOfV2(
  input: unknown,
): CoreActivatedAbilityObjectIdentityV2 {
  const result = validateCoreGameObjectIdentityV2(input);
  if (!result.ok || result.value.kind !== "activated-ability") {
    throw identityFactoryError(result, "activated-ability");
  }
  return result.value;
}

export function coreTriggeredAbilityObjectIdentityOfV2(
  input: unknown,
): CoreTriggeredAbilityObjectIdentityV2 {
  const result = validateCoreGameObjectIdentityV2(input);
  if (!result.ok || result.value.kind !== "triggered-ability") {
    throw identityFactoryError(result, "triggered-ability");
  }
  return result.value;
}

export const createCoreTokenObjectIdentityV2 = coreTokenObjectIdentityOfV2;
export const createCoreGameObjectIdentityV2 = coreGameObjectIdentityOfV2;
export const createCoreCardObjectIdentityV2 = coreCardObjectIdentityOfV2;
export const createCoreSpellCopyObjectIdentityV2 = coreSpellCopyObjectIdentityOfV2;
export const createCoreActivatedAbilityObjectIdentityV2 =
  coreActivatedAbilityObjectIdentityOfV2;
export const createCoreTriggeredAbilityObjectIdentityV2 =
  coreTriggeredAbilityObjectIdentityOfV2;

export function canonicalizeCoreGameObjectIdentityV2(
  value: unknown,
): CoreGameObjectIdentityV2 {
  return coreGameObjectIdentityOfV2(value);
}
