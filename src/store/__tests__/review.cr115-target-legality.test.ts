// Reviewer-owned adversarial tests for cr-115 target legality at spell resolution / ability activation.
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// CR grounding:
// - CR 115.2 / 601.2c: 非合法な候補(land を nonland 対象に等)は選べない。
// - CR 602.2b: 起動型能力の対象は起動時に選ぶ。非合法対象では起動が確定しない(コスト未精算・スタック非搭載)。
// 契約の要 = 非合法対象の選択で cost が精算されてはならない(atomicity)。合法対象で初めて確定する。
import { beforeEach, describe, expect, it } from 'vitest';

import { makeDef } from '../../engine/__tests__/helpers';
import type { PlayerId } from '../../engine/types';
import { useGameStore } from '../gameStore';

const store = () => useGameStore.getState();

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

function findInstanceId(defId: string): string {
  const card = Object.values(store().state?.cards ?? {}).find((c) => c.defId === defId);
  if (!card) throw new Error(`card instance not found for ${defId}`);
  return card.id;
}

function setController(cardId: string, controllerId: PlayerId): void {
  const state = store().state!;
  const card = state.cards[cardId];
  useGameStore.setState({
    state: { ...state, cards: { ...state.cards, [cardId]: { ...card, controllerId } } },
  });
}

describe('cr-115 activation-time illegal target does not commit cost (CR 601.2c / 602.2b)', () => {
  beforeEach(() => resetStore());

  it('nonland 対象に land を選ぶと能力は起動せず source は untapped のまま、合法対象で初めて確定', () => {
    const source = makeDef({
      scryfallId: 'r-cr115-src',
      typeLine: 'Artifact',
      faces: [
        { name: 'r-cr115-src', typeLine: 'Artifact', oracleText: '{T}: Destroy target nonland permanent.' },
      ],
    });
    const land = makeDef({
      scryfallId: 'r-cr115-land',
      typeLine: 'Land',
      faces: [{ name: 'r-cr115-land', typeLine: 'Land' }],
    });
    const artifact = makeDef({
      scryfallId: 'r-cr115-artifact',
      typeLine: 'Artifact',
      faces: [{ name: 'r-cr115-artifact', typeLine: 'Artifact' }],
    });
    store().newGame(
      [
        { def: source, isCommander: false },
        { def: land, isCommander: false },
        { def: artifact, isCommander: false },
      ],
      1,
    );
    const sourceId = findInstanceId('r-cr115-src');
    const landId = findInstanceId('r-cr115-land');
    const artifactId = findInstanceId('r-cr115-artifact');
    store().moveCard(sourceId, 'battlefield', 'bottom');
    store().moveCard(landId, 'battlefield', 'bottom');
    store().moveCard(artifactId, 'battlefield', 'bottom');

    store().activateAbility(sourceId, 0);
    expect(store().pendingGuided?.mode).toBe('activation');
    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      atom: 'effect.destroy',
      filter: { types: ['permanent'], excludedTypes: ['land'] },
    });

    // 非合法対象(land): コスト未精算 = source untapped・スタック空。
    store().confirmGuidedTarget(landId);
    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().state!.cards[sourceId].tapped).toBe(false);
    expect(store().pendingGuided).toBeNull();

    // 合法対象(artifact): ここで初めてコスト精算 + スタック搭載。
    store().activateAbility(sourceId, 0);
    store().confirmGuidedTarget(artifactId);
    expect(store().state!.zones.stack).toHaveLength(1);
    expect(store().state!.cards[sourceId].tapped).toBe(true);

    store().resolveTop();
    expect(store().state!.cards[artifactId].zone).toBe('graveyard');
  });

  it('another target: source 自身を選ぶと起動せず、別パーマネントでのみ確定(excludeSource)', () => {
    const source = makeDef({
      scryfallId: 'r-cr115-another-src',
      typeLine: 'Artifact Creature',
      faces: [
        {
          name: 'r-cr115-another-src',
          typeLine: 'Artifact Creature',
          oracleText: '{T}: Untap another target permanent you control.',
        },
      ],
    });
    const other = makeDef({
      scryfallId: 'r-cr115-another-other',
      typeLine: 'Artifact',
      faces: [{ name: 'r-cr115-another-other', typeLine: 'Artifact' }],
    });
    store().newGame(
      [
        { def: source, isCommander: false },
        { def: other, isCommander: false },
      ],
      2,
    );
    const sourceId = findInstanceId('r-cr115-another-src');
    const otherId = findInstanceId('r-cr115-another-other');
    store().moveCard(sourceId, 'battlefield', 'bottom');
    store().moveCard(otherId, 'battlefield', 'bottom');
    store().dispatch({ type: 'setTapped', cardId: otherId, tapped: true });

    store().activateAbility(sourceId, 0);
    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      filter: { types: ['permanent'], controller: 'you', excludeSource: true },
    });

    store().confirmGuidedTarget(sourceId);
    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().state!.cards[sourceId].tapped).toBe(false);

    store().activateAbility(sourceId, 0);
    store().confirmGuidedTarget(otherId);
    expect(store().state!.zones.stack).toHaveLength(1);
    expect(store().state!.cards[sourceId].tapped).toBe(true);
    store().resolveTop();
    expect(store().state!.cards[otherId].tapped).toBe(false);
  });

  it("opponent controls: 自分のパーマネントは候補外(controller filter)", () => {
    const source = makeDef({
      scryfallId: 'r-cr115-opp-src',
      typeLine: 'Artifact',
      faces: [
        { name: 'r-cr115-opp-src', typeLine: 'Artifact', oracleText: '{T}: Tap target creature an opponent controls.' },
      ],
    });
    const ownCreature = makeDef({
      scryfallId: 'r-cr115-own-cre',
      typeLine: 'Creature',
      faces: [{ name: 'r-cr115-own-cre', typeLine: 'Creature' }],
    });
    const oppCreature = makeDef({
      scryfallId: 'r-cr115-opp-cre',
      typeLine: 'Creature',
      faces: [{ name: 'r-cr115-opp-cre', typeLine: 'Creature' }],
    });
    store().newGame(
      [
        { def: source, isCommander: false },
        { def: ownCreature, isCommander: false },
        { def: oppCreature, isCommander: false },
      ],
      3,
    );
    const sourceId = findInstanceId('r-cr115-opp-src');
    const ownId = findInstanceId('r-cr115-own-cre');
    const oppId = findInstanceId('r-cr115-opp-cre');
    store().moveCard(sourceId, 'battlefield', 'bottom');
    store().moveCard(ownId, 'battlefield', 'bottom');
    store().moveCard(oppId, 'battlefield', 'bottom');
    setController(oppId, 'OPPONENT_A');

    store().activateAbility(sourceId, 0);
    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      filter: { types: ['creature'], controller: 'opponent' },
    });

    // 自分のクリーチャー = 候補外 → 起動確定せず。
    store().confirmGuidedTarget(ownId);
    expect(store().state!.zones.stack).toHaveLength(0);
    expect(store().state!.cards[sourceId].tapped).toBe(false);

    store().activateAbility(sourceId, 0);
    store().confirmGuidedTarget(oppId);
    expect(store().state!.zones.stack).toHaveLength(1);
    store().resolveTop();
    expect(store().state!.cards[oppId].tapped).toBe(true);
    expect(store().state!.cards[ownId].tapped).toBe(false);
  });
});
