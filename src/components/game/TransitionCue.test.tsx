import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TransitionCue } from './TransitionCue';

afterEach(() => vi.useRealTimers());

describe('TransitionCue', () => {
  it('is non-blocking and expires after the phase duration', () => {
    vi.useFakeTimers();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onDone = vi.fn();
    act(() => {
      root.render(<TransitionCue cue={{ id: 1, kind: 'phase', turn: 2, phase: 'combat' }} onDone={onDone} />);
    });
    expect(container.querySelector('[data-testid="transition-cue"]')?.textContent).toContain('戦闘');
    act(() => { vi.advanceTimersByTime(759); });
    expect(onDone).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onDone).toHaveBeenCalledWith(1);
    act(() => root.unmount());
    container.remove();
  });

  it('uses the longer turn duration and announces only the final phase', () => {
    vi.useFakeTimers();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onDone = vi.fn();
    act(() => {
      root.render(<TransitionCue cue={{ id: 2, kind: 'turn', turn: 4, phase: 'main1' }} onDone={onDone} />);
    });
    expect(container.textContent).toContain('第4ターン');
    expect(container.textContent).toContain('メイン1');
    expect(container.textContent).not.toContain('アップキープ');
    act(() => { vi.advanceTimersByTime(1100); });
    expect(onDone).toHaveBeenCalledWith(2);
    act(() => root.unmount());
    container.remove();
  });

  it('restarts the visible lifetime when rapid input replaces the cue', () => {
    vi.useFakeTimers();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onDone = vi.fn();
    act(() => {
      root.render(<TransitionCue cue={{ id: 1, kind: 'phase', turn: 2, phase: 'combat' }} onDone={onDone} />);
    });
    const firstLayer = container.querySelector('[data-testid="transition-cue"]');
    act(() => { vi.advanceTimersByTime(400); });
    act(() => {
      root.render(<TransitionCue cue={{ id: 2, kind: 'phase', turn: 2, phase: 'main2' }} onDone={onDone} />);
    });
    const secondLayer = container.querySelector('[data-testid="transition-cue"]');
    expect(secondLayer).not.toBe(firstLayer);
    expect(secondLayer?.textContent).toContain('メイン2');
    act(() => { vi.advanceTimersByTime(360); });
    expect(onDone).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(400); });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(2);
    act(() => root.unmount());
    container.remove();
  });
});
