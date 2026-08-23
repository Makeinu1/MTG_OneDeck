import {
  coreCardObjectIdOf, coreCanonicalDigestFromValueV1, coreSha256HexV1,
  createCoreCommanderCastLedgerV1, createCoreCommanderDamageProvenanceLedgerV1, createCoreCommanderDamageStateV1,
  createCoreCommanderIdentityV1, createCorePlayerLifecycleStateV1, createCoreReplayPackageV1, createCoreRuleAuthorityBundleV1,
  createCoreStackTransactionBundleV1, createCoreTurnPriorityBundleV1, createModeNeutralCoreControlSliceV1,
  createModeNeutralCoreDecisionAuthoritySliceV1, createModeNeutralCoreObjectRegistryStateV2, createModeNeutralCoreObjectRuntimeStateV2,
  createModeNeutralCorePendingTriggerSliceV1, createModeNeutralCorePlayPermissionSliceV1, createModeNeutralCoreRootV1,
  createModeNeutralCoreSearchSessionSliceV1, createModeNeutralCoreStackAnnouncementSliceV1, createModeNeutralCoreTurnLifecycleSliceV1,
  createModeNeutralCoreVisibilitySliceV1, CORE_CLOSURE_VERSION_VECTOR_V1, replayCoreCommandsV1, serializeModeNeutralCoreRootV1,
  type CoreCardDefinitionSnapshotV1, type CoreCardObjectRuntimeStateV1, type CoreObjectId, type CorePhysicalCardV1,
  type CorePlayerId, type ModeNeutralCoreRootV1,
} from '../../engine/core/index';
import { validateBuildId } from '../../versioning/index';
import type { CardDef, CardFace, ManaColor } from '../../types/card';
import type { OnlineDeckResolvedEntryV2, OnlineDeckResolvedSnapshotV2 } from '../deckSubmission/index';
import {
  activateOnlineVariableRoomV2, acceptOnlineVariableRoomDeckV2, createOnlineVariableRoomV2,
  joinOnlineVariableRoomV2, setOnlineVariableRoomPlayerReadyV2, startOnlineVariableRoomV2,
  type OnlineVariableRoomConfigurationV2, type OnlineVariableRoomV2,
} from '../room/variable';
import { createOnlineVariableProtocolStateV2, type OnlineVariableProtocolStateV2 } from '../protocol/variable';

export const VARIABLE_GENESIS_SCHEMA_VERSION_V3 = 3 as const;
export type VariableGenesisIssueCodeV3 = 'INVALID_INPUT' | 'SNAPSHOT_INVALID' | 'DUPLICATE_DEFINITION' | 'ROOM_GENESIS_TOO_LARGE' | 'CONSTRUCTION_FAILED' | 'REPLAY_GENESIS_MISMATCH';
export type VariableGenesisIssueV3 = Readonly<{ readonly code: VariableGenesisIssueCodeV3; readonly path: string; readonly message: string }>;
export type VariableGenesisSeatInputV3 = Readonly<{
  readonly seatIndex: 0 | 1 | 2 | 3;
  readonly corePlayerId: 'P1' | 'P2' | 'P3' | 'P4';
  readonly participantId: string;
  readonly seatCapability: string;
  readonly revision?: number;
  readonly submissionId?: string;
  readonly contentDigest?: string;
  readonly snapshotDigest?: string;
  readonly snapshot?: OnlineDeckResolvedSnapshotV2;
  readonly acceptedSnapshot?: OnlineDeckResolvedSnapshotV2;
}>;
export type VariableGenesisInputV3 = Readonly<{
  readonly roomId: string;
  readonly serverBuildId: string;
  readonly configuration?: OnlineVariableRoomConfigurationV2;
  readonly playerCount?: 2 | 4;
  readonly startingLife?: 20 | 40;
  readonly seats: readonly VariableGenesisSeatInputV3[];
  readonly tableParticipantId?: string;
  readonly tableCapability?: string;
}>;
export type VariableGenesisSuccessV3 = Readonly<{ readonly ok: true; readonly configuration: OnlineVariableRoomConfigurationV2; readonly coreRoot: ModeNeutralCoreRootV1; readonly room: OnlineVariableRoomV2; readonly protocolState: OnlineVariableProtocolStateV2; readonly replayPackage: ReturnType<typeof createCoreReplayPackageV1>; readonly replay: ReturnType<typeof replayCoreCommandsV1>; readonly coreCanonical: string; readonly coreDigest: string; readonly measurements: Readonly<{ readonly coreRoot: number; readonly protocolState: number; readonly initializeEnvelope: number }> }>;
export type VariableGenesisResultV3 = VariableGenesisSuccessV3 | Readonly<{ readonly ok: false; readonly issues: readonly VariableGenesisIssueV3[] }>;

