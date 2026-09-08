import { useCallback } from 'react';

import { GameScreen } from '../../components/game/GameScreen';
import {
  RemoteGameScreenActionRail,
  projectionToGameState,
  useRemoteGameScreenInteractionPort,
} from '../../components/online/remoteGameScreen';
import { OnlineVisibilityDecisions } from '../../components/online/OnlineVisibilityDecisions';
import { DEFAULT_KEYBINDINGS } from '../../data/keybindings';
import type { OnlineParticipantProjectionV1 } from '../../online/projection';
import type { OnlineTabletopIntentEnvelopeV1 } from '../../online/tabletopManual';
import type { OnlineVisibilityIntentEnvelope } from '../../online/visibilityDecisions';
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
  const submitVisibility = useCallback((intent: OnlineVisibilityIntentEnvelope): void => {
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
          placement="overview"
        />
      )}
      surfaceDialogs={(
        <>
          <details id="online-remote-guided-overlay" className="online-remote-guided-overlay" data-testid="online-remote-guided-overlay">
            <summary>ガイド付き操作（戦闘・手動）</summary>
            <OnlineVisibilityDecisions
              projection={projection}
              interactionState="ready"
              onSubmit={submitVisibility}
            />
          </details>
          <details id="online-remote-manual-overlay" className="online-remote-manual-overlay" data-testid="online-remote-manual-overlay">
            <summary>公開情報・Manual Resolve</summary>
            <p>fixture manual panel: 非公開情報は自動解決しません。</p>
          </details>
        </>
      )}
      surfaceActions={(
        <RemoteGameScreenActionRail
          projection={projection}
          interactionState="ready"
          busy={false}
          onSubmitTabletopIntent={submitTabletop}
          lastCommandSettlement={prioritySettlement}
          port={port}
          placement="actions"
        />
      )}
    />
  );
}
