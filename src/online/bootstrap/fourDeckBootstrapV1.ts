import {
  coreCardObjectIdOf,
  createCoreCommanderCastLedgerV1,
  createCoreCommanderDamageProvenanceLedgerV1,
  createCoreCommanderDamageStateV1,
  createCoreCommanderIdentityV1,
  createCoreRuleAuthorityBundleV1,
  createCoreStackTransactionBundleV1,
  createCoreTurnPriorityBundleV1,
  createModeNeutralCoreObjectRegistryStateV2,
  createModeNeutralCoreObjectRuntimeStateV2,
  createModeNeutralCorePendingTriggerSliceV1,
  createModeNeutralCoreRootV1,
  createCorePlayerLifecycleStateV1,
  createModeNeutralCoreControlSliceV1,
  createModeNeutralCoreDecisionAuthoritySliceV1,
  createModeNeutralCorePlayPermissionSliceV1,
  createModeNeutralCoreSearchSessionSliceV1,
  createModeNeutralCoreTurnLifecycleSliceV1,
  createModeNeutralCoreVisibilitySliceV1,
  createModeNeutralCoreStackAnnouncementSliceV1,
  CORE_CLOSURE_VERSION_VECTOR_V1,
  coreCanonicalDigestFromValueV1,
  serializeModeNeutralCoreRootV1,
  createCoreReplayPackageV1,
  replayCoreCommandsV1,
  type CoreCardDefinitionSnapshotV1,
  type CorePhysicalCardV1,
  type CoreCardObjectRuntimeStateV1,
  type CorePlayerId,
  type CoreObjectId,
  type ModeNeutralCoreRootV1,
} from '../../engine/core/index';
import { parseDeckList } from '../../data/deckParser';
import type { ParsedDeck } from '../../data/deckParser';
import {
  activateOnlineRoomV1,
  createOnlineRoomV1,
  joinOnlineRoomV1,
  setOnlineRoomPlayerReadyV1,
  startOnlineRoomV1,
  type OnlineRoomV1,
} from '../room/index';
import { isOnlineRoomApplicationIdV1, isOnlineRoomSeatCapabilityV1 } from '../room/validationSupport';
import { validateBuildId } from '../../versioning/index';
import { assertNoConfiguredCapabilityFragmentV1 } from '../cloudflare/codec';
import {
  createOnlineProtocolStateV1,
  type OnlineProtocolStateV1,
} from '../protocol/index';
import {
  evaluateO4P06ASizeGateV1,
  type BootstrapSizeEvidenceV1,
  type BootstrapSizeIssueV1,
} from './sizeGateV1';
import {
  O4P06A_CARD_CATALOG_V1,
  type BootstrapIssueV1,
} from './catalog/catalogV1';

export type FourDeckBootstrapSeatInputV1 = Readonly<{
  readonly seatIndex: number;
  readonly corePlayerId: string;
  readonly participantId: string;
  readonly seatCapability: string;
  readonly deckId: string;
  readonly deckText: string;
}>;

export type FourDeckBootstrapInputV1 = Readonly<{
  readonly roomId: string;
  readonly serverBuildId: string;
  readonly seats: readonly FourDeckBootstrapSeatInputV1[];
}>;

export type FourDeckBootstrapSuccessV1 = Readonly<{
  readonly ok: true;
  readonly coreRoot: ModeNeutralCoreRootV1;
  readonly room: OnlineRoomV1;
  readonly protocolState: OnlineProtocolStateV1;
  readonly replayPackage: ReturnType<typeof createCoreReplayPackageV1>;
  readonly replay: ReturnType<typeof replayCoreCommandsV1>;
  readonly coreCanonical: string;
  readonly coreDigest: string;
  readonly sizeEvidence: BootstrapSizeEvidenceV1;
  readonly measurements: BootstrapSizeEvidenceV1['artifacts'];
}>;

export type FourDeckBootstrapFailureV1 = Readonly<{ readonly ok: false; readonly issues: readonly (BootstrapIssueV1 | BootstrapSizeIssueV1)[] }>;
export type FourDeckBootstrapResultV1 = FourDeckBootstrapSuccessV1 | FourDeckBootstrapFailureV1;

const PLAYER_IDS = ['P1', 'P2', 'P3', 'P4'] as const;
const ROOT_FIELDS = ['roomId', 'serverBuildId', 'seats'] as const;
const SEAT_FIELDS = ['seatIndex', 'corePlayerId', 'participantId', 'seatCapability', 'deckId', 'deckText'] as const;

