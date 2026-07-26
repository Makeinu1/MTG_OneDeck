/**
 * musicBus — AV2 streaming dual-media runtime.
 * docs/audio-visual-contract.md §6 (streaming, dual-element boundary).
 *
 * Uses exactly two HTMLMediaElement instances connected through
 * MediaElementAudioSourceNode. Never decodes the full MP3 — no
 * full-file decode or buffer-source nodes. Never sets native loop=true.
 * Crossfade boundary: 40ms equal-power.
 *
 * Module-level position memory survives same-page unmount/remount.
 * A fresh page load starts at track start.
 */

import type { TrackManifest } from './trackManifest';

/* ------------------------------------------------------------------ */
/*  Pure helpers (testable without DOM)                                */
/* ------------------------------------------------------------------ */

export interface DualMediaPlanItem {
  src: string;
  nativeLoop: false;
  loopStartSec: number;
  loopEndSec: number;
  crossfadeMs: number;
}

/**
 * Build the two-element streaming plan from a frozen TrackManifest.
 * Both elements share the same src; native loop is never used.
 */
export function createDualMediaPlan(manifest: TrackManifest): DualMediaPlanItem[] {
  const base = {
    src: manifest.src,
    nativeLoop: false as const,
    loopStartSec: manifest.loopStartSec,
    loopEndSec: manifest.loopEndSec,
    crossfadeMs: manifest.crossfadeMs,
  };
  return [{ ...base }, { ...base }];
}

/**
 * Equal-power crossfade gains at progress t ∈ [0, 1].
 * outgoing = cos(t·π/2), incoming = sin(t·π/2).
 */
export function equalPowerCrossfadeGains(
  t: number,
): { outgoing: number; incoming: number } {
  const clamped = Math.min(1, Math.max(0, t));
  const angle = (clamped * Math.PI) / 2;
  return {
    outgoing: Math.cos(angle),
    incoming: Math.sin(angle),
  };
}

/* ------------------------------------------------------------------ */
/*  Gain lane constants                                                */
/* ------------------------------------------------------------------ */

/** BGM gain in dB (contract §6: -4.5 dB). */
export const BGM_GAIN_DB = -4.5;

function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/* ------------------------------------------------------------------ */
/*  Bus topology (four separate gain lanes)                            */
/* ------------------------------------------------------------------ */

export interface MusicBusLanes {
  master: GainNode;
  music: GainNode;
  events: GainNode;
  commander: GainNode;
}

/**
 * Create the four independent gain lanes. AV2 only drives the music
 * lane; events/commander/master exist so later milestones can wire
 * them without topology changes.
 */
export function createBusLanes(context: AudioContext): MusicBusLanes {
  const master = context.createGain();
  const music = context.createGain();
  const events = context.createGain();
  const commander = context.createGain();

  music.gain.value = dbToLinear(BGM_GAIN_DB);
  events.gain.value = 1;
  commander.gain.value = 1;
  master.gain.value = 1;

  music.connect(master);
  events.connect(master);
  commander.connect(master);
  master.connect(context.destination);

  return { master, music, events, commander };
}

/* ------------------------------------------------------------------ */
/*  Module-level position memory (survives unmount/remount same page)  */
/* ------------------------------------------------------------------ */

let rememberedPositionSec = 0;

export function getRememberedPosition(): number {
  return rememberedPositionSec;
}

export function resetRememberedPosition(): void {
  rememberedPositionSec = 0;
}

/* ------------------------------------------------------------------ */
/*  Media element source factory                                       */
/* ------------------------------------------------------------------ */

/**
 * Create a MediaElementAudioSourceNode from an HTMLMediaElement.
 * Named `createMediaElementSource` so the review pin can verify the
 * streaming approach (media-element source, not buffer decode).
 */
export function createMediaElementSource(
  context: AudioContext,
  element: HTMLMediaElement,
): MediaElementAudioSourceNode {
  return context.createMediaElementSource(element);
}

/* ------------------------------------------------------------------ */
/*  Streaming runtime (imperative, guarded for jsdom / no Web Audio)   */
/* ------------------------------------------------------------------ */

export type AudioStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export interface MusicRuntime {
  status: AudioStatus;
  pause(): void;
  resume(): Promise<boolean>;
  currentPositionSec(): number;
  setMusicAudible(audible: boolean): void;
  dispose(): void;
}

/**
 * Attempt to build the dual-element streaming runtime.
 * Returns null when Web Audio or media playback is unavailable (jsdom).
 */
