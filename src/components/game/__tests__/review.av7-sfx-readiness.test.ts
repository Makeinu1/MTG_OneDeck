/** Judge-owned AV7 pin: never expose a partly loaded semantic composition. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('AV7 fixed-composition readiness', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn((src: string) => Promise.resolve({
      ok: !src.endsWith('/spell-arcane-snap.wav'),
      status: 503,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps a cue silent unless every declared layer is decoded', async () => {
    const source = {
      buffer: null as AudioBuffer | null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null as (() => void) | null,
    };
    const gain = {
      gain: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    const createBufferSource = vi.fn(() => source);
    const context = {
      currentTime: 0,
      decodeAudioData: () => Promise.resolve({} as AudioBuffer),
      createBufferSource,
      createGain: vi.fn(() => gain),
    } as unknown as AudioContext;
    const lane = {} as GainNode;
    const { loadAllSfx, playSfx } = await import('../presentation/sfxRenderer');

    await loadAllSfx(context);

    expect(playSfx('spell-cast', lane, context, 0)).toBeNull();
    expect(createBufferSource).not.toHaveBeenCalled();
  });

  it('does not permanently cache a failed sample and becomes ready after retry', async () => {
    let failSpellSnap = true;
    const retryFetch = vi.fn((src: string) => Promise.resolve({
      ok: !(failSpellSnap && src.endsWith('/spell-arcane-snap.wav')),
      status: 503,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    }));
    vi.stubGlobal('fetch', retryFetch);
    const context = {
      decodeAudioData: () => Promise.resolve({} as AudioBuffer),
    } as unknown as AudioContext;
    const { isSfxReady, loadAllSfx } = await import('../presentation/sfxRenderer');

    await expect(loadAllSfx(context)).resolves.toBe(false);
    expect(isSfxReady()).toBe(false);
    failSpellSnap = false;
    await expect(loadAllSfx(context)).resolves.toBe(true);
    expect(isSfxReady()).toBe(true);
    expect(
      retryFetch.mock.calls.filter(([src]) => src.endsWith('/spell-arcane-snap.wav')),
    ).toHaveLength(2);
  });
});
