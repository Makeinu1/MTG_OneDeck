export type CoreClosureVersionVectorV1 = Readonly<{
  readonly coreStateSchemaVersion: 1;
  readonly coreCommandSchemaVersion: 1;
  readonly coreEventSchemaVersion: 1;
  readonly coreReplaySchemaVersion: 1;
}>;

export const CORE_CLOSURE_VERSION_VECTOR_V1: CoreClosureVersionVectorV1 = Object.freeze({
  coreStateSchemaVersion: 1,
  coreCommandSchemaVersion: 1,
  coreEventSchemaVersion: 1,
  coreReplaySchemaVersion: 1,
});

export function isCoreClosureVersionVectorV1(value: unknown): value is CoreClosureVersionVectorV1 {
  if (value === null || typeof value !== 'object') return false;
  const fields = [
    'coreStateSchemaVersion',
    'coreCommandSchemaVersion',
    'coreEventSchemaVersion',
    'coreReplaySchemaVersion',
  ];
  try {
    if (Array.isArray(value)) return false;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== fields.length || !keys.every((key) => typeof key === 'string' && fields.includes(key))) return false;
    return fields.every((field) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, field);
      return descriptor !== undefined && descriptor.enumerable === true && 'value' in descriptor && descriptor.value === 1;
    });
  } catch {
    return false;
  }
}

export function createCoreClosureVersionVectorV1(value: unknown = CORE_CLOSURE_VERSION_VECTOR_V1): CoreClosureVersionVectorV1 {
  if (!isCoreClosureVersionVectorV1(value)) throw new TypeError('Invalid Core closure version vector');
  return Object.freeze({ ...CORE_CLOSURE_VERSION_VECTOR_V1 });
}
