// Auto-generated high-confidence classifier regression corpus.
// Oracle text from the Scryfall snapshot (2026-06-19). See
// docs/engine-spec.md §26 and research/classifier-accuracy/.
// Reviewer-owned (paired with review.classifier-corpus.test.ts).

export interface CorpusEntry {
  name: string;
  typeLine: string;
  oracleText: string;
  expectKeywords: string[];
  forbidKeywords: string[];
  expectTags: string[];
  forbidTags: string[];
  scryfallKeywords: string[];
  confidence: 'high' | 'medium' | 'low';
  note: string;
}

export const classifierCorpus: CorpusEntry[] = [
  {
    "name": "Serra Angel",
    "typeLine": "Creature — Angel",
    "oracleText": "Flying\nVigilance (Attacking doesn't cause this creature to tap.)",
    "expectKeywords": [
      "flying",
      "vigilance"
    ],
    "forbidKeywords": [],
    "expectTags": [],
    "forbidTags": [],
    "scryfallKeywords": [
      "Flying",
      "Vigilance"
    ],
    "confidence": "high",
    "note": ""
  },
  {
    "name": "Baleful Strix",
    "typeLine": "Artifact Creature — Bird",
    "oracleText": "Flying, deathtouch\nWhen this creature enters, draw a card.",
    "expectKeywords": [
      "flying",
      "deathtouch"
    ],
    "forbidKeywords": [],
    "expectTags": [
      "trigger.etb",
      "action.draw"
    ],
    "forbidTags": [],
    "scryfallKeywords": [
      "Deathtouch",
      "Flying"
    ],
    "confidence": "high",
    "note": ""
  },
  {
    "name": "Eternal Witness",
    "typeLine": "Creature — Human Shaman",
    "oracleText": "When this creature enters, you may return target card from your graveyard to your hand.",
    "expectKeywords": [],
    "forbidKeywords": [],
    "expectTags": [
      "trigger.etb",
      "action.return"
    ],
    "forbidTags": [],
    "scryfallKeywords": [],
    "confidence": "high",
    "note": ""
  },
  {
    "name": "Sun Titan",
    "typeLine": "Creature — Giant",
    "oracleText": "Vigilance\nWhenever this creature enters or attacks, you may return target permanent card with mana value 3 or less from your graveyard to the battlefield.",
    "expectKeywords": [
      "vigilance"
    ],
    "forbidKeywords": [],
    "expectTags": [
      "trigger.etb"
    ],
    "forbidTags": [],
    "scryfallKeywords": [
      "Vigilance"
    ],
    "confidence": "high",
    "note": "vigilance possessed; ETB/attack trigger"
  },
  {
    "name": "Niv-Mizzet, Parun",
    "typeLine": "Legendary Creature — Dragon Wizard",
    "oracleText": "This spell can't be countered.\nFlying\nWhenever you draw a card, Niv-Mizzet deals 1 damage to any target.\nWhenever a player casts an instant or sorcery spell, you draw a card.",
    "expectKeywords": [
      "flying"
    ],
    "forbidKeywords": [],
    "expectTags": [
      "trigger.cast-watcher"
    ],
    "forbidTags": [],
    "scryfallKeywords": [
      "Flying"
    ],
    "confidence": "high",
    "note": "cast watcher (whenever a player casts)"
  },
  {
    "name": "Lightning Greaves",
    "typeLine": "Artifact — Equipment",
    "oracleText": "Equipped creature has haste and shroud. (It can't be the target of spells or abilities.)\nEquip {0}",
    "expectKeywords": [
      "equip"
    ],
    "forbidKeywords": [
      "haste",
      "shroud"
    ],
    "expectTags": [],
    "forbidTags": [],
    "scryfallKeywords": [
      "Equip"
    ],
    "confidence": "high",
    "note": "grants haste/shroud to equipped; not possessed"
  },
  {
    "name": "Swiftfoot Boots",
    "typeLine": "Artifact — Equipment",
    "oracleText": "Equipped creature has hexproof and haste. (It can't be the target of spells or abilities your opponents control. It can attack and {T} no matter when it came under your control.)\nEquip {1} ({1}: Attach to target creature you control. Equip only as a sorcery.)",
    "expectKeywords": [
      "equip"
    ],
    "forbidKeywords": [
      "haste",
      "hexproof"
    ],
    "expectTags": [],
    "forbidTags": [],
    "scryfallKeywords": [
      "Equip"
    ],
    "confidence": "high",
    "note": "grants to equipped; not possessed"
  },
  {
    "name": "Skullclamp",
    "typeLine": "Artifact — Equipment",
    "oracleText": "Equipped creature gets +1/-1.\nWhenever equipped creature dies, draw two cards.\nEquip {1}",
    "expectKeywords": [
      "equip"
    ],
    "forbidKeywords": [],
    "expectTags": [],
    "forbidTags": [],
    "scryfallKeywords": [
      "Equip"
    ],
    "confidence": "high",
    "note": ""
  },
  {
    "name": "Faithless Looting",
    "typeLine": "Sorcery",
    "oracleText": "Draw two cards, then discard two cards.\nFlashback {2}{R} (You may cast this card from your graveyard for its flashback cost. Then exile it.)",
    "expectKeywords": [
      "flashback"
    ],
    "forbidKeywords": [],
    "expectTags": [
      "action.draw",
      "action.discard",
      "concept.alt-cast"
    ],
    "forbidTags": [],
    "scryfallKeywords": [
      "Flashback"
    ],
    "confidence": "high",
    "note": ""
  },
  {
    "name": "Cultivate",
    "typeLine": "Sorcery",
    "oracleText": "Search your library for up to two basic land cards, reveal those cards, put one onto the battlefield tapped and the other into your hand, then shuffle.",
    "expectKeywords": [],
    "forbidKeywords": [],
    "expectTags": [
      "action.search",
      "action.shuffle"
    ],
    "forbidTags": [],
    "scryfallKeywords": [],
    "confidence": "high",
    "note": ""
  },
  {
    "name": "Swords to Plowshares",
    "typeLine": "Instant",
    "oracleText": "Exile target creature. Its controller gains life equal to its power.",
    "expectKeywords": [],
    "forbidKeywords": [],
    "expectTags": [
      "action.exile",
      "concept.target"
    ],
    "forbidTags": [],
    "scryfallKeywords": [],
    "confidence": "high",
    "note": ""
  },
  {
    "name": "Sol Ring",
    "typeLine": "Artifact",
    "oracleText": "{T}: Add {C}{C}.",
    "expectKeywords": [],
    "forbidKeywords": [],
    "expectTags": [],
    "forbidTags": [],
    "scryfallKeywords": [],
    "confidence": "high",
    "note": "mana rock; no evergreen"
  },
  {
    "name": "Lotus Cobra",
    "typeLine": "Creature — Snake",
    "oracleText": "Landfall — Whenever a land you control enters, add one mana of any color.",
    "expectKeywords": [],
    "forbidKeywords": [],
    "expectTags": [
      "trigger.landfall"
    ],
    "forbidTags": [],
    "scryfallKeywords": [
      "Landfall"
    ],
    "confidence": "high",
    "note": ""
  },
  {
    "name": "Sakura-Tribe Elder",
    "typeLine": "Creature — Snake Shaman",
    "oracleText": "Sacrifice this creature: Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.",
    "expectKeywords": [],
    "forbidKeywords": [],
    "expectTags": [
      "action.search",
      "action.sacrifice"
    ],
    "forbidTags": [],
    "scryfallKeywords": [],
    "confidence": "high",
    "note": ""
  },
  {
    "name": "Mana Drain",
    "typeLine": "Instant",
    "oracleText": "Counter target spell. At the beginning of your next main phase, add an amount of {C} equal to that spell's mana value.",
    "expectKeywords": [],
    "forbidKeywords": [],
    "expectTags": [
      "action.counter",
      "concept.target"
    ],
    "forbidTags": [],
    "scryfallKeywords": [],
    "confidence": "high",
    "note": ""
  },
  {
    "name": "Path to Exile",
    "typeLine": "Instant",
    "oracleText": "Exile target creature. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle.",
    "expectKeywords": [],
    "forbidKeywords": [],
    "expectTags": [
      "action.exile",
      "action.search",
      "concept.target"
    ],
    "forbidTags": [],
    "scryfallKeywords": [],
    "confidence": "high",
    "note": ""
  },
  {
    "name": "Craterhoof Behemoth",
    "typeLine": "Creature — Beast",
    "oracleText": "Haste\nWhen this creature enters, creatures you control gain trample and get +X/+X until end of turn, where X is the number of creatures you control.",
    "expectKeywords": [
      "haste"
    ],
    "forbidKeywords": [
      "trample"
    ],
    "expectTags": [
      "trigger.etb"
    ],
    "forbidTags": [],
    "scryfallKeywords": [
      "Haste"
    ],
    "confidence": "high",
    "note": "grants trample to others; itself only haste"
  },
  {
    "name": "Sheoldred, the Apocalypse",
    "typeLine": "Legendary Creature — Phyrexian Praetor",
    "oracleText": "Deathtouch\nWhenever you draw a card, you gain 2 life.\nWhenever an opponent draws a card, they lose 2 life.",
    "expectKeywords": [
      "deathtouch"
    ],
    "forbidKeywords": [],
    "expectTags": [],
    "forbidTags": [],
    "scryfallKeywords": [
      "Deathtouch"
    ],
    "confidence": "high",
    "note": ""
  },
  {
    "name": "Birds of Paradise",
    "typeLine": "Creature — Bird",
    "oracleText": "Flying\n{T}: Add one mana of any color.",
    "expectKeywords": [
      "flying"
    ],
    "forbidKeywords": [],
    "expectTags": [],
    "forbidTags": [],
    "scryfallKeywords": [
      "Flying"
    ],
    "confidence": "high",
    "note": ""
  },
  {
    "name": "Ghalta, Primal Hunger",
    "typeLine": "Legendary Creature — Elder Dinosaur",
    "oracleText": "This spell costs {X} less to cast, where X is the total power of creatures you control.\nTrample (This creature can deal excess combat damage to the player or planeswalker it's attacking.)",
    "expectKeywords": [
      "trample"
    ],
    "forbidKeywords": [],
    "expectTags": [],
    "forbidTags": [],
    "scryfallKeywords": [
      "Trample"
    ],
    "confidence": "high",
    "note": ""
  },
  {
    "name": "Solemn Simulacrum",
    "typeLine": "Artifact Creature — Golem",
    "oracleText": "When this creature enters, you may search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.\nWhen this creature dies, you may draw a card.",
    "expectKeywords": [],
    "forbidKeywords": [],
    "expectTags": [
      "trigger.etb",
      "action.search"
    ],
    "forbidTags": [],
    "scryfallKeywords": [],
    "confidence": "high",
    "note": ""
  },
  {
    "name": "Cyclonic Rift",
    "typeLine": "Instant",
    "oracleText": "Return target nonland permanent you don't control to its owner's hand.\nOverload {6}{U} (You may cast this spell for its overload cost. If you do, change \"target\" in its text to \"each.\")",
    "expectKeywords": [],
    "forbidKeywords": [],
    "expectTags": [
      "concept.target"
    ],
    "forbidTags": [
      "action.return"
    ],
    "scryfallKeywords": [
      "Overload"
    ],
    "confidence": "high",
    "note": "bounce(手札へ戻す)はaction.return(墓地/追放からの回収)ではない。分類器が除外して正しい。overloadも常磐木外"
  },
  {
    "name": "Goddric, Cloaked Reveler",
    "typeLine": "Legendary Creature — Human Noble",
    "oracleText": "Haste\nCelebration — As long as two or more nonland permanents entered the battlefield under your control this turn, Goddric is a Dragon with base power and toughness 4/4, flying, and \"{R}: Dragons you control get +1/+0 until end of turn.\" (It loses all other creature types.)",
    "expectKeywords": [
      "haste"
    ],
    "forbidKeywords": [
      "flying"
    ],
    "expectTags": [],
    "forbidTags": [],
    "scryfallKeywords": [
      "Flying",
      "Celebration",
      "Haste"
    ],
    "confidence": "high",
    "note": "KNOWN DIVERGENCE: flying only via conditional 'is a Dragon with flying' (grant!=has). Scryfall lists Flying."
  },
  {
    "name": "Mother of Runes",
    "typeLine": "Creature — Human Cleric",
    "oracleText": "{T}: Target creature you control gains protection from the color of your choice until end of turn.",
    "expectKeywords": [],
    "forbidKeywords": [],
    "expectTags": [],
    "forbidTags": [],
    "scryfallKeywords": [],
    "confidence": "high",
    "note": ""
  }
];
