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
  return parseTriggerLines(line.text).flatMap((trigger) => {
    const families = classifyFamilies(trigger.conditionText, trigger.shape);
    const observers = classifyObservers(trigger.conditionText, trigger.shape, def);
    return families.flatMap((family) =>
      observers.map((observer) => ({
        shape: trigger.shape,
        family,
        observer,
        interveningIf: trigger.interveningIf,
        matchedText: trigger.conditionText,
      })),
    );
  });
}

interface ParsedTriggerLine {
  shape: TriggerShape;
  conditionText: string;
  interveningIf: boolean;
}

function parseTriggerLines(line: string): ParsedTriggerLine[] {
  const text = stripAbilityWordPrefix(normalize(stripReminderAndQuotedText(line)));
  const segments = triggerSegments(text);
  return segments.flatMap((segment) => {
    const trigger = parseTriggerSegment(segment);
    return trigger ? [trigger] : [];
  });
}

function parseTriggerSegment(segment: string): ParsedTriggerLine | undefined {
  const text = stripAbilityWordPrefix(normalize(segment));
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

function triggerSegments(text: string): string[] {
  const starts = triggerStartIndices(text);
  if (starts.length === 0 || starts[0] !== 0) {
    return [];
  }

  return starts.map((start, index) =>
    text.slice(start, starts[index + 1] ?? text.length).trim(),
  );
}

function triggerStartIndices(text: string): number[] {
  const starts: number[] = [];
  const triggerProbe = /\b(?:Whenever|When|At the beginning of)\b/gi;
  for (const match of text.matchAll(triggerProbe)) {
    const index = match.index;
    if (typeof index === 'number' && isTriggerClauseStart(text, index)) {
      starts.push(index);
    }
  }
  return starts;
}

function isTriggerClauseStart(text: string, index: number): boolean {
  if (index === 0) {
    return true;
  }

  const before = text.slice(0, index).trimEnd();
  return /[.!?]$/.test(before);
}

function stripAbilityWordPrefix(text: string): string {
  return normalize(text.replace(/^[A-Z][A-Za-z' -]{0,60}\s+(?:--|[\u2013\u2014])\s+/u, ''));
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
  const manaTap = isManaTapCondition(text);

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
  if (manaTap) {
    families.add('other');
  }
  if (!manaTap && isTapStateChangeCondition(text)) {
    families.add('tap');
  }
  if (isCounterCondition(text)) {
    families.add('counter');
  }
  if (/\bgains?\b[^,.;]*\blife\b|\bloses?\b[^,.;]*\blife\b|\blost\b[^,.;]*\blife\b/i.test(text)) {
    families.add('life');
  }
  if (/\bbecomes?\s+the\s+target\b/i.test(text)) {
    families.add('other');
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

function isManaTapCondition(text: string): boolean {
  return (
    /\b(?:is|are|was|were|becomes?|become)\s+tapped\s+for\s+mana\b/i.test(text) ||
    /\btaps?\b[^,.;]*\bfor\s+mana\b/i.test(text)
  );
}

function isTapStateChangeCondition(text: string): boolean {
  return /\bbecomes?\s+(?:tapped|untapped)\b|\b(?:is|are)\s+(?:tapped|untapped)\b/i.test(
    text,
  );
}

function classifyObservers(
  conditionText: string,
  shape: TriggerShape,
  def: CardDef | undefined,
): ObserverScope[] {
  const body = conditionBody(conditionText, shape);
  const observers = new Set<ObserverScope>();

  if (isOpponentScope(body)) {
    observers.add('opponent');
  }
  if (isControlledSetScope(body)) {
    observers.add('controlled-set');
  }
  if (isSelfScope(body, shape, def)) {
    observers.add('self');
  }
  if (observers.size > 0) {
    return [...observers].sort();
  }
  if (isAnyPlayerScope(body)) {
    return ['any'];
  }
  if (isAnyObjectScope(body)) {
    return ['any'];
  }
  if (shape === 'at' && /\beach\b/i.test(body)) {
    return ['any'];
  }
  if (shape === 'at') {
    return ['self'];
  }
  return ['unknown'];
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
  // Opponent scope is detected wherever an opponent qualifies the triggering event
  // (subject OR scoping possessive: "an opponent's graveyard", "each opponent's upkeep",
  // "deals damage to an opponent"). Anchoring to ^ regressed these (M0-O2 iter2-a audit:
  // Bloodchief Ascension / Sheoldred / Curiosity). The reorder below (subject scopes
  // before any-player) is what fixes "combat damage to a player" → any, not this anchor.
  return (
    /\b(?:an|each|target)\s+opponents?\b/i.test(text) ||
    /\byour opponents?\b/i.test(text) ||
    /\bopponents?\s+controls?\b/i.test(text)
  );
}

function isAnyPlayerScope(text: string): boolean {
  return /^(?:a|each|any|one or more|two or more|three or more)\s+players?\b/i.test(text);
}

function isControlledSetScope(text: string): boolean {
  const controlledNoun = String.raw`(?:[a-z][a-z'+/-]*(?:\s+[a-z][a-z'+/-]*){0,6})`;
  const triggerVerb = String.raw`(?:enters?|dies|die|leaves?|attacks?|blocks?|becomes?|become|deals?|draws?|draw|discards?|discard|sacrifices?|sacrifice|casts?|cast|is|are|was|were)`;
  return (
    /\bcounters?\b[^,.;]*\b(?:is|are|was|were)\s+(?:put|placed)\s+on\b[^,.;]*\byou control\b/i.test(
      text,
    ) ||
    new RegExp(String.raw`\b${controlledNoun}\s+you control\b[^,.;]*\b${triggerVerb}\b`, 'i').test(
      text,
    ) ||
    new RegExp(
      String.raw`\b${controlledNoun}\b[^,.;]*\b${triggerVerb}\b[^,.;]*\bunder your control\b`,
      'i',
    ).test(text) ||
    new RegExp(
      String.raw`\b${controlledNoun}\b[^,.;]*\bunder your control\b[^,.;]*\b${triggerVerb}\b`,
      'i',
    ).test(text)
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
  const names = [
    ...selfNameAliases(def.name, def.typeLine),
    ...def.faces.flatMap((face) => selfNameAliases(face.name, face.typeLine)),
  ];
  return [...new Set(names.filter((name) => name.length > 0))].sort(
    (a, b) => b.length - a.length,
  );
}

function selfNameAliases(name: string, typeLine: string): string[] {
  const base = name.split(' // ')[0].trim();
  const commaShort = base.split(',')[0].trim();
  const aliases = [name, base, commaShort];
  const firstWord = commaShort.match(/^[A-Za-z][A-Za-z'-]*/)?.[0];
  if (/\bLegendary\b/i.test(typeLine) && firstWord && !/^(?:a|an|the)$/i.test(firstWord)) {
    aliases.push(firstWord);
  }
  return aliases;
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
