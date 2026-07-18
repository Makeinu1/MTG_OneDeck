import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FanContentNotice } from './App';

describe('fan content notice', () => {
  it('identifies the app as unofficial and preserves the Wizards attribution', () => {
    const markup = renderToStaticMarkup(<FanContentNotice />);

    expect(markup).toContain('data-testid="fan-content-notice"');
    expect(markup).toContain('非公式のファンコンテンツ');
    expect(markup).toContain('認可・許諾を受けたものではありません');
    expect(markup).toContain('© Wizards of the Coast LLC.');
  });
});
