import type { GameState, PendingTrigger } from './types';

export type TriggerReviewReason =
  | 'ability-identity-ambiguous'
  | 'trigger-condition-unsupported'
  | 'event-semantics-insufficient';

export type TriggerDetectionDecision =
  | {
      kind: 'deterministic';
      occurrenceKey: string;
      pending: PendingTrigger;
      restrictionKey?: string;
    }
  | {
      kind: 'review';
      occurrenceKey: string;
      pending: PendingTrigger;
      reason: TriggerReviewReason;
      restrictionKey?: string;
    };

export interface TriggerOccurrenceMaterialization {
  state: GameState;
  pendingTrigger: PendingTrigger;
  created: boolean;
}

/**
 * R5a-1 detection boundary. This function deliberately classifies only facts
 * the current engine can prove. Unsupported semantics become durable review
 * obligations at the Cockpit layer instead of being treated as occurrences.
 */
export function classifyTriggerDetection(
  pending: PendingTrigger,
  abilityText: string | undefined,
  restrictionKey?: string,
): TriggerDetectionDecision {
  const base = {
    occurrenceKey: pending.pendingTriggerId,
    pending,
    ...(restrictionKey === undefined ? {} : { restrictionKey }),
  };

  if (pending.abilityLineIndex === undefined || !abilityText) {
    return { ...base, kind: 'review', reason: 'ability-identity-ambiguous' };
  }
  if (/\bone or more\b/i.test(abilityText)) {
    return { ...base, kind: 'review', reason: 'event-semantics-insufficient' };
  }
  if (/\bif\b/i.test(abilityText) && pending.condition === undefined) {
    return { ...base, kind: 'review', reason: 'trigger-condition-unsupported' };
  }
  if (/\bnext\b/i.test(abilityText) && pending.schedule === undefined) {
    return { ...base, kind: 'review', reason: 'trigger-condition-unsupported' };
  }
  return { ...base, kind: 'deterministic' };
}

/**
 * The single R5a-1 occurrence materialization boundary.
 *
 * Review candidates must not call this until a human confirms that the
 * trigger actually occurred. Both deterministic detection and confirmed
 * review use this same idempotent path. Occurrence restrictions are consumed
 * only here, never merely because a candidate was detected.
 */
export function materializeTriggerOccurrence(
  state: GameState,
  decision: TriggerDetectionDecision,
): TriggerOccurrenceMaterialization {
  const existing = state.pendingTriggers.find(
    (trigger) => trigger.pendingTriggerId === decision.occurrenceKey,
  );
  if (existing) {
    return { state, pendingTrigger: existing, created: false };
  }

  const ledger =
    state.oncePerTurnTriggerLedger.turn === state.turn
      ? state.oncePerTurnTriggerLedger
      : { turn: state.turn, consumedKeys: [] };
  if (decision.restrictionKey && ledger.consumedKeys.includes(decision.restrictionKey)) {
    throw new Error('この誘発はこのターンすでに発生済みです。');
  }

  const pendingTrigger = {
    ...decision.pending,
    pendingTriggerId: decision.occurrenceKey,
  };
  const nextLedger = decision.restrictionKey
    ? { ...ledger, consumedKeys: [...ledger.consumedKeys, decision.restrictionKey] }
    : ledger;
  return {
    state: {
      ...state,
      pendingTriggers: [...state.pendingTriggers, pendingTrigger],
      oncePerTurnTriggerLedger: nextLedger,
    },
    pendingTrigger,
    created: true,
  };
}
