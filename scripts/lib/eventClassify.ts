import { splitAbilityLines, type AbilityLine } from '../../src/engine/grammar/index.ts';
import type { CardDef } from '../../src/types/card';

export type TriggerShape = 'at' | 'when' | 'whenever';

export type EventFamily =
  | 'enters'
  | 'leaves'
  | 'dies'
  | 'zone'
  | 'cast'
  | 'attacks'
  | 'blocks'
  | 'damage'
  | 'draw'
  | 'discard'
  | 'sacrifice'
  | 'tap'
  | 'counter'
  | 'life'
  | 'phase'
  | 'other';

export type ObserverScope = 'any' | 'controlled-set' | 'opponent' | 'self' | 'unknown';

export interface EventTag {
  shape: TriggerShape;
  family: EventFamily;
  observer: ObserverScope;
  interveningIf: boolean;
  matchedText: string;
}

export interface CardEventSummary {
  families: EventFamily[];
  observers: ObserverScope[];
  triggerShapes: TriggerShape[];
  hasInterveningIf: boolean;
}

export const EVENT_FAMILIES: readonly EventFamily[] = [
  'enters',
  'leaves',
  'dies',
  'zone',
  'cast',
  'attacks',
  'blocks',
  'damage',
  'draw',
  'discard',
  'sacrifice',
  'tap',
  'counter',
  'life',
  'phase',
  'other',
];

export function classifyCardEvents(def: CardDef): CardEventSummary {
  const families = new Set<EventFamily>();
  const observers = new Set<ObserverScope>();
  const triggerShapes = new Set<TriggerShape>();
  let hasInterveningIf = false;

  for (const line of splitAbilityLines(def)) {
    for (const tag of classifyEventsForLine(line, def)) {
      families.add(tag.family);
      observers.add(tag.observer);
      triggerShapes.add(tag.shape);
      hasInterveningIf ||= tag.interveningIf;
    }
  }

  return {
    families: [...families].sort(),
    observers: [...observers].sort(),
    triggerShapes: [...triggerShapes].sort(),
    hasInterveningIf,
  };
}

export function classifyEventsForLine(line: AbilityLine, def?: CardDef): EventTag[] {
  const trigger = parseTriggerLine(line.text);
  if (!trigger) {
    return [];
  }

  const families = classifyFamilies(trigger.conditionText, trigger.shape);
  const observer = classifyObserver(trigger.conditionText, trigger.shape, def);
  return families.map((family) => ({
    shape: trigger.shape,
    family,
    observer,
    interveningIf: trigger.interveningIf,
    matchedText: trigger.conditionText,
  }));
}

interface ParsedTriggerLine {
  shape: TriggerShape;
  conditionText: string;
  interveningIf: boolean;
}

function parseTriggerLine(line: string): ParsedTriggerLine | undefined {
  const text = normalize(stripReminderAndQuotedText(line));
  const shape = triggerShape(text);
  if (!shape) {
    return undefined;
  }

  const conditionEnd = firstConditionCommaIndex(text);
  const conditionText = normalize(text.slice(0, conditionEnd < 0 ? text.length : conditionEnd));
  if (conditionText === '') {
    return undefined;
  }

  return {
    shape,
    conditionText,
    interveningIf: conditionEnd >= 0 && startsWithInterveningIf(text.slice(conditionEnd + 1)),
  };
}

function triggerShape(text: string): TriggerShape | undefined {
  if (/^Whenever\b/i.test(text)) {
    return 'whenever';
  }
  if (/^When\b/i.test(text)) {
    return 'when';
  }
  if (/^At the beginning of\b/i.test(text)) {
    return 'at';
  }
  return undefined;
}

function firstConditionCommaIndex(text: string): number {
  const firstComma = text.indexOf(',');
  if (firstComma < 0) {
    return -1;
  }

  return castEnumeratedSpellConditionCommaIndex(text, firstComma) ?? firstComma;
}

function castEnumeratedSpellConditionCommaIndex(
  text: string,
  firstComma: number,
): number | undefined {
  const castMatch = /\bcasts?\b/i.exec(text);
  if (!castMatch || firstComma <= castMatch.index) {
    return undefined;
  }

  const afterCast = text.slice(castMatch.index);
  const spellMatch = /\bspells?\b/i.exec(afterCast);
  if (!spellMatch) {
    return undefined;
  }

  const spellStart = castMatch.index + spellMatch.index;
  if (spellStart <= firstComma) {
    return undefined;
  }

  const spellEnd = spellStart + spellMatch[0].length;
  const conditionComma = text.indexOf(',', spellEnd);
  return conditionComma >= 0 ? conditionComma : undefined;
}

