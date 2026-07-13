import { describe, expect, it } from 'vitest';
import { transitionCueFor } from './transitionCueModel';

describe('transitionCueFor', () => {
  it('does not announce unchanged or initial state by itself', () => {
    expect(transitionCueFor({ turn: 3, phase: 'main1' }, { turn: 3, phase: 'main1' })).toBeNull();
  });

  it('announces a phase destination', () => {
    expect(transitionCueFor({ turn: 3, phase: 'main1' }, { turn: 3, phase: 'combat' }))
      .toEqual({ kind: 'phase', turn: 3, phase: 'combat' });
  });

  it('coalesces a turn and auto-advance into the final destination', () => {
    expect(transitionCueFor({ turn: 3, phase: 'end' }, { turn: 4, phase: 'main1' }))
      .toEqual({ kind: 'turn', turn: 4, phase: 'main1' });
  });
});

