import { describe, expect, it } from 'vitest';

import { manaActivationChoices } from '../autotap';
import { applyTableOperation, createCockpitTable, tableManaResources } from '../cockpitTable';
import {
  applyR31TableOperation,
  captureExpectedInteractionContext,
} from '../cockpitR31';
import { blockingPublicTableTriggers } from '../cockpitTriggers';
import { makeDeck, makeDef } from './helpers';

function manaResolutionFixture() {
  const watcher = makeDef({
    scryfallId: 'r31-mana-watcher',
    typeLine: 'Enchantment',
    faces: [
      {
        name: 'R31 Mana Watcher',
        typeLine: 'Enchantment',
        oracleText:
          'Whenever a player taps a land for mana, that player adds one mana of any type that land produced.',
      },
    ],
  });
  const ownDeck = [...makeDeck(12), { def: watcher, isCommander: false }];
  const landDeck = makeDeck(12).map((item, index) => ({
    ...item,
    def: makeDef({
      scryfallId: `r31-island-${index}`,
      typeLine: 'Basic Land — Island',
      faces: [
        {
          name: `R31 Island ${index}`,
          typeLine: 'Basic Land — Island',
          oracleText: '{T}: Add {U}.',
        },
      ],
    }),
  }));
  let table = createCockpitTable(ownDeck, 12, [ownDeck, landDeck]);
  const watcherId = Object.values(table.cards).find((card) => card.defId === 'r31-mana-watcher')!.id;
  const islands = table.seats[1].zones.hand.slice(0, 2);
  table = applyTableOperation(table, {
    type: 'move',
    ids: [watcherId, ...islands],
    to: 'battlefield',
    position: 'top',
  });
  table.stack = [
    {
      id: 'resolution-A',
      kind: 'triggered',
      source: structuredClone(table.cards[watcherId]),
      controllerId: 'P1',
      targets: [],
      paid: [],
      text: 'Manual resolution anchor.',
    },
  ];
  return { table, islands };
}

function ordinaryTriggerFixture() {
  const deck = makeDeck(30).map((entry) => ({
    ...entry,
    def: {
      ...entry.def,
      faces: [
        {
          ...entry.def.faces[0],
          oracleText: `When ${entry.def.name} enters the battlefield, draw a card.`,
        },
      ],
    },
  }));
  const table = createCockpitTable(deck, 21);
  const sourceId = table.seats[0].zones.hand[0];
  const enteringId = table.seats[0].zones.hand[1];
  table.stack = [
    {
      id: 'resolution-A',
      kind: 'triggered',
      source: structuredClone(table.cards[sourceId]),
      controllerId: 'P1',
      targets: [],
      paid: [],
      text: 'Put a creature from your hand onto the battlefield.',
    },
  ];
  return { table, enteringId };
}

describe('R3.1 mana and post-resolution lifecycle', () => {
  it('resolves triggered mana abilities no-stack inside Resolution A and returns to the same resolution', () => {
    const { table, islands } = manaResolutionFixture();
    const resolving = applyR31TableOperation(table, {
      context: captureExpectedInteractionContext(table),
      operation: { type: 'resolve.begin', entryId: 'resolution-A' },
    });
    const seatId = resolving.seats[1].id;
    const entries = islands.map((cardId) => ({
      cardId,
      commands: manaActivationChoices(tableManaResources(resolving, seatId), seatId, cardId)[0],
    }));

    const after = applyR31TableOperation(resolving, {
      context: captureExpectedInteractionContext(resolving),
      operation: { type: 'generateBatch', entries },
    });

    expect(after.seats[1].mana.U).toBe(4);
    expect(after.resolution?.id).toBe('resolution-A');
    expect(after.stack.map((entry) => entry.id)).toEqual(['resolution-A']);
    expect(blockingPublicTableTriggers(after)).toEqual([]);
  });

  it('keeps an ordinary trigger nonblocking during Resolution A and promotes it only after A finishes', () => {
    const { table, enteringId } = ordinaryTriggerFixture();
    const resolving = applyR31TableOperation(table, {
      context: captureExpectedInteractionContext(table),
      operation: { type: 'resolve.begin', entryId: 'resolution-A' },
    });
    const changed = applyR31TableOperation(resolving, {
      context: captureExpectedInteractionContext(resolving),
      operation: {
        type: 'move',
        ids: [enteringId],
        to: 'battlefield',
        position: 'top',
      },
    });

    expect(changed.triggers?.candidates.some((candidate) => candidate.status === 'pending')).toBe(true);
    expect(blockingPublicTableTriggers(changed)).toEqual([]);

    const finished = applyR31TableOperation(changed, {
      context: captureExpectedInteractionContext(changed),
      operation: { type: 'resolve.end', entryId: 'resolution-A', to: 'graveyard' },
    });

    expect(finished.resolution).toBeNull();
    expect(blockingPublicTableTriggers(finished).length).toBeGreaterThan(0);
  });
});
