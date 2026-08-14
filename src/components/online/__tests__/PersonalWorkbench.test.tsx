import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import fixture from '../../../online/workbench/fixtures/o4p-04a-personal-workbench-v1.json';
import type { PersonalWorkbenchActionV1 } from '../../../online/workbench/index';
import { PersonalWorkbench } from '../PersonalWorkbench';

describe('PersonalWorkbench', () => {
  it('keeps refresh available while server-bound controls wait for a ready interaction', () => {
    const actions: PersonalWorkbenchActionV1[] = [];
    const container = document.createElement('div');
    const root = createRoot(container);
    const renderWorkbench = (interactionState: 'ready' | 'updating') => act(() => {
      root.render(
        <PersonalWorkbench projection={fixture} interactionState={interactionState} onAction={(action) => actions.push(action)} />,
      );
    });

    renderWorkbench('updating');
    const refresh = container.querySelector<HTMLButtonElement>('[data-testid="workbench-refresh"]');
    const pass = container.querySelector<HTMLButtonElement>('[data-testid="workbench-priority-pass"]');
    const concede = container.querySelector<HTMLButtonElement>('[data-testid="workbench-concede"]');
    if (!refresh || !pass || !concede) throw new Error('Expected action controls');

    act(() => refresh.click());
    expect(actions).toEqual([{ kind: 'request-refresh', knownRevision: 12 }]);
    expect(pass.disabled).toBe(true);
    expect(concede.disabled).toBe(true);

    renderWorkbench('ready');
    const readyConcede = container.querySelector<HTMLButtonElement>('[data-testid="workbench-concede"]');
    if (!readyConcede) throw new Error('Expected ready concede control');
    act(() => readyConcede.click());
    expect(container.querySelector('[data-testid="workbench-concede-confirmation"]')).not.toBeNull();
    const confirm = container.querySelector<HTMLButtonElement>('[data-testid="workbench-concede-confirm"]');
    if (!confirm) throw new Error('Expected concede confirmation control');
    act(() => confirm.click());
    expect(actions.at(-1)).toEqual({ kind: 'concede', actorPlayerId: 'P1', baseRevision: 12 });
    act(() => root.unmount());
  });

  it('allows a lifecycle-active player to request priority pass away from their own turn', () => {
    const actions: PersonalWorkbenchActionV1[] = [];
    const projection = JSON.parse(JSON.stringify(fixture)) as typeof fixture;
    projection.game.turn.activePlayerId = 'P2';
    const container = document.createElement('div');
    const root = createRoot(container);

    act(() => {
      root.render(<PersonalWorkbench projection={projection} interactionState="ready" onAction={(action) => actions.push(action)} />);
    });
    const pass = container.querySelector<HTMLButtonElement>('[data-testid="workbench-priority-pass"]');
    if (!pass) throw new Error('Expected priority pass control');
    expect(pass.disabled).toBe(false);
    act(() => pass.click());
    expect(actions).toEqual([{ kind: 'priority-pass', actorPlayerId: 'P1', baseRevision: 12 }]);
    act(() => root.unmount());
  });

  it('disables repeated concede for the same player and revision', () => {
    const actions: PersonalWorkbenchActionV1[] = [];
    const container = document.createElement('div');
    const root = createRoot(container);
    const renderWorkbench = (projection: unknown) => act(() => {
      root.render(<PersonalWorkbench projection={projection} interactionState="ready" onAction={(action) => actions.push(action)} />);
    });

    renderWorkbench(fixture);
    const concede = container.querySelector<HTMLButtonElement>('[data-testid="workbench-concede"]');
    if (!concede) throw new Error('Expected concede control');
    act(() => concede.click());
    const confirm = container.querySelector<HTMLButtonElement>('[data-testid="workbench-concede-confirm"]');
    if (!confirm) throw new Error('Expected concede confirmation control');
    act(() => confirm.click());
    expect(actions).toEqual([{ kind: 'concede', actorPlayerId: 'P1', baseRevision: 12 }]);

    renderWorkbench(JSON.parse(JSON.stringify(fixture)) as typeof fixture);
    const repeated = container.querySelector<HTMLButtonElement>('[data-testid="workbench-concede"]');
    if (!repeated) throw new Error('Expected repeated concede control');
    expect(repeated.disabled).toBe(true);

    const nextRevision = JSON.parse(JSON.stringify(fixture)) as typeof fixture;
    nextRevision.revision = 13;
    renderWorkbench(nextRevision);
    const renewed = container.querySelector<HTMLButtonElement>('[data-testid="workbench-concede"]');
    if (!renewed) throw new Error('Expected renewed concede control');
    expect(renewed.disabled).toBe(false);
    act(() => root.unmount());
  });

  it('invalidates an open concede confirmation when the validated revision changes', () => {
    const actions: PersonalWorkbenchActionV1[] = [];
    const container = document.createElement('div');
    const root = createRoot(container);
    const renderWorkbench = (projection: unknown) => act(() => {
      root.render(<PersonalWorkbench projection={projection} interactionState="ready" onAction={(action) => actions.push(action)} />);
    });

    renderWorkbench(fixture);
    const concede = container.querySelector<HTMLButtonElement>('[data-testid="workbench-concede"]');
    if (!concede) throw new Error('Expected concede control');
    act(() => concede.click());
    expect(container.querySelector('[data-testid="workbench-concede-confirmation"]')).not.toBeNull();

    const nextRevision = JSON.parse(JSON.stringify(fixture)) as typeof fixture;
    nextRevision.revision = 13;
    renderWorkbench(nextRevision);
    expect(container.querySelector('[data-testid="workbench-concede-confirmation"]')).toBeNull();
    expect(actions).toEqual([]);
    act(() => root.unmount());
  });

  it('renders public concealed damage and Japanese player lifecycle labels', () => {
    const projection = JSON.parse(JSON.stringify(fixture)) as typeof fixture;
    const concealed = projection.game.zones.battlefield.entries[1] as unknown as {
      runtime: { markedDamage: number };
    };
    concealed.runtime.markedDamage = 3;
    const exitedPlayer = projection.game.players[1] as unknown as {
      status: string;
      exitCause: string | null;
    };
    const concededSeat = projection.room.seats[1] as unknown as { outcome: string };
    exitedPlayer.status = 'exited';
    exitedPlayer.exitCause = 'concession';
    concededSeat.outcome = 'conceded';

    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => {
      root.render(<PersonalWorkbench projection={projection} interactionState="ready" onAction={() => {}} />);
    });
    expect(container.textContent).toContain('ダメージ 3');
    expect(container.textContent).toContain('状態 プレイ中');
    expect(container.textContent).toContain('状態 退席済み');
    act(() => root.unmount());
  });
});
