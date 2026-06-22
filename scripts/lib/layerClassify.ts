import { splitAbilityLines, type AbilityLine } from '../../src/engine/grammar/index.ts';
import type { CardDef, CardFace } from '../../src/types/card';

export type LayerId =
  | 'L1a'
  | 'L1b'
  | 'L2'
  | 'L3'
  | 'L4'
  | 'L5'
  | 'L6'
  | 'L7a'
  | 'L7b'
  | 'L7c'
  | 'L7d';

export interface LayerTag {
  layer: LayerId;
  cda: boolean;
  reads: string[];
  matchedText: string;
}

export interface CardLayerSummary {
  layers: LayerId[];
  cda: boolean;
}

const LAYER_ORDER: readonly LayerId[] = [
  'L1a',
  'L1b',
  'L2',
  'L3',
  'L4',
  'L5',
  'L6',
  'L7a',
  'L7b',
  'L7c',
  'L7d',
];

const KEYWORDS =
  'deathtouch|defender|double strike|first strike|flash|flying|haste|hexproof|indestructible|lifelink|menace|protection|reach|trample|vigilance|ward|prowess|shroud|fear|intimidate|landwalk|horsemanship|affinity|annihilator|battle cry|cascade|convoke|crew|cumulative upkeep|daybound|decayed|delve|devoid|devour|emerge|enchant|equip|escalate|escape|exalted|exploit|extort|fabricate|flanking|foretell|graft|hideaway|improvise|infect|kicker|living weapon|madness|modular|mutate|myriad|nightbound|ninjutsu|outlast|overload|persist|proliferate|provoke|ravenous|reconfigure|renown|replicate|retrace|riot|shadow|skulk|soulbond|soulshift|spectacle|storm|sunburst|surveil|suspend|toxic|training|undying|unleash|vanishing|wither';

const CARD_TYPES =
  'artifact|battle|creature|enchantment|instant|kindred|land|planeswalker|sorcery|tribal';

const TYPE_WORDS =
  `${CARD_TYPES}|Aura|Background|Clue|Contraption|Equipment|Food|Forest|Fortification|Gold|Island|Map|Mountain|Mountains|Plains|Powerstone|Role|Saga|Swamp|Treasure|Vehicle|Wastes`;

const COLOR_WORDS = 'white|blue|black|red|green|colorless';

