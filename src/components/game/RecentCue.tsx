import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { GameEvent, LogEntry } from '../../engine/types';
import type { GameController } from './gameController';
import { HISTORY_UI_EVENT } from './historyUiEvents';
import { recentCueForAppend, type RecentCueData } from './recentCueModel';

const CUE_VISIBLE_MS = 2000;

export function RecentCue({ controller }: { controller: GameController }) {
  const { state } = controller;
  const previousEventsRef = useRef<readonly GameEvent[] | null>(null);
  const previousLogRef = useRef<readonly LogEntry[] | null>(null);
  const suppressNextRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cue, setCue] = useState<RecentCueData | null>(null);

  useEffect(() => {
    const suppress = () => { suppressNextRef.current = true; };
    document.addEventListener(HISTORY_UI_EVENT, suppress);
    return () => document.removeEventListener(HISTORY_UI_EVENT, suppress);
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useLayoutEffect(() => {
    if (!state) {
      previousEventsRef.current = null;
      previousLogRef.current = null;
      return;
    }
    const next = recentCueForAppend({
      previousEvents: previousEventsRef.current,
      currentEvents: state.eventLog,
      previousLog: previousLogRef.current,
      currentLog: state.log,
      state,
      suppress: suppressNextRef.current || !controller.motionArmed,
    });
    suppressNextRef.current = false;
    previousEventsRef.current = state.eventLog;
    previousLogRef.current = state.log;
    if (!next) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setCue(next);
    timerRef.current = setTimeout(() => {
      setCue((current) => current?.id === next.id ? null : current);
      timerRef.current = null;
    }, CUE_VISIBLE_MS);
  }, [controller.motionArmed, state]);

  if (!cue) return null;
  return (
    <button
      type="button"
      className={`recent-cue recent-cue--${cue.kind}`}
      data-testid="recent-cue"
      onClick={() => {
        setCue(null);
        controller.openFeed();
      }}
      aria-label={`${cue.text}${cue.extraCount > 0 ? `、ほか${cue.extraCount}件` : ''}。詳細を見る`}
    >
      <span>{cue.text}</span>
      {cue.extraCount > 0 && <small>ほか{cue.extraCount}件</small>}
    </button>
  );
}
