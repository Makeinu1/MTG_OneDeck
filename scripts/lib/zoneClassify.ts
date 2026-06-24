import { splitAbilityLines, type AbilityLine } from '../../src/engine/grammar/index.ts';
import { removeReminderAndQuotes } from '../../src/engine/keywordGrammar.ts';
import type { ZoneId } from '../../src/engine/types.ts';
import type { CardDef } from '../../src/types/card';

export type PlayerScope =
  | 'you'
  | 'target-player'
  | 'each-opponent'
  | 'each-player'
  | 'owner'
  | 'controller'
  | 'unknown';

export type OwnershipKind = 'owner' | 'controller' | 'both' | 'none';

export interface CardZoneSummary {
  zones: ZoneId[];
  crossPlayer: boolean;
  ownership: OwnershipKind;
  playerScopes: PlayerScope[];
}

export const ZONE_IDS: readonly ZoneId[] = [
  'battlefield',
  'command',
  'exile',
  'graveyard',
  'hand',
  'library',
  'stack',
];

export const PLAYER_SCOPES: readonly PlayerScope[] = [
  'controller',
  'each-opponent',
  'each-player',
  'owner',
  'target-player',
  'unknown',
  'you',
];

export const OWNERSHIP_KINDS: readonly OwnershipKind[] = ['both', 'controller', 'none', 'owner'];

export function classifyCardZones(def: CardDef): CardZoneSummary {
  const zones = new Set<ZoneId>();
  const playerScopes = new Set<PlayerScope>();
  let crossPlayer = false;
  let hasOwner = false;
  let hasController = false;

  for (const line of splitAbilityLines(def)) {
    const summary = classifyZonesForLine(line);
    for (const zone of summary.zones) {
      zones.add(zone);
    }
    for (const scope of summary.playerScopes) {
      playerScopes.add(scope);
    }
    crossPlayer ||= summary.crossPlayer;
    hasOwner ||= summary.ownership === 'owner' || summary.ownership === 'both';
    hasController ||= summary.ownership === 'controller' || summary.ownership === 'both';
  }

  return {
    zones: sortStrings(zones),
    crossPlayer,
    ownership: ownershipKind(hasOwner, hasController),
    playerScopes: sortStrings(playerScopes),
  };
}

export function classifyZonesForLine(line: AbilityLine): CardZoneSummary {
  const text = normalize(removeReminderAndQuotes(line.text));
  const zones = detectZones(text);
  const hasOwner = hasOwnershipReference(text);
  const hasController = hasControllerReference(text);

  return {
    zones,
    crossPlayer: touchesCrossPlayerZone(text),
    ownership: ownershipKind(hasOwner, hasController),
    playerScopes: detectPlayerScopes(text),
  };
}

function detectZones(text: string): ZoneId[] {
  const zones = new Set<ZoneId>();

  if (/\blibrar(?:y|ies)\b/i.test(text)) {
    zones.add('library');
  }
  if (/\bhands?\b/i.test(text)) {
    zones.add('hand');
  }
  if (/\bgraveyards?\b/i.test(text)) {
    zones.add('graveyard');
  }
  if (/\bbattlefields?\b|\benters?\b|\bentering\b/i.test(text)) {
    zones.add('battlefield');
  }
  if (/\bexil(?:e|es|ed|ing)\b/i.test(text)) {
    zones.add('exile');
  }
  if (/\bcommand zone\b/i.test(text)) {
    zones.add('command');
  }
  if (/\b(?:the )?stack\b/i.test(text)) {
    zones.add('stack');
  }

  if (/\bcounter(?:s|ed|ing)?\b[^.;]*\btarget\b[^.;]*\bspells?\b/i.test(text)) {
    zones.add('stack');
  }

  return sortStrings(zones);
}

function touchesCrossPlayerZone(text: string): boolean {
  const zone = String.raw`(?:library|hand|graveyard|battlefield|exile|command zone|stack)`;
  const possessiveScope = String.raw`(?:(?:an|each|target) opponent['’]s|(?:your )?opponents['’]|(?:each|each other|target) player['’]s|(?:other )?players['’])`;
  return new RegExp(String.raw`\b${possessiveScope}\s+${zone}\b`, 'i').test(text);
}

function hasOwnershipReference(text: string): boolean {
  return /\bowners?\b|owner['’]s|owners['’]/i.test(text);
}

function hasControllerReference(text: string): boolean {
  return /\bcontrol(?:s|led|ling)?\b/i.test(text) || /\bcontrollers?\b/i.test(text);
}

function detectPlayerScopes(text: string): PlayerScope[] {
  const scopes = new Set<PlayerScope>();

  if (/\byou\b|\byour\b|\byours\b/i.test(text)) {
    scopes.add('you');
  }
  if (/\btarget (?:player|opponent)s?\b/i.test(text)) {
    scopes.add('target-player');
  }
  if (
    /\b(?:an|each) opponent\b|\bopponents\b|\byour opponents?\b|\beach of your opponents\b/i.test(
      text,
    )
  ) {
    scopes.add('each-opponent');
  }
  if (/\b(?:each|each other|a) player\b/i.test(text)) {
    scopes.add('each-player');
  }
  if (hasOwnershipReference(text)) {
    scopes.add('owner');
  }
  if (/\bcontrollers?\b|\b(?:its|their) controller\b/i.test(text)) {
    scopes.add('controller');
  }

  if (scopes.size === 0 && /\bplayers?|opponents?|owners?|controllers?\b/i.test(text)) {
    scopes.add('unknown');
  }

  return sortStrings(scopes);
}

function ownershipKind(hasOwner: boolean, hasController: boolean): OwnershipKind {
  if (hasOwner && hasController) {
    return 'both';
  }
  if (hasOwner) {
    return 'owner';
  }
  if (hasController) {
    return 'controller';
  }
  return 'none';
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function sortStrings<T extends string>(values: Iterable<T>): T[] {
  return [...values].sort(compareStrings);
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
