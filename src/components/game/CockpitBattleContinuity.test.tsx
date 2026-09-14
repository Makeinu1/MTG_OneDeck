import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import {
  applyTableOperation,
  createCockpitTable,
  type CockpitTable,
} from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import { CockpitBattleTools } from './CockpitBattleTools';

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: vi.fn(),
});

function renderBattle(root: Root, table: CockpitTable) {
  act(() =>
    root.render(
      <CockpitBattleTools
        table={table}
        selected={[]}
        disabled={false}
        send={vi.fn(() => Promise.resolve(true))}
      />,
    ),
  );
}

it('invalidates a damage draft when its combat source leaves instead of rendering stale work as valid', () => {
  const deck = makeDeck(20).map((item) => ({
    ...item,
    def: {
      ...item.def,
      faces: [{ name: item.def.name, typeLine: 'Creature', power: '3', toughness: '3' }],
    },
  }));
  let table = createCockpitTable(deck, 1, [deck, deck]);
  table.seats.forEach((seat) => {
    seat.kept = true;
  });
  const attacker = table.seats[0].zones.hand[0];
  table = applyTableOperation(table, {
    type: 'move',
    ids: [attacker],
    to: 'battlefield',
    position: 'top',
  });
  table = applyTableOperation(table, {
    type: 'battle.attack',
    attackers: [{ cardId: attacker, targetId: 'P2' }],
    tapIds: [attacker],
  });

  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    renderBattle(root, table);
    const suggest = [...host.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent === 'ブロックなしの割当を作る',
    )!;
    act(() => suggest.click());
    expect(host.textContent).toContain('40 → 37');

    table = applyTableOperation(table, {
      type: 'move',
      ids: [attacker],
      to: 'exile',
      position: 'top',
    });
    expect(() => renderBattle(root, table)).not.toThrow();
    expect(host.textContent).toContain('戦闘やカードが変わりました');
    const apply = [...host.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent === 'このダメージを反映',
    )!;
    expect(apply.disabled).toBe(true);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

it('renders a partial combat projection with a missing participant without dereferencing it', () => {
  const deck = makeDeck(20).map((item) => ({
    ...item,
    def: {
      ...item.def,
      faces: [{ name: item.def.name, typeLine: 'Creature', power: '3', toughness: '3' }],
    },
  }));
  let table = createCockpitTable(deck, 1, [deck, deck]);
  table.seats.forEach((seat) => {
    seat.kept = true;
  });
  const attacker = table.seats[0].zones.hand[0];
  table = applyTableOperation(table, {
    type: 'move',
    ids: [attacker],
    to: 'battlefield',
    position: 'top',
  });
  table = applyTableOperation(table, {
    type: 'battle.attack',
    attackers: [{ cardId: attacker, targetId: 'P2' }],
    tapIds: [attacker],
  });
  const partial = structuredClone(table);
  delete partial.cards[attacker];
  partial.seats[0].zones.battlefield = partial.seats[0].zones.battlefield.filter(
    (id) => id !== attacker,
  );

  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    expect(() => renderBattle(root, partial)).not.toThrow();
    expect(host.textContent).toContain(attacker);
    expect(host.textContent).toContain('プレイヤー2');
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
