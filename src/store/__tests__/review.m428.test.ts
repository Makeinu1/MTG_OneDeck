/**
 * Reviewer-owned adversarial tests for M4.28: copy (permanent/effect) + fetch
 * via the stack (docs/engine-spec.md §13). Implementation agents must NOT modify
 * this file.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { useGameStore } from '../gameStore';
import { makeDef, makeDeck } from '../../engine/__tests__/helpers';
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
function copyIds(): string[] {
  return Object.values(snap().cards).filter((c) => c.isCopy).map((c) => c.id);
}
function abilityIds(): string[] {
  return Object.values(snap().cards).filter((c) => c.isAbility).map((c) => c.id);
}

function checkInvariants(state: GameState, deckSize: number, label: string): void {
  const seen = new Set<string>();
  for (const zone of ZONES) {
    for (const id of state.zones[zone]) {
      expect(seen.has(id), `${label}: ${id} duplicated`).toBe(false);
      seen.add(id);
      expect(state.cards[id]?.zone, `${label}: ${id} zone mismatch`).toBe(zone);
    }
  }
  expect(Object.keys(state.cards).length, `${label}: orphan cards`).toBe(seen.size);
  const real = Object.values(state.cards).filter(
    (c) => !c.isToken && !c.isAbility && !c.isCopy
  ).length;
  expect(real, `${label}: real card count drifted`).toBe(deckSize);
  for (const c of Object.values(state.cards)) {
    if (c.isCopy) expect(c.zone, `${label}: copy ${c.id} off stack`).toBe('stack');
    if (c.isAbility) expect(c.zone, `${label}: ability ${c.id} off stack`).toBe('stack');
    if (c.isToken) expect(c.zone, `${label}: token ${c.id} off battlefield`).toBe('battlefield');
  }
}

beforeEach(() => {
  useGameStore.setState({ autoAdvanceToMain: false });
});

function fetchlandDef(id: string): CardDef {
  return makeDef({
    scryfallId: id,
    typeLine: 'Land',
    faces: [
      {
        name: id,
        typeLine: 'Land',
        oracleText:
          'Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.',
      },
    ],
  });
}

function spellOnStack(typeLine: string): string {
  const deck = [
    { def: makeDef({ scryfallId: 'spell', typeLine }), isCommander: false },
    ...makeDeck(12),
  ];
  store().newGame(deck, 4);
  const id = instanceByDef('spell');
  store().moveCard(id, 'hand');
  store().castToStack(id);
  return id;
}

describe('copyStackItem — effect copy (M4.28)', () => {
  it('copies a spell on the stack into a new isCopy object (defId reused, id k*)', () => {
    const spell = spellOnStack('Creature — Bear');
    store().copyStackItem(spell);
    const copies = copyIds();
    expect(copies.length).toBe(1);
    const copy = snap().cards[copies[0]];
    expect(copy.isCopy).toBe(true);
    expect(copy.isToken).toBeFalsy();
    expect(copy.zone).toBe('stack');
    expect(copy.defId).toBe(snap().cards[spell].defId);
    expect(copies[0].startsWith('k')).toBe(true);
    // original spell untouched, copy on top (array end)
    expect(snap().zones.stack[snap().zones.stack.length - 1]).toBe(copies[0]);
    expect(snap().zones.stack).toContain(spell);
    checkInvariants(snap(), 13, 'spell copied');
  });

  it('copies an ability on the stack into a second ability object', () => {
    store().newGame(makeDeck(12), 4);
    const src = snap().zones.hand[0];
    store().moveCard(src, 'battlefield');
    store().addAbilityToStack(src, 'triggered');
    const first = abilityIds()[0];
    store().copyStackItem(first);
    const abilities = abilityIds();
    expect(abilities.length).toBe(2);
    for (const a of abilities) {
      expect(snap().cards[a].sourceId).toBe(src);
      expect(snap().cards[a].abilityKind).toBe('triggered');
    }
  });
});

describe('copyPermanent — token copy on the battlefield (M4.28)', () => {
  it('creates N token copies referencing the source def, ETB set, counters not copied', () => {
    store().newGame(makeDeck(12), 4);
    const src = snap().zones.hand[0];
    store().moveCard(src, 'battlefield');
    store().dispatch({ type: 'addCounters', cardId: src, counterType: '+1/+1', delta: 2 });

    store().copyPermanent(src, 2);
    const tokens = Object.values(snap().cards).filter((c) => c.isToken);
    expect(tokens.length).toBe(2);
    for (const t of tokens) {
      expect(t.defId).toBe(snap().cards[src].defId);
      expect(t.zone).toBe('battlefield');
      expect(t.enteredTurn).toBe(snap().turn);
      expect(Object.keys(t.counters).length).toBe(0); // counters NOT copied
    }
    // source unchanged
    expect(snap().cards[src].counters['+1/+1']).toBe(2);
    checkInvariants(snap(), 12, 'permanent copied');
  });
});

describe('copy resolution (M4.28)', () => {
  it('a permanent-spell copy resolves into a battlefield token (isToken, !isCopy); one undo restores', () => {
    const spell = spellOnStack('Creature — Bear');
    store().copyStackItem(spell);
    const copyId = copyIds()[0];
    store().resolveTop(); // top = the copy
    let s = snap();
    expect(s.cards[copyId].zone).toBe('battlefield');
    expect(s.cards[copyId].isToken).toBe(true);
    expect(s.cards[copyId].isCopy).toBeFalsy();
    store().undo();
    s = snap();
    expect(s.cards[copyId].zone).toBe('stack');
    expect(s.cards[copyId].isCopy).toBe(true);
  });

  it('a sorcery copy resolves by ceasing to exist (not sent to graveyard); one undo restores', () => {
    const spell = spellOnStack('Sorcery');
    store().copyStackItem(spell);
    const copyId = copyIds()[0];
    store().resolveTop();
    let s = snap();
    expect(s.cards[copyId]).toBeUndefined(); // vanished
    expect(s.zones.graveyard).not.toContain(copyId);
    store().undo();
    s = snap();
    expect(s.cards[copyId]?.zone).toBe('stack');
  });

  it('a copy dragged off the stack to a non-battlefield zone ceases to exist (I10)', () => {
    const spell = spellOnStack('Creature — Bear');
    store().copyStackItem(spell);
    const copyId = copyIds()[0];
    store().moveCard(copyId, 'hand');
    expect(snap().cards[copyId]).toBeUndefined();
    expect(snap().zones.hand).not.toContain(copyId);
    checkInvariants(snap(), 13, 'copy dragged off');
  });
});

describe('fetch via the stack (M4.28)', () => {
  function fetchSetup() {
    const deck = [
      { def: fetchlandDef('fetch'), isCommander: false },
      { def: makeDef({ scryfallId: 'forest', typeLine: 'Basic Land — Forest' }), isCommander: false },
      ...makeDeck(14),
    ];
    store().newGame(deck, 6);
    const fetch = instanceByDef('fetch');
    const forest = instanceByDef('forest');
    store().moveCard(fetch, 'battlefield');
    store().moveCard(forest, 'library');
    return { fetch, forest };
  }

  it('activateFetch sacrifices the land + pays life and puts a fetch ability on the stack', () => {
    const { fetch } = fetchSetup();
    const lifeBefore = snap().life;
    store().activateFetch(fetch, { entersTapped: true, lifeCost: 1 });
    const s = snap();
    expect(s.cards[fetch].zone).toBe('graveyard');
    expect(s.life).toBe(lifeBefore - 1);
    const abilities = abilityIds();
    expect(abilities.length).toBe(1);
    expect(s.cards[abilities[0]].sourceId).toBe(fetch);
    expect(s.zones.stack[s.zones.stack.length - 1]).toBe(abilities[0]);
  });

  it('resolveFetch puts the target onto the battlefield (tapped), shuffles, removes the ability; one undo restores', () => {
    const { fetch, forest } = fetchSetup();
    store().activateFetch(fetch, { entersTapped: true, lifeCost: 1 });
    const abilityId = abilityIds()[0];
    const libSetBefore = new Set(snap().zones.library);

    store().resolveFetch(abilityId, forest, { entersTapped: true });
    let s = snap();
    expect(s.cards[forest].zone).toBe('battlefield');
    expect(s.cards[forest].tapped).toBe(true);
    expect(s.cards[abilityId]).toBeUndefined(); // ability consumed
    expect(s.zones.stack).not.toContain(abilityId);
    // library preserved minus the fetched land
    libSetBefore.delete(forest);
    expect(new Set(s.zones.library)).toEqual(libSetBefore);

    store().undo();
    s = snap();
    expect(s.cards[forest].zone).toBe('library');
    expect(s.cards[abilityId]?.zone).toBe('stack');
  });

  it('resolveAll stops at a fetch ability instead of auto-resolving it', () => {
    const { fetch } = fetchSetup();
    store().activateFetch(fetch, { entersTapped: true, lifeCost: 0 });
    const abilityId = abilityIds()[0];
    store().resolveAll();
    // fetch ability requires a target -> resolveAll must leave it on the stack
    expect(snap().zones.stack).toContain(abilityId);
    expect(snap().cards[abilityId]).toBeDefined();
  });
});

describe('snapshot JSON round-trip with a copy on the stack (M4.28)', () => {
  it('serializes and restores isCopy objects identically', () => {
    const spell = spellOnStack('Creature — Bear');
    store().copyStackItem(spell);
    const state = snap();
    const round = JSON.parse(JSON.stringify(state)) as GameState;
    expect(round).toEqual(state);
    expect(round.cards[copyIds()[0]].isCopy).toBe(true);
  });
});

describe('invariants under random copy ops (M4.28, property)', () => {
  it('I1/I2/I9/I10 hold across random copy/stack walks', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2 ** 31 - 1 }), fc.integer({ min: 1, max: 40 }), (seed, steps) => {
        useGameStore.setState({ autoAdvanceToMain: false });
        const fillers: { def: CardDef; isCommander: boolean }[] = makeDeck(16);
        store().newGame(fillers, seed);
        const deckSize = 16;
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
          const op = Math.floor(rnd() * 6);
          if (op === 0) {
            const src = pick(s.zones.battlefield.filter((id) => !s.cards[id].isAbility && !s.cards[id].isCopy));
            if (src) store().addAbilityToStack(src, 'activated');
          } else if (op === 1) {
            const h = pick(s.zones.hand);
            if (h) store().castToStack(h);
          } else if (op === 2) {
            const item = pick(s.zones.stack);
            if (item) store().copyStackItem(item);
          } else if (op === 3) {
            const src = pick(s.zones.battlefield.filter((id) => !s.cards[id].isAbility && !s.cards[id].isCopy));
            if (src) store().copyPermanent(src, 1);
          } else if (op === 4) {
            store().resolveTop();
          } else {
            const c = pick(copyIds());
            if (c) store().moveCard(c, 'graveyard'); // must vanish (I10)
          }
          checkInvariants(snap(), deckSize, `step ${i} op${op}`);
        }
      }),
      { numRuns: 40 }
    );
  });
});
