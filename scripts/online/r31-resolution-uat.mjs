/** Minimal local-only R3.1 browser UAT. Never targets production. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const origin = process.env.COCKPIT_URL ?? 'http://127.0.0.1:5173';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname));
const output = process.env.COCKPIT_EVIDENCE_DIR ?? '/tmp/cockpit-r31-evidence';
await mkdir(output, { recursive: true });
const report = {
  stage: 'r3.1-resolution-uat',
  sourceSha: process.env.COCKPIT_SOURCE_SHA ?? null,
  checks: [],
  passed: false,
};
const record = (name) => report.checks.push({ name, passed: true });
const deck = () =>
  Array.from({ length: 40 }, (_, i) => ({
    isCommander: false,
    def: {
      scryfallId: `r31-manual-${i}`,
      oracleId: `r31-manual-${i}`,
      name: `R31 Manual Probe ${i}`,
      printedName: 'R3手動解決',
      lang: 'ja',
      layout: 'normal',
      cmc: 0,
      colorIdentity: [],
      typeLine: 'Instant',
      faces: [
        {
          name: `R31 Manual Probe ${i}`,
          printedName: 'R3手動解決',
          typeLine: 'Instant',
          printedTypeLine: 'インスタント',
          manaCost: '{0}',
          oracleText: 'Draw a card.',
        },
      ],
    },
  }));

let browser;
const pages = [];
let stage = 'initialization';
try {
  const module = process.env.COCKPIT_PLAYWRIGHT_MODULE;
  const { chromium } = await import(module ? pathToFileURL(module).href : 'playwright');
  browser = await chromium.launch({ headless: true });
  let pageErrors = 0;
  let consoleErrors = 0;
  const consoleErrorMessages = [];

  for (let i = 0; i < 2; i++) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', (error) => {
      pageErrors++;
      if (consoleErrorMessages.length < 50) consoleErrorMessages.push(`pageerror: ${error.message}`);
    });
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors++;
        if (consoleErrorMessages.length < 50) consoleErrorMessages.push(message.text());
      }
    });
    pages.push(page);
    await page.route('https://api.scryfall.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ object: 'list', has_more: false, data: [] }),
      });
    });
    await page.goto(origin);
    await page.evaluate(async (rows) => {
      const { saveResolvedDeck } = await import('/src/data/savedDecks.ts');
      await saveResolvedDeck({
        deckText: 'R3.1 local Manual Resolution UAT',
        entries: rows.map((row) => ({ quantity: 1, section: 'main', card: row.def })),
      });
    }, deck());
    await page.reload();
    await page.getByTestId('play-choice').waitFor();
  }

  const [host, guest] = pages;
  const menu = async (page) => {
    if (!(await page.getByRole('dialog', { name: 'メニュー・保存' }).isVisible())) {
      const opening = page.getByRole('button', { name: '招待・メニュー', exact: true });
      await ((await opening.isVisible())
        ? opening
        : page.getByRole('button', { name: 'メニュー', exact: true })).click();
    }
    return page.getByRole('dialog', { name: 'メニュー・保存' });
  };
  const closeMenu = async (page) =>
    (await menu(page)).getByRole('button', { name: '閉じる', exact: true }).click();
  const read = async (page) =>
    page.evaluate(async () => {
      const c = JSON.parse(localStorage.getItem('mtg-onedeck:cockpit-connection-v1'));
      const r = await fetch(`/api/cockpit/${c.id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'read',
          token: c.token,
          connectionId: c.connectionId,
        }),
      });
      if (!r.ok) throw new Error('State read failed');
      return r.json();
    });
  const waitUntil = async (predicate, label) => {
    for (let i = 0; i < 120; i++) {
      if (await predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(label);
  };
  const responseFor = (page, operation) =>
    page.waitForResponse((response) => {
      if (!new URL(response.url()).pathname.startsWith('/api/cockpit/')) return false;
      const body = response.request().postDataJSON();
      return body?.type === 'commit' && body.operation?.type === operation;
    });
  const multiplayerPrimary = (page) => page.locator('.restored-resolve');

  stage = 'create-and-join';
  await host.getByRole('button', { name: '2人対戦を作成', exact: true }).click();
  await host.getByTestId('game-screen').waitFor();
  await menu(host);
  const invitation = await host.getByLabel('招待コード', { exact: true }).inputValue();
  await closeMenu(host);
  await guest.getByLabel('参加する招待コード').fill(invitation);
  await guest.getByRole('button', { name: 'このデッキで参加', exact: true }).click();

  for (const page of pages) {
    stage = 'keep-sync';
    await page.reload();
    await page.getByTestId('game-screen').waitFor();
    await page.getByTestId('mulligan-stage').waitFor();
    stage = 'keep';
    const responsePromise = responseFor(page, 'keep');
    await page.getByTestId('mulligan-keep').click();
    const response = await responsePromise;
    assert.equal(response.status(), 200);
    await page.getByTestId('mulligan-stage').waitFor({ state: 'hidden' });
  }
  stage = 'start-sync';
  await host.reload();
  await host.getByTestId('game-screen').waitFor();
  await menu(host);
  await host.getByRole('button', { name: '全員で対戦を開始', exact: true }).click();
  await closeMenu(host);
  await waitUntil(async () => (await read(host)).multiplayer.started, 'game start');

  const castOne = async () => {
    const view = await read(host);
    const own = view.table.seats.find((seat) => seat.id === view.multiplayer.ownSeatId);
    const id = own.zones.hand[0];
    await host.getByTestId(`card-${id}`).click({ button: 'right' });
    await host.getByRole('menuitem', { name: '唱える', exact: true }).click();
    const responsePromise = responseFor(host, 'cast');
    await host.getByRole('button', { name: '支払って唱える', exact: true }).click();
    assert.equal((await responsePromise).status(), 200);
    await host.getByRole('button', { name: '支払って唱える', exact: true }).waitFor({ state: 'hidden' });
    await waitUntil(async () => (await read(host)).table.stack.some((entry) => entry.source.id === id), 'cast');
    return (await read(host)).table.stack[0].id;
  };

  stage = 'response-stack';
  const a = await castOne();
  const b = await castOne();
  let state = await read(host);
  assert.deepEqual(state.table.stack.map((entry) => entry.id), [b, a]);
  record('two spells form a response stack in canonical B/A order');

  stage = 'manual-resolution-begin';
  await multiplayerPrimary(host).waitFor();
  assert.match((await multiplayerPrimary(host).textContent()) ?? '', /解決/);
  const beginResponse = responseFor(host, 'resolve.begin');
  await multiplayerPrimary(host).click();
  assert.equal((await beginResponse).status(), 200);
  await waitUntil(async () => (await read(host)).table.resolution?.id === b, 'Resolution B start');
  await host.getByLabel('《R3手動解決》の処理').waitFor();
  record('Stack top B enters Manual Resolution with an entry-bound canonical resolution');

  stage = 'fold-and-return';
  await host.getByRole('button', { name: '作業面を閉じる', exact: true }).click();
  assert.equal((await read(host)).table.resolution?.id, b);
  assert.match((await multiplayerPrimary(host).textContent()) ?? '', /処理に戻る/);
  await multiplayerPrimary(host).click();
  await host.getByLabel('《R3手動解決》の処理').waitFor();
  assert.equal((await read(host)).table.resolution?.id, b);
  record('folding/browsing presentation does not end B; primary action returns to the same resolution');

  stage = 'reconnect-during-resolution';
  await host.reload();
  await host.getByTestId('game-screen').waitFor();
  await waitUntil(async () => (await read(host)).table.resolution?.id === b, 'reconnect Resolution B');
  await multiplayerPrimary(host).waitFor();
  assert.match((await multiplayerPrimary(host).textContent()) ?? '', /処理に戻る/);
  await multiplayerPrimary(host).click();
  await host.getByLabel('《R3手動解決》の処理').waitFor();
  record('reload reconstructs the same Manual Resolution B from canonical state');

  stage = 'finish-b-no-auto-chain';
  await host.locator('.table-progress__source').click();
  const finishResponse = responseFor(host, 'resolve.end');
  await host.getByRole('button', { name: '処理完了', exact: true }).click();
  assert.equal((await finishResponse).status(), 200);
  await waitUntil(async () => {
    const view = await read(host);
    return view.table.resolution === null && view.table.stack.length === 1 && view.table.stack[0].id === a;
  }, 'B finish / A response');
  state = await read(host);
  assert.equal(state.table.resolution, null);
  assert.equal(state.table.stack[0].id, a);
  assert.match((await multiplayerPrimary(host).textContent()) ?? '', /解決/);
  record('finishing B returns to StackResponse A and never auto-starts A');

  report.pageErrors = pageErrors;
  report.consoleErrors = consoleErrors;
  report.consoleErrorMessages = consoleErrorMessages;
  assert.equal(pageErrors, 0);
  assert.equal(consoleErrors, 0);
  report.passed = true;
} catch (error) {
  report.failedStage = stage;
  report.failureCategory = error?.name ?? 'Error';
  report.failureMessage = String(error?.message ?? error).slice(0, 300);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await writeFile(`${output}/r31-resolution-uat.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
