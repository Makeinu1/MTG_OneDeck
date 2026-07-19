// Reviewer-owned UI pins for the independent opponent setup screen (I34/I40).
// 実装エージェントは本ファイルを変更しないこと。落ちたら実装側を直す。
// (J0起草 2026-07-15 → 判定者が実機E2E(draft不変・単一undo・console 0)で再オーナー化 2026-07-16。)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyCommand } from '../../engine/commands';
import { makeDeck } from '../../engine/__tests__/helpers';
import { DEFAULT_OPPONENT_ID, playerIdForLifeLabel, requirePlayer } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';
import type { GameController } from './gameController';
import { OpponentBoardDialog, OpponentBoards } from './OpponentBoards';
import { OpponentSetupScreen } from './OpponentSetupScreen';
import { ThumbZone } from './ThumbZone';
import { AttackDialog } from './dialogs';

function mount(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(node));
  return {
    container,
    root,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set?.bind(input);
  setter?.(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function resetStore(): void {
  useGameStore.setState({
    state: null,
    warnings: [],
    triggerCandidates: [],
    pendingGuided: null,
    canUndo: false,
    canRedo: false,
    autoAdvanceToMain: false,
    mulliganDecisionPending: false,
  });
}

function controllerFor(state: NonNullable<ReturnType<typeof useGameStore.getState>['state']>): GameController {
  return {
    state,
    store: useGameStore.getState(),
    openCardMenu: vi.fn(),
    handleCardDoubleClick: vi.fn(),
    requestResolveTop: vi.fn(),
    requestResolveAll: vi.fn(),
    advancePhase: vi.fn(),
    advanceTurn: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    setManualTargets: vi.fn(),
    openLibraryActions: vi.fn(),
    libraryActionsOpen: false,
    openZoneViewer: vi.fn(),
    // MP-UI-FIX: 相手盤面はメニュー起動のモーダルへ降格(既定で隠す)。
    opponentBoardOpen: false,
    openOpponentBoard: vi.fn(),
    closeOpponentBoard: vi.fn(),
    openTokenDialog: vi.fn(),
    openAttackDialog: vi.fn(),
    openArrangeTop: vi.fn(),
    openCountDialog: vi.fn(),
    requestConfirm: vi.fn(),
    triggerCandidateCount: 0,
    motionArmed: false,
    feedOpen: false,
    openFeed: vi.fn(),
    closeFeed: vi.fn(),
    overlays: null,
    shortcutsBlocked: false,
    transitionCue: null,
    dismissTransitionCue: vi.fn(),
    performDrop: vi.fn(),
    closeTransientUi: vi.fn(),
  };
}

describe('opponent setup independent screen', () => {
  beforeEach(() => {
    resetStore();
    useGameStore.getState().newGame(makeDeck(8), 1);
  });

  it('keeps canonical state untouched while editing and on cancel', () => {
    const state = useGameStore.getState().state!;
    const before = JSON.stringify(state);
    const cancel = vi.fn();
    const view = mount(<OpponentSetupScreen state={state} onCancel={cancel} onApplied={vi.fn()} />);
    act(() => view.container.querySelector<HTMLButtonElement>('[data-testid="setup-add-permanent"]')?.click());
    const name = view.container.querySelector<HTMLInputElement>('[data-testid="setup-name-0"]')!;
    act(() => {
      name.value = '編集だけの熊';
      name.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => view.container.querySelector<HTMLButtonElement>('[data-testid="setup-cancel"]')?.click());

    expect(cancel).toHaveBeenCalledOnce();
    expect(JSON.stringify(useGameStore.getState().state)).toBe(before);
    view.unmount();
  });

  it('applies once, reopens from canonical data, and undo removes the whole setup', () => {
    const state = useGameStore.getState().state!;
    const applied = vi.fn();
    let view = mount(<OpponentSetupScreen state={state} onCancel={vi.fn()} onApplied={applied} />);
    act(() => view.container.querySelector<HTMLButtonElement>('[data-testid="setup-add-permanent"]')?.click());
    act(() => view.container.querySelector<HTMLButtonElement>('[data-testid="setup-apply"]')?.click());
    expect(applied).toHaveBeenCalledOnce();
    const next = useGameStore.getState().state!;
    expect(next.zones.battlefield.some((id) => next.cards[id]?.isScenarioDummy)).toBe(true);
    view.unmount();

    view = mount(<OpponentSetupScreen state={next} onCancel={vi.fn()} onApplied={vi.fn()} />);
    expect(view.container.querySelectorAll('[data-testid^="setup-permanent-"]')).toHaveLength(1);
    view.unmount();

    act(() => useGameStore.getState().undo());
    expect(useGameStore.getState().state?.zones.battlefield.some(
      (id) => useGameStore.getState().state?.cards[id]?.isScenarioDummy,
    )).toBe(false);
  });

  it('keeps edits for multiple opponents and applies duplicate/reorder/delete as one history entry', () => {
    useGameStore.getState().addOpponent('Bob');
    const before = useGameStore.getState().state!;
    const bobId = playerIdForLifeLabel('Bob');
    const applied = vi.fn();
    const view = mount(
      <OpponentSetupScreen state={before} onCancel={vi.fn()} onApplied={applied} />,
    );
    const life = view.container.querySelector<HTMLInputElement>('[data-testid="setup-life"]')!;
    act(() => {
      setInputValue(life, '31');
    });
    act(() => view.container.querySelector<HTMLButtonElement>('[data-testid="setup-add-permanent"]')?.click());
    act(() => view.container.querySelector<HTMLButtonElement>('[data-testid="setup-duplicate-0"]')?.click());
    act(() => view.container.querySelector<HTMLButtonElement>('[data-testid="setup-move-down-0"]')?.click());
    act(() => view.container.querySelector<HTMLButtonElement>('[data-testid="setup-delete-0"]')?.click());
    const firstCounters = view.container.querySelector<HTMLInputElement>('[data-testid="setup-counters-0"]')!;
    act(() => {
      setInputValue(firstCounters, '+1/+1:2');
      firstCounters.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });

    const player = view.container.querySelector<HTMLSelectElement>('[data-testid="setup-player"]')!;
    act(() => {
      player.value = bobId;
      player.dispatchEvent(new Event('change', { bubbles: true }));
    });
    act(() => view.container.querySelector<HTMLButtonElement>('[data-testid="setup-add-permanent"]')?.click());
    expect(view.container.querySelector<HTMLInputElement>('[data-testid="setup-counters-0"]')?.value)
      .toBe('');
    const bobLife = view.container.querySelector<HTMLInputElement>('[data-testid="setup-life"]')!;
    act(() => {
      setInputValue(bobLife, '22');
    });
    act(() => view.container.querySelector<HTMLButtonElement>('[data-testid="setup-apply"]')?.click());

    expect(applied).toHaveBeenCalledOnce();
    expect(requirePlayer(useGameStore.getState().state!, DEFAULT_OPPONENT_ID).life).toBe(31);
    expect(requirePlayer(useGameStore.getState().state!, bobId).life).toBe(22);
    expect(useGameStore.getState().state?.zones.battlefield.filter(
      (id) => useGameStore.getState().state?.cards[id]?.controllerId === DEFAULT_OPPONENT_ID,
    )).toHaveLength(1);

    act(() => useGameStore.getState().undo());
    expect(useGameStore.getState().state).toEqual(before);
    act(() => useGameStore.getState().redo());
    expect(requirePlayer(useGameStore.getState().state!, DEFAULT_OPPONENT_ID).life).toBe(31);
    expect(requirePlayer(useGameStore.getState().state!, bobId).life).toBe(22);
    view.unmount();
  });

  it('stays on the setup screen and exposes an error when the draft is invalid', () => {
    const state = useGameStore.getState().state!;
    const applied = vi.fn();
    const view = mount(
      <OpponentSetupScreen state={state} onCancel={vi.fn()} onApplied={applied} />,
    );
    act(() => view.container.querySelector<HTMLButtonElement>('[data-testid="setup-add-permanent"]')?.click());
    const typeCheckbox = view.container.querySelector<HTMLInputElement>(
      '[data-testid="setup-permanent-0"] fieldset input[type="checkbox"]',
    )!;
    act(() => typeCheckbox.click());
    act(() => view.container.querySelector<HTMLButtonElement>('[data-testid="setup-apply"]')?.click());

    expect(applied).not.toHaveBeenCalled();
    expect(view.container.querySelector('[data-testid="setup-error"]')?.textContent)
      .toContain('反映できませんでした');
    expect(useGameStore.getState().state?.zones.battlefield.some(
      (id) => useGameStore.getState().state?.cards[id]?.isScenarioDummy,
    )).toBe(false);
    view.unmount();
  });

  it('projects opponent permanents into creature/other/land lanes by controller', () => {
    let state = useGameStore.getState().state!;
    const specs = [
      ['scenario-creature', 'Creature'],
      ['scenario-artifact', 'Artifact'],
      ['scenario-land', 'Land'],
    ] as const;
    for (const [cardId, typeLine] of specs) {
      state = applyCommand(state, {
        type: 'createScenarioDummy',
        cardId,
        defId: cardId + '-def',
        playerId: DEFAULT_OPPONENT_ID,
        name: cardId,
        typeLine,
        power: typeLine === 'Creature' ? '1' : undefined,
        toughness: typeLine === 'Creature' ? '1' : undefined,
        tapped: false,
        counters: {},
        keywords: [],
        isToken: false,
      }).state;
    }
    useGameStore.setState({ state });
    const view = mount(<OpponentBoards controller={controllerFor(state)} />);
    expect(view.container.querySelector('[data-testid="opponent-creatures-OPPONENT_A"]')?.textContent)
      .toContain('scenario-creature');
    expect(view.container.querySelector('[data-testid="opponent-others-OPPONENT_A"]')?.textContent)
      .toContain('scenario-artifact');
    expect(view.container.querySelector('[data-testid="opponent-lands-OPPONENT_A"]')?.textContent)
      .toContain('scenario-land');
    view.unmount();
  });

  it('offers opponent dummy creatures as assignable blockers in the attack UI', () => {
    let state = useGameStore.getState().state!;
    for (const [cardId, playerId] of [
      ['ui-attacker', 'P1'],
      ['ui-blocker', DEFAULT_OPPONENT_ID],
    ] as const) {
      state = applyCommand(state, {
        type: 'createScenarioDummy',
        cardId,
        defId: cardId + '-def',
        playerId,
        name: cardId,
        typeLine: 'Creature',
        power: '1',
        toughness: '1',
        tapped: false,
        counters: {},
        keywords: [],
        isToken: false,
      }).state;
    }
    const confirm = vi.fn();
    const view = mount(
      <AttackDialog
        state={state}
        opponentLabels={['対戦相手A']}
        onConfirm={confirm}
        onCancel={vi.fn()}
      />,
    );
    act(() => view.container.querySelector<HTMLInputElement>('[data-testid="attack-select-ui-attacker"]')?.click());
    const blocker = view.container.querySelector<HTMLSelectElement>('[data-testid="blocker-select-ui-blocker"]')!;
    act(() => {
      blocker.value = 'ui-attacker';
      blocker.dispatchEvent(new Event('change', { bubbles: true }));
    });
    act(() => view.container.querySelector<HTMLButtonElement>('[data-testid="attack-confirm"]')?.click());
    expect(confirm).toHaveBeenCalledWith(
      ['ui-attacker'],
      '対戦相手A',
      [{ cardId: 'ui-blocker', attackerId: 'ui-attacker' }],
    );
    view.unmount();
  });
});

// ---------------------------------------------------------------------------
// MP-UI-FIX 判定者先行 pin(2026-07-16・発注前に authoring)
//
// 由来: commit 7b2c5c1 が OpponentBoards を .game-screen__board セルの中へ
// <Board> の兄として挿入し、自分の盤面を画面外へ押し出した。相手が0枚でも
// 空ストリップが desktop ~100px / mobile ~250px を食う回帰だった。
// ユーザー裁定(2026-07-16): 既定で完全に隠し、メニュー「相手盤面を見る」で出す。
// 契約: docs/design-vision.md:80 原則7「常設のゾーンラベル・相手ライフ行…は廃止し
// 「タップで出す」へ降格」(要は「シート」でなく「常設(の禁止)」)。
//
// ⚠ コントラスト比はここでは検証できない(jsdom は cascade も var() も color-mix() も
// 解決しない)。**jsdom でコントラストを主張するテストは嘘**。実測は実機ブラウザの
// visual fixture(light/dark)でのみ行う。ここを偽アサーションで「埋めない」こと。
// ---------------------------------------------------------------------------
describe('MP-UI-FIX: 相手盤面は既定で隠れ、メニューから出す', () => {
  // beforeEach は describe スコープ=上の describe のものは効かない。
  // これが無いと前の test が setState した相手 permanent が漏れ、
  // 「盤面なし」の pin が別テストの残骸で偽陰性になる。
  beforeEach(() => {
    resetStore();
    useGameStore.getState().newGame(makeDeck(8), 1);
  });

  const gameScreenSrc = readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), './GameScreen.tsx'),
    'utf-8',
  );
  const gameCss = readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), './game.css'),
    'utf-8',
  );

  it('回帰そのもの: GameScreen は OpponentBoards を描画しない', () => {
    // 構造で pin する(GameScreen の実マウントは DndContext/Suspense を引き込み遅く脆い)。
    expect(gameScreenSrc).not.toMatch(/<OpponentBoards\b/);
  });

  it('回帰そのもの: .game-screen__board は overflow:hidden(auto は不可視に失敗する)', () => {
    // hidden は clip ゆえ、再発しても「静かに」壊れる=このpinが唯一の防波堤。
    const rule = gameCss.match(/\.game-screen__board\s*\{[^}]*\}/)?.[0] ?? '';
    expect(rule, '.game-screen__board 規則が見つからない').not.toBe('');
    expect(rule).toMatch(/overflow:\s*hidden/);
    expect(rule).not.toMatch(/overflow:\s*auto/);
  });

  it('配線の継ぎ目: メニューの「相手盤面を見る」が openOpponentBoard を呼ぶ', () => {
    const state = useGameStore.getState().state!;
    const controller = controllerFor(state);
    const view = mount(<ThumbZone controller={controller} />);

    act(() => view.container.querySelector<HTMLButtonElement>('[data-testid="game-menu"]')?.click());
    const item = view.container.querySelector<HTMLButtonElement>('[data-testid="menu-opponent-board"]');
    expect(item, 'menu-opponent-board が存在しない').not.toBeNull();
    expect(item?.textContent).toContain('相手盤面を見る');
    act(() => item?.click());

    expect(controller.openOpponentBoard).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('中身: ダイアログは相手の permanent を controller 別に映す', () => {
    let state = useGameStore.getState().state!;
    state = applyCommand(state, {
      type: 'createScenarioDummy',
      cardId: 'ui-opp-creature',
      defId: 'ui-opp-creature-def',
      playerId: DEFAULT_OPPONENT_ID,
      name: '相手クリーチャー',
      typeLine: 'Creature',
      power: '2',
      toughness: '2',
      tapped: false,
      counters: {},
      keywords: [],
      isToken: false,
    }).state;
    useGameStore.setState({ state });

    const controller = controllerFor(state);
    const view = mount(<OpponentBoardDialog controller={controller} onClose={vi.fn()} />);

    expect(view.container.querySelector('[data-testid="opponent-boards"]')).not.toBeNull();
    expect(
      view.container.querySelector(`[data-testid="opponent-board-${DEFAULT_OPPONENT_ID}"]`),
    ).not.toBeNull();
    expect(view.container.textContent).toContain('相手クリーチャー');
    view.unmount();
  });

  it('北極星②: permanent 0枚の相手は空レーン3本でなく「盤面なし」1行に畳む', () => {
    const state = useGameStore.getState().state!;
    const controller = controllerFor(state);
    const view = mount(<OpponentBoardDialog controller={controller} onClose={vi.fn()} />);

    const board = view.container.querySelector(`[data-testid="opponent-board-${DEFAULT_OPPONENT_ID}"]`);
    expect(board).not.toBeNull();
    expect(board?.textContent).toContain('盤面なし');
    expect(board?.querySelector(`[data-testid="opponent-creatures-${DEFAULT_OPPONENT_ID}"]`)).toBeNull();
    view.unmount();
  });
});
