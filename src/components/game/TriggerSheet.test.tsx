import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TriggerCandidate } from '../../engine/triggers';
import type { GameController } from './gameController';
import { TriggerSheet } from './TriggerSheet';

afterEach(() => {
  document.body.replaceChildren();
});

function candidate(id: string, label: string): TriggerCandidate {
  return {
    sourceId: `source-${id}`,
    triggerId: `trigger-${id}`,
    label,
    pendingTriggerId: `pending-${id}`,
  };
}

describe('TriggerSheet', () => {
  it('lets the user order multiple triggers without going through Feed', () => {
    const first = candidate('a', '誘発A');
    const second = candidate('b', '誘発B');
    const placePendingTriggersForPriority = vi.fn();
    const controller = {
      store: {
        triggerCandidates: [first, second],
        placePendingTriggersForPriority,
      },
    } as unknown as GameController;
    const onClose = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<TriggerSheet controller={controller} onClose={onClose} />));

    expect(container.querySelector('[data-testid="trigger-sheet"]')).not.toBeNull();
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="trigger-sheet-down-pending-a"]')
        ?.click();
    });
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="trigger-sheet-place-ordered"]')
        ?.click();
    });

    expect(placePendingTriggersForPriority).toHaveBeenCalledWith(['pending-b', 'pending-a']);
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });
});