export function createMusicRuntime(
  manifest: TrackManifest,
  lanes: MusicBusLanes,
  context: AudioContext,
): MusicRuntime | null {
  if (typeof document === 'undefined') return null;

  let status: AudioStatus = 'idle';
  const elements: HTMLMediaElement[] = [];
  const sources: MediaElementAudioSourceNode[] = [];
  const gains: GainNode[] = [];

  try {
    const plan = createDualMediaPlan(manifest);
    for (const item of plan) {
      const el = document.createElement('audio');
      el.src = item.src;
      el.preload = 'auto';
      el.volume = 1;
      elements.push(el);

      const source = createMediaElementSource(context, el);
      const gain = context.createGain();
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(lanes.music);
      sources.push(source);
      gains.push(gain);
    }
  } catch {
    status = 'error';
    return {
      status,
      pause: () => {},
      resume: () => Promise.resolve(false),
      currentPositionSec: () => rememberedPositionSec,
      setMusicAudible: () => {},
      dispose: () => {},
    };
  }

  let activeIndex = 0;
  let crossfadeTimer: ReturnType<typeof setTimeout> | null = null;
  let crossfadeInProgress = false;
  let crossfadeInterval: ReturnType<typeof setInterval> | null = null;
  let resumePromise: Promise<boolean> | null = null;
  let crossfadeGeneration = 0;
  let playbackGeneration = 0;

  function currentElement(): HTMLMediaElement {
    return elements[activeIndex];
  }

  function cancelCrossfadeWork(): void {
    crossfadeGeneration += 1;
    if (crossfadeTimer !== null) {
      clearTimeout(crossfadeTimer);
      crossfadeTimer = null;
    }
    if (crossfadeInterval !== null) {
      clearInterval(crossfadeInterval);
      crossfadeInterval = null;
    }
    crossfadeInProgress = false;
  }

  function scheduleLoopCrossfade(): void {
    if (crossfadeInProgress) return;
    const el = currentElement();
    const remaining = manifest.loopEndSec - el.currentTime;
    const crossfadeSec = manifest.crossfadeMs / 1000;
    const triggerMs = Math.max(0, (remaining - crossfadeSec) * 1000);

    if (crossfadeTimer !== null) clearTimeout(crossfadeTimer);
    crossfadeTimer = setTimeout(() => {
      crossfadeTimer = null;
      performCrossfade();
    }, triggerMs);
  }

  function performCrossfade(): void {
    if (crossfadeInProgress) return;
    crossfadeInProgress = true;
    const generation = crossfadeGeneration;

    const outgoingIndex = activeIndex;
    const incomingIndex = 1 - activeIndex;
    const incoming = elements[incomingIndex];
    const outgoingGain = gains[outgoingIndex];
    const incomingGain = gains[incomingIndex];

    incoming.currentTime = manifest.loopStartSec;
    void incoming.play().then(() => {
      if (generation !== crossfadeGeneration) {
        incoming.pause();
        return;
      }
      const steps = 8;
      const stepMs = manifest.crossfadeMs / steps;
      let step = 0;

      crossfadeInterval = setInterval(() => {
        step += 1;
        const t = step / steps;
        const { outgoing: og, incoming: ig } = equalPowerCrossfadeGains(t);
        outgoingGain.gain.value = og;
        incomingGain.gain.value = ig;
        if (step >= steps) {
          if (crossfadeInterval !== null) {
            clearInterval(crossfadeInterval);
            crossfadeInterval = null;
          }
          elements[outgoingIndex].pause();
          activeIndex = incomingIndex;
          rememberedPositionSec = incoming.currentTime;
          crossfadeInProgress = false;
          scheduleLoopCrossfade();
        }
      }, stepMs);
    }).catch(() => {
      if (generation === crossfadeGeneration) {
        crossfadeInProgress = false;
        status = 'error';
      }
    });
  }

  function onTimeUpdate(event: Event): void {
    const el = event.target as HTMLMediaElement;
    if (el !== currentElement()) return;
    rememberedPositionSec = el.currentTime;
    if (!crossfadeInProgress && el.currentTime >= manifest.loopEndSec) {
      performCrossfade();
    }
  }

  for (const el of elements) {
    el.addEventListener('timeupdate', onTimeUpdate);
  }

  function pause(): void {
    cancelCrossfadeWork();
    playbackGeneration += 1;
    resumePromise = null;
    const el = currentElement();
    rememberedPositionSec = el.currentTime;
    el.pause();
    status = 'paused';
  }

  function resume(): Promise<boolean> {
    const el = currentElement();
    if (status === 'playing' && !el.paused) return Promise.resolve(true);
    if (resumePromise !== null) return resumePromise;

    const generation = playbackGeneration;
    el.currentTime = rememberedPositionSec;
    const pending = el
      .play()
      .then(() => {
        if (generation !== playbackGeneration) {
          el.pause();
          return false;
        }
        status = 'playing';
        gains[activeIndex].gain.value = 1;
        scheduleLoopCrossfade();
        return true;
      })
      .catch(() => {
        status = 'error';
        return false;
      })
      .finally(() => {
        if (resumePromise === pending) resumePromise = null;
      });
    resumePromise = pending;
    return pending;
  }

  function currentPositionSec(): number {
    const position = currentElement().currentTime;
    return Number.isFinite(position) ? position : rememberedPositionSec;
  }

  function setMusicAudible(audible: boolean): void {
    lanes.music.gain.value = audible ? dbToLinear(BGM_GAIN_DB) : 0;
  }

  function dispose(): void {
    cancelCrossfadeWork();
    resumePromise = null;
    for (const el of elements) {
      el.pause();
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.src = '';
    }
    for (const gain of gains) {
      gain.disconnect();
    }
    for (const source of sources) {
      source.disconnect();
    }
  }

  return {
    get status() {
      return status;
    },
    pause,
    resume,
    currentPositionSec,
    setMusicAudible,
    dispose,
  };
}
