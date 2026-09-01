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
import { existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { stdout as output } from 'node:process';
import { launchO4p06fCdpBrowserV1, type O4p06fBrowserV1, type O4p06fPageV1 } from './o4p-06f-four-browser-evidence';
import {
  validateRemoteCastJourneyObservationV1,
  type RemoteCastJourneyFactV1,
} from './remote-cast-journey-evidence';
import {
  validateRemotePriorityJourneyObservationV1,
  type RemotePriorityJourneyFactV1,
  type RemotePriorityJourneyObservationV1,
} from './remote-priority-journey-evidence';

export const O4P09I_PAGES_ORIGIN_V1 = 'https://makeinu1.github.io/MTG_OneDeck/' as const;
export const O4P09I_WORKER_ORIGIN_V1 = 'https://mtg-onedeck-online.makeinu1.workers.dev' as const;

export type O4p09iProductionFailureV1 = Readonly<{
  readonly class: 'IMPLEMENTATION' | 'ENVIRONMENT' | 'EVIDENCE';
  readonly code: string;
  readonly stage: string;
}>;

const ENVIRONMENT_FAILURE_STAGES = Object.freeze({
  browser: 'browser',
  'visible-ui-operation': 'visible-ui-operation',
  'progress-probe': 'progress-probe',
  'priority-probe': 'priority-probe',
  'start-probe': 'start-probe',
  'start-terminal-probe': 'start-terminal-probe',
  'deck-input': 'deck-input',
  'import-click': 'import-click',
  'saved-state': 'saved-state',
  'online-open': 'online-open',
  'manual-resolve-probe': 'manual-resolve-probe',
  'manual-stack-probe': 'manual-stack-probe'
} as const);

/** Normalize runner failures for the parent harness without exposing error text. */
export function classifyO4p09iProductionFailureV1(error: unknown): O4p09iProductionFailureV1 {
  const message = error instanceof Error ? error.message : '';
  if (message.startsWith('production environment failure:')) {
    const detail = message.slice('production environment failure:'.length).trim();
    return Object.freeze({
      class: 'ENVIRONMENT',
      code: 'BROWSER_ENVIRONMENT_UNAVAILABLE',
      stage: Object.hasOwn(ENVIRONMENT_FAILURE_STAGES, detail)
        ? ENVIRONMENT_FAILURE_STAGES[detail as keyof typeof ENVIRONMENT_FAILURE_STAGES]
        : 'setup'
    });
  }
  const scenario = /^production scenario stage failed: ([a-zA-Z0-9/_-]+)/u.exec(message)?.[1];
  if (
    scenario !== undefined &&
    (SCENARIO_STAGES as readonly string[]).includes(scenario.split('/')[0] ?? '')
  ) {
    const rootStage = scenario.split('/')[0] ?? 'journey';
    const detail = scenario.slice(rootStage.length + 1);
    const stage = rootStage === 'start-probe' && (STARTED_SURFACE_FAILURES as readonly string[]).includes(detail)
      || rootStage === 'manual-stack' && (detail === 'entry' || detail === 'resolve')
      ? scenario
      : rootStage;
    return Object.freeze({
      class: 'IMPLEMENTATION',
      code: 'PLAYER_JOURNEY_STAGE_FAILED',
      stage
    });
  }
  if (message.startsWith('production UI stage failed:'))
    return Object.freeze({
      class: 'IMPLEMENTATION',
      code: 'PLAYER_ENTRY_STAGE_FAILED',
      stage: 'import'
    });
  if (/(?:console|secret|privacy)/iu.test(message))
    return Object.freeze({
      class: 'IMPLEMENTATION',
      code: 'PRIVACY_OR_CONSOLE_FAILED',
      stage: 'privacy'
    });
  if (/(?:cleanup|profile|summary|canonical|validation|evidence)/iu.test(message))
    return Object.freeze({ class: 'EVIDENCE', code: 'EVIDENCE_HARNESS_FAILED', stage: 'harness' });
  if (
    /(?:CDP|Chrome|WebSocket|system WebSocket|browser launch|launcher unavailable)/iu.test(message)
  )
    return Object.freeze({
      class: 'ENVIRONMENT',
      code: 'BROWSER_ENVIRONMENT_UNAVAILABLE',
      stage: 'setup'
    });
  return Object.freeze({ class: 'EVIDENCE', code: 'EVIDENCE_HARNESS_FAILED', stage: 'harness' });
}

function rethrowProductionEnvironmentFailure(error: unknown, stage: string): void {
  if (classifyO4p09iProductionFailureV1(error).class === 'ENVIRONMENT') {
    throw new Error(`production environment failure: ${stage}`, { cause: error });
  }
}

export function writeO4p09iJourneyFailureV1(
  target: unknown,
  error: unknown,
  temporaryRoot = tmpdir()
): boolean {
  const resolvedTarget = resolveO4p09iJourneyResultPathV1(target, temporaryRoot);
  if (resolvedTarget === null) return false;
  try {
    writeFileSync(resolvedTarget, `${JSON.stringify(classifyO4p09iProductionFailureV1(error))}\n`, {
      flag: 'wx',
      mode: 0o600,
      encoding: 'utf8'
    });
    return true;
  } catch {
    return false;
  }
}

export function resolveO4p09iJourneyResultPathV1(
  target: unknown,
  temporaryRoot = tmpdir()
): string | null {
  if (typeof target !== 'string' || target.length === 0) return null;
  const root = resolve(temporaryRoot);
  const resolvedTarget = resolve(target);
  const segments = relative(root, resolvedTarget).split(/[\\/]/u);
  if (segments.length !== 1 || segments[0] !== 'failure.json') return null;
  return resolvedTarget;
}
// A real 100-card import can require several seconds of visible resolution
// and IndexedDB persistence. Keep the production default bounded below the
// public 120s ceiling while leaving injected test browsers fast.
export const O4P09I_DEFAULT_TIMEOUT_MS_V1 = 60_000 as const;
export const O4P09I_START_SURFACE_TIMEOUT_MS_V1 = 120_000 as const;
/** Public, deterministic fixtures used only when no test seam is injected. */
export const O4P09I_PUBLIC_DECK_TEXTS_V1 = Object.freeze([
  'Commander\n1 Celes, Rune Knight\n\nDeck\n49 Plains\n50 Mother of Runes',
  'Commander\n1 Gogo, Master of Mimicry\n\nDeck\n49 Island\n50 Omen Hawker',
  'Commander\n1 Kefka, Court Mage\n\nDeck\n49 Mountain\n50 Ragavan, Nimble Pilferer',
  'Commander\n1 Muldrotha, the Gravetide\n\nDeck\n49 Forest\n50 Spore Frog',
] as const);
const VIEWPORTS = Object.freeze([
  Object.freeze({ width: 375, height: 812 }),
  Object.freeze({ width: 812, height: 375 }),
  Object.freeze({ width: 1440, height: 900 }),
] as const);
const UI_SEQUENCE = Object.freeze([
  'online-remote-guided-overlay',
  'online-advance-to-main',
  'online-journey-play-land',
  'online-remote-cast',
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
const STAGE_HANDLED_UI_CONTROLS = new Set<string>([
  'online-advance-to-main', 'online-remote-sba-stable', 'online-journey-play-land', 'online-remote-cast', 'online-remote-advance',
  'online-guided-declare-attacker', 'online-manual-damage-submit', 'online-tabletop-submit-stack-entry',
  'online-tabletop-submit-manual-resolve', 'visibility-look', 'online-remote-guided-overlay', 'online-remote-manual-overlay',
]);
const PREGAME_SEQUENCE = Object.freeze([
  'pregame-confirm-commanders', 'pregame-keep', 'pregame-complete-actions', 'pregame-ready',
] as const);
const REVISION_CONTROLS = new Set<string>([
  'online-journey-play-land', 'online-remote-cast', 'online-manual-damage-submit',
  'online-remote-advance', 'online-remote-sba-stable', 'online-tabletop-submit-stack-entry', 'online-tabletop-submit-manual-resolve',
  'visibility-confirm', 'visibility-choose-',
]);
const MATCH_PHASES = Object.freeze([
  'room/decks', 'pregame', 'land', 'cast', 'HOLD', 'response/pass/resolve',
  'combat/manual damage', 'private Look/Choose', 'unsupported Manual Stack/Resolve',
  'disconnect/reconnect',
] as const);
const SCENARIO_STAGES = Object.freeze([
  'import', 'lobby-probe', 'create-room', 'reveal-invite', 'read-invite', 'host-deck-submit', 'host-ready',
  'join-seat-import', 'join-seat-join', 'join-seat-deck', 'join-seat-ready', 'start-game', 'start-probe',
  'pregame-control', 'advance', 'land', 'cast', 'HOLD-pass-resolve', 'attacker', 'manual-damage', 'manual-stack',
  'visibility', 'private-leak-check', 'ui-action', 'post-actions', 'viewport-geometry', 'reconnect', 'finalize',
] as const);
type O4p09iScenarioStageV1 = (typeof SCENARIO_STAGES)[number];
const STARTED_SURFACE_FAILURES = Object.freeze([
  'game-screen-missing/count', 'horizontal-overflow', 'opponent-leak', 'console-error', 'host-revision-missing',
  'start-rejected', 'start-pending', 'start-not-accepted',
] as const);
type O4p09iStartedSurfaceFailureV1 = (typeof STARTED_SURFACE_FAILURES)[number];
const MAX_SUMMARY_BYTES = 131_072;
const MAX_TEXT_BYTES = 4_096;
const MAX_DOM_SCAN_NODES_V1 = 4_096;
const MAX_DOM_SCAN_ATTRIBUTES_V1 = 32;
const MAX_DOM_SCAN_BYTES_V1 = 262_144;
const MAX_RESOURCE_ENTRIES_V1 = 4_096;
const MAX_PRIVATE_ROOTS_V1 = 128;
const MAX_PRIVATE_ATTRIBUTES_PER_ROOT_V1 = 32;
const MAX_PRIVATE_VALUES_PER_ROOT_V1 = 32;
const MAX_PRIVATE_TOKENS_V1 = 512;
const MAX_PRIVATE_CAPTURE_BYTES_V1 = 65_536;
const PRODUCTION_UI_STAGE_ERRORS = Object.freeze({
  deckInput: 'production UI stage failed: deck input',
  importClick: 'production UI stage failed: deck import',
  savedState: 'production UI stage failed: deck saved state',
  storageUnavailable: 'production UI stage failed: deck storage unavailable',
  resolutionUnavailable: 'production UI stage failed: deck resolution unavailable',
  resolutionPending: 'production UI stage failed: deck resolution pending',
  notificationMissing: 'production UI stage failed: deck save notification missing',
  importRuntimeFailed: 'production UI stage failed: deck import runtime failed',
  importRuntimeError: 'production UI stage failed: deck import runtime error',
  productErrorBoundary: 'production UI stage failed: product error boundary',
  importSurfaceDisappeared: 'production UI stage failed: import surface disappeared',
  invalidWorkflow: 'production UI stage failed: invalid workflow state',
  onlineOpen: 'production UI stage failed: online entry',
} as const);

type JsonRecord = Record<string, unknown>;
type Primitive = null | boolean | number | string;
type JsonValue = Primitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

export type O4p09iPageV1 = Readonly<{
  readonly navigate: (url: string) => Promise<void>;
  readonly evaluate: <T>(expression: string, argument?: unknown) => Promise<T>;
  readonly setViewport?: (viewport: Readonly<{ readonly width: number; readonly height: number }>) => Promise<void> | void;
  readonly close: () => Promise<void> | void;
  readonly consoleCounts: () => Readonly<{ readonly errors: number; readonly warnings: number; readonly secretViolations?: number;
  }>;
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
  readonly pageGeometries: readonly O4p09iGeometryFactV1[];
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
  readonly scrollMoved: boolean;
  readonly focusReachable: boolean;
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
  readonly seatRects: readonly O4p09iRectV1[];
  readonly boardRects: readonly O4p09iRectV1[];
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
  readonly seatRects: readonly O4p09iRectV1[];
  readonly boardRects: readonly O4p09iRectV1[];
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
  readonly cast: RemoteCastJourneyFactV1;
  /** Two-seat priority is a separately governed evidence lane; four-seat stays explicit null. */
  readonly priority: RemotePriorityJourneyFactV1 | null;
  readonly revision: Readonly<{ readonly start: number; readonly afterSharedMutation: number; readonly afterReconnect: number; readonly continuous: true;
  }>;
  readonly reconnect: Readonly<{
    readonly revision: number;
    readonly peerObservedDisconnected: true;
    readonly recoveredSeatRejoined: true;
    readonly presenceConverged: true;
    readonly sharedPublicDigestConverged: true;
    readonly privateAudienceIsolated: true;
    readonly priorityStatePreserved: true;
  }>;
  readonly privateLookChoose: Readonly<{ readonly look: true; readonly choose: true; readonly crossSeatLeak: false;
  }>;
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
  readonly scenarios: Readonly<{ readonly twoPlayer: O4p09iScenarioFactV1; readonly fourPlayer: O4p09iScenarioFactV1;
  }>;
  readonly consoleCounts: Readonly<{ readonly errors: number; readonly warnings: number; readonly secretViolations: number;
  }>;
  readonly cleanup: Readonly<{ readonly contextsClosed: number; readonly pagesClosed: number; readonly profileRemoved: true;
  }>;
}>;

export type O4p09iSyntheticEvidenceSummaryV1 = Readonly<Omit<O4p09iEvidenceSummaryV1, 'kind'> & {
  readonly kind: 'o4p-09i-full-match-test-evidence-v1';
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
  return (
    value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Reflect.getPrototypeOf(value) === Object.prototype || Reflect.getPrototypeOf(value) === null)
  );
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
  if (typeof value === 'string') return (
      fragments.some((fragment) => fragment.length >= 8 && value.includes(fragment)) || /^(?:seat|invite|observer|cap)[_-][A-Za-z0-9_-]{8,}$/u.test(value)
    );
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

function rectSignature(rects: readonly O4p09iRectV1[]): string {
  return rects.map((rect) => [rect.x, rect.y, rect.width, rect.height, rect.right, rect.bottom].join(',')).join('|');
}

function cloneRect(rect: O4p09iRectV1): O4p09iRectV1 { return Object.freeze({ ...rect }); }

function cloneGeometry(geometry: O4p09iGeometryFactV1): O4p09iGeometryFactV1 {
  return Object.freeze({
    ...geometry,
    viewport: cloneRect(geometry.viewport),
    rail: geometry.rail === null ? null : cloneRect(geometry.rail),
    hand: geometry.hand === null ? null : cloneRect(geometry.hand),
    battlefield: geometry.battlefield === null ? null : cloneRect(geometry.battlefield),
    seatRects: Object.freeze(geometry.seatRects.map(cloneRect)),
    boardRects: Object.freeze(geometry.boardRects.map(cloneRect)),
    primaryAction: geometry.primaryAction === null ? null : Object.freeze({ rect: cloneRect(geometry.primaryAction.rect), enabled: true as const }),
    panel: geometry.panel === null ? null : cloneRect(geometry.panel),
    scroll: geometry.scroll === null ? null : Object.freeze({
      rect: cloneRect(geometry.scroll.rect),
      scrollWidth: geometry.scroll.scrollWidth,
      scrollHeight: geometry.scroll.scrollHeight,
      clientWidth: geometry.scroll.clientWidth,
      clientHeight: geometry.scroll.clientHeight,
      scrollMoved: geometry.scroll.scrollMoved,
      focusReachable: geometry.scroll.focusReachable,
    }),
  });
}

function safeRevision(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isSafeInteger(value) && !Object.is(value, -0) && value >= 0
  );
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
  const row = exact(value, ['viewport', 'rail', 'hand', 'battlefield', 'seatRects', 'boardRects', 'primaryAction', 'panel', 'scroll', 'clippedPrimaryAction', 'railHandCollision', 'panelOutsideViewport', 'scrollAccessible', 'battlefieldObscured'], `geometry ${index} malformed`);
  const viewport = validateRect(own(row, 'viewport'), `geometry ${index}.viewport`);
  const railValue = own(row, 'rail');
  const handValue = own(row, 'hand');
  const battlefieldValue = own(row, 'battlefield');
  const panelValue = own(row, 'panel');
  const rail = railValue === null ? null : validateRect(railValue, `geometry ${index}.rail`);
  const hand = handValue === null ? null : validateRect(handValue, `geometry ${index}.hand`);
  const battlefield = battlefieldValue === null ? null : validateRect(battlefieldValue, `geometry ${index}.battlefield`);
  const seatValues = own(row, 'seatRects');
  const boardValues = own(row, 'boardRects');
  if (!Array.isArray(seatValues) || !Array.isArray(boardValues)) throw new Error(`geometry ${index} public lane rectangles malformed`);
  const seatRects = Object.freeze(seatValues.map((entry, rectIndex) => validateRect(entry, `geometry ${index}.seatRects.${rectIndex}`)));
  const boardRects = Object.freeze(boardValues.map((entry, rectIndex) => validateRect(entry, `geometry ${index}.boardRects.${rectIndex}`)));
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
    const scrollRow = exact(scrollValue, ['rect', 'scrollWidth', 'scrollHeight', 'clientWidth', 'clientHeight', 'scrollMoved', 'focusReachable'], `geometry ${index}.scroll malformed`);
    const scrollWidth = boundedNumber(own(scrollRow, 'scrollWidth'), `geometry ${index}.scroll.scrollWidth`);
    const scrollHeight = boundedNumber(own(scrollRow, 'scrollHeight'), `geometry ${index}.scroll.scrollHeight`);
    const clientWidth = boundedNumber(own(scrollRow, 'clientWidth'), `geometry ${index}.scroll.clientWidth`);
    const clientHeight = boundedNumber(own(scrollRow, 'clientHeight'), `geometry ${index}.scroll.clientHeight`);
    const scrollMoved = own(scrollRow, 'scrollMoved');
    const focusReachable = own(scrollRow, 'focusReachable');
    if (scrollMoved !== true || focusReachable !== true) throw new Error(`geometry ${index}.scroll interaction unavailable`);
    if (scrollWidth <= 0 || scrollHeight <= 0 || clientWidth <= 0 || clientHeight <= 0) throw new Error(`geometry ${index}.scroll dimensions invalid`);
    scroll = Object.freeze({ rect: validateRect(own(scrollRow, 'rect'), `geometry ${index}.scroll.rect`), scrollWidth, scrollHeight, clientWidth, clientHeight, scrollMoved, focusReachable });
  }
  const clippedPrimaryAction = own(row, 'clippedPrimaryAction');
  const railHandCollision = own(row, 'railHandCollision');
  const panelOutsideViewport = own(row, 'panelOutsideViewport');
  const scrollAccessible = own(row, 'scrollAccessible');
  const battlefieldObscured = own(row, 'battlefieldObscured');
  if (typeof clippedPrimaryAction !== 'boolean' || typeof railHandCollision !== 'boolean' || typeof panelOutsideViewport !== 'boolean' || typeof scrollAccessible !== 'boolean' || typeof battlefieldObscured !== 'boolean') throw new Error(`geometry ${index} flags malformed`);
  if (rail === null || hand === null || battlefield === null || seatRects.length === 0 || boardRects.length === 0 || primaryAction === null || panel === null || scroll === null || clippedPrimaryAction || railHandCollision || panelOutsideViewport || !scrollAccessible || battlefieldObscured) throw new Error(`geometry ${index} failed`);
  return Object.freeze({ viewport, rail, hand, battlefield, seatRects, boardRects, primaryAction, panel, scroll, clippedPrimaryAction, railHandCollision, panelOutsideViewport, scrollAccessible, battlefieldObscured });
}

function validateViewport(value: unknown, index: number, expectedPlayers: 2 | 4): O4p09iViewportFactV1 {
  const row = exact(value, ['width', 'height', 'horizontalOverflow', 'gameScreens', 'consoleErrors', 'geometry', 'pageGeometries'], `viewport ${index} malformed`);
  const width = own(row, 'width'); const height = own(row, 'height');
  const expected = VIEWPORTS[index];
  if (width !== expected?.width || height !== expected?.height || own(row, 'horizontalOverflow') !== 0 || own(row, 'gameScreens') !== 1 || own(row, 'consoleErrors') !== 0) throw new Error(`viewport ${index} failed`);
  const geometry = validateGeometry(own(row, 'geometry'), index);
  if (geometry.viewport.width !== width || geometry.viewport.height !== height) throw new Error(`viewport ${index} geometry viewport mismatch`);
  const pageValues = own(row, 'pageGeometries');
  if (!Array.isArray(pageValues) || pageValues.length !== expectedPlayers) throw new Error(`viewport ${index} page geometry count mismatch`);
  const pageGeometries = Object.freeze(pageValues.map((entry, pageIndex) => validateGeometry(entry, index * expectedPlayers + pageIndex)));
  if (pageGeometries.some((entry) => entry.viewport.width !== width || entry.viewport.height !== height || entry.seatRects.length !== expectedPlayers - 1 || entry.boardRects.length !== expectedPlayers - 1)) throw new Error(`viewport ${index} public lane geometry mismatch`);
  const normalizedWidth = width === 375 ? 375 : width === 812 ? 812 : 1440;
  const normalizedHeight = height === 812 ? 812 : height === 375 ? 375 : 900;
  return Object.freeze({ width: normalizedWidth, height: normalizedHeight, horizontalOverflow: 0, gameScreens: 1, consoleErrors: 0, geometry, pageGeometries });
}

function validateScenario(value: unknown, expectedPlayers: 2 | 4, fragments: readonly string[]): O4p09iScenarioFactV1 {
  const row = exact(value, ['playerCount', 'phases', 'actionKinds', 'cast', 'priority', 'revision', 'reconnect', 'privateLookChoose', 'unsupportedManual', 'outcome', 'eliminatedSeats', 'viewportFacts'], 'scenario malformed');
  if (own(row, 'playerCount') !== expectedPlayers) throw new Error('scenario player count mismatch');
  const phases = own(row, 'phases');
  if (!Array.isArray(phases) || phases.length !== MATCH_PHASES.length || phases.some((phase, index) => phase !== MATCH_PHASES[index])) throw new Error('scenario phases incomplete');
  const actionKinds = own(row, 'actionKinds');
  if (!Array.isArray(actionKinds) || actionKinds.length < 8 || actionKinds.some((kind) => typeof kind !== 'string')) throw new Error('scenario actions incomplete');
  const cast = exact(own(row, 'cast'), ['acceptedRevision', 'seatCount', 'receiptAccepted', 'revisionsConverged', 'sharedStackTop'], 'cast evidence malformed');
  const castAcceptedRevision = own(cast, 'acceptedRevision');
  if (!safeRevision(castAcceptedRevision) || own(cast, 'seatCount') !== expectedPlayers
    || own(cast, 'receiptAccepted') !== true || own(cast, 'revisionsConverged') !== true
    || own(cast, 'sharedStackTop') !== true) throw new Error('cast evidence failed');
  const priorityValue = own(row, 'priority');
  let priority: RemotePriorityJourneyFactV1 | null = null;
  if (expectedPlayers === 4) {
    if (priorityValue !== null) throw new Error('four-seat priority evidence must be null');
  } else {
    const priorityRow = exact(priorityValue, ['startRevision', 'resolvedRevision', 'seatCount', 'receiptsAccepted', 'revisionsConverged', 'holdConverged', 'priorityCycleComplete', 'capturedTopResolved'], 'priority evidence malformed');
    const startRevision = own(priorityRow, 'startRevision');
    const resolvedRevision = own(priorityRow, 'resolvedRevision');
    if (!safeRevision(startRevision) || !safeRevision(resolvedRevision) || resolvedRevision !== startRevision + 5
      || own(priorityRow, 'seatCount') !== 2 || own(priorityRow, 'receiptsAccepted') !== true
      || own(priorityRow, 'revisionsConverged') !== true || own(priorityRow, 'holdConverged') !== true
      || own(priorityRow, 'priorityCycleComplete') !== true || own(priorityRow, 'capturedTopResolved') !== true) {
      throw new Error('priority evidence failed');
    }
    priority = Object.freeze({ startRevision, resolvedRevision, seatCount: 2, receiptsAccepted: true, revisionsConverged: true, holdConverged: true, priorityCycleComplete: true, capturedTopResolved: true });
  }
  const revision = exact(own(row, 'revision'), ['start', 'afterSharedMutation', 'afterReconnect', 'continuous'], 'scenario revision malformed');
  const afterSharedMutation = own(revision, 'afterSharedMutation');
  const afterReconnect = own(revision, 'afterReconnect');
  const start = own(revision, 'start');
  if (!safeRevision(start) || !safeRevision(afterSharedMutation) || !safeRevision(afterReconnect) || start > afterSharedMutation || afterReconnect !== afterSharedMutation || own(revision, 'continuous') !== true) throw new Error('scenario revision continuity failed');
  const reconnect = exact(own(row, 'reconnect'), ['revision', 'peerObservedDisconnected', 'recoveredSeatRejoined', 'presenceConverged', 'sharedPublicDigestConverged', 'privateAudienceIsolated', 'priorityStatePreserved'], 'reconnect evidence malformed');
  if (own(reconnect, 'revision') !== afterReconnect
    || own(reconnect, 'peerObservedDisconnected') !== true
    || own(reconnect, 'recoveredSeatRejoined') !== true
    || own(reconnect, 'presenceConverged') !== true
    || own(reconnect, 'sharedPublicDigestConverged') !== true
    || own(reconnect, 'privateAudienceIsolated') !== true
    || own(reconnect, 'priorityStatePreserved') !== true) throw new Error('reconnect evidence failed');
  const privateFacts = exact(own(row, 'privateLookChoose'), ['look', 'choose', 'crossSeatLeak'], 'private choice facts malformed');
  if (own(privateFacts, 'look') !== true || own(privateFacts, 'choose') !== true || own(privateFacts, 'crossSeatLeak') !== false) throw new Error('private choice leak');
  const unsupported = exact(own(row, 'unsupportedManual'), ['stack', 'resolve'], 'manual fallback facts malformed');
  if (own(unsupported, 'stack') !== true || own(unsupported, 'resolve') !== true) throw new Error('manual fallback incomplete');
  const outcome = own(row, 'outcome');
  if (expectedPlayers === 2 ? outcome !== 'winner' : outcome !== 'three-continue') throw new Error('scenario outcome mismatch');
  const eliminated = own(row, 'eliminatedSeats');
  if (!Array.isArray(eliminated) || eliminated.length !== 1 || eliminated.some((seat) => typeof seat !== 'string') || new Set(eliminated).size !== 1) throw new Error('elimination facts malformed');
  const viewports = own(row, 'viewportFacts');
  if (!Array.isArray(viewports) || viewports.length !== VIEWPORTS.length) throw new Error('viewport matrix incomplete');
  const viewportFacts = Object.freeze(viewports.map((entry, index) => validateViewport(entry, index, expectedPlayers)));
  const normalized: O4p09iScenarioFactV1 = Object.freeze({
    playerCount: expectedPlayers,
    phases: Object.freeze(phases.map((phase) => String(phase))),
    actionKinds: Object.freeze(actionKinds.map((kind) => String(kind))),
    cast: Object.freeze({ acceptedRevision: castAcceptedRevision, seatCount: expectedPlayers, receiptAccepted: true, revisionsConverged: true, sharedStackTop: true }),
    priority,
    revision: Object.freeze({ start, afterSharedMutation, afterReconnect, continuous: true }),
    reconnect: Object.freeze({ revision: afterReconnect, peerObservedDisconnected: true, recoveredSeatRejoined: true, presenceConverged: true, sharedPublicDigestConverged: true, privateAudienceIsolated: true, priorityStatePreserved: true }),
    privateLookChoose: Object.freeze({ look: true, choose: true, crossSeatLeak: false }),
    unsupportedManual: Object.freeze({ stack: true, resolve: true }),
    outcome: outcome as 'winner' | 'three-continue',
    eliminatedSeats: Object.freeze(eliminated.map((seat) => String(seat))),
    viewportFacts,
  });
  if (containsSecret(normalized, fragments)) throw new Error('scenario secret violation');
  return normalized;
}

export function validateO4p09iFullMatchEvidenceV1(input: unknown, secretFragments: readonly string[] = []): Readonly<
  | { readonly ok: true; readonly value: O4p09iEvidenceSummaryV1 } | { readonly ok: false; readonly issues: readonly string[] }> {
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
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const clicked = await page.evaluate<boolean>(`(() => {
      const target = [...document.querySelectorAll('button')].find((node) => (node.textContent ?? '').trim().includes(${JSON.stringify(text)}));
      if (!(target instanceof HTMLButtonElement)) return false;
      const style = getComputedStyle(target); const rect = target.getBoundingClientRect();
      if (target.hidden || target.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') <= 0 || rect.width <= 0 || rect.height <= 0 || target.closest('details:not([open])') !== null || target.disabled) return false;
      target.click(); return true;
    })()`);
    if (clicked) return;
    if (Date.now() >= deadline) throw new Error(`text control ${text} timeout`);
    await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, Math.min(25, Math.max(1, deadline - Date.now()))));
  }
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

