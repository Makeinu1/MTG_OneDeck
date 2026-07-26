/**
 * audioVisualPreferences — Music と musical-event の独立設定・移行・実効可聴判定。
 * docs/audio-visual-contract.md §6(再生範囲・設定・autoplay)・ui-architecture-v2 §7.4。
 *
 * - 保存値が存在しない新規利用者は Music・musical-event とも既定 ON。
 * - 既存の明示的な音設定(legacy `mtg-onedeck:sound-enabled`)は musical-event へ
 *   移行するだけで、上書きしない。新しい保存設定は legacy キーより優先する。
 * - テーマ・route は保存値を書き換えず、可聴出力だけを停止する(実効無音)。
 * - localStorage 不可(private mode)・parse 失敗は既定 ON へ安全に倒す。
 */

export interface AudioPreferences {
  bgmEnabled: boolean;
  eventSoundsEnabled: boolean;
  bgmVolume?: number;   // 0-100, default 70
  sfxVolume?: number;   // 0-100, default 80
}

export interface AudioContextFlags {
  theme: 'dark' | 'light';
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
 * 実効可聴状態。保存設定は書き換えず、ダークのゲーム画面で gesture 解除済みの
 * ときだけ各レーンの設定を可聴へ反映する。それ以外(ライト・ゲーム外・gesture前)
 * は両レーンを実効無音にする。
 */
export function getEffectiveAudioState(
  preferences: AudioPreferences,
  flags: AudioContextFlags,
): EffectiveAudioState {
  const outputAllowed =
    flags.theme === 'dark' && flags.isGameScreen && flags.userGestureUnlocked;

  return {
    musicAudible: outputAllowed && preferences.bgmEnabled,
    eventsAudible: outputAllowed && preferences.eventSoundsEnabled,
  };
}

/* ------------------------------------------------------------------ */
/*  AV2 runtime policy                                                 */
/* ------------------------------------------------------------------ */

export interface AudioVisualRuntimeFlags {
  theme: 'dark' | 'light';
  isGameScreen: boolean;
  userGestureUnlocked: boolean;
  ambientMotionEnabled: boolean;
}

export interface AudioVisualRuntimePolicy {
  transportRunning: boolean;
  musicAudible: boolean;
  eventsAudible: boolean;
}

/**
 * AV2 runtime policy: decides whether the transport clock runs and
 * which lanes are audible. The transport stays alive (inaudible) when
 * dark-game ambient motion is ON even if BGM and event sounds are OFF,
 * so the background clock can drive CSS animations.
 */
export function getAudioVisualRuntimePolicy(
  preferences: AudioPreferences,
  flags: AudioVisualRuntimeFlags,
): AudioVisualRuntimePolicy {
  const inDarkGame =
    flags.theme === 'dark' && flags.isGameScreen && flags.userGestureUnlocked;

  if (!inDarkGame) {
    return { transportRunning: false, musicAudible: false, eventsAudible: false };
  }

  const musicAudible = preferences.bgmEnabled;
  const eventsAudible = preferences.eventSoundsEnabled;
  const anyLaneActive =
    musicAudible || eventsAudible || flags.ambientMotionEnabled;

  return {
    transportRunning: anyLaneActive,
    musicAudible,
    eventsAudible,
  };
}
