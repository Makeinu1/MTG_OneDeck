/**
 * sfxRenderer — OfflineAudioContext multi-layer patch rendering and playback.
 * docs/audio-visual-contract.md §3.1 (synthesis method).
 *
 * Renders the four sfxPatches to AudioBuffers at 48kHz/2ch on startup.
 * Playback is immediate from cached buffers via AudioBufferSourceNode.
 * Same-kind choke stops the previous source before starting a new one.
 * Noise uses a deterministic PRNG (mulberry32) — no non-deterministic sources.
 */

import { sfxPatch, type SfxKind, type SfxPatch, type SfxLayer } from './sfxPatches';

/* ------------------------------------------------------------------ */
/*  Module-level cache                                                 */
/* ------------------------------------------------------------------ */

const bufferCache = new Map<SfxKind, AudioBuffer>();
const activeSources = new Map<SfxKind, AudioBufferSourceNode>();

const SAMPLE_RATE = 48000;
const CHANNELS = 2;

/* ------------------------------------------------------------------ */
/*  Deterministic PRNG (mulberry32, fixed seed)                        */
/* ------------------------------------------------------------------ */

function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOISE_SEED = 0x5f3759df;

/* ------------------------------------------------------------------ */
/*  Rendering helpers                                                  */
/* ------------------------------------------------------------------ */

function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

function buildNoiseBuffer(ctx: OfflineAudioContext, durationSec: number): AudioBuffer {
  const length = Math.ceil(durationSec * SAMPLE_RATE);
  const buffer = ctx.createBuffer(1, length, SAMPLE_RATE);
  const data = buffer.getChannelData(0);
  const rng = mulberry32(NOISE_SEED);
  for (let i = 0; i < length; i++) {
    data[i] = rng() * 2 - 1;
  }
  return buffer;
}

function buildImpulseResponse(ctx: OfflineAudioContext, decaySec: number): AudioBuffer {
  const length = Math.ceil(decaySec * SAMPLE_RATE);
  const buffer = ctx.createBuffer(CHANNELS, length, SAMPLE_RATE);
  const rng = mulberry32(NOISE_SEED + 1);
  for (let ch = 0; ch < CHANNELS; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      // Exponential decay envelope
      const envelope = Math.exp(-3 * i / length);
      data[i] = (rng() * 2 - 1) * envelope;
    }
  }
  return buffer;
}

function scheduleLayer(
  ctx: OfflineAudioContext,
  destination: AudioNode,
  layer: SfxLayer,
  patchDurationSec: number,
): void {
  const startSec = layer.offsetMs / 1000;
  const attackSec = layer.attackMs / 1000;
  const releaseSec = layer.releaseMs / 1000;
  const decaySec = (layer.decayMs ?? 0) / 1000;
  const sustainLevel = layer.sustain ?? 0;
  const totalSec = attackSec + decaySec + releaseSec;
  const endSec = startSec + totalSec;

  const env = ctx.createGain();
  env.connect(destination);

  // ADSR envelope
  env.gain.setValueAtTime(0, startSec);
  env.gain.linearRampToValueAtTime(layer.gain, startSec + attackSec);
  if (decaySec > 0) {
    env.gain.linearRampToValueAtTime(layer.gain * sustainLevel, startSec + attackSec + decaySec);
    env.gain.setValueAtTime(layer.gain * sustainLevel, endSec - releaseSec);
  } else {
    env.gain.setValueAtTime(layer.gain, endSec - releaseSec);
  }
  env.gain.linearRampToValueAtTime(0, endSec);

  if (layer.kind === 'osc') {
    const osc = ctx.createOscillator();
    osc.type = layer.wave ?? 'sine';
    osc.frequency.setValueAtTime(layer.freqStart, startSec);
    if (layer.freqEnd !== undefined) {
      osc.frequency.linearRampToValueAtTime(layer.freqEnd, endSec);
    }
    if (layer.detuneCents !== undefined) {
      osc.detune.value = layer.detuneCents;
    }
    if (layer.filterType) {
      const filter = ctx.createBiquadFilter();
      filter.type = layer.filterType;
      filter.frequency.setValueAtTime(layer.filterFreqStart ?? 1000, startSec);
      if (layer.filterFreqEnd !== undefined) {
        filter.frequency.linearRampToValueAtTime(layer.filterFreqEnd, endSec);
      }
      if (layer.filterQ !== undefined) {
        filter.Q.value = layer.filterQ;
      }
      osc.connect(filter);
      filter.connect(env);
    } else {
      osc.connect(env);
    }
    osc.start(startSec);
    osc.stop(endSec + 0.01);
  } else {
    // noise layer
    const noiseDuration = Math.min(totalSec + 0.02, patchDurationSec - startSec + 0.02);
    const noiseBuffer = buildNoiseBuffer(ctx, Math.max(noiseDuration, 0.01));
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;

    if (layer.filterType) {
      const filter = ctx.createBiquadFilter();
      filter.type = layer.filterType;
      filter.frequency.setValueAtTime(layer.filterFreqStart ?? 1000, startSec);
      if (layer.filterFreqEnd !== undefined) {
        filter.frequency.linearRampToValueAtTime(layer.filterFreqEnd, endSec);
      }
      if (layer.filterQ !== undefined) {
        filter.Q.value = layer.filterQ;
      }
      source.connect(filter);
      filter.connect(env);
    } else {
      source.connect(env);
    }
    source.start(startSec);
    source.stop(endSec + 0.01);
  }
}

