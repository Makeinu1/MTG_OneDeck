/**
 * Reviewer-owned adversarial tests for M4.12 (engine-spec §10).
 * Implementation agents must NOT modify this file.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { applyCommand } from '../../engine/commands';
import { cyclingCost, cyclingInfo } from '../../engine/status';
import { initGame, type InitDeckCard } from '../../engine/init';
import { useGameStore } from '../gameStore';
import { makeDef } from '../../engine/__tests__/helpers';
import type { CardDef, ManaColor } from '../../types/card';

function deck(n: number, extra: CardDef[] = []): InitDeckCard[] {
  const base = Array.from({ length: n }, (_, i) => ({
    def: makeDef({ scryfallId: `c-${i}` }),
    isCommander: false,
  }));
  return [...base, ...extra.map((def) => ({ def, isCommander: false }))];
}

beforeEach(() => {
  useGameStore.setState({ autoAdvanceToMain: false });
});

describe('adjustMana command (§10.1, I3)', () => {
  it('adds and clamps at zero, never negative', () => {
    let s = initGame(deck(10), 1);
    s = applyCommand(s, { type: 'adjustMana', color: 'R', delta: 3 }).state;
    expect(s.manaPool.R).toBe(3);
    s = applyCommand(s, { type: 'adjustMana', color: 'R', delta: -5 }).state;
    expect(s.manaPool.R).toBe(0); // clamped
    const before = s;
    const noop = applyCommand(s, { type: 'adjustMana', color: 'R', delta: 0 });
    expect(noop.state.manaPool.R).toBe(0);
    expect(noop.state.log.length).toBe(before.log.length); // delta 0 -> no log
  });
});

describe('cyclingCost (§10.2)', () => {
  it('detects English cycling cost (plain and typecycling) and returns null otherwise', () => {
    const en = makeDef({
      scryfallId: 'en',
      faces: [{ name: 'en', typeLine: 'Creature', oracleText: 'Cycling {2}\n(text)' }],
    });
    const enColored = makeDef({
      scryfallId: 'enc',
      faces: [{ name: 'enc', typeLine: 'Land', oracleText: 'Plainscycling {1}{U}' }],
    });
    const generic = makeDef({
      scryfallId: 'gen',
      faces: [{ name: 'gen', typeLine: 'Creature', oracleText: 'Cycling {2}' }],
    });
    const none = makeDef({ scryfallId: 'none', faces: [{ name: 'none', typeLine: 'Creature' }] });
    expect(cyclingCost(en)).toBe('{2}');
    expect(cyclingCost(enColored)).toBe('{1}{U}');
    expect(cyclingCost(generic)).toBe('{2}');
    expect(cyclingCost(none)).toBeNull();
  });

  it('classifies plain cycling vs [type]cycling variants (CR 702.29a vs 702.29e)', () => {
    const plain = makeDef({
      scryfallId: 'plain',
      faces: [{ name: 'plain', typeLine: 'Creature', oracleText: 'Cycling {2}' }],
    });
    const landcycle = makeDef({
      scryfallId: 'landcycle',
      faces: [{ name: 'landcycle', typeLine: 'Land', oracleText: 'Basic landcycling {1}' }],
    });
    const typecycle = makeDef({
      scryfallId: 'typecycle',
      faces: [{ name: 'typecycle', typeLine: 'Creature', oracleText: 'Mountaincycling {1}{R}' }],
    });
    const noCycle = makeDef({
      scryfallId: 'nc',
      faces: [{ name: 'nc', typeLine: 'Creature' }],
    });

    expect(cyclingInfo(plain)).toEqual({ cost: '{2}', keyword: 'Cycling', isTypecycling: false });
    expect(cyclingInfo(landcycle)?.isTypecycling).toBe(true);
    expect(cyclingInfo(landcycle)?.cost).toBe('{1}');
    expect(cyclingInfo(typecycle)?.isTypecycling).toBe(true);
    expect(cyclingInfo(typecycle)?.cost).toBe('{1}{R}');
    expect(cyclingInfo(noCycle)).toBeNull();
  });
});

describe('store.cycle (§10.3)', () => {
  function cyclerDeck(): { deck: InitDeckCard[]; cyclerId: string } {
    const cycler = makeDef({
      scryfallId: 'cyc',
      typeLine: 'Creature',
      faces: [{ name: 'cyc', typeLine: 'Creature', manaCost: '{3}', oracleText: 'Cycling {2}' }],
    });
    return { deck: deck(20, [cycler]), cyclerId: 'cyc' };
  }

  it('pays from the pool, discards the card and draws one in a single undo step', () => {
    const { deck: d } = cyclerDeck();
    useGameStore.getState().newGame(d, 1);
    // ensure the cycler is in hand
    let st = useGameStore.getState().state!;
    let cyclerInstance = Object.values(st.cards).find((c) => c.defId === 'cyc' && c.zone === 'hand');
    if (!cyclerInstance) {
      const inLib = Object.values(st.cards).find((c) => c.defId === 'cyc')!;
      useGameStore.getState().moveCard(inLib.id, 'hand', 'top');
      st = useGameStore.getState().state!;
      cyclerInstance = st.cards[inLib.id];
    }
    const id = cyclerInstance.id;
    // give 2 generic mana to pay cycling {2}
    useGameStore.getState().adjustMana('C', 2);
    const handBefore = useGameStore.getState().state!.zones.hand.length;
    const graveBefore = useGameStore.getState().state!.zones.graveyard.length;

    const res = useGameStore.getState().cycle(id);
    expect(res).toBe('ok');
    let after = useGameStore.getState().state!;
    expect(after.cards[id].zone).toBe('graveyard');
    // -1 (discarded cycler) +1 (drew) = net 0 from hand, but the cycler left and a new card entered
    expect(after.zones.graveyard.length).toBe(graveBefore + 1);
    expect(after.zones.hand.length).toBe(handBefore); // discard 1, draw 1
    expect(after.manaPool.C).toBe(0); // paid {2}

    // single undo reverts the whole cycle
    useGameStore.getState().undo();
    after = useGameStore.getState().state!;
    expect(after.cards[id].zone).toBe('hand');
    expect(after.manaPool.C).toBe(2);
    expect(after.zones.graveyard.length).toBe(graveBefore);
  });

  it('fail-closed for [type]cycling: pays + discards but does NOT draw (CR 702.29e)', () => {
    // Ash Barrens style: "Basic landcycling {1}". Correct effect tutors a basic land
    // to hand; that is not automated, so cycle() must not perform the (wrong) draw.
    const ashBarrens = makeDef({
      scryfallId: 'ash',
      typeLine: 'Land',
      faces: [{ name: 'ash', typeLine: 'Land', oracleText: 'Basic landcycling {1}\n{T}: Add {C}.' }],
    });
    useGameStore.getState().newGame(deck(20, [ashBarrens]), 1);
    let st = useGameStore.getState().state!;
    let inst = Object.values(st.cards).find((c) => c.defId === 'ash' && c.zone === 'hand');
    if (!inst) {
      const inLib = Object.values(st.cards).find((c) => c.defId === 'ash')!;
      useGameStore.getState().moveCard(inLib.id, 'hand', 'top');
      inst = useGameStore.getState().state!.cards[inLib.id];
    }
    const id = inst.id;
    useGameStore.getState().adjustMana('C', 1); // pay landcycling {1}
    const handBefore = useGameStore.getState().state!.zones.hand.length;
    const graveBefore = useGameStore.getState().state!.zones.graveyard.length;
    const libBefore = useGameStore.getState().state!.zones.library.length;

    const res = useGameStore.getState().cycle(id);
    expect(res).toBe('ok');
    st = useGameStore.getState().state!;
    expect(st.cards[id].zone).toBe('graveyard');
    // discard 1, NO draw -> hand shrinks by 1, library untouched (no wrongful draw)
    expect(st.zones.hand.length).toBe(handBefore - 1);
    expect(st.zones.graveyard.length).toBe(graveBefore + 1);
    expect(st.zones.library.length).toBe(libBefore);
    expect(st.manaPool.C).toBe(0); // cost still paid
    // user is told to complete the tutor manually
    expect(
      useGameStore.getState().warnings.some((w) => w.includes('タイプサイクリング')),
    ).toBe(true);

    // single undo reverts the whole action
    useGameStore.getState().undo();
    st = useGameStore.getState().state!;
    expect(st.cards[id].zone).toBe('hand');
    expect(st.manaPool.C).toBe(1);
    expect(st.zones.hand.length).toBe(handBefore);
  });

  it('returns a shortfall when mana is insufficient and not forced', () => {
    const { deck: d } = cyclerDeck();
    useGameStore.getState().newGame(d, 2);
    const st = useGameStore.getState().state!;
    let inst = Object.values(st.cards).find((c) => c.defId === 'cyc' && c.zone === 'hand');
    if (!inst) {
      const inLib = Object.values(st.cards).find((c) => c.defId === 'cyc')!;
      useGameStore.getState().moveCard(inLib.id, 'hand', 'top');
      inst = useGameStore.getState().state!.cards[inLib.id];
    }
    const res = useGameStore.getState().cycle(inst.id);
    expect(res).not.toBe('ok');
    expect((res as { shortfall: number }).shortfall).toBeGreaterThan(0);
    // board unchanged
    expect(useGameStore.getState().state!.cards[inst.id].zone).toBe('hand');
  });
});

describe('tapForMana amount (§10.4)', () => {
  it('adds the full produced amount for "Add {C}{C}{C}" sources', () => {
    const vault = makeDef({
      scryfallId: 'vault',
      typeLine: 'Artifact',
      producedMana: ['C'] as ManaColor[],
      faces: [{ name: 'vault', typeLine: 'Artifact', oracleText: '{T}: Add {C}{C}{C}.' }],
    });
    useGameStore.getState().newGame(deck(10, [vault]), 1);
    let st = useGameStore.getState().state!;
    const inLib = Object.values(st.cards).find((c) => c.defId === 'vault')!;
    useGameStore.getState().moveCard(inLib.id, 'battlefield', 'bottom');
    // advance a turn so it's not summoning sick irrelevant (artifact, fine) — just tap
    useGameStore.getState().tapForMana(inLib.id);
    st = useGameStore.getState().state!;
    expect(st.manaPool.C).toBe(3);
    expect(st.cards[inLib.id].tapped).toBe(true);
  });
});
