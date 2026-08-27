import { useMemo } from 'react';
import { GameScreen } from '../../components/game/GameScreen';
import { OnlineTabletopManual } from '../../components/online/OnlineTabletopManual';
import { OnlineVisibilityDecisions } from '../../components/online/OnlineVisibilityDecisions';
import { DEFAULT_KEYBINDINGS } from '../../data/keybindings';
import type {
  CoreCardDefinitionSnapshotV1,
  CoreManaPoolV1,
  CoreObjectId,
  CorePlayerId,
} from '../../engine/core';
import type {
  OnlineParticipantProjectionV1,
  OnlineProjectedObjectRuntimeV1,
  OnlineProjectedVisibleObjectV1,
  OnlineProjectedZoneEntryV1,
} from '../../online/projection';
import type {
  OnlineRoomIdV1,
  OnlineRoomParticipantIdV1,
} from '../../online/room';
import type { OnlineTabletopIntentEnvelopeV1 } from '../../online/tabletopManual';
import type { OnlineVisibilityIntentEnvelopeV1 } from '../../online/visibilityDecisions';
import './tabletopManualFixture.css';

const player = (value: string): CorePlayerId => value as CorePlayerId;
const object = (value: string): CoreObjectId => value as CoreObjectId;
const participant = (value: string): OnlineRoomParticipantIdV1 => value as OnlineRoomParticipantIdV1;
const room = (value: string): OnlineRoomIdV1 => value as OnlineRoomIdV1;
const tokenObject = (seed: string): CoreObjectId => object(`${['@', 'token', ':'].join('')}${seed}:0`);
const spellCopyObject = (seed: string): CoreObjectId => object(`${['@', 'spell-copy', ':'].join('')}${seed}`);

const EMPTY_MANA: CoreManaPoolV1 = Object.freeze({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });

function definition(
  name: string,
  typeLine: string,
  producedMana: readonly CoreCardDefinitionSnapshotV1['producedMana'][number][] = [],
): CoreCardDefinitionSnapshotV1 {
  return Object.freeze({
    source: Object.freeze({ kind: 'engine-synthetic' as const }),
    name,
    layout: 'normal',
    manaValue: typeLine.includes('Land') ? 0 : 2,
    colorIdentity: Object.freeze([]),
    typeLine,
    keywords: Object.freeze([]),
    producedMana: Object.freeze([...producedMana]),
    tokenKind: null,
    faces: Object.freeze([Object.freeze({
      name,
      manaCost: null,
      typeLine,
      oracleText: '',
      power: typeLine.includes('Creature') ? '2' : null,
      toughness: typeLine.includes('Creature') ? '2' : null,
      loyalty: null,
      defense: null,
    })]),
  });
}

function tokenDefinition(name: string): CoreCardDefinitionSnapshotV1 {
  return Object.freeze({
    source: Object.freeze({ kind: 'engine-synthetic' as const }),
    name,
    layout: 'normal',
    manaValue: 0,
    colorIdentity: Object.freeze([]),
    typeLine: 'Token Artifact',
    keywords: Object.freeze([]),
    producedMana: Object.freeze([]),
    tokenKind: 'treasure',
    faces: Object.freeze([Object.freeze({
      name,
      manaCost: null,
      typeLine: 'Token Artifact',
      oracleText: '',
      power: null,
      toughness: null,
      loyalty: null,
      defense: null,
    })]),
  });
}

function runtime(
  changes: Partial<OnlineProjectedObjectRuntimeV1> = {},
): OnlineProjectedObjectRuntimeV1 {
  return Object.freeze({
    faceIndex: 0,
    faceDown: false,
    tapped: false,
    flipped: false,
    phasedOut: false,
    counters: Object.freeze([]),
    markedDamage: 0,
    attachment: Object.freeze({ kind: 'none' as const }),
    ...changes,
  });
}

function visible(
  id: string,
  ownerPlayerId: string,
  controllerPlayerId: string,
  name: string,
  typeLine: string,
  objectKind: OnlineProjectedVisibleObjectV1['objectKind'] = 'card',
  objectRuntime: OnlineProjectedObjectRuntimeV1 = runtime(),
  cardDefinition?: CoreCardDefinitionSnapshotV1,
): OnlineProjectedVisibleObjectV1 {
  return Object.freeze({
    kind: 'visible-object',
    objectId: object(id),
    objectKind,
    ownerPlayerId: player(ownerPlayerId),
    controllerPlayerId: player(controllerPlayerId),
    commander: false,
    definition: cardDefinition ?? definition(name, typeLine),
    runtime: objectRuntime,
  });
}

function zone(entries: readonly OnlineProjectedZoneEntryV1[]): Readonly<{ readonly count: number; readonly entries: readonly OnlineProjectedZoneEntryV1[] }> {
  return Object.freeze({ count: entries.length, entries: Object.freeze([...entries]) });
}

