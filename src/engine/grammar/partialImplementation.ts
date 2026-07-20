import type { CardDef } from '../../types/card';
import { splitAbilityLines } from './index';
import { parseAbilityIR } from './ir';
import { compileAbilityIR } from './compile';

const cache = new Map<string, boolean>();

/**
 * Returns true if the card has a mix of automated (auto/guided) and manual
 * ability lines — i.e. "partially implemented". Used to surface a toast
 * warning when the player taps such a card for mana.
 */
export function isPartiallyImplemented(def: CardDef): boolean {
  const cached = cache.get(def.scryfallId);
  if (cached !== undefined) return cached;

  const lines = splitAbilityLines(def);
  if (lines.length === 0) {
    cache.set(def.scryfallId, false);
    return false;
  }

  let hasAutomated = false;
  let hasManual = false;
  for (const line of lines) {
    const ir = parseAbilityIR(line.text, def.typeLine);
    const compiled = compileAbilityIR(ir, { sourceId: '__check__', def });
    if (compiled.decision === 'manual') {
      hasManual = true;
    } else {
      hasAutomated = true;
    }
    if (hasAutomated && hasManual) break;
  }

  const result = hasAutomated && hasManual;
  cache.set(def.scryfallId, result);
  return result;
}
