#!/usr/bin/env node
/**
 * O4P-09I production journey evidence.
 *
 * This harness intentionally knows only the production DOM contract.  It does
 * not import Core, construct command frames, or call a Worker API.  The default
 * browser comes from the hardened O4P-06F CDP adapter (or may be injected for
 * tests); it invokes CDP Runtime.evaluate through the small page/context API.
 * every mutation below is a click
 * or form edit on a visible element.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { stdout as output } from 'node:process';
import { launchO4p06fCdpBrowserV1, type O4p06fBrowserV1, type O4p06fPageV1 } from './o4p-06f-four-browser-evidence';

export const O4P09I_PAGES_ORIGIN_V1 = 'https://makeinu1.github.io/MTG_OneDeck/' as const;
export const O4P09I_WORKER_ORIGIN_V1 = 'https://mtg-onedeck-online.makeinu1.workers.dev' as const;
const VIEWPORTS = Object.freeze([
  Object.freeze({ width: 375, height: 812 }),
  Object.freeze({ width: 812, height: 375 }),
  Object.freeze({ width: 1440, height: 900 }),
] as const);
const UI_SEQUENCE = Object.freeze([
  'online-remote-guided-overlay',
  'online-advance-to-main',
  'online-journey-play-land',
  'online-journey-cast-spell',
  'online-remote-advance',
  'online-guided-declare-attacker',
  'online-manual-damage-submit',
  'online-remote-manual-overlay',
  'online-tabletop-submit-stack-entry',
  'online-tabletop-submit-manual-resolve',
  'visibility-look',
  'online-remote-guided-overlay',
  'online-manual-damage-submit',
] as const);
const PREGAME_SEQUENCE = Object.freeze([
  'pregame-confirm-commanders', 'pregame-keep', 'pregame-complete-actions', 'pregame-ready',
] as const);
const REVISION_CONTROLS = new Set<string>([
  'online-journey-play-land', 'online-journey-cast-spell', 'online-manual-damage-submit',
  'online-remote-advance', 'online-tabletop-submit-stack-entry', 'online-tabletop-submit-manual-resolve',
  'visibility-confirm', 'visibility-choose-',
]);
const MATCH_PHASES = Object.freeze([
  'room/decks', 'pregame', 'land', 'cast', 'HOLD', 'response/pass/resolve',
  'combat/manual damage', 'private Look/Choose', 'unsupported Manual Stack/Resolve',
  'disconnect/reconnect',
] as const);
const MAX_SUMMARY_BYTES = 131_072;
const MAX_TEXT_BYTES = 4_096;

type JsonRecord = Record<string, unknown>;
type Primitive = null | boolean | number | string;
type JsonValue = Primitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export type O4p09iPageV1 = Readonly<{
  readonly navigate: (url: string) => Promise<void>;
  readonly evaluate: <T>(expression: string, argument?: unknown) => Promise<T>;
  readonly setViewport?: (viewport: Readonly<{ readonly width: number; readonly height: number }>) => Promise<void> | void;
  readonly close: () => Promise<void> | void;
  readonly consoleCounts: () => Readonly<{ readonly errors: number; readonly warnings: number; readonly secretViolations?: number }>;
  readonly setSecretFragments?: (fragments: readonly string[]) => void;
}>;

export type O4p09iContextV1 = Readonly<{
  readonly browserContextId: string;
  readonly createPage: () => Promise<O4p09iPageV1>;
  readonly close: () => Promise<void> | void;
}>;

export type O4p09iBrowserV1 = Readonly<{
  readonly chromeVersion: string;
  readonly createBrowserContext: () => Promise<O4p09iContextV1>;
  readonly close: () => Promise<void> | void;
  readonly profilePath?: string;
}>;

function defaultBrowser(timeoutMs: number): Promise<O4p09iBrowserV1> {
  // O4P-06F owns the hardened CDP transport/context lifecycle.  This adapter
  // exposes only visible-page operations; sockets/command APIs stay private.
  return launchO4p06fCdpBrowserV1(timeoutMs).then((browser: O4p06fBrowserV1) => Object.freeze({
    chromeVersion: browser.chromeVersion,
    profilePath: browser.profilePath,
    close: () => browser.close(),
    createBrowserContext: async () => {
      const context = await browser.createBrowserContext();
      return Object.freeze({
        browserContextId: context.browserContextId,
        close: () => context.close(),
        createPage: async () => {
          const page: O4p06fPageV1 = await context.createPage();
          const navigate = page.navigateForUiEvidence ?? page.navigate;
          return Object.freeze({
            navigate: (url: string) => navigate.call(page, url),
            evaluate: <T>(expression: string, argument?: unknown) => page.evaluate<T>(expression, argument),
            setViewport: page.setViewport === undefined ? undefined : (viewport: Readonly<{ readonly width: number; readonly height: number }>) => page.setViewport?.(viewport),
            close: () => page.close(),
            consoleCounts: () => page.consoleCounts(),
            setSecretFragments: (fragments: readonly string[]) => page.setSecretFragments?.(fragments),
          });
        },
      });
    },
  }));
}

export type O4p09iViewportFactV1 = Readonly<{
  readonly width: 375 | 812 | 1440;
  readonly height: 812 | 375 | 900;
  readonly horizontalOverflow: number;
  readonly gameScreens: number;
  readonly consoleErrors: number;
  readonly geometry: O4p09iGeometryFactV1;
}>;

type O4p09iRectV1 = Readonly<{
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly right: number;
  readonly bottom: number;
}>;

type O4p09iScrollFactV1 = Readonly<{
  readonly rect: O4p09iRectV1;
  readonly scrollWidth: number;
  readonly scrollHeight: number;
  readonly clientWidth: number;
  readonly clientHeight: number;
}>;

type O4p09iPrimaryActionFactV1 = Readonly<{
  readonly rect: O4p09iRectV1;
  readonly enabled: true;
}>;

type O4p09iGeometryFactV1 = Readonly<{
  readonly viewport: O4p09iRectV1;
  readonly rail: O4p09iRectV1 | null;
  readonly hand: O4p09iRectV1 | null;
  readonly battlefield: O4p09iRectV1 | null;
  readonly primaryAction: O4p09iPrimaryActionFactV1 | null;
  readonly panel: O4p09iRectV1 | null;
  readonly scroll: O4p09iScrollFactV1 | null;
  readonly clippedPrimaryAction: boolean;
  readonly railHandCollision: boolean;
  readonly panelOutsideViewport: boolean;
  readonly scrollAccessible: boolean;
  readonly battlefieldObscured: boolean;
}>;

type O4p09iGeometryProbeV1 = Readonly<{
  readonly viewport: O4p09iRectV1;
  readonly rail: O4p09iRectV1 | null;
  readonly hand: O4p09iRectV1 | null;
  readonly battlefield: O4p09iRectV1 | null;
  readonly primaryAction: O4p09iPrimaryActionFactV1 | null;
  readonly panel: O4p09iRectV1 | null;
  readonly scroll: O4p09iScrollFactV1 | null;
  readonly clippedPrimaryAction: boolean;
  readonly railHandCollision: boolean;
  readonly panelOutsideViewport: boolean;
  readonly scrollAccessible: boolean;
  readonly battlefieldObscured: boolean;
}>;

export type O4p09iScenarioFactV1 = Readonly<{
  readonly playerCount: 2 | 4;
  readonly phases: readonly string[];
  readonly actionKinds: readonly string[];
  readonly revision: Readonly<{ readonly start: 0; readonly afterSharedMutation: number; readonly afterReconnect: number; readonly continuous: true }>;
  readonly privateLookChoose: Readonly<{ readonly look: true; readonly choose: true; readonly crossSeatLeak: false }>;
  readonly unsupportedManual: Readonly<{ readonly stack: true; readonly resolve: true }>;
  readonly outcome: 'winner' | 'three-continue';
  readonly eliminatedSeats: readonly string[];
  readonly viewportFacts: readonly O4p09iViewportFactV1[];
}>;

export type O4p09iEvidenceSummaryV1 = Readonly<{
  readonly kind: 'o4p-09i-full-match-production-evidence-v1';
  readonly schemaVersion: 1;
  readonly pagesOrigin: typeof O4P09I_PAGES_ORIGIN_V1;
  readonly workerOrigin: typeof O4P09I_WORKER_ORIGIN_V1;
  readonly chromeVersion: string;
  readonly scenarios: Readonly<{ readonly twoPlayer: O4p09iScenarioFactV1; readonly fourPlayer: O4p09iScenarioFactV1 }>;
  readonly consoleCounts: Readonly<{ readonly errors: 0; readonly warnings: 0; readonly secretViolations: 0 }>;
  readonly cleanup: Readonly<{ readonly contextsClosed: number; readonly pagesClosed: number; readonly profileRemoved: true }>;
}>;

export type O4p09iEvidenceDepsV1 = Readonly<{
  readonly browser?: O4p09iBrowserV1;
  readonly launchBrowser?: () => Promise<O4p09iBrowserV1>;
  readonly pagesOrigin?: string;
  readonly workerOrigin?: string;
  readonly readDeck?: (path: string) => string;
  readonly timeoutMs?: number;
}>;

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Reflect.getPrototypeOf(value) === Object.prototype || Reflect.getPrototypeOf(value) === null);
}

function own(value: JsonRecord, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && 'value' in descriptor && descriptor.get === undefined && descriptor.set === undefined
    ? descriptor.value
    : undefined;
}

function exact(value: unknown, keys: readonly string[], label: string): JsonRecord {
  if (!isRecord(value)) throw new Error(label);
  const names = Reflect.ownKeys(value);
  if (names.length !== keys.length || names.some((key) => typeof key !== 'string' || !keys.includes(key))) throw new Error(label);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || descriptor.enumerable !== true || !('value' in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined) throw new Error(label);
  }
  return value;
}

function canonical(value: unknown, depth = 0, seen = new WeakSet<object>()): JsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    if (typeof value === 'string' && new TextEncoder().encode(value).byteLength > MAX_TEXT_BYTES) throw new Error('evidence text too large');
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0)) throw new Error('invalid evidence number');
    return value;
  }
  if (typeof value !== 'object' || seen.has(value) || depth > 24) throw new Error('invalid evidence object');
  seen.add(value);
  if (Array.isArray(value)) return value.map((entry) => canonical(entry, depth + 1, seen));
  if (!isRecord(value)) throw new Error('invalid evidence record');
  const result: Record<string, JsonValue> = {};
  for (const key of Object.keys(value).sort()) result[key] = canonical(own(value, key), depth + 1, seen);
  return result;
}

function containsSecret(value: unknown, fragments: readonly string[], seen = new WeakSet<object>()): boolean {
  if (typeof value === 'string') return fragments.some((fragment) => fragment.length >= 8 && value.includes(fragment)) || /^(?:seat|invite|observer|cap)[_-][A-Za-z0-9_-]{8,}$/u.test(value);
  if (value === null || typeof value !== 'object' || seen.has(value)) return false;
  if (!isRecord(value) && !Array.isArray(value)) return true;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') return true;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !('value' in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined) return true;
    if (containsSecret(key, fragments, seen) || containsSecret(descriptor.value, fragments, seen)) return true;
  }
  return false;
}

function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }

function safeRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0) && value >= 0;
}

function safeString(value: unknown): value is string { return typeof value === 'string' && value.length > 0 && value.length <= 256; }

function boundedNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Object.is(value, -0) || Math.abs(value) > 10_000) throw new Error(`${label} malformed`);
  return value;
}

function validateRect(value: unknown, label: string): O4p09iRectV1 {
  const row = exact(value, ['x', 'y', 'width', 'height', 'right', 'bottom'], `${label} malformed`);
  const x = boundedNumber(own(row, 'x'), `${label}.x`);
  const y = boundedNumber(own(row, 'y'), `${label}.y`);
  const width = boundedNumber(own(row, 'width'), `${label}.width`);
  const height = boundedNumber(own(row, 'height'), `${label}.height`);
  const right = boundedNumber(own(row, 'right'), `${label}.right`);
  const bottom = boundedNumber(own(row, 'bottom'), `${label}.bottom`);
  if (width <= 0 || height <= 0 || right < x || bottom < y) throw new Error(`${label} dimensions invalid`);
  return Object.freeze({ x, y, width, height, right, bottom });
}

function validateGeometry(value: unknown, index: number): O4p09iGeometryFactV1 {
  const row = exact(value, ['viewport', 'rail', 'hand', 'battlefield', 'primaryAction', 'panel', 'scroll', 'clippedPrimaryAction', 'railHandCollision', 'panelOutsideViewport', 'scrollAccessible', 'battlefieldObscured'], `geometry ${index} malformed`);
  const viewport = validateRect(own(row, 'viewport'), `geometry ${index}.viewport`);
  const railValue = own(row, 'rail');
  const handValue = own(row, 'hand');
  const battlefieldValue = own(row, 'battlefield');
  const panelValue = own(row, 'panel');
  const rail = railValue === null ? null : validateRect(railValue, `geometry ${index}.rail`);
  const hand = handValue === null ? null : validateRect(handValue, `geometry ${index}.hand`);
  const battlefield = battlefieldValue === null ? null : validateRect(battlefieldValue, `geometry ${index}.battlefield`);
  const panel = panelValue === null ? null : validateRect(panelValue, `geometry ${index}.panel`);
  const primaryValue = own(row, 'primaryAction');
  let primaryAction: O4p09iPrimaryActionFactV1 | null = null;
  if (primaryValue !== null) {
    const primary = exact(primaryValue, ['rect', 'enabled'], `geometry ${index}.primaryAction malformed`);
    if (own(primary, 'enabled') !== true) throw new Error(`geometry ${index}.primary action unavailable`);
    primaryAction = Object.freeze({ rect: validateRect(own(primary, 'rect'), `geometry ${index}.primaryAction.rect`), enabled: true });
  }
  const scrollValue = own(row, 'scroll');
  let scroll: O4p09iScrollFactV1 | null = null;
  if (scrollValue !== null) {
    const scrollRow = exact(scrollValue, ['rect', 'scrollWidth', 'scrollHeight', 'clientWidth', 'clientHeight'], `geometry ${index}.scroll malformed`);
    const scrollWidth = boundedNumber(own(scrollRow, 'scrollWidth'), `geometry ${index}.scroll.scrollWidth`);
    const scrollHeight = boundedNumber(own(scrollRow, 'scrollHeight'), `geometry ${index}.scroll.scrollHeight`);
    const clientWidth = boundedNumber(own(scrollRow, 'clientWidth'), `geometry ${index}.scroll.clientWidth`);
    const clientHeight = boundedNumber(own(scrollRow, 'clientHeight'), `geometry ${index}.scroll.clientHeight`);
    if (scrollWidth <= 0 || scrollHeight <= 0 || clientWidth <= 0 || clientHeight <= 0) throw new Error(`geometry ${index}.scroll dimensions invalid`);
    scroll = Object.freeze({ rect: validateRect(own(scrollRow, 'rect'), `geometry ${index}.scroll.rect`), scrollWidth, scrollHeight, clientWidth, clientHeight });
  }
  const clippedPrimaryAction = own(row, 'clippedPrimaryAction');
  const railHandCollision = own(row, 'railHandCollision');
  const panelOutsideViewport = own(row, 'panelOutsideViewport');
  const scrollAccessible = own(row, 'scrollAccessible');
  const battlefieldObscured = own(row, 'battlefieldObscured');
  if (typeof clippedPrimaryAction !== 'boolean' || typeof railHandCollision !== 'boolean' || typeof panelOutsideViewport !== 'boolean' || typeof scrollAccessible !== 'boolean' || typeof battlefieldObscured !== 'boolean') throw new Error(`geometry ${index} flags malformed`);
  if (rail === null || hand === null || battlefield === null || primaryAction === null || panel === null || scroll === null || clippedPrimaryAction || railHandCollision || panelOutsideViewport || !scrollAccessible || battlefieldObscured) throw new Error(`geometry ${index} failed`);
  return Object.freeze({ viewport, rail, hand, battlefield, primaryAction, panel, scroll, clippedPrimaryAction, railHandCollision, panelOutsideViewport, scrollAccessible, battlefieldObscured });
}

function validateViewport(value: unknown, index: number): O4p09iViewportFactV1 {
  const row = exact(value, ['width', 'height', 'horizontalOverflow', 'gameScreens', 'consoleErrors', 'geometry'], `viewport ${index} malformed`);
  const width = own(row, 'width'); const height = own(row, 'height');
  const expected = VIEWPORTS[index];
  if (width !== expected?.width || height !== expected?.height || own(row, 'horizontalOverflow') !== 0 || own(row, 'gameScreens') !== 1 || own(row, 'consoleErrors') !== 0) throw new Error(`viewport ${index} failed`);
  const geometry = validateGeometry(own(row, 'geometry'), index);
  if (geometry.viewport.width !== width || geometry.viewport.height !== height) throw new Error(`viewport ${index} geometry viewport mismatch`);
  const normalizedWidth = width === 375 ? 375 : width === 812 ? 812 : 1440;
  const normalizedHeight = height === 812 ? 812 : height === 375 ? 375 : 900;
  return Object.freeze({ width: normalizedWidth, height: normalizedHeight, horizontalOverflow: 0, gameScreens: 1, consoleErrors: 0, geometry });
}

function validateScenario(value: unknown, expectedPlayers: 2 | 4, fragments: readonly string[]): O4p09iScenarioFactV1 {
  const row = exact(value, ['playerCount', 'phases', 'actionKinds', 'revision', 'privateLookChoose', 'unsupportedManual', 'outcome', 'eliminatedSeats', 'viewportFacts'], 'scenario malformed');
  if (own(row, 'playerCount') !== expectedPlayers) throw new Error('scenario player count mismatch');
  const phases = own(row, 'phases');
  if (!Array.isArray(phases) || phases.length !== MATCH_PHASES.length || phases.some((phase, index) => phase !== MATCH_PHASES[index])) throw new Error('scenario phases incomplete');
  const actionKinds = own(row, 'actionKinds');
  if (!Array.isArray(actionKinds) || actionKinds.length < 8 || actionKinds.some((kind) => typeof kind !== 'string')) throw new Error('scenario actions incomplete');
  const revision = exact(own(row, 'revision'), ['start', 'afterSharedMutation', 'afterReconnect', 'continuous'], 'scenario revision malformed');
  const afterSharedMutation = own(revision, 'afterSharedMutation');
  const afterReconnect = own(revision, 'afterReconnect');
  if (own(revision, 'start') !== 0 || !safeRevision(afterSharedMutation) || !safeRevision(afterReconnect) || afterReconnect < afterSharedMutation || own(revision, 'continuous') !== true) throw new Error('scenario revision continuity failed');
  const privateFacts = exact(own(row, 'privateLookChoose'), ['look', 'choose', 'crossSeatLeak'], 'private choice facts malformed');
  if (own(privateFacts, 'look') !== true || own(privateFacts, 'choose') !== true || own(privateFacts, 'crossSeatLeak') !== false) throw new Error('private choice leak');
  const unsupported = exact(own(row, 'unsupportedManual'), ['stack', 'resolve'], 'manual fallback facts malformed');
  if (own(unsupported, 'stack') !== true || own(unsupported, 'resolve') !== true) throw new Error('manual fallback incomplete');
  const outcome = own(row, 'outcome');
  if (expectedPlayers === 2 ? outcome !== 'winner' : outcome !== 'three-continue') throw new Error('scenario outcome mismatch');
  const eliminated = own(row, 'eliminatedSeats');
  if (!Array.isArray(eliminated) || eliminated.some((seat) => typeof seat !== 'string') || (expectedPlayers === 2 ? eliminated.length !== 1 : eliminated.length !== 1)) throw new Error('elimination facts malformed');
  const viewports = own(row, 'viewportFacts');
  if (!Array.isArray(viewports) || viewports.length !== VIEWPORTS.length) throw new Error('viewport matrix incomplete');
  const viewportFacts = Object.freeze(viewports.map((entry, index) => validateViewport(entry, index)));
  const normalized: O4p09iScenarioFactV1 = Object.freeze({
    playerCount: expectedPlayers,
    phases: Object.freeze(phases.map((phase) => String(phase))),
    actionKinds: Object.freeze(actionKinds.map((kind) => String(kind))),
    revision: Object.freeze({ start: 0, afterSharedMutation, afterReconnect, continuous: true }),
    privateLookChoose: Object.freeze({ look: true, choose: true, crossSeatLeak: false }),
    unsupportedManual: Object.freeze({ stack: true, resolve: true }),
    outcome: outcome as 'winner' | 'three-continue',
    eliminatedSeats: Object.freeze(eliminated.map((seat) => String(seat))),
    viewportFacts,
  });
  if (containsSecret(normalized, fragments)) throw new Error('scenario secret violation');
  return normalized;
}

export function validateO4p09iFullMatchEvidenceV1(input: unknown, secretFragments: readonly string[] = []): Readonly<{ readonly ok: true; readonly value: O4p09iEvidenceSummaryV1 } | { readonly ok: false; readonly issues: readonly string[] }> {
  try {
    const root = exact(input, ['kind', 'schemaVersion', 'pagesOrigin', 'workerOrigin', 'chromeVersion', 'scenarios', 'consoleCounts', 'cleanup'], 'summary fields malformed');
    if (containsSecret(root, secretFragments)) throw new Error('secret-bearing summary');
    if (own(root, 'kind') !== 'o4p-09i-full-match-production-evidence-v1' || own(root, 'schemaVersion') !== 1 || own(root, 'pagesOrigin') !== O4P09I_PAGES_ORIGIN_V1 || own(root, 'workerOrigin') !== O4P09I_WORKER_ORIGIN_V1 || !safeString(own(root, 'chromeVersion'))) throw new Error('summary identity invalid');
    const scenarios = exact(own(root, 'scenarios'), ['twoPlayer', 'fourPlayer'], 'scenario summary malformed');
    const twoPlayer = validateScenario(own(scenarios, 'twoPlayer'), 2, secretFragments);
    const fourPlayer = validateScenario(own(scenarios, 'fourPlayer'), 4, secretFragments);
    const consoleCounts = exact(own(root, 'consoleCounts'), ['errors', 'warnings', 'secretViolations'], 'console summary malformed');
    if (own(consoleCounts, 'errors') !== 0 || own(consoleCounts, 'warnings') !== 0 || own(consoleCounts, 'secretViolations') !== 0) throw new Error('console errors or secret violations present');
    const cleanup = exact(own(root, 'cleanup'), ['contextsClosed', 'pagesClosed', 'profileRemoved'], 'cleanup summary malformed');
    if (!safeRevision(own(cleanup, 'contextsClosed')) || !safeRevision(own(cleanup, 'pagesClosed')) || own(cleanup, 'contextsClosed') !== 6 || own(cleanup, 'pagesClosed') !== 8 || own(cleanup, 'profileRemoved') !== true) throw new Error('cleanup incomplete');
    const canonicalValue = canonical(root);
    if (new TextEncoder().encode(JSON.stringify(canonicalValue)).byteLength > MAX_SUMMARY_BYTES) throw new Error('summary too large');
    return Object.freeze({ ok: true, value: Object.freeze({
      kind: 'o4p-09i-full-match-production-evidence-v1', schemaVersion: 1,
      pagesOrigin: O4P09I_PAGES_ORIGIN_V1, workerOrigin: O4P09I_WORKER_ORIGIN_V1,
      chromeVersion: own(root, 'chromeVersion') as string,
      scenarios: Object.freeze({ twoPlayer, fourPlayer }),
      consoleCounts: Object.freeze({ errors: 0, warnings: 0, secretViolations: 0 }),
      cleanup: Object.freeze({ contextsClosed: 6, pagesClosed: 8, profileRemoved: true }),
    }) });
  } catch (error: unknown) {
    return Object.freeze({ ok: false, issues: Object.freeze([error instanceof Error ? error.message : 'invalid evidence summary']) });
  }
}

async function clickVisible(page: O4p09iPageV1, testId: string, timeoutMs: number): Promise<void> {
  if (/applyCommand|dispatch\s*\(|fetch\s*\(|WebSocket|Core/iu.test(testId)) throw new Error('unsafe UI control');
  await Promise.race([
    page.evaluate<boolean>(`(async () => { const deadline = Date.now() + ${String(timeoutMs)}; for (;;) { const node = document.querySelector('[data-testid="${testId}"]'); if (!(node instanceof HTMLElement)) { if (Date.now() >= deadline) throw new Error('visible control missing'); await new Promise((resolve) => setTimeout(resolve, 25)); continue; } const style = getComputedStyle(node); const rect = node.getBoundingClientRect(); const visible = !node.hidden && node.getAttribute('aria-hidden') !== 'true' && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') > 0 && rect.width > 0 && rect.height > 0 && node.closest('details:not([open])') === null; if (!visible) throw new Error('visible control hidden'); if (node instanceof HTMLButtonElement && node.disabled) { if (Date.now() >= deadline) throw new Error('visible control disabled'); await new Promise((resolve) => setTimeout(resolve, 25)); continue; } if (node instanceof HTMLInputElement && node.disabled) { if (Date.now() >= deadline) throw new Error('visible control disabled'); await new Promise((resolve) => setTimeout(resolve, 25)); continue; } node.click(); return true; } })()`),
    new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error(`control ${testId} timeout`)), timeoutMs)),
  ]);
}

async function clickVisibleSelector(page: O4p09iPageV1, selector: string, timeoutMs: number): Promise<void> {
  await Promise.race([
    page.evaluate<boolean>(`(async () => { const deadline = Date.now() + ${String(timeoutMs)}; for (;;) { const node = document.querySelector(${JSON.stringify(selector)}); if (!(node instanceof HTMLElement)) { if (Date.now() >= deadline) throw new Error('visible selector missing'); await new Promise((resolve) => setTimeout(resolve, 25)); continue; } const style = getComputedStyle(node); const rect = node.getBoundingClientRect(); if (node.hidden || node.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') <= 0 || rect.width <= 0 || rect.height <= 0 || node.closest('details:not([open])') !== null) throw new Error('visible selector hidden'); if (node instanceof HTMLButtonElement && node.disabled) { if (Date.now() >= deadline) throw new Error('visible selector disabled'); await new Promise((resolve) => setTimeout(resolve, 25)); continue; } node.click(); return true; } })()`),
    new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error(`selector ${selector} timeout`)), timeoutMs)),
  ]);
}

async function clickButtonByText(page: O4p09iPageV1, text: string, timeoutMs: number): Promise<void> {
  await Promise.race([
    page.evaluate<boolean>(`(() => {
      const target = [...document.querySelectorAll('button')].find((node) => (node.textContent ?? '').trim().includes(${JSON.stringify(text)}));
      if (!(target instanceof HTMLButtonElement)) throw new Error('visible text control missing');
      const style = getComputedStyle(target); const rect = target.getBoundingClientRect();
      if (target.hidden || target.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') <= 0 || rect.width <= 0 || rect.height <= 0 || target.closest('details:not([open])') !== null) throw new Error('visible text control hidden');
      if (target.disabled) throw new Error('visible text control disabled');
      target.click(); return true;
    })()`),
    new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error(`text control ${text} timeout`)), timeoutMs)),
  ]);
}

async function fillVisible(page: O4p09iPageV1, testId: string, value: string, timeoutMs: number): Promise<void> {
  await Promise.race([
    page.evaluate<boolean>(`(() => {
      const node = document.querySelector('[data-testid="${testId}"]');
      if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement)) throw new Error('visible input missing');
      const style = getComputedStyle(node); const rect = node.getBoundingClientRect();
      if (node.hidden || node.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') <= 0 || rect.width <= 0 || rect.height <= 0 || node.closest('details:not([open])') !== null) throw new Error('visible input hidden');
      if (node.disabled) throw new Error('visible input disabled');
      const setter = Object.getOwnPropertyDescriptor(node instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(node, ${JSON.stringify(value)});
      node.dispatchEvent(new Event('input', { bubbles: true }));
      node.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`),
    new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error(`input ${testId} timeout`)), timeoutMs)),
  ]);
}

async function selectFirstVisibleOption(page: O4p09iPageV1, testId: string, timeoutMs: number): Promise<void> {
  await Promise.race([
    page.evaluate<boolean>(`(() => {
      const node = document.querySelector('[data-testid="${testId}"]');
      if (!(node instanceof HTMLSelectElement)) throw new Error('visible select missing');
      const style = getComputedStyle(node); const rect = node.getBoundingClientRect();
      if (node.hidden || node.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') <= 0 || rect.width <= 0 || rect.height <= 0 || node.closest('details:not([open])') !== null) throw new Error('visible select hidden');
      if (node.disabled) throw new Error('visible select disabled');
      const option = [...node.options].find((entry) => entry.value !== '' && !entry.disabled);
      if (option === undefined) throw new Error('visible select has no choice');
      node.value = option.value;
      node.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`),
    new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error(`select ${testId} timeout`)), timeoutMs)),
  ]);
}

async function selectFirstVisibleSelector(page: O4p09iPageV1, selector: string, timeoutMs: number): Promise<void> {
  await Promise.race([
    page.evaluate<boolean>(`(() => { const node = document.querySelector(${JSON.stringify(selector)}); if (!(node instanceof HTMLSelectElement)) throw new Error('visible selector missing'); const style = getComputedStyle(node); const rect = node.getBoundingClientRect(); if (node.hidden || style.display === 'none' || style.visibility === 'hidden' || rect.width <= 0 || rect.height <= 0 || node.closest('details:not([open])') !== null) throw new Error('visible selector hidden'); if (node.disabled) throw new Error('visible selector disabled'); const option = [...node.options].find((entry) => entry.value !== '' && !entry.disabled); if (option === undefined) throw new Error('visible selector has no choice'); node.value = option.value; node.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`),
    new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error(`selector ${selector} timeout`)), timeoutMs)),
  ]);
}

async function clickFirstVisiblePrefix(page: O4p09iPageV1, prefix: string, timeoutMs: number): Promise<void> {
  await Promise.race([
    page.evaluate<boolean>(`(() => {
      const target = [...document.querySelectorAll('[data-testid^="${prefix}"]')].find((node) => node instanceof HTMLButtonElement);
      if (!(target instanceof HTMLButtonElement)) throw new Error('visible prefixed control missing');
      const style = getComputedStyle(target); const rect = target.getBoundingClientRect();
      if (target.hidden || target.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') <= 0 || rect.width <= 0 || rect.height <= 0 || target.closest('details:not([open])') !== null) throw new Error('visible prefixed control hidden');
      if (target.disabled) throw new Error('visible prefixed control disabled');
      target.click(); return true;
    })()`),
    new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error(`prefixed control ${prefix} timeout`)), timeoutMs)),
  ]);
}

type O4p09iPrivateChoicePayloadV1 = Readonly<{
  readonly identifiers: readonly string[];
  readonly candidateHandles: readonly string[];
  readonly serialized: string;
  readonly digest: string;
}>;

/**
 * Capture bounded private-choice handles and a deterministic digest.  Raw
 * values remain in this process only for the immediate cross-seat check; they
 * are intentionally absent from the evidence schema and error messages.
 */
