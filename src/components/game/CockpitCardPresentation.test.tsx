import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { applyTableOperation, createCockpitTable } from '../../engine/cockpitTable';
import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import { CardView } from '../CardView';
import { CardPreview } from './CardPreview';
import { CockpitCardPresentation } from './CockpitCardPresentation';
import { CockpitBattleTools } from './CockpitBattleTools';
import { cockpitGameState } from './cockpitGameState';
import { bundleVisibleTokens } from './battlefieldProjection';

vi.mock('../../data/scryfall', () => ({
  needsJapaneseDisplayRefresh: () => false,
  refreshJapaneseCardDefs: vi.fn(),
}));
function setup() {
  const def = makeDef({
    scryfallId: 'same',
    faces: [{ name: 'same', typeLine: 'Creature', power: '2', toughness: '2' }],
  });
  let table = createCockpitTable(
    makeDeck(12).map((row) => ({ ...row, def })),
    1,
  );
  const ids = table.seats[0].zones.hand.slice(0, 2);
  table = applyTableOperation(table, { type: 'move', ids, to: 'battlefield', position: 'top' });
  ids.forEach((id) => {
    table.cards[id].isToken = true;
  });
  table = applyTableOperation(table, {
    type: 'battle.attack',
    attackers: [{ cardId: ids[0], targetId: 'P2' }],
    tapIds: [],
  });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const render = (next = table) =>
    act(() =>
      root.render(
        <CockpitCardPresentation table={next}>
          {ids.map((id) => (
            <CardView key={id} instance={next.cards[id]} def={next.defs[next.cards[id].defId]} />
          ))}
          <CardPreview
            instance={next.cards[ids[0]]}
            def={next.defs[next.cards[ids[0]].defId]}
            anchor={{ x: 100, y: 100 }}
            onOpenMenu={() => {}}
          />
          <CockpitBattleTools
            table={next}
            selected={[]}
            disabled={false}
            visible={false}
            send={() => Promise.resolve(true)}
          />
        </CockpitCardPresentation>,
      ),
    );
  render();
  return {
    table,
    ids,
    host,
    render,
    close: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}
it('shows the same P/T on a raw battlefield card, its portal preview and combat proposal', () => {
  const s = setup();
  try {
    const modifier = {
      id: 'boost',
      cardId: s.ids[0],
      power: 3,
      toughness: 4,
      duration: 'ターン終了まで',
      sourceId: null,
    };
    const changed = applyTableOperation(s.table, { type: 'modifier', modifier, remove: false });
    s.render(changed);
    expect(s.host.querySelector(`[data-testid="recorded-pt-${s.ids[0]}"]`)?.textContent).toBe(
      'P/T 5/6',
    );
    expect(
      document.querySelector(`.game-card-preview [data-testid="recorded-pt-${s.ids[0]}"]`)
        ?.textContent,
    ).toBe('P/T 5/6');
    expect(s.host.querySelector(`[data-testid="recorded-pt-${s.ids[1]}"]`)?.textContent).toBe(
      'P/T 2/2',
    );
    act(() =>
      [...s.host.querySelectorAll('button')]
        .find((b) => b.textContent === 'ブロックなしの割当を作る')!
        .click(),
    );
    expect(s.host.textContent).toContain('40 → 35');
    s.render(applyTableOperation(changed, { type: 'modifier', modifier, remove: true }));
    expect(s.host.querySelector(`[data-testid="recorded-pt-${s.ids[0]}"]`)?.textContent).toBe(
      'P/T 2/2',
    );
    expect(
      [...s.host.querySelectorAll('button')].find((b) => b.textContent === 'このダメージを反映')
        ?.disabled,
    ).toBe(true);
    const peaceful = structuredClone(changed);
    peaceful.combat = null;
    expect(bundleVisibleTokens(cockpitGameState(peaceful, 'P1'), s.ids)).toHaveLength(2);
    peaceful.modifiers = [];
    expect(bundleVisibleTokens(cockpitGameState(peaceful, 'P1'), s.ids)).toHaveLength(1);
  } finally {
    s.close();
  }
});
it('shows unknown P/T without suggesting damage and does not expose hidden base stats', () => {
  const s = setup();
  try {
    const unknown = structuredClone(s.table);
    unknown.defs[unknown.cards[s.ids[0]].defId].faces[0].power = '*';
    s.render(unknown);
    expect(s.host.querySelector(`[data-testid="recorded-pt-${s.ids[0]}"]`)?.textContent).toBe(
      'P/T ?/2',
    );
    expect(
      [...s.host.querySelectorAll('button')].find(
        (b) => b.textContent === 'ブロックなしの割当を作る',
      )?.disabled,
    ).toBe(true);
    unknown.cards[s.ids[0]].faceDown = true;
    s.render(structuredClone(unknown));
    expect(s.host.querySelector(`[data-testid="recorded-pt-${s.ids[0]}"]`)).toBeNull();
  } finally {
    s.close();
  }
});
