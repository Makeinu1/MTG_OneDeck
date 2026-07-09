/**
 * review.d1-action-catalog — D1 カードシートのアクションモデル契約(レビュー担当専有)。
 *
 * 契約: docs/design-playbook.md §3 D1(b)・docs/ui-architecture-v2.md §2/§4。
 * 検証対象:
 *   1. rankActions の昇格規則(森未タップ→マナ生成先頭 / 手札呪文マナ可→唱える先頭 /
 *      統率者→税表示付き先頭 / マナ不足呪文→昇格されない)。
 *   2. actionCatalog が旧 buildMenuItems の全アクション id を保存(golden 集合)。
 *   3. 純関数性(同一入力→同一出力・入力を変異しない)。
 *
 * これが落ちたら実装(src/components/game/actionCatalog.ts)を直す。
 */

import { describe, it, expect } from 'vitest';
import type { CardInstance } from '../../../engine/types';
import type { CardDef } from '../../../types/card';
import {
  buildCardActionCatalog,
  rankActions,
  type ActionCatalogContext,
} from '../actionCatalog';

function makeDef(overrides: Partial<CardDef> = {}): CardDef {
  return {
    scryfallId: 'def-1',
    oracleId: 'ora-1',
    name: 'Test Card',
    lang: 'en',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine: 'Artifact',
    faces: [{ name: 'Test Card', typeLine: 'Artifact', oracleText: '' }],
    ...overrides,
  };
}

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

function makeCtx(overrides: Partial<ActionCatalogContext> = {}): ActionCatalogContext {
  return {
    card: makeCard(),
    def: makeDef(),
    typeLine: 'Artifact',
    displayName: 'Test Card',
    isCommanderCard: false,
    canAffordCast: true,
    landDropAvailable: true,
    commanderTax: 0,
    ...overrides,
  };
}

const forestDef = makeDef({
  name: 'Forest',
  colorIdentity: ['G'],
  typeLine: 'Basic Land — Forest',
  producedMana: ['G'],
  faces: [{ name: 'Forest', typeLine: 'Basic Land — Forest', oracleText: '({T}: Add {G}.)' }],
});

describe('rankActions 昇格規則(D1)', () => {
  it('未タップの森(戦場)→ マナ生成が先頭(一等地)', () => {
    const ctx = makeCtx({
      card: makeCard({ zone: 'battlefield', tapped: false }),
      def: forestDef,
      typeLine: 'Basic Land — Forest',
      displayName: 'Forest',
    });
    const { specs } = buildCardActionCatalog(ctx);
    const ranked = rankActions(specs);
    expect(ranked[0]?.id).toBe('tapForMana');
  });

  it('手札の呪文(マナ支払可)→ 唱えるが先頭', () => {
    const ctx = makeCtx({
      card: makeCard({ zone: 'hand' }),
      def: makeDef({ name: 'Sol Ring', typeLine: 'Artifact' }),
      typeLine: 'Artifact',
      canAffordCast: true,
    });
    const ranked = rankActions(buildCardActionCatalog(ctx).specs);
    expect(ranked[0]?.id).toBe('cast-to-stack');
  });

  it('マナ不足の唱える→ 昇格されず warn 付きで「その他」に常存', () => {
    const ctx = makeCtx({
      card: makeCard({ zone: 'hand' }),
      def: makeDef({ name: 'Expensive', typeLine: 'Sorcery' }),
      typeLine: 'Sorcery',
      canAffordCast: false,
    });
    const { specs } = buildCardActionCatalog(ctx);
    const ranked = rankActions(specs);
    expect(ranked.some((s) => s.id === 'cast-to-stack')).toBe(false);
    const cast = specs.find((s) => s.id === 'cast-to-stack');
    expect(cast?.warn).toBe(true);
    expect(cast?.priority).toBeUndefined();
  });

  it('統率領域の統率者→ 唱える(統率者税表示)が先頭', () => {
    const ctx = makeCtx({
      card: makeCard({ zone: 'command', isCommander: true }),
      def: makeDef({ name: 'Commander', typeLine: 'Legendary Creature — Human' }),
      typeLine: 'Legendary Creature — Human',
      isCommanderCard: true,
      commanderTax: 4,
      // 統率者はマナ支払可否によらず昇格(規則表 優先1)。
      canAffordCast: false,
    });
    const { specs } = buildCardActionCatalog(ctx);
    const ranked = rankActions(specs);
    expect(ranked[0]?.id).toBe('cast-to-stack');
    expect(ranked[0]?.label).toContain('統率者税 +4');
  });

  it('rankActions は最大3件・priority 降順・同 priority は入力順', () => {
    const specs = [
      { id: 'a', label: 'a' },
      { id: 'b', label: 'b', priority: 50 },
      { id: 'c', label: 'c', priority: 90 },
      { id: 'd', label: 'd', priority: 90 },
      { id: 'e', label: 'e', priority: 10 },
    ];
    const ranked = rankActions(specs);
    expect(ranked.map((s) => s.id)).toEqual(['c', 'd', 'b']);
  });
});

