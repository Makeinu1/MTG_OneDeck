declare const corePlayerIdBrand: unique symbol;
declare const coreCardDefinitionIdBrand: unique symbol;
declare const corePhysicalCardIdBrand: unique symbol;
declare const coreObjectIdBrand: unique symbol;

export type CorePlayerId = string & { readonly [corePlayerIdBrand]: true };
export type CoreCardDefinitionId = string & { readonly [coreCardDefinitionIdBrand]: true };
export type CorePhysicalCardId = string & { readonly [corePhysicalCardIdBrand]: true };
export type CoreObjectId = string & { readonly [coreObjectIdBrand]: true };

export const CORE_BASE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
export const CORE_UNSAFE_RECORD_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export function isCoreBaseId(value: unknown): value is string {
  return typeof value === 'string' && CORE_BASE_ID_PATTERN.test(value);
}
export function isCoreUnsafeRecordKey(value: string): boolean {
  return CORE_UNSAFE_RECORD_KEYS.has(value);
}

export function isCoreSafeIncarnation(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function coreCardObjectIdOf(
  physicalCardId: CorePhysicalCardId,
  incarnation: number,
): CoreObjectId {
  if (!isCoreBaseId(physicalCardId)) {
    throw new TypeError('physicalCardId must be a valid Core base ID');
  }
  if (!isCoreSafeIncarnation(incarnation)) {
    throw new TypeError('incarnation must be a non-negative safe integer');
  }
  return `${physicalCardId}:${incarnation}` as CoreObjectId;
}