async function readPrivateChoicePayload(page: O4p09iPageV1, timeoutMs: number): Promise<O4p09iPrivateChoicePayloadV1> {
  const raw = await Promise.race([
    page.evaluate<Readonly<{ readonly identifiers: readonly string[]; readonly candidateHandles: readonly string[]; readonly serialized: string }>>(`(() => {
      const clip = (value: string): string => value.trim().slice(0, 256);
      const privateRoots = [...document.querySelectorAll('[data-testid^="visibility-choice-"], [data-testid^="visibility-choose-"], [data-private-choice], [data-choice-handle], input[type="checkbox"]')].slice(0, 48);
      const rows = privateRoots.map((node) => {
        const attrs = [...node.attributes]
          .filter((attribute) => /^(?:data-|id$|name$|value$)/iu.test(attribute.name))
          .slice(0, 16)
          .map((attribute) => [attribute.name, clip(attribute.value)] as const);
        const values = [...node.querySelectorAll('input, option')]
          .slice(0, 16)
          .map((child) => 'value' in child && typeof child.value === 'string' ? clip(child.value) : '')
          .filter((value) => value !== '');
        const text = node.classList.contains('online-visibility-decisions__candidate') || node.matches('label') ? clip(node.textContent ?? '') : '';
        return { attrs, values, text };
      });
      const identifiers = rows.flatMap((row) => row.attrs.filter(([name, value]) => name === 'data-testid' && value.startsWith('visibility-choose-')).map(([, value]) => value)).slice(0, 32);
      const candidateHandles = rows.flatMap((row) => [
        ...row.attrs.filter(([name]) => name !== 'data-testid' && /handle|candidate|object|value/iu.test(name)).map(([, value]) => value),
        ...row.values,
        ...(row.text === '' ? [] : [row.text]),
      ]).filter((value) => value.length >= 4).slice(0, 64);
      const privateChoicePayload = { identifiers, candidateHandles, serialized: JSON.stringify(rows) };
      return privateChoicePayload;
    })()`),
    new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('private choice probe timeout')), timeoutMs)),
  ]);
  if (raw.serialized.length > 16_384) throw new Error('private choice payload too large');
  const identifiers = raw.identifiers.filter((value) => typeof value === 'string' && value.length <= 256).slice(0, 32);
  const candidateHandles = raw.candidateHandles.filter((value) => typeof value === 'string' && value.length <= 256).slice(0, 64);
  return Object.freeze({ identifiers, candidateHandles, serialized: raw.serialized, digest: sha256(raw.serialized) });
}

