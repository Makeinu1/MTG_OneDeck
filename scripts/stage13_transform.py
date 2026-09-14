from pathlib import Path

migration = Path('src/engine/__tests__/cockpitMigration.test.ts')
text = migration.read_text()
marker = "covers explicit zero, triggered and copied legacy stack cases"
assert marker not in text
insert = r'''

  it('covers explicit zero, triggered and copied legacy stack cases through JSON reload and top resolution', () => {
    const deck = makeDeck(16);

    {
      const state = initGame(deck, 31);
      const snapshot = { version: 1, state, deck, autoAdvanceToMain: false };
      const original = structuredClone(snapshot);
      let table = migrateCockpitSnapshot(snapshot);
      expect(table.stack).toEqual([]);
      table = JSON.parse(JSON.stringify(table)) as CockpitTable;
      expect(table.stack).toEqual([]);
      expect(snapshot).toEqual(original);
    }

    {
      let state = initGame(deck, 32);
      state = applyCommand(state, { type: 'draw', count: 7 }).state;
      const source = state.zones.hand[0];
      state = applyCommand(state, {
        type: 'moveCard',
        cardId: source,
        to: 'battlefield',
        position: 'top',
      }).state;
      state = applyCommand(state, {
        type: 'addAbilityToStack',
        sourceId: source,
        kind: 'triggered',
        resolutionText: 'Triggered legacy effect',
        sourceSnapshot: objectSnapshotForCard(state, source)!,
        targetSelections: [
          {
            slotId: 'player',
            raw: 'target player',
            kind: 'player',
            legalityMode: 'unchecked-warning',
            selection: { kind: 'player', playerId: 'OPPONENT_A' },
          },
        ],
      }).state;
      const legacyTop = state.zones.stack.at(-1)!;
      const snapshot = { version: 1, state, deck, autoAdvanceToMain: false };
      const original = structuredClone(snapshot);
      let table = migrateCockpitSnapshot(snapshot);
      expect(table.stack[0]).toMatchObject({
        stackCardId: legacyTop,
        kind: 'triggered',
        text: 'Triggered legacy effect',
        targets: ['OPPONENT_A'],
      });
      table = JSON.parse(JSON.stringify(table)) as CockpitTable;
      expect(table.stack[0].stackCardId).toBe(legacyTop);
      table = applyTableOperation(table, { type: 'resolve.begin' });
      expect(table.resolution).toMatchObject({ stackCardId: legacyTop, kind: 'triggered' });
      table = applyTableOperation(table, { type: 'resolve.end', to: 'graveyard' });
      expect(table.stack).toHaveLength(0);
      expect(snapshot).toEqual(original);
    }

    {
      let state = initGame(deck, 33);
      state = applyCommand(state, { type: 'draw', count: 7 }).state;
      const spell = state.zones.hand[0];
      state = applyCommand(state, {
        type: 'moveCard',
        cardId: spell,
        to: 'stack',
        position: 'top',
      }).state;
      state.cards[spell].isCopy = true;
      const snapshot = { version: 1, state, deck, autoAdvanceToMain: false };
      const original = structuredClone(snapshot);
      let table = migrateCockpitSnapshot(snapshot);
      expect(table.stack[0]).toMatchObject({ stackCardId: spell, kind: 'spell', copied: true });
      table = JSON.parse(JSON.stringify(table)) as CockpitTable;
      expect(table.stack[0]).toMatchObject({ stackCardId: spell, copied: true });
      table = applyTableOperation(table, { type: 'resolve.begin' });
      expect(table.resolution?.copied).toBe(true);
      table = applyTableOperation(table, { type: 'resolve.end', to: 'graveyard' });
      expect(table.stack).toHaveLength(0);
      expect(table.cards[spell]).toBeUndefined();
      expect(snapshot).toEqual(original);
    }
  });
'''
needle = "\n  it('keeps an unsupported pending choice intact instead of silently dropping it', () => {"
assert needle in text
migration.write_text(text.replace(needle, insert + needle, 1))

