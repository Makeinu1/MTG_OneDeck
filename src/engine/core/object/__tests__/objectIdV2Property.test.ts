import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  coreActivatedAbilityObjectIdOfV2,
  coreSpellCopyObjectIdOfV2,
  coreTokenObjectIdOfV2,
  coreTriggeredAbilityObjectIdOfV2,
  isCanonicalCoreObjectIdV2,
  parseCoreObjectIdV2,
} from '../objectIdV2';

const firstCharacter = fc.constantFrom('A', 'Z', 'a', 'z', '0', '9');
const remainingCharacter = fc.constantFrom('A', 'Z', 'a', 'z', '0', '9', '.', '_', '-');
const seedArbitrary = fc.tuple(
  firstCharacter,
  fc.array(remainingCharacter, { minLength: 0, maxLength: 24 }),
).map(([first, rest]) => `${first}${rest.join('')}`);
const incarnationArbitrary = fc.integer({ min: 0, max: 1_000_000 });

describe('Core universal object ID V2 properties', () => {
  it('round-trips every generated seed and incarnation for all synthetic branches', () => {
    fc.assert(
      fc.property(seedArbitrary, incarnationArbitrary, (seed, incarnation) => {
        const tokenId = coreTokenObjectIdOfV2(seed, incarnation);
        const spellCopyId = coreSpellCopyObjectIdOfV2(seed);
        const activatedAbilityId = coreActivatedAbilityObjectIdOfV2(seed);
        const triggeredAbilityId = coreTriggeredAbilityObjectIdOfV2(seed);

        expect(parseCoreObjectIdV2(tokenId)).toEqual({ kind: 'token', seed, incarnation });
        expect(parseCoreObjectIdV2(spellCopyId)).toEqual({ kind: 'spell-copy', seed });
        expect(parseCoreObjectIdV2(activatedAbilityId)).toEqual({ kind: 'activated-ability', seed });
        expect(parseCoreObjectIdV2(triggeredAbilityId)).toEqual({ kind: 'triggered-ability', seed });
        expect(new Set([tokenId, spellCopyId, activatedAbilityId, triggeredAbilityId]).size).toBe(4);
      }),
      { numRuns: 100, seed: 2026081001 },
    );
  });

  it('keeps generated synthetic IDs disjoint from generated card IDs', () => {
    fc.assert(
      fc.property(seedArbitrary, incarnationArbitrary, (seed, incarnation) => {
        const cardId = `${seed}:${incarnation}`;
        const syntheticIds = [
          coreTokenObjectIdOfV2(seed, incarnation),
          coreSpellCopyObjectIdOfV2(seed),
          coreActivatedAbilityObjectIdOfV2(seed),
          coreTriggeredAbilityObjectIdOfV2(seed),
        ];

        expect(isCanonicalCoreObjectIdV2(cardId)).toBe(true);
        for (const syntheticId of syntheticIds) {
          expect(syntheticId).not.toBe(cardId);
          expect(isCanonicalCoreObjectIdV2(syntheticId)).toBe(true);
        }
      }),
      { numRuns: 100, seed: 2026081002 },
    );
  });

  it('rejects every generated non-canonical incarnation spelling', () => {
    fc.assert(
      fc.property(
        seedArbitrary,
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.constantFrom('01', '00', '+0', '-0', '1.0', '1e0', 'Infinity', 'NaN'),
        (seed, _incarnation, malformed) => {
          expect(parseCoreObjectIdV2(`PC-${seed}:${malformed}`)).toBeNull();
          expect(parseCoreObjectIdV2(`@token:${seed}:${malformed}`)).toBeNull();
        },
      ),
      { numRuns: 100, seed: 2026081003 },
    );
  });
});
