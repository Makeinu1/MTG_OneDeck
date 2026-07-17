import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { GameEvent, LogEntry, Phase } from '../../engine/types';
import type { GameController } from './gameController';
import {
  appendedCommanderCast,
  celebrationLogSignals,
  chainReasonFor,
  type ChainReason,
} from './celebrationTimelineModel';
import { celebrate } from './sound';

const CHAIN_VISIBLE_MS = 8000;
const COMMANDER_VISIBLE_MS = 1150;

const CHAIN_LABEL: Record<ChainReason, string> = {
  triggers: '誘発がつながっています',
  draws: '手札が回り始めました',
  tokens: '盤面が広がっています',
  resolves: 'スタックが連鎖しています',
  mana: '大きな展開の準備が整いました',
};

export function CelebrationLayer({ controller }: { controller: GameController }) {
  const { state } = controller;
  const previousEventsRef = useRef<readonly GameEvent[] | null>(null);
  const previousLogRef = useRef<readonly LogEntry[] | null>(null);
  const turnPhaseRef = useRef<{ turn: number; phase: Phase } | null>(null);
  const triggerTimesRef = useRef<number[]>([]);
  const resolveTimesRef = useRef<number[]>([]);
  const tokenCountRef = useRef(0);
  const manaCountRef = useRef(0);
  const chainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chainActiveRef = useRef(false);
  const commanderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [chainReason, setChainReason] = useState<ChainReason | null>(null);
  const [commanderCue, setCommanderCue] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => () => {
    if (chainTimerRef.current) clearTimeout(chainTimerRef.current);
    if (commanderTimerRef.current) clearTimeout(commanderTimerRef.current);
  }, []);

  useLayoutEffect(() => {
    if (!state) {
      previousEventsRef.current = null;
      previousLogRef.current = null;
      turnPhaseRef.current = null;
      return;
    }
    const previousEvents = previousEventsRef.current;
    const previousLog = previousLogRef.current;
    const eventsAppend = previousEvents !== null
      && state.eventLog.length > previousEvents.length
      && previousEvents.every((event, index) => event.eventId === state.eventLog[index]?.eventId);
    const logAppend = previousLog !== null
      && state.log.length > previousLog.length
      && previousLog.every((entry, index) => entry.seq === state.log[index]?.seq);
    const nextLog = logAppend ? state.log.slice(previousLog.length) : [];
    const historyDiverged = previousEvents !== null && previousLog !== null
      && !eventsAppend && !logAppend
      && (state.eventLog !== previousEvents || state.log !== previousLog);
    previousEventsRef.current = state.eventLog;
    previousLogRef.current = state.log;

    if (historyDiverged) {
      triggerTimesRef.current = [];
      resolveTimesRef.current = [];
      tokenCountRef.current = 0;
      manaCountRef.current = 0;
    }

    const priorTurnPhase = turnPhaseRef.current;
    if (!priorTurnPhase || priorTurnPhase.turn !== state.turn) {
      tokenCountRef.current = 0;
      manaCountRef.current = 0;
    } else if (priorTurnPhase.phase !== state.phase) {
      manaCountRef.current = 0;
    }
    turnPhaseRef.current = { turn: state.turn, phase: state.phase };
    if (!controller.motionArmed || (!eventsAppend && !logAppend)) return;

    const now = Date.now();
    const signals = celebrationLogSignals(nextLog);
    triggerTimesRef.current = [
      ...triggerTimesRef.current.filter((time) => now - time <= 10_000),
      ...Array.from({ length: signals.triggers }, () => now),
    ];
    resolveTimesRef.current = [
      ...resolveTimesRef.current.filter((time) => now - time <= 30_000),
      ...Array.from({ length: signals.resolves }, () => now),
    ];
    tokenCountRef.current += signals.tokens;
    manaCountRef.current += signals.mana;

    const commander = appendedCommanderCast(previousEvents, state.eventLog, state);
    if (commander) {
      setCommanderCue({ id: commander.eventId, name: commander.name });
      celebrate('commander');
      if (commanderTimerRef.current) clearTimeout(commanderTimerRef.current);
      commanderTimerRef.current = setTimeout(() => {
        setCommanderCue((current) => current?.id === commander.eventId ? null : current);
        commanderTimerRef.current = null;
      }, COMMANDER_VISIBLE_MS);
    }

    const reason = chainReasonFor({
      triggerCount10s: triggerTimesRef.current.length,
      drawCountTurn: state.drawnThisTurn,
      tokenCountTurn: tokenCountRef.current,
      resolveCount30s: resolveTimesRef.current.length,
      manaAddedPhase: manaCountRef.current,
    });
    if (reason) {
      setChainReason(reason);
      if (!chainActiveRef.current) celebrate('chain');
      chainActiveRef.current = true;
      if (chainTimerRef.current) clearTimeout(chainTimerRef.current);
      chainTimerRef.current = setTimeout(() => {
        setChainReason(null);
        chainActiveRef.current = false;
        chainTimerRef.current = null;
      }, CHAIN_VISIBLE_MS);
    }
  }, [controller.motionArmed, state]);

  if (!chainReason && !commanderCue) return null;
  return (
    <div className="celebration-layer" aria-live="polite" aria-atomic="true">
      {chainReason && (
        <div className="chain-celebration" data-testid="chain-celebration">
          <strong>連鎖中</strong>
          <span>{CHAIN_LABEL[chainReason]}</span>
        </div>
      )}
      {commanderCue && (
        <div className="commander-celebration" data-testid="commander-celebration">
          <small>統率者を唱えました</small>
          <strong>《{commanderCue.name}》</strong>
          <span>祭壇 → スタック</span>
        </div>
      )}
    </div>
  );
}