const MANA = new Set<ManaColor>(['W', 'U', 'B', 'R', 'G', 'C']);
const COLORS = new Set(['W', 'U', 'B', 'R', 'G']);
const TOKEN_KINDS = new Set(['treasure', 'clue', 'food', 'blood', 'cursed-role', 'monster-role', 'royal-role', 'sorcerer-role', 'virtuous-role', 'wicked-role', 'young-hero-role']);
const FACE_OPTIONALS = ['printedName', 'manaCost', 'printedTypeLine', 'oracleText', 'printedText', 'imageUrl', 'imageUrlSmall', 'power', 'toughness', 'loyalty', 'defense'] as const;
const MAX_EXPANDED_CARDS = 4_096;
const MAX_GENESIS_BYTES = 1_048_576;
const PLAYER_IDS = ['P1', 'P2', 'P3', 'P4'] as const;
const COLOR_ORDER: readonly ManaColor[] = ['W', 'U', 'B', 'R', 'G', 'C'];
function issue(code: VariableGenesisIssueCodeV3, path: string, message: string): VariableGenesisIssueV3 { return Object.freeze({ code, path, message }); }
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> { if (!record(value)) return false; try { const own = Reflect.ownKeys(value); return own.length === keys.length && own.every((key) => typeof key === 'string' && keys.includes(key) && Object.prototype.propertyIsEnumerable.call(value, key)); } catch { return false; } }
function strings(value: unknown): value is readonly string[] { return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype && value.every((entry) => typeof entry === 'string'); }
function optionalString(value: Record<string, unknown>, key: string): boolean { return !Object.prototype.hasOwnProperty.call(value, key) || typeof value[key] === 'string'; }
function cardFace(value: unknown): CardFace | null { if (!record(value) || typeof value.name !== 'string' || typeof value.typeLine !== 'string') return null; const allowed = ['name', 'typeLine', ...FACE_OPTIONALS]; if (!exact(value, allowed.filter((key) => Object.prototype.hasOwnProperty.call(value, key))) || !FACE_OPTIONALS.every((key) => optionalString(value, key))) return null; return Object.freeze({ ...value }) as unknown as CardFace; }
function cardDef(value: unknown): CardDef | null { if (!record(value) || typeof value.scryfallId !== 'string' || typeof value.oracleId !== 'string' || typeof value.name !== 'string' || (value.lang !== 'en' && value.lang !== 'ja') || typeof value.layout !== 'string' || typeof value.cmc !== 'number' || !Number.isFinite(value.cmc) || typeof value.typeLine !== 'string' || !strings(value.colorIdentity) || !value.colorIdentity.every((color) => COLORS.has(color)) || !Array.isArray(value.faces) || value.faces.length === 0 || !value.faces.every((face) => cardFace(face) !== null)) return null; const allowed = ['scryfallId', 'oracleId', 'name', 'lang', 'layout', 'cmc', 'colorIdentity', 'typeLine', 'faces', 'printedName', 'edhrecRank', 'keywords', 'producedMana', 'tokenKind']; if (!exact(value, allowed.filter((key) => Object.prototype.hasOwnProperty.call(value, key))) || !optionalString(value, 'printedName')) return null; if (Object.prototype.hasOwnProperty.call(value, 'edhrecRank') && (typeof value.edhrecRank !== 'number' || !Number.isFinite(value.edhrecRank))) return null; if (Object.prototype.hasOwnProperty.call(value, 'keywords') && !strings(value.keywords)) return null; if (Object.prototype.hasOwnProperty.call(value, 'producedMana') && (!strings(value.producedMana) || !value.producedMana.every((mana) => MANA.has(mana as ManaColor)))) return null; if (Object.prototype.hasOwnProperty.call(value, 'tokenKind') && (typeof value.tokenKind !== 'string' || !TOKEN_KINDS.has(value.tokenKind))) return null; return Object.freeze({ ...value, colorIdentity: [...value.colorIdentity], faces: value.faces.map((face) => Object.freeze({ ...(face as CardFace) })) }) as CardDef; }
function definitionOf(card: CardDef): CoreCardDefinitionSnapshotV1 { const face = (entry: CardFace) => Object.freeze({ name: entry.name, manaCost: entry.manaCost ?? null, typeLine: entry.typeLine, oracleText: entry.oracleText ?? '', power: entry.power ?? null, toughness: entry.toughness ?? null, loyalty: entry.loyalty ?? null, defense: entry.defense ?? null }); const canonical = (values: readonly string[], allowed: ReadonlySet<string>): readonly string[] => Object.freeze([...new Set(values.filter((value) => allowed.has(value)))].sort((left, right) => COLOR_ORDER.indexOf(left as ManaColor) - COLOR_ORDER.indexOf(right as ManaColor) || left.localeCompare(right))); return Object.freeze({ source: Object.freeze({ kind: 'scryfall', scryfallId: card.scryfallId, oracleId: card.oracleId }), name: card.name, layout: card.layout, manaValue: card.cmc, colorIdentity: canonical(card.colorIdentity, COLORS) as readonly Exclude<ManaColor, 'C'>[], typeLine: card.typeLine, keywords: Object.freeze([...new Set(card.keywords ?? [])].sort()), producedMana: canonical(card.producedMana ?? [], MANA) as readonly ManaColor[], tokenKind: card.tokenKind ?? null, faces: Object.freeze(card.faces.map(face)) }); }
function player(life: number): { readonly life: number; readonly poison: 0; readonly energy: 0; readonly experience: 0; readonly manaPool: { readonly W: 0; readonly U: 0; readonly B: 0; readonly R: 0; readonly G: 0; readonly C: 0 }; readonly mulliganCount: 0; readonly landsPlayedThisTurn: 0; readonly spellsCastThisTurn: 0; readonly drawnThisTurn: 0; readonly maximumHandSizeOverride: 'none' } { return { life, poison: 0, energy: 0, experience: 0, manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }, mulliganCount: 0, landsPlayedThisTurn: 0, spellsCastThisTurn: 0, drawnThisTurn: 0, maximumHandSizeOverride: 'none' }; }