session = Path('src/online/cloudflare/__tests__/cockpitSession.test.ts')
text = session.read_text()
marker = "dismisses a departing seat pending trigger and preserves saved summoning-sickness mana boundary"
assert marker not in text
helper_old = "function multiplayerHarness(seats: 2 | 4) {"
helper_new = "function multiplayerHarness(seats: 2 | 4, deckFactory: (seatIndex: number) => ReturnType<typeof makeDeck> = () => makeDeck(20)) {"
assert text.count(helper_old) == 1
text = text.replace(helper_old, helper_new, 1)
create_old = "const created = await call(0, { type: 'create', seats, seed: 1, deck: makeDeck(20) });"
create_new = "const created = await call(0, { type: 'create', seats, seed: 1, deck: deckFactory(0) });"
assert text.count(create_old) == 1
text = text.replace(create_old, create_new, 1)
join_old = "expect((await call(i, { type: 'join', invitation, deck: makeDeck(20) })).status).toBe(200);"
join_new = "expect((await call(i, { type: 'join', invitation, deck: deckFactory(i) })).status).toBe(200);"
assert text.count(join_old) == 1
text = text.replace(join_old, join_new, 1)

append = r'''

it('dismisses a departing seat pending trigger and preserves saved summoning-sickness mana boundary', async () => {
  const triggerRoom = multiplayerHarness(2);
  await triggerRoom.start();
  const triggered = await triggerRoom.change(0, {
    type: 'token',
    id: 'departing-witness',
    seatId: 'P2',
    name: 'Departing Witness',
    typeLine: 'Creature',
    power: '1',
    toughness: '1',
    text: 'When Departing Witness enters the battlefield, draw a card.',
  });
  expect(triggered.status).toBe(200);
  const pending = triggered.value.table.triggers?.candidates.find(
    (candidate) => candidate.controllerId === 'P2' && candidate.status === 'pending',
  );
  expect(pending).toBeDefined();
  const eliminated = await triggerRoom.change(0, { type: 'eliminate', seatId: 'P2' }, true);
  expect(eliminated.status).toBe(200);
  expect(
    eliminated.value.table.triggers?.candidates.find(
      (candidate) => candidate.pendingTriggerId === pending!.pendingTriggerId,
    ),
  ).toMatchObject({ status: 'dismissed', reason: 'コントローラーがゲームを離れました。' });
  expect((await triggerRoom.change(0, { type: 'phase' })).status).toBe(200);

  const manaDef = {
    ...makeDeck(1)[0].def,
    scryfallId: 'stage13-mana-creature',
    oracleId: 'stage13-mana-creature',
    name: 'Stage13 Mana Creature',
    typeLine: 'Creature — Elf Druid',
    producedMana: ['G'] as const,
    faces: [
      {
        name: 'Stage13 Mana Creature',
        typeLine: 'Creature — Elf Druid',
        oracleText: '{T}: Add {G}.',
        power: '1',
        toughness: '1',
      },
    ],
  };
  const manaDeck = () =>
    Array.from({ length: 20 }, () => ({ def: structuredClone(manaDef), isCommander: false }));
  const room = multiplayerHarness(4, manaDeck);
  await room.start();
  let read = await room.call(0, { type: 'read' });
  const manaCard = read.value.table.seats[0].zones.hand[0];
  expect(
    (await room.change(0, { type: 'move', ids: [manaCard], to: 'battlefield', position: 'top' }))
      .status,
  ).toBe(200);
  await room.nextTurn(0);
  await room.nextTurn(0);
  read = await room.nextTurn(0);
  expect(read.value.table.activeSeatId).toBe('P4');
  expect(read.value.table.seats[0].turnStartedAt).toBe(1);
  const generate = {
    type: 'generate',
    cardId: manaCard,
    commands: [
      { type: 'setTapped', cardId: manaCard, tapped: true },
      { type: 'addMana', color: 'G', amount: 1, playerId: 'P1' },
    ],
  };
  expect((await room.change(0, generate)).status).toBe(422);
  const afterElimination = await room.change(0, { type: 'eliminate', seatId: 'P2' }, true);
  expect(afterElimination.status).toBe(200);
  expect(afterElimination.value.table.seats[0].turnStartedAt).toBe(1);
  expect((await room.change(0, generate)).status).toBe(422);
  const nextP1 = await room.nextTurn(0);
  expect(nextP1.value.table.activeSeatId).toBe('P1');
  expect(nextP1.value.table.seats[0].turnStartedAt).toBe(nextP1.value.table.turn);
  const generated = await room.change(0, generate);
  expect(generated.status).toBe(200);
  expect(generated.value.table.seats[0].mana.G).toBe(1);
  expect(generated.value.table.cards[manaCard].tapped).toBe(true);
  const persisted = await room.call(0, { type: 'read' });
  expect(persisted.value.table.seats[0].mana.G).toBe(1);
  expect(persisted.value.table.cards[manaCard].tapped).toBe(true);
});
'''
session.write_text(text + append)
