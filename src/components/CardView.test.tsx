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
  ownerId: 'P1',
  controllerId: 'P1',
  zoneChangeCounter: 0,
  tapped: false,
  faceIndex: 0,
  faceDown: false,
  counters: {},
  damageMarked: 0,
  hasDeathtouchDamage: false,
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
    event: React.MouseEvent<HTMLDivElement> | React.PointerEvent<HTMLDivElement>,
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

describe('CardView visual states', () => {
  it('uses a private OneDeck back without leaking face information', () => {
    const secretDef: CardDef = {
      ...TEST_CARD_DEF,
      name: 'Secret Identity',
      faces: [{ name: 'Secret Identity', printedName: '秘密の正体', typeLine: 'Creature', oracleText: 'Secret rules.' }],
    };
    const { container, card, root } = renderCard(undefined, { ...TEST_CARD_INSTANCE, faceDown: true }, secretDef);

    expect(card.title).toBe('裏向きのカード');
    expect(container.textContent).not.toContain('秘密の正体');
    expect(container.innerHTML).not.toContain('Secret Identity');
    expect(container.querySelector('img')?.alt).toBe('OneDeckのカード裏面');

    cleanupRender(root, container);
  });

  it('renders known token art and retains token identity metadata', () => {
    const tokenDef: CardDef = {
      ...TEST_CARD_DEF,
      name: 'Treasure',
      typeLine: 'Token Artifact — Treasure',
      tokenKind: 'treasure',
      faces: [{ name: 'Treasure', printedName: '宝物', typeLine: 'Token Artifact — Treasure' }],
    };
    const { container, root } = renderCard(undefined, { ...TEST_CARD_INSTANCE, isToken: true }, tokenDef);

    expect(container.querySelector('[data-token-art="treasure"] img')?.getAttribute('src')).toContain('Treasure');
    expect(container.querySelector('.card-view__badge--token')?.textContent).toBe('T');

    cleanupRender(root, container);
  });

  it('marks a DFC and exposes its currently selected face only', () => {
    const dfcDef: CardDef = {
      ...TEST_CARD_DEF,
      layout: 'transform',
      faces: [
        { name: 'Front', printedName: '表面', typeLine: 'Creature' },
        { name: 'Back', printedName: '裏面', typeLine: 'Creature' },
      ],
    };
    const { container, card, root } = renderCard(undefined, { ...TEST_CARD_INSTANCE, faceIndex: 1 }, dfcDef);

    expect(card.classList.contains('card-view--dfc')).toBe(true);
    expect(card.title).toBe('裏面');
    expect(container.textContent).toContain('両面カード');

    cleanupRender(root, container);
  });
});
