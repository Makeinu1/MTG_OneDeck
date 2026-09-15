#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import {
  launchO4p06fCdpBrowserV1,
  type O4p06fPageV1,
} from './o4p-06f-four-browser-evidence';

const origin = process.env.R4_UI_EVIDENCE_ORIGIN ?? 'http://127.0.0.1:5173';
const output = process.env.R4_UI_EVIDENCE_OUTPUT ?? '/tmp/r4-ui-browser-evidence.json';
const timeoutMs = 20_000;

async function waitFor<T>(page: O4p06fPageV1, expression: string, label: string): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await page.evaluate<T | null>(expression);
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

const browser = await launchO4p06fCdpBrowserV1(timeoutMs);
const context = await browser.createBrowserContext();
const page = await context.createPage();
try {
  await page.setViewport?.({ width: 1440, height: 1000 });
  const navigate = page.navigateForUiEvidence ?? page.navigate;
  await navigate(`${origin}/r4-ui-evidence.html`);
  const ids = await waitFor<{
    landId: string;
    costId: string;
    graveId: string;
    faceDownId: string;
  }>(
    page,
    `(() => window.__r4EvidenceReady ? window.__r4EvidenceIds : null)()`,
    'evidence harness readiness',
  );

  const click = async (expression: string, label: string) => {
    const clicked = await page.evaluate<boolean>(expression);
    if (!clicked) throw new Error(`Could not click ${label}`);
  };

  await waitFor<boolean>(
    page,
    `(() => Boolean(document.querySelector('[data-layout-card-id="${ids.landId}"] .table-card__quick')))()`,
    'formal land quick action',
  );
  await click(
    `(() => { const node=document.querySelector('[data-layout-card-id="${ids.landId}"] .table-card__quick'); if(!(node instanceof HTMLElement)) return false; node.click(); return true; })()`,
    'formal playLand quick action',
  );
  await waitFor<boolean>(
    page,
    `(() => window.__r4EvidenceOperations?.some((op) => op.type === 'playLand') || null)()`,
    'playLand commit',
  );

  await waitFor<boolean>(
    page,
    `(() => Boolean(document.querySelector('[data-layout-card-id="${ids.costId}"] .card-view')))()`,
    'additional-cost hand card',
  );
  await click(
    `(() => { const node=document.querySelector('[data-layout-card-id="${ids.costId}"] .card-view'); if(!(node instanceof HTMLElement)) return false; node.click(); return true; })()`,
    'additional-cost hand selection',
  );
  await click(
    `(() => { const node=[...document.querySelectorAll('button')].find((b) => (b.textContent||'').trim().startsWith('墓地')); if(!(node instanceof HTMLElement)) return false; node.click(); return true; })()`,
    'graveyard browser',
  );
  await waitFor<boolean>(
    page,
    `(() => Boolean(document.querySelector('[data-card-id="${ids.graveId}"]')))()`,
    'graveyard card visibility',
  );
  const opened = await page.evaluate<boolean>(
    `(() => { const root=document.querySelector('[data-card-id="${ids.graveId}"]'); const node=root?.querySelector('[role="button"]'); if(!(node instanceof HTMLElement)) return false; node.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); return true; })()`,
  );
  if (!opened) throw new Error('Could not inspect graveyard spell');
  await waitFor<boolean>(
    page,
    `(() => [...document.querySelectorAll('button')].some((b) => (b.textContent||'').includes('支払いを確認して唱える')) || null)()`,
    'unusual-zone cast action',
  );
  await click(
    `(() => { const node=[...document.querySelectorAll('button')].find((b) => (b.textContent||'').includes('支払いを確認して唱える')); if(!(node instanceof HTMLElement)) return false; node.click(); return true; })()`,
    'unusual-zone cast draft',
  );
  await waitFor<boolean>(
    page,
    `(() => document.body.textContent?.includes('マナ以外の追加コスト') || null)()`,
    'additional-cost editor',
  );
  await click(
    `(() => { const label=[...document.querySelectorAll('label')].find((n) => (n.textContent||'').trim() === '捨てる'); const input=label?.querySelector('input'); if(!(input instanceof HTMLInputElement)) return false; input.click(); return true; })()`,
    'atomic discard additional cost',
  );
  await click(
    `(() => { const node=[...document.querySelectorAll('button')].find((b) => (b.textContent||'').includes('支払って唱える')); if(!(node instanceof HTMLElement)) return false; node.click(); return true; })()`,
    'formal cast confirmation',
  );
  await waitFor<boolean>(
    page,
    `(() => window.__r4EvidenceOperations?.some((op) => op.type === 'cast' && op.sourceZone === 'graveyard') || null)()`,
    'unusual-zone cast commit',
  );

  const faceOpened = await page.evaluate<boolean>(
    `(() => { const node=document.querySelector('[data-layout-card-id="${ids.faceDownId}"] .card-view'); if(!(node instanceof HTMLElement)) return false; node.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); return true; })()`,
  );
  if (!faceOpened) throw new Error('Could not inspect face-down permanent');
  await waitFor<boolean>(
    page,
    `(() => [...document.querySelectorAll('button')].some((b) => (b.textContent||'').trim() === '表向きにする') || null)()`,
    'face-up special action',
  );
  await click(
    `(() => { const node=[...document.querySelectorAll('button')].find((b) => (b.textContent||'').trim() === '表向きにする'); if(!(node instanceof HTMLElement)) return false; node.click(); return true; })()`,
    'special.turnFaceUp',
  );
  await waitFor<boolean>(
    page,
    `(() => window.__r4EvidenceOperations?.some((op) => op.type === 'special.turnFaceUp') || null)()`,
    'special action commit',
  );

  const state = await page.evaluate<{
    operations: Array<Record<string, unknown>>;
    table: any;
  }>(`(() => ({ operations: window.__r4EvidenceOperations, table: window.__r4EvidenceTable }))()`);
  const operations = state.operations;
  const land = operations.find((op) => op.type === 'playLand');
  const cast = operations.find((op) => op.type === 'cast' && op.sourceZone === 'graveyard') as
    | (Record<string, any> & { additionalCosts?: { discardIds?: string[] } })
    | undefined;
  const special = operations.find((op) => op.type === 'special.turnFaceUp');
  if (!land || land.cardId !== ids.landId) throw new Error('playLand evidence mismatch');
  if (!cast || cast.cardId !== ids.graveId || !cast.additionalCosts?.discardIds?.includes(ids.costId))
    throw new Error('unusual-zone cast/additional-cost evidence mismatch');
  if (!special || special.cardId !== ids.faceDownId) throw new Error('special action evidence mismatch');
  if (state.table.cards[ids.landId]?.zone !== 'battlefield')
    throw new Error('land did not reach battlefield');
  if (state.table.cards[ids.graveId]?.zone !== 'stack')
    throw new Error('graveyard spell did not reach stack');
  if (state.table.cards[ids.costId]?.zone !== 'graveyard')
    throw new Error('discard cost was not atomic with cast');
  if (state.table.cards[ids.faceDownId]?.faceDown !== false)
    throw new Error('face-down permanent did not turn face up');
  const consoleCounts = page.consoleCounts();
  if (consoleCounts.errors !== 0 || consoleCounts.warnings !== 0)
    throw new Error(
      `browser console errors/warnings: ${consoleCounts.errors}/${consoleCounts.warnings}`,
    );
  const summary = {
    kind: 'r4-ui-browser-evidence-v1',
    chromeVersion: browser.chromeVersion,
    operations: operations.map((op) => ({
      type: op.type,
      ...(typeof op.sourceZone === 'string' ? { sourceZone: op.sourceZone } : {}),
    })),
    playLand: { cardId: ids.landId, zone: state.table.cards[ids.landId].zone },
    unusualZoneCast: {
      cardId: ids.graveId,
      sourceZone: cast.sourceZone,
      zone: state.table.cards[ids.graveId].zone,
      discardedCostCard: ids.costId,
      costCardZone: state.table.cards[ids.costId].zone,
    },
    specialAction: {
      cardId: ids.faceDownId,
      faceDown: state.table.cards[ids.faceDownId].faceDown,
    },
    console: consoleCounts,
  };
  writeFileSync(output, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
} finally {
  await page.close().catch(() => undefined);
  await context.close().catch(() => undefined);
  await browser.close().catch(() => undefined);
}
