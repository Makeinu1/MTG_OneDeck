from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if text.count(old) != 1:
        raise SystemExit(f"expected exactly one match in {path}: {text.count(old)}")
    file.write_text(text.replace(old, new))


surface = "src/components/game/CockpitTableSurface.tsx"
replace_once(
    surface,
    """  const resources = useMemo(\n    () => new Map(table.seats.map((seat) => [seat.id, tableManaResources(table, seat.id)])),\n    [table],\n  );\n""",
    """  // Mana resources are an operation helper and reject eliminated seats. Rendering must\n  // keep those seats visible for spectators without reopening their operation authority.\n  const resources = useMemo(\n    () =>\n      new Map(\n        table.seats\n          .filter((seat) => !seat.eliminated)\n          .map((seat) => [seat.id, tableManaResources(table, seat.id)]),\n      ),\n    [table],\n  );\n""",
)
replace_once(
    surface,
    """    const choices =\n      card.zone === 'battlefield' && !card.tapped\n        ? manaActivationChoices(resources.get(card.controllerId)!, card.controllerId, id)\n        : [];\n""",
    """    const resource = resources.get(card.controllerId);\n    const choices =\n      card.zone === 'battlefield' && !card.tapped && resource\n        ? manaActivationChoices(resource, card.controllerId, id)\n        : [];\n""",
)
replace_once(
    surface,
    """    const manaChoices =\n      instance.zone === 'battlefield' && !instance.tapped\n        ? manaActivationChoices(resources.get(instance.controllerId)!, instance.controllerId, id)\n        : [];\n""",
    """    const resource = resources.get(instance.controllerId);\n    const manaChoices =\n      instance.zone === 'battlefield' && !instance.tapped && resource\n        ? manaActivationChoices(resource, instance.controllerId, id)\n        : [];\n""",
)
replace_once(
    surface,
    """          const choices = manaActivationChoices(resources.get(ownId)!, ownId, id);\n          return choices.length === 1 ? choices[0] : [];\n""",
    """          const resource = resources.get(ownId);\n          const choices = resource ? manaActivationChoices(resource, ownId, id) : [];\n          return choices.length === 1 ? choices[0] : [];\n""",
)

room = "src/components/game/CockpitRoomControls.tsx"
replace_once(
    room,
    """  const label = (id: string) => view.table.seats.find((seat) => seat.id === id)?.label ?? id;\n  const expiry = new Date(view.expiresAt);\n""",
    """  const ownSeat = view.table.seats.find((seat) => seat.id === multi.ownSeatId);\n  const eliminated = Boolean(ownSeat?.eliminated);\n  const label = (id: string) => view.table.seats.find((seat) => seat.id === id)?.label ?? id;\n  const expiry = new Date(view.expiresAt);\n""",
)
replace_once(
    room,
    """        {!multi.started\n          ? '全員の初手キープを待っています'\n          : multi.paused\n            ? '部屋主の接続待ち・操作停止中'\n            : multi.canOperate\n              ? 'あなたが卓を操作できます'\n              : '盤面を閲覧中・操作にはHOLDを要求'}\n""",
    """        {eliminated\n          ? multi.ownSeatId === 'P1'\n            ? '脱落・観戦中。ゲーム操作とHOLDはできません。部屋主の管理操作は利用できます'\n            : '脱落・観戦中。ゲーム操作とHOLDはできません'\n          : !multi.started\n            ? '全員の初手キープを待っています'\n            : multi.paused\n              ? '部屋主の接続待ち・操作停止中'\n              : multi.canOperate\n                ? 'あなたが卓を操作できます'\n                : '盤面を閲覧中・操作にはHOLDを要求'}\n""",
)
replace_once(
    room,
    """          <button\n            disabled={busy || multi.paused}\n            onClick={() =>\n              void send({ type: 'hold', held: !multi.holds.includes(multi.ownSeatId) })\n            }\n          >\n            {multi.holds.includes(multi.ownSeatId) ? '自分のHOLDを取り下げる' : 'HOLD・応答を要求'}\n          </button>\n""",
    """          {!eliminated && (\n            <button\n              disabled={busy || multi.paused}\n              onClick={() =>\n                void send({ type: 'hold', held: !multi.holds.includes(multi.ownSeatId) })\n              }\n            >\n              {multi.holds.includes(multi.ownSeatId)\n                ? '自分のHOLDを取り下げる'\n                : 'HOLD・応答を要求'}\n            </button>\n          )}\n""",
)