async function waitForVisible(page: O4p09iPageV1, testId: string, timeoutMs: number, failureTestId = ''): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    // Keep each CDP command synchronous and short. A page-side polling promise
    // can outlive the adapter's command deadline by a few milliseconds and
    // surface an opaque CDP timeout instead of the intended stage failure.
    const visible = await page.evaluate<boolean>(`(() => { // visibleControlProbe:${testId}
      const node = document.querySelector('[data-testid="${testId}"]');
      if (!(node instanceof HTMLElement)) return false;
      const style = getComputedStyle(node); const rect = node.getBoundingClientRect();
      return !node.hidden && node.getAttribute('aria-hidden') !== 'true' && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') > 0 && rect.width > 0 && rect.height > 0 && node.closest('details:not([open])') === null;
    })()`);
    if (visible) return;
    if (failureTestId !== '') {
      const failure = await page.evaluate<'retryable-error' | 'error' | 'none'>(`(() => { // visibleFailureStateProbe:${failureTestId}
        const node = document.querySelector('[data-testid="${failureTestId}"]');
        if (!(node instanceof HTMLElement)) return 'none';
        const style = getComputedStyle(node); const rect = node.getBoundingClientRect();
        if (node.hidden || node.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') <= 0 || rect.width <= 0 || rect.height <= 0 || node.closest('details:not([open])') !== null) return 'none';
        return [...node.querySelectorAll('button')].some((button) => !button.disabled) ? 'retryable-error' : 'error';
      })()`);
      if (failure === 'retryable-error') throw new Error('production environment failure: visible-ui-operation');
      if (failure === 'error') throw new Error('visible operation rejected');
    }
    if (Date.now() >= deadline) throw new Error(`visible control ${testId} timeout`);
    await new Promise<void>((resolve) => setTimeout(resolve, Math.min(25, Math.max(1, deadline - Date.now()))));
  }
}