async function renderPatchAsync(patch: SfxPatch): Promise<AudioBuffer | null> {
  try {
    const reverbTailSec = patch.reverb ? patch.reverb.decaySec : 0;
    const totalSec = patch.durationMs / 1000 + reverbTailSec + 0.05;
    const totalFrames = Math.ceil(totalSec * SAMPLE_RATE);

    const ctx = new OfflineAudioContext(CHANNELS, totalFrames, SAMPLE_RATE);

    const dryGain = ctx.createGain();
    dryGain.gain.value = 1;

    const outputGain = ctx.createGain();
    outputGain.gain.value = dbToLinear(patch.outputGainDb);
    outputGain.connect(ctx.destination);

    if (patch.reverb) {
      const impulse = buildImpulseResponse(ctx, patch.reverb.decaySec);
      const convolver = ctx.createConvolver();
      convolver.buffer = impulse;

      const wetGain = ctx.createGain();
      wetGain.gain.value = patch.reverb.wetGain;

      dryGain.connect(outputGain);
      dryGain.connect(convolver);
      convolver.connect(wetGain);
      wetGain.connect(outputGain);
    } else {
      dryGain.connect(outputGain);
    }

    const patchDurationSec = patch.durationMs / 1000;
    for (const layer of patch.layers) {
      scheduleLayer(ctx, dryGain, layer, patchDurationSec);
    }

    return await ctx.startRendering();
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

const ALL_KINDS: readonly SfxKind[] = ['spell-cast', 'land-played', 'turn-advanced', 'commander-cast'];

/**
 * Render all four patches to AudioBuffers and cache them.
 * Fire-and-forget: errors are swallowed per-patch. Never throws.
 */
export async function renderAllPatches(): Promise<void> {
  const promises = ALL_KINDS.map(async (kind) => {
    const patch = sfxPatch(kind);
    const buffer = await renderPatchAsync(patch);
    if (buffer) {
      bufferCache.set(kind, buffer);
    }
  });
  await Promise.allSettled(promises);
}

/**
 * Play a cached SFX buffer through the given lane.
 * Choke: stops the previous same-kind source before starting a new one.
 * If no buffer is cached, silently does nothing.
 * Returns the started source node (for external cleanup tracking), or null.
 */
export function playSfx(kind: SfxKind, lane: GainNode, ctx: AudioContext, delaySec: number): AudioBufferSourceNode | null {
  const buffer = bufferCache.get(kind);
  if (!buffer) return null;

  // Choke previous
  const previous = activeSources.get(kind);
  if (previous) {
    try { previous.stop(); } catch { /* already stopped */ }
    try { previous.disconnect(); } catch { /* noop */ }
    activeSources.delete(kind);
  }

  try {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(lane);
    source.start(ctx.currentTime + delaySec);
    activeSources.set(kind, source);

    source.onended = () => {
      if (activeSources.get(kind) === source) {
        activeSources.delete(kind);
      }
      try { source.disconnect(); } catch { /* noop */ }
    };
    return source;
  } catch {
    // Playback failure never blocks game state or visuals.
    return null;
  }
}

/** True when at least one buffer is cached and ready for playback. */
export function isSfxReady(): boolean {
  return bufferCache.size > 0;
}
