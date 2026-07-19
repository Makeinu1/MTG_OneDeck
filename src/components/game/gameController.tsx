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
import {
  freeMulliganBottomCount,
  guidedControllerId,
  useGameStore,
  type GameStore,
} from '../../store/gameStore';
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
import { triggerDirectAction } from './triggerDirectAction';
import { ManualKeywordsDialog } from './ManualKeywordsDialog';
import {
  ArrangeTopDialog,
  AttackDialog,
  CountDialog,
  ManaChoiceDialog,
  ShortfallDialog,
  ForceActivationDialog,
  CommanderMoveDialog,
  LandTapChoiceDialog,
  ModalChoiceDialog,
  TokenCreateDialog,
  XCostDialog,
  ZoneViewerDialog,
  ConfirmDialog,
  FetchSearchDialog,
  GuidedLibrarySearchDialog,
  CastFaceDialog,
} from '../playmat/dialogs';
import { MulliganStage } from './MulliganStage';
import { transitionCueFor, type TransitionCueData } from './transitionCueModel';
import type { DropIntent } from './dragIntent';
import { requestInteractionHistory } from './historyUiEvents';
import type { DecisionFocusModel } from './decisionFocus';

/** カード操作の開き先。既定=カードシート(D1)。VITE_UI_V2_SHEET=false で ContextMenu へ。 */
function isV2SheetEnabled(): boolean {
  return import.meta.env.VITE_UI_V2_SHEET !== 'false';
}

/** 狭い版面=bottom sheet / 広い版面=カーソル近傍 popover(design-system §8 CardActionSheet)。 */
function cardSheetVariant(): 'sheet' | 'popover' {
  if (typeof window === 'undefined' || !window.matchMedia) return 'sheet';
  return window.matchMedia('(min-width: 900px)').matches ? 'popover' : 'sheet';
}

import { ZONE_LABELS_JA as ZONE_LABELS } from '../../data/zoneLabels';

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
  | { kind: 'stack'; cardId: string; shortfall: number; xValue: number; faceIndex: number }
  | { kind: 'cycle'; cardId: string; shortfall: number };
type ManaChoiceRequest = { kind: 'tap' | 'treasure'; cardId: string; options: ManaColor[] };
type PendingXCast = { cardId: string; faceIndex: number };
type PendingLandTapChoice = { cardId: string; force?: boolean };
type CountDialogState = { kind: 'draw' | 'mill' | 'peek' | 'discard-random'; defaultValue: number };
type FetchDialogState = { abilityId: string; sourceId: string; ability: FetchAbility };
type PendingRuleTargetAction = { kind: string; sourceCardId: string };

