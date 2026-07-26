/**
 * presentationRuntime — AV3 session runtime: projection + sequencing + future-only delivery.
 * docs/audio-visual-contract.md §2.1.
 *
 * Combines AV1 projection (projectPresentationEvent) and sequencing
 * (createPresentationEventSequencer + createPresentationEventChannel) into a
 * single publish/subscribe runtime. Reload/remount/history cannot replay old
 * events: subscribers receive only events published after their subscription.
 */

import {
  projectPresentationEvent,
  type PresentationProjectionInput,
} from './presentationEvents';
import {
  createPresentationEventSequencer,
  createPresentationEventChannel,
  type SequencedPresentationEvent,
  type PresentationEventListener,
} from './presentationSequencer';

export interface PresentationRuntime {
  publish(input: PresentationProjectionInput): SequencedPresentationEvent | null;
  subscribe(listener: PresentationEventListener): () => void;
}

export function createPresentationRuntime(
  sessionNonce: string,
  clock: () => number,
): PresentationRuntime {
  const sequencer = createPresentationEventSequencer(sessionNonce, clock);
  const channel = createPresentationEventChannel();

  return {
    publish(input: PresentationProjectionInput): SequencedPresentationEvent | null {
      const projected = projectPresentationEvent(input);
      if (!projected) return null;
      const sequenced = sequencer.next(projected);
      channel.publish(sequenced);
      return sequenced;
    },
    subscribe(listener: PresentationEventListener): () => void {
      return channel.subscribe(listener);
    },
  };
}

let sessionNonceCounter = 0;

function browserSessionNonce(): string {
  sessionNonceCounter += 1;
  return `browser-${sessionNonceCounter}`;
}

function defaultClock(): number {
  return performance.now();
}

/**
 * Browser-session singleton. Survives React remount within the same page
 * session. Never persisted to snapshot/save/undo history.
 */
export const presentationRuntime: PresentationRuntime = createPresentationRuntime(
  browserSessionNonce(),
  defaultClock,
);
