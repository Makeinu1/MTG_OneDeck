import {
  coreCardObjectIdOf,
  coreCanonicalDigestFromValueV1,
  coreSha256HexV1,
  createCoreCommanderCastLedgerV1,
  createCoreCommanderDamageProvenanceLedgerV1,
  createCoreCommanderDamageStateV1,
  createCoreCommanderIdentityV1,
  createCorePlayerLifecycleStateV1,
  createCoreReplayPackageV1,
  createCoreRuleAuthorityBundleV1,
  createCoreStackTransactionBundleV1,
  createCoreTurnPriorityBundleV1,
  createModeNeutralCoreControlSliceV1,
  createModeNeutralCoreDecisionAuthoritySliceV1,
  createModeNeutralCoreObjectRegistryStateV2,
  createModeNeutralCoreObjectRuntimeStateV2,
  createModeNeutralCorePendingTriggerSliceV1,
  createModeNeutralCorePlayPermissionSliceV1,
  createModeNeutralCoreRootV1,
  createModeNeutralCoreSearchSessionSliceV1,
  createModeNeutralCoreStackAnnouncementSliceV1,
  createModeNeutralCoreTurnLifecycleSliceV1,
  createModeNeutralCoreVisibilitySliceV1,
  CORE_CLOSURE_VERSION_VECTOR_V1,
  replayCoreCommandsV1,
  serializeModeNeutralCoreRootV1,
  type CoreCardDefinitionSnapshotV1,
  type CoreCardObjectRuntimeStateV1,
  type CoreObjectId,
  type CorePhysicalCardV1,
  type CorePlayerId,
  type ModeNeutralCoreRootV1,
} from '../../engine/core/index';
import {
  activateOnlineRoomV1,
  createOnlineRoomV1,
  joinOnlineRoomV1,
  setOnlineRoomPlayerReadyV1,
  startOnlineRoomV1,
  type OnlineRoomV1,
} from '../room/index';
import { createOnlineProtocolStateV1, type OnlineProtocolStateV1 } from '../protocol/index';
import { validateBuildId } from '../../versioning/index';
import type { CardDef, CardFace, ManaColor } from '../../types/card';
import type { OnlineDeckResolvedEntryV2, OnlineDeckResolvedSnapshotV2 } from '../deckSubmission/index';

export type DynamicGenesisIssueCodeV2 = 'INVALID_INPUT' | 'SNAPSHOT_INVALID' | 'DUPLICATE_DEFINITION' | 'ROOM_GENESIS_TOO_LARGE' | 'CONSTRUCTION_FAILED' | 'REPLAY_GENESIS_MISMATCH';
export type DynamicGenesisIssueV2 = Readonly<{ readonly code: DynamicGenesisIssueCodeV2; readonly path: string; readonly message: string }>;

export type DynamicGenesisSeatInputV2 = Readonly<{
  readonly seatIndex: 0 | 1 | 2 | 3;
  readonly corePlayerId: 'P1' | 'P2' | 'P3' | 'P4';
  readonly participantId: string;
  readonly seatCapability: string;
  readonly revision: number;
  readonly submissionId: string;
  readonly contentDigest: string;
  readonly snapshotDigest: string;
  readonly snapshot: OnlineDeckResolvedSnapshotV2;
}>;

export type DynamicGenesisInputV2 = Readonly<{
  readonly roomId: string;
  readonly serverBuildId: string;
  readonly seats: readonly [DynamicGenesisSeatInputV2, DynamicGenesisSeatInputV2, DynamicGenesisSeatInputV2, DynamicGenesisSeatInputV2];
  readonly tableParticipantId?: string;
  readonly tableCapability?: string;
}>;

export type DynamicGenesisSuccessV2 = Readonly<{
  readonly ok: true;
  readonly coreRoot: ModeNeutralCoreRootV1;
  readonly room: OnlineRoomV1;
  readonly protocolState: OnlineProtocolStateV1;
  readonly replayPackage: ReturnType<typeof createCoreReplayPackageV1>;
  readonly replay: ReturnType<typeof replayCoreCommandsV1>;
  readonly coreCanonical: string;
  readonly coreDigest: string;
  readonly measurements: Readonly<{ readonly coreRoot: number; readonly protocolState: number; readonly initializeEnvelope: number }>;
}>;

