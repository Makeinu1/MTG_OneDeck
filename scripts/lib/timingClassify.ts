import { splitAbilityLines, type AbilityLine } from '../../src/engine/grammar/index.ts';
import { removeReminderAndQuotes } from '../../src/engine/keywordGrammar.ts';
import type { CardDef } from '../../src/types/card';
import type { ObserverScope } from './eventClassify.ts';

export type TimingStep =
  | 'untap'
  | 'upkeep'
  | 'draw'
  | 'main-precombat'
  | 'main-postcombat'
  | 'begin-combat'
  | 'declare-attackers'
  | 'declare-blockers'
  | 'end-combat'
  | 'end-step'
  | 'cleanup'
  | 'turn'
  | 'other';

export type CastTiming =
  | 'sorcery-speed'
  | 'flash'
  | 'combat-only'
  | 'your-turn-only'
  | 'once-per-turn'
  | 'none';

export interface CardTimingSummary {
  junctures: TimingStep[];
  junctureScope: ObserverScope[];
  castTiming: CastTiming[];
}

export const TIMING_STEPS: readonly TimingStep[] = [
  'begin-combat',
  'cleanup',
  'declare-attackers',
  'declare-blockers',
  'draw',
  'end-combat',
  'end-step',
  'main-precombat',
  'main-postcombat',
  'other',
  'turn',
  'untap',
  'upkeep',
];

export const CAST_TIMINGS: readonly CastTiming[] = [
  'combat-only',
  'flash',
  'none',
  'once-per-turn',
  'sorcery-speed',
  'your-turn-only',
];

export function classifyCardTiming(def: CardDef): CardTimingSummary {
  const junctures = new Set<TimingStep>();
  const junctureScope = new Set<ObserverScope>();
  const castTiming = new Set<CastTiming>();

  for (const line of splitAbilityLines(def)) {
    const summary = classifyTimingForLine(line);
    addAll(junctures, summary.junctures);
    addAll(junctureScope, summary.junctureScope);
    addAll(castTiming, summary.castTiming.filter((timing) => timing !== 'none'));
  }

  return {
    junctures: sortTimingSteps(junctures),
    junctureScope: sortStrings(junctureScope),
    castTiming: castTiming.size > 0 ? sortStrings(castTiming) : ['none'],
  };
}

export function classifyTimingForLine(line: AbilityLine): CardTimingSummary {
  const text = normalize(removeReminderAndQuotes(line.text));
  const junctures = new Set<TimingStep>();
  const junctureScope = new Set<ObserverScope>();

  for (const phrase of findJuncturePhrases(text)) {
    addAll(junctures, classifyJuncturePhrase(phrase));
    junctureScope.add(classifyJunctureScope(phrase));
  }

  const castTiming = detectCastTiming(text, line.shape === 'activated');

  return {
    junctures: sortTimingSteps(junctures),
    junctureScope: sortStrings(junctureScope),
    castTiming: castTiming.length > 0 ? castTiming : ['none'],
  };
}

function findJuncturePhrases(text: string): string[] {
  const phrases: string[] = [];
  // 行頭・文末区切りに加え、能力語接頭辞のem-dash後("Survival — At the beginning of …" 等)も拾う
  // (CR 603: 能力語は誘発本体に意味を与えない接頭辞。これを落とすと 125枚規模の juncture FN になる)。
  const beginningPattern = /(?:^|[.!?]\s+|—\s+)at the beginning of\s+([^,.;!?]+)/gi;
  const duringStepPattern =
    /\bduring\s+([^,.;!?]*?(?:untap step|upkeep|draw step|first main phase|second main phase|precombat main phase|postcombat main phase|each of (?:your |their )?main phases|combat on your turn|beginning of combat|declare attackers step|declare blockers step|end of combat step|end step|cleanup step))\b/gi;

  for (const match of text.matchAll(beginningPattern)) {
    const phrase = match[1]?.trim();
    if (phrase) {
      phrases.push(phrase);
    }
  }
  for (const match of text.matchAll(duringStepPattern)) {
    const phrase = match[1]?.trim();
    if (!phrase) {
      continue;
    }
    const sentence = sentenceContaining(text, match.index ?? 0);
    if (isExcludedDuringJuncture(sentence, phrase)) {
      continue;
    }
    phrases.push(phrase);
  }

  return phrases;
}

