/**
 * Reviewer-owned adversarial tests for M4.27: stack zone + ability objects
 * (docs/engine-spec.md §12). Implementation agents must NOT modify this file.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { useGameStore } from '../gameStore';
import { makeDef, makeDeck } from '../../engine/__tests__/helpers';
import { commanderTax } from '../../engine/commander';
import { SNAPSHOT_VERSION, type GameSnapshot } from '../../data/gameSnapshot';
import type { GameState, ZoneId } from '../../engine/types';
import type { CardDef } from '../../types/card';

const ZONES: ZoneId[] = [
  'library',
  'hand',
  'battlefield',
  'graveyard',
  'exile',
  'command',
  'stack',
];

function store() {
  return useGameStore.getState();
}
function snap(): GameState {
  return store().state!;
}
function instanceByDef(defId: string): string {
  return Object.values(snap().cards).find((c) => c.defId === defId)!.id;
}
function abilityIds(): string[] {
  return Object.values(snap().cards)
    .filter((c) => c.isAbility)
    .map((c) => c.id);
}

/** I1 (incl. stack) + I9 — recomputed independently from the engine's checker. */
function checkInvariants(state: GameState, deckSize: number, label: string): void {
  const seen = new Set<string>();
  for (const zone of ZONES) {
    for (const id of state.zones[zone]) {
      expect(seen.has(id), `${label}: ${id} duplicated across zones`).toBe(false);
      seen.add(id);
      expect(state.cards[id], `${label}: ${id} in zones but not cards`).toBeDefined();
      expect(state.cards[id].zone, `${label}: ${id} zone mismatch`).toBe(zone);
    }
  }
  expect(Object.keys(state.cards).length, `${label}: orphan cards`).toBe(seen.size);

  const real = Object.values(state.cards).filter((c) => !c.isToken && !c.isAbility).length;
  expect(real, `${label}: real card count drifted`).toBe(deckSize);

  for (const c of Object.values(state.cards)) {
    if (c.isAbility) {
      expect(c.zone, `${label}: ability ${c.id} off stack`).toBe('stack');
      expect(c.sourceId && state.cards[c.sourceId], `${label}: ability source missing`).toBeTruthy();
      expect(state.defs[c.defId], `${label}: ability def missing`).toBeDefined();
    }
  }
}

beforeEach(() => {
  useGameStore.setState({ autoAdvanceToMain: false });
});

function spellDeck(): { sorc: string; crea: string } {
  // sorcery + creature + fillers so the opening draw + library are populated
  const deck = [
    { def: makeDef({ scryfallId: 'sorc', typeLine: 'Sorcery' }), isCommander: false },
    { def: makeDef({ scryfallId: 'crea', typeLine: 'Creature — Bear' }), isCommander: false },
    ...makeDeck(12),
  ];
  store().newGame(deck, 7);
  const sorc = instanceByDef('sorc');
  const crea = instanceByDef('crea');
  store().moveCard(sorc, 'hand');
  store().moveCard(crea, 'hand');
  return { sorc, crea };
}

describe('castToStack (M4.27)', () => {
  it('puts a 0-cost spell on the stack top (array end) and reverts with one undo', () => {
    const { sorc } = spellDeck();
    const before = snap().zones.hand.length;
    const result = store().castToStack(sorc);
    expect(result).toBe('ok');
    let s = snap();
    expect(s.zones.stack[s.zones.stack.length - 1]).toBe(sorc);
    expect(s.cards[sorc].zone).toBe('stack');
    store().undo();
    s = snap();
    expect(s.zones.stack).not.toContain(sorc);
    expect(s.zones.hand.length).toBe(before);
  });

  // M-CR-RECONCILE: commander tax follows CR 903.8 and increments when the
  // commander is cast from the command zone.
  it('charges commander tax history when casting from the command zone', () => {
    const cmd = makeDef({ scryfallId: 'genX', typeLine: 'Legendary Creature — God' });
    store().newGame(makeDeck(12, [cmd]), 7);
    const cmdId = instanceByDef('genX');
    expect(snap().cards[cmdId].zone).toBe('command');
    expect(commanderTax(snap(), cmdId)).toBe(0);
    store().castToStack(cmdId);
    expect(snap().cards[cmdId].zone).toBe('stack');
    expect(commanderTax(snap(), cmdId)).toBe(2);
  });
});

