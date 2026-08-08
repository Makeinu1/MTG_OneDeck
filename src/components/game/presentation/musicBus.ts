/**
 * musicBus — AV7 single-element streaming runtime.
 *
 * The approved full-length MP3 is streamed through one HTMLMediaElement and
 * uses its native loop flag. Module-level position memory survives game-screen
 * unmount/remount within the same page session.
 */

import { DARK_GAME_TRACK, type TrackManifest } from './trackManifest';

export interface NativeMediaPlan {
  src: string;
  nativeLoop: true;
  loopStartSec: number;
  loopEndSec: number;
}

export function createNativeMediaPlan(manifest: TrackManifest): NativeMediaPlan {
  return {
    src: manifest.src,
    nativeLoop: true,
    loopStartSec: manifest.loopStartSec,
    loopEndSec: manifest.loopEndSec,
  };
}

export const BGM_GAIN_DB = -4.5;

function dbToLinear(db: number): number {
  return 10 ** (db / 20);
}

export interface MusicBusLanes {
  master: GainNode;
  music: GainNode;
  events: GainNode;
  commander: GainNode;
}

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

const rememberedPositions = new Map<string, number>();

export function getRememberedPosition(trackId = DARK_GAME_TRACK.id): number {
  return rememberedPositions.get(trackId) ?? 0;
}

export function resetRememberedPosition(): void {
  rememberedPositions.clear();
}

export function createMediaElementSource(
  context: AudioContext,
  element: HTMLMediaElement,
): MediaElementAudioSourceNode {
  return context.createMediaElementSource(element);
}

export type AudioStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export interface MusicRuntime {
  status: AudioStatus;
  pause(): void;
  resume(): Promise<boolean>;
  currentPositionSec(): number;
  setMusicAudible(audible: boolean): void;
  setMusicVolume(volume0to100: number): void;
  dispose(): void;
}

function errorRuntime(trackId: string): MusicRuntime {
  return {
    status: 'error',
    pause: () => {},
    resume: () => Promise.resolve(false),
    currentPositionSec: () => getRememberedPosition(trackId),
    setMusicAudible: () => {},
    setMusicVolume: () => {},
    dispose: () => {},
  };
}

export function createMusicRuntime(
  manifest: TrackManifest | null,
  lanes: MusicBusLanes,
  context: AudioContext,
): MusicRuntime | null {
  if (manifest === null) return null;
  if (typeof document === 'undefined') return null;

  const plan = createNativeMediaPlan(manifest);
  const trackId = manifest.id;
  let element: HTMLMediaElement;
  let source: MediaElementAudioSourceNode;
  try {
    element = document.createElement('audio');
    element.src = plan.src;
    element.preload = 'auto';
    element.volume = 1;
    element.loop = plan.nativeLoop;
    source = createMediaElementSource(context, element);
    source.connect(lanes.music);
  } catch {
    return errorRuntime(trackId);
  }

  let status: AudioStatus = 'idle';
  let resumePromise: Promise<boolean> | null = null;
  let playbackGeneration = 0;
  let musicVolumeScale = 1;
  let musicAudible = true;

  function rememberPosition(): void {
    if (Number.isFinite(element.currentTime)) {
      rememberedPositions.set(trackId, element.currentTime);
    }
  }

  element.addEventListener('timeupdate', rememberPosition);

  function pause(): void {
    playbackGeneration += 1;
    resumePromise = null;
    rememberPosition();
    element.pause();
    status = 'paused';
  }

  function resume(): Promise<boolean> {
    if (status === 'playing' && !element.paused) return Promise.resolve(true);
    if (resumePromise !== null) return resumePromise;

    const generation = playbackGeneration;
    element.currentTime = getRememberedPosition(trackId);
    const pending = element
      .play()
      .then(() => {
        if (generation !== playbackGeneration) {
          element.pause();
          return false;
        }
        status = 'playing';
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
    return Number.isFinite(element.currentTime)
      ? element.currentTime
      : getRememberedPosition(trackId);
  }

  function applyMusicGain(): void {
    lanes.music.gain.value = musicAudible ? dbToLinear(BGM_GAIN_DB) * musicVolumeScale : 0;
  }

  function setMusicAudible(audible: boolean): void {
    musicAudible = audible;
    applyMusicGain();
  }

  function setMusicVolume(volume0to100: number): void {
    musicVolumeScale = Math.min(100, Math.max(0, volume0to100)) / 100;
    applyMusicGain();
  }

  function dispose(): void {
    resumePromise = null;
    rememberPosition();
    element.pause();
    element.removeEventListener('timeupdate', rememberPosition);
    element.src = '';
    try {
      source.disconnect();
    } catch {
      /* already disconnected */
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
    setMusicVolume,
    dispose,
  };
}
