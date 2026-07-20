import type { CardDef } from '../types/card';
import { stripAbilityWordLabel } from './grammar/abilityText';

export type TriggerWord = 'when' | 'whenever' | 'at';

export interface ParsedTriggerConditionLine {
  word: TriggerWord;
  /** Trigger wordを除いたevent/timing条件。効果文は含まない。 */
  condition: string;
  /** 最初の条件境界commaより後ろの効果。 */
  effect: string;
}

const NAME_COMMA = '\u0000';
const NAME_PERIOD = '\u0001';
const NAME_SEMICOLON = '\u0002';

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function selfNames(def: CardDef | undefined): string[] {
  if (!def) return [];
  const names = new Set<string>();
  for (const raw of [def.name, ...def.faces.map((face) => face.name)]) {
    for (const name of raw.split(' // ')) {
      const trimmed = name.trim();
      if (trimmed !== '') names.add(trimmed);
    }
  }
  return [...names];
}

function maskSelfNamePunctuation(text: string, def: CardDef | undefined): string {
  let masked = text;
  for (const name of selfNames(def).filter((candidate) => /[,.;]/.test(candidate))) {
    masked = masked.replace(
      new RegExp(escapeRegExp(name), 'gi'),
      name
        .replaceAll(',', NAME_COMMA)
        .replaceAll('.', NAME_PERIOD)
        .replaceAll(';', NAME_SEMICOLON),
    );
  }
  return masked;
}

function unmaskSelfNamePunctuation(text: string): string {
  return text
    .replaceAll(NAME_COMMA, ',')
    .replaceAll(NAME_PERIOD, '.')
    .replaceAll(NAME_SEMICOLON, ';');
}

function stripLeadingTriggerLabel(raw: string): string {
  const withoutBullet = raw.trim().replace(/^\u2022\s*/u, '');
  const abilityWordStripped = stripAbilityWordLabel(withoutBullet).trim();
  if (/^(?:When|Whenever|At)\b/i.test(abilityWordStripped)) {
    return abilityWordStripped;
  }

  // Scryfall also uses structural labels that are not plain alphabetic ability
  // words: modal bullets ("Mirran —"), values ("Descend 8 —"), and sticker
  // ticket prefixes ("{TK}{TK} —"). Strip exactly one such label, and only
  // when the remainder itself starts with a trigger word. This keeps effect-body
  // and reflexive/delayed "When" clauses fail-closed.
  const labelledTrigger = /^(?:[^.!?\n]{1,80}?)(?:\s+(?:--|[\u2013\u2014])\s+)((?:When|Whenever|At)\b[\s\S]*)$/i.exec(
    withoutBullet,
  );
  return labelledTrigger?.[1]?.trim() ?? withoutBullet;
}

function castEnumeratedSpellConditionCommaIndex(
  text: string,
  firstComma: number,
): number | undefined {
  const castMatch = /\bcasts?\b/i.exec(text);
  if (!castMatch || firstComma <= castMatch.index) return undefined;
  const afterCast = text.slice(castMatch.index);
  const spellMatch = /\bspells?\b/i.exec(afterCast);
  if (!spellMatch) return undefined;
  const spellStart = castMatch.index + spellMatch.index;
  if (spellStart <= firstComma) return undefined;
  const conditionComma = text.indexOf(',', spellStart + spellMatch[0].length);
  return conditionComma >= 0 ? conditionComma : undefined;
}

function isEnumeratedConditionContinuation(text: string): boolean {
  const startsWithOr = /^or\s+/i.test(text);
  const continuation = text.replace(/^or\s+/i, '');
  if (
    /^(?:attacks|blocks|casts|draws|discards|sacrifices|deals|leaves|enters|dies|becomes)\b/i.test(
      continuation,
    )
  ) {
    return true;
  }
  return (
    startsWithOr
    && /^(?:a|an|another|each|one or more|two or more|three or more)\b/i.test(continuation)
    && /\b(?:dies|die|enters?|leaves?|attacks?|blocks?|casts?|draws?|discards?|sacrifices?|deals?|is\s+put|are\s+put|is\s+exiled|are\s+exiled)\b/i.test(
      continuation,
    )
  );
}

