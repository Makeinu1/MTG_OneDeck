import { useEffect, useRef, useState } from 'react';
import { isCommander } from '../../engine/commander';
import { CommandZoneTile, LibraryZonesTile, type ZonesProps } from './Zones';

type MobileZoneSwapView = 'command' | 'library';

export function MobileZoneSwap(props: ZonesProps) {
  const { state } = props;
  const commanderPresent = state.zones.command.some((cardId) => isCommander(state, cardId));
  const [view, setView] = useState<MobileZoneSwapView>(commanderPresent ? 'command' : 'library');
  const prevCommanderPresentRef = useRef(commanderPresent);

  // Auto-default the view when the commander enters/leaves the command zone,
  // but never lock it: the toggle can switch freely at any time (so the user
  // is not stranded on the library view when the commander is absent).
  useEffect(() => {
    if (prevCommanderPresentRef.current !== commanderPresent) {
      prevCommanderPresentRef.current = commanderPresent;
      setView(commanderPresent ? 'command' : 'library');
    }
  }, [commanderPresent]);

  function toggleView(): void {
    setView((current) => (current === 'command' ? 'library' : 'command'));
  }

  return (
    <div className={`mobile-zone-swap mobile-zone-swap--${view}`} data-testid="mobile-zone-swap">
      <button
        type="button"
        className="mobile-zone-swap__toggle"
        data-testid="mobile-zone-swap-toggle"
        onClick={(event) => {
          event.stopPropagation();
          toggleView();
        }}
      >
        <span className="mobile-zone-swap__toggle-label">
          {view === 'command' ? '統率領域' : 'ライブラリ群'}
        </span>
        <span className="mobile-zone-swap__toggle-hint">
          {commanderPresent ? 'タップで切替' : '統率者不在'}
        </span>
      </button>

      <div className="mobile-zone-swap__content">
        <div className="zones">
          {view === 'command' ? (
            <CommandZoneTile {...props} />
          ) : (
            <LibraryZonesTile {...props} />
          )}
        </div>
      </div>
    </div>
  );
}
