import { describe, expect, it, vi } from 'vitest';
import { createPresentationRuntime } from './presentationRuntime';

describe('createPresentationRuntime', () => {
  it('rejects failed/cancelled events and returns null', () => {
    const runtime = createPresentationRuntime('test', () => 100);
    const listener = vi.fn();
    runtime.subscribe(listener);

    const result = runtime.publish({
      action: 'cast',
      status: 'failed',
      cardId: 'c1',
      sourceZone: 'hand',
      destinationZone: 'stack',
      isCommander: false,
      sourceEventId: 'e:0',
    });
    expect(result).toBeNull();
    expect(listener).not.toHaveBeenCalled();
  });

  it('publishes committed events to current and future subscribers', () => {
    const runtime = createPresentationRuntime('test', () => 42);
    const early = vi.fn();
    runtime.subscribe(early);

    const event = runtime.publish({
      action: 'cast',
      status: 'committed',
      cardId: 'c1',
      sourceZone: 'hand',
      destinationZone: 'stack',
      isCommander: false,
      sourceEventId: 'e:1',
    });
    expect(event).toMatchObject({ kind: 'spell-cast', committedAtMs: 42 });
    expect(early).toHaveBeenCalledTimes(1);

    const late = vi.fn();
    runtime.subscribe(late);
    runtime.publish({
      action: 'play-land',
      status: 'committed',
      cardId: 'c2',
      sourceZone: 'hand',
      destinationZone: 'battlefield',
    });
    expect(late).toHaveBeenCalledTimes(1);
    expect(early).toHaveBeenCalledTimes(2);
  });

  it('uses monotonic clock only (no Date.now fallback)', () => {
    const clock = vi.fn(() => 999);
    const runtime = createPresentationRuntime('mono', clock);
    const event = runtime.publish({
      action: 'advance-turn',
      status: 'committed',
      previousTurn: 1,
      nextTurn: 2,
    });
    expect(event?.committedAtMs).toBe(999);
    expect(clock).toHaveBeenCalled();
  });

  it('unsubscribed listeners do not receive events', () => {
    const runtime = createPresentationRuntime('test', () => 0);
    const listener = vi.fn();
    const unsub = runtime.subscribe(listener);
    unsub();
    runtime.publish({
      action: 'advance-turn',
      status: 'committed',
      previousTurn: 1,
      nextTurn: 2,
    });
    expect(listener).not.toHaveBeenCalled();
  });
});
