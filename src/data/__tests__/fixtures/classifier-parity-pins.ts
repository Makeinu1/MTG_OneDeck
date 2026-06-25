// AUTO-GENERATED from the gitignored Scryfall snapshot (M-GATE-2, §34.7.3.1).
// One representative card per adjudicated parity cluster, committed so the parity
// review gate runs in CI (the full snapshot is gitignored). Regenerate by re-running
// the parity adjudication; do not hand-edit oracle text.
import type { CardDef } from '../../../types/card';

export interface ParityPinFixture {
  cluster: string;
  def: CardDef;
}

export const classifierParityPins: readonly ParityPinFixture[] = [
  {
    "cluster": "cast runtime-FP (effect cast)",
    "def": {
      "scryfallId": "5e060d58-4d6e-425c-b7d4-727669fcce5b",
      "oracleId": "5e060d58-4d6e-425c-b7d4-727669fcce5b",
      "name": "Buster Sword",
      "lang": "en",
      "layout": "normal",
      "cmc": 0,
      "colorIdentity": [],
      "typeLine": "Artifact — Equipment",
      "faces": [
        {
          "name": "Buster Sword",
          "typeLine": "Artifact — Equipment",
          "oracleText": "Equipped creature gets +3/+2.\nWhenever equipped creature deals combat damage to a player, draw a card, then you may cast a spell from your hand with mana value less than or equal to that damage without paying its mana cost.\nEquip {2}"
        }
      ]
    }
  },
  {
    "cluster": "cast research-FN (bullet)",
    "def": {
      "scryfallId": "674e2683-31c0-4fee-95fb-98b1201e41e7",
      "oracleId": "674e2683-31c0-4fee-95fb-98b1201e41e7",
      "name": "Mirrodin Besieged",
      "lang": "en",
      "layout": "normal",
      "cmc": 0,
      "colorIdentity": [],
      "typeLine": "Enchantment",
      "faces": [
        {
          "name": "Mirrodin Besieged",
          "typeLine": "Enchantment",
          "oracleText": "As this enchantment enters, choose Mirran or Phyrexian.\n• Mirran — Whenever you cast an artifact spell, create a 1/1 colorless Myr artifact creature token.\n• Phyrexian — At the beginning of your end step, draw a card, then discard a card. Then if there are fifteen or more artifact cards in your graveyard, target opponent loses the game."
        }
      ]
    }
  },
  {
    "cluster": "cast research-FN (delayed)",
    "def": {
      "scryfallId": "93989dd7-2d3e-46e2-8e92-8d0479796087",
      "oracleId": "93989dd7-2d3e-46e2-8e92-8d0479796087",
      "name": "Twinferno",
      "lang": "en",
      "layout": "normal",
      "cmc": 0,
      "colorIdentity": [],
      "typeLine": "Instant",
      "faces": [
        {
          "name": "Twinferno",
          "typeLine": "Instant",
          "oracleText": "Choose one —\n• When you cast your next instant or sorcery spell this turn, copy that spell. You may choose new targets for the copy.\n• Target creature you control gains double strike until end of turn. (It deals both first-strike and regular combat damage.)"
        }
      ]
    }
  },
  {
    "cluster": "enters runtime-FN (plural)",
    "def": {
      "scryfallId": "605c1ee0-5e8a-4e0a-a99b-42a38873f822",
      "oracleId": "605c1ee0-5e8a-4e0a-a99b-42a38873f822",
      "name": "Welcoming Vampire",
      "lang": "en",
      "layout": "normal",
      "cmc": 0,
      "colorIdentity": [],
      "typeLine": "Creature — Vampire",
      "faces": [
        {
          "name": "Welcoming Vampire",
          "typeLine": "Creature — Vampire",
          "oracleText": "Flying\nWhenever one or more other creatures you control with power 2 or less enter, draw a card. This ability triggers only once each turn."
        }
      ]
    }
  },
  {
    "cluster": "enters research-FN (bullet)",
    "def": {
      "scryfallId": "4cfaa5cf-cc3d-49a7-9544-38a8bb7e9ec1",
      "oracleId": "4cfaa5cf-cc3d-49a7-9544-38a8bb7e9ec1",
      "name": "Frontier Siege",
      "lang": "en",
      "layout": "normal",
      "cmc": 0,
      "colorIdentity": [],
      "typeLine": "Enchantment",
      "faces": [
        {
          "name": "Frontier Siege",
          "typeLine": "Enchantment",
          "oracleText": "As this enchantment enters, choose Khans or Dragons.\n• Khans — At the beginning of each of your main phases, add {G}{G}.\n• Dragons — Whenever a creature you control with flying enters, you may have it fight target creature you don't control."
        }
      ]
    }
  },
  {
    "cluster": "enters runtime-FP (enters with replacement)",
    "def": {
      "scryfallId": "4469ff35-54ec-4ff5-bc19-3808ae0f711b",
      "oracleId": "4469ff35-54ec-4ff5-bc19-3808ae0f711b",
      "name": "Wildgrowth Archaic",
      "lang": "en",
      "layout": "normal",
      "cmc": 0,
      "colorIdentity": [],
      "typeLine": "Creature — Avatar",
      "faces": [
        {
          "name": "Wildgrowth Archaic",
          "typeLine": "Creature — Avatar",
          "oracleText": "Trample, reach\nConverge — This creature enters with a +1/+1 counter on it for each color of mana spent to cast it.\nWhenever you cast a creature spell, that creature enters with X additional +1/+1 counters on it, where X is the number of colors of mana spent to cast it."
        }
      ]
    }
  },
  {
    "cluster": "dies runtime-FN (plural)",
    "def": {
      "scryfallId": "322f44f0-e6da-4ee0-b474-e7d5e9a461c5",
      "oracleId": "322f44f0-e6da-4ee0-b474-e7d5e9a461c5",
      "name": "Morbid Opportunist",
      "lang": "en",
      "layout": "normal",
      "cmc": 0,
      "colorIdentity": [],
      "typeLine": "Creature — Human Rogue",
      "faces": [
        {
          "name": "Morbid Opportunist",
          "typeLine": "Creature — Human Rogue",
          "oracleText": "Whenever one or more other creatures die, draw a card. This ability triggers only once each turn."
        }
      ]
    }
  },
  {
    "cluster": "dies research-FN (delayed)",
    "def": {
      "scryfallId": "36b19ec0-d581-4213-bfae-1d7808a2f60d",
      "oracleId": "36b19ec0-d581-4213-bfae-1d7808a2f60d",
      "name": "Together Forever",
      "lang": "en",
      "layout": "normal",
      "cmc": 0,
      "colorIdentity": [],
      "typeLine": "Enchantment",
      "faces": [
        {
          "name": "Together Forever",
          "typeLine": "Enchantment",
          "oracleText": "When this enchantment enters, support 2. (Put a +1/+1 counter on each of up to two target creatures.)\n{1}: Choose target creature with a counter on it. When that creature dies this turn, return that card to its owner's hand."
        }
      ]
    }
  },
  {
    "cluster": "dies research-FN ({TK} prefix)",
    "def": {
      "scryfallId": "13d9822f-0398-4915-818b-b9fbaf63b93c",
      "oracleId": "13d9822f-0398-4915-818b-b9fbaf63b93c",
      "name": "Demonic Tourist Laser",
      "lang": "en",
      "layout": "normal",
      "cmc": 0,
      "colorIdentity": [],
      "typeLine": "Stickers",
      "faces": [
        {
          "name": "Demonic Tourist Laser",
          "typeLine": "Stickers",
          "oracleText": "{TK}{TK} — Outlast {1} ({1}, {T}: Put a +1/+1 counter on this creature. Outlast only as a sorcery.)\n{TK}{TK}{TK} — When this permanent dies, you get seven {TK}.\n{TK}{TK} — 1/4\n{TK}{TK}{TK}{TK}{TK} — 9/6"
        }
      ]
    }
  },
  {
    "cluster": "leaves research-FN (delayed token)",
    "def": {
      "scryfallId": "18bdc181-9592-4147-81fb-7f83ce137f70",
      "oracleId": "18bdc181-9592-4147-81fb-7f83ce137f70",
      "name": "Ugin, the Ineffable",
      "lang": "en",
      "layout": "normal",
      "cmc": 0,
      "colorIdentity": [],
      "typeLine": "Legendary Planeswalker — Ugin",
      "faces": [
        {
          "name": "Ugin, the Ineffable",
          "typeLine": "Legendary Planeswalker — Ugin",
          "oracleText": "Colorless spells you cast cost {2} less to cast.\n+1: Exile the top card of your library face down and look at it. Create a 2/2 colorless Spirit creature token. When that token leaves the battlefield, put the exiled card into your hand.\n−3: Destroy target permanent that's one or more colors."
        }
      ]
    }
  },
  {
    "cluster": "leaves research-FN (artifact or creature)",
    "def": {
      "scryfallId": "2ffb38ec-5852-4e91-85a5-cfccd1f23556",
      "oracleId": "2ffb38ec-5852-4e91-85a5-cfccd1f23556",
      "name": "Tarrian's Soulcleaver",
      "lang": "en",
      "layout": "normal",
      "cmc": 0,
      "colorIdentity": [],
      "typeLine": "Legendary Artifact — Equipment",
      "faces": [
        {
          "name": "Tarrian's Soulcleaver",
          "typeLine": "Legendary Artifact — Equipment",
          "oracleText": "Equipped creature has vigilance.\nWhenever another artifact or creature is put into a graveyard from the battlefield, put a +1/+1 counter on equipped creature.\nEquip {2}"
        }
      ]
    }
  },
  {
    "cluster": "attacks research-FN (bullet)",
    "def": {
      "scryfallId": "5958e9e3-9457-48e1-afc1-a5c89e3b0ed0",
      "oracleId": "5958e9e3-9457-48e1-afc1-a5c89e3b0ed0",
      "name": "Struggle for Project Purity",
      "lang": "en",
      "layout": "normal",
      "cmc": 0,
      "colorIdentity": [],
      "typeLine": "Enchantment",
      "faces": [
        {
          "name": "Struggle for Project Purity",
          "typeLine": "Enchantment",
          "oracleText": "As this enchantment enters, choose Brotherhood or Enclave.\n• Brotherhood — At the beginning of your upkeep, each opponent draws a card. You draw a card for each card drawn this way.\n• Enclave — Whenever a player attacks you with one or more creatures, that player gets twice that many rad counters."
        }
      ]
    }
  },
  {
    "cluster": "attacks research-FN (loyalty prefix)",
    "def": {
      "scryfallId": "2274c7ae-5a40-4fd4-a4ac-6f56b23034e4",
      "oracleId": "2274c7ae-5a40-4fd4-a4ac-6f56b23034e4",
      "name": "Jace, Architect of Thought",
      "lang": "en",
      "layout": "normal",
      "cmc": 0,
      "colorIdentity": [],
      "typeLine": "Legendary Planeswalker — Jace",
      "faces": [
        {
          "name": "Jace, Architect of Thought",
          "typeLine": "Legendary Planeswalker — Jace",
          "oracleText": "+1: Until your next turn, whenever a creature an opponent controls attacks, it gets -1/-0 until end of turn.\n−2: Reveal the top three cards of your library. An opponent separates those cards into two piles. Put one pile into your hand and the other on the bottom of your library in any order.\n−8: For each player, search that player's library for a nonland card and exile it, then that player shuffles. You may cast those cards without paying their mana costs."
        }
      ]
    }
  },
  {
    "cluster": "attacks runtime-FN (is attacked)",
    "def": {
      "scryfallId": "ba0d3df2-3acf-46d7-8d64-8d67d1579adc",
      "oracleId": "ba0d3df2-3acf-46d7-8d64-8d67d1579adc",
      "name": "Curse of Opulence",
      "lang": "en",
      "layout": "normal",
      "cmc": 0,
      "colorIdentity": [],
      "typeLine": "Enchantment — Aura Curse",
      "faces": [
        {
          "name": "Curse of Opulence",
          "typeLine": "Enchantment — Aura Curse",
          "oracleText": "Enchant player\nWhenever enchanted player is attacked, create a Gold token. Each opponent attacking that player does the same. (A Gold token is an artifact with \"Sacrifice this token: Add one mana of any color.\")"
        }
      ]
    }
  },
  {
    "cluster": "attacks runtime-FN (name period)",
    "def": {
      "scryfallId": "c2008ba9-00df-4607-ba0c-189af52033eb",
      "oracleId": "c2008ba9-00df-4607-ba0c-189af52033eb",
      "name": "Mr. Foxglove",
      "lang": "en",
      "layout": "normal",
      "cmc": 0,
      "colorIdentity": [],
      "typeLine": "Legendary Creature — Fox Rogue",
      "faces": [
        {
          "name": "Mr. Foxglove",
          "typeLine": "Legendary Creature — Fox Rogue",
          "oracleText": "Lifelink\nWhenever Mr. Foxglove attacks, draw cards equal to the number of cards in defending player's hand minus the number of cards in your hand. If you didn't draw cards this way, you may put a creature card from your hand onto the battlefield."
        }
      ]
    }
  },
  {
    "cluster": "draw runtime-FN (comma enumeration)",
    "def": {
      "scryfallId": "f349f58b-8cc8-45e4-9565-2b46fdf976c9",
      "oracleId": "f349f58b-8cc8-45e4-9565-2b46fdf976c9",
      "name": "Trouble in Pairs",
      "lang": "en",
      "layout": "normal",
      "cmc": 0,
      "colorIdentity": [],
      "typeLine": "Enchantment",
      "faces": [
        {
          "name": "Trouble in Pairs",
          "typeLine": "Enchantment",
          "oracleText": "If an opponent would begin an extra turn, that player skips that turn instead.\nWhenever an opponent attacks you with two or more creatures, draws their second card each turn, or casts their second spell each turn, you draw a card."
        }
      ]
    }
  },
  {
    "cluster": "draw research-FN (Descend prefix)",
    "def": {
      "scryfallId": "2ca969eb-3d79-4d1f-8d9d-7b8204ad166a",
      "oracleId": "2ca969eb-3d79-4d1f-8d9d-7b8204ad166a",
      "name": "Starving Revenant",
      "lang": "en",
      "layout": "normal",
      "cmc": 0,
      "colorIdentity": [],
      "typeLine": "Creature — Spirit Horror",
      "faces": [
        {
          "name": "Starving Revenant",
          "typeLine": "Creature — Spirit Horror",
          "oracleText": "When this creature enters, surveil 2. Then for each card you put on top of your library, you draw a card and you lose 3 life.\nDescend 8 — Whenever you draw a card, if there are eight or more permanent cards in your graveyard, target opponent loses 1 life and you gain 1 life."
        }
      ]
    }
  },
  {
    "cluster": "landfall runtime-FP (ability-word on spell)",
    "def": {
      "scryfallId": "ddbacb74-1f98-4607-a92e-d14973b9d0ef",
      "oracleId": "ddbacb74-1f98-4607-a92e-d14973b9d0ef",
      "name": "Groundswell",
      "lang": "en",
      "layout": "normal",
      "cmc": 0,
      "colorIdentity": [],
      "typeLine": "Instant",
      "faces": [
        {
          "name": "Groundswell",
          "typeLine": "Instant",
          "oracleText": "Target creature gets +2/+2 until end of turn.\nLandfall — If you had a land enter the battlefield under your control this turn, that creature gets +4/+4 until end of turn instead."
        }
      ]
    }
  }
];
