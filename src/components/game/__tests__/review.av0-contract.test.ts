/**
 * review.av0-contract — M-AV AV0 の判定者専有ピン。
 * これが落ちたら review を緩めず、presentation 実装を契約へ合わせる。
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  AUDIO_PREFERENCES_STORAGE_KEY,
  getEffectiveAudioState,
  loadAudioPreferences,
  saveAudioPreferences,
} from '../presentation/audioVisualPreferences';
import {
  getNextGridDelayMs,
  validateTrackManifest,
} from '../presentation/audioVisualTransport';
import {
  AUDIO_VISUAL_TUNING,
  COMMANDER_MIX_TUNING,
} from '../presentation/presentationTuning';
import { DARK_GAME_TRACK } from '../presentation/trackManifest';

const ROOT = process.cwd();
const PUBLIC_TRACK = resolve(
  ROOT,
  'public/audio/bgm/candidate-b-tight-128-bars.mp3',
);
const LEGACY_SOUND_STORAGE_KEY = 'mtg-onedeck:sound-enabled';

describe('AV0 frozen track and tuning', () => {
  it('pins the selected 128-bar MP3 and a valid sparse-anchor manifest', () => {
    expect(DARK_GAME_TRACK).toMatchObject({
      id: 'candidate-b-tight-128-bars',
      sha256: '6307839cab73c84265023ce2a8cdb489355f3f48a3ef9c94d8cdb6b6190dde0c',
      bpmNominal: 122.000736,
      loopStartSec: 0,
      loopEndSec: 251.798458,
      gainDb: -4.5,
      sections: [],
    });
    expect(DARK_GAME_TRACK).not.toHaveProperty('crossfadeMs');
    expect(DARK_GAME_TRACK.beatAnchors).toHaveLength(17);
    expect(DARK_GAME_TRACK.beatAnchors.at(0)).toEqual({
      beatIndex: 0,
      atSeconds: 0,
    });
    expect(DARK_GAME_TRACK.beatAnchors.at(-1)).toEqual({
      beatIndex: 512,
      atSeconds: 251.798458,
    });
    expect(validateTrackManifest(DARK_GAME_TRACK)).toEqual([]);

    for (let index = 1; index < DARK_GAME_TRACK.beatAnchors.length; index += 1) {
      const previous = DARK_GAME_TRACK.beatAnchors[index - 1];
      const current = DARK_GAME_TRACK.beatAnchors[index];
      expect(current.beatIndex - previous.beatIndex).toBe(32);
      expect(current.atSeconds).toBeGreaterThan(previous.atSeconds);
    }
  });

  it('ships the exact approved MP3, not the WAV-master hash', () => {
    expect(existsSync(PUBLIC_TRACK)).toBe(true);
    const digest = createHash('sha256')
      .update(readFileSync(PUBLIC_TRACK))
      .digest('hex');
    expect(digest).toBe(DARK_GAME_TRACK.sha256);
  });

  it('keeps bounded quantization and the approved commander duck envelope', () => {
    expect(AUDIO_VISUAL_TUNING).toEqual({
      quantizeStepsPerBeat: 4,
      snapWindowMs: 60,
      maxInteractionAudioDelayMs: 80,
    });
    expect(COMMANDER_MIX_TUNING).toEqual({
      duckDb: -4,
      attackMs: 40,
      holdMs: 360,
      releaseMs: 320,
    });
  });

  it('subdivides the full 32-beat anchor span and falls back to immediate outside the snap window', () => {
    expect(
      getNextGridDelayMs(15.7, DARK_GAME_TRACK, AUDIO_VISUAL_TUNING),
    ).toBeCloseTo(37.404, 2);
    expect(
      getNextGridDelayMs(15.65, DARK_GAME_TRACK, AUDIO_VISUAL_TUNING),
    ).toBe(0);
  });
});

describe('audio preference and effective-silence boundary', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults both audio lanes ON only when no saved preference exists', () => {
    expect(loadAudioPreferences()).toEqual({
      bgmEnabled: true,
      eventSoundsEnabled: true,
      bgmVolume: 70,
      sfxVolume: 80,
    });
  });

  it('migrates an explicit legacy event-sound preference without overriding it', () => {
    localStorage.setItem(LEGACY_SOUND_STORAGE_KEY, 'off');
    expect(loadAudioPreferences()).toEqual({
      bgmEnabled: true,
      eventSoundsEnabled: false,
      bgmVolume: 70,
      sfxVolume: 80,
    });
  });

  it('persists independent BGM and event-sound choices', () => {
    saveAudioPreferences({
      bgmEnabled: false,
      eventSoundsEnabled: true,
    });
    expect(localStorage.getItem(AUDIO_PREFERENCES_STORAGE_KEY)).not.toBeNull();
    expect(loadAudioPreferences()).toEqual({
      bgmEnabled: false,
      eventSoundsEnabled: true,
      bgmVolume: 70,
      sfxVolume: 80,
    });
  });

  it('keeps preferences but makes light, non-game, and pre-gesture output silent', () => {
    const preferences = { bgmEnabled: true, eventSoundsEnabled: true };
    expect(getEffectiveAudioState(preferences, {
      theme: 'dark',
      isGameScreen: true,
      userGestureUnlocked: true,
    })).toEqual({ musicAudible: true, eventsAudible: true });
    expect(getEffectiveAudioState(preferences, {
      theme: 'light',
      isGameScreen: true,
      userGestureUnlocked: true,
    })).toEqual({ musicAudible: false, eventsAudible: false });
    expect(getEffectiveAudioState(preferences, {
      theme: 'dark',
      isGameScreen: false,
      userGestureUnlocked: true,
    })).toEqual({ musicAudible: false, eventsAudible: false });
    expect(getEffectiveAudioState(preferences, {
      theme: 'dark',
      isGameScreen: true,
      userGestureUnlocked: false,
    })).toEqual({ musicAudible: false, eventsAudible: false });
  });
});
