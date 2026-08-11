import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as Core from '../../index';
import * as Closure from '../index';
import type { CoreObjectId, CorePhysicalCardId, CorePlayerId } from '../../ids';

const P1 = 'P1' as CorePlayerId;
const PC1 = 'PC1' as CorePhysicalCardId;
const PC7 = 'PC7' as CorePhysicalCardId;
const O1 = 'PC1:0' as CoreObjectId;
const O7 = 'PC7:0' as CoreObjectId;

type RootOptions = Readonly<{ readonly priorityHolder?: 'P2' | 'P3' | 'P4'; readonly combat?: boolean; readonly separatedAuthority?: boolean }>;

function makeRoot(options: RootOptions = {}): Closure.ModeNeutralCoreRootV1 {
  const fixture = JSON.parse(readFileSync(new URL('../../turn/fixtures/turn-priority-lifecycle-v1.json', import.meta.url), 'utf8')) as { bundle: unknown };
  const source = Core.createCoreTurnPriorityBundleV1(fixture.bundle as never);
  const baseRegistry = source.stackBundle.objectRegistry;
  const objectRegistry = Core.createModeNeutralCoreObjectRegistryStateV2({
    players: baseRegistry.players,
    turnOrder: baseRegistry.turnOrder,
    activePlayerId: baseRegistry.activePlayerId,
    cardDefinitions: baseRegistry.cardDefinitions,
    physicalCards: { ...baseRegistry.physicalCards, [PC7]: { ...baseRegistry.physicalCards[PC1] } },
    objects: { ...baseRegistry.objects, [O7]: Core.createCoreCardObjectIdentityV2({ kind: 'card', physicalCardId: PC7, incarnation: 0, baseControllerPlayerId: null }) },
    zones: { byPlayer: { ...baseRegistry.zones.byPlayer, [P1]: { ...baseRegistry.zones.byPlayer[P1], library: [...baseRegistry.zones.byPlayer[P1].library, O7] } }, shared: baseRegistry.zones.shared },
  });
  const objectRuntime = Core.createModeNeutralCoreObjectRuntimeStateV2(objectRegistry, { byObject: { ...source.stackBundle.objectRuntime.byObject, [O7]: source.stackBundle.objectRuntime.byObject[O1] } });
  const stackAnnouncements = Core.createModeNeutralCoreStackAnnouncementSliceV1(objectRegistry, { byObject: source.stackBundle.stackAnnouncements.byObject });
  const stackBundle = Core.createCoreStackTransactionBundleV1({ objectRegistry, objectRuntime, stackAnnouncements });
  const lifecycle = Core.createModeNeutralCoreTurnLifecycleSliceV1({
    turnNumber: source.lifecycle.turnNumber,
    positionSequence: source.lifecycle.positionSequence,
    position: source.lifecycle.position,
    window: options.priorityHolder === undefined
      ? { kind: 'sba-check-required', priorityRecipientPlayerId: 'P2' as never, grantPriorityIfStable: true }
      : { kind: 'priority', cycleStartPlayerId: 'P2' as never, holderPlayerId: options.priorityHolder as never, passedPlayerIds: options.priorityHolder === 'P2' ? [] : options.priorityHolder === 'P3' ? ['P2'] as never : ['P2', 'P3'] as never },
  });
  const pendingTriggers = Core.createModeNeutralCorePendingTriggerSliceV1(objectRegistry, { pendingObjectIds: [], byObject: {} });
  const turnPriorityBundle = Core.createCoreTurnPriorityBundleV1({ stackBundle, pendingTriggers, lifecycle });
  const decisionAuthorities = options.separatedAuthority
    ? Core.addCoreDecisionAuthorityV1(
      Core.createModeNeutralCoreDecisionAuthoritySliceV1({ authorityOrder: [], byAuthority: {} }),
      'separated-search',
      { controlledPlayerId: 'P1' as never, decisionMakerPlayerId: 'P2' as never, sourceObjectId: null, scope: { kind: 'all-game-decisions' } },
    ).value
    : Core.createModeNeutralCoreDecisionAuthoritySliceV1({ authorityOrder: [], byAuthority: {} });
  const authority = Core.createCoreRuleAuthorityBundleV1({
    turnPriorityBundle,
    control: Core.createModeNeutralCoreControlSliceV1({ effectOrder: [], byEffect: {}, continuityByObject: { 'PC6:0': { controllerPlayerId: 'P3', continuousSinceMostRecentTurnBegan: false } } as never }),
    visibility: Core.createModeNeutralCoreVisibilitySliceV1({ grantOrder: [], byGrant: {} }),
    searchSessions: Core.createModeNeutralCoreSearchSessionSliceV1({ sessionOrder: [], bySession: {} }),
    playPermissions: Core.createModeNeutralCorePlayPermissionSliceV1({ permissionOrder: [], byPermission: {} }),
    decisionAuthorities,
  });
  const commanders = [
    Core.createCoreCommanderIdentityV1({ physicalCardId: 'PC1', ownerPlayerId: 'P1' }),
    Core.createCoreCommanderIdentityV1({ physicalCardId: 'PC3', ownerPlayerId: 'P2' }),
    Core.createCoreCommanderIdentityV1({ physicalCardId: 'PC6', ownerPlayerId: 'P3' }),
    Core.createCoreCommanderIdentityV1({ physicalCardId: 'PC5', ownerPlayerId: 'P4' }),
  ];
  const combatContext = options.combat
    ? Core.createCoreCombatContextV1({ combatId: 'combat-1', turnNumber: 4, step: 'declare-attackers', attackingPlayerId: 'P1', defendingPlayerIds: ['P2', 'P3', 'P4'], attacks: [], blocks: [] })
    : null;
  return Closure.createModeNeutralCoreRootV1({
    versions: Closure.CORE_CLOSURE_VERSION_VECTOR_V1,
    acceptedCommandCount: 0,
    ruleAuthority: authority,
    playerLifecycle: Core.createCorePlayerLifecycleStateV1({ players: ['P1', 'P2', 'P3', 'P4'].map((playerId) => ({ playerId, status: 'active', exitCause: null })) }),
    commanders,
    commanderCastLedgers: commanders.map((commander) => Core.createCoreCommanderCastLedgerV1({ commander, castCount: 0 })),
    commanderDamage: Core.createCoreCommanderDamageStateV1({ commanders, defendingPlayerIds: ['P1', 'P2', 'P3', 'P4'], entries: [{ commanderPhysicalCardId: 'PC6', defendingPlayerId: 'P4', damage: 2 }] }),
    commanderDamageProvenance: Core.createCoreCommanderDamageProvenanceLedgerV1({ commanders, defendingPlayerIds: ['P1', 'P2', 'P3', 'P4'], records: [{ combatObjectId: 'PC6:0', commanderPhysicalCardId: 'PC6', defendingPlayerId: 'P4', damage: 2 }] }),
    combatContext,
  });
}

