import { useEffect } from 'react';

export interface ShortcutHandlers {
  /** Space: advance to the next phase. Disabled while a dialog is open. */
  onNextPhase: () => void;
  /** Shift+Space: advance to the next turn. Disabled while a dialog is open. */
  onNextTurn: () => void;
  /** Cmd/Ctrl+Z: undo the last action. */
  onUndo: () => void;
  /** Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y: redo the last undone action. */
  onRedo: () => void;
  /** D: draw one card. */
  onDraw: () => void;
  /** Whether a modal/dialog is currently open (disables the Space shortcuts). */
  isDialogOpen: boolean;
}

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
}

/**
 * Global keyboard shortcuts for the playmat:
 * - Space: next phase / Shift+Space: next turn (disabled while a dialog is open)
 * - Cmd/Ctrl+Z: undo / Cmd/Ctrl+Shift+Z, Cmd/Ctrl+Y: redo
 * - D: draw one card
 *
 * All shortcuts are disabled while focus is on an input/textarea/contentEditable
 * element so that typing is never interrupted.
 */
export function useShortcuts(handlers: ShortcutHandlers): void {
  const { onNextPhase, onNextTurn, onUndo, onRedo, onDraw, isDialogOpen } = handlers;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (isTextInputTarget(e.target)) return;

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

      if (e.code === 'Space') {
        if (isDialogOpen) return;
        e.preventDefault();
        if (e.shiftKey) {
          onNextTurn();
        } else {
          onNextPhase();
        }
        return;
      }

      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        onDraw();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onNextPhase, onNextTurn, onUndo, onRedo, onDraw, isDialogOpen]);
}
