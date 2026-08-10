import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { CoreObjectId, CorePlayerId } from '../../../ids';
import type { CoreStackAnnouncementRecordV1 } from '../../stackAnnouncementRecordV1';
import {
  createCoreStackTransactionBundleV1,
  type CoreStackTransactionBundleV1,
  type CreateCoreStackTransactionBundleV1Input,
} from '../stackTransactionBundleV1';
import {
  commitCoreCardSpellToStackV1,
  type CoreCardSpellCommitInputV1,
} from '../cardSpellCommitV1';
import {
  commitCoreSyntheticStackObjectV1,
  type CoreSyntheticStackCommitInputV1,
  type CoreSyntheticStackObjectIdentityV1,
} from '../syntheticStackCommitV1';

type SyntheticScenario = Readonly<{
  readonly kind: CoreSyntheticStackObjectIdentityV1['kind'];
  readonly objectId: CoreObjectId;
  readonly announcementObjectId: CoreObjectId;
  readonly object: CoreSyntheticStackObjectIdentityV1;
}>;

type FixtureDocument = Readonly<{
  readonly bundle: Readonly<{
    readonly objectRegistry: unknown;
    readonly objectRuntime: unknown;
    readonly stackAnnouncements: unknown;
  }>;
  readonly scenarios: Readonly<{
    readonly cardCommit: Readonly<{
      readonly sourceObjectId: CoreObjectId;
      readonly controllerPlayerId: CorePlayerId;
      readonly announcementObjectId: CoreObjectId;
      readonly expectedPreviousObjectId: CoreObjectId;
      readonly expectedCommittedObjectId: CoreObjectId;
      readonly expectedStack: readonly CoreObjectId[];
    }>;
    readonly syntheticCommits: readonly SyntheticScenario[];
  }>;
}>;

function readFixture(): FixtureDocument {
  return JSON.parse(
    readFileSync(new URL('../fixtures/stack-transaction-v1.json', import.meta.url), 'utf8'),
  ) as FixtureDocument;
}

function fixtureBundle(fixture: FixtureDocument): CoreStackTransactionBundleV1 {
  return createCoreStackTransactionBundleV1(
    fixture.bundle as unknown as CreateCoreStackTransactionBundleV1Input,
  );
}

function announcementFor(
  bundle: CoreStackTransactionBundleV1,
  objectId: CoreObjectId,
): CoreStackAnnouncementRecordV1 {
  const announcement = bundle.stackAnnouncements.byObject[objectId];
  if (announcement === undefined) throw new Error(`missing fixture announcement ${objectId}`);
  return announcement;
}

function cardCommitInput(
  bundle: CoreStackTransactionBundleV1,
  scenario: FixtureDocument['scenarios']['cardCommit'],
): CoreCardSpellCommitInputV1 {
  const announcement = announcementFor(bundle, scenario.announcementObjectId);
  if (announcement.kind !== 'card-spell') throw new Error('fixture card announcement kind mismatch');
  return {
    sourceObjectId: scenario.sourceObjectId,
    controllerPlayerId: scenario.controllerPlayerId,
    announcement,
  };
}

function syntheticCommitInput(
  bundle: CoreStackTransactionBundleV1,
  scenario: SyntheticScenario,
): CoreSyntheticStackCommitInputV1 {
  const announcement = announcementFor(bundle, scenario.announcementObjectId);
  if (announcement.kind !== scenario.kind || scenario.object.kind !== scenario.kind) {
    throw new Error(`fixture synthetic announcement kind mismatch: ${scenario.kind}`);
  }
  return { objectId: scenario.objectId, object: scenario.object, announcement };
}

describe('O4P-01J-K stack transaction fixture V1', () => {
  it('creates the four-player mixed-stack bundle directly from the fixture', () => {
    const fixture = readFixture();
    const bundle = fixtureBundle(fixture);

    expect(bundle.objectRegistry.turnOrder).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(bundle.objectRegistry.zones.byPlayer['P1' as CorePlayerId].hand).toEqual(['PC2:0']);
    expect(bundle.objectRegistry.zones.shared.exile).toEqual(['PC4:0']);
    expect(bundle.objectRegistry.zones.shared.stack).toEqual([
      '@spell-copy:fixture-copy',
      'PC5:1',
      '@activated-ability:fixture-activation',
      '@triggered-ability:fixture-trigger',
    ]);
    expect(Object.isFrozen(bundle)).toBe(true);
  });

  it('commits the fixture hand card with the expected old/new IDs and unchanged input', () => {
    const fixture = readFixture();
    const bundle = fixtureBundle(fixture);
    const before = JSON.stringify(bundle);
    const scenario = fixture.scenarios.cardCommit;
    const result = commitCoreCardSpellToStackV1(bundle, cardCommitInput(bundle, scenario));

    expect(result.previousObjectId).toBe(scenario.expectedPreviousObjectId);
    expect(result.committedObjectId).toBe(scenario.expectedCommittedObjectId);
    expect(result.bundle.objectRegistry.zones.shared.stack).toEqual(scenario.expectedStack);
    expect(result.bundle.objectRegistry.objects[scenario.expectedCommittedObjectId]).toEqual({
      kind: 'card',
      physicalCardId: 'PC2',
      incarnation: 1,
      baseControllerPlayerId: 'P3',
    });
    expect(result.bundle.objectRuntime.byObject[scenario.expectedCommittedObjectId]).toEqual({
      orientation: { faceIndex: 0, faceDown: false, tapped: false, flipped: false, phasedOut: false },
      counterDamage: { counters: [], markedDamage: 0 },
      attachment: { attachedTo: null },
    });
    expect(JSON.stringify(bundle)).toBe(before);
  });

  it.each(['spell-copy', 'activated-ability', 'triggered-ability'] as const)(
    'commits a valid fixture %s without Runtime or PhysicalCard changes',
    (kind) => {
      const fixture = readFixture();
      const bundle = fixtureBundle(fixture);
      const scenario = fixture.scenarios.syntheticCommits.find((entry) => entry.kind === kind);
      if (scenario === undefined) throw new Error(`missing ${kind} scenario`);
      const before = JSON.stringify(bundle);
      const runtimeBefore = JSON.stringify(bundle.objectRuntime);
      const physicalCardsBefore = JSON.stringify(bundle.objectRegistry.physicalCards);
      const result = commitCoreSyntheticStackObjectV1(bundle, syntheticCommitInput(bundle, scenario));

      expect(result.committedObjectId).toBe(scenario.objectId);
      expect(result.bundle.objectRegistry.zones.shared.stack.at(-1)).toBe(scenario.objectId);
      expect(result.bundle.objectRegistry.objects[scenario.objectId]).toEqual(scenario.object);
      expect(JSON.stringify(result.bundle.objectRuntime)).toBe(runtimeBefore);
      expect(JSON.stringify(result.bundle.objectRegistry.physicalCards)).toBe(physicalCardsBefore);
      expect(JSON.stringify(bundle)).toBe(before);
    },
  );
});
