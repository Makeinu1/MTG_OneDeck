import { DndContext } from '@dnd-kit/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CardView } from './CardView';
import type { CardInstance } from '../engine/types';
import type { CardDef } from '../types/card';

const TEST_CARD_DEF: CardDef = {
  scryfallId: 'card-1',
  oracleId: 'oracle-1',
  name: 'Test Card',
  lang: 'ja',
  layout: 'normal',
  cmc: 2,
  colorIdentity: [],
  typeLine: 'Artifact',
  faces: [{ name: 'Test Card', printedName: 'テストカード', typeLine: 'Artifact' }],
};

const TEST_CARD_INSTANCE: CardInstance = {
  id: 'c1',
  defId: TEST_CARD_DEF.scryfallId,
  zone: 'hand',
  tapped: false,
  faceIndex: 0,
  faceDown: false,
  counters: {},
  isToken: false,
  isCommander: false,
  enteredTurn: 0,
};

function dispatchPointerEvent(
  element: Element,
  type: string,
  init: { clientX: number; clientY: number; pointerType: string; pointerId?: number },
): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.clientX,
    clientY: init.clientY,
  });
  Object.defineProperty(event, 'pointerId', { value: init.pointerId ?? 1 });
  Object.defineProperty(event, 'pointerType', { value: init.pointerType });
  act(() => {
    element.dispatchEvent(event);
  });
}

function renderCard(
  onContextMenu?: (
    event: React.MouseEvent<HTMLDivElement> | React.PointerEvent<HTMLDivElement>
  ) => void,
  instance: CardInstance = TEST_CARD_INSTANCE,
  def: CardDef = TEST_CARD_DEF,
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <DndContext>
        <CardView instance={instance} def={def} onContextMenu={onContextMenu} />
      </DndContext>,
    );
  });

  const card = container.querySelector('[data-testid="card-c1"]');
  if (!(card instanceof HTMLDivElement)) {
    throw new Error('card view not rendered');
  }

  return { container, root, card };
}

function cleanupRender(root: Root, container: HTMLDivElement): void {
  act(() => {
    root.unmount();
  });
  container.remove();
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('CardView touch menu', () => {
  it('opens the menu on a short touch tap', () => {
    const onContextMenu = vi.fn();
    const { card, container, root } = renderCard(onContextMenu);

    dispatchPointerEvent(card, 'pointerdown', {
      pointerType: 'touch',
      clientX: 20,
      clientY: 20,
    });
    dispatchPointerEvent(card, 'pointerup', {
      pointerType: 'touch',
      clientX: 24,
      clientY: 24,
    });

    expect(onContextMenu).toHaveBeenCalledTimes(1);

    cleanupRender(root, container);
  });

  it('does not open the menu for mouse pointer events', () => {
    const onContextMenu = vi.fn();
    const { card, container, root } = renderCard(onContextMenu);

    dispatchPointerEvent(card, 'pointerdown', {
      pointerType: 'mouse',
      clientX: 20,
      clientY: 20,
    });
    dispatchPointerEvent(card, 'pointerup', {
      pointerType: 'mouse',
      clientX: 20,
      clientY: 20,
    });

    expect(onContextMenu).not.toHaveBeenCalled();

    cleanupRender(root, container);
  });
});

describe('CardView keyword badges', () => {
  it('shows printed and manual keyword badges without duplicating invalid manual ids', () => {
    const def: CardDef = {
      ...TEST_CARD_DEF,
      typeLine: 'Creature',
      faces: [
        {
          name: 'Test Card',
          printedName: 'テストカード',
          typeLine: 'Creature',
          oracleText: 'Flying',
        },
      ],
    };
    const instance: CardInstance = {
      ...TEST_CARD_INSTANCE,
      zone: 'battlefield',
      manualKeywords: ['haste', 'invalid', 'flying'],
    };

    const { container, root } = renderCard(undefined, instance, def);

    expect(container.querySelector('[title="flying"]')?.textContent).toBe('飛');
    expect(container.querySelector('[title="haste"]')?.textContent).toBe('速');
    expect(container.querySelector('[title="invalid"]')).toBeNull();

    cleanupRender(root, container);
  });
});
