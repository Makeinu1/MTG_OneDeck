import { DndContext } from '@dnd-kit/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CardView } from './CardView';
import { TOUCH_DRAG_DELAY_MS } from './touchDrag';
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
  onTouchTap?: (event: React.PointerEvent<HTMLDivElement>) => void,
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <DndContext>
        <CardView
          instance={instance}
          def={def}
          onContextMenu={onContextMenu}
          onTouchTap={onTouchTap}
        />
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

  it('leaves no gap between the tap ceiling and the drag threshold', () => {
    // tap 上限と drag しきい値の間に隙間があると、その保持時間では tap も drag も
    // 起きず、抑止されない合成 click がマウス用の経路へ落ちる(再タップでメニューが
    // 開かず閉じるだけになる)。ドラッグに変わる直前まではタップとして扱うこと。
    const onTouchTap = vi.fn();
    const nowSpy = vi.spyOn(performance, 'now');
    nowSpy.mockReturnValue(0);
    const { card, container, root } = renderCard(
      vi.fn(),
      TEST_CARD_INSTANCE,
      TEST_CARD_DEF,
      onTouchTap,
    );

    dispatchPointerEvent(card, 'pointerdown', { pointerType: 'touch', clientX: 20, clientY: 20 });
    // ドラッグ発火の直前(旧実装ではここが死角だった)。
    nowSpy.mockReturnValue(TOUCH_DRAG_DELAY_MS - 1);
    dispatchPointerEvent(card, 'pointerup', { pointerType: 'touch', clientX: 20, clientY: 20 });

    expect(onTouchTap).toHaveBeenCalledTimes(1);

    nowSpy.mockRestore();
    cleanupRender(root, container);
  });

  it('keeps every TouchSensor on the shared activation constraint', () => {
    // delay を各所でハードコードすると tap 上限との間に窓ができ、その保持時間では
    // ドラッグとタップが同時に成立する(CardView の tap 判定は drag 進行中を見ず、
    // ガードを持つのは GameCard だけ=Playmat 経路には無い)。宣言だけの不変条件は
    // 実際に破られたので、機械で強制する。
    const roots = [join(process.cwd(), 'src')];
    const files: string[] = [];
    while (roots.length) {
      const dir = roots.pop()!;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) roots.push(full);
        // 本番の sensor 構築だけが対象(テスト自身は走査文字列を含むため除外)。
        else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) files.push(full);
      }
    }

    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      const where = file.replace(process.cwd(), '.');

      // ① TouchSensor を import するファイルは共有定数も import していること。
      //    改行を挟む整形にも `TouchSensor as TS` の別名にも効く(定数を一度も
      //    import しない新規ファイルが独自 sensor を足す経路を塞ぐ)。
      //    未使用 import は lint が落とすので、import されていれば使われている。
      if (/import\s*\{[^}]*\bTouchSensor\b[^}]*\}\s*from\s*'@dnd-kit\/core'/s.test(text)
        && !text.includes('TOUCH_DRAG_ACTIVATION')) {
        offenders.push(`${where}: imports TouchSensor without TOUCH_DRAG_ACTIVATION`);
      }

      // ② 各 useSensor(TouchSensor, ...) が共有定数を参照していること(空白/改行を吸収)。
      for (const match of text.matchAll(/useSensor\(\s*TouchSensor\b/g)) {
        const call = text.slice(match.index, match.index + 200);
        if (!call.includes('TOUCH_DRAG_ACTIVATION')) {
          offenders.push(`${where}: ${call.split('\n')[0].trim()}`);
        }
      }
    }

    expect(offenders).toEqual([]);
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

  it('routes a short touch tap to the dedicated preview action when provided', () => {
    const onContextMenu = vi.fn();
    const onTouchTap = vi.fn();
    const { card, container, root } = renderCard(
      onContextMenu,
      TEST_CARD_INSTANCE,
      TEST_CARD_DEF,
      onTouchTap,
    );

    dispatchPointerEvent(card, 'pointerdown', {
      pointerType: 'touch',
      clientX: 20,
      clientY: 20,
    });
    dispatchPointerEvent(card, 'pointerup', {
      pointerType: 'touch',
      clientX: 22,
      clientY: 21,
    });

    expect(onTouchTap).toHaveBeenCalledTimes(1);
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

describe('CardView drag registration', () => {
  it('registers only the real card when a display copy shares its id', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <DndContext>
          <div data-testid="real-card">
            <CardView instance={TEST_CARD_INSTANCE} def={TEST_CARD_DEF} draggable />
          </div>
          <div data-testid="display-copy">
            <CardView instance={TEST_CARD_INSTANCE} def={TEST_CARD_DEF} draggable={false} />
          </div>
        </DndContext>,
      );
    });

    const realCard = container.querySelector('[data-testid="real-card"] .card-view');
    const displayCopy = container.querySelector('[data-testid="display-copy"] .card-view');
    expect(realCard?.getAttribute('aria-roledescription')).toBe('draggable');
    expect(displayCopy?.hasAttribute('aria-roledescription')).toBe(false);
    expect(container.querySelectorAll('[aria-roledescription="draggable"]')).toHaveLength(1);

    cleanupRender(root, container);
  });
});
