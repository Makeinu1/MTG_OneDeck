/**
 * feedProjection — フィード(ログ/誘発/警告の統合タイムライン)の投影(純関数)。
 * docs/ui-architecture-v2.md §3・docs/design-system.md §8 Feed。
 *
 * フィードは gameStore の warnings / triggerCandidates / ゲームログの**投影**であり、
 * 独自の真実を持たない(undo で自然に巻き戻る)。本関数は表示用 FeedItem[] を導出するだけ。
 *
 * 乖離記録(D3): design-system §8 の「自動実行(--auto)」項目型は、LogEntry が実行主体
 * (auto/manual)のフラグを持たないため本スライスでは 'log' に一本化する。ログに provenance が
 * 載った時点で --auto を分岐する(将来スライス)。
 *
 * 純粋性: 同一入力 → 同一出力。入力も出力も変異しない。
 */

import type { TriggerCandidate } from '../../engine/triggers';
import type { LogEntry } from '../../engine/types';

export type FeedItemKind = 'trigger' | 'warn' | 'log';

export interface FeedItem {
  id: string;
  kind: FeedItemKind;
  text: string;
  /** trigger 項目のみ: 「スタックへ/無視」に必要な参照。 */
  sourceId?: string;
  pendingTriggerId?: string;
  abilityLineIndex?: number;
}

function candidateKey(candidate: TriggerCandidate): string {
  return candidate.pendingTriggerId ?? `${candidate.sourceId}:${candidate.triggerId}`;
}

/**
 * 要処理(誘発候補→警告)を先頭に、続けてログを新しい順で並べた表示リスト。
 */
export function projectFeed(
  warnings: readonly string[],
  triggerCandidates: readonly TriggerCandidate[],
  log: readonly LogEntry[],
): FeedItem[] {
  const items: FeedItem[] = [];

  for (const candidate of triggerCandidates) {
    items.push({
      id: `trigger-${candidateKey(candidate)}`,
      kind: 'trigger',
      text: candidate.label,
      sourceId: candidate.sourceId,
      pendingTriggerId: candidate.pendingTriggerId,
      abilityLineIndex: candidate.abilityLineIndex,
    });
  }

  warnings.forEach((warning, index) => {
    items.push({ id: `warn-${index}`, kind: 'warn', text: warning });
  });

  // ログは新しい順(seq 降順)。
  for (let i = log.length - 1; i >= 0; i--) {
    items.push({ id: `log-${log[i].seq}`, kind: 'log', text: log[i].message });
  }

  return items;
}

/** ベルバッジの未読件数 = 未処理の誘発候補 + 警告。 */
export function feedUnseenCount(
  warnings: readonly string[],
  triggerCandidates: readonly TriggerCandidate[],
): number {
  return warnings.length + triggerCandidates.length;
}
