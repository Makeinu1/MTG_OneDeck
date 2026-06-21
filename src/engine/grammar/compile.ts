import type { CardDef, ManaColor } from '../../types/card';
import type { GameCommand } from '../commands';
import type { AbilityIR, CountSpec, EffectClause } from './ir';
import type { EffectAtomId } from './index';

export interface CompileContext {
  sourceId: string;
  def: CardDef;
}

export type AutoDecision = 'auto' | 'guided' | 'manual';
export type RiskLevel = 'low' | 'medium' | 'high';
export type PromptKind = 'target' | 'scry-surveil' | 'modal';

export interface TargetFilter {
  types?: string[];
  controller?: 'any' | 'you' | 'opponent';
}

export interface ModalOption {
  index: number;
  raw: string;
}

export interface EffectPrompt {
  atom: EffectAtomId | null;
  kind: PromptKind;
  count: number;
  minCount?: number;
  filter?: TargetFilter;
  options?: ModalOption[];
  raw: string;
}

export type GuidedAnswer =
  | { kind: 'target'; cardIds: string[] }
  | { kind: 'scry-surveil'; topOrder: string[]; toBottom: string[]; toGraveyard: string[] }
  | { kind: 'modal'; chosen: number[] };

export interface CompiledEffect {
  commands: GameCommand[];
  decision: AutoDecision;
  prompts: EffectPrompt[];
  confidence: number;
  risk: RiskLevel;
  reasons: string[];
}

type ManualReason =
  | 'ambiguous-mana'
  | 'needs-choice'
  | 'needs-parse'
  | 'needs-target'
  | 'no-command'
  | 'no-effect'
  | 'optional'
  | 'variable-count';

const COUNT_DRIVEN_AUTO_ATOMS = new Set([
  'effect.draw',
  'effect.gain-life',
  'effect.lose-life',
  'effect.mill',
  'effect.poison',
  'effect.energy',
  'effect.experience',
  'effect.treasure',
]);

const TARGET_REQUIRED_ATOMS = new Set([
  'effect.attach',
  'effect.copy',
  'effect.counter-plus',
  'effect.counter-spell',
  'effect.damage',
  'effect.destroy',
  'effect.exile',
  'effect.gain-control',
  'effect.grant-keyword',
  'effect.pump',
  'effect.put-onto-battlefield',
  'effect.restriction',
  'effect.return',
  'effect.sacrifice',
  'effect.tap',
  'effect.transform',
  'effect.untap',
]);

const CHOICE_REQUIRED_ATOMS = new Set([
  'effect.discard',
  'effect.reveal',
  'effect.scry',
  'effect.search',
  'effect.surveil',
]);

const MANA_COLORS: readonly ManaColor[] = ['W', 'U', 'B', 'R', 'G', 'C'];
const GUIDED_TARGET_ATOMS = new Set([
  'effect.counter-plus',
  'effect.destroy',
  'effect.exile',
  'effect.return',
  'effect.sacrifice',
  'effect.tap',
  'effect.untap',
]);
const GUIDED_CHOICE_ATOMS = new Set(['effect.scry', 'effect.surveil']);
const TARGET_TYPES = [
  'creature',
  'artifact',
  'enchantment',
  'land',
  'planeswalker',
  'permanent',
];

export function compileAbilityIR(ir: AbilityIR, _ctx: CompileContext): CompiledEffect {
  void _ctx;
  const commands: GameCommand[] = [];
  const prompts: EffectPrompt[] = [];
  const reasons = new Set<ManualReason>();

  if (ir.modal) {
    return {
      commands: [],
      decision: 'guided',
      prompts: [
        {
          atom: null,
          kind: 'modal',
          count: ir.modal.max,
          minCount: ir.modal.min,
          options: ir.modal.options.map((option) => ({ ...option })),
          raw: ir.modal.options.map((option) => `• ${option.raw}`).join(' '),
        },
      ],
      confidence: 0.75,
      risk: 'medium',
      reasons: [],
    };
  }

  if (ir.effects.length === 0) {
    reasons.add('no-effect');
  }
  if (ir.constructs.includes('construct.choose-modal')) {
    reasons.add('needs-choice');
  }
  for (const construct of ir.constructs) {
    if (construct === 'construct.target' || construct === 'construct.choose-modal') {
      continue;
    }
    const reason = reasonForManualConstruct(construct);
    if (reason) {
      reasons.add(reason);
    }
  }

  const treasureRaws = new Set(
    ir.effects
      .filter((effect) => effect.atom === 'effect.treasure')
      .map((effect) => effect.raw),
  );

  for (const effect of ir.effects) {
    const compiled = compileEffect(effect, treasureRaws.has(effect.raw));
    commands.push(...compiled.commands);
    prompts.push(...compiled.prompts);
    for (const reason of compiled.reasons) {
      reasons.add(reason);
    }
  }

  const sortedReasons = [...reasons].sort((a, b) => a.localeCompare(b));
  const decision: AutoDecision =
    sortedReasons.length > 0 ? 'manual' : prompts.length > 0 ? 'guided' : 'auto';

  return {
    commands,
    decision,
    prompts: decision === 'guided' ? prompts : [],
    confidence: decision === 'auto' ? 0.95 : decision === 'guided' ? 0.75 : 0.5,
    risk: decision === 'auto' ? 'low' : 'medium',
    reasons: sortedReasons,
  };
}

