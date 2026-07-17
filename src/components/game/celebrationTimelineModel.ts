import type { GameEvent, GameState, LogEntry } from '../../engine/types';

export interface ChainMetrics {
  triggerCount10s: number;
  drawCountTurn: number;
  tokenCountTurn: number;
  resolveCount30s: number;
  manaAddedPhase: number;
}

export type ChainReason = 'triggers' | 'draws' | 'tokens' | 'resolves' | 'mana';

export function chainReasonFor(metrics: ChainMetrics): ChainReason | null {
  if (metrics.triggerCount10s >= 3) return 'triggers';
  if (metrics.drawCountTurn >= 5) return 'draws';
  if (metrics.tokenCountTurn >= 3) return 'tokens';
  if (metrics.resolveCount30s >= 3) return 'resolves';
  if (metrics.manaAddedPhase >= 8) return 'mana';
  return null;
}

export interface CelebrationLogSignals {
  triggers: number;
  resolves: number;
  tokens: number;
  mana: number;
}

export function celebrationLogSignals(entries: readonly LogEntry[]): CelebrationLogSignals {
  return entries.reduce<CelebrationLogSignals>((signals, entry) => {
    if (/能力をスタックに積んだ|誘発.*スタック/.test(entry.message)) signals.triggers += 1;
    if (/解決した/.test(entry.message)) signals.resolves += 1;
    const tokenMatch = entry.message.match(/トークン.*?(\d+)(?:個|体)/);
    if (tokenMatch) signals.tokens += Number(tokenMatch[1]);
    const manaMatch = entry.message.match(/マナを(\d+)点/);
    if (manaMatch) signals.mana += Number(manaMatch[1]);
    return signals;
  }, { triggers: 0, resolves: 0, tokens: 0, mana: 0 });
}

export function appendedCommanderCast(
  previous: readonly GameEvent[] | null,
  current: readonly GameEvent[],
  state: GameState,
): { eventId: string; name: string } | null {
  if (previous === null || current.length <= previous.length) return null;
  for (let index = 0; index < previous.length; index += 1) {
    if (previous[index]?.eventId !== current[index]?.eventId) return null;
  }
  const event = [...current.slice(previous.length)].reverse().find((candidate) => (
    candidate.type === 'zoneChange' && candidate.reason === 'cast' && candidate.before.isCommander
  ));
  if (!event || event.type !== 'zoneChange') return null;
  const def = state.defs[event.before.defId];
  const face = def?.faces[event.before.faceIndex] ?? def?.faces[0];
  const name = face?.printedName ?? face?.name ?? def?.printedName ?? def?.name ?? '統率者';
  return { eventId: event.eventId, name };
}