/** Capture bounded rendered text, attributes, form values, and choice-control
 * content from an unauthorized seat.  Values remain memory-only in the caller;
 * host tokens are never injected into that seat's page. */
async function readUnauthorizedDomSurfaces(page: O4p09iPageV1, timeoutMs: number): Promise<readonly string[]> {
  return Promise.race([
    page.evaluate<readonly string[]>(`(() => {
      const clip = (value: string): string => value.trim().slice(0, 256);
      const surfaces = [clip(document.documentElement.textContent ?? '')];
      for (const node of [...document.querySelectorAll('*')].slice(0, 512)) {
        for (const attribute of [...node.attributes].slice(0, 16)) surfaces.push(clip(attribute.value));
        if ('value' in node && typeof node.value === 'string') surfaces.push(clip(node.value));
        if (node.matches('[data-testid^="visibility-"], [data-testid^="visibility-choice-"], [data-testid^="visibility-choose-"]')) surfaces.push(clip(node.textContent ?? ''));
      }
      const privateChoiceDomSurfaces = surfaces.filter((value) => value !== '').slice(0, 2_048);
      return privateChoiceDomSurfaces;
    })()`),
    new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('private choice surface probe timeout')), timeoutMs)),
  ]);
}

async function toggleDetails(page: O4p09iPageV1, testId: string, timeoutMs: number): Promise<void> {
  await Promise.race([
    page.evaluate<boolean>(`(() => {
      const details = document.querySelector('[data-testid="${testId}"]');
      if (!(details instanceof HTMLDetailsElement)) throw new Error('visible details missing');
      const style = getComputedStyle(details); const rect = details.getBoundingClientRect();
      if (details.hidden || details.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') <= 0 || rect.width <= 0 || rect.height <= 0) throw new Error('visible details hidden');
      if (!details.open) details.querySelector('summary')?.click();
      if (!details.open) throw new Error('visible details did not open');
      return true;
    })()`),
    new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error(`details ${testId} timeout`)), timeoutMs)),
  ]);
}