const RULES: readonly {
  layer: Exclude<LayerId, 'L7a'>;
  reads: readonly string[];
  probes: readonly RegExp[];
  cda?: (text: string, line: AbilityLine, def: CardDef, face: CardFace | undefined) => boolean;
}[] = [
  {
    layer: 'L1a',
    reads: ['printed-characteristics'],
    probes: [/\b(?:becomes?|become|is|are)\s+(?:a\s+)?copy of\b[^.;]*/i],
  },
  {
    layer: 'L1b',
    reads: ['printed-characteristics'],
    probes: [/\bface down\b[^.;]*/i],
  },
  {
    layer: 'L2',
    reads: ['controller'],
    probes: [
      /\byou control\s+(?:enchanted|equipped|target|that|this)\b[^.;]*/i,
      /\bgain(?:s|ed|ing)? control of\b[^.;]*/i,
      /\bexchange control of\b[^.;]*/i,
    ],
  },
  {
    layer: 'L3',
    reads: ['rules-text'],
    probes: [
      /\btext\b[^.;]*\bbecomes?\b[^.;]*/i,
      /\bchange the text\b[^.;]*/i,
      /\breplace all instances\b[^.;]*(?:text|color word|basic land type)\b[^.;]*/i,
      /\b(?:color word|basic land type)\b[^.;]*\bchosen\b[^.;]*/i,
    ],
  },
  {
    layer: 'L4',
    reads: ['card-types', 'subtypes', 'supertypes'],
    probes: [
      /\bNonbasic lands are Mountains\b/i,
      new RegExp(String.raw`\b(?:is|are|becomes?|become)\s+every\s+(?:creature|basic land)\s+type\b[^.;]*`, 'i'),
      new RegExp(String.raw`\b(?:becomes?|become)\s+the\s+(?:creature|artifact|enchantment|land)\s+type\b[^.;]*`, 'i'),
      new RegExp(String.raw`\b(?:is|are|becomes?|become)\s+(?:a|an)\s+(?:${TYPE_WORDS}|[A-Z][A-Za-z'-]+)\b[^.;]*`, 'i'),
      new RegExp(String.raw`\b(?:is|are|becomes?|become)\s+(?:${TYPE_WORDS})\b[^.;]*`, 'i'),
      /\bin addition to (?:its|their) other types\b[^.;]*/i,
    ],
    cda: isCharacteristicDefiningLine,
  },
  {
    layer: 'L5',
    reads: ['colors'],
    probes: [
      new RegExp(String.raw`\b(?:is|are|becomes?|become)\s+(?:a\s+|an\s+)?(?:all colors|${COLOR_WORDS})(?:\s+and\s+(?:${COLOR_WORDS}))*\b[^.;]*`, 'i'),
      /\b(?:is|are|becomes?|become)\s+the color or colors of your choice\b[^.;]*/i,
      /\bhas no color\b[^.;]*/i,
    ],
    cda: isCharacteristicDefiningLine,
  },
  {
    layer: 'L6',
    reads: ['abilities', 'keyword-set'],
    probes: [
      new RegExp(String.raw`\b(?:have|has|gain|gains|gained|gaining)\b[^.;]*(?:${KEYWORDS}|abilit(?:y|ies))\b[^.;]*`, 'i'),
      new RegExp(String.raw`\b(?:lose|loses|lost|losing)\b[^.;]*(?:all\s+(?:other\s+)?abilit(?:y|ies)|abilit(?:y|ies)|${KEYWORDS})\b[^.;]*`, 'i'),
      /\bcan't have or gain\b[^.;]*/i,
      /\bcannot have or gain\b[^.;]*/i,
      new RegExp(String.raw`\b(?:${KEYWORDS}) counters?\b[^.;]*`, 'i'),
      /\bkeyword counters?\b[^.;]*/i,
    ],
  },
  {
    layer: 'L7b',
    reads: ['power', 'toughness'],
    probes: [
      /\bbase power and toughness\b[^.;]*\b(?:is|are|becomes?|become)?\s*(?:equal to\s*)?[+-]?(?:\d+|X|\*)\/[+-]?(?:\d+|X|\*)\b[^.;]*/i,
      /\bpower and toughness\b[^.;]*\b(?:are|is|becomes?|become)\b[^.;]*\bequal to\b[^.;]*/i,
    ],
  },
  {
    layer: 'L7c',
    reads: ['power', 'toughness'],
    probes: [
      /\bgets?\s+[+-](?:\d+|X|\*)\/[+-]?(?:\d+|X|\*)\b[^.;]*/i,
      /\b[+-](?:\d+|X)\/[+-]?(?:\d+|X)\s+counters?\b[^.;]*/i,
    ],
  },
  {
    layer: 'L7d',
    reads: ['power', 'toughness'],
    probes: [/\bswitch\b[^.;]*\bpower and toughness\b[^.;]*/i],
  },
];

const L7A_PROBES: readonly RegExp[] = [
  /\bpower is equal to\b[^.;]*/i,
  /\btoughness is equal to\b[^.;]*/i,
  /\bpower and toughness\b[^.;]*\b(?:are|is)\b[^.;]*\bequal to\b[^.;]*/i,
];

export function classifyContinuousLayers(line: AbilityLine, def: CardDef): LayerTag[] {
  const text = effectText(normalize(line.text));
  if (text === '' || isOneShotCopyTokenLine(text)) {
    return [];
  }

  const face = def.faces[line.faceIndex] ?? def.faces[0];
  const tags: LayerTag[] = [];

  const l7aMatch = firstMatch(text, L7A_PROBES);
  if (l7aMatch && isPowerToughnessCda(text, line, def, face)) {
    tags.push({
      layer: 'L7a',
      cda: true,
      reads: powerToughnessReads(text),
      matchedText: l7aMatch,
    });
  }

  for (const rule of RULES) {
    if (rule.layer === 'L7b' && l7aMatch && isPowerToughnessCda(text, line, def, face)) {
      continue;
    }
    const matchedText = firstMatch(text, rule.probes);
    if (!matchedText) {
      continue;
    }
    tags.push({
      layer: rule.layer,
      cda: rule.cda?.(text, line, def, face) ?? false,
      reads: [...rule.reads],
      matchedText,
    });
  }

  return dedupeAndSortTags(tags);
}

