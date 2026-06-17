import { beforeEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { SNAPSHOT_VERSION, type GameSnapshot } from '../../data/gameSnapshot';
import { useGameStore } from '../../store/gameStore';
import { applyCommand } from '../commands';
import { initGame } from '../init';
import type { GameState, ManaPool } from '../types';
import { makeDef, makeDeck } from './helpers';

function pool(partial: Partial<ManaPool> = {}): ManaPool {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, ...partial };
}

function instanceId(state: GameState, defId: string): string {
  return Object.values(state.cards).find((card) => card.defId === defId)!.id;
}

function store() {
  return useGameStore.getState();
}

function snap(): GameState {
  return store().state!;
}

describe('M4.30 per-turn counters', () => {
  beforeEach(() => {
    useGameStore.setState({
      state: null,
      warnings: [],
      canUndo: false,
      canRedo: false,
      autoAdvanceToMain: false,
      mulliganDecisionPending: false,
    });
  });

  it('increments storm on castToStack and not on abilities, copies, or fetch activation', () => {
    const spell = makeDef({
      scryfallId: 'm430-spell',
      typeLine: 'Creature — Wizard',
      faces: [{ name: 'm430-spell', typeLine: 'Creature — Wizard', manaCost: '{1}{U}' }],
    });
    const fetchLand = makeDef({
      scryfallId: 'm430-fetch',
      typeLine: 'Land',
      faces: [
        {
          name: 'm430-fetch',
          typeLine: 'Land',
          oracleText:
            '{T}, Pay 1 life, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.',
        },
      ],
    });
    store().newGame(
      [
        { def: spell, isCommander: false },
        { def: fetchLand, isCommander: false },
        ...makeDeck(12),
      ],
      7
    );

    const spellId = instanceId(snap(), 'm430-spell');
    const fetchId = instanceId(snap(), 'm430-fetch');
    store().moveCard(spellId, 'hand');
    store().moveCard(fetchId, 'battlefield');

    const beforeCast = snap().spellsCastThisTurn;
    store().castToStack(spellId, { force: true });
    expect(snap().spellsCastThisTurn).toBe(beforeCast + 1);

    const afterCast = snap().spellsCastThisTurn;
    store().addAbilityToStack(fetchId, 'activated');
    expect(snap().spellsCastThisTurn).toBe(afterCast);

    const abilityId = snap().zones.stack[snap().zones.stack.length - 1];
    store().copyStackItem(abilityId);
    expect(snap().spellsCastThisTurn).toBe(afterCast);

    store().activateFetch(fetchId, { entersTapped: true, lifeCost: 1 });
    expect(snap().spellsCastThisTurn).toBe(afterCast);
  });

  it('increments draws by the actual number drawn and resets both counters on the next untap', () => {
    const spell = makeDef({
      scryfallId: 'm430-reset-spell',
      typeLine: 'Creature — Bear',
      faces: [{ name: 'm430-reset-spell', typeLine: 'Creature — Bear', manaCost: '{2}{G}' }],
    });
    store().newGame([{ def: spell, isCommander: false }, ...makeDeck(20)], 9);

    const spellId = instanceId(snap(), 'm430-reset-spell');
    store().moveCard(spellId, 'hand');
    store().castToStack(spellId, { force: true });
    store().draw(3);

    expect(snap().spellsCastThisTurn).toBeGreaterThan(0);
    expect(snap().drawnThisTurn).toBeGreaterThanOrEqual(3);

    store().nextTurn();
    expect(snap().phase).toBe('untap');
    expect(snap().spellsCastThisTurn).toBe(0);
    expect(snap().drawnThisTurn).toBe(0);
  });

  it('restoreGame backfills missing counters to 0', () => {
    store().newGame(makeDeck(14), 3);
    const current = snap();
    const legacy = { ...current } as Record<string, unknown>;
    delete legacy.spellsCastThisTurn;
    delete legacy.drawnThisTurn;
    const snapshot: GameSnapshot = {
      version: SNAPSHOT_VERSION,
      state: legacy as unknown as GameState,
      deck: makeDeck(14),
      autoAdvanceToMain: false,
    };

    store().restoreGame(snapshot);
    expect(snap().spellsCastThisTurn).toBe(0);
    expect(snap().drawnThisTurn).toBe(0);
  });

  it('keeps per-turn counters non-negative across random command walks', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2 ** 31 - 1 }),
        fc.array(fc.constantFrom('draw', 'nextTurn', 'cast', 'ability', 'copy'), {
          minLength: 1,
          maxLength: 30,
        }),
        fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 30, maxLength: 30 }),
        (seed, ops, counts) => {
          const spell = makeDef({
            scryfallId: 'm430-prop-spell',
            typeLine: 'Creature — Merfolk',
            faces: [
              {
                name: 'm430-prop-spell',
                typeLine: 'Creature — Merfolk',
                manaCost: '{1}{U}',
              },
            ],
          });
          const source = makeDef({
            scryfallId: 'm430-prop-source',
            typeLine: 'Artifact',
            faces: [{ name: 'm430-prop-source', typeLine: 'Artifact' }],
          });

          let state = initGame(
            [
              { def: spell, isCommander: false },
              { def: source, isCommander: false },
              ...makeDeck(18),
            ],
            seed
          );
          state = applyCommand(state, { type: 'draw', count: 7 }).state;

          const spellId = instanceId(state, 'm430-prop-spell');
          const sourceId = instanceId(state, 'm430-prop-source');

          for (let index = 0; index < ops.length; index += 1) {
            const op = ops[index];
            if (op === 'draw') {
              state = applyCommand(state, { type: 'draw', count: counts[index] }).state;
            } else if (op === 'nextTurn') {
              state = applyCommand(state, { type: 'nextTurn' }).state;
              expect(state.spellsCastThisTurn).toBe(0);
              expect(state.drawnThisTurn).toBe(0);
            } else if (op === 'cast') {
              if (state.cards[spellId].zone !== 'hand') {
                state = applyCommand(state, {
                  type: 'moveCard',
                  cardId: spellId,
                  to: 'hand',
                  position: 'top',
                }).state;
              }
              state = applyCommand(state, {
                type: 'castToStack',
                cardId: spellId,
                payment: pool(),
                forced: true,
              }).state;
            } else if (op === 'ability') {
              if (state.cards[sourceId].zone !== 'battlefield') {
                state = applyCommand(state, {
                  type: 'moveCard',
                  cardId: sourceId,
                  to: 'battlefield',
                  position: 'bottom',
                }).state;
              }
              state = applyCommand(state, {
                type: 'addAbilityToStack',
                sourceId,
                kind: 'activated',
              }).state;
            } else if (state.zones.stack.length > 0) {
              state = applyCommand(state, {
                type: 'copyStackItem',
                cardId: state.zones.stack[state.zones.stack.length - 1],
              }).state;
            }

            expect(state.spellsCastThisTurn).toBeGreaterThanOrEqual(0);
            expect(state.drawnThisTurn).toBeGreaterThanOrEqual(0);
          }
        }
      )
    );
  });
});
