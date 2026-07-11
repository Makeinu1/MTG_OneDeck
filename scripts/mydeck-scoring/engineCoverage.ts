import {
  compileAbilityCost,
  compileAbilityIR,
  type CompileContext,
  type CompiledEffect,
} from '../../src/engine/grammar/compile.ts';
import { parseAbilityIR, type AbilityIR } from '../../src/engine/grammar/ir.ts';
import { splitAbilityLines, type AbilityLine } from '../../src/engine/grammar/index.ts';
import type { CardDef, ManaColor } from '../../src/types/card';

const EFFECT_FAMILY_BY_ATOM = new Map<string, string>([
  ['effect.draw', 'action:draw'],
  ['effect.mill', 'action:mill'],
  ['effect.sacrifice', 'action:sacrifice'],
  ['effect.destroy', 'action:destroy'],
  ['effect.exile', 'action:exile'],
  ['effect.return', 'action:return'],
  ['effect.discard', 'action:discard'],
  ['effect.search', 'action:search'],
  ['effect.shuffle', 'action:shuffle'],
  ['effect.create-token', 'token:create'],
  ['effect.counter-plus', 'counter:write'],
  ['effect.damage', 'damage:write'],
  ['effect.gain-life', 'life:write'],
  ['effect.lose-life', 'life:write'],
  ['effect.tap', 'tap-state:write'],
  ['effect.untap', 'tap-state:write'],
]);

const COVERAGE_COMMAND_TYPES = new Map<string, string>([
  ['addMana', 'mana:write'],
  ['draw', 'action:draw'],
  ['mill', 'action:mill'],
  ['createToken', 'token:create'],
  ['createDefinedToken', 'token:create'],
  ['adjustCounter', 'counter:write'],
  ['dealDamage', 'damage:write'],
  ['markDamage', 'damage:write'],
  ['adjustLife', 'life:write'],
  ['setTapped', 'tap-state:write'],
]);

const MANA_COLORS = new Set<string>(['W', 'U', 'B', 'R', 'G', 'C']);

// CompileContext deliberately contains only stable card-derived data. The
// scoring tool does not fabricate a GameState or target objects.
function compileContext(card: CardDef, line: AbilityLine): CompileContext {
  return {
    sourceId: `score:${card.scryfallId}:${line.faceIndex}`,
    def: card,
    abilityLineIndex: line.faceIndex,
    commanderColorIdentity: card.colorIdentity.filter(
      (color): color is ManaColor => MANA_COLORS.has(color),
    ),
  };
}

function addEffectCoverage(tags: Set<string>, ir: AbilityIR, compiled: CompiledEffect): void {
  if (compiled.decision === 'manual') {
    return;
  }

  for (const command of compiled.commands) {
    const tag = COVERAGE_COMMAND_TYPES.get(command.type);
    if (tag) {
      tags.add(tag);
    }
  }

  for (const prompt of compiled.prompts) {
    if (prompt.kind === 'target') {
      tags.add('target:object-or-player');
    }
    if (prompt.atom) {
      const tag = EFFECT_FAMILY_BY_ATOM.get(prompt.atom);
      if (tag) {
        tags.add(tag);
      }
      if (prompt.atom === 'effect.search') {
        tags.add('action:shuffle');
      }
      if (prompt.atom === 'effect.add-mana') {
        tags.add('mana:write');
      }
    }
  }

  if (ir.effects.length === 1 && (compiled.commands.length > 0 || compiled.prompts.length > 0)) {
    const tag = EFFECT_FAMILY_BY_ATOM.get(ir.effects[0]?.atom ?? '');
    if (tag) {
      tags.add(tag);
    }
    if (ir.effects[0]?.atom === 'effect.search') {
      tags.add('action:shuffle');
    }
  }
}

export function engineCoverageTagsForLine(card: CardDef, line: AbilityLine): Set<string> {
  const tags = new Set<string>();
  const typeLine = card.faces[line.faceIndex]?.typeLine ?? card.typeLine;
  const ir = parseAbilityIR(line.text, typeLine);
  const ctx = compileContext(card, line);
  const compiled = compileAbilityIR(ir, ctx);
  const cost = compileAbilityCost(ir.cost ?? null, ctx);

  addEffectCoverage(tags, ir, compiled);
  for (const command of cost.commands) {
    const tag = COVERAGE_COMMAND_TYPES.get(command.type);
    if (tag) {
      tags.add(tag);
    }
  }
  // A line can contain independently supported and unsupported effects (the
  // colored Talisman ability is the common example). Compile each parsed atom
  // through the same runtime compiler so one manual sibling cannot hide the
  // concrete command or guided prompt produced for another family.
  if (ir.effects.length > 1) {
    for (const effect of ir.effects) {
      const singleEffectIR: AbilityIR = { ...ir, effects: [effect], modal: undefined };
      addEffectCoverage(tags, singleEffectIR, compileAbilityIR(singleEffectIR, ctx));
    }
  }
  // The runtime resolves a modal prompt by parsing each option's clean `raw`
  // text independently (gameStore.compileSelectedModalOptions).
  for (const option of ir.modal?.options ?? []) {
    const optionIR = parseAbilityIR(option.raw, typeLine);
    addEffectCoverage(tags, optionIR, compileAbilityIR(optionIR, ctx));
  }

  if (line.shape === 'activated' && cost.decision !== 'manual') {
    tags.add('cost:activation');
  }
  if (ir.cost?.tap && cost.decision !== 'manual') {
    tags.add('cost:tap');
  }
  if (
    cost.decision !== 'manual' &&
    cost.commands.some((command) => command.type === 'moveCard' && command.to === 'graveyard')
  ) {
    tags.add('action:sacrifice');
  }
  if (
    cost.decision !== 'manual' &&
    cost.commands.some((command) => command.type === 'moveCard' && command.to === 'exile')
  ) {
    tags.add('action:exile');
  }
  if (
    cost.decision !== 'manual' &&
    cost.commands.some((command) =>
      command.type === 'setTapped' ||
      command.type === 'adjustLife' ||
      command.type === 'moveCard'
    )
  ) {
    tags.add('cost:nonmana');
  }

  return tags;
}

// Compile every ability line through the runtime compiler and return the union
// of demand-family tags for which it emits commands or guided prompts.
export function engineCoverageTags(card: CardDef): Set<string> {
  const tags = new Set<string>();
  for (const line of splitAbilityLines(card)) {
    for (const tag of engineCoverageTagsForLine(card, line)) {
      tags.add(tag);
    }
  }
  return tags;
}
