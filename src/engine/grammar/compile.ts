import type { CardDef, ManaColor } from '../../types/card';
import type { GameCommand } from '../commands';
import type { LinkedExilePurpose, TargetSelectionKind } from '../types';
import type { AbilityCost, AbilityIR, CountSpec, EffectClause } from './ir';
import type { EffectAtomId } from './index';

export interface CompileContext {
  sourceId: string;
  def: CardDef;
  sourceObjectId?: string;
  abilityLineIndex?: number;
  commanderColorIdentity?: readonly ManaColor[];
  libraryShuffleOrder?: readonly string[];
  allowLibrarySearchComposite?: boolean;
}

export type AutoDecision = 'auto' | 'guided' | 'manual';
export type CostDecision = 'auto' | 'manual';
export type RiskLevel = 'low' | 'medium' | 'high';
export type PromptKind =
  | 'target'
  | 'library-search'
  | 'discard'
  | 'sacrifice'
  | 'scry-surveil'
  | 'modal'
  | 'mana'
  | 'cost-discard'
  | 'cost-sacrifice';

export interface TargetFilter {
  types?: string[];
  excludedTypes?: string[];
  excludeTokens?: boolean;
  excludeSource?: boolean;
  controller?: 'any' | 'you' | 'opponent';
  zone?: 'battlefield' | 'graveyard' | 'stack';
  owner?: 'any' | 'you' | 'opponent';
}

export type LibrarySearchFilter =
  | { kind: 'basic-land' }
  | { kind: 'land-subtype'; subtype: LandSubtype };

export interface LibrarySearchSpec {
  filter: LibrarySearchFilter;
  destination: 'battlefield';
  entersTapped: boolean;
  shuffle: true;
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
  slotId?: string;
  targetKind?: TargetSelectionKind;
  filter?: TargetFilter;
  librarySearch?: LibrarySearchSpec;
  options?: ModalOption[];
  manaOptions?: ManaColor[];
  linkedExile?: { purpose: LinkedExilePurpose };
  raw: string;
}

export type GuidedAnswer =
  | { kind: 'target'; cardIds: string[] }
  | { kind: 'library-search'; cardIds: string[] }
  | { kind: 'discard'; cardIds: string[] }
  | { kind: 'sacrifice'; cardIds: string[] }
  | { kind: 'scry-surveil'; topOrder: string[]; toBottom: string[]; toGraveyard: string[] }
  | { kind: 'modal'; chosen: number[] }
  | { kind: 'mana'; color: ManaColor };

export interface CompiledEffect {
  commands: GameCommand[];
  decision: AutoDecision;
  prompts: EffectPrompt[];
  confidence: number;
  risk: RiskLevel;
  reasons: string[];
}

