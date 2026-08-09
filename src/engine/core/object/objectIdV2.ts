import { isCoreBaseId, isCoreSafeIncarnation } from '../ids';
import type { CoreObjectId, CorePhysicalCardId } from '../ids';

export type CoreObjectIdKindV2 =
  | 'card'
  | 'token'
  | 'spell-copy'
  | 'activated-ability'
  | 'triggered-ability';

export type ParsedCoreObjectIdV2 =
  | Readonly<{
      readonly kind: 'card';
      readonly physicalCardId: CorePhysicalCardId;
      readonly incarnation: number;
    }>
  | Readonly<{
      readonly kind: 'token';
      readonly seed: string;
      readonly incarnation: number;
    }>
  | Readonly<{
      readonly kind: 'spell-copy';
      readonly seed: string;
    }>
  | Readonly<{
      readonly kind: 'activated-ability';
      readonly seed: string;
    }>
  | Readonly<{
      readonly kind: 'triggered-ability';
      readonly seed: string;
    }>;

const DECIMAL_INCARNATION_PATTERN = /^(0|[1-9][0-9]*)$/;
const TOKEN_PREFIX = '@token:';
const SPELL_COPY_PREFIX = '@spell-copy:';
const ACTIVATED_ABILITY_PREFIX = '@activated-ability:';
const TRIGGERED_ABILITY_PREFIX = '@triggered-ability:';

function isCanonicalIncarnationText(value: string): boolean {
  return DECIMAL_INCARNATION_PATTERN.test(value);
}

function parseIncarnation(value: string): number | null {
  if (!isCanonicalIncarnationText(value)) return null;
  const incarnation = Number(value);
  return isCoreSafeIncarnation(incarnation) ? incarnation : null;
}

function parseSeed(value: string): string | null {
  return isCoreBaseId(value) ? value : null;
}

function parseCardObjectId(value: string): ParsedCoreObjectIdV2 | null {
  const separator = value.indexOf(':');
  if (separator <= 0 || separator !== value.lastIndexOf(':') || separator === value.length - 1) {
    return null;
  }

  const physicalCardId = value.slice(0, separator);
  const incarnation = parseIncarnation(value.slice(separator + 1));
  if (!isCoreBaseId(physicalCardId) || incarnation === null) return null;

  return Object.freeze({
    kind: 'card' as const,
    physicalCardId: physicalCardId as CorePhysicalCardId,
    incarnation,
  });
}

function parseTokenObjectId(value: string): ParsedCoreObjectIdV2 | null {
  if (!value.startsWith(TOKEN_PREFIX)) return null;
  const body = value.slice(TOKEN_PREFIX.length);
  const separator = body.indexOf(':');
  if (separator <= 0 || separator !== body.lastIndexOf(':') || separator === body.length - 1) {
    return null;
  }

  const seed = parseSeed(body.slice(0, separator));
  const incarnation = parseIncarnation(body.slice(separator + 1));
  if (seed === null || incarnation === null) return null;

  return Object.freeze({ kind: 'token' as const, seed, incarnation });
}

function parseSeedOnlyObjectId(
  value: string,
  prefix: string,
  kind: 'spell-copy' | 'activated-ability' | 'triggered-ability',
): ParsedCoreObjectIdV2 | null {
  if (!value.startsWith(prefix)) return null;
  const seed = parseSeed(value.slice(prefix.length));
  if (seed === null) return null;
  if (kind === 'spell-copy') return Object.freeze({ kind: 'spell-copy' as const, seed });
  if (kind === 'activated-ability') {
    return Object.freeze({ kind: 'activated-ability' as const, seed });
  }
  return Object.freeze({ kind: 'triggered-ability' as const, seed });
}

export function parseCoreObjectIdV2(value: unknown): ParsedCoreObjectIdV2 | null {
  if (typeof value !== 'string') return null;
  if (value.startsWith('@')) {
    return (
      parseTokenObjectId(value)
      ?? parseSeedOnlyObjectId(value, SPELL_COPY_PREFIX, 'spell-copy')
      ?? parseSeedOnlyObjectId(value, ACTIVATED_ABILITY_PREFIX, 'activated-ability')
      ?? parseSeedOnlyObjectId(value, TRIGGERED_ABILITY_PREFIX, 'triggered-ability')
    );
  }
  return parseCardObjectId(value);
}

export function isCanonicalCoreObjectIdV2(value: unknown): value is CoreObjectId {
  return parseCoreObjectIdV2(value) !== null;
}

function assertSeed(seed: string): void {
  if (!isCoreBaseId(seed)) throw new TypeError('seed must be a valid Core base ID');
}

function assertIncarnation(incarnation: number): void {
  if (Object.is(incarnation, -0) || !isCoreSafeIncarnation(incarnation)) {
    throw new TypeError('incarnation must be a non-negative safe integer');
  }
}

export function coreTokenObjectIdOfV2(seed: string, incarnation: number): CoreObjectId {
  assertSeed(seed);
  assertIncarnation(incarnation);
  return `@token:${seed}:${incarnation}` as CoreObjectId;
}

export function coreSpellCopyObjectIdOfV2(seed: string): CoreObjectId {
  assertSeed(seed);
  return `${SPELL_COPY_PREFIX}${seed}` as CoreObjectId;
}

export function coreActivatedAbilityObjectIdOfV2(seed: string): CoreObjectId {
  assertSeed(seed);
  return `${ACTIVATED_ABILITY_PREFIX}${seed}` as CoreObjectId;
}

export function coreTriggeredAbilityObjectIdOfV2(seed: string): CoreObjectId {
  assertSeed(seed);
  return `${TRIGGERED_ABILITY_PREFIX}${seed}` as CoreObjectId;
}
