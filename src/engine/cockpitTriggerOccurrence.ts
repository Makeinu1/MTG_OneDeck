import { initGame } from './init';
import { classifyTriggerDetection, materializeTriggerOccurrence } from './triggerOccurrence';
import type { OncePerTurnTriggerLedger, PendingTrigger } from './types';

const ONCE_PER_TURN_TRIGGER_PATTERN =
  /\b(?:this ability\s+)?triggers?\s+only\s+once\s+(?:each|per)\s+turn\b/i;

export interface ReviewedTriggerOccurrence extends PendingTrigger {
  text: string;
}

function restrictionKey(turn: number, trigger: ReviewedTriggerOccurrence): string | undefined {
  if (!ONCE_PER_TURN_TRIGGER_PATTERN.test(trigger.text)) return undefined;
  const abilityKey =
    trigger.abilityLineIndex === undefined ? trigger.triggerId : `line-${trigger.abilityLineIndex}`;
  return [turn, trigger.sourceObjectId, abilityKey, trigger.controllerId].join('|');
}

/**
 * R5a-1 Cockpit adapter for a human YES ruling.
 *
 * The review row is already the durable Cockpit memory. This adapter does not
 * create a second store; it reuses the pure occurrence materialization boundary
 * solely to validate idempotency/restrictions and return the canonical ledger.
 * A review rejection must not call this function.
 */
export function materializeReviewedTriggerOccurrence(
  turn: number,
  ledger: OncePerTurnTriggerLedger,
  trigger: ReviewedTriggerOccurrence,
): OncePerTurnTriggerLedger {
  const base = initGame([], 0);
  const state = {
    ...base,
    turn,
    pendingTriggers: [],
    oncePerTurnTriggerLedger: ledger,
  };
  const decision = classifyTriggerDetection(
    trigger,
    trigger.text,
    restrictionKey(turn, trigger),
  );
  return materializeTriggerOccurrence(state, decision).state.oncePerTurnTriggerLedger;
}
