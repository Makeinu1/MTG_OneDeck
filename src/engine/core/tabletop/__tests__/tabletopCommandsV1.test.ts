import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as Core from '../../index';
import * as Closure from '../../closure/index';

function root(): Closure.ModeNeutralCoreRootV1 {
  const fixture = JSON.parse(readFileSync(new URL('../../turn/fixtures/turn-priority-lifecycle-v1.json', import.meta.url), 'utf8')) as { bundle: unknown };
  const turn = Core.createCoreTurnPriorityBundleV1(fixture.bundle as never);
  const registry = turn.stackBundle.objectRegistry;
  const authority = Core.createCoreRuleAuthorityBundleV1({
    turnPriorityBundle: turn,
    control: Core.createModeNeutralCoreControlSliceV1({ effectOrder: [], byEffect: {}, continuityByObject: { 'PC6:0': { controllerPlayerId: 'P3', continuousSinceMostRecentTurnBegan: false } } as never }),
    visibility: Core.createModeNeutralCoreVisibilitySliceV1({ grantOrder: [], byGrant: {} }),
    searchSessions: Core.createModeNeutralCoreSearchSessionSliceV1({ sessionOrder: [], bySession: {} }),
    playPermissions: Core.createModeNeutralCorePlayPermissionSliceV1({ permissionOrder: [], byPermission: {} }),
    decisionAuthorities: Core.createModeNeutralCoreDecisionAuthoritySliceV1({ authorityOrder: [], byAuthority: {} }),
  });
  const commander = Core.createCoreCommanderIdentityV1({ physicalCardId: 'PC1', ownerPlayerId: 'P1' });
  return Closure.createModeNeutralCoreRootV1({
    versions: Closure.CORE_CLOSURE_VERSION_VECTOR_V1,
    acceptedCommandCount: 0,
    ruleAuthority: authority,
    playerLifecycle: Core.createCorePlayerLifecycleStateV1({ players: registry.turnOrder.map((playerId) => ({ playerId, status: 'active', exitCause: null })) }),
    commanders: [commander],
    commanderCastLedgers: [Core.createCoreCommanderCastLedgerV1({ commander, castCount: 0 })],
    commanderDamage: Core.createCoreCommanderDamageStateV1({ commanders: [commander], defendingPlayerIds: registry.turnOrder, entries: [] }),
    commanderDamageProvenance: Core.createCoreCommanderDamageProvenanceLedgerV1({ commanders: [commander], defendingPlayerIds: registry.turnOrder, records: [] }),
    combatContext: null,
  });
}

function command(rootValue: Closure.ModeNeutralCoreRootV1, payload: Core.CoreCommandPayloadV1, actorPlayerId: Core.CorePlayerId = 'P1' as never): Core.CoreCommandV1 {
  return Core.createCoreCommandV1({
    schemaVersion: 1,
    sequence: rootValue.acceptedCommandCount + 1,
    actorPlayerId,
    decisionMakerPlayerId: actorPlayerId,
    decisionContext: { kind: 'decision', decisionKey: 'tabletop' },
    payload,
  });
}

