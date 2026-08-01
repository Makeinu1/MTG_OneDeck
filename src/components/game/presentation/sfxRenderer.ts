/**
 * Async production-sample loader and deterministic multi-layer playback.
 * Missing, undecodable, or unplayable audio degrades to silence.
 */

import {
  allSfxAssetSources,
  sfxLayersFor,
  type SfxKind,
  type SfxLayer,
} from './sfxManifest';

export interface SfxPlaybackHandle {
  onended: (() => void) | null;
  stop(): void;
  disconnect(): void;
}

const bufferCache = new Map<string, AudioBuffer>();
const loadCache = new Map<string, Promise<AudioBuffer | null>>();
const activeByChokeGroup = new Map<string, SfxPlaybackHandle>();

function dbToLinear(db: number): number {
  return 10 ** (db / 20);
}

async function loadBuffer(src: string, context: AudioContext): Promise<AudioBuffer | null> {
  const cached = bufferCache.get(src);
  if (cached) return cached;

  const existing = loadCache.get(src);
  if (existing) return existing;

  const pending = fetch(src)
    .then((response) => {
      if (!response.ok) throw new Error(`SFX fetch failed: ${response.status}`);
      return response.arrayBuffer();
    })
    .then((bytes) => context.decodeAudioData(bytes))
    .then((buffer) => {
      bufferCache.set(src, buffer);
      return buffer;
    })
    .catch(() => {
      // Do not poison the page session: a later gesture/settings action retries.
      loadCache.delete(src);
      return null;
    });
  loadCache.set(src, pending);
  return pending;
}

export async function loadAllSfx(context: AudioContext): Promise<boolean> {
  const results = await Promise.all(allSfxAssetSources().map((src) => loadBuffer(src, context)));
  return results.every((buffer) => buffer !== null);
}

function stopPlayback(handle: SfxPlaybackHandle): void {
  try {
    handle.stop();
  } catch {
    /* already stopped */
  }
  try {
    handle.disconnect();
  } catch {
    /* already disconnected */
  }
}

export function playSfx(
  kind: SfxKind,
  lane: GainNode,
  context: AudioContext,
  delaySec: number,
  options: { tapped?: boolean } = {},
): SfxPlaybackHandle | null {
  const layers = sfxLayersFor(kind, options);
  const readyLayers: Array<{ layer: SfxLayer; buffer: AudioBuffer }> = [];
  for (const layer of layers) {
    const buffer = bufferCache.get(layer.src);
    if (!buffer) return null;
    readyLayers.push({ layer, buffer });
  }
  if (readyLayers.length === 0) return null;

  const chokeGroups = new Set(readyLayers.map(({ layer }) => layer.chokeGroup));
  for (const chokeGroup of chokeGroups) {
    const previous = activeByChokeGroup.get(chokeGroup);
    if (previous) stopPlayback(previous);
  }

  const sources: AudioBufferSourceNode[] = [];
  const gains: GainNode[] = [];
  let endedCount = 0;
  let disconnected = false;

  const handle: SfxPlaybackHandle = {
    onended: null,
    stop(): void {
      for (const source of sources) {
        try {
          source.stop();
        } catch {
          /* already stopped */
        }
      }
    },
    disconnect(): void {
      if (disconnected) return;
      disconnected = true;
      for (const source of sources) {
        try {
          source.disconnect();
        } catch {
          /* already disconnected */
        }
      }
      for (const gain of gains) {
        try {
          gain.disconnect();
        } catch {
          /* already disconnected */
        }
      }
      for (const chokeGroup of chokeGroups) {
        if (activeByChokeGroup.get(chokeGroup) === handle) {
          activeByChokeGroup.delete(chokeGroup);
        }
      }
    },
  };

  try {
    for (const { layer, buffer } of readyLayers) {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      gain.gain.value = dbToLinear(layer.gainDb);
      source.connect(gain);
      gain.connect(lane);
      source.onended = () => {
        endedCount += 1;
        if (endedCount !== sources.length) return;
        handle.disconnect();
        handle.onended?.();
      };
      sources.push(source);
      gains.push(gain);
      source.start(context.currentTime + Math.max(0, delaySec) + layer.offsetMs / 1000);
    }
  } catch {
    stopPlayback(handle);
    return null;
  }

  for (const chokeGroup of chokeGroups) {
    activeByChokeGroup.set(chokeGroup, handle);
  }
  return handle;
}

export function isSfxReady(): boolean {
  return allSfxAssetSources().every((src) => bufferCache.has(src));
}
