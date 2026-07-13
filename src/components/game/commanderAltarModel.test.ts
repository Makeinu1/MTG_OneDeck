import { describe, expect, it } from 'vitest';
import { buildVisualFixture } from '../../dev/visualFixtures/fixtureBuilder';
import { commanderAltarItems } from './commanderAltarModel';

describe('commanderAltarItems', () => {
  it('shows command-zone presence, current location, and tax without duplicating the card', () => {
    const state = buildVisualFixture('hand').snapshot.state;
    const commanderId = state.commanders[0].cardId;
    expect(commanderAltarItems(state)[0]).toMatchObject({
      cardId: commanderId,
      inCommandZone: true,
      zoneLabel: '統率領域',
      tax: 0,
    });

    const moved = {
      ...state,
      cards: {
        ...state.cards,
        [commanderId]: { ...state.cards[commanderId], zone: 'battlefield' as const },
      },
      commanders: [{ cardId: commanderId, castCount: 2 }],
    };
    expect(commanderAltarItems(moved)[0]).toMatchObject({
      inCommandZone: false,
      zoneLabel: '戦場',
      tax: 4,
    });
  });
});