function command(sequence: number, actorPlayerId: 'P1' | 'P2' | 'P3' | 'P4', payload: unknown, decisionContext: Closure.CoreCommandV1['decisionContext'] = { kind: 'decision', decisionKey: 'repair' }, decisionMakerPlayerId: 'P1' | 'P2' | 'P3' | 'P4' = actorPlayerId): Closure.CoreCommandV1 {
  return Closure.createCoreCommandV1({ schemaVersion: 1, sequence, actorPlayerId: actorPlayerId as never, decisionMakerPlayerId: decisionMakerPlayerId as never, decisionContext, payload: payload as never });
}

describe('O4P-01N repair wave 1', () => {
  it('normalizes hostile commands without invoking accessors and freezes nested values', () => {
    let getterCalled = false;
    const hostile = { kind: 'priority-pass', playerId: 'P1' as never, get extra(): string { getterCalled = true; return 'no'; } };
    expect(Closure.validateCoreCommandV1({ kind: 'mode-neutral-core-command-v1', schemaVersion: 1, sequence: 1, actorPlayerId: 'P1', decisionMakerPlayerId: 'P1', decisionContext: { kind: 'decision', decisionKey: 'x' }, payload: hostile })).toMatchObject({ ok: false });
    expect(getterCalled).toBe(false);
    const nested = Closure.validateCoreCommandV1({ kind: 'mode-neutral-core-command-v1', schemaVersion: 1, sequence: 1, actorPlayerId: 'P1', decisionMakerPlayerId: 'P1', decisionContext: { kind: 'decision', decisionKey: 'x' }, payload: { kind: 'combat-attack-add', attack: { attackerObjectId: 'PC6:0', attackerControllerPlayerId: 'P1', defendingPlayerId: 'P2' } } });
    expect(nested.ok).toBe(true);
    if (nested.ok && nested.value.payload.kind === 'combat-attack-add') expect(Object.isFrozen(nested.value.payload.attack)).toBe(true);
    const sparse = new Array(1) as unknown[];
    expect(Closure.validateCoreCommandV1({ kind: 'mode-neutral-core-command-v1', schemaVersion: 1, sequence: 1, actorPlayerId: 'P1', decisionMakerPlayerId: 'P1', decisionContext: { kind: 'decision', decisionKey: 'x' }, payload: { kind: 'search-complete', sessionKey: 's', selectedObjectIds: sparse } })).toMatchObject({ ok: false });
    const hostileContext = new Proxy({ kind: 'decision', decisionKey: 'x' }, {
      getOwnPropertyDescriptor(): PropertyDescriptor { throw new Error('descriptor trap'); },
    });
    const hostileContextResult = Closure.validateCoreCommandV1({ kind: 'mode-neutral-core-command-v1', schemaVersion: 1, sequence: 1, actorPlayerId: 'P1', decisionMakerPlayerId: 'P1', decisionContext: hostileContext, payload: { kind: 'priority-pass', playerId: 'P1' } });
    expect(hostileContextResult.ok).toBe(false);
    if (!hostileContextResult.ok) expect(hostileContextResult.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INVALID_DESCRIPTOR', path: '/decisionContext/decisionKey' }),
      expect.objectContaining({ code: 'INVALID_DESCRIPTOR', path: '/decisionContext/kind' }),
    ]));
  });

  it('rejects hostile root array descriptors without throwing', () => {
    const root = makeRoot({ priorityHolder: 'P2' });
    const hostileCommanders = new Proxy([...root.commanders], {
      getOwnPropertyDescriptor(target, key): PropertyDescriptor | undefined {
        if (key === '0') throw new Error('array descriptor trap');
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    const result = Closure.validateModeNeutralCoreRootV1({ ...root, commanders: hostileCommanders });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INVALID_DESCRIPTOR', path: '/commanders/0' }),
    ]));

    const revokedCommanders = Proxy.revocable([...root.commanders], {});
    revokedCommanders.revoke();
    const revokedResult = Closure.validateModeNeutralCoreRootV1({ ...root, commanders: revokedCommanders.proxy });
    expect(revokedResult.ok).toBe(false);
    if (!revokedResult.ok) expect(revokedResult.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INVALID_DESCRIPTOR', path: '/commanders' }),
    ]));
  });

  it('requires turn order to match the active lifecycle roster in order', () => {
    const root = makeRoot({ priorityHolder: 'P2' });
    const registry = root.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
    const reversedRegistry = Core.createModeNeutralCoreObjectRegistryStateV2({
      players: registry.players,
      turnOrder: [...registry.turnOrder].reverse(),
      activePlayerId: registry.activePlayerId,
      cardDefinitions: registry.cardDefinitions,
      physicalCards: registry.physicalCards,
      objects: registry.objects,
      zones: registry.zones,
    });
    const stackBundle = Core.createCoreStackTransactionBundleV1({ ...root.ruleAuthority.turnPriorityBundle.stackBundle, objectRegistry: reversedRegistry });
    const turnPriorityBundle = Core.createCoreTurnPriorityBundleV1({ ...root.ruleAuthority.turnPriorityBundle, stackBundle });
    const ruleAuthority = Core.createCoreRuleAuthorityBundleV1({ ...root.ruleAuthority, turnPriorityBundle });
    expect(Closure.validateModeNeutralCoreRootV1({ ...root, ruleAuthority })).toMatchObject({ ok: false, issues: [{ code: 'TURN_ORDER_MISMATCH' }] });
  });

  it('returns the real unchanged digest for malformed, authority, sequence, and operation rejections', () => {
    const root = makeRoot({ priorityHolder: 'P2' });
    const expected = Closure.coreCanonicalDigestFromValueV1(root);
    const malformed = Closure.applyCoreCommandV1(root, { payload: { kind: 'priority-pass' } } as never);
    expect(malformed).toMatchObject({ status: 'rejected', beforeStateDigest: expected, afterStateDigest: expected, events: [] });
    const wrongPayload = Closure.applyCoreCommandV1(root, command(1, 'P2', { kind: 'priority-pass', playerId: 'P3' }));
    expect(wrongPayload).toMatchObject({ status: 'rejected', beforeStateDigest: expected, afterStateDigest: expected });
    const stale = Closure.applyCoreCommandV1(root, command(2, 'P2', { kind: 'priority-pass', playerId: 'P2' }));
    expect(stale).toMatchObject({ status: 'rejected', beforeStateDigest: expected, afterStateDigest: expected });
    const operationFailure = Closure.applyCoreCommandV1(root, command(1, 'P2', { kind: 'combat-step-set', step: 'declare-blockers' }));
    expect(operationFailure).toMatchObject({ status: 'rejected', beforeStateDigest: expected, afterStateDigest: expected });
  });

  it('binds authority to payload and uses typed exit boundaries', () => {
    const root = makeRoot({ priorityHolder: 'P3' });
    const digest = Closure.coreCanonicalDigestFromValueV1(root);
    const pass = Closure.applyCoreCommandV1(root, command(1, 'P2', { kind: 'priority-pass', playerId: 'P3' }));
    expect(pass).toMatchObject({ status: 'rejected', beforeStateDigest: digest, afterStateDigest: digest });
    const mismatchedSearch = Closure.applyCoreCommandV1(root, command(1, 'P1', { kind: 'search-open', sessionKey: 'mismatch-search', input: { zone: { kind: 'player-zone', playerId: 'P2', zone: 'library' }, portion: { kind: 'all' }, criteria: { kind: 'quantity', minimum: 0, maximum: 1 }, revealFound: false, shuffleAfter: false, rulesActorPlayerId: 'P2' } }, { kind: 'search-session', searchSessionId: 'mismatch-search' }));
    expect(mismatchedSearch).toMatchObject({ status: 'rejected', issues: [{ code: 'ACTOR_PAYLOAD_MISMATCH' }] });
    const activeExit = Closure.applyCoreCommandV1(root, command(1, 'P2', { kind: 'player-exit', playerId: 'P2', cause: 'concession' }));
    expect(activeExit).toMatchObject({ status: 'rejected', root, events: [], beforeStateDigest: digest, afterStateDigest: digest, issues: [{ code: 'ACTIVE_PLAYER_EXIT_REQUIRES_TURN_TRANSITION' }] });
    const priorityRoot = makeRoot({ priorityHolder: 'P4' });
    const priorityExit = Closure.applyCoreCommandV1(priorityRoot, command(1, 'P4', { kind: 'player-exit', playerId: 'P4', cause: 'defeat' }));
    expect(priorityExit).toMatchObject({ status: 'rejected', issues: [{ code: 'PRIORITY_HOLDER_EXIT_REQUIRES_TURN_TRANSITION' }] });
    const separatedRoot = makeRoot({ priorityHolder: 'P3', separatedAuthority: true });
    const selectorMismatch = Closure.applyCoreCommandV1(separatedRoot, command(1, 'P1', { kind: 'search-open', sessionKey: 'separated-search', input: { zone: { kind: 'player-zone', playerId: 'P1', zone: 'library' }, portion: { kind: 'all' }, criteria: { kind: 'quantity', minimum: 0, maximum: 1 }, revealFound: false, shuffleAfter: false, rulesActorPlayerId: 'P1' } }, { kind: 'search-session', searchSessionId: 'separated-search' }));
    expect(selectorMismatch).toMatchObject({ status: 'rejected', root: separatedRoot, events: [], issues: [{ code: 'DECISION_AUTHORITY_MISMATCH' }] });
    const separatedOpen = Closure.applyCoreCommandV1(separatedRoot, command(1, 'P1', { kind: 'search-open', sessionKey: 'separated-search', input: { zone: { kind: 'player-zone', playerId: 'P1', zone: 'library' }, portion: { kind: 'all' }, criteria: { kind: 'quantity', minimum: 0, maximum: 1 }, revealFound: false, shuffleAfter: false, rulesActorPlayerId: 'P1' } }, { kind: 'search-session', searchSessionId: 'separated-search' }, 'P2'));
    expect(separatedOpen.status).toBe('accepted');
    if (separatedOpen.status === 'accepted') expect(separatedOpen.root.ruleAuthority.searchSessions.bySession['separated-search'].selectorPlayerId).toBe('P2');
  });

  it('binds the remaining payload actor fields and rejects inactive defenders atomically', () => {
    const root = makeRoot({ priorityHolder: 'P2' });
    const announcement = (root.ruleAuthority.turnPriorityBundle.stackBundle.stackAnnouncements.byObject as Record<string, unknown>)['PC5:1'];
    expect(Closure.applyCoreCommandV1(root, command(1, 'P2', { kind: 'stack-commit-card-spell', input: { sourceObjectId: 'PC2:0', controllerPlayerId: 'P1', announcement: announcement as never } }))).toMatchObject({ status: 'rejected', issues: [{ code: 'ACTOR_PAYLOAD_MISMATCH' }] });
    expect(Closure.applyCoreCommandV1(root, command(1, 'P2', { kind: 'commander-cast-record', physicalCardId: 'PC1', origin: 'command-zone', accepted: true }))).toMatchObject({ status: 'rejected', issues: [{ code: 'ACTOR_PAYLOAD_MISMATCH' }] });
    const combatRoot = makeRoot({ combat: true });
    expect(Closure.applyCoreCommandV1(combatRoot, command(1, 'P2', { kind: 'combat-attack-add', attack: { attackerObjectId: 'PC6:0', attackerControllerPlayerId: 'P1', defendingPlayerId: 'P2' } }))).toMatchObject({ status: 'rejected', issues: [{ code: 'ACTOR_PAYLOAD_MISMATCH' }] });
    const attack = Closure.applyCoreCommandV1(combatRoot, command(1, 'P1', { kind: 'combat-attack-add', attack: { attackerObjectId: 'PC6:0', attackerControllerPlayerId: 'P1', defendingPlayerId: 'P2' } }));
    expect(attack.status).toBe('accepted');
    if (attack.status === 'accepted') expect(Closure.applyCoreCommandV1(attack.root, command(2, 'P1', { kind: 'combat-block-add', block: { blockerObjectId: 'PC3:0', blockerControllerPlayerId: 'P2', attackedObjectId: 'PC6:0', defendingPlayerId: 'P2' } }))).toMatchObject({ status: 'rejected', issues: [{ code: 'ACTOR_PAYLOAD_MISMATCH' }] });
    expect(Closure.applyCoreCommandV1(root, command(1, 'P2', { kind: 'random-zone-order', randomDecisionId: 'random-player', zone: { kind: 'player-zone', playerId: 'P1', zone: 'library' }, beforeOrder: ['PC1:0'], afterOrder: ['PC1:0'] }))).toMatchObject({ status: 'rejected', issues: [{ code: 'ACTOR_PAYLOAD_MISMATCH' }] });
    const provenanceMismatch = Closure.applyCoreCommandV1(root, command(1, 'P2', { kind: 'commander-damage-record', physicalCardId: 'PC1', defendingPlayerId: 'P4', damage: 1, combatObjectId: 'PC6:0' }));
    expect(provenanceMismatch).toMatchObject({ status: 'rejected', issues: [{ code: 'COMMANDER_PROVENANCE_MISMATCH' }] });
    const exited = Closure.applyCoreCommandV1(root, command(1, 'P4', { kind: 'player-exit', playerId: 'P4', cause: 'concession' }));
    expect(exited.status).toBe('accepted');
    if (exited.status === 'accepted') expect(Closure.applyCoreCommandV1(exited.root, command(2, 'P2', { kind: 'commander-damage-record', physicalCardId: 'PC6', defendingPlayerId: 'P4', damage: 1, combatObjectId: 'PC6:0' }))).toMatchObject({ status: 'rejected', issues: [{ code: 'PLAYER_INACTIVE' }] });
  });

  it('retains rejected journal sequence, hides correction reason metadata, and hardens identifier grammars', () => {
    const root = makeRoot({ priorityHolder: 'P2' });
    const rejectedCommand = command(1, 'P2', { kind: 'priority-pass', playerId: 'P3' });
    const rejected = Closure.applyCoreCommandV1(root, rejectedCommand);
    const acceptedCommand = command(1, 'P2', { kind: 'priority-pass', playerId: 'P2' });
    const accepted = Closure.applyCoreCommandV1(root, acceptedCommand);
    expect(rejected.status).toBe('rejected');
    expect(accepted.status).toBe('accepted');
    if (rejected.status === 'rejected' && accepted.status === 'accepted') {
      const journal = Closure.appendCoreCommandJournalEntryV1([], rejectedCommand, rejected);
      const completeJournal = Closure.appendCoreCommandJournalEntryV1(journal, acceptedCommand, accepted);
      const packageValue = Closure.createCoreReplayPackageV1(root, completeJournal);
      expect(Closure.replayCoreCommandsV1(JSON.parse(JSON.stringify(packageValue)) as never)).toMatchObject({ ok: true, finalStateDigest: Closure.coreCanonicalDigestFromValueV1(accepted.root) });
      const gapped = JSON.parse(JSON.stringify(packageValue)) as { journal: Array<{ command: { sequence: number } }> };
      gapped.journal[1].command.sequence = 2;
      expect(Closure.validateCoreReplayPackageV1(gapped as never)).toMatchObject({ ok: false, issues: [{ code: 'SEQUENCE_MISMATCH', path: '/journal/1/command/sequence' }] });
    }
    const mutableCommand = JSON.parse(JSON.stringify(acceptedCommand)) as Closure.CoreCommandV1;
    const normalizedJournal = Closure.appendCoreCommandJournalEntryV1([], mutableCommand, accepted);
    expect(normalizedJournal[0]?.command).not.toBe(mutableCommand);
    expect(Object.isFrozen(normalizedJournal[0]?.command)).toBe(true);
    expect(Object.isFrozen(normalizedJournal[0]?.command.decisionContext)).toBe(true);
    expect(Object.isFrozen(normalizedJournal[0]?.command.payload)).toBe(true);
    expect(normalizedJournal[0]?.commandDigest).toBe(Closure.coreCanonicalDigestFromValueV1(normalizedJournal[0]?.command));
    const shortCorrection = Closure.applyCoreCommandV1(root, command(1, 'P2', { kind: 'correct-player-life', playerId: 'P2', replacementLifeTotal: 39, expectedBeforeStateDigest: Closure.coreCanonicalDigestFromValueV1(root), reason: 'short' }));
    const longCorrection = Closure.applyCoreCommandV1(root, command(1, 'P2', { kind: 'correct-player-life', playerId: 'P2', replacementLifeTotal: 39, expectedBeforeStateDigest: Closure.coreCanonicalDigestFromValueV1(root), reason: 'a much longer private reason' }));
    expect(shortCorrection.status).toBe('accepted-with-warning');
    expect(longCorrection.status).toBe('accepted-with-warning');
    if (shortCorrection.status === 'accepted-with-warning' && longCorrection.status === 'accepted-with-warning') expect(shortCorrection.events[0]?.payload).toEqual(longCorrection.events[0]?.payload);
    const badPlayer = Closure.validateCoreCommandV1({ kind: 'mode-neutral-core-command-v1', schemaVersion: 1, sequence: 1, actorPlayerId: '@P1', decisionMakerPlayerId: 'P1', decisionContext: { kind: 'decision', decisionKey: 'constructor' }, payload: { kind: 'priority-pass', playerId: 'P1' } });
    expect(badPlayer).toMatchObject({ ok: false, issues: [{ path: '/actorPlayerId', code: 'INVALID_ID' }, { path: '/decisionContext/decisionKey', code: 'UNSAFE_RECORD_KEY' }] });
    const badObject = Closure.validateCoreCommandV1({ kind: 'mode-neutral-core-command-v1', schemaVersion: 1, sequence: 1, actorPlayerId: 'P1', decisionMakerPlayerId: 'P1', decisionContext: { kind: 'decision', decisionKey: 'main' }, payload: { kind: 'search-complete', sessionKey: 'search', selectedObjectIds: ['PC1'] } });
    expect(badObject).toMatchObject({ ok: false, issues: [{ path: '/payload/selectedObjectIds/0', code: 'INVALID_ID' }] });
    const sharedRandom = Closure.validateCoreCommandV1({ kind: 'mode-neutral-core-command-v1', schemaVersion: 1, sequence: 1, actorPlayerId: 'P1', decisionMakerPlayerId: 'P1', decisionContext: { kind: 'decision', decisionKey: 'main' }, payload: { kind: 'random-zone-order', randomDecisionId: 'random', zone: { kind: 'shared-zone', zone: 'stack' }, beforeOrder: [], afterOrder: [] } });
    expect(sharedRandom).toMatchObject({ ok: false, issues: [{ path: '/payload/zone', code: 'INVALID_RANDOM_ZONE' }] });
  });

  it('rejects hostile random-order arrays without invoking accessors or throwing', () => {
    const revoked = Proxy.revocable<CoreObjectId[]>([], {});
    revoked.revoke();
    const revokedIssues = Closure.validateCoreRandomZoneOrderV1({ randomDecisionId: 'random', zone: { kind: 'player-zone', playerId: 'P1' as never, zone: 'library' }, beforeOrder: revoked.proxy, afterOrder: [] }, []);
    expect(revokedIssues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'INVALID_DESCRIPTOR', path: '/beforeOrder' })]));

    let getterCalled = false;
    const hostile = { randomDecisionId: 'random', zone: { kind: 'player-zone', playerId: 'P1', zone: 'library' }, afterOrder: [] } as Record<string, unknown>;
    Object.defineProperty(hostile, 'beforeOrder', { enumerable: true, get: () => { getterCalled = true; return []; } });
    const accessorIssues = Closure.validateCoreRandomZoneOrderV1(hostile as never, []);
    expect(accessorIssues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'INVALID_DESCRIPTOR', path: '/beforeOrder' })]));
    expect(getterCalled).toBe(false);
  });

  it('closes the complete deterministic four-player payload surface and round-trips replay', () => {
    const initialRoot = makeRoot({ priorityHolder: 'P3', combat: true, separatedAuthority: true });
    let root = initialRoot;
    const commands: Closure.CoreCommandV1[] = [];
    const apply = (actor: 'P1' | 'P2' | 'P3' | 'P4', payload: unknown, context?: Closure.CoreCommandV1['decisionContext'], decisionMaker: 'P1' | 'P2' | 'P3' | 'P4' = actor): void => {
      const current = Closure.applyCoreCommandV1(root, command(root.acceptedCommandCount + 1, actor, payload, context, decisionMaker));
      expect(current.status, JSON.stringify(current)).toMatch(/accepted/);
      commands.push(command(root.acceptedCommandCount + 1, actor, payload, context, decisionMaker));
      root = current.root;
    };
    apply('P3', { kind: 'priority-pass', playerId: 'P3' });
    apply('P4', { kind: 'priority-pass', playerId: 'P4' });
    const announcement = (initialRoot.ruleAuthority.turnPriorityBundle.stackBundle.stackAnnouncements.byObject as Record<string, unknown>)['PC5:1'];
    apply('P1', { kind: 'stack-commit-card-spell', input: { sourceObjectId: 'PC2:0', controllerPlayerId: 'P1', announcement: announcement as never } }, undefined, 'P2');
    const committedObjectId = root.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.zones.shared.stack.find((id) => id.startsWith('PC2:')) as CoreObjectId;
    apply('P1', { kind: 'stack-remove-object', input: { kind: 'card-to-zone', objectId: committedObjectId, destination: { kind: 'owner-graveyard' } } }, undefined, 'P2');
    apply('P1', { kind: 'search-open', sessionKey: 'search-1', input: { zone: { kind: 'player-zone', playerId: 'P1', zone: 'library' }, portion: { kind: 'all' }, criteria: { kind: 'quantity', minimum: 0, maximum: 1 }, revealFound: false, shuffleAfter: false, rulesActorPlayerId: 'P1' } }, { kind: 'search-session', searchSessionId: 'search-1' }, 'P2');
    apply('P1', { kind: 'search-complete', sessionKey: 'search-1', selectedObjectIds: ['PC1:0'] }, { kind: 'search-session', searchSessionId: 'search-1' }, 'P2');
    apply('P4', { kind: 'control-effect-apply', effectKey: 'effect-1', effect: { targetObjectId: 'PC6:0', gainingControllerPlayerId: 'P4', sourceObjectId: null, duration: { kind: 'indefinite' } } });
    apply('P1', { kind: 'commander-cast-record', physicalCardId: 'PC1', origin: 'command-zone', accepted: true }, undefined, 'P2');
    apply('P1', { kind: 'combat-attack-add', attack: { attackerObjectId: 'PC6:0', attackerControllerPlayerId: 'P1', defendingPlayerId: 'P2' } }, undefined, 'P2');
    apply('P1', { kind: 'combat-step-set', step: 'declare-blockers' }, undefined, 'P2');
    apply('P2', { kind: 'combat-block-add', block: { blockerObjectId: 'PC3:0', blockerControllerPlayerId: 'P2', attackedObjectId: 'PC6:0', defendingPlayerId: 'P2' } });
    apply('P1', { kind: 'commander-damage-record', physicalCardId: 'PC6', defendingPlayerId: 'P2', damage: 3, combatObjectId: 'PC6:0' }, undefined, 'P2');
    const randomBefore = root.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry.zones.byPlayer[P1].library;
    expect(randomBefore.length).toBeGreaterThan(1);
    apply('P1', { kind: 'random-zone-order', randomDecisionId: 'random-1', zone: { kind: 'player-zone', playerId: 'P1', zone: 'library' }, beforeOrder: randomBefore, afterOrder: randomBefore.slice().reverse() }, undefined, 'P2');
    const lifeDigest = Closure.coreCanonicalDigestFromValueV1(root);
    apply('P2', { kind: 'correct-player-life', playerId: 'P2', replacementLifeTotal: 39, expectedBeforeStateDigest: lifeDigest, reason: 'judge-only reason: life repair' });
    const damageDigest = Closure.coreCanonicalDigestFromValueV1(root);
    apply('P2', { kind: 'correct-commander-damage', physicalCardId: 'PC1', defendingPlayerId: 'P2', replacementDamageTotal: 4, expectedBeforeStateDigest: damageDigest, reason: 'judge-only reason: damage repair' });
    apply('P4', { kind: 'player-exit', playerId: 'P4', cause: 'concession' });
    const closure = Closure.runOrdinaryFourPlayerCoreClosureV1(initialRoot, commands);
    expect(closure.playerIds).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(closure.finalRoot.commanders).toHaveLength(4);
    expect(closure.finalRoot.commanders.some((commander) => commander.ownerPlayerId === 'P4')).toBe(true);
    expect(closure.finalRoot.playerLifecycle.players.find((entry) => entry.playerId === 'P4')?.status).toBe('exited');
    const finalRegistry = closure.finalRoot.ruleAuthority.turnPriorityBundle.stackBundle.objectRegistry;
    expect(Object.prototype.hasOwnProperty.call(finalRegistry.players, 'P4')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(finalRegistry.zones.byPlayer, 'P4')).toBe(false);
    expect(finalRegistry.turnOrder).not.toContain('P4');
    expect(closure.finalRoot.commanderDamage.defendingPlayerIds).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(closure.finalRoot.commanderDamage.entries.some((entry) => entry.defendingPlayerId === 'P4')).toBe(true);
    expect(closure.finalRoot.commanderDamageProvenance.defendingPlayerIds).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(closure.finalRoot.commanderDamageProvenance.records.some((entry) => entry.defendingPlayerId === 'P4')).toBe(true);
    expect(closure.events.some((event) => event.payload.kind === 'manual-correction-applied')).toBe(true);
    expect(JSON.stringify(closure.events)).not.toContain('judge-only reason');
    expect(JSON.stringify(closure.journal)).toContain('judge-only reason');
    const replay = Closure.replayCoreCommandsV1(JSON.parse(JSON.stringify(closure.replayPackage)) as never);
    expect(replay).toMatchObject({ ok: true, finalStateDigest: closure.finalStateDigest, eventTranscriptDigest: Closure.coreCanonicalDigestFromValueV1(closure.events) });
    const tamperedRandom = JSON.parse(JSON.stringify(closure.replayPackage)) as { journal: Array<{ command: { payload: { kind: string; afterOrder?: string[] } } }> };
    const randomEntry = tamperedRandom.journal.find((entry) => entry.command.payload.kind === 'random-zone-order');
    expect(randomEntry?.command.payload.afterOrder?.length).toBeGreaterThan(1);
    if (randomEntry?.command.payload.afterOrder) randomEntry.command.payload.afterOrder = randomEntry.command.payload.afterOrder.slice().reverse();
    const tamperedReplay = Closure.replayCoreCommandsV1(tamperedRandom as never);
    expect(tamperedReplay.ok).toBe(false);
    if (!tamperedReplay.ok) expect(tamperedReplay.divergence.journalIndex).toBeGreaterThanOrEqual(0);
    const tamperedReason = JSON.parse(JSON.stringify(closure.replayPackage)) as { journal: Array<{ command: { payload: { kind: string; reason?: string } } }> };
    const correctionIndex = tamperedReason.journal.findIndex((entry) => entry.command.payload.kind === 'correct-player-life');
    expect(correctionIndex).toBeGreaterThanOrEqual(0);
    if (correctionIndex >= 0) tamperedReason.journal[correctionIndex].command.payload.reason = 'tampered private reason';
    expect(Closure.replayCoreCommandsV1(tamperedReason as never)).toMatchObject({ ok: false, divergence: { code: 'COMMAND_DIGEST_MISMATCH', journalIndex: correctionIndex } });
    const stale = Closure.applyCoreCommandV1(root, command(root.acceptedCommandCount + 1, 'P2', { kind: 'correct-player-life', playerId: 'P2', replacementLifeTotal: 38, expectedBeforeStateDigest: lifeDigest, reason: 'stale' }));
    expect(stale).toMatchObject({ status: 'rejected', root, events: [] });
    expect(closure.deferred).toEqual(['full-combat-damage', 'arbitrary-manual-state-mutation', 'network', 'room', 'projection', 'ui']);
    const inactiveDamage = Closure.applyCoreCommandV1(closure.finalRoot, command(closure.finalRoot.acceptedCommandCount + 1, 'P1', { kind: 'commander-damage-record', physicalCardId: 'PC6', defendingPlayerId: 'P4', damage: 1, combatObjectId: 'PC6:0' }, undefined, 'P2'));
    expect(inactiveDamage).toMatchObject({ status: 'rejected', root: closure.finalRoot, events: [], issues: [{ code: 'PLAYER_INACTIVE' }] });
  });

  it('reports first replay tampering and rejects hostile journal/package structures', () => {
    const root = makeRoot({ priorityHolder: 'P2' });
    const cmd = command(1, 'P2', { kind: 'priority-pass', playerId: 'P2' });
    const result = Closure.applyCoreCommandV1(root, cmd);
    expect(result.status).toBe('accepted');
    if (result.status !== 'accepted') return;
    const entry = Closure.appendCoreCommandJournalEntryV1([], cmd, result)[0];
    const packageValue = Closure.createCoreReplayPackageV1(root, [entry]);
    const tamperedStatus = JSON.parse(JSON.stringify(packageValue)) as { journal: Array<{ status: string }> };
    tamperedStatus.journal[0].status = 'rejected';
    expect(Closure.replayCoreCommandsV1(tamperedStatus as never)).toMatchObject({ ok: false, divergence: { code: 'STATUS_MISMATCH', journalIndex: 0 } });
    const tamperedBefore = JSON.parse(JSON.stringify(packageValue)) as { journal: Array<{ beforeStateDigest: string }> };
    tamperedBefore.journal[0].beforeStateDigest = '0'.repeat(64);
    expect(Closure.replayCoreCommandsV1(tamperedBefore as never)).toMatchObject({ ok: false, divergence: { code: 'BEFORE_DIGEST_MISMATCH', journalIndex: 0 } });
    const tamperedVersion = JSON.parse(JSON.stringify(packageValue)) as { versions: { coreStateSchemaVersion: number } };
    tamperedVersion.versions.coreStateSchemaVersion = 2;
    expect(Closure.replayCoreCommandsV1(tamperedVersion as never)).toMatchObject({ ok: false, divergence: { code: 'INVALID_PACKAGE', journalIndex: -1 } });
    const tamperedSequence = JSON.parse(JSON.stringify(packageValue)) as { journal: Array<{ command: { sequence: number } }> };
    tamperedSequence.journal[0].command.sequence = 3;
    expect(Closure.validateCoreReplayPackageV1(tamperedSequence as never)).toMatchObject({ ok: false, issues: [{ code: 'SEQUENCE_MISMATCH', path: '/journal/0/command/sequence' }] });
    let getterCalled = false;
    const hostile = Object.defineProperty({}, 'kind', { enumerable: true, get: () => { getterCalled = true; return 'mode-neutral-core-command-journal-entry-v1'; } });
    expect(Closure.validateCoreCommandJournalEntryV1(hostile)).toMatchObject({ ok: false });
    expect(getterCalled).toBe(false);
    const proxied = new Proxy({}, { ownKeys: () => { throw new Error('trap'); } });
    expect(Closure.validateCoreReplayPackageV1(proxied)).toMatchObject({ ok: false, issues: [{ code: 'INVALID_DESCRIPTOR' }] });
  });
});