export function classifyCardLayers(def: CardDef): CardLayerSummary {
  const layers = new Set<LayerId>();
  let cda = false;

  for (const line of splitAbilityLines(def)) {
    for (const tag of classifyContinuousLayers(line, def)) {
      layers.add(tag.layer);
      cda ||= tag.cda;
    }
  }

  return {
    layers: [...layers].sort(compareLayerId),
    cda,
  };
}

function firstMatch(text: string, probes: readonly RegExp[]): string | undefined {
  for (const probe of probes) {
    const match = probe.exec(text);
    if (match?.[0]) {
      return normalize(match[0]);
    }
  }
  return undefined;
}

function dedupeAndSortTags(tags: readonly LayerTag[]): LayerTag[] {
  const byLayer = new Map<LayerId, LayerTag>();
  for (const tag of tags) {
    const existing = byLayer.get(tag.layer);
    if (!existing) {
      byLayer.set(tag.layer, {
        ...tag,
        reads: [...new Set(tag.reads)].sort(),
      });
      continue;
    }
    byLayer.set(tag.layer, {
      layer: tag.layer,
      cda: existing.cda || tag.cda,
      reads: [...new Set([...existing.reads, ...tag.reads])].sort(),
      matchedText: existing.cda ? existing.matchedText : tag.matchedText,
    });
  }
  return [...byLayer.values()].sort((a, b) => compareLayerId(a.layer, b.layer));
}

function compareLayerId(a: LayerId, b: LayerId): number {
  return LAYER_ORDER.indexOf(a) - LAYER_ORDER.indexOf(b);
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function effectText(line: string): string {
  const colonIndex = line.indexOf(':');
  if (colonIndex < 0) {
    return line;
  }

  const left = line.slice(0, colonIndex).trim();
  if (!isCostLikeActivatedPrefix(left)) {
    return line;
  }
  return line.slice(colonIndex + 1).trim();
}

function isCostLikeActivatedPrefix(left: string): boolean {
  if (left === '') {
    return false;
  }
  if (/\{T\}/i.test(left) || /\{[^}]+\}/.test(left)) {
    return true;
  }
  return /^(?:Sacrifice|Discard|Pay|Tap|Exile|Remove)\b\s+.+/i.test(left);
}

function isOneShotCopyTokenLine(text: string): boolean {
  return /^\bcreate(?:s|d)?\b[^.]*\btokens?\b[^.]*\bcopy of\b/i.test(text);
}

function isPowerToughnessCda(
  text: string,
  line: AbilityLine,
  def: CardDef,
  face: CardFace | undefined,
): boolean {
  if (line.shape !== 'static') {
    return false;
  }
  return hasStarPowerToughness(face) || startsWithSelfReference(text, def, face);
}

function isCharacteristicDefiningLine(
  text: string,
  line: AbilityLine,
  def: CardDef,
  face: CardFace | undefined,
): boolean {
  if (line.shape !== 'static') {
    return false;
  }
  if (
    /\b(?:enchanted|equipped|target|chosen|nonbasic|creatures? you control|creatures? your opponents control|lands? you control|permanents? you control|tokens? you control)\b/i.test(
      text,
    )
  ) {
    return false;
  }
  return startsWithSelfReference(text, def, face);
}

function startsWithSelfReference(text: string, def: CardDef, face: CardFace | undefined): boolean {
  if (/^this (?:card|creature|permanent|spell)\b/i.test(text)) {
    return true;
  }

  const names = [face?.name, def.name, def.name.split(' // ')[0]].filter(
    (name): name is string => typeof name === 'string' && name.length > 0,
  );
  return names.some((name) =>
    new RegExp(String.raw`^${escapeRegExp(name)}(?:'s)?\b`, 'i').test(text),
  );
}

function hasStarPowerToughness(face: CardFace | undefined): boolean {
  return Boolean(face?.power?.includes('*') || face?.toughness?.includes('*'));
}

function powerToughnessReads(text: string): string[] {
  const reads = ['power', 'toughness'];
  if (/\bgraveyards?\b/i.test(text)) {
    reads.push('count-graveyard');
  }
  if (/\bcards? in (?:your |its controller's |target player's )?hand\b/i.test(text)) {
    reads.push('count-hand');
  }
  if (/\bdevotion\b/i.test(text)) {
    reads.push('devotion');
  }
  if (/\bnumber of\b/i.test(text)) {
    reads.push('count');
  }
  return [...new Set(reads)].sort();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