function buildCore(configuration: OnlineVariableRoomConfigurationV2, seats: readonly VariableGenesisSeatInputV3[], snapshots: readonly OnlineDeckResolvedSnapshotV2[]): ModeNeutralCoreRootV1 {
  const ids = PLAYER_IDS.slice(0, configuration.playerCount).map((value) => value as CorePlayerId) as readonly CorePlayerId[];
  const players: Record<string, ReturnType<typeof player>> = Object.create(null) as Record<string, ReturnType<typeof player>>;
  const byPlayer: Record<string, { library: CoreObjectId[]; hand: CoreObjectId[]; graveyard: CoreObjectId[] }> = Object.create(null) as Record<string, { library: CoreObjectId[]; hand: CoreObjectId[]; graveyard: CoreObjectId[] }>;
  const definitions: Record<string, CoreCardDefinitionSnapshotV1> = Object.create(null) as Record<string, CoreCardDefinitionSnapshotV1>;
  const physicalCards: Record<string, CorePhysicalCardV1> = Object.create(null) as Record<string, CorePhysicalCardV1>;
  const objects: Record<string, { kind: 'card'; physicalCardId: string; incarnation: number; baseControllerPlayerId: null }> = Object.create(null) as Record<string, { kind: 'card'; physicalCardId: string; incarnation: number; baseControllerPlayerId: null }>;
  const commanders: ReturnType<typeof createCoreCommanderIdentityV1>[] = [];
  let expanded = 0;
  for (let seatIndex = 0; seatIndex < configuration.playerCount; seatIndex += 1) {
    const snapshot = snapshots[seatIndex]; const seat = seats[seatIndex]; const playerId = ids[seatIndex];
    if (snapshot === undefined || seat === undefined || playerId === undefined) throw new Error('Missing variable genesis seat');
    players[playerId] = player(configuration.startingLife); byPlayer[playerId] = { library: [], hand: [], graveyard: [] };
    let ordinal = 0;
    for (const entry of snapshot.entries) {
      const definition = cardDef(entry.definition); if (definition === null) throw new Error('Invalid snapshot definition');
      const coreDefinition = definitionOf(definition); const definitionId = definition.scryfallId; const previous = definitions[definitionId];
      if (previous !== undefined && JSON.stringify(previous) !== JSON.stringify(coreDefinition)) throw new Error('Duplicate definition collision'); definitions[definitionId] = coreDefinition;
      if (!Number.isSafeInteger(entry.quantity) || entry.quantity <= 0 || expanded > MAX_EXPANDED_CARDS - entry.quantity) throw new Error('Room genesis too large');
      for (let copy = 0; copy < entry.quantity; copy += 1) { expanded += 1; ordinal += 1; const physicalCardId = `${playerId}-card-${String(ordinal).padStart(6, '0')}`; const objectId = coreCardObjectIdOf(physicalCardId as never, 0); physicalCards[physicalCardId] = { definitionId: definitionId as never, ownerPlayerId: playerId, isCommander: entry.section === 'commander' }; objects[objectId] = { kind: 'card', physicalCardId, incarnation: 0, baseControllerPlayerId: null }; if (entry.section === 'commander') commanders.push(createCoreCommanderIdentityV1({ physicalCardId: physicalCardId as never, ownerPlayerId: playerId })); else byPlayer[playerId]?.library.push(objectId); }
    }
  }
  const registry = createModeNeutralCoreObjectRegistryStateV2({ players, turnOrder: [...ids], activePlayerId: ids[0], cardDefinitions: definitions, physicalCards, objects: objects as never, zones: { byPlayer, shared: { battlefield: [], stack: [], exile: [], command: commanders.map((entry) => coreCardObjectIdOf(entry.physicalCardId, 0)) } } });
  const runtimeByObject: Record<string, CoreCardObjectRuntimeStateV1> = Object.create(null) as Record<string, CoreCardObjectRuntimeStateV1>; for (const objectId of Object.keys(registry.objects)) runtimeByObject[objectId] = { orientation: { faceIndex: 0, faceDown: false, tapped: false, flipped: false, phasedOut: false }, counterDamage: { counters: [], markedDamage: 0 }, attachment: { attachedTo: null } };
  const runtime = createModeNeutralCoreObjectRuntimeStateV2(registry, { byObject: runtimeByObject });
  const stackAnnouncements = createModeNeutralCoreStackAnnouncementSliceV1(registry, { byObject: {} }); const stackBundle = createCoreStackTransactionBundleV1({ objectRegistry: registry, objectRuntime: runtime, stackAnnouncements }); const pendingTriggers = createModeNeutralCorePendingTriggerSliceV1(registry, { pendingObjectIds: [], byObject: {} });
  const lifecycle = createModeNeutralCoreTurnLifecycleSliceV1({ turnNumber: 1, positionSequence: 0, position: { phase: 'beginning', step: 'untap' }, window: { kind: 'turn-based-action-required', action: 'untap-step-actions', playerId: ids[0] } }); const turnPriorityBundle = createCoreTurnPriorityBundleV1({ stackBundle, pendingTriggers, lifecycle }); const authority = createCoreRuleAuthorityBundleV1({ turnPriorityBundle, control: createModeNeutralCoreControlSliceV1({ effectOrder: [], byEffect: {}, continuityByObject: {} }), visibility: createModeNeutralCoreVisibilitySliceV1({ grantOrder: [], byGrant: {} }), searchSessions: createModeNeutralCoreSearchSessionSliceV1({ sessionOrder: [], bySession: {} }), playPermissions: createModeNeutralCorePlayPermissionSliceV1({ permissionOrder: [], byPermission: {} }), decisionAuthorities: createModeNeutralCoreDecisionAuthoritySliceV1({ authorityOrder: [], byAuthority: {} }) });
  const playerLifecycle = createCorePlayerLifecycleStateV1({ players: ids.map((playerId) => ({ playerId, status: 'active', exitCause: null })) }); return createModeNeutralCoreRootV1({ versions: CORE_CLOSURE_VERSION_VECTOR_V1, acceptedCommandCount: 0, ruleAuthority: authority, playerLifecycle, commanders, commanderCastLedgers: commanders.map((commander) => createCoreCommanderCastLedgerV1({ commander, castCount: 0 })), commanderDamage: createCoreCommanderDamageStateV1({ commanders, defendingPlayerIds: [...ids], entries: [] }), commanderDamageProvenance: createCoreCommanderDamageProvenanceLedgerV1({ commanders, defendingPlayerIds: [...ids], records: [] }), combatContext: null });
}

