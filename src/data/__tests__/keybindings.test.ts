import { beforeEach, describe, expect, it } from 'vitest';
import {
  conflictsWith,
  DEFAULT_KEYBINDINGS,
  loadKeybindings,
  normalizeKeybindings,
  saveKeybindings,
} from '../keybindings';

describe('keybindings persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('normalizes missing entries, ignores unknown keys, and resolves conflicts', () => {
    const normalized = normalizeKeybindings({
      nextPhase: 'Enter',
      draw: 'x',
      restart: 'space',
      unknown: 'q',
    } as unknown as Record<string, unknown>);

    expect(normalized).toEqual({
      ...DEFAULT_KEYBINDINGS,
      draw: 'x',
      restart: 'Space',
    });
    expect(conflictsWith(normalized, 'draw', 'ArrowUp')).toBe(true);
    expect(conflictsWith(normalized, 'draw', 'x')).toBe(false);
  });

  it('round-trips through localStorage', () => {
    const custom = normalizeKeybindings({
      nextPhase: 'w',
      nextTurn: 'e',
      draw: 'q',
      restart: 'r',
      undo: 'a',
      redo: 's',
    });

    saveKeybindings(custom);

    expect(loadKeybindings()).toEqual(custom);
  });
});
