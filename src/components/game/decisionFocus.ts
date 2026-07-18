import type { PlayerId } from '../../engine/types';

export type DecisionFocusKind =
  | 'target'
  | 'sacrifice'
  | 'discard'
  | 'cost'
  | 'attack'
  | 'payment'
  | 'warning';

export interface DecisionFocusModel {
  kind: DecisionFocusKind;
  title: string;
  instruction: string;
  sourceId?: string;
  candidateIds: readonly string[];
  selectedIds: readonly string[];
  requiredCount?: number;
  canConfirm?: boolean;
  canForce?: boolean;
  playerIds?: readonly PlayerId[];
  warning?: string;
}

export type DecisionCardRole = 'source' | 'candidate' | 'selected' | 'force' | 'unrelated';

export function decisionCardRole(model: DecisionFocusModel | null | undefined, cardId: string): DecisionCardRole | null {
  if (!model) return null;
  if (model.selectedIds.includes(cardId)) return 'selected';
  if (model.kind === 'warning' && model.sourceId === cardId) return 'force';
  if (model.sourceId === cardId) return 'source';
  if (model.candidateIds.includes(cardId)) return 'candidate';
  return 'unrelated';
}
