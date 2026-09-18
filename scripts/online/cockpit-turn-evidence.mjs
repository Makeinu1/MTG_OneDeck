/** Normal UI turn/cleanup acceptance against local HTTP workerd + SQLite. No secret values are logged. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const origin = process.env.COCKPIT_URL ?? 'http://127.0.0.1:5173';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
const output = process.env.COCKPIT_EVIDENCE_DIR ?? '/tmp/cockpit-turn-evidence';
const { chromium } = await import(
  process.env.COCKPIT_PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.COCKPIT_PLAYWRIGHT_MODULE).href
    : 'playwright'
);
const browser = await chromium.launch({
  headless: true,
  ...(process.env.COCKPIT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.COCKPIT_CHROMIUM_EXECUTABLE }
    : {}),
});
const report = {
  sourceSha: process.env.COCKPIT_SOURCE_SHA ?? 'local-uncommitted',
  normalUi: true,
  fullMatch: false,
  checks: [],
};
let stage = 'setup',
  pageErrors = 0,
  unexpectedConsole = 0;
const records = new Map();
const rows = Array.from({ length: 40 }, (_, i) => ({
  quantity: 1,
  section: 'main',
  card: {
    scryfallId: `turn-proof-${i}`,
    oracleId: `turn-proof-${i}`,
    name: `Turn Creature ${i}`,
    printedName: `進行検証${i}`,
    lang: 'ja',
    layout: 'normal',
    cmc: 0,
    colorIdentity: [],
    typeLine: 'Creature',
    faces: [
      {
        name: `Turn Creature ${i}`,
        printedName: `進行検証${i}`,
        typeLine: 'Creature',
        manaCost: '{0}',
        oracleText: '',
        power: '2',
        toughness: '2',
      },
    ],
  },
}));
const contexts = [];
async function page() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  contexts.push(context);
  const p = await context.newPage();
  p.setDefaultTimeout(12000);
  p.on('pageerror', () => pageErrors++);
  p.on('console', (m) => {
    if (
      m.type() === 'error' &&
      !(m.text().startsWith('Failed to load resource:') && m.text().includes('409'))
    )
      unexpectedConsole++;
  });
  p.on('response', async (r) => {
    if (!r.url().includes('/api/cockpit/') || r.request().method() !== 'POST') return;
    try {
      const v = await r.json();
      records.set(p, { status: r.status(), value: v });
    } catch {
      /* No response-body/credential logging. */
    }
  });
  await p.goto(origin);
  await p.evaluate(async (entries) => {
    const { saveResolvedDeck } = await import('/src/data/savedDecks.ts');
    await saveResolvedDeck({ deckText: 'Local turn acceptance', entries });
  }, rows);
  await p.reload();
  await p.getByTestId('play-choice').waitFor();
  return p;
}
async function read(p) {
  return p.evaluate(async () => {
    const c = JSON.parse(localStorage.getItem('mtg-onedeck:cockpit-connection-v1'));
    const r = await fetch(`/api/cockpit/${c.id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'read', token: c.token, connectionId: c.connectionId }),
    });
    if (!r.ok) throw Error('read failed');
    return r.json();
  });
}
async function until(fn, label) {
  for (let i = 0; i < 100; i++) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error(label);
}
async function menu(p) {
  const m = p.getByRole('dialog', { name: 'メニュー・保存' });
  if (!(await m.isVisible())) {
    const b = p.getByRole('button', { name: '招待・メニュー', exact: true });
    await (
      (await b.isVisible()) ? b : p.getByRole('button', { name: 'メニュー', exact: true })
    ).click();
  }
  return m;
}
async function closeMenu(p) {
  await (await menu(p)).getByRole('button', { name: '閉じる', exact: true }).click();
}
async function keep(p) {
  for (let tries = 0; tries < 3; tries++) {
    await p.getByTestId('mulligan-keep').click();
    await until(async () => {
      const v = await read(p);
      return (
        v.table.seats.find((s) => s.id === (v.multiplayer?.ownSeatId ?? 'P1')).kept ||
        (await p.locator('.table-connection').isVisible())
      );
    }, 'keep receipt');
    const v = await read(p);
    if (v.table.seats.find((s) => s.id === (v.multiplayer?.ownSeatId ?? 'P1')).kept) return;
    const alert = p.locator('.table-connection');
    assert.ok((await alert.innerText()).includes('別の操作が先に確定'));
    await alert.getByRole('button', { name: '閉じる', exact: true }).click();
  }
  throw Error('keep failed');
}
async function mutate(p, perform, label, attempt = 0) {
  assert.ok(attempt < 3, `bounded retry: ${label}`);
  const wait = p.waitForResponse(
    (r) =>
      r.url().includes('/api/cockpit/') &&
      r.request().method() === 'POST' &&
      ['commit', 'control'].includes(r.request().postDataJSON()?.type),
  );
  await perform();
  const r = await wait;
  const v = await r.json();
  if (r.status() !== 200) {
    assert.equal(v.error, 'REVISION_CONFLICT', label);
    const alert = p.locator('.table-connection');
    await alert.waitFor({ state: 'visible' });
    await alert.getByRole('button', { name: '閉じる', exact: true }).click();
    return mutate(p, perform, label, attempt + 1);
  }
  return v;
}
async function next(p, key = false) {
  const before = await read(p);
  await mutate(
    p,
    async () => {
      if (key) {
        await p.evaluate(() => document.activeElement?.blur());
        await p.keyboard.press('ArrowUp');
      } else await p.locator('.table-progress__next').click();
    },
    'normal phase',
  );
  await until(async () => {
    const v = await read(p);
    return v.revision > before.revision;
  }, 'phase persisted');
  return read(p);
}
async function closeWork(p) {
  const panel = p.locator('.table-work-panel').filter({ visible: true });
  for (let i = 0; i < (await panel.count()); i++) {
    const b = panel
      .nth(i)
      .getByRole('button', { name: /作業面を閉じる|閉じる|作業面をたたむ/, exact: false });
    if (await b.count()) await b.first().click();
  }
}
try {
  const host = await page(),
    guest = await page();
  stage = 'two-seat-start';
  await host.getByRole('button', { name: '2人対戦を作成', exact: true }).click();
  await host.getByTestId('game-screen').waitFor();
  const invitation = await (await menu(host))
    .getByLabel('招待コード', { exact: true })
    .inputValue();
  await closeMenu(host);
  await guest.getByLabel('参加する招待コード').fill(invitation);
  await guest.getByRole('button', { name: 'このデッキで参加', exact: true }).click();
  await guest.getByTestId('game-screen').waitFor();
  await keep(host);
  await keep(guest);
  await menu(host);
  await mutate(
    host,
    () => host.getByRole('button', { name: '全員で対戦を開始', exact: true }).click(),
    'start',
  );
  await closeMenu(host);
  report.checks.push({ name: 'normal create/join/keep/start', passed: true });
  stage = 'first-player-draw-skip';
  const h = (await read(host)).table.seats[0].zones.hand.length;
  await next(host);
  let state = await next(host, true);
  assert.equal(state.table.phase, 'main1');
  assert.equal(state.table.seats[0].zones.hand.length, h);
  report.checks.push({
    name: 'two-player first draw skipped through normal buttons and key',
    passed: true,
  });
  stage = 'cast-tap-and-turn-cycle';
  await host.locator('.hand-ribbon [data-layout-card-id]').first().click({ button: 'right' });
  await host.getByRole('menuitem', { name: '唱える', exact: true }).click();
  await mutate(
    host,
    () => host.getByRole('button', { name: '支払って唱える', exact: true }).click(),
    'cast',
  );
  stage = 'cast-settle';
  await host.getByRole('button', { name: '支払って唱える', exact: true }).waitFor({ state: 'hidden' });
  await until(async () => (await read(host)).table.stack.length > 0, 'cast persisted');
  stage = 'resolve-permanent';
  await mutate(
    host,
    () => host.getByRole('button', { name: '解決', exact: true }).click(),
    'resolve',
  );
  await until(async () => {
    const view = await read(host);
    return (
      view.table.resolution === null &&
      view.table.stack.length === 0 &&
      Object.values(view.table.cards).some((card) => card.zone === 'battlefield')
    );
  }, 'resolution settled');
  state = await read(host);
  const permanent = Object.values(state.table.cards).find((c) => c.zone === 'battlefield');
  assert.ok(permanent);
  const permanentDef = state.table.defs[permanent.defId];
  const permanentName = permanentDef?.printedName ?? permanentDef?.name ?? permanent.id;
  const board = host.locator(`[data-layout-card-id="${permanent.id}"]`).first();
  await mutate(host, () => board.dblclick(), 'tap');
  assert.equal((await read(host)).table.cards[permanent.id].tapped, true);
  // Card tools are intentionally available only during Manual Resolution.
  // Cast a second creature and enter the explicit manual-resolution path so the
  // temporary modifier is created through the current visible UI.
  stage = 'manual-modifier-cast';
  state = await read(host);
  const ownSeat = state.table.seats.find((s) => s.id === state.multiplayer?.ownSeatId);
  const manualCardId = ownSeat?.zones.hand[0];
  assert.ok(manualCardId);
  const manualCard = state.table.cards[manualCardId];
  const manualDef = manualCard && state.table.defs[manualCard.defId];
  const manualName = manualDef?.printedName ?? manualDef?.name ?? manualCardId;
  await host.getByTestId(`card-${manualCardId}`).click({ button: 'right' });
  await host.getByRole('menuitem', { name: '唱える', exact: true }).click();
  await mutate(
    host,
    () => host.getByRole('button', { name: '支払って唱える', exact: true }).click(),
    'manual modifier cast',
  );
  await host
    .getByRole('button', { name: '支払って唱える', exact: true })
    .waitFor({ state: 'hidden' });
  await until(
    async () => (await read(host)).table.stack.some((entry) => entry.source.id === manualCardId),
    'manual modifier cast persisted',
  );

  stage = 'manual-modifier-resolution';
  await host.locator('.table-progress__source').click();
  await mutate(
    host,
    () => host.getByRole('button', { name: '効果を自分で処理する', exact: true }).click(),
    'manual resolution begin',
  );
  await until(
    async () => (await read(host)).table.resolution?.source.id === manualCardId,
    'manual resolution active',
  );
  const resolutionWork = host.getByLabel(`《${manualName}》の処理`, { exact: true });
  await resolutionWork.waitFor();
  await resolutionWork.getByLabel('作業面を閉じる', { exact: true }).click();

  stage = 'temporary-modifier';
  await board.click({ button: 'right' });
  await host.getByRole('menuitem', { name: '詳細・その他の操作', exact: true }).click();
  const details = host.getByLabel(`《${permanentName}》`, { exact: true });
  await details.waitFor();
  await details.locator('summary').filter({ hasText: '状態・修整・取り付け' }).click();
  await details.getByLabel('パワー修整', { exact: true }).fill('3');
  await details.getByLabel('タフネス修整', { exact: true }).fill('3');
  await mutate(
    host,
    () => details.getByRole('button', { name: '修整を追加', exact: true }).click(),
    'modifier',
  );
  await details.getByLabel('作業面を閉じる', { exact: true }).click();

  // Direct mana-pool adjustment is an effect operation and is only legal while
  // Manual Resolution owns the effect context. Seed one green mana here so the
  // ordinary turn journey can still prove phase-boundary mana expiry.
  stage = 'mana-setup';
  await host.getByRole('button', { name: '操作', exact: true }).click();
  const resolutionPanel = host.getByLabel(`《${manualName}》の処理`, { exact: true });
  await resolutionPanel.getByText('マナの調整（Resolution）', { exact: true }).click();
  await mutate(
    host,
    () => resolutionPanel.getByRole('button', { name: 'Gマナを追加', exact: true }).click(),
    'mana during manual resolution',
  );
  assert.equal((await read(host)).table.seats[0].mana.G, 1);
  await resolutionPanel.getByLabel('作業面を閉じる', { exact: true }).click();

  stage = 'manual-modifier-finish';
  await host.locator('.table-progress__source').click();
  await mutate(
    host,
    () => host.getByRole('button', { name: '処理完了', exact: true }).click(),
    'manual resolution end',
  );
  await until(async () => {
    const view = await read(host);
    return (
      view.table.resolution === null &&
      !view.table.stack.some((entry) => entry.source.id === manualCardId)
    );
  }, 'manual resolution finished');
  let totalTurns = 0;
  for (let round = 0; round < 4; round++) {
    stage = `ordinary-turn-${round + 1}`;
    const active = (await read(host)).table.activeSeatId;
    const actor = active === 'P1' ? host : guest;
    if (round > 0) {
      await menu(host);
      await mutate(
        host,
        () => host.getByRole('button', { name: '部屋主が操作権を回収', exact: true }).click(),
        'reclaim',
      );
      await closeMenu(host);
      if (active === 'P2') {
        await menu(guest);
        await mutate(
          guest,
          () => guest.getByRole('button', { name: 'HOLD・応答を要求', exact: true }).click(),
          'hold',
        );
        await closeMenu(guest);
        await menu(host);
        await mutate(
          host,
          () => host.getByRole('button', { name: '操作権を貸す', exact: true }).click(),
          'grant',
        );
        await closeMenu(host);
      }
      await until(
        async () => Boolean((await read(actor)).multiplayer.canOperate),
        'control visible',
      );
      const before = (await read(actor)).table.seats.find((s) => s.id === active).zones.hand.length;
      await next(actor);
      state = await next(actor, true);
      assert.equal(state.table.phase, 'draw');
      assert.equal(state.table.seats.find((s) => s.id === active).zones.hand.length, before + 1);
      // A reload in draw must not repeat the turn-based action.
      await actor.reload();
      await actor.getByTestId('game-screen').waitFor();
      await next(actor);
      assert.equal(
        (await read(actor)).table.seats.find((s) => s.id === active).zones.hand.length,
        before + 1,
      );
      if (active === 'P1')
        assert.equal((await read(actor)).table.cards[permanent.id].tapped, false);
    }
    state = await read(actor);
    while (state.table.phase !== 'cleanup') {
      state = await next(actor, state.table.phase === 'main2');
    }
    assert.equal(state.table.seats[0].mana.G, 0);
    if (round === 0) {
      assert.equal(state.table.modifiers.length, 0);
      assert.equal(state.table.cards[permanent.id].tapped, true);
    }
    if (!state.table.cleanupReady) {
      const turn = state.table.turn;
      await actor.locator('.table-progress__next').click();
      const cleanup = actor.getByRole('dialog', { name: '手札調整・ダメージ・期限の確認' });
      await cleanup.waitFor();
      await actor.evaluate(() => document.activeElement?.blur());
      await actor.keyboard.press('ArrowUp');
      assert.equal((await read(actor)).table.turn, turn);
      const activeSeat = state.table.seats.find((s) => s.id === active);
      const required = activeSeat.zones.hand.length - activeSeat.maximumHandSize;
      for (let i = 0; i < required; i++)
        await cleanup
          .getByRole('checkbox', { name: /捨てる：/ })
          .nth(i)
          .check();
      await mutate(
        actor,
        () => cleanup.getByRole('button', { name: 'クリーンナップを完了', exact: true }).click(),
        'complete cleanup',
      );
      await cleanup.waitFor({ state: 'hidden' });
      assert.equal(
        (await read(actor)).table.seats.find((s) => s.id === active).zones.hand.length,
        7,
      );
    }
    const beforeTurn = (await read(actor)).table.turn;
    state = await next(actor);
    assert.equal(state.table.turn, beforeTurn + 1);
    totalTurns++;
  }
  report.checks.push({
    name: 'two full rounds: untap, one normal draw, cleanup discard, mana/effect expiry, draw-step reload and modal key lock',
    passed: true,
    turns: totalTurns,
  });
  stage = 'visual-and-console';
  await mkdir(output, { recursive: true });
  await host.screenshot({ path: `${output}/turn-desktop.png` });
  assert.equal(pageErrors, 0);
  assert.equal(unexpectedConsole, 0);
  report.pageErrors = pageErrors;
  report.unexpectedConsole = unexpectedConsole;
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.failedStage = stage;
  report.failureCategory = error?.name ?? 'Error';
  report.failureMessage = String(error?.message ?? error).slice(0, 300);
  process.exitCode = 1;
} finally {
  await mkdir(output, { recursive: true });
  await writeFile(`${output}/turn-report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  await browser.close();
}
