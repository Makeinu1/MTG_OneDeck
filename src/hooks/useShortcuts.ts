import { useEffect } from 'react';
import {
  normalizePressedKey,
  type KeybindingsMap,
} from '../data/keybindings';

export interface ShortcutHandlers {
  /** Advance to the next phase. Disabled while a dialog is open. */
  onNextPhase: () => void;
  /** Advance to the next turn. Disabled while a dialog is open. */
  onNextTurn: () => void;
  /** Cmd/Ctrl+Z: undo the last action. */
  onUndo: () => void;
  /** Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y: redo the last undone action. */
  onRedo: () => void;
  /** Open the restart confirmation. Disabled while a dialog is open. */
  onRestart: () => void;
  /** Draw one card. */
  onDraw: () => void;
  /** Whether a modal/dialog is currently open (disables phase/turn/restart; undo/redo stay active). */
  isDialogOpen: boolean;
  /** User-configurable single-key bindings. */
  keybindings: KeybindingsMap;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.closest('button, a[href], [role="button"], [role="menuitem"]') !== null;
}

/**
 * Global keyboard shortcuts for the playmat:
 * - Single-key actions follow the current keybinding map.
 * - Cmd/Ctrl+Z: undo / Cmd/Ctrl+Shift+Z, Cmd/Ctrl+Y: redo
 *
 * All shortcuts are disabled while focus is on an input/textarea/contentEditable
 * element so that typing is never interrupted.
 */
export function useShortcuts(handlers: ShortcutHandlers): void {
  const {
    onNextPhase,
    onNextTurn,
    onUndo,
    onRedo,
    onRestart,
    onDraw,
    isDialogOpen,
    keybindings,
  } = handlers;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (isEditableTarget(e.target) || e.repeat) return;

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

      // Enter/Space and remapped single-key shortcuts remain owned by the
      // focused control. Modifier-based history shortcuts above are global.
      if (isInteractiveTarget(e.target)) return;

      const pressedKey = normalizePressedKey(e.key, e.code);
      if (!pressedKey) return;

      if (
        isDialogOpen &&
        (pressedKey === keybindings.nextTurn ||
          pressedKey === keybindings.nextPhase ||
          pressedKey === keybindings.restart)
      ) {
        e.preventDefault();
        return;
      }

      if (pressedKey === keybindings.nextTurn) {
        e.preventDefault();
        onNextTurn();
        return;
      }

      if (pressedKey === keybindings.nextPhase) {
        e.preventDefault();
        onNextPhase();
        return;
      }

      if (pressedKey === keybindings.redo) {
        e.preventDefault();
        onRedo();
        return;
      }

      if (pressedKey === keybindings.undo) {
        e.preventDefault();
        onUndo();
        return;
      }

      if (pressedKey === keybindings.restart) {
        e.preventDefault();
        onRestart();
        return;
      }

      if (pressedKey === keybindings.draw) {
        e.preventDefault();
        onDraw();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onNextPhase, onNextTurn, onUndo, onRedo, onRestart, onDraw, isDialogOpen, keybindings]);
}
