import type { GameState } from '../../engine/types';
import type { PrimaryActionModel } from './primaryAction';

const NEXT_PHASE_LABELS: Record<GameState['phase'], string> = {
  untap: 'アップキープへ',
  upkeep: 'ドローへ',
  draw: 'メイン1へ',
  main1: '次へ：戦闘',
  combat: 'メイン2へ',
  main2: '終了ステップへ',
  end: '次のターンへ',
};

export function primaryActionDisplayLabel(
  state: GameState,
  primary: PrimaryActionModel,
): string {
  if (primary.kind === 'next-phase') return NEXT_PHASE_LABELS[state.phase];
  if (primary.kind === 'attack') return '攻撃クリーチャーを選ぶ';
  return primary.label;
}
