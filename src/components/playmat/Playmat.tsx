import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { freeMulliganBottomCount, useGameStore } from '../../store/gameStore';
import type { GameState, ZoneId } from '../../engine/types';
import { isCommander } from '../../engine/commander';
import { ContextMenu, type MenuItem } from '../ContextMenu';
import type { MenuTarget } from '../types';
import { CardView } from '../CardView';
import { CardPreview } from '../CardPreview';
import { Battlefield } from './Battlefield';
import { Hand } from './Hand';
import { InfoPanel } from './InfoPanel';
import { Stack } from './Stack';
import { Zones } from './Zones';
import { GameLog } from './GameLog';
import { Toasts } from './Toasts';
import { ControlRail, LifeOverlay, ManaOverlay, MatchControls, OtherActions, PhaseOverlay } from './PlaymatHud';
import {
  ArrangeTopDialog,
  AttackDialog,
  CountDialog,
  ManaChoiceDialog,
  ShortfallDialog,
  CommanderMoveDialog,
  LandTapChoiceDialog,
  TokenCreateDialog,
  XCostDialog,
  ZoneViewerDialog,
  MulliganBottomDialog,
  MulliganDecisionDialog,
  ConfirmDialog,
  FetchSearchDialog,
} from './dialogs';
import type { ManaColor } from '../../types/card';
import { parseManaCost } from '../../engine/mana';
import { cyclingCost, fetchAbility } from '../../engine/status';
import type { FetchAbility } from '../../engine/status';
import { useShortcuts } from '../../hooks/useShortcuts';
import { useHoverPreview } from '../../hooks/useHoverPreview';
import type { KeybindingsMap } from '../../data/keybindings';

type PendingMove = { cardId: string; to: ZoneId };
type PendingPaymentAction =
  | { kind: 'stack'; cardId: string; shortfall: number; xValue: number }
  | { kind: 'cycle'; cardId: string; shortfall: number };
type ManaChoiceRequest = {
  kind: 'tap' | 'treasure';
  cardId: string;
  options: ManaColor[];
};
type PendingXCast = { kind: 'stack'; cardId: string };
type PendingLandTapChoice = { cardId: string; force?: boolean };
type CountDialogState = {
  kind: 'draw' | 'mill' | 'peek' | 'discard-random';
  defaultValue: number;
};
type FetchDialogState = { abilityId: string; sourceId: string; ability: FetchAbility };
type MenuTriggerEvent =
  | React.MouseEvent<HTMLElement>
  | React.PointerEvent<HTMLElement>;

function opponentLabelsFromState(state: NonNullable<ReturnType<typeof useGameStore.getState>['state']>): string[] {
  return Array.from(
    new Set(['対戦相手A', ...Object.keys(state.opponentLife), ...Object.keys(state.commanderDamage)])
  );
}

/** The main playmat screen: battlefield, hand, side panel, zones, log, and all dialogs. */
export interface PlaymatProps {
  keybindings: KeybindingsMap;
}

