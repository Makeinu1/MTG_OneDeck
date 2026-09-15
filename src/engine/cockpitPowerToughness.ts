import type { CockpitTable } from './cockpitTable';

export interface RecordedPowerToughness {
  power: number | null;
  toughness: number | null;
}

/** Read-only, recorded P/T: numeric face + supported counters + explicit additive modifiers.
 * This is not a continuous-effect/layer evaluator. Unknown or hidden values stay unknown.
 */
export function cockpitPowerToughness(
  table: CockpitTable,
  cardId: string,
): RecordedPowerToughness | undefined {
  const card = table.cards[cardId];
  if (!card || card.faceDown) return undefined;
  const face = table.defs[card.defId]?.faces[card.faceIndex];
  if (
    !face ||
    (!/\bCreature\b/.test(face.typeLine) &&
      face.power === undefined &&
      face.toughness === undefined)
  )
    return undefined;
  const counter =
    card.zone === 'battlefield' ? (card.counters['+1/+1'] ?? 0) - (card.counters['-1/-1'] ?? 0) : 0;
  const modifiers =
    card.zone === 'battlefield'
      ? table.modifiers.filter((modifier) => modifier.cardId === cardId)
      : [];
  const value = (printed: string | undefined, field: 'power' | 'toughness'): number | null => {
    if (!printed || !/^[+-]?\d+$/.test(printed.trim())) return null;
    const result =
      Number(printed) + counter + modifiers.reduce((sum, modifier) => sum + modifier[field], 0);
    return Number.isSafeInteger(result) ? result : null;
  };
  return { power: value(face.power, 'power'), toughness: value(face.toughness, 'toughness') };
}
