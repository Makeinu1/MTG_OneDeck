import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import {
  HISTORY_UI_EVENT,
  type HistoryNavigationDirection,
} from '../components/game/historyUiEvents';

/** Local, transient choice history. It never writes GameState or invokes semantic cancel. */
export function useInteractionHistory<T>(
  initialValue: T,
  onUndoBoundary?: () => void,
): [T, (next: SetStateAction<T>) => void] {
  const [value, setValue] = useState(initialValue);
  const currentRef = useRef(value);
  const pastRef = useRef<T[]>([]);
  const futureRef = useRef<T[]>([]);
  const boundaryRef = useRef(onUndoBoundary);

  useEffect(() => {
    currentRef.current = value;
  }, [value]);

  useEffect(() => {
    boundaryRef.current = onUndoBoundary;
  }, [onUndoBoundary]);

  const setWithHistory = useCallback((next: SetStateAction<T>) => {
    setValue((current) => {
      const resolved = typeof next === 'function'
        ? (next as (previous: T) => T)(current)
        : next;
      if (Object.is(resolved, current)) return current;
      pastRef.current.push(current);
      futureRef.current = [];
      currentRef.current = resolved;
      return resolved;
    });
  }, []);

  useEffect(() => {
    function navigate(event: Event): void {
      const direction = (event as CustomEvent<{ direction?: HistoryNavigationDirection }>).detail?.direction;
      if (direction === 'undo') {
        const previous = pastRef.current.pop();
        if (previous !== undefined) {
          futureRef.current.push(currentRef.current);
          currentRef.current = previous;
          setValue(previous);
          event.preventDefault();
          return;
        }
        if (boundaryRef.current) {
          boundaryRef.current();
          event.preventDefault();
        }
        return;
      }
      if (direction === 'redo') {
        const next = futureRef.current.pop();
        if (next !== undefined) {
          pastRef.current.push(currentRef.current);
          currentRef.current = next;
          setValue(next);
        }
        // An open interaction isolates board redo even when its local future is empty.
        event.preventDefault();
      }
    }
    document.addEventListener(HISTORY_UI_EVENT, navigate);
    return () => document.removeEventListener(HISTORY_UI_EVENT, navigate);
  }, []);

  return [value, setWithHistory];
}