type O4p09iHoldStateV1 = 'not-applicable' | 'none' | 'own' | 'peer' | 'invalid';
type O4p09iActorProbeV1 = Readonly<{ readonly enabled: boolean; readonly revision: number; readonly holdState: O4p09iHoldStateV1 }>;

async function actorControlProbe(
  page: O4p09iPageV1,
  testId: string,
  timeoutMs: number,
  timeoutMessage: string
): Promise<O4p09iActorProbeV1> {
  if (timeoutMs <= 0) return { enabled: false, revision: 0, holdState: 'invalid' };
  return Promise.race([
    page.evaluate<O4p09iActorProbeV1>(`(() => { // priorityControlProbe:${testId}
      const node = document.querySelector('[data-testid="${testId}"]');
      const revision = [...document.querySelectorAll('[data-testid="online-remote-connection"], [data-testid="online-assisted-priority"], [data-testid="online-pregame-revision"]')]
        .map((candidate) => /更新 (\\d+)/u.exec(candidate.textContent ?? '')?.[1] ?? '')
        .flatMap((value) => value === '' ? [] : [Number(value)]).at(-1) ?? 0;
      const holdState = (() => {
        if (${JSON.stringify(testId)} !== 'online-remote-hold') return 'not-applicable';
        const pressed = node instanceof HTMLButtonElement ? node.getAttribute('aria-pressed') : null;
        const status = (document.querySelector('[data-testid="online-remote-hold-status"]')?.textContent ?? '').trim();
        if (pressed === 'false' && status === 'HOLDなし') return 'none';
        if (pressed === 'true' && status === 'あなたがHOLD中') return 'own';
        if (pressed === 'false' && status === '他プレイヤーがHOLD中') return 'peer';
        return 'invalid';
      })();
      if (!(node instanceof HTMLButtonElement)) return { enabled: false, revision, holdState };
      const style = getComputedStyle(node); const rect = node.getBoundingClientRect();
      return { enabled: !node.hidden && node.getAttribute('aria-hidden') !== 'true' && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') > 0 && rect.width > 0 && rect.height > 0 && node.closest('details:not([open])') === null && !node.disabled, revision, holdState };
    })()`),
    new Promise<never>((_resolve, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    )
  ]);
}

async function findProgressActorPage(
  pages: readonly O4p09iPageV1[],
  timeoutMs: number
): Promise<Readonly<{ readonly page: O4p09iPageV1; readonly testId: 'online-remote-advance' | 'online-remote-sba-stable'; readonly revision: number }>> {
  const deadline = Date.now() + timeoutMs;
  const testIds = ['online-remote-advance', 'online-remote-sba-stable'] as const;
  for (;;) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('progress actor control timeout');
    const results = await Promise.allSettled(pages.flatMap((page) => testIds.map(async (testId) => ({
      page,
      testId,
      probe: await actorControlProbe(page, testId, remaining, `${testId} actor probe timeout`),
    }))));
    for (const result of results) {
      if (result.status === 'rejected') {
        rethrowProductionEnvironmentFailure(result.reason, 'progress-probe');
        throw new Error('progress actor probe unavailable', { cause: result.reason });
      }
    }
    const probes = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
    const revisions = new Set(probes.map(({ probe }) => probe.revision));
    if (probes.length !== pages.length * testIds.length || revisions.size !== 1 || !safeRevision(probes[0]?.probe.revision ?? 0)) {
      await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 25));
      continue;
    }
    const enabled = probes.filter(({ probe }) => probe.enabled);
    if (enabled.length > 1) throw new Error('advance actor authority ambiguous');
    const selected = enabled[0];
    if (selected !== undefined) return { page: selected.page, testId: selected.testId, revision: selected.probe.revision };
    if (Date.now() >= deadline) throw new Error('progress actor control timeout');
    await new Promise<void>((resolvePromise) =>
      setTimeout(resolvePromise, Math.min(25, Math.max(1, deadline - Date.now())))
    );
  }
}

async function findPriorityActorPage(
  pages: readonly O4p09iPageV1[],
  testId: string,
  timeoutMs: number,
  universal: boolean,
  holdExpectation: 'none' | 'owned-by-designated' | null = null
): Promise<{ page: O4p09iPageV1; revision: number }> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error(`${testId} actor control timeout`);
    const results = await Promise.allSettled(
      pages.map((page) =>
        actorControlProbe(page, testId, remaining, `${testId} actor probe timeout`)
      )
    );
    for (const result of results) {
      if (result.status === 'rejected') {
        rethrowProductionEnvironmentFailure(result.reason, 'priority-probe');
        throw new Error(`${testId} actor probe unavailable`, { cause: result.reason });
      }
    }
    const probes: Array<{ page: O4p09iPageV1; probe: O4p09iActorProbeV1 }> = results.flatMap(
      (result, index) => {
        const page = pages[index];
        return result.status === 'fulfilled' && page !== undefined
          ? [{ page, probe: result.value }]
          : [];
      }
    );
    const revision = probes[0]?.probe.revision ?? 0;
    const sameRevision =
      probes.length === pages.length &&
      safeRevision(revision) &&
      probes.every(({ probe }) => probe.revision === revision);
    if (sameRevision) {
      const enabled = probes.filter(({ probe }) => probe.enabled).map(({ page }) => page);
      const designatedPage = pages[0];
      if (designatedPage === undefined) throw new Error(`${testId} actor set empty`);
      if (universal && holdExpectation === null) throw new Error(`${testId} HOLD expectation missing`);
      const expectedHoldStates = probes.every(({ probe }, index) => probe.holdState === (holdExpectation === 'none' ? 'none' : index === 0 ? 'own' : 'peer'));
      if (universal && enabled.length === pages.length && expectedHoldStates) return { page: designatedPage, revision };
      if (universal && enabled.length !== pages.length)
        throw new Error(`${testId} actor authority incomplete`);
      if (universal && !expectedHoldStates) throw new Error(`${testId} HOLD state mismatch`);
      const soleActor = enabled[0];
      if (!universal && enabled.length === 1 && soleActor !== undefined)
        return { page: soleActor, revision };
      if (!universal && enabled.length > 1) throw new Error(`${testId} actor authority ambiguous`);
    }
    if (Date.now() >= deadline)
      throw new Error(
        `${testId} actor control timeout (${probes.length}/${pages.length}/${String(revision)})`
      );
    await new Promise<void>((resolvePromise) =>
      setTimeout(resolvePromise, Math.min(25, Math.max(1, deadline - Date.now())))
    );
  }
}

async function clickPriorityAndAwaitConvergence(
  pages: readonly O4p09iPageV1[],
  actor: O4p09iPageV1,
  testId: string,
  baseline: number,
  workerOrigin: string,
  timeoutMs: number,
  secretFragments: readonly string[]
): Promise<number> {
  const operation = testId === 'online-remote-hold'
    ? 'priority-hold'
    : testId === 'online-remote-pass'
      ? 'priority-pass'
      : testId === 'online-remote-resolve'
        ? 'priority-resolve'
        : null;
  if (operation === null) throw new Error(`${testId} priority operation unknown`);
  const actorIndex = pages.indexOf(actor);
  if (actorIndex < 0) throw new Error(`${testId} actor is outside the scenario`);
  await clickVisible(actor, testId, timeoutMs);
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const probes = await Promise.all(
      pages.map((page) =>
        probePage(
          page,
          Math.min(1_000, Math.max(1, deadline - Date.now())),
          workerOrigin,
          secretFragments
        )
      )
    );
    const revision = probes[0]?.revision ?? 0;
    const settlement = probes[actorIndex]?.prioritySettlement ?? null;
    if (
      safeRevision(revision) &&
      revision === baseline + 1 &&
      probes.every((probe) => safeRevision(probe.revision) && probe.revision === revision) &&
      settlement !== null &&
      settlement.operation === operation &&
      settlement.outcome === 'accepted' &&
      settlement.baseRevision === baseline &&
      settlement.currentRevision === revision &&
      settlement.acceptedRevision === revision
    )
      return revision;
    if (Date.now() >= deadline) throw new Error(`${testId} revision convergence timeout`);
    await new Promise<void>((resolvePromise) =>
      setTimeout(resolvePromise, Math.min(25, Math.max(1, deadline - Date.now())))
    );
  }
}

async function waitForResolvedTopConvergence(
  pages: readonly O4p09iPageV1[],
  capturedTopObjectId: string,
  resolvedRevision: number,
  workerOrigin: string,
  timeoutMs: number,
  secretFragments: readonly string[]
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const probes = await Promise.all(
      pages.map((page) => probePage(
        page,
        Math.min(1_000, Math.max(1, deadline - Date.now())),
        workerOrigin,
        secretFragments
      ))
    );
    const resolution = probes[0]?.postResolution ?? null;
    if (
      resolution !== null &&
      resolution.includes(capturedTopObjectId) &&
      probes.every((probe) =>
        probe.revision === resolvedRevision &&
        probe.stackCount === 0 &&
        probe.stackTopObjectId === null &&
        probe.postResolution === resolution
      )
    ) return;
    if (Date.now() >= deadline) throw new Error('priority resolve evidence timeout');
    await new Promise<void>((resolvePromise) =>
      setTimeout(resolvePromise, Math.min(25, Math.max(1, deadline - Date.now())))
    );
  }
}

async function readPriorityJourneyStep(
  pages: readonly O4p09iPageV1[],
  actorPage: O4p09iPageV1,
  operation: 'priority-hold' | 'priority-pass' | 'priority-resolve',
  capturedTopObjectId: string,
  workerOrigin: string,
  timeoutMs: number,
  secretFragments: readonly string[],
): Promise<RemotePriorityJourneyObservationV1['steps'][number]> {
  const probes = await Promise.all(pages.map((page) => probePage(page, timeoutMs, workerOrigin, secretFragments)));
  const actorIndex = pages.indexOf(actorPage);
  const actor = probes[actorIndex];
  if (actor === undefined || actor.localPlayerId == null || actor.publicPlayerIds === undefined || actor.prioritySettlement === null) throw new Error('priority observation missing');
  const publicIds = actor.publicPlayerIds;
  if (publicIds.length !== 2 || new Set(publicIds).size !== 2
    || publicIds.some((playerId) => !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(playerId))) {
    throw new Error('priority public seats missing');
  }
  const localPlayerIds = probes.map((probe) => probe.localPlayerId);
  if (localPlayerIds.some((playerId) => playerId == null || !publicIds.includes(playerId))
    || new Set(localPlayerIds).size !== 2
    || probes.some((probe) => probe.publicPlayerIds === undefined
      || probe.publicPlayerIds.length !== publicIds.length
      || probe.publicPlayerIds.some((playerId, index) => playerId !== publicIds[index]))) {
    throw new Error('priority seat identity diverged');
  }
  const seats = probes.map((probe) => {
    if (probe.priorityHolderPlayerId === undefined || probe.priorityStewardPlayerId === undefined || probe.priorityWindowKind === undefined || probe.priorityHolds === undefined) throw new Error('priority state missing');
    if ((probe.priorityHolderPlayerId !== null && !publicIds.includes(probe.priorityHolderPlayerId))
      || (probe.priorityStewardPlayerId !== null && !publicIds.includes(probe.priorityStewardPlayerId))
      || probe.priorityHolds.some((playerId) => !publicIds.includes(playerId))) {
      throw new Error('priority state seat identity invalid');
    }
    return {
      revision: probe.revision,
      holds: probe.priorityHolds,
      holderPlayerId: probe.priorityHolderPlayerId,
      stewardPlayerId: probe.priorityStewardPlayerId,
      windowKind: probe.priorityWindowKind,
      stackCount: probe.stackCount,
      topObjectId: probe.stackTopObjectId,
      recentResolutionObjectId: probe.recentResolutionObjectId,
      recentResolutionRevision: probe.recentResolutionRevision,
    };
  });
  if (operation !== 'priority-resolve' && seats.some((seat) => seat.topObjectId !== capturedTopObjectId || seat.stackCount !== 1)) throw new Error('priority captured top diverged');
  return Object.freeze({
    operation,
    actorPlayerId: actor.localPlayerId,
    receipt: Object.freeze({
      commandId: actor.prioritySettlement.commandId,
      operation: actor.prioritySettlement.operation as 'priority-hold' | 'priority-pass' | 'priority-resolve',
      outcome: 'accepted',
      baseRevision: actor.prioritySettlement.baseRevision,
      currentRevision: actor.prioritySettlement.currentRevision,
      acceptedRevision: actor.prioritySettlement.acceptedRevision as number,
    }),
    seats: Object.freeze(seats),
  });
}

/**
 * Wait for the host's lobby projection to expose every configured seat as
 * deck-submitted and ready before issuing the start intent.  The player pages
 * submit their ready intents asynchronously; relying only on the host's
 * enabled button can otherwise race a stale lobby projection during a fresh
 * production run.  This probe reads public status labels only and keeps every
 * page evaluation synchronous so the adapter command deadline cannot win the
 * outer poll.
 */
async function waitForLobbyReady(page: O4p09iPageV1, playerCount: 2 | 4, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const ready = await page.evaluate<boolean>(`(() => {
      const start = document.querySelector('[data-testid="online-start-game"]');
      const visible = (node) => {
        if (!(node instanceof HTMLElement)) return false;
        const style = getComputedStyle(node); const rect = node.getBoundingClientRect();
        return !node.hidden && node.getAttribute('aria-hidden') !== 'true' && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') > 0 && rect.width > 0 && rect.height > 0 && node.closest('details:not([open])') === null;
      };
      if (!(start instanceof HTMLButtonElement) || !visible(start) || start.disabled) return false;
      const seats = [...document.querySelectorAll('[data-testid="online-seat-summary"]')];
      if (seats.length !== ${String(playerCount)}) return false;
      return seats.every((seat) => {
        if (!visible(seat)) return false;
        const status = seat.textContent ?? '';
        return status.includes('提出済み') && status.includes('準備完了');
      });
    })()`);
    if (ready) return;
    if (Date.now() >= deadline) throw new Error('lobby readiness timeout');
    await new Promise<void>((resolve) => setTimeout(resolve, Math.min(25, Math.max(1, deadline - Date.now()))));
  }
}

