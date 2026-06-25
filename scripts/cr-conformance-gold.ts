import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

import type { CrAxis, CrGoldEntry } from './lib/crConformance.ts';

const INPUT_PATH = resolve(
  process.cwd(),
  'research/scryfall-rules/2026-06-19/raw/scryfall-search-game-paper-date-2021-06-19-unique-cards.cards.json',
);
const OUTPUT_PATH = resolve(process.cwd(), 'research/cr-conformance/gold.json');

interface GoldRecipe {
  axis: CrAxis;
  expected: string[];
  crRule: string;
  rationale: string;
  cardNames: string[];
}

const RECIPES: readonly GoldRecipe[] = [
  {
    axis: 'layer',
    expected: ['L7c'],
    crRule: 'CR 613.1g, 613.4c',
    rationale:
      'A continuous effect that modifies power and/or toughness without setting it applies in layer 7c.',
    cardNames: [
      '+2 Mace',
      'A Tale for the Ages',
      'Bloodthorn Flail',
      'Bone Saw',
      'Chief of the Foundry',
      'Cleaving Sliver',
      'Crucible of Fire',
      'Day of Destiny',
      'Greataxe',
      'Greatsword',
    ],
  },
  {
    axis: 'layer',
    expected: ['L6'],
    crRule: 'CR 613.1f',
    rationale:
      'A continuous effect that adds, removes, or prevents an ability applies in layer 6.',
    cardNames: [
      'Aang, Air Nomad',
      'Adept Watershaper',
      'Aggressive Mammoth',
      "Akroma's Memorial",
      'Alibou, Ancient Witness',
      'Archetype of Aggression',
      'Archetype of Finality',
      'Archetype of Imagination',
      'Asceticism',
      "Avacyn's Memorial",
    ],
  },
  {
    axis: 'layer',
    expected: ['L5'],
    crRule: 'CR 613.1e',
    rationale: 'A continuous effect that changes color applies in layer 5.',
    cardNames: ['Transguild Courier', 'Ghostflame Sliver'],
  },
  {
    axis: 'layer',
    expected: ['L5', 'L6'],
    crRule: 'CR 613.1e, 613.1f, 613.6',
    rationale:
      'The color-setting part applies in layer 5 and the granted convoke ability applies in layer 6.',
    cardNames: ['Fallaji Wayfarer'],
  },
  {
    axis: 'layer',
    expected: ['L4', 'L5'],
    crRule: 'CR 613.1d, 613.1e, 613.6',
    rationale:
      'The type-changing part applies in layer 4 and the color-changing part applies in layer 5.',
    cardNames: ['Mycosynth Lattice', 'Leyline of the Guildpact'],
  },
  {
    axis: 'layer',
    expected: ['L4'],
    crRule: 'CR 613.1d',
    rationale:
      'A continuous effect that changes card types, subtypes, or supertypes applies in layer 4.',
    cardNames: ['Dryad of the Ilysian Grove', 'Prismatic Omen', "Nylea's Presence"],
  },
  {
    axis: 'layer',
    expected: ['L4', 'L6', 'L7c'],
    crRule: 'CR 613.1d, 613.1f, 613.4c, 613.6',
    rationale:
      'The same continuous effect changes subtype in layer 4, adds abilities in layer 6, and modifies power/toughness in layer 7c.',
    cardNames: ['Alien Symbiosis', 'Angelic Destiny'],
  },
  {
    axis: 'layer',
    expected: ['L7d'],
    crRule: 'CR 613.4d',
    rationale: 'An effect that switches power and toughness applies in layer 7d.',
    cardNames: [
      'About Face',
      'Aquamoeba',
      'Flatman',
      'Inside Out',
      'Inversion Behemoth',
      'Merfolk Thaumaturgist',
      'Reverse the Polarity',
      'Turtleshell Changeling',
      'Twisted Image',
    ],
  },
  {
    axis: 'layer',
    expected: ['L1a'],
    crRule: 'CR 613.1a, 707.2',
    rationale:
      'An enters-as-copy effect modifies copiable values in copy layer 1a.',
    cardNames: ['Clone'],
  },
  {
    axis: 'event-family',
    expected: ['enters'],
    crRule: 'CR 603.1, 603.6a',
    rationale:
      'The sole trigger condition is a permanent entering, so the deterministic event family is enters.',
    cardNames: [
      'Aarakocra Sneak',
      'Abigale, Eloquent First-Year',
      'Abraded Bluffs',
      'Abundant Growth',
      'Abyssal Gorestalker',
      'Accursed Marauder',
      'Acidic Slime',
      "Adventurer's Inn",
    ],
  },
  {
    axis: 'event-family',
    expected: ['dies'],
    crRule: 'CR 603.1, 700.4',
    rationale:
      'The sole trigger condition uses dies, the defined battlefield-to-graveyard creature event.',
    cardNames: [
      'Agents of HYDRA',
      'Agent Venom',
      'Akki Ember-Keeper',
      'Alabaster Dragon',
      'Anafenza, Unyielding Lineage',
      'Ancient Stone Idol',
      'Archon of Falling Stars',
      'Archon of Justice',
    ],
  },
  {
    axis: 'event-family',
    expected: ['cast'],
    crRule: 'CR 603.1, 603.2, 601.2',
    rationale:
      'The sole trigger condition is casting a spell, so the deterministic event family is cast.',
    cardNames: [
      'Aberrant Manawurm',
      'Academy Wall',
      'Adeliz, the Cinder Wind',
      'Aetherflux Reservoir',
      'Alela, Artful Provocateur',
      'Ancient Cornucopia',
      'Angry Rabble',
      'Animar, Soul of Elements',
    ],
  },
  {
    axis: 'event-family',
    expected: ['attacks'],
    crRule: 'CR 508.1m, 508.3, 603.1',
    rationale:
      'The sole trigger condition is an attacker being declared, so the event family is attacks.',
    cardNames: [
      'Acquired Mutation',
      'Adaptive Omnitool',
      'Adrestia',
      "Adventurer's Airship",
      'Aerial Guide',
      'Aerial Surveyor',
      'Agate-Blade Assassin',
      'Agents of S.H.I.E.L.D.',
    ],
  },
  {
    axis: 'event-family',
    expected: ['phase'],
    crRule: 'CR 603.1, 603.2b',
    rationale:
      'The sole trigger condition is the beginning of a named phase or step, so the event family is phase.',
    cardNames: [
      'Abiding Grace',
      'Advocate of the Beast',
      'Aethersquall Ancient',
      'Aether Vial',
      'Air Nomad Student',
      'Angelic Accord',
      "April O'Neil, Hacktivist",
      'Archfiend of Despair',
    ],
  },
  {
    axis: 'zone-transition',
    expected: ['hand', 'library'],
    crRule: 'CR 121.1',
    rationale:
      'Drawing moves cards from the top of the library to the drawing player’s hand.',
    cardNames: [
      "Ambition's Cost",
      'Ancient Craving',
      'Arcane Encyclopedia',
      'Arcane Epiphany',
      'Brilliant Plan',
      'Concentrate',
      'Harmonize',
      'Quick Study',
    ],
  },
  {
    axis: 'zone-transition',
    expected: ['battlefield', 'graveyard'],
    crRule: 'CR 701.8a',
    rationale:
      'Destroying a permanent moves it from the battlefield to its owner’s graveyard.',
    cardNames: [
      'Eviscerate',
      'Fell',
      'Ice Storm',
      'Murder',
      'Vindicate',
      "Ajani's Response",
      "Assassin's Ink",
      'Bedevil',
    ],
  },
  {
    axis: 'zone-transition',
    expected: ['battlefield', 'exile'],
    crRule: 'CR 406.2, 701.13a',
    rationale:
      'Exiling the targeted permanent moves it from its current battlefield zone to exile.',
    cardNames: [
      'Final Reward',
      'Unmake',
      'Wander Off',
      'Angelic Edict',
      'Astral Confrontation',
      'Banish from Edoras',
      'Bring to Trial',
      'Despark',
    ],
  },
  {
    axis: 'zone-transition',
    expected: ['battlefield', 'hand'],
    crRule: 'CR 400.3, 400.7',
    rationale:
      'Returning the targeted permanent to its owner’s hand moves it from battlefield to hand.',
    cardNames: [
      'Boomerang',
      'Unsummon',
      'Bounce Off',
      'Hoodwink',
      'Snap',
      'Erratic Portal',
      'Fumble',
      'Light the Way',
    ],
  },
  {
    axis: 'zone-transition',
    expected: ['hand', 'library'],
    crRule: 'CR 400.7, 701.23a',
    rationale:
      'The instruction searches the library and moves the found card into the searcher’s hand.',
    cardNames: [
      'Demonic Tutor',
      'Diabolic Tutor',
      "Eladamri's Call",
      'Fabricate',
      'Idyllic Tutor',
      'Merchant Scroll',
      'Solve the Equation',
      "Steelshaper's Gift",
    ],
  },
  {
    axis: 'timing',
    expected: ['upkeep'],
    crRule: 'CR 500.1, 503, 603.2b',
    rationale:
      'The ability triggers at the beginning of an upkeep step, fixing the upkeep juncture.',
    cardNames: [
      'Abzan Beastmaster',
      'Aegis Sculptor',
      'Alexios, Deimos of Kosmos',
      'Aminatou, Veil Piercer',
      'Angel of Flight Alabaster',
      'Anowon, the Ruin Sage',
      'Arcades Sabboth',
      'Ascendant Acolyte',
    ],
  },
  {
    axis: 'timing',
    expected: ['end-step'],
    crRule: 'CR 512, 513, 603.2b',
    rationale:
      'The ability triggers at the beginning of an end step, fixing the end-step juncture.',
    cardNames: [
      'Admiral Beckett Brass',
      'Agent of Treachery',
      'Agitator Ant',
      'Akal Pakal, First Among Equals',
      "Angel's Trumpet",
      'Archfiend of Depravity',
      'Astarion, the Decadent',
      'Ashcoat of the Shadow Swarm',
    ],
  },
  {
    axis: 'timing',
    expected: ['begin-combat'],
    crRule: 'CR 506.1, 507, 603.2b',
    rationale:
      'The ability triggers at the beginning of combat, fixing the beginning-of-combat juncture.',
    cardNames: [
      'Additive Evolution',
      'Aethershield Artificer',
      'Agent Bishop, Man in Black',
      'Alacrian Armory',
      'Alien Invasion',
      'Archpriest of Iona',
      'Arclight Phoenix',
      'Battle-Rattle Shaman',
    ],
  },
  {
    axis: 'timing',
    expected: ['draw'],
    crRule: 'CR 504, 603.2b',
    rationale:
      'The ability triggers at the beginning of a draw step, fixing the draw-step juncture.',
    cardNames: [
      'Academy Loremaster',
      'Dictate of Kruphix',
      'Font of Mythos',
      'Howling Mine',
      'Kami of the Crescent Moon',
      'Mornsong Aria',
      'Rites of Flourishing',
      'Sylvan Library',
    ],
  },
  {
    axis: 'timing',
    expected: ['main-precombat'],
    crRule: 'CR 505.1, 505.1a, 603.2b',
    rationale:
      'The first main phase is the precombat main phase, fixing the precombat-main juncture.',
    cardNames: [
      'Absorbing Man',
      'Abstract Paintmage',
      'Black Market Connections',
      'Coalition Relic',
    ],
  },
  {
    axis: 'timing',
    expected: ['main-postcombat'],
    crRule: 'CR 505.1, 505.1a, 603.2b',
    rationale:
      'The second main phase is a postcombat main phase, fixing the postcombat-main juncture.',
    cardNames: [
      'Acrobatic Cheerleader',
      'Cautious Survivor',
      'Estinien Varlineau',
      'Fireglass Mentor',
    ],
  },
];

