import { describe, expect, it } from 'vitest';
import {
  applyCoreControlEffectV1,
  coreHasContinuousControlSinceTurnStartV1,
  createModeNeutralCoreControlSliceV1,
  expireCoreControlEffectsAtTurnBoundaryV1,
  markCoreControlledPermanentsAtTurnStartV1,
  removeCoreControlEffectV1,
  replaceCoreControlEffectOrderV1,
  validateModeNeutralCoreControlSliceV1,
} from '../controlEffectV1';

const card = 'PC6:0' as never;
const spell = 'PC5:1' as never;
const copy = '@spell-copy:fixture-copy' as never;
const source = 'PC2:0' as never;
const empty = () =>
  createModeNeutralCoreControlSliceV1({
    effectOrder: [],
    byEffect: {},
    continuityByObject: {
      [card]: { controllerPlayerId: 'P3' as never, continuousSinceMostRecentTurnBegan: false },
    },
  });
const effect = (
  targetObjectId: string,
  gainingControllerPlayerId: string,
  duration: object = { kind: 'indefinite' },
) => ({ targetObjectId, gainingControllerPlayerId, sourceObjectId: source, duration });

describe('Core control effect and continuity V1', () => {
  it('validates exact order/effect parity and returns fresh frozen slices', () => {
    const input = {
      kind: 'mode-neutral-core-control-slice-v1',
      effectOrder: [],
      byEffect: {},
      continuityByObject: {},
    };
    const result = validateModeNeutralCoreControlSliceV1(input);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).not.toBe(input);
      expect(Object.isFrozen(result.value)).toBe(true);
      expect(JSON.parse(JSON.stringify(result.value))).toEqual(result.value);
    }
    expect(validateModeNeutralCoreControlSliceV1({ ...input, effectOrder: ['x'] }).ok).toBe(false);
  });

  it('applies last ordered control, restores on removal, and rejects abilities', () => {
    let slice = empty();
    slice = applyCoreControlEffectV1(slice, 'first', effect(card, 'P2')).value;
    slice = applyCoreControlEffectV1(slice, 'last', effect(card, 'P1')).value;
    expect(slice.byEffect.last.gainingControllerPlayerId).toBe('P1');
    slice = replaceCoreControlEffectOrderV1(slice, ['last', 'first']).value;
    expect(slice.effectOrder).toEqual(['last', 'first']);
    slice = removeCoreControlEffectV1(slice, 'last').value;
    expect(slice.effectOrder).toEqual(['first']);
    expect(() =>
      applyCoreControlEffectV1(slice, 'ability', effect('@activated-ability:a', 'P2')),
    ).toThrow(/OBJECT_NOT_CONTROLLABLE/);
    expect(spell).toBe('PC5:1');
    expect(copy).toBe('@spell-copy:fixture-copy');
  });

  it('resets continuity on effective control change, marks at turn start, and expires EOT', () => {
    let slice = applyCoreControlEffectV1(empty(), 'owned', effect(card, 'P2')).value;
    expect(slice.continuityByObject[card].continuousSinceMostRecentTurnBegan).toBe(false);
    slice = markCoreControlledPermanentsAtTurnStartV1(slice, 'P2' as never).value;
    expect(coreHasContinuousControlSinceTurnStartV1(slice, card)).toBe(true);
    slice = applyCoreControlEffectV1(
      slice,
      'eot',
      effect(card, 'P1', { kind: 'until-end-of-turn', turnNumber: 4 }),
    ).value;
    expect(slice.continuityByObject[card].continuousSinceMostRecentTurnBegan).toBe(false);
    const expired = expireCoreControlEffectsAtTurnBoundaryV1(slice, 4).value;
    expect(expired.effectOrder).toEqual(['owned']);
    expect(expired.continuityByObject[card].controllerPlayerId).toBe('P2');
  });
});
