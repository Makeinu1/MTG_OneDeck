/**
 * av0-presentation — AV0 presentation モジュールの通常テスト(実装者所有)。
 * review.av0-contract / review.d5-motion は判定者専有ピン。本ファイルは境界ケース
 * (不正 manifest・ループ巻戻り・storage 失敗・実効無音)を通常テストで押さえる。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AUDIO_PREFERENCES_STORAGE_KEY,
  getEffectiveAudioState,
  getAudioVisualRuntimePolicy,
  loadAudioPreferences,
  saveAudioPreferences,
} from '../audioVisualPreferences';
import {
  getNextGridDelayMs,
  validateTrackManifest,
} from '../audioVisualTransport';
import { AUDIO_VISUAL_TUNING } from '../presentationTuning';
import {
  DARK_GAME_TRACK,
  LIGHT_GAME_TRACK,
  getThemeTrack,
  type TrackManifest,
} from '../trackManifest';

const LEGACY_SOUND_STORAGE_KEY = 'mtg-onedeck:sound-enabled';

describe('validateTrackManifest (不正 manifest)', () => {
  it('dark/light の合格 manifest はエラー0件', () => {
    expect(validateTrackManifest(DARK_GAME_TRACK)).toEqual([]);
    expect(validateTrackManifest(LIGHT_GAME_TRACK)).toEqual([]);
  });

  it('pins the selected light production asset', () => {
    expect(LIGHT_GAME_TRACK.src).toContain('audio/bgm/light-theme.mp3');
    expect(LIGHT_GAME_TRACK.sha256).toBe(
      'd73ab88a9a665dd684376d9e167f66297d909a6a63a6de195dcc455023c15148',
    );
  });

  it('不正 sha256 を検出する', () => {
    const bad: TrackManifest = { ...DARK_GAME_TRACK, sha256: 'not-a-hash' };
    expect(validateTrackManifest(bad).length).toBeGreaterThan(0);
  });

  it('anchor の atSeconds が単調増加でなければ検出する', () => {
    const bad: TrackManifest = {
      ...DARK_GAME_TRACK,
      beatAnchors: [
        { beatIndex: 0, atSeconds: 0 },
        { beatIndex: 32, atSeconds: 10 },
        { beatIndex: 64, atSeconds: 10 },
      ],
    };
    expect(validateTrackManifest(bad).some((e) => e.includes('strictly increasing'))).toBe(true);
  });

  it('beatIndex が正の整数で増えなければ検出する', () => {
    const bad: TrackManifest = {
      ...DARK_GAME_TRACK,
      beatAnchors: [
        { beatIndex: 0, atSeconds: 0 },
        { beatIndex: 0, atSeconds: 10 },
      ],
    };
    expect(validateTrackManifest(bad).some((e) => e.includes('positive integer'))).toBe(true);
  });

  it('anchor が2未満なら検出する', () => {
    const bad: TrackManifest = {
      ...DARK_GAME_TRACK,
      beatAnchors: [{ beatIndex: 0, atSeconds: 0 }],
    };
    expect(validateTrackManifest(bad).some((e) => e.includes('at least two'))).toBe(true);
  });

  it('loopEndSec が loopStartSec 以下なら検出する', () => {
    const bad: TrackManifest = {
      ...DARK_GAME_TRACK,
      loopStartSec: 100,
      loopEndSec: 50,
    };
    expect(validateTrackManifest(bad).length).toBeGreaterThan(0);
  });
});

describe('getNextGridDelayMs (ループ巻戻り・境界)', () => {
  it('ループ終端の直前は巻戻って先頭グリッドへ吸着する', () => {
    // loopEndSec の直前。次のグリッドは巻戻り後の loopStartSec(=0)。
    const nearEnd = DARK_GAME_TRACK.loopEndSec - 0.01;
    const delay = getNextGridDelayMs(nearEnd, DARK_GAME_TRACK, AUDIO_VISUAL_TUNING);
    // 巻戻り後の先頭グリッドまでの距離は loopEndSec - nearEnd に等しい(=10ms)。
    expect(delay).toBeCloseTo(10, 1);
  });

  it('ループ長を超えた位置も巻いて扱う', () => {
    const loop = DARK_GAME_TRACK.loopEndSec;
    const wrapped = getNextGridDelayMs(15.7 + loop, DARK_GAME_TRACK, AUDIO_VISUAL_TUNING);
    const plain = getNextGridDelayMs(15.7, DARK_GAME_TRACK, AUDIO_VISUAL_TUNING);
    expect(wrapped).toBeCloseTo(plain, 6);
  });

  it('負の位置も巻いて扱う', () => {
    const loop = DARK_GAME_TRACK.loopEndSec;
    const wrapped = getNextGridDelayMs(15.7 - loop, DARK_GAME_TRACK, AUDIO_VISUAL_TUNING);
    expect(wrapped).toBeCloseTo(
      getNextGridDelayMs(15.7, DARK_GAME_TRACK, AUDIO_VISUAL_TUNING),
      6,
    );
  });

  it('snap window 外は即時再生の 0', () => {
    expect(getNextGridDelayMs(15.65, DARK_GAME_TRACK, AUDIO_VISUAL_TUNING)).toBe(0);
  });

  it('不正な現在位置は 0 へ倒す', () => {
    expect(getNextGridDelayMs(Number.NaN, DARK_GAME_TRACK, AUDIO_VISUAL_TUNING)).toBe(0);
  });
});

describe('audioVisualPreferences (storage 失敗・parse 失敗)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('壊れた JSON は既定 ON へ倒す', () => {
    localStorage.setItem(AUDIO_PREFERENCES_STORAGE_KEY, '{not-json');
    expect(loadAudioPreferences()).toEqual({
      bgmEnabled: true,
      eventSoundsEnabled: true,
      bgmVolume: 70,
      sfxVolume: 80,
    });
  });

  it('型違いの保存値は既定 ON へ倒す', () => {
    localStorage.setItem(
      AUDIO_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ bgmEnabled: 'yes', eventSoundsEnabled: 1 }),
    );
    expect(loadAudioPreferences()).toEqual({
      bgmEnabled: true,
      eventSoundsEnabled: true,
      bgmVolume: 70,
      sfxVolume: 80,
    });
  });

  it('新しい保存値は legacy キーより優先する', () => {
    localStorage.setItem(LEGACY_SOUND_STORAGE_KEY, 'off');
    saveAudioPreferences({ bgmEnabled: false, eventSoundsEnabled: true });
    expect(loadAudioPreferences()).toEqual({
      bgmEnabled: false,
      eventSoundsEnabled: true,
      bgmVolume: 70,
      sfxVolume: 80,
    });
  });

  it('private mode の getItem 失敗は既定 ON へ倒す', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(loadAudioPreferences()).toEqual({
      bgmEnabled: true,
      eventSoundsEnabled: true,
      bgmVolume: 70,
      sfxVolume: 80,
    });
  });

  it('private mode の setItem 失敗は例外を投げない', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() =>
      saveAudioPreferences({ bgmEnabled: false, eventSoundsEnabled: false }),
    ).not.toThrow();
  });
});

describe('getEffectiveAudioState (実効無音の境界)', () => {
  const on = { bgmEnabled: true, eventSoundsEnabled: true };

  it('ライトテーマは選択済みBGMとゲーム進行音が可聴', () => {
    expect(
      getEffectiveAudioState(on, {
        theme: 'light',
        isGameScreen: true,
        userGestureUnlocked: true,
      }),
    ).toEqual({ musicAudible: true, eventsAudible: true });
  });

  it('ゲーム外画面は実効無音', () => {
    expect(
      getEffectiveAudioState(on, {
        theme: 'dark',
        isGameScreen: false,
        userGestureUnlocked: true,
      }),
    ).toEqual({ musicAudible: false, eventsAudible: false });
  });

  it('gesture 前は実効無音', () => {
    expect(
      getEffectiveAudioState(on, {
        theme: 'dark',
        isGameScreen: true,
        userGestureUnlocked: false,
      }),
    ).toEqual({ musicAudible: false, eventsAudible: false });
  });

  it('設定 OFF は可聴条件を満たしても無音', () => {
    expect(
      getEffectiveAudioState(
        { bgmEnabled: false, eventSoundsEnabled: false },
        { theme: 'dark', isGameScreen: true, userGestureUnlocked: true },
      ),
    ).toEqual({ musicAudible: false, eventsAudible: false });
  });
});

describe('theme track profile and runtime policy', () => {
  const on = { bgmEnabled: true, eventSoundsEnabled: true };

  it('keeps the dark track and activates the selected light track', () => {
    expect(getThemeTrack('dark')).toBe(DARK_GAME_TRACK);
    expect(getThemeTrack('light')).toBe(LIGHT_GAME_TRACK);
  });

  it('uses the light track for BGM, SFX, and transport timing', () => {
    expect(getAudioVisualRuntimePolicy(on, {
      theme: 'light',
      isGameScreen: true,
      userGestureUnlocked: true,
      ambientMotionEnabled: true,
    })).toEqual({
      transportRunning: true,
      musicAudible: true,
      eventsAudible: true,
      track: LIGHT_GAME_TRACK,
    });
  });

  it('does not activate a theme track before gesture unlock', () => {
    expect(getAudioVisualRuntimePolicy(on, {
      theme: 'dark',
      isGameScreen: true,
      userGestureUnlocked: false,
      ambientMotionEnabled: true,
    })).toEqual({
      transportRunning: false,
      musicAudible: false,
      eventsAudible: false,
      track: null,
    });
  });

  it('keeps dark BGM transport alive when event SFX is enabled', () => {
    expect(getAudioVisualRuntimePolicy(
      { bgmEnabled: false, eventSoundsEnabled: true },
      {
        theme: 'dark',
        isGameScreen: true,
        userGestureUnlocked: true,
        ambientMotionEnabled: false,
      },
    )).toMatchObject({
      transportRunning: true,
      musicAudible: false,
      eventsAudible: true,
      track: DARK_GAME_TRACK,
    });
  });
});
