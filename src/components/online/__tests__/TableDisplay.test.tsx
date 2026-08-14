import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import fixture from '../../../online/tableDisplay/fixtures/o4p-04b-table-display-v1.json';
import { TableDisplay } from '../TableDisplay';

describe('TableDisplay', () => {
  it('renders a read-only four-player Table overview', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => root.render(<TableDisplay projection={fixture} />));

    expect(container.querySelectorAll('[data-testid="table-display-player-summary"]')).toHaveLength(4);
    expect(container.querySelector('[data-testid="table-display-zone-battlefield"]')?.textContent)
      .toContain('《炎樹族の使者》');
    expect(container.querySelector('[data-testid="table-display-priority-status"]')?.textContent)
      .toContain('優先権保持者は投影されていません');
    expect(container.querySelector('button, form, input, select, textarea')).toBeNull();
    act(() => root.unmount());
  });

  it('renders one generic unavailable state for invalid input', () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    act(() => root.render(<TableDisplay projection={{}} />));

    expect(container.querySelector('[data-testid="table-display-unavailable"]')?.textContent)
      .toBe('表示できません');
    act(() => root.unmount());
  });
});
