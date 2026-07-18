export const TABLETOP_PROTOTYPE_MODES = ['baseline', 'prototype'] as const;

export type TabletopPrototypeMode = (typeof TABLETOP_PROTOTYPE_MODES)[number];

export function resolveTabletopPrototypeMode(value: string | null): TabletopPrototypeMode {
  return value === 'baseline' ? 'baseline' : 'prototype';
}

export function applyTabletopPrototypeMode(
  root: HTMLElement,
  mode: TabletopPrototypeMode,
): void {
  root.dataset.tabletopPrototype = mode;
}
