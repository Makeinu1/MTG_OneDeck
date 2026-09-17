import { splitAbilityLines } from './grammar';
import {
  collectPendingTriggerUpdate as collectDetectedPendingTriggerUpdate,
  type TriggerCandidate,
} from './triggerDetectionCore';
import {
  classifyTriggerDetection,
  materializeTriggerOccurrence,
} from './triggerOccurrence';
import type { GameState, PendingTrigger } from './types';

const ONCE_PER_TURN_TRIGGER_PATTERN =
  /\b(?:this ability\s+)?triggers?\s+only\s+once\s+(?:each|per)\s+turn\b/i;

export * from './triggerDetectionCore';
export type { TriggerCandidate };

function abilityText(state: GameState, trigger: PendingTrigger): string | undefined {
  if (trigger.abilityLineIndex === undefined) return undefined;
  const def = state.defs[trigger.sourceSnapshot.defId];
  return def ? splitAbilityLines(def)[trigger.abilityLineIndex]?.text : undefined;
}

function occurrenceRestrictionKey(
  state: GameState,
  trigger: PendingTrigger,
  text: string | undefined,
): string | undefined {
  if (!text || !ONCE_PER_TURN_TRIGGER_PATTERN.test(text)) return undefined;
  const abilityKey =
    trigger.abilityLineIndex === undefined ? trigger.triggerId : `line-${trigger.abilityLineIndex}`;
  return [state.turn, trigger.sourceObjectId, abilityKey, trigger.controllerId].join('|');
}

export function collectPendingTriggers(prev: GameState, next: GameState): PendingTrigger[] {
  return collectPendingTriggerUpdate(prev, next).pendingTriggers;
}

/**
 * R5a-1 public collector boundary.
 *
 * The extracted detector may discover both deterministic occurrences and facts
 * that still require a human ruling. Its historical eager ledger is deliberately
 * ignored here. Only deterministic occurrences cross the materialization boundary;
 * review candidates are returned to Cockpit for durable review without consuming
 * the canonical occurrence-restriction ledger.
 */
export function collectPendingTriggerUpdate(
  prev: GameState,
  next: GameState,
): { state: GameState; pendingTriggers: PendingTrigger[] } {
  const detected = collectDetectedPendingTriggerUpdate(prev, next);
  let state = next;
  const pendingTriggers: PendingTrigger[] = [];

  for (const pending of detected.pendingTriggers) {
    const text = abilityText(next, pending);
    const restrictionKey = occurrenceRestrictionKey(next, pending, text);
    const ledger = state.oncePerTurnTriggerLedger;
    if (
      restrictionKey &&
      ledger.turn === state.turn &&
      ledger.consumedKeys.includes(restrictionKey)
    ) {
      continue;
    }

    const decision = classifyTriggerDetection(pending, text, restrictionKey);
    if (decision.kind === 'review') {
      // Cockpit persists this as a manual-ruling candidate. It is intentionally
      // not added to GameState.pendingTriggers and does not consume the ledger.
      pendingTriggers.push(pending);
      continue;
    }

    const materialized = materializeTriggerOccurrence(state, decision);
    state = materialized.state;
    if (materialized.created) pendingTriggers.push(materialized.pendingTrigger);
  }

  return { state, pendingTriggers };
}
