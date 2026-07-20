/**
 * combat-primary-runtime — 「次に進む」で戦闘を処理する経路のランタイム統合テスト。
 *
 * 純粋モデル(primaryActionModel)だけでなく、実体の useGameController + ThumbZone +
 * AttackDialog を jsdom に描画し、ボタンクリックとキーボードショートカットの両方で
 * エンドツーエンドに検証する(モデルは正しくても配線が壊れると遊べないため)。
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '../../../store/gameStore';
import { DEFAULT_KEYBINDINGS } from '../../../data/keybindings';
import { useGameController } from '../gameController';
import { ThumbZone } from '../ThumbZone';
import { makeDef, makeDeck } from '../../../engine/__tests__/helpers';

const store = () => useGameStore.getState();

function Harness() {
  const controller = useGameController({ keybindings: DEFAULT_KEYBINDINGS });
  return (
    <>
      <ThumbZone controller={controller} />
      {controller.overlays}
    </>
  );
}

function resetStore(): void {
  useGameStore.setState({
    state: null,
    warnings: [],
    triggerCandidates: [],
    pendingGuided: null,
    pendingCast: null,
    resolutionSession: null,
    pendingCommanderResolution: null,
    canUndo: false,
    canRedo: false,
    autoAdvanceToMain: false,
    mulliganDecisionPending: false,
  });
}

function setupGame(creatureId: string): string {
  const creature = makeDef({
    scryfallId: creatureId,
    typeLine: 'Creature',
    faces: [{ name: creatureId, typeLine: 'Creature', power: '2', toughness: '2' }],
  });
  store().newGame([{ def: creature, isCommander: false }, ...makeDeck(20)], 1);
  store().keepOpeningHand();
  const card = Object.values(store().state?.cards ?? {}).find((c) => c.defId === creatureId);
  if (!card) throw new Error(`creature ${creatureId} not found`);
  store().moveCard(card.id, 'battlefield');
  return card.id;
}

function advanceToCombat(): void {
  for (let i = 0; i < 8; i++) {
    const s = store().state;
    if (!s) throw new Error('game state missing');
    if (s.phase === 'combat') return;
    if (store().triggerCandidates.length > 0) store().dismissTriggerCandidates();
    store().nextPhase();
  }
  throw new Error('did not reach combat phase');
}

function pressNextKey(): void {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  });
}

function primaryButton(): HTMLButtonElement {
  const btn = container.querySelector<HTMLButtonElement>('[data-testid="primary-action"]');
  if (!btn) throw new Error('primary-action button not rendered');
  return btn;
}

let root: Root;
let container: HTMLElement;

beforeEach(() => {
  resetStore();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.replaceChildren();
  resetStore();
});

describe('combat handled by the primary "Next" action (runtime wiring)', () => {
  it('no eligible attackers: button shows 攻撃せず進む and advances combat → main2', () => {
    setupGame('c-sick');
    advanceToCombat();
    act(() => root.render(<Harness />));

    const btn = primaryButton();
    expect(btn.dataset.kind).toBe('skip-combat');
    expect(btn.textContent).toContain('攻撃せず進む');

    act(() => btn.click());
    expect(store().state?.phase).toBe('main2');
  });

  it('no eligible attackers: ArrowUp shortcut skips combat the same way', () => {
    setupGame('c-sick-kb');
    advanceToCombat();
    act(() => root.render(<Harness />));
    expect(primaryButton().dataset.kind).toBe('skip-combat');

    pressNextKey();
    expect(store().state?.phase).toBe('main2');
  });

  it('one ready attacker: button opens the attack dialog preselected; confirm taps and resolves; next → main2', () => {
    const id = setupGame('c-ready');
    store().nextTurn();
    advanceToCombat();
    act(() => root.render(<Harness />));

    const btn = primaryButton();
    expect(btn.dataset.kind).toBe('attack');
    expect(btn.textContent).toContain('1体で攻撃');

    act(() => btn.click());
    expect(container.querySelector('[data-testid="attack-dialog"]')).not.toBeNull();
    const checkbox = container.querySelector<HTMLInputElement>(
      `[data-testid="attack-select-${id}"]`,
    );
    expect(checkbox?.checked).toBe(true);

    const confirm = container.querySelector<HTMLButtonElement>('[data-testid="attack-confirm"]');
    expect(confirm?.textContent).toContain('1体で攻撃');
    act(() => confirm?.click());

    expect(store().state?.cards[id]?.tapped).toBe(true);
    expect(container.querySelector('[data-testid="attack-dialog"]')).toBeNull();
    expect(primaryButton().dataset.kind).toBe('next-phase');

    act(() => primaryButton().click());
    expect(store().state?.phase).toBe('main2');
  });

  it('one ready attacker: ArrowUp shortcut opens the same preselected dialog', () => {
    const id = setupGame('c-ready-kb');
    store().nextTurn();
    advanceToCombat();
    act(() => root.render(<Harness />));

    pressNextKey();
    expect(container.querySelector('[data-testid="attack-dialog"]')).not.toBeNull();
    const checkbox = container.querySelector<HTMLInputElement>(
      `[data-testid="attack-select-${id}"]`,
    );
    expect(checkbox?.checked).toBe(true);
  });
});

describe('stack & triggers handled by the same "Next" action (runtime wiring)', () => {
  it('ETB trigger → 誘発を処理 puts it on stack → スタックを解決 resolves it (button chain)', () => {
    const etb = makeDef({
      scryfallId: 'c-etb',
      typeLine: 'Creature',
      faces: [{
        name: 'c-etb',
        typeLine: 'Creature',
        oracleText: 'When this creature enters the battlefield, draw a card.',
        power: '1',
        toughness: '1',
      }],
    });
    store().newGame([{ def: etb, isCommander: false }, ...makeDeck(20)], 1);
    store().keepOpeningHand();
    const id = Object.values(store().state?.cards ?? {}).find((c) => c.defId === 'c-etb')?.id;
    if (!id) throw new Error('etb creature not found');
    act(() => root.render(<Harness />));

    act(() => store().moveCard(id, 'battlefield'));
    expect(store().triggerCandidates.length).toBe(1);
    expect(primaryButton().dataset.kind).toBe('triggers');
    expect(primaryButton().textContent).toContain('誘発を処理 (1)');

    act(() => primaryButton().click());
    expect(store().state?.zones.stack.length).toBe(1);
    expect(primaryButton().dataset.kind).toBe('resolve');
    expect(primaryButton().textContent).toContain('スタックを解決 (1)');

    act(() => primaryButton().click());
    expect(store().state?.zones.stack.length).toBe(0);
  });

  it('stack resolution also works from the keyboard shortcut', () => {
    const etb = makeDef({
      scryfallId: 'c-etb-kb',
      typeLine: 'Creature',
      faces: [{
        name: 'c-etb-kb',
        typeLine: 'Creature',
        oracleText: 'When this creature enters the battlefield, draw a card.',
        power: '1',
        toughness: '1',
      }],
    });
    store().newGame([{ def: etb, isCommander: false }, ...makeDeck(20)], 1);
    store().keepOpeningHand();
    const id = Object.values(store().state?.cards ?? {}).find((c) => c.defId === 'c-etb-kb')?.id;
    if (!id) throw new Error('etb creature not found');
    act(() => root.render(<Harness />));

    act(() => store().moveCard(id, 'battlefield'));
    pressNextKey();
    expect(store().state?.zones.stack.length).toBe(1);
    pressNextKey();
    expect(store().state?.zones.stack.length).toBe(0);
  });
});
