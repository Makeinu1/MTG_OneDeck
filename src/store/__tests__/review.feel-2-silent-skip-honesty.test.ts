/**
 * Review pins (judge-owned) for feel-2 silent-skip honesty.
 *
 * Contract: docs/engine-spec.md §34.55 (feel-2). Two dishonesties pinned:
 *   (1) the guided resolution path currently emits the generic "manual
 *       remainder" warning for EVERY guided resolution, even when the user
 *       answered every prompt legally — noise that destroys the warning's
 *       honesty signal (North Star ② fake-green prohibition).
 *   (2) a legal zero choice (CR 115.6 "up to one", CR 608.2h variable-loot
 *       "discard zero") is only reachable via the cancel affordance, which
 *       reads as abandonment (feel-1 F3 carry-over).
 *
 * CR anchors: 115.6 (zero targets legal for up-to-N), 608.2h (information
 * fixed at resolution / actual discarded count), 101.3 (impossible parts
 * ignored). Grammar decisions and decision-snapshot are unchanged by design.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import { useGameStore } from '../gameStore';

const store = () => useGameStore.getState();

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

const MANUAL_WARNING = '一部手動で処理してください';

function spell(oracleText: string, scryfallId = 'feel2-pin') {
  return makeDef({
    scryfallId,
    typeLine: 'Sorcery',
    faces: [{ name: scryfallId, typeLine: 'Sorcery', oracleText }],
  });
}

/** Build a game with the spell def on top of the deck. Returns the def id. */
function setup(defId: string, oracleText: string): void {
  store().newGame([{ def: spell(oracleText, defId), isCommander: false }, ...makeDeck(24)], 1);
}

function instanceId(defId: string): string {
  const card = Object.values(store().state?.cards ?? {}).find((c) => c.defId === defId);
  if (!card) throw new Error(`instance not found: ${defId}`);
  return card.id;
}

function castToStack(defId: string, oracleText: string): string {
  setup(defId, oracleText);
  const id = instanceId(defId);
  store().moveCard(id, 'stack', 'bottom');
  store().resolveTop();
  return id;
}

function manualWarnings(): string[] {
  return store().warnings.filter((warning) => warning.includes(MANUAL_WARNING));
}

