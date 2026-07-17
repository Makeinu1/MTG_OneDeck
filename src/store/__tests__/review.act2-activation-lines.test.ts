/**
 * review.act2-activation-lines — ACT-2 起動ラインの選択と強行(レビュー担当専有)。
 *
 * 契約: engine-spec §34(ACT-2 追補)・CR602.1(「[コスト]: [効果]」)・CR602.2b(起動は
 * 601.2b-i に従う=対象選択とコスト支払)・CR118.3(資源不足のコストは支払えない)。
 *
 * 背景: 複数の起動型能力行を持つカード(MyDeck 実測 48枚・コーパス 946枚)は
 * abilityLineIndexForKind が単一行時のみ index を返すため全 manual 落ちしていた。
 * ACT-2 は UI が行を列挙して abilityLineIndex を明示的に渡す到達性スライス。
 *
 * これが落ちたら実装(engine/grammar・actionCatalog・gameStore)を直す。
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { activatedAbilityLines } from '../../engine/grammar';
import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import { buildCardActionCatalog, type ActionCatalogContext } from '../../components/game/actionCatalog';
import type { CardInstance } from '../../engine/types';
import type { CardDef } from '../../types/card';
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
  const card = Object.values(store().state?.cards ?? {}).find(
    (instance) => instance.defId === defId,
  );
  if (!card) throw new Error(`card instance not found for ${defId}`);
  return card.id;
}

function moveToBattlefield(cardId: string): void {
  store().moveCard(cardId, 'battlefield', 'bottom');
}

function stateSnapshot(): string {
  return JSON.stringify(store().state);
}

/** 2本の起動型行を持つアーティファクト(コストが観測可能に異なる: {T} と 生け贄)。 */
const twoLineDef = makeDef({
  scryfallId: 'act2-two-line',
  typeLine: 'Artifact',
  faces: [
    {
      name: 'act2-two-line',
      typeLine: 'Artifact',
      oracleText: '{T}: Tap target creature.\nSacrifice this artifact: Draw a card.',
    },
  ],
});

/** 起動型行1本(=従来動線を維持すべき非回帰ケース)。 */
const oneLineDef = makeDef({
  scryfallId: 'act2-one-line',
  typeLine: 'Artifact',
  faces: [
    { name: 'act2-one-line', typeLine: 'Artifact', oracleText: '{T}: Tap target creature.' },
  ],
});

function makeCard(overrides: Partial<CardInstance> = {}): CardInstance {
  return {
    id: 'c1',
    defId: 'act2-two-line',
    zone: 'battlefield',
    ownerId: 'P1',
    controllerId: 'P1',
    zoneChangeCounter: 0,
    tapped: false,
    faceIndex: 0,
    faceDown: false,
    counters: {},
    damageMarked: 0,
    hasDeathtouchDamage: false,
    isToken: false,
    isCommander: false,
    enteredTurn: 0,
    ...overrides,
  };
}

function makeCtx(def: CardDef, overrides: Partial<ActionCatalogContext> = {}): ActionCatalogContext {
  return {
    card: makeCard({ defId: def.scryfallId }),
    def,
    typeLine: def.typeLine,
    displayName: def.name,
    isCommanderCard: false,
    canAffordCast: true,
    landDropAvailable: true,
    commanderTax: 0,
    ...overrides,
  };
}

