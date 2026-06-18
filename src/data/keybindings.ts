export const KEYBINDING_ACTIONS = [
  'nextPhase',
  'nextTurn',
  'draw',
  'restart',
  'undo',
  'redo',
] as const;

export type KeybindingAction = (typeof KEYBINDING_ACTIONS)[number];
export type KeybindingsMap = Record<KeybindingAction, string>;

const STORAGE_KEY = 'mtg-onedeck-keybindings';
const MODIFIER_KEYS = new Set(['Alt', 'Control', 'Meta', 'Shift']);

export const DEFAULT_KEYBINDINGS: KeybindingsMap = {
  nextPhase: 'ArrowUp',
  nextTurn: 'Enter',
  draw: 'd',
  restart: 'Space',
  undo: 'ArrowLeft',
  redo: 'ArrowRight',
};

function bitCount(value: number): number {
  let count = 0;
  let remaining = value;
  while (remaining > 0) {
    count += remaining & 1;
    remaining >>= 1;
  }
  return count;
}

function tieBreak(
  candidateMask: number,
  bestMask: number,
  candidateActions: KeybindingAction[]
): boolean {
  for (const action of KEYBINDING_ACTIONS) {
    const index = candidateActions.indexOf(action);
    const candidateSelected = index >= 0 && (candidateMask & (1 << index)) !== 0;
    const bestSelected = index >= 0 && (bestMask & (1 << index)) !== 0;
    if (candidateSelected !== bestSelected) {
      return candidateSelected;
    }
  }
  return false;
}

function hasUniqueValues(map: KeybindingsMap): boolean {
  return new Set(KEYBINDING_ACTIONS.map((action) => map[action])).size === KEYBINDING_ACTIONS.length;
}

function normalizeBindingValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (value === ' ') return 'Space';

  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (trimmed === 'Esc') return 'Escape';
  if (trimmed === 'Spacebar' || trimmed.toLowerCase() === 'space') return 'Space';
  if (MODIFIER_KEYS.has(trimmed)) return null;
  if (trimmed.length === 1) return trimmed.toLowerCase();
  return trimmed;
}

export function normalizePressedKey(key: string, code: string): string | null {
  if (code === 'Space') return 'Space';
  return normalizeBindingValue(key);
}

export function conflictsWith(
  map: KeybindingsMap,
  action: KeybindingAction,
  key: string
): boolean {
  return KEYBINDING_ACTIONS.some((otherAction) => otherAction !== action && map[otherAction] === key);
}

export function normalizeKeybindings(
  partial?: Partial<Record<KeybindingAction, unknown>> | null
): KeybindingsMap {
  const customBindings: Partial<KeybindingsMap> = {};

  for (const action of KEYBINDING_ACTIONS) {
    const normalized = normalizeBindingValue(partial?.[action]);
    if (normalized && normalized !== DEFAULT_KEYBINDINGS[action]) {
      customBindings[action] = normalized;
    }
  }

  const candidateActions = KEYBINDING_ACTIONS.filter((action) => customBindings[action] !== undefined);
  let bestMap: KeybindingsMap = { ...DEFAULT_KEYBINDINGS };
  let bestMask = 0;
  let bestScore = 0;

  for (let mask = 0; mask < 1 << candidateActions.length; mask += 1) {
    const nextMap: KeybindingsMap = { ...DEFAULT_KEYBINDINGS };
    for (let index = 0; index < candidateActions.length; index += 1) {
      if ((mask & (1 << index)) === 0) continue;
      const action = candidateActions[index];
      nextMap[action] = customBindings[action] as string;
    }

    if (!hasUniqueValues(nextMap)) continue;

    const score = bitCount(mask);
    if (score > bestScore || (score === bestScore && tieBreak(mask, bestMask, candidateActions))) {
      bestMap = nextMap;
      bestMask = mask;
      bestScore = score;
    }
  }

  return bestMap;
}

export function loadKeybindings(): KeybindingsMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_KEYBINDINGS };

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...DEFAULT_KEYBINDINGS };
    }

    return normalizeKeybindings(parsed);
  } catch {
    return { ...DEFAULT_KEYBINDINGS };
  }
}

export function saveKeybindings(map: KeybindingsMap): void {
  const normalized = normalizeKeybindings(map);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // localStorage unavailable or quota exceeded - keep the in-memory mapping.
  }
}