/** The main playmat screen: battlefield, hand, side panel, zones, log, and all dialogs. */
export function Playmat({ keybindings }: PlaymatProps) {
  const store = useGameStore();
  const { state, warnings, mulliganDecisionPending } = store;

  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const [libraryMenu, setLibraryMenu] = useState<{ x: number; y: number } | null>(null);
  const [manaChoice, setManaChoice] = useState<ManaChoiceRequest | null>(null);
  const [pendingPayment, setPendingPayment] = useState<PendingPaymentAction | null>(null);
  const [pendingXCast, setPendingXCast] = useState<PendingXCast | null>(null);
  const [pendingLandPlay, setPendingLandPlay] = useState<{ cardId: string } | null>(null);
  const [pendingLandTapChoice, setPendingLandTapChoice] = useState<PendingLandTapChoice | null>(null);
  const [commanderMove, setCommanderMove] = useState<{ cardId: string; to: ZoneId } | null>(null);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [zoneViewer, setZoneViewer] = useState<'graveyard' | 'exile' | 'library' | null>(null);
  const [fetchDialog, setFetchDialog] = useState<FetchDialogState | null>(null);
  const [arrangeTopOpen, setArrangeTopOpen] = useState(false);
  const [countDialog, setCountDialog] = useState<CountDialogState | null>(null);
  const [peekCount, setPeekCount] = useState<number | null>(null);
  const [attackDialogOpen, setAttackDialogOpen] = useState(false);
  const [mulliganBottomCount, setMulliganBottomCount] = useState<number | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'restart' | 'back-to-import' | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [logExpanded, setLogExpanded] = useState(false);

  const hoverPreview = useHoverPreview();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const isDialogOpen =
    manaChoice !== null ||
    pendingPayment !== null ||
    pendingXCast !== null ||
    pendingLandPlay !== null ||
    pendingLandTapChoice !== null ||
    commanderMove !== null ||
    tokenDialogOpen ||
    zoneViewer !== null ||
    fetchDialog !== null ||
    arrangeTopOpen ||
    countDialog !== null ||
    peekCount !== null ||
    attackDialogOpen ||
    mulliganBottomCount !== null ||
    infoOpen ||
    confirmAction !== null;
  const shortcutsBlocked = mulliganDecisionPending || isDialogOpen;

  useShortcuts({
    onNextPhase: () => {
      const currentState = useGameStore.getState().state;
      if (currentState && currentState.zones.stack.length > 0) {
        requestResolveTop();
        return;
      }
      store.nextPhase();
    },
    onNextTurn: () => store.nextTurn(),
    onUndo: () => store.undo(),
    onRedo: () => store.redo(),
    onRestart: () => setConfirmAction('restart'),
    onDraw: () => store.draw(1),
    isDialogOpen: shortcutsBlocked,
    keybindings,
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

  function cardNameFor(cardId: string): string {
    const card = cards[cardId];
    if (!card) return '不明';
    const def = state!.defs[card.defId];
    const face = def?.faces[card.faceIndex] ?? def?.faces[0];
    return face?.printedName ?? face?.name ?? def?.printedName ?? def?.name ?? '不明';
  }

  function manaCostFor(cardId: string): string {
    const card = cards[cardId];
    if (!card) return '';
    const def = state!.defs[card.defId];
    const face = def?.faces[card.faceIndex] ?? def?.faces[0];
    return face?.manaCost ?? '';
  }

  function requiresXValue(cardId: string): boolean {
    return parseManaCost(manaCostFor(cardId)).x > 0;
  }

  function requestPlayLand(
    cardId: string,
    opts?: { force?: boolean; entersTapped?: boolean }
  ): void {
    const result = store.playLand(cardId, opts);
    if (result === 'needs-confirm') {
      setPendingLandPlay({ cardId });
    } else if (result === 'needs-tap-choice') {
      setPendingLandTapChoice({ cardId, force: opts?.force });
    }
  }

  function requestCastToStack(cardId: string, xValue?: number): void {
    if (xValue === undefined && requiresXValue(cardId)) {
      setPendingXCast({ kind: 'stack', cardId });
      return;
    }

    const chosenXValue = xValue ?? 0;
    const result = store.castToStack(cardId, { xValue: chosenXValue });
    if (result !== 'ok') {
      setPendingPayment({
        kind: 'stack',
        cardId,
        shortfall: result.shortfall,
        xValue: chosenXValue,
      });
    }
  }

  function requestCycle(cardId: string): void {
    const result = store.cycle(cardId);
    if (result !== 'ok') {
      setPendingPayment({ kind: 'cycle', cardId, shortfall: result.shortfall });
    }
  }

  function fetchDialogForTop(currentState: GameState | null): FetchDialogState | null {
    if (!currentState || currentState.zones.stack.length === 0) return null;

    const abilityId = currentState.zones.stack[currentState.zones.stack.length - 1];
    const abilityCard = currentState.cards[abilityId];
    if (!abilityCard?.isAbility || !abilityCard.sourceId) return null;

    const source = currentState.cards[abilityCard.sourceId];
    if (!source) return null;

    const ability = fetchAbility(currentState.defs[source.defId]);
    if (!ability) return null;

    return {
      abilityId,
      sourceId: abilityCard.sourceId,
      ability,
    };
  }

  function requestResolveTop(): void {
    const currentState = useGameStore.getState().state;
    const dialog = fetchDialogForTop(currentState);
    if (dialog) {
      setFetchDialog(dialog);
      return;
    }
    store.resolveTop();
  }

  function requestResolveAll(): void {
    store.resolveAll();
    const currentState = useGameStore.getState().state;
    const dialog = currentState ? fetchDialogForTop(currentState) : null;
    if (dialog) {
      setFetchDialog(dialog);
    }
  }

  function moveStackItem(cardId: string, to: ZoneId): void {
    const topId = state!.zones.stack[state!.zones.stack.length - 1];
    if (cardId === topId) {
      store.resolveTop(to);
      return;
    }
    store.removeStackItem(cardId, to);
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

  function openCardMenu(cardId: string, e: MenuTriggerEvent): void {
    e.stopPropagation();
    hoverPreview.suppress();
    setLibraryMenu(null);
    setMenu({ cardId, x: e.clientX, y: e.clientY });
  }

  function handleCardContextMenu(cardId: string, e: MenuTriggerEvent): void {
    openCardMenu(cardId, e);
  }

  function handleCommanderContextMenu(cardId: string, e: MenuTriggerEvent): void {
    openCardMenu(cardId, e);
  }

  function openLibraryMenu(e: MenuTriggerEvent): void {
    e.stopPropagation();
    hoverPreview.suppress();
    setMenu(null);
    setLibraryMenu({ x: e.clientX, y: e.clientY });
  }

  function closeMenu(): void {
    setMenu(null);
    setLibraryMenu(null);
  }

  /**
   * Double-click quick actions:
   * - hand land -> play as land
   * - hand spell -> cast to stack
   * - battlefield untapped mana source -> tap for mana (color picker if multiple)
   * - battlefield other card -> toggle tap
   * - command zone commander -> cast to stack
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
        requestCastToStack(cardId);
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
      requestCastToStack(cardId);
      return;
    }

    if (card.zone === 'library') {
      store.draw(1);
    }
  }

  function buildLibraryMenuItems(): MenuItem[] {
    return [
      {
        key: 'library-draw',
        label: '引く',
        testId: 'library-draw',
        onSelect: () => store.draw(1),
      },
      {
        key: 'library-draw-n',
        label: 'N枚引く',
        testId: 'library-draw-n',
        onSelect: () => setCountDialog({ kind: 'draw', defaultValue: 1 }),
      },
      {
        key: 'library-shuffle',
        label: 'シャッフル',
        testId: 'library-shuffle',
        onSelect: () => store.shuffleLibrary(),
      },
      {
        key: 'mill',
        label: '切削',
        testId: 'mill',
        onSelect: () => setCountDialog({ kind: 'mill', defaultValue: 1 }),
      },
      {
        key: 'scry-surveil',
        label: '占術 / 諜報',
        testId: 'scry-surveil',
        onSelect: () => setArrangeTopOpen(true),
      },
      {
        key: 'peek',
        label: '上を見る',
        testId: 'peek',
        onSelect: () => setCountDialog({ kind: 'peek', defaultValue: 3 }),
      },
      {
        key: 'library-view',
        label: 'サーチ',
        testId: 'library-view',
        onSelect: () => setZoneViewer('library'),
      },
    ];
  }

  function buildMenuItems(cardId: string): { title: string; items: MenuItem[] } {
    const card = cards[cardId];
    const def = state!.defs[card.defId];
    const face = def?.faces[card.faceIndex] ?? def?.faces[0];
    const displayName = face?.printedName ?? face?.name ?? def?.printedName ?? def?.name ?? '不明';
    const items: MenuItem[] = [];
    const typeLine = typeLineFor(cardId);
    const isTreasure = def?.tokenKind === 'treasure';
    const fetch = typeLine.includes('Land') ? fetchAbility(def) : null;
    const isSacrificeToken =
      def?.tokenKind === 'treasure' ||
      def?.tokenKind === 'clue' ||
      def?.tokenKind === 'food' ||
      def?.tokenKind === 'blood';

    if (card.zone === 'stack') {
      const stackItems: MenuItem[] = [
        {
          key: 'stack-resolve-top',
          label: '上から解決',
          onSelect: () => requestResolveTop(),
        },
        {
          key: 'stack-resolve-all',
          label: '全解決',
          onSelect: () => requestResolveAll(),
        },
      ];

      if (!card.isAbility) {
        const isPermanentSpell = !/Instant|Sorcery/i.test(typeLine);
        stackItems.push({
          key: 'stack-copy-effect',
          label: '効果をコピー(スタックへ)',
          testId: 'copy-effect',
          onSelect: () => store.copyStackItem(cardId),
          separator: true,
        });
        if (isPermanentSpell) {
          stackItems.push({
            key: 'stack-copy-permanent',
            label: 'パーマネントとしてコピー(トークン)',
            testId: 'copy-permanent',
            onSelect: () => store.copyPermanent(cardId),
          });
        }

        const stackMoveTargets: Array<{ zone: ZoneId; label: string }> = [
          { zone: 'battlefield', label: '戦場へ移す' },
          { zone: 'graveyard', label: '墓地へ移す' },
          { zone: 'exile', label: '追放へ移す' },
          { zone: 'hand', label: '手札へ戻す' },
        ];

        stackMoveTargets.forEach((target, index) => {
          stackItems.push({
            key: `stack-move-${target.zone}`,
            label: target.label,
            onSelect: () => moveStackItem(cardId, target.zone),
            separator: index === 0,
          });
        });

        stackItems.push({
          key: 'stack-counter',
          label: '打ち消す',
          onSelect: () => store.removeStackItem(cardId),
          danger: true,
        });
      } else {
        stackItems.push({
          key: 'stack-copy-ability',
          label: 'コピー(スタックへ)',
          testId: 'copy-ability',
          onSelect: () => store.copyStackItem(cardId),
          separator: true,
        });
        stackItems.push({
          key: 'stack-remove-ability',
          label: '取り除く',
          onSelect: () => store.removeStackItem(cardId),
          danger: true,
        });
      }

      return { title: displayName, items: stackItems };
    }

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

      if (fetch) {
        items.push({
          key: 'fetch-activate',
          label: 'フェッチ起動(スタックへ)',
          testId: 'fetch-activate',
          onSelect: () =>
            store.activateFetch(cardId, {
              entersTapped: fetch.entersTapped,
              lifeCost: fetch.lifeCost,
            }),
          separator: true,
        });
      }

      items.push({
        key: 'copy-permanent',
        label: 'コピー(トークン)',
        testId: 'copy-permanent',
        onSelect: () => store.copyPermanent(cardId),
        separator: !fetch,
      });

      items.push(
        {
          key: 'ability-activate',
          label: '能力を起動(スタックへ)',
          testId: 'ability-activate',
          onSelect: () => store.addAbilityToStack(cardId, 'activated'),
          separator: true,
        },
        {
          key: 'ability-trigger',
          label: '誘発を積む(スタックへ)',
          testId: 'ability-trigger',
          onSelect: () => store.addAbilityToStack(cardId, 'triggered'),
        }
      );
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
          key: 'cast-to-stack',
          label: '唱える(スタック)',
          testId: 'cast-to-stack',
          onSelect: () => requestCastToStack(cardId),
          separator: true,
        });
      }

      const cycleCost = cyclingCost(def);
      if (cycleCost) {
        items.push({
          key: 'cycle',
          label: `サイクリング(${cycleCost})`,
          onSelect: () => requestCycle(cardId),
        });
      }

      items.push({
        key: 'discard',
        label: '捨てる(墓地へ)',
        onSelect: () => store.discard([cardId]),
      });
    }

    if (card.zone === 'command' && isCommander(state!, cardId)) {
      items.push({
        key: 'cast-to-stack',
        label: '唱える(スタック)',
        testId: 'cast-to-stack',
        onSelect: () => requestCastToStack(cardId),
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
  const peekIds =
    peekCount === null ? [] : state.zones.library.slice(0, Math.min(peekCount, state.zones.library.length));
  const opponentLabels = opponentLabelsFromState(state);
  const countDialogConfig =
    countDialog?.kind === 'draw'
      ? {
          title: 'N枚引く',
          label: '枚数',
          inputTestId: 'draw-n',
          confirmTestId: 'draw-n-confirm',
        }
      : countDialog?.kind === 'mill'
        ? {
            title: '切削',
            label: '枚数',
            inputTestId: 'mill-n',
            confirmTestId: 'mill-confirm',
          }
        : countDialog?.kind === 'peek'
          ? {
              title: 'ライブラリの上を見る',
              label: '枚数',
              inputTestId: 'peek-n',
              confirmTestId: 'peek-confirm',
            }
          : countDialog?.kind === 'discard-random'
            ? {
                title: 'ランダムに捨てる',
                label: '枚数',
                inputTestId: 'discard-random-n',
                confirmTestId: 'discard-random-confirm',
              }
            : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="playmat" onClick={closeMenu}>
        <div className="playmat__board">
          <div className="playmat__battlefield-stage">
            <Battlefield
              state={state}
              onCardContextMenu={handleCardContextMenu}
              onCardDoubleClick={handleCardDoubleClick}
              hoverPreview={hoverPreview}
              creatureOverlay={<PhaseOverlay state={state} />}
              landOverlay={<ManaOverlay state={state} store={store} />}
            />
            <Stack
              state={state}
              onCardContextMenu={handleCardContextMenu}
              hoverPreview={hoverPreview}
              onResolveTop={requestResolveTop}
              onResolveAll={requestResolveAll}
            />
          </div>

          <div className="playmat__handrow">
            <Hand
              state={state}
              onCardContextMenu={handleCardContextMenu}
              onCardDoubleClick={handleCardDoubleClick}
              hoverPreview={hoverPreview}
              overlay={<LifeOverlay state={state} store={store} />}
            />

            <div className="playmat__controls">
              <ControlRail store={store} />
            </div>
          </div>
        </div>

        <div className="playmat__utility">
          <Zones
            state={state}
            onOpenViewer={(zone) => setZoneViewer(zone)}
            onOpenLibraryMenu={openLibraryMenu}
            onCardContextMenu={handleCardContextMenu}
            onCommanderContextMenu={handleCommanderContextMenu}
            onCardDoubleClick={handleCardDoubleClick}
            hoverPreview={hoverPreview}
          />
          <OtherActions
            store={store}
            onCreateToken={() => setTokenDialogOpen(true)}
            onAttack={() => setAttackDialogOpen(true)}
            onDiscardRandom={() => setCountDialog({ kind: 'discard-random', defaultValue: 1 })}
            onOpenInfo={() => setInfoOpen(true)}
          />
          <MatchControls
            store={store}
            onRestart={() => setConfirmAction('restart')}
            onBackToImport={() => setConfirmAction('back-to-import')}
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

        {infoOpen && <InfoPanel state={state} onClose={() => setInfoOpen(false)} />}

        {menu && (
          <ContextMenu
            x={menu.x}
            y={menu.y}
            title={buildMenuItems(menu.cardId).title}
            items={buildMenuItems(menu.cardId).items}
            onClose={closeMenu}
          />
        )}

        {libraryMenu && (
          <ContextMenu
            x={libraryMenu.x}
            y={libraryMenu.y}
            title="ライブラリ"
            items={buildLibraryMenuItems()}
            onClose={closeMenu}
          />
        )}

        {mulliganDecisionPending && (
          <MulliganDecisionDialog
            state={state}
            onKeep={() => {
              const count = useGameStore.getState().state?.mulliganCount ?? 0;
              store.keepOpeningHand();
              const bottom = freeMulliganBottomCount(count);
              if (bottom > 0) {
                setMulliganBottomCount(bottom);
              } else {
                store.beginFirstTurn();
              }
            }}
            onMulligan={() => {
              store.mulligan();
            }}
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

        {pendingXCast && (
          <XCostDialog
            cardName={cardNameFor(pendingXCast.cardId)}
            manaCost={manaCostFor(pendingXCast.cardId)}
            onConfirm={(xValue) => {
              requestCastToStack(pendingXCast.cardId, xValue);
              setPendingXCast(null);
            }}
            onCancel={() => setPendingXCast(null)}
          />
        )}

        {pendingPayment && (
          <ShortfallDialog
            shortfall={pendingPayment.shortfall}
            onForce={() => {
              if (pendingPayment.kind === 'stack') {
                store.castToStack(pendingPayment.cardId, {
                  force: true,
                  xValue: pendingPayment.xValue,
                });
              } else {
                store.cycle(pendingPayment.cardId, { force: true });
              }
              setPendingPayment(null);
            }}
            onCancel={() => setPendingPayment(null)}
          />
        )}

        {pendingLandPlay && (
          <ConfirmDialog
            title="土地を続けてプレイしますか?"
            message="このターンは既に土地を置いています。続けますか?"
            confirmLabel="続ける"
            onConfirm={() => {
              setPendingLandPlay(null);
              requestPlayLand(pendingLandPlay.cardId, { force: true });
            }}
            onCancel={() => setPendingLandPlay(null)}
            testId="land-play-confirm-dialog"
          />
        )}

        {pendingLandTapChoice && (
          <LandTapChoiceDialog
            cardName={cardNameFor(pendingLandTapChoice.cardId)}
            onChoose={(entersTapped) => {
              requestPlayLand(pendingLandTapChoice.cardId, {
                force: pendingLandTapChoice.force,
                entersTapped,
              });
              setPendingLandTapChoice(null);
            }}
            onCancel={() => setPendingLandTapChoice(null)}
          />
        )}

        {fetchDialog && (
          <FetchSearchDialog
            state={state}
            sourceId={fetchDialog.sourceId}
            ability={fetchDialog.ability}
            onConfirm={(targetId, opts) => {
              store.resolveFetch(fetchDialog.abilityId, targetId, opts);
              setFetchDialog(null);
            }}
            onClose={() => setFetchDialog(null)}
          />
        )}

        {commanderMove && (
          <CommanderMoveDialog
            cardName={cardNameFor(commanderMove.cardId)}
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

        {attackDialogOpen && (
          <AttackDialog
            state={state}
            opponentLabels={opponentLabels}
            onConfirm={(attackerIds, targetLabel) => {
              store.declareAttack(attackerIds, targetLabel);
              setAttackDialogOpen(false);
            }}
            onCancel={() => setAttackDialogOpen(false)}
          />
        )}

        {arrangeTopOpen && (
          <ArrangeTopDialog
            state={state}
            onConfirm={(topOrder, toBottom, toGraveyard) => {
              store.arrangeTop(topOrder, toBottom, toGraveyard);
              setArrangeTopOpen(false);
            }}
            onCancel={() => setArrangeTopOpen(false)}
          />
        )}

        {countDialog && countDialogConfig && (
          <CountDialog
            title={countDialogConfig.title}
            label={countDialogConfig.label}
            defaultValue={countDialog.defaultValue}
            inputTestId={countDialogConfig.inputTestId}
            confirmTestId={countDialogConfig.confirmTestId}
            onConfirm={(count) => {
              if (countDialog.kind === 'draw') {
                store.draw(count);
              } else if (countDialog.kind === 'mill') {
                store.mill(count);
              } else if (countDialog.kind === 'peek') {
                setPeekCount(count);
              } else {
                store.discardRandom(count);
              }
              setCountDialog(null);
            }}
            onCancel={() => setCountDialog(null)}
          />
        )}

        {peekCount !== null && (
          <ZoneViewerDialog
            zone="library"
            cardIds={peekIds}
            state={state}
            onCardContextMenu={handleCardContextMenu}
            onClose={() => setPeekCount(null)}
            readOnly
            searchEnabled={false}
            title={`ライブラリの上${peekIds.length}枚`}
            testId="peek-dialog"
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
            onCardContextMenu={handleCardContextMenu}
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
              store.beginFirstTurn();
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
              useGameStore.setState({
                state: null,
                warnings: [],
                canUndo: false,
                canRedo: false,
                mulliganDecisionPending: false,
              });
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
  stack: 'スタック',
};
