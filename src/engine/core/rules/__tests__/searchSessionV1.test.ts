import { describe, expect, it } from 'vitest';
import type { CoreObjectId, CorePlayerId } from '../../ids';
import type { ModeNeutralCoreObjectRegistryStateV2 } from '../../object/objectRegistryStateV2';
import {
  createModeNeutralCoreSearchSessionSliceV1,
  validateModeNeutralCoreSearchSessionSliceV1,
} from '../searchSessionV1';
import {
  cancelCoreSearchSessionV1,
  completeCoreSearchSessionV1,
  openCoreSearchSessionV1,
} from '../searchSessionOperationsV1';
import { CoreRuleAuthorityOperationError } from '../ruleAuthorityErrorV1';

const p1 = 'P1' as CorePlayerId;
const pc1 = 'PC1:0' as CoreObjectId;
const pc2 = 'PC2:0' as CoreObjectId;
const zone = { kind: 'player-zone', playerId: p1, zone: 'library' } as const;
const input = {
  zone,
  portion: { kind: 'all' } as const,
  criteria: { kind: 'quantity', minimum: 1, maximum: 2 } as const,
  revealFound: true,
  shuffleAfter: true,
  rulesActorPlayerId: p1,
};

function slice() {
  return createModeNeutralCoreSearchSessionSliceV1({ sessionOrder: [], bySession: {} });
}

describe('Core search session V1', () => {
  it('strictly validates exact fields and freezes canonical values', () => {
    const value = createModeNeutralCoreSearchSessionSliceV1({
      sessionOrder: ['s'],
      bySession: {
        s: {
          rulesActorPlayerId: p1,
          selectorPlayerId: p1,
          zone,
          portion: { kind: 'top', count: 2 },
          candidateObjectIds: [pc1],
          criteria: {
            kind: 'qualified',
            criteriaKey: 'card.criteria',
            minimum: 0,
            maximum: 1,
            mayFailToFind: true,
          },
          revealFound: false,
          shuffleAfter: false,
        },
      },
    });
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.bySession.s.criteria)).toBe(true);
    expect(validateModeNeutralCoreSearchSessionSliceV1({ ...value, extra: true }).ok).toBe(false);
  });

  it('opens, completes in zone order, and returns metadata without moving cards', () => {
    const registry = {
      zones: {
        byPlayer: { P1: { library: ['PC1:0', 'PC2:0'], hand: [], graveyard: [] } },
        shared: { battlefield: [], stack: [], exile: [], command: [] },
      },
    } as unknown as ModeNeutralCoreObjectRegistryStateV2;
    const opened = openCoreSearchSessionV1(registry, p1, input);
    const completed = completeCoreSearchSessionV1(opened.value, 'fixture-search', [pc2]);
    expect(completed.selectedObjectIds).toEqual([pc2]);
    expect(completed.revealFound).toBe(true);
    expect(completed.shuffleAfter).toBe(true);
    expect((completed.value as { readonly sessionOrder: readonly string[] }).sessionOrder).toEqual(
      [],
    );
    expect(registry.zones.byPlayer[p1].library).toEqual([pc1, pc2]);
  });

  it('fails closed for opaque qualified criteria while allowing a may-fail empty result', () => {
    const registry = {
      zones: {
        byPlayer: { P1: { library: ['PC1:0', 'PC2:0'], hand: [], graveyard: [] } },
        shared: { battlefield: [], stack: [], exile: [], command: [] },
      },
    } as unknown as ModeNeutralCoreObjectRegistryStateV2;
    const opened = openCoreSearchSessionV1(registry, p1, {
      ...input,
      criteria: {
        kind: 'qualified',
        criteriaKey: 'opaque.criteria',
        minimum: 1,
        maximum: 1,
        mayFailToFind: true,
      },
    });
    let rejected: unknown;
    try {
      completeCoreSearchSessionV1(opened.value, 'fixture-search', [pc1]);
    } catch (error: unknown) {
      rejected = error;
    }
    expect(rejected).toBeInstanceOf(CoreRuleAuthorityOperationError);
    expect(rejected).toMatchObject({ code: 'SEARCH_SELECTION_INVALID', path: '/selectedObjectIds' });

    const completed = completeCoreSearchSessionV1(opened.value, 'fixture-search', []);
    expect(completed.selectedObjectIds).toEqual([]);
    expect((completed.value as { readonly sessionOrder: readonly string[] }).sessionOrder).toEqual([]);
    expect(registry.zones.byPlayer[p1].library).toEqual([pc1, pc2]);

    const noMayFailOpened = openCoreSearchSessionV1(registry, p1, {
      ...input,
      criteria: {
        kind: 'qualified',
        criteriaKey: 'opaque.criteria.no-fail',
        minimum: 0,
        maximum: 1,
        mayFailToFind: false,
      },
    });
    let noMayFailRejected: unknown;
    try {
      completeCoreSearchSessionV1(noMayFailOpened.value, 'fixture-search', []);
    } catch (error: unknown) {
      noMayFailRejected = error;
    }
    expect(noMayFailRejected).toBeInstanceOf(CoreRuleAuthorityOperationError);
    expect(noMayFailRejected).toMatchObject({ code: 'SEARCH_SELECTION_INVALID', path: '/selectedObjectIds' });
  });

  it('rejects duplicate, out-of-snapshot, and stale selections; cancel only removes', () => {
    const opened = openCoreSearchSessionV1(slice(), 's', { ...input, rulesActorPlayerId: p1 });
    expect(() => completeCoreSearchSessionV1(opened.value, 's', [pc1])).toThrow();
    const canceled = cancelCoreSearchSessionV1(opened.value, 's');
    expect(() => cancelCoreSearchSessionV1(canceled.value, 's')).toThrow();
  });
});
