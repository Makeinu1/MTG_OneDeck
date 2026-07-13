import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { buildVisualFixture } from '../../dev/visualFixtures/fixtureBuilder';
import { AttackDialog } from './dialogs';

describe('AttackDialog zero-attacker flow', () => {
  it('lets the user explicitly advance without attackers', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onConfirm = vi.fn();
    const state = buildVisualFixture('hand7').snapshot.state;

    act(() => {
      root.render(
        <AttackDialog
          state={state}
          opponentLabels={['対戦相手A']}
          onConfirm={onConfirm}
          onCancel={() => undefined}
        />,
      );
    });

    const button = container.querySelector<HTMLButtonElement>('[data-testid="attack-confirm"]');
    expect(button?.disabled).toBe(false);
    expect(button?.textContent).toContain('攻撃せず進む');
    act(() => button?.click());
    expect(onConfirm).toHaveBeenCalledWith([], '対戦相手A');

    act(() => root.unmount());
    container.remove();
  });
});

