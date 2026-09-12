import { useState } from 'react';
import {
  createCockpitTable,
  applyTableOperation,
  tableActivationPayment,
} from '../../engine/cockpitTable';
import { buildVisualFixture } from './fixtureBuilder';
import { CockpitTableSurface } from '../../components/game/CockpitTableSurface';
import { CockpitBattleTools } from '../../components/game/CockpitBattleTools';
import { Modal } from '../../components/Modal';
import '../../components/game/cockpitSession.css';

/** Layout comparison only; no session, credentials, persistence or simulated commits. */
export function CockpitTableFixture({
  players,
  stress = false,
}: {
  players: 2 | 4;
  stress?: boolean;
}) {
  const [table] = useState(() => {
    const sample = buildVisualFixture('board-dense').snapshot.state;
    const sampleCards = Object.values(sample.cards);
    const creatures = sampleCards.filter(
      (card) => !card.isCommander && /Creature/.test(sample.defs[card.defId].faces[0].typeLine),
    );
    const deck = (
      stress
        ? Array.from({ length: 210 }, (_, index) => creatures[index % creatures.length])
        : sampleCards
    ).map((card) => ({
      def: {
        ...sample.defs[card.defId],
        faces: sample.defs[card.defId].faces.map((face) => ({
          ...face,
          imageUrl: undefined,
          imageUrlSmall: undefined,
        })),
      },
      isCommander: card.isCommander,
    }));
    let next = createCockpitTable(
      deck,
      42,
      Array.from({ length: players }, () => deck),
    );
    for (const seat of next.seats) {
      next = applyTableOperation(next, { type: 'keep', seatId: seat.id, bottom: [] });
      next = applyTableOperation(next, {
        type: 'move',
        ids: seat.zones.library.slice(
          0,
          stress ? 100 : seat.id === 'P1' ? 8 : seat.id === 'P2' ? 20 : 30,
        ),
        to: 'battlefield',
        position: 'top',
      });
      if (stress) next = applyTableOperation(next, { type: 'draw', seatId: seat.id, count: 93 });
    }
    const attackers = Object.values(next.cards)
      .filter(
        (card) =>
          card.controllerId === 'P1' &&
          card.zone === 'battlefield' &&
          /Creature/.test(next.defs[card.defId].faces[0].typeLine),
      )
      .slice(0, 2);
    next = applyTableOperation(next, {
      type: 'battle.attack',
      attackers: attackers.map((card, index) => ({
        cardId: card.id,
        targetId: players === 4 && index === 1 ? 'P3' : 'P2',
      })),
      tapIds: attackers.map((card) => card.id),
    });
    const source = Object.values(next.cards).find(
      (card) => card.controllerId === (players === 4 ? 'P4' : 'P2') && card.zone === 'battlefield',
    )!;
    next = applyTableOperation(next, {
      type: 'activate',
      id: 'display-trigger',
      sourceId: source.id,
      choice: 'triggered',
      text: '表示比較用の誘発型能力。手動処理。',
      targets: ['P1'],
      manualCosts: null,
      paymentPlan: tableActivationPayment(next, source.id, 'triggered', null).paid,
    });
    for (const [id, def] of Object.entries(next.defs)) {
      const original = Object.values(sample.defs).find(
        (item) => item.scryfallId === def.scryfallId,
      );
      if (original) next.defs[id] = original;
    }
    return next;
  });
  const [selected, select] = useState<string[]>([]);
  const [detail, setDetail] = useState<string | null>(null);
  const [seatId, chooseSeat] = useState('P1');
  const view = { table, revision: 1, expiresAt: 0, canUndo: false, canRedo: false, receipt: null };
  return (
    <main className="cockpit-session">
      <CockpitTableSurface
        view={view}
        disabled
        pending={false}
        selected={selected}
        select={select}
        inspect={setDetail}
        cast={setDetail}
        send={() => Promise.resolve(false)}
        openMenu={() => setDetail('fixture')}
        seatId={seatId}
        chooseSeat={chooseSeat}
        peek={() => Promise.resolve()}
      >
        <CockpitBattleTools
          table={table}
          selected={selected}
          disabled
          send={() => Promise.resolve(false)}
        />
      </CockpitTableSurface>
      {detail && (
        <Modal title="表示比較" onClose={() => setDetail(null)}>
          <p>
            {table.defs[table.cards[detail]?.defId]?.faces[0]?.oracleText ??
              '通信と操作結果を検証する画面ではありません。'}
          </p>
        </Modal>
      )}
    </main>
  );
}
