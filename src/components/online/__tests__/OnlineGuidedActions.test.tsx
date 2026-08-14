// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import fixture from '../../../online/workbench/fixtures/o4p-04a-personal-workbench-v1.json';
import { OnlineGuidedActions } from '../OnlineGuidedActions';

describe('OnlineGuidedActions', () => {
  it('renders all five truthful Japanese families and keeps server actions disabled offline', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => { root.render(<OnlineGuidedActions projection={fixture} interactionState="offline" onAction={() => undefined} />); });
    const byTestId = (id: string): HTMLElement => {
      const element = container.querySelector<HTMLElement>(`[data-testid="${id}"]`);
      if (element === null) throw new Error(`Missing ${id}`);
      return element;
    };
    expect(byTestId('online-guided-actions')).toBeTruthy();
    expect(byTestId('guided-control').textContent).toContain('コントロール');
    expect(byTestId('guided-search').textContent).toContain('ライブラリー探索');
    expect(byTestId('manual-face-down').textContent).toContain('手動記録（未送信）');
    expect(byTestId('guided-combat').textContent).toContain('戦闘');
    expect(byTestId('manual-correction').textContent).toContain('手動修正');
    expect(byTestId('guided-control').querySelector('button')?.disabled).toBe(true);
    act(() => { root.unmount(); });
  });
});
