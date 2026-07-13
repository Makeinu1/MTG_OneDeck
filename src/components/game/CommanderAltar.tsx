import { GameCard } from './GameCard';
import type { GameController } from './gameController';
import { commanderAltarItems } from './commanderAltarModel';

export function CommanderAltar({ controller }: { controller: GameController }) {
  const { state } = controller;
  if (!state) return null;
  const items = commanderAltarItems(state);

  return (
    <section
      className="commander-altar"
      data-testid="commander-altar"
      data-count={items.length}
      aria-label="統率者領域"
    >
      <header>統率者</header>
      <div className="commander-altar__cards">
        {items.map((item) => {
          return (
            <div
              className="commander-altar__slot"
              key={item.cardId}
              data-testid={`commander-slot-${item.cardId}`}
              data-zone={item.zone}
            >
              {item.inCommandZone ? (
                <GameCard
                  controller={controller}
                  cardId={item.cardId}
                  size="board"
                  showCommanderBadge={false}
                />
              ) : (
                <button
                  type="button"
                  className="commander-altar__away"
                  data-testid={`commander-away-${item.cardId}`}
                  aria-label={`${item.name}。現在${item.zoneLabel}、統率者税${item.tax}。操作を開く`}
                  aria-haspopup="dialog"
                  onClick={(event) => controller.openCardMenu(item.cardId, event)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    controller.openCardMenu(item.cardId, event);
                  }}
                >
                  <strong>{item.name}</strong>
                  <span>{item.zoneLabel}</span>
                </button>
              )}
              <div className="commander-altar__meta">
                <span>{item.zoneLabel}</span>
                <strong>税 +{item.tax}</strong>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
