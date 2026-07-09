/**
 * statusBandModel — ステータス帯(1行36px)の表示値 selector(純関数)。
 * docs/design-system.md §8・docs/ui-architecture-v2.md §2 StatusBand。
 *
 * カードが主役(vision 原則7)ゆえ、常設のゾーンラベル列・相手ライフ行は廃止し、
 * ターン/フェイズ + ゾーン枚数チップ + 自ライフ を1行に集約する(全てタップ=シート)。
 * 純粋性: 同一 state → 同一出力。state を変異しない。
 */

import type { GameState, Phase, ZoneId } from '../../engine/types';

/** フェイズ表示メタ(短縮=帯の点、label=読み上げ/シート)。§ PhaseOverlay と同義。 */
export const PHASE_META: Record<Phase, { short: string; label: string }> = {
  untap: { short: '解', label: 'アンタップ' },
  upkeep: { short: '維', label: 'アップキープ' },
  draw: { short: '引', label: 'ドロー' },
  main1: { short: '1', label: 'メイン1' },
  combat: { short: '戦', label: '戦闘' },
  main2: { short: '2', label: 'メイン2' },
  end: { short: '終', label: '終了' },
};

/** ステータス帯に常設するゾーン枚数チップ(手札・墓地・追放・ライブラリ)。 */
export const STATUS_ZONE_CHIPS: ReadonlyArray<{ zone: ZoneId; label: string; testId: string }> = [
  { zone: 'hand', label: '手', testId: 'status-zone-hand' },
  { zone: 'graveyard', label: '墓', testId: 'status-zone-graveyard' },
  { zone: 'exile', label: '追', testId: 'status-zone-exile' },
  { zone: 'library', label: '山', testId: 'status-zone-library' },
];

export interface StatusZoneChip {
  zone: ZoneId;
  label: string;
  testId: string;
  count: number;
}

export interface StatusBandModel {
  turn: number;
  phase: Phase;
  phaseLabel: string;
  phaseShort: string;
  life: number;
  zones: StatusZoneChip[];
  /** スタックに未解決要素があるか(帯の緊張表現・PrimaryAction と連動)。 */
  stackActive: boolean;
}

/** GameState からステータス帯の表示モデルを導出する純関数。 */
export function statusBandModel(state: GameState): StatusBandModel {
  const meta = PHASE_META[state.phase];
  return {
    turn: state.turn,
    phase: state.phase,
    phaseLabel: meta.label,
    phaseShort: meta.short,
    life: state.life,
    zones: STATUS_ZONE_CHIPS.map((chip) => ({
      ...chip,
      count: state.zones[chip.zone].length,
    })),
    stackActive: state.zones.stack.length > 0,
  };
}
