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
  useGameStore.setState({ state: null, resolutionSession: null });
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
    resolutionSession: null,
    removeStackItem: vi.fn(),
    completeManualResolution: vi.fn(),
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

  it('keeps manual target/remove wired through the overflow (⋯) menu', () => {
    const state = buildVisualFixture('stack').snapshot.state;
    const controller = controllerFor(state);
    const removeStackItem = vi.spyOn(controller, 'removeStackItem').mockImplementation(() => {});
    const { container, root } = mountPile(controller);
    // ⋯メニューのトリガーが存在(aria-label に「その他」系の名詞を許容)
    const overflow = container.querySelector<HTMLButtonElement>('[data-testid^="stack-overflow-"]');
    expect(overflow).not.toBeNull();
    // 展開トリガーは見出しボタンが担う。カード面を別の button role にして
    // ⋯ボタンをインタラクティブ要素内へネストしない。
    expect(overflow?.closest('[role="button"]')).toBeNull();

    // 対象の手動記録はダイアログを経て controller へ届く。
    act(() => overflow?.click());
    const manualTarget = container.querySelector<HTMLButtonElement>('[data-testid^="stack-manual-target-"]');
    const stackItemId = manualTarget?.dataset.testid?.replace('stack-manual-target-', '');
    expect(stackItemId).toBeTruthy();
    act(() => manualTarget?.click());
    expect(container.querySelector('[data-testid="manual-target-dialog"]')).not.toBeNull();
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="manual-target-confirm"]')?.click();
    });
    expect(controller.setManualTargets).toHaveBeenCalledWith(stackItemId, [], []);

    // 手動打ち消し／能力除去は interaction port の専用経路へ届く。
    act(() => overflow?.click());
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid^="stack-manual-remove-"]')?.click();
    });
    expect(removeStackItem).toHaveBeenCalledWith(stackItemId);
    act(() => root.unmount());
  });

  it('keeps required manual completion visible instead of hiding it in overflow', () => {
    const state = buildVisualFixture('stack').snapshot.state;
    const base = controllerFor(state);
    const completeManualResolution = vi.fn();
    const controller = {
      ...base,
      resolutionSession: {
        stage: 'manual-required',
        tasks: [{ id: 'manual-task', message: 'カードの指示に従ってください。' }],
      },
      completeManualResolution,
    } as GameController;
    const { container, root } = mountPile(controller);

    const task = container.querySelector('[data-testid="stack-manual-task"]');
    expect(task).not.toBeNull();
    expect(task?.textContent).toContain('完了');
    expect(container.querySelector('[data-testid="stack-board-peek"]')).toBeNull();
    act(() => task?.querySelector<HTMLButtonElement>('button')?.click());
    expect(completeManualResolution).toHaveBeenCalledOnce();
    act(() => root.unmount());
  });

  it('lets the user clear the board view and return to the same stack context', () => {
    const state = buildVisualFixture('stack').snapshot.state;
    const { container, root } = mountPile(controllerFor(state));
    const band = () => container.querySelector('[data-testid="stack-band"]');

    // 複数項目を展開して確認する。
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="stack-compact-trigger"]')?.click();
    });
    expect(container.querySelectorAll('.stack-pile__list [data-stack-item-id]')).toHaveLength(
      state.zones.stack.length,
    );

    // 盤面を見る間はパイル/一覧を退避し、最小の復帰タブだけ残す。
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="stack-board-peek"]')?.click();
    });
    expect(band()?.getAttribute('data-board-peek')).toBe('true');
    expect(container.querySelector('.stack-pile__cards')).toBeNull();
    expect(container.querySelector('.stack-pile__list')).toBeNull();
    expect(container.querySelector('[data-testid="stack-board-return"]')).not.toBeNull();

    // 復帰すると、盤面を見る前の展開状態へ戻る。
    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="stack-board-return"]')?.click();
    });
    expect(band()?.getAttribute('data-board-peek')).toBeNull();
    expect(container.querySelectorAll('.stack-pile__list [data-stack-item-id]')).toHaveLength(
      state.zones.stack.length,
    );
    act(() => root.unmount());
  });

  it('does not offer board peek while a stack target decision requires the pile', () => {
    const state = buildVisualFixture('stack').snapshot.state;
    const stackCardId = state.zones.stack[0];
    const controller = {
      ...controllerFor(state),
      decisionFocus: {
        kind: 'target',
        title: '対象',
        instruction: 'スタック上の対象を選ぶ',
        candidateIds: [stackCardId],
        selectedIds: [],
        requiredCount: 1,
      },
    } as unknown as GameController;
    const { container, root } = mountPile(controller);

    expect(container.querySelector('[data-testid="stack-band"]')?.getAttribute('data-expanded')).toBe('true');
    expect(container.querySelector('[data-testid="stack-board-peek"]')).toBeNull();
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
