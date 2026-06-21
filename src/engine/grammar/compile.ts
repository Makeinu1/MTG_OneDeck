import type { CardDef, ManaColor } from '../../types/card';
import type { GameCommand } from '../commands';
import type { AbilityIR, CountSpec, EffectClause } from './ir';

export interface CompileContext {
  sourceId: string;
  def: CardDef;
}

export type AutoDecision = 'auto' | 'manual';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface CompiledEffect {
  commands: GameCommand[];
  decision: AutoDecision;
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

export function compileAbilityIR(ir: AbilityIR, _ctx: CompileContext): CompiledEffect {
  void _ctx;
  const commands: GameCommand[] = [];
  const reasons = new Set<ManualReason>();

  if (ir.effects.length === 0) {
    reasons.add('no-effect');
  }
  if (ir.constructs.includes('construct.target')) {
    reasons.add('needs-target');
  }
  if (ir.constructs.includes('construct.choose-modal')) {
    reasons.add('needs-choice');
  }
  for (const construct of ir.constructs) {
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
    for (const reason of compiled.reasons) {
      reasons.add(reason);
    }
  }

  const sortedReasons = [...reasons].sort((a, b) => a.localeCompare(b));
  const decision: AutoDecision = sortedReasons.length === 0 ? 'auto' : 'manual';

  return {
    commands,
    decision,
    confidence: decision === 'auto' ? 0.95 : 0.5,
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
): { commands: GameCommand[]; reasons: ManualReason[] } {
  const commands: GameCommand[] = [];
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
    return { commands, reasons: [...reasons] };
  }

  if (effect.atom === 'effect.add-mana') {
    const mana = resolveMana(effect.raw);
    if (mana === null) {
      reasons.add('ambiguous-mana');
    } else {
      commands.push({ type: 'addMana', color: mana.color, amount: mana.amount });
    }
    return { commands, reasons: [...reasons] };
  }

  if (effect.atom === 'effect.create-token') {
    if (!clauseHasTreasure) {
      reasons.add('needs-parse');
    }
    return { commands, reasons: [...reasons] };
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

  return { commands, reasons: [...reasons] };
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
