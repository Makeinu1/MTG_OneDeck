import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function sourceNode() {
  return {
    buffer: null as AudioBuffer | null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null as (() => void) | null,
  };
}

function gainNode() {
  return {
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

describe('production SFX renderer', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('degrades to silence before buffers are ready', async () => {
    const { playSfx } = await import('../sfxRenderer');
    const context = { currentTime: 0 } as AudioContext;
    expect(playSfx('spell-cast', gainNode() as unknown as GainNode, context, 0)).toBeNull();
  });

  it('fetches and decodes the fixed samples asynchronously', async () => {
    const buffer = {} as AudioBuffer;
    const decodeAudioData = vi.fn(() => Promise.resolve(buffer));
    const context = {
      decodeAudioData,
    } as unknown as AudioContext;
    const { isSfxReady, loadAllSfx } = await import('../sfxRenderer');
    expect(isSfxReady()).toBe(false);
    await loadAllSfx(context);
    expect(fetch).toHaveBeenCalled();
    expect(decodeAudioData).toHaveBeenCalled();
    expect(isSfxReady()).toBe(true);
  });

  it('keeps the whole cue silent when one declared layer fails to load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((src: string) =>
        Promise.resolve({
          ok: !src.endsWith('/spell-arcane-snap.wav'),
          status: 503,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        }),
      ),
    );
    const decodeAudioData = vi.fn(() => Promise.resolve({} as AudioBuffer));
    const createBufferSource = vi.fn(sourceNode);
    const context = {
      currentTime: 0,
      decodeAudioData,
      createBufferSource,
      createGain: vi.fn(gainNode),
    } as unknown as AudioContext;
    const { loadAllSfx, playSfx } = await import('../sfxRenderer');

    await loadAllSfx(context);

    expect(
      playSfx('spell-cast', gainNode() as unknown as GainNode, context, 0),
    ).toBeNull();
    expect(createBufferSource).not.toHaveBeenCalled();
  });

  it('plays every layer when the complete fixed cue is ready', async () => {
    const sources = [sourceNode(), sourceNode()];
    const decodeAudioData = vi.fn(() => Promise.resolve({} as AudioBuffer));
    const createBufferSource = vi.fn(() => sources.shift() ?? sourceNode());
    const createGain = vi.fn(gainNode);
    const context = {
      currentTime: 1.5,
      decodeAudioData,
      createBufferSource,
      createGain,
    } as unknown as AudioContext;
    const lane = gainNode() as unknown as GainNode;
    const { loadAllSfx, playSfx } = await import('../sfxRenderer');
    await loadAllSfx(context);
    const handle = playSfx('spell-cast', lane, context, 0.02);
    expect(handle).not.toBeNull();
    expect(createBufferSource).toHaveBeenCalledTimes(2);
    expect(createGain).toHaveBeenCalledTimes(2);
  });
});