function compare(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const delta = left.charCodeAt(index) - right.charCodeAt(index);
    if (delta !== 0) return delta;
  }
  return left.length - right.length;
}

function issue(code: string, path: string, message: string): BootstrapIssueV1 {
  return Object.freeze({ code, path, message });
}

function sorted(issues: readonly (BootstrapIssueV1 | BootstrapSizeIssueV1)[]): readonly (BootstrapIssueV1 | BootstrapSizeIssueV1)[] {
  const seen = new Map<string, BootstrapIssueV1 | BootstrapSizeIssueV1>();
  for (const current of issues) {
    const key = `${current.path}\u0000${current.code}\u0000${current.message}`;
    if (!seen.has(key)) seen.set(key, current);
  }
  return Object.freeze([...seen.values()].sort((left, right) => compare(left.path, right.path) || compare(left.code, right.code) || compare(left.message, right.message)).map((current) => Object.freeze({ ...current })));
}

function plain(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype = Reflect.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function read(value: Record<string, unknown>, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && descriptor.enumerable === true && 'value' in descriptor ? descriptor.value : undefined;
}

function capabilityIdentifierIssues(
  roomId: string,
  serverBuildId: string,
  seats: readonly FourDeckBootstrapSeatInputV1[],
): readonly BootstrapIssueV1[] {
  const configuredCapabilities = seats
    .map((seat) => seat.seatCapability)
    .filter((capability) => isOnlineRoomSeatCapabilityV1(capability));
  const identifiers: readonly (readonly [string, string])[] = [
    ['/roomId', roomId],
    ['/serverBuildId', serverBuildId],
    ...seats.flatMap((seat, index) => [
      [`/seats/${index}/participantId`, seat.participantId],
      [`/seats/${index}/deckId`, seat.deckId],
    ] as const),
  ];
  const issues: BootstrapIssueV1[] = [];
  for (const [path, value] of identifiers) {
    try {
      assertNoConfiguredCapabilityFragmentV1(value, configuredCapabilities);
    } catch {
      issues.push(issue('CAPABILITY_FRAGMENT_IN_IDENTIFIER', path, 'Identifier contains configured capability data'));
    }
  }
  return sorted(issues);
}

type ValidatedInputV1 = Readonly<{ readonly seats: readonly FourDeckBootstrapSeatInputV1[]; readonly roomId: string; readonly serverBuildId: string; readonly issues: readonly BootstrapIssueV1[] }>;

function validateInput(input: unknown): ValidatedInputV1 | { readonly issues: readonly BootstrapIssueV1[] } {
  const issues: BootstrapIssueV1[] = [];
  if (!plain(input)) return { issues: sorted([issue('INVALID_INPUT', '', 'Bootstrap input must be a plain record')]) };
  for (const key of Reflect.ownKeys(input)) if (typeof key !== 'string' || !ROOT_FIELDS.includes(key as (typeof ROOT_FIELDS)[number])) issues.push(issue('UNKNOWN_FIELD', `/${String(key)}`, 'Unknown bootstrap input field'));
  for (const key of ROOT_FIELDS) if (!Object.prototype.hasOwnProperty.call(input, key)) issues.push(issue('MISSING_FIELD', `/${key}`, 'Missing bootstrap input field'));
  const roomId = read(input, 'roomId');
  const serverBuildId = read(input, 'serverBuildId');
  if (typeof roomId !== 'string') issues.push(issue('INVALID_ID', '/roomId', 'Room ID must be a string'));
  else if (!isOnlineRoomApplicationIdV1(roomId)) issues.push(issue('INVALID_ID', '/roomId', 'Invalid Room ID'));
  if (typeof serverBuildId !== 'string') issues.push(issue('INVALID_BUILD_ID', '/serverBuildId', 'Build ID must be a string'));
  else if (!validateBuildId(serverBuildId).ok) issues.push(issue('INVALID_BUILD_ID', '/serverBuildId', 'Invalid server Build ID'));
  const rawSeats = read(input, 'seats');
  if (!Array.isArray(rawSeats)) {
    issues.push(issue('INVALID_ARRAY', '/seats', 'Seats must be a dense array'));
    return { issues: sorted(issues) };
  }
  if (rawSeats.length !== 4) issues.push(issue('INVALID_ARRAY_LENGTH', '/seats', 'Exactly four seats are required'));
  for (let index = 0; index < rawSeats.length; index += 1) if (!Object.prototype.hasOwnProperty.call(rawSeats, index)) issues.push(issue('NON_DENSE_ARRAY', `/seats/${index}`, 'Seats must be dense'));
  const seats: FourDeckBootstrapSeatInputV1[] = [];
  const deckIds = new Map<string, number>();
  const deckTexts = new Map<string, number>();
  const participantIds = new Map<string, number>();
  const capabilities = new Map<string, number>();
  rawSeats.forEach((rawSeat, index) => {
    const path = `/seats/${index}`;
    if (!plain(rawSeat)) {
      issues.push(issue('INVALID_SEAT', path, 'Seat must be a plain record'));
      return;
    }
    for (const key of Reflect.ownKeys(rawSeat)) if (typeof key !== 'string' || !SEAT_FIELDS.includes(key as (typeof SEAT_FIELDS)[number])) issues.push(issue('UNKNOWN_FIELD', `${path}/${String(key)}`, 'Unknown seat field'));
    for (const key of SEAT_FIELDS) if (!Object.prototype.hasOwnProperty.call(rawSeat, key)) issues.push(issue('MISSING_FIELD', `${path}/${key}`, 'Missing seat field'));
    const seatIndex = read(rawSeat, 'seatIndex');
    const corePlayerId = read(rawSeat, 'corePlayerId');
    const participantId = read(rawSeat, 'participantId');
    const seatCapability = read(rawSeat, 'seatCapability');
    const deckId = read(rawSeat, 'deckId');
    const deckText = read(rawSeat, 'deckText');
    if (seatIndex !== index) issues.push(issue('INVALID_RELATION', `${path}/seatIndex`, 'Seat index must equal array position'));
    if (corePlayerId !== PLAYER_IDS[index]) issues.push(issue('INVALID_RELATION', `${path}/corePlayerId`, 'Core player IDs must be P1 through P4 in seat order'));
    for (const [key, value] of [['participantId', participantId], ['seatCapability', seatCapability], ['deckId', deckId], ['deckText', deckText]] as const) if (typeof value !== 'string') issues.push(issue('INVALID_TYPE', `${path}/${key}`, `${key} must be a string`));
    if (typeof participantId === 'string' && !isOnlineRoomApplicationIdV1(participantId)) issues.push(issue('INVALID_ID', `${path}/participantId`, 'Invalid participant ID'));
    if (typeof seatCapability === 'string' && !isOnlineRoomSeatCapabilityV1(seatCapability)) issues.push(issue('INVALID_CAPABILITY', `${path}/seatCapability`, 'Invalid seat capability'));
    if (typeof participantId === 'string') {
      if (participantIds.has(participantId)) issues.push(issue('DUPLICATE_PARTICIPANT_ID', `${path}/participantId`, 'Participant IDs must be unique'));
      participantIds.set(participantId, index);
    }
    if (typeof seatCapability === 'string') {
      if (capabilities.has(seatCapability)) issues.push(issue('DUPLICATE_CAPABILITY', `${path}/seatCapability`, 'Seat capabilities must be unique'));
      capabilities.set(seatCapability, index);
    }
    if (typeof deckId === 'string') {
      if (deckIds.has(deckId)) issues.push(issue('DUPLICATE_DECK_ID', `${path}/deckId`, 'Deck IDs must be pairwise distinct'));
      deckIds.set(deckId, index);
    }
    if (typeof deckText === 'string') {
      if (deckTexts.has(deckText)) issues.push(issue('DUPLICATE_DECK_TEXT', `${path}/deckText`, 'Deck text values must be pairwise distinct'));
      deckTexts.set(deckText, index);
    }
    seats.push(Object.freeze({ seatIndex: typeof seatIndex === 'number' ? seatIndex : index, corePlayerId: typeof corePlayerId === 'string' ? corePlayerId : PLAYER_IDS[index] ?? 'P1', participantId: typeof participantId === 'string' ? participantId : '', seatCapability: typeof seatCapability === 'string' ? seatCapability : '', deckId: typeof deckId === 'string' ? deckId : '', deckText: typeof deckText === 'string' ? deckText : '' }));
  });
  const normalizedRoomId = typeof roomId === 'string' ? roomId : '';
  const normalizedServerBuildId = typeof serverBuildId === 'string' ? serverBuildId : '';
  issues.push(...capabilityIdentifierIssues(normalizedRoomId, normalizedServerBuildId, seats));
  return { seats: Object.freeze(seats), roomId: normalizedRoomId, serverBuildId: normalizedServerBuildId, issues: sorted(issues) };
}

function clonePlayer(playerId: CorePlayerId) {
  void playerId;
  return { life: 40, poison: 0, energy: 0, experience: 0, manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }, mulliganCount: 0, landsPlayedThisTurn: 0, spellsCastThisTurn: 0, drawnThisTurn: 0, maximumHandSizeOverride: 'none' as const };
}