export interface CompiledCost {
  commands: GameCommand[];
  manaCost: string | null;
  decision: CostDecision;
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

type CostManualReason = 'unmodeled-cost' | 'variable-x';
type SupportedPredefinedTokenKind = NonNullable<CardDef['tokenKind']>;
type LandSubtype = 'Plains' | 'Island' | 'Swamp' | 'Mountain' | 'Forest';

interface PredefinedTokenSpec {
  name: string;
  typeLine: string;
  tokenKind: SupportedPredefinedTokenKind;
  producedMana?: readonly ManaColor[];
}

interface DefinedCreatureTokenSpec {
  name: string;
  typeLine: string;
  power: string;
  toughness: string;
  quantity: number;
  initialTapped: boolean;
}

const NON_SELF_SACRIFICE_PREFIXES = new Set([
  'a',
  'all',
  'an',
  'another',
  'eight',
  'each',
  'five',
  'four',
  'nine',
  'other',
  'seven',
  'six',
  'ten',
  'target',
  'three',
  'two',
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

const COLORED_MANA: readonly ManaColor[] = ['W', 'U', 'B', 'R', 'G'];
const MANA_AMOUNT_WORDS = new Map<string, number>([
  ['a', 1],
  ['an', 1],
  ['one', 1],
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
const GUIDED_TARGET_ATOMS = new Set([
  'effect.counter-plus',
  'effect.counter-spell',
  'effect.destroy',
  'effect.exile',
  'effect.return',
  'effect.sacrifice',
  'effect.tap',
  'effect.untap',
]);
const GUIDED_CHOICE_ATOMS = new Set(['effect.scry', 'effect.surveil']);
const BASIC_LAND_SUBTYPES: readonly LandSubtype[] = [
  'Plains',
  'Island',
  'Swamp',
  'Mountain',
  'Forest',
];
const TARGET_TYPES = ['creature', 'artifact', 'enchantment', 'land', 'planeswalker', 'permanent'];
const PREDEFINED_TOKEN_SPECS: Record<SupportedPredefinedTokenKind, PredefinedTokenSpec> = {
  treasure: {
    name: '宝物',
    typeLine: 'Token Artifact — Treasure',
    tokenKind: 'treasure',
    producedMana: ['W', 'U', 'B', 'R', 'G'],
  },
  clue: {
    name: '手掛かり',
    typeLine: 'Token Artifact — Clue',
    tokenKind: 'clue',
  },
  food: {
    name: '食物',
    typeLine: 'Token Artifact — Food',
    tokenKind: 'food',
  },
  blood: {
    name: '血',
    typeLine: 'Token Artifact — Blood',
    tokenKind: 'blood',
  },
};

export function compileAbilityCost(cost: AbilityCost | null, ctx: CompileContext): CompiledCost {
  if (cost === null) {
    return {
      commands: [],
      manaCost: null,
      decision: 'auto',
      reasons: [],
    };
  }

  const reasons = new Set<CostManualReason>();
  if (cost.mana !== null && /\{X\}/i.test(cost.mana)) {
    reasons.add('variable-x');
  }
  if (/\{X\}|\bX\b/.test(cost.raw)) {
    reasons.add('variable-x');
  }
  if (hasAbilityWordLabel(cost.raw)) {
    reasons.add('unmodeled-cost');
  }

  const namedSelfCosts = removeNamedSelfZoneMoveElements(cost.raw, ctx.def.name);
  let sacrificesSelf = namedSelfCosts.sacrificesSelf;
  let exilesSelf = namedSelfCosts.exilesSelf;
  const payLifeAmounts: number[] = [];
  const residual = namedSelfCosts.raw
    .split(',')
    .map((part) => {
      const element = part.trim();
      if (isSelfSacrificeCostElement(element, ctx.def.name)) {
        sacrificesSelf = true;
        return '';
      }
      if (isSelfExileCostElement(element, ctx.def.name)) {
        exilesSelf = true;
        return '';
      }
      const payLifeAmount = fixedPayLifeCostAmount(element);
      if (payLifeAmount !== null) {
        payLifeAmounts.push(payLifeAmount);
        return '';
      }
      return element.replace(/\{[^}]+\}/g, ' ');
    })
    .join(' ');

  if (/[A-Za-z]/.test(residual)) {
    reasons.add('unmodeled-cost');
  }
  if (sacrificesSelf && exilesSelf) {
    reasons.add('unmodeled-cost');
  }

  const sortedReasons = [...reasons].sort((a, b) => a.localeCompare(b));
  if (sortedReasons.length > 0) {
    return {
      commands: [],
      manaCost: null,
      decision: 'manual',
      reasons: sortedReasons,
    };
  }

  const commands: GameCommand[] = [];
  if (cost.tap) {
    commands.push({ type: 'setTapped', cardId: ctx.sourceId, tapped: true });
  }
  for (const amount of payLifeAmounts) {
    commands.push({ type: 'adjustLife', delta: -amount });
  }
  if (sacrificesSelf) {
    commands.push({
      type: 'moveCard',
      cardId: ctx.sourceId,
      to: 'graveyard',
      position: 'top',
    });
  }
  if (exilesSelf) {
    commands.push({
      type: 'moveCard',
      cardId: ctx.sourceId,
      to: 'exile',
      position: 'top',
    });
  }

  return {
    commands,
    manaCost: cost.mana,
    decision: 'auto',
    reasons: [],
  };
}

export function compileAbilityIR(ir: AbilityIR, ctx: CompileContext): CompiledEffect {
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

  if (ctx.allowLibrarySearchComposite !== false) {
    const librarySearchPrompt = guidedLibrarySearchPrompt(ir);
    if (librarySearchPrompt) {
      return {
        commands: [],
        decision: 'guided',
        prompts: [librarySearchPrompt],
        confidence: 0.75,
        risk: 'medium',
        reasons: [],
      };
    }
  }

  const temporaryReturnPrompt = guidedTemporaryReturnPrompt(ir);
  if (temporaryReturnPrompt) {
    return {
      commands: [],
      decision: 'guided',
      prompts: [temporaryReturnPrompt],
      confidence: 0.75,
      risk: 'medium',
      reasons: [],
    };
  }

  if (ir.constructs.includes('construct.choose-modal')) {
    reasons.add('needs-choice');
  }
  for (const construct of ir.constructs) {
    if (construct === 'construct.target' || construct === 'construct.choose-modal') {
      continue;
    }
    if (construct === 'construct.you-control' && constructCapturedByGuidedTarget(construct, ir)) {
      continue;
    }
    const reason = reasonForManualConstruct(construct);
    if (reason) {
      reasons.add(reason);
    }
  }

  const treasureRaws = new Set(
    ir.effects.filter((effect) => effect.atom === 'effect.treasure').map((effect) => effect.raw),
  );
  if (
    ir.effects.some((effect) => effect.atom === 'effect.counter-spell') &&
    ir.effects.some((effect) => effect.atom !== 'effect.counter-spell')
  ) {
    reasons.add('needs-parse');
  }

  for (const effect of ir.effects) {
    const compiled = compileEffect(effect, treasureRaws.has(effect.raw), ctx);
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

function constructCapturedByGuidedTarget(construct: string, ir: AbilityIR): boolean {
  if (construct !== 'construct.you-control') {
    return false;
  }
  return ir.effects.some((effect) => guidedTargetPrompt(effect)?.filter?.controller === 'you');
}

function guidedTemporaryReturnPrompt(ir: AbilityIR): EffectPrompt | null {
  const exileIndex = ir.effects.findIndex((effect) => effect.atom === 'effect.exile');
  if (exileIndex < 0) {
    return null;
  }
  const exile = ir.effects[exileIndex];
  const returnEffect = ir.effects
    .slice(exileIndex + 1)
    .find((effect) => effect.atom === 'effect.return');
  if (!returnEffect) {
    return null;
  }
  if (
    !isTemporaryReturnExileClause(exile.raw) ||
    !isSameResolutionBattlefieldReturn(returnEffect.raw)
  ) {
    return null;
  }

  const filter = targetFilterForRaw(exile.raw);
  if (!filter.types || filter.types.length === 0) {
    return null;
  }
  return {
    atom: 'effect.exile',
    kind: 'target',
    count: 1,
    minCount: /\bup to one\b/i.test(exile.raw) ? 0 : 1,
    filter,
    linkedExile: { purpose: 'temporary-return' },
    raw: `${exile.raw} then ${returnEffect.raw}`,
  };
}

function isTemporaryReturnExileClause(raw: string): boolean {
  if (!/\bexile\b/i.test(raw) || !/\btarget\b/i.test(raw)) {
    return false;
  }
  if (!/\bexile\s+(?:up to one\s+)?target\b/i.test(raw)) {
    return false;
  }
  if (/\b(?:two|three|four|five|six|seven|eight|nine|ten|\d+)\s+target\b/i.test(raw)) {
    return false;
  }
  if (/\beach target\b|\bany number of target\b/i.test(raw)) {
    return false;
  }
  if (/\btarget\b[^.]*\bcard\b/i.test(raw)) {
    return false;
  }
  const targetMatches = raw.match(/\btarget\b/gi) ?? [];
  return targetMatches.length === 1;
}

function isSameResolutionBattlefieldReturn(raw: string): boolean {
  // Anchored at both ends (CR603.10a/608.2h + engine-spec §34.21 point 4): a trailing
  // delay clause ("... at the beginning of the next end step/turn/upkeep") means this is
  // NOT same-resolution and must stay manual (no delayed-return scheduler exists yet).
  return /^return\s+that\s+card\s+to\s+the\s+battlefield(?:\s+under\s+its\s+owner['’]s\s+control)?\.?$/i.test(
    raw.trim(),
  );
}

function reasonForManualConstruct(construct: string): ManualReason | null {
  switch (construct) {
    case 'construct.condition':
    case 'construct.each-player':
    case 'construct.intervening-if':
    case 'construct.mana-restriction':
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
  ctx: CompileContext,
): { commands: GameCommand[]; prompts: EffectPrompt[]; reasons: ManualReason[] } {
  const commands: GameCommand[] = [];
  const prompts: EffectPrompt[] = [];
  const reasons = new Set<ManualReason>();

  if (effect.optional) {
    reasons.add('optional');
  }

  if (effect.atom === 'effect.tap' && isDefinedTappedTokenCreation(effect.raw)) {
    return { commands, prompts, reasons: [...reasons] };
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
    const mana = compileManaEffect(effect.raw, ctx);
    commands.push(...mana.commands);
    prompts.push(...mana.prompts);
    for (const reason of mana.reasons) {
      reasons.add(reason);
    }
    return { commands, prompts, reasons: [...reasons] };
  }

  if (effect.atom === 'effect.create-token') {
    const count = resolveCount(effect.count);
    const tokenKind = predefinedTokenKindForRaw(effect.raw);
    const command = tokenKind && count !== null ? predefinedTokenCommand(tokenKind, count) : null;
    if (command && !(tokenKind === 'treasure' && clauseHasTreasure)) {
      commands.push(command);
    } else if (tokenKind && count === null) {
      reasons.add('variable-count');
    } else if (!clauseHasTreasure) {
      const definedCommand = definedCreatureTokenCommand(effect.raw);
      if (definedCommand) {
        commands.push(definedCommand);
      } else if (count === null) {
        reasons.add('variable-count');
      } else {
        reasons.add('needs-parse');
      }
    }
    return { commands, prompts, reasons: [...reasons] };
  }

  if (effect.atom === 'effect.sacrifice') {
    if (effect.optional) {
      return { commands, prompts, reasons: [...reasons] };
    }
    const compiled = compileSacrificeEffect(effect, ctx);
    commands.push(...compiled.commands);
    prompts.push(...compiled.prompts);
    for (const reason of compiled.reasons) {
      reasons.add(reason);
    }
    return { commands, prompts, reasons: [...reasons] };
  }

  if (effect.atom === 'effect.shuffle') {
    if (isSelfLibraryShuffleClause(effect.raw)) {
      if (ctx.libraryShuffleOrder) {
        commands.push({ type: 'shuffle', order: ctx.libraryShuffleOrder.slice() });
      } else {
        reasons.add('no-command');
      }
    } else {
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

  if (!effect.optional && effect.atom === 'effect.discard') {
    const prompt = guidedDiscardPrompt(effect);
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

function isSelfLibraryShuffleClause(raw: string): boolean {
  const normalized = raw
    .replace(/[.。]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return /^(?:then\s+)?(?:you\s+)?shuffle(?:\s+(?:your|the)\s+library)?$/i.test(normalized);
}

function guidedLibrarySearchPrompt(ir: AbilityIR): EffectPrompt | null {
  if (ir.effects.length === 0 || ir.effects.some((effect) => effect.optional)) {
    return null;
  }
  if (ir.constructs.length > 0) {
    return null;
  }

  const searchRaws = uniqueEffectRaws(ir.effects, 'effect.search');
  const putRaws = uniqueEffectRaws(ir.effects, 'effect.put-onto-battlefield');
  const shuffleRaws = uniqueEffectRaws(ir.effects, 'effect.shuffle');
  if (searchRaws.length !== 1 || putRaws.length !== 1 || shuffleRaws.length !== 1) {
    return null;
  }
  if (searchRaws[0] !== putRaws[0] || !isSelfLibraryShuffleClause(shuffleRaws[0])) {
    return null;
  }

  const parsed = parseSingleCardRampSearch(searchRaws[0]);
  if (!parsed) {
    return null;
  }

  const allowedRaws = new Set([searchRaws[0], shuffleRaws[0]]);
  if (ir.effects.some((effect) => !allowedRaws.has(effect.raw))) {
    return null;
  }

  return {
    atom: 'effect.search',
    kind: 'library-search',
    count: 1,
    librarySearch: {
      filter: parsed.filter,
      destination: 'battlefield',
      entersTapped: parsed.entersTapped,
      shuffle: true,
    },
    raw: searchRaws[0],
  };
}

function uniqueEffectRaws(effects: readonly EffectClause[], atom: EffectAtomId): string[] {
  return [...new Set(effects.filter((effect) => effect.atom === atom).map((effect) => effect.raw))];
}

function parseSingleCardRampSearch(
  raw: string,
): { filter: LibrarySearchFilter; entersTapped: boolean } | null {
  const normalized = raw
    .replace(/[.。]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  const match =
    /^search your library for (?:a|an|one) ([^,]+?) card,\s*put (?:it|that card) onto the battlefield( tapped)?[,]?$/i.exec(
      normalized,
    );
  if (!match) {
    return null;
  }

  const filter = simpleRampSearchFilter(match[1]);
  if (!filter) {
    return null;
  }
  return {
    filter,
    entersTapped: match[2] !== undefined,
  };
}

function simpleRampSearchFilter(description: string): LibrarySearchFilter | null {
  const normalized = description.toLowerCase().replace(/\s+/g, ' ').trim();
  if (normalized === 'basic land') {
    return { kind: 'basic-land' };
  }

  const subtype = BASIC_LAND_SUBTYPES.find((candidate) => candidate.toLowerCase() === normalized);
  return subtype ? { kind: 'land-subtype', subtype } : null;
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
      return predefinedTokenCommand('treasure', count);
    default:
      return null;
  }
}

function predefinedTokenKindForRaw(raw: string): SupportedPredefinedTokenKind | null {
  const matches = (Object.keys(PREDEFINED_TOKEN_SPECS) as SupportedPredefinedTokenKind[]).filter(
    (kind) => new RegExp(`\\b${kind}\\s+tokens?\\b`, 'i').test(raw),
  );
  return matches.length === 1 ? matches[0] : null;
}

function predefinedTokenCommand(
  tokenKind: SupportedPredefinedTokenKind,
  count: number,
): GameCommand {
  const spec = PREDEFINED_TOKEN_SPECS[tokenKind];
  return {
    type: 'createToken',
    name: spec.name,
    typeLine: spec.typeLine,
    quantity: count,
    ...(spec.producedMana ? { producedMana: spec.producedMana.slice() } : {}),
    tokenKind: spec.tokenKind,
  };
}

function definedCreatureTokenCommand(raw: string): GameCommand | null {
  const spec = parseDefinedCreatureTokenSpec(raw);
  if (!spec) {
    return null;
  }
  return {
    type: 'createDefinedToken',
    name: spec.name,
    typeLine: spec.typeLine,
    power: spec.power,
    toughness: spec.toughness,
    quantity: spec.quantity,
    initialTapped: spec.initialTapped,
  };
}

function parseDefinedCreatureTokenSpec(raw: string): DefinedCreatureTokenSpec | null {
  const normalized = raw
    .replace(/[.。]\s*$/, '.')
    .replace(/\s+/g, ' ')
    .trim();
  const match =
    /^create\s+(a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(tapped\s+)?(\d+)\/(\d+)\s+(?:white|blue|black|red|green|colorless)\s+([A-Za-z][A-Za-z' -]*(?:\s+[A-Za-z][A-Za-z' -]*)*)\s+creature\s+tokens?(?:\s+named\s+([^".]+))?\.?$/i.exec(
      normalized,
    );
  if (!match) {
    return null;
  }

  const quantity = parseFixedTokenQuantity(match[1]);
  if (quantity === null) {
    return null;
  }

  const subtypes = normalizeDefinedTokenText(match[5]);
  if (subtypes === '' || subtypeCapturesLeakedColorWord(subtypes)) {
    // A second (or "and"-joined) color word leaking into the subtype capture means the
    // clause has more than one color (e.g. "black and green Zombie"), which this fixed
    // single-color grammar does not model. Fail closed to manual rather than emit a
    // corrupted typeLine/name at `auto` confidence.
    return null;
  }

  const explicitName = match[6]?.trim();
  const name = explicitName ? normalizeDefinedTokenText(explicitName) : `${subtypes} Token`;
  return {
    name,
    typeLine: `Token Creature — ${subtypes}`,
    power: match[3],
    toughness: match[4],
    quantity,
    initialTapped: match[2] !== undefined,
  };
}

const DEFINED_TOKEN_COLOR_WORDS = new Set(['white', 'blue', 'black', 'red', 'green', 'colorless']);

function subtypeCapturesLeakedColorWord(subtypes: string): boolean {
  return subtypes
    .toLowerCase()
    .split(/\s+/)
    .some((word) => DEFINED_TOKEN_COLOR_WORDS.has(word));
}

function isDefinedTappedTokenCreation(raw: string): boolean {
  return parseDefinedCreatureTokenSpec(raw)?.initialTapped === true;
}

function parseFixedTokenQuantity(raw: string): number | null {
  const normalized = raw.toLowerCase();
  const quantity = /^\d+$/.test(normalized)
    ? Number.parseInt(normalized, 10)
    : MANA_AMOUNT_WORDS.get(normalized);
  return quantity !== undefined && quantity > 0 ? quantity : null;
}

function normalizeDefinedTokenText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
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

function guidedDiscardPrompt(effect: EffectClause): EffectPrompt | null {
  const count = resolveCount(effect.count);
  if (count !== 1 || !isSelfDiscardOneCardClause(effect.raw)) {
    return null;
  }
  return {
    atom: effect.atom,
    kind: 'discard',
    count: 1,
    raw: effect.raw,
  };
}

function isSelfDiscardOneCardClause(raw: string): boolean {
  if (
    /\brandom\b|\btarget\b|\beach\b|\bopponents?\b|\btheir\b|\bthat player\b|\bcontroller\b/i.test(
      raw,
    )
  ) {
    return false;
  }
  return (
    /^\s*discard\s+(?:a|one)\s+card\b/i.test(raw) || /\byou discard\s+(?:a|one)\s+card\b/i.test(raw)
  );
}

function compileSacrificeEffect(
  effect: EffectClause,
  ctx: CompileContext,
): { commands: GameCommand[]; prompts: EffectPrompt[]; reasons: ManualReason[] } {
  if (hasUnsupportedSacrificeClause(effect.raw)) {
    return { commands: [], prompts: [], reasons: ['needs-parse'] };
  }

  if (isSelfSacrificeEffectClause(effect.raw, ctx.def.name)) {
    return {
      commands: [{ type: 'moveCard', cardId: ctx.sourceId, to: 'graveyard', position: 'bottom' }],
      prompts: [],
      reasons: [],
    };
  }

  const prompt = guidedSacrificePrompt(effect);
  if (prompt) {
    return { commands: [], prompts: [prompt], reasons: [] };
  }

  return {
    commands: [],
    prompts: [],
    reasons: sacrificeManualReasons(effect),
  };
}

function hasUnsupportedSacrificeClause(raw: string): boolean {
  return /\b(?:unless|target|each|opponents?|that player|their|controller)\b/i.test(raw);
}

function isSelfSacrificeEffectClause(raw: string, cardName: string): boolean {
  const object = sacrificeObjectPhrase(raw);
  if (!object) {
    return false;
  }
  if (isThisSelfReference(object)) {
    return true;
  }
  return selfNameAlternatives(cardName).some((name) => sameCardNameReference(object, name));
}

function guidedSacrificePrompt(effect: EffectClause): EffectPrompt | null {
  const object = sacrificeObjectPhrase(effect.raw);
  if (!object) {
    return null;
  }
  const match = /^(?:a|an|one)\s+(.+)$/i.exec(object);
  if (!match) {
    return null;
  }
  const filter = sacrificeEffectFilter(match[1]);
  if (!filter) {
    return null;
  }
  return {
    atom: effect.atom,
    kind: 'sacrifice',
    count: 1,
    filter,
    raw: effect.raw,
  };
}

function sacrificeObjectPhrase(raw: string): string | null {
  const normalized = raw
    .replace(/[.。]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  const match = /^(?:you\s+)?sacrifice\s+(.+)$/i.exec(normalized);
  return match?.[1].trim() ?? null;
}

function sacrificeEffectFilter(objectPhrase: string): TargetFilter | null {
  const normalized = objectPhrase.toLowerCase().replace(/\s+/g, ' ').trim();
  if (
    normalized === 'creature' ||
    normalized === 'artifact' ||
    normalized === 'enchantment' ||
    normalized === 'land' ||
    normalized === 'planeswalker' ||
    normalized === 'permanent'
  ) {
    return { types: [normalized], controller: 'you' };
  }
  return null;
}

function sacrificeManualReasons(effect: EffectClause): ManualReason[] {
  const object = sacrificeObjectPhrase(effect.raw);
  if (object && /^(?:two|three|four|five|six|seven|eight|nine|ten|\d+)\b/i.test(object)) {
    return ['needs-choice'];
  }
  const count = resolveCount(effect.count);
  if (count !== null && count !== 1) {
    return ['needs-choice'];
  }
  return ['needs-parse'];
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

function compileManaEffect(
  raw: string,
  ctx: CompileContext,
): { commands: GameCommand[]; prompts: EffectPrompt[]; reasons: ManualReason[] } {
  if (hasManaUseRestriction(raw) || hasConditionalManaText(raw) || hasSpecialManaText(raw)) {
    return { commands: [], prompts: [], reasons: ['needs-parse'] };
  }

  const literal = literalManaCommands(raw);
  if (literal !== null) {
    return { commands: literal, prompts: [], reasons: [] };
  }

  const guided = guidedManaPrompt(raw, ctx);
  if (guided !== null) {
    return { commands: [], prompts: [guided], reasons: [] };
  }

  if (/\bchosen color\b|\bchoose a color\b|\bin any combination of\b/i.test(raw)) {
    return { commands: [], prompts: [], reasons: ['needs-choice'] };
  }
  if (/\bX\s+mana\b|\bfor each\b/i.test(raw)) {
    return { commands: [], prompts: [], reasons: ['variable-count'] };
  }
  return { commands: [], prompts: [], reasons: ['ambiguous-mana'] };
}

function literalManaCommands(raw: string): GameCommand[] | null {
  if (/\bor\b|\band\/or\b|\bchosen color\b/i.test(raw)) {
    return null;
  }

  const symbols = [...raw.matchAll(/\{([WUBRGC])\}/gi)].map(
    (match) => match[1].toUpperCase() as ManaColor,
  );
  if (symbols.length === 0) {
    return null;
  }

  const ordered: ManaColor[] = [];
  const counts = new Map<ManaColor, number>();
  for (const symbol of symbols) {
    if (!counts.has(symbol)) {
      ordered.push(symbol);
    }
    counts.set(symbol, (counts.get(symbol) ?? 0) + 1);
  }

  return ordered.map((color) => ({
    type: 'addMana',
    color,
    amount: counts.get(color) ?? 0,
  }));
}

function guidedManaPrompt(raw: string, ctx: CompileContext): EffectPrompt | null {
  const commanderIdentity =
    /\bany(?:\s+one)?\s+color\s+(?:in|within)\s+(?:your commander's color identity|the color identity of your commander)\b/i.test(
      raw,
    );
  const anyColor = /\badd\s+([A-Za-z]+|\d+)\s+mana\s+of\s+any(?:\s+one)?\s+color\b/i.exec(raw);
  if (!anyColor) {
    return null;
  }

  const amount = parseManaAmountToken(anyColor[1]);
  if (amount === null) {
    return null;
  }

  return {
    atom: 'effect.add-mana',
    kind: 'mana',
    count: amount,
    manaOptions: commanderIdentity ? commanderColorOptions(ctx) : COLORED_MANA.slice(),
    raw,
  };
}

function parseManaAmountToken(token: string): number | null {
  const normalized = token.toLowerCase();
  if (MANA_AMOUNT_WORDS.has(normalized)) {
    return MANA_AMOUNT_WORDS.get(normalized) ?? null;
  }
  if (/^\d+$/.test(normalized)) {
    return Number.parseInt(normalized, 10);
  }
  return null;
}

function commanderColorOptions(ctx: CompileContext): ManaColor[] {
  const identity = ctx.commanderColorIdentity ?? [];
  return COLORED_MANA.filter((color) => identity.includes(color));
}

function hasManaUseRestriction(raw: string): boolean {
  return /\b(?:spend|use) this mana only\b|\bthis mana (?:can't|cannot) be spent\b|\bspend (?:that|this) mana\b/i.test(
    raw,
  );
}

function hasConditionalManaText(raw: string): boolean {
  return /\bif\b|\bactivate only\b|\bfor each\b|\bequal to\b/i.test(raw);
}

function hasSpecialManaText(raw: string): boolean {
  return /\{S\}|\bsnow\b|\bany type\b|\btype that\b|\bthat .* produced\b|\bcolors? among\b/i.test(
    raw,
  );
}

function guidedTargetPrompt(effect: EffectClause): EffectPrompt | null {
  if (effect.atom === 'effect.counter-spell') {
    const filter = stackSpellTargetFilterForRaw(effect.raw);
    if (!filter) {
      return null;
    }
    return {
      atom: effect.atom,
      kind: 'target',
      count: 1,
      targetKind: 'object',
      filter,
      raw: effect.raw,
    };
  }
  if (effect.atom === 'effect.return' && isExactGraveyardCreatureReturn(effect.raw)) {
    return {
      atom: effect.atom,
      kind: 'target',
      count: 1,
      filter: { types: ['creature'], zone: 'graveyard', owner: 'you' },
      raw: effect.raw,
    };
  }
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

function stackSpellTargetFilterForRaw(raw: string): TargetFilter | null {
  const normalized = raw
    .replace(/[.。]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  switch (normalized) {
    case 'counter target spell':
      return { zone: 'stack' };
    case 'counter target noncreature spell':
      return { zone: 'stack', excludedTypes: ['creature'] };
    case 'counter target creature spell':
      return { zone: 'stack', types: ['creature'] };
    case 'counter target instant or sorcery spell':
      return { zone: 'stack', types: ['instant', 'sorcery'] };
    case 'counter target enchantment, instant, or sorcery spell':
    case 'counter target enchantment, instant or sorcery spell':
      return { zone: 'stack', types: ['enchantment', 'instant', 'sorcery'] };
    default:
      return null;
  }
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

function isExactGraveyardCreatureReturn(raw: string): boolean {
  const normalized = raw
    .replace(/[.。]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return /^return target creature card from your graveyard to the battlefield$/i.test(normalized);
}

function targetFilterForRaw(raw: string): TargetFilter {
  const match = /\btarget\b([\s\S]*)/i.exec(raw);
  const afterTarget = match?.[1] ?? '';
  const nounPhrase = afterTarget
    .split(/\b(?:to|with|from|until|gets?|gains?|loses?|can't|cannot|deals?)\b|[.;]/i)[0]
    .toLowerCase();
  const types = TARGET_TYPES.filter((type) => new RegExp(`\\b${type}\\b`, 'i').test(nounPhrase));
  const excludedTypes = TARGET_TYPES.filter((type) =>
    new RegExp(`\\bnon[-\\s]?${type}\\b`, 'i').test(nounPhrase),
  );
  const filter: TargetFilter = {
    types,
    ...(excludedTypes.length > 0 ? { excludedTypes } : {}),
    ...(/\bnontoken\b/i.test(nounPhrase) ? { excludeTokens: true } : {}),
    ...(/\banother\s+target\b|\bother\s+target\b/i.test(raw) ? { excludeSource: true } : {}),
  };
  if (/\byou control\b/i.test(raw)) {
    filter.controller = 'you';
  } else if (/\byou (?:don['’]t|do not) control\b|\bopponents? controls?\b/i.test(raw)) {
    filter.controller = 'opponent';
  }
  return filter;
}

function stableTextHash(text: string): string {
  let hash = 0;
  for (const char of text) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash.toString(36);
}

function linkedExileLinkId(prompt: EffectPrompt, cardId: string, ctx: CompileContext): string {
  const sourceObjectId = ctx.sourceObjectId ?? ctx.sourceId;
  const slotId = prompt.slotId ?? 'target';
  const line = ctx.abilityLineIndex === undefined ? 'line' : `line${ctx.abilityLineIndex}`;
  return `${sourceObjectId}:${line}:${slotId}:linked-exile:${cardId}:${stableTextHash(prompt.raw)}`;
}

export function buildGuidedCommands(
  prompt: EffectPrompt,
  answer: GuidedAnswer,
  ctx: CompileContext,
): GameCommand[] {
  if (prompt.kind === 'cost-discard' || prompt.kind === 'cost-sacrifice') {
    return [];
  }
  if (prompt.kind !== answer.kind) {
    return [];
  }

  if (answer.kind === 'modal') {
    return [];
  }

  if (answer.kind === 'library-search') {
    const spec = prompt.librarySearch;
    const order = ctx.libraryShuffleOrder?.slice();
    if (prompt.atom !== 'effect.search' || !spec || (spec.shuffle && !order)) {
      return [];
    }
    const cardId = answer.cardIds[0];
    const commands: GameCommand[] = cardId
      ? [{ type: 'moveCard', cardId, to: spec.destination, position: 'top' }]
      : [];
    if (cardId && spec.entersTapped) {
      commands.push({ type: 'setTapped', cardId, tapped: true });
    }
    commands.push({ type: 'shuffle', order: order ?? [] });
    return commands;
  }

  if (answer.kind === 'mana') {
    const options = prompt.manaOptions ?? COLORED_MANA;
    if (!options.includes(answer.color)) {
      return [];
    }
    return [{ type: 'addMana', color: answer.color, amount: Math.max(1, prompt.count) }];
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

  if (answer.kind === 'discard') {
    return prompt.atom === 'effect.discard' && answer.cardIds.length > 0
      ? [{ type: 'discard', cardIds: answer.cardIds.slice(0, prompt.count) }]
      : [];
  }

  if (answer.kind === 'sacrifice') {
    return prompt.atom === 'effect.sacrifice' && answer.cardIds.length > 0
      ? answer.cardIds
          .slice(0, prompt.count)
          .map((cardId) => ({ type: 'moveCard', cardId, to: 'graveyard', position: 'bottom' }))
      : [];
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
        if (prompt.linkedExile?.purpose === 'temporary-return') {
          if (!ctx.sourceObjectId) {
            return [];
          }
          return [
            {
              type: 'moveCard',
              cardId,
              to: 'exile',
              position: 'bottom',
              reason: 'resolve',
              linkedExileWrite: {
                linkId: linkedExileLinkId(prompt, cardId, ctx),
                purpose: 'temporary-return',
                sourceObjectId: ctx.sourceObjectId,
                sourcePhysicalId: ctx.sourceId,
              },
            },
          ];
        }
        return [{ type: 'moveCard', cardId, to: 'exile', position: 'bottom' }];
      case 'effect.return':
        return [
          {
            type: 'moveCard',
            cardId,
            to: prompt.filter?.zone === 'graveyard' ? 'battlefield' : 'hand',
            position: 'bottom',
          },
        ];
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
      case 'effect.counter-spell':
        return [{ type: 'removeStackItem', id: cardId }];
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
  const wordMatch = /\b(two|three|four|five|six|seven|eight|nine|ten)\s+\+1\/\+1 counters?\b/i.exec(
    raw,
  );
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

function hasAbilityWordLabel(raw: string): boolean {
  return /^\s*[A-Za-z][A-Za-z '-]*\s+(?:\u2014|--|-)\s*/.test(raw);
}

function isSelfSacrificeCostElement(element: string, cardName: string): boolean {
  const normalized = element
    .replace(/\s+/g, ' ')
    .replace(/[.。]\s*$/, '')
    .trim();
  const match = /^Sacrifice\s+(.+)$/i.exec(normalized);
  if (!match) {
    return false;
  }

  const object = match[1].trim();
  const firstWord = object.split(/\s+/)[0]?.toLowerCase() ?? '';
  if (/^\d+$/.test(firstWord) || NON_SELF_SACRIFICE_PREFIXES.has(firstWord)) {
    return false;
  }

  if (/^(?:it|~)$/i.test(object)) {
    return true;
  }
  if (isThisSelfReference(object)) {
    return true;
  }
  return selfNameAlternatives(cardName).some((name) => sameCardNameReference(object, name));
}

function isSelfExileCostElement(element: string, cardName: string): boolean {
  const normalized = element
    .replace(/\s+/g, ' ')
    .replace(/[.。]\s*$/, '')
    .trim();
  const match = /^Exile\s+(.+)$/i.exec(normalized);
  if (!match) {
    return false;
  }

  const object = match[1].trim();
  const firstWord = object.split(/\s+/)[0]?.toLowerCase() ?? '';
  if (/^\d+$/.test(firstWord) || NON_SELF_SACRIFICE_PREFIXES.has(firstWord)) {
    return false;
  }

  if (/^(?:it|~)$/i.test(object)) {
    return true;
  }
  if (isThisSelfReference(object)) {
    return true;
  }
  return selfNameAlternatives(cardName).some((name) => sameCardNameReference(object, name));
}

function fixedPayLifeCostAmount(element: string): number | null {
  const match = /^Pay\s+(a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+life$/i.exec(
    element
      .replace(/\s+/g, ' ')
      .replace(/[.。]\s*$/, '')
      .trim(),
  );
  if (!match) {
    return null;
  }
  return parseManaAmountToken(match[1]);
}

function removeNamedSelfZoneMoveElements(
  raw: string,
  cardName: string,
): { raw: string; sacrificesSelf: boolean; exilesSelf: boolean } {
  let next = raw;
  let sacrificesSelf = false;
  let exilesSelf = false;
  for (const name of selfNameAlternatives(cardName)) {
    for (const { verb, mark } of [
      { verb: 'Sacrifice', mark: () => (sacrificesSelf = true) },
      { verb: 'Exile', mark: () => (exilesSelf = true) },
    ]) {
      const pattern = new RegExp(`(^|,)\\s*${verb}\\s+${escapeRegExp(name)}\\s*(?=,|$)`, 'gi');
      next = next.replace(pattern, (match, separator: string) => {
        void match;
        mark();
        return separator;
      });
    }
  }
  return { raw: next, sacrificesSelf, exilesSelf };
}

function isThisSelfReference(object: string): boolean {
  if (!/^this\b/i.test(object)) {
    return false;
  }
  if (/\b(?:and|another|or|other|target|you control)\b/i.test(object)) {
    return false;
  }
  return /^this\s+[A-Za-z][A-Za-z -]*$/i.test(object);
}

function selfNameAlternatives(cardName: string): string[] {
  return cardName
    .split(/\s+\/\/\s+/)
    .map((name) => name.trim())
    .filter((name) => name !== '');
}

function sameCardNameReference(value: string, name: string): boolean {
  return value.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
