/**
 * review.d3-primary-feed — D3 プライマリアクション/プレイ可能/フィードの純関数層ピン(レビュー専有)。
 * 契約: docs/design-playbook.md §3 D3(b)。これが落ちたら実装(src/components/game/*.ts)を直す。
 */

import { describe, it, expect } from 'vitest';
import { primaryActionModel } from '../primaryAction';
import { canAfford, availableManaUnits, playableHandCardIds, type ManaUnit } from '../affordability';
import { projectFeed, feedUnseenCount } from '../feedProjection';
import { parseManaCost } from '../../../engine/mana';
import { initGame } from '../../../engine/init';
import { applyCommand } from '../../../engine/commands';
import { makeDef } from '../../../engine/__tests__/helpers';
import type { GameState, CombatState, LogEntry } from '../../../engine/types';
import type { ManaColor } from '../../../types/card';
import type { TriggerCandidate } from '../../../engine/triggers';
import type { InitDeckCard } from '../../../engine/init';

const u = (...colors: ManaColor[]): ManaUnit => new Set(colors);

describe('primaryActionModel state machine (playbook §3 D3(1))', () => {
  function baseState(): GameState {
    const deck: InitDeckCard[] = [
      { def: makeDef({ scryfallId: 'cmd', typeLine: 'Legendary Creature' }), isCommander: true },
    ];
    for (let i = 0; i < 10; i++) deck.push({ def: makeDef({ scryfallId: `c${i}` }), isCommander: false });
    return initGame(deck, 1);
  }

  it('① スタック非空 → スタックを解決(残n)・glow', () => {
    const s = { ...baseState(), zones: { ...baseState().zones, stack: ['a', 'b'] } };
    const m = primaryActionModel(s, 3);
    expect(m.kind).toBe('resolve');
    expect(m.label).toBe('スタックを解決 (2)');
    expect(m.glow).toBe(true);
  });

  it('② スタック空 + 誘発候補n>0 → 誘発を処理(n)', () => {
    const s = baseState();
    const m = primaryActionModel(s, 2);
    expect(m.kind).toBe('triggers');
    expect(m.label).toBe('誘発を処理 (2)');
  });

  it('③ 戦闘フェイズ・攻撃宣言前(combat=null)・攻撃可能0 → 攻撃せず進む(skip-combat)', () => {
    // engine は combat フェイズ突入時 state.combat=null(declareAttack が enterCombat を含む)。
    // 契約変更(ユーザー裁定 2026-07-20): 攻撃可能クリーチャー0体は戦闘スキップを提示。
    const s: GameState = { ...baseState(), phase: 'combat', combat: null };
    const m = primaryActionModel(s, 0);
    expect(m.kind).toBe('skip-combat');
    expect(m.label).toBe('攻撃せず進む');
  });

  it('③b 戦闘フェイズ・攻撃可能n>0 → n体で攻撃(attack)', () => {
    // 契約変更(ユーザー裁定 2026-07-20): 攻撃可能クリーチャーn体を事前選択して攻撃ダイアログへ。
    let s = baseState();
    const def = makeDef({ scryfallId: 'attacker', typeLine: 'Creature', faces: [{ name: 'Attacker', typeLine: 'Creature', power: '2', toughness: '2' }] });
    s = { ...s, defs: { ...s.defs, attacker: def } };
    const attackerId = 'c-attacker';
    s = {
      ...s,
      cards: {
        ...s.cards,
        [attackerId]: {
          ...s.cards[Object.keys(s.cards)[0]],
          id: attackerId,
          defId: 'attacker',
          zone: 'battlefield',
          controllerId: s.localPlayerId,
          tapped: false,
          enteredTurn: 0,
        },
      },
      zones: { ...s.zones, battlefield: [...s.zones.battlefield, attackerId] },
      phase: 'combat',
      combat: null,
    };
    const m = primaryActionModel(s, 0);
    expect(m.kind).toBe('attack');
    expect(m.label).toBe('1体で攻撃');
    expect(m.eligibleAttackers).toBe(1);
  });

  it('攻撃宣言後(combat.step=declareBlockers)は攻撃を確定にせず次へ', () => {
    const combat: CombatState = {
      combatId: 'x', turn: 1, step: 'declareBlockers',
      attackingPlayerId: 'P1', defendingPlayerId: 'OPPONENT_A', attackers: [], blockers: [],
    };
    const s: GameState = { ...baseState(), phase: 'combat', combat };
    expect(primaryActionModel(s, 0).kind).toBe('next-phase');
  });

  it('④ 平時 → 次のフェイズ', () => {
    const m = primaryActionModel(baseState(), 0);
    expect(m.kind).toBe('next-phase');
    expect(m.label).toBe('次のフェイズ →');
  });

  it('スタック優先が誘発・戦闘より上(未解決中のフェイズ移動禁止の構造表現)', () => {
    const base = baseState();
    const s: GameState = { ...base, phase: 'combat', combat: null, zones: { ...base.zones, stack: ['a'] } };
    expect(primaryActionModel(s, 5).kind).toBe('resolve');
  });
});