describe('resolveStackTop type-auto destination (M4.27)', () => {
  it('routes a sorcery to the graveyard and a creature to the battlefield (LIFO)', () => {
    const { sorc, crea } = spellDeck();
    store().castToStack(crea); // bottom
    store().castToStack(sorc); // top
    expect(snap().zones.stack).toEqual(
      expect.arrayContaining([sorc, crea])
    );

    store().resolveTop(); // resolves the top = sorcery -> graveyard
    let s = snap();
    expect(s.cards[sorc].zone).toBe('graveyard');
    expect(s.zones.stack).toContain(crea);

    store().resolveTop(); // resolves creature -> battlefield, enteredTurn set
    s = snap();
    expect(s.cards[crea].zone).toBe('battlefield');
    expect(s.cards[crea].enteredTurn).toBe(s.turn);
    expect(s.zones.stack.length).toBe(0);
  });

  it('honors an explicit destination override', () => {
    const { crea } = spellDeck();
    store().castToStack(crea);
    store().resolveTop('exile');
    expect(snap().cards[crea].zone).toBe('exile');
  });
});

describe('addAbilityToStack + resolution (M4.27)', () => {
  it('creates an ability object from a source and vanishes it on resolution (one undo restores)', () => {
    spellDeck();
    const src = Object.values(snap().cards).find((c) => c.zone === 'hand')!.id;
    store().moveCard(src, 'battlefield');
    store().addAbilityToStack(src, 'triggered');

    const abilities = abilityIds();
    expect(abilities.length).toBe(1);
    const abilityId = abilities[0];
    const ability = snap().cards[abilityId];
    expect(ability.zone).toBe('stack');
    expect(ability.sourceId).toBe(src);
    expect(ability.defId).toBe(snap().cards[src].defId);
    expect(ability.abilityKind).toBe('triggered');
    checkInvariants(snap(), 14, 'ability created'); // 12 fillers + sorc + crea

    store().resolveTop();
    expect(snap().cards[abilityId]).toBeUndefined(); // vanished, not moved
    expect(snap().zones.stack).not.toContain(abilityId);

    store().undo();
    expect(snap().cards[abilityId]).toBeDefined();
    expect(snap().cards[abilityId].zone).toBe('stack');
  });

  it('vanishes an ability object if it is moved off the stack (I9 protection)', () => {
    spellDeck();
    const src = Object.values(snap().cards).find((c) => c.zone === 'hand')!.id;
    store().moveCard(src, 'battlefield');
    store().addAbilityToStack(src, 'activated');
    const abilityId = abilityIds()[0];

    store().moveCard(abilityId, 'hand');
    expect(snap().cards[abilityId]).toBeUndefined();
    expect(snap().zones.hand).not.toContain(abilityId);
    checkInvariants(snap(), 14, 'ability moved off stack');
  });
});

describe('resolveAll + removeStackItem (M4.27)', () => {
  it('resolveAll empties the stack to type-auto destinations in a single undo', () => {
    const { sorc, crea } = spellDeck();
    store().castToStack(crea);
    store().castToStack(sorc);
    store().resolveAll();
    let s = snap();
    expect(s.zones.stack.length).toBe(0);
    expect(s.cards[sorc].zone).toBe('graveyard');
    expect(s.cards[crea].zone).toBe('battlefield');

    store().undo(); // single undo restores the whole stack
    s = snap();
    expect(s.zones.stack).toEqual(expect.arrayContaining([sorc, crea]));
    expect(s.cards[sorc].zone).toBe('stack');
    expect(s.cards[crea].zone).toBe('stack');
  });

  it('removeStackItem counters a spell to the graveyard and deletes an ability', () => {
    const { sorc } = spellDeck();
    store().castToStack(sorc);
    store().removeStackItem(sorc);
    expect(snap().cards[sorc].zone).toBe('graveyard');
    expect(snap().zones.stack).not.toContain(sorc);

    const src = Object.values(snap().cards).find((c) => c.zone === 'hand')!.id;
    store().moveCard(src, 'battlefield');
    store().addAbilityToStack(src, 'activated');
    const abilityId = abilityIds()[0];
    store().removeStackItem(abilityId);
    expect(snap().cards[abilityId]).toBeUndefined();
  });
});

