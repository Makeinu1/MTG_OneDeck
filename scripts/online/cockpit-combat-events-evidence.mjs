/** Local-only persisted rule regression checks. Credentials and private data stay in memory. */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.env.COCKPIT_URL ?? 'http://127.0.0.1:5173';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const output = process.env.COCKPIT_EVIDENCE_DIR ?? '/tmp/cockpit-stage2-evidence';
const report = { sourceSha: process.env.COCKPIT_SOURCE_SHA ?? 'local-uncommitted', checks: [], fullMatch: false, normalUi: false };
let stage = 'setup';
function deck(watched = false) {
  return Array.from({ length: 20 }, (_, i) => ({ isCommander: false, def: {
    scryfallId: `rules-${i}`, oracleId: `rules-${i}`, name: `Rules ${i}`, lang: 'en', layout: 'normal', cmc: 0, colorIdentity: [], typeLine: 'Creature',
    faces: [{ name: `Rules ${i}`, typeLine: 'Creature', manaCost: '{0}', power: '2', toughness: '2', oracleText: watched && i < 7 ? 'Whenever another nontoken creature enters the battlefield under your control, draw a card.' : '' }],
  } }));
}
async function room(watched = false) {
  const address = randomUUID();
  const people = Array.from({ length: 2 }, () => ({ token: randomBytes(32).toString('hex'), connectionId: randomUUID() }));
  const call = async (index, body) => {
    const response = await fetch(`${origin}/api/cockpit/${address}`, { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ ...body, ...people[index] }) });
    return { status: response.status, value: await response.json() };
  };
  const read = async (index = 0) => {
    const result = await call(index, { type: 'read' });
    assert.equal(result.status, 200, 'Read must succeed');
    return result.value;
  };
  const first = await call(0, { type: 'create', seats: 2, deck: deck(watched), seed: 1 });
  assert.equal(first.status, 200);
  assert.equal((await call(1, { type: 'join', deck: deck(watched), invitation: first.value.multiplayer.invitation })).status, 200);
  const change = async (index, operation, control = false, status = 200) => {
    const view = await read(index);
    const result = await call(index, { type: control ? 'control' : 'commit', revision: view.revision, requestId: randomUUID(), [control ? 'control' : 'operation']: operation });
    assert.equal(result.status, status, 'Unexpected mutation status');
    return result.value;
  };
  await change(0, { type: 'keep', seatId: 'P1', bottom: [] });
  await change(1, { type: 'keep', seatId: 'P2', bottom: [] });
  await change(0, { type: 'start' }, true);
  return { change, read };
}
try {
  stage = 'combat-control-and-movement';
  const battle = await room();
  const initial = await battle.read();
  const [a, b] = initial.table.seats[0].zones.hand;
  await battle.change(0, { type: 'move', ids: [a, b], to: 'battlefield', position: 'top' });
  await battle.change(0, { type: 'battle.attack', attackers: [{ cardId: a, targetId: 'P2' }, { cardId: b, targetId: 'P2' }], tapIds: [a, b] });
  await battle.change(0, { type: 'battle.assign', assignments: [{ sourceId: a, targetId: 'P2', amount: 2 }, { sourceId: b, targetId: 'P2', amount: 2 }] });
  await battle.change(0, { type: 'control', ids: [a], seatId: 'P2' });
  const changed = await battle.read();
  assert.equal(changed.table.combat.attackers.length, 1);
  assert.equal(changed.table.combat.assignments.length, 0);
  const rejected = await battle.change(0, { type: 'battle.apply', assignments: [{ sourceId: a, targetId: 'P2', amount: 2 }] }, false, 422);
  assert.equal(rejected.error, 'OPERATION_NOT_SAVED');
  assert.equal((await battle.read()).table.seats[1].life, 40);
  await battle.change(0, { type: 'battle.apply', assignments: [{ sourceId: b, targetId: 'P2', amount: 2 }] });
  assert.equal((await battle.read(1)).table.seats[1].life, 38);
  await battle.change(0, { type: 'move', ids: [b], to: 'hand', position: 'top' });
  const other = await battle.read(1);
  assert.equal(other.table.combat.attackers.length, 0);
  assert.equal(other.table.cards[b], undefined);
  assert.equal(other.table.combat.damageApplied, true);
  report.checks.push({ name: 'control change invalidates damage; remaining attacker deals damage once; bounce removes public combat reference', passed: true });

  stage = 'copied-permanent-etb';
  const copies = await room(true);
  const start = await copies.read();
  const hand = start.table.seats[0].zones.hand;
  const watcher = hand.find((id) => start.table.defs[start.table.cards[id].defId].faces[0].oracleText);
  const spell = hand.find((id) => !start.table.defs[start.table.cards[id].defId].faces[0].oracleText);
  assert.ok(watcher && spell);
  await copies.change(0, { type: 'move', ids: [watcher], to: 'battlefield', position: 'top' });
  const cast = await copies.change(0, { type: 'cast', cardId: spell, x: 0, targets: [], paymentPlan: [{ type: 'payMana', payment: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }, playerId: 'P1' }] });
  const entryId = cast.table.stack[0].id;
  await copies.change(0, { type: 'copyStack', entryId, id: 'local-copy-proof', controllerId: 'P1', targets: [] });
  await copies.change(0, { type: 'resolve.finish', entryId: 'local-copy-proof', to: 'battlefield' });
  const copyResult = await copies.read(1);
  assert.equal(copyResult.table.cards['local-copy-proof'].isToken, true);
  assert.equal(copyResult.table.triggers.candidates.length, 0);
  await copies.change(0, { type: 'resolve.finish', entryId, to: 'battlefield' });
  assert.equal((await copies.read()).table.triggers.candidates.length, 1);
  report.checks.push({ name: 'copy ETB avoids nontoken trigger; original permanent still triggers; persisted results visible to both seats', passed: true });
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.failedStage = stage;
  report.failureCategory = error.name;
  process.exitCode = 1;
} finally {
  await mkdir(output, { recursive: true });
  await writeFile(`${output}/stage2-rules-report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