describe('O4P-06B ordinary tabletop command matrix', () => {
  it('draws atomically and reincarnates cards', () => {
    const initial = root();
    const result = Core.applyCoreCommandV1(initial, command(initial, { kind: 'table-draw', count: 1 }));
    expect(result.status).toBe('accepted');
    if (result.status !== 'accepted') return;
    const registry = result.root.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
    expect(registry.zones.byPlayer['P1' as never]?.library).toHaveLength(0);
    expect(registry.zones.byPlayer['P1' as never]?.hand).toEqual(['PC2:0', 'PC1:1']);
    expect(registry.players['P1' as never]?.drawnThisTurn).toBe(1);
    expect(registry.objects['PC1:0' as never]).toBeUndefined();
    expect(result.events[0]?.payload.kind).toBe('table-draw');
    expect(Object.isFrozen(result.root)).toBe(true);
    expect(Object.isFrozen(result.events)).toBe(true);
    expect(Object.isFrozen(result.events[0])).toBe(true);
    expect(Object.isFrozen(result.events[0]?.payload)).toBe(true);
  });

  it('clears attachment references to the old library incarnation when drawing', () => {
    const initial = root();
    const turn = initial.ruleAuthority.turnPriorityBundle;
    const registry = turn.stackBundle.objectRegistry;
    const oldLibraryObjectId = registry.zones.byPlayer['P1' as never]?.library[0];
    const battlefieldObjectId = registry.zones.shared.battlefield[0];
    expect(oldLibraryObjectId).toBeDefined();
    expect(battlefieldObjectId).toBeDefined();
    if (oldLibraryObjectId === undefined || battlefieldObjectId === undefined) return;
    const currentRuntime = turn.stackBundle.objectRuntime.byObject[battlefieldObjectId];
    if (currentRuntime === undefined) throw new Error('Battlefield runtime is required');
    const runtime = Core.createModeNeutralCoreObjectRuntimeStateV2(registry, {
      byObject: {
        ...turn.stackBundle.objectRuntime.byObject,
        [battlefieldObjectId]: {
          ...currentRuntime,
          attachment: Core.createCoreAttachmentStateV1({
            attachedTo: { kind: 'object', objectId: oldLibraryObjectId },
          }),
        },
      },
    });
    const stackBundle = Core.createCoreStackTransactionBundleV1({
      ...turn.stackBundle,
      objectRuntime: runtime,
    });
    const turnPriorityBundle = Core.createCoreTurnPriorityBundleV1({
      ...turn,
      stackBundle,
    });
    const ruleAuthority = Core.createCoreRuleAuthorityBundleV1({
      ...initial.ruleAuthority,
      turnPriorityBundle,
    });
    const attached = Core.createModeNeutralCoreRootV1({ ...initial, ruleAuthority });
    const result = Core.applyCoreCommandV1(
      attached,
      command(attached, { kind: 'table-draw', count: 1 }),
    );
    expect(result.status).toBe('accepted');
    if (result.status === 'rejected') return;
    expect(
      result.root.ruleAuthority.turnPriorityBundle.stackBundle.objectRuntime
        .byObject[battlefieldObjectId]?.attachment.attachedTo,
    ).toBeNull();
  });

  it('adjusts mana and rejects underflow without changing identity', () => {
    const initial = root();
    const accepted = Core.applyCoreCommandV1(initial, command(initial, { kind: 'table-mana-adjust', color: 'G', delta: 2 }));
    expect(accepted.status).toBe('accepted');
    if (accepted.status !== 'accepted') return;
    const rejected = Core.applyCoreCommandV1(accepted.root, command(accepted.root, { kind: 'table-mana-adjust', color: 'G', delta: -3 }));
    expect(rejected.status).toBe('rejected');
    expect(rejected.root).toBe(accepted.root);
  });

  it('moves cards with reincarnation and updates public runtime actions', () => {
    const initial = root();
    const moved = Core.applyCoreCommandV1(initial, command(initial, {
      kind: 'table-zone-move', objectId: 'PC1:0' as never, destination: { kind: 'battlefield', baseControllerPlayerId: 'P1' as never },
    }));
    expect(moved.status).toBe('accepted');
    if (moved.status !== 'accepted') return;
    const registry = moved.root.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
    expect(registry.zones.byPlayer['P1' as never]?.library).toEqual([]);
    expect(registry.zones.shared.battlefield).toContain('PC1:1' as never);
    const tapped = Core.applyCoreCommandV1(moved.root, command(moved.root, { kind: 'table-tap', objectId: 'PC1:1' as never, tapped: true }));
    expect(tapped.status).toBe('accepted');
    if (tapped.status !== 'accepted') return;
    const counted = Core.applyCoreCommandV1(tapped.root, command(tapped.root, { kind: 'table-counter-adjust', objectId: 'PC1:1' as never, counterKind: 'charge', delta: 2 }));
    expect(counted.status).toBe('accepted');
  });

  it('removes a moved stack card from its stack announcement record', () => {
    const initial = root();
    const moved = Core.applyCoreCommandV1(initial, command(initial, {
      kind: 'table-zone-move', objectId: 'PC5:1' as never, destination: { kind: 'owner-graveyard' },
    }));
    expect(moved.status).toBe('accepted');
    if (moved.status !== 'accepted') return;
    expect(moved.root.ruleAuthority.turnPriorityBundle.stackBundle.stackAnnouncements.byObject['PC5:1' as never]).toBeUndefined();
  });

  it('creates and removes an engine-synthetic token with canonical runtime', () => {
    const initial = root();
    const definition = initial.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.cardDefinitions['def.fixture-card' as never];
    const created = Core.applyCoreCommandV1(initial, command(initial, {
      kind: 'table-token-create', tokenSeed: 'table-token', definitionId: 'table-definition' as never, definition,
    }));
    expect(created.status).toBe('accepted');
    if (created.status !== 'accepted') return;
    const registry = created.root.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
    expect(registry.zones.shared.battlefield).toContain('@token:table-token:0' as never);
    const removed = Core.applyCoreCommandV1(created.root, command(created.root, { kind: 'table-token-remove', objectId: '@token:table-token:0' as never }));
    expect(removed.status).toBe('accepted');
    if (removed.status !== 'accepted') return;
    expect(removed.root.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.objects['@token:table-token:0' as never]).toBeUndefined();
  });

  it('rejects an oversized token snapshot before it can mutate the root', () => {
    const initial = root();
    const definition = initial.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.cardDefinitions['def.fixture-card' as never];
    const oversized = {
      ...definition,
      source: { kind: 'engine-synthetic' as const },
      faces: definition.faces.map((face, index) => index === 0 ? { ...face, oracleText: 'x'.repeat(100_000) } : face),
    };
    const commandWithOversizedDefinition = {
      kind: 'mode-neutral-core-command-v1' as const,
      schemaVersion: 1 as const,
      sequence: 1,
      actorPlayerId: 'P1' as never,
      decisionMakerPlayerId: 'P1' as never,
      decisionContext: { kind: 'decision' as const, decisionKey: 'tabletop' as never },
      payload: { kind: 'table-token-create' as const, tokenSeed: 'oversized-token', definitionId: 'oversized-definition' as never, definition: oversized },
    } as unknown as Core.CoreCommandV1;
    const result = Core.applyCoreCommandV1(initial, commandWithOversizedDefinition);
    expect(result.status).toBe('rejected');
    expect(result.root).toBe(initial);
  });

  it('accepts 80-character note and stack IDs but rejects 81-character IDs', () => {
    const initial = root();
    const noteId = 'n'.repeat(80);
    const acceptedNote = Core.applyCoreCommandV1(initial, command(initial, {
      kind: 'table-note-set', noteId, text: 'Boundary note', manualMode: 'structured',
    }));
    expect(acceptedNote.status).toBe('accepted');
    if (acceptedNote.status !== 'accepted') return;
    expect(acceptedNote.root.tabletopManual?.notes[noteId]?.id).toBe(noteId);

    const rejectedNote = Core.applyCoreCommandV1(acceptedNote.root, {
      kind: 'mode-neutral-core-command-v1', schemaVersion: 1, sequence: 2,
      actorPlayerId: 'P1', decisionMakerPlayerId: 'P1',
      decisionContext: { kind: 'decision', decisionKey: 'tabletop' },
      payload: { kind: 'table-note-set', noteId: 'n'.repeat(81), text: 'Too long', manualMode: 'freeform' },
    } as unknown as Core.CoreCommandV1);
    expect(rejectedNote.status).toBe('rejected');
    expect(rejectedNote.root).toBe(acceptedNote.root);

    const entryId = 'e'.repeat(80);
    const acceptedEntry = Core.applyCoreCommandV1(acceptedNote.root, command(acceptedNote.root, {
      kind: 'table-stack-entry', entryId, label: 'Boundary stack entry', sourceObjectId: null, manualMode: 'freeform',
    }));
    expect(acceptedEntry.status).toBe('accepted');
    if (acceptedEntry.status !== 'accepted') return;
    expect(acceptedEntry.root.tabletopManual?.stackEntries[0]?.id).toBe(entryId);

    const rejectedEntry = Core.applyCoreCommandV1(acceptedEntry.root, {
      kind: 'mode-neutral-core-command-v1', schemaVersion: 1, sequence: 3,
      actorPlayerId: 'P1', decisionMakerPlayerId: 'P1',
      decisionContext: { kind: 'decision', decisionKey: 'tabletop' },
      payload: { kind: 'table-stack-entry', entryId: 'e'.repeat(81), label: 'Too long', sourceObjectId: null, manualMode: 'structured' },
    } as unknown as Core.CoreCommandV1);
    expect(rejectedEntry.status).toBe('rejected');
    expect(rejectedEntry.root).toBe(acceptedEntry.root);

    expect(() => Core.applyCoreTabletopPayloadV1(acceptedEntry.root, 'P1' as never, {
      kind: 'table-note-set', noteId: 'n'.repeat(81), text: 'Direct bypass', manualMode: 'structured',
    })).toThrow();
    expect(() => Core.applyCoreTabletopPayloadV1(acceptedEntry.root, 'P1' as never, {
      kind: 'table-stack-entry', entryId: 'e'.repeat(81), label: 'Direct bypass', sourceObjectId: null, manualMode: 'freeform',
    })).toThrow();

    const definition = acceptedEntry.root.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.cardDefinitions['def.fixture-card' as never];
    const oversized = {
      ...definition,
      source: { kind: 'engine-synthetic' as const },
      faces: definition.faces.map((face, index) => index === 0 ? { ...face, oracleText: 'x'.repeat(100_000) } : face),
    };
    expect(() => Core.applyCoreTabletopPayloadV1(acceptedEntry.root, 'P1' as never, {
      kind: 'table-token-create', tokenSeed: 'direct-oversized', definitionId: 'direct-oversized-definition' as never, definition: oversized,
    })).toThrow();
  });

  it('bounds note and manual-stack collections atomically at the final allowed item', () => {
    let notesRoot = root();
    for (let index = 0; index < 128; index += 1) {
      const result = Core.applyCoreCommandV1(notesRoot, command(notesRoot, {
        kind: 'table-note-set', noteId: `bounded-note-${String(index)}`, text: 'x', manualMode: 'structured',
      }));
      expect(result.status).toBe('accepted');
      if (result.status !== 'accepted') return;
      notesRoot = result.root;
    }
    const notesBeforeOverflow = notesRoot;
    const notesOverflow = Core.applyCoreCommandV1(notesRoot, command(notesRoot, {
      kind: 'table-note-set', noteId: 'bounded-note-overflow', text: 'x', manualMode: 'freeform',
    }));
    expect(notesOverflow.status).toBe('rejected');
    expect(notesOverflow.root).toBe(notesBeforeOverflow);

    let stackRoot = root();
    for (let index = 0; index < 128; index += 1) {
      const result = Core.applyCoreCommandV1(stackRoot, command(stackRoot, {
        kind: 'table-stack-entry', entryId: `bounded-entry-${String(index)}`, label: 'x', sourceObjectId: null, manualMode: 'freeform',
      }));
      expect(result.status).toBe('accepted');
      if (result.status !== 'accepted') return;
      stackRoot = result.root;
    }
    const stackBeforeOverflow = stackRoot;
    const stackOverflow = Core.applyCoreCommandV1(stackRoot, command(stackRoot, {
      kind: 'table-stack-entry', entryId: 'bounded-entry-overflow', label: 'x', sourceObjectId: null, manualMode: 'structured',
    }));
    expect(stackOverflow.status).toBe('rejected');
    expect(stackOverflow.root).toBe(stackBeforeOverflow);
  }, 30_000);

  it('rejects persisted manual roots over collection and serialized-size ceilings', () => {
    const initial = root();
    const notes: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    const noteOrder: string[] = [];
    for (let index = 0; index < 129; index += 1) {
      const id = `persisted-note-${String(index)}`;
      notes[id] = { id, authorPlayerId: 'P1', text: 'x', creationRevision: 1 };
      noteOrder.push(id);
    }
    const overCollection = Closure.validateModeNeutralCoreRootV1({
      ...initial,
      acceptedCommandCount: 129,
      tabletopManual: { kind: 'core-tabletop-manual-state-v1', notes, noteOrder, stackEntries: [] },
    });
    expect(overCollection.ok).toBe(false);

    const largeNotes: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    const largeOrder: string[] = [];
    for (let index = 0; index < 128; index += 1) {
      const id = `large-note-${String(index)}`;
      largeNotes[id] = { id, authorPlayerId: 'P1', text: 'x'.repeat(160), creationRevision: 1 };
      largeOrder.push(id);
    }
    const overSerialized = Closure.validateModeNeutralCoreRootV1({
      ...initial,
      acceptedCommandCount: 128,
      tabletopManual: { kind: 'core-tabletop-manual-state-v1', notes: largeNotes, noteOrder: largeOrder, stackEntries: [] },
    });
    expect(overSerialized.ok).toBe(false);
  });

  it('round-trips accepted ordinary commands through the shipped journal replay', () => {
    const initial = root();
    const first = command(initial, { kind: 'table-draw', count: 1 });
    const firstResult = Core.applyCoreCommandV1(initial, first);
    expect(firstResult.status).toBe('accepted');
    if (firstResult.status !== 'accepted') return;
    const second = command(firstResult.root, { kind: 'table-mana-adjust', color: 'U', delta: 1 });
    const secondResult = Core.applyCoreCommandV1(firstResult.root, second);
    expect(secondResult.status).toBe('accepted');
    if (secondResult.status !== 'accepted') return;
    const journal = Core.appendCoreCommandJournalEntryV1([], first, firstResult);
    const completeJournal = Core.appendCoreCommandJournalEntryV1(journal, second, secondResult);
    const replay = Core.replayCoreCommandsFromRootV1(initial, completeJournal);
    expect(replay.ok).toBe(true);
    if (replay.ok) expect(replay.finalStateDigest).toBe(secondResult.afterStateDigest);
  });

  it('retains Structured and Freeform provenance while converging on the same Core root', () => {
    const initial = root();
    const structured = Core.applyCoreCommandV1(initial, command(initial, { kind: 'table-mana-adjust', color: 'G', delta: 1, manualMode: 'structured' }));
    const freeform = Core.applyCoreCommandV1(initial, command(initial, { kind: 'table-mana-adjust', color: 'G', delta: 1, manualMode: 'freeform' }));
    expect(structured.status).toBe('accepted');
    expect(freeform.status).toBe('accepted');
    if (structured.status !== 'accepted' || freeform.status !== 'accepted') return;
    expect(structured.afterStateDigest).toBe(freeform.afterStateDigest);
    expect(structured.events[0]?.payload).toMatchObject({ kind: 'table-mana-adjusted', manualMode: 'structured' });
    expect(freeform.events[0]?.payload).toMatchObject({ kind: 'table-mana-adjusted', manualMode: 'freeform' });
    if (structured.status === 'accepted') {
      const replay = Core.replayCoreCommandsFromRootV1(initial, Core.appendCoreCommandJournalEntryV1([], command(initial, { kind: 'table-mana-adjust', color: 'G', delta: 1, manualMode: 'structured' }), structured));
      expect(replay.ok).toBe(true);
      if (replay.ok) expect(replay.finalStateDigest).toBe(structured.afterStateDigest);
    }
  });

  it('requires manual provenance for every post-D tabletop payload while retaining legacy draw compatibility', () => {
    const envelope = (payload: unknown): unknown => ({
      kind: 'mode-neutral-core-command-v1', schemaVersion: 1, sequence: 1,
      actorPlayerId: 'P1', decisionMakerPlayerId: 'P1',
      decisionContext: { kind: 'decision', decisionKey: 'tabletop-provenance' }, payload,
    });
    expect(Closure.validateCoreCommandV1(envelope({ kind: 'table-draw', count: 1 })).ok).toBe(true);
    const postD: readonly unknown[] = [
      { kind: 'table-shuffle' },
      { kind: 'table-reorder', zone: { kind: 'shared-zone', zone: 'battlefield' }, order: [] },
      { kind: 'table-life-adjust', field: 'life', delta: 1 },
      { kind: 'table-controller-change', objectId: 'PC6:0', gainingControllerPlayerId: 'P1' },
      { kind: 'table-attach', objectId: 'PC6:0', targetObjectId: null },
      { kind: 'table-damage-mark', objectId: 'PC6:0', amount: 1 },
      { kind: 'table-note-set', noteId: 'provenance-note', text: 'Manual note' },
      { kind: 'table-note-clear', noteId: 'provenance-note' },
      { kind: 'table-stack-entry', entryId: 'provenance-entry', label: 'Manual entry', sourceObjectId: null },
      { kind: 'table-manual-resolve', entryId: 'provenance-entry' },
    ];
    for (const payload of postD) expect(Closure.validateCoreCommandV1(envelope(payload)).ok).toBe(false);
  });

  it('rejects manual operations against another seat public objects without changing root', () => {
    const initial = root();
    const attack = Core.applyCoreCommandV1(initial, command(initial, { kind: 'table-tap', objectId: 'PC6:0' as never, tapped: true, manualMode: 'structured' }));
    expect(attack.status).toBe('rejected');
    expect(attack.root).toBe(initial);
    const move = Core.applyCoreCommandV1(initial, command(initial, { kind: 'table-zone-move', objectId: 'PC4:0' as never, destination: { kind: 'owner-graveyard' }, manualMode: 'freeform' }));
    expect(move.status).toBe('rejected');
    expect(move.root).toBe(initial);
  });

  it('rejects manual library sources, indexed library placement, and foreign destination controllers', () => {
    const initial = root();
    const fromLibrary = Core.applyCoreCommandV1(initial, command(initial, {
      kind: 'table-zone-move', objectId: 'PC1:0' as never,
      destination: { kind: 'owner-graveyard' }, manualMode: 'structured',
    }));
    expect(fromLibrary.status).toBe('rejected');
    expect(fromLibrary.root).toBe(initial);

    const indexed = Core.applyCoreCommandV1(initial, command(initial, {
      kind: 'table-zone-move', objectId: 'PC2:0' as never,
      destination: { kind: 'owner-library', placement: { kind: 'index', index: 0 } }, manualMode: 'freeform',
    }));
    expect(indexed.status).toBe('rejected');
    expect(indexed.root).toBe(initial);

    const foreignDestination = Core.applyCoreCommandV1(initial, command(initial, {
      kind: 'table-zone-move', objectId: 'PC2:0' as never,
      destination: { kind: 'battlefield', baseControllerPlayerId: 'P2' as never }, manualMode: 'structured',
    }));
    expect(foreignDestination.status).toBe('rejected');
    expect(foreignDestination.root).toBe(initial);
  });

  it('rejects another-author note collisions and preserves same-author creation revision', () => {
    const initial = root();
    const authored = Core.applyCoreCommandV1(initial, command(initial, {
      kind: 'table-note-set', noteId: 'collision-note', text: 'P2 note', manualMode: 'structured',
    }, 'P2' as never));
    expect(authored.status).toBe('accepted');
    if (authored.status !== 'accepted') return;
    const collision = Core.applyCoreCommandV1(authored.root, command(authored.root, {
      kind: 'table-note-set', noteId: 'collision-note', text: 'P1 overwrite', manualMode: 'freeform',
    }));
    expect(collision.status).toBe('rejected');
    expect(collision.root).toBe(authored.root);
    expect(authored.root.tabletopManual?.notes['collision-note']).toMatchObject({ authorPlayerId: 'P2', creationRevision: 1, text: 'P2 note' });

    const ownInitial = Core.applyCoreCommandV1(initial, command(initial, {
      kind: 'table-note-set', noteId: 'own-note', text: 'Original', manualMode: 'structured',
    }));
    expect(ownInitial.status).toBe('accepted');
    if (ownInitial.status !== 'accepted') return;
    const updated = Core.applyCoreCommandV1(ownInitial.root, command(ownInitial.root, {
      kind: 'table-note-set', noteId: 'own-note', text: 'Updated', manualMode: 'freeform',
    }));
    expect(updated.status).toBe('accepted');
    if (updated.status !== 'accepted') return;
    expect(updated.root.tabletopManual?.notes['own-note']).toMatchObject({ authorPlayerId: 'P1', creationRevision: 1, text: 'Updated' });
    expect(updated.events[0]?.payload).toMatchObject({ kind: 'table-note-set', authorPlayerId: 'P1', creationRevision: 1 });
  });

  it('records bounded notes and resolves only a controlled manual stack top', () => {
    const initial = root();
    const noted = Core.applyCoreCommandV1(initial, command(initial, { kind: 'table-note-set', noteId: 'table-note', text: 'Remember priority', manualMode: 'structured' }));
    expect(noted.status).toBe('accepted');
    if (noted.status !== 'accepted') return;
    const stacked = Core.applyCoreCommandV1(noted.root, command(noted.root, { kind: 'table-stack-entry', entryId: 'table-entry', label: 'Resolve fixture', sourceObjectId: 'PC5:1' as never, manualMode: 'freeform' }));
    expect(stacked.status).toBe('accepted');
    if (stacked.status !== 'accepted') return;
    expect(stacked.root.tabletopManual?.notes['table-note']?.text).toBe('Remember priority');
    expect(stacked.root.tabletopManual?.stackEntries[0]?.provenance).toBe('freeform');
    const resolved = Core.applyCoreCommandV1(stacked.root, command(stacked.root, { kind: 'table-manual-resolve', manualMode: 'freeform' }));
    expect(resolved.status).toBe('accepted');
    if (resolved.status === 'accepted') expect(resolved.root.tabletopManual?.stackEntries).toHaveLength(0);
  });

  it('resolves a controlled synthetic stack object through cease removal', () => {
    const initial = root();
    const stacked = Core.applyCoreCommandV1(initial, command(initial, {
      kind: 'table-stack-entry', entryId: 'synthetic-entry', label: 'Ability marker',
      sourceObjectId: '@spell-copy:fixture-copy' as never, manualMode: 'structured',
    }, 'P2' as never));
    expect(stacked.status).toBe('accepted');
    if (stacked.status !== 'accepted') return;
    const resolved = Core.applyCoreCommandV1(stacked.root, command(stacked.root, {
      kind: 'table-manual-resolve', entryId: 'synthetic-entry', manualMode: 'structured',
    }, 'P2' as never));
    expect(resolved.status).toBe('accepted');
    if (resolved.status !== 'accepted') return;
    const bundle = resolved.root.ruleAuthority.turnPriorityBundle.stackBundle;
    expect(bundle.objectRegistry.zones.shared.stack).not.toContain('@spell-copy:fixture-copy');
    expect(bundle.objectRegistry.objects['@spell-copy:fixture-copy' as never]).toBeUndefined();
    expect(bundle.objectRuntime.byObject['@spell-copy:fixture-copy' as never]).toBeUndefined();
    expect(bundle.stackAnnouncements.byObject['@spell-copy:fixture-copy' as never]).toBeUndefined();
    expect(resolved.root.tabletopManual?.stackEntries).toHaveLength(0);
  });

  it('retains manual provenance for a server-recorded random order payload', () => {
    const initial = root();
    const random = Core.applyCoreCommandV1(initial, command(initial, { kind: 'random-zone-order', randomDecisionId: 'manual-random', zone: { kind: 'player-zone', playerId: 'P1' as never, zone: 'library' }, beforeOrder: ['PC1:0' as never], afterOrder: ['PC1:0' as never], manualMode: 'freeform' }));
    expect(random.status).toBe('accepted');
    if (random.status === 'accepted') expect(random.events[0]?.payload).toMatchObject({ kind: 'zone-randomized', manualMode: 'freeform' });
  });

  it('rejects malformed persisted manual state rather than widening the root', () => {
    const initial = root();
    expect(() => Closure.createModeNeutralCoreRootV1({
      ...initial,
      tabletopManual: {
        kind: 'core-tabletop-manual-state-v1',
        notes: { note: { id: 'note', authorPlayerId: 'P1' as never, text: 'future', creationRevision: 1 } },
        noteOrder: ['note'],
        stackEntries: [],
      },
    })).toThrow();
  });

  it('executes the remaining public primitive families through the same reducer', () => {
    let current = root();
    const apply = (payload: Core.CoreCommandPayloadV1): void => {
      const result = Core.applyCoreCommandV1(current, command(current, payload));
      expect(result.status).toBe('accepted');
      if (result.status === 'accepted') current = result.root;
    };
    apply({ kind: 'table-zone-move', objectId: 'PC2:0' as never, destination: { kind: 'battlefield', baseControllerPlayerId: 'P1' as never }, manualMode: 'freeform' });
    apply({ kind: 'table-reorder', zone: { kind: 'shared-zone', zone: 'battlefield' }, order: ['PC6:0' as never, 'PC2:1' as never], manualMode: 'structured' });
    apply({ kind: 'table-life-adjust', field: 'life', delta: -1, manualMode: 'structured' });
    apply({ kind: 'table-attach', objectId: 'PC2:1' as never, targetObjectId: 'PC6:0' as never, manualMode: 'freeform' });
    apply({ kind: 'table-attach', objectId: 'PC2:1' as never, targetObjectId: null, manualMode: 'freeform' });
    apply({ kind: 'table-damage-mark', objectId: 'PC2:1' as never, amount: 2, manualMode: 'structured' });
    apply({ kind: 'table-damage-mark', objectId: 'PC2:1' as never, amount: -2, manualMode: 'structured' });
    apply({ kind: 'table-controller-change', objectId: 'PC2:1' as never, gainingControllerPlayerId: 'P2' as never, manualMode: 'structured' });
    const definition = current.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.cardDefinitions['def.fixture-card' as never];
    apply({ kind: 'table-token-create', tokenSeed: 'manual-token', definitionId: 'manual-token-definition' as never, definition, manualMode: 'freeform' });
    const manualTokenId = `${['@', 'token', ':'].join('')}${['manual', '-', 'token', ':', '0'].join('')}` as never;
    apply({ kind: 'table-token-remove', objectId: manualTokenId, manualMode: 'freeform' });
    apply({ kind: 'table-note-set', noteId: 'family-note', text: 'Temporary note', manualMode: 'structured' });
    apply({ kind: 'table-note-clear', noteId: 'family-note', manualMode: 'structured' });
    expect(current.tabletopManual?.notes).toEqual({});
    expect(current.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.players['P1' as never]?.life).toBe(39);
  });
});