async function waitForStartedSurface(page: O4p09iPageV1, host: boolean, workerOrigin: string, timeoutMs: number, secretFragments: readonly string[], failureState: { reason: O4p09iStartedSurfaceFailureV1 | null }): Promise<O4p09iProbeV1> {
  const deadline = Date.now() + timeoutMs;
  let lastFailure: O4p09iStartedSurfaceFailureV1 = 'game-screen-missing/count';
  for (;;) {
    try {
      const probe = await probePage(page, Math.min(timeoutMs, 1_000), workerOrigin, secretFragments);
      const ready = probe.gameScreens === 1 && probe.overflow === 0 && !probe.opponentLeak && probe.consoleErrors === 0 && (!host || safeRevision(probe.revision));
      if (ready) return probe;
      if (probe.gameScreens !== 1) lastFailure = 'game-screen-missing/count';
      else if (probe.overflow !== 0) lastFailure = 'horizontal-overflow';
      else if (probe.opponentLeak) lastFailure = 'opponent-leak';
      else if (probe.consoleErrors !== 0) lastFailure = 'console-error';
      else if (host && !safeRevision(probe.revision)) lastFailure = 'host-revision-missing';
    } catch (error) {
      rethrowProductionEnvironmentFailure(error, 'start-probe');
      // The shared surface may still be mounting after the start action. Keep
      // the probe bounded and report only the constant scenario stage on exit.
      lastFailure = 'game-screen-missing/count';
    }
    if (Date.now() >= deadline) {
      if (lastFailure === 'game-screen-missing/count') {
        try {
          const terminal = await page.evaluate<O4p09iStartedSurfaceFailureV1>(`(() => { // startedSurfaceTerminalProbe
            const visible = (candidate) => {
              if (!(candidate instanceof HTMLElement)) return false;
              const style = getComputedStyle(candidate); const rect = candidate.getBoundingClientRect();
              return !candidate.hidden && candidate.getAttribute('aria-hidden') !== 'true' && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') > 0 && rect.width > 0 && rect.height > 0;
            };
            if (visible(document.querySelector('[data-testid="online-error"]'))) return 'start-rejected';
            const start = document.querySelector('[data-testid="online-start-game"]');
            if (visible(start) && start instanceof HTMLButtonElement) return start.disabled ? 'start-pending' : 'start-not-accepted';
            return 'game-screen-missing/count';
          })()`);
          lastFailure = terminal;
        } catch (error) {
          rethrowProductionEnvironmentFailure(error, 'start-terminal-probe');
          // Preserve the conservative game-screen-missing/count reason when
          // the terminal DOM probe itself is unavailable.
        }
      }
      failureState.reason = lastFailure;
      throw new Error(`started surface failed: ${lastFailure}`);
    }
    await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, Math.min(25, Math.max(1, deadline - Date.now()))));
  }
}

async function clickPregameActorControl(page: O4p09iPageV1, testId: string): Promise<boolean> {
  return page.evaluate<boolean>(`(() => { // pregameActorControlProbe
    const node = document.querySelector('[data-testid="${testId}"]');
    if (!(node instanceof HTMLElement)) return false;
    const style = getComputedStyle(node); const rect = node.getBoundingClientRect();
    if (node.hidden || node.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') <= 0 || rect.width <= 0 || rect.height <= 0 || node.closest('details:not([open])') !== null) return false;
    if (node instanceof HTMLButtonElement && node.disabled) return false;
    node.click(); return true;
  })()`);
}

async function drivePregamePhase(pages: readonly O4p09iPageV1[], playerCount: 2 | 4, testId: string, workerOrigin: string, timeoutMs: number, secretFragments: readonly string[], recordControl: (testId: string) => void): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let completed = 0;
  while (completed < playerCount) {
    let progressed = false;
    for (const page of pages) {
      if (Date.now() >= deadline) break;
      const baseline = (await probePage(page, Math.min(timeoutMs, 1_000), workerOrigin, secretFragments)).revision;
      const clicked = await clickPregameActorControl(page, testId);
      if (!clicked) continue;
      progressed = true;
      completed += 1;
      recordControl(testId);
      const terminalReady = testId === 'pregame-ready' && completed >= playerCount;
      await waitForPregameTransition(page, workerOrigin, baseline, Math.min(timeoutMs, Math.max(250, deadline - Date.now())), secretFragments, terminalReady);
      break;
    }
    if (completed >= playerCount) return;
    if (Date.now() >= deadline) throw new Error('pregame actor transition timeout');
    if (!progressed) await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, Math.min(25, Math.max(1, deadline - Date.now()))));
  }
}

async function waitForSavedDeck(page: O4p09iPageV1, timeoutMs: number): Promise<
  | 'ready' | 'already-online' | 'storage-error' | 'resolution-error' | 'resolution-pending' | 'notification-missing' | 'import-runtime-failed' | 'import-runtime-error' | 'error-boundary' | 'import-surface-disappeared' | 'invalid-workflow'> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const status = await page.evaluate<
      | 'pending' | 'ready' | 'already-online' | 'storage-error' | 'resolution-error' | 'notification-missing' | 'error-boundary'>(`(() => { // savedDeckProbe
      const node = document.querySelector('[data-testid="deck-save-status"]');
      const visible = (candidate) => {
        if (!(candidate instanceof HTMLElement)) return false;
        const style = getComputedStyle(candidate); const rect = candidate.getBoundingClientRect();
        return !candidate.hidden && candidate.getAttribute('aria-hidden') !== 'true' && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') > 0 && rect.width > 0 && rect.height > 0;
      };
      if (visible(document.querySelector('[data-testid="error-boundary"]'))) return 'error-boundary';
      const visibleStatus = visible(node);
      if (visibleStatus && (node.classList.contains('import-screen__save-status--error') || node.getAttribute('role') === 'alert')) return 'storage-error';
      if (visibleStatus && node.classList.contains('import-screen__save-status--saved')) return 'ready';
      if (visible(document.querySelector('[data-testid="public-online-app"]'))) return 'already-online';
      const onlineEntry = document.querySelector('[data-testid="open-online-mode"]');
      if (visible(onlineEntry) && (!(onlineEntry instanceof HTMLButtonElement) || !onlineEntry.disabled)) return 'ready';
      const screen = document.querySelector('[data-testid="import-screen"]');
      const workflow = screen?.getAttribute('data-state') ?? null;
      const importButton = document.querySelector('[data-testid="import-button"]');
      if (workflow === 'error' && visible(importButton)) return 'resolution-error';
      if (workflow === 'ready' && !visibleStatus) return 'notification-missing';
      return 'pending';
    })()`);
    if (status === 'ready' || status === 'already-online' || status === 'storage-error' || status === 'error-boundary') return status;
    if (status === 'resolution-error') return 'resolution-error';
    if (status === 'notification-missing') return 'notification-missing';
    if (Date.now() >= deadline) {
      if (page.consoleCounts().errors > 0) return 'import-runtime-error';
      const terminal = await page.evaluate<
        | 'resolution-pending' | 'import-runtime-failed' | 'import-surface-disappeared' | 'invalid-workflow' | 'error-boundary' | 'already-online' | 'saved-state'>(`(() => { // savedDeckTerminalProbe
        const visible = (candidate) => {
          if (!(candidate instanceof HTMLElement)) return false;
          const style = getComputedStyle(candidate); const rect = candidate.getBoundingClientRect();
          return !candidate.hidden && candidate.getAttribute('aria-hidden') !== 'true' && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') > 0 && rect.width > 0 && rect.height > 0;
        };
        if (visible(document.querySelector('[data-testid="error-boundary"]'))) return 'error-boundary';
        if (visible(document.querySelector('[data-testid="public-online-app"]'))) return 'already-online';
        const screen = document.querySelector('[data-testid="import-screen"]');
        if (!(screen instanceof HTMLElement)) return 'import-surface-disappeared';
        const workflow = screen?.getAttribute('data-state') ?? null;
        if (workflow !== null && !['empty', 'resolving', 'error', 'ready'].includes(workflow)) return 'invalid-workflow';
        const importButton = document.querySelector('[data-testid="import-button"]');
        const importButtonVisible = visible(importButton);
        if (workflow === 'empty' && importButtonVisible) return 'import-runtime-failed';
        const node = document.querySelector('[data-testid="cancel-import"]');
        if (!(node instanceof HTMLElement)) return 'saved-state';
        const style = getComputedStyle(node); const rect = node.getBoundingClientRect();
        return !node.hidden && node.getAttribute('aria-hidden') !== 'true' && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') > 0 && rect.width > 0 && rect.height > 0 ? 'resolution-pending' : 'saved-state';
      })()`);
      if (terminal === 'resolution-pending') return 'resolution-pending';
      if (terminal === 'import-runtime-failed') return 'import-runtime-failed';
      if (terminal === 'error-boundary') return 'error-boundary';
      if (terminal === 'already-online') return 'already-online';
      if (terminal === 'import-surface-disappeared') return 'import-surface-disappeared';
      if (terminal === 'invalid-workflow') return 'invalid-workflow';
      throw new Error('visible save state timeout');
    }
    await new Promise<void>((resolve) => setTimeout(resolve, Math.min(25, Math.max(1, deadline - Date.now()))));
  }
}

async function importDeckAndOpenOnline(page: O4p09iPageV1, deckText: string, timeoutMs: number): Promise<void> {
  if (deckText.trim() === '') throw new Error('deck input empty');
  try {
    await waitForVisible(page, 'deck-input', timeoutMs);
    await fillVisible(page, 'deck-input', deckText, timeoutMs);
  } catch (error) {
    rethrowProductionEnvironmentFailure(error, 'deck-input');
    throw new Error(PRODUCTION_UI_STAGE_ERRORS.deckInput, { cause: error });
  }
  try {
    await clickVisible(page, 'import-button', timeoutMs);
  } catch (error) {
    rethrowProductionEnvironmentFailure(error, 'import-click');
    throw new Error(PRODUCTION_UI_STAGE_ERRORS.importClick, { cause: error });
  }
  let saveStatus:
    | 'ready' | 'already-online' | 'storage-error' | 'resolution-error' | 'resolution-pending' | 'notification-missing' | 'import-runtime-failed' | 'import-runtime-error' | 'error-boundary' | 'import-surface-disappeared' | 'invalid-workflow';
  try {
    saveStatus = await waitForSavedDeck(page, timeoutMs);
  } catch (error) {
    rethrowProductionEnvironmentFailure(error, 'saved-state');
    throw new Error(PRODUCTION_UI_STAGE_ERRORS.savedState, { cause: error });
  }
  if (saveStatus === 'storage-error') throw new Error(PRODUCTION_UI_STAGE_ERRORS.storageUnavailable);
  if (saveStatus === 'resolution-error') throw new Error(PRODUCTION_UI_STAGE_ERRORS.resolutionUnavailable);
  if (saveStatus === 'resolution-pending') throw new Error(PRODUCTION_UI_STAGE_ERRORS.resolutionPending);
  if (saveStatus === 'notification-missing') throw new Error(PRODUCTION_UI_STAGE_ERRORS.notificationMissing);
  if (saveStatus === 'import-runtime-failed') throw new Error(PRODUCTION_UI_STAGE_ERRORS.importRuntimeFailed);
  if (saveStatus === 'import-runtime-error') throw new Error(PRODUCTION_UI_STAGE_ERRORS.importRuntimeError);
  if (saveStatus === 'error-boundary') throw new Error(PRODUCTION_UI_STAGE_ERRORS.productErrorBoundary);
  if (saveStatus === 'import-surface-disappeared') throw new Error(PRODUCTION_UI_STAGE_ERRORS.importSurfaceDisappeared);
  if (saveStatus === 'invalid-workflow') throw new Error(PRODUCTION_UI_STAGE_ERRORS.invalidWorkflow);
  await openOnlineFromSavedDeck(page, timeoutMs);
}

async function openOnlineFromSavedDeck(page: O4p09iPageV1, timeoutMs: number): Promise<void> {
  try {
    const alreadyOnline = await page.evaluate<boolean>(`(() => { // alreadyOnlineSurfaceProbe
      const node = document.querySelector('[data-testid="public-online-app"]');
      if (!(node instanceof HTMLElement)) return false;
      const style = getComputedStyle(node); const rect = node.getBoundingClientRect();
      return !node.hidden && node.getAttribute('aria-hidden') !== 'true' && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') > 0 && rect.width > 0 && rect.height > 0;
    })()`);
    if (alreadyOnline) return;
    await waitForVisible(page, 'open-online-mode', timeoutMs);
    await clickVisible(page, 'open-online-mode', timeoutMs);
    await waitForVisible(page, 'public-online-app', timeoutMs);
  } catch (error) {
    rethrowProductionEnvironmentFailure(error, 'online-open');
    throw new Error(PRODUCTION_UI_STAGE_ERRORS.onlineOpen, { cause: error });
  }
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
  readonly complete: true;
  readonly roots: number;
  readonly attributes: number;
  readonly values: number;
  readonly tokens: number;
  readonly bytes: number;
}>;

/**
 * Capture bounded private-choice handles and a deterministic digest.  Raw
 * values remain in this process only for the immediate cross-seat check; they
 * are intentionally absent from the evidence schema and error messages.
 */
async function readPrivateChoicePayload(page: O4p09iPageV1, timeoutMs: number): Promise<O4p09iPrivateChoicePayloadV1> {
  const raw = await Promise.race([
    page.evaluate<Readonly<{
      readonly identifiers: readonly string[];
      readonly candidateHandles: readonly string[];
      readonly serialized: string;
      readonly complete: boolean;
      readonly roots: number;
      readonly attributes: number;
      readonly values: number;
      readonly tokens: number;
      readonly bytes: number;
    }>>(`(() => { // privateChoicePayload
      const roots = [...document.querySelectorAll('[data-testid^="visibility-choice-"], [data-testid^="visibility-choose-"], [data-private-choice], [data-choice-handle], input[type="checkbox"]')];
      let complete = roots.length < ${String(MAX_PRIVATE_ROOTS_V1)};
      let attributes = 0;
      let values = 0;
      let tokens = 0;
      let bytes = 0;
      const appendToken = (value) => {
        if (typeof value !== 'string' || value === '') return '';
        const size = new TextEncoder().encode(value).byteLength;
        if (tokens + 1 >= ${String(MAX_PRIVATE_TOKENS_V1)} || bytes + size >= ${String(MAX_PRIVATE_CAPTURE_BYTES_V1)}) { complete = false; return ''; }
        tokens += 1;
        bytes += size;
        return value;
      };
      const rows = roots.slice(0, ${String(MAX_PRIVATE_ROOTS_V1)}).map((node) => {
        const allAttributes = [...node.attributes];
        if (allAttributes.length >= ${String(MAX_PRIVATE_ATTRIBUTES_PER_ROOT_V1)}) complete = false;
        const attrs = allAttributes.slice(0, ${String(MAX_PRIVATE_ATTRIBUTES_PER_ROOT_V1)}).map((attribute) => {
          attributes += 1;
          return [appendToken(attribute.name), appendToken(attribute.value)];
        });
        const allValues = [...node.querySelectorAll('input, option')];
        if (allValues.length >= ${String(MAX_PRIVATE_VALUES_PER_ROOT_V1)}) complete = false;
        const valuesForRoot = allValues.slice(0, ${String(MAX_PRIVATE_VALUES_PER_ROOT_V1)}).map((child) => {
          values += 1;
          return 'value' in child && typeof child.value === 'string' ? appendToken(child.value) : '';
        }).filter((value) => value !== '');
        const text = appendToken(node.textContent ?? '');
        return { attrs, values: valuesForRoot, text };
      });
      const identifiers = rows.flatMap((row) => row.attrs.filter(([name, value]) => name.startsWith('data-testid') && value.startsWith('visibility-choose-')).map(([, value]) => value)).filter((value) => value !== '');
      const candidateHandles = rows.flatMap((row) => [
        ...row.attrs.flatMap(([name, value]) => [name, value]),
        ...row.values,
        ...(row.text === '' ? [] : [row.text]),
      ]).filter((value) => value.length >= 1);
      const serializedCandidate = JSON.stringify(rows);
      if (new TextEncoder().encode(serializedCandidate).byteLength >= ${String(MAX_PRIVATE_CAPTURE_BYTES_V1)}) complete = false;
      const serialized = complete ? serializedCandidate : '';
      return { identifiers, candidateHandles, serialized, complete, roots: roots.length, attributes, values, tokens, bytes };
    })()`),
    new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('private choice probe timeout')), timeoutMs)),
  ]);
  if (raw.complete !== true || !Array.isArray(raw.identifiers) || !Array.isArray(raw.candidateHandles) || !Number.isSafeInteger(raw.roots) || !Number.isSafeInteger(raw.attributes) || !Number.isSafeInteger(raw.values) || !Number.isSafeInteger(raw.tokens) || !Number.isSafeInteger(raw.bytes) || raw.roots >= MAX_PRIVATE_ROOTS_V1 || raw.attributes >= MAX_PRIVATE_ROOTS_V1 * MAX_PRIVATE_ATTRIBUTES_PER_ROOT_V1 || raw.values >= MAX_PRIVATE_ROOTS_V1 * MAX_PRIVATE_VALUES_PER_ROOT_V1 || raw.tokens >= MAX_PRIVATE_TOKENS_V1 || raw.bytes >= MAX_PRIVATE_CAPTURE_BYTES_V1) throw new Error('private choice capture incomplete');
  if (new TextEncoder().encode(raw.serialized).byteLength >= MAX_PRIVATE_CAPTURE_BYTES_V1) throw new Error('private choice payload too large');
  if (raw.identifiers.some((value) => typeof value !== 'string' || value.length > MAX_TEXT_BYTES) || raw.candidateHandles.some((value) => typeof value !== 'string' || value.length > MAX_TEXT_BYTES)) throw new Error('private choice capture incomplete');
  const identifiers = raw.identifiers;
  const candidateHandles = raw.candidateHandles;
  return Object.freeze({ identifiers, candidateHandles, serialized: raw.serialized, digest: sha256(raw.serialized), complete: true, roots: raw.roots, attributes: raw.attributes, values: raw.values, tokens: raw.tokens, bytes: raw.bytes });
}

