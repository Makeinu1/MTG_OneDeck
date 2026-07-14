/**
 * gameController — 新レイアウト(GameScreen)のカード操作+ダイアログ統括フック。
 *
 * docs/ui-architecture-v2.md §2/§6・docs/design-playbook.md §3 D2。
 *
 * 旧 Playmat.tsx のダイアログ機構(~25 の transient/guided dialog + request 系ヘルパ)を、
 * 新レイアウトが消費できる自己完結フックへ再構成したもの。**旧 Playmat は無編集**
 * (ロールバック経路の保全)ゆえ当面は機構が二重化する——これは D1 で受理済みの
 * 「actionCatalog は buildMenuItems の重複実装、D4 で統合」パターンの継続であり、
 * 本フックの handlerFor(=bindAction 相当)+ actionCatalog specs が **D4 で唯一の正本**になる。
 *
 * カード操作の onSelect は buildMenuItems を複製せず、actionCatalog(純関数 spec)+
 * handlerFor(id→store 呼び出しの switch)で組む=旧 374 行のクロージャを畳んだ。
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { freeMulliganBottomCount, useGameStore, type GameStore } from '../../store/gameStore';
import type { GameState, PlayerId, ZoneId } from '../../engine/types';
import { isCommander, commanderTax } from '../../engine/commander';
import { eligibleTargets } from '../../engine/commands';
import { parseManaCost } from '../../engine/mana';
import { fetchAbility, type FetchAbility } from '../../engine/status';
import type { RuleActionCandidateKind } from '../playmat/ruleActionCandidates';
import type { ManaColor } from '../../types/card';
import type { KeybindingsMap } from '../../data/keybindings';
import { useShortcuts } from '../../hooks/useShortcuts';
import { ContextMenu, type MenuItem } from '../ContextMenu';
import type { MenuTarget } from '../types';
import { CardActionSheet } from './CardActionSheet';
import { buildCardActionCatalog, rankActions } from './actionCatalog';
import { celebrate } from './sound';
import { ManualKeywordsDialog } from './ManualKeywordsDialog';
import { TargetPickerDialog } from '../playmat/TargetPickerDialog';
import {
  ArrangeTopDialog,
  AttackDialog,
  CountDialog,
  ManaChoiceDialog,
  ShortfallDialog,
  CommanderMoveDialog,
  LandTapChoiceDialog,
  ModalChoiceDialog,
  TokenCreateDialog,
  XCostDialog,
  ZoneViewerDialog,
  MulliganBottomDialog,
  MulliganDecisionDialog,
  ConfirmDialog,
  FetchSearchDialog,
  GuidedLibrarySearchDialog,
} from '../playmat/dialogs';
import { transitionCueFor, type TransitionCueData } from './transitionCueModel';
import type { DropIntent } from './dragIntent';

/** カード操作の開き先。既定=カードシート(D1)。VITE_UI_V2_SHEET=false で ContextMenu へ。 */
function isV2SheetEnabled(): boolean {
  return import.meta.env.VITE_UI_V2_SHEET !== 'false';
}

/** 狭い版面=bottom sheet / 広い版面=カーソル近傍 popover(design-system §8 CardActionSheet)。 */
function cardSheetVariant(): 'sheet' | 'popover' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'sheet';
  return window.matchMedia('(min-width: 900px)').matches ? 'popover' : 'sheet';
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

const TARGET_RULE_ACTION_TITLES: Record<string, string> = {
  'sacrifice-target': '対象の生け贄',
  'destroy-target': '対象を破壊',
  'exile-target': '対象を追放',
  'counters-target': '対象にカウンター',
  'attach-target': '装備/付与',
};

type MenuTriggerEvent = React.MouseEvent<HTMLElement> | React.PointerEvent<HTMLElement>;
type PendingMove = { cardId: string; to: ZoneId };
type PendingPaymentAction =
  | { kind: 'stack'; cardId: string; shortfall: number; xValue: number }
  | { kind: 'cycle'; cardId: string; shortfall: number };
type ManaChoiceRequest = { kind: 'tap' | 'treasure'; cardId: string; options: ManaColor[] };
type PendingXCast = { cardId: string };
type PendingLandTapChoice = { cardId: string; force?: boolean };
type CountDialogState = { kind: 'draw' | 'mill' | 'peek' | 'discard-random'; defaultValue: number };
type FetchDialogState = { abilityId: string; sourceId: string; ability: FetchAbility };
type PendingRuleTargetAction = { kind: string; sourceCardId: string };

function isCommanderZoneChoiceDestination(zone: ZoneId): boolean {
  return zone === 'graveyard' || zone === 'exile' || zone === 'hand' || zone === 'library';
}
function commanderZoneChoiceMode(zone: ZoneId): 'replacement' | 'sba' {
  return zone === 'graveyard' || zone === 'exile' ? 'sba' : 'replacement';
}