describe('review.act2 — activatedAbilityLines(単一 recognizer)', () => {
  it('CR602.1: 起動型行を flat index つきで列挙し、コスト部と効果部をコロンで分ける', () => {
    const lines = activatedAbilityLines(twoLineDef);
    expect(lines).toHaveLength(2);
    expect(lines[0].costText).toBe('{T}');
    expect(lines[0].effectText).toBe('Tap target creature.');
    expect(lines[1].costText).toBe('Sacrifice this artifact');
    expect(lines[1].effectText).toBe('Draw a card.');
  });

  it('index は splitAbilityLines の flat index 空間(=activateAbility の abilityLineIndex)と一致する', () => {
    // desync 防止(a902a9f 教訓): UI が渡す index は store がそのまま解釈できねばならない。
    const lines = activatedAbilityLines(twoLineDef);
    expect(lines.map((l) => l.index)).toEqual([0, 1]);
  });

  it('起動型でない行(誘発/常在)は列挙しない', () => {
    const mixed = makeDef({
      scryfallId: 'act2-mixed',
      typeLine: 'Creature',
      faces: [
        {
          name: 'act2-mixed',
          typeLine: 'Creature',
          oracleText:
            'Flying\nWhen this creature enters, draw a card.\n{T}: Tap target creature.',
        },
      ],
    });
    const lines = activatedAbilityLines(mixed);
    expect(lines).toHaveLength(1);
    expect(lines[0].costText).toBe('{T}');
  });

  it('表向きフェイスの行だけを列挙する(両面カードで裏面能力を誤提示しない)', () => {
    // splitAbilityLines は全フェイスをフラットに返すため、faceIndex で絞らないと
    // 表面が出ている恒久物に裏面の能力が出る false-affordance が生まれる。
    const dfc = makeDef({
      scryfallId: 'act2-dfc',
      typeLine: 'Creature',
      layout: 'transform',
      faces: [
        { name: 'act2-dfc-front', typeLine: 'Creature', oracleText: '{T}: Tap target creature.' },
        { name: 'act2-dfc-back', typeLine: 'Creature', oracleText: '{2}: Draw a card.' },
      ],
    });
    const front = activatedAbilityLines(dfc, 0);
    expect(front).toHaveLength(1);
    expect(front[0].faceIndex).toBe(0);
    expect(front[0].effectText).toBe('Tap target creature.');

    const back = activatedAbilityLines(dfc, 1);
    expect(back).toHaveLength(1);
    expect(back[0].faceIndex).toBe(1);
    expect(back[0].effectText).toBe('Draw a card.');

    // faceIndex 省略時は全フェイス(engine 内部用)。
    expect(activatedAbilityLines(dfc)).toHaveLength(2);
  });
});

describe('review.act2 — actionCatalog の行列挙', () => {
  it('起動型行が2本以上なら行ごとのアクションをコスト文字列ラベル付きで出す', () => {
    const specs = buildCardActionCatalog(makeCtx(twoLineDef)).specs;
    const perLine = specs.filter((s) => s.id.startsWith('ability-activate-'));
    expect(perLine.map((s) => s.id)).toEqual(['ability-activate-0', 'ability-activate-1']);
    // ラベルはコスト部を含む(どの行かをユーザーがコストで弁別できること)。
    expect(perLine[0].label).toContain('{T}');
    expect(perLine[1].label).toContain('Sacrifice this artifact');
    // testId は id と同形(実機自動操作の命名規約)。
    expect(perLine.map((s) => s.testId)).toEqual(['ability-activate-0', 'ability-activate-1']);
  });

  it('行が2本以上のときは総称 ability-activate を出さない(index 未指定=manual 落ちの死路を残さない)', () => {
    const specs = buildCardActionCatalog(makeCtx(twoLineDef)).specs;
    expect(specs.some((s) => s.id === 'ability-activate')).toBe(false);
  });

  it('起動型行が1本のカードは従来どおり総称 ability-activate のみ(非回帰)', () => {
    const specs = buildCardActionCatalog(makeCtx(oneLineDef)).specs;
    expect(specs.some((s) => s.id === 'ability-activate')).toBe(true);
    expect(specs.some((s) => s.id.startsWith('ability-activate-'))).toBe(false);
  });

  it('起動型行を持たないカードも従来どおり総称 ability-activate を保つ(golden 集合の非回帰)', () => {
    const vanilla = makeDef({
      scryfallId: 'act2-vanilla',
      typeLine: 'Artifact',
      faces: [{ name: 'act2-vanilla', typeLine: 'Artifact', oracleText: '' }],
    });
    const specs = buildCardActionCatalog(makeCtx(vanilla)).specs;
    expect(specs.some((s) => s.id === 'ability-activate')).toBe(true);
    expect(specs.some((s) => s.id.startsWith('ability-activate-'))).toBe(false);
  });

  it('純関数性: 同一 context で同一出力・context を変異しない', () => {
    const ctx = makeCtx(twoLineDef);
    const before = JSON.stringify(ctx);
    const a = buildCardActionCatalog(ctx).specs;
    const b = buildCardActionCatalog(ctx).specs;
    expect(a).toEqual(b);
    expect(JSON.stringify(ctx)).toBe(before);
  });
});

