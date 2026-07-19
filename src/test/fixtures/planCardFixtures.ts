import type { CardDef } from '../../types/card';

function fixture(input: {
  id: string;
  name: string;
  typeLine: string;
  oracleText: string;
  producedMana?: CardDef['producedMana'];
  power?: string;
  toughness?: string;
}): CardDef {
  return {
    scryfallId: input.id,
    oracleId: input.id,
    name: input.name,
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine: input.typeLine,
    producedMana: input.producedMana,
    faces: [{
      name: input.name,
      typeLine: input.typeLine,
      oracleText: input.oracleText,
      power: input.power,
      toughness: input.toughness,
    }],
  };
}

/**
 * Network-free oracle fixtures. type_line / oracle_text verified against the live
 * Scryfall API on 2026-07-19 (api.scryfall.com/cards/named?exact=...). Pinned so
 * review.plan-card-fixtures-scryfall.test.ts can guard against silent drift.
 */
export const PLAN_CARD_FIXTURES = {
  fearOfMissingOut: fixture({
    id: 'fixture-dsk-136',
    name: 'Fear of Missing Out',
    typeLine: 'Enchantment Creature — Nightmare',
    power: '2',
    toughness: '3',
    oracleText: 'When this creature enters, discard a card, then draw a card.\nDelirium — Whenever this creature attacks for the first time each turn, if there are four or more card types among cards in your graveyard, untap target creature. After this phase, there is an additional combat phase.',
  }),
  mysticSanctuary: fixture({
    id: 'fixture-soc-388',
    name: 'Mystic Sanctuary',
    typeLine: 'Land — Island',
    producedMana: ['U'],
    oracleText: '({T}: Add {U}.)\nThis land enters tapped unless you control three or more other Islands.\nWhen this land enters untapped, you may put target instant or sorcery card from your graveyard on top of your library.',
  }),
  mishrasBauble: fixture({
    id: 'fixture-2xm-274',
    name: "Mishra's Bauble",
    typeLine: 'Artifact',
    oracleText: "{T}, Sacrifice this artifact: Look at the top card of target player's library. Draw a card at the beginning of the next turn's upkeep.",
  }),
  gogo: fixture({
    id: 'fixture-fin-54',
    name: 'Gogo, Master of Mimicry',
    typeLine: 'Legendary Creature — Wizard',
    power: '2',
    toughness: '4',
    oracleText: "{X}{X}, {T}: Copy target activated or triggered ability you control X times. You may choose new targets for the copies. This ability can't be copied and X can't be 0. (Mana abilities can't be targeted.)",
  }),
} as const;