type ValidatedDeckV1 = Readonly<{ readonly seat: FourDeckBootstrapSeatInputV1; readonly parsed: ParsedDeck }>;

function buildCore(decks: readonly ValidatedDeckV1[]): ModeNeutralCoreRootV1 {
  const players: Record<string, ReturnType<typeof clonePlayer>> = Object.create(null) as Record<string, ReturnType<typeof clonePlayer>>;
  const byPlayer: Record<string, { library: CoreObjectId[]; hand: CoreObjectId[]; graveyard: CoreObjectId[] }> = Object.create(null) as Record<string, { library: CoreObjectId[]; hand: CoreObjectId[]; graveyard: CoreObjectId[] }>;
  const definitions = Object.create(null) as Record<string, CoreCardDefinitionSnapshotV1>;
  const physicalCards = Object.create(null) as Record<string, CorePhysicalCardV1>;
  const objects: Record<string, { kind: 'card'; physicalCardId: string; incarnation: number; baseControllerPlayerId: null }> = Object.create(null) as Record<string, { kind: 'card'; physicalCardId: string; incarnation: number; baseControllerPlayerId: null }>;
  const commanders = [] as ReturnType<typeof createCoreCommanderIdentityV1>[];
  for (let seatIndex = 0; seatIndex < decks.length; seatIndex += 1) {
    const deck = decks[seatIndex];
    if (deck === undefined) throw new Error('Bootstrap deck set is incomplete');
    const playerId = PLAYER_IDS[seatIndex] as CorePlayerId;
    players[playerId] = clonePlayer(playerId);
    byPlayer[playerId] = { library: [], hand: [], graveyard: [] };
    const parsed = deck.parsed;
    const commanderEntries = parsed.entries.filter((entry) => entry.section === 'commander');
    const commander = commanderEntries[0];
    if (commander === undefined) throw new Error('Bootstrap deck set is incomplete');
    const expanded = [commander, ...parsed.entries.filter((entry) => entry.section === 'main').flatMap((entry) => Array.from({ length: entry.quantity }, () => entry))];
    expanded.forEach((entry, ordinalIndex) => {
      const catalogEntry = O4P06A_CARD_CATALOG_V1.entries.find((candidate) => candidate.lookupName === entry.name);
      if (catalogEntry === undefined) throw new Error(`Missing catalog entry for ${entry.name}`);
      const physicalCardId = `P${seatIndex + 1}-card-${String(ordinalIndex + 1).padStart(4, '0')}`;
      const objectId = coreCardObjectIdOf(physicalCardId as never, 0);
      const definitionId = catalogEntry.definition.source.kind === 'scryfall' ? catalogEntry.definition.source.scryfallId : '';
      definitions[definitionId as never] = catalogEntry.definition;
      physicalCards[physicalCardId as never] = { definitionId: definitionId as never, ownerPlayerId: playerId, isCommander: ordinalIndex === 0 };
      objects[objectId] = { kind: 'card', physicalCardId, incarnation: 0, baseControllerPlayerId: null };
      if (ordinalIndex === 0) commanders.push(createCoreCommanderIdentityV1({ physicalCardId: physicalCardId as never, ownerPlayerId: playerId }));
      else byPlayer[playerId]?.library.push(objectId);
    });
  }
  const registry = createModeNeutralCoreObjectRegistryStateV2({ players, turnOrder: [...PLAYER_IDS] as CorePlayerId[], activePlayerId: 'P1' as CorePlayerId, cardDefinitions: definitions, physicalCards, objects: objects as never, zones: { byPlayer, shared: { battlefield: [], stack: [], exile: [], command: commanders.map((commander) => coreCardObjectIdOf(commander.physicalCardId, 0)) } } });
  const runtimeByObject: Record<string, CoreCardObjectRuntimeStateV1> = Object.create(null) as Record<string, CoreCardObjectRuntimeStateV1>;
  for (const objectId of Object.keys(registry.objects)) runtimeByObject[objectId] = { orientation: { faceIndex: 0, faceDown: false, tapped: false, flipped: false, phasedOut: false }, counterDamage: { counters: [], markedDamage: 0 }, attachment: { attachedTo: null } };
  const runtime = createModeNeutralCoreObjectRuntimeStateV2(registry, { byObject: runtimeByObject });
  const stackAnnouncements = createModeNeutralCoreStackAnnouncementSliceV1(registry, { byObject: {} });
  const stackBundle = createCoreStackTransactionBundleV1({ objectRegistry: registry, objectRuntime: runtime, stackAnnouncements });
  const pendingTriggers = createModeNeutralCorePendingTriggerSliceV1(registry, { pendingObjectIds: [], byObject: {} });
  const lifecycle = createModeNeutralCoreTurnLifecycleSliceV1({ turnNumber: 1, positionSequence: 0, position: { phase: 'beginning', step: 'untap' }, window: { kind: 'turn-based-action-required', action: 'untap-step-actions', playerId: 'P1' as CorePlayerId } });
  const turnPriorityBundle = createCoreTurnPriorityBundleV1({ stackBundle, pendingTriggers, lifecycle });
  const authority = createCoreRuleAuthorityBundleV1({ turnPriorityBundle, control: createModeNeutralCoreControlSliceV1({ effectOrder: [], byEffect: {}, continuityByObject: {} }), visibility: createModeNeutralCoreVisibilitySliceV1({ grantOrder: [], byGrant: {} }), searchSessions: createModeNeutralCoreSearchSessionSliceV1({ sessionOrder: [], bySession: {} }), playPermissions: createModeNeutralCorePlayPermissionSliceV1({ permissionOrder: [], byPermission: {} }), decisionAuthorities: createModeNeutralCoreDecisionAuthoritySliceV1({ authorityOrder: [], byAuthority: {} }) });
  const lifecycleState = createCorePlayerLifecycleStateV1({ players: PLAYER_IDS.map((playerId) => ({ playerId: playerId as CorePlayerId, status: 'active', exitCause: null })) });
  return createModeNeutralCoreRootV1({ versions: CORE_CLOSURE_VERSION_VECTOR_V1, acceptedCommandCount: 0, ruleAuthority: authority, playerLifecycle: lifecycleState, commanders, commanderCastLedgers: commanders.map((commander) => createCoreCommanderCastLedgerV1({ commander, castCount: 0 })), commanderDamage: createCoreCommanderDamageStateV1({ commanders, defendingPlayerIds: [...PLAYER_IDS] as CorePlayerId[], entries: [] }), commanderDamageProvenance: createCoreCommanderDamageProvenanceLedgerV1({ commanders, defendingPlayerIds: [...PLAYER_IDS] as CorePlayerId[], records: [] }), combatContext: null });
}