async function readInvite(page: O4p09iPageV1, timeoutMs: number): Promise<string> {
  return Promise.race([
    page.evaluate<string>(`(() => {
      const invite = [...document.querySelectorAll('.public-online-app__invite span')].map((node) => {
        const style = getComputedStyle(node); const rect = node.getBoundingClientRect();
        return node.hidden || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') <= 0 || rect.width <= 0 || rect.height <= 0 ? '' : (node.textContent ?? '').trim();
      }).find((value) => value !== '' && !value.includes('準備しました'));
      if (!invite) throw new Error('visible invite missing');
      return invite;
    })()`),
    new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('invite read timeout')), timeoutMs)),
  ]);
}

async function waitForRevisionAdvance(page: O4p09iPageV1, workerOrigin: string, baseline: number, timeoutMs: number, secretFragments: readonly string[] = []): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const probe = await probePage(page, Math.min(timeoutMs, 1_000), workerOrigin, secretFragments);
    if (safeRevision(probe.revision) && probe.revision > baseline) return probe.revision;
    if (Date.now() >= deadline) throw new Error('visible action acknowledgement timeout');
    await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 50));
  }
}

async function clickAndAwaitRevision(page: O4p09iPageV1, testId: string, workerOrigin: string, timeoutMs: number, secretFragments: readonly string[] = []): Promise<number> {
  const before = await probePage(page, timeoutMs, workerOrigin, secretFragments);
  await clickVisible(page, testId, timeoutMs);
  return waitForRevisionAdvance(page, workerOrigin, before.revision, timeoutMs, secretFragments);
}

