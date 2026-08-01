/**
 * CommanderRitualLayer — AV4 cast-time commander ritual (visual + audio).
 * docs/audio-visual-contract.md §5.
 *
 * Subscribes future-only to the browser-session presentationRuntime.
 * Reacts only to commander-cast events. Derives the cast face from the
 * already-committed store state. Renders CommanderCutIn for exactly
 * COMMANDER_RITUAL_DURATION_MS and replaces/restarts on recast.
 *
 * Audio: pre-rendered commander patch via sfxRenderer through CommanderBus
 * (only when eventsAudible),
 * MusicBus duck (only when both eventsAudible and musicAudible).
 * Motif and duck share a single beat-snap delay computed once per event.
 * Cleanup on policy-off, unmount, or replacement. No randomness, no state
 * wait, no pointer lock.
 */

import { useEffect, useRef, useState } from 'react';
import { useAudioVisual } from './audioVisualContext';
import { presentationRuntime } from './presentationRuntime';
import type { SequencedPresentationEvent } from './presentationSequencer';
import {
  getSessionAudioContext,
  getSessionCommanderLane,
  getSessionMusicLane,
  getSessionTransportPositionSec,
} from './audioVisualSession';
import {
  COMMANDER_RITUAL_DURATION_MS,
  commanderDuckEnvelope,
  shouldDuckMusic,
} from './commanderRitual';
import { playSfx, type SfxPlaybackHandle } from './sfxRenderer';
import { presentationSoundDelayMs } from './semanticSound';
import { useGameStore } from '../../../store/gameStore';
import { CommanderCutIn, type CommanderCutInData } from '../CommanderCutIn';

interface ActiveRitual {
  id: string;
  cue: CommanderCutInData;
}

export function CommanderRitualLayer() {
  const { policy } = useAudioVisual();
  const [ritual, setRitual] = useState<ActiveRitual | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const motifSourceRef = useRef<SfxPlaybackHandle | null>(null);
  const duckCancelRef = useRef<(() => void) | null>(null);
  const policyRef = useRef(policy);

  useEffect(() => {
    policyRef.current = policy;
  }, [policy]);

  useEffect(() => {
    function stopMotif(): void {
      const source = motifSourceRef.current;
      motifSourceRef.current = null;
      if (source) {
        try { source.onended = null; } catch { /* noop */ }
        try { source.stop(); } catch { /* already stopped */ }
        try { source.disconnect(); } catch { /* noop */ }
      }
    }

    function cancelDuck(): void {
      if (duckCancelRef.current) {
        duckCancelRef.current();
        duckCancelRef.current = null;
      }
    }

    function cleanup(): void {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      stopMotif();
      cancelDuck();
    }

    function playMotif(audioStartAtSec: number): void {
      const ctx = getSessionAudioContext();
      const lane = getSessionCommanderLane();
      if (!ctx || !lane) return;
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {});

      stopMotif();
      const delaySec = audioStartAtSec - ctx.currentTime;
      const source = playSfx('commander-cast', lane, ctx, Math.max(0, delaySec));
      if (source) {
        motifSourceRef.current = source;
        source.onended = () => {
          if (motifSourceRef.current === source) {
            motifSourceRef.current = null;
          }
          try { source.disconnect(); } catch { /* noop */ }
        };
      }
    }

    function scheduleDuck(startAtSec: number): void {
      const ctx = getSessionAudioContext();
      const musicLane = getSessionMusicLane();
      if (!ctx || !musicLane) return;

      cancelDuck();
      const baseGain = musicLane.gain.value;
      if (baseGain <= 0) return;

      const envelope = commanderDuckEnvelope(startAtSec, baseGain);
      const param = musicLane.gain;

      param.cancelScheduledValues(ctx.currentTime);
      param.setValueAtTime(baseGain, ctx.currentTime);
      param.setValueAtTime(baseGain, startAtSec);
      param.linearRampToValueAtTime(envelope.duckGain, envelope.attackEndSec);
      param.setValueAtTime(envelope.duckGain, envelope.holdEndSec);
      param.linearRampToValueAtTime(baseGain, envelope.releaseEndSec);

      duckCancelRef.current = () => {
        try {
          param.cancelScheduledValues(ctx.currentTime);
          param.setValueAtTime(baseGain, ctx.currentTime);
        } catch { /* noop */ }
      };
    }

    const unsubscribe = presentationRuntime.subscribe((event: SequencedPresentationEvent) => {
      if (event.kind !== 'commander-cast') return;

      const storeState = useGameStore.getState().state;
      if (!storeState) return;
      const card = storeState.cards[event.cardId];
      if (!card) return;
      const def = storeState.defs[card.defId];
      if (!def) return;
      const face = def.faces[card.faceIndex] ?? def.faces[0];
      if (!face) return;

      const cue: CommanderCutInData = {
        cardId: event.cardId,
        faceIndex: card.faceIndex,
        name: face.printedName ?? face.name ?? def.printedName ?? def.name,
        typeLine: face.printedTypeLine ?? face.typeLine ?? def.typeLine,
        ...(face.imageUrl ? { imageUrl: face.imageUrl } : {}),
      };

      cleanup();
      setRitual({ id: event.id, cue });
      timerRef.current = setTimeout(() => {
        setRitual(null);
        timerRef.current = null;
      }, COMMANDER_RITUAL_DURATION_MS);

      const audioContext = getSessionAudioContext();
      const delaySec = presentationSoundDelayMs(getSessionTransportPositionSec()) / 1000;
      const audioStartAtSec = audioContext
        ? audioContext.currentTime + delaySec
        : null;

      if (
        audioStartAtSec !== null &&
        policyRef.current.eventsAudible &&
        policyRef.current.transportRunning
      ) {
        try { playMotif(audioStartAtSec); } catch { /* sound failure never blocks */ }
      }
      if (
        audioStartAtSec !== null &&
        shouldDuckMusic(
          policyRef.current.eventsAudible,
          policyRef.current.musicAudible,
        ) &&
        policyRef.current.transportRunning
      ) {
        try { scheduleDuck(audioStartAtSec); } catch { /* sound failure never blocks */ }
      }
    });

    return () => {
      unsubscribe();
      cleanup();
      setRitual(null);
    };
  }, []);

  useEffect(() => {
    if (!policy.eventsAudible || !policy.transportRunning) {
      const source = motifSourceRef.current;
      motifSourceRef.current = null;
      if (source) {
        try { source.onended = null; } catch { /* noop */ }
        try { source.stop(); } catch { /* already stopped */ }
        try { source.disconnect(); } catch { /* noop */ }
      }
    }
    if (
      !policy.transportRunning ||
      !shouldDuckMusic(policy.eventsAudible, policy.musicAudible)
    ) {
      if (duckCancelRef.current) {
        duckCancelRef.current();
        duckCancelRef.current = null;
      }
      if (!policy.musicAudible || !policy.transportRunning) {
        const ctx = getSessionAudioContext();
        const musicLane = getSessionMusicLane();
        if (ctx && musicLane) {
          try {
            musicLane.gain.cancelScheduledValues(ctx.currentTime);
            musicLane.gain.setValueAtTime(0, ctx.currentTime);
          } catch { /* noop */ }
        }
      }
    }
  }, [policy.eventsAudible, policy.musicAudible, policy.transportRunning]);

  if (!ritual) return null;
  return <CommanderCutIn key={ritual.id} cue={ritual.cue} />;
}
