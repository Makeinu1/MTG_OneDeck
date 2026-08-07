/**
 * AV1 ordinary tests — presentationEvents + presentationSequencer.
 * Covers boundary conditions beyond the judge pin.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  projectPresentationEvent,
} from '../presentationEvents';
import {
  createPresentationEventChannel,
  createPresentationEventSequencer,
} from '../presentationSequencer';

describe('projectPresentationEvent — cast boundaries', () => {
  it('spell-cast includes causal source and destination zones', () => {
    const result = projectPresentationEvent({
      action: 'cast',
      status: 'committed',
      cardId: 'c1',
      sourceZone: 'hand',
      destinationZone: 'stack',
      isCommander: false,
      sourceEventId: 'e1',
    });
    expect(result).toEqual({
      kind: 'spell-cast',
      cardId: 'c1',
      sourceZone: 'hand',
      destinationZone: 'stack',
      sourceEventId: 'e1',
    });
  });

  it('commander cast from command zone', () => {
    const result = projectPresentationEvent({
      action: 'cast',
      status: 'committed',
      cardId: 'cmd',
      sourceZone: 'command',
      destinationZone: 'stack',
      isCommander: true,
      sourceEventId: 'e2',
    });
    expect(result).toEqual({
      kind: 'commander-cast',
      cardId: 'cmd',
      sourceZone: 'command',
      destinationZone: 'stack',
      sourceEventId: 'e2',
    });
  });

  it('commander cast from hand still produces commander-cast', () => {
    const result = projectPresentationEvent({
      action: 'cast',
      status: 'committed',
      cardId: 'cmd',
      sourceZone: 'hand',
      destinationZone: 'stack',
      isCommander: true,
      sourceEventId: 'e3',
    });
    expect(result!.kind).toBe('commander-cast');
  });

  it.each(['hand', 'battlefield', 'graveyard', 'exile', 'library'] as const)(
    'rejects committed cast with non-stack destination: %s',
    (destinationZone) => {
      expect(projectPresentationEvent({
        action: 'cast',
        status: 'committed',
        cardId: 'c',
        sourceZone: 'hand',
        destinationZone,
        isCommander: false,
        sourceEventId: 'e',
      })).toBeNull();
    },
  );

  it.each(['failed', 'cancelled', 'needs-confirm', 'needs-payment'] as const)(
    'rejects non-committed cast status: %s',
    (status) => {
      expect(projectPresentationEvent({
        action: 'cast',
        status,
        cardId: 'c',
        sourceZone: 'hand',
        destinationZone: 'stack',
        isCommander: false,
        sourceEventId: 'e',
      })).toBeNull();
    },
  );
});

describe('projectPresentationEvent — land boundaries', () => {
  it('committed land play projects with zones', () => {
    const result = projectPresentationEvent({
      action: 'play-land',
      status: 'committed',
      cardId: 'l1',
      sourceZone: 'hand',
      destinationZone: 'battlefield',
    });
    expect(result).toEqual({
      kind: 'land-played',
      cardId: 'l1',
      sourceZone: 'hand',
      destinationZone: 'battlefield',
    });
  });

  it.each(['hand', 'stack', 'graveyard', 'exile', 'library'] as const)(
    'rejects committed land with non-battlefield destination: %s',
    (destinationZone) => {
      expect(projectPresentationEvent({
        action: 'play-land',
        status: 'committed',
        cardId: 'l',
        sourceZone: 'hand',
        destinationZone,
      })).toBeNull();
    },
  );

  it.each(['failed', 'cancelled', 'needs-confirm', 'needs-payment'] as const)(
    'rejects non-committed land status: %s',
    (status) => {
      expect(projectPresentationEvent({
        action: 'play-land',
        status,
        cardId: 'l',
        sourceZone: 'hand',
        destinationZone: 'hand',
      })).toBeNull();
    },
  );
});

describe('projectPresentationEvent — turn boundaries', () => {
  it('projects actual turn number increase', () => {
    expect(projectPresentationEvent({
      action: 'advance-turn',
      status: 'committed',
      previousTurn: 1,
      nextTurn: 2,
    })).toEqual({ kind: 'turn-advanced', turn: 2 });
  });

  it('rejects same turn number (phase change, not turn)', () => {
    expect(projectPresentationEvent({
      action: 'advance-turn',
      status: 'committed',
      previousTurn: 3,
      nextTurn: 3,
    })).toBeNull();
  });

  it('rejects decreasing turn number', () => {
    expect(projectPresentationEvent({
      action: 'advance-turn',
      status: 'committed',
      previousTurn: 5,
      nextTurn: 4,
    })).toBeNull();
  });

  it.each(['failed', 'cancelled', 'needs-confirm', 'needs-payment'] as const)(
    'rejects non-committed turn status: %s',
    (status) => {
      expect(projectPresentationEvent({
        action: 'advance-turn',
        status,
        previousTurn: 1,
        nextTurn: 2,
      })).toBeNull();
    },
  );
});

describe('projectPresentationEvent — AV7 success boundaries', () => {
  it('projects a phase-only advance to one phase-advanced event', () => {
    expect(projectPresentationEvent({
      action: 'advance-phase',
      status: 'committed',
      previousPhase: 'main1',
      nextPhase: 'combat',
      turnChanged: false,
    })).toEqual({ kind: 'phase-advanced' });
  });

  it('normalizes turn-crossing phase progress to null (turn-advanced owns it)', () => {
    expect(projectPresentationEvent({
      action: 'advance-phase',
      status: 'committed',
      previousPhase: 'end',
      nextPhase: 'main1',
      turnChanged: true,
    })).toBeNull();
  });

  it('rejects unchanged phases and non-committed phase progress', () => {
    expect(projectPresentationEvent({
      action: 'advance-phase',
      status: 'committed',
      previousPhase: 'combat',
      nextPhase: 'combat',
      turnChanged: false,
    })).toBeNull();
    expect(projectPresentationEvent({
      action: 'advance-phase',
      status: 'failed',
      previousPhase: 'main1',
      nextPhase: 'combat',
      turnChanged: false,
    })).toBeNull();
  });

  it('projects committed keep confirmations to one hand-kept event', () => {
    expect(projectPresentationEvent({
      action: 'keep-hand',
      status: 'committed',
    })).toEqual({ kind: 'hand-kept' });
    expect(projectPresentationEvent({
      action: 'keep-hand',
      status: 'cancelled',
    })).toBeNull();
  });

  it('projects one event for a positive manual draw operation', () => {
    expect(projectPresentationEvent({
      action: 'draw',
      status: 'committed',
      requestedCount: 4,
      completedCount: 2,
    })).toEqual({ kind: 'draw-completed', count: 2 });
    expect(projectPresentationEvent({
      action: 'draw',
      status: 'committed',
      requestedCount: 1,
      completedCount: 0,
    })).toBeNull();
  });

  it('projects bulk tap, stack resolution, and shuffle exactly once per input', () => {
    expect(projectPresentationEvent({
      action: 'change-tap',
      status: 'committed',
      cardIds: ['a', 'b'],
      tapped: false,
    })).toEqual({ kind: 'tap-changed', cardIds: ['a', 'b'], tapped: false });
    expect(projectPresentationEvent({
      action: 'resolve-stack',
      status: 'committed',
      resolvedCount: 3,
    })).toEqual({ kind: 'stack-resolved', count: 3 });
    expect(projectPresentationEvent({
      action: 'shuffle-library',
      status: 'committed',
    })).toEqual({ kind: 'shuffle-completed' });
  });

  it('keeps failures, empty changes, and unresolved attempts silent', () => {
    expect(projectPresentationEvent({
      action: 'change-tap',
      status: 'committed',
      cardIds: [],
      tapped: true,
    })).toBeNull();
    expect(projectPresentationEvent({
      action: 'resolve-stack',
      status: 'committed',
      resolvedCount: 0,
    })).toBeNull();
    expect(projectPresentationEvent({
      action: 'shuffle-library',
      status: 'cancelled',
    })).toBeNull();
  });
});

describe('projectPresentationEvent — history actions', () => {
  it.each(['undo', 'redo', 'restore', 'baseline'] as const)(
    'never projects %s',
    (action) => {
      expect(projectPresentationEvent({ action })).toBeNull();
    },
  );
});

describe('sequencer — ID and clock', () => {
  it('IDs are monotonic across kinds', () => {
    const sequencer = createPresentationEventSequencer('s', () => 0);
    const a = sequencer.next({ kind: 'spell-cast', cardId: 'c', sourceZone: 'h', destinationZone: 's', sourceEventId: 'e' });
    const b = sequencer.next({ kind: 'land-played', cardId: 'l', sourceZone: 'h', destinationZone: 'b' });
    const c = sequencer.next({ kind: 'turn-advanced', turn: 1 });
    expect(a.id).toBe('s:1');
    expect(b.id).toBe('s:2');
    expect(c.id).toBe('s:3');
  });

  it('repeated sourceEventId still gets fresh presentation ID', () => {
    const sequencer = createPresentationEventSequencer('x', () => 0);
    const a = sequencer.next({ kind: 'spell-cast', cardId: 'c', sourceZone: 'h', destinationZone: 's', sourceEventId: 'same' });
    const b = sequencer.next({ kind: 'spell-cast', cardId: 'c', sourceZone: 'h', destinationZone: 's', sourceEventId: 'same' });
    expect(a.id).not.toBe(b.id);
  });

  it('committedAtMs comes from injected clock', () => {
    let time = 100;
    const sequencer = createPresentationEventSequencer('s', () => (time += 5));
    const a = sequencer.next({ kind: 'turn-advanced', turn: 1 });
    const b = sequencer.next({ kind: 'turn-advanced', turn: 2 });
    expect(a.committedAtMs).toBe(105);
    expect(b.committedAtMs).toBe(110);
  });
});

describe('channel — future-only, at-most-once', () => {
  it('subscriber does not receive events published before subscription', () => {
    const channel = createPresentationEventChannel();
    const sequencer = createPresentationEventSequencer('s', () => 0);
    const past = sequencer.next({ kind: 'turn-advanced', turn: 1 });
    channel.publish(past);

    const listener = vi.fn();
    channel.subscribe(listener);
    expect(listener).not.toHaveBeenCalled();
  });

  it('duplicate publish of same ID is delivered at most once', () => {
    const channel = createPresentationEventChannel();
    const sequencer = createPresentationEventSequencer('s', () => 0);
    const event = sequencer.next({ kind: 'turn-advanced', turn: 1 });
    const listener = vi.fn();
    channel.subscribe(listener);

    channel.publish(event);
    channel.publish(event);
    channel.publish(event);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops delivery', () => {
    const channel = createPresentationEventChannel();
    const sequencer = createPresentationEventSequencer('s', () => 0);
    const listener = vi.fn();
    const unsub = channel.subscribe(listener);

    channel.publish(sequencer.next({ kind: 'turn-advanced', turn: 1 }));
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    channel.publish(sequencer.next({ kind: 'turn-advanced', turn: 2 }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('multiple subscribers each receive future events', () => {
    const channel = createPresentationEventChannel();
    const sequencer = createPresentationEventSequencer('s', () => 0);
    const a = vi.fn();
    const b = vi.fn();
    channel.subscribe(a);
    channel.subscribe(b);

    const event = sequencer.next({ kind: 'turn-advanced', turn: 1 });
    channel.publish(event);
    expect(a).toHaveBeenCalledWith(event);
    expect(b).toHaveBeenCalledWith(event);
  });
});