describe('canAfford mana solver (playbook §3 D3(2))', () => {
  it('{1}{G} は G源2つで支払える(色1+不特定1)', () => {
    expect(canAfford(parseManaCost('{1}{G}'), [u('G'), u('G')])).toBe(true);
  });
  it('{G}{G} は G源1つでは払えない', () => {
    expect(canAfford(parseManaCost('{G}{G}'), [u('G')])).toBe(false);
  });
  it('{2} は色を問わず2源で払える', () => {
    expect(canAfford(parseManaCost('{2}'), [u('G'), u('U')])).toBe(true);
    expect(canAfford(parseManaCost('{2}'), [u('G')])).toBe(false);
  });
  it('{U} は G源では払えない(色拘束)', () => {
    expect(canAfford(parseManaCost('{U}'), [u('G')])).toBe(false);
    expect(canAfford(parseManaCost('{U}'), [u('U')])).toBe(true);
  });
  it('ハイブリッド {G/U} はどちらか一色の源で払える', () => {
    expect(canAfford(parseManaCost('{G/U}'), [u('U')])).toBe(true);
    expect(canAfford(parseManaCost('{G/U}'), [u('W')])).toBe(false);
  });
  it('無色 {C} は色マナでは払えない', () => {
    expect(canAfford(parseManaCost('{C}'), [u('G')])).toBe(false);
    expect(canAfford(parseManaCost('{C}'), [u('C')])).toBe(true);
  });
  it('多色源(統率の塔型)は最も逼迫した色要求に割り当てられる', () => {
    // {W}{U} を Command Tower(WUBRG)2つで。
    expect(canAfford(parseManaCost('{W}{U}'), [u('W', 'U', 'B', 'R', 'G'), u('W', 'U', 'B', 'R', 'G')])).toBe(true);
    expect(canAfford(parseManaCost('{W}{U}'), [u('W', 'U', 'B', 'R', 'G')])).toBe(false);
  });
  it('phyrexian {G/P} はマナ0でも払える(ライフ払い)', () => {
    expect(canAfford(parseManaCost('{G/P}'), [])).toBe(true);
  });
  it('monoHybrid {2/W} は色でも不特定2でも払える(過小評価しない)', () => {
    expect(canAfford(parseManaCost('{2/W}'), [u('W')])).toBe(true); // 色1つ
    expect(canAfford(parseManaCost('{2/W}'), [u('U'), u('U')])).toBe(true); // 不特定2
    expect(canAfford(parseManaCost('{2/W}'), [u('U')])).toBe(false); // どちらも不可
  });
  it('X は 0 として扱う({X}{G} は G源1つで可)', () => {
    expect(canAfford(parseManaCost('{X}{G}'), [u('G')])).toBe(true);
  });
});

