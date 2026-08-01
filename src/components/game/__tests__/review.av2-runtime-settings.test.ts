/**
 * review.av2-runtime-settings — M-AV AV2 の判定者専有ピン。
 * 長尺BGMのsingle native-loop境界、実効状態、背景時計、設定のfirst viewport配置を固定する。
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getAudioVisualRuntimePolicy,
} from '../presentation/audioVisualPreferences';
import {
  getTransportCssTiming,
} from '../presentation/audioVisualTransport';
import {
  createNativeMediaPlan,
} from '../presentation/musicBus';
import { DARK_GAME_TRACK } from '../presentation/trackManifest';

const ROOT = process.cwd();
const read = (path: string): string => readFileSync(resolve(ROOT, path), 'utf8');

describe('AV2 single native-loop music boundary', () => {
  it('plans exactly one native-loop stream for the full approved track', () => {
    expect(createNativeMediaPlan(DARK_GAME_TRACK)).toEqual({
      src: DARK_GAME_TRACK.src,
      nativeLoop: true,
      loopStartSec: 0,
      loopEndSec: 251.798458,
    });
  });

  it('uses one media element with native loop and no crossfade machinery', () => {
    const source = read('src/components/game/presentation/musicBus.ts');
    expect(source).toContain('createNativeMediaPlan');
    expect(source).toContain('createMediaElementSource');
    expect(source).toMatch(/\.loop\s*=\s*(?:plan\.nativeLoop|true)/);
    expect(source).toContain('resume(): Promise<boolean>');
    expect(source).not.toMatch(/decodeAudioData|AudioBufferSourceNode/);
    expect(source).not.toMatch(/createDualMediaPlan|equalPowerCrossfadeGains|crossfade/i);
    expect((source.match(/createElement\(['"]audio['"]\)/g) ?? [])).toHaveLength(1);
  });

  it('derives CSS beat duration and negative phase from sparse anchors across loops', () => {
    const firstSpanSec = DARK_GAME_TRACK.beatAnchors[1].atSeconds;
    const atStart = getTransportCssTiming(0, DARK_GAME_TRACK);
    const atHalfBeat = getTransportCssTiming(firstSpanSec / 64, DARK_GAME_TRACK);
    const atAnchor = getTransportCssTiming(firstSpanSec, DARK_GAME_TRACK);
    const afterLoop = getTransportCssTiming(
      DARK_GAME_TRACK.loopEndSec + firstSpanSec / 64,
      DARK_GAME_TRACK,
    );

    expect(atStart.beatMs).toBeCloseTo((firstSpanSec / 32) * 1000, 6);
    expect(atStart.phaseDelayMs).toBeCloseTo(0, 6);
    expect(atHalfBeat.phaseDelayMs).toBeCloseTo(-atHalfBeat.beatMs / 2, 6);
    expect(atAnchor.phaseDelayMs).toBeCloseTo(0, 6);
    expect(afterLoop).toEqual(atHalfBeat);
  });
});

describe('AV2 runtime policy', () => {
  const preferences = { bgmEnabled: true, eventSoundsEnabled: true };

  it('keeps an inaudible transport for dark-game ambient motion when BGM is OFF', () => {
    expect(getAudioVisualRuntimePolicy(
      { bgmEnabled: false, eventSoundsEnabled: false },
      {
        theme: 'dark',
        isGameScreen: true,
        userGestureUnlocked: true,
        ambientMotionEnabled: true,
      },
    )).toEqual({
      transportRunning: true,
      musicAudible: false,
      eventsAudible: false,
    });
  });

  it('is completely silent and stops the music transport outside dark game scope', () => {
    expect(getAudioVisualRuntimePolicy(preferences, {
      theme: 'light',
      isGameScreen: true,
      userGestureUnlocked: true,
      ambientMotionEnabled: true,
    })).toEqual({
      transportRunning: false,
      musicAudible: false,
      eventsAudible: false,
    });
    expect(getAudioVisualRuntimePolicy(preferences, {
      theme: 'dark',
      isGameScreen: false,
      userGestureUnlocked: true,
      ambientMotionEnabled: true,
    })).toEqual({
      transportRunning: false,
      musicAudible: false,
      eventsAudible: false,
    });
  });

  it('waits for an explicit gesture and stops when every dark-game lane is OFF', () => {
    expect(getAudioVisualRuntimePolicy(preferences, {
      theme: 'dark',
      isGameScreen: true,
      userGestureUnlocked: false,
      ambientMotionEnabled: true,
    }).transportRunning).toBe(false);
    expect(getAudioVisualRuntimePolicy(
      { bgmEnabled: false, eventSoundsEnabled: false },
      {
        theme: 'dark',
        isGameScreen: true,
        userGestureUnlocked: true,
        ambientMotionEnabled: false,
      },
    ).transportRunning).toBe(false);
  });
});

describe('AV2 production placement and background regression removal', () => {
  it('mounts one provider at the game root and unlocks on pointer or keyboard without input interception', () => {
    const screen = read('src/components/game/GameScreen.tsx');
    const provider = read('src/components/game/presentation/AudioVisualProvider.tsx');
    expect(screen).toContain('AudioVisualProvider');
    expect(provider).toContain('pointerdown');
    expect(provider).toContain('keydown');
    expect(provider).toContain('sessionGestureUnlocked');
    expect(provider).toContain('getTransportCssTiming');
    expect(provider).not.toContain("'--transport-phase-delay', '0ms'");
    expect(provider).not.toMatch(/preventDefault\(|stopPropagation\(/);
  });

  it('places BGM, game sounds, and ambient motion immediately after theme and before game actions', () => {
    const menu = read('src/components/game/ThumbZone.tsx');
    const theme = menu.indexOf('表示テーマ');
    const bgm = menu.indexOf('data-testid="menu-bgm"');
    const events = menu.indexOf('data-testid="menu-event-sounds"');
    const ambient = menu.indexOf('data-testid="menu-ambient"');
    const firstAction = menu.indexOf('data-testid="menu-token"');
    expect(theme).toBeGreaterThanOrEqual(0);
    expect(theme).toBeLessThan(bgm);
    expect(bgm).toBeLessThan(events);
    expect(events).toBeLessThan(ambient);
    expect(ambient).toBeLessThan(firstAction);
    expect(menu).toContain('ライトテーマでは音は流れません');
    expect(menu).toContain('最初の操作で再生');
    expect(menu).toContain('音を開始できませんでした');
  });

  it('keeps the modal settings sheet above the persistent hand-zone rail', () => {
    const css = read('src/components/game/game.css');
    const sheetZIndex = Number(
      css.match(/\.game-sheet-overlay\s*\{[^}]*z-index:\s*(\d+)/)?.[1],
    );
    const handZoneZIndex = Number(
      css.match(/\.hand-ribbon__zones\s*\{[^}]*z-index:\s*(\d+)/)?.[1],
    );
    expect(sheetZIndex).toBeGreaterThan(handZoneZIndex);
  });

  it('removes combat-tempo/heat branches and lets ready transport override only the 700ms fallback', () => {
    const motion = read('src/components/game/ambientMotion.ts');
    const css = read('src/components/game/game.css');
    const backdrop = read('src/components/game/AmbientBackdrop.tsx');
    expect(motion).not.toContain('AMBIENT_BEAT_COMBAT_MS');
    expect(css).not.toContain('ambient-core-beat-combat');
    expect(css).not.toContain('ambient-combat-edge');
    expect(backdrop).not.toContain('ambient-combat-edge');
    expect(css).toContain('--transport-beat-ms');
    expect(css).toContain('--transport-phase-delay');
    expect(css).toContain('var(--ambient-beat)');
    expect(css).not.toMatch(/--transport-(?:beat-ms|phase-delay):\s*;/);
    expect(css).toMatch(/\.ambient-core[\s\S]*animation-delay:\s*var\(--transport-phase-delay,\s*0ms\)/);
    expect(css).toMatch(/ambient-stack-underline[\s\S]*animation-delay:\s*var\(--transport-phase-delay,\s*0ms\)/);
    expect(css).toMatch(/ambient-heart-throb[\s\S]*animation-delay:\s*var\(--transport-phase-delay,\s*0ms\)/);

    const tokens = read('src/ui/tokens.css');
    expect(tokens).not.toContain('--ambient-core-combat');
    expect(tokens).not.toContain('--ambient-edge-heat');
  });
});