export type DynamicGenesisResultV2 = DynamicGenesisSuccessV2 | Readonly<{ readonly ok: false; readonly issues: readonly DynamicGenesisIssueV2[] }>;

const PLAYER_IDS = ['P1', 'P2', 'P3', 'P4'] as const;
const MANA = new Set<ManaColor>(['W', 'U', 'B', 'R', 'G', 'C']);
const COLORS = new Set(['W', 'U', 'B', 'R', 'G']);
const TOKEN_KINDS = new Set(['treasure', 'clue', 'food', 'blood', 'cursed-role', 'monster-role', 'royal-role', 'sorcerer-role', 'virtuous-role', 'wicked-role', 'young-hero-role']);
const FACE_OPTIONALS = ['printedName', 'manaCost', 'printedTypeLine', 'oracleText', 'printedText', 'imageUrl', 'imageUrlSmall', 'power', 'toughness', 'loyalty', 'defense'] as const;
const MAX_EXPANDED_CARDS = 4_096;
const MAX_GENESIS_BYTES = 1_048_576;
const COLOR_ORDER: readonly ManaColor[] = ['W', 'U', 'B', 'R', 'G', 'C'];

function issue(code: DynamicGenesisIssueCodeV2, path: string, message: string): DynamicGenesisIssueV2 {
  return Object.freeze({ code, path, message });
}
function record(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  try { const prototype: object | null = Reflect.getPrototypeOf(value); return prototype === Object.prototype || prototype === null; } catch { return false; }
}
function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!record(value)) return false;
  try { const own = Reflect.ownKeys(value); return own.length === keys.length && own.every((key) => typeof key === 'string' && keys.includes(key) && Object.prototype.propertyIsEnumerable.call(value, key)); } catch { return false; }
}
function stringArray(value: unknown): value is readonly string[] { return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype && value.every((entry) => typeof entry === 'string'); }
function optionalString(value: Record<string, unknown>, key: string): boolean { return !Object.prototype.hasOwnProperty.call(value, key) || typeof value[key] === 'string'; }

function cardFace(value: unknown): CardFace | null {
  if (!record(value) || typeof value.name !== 'string' || typeof value.typeLine !== 'string') return null;
  const allowed = ['name', 'typeLine', ...FACE_OPTIONALS];
  if (!exactKeys(value, allowed.filter((key) => Object.prototype.hasOwnProperty.call(value, key))) || !FACE_OPTIONALS.every((key) => optionalString(value, key))) return null;
  return Object.freeze({ ...value }) as unknown as CardFace;
}

function cardDef(value: unknown): CardDef | null {
  if (!record(value) || typeof value.scryfallId !== 'string' || typeof value.oracleId !== 'string' || typeof value.name !== 'string' || (value.lang !== 'en' && value.lang !== 'ja') || typeof value.layout !== 'string' || typeof value.cmc !== 'number' || !Number.isFinite(value.cmc) || typeof value.typeLine !== 'string' || !stringArray(value.colorIdentity) || !value.colorIdentity.every((color) => COLORS.has(color)) || !Array.isArray(value.faces) || value.faces.length === 0 || !value.faces.every((face) => cardFace(face) !== null)) return null;
  const allowed = ['scryfallId', 'oracleId', 'name', 'lang', 'layout', 'cmc', 'colorIdentity', 'typeLine', 'faces', 'printedName', 'edhrecRank', 'keywords', 'producedMana', 'tokenKind'];
  if (!exactKeys(value, allowed.filter((key) => Object.prototype.hasOwnProperty.call(value, key))) || !optionalString(value, 'printedName')) return null;
  if (Object.prototype.hasOwnProperty.call(value, 'edhrecRank') && (typeof value.edhrecRank !== 'number' || !Number.isFinite(value.edhrecRank))) return null;
  if (Object.prototype.hasOwnProperty.call(value, 'keywords') && !stringArray(value.keywords)) return null;
  if (Object.prototype.hasOwnProperty.call(value, 'producedMana') && (!stringArray(value.producedMana) || !value.producedMana.every((mana) => MANA.has(mana as ManaColor)))) return null;
  if (Object.prototype.hasOwnProperty.call(value, 'tokenKind') && (typeof value.tokenKind !== 'string' || !TOKEN_KINDS.has(value.tokenKind))) return null;
  return Object.freeze({ ...value, colorIdentity: [...value.colorIdentity], faces: value.faces.map((face) => Object.freeze({ ...(face as CardFace) })) }) as CardDef;
}

