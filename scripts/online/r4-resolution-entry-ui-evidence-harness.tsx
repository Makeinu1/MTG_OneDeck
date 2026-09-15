import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AudioVisualProvider } from '../../src/components/game/presentation/AudioVisualProvider';
import { CockpitTableSurface } from '../../src/components/game/CockpitTableSurface';
import { createCockpitTable, type CockpitTable } from '../../src/engine/cockpitTable';
import {
  applyR4TableOperation,
  type R4TableOperation,
} from '../../src/engine/cockpitR4';
import type { ExpectedInteractionContext } from '../../src/engine/cockpitR31';
import { makeDeck } from '../../src/engine/__tests__/helpers';

interface EvidenceCommit {
  operation: R4TableOperation;
  context: ExpectedInteractionContext;
}

interface EvidenceWindow extends Window {
  __r4EntryEvidenceReady?: boolean;
  __r4EntryEvidenceCardId?: string;
  __r4EntryEvidenceCommits?: EvidenceCommit[];
  __r4EntryEvidenceTable?: CockpitTable;
}

const evidenceWindow = window as EvidenceWindow;
const deck = makeDeck(30);
const initialTable = createCockpitTable(deck, 81);
initialTable.seats[0].kept = true;
initialTable.phase = 'main1';
const cardId = initialTable.seats[0].zones.hand[0];
const card = initialTable.cards[cardId];
const def = initialTable.defs[card.defId];
def.typeLine = 'Creature';
def.faces[card.faceIndex].typeLine = 'Creature';
def.faces[card.faceIndex].oracleText = 'Resolution entry browser evidence.';
initialTable.seats[0].zones.hand = initialTable.seats[0].zones.hand.filter((id) => id !== cardId);
card.zoneChangeCounter += 1;
card.zone = 'stack';
card.controllerId = card.ownerId;
card.enteredTurn = 0;
initialTable.seats[0].zones.stack.unshift(cardId);
const entry = {
  id: 'browser-resolution-entry',
  kind: 'spell' as const,
  source: structuredClone(card),
  controllerId: 'P1',
  targets: [],
  targetSnapshots: {},
  paid: [],
  text: 'Resolution entry browser evidence.',
  stackCardId: cardId,
};
initialTable.stack = [entry];
initialTable.resolution = structuredClone(entry);

const commits: EvidenceCommit[] = [];
evidenceWindow.__r4EntryEvidenceCardId = cardId;
evidenceWindow.__r4EntryEvidenceCommits = commits;
evidenceWindow.__r4EntryEvidenceTable = initialTable;

function EvidenceApp() {
  const [table, setTable] = useState(initialTable);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    evidenceWindow.__r4EntryEvidenceReady = true;
  }, []);

  async function send(
    operation: Parameters<typeof CockpitTableSurface>[0]['send'] extends (
      operation: infer T,
      ...args: any[]
    ) => any
      ? T
      : never,
    context?: ExpectedInteractionContext,
  ): Promise<boolean> {
    if (!context) throw new Error('Resolution entry evidence requires explicit context');
    const formal = structuredClone(operation) as R4TableOperation;
    commits.push({ operation: formal, context: structuredClone(context) });
    const next = applyR4TableOperation(
      table,
      { operation: formal, context },
      `browser-entry-evidence-${commits.length}`,
    );
    evidenceWindow.__r4EntryEvidenceTable = next;
    setTable(next);
    return true;
  }

  return (
    <AudioVisualProvider>
      <CockpitTableSurface
        view={{
          table,
          canUndo: false,
          canRedo: false,
        }}
        disabled={false}
        pending={false}
        selected={selected}
        select={setSelected}
        inspect={() => undefined}
        cast={() => undefined}
        send={send}
        openMenu={() => undefined}
        seatId="P1"
        chooseSeat={() => undefined}
        peek={async () => null}
      >
        {null}
      </CockpitTableSurface>
    </AudioVisualProvider>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Resolution entry evidence root missing');
createRoot(root).render(<EvidenceApp />);