function reasonForManualConstruct(construct: string): ManualReason | null {
  switch (construct) {
    case 'construct.each-player':
    case 'construct.intervening-if':
    case 'construct.you-control':
      return 'needs-parse';
    case 'construct.for-each':
    case 'construct.variable-x':
      return 'variable-count';
    case 'construct.may':
      return 'optional';
    default:
      return null;
  }
}

function compileEffect(
  effect: EffectClause,
  clauseHasTreasure: boolean,
): { commands: GameCommand[]; prompts: EffectPrompt[]; reasons: ManualReason[] } {
  const commands: GameCommand[] = [];
  const prompts: EffectPrompt[] = [];
  const reasons = new Set<ManualReason>();

  if (effect.optional) {
    reasons.add('optional');
  }

  if (COUNT_DRIVEN_AUTO_ATOMS.has(effect.atom)) {
    const count = resolveCount(effect.count);
    if (count === null) {
      reasons.add('variable-count');
    } else if (!hasSupportedPlayerSubject(effect)) {
      reasons.add('needs-parse');
    } else {
      const command = countDrivenCommand(effect.atom, count);
      if (command) {
        commands.push(command);
      }
    }
    return { commands, prompts, reasons: [...reasons] };
  }

  if (effect.atom === 'effect.add-mana') {
    const mana = resolveMana(effect.raw);
    if (mana === null) {
      reasons.add('ambiguous-mana');
    } else {
      commands.push({ type: 'addMana', color: mana.color, amount: mana.amount });
    }
    return { commands, prompts, reasons: [...reasons] };
  }

  if (effect.atom === 'effect.create-token') {
    if (!clauseHasTreasure) {
      reasons.add('needs-parse');
    }
    return { commands, prompts, reasons: [...reasons] };
  }

  if (!effect.optional && GUIDED_TARGET_ATOMS.has(effect.atom)) {
    const prompt = guidedTargetPrompt(effect);
    if (prompt) {
      prompts.push(prompt);
      return { commands, prompts, reasons: [] };
    }
  }

  if (!effect.optional && GUIDED_CHOICE_ATOMS.has(effect.atom)) {
    const count = resolveCount(effect.count);
    if (count === null) {
      reasons.add('variable-count');
    } else {
      prompts.push({
        atom: effect.atom,
        kind: 'scry-surveil',
        count,
        raw: effect.raw,
      });
      return { commands, prompts, reasons: [] };
    }
  }

  if (TARGET_REQUIRED_ATOMS.has(effect.atom)) {
    reasons.add('needs-target');
  } else if (CHOICE_REQUIRED_ATOMS.has(effect.atom)) {
    reasons.add('needs-choice');
  } else if (effect.atom === 'effect.extra-turn') {
    reasons.add('no-command');
  } else {
    reasons.add('needs-parse');
  }

  return { commands, prompts, reasons: [...reasons] };
}

function countDrivenCommand(atom: string, count: number): GameCommand | null {
  switch (atom) {
    case 'effect.draw':
      return { type: 'draw', count };
    case 'effect.gain-life':
      return { type: 'adjustLife', delta: count };
    case 'effect.lose-life':
      return { type: 'adjustLife', delta: -count };
    case 'effect.mill':
      return { type: 'mill', count };
    case 'effect.poison':
      return { type: 'adjustPlayerCounter', kind: 'poison', delta: count };
    case 'effect.energy':
      return { type: 'adjustPlayerCounter', kind: 'energy', delta: count };
    case 'effect.experience':
      return { type: 'adjustPlayerCounter', kind: 'experience', delta: count };
    case 'effect.treasure':
      return {
        type: 'createToken',
        name: '宝物',
        typeLine: 'Artifact — Treasure',
        quantity: count,
        producedMana: ['W', 'U', 'B', 'R', 'G'],
        tokenKind: 'treasure',
      };
    default:
      return null;
  }
}

function hasSupportedPlayerSubject(effect: EffectClause): boolean {
  const raw = effect.raw.trim();
  switch (effect.atom) {
    case 'effect.draw':
      return /^\s*draw\b/i.test(raw) || /\byou draw\b/i.test(raw);
    case 'effect.gain-life':
      return /^\s*gain\b/i.test(raw) || /\byou gain\b/i.test(raw);
    case 'effect.lose-life':
      return /\byou lose\b/i.test(raw);
    case 'effect.mill':
      return /^\s*mill\b/i.test(raw) || /\byou mill\b/i.test(raw);
    case 'effect.poison':
      return /\byou\b[^.]*\bpoison counters?\b/i.test(raw);
    case 'effect.energy':
      return /\byou\b[^.]*(?:energy counters?|\{E\})/i.test(raw);
    case 'effect.experience':
      return /\byou\b[^.]*\bexperience counters?\b/i.test(raw);
    case 'effect.treasure':
      return true;
    default:
      return false;
  }
}