function startsWithInterveningIf(afterTriggerCondition: string): boolean {
  const rest = afterTriggerCondition.trim();
  if (!/^if\b/i.test(rest)) {
    return false;
  }

  const firstSentenceEnd = rest.search(/[.!?]/);
  const firstSentence =
    firstSentenceEnd < 0 ? rest : rest.slice(0, Math.max(0, firstSentenceEnd));
  return firstSentence.includes(',');
}

function classifyFamilies(conditionText: string, shape: TriggerShape): EventFamily[] {
  if (shape === 'at') {
    return ['phase'];
  }

  const text = conditionBody(conditionText, shape);
  const families = new Set<EventFamily>();
  const dies = isDiesCondition(text);
  const enters = /\benters?\b(?:\s+the battlefield)?\b/i.test(text);
  const leaves = /\bleaves?\s+the battlefield\b/i.test(text);
  const cast = isCastCondition(text);
  const zoneText = cast ? stripCastSourceZoneModifiers(text) : text;

  if (enters) {
    families.add('enters');
  }
  if (dies) {
    families.add('dies');
  }
  if (leaves) {
    families.add('leaves');
  }
  if (!dies && !enters && !leaves && isZoneCondition(zoneText)) {
    families.add('zone');
  }
  if (cast) {
    families.add('cast');
  }
  if (/\battacks?\b/i.test(text)) {
    families.add('attacks');
  }
  if (/\bblocks?\b|\bbecomes?\s+blocked\b|\bis\s+blocked\b|\bare\s+blocked\b/i.test(text)) {
    families.add('blocks');
  }
  if (/\bdeals?\b[^,.;]*\bdamage\b|\bdealt\b[^,.;]*\bdamage\b/i.test(text)) {
    families.add('damage');
  }
  if (/\bdraws?\b[^,.;]*\bcards?\b/i.test(text)) {
    families.add('draw');
  }
  if (/\bdiscards?\b/i.test(text)) {
    families.add('discard');
  }
  if (/\bsacrifices?\b|\bis\s+sacrificed\b|\bare\s+sacrificed\b/i.test(text)) {
    families.add('sacrifice');
  }
  if (/\bbecomes?\s+(?:tapped|untapped)\b|\b(?:is|are)\s+(?:tapped|untapped)\b/i.test(text)) {
    families.add('tap');
  }
  if (isCounterCondition(text)) {
    families.add('counter');
  }
  if (/\bgains?\b[^,.;]*\blife\b|\bloses?\b[^,.;]*\blife\b|\blost\b[^,.;]*\blife\b/i.test(text)) {
    families.add('life');
  }

  const sortedFamilies = [...families].sort();
  return sortedFamilies.length > 0 ? sortedFamilies : ['other'];
}

function isDiesCondition(text: string): boolean {
  return (
    /\bdies\b/i.test(text) ||
    /\b(?:creatures?|tokens?)\b[^,.;]*\bdie\b/i.test(text) ||
    /\bthey\s+die\b/i.test(text) ||
    /\bput\s+into\s+(?:a|an|the|your|their|its owner's|an opponent's)?\s*graveyard\s+from\s+the battlefield\b/i.test(
      text,
    )
  );
}

function isCastCondition(text: string): boolean {
  return /\bcasts?\b[^.;]*\bspells?\b/i.test(text);
}

function isZoneCondition(text: string): boolean {
  return (
    /\b(?:is|are|was|were|becomes?|become)\s+exiled\b|\bexiles?\b/i.test(text) ||
    /\breturns?\b[^,.;]*\b(?:hand|graveyard|library|command zone)\b/i.test(text) ||
    /\bput\s+into\s+(?:a|an|the|your|their|its owner's|an opponent's)?\s*graveyard\b/i.test(
      text,
    ) ||
    /\bmills?\b[^,.;]*\bcards?\b/i.test(text) ||
    /\bleaves?\s+(?:your|a|an|the|that player's|an opponent's)?\s*(?:graveyard|library|hand|exile)\b/i.test(
      text,
    )
  );
}

function stripCastSourceZoneModifiers(text: string): string {
  return normalize(
    text.replace(
      /\bfrom\s+(?:(?:a|an|the|your|their|its owner's|an opponent's)\s+)?(?:exile|graveyard|hand|library|command zone)\b/gi,
      ' ',
    ),
  );
}

function isCounterCondition(text: string): boolean {
  return (
    /\bcounters?\b[^,.;]*\b(?:is|are|was|were)\s+put\s+on\b/i.test(text) ||
    /\bcounters?\b[^,.;]*\b(?:is|are|was|were)\s+placed\s+on\b/i.test(text) ||
    /\bcounters?\b[^,.;]*\bplaced\s+on\b/i.test(text) ||
    /\b(?:put|puts|place|places)\b[^,.;]*\bcounters?\b[^,.;]*\bon\b/i.test(text)
  );
}

