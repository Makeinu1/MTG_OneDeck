import { splitAbilityLines } from '../../engine/grammar';
import type { GameState } from '../../engine/types';
import type { TriggerCandidate } from '../../engine/triggers';

export type TriggerDirectAction =
  | { kind: 'none' }
  | { kind: 'place'; candidate: TriggerCandidate }
  | { kind: 'sheet' };

function candidateNeedsPlacementChoice(
  state: GameState,
  candidate: TriggerCandidate,
): boolean {
  if (candidate.abilityLineIndex === undefined) return false;
  const source = state.cards[candidate.sourceId];
  const def = source ? state.defs[source.defId] : undefined;
  const line = def ? splitAbilityLines(def)[candidate.abilityLineIndex] : undefined;
  // CR 603.3d -> 601.2c: targets are chosen as the triggered ability is
  // put on the stack. Keep those abilities on the explicit sheet path.
  return /\btargets?\b/i.test(line?.text ?? '');
}

export function triggerDirectAction(
  state: GameState,
  candidates: readonly TriggerCandidate[],
): TriggerDirectAction {
  if (candidates.length === 0) return { kind: 'none' };
  if (candidates.length !== 1) return { kind: 'sheet' };
  const candidate = candidates[0];
  return candidateNeedsPlacementChoice(state, candidate)
    ? { kind: 'sheet' }
    : { kind: 'place', candidate };
}
