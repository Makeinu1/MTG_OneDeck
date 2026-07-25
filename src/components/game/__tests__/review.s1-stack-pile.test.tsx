/**
 * review.s1-stack-pile — S1 スタックパイル化の契約(判定者専有)。
 * 契約: 本プラン S1。スタックは盤面右中央のカードパイル。scrimなし・盤面常時操作可能。
 * 「次に解決」「N番目」「上から順に解決」「閉じる」「対応を追加」「上から解決」「全解決」の
 * 常設テキストは廃止。手動操作は⋯メニューへ格納。
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { DndContext } from '@dnd-kit/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildVisualFixture } from '../../../dev/visualFixtures/fixtureBuilder';
import { useGameStore } from '../../../store/gameStore';
import { StackBand } from '../StackBand';
import type { GameController } from '../gameController';

afterEach(() => {
  document.body.replaceChildren();
  useGameStore.setState({ state: null });
});

function mountPile(controller: GameController) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<DndContext><StackBand controller={controller} /></DndContext>));
  return { container, root };
}

function controllerFor(state: ReturnType<typeof buildVisualFixture>['snapshot']['state']) {
  useGameStore.setState({ state, warnings: [], triggerCandidates: [] });
  return {
    state,
    store: useGameStore.getState(),
    decisionFocus: null,
    requestResolveTop: vi.fn(),
    requestResolveAll: vi.fn(),
    setManualTargets: vi.fn(),
  } as unknown as GameController;
}

describe('S1 stack pile contract', () => {
  it('renders a pile with no scrim, no respond button, no inline resolve buttons', () => {
    const state = buildVisualFixture('stack').snapshot.state;
    const { container, root } = mountPile(controllerFor(state));

    // scrim 廃止(盤面常時操作可能)
    expect(container.querySelector('[data-testid="stack-workspace-scrim"]')).toBeNull();
    expect(container.querySelector('.stack-workspace__backdrop')).toBeNull();
    // 「対応を追加」廃止
    expect(container.querySelector('[data-testid="stack-band-respond"]')).toBeNull();
    // インライン解決ボタン廃止(PrimaryAction が担う)
    expect(container.querySelector('[data-testid="stack-band-resolve-top"]')).toBeNull();
    expect(container.querySelector('[data-testid="stack-band-resolve-all"]')).toBeNull();

    // パイル本体は存在
    expect(container.querySelector('[data-testid="stack-band"]')).not.toBeNull();
    // スタック項目は描画されている(カードまたはアイテム)
    const items = container.querySelectorAll('[data-testid^="stack-workspace-item-"], [data-stack-item-id]');
    expect(items.length).toBeGreaterThan(0);

    act(() => root.unmount());
  });

  it('does not render permanent explanatory text', () => {
    const state = buildVisualFixture('stack').snapshot.state;
    const { container, root } = mountPile(controllerFor(state));
    const text = container.textContent ?? '';
    expect(text).not.toContain('上から順に解決');
    expect(text).not.toContain('対応を追加');
    expect(text).not.toContain('閉じる');
    act(() => root.unmount());
  });

  it('keeps manual target/remove reachable via overflow (⋯) menu', () => {
    const state = buildVisualFixture('stack').snapshot.state;
    const { container, root } = mountPile(controllerFor(state));
    // ⋯メニューのトリガーが存在(aria-label に「その他」系の名詞を許容)
    const overflow = container.querySelector('[data-testid^="stack-overflow-"], [data-testid^="stack-item-menu-"]');
    expect(overflow).not.toBeNull();
    act(() => root.unmount());
  });

  it('keeps stack items non-draggable (CR608 guard)', () => {
    const state = buildVisualFixture('stack').snapshot.state;
    const { container, root } = mountPile(controllerFor(state));
    const stackCards = container.querySelectorAll('.stack-workspace__card .card-view, .stack-pile .card-view, [data-stack-item-id] .card-view');
    expect(stackCards.length).toBeGreaterThan(0);
    stackCards.forEach((card) => {
      expect(card.hasAttribute('aria-roledescription')).toBe(false);
    });
    act(() => root.unmount());
  });
});
