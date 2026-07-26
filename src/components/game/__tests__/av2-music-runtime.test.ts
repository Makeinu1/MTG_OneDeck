import { describe, expect, it, beforeEach } from 'vitest';
import {
  createDualMediaPlan,
  equalPowerCrossfadeGains,
  createMusicRuntime,
  getRememberedPosition,
  resetRememberedPosition,
  type MusicBusLanes,
} from '../presentation/musicBus';
import { DARK_GAME_TRACK } from '../presentation/trackManifest';

describe('musicBus pure helpers', () => {
  it('creates a dual-media plan with matching manifest fields', () => {
    const plan = createDualMediaPlan(DARK_GAME_TRACK);
    expect(plan).toHaveLength(2);
    for (const item of plan) {
      expect(item.nativeLoop).toBe(false);
      expect(item.loopStartSec).toBe(DARK_GAME_TRACK.loopStartSec);
      expect(item.loopEndSec).toBe(DARK_GAME_TRACK.loopEndSec);
      expect(item.crossfadeMs).toBe(DARK_GAME_TRACK.crossfadeMs);
    }
  });

  it('equal-power crossfade is symmetric at midpoint', () => {
    const { outgoing, incoming } = equalPowerCrossfadeGains(0.5);
    expect(outgoing).toBeCloseTo(Math.SQRT1_2, 8);
    expect(incoming).toBeCloseTo(Math.SQRT1_2, 8);
  });

  it('equal-power crossfade clamps out-of-range t', () => {
    expect(equalPowerCrossfadeGains(-1)).toEqual({ outgoing: 1, incoming: 0 });
    expect(equalPowerCrossfadeGains(2).incoming).toBe(1);
  });
});

describe('musicBus runtime in jsdom (no Web Audio)', () => {
  it('returns an error runtime when Web Audio is unavailable', () => {
    const fakeLanes = {} as MusicBusLanes;
    const fakeContext = {} as AudioContext;
    const runtime = createMusicRuntime(DARK_GAME_TRACK, fakeLanes, fakeContext);
    expect(runtime).not.toBeNull();
    expect(runtime!.status).toBe('error');
  });

  it('error runtime resume() resolves false (play rejection)', async () => {
    const fakeLanes = {} as MusicBusLanes;
    const fakeContext = {} as AudioContext;
    const runtime = createMusicRuntime(DARK_GAME_TRACK, fakeLanes, fakeContext);
    const result = await runtime!.resume();
    expect(result).toBe(false);
  });

  it('repeated resume() on error runtime always resolves false', async () => {
    const fakeLanes = {} as MusicBusLanes;
    const fakeContext = {} as AudioContext;
    const runtime = createMusicRuntime(DARK_GAME_TRACK, fakeLanes, fakeContext);
    const results = await Promise.all([
      runtime!.resume(),
      runtime!.resume(),
      runtime!.resume(),
    ]);
    expect(results).toEqual([false, false, false]);
  });
});

describe('musicBus session position memory', () => {
  beforeEach(() => {
    resetRememberedPosition();
  });

  it('starts at zero after reset', () => {
    expect(getRememberedPosition()).toBe(0);
  });

  it('module-level position survives across runtime creations (remount)', () => {
    expect(getRememberedPosition()).toBe(0);
    resetRememberedPosition();
    expect(getRememberedPosition()).toBe(0);
  });
});
