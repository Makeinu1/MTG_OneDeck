import type { GameEvent, GameState, LogEntry, ObjectSnapshot } from '../../engine/types';
import { ZONE_LABELS_JA as ZONE_LABELS } from '../../data/zoneLabels';

export type RecentCueKind = 'draw' | 'stack' | 'zone' | 'life' | 'counter' | 'warning' | 'log';

export interface RecentCueData {
  id: string;
  text: string;
  extraCount: number;
  kind: RecentCueKind;
}

interface CueCandidate extends RecentCueData {
  priority: number;
  sequence: number;
}

function appendedByKey<T>(
  previous: readonly T[] | null,
  current: readonly T[],
  key: (value: T) => string | number,
): readonly T[] | null {
  if (previous === null || current.length <= previous.length) return null;
  for (let index = 0; index < previous.length; index += 1) {
    if (key(previous[index]) !== key(current[index])) return null;
  }
  return current.slice(previous.length);
}

function objectName(state: GameState, snapshot: ObjectSnapshot | undefined): string {
  if (!snapshot) return 'カード';
  const def = state.defs[snapshot.defId];
  const face = def?.faces[snapshot.faceIndex] ?? def?.faces[0];
  return face?.printedName ?? face?.name ?? def?.printedName ?? def?.name ?? 'カード';
}

function localObject(snapshot: ObjectSnapshot | undefined, localPlayerId: string): boolean {
  return snapshot?.ownerId === localPlayerId || snapshot?.controllerId === localPlayerId;
}

function candidateForEvent(
  event: GameEvent,
  state: GameState,
  drawZoneEventIds: ReadonlySet<string>,
): CueCandidate | null {
  const localPlayerId = state.localPlayerId;
  switch (event.type) {
    case 'draw': {
      if (event.playerId !== localPlayerId) return null;
      if (event.result === 'empty-library-attempt') {
        return { id: event.eventId, text: '空のライブラリーから引こうとしました', extraCount: 0, kind: 'warning', priority: 100, sequence: event.sequence };
      }
      return {
        id: event.eventId,
        text: `《${objectName(state, event.after ?? event.before)}》を引きました`,
        extraCount: 0,
        kind: 'draw',
        priority: 80,
        sequence: event.sequence,
      };
    }
    case 'zoneChange': {
      if (drawZoneEventIds.has(event.eventId) || !localObject(event.before, localPlayerId)) return null;
      const name = `《${objectName(state, event.after ?? event.before)}》`;
      const destination = event.toZone ? ZONE_LABELS[event.toZone] : 'ゲーム外';
      if (event.reason === 'cast') {
        return { id: event.eventId, text: `${name}を唱え、スタックへ置きました`, extraCount: 0, kind: 'stack', priority: 92, sequence: event.sequence };
      }
      if (event.reason === 'resolve') {
        return { id: event.eventId, text: `${name}を解決 → ${destination}`, extraCount: 0, kind: 'stack', priority: 94, sequence: event.sequence };
      }
      const verb = event.reason === 'discard'
        ? 'を捨てました'
        : event.reason === 'sacrifice'
          ? 'を生け贄にしました'
          : `が${destination}へ移動しました`;
      return { id: event.eventId, text: `${name}${verb}`, extraCount: 0, kind: 'zone', priority: 60, sequence: event.sequence };
    }
    case 'lifeChange': {
      if (event.playerId !== localPlayerId) return null;
      return {
        id: event.eventId,
        text: `ライフ ${event.previousLife} → ${event.nextLife}`,
        extraCount: 0,
        kind: 'life',
        priority: Math.abs(event.delta) >= 5 ? 86 : 70,
        sequence: event.sequence,
      };
    }
    case 'counterChange': {
      if (event.target.kind === 'player') {
        if (event.target.playerId !== localPlayerId) return null;
        return { id: event.eventId, text: `${event.counterType} ${event.before} → ${event.after}`, extraCount: 0, kind: 'counter', priority: 65, sequence: event.sequence };
      }
      if (event.target.kind !== 'object' || !localObject(event.target.snapshot, localPlayerId)) return null;
      return {
        id: event.eventId,
        text: `《${objectName(state, event.target.snapshot)}》の${event.counterType} ${event.before} → ${event.after}`,
        extraCount: 0,
        kind: 'counter',
        priority: 65,
        sequence: event.sequence,
      };
    }
    case 'damage': {
      if (event.target.kind !== 'object' || !localObject(event.target.snapshot, localPlayerId)) return null;
      return {
        id: event.eventId,
        text: `《${objectName(state, event.target.snapshot)}》に${event.amount}点のダメージ`,
        extraCount: 0,
        kind: 'life',
        priority: 68,
        sequence: event.sequence,
      };
    }
    case 'defeatAdvisory':
      return {
        id: event.eventId,
        text: event.playerRef === localPlayerId ? '敗北条件を確認してください' : `${event.playerRef}が敗北条件を満たしました`,
        extraCount: 0,
        kind: 'warning',
        priority: 110,
        sequence: event.sequence,
      };
  }
}

function fallbackLogCue(entries: readonly LogEntry[]): RecentCueData | null {
  const latest = [...entries].reverse().find((entry) => (
    !entry.message.includes('フェイズに移行')
    && !/^ターン\d+/.test(entry.message)
    && !entry.message.includes('カードを1枚引きました')
  ));
  return latest ? { id: `log-${latest.seq}`, text: latest.message, extraCount: 0, kind: 'log' } : null;
}

export function recentCueForAppend(input: {
  previousEvents: readonly GameEvent[] | null;
  currentEvents: readonly GameEvent[];
  previousLog: readonly LogEntry[] | null;
  currentLog: readonly LogEntry[];
  state: GameState;
  suppress?: boolean;
  excludeKinds?: readonly RecentCueKind[];
}): RecentCueData | null {
  const appendedEvents = appendedByKey(input.previousEvents, input.currentEvents, (event) => event.eventId);
  const appendedLog = appendedByKey(input.previousLog, input.currentLog, (entry) => entry.seq);
  if (input.suppress || (appendedEvents === null && appendedLog === null)) return null;

  const events = appendedEvents ?? [];
  const drawZoneEventIds = new Set(events.flatMap((event) => (
    event.type === 'draw' && event.zoneChangeEventId ? [event.zoneChangeEventId] : []
  )));
  const excluded = new Set(input.excludeKinds ?? []);
  const candidates = events.flatMap((event) => {
    const candidate = candidateForEvent(event, input.state, drawZoneEventIds);
    return candidate && !excluded.has(candidate.kind) ? [candidate] : [];
  });
  if (candidates.length === 0) return fallbackLogCue(appendedLog ?? []);
  candidates.sort((left, right) => right.priority - left.priority || right.sequence - left.sequence);
  const primary = candidates[0];
  return { id: primary.id, text: primary.text, kind: primary.kind, extraCount: candidates.length - 1 };
}
