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
      root.render(<TransitionCue cue={{ id: 1, kind: 'phase', turn: 2, phases: ['combat'], drawAtMs: null, durationMs: 650 }} onDone={onDone} />);
    });
    expect(container.querySelector('[data-testid="transition-cue"]')?.textContent).toContain('戦闘');
    act(() => { vi.advanceTimersByTime(649); });
    expect(onDone).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onDone).toHaveBeenCalledWith(1);
    act(() => root.unmount());
    container.remove();
  });

  it('uses the longer turn duration and announces the full beginning sequence', () => {
    vi.useFakeTimers();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onDone = vi.fn();
    act(() => {
      root.render(<TransitionCue cue={{ id: 2, kind: 'turn', turn: 4, phases: ['untap', 'upkeep', 'draw', 'main1'], drawAtMs: 560, durationMs: 1050 }} onDone={onDone} />);
    });
    expect(container.textContent).toContain('第4ターン');
    expect(container.textContent).toContain('メイン1');
    expect(container.textContent).toContain('アップキープ');
    act(() => { vi.advanceTimersByTime(1050); });
    expect(onDone).toHaveBeenCalledWith(2);
    act(() => root.unmount());
    container.remove();
  });

  it('merges the actual drawn card into the draw phase presentation', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <TransitionCue
          cue={{ id: 4, kind: 'phase', turn: 2, phases: ['draw'], drawAtMs: 0, durationMs: 650 }}
          drawCue={{ id: 'd1', cardIds: ['c1'], primaryName: '稲妻', extraCount: 0, delayMs: 0, durationMs: 650, phaseBound: true }}
          onDone={vi.fn()}
        />,
      );
    });
    expect(container.querySelector('[data-testid="transition-draw-detail"]')?.textContent).toContain('《稲妻》を引きました');
    act(() => root.unmount());
    container.remove();
  });

  it('keeps a short static announcement for reduced motion', () => {
    vi.useFakeTimers();
    const matchMedia = vi.fn().mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: matchMedia });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onDone = vi.fn();
    act(() => {
      root.render(<TransitionCue cue={{ id: 3, kind: 'turn', turn: 5, phases: ['untap', 'upkeep', 'draw', 'main1'], drawAtMs: 560, durationMs: 1050 }} onDone={onDone} />);
    });
    expect(container.querySelector('.is-active')?.getAttribute('title')).toBe('メイン1');
    act(() => { vi.advanceTimersByTime(239); });
    expect(onDone).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(onDone).toHaveBeenCalledWith(3);
    act(() => root.unmount());
    container.remove();
    Reflect.deleteProperty(window, 'matchMedia');
  });

  it('restarts the visible lifetime when rapid input replaces the cue', () => {
    vi.useFakeTimers();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onDone = vi.fn();
    act(() => {
      root.render(<TransitionCue cue={{ id: 1, kind: 'phase', turn: 2, phases: ['combat'], drawAtMs: null, durationMs: 650 }} onDone={onDone} />);
    });
    const firstLayer = container.querySelector('[data-testid="transition-cue"]');
    act(() => { vi.advanceTimersByTime(400); });
    act(() => {
      root.render(<TransitionCue cue={{ id: 2, kind: 'phase', turn: 2, phases: ['main2'], drawAtMs: null, durationMs: 650 }} onDone={onDone} />);
    });
    const secondLayer = container.querySelector('[data-testid="transition-cue"]');
    expect(secondLayer).not.toBe(firstLayer);
    expect(secondLayer?.textContent).toContain('メイン2');
    act(() => { vi.advanceTimersByTime(120); });
    expect(onDone).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(530); });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(2);
    act(() => root.unmount());
    container.remove();
  });
});
