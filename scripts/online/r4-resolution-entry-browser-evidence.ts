#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import {
  launchO4p06fCdpBrowserV1,
  type O4p06fPageV1,
} from './o4p-06f-four-browser-evidence';

const origin = process.env.R4_ENTRY_EVIDENCE_ORIGIN ?? 'http://127.0.0.1:5173';
const output =
  process.env.R4_ENTRY_EVIDENCE_OUTPUT ?? '/tmp/r4-resolution-entry-ui-browser-evidence.json';
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
  const url = `${origin}/r4-resolution-entry-evidence.html`;
  if (page.navigateForUiEvidence) await page.navigateForUiEvidence(url);
  else await page.navigate(url);

  const cardId = await waitFor<string>(
    page,
    `(() => window.__r4EntryEvidenceReady ? window.__r4EntryEvidenceCardId : null)()`,
    'resolution entry evidence harness',
  );

  const click = async (expression: string, label: string) => {
    const clicked = await page.evaluate<boolean>(expression);
    if (!clicked) throw new Error(`Could not click ${label}`);
  };
  const clickButton = async (text: string, label = text) =>
    click(
      `(() => { const node=[...document.querySelectorAll('button')].find((b) => (b.textContent||'').trim() === ${JSON.stringify(text)}); if(!(node instanceof HTMLElement)) return false; node.click(); return true; })()`,
      label,
    );

  await waitFor<boolean>(
    page,
    `(() => Boolean(document.querySelector('[data-testid="primary-action"]')))()`,
    'resolution primary action',
  );
  await click(
    `(() => { const node=document.querySelector('[data-testid="primary-action"]'); if(!(node instanceof HTMLElement)) return false; node.click(); return true; })()`,
    'resolution primary action',
  );
  await waitFor<boolean>(
    page,
    `(() => [...document.querySelectorAll('button')].some((b) => (b.textContent||'').trim() === 'スタック 1') || null)()`,
    'stack workspace button',
  );
  await clickButton('スタック 1', 'stack workspace');
  await waitFor<boolean>(
    page,
    `(() => [...document.querySelectorAll('summary')].some((node) => (node.textContent||'').trim() === '戦場に出る状態') || null)()`,
    'PermanentEntrySetup editor',
  );
  await click(
    `(() => { const node=[...document.querySelectorAll('summary')].find((item) => (item.textContent||'').trim() === '戦場に出る状態'); if(!(node instanceof HTMLElement)) return false; node.click(); return true; })()`,
    'expand PermanentEntrySetup editor',
  );
  await waitFor<boolean>(
    page,
    `(() => Boolean(document.querySelector('[data-testid="permanent-entry-setup"] input[type="checkbox"]')))()`,
    'tapped entry checkbox',
  );
  await click(
    `(() => { const node=document.querySelector('[data-testid="permanent-entry-setup"] input[type="checkbox"]'); if(!(node instanceof HTMLInputElement)) return false; node.click(); return true; })()`,
    'tapped entry checkbox',
  );
  const changed = await page.evaluate<boolean>(
    `(() => { const input=document.querySelector('[aria-label="戦場に出るカウンター数"]'); if(!(input instanceof HTMLInputElement)) return false; const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set; if(!setter) return false; setter.call(input,'2'); input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`,
  );
  if (!changed) throw new Error('Could not set entry counter count');
  await waitFor<boolean>(
    page,
    `(() => document.querySelector('[aria-label="戦場に出るカウンター数"]')?.value === '2' || null)()`,
    'entry counter draft',
  );
  await clickButton('処理完了', 'resolution completion');
  await waitFor<boolean>(
    page,
    `(() => window.__r4EntryEvidenceCommits?.some((entry) => entry.operation?.type === 'resolve.end' && entry.operation?.entrySetup?.tapped === true && entry.operation?.entrySetup?.counters?.['+1/+1'] === 2) || null)()`,
    'resolve.end entrySetup commit',
  );
  await waitFor<boolean>(
    page,
    `(() => window.__r4EntryEvidenceTable?.resolution === null || null)()`,
    'resolution completion state',
  );

  const state = await page.evaluate<{
    commits: Array<{ operation: Record<string, any>; context: Record<string, any> }>;
    table: any;
  }>(`(() => ({ commits: window.__r4EntryEvidenceCommits, table: window.__r4EntryEvidenceTable }))()`);
  const commit = state.commits.find((entry) => entry.operation.type === 'resolve.end');
  if (!commit) throw new Error('resolve.end evidence missing');
  if (
    commit.context.kind !== 'resolution' ||
    commit.context.entryId !== 'browser-resolution-entry'
  )
    throw new Error('Resolution ExpectedInteractionContext mismatch');
  if (commit.operation.entryId !== 'browser-resolution-entry' || commit.operation.to !== 'battlefield')
    throw new Error('resolve.end identity/destination mismatch');
  if (
    commit.operation.entrySetup?.tapped !== true ||
    commit.operation.entrySetup?.counters?.['+1/+1'] !== 2
  )
    throw new Error('PermanentEntrySetup operation mismatch');
  const card = state.table.cards[cardId];
  if (card?.zone !== 'battlefield' || card.tapped !== true || card.counters?.['+1/+1'] !== 2)
    throw new Error('Permanent final entry state mismatch');
  if (state.table.resolution !== null) throw new Error('Resolution remained active after completion');

  const consoleCounts = page.consoleCounts();
  if (consoleCounts.errors !== 0 || consoleCounts.warnings !== 0)
    throw new Error(
      `browser console errors/warnings: ${consoleCounts.errors}/${consoleCounts.warnings}`,
    );

  const summary = {
    kind: 'r4-resolution-entry-ui-browser-evidence-v1',
    chromeVersion: browser.chromeVersion,
    cardId,
    resolveEnd: {
      entryId: commit.operation.entryId,
      to: commit.operation.to,
      entrySetup: commit.operation.entrySetup,
      context: commit.context,
    },
    finalState: {
      zone: card.zone,
      tapped: card.tapped,
      counters: card.counters,
      resolution: state.table.resolution,
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