export function buildVariableRoomGenesisV3(input: VariableGenesisInputV3): VariableGenesisResultV3 {
  try {
    const rootFields = ['roomId', 'serverBuildId', 'configuration', 'playerCount', 'startingLife', 'seats', 'tableParticipantId', 'tableCapability'] as const;
    if (!record(input) || !exact(input, rootFields.filter((key) => Object.prototype.hasOwnProperty.call(input, key))) || typeof input.roomId !== 'string' || typeof input.serverBuildId !== 'string' || !validateBuildId(input.serverBuildId).ok || !Array.isArray(input.seats) || ((input.tableParticipantId === undefined) !== (input.tableCapability === undefined))) return Object.freeze({ ok: false, issues: [issue('INVALID_INPUT', '', 'Invalid variable genesis input')] });
    const configuration = input.configuration ?? (input.playerCount !== undefined && input.startingLife !== undefined ? { playerCount: input.playerCount, startingLife: input.startingLife } : null);
    if (configuration === null || !exact(configuration, ['playerCount', 'startingLife']) || (input.playerCount !== undefined && input.playerCount !== configuration.playerCount) || (input.startingLife !== undefined && input.startingLife !== configuration.startingLife) || !((configuration.playerCount === 2 || configuration.playerCount === 4) && (configuration.startingLife === 20 || configuration.startingLife === 40) && (configuration.playerCount !== 4 || configuration.startingLife === 40)) || input.seats.length !== configuration.playerCount) return Object.freeze({ ok: false, issues: [issue('INVALID_INPUT', '/configuration', 'Unsupported playerCount/startingLife configuration')] });
    const seats = input.seats as readonly VariableGenesisSeatInputV3[]; const snapshots: OnlineDeckResolvedSnapshotV2[] = [];
    for (let index = 0; index < configuration.playerCount; index += 1) {
      const seat = seats[index]; const candidate = seat?.snapshot ?? seat?.acceptedSnapshot;
      const seatFields = ['seatIndex', 'corePlayerId', 'participantId', 'seatCapability', 'revision', 'submissionId', 'contentDigest', 'snapshotDigest', 'snapshot', 'acceptedSnapshot'] as const;
      if (seat === undefined || !exact(seat, seatFields.filter((key) => Object.prototype.hasOwnProperty.call(seat, key))) || (seat.revision !== undefined && (!Number.isSafeInteger(seat.revision) || seat.revision < 0)) || (seat.submissionId !== undefined && (typeof seat.submissionId !== 'string' || seat.submissionId.length === 0)) || (seat.contentDigest !== undefined && (typeof seat.contentDigest !== 'string' || seat.contentDigest.length === 0)) || (seat.snapshotDigest !== undefined && (typeof seat.snapshotDigest !== 'string' || seat.snapshotDigest.length === 0)) || (seat.snapshot !== undefined && seat.acceptedSnapshot !== undefined && JSON.stringify(seat.snapshot) !== JSON.stringify(seat.acceptedSnapshot)) || (candidate !== undefined && !exact(candidate, ['entries', 'digest', 'serialized'])) || (seat.snapshotDigest !== undefined && candidate !== undefined && seat.snapshotDigest !== candidate.digest)) return Object.freeze({ ok: false, issues: [issue('SNAPSHOT_INVALID', `/seats/${index}/snapshotDigest`, 'Snapshot relation mismatch')] });
    }
    for (let index = 0; index < configuration.playerCount; index += 1) { const seat = seats[index]; const snapshot = seat?.snapshot ?? seat?.acceptedSnapshot; if (seat === undefined || seat.seatIndex !== index || seat.corePlayerId !== PLAYER_IDS[index] || typeof seat.participantId !== 'string' || typeof seat.seatCapability !== 'string' || snapshot === undefined || !exact(snapshot, ['entries', 'digest', 'serialized']) || typeof snapshot.serialized !== 'string' || !Array.isArray(snapshot.entries) || snapshot.entries.length === 0 || snapshot.digest !== snapshotDigest(snapshot.serialized) || JSON.stringify({ entries: snapshot.entries }) !== snapshot.serialized) return Object.freeze({ ok: false, issues: [issue('SNAPSHOT_INVALID', `/seats/${index}`, 'Accepted snapshot relation is invalid')] }); for (let entryIndex = 0; entryIndex < snapshot.entries.length; entryIndex += 1) { const entry = snapshot.entries[entryIndex] as OnlineDeckResolvedEntryV2 | undefined; const definition = entry === undefined ? null : cardDef(entry.definition); if (entry === undefined || !exact(entry, ['section', 'quantity', 'scryfallId', 'oracleId', 'index', 'definition']) || definition === null || entry.index !== entryIndex || (entry.section !== 'commander' && entry.section !== 'main') || !Number.isSafeInteger(entry.quantity) || entry.quantity <= 0 || definition.scryfallId !== entry.scryfallId || definition.oracleId !== entry.oracleId) return Object.freeze({ ok: false, issues: [issue('SNAPSHOT_INVALID', `/seats/${index}/entries/${entryIndex}`, 'Snapshot entry relation is invalid')] }); } snapshots.push(snapshot); }
    const coreRoot = buildCore(configuration, seats, snapshots); let room = createOnlineVariableRoomV2({ roomId: input.roomId, configuration, seatAssignments: seats.map((seat, index) => ({ seatIndex: index as 0 | 1 | 2 | 3, corePlayerId: PLAYER_IDS[index] as CorePlayerId, seatCapability: seat.seatCapability })), host: { participantId: seats[0]?.participantId ?? '', seatCapability: seats[0]?.seatCapability ?? '' } }); for (let index = 1; index < configuration.playerCount; index += 1) room = joinOnlineVariableRoomV2(room, { participantId: seats[index]?.participantId ?? '', seatCapability: seats[index]?.seatCapability ?? '' }); for (let index = 0; index < configuration.playerCount; index += 1) { room = acceptOnlineVariableRoomDeckV2(room, seats[index]?.participantId ?? '', true); room = setOnlineVariableRoomPlayerReadyV2(room, seats[index]?.participantId ?? '', true); } room = startOnlineVariableRoomV2(room, seats[0]?.participantId ?? ''); room = activateOnlineVariableRoomV2(room, coreRoot); const protocolState = createOnlineVariableProtocolStateV2({ serverBuildId: input.serverBuildId, room, coreRoot, observerAuthorizations: input.tableParticipantId !== undefined && input.tableCapability !== undefined ? [{ participantId: input.tableParticipantId, observerCapability: input.tableCapability }] : [] });
    const coreCanonical = serializeModeNeutralCoreRootV1(coreRoot); const protocolCanonical = JSON.stringify(protocolState); const envelope = JSON.stringify({ kind: 'online-cloudflare-room-initialize-v3', schemaVersion: 3, state: protocolState }); const measurements = Object.freeze({ coreRoot: new TextEncoder().encode(coreCanonical).length, protocolState: new TextEncoder().encode(protocolCanonical).length, initializeEnvelope: new TextEncoder().encode(envelope).length }); if (measurements.coreRoot > MAX_GENESIS_BYTES || measurements.protocolState > MAX_GENESIS_BYTES || measurements.initializeEnvelope > MAX_GENESIS_BYTES) return Object.freeze({ ok: false, issues: [issue('ROOM_GENESIS_TOO_LARGE', '/measurements', 'Genesis exceeds bounded construction capacity')] }); const replayPackage = createCoreReplayPackageV1(coreRoot, []); const replay = replayCoreCommandsV1(replayPackage); if (!replay.ok || replay.finalStateDigest !== coreCanonicalDigestFromValueV1(coreRoot) || replay.events.length !== 0) return Object.freeze({ ok: false, issues: [issue('REPLAY_GENESIS_MISMATCH', '/replay', 'Empty-journal replay did not reproduce genesis')] }); return Object.freeze({ ok: true, configuration, coreRoot, room, protocolState, replayPackage, replay, coreCanonical, coreDigest: coreCanonicalDigestFromValueV1(coreRoot), measurements });
  } catch (error: unknown) { const message = error instanceof Error && /too large/i.test(error.message) ? 'Genesis exceeds bounded construction capacity' : 'Variable genesis construction failed'; return Object.freeze({ ok: false, issues: [issue(message.startsWith('Genesis exceeds') ? 'ROOM_GENESIS_TOO_LARGE' : 'CONSTRUCTION_FAILED', '', message)] }); }
}
function snapshotDigest(serialized: string): string { return coreSha256HexV1(serialized); }
export const createVariableRoomGenesisV3 = buildVariableRoomGenesisV3;
export const buildVariableRosterGenesisV3 = buildVariableRoomGenesisV3;