describe('review.act2 — abilityLineIndex 指定で正しい行が起動する', () => {
  beforeEach(() => {
    resetStore();
  });

  it('CR601.2c→601.2h: index 0({T} コスト)は対象確定まで支払わず、確定後にタップされ戦場に残る', () => {
    // CR602.2b により起動は 601.2b-i に従う=対象選択(601.2c)がコスト支払(601.2h)に先行する。
    // ゆえに activateAbility 単独では盤面は動かず、対象確定で初めて {T} が払われる。
    const bear = makeDef({
      scryfallId: 'act2-bear',
      typeLine: 'Creature',
      faces: [{ name: 'act2-bear', typeLine: 'Creature' }],
    });
    store().newGame(
      [
        { def: twoLineDef, isCommander: false },
        { def: bear, isCommander: false },
        ...makeDeck(10),
      ],
      1,
    );
    const sourceId = findInstanceId('act2-two-line');
    const bearId = findInstanceId('act2-bear');
    moveToBattlefield(sourceId);
    moveToBattlefield(bearId);
    store().clearWarnings();
    const beforeActivation = stateSnapshot();

    store().activateAbility(sourceId, 0);

    // 対象選択へ入り、コストはまだ払われていない(=部分実行しない)。
    expect(store().pendingGuided).not.toBeNull();
    expect(stateSnapshot()).toBe(beforeActivation);

    store().confirmGuidedTarget(bearId);

    // 行0 が選ばれた証拠 = {T} が払われ発生源は戦場でタップ(行1 なら墓地へ行く)。
    expect(store().state!.cards[sourceId].tapped).toBe(true);
    expect(store().state!.cards[sourceId].zone).toBe('battlefield');
  });

  it('CR602.2b: index 1(生け贄コスト)を起動すると発生源が墓地へ行きタップされない', () => {
    store().newGame([{ def: twoLineDef, isCommander: false }, ...makeDeck(10)], 1);
    const sourceId = findInstanceId('act2-two-line');
    moveToBattlefield(sourceId);
    store().clearWarnings();

    store().activateAbility(sourceId, 1);

    // 生け贄コストが支払われた=行1が選ばれた証拠(行0なら戦場でタップされるだけ)。
    expect(store().state!.cards[sourceId].zone).toBe('graveyard');
  });
});

describe('review.act2 — 両面カードは表を向いている面の能力だけを持つ(CR712.8d/712.8f)', () => {
  beforeEach(() => {
    resetStore();
  });

  /** Pathway 型 MDFC(実カード10種の構造): 表 {T}: Add {G} / 裏 {T}: Add {U}。 */
  const pathwayDef = makeDef({
    scryfallId: 'act2-pathway',
    typeLine: 'Land',
    layout: 'modal_dfc',
    faces: [
      { name: 'act2-pathway-front', typeLine: 'Land', oracleText: '{T}: Add {G}.' },
      { name: 'act2-pathway-back', typeLine: 'Land', oracleText: '{T}: Add {U}.' },
    ],
  });

  it('表面に起動型行が1本なら、index 未指定でもその行に解決し manual 落ちしない', () => {
    // CR712.8d/712.8f: 表を向いている面の特性のみを持つ=裏面の能力は「存在しない」。
    // 全面を数えて「2本あるから曖昧」と undefined を返すと、UI 上は曖昧性ゼロ(ボタン1個)
    // なのに store だけが manual へ落ちる desync が生まれる(実カード43枚・Pathway 全10種)。
    store().newGame([{ def: pathwayDef, isCommander: false }, ...makeDeck(10)], 1);
    const sourceId = findInstanceId('act2-pathway');
    moveToBattlefield(sourceId);
    store().clearWarnings();

    store().activateAbility(sourceId);

    expect(store().warnings.join('\n')).not.toContain('手払い');
    expect(store().state!.cards[sourceId].tapped).toBe(true);
    // 表面の色が出る(裏面の {U} ではない)。
    expect(store().state!.manaPool.G).toBe(1);
    expect(store().state!.manaPool.U).toBe(0);
  });

  it('裏面を向けているときは裏面の行に解決する', () => {
    store().newGame([{ def: pathwayDef, isCommander: false }, ...makeDeck(10)], 1);
    const sourceId = findInstanceId('act2-pathway');
    moveToBattlefield(sourceId);
    store().dispatch({ type: 'setFace', cardId: sourceId, faceIndex: 1 });
    store().clearWarnings();

    store().activateAbility(sourceId);

    expect(store().warnings.join('\n')).not.toContain('手払い');
    expect(store().state!.manaPool.U).toBe(1);
    expect(store().state!.manaPool.G).toBe(0);
  });
});

