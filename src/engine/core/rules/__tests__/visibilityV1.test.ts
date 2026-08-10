import { describe, expect, it } from 'vitest';
import fixture from '../../turn/fixtures/turn-priority-lifecycle-v1.json';
import {
  createModeNeutralCoreVisibilitySliceV1,
  validateModeNeutralCoreVisibilitySliceV1,
} from '../visibilityGrantV1';
import { coreCanPlayerViewObjectIdentityV1 } from '../visibilityQueryV1';

const registry = fixture.bundle.stackBundle.objectRegistry;
const runtime = fixture.bundle.stackBundle.objectRuntime;
const indefinite = { kind: 'indefinite' } as const;
const CARD = 'PC4:0' as never;
const P1 = 'P1' as never;
const P2 = 'P2' as never;

describe('Core visibility V1', () => {
  it('strictly validates, canonicalizes audience IDs, and deep-freezes the result', () => {
    const slice = createModeNeutralCoreVisibilitySliceV1({
      grantOrder: ['look'],
      byGrant: {
        look: {
          subject: { kind: 'object', objectId: CARD },
          audience: { kind: 'players', playerIds: [P2, P1] },
          mode: 'look',
          sourceObjectId: null,
          duration: indefinite,
        },
      },
    });
    expect(slice.byGrant.look.audience).toEqual({ kind: 'players', playerIds: ['P1', 'P2'] });
    expect(Object.isFrozen(slice)).toBe(true);
    expect(Object.isFrozen(slice.byGrant.look.audience)).toBe(true);
    expect(validateModeNeutralCoreVisibilitySliceV1({ ...slice, grantOrder: ['missing'] }).ok).toBe(
      false,
    );
  });

  it('keeps default private/public rules and applies only additive grants', () => {
    const slice = createModeNeutralCoreVisibilitySliceV1({
      grantOrder: ['exile'],
      byGrant: {
        exile: {
          subject: { kind: 'object', objectId: CARD },
          audience: { kind: 'players', playerIds: [P1] },
          mode: 'look',
          sourceObjectId: null,
          duration: indefinite,
        },
      },
    });
    expect(coreCanPlayerViewObjectIdentityV1(registry, slice, 'P1', 'PC2:0')).toBe(true);
    expect(coreCanPlayerViewObjectIdentityV1(registry, slice, 'P2', 'PC1:0')).toBe(false);
    expect(coreCanPlayerViewObjectIdentityV1(registry, slice, 'P2', 'PC6:0')).toBe(true);
    expect(
      coreCanPlayerViewObjectIdentityV1(
        { objectRegistry: registry, objectRuntime: runtime, visibility: slice },
        'P1',
        'PC4:0',
      ),
    ).toBe(true);
    expect(coreCanPlayerViewObjectIdentityV1(registry, slice, 'P2', 'PC4:0')).toBe(false);
    expect(coreCanPlayerViewObjectIdentityV1(registry, slice, 'P1', 'outside:1')).toBe(false);
  });

  it('rejects reveal-to-selected-player grants and invalid top counts', () => {
    expect(() =>
      createModeNeutralCoreVisibilitySliceV1({
        grantOrder: ['bad'],
        byGrant: {
          bad: {
            subject: { kind: 'top-of-library', playerId: P1, count: 0 },
            audience: { kind: 'players', playerIds: [P1] },
            mode: 'reveal',
            sourceObjectId: null,
            duration: indefinite,
          },
        },
      }),
    ).toThrow();
  });
});
