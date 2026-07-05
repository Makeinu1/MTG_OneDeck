// Reviewer-owned adversarial tests for cr-701 generic ramp search resolution (store).
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// CR grounding:
// - CR 701.24b: search→shuffle→move の found カードは shuffle 対象から除外(library に残さない)。
// - CR 701.23a: filter(basic-land / land-subtype)に合わないカードは選べない(guided rejection)。
// - CR 701.23d: 見つけられない/見つけない(0枚)は合法=shuffle だけ実行してよい。
// - 決定論(engine 不変): shuffle 順列は confirm 時(コマンド生成)に確定し applyCommand は RNG 非使用。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
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

function ramp(oracleText: string, name = 'r-cr701-ramp') {
  return makeDef({
    scryfallId: name,
    name,
    typeLine: 'Sorcery',
    faces: [{ name, typeLine: 'Sorcery', oracleText }],
  });
}

describe('cr-701 generic ramp search resolution (CR 701.23/701.24)', () => {
  beforeEach(() => {
    resetStore();
    // 決定論: Math.random を固定し、確定順列が commit されることを観測可能にする。
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });
  afterEach(() => vi.restoreAllMocks());

  it("Nature's Lore: Forest card を battlefield untapped へ・CR701.24b で found を shuffle 対象外", () => {
    const spell = ramp(
      "Search your library for a Forest card, put that card onto the battlefield, then shuffle.",
      'r-cr701-natures-lore',
    );
    const dual = makeDef({
      scryfallId: 'r-cr701-dual-forest',
      name: 'Dual Forest',
      typeLine: 'Land — Mountain Forest',
      faces: [{ name: 'Dual Forest', typeLine: 'Land — Mountain Forest' }],
    });
    store().newGame(
      [
        { def: spell, isCommander: false },
        { def: dual, isCommander: false },
        ...makeDeck(12),
      ],
      1,
    );
    const sourceId = findInstanceId('r-cr701-natures-lore');
    const dualId = findInstanceId('r-cr701-dual-forest');
    store().moveCard(sourceId, 'stack', 'bottom');
    store().moveCard(dualId, 'library', 'bottom');
    const libBefore = store().state!.zones.library.slice();

    store().resolveTop();
    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      atom: 'effect.search',
      kind: 'library-search',
      librarySearch: { filter: { kind: 'land-subtype', subtype: 'Forest' }, entersTapped: false },
    });

    store().confirmGuidedLibrarySearch(dualId);

    const s = store().state!;
    expect(store().pendingGuided).toBeNull();
    // 非basic の Forest 型 dual は「Forest card」に合致(basic 限定でない)。
    expect(s.cards[dualId].zone).toBe('battlefield');
    expect(s.cards[dualId].tapped).toBe(false);
    expect(s.cards[sourceId].zone).toBe('graveyard');
    // CR701.24b: found は library に残らない・library は「before − found」と集合一致。
    expect(s.zones.library).not.toContain(dualId);
    expect([...s.zones.library].sort()).toEqual(libBefore.filter((id) => id !== dualId).sort());
  });

  it('Rampant Growth: basic-land filter は非basic Forest を拒否・basic を tapped で着地', () => {
    const spell = ramp(
      'Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.',
      'r-cr701-rampant',
    );
    const nonbasic = makeDef({
      scryfallId: 'r-cr701-nonbasic',
      name: 'Nonbasic Forest',
      typeLine: 'Land — Forest',
      faces: [{ name: 'Nonbasic Forest', typeLine: 'Land — Forest' }],
    });
    const basic = makeDef({
      scryfallId: 'r-cr701-basic',
      name: 'Forest',
      typeLine: 'Basic Land — Forest',
      faces: [{ name: 'Forest', typeLine: 'Basic Land — Forest' }],
    });
    store().newGame(
      [
        { def: spell, isCommander: false },
        { def: nonbasic, isCommander: false },
        { def: basic, isCommander: false },
        ...makeDeck(12),
      ],
      2,
    );
    const sourceId = findInstanceId('r-cr701-rampant');
    const nonbasicId = findInstanceId('r-cr701-nonbasic');
    const basicId = findInstanceId('r-cr701-basic');
    store().moveCard(sourceId, 'stack', 'bottom');
    store().moveCard(nonbasicId, 'library', 'bottom');
    store().moveCard(basicId, 'library', 'bottom');

    store().resolveTop();
    expect(store().pendingGuided?.prompts[0]).toMatchObject({
      kind: 'library-search',
      librarySearch: { filter: { kind: 'basic-land' }, entersTapped: true },
    });

    // 非合法(非basic)選択は確定させない: source は stack のまま・warning。
    store().confirmGuidedLibrarySearch(nonbasicId);
    expect(store().pendingGuided?.prompts[0].kind).toBe('library-search');
    expect(store().state!.cards[nonbasicId].zone).toBe('library');
    expect(store().state!.cards[sourceId].zone).toBe('stack');

    // 合法(basic)選択で確定=tapped 着地。
    store().confirmGuidedLibrarySearch(basicId);
    const s = store().state!;
    expect(store().pendingGuided).toBeNull();
    expect(s.cards[basicId].zone).toBe('battlefield');
    expect(s.cards[basicId].tapped).toBe(true);
    expect(s.cards[sourceId].zone).toBe('graveyard');
    expect(s.zones.library).not.toContain(basicId);
  });

  it('CR 701.23d: 見つけない(0枚)は合法=source 解決 + shuffle だけ実行・盤面へ何も出さない', () => {
    const spell = ramp(
      "Search your library for a Forest card, put that card onto the battlefield, then shuffle.",
      'r-cr701-miss',
    );
    store().newGame([{ def: spell, isCommander: false }, ...makeDeck(12)], 3);
    const sourceId = findInstanceId('r-cr701-miss');
    store().moveCard(sourceId, 'stack', 'bottom');
    const libBefore = store().state!.zones.library.slice();
    const bfBefore = store().state!.zones.battlefield.length;

    store().resolveTop();
    expect(store().pendingGuided?.prompts[0].kind).toBe('library-search');

    // 見つけずに切り直す(cardId 無し)。
    store().confirmGuidedLibrarySearch();

    const s = store().state!;
    expect(store().pendingGuided).toBeNull();
    expect(s.cards[sourceId].zone).toBe('graveyard');
    // 盤面は増えない・library は集合として不変(shuffle は順序のみ)。
    expect(s.zones.battlefield.length).toBe(bfBefore);
    expect([...s.zones.library].sort()).toEqual(libBefore.sort());
  });
});
