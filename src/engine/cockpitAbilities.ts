import type { CockpitTable } from './cockpitTable';
import type { GameCommand } from './commands';
import { activatedAbilityLines } from './grammar';
import { compileAbilityCost } from './grammar/compile';
import { parseAbilityIR } from './grammar/ir';
import { cyclingCost } from './status';

export interface TableAbilityChoice {
  key: string;
  label: string;
  text: string;
  costText: string;
  manaCost: string;
  commands: GameCommand[];
  manual: boolean;
}
/** Reuse the existing recognizer only for costs; effects never run here. */
export function tableAbilityChoices(table: CockpitTable, sourceId: string): TableAbilityChoice[] {
  const source = table.cards[sourceId];
  if (!source) return [];
  const def = table.defs[source.defId];
  const choices = activatedAbilityLines(def, source.faceIndex)
    .filter((line) =>
      line.activationZones
        ? line.activationZones.some((zone) => zone === source.zone)
        : source.zone === 'battlefield',
    )
    .filter(
      (line) =>
        !parseAbilityIR(line.text, def.typeLine).effects.some(
          (effect) => effect.atom === 'effect.add-mana',
        ),
    )
    .map((line) => {
      const cost = compileAbilityCost(parseAbilityIR(line.text, def.typeLine).cost, {
        sourceId,
        controllerId: source.controllerId,
        def,
      });
      return {
        key: String(line.index),
        label: line.keywordLabel ?? line.costText,
        text: line.effectText,
        costText: line.costText,
        manaCost: cost.manaCost ?? '',
        commands: cost.commands,
        manual: cost.decision === 'manual',
      };
    });
  const cycling = source.zone === 'hand' ? cyclingCost(def) : null;
  if (cycling)
    choices.push({
      key: 'cycling',
      label: 'サイクリング',
      text: 'Draw a card.',
      costText: `${cycling}, このカードを捨てる`,
      manaCost: cycling,
      commands: [{ type: 'moveCard', cardId: sourceId, to: 'graveyard', position: 'top' }],
      manual: false,
    });
  return choices;
}
export interface TableManualCosts {
  manaCost: string;
  tapIds: string[];
  sacrificeIds: string[];
  discardIds: string[];
  returnIds: string[];
  exileIds: string[];
  life: number;
  counters: { cardId: string; name: string; count: number }[];
  note: string;
}
export const emptyManualCosts = (): TableManualCosts => ({
  manaCost: '',
  tapIds: [],
  sacrificeIds: [],
  discardIds: [],
  returnIds: [],
  exileIds: [],
  life: 0,
  counters: [],
  note: '',
});