async function waitForJourneyEvidence(page: O4p09iPageV1, playerCount: 2 | 4, workerOrigin: string, baseline: number, timeoutMs: number, secretFragments: readonly string[]): Promise<O4p09iProbeV1> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const probe = await probePage(page, Math.min(timeoutMs, 1_000), workerOrigin, secretFragments);
    const outcomeReady = probe.outcomeVisible && (playerCount === 2 ? probe.winner : probe.activeSeatCount >= 3 && probe.eliminatedSeats.length >= 1);
    const controlsReady = probe.privateLookControl && probe.manualStackControl && probe.manualResolveControl;
    if (safeRevision(probe.revision) && probe.revision > baseline && outcomeReady && controlsReady) return probe;
    if (Date.now() >= deadline) throw new Error('journey acknowledgement/outcome timeout');
    await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 75));
  }
}

async function advanceUntilPhase(page: O4p09iPageV1, targetPhase: string, workerOrigin: string, timeoutMs: number, secretFragments: readonly string[]): Promise<O4p09iProbeV1> {
  const deadline = Date.now() + timeoutMs;
  for (let attempts = 0; attempts < 12; attempts += 1) {
    const current = await probePage(page, Math.min(timeoutMs, 1_000), workerOrigin, secretFragments);
    if (current.phase === targetPhase) return current;
    if (Date.now() >= deadline) break;
    await clickAndAwaitRevision(page, 'online-remote-advance', workerOrigin, Math.min(timeoutMs, Math.max(250, deadline - Date.now())), secretFragments);
  }
  throw new Error(`phase target ${targetPhase} not reached`);
}

type O4p09iProbeV1 = Readonly<{
  readonly gameScreens: number;
  readonly overflow: number;
  readonly geometry: O4p09iGeometryProbeV1;
  readonly revision: number;
  readonly phase: string;
  readonly winner: boolean;
  readonly outcomeVisible: boolean;
  readonly activeSeatCount: number;
  readonly eliminatedSeats: readonly string[];
  readonly opponentLeak: boolean;
  readonly privateLookControl: boolean;
  readonly chooseControl: boolean;
  readonly manualStackControl: boolean;
  readonly manualResolveControl: boolean;
  readonly consoleErrors: number;
  readonly workerObserved: boolean;
}>;

