// @vitest-environment node
// verifies: ENG-ZONES-004
import { expect, it } from 'vitest';
import { applyTableOperation, createCockpitTable, tableActivationPayment } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import { projectCockpit, type CockpitMultiplayer } from '../../online/cloudflare/cockpitMultiplayer';
import { cockpitGameState } from './cockpitGameState';
import { stackItemPresentations } from './stackWorkspaceModel';

it('renders stale Stack targets from audience-safe recorded snapshots without rebinding hidden identity', () => {
  const deck = makeDeck(30);
  let table = createCockpitTable(deck, 1, [deck, deck]);
  const sourceId = table.seats[0].zones.hand[0];
  const publicTargetId = table.seats[1].zones.hand[0];
  const secretTargetId = table.seats[1].zones.hand[1];

  table = applyTableOperation(table, {
    type: 'move',
    ids: [sourceId, publicTargetId],
    to: 'battlefield',
    position: 'top',
  });

  const manualCosts = {
    manaCost: '',
    life: 0,
    tapIds: [],
    sacrificeIds: [],
    discardIds: [],
    returnIds: [],
    exileIds: [],
    counters: [],
    note: '',
  };
  const proposal = tableActivationPayment(table, sourceId, 'manual', manualCosts);
  table = applyTableOperation(table, {
    type: 'activate',
    id: 'lki-stack',
    sourceId,
    choice: 'manual',
    text: 'Test target history.',
    targets: [publicTargetId, secretTargetId],
    manualCosts,
    paymentPlan: proposal.paid,
  });

  const publicSnapshot = table.stack[0].targetSnapshots![publicTargetId];
  const secretSnapshot = table.stack[0].targetSnapshots![secretTargetId];
  const publicDefId = publicSnapshot.defId;
  const secretDefId = secretSnapshot.defId;
  const publicName = table.defs[publicDefId].printedName ?? table.defs[publicDefId].name;
  const secretName = table.defs[secretDefId].printedName ?? table.defs[secretDefId].name;

  table = applyTableOperation(table, {
    type: 'move',
    ids: [publicTargetId],
    to: 'hand',
    position: 'top',
  });

  const multi: CockpitMultiplayer = {
    invitation: 'test',
    started: true,
    masterId: 'P1',
    holds: [],
    borrowedFrom: null,
    members: {
      P1: { token: 'P1', connectionId: 'P1', lastSeen: 100, kicked: false, peek: null },
      P2: { token: 'P2', connectionId: 'P2', lastSeen: 100, kicked: false, peek: null },
    },
  };

  const projected = projectCockpit(table, multi, 'P1', 100).table;
  expect(projected.cards[publicTargetId]).toBeUndefined();
  expect(projected.stack[0].targetSnapshots![publicTargetId]).toMatchObject({
    defId: publicDefId,
    zone: 'battlefield',
  });
  expect(projected.stack[0].targetSnapshots![secretTargetId].defId).toBe('cockpit-hidden');
  expect(projected.defs[publicDefId]).toBeDefined();
  expect(projected.defs[secretDefId]).toBeUndefined();

  const state = cockpitGameState(projected, 'P1');
  const item = stackItemPresentations(state)[0];

  expect(item.targets).toHaveLength(2);
  expect(item.targets[0].label).toContain(publicName);
  expect(item.targets[0].label).toContain('以前のオブジェクト');
  expect(item.targets[0].cardId).toBeUndefined();
  expect(item.targets[1].label).toContain('非公開カード');
  expect(item.targets[1].label).not.toContain(secretName);
  expect(item.targets[1].cardId).toBeUndefined();
});
