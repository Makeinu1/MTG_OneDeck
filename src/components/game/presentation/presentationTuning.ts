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

export interface CommanderMixTuning {
  duckDb: number;
  attackMs: number;
  holdMs: number;
  releaseMs: number;
}

export const AUDIO_VISUAL_TUNING: AudioVisualTuning = {
  quantizeStepsPerBeat: 4,
  snapWindowMs: 60,
  maxInteractionAudioDelayMs: 80,
};

export const COMMANDER_MIX_TUNING: CommanderMixTuning = {
  duckDb: -4,
  attackMs: 40,
  holdMs: 360,
  releaseMs: 320,
};