async function probePage(page: O4p09iPageV1, timeoutMs: number, workerOrigin: string, secretFragments: readonly string[] = []): Promise<O4p09iProbeV1> {
  const probe = await Promise.race([
    page.evaluate<O4p09iProbeV1>(`(() => {
      const root = document.documentElement;
      const text = document.body?.textContent ?? '';
      const revision = [...document.querySelectorAll('[data-testid="online-remote-connection"], [data-testid="online-assisted-priority"]')]
        .map((node) => /更新 (\\d+)/u.exec(node.textContent ?? '')?.[1] ?? '')
        .flatMap((value) => value === '' ? [] : [Number(value)]).at(-1) ?? 0;
      const outcomeText = document.querySelector('[data-testid="online-remote-outcome"]')?.textContent ?? '';
      const phase = document.querySelector('[data-testid="phase-indicator"]')?.getAttribute('data-phase') ?? '';
      const eliminated = [...outcomeText.matchAll(/\\b(P\\d+)\\s*:\\s*(?:敗北|投了)/gu)].map((match) => match[1] ?? '').filter(Boolean);
      const activeSeatCount = [...outcomeText.matchAll(/\\bP\\d+\\s*:\\s*進行中/gu)].length;
      const workerObserved = [...performance.getEntriesByType('resource')]
        .map((entry) => entry.name).some((name) => { try { return new URL(name, location.href).origin === ${JSON.stringify(workerOrigin)}; } catch { return false; } });
      const visible = (node: Element | null): node is HTMLElement => {
        if (!(node instanceof HTMLElement)) return false;
        const style = getComputedStyle(node); const rect = node.getBoundingClientRect();
        return !node.hidden && node.getAttribute('aria-hidden') !== 'true' && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') > 0 && rect.width > 0 && rect.height > 0;
      };
      const rectOf = (node: Element | null) => {
        if (!visible(node)) return null;
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom };
      };
      const viewportRect = { x: 0, y: 0, width: innerWidth, height: innerHeight, right: innerWidth, bottom: innerHeight };
      const railNode = document.querySelector('[data-testid="online-remote-game-rail"]');
      const handNode = document.querySelector('[data-testid="hand-ribbon"]');
      const battlefieldNode = document.querySelector('[data-testid="board"]') ?? document.querySelector('.game-screen__board');
      const rail = rectOf(railNode);
      const hand = rectOf(handNode);
      const battlefield = rectOf(battlefieldNode);
      const primaryNode = railNode === null ? null : [...railNode.querySelectorAll('button.online-remote-rail__primary-action')].find((node) => visible(node) && !(node as HTMLButtonElement).disabled) ?? null;
      const primaryRect = rectOf(primaryNode);
      const primaryAction = primaryRect === null ? null : { rect: primaryRect, enabled: true };
      const panelNode = document.querySelector('[data-testid="online-remote-guided-overlay"][open], [data-testid="online-remote-manual-overlay"][open]');
      const panel = rectOf(panelNode);
      const scrollNode = [panelNode, railNode, handNode, document.querySelector('[data-testid="hand-cards"]')]
        .find((node) => visible(node) && ['auto', 'scroll'].some((value) => { const style = getComputedStyle(node); return style.overflow === value || style.overflowX === value || style.overflowY === value; })) ?? null;
      const scrollRect = rectOf(scrollNode);
      const scrollElement = scrollNode as HTMLElement | null;
      const scroll = scrollRect === null || scrollElement === null ? null : { rect: scrollRect, scrollWidth: scrollElement.scrollWidth, scrollHeight: scrollElement.scrollHeight, clientWidth: scrollElement.clientWidth, clientHeight: scrollElement.clientHeight };
      const overlaps = (left: typeof rail, right: typeof hand): boolean => left !== null && right !== null && left.right > right.x && right.right > left.x && left.bottom > right.y && right.bottom > left.y;
      const insideViewport = (value: typeof rail): boolean => value !== null && value.x >= 0 && value.y >= 0 && value.right <= viewportRect.width && value.bottom <= viewportRect.height;
      const intersectionArea = (left: typeof rail, right: typeof battlefield): number => {
        if (left === null || right === null) return 0;
        return Math.max(0, Math.min(left.right, right.right) - Math.max(left.x, right.x)) * Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.y, right.y));
      };
      const battlefieldArea = battlefield === null ? 0 : battlefield.width * battlefield.height;
      const coveredArea = intersectionArea(rail, battlefield) + intersectionArea(panel, battlefield);
      const geometry = {
        viewport: viewportRect,
        rail,
        hand,
        battlefield,
        primaryAction,
        panel,
        scroll,
        clippedPrimaryAction: primaryRect !== null && !insideViewport(primaryRect),
        railHandCollision: overlaps(rail, hand),
        panelOutsideViewport: panel !== null && !insideViewport(panel),
        scrollAccessible: scroll !== null && insideViewport(scroll.rect) && scroll.clientWidth > 0 && scroll.clientHeight > 0,
        battlefieldObscured: battlefieldArea > 0 && coveredArea >= battlefieldArea * 0.98,
      };
      const consoleErrors = 0;
      return {
        gameScreens: document.querySelectorAll('[data-testid="game-screen"]').length,
        overflow: Math.max(0, root.scrollWidth - root.clientWidth),
        geometry,
        revision,
        phase,
        winner: /勝者/u.test(outcomeText),
        outcomeVisible: outcomeText.trim() !== '',
        activeSeatCount,
        eliminatedSeats: eliminated,
        opponentLeak: /(?:seat_|invite_|observer_)[A-Za-z0-9_-]{4,}/u.test(text) || (argument.fragments ?? []).some((fragment) => typeof fragment === 'string' && fragment.length >= 8 && text.includes(fragment)),
        privateLookControl: document.querySelector('[data-testid="visibility-look"]') !== null,
        chooseControl: document.querySelector('[data-testid^="visibility-choose-"]') !== null,
        manualStackControl: document.querySelector('[data-testid="online-tabletop-submit-stack-entry"]') !== null,
        manualResolveControl: document.querySelector('[data-testid="online-tabletop-submit-manual-resolve"]') !== null,
        consoleErrors,
        workerObserved,
      };
    })()` , { fragments: secretFragments }),
    new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('page probe timeout')), timeoutMs)),
  ]);
  const consoleErrors = page.consoleCounts().errors;
  return Object.freeze({ ...probe, consoleErrors });
}

