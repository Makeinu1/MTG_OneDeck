import { useRef, useState } from 'react';
import { isCommander } from '../../engine/commander';
import { CommandZoneTile, LibraryZonesTile, type ZonesProps } from './Zones';

const DOUBLE_TAP_WINDOW_MS = 280;

type MobileZoneSwapView = 'command' | 'library';

export function MobileZoneSwap(props: ZonesProps) {
  const { state } = props;
  const [view, setView] = useState<MobileZoneSwapView>('command');
  const lastTouchTapAtRef = useRef<number | null>(null);
  const commanderPresent = state.zones.command.some((cardId) => isCommander(state, cardId));
  const activeView = commanderPresent ? view : 'library';

  function toggleView(): void {
    if (!commanderPresent) {
      setView('library');
      return;
    }

    setView((current) => (current === 'command' ? 'library' : 'command'));
  }

  function handleTouchToggle(): void {
    const now = Date.now();
    const lastTapAt = lastTouchTapAtRef.current;
    lastTouchTapAtRef.current = now;
    if (lastTapAt !== null && now - lastTapAt <= DOUBLE_TAP_WINDOW_MS) {
      lastTouchTapAtRef.current = null;
      toggleView();
    }
  }

  return (
    <div className={`mobile-zone-swap mobile-zone-swap--${view}`} data-testid="mobile-zone-swap">
      <button
        type="button"
        className="mobile-zone-swap__toggle"
        data-testid="mobile-zone-swap-toggle"
        onDoubleClick={(event) => {
          event.stopPropagation();
          toggleView();
        }}
        onPointerUp={(event) => {
          if (event.pointerType !== 'touch') {
            return;
          }
          event.stopPropagation();
          handleTouchToggle();
        }}
      >
        <span className="mobile-zone-swap__toggle-label">
          {activeView === 'command' ? '統率領域' : 'ライブラリ群'}
        </span>
        <span className="mobile-zone-swap__toggle-hint">
          {commanderPresent ? 'ダブルタップで切替' : '統率者不在'}
        </span>
      </button>

      <div className="mobile-zone-swap__content">
        <div className="zones">
          {activeView === 'command' ? (
            <CommandZoneTile {...props} />
          ) : (
            <LibraryZonesTile {...props} />
          )}
        </div>
      </div>
    </div>
  );
}
