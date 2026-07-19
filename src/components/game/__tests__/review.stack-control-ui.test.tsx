/** Reviewer-owned Stack Workspace reachability contract for M-STACK-CONTROL. */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { DndContext } from '@dnd-kit/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildVisualFixture } from '../../../dev/visualFixtures/fixtureBuilder';
import { useGameStore } from '../../../store/gameStore';
import { StackBand } from '../StackBand';
import type { GameController } from '../gameController';

afterEach(() => {
  document.body.replaceChildren();
  useGameStore.setState({ state: null });
});

describe('M-STACK-CONTROL Stack Workspace direct controls', () => {
  it('is nonmodal and exposes response, resolution, targeting, and manual removal directly', () => {
    const state = buildVisualFixture('stack').snapshot.state;
    useGameStore.setState({ state, warnings: [], triggerCandidates: [] });
    const requestResolveTop = vi.fn();
    const requestResolveAll = vi.fn();
    const controller = {
      state,
      store: useGameStore.getState(),
      decisionFocus: null,
      requestResolveTop,
      requestResolveAll,
      setManualTargets: vi.fn(),
    } as unknown as GameController;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<DndContext><StackBand controller={controller} /></DndContext>));

    expect(container.querySelector('[data-testid="stack-workspace-backdrop"]')).toBeNull();
    expect(container.querySelector('[data-testid="stack-workspace-scrim"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="stack-band-respond"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="stack-band-resolve-top"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="stack-band-resolve-all"]')).not.toBeNull();
    expect(container.querySelector('[data-testid^="stack-manual-target-"]')).not.toBeNull();
    expect(container.querySelector('[data-testid^="stack-manual-remove-"]')).not.toBeNull();

    act(() => (container.querySelector('[data-testid="stack-band-resolve-top"]') as HTMLButtonElement).click());
    act(() => (container.querySelector('[data-testid="stack-band-resolve-all"]') as HTMLButtonElement).click());
    expect(requestResolveTop).toHaveBeenCalledOnce();
    expect(requestResolveAll).toHaveBeenCalledOnce();
    act(() => root.unmount());
  });
});