function resolveCount(count: CountSpec): number | null {
  if (count.kind === 'one') {
    return 1;
  }
  if (count.kind === 'fixed') {
    return Math.max(0, Math.floor(count.value));
  }
  return null;
}

function resolveMana(raw: string): { color: ManaColor; amount: number } | null {
  const counts = new Map<ManaColor, number>();
  for (const color of MANA_COLORS) {
    const matches = raw.match(new RegExp(`\\{${color}\\}`, 'gi'));
    if (matches && matches.length > 0) {
      counts.set(color, matches.length);
    }
  }

  if (counts.size !== 1) {
    return null;
  }

  const [[color, amount]] = [...counts.entries()];
  return { color, amount };
}

function guidedTargetPrompt(effect: EffectClause): EffectPrompt | null {
  if (!isSingleTargetClause(effect.raw)) {
    return null;
  }
  if (
    effect.atom === 'effect.return' &&
    !/\bto (?:its owner's|their|your|the owner's) hand\b/i.test(effect.raw)
  ) {
    return null;
  }
  const filter = targetFilterForRaw(effect.raw);
  if (!filter.types || filter.types.length === 0) {
    return null;
  }
  return {
    atom: effect.atom,
    kind: 'target',
    count: 1,
    filter,
    raw: effect.raw,
  };
}

function isSingleTargetClause(raw: string): boolean {
  if (!/\btarget\b/i.test(raw)) {
    return false;
  }
  if (/\bup to\b/i.test(raw)) {
    return false;
  }
  if (/\b(?:two|three|four|five|six|seven|eight|nine|ten|\d+)\s+target\b/i.test(raw)) {
    return false;
  }
  if (/\beach target\b/i.test(raw)) {
    return false;
  }
  if (/\bany number of target\b/i.test(raw)) {
    return false;
  }
  if (/\btarget\b[^.]*\bcard\b/i.test(raw)) {
    return false;
  }
  const targetMatches = raw.match(/\btarget\b/gi) ?? [];
  if (targetMatches.length !== 1) {
    return false;
  }
  return true;
}

function targetFilterForRaw(raw: string): TargetFilter {
  const match = /\btarget\b([\s\S]*)/i.exec(raw);
  const afterTarget = match?.[1] ?? '';
  const nounPhrase = afterTarget
    .split(/\b(?:to|with|from|until|gets?|gains?|loses?|can't|cannot|deals?)\b|[.,;]/i)[0]
    .toLowerCase();
  const types = TARGET_TYPES.filter((type) => new RegExp(`\\b${type}\\b`, 'i').test(nounPhrase));
  const filter: TargetFilter = { types };
  if (/\byou control\b/i.test(raw)) {
    filter.controller = 'you';
  }
  return filter;
}

export function buildGuidedCommands(
  prompt: EffectPrompt,
  answer: GuidedAnswer,
  _ctx: CompileContext,
): GameCommand[] {
  void _ctx;
  if (prompt.kind !== answer.kind) {
    return [];
  }

  if (answer.kind === 'modal') {
    return [];
  }

  if (answer.kind === 'scry-surveil') {
    return [
      {
        type: 'arrangeTop',
        topOrder: answer.topOrder.slice(),
        toBottom: answer.toBottom.slice(),
        toGraveyard: answer.toGraveyard.slice(),
      },
    ];
  }

  if (prompt.atom === null) {
    return [];
  }

  return answer.cardIds.flatMap((cardId): GameCommand[] => {
    switch (prompt.atom) {
      case 'effect.destroy':
      case 'effect.sacrifice':
        return [{ type: 'moveCard', cardId, to: 'graveyard', position: 'bottom' }];
      case 'effect.exile':
        return [{ type: 'moveCard', cardId, to: 'exile', position: 'bottom' }];
      case 'effect.return':
        return [{ type: 'moveCard', cardId, to: 'hand', position: 'bottom' }];
      case 'effect.tap':
        return [{ type: 'setTapped', cardId, tapped: true }];
      case 'effect.untap':
        return [{ type: 'setTapped', cardId, tapped: false }];
      case 'effect.counter-plus':
        return [
          {
            type: 'addCounters',
            cardId,
            counterType: '+1/+1',
            delta: counterDelta(prompt.raw),
          },
        ];
      default:
        return [];
    }
  });
}

function counterDelta(raw: string): number {
  const fixedMatch = /\b(\d+)\s+\+1\/\+1 counters?\b/i.exec(raw);
  if (fixedMatch) {
    return Math.max(1, Number.parseInt(fixedMatch[1], 10) || 1);
  }
  const wordMatch = /\b(two|three|four|five|six|seven|eight|nine|ten)\s+\+1\/\+1 counters?\b/i.exec(raw);
  if (wordMatch) {
    const value = new Map([
      ['two', 2],
      ['three', 3],
      ['four', 4],
      ['five', 5],
      ['six', 6],
      ['seven', 7],
      ['eight', 8],
      ['nine', 9],
      ['ten', 10],
    ]).get(wordMatch[1].toLowerCase());
    return value ?? 1;
  }
  return 1;
}