type O4p09iPrivateHandPayloadV1 = Readonly<{
  readonly tokens: readonly string[];
  readonly digest: string;
}>;

/** Capture only opaque object handles rendered in this seat's own hand. Raw
 * handles remain process-local and are used to prove that recovery restores
 * the same private audience without exposing it to a peer. */
async function readPrivateHandPayload(page: O4p09iPageV1, timeoutMs: number): Promise<O4p09iPrivateHandPayloadV1> {
  const raw = await Promise.race([
    page.evaluate<Readonly<{ readonly tokens: readonly string[]; readonly serialized: string; readonly complete: boolean; readonly bytes: number }>>(`(() => { // privateHandPayload
      const root = document.querySelector('[data-testid="hand-cards"]');
      const cards = root === null ? [] : [...root.querySelectorAll('[data-layout-card-id]')];
      const complete = cards.length > 0 && cards.length < ${String(MAX_PRIVATE_ROOTS_V1)};
      const tokens = cards.slice(0, ${String(MAX_PRIVATE_ROOTS_V1)}).map((card) => card.getAttribute('data-layout-card-id') ?? '').filter((token) => token !== '').sort();
      const serialized = JSON.stringify(tokens);
      return { tokens, serialized, complete: complete && tokens.length === cards.length && new Set(tokens).size === tokens.length, bytes: new TextEncoder().encode(serialized).byteLength };
    })()`),
    new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('private hand probe timeout')), timeoutMs)),
  ]);
  if (raw.complete !== true || !Array.isArray(raw.tokens) || raw.tokens.length === 0 || raw.tokens.length >= MAX_PRIVATE_ROOTS_V1
    || raw.tokens.some((token) => typeof token !== 'string' || token.length === 0 || token.length > MAX_TEXT_BYTES)
    || !Number.isSafeInteger(raw.bytes) || raw.bytes >= MAX_PRIVATE_CAPTURE_BYTES_V1) throw new Error('private hand capture incomplete');
  return Object.freeze({ tokens: Object.freeze(raw.tokens.slice()), digest: sha256(raw.serialized) });
}

/** Capture bounded rendered text, attributes, form values, and choice-control
 * content from an unauthorized seat.  Values remain memory-only in the caller;
 * host tokens are never injected into that seat's page. */
type O4p09iDomSurfaceScanV1 = Readonly<{ readonly surfaces: readonly string[]; readonly complete: boolean;
}>;

async function readUnauthorizedDomSurfaces(page: O4p09iPageV1, timeoutMs: number): Promise<readonly string[]> {
  const raw = await Promise.race([
    page.evaluate<O4p09iDomSurfaceScanV1>(`(() => { // privateChoiceDomSurfaces
      const surfaces = [];
      let complete = true;
      let bytes = 0;
      let nodes = 0;
      const append = (value) => {
        if (typeof value !== 'string' || value === '') return;
        const size = new TextEncoder().encode(value).byteLength;
        if (bytes + size >= ${String(MAX_DOM_SCAN_BYTES_V1)}) { complete = false; return; }
        bytes += size;
        surfaces.push(value);
      };
      for (const node of [...document.querySelectorAll('*')]) {
        if (nodes >= ${String(MAX_DOM_SCAN_NODES_V1)}) { complete = false; break; }
        nodes += 1;
        for (const child of [...node.childNodes]) if (child.nodeType === 3) append(child.nodeValue ?? '');
        const attributes = [...node.attributes];
        if (attributes.length >= ${String(MAX_DOM_SCAN_ATTRIBUTES_V1)}) complete = false;
        for (const attribute of attributes.slice(0, ${String(MAX_DOM_SCAN_ATTRIBUTES_V1)})) { append(attribute.name); append(attribute.value); }
        if ('value' in node && typeof node.value === 'string') append(node.value);
      }
      if (nodes >= ${String(MAX_DOM_SCAN_NODES_V1)}) complete = false;
      return { surfaces, complete };
    })()`),
    new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('private choice surface probe timeout')), timeoutMs)),
  ]);
  if (!raw.complete) throw new Error('bounded private choice surface scan incomplete');
  return raw.surfaces;
}

async function toggleDetails(page: O4p09iPageV1, testId: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error(`details ${testId} timeout`);
    const opened = await Promise.race([
      page.evaluate<boolean>(`(() => { // detailsPanelReadyProbe:${testId}
      const details = document.querySelector('[data-testid="${testId}"]');
      if (!(details instanceof HTMLDetailsElement)) return false;
      const style = getComputedStyle(details); const rect = details.getBoundingClientRect();
      if (details.hidden || details.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') <= 0 || rect.width <= 0 || rect.height <= 0) return false;
      if (!details.open) details.querySelector('summary')?.click();
      return details.open;
    })()`),
      new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error(`details ${testId} timeout`)), remaining)),
    ]);
    if (opened) return;
    await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, Math.min(25, Math.max(1, deadline - Date.now()))));
  }
}

async function manualStackControlEnabled(page: O4p09iPageV1, timeoutMs: number): Promise<O4p09iActorProbeV1> {
  return actorControlProbe(
    page,
    'online-tabletop-submit-stack-entry',
    timeoutMs,
    'manual stack actor probe timeout'
  );
}

async function manualResolveControlEnabled(
  page: O4p09iPageV1,
  timeoutMs: number
): Promise<O4p09iActorProbeV1> {
  return actorControlProbe(
    page,
    'online-tabletop-submit-manual-resolve', timeoutMs,
    'manual resolve actor probe timeout'
  );
}

async function findManualActorPage(pages: readonly O4p09iPageV1[], timeoutMs: number,
  resolve: boolean
): Promise<O4p09iPageV1> {
  const deadline = Date.now() + timeoutMs;
  const label = resolve ? 'manual resolve' : 'manual stack';
  for (;;) {
    const probes: Array<{ page: O4p09iPageV1; probe: O4p09iActorProbeV1 }> = [];
    for (const page of pages) {
      const beforePanel = deadline - Date.now();
      if (beforePanel <= 0) throw new Error(`${label} actor control timeout`);
      try {
        await toggleDetails(page, 'online-remote-manual-overlay', Math.min(250, beforePanel));
        const beforeProbe = deadline - Date.now();
        if (beforeProbe <= 0) throw new Error(`${label} actor control timeout`);
        const probe = resolve
          ? await manualResolveControlEnabled(page, beforeProbe)
          : await manualStackControlEnabled(page, beforeProbe);
        if (safeRevision(probe.revision)) probes.push({ page, probe });
      } catch (error) {
        rethrowProductionEnvironmentFailure(
          error,
          resolve ? 'manual-resolve-probe' : 'manual-stack-probe'
        );
        // Wait for all seats to expose the same projection revision; never
        // guess an actor from a partial or stale observation.
      }
    }
    const revisions = new Set(probes.map(({ probe }) => probe.revision));
    if (probes.length === pages.length && revisions.size === 1) {
      const enabledPages = probes.filter(({ probe }) => probe.enabled).map(({ page }) => page);
      if (enabledPages.length > 1)
        throw new Error(
          resolve
            ? 'manual resolve actor authority ambiguous'
            : 'manual stack actor authority ambiguous'
        );
      if (enabledPages[0] !== undefined) return enabledPages[0];
    }
    if (Date.now() >= deadline) throw new Error(`${label} actor control timeout`);
    await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, Math.min(25, Math.max(1, deadline - Date.now()))));
  }
}

async function findManualStackActorPage(
  pages: readonly O4p09iPageV1[],
  timeoutMs: number
): Promise<O4p09iPageV1> {
  return findManualActorPage(pages, timeoutMs, false);
}

async function findManualResolveActorPage(
  pages: readonly O4p09iPageV1[],
  timeoutMs: number
): Promise<O4p09iPageV1> {
  return findManualActorPage(pages, timeoutMs, true);
}

async function readInvite(page: O4p09iPageV1, timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const invite = await page.evaluate<string | null>(`(() => {
      const invite = [...document.querySelectorAll('.public-online-app__invite span')].map((node) => {
        const style = getComputedStyle(node); const rect = node.getBoundingClientRect();
        return node.hidden || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') <= 0 || rect.width <= 0 || rect.height <= 0 ? '' : (node.textContent ?? '').trim();
      }).find((value) => value !== '' && !value.includes('準備しました'));
      return invite ?? null;
    })()`);
    if (invite !== null && invite !== '') return invite;
    if (Date.now() >= deadline) throw new Error('invite read timeout');
    await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, Math.min(25, Math.max(1, deadline - Date.now()))));
  }
}

async function digestVisibleInput(page: O4p09iPageV1, testId: string): Promise<string> {
  return page.evaluate<string>(`(async () => { // inviteFingerprintProbe
    const node = document.querySelector('[data-testid="${testId}"]');
    if (!(node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement)) return '';
    const bytes = new TextEncoder().encode(node.value);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
  })()`);
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

/**
 * Pregame's final ready click can unmount the pregame layer before the normal
 * revision marker is rendered on the started surface.  Preserve the strict
 * revision acknowledgement for every non-terminal action, but allow the
 * terminal ready transition to acknowledge the visible started surface once
 * its pregame layer has disappeared without any probe/leak errors.
 */
async function waitForPregameTransition(page: O4p09iPageV1, workerOrigin: string, baseline: number, timeoutMs: number, secretFragments: readonly string[], terminalReady: boolean): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const probe = await probePage(page, Math.min(timeoutMs, 1_000), workerOrigin, secretFragments);
    if (safeRevision(probe.revision) && probe.revision > baseline) return probe.revision;
    if (terminalReady && probe.gameScreens === 1 && !probe.opponentLeak && probe.consoleErrors === 0) {
      const startedSurface = await page.evaluate<boolean>(`(() => { // pregameTerminalSurfaceProbe
        const visible = (node) => {
          if (!(node instanceof HTMLElement)) return false;
          const style = getComputedStyle(node); const rect = node.getBoundingClientRect();
          return !node.hidden && node.getAttribute('aria-hidden') !== 'true' && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') > 0 && rect.width > 0 && rect.height > 0 && node.closest('details:not([open])') === null;
        };
        const pregame = document.querySelector('[data-pregame-layer="true"]');
        const rail = document.querySelector('[data-testid="online-remote-game-rail"]');
        const game = document.querySelector('[data-testid="game-screen"]:not(.game-screen--pregame)');
        return !visible(pregame) && (visible(rail) || visible(game));
      })()`);
      if (startedSurface) return probe.revision;
    }
    if (Date.now() >= deadline) throw new Error('visible pregame transition acknowledgement timeout');
    await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, Math.min(50, Math.max(1, deadline - Date.now()))));
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

async function advanceUntilPhase(
  pages: readonly O4p09iPageV1[], targetPhase: string, workerOrigin: string, timeoutMs: number, secretFragments: readonly string[], recordControl: (testId: string) => void): Promise<O4p09iProbeV1> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const snapshots = await Promise.all(
      pages.map((page) =>
        probePage(page, Math.min(timeoutMs, 1_000), workerOrigin, secretFragments)
      )
    );
    const current = snapshots[0];
    if (current === undefined) throw new Error('advance actor page missing');
    const targetCount = snapshots.filter((probe) => probe.phase === targetPhase).length;
    const matchingRevision = snapshots.every(
      (probe) => safeRevision(probe.revision) && probe.revision === current.revision
    );
    if (targetCount === snapshots.length && matchingRevision) return current;
    if (Date.now() >= deadline) break;
    if (targetCount > 0 || !matchingRevision) {
      await new Promise<void>((resolvePromise) =>
        setTimeout(resolvePromise, Math.min(25, Math.max(1, deadline - Date.now())))
      );
      continue;
    }
    const actor = await findProgressActorPage(
      pages,
      Math.min(timeoutMs, Math.max(250, deadline - Date.now()))
    );
    await clickAndAwaitRevision(
      actor.page, actor.testId, workerOrigin, Math.min(timeoutMs, Math.max(250, deadline - Date.now())), secretFragments);
    recordControl(actor.testId);
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
  readonly leakScanComplete: boolean;
  readonly privateLookControl: boolean;
  readonly chooseControl: boolean;
  readonly manualStackControl: boolean;
  readonly manualResolveControl: boolean;
  readonly stackCount: number;
  readonly stackTopObjectId: string | null;
  readonly castSettlement: Readonly<{
    readonly commandId: string;
    readonly operation: string;
    readonly outcome: string;
    readonly baseRevision: number;
    readonly currentRevision: number;
    readonly acceptedRevision: number | null;
  }> | null;
  readonly prioritySettlement: Readonly<{
    readonly commandId: string;
    readonly operation: string;
    readonly outcome: string;
    readonly baseRevision: number;
    readonly currentRevision: number;
    readonly acceptedRevision: number | null;
  }> | null;
  readonly publicPlayerIds: readonly string[] | undefined;
  readonly localPlayerId: string | null | undefined;
  readonly disconnectedPlayerIds: readonly string[];
  readonly recoveryOutcome: 'rejoined' | null;
  readonly sharedPublicDigest: string;
  readonly priorityHolds: readonly string[] | undefined;
  readonly priorityHolderPlayerId: string | null | undefined;
  readonly priorityStewardPlayerId: string | null | undefined;
  readonly priorityWindowKind: string | undefined;
  readonly recentResolutionObjectId: string | null;
  readonly recentResolutionRevision: number | null;
  readonly postResolution: string | null;
  readonly consoleErrors: number;
  readonly workerObserved: boolean;
}>;

