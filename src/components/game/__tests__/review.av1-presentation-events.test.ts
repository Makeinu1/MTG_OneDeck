/**
 * review.av1-presentation-events — M-AV AV1 の判定者専有ピン。
 * 意味イベントは成功済みforward actionだけから純粋投影し、IDはUIログや
 * engine eventIdに依存せずブラウザセッション内で単調増加させる。
 */

import { describe, expect, it, vi } from 'vitest';
import {
  projectPresentationEvent,
  type PresentationProjectionInput,
} from '../presentation/presentationEvents';
import {
  createPresentationEventChannel,
  createPresentationEventSequencer,
} from '../presentation/presentationSequencer';

function castInput(
  overrides: Partial<Extract<PresentationProjectionInput, { action: 'cast' }>> = {},
): Extract<PresentationProjectionInput, { action: 'cast' }> {
  return {
    action: 'cast',
    status: 'committed',
    cardId: 'card-1',
    sourceZone: 'hand',
    destinationZone: 'stack',
    isCommander: false,
    sourceEventId: 'engine-7',
    ...overrides,
  };
}

describe('AV1 pure semantic projection', () => {
  it('projects a successful ordinary cast once with causal zones', () => {
    expect(projectPresentationEvent(castInput())).toEqual({
      kind: 'spell-cast',
      cardId: 'card-1',
      sourceZone: 'hand',
      destinationZone: 'stack',
      sourceEventId: 'engine-7',
    });
  });

  it('normalizes commander cast as one exclusive event, never generic cast too', () => {
    expect(projectPresentationEvent(castInput({
      isCommander: true,
      sourceZone: 'command',
    }))).toEqual({
      kind: 'commander-cast',
      cardId: 'card-1',
      sourceZone: 'command',
      destinationZone: 'stack',
      sourceEventId: 'engine-7',
    });
  });

  it.each(['failed', 'cancelled', 'needs-confirm', 'needs-payment'] as const)(
    'projects %s cast as no success event',
    (status) => {
      expect(projectPresentationEvent(castInput({ status }))).toBeNull();
    },
  );

  it('requires the committed cast destination to be stack', () => {
    expect(projectPresentationEvent(castInput({
      destinationZone: 'hand',
    }))).toBeNull();
  });

  it('projects land only after the card reached battlefield', () => {
    expect(projectPresentationEvent({
      action: 'play-land',
      status: 'committed',
      cardId: 'land-1',
      sourceZone: 'hand',
      destinationZone: 'battlefield',
    })).toEqual({
      kind: 'land-played',
      cardId: 'land-1',
      sourceZone: 'hand',
      destinationZone: 'battlefield',
    });
    expect(projectPresentationEvent({
      action: 'play-land',
      status: 'committed',
      cardId: 'land-1',
      sourceZone: 'hand',
      destinationZone: 'graveyard',
    })).toBeNull();
  });

  it('normalizes an actual turn-number change to one turn event, not a phase cue', () => {
    expect(projectPresentationEvent({
      action: 'advance-turn',
      status: 'committed',
      previousTurn: 4,
      nextTurn: 5,
    })).toEqual({ kind: 'turn-advanced', turn: 5 });
    expect(projectPresentationEvent({
      action: 'advance-turn',
      status: 'committed',
      previousTurn: 5,
      nextTurn: 5,
    })).toBeNull();
    expect(projectPresentationEvent({
      action: 'advance-turn',
      status: 'committed',
      previousTurn: 5,
      nextTurn: 4,
    })).toBeNull();
  });

  it.each(['undo', 'redo', 'restore', 'baseline'] as const)(
    'never projects history action %s',
    (action) => {
      expect(projectPresentationEvent({ action })).toBeNull();
    },
  );
});

describe('AV1 session sequencing and no-replay delivery', () => {
  it('assigns one monotonic sequence across all kinds and does not use sourceEventId as identity', () => {
    const times = [10.5, 11.25, 12];
    const sequencer = createPresentationEventSequencer(
      'browser-session',
      () => times.shift() ?? 12,
    );
    const first = sequencer.next(projectPresentationEvent(castInput())!);
    const second = sequencer.next(projectPresentationEvent(castInput())!);
    const third = sequencer.next({
      kind: 'turn-advanced',
      turn: 2,
    });

    expect([first.id, second.id, third.id]).toEqual([
      'browser-session:1',
      'browser-session:2',
      'browser-session:3',
    ]);
    expect(second.id).not.toBe(first.id);
    expect([first.committedAtMs, second.committedAtMs, third.committedAtMs])
      .toEqual([10.5, 11.25, 12]);
  });

  it('does not replay baseline or past delivery to a new/remounted subscriber', () => {
    const sequencer = createPresentationEventSequencer('session', () => 1);
    const channel = createPresentationEventChannel();
    const past = sequencer.next({ kind: 'turn-advanced', turn: 2 });
    channel.publish(past);

    const listener = vi.fn();
    const unsubscribe = channel.subscribe(listener);
    expect(listener).not.toHaveBeenCalled();

    const future = sequencer.next({ kind: 'turn-advanced', turn: 3 });
    channel.publish(future);
    channel.publish(future);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(future);
    unsubscribe();
  });
});
