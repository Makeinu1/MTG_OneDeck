/**
 * trackManifest — AV0 凍結済みの基準曲 TrackManifest。
 * docs/audio-visual-contract.md §6 に凍結された値のみを保持する。
 */

export interface BeatAnchor {
  beatIndex: number;
  atSeconds: number;
}

export interface TrackSection {
  kind: 'groove' | 'break' | 'rejoin';
  startSec: number;
  endSec: number;
}

export interface TrackManifest {
  id: string;
  src: string;
  sha256: string;
  bpmNominal: number;
  loopStartSec: number;
  loopEndSec: number;
  gainDb: number;
  beatAnchors: BeatAnchor[];
  sections: TrackSection[];
}

export type AudioTheme = 'dark' | 'light';

export interface ThemeTrackProfile {
  theme: AudioTheme;
  track: TrackManifest | null;
}

export const DARK_GAME_TRACK: TrackManifest = {
  id: 'candidate-b-tight-128-bars',
  src: `${import.meta.env.BASE_URL}audio/bgm/candidate-b-tight-128-bars.mp3`,
  sha256: '6307839cab73c84265023ce2a8cdb489355f3f48a3ef9c94d8cdb6b6190dde0c',
  bpmNominal: 122.000736,
  loopStartSec: 0,
  loopEndSec: 251.798458,
  gainDb: -4.5,
  beatAnchors: [
    { beatIndex: 0, atSeconds: 0 },
    { beatIndex: 32, atSeconds: 15.737404 },
    { beatIndex: 64, atSeconds: 31.474808 },
    { beatIndex: 96, atSeconds: 47.212211 },
    { beatIndex: 128, atSeconds: 62.949615 },
    { beatIndex: 160, atSeconds: 78.687019 },
    { beatIndex: 192, atSeconds: 94.424423 },
    { beatIndex: 224, atSeconds: 110.161826 },
    { beatIndex: 256, atSeconds: 125.89923 },
    { beatIndex: 288, atSeconds: 141.636634 },
    { beatIndex: 320, atSeconds: 157.374038 },
    { beatIndex: 352, atSeconds: 173.111442 },
    { beatIndex: 384, atSeconds: 188.848845 },
    { beatIndex: 416, atSeconds: 204.586249 },
    { beatIndex: 448, atSeconds: 220.323653 },
    { beatIndex: 480, atSeconds: 236.061057 },
    { beatIndex: 512, atSeconds: 251.798458 },
  ],
  sections: [],
};

/** User-selected light-theme BGM, copied to the production audio directory. */
export const LIGHT_GAME_TRACK: TrackManifest = {
  id: 'light-theme-organic-techno',
  src: `${import.meta.env.BASE_URL}audio/bgm/light-theme.mp3`,
  sha256: 'd73ab88a9a665dd684376d9e167f66297d909a6a63a6de195dcc455023c15148',
  bpmNominal: 117.829641,
  loopStartSec: 0,
  loopEndSec: 362.879979,
  gainDb: -4.5,
  beatAnchors: [
    { beatIndex: 0, atSeconds: 0 },
    { beatIndex: 32, atSeconds: 16.286338 },
    { beatIndex: 64, atSeconds: 32.572677 },
    { beatIndex: 96, atSeconds: 48.859015 },
    { beatIndex: 128, atSeconds: 65.145354 },
    { beatIndex: 160, atSeconds: 81.431692 },
    { beatIndex: 192, atSeconds: 97.718031 },
    { beatIndex: 224, atSeconds: 114.004369 },
    { beatIndex: 256, atSeconds: 130.290708 },
    { beatIndex: 288, atSeconds: 146.577046 },
    { beatIndex: 320, atSeconds: 162.863385 },
    { beatIndex: 352, atSeconds: 179.149723 },
    { beatIndex: 384, atSeconds: 195.436062 },
    { beatIndex: 416, atSeconds: 211.7224 },
    { beatIndex: 448, atSeconds: 228.008739 },
    { beatIndex: 480, atSeconds: 244.295077 },
    { beatIndex: 512, atSeconds: 260.581415 },
    { beatIndex: 544, atSeconds: 276.867754 },
    { beatIndex: 576, atSeconds: 293.154092 },
    { beatIndex: 608, atSeconds: 309.440431 },
    { beatIndex: 640, atSeconds: 325.726769 },
    { beatIndex: 672, atSeconds: 342.013108 },
    { beatIndex: 704, atSeconds: 358.299446 },
    { beatIndex: 713, atSeconds: 362.879979 },
  ],
  sections: [],
};

/**
 * Theme-owned BGM selection. Both themes may provide an independent track;
 * event SFX remain usable even if a future theme profile is null.
 */
export const AUDIO_THEME_TRACKS: Record<AudioTheme, TrackManifest | null> = {
  dark: DARK_GAME_TRACK,
  light: LIGHT_GAME_TRACK,
};

export function getThemeTrack(theme: AudioTheme): TrackManifest | null {
  return AUDIO_THEME_TRACKS[theme];
}

export function getThemeTrackProfile(theme: AudioTheme): ThemeTrackProfile {
  return { theme, track: getThemeTrack(theme) };
}