function buildRoom(input: FourDeckBootstrapInputV1): OnlineRoomV1 {
  const assignments = input.seats.map((seat, seatIndex) => ({ seatIndex: seatIndex as 0 | 1 | 2 | 3, corePlayerId: PLAYER_IDS[seatIndex], seatCapability: seat.seatCapability })) as [{ seatIndex: 0; corePlayerId: 'P1'; seatCapability: string }, { seatIndex: 1; corePlayerId: 'P2'; seatCapability: string }, { seatIndex: 2; corePlayerId: 'P3'; seatCapability: string }, { seatIndex: 3; corePlayerId: 'P4'; seatCapability: string }];
  const participants = input.seats.map((seat) => seat.participantId);
  const capabilities = input.seats.map((seat) => seat.seatCapability);
  let room = createOnlineRoomV1({ roomId: input.roomId as never, seatAssignments: assignments as never, host: { participantId: participants[0] as never, seatCapability: capabilities[0] as never } });
  for (let index = 1; index < 4; index += 1) room = joinOnlineRoomV1(room, { participantId: participants[index] as never, role: 'player', seatCapability: capabilities[index] as never });
  for (let index = 0; index < 4; index += 1) room = setOnlineRoomPlayerReadyV1(room, { participantId: participants[index] as never, seatCapability: capabilities[index] as never, ready: true });
  room = startOnlineRoomV1(room, participants[0]);
  return room;
}