const OWN_HAND_CARD = visible('P1-hand-scout:0', 'P1', 'P1', '卓上の斥候', 'Creature — Scout');
const OWN_HAND_LAND = visible('P1-hand-garden:0', 'P1', 'P1', '静かな庭', 'Basic Land — Forest', 'card', runtime(), definition('静かな庭', 'Basic Land — Forest', ['G']));
const OWN_BATTLEFIELD = visible('P1-battlefield-scribe:0', 'P1', 'P1', '記録者の書記', 'Creature — Human Wizard', 'card', runtime({
  tapped: true,
  counters: Object.freeze([{ kind: '+1/+1', count: 1 }]),
  markedDamage: 1,
}));
const OWN_ARTIFACT = visible('P1-battlefield-compass:0', 'P1', 'P1', '共有卓の羅針盤', 'Artifact');
const OPPONENT_BATTLEFIELD = visible('P2-battlefield-guardian:0', 'P2', 'P2', '対戦相手の守護者', 'Creature — Spirit');
const OWN_TREASURE = visible(tokenObject('manual-treasure'), 'P1', 'P1', '宝物トークン', 'Token Artifact', 'token', runtime(), tokenDefinition('宝物トークン'));
const OPPONENT_TREASURE = visible(tokenObject('opponent-treasure'), 'P2', 'P2', '相手の宝物', 'Token Artifact', 'token', runtime(), tokenDefinition('相手の宝物'));
const OWN_STACK = visible(spellCopyObject('manual-stack-source'), 'P1', 'P1', '公開スタックの宣言', 'Instant', 'spell-copy');
const OPPONENT_STACK = visible(spellCopyObject('opponent-stack-source'), 'P2', 'P2', '相手のスタック宣言', 'Instant', 'spell-copy');
const OWN_SEARCH_CANDIDATE = visible('P1-library-candidate:0', 'P1', 'P1', 'ライブラリー候補', 'Creature — Scout');

/**
 * A deterministic, redacted two-player projection for the local visual lane.
 * The v1 component contract is intentionally used here so the exact shipped
 * `OnlineTabletopManual` receives the same shape as the production player
 * projection. Hidden libraries and the opponent hand remain count-only.
 */
