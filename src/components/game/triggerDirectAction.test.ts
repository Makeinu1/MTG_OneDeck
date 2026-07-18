import { describe, expect, it } from 'vitest';
import { initGame } from '../../engine/init';
import { makeDef } from '../../engine/__tests__/helpers';
import type { TriggerCandidate } from '../../engine/triggers';
import { triggerDirectAction } from './triggerDirectAction';

function fixture(oracleText: string) {
  const def = makeDef({
    scryfallId: `trigger-direct-${oracleText}`,
    typeLine: 'Creature',
    faces: [{ name: 'Trigger Direct', typeLine: 'Creature', oracleText }],
  });
  const state = initGame([{ def, isCommander: false }], 1);
  const sourceId = Object.keys(state.cards)[0];
  const candidate: TriggerCandidate = {
    sourceId,
    triggerId: 'trigger.etb',
    label: '誘発',
    abilityLineIndex: 0,
  };
  return { state, candidate };
}

describe('triggerDirectAction', () => {
  it('directly places one choice-free trigger', () => {
    const { state, candidate } = fixture('When Trigger Direct enters, draw a card.');
    expect(triggerDirectAction(state, [candidate])).toEqual({ kind: 'place', candidate });
  });

  it('opens the sheet for a targeted trigger', () => {
    const { state, candidate } = fixture(
      'When Trigger Direct enters, return target creature to its owner\'s hand.',
    );
    expect(triggerDirectAction(state, [candidate])).toEqual({ kind: 'sheet' });
  });

  it('opens the sheet whenever multiple triggers need ordering', () => {
    const { state, candidate } = fixture('When Trigger Direct enters, draw a card.');
    expect(triggerDirectAction(state, [candidate, { ...candidate, triggerId: 'trigger.other' }]))
      .toEqual({ kind: 'sheet' });
  });
});
