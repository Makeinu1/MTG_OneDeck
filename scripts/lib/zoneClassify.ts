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
  const permanentType = String.raw`(?:creatures?|artifacts?|enchantments?|planeswalkers?|lands?|permanents?)`;
  const specificPermanentType = String.raw`(?:creatures?|artifacts?|enchantments?|planeswalkers?|lands?)`;
  const targetPermanent = String.raw`\btarget\b(?![^.;]*\bcards?\b[^.;]*\bfrom\b[^.;]*\b(?:librar(?:y|ies)|hands?|graveyards?|exile|command zone)\b)[^.;]*\b${permanentType}\b(?!\s+cards?\b)`;
  const targetBattlefieldReturn = String.raw`\btarget\b[^.;]*(?:\b${specificPermanentType}\b(?!\s+cards?\b)|\b(?:nonland|noncreature|nontoken) permanents?\b|\bpermanents?\b[^.;]*\b(?:an opponent controls|you (?:do not|don't) control)\b)`;

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
  if (
    new RegExp(String.raw`\bdestroy(?:s|ed|ing)?\b[^.;]*\b${permanentType}\b`, 'i').test(
      text,
    ) ||
    new RegExp(String.raw`\bexil(?:e|es|ed|ing)\b[^.;]*${targetPermanent}`, 'i').test(text) ||
    new RegExp(
      String.raw`\breturn(?:s|ed|ing)?\b[^.;]*${targetBattlefieldReturn}[^.;]*\bto\b[^.;]*\b(?:hands?|owners?)\b`,
      'i',
    ).test(text) ||
    /\bcreates?\b[^.;]*\btokens?\b/i.test(text)
  ) {
    zones.add('battlefield');
  }

  return sortStrings(zones);
}

function touchesCrossPlayerZone(text: string): boolean {
  const zone = String.raw`(?:librar(?:y|ies)|hands?|graveyards?|battlefields?|exile|command zones?|stacks?)`;
  const directPossessiveScope = String.raw`(?:(?:an|each|target) opponent['’]s|(?:your )?opponents['’]|(?:each|each other|target|that|defending) player['’]s|(?:other )?players['’])`;
  const nonYouAntecedent = String.raw`(?:target player|that player|each(?: other)? player|a player|(?:an|each|target) opponent|opponents|the owner|its owner|its controller|players)`;

  if (new RegExp(String.raw`\b${directPossessiveScope}\s+${zone}\b`, 'i').test(text)) {
    return true;
  }

  if (
    new RegExp(String.raw`\b${nonYouAntecedent}\b[\s\S]*\btheir\s+${zone}\b`, 'i').test(text)
  ) {
    return true;
  }

  const ownerOrControllerPossessive = String.raw`(?:its (?:owner|controller)['’]s|their (?:owner['’]s|owners['’]))`;
  const explicitOtherPlayer = String.raw`(?:opponents?|target player|that player|defending player|you (?:do not|don't) control)`;
  if (
    new RegExp(
      String.raw`\b${explicitOtherPlayer}\b[\s\S]*\b${ownerOrControllerPossessive}\s+${zone}\b`,
      'i',
    ).test(text)
  ) {
    return true;
  }

  return /\bgraveyards?\b[^.;]*\bfrom anywhere\b/i.test(text);
}

function hasOwnershipReference(text: string): boolean {
  return hasOwnerScopeReference(text) || /\bowns?\b|\bowned\b/i.test(text);
}

function hasOwnerScopeReference(text: string): boolean {
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
  if (/\btarget (?:player|opponent)(?:['’]s)?\b/i.test(text)) {
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
  if (hasOwnerScopeReference(text)) {
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
