/**
 * presentationEvents — AV1 pure semantic projection.
 * docs/audio-visual-contract.md §2 decision table.
 * Projects successful forward game actions into transient PresentationEvents.
 * No log parsing, no engine API dependency, no React.
 */

export type PresentationActionStatus =
  | 'committed'
  | 'failed'
  | 'cancelled'
  | 'needs-confirm'
  | 'needs-payment';

interface CastInput {
  action: 'cast';
  status: PresentationActionStatus;
  cardId: string;
  sourceZone: string;
  destinationZone: string;
  isCommander: boolean;
  sourceEventId: string;
}

interface PlayLandInput {
  action: 'play-land';
  status: PresentationActionStatus;
  cardId: string;
  sourceZone: string;
  destinationZone: string;
}

interface AdvanceTurnInput {
  action: 'advance-turn';
  status: PresentationActionStatus;
  previousTurn: number;
  nextTurn: number;
}

interface DrawInput {
  action: 'draw';
  status: PresentationActionStatus;
  requestedCount: number;
  completedCount: number;
}

interface ChangeTapInput {
  action: 'change-tap';
  status: PresentationActionStatus;
  cardIds: string[];
  tapped: boolean;
}

interface ResolveStackInput {
  action: 'resolve-stack';
  status: PresentationActionStatus;
  resolvedCount: number;
}

interface ShuffleLibraryInput {
  action: 'shuffle-library';
  status: PresentationActionStatus;
}

interface HistoryInput {
  action: 'undo' | 'redo' | 'restore' | 'baseline';
}

export type PresentationProjectionInput =
  | CastInput
  | PlayLandInput
  | AdvanceTurnInput
  | DrawInput
  | ChangeTapInput
  | ResolveStackInput
  | ShuffleLibraryInput
  | HistoryInput;

export interface SpellCastEvent {
  kind: 'spell-cast';
  cardId: string;
  sourceZone: string;
  destinationZone: string;
  sourceEventId: string;
}

export interface CommanderCastEvent {
  kind: 'commander-cast';
  cardId: string;
  sourceZone: string;
  destinationZone: string;
  sourceEventId: string;
}

export interface LandPlayedEvent {
  kind: 'land-played';
  cardId: string;
  sourceZone: string;
  destinationZone: string;
}

export interface TurnAdvancedEvent {
  kind: 'turn-advanced';
  turn: number;
}

export interface DrawCompletedEvent {
  kind: 'draw-completed';
  count: number;
}

export interface TapChangedEvent {
  kind: 'tap-changed';
  cardIds: string[];
  tapped: boolean;
}

export interface StackResolvedEvent {
  kind: 'stack-resolved';
  count: number;
}

export interface ShuffleCompletedEvent {
  kind: 'shuffle-completed';
}

export type PresentationEvent =
  | SpellCastEvent
  | CommanderCastEvent
  | LandPlayedEvent
  | TurnAdvancedEvent
  | DrawCompletedEvent
  | TapChangedEvent
  | StackResolvedEvent
  | ShuffleCompletedEvent;

export function projectPresentationEvent(
  input: PresentationProjectionInput,
): PresentationEvent | null {
  switch (input.action) {
    case 'cast': {
      if (input.status !== 'committed') return null;
      if (input.destinationZone !== 'stack') return null;
      if (input.isCommander) {
        return {
          kind: 'commander-cast',
          cardId: input.cardId,
          sourceZone: input.sourceZone,
          destinationZone: input.destinationZone,
          sourceEventId: input.sourceEventId,
        };
      }
      return {
        kind: 'spell-cast',
        cardId: input.cardId,
        sourceZone: input.sourceZone,
        destinationZone: input.destinationZone,
        sourceEventId: input.sourceEventId,
      };
    }
    case 'play-land': {
      if (input.status !== 'committed') return null;
      if (input.destinationZone !== 'battlefield') return null;
      return {
        kind: 'land-played',
        cardId: input.cardId,
        sourceZone: input.sourceZone,
        destinationZone: input.destinationZone,
      };
    }
    case 'advance-turn': {
      if (input.status !== 'committed') return null;
      if (input.nextTurn <= input.previousTurn) return null;
      return { kind: 'turn-advanced', turn: input.nextTurn };
    }
    case 'draw': {
      if (input.status !== 'committed' || input.completedCount <= 0) return null;
      return { kind: 'draw-completed', count: input.completedCount };
    }
    case 'change-tap': {
      if (input.status !== 'committed' || input.cardIds.length === 0) return null;
      return {
        kind: 'tap-changed',
        cardIds: [...input.cardIds],
        tapped: input.tapped,
      };
    }
    case 'resolve-stack': {
      if (input.status !== 'committed' || input.resolvedCount <= 0) return null;
      return { kind: 'stack-resolved', count: input.resolvedCount };
    }
    case 'shuffle-library': {
      if (input.status !== 'committed') return null;
      return { kind: 'shuffle-completed' };
    }
    default:
      return null;
  }
}
