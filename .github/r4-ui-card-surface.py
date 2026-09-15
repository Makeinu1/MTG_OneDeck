from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected 1 match, found {count}")
    target.write_text(text.replace(old, new, 1))


replace_once(
    "src/components/game/CockpitCardTools.tsx",
    """import type {
  CockpitTable,
  TableOperation,
  TableTokenCharacteristics,
} from '../../engine/cockpitTable';
""",
    """import type {
  CockpitTable,
  TableOperation,
  TableTokenCharacteristics,
} from '../../engine/cockpitTable';
import type { R4TableOperation } from '../../engine/cockpitR4';
""",
)
replace_once(
    "src/components/game/CockpitCardTools.tsx",
    """  send: (operation: TableOperation) => Promise<boolean>;
}) {
  const card = table.cards[cardId];
  const [target, setTarget] = useState<{ id: string; version: number } | null>(null);
""",
    """  send: (operation: TableOperation | R4TableOperation) => Promise<boolean>;
}) {
  const card = table.cards[cardId];
  const [target, setTarget] = useState<{ id: string; version: number } | null>(null);
  const [faceIndex, setFaceIndex] = useState(card.faceIndex);
""",
)
replace_once(
    "src/components/game/CockpitCardTools.tsx",
    """      <label>
        表示する面{' '}
        <select
          value={card.faceIndex}
          disabled={disabled}
          onChange={(event) =>
            void send({
              type: 'face',
              cardId,
              faceIndex: Number(event.target.value),
              faceDown: card.faceDown,
            })
          }
        >
""",
    """      <label>
        表示する面{' '}
        <select
          value={card.zone === 'battlefield' && card.faceDown ? faceIndex : card.faceIndex}
          disabled={disabled}
          onChange={(event) => {
            const nextFaceIndex = Number(event.target.value);
            setFaceIndex(nextFaceIndex);
            if (!(card.zone === 'battlefield' && card.faceDown))
              void send({
                type: 'face',
                cardId,
                faceIndex: nextFaceIndex,
                faceDown: card.faceDown,
              });
          }}
        >
""",
)
replace_once(
    "src/components/game/CockpitCardTools.tsx",
    """      <button
        disabled={disabled}
        onClick={() =>
          void send({ type: 'face', cardId, faceIndex: card.faceIndex, faceDown: !card.faceDown })
        }
      >
        {card.faceDown ? '表向きにする' : '裏向きにする'}
      </button>
""",
    """      <button
        disabled={disabled}
        onClick={() =>
          card.zone === 'battlefield' && card.faceDown
            ? void send({ type: 'special.turnFaceUp', cardId, faceIndex })
            : void send({
                type: 'face',
                cardId,
                faceIndex: card.faceIndex,
                faceDown: !card.faceDown,
              })
        }
      >
        {card.faceDown ? '表向きにする' : '裏向きにする'}
      </button>
""",
)

replace_once(
    "src/components/game/CockpitTableSurface.tsx",
    """import {
  canLifecycleResolveWithoutManual,
  defaultResolutionDestination,
  type R31TableOperation,
} from '../../engine/cockpitR31';
""",
    """import {
  canLifecycleResolveWithoutManual,
  defaultResolutionDestination,
  type R31TableOperation,
} from '../../engine/cockpitR31';
import type { R4TableOperation } from '../../engine/cockpitR4';
""",
)
replace_once(
    "src/components/game/CockpitTableSurface.tsx",
    """  send: (
    op: TableOperation | R31TableOperation | { type: 'undo' } | { type: 'redo' },
  ) => Promise<boolean>;
""",
    """  send: (
    op: TableOperation | R31TableOperation | R4TableOperation | { type: 'undo' } | { type: 'redo' },
  ) => Promise<boolean>;
""",
)
replace_once(
    "src/components/game/CockpitTableSurface.tsx",
    """    else if (card.zone === 'battlefield')
      void send({ type: 'tap', ids: [id], tapped: !card.tapped });
    else if (isLand(id)) void send({ type: 'move', ids: [id], to: 'battlefield', position: 'top' });
    else cast(id);
""",
    """    else if (card.zone === 'battlefield')
      void send({ type: 'tap', ids: [id], tapped: !card.tapped });
    else if (isLand(id)) {
      if (card.zone === 'hand') void send({ type: 'playLand', cardId: id });
      else inspect(id);
    } else cast(id);
""",
)
replace_once(
    "src/components/game/CockpitTableSurface.tsx",
    """              : isLand(id)
                ? '土地を置く'
                : '唱える'}
""",
    """              : isLand(id)
                ? table.cards[id].zone === 'hand'
                  ? '土地を置く'
                  : '詳細'
                : '唱える'}
""",
)
replace_once(
    "src/components/game/CockpitTableSurface.tsx",
    """        if (
          to === 'battlefield' &&
          (instance.zone === 'hand' || instance.zone === 'command') &&
          !isLand(id)
        )
          cast(id);
        else void send({ type: 'move', ids: [id], to, position: 'top' });
""",
    """        if (to === 'battlefield' && instance.zone === 'hand' && isLand(id))
          void send({ type: 'playLand', cardId: id });
        else if (
          to === 'battlefield' &&
          (instance.zone === 'hand' || instance.zone === 'command') &&
          !isLand(id)
        )
          cast(id);
        else void send({ type: 'move', ids: [id], to, position: 'top' });
""",
)
replace_once(
    "src/components/game/CockpitTableSurface.tsx",
    """                  : isLand(cardMenu.id)
                    ? '土地を置く'
                    : '唱える',
""",
    """                  : isLand(cardMenu.id)
                    ? table.cards[cardMenu.id]?.zone === 'hand'
                      ? '土地を置く'
                      : '詳細'
                    : '唱える',
""",
)
