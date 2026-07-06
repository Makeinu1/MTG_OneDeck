// Reviewer-owned adversarial tests for cr-modal-target-optional-variable: modal
// selection command compilation (design-lock: docs/engine-spec.md §34.37 —
// "実装ギャップなし"). 実装エージェント(Codex含む)は本ファイルを変更しないこと。
// 落ちたら実装側を直す。
//
// CR grounding:
// - CR 700.2: モーダル効果=選択した各モードを個別の効果として実行する。1モードが
//   engineの限界で実行不能でも、呪文/能力の解決そのものは妨げられない(各モードは
//   独立した効果であるため)。
// 契約の要石=選択されたモードのcommandコンパイルは`src/store/gameStore.ts`の
// `compileSelectedModalOptions`(`confirmGuidedModal`から呼ばれる)が既に担っている
// (既存`parseAbilityIR`+`compileAbilityIR`パイプラインを再帰的に再利用)。
// `src/engine/grammar/compile.ts`の`buildGuidedCommands`はmodal answerに対して
// 常に`[]`を返す契約のまま(既存review.grammar-guided.test.tsのpinで凍結済み・
// 本ファイルでは変更しない)——再帰コンパイルはストア層の責務、というG3設計を
// 維持する。
import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import type { CardDef } from '../../types/card';
import { useGameStore } from '../gameStore';

function store() {
  return useGameStore.getState();
}

function snap() {
  const state = store().state;
  if (!state) throw new Error('game state is not available');
  return state;
}

function resetStore(): void {
  useGameStore.setState({
    state: null,
    warnings: [],
    triggerCandidates: [],
    pendingGuided: null,
    canUndo: false,
    canRedo: false,
    autoAdvanceToMain: true,
    mulliganDecisionPending: false,
  });
}

function startGameWith(defs: CardDef[]): void {
  store().newGame(
    [...defs.map((def) => ({ def, isCommander: false })), ...makeDeck(20)],
    1,
  );
}

function findInstanceId(defId: string): string {
  const card = Object.values(snap().cards).find((instance) => instance.defId === defId);
  if (!card) throw new Error(`card instance not found for ${defId}`);
  return card.id;
}

describe('cr-modal-target-optional-variable: modal choice command compilation (CR 700.2)', () => {
  beforeEach(() => resetStore());

  it('golden (Teval\'s Judgment shape): choosing the "Draw a card." mode actually draws a card end-to-end', () => {
    const spell = makeDef({
      scryfallId: 'r-cr700-teval-e2e',
      typeLine: 'Instant',
      faces: [
        {
          name: 'r-cr700-teval-e2e',
          typeLine: 'Instant',
          oracleText: 'Choose one —\n• Draw a card.\n• Create a Treasure token.\n• Create a 2/2 black Zombie Druid creature token.',
        },
      ],
    });
    startGameWith([spell]);
    const id = findInstanceId('r-cr700-teval-e2e');
    store().moveCard(id, 'stack');
    const handBefore = snap().zones.hand.length;

    store().resolveTop();
    expect(store().pendingGuided).toMatchObject({ prompts: [{ kind: 'modal' }] });

    store().confirmGuidedModal([0]);
    expect(store().pendingGuided).toBeNull();
    expect(snap().zones.hand.length).toBe(handBefore + 1);
  });

  it('golden (Teval\'s Judgment shape): choosing the token-creation mode creates the token end-to-end', () => {
    const spell = makeDef({
      scryfallId: 'r-cr700-teval-token',
      typeLine: 'Instant',
      faces: [
        {
          name: 'r-cr700-teval-token',
          typeLine: 'Instant',
          oracleText: 'Choose one —\n• Draw a card.\n• Create a Treasure token.\n• Create a 2/2 black Zombie Druid creature token.',
        },
      ],
    });
    startGameWith([spell]);
    const id = findInstanceId('r-cr700-teval-token');
    store().moveCard(id, 'stack');
    store().resolveTop();
    store().confirmGuidedModal([2]);

    const zombieToken = Object.values(snap().cards).find(
      (card) => card.zone === 'battlefield' && card.id !== id,
    );
    expect(zombieToken).toBeDefined();
    expect(zombieToken?.isToken).toBe(true);
  });

  it('fail-safe (Sheoldred\'s Edict shape): choosing an unsupported "each opponent" mode does not crash, and the spell still resolves off the stack (CR 700.2 — mode independence)', () => {
    const spell = makeDef({
      scryfallId: 'r-cr700-sheoldred-e2e',
      typeLine: 'Instant',
      faces: [
        {
          name: 'r-cr700-sheoldred-e2e',
          typeLine: 'Instant',
          oracleText:
            'Choose one —\n• Each opponent sacrifices a nontoken creature of their choice.\n• Each opponent sacrifices a creature token of their choice.\n• Each opponent sacrifices a planeswalker of their choice.',
        },
      ],
    });
    startGameWith([spell]);
    const id = findInstanceId('r-cr700-sheoldred-e2e');
    store().moveCard(id, 'stack');
    store().resolveTop();

    expect(() => store().confirmGuidedModal([0])).not.toThrow();
    expect(store().pendingGuided).toBeNull();
    expect(snap().zones.stack).not.toContain(id);
    expect(snap().cards[id].zone).toBe('graveyard');
  });

  it('non-regression: compile.ts\'s buildGuidedCommands still returns [] for modal answers directly (recursive compile stays store-owned, per existing review.grammar-guided.test.ts contract)', async () => {
    const { buildGuidedCommands, compileAbilityIR } = await import('../../engine/grammar/compile');
    const { parseAbilityIR } = await import('../../engine/grammar/ir');
    const def = makeDef({
      scryfallId: 'r-cr700-compile-nonreg',
      typeLine: 'Instant',
      faces: [{ name: 'r-cr700-compile-nonreg', typeLine: 'Instant', oracleText: 'Choose one —\n• Draw a card.\n• You gain 3 life.' }],
    });
    const compiled = compileAbilityIR(parseAbilityIR('Choose one —\n• Draw a card.\n• You gain 3 life.', 'Instant'), {
      sourceId: 'source-1',
      def,
    });
    const commands = buildGuidedCommands(
      compiled.prompts[0],
      { kind: 'modal', chosen: [0] },
      { sourceId: 'source-1', def },
    );
    expect(commands).toEqual([]);
  });
});
