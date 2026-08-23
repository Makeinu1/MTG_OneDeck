import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { OnlineLobbyPrototype } from './main';

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function renderFixture(): HTMLDivElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(<OnlineLobbyPrototype />));
  return container;
}

function selectState(view: HTMLElement, value: string): void {
  const select = view.querySelector('select');
  if (!(select instanceof HTMLSelectElement)) throw new Error('state select missing');
  act(() => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('O4P-08B disconnected online lobby prototype', () => {
  it('switches through deterministic states', () => {
    const view = renderFixture();
    expect(view.textContent).toContain('遊ぶデッキを選ぶ');
    const deckButtons = [...view.querySelectorAll('button')].map((button) => button.textContent);
    expect(deckButtons.slice(0, 2)).toEqual(['一人回し', 'オンライン対戦']);
    selectState(view, 'entry'); expect(view.textContent).toContain('対戦の入口');
    selectState(view, 'host'); expect(view.textContent).toContain('対戦ロビー'); expect(view.textContent).toContain('あなた（ホスト）');
  });
  it('offers exactly one shared invitation code input in join state', () => {
    const view = renderFixture(); selectState(view, 'entry');
    const join = [...view.querySelectorAll('button')].find((button) => button.textContent?.includes('招待で参加'));
    if (!(join instanceof HTMLButtonElement)) throw new Error('join action missing');
    act(() => join.click());
    expect(view.querySelectorAll('input')).toHaveLength(1); expect(view.querySelector('input')?.getAttribute('aria-label')).toBe('招待コード');
    expect(view.textContent).not.toMatch(/Room ID|ルームID/i);
  });
  it('exposes current step, exact blockers, and host controls', () => {
    const view = renderFixture(); selectState(view, 'host');
    expect(view.querySelector('[aria-current="step"]')?.textContent).toContain('対戦開始');
    expect(view.textContent).toContain('あなた（ホスト）'); expect(view.textContent).toContain('受理済み');
    expect(view.textContent).toContain('デッキを再提出'); expect(view.textContent).toContain('準備完了を取り消す');
    expect(view.textContent).toContain('空席 1 · プレイヤー2: デッキ未提出 · プレイヤー2: 未準備'); expect(view.textContent).toContain('招待を再発行');
  });
  it('keeps guest at deck submission with no host utilities', () => {
    const view = renderFixture(); selectState(view, 'guest');
    expect(view.querySelector('[aria-current="step"]')?.textContent).toContain('デッキ提出');
    expect(view.textContent).toContain('ホスト'); expect(view.textContent).toContain('あなた'); expect(view.textContent).toContain('未提出');
    expect(view.querySelectorAll('article')[2]?.textContent).toContain('プレイヤー3入室済み提出済み準備完了');
    expect(view.textContent).toContain('デッキを提出'); expect(view.textContent).not.toContain('招待を再発行');
  });
  it('keeps guest moderation boundary and private identifiers out of default text', () => {
    const view = renderFixture(); selectState(view, 'guest');
    expect(view.textContent).not.toContain('招待を再発行'); expect(view.textContent).not.toContain('ロビーから外す');
    expect(view.textContent).not.toMatch(/participant|room|capability|ABCD-EFGH|P[0-9]/i);
  });
  it('provides semantic actionable error state', () => {
    const view = renderFixture(); selectState(view, 'error');
    expect(view.querySelector('[role="alert"]')?.textContent).toContain('タイムアウト'); expect(view.textContent).toContain('もう一度接続');
  });
});
