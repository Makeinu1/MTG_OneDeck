/**
 * presentationTuning — AV0 凍結済みの TUNABLE 初期値。
 * docs/audio-visual-contract.md §4(即時応答と拍同期)・§5(統率者の固有儀式)。
 * 同じ設定を一か所に集め、CSS・複数モジュールへ直書きしない。
 */

export interface AudioVisualTuning {
  quantizeStepsPerBeat: 1 | 2 | 4;
  snapWindowMs: number;
  maxInteractionAudioDelayMs: number;
}

/** AV5 permanent beat tuning (docs/audio-visual-contract.md §10). */
export interface PermanentBeatTuning {
  /** Left-to-right phase offset per slot (ms). 0 = standing wave. */
  beatWaveStepMs: number;
  /** Slot count at or below which density = 1.0 (full amplitude). */
  beatDensityFullSlots: number;
  /** Slot count at or above which density = 0.0 (shadow only). */
  beatDensityZeroSlots: number;
  /** Commander dance amplitude multiplier. */
  commanderAmpScale: number;
  /** Land/permanent beat amplitude multiplier. */
  landAmpScale: number;
}

export interface CommanderMixTuning {
  duckDb: number;
  attackMs: number;
  holdMs: number;
  releaseMs: number;
}

/** AV0 frozen constant — do not add fields (review.av0 uses toEqual). */
export const AUDIO_VISUAL_TUNING: AudioVisualTuning = {
  quantizeStepsPerBeat: 4,
  snapWindowMs: 60,
  maxInteractionAudioDelayMs: 80,
};

/** AV6 two-phase beat + dance-floor lighting tuning (docs/audio-visual-contract.md §11). */
export interface TwoPhaseBeatTuning {
  /** Light pool opacity at peak during heartbeat phase. */
  lightPeakPre: number;
  /** Light pool opacity at peak during groove phase. */
  lightPeakPost: number;
  /** Light pool base opacity (trough). */
  lightBase: number;
  /** Commander idle breathe peak opacity. */
  commanderIdlePeak: number;
  /** Stamp sink depth in px. */
  stampSinkPx: number;
  /** Light pool size as percentage of viewport. */
  lightPoolSizePct: number;
}

/**
 * AV5+AV6 extended tuning (superset of AudioVisualTuning + PermanentBeatTuning + TwoPhaseBeatTuning).
 * Used by beatDensity, LandRow, Board, and review.av5/av6 tests.
 */
export const DEFAULT_AUDIO_VISUAL_TUNING: AudioVisualTuning & PermanentBeatTuning & TwoPhaseBeatTuning = {
  ...AUDIO_VISUAL_TUNING,
  beatWaveStepMs: 25,
  beatDensityFullSlots: 6,
  beatDensityZeroSlots: 12,
  commanderAmpScale: 1.0,
  landAmpScale: 1.0,
  lightPeakPre: 0.10,
  lightPeakPost: 0.22,
  lightBase: 0.04,
  commanderIdlePeak: 0.35,
  stampSinkPx: 2.5,
  lightPoolSizePct: 55,
};

export const COMMANDER_MIX_TUNING: CommanderMixTuning = {
  duckDb: -4,
  attackMs: 40,
  holdMs: 360,
  releaseMs: 320,
};