describe('snapshot JSON round-trip with a populated stack (M4.27)', () => {
  it('serializes and restores the stack and ability objects identically', () => {
    const { sorc } = spellDeck();
    const src = Object.values(snap().cards).find((c) => c.zone === 'hand')!.id;
    store().moveCard(src, 'battlefield');
    store().castToStack(sorc);
    store().addAbilityToStack(src, 'triggered');

    const state = snap();
    const round = JSON.parse(JSON.stringify(state)) as GameState;
    expect(round).toEqual(state);
    expect(round.zones.stack.length).toBe(2);
  });
});

describe('stack invariants under random ops (M4.27, property)', () => {
  it('I1/I2/I9 hold across random stack walks', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2 ** 31 - 1 }), fc.integer({ min: 1, max: 40 }), (seed, steps) => {
        useGameStore.setState({ autoAdvanceToMain: false });
        const fillers: { def: CardDef; isCommander: boolean }[] = makeDeck(16);
        store().newGame(fillers, seed);
        const deckSize = 16;
        // seed a few permanents on the battlefield as ability sources
        for (const id of snap().zones.hand.slice(0, 3)) store().moveCard(id, 'battlefield');
        checkInvariants(snap(), deckSize, 'init');

        let r = seed >>> 0;
        const rnd = () => {
          r = (r * 1664525 + 1013904223) >>> 0;
          return r / 2 ** 32;
        };
        const pick = <T,>(xs: T[]): T | undefined => (xs.length ? xs[Math.floor(rnd() * xs.length)] : undefined);

        for (let i = 0; i < steps; i++) {
          const s = snap();
          const op = Math.floor(rnd() * 5);
          if (op === 0) {
            const src = pick(s.zones.battlefield.filter((id) => !s.cards[id].isAbility));
            if (src) store().addAbilityToStack(src, rnd() < 0.5 ? 'activated' : 'triggered');
          } else if (op === 1) {
            const h = pick(s.zones.hand);
            if (h) store().castToStack(h);
          } else if (op === 2) {
            store().resolveTop();
          } else if (op === 3) {
            const item = pick(s.zones.stack);
            if (item) store().removeStackItem(item);
          } else {
            const ab = pick(abilityIds());
            if (ab) store().moveCard(ab, 'hand'); // must vanish (I9)
          }
          checkInvariants(snap(), deckSize, `step ${i} op${op}`);
        }
      }),
      { numRuns: 40 }
    );
  });
});

describe('restoreGame migrates older snapshots (M4.27)', () => {
  it('backfills a missing zones.stack from a pre-stack snapshot without crashing', () => {
    store().newGame(makeDeck(10), 3);
    const live = snap();
    // Simulate a snapshot saved before the `stack` zone existed.
    const oldZones: Record<string, string[]> = { ...live.zones };
    delete oldZones.stack;
    const snapshot: GameSnapshot = {
      version: SNAPSHOT_VERSION,
      state: { ...live, zones: oldZones },
      deck: makeDeck(10),
      autoAdvanceToMain: false,
    };

    store().restoreGame(snapshot);
    const restored = snap();
    expect(Array.isArray(restored.zones.stack)).toBe(true);
    expect(restored.zones.stack).toEqual([]);
    // existing zones preserved
    expect(restored.zones.hand).toEqual(live.zones.hand);
  });
});