type O4p09iConsoleAccumulatorV1 = { errors: number; warnings: number; secretViolations: number };

async function probePage(page: O4p09iPageV1, timeoutMs: number, workerOrigin: string, secretFragments: readonly string[] = []): Promise<O4p09iProbeV1> {
  const probe = await Promise.race([
    page.evaluate<O4p09iProbeV1>(`(() => {
      const root = document.documentElement;
      const fragments = (argument.fragments ?? []).filter((fragment) => typeof fragment === 'string' && fragment.length >= 8);
      let opponentLeak = false;
      let leakScanComplete = true;
      let leakScanBytes = 0;
      let leakScanNodes = 0;
      const scan = (value) => {
        if (typeof value !== 'string') return;
        const bytes = new TextEncoder().encode(value).byteLength;
        if (leakScanBytes + bytes >= ${String(MAX_DOM_SCAN_BYTES_V1)}) { leakScanComplete = false; return; }
        leakScanBytes += bytes;
        if (/(?:seat_|invite_|observer_)[A-Za-z0-9_-]{4,}/u.test(value) || fragments.some((fragment) => value.includes(fragment))) opponentLeak = true;
      };
      for (const node of [...document.querySelectorAll('*')]) {
        if (leakScanNodes >= ${String(MAX_DOM_SCAN_NODES_V1)}) { leakScanComplete = false; break; }
        leakScanNodes += 1;
        for (const child of [...node.childNodes]) if (child.nodeType === 3) scan(child.nodeValue ?? '');
        const attributes = [...node.attributes];
        if (attributes.length >= ${String(MAX_DOM_SCAN_ATTRIBUTES_V1)}) leakScanComplete = false;
        for (const attribute of attributes.slice(0, ${String(MAX_DOM_SCAN_ATTRIBUTES_V1)})) { scan(attribute.name); scan(attribute.value); }
        if ('value' in node && typeof node.value === 'string') scan(node.value);
      }
      if (leakScanNodes >= ${String(MAX_DOM_SCAN_NODES_V1)}) leakScanComplete = false;
      const remoteRail = document.querySelector('[data-testid="online-remote-game-rail"]');
      const pregameRevision = document.querySelector('[data-testid="online-pregame-revision"]');
      const revision = Number(remoteRail?.getAttribute('data-projection-revision') ?? pregameRevision?.getAttribute('data-projection-revision') ?? '-1');
      const outcomeText = document.querySelector('[data-testid="online-remote-outcome"]')?.textContent ?? '';
      const publicPlayerIds = remoteRail?.hasAttribute('data-public-seat-ids') ? (remoteRail.getAttribute('data-public-seat-ids') ?? '').split(',').filter(Boolean) : undefined;
      const localPlayerId = remoteRail?.hasAttribute('data-local-player-id') ? remoteRail.getAttribute('data-local-player-id') || null : undefined;
      const presence = document.querySelector('[data-testid="online-remote-presence"]');
      const disconnectedPlayerIds = (presence?.getAttribute('data-disconnected-player-ids') ?? '').split(',').filter(Boolean);
      const recovery = document.querySelector('[data-testid="online-remote-connection"]')?.getAttribute('data-recovery-outcome') ?? '';
      const recoveryOutcome = recovery === 'rejoined' ? 'rejoined' : null;
      const sharedPublicDigest = remoteRail?.getAttribute('data-shared-public-digest') ?? '';
      const priorityHolderPlayerId = remoteRail?.hasAttribute('data-priority-holder-player-id') ? remoteRail.getAttribute('data-priority-holder-player-id') || null : undefined;
      const priorityHolds = remoteRail?.hasAttribute('data-priority-holds') ? (remoteRail.getAttribute('data-priority-holds') ?? '').split(',').filter(Boolean) : undefined;
      const stewardPlayerId = remoteRail?.hasAttribute('data-priority-steward-player-id') ? remoteRail.getAttribute('data-priority-steward-player-id') || null : undefined;
      const causal = document.querySelector('[data-testid="online-remote-causal"]');
      const stackCount = Number(causal?.getAttribute('data-stack-count') ?? '0');
      const stackTopObjectId = causal?.getAttribute('data-stack-top-object-id') || null;
      const castResult = document.querySelector('[data-testid="online-remote-command-result"][data-operation="cast-spell"]');
      const acceptedRevisionText = castResult?.getAttribute('data-accepted-revision') ?? '';
      const castSettlement = castResult === null ? null : {
        commandId: castResult.getAttribute('data-command-id') ?? '',
        operation: castResult.getAttribute('data-operation') ?? '',
        outcome: castResult.getAttribute('data-outcome') ?? '',
        baseRevision: Number(castResult.getAttribute('data-base-revision') ?? '-1'),
        currentRevision: Number(castResult.getAttribute('data-current-revision') ?? '-1'),
        acceptedRevision: acceptedRevisionText === '' ? null : Number(acceptedRevisionText),
      };
      const priorityResult = document.querySelector('[data-testid="online-remote-priority-result"]');
      const priorityAcceptedRevisionText = priorityResult?.getAttribute('data-accepted-revision') ?? '';
      const prioritySettlement = priorityResult === null ? null : {
        commandId: priorityResult.getAttribute('data-command-id') ?? '',
        operation: priorityResult.getAttribute('data-operation') ?? '',
        outcome: priorityResult.getAttribute('data-outcome') ?? '',
        baseRevision: Number(priorityResult.getAttribute('data-base-revision') ?? '-1'),
        currentRevision: Number(priorityResult.getAttribute('data-current-revision') ?? '-1'),
        acceptedRevision: priorityAcceptedRevisionText === '' ? null : Number(priorityAcceptedRevisionText),
      };
      const postResolutionText = (document.querySelector('[data-testid="online-remote-post-resolution"]')?.textContent ?? '').trim();
      const postResolution = postResolutionText === '' ? null : postResolutionText;
      const recentResolutionObjectId = remoteRail?.hasAttribute('data-recent-resolution-object-id') ? remoteRail.getAttribute('data-recent-resolution-object-id') || null : null;
      const recentResolutionRevisionText = remoteRail?.hasAttribute('data-recent-resolution-revision') ? remoteRail.getAttribute('data-recent-resolution-revision') ?? '' : '';
      const recentResolutionRevision = recentResolutionRevisionText === '' ? null : Number(recentResolutionRevisionText);
      const priorityWindowKind = remoteRail?.hasAttribute('data-priority-window-kind') ? remoteRail.getAttribute('data-priority-window-kind') ?? '' : undefined;
      const phase = document.querySelector('[data-testid="phase-indicator"]')?.getAttribute('data-phase') ?? '';
      const eliminated = [...outcomeText.matchAll(/\\b(P\\d+)\\s*:\\s*(?:敗北|投了)/gu)].map((match) => match[1] ?? '').filter(Boolean);
      const activeSeatCount = [...outcomeText.matchAll(/\\bP\\d+\\s*:\\s*進行中/gu)].length;
      const resources = performance.getEntriesByType('resource');
      if (resources.length >= ${String(MAX_RESOURCE_ENTRIES_V1)}) leakScanComplete = false;
      const workerObserved = resources.slice(0, ${String(MAX_RESOURCE_ENTRIES_V1)})
        .map((entry) => entry.name).some((name) => { try { return new URL(name, location.href).origin === ${JSON.stringify(workerOrigin)}; } catch { return false; } });
      const visible = (node) => {
        if (!(node instanceof HTMLElement)) return false;
        const style = getComputedStyle(node); const rect = node.getBoundingClientRect();
        return !node.hidden && node.getAttribute('aria-hidden') !== 'true' && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') > 0 && rect.width > 0 && rect.height > 0;
      };
      const rectOf = (node) => {
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
      const seatRects = [...document.querySelectorAll('[data-testid="online-remote-opponent"]')].map((node) => rectOf(node)).filter((value) => value !== null);
      const boardRects = [...document.querySelectorAll('.online-remote-rail__opponent-lane')].map((node) => rectOf(node)).filter((value) => value !== null);
      const primaryNode = railNode === null ? null : [...railNode.querySelectorAll('button.online-remote-rail__primary-action')].find((node) => visible(node) && !node.disabled) ?? null;
      const primaryRect = rectOf(primaryNode);
      const primaryAction = primaryRect === null ? null : { rect: primaryRect, enabled: true };
      const panelNode = document.querySelector('[data-testid="online-remote-guided-overlay"][open], [data-testid="online-remote-manual-overlay"][open]');
      const panel = rectOf(panelNode);
      const scrollNode = [panelNode, railNode, handNode, document.querySelector('[data-testid="hand-cards"]')]
        .find((node) => visible(node) && ['auto', 'scroll'].some((value) => { const style = getComputedStyle(node); return style.overflow === value || style.overflowX === value || style.overflowY === value; }) && (node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth)) ?? null;
      const scrollRect = rectOf(scrollNode);
      const scrollElement = scrollNode;
      let scrollMoved = false;
      let focusReachable = false;
      if (scrollRect !== null && scrollElement !== null) {
        const previousTop = scrollElement.scrollTop;
        const previousLeft = scrollElement.scrollLeft;
        const targetTop = scrollElement.scrollHeight > scrollElement.clientHeight ? Math.min(previousTop + 1, scrollElement.scrollHeight - scrollElement.clientHeight) : previousTop;
        const targetLeft = scrollElement.scrollWidth > scrollElement.clientWidth ? Math.min(previousLeft + 1, scrollElement.scrollWidth - scrollElement.clientWidth) : previousLeft;
        scrollElement.scrollTop = targetTop;
        scrollElement.scrollLeft = targetLeft;
        scrollMoved = scrollElement.scrollTop !== previousTop || scrollElement.scrollLeft !== previousLeft;
        scrollElement.scrollTop = previousTop;
        scrollElement.scrollLeft = previousLeft;
        const previousActive = document.activeElement;
        const focusTarget = [...scrollElement.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].find((node) => visible(node));
        if (focusTarget instanceof HTMLElement) {
          focusTarget.focus();
          focusReachable = scrollElement.contains(document.activeElement);
          if (previousActive instanceof HTMLElement) previousActive.focus();
        }
      }
      const scroll = scrollRect === null || scrollElement === null ? null : { rect: scrollRect, scrollWidth: scrollElement.scrollWidth, scrollHeight: scrollElement.scrollHeight, clientWidth: scrollElement.clientWidth, clientHeight: scrollElement.clientHeight, scrollMoved, focusReachable };
      const overlaps = (left, right) => left !== null && right !== null && left.right > right.x && right.right > left.x && left.bottom > right.y && right.bottom > left.y;
      const insideViewport = (value) => value !== null && value.x >= 0 && value.y >= 0 && value.right <= viewportRect.width && value.bottom <= viewportRect.height;
      const intersectionArea = (left, right) => {
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
        seatRects,
        boardRects,
        primaryAction,
        panel,
        scroll,
        clippedPrimaryAction: primaryRect !== null && !insideViewport(primaryRect),
        railHandCollision: overlaps(rail, hand),
        panelOutsideViewport: panel !== null && !insideViewport(panel),
        scrollAccessible: scroll !== null && insideViewport(scroll.rect) && scroll.clientWidth > 0 && scroll.clientHeight > 0 && scroll.scrollMoved && scroll.focusReachable,
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
        opponentLeak,
        leakScanComplete,
        privateLookControl: document.querySelector('[data-testid="visibility-look"]') !== null,
        chooseControl: document.querySelector('[data-testid^="visibility-choose-"]') !== null,
        manualStackControl: document.querySelector('[data-testid="online-tabletop-submit-stack-entry"]') !== null,
        manualResolveControl: document.querySelector('[data-testid="online-tabletop-submit-manual-resolve"]') !== null,
        stackCount,
        stackTopObjectId,
        castSettlement,
        prioritySettlement,
        publicPlayerIds,
        localPlayerId,
        disconnectedPlayerIds,
        recoveryOutcome,
        sharedPublicDigest,
        priorityHolds,
        priorityHolderPlayerId,
        priorityStewardPlayerId: stewardPlayerId,
        priorityWindowKind,
        recentResolutionObjectId,
        recentResolutionRevision,
        postResolution,
        consoleErrors,
        workerObserved,
      };
    })()` , { fragments: secretFragments }),
    new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('page probe timeout')), timeoutMs)),
  ]);
  const consoleErrors = page.consoleCounts().errors;
  if (!probe.leakScanComplete) throw new Error('bounded leak scan incomplete');
  return Object.freeze({ ...probe, consoleErrors });
}

function priorityPresenceSignature(probe: O4p09iProbeV1): string {
  return JSON.stringify({
    holder: probe.priorityHolderPlayerId,
    steward: probe.priorityStewardPlayerId,
    window: probe.priorityWindowKind,
    holds: probe.priorityHolds,
    stackCount: probe.stackCount,
    stackTopObjectId: probe.stackTopObjectId,
  });
}

async function waitForPeerDisconnected(
  pages: readonly O4p09iPageV1[],
  playerId: string,
  revision: number,
  workerOrigin: string,
  timeoutMs: number,
  secretFragments: readonly string[],
): Promise<readonly O4p09iProbeV1[]> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const probes = await Promise.all(pages.map((page) => probePage(page, Math.min(1_000, timeoutMs), workerOrigin, secretFragments)));
    const digests = probes.map((probe) => probe.sharedPublicDigest);
    if (probes.length > 0
      && probes.every((probe) => probe.revision === revision && probe.disconnectedPlayerIds.includes(playerId))
      && digests.every((digest) => /^[0-9a-f]{64}$/u.test(digest) && digest === digests[0])) return Object.freeze(probes);
    if (Date.now() >= deadline) throw new Error('peer disconnected presence not observed');
    await new Promise<void>((resolve) => setTimeout(resolve, Math.min(25, Math.max(1, deadline - Date.now()))));
  }
}

async function waitForReconnectConvergence(
  pages: readonly O4p09iPageV1[],
  recoveredPage: O4p09iPageV1,
  revision: number,
  sharedPublicDigest: string,
  prioritySignature: string,
  workerOrigin: string,
  timeoutMs: number,
  secretFragments: readonly string[],
): Promise<readonly O4p09iProbeV1[]> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const probes = await Promise.all(pages.map((page) => probePage(page, Math.min(1_000, timeoutMs), workerOrigin, secretFragments)));
    const recovered = probes[pages.indexOf(recoveredPage)];
    const rejoined = recovered?.recoveryOutcome === 'rejoined';
    const revisions = probes.every((probe) => probe.revision === revision);
    const presence = probes.every((probe) => probe.disconnectedPlayerIds.length === 0);
    const digests = probes.every((probe) => probe.sharedPublicDigest === sharedPublicDigest);
    const priority = probes.every((probe) => priorityPresenceSignature(probe) === prioritySignature);
    if (rejoined && revisions && presence && digests && priority) return Object.freeze(probes);
    const lastFailure = `rejoined=${String(rejoined)},revision=${String(revisions)},presence=${String(presence)},digest=${String(digests)},priority=${String(priority)}`;
    if (Date.now() >= deadline) throw new Error(`reconnect convergence not observed/${lastFailure}`);
    await new Promise<void>((resolve) => setTimeout(resolve, Math.min(25, Math.max(1, deadline - Date.now()))));
  }
}

