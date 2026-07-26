/**
 * SemanticPresentationLayer — AV3 restrained visual + sound for ordinary events.
 * docs/audio-visual-contract.md §2, §3, §4, §7.
 *
 * spell-cast: one blue-white pulse targeting the rendered StackBand.
 * land-played: one gold settle targeting the newly rendered card (240ms).
 * turn-advanced: no additional visual (existing transition cue is reused).
 * Same-kind feedback restarts/replaces. No particles, no frame-clock arrays.
 * Reduced motion: fade-only.
 *
 * Sound: scheduled with Web Audio time (osc.start(ctx.currentTime + delay)).
 * Chokes prior same-kind voice. Cleanup stops/disconnects all voices on
 * unmount or when events become inaudible.
 * State and visuals never wait for audio.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAudioVisual } from './audioVisualContext';
import { presentationRuntime } from './presentationRuntime';
import type { SequencedPresentationEvent } from './presentationSequencer';
import { semanticSoundSpec, presentationSoundDelayMs } from './semanticSound';
import {
  getSessionAudioContext,
  getSessionEventLane,
  getSessionTransportPositionSec,
} from './audioVisualSession';

interface SpellPulse {
  id: string;
}

interface LandSettle {
  id: string;
  cardId: string;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function SemanticPresentationLayer() {
  const { policy } = useAudioVisual();
  const [spellPulse, setSpellPulse] = useState<SpellPulse | null>(null);
  const [landSettle, setLandSettle] = useState<LandSettle | null>(null);
  const pulseRef = useRef<HTMLDivElement>(null);
  const settleRef = useRef<HTMLDivElement>(null);
  const spellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const landTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeVoicesRef = useRef<Map<string, { osc: OscillatorNode; env: GainNode }>>(new Map());
  const policyRef = useRef(policy);

  useEffect(() => {
    policyRef.current = policy;
  }, [policy]);

  function stopAllVoices(): void {
    for (const [, voice] of activeVoicesRef.current) {
      try { voice.osc.stop(); } catch { /* already stopped */ }
      try { voice.env.disconnect(); } catch { /* noop */ }
    }
    activeVoicesRef.current.clear();
  }

  function scheduleVoice(kind: string, freq: number, type: OscillatorType, durationMs: number, gain: number, delayMs: number): void {
    const ctx = getSessionAudioContext();
    const lane = getSessionEventLane();
    if (!ctx || !lane) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});

    const previous = activeVoicesRef.current.get(kind);
    if (previous) {
      try { previous.osc.stop(); } catch { /* already stopped */ }
      try { previous.env.disconnect(); } catch { /* noop */ }
      activeVoicesRef.current.delete(kind);
    }

    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;

    const startAt = ctx.currentTime + delayMs / 1000;
    env.gain.setValueAtTime(0, startAt);
    env.gain.linearRampToValueAtTime(gain, startAt + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, startAt + durationMs / 1000);

    osc.connect(env).connect(lane);
    osc.start(startAt);
    osc.stop(startAt + durationMs / 1000 + 0.02);
    activeVoicesRef.current.set(kind, { osc, env });

    osc.onended = () => {
      if (activeVoicesRef.current.get(kind)?.osc === osc) {
        activeVoicesRef.current.delete(kind);
      }
      env.disconnect();
    };
  }

  useEffect(() => {
    const unsubscribe = presentationRuntime.subscribe((event: SequencedPresentationEvent) => {
      if (event.kind === 'spell-cast') {
        if (spellTimerRef.current) clearTimeout(spellTimerRef.current);
        setSpellPulse({ id: event.id });
        const durationMs = prefersReducedMotion() ? 200 : 280;
        spellTimerRef.current = setTimeout(() => {
          setSpellPulse(null);
          spellTimerRef.current = null;
        }, durationMs);
      } else if (event.kind === 'land-played') {
        if (landTimerRef.current) clearTimeout(landTimerRef.current);
        setLandSettle({ id: event.id, cardId: event.cardId });
        landTimerRef.current = setTimeout(() => {
          setLandSettle(null);
          landTimerRef.current = null;
        }, 240);
      }

      if (!policyRef.current.eventsAudible || !policyRef.current.transportRunning) return;
      const spec = semanticSoundSpec(event.kind);
      if (!spec) return;

      try {
        const positionSec = getSessionTransportPositionSec();
        const delayMs = presentationSoundDelayMs(positionSec);
        scheduleVoice(event.kind, spec.freq, spec.type, spec.durationMs, spec.gain, delayMs);
      } catch {
        // Sound failure never blocks game state or visuals.
      }
    });

    return () => {
      unsubscribe();
      if (spellTimerRef.current) clearTimeout(spellTimerRef.current);
      if (landTimerRef.current) clearTimeout(landTimerRef.current);
      stopAllVoices();
    };
  }, []);

  useEffect(() => {
    if (!policy.eventsAudible || !policy.transportRunning) {
      stopAllVoices();
    }
  }, [policy.eventsAudible, policy.transportRunning]);

  useLayoutEffect(() => {
    const el = pulseRef.current;
    if (!el || !spellPulse) return;
    const root = document.querySelector<HTMLElement>('[data-testid="game-screen"]');
    const stackBand = document.querySelector<HTMLElement>('[data-testid="stack-band"]');
    if (root && stackBand) {
      const rootRect = root.getBoundingClientRect();
      const stackRect = stackBand.getBoundingClientRect();
      el.style.left = `${stackRect.left - rootRect.left + stackRect.width / 2}px`;
      el.style.top = `${stackRect.top - rootRect.top + stackRect.height / 2}px`;
    } else if (root) {
      const rootRect = root.getBoundingClientRect();
      el.style.left = `${rootRect.width / 2}px`;
      el.style.top = `${rootRect.height * 0.3}px`;
    }
  }, [spellPulse]);

  useLayoutEffect(() => {
    const el = settleRef.current;
    if (!el || !landSettle) return;
    const root = document.querySelector<HTMLElement>('[data-testid="game-screen"]');
    const expectedTestId = `card-${landSettle.cardId}`;
    const renderedCards = Array.from(
      document.querySelectorAll<HTMLElement>('[data-testid^="card-"]'),
    );
    const cardEl = renderedCards.find((candidate) => (
      candidate.dataset.testid === expectedTestId
      && candidate.getClientRects().length > 0
    )) ?? renderedCards.find((candidate) => candidate.dataset.testid === expectedTestId);
    if (root && cardEl) {
      const rootRect = root.getBoundingClientRect();
      const cardRect = cardEl.getBoundingClientRect();
      el.style.left = `${cardRect.left - rootRect.left}px`;
      el.style.top = `${cardRect.top - rootRect.top}px`;
      el.style.width = `${cardRect.width}px`;
      el.style.height = `${cardRect.height}px`;
    } else if (root) {
      const rootRect = root.getBoundingClientRect();
      const board = document.querySelector<HTMLElement>('[data-testid="board"]');
      const boardRect = board?.getBoundingClientRect();
      el.style.left = boardRect
        ? `${boardRect.left - rootRect.left + boardRect.width / 2 - 20}px`
        : `${rootRect.width / 2 - 20}px`;
      el.style.top = boardRect
        ? `${boardRect.top - rootRect.top + boardRect.height / 2 - 20}px`
        : `${rootRect.height * 0.6 - 20}px`;
      el.style.width = '40px';
      el.style.height = '40px';
    }
  }, [landSettle]);

  const reducedMotion = prefersReducedMotion();

  return (
    <>
      {spellPulse && (
        <div
          ref={pulseRef}
          className={`semantic-pulse semantic-pulse--spell${reducedMotion ? ' semantic-pulse--reduced' : ''}`}
          data-testid="semantic-spell-pulse"
          aria-hidden="true"
        />
      )}
      {landSettle && (
        <div
          ref={settleRef}
          className={`semantic-settle semantic-settle--land${reducedMotion ? ' semantic-settle--reduced' : ''}`}
          data-testid="semantic-land-settle"
          data-card-id={landSettle.cardId}
          aria-hidden="true"
        />
      )}
    </>
  );
}
