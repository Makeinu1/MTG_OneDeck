/**
 * audioVisualContext — AV2 context + hook (separated for react-refresh).
 */

import { createContext, useContext } from 'react';
import type { AudioPreferences, AudioVisualRuntimePolicy } from './audioVisualPreferences';
import type { AudioStatus } from './musicBus';

export interface AudioVisualContextValue {
  audioStatus: AudioStatus;
  preferences: AudioPreferences;
  policy: AudioVisualRuntimePolicy;
  setPreferences: (next: AudioPreferences) => void;
}

export const AudioVisualContext = createContext<AudioVisualContextValue>({
  audioStatus: 'idle',
  preferences: { bgmEnabled: true, eventSoundsEnabled: true, bgmVolume: 70, sfxVolume: 80 },
  policy: { transportRunning: false, musicAudible: false, eventsAudible: false },
  setPreferences: () => {},
});

export function useAudioVisual(): AudioVisualContextValue {
  return useContext(AudioVisualContext);
}
