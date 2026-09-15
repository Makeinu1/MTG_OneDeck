import { useEffect, useRef, useState } from 'react';
import type { InitDeckCard } from '../../engine/init';

export function CockpitReplayButton({
  disabled,
  seats,
  loadDeck,
  onReplay,
}: {
  disabled: boolean;
  seats?: 2 | 4;
  loadDeck: () => Promise<InitDeckCard[] | null>;
  onReplay: (deck: InitDeckCard[], seats?: 2 | 4) => void;
}) {
  const [status, setStatus] = useState<'ready' | 'loading' | 'unavailable'>('ready');
  const active = useRef(true);
  const inFlight = useRef(false);
  const enabled = useRef(!disabled);
  useEffect(() => {
    enabled.current = !disabled;
  }, [disabled]);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function replay() {
    if (disabled || inFlight.current) return;
    inFlight.current = true;
    setStatus('loading');
    try {
      const original = await loadDeck();
      if (!active.current) return;
      if (!enabled.current) {
        setStatus('ready');
        return;
      }
      if (!original?.length) {
        setStatus('unavailable');
        return;
      }
      setStatus('ready');
      onReplay(original, seats);
    } catch {
      if (active.current) setStatus('unavailable');
    } finally {
      inFlight.current = false;
    }
  }
  return status === 'unavailable' ? (
    <p role="status">
      元の完全なデッキを確認できません。「デッキ選択へ戻る」から選び直してください。
    </p>
  ) : (
    <button disabled={disabled || status === 'loading'} onClick={() => void replay()}>
      {status === 'loading'
        ? '元のデッキを確認中…'
        : seats
          ? '同じデッキで新しい対戦部屋'
          : '同じデッキでもう一度'}
    </button>
  );
}