export interface GameController {
  state: GameState | null;
  store: GameStore;
  /** カードシート/コンテキストメニューを開く(タップ/右クリック)。 */
  openCardMenu: (cardId: string, e: MenuTriggerEvent) => void;
  /** ダブルクリック/クイックアクション。 */
  handleCardDoubleClick: (cardId: string, e: React.MouseEvent) => void;
  /** スタックを1件/全件解決(フェッチはダイアログを挟む)。 */
  requestResolveTop: () => void;
  requestResolveAll: () => void;
  advancePhase: () => void;
  advanceTurn: () => void;
  undo: () => void;
  redo: () => void;
  setManualTargets: (stackItemId: string, targetIds: string[], targetPlayerIds?: PlayerId[]) => void;
  /** ライブラリ操作メニュー(引く/シャッフル/切削/占術…)。 */
  openLibraryActions: (e: MenuTriggerEvent) => void;
  libraryActionsOpen: boolean;
  /** ゾーンビューア(墓地/追放/ライブラリ)を開く。 */
  openZoneViewer: (zone: 'graveyard' | 'exile' | 'library') => void;
  openTokenDialog: () => void;
  openAttackDialog: () => void;
  openArrangeTop: () => void;
  openCountDialog: (kind: CountDialogState['kind'], defaultValue: number) => void;
  requestConfirm: (action: 'restart' | 'back-to-import') => void;
  /** 誘発候補の件数(PrimaryAction 状態機械・ベルバッジ用)。 */
  triggerCandidateCount: number;
  /** 祝祭アニメを許可するか(初期マウント/再開の一斉再生を抑止・D5)。 */
  motionArmed: boolean;
  /** フィード(誘発/警告/ログ)の開閉。GameScreen が feedOpen で <Feed> を描画。 */
  feedOpen: boolean;
  openFeed: () => void;
  closeFeed: () => void;
  /** 全ダイアログ+メニューの描画ノード(GameScreen が末尾に置く)。 */
  overlays: ReactNode;
  /** ショートカット無効化フラグ(ダイアログ表示中)。 */
  shortcutsBlocked: boolean;
  transitionCue: TransitionCueData | null;
  dismissTransitionCue: (id: number) => void;
  /** DnDの意味を既存のカード操作経路へ合流させる。 */
  performDrop: (intent: DropIntent) => void;
  /** ドラッグ開始時にhover以外の一時UIも閉じる。 */
  closeTransientUi: () => void;
}

/**
 * 新レイアウト用のゲーム操作統括フック。GameScreen が唯一の呼び出し元。
 */