function classifyJuncturePhrase(phrase: string): TimingStep[] {
  if (/\buntap step\b/i.test(phrase)) {
    return ['untap'];
  }
  if (/\bupkeep\b/i.test(phrase)) {
    return ['upkeep'];
  }
  if (/\bdraw step\b/i.test(phrase)) {
    return ['draw'];
  }
  if (/\beach of (?:your |their )?main phases?\b/i.test(phrase)) {
    return ['main-precombat', 'main-postcombat'];
  }
  if (/\b(?:first|precombat) main phases?\b/i.test(phrase)) {
    return ['main-precombat'];
  }
  if (/\b(?:second|postcombat) main phases?\b/i.test(phrase)) {
    return ['main-postcombat'];
  }
  if (
    /\bbeginning of combat\b|\bcombat on your turn\b|^(?:each|the|that)\s+combat\b/i.test(
      phrase,
    )
  ) {
    return ['begin-combat'];
  }
  if (/\bdeclare attackers step\b/i.test(phrase)) {
    return ['declare-attackers'];
  }
  if (/\bdeclare blockers step\b/i.test(phrase)) {
    return ['declare-blockers'];
  }
  if (/\bend of combat step\b/i.test(phrase)) {
    return ['end-combat'];
  }
  if (/\bend step\b/i.test(phrase)) {
    return ['end-step'];
  }
  if (/\bcleanup step\b/i.test(phrase)) {
    return ['cleanup'];
  }
  if (/\b(?:your|each) turn\b/i.test(phrase)) {
    return ['turn'];
  }
  return ['other'];
}

function classifyJunctureScope(phrase: string): ObserverScope {
  if (/\byour\b/i.test(phrase) || /\bcombat on your turn\b/i.test(phrase)) {
    return 'self';
  }
  if (
    /\beach opponent(?:['’]s)?\b/i.test(phrase) ||
    /\beach other player(?:['’]s)?\b/i.test(phrase)
  ) {
    return 'opponent';
  }
  if (
    /\beach player(?:['’]s)?\b/i.test(phrase) ||
    /^each\s+combat\b/i.test(phrase) ||
    /^each\s+(?:untap step|upkeep|draw step|precombat main phase|postcombat main phase|beginning of combat|declare attackers step|declare blockers step|end of combat step|end step|cleanup step|turn)\b/i.test(
      phrase,
    )
  ) {
    return 'any';
  }
  return 'unknown';
}

function detectCastTiming(text: string, isActivatedLine: boolean): CastTiming[] {
  const values = new Set<CastTiming>();

  if (
    /^flash$/i.test(text) ||
    /\bas though (?:it|they) had flash\b/i.test(text) ||
    /\bany time you could cast an instant\b/i.test(text)
  ) {
    values.add('flash');
  }
  if (
    /\bonly as a sorcery\b/i.test(text) ||
    /\bany time you could cast a sorcery\b/i.test(text) ||
    /\bonly during your main phase\b/i.test(text)
  ) {
    values.add('sorcery-speed');
  }
  if (/\bonly during combat\b/i.test(text)) {
    values.add('combat-only');
  }
  if (/\bduring combat on your turn\b/i.test(text)) {
    values.add('combat-only');
    values.add('your-turn-only');
  } else if (/\bonly during your turn\b/i.test(text)) {
    values.add('your-turn-only');
  }
  if (
    /\bonce each turn\b/i.test(text) &&
    (isActivatedLine || /\bactivat(?:e|ed|ing|ion)\b/i.test(text))
  ) {
    values.add('once-per-turn');
  }

  return sortStrings(values);
}

function sentenceContaining(text: string, index: number): string {
  const before = text.slice(0, index);
  const sentenceStart = Math.max(before.lastIndexOf('.'), before.lastIndexOf('!'), before.lastIndexOf('?')) + 1;
  const after = text.slice(index);
  const boundaryOffsets = [after.indexOf('.'), after.indexOf('!'), after.indexOf('?')].filter(
    (offset) => offset >= 0,
  );
  const sentenceEnd =
    boundaryOffsets.length > 0 ? index + Math.min(...boundaryOffsets) : text.length;
  return text.slice(sentenceStart, sentenceEnd).trim();
}

function isExcludedDuringJuncture(sentence: string, phrase: string): boolean {
  if (/\b(?:cast|activate)\b[^.!?]*\bonly during\b/i.test(sentence)) {
    return true;
  }
  if (/\bwhen\b[^.!?]*\benters\b[^.!?]*\bduring\b/i.test(sentence)) {
    return true;
  }
  return (
    /\buntap step\b/i.test(phrase) &&
    /\b(?:doesn['’]t|does not|don['’]t|do not|won['’]t|can['’]t|cannot)\b[^.!?]*\buntap\b/i.test(
      sentence,
    )
  );
}

function addAll<T>(target: Set<T>, values: readonly T[]): void {
  for (const value of values) {
    target.add(value);
  }
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function sortStrings<T extends string>(values: Iterable<T>): T[] {
  return [...values].sort(compareStrings);
}

function sortTimingSteps(values: Iterable<TimingStep>): TimingStep[] {
  return [...values].sort(
    (a, b) => TIMING_STEPS.indexOf(a) - TIMING_STEPS.indexOf(b),
  );
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
