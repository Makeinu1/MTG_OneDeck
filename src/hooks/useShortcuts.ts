import { useEffect } from 'react';

export interface ShortcutHandlers {
  /** ArrowUp: advance to the next phase. Disabled while a dialog is open. */
  onNextPhase: () => void;
  /** Enter: advance to the next turn. Disabled while a dialog is open. */
  onNextTurn: () => void;
  /** Cmd/Ctrl+Z: undo the last action. */
  onUndo: () => void;
  /** Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y: redo the last undone action. */
  onRedo: () => void;
  /** Space: open the restart confirmation. Disabled while a dialog is open. */
  onRestart: () => void;
  /** D: draw one card. */
  onDraw: () => void;
  /** Whether a modal/dialog is currently open (disables Enter/Arrow/Space shortcuts). */
  isDialogOpen: boolean;
}

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

/**
 * Global keyboard shortcuts for the playmat:
 * - Enter: next turn / ArrowUp: next phase / ArrowRight: redo / ArrowLeft: undo
 * - Space: open restart confirmation (disabled while a dialog is open)
 * - Cmd/Ctrl+Z: undo / Cmd/Ctrl+Shift+Z, Cmd/Ctrl+Y: redo
 * - D: draw one card
 *
 * All shortcuts are disabled while focus is on an input/textarea/contentEditable
 * element so that typing is never interrupted.
 */
export function useShortcuts(handlers: ShortcutHandlers): void {
  const { onNextPhase, onNextTurn, onUndo, onRedo, onRestart, onDraw, isDialogOpen } = handlers;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (isTextInputTarget(e.target) || e.repeat) return;

      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          onRedo();
        } else {
          onUndo();
        }
        return;
      }

      if (isMod && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        onRedo();
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      if (
        isDialogOpen &&
        (e.key === 'Enter' ||
          e.key === 'ArrowUp' ||
          e.key === 'ArrowRight' ||
          e.key === 'ArrowLeft' ||
          e.code === 'Space')
      ) {
        e.preventDefault();
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        onNextTurn();
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        onNextPhase();
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        onRedo();
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onUndo();
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        onRestart();
        return;
      }

      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        onDraw();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onNextPhase, onNextTurn, onUndo, onRedo, onRestart, onDraw, isDialogOpen]);
}
