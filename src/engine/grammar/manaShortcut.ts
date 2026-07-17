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
import { parseManaCost } from '../mana';
import { stripAbilityWordLabel } from './compile';
import { splitAbilityLines } from './index';
import { parseAbilityIR } from './ir';

interface NaiveManaInfo {
  hasActivatedAddManaLine: boolean;
  colors: ManaColor[];
}

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

/** Literal WUBRGC symbols appearing in an add-mana effect clause (CR106). */
function literalColorsInClause(raw: string): ManaColor[] {
  const parsed = parseManaCost(raw);
  const colors: ManaColor[] = [];
  for (const pip of parsed.pips) {
    if (pip.kind === 'color') {
      colors.push(pip.color);
    } else if (pip.kind === 'colorless') {
      colors.push('C');
    }
  }
  return dedupe(colors);
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
function intrinsicBasicLandColors(def: CardDef): ManaColor[] {
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
    return {
      hasActivatedAddManaLine: false,
      colors: dedupe([...intrinsic, ...producedManaColors(def)]),
    };
  }

  const pureLines = activatedAddManaLines.filter(({ ir }) => isPureTapCost(ir.cost?.raw));
  if (pureLines.length === 0) {
    return { hasActivatedAddManaLine: true, colors: intrinsic };
  }

  const colors: ManaColor[] = [...intrinsic];
  for (const { ir } of pureLines) {
    const literal = ir.effects
      .filter((effect) => effect.atom === 'effect.add-mana')
      .flatMap((effect) => literalColorsInClause(effect.raw));
    colors.push(...(literal.length === 0 ? producedManaColors(def) : literal));
  }

  return { hasActivatedAddManaLine: true, colors: dedupe(colors) };
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

/** True when the card has at least one activated ability line whose effect adds mana. */
export function hasActivatedAddManaLine(def: CardDef | undefined): boolean {
  if (!def) {
    return false;
  }
  return naiveManaInfo(def).hasActivatedAddManaLine;
}
