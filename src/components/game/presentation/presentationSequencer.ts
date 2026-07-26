/**
 * presentationSequencer — AV1 session sequencing and future-only delivery.
 * ID = `<session nonce>:<shared increasing sequence>`.
 * committedAtMs from injectable monotonic clock; not identity.
 * Channel delivers only future events; republishing the same ID is at-most-once.
 */

import type { PresentationEvent } from './presentationEvents';

export type SequencedPresentationEvent = PresentationEvent & {
  id: string;
  committedAtMs: number;
};

export interface PresentationEventSequencer {
  next(event: PresentationEvent): SequencedPresentationEvent;
}

export function createPresentationEventSequencer(
  sessionNonce: string,
  clock: () => number,
): PresentationEventSequencer {
  let sequence = 0;
  return {
    next(event: PresentationEvent): SequencedPresentationEvent {
      sequence += 1;
      return {
        ...event,
        id: `${sessionNonce}:${sequence}`,
        committedAtMs: clock(),
      };
    },
  };
}

export type PresentationEventListener = (event: SequencedPresentationEvent) => void;

export interface PresentationEventChannel {
  publish(event: SequencedPresentationEvent): void;
  subscribe(listener: PresentationEventListener): () => void;
}

export function createPresentationEventChannel(): PresentationEventChannel {
  const listeners = new Set<PresentationEventListener>();
  const delivered = new Set<string>();

  return {
    publish(event: SequencedPresentationEvent): void {
      if (delivered.has(event.id)) return;
      delivered.add(event.id);
      for (const listener of listeners) {
        listener(event);
      }
    },
    subscribe(listener: PresentationEventListener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
