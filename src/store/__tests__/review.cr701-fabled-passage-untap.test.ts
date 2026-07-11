// レビュー専有(review.*)。実装エージェントは変更禁止。
// cr-701 フェッチ土地の条件付きアンタップ(寓話の小道型)契約ピン。
// 契約=engine-spec §11.1。CR: フェッチ土地は tapped で出た後、支配土地が閾値以上なら untap(その土地自身も数える)。
import { beforeEach, describe, expect, it } from 'vitest';
import { fetchAbility, fetchEntersTapped } from '../../engine/status';
import { makeDef } from '../../engine/__tests__/helpers';
import type { InitDeckCard } from '../../engine/init';
import type { CardDef } from '../../types/card';
import { useGameStore } from '../gameStore';

const EN_FABLED_PASSAGE =
  '{T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle. Then if you control four or more lands, untap that land.';
const EN_EVOLVING_WILDS =
  '{T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.';
const EN_FLOODED_STRAND =
  '{T}, Pay 1 life, Sacrifice this land: Search your library for a Plains or Island card, put it onto the battlefield, then shuffle.';

function landDef(scryfallId: string, en: string): CardDef {
  return makeDef({
    scryfallId,
    typeLine: 'Land',
    faces: [{ name: scryfallId, typeLine: 'Land', oracleText: en }],
  });
}

function deckWithForests(count: number): InitDeckCard[] {
  const deck: InitDeckCard[] = [];
  for (let i = 1; i <= count; i++) {
    deck.push({
      def: makeDef({ scryfallId: `forest-${i}`, name: 'Forest', typeLine: 'Basic Land — Forest' }),
      isCommander: false,
    });
  }
  // pad so the opening draw never exhausts the library
  for (let i = 1; i <= 10; i++) {
    deck.push({ def: makeDef({ scryfallId: `c-${i}` }), isCommander: false });
  }
  return deck;
}

// Move `n` Forest instances (from wherever they were dealt) onto the battlefield.
function controlForests(n: number): void {
  const st = useGameStore.getState().state!;
  const forestIds = Object.values(st.cards)
    .filter((c) => st.defs[c.defId]?.name === 'Forest' && c.zone !== 'battlefield')
    .map((c) => c.id)
    .slice(0, n);
  expect(forestIds.length).toBe(n);
  for (const id of forestIds) {
    useGameStore.getState().moveCard(id, 'battlefield', 'bottom');
  }
}

beforeEach(() => {
  useGameStore.getState().newGame(deckWithForests(20), 3);
  useGameStore.setState({ autoAdvanceToMain: false });
});

describe('fetchEntersTapped board-aware default (§11.1 — Fabled Passage CR conditional untap)', () => {
  it('parses the "four or more lands, untap" clause into a threshold', () => {
    const ability = fetchAbility(landDef('fp', EN_FABLED_PASSAGE))!;
    expect(ability.entersTapped).toBe(true);
    expect(ability.untapIfControlLandsAtLeast).toBe(4);
  });

  it('enters TAPPED when controlled lands after the fetch would be below the threshold', () => {
    controlForests(2); // control 2, +1 fetched = 3 < 4
    const st = useGameStore.getState().state!;
    const ability = fetchAbility(landDef('fp', EN_FABLED_PASSAGE))!;
    expect(fetchEntersTapped(st, ability, st.activePlayerId)).toBe(true);
  });

  it('enters UNTAPPED when the fetched land itself makes the fourth land', () => {
    controlForests(3); // control 3, +1 fetched = 4 >= 4 → untap
    const st = useGameStore.getState().state!;
    const ability = fetchAbility(landDef('fp', EN_FABLED_PASSAGE))!;
    expect(fetchEntersTapped(st, ability, st.activePlayerId)).toBe(false);
  });

  it('enters UNTAPPED when already well above the threshold', () => {
    controlForests(6);
    const st = useGameStore.getState().state!;
    const ability = fetchAbility(landDef('fp', EN_FABLED_PASSAGE))!;
    expect(fetchEntersTapped(st, ability, st.activePlayerId)).toBe(false);
  });

  it('a plain tapped fetch (Evolving Wilds) stays TAPPED regardless of land count', () => {
    controlForests(6);
    const st = useGameStore.getState().state!;
    const ability = fetchAbility(landDef('ew', EN_EVOLVING_WILDS))!;
    expect(ability.untapIfControlLandsAtLeast).toBeUndefined();
    expect(fetchEntersTapped(st, ability, st.activePlayerId)).toBe(true);
  });

  it('an untapped fetch (Flooded Strand) stays UNTAPPED regardless of land count', () => {
    const st = useGameStore.getState().state!;
    const ability = fetchAbility(landDef('fs', EN_FLOODED_STRAND))!;
    expect(ability.entersTapped).toBe(false);
    expect(fetchEntersTapped(st, ability, st.activePlayerId)).toBe(false);
  });
});