function classifyObserver(
  conditionText: string,
  shape: TriggerShape,
  def: CardDef | undefined,
): ObserverScope {
  const body = conditionBody(conditionText, shape);

  if (isOpponentScope(body)) {
    return 'opponent';
  }
  if (isAnyPlayerScope(body)) {
    return 'any';
  }
  if (isControlledSetScope(body)) {
    return 'controlled-set';
  }
  if (isSelfScope(body, shape, def)) {
    return 'self';
  }
  if (isAnyObjectScope(body)) {
    return 'any';
  }
  if (shape === 'at' && /\beach\b/i.test(body)) {
    return 'any';
  }
  if (shape === 'at') {
    return 'self';
  }
  return 'unknown';
}

function conditionBody(conditionText: string, shape: TriggerShape): string {
  switch (shape) {
    case 'whenever':
      return normalize(conditionText.replace(/^Whenever\s+/i, ''));
    case 'when':
      return normalize(conditionText.replace(/^When\s+/i, ''));
    case 'at':
      return normalize(conditionText.replace(/^At\s+/i, ''));
  }
}

function isOpponentScope(text: string): boolean {
  return (
    /\b(?:an|each|target)\s+opponents?\b/i.test(text) ||
    /\byour opponents?\b/i.test(text) ||
    /\bopponents?\s+controls?\b/i.test(text)
  );
}

function isAnyPlayerScope(text: string): boolean {
  return /\b(?:a|each|any)\s+players?\b/i.test(text);
}

function isControlledSetScope(text: string): boolean {
  return (
    /\b(?:creatures?|artifacts?|enchantments?|lands?|permanents?|tokens?|cards?|spells?)\s+you control\b[^,.;]*\b(?:enters?|dies|leaves?|attacks?|blocks?|becomes?|deals?|is|are)\b/i.test(
      text,
    ) ||
    /\b(?:creatures?|artifacts?|enchantments?|lands?|permanents?|tokens?|cards?|spells?)\b[^,.;]*\bunder your control\b[^,.;]*\b(?:enters?|dies|leaves?|attacks?|blocks?|becomes?|deals?|is|are)\b/i.test(
      text,
    )
  );
}

function isSelfScope(text: string, shape: TriggerShape, def: CardDef | undefined): boolean {
  if (shape === 'at' && /\byour\b/i.test(text)) {
    return true;
  }
  if (/^(?:you|your)\b/i.test(text) || /^this\b/i.test(text)) {
    return true;
  }
  if (isSelfCounterTargetScope(text, def)) {
    return true;
  }

  return selfNames(def).some((name) =>
    new RegExp(String.raw`^${escapeRegExp(name)}(?:'s)?\b`, 'i').test(text),
  );
}

function isSelfCounterTargetScope(text: string, def: CardDef | undefined): boolean {
  if (/\bcounters?\b[^,.;]*\b(?:is|are|was|were)\s+(?:put|placed)\s+on\s+this\b/i.test(text)) {
    return true;
  }

  return selfNames(def).some((name) =>
    new RegExp(
      String.raw`\bcounters?\b[^,.;]*\b(?:is|are|was|were)\s+(?:put|placed)\s+on\s+${escapeRegExp(name)}(?:'s)?\b`,
      'i',
    ).test(text),
  );
}

function isAnyObjectScope(text: string): boolean {
  return /^(?:a|an|another|each|one or more|two or more|three or more)\b/i.test(text);
}

function selfNames(def: CardDef | undefined): string[] {
  if (!def) {
    return [];
  }
  const names = [def.name, def.name.split(' // ')[0], ...def.faces.map((face) => face.name)];
  return [...new Set(names.filter((name) => name.length > 0))].sort(
    (a, b) => b.length - a.length,
  );
}

function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function stripReminderAndQuotedText(text: string): string {
  let output = '';
  let parenthesisDepth = 0;
  let inStraightQuote = false;
  let inCurlyQuote = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inStraightQuote) {
      if (char === '"') {
        inStraightQuote = false;
      }
      continue;
    }

    if (inCurlyQuote) {
      if (char === '\u201d') {
        inCurlyQuote = false;
      }
      continue;
    }

    if (parenthesisDepth > 0) {
      if (char === '(') {
        parenthesisDepth += 1;
      } else if (char === ')') {
        parenthesisDepth -= 1;
      }
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
    output += char;
  }

  return normalize(output);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
