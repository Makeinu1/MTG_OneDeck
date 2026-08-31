import { useCallback } from 'react';

import { GameScreen } from '../../components/game/GameScreen';
import {
  RemoteGameScreenActionRail,
  projectionToGameState,
  useRemoteGameScreenInteractionPort,
} from '../../components/online/remoteGameScreen';
import { DEFAULT_KEYBINDINGS } from '../../data/keybindings';
import type { OnlineParticipantProjectionV1 } from '../../online/projection';
import type { OnlineTabletopIntentEnvelopeV1 } from '../../online/tabletopManual';
import fixture from '../../online/workbench/fixtures/o4p-04a-personal-workbench-v1.json';

const projection = fixture as unknown as OnlineParticipantProjectionV1;
const prioritySettlement = Object.freeze({
  commandId: 'remote-priority-fixture',
  baseRevision: projection.revision - 1,
  currentRevision: projection.revision,
  acceptedRevision: projection.revision,
  commandKind: 'tabletop' as const,
  operation: 'priority-pass',
  outcome: 'accepted' as const,
  issueCode: null,
});

/** Dev-only visual entry. It mounts the production Remote surface without a room or network. */
export function RemoteGameScreenFixture() {
  const submitTabletop = useCallback((intent: OnlineTabletopIntentEnvelopeV1): void => {
    void intent;
  }, []);
  const port = useRemoteGameScreenInteractionPort({
    projection,
    interactionState: 'ready',
    busy: false,
    onSubmitTabletopIntent: submitTabletop,
  });
  if (projectionToGameState(projection) === null) throw new Error('Remote visual fixture projection is invalid');
  return (
    <GameScreen
      keybindings={DEFAULT_KEYBINDINGS}
      interactionPort={port}
      surfaceOverlay={(
        <RemoteGameScreenActionRail
          projection={projection}
          interactionState="ready"
          busy={false}
          onSubmitTabletopIntent={submitTabletop}
          lastCommandSettlement={prioritySettlement}
          port={port}
        />
      )}
    />
  );
}
