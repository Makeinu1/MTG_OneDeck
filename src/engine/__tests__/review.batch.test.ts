/**
 * Reviewer-owned tests for R下地/R1: the batch apply helper (docs/engine-spec.md
 * §18). applyCommands must be exactly equivalent to folding applyCommand over the
 * sequence (state + warnings), must not mutate its input (I4), and must be a no-op
 * for an empty list. Implementation agents must NOT modify this file.
 */
import { describe, expect, it } from 'vitest';
import { applyCommands, applyCommandBatch } from '../batch';
import { applyCommand, type GameCommand } from '../commands';
import { initGame } from '../init';
import { makeDeck } from './helpers';
import type { GameState } from '../types';

function freshState(): GameState {
  return initGame(makeDeck(20), 1);
}

const SAMPLE: GameCommand[] = [
  { type: 'draw', count: 3 },
  { type: 'adjustLife', delta: -5 },
  { type: 'adjustPlayerCounter', kind: 'poison', delta: 2 },
];

describe('applyCommands batch helper (R下地/R1)', () => {
  it('equals folding applyCommand over the sequence (state + warnings)', () => {
    const s0 = freshState();
    let s = s0;
    const w: string[] = [];
    for (const c of SAMPLE) {
      const r = applyCommand(s, c);
      s = r.state;
      w.push(...r.warnings);
    }
    const batch = applyCommands(s0, SAMPLE);
    expect(batch.state).toEqual(s);
    expect(batch.warnings).toEqual(w);
  });

  it('does not mutate the input state (I4)', () => {
    const s0 = freshState();
    const snapshot = JSON.parse(JSON.stringify(s0)) as GameState;
    applyCommands(s0, SAMPLE);
    expect(s0).toEqual(snapshot);
  });

  it('empty command list returns the same state reference and no warnings', () => {
    const s0 = freshState();
    const r = applyCommands(s0, []);
    expect(r.state).toBe(s0);
    expect(r.warnings).toEqual([]);
  });

  it('applyCommandBatch is equivalent to applyCommands (label ignored)', () => {
    const s0 = freshState();
    const cmds: GameCommand[] = [
      { type: 'draw', count: 1 },
      { type: 'adjustLife', delta: 3 },
    ];
    expect(applyCommandBatch(s0, { commands: cmds, label: 'x' })).toEqual(
      applyCommands(s0, cmds),
    );
  });
});
