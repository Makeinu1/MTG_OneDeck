/**
 * audioVisualPreferences — Music と musical-event の独立設定・移行・実効可聴判定。
 * docs/audio-visual-contract.md §6(再生範囲・設定・autoplay)・ui-architecture-v2 §7.4。
 *
 * - 保存値が存在しない新規利用者は Music・musical-event とも既定 ON。
 * - 既存の明示的な音設定(legacy `mtg-onedeck:sound-enabled`)は musical-event へ
 *   移行するだけで、上書きしない。新しい保存設定は legacy キーより優先する。
 * - テーマ・route は保存値を書き換えず、テーマ別Trackと可聴出力だけを切り替える。
 * - localStorage 不可(private mode)・parse 失敗は既定 ON へ安全に倒す。
 */

import { getThemeTrackProfile, type AudioTheme, type TrackManifest } from './trackManifest';

export interface AudioPreferences {
  bgmEnabled: boolean;
  eventSoundsEnabled: boolean;
  bgmVolume?: number;   // 0-100, default 70
  sfxVolume?: number;   // 0-100, default 80
}

export interface AudioContextFlags {
  theme: AudioTheme;
  isGameScreen: boolean;
  userGestureUnlocked: boolean;
}

export interface EffectiveAudioState {
  musicAudible: boolean;
  eventsAudible: boolean;
}

export const AUDIO_PREFERENCES_STORAGE_KEY = 'mtg-onedeck:audio-preferences';

/** legacy な単一の音 ON/OFF キー(motion.ts と同一)。musical-event へ移行する。 */
const LEGACY_SOUND_STORAGE_KEY = 'mtg-onedeck:sound-enabled';

const DEFAULT_PREFERENCES: AudioPreferences = {
  bgmEnabled: true,
  eventSoundsEnabled: true,
  bgmVolume: 70,
  sfxVolume: 80,
};

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // private mode 等は読取不可 → 既定へ倒す。
  }
}

function parseStored(raw: string | null): AudioPreferences | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.bgmEnabled !== 'boolean' || typeof record.eventSoundsEnabled !== 'boolean') {
      return null;
    }
    const bgmVolume = typeof record.bgmVolume === 'number' && record.bgmVolume >= 0 && record.bgmVolume <= 100
      ? record.bgmVolume
      : 70;
    const sfxVolume = typeof record.sfxVolume === 'number' && record.sfxVolume >= 0 && record.sfxVolume <= 100
      ? record.sfxVolume
      : 80;
    return {
      bgmEnabled: record.bgmEnabled,
      eventSoundsEnabled: record.eventSoundsEnabled,
      bgmVolume,
      sfxVolume,
    };
  } catch {
    return null; // 壊れた JSON は既定へ倒す。
  }
}

/**
 * 保存設定を読む。新しい保存値が優先。無ければ legacy の明示的な音設定を
 * musical-event へ移行して読む。どちらも無ければ両方 ON の既定を返す。
 */
export function loadAudioPreferences(): AudioPreferences {
  const stored = parseStored(readRaw(AUDIO_PREFERENCES_STORAGE_KEY));
  if (stored !== null) return stored;

  const legacy = readRaw(LEGACY_SOUND_STORAGE_KEY);
  if (legacy === 'on' || legacy === 'off') {
    return {
      bgmEnabled: true,
      eventSoundsEnabled: legacy === 'on',
      bgmVolume: 70,
      sfxVolume: 80,
    };
  }

  return { ...DEFAULT_PREFERENCES };
}

/** Effective linear gains derived from preferences and audibility flags. */
export function getEffectiveGains(
  preferences: AudioPreferences,
  flags: { musicAudible: boolean; eventsAudible: boolean },
): { musicGain: number; sfxGain: number } {
  return {
    musicGain: flags.musicAudible ? (preferences.bgmVolume ?? 70) / 100 : 0,
    sfxGain: flags.eventsAudible ? (preferences.sfxVolume ?? 80) / 100 : 0,
  };
}

/** 独立した Music / musical-event 設定を永続する。legacy キーは触らない。 */
export function saveAudioPreferences(preferences: AudioPreferences): void {
  try {
    localStorage.setItem(AUDIO_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // private mode 等は書込不可 → 次回も既定/移行値へ倒す。ゲームは失敗しない。
  }
}

/**
 * 実効可聴状態。SFXはテーマにかかわらず、ゲーム画面でgesture解除済みなら
 * eventSoundsEnabledへ従う。BGMだけはテーマの有効Trackが必要になる。
 */
export function getEffectiveAudioState(
  preferences: AudioPreferences,
  flags: AudioContextFlags,
): EffectiveAudioState {
  const outputAllowed =
    flags.isGameScreen && flags.userGestureUnlocked;
  const track = getThemeTrackProfile(flags.theme).track;

  return {
    musicAudible: outputAllowed && track !== null && preferences.bgmEnabled,
    eventsAudible: outputAllowed && preferences.eventSoundsEnabled,
  };
}

/* ------------------------------------------------------------------ */
/*  AV2 runtime policy                                                 */
/* ------------------------------------------------------------------ */

export interface AudioVisualRuntimeFlags {
  theme: AudioTheme;
  isGameScreen: boolean;
  userGestureUnlocked: boolean;
  ambientMotionEnabled: boolean;
}

export interface AudioVisualRuntimePolicy {
  transportRunning: boolean;
  musicAudible: boolean;
  eventsAudible: boolean;
  track: TrackManifest | null;
}

/**
 * AV2 runtime policy: decides whether the real-track transport clock runs,
 * which lanes are audible, and which theme track supplies timing. Ambient
 * motion may keep an active theme track clock alive even when both audio lanes are off.
 */
export function getAudioVisualRuntimePolicy(
  preferences: AudioPreferences,
  flags: AudioVisualRuntimeFlags,
): AudioVisualRuntimePolicy {
  const inGame = flags.isGameScreen && flags.userGestureUnlocked;
  const track = inGame ? getThemeTrackProfile(flags.theme).track : null;

  if (!inGame) {
    return { transportRunning: false, musicAudible: false, eventsAudible: false, track };
  }

  const musicAudible = track !== null && preferences.bgmEnabled;
  const eventsAudible = preferences.eventSoundsEnabled;
  const transportRunning =
    track !== null && (musicAudible || eventsAudible || flags.ambientMotionEnabled);

  return {
    transportRunning,
    musicAudible,
    eventsAudible,
    track,
  };
}