describe('review: feel-2 silent-skip honesty (engine-spec §34.55)', () => {
  beforeEach(resetStore);

  it('R1: up-to-one target, explicit zero choice via confirmGuidedZeroChoice, resolves WITHOUT manual-remainder warning', () => {
    castToStack('feel2-r1', 'Exile up to one target permanent.');
    expect(store().pendingGuided?.prompts[0]).toMatchObject({ kind: 'target', minCount: 0 });

    store().confirmGuidedZeroChoice();

    expect(store().pendingGuided).toBeNull();
    expect(store().resolutionSession).toBeNull();
    expect(manualWarnings()).toEqual([]);
  });

  it('R2: up-to-one target, cancel (= legal zero choice, CR 115.6), resolves WITHOUT manual-remainder warning', () => {
    castToStack('feel2-r2', 'Exile up to one target permanent.');
    expect(store().pendingGuided?.prompts[0]).toMatchObject({ kind: 'target', minCount: 0 });

    store().cancelGuidedPrompt();

    expect(store().pendingGuided).toBeNull();
    expect(store().resolutionSession).toBeNull();
    expect(manualWarnings()).toEqual([]);
  });

  it('R3: REQUIRED target prompt abandoned via cancel keeps the honest manual-remainder warning', () => {
    castToStack('feel2-r3', 'Destroy target creature.');
    expect(store().pendingGuided?.prompts[0]).toMatchObject({ kind: 'target', count: 1 });

    store().cancelGuidedPrompt();

    expect(store().pendingGuided).toBeNull();
    expect(manualWarnings().length).toBeGreaterThanOrEqual(1);
  });

  it('R4: REQUIRED target answered with a legal target resolves WITHOUT manual-remainder warning', () => {
    setup('feel2-r4', 'Destroy target creature.');
    const victim = makeDef({ scryfallId: 'feel2-victim', typeLine: 'Creature' });
    // rebuild with victim in the deck
    resetStore();
    store().newGame([
      { def: spell('Destroy target creature.', 'feel2-r4'), isCommander: false },
      { def: victim, isCommander: false },
      ...makeDeck(23),
    ], 1);
    const victimId = instanceId('feel2-victim');
    store().moveCard(victimId, 'battlefield');
    const sourceId = instanceId('feel2-r4');
    store().moveCard(sourceId, 'stack', 'bottom');
    store().resolveTop();
    expect(store().pendingGuided?.prompts[0]).toMatchObject({ kind: 'target' });

    store().confirmGuidedTarget(victimId);

    expect(store().pendingGuided).toBeNull();
    expect(store().state?.cards[victimId]?.zone).toBe('graveyard');
    expect(manualWarnings()).toEqual([]);
  });

  it('R5: variable-loot zero discard via cancel (§34.47 CR608.2h path) resolves WITHOUT manual-remainder warning', () => {
    castToStack('feel2-r5', 'Discard up to two cards, then draw that many cards.');
    expect(store().pendingGuided?.prompts[0]).toMatchObject({ kind: 'discard' });
    const libBefore = store().state?.zones.library.length ?? 0;

    store().cancelGuidedPrompt(); // "done discarding" with zero

    expect(store().pendingGuided).toBeNull();
    expect(libBefore - (store().state?.zones.library.length ?? 0)).toBe(0);
    expect(manualWarnings()).toEqual([]);
  });

  it('R6: variable-loot zero discard via confirmGuidedZeroChoice resolves WITHOUT warning and draws zero', () => {
    castToStack('feel2-r6', 'Discard up to two cards, then draw that many cards.');
    expect(store().pendingGuided?.prompts[0]).toMatchObject({ kind: 'discard' });
    const libBefore = store().state?.zones.library.length ?? 0;

    store().confirmGuidedZeroChoice();

    expect(store().pendingGuided).toBeNull();
    expect(libBefore - (store().state?.zones.library.length ?? 0)).toBe(0);
    expect(manualWarnings()).toEqual([]);
  });

  it('R7a: mixed guided+manual item, guided prompt answered legally, keeps exactly ONE manual-remainder warning (the true manual line)', () => {
    setup('feel2-r7', 'Destroy target creature.\nExchange control of two target creatures.');
    resetStore();
    const victim = makeDef({ scryfallId: 'feel2-victim7', typeLine: 'Creature' });
    store().newGame([
      { def: spell('Destroy target creature.\nExchange control of two target creatures.', 'feel2-r7'), isCommander: false },
      { def: victim, isCommander: false },
      ...makeDeck(23),
    ], 1);
    const victimId = instanceId('feel2-victim7');
    store().moveCard(victimId, 'battlefield');
    const sourceId = instanceId('feel2-r7');
    store().moveCard(sourceId, 'stack', 'bottom');
    store().resolveTop();
    expect(store().pendingGuided).not.toBeNull();

    store().confirmGuidedTarget(victimId);

    expect(store().pendingGuided).toBeNull();
    expect(store().state?.cards[victimId]?.zone).toBe('graveyard');
    // exactly one: the manual "Exchange control" line. Deduplicated, and the
    // answered guided line contributes none.
    expect(manualWarnings()).toHaveLength(1);
  });

  it('R7b: mixed guided+manual item, guided prompt abandoned, deduplicates to ONE warning', () => {
    castToStack('feel2-r7b', 'Destroy target creature.\nExchange control of two target creatures.');
    expect(store().pendingGuided).not.toBeNull();

    store().cancelGuidedPrompt();

    expect(store().pendingGuided).toBeNull();
    expect(manualWarnings()).toHaveLength(1);
  });

  it('R8: confirmGuidedZeroChoice on a REQUIRED prompt is a no-op (fail-closed)', () => {
    castToStack('feel2-r8', 'Destroy target creature.');
    const before = store().pendingGuided;

    store().confirmGuidedZeroChoice();

    expect(store().pendingGuided).toEqual(before);
  });
});
