import { describe, expect, it } from 'vitest';
import {
  applyTabletopPrototypeMode,
  resolveTabletopPrototypeMode,
} from './tabletopPrototype';

describe('tabletop visual prototype gate', () => {
  it('shows the approved production tabletop unless baseline is explicit', () => {
    expect(resolveTabletopPrototypeMode(null)).toBe('prototype');
    expect(resolveTabletopPrototypeMode('baseline')).toBe('baseline');
    expect(resolveTabletopPrototypeMode('unexpected')).toBe('prototype');
  });

  it('enables the isolated prototype only for the prototype query value', () => {
    const root = document.createElement('html');
    const mode = resolveTabletopPrototypeMode('prototype');

    applyTabletopPrototypeMode(root, mode);

    expect(mode).toBe('prototype');
    expect(root.dataset.tabletopPrototype).toBe('prototype');
  });
});
