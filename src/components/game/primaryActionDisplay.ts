import type { GameState } from '../../engine/types';
import type { PrimaryActionModel } from './primaryAction';
import type { IconName } from '../../ui/icons';

const NEXT_PHASE_LABELS: Record<GameState['phase'], string> = {
  untap: 'アップキープへ',
  upkeep: 'ドローへ',
  draw: 'メイン1へ',
  main1: '次へ：戦闘',
  combat: 'メイン2へ',
  main2: '終了ステップへ',
  end: '次のターンへ',
  cleanup: 'クリーンナップを完了',
};

export function primaryActionDisplayLabel(
  state: GameState,
  primary: PrimaryActionModel,
): string {
  if (primary.kind === 'next-phase') return NEXT_PHASE_LABELS[state.phase];
  if (primary.kind === 'attack') return `${primary.eligibleAttackers ?? 0}体で攻撃`;
  if (primary.kind === 'skip-combat') return '攻撃せず進む';
  return primary.label;
}

export interface PrimaryActionLanguage {
  full: string;
  compact: string;
  icon: IconName;
}

/** 常設ボタンは狭幅で短縮するが、aria-label用の完全な意味は常に保持する。 */
export function primaryActionLanguage(
  state: GameState,
  primary: PrimaryActionModel,
  triggerCandidateCount: number,
): PrimaryActionLanguage {
  const full = primaryActionDisplayLabel(state, primary);
  switch (primary.kind) {
    case 'manual-resolution':
      return { full, compact: '手動完了', icon: 'stack' };
    case 'resolve':
      return { full, compact: `解決 ${state.zones.stack.length}`, icon: 'stack' };
    case 'triggers':
      return { full, compact: `誘発 ${triggerCandidateCount}`, icon: 'bell' };
    case 'attack':
      return { full, compact: `攻撃 ${primary.eligibleAttackers ?? 0}`, icon: 'attack' };
    case 'skip-combat':
      return { full, compact: '攻撃せず進む', icon: 'phase-next' };
    case 'next-phase':
      return { full, compact: full.replace(/^次へ：/, ''), icon: 'phase-next' };
  }
}