async function readRemoteCastObjectId(page: O4p09iPageV1, timeoutMs: number): Promise<string> {
  return Promise.race([
    page.evaluate<string>(`(() => {
      const node = [...document.querySelectorAll('[data-testid="online-remote-cast"]')]
        .find((candidate) => candidate instanceof HTMLButtonElement && !candidate.disabled);
      if (!(node instanceof HTMLButtonElement)) throw new Error('cast control unavailable');
      const objectId = node.getAttribute('data-object-id') ?? '';
      if (objectId === '') throw new Error('cast object missing');
      return objectId;
    })()`),
    new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error('cast object timeout')), timeoutMs)),
  ]);
}

async function waitForRemoteCastEvidence(
  pages: readonly O4p09iPageV1[],
  senderPage: O4p09iPageV1,
  castObjectId: string,
  playerCount: 2 | 4,
  workerOrigin: string,
  timeoutMs: number,
  secretFragments: readonly string[],
): Promise<RemoteCastJourneyFactV1> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const probes = await Promise.all(pages.map((page) => probePage(page, Math.min(timeoutMs, Math.max(250, deadline - Date.now())), workerOrigin, secretFragments)));
    const senderIndex = pages.indexOf(senderPage);
    const senderReceipt = probes[senderIndex]?.castSettlement ?? null;
    const checked = validateRemoteCastJourneyObservationV1({
      kind: 'remote-cast-journey-observation-v1',
      castObjectId,
      senderReceipt,
      seats: probes.map((probe) => ({
        revision: probe.revision,
        stackCount: probe.stackCount,
        topObjectId: probe.stackTopObjectId,
      })),
    }, playerCount);
    if (checked.ok) return checked.value;
    if (Date.now() >= deadline) throw new Error(`cast evidence ${checked.code}`);
    await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, Math.min(25, Math.max(1, deadline - Date.now()))));
  }
}

