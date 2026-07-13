/**
 * HandRibbon — 横スクロールの手札。docs/ui-architecture-v2.md §2。
 * 左端にライブラリー・墓地・追放を空間的にまとめたZone Clusterを置く。
 * プレイ可能ハイライト(金縁発光)は D3(マナ計算 selector)で付与。
 */

import {
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react';
import { GameCard } from './GameCard';
import { playableHandCardIds } from './affordability';
import { celebrate } from './sound';
import { shouldCompress } from './motion';
import type { GameController } from './gameController';
import { handFanCardLayout } from './handFanLayout';

export interface HandRibbonProps {
  controller: GameController;
  workspaceOpen?: boolean;
  openWorkspaceButtonRef?: RefObject<HTMLButtonElement | null>;
  onOpenWorkspace?: () => void;
  onCloseWorkspace?: () => void;
}

export function HandRibbon({
  controller,
  workspaceOpen = false,
  openWorkspaceButtonRef,
  onOpenWorkspace,
  onCloseWorkspace = () => {},
}: HandRibbonProps) {
  const { state, store } = controller;
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  // マナ計算は毎レンダ全走査を避けるため memo 化(ui-architecture-v2 §6)。
  const playable = useMemo(
    () => (state ? playableHandCardIds(state) : new Set<string>()),
    [state],
  );
  const lastDrawRef = useRef<number | null>(null);
  const flatControl = useMemo(
    () => new URLSearchParams(window.location.search).get('hand') === 'flat',
    [],
  );
  useLayoutEffect(() => {
    if (workspaceOpen) closeButtonRef.current?.focus();
  }, [workspaceOpen]);

  if (!state) return null;
  const largeHandCollapsed = state.zones.hand.length > 15 && !workspaceOpen && !flatControl;
  const handLayout = flatControl
    ? 'flat'
    : workspaceOpen
      ? 'workspace'
      : largeHandCollapsed
        ? 'large'
        : 'fan';

  function handleWorkspaceKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onCloseWorkspace();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]'),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function drawOne(): void {
    const now = Date.now();
    // 連続ドロー(圧縮)はハプティクスを畳んで疲れさせない・空ライブラリでは鳴らさない(§7・Tier-1 #3/#5)。
    const compressed = shouldCompress(lastDrawRef.current, now);
    lastDrawRef.current = now;
    if (state!.zones.library.length > 0 && !compressed) celebrate('draw');
    store.draw(1);
  }

  return (
    <div
      className="hand-ribbon"
      data-testid="hand-ribbon"
      data-layout={handLayout}
      id="hand-workspace"
      role={handLayout === 'workspace' ? 'dialog' : undefined}
      aria-modal={handLayout === 'workspace' ? true : undefined}
      aria-labelledby={handLayout === 'workspace' ? 'hand-workspace-title' : undefined}
      onKeyDown={handLayout === 'workspace' ? handleWorkspaceKeyDown : undefined}
    >
      {handLayout === 'workspace' && (
        <div className="hand-ribbon__workspace-heading" data-testid="hand-workspace-heading">
          <div>
            <strong id="hand-workspace-title">手札 Workspace</strong>
            <span>{state.zones.hand.length}枚 — カード全体を保ったまま一覧</span>
          </div>
          <button
            type="button"
            className="hand-ribbon__close-workspace"
            data-testid="close-hand-workspace"
            aria-controls="hand-workspace"
            ref={closeButtonRef}
            onClick={onCloseWorkspace}
          >
            盤面を見る
          </button>
        </div>
      )}
      <div className="hand-ribbon__zones" data-testid="zone-cluster" role="group" aria-label="カード領域">
        <div
          className="hand-ribbon__library-control"
          role="group"
          aria-label="ライブラリー"
          onContextMenu={(e) => {
            e.preventDefault();
            controller.openLibraryActions(e);
          }}
        >
          <button
            type="button"
            className="hand-ribbon__zone hand-ribbon__zone--library"
            data-testid="library-tile"
            onClick={(e) => controller.openLibraryActions(e)}
            title="ライブラリー操作を開く"
            aria-haspopup="menu"
            aria-expanded={controller.libraryActionsOpen}
            aria-label={`ライブラリー${state.zones.library.length}枚。操作メニューを開く`}
          >
            <span>ライブラリー</span>
            <strong data-testid="library-count">{state.zones.library.length}</strong>
            <small>操作…</small>
          </button>
          <button
            type="button"
            className="hand-ribbon__draw-one"
            data-testid="library-draw-one"
            data-empty={state.zones.library.length === 0}
            aria-label={state.zones.library.length === 0
              ? '1枚引く。ライブラリーが空のため敗北判定が発生します'
              : 'ライブラリーから1枚引く'}
            title={state.zones.library.length === 0
              ? '空のライブラリーから引く（敗北判定）'
              : 'ライブラリーから1枚引く'}
            onClick={drawOne}
          >
            1枚引く
          </button>
        </div>
        <button
          type="button"
          className="hand-ribbon__zone hand-ribbon__zone--graveyard"
          data-testid="graveyard-tile"
          onClick={() => controller.openZoneViewer('graveyard')}
        >
          <span>墓地</span>
          <strong>{state.zones.graveyard.length}</strong>
        </button>
        <button
          type="button"
          className="hand-ribbon__zone hand-ribbon__zone--exile"
          data-testid="exile-tile"
          onClick={() => controller.openZoneViewer('exile')}
        >
          <span>追放</span>
          <strong>{state.zones.exile.length}</strong>
        </button>
      </div>

      {handLayout === 'large' ? (
        <div className="hand-ribbon__large-summary" data-testid="large-hand-summary">
          <div className="hand-ribbon__large-stack" aria-hidden="true">
            <span /><span /><span /><span /><span />
          </div>
          <button
            type="button"
            className="hand-ribbon__open-workspace"
            data-testid="large-hand-open"
            ref={openWorkspaceButtonRef}
            onClick={onOpenWorkspace}
            disabled={!onOpenWorkspace}
          >
            <span>手札</span>
            <strong>{state.zones.hand.length}枚</strong>
            <small>一覧で広げる</small>
          </button>
        </div>
      ) : (
        <div className="hand-ribbon__cards" data-testid="hand-cards">
          {state.zones.hand.map((cardId, index) => {
            const fan = handFanCardLayout(index, state.zones.hand.length);
            const style = handLayout === 'fan' ? {
              '--fan-rotation': `${fan.rotationDeg}deg`,
              '--fan-y': `${fan.translateY}px`,
              '--fan-margin': `${fan.marginLeft}px`,
              '--fan-z': fan.zIndex,
            } as CSSProperties : undefined;
            return (
              <div className="hand-ribbon__slot" style={style} key={cardId}>
                <GameCard controller={controller} cardId={cardId} size="hand" playable={playable.has(cardId)} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