function validateDecks(seats: readonly FourDeckBootstrapSeatInputV1[]): Readonly<{ readonly decks: readonly ValidatedDeckV1[]; readonly issues: readonly BootstrapIssueV1[] }> {
  const issues: BootstrapIssueV1[] = [];
  const decks: ValidatedDeckV1[] = [];
  seats.forEach((seat, seatIndex) => {
    const parsed = parseDeckList(seat.deckText);
    decks.push(Object.freeze({ seat, parsed }));
    for (const error of parsed.errors) issues.push(issue('DECK_PARSE_ERROR', `/seats/${seatIndex}/deckText/line/${error.line}`, error.reason));
    const commander = parsed.entries.filter((entry) => entry.section === 'commander');
    const main = parsed.entries.filter((entry) => entry.section === 'main');
    if (main.length === 0) issues.push(issue('DECK_MAIN_EMPTY', `/seats/${seatIndex}/deckText`, 'Deck must contain at least one main-deck entry'));
    if (commander.length !== 1) issues.push(issue('COMMANDER_COUNT_INVALID', `/seats/${seatIndex}/deckText`, 'Deck must contain exactly one Commander entry'));
    if (commander.length === 1 && commander[0]?.quantity !== 1) issues.push(issue('COMMANDER_QUANTITY_INVALID', `/seats/${seatIndex}/deckText/line/${commander[0]?.line ?? 0}`, 'Commander quantity must be one'));
    for (const entry of parsed.entries) {
      if (!Number.isSafeInteger(entry.quantity) || entry.quantity <= 0) issues.push(issue('DECK_QUANTITY_INVALID', `/seats/${seatIndex}/deckText/line/${entry.line}`, 'Card quantity must be a positive safe integer'));
      if (O4P06A_CARD_CATALOG_V1.entries.every((candidate) => candidate.lookupName !== entry.name)) issues.push(issue('CARD_UNRESOLVED', `/seats/${seatIndex}/deckText/line/${entry.line}/name`, 'Card name is not in the committed catalog'));
    }
  });
  return Object.freeze({ decks: Object.freeze(decks), issues: sorted(issues) });
}