function definitionOf(card: CardDef): CoreCardDefinitionSnapshotV1 {
  const face = (entry: CardFace) => Object.freeze({ name: entry.name, manaCost: entry.manaCost ?? null, typeLine: entry.typeLine, oracleText: entry.oracleText ?? '', power: entry.power ?? null, toughness: entry.toughness ?? null, loyalty: entry.loyalty ?? null, defense: entry.defense ?? null });
  const canonical = (values: readonly string[], allowed: ReadonlySet<string>): readonly string[] => Object.freeze([...new Set(values.filter((value) => allowed.has(value)))].sort((left, right) => COLOR_ORDER.indexOf(left as ManaColor) - COLOR_ORDER.indexOf(right as ManaColor) || left.localeCompare(right)));
  const keywords = Object.freeze([...new Set(card.keywords ?? [])].sort((left, right) => left.localeCompare(right)));
  return Object.freeze({ source: Object.freeze({ kind: 'scryfall', scryfallId: card.scryfallId, oracleId: card.oracleId }), name: card.name, layout: card.layout, manaValue: card.cmc, colorIdentity: canonical(card.colorIdentity, COLORS) as readonly Exclude<ManaColor, 'C'>[], typeLine: card.typeLine, keywords, producedMana: canonical(card.producedMana ?? [], MANA) as readonly ManaColor[], tokenKind: card.tokenKind ?? null, faces: Object.freeze(card.faces.map(face)) });
}

function clonePlayer(): { readonly life: 40; readonly poison: 0; readonly energy: 0; readonly experience: 0; readonly manaPool: { readonly W: 0; readonly U: 0; readonly B: 0; readonly R: 0; readonly G: 0; readonly C: 0 }; readonly mulliganCount: 0; readonly landsPlayedThisTurn: 0; readonly spellsCastThisTurn: 0; readonly drawnThisTurn: 0; readonly maximumHandSizeOverride: 'none' } {
  return { life: 40, poison: 0, energy: 0, experience: 0, manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }, mulliganCount: 0, landsPlayedThisTurn: 0, spellsCastThisTurn: 0, drawnThisTurn: 0, maximumHandSizeOverride: 'none' };
}

