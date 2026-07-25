/**
 * review.s4-decision-bar — S4 DecisionBar最小化の契約(判定者専有)。
 * 契約: 通常表示は「対象 0/1」形式のカウント+キャンセルのみ。instruction は
 * 視覚テキストとして描画しない(aria-label/tooltip 専用)。候補の発光は既存
 * decisionCardRole 機構が担う(ここでは描画契約のみピン)。
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildVisualFixture } from '../../../dev/visualFixtures/fixtureBuilder';
import { useGameStore } from '../../../store/gameStore';
import { DecisionBar } from '../DecisionBar';
import type { GameController } from '../gameController';
import type { DecisionFocusModel } from '../decisionFocus';

afterEach(() => {
  document.body.replaceChildren();
  useGameStore.setState({ state: null });
});

function mountBar(focus: DecisionFocusModel) {
  const state = buildVisualFixture('stack').snapshot.state;
  useGameStore.setState({ state, warnings: [], triggerCandidates: [] });
  const controller = {
    state,
    store: useGameStore.getState(),
    decisionFocus: focus,
    cancelDecision: vi.fn(),
    chooseDecisionPlayer: vi.fn(),
  } as unknown as GameController;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<DecisionBar controller={controller} />));
  return { container, root };
}

const targetFocus: DecisionFocusModel = {
  kind: 'target',
  title: '対象',
  instruction: '金色のカードを選んでください。長押しで内容を確認できます。',
  candidateIds: ['c1'],
  selectedIds: [],
  requiredCount: 1,
};

describe('S4 decision bar minimal contract', () => {
  it('renders the bar but not the instruction as visible text', () => {
    const { container, root } = mountBar(targetFocus);
    expect(container.querySelector('[data-testid="decision-bar"]')).not.toBeNull();
    const text = container.textContent ?? '';
    expect(text).not.toContain('金色のカードを選んでください');
    act(() => root.unmount());
  });

  it('shows the selection count in selected/required form', () => {
    const { container, root } = mountBar(targetFocus);
    const text = container.textContent ?? '';
    expect(text).toContain('0/1');
    act(() => root.unmount());
  });

  it('keeps a cancel control', () => {
    const { container, root } = mountBar(targetFocus);
    expect(container.querySelector('.decision-bar__cancel')).not.toBeNull();
    act(() => root.unmount());
  });

  it('still surfaces a warning when present (exception text is allowed)', () => {
    const { container, root } = mountBar({
      ...targetFocus,
      kind: 'warning',
      warning: '不足 2マナ',
    });
    const text = container.textContent ?? '';
    expect(text).toContain('不足 2マナ');
    act(() => root.unmount());
  });
});
