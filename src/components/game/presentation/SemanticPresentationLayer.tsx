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
 * Sound: pre-rendered multi-layer patches played via sfxRenderer.
 * Chokes prior same-kind voice. Cleanup stops/disconnects all sources on
 * unmount or when events become inaudible.
 * State and visuals never wait for audio.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAudioVisual } from './audioVisualContext';
import { consumePendingOpeningDealCue } from './AudioVisualProvider';
import { presentationRuntime } from './presentationRuntime';
import type { SequencedPresentationEvent } from './presentationSequencer';
import { presentationSoundDelayMs } from './semanticSound';
import { loadAllSfx, playSfx, type SfxPlaybackHandle } from './sfxRenderer';
import {
  getSessionAudioContext,
  getSessionEventLane,
  getSessionTransportPositionSec,
} from './audioVisualSession';
import type { SfxKind } from './sfxManifest';

interface SpellPulse {
  id: string;
}

interface StackArrival {
  id: string;
  cardId: string;
  sourceZone: string;
}

interface LandSettle {
  id: string;
  cardId: string;
}

function sourceAnchorFor(zone: string): HTMLElement | null {
  const testId = zone === 'hand'
    ? 'hand-ribbon'
    : zone === 'library'
      ? 'library-tile'
      : zone === 'graveyard'
        ? 'graveyard-tile'
        : zone === 'exile'
          ? 'exile-tile'
          : zone === 'command'
            ? 'commander-altar'
            : null;
  return testId ? document.querySelector<HTMLElement>(`[data-testid="${testId}"]`) : null;
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function SemanticPresentationLayer({ openingDealCount }: { openingDealCount?: number }) {
  const { policy } = useAudioVisual();
  const [spellPulse, setSpellPulse] = useState<SpellPulse | null>(null);
  const [stackArrival, setStackArrival] = useState<StackArrival | null>(null);
  const [landSettle, setLandSettle] = useState<LandSettle | null>(null);
  const pulseRef = useRef<HTMLDivElement>(null);
  const stackArrivalRef = useRef<HTMLDivElement>(null);
  const settleRef = useRef<HTMLDivElement>(null);
  const spellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stackArrivalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const landTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSourcesRef = useRef<Map<string, SfxPlaybackHandle>>(new Map());
  const pendingDrawRetriesRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(false);
  const policyRef = useRef(policy);

  useEffect(() => {
    policyRef.current = policy;
  }, [policy]);

  function stopAllSources(): void {
    for (const [, source] of activeSourcesRef.current) {
      try { source.stop(); } catch { /* already stopped */ }
      try { source.disconnect(); } catch { /* noop */ }
    }
    activeSourcesRef.current.clear();
  }

  function scheduleSfx(
    kind: SfxKind,
    delayMs: number,
    options: { tapped?: boolean } = {},
  ): boolean {
    const ctx = getSessionAudioContext();
    const lane = getSessionEventLane();
    if (!ctx || !lane) return false;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});

    const previous = activeSourcesRef.current.get(kind);
    if (previous) {
      try { previous.stop(); } catch { /* already stopped */ }
      try { previous.disconnect(); } catch { /* noop */ }
      activeSourcesRef.current.delete(kind);
    }

    const source = playSfx(kind, lane, ctx, delayMs / 1000, options);
    if (!source) return false;
    activeSourcesRef.current.set(kind, source);
    source.onended = () => {
      if (activeSourcesRef.current.get(kind) === source) {
        activeSourcesRef.current.delete(kind);
      }
      try { source.disconnect(); } catch { /* noop */ }
    };
    return true;
  }

  useEffect(() => {
    mountedRef.current = true;
    const pendingDrawRetries = pendingDrawRetriesRef.current;
    function retryDrawSoundsAfterLoad(): void {
      const context = getSessionAudioContext();
      if (!context || pendingDrawRetries.size === 0) return;
      void loadAllSfx(context).then((ready) => {
        if (!ready || !mountedRef.current || !policyRef.current.eventsAudible || !policyRef.current.transportRunning) {
          return;
        }
        const pendingIds = [...pendingDrawRetries];
        pendingDrawRetries.clear();
        for (let index = 0; index < pendingIds.length; index += 1) {
          try {
            scheduleSfx('draw-completed', presentationSoundDelayMs(getSessionTransportPositionSec()));
          } catch {
            // Sound failure never blocks game state or visuals.
          }
        }
      }).catch(() => {
        // Missing/undecodable assets remain silent without affecting game state.
      });
    }
    const unsubscribe = presentationRuntime.subscribe((event: SequencedPresentationEvent) => {
      if (event.kind === 'spell-cast') {
        if (spellTimerRef.current) clearTimeout(spellTimerRef.current);
        if (stackArrivalTimerRef.current) clearTimeout(stackArrivalTimerRef.current);
        setSpellPulse({ id: event.id });
        setStackArrival({ id: event.id, cardId: event.cardId, sourceZone: event.sourceZone });
        const pulseDurationMs = prefersReducedMotion() ? 200 : 280;
        spellTimerRef.current = setTimeout(() => {
          setSpellPulse(null);
          spellTimerRef.current = null;
        }, pulseDurationMs);
        stackArrivalTimerRef.current = setTimeout(() => {
          setStackArrival(null);
          stackArrivalTimerRef.current = null;
        }, 300);
      } else if (event.kind === 'land-played') {
        if (landTimerRef.current) clearTimeout(landTimerRef.current);
        setLandSettle({ id: event.id, cardId: event.cardId });
        landTimerRef.current = setTimeout(() => {
          setLandSettle(null);
          landTimerRef.current = null;
        }, 240);
      }

      if (!policyRef.current.eventsAudible || !policyRef.current.transportRunning) return;
      // Commander sound is owned by CommanderRitualLayer (AV4).
      if (event.kind === 'commander-cast') return;

      try {
        const positionSec = getSessionTransportPositionSec();
        const delayMs = presentationSoundDelayMs(positionSec);
        const played = scheduleSfx(
          event.kind,
          delayMs,
          event.kind === 'tap-changed' ? { tapped: event.tapped } : {},
        );
        if (!played && event.kind === 'draw-completed') {
          pendingDrawRetriesRef.current.add(event.id);
          retryDrawSoundsAfterLoad();
        }
      } catch {
        // Sound failure never blocks game state or visuals.
      }
    });

    return () => {
      unsubscribe();
      if (spellTimerRef.current) clearTimeout(spellTimerRef.current);
      if (stackArrivalTimerRef.current) clearTimeout(stackArrivalTimerRef.current);
      if (landTimerRef.current) clearTimeout(landTimerRef.current);
      mountedRef.current = false;
      pendingDrawRetries.clear();
      stopAllSources();
    };
  }, []);

  useEffect(() => {
    const pending = consumePendingOpeningDealCue();
    if (!pending || openingDealCount !== 7) return;
    presentationRuntime.publish({
      action: 'draw',
      status: 'committed',
      requestedCount: 7,
      completedCount: 7,
    });
  }, [openingDealCount]);

  useLayoutEffect(() => {
    const el = stackArrivalRef.current;
    if (!el || !stackArrival) return;
    const root = document.querySelector<HTMLElement>('[data-testid="game-screen"]');
    const stackBand = document.querySelector<HTMLElement>('[data-testid="stack-band"]');
    if (!root) return;

    const rootRect = root.getBoundingClientRect();
    const stackRect = stackBand?.getBoundingClientRect();
    const sourceRect = sourceAnchorFor(stackArrival.sourceZone)?.getBoundingClientRect();
    const sourceX = sourceRect
      ? sourceRect.left + sourceRect.width / 2
      : rootRect.left + rootRect.width / 2;
    const sourceY = sourceRect
      ? sourceRect.top + sourceRect.height / 2
      : rootRect.top + rootRect.height * 0.72;
    const targetX = stackRect
      ? stackRect.left + stackRect.width / 2
      : rootRect.left + rootRect.width * 0.82;
    const targetY = stackRect
      ? stackRect.top + stackRect.height / 2
      : rootRect.top + rootRect.height * 0.34;
    const width = 72;
    const height = 100;
    el.style.left = `${sourceX - rootRect.left - width / 2}px`;
    el.style.top = `${sourceY - rootRect.top - height / 2}px`;
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    el.style.setProperty('--stack-arrival-dx', `${targetX - sourceX}px`);
    el.style.setProperty('--stack-arrival-dy', `${targetY - sourceY}px`);
  }, [stackArrival]);

  useEffect(() => {
    if (!policy.eventsAudible || !policy.transportRunning) {
      stopAllSources();
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
      {stackArrival && (
        <div
          ref={stackArrivalRef}
          key={stackArrival.id}
          className="stack-arrival-ghost"
          data-testid="stack-arrival-ghost"
          data-card-id={stackArrival.cardId}
          data-source-zone={stackArrival.sourceZone}
          data-reduced={reducedMotion || undefined}
          aria-hidden="true"
          style={{ pointerEvents: 'none' }}
        />
      )}
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
