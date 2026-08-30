// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
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

  it('submits server-bound Manual Damage only for a projected attack target and steward', () => {
    const projected = {
      ...fixture,
      kind: 'online-participant-projection-v4',
      schemaVersion: 4,
      configuration: { playerCount: 4, startingLife: 40 },
      room: {
        ...fixture.room,
        seats: fixture.room.seats.map((seat) => ({ ...seat, acceptedDeck: true })),
      },
      game: {
        ...fixture.game,
        zones: {
          ...fixture.game.zones,
          battlefield: {
            ...fixture.game.zones.battlefield,
            entries: fixture.game.zones.battlefield.entries.map((entry) => entry.kind === 'concealed-object' ? { ...entry, controllerPlayerId: 'P2' } : entry),
          },
        },
        priorityHolds: [],
        assistedPriority: {
          holderPlayerId: 'P1', stewardPlayerId: 'P1', windowKind: 'priority', holds: [],
          responseWindow: null, topStackObjectId: null, sourceObjectId: null,
          targetObjectIds: [], targetPlayerIds: [], undoAuthorizedPlayerId: null, recentResolution: null,
        },
        combat: {
          step: 'declare-attackers', attackingPlayerId: 'P1',
          attacks: [{ attackerObjectId: 'PC1:0', defendingPlayerId: 'P2' }], blocks: [],
        },
        commanderDamage: [], winnerPlayerId: null,
        checkpoint: { available: false, informationExposureWarning: false },
      },
    };
    const onSubmit = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => root.render(<OnlineGuidedActions projection={projected} interactionState="ready" busy={false} onAction={() => undefined} onSubmitManualCombatDamage={onSubmit} />));
    const form = container.querySelector<HTMLElement>('[data-testid="manual-combat-damage"]');
    expect(form).not.toBeNull();
    const defender = container.querySelector<HTMLSelectElement>('[data-testid="online-manual-damage-defender"]');
    const submit = container.querySelector<HTMLButtonElement>('[data-testid="online-manual-damage-submit"]');
    expect(defender?.disabled).toBe(false);
    expect(submit?.disabled).toBe(true);
    act(() => {
      if (defender) {
        const setter = Reflect.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
        if (setter) Reflect.apply(setter, defender, ['P2']);
        defender.dispatchEvent(new Event('input', { bubbles: true }));
        defender.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    expect(submit?.disabled).toBe(false);
    act(() => {
      const formElement = container.querySelector<HTMLFormElement>('[data-testid="manual-combat-damage"]');
      formElement?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(onSubmit).toHaveBeenCalledWith({ defendingPlayerId: 'P2', damage: 1, commanderObjectId: null });
    act(() => root.unmount());
  });
});
