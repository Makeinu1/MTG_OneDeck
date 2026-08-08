/**
 * Judge-owned feel-9 pin: light semantic SFX and optional theme BGM wiring.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getAudioVisualRuntimePolicy,
  getEffectiveAudioState,
} from '../presentation/audioVisualPreferences';
import { createMusicRuntime, createNativeMediaPlan, type MusicBusLanes } from '../presentation/musicBus';
import { presentationSoundDelayMs } from '../presentation/semanticSound';
import {
  DARK_GAME_TRACK,
  LIGHT_GAME_TRACK,
  getThemeTrack,
} from '../presentation/trackManifest';

const ROOT = process.cwd();
const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');

describe('feel-9/10 light theme audio boundary', () => {
  const enabled = { bgmEnabled: true, eventSoundsEnabled: true };

  it('keeps dark BGM and pins the selected light BGM asset', () => {
    expect(getThemeTrack('dark')).toBe(DARK_GAME_TRACK);
    expect(getThemeTrack('light')).toBe(LIGHT_GAME_TRACK);
    expect(createNativeMediaPlan(LIGHT_GAME_TRACK)).toEqual({
      src: LIGHT_GAME_TRACK.src,
      nativeLoop: true,
      loopStartSec: 0,
      loopEndSec: 362.879979,
    });
    const asset = readFileSync(resolve(ROOT, 'public/audio/bgm/light-theme.mp3'));
    expect(createHash('sha256').update(asset).digest('hex')).toBe(LIGHT_GAME_TRACK.sha256);
  });

  it('allows light game BGM and SFX after gesture', () => {
    expect(getEffectiveAudioState(enabled, {
      theme: 'light',
      isGameScreen: true,
      userGestureUnlocked: true,
    })).toEqual({ musicAudible: true, eventsAudible: true });
    expect(getAudioVisualRuntimePolicy(enabled, {
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

  it('uses the light track grid and preserves future null-track immediacy', () => {
    expect(presentationSoundDelayMs(123.45, null)).toBe(0);
    expect(presentationSoundDelayMs(15.7, DARK_GAME_TRACK)).toBeCloseTo(37.404, 2);
    expect(presentationSoundDelayMs(16.1, LIGHT_GAME_TRACK)).toBeCloseTo(59.101, 2);
  });

  it('does not allow light SFX outside the unlocked game screen', () => {
    expect(getEffectiveAudioState(enabled, {
      theme: 'light',
      isGameScreen: true,
      userGestureUnlocked: false,
    })).toEqual({ musicAudible: false, eventsAudible: false });
    expect(getEffectiveAudioState(enabled, {
      theme: 'light',
      isGameScreen: false,
      userGestureUnlocked: true,
    })).toEqual({ musicAudible: false, eventsAudible: false });
  });

  it('does not create a media runtime for a future null track', () => {
    expect(createMusicRuntime(null, {} as MusicBusLanes, {} as AudioContext)).toBeNull();
    const musicBus = read('src/components/game/presentation/musicBus.ts');
    const provider = read('src/components/game/presentation/AudioVisualProvider.tsx');
    const semantic = read('src/components/game/presentation/SemanticPresentationLayer.tsx');
    expect(musicBus).toContain('if (manifest === null) return null;');
    expect(provider).toContain('ensureSessionRuntime(getThemeTrack(resolvedTheme()))');
    expect(semantic).toContain('if (!policyRef.current.eventsAudible) return;');
    expect(semantic).not.toMatch(/eventsAudible\s*\|\|\s*!policyRef\.current\.transportRunning/);
  });

  it('keeps the light hint on BGM only and removes obsolete silence copy', () => {
    const menu = read('src/components/game/ThumbZone.tsx');
    expect(menu).not.toContain('ライト用BGMは未選択');
    expect(menu).not.toContain('ライトテーマでは音は流れません');
    expect(menu).toContain('data-testid="menu-event-sounds"');
  });
});
