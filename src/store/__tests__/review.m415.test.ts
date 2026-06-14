/**
 * Reviewer-owned adversarial tests for M4.15 (engine-spec §11): fetch lands.
 * Implementation agents must NOT modify this file.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { fetchAbility } from '../../engine/status';
import { type InitDeckCard } from '../../engine/init';
import { useGameStore } from '../gameStore';
import { makeDef } from '../../engine/__tests__/helpers';
import type { CardDef } from '../../types/card';

function deck(n: number, extra: CardDef[] = []): InitDeckCard[] {
  const base = Array.from({ length: n }, (_, i) => ({
    def: makeDef({ scryfallId: `c-${i}`, typeLine: 'Creature' }),
    isCommander: false,
  }));
  return [...base, ...extra.map((def) => ({ def, isCommander: false }))];
}

// Real Scryfall ja printed_text (verified against the live API).
const JA_EVOLVING_WILDS =
  '{T}, この土地を生け贄に捧げる：あなたのライブラリーから基本土地・カード１枚を探し、タップ状態で戦場に出す。その後、ライブラリーを切り直す。';
const JA_FABLED_PASSAGE =
  '{T}, この土地を生け贄に捧げる：あなたのライブラリーから基本土地・カード１枚を探し、タップ状態で戦場に出す。その後、ライブラリーを切り直す。その後、あなたが４つ以上の土地をコントロールしているなら、その土地をアンタップする。';
const JA_POLLUTED_DELTA =
  '{T}, １点のライフを支払う, 汚染された三角州を生け贄に捧げる：あなたのライブラリーから島や沼であるカード１枚を探し、戦場に出す。その後、ライブラリーを切り直す。';
const JA_PRISMATIC_VISTA =
  '{T}, １点のライフを支払う, 虹色の眺望を生け贄に捧げる：あなたのライブラリーから基本土地・カード１枚を探し、戦場に出す。その後、あなたのライブラリーを切り直す。';
const EN_POLLUTED_DELTA =
  '{T}, Pay 1 life, Sacrifice this land: Search your library for an Island or Swamp card, put it onto the battlefield, then shuffle.';
const EN_EVOLVING_WILDS =
  '{T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.';

function landDef(scryfallId: string, text: { ja?: string; en?: string }): CardDef {
  return makeDef({
    scryfallId,
    typeLine: 'Land',
    faces: [
      {
        name: scryfallId,
        typeLine: 'Land',
        oracleText: text.en,
        printedText: text.ja,
      },
    ],
  });
}

function sortedSubtypes(a: ReturnType<typeof fetchAbility>): string[] {
  if (a && typeof a.filter === 'object') return [...a.filter.subtypes].sort();
  return [];
}

beforeEach(() => {
  useGameStore.setState({ autoAdvanceToMain: false });
});

describe('fetchAbility parsing (§11.1)', () => {
  it('Evolving Wilds (ja): tapped, 0 life, basic', () => {
    const a = fetchAbility(landDef('ew', { ja: JA_EVOLVING_WILDS }));
    expect(a).not.toBeNull();
    expect(a!.entersTapped).toBe(true);
    expect(a!.lifeCost).toBe(0);
    expect(a!.filter).toBe('basic');
  });

  it('Fabled Passage (ja): tapped despite the conditional untap clause; basic', () => {
    const a = fetchAbility(landDef('fp', { ja: JA_FABLED_PASSAGE }));
    expect(a).not.toBeNull();
    expect(a!.entersTapped).toBe(true); // conditional "untap" clause ignored
    expect(a!.lifeCost).toBe(0);
    expect(a!.filter).toBe('basic');
  });

  it('Polluted Delta (ja): untapped, 1 life (fullwidth digit), Island+Swamp', () => {
    const a = fetchAbility(landDef('pd', { ja: JA_POLLUTED_DELTA }));
    expect(a).not.toBeNull();
    expect(a!.entersTapped).toBe(false);
    expect(a!.lifeCost).toBe(1);
    expect(sortedSubtypes(a)).toEqual(['Island', 'Swamp']);
  });

  it('Prismatic Vista (ja): untapped, 1 life, basic', () => {
    const a = fetchAbility(landDef('pv', { ja: JA_PRISMATIC_VISTA }));
    expect(a).not.toBeNull();
    expect(a!.entersTapped).toBe(false);
    expect(a!.lifeCost).toBe(1);
    expect(a!.filter).toBe('basic');
  });

  it('Polluted Delta (en): untapped, 1 life, Island+Swamp', () => {
    const a = fetchAbility(landDef('pde', { en: EN_POLLUTED_DELTA }));
    expect(a).not.toBeNull();
    expect(a!.entersTapped).toBe(false);
    expect(a!.lifeCost).toBe(1);
    expect(sortedSubtypes(a)).toEqual(['Island', 'Swamp']);
  });

  it('Evolving Wilds (en): tapped, 0 life, basic', () => {
    const a = fetchAbility(landDef('ewe', { en: EN_EVOLVING_WILDS }));
    expect(a).not.toBeNull();
    expect(a!.entersTapped).toBe(true);
    expect(a!.lifeCost).toBe(0);
    expect(a!.filter).toBe('basic');
  });

  it('unparseable land filter falls back to any-land', () => {
    const a = fetchAbility(
      landDef('generic', {
        en: '{T}, Sacrifice this land: Search your library for a land card, put it onto the battlefield, then shuffle.',
      })
    );
    expect(a).not.toBeNull();
    expect(a!.filter).toBe('any-land');
    expect(a!.entersTapped).toBe(false);
    expect(a!.lifeCost).toBe(0);
  });

  it('returns null for a hand tutor (no "onto the battlefield") and for vanilla cards', () => {
    const tutor = makeDef({
      scryfallId: 'tutor',
      typeLine: 'Sorcery',
      faces: [
        {
          name: 'tutor',
          typeLine: 'Sorcery',
          oracleText: 'Search your library for a creature card, reveal it, put it into your hand, then shuffle.',
        },
      ],
    });
    expect(fetchAbility(tutor)).toBeNull();
    expect(fetchAbility(makeDef({ scryfallId: 'vanilla', typeLine: 'Creature' }))).toBeNull();
    expect(fetchAbility(undefined)).toBeNull();
  });
});

describe('store.fetchLand composition (§11.2)', () => {
  function setup(seed: number) {
    const fetch = landDef('fetch', { ja: JA_POLLUTED_DELTA });
    useGameStore.getState().newGame(deck(30, [fetch]), seed);
    let st = useGameStore.getState().state!;
    const source = Object.values(st.cards).find((c) => c.defId === 'fetch')!;
    // Put the fetch land onto the battlefield (as if played).
    useGameStore.getState().moveCard(source.id, 'battlefield', 'bottom');
    st = useGameStore.getState().state!;
    const target = st.zones.library[0];
    expect(target).toBeDefined();
    expect(target).not.toBe(source.id);
    return { sourceId: source.id, targetId: target };
  }

  it('pays life, sacrifices source, puts target onto battlefield tapped, shuffles, single undo', () => {
    const { sourceId, targetId } = setup(7);
    const before = useGameStore.getState().state!;
    const lifeBefore = before.life;
    const libBefore = before.zones.library.length;
    const graveBefore = before.zones.graveyard.length;
    const cardCount = Object.keys(before.cards).length;
    const libSetBefore = new Set(before.zones.library);

    useGameStore.getState().fetchLand(sourceId, targetId, { entersTapped: true, lifeCost: 1 });
    const after = useGameStore.getState().state!;

    expect(after.life).toBe(lifeBefore - 1);
    expect(after.cards[sourceId].zone).toBe('graveyard');
    expect(after.zones.graveyard.length).toBe(graveBefore + 1);
    expect(after.cards[targetId].zone).toBe('battlefield');
    expect(after.cards[targetId].tapped).toBe(true);
    expect(after.zones.library).not.toContain(targetId);
    expect(after.zones.library.length).toBe(libBefore - 1);
    // library is a permutation of (before minus target): conservation + shuffle
    libSetBefore.delete(targetId);
    expect(new Set(after.zones.library)).toEqual(libSetBefore);
    // no card created or destroyed
    expect(Object.keys(after.cards).length).toBe(cardCount);

    // single undo restores everything
    useGameStore.getState().undo();
    const reverted = useGameStore.getState().state!;
    expect(reverted.life).toBe(lifeBefore);
    expect(reverted.cards[sourceId].zone).toBe('battlefield');
    expect(reverted.cards[targetId].zone).toBe('library');
    expect(reverted.zones.library.length).toBe(libBefore);
    expect(reverted.zones.graveyard.length).toBe(graveBefore);
  });

  it('respects entersTapped=false and lifeCost=0', () => {
    const { sourceId, targetId } = setup(11);
    const lifeBefore = useGameStore.getState().state!.life;
    useGameStore.getState().fetchLand(sourceId, targetId, { entersTapped: false, lifeCost: 0 });
    const after = useGameStore.getState().state!;
    expect(after.life).toBe(lifeBefore); // no life paid
    expect(after.cards[targetId].zone).toBe('battlefield');
    expect(after.cards[targetId].tapped).toBe(false); // untapped
    expect(after.cards[sourceId].zone).toBe('graveyard');
  });
});
