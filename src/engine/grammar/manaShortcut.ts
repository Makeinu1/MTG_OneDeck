/**
 * manaShortcut — single recognizer for producedMana-driven shortcut eligibility
 * (autotap / tapForMana / actionCatalog "tap for mana" affordance).
 *
 * CR118.3 (no partial cost payment) / CR602.2 (activation is cost payment + effect,
 * atomically) / CR605.1a (mana abilities don't use the stack): a shortcut that skips
 * activateAbility may only apply to activated mana abilities whose entire cost is
 * `{T}` — anything with an additional cost (sacrifice, mana, discard, ...) must route
 * through the general activateAbility → mana-ability transaction path so the cost is
 * paid atomically with the effect.
 */
import type { CardDef, ManaColor } from '../../types/card';
import { stripAbilityWordLabel } from './compile';
import { splitAbilityLines } from './index';
import { parseAbilityIR } from './ir';

interface NaiveManaInfo {
  hasActivatedAddManaLine: boolean;
  colors: ManaColor[];
  outputs: NaiveManaOutput[];
}

export type NaiveManaOutput = Partial<Record<ManaColor, number>>;

const infoCache = new WeakMap<CardDef, NaiveManaInfo>();

function dedupe(colors: readonly ManaColor[]): ManaColor[] {
  const seen = new Set<ManaColor>();
  const result: ManaColor[] = [];
  for (const color of colors) {
    if (!seen.has(color)) {
      seen.add(color);
      result.push(color);
    }
  }
  return result;
}

function producedManaColors(def: CardDef): ManaColor[] {
  return dedupe(def.producedMana ?? []);
}

