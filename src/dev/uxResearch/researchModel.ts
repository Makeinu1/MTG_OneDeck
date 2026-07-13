import { SNAPSHOT_VERSION, type GameSnapshot } from '../../data/gameSnapshot';
import type { GameState } from '../../engine/types';
import type { PendingGuidedResolution } from '../../store/gameStore';
import {
  RESEARCH_DECK_IDS,
  UX_RESEARCH_VERSION,
  type ResearchCheckpoint,
  type ResearchCheckpointReason,
  type CaptureCriterion,
  type ResearchDeckId,
  type ResearchEvidence,
  type ResearchInteraction,
  type ResearchInteractionKind,
  type ResearchPhase,
  type ResearchTransientState,
  type UiResearchSession,
} from './types';

function uniqueId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function inferResearchDeckId(state: GameState): ResearchDeckId {
  for (const card of Object.values(state.cards)) {
    if (!card.isCommander) continue;
    const def = state.defs[card.defId];
    const name = def?.name ?? '';
    const matched = RESEARCH_DECK_IDS.find((deckId) => name.includes(deckId));
    if (matched) return matched;
  }
  return 'Celes';
}

export function createResearchSession(input: {
  deckId: ResearchDeckId;
  phase: ResearchPhase;
  startedAt: Date;
  viewport: { width: number; height: number };
  taskId?: string;
}): UiResearchSession {
  return {
    version: UX_RESEARCH_VERSION,
    sessionId: uniqueId('session'),
    deckId: input.deckId,
    phase: input.phase,
    startedAt: input.startedAt.toISOString(),
    viewport: input.viewport,
    checkpoints: [],
    interactions: [],
    ...(input.taskId ? { taskId: input.taskId } : {}),
  };
}

export function createResearchTransient(input: {
  mulliganDecisionPending: boolean;
  warnings: string[];
  pendingGuided: PendingGuidedResolution | null;
  feedOpen: boolean;
  shortcutsBlocked: boolean;
}): ResearchTransientState {
  return {
    mulliganDecisionPending: input.mulliganDecisionPending,
    warnings: input.warnings.slice(),
    pendingGuided: input.pendingGuided,
    feedOpen: input.feedOpen,
    shortcutsBlocked: input.shortcutsBlocked,
  };
}

export function createResearchCheckpoint(input: {
  elapsedMs: number;
  reason: ResearchCheckpointReason;
  state: GameState;
  autoAdvanceToMain: boolean;
  transient: ResearchTransientState;
  note?: string;
  captureCriterion?: CaptureCriterion;
  evidence?: ResearchEvidence;
}): ResearchCheckpoint {
  const snapshot: GameSnapshot = {
    version: SNAPSHOT_VERSION,
    state: input.state,
    deck: [],
    autoAdvanceToMain: input.autoAdvanceToMain,
  };
  const evidence: ResearchEvidence | undefined = input.evidence
    ? {
      ...(input.evidence.observation?.trim()
        ? { observation: input.evidence.observation.trim() }
        : {}),
      ...(input.evidence.userStatement?.trim()
        ? { userStatement: input.evidence.userStatement.trim() }
        : {}),
      ...(input.evidence.interpretation?.trim()
        ? { interpretation: input.evidence.interpretation.trim() }
        : {}),
      ...(input.evidence.hypothesis?.trim()
        ? { hypothesis: input.evidence.hypothesis.trim() }
        : {}),
    }
    : undefined;
  return {
    id: uniqueId('checkpoint'),
    elapsedMs: input.elapsedMs,
    reason: input.reason,
    snapshot,
    transient: input.transient,
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    ...(input.captureCriterion ? { captureCriterion: input.captureCriterion } : {}),
    ...(evidence && Object.keys(evidence).length > 0 ? { evidence } : {}),
  };
}

function editableTarget(target: Element | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target?.getAttribute('contenteditable') === 'true'
  );
}

function closestTestId(target: Element | null): string | undefined {
  return target?.closest<HTMLElement>('[data-testid]')?.dataset.testid;
}

function cardIdFromTestId(testId: string | undefined): string | undefined {
  return testId?.startsWith('card-') ? testId.slice('card-'.length) : undefined;
}

export function researchInteractionFromEvent(input: {
  event: Event;
  elapsedMs: number;
  state: GameState;
}): ResearchInteraction | null {
  const target = input.event.target instanceof Element ? input.event.target : null;
  if (target?.closest('[data-ux-research-recorder]')) return null;

  const kind = input.event.type as ResearchInteractionKind;
  if (kind === 'keydown' && editableTarget(target)) return null;

  const testId = closestTestId(target);
  const cardId = cardIdFromTestId(testId);
  const card = cardId ? input.state.cards[cardId] : undefined;
  const interaction: ResearchInteraction = {
    id: uniqueId('interaction'),
    elapsedMs: input.elapsedMs,
    kind,
    ...(testId ? { testId } : {}),
    ...(cardId ? { cardId } : {}),
    ...(card ? { zone: card.zone } : {}),
  };

  if (input.event instanceof MouseEvent) {
    interaction.x = Math.round(input.event.clientX);
    interaction.y = Math.round(input.event.clientY);
    const relatedTarget =
      input.event.relatedTarget instanceof Element ? input.event.relatedTarget : null;
    const relatedTestId = closestTestId(relatedTarget);
    if (relatedTestId) interaction.relatedTestId = relatedTestId;
  }
  if (typeof PointerEvent !== 'undefined' && input.event instanceof PointerEvent) {
    interaction.pointerType = input.event.pointerType;
  }
  if (input.event instanceof KeyboardEvent) {
    interaction.key = input.event.key;
    interaction.ctrlKey = input.event.ctrlKey;
    interaction.metaKey = input.event.metaKey;
    interaction.shiftKey = input.event.shiftKey;
  }
  return interaction;
}