const TABLETOP_MANUAL_FIXTURE_PROJECTION: OnlineParticipantProjectionV1 = Object.freeze({
  kind: 'online-participant-projection-v1',
  schemaVersion: 1,
  protocolVersion: 1,
  roomId: room('tabletop-manual-fixture'),
  participantId: participant('tabletop-manual-player'),
  role: 'player',
  corePlayerId: player('P1'),
  revision: 12,
  room: Object.freeze({
    lifecycle: 'active',
    hostParticipantId: participant('tabletop-manual-player'),
    participants: Object.freeze([
      Object.freeze({ participantId: participant('tabletop-manual-player'), role: 'player' as const, presence: 'connected' as const, seatIndex: 0 as const }),
      Object.freeze({ participantId: participant('tabletop-manual-opponent'), role: 'player' as const, presence: 'connected' as const, seatIndex: 1 as const }),
    ]),
    seats: Object.freeze([
      Object.freeze({ seatIndex: 0 as const, corePlayerId: player('P1'), participantId: participant('tabletop-manual-player'), ready: true, outcome: 'pending' as const }),
      Object.freeze({ seatIndex: 1 as const, corePlayerId: player('P2'), participantId: participant('tabletop-manual-opponent'), ready: true, outcome: 'pending' as const }),
    ]),
  }),
  game: Object.freeze({
    turnOrder: Object.freeze([player('P1'), player('P2')]),
    turn: Object.freeze({
      activePlayerId: player('P1'),
      turnNumber: 3,
      positionSequence: 8,
      position: Object.freeze({ phase: 'precombat-main' as const, step: null }),
    }),
    players: Object.freeze([
      Object.freeze({
        playerId: player('P1'), life: 37, poison: 0, energy: 2, experience: 1, manaPool: EMPTY_MANA,
        mulliganCount: 0, landsPlayedThisTurn: 1, spellsCastThisTurn: 2, drawnThisTurn: 1,
        maximumHandSizeOverride: 'none' as const, status: 'active' as const, exitCause: null,
      }),
      Object.freeze({
        playerId: player('P2'), life: 40, poison: 1, energy: 0, experience: 0, manaPool: EMPTY_MANA,
        mulliganCount: 1, landsPlayedThisTurn: 0, spellsCastThisTurn: 1, drawnThisTurn: 0,
        maximumHandSizeOverride: 'none' as const, status: 'active' as const, exitCause: null,
      }),
    ]),
    zones: Object.freeze({
      byPlayer: Object.freeze([
        Object.freeze({
          playerId: player('P1'),
          zones: Object.freeze({
            library: zone([Object.freeze({ kind: 'hidden-card' }), Object.freeze({ kind: 'hidden-card' }), Object.freeze({ kind: 'hidden-card' })]),
            hand: zone([OWN_HAND_CARD, OWN_HAND_LAND]),
            graveyard: zone([visible('P1-graveyard-ritual:0', 'P1', 'P1', '前の卓上メモ', 'Sorcery')]),
          }),
        }),
        Object.freeze({
          playerId: player('P2'),
          zones: Object.freeze({
            library: zone([Object.freeze({ kind: 'hidden-card' }), Object.freeze({ kind: 'hidden-card' }), Object.freeze({ kind: 'hidden-card' })]),
            hand: zone([Object.freeze({ kind: 'hidden-card' }), Object.freeze({ kind: 'hidden-card' })]),
            graveyard: zone([visible('P2-graveyard-echo:0', 'P2', 'P2', '相手の公開済み記録', 'Instant')]),
          }),
        }),
      ]),
      battlefield: zone([OWN_BATTLEFIELD, OWN_ARTIFACT, OPPONENT_BATTLEFIELD, OWN_TREASURE, OPPONENT_TREASURE]),
      stack: zone([OWN_STACK, OPPONENT_STACK]),
      exile: zone([]),
      command: zone([visible('P1-commander:0', 'P1', 'P1', '卓上の統率者', 'Legendary Creature — Wizard', 'card', runtime(), definition('卓上の統率者', 'Legendary Creature — Wizard'))]),
    }),
    visibilityGrants: Object.freeze([]),
    searchSessions: Object.freeze([
      Object.freeze({
        sessionId: 'fixture-choice',
        rulesActorPlayerId: player('P1'),
        selectorPlayerId: player('P1'),
        zone: Object.freeze({ kind: 'player-zone' as const, playerId: player('P1'), zone: 'library' as const }),
        portion: Object.freeze({ kind: 'all' as const }),
        criteria: Object.freeze({ kind: 'quantity' as const, minimum: 1, maximum: 1 }),
        revealFound: false,
        shuffleAfter: false,
        candidates: Object.freeze([OWN_SEARCH_CANDIDATE]),
      }),
    ]),
    playPermissions: Object.freeze([]),
    notes: Object.freeze([
      Object.freeze({ id: 'note-setup', authorPlayerId: player('P1'), text: '次の優先権で公開メモを確認', creationRevision: 10 }),
      Object.freeze({ id: 'note-opponent', authorPlayerId: player('P2'), text: '相手が共有した公開メモ', creationRevision: 11 }),
    ]),
    manualStack: Object.freeze([
      Object.freeze({ id: 'manual-stack-previous', label: '解決待ちの公開宣言', provenance: 'freeform' as const, sourceObjectId: spellCopyObject('opponent-stack-source'), authorPlayerId: player('P2'), creationRevision: 11 }),
      Object.freeze({ id: 'manual-stack-top', label: '現在の最上段：ターン終了時の確認', provenance: 'structured' as const, sourceObjectId: spellCopyObject('manual-stack-source'), authorPlayerId: player('P1'), creationRevision: 12 }),
    ]),
  }),
});

export function TabletopManualFixture() {
  const projection = useMemo(() => TABLETOP_MANUAL_FIXTURE_PROJECTION, []);

  const submit = (envelope: OnlineTabletopIntentEnvelopeV1): void => {
    // Keep the fixture side effect bounded to finite, inspectable markers. No
    // command payload, card identity, room material, or private error enters
    // the document or console.
    document.documentElement.dataset.tabletopManualLastPrimitive = envelope.primitive.kind;
    document.documentElement.dataset.tabletopManualLastMode = envelope.mode;
  };

  const submitVisibility = (intent: OnlineVisibilityIntentEnvelopeV1): void => {
    // Only the operation kind is retained as a bounded, non-secret fixture
    // marker; IDs, payloads, and transport errors never reach the DOM/log.
    const operation = intent.look !== undefined ? 'look' : intent.reveal !== undefined ? 'reveal' : 'choose';
    document.documentElement.dataset.tabletopManualLastVisibilityOperation = operation;
  };

  return (
    <GameScreen
      keybindings={DEFAULT_KEYBINDINGS}
      presentation={(
        <div className="tabletop-manual-fixture" data-testid="tabletop-manual-fixture">
          <header className="tabletop-manual-fixture__banner">
            <p>DEV VISUAL FIXTURE</p>
            <span>2-player public projection · deterministic</span>
          </header>
          <OnlineTabletopManual
            projection={projection}
            interactionState="ready"
            onSubmit={submit}
          />
          <OnlineVisibilityDecisions
            projection={projection}
            interactionState="ready"
            onSubmit={submitVisibility}
          />
        </div>
      )}
    />
  );
}
