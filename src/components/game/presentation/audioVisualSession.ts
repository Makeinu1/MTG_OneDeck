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

export function setSessionTransportPositionGetter(getter: (() => number) | null): void {
  transportPositionGetter = getter;
}

export function getSessionTransportPositionSec(): number {
  if (transportPositionGetter) return transportPositionGetter();
  return 0;
}
