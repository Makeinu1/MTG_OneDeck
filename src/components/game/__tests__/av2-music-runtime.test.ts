import { beforeEach, describe, expect, it } from 'vitest';
import {
  createMusicRuntime,
  createNativeMediaPlan,
  getRememberedPosition,
  resetRememberedPosition,
  type MusicBusLanes,
} from '../presentation/musicBus';
import { DARK_GAME_TRACK } from '../presentation/trackManifest';

describe('musicBus pure plan', () => {
  it('creates one native-loop plan with transport bounds', () => {
    expect(createNativeMediaPlan(DARK_GAME_TRACK)).toEqual({
      src: DARK_GAME_TRACK.src,
      nativeLoop: true,
      loopStartSec: DARK_GAME_TRACK.loopStartSec,
      loopEndSec: DARK_GAME_TRACK.loopEndSec,
    });
  });
});

describe('musicBus runtime in jsdom (no Web Audio)', () => {
  it('returns an error runtime when Web Audio is unavailable', async () => {
    const runtime = createMusicRuntime(DARK_GAME_TRACK, {} as MusicBusLanes, {} as AudioContext);
    expect(runtime?.status).toBe('error');
    await expect(runtime?.resume()).resolves.toBe(false);
  });
});

describe('musicBus session position memory', () => {
  beforeEach(resetRememberedPosition);

  it('starts at zero after reset', () => {
    expect(getRememberedPosition()).toBe(0);
  });
});