async function main(): Promise<void> {
  const payload = JSON.parse(await readFile(INPUT_PATH, 'utf8')) as unknown;
  const cards = extractCards(payload);
  const cardsByName = new Map(
    cards.map((card) => [requiredString(card, 'name'), card] as const),
  );
  const seenOracleIds = new Set<string>();
  const gold: CrGoldEntry[] = [];

  for (const recipe of RECIPES) {
    for (const cardName of recipe.cardNames) {
      const card = cardsByName.get(cardName);
      if (!card) {
        throw new Error(`Snapshot card not found: ${cardName}`);
      }
      const oracleId =
        optionalString(card, 'oracle_id') ?? requiredString(card, 'id');
      if (seenOracleIds.has(oracleId)) {
        throw new Error(`Duplicate gold oracleId: ${oracleId} (${cardName})`);
      }
      seenOracleIds.add(oracleId);
      gold.push({
        oracleId,
        cardName,
        oracleText: cardOracleText(card),
        axis: recipe.axis,
        expected: recipe.expected,
        crRule: recipe.crRule,
        rationale: recipe.rationale,
      });
    }
  }

  const perAxis = gold.reduce<Record<CrAxis, number>>(
    (counts, entry) => {
      counts[entry.axis] += 1;
      return counts;
    },
    { layer: 0, 'event-family': 0, 'zone-transition': 0, timing: 0 },
  );
  if (gold.length < 150 || Object.values(perAxis).some((count) => count < 30)) {
    throw new Error(`Gold corpus is undersized: total=${gold.length} ${JSON.stringify(perAxis)}`);
  }

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(gold, null, 2)}\n`, 'utf8');
  console.log(`CR gold written: ${gold.length} cards ${JSON.stringify(perAxis)}`);
}

function extractCards(payload: unknown): Record<string, unknown>[] {
  const cards = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.cards)
      ? payload.cards
      : isRecord(payload) && Array.isArray(payload.data)
        ? payload.data
        : undefined;
  if (!cards || !cards.every(isRecord)) {
    throw new Error('Snapshot JSON must contain an array of card objects.');
  }
  return cards;
}

function cardOracleText(card: Record<string, unknown>): string {
  const oracleText = optionalString(card, 'oracle_text');
  if (oracleText) return oracleText;

  const faces = card.card_faces;
  if (!Array.isArray(faces) || !faces.every(isRecord)) {
    throw new Error(`Card has no oracle text: ${requiredString(card, 'name')}`);
  }
  const faceTexts = faces
    .map((face) => optionalString(face, 'oracle_text'))
    .filter((text): text is string => text !== undefined);
  if (faceTexts.length === 0) {
    throw new Error(`Card faces have no oracle text: ${requiredString(card, 'name')}`);
  }
  return faceTexts.join('\n//\n');
}

function requiredString(value: Record<string, unknown>, key: string): string {
  const field = optionalString(value, key);
  if (!field) {
    throw new Error(`Missing string field: ${key}`);
  }
  return field;
}

function optionalString(value: Record<string, unknown>, key: string): string | undefined {
  const field = value[key];
  return typeof field === 'string' && field.trim() !== '' ? field : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error: unknown) => {
  console.error(errorMessage(error));
  process.exitCode = 1;
});
