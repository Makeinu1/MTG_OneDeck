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
  },
  {
    "name": "Nalathni Dragon",
    "typeLine": "Creature — Dragon",
    "oracleText": "Flying; banding (Any creatures with banding, and up to one without, can attack in a band. Bands are blocked as a group. If any creatures with banding you control are blocking or being blocked by a creature, you divide that creature's combat damage, not its controller, among any of the creatures it's being blocked by or is blocking.)\n{R}: This creature gets +1/+0 until end of turn. If this ability has been activated four or more times this turn, sacrifice this creature at the beginning of the next end step.",
    "expectKeywords": [
      "flying",
      "banding"
    ],
    "forbidKeywords": [],
    "expectTags": [],
    "forbidTags": [],
    "scryfallKeywords": [
      "Flying",
      "Banding"
    ],
    "confidence": "high",
    "note": "Phase B F1: semicolon-separated keyword line 'Flying; banding' must split into both keywords."
  },
  {
    "name": "Bureau Headmaster",
    "typeLine": "Artifact — Equipment",
    "oracleText": "Equipment spells you cast cost {1} less to cast.\nEquip abilities you activate cost {1} less to activate.",
    "expectKeywords": [],
    "forbidKeywords": [
      "equip"
    ],
    "expectTags": [],
    "forbidTags": [],
    "scryfallKeywords": [],
    "confidence": "high",
    "note": "Phase B F2: 'Equip abilities you activate cost {N} less' is a cost-reduction sentence, not equip possession."
  },
  {
    "name": "Helitrooper",
    "typeLine": "Creature — Human Soldier",
    "oracleText": "Flying\nWhenever this creature attacks, another target attacking creature gains flying until end of turn.\nEquip abilities you activate that target this creature cost {2} less to activate.",
    "expectKeywords": [
      "flying"
    ],
    "forbidKeywords": [
      "equip"
    ],
    "expectTags": [],
    "forbidTags": [],
    "scryfallKeywords": [
      "Flying"
    ],
    "confidence": "high",
    "note": "Phase B F2: possesses flying (line 1); 'gains flying' is a grant and 'Equip abilities...cost less' is not equip possession."
  },
  {
    "name": "Strong Back",
    "typeLine": "Enchantment — Aura",
    "oracleText": "Enchant creature\nEquip abilities you activate that target enchanted creature cost {3} less to activate.\nAura spells you cast that target enchanted creature cost {3} less to cast.\nEnchanted creature gets +2/+2 for each Aura and Equipment attached to it.",
    "expectKeywords": [
      "enchant"
    ],
    "forbidKeywords": [
      "equip"
    ],
    "expectTags": [],
    "forbidTags": [],
    "scryfallKeywords": [
      "Enchant"
    ],
    "confidence": "high",
    "note": "Phase B F2: possesses enchant ('Enchant creature'); the 'Equip abilities...cost less' clause is not equip possession."
  },
  {
    "name": "Cloud, Planet's Champion",
    "typeLine": "Legendary Creature — Human Soldier Mercenary",
    "oracleText": "During your turn, as long as Cloud is equipped, it has double strike and indestructible. (This creature deals both first-strike and regular combat damage. Damage and effects that say \"destroy\" don't destroy this creature.)\nEquip abilities you activate that target Cloud cost {2} less to activate.",
    "expectKeywords": [],
    "forbidKeywords": [
      "equip"
    ],
    "expectTags": [],
    "forbidTags": [],
    "scryfallKeywords": [],
    "confidence": "high",
    "note": "Phase B F2: 'is equipped' mention and 'Equip abilities...cost less' must not register equip possession."
  },
  {
    "name": "Excalibur, Sword of Eden",
    "typeLine": "Legendary Artifact — Equipment",
    "oracleText": "This spell costs {X} less to cast, where X is the total mana value of historic permanents you control. (Artifacts, legendaries, and Sagas are historic.)\nEquipped creature gets +10/+0 and has vigilance.\nEquip legendary creature {2}",
    "expectKeywords": [
      "equip"
    ],
    "forbidKeywords": [
      "vigilance"
    ],
    "expectTags": [],
    "forbidTags": [],
    "scryfallKeywords": [],
    "confidence": "high",
    "note": "Phase B F3: 'Equip legendary creature {2}' (quality-word equip) is possession; granted vigilance is not. Scryfall omits Equip (known divergence)."
  },
  {
    "name": "Mjölnir, Hammer of Thor",
    "typeLine": "Legendary Artifact — Equipment",
    "oracleText": "When Mjölnir enters, it deals 4 damage to up to one target creature.\nDouble all damage equipped creature would deal.\nEquip worthy {1} (A creature is worthy if it's a legendary non-Villain that's red and/or white.)\n{2}{R}, Discard this card: It deals 2 damage to each creature.",
    "expectKeywords": [
      "equip"
    ],
    "forbidKeywords": [],
    "expectTags": [],
    "forbidTags": [],
    "scryfallKeywords": [
      "Double"
    ],
    "confidence": "high",
    "note": "Phase B F3: 'Equip worthy {1}' (quality-word equip) is possession. Scryfall omits Equip (known divergence)."
  },
  {
    "name": "Bard's Bow",
    "typeLine": "Artifact — Equipment",
    "oracleText": "Job select (When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this to it.)\nEquipped creature gets +2/+2, has reach, and is a Bard in addition to its other types.\nPerseus's Bow — Equip {6} ({6}: Attach to target creature you control. Equip only as a sorcery.)",
    "expectKeywords": [
      "equip"
    ],
    "forbidKeywords": [
      "reach"
    ],
    "expectTags": [],
    "forbidTags": [],
    "scryfallKeywords": [
      "Job select",
      "Equip"
    ],
    "confidence": "high",
    "note": "Phase B F3: ability-word/name-prefixed 'Perseus's Bow — Equip {6}' is equip possession; granted reach is not."
  }
];