async function driveScenario(browser: O4p09iBrowserV1, playerCount: 2 | 4, pagesOrigin: string, workerOrigin: string, timeoutMs: number, secretFragments: string[], counters: { contextsClosed: number; pagesClosed: number }): Promise<O4p09iScenarioFactV1> {
  const contexts: O4p09iContextV1[] = [];
  const pages: O4p09iPageV1[] = [];
  let revisionBeforeReconnect: number;
  let revisionAfterReconnect: number | undefined;
  let initialRevision = 0;
  let manualDamageCount = 0;
  let chooseObserved = false;
  let crossSeatPrivateChoiceLeak = false;
  const actionKinds: string[] = [];
  const phases = new Set<string>();
  const phaseByControl: Readonly<Record<string, string>> = {
    'online-create-shared': 'room/decks',
    'online-submit-deck': 'room/decks',
    'online-ready-toggle': 'room/decks',
    'online-start-game': 'room/decks',
    'pregame-confirm-commanders': 'pregame',
    'pregame-keep': 'pregame',
    'pregame-complete-actions': 'pregame',
    'pregame-ready': 'pregame',
    'online-journey-play-land': 'land',
    'online-journey-cast-spell': 'cast',
    'online-remote-hold': 'HOLD',
    'online-remote-pass': 'response/pass/resolve',
    'online-remote-resolve': 'response/pass/resolve',
    'online-priority-hold': 'HOLD',
    'online-priority-advance': 'response/pass/resolve',
    'online-advance-to-main': 'response/pass/resolve',
    'online-priority-resolve': 'response/pass/resolve',
    'online-manual-damage-submit': 'combat/manual damage',
    'online-tabletop-submit-stack-entry': 'unsupported Manual Stack/Resolve',
    'online-tabletop-submit-manual-resolve': 'unsupported Manual Stack/Resolve',
    'online-remote-guided-overlay': 'combat/manual damage',
  'online-remote-manual-overlay': 'unsupported Manual Stack/Resolve',
    'online-guided-declare-attacker': 'combat/manual damage',
    'visibility-look': 'private Look/Choose',
    'visibility-confirm': 'private Look/Choose',
  };
  const actionByControl = (testId: string): string => testId
    .replace(/^online-/, '')
    .replace(/^pregame-/, 'pregame-')
    .replace(/-/g, '_');
  const recordControl = (testId: string) => {
    actionKinds.push(actionByControl(testId));
    const phase = phaseByControl[testId];
    if (phase !== undefined) phases.add(phase);
  };
  try {
    // Create the host first.  All subsequent seat setup is still performed by
    // visible join/deck/ready controls in their isolated browser contexts.
    const hostContext = await browser.createBrowserContext(); contexts.push(hostContext);
    const hostPage = await hostContext.createPage(); pages.push(hostPage);
    pageSetSecret(hostPage, secretFragments);
    await hostPage.navigate(pagesOrigin);
    const lobby = await probePage(hostPage, timeoutMs, workerOrigin, secretFragments);
    if (lobby.gameScreens > 1 || lobby.overflow !== 0 || lobby.opponentLeak || lobby.consoleErrors !== 0) throw new Error('production lobby probe failed');
    await clickVisible(hostPage, 'online-create-shared', timeoutMs); recordControl('online-create-shared');
    await clickButtonByText(hostPage, 'コードを表示', timeoutMs);
    const invite = await readInvite(hostPage, timeoutMs);
    if (!safeString(invite)) throw new Error('invite value malformed');
    // Invite values are runtime-only and become scanner fragments; they never
    // enter the evidence summary.
    secretFragments.push(invite);
    await clickVisible(hostPage, 'online-submit-deck', timeoutMs); recordControl('online-submit-deck');
    await clickVisible(hostPage, 'online-ready-toggle', timeoutMs); recordControl('online-ready-toggle');

    for (let index = 1; index < playerCount; index += 1) {
      const context = await browser.createBrowserContext(); contexts.push(context);
      const page = await context.createPage(); pages.push(page);
      pageSetSecret(page, secretFragments);
      await page.navigate(pagesOrigin);
      const initial = await probePage(page, timeoutMs, workerOrigin, secretFragments);
      if (initial.gameScreens > 1 || initial.overflow !== 0 || initial.opponentLeak || initial.consoleErrors !== 0) throw new Error('production join probe failed');
      await clickVisible(page, 'online-open-join', timeoutMs);
      await fillVisible(page, 'online-shared-invite', invite, timeoutMs);
      await clickVisible(page, 'online-join-shared', timeoutMs);
      await clickVisible(page, 'online-submit-deck', timeoutMs); recordControl('online-submit-deck');
      await clickVisible(page, 'online-ready-toggle', timeoutMs); recordControl('online-ready-toggle');
    }
    await clickVisible(hostPage, 'online-start-game', timeoutMs); recordControl('online-start-game');
    for (const page of pages) {
      const started = await probePage(page, timeoutMs, workerOrigin, secretFragments);
      if (started.gameScreens > 1 || started.overflow !== 0 || started.opponentLeak || started.consoleErrors !== 0) throw new Error('started shared surface probe failed');
      if (page === hostPage) initialRevision = started.revision;
    }

    for (const page of pages) {
      for (const testId of PREGAME_SEQUENCE) {
        await clickVisible(page, testId, timeoutMs); recordControl(testId);
      }
    }

    // Pregame and game controls are driven on the host surface after every
    // seat has joined.  Each successful click is recorded as an observed
    // action; missing/disabled controls fail closed.
    for (const testId of UI_SEQUENCE) {
      if (testId === 'online-advance-to-main') {
        await advanceUntilPhase(hostPage, 'main1', workerOrigin, timeoutMs, secretFragments);
        recordControl(testId);
        continue;
      }
      if (testId === 'online-journey-play-land') await selectFirstVisibleOption(hostPage, 'online-journey-land', timeoutMs);
      if (testId === 'online-journey-cast-spell') await selectFirstVisibleOption(hostPage, 'online-journey-spell', timeoutMs);
      if (testId === 'online-remote-advance') {
        // The first priority cycle is completed before entering combat. HOLD,
        // pass and resolve remain legal actions for their current seat only.
        const holdRevision = await clickAndAwaitRevision(hostPage, 'online-remote-hold', workerOrigin, timeoutMs, secretFragments); recordControl('online-remote-hold');
        await clickAndAwaitRevision(hostPage, 'online-remote-hold', workerOrigin, timeoutMs, secretFragments); recordControl('online-remote-hold');
        await clickAndAwaitRevision(hostPage, 'online-remote-pass', workerOrigin, timeoutMs, secretFragments); recordControl('online-remote-pass');
        for (const page of pages.slice(1)) {
          await clickAndAwaitRevision(page, 'online-remote-pass', workerOrigin, timeoutMs, secretFragments); recordControl('online-remote-pass');
        }
        await clickAndAwaitRevision(hostPage, 'online-remote-resolve', workerOrigin, timeoutMs, secretFragments); recordControl('online-remote-resolve');
        if (holdRevision <= 0) throw new Error('HOLD acknowledgement missing');
        await advanceUntilPhase(hostPage, 'combat', workerOrigin, timeoutMs, secretFragments);
        recordControl(testId);
        continue;
      }
      if (testId === 'online-guided-declare-attacker') {
        await selectFirstVisibleSelector(hostPage, '[data-testid="guided-combat"] form:nth-of-type(1) select:nth-of-type(1)', timeoutMs);
        await selectFirstVisibleSelector(hostPage, '[data-testid="guided-combat"] form:nth-of-type(1) select:nth-of-type(2)', timeoutMs);
        const baseline = (await probePage(hostPage, timeoutMs, workerOrigin, secretFragments)).revision;
        await clickVisibleSelector(hostPage, '[data-testid="guided-combat"] form:nth-of-type(1) button[type="submit"]', timeoutMs);
        await clickVisibleSelector(hostPage, '[data-testid="guided-confirmation"] button:last-of-type', timeoutMs);
        await waitForRevisionAdvance(hostPage, workerOrigin, baseline, timeoutMs, secretFragments);
        recordControl(testId);
        continue;
      }
      if (testId === 'online-manual-damage-submit') {
        await selectFirstVisibleOption(hostPage, 'online-manual-damage-defender', timeoutMs);
        // First combat damage is deliberately nonlethal; the final repeated
        // entry (after private/manual semantics) is the lethal branch.
        await fillVisible(hostPage, 'online-manual-damage-amount', manualDamageCount === 0 ? '1' : '120', timeoutMs);
        manualDamageCount += 1;
      }
      if (testId === 'online-tabletop-submit-stack-entry') {
        await fillVisible(hostPage, 'online-tabletop-stack-entry-id', 'manual-stack-entry', timeoutMs);
        await fillVisible(hostPage, 'online-tabletop-stack-label', '公開手動項目', timeoutMs);
      }
      if (testId === 'visibility-look') {
        await selectFirstVisibleOption(hostPage, 'visibility-look-subject', timeoutMs);
        await selectFirstVisibleOption(hostPage, 'visibility-look-viewers', timeoutMs);
      }
      if (testId === 'online-remote-guided-overlay' || testId === 'online-remote-manual-overlay') await toggleDetails(hostPage, testId, timeoutMs);
      const actionBaseline = REVISION_CONTROLS.has(testId) ? (await probePage(hostPage, timeoutMs, workerOrigin, secretFragments)).revision : null;
      await clickVisible(hostPage, testId, timeoutMs); recordControl(testId);
      if (actionBaseline !== null) await waitForRevisionAdvance(hostPage, workerOrigin, actionBaseline, timeoutMs, secretFragments);
      if (testId === 'visibility-look') {
        const confirmBaseline = (await probePage(hostPage, timeoutMs, workerOrigin, secretFragments)).revision;
        await clickVisible(hostPage, 'visibility-confirm', timeoutMs); recordControl('visibility-confirm');
        await waitForRevisionAdvance(hostPage, workerOrigin, confirmBaseline, timeoutMs, secretFragments);

        // Choose must be observed and completed while the match is still
        // active.  Capture opaque identifiers on the authorized seat only,
        // then verify no other seat renders one of those controls.  The IDs
        // are runtime-only and never enter the evidence summary.
        const chooseProbe = await probePage(hostPage, timeoutMs, workerOrigin, secretFragments);
        const privateChoicePayload = await readPrivateChoicePayload(hostPage, timeoutMs);
        if (!chooseProbe.chooseControl || privateChoicePayload.identifiers.length === 0) throw new Error('private choose control not rendered');
        chooseObserved = true;
        for (const page of pages) {
          if (page === hostPage) continue;
          const otherPayload = await readPrivateChoicePayload(page, timeoutMs);
          const candidateTokens = [...privateChoicePayload.identifiers, ...privateChoicePayload.candidateHandles];
          const otherSurfaces = await readUnauthorizedDomSurfaces(page, timeoutMs);
          const tokenLeak = candidateTokens.some((token) => token.length >= 4 && otherSurfaces.some((surface) => surface.includes(token)));
          if (tokenLeak || otherPayload.digest === privateChoicePayload.digest) {
            crossSeatPrivateChoiceLeak = true;
            throw new Error('cross-seat private choice leak');
          }
          const otherProbe = await probePage(page, timeoutMs, workerOrigin, secretFragments);
          if (otherProbe.opponentLeak) {
            crossSeatPrivateChoiceLeak = true;
            throw new Error('cross-seat private choice leak');
          }
        }
        const chooseBaseline = chooseProbe.revision;
        await clickFirstVisiblePrefix(hostPage, 'visibility-choose-', timeoutMs); recordControl('visibility-choose-');
        await waitForRevisionAdvance(hostPage, workerOrigin, chooseBaseline, timeoutMs, secretFragments);
      }
    }

    const postActions = await waitForJourneyEvidence(hostPage, playerCount, workerOrigin, initialRevision, timeoutMs, secretFragments);
    revisionBeforeReconnect = postActions.revision;
    if (postActions.gameScreens !== 1 || postActions.overflow !== 0 || postActions.opponentLeak || postActions.consoleErrors !== 0 || !postActions.workerObserved) throw new Error('post-action surface/worker probe failed');

    // Resize the actual page and collect measured DOM facts rather than
    // asserting a constant viewport matrix.
    if (hostPage.setViewport === undefined) throw new Error('viewport adapter required');
    const measuredViewports: O4p09iViewportFactV1[] = [];
    for (const viewport of VIEWPORTS) {
      await hostPage.setViewport(viewport);
      const measured = await probePage(hostPage, timeoutMs, workerOrigin, secretFragments);
      const geometry = measured.geometry;
      if (measured.gameScreens !== 1 || measured.overflow !== 0 || measured.consoleErrors !== 0 || measured.opponentLeak || !measured.workerObserved || geometry.viewport.width !== viewport.width || geometry.viewport.height !== viewport.height || geometry.rail === null || geometry.hand === null || geometry.battlefield === null || geometry.primaryAction === null || geometry.panel === null || geometry.scroll === null || geometry.primaryAction.enabled !== true || geometry.clippedPrimaryAction || geometry.railHandCollision || geometry.panelOutsideViewport || !geometry.scrollAccessible || geometry.battlefieldObscured) throw new Error('responsive surface/geometry/worker probe failed');
      measuredViewports.push(Object.freeze({ width: viewport.width, height: viewport.height, horizontalOverflow: measured.overflow, gameScreens: measured.gameScreens, consoleErrors: measured.consoleErrors, geometry }));
    }
    const viewportFacts = Object.freeze(measuredViewports);

    const disconnectedPage = pages[0];
    await disconnectedPage.close(); counters.pagesClosed += 1;
    const replacement = await contexts[0]?.createPage();
    if (replacement === undefined) throw new Error('reconnect page missing');
    pages[0] = replacement;
    pageSetSecret(replacement, secretFragments);
    await replacement.navigate(pagesOrigin);
    const recovered = await probePage(replacement, timeoutMs, workerOrigin, secretFragments);
    revisionAfterReconnect = recovered.revision;
    if (!safeRevision(revisionAfterReconnect) || recovered.gameScreens !== 1 || recovered.overflow !== 0 || recovered.opponentLeak || recovered.consoleErrors !== 0 || !recovered.workerObserved || revisionAfterReconnect < revisionBeforeReconnect) throw new Error('reconnect continuity probe failed');
    const consoleCounts = pages.reduce((totals, current) => {
      const value = current.consoleCounts();
      return { errors: totals.errors + value.errors, warnings: totals.warnings + value.warnings, secretViolations: totals.secretViolations + (value.secretViolations ?? 0) };
    }, { errors: 0, warnings: 0, secretViolations: 0 });
    if (consoleCounts.errors !== 0 || consoleCounts.warnings !== 0 || consoleCounts.secretViolations !== 0) throw new Error('browser console or secret violation observed');
    phases.add('disconnect/reconnect');
    if (phases.size !== MATCH_PHASES.length || MATCH_PHASES.some((phase) => !phases.has(phase))) throw new Error('journey phases incomplete');
    const privateLookChoose: O4p09iScenarioFactV1['privateLookChoose'] = Object.freeze({ look: postActions.privateLookControl as true, choose: chooseObserved as true, crossSeatLeak: crossSeatPrivateChoiceLeak });
    const unsupportedManual: O4p09iScenarioFactV1['unsupportedManual'] = Object.freeze({ stack: postActions.manualStackControl as true, resolve: postActions.manualResolveControl as true });
    return Object.freeze({
      playerCount,
      phases: Object.freeze(MATCH_PHASES.filter((phase) => phases.has(phase))),
      actionKinds: Object.freeze(actionKinds),
      revision: Object.freeze({ start: 0, afterSharedMutation: revisionBeforeReconnect, afterReconnect: revisionAfterReconnect ?? revisionBeforeReconnect, continuous: true }),
      privateLookChoose,
      unsupportedManual,
      outcome: playerCount === 2 ? 'winner' : 'three-continue',
      eliminatedSeats: Object.freeze(postActions.eliminatedSeats),
      viewportFacts,
    });
  } finally {
    for (const page of pages) {
      try { await page.close(); counters.pagesClosed += 1; } catch { /* cleanup is checked by aggregate count */ }
    }
    for (const context of contexts) {
      try { await context.close(); counters.contextsClosed += 1; } catch { /* cleanup is checked by aggregate count */ }
    }
  }
}

