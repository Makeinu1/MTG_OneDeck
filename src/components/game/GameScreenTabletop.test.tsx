import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TabletopSurface } from './GameScreen';

describe('GameScreen tabletop surface', () => {
  it('is decorative and excluded from interaction and accessibility', () => {
    const markup = renderToStaticMarkup(<TabletopSurface />);

    expect(markup).toContain('data-testid="tabletop-surface"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).not.toContain('tabindex');
  });
});