const MANA_AMOUNT_WORDS = new Map<string, number>([
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

function outputForSymbols(raw: string): NaiveManaOutput | null {
  const colors = [...raw.matchAll(/\{([WUBRGC])\}/gi)].map(
    (match) => match[1].toUpperCase() as ManaColor,
  );
  if (colors.length === 0) return null;
  const output: NaiveManaOutput = {};
  for (const color of colors) {
    output[color] = (output[color] ?? 0) + 1;
  }
  return output;
}

function amountToken(raw: string): number | null {
  const normalized = raw.toLowerCase();
  if (/^\d+$/.test(normalized)) return Number.parseInt(normalized, 10);
  return MANA_AMOUNT_WORDS.get(normalized) ?? null;
}

function selectableSingleColorOutputs(
  colors: readonly ManaColor[],
  amount: number,
): NaiveManaOutput[] {
  return colors.map((color) => ({ [color]: amount }));
}

function combinationOutputs(colors: readonly ManaColor[], amount: number): NaiveManaOutput[] {
  const outputs: NaiveManaOutput[] = [];
  const current: NaiveManaOutput = {};
  const fill = (colorIndex: number, remaining: number): void => {
    if (colorIndex === colors.length - 1) {
      if (remaining > 0) current[colors[colorIndex]] = remaining;
      else delete current[colors[colorIndex]];
      outputs.push({ ...current });
      delete current[colors[colorIndex]];
      return;
    }
    for (let count = 0; count <= remaining; count++) {
      if (count > 0) current[colors[colorIndex]] = count;
      else delete current[colors[colorIndex]];
      fill(colorIndex + 1, remaining - count);
    }
    delete current[colors[colorIndex]];
  };
  if (colors.length > 0 && amount >= 0) fill(0, amount);
  return outputs;
}

export function manaOutputsForAddManaClause(raw: string, def: CardDef): NaiveManaOutput[] {
  const anyCombination = /\badd\s+([A-Za-z]+|\d+)\s+mana\s+in\s+any\s+combination\s+of\s+(.+)/i.exec(raw);
  if (anyCombination) {
    const amount = amountToken(anyCombination[1]);
    const colors = dedupe(
      [...anyCombination[2].matchAll(/\{([WUBRGC])\}/gi)].map(
        (match) => match[1].toUpperCase() as ManaColor,
      ),
    );
    if (amount !== null && colors.length > 0) return combinationOutputs(colors, amount);
  }

  const anyOneColor = /\badd\s+([A-Za-z]+|\d+)\s+mana\s+of\s+any(?:\s+one)?\s+color\b/i.exec(raw);
  if (anyOneColor) {
    const amount = amountToken(anyOneColor[1]);
    if (amount !== null) {
      return selectableSingleColorOutputs(producedManaColors(def), amount);
    }
  }

  if (/\bor\b|\band\/or\b/i.test(raw)) {
    const addClause = raw.replace(/^.*?\bAdd\s+/i, '').split(/\.(?:\s|$)/, 1)[0];
    const groups = addClause.split(/\s*,\s*(?:or\s+)?|\s+or\s+/i);
    const outputs = groups
      .map(outputForSymbols)
      .filter((output): output is NaiveManaOutput => output !== null);
    if (outputs.length > 0) return outputs;
  }

  const literal = outputForSymbols(raw);
  return literal ? [literal] : [];
}

function singletonOutputs(colors: readonly ManaColor[]): NaiveManaOutput[] {
  return colors.map((color) => ({ [color]: 1 }));
}

function outputColors(outputs: readonly NaiveManaOutput[]): ManaColor[] {
  return dedupe(
    outputs.flatMap((output) =>
      (Object.keys(output) as ManaColor[]).filter((color) => (output[color] ?? 0) > 0),
    ),
  );
}

const BASIC_LAND_TYPE_COLORS: ReadonlyArray<readonly [RegExp, ManaColor]> = [
  [/\bPlains\b/, 'W'],
  [/\bIsland\b/, 'U'],
  [/\bSwamp\b/, 'B'],
  [/\bMountain\b/, 'R'],
  [/\bForest\b/, 'G'],
];

// CR 305.6: a land with a basic land type has the intrinsic ability
// "{T}: Add [mana symbol]" regardless of its printed text. Reminder-only
// lines like "({T}: Add {G}.)" are stripped by sanitizeLine, so the type
// line is the only reliable source for these colors.
export function intrinsicBasicLandColors(def: CardDef): ManaColor[] {
  const colors: ManaColor[] = [];
  const typeLines = [def.typeLine, ...def.faces.map((face) => face.typeLine)];
  for (const typeLine of typeLines) {
    if (!typeLine || !/\bLand\b/.test(typeLine)) {
      continue;
    }
    for (const [probe, color] of BASIC_LAND_TYPE_COLORS) {
      if (probe.test(typeLine)) {
        colors.push(color);
      }
    }
  }
  return dedupe(colors);
}

// CR 118.3/602.2 gate: a line is naive-eligible only when its entire cost is
// "{T}". Ability-word labels (CR 207.2c) carry no rules meaning and are
// stripped before the comparison.
function isPureTapCost(raw: string | undefined): boolean {
  if (raw === undefined) {
    return false;
  }
  return stripAbilityWordLabel(raw).trim() === '{T}';
}

function computeNaiveManaInfo(def: CardDef): NaiveManaInfo {
  const intrinsic = intrinsicBasicLandColors(def);
  const activatedAddManaLines = splitAbilityLines(def)
    .filter((line) => line.shape === 'activated')
    .map((line) => ({
      line,
      ir: parseAbilityIR(line.text, def.faces[line.faceIndex]?.typeLine ?? def.typeLine),
    }))
    .filter(({ ir }) => ir.effects.some((effect) => effect.atom === 'effect.add-mana'));

  if (activatedAddManaLines.length === 0) {
    const outputs = singletonOutputs(dedupe([...intrinsic, ...producedManaColors(def)]));
    return {
      hasActivatedAddManaLine: false,
      colors: outputColors(outputs),
      outputs,
    };
  }

  const pureLines = activatedAddManaLines.filter(({ ir }) => isPureTapCost(ir.cost?.raw));
  if (pureLines.length === 0) {
    const outputs = singletonOutputs(intrinsic);
    return { hasActivatedAddManaLine: true, colors: outputColors(outputs), outputs };
  }

  const outputs: NaiveManaOutput[] = singletonOutputs(intrinsic);
  for (const { ir } of pureLines) {
    const lineOutputs = ir.effects
      .filter((effect) => effect.atom === 'effect.add-mana')
      .flatMap((effect) => manaOutputsForAddManaClause(effect.raw, def));
    outputs.push(
      ...(lineOutputs.length === 0 ? singletonOutputs(producedManaColors(def)) : lineOutputs),
    );
  }

  return { hasActivatedAddManaLine: true, colors: outputColors(outputs), outputs };
}

function naiveManaInfo(def: CardDef): NaiveManaInfo {
  const cached = infoCache.get(def);
  if (cached) {
    return cached;
  }
  const info = computeNaiveManaInfo(def);
  infoCache.set(def, info);
  return info;
}

/**
 * Colors the producedMana shortcut may naively tap+add for, without routing through
 * activateAbility. Empty when the card has costed activated add-mana lines and no pure
 * `{T}` line contributes any color (e.g. Lotus Petal, filter lands).
 */
export function naiveTapManaColors(def: CardDef | undefined): ManaColor[] {
  if (!def) {
    return [];
  }
  return naiveManaInfo(def).colors;
}

/** Exact mana bundles produced by one pure-{T} activation. */
export function naiveTapManaOutputs(def: CardDef | undefined): readonly NaiveManaOutput[] {
  if (!def) return [];
  return naiveManaInfo(def).outputs;
}

/** True when the card has at least one activated ability line whose effect adds mana. */
export function hasActivatedAddManaLine(def: CardDef | undefined): boolean {
  if (!def) {
    return false;
  }
  return naiveManaInfo(def).hasActivatedAddManaLine;
}
