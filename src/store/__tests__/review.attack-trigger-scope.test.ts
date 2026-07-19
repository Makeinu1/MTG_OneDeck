// Reviewer-owned adversarial tests for attack-trigger scope matching (CR 603.2).
// 実装エージェント(Codex)は本ファイルを変更しないこと。落ちたら実装側を直す。
//
// Context: this engine detects triggers into candidates the player confirms onto the
// stack (detection == the semi-manual affordance). The cold audit (2026-07-19) found the
// attack watcher counted the source's OWN attack, so a "whenever another creature you
// control attacks" line mis-fired when only the watcher itself attacked. Per user 裁定
// the fix is the correct CR 603.2 scope match, pinned adversarially here.
import { beforeEach, describe, expect, it } from 'vitest';

import { makeDeck, makeDef } from '../../engine/__tests__/helpers';
import { PLAN_CARD_FIXTURES } from '../../test/fixtures/planCardFixtures';
import type { GameState } from '../../engine/types';
import { useGameStore } from '../gameStore';

function store() {
  return useGameStore.getState();
}

function state(): GameState {
  const current = store().state;
  if (!current) throw new Error('game state unavailable');
  return current;
}

function reset(): void {
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

function instanceId(defId: string): string {
  const card = Object.values(state().cards).find((candidate) => candidate.defId === defId);
  if (!card) throw new Error(`missing instance ${defId}`);
  return card.id;
}

function watcherCandidateSources(): string[] {
  return store().triggerCandidates
    .filter((candidate) => candidate.triggerId === 'trigger.attack-watcher')
    .map((candidate) => candidate.sourceId);
}

const OTHER_YOU_CONTROL = 'Whenever another creature you control attacks, draw a card.';

function setup(watcherOracle: string): { watcherId: string; buddyId: string } {
  const watcher = makeDef({
    scryfallId: 'scope-watcher',
    typeLine: 'Creature',
    faces: [{ name: 'Scope Watcher', typeLine: 'Creature', power: '2', toughness: '2', oracleText: watcherOracle }],
  });
  const buddy = makeDef({
    scryfallId: 'scope-buddy',
    typeLine: 'Creature',
    faces: [{ name: 'Scope Buddy', typeLine: 'Creature', power: '2', toughness: '2', oracleText: '' }],
  });
  store().newGame([
    { def: watcher, isCommander: false },
    { def: buddy, isCommander: false },
    ...makeDeck(16),
  ], 41);
  const watcherId = instanceId(watcher.scryfallId);
  const buddyId = instanceId(buddy.scryfallId);
  store().moveCard(watcherId, 'battlefield');
  store().moveCard(buddyId, 'battlefield');
  return { watcherId, buddyId };
}

describe('attack-trigger scope matching (CR 603.2)', () => {
  beforeEach(reset);

  it('does NOT detect an "another creature you control" watcher on its own solo attack (the audited bug)', () => {
    const { watcherId } = setup(OTHER_YOU_CONTROL);
    store().declareAttack([watcherId], '対戦相手A');
    // The watcher counted its own attack before the fix; it must not now.
    expect(watcherCandidateSources()).not.toContain(watcherId);
  });

  it('detects the watcher when a DIFFERENT controlled creature attacks', () => {
    const { watcherId, buddyId } = setup(OTHER_YOU_CONTROL);
    store().declareAttack([buddyId], '対戦相手A');
    expect(watcherCandidateSources()).toContain(watcherId);
  });

  it('detects the watcher when its own attack is accompanied by another qualifying attacker', () => {
    const { watcherId, buddyId } = setup(OTHER_YOU_CONTROL);
    store().declareAttack([watcherId, buddyId], '対戦相手A');
    expect(watcherCandidateSources()).toContain(watcherId);
  });

  it('a non-"another" "creature you control" watcher may count its own attack', () => {
    const { watcherId } = setup('Whenever a creature you control attacks, draw a card.');
    store().declareAttack([watcherId], '対戦相手A');
    expect(watcherCandidateSources()).toContain(watcherId);
  });

  it('an "opponent controls" watcher does NOT fire when only my own creatures attack', () => {
    const { watcherId, buddyId } = setup('Whenever a creature an opponent controls attacks, draw a card.');
    store().declareAttack([buddyId], '対戦相手A');
    expect(watcherCandidateSources()).not.toContain(watcherId);
  });

  it('self-attack line is separate from a co-located watcher: only the attacker self-triggers', () => {
    const attacker = PLAN_CARD_FIXTURES.fearOfMissingOut;
    const watcher = makeDef({
      scryfallId: 'scope-cohab-watcher',
      typeLine: 'Creature',
      faces: [{ name: 'Cohab Watcher', typeLine: 'Creature', power: '1', toughness: '1', oracleText: OTHER_YOU_CONTROL }],
    });
    // Four graveyard card types so Fear's delirium condition is satisfiable.
    const graveDefs = [
      makeDef({ scryfallId: 'scope-g-creature', typeLine: 'Creature' }),
      makeDef({ scryfallId: 'scope-g-land', typeLine: 'Land' }),
      makeDef({ scryfallId: 'scope-g-instant', typeLine: 'Instant' }),
      makeDef({ scryfallId: 'scope-g-sorcery', typeLine: 'Sorcery' }),
    ];
    store().newGame([
      { def: attacker, isCommander: false },
      { def: watcher, isCommander: false },
      ...graveDefs.map((def) => ({ def, isCommander: false })),
      ...makeDeck(14),
    ], 42);
    const fearId = instanceId(attacker.scryfallId);
    const watcherId = instanceId(watcher.scryfallId);
    for (const def of graveDefs) store().moveCard(instanceId(def.scryfallId), 'graveyard');
    store().moveCard(fearId, 'battlefield');
    store().moveCard(watcherId, 'battlefield');
    store().dismissTriggerCandidates();

    store().declareAttack([fearId], '対戦相手A');
    const fearPending = state().pendingTriggers.find((trigger) => trigger.sourceId === fearId);
    expect(fearPending?.triggerId).toBe('trigger.attack');
    // The watcher's controlled creature (Fear) attacked, so the watcher qualifies too;
    // but the watcher must NOT masquerade as the self-attack source.
    expect(watcherCandidateSources()).toContain(watcherId);
    expect(watcherCandidateSources()).not.toContain(fearId);
  });
});
