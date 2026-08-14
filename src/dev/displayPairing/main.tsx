import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../index.css';
import { OnlineDisplayPairing } from '../../components/online/OnlineDisplayPairing';
import type { OnlineOpponentFocusActionV1 } from '../../online/displayPairing/index';
import type { PersonalWorkbenchActionV1 } from '../../online/workbench/index';
import fixture from '../../online/workbench/fixtures/o4p-04a-personal-workbench-v1.json';

type MutableProjection = {
  participantId: string;
  role: string;
  corePlayerId: string | null;
  room: { participants: Array<{ participantId: string; role: string; presence: string; seatIndex: number | null }> };
  game: { zones: { byPlayer: Array<{ zones: Record<'library' | 'hand', { count: number; entries: unknown[] }> }> } };
};

function tableFixture(): { readonly personal: unknown; readonly table: unknown } {
  const personal = JSON.parse(JSON.stringify(fixture)) as MutableProjection;
  personal.room.participants.push({
    participantId: 'table-display',
    role: 'table',
    presence: 'connected',
    seatIndex: null,
  });
  const table = JSON.parse(JSON.stringify(personal)) as MutableProjection;
  table.participantId = 'table-display';
  table.role = 'table';
  table.corePlayerId = null;
  for (const group of table.game.zones.byPlayer) {
    for (const zoneName of ['library', 'hand'] as const) {
      const zone = group.zones[zoneName];
      zone.entries = Array.from({ length: zone.count }, () => ({ kind: 'hidden-card' }));
    }
  }
  return { personal, table };
}

const fixturePair = tableFixture();

export function DisplayPairingFixture() {
  const [focusedPlayerId, setFocusedPlayerId] = useState<string | null>(null);
  const [focusAction, setFocusAction] = useState<OnlineOpponentFocusActionV1 | null>(null);
  const [workbenchAction, setWorkbenchAction] = useState<PersonalWorkbenchActionV1 | null>(null);
  return (
    <>
      <OnlineDisplayPairing
        personalProjection={fixturePair.personal}
        tableProjection={fixturePair.table}
        interactionState="ready"
        focusedPlayerId={focusedPlayerId}
        onFocus={(action) => { setFocusedPlayerId(action.playerId); setFocusAction(action); }}
        onAction={setWorkbenchAction}
      />
      <output data-testid="display-pairing-last-action">
        {JSON.stringify({ focusAction, workbenchAction })}
      </output>
    </>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Display Pairing fixture root is missing');

createRoot(root).render(<DisplayPairingFixture />);