function firstConditionCommaIndex(text: string): number {
  const firstComma = text.indexOf(',');
  if (firstComma < 0) return -1;

  const castEnumerationEnd = castEnumeratedSpellConditionCommaIndex(text, firstComma);
  if (castEnumerationEnd !== undefined) return castEnumerationEnd;

  let conditionEnd = firstComma;
  while (conditionEnd >= 0) {
    const nextComma = text.indexOf(',', conditionEnd + 1);
    if (nextComma < 0) return conditionEnd;
    const continuation = normalizeWhitespace(text.slice(conditionEnd + 1, nextComma));
    if (!isEnumeratedConditionContinuation(continuation)) return conditionEnd;
    conditionEnd = nextComma;
  }
  return firstComma;
}

/**
 * CR 603.1/603.2: an event subscription is the leading trigger condition,
 * never verbs found later in its effect. `At` is returned for phase/step
 * callers, but event collectors must accept only `when`/`whenever`.
 */
export function parseTriggerConditionLine(
  raw: string,
  def?: CardDef,
): ParsedTriggerConditionLine | null {
  const stripped = stripLeadingTriggerLabel(raw);
  const protectedLine = maskSelfNamePunctuation(stripped, def);
  const leading = /^(When|Whenever|At)\b/i.exec(protectedLine);
  if (!leading) return null;

  const body = protectedLine.slice(leading[0].length).trimStart();
  const commaIndex = firstConditionCommaIndex(body);
  const condition = normalizeWhitespace(unmaskSelfNamePunctuation(
    commaIndex < 0 ? body : body.slice(0, commaIndex),
  ));
  if (condition === '') return null;
  const effect = normalizeWhitespace(unmaskSelfNamePunctuation(
    commaIndex < 0 ? '' : body.slice(commaIndex + 1),
  ));
  return {
    word: leading[1].toLowerCase() as TriggerWord,
    condition,
    effect,
  };
}

function standaloneTriggerSentenceStarts(text: string): number[] {
  const starts: number[] = [];
  let parenthesisDepth = 0;
  let inStraightQuote = false;
  let inCurlyQuote = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inStraightQuote) {
      if (char === '"') inStraightQuote = false;
      continue;
    }
    if (inCurlyQuote) {
      if (char === '\u201d') inCurlyQuote = false;
      continue;
    }
    if (parenthesisDepth > 0) {
      if (char === '(') parenthesisDepth += 1;
      if (char === ')') parenthesisDepth -= 1;
      continue;
    }
    if (char === '(') {
      parenthesisDepth = 1;
      continue;
    }
    if (char === '"') {
      inStraightQuote = true;
      continue;
    }
    if (char === '\u201c') {
      inCurlyQuote = true;
      continue;
    }
    if (!/^(?:When|Whenever)\b/i.test(text.slice(index))) continue;
    if (!/[.!?]\s*$/.test(text.slice(0, index))) continue;
    starts.push(index);
  }
  return starts;
}

function startsWithSourceReference(condition: string, def: CardDef | undefined): boolean {
  if (/^this\b/i.test(condition)) return true;
  return selfNames(def).some((name) =>
    new RegExp(`^${escapeRegExp(name)}(?:'s)?\\b`, 'i').test(condition),
  );
}

/**
 * Most oracle paragraphs contain one ability and therefore one leading trigger.
 * A small Scryfall compatibility cluster (notably Animate Dead) coalesces two
 * independent source-bound triggered abilities onto one physical line. Preserve
 * that second ability only when the line itself already starts as a When/Whenever
 * ability and the later sentence also names this source. Activated/static effect
 * bodies, reflexive "When you do", quoted grants, and temporal delayed triggers
 * remain excluded from the standing event-subscription path.
 */
export function parseTriggerConditionLines(
  raw: string,
  def?: CardDef,
): ParsedTriggerConditionLine[] {
  const leading = parseTriggerConditionLine(raw, def);
  if (!leading) return [];

  const parsed = [leading];
  if (leading.word === 'at') return parsed;

  for (const start of standaloneTriggerSentenceStarts(raw)) {
    const candidate = parseTriggerConditionLine(raw.slice(start), def);
    if (
      !candidate
      || candidate.word === 'at'
      || !startsWithSourceReference(candidate.condition, def)
      || /\b(?:this turn|next)\b/i.test(candidate.condition)
    ) {
      continue;
    }
    parsed.push(candidate);
  }
  return parsed;
}
