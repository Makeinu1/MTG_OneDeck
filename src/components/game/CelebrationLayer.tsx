import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { GameEvent, LogEntry, Phase } from '../../engine/types';
import type { GameController } from './gameController';
import {
  celebrationLogSignals,
  chainReasonFor,
} from './celebrationTimelineModel';
import { celebrate } from './sound';

const CHAIN_VISIBLE_MS = 8000;

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
  const [chainVisible, setChainVisible] = useState(false);

  useEffect(() => () => {
    if (chainTimerRef.current) clearTimeout(chainTimerRef.current);
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

    const reason = chainReasonFor({
      triggerCount10s: triggerTimesRef.current.length,
      drawCountTurn: state.drawnThisTurn,
      tokenCountTurn: tokenCountRef.current,
      resolveCount30s: resolveTimesRef.current.length,
      manaAddedPhase: manaCountRef.current,
    });
    if (reason) {
      setChainVisible(true);
      if (!chainActiveRef.current) celebrate('chain');
      chainActiveRef.current = true;
      if (chainTimerRef.current) clearTimeout(chainTimerRef.current);
      chainTimerRef.current = setTimeout(() => {
        setChainVisible(false);
        chainActiveRef.current = false;
        chainTimerRef.current = null;
      }, CHAIN_VISIBLE_MS);
    }
  }, [controller.motionArmed, state]);

  if (!chainVisible) return null;
  return (
    <div className="celebration-layer" aria-atomic="true">
      {chainVisible && (
        <div className="chain-celebration" data-testid="chain-celebration" aria-hidden="true" />
      )}
    </div>
  );
}