export function bootstrapFourDeckGenesisV1(input: unknown): FourDeckBootstrapResultV1 {
  const validated = validateInput(input);
  if (!('seats' in validated)) return Object.freeze({ ok: false, issues: validated.issues });
  if (validated.issues.length > 0) {
    const decksWithIssues = validateDecks(validated.seats);
    return Object.freeze({ ok: false, issues: sorted([...validated.issues, ...decksWithIssues.issues]) });
  }
  const decks = validateDecks(validated.seats);
  if (decks.issues.length > 0) return Object.freeze({ ok: false, issues: decks.issues });
  try {
    const coreRoot = buildCore(decks.decks);
    let room = buildRoom(validated);
    room = activateOnlineRoomV1(room, { hostParticipantId: validated.seats[0]?.participantId ?? '', coreRoot });
    const protocolState = createOnlineProtocolStateV1({ serverBuildId: validated.serverBuildId, room, coreRoot, observerAuthorizations: [] });
    const coreCanonical = serializeModeNeutralCoreRootV1(coreRoot);
    const size = evaluateO4P06ASizeGateV1(coreCanonical, protocolState);
    if (!size.ok) return Object.freeze({ ok: false, issues: sorted(size.issues) });
    const replayPackage = createCoreReplayPackageV1(coreRoot, []);
    const replay = replayCoreCommandsV1(replayPackage);
    if (!replay.ok || replay.finalStateDigest !== coreCanonicalDigestFromValueV1(coreRoot) || replay.events.length !== 0) return Object.freeze({ ok: false, issues: [issue('REPLAY_GENESIS_MISMATCH', '/replay', 'Empty-journal replay did not reproduce genesis')] });
    return Object.freeze({ ok: true, coreRoot, room, protocolState, replayPackage, replay, coreCanonical, coreDigest: coreCanonicalDigestFromValueV1(coreRoot), sizeEvidence: size.evidence, measurements: size.evidence.artifacts });
  } catch {
    return Object.freeze({ ok: false, issues: [issue('BOOTSTRAP_CONSTRUCTION_FAILED', '', 'Bootstrap construction failed')] });
  }
}

export const createFourDeckBootstrapV1 = bootstrapFourDeckGenesisV1;
export const buildFourDeckGenesisV1 = bootstrapFourDeckGenesisV1;
