/**
 * GameScreen — 新レイアウトの唯一のルート(縦/横/デスクトップを CSS grid-template-areas で適応)。
 * docs/ui-architecture-v2.md §2・docs/design-playbook.md §3 D2。
 *
 * 規律: JSX での isPhone 分岐をしない(単一 adaptive tree)。3形態の出し分けは game.css の
 * grid-template-areas / media query のみで行う。ガイド解決ダイアログ等は controller.overlays。
 */

import { lazy, Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useGameController } from './gameController';
import { StatusBand } from './StatusBand';
import { StackBand } from './StackBand';
import { Board } from './Board';
import { LandRow } from './LandRow';
import { HandRibbon } from './HandRibbon';
import { ThumbZone } from './ThumbZone';
import { Feed } from './Feed';
import { CommanderAltar } from './CommanderAltar';
import { TransitionCue } from './TransitionCue';
import type { KeybindingsMap } from '../../data/keybindings';
import './game.css';

const ResearchRecorder = import.meta.env.DEV
  ? lazy(async () => {
      const module = await import('../../dev/uxResearch/ResearchRecorder');
      return { default: module.ResearchRecorder };
    })
  : null;

function uxResearchModeEnabled(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('ux-research') === '1';
}

export interface GameScreenProps {
  keybindings: KeybindingsMap;
}

export function GameScreen({ keybindings }: GameScreenProps) {
  const initialHandLayout = useMemo(
    () => new URLSearchParams(window.location.search).get('hand'),
    [],
  );
  const handWorkspaceAvailable = initialHandLayout !== 'flat';
  const [handWorkspaceOpen, setHandWorkspaceOpen] = useState(initialHandLayout === 'workspace');
  const controller = useGameController({
    keybindings,
    externalShortcutsBlocked: handWorkspaceOpen,
  });
  const localHandWorkspaceButtonRef = useRef<HTMLButtonElement | null>(null);
  const restoreHandFocusRef = useRef(false);

  useLayoutEffect(() => {
    if (!handWorkspaceOpen && restoreHandFocusRef.current) {
      restoreHandFocusRef.current = false;
      localHandWorkspaceButtonRef.current?.focus();
    }
  }, [handWorkspaceOpen]);

  function closeHandWorkspace(): void {
    setHandWorkspaceOpen(false);
  }

  function openHandWorkspace(): void {
    restoreHandFocusRef.current = true;
    setHandWorkspaceOpen(true);
  }

  if (!controller.state) return null;

  return (
    <div
      className="game-screen"
      data-testid="game-screen"
      data-hand-workspace-open={handWorkspaceOpen || undefined}
    >
      <div className="game-screen__status">
        <StatusBand controller={controller} />
      </div>
      <div className="game-screen__stack">
        <StackBand controller={controller} />
      </div>
      <div className="game-screen__board">
        <Board controller={controller} />
      </div>
      <TransitionCue cue={controller.transitionCue} onDone={controller.dismissTransitionCue} />
      <div className="game-screen__lands">
        <CommanderAltar controller={controller} />
        <LandRow controller={controller} />
      </div>
      <div className="game-screen__hand">
        <HandRibbon
          controller={controller}
          workspaceOpen={handWorkspaceOpen}
          openWorkspaceButtonRef={localHandWorkspaceButtonRef}
          onOpenWorkspace={handWorkspaceAvailable
            ? openHandWorkspace
            : undefined}
          onCloseWorkspace={closeHandWorkspace}
        />
      </div>
      <div className="game-screen__thumb">
        <ThumbZone controller={controller} />
      </div>

      {controller.feedOpen && <Feed controller={controller} onClose={controller.closeFeed} />}
      {controller.overlays}
      {ResearchRecorder && uxResearchModeEnabled() && (
        <Suspense fallback={null}>
          <ResearchRecorder controller={controller} />
        </Suspense>
      )}
    </div>
  );
}