export function useGameController({
  keybindings,
  externalShortcutsBlocked = false,
}: {
  keybindings: KeybindingsMap;
  externalShortcutsBlocked?: boolean;
}): GameController {
  const store = useGameStore();
  const { state, mulliganDecisionPending } = store;

  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const [libraryMenu, setLibraryMenu] = useState<{
    x: number;
    y: number;
    restoreFocusTo: HTMLElement | null;
  } | null>(null);
  const [manaChoice, setManaChoice] = useState<ManaChoiceRequest | null>(null);
  const [pendingPayment, setPendingPayment] = useState<PendingPaymentAction | null>(null);
  const [pendingXCast, setPendingXCast] = useState<PendingXCast | null>(null);
  const [pendingLandPlay, setPendingLandPlay] = useState<{ cardId: string } | null>(null);
  const [pendingLandTapChoice, setPendingLandTapChoice] = useState<PendingLandTapChoice | null>(null);
  const [commanderMove, setCommanderMove] = useState<{ cardId: string; to: ZoneId } | null>(null);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [zoneViewer, setZoneViewer] = useState<'graveyard' | 'exile' | 'library' | null>(null);
  const [fetchDialog, setFetchDialog] = useState<FetchDialogState | null>(null);
  const [pendingRuleTarget, setPendingRuleTarget] = useState<PendingRuleTargetAction | null>(null);
  const [pendingBloodCrackCardId, setPendingBloodCrackCardId] = useState<string | null>(null);
  const [manualKeywordsCardId, setManualKeywordsCardId] = useState<string | null>(null);
  const [arrangeTopOpen, setArrangeTopOpen] = useState(false);
  const [countDialog, setCountDialog] = useState<CountDialogState | null>(null);
  const [peekCount, setPeekCount] = useState<number | null>(null);
  const [attackDialogOpen, setAttackDialogOpen] = useState(false);
  const [mulliganBottomCount, setMulliganBottomCount] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<'restart' | 'back-to-import' | null>(null);
  const [feedOpen, setFeedOpen] = useState(false);
  const [transitionCue, setTransitionCue] = useState<TransitionCueData | null>(null);
  const transitionCueIdRef = useRef(0);
  const dismissTransitionCue = useCallback((id: number) => {
    setTransitionCue((current) => current?.id === id ? null : current);
  }, []);
  // 祝祭アニメの初期マウント抑止(D5 Tier-1 #1)。ゲーム開始/再開の一斉再生を防ぐため、
  // 最初のフレーム後に arm=true。以降に入るカードだけドロー/ETB演出する(初手の儀式は D7)。
  const [motionArmed, setMotionArmed] = useState(false);
  useEffect(() => {
    // setTimeout(非表示タブでも発火。rAF は背景タブで発火しないため不採用)。初回描画後に arm。
    const id = setTimeout(() => setMotionArmed(true), 0);
    return () => clearTimeout(id);
  }, []);

  const isDialogOpen =
    store.pendingGuided !== null ||
    manaChoice !== null ||
    pendingPayment !== null ||
    pendingXCast !== null ||
    pendingLandPlay !== null ||
    pendingLandTapChoice !== null ||
    commanderMove !== null ||
    tokenDialogOpen ||
    zoneViewer !== null ||
    fetchDialog !== null ||
    pendingRuleTarget !== null ||
    pendingBloodCrackCardId !== null ||
    manualKeywordsCardId !== null ||
    arrangeTopOpen ||
    countDialog !== null ||
    peekCount !== null ||
    attackDialogOpen ||
    mulliganBottomCount !== null ||
    confirmAction !== null;
  const shortcutsBlocked =
    mulliganDecisionPending ||
    isDialogOpen ||
    menu !== null ||
    libraryMenu !== null ||
    feedOpen ||
    externalShortcutsBlocked;

  useShortcuts({
    onNextPhase: () => {
      const s = useGameStore.getState().state;
      if (s && s.zones.stack.length > 0) {
        requestResolveTop();
        return;
      }
      advancePhase();
    },
    onNextTurn: () => advanceTurn(),
    onUndo: () => undo(),
    onRedo: () => redo(),
    onRestart: () => setConfirmAction('restart'),
    onDraw: () => store.draw(1),
    isDialogOpen: shortcutsBlocked,
    keybindings,
  });

  const cards = state?.cards ?? {};

  function announceTransition(previous: GameState, next: GameState | null): void {
    if (!next) return;
    const cue = transitionCueFor(previous, next);
    if (!cue) return;
    transitionCueIdRef.current += 1;
    setTransitionCue({ ...cue, id: transitionCueIdRef.current });
  }

  function advancePhase(): void {
    const previous = useGameStore.getState().state;
    if (!previous) return;
    store.nextPhase();
    announceTransition(previous, useGameStore.getState().state);
  }

  function advanceTurn(): void {
    const previous = useGameStore.getState().state;
    if (!previous) return;
    store.nextTurn();
    announceTransition(previous, useGameStore.getState().state);
  }

  function undo(): void {
    setTransitionCue(null);
    store.undo();
  }

  function redo(): void {
    setTransitionCue(null);
    store.redo();
  }

  function typeLineFor(cardId: string): string {
    const card = cards[cardId];
    if (!card || !state) return '';
    const def = state.defs[card.defId];
    const face = def?.faces[card.faceIndex] ?? def?.faces[0];
    return face?.typeLine ?? def?.typeLine ?? '';
  }
  function cardNameFor(cardId: string): string {
    const card = cards[cardId];
    if (!card || !state) return '不明';
    const def = state.defs[card.defId];
    const face = def?.faces[card.faceIndex] ?? def?.faces[0];
    return face?.printedName ?? face?.name ?? def?.printedName ?? def?.name ?? '不明';
  }
  function manaCostFor(cardId: string): string {
    const card = cards[cardId];
    if (!card || !state) return '';
    const def = state.defs[card.defId];
    const face = def?.faces[card.faceIndex] ?? def?.faces[0];
    return face?.manaCost ?? '';
  }
  function requiresXValue(cardId: string): boolean {
    return parseManaCost(manaCostFor(cardId)).x > 0;
  }
  function treasureColors(cardId: string): ManaColor[] {
    const card = cards[cardId];
    if (!card || !state) return ['W', 'U', 'B', 'R', 'G'];
    const def = state.defs[card.defId];
    return def?.producedMana?.length ? def.producedMana : ['W', 'U', 'B', 'R', 'G'];
  }
  function battlefieldPermanentIds(): string[] {
    if (!state) return [];
    return state.zones.battlefield.filter((id) => cards[id] && !cards[id].isAbility);
  }
  function targetIdsForRuleAction(kind: string): string[] {
    const ids = battlefieldPermanentIds();
    if (kind === 'attach-target') return ids.filter((id) => typeLineFor(id).includes('Creature'));
    return ids;
  }

  function requestPlayLand(cardId: string, opts?: { force?: boolean; entersTapped?: boolean }): void {
    const result = store.playLand(cardId, opts);
    if (result === 'needs-confirm') setPendingLandPlay({ cardId });
    else if (result === 'needs-tap-choice') setPendingLandTapChoice({ cardId, force: opts?.force });
  }
  function requestCastToStack(cardId: string, xValue?: number): void {
    if (xValue === undefined && requiresXValue(cardId)) {
      setPendingXCast({ cardId });
      return;
    }
    const chosenXValue = xValue ?? 0;
    const result = store.castToStack(cardId, { xValue: chosenXValue });
    if (result !== 'ok') {
      setPendingPayment({ kind: 'stack', cardId, shortfall: result.shortfall, xValue: chosenXValue });
    }
  }
  function requestCycle(cardId: string): void {
    const result = store.cycle(cardId);
    if (result !== 'ok') setPendingPayment({ kind: 'cycle', cardId, shortfall: result.shortfall });
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
    return { abilityId, sourceId: abilityCard.sourceId, ability };
  }
  function requestResolveTop(): void {
    const s = useGameStore.getState().state;
    const dialog = fetchDialogForTop(s);
    if (dialog) {
      setFetchDialog(dialog); // フェッチはダイアログ経由=まだ解決していないので祝祭しない(Tier-1 #2)。
      return;
    }
    celebrate('resolve'); // 実際に解決する時だけ祝祭(ハプティクス+音・装飾層)。
    store.resolveTop();
  }
  function requestResolveAll(): void {
    store.resolveAll();
    const s = useGameStore.getState().state;
    const dialog = s ? fetchDialogForTop(s) : null;
    if (dialog) setFetchDialog(dialog);
  }
  function moveStackItem(cardId: string, to: ZoneId): void {
    if (!state) return;
    const topId = state.zones.stack[state.zones.stack.length - 1];
    if (cardId === topId) store.resolveTop(to);
    else store.removeStackItem(cardId, to);
  }
  function requestTreasureCrack(cardId: string): void {
    const options = treasureColors(cardId);
    if (options.length === 1) {
      store.crackTreasure(cardId, options[0]);
      return;
    }
    setManaChoice({ kind: 'treasure', cardId, options });
  }
  function requestBloodCrack(cardId: string): void {
    const s = useGameStore.getState().state;
    if (!s || s.zones.hand.length === 0) {
      store.crackBlood(cardId);
      return;
    }
    setPendingBloodCrackCardId(cardId);
  }
  function performMove(move: PendingMove): void {
    if (!state) return;
    const card = cards[move.cardId];
    if (!card) return;
    if (card.zone === 'hand' && move.to === 'battlefield' && typeLineFor(move.cardId).includes('Land')) {
      requestPlayLand(move.cardId);
      return;
    }
    if (
      isCommander(state, move.cardId) &&
      card.zone !== 'command' &&
      isCommanderZoneChoiceDestination(move.to)
    ) {
      setCommanderMove({ cardId: move.cardId, to: move.to });
      return;
    }
    store.moveCard(move.cardId, move.to);
  }
  function performDrop(intent: DropIntent): void {
    switch (intent.kind) {
      case 'cast':
        requestCastToStack(intent.cardId);
        break;
      case 'play-land':
        requestPlayLand(intent.cardId);
        break;
      case 'move-zone':
        performMove({ cardId: intent.cardId, to: intent.zone });
        break;
      case 'none':
        break;
    }
  }
  function runRuleActionCandidate(kind: RuleActionCandidateKind, sourceCardId: string): void {
    switch (kind) {
      case 'draw':
        setCountDialog({ kind: 'draw', defaultValue: 1 });
        break;
      case 'mill':
        setCountDialog({ kind: 'mill', defaultValue: 1 });
        break;
      case 'scry-surveil':
        setArrangeTopOpen(true);
        break;
      case 'token':
        setTokenDialogOpen(true);
        break;
      case 'proliferate':
        store.proliferateAll();
        break;
      case 'discard':
        setCountDialog({ kind: 'discard-random', defaultValue: 1 });
        break;
      case 'shuffle':
        store.shuffleLibrary();
        break;
      case 'search-library':
        setZoneViewer('library');
        break;
      case 'return-from-zone':
        setZoneViewer('graveyard');
        break;
      case 'sacrifice-target':
      case 'destroy-target':
      case 'exile-target':
      case 'counters-target':
      case 'attach-target':
        setPendingRuleTarget({ kind, sourceCardId });
        break;
    }
  }
  function pickRuleActionTarget(targetId: string): void {
    if (!pendingRuleTarget) return;
    switch (pendingRuleTarget.kind) {
      case 'sacrifice-target':
      case 'destroy-target':
        store.moveCard(targetId, 'graveyard');
        break;
      case 'exile-target':
        store.moveCard(targetId, 'exile');
        break;
      case 'counters-target':
        store.dispatch({ type: 'addCounters', cardId: targetId, counterType: '+1/+1', delta: 1 });
        break;
      case 'attach-target':
        store.dispatch({ type: 'attach', cardId: pendingRuleTarget.sourceCardId, to: targetId });
        break;
    }
    setPendingRuleTarget(null);
  }

  /** アクション id → onSelect(旧 buildMenuItems のハンドラ束ね=D4 の bindAction 正本)。 */
  function handlerFor(id: string, cardId: string): () => void {
    const card = cards[cardId];
    const def = card && state ? state.defs[card.defId] : undefined;

    if (id.startsWith('rule-candidate-')) {
      const kind = id.slice('rule-candidate-'.length) as RuleActionCandidateKind;
      return () => runRuleActionCandidate(kind, cardId);
    }
    if (id.startsWith('stack-move-')) {
      const to = id.slice('stack-move-'.length) as ZoneId;
      return () => moveStackItem(cardId, to);
    }
    if (id.startsWith('move-')) {
      const to = id.slice('move-'.length) as ZoneId;
      return () => performMove({ cardId, to });
    }

    switch (id) {
      case 'tap':
        return () => store.toggleTap(cardId);
      case 'tapForMana':
        return () => {
          const result = store.tapForMana(cardId);
          if (result === 'needs-choice') {
            setManaChoice({ kind: 'tap', cardId, options: def?.producedMana ?? [] });
          }
        };
      case 'crack-treasure':
        return () => requestTreasureCrack(cardId);
      case 'crack-clue':
        return () => store.crackClue(cardId);
      case 'crack-food':
        return () => store.crackFood(cardId);
      case 'crack-blood':
        return () => requestBloodCrack(cardId);
      case 'sacrifice-token':
        return () => store.moveCard(cardId, 'graveyard');
      case 'fetch-activate':
        return () => {
          const ability = fetchAbility(def);
          if (ability) store.activateFetch(cardId, { entersTapped: ability.entersTapped, lifeCost: ability.lifeCost });
        };
      case 'manual-keywords':
        return () => setManualKeywordsCardId(cardId);
      case 'copy-permanent':
      case 'stack-copy-permanent':
        return () => store.copyPermanent(cardId);
      case 'stack-copy-effect':
      case 'stack-copy-ability':
        return () => store.copyStackItem(cardId);
      case 'ability-activate':
        return () => store.activateAbility(cardId);
      case 'ability-trigger':
        return () => store.addAbilityToStack(cardId, 'triggered');
      case 'stack-resolve-top':
        return () => requestResolveTop();
      case 'stack-resolve-all':
        return () => requestResolveAll();
      case 'stack-counter':
      case 'stack-remove-ability':
        return () => store.removeStackItem(cardId);
      case 'play-land':
      case 'play-land-from-graveyard':
        return () => requestPlayLand(cardId);
      case 'cast-to-stack':
      case 'cast-from-zone':
        return () => requestCastToStack(cardId);
      case 'cycle':
        return () => requestCycle(cardId);
      case 'discard':
        return () => store.discard([cardId]);
      case 'card-effects-auto':
        return () => card && store.setCardEffectsAuto(cardId, card.effectsAuto === false);
      case 'flip':
        return () => {
          if (!def) return;
          const nextFace = ((card?.faceIndex ?? 0) + 1) % def.faces.length;
          store.dispatch({ type: 'setFace', cardId, faceIndex: nextFace });
        };
      case 'facedown':
        return () => store.dispatch({ type: 'setFaceDown', cardId, faceDown: !card?.faceDown });
      case 'counter-plus':
        return () => store.dispatch({ type: 'addCounters', cardId, counterType: '+1/+1', delta: 1 });
      case 'counter-minus':
        return () => store.dispatch({ type: 'addCounters', cardId, counterType: '+1/+1', delta: -1 });
      case 'loyalty-plus':
        return () => store.dispatch({ type: 'addCounters', cardId, counterType: 'loyalty', delta: 1 });
      case 'loyalty-minus':
        return () => store.dispatch({ type: 'addCounters', cardId, counterType: 'loyalty', delta: -1 });
      default:
        // cast-cost-advisory 等(disabled/no-op)。
        return () => undefined;
    }
  }

  /** カードシート表示モデル。actionCatalog specs から MenuItem[] を組み handlerFor で束ねる。 */
  function buildSheetModel(cardId: string): {
    title: string;
    typeLine: string;
    colorIdentity: string[];
    rankedItems: MenuItem[];
    otherItems: MenuItem[];
  } {
    const card = cards[cardId];
    const def = card && state ? state.defs[card.defId] : undefined;
    const isCommanderCard = card && state ? isCommander(state, cardId) : false;
    const catalog = buildCardActionCatalog({
      card,
      def,
      typeLine: typeLineFor(cardId),
      displayName: cardNameFor(cardId),
      isCommanderCard,
      canAffordCast: true, // 精密なマナ判定は D3。
      landDropAvailable: state ? state.landsPlayedThisTurn < 1 : false,
      commanderTax: isCommanderCard && state ? commanderTax(state, cardId) : 0,
    });
    const items: MenuItem[] = catalog.specs.map((spec) => ({
      key: spec.id,
      label: spec.label,
      testId: spec.testId,
      danger: spec.danger,
      separator: spec.separator,
      disabled: spec.disabled,
      onSelect: handlerFor(spec.id, cardId),
    }));
    const itemByKey = new Map(items.map((item) => [item.key, item]));
    const rankedItems = rankActions(catalog.specs)
      .map((spec) => itemByKey.get(spec.id))
      .filter((item): item is MenuItem => item !== undefined);
    const rankedKeys = new Set(rankedItems.map((item) => item.key));
    const otherItems = items.filter((item) => !rankedKeys.has(item.key));
    return {
      title: catalog.title,
      typeLine: typeLineFor(cardId),
      colorIdentity: def?.colorIdentity ?? [],
      rankedItems,
      otherItems,
    };
  }

  function buildLibraryMenuItems(): MenuItem[] {
    return [
      { key: 'library-draw', label: '引く', testId: 'library-draw', onSelect: () => store.draw(1) },
      { key: 'library-draw-n', label: 'N枚引く', testId: 'library-draw-n', onSelect: () => setCountDialog({ kind: 'draw', defaultValue: 1 }) },
      { key: 'library-shuffle', label: 'シャッフル', testId: 'library-shuffle', onSelect: () => store.shuffleLibrary() },
      { key: 'mill', label: '切削', testId: 'mill', onSelect: () => setCountDialog({ kind: 'mill', defaultValue: 1 }) },
      { key: 'scry-surveil', label: '占術 / 諜報', testId: 'scry-surveil', onSelect: () => setArrangeTopOpen(true) },
      { key: 'peek', label: '上を見る', testId: 'peek', onSelect: () => setCountDialog({ kind: 'peek', defaultValue: 3 }) },
      { key: 'library-view', label: 'サーチ', testId: 'library-view', onSelect: () => setZoneViewer('library') },
    ];
  }

  // --- imperative openers ---
  function openCardMenu(cardId: string, e: MenuTriggerEvent): void {
    e.stopPropagation();
    const bounds = e.currentTarget.getBoundingClientRect();
    setLibraryMenu(null);
    setMenu({
      cardId,
      x: e.clientX || bounds.left + bounds.width / 2,
      y: e.clientY || bounds.top + bounds.height / 2,
    });
  }
  function openLibraryActions(e: MenuTriggerEvent): void {
    e.stopPropagation();
    setMenu(null);
    const bounds = e.currentTarget.getBoundingClientRect();
    const restoreFocusTo = e.currentTarget instanceof HTMLButtonElement
      ? e.currentTarget
      : e.currentTarget.querySelector<HTMLButtonElement>('[data-testid="library-tile"]');
    restoreFocusTo?.focus({ preventScroll: true });
    setLibraryMenu({
      x: e.clientX || bounds.left + bounds.width / 2,
      y: e.clientY || bounds.top + bounds.height / 2,
      restoreFocusTo,
    });
  }
  function closeMenu(): void {
    setMenu(null);
    setLibraryMenu(null);
  }
  function handleCardDoubleClick(cardId: string, e: React.MouseEvent): void {
    e.stopPropagation();
    if (!state) return;
    const card = cards[cardId];
    if (!card) return;
    const def = state.defs[card.defId];
    if (card.zone === 'hand') {
      if (typeLineFor(cardId).includes('Land')) requestPlayLand(cardId);
      else requestCastToStack(cardId);
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
        if (result === 'needs-choice') setManaChoice({ kind: 'tap', cardId, options: produced });
        return;
      }
      store.toggleTap(cardId);
      return;
    }
    if (card.zone === 'command' && isCommander(state, cardId)) {
      requestCastToStack(cardId);
      return;
    }
    if (card.zone === 'library') store.draw(1);
  }

  // --- overlays (menu + all dialogs) ---
  const guidedPrompt = store.pendingGuided?.prompts[0] ?? null;
  const guidedTargetIds =
    state && guidedPrompt?.kind === 'target' && guidedPrompt.targetKind !== 'player'
      ? eligibleTargets(state, guidedPrompt.filter ?? {}, { sourceId: store.pendingGuided?.sourceId })
      : [];
  const guidedTargetPlayerIds: PlayerId[] =
    guidedPrompt?.kind === 'target' &&
    (guidedPrompt.targetKind === 'player' || guidedPrompt.targetKind === 'object-or-player')
      ? ['P1', 'OPPONENT_A']
      : [];
  const guidedSacrificeIds =
    state && guidedPrompt?.kind === 'sacrifice'
      ? eligibleTargets(state, guidedPrompt.filter ?? { types: ['permanent'], controller: 'you' })
      : [];
  const guidedCostSelectedIds = new Set(
    (store.pendingGuided?.activation?.costComponents ?? []).flatMap((component) => [
      ...(component.subjectRef ? [component.subjectRef.physicalCardId] : []),
      ...(component.subjectRefs?.map((ref) => ref.physicalCardId) ?? []),
    ]),
  );
  const guidedCostSubjectIds =
    !state || !guidedPrompt
      ? []
      : guidedPrompt.kind === 'cost-discard'
        ? state.zones.hand.filter((id) => !guidedCostSelectedIds.has(id))
        : guidedPrompt.kind === 'cost-sacrifice'
          ? eligibleTargets(state, guidedPrompt.filter ?? { types: ['permanent'], controller: 'you' }).filter(
              (id) => id !== store.pendingGuided?.sourceId && !guidedCostSelectedIds.has(id),
            )
          : [];
  const ruleTargetIds = pendingRuleTarget ? targetIdsForRuleAction(pendingRuleTarget.kind) : [];
  const peekIds =
    !state || peekCount === null
      ? []
      : state.zones.library.slice(0, Math.min(peekCount, state.zones.library.length));
  const opponentLabels = state
    ? Array.from(new Set(['対戦相手A', ...Object.keys(state.opponentLife), ...Object.keys(state.commanderDamage)]))
    : [];
  const manualKeywordCard = manualKeywordsCardId ? cards[manualKeywordsCardId] : undefined;
  const countDialogConfig =
    countDialog?.kind === 'draw'
      ? { title: 'N枚引く', label: '枚数', inputTestId: 'draw-n', confirmTestId: 'draw-n-confirm' }
      : countDialog?.kind === 'mill'
        ? { title: '切削', label: '枚数', inputTestId: 'mill-n', confirmTestId: 'mill-confirm' }
        : countDialog?.kind === 'peek'
          ? { title: 'ライブラリの上を見る', label: '枚数', inputTestId: 'peek-n', confirmTestId: 'peek-confirm' }
          : countDialog?.kind === 'discard-random'
            ? { title: 'ランダムに捨てる', label: '枚数', inputTestId: 'discard-random-n', confirmTestId: 'discard-random-confirm' }
            : null;

  const overlays: ReactNode = !state ? null : (
    <>
      {menu &&
        (isV2SheetEnabled() ? (
          (() => {
            const model = buildSheetModel(menu.cardId);
            return (
              <CardActionSheet
                title={model.title}
                typeLine={model.typeLine}
                colorIdentity={model.colorIdentity}
                rankedItems={model.rankedItems}
                otherItems={model.otherItems}
                variant={cardSheetVariant()}
                anchor={{ x: menu.x, y: menu.y }}
                onClose={closeMenu}
              />
            );
          })()
        ) : (
          <ContextMenu
            x={menu.x}
            y={menu.y}
            title={buildSheetModel(menu.cardId).title}
            items={[...buildSheetModel(menu.cardId).rankedItems, ...buildSheetModel(menu.cardId).otherItems]}
            onClose={closeMenu}
          />
        ))}

      {libraryMenu && (
        <ContextMenu
          x={libraryMenu.x}
          y={libraryMenu.y}
          title="ライブラリー"
          items={buildLibraryMenuItems()}
          onClose={closeMenu}
          restoreFocusTo={libraryMenu.restoreFocusTo}
        />
      )}

      {manualKeywordsCardId && manualKeywordCard && (
        <ManualKeywordsDialog
          cardName={cardNameFor(manualKeywordsCardId)}
          initialKeywords={manualKeywordCard.manualKeywords}
          onConfirm={(keywords) => {
            store.setManualKeywords(manualKeywordsCardId, keywords);
            setManualKeywordsCardId(null);
          }}
          onCancel={() => setManualKeywordsCardId(null)}
        />
      )}

      {mulliganDecisionPending && (
        <MulliganDecisionDialog
          state={state}
          onKeep={() => {
            const count = useGameStore.getState().state?.mulliganCount ?? 0;
            store.keepOpeningHand();
            const bottom = freeMulliganBottomCount(count);
            if (bottom > 0) setMulliganBottomCount(bottom);
            else store.beginFirstTurn();
          }}
          onMulligan={() => store.mulligan()}
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

      {manaChoice && (
        <ManaChoiceDialog
          options={manaChoice.options}
          onChoose={(color) => {
            if (manaChoice.kind === 'treasure') store.crackTreasure(manaChoice.cardId, color);
            else store.tapForMana(manaChoice.cardId, color);
            setManaChoice(null);
          }}
          onCancel={() => setManaChoice(null)}
        />
      )}

      {guidedPrompt?.kind === 'mana' && (
        <ManaChoiceDialog
          options={guidedPrompt.manaOptions ?? []}
          onChoose={(color) => store.confirmGuidedMana(color)}
          onCancel={() => store.cancelGuidedPrompt()}
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
            if (pendingPayment.kind === 'stack') store.castToStack(pendingPayment.cardId, { force: true, xValue: pendingPayment.xValue });
            else store.cycle(pendingPayment.cardId, { force: true });
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
            const target = pendingLandPlay.cardId;
            setPendingLandPlay(null);
            requestPlayLand(target, { force: true });
          }}
          onCancel={() => setPendingLandPlay(null)}
          testId="land-play-confirm-dialog"
        />
      )}

      {pendingLandTapChoice && (
        <LandTapChoiceDialog
          cardName={cardNameFor(pendingLandTapChoice.cardId)}
          onChoose={(entersTapped) => {
            requestPlayLand(pendingLandTapChoice.cardId, { force: pendingLandTapChoice.force, entersTapped });
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

      {guidedPrompt?.kind === 'target' && (
        <TargetPickerDialog
          title="対象を選択"
          cardIds={guidedTargetIds}
          playerIds={guidedTargetPlayerIds}
          state={state}
          onPick={(id) => store.confirmGuidedTarget(id)}
          onPickPlayer={(id) => store.confirmGuidedPlayerTarget(id)}
          onCancel={() => store.cancelGuidedPrompt()}
        />
      )}
      {guidedPrompt?.kind === 'discard' && (
        <TargetPickerDialog
          title="捨てるカードを選択"
          cardIds={state.zones.hand}
          state={state}
          onPick={(id) => store.confirmGuidedDiscard(id)}
          onCancel={() => store.cancelGuidedPrompt()}
        />
      )}
      {guidedPrompt?.kind === 'library-search' && (
        <GuidedLibrarySearchDialog
          state={state}
          sourceId={store.pendingGuided?.sourceId ?? ''}
          prompt={guidedPrompt}
          onConfirm={(id) => store.confirmGuidedLibrarySearch(id)}
          onMiss={() => store.confirmGuidedLibrarySearch()}
          onClose={() => store.cancelGuidedPrompt()}
        />
      )}
      {guidedPrompt?.kind === 'sacrifice' && (
        <TargetPickerDialog
          title="生け贄を選択"
          cardIds={guidedSacrificeIds}
          state={state}
          onPick={(id) => store.confirmGuidedSacrifice(id)}
          onCancel={() => store.cancelGuidedPrompt()}
        />
      )}
      {(guidedPrompt?.kind === 'cost-discard' || guidedPrompt?.kind === 'cost-sacrifice') && (
        <TargetPickerDialog
          title={guidedPrompt.kind === 'cost-discard' ? '捨てるカードを選択' : '生け贄を選択'}
          cardIds={guidedCostSubjectIds}
          state={state}
          onPick={(id) => store.confirmGuidedCostSubject(id)}
          onCancel={() => store.cancelGuidedPrompt()}
        />
      )}
      {guidedPrompt?.kind === 'scry-surveil' && (
        <ArrangeTopDialog
          key={`guided-arrange-${guidedPrompt.raw}`}
          state={state}
          initialCount={guidedPrompt.count}
          initialMode={guidedPrompt.atom === 'effect.surveil' ? 'surveil' : 'scry'}
          lockCount
          lockMode
          onConfirm={(topOrder, toBottom, toGraveyard) => store.confirmGuidedScrySurveil(topOrder, toBottom, toGraveyard)}
          onCancel={() => store.cancelGuidedPrompt()}
        />
      )}
      {guidedPrompt?.kind === 'modal' && (
        <ModalChoiceDialog
          prompt={guidedPrompt}
          onConfirm={(chosen) => store.confirmGuidedModal(chosen)}
          onCancel={() => store.cancelGuidedPrompt()}
        />
      )}

      {pendingRuleTarget && (
        <TargetPickerDialog
          title={TARGET_RULE_ACTION_TITLES[pendingRuleTarget.kind] ?? '対象を選択'}
          cardIds={ruleTargetIds}
          state={state}
          onPick={pickRuleActionTarget}
          onCancel={() => setPendingRuleTarget(null)}
        />
      )}
      {pendingBloodCrackCardId && (
        <TargetPickerDialog
          title="捨てるカードを選択"
          cardIds={state.zones.hand}
          state={state}
          onPick={(discardCardId) => {
            store.crackBlood(pendingBloodCrackCardId, discardCardId);
            setPendingBloodCrackCardId(null);
          }}
          onCancel={() => setPendingBloodCrackCardId(null)}
        />
      )}
      {commanderMove && (
        <CommanderMoveDialog
          cardName={cardNameFor(commanderMove.cardId)}
          destinationLabel={ZONE_LABELS[commanderMove.to]}
          mode={commanderZoneChoiceMode(commanderMove.to)}
          onChoose={(toCommandZone) => {
            store.moveCommanderWithZoneChoice(commanderMove.cardId, commanderMove.to, toCommandZone);
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
            if (countDialog.kind === 'draw') store.draw(count);
            else if (countDialog.kind === 'mill') store.mill(count);
            else if (countDialog.kind === 'peek') setPeekCount(count);
            else store.discardRandom(count);
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
          onCardContextMenu={openCardMenu}
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
          cardIds={state.zones[zoneViewer]}
          state={state}
          onMove={(cardId, to) => performMove({ cardId, to })}
          onCardContextMenu={openCardMenu}
          onClose={() => setZoneViewer(null)}
        />
      )}
      {confirmAction === 'restart' && (
        <ConfirmDialog
          title="最初からやり直す"
          message="このゲームを終了し、同じデッキで最初からやり直します。現在の進行状況は失われます。よろしいですか?"
          confirmLabel="やり直す"
          onConfirm={() => {
            setTransitionCue(null);
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
              triggerCandidates: [],
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
    </>
  );

  return {
    state: state ?? null,
    store,
    openCardMenu,
    handleCardDoubleClick,
    requestResolveTop,
    requestResolveAll,
    advancePhase,
    advanceTurn,
    undo,
    redo,
    setManualTargets: (stackItemId, targetIds, targetPlayerIds) => store.setManualTargets(stackItemId, targetIds, targetPlayerIds),
    openLibraryActions,
    libraryActionsOpen: libraryMenu !== null,
    openZoneViewer: (zone) => setZoneViewer(zone),
    openTokenDialog: () => setTokenDialogOpen(true),
    openAttackDialog: () => setAttackDialogOpen(true),
    openArrangeTop: () => setArrangeTopOpen(true),
    openCountDialog: (kind, defaultValue) => setCountDialog({ kind, defaultValue }),
    requestConfirm: (action) => setConfirmAction(action),
    triggerCandidateCount: store.triggerCandidates.length,
    motionArmed,
    feedOpen,
    openFeed: () => setFeedOpen(true),
    closeFeed: () => setFeedOpen(false),
    overlays,
    shortcutsBlocked,
    transitionCue,
    dismissTransitionCue,
    performDrop,
    closeTransientUi: closeMenu,
  };
}
