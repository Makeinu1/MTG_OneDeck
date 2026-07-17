/**
 * review.act1-mana-shortcut-cost — ACT-1 マナ経路のコスト整合(レビュー担当専有)。
 *
 * 契約: 追加コスト付きの起動型マナ能力(例: 《睡蓮の花びら》 "{T}, Sacrifice this
 * artifact: Add one mana of any color.")を、producedMana メタデータ駆動の
 * ショートカット経路(tapForMana / planAutoTap / actionCatalog の「マナを生成して
 * タップ」)が迂回してはならない。コストを伴うマナ能力は一般経路
 * (activateAbility → §34.11 mana transaction)へルーティングし、コスト支払いを
 * アトミックに行う。
 *
 * CR根拠: CR118.3(コストの部分払い不可)/ CR602.2(起動はコスト支払いと一体)/
 * CR605.1a(マナ能力はスタック非経由)。
 *
 * naive(ショートカット)適格の定義:
 *   - カードに起動型 add-mana 行が1本も無い → producedMana メタデータで従来どおり
 *     (基本土地のリマインダーテキスト・誘発型生成者の fallback)。
 *   - 起動型 add-mana 行がある → コストが正確に "{T}" だけの行(pure line)の
 *     色集合のみ naive 適格。pure line の色 = リテラルシンボルの和集合、
 *     リテラルが無い(any color 等)場合はその行に限り producedMana。
 *   - pure line が1本も無い(Lotus Petal 型・filter 型)→ naive 不適格 =
 *     autotap 候補から除外・tapForMana は一般経路へ委譲・カタログは
 *     tapForMana を出さない。
 *
 * スコープ外(現状維持を本テストで pin): ペインランドの効果内ダメージ等、
 * pure line の効果ライダーは ACT-1 では扱わない(コスト迂回のみが対象)。
 *
 * これが落ちたら実装(src/engine/autotap.ts / src/store/gameStore.ts /
 * src/components/game/actionCatalog.ts / 共有 recognizer)を直す。
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { planAutoTap } from '../../engine/autotap';
import { parseManaCost } from '../../engine/mana';
import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import type { CardInstance } from '../../engine/types';
import type { CardDef } from '../../types/card';
import {
  buildCardActionCatalog,
  type ActionCatalogContext,
} from '../../components/game/actionCatalog';
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
  if (!card) {
    throw new Error(`card instance not found for ${defId}`);
  }
  return card.id;
}

function moveToBattlefield(cardId: string): void {
  store().moveCard(cardId, 'battlefield', 'bottom');
}

function poolTotal(): number {
  const pool = store().state!.manaPool;
  return pool.W + pool.U + pool.B + pool.R + pool.G + pool.C;
}

// --- fixtures(名前は既存 recognizer の正規表現と偶然一致しない act1- 接頭辞) ---

function lotusPetalDef(): CardDef {
  return makeDef({
    scryfallId: 'act1-lotus-petal',
    typeLine: 'Artifact',
    producedMana: ['W', 'U', 'B', 'R', 'G'],
    faces: [
      {
        name: 'act1-lotus-petal',
        typeLine: 'Artifact',
        oracleText: '{T}, Sacrifice this artifact: Add one mana of any color.',
      },
    ],
  });
}

function solRingDef(): CardDef {
  return makeDef({
    scryfallId: 'act1-sol-ring',
    typeLine: 'Artifact',
    producedMana: ['C'],
    faces: [
      {
        name: 'act1-sol-ring',
        typeLine: 'Artifact',
        oracleText: '{T}: Add {C}{C}.',
      },
    ],
  });
}

function reminderForestDef(): CardDef {
  return makeDef({
    scryfallId: 'act1-forest',
    typeLine: 'Basic Land — Forest',
    producedMana: ['G'],
    faces: [
      {
        name: 'act1-forest',
        typeLine: 'Basic Land — Forest',
        oracleText: '({T}: Add {G}.)',
      },
    ],
  });
}

function painlandDef(): CardDef {
  return makeDef({
    scryfallId: 'act1-painland',
    typeLine: 'Land',
    producedMana: ['C', 'R', 'W'],
    faces: [
      {
        name: 'act1-painland',
        typeLine: 'Land',
        oracleText: '{T}: Add {C}.\n{T}: Add {R} or {W}. act1-painland deals 1 damage to you.',
      },
    ],
  });
}

function filterLandDef(): CardDef {
  return makeDef({
    scryfallId: 'act1-filter-land',
    typeLine: 'Land',
    producedMana: ['W'],
    faces: [
      {
        name: 'act1-filter-land',
        typeLine: 'Land',
        oracleText: '{1}, {T}: Add {W}{W}.',
      },
    ],
  });
}

function vividLandDef(): CardDef {
  return makeDef({
    scryfallId: 'act1-vivid-land',
    typeLine: 'Land',
    producedMana: ['W', 'U', 'B', 'R', 'G'],
    faces: [
      {
        name: 'act1-vivid-land',
        typeLine: 'Land',
        oracleText:
          '{T}: Add {U}.\n{T}, Remove a charge counter from act1-vivid-land: Add one mana of any color.',
      },
    ],
  });
}

// Tier-1 監査(2026-07-17)の false-costed 指摘2件を判定者裁定で pin:
// (a) ability-word ラベル(CR207.2c=ルール上の意味なし)は純度判定前に剥がす
// (b) 基本土地タイプの内在マナ能力(CR305.6)はタイプ行から常に naive 色へ付与
//     (リマインダー行は sanitize で消えるため oracle 文からは復元できない)

function moxOpalLikeDef(): CardDef {
  return makeDef({
    scryfallId: 'act1-metalcraft-mox',
    typeLine: 'Artifact',
    producedMana: ['W', 'U', 'B', 'R', 'G'],
    faces: [
      {
        name: 'act1-metalcraft-mox',
        typeLine: 'Artifact',
        oracleText:
          'Metalcraft — {T}: Add one mana of any color. Activate only if you control three or more artifacts.',
      },
    ],
  });
}

function murmuringBoskLikeDef(): CardDef {
  return makeDef({
    scryfallId: 'act1-bosk',
    typeLine: 'Land — Forest',
    producedMana: ['W', 'B', 'G'],
    faces: [
      {
        name: 'act1-bosk',
        typeLine: 'Land — Forest',
        oracleText: '({T}: Add {G}.)\n{T}: Add {W} or {B}. act1-bosk deals 1 damage to you.',
      },
    ],
  });
}

function newGameWith(defs: CardDef[]): void {
  store().newGame(
    [...defs.map((def) => ({ def, isCommander: false })), ...makeDeck(10)],
    1,
  );
}

describe('review.act1: planAutoTap はコスト付きマナ能力を勝手に支払わない(CR118.3)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('Lotus Petal 型(tap+自己生け贄)は自動タップ候補にならない', () => {
    newGameWith([lotusPetalDef()]);
    const petalId = findInstanceId('act1-lotus-petal');
    moveToBattlefield(petalId);

    const plan = planAutoTap(store().state!, parseManaCost('{1}'), 0);
    expect(plan.taps.some((tap) => tap.cardId === petalId)).toBe(false);
    expect(plan.ok).toBe(false);
  });

  it('filter 型({1},{T})は自動タップ候補にならない', () => {
    newGameWith([filterLandDef()]);
    const filterId = findInstanceId('act1-filter-land');
    moveToBattlefield(filterId);

    const plan = planAutoTap(store().state!, parseManaCost('{W}'), 0);
    expect(plan.taps.some((tap) => tap.cardId === filterId)).toBe(false);
    expect(plan.ok).toBe(false);
  });

  it('純 {T} のマナ能力(Sol Ring 型)は従来どおり自動タップされる', () => {
    newGameWith([solRingDef()]);
    const solId = findInstanceId('act1-sol-ring');
    moveToBattlefield(solId);

    const plan = planAutoTap(store().state!, parseManaCost('{1}'), 0);
    expect(plan.ok).toBe(true);
    expect(plan.taps.some((tap) => tap.cardId === solId)).toBe(true);
  });

  it('リマインダーテキストのみの基本土地は metadata fallback で従来どおり動く', () => {
    newGameWith([reminderForestDef()]);
    const forestId = findInstanceId('act1-forest');
    moveToBattlefield(forestId);

    const plan = planAutoTap(store().state!, parseManaCost('{G}'), 0);
    expect(plan.ok).toBe(true);
    expect(plan.taps.some((tap) => tap.cardId === forestId)).toBe(true);
  });

  it('pure 行と costed 行が混在するカードは pure 行の色だけ自動タップ可', () => {
    newGameWith([vividLandDef()]);
    const vividId = findInstanceId('act1-vivid-land');
    moveToBattlefield(vividId);

    const planU = planAutoTap(store().state!, parseManaCost('{U}'), 0);
    expect(planU.ok).toBe(true);
    expect(planU.taps.some((tap) => tap.cardId === vividId)).toBe(true);

    const planR = planAutoTap(store().state!, parseManaCost('{R}'), 0);
    expect(planR.taps.some((tap) => tap.cardId === vividId)).toBe(false);
    expect(planR.ok).toBe(false);
  });

  it('ペインランド(全行 pure {T})は従来どおり全色で自動タップ可(効果ライダーはスコープ外)', () => {
    newGameWith([painlandDef()]);
    const painId = findInstanceId('act1-painland');
    moveToBattlefield(painId);

    const plan = planAutoTap(store().state!, parseManaCost('{R}'), 0);
    expect(plan.ok).toBe(true);
    expect(plan.taps.some((tap) => tap.cardId === painId)).toBe(true);
  });
});

describe('review.act1: tapForMana はコスト付きマナ能力を一般経路へ委譲する(CR602.2)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('Lotus Petal 型: naive tap+add は発生せず、一般経路の guided へ委譲される', () => {
    newGameWith([lotusPetalDef()]);
    const petalId = findInstanceId('act1-lotus-petal');
    moveToBattlefield(petalId);
    store().clearWarnings();

    const result = store().tapForMana(petalId);

    // naive 経路での盤面変更ゼロ(コスト未払いのマナ加算・タップは禁止)
    expect(result).toBe('ok');
    expect(poolTotal()).toBe(0);
    expect(store().state!.cards[petalId].zone).toBe('battlefield');
    expect(store().state!.cards[petalId].tapped).toBe(false);
    // 一般経路(§34.11 mana-ability guided)に到達している
    expect(store().pendingGuided?.mode).toBe('mana-ability');

    store().confirmGuidedMana('B');

    // コスト(タップ+生け贄)と効果(マナ加算)がアトミックに完遂
    expect(store().pendingGuided).toBeNull();
    expect(store().state!.cards[petalId].zone).toBe('graveyard');
    expect(store().state!.manaPool.B).toBe(1);
    expect(store().state!.zones.stack).toHaveLength(0);
  });

  it('Lotus Petal 型: 明示色つき呼び出しでも naive add はしない', () => {
    newGameWith([lotusPetalDef()]);
    const petalId = findInstanceId('act1-lotus-petal');
    moveToBattlefield(petalId);
    store().clearWarnings();

    store().tapForMana(petalId, 'R');

    expect(poolTotal()).toBe(0);
    expect(store().state!.cards[petalId].zone).toBe('battlefield');
    expect(store().state!.cards[petalId].tapped).toBe(false);
  });

  it('Sol Ring 型(純 {T}): 従来どおり naive でタップ+{C}{C}', () => {
    newGameWith([solRingDef()]);
    const solId = findInstanceId('act1-sol-ring');
    moveToBattlefield(solId);
    store().clearWarnings();

    const result = store().tapForMana(solId);

    expect(result).toBe('ok');
    expect(store().state!.cards[solId].tapped).toBe(true);
    expect(store().state!.manaPool.C).toBe(2);
    expect(store().state!.cards[solId].zone).toBe('battlefield');
    expect(store().pendingGuided).toBeNull();
  });

  it('リマインダーテキストのみの基本土地: metadata fallback で従来どおり', () => {
    newGameWith([reminderForestDef()]);
    const forestId = findInstanceId('act1-forest');
    moveToBattlefield(forestId);
    store().clearWarnings();

    const result = store().tapForMana(forestId);

    expect(result).toBe('ok');
    expect(store().state!.cards[forestId].tapped).toBe(true);
    expect(store().state!.manaPool.G).toBe(1);
  });

  it('ペインランド: 従来どおり needs-choice → 明示色で naive タップ', () => {
    newGameWith([painlandDef()]);
    const painId = findInstanceId('act1-painland');
    moveToBattlefield(painId);
    store().clearWarnings();

    expect(store().tapForMana(painId)).toBe('needs-choice');
    expect(store().tapForMana(painId, 'R')).toBe('ok');
    expect(store().state!.cards[painId].tapped).toBe(true);
    expect(store().state!.manaPool.R).toBe(1);
  });

  it('pure/costed 混在(Vivid 型): pure 色は naive 可・costed 専用色は naive 不可', () => {
    newGameWith([vividLandDef()]);
    const vividId = findInstanceId('act1-vivid-land');
    moveToBattlefield(vividId);
    store().clearWarnings();

    // costed 行でしか出せない色: naive add してはならない(カウンター除去の迂回)
    store().tapForMana(vividId, 'R');
    expect(store().state!.manaPool.R).toBe(0);
    expect(store().state!.cards[vividId].tapped).toBe(false);
    expect(store().state!.cards[vividId].zone).toBe('battlefield');

    resetStore();
    newGameWith([vividLandDef()]);
    const vividId2 = findInstanceId('act1-vivid-land');
    moveToBattlefield(vividId2);
    store().clearWarnings();

    // pure 行の色は従来どおり naive
    expect(store().tapForMana(vividId2, 'U')).toBe('ok');
    expect(store().state!.cards[vividId2].tapped).toBe(true);
    expect(store().state!.manaPool.U).toBe(1);
  });

  it('ability-word ラベル(Metalcraft — {T}:)は純度判定を落とさない(CR207.2c)', () => {
    // 「Activate only if ...」の起動制限は本スライスのスコープ外
    // (修正前の naive 経路も未検査だった=サンドボックス現状維持)。
    newGameWith([moxOpalLikeDef()]);
    const moxId = findInstanceId('act1-metalcraft-mox');
    moveToBattlefield(moxId);
    store().clearWarnings();

    expect(store().tapForMana(moxId)).toBe('needs-choice');
    expect(store().tapForMana(moxId, 'U')).toBe('ok');
    expect(store().state!.cards[moxId].tapped).toBe(true);
    expect(store().state!.manaPool.U).toBe(1);
    expect(store().state!.cards[moxId].zone).toBe('battlefield');
  });

  it('基本土地タイプの内在マナ能力(CR305.6): Murmuring Bosk 型は G を失わない', () => {
    // リマインダー行 ({T}: Add {G}.) は sanitize で消えるが、タイプ行 Forest が
    // 内在 {T}: Add {G} を与える(CR305.6)。別の pure 行(W/B)とも併存する。
    newGameWith([murmuringBoskLikeDef()]);
    const boskId = findInstanceId('act1-bosk');
    moveToBattlefield(boskId);
    store().clearWarnings();

    expect(store().tapForMana(boskId, 'G')).toBe('ok');
    expect(store().state!.cards[boskId].tapped).toBe(true);
    expect(store().state!.manaPool.G).toBe(1);

    resetStore();
    newGameWith([murmuringBoskLikeDef()]);
    const boskId2 = findInstanceId('act1-bosk');
    moveToBattlefield(boskId2);
    store().clearWarnings();

    expect(store().tapForMana(boskId2, 'W')).toBe('ok');
    expect(store().state!.manaPool.W).toBe(1);
  });

  it('内在マナ能力は planAutoTap でも使える(CR305.6)', () => {
    newGameWith([murmuringBoskLikeDef()]);
    const boskId = findInstanceId('act1-bosk');
    moveToBattlefield(boskId);

    const plan = planAutoTap(store().state!, parseManaCost('{G}'), 0);
    expect(plan.ok).toBe(true);
    expect(plan.taps.some((tap) => tap.cardId === boskId)).toBe(true);
  });

  it('一般経路そのもの: activateAbility は Lotus Petal の生け贄コストを支払う', () => {
    newGameWith([lotusPetalDef()]);
    const petalId = findInstanceId('act1-lotus-petal');
    moveToBattlefield(petalId);
    store().clearWarnings();

    store().activateAbility(petalId, 0);
    expect(store().pendingGuided?.mode).toBe('mana-ability');
    // guided 確定までは一切 commit しない(CR118.3 アトミック性)
    expect(poolTotal()).toBe(0);
    expect(store().state!.cards[petalId].zone).toBe('battlefield');

    store().confirmGuidedMana('G');

    expect(store().state!.cards[petalId].zone).toBe('graveyard');
    expect(store().state!.manaPool.G).toBe(1);
    expect(store().state!.zones.stack).toHaveLength(0);
  });
});

describe('review.act1: actionCatalog はコスト付きマナ能力に naive アクションを出さない', () => {
  function makeCard(overrides: Partial<CardInstance> = {}): CardInstance {
    return {
      id: 'c1',
      defId: 'def-1',
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

  function ctxFor(def: CardDef): ActionCatalogContext {
    return {
      card: makeCard({ defId: def.scryfallId }),
      def,
      typeLine: def.typeLine,
      displayName: def.name,
      isCommanderCard: false,
      canAffordCast: true,
      landDropAvailable: true,
      commanderTax: 0,
    };
  }

  function actionIds(def: CardDef): string[] {
    return buildCardActionCatalog(ctxFor(def)).specs.map((spec) => spec.id);
  }

  it('Lotus Petal 型: tapForMana を出さず、能力起動の動線は残る', () => {
    const ids = actionIds(lotusPetalDef());
    expect(ids).not.toContain('tapForMana');
    expect(ids).toContain('ability-activate');
  });

  it('filter 型: tapForMana を出さない', () => {
    expect(actionIds(filterLandDef())).not.toContain('tapForMana');
  });

  it('純 {T} と fallback(基本土地)は従来どおり tapForMana を出す', () => {
    expect(actionIds(solRingDef())).toContain('tapForMana');
    expect(actionIds(reminderForestDef())).toContain('tapForMana');
    expect(actionIds(painlandDef())).toContain('tapForMana');
    expect(actionIds(vividLandDef())).toContain('tapForMana');
  });
});
