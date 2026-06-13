import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useGameStore } from '../../store/gameStore';
import type { ZoneId } from '../../engine/types';
import { isCommander } from '../../engine/commander';
import { ContextMenu, type MenuItem } from '../ContextMenu';
import type { MenuTarget } from '../types';
import { CardView } from '../CardView';
import { CardPreview } from '../CardPreview';
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
  ConfirmDialog,
} from './dialogs';
import type { ManaColor } from '../../types/card';
import { useShortcuts } from '../../hooks/useShortcuts';
import { useHoverPreview } from '../../hooks/useHoverPreview';

type PendingMove = { cardId: string; to: ZoneId };
type PendingCast =
  | { kind: 'hand'; cardId: string; shortfall: number }
  | { kind: 'commander'; cardId: string; shortfall: number };
type ManaChoiceRequest = {
  kind: 'tap' | 'treasure';
  cardId: string;
  options: ManaColor[];
};

/** The main playmat screen: battlefield, hand, side panel, zones, log, and all dialogs. */
export function Playmat() {
  const store = useGameStore();
  const { state, warnings } = store;

  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const [manaChoice, setManaChoice] = useState<ManaChoiceRequest | null>(null);
  const [pendingCast, setPendingCast] = useState<PendingCast | null>(null);
  const [pendingLandPlay, setPendingLandPlay] = useState<{ cardId: string } | null>(null);
  const [commanderMove, setCommanderMove] = useState<{ cardId: string; to: ZoneId } | null>(null);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [zoneViewer, setZoneViewer] = useState<'graveyard' | 'exile' | 'library' | null>(null);
  const [mulliganBottomCount, setMulliganBottomCount] = useState<number | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'restart' | 'back-to-import' | null>(null);
  const [logExpanded, setLogExpanded] = useState(false);

  const hoverPreview = useHoverPreview();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const isDialogOpen =
    manaChoice !== null ||
    pendingCast !== null ||
    pendingLandPlay !== null ||
    commanderMove !== null ||
    tokenDialogOpen ||
    zoneViewer !== null ||
    mulliganBottomCount !== null ||
    confirmAction !== null;

  useShortcuts({
    onNextPhase: () => store.nextPhase(),
    onNextTurn: () => store.nextTurn(),
    onUndo: () => store.undo(),
    onRedo: () => store.redo(),
    onDraw: () => store.draw(1),
    isDialogOpen,
  });

  if (!state) return null;

  const cards = state.cards;

  function typeLineFor(cardId: string): string {
    const card = cards[cardId];
    if (!card) return '';
    const def = state!.defs[card.defId];
    const face = def?.faces[card.faceIndex] ?? def?.faces[0];
    return face?.typeLine ?? def?.typeLine ?? '';
  }

  function treasureColors(cardId: string): ManaColor[] {
    const card = cards[cardId];
    if (!card) return ['W', 'U', 'B', 'R', 'G'];
    const def = state!.defs[card.defId];
    return def?.producedMana?.length ? def.producedMana : ['W', 'U', 'B', 'R', 'G'];
  }

  function requestPlayLand(cardId: string): void {
    const result = store.playLand(cardId);
    if (result === 'needs-confirm') {
      setPendingLandPlay({ cardId });
    }
  }

  function requestTreasureCrack(cardId: string): void {
    const options = treasureColors(cardId);
    if (options.length === 1) {
      store.crackTreasure(cardId, options[0]);
      return;
    }
    setManaChoice({ kind: 'treasure', cardId, options });
  }

  function performMove(move: PendingMove): void {
    const card = cards[move.cardId];
    if (!card) return;
    if (card.zone === 'hand' && move.to === 'battlefield' && typeLineFor(move.cardId).includes('Land')) {
      requestPlayLand(move.cardId);
      return;
    }
    // Commander leaving battlefield/hand/library/graveyard/exile -> offer command zone.
    if (isCommander(state!, move.cardId) && move.to !== 'command' && card.zone !== 'command') {
      setCommanderMove({ cardId: move.cardId, to: move.to });
      return;
    }
    store.moveCard(move.cardId, move.to);
  }

  function handleCardContextMenu(cardId: string, e: React.MouseEvent): void {
    e.stopPropagation();
    hoverPreview.suppress();
    setMenu({ cardId, x: e.clientX, y: e.clientY });
  }

  function handleCommanderContextMenu(cardId: string, e: React.MouseEvent): void {
    e.stopPropagation();
    hoverPreview.suppress();
    setMenu({ cardId, x: e.clientX, y: e.clientY });
  }

  function closeMenu(): void {
    setMenu(null);
  }

  /**
   * Double-click quick actions:
   * - hand land -> play as land
   * - hand spell -> cast
   * - battlefield untapped mana source -> tap for mana (color picker if multiple)
   * - battlefield other card -> toggle tap
   * - command zone commander -> cast commander
   */
  function handleCardDoubleClick(cardId: string, e: React.MouseEvent): void {
    e.stopPropagation();
    hoverPreview.suppress();
    const card = cards[cardId];
    if (!card) return;
    const def = state!.defs[card.defId];

    if (card.zone === 'hand') {
      if (typeLineFor(cardId).includes('Land')) {
        requestPlayLand(cardId);
      } else {
        const result = store.castFromHand(cardId);
        if (result !== 'ok') {
          setPendingCast({ kind: 'hand', cardId, shortfall: result.shortfall });
        }
      }
      return;
    }

    if (card.zone === 'battlefield') {
      if (def?.tokenKind === 'treasure') {
        requestTreasureCrack(cardId);
        return;
      }
      const produced = def?.producedMana ?? [];
      if (!card.tapped && produced.length > 0) {
        const result = store.tapForMana(cardId);
        if (result === 'needs-choice') {
          setManaChoice({ kind: 'tap', cardId, options: produced });
        }
        return;
      }
      store.toggleTap(cardId);
      return;
    }

    if (card.zone === 'command' && isCommander(state!, cardId)) {
      const result = store.castCommander(cardId);
      if (result !== 'ok') {
        setPendingCast({ kind: 'commander', cardId, shortfall: result.shortfall });
      }
      return;
    }

    if (card.zone === 'library') {
      store.draw(1);
    }
  }

  function handleLibraryDoubleClick(e: React.MouseEvent): void {
    e.stopPropagation();
    hoverPreview.suppress();
    store.draw(1);
  }

  function buildMenuItems(cardId: string): { title: string; items: MenuItem[] } {
    const card = cards[cardId];
    const def = state!.defs[card.defId];
    const face = def?.faces[card.faceIndex] ?? def?.faces[0];
    const displayName = face?.printedName ?? face?.name ?? def?.printedName ?? def?.name ?? '不明';
    const items: MenuItem[] = [];
    const typeLine = typeLineFor(cardId);
    const isTreasure = def?.tokenKind === 'treasure';
    const isSacrificeToken =
      def?.tokenKind === 'treasure' ||
      def?.tokenKind === 'clue' ||
      def?.tokenKind === 'food' ||
      def?.tokenKind === 'blood';

    if (card.zone === 'battlefield') {
      items.push({
        key: 'tap',
        label: card.tapped ? 'アンタップ' : 'タップ',
        onSelect: () => store.toggleTap(cardId),
      });

      const produced = def?.producedMana ?? [];
      if (isTreasure) {
        items.push({
          key: 'crack-treasure',
          label: '割ってマナを出す',
          onSelect: () => {
            requestTreasureCrack(cardId);
          },
          separator: true,
        });
      } else if (produced.length > 0 && !card.tapped) {
        items.push({
          key: 'tapForMana',
          label: 'マナを生成してタップ',
          onSelect: () => {
            const result = store.tapForMana(cardId);
            if (result === 'needs-choice') {
              setManaChoice({ kind: 'tap', cardId, options: produced });
            }
          },
          separator: true,
        });
      }

      if (isSacrificeToken) {
        items.push({
          key: 'sacrifice-token',
          label: '生け贄に捧げる',
          onSelect: () => store.moveCard(cardId, 'graveyard'),
          danger: true,
          separator: !isTreasure,
        });
      }
    }

    if (card.zone === 'hand') {
      if (typeLine.includes('Land')) {
        items.push({
          key: 'play-land',
          label: '土地としてプレイ',
          onSelect: () => requestPlayLand(cardId),
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

    if (card.zone === 'battlefield' && typeLine.includes('Planeswalker')) {
      items.push(
        {
          key: 'loyalty-plus',
          label: '忠誠値+1',
          onSelect: () =>
            store.dispatch({ type: 'addCounters', cardId, counterType: 'loyalty', delta: 1 }),
          separator: true,
        },
        {
          key: 'loyalty-minus',
          label: '忠誠値-1',
          onSelect: () =>
            store.dispatch({ type: 'addCounters', cardId, counterType: 'loyalty', delta: -1 }),
          disabled: (card.counters.loyalty ?? 0) <= 0,
        }
      );
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
    hoverPreview.suppress();
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
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="playmat" onClick={closeMenu}>
        <SidePanel
          state={state}
          store={store}
          onMulligan={() => {
            store.mulligan();
            const nextState = useGameStore.getState().state;
            const bottomCount = Math.max(0, (nextState?.mulliganCount ?? 0) - 1);
            setMulliganBottomCount(bottomCount > 0 ? bottomCount : null);
          }}
          onRestart={() => setConfirmAction('restart')}
          onBackToImport={() => setConfirmAction('back-to-import')}
          onCreateToken={() => setTokenDialogOpen(true)}
        />

        <div className="playmat__center">
          <Battlefield
            state={state}
            onCardContextMenu={handleCardContextMenu}
            onCardDoubleClick={handleCardDoubleClick}
            hoverPreview={hoverPreview}
          />
          <Hand
            state={state}
            onCardContextMenu={handleCardContextMenu}
            onCardDoubleClick={handleCardDoubleClick}
            hoverPreview={hoverPreview}
          />
        </div>

        <div className="playmat__right">
          <Zones
            state={state}
            store={store}
            onOpenViewer={(zone) => setZoneViewer(zone)}
            onCommanderContextMenu={handleCommanderContextMenu}
            onCardDoubleClick={handleCardDoubleClick}
            onLibraryDoubleClick={handleLibraryDoubleClick}
            hoverPreview={hoverPreview}
          />
          <GameLog log={state.log} expanded={logExpanded} onToggle={() => setLogExpanded((v) => !v)} />
        </div>

        {hoverPreview.target &&
          !menu &&
          !isDialogOpen &&
          !activeDragId &&
          cards[hoverPreview.target.cardId] && (
            <CardPreview
              instance={cards[hoverPreview.target.cardId]}
              def={state.defs[cards[hoverPreview.target.cardId].defId]}
              anchorRect={hoverPreview.target.rect}
            />
          )}

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
              if (manaChoice.kind === 'treasure') {
                store.crackTreasure(manaChoice.cardId, color);
              } else {
                store.tapForMana(manaChoice.cardId, color);
              }
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

        {pendingLandPlay && (
          <ConfirmDialog
            title="土地を続けてプレイしますか?"
            message="このターンは既に土地を置いています。続けますか?"
            confirmLabel="続ける"
            onConfirm={() => {
              store.playLand(pendingLandPlay.cardId, { force: true });
              setPendingLandPlay(null);
            }}
            onCancel={() => setPendingLandPlay(null)}
            testId="land-play-confirm-dialog"
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
            onCreate={(name, typeLine, power, toughness, qty, opts) => {
              store.createToken(name, typeLine, power || undefined, toughness || undefined, qty, opts);
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

        {confirmAction === 'restart' && (
          <ConfirmDialog
            title="最初からやり直す"
            message="このゲームを終了し、同じデッキで最初からやり直します。現在の進行状況は失われます。よろしいですか?"
            confirmLabel="やり直す"
            onConfirm={() => {
              store.restart();
              setConfirmAction(null);
            }}
            onCancel={() => setConfirmAction(null)}
            testId="restart-confirm-dialog"
          />
        )}

        {confirmAction === 'back-to-import' && (
          <ConfirmDialog
            title="デッキ選択に戻る"
            message="このゲームを終了し、デッキ選択画面に戻ります。現在の進行状況は失われます。よろしいですか?"
            confirmLabel="デッキ選択に戻る"
            onConfirm={() => {
              useGameStore.setState({ state: null, warnings: [], canUndo: false, canRedo: false });
              setConfirmAction(null);
            }}
            onCancel={() => setConfirmAction(null)}
            testId="back-to-import-confirm-dialog"
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
