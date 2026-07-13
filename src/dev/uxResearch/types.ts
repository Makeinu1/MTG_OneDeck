import type { GameSnapshot } from '../../data/gameSnapshot';
import type { PendingGuidedResolution } from '../../store/gameStore';

export const UX_RESEARCH_VERSION = 1;

export const RESEARCH_DECK_IDS = ['Celes', 'Gogo', 'Kefka', 'Muldrotha'] as const;
export type ResearchDeckId = (typeof RESEARCH_DECK_IDS)[number];

export const RESEARCH_PHASES = [
  'owner-discovery',
  'owner-coverage',
  'prototype',
  'owner-soak',
  'external-gate',
] as const;
export type ResearchPhase = (typeof RESEARCH_PHASES)[number];

export const RESEARCH_PHASE_LABELS: Record<ResearchPhase, string> = {
  'owner-discovery': 'Owner Discovery',
  'owner-coverage': 'Owner Coverage',
  prototype: 'Prototype比較',
  'owner-soak': 'Owner Soak',
  'external-gate': 'External Gate',
};

export const RESEARCH_CHECKPOINT_REASONS = [
  'session-start',
  'manual-marker',
  'undo',
  'warning',
  'stack-opened',
  'guided-opened',
  'session-end',
] as const;
export type ResearchCheckpointReason = (typeof RESEARCH_CHECKPOINT_REASONS)[number];

export const CAPTURE_CRITERIA = [
  'severity',
  'prototype-difference',
  'deck-delight',
  'hard-to-reproduce',
  'regression-risk',
] as const;
export type CaptureCriterion = (typeof CAPTURE_CRITERIA)[number];

export const CAPTURE_CRITERION_LABELS: Record<CaptureCriterion, string> = {
  severity: 'S0/S1問題',
  'prototype-difference': 'A/B案で差が出る',
  'deck-delight': 'デッキ固有の快感',
  'hard-to-reproduce': '再現が難しい',
  'regression-risk': '回帰させたくない',
};

export interface ResearchTransientState {
  mulliganDecisionPending: boolean;
  warnings: string[];
  pendingGuided: PendingGuidedResolution | null;
  feedOpen: boolean;
  shortcutsBlocked: boolean;
}

export interface ResearchEvidence {
  observation?: string;
  userStatement?: string;
  interpretation?: string;
  hypothesis?: string;
}

export interface ResearchCheckpoint {
  id: string;
  elapsedMs: number;
  reason: ResearchCheckpointReason;
  snapshot: GameSnapshot;
  transient: ResearchTransientState;
  note?: string;
  captureCriterion?: CaptureCriterion;
  evidence?: ResearchEvidence;
}

export type ResearchInteractionKind =
  | 'pointermove'
  | 'pointerover'
  | 'pointerout'
  | 'pointerdown'
  | 'click'
  | 'dblclick'
  | 'contextmenu'
  | 'keydown';

export interface ResearchInteraction {
  id: string;
  elapsedMs: number;
  kind: ResearchInteractionKind;
  x?: number;
  y?: number;
  pointerType?: string;
  relatedTestId?: string;
  key?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  testId?: string;
  cardId?: string;
  zone?: string;
}

export interface UiResearchSession {
  version: typeof UX_RESEARCH_VERSION;
  sessionId: string;
  deckId: ResearchDeckId;
  phase: ResearchPhase;
  startedAt: string;
  endedAt?: string;
  viewport: { width: number; height: number };
  checkpoints: ResearchCheckpoint[];
  interactions: ResearchInteraction[];
  taskId?: string;
}

export type ResearchTaskKind = 'free-play' | 'experience-probe';
export type ResearchSeverity = 'none' | 'S0' | 'S1' | 'S2' | 'S3';
export type ResearchTaskOutcome = 'completed' | 'blocked' | 'not-observed';

export interface ResearchTaskMoment {
  id: string;
  label: string;
}

export interface ResearchTask {
  id: string;
  kind: ResearchTaskKind;
  deckId: ResearchDeckId;
  phase: 'owner-discovery' | 'owner-coverage';
  experienceId?: UxExperienceId;
  title: string;
  instruction: string;
  stopCondition: string;
  moments: readonly ResearchTaskMoment[];
}

export interface ResearchTaskReport {
  reportId: string;
  taskId: string;
  sessionId: string;
  submittedAt: string;
  outcome: ResearchTaskOutcome;
  severity: ResearchSeverity;
  neededHelp: boolean;
  anotherTurnScore: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  observation: string;
  userStatement: string;
  inconvenience: string;
  delight: string;
  observedMomentIds?: string[];
  reviewedAt?: string;
}

export const UX_EXPERIENCES = [
  ['opening-hand', '初手・マリガン'],
  ['discard-draw', '捨てる・引く'],
  ['commander', '統率者キャスト'],
  ['mana', 'マナ支払い'],
  ['targeting', '対象選択'],
  ['stack-response', 'スタック応答'],
  ['graveyard', '墓地利用'],
  ['sacrifice', '生け贄'],
  ['search', 'サーチ'],
  ['tokens', 'トークン'],
  ['counters', 'カウンター'],
  ['transform', '変身'],
  ['exile-use', '追放利用'],
  ['trigger-chain', '誘発連鎖'],
  ['copy', 'コピー'],
  ['dense-board', '高密度盤面'],
  ['undo-restore', 'undo・復元'],
] as const;

export type UxExperienceId = (typeof UX_EXPERIENCES)[number][0];

export const COVERAGE_STATUSES = [
  'unobserved',
  'observed',
  'friction',
  'complete',
  'delight',
] as const;
export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];

export const COVERAGE_STATUS_LABELS: Record<CoverageStatus, string> = {
  unobserved: '未発生',
  observed: '観察済み',
  friction: '迷いあり',
  complete: '完了',
  delight: '気持ちよい',
};

export interface UxCoverageEntry {
  key: string;
  deckId: ResearchDeckId;
  experienceId: UxExperienceId;
  status: CoverageStatus;
  note: string;
  updatedAt: string;
}

export function isResearchDeckId(value: unknown): value is ResearchDeckId {
  return RESEARCH_DECK_IDS.some((deckId) => deckId === value);
}

export function isResearchPhase(value: unknown): value is ResearchPhase {
  return RESEARCH_PHASES.some((phase) => phase === value);
}

export function isUxExperienceId(value: unknown): value is UxExperienceId {
  return UX_EXPERIENCES.some(([experienceId]) => experienceId === value);
}

export function isCoverageStatus(value: unknown): value is CoverageStatus {
  return COVERAGE_STATUSES.some((status) => status === value);
}
