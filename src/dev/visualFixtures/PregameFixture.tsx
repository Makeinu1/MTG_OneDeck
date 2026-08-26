import type { OnlinePregameProjectionV1 } from '../../online/pregame/index';
import { GameScreen } from '../../components/game/GameScreen';
import { PregameLayer } from '../../components/online/OnlinePregameLayer';
import { DEFAULT_KEYBINDINGS } from '../../data/keybindings';

function projection(playerCount: 2 | 4): OnlinePregameProjectionV1 {
  const playerIds = Array.from(
    { length: playerCount },
    (_, index) => `P${index + 1}` as OnlinePregameProjectionV1['turnOrder'][number],
  );
  const firstPlayer = playerIds[0];
  return {
    kind: 'online-pregame-projection-v1',
    schemaVersion: 1,
    revision: 7,
    phase: 'mulligan-bottom',
    currentPlayerId: firstPlayer,
    startingPlayerId: firstPlayer,
    turnOrder: playerIds,
    players: playerIds.map((playerId, index) => ({
      playerId,
      commanderConfirmed: true,
      mulliganDecision: index === 0 ? 'mulligan' : 'keep',
      mulligansTaken: index === 0 ? 1 : 0,
      bottomCountRequired: index === 0 ? 1 : 0,
      pendingBottomCount: 0,
      manualActionCount: 0,
      manualActionsComplete: false,
      ready: false,
    })),
    protocol: {
      kind: 'online-participant-projection-v3',
      schemaVersion: 3,
      protocolVersion: 1,
      roomId: `pregame-visual-${playerCount}`,
      participantId: 'pregame-visual-player',
      role: 'player',
      corePlayerId: firstPlayer,
      revision: 0,
      configuration: { playerCount, startingLife: 40 },
      room: {
        lifecycle: 'started',
        hostParticipantId: 'pregame-visual-player',
        participants: [],
        seats: [],
      },
      game: {
        turnOrder: playerIds,
        turn: {},
        players: [],
        zones: {
          command: {
            entries: [{
              kind: 'visible-object',
              objectId: 'pregame-visual-commander',
              commander: true,
              definition: { name: 'Visual Commander' },
            }],
          },
          byPlayer: [{
            playerId: firstPlayer,
            zones: {
              hand: {
                entries: [
                  { kind: 'visible-object', objectId: 'pregame-visual-hand-1', definition: { name: 'Visual Hand One' } },
                  { kind: 'visible-object', objectId: 'pregame-visual-hand-2', definition: { name: 'Visual Hand Two' } },
                  { kind: 'visible-object', objectId: 'pregame-visual-hand-3', definition: { name: 'Visual Hand Three' } },
                ],
              },
            },
          }],
        },
        visibilityGrants: [],
        searchSessions: [],
        playPermissions: [],
      },
    },
  };
}

export function PregameFixture({ playerCount }: { readonly playerCount: 2 | 4 }) {
  return (
    <GameScreen
      keybindings={DEFAULT_KEYBINDINGS}
      presentation={(
        <PregameLayer
          port={{
            projection: projection(playerCount),
            busy: false,
            connection: 'online',
            error: null,
            onConfirmCommanders: () => {
              document.documentElement.dataset.lastPregameCommand = 'confirm-commanders';
            },
            onMulliganDecision: (decision) => {
              document.documentElement.dataset.lastPregameCommand = `declare-mulligan:${decision}`;
            },
            onSubmitMulliganBottom: () => {
              document.documentElement.dataset.lastPregameCommand = 'submit-mulligan-bottom';
            },
            onRecordPregameAction: () => {
              document.documentElement.dataset.lastPregameCommand = 'record-manual-pregame-action';
            },
            onCompletePregameActions: () => {
              document.documentElement.dataset.lastPregameCommand = 'complete-pregame-actions';
            },
            onSetReady: () => {
              document.documentElement.dataset.lastPregameCommand = 'set-ready';
            },
          }}
        />
      )}
    />
  );
}