export interface CommanderCutInData {
  token: number;
  cardId: string;
  faceIndex: number;
  name: string;
  typeLine: string;
  imageUrl?: string;
  landed: boolean;
}

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
  openCardMenuAt?: (cardId: string, x: number, y: number) => void;
  /** ダブルクリック/クイックアクション。 */
  handleCardDoubleClick: (cardId: string, e: React.MouseEvent) => void;
  /** スタックを1件/全件解決(フェッチはダイアログを挟む)。 */
  requestResolveTop: () => void;
  requestResolveAll: () => void;
  advancePhase: () => void;
  advanceTurn: () => void;
  undo: () => void;
  redo: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  setManualTargets: (stackItemId: string, targetIds: string[], targetPlayerIds?: PlayerId[]) => void;
  /** ライブラリ操作メニュー(引く/シャッフル/切削/占術…)。 */
  openLibraryActions: (e: MenuTriggerEvent) => void;
  libraryActionsOpen: boolean;
  /** ゾーンビューア(墓地/追放/ライブラリ)を開く。 */
  openZoneViewer: (zone: 'graveyard' | 'exile' | 'library') => void;
  /**
   * 相手盤面ビューア(モーダル)。常設しない=docs/design-vision.md:80 原則7
   * 「常設の…相手ライフ行…は廃止し『タップで出す』へ降格」。
   * overlays はコントローラ生成前に組まれ controller を参照できないため、
   * Feed と同じく GameScreen が opponentBoardOpen を見て描画する。
   */
  opponentBoardOpen: boolean;
  openOpponentBoard: () => void;
  closeOpponentBoard: () => void;
  openTokenDialog: () => void;
  openAttackDialog: () => void;
  openArrangeTop: () => void;
  openCountDialog: (kind: CountDialogState['kind'], defaultValue: number) => void;
  requestConfirm: (action: 'restart' | 'back-to-import') => void;
  /** 誘発候補の件数(PrimaryAction 状態機械・ベルバッジ用)。 */
  triggerCandidateCount: number;
  triggerSheetOpen?: boolean;
  processTriggers?: () => void;
  closeTriggerSheet?: () => void;
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
  /** 解決直前の統率者演出。旧レイアウト／テスト用controllerでは省略可能。 */
  commanderCutIn?: CommanderCutInData | null;
  resolutionLocked?: boolean;
  decisionFocus?: DecisionFocusModel | null;
  chooseDecisionCard?: (cardId: string) => void;
  chooseDecisionPlayer?: (playerId: PlayerId) => void;
  cancelDecision?: () => void;
  mulliganActive?: boolean;
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
  const pendingCommanderResolution = store.pendingCommanderResolution;
  const commitCommanderResolution = useCallback((token: number) => {
    useGameStore.getState().commitCommanderResolution(token);
  }, []);

  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const [libraryMenu, setLibraryMenu] = useState<{
    x: number;
    y: number;
    restoreFocusTo: HTMLElement | null;
  } | null>(null);
  const [manaChoice, setManaChoice] = useState<ManaChoiceRequest | null>(null);
  const [pendingPayment, setPendingPayment] = useState<PendingPaymentAction | null>(null);
  const [pendingXCast, setPendingXCast] = useState<PendingXCast | null>(null);
  const [pendingFaceCastCardId, setPendingFaceCastCardId] = useState<string | null>(null);
  const [pendingLandPlay, setPendingLandPlay] = useState<{ cardId: string } | null>(null);
  const [pendingLandTapChoice, setPendingLandTapChoice] = useState<PendingLandTapChoice | null>(null);
  const [commanderMove, setCommanderMove] = useState<{ cardId: string; to: ZoneId } | null>(null);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [zoneViewer, setZoneViewer] = useState<'graveyard' | 'exile' | 'library' | null>(null);
  const [opponentBoardOpen, setOpponentBoardOpen] = useState(false);
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
  const [triggerSheetOpen, setTriggerSheetOpen] = useState(false);
  const [transitionCue, setTransitionCue] = useState<TransitionCueData | null>(null);
  const [commanderCutIn, setCommanderCutIn] = useState<CommanderCutInData | null>(null);
  const commanderTimersRef = useRef<number[]>([]);
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

  useEffect(() => {
    const pending = pendingCommanderResolution;
    if (!pending) return;
    commanderTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    commanderTimersRef.current = [];
    const cue: CommanderCutInData = { ...pending, landed: false };
    const showTimer = window.setTimeout(() => setCommanderCutIn(cue), 0);
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const commitDelay = reducedMotion ? 80 : 780;
    const finishDelay = reducedMotion ? 240 : 1050;
    const commitTimer = window.setTimeout(() => {
      setCommanderCutIn((current) => current?.token === pending.token
        ? { ...current, landed: true }
        : current);
      commitCommanderResolution(pending.token);
      celebrate('commander');
    }, commitDelay);
    const finishTimer = window.setTimeout(() => {
      setCommanderCutIn((current) => current?.token === pending.token ? null : current);
    }, finishDelay);
    commanderTimersRef.current = [showTimer, commitTimer, finishTimer];
  }, [commitCommanderResolution, pendingCommanderResolution]);

  useEffect(() => () => {
    commanderTimersRef.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const isDialogOpen =
    store.pendingGuided !== null ||
    store.pendingForceActivation !== null ||
    manaChoice !== null ||
    pendingPayment !== null ||
    pendingXCast !== null ||
    pendingFaceCastCardId !== null ||
    pendingLandPlay !== null ||
    pendingLandTapChoice !== null ||
    commanderMove !== null ||
    tokenDialogOpen ||
    zoneViewer !== null ||
    opponentBoardOpen ||
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
  const resolutionLocked = store.pendingCommanderResolution !== null;
  const shortcutsBlocked =
    mulliganDecisionPending ||
    isDialogOpen ||
    menu !== null ||
    libraryMenu !== null ||
    feedOpen ||
    triggerSheetOpen ||
    resolutionLocked ||
    externalShortcutsBlocked;

  function processTriggers(): void {
    const current = useGameStore.getState();
    const currentState = current.state;
    if (!currentState) return;
    const action = triggerDirectAction(currentState, current.triggerCandidates);
    if (action.kind === 'place') {
      const candidate = action.candidate;
      if (candidate.pendingTriggerId) {
        current.placePendingTriggersForPriority([candidate.pendingTriggerId]);
      } else {
        current.addAbilityToStack(candidate.sourceId, 'triggered', candidate.abilityLineIndex);
      }
      return;
    }
    if (action.kind === 'sheet') setTriggerSheetOpen(true);
  }

  useShortcuts({
    onNextPhase: () => {
      const current = useGameStore.getState();
      const s = current.state;
      if (s && s.zones.stack.length > 0) {
        requestResolveTop();
        return;
      }
      if (current.triggerCandidates.length > 0) {
        processTriggers();
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

  function announceTransition(
    previous: GameState,
    next: GameState | null,
    options: { forceTurnStart?: boolean } = {},
  ): void {
    if (!next) return;
    const cue = transitionCueFor(previous, next, options);
    if (!cue) return;
    transitionCueIdRef.current += 1;
    setTransitionCue({ ...cue, id: transitionCueIdRef.current });
  }

  function beginFirstTurn(): void {
    const previous = useGameStore.getState().state;
    if (!previous) return;
    store.beginFirstTurn();
    announceTransition(previous, useGameStore.getState().state, { forceTurnStart: true });
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
    if (requestInteractionHistory('undo')) return;
    if (closeTopmostInteraction()) return;
    store.undo();
  }

  function redo(): void {
    setTransitionCue(null);
    if (requestInteractionHistory('redo')) return;
    store.redo();
  }

  function closeTopmostInteraction(): boolean {
    if (store.pendingForceActivation) {
      store.cancelForceActivation();
      return true;
    }
    if (manaChoice) { setManaChoice(null); return true; }
    if (pendingPayment) { setPendingPayment(null); return true; }
    if (pendingXCast) { setPendingXCast(null); return true; }
    if (pendingFaceCastCardId) { setPendingFaceCastCardId(null); return true; }
    if (pendingLandPlay) { setPendingLandPlay(null); return true; }
    if (pendingLandTapChoice) { setPendingLandTapChoice(null); return true; }
    if (commanderMove) { setCommanderMove(null); return true; }
    if (tokenDialogOpen) { setTokenDialogOpen(false); return true; }
    if (zoneViewer) { setZoneViewer(null); return true; }
    if (opponentBoardOpen) { setOpponentBoardOpen(false); return true; }
    if (fetchDialog) { setFetchDialog(null); return true; }
    if (pendingRuleTarget) { setPendingRuleTarget(null); return true; }
    if (pendingBloodCrackCardId) { setPendingBloodCrackCardId(null); return true; }
    if (manualKeywordsCardId) { setManualKeywordsCardId(null); return true; }
    if (arrangeTopOpen) { setArrangeTopOpen(false); return true; }
    if (countDialog) { setCountDialog(null); return true; }
    if (peekCount !== null) { setPeekCount(null); return true; }
    if (attackDialogOpen) { setAttackDialogOpen(false); return true; }
    if (mulliganBottomCount !== null) {
      setMulliganBottomCount(null);
      useGameStore.setState({ mulliganDecisionPending: true });
      return true;
    }
    if (confirmAction) { setConfirmAction(null); return true; }
    if (menu) { setMenu(null); return true; }
    if (libraryMenu) { setLibraryMenu(null); return true; }
    if (feedOpen) { setFeedOpen(false); return true; }
    if (triggerSheetOpen) { setTriggerSheetOpen(false); return true; }
    if (mulliganDecisionPending) return true;
    return false;
  }

  function typeLineFor(cardId: string): string {
    const card = cards[cardId];
    if (!card || !state) return '';
    const def = state.defs[card.defId];
    const face = def?.faces[card.faceIndex] ?? def?.faces[0];
    return face?.typeLine ?? def?.typeLine ?? '';
  }
  function cardNameFor(cardId: string, faceIndex?: number): string {
    const card = cards[cardId];
    if (!card || !state) return '不明';
    const def = state.defs[card.defId];
    const face = def?.faces[faceIndex ?? card.faceIndex] ?? def?.faces[0];
    return face?.printedName ?? face?.name ?? def?.printedName ?? def?.name ?? '不明';
  }
  function manaCostFor(cardId: string, faceIndex?: number): string {
    const card = cards[cardId];
    if (!card || !state) return '';
    const def = state.defs[card.defId];
    const face = def?.faces[faceIndex ?? card.faceIndex] ?? def?.faces[0];
    return face?.manaCost ?? '';
  }
  function requiresXValue(cardId: string, faceIndex?: number): boolean {
    return parseManaCost(manaCostFor(cardId, faceIndex)).x > 0;
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
  function requestCastToStack(cardId: string, xValue?: number, faceIndex?: number): void {
    const card = cards[cardId];
    const def = card && state ? state.defs[card.defId] : undefined;
    if (faceIndex === undefined && def?.layout === 'modal_dfc' && def.faces.length > 1) {
      setPendingFaceCastCardId(cardId);
      return;
    }
    const chosenFaceIndex = faceIndex ?? card?.faceIndex ?? 0;
    if (xValue === undefined && requiresXValue(cardId, chosenFaceIndex)) {
      setPendingXCast({ cardId, faceIndex: chosenFaceIndex });
      return;
    }
    const chosenXValue = xValue ?? 0;
    const result = store.castToStack(cardId, { xValue: chosenXValue, faceIndex: chosenFaceIndex });
    if (typeof result === 'object') {
      setPendingPayment({
        kind: 'stack',
        cardId,
        shortfall: result.shortfall,
        xValue: chosenXValue,
        faceIndex: chosenFaceIndex,
      });
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
    if (id.startsWith('ability-activate-')) {
      // ACT-2: 行選択 id(actionCatalog が >=2 行のとき出す)。素朴 parse で index を
      // 取り出す。NaN なら fail-closed で総称(index 未指定)側と同じ挙動へ倒す。
      const index = Number.parseInt(id.slice('ability-activate-'.length), 10);
      return Number.isNaN(index)
        ? () => store.activateAbility(cardId, undefined, { assistRestrictedMana: true })
        : () => store.activateAbility(cardId, index, { assistRestrictedMana: true });
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
        return () => store.activateAbility(cardId, undefined, { assistRestrictedMana: true });
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
    openCardMenuAt(
      cardId,
      e.clientX || bounds.left + bounds.width / 2,
      e.clientY || bounds.top + bounds.height / 2,
    );
  }
  function openCardMenuAt(cardId: string, x: number, y: number): void {
    setLibraryMenu(null);
    setMenu({ cardId, x, y });
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
  const guidedPlayerId = state && store.pendingGuided
    ? guidedControllerId(state, store.pendingGuided)
    : state?.localPlayerId;
  const guidedTargetIds =
    state && guidedPrompt?.kind === 'target' && guidedPrompt.targetKind !== 'player'
      ? eligibleTargets(state, guidedPrompt.filter ?? {}, { sourceId: store.pendingGuided?.sourceId })
      : [];
  const guidedTargetPlayerIds: PlayerId[] =
    state && guidedPrompt?.kind === 'target' &&
    (guidedPrompt.targetKind === 'player' || guidedPrompt.targetKind === 'object-or-player')
      ? state.turnOrder.slice()
      : [];
  const guidedSacrificeIds =
    state && guidedPrompt?.kind === 'sacrifice'
      ? eligibleTargets(
          state,
          guidedPrompt.filter ?? { types: ['permanent'], controller: 'you' },
          { sourceId: store.pendingGuided?.sourceId },
        )
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
        ? state.zonesByPlayer[guidedPlayerId ?? state.localPlayerId].hand.filter(
            (id) => !guidedCostSelectedIds.has(id),
          )
        : guidedPrompt.kind === 'cost-sacrifice'
          ? eligibleTargets(
              state,
              guidedPrompt.filter ?? { types: ['permanent'], controller: 'you' },
              { sourceId: store.pendingGuided?.sourceId },
            ).filter(
              (id) => id !== store.pendingGuided?.sourceId && !guidedCostSelectedIds.has(id),
            )
          : [];
  const ruleTargetIds = pendingRuleTarget ? targetIdsForRuleAction(pendingRuleTarget.kind) : [];
  const peekIds =
    !state || peekCount === null
      ? []
      : state.zones.library.slice(0, Math.min(peekCount, state.zones.library.length));
  const opponentLabels = state
    ? state.turnOrder
        .filter((playerId) => playerId !== state.localPlayerId)
        .map((playerId) => state.players[playerId]?.label ?? playerId)
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

  const decisionFocus: DecisionFocusModel | null = (() => {
    if (!state) return null;
    const sourceId = store.pendingGuided?.sourceId;
    if (guidedPrompt?.kind === 'target') return {
      kind: 'target', title: '対象を選択', instruction: '金色のカードを選んでください。長押しで内容を確認できます。',
      sourceId, candidateIds: guidedTargetIds, selectedIds: [], playerIds: guidedTargetPlayerIds,
    };
    if (guidedPrompt?.kind === 'discard') return {
      kind: 'discard', title: '捨てるカードを選択', instruction: '手札の候補から1枚選んでください。',
      sourceId, candidateIds: state.zonesByPlayer[guidedPlayerId ?? state.localPlayerId].hand, selectedIds: [],
    };
    if (guidedPrompt?.kind === 'sacrifice') return {
      kind: 'sacrifice', title: '生け贄を選択', instruction: '戦場の候補から1枚選んでください。',
      sourceId, candidateIds: guidedSacrificeIds, selectedIds: [],
    };
    if (guidedPrompt?.kind === 'cost-discard' || guidedPrompt?.kind === 'cost-sacrifice') return {
      kind: 'cost',
      title: guidedPrompt.kind === 'cost-discard' ? '起動コスト：捨てる' : '起動コスト：生け贄',
      instruction: '金色の候補を選んでコストを確定します。',
      sourceId, candidateIds: guidedCostSubjectIds, selectedIds: [...guidedCostSelectedIds],
      requiredCount: guidedPrompt.count,
    };
    if (pendingRuleTarget) return {
      kind: 'target', title: TARGET_RULE_ACTION_TITLES[pendingRuleTarget.kind] ?? '対象を選択',
      instruction: '金色の候補を選んでください。', sourceId: pendingRuleTarget.sourceCardId,
      candidateIds: ruleTargetIds, selectedIds: [],
    };
    if (pendingBloodCrackCardId) return {
      kind: 'discard', title: '血トークン：捨てるカード', instruction: '手札から1枚選んでください。',
      sourceId: pendingBloodCrackCardId, candidateIds: state.zones.hand, selectedIds: [],
    };
    if (guidedPrompt?.kind === 'mana') return {
      kind: 'payment', title: 'マナの色を選択', instruction: '支払いに使うマナを選んでください。',
      sourceId, candidateIds: [], selectedIds: [],
    };
    if (manaChoice) return {
      kind: 'payment', title: '生み出すマナを選択', instruction: '発生源を確認して色を選んでください。',
      sourceId: manaChoice.cardId, candidateIds: [], selectedIds: [],
    };
    if (pendingXCast) return {
      kind: 'payment', title: 'Xの値を決定', instruction: '支払うマナ量を入力してください。',
      sourceId: pendingXCast.cardId, candidateIds: [], selectedIds: [],
    };
    if (pendingPayment) return {
      kind: 'warning', title: 'マナが不足しています', instruction: '不足を確認し、強行するかキャンセルしてください。',
      sourceId: pendingPayment.cardId, candidateIds: [], selectedIds: [],
      warning: `不足 ${pendingPayment.shortfall}マナ`,
      canForce: true,
    };
    if (pendingLandTapChoice) return {
      kind: 'payment', title: '土地の着地状態', instruction: 'タップ状態で出すか選んでください。',
      sourceId: pendingLandTapChoice.cardId, candidateIds: [], selectedIds: [],
    };
    return null;
  })();

  function chooseDecisionCard(cardId: string): void {
    if (!decisionFocus?.candidateIds.includes(cardId)) return;
    if (guidedPrompt?.kind === 'target') store.confirmGuidedTarget(cardId);
    else if (guidedPrompt?.kind === 'discard') store.confirmGuidedDiscard(cardId);
    else if (guidedPrompt?.kind === 'sacrifice') store.confirmGuidedSacrifice(cardId);
    else if (guidedPrompt?.kind === 'cost-discard' || guidedPrompt?.kind === 'cost-sacrifice') store.confirmGuidedCostSubject(cardId);
    else if (pendingRuleTarget) pickRuleActionTarget(cardId);
    else if (pendingBloodCrackCardId) {
      store.crackBlood(pendingBloodCrackCardId, cardId);
      setPendingBloodCrackCardId(null);
    }
  }

  function chooseDecisionPlayer(playerId: PlayerId): void {
    if (!decisionFocus?.playerIds?.includes(playerId)) return;
    store.confirmGuidedPlayerTarget(playerId);
  }

  function cancelDecision(): void {
    if (store.pendingGuided) store.cancelGuidedPrompt();
    else if (pendingRuleTarget) setPendingRuleTarget(null);
    else if (pendingBloodCrackCardId) setPendingBloodCrackCardId(null);
    else if (manaChoice) setManaChoice(null);
    else if (pendingXCast) setPendingXCast(null);
    else if (pendingPayment) setPendingPayment(null);
    else if (pendingLandTapChoice) setPendingLandTapChoice(null);
  }

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
                card={state.cards[menu.cardId] ? {
                  instance: state.cards[menu.cardId],
                  def: state.defs[state.cards[menu.cardId].defId],
                } : undefined}
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
        <MulliganStage
          state={state}
          mode="decision"
          onKeep={() => {
            const count = useGameStore.getState().state?.mulliganCount ?? 0;
            store.keepOpeningHand();
            const bottom = freeMulliganBottomCount(count);
            if (bottom > 0) setMulliganBottomCount(bottom);
            else beginFirstTurn();
          }}
          onMulligan={() => store.mulligan()}
        />
      )}

      {mulliganBottomCount !== null && (
        <MulliganStage
          state={state}
          mode="bottom"
          bottomCount={mulliganBottomCount}
          onBottomConfirm={(chosen) => {
            store.putBottomForMulligan(chosen);
            setMulliganBottomCount(null);
            beginFirstTurn();
          }}
          onUndoBoundary={() => {
            setMulliganBottomCount(null);
            useGameStore.setState({ mulliganDecisionPending: true });
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
          cardName={cardNameFor(pendingXCast.cardId, pendingXCast.faceIndex)}
          manaCost={manaCostFor(pendingXCast.cardId, pendingXCast.faceIndex)}
          onConfirm={(xValue) => {
            requestCastToStack(pendingXCast.cardId, xValue, pendingXCast.faceIndex);
            setPendingXCast(null);
          }}
          onCancel={() => setPendingXCast(null)}
        />
      )}

      {pendingFaceCastCardId && state?.cards[pendingFaceCastCardId] && (() => {
        const card = state.cards[pendingFaceCastCardId];
        const def = state.defs[card.defId];
        return def ? (
          <CastFaceDialog
            def={def}
            initialFaceIndex={card.faceIndex}
            onChoose={(faceIndex) => {
              const cardId = pendingFaceCastCardId;
              setPendingFaceCastCardId(null);
              requestCastToStack(cardId, undefined, faceIndex);
            }}
            onCancel={() => setPendingFaceCastCardId(null)}
          />
        ) : null;
      })()}

      {pendingPayment && (
        <ShortfallDialog
          shortfall={pendingPayment.shortfall}
          onForce={() => {
            if (pendingPayment.kind === 'stack') store.castToStack(pendingPayment.cardId, {
              force: true,
              xValue: pendingPayment.xValue,
              faceIndex: pendingPayment.faceIndex,
            });
            else store.cycle(pendingPayment.cardId, { force: true });
            setPendingPayment(null);
          }}
          onCancel={() => setPendingPayment(null)}
        />
      )}

      {store.pendingForceActivation && (
        <ForceActivationDialog
          warnings={store.pendingForceActivation.warnings}
          onForce={() => store.confirmForceActivation()}
          onCancel={() => store.cancelForceActivation()}
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

      {guidedPrompt?.kind === 'library-search' && (
        <GuidedLibrarySearchDialog
          state={state}
          playerId={guidedPlayerId}
          sourceId={store.pendingGuided?.sourceId ?? ''}
          prompt={guidedPrompt}
          onConfirm={(id) => store.confirmGuidedLibrarySearch(id)}
          onMiss={() => store.confirmGuidedLibrarySearch()}
          onClose={() => store.cancelGuidedPrompt()}
        />
      )}
      {guidedPrompt?.kind === 'scry-surveil' && (
        <ArrangeTopDialog
          key={`guided-arrange-${guidedPrompt.raw}`}
          state={state}
          playerId={guidedPlayerId}
          initialCount={guidedPrompt.count}
          initialMode={guidedPrompt.atom === 'effect.surveil' ? 'surveil' : 'scry'}
          lockCount
          lockMode
          onConfirm={(topOrder, toBottom, toGraveyard) => store.confirmGuidedScrySurveil(topOrder, toBottom, toGraveyard)}
          onCancel={() => store.cancelGuidedPrompt()}
          onUndoBoundary={() => store.undo()}
        />
      )}
      {guidedPrompt?.kind === 'modal' && (
        <ModalChoiceDialog
          prompt={guidedPrompt}
          onConfirm={(chosen) => store.confirmGuidedModal(chosen)}
          onCancel={() => store.cancelGuidedPrompt()}
          onUndoBoundary={() => store.undo()}
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
          onConfirm={(attackerIds, targetLabel, blockers) => {
            store.declareAttack(attackerIds, targetLabel, blockers);
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
          onUndoBoundary={() => setArrangeTopOpen(false)}
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
    openCardMenuAt,
    handleCardDoubleClick,
    requestResolveTop,
    requestResolveAll,
    advancePhase,
    advanceTurn,
    undo,
    redo,
    canUndo: store.canUndoInteraction || store.canUndo || shortcutsBlocked,
    canRedo: store.canRedoInteraction || store.canRedo || isDialogOpen,
    setManualTargets: (stackItemId, targetIds, targetPlayerIds) => store.setManualTargets(stackItemId, targetIds, targetPlayerIds),
    openLibraryActions,
    libraryActionsOpen: libraryMenu !== null,
    openZoneViewer: (zone) => setZoneViewer(zone),
    opponentBoardOpen,
    openOpponentBoard: () => setOpponentBoardOpen(true),
    closeOpponentBoard: () => setOpponentBoardOpen(false),
    openTokenDialog: () => setTokenDialogOpen(true),
    openAttackDialog: () => setAttackDialogOpen(true),
    openArrangeTop: () => setArrangeTopOpen(true),
    openCountDialog: (kind, defaultValue) => setCountDialog({ kind, defaultValue }),
    requestConfirm: (action) => setConfirmAction(action),
    triggerCandidateCount: store.triggerCandidates.length,
    triggerSheetOpen,
    processTriggers,
    closeTriggerSheet: () => setTriggerSheetOpen(false),
    motionArmed,
    feedOpen,
    openFeed: () => setFeedOpen(true),
    closeFeed: () => setFeedOpen(false),
    overlays,
    shortcutsBlocked,
    transitionCue,
    dismissTransitionCue,
    commanderCutIn,
    resolutionLocked,
    decisionFocus,
    chooseDecisionCard,
    chooseDecisionPlayer,
    cancelDecision,
    mulliganActive: mulliganDecisionPending || mulliganBottomCount !== null,
    performDrop,
    closeTransientUi: closeMenu,
  };
}
