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

interface HistoryInput {
  action: 'undo' | 'redo' | 'restore' | 'baseline';
}

export type PresentationProjectionInput =
  | CastInput
  | PlayLandInput
  | AdvanceTurnInput
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

export type PresentationEvent =
  | SpellCastEvent
  | CommanderCastEvent
  | LandPlayedEvent
  | TurnAdvancedEvent;

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
    default:
      return null;
  }
}