describe('availableManaUnits / playableHandCardIds (state-backed)', () => {
  function setupState(): { state: GameState; creatureId: string; forestIds: string[] } {
    const forest = makeDef({ scryfallId: 'forest', typeLine: 'Basic Land — Forest', producedMana: ['G'] });
    const bear = makeDef({
      scryfallId: 'bear', typeLine: 'Creature — Bear',
      faces: [{ name: 'bear', typeLine: 'Creature — Bear', manaCost: '{1}{G}' }],
    });
    const deck: InitDeckCard[] = [
      { def: makeDef({ scryfallId: 'cmd', typeLine: 'Legendary Creature' }), isCommander: true },
    ];
    for (let i = 0; i < 4; i++) deck.push({ def: forest, isCommander: false });
    for (let i = 0; i < 4; i++) deck.push({ def: bear, isCommander: false });
    const s = initGame(deck, 1);
    const isForest = (id: string) => (s.defs[s.cards[id].defId].faces[0].typeLine ?? '').includes('Forest');
    const isBear = (id: string) => (s.defs[s.cards[id].defId].faces[0].typeLine ?? '').includes('Bear');
    const forestIds = s.zones.library.filter(isForest).slice(0, 2);
    const creatureId = s.zones.library.find(isBear)!;
    return { state: s, creatureId, forestIds };
  }

  it('未タップのマナ源を利用可能マナに数える', () => {
    const { state, forestIds } = setupState();
    let s = state;
    forestIds.forEach((id) => {
      s = applyCommand(s, { type: 'moveCard', cardId: id, to: 'battlefield', position: 'top' }).state;
    });
    expect(availableManaUnits(s).length).toBe(2);
    // 1つタップすると1減る。
    s = applyCommand(s, { type: 'setTapped', cardId: forestIds[0], tapped: true }).state;
    expect(availableManaUnits(s).length).toBe(1);
  });

  it('{1}{G} クリーチャーは森1つでは非プレイ可・森2つでプレイ可', () => {
    const { state, forestIds, creatureId } = setupState();
    let s = applyCommand(state, { type: 'moveCard', cardId: creatureId, to: 'hand', position: 'top' }).state;
    // 森1つ: {1}{G} は払えない(源1つ=色G充当で不特定1が残る)。
    s = applyCommand(s, { type: 'moveCard', cardId: forestIds[0], to: 'battlefield', position: 'top' }).state;
    expect(playableHandCardIds(s).has(creatureId)).toBe(false);
    // 森2つ: プレイ可。
    s = applyCommand(s, { type: 'moveCard', cardId: forestIds[1], to: 'battlefield', position: 'top' }).state;
    expect(playableHandCardIds(s).has(creatureId)).toBe(true);
  });
});

describe('projectFeed / feedUnseenCount (投影・純粋)', () => {
  const log: LogEntry[] = [
    { seq: 1, turn: 1, phase: 'main1', message: 'A' },
    { seq: 2, turn: 1, phase: 'main1', message: 'B' },
  ];
  const triggers: TriggerCandidate[] = [{ sourceId: 's1', triggerId: 't1', label: '誘発1' }];
  const warnings = ['警告1'];

  it('誘発→警告→ログ(新しい順)の順で投影する', () => {
    const items = projectFeed(warnings, triggers, log);
    expect(items.map((i) => i.kind)).toEqual(['trigger', 'warn', 'log', 'log']);
    expect(items[0].text).toBe('誘発1');
    expect(items[0].sourceId).toBe('s1');
    // ログは新しい順(seq降順)。
    expect(items[2].text).toBe('B');
    expect(items[3].text).toBe('A');
  });

  it('undo でログが縮むと項目数も縮む(独自真実を持たない)', () => {
    const before = projectFeed([], [], log);
    const after = projectFeed([], [], log.slice(0, 1));
    expect(before.filter((i) => i.kind === 'log')).toHaveLength(2);
    expect(after.filter((i) => i.kind === 'log')).toHaveLength(1);
  });

  it('未読件数 = 誘発候補 + 警告', () => {
    expect(feedUnseenCount(warnings, triggers)).toBe(2);
    expect(feedUnseenCount([], [])).toBe(0);
  });

  it('純粋: 入力を変異しない', () => {
    const snap = JSON.stringify({ warnings, triggers, log });
    projectFeed(warnings, triggers, log);
    expect(JSON.stringify({ warnings, triggers, log })).toBe(snap);
  });
});
