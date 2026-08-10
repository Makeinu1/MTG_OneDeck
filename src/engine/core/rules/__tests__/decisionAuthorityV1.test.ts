import { describe, expect, it } from 'vitest';
import {
  activateCorePendingDecisionAuthoritiesAtTurnStartV1,
  addCoreDecisionAuthorityV1,
  coreDecisionMakerForV1,
  createModeNeutralCoreDecisionAuthoritySliceV1,
  expireCoreDecisionAuthoritiesAfterTurnV1,
  removeCoreDecisionAuthorityV1,
  validateModeNeutralCoreDecisionAuthoritySliceV1,
} from '../decisionAuthorityV1';

const empty = () =>
  createModeNeutralCoreDecisionAuthoritySliceV1({ authorityOrder: [], byAuthority: {} });
const authority = (scope: object, maker = 'P2') => ({
  controlledPlayerId: 'P1',
  decisionMakerPlayerId: maker,
  sourceObjectId: null,
  scope,
});

describe('Core decision authority V1', () => {
  it('resolves last matching scope and removes it', () => {
    let slice = addCoreDecisionAuthorityV1(
      empty(),
      'broad',
      authority({ kind: 'all-game-decisions' }) as never,
    ).value;
    slice = addCoreDecisionAuthorityV1(
      slice,
      'specific',
      authority({ kind: 'decision', decisionKey: 'choose.mode' }, 'P3') as never,
    ).value;
    expect(
      coreDecisionMakerForV1(slice, 'P1' as never, {
        kind: 'decision',
        decisionKey: 'choose.mode',
      }),
    ).toBe('P3');
    expect(
      coreDecisionMakerForV1(slice, 'P1' as never, { kind: 'decision', decisionKey: 'other' }),
    ).toBe('P2');
    slice = removeCoreDecisionAuthorityV1(slice, 'specific').value;
    expect(
      coreDecisionMakerForV1(slice, 'P1' as never, {
        kind: 'decision',
        decisionKey: 'choose.mode',
      }),
    ).toBe('P2');
  });
  it('activates pending authorities for the actual turn and expires only that turn', () => {
    const pending = addCoreDecisionAuthorityV1(
      empty(),
      'pending',
      authority({ kind: 'pending-next-turn' }) as never,
    ).value;
    const active = activateCorePendingDecisionAuthoritiesAtTurnStartV1(
      pending,
      'P1' as never,
      7,
    ).value;
    expect(active.byAuthority.pending.scope).toEqual({ kind: 'active-turn', turnNumber: 7 });
    expect(
      coreDecisionMakerForV1(active, 'P1' as never, {
        kind: 'decision',
        decisionKey: 'x',
        turnNumber: 7,
      }),
    ).toBe('P2');
    expect(expireCoreDecisionAuthoritiesAfterTurnV1(active, 6).value.authorityOrder).toEqual([
      'pending',
    ]);
    expect(expireCoreDecisionAuthoritiesAfterTurnV1(active, 7).value.authorityOrder).toEqual([]);
  });
  it('rejects key-set drift without mutating input', () => {
    const input = {
      kind: 'mode-neutral-core-decision-authority-slice-v1',
      authorityOrder: ['a'],
      byAuthority: { b: authority({ kind: 'all-game-decisions' }) },
    };
    const before = JSON.stringify(input);
    expect(validateModeNeutralCoreDecisionAuthoritySliceV1(input).ok).toBe(false);
    expect(JSON.stringify(input)).toBe(before);
    expect(Object.isFrozen(empty())).toBe(true);
  });
});
