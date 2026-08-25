import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import type {
  AbilityKind,
  GameState,
  ManualTargetZone,
  PlayerId,
  ZoneId,
} from '../../engine/types';
import type { TriggerCandidate } from '../../engine/triggers';
import type { ManaColor } from '../../types/card';
import type { DecisionFocusModel } from './decisionFocus';
import type { DropIntent } from './dragIntent';
import type { TransitionCueData } from './transitionCueModel';
import type { CommanderCutInData } from './CommanderCutIn';

export type GameScreenMenuTriggerEvent =
  | ReactMouseEvent<HTMLElement>
  | ReactPointerEvent<HTMLElement>;

export interface ResolutionSessionPresentation {
  readonly stage: 'resolving' | 'manual-required';
  readonly tasks: readonly {
    readonly id: string;
    readonly message: string;
  }[];
}

/**
 * The complete UI-facing seam for the single adaptive GameScreen surface.
 * Local state management is an adapter detail of useGameController.
 */
export interface GameScreenInteractionPort {
  state: GameState | null;
  warnings: readonly string[];
  triggerCandidates: readonly TriggerCandidate[];
  resolutionSession: ResolutionSessionPresentation | null;
  guidedDecisionActive: boolean;
  mulliganDecisionPending: boolean;
  autoAdvanceToMain: boolean;

  openCardMenu: (cardId: string, event: GameScreenMenuTriggerEvent) => void;
  openCardMenuAt?: (cardId: string, x: number, y: number) => void;
  handleCardDoubleClick: (cardId: string, event: ReactMouseEvent) => void;
  requestTapForMana: (cardId: string) => void;
  requestActivateAbility: (cardId: string, abilityLineIndex?: number) => void;
  requestDraw: (count: number) => void;
  requestShuffleLibrary: () => void;
  requestMulligan: () => void;
  requestKeepHand: () => void;
  requestToggleTap: (cardId: string) => void;
  requestToggleTapMany?: (cardIds: readonly string[]) => boolean;
  requestSetAllTapped: (tapped: boolean) => void;
  requestResolveTop: () => void;
  requestResolveAll: () => void;
  advancePhase: () => void;
  advanceTurn: () => void;
  runPrimaryAction?: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  setManualTargets: (
    stackItemId: string,
    targetIds: string[],
    targetPlayerIds?: PlayerId[],
    allowedZones?: ManualTargetZone[],
  ) => void;

  confirmGuidedZeroChoice: () => void;
  removeStackItem: (id: string, to?: ZoneId) => void;
  completeManualResolution: () => void;
  placePendingTriggersForPriority: (pendingTriggerIds: string[]) => void;
  putPendingTriggerOnStack: (pendingTriggerId: string) => void;
  addAbilityToStack: (
    sourceId: string,
    kind: AbilityKind,
    abilityLineIndex?: number,
  ) => void;
  resolveCommanderRitualCue: (cardId: string) => CommanderCutInData | null;

  adjustLife: (delta: number) => void;
  adjustMana: (color: ManaColor, delta: number) => void;
  clearManaPool: () => void;
  adjustPlayerCounter: (
    kind: 'poison' | 'energy' | 'experience',
    delta: number,
  ) => void;
  setMaximumHandSizeOverride: (value: number | 'none' | undefined) => void;
  adjustOpponentLife: (label: string, delta: number) => void;
  adjustCommanderDamage: (label: string, delta: number) => void;
  proliferateAll: () => void;
  rollDie: (sides: number) => void;
  flipCoin: () => void;
  setAutoAdvance: (on: boolean) => void;
  dismissTriggerCandidates: () => void;
  clearWarnings: () => void;

  openLibraryActions: (event: GameScreenMenuTriggerEvent) => void;
  libraryActionsOpen: boolean;
  openZoneViewer: (zone: 'graveyard' | 'exile' | 'library') => void;
  opponentBoardOpen: boolean;
  openOpponentBoard: () => void;
  closeOpponentBoard: () => void;
  openTokenDialog: () => void;
  openAttackDialog: () => void;
  openArrangeTop: () => void;
  openCountDialog: (
    kind: 'draw' | 'mill' | 'peek' | 'discard-random',
    defaultValue: number,
  ) => void;
  requestConfirm: (action: 'restart' | 'back-to-import') => void;
  triggerCandidateCount: number;
  triggerSheetOpen?: boolean;
  processTriggers?: () => void;
  closeTriggerSheet?: () => void;
  motionArmed: boolean;
  feedOpen: boolean;
  openFeed: () => void;
  closeFeed: () => void;
  overlays: ReactNode;
  shortcutsBlocked: boolean;
  transitionCue: TransitionCueData | null;
  dismissTransitionCue: (id: number) => void;
  performDrop: (intent: DropIntent) => void;
  closeTransientUi: () => void;

  decisionFocus?: DecisionFocusModel | null;
  chooseDecisionCard?: (cardId: string) => void;
  chooseDecisionPlayer?: (playerId: PlayerId) => void;
  cancelDecision?: () => void;
  mulliganActive?: boolean;
  teamworkInfo?: {
    threshold: number;
    selectedIds: readonly string[];
    totalPower: number;
    canConfirm: boolean;
  } | null;
  toggleTeamworkCreature?: (cardId: string) => void;
  confirmTeamwork?: () => void;
  declineTeamwork?: () => void;
}
