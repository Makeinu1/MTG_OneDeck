import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildVisualFixture } from '../../dev/visualFixtures/fixtureBuilder';
import { ArrangeTopDialog } from './dialogs';
import { CastFaceDialog } from './dialogs';
import { makeDef } from '../../engine/__tests__/helpers';

afterEach(() => document.body.replaceChildren());

function renderDialog(initialCount?: number) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(
    <ArrangeTopDialog
      state={buildVisualFixture('hand7').snapshot.state}
      initialCount={initialCount}
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
    />,
  ));
  return { container, root };
}

describe('ArrangeTopDialog defaults', () => {
  it('starts manual scry and surveil at one card', () => {
    const { container, root } = renderDialog();
    expect(container.querySelector<HTMLInputElement>('[data-testid="scry-count"]')?.value).toBe('1');
    expect(container.textContent).toContain('占術 1');
    act(() => root.unmount());
  });

  it('preserves an explicit count supplied by a card effect', () => {
    const { container, root } = renderDialog(3);
    expect(container.querySelector<HTMLInputElement>('[data-testid="scry-count"]')?.value).toBe('3');
    expect(container.textContent).toContain('占術 3');
    act(() => root.unmount());
  });
});

describe('CastFaceDialog', () => {
  it('offers both MDFC faces and reports the chosen face index', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onChoose = vi.fn();
    const def = makeDef({
      scryfallId: 'dialog-dfc',
      layout: 'modal_dfc',
      faces: [
        { name: 'Front', printedName: '表面', typeLine: 'Legendary Creature', manaCost: '{G}' },
        { name: 'Back', printedName: '裏面', typeLine: 'Legendary Planeswalker', manaCost: '{3}{U}' },
      ],
    });
    act(() => root.render(
      <CastFaceDialog def={def} initialFaceIndex={1} onChoose={onChoose} onCancel={vi.fn()} />,
    ));
    expect(container.textContent).toContain('《表面》');
    expect(container.textContent).toContain('《裏面》');
    expect(container.querySelector('[data-testid="cast-face-1"]')?.getAttribute('data-autofocus')).toBe('true');
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="cast-face-1"]')?.click());
    expect(onChoose).toHaveBeenCalledWith(1);
    act(() => root.unmount());
  });
});
