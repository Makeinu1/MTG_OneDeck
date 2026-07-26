/**
 * sfxRenderer — ordinary tests for OfflineAudioContext rendering and playback.
 * jsdom lacks OfflineAudioContext, so we mock it for render tests.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mock OfflineAudioContext for jsdom                                 */
/* ------------------------------------------------------------------ */

function createMockAudioBuffer() {
  const data = new Float32Array(4800);
  return {
    length: 4800,
    duration: 0.1,
    sampleRate: 48000,
    numberOfChannels: 2,
    getChannelData: () => data,
    copyFromChannel: () => {},
    copyToChannel: () => {},
  };
}

function createMockGainNode() {
  return {
    gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function createMockOscillatorNode() {
  return {
    type: 'sine' as const,
    frequency: { value: 440, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    detune: { value: 0 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
    onended: null,
  };
}

function createMockBufferSourceNode() {
  return {
    buffer: null as unknown,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
    onended: null as (() => void) | null,
  };
}

class MockOfflineAudioContext {
  numberOfChannels: number;
  length: number;
  sampleRate: number;
  destination = { connect: vi.fn() };

  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
  }

  createGain() { return createMockGainNode(); }
  createOscillator() { return createMockOscillatorNode(); }
  createBufferSource() { return createMockBufferSourceNode(); }
  createBiquadFilter() {
    return {
      type: 'lowpass' as const,
      frequency: { value: 1000, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
      Q: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
  createConvolver() {
    return {
      buffer: null as unknown,
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
  createBuffer(channels: number, bufLength: number, bufSampleRate: number) {
    const data = new Float32Array(bufLength);
    return {
      length: bufLength,
      duration: bufLength / bufSampleRate,
      sampleRate: bufSampleRate,
      numberOfChannels: channels,
      getChannelData: () => data,
      copyFromChannel: () => {},
      copyToChannel: () => {},
    };
  }
  startRendering(): Promise<ReturnType<typeof createMockAudioBuffer>> {
    return Promise.resolve(createMockAudioBuffer());
  }
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('sfxRenderer', () => {
  let originalOAC: typeof globalThis.OfflineAudioContext;

  beforeEach(() => {
    originalOAC = globalThis.OfflineAudioContext;
    // Install mock
    (globalThis as Record<string, unknown>).OfflineAudioContext = MockOfflineAudioContext;
    // Reset module cache between tests
    vi.resetModules();
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).OfflineAudioContext = originalOAC;
    vi.restoreAllMocks();
  });

  it('renderAllPatches resolves without throwing', async () => {
    const { renderAllPatches } = await import('../sfxRenderer');
    await expect(renderAllPatches()).resolves.toBeUndefined();
  });

  it('isSfxReady is false before render and true after', async () => {
    const { isSfxReady, renderAllPatches } = await import('../sfxRenderer');
    expect(isSfxReady()).toBe(false);
    await renderAllPatches();
    expect(isSfxReady()).toBe(true);
  });

  it('playSfx with missing buffer does not throw', async () => {
    const { playSfx } = await import('../sfxRenderer');
    const lane = createMockGainNode();
    const ctx = {
      currentTime: 0,
      createBufferSource: () => createMockBufferSourceNode(),
    };
    // No buffers cached yet — should not throw
    expect(() => playSfx('spell-cast', lane as unknown as GainNode, ctx as unknown as AudioContext, 0)).not.toThrow();
  });

  it('playSfx returns null when no buffer is cached', async () => {
    const { playSfx } = await import('../sfxRenderer');
    const lane = createMockGainNode();
    const ctx = {
      currentTime: 0,
      createBufferSource: () => createMockBufferSourceNode(),
    };
    const result = playSfx('land-played', lane as unknown as GainNode, ctx as unknown as AudioContext, 0);
    expect(result).toBeNull();
  });

  it('playSfx returns a source node after render', async () => {
    const { renderAllPatches, playSfx } = await import('../sfxRenderer');
    await renderAllPatches();
    const lane = createMockGainNode();
    const mockSource = createMockBufferSourceNode();
    const ctx = {
      currentTime: 1.5,
      createBufferSource: () => mockSource,
    };
    const result = playSfx('turn-advanced', lane as unknown as GainNode, ctx as unknown as AudioContext, 0.02);
    expect(result).toBe(mockSource);
    expect(mockSource.connect).toHaveBeenCalledWith(lane);
    expect(mockSource.start).toHaveBeenCalledWith(1.52);
  });

  it('renders commander-cast patch (with osc filters) without throwing', async () => {
    const { renderAllPatches, isSfxReady } = await import('../sfxRenderer');
    await renderAllPatches();
    expect(isSfxReady()).toBe(true);
  });

  it('osc layer with filterType routes through BiquadFilter', async () => {
    // The commander-cast patch has sawtooth layers with filterType='lowpass'.
    // If the renderer correctly inserts a BiquadFilterNode, createBiquadFilter
    // will be called during rendering. We verify indirectly: render succeeds
    // and the mock context's createBiquadFilter is exercised.
    const filterSpy = vi.fn(() => ({
      type: 'lowpass' as const,
      frequency: { value: 1000, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
      Q: { value: 1 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    }));

    class SpyOfflineAudioContext extends MockOfflineAudioContext {
      createBiquadFilter() { return filterSpy(); }
    }
    (globalThis as Record<string, unknown>).OfflineAudioContext = SpyOfflineAudioContext;

    vi.resetModules();
    const { renderAllPatches } = await import('../sfxRenderer');
    await renderAllPatches();

    // Commander patch has 4 osc layers with filterType + 1 noise with filterType = at least 5
    expect(filterSpy.mock.calls.length).toBeGreaterThanOrEqual(5);
  });
});