describe('actionCatalog 全アクション id 保存(golden)', () => {
  it('戦場の森は既存 buildMenuItems と同じ id 集合を出す', () => {
    const ctx = makeCtx({
      card: makeCard({ zone: 'battlefield', tapped: false }),
      def: forestDef,
      typeLine: 'Basic Land — Forest',
      displayName: 'Forest',
    });
    const ids = buildCardActionCatalog(ctx).specs.map((s) => s.id);
    expect(new Set(ids)).toEqual(
      new Set([
        'tap',
        'tapForMana',
        'copy-permanent',
        'ability-activate',
        'ability-trigger',
        'card-effects-auto',
        'facedown',
        'counter-plus',
        'counter-minus',
        'move-hand',
        'move-graveyard',
        'move-exile',
        'move-library',
        'move-command',
      ]),
    );
  });

  it('スタック上の呪文は解決/コピー/移動/打ち消しを保存', () => {
    const ctx = makeCtx({
      card: makeCard({ zone: 'stack', isAbility: false }),
      def: makeDef({ typeLine: 'Creature — Beast' }),
      typeLine: 'Creature — Beast',
    });
    const ids = buildCardActionCatalog(ctx).specs.map((s) => s.id);
    for (const id of [
      'stack-resolve-top',
      'stack-resolve-all',
      'stack-copy-effect',
      'stack-copy-permanent',
      'stack-move-battlefield',
      'stack-move-graveyard',
      'stack-move-exile',
      'stack-move-hand',
      'stack-counter',
    ]) {
      expect(ids).toContain(id);
    }
  });

  it('手札の土地は play-land を持ち、土地権が残っていれば昇格する', () => {
    const ctx = makeCtx({
      card: makeCard({ zone: 'hand' }),
      def: forestDef,
      typeLine: 'Basic Land — Forest',
      landDropAvailable: true,
    });
    const { specs } = buildCardActionCatalog(ctx);
    expect(specs.some((s) => s.id === 'play-land')).toBe(true);
    expect(rankActions(specs)[0]?.id).toBe('play-land');
  });
});

describe('actionCatalog 純関数性', () => {
  it('同一入力→同一出力(2回呼んで一致)', () => {
    const ctx = makeCtx({ card: makeCard({ zone: 'battlefield' }), def: forestDef, typeLine: 'Basic Land — Forest' });
    expect(buildCardActionCatalog(ctx)).toEqual(buildCardActionCatalog(ctx));
  });

  it('入力 context / card を変異しない(凍結して呼べる)', () => {
    const card = Object.freeze(makeCard({ zone: 'battlefield', counters: Object.freeze({}) as Record<string, number> }));
    const ctx = Object.freeze(makeCtx({ card, def: forestDef, typeLine: 'Basic Land — Forest' }));
    expect(() => buildCardActionCatalog(ctx)).not.toThrow();
  });
});
