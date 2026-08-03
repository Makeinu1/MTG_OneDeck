/**
 * CR 716 Class card level bar parser and activation legality.
 *
 * Parses oracle text lines of the form "{Cost}: Level N — [Abilities]" into
 * structured ClassLevelBar records. Provides keyword extraction from level bar
 * ability text (Layer 6 static half, CR 716.2a) and activation legality
 * checking (CR 716.2a: activate only if this Class is level N-1).
 */

import { KEYWORD_DEFINITIONS } from './keywordGrammar';
import type { GameState } from './types';

/**
 * The 14 status keyword ids recognized by effectiveKeywords (Layer 6).
 * Duplicated here (not imported from status.ts) to avoid a circular dependency:
 * status.ts imports parseClassLevelBars/classLevelBarKeywords from this module.
 */
const STATUS_KEYWORD_IDS: ReadonlySet<string> = new Set([
  'flying',
  'vigilance',
  'trample',
  'deathtouch',
  'lifelink',
  'menace',
  'first-strike',
  'double-strike',
  'reach',
  'haste',
  'hexproof',
  'indestructible',
  'defender',
  'ward',
]);

export interface ClassLevelBar {
  /** The level number N in "{Cost}: Level N — [Abilities]" */
  level: number;
  /** The activation cost text before the colon, e.g. "{1}{R}" */
  costText: string;
  /** The abilities text after the em-dash */
  abilitiesText: string;
}

const CLASS_LEVEL_BAR_RE = /^(.+):\s*Level\s+(\d+)\s*[—–-]\s*(.+)$/i;

/**
 * Parse Class oracle text into level bars (CR 716.2).
 *
 * Each line matching "{Cost}: Level N — [Abilities]" produces one ClassLevelBar.
 * Non-matching lines (top-section static abilities, triggered abilities) are ignored.
 * Returns bars in oracle-text order.
 * Empty/missing oracleText → [].
 */
export function parseClassLevelBars(oracleText: string | undefined | null): ClassLevelBar[] {
  if (!oracleText) return [];

  const bars: ClassLevelBar[] = [];
  const lines = oracleText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = CLASS_LEVEL_BAR_RE.exec(trimmed);
    if (!match) continue;

    bars.push({
      costText: match[1].trim(),
      level: Number.parseInt(match[2], 10),
      abilitiesText: match[3].trim(),
    });
  }

  return bars;
}

// Exact-match lookup from keyword display name (KEYWORD_DEFINITIONS.name,
// lower-cased) → id, restricted to the 14 status keywords that
// effectiveKeywords recognizes. Whole-word list items only; no sub-string
// matching.
const STATUS_KEYWORD_NAME_TO_ID = new Map<string, string>(
  KEYWORD_DEFINITIONS
    .filter((definition) => STATUS_KEYWORD_IDS.has(definition.id))
    .map((definition) => [definition.name.toLowerCase(), definition.id]),
);

/**
 * Strict keyword-word-list parser (cold-audit FINDING-1 discipline).
 *
 * Splits a captured word list on commas (with " and " normalized to a comma
 * separator) and requires EVERY word to map case-insensitively from a
 * KEYWORD_DEFINITIONS display name to an id inside STATUS_KEYWORD_IDS.
 * Any unrecognized word grants nothing for the whole sentence — the same
 * all-or-nothing discipline as status.ts parseKeywordWordList.
 * Returns null for an empty list.
 */
function parseClassBarKeywordWordList(raw: string): string[] | null {
  const words = raw
    .replace(/,?\s+and\s+/gi, ', ')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  if (words.length === 0) {
    return null;
  }
  const ids: string[] = [];
  for (const word of words) {
    const id = STATUS_KEYWORD_NAME_TO_ID.get(word.toLowerCase());
    if (!id) {
      return null;
    }
    ids.push(id);
  }
  return ids;
}

// A level bar's abilitiesText grants keywords to the Class itself only via
// sentences of the form "This Class gains <keywords>." or
// "This Class has <keywords>." — CR 716.2a static half ("As long as this
// Class is level N or greater, it has [abilities]"). Anchored
// sentence-level matching keeps keywords merely mentioned inside triggered
// or temporary ability text ("... target creature you control ... gains
// haste until end of turn.") from being mis-granted.
const CLASS_SELF_GRANT_RE = /^this\s+class\s+(?:gains|has)\s+(.+)$/i;

/**
 * Extract keyword identifiers from level bar ability text (CR 716.2a static half).
 *
 * For each bar where bar.level <= level, splits abilitiesText into sentences
 * and grants keywords only from sentences matching
 * /^this\s+class\s+(?:gains|has)\s+(.+)$/i. The captured word list is parsed
 * strictly: every word must map to a STATUS_KEYWORD_IDS id or the sentence
 * grants nothing (all-or-nothing). Keywords mentioned inside triggered or
 * temporary ability text are never granted.
 * Non-keyword abilities in the text are honestly ignored (deferred to a future
 * ability-granting slice).
 * Returns deduplicated keyword ids in first-seen order across qualifying bars.
 */
export function classLevelBarKeywords(bars: ClassLevelBar[], level: number): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const bar of bars) {
    if (bar.level > level) continue;

    for (const rawSentence of bar.abilitiesText.split('.')) {
      const sentence = rawSentence.trim();
      if (!sentence) continue;

      const match = CLASS_SELF_GRANT_RE.exec(sentence);
      if (!match) continue;

      const ids = parseClassBarKeywordWordList(match[1]);
      if (!ids) continue;

      for (const id of ids) {
        if (!seen.has(id)) {
          seen.add(id);
          result.push(id);
        }
      }
    }
  }

  return result;
}

/**
 * Check whether a class level bar activation is legal (CR 716.2a).
 *
 * A level bar for level N can only be activated when the Class is currently
 * level N-1. Sorcery speed is enforced separately by the store.
 */
export function classLevelActivationLegal(state: GameState, cardId: string, barLevel: number): boolean {
  // CR 716.2d: default level 1. Inlined here to avoid circular import with status.ts.
  const currentLevel = state.cards[cardId]?.classLevel ?? 1;
  return currentLevel === barLevel - 1;
}