describe('review.act2 — 支払えないコストの強行(サンドボックス哲学)', () => {
  beforeEach(() => {
    resetStore();
  });

  function setupTappedSource(): string {
    const bear = makeDef({
      scryfallId: 'act2-bear2',
      typeLine: 'Creature',
      faces: [{ name: 'act2-bear2', typeLine: 'Creature' }],
    });
    store().newGame(
      [
        { def: twoLineDef, isCommander: false },
        { def: bear, isCommander: false },
        ...makeDeck(10),
      ],
      1,
    );
    const sourceId = findInstanceId('act2-two-line');
    moveToBattlefield(sourceId);
    moveToBattlefield(findInstanceId('act2-bear2'));
    store().toggleTap(sourceId); // すでにタップ済み={T} コストは CR118.3 で支払えない
    store().clearWarnings();
    return sourceId;
  }

  it('CR118.3: タップ済み発生源の {T} 行は盤面を変えずブロックし、強行候補を提示する', () => {
    const sourceId = setupTappedSource();
    const before = stateSnapshot();

    store().activateAbility(sourceId, 0);

    // 盤面は不変(部分実行しない=CR602.2 アトミック性)。
    expect(stateSnapshot()).toBe(before);
    expect(store().warnings.length).toBeGreaterThan(0);
    // UI が強行を提示できるよう、対象の行つきで pending 状態を持つ。
    expect(store().pendingForceActivation).not.toBeNull();
    expect(store().pendingForceActivation!.sourceId).toBe(sourceId);
    expect(store().pendingForceActivation!.abilityLineIndex).toBe(0);
    expect(store().pendingForceActivation!.warnings.length).toBeGreaterThan(0);
  });

  it('confirmForceActivation で強行でき、CR-legal でない旨が記録され pending が解ける', () => {
    const sourceId = setupTappedSource();
    store().activateAbility(sourceId, 0);
    store().clearWarnings();

    store().confirmForceActivation();

    expect(store().pendingForceActivation).toBeNull();
    // 強行はスタックへ到達する(対象選択は強行でも省略しない=CR115.1c/602.2b)。
    const reached =
      store().pendingGuided !== null || store().state!.zones.stack.length > 0;
    expect(reached).toBe(true);
    expect(store().warnings.some((w) => w.includes('CR-legal'))).toBe(true);
  });

  it('cancelForceActivation は盤面を変えず pending を解くだけ', () => {
    const sourceId = setupTappedSource();
    store().activateAbility(sourceId, 0);
    const before = stateSnapshot();

    store().cancelForceActivation();

    expect(store().pendingForceActivation).toBeNull();
    expect(stateSnapshot()).toBe(before);
  });

  it('支払える起動では強行 pending を作らない(誤ダイアログを出さない)', () => {
    store().newGame([{ def: twoLineDef, isCommander: false }, ...makeDeck(10)], 1);
    const sourceId = findInstanceId('act2-two-line');
    moveToBattlefield(sourceId);
    store().clearWarnings();

    store().activateAbility(sourceId, 1);

    expect(store().pendingForceActivation).toBeNull();
  });
});
