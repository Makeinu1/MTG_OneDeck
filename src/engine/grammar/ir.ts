import { removeReminderAndQuotes } from '../keywordGrammar';
import {
  EFFECT_ATOM_DEFINITIONS,
  classifyAbilityShape,
  detectConstructs,
  detectEffectAtoms,
  type AbilityShape,
  type ConstructId,
  type EffectAtomId,
} from './index';

export type CountSpec =
  | { kind: 'one' }
  | { kind: 'fixed'; value: number }
  | { kind: 'variable-x' }
  | { kind: 'for-each' }
  | { kind: 'unknown' };

export interface EffectClause {
  atom: EffectAtomId;
  ruleRef: string;
  count: CountSpec;
  optional: boolean;
  raw: string;
}

export interface AbilityCost {
  raw: string;
  mana: string | null;
  tap: boolean;
  sacrificesSelf: boolean;
}

export interface TriggerCondition {
  word: 'when' | 'whenever' | 'at';
  raw: string;
}

export type ParseStatus = 'full' | 'partial' | 'none';

export interface AbilityIR {
  shape: AbilityShape;
  cost: AbilityCost | null;
  trigger: TriggerCondition | null;
  effects: EffectClause[];
  constructs: ConstructId[];
  status: ParseStatus;
  blockers: string[];
}

const NUMBER_WORDS = new Map<string, number>([
  ['two', 2],
  ['three', 3],
  ['four', 4],
  ['five', 5],
  ['six', 6],
  ['seven', 7],
  ['eight', 8],
  ['nine', 9],
  ['ten', 10],
]);

const atomRuleRefs = new Map(
  EFFECT_ATOM_DEFINITIONS.map((definition) => [definition.id, definition.ruleRef]),
);

export function parseAbilityIR(line: string, typeLine: string): AbilityIR {
  const shape = classifyAbilityShape(line, typeLine);
  const text = sanitizeLine(line);
  const cost = shape === 'activated' ? parseCost(text) : null;
  const trigger = isTriggeredShape(shape) ? parseTrigger(text) : null;
  const effectSpan = effectSpanForShape(text, shape);
  const clauses = splitEffectClauses(effectSpan);
  const optional = detectConstructs(text).includes('construct.may');
  const effects = clauses.flatMap((clause) => effectClausesForText(clause, optional));
  const constructs = uniqueSorted(detectConstructs(effectSpan));
  const hasUnknownResidual = clauses.some((clause) => hasResidualEffectText(clause));
  const status = parseStatus(effects, constructs, hasUnknownResidual);
  const blockers = blockersForStatus(status, constructs, hasUnknownResidual);

  return {
    shape,
    cost,
    trigger,
    effects,
    constructs,
    status,
    blockers,
  };
}

function parseCost(text: string): AbilityCost {
  const colonIndex = text.indexOf(':');
  const raw = colonIndex < 0 ? '' : text.slice(0, colonIndex).trim();
  const costSymbols = raw.match(/\{[^}]+\}/g) ?? [];
  const mana = costSymbols.filter((symbol) => !/^\{T\}$/i.test(symbol)).join('');

  return {
    raw,
    mana: mana === '' ? null : mana,
    tap: /\{T\}/i.test(raw),
    sacrificesSelf: /^Sacrifice\b.*\b(?:this|it|self)\b/i.test(raw),
  };
}

function parseTrigger(text: string): TriggerCondition | null {
  const match = /^(When|Whenever|At)\b/i.exec(text);
  if (!match) {
    return null;
  }
  const commaIndex = text.indexOf(',');
  const raw = (commaIndex < 0 ? text : text.slice(0, commaIndex)).trim();
  return {
    word: match[1].toLowerCase() as TriggerCondition['word'],
    raw,
  };
}

function effectSpanForShape(text: string, shape: AbilityShape): string {
  if (shape === 'activated') {
    const colonIndex = text.indexOf(':');
    return colonIndex < 0 ? '' : text.slice(colonIndex + 1).trim();
  }
  if (isTriggeredShape(shape)) {
    const commaIndex = text.indexOf(',');
    return commaIndex < 0 ? '' : text.slice(commaIndex + 1).trim();
  }
  return text;
}

function isTriggeredShape(shape: AbilityShape): boolean {
  return shape === 'triggered' || shape === 'delayed-triggered';
}

function splitEffectClauses(effectSpan: string): string[] {
  return effectSpan
    .split(/\.\s+|\b(?:and\s+)?then\b/i)
    .map((clause) => sanitizeLine(clause))
    .filter((clause) => clause !== '');
}

function effectClausesForText(raw: string, optional: boolean): EffectClause[] {
  return detectEffectAtoms(raw).map((atom) => ({
    atom,
    ruleRef: atomRuleRefs.get(atom) ?? 'standard',
    count: countSpec(raw),
    optional,
    raw,
  }));
}

function countSpec(text: string): CountSpec {
  if (/\bfor each\b/i.test(text)) {
    return { kind: 'for-each' };
  }
  if (/\{X\}|\bX\b/.test(text)) {
    return { kind: 'variable-x' };
  }
  const digitMatch = /\b\d+\b/.exec(text);
  if (digitMatch) {
    return { kind: 'fixed', value: Number(digitMatch[0]) };
  }
  const wordMatch = /\b(two|three|four|five|six|seven|eight|nine|ten)\b/i.exec(text);
  if (wordMatch) {
    return { kind: 'fixed', value: NUMBER_WORDS.get(wordMatch[1].toLowerCase()) ?? 0 };
  }
  if (/\b(?:a|an)\b/i.test(text)) {
    return { kind: 'one' };
  }
  return { kind: 'unknown' };
}

function hasResidualEffectText(clause: string): boolean {
  return /[A-Za-z]/.test(clause) && detectEffectAtoms(clause).length === 0;
}

function parseStatus(
  effects: readonly EffectClause[],
  constructs: readonly ConstructId[],
  hasUnknownResidual: boolean,
): ParseStatus {
  if (effects.length === 0) {
    return 'none';
  }
  if (
    !hasUnknownResidual &&
    !constructs.includes('construct.target') &&
    !constructs.includes('construct.choose-modal')
  ) {
    return 'full';
  }
  return 'partial';
}

function blockersForStatus(
  status: ParseStatus,
  constructs: readonly ConstructId[],
  hasUnknownResidual: boolean,
): string[] {
  if (status === 'full') {
    return [];
  }
  const blockers = new Set<string>();
  for (const construct of ['construct.choose-modal', 'construct.target'] as const) {
    if (constructs.includes(construct)) {
      blockers.add(construct);
    }
  }
  if (status === 'none') {
    blockers.add('no-atom');
  } else if (hasUnknownResidual) {
    blockers.add('unknown-atom');
  }
  return [...blockers].sort();
}

function uniqueSorted<Id extends string>(ids: readonly Id[]): Id[] {
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}

function sanitizeLine(source: string): string {
  return removeReminderAndQuotes(source).replace(/\s+/g, ' ').trim();
}