function buildCore(seats: readonly DynamicGenesisSeatInputV2[]): ModeNeutralCoreRootV1 {
  const players: Record<string, ReturnType<typeof clonePlayer>> = Object.create(null) as Record<string, ReturnType<typeof clonePlayer>>;
  const byPlayer: Record<string, { library: CoreObjectId[]; hand: CoreObjectId[]; graveyard: CoreObjectId[] }> = Object.create(null) as Record<string, { library: CoreObjectId[]; hand: CoreObjectId[]; graveyard: CoreObjectId[] }>;
  const definitions: Record<string, CoreCardDefinitionSnapshotV1> = Object.create(null) as Record<string, CoreCardDefinitionSnapshotV1>;
  const physicalCards: Record<string, CorePhysicalCardV1> = Object.create(null) as Record<string, CorePhysicalCardV1>;
  const objects: Record<string, { kind: 'card'; physicalCardId: string; incarnation: number; baseControllerPlayerId: null }> = Object.create(null) as Record<string, { kind: 'card'; physicalCardId: string; incarnation: number; baseControllerPlayerId: null }>;
  const commanders: ReturnType<typeof createCoreCommanderIdentityV1>[] = [];
  let expandedCount = 0;
  for (let seat = 0; seat < seats.length; seat += 1) {
    const current = seats[seat];
    if (current === undefined) throw new Error('Missing seat');
    const playerId = PLAYER_IDS[seat] as CorePlayerId;
    players[playerId] = clonePlayer();
    byPlayer[playerId] = { library: [], hand: [], graveyard: [] };
    let seatOrdinal = 0;
    for (const entry of current.snapshot.entries) {
      const definition = cardDef(entry.definition);
      if (definition === null) throw new Error('Invalid snapshot definition');
      const coreDefinition = definitionOf(definition);
      const definitionId = definition.scryfallId;
      const existing = definitions[definitionId];
      if (existing !== undefined && JSON.stringify(existing) !== JSON.stringify(coreDefinition)) throw new Error('Duplicate definition collision');
      definitions[definitionId] = coreDefinition;
      if (!Number.isSafeInteger(entry.quantity) || entry.quantity <= 0 || expandedCount > MAX_EXPANDED_CARDS - entry.quantity) throw new Error('Room genesis too large');
      for (let copy = 0; copy < entry.quantity; copy += 1) {
        expandedCount += 1;
        seatOrdinal += 1;
        const physicalCardId = `P${seat + 1}-card-${String(seatOrdinal).padStart(6, '0')}`;
        const objectId = coreCardObjectIdOf(physicalCardId as never, 0);
        if (physicalCards[physicalCardId] !== undefined || objects[objectId] !== undefined) throw new Error('Physical card collision');
        physicalCards[physicalCardId] = { definitionId: definitionId as never, ownerPlayerId: playerId, isCommander: entry.section === 'commander' };
        objects[objectId] = { kind: 'card', physicalCardId, incarnation: 0, baseControllerPlayerId: null };
        if (entry.section === 'commander') commanders.push(createCoreCommanderIdentityV1({ physicalCardId: physicalCardId as never, ownerPlayerId: playerId }));
        else byPlayer[playerId]?.library.push(objectId);
      }
    }
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
  const playerLifecycle = createCorePlayerLifecycleStateV1({ players: PLAYER_IDS.map((playerId) => ({ playerId: playerId as CorePlayerId, status: 'active', exitCause: null })) });
  return createModeNeutralCoreRootV1({ versions: CORE_CLOSURE_VERSION_VECTOR_V1, acceptedCommandCount: 0, ruleAuthority: authority, playerLifecycle, commanders, commanderCastLedgers: commanders.map((commander) => createCoreCommanderCastLedgerV1({ commander, castCount: 0 })), commanderDamage: createCoreCommanderDamageStateV1({ commanders, defendingPlayerIds: [...PLAYER_IDS] as CorePlayerId[], entries: [] }), commanderDamageProvenance: createCoreCommanderDamageProvenanceLedgerV1({ commanders, defendingPlayerIds: [...PLAYER_IDS] as CorePlayerId[], records: [] }), combatContext: null });
}

function buildRoom(input: DynamicGenesisInputV2, coreRoot: ModeNeutralCoreRootV1): { readonly room: OnlineRoomV1; readonly protocolState: OnlineProtocolStateV1 } {
  const assignments = input.seats.map((seat, index) => ({ seatIndex: index as 0 | 1 | 2 | 3, corePlayerId: PLAYER_IDS[index], seatCapability: seat.seatCapability }));
  const participants = input.seats.map((seat) => seat.participantId);
  let room = createOnlineRoomV1({ roomId: input.roomId as never, seatAssignments: assignments as never, host: { participantId: participants[0] as never, seatCapability: input.seats[0]?.seatCapability as never } });
  for (let index = 1; index < 4; index += 1) room = joinOnlineRoomV1(room, { participantId: participants[index] as never, role: 'player', seatCapability: input.seats[index]?.seatCapability as never });
  for (let index = 0; index < 4; index += 1) room = setOnlineRoomPlayerReadyV1(room, { participantId: participants[index] as never, seatCapability: input.seats[index]?.seatCapability as never, ready: true });
  room = startOnlineRoomV1(room, participants[0]);
  if (input.tableParticipantId !== undefined && input.tableCapability !== undefined) room = joinOnlineRoomV1(room, { participantId: input.tableParticipantId as never, role: 'table' });
  room = activateOnlineRoomV1(room, { hostParticipantId: participants[0] as never, coreRoot });
  const observerAuthorizations = input.tableParticipantId !== undefined && input.tableCapability !== undefined ? [{ participantId: input.tableParticipantId as never, observerCapability: input.tableCapability as never }] : [];
  return Object.freeze({ room, protocolState: createOnlineProtocolStateV1({ serverBuildId: input.serverBuildId, room, coreRoot, observerAuthorizations }) });
}

export function buildDynamicRoomGenesisV2(input: DynamicGenesisInputV2): DynamicGenesisResultV2 {
  try {
    const rawSeats: unknown = record(input) ? input.seats : undefined;
    if (!record(input) || typeof input.roomId !== 'string' || typeof input.serverBuildId !== 'string' || !validateBuildId(input.serverBuildId).ok || !Array.isArray(rawSeats) || rawSeats.length !== 4) return Object.freeze({ ok: false, issues: [issue('INVALID_INPUT', '', 'Invalid dynamic genesis input')] });
    const seats = rawSeats as readonly DynamicGenesisSeatInputV2[];
    for (let index = 0; index < 4; index += 1) {
      const seat = seats[index];
      if (seat === undefined || seat.seatIndex !== index || seat.corePlayerId !== PLAYER_IDS[index] || !record(seat.snapshot) || typeof seat.snapshot.serialized !== 'string' || !Array.isArray(seat.snapshot.entries) || seat.snapshot.entries.length === 0 || seat.snapshot.digest !== seat.snapshotDigest || seat.snapshotDigest !== seat.snapshot.digest || coreSha256HexV1(seat.snapshot.serialized) !== seat.snapshot.digest || JSON.stringify({ entries: seat.snapshot.entries }) !== seat.snapshot.serialized) return Object.freeze({ ok: false, issues: [issue('SNAPSHOT_INVALID', `/seats/${index}`, 'Accepted snapshot relation is invalid')] });
      for (let entryIndex = 0; entryIndex < seat.snapshot.entries.length; entryIndex += 1) {
        const entry = seat.snapshot.entries[entryIndex] as OnlineDeckResolvedEntryV2 | undefined;
        const definition = entry === undefined ? null : cardDef(entry.definition);
        if (entry === undefined || definition === null || entry.index !== entryIndex || (entry.section !== 'commander' && entry.section !== 'main') || !Number.isSafeInteger(entry.quantity) || entry.quantity <= 0 || definition.scryfallId !== entry.scryfallId || definition.oracleId !== entry.oracleId) return Object.freeze({ ok: false, issues: [issue('SNAPSHOT_INVALID', `/seats/${index}/entries/${entryIndex}`, 'Snapshot entry relation is invalid')] });
      }
    }
    const coreRoot = buildCore(seats);
    const built = buildRoom(input, coreRoot);
    const coreCanonical = serializeModeNeutralCoreRootV1(coreRoot);
    const protocolCanonical = JSON.stringify(built.protocolState);
    const envelope = JSON.stringify({ kind: 'online-cloudflare-room-initialize-v1', schemaVersion: 1, state: built.protocolState });
    const measurements = Object.freeze({ coreRoot: new TextEncoder().encode(coreCanonical).length, protocolState: new TextEncoder().encode(protocolCanonical).length, initializeEnvelope: new TextEncoder().encode(envelope).length });
    if (measurements.coreRoot > MAX_GENESIS_BYTES || measurements.protocolState > MAX_GENESIS_BYTES || measurements.initializeEnvelope > MAX_GENESIS_BYTES) return Object.freeze({ ok: false, issues: [issue('ROOM_GENESIS_TOO_LARGE', '/measurements', `Genesis exceeds ${MAX_GENESIS_BYTES} bytes`)] });
    const replayPackage = createCoreReplayPackageV1(coreRoot, []);
    const replay = replayCoreCommandsV1(replayPackage);
    if (!replay.ok || replay.finalStateDigest !== coreCanonicalDigestFromValueV1(coreRoot) || replay.events.length !== 0) return Object.freeze({ ok: false, issues: [issue('REPLAY_GENESIS_MISMATCH', '/replay', 'Empty-journal replay did not reproduce genesis')] });
    return Object.freeze({ ok: true, coreRoot, room: built.room, protocolState: built.protocolState, replayPackage, replay, coreCanonical, coreDigest: coreCanonicalDigestFromValueV1(coreRoot), measurements });
  } catch (error: unknown) {
    const message = error instanceof Error && /too large/i.test(error.message) ? 'Genesis exceeds bounded construction capacity' : 'Dynamic genesis construction failed';
    return Object.freeze({ ok: false, issues: [issue(message.startsWith('Genesis exceeds') ? 'ROOM_GENESIS_TOO_LARGE' : 'CONSTRUCTION_FAILED', '', message)] });
  }
}

export const createDynamicRoomGenesisV2 = buildDynamicRoomGenesisV2;

export { buildVariableRoomGenesisV3, createVariableRoomGenesisV3, buildVariableRosterGenesisV3, VARIABLE_GENESIS_SCHEMA_VERSION_V3 } from './variable';
export type { VariableGenesisInputV3, VariableGenesisIssueCodeV3, VariableGenesisIssueV3, VariableGenesisResultV3, VariableGenesisSeatInputV3, VariableGenesisSuccessV3 } from './variable';
