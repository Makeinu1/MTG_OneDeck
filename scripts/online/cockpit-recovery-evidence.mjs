/** Local-only stage-1 acceptance. No production endpoints, credentials, or raw response logging. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const origin = process.env.COCKPIT_URL ?? 'http://127.0.0.1:5173';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname));
const output = process.env.COCKPIT_EVIDENCE_DIR ?? '/tmp/cockpit-stage1-evidence';
await mkdir(output, { recursive: true });
const report = { stage: 'stage1-recovery', sourceSha: process.env.COCKPIT_SOURCE_SHA ?? null, checks: [], fullMatch: false };
const record = (name) => report.checks.push({ name, passed: true });
let stage = 'initialization';
let browser;
const pages = [];
const transport = [];
const deck = (privateDeck = false) => Array.from({ length: 40 }, (_, i) => ({
  isCommander: false,
  def: {
    scryfallId: `${privateDeck ? 'private' : 'repair'}-${i}`, oracleId: `${privateDeck ? 'private' : 'repair'}-${i}`,
    name: `Repair Creature ${i}`, printedName: `検証クリーチャー${i}`, lang: 'ja', layout: 'normal', cmc: 0,
    colorIdentity: [], typeLine: 'Creature',
    faces: [{ name: `Repair Creature ${i}`, printedName: `検証クリーチャー${i}`, typeLine: 'Creature', printedTypeLine: 'クリーチャー', manaCost: '{0}', oracleText: '', power: '2', toughness: '2' }],
  },
}));
async function apiProbe() {
  stage = 'real-worker-private-source';
  const address = randomUUID();
  const seat = () => ({ token: randomBytes(32).toString('hex'), connectionId: randomUUID() });
  const p1 = seat(), p2 = seat();
  const call = async (actor, body) => {
    const response = await fetch(`${origin}/api/cockpit/${address}`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ ...body, ...actor }),
    });
    stage = `real-worker-${body.type}-${body.operation?.type ?? body.control?.type ?? 'state'}`;
    assert.equal(response.status, 200, `Local Worker status ${response.status}`);
    return response.json();
  };
  const first = await call(p1, { type: 'create', deck: deck(), seats: 2, seed: 1 });
  const second = await call(p2, { type: 'join', deck: deck(true), invitation: first.multiplayer.invitation });
  const change = async (actor, type, operation) => {
    const view = await call(actor, { type: 'read' });
    return call(actor, { type, [type === 'control' ? 'control' : 'operation']: operation, requestId: randomUUID(), revision: view.revision });
  };
  await change(p1, 'commit', { type: 'keep', seatId: 'P1', bottom: [] });
  await change(p2, 'commit', { type: 'keep', seatId: 'P2', bottom: [] });
  await change(p1, 'control', { type: 'start' });
  await change(p2, 'control', { type: 'hold', held: true });
  await change(p1, 'control', { type: 'grant', seatId: 'P2' });
  const sourceId = second.table.seats[1].zones.hand[0];
  const secretDef = second.table.cards[sourceId].defId;
  await change(p2, 'commit', { type: 'move', ids: [sourceId], to: 'battlefield', position: 'top' });
  await change(p2, 'commit', { type: 'face', cardId: sourceId, faceIndex: 0, faceDown: true });
  await change(p2, 'commit', {
    type: 'activate', id: randomUUID(), sourceId, choice: 'manual', text: 'Draw a card.', targets: ['P2'],
    manualCosts: { manaCost: '', life: 0, tapIds: [], sacrificeIds: [], discardIds: [], returnIds: [], exileIds: [], counters: [], note: 'Public granted ability' },
    paymentPlan: [{ type: 'payMana', payment: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }, playerId: 'P2' }],
  });
  for (const operation of [null, { type: 'resolve.begin' }, { type: 'move', ids: [sourceId], to: 'hand', position: 'top' }]) {
    if (operation) await change(p2, 'commit', operation);
    const other = await call(p1, { type: 'read' });
    assert.equal(Boolean(other.table.defs[secretDef]), false, 'Private definition was delivered');
    assert.equal(other.table.stack[0].source.defId, 'cockpit-hidden');
    assert.equal(other.table.stack[0].text, 'Draw a card.');
  }
  await change(p2, 'commit', { type: 'resolve.end', to: 'graveyard' });
  assert.equal((await call(p1, { type: 'read' })).table.stack.length, 0);
  record('real Worker/SQLite: hidden source protected through activation, resolution, and source movement');
}
try {
  if (!process.argv.includes('--recovery-only')) await apiProbe();
  else report.privateSourceProbe = 'not-run: separate local-only repair';
  if (!process.argv.includes('--api-only')) {
    const module = process.env.COCKPIT_PLAYWRIGHT_MODULE;
    const { chromium } = await import(module ? pathToFileURL(module).href : 'playwright');
    browser = await chromium.launch({ headless: true });
    let pageErrors = 0, unexpectedConsoleErrors = 0, expectedNetworkFailure = false;
    for (let i = 0; i < 2; i++) {
      stage = `entry-fixture-${i + 1}`;
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.on('pageerror', () => pageErrors++);
      page.on('console', (message) => {
        if (message.type() === 'error' && !(expectedNetworkFailure && message.text().startsWith('Failed to load resource:'))) unexpectedConsoleErrors++;
      });
      page.on('response', (response) => {
        if (!new URL(response.url()).pathname.startsWith('/api/cockpit/')) return;
        const type = response.request().postDataJSON()?.type;
        if (['create', 'join', 'commit', 'control', 'connect', 'read'].includes(type)) transport.push({ seat: i + 1, type, status: response.status() });
      });
      page.setDefaultTimeout(15000);
      pages.push(page);
      await page.goto(origin);
      await page.evaluate(async (rows) => {
        const { saveResolvedDeck } = await import('/src/data/savedDecks.ts');
        await saveResolvedDeck({ deckText: 'Stage 1 local acceptance fixture', entries: rows.map((row) => ({ quantity: 1, section: 'main', card: row.def })) });
      }, deck());
      await page.reload();
      await page.getByTestId('play-choice').waitFor();
    }
    const [host, guest] = pages;
    const menu = async (page) => {
      if (!(await page.getByRole('dialog', { name: 'メニュー・保存' }).isVisible())) {
        const opening = page.getByRole('button', { name: '招待・メニュー', exact: true });
        await ((await opening.isVisible()) ? opening : page.getByRole('button', { name: 'メニュー', exact: true })).click();
      }
      return page.getByRole('dialog', { name: 'メニュー・保存' });
    };
    const closeMenu = async (page) => (await menu(page)).getByRole('button', { name: '閉じる', exact: true }).click();
    const read = async (page) => page.evaluate(async () => {
      const c = JSON.parse(localStorage.getItem('mtg-onedeck:cockpit-connection-v1'));
      const r = await fetch(`/api/cockpit/${c.id}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'read', token: c.token, connectionId: c.connectionId }),
      });
      if (!r.ok) throw new Error('State read failed');
      return r.json();
    });
    const hand = async (page) => {
      const v = await read(page);
      return v.table.seats.find((s) => s.id === v.multiplayer.ownSeatId).zones.hand.length;
    };
    const draw = async (page) => {
      await page.evaluate(() => document.activeElement?.blur());
      await page.keyboard.press('d');
    };
    const waitUntil = async (predicate, label) => {
      for (let i = 0; i < 100; i++) {
        if (await predicate()) return;
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error(label);
    };
    const responseFor = (page, operation) => page.waitForResponse((response) => {
      if (!new URL(response.url()).pathname.startsWith('/api/cockpit/')) return false;
      const body = response.request().postDataJSON();
      return body?.type === 'commit' && body.operation?.type === operation;
    });
    stage = 'entry-host-create';
    await host.getByRole('button', { name: '2人対戦を作成', exact: true }).click();
    stage = 'entry-host-table';
    await host.getByTestId('game-screen').waitFor();
    stage = 'entry-host-menu';
    await menu(host);
    stage = 'entry-read-invitation';
    const invitation = await host.getByLabel('招待コード', { exact: true }).inputValue();
    stage = 'entry-close-menu';
    await closeMenu(host);
    stage = 'entry-guest-join';
    await guest.getByLabel('参加する招待コード').fill(invitation);
    await guest.getByRole('button', { name: 'このデッキで参加', exact: true }).click();
    // Joining/another seat's keep can change the revision. Confirm success, or
    // explicitly read the rejection and retry via the visible button; never replay unknown results.
    for (const [i, page] of pages.entries()) {
      stage = `entry-keep-${i + 1}`;
      expectedNetworkFailure = true;
      const result = responseFor(page, 'keep');
      await page.getByTestId('mulligan-keep').click();
      let response = await result;
      if (response.status() === 409) {
        assert.equal((await response.json()).error, 'REVISION_CONFLICT');
        await page.locator('.table-connection').getByRole('button', { name: '閉じる', exact: true }).click();
        const retry = responseFor(page, 'keep');
        await page.getByTestId('mulligan-keep').click();
        response = await retry;
        record(`seat ${i + 1}: explicit UI retry after a confirmed revision rejection`);
      }
      assert.equal(response.status(), 200, 'Keep must be accepted before attempting start');
      await page.getByTestId('mulligan-stage').waitFor({ state: 'hidden' });
      expectedNetworkFailure = false;
      const v = await read(page);
      assert.equal(v.table.seats.find((s) => s.id === v.multiplayer.ownSeatId).kept, true);
    }
    stage = 'entry-start-menu';
    await menu(host);
    stage = 'entry-start-game';
    await host.getByRole('button', { name: '全員で対戦を開始', exact: true }).click();
    stage = 'entry-close-start-menu';
    await closeMenu(host);
    await waitUntil(async () => (await read(host)).multiplayer.started, 'Started state');
    record('two independent browsers: saved deck selection, create/join, confirmed keeps, start');

    stage = 'rejection-then-valid-action';
    let fault = 'reject', sentDraws = 0;
    await host.route('**/api/cockpit/*', async (route) => {
      const body = route.request().postDataJSON();
      if (body.type === 'commit' && body.operation?.type === 'draw') {
        sentDraws++;
        if (fault === 'reject') {
          fault = null;
          await route.continue({ postData: JSON.stringify({ ...body, operation: { ...body.operation, count: 500 } }) });
          return;
        }
        if (fault === 'lost') {
          fault = null;
          await route.fetch();
          await route.abort();
          return;
        }
      }
      if (body.type === 'read' && fault === 'poll') {
        fault = null;
        await route.abort();
        return;
      }
      await route.continue();
    });
    const before = await hand(host);
    expectedNetworkFailure = true;
    await draw(host);
    await host.locator('.table-connection').waitFor();
    assert.equal(await host.locator('.table-connection').getByRole('button', { name: '再接続', exact: true }).count(), 0);
    assert.equal(await hand(host), before);
    await host.locator('.table-connection').getByRole('button', { name: '閉じる', exact: true }).click();
    expectedNetworkFailure = false;
    await draw(host);
    await waitUntil(async () => (await hand(host)) === before + 1, 'valid action after rejection');
    record('actual 422 rejection leaves board unchanged; next normal keyboard draw succeeds without reconnect');

    stage = 'poll-recovery';
    expectedNetworkFailure = true;
    fault = 'poll';
    await host.locator('.table-connection').waitFor();
    await host.locator('.table-connection').waitFor({ state: 'hidden' });
    expectedNetworkFailure = false;
    await draw(host);
    await waitUntil(async () => (await hand(host)) === before + 2, 'draw after automatic read recovery');
    record('read-only transport loss automatically recovers and restores normal UI operations');

    stage = 'accepted-draw-response-lost';
    expectedNetworkFailure = true;
    fault = 'lost';
    const count = sentDraws;
    await draw(host);
    await host.locator('.table-connection').getByRole('button', { name: '再接続', exact: true }).click();
    await host.locator('.table-connection').waitFor({ state: 'hidden' });
    expectedNetworkFailure = false;
    assert.equal(await hand(host), before + 3);
    assert.equal(sentDraws, count + 1);
    record('real saved draw with lost response: receipt reconciliation, no replay and one-card delta');

    stage = 'ordinary-cast-resolve';
    await host.getByRole('button', { name: '唱える', exact: true }).first().click();
    await host.getByRole('button', { name: '支払って唱える', exact: true }).click();
    await host.getByRole('button', { name: '解決', exact: true }).click();
    await waitUntil(async () => (await read(host)).table.stack.length === 0, 'resolution');
    record('after recovery, ordinary UI casts and resolves a permanent; shared stack completes');

    stage = 'rejected-destination-preserves-old-seat';
    const original = await host.evaluate(() => JSON.parse(localStorage.getItem('mtg-onedeck:cockpit-connection-v1')).id);
    const originalBoard = (await read(host)).table;
    await (await menu(host)).getByRole('button', { name: 'デッキ選択へ戻る', exact: true }).click();
    await host.getByLabel('参加する招待コード').fill(invitation);
    expectedNetworkFailure = true;
    await host.getByRole('button', { name: 'このデッキで参加', exact: true }).click();
    await host.getByRole('button', { name: '再接続', exact: true }).waitFor();
    const retained = await host.evaluate(() => JSON.parse(localStorage.getItem('mtg-onedeck:cockpit-connection-v1')).id);
    assert.equal(retained === original, true, 'Previous destination must remain recoverable');
    await host.reload();
    await host.getByTestId('game-screen').waitFor();
    expectedNetworkFailure = false;
    assert.deepEqual((await read(host)).table, originalBoard);
    record('failed join to a started room, screen disposal and reload restore original seat and exact board');

    stage = 'viewports-and-console';
    for (const [width, height] of [[375, 812], [812, 375], [1440, 900]]) {
      await host.setViewportSize({ width, height });
      await host.getByTestId('game-screen').waitFor();
      await host.screenshot({ path: `${output}/stage1-${width}x${height}.png` });
    }
    assert.equal(pageErrors, 0);
    assert.equal(unexpectedConsoleErrors, 0);
    record('three viewports, zero page exceptions and zero unexpected console errors; injected network errors excluded explicitly');
  }
  report.passed = true;
} catch (error) {
  report.failureCategory = error?.name ?? 'Error';
  report.passed = false;
  report.failedStage = stage;
  report.transport = transport;
  // Fixed boolean probes only: never write input values, response bodies, URLs or call logs.
  report.surfaces = await Promise.all(pages.map(async (page) => ({
    gameScreen: await page.getByTestId('game-screen').isVisible().catch(() => false),
    playChoice: await page.getByTestId('play-choice').isVisible().catch(() => false),
    opening: await page.getByTestId('mulligan-stage').isVisible().catch(() => false),
    keepEnabled: await page.getByTestId('mulligan-keep').isEnabled({ timeout: 500 }).catch(() => false),
    menu: await page.getByRole('dialog', { name: 'メニュー・保存' }).isVisible().catch(() => false),
  })));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await writeFile(`${output}/stage1-report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