function pageSetSecret(page: O4p09iPageV1, fragments: readonly string[]): void { page.setSecretFragments?.(fragments); }

export async function runO4p09iFullMatchEvidenceV1(inputDeps: O4p09iEvidenceDepsV1 = {}): Promise<O4p09iEvidenceSummaryV1> {
  const timeoutMs = inputDeps.timeoutMs ?? 15_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 250 || timeoutMs > 120_000) throw new Error('invalid evidence timeout');
  const pagesOrigin = inputDeps.pagesOrigin ?? O4P09I_PAGES_ORIGIN_V1;
  const workerOrigin = inputDeps.workerOrigin ?? O4P09I_WORKER_ORIGIN_V1;
  if (pagesOrigin !== O4P09I_PAGES_ORIGIN_V1 || workerOrigin !== O4P09I_WORKER_ORIGIN_V1) throw new Error('production origins are pinned');
  const browser = inputDeps.browser ?? (inputDeps.launchBrowser ? await inputDeps.launchBrowser() : await defaultBrowser(timeoutMs));
  if (browser === null) throw new Error('browser dependency required for production evidence');
  const secretFragments: string[] = [];
  const counters = { contextsClosed: 0, pagesClosed: 0 };
  let scenarios: Readonly<{ readonly twoPlayer: O4p09iScenarioFactV1; readonly fourPlayer: O4p09iScenarioFactV1 }>;
  try {
    const readDeck = inputDeps.readDeck ?? ((path: string) => readFileSync(resolve(process.cwd(), path), 'utf8'));
    for (const path of ['Mydeck/Celes.txt', 'Mydeck/Gogo.txt', 'Mydeck/Kefka.txt', 'Mydeck/Muldrotha.txt']) {
      const text = readDeck(path);
      if (typeof text !== 'string' || text.length === 0) throw new Error('deck input missing');
      secretFragments.push(sha256(text).slice(0, 16));
    }
    scenarios = Object.freeze({
      twoPlayer: await driveScenario(browser, 2, pagesOrigin, workerOrigin, timeoutMs, secretFragments, counters),
      fourPlayer: await driveScenario(browser, 4, pagesOrigin, workerOrigin, timeoutMs, secretFragments, counters),
    });
  } finally {
    // A browser/profile close failure invalidates the run; never emit a
    // summary that claims cleanup succeeded when the adapter did not close.
    await browser.close();
  }
  const profileRemoved = browser.profilePath === undefined || !existsSync(browser.profilePath);
  if (!profileRemoved) throw new Error('browser profile cleanup incomplete');
  const summary: O4p09iEvidenceSummaryV1 = Object.freeze({
    kind: 'o4p-09i-full-match-production-evidence-v1', schemaVersion: 1,
    pagesOrigin: O4P09I_PAGES_ORIGIN_V1, workerOrigin: O4P09I_WORKER_ORIGIN_V1,
    chromeVersion: browser.chromeVersion,
    scenarios, consoleCounts: Object.freeze({ errors: 0 as const, warnings: 0 as const, secretViolations: 0 as const }),
    cleanup: Object.freeze({ contextsClosed: counters.contextsClosed, pagesClosed: counters.pagesClosed, profileRemoved: true as const }),
  });
  const checked = validateO4p09iFullMatchEvidenceV1(summary, secretFragments);
  if (!checked.ok) throw new Error(checked.issues[0] ?? 'evidence summary invalid');
  return checked.value;
}

async function main(): Promise<void> {
  const summary = await runO4p09iFullMatchEvidenceV1();
  output.write(`${JSON.stringify(canonical(summary))}\n`);
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) void main().catch(() => { process.exitCode = 1; });
