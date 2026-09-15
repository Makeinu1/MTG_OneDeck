import { createRoot } from 'react-dom/client';
import { AudioVisualProvider } from '../../src/components/game/presentation/AudioVisualProvider';
import { CockpitSessionScreen } from '../../src/components/game/CockpitSessionScreen';
import { applyTableOperation, createCockpitTable, type CockpitTable } from '../../src/engine/cockpitTable';
import { applyR4TableOperation, type R4TableOperation } from '../../src/engine/cockpitR4';
import { makeDeck } from '../../src/engine/__tests__/helpers';
import type { ZoneId } from '../../src/engine/types';

interface EvidenceWindow extends Window {
  __r4EvidenceReady?: boolean;
  __r4EvidenceIds?: {
    landId: string;
    costId: string;
    graveId: string;
    faceDownId: string;
  };
  __r4EvidenceOperations?: R4TableOperation[];
  __r4EvidenceTable?: CockpitTable;
}

const evidenceWindow = window as EvidenceWindow;
const deck = makeDeck(30);
let table = createCockpitTable(deck, 42);
table.seats[0].kept = true;
table.phase = 'main1';
const [landId, costId, graveId, faceDownId] = table.seats[0].zones.hand.slice(0, 4);

function relocate(cardId: string, to: ZoneId): void {
  const card = table.cards[cardId];
  for (const seat of table.seats)
    for (const zone of Object.keys(seat.zones) as ZoneId[])
      seat.zones[zone] = seat.zones[zone].filter((id) => id !== cardId);
  card.zoneChangeCounter += 1;
  card.zone = to;
  card.controllerId = card.ownerId;
  card.enteredTurn = to === 'battlefield' ? table.turn : 0;
  table.seats.find((seat) => seat.id === card.ownerId)!.zones[to].unshift(cardId);
}

const landCard = table.cards[landId];
const landDef = table.defs[landCard.defId];
landDef.typeLine = 'Basic Land — Forest';
landDef.faces[landCard.faceIndex].typeLine = 'Basic Land — Forest';
landDef.faces[landCard.faceIndex].manaCost = '';
landDef.faces[landCard.faceIndex].oracleText = '';

const graveCard = table.cards[graveId];
const graveDef = table.defs[graveCard.defId];
graveDef.typeLine = 'Instant';
graveDef.faces[graveCard.faceIndex].typeLine = 'Instant';
graveDef.faces[graveCard.faceIndex].manaCost = '{0}';
graveDef.faces[graveCard.faceIndex].oracleText = 'Evidence spell.';
relocate(graveId, 'graveyard');
relocate(faceDownId, 'battlefield');
table.cards[faceDownId].faceDown = true;

let revision = 1;
const operations: R4TableOperation[] = [];
evidenceWindow.__r4EvidenceIds = { landId, costId, graveId, faceDownId };
evidenceWindow.__r4EvidenceOperations = operations;
evidenceWindow.__r4EvidenceTable = table;

const originalFetch = window.fetch.bind(window);
const jsonResponse = () =>
  new Response(
    JSON.stringify({
      table,
      revision,
      expiresAt: Date.now() + 60_000,
      canUndo: false,
      canRedo: false,
      receipt: null,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (!url.includes('/api/cockpit/')) return originalFetch(input, init);
  const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, any>) : {};
  if (body.type === 'commit') {
    const operation = structuredClone(body.operation) as R4TableOperation;
    operations.push(operation);
    try {
      table = body.context
        ? applyR4TableOperation(
            table,
            { operation, context: body.context },
            String(body.requestId ?? crypto.randomUUID()),
          )
        : applyTableOperation(table, operation as never, String(body.requestId ?? crypto.randomUUID()));
      revision += 1;
      evidenceWindow.__r4EvidenceTable = table;
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: 'OPERATION_NOT_SAVED',
          message: error instanceof Error ? error.message : 'evidence operation rejected',
        }),
        { status: 422, headers: { 'content-type': 'application/json' } },
      );
    }
  }
  evidenceWindow.__r4EvidenceReady = true;
  return jsonResponse();
};

const root = document.getElementById('root');
if (!root) throw new Error('R4 evidence root missing');
createRoot(root).render(
  <AudioVisualProvider>
    <CockpitSessionScreen deck={deck} onBack={() => undefined} />
  </AudioVisualProvider>,
);
