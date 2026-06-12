import { useState } from 'react';
import { DndContext, DragOverlay, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { useGameStore } from '../../store/gameStore';
import type { ZoneId } from '../../engine/types';
import { isCommander } from '../../engine/commander';
import { ContextMenu, type MenuItem } from '../ContextMenu';
import type { MenuTarget } from '../types';
import { CardView } from '../CardView';
import { SidePanel } from './SidePanel';
import { Battlefield } from './Battlefield';
import { Hand } from './Hand';
import { Zones } from './Zones';
import { GameLog } from './GameLog';
import { Toasts } from './Toasts';
import {
  ManaChoiceDialog,
  ShortfallDialog,
  CommanderMoveDialog,
  TokenCreateDialog,
  ZoneViewerDialog,
  MulliganBottomDialog,
} from './dialogs';
import type { ManaColor } from '../../types/card';

type PendingMove = { cardId: string; to: ZoneId };
type PendingCast =
  | { kind: 'hand'; cardId: string; shortfall: number }
  | { kind: 'commander'; cardId: string; shortfall: number };

/** The main playmat screen: battlefield, hand, side panel, zones, log, and all dialogs. */
export function Playmat() {
  const store = useGameStore();
  const { state, warnings } = store;

  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const [manaChoice, setManaChoice] = useState<{ cardId: string; options: ManaColor[] } | null>(null);
  const [pendingCast, setPendingCast] = useState<PendingCast | null>(null);
  const [commanderMove, setCommanderMove] = useState<{ cardId: string; to: ZoneId } | null>(null);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [zoneViewer, setZoneViewer] = useState<'graveyard' | 'exile' | 'library' | null>(null);
  const [mulliganBottomCount, setMulliganBottomCount] = useState<number | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  if (!state) return null;

  const cards = state.cards;

  function performMove(move: PendingMove): void {
    const card = cards[move.cardId];
    if (!card) return;
    // Commander leaving battlefield/hand/library/graveyard/exile -> offer command zone.
    if (isCommander(state!, move.cardId) && move.to !== 'command' && card.zone !== 'command') {
      setCommanderMove({ cardId: move.cardId, to: move.to });
      return;
    }
    store.moveCard(move.cardId, move.to);
  }

  function handleCardClick(cardId: string, e: React.MouseEvent): void {
    e.stopPropagation();
    setMenu({ cardId, x: e.clientX, y: e.clientY });
  }

  function handleCommanderZoneClick(cardId: string, e: React.MouseEvent): void {
    e.stopPropagation();
    setMenu({ cardId, x: e.clientX, y: e.clientY });
  }

  function closeMenu(): void {
    setMenu(null);
  }

  function buildMenuItems(cardId: string): { title: string; items: MenuItem[] } {
    const card = cards[cardId];
    const def = state!.defs[card.defId];
    const face = def?.faces[card.faceIndex] ?? def?.faces[0];
    const displayName = face?.printedName ?? face?.name ?? def?.printedName ?? def?.name ?? '不明';
    const items: MenuItem[] = [];

    if (card.zone === 'battlefield') {
      items.push({
        key: 'tap',
        label: card.tapped ? 'アンタップ' : 'タップ',
        onSelect: () => store.toggleTap(cardId),
      });

      const produced = def?.producedMana ?? [];
      if (produced.length > 0 && !card.tapped) {
        items.push({
          key: 'tapForMana',
          label: 'マナを生成してタップ',
          onSelect: () => {
            const result = store.tapForMana(cardId);
            if (result === 'needs-choice') {
              setManaChoice({ cardId, options: produced });
            }
          },
        });
      }
    }

    if (card.zone === 'hand') {
      const typeLine = face?.typeLine ?? def?.typeLine ?? '';
      if (typeLine.includes('Land')) {
        items.push({
          key: 'play-land',
          label: '土地としてプレイ',
          onSelect: () => store.moveCard(cardId, 'battlefield'),
          separator: true,
        });
      } else {
        items.push({
          key: 'cast',
          label: 'キャスト',
          onSelect: () => {
            const result = store.castFromHand(cardId);
            if (result !== 'ok') {
              setPendingCast({ kind: 'hand', cardId, shortfall: result.shortfall });
            }
          },
          separator: true,
        });
      }
    }

    if (card.zone === 'command' && isCommander(state!, cardId)) {
      items.push({
        key: 'cast-commander',
        label: '統率者をキャスト',
        onSelect: () => {
          const result = store.castCommander(cardId);
          if (result !== 'ok') {
            setPendingCast({ kind: 'commander', cardId, shortfall: result.shortfall });
          }
        },
        separator: true,
      });
    }

    // Flip (transform / MDFC with 2 faces)
    if (!card.faceDown && def && def.faces.length > 1) {
      const nextFace = (card.faceIndex + 1) % def.faces.length;
      items.push({
        key: 'flip',
        label: '裏返す',
        onSelect: () => store.dispatch({ type: 'setFace', cardId, faceIndex: nextFace }),
        separator: items.length > 0,
      });
    }

    // Face-down toggle
    items.push({
      key: 'facedown',
      label: card.faceDown ? '表向きにする' : '裏向きにする',
      onSelect: () => store.dispatch({ type: 'setFaceDown', cardId, faceDown: !card.faceDown }),
    });

    // Counters
    items.push(
      {
        key: 'counter-plus',
        label: '+1/+1カウンターを置く',
        onSelect: () => store.dispatch({ type: 'addCounters', cardId, counterType: '+1/+1', delta: 1 }),
        separator: true,
      },
      {
        key: 'counter-minus',
        label: '+1/+1カウンターを取り除く',
        onSelect: () => store.dispatch({ type: 'addCounters', cardId, counterType: '+1/+1', delta: -1 }),
        disabled: (card.counters['+1/+1'] ?? 0) <= 0,
      },
    );

    // Move targets
    const allMoveTargets: { zone: ZoneId; label: string }[] = [
      { zone: 'battlefield', label: '戦場へ' },
      { zone: 'hand', label: '手札へ' },
      { zone: 'graveyard', label: '墓地へ' },
      { zone: 'exile', label: '追放へ' },
      { zone: 'library', label: 'ライブラリへ(一番上)' },
      { zone: 'command', label: '統率領域へ' },
    ];
    const moveTargets = allMoveTargets.filter((t) => t.zone !== card.zone);

    moveTargets.forEach((t, i) => {
      items.push({
        key: `move-${t.zone}`,
        label: t.label,
        onSelect: () => performMove({ cardId, to: t.zone }),
        separator: i === 0,
      });
    });

    return { title: displayName, items };
  }

  // --- Drag & drop ---
  function handleDragStart(e: DragStartEvent): void {
    setActiveDragId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent): void {
    setActiveDragId(null);
    const cardId = String(e.active.id);
    const overId = e.over?.id;
    if (!overId) return;
    const data = e.over?.data.current as { zone?: ZoneId } | undefined;
    const zone = data?.zone;
    if (!zone) return;
    const card = cards[cardId];
    if (!card || card.zone === zone) return;
    performMove({ cardId, to: zone });
  }

  const activeCard = activeDragId ? cards[activeDragId] : undefined;
  const activeDef = activeCard ? state.defs[activeCard.defId] : undefined;

  const zoneViewerIds = zoneViewer ? state.zones[zoneViewer] : [];

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="playmat" onClick={closeMenu}>
        <SidePanel
          state={state}
          store={store}
          onMulligan={() => {
            store.mulligan();
            setMulliganBottomCount(state.mulliganCount + 1);
          }}
        />

        <div className="playmat__center">
          <div className="playmat__top-bar">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setTokenDialogOpen(true)} data-testid="create-token">
              トークン生成
            </button>
          </div>

          <Battlefield state={state} onCardClick={handleCardClick} />
          <Hand state={state} onCardClick={handleCardClick} />
        </div>

        <div className="playmat__right">
          <Zones
            state={state}
            store={store}
            onOpenViewer={(zone) => setZoneViewer(zone)}
            onCommanderClick={handleCommanderZoneClick}
          />
          <GameLog log={state.log} />
        </div>

        {menu && (
          <ContextMenu
            x={menu.x}
            y={menu.y}
            title={buildMenuItems(menu.cardId).title}
            items={buildMenuItems(menu.cardId).items}
            onClose={closeMenu}
          />
        )}

        {manaChoice && (
          <ManaChoiceDialog
            options={manaChoice.options}
            onChoose={(color) => {
              store.tapForMana(manaChoice.cardId, color);
              setManaChoice(null);
            }}
            onCancel={() => setManaChoice(null)}
          />
        )}

        {pendingCast && (
          <ShortfallDialog
            shortfall={pendingCast.shortfall}
            onForce={() => {
              if (pendingCast.kind === 'hand') {
                store.castFromHand(pendingCast.cardId, { force: true });
              } else {
                store.castCommander(pendingCast.cardId, { force: true });
              }
              setPendingCast(null);
            }}
            onCancel={() => setPendingCast(null)}
          />
        )}

        {commanderMove && (
          <CommanderMoveDialog
            cardName={(() => {
              const card = cards[commanderMove.cardId];
              const def = state.defs[card.defId];
              const face = def?.faces[card.faceIndex] ?? def?.faces[0];
              return face?.printedName ?? face?.name ?? def?.printedName ?? def?.name ?? '不明';
            })()}
            destinationLabel={ZONE_LABELS[commanderMove.to]}
            onChoose={(toCommandZone) => {
              if (toCommandZone) {
                store.moveCard(commanderMove.cardId, 'command');
              } else {
                store.moveCard(commanderMove.cardId, commanderMove.to);
              }
              setCommanderMove(null);
            }}
            onCancel={() => setCommanderMove(null)}
          />
        )}

        {tokenDialogOpen && (
          <TokenCreateDialog
            onCreate={(name, typeLine, power, toughness, qty) => {
              store.createToken(name, typeLine, power || undefined, toughness || undefined, qty);
              setTokenDialogOpen(false);
            }}
            onCancel={() => setTokenDialogOpen(false)}
          />
        )}

        {zoneViewer && (
          <ZoneViewerDialog
            zone={zoneViewer}
            cardIds={zoneViewerIds}
            state={state}
            onMove={(cardId, to) => {
              performMove({ cardId, to });
            }}
            onClose={() => setZoneViewer(null)}
          />
        )}

        {mulliganBottomCount !== null && (
          <MulliganBottomDialog
            cardIds={state.zones.hand}
            state={state}
            count={mulliganBottomCount}
            onConfirm={(chosen) => {
              store.putBottomForMulligan(chosen);
              setMulliganBottomCount(null);
            }}
          />
        )}

        <Toasts warnings={warnings} onClear={() => store.clearWarnings()} />
      </div>

      <DragOverlay>
        {activeCard && activeDef ? <CardView instance={activeCard} def={activeDef} size="small" /> : null}
      </DragOverlay>
    </DndContext>
  );
}

const ZONE_LABELS: Record<ZoneId, string> = {
  library: 'ライブラリ',
  hand: '手札',
  battlefield: '戦場',
  graveyard: '墓地',
  exile: '追放',
  command: '統率領域',
};