Path("src/components/game/CockpitEliminationContinuity.test.tsx").write_text(r'''import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { applyTableOperation, createCockpitTable } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import type { CockpitSessionView } from '../../online/browser/cockpitClient';
import { CockpitRoomControls } from './CockpitRoomControls';
import { CockpitTableSurface } from './CockpitTableSurface';

function counts(table: CockpitSessionView['table']) {
  return Object.fromEntries(
    table.seats.map((seat) => [
      seat.id,
      Object.fromEntries(Object.entries(seat.zones).map(([zone, ids]) => [zone, ids.length])),
    ]),
  ) as NonNullable<CockpitSessionView['multiplayer']>['counts'];
}

function multiplayerView(
  table: CockpitSessionView['table'],
  ownSeatId: string,
  masterId: string,
): CockpitSessionView {
  return {
    table,
    revision: 1,
    expiresAt: Date.UTC(2026, 8, 14, 18, 0, 0),
    canUndo: false,
    canRedo: false,
    receipt: null,
    multiplayer: {
      ownSeatId,
      ownerId: 'P1',
      masterId,
      started: true,
      paused: false,
      holds: [],
      borrowedFrom: null,
      canOperate: ownSeatId === masterId && !table.seats.find((seat) => seat.id === ownSeatId)?.eliminated,
      invitation: null,
      members: table.seats.map((seat) => ({ seatId: seat.id, connected: true, kicked: false })),
      counts: counts(table),
      peek: null,
    },
  };
}

it('keeps the full table renderable when another seat is eliminated', () => {
  const deck = makeDeck(30);
  let table = createCockpitTable(deck, 42, [deck, deck, deck, deck]);
  table.seats.forEach((seat) => {
    seat.kept = true;
  });
  table = applyTableOperation(table, { type: 'eliminate', seatId: 'P4' });
  const view = multiplayerView(table, 'P1', 'P1');
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    expect(() =>
      act(() =>
        root.render(
          <CockpitTableSurface
            view={view}
            disabled={false}
            pending={false}
            selected={[]}
            select={vi.fn()}
            inspect={vi.fn()}
            cast={vi.fn()}
            send={vi.fn(() => Promise.resolve(true))}
            openMenu={vi.fn()}
            seatId="P1"
            chooseSeat={vi.fn()}
            peek={vi.fn()}
          >
            <span>操作面</span>
          </CockpitTableSurface>,
        ),
      ),
    ).not.toThrow();
    expect(host.textContent).toContain('P4・脱落');
    expect(host.querySelectorAll('.table-opponent')).toHaveLength(3);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

it('keeps an eliminated participant as a spectator without offering HOLD', () => {
  const deck = makeDeck(30);
  let table = createCockpitTable(deck, 42, [deck, deck, deck, deck]);
  table.seats.forEach((seat) => {
    seat.kept = true;
  });
  table = applyTableOperation(table, { type: 'eliminate', seatId: 'P2' });
  const view = multiplayerView(table, 'P2', 'P1');
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    act(() =>
      root.render(
        <CockpitRoomControls view={view} invitation={null} busy={false} send={vi.fn()} />,
      ),
    );
    expect(host.textContent).toContain('脱落・観戦中');
    expect(host.textContent).not.toContain('HOLD・応答を要求');
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

it('retains room-owner management after game elimination without restoring HOLD', () => {
  const deck = makeDeck(30);
  let table = createCockpitTable(deck, 42, [deck, deck, deck, deck]);
  table.seats.forEach((seat) => {
    seat.kept = true;
  });
  table = applyTableOperation(table, { type: 'eliminate', seatId: 'P1' });
  const view = multiplayerView(table, 'P1', 'P2');
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    act(() =>
      root.render(
        <CockpitRoomControls view={view} invitation={null} busy={false} send={vi.fn()} />,
      ),
    );
    expect(host.textContent).toContain('部屋主の管理操作は利用できます');
    expect(host.textContent).not.toContain('HOLD・応答を要求');
    expect(
      [...host.querySelectorAll('button')].some((button) =>
        button.textContent?.includes('部屋主が操作権を回収'),
      ),
    ).toBe(true);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
''')

Path("src/components/game/CockpitBattleContinuity.test.tsx").write_text(r'''import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { applyTableOperation, createCockpitTable, type CockpitTable } from '../../engine/cockpitTable';
import { makeDeck } from '../../engine/__tests__/helpers';
import { CockpitBattleTools } from './CockpitBattleTools';

function renderBattle(root: Root, table: CockpitTable) {
  act(() =>
    root.render(
      <CockpitBattleTools
        table={table}
        selected={[]}
        disabled={false}
        send={vi.fn(() => Promise.resolve(true))}
      />,
    ),
  );
}

it('invalidates a damage draft when its combat source leaves instead of rendering stale work as valid', () => {
  const deck = makeDeck(20);
  let table = createCockpitTable(deck, 1, [deck, deck]);
  table.seats.forEach((seat) => {
    seat.kept = true;
  });
  const attacker = table.seats[0].zones.hand[0];
  table = applyTableOperation(table, {
    type: 'move',
    ids: [attacker],
    to: 'battlefield',
    position: 'top',
  });
  table = applyTableOperation(table, {
    type: 'battle.attack',
    attackers: [{ cardId: attacker, targetId: 'P2' }],
    tapIds: [attacker],
  });

  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    renderBattle(root, table);
    const suggest = [...host.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent === 'ブロックなしの割当を作る',
    )!;
    act(() => suggest.click());
    expect(host.querySelector('.table-damage-rows')?.textContent).toContain('P2');

    table = applyTableOperation(table, {
      type: 'move',
      ids: [attacker],
      to: 'exile',
      position: 'top',
    });
    expect(() => renderBattle(root, table)).not.toThrow();
    expect(host.textContent).toContain('戦闘やカードが変わりました');
    const apply = [...host.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent === 'このダメージを反映',
    )!;
    expect(apply.disabled).toBe(true);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

it('renders a partial combat projection with a missing participant without dereferencing it', () => {
  const deck = makeDeck(20);
  let table = createCockpitTable(deck, 1, [deck, deck]);
  table.seats.forEach((seat) => {
    seat.kept = true;
  });
  const attacker = table.seats[0].zones.hand[0];
  table = applyTableOperation(table, {
    type: 'move',
    ids: [attacker],
    to: 'battlefield',
    position: 'top',
  });
  table = applyTableOperation(table, {
    type: 'battle.attack',
    attackers: [{ cardId: attacker, targetId: 'P2' }],
    tapIds: [attacker],
  });
  const partial = structuredClone(table);
  delete partial.cards[attacker];
  partial.seats[0].zones.battlefield = partial.seats[0].zones.battlefield.filter(
    (id) => id !== attacker,
  );

  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  try {
    expect(() => renderBattle(root, partial)).not.toThrow();
    expect(host.textContent).toContain(attacker);
    expect(host.textContent).toContain('P2');
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
''')

print("stage9 render continuity transform complete")
