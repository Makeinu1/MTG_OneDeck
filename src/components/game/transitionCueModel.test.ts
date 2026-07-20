import { describe, expect, it } from 'vitest';
import { transitionCueFor } from './transitionCueModel';

describe('transitionCueFor', () => {
  it('does not announce unchanged or initial state by itself', () => {
    expect(transitionCueFor({ turn: 3, phase: 'main1' }, { turn: 3, phase: 'main1' })).toBeNull();
  });

  it('announces a phase destination', () => {
    expect(transitionCueFor({ turn: 3, phase: 'main1' }, { turn: 3, phase: 'combat' }))
      .toMatchObject({ kind: 'phase', turn: 3, phases: ['combat'], drawAtMs: null, durationMs: 650 });
  });

  it('keeps every beginning step visible when a turn auto-advances to main one', () => {
    expect(transitionCueFor({ turn: 3, phase: 'end' }, { turn: 4, phase: 'main1' }))
      .toMatchObject({
        kind: 'turn',
        turn: 4,
        phases: ['untap', 'upkeep', 'draw', 'main1'],
        drawAtMs: 560,
        durationMs: 1500,
      });
  });

  it('announces only untap when manual turn progression is enabled', () => {
    expect(transitionCueFor({ turn: 3, phase: 'end' }, { turn: 4, phase: 'untap' }))
      .toMatchObject({ kind: 'turn', turn: 4, phases: ['untap'], drawAtMs: null });
  });

  it('can mark the first unchanged untap state as a turn start', () => {
    expect(transitionCueFor(
      { turn: 1, phase: 'untap' },
      { turn: 1, phase: 'untap' },
      { forceTurnStart: true },
    )).toMatchObject({ kind: 'turn', turn: 1, phases: ['untap'] });
  });

  it('shows every beginning step when the first turn is already auto-advanced', () => {
    expect(transitionCueFor(
      { turn: 1, phase: 'untap' },
      { turn: 1, phase: 'main1' },
      { forceTurnStart: true },
    )).toMatchObject({
      kind: 'turn',
      turn: 1,
      phases: ['untap', 'upkeep', 'draw', 'main1'],
    });
  });
});
