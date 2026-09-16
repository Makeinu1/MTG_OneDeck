import { describe, expect, it } from 'vitest';

import { createCockpitTable } from '../cockpitTable';
import { applyPermanentEntrySetup, validatePermanentEntrySetup } from '../cockpitR4';
import { makeDeck } from './helpers';

describe('R4 permanent entry setup branch regression', () => {
  it('covers omitted setup, optional fields, and zero-counter filtering', () => {
    const table = createCockpitTable(makeDeck(30), 11);
    const [cardId, attachmentTargetId] = table.seats[0].zones.hand.slice(0, 2);
    const moveToBattlefield = (id: string) => {
      table.seats[0].zones.hand = table.seats[0].zones.hand.filter((candidate) => candidate !== id);
      table.seats[0].zones.battlefield.unshift(id);
      table.cards[id].zone = 'battlefield';
    };
    moveToBattlefield(cardId);
    moveToBattlefield(attachmentTargetId);

    expect(() => validatePermanentEntrySetup(table, cardId, undefined)).not.toThrow();
    expect(() => applyPermanentEntrySetup(table, cardId, undefined)).not.toThrow();

    applyPermanentEntrySetup(table, cardId, {
      tapped: false,
      counters: { charge: 2, empty: 0 },
      controllerId: 'P1',
      attachmentTargetId,
      protectorId: 'P1',
    });

    expect(table.cards[cardId]).toMatchObject({
      tapped: false,
      counters: { charge: 2 },
      controllerId: 'P1',
      attachedTo: attachmentTargetId,
      protectorId: 'P1',
    });
  });
});