async function driveScenario(browser: O4p09iBrowserV1, playerCount: 2 | 4, pagesOrigin: string, workerOrigin: string, timeoutMs: number, secretFragments: string[], counters: { contextsClosed: number; pagesClosed: number }, deckTexts: readonly string[], lifetimeConsole: O4p09iConsoleAccumulatorV1): Promise<O4p09iScenarioFactV1> {
  const contexts: O4p09iContextV1[] = [];
  const pages: O4p09iPageV1[] = [];
  const consoleSnapshots = new WeakSet<object>();
  const snapshotConsole = (page: O4p09iPageV1): void => {
    if (consoleSnapshots.has(page)) return;
    consoleSnapshots.add(page);
    const counts = page.consoleCounts();
    lifetimeConsole.errors += counts.errors;
    lifetimeConsole.warnings += counts.warnings;
    lifetimeConsole.secretViolations += counts.secretViolations ?? 0;
  };
  let revisionBeforeReconnect: number;
  let revisionAfterReconnect: number | undefined;
  let initialRevision = 0;
  let manualDamageCount = 0;
  let castFact: RemoteCastJourneyFactV1 | null = null;
  const prioritySteps: RemotePriorityJourneyObservationV1['steps'][number][] = [];
  let priorityFact: RemotePriorityJourneyFactV1 | null = null;
  let priorityCapturedTopObjectId: string | null = null;
  let castObjectId: string | null = null;
  let manualStackPage: O4p09iPageV1 | null = null;
  let manualStackOperation: 'entry' | 'resolve' | null = null;
  let chooseObserved = false;
  let crossSeatPrivateChoiceLeak = false;
  let stage: O4p09iScenarioStageV1 = 'import';
  const setStage = (next: O4p09iScenarioStageV1): void => {
    if (!SCENARIO_STAGES.includes(next)) throw new Error('scenario stage invalid');
    stage = next;
  };
  const startedSurfaceFailureState: { reason: O4p09iStartedSurfaceFailureV1 | null } = { reason: null };
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
    'online-remote-sba-stable': 'response/pass/resolve',
    'online-journey-play-land': 'land',
    'online-remote-cast': 'cast',
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
    setStage('import');
    await importDeckAndOpenOnline(hostPage, deckTexts[0] ?? '', timeoutMs);
    setStage('lobby-probe');
    const lobby = await probePage(hostPage, timeoutMs, workerOrigin, secretFragments);
    if (lobby.gameScreens > 1 || lobby.overflow !== 0 || lobby.opponentLeak || lobby.consoleErrors !== 0) throw new Error('production lobby probe failed');
    setStage('create-room');
    await clickVisible(hostPage, 'online-create-shared', timeoutMs); recordControl('online-create-shared');
    await waitForVisible(hostPage, 'online-invite-link-copy', timeoutMs, 'online-error');
    setStage('reveal-invite');
    await clickButtonByText(hostPage, 'コードを表示', timeoutMs);
    setStage('read-invite');
    const invite = await readInvite(hostPage, timeoutMs);
    if (!safeString(invite)) throw new Error('invite value malformed');
    // Correlate every visible join form with this room without retaining or
    // emitting the raw invite value.  The digest is runtime-only.
    const roomFingerprint = sha256(invite);
    // Invite values are runtime-only and become scanner fragments; they never
    // enter the evidence summary.
    secretFragments.push(invite);
    setStage('host-deck-submit');
    await clickVisible(hostPage, 'online-submit-deck', timeoutMs); recordControl('online-submit-deck');
    setStage('host-ready');
    await clickVisible(hostPage, 'online-ready-toggle', timeoutMs); recordControl('online-ready-toggle');

    for (let index = 1; index < playerCount; index += 1) {
      const context = await browser.createBrowserContext(); contexts.push(context);
      const page = await context.createPage(); pages.push(page);
      pageSetSecret(page, secretFragments);
      await page.navigate(pagesOrigin);
      setStage('join-seat-import');
      await importDeckAndOpenOnline(page, deckTexts[index] ?? '', timeoutMs);
      const initial = await probePage(page, timeoutMs, workerOrigin, secretFragments);
      if (initial.gameScreens > 1 || initial.overflow !== 0 || initial.opponentLeak || initial.consoleErrors !== 0) throw new Error('production join probe failed');
      setStage('join-seat-join');
      await clickVisible(page, 'online-open-join', timeoutMs);
      await fillVisible(page, 'online-shared-invite', invite, timeoutMs);
      if ((await digestVisibleInput(page, 'online-shared-invite')) !== roomFingerprint) throw new Error('join room correlation failed');
      await clickVisible(page, 'online-join-shared', timeoutMs);
      setStage('join-seat-deck');
      await clickVisible(page, 'online-submit-deck', timeoutMs); recordControl('online-submit-deck');
      setStage('join-seat-ready');
      await clickVisible(page, 'online-ready-toggle', timeoutMs); recordControl('online-ready-toggle');
    }
    setStage('start-game');
    await waitForLobbyReady(hostPage, playerCount, timeoutMs);
    await clickVisible(hostPage, 'online-start-game', timeoutMs); recordControl('online-start-game');
    setStage('start-probe');
    // Give the production start transition its own bounded window; injected
    // short-timeout harnesses retain their explicit deadline for fast tests.
    const startSurfaceTimeoutMs = timeoutMs === O4P09I_DEFAULT_TIMEOUT_MS_V1 ? O4P09I_START_SURFACE_TIMEOUT_MS_V1 : timeoutMs;
    for (const page of pages) {
      const started = await waitForStartedSurface(page, page === hostPage, workerOrigin, startSurfaceTimeoutMs, secretFragments, startedSurfaceFailureState);
      if (page === hostPage) initialRevision = started.revision;
    }

    for (const testId of PREGAME_SEQUENCE) {
      setStage('pregame-control');
      await drivePregamePhase(pages, playerCount, testId, workerOrigin, timeoutMs, secretFragments, recordControl);
    }

    // Pregame and game controls are driven on the host surface after every
    // seat has joined.  Each successful click is recorded as an observed
    // action; missing/disabled controls fail closed.
    for (const testId of UI_SEQUENCE) {
      if (testId === 'online-advance-to-main') {
        setStage('advance');
        await advanceUntilPhase(pages, 'main1', workerOrigin, timeoutMs, secretFragments, recordControl);
        recordControl(testId);
        continue;
      }
      if (testId === 'online-journey-play-land') {
        setStage('land');
        await selectFirstVisibleOption(hostPage, 'online-journey-land', timeoutMs);
      }
      if (testId === 'online-remote-cast') {
        setStage('cast');
        castObjectId = await readRemoteCastObjectId(hostPage, timeoutMs);
      }
      if (testId === 'online-remote-advance') {
        setStage('HOLD-pass-resolve');
        const capturedTopObjectId = (await probePage(hostPage, timeoutMs, workerOrigin, secretFragments)).stackTopObjectId;
        if (capturedTopObjectId === null) throw new Error('priority captured top missing');
        priorityCapturedTopObjectId = capturedTopObjectId;
        // The first priority cycle is completed before entering combat. HOLD,
        // pass and resolve remain legal actions for their current seat only.
        const clearHold = await findPriorityActorPage(pages, 'online-remote-hold', timeoutMs, true, 'none');
        const setRevision = await clickPriorityAndAwaitConvergence(pages, clearHold.page, 'online-remote-hold', clearHold.revision, workerOrigin, timeoutMs, secretFragments);
        if (playerCount === 2) prioritySteps.push(await readPriorityJourneyStep(pages, clearHold.page, 'priority-hold', capturedTopObjectId, workerOrigin, timeoutMs, secretFragments));
        const setHold = await findPriorityActorPage(pages, 'online-remote-hold', timeoutMs, true, 'owned-by-designated');
        if (setHold.revision < setRevision) throw new Error('online-remote-hold set revision stale');
        recordControl('online-remote-hold');
        const clearRevision = await clickPriorityAndAwaitConvergence(pages, setHold.page, 'online-remote-hold', setHold.revision, workerOrigin, timeoutMs, secretFragments);
        const clearedHold = await findPriorityActorPage(pages, 'online-remote-hold', timeoutMs, true, 'none');
        if (clearedHold.revision < clearRevision) throw new Error('online-remote-hold clear revision stale');
        if (playerCount === 2) prioritySteps.push(await readPriorityJourneyStep(pages, setHold.page, 'priority-hold', capturedTopObjectId, workerOrigin, timeoutMs, secretFragments));
        recordControl('online-remote-hold');
        for (let pass = 0; pass < playerCount; pass += 1) {
          const passActor = await findPriorityActorPage(
            pages, 'online-remote-pass',
            timeoutMs,
            false
          );
          await clickPriorityAndAwaitConvergence(
            pages,
            passActor.page, 'online-remote-pass',
            passActor.revision,
            workerOrigin, timeoutMs, secretFragments); recordControl('online-remote-pass');
          if (playerCount === 2) prioritySteps.push(await readPriorityJourneyStep(pages, passActor.page, 'priority-pass', capturedTopObjectId, workerOrigin, timeoutMs, secretFragments));
        }
        const resolveActor = await findPriorityActorPage(
          pages,
          'online-remote-resolve',
          timeoutMs,
          false
        );
        const resolveRevision = await clickPriorityAndAwaitConvergence(
          pages,
          resolveActor.page, 'online-remote-resolve',
          resolveActor.revision,
          workerOrigin, timeoutMs, secretFragments); recordControl('online-remote-resolve');
        if (playerCount === 2) prioritySteps.push(await readPriorityJourneyStep(pages, resolveActor.page, 'priority-resolve', capturedTopObjectId, workerOrigin, timeoutMs, secretFragments));
        await waitForResolvedTopConvergence(
          pages,
          capturedTopObjectId,
          resolveRevision,
          workerOrigin,
          timeoutMs,
          secretFragments
        );
        await advanceUntilPhase(pages, 'combat', workerOrigin, timeoutMs, secretFragments, recordControl);
        recordControl(testId);
        continue;
      }
      if (testId === 'online-guided-declare-attacker') {
        setStage('attacker');
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
        setStage('manual-damage');
        await selectFirstVisibleOption(hostPage, 'online-manual-damage-defender', timeoutMs);
        // First combat damage is deliberately nonlethal; the final repeated
        // entry (after private/manual semantics) is the lethal branch.
        await fillVisible(hostPage, 'online-manual-damage-amount', manualDamageCount === 0 ? '1' : '120', timeoutMs);
        manualDamageCount += 1;
      }
      if (testId === 'online-tabletop-submit-stack-entry') {
        setStage('manual-stack');
        manualStackOperation = 'entry';
        manualStackPage = await findManualStackActorPage(pages, timeoutMs);
        await fillVisible(manualStackPage, 'online-tabletop-stack-entry-id', 'manual-stack-entry', timeoutMs);
        await fillVisible(manualStackPage, 'online-tabletop-stack-label', '公開手動項目', timeoutMs);
      }
      if (testId === 'visibility-look') {
        setStage('visibility');
        await selectFirstVisibleOption(hostPage, 'visibility-look-subject', timeoutMs);
        await selectFirstVisibleOption(hostPage, 'visibility-look-viewers', timeoutMs);
      }
      if (testId === 'online-remote-guided-overlay' || testId === 'online-remote-manual-overlay') {
        setStage('manual-stack');
        await toggleDetails(hostPage, testId, timeoutMs);
        recordControl(testId);
        continue;
      }
      if (testId === 'online-tabletop-submit-manual-resolve') {
        setStage('manual-stack');
        manualStackOperation = 'resolve';
        manualStackPage = await findManualResolveActorPage(pages, timeoutMs);
      }
      if (!STAGE_HANDLED_UI_CONTROLS.has(testId)) setStage('ui-action');
      const actionPage =
        testId === 'online-tabletop-submit-stack-entry' || testId === 'online-tabletop-submit-manual-resolve'
          ? (manualStackPage ?? hostPage)
          : hostPage;
      const actionBaseline = REVISION_CONTROLS.has(testId) ? (await probePage(actionPage, timeoutMs, workerOrigin, secretFragments)).revision : null;
      await clickVisible(actionPage, testId, timeoutMs); recordControl(testId);
      if (actionBaseline !== null) await waitForRevisionAdvance(actionPage, workerOrigin, actionBaseline, timeoutMs, secretFragments);
      if (testId === 'online-remote-cast') {
        if (castObjectId === null) throw new Error('cast object missing');
        castFact = await waitForRemoteCastEvidence(pages, hostPage, castObjectId, playerCount, workerOrigin, timeoutMs, secretFragments);
      }
      if (testId === 'visibility-look') {
        setStage('private-leak-check');
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

    setStage('post-actions');
    const postActions = await waitForJourneyEvidence(hostPage, playerCount, workerOrigin, initialRevision, timeoutMs, secretFragments);
    revisionBeforeReconnect = postActions.revision;
    if (postActions.gameScreens !== 1 || postActions.overflow !== 0 || postActions.opponentLeak || postActions.consoleErrors !== 0 || !postActions.workerObserved) throw new Error('post-action surface/worker probe failed');

    // Resize every live page and collect measured DOM facts rather than
    // asserting a host-only or constant viewport matrix.  This keeps the
    // opponent lanes observable for every seat at every required size.
    if (pages.some((page) => page.setViewport === undefined)) throw new Error('viewport adapter required');
    setStage('viewport-geometry');
    const measuredViewports: O4p09iViewportFactV1[] = [];
    for (const viewport of VIEWPORTS) {
      for (const page of pages) await page.setViewport?.(viewport);
      const measuredPages = await Promise.all(pages.map((page) => probePage(page, timeoutMs, workerOrigin, secretFragments)));
      const reference = measuredPages[0];
      if (reference === undefined) throw new Error('responsive page probe missing');
      const referenceSeatSignature = rectSignature(reference.geometry.seatRects);
      const referenceBoardSignature = rectSignature(reference.geometry.boardRects);
      for (const measured of measuredPages) {
        const geometry = measured.geometry;
        if (measured.gameScreens !== 1 || measured.overflow !== 0 || measured.consoleErrors !== 0 || measured.opponentLeak || !measured.workerObserved || geometry.viewport.width !== viewport.width || geometry.viewport.height !== viewport.height || geometry.seatRects.length !== playerCount - 1 || geometry.boardRects.length !== playerCount - 1 || geometry.rail === null || geometry.hand === null || geometry.battlefield === null || geometry.primaryAction === null || geometry.panel === null || geometry.scroll === null || geometry.primaryAction.enabled !== true || geometry.clippedPrimaryAction || geometry.railHandCollision || geometry.panelOutsideViewport || !geometry.scrollAccessible || geometry.battlefieldObscured) throw new Error('responsive surface/geometry/worker probe failed');
        if (rectSignature(geometry.seatRects) !== referenceSeatSignature || rectSignature(geometry.boardRects) !== referenceBoardSignature) throw new Error('responsive public lane geometry mismatch');
      }
      measuredViewports.push(Object.freeze({ width: viewport.width, height: viewport.height, horizontalOverflow: reference.overflow, gameScreens: reference.gameScreens, consoleErrors: reference.consoleErrors, geometry: cloneGeometry(reference.geometry), pageGeometries: Object.freeze(measuredPages.map((measured) => cloneGeometry(measured.geometry))) }));
    }
    const viewportFacts = Object.freeze(measuredViewports);

    setStage('reconnect');
    const disconnectedPage = pages[0];
    if (disconnectedPage === undefined) throw new Error('reconnect page missing');
    const beforeReconnectProbes = await Promise.all(pages.map((page) => probePage(page, timeoutMs, workerOrigin, secretFragments)));
    const beforeReconnect = beforeReconnectProbes[0];
    if (beforeReconnect === undefined || beforeReconnect.localPlayerId === null || beforeReconnect.localPlayerId === undefined) throw new Error('reconnect seat identity missing');
    const disconnectedPlayerId = beforeReconnect.localPlayerId;
    const sharedPublicDigestBeforeReconnect = beforeReconnect.sharedPublicDigest;
    const prioritySignatureBeforeReconnect = priorityPresenceSignature(beforeReconnect);
    const privateHandBeforeReconnect = await readPrivateHandPayload(disconnectedPage, timeoutMs);
    if (!/^[0-9a-f]{64}$/u.test(sharedPublicDigestBeforeReconnect)
      || beforeReconnectProbes.some((probe) => probe.revision !== revisionBeforeReconnect
        || probe.disconnectedPlayerIds.length !== 0
        || probe.sharedPublicDigest !== sharedPublicDigestBeforeReconnect
        || priorityPresenceSignature(probe) !== prioritySignatureBeforeReconnect)) throw new Error('pre-reconnect convergence missing');
    for (const peer of pages.slice(1)) {
      const surfaces = await readUnauthorizedDomSurfaces(peer, timeoutMs);
      if (privateHandBeforeReconnect.tokens.some((token) => surfaces.some((surface) => surface.includes(token)))) throw new Error('pre-reconnect private audience leak');
    }
    snapshotConsole(disconnectedPage);
    await disconnectedPage.close(); counters.pagesClosed += 1;
    await waitForPeerDisconnected(pages.slice(1), disconnectedPlayerId, revisionBeforeReconnect, workerOrigin, timeoutMs, secretFragments);
    const replacement = await contexts[0]?.createPage();
    if (replacement === undefined) throw new Error('reconnect page missing');
    pages[0] = replacement;
    pageSetSecret(replacement, secretFragments);
    await replacement.navigate(pagesOrigin);
    await openOnlineFromSavedDeck(replacement, timeoutMs);
    const recoveredProbes = await waitForReconnectConvergence(pages, replacement, revisionBeforeReconnect, sharedPublicDigestBeforeReconnect, prioritySignatureBeforeReconnect, workerOrigin, timeoutMs, secretFragments);
    const recovered = recoveredProbes[0];
    if (recovered === undefined) throw new Error('reconnect recovery probe missing');
    const recoveredPrivateHand = await readPrivateHandPayload(replacement, timeoutMs);
    if (recoveredPrivateHand.digest !== privateHandBeforeReconnect.digest) throw new Error('reconnect private audience mismatch');
    for (const peer of pages.slice(1)) {
      const surfaces = await readUnauthorizedDomSurfaces(peer, timeoutMs);
      if (privateHandBeforeReconnect.tokens.some((token) => surfaces.some((surface) => surface.includes(token)))) throw new Error('reconnect private audience leak');
    }
    revisionAfterReconnect = recovered.revision;
    if (!safeRevision(revisionAfterReconnect) || revisionAfterReconnect !== revisionBeforeReconnect) throw new Error('reconnect continuity probe failed');
    if (recoveredProbes.some((probe) => probe.gameScreens !== 1 || probe.overflow !== 0 || probe.opponentLeak || probe.consoleErrors !== 0 || !probe.workerObserved || probe.revision !== revisionAfterReconnect)) throw new Error('reconnect continuity probe failed');
    const observedEliminatedSeats = recoveredProbes.flatMap((probe) => probe.eliminatedSeats);
    const uniqueEliminatedSeats = [...new Set(observedEliminatedSeats)];
    if (uniqueEliminatedSeats.length !== 1 || recoveredProbes.some((probe) => probe.eliminatedSeats.length !== 1 || probe.eliminatedSeats[0] !== uniqueEliminatedSeats[0])) throw new Error('reconnect outcome continuity failed');
    let observedOutcome: O4p09iScenarioFactV1['outcome'];
    if (playerCount === 2) {
      if (!recoveredProbes.every((probe) => probe.winner)) throw new Error('winner outcome not observed');
      observedOutcome = 'winner';
    } else {
      if (!recoveredProbes.every((probe) => probe.activeSeatCount === 3)) throw new Error('active seats outcome not observed');
      observedOutcome = 'three-continue';
    }
    // Snapshot every still-live seat (replacement plus peers) before making
    // the zero-counter acceptance decision.  The WeakSet keeps finally from
    // double-counting these pages when they are closed.
    for (const page of pages) snapshotConsole(page);
    if (lifetimeConsole.errors !== 0 || lifetimeConsole.warnings !== 0 || lifetimeConsole.secretViolations !== 0) throw new Error('browser console or secret violation observed');
    phases.add('disconnect/reconnect');
    if (phases.size !== MATCH_PHASES.length || MATCH_PHASES.some((phase) => !phases.has(phase))) throw new Error('journey phases incomplete');
    setStage('finalize');
    const privateLookChoose: O4p09iScenarioFactV1['privateLookChoose'] = Object.freeze({ look: postActions.privateLookControl as true, choose: chooseObserved as true, crossSeatLeak: crossSeatPrivateChoiceLeak });
    const unsupportedManual: O4p09iScenarioFactV1['unsupportedManual'] = Object.freeze({ stack: postActions.manualStackControl as true, resolve: postActions.manualResolveControl as true });
    if (castFact === null) throw new Error('cast evidence missing');
    if (playerCount === 2) {
      if (prioritySteps.length !== 5) throw new Error('priority evidence step count mismatch');
      const playerIds = prioritySteps.flatMap((step) => [step.actorPlayerId, ...step.seats.flatMap((seat) => [seat.holderPlayerId, seat.stewardPlayerId, ...seat.holds].filter((id): id is string => id !== null))]);
      const uniquePlayerIds = [...new Set(playerIds)];
      if (priorityCapturedTopObjectId === null) throw new Error('priority captured top missing');
      const observation = Object.freeze({ kind: 'remote-priority-journey-observation-v1' as const, playerIds: Object.freeze(uniquePlayerIds.slice(0, 2) as [string, string]), capturedTopObjectId: priorityCapturedTopObjectId, steps: Object.freeze(prioritySteps) });
      const checked = validateRemotePriorityJourneyObservationV1(observation);
      if (!checked.ok) throw new Error(`priority evidence ${checked.code}`);
      priorityFact = checked.value;
    }
    const reconnectFact: O4p09iScenarioFactV1['reconnect'] = Object.freeze({ revision: revisionAfterReconnect, peerObservedDisconnected: true, recoveredSeatRejoined: true, presenceConverged: true, sharedPublicDigestConverged: true, privateAudienceIsolated: true, priorityStatePreserved: true });
    return Object.freeze({
      playerCount,
      phases: Object.freeze(MATCH_PHASES.filter((phase) => phases.has(phase))),
      actionKinds: Object.freeze(actionKinds),
      cast: castFact,
      priority: priorityFact,
      revision: Object.freeze({ start: initialRevision, afterSharedMutation: revisionBeforeReconnect, afterReconnect: revisionAfterReconnect ?? revisionBeforeReconnect, continuous: true }),
      reconnect: reconnectFact,
      privateLookChoose,
      unsupportedManual,
      outcome: observedOutcome,
      eliminatedSeats: Object.freeze(uniqueEliminatedSeats),
      viewportFacts,
    });
  } catch (error) {
    const failedStage: string = stage;
    const message = error instanceof Error ? error.message : '';
    const failure = classifyO4p09iProductionFailureV1(error);
    if (failure.class === 'ENVIRONMENT')
      throw new Error(`production environment failure: ${failure.stage}`, { cause: error });
    if (failedStage === 'start-probe' && startedSurfaceFailureState.reason !== null && STARTED_SURFACE_FAILURES.includes(startedSurfaceFailureState.reason)) throw new Error(`production scenario stage failed: start-probe/${startedSurfaceFailureState.reason}`,
        { cause: error }
      );
    if (failedStage === 'manual-stack' && manualStackOperation !== null)
      throw new Error(`production scenario stage failed: manual-stack/${manualStackOperation}`, {
        cause: error
      });
    throw new Error(`production scenario stage failed: ${stage}/${message || 'unknown'}`, {
      cause: error
    });
  } finally {
    for (const page of pages) {
      snapshotConsole(page);
      try { await page.close(); counters.pagesClosed += 1; } catch { /* cleanup is checked by aggregate count */ }
    }
    for (const context of contexts) {
      try { await context.close(); counters.contextsClosed += 1; } catch { /* cleanup is checked by aggregate count */ }
    }
  }
}

function pageSetSecret(page: O4p09iPageV1, fragments: readonly string[]): void { page.setSecretFragments?.(fragments); }

export async function runO4p09iFullMatchEvidenceTestDriverV1(inputDeps: O4p09iEvidenceDepsV1 = {}): Promise<O4p09iSyntheticEvidenceSummaryV1> {
  const timeoutMs = inputDeps.timeoutMs ?? O4P09I_DEFAULT_TIMEOUT_MS_V1;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 250 || timeoutMs > 120_000) throw new Error('invalid evidence timeout');
  const pagesOrigin = inputDeps.pagesOrigin ?? O4P09I_PAGES_ORIGIN_V1;
  const workerOrigin = inputDeps.workerOrigin ?? O4P09I_WORKER_ORIGIN_V1;
  if (pagesOrigin !== O4P09I_PAGES_ORIGIN_V1 || workerOrigin !== O4P09I_WORKER_ORIGIN_V1) throw new Error('production origins are pinned');
  const browser = inputDeps.browser ?? (inputDeps.launchBrowser ? await inputDeps.launchBrowser() : await defaultBrowser(timeoutMs));
  if (browser === null) throw new Error('browser dependency required for production evidence');
  const secretFragments: string[] = [];
  const counters = { contextsClosed: 0, pagesClosed: 0 };
  const lifetimeConsole: O4p09iConsoleAccumulatorV1 = { errors: 0, warnings: 0, secretViolations: 0 };
  let scenarios: Readonly<{ readonly twoPlayer: O4p09iScenarioFactV1; readonly fourPlayer: O4p09iScenarioFactV1;
  }>;
  try {
    const deckTexts: string[] = inputDeps.readDeck === undefined
      ? [...O4P09I_PUBLIC_DECK_TEXTS_V1]
      : ['Celes', 'Gogo', 'Kefka', 'Muldrotha'].map((label) => inputDeps.readDeck?.(label) ?? '');
    for (const text of deckTexts) {
      if (typeof text !== 'string' || text.length === 0) throw new Error('deck input missing');
      secretFragments.push(sha256(text).slice(0, 16));
    }
    scenarios = Object.freeze({
      twoPlayer: await driveScenario(browser, 2, pagesOrigin, workerOrigin, timeoutMs, secretFragments, counters, deckTexts, lifetimeConsole),
      fourPlayer: await driveScenario(browser, 4, pagesOrigin, workerOrigin, timeoutMs, secretFragments, counters, deckTexts, lifetimeConsole),
    });
  } finally {
    // A browser/profile close failure invalidates the run; never emit a
    // summary that claims cleanup succeeded when the adapter did not close.
    await browser.close();
  }
  const profileRemoved = browser.profilePath === undefined || !existsSync(browser.profilePath);
  if (!profileRemoved) throw new Error('browser profile cleanup incomplete');
  if (lifetimeConsole.errors !== 0 || lifetimeConsole.warnings !== 0 || lifetimeConsole.secretViolations !== 0) throw new Error('browser console or secret violation observed');
  const summary: O4p09iEvidenceSummaryV1 = Object.freeze({
    kind: 'o4p-09i-full-match-production-evidence-v1', schemaVersion: 1,
    pagesOrigin: O4P09I_PAGES_ORIGIN_V1, workerOrigin: O4P09I_WORKER_ORIGIN_V1,
    chromeVersion: browser.chromeVersion,
    scenarios, consoleCounts: Object.freeze({ errors: lifetimeConsole.errors, warnings: lifetimeConsole.warnings, secretViolations: lifetimeConsole.secretViolations }),
    cleanup: Object.freeze({ contextsClosed: counters.contextsClosed, pagesClosed: counters.pagesClosed, profileRemoved: true as const }),
  });
  const checked = validateO4p09iFullMatchEvidenceV1(summary, secretFragments);
  if (!checked.ok) throw new Error(checked.issues[0] ?? 'evidence summary invalid');
  return Object.freeze({ ...checked.value, kind: 'o4p-09i-full-match-test-evidence-v1' });
}

export async function runO4p09iFullMatchEvidenceV1(inputDeps: O4p09iEvidenceDepsV1 = {}): Promise<O4p09iEvidenceSummaryV1> {
  if (inputDeps.browser !== undefined || inputDeps.launchBrowser !== undefined || inputDeps.readDeck !== undefined) throw new Error('production evidence does not accept injected seams');
  const synthetic = await runO4p09iFullMatchEvidenceTestDriverV1(inputDeps);
  return Object.freeze({ ...synthetic, kind: 'o4p-09i-full-match-production-evidence-v1' });
}

async function main(): Promise<void> {
  const summary = await runO4p09iFullMatchEvidenceV1();
  output.write(`${JSON.stringify(canonical(summary))}\n`);
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) void main().catch((error: unknown) => {
    writeO4p09iJourneyFailureV1(process.env.JOURNEY_RESULT_PATH, error);
    process.exitCode = 1; });
