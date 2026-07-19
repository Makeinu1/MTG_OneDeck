import type { ZoneId } from '../engine/types';

/**
 * ゾーンの日本語表示名(UI正本)。
 * 2026-07-19 腐敗掃除: 同型マップが4ファイルで独立定義され「ライブラリ/ライブラリー」の
 * 表記揺れが起きていたため単一化。エンジンのログ文言(src/engine/commands.ts の
 * ZONE_LABELS)は簡潔表記(「統率」等)を意図的に保つ別物であり、ここへは統合しない。
 */
export const ZONE_LABELS_JA: Record<ZoneId, string> = {
  library: 'ライブラリー',
  hand: '手札',
  battlefield: '戦場',
  graveyard: '墓地',
  exile: '追放',
  command: '統率領域',
  stack: 'スタック',
};
