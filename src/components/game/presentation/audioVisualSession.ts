/**
 * audioVisualSession — module-level session singletons for the AV2 audio runtime.
 * Separated from AudioVisualProvider to satisfy react-refresh/only-export-components.
 */

import type { MusicBusLanes } from './musicBus';

let sessionContext: AudioContext | null = null;
let sessionLanes: MusicBusLanes | null = null;
let transportPositionGetter: (() => number) | null = null;

export function setSessionRuntime(ctx: AudioContext, lanes: MusicBusLanes): void {
  sessionContext = ctx;
  sessionLanes = lanes;
}

export function clearSessionRuntime(): void {
  sessionLanes = null;
  sessionContext = null;
  transportPositionGetter = null;
}

export function getSessionAudioContext(): AudioContext | null {
  return sessionContext;
}

export function getSessionEventLane(): GainNode | null {
  return sessionLanes?.events ?? null;
}

export function getSessionMusicLane(): GainNode | null {
  return sessionLanes?.music ?? null;
}

export function getSessionCommanderLane(): GainNode | null {
  return sessionLanes?.commander ?? null;
}

/**
 * Scale the events and commander lane gains by sfxVolume (0-100).
 * Called by the provider when preferences change. Patches are rendered
 * at full level; the bus gain scales output.
 */
export function setSessionSfxVolume(volume0to100: number): void {
  const scale = Math.min(100, Math.max(0, volume0to100)) / 100;
  if (sessionLanes) {
    sessionLanes.events.gain.value = scale;
    sessionLanes.commander.gain.value = scale;
  }
}

export function setSessionTransportPositionGetter(getter: (() => number) | null): void {
  transportPositionGetter = getter;
}

export function getSessionTransportPositionSec(): number {
  if (transportPositionGetter) return transportPositionGetter();
  return 0;
}
