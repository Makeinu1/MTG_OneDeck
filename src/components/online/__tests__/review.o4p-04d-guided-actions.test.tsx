// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import fixture from '../../../online/workbench/fixtures/o4p-04a-personal-workbench-v1.json';
import {
  bindOnlineGuidedCommandActionV1,
  buildOnlineGuidedActionsViewV1,
  createOnlineGuidedActionV1,
  type OnlineGuidedActionV1,
} from '../../../online/guidedActions/index';
import { validateOnlineCommandEnvelopeV1 } from '../../../online/protocol/index';
import { OnlineGuidedActions } from '../OnlineGuidedActions';
import { OnlineDisplayPairing } from '../OnlineDisplayPairing';

type MutableRecord = Record<string, unknown>;
type MutableProjection = MutableRecord & {
  protocolVersion: number;
  roomId: string;
  participantId: string;
  role: string;
  corePlayerId: string | null;
  revision: number;
  room: {
    lifecycle: string;
    participants: Array<{ participantId: string; role: string; presence: string; seatIndex: number | null }>;
    seats: Array<{ seatIndex: number; corePlayerId: string; participantId: string | null; ready: boolean; outcome: string }>;
  };
  game: {
    turn: { activePlayerId: string; turnNumber: number; positionSequence: number; position: { phase: string; step: string | null } };
    players: Array<{ playerId: string; life: number; poison: number; status: string }>;
    searchSessions: unknown[];
    zones: {
      byPlayer: Array<{ playerId: string; zones: Record<'library' | 'hand' | 'graveyard', { count: number; entries: unknown[] }> }>;
      battlefield: { count: number; entries: unknown[] };
      stack: { count: number; entries: unknown[] };
      exile: { count: number; entries: unknown[] };
      command: { count: number; entries: unknown[] };
    };
  };
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function personal(): MutableProjection {
  const projection = clone(fixture) as unknown as MutableProjection;
  const candidate = clone(projection.game.zones.byPlayer[0]?.zones.hand.entries[0]);
  projection.game.searchSessions = [{
    sessionId: 'search-review-04d',
    rulesActorPlayerId: 'P1',
    selectorPlayerId: 'P1',
    zone: { kind: 'player-zone', playerId: 'P1', zone: 'hand' },
    portion: { kind: 'all' },
    criteria: { kind: 'quantity', minimum: 0, maximum: 1 },
    revealFound: false,
    shuffleAfter: false,
    candidates: [candidate],
  }];
  return projection;
}

function pair(): { personal: MutableProjection; table: MutableProjection } {
  const player = personal();
  player.room.participants.push({
    participantId: 'table-display', role: 'table', presence: 'connected', seatIndex: null,
  });
  const table = clone(player);
  table.participantId = 'table-display';
  table.role = 'table';
  table.corePlayerId = null;
  table.game.searchSessions = [];
  for (const group of table.game.zones.byPlayer) {
    for (const zoneName of ['library', 'hand'] as const) {
      const zone = group.zones[zoneName];
      zone.entries = Array.from({ length: zone.count }, () => ({ kind: 'hidden-card' }));
    }
  }
  return { personal: player, table };
}

function deeplyFrozen(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value !== 'object') return true;
  if (seen.has(value)) return true;
  seen.add(value);
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every((child) => deeplyFrozen(child, seen));
}

function action(projection: unknown, value: unknown): OnlineGuidedActionV1 {
  return createOnlineGuidedActionV1({ projection, action: value });
}

function session(projection: unknown): MutableRecord {
  return {
    protocolVersion: 1,
    roomId: 'room-o4p-04a-fixture',
    participantId: 'player-p1',
    participantCapability: 'seat_capability_AAAAAAAAAAAAAAAA',
    clientBuildId: 'o4p-04d-client-build',
    corePlayerId: 'P1',
    personalProjection: projection,
  };
}

function mountGuided(
  projection: unknown,
  interactionState: 'ready' | 'updating' | 'offline' = 'ready',
  actions: OnlineGuidedActionV1[] = [],
): { container: HTMLDivElement; root: Root } {
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => root.render(
    <OnlineGuidedActions
      projection={projection}
      interactionState={interactionState}
      onAction={(current) => actions.push(current)}
    />,
  ));
  return { container, root };
}

describe('O4P-04D Guided/Manual Actions review', () => {
  it('builds the exact fresh frozen truthful view without hidden reconstruction', () => {
    const projection = personal();
    const before = JSON.stringify(projection);
    const first = buildOnlineGuidedActionsViewV1(projection);
    const second = buildOnlineGuidedActionsViewV1(projection);

    expect(first).toMatchObject({
      kind: 'online-guided-actions-view-v1', schemaVersion: 1,
      revision: 12, actorPlayerId: 'P1', roomLifecycle: 'active',
      turn: { activePlayerId: 'P1', turnNumber: 4, phase: 'precombat-main', step: null },
    });
    expect(first.players.map((player) => player.playerId)).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(first.searchSessions).toEqual([expect.objectContaining({
      sessionId: 'search-review-04d', minimum: 0, maximum: 1, mayFailToFind: false,
      candidates: [{ objectId: 'PC3:0', label: '《森の知恵》' }],
    })]);
    expect(first.controlCandidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ objectId: 'PC1:0', label: '《森》', controllerPlayerId: 'P1' }),
    ]));
    expect(first.faceDownItems).toEqual([
      expect.objectContaining({ objectId: 'PC2:0', zone: 'battlefield', label: '《裏向きのカード》' }),
    ]);
    expect(first.corrections.commanders).toEqual([
      { objectId: 'PC5:0', label: '《研究者の統率者》' },
    ]);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.searchSessions).not.toBe(second.searchSessions);
    expect(deeplyFrozen(first)).toBe(true);
    expect(JSON.stringify(projection)).toBe(before);
    expect(Object.keys(first.faceDownItems[0] ?? {}).sort()).toEqual([
      'counters', 'label', 'markedDamage', 'objectId', 'phasedOut', 'tapped', 'zone',
    ]);
    expect(JSON.stringify(first.faceDownItems)).not.toMatch(/owner|controller|definition|oracle|physical|digest|capability/i);
  });

  it('creates every closed action without mutation, trimming, or false automation', () => {
    const projection = personal();
    const before = JSON.stringify(projection);
    const values = [
      action(projection, { kind: 'complete-search', actorPlayerId: 'P1', baseRevision: 12, sessionId: 'search-review-04d', selectedObjectIds: ['PC3:0'] }),
      action(projection, { kind: 'apply-control', actorPlayerId: 'P1', baseRevision: 12, effectKey: 'control-review', targetObjectId: 'PC1:0', gainingControllerPlayerId: 'P2', sourceObjectId: null, duration: { kind: 'manual' } }),
      action(projection, { kind: 'declare-attacker', actorPlayerId: 'P1', baseRevision: 12, attackerObjectId: 'PC1:0', defendingPlayerId: 'P2' }),
      action(projection, { kind: 'declare-blocker', actorPlayerId: 'P1', baseRevision: 12, blockerObjectId: 'PC1:0', attackedObjectId: 'PC1:0', defendingPlayerId: 'P2' }),
      action(projection, { kind: 'note-face-down', actorPlayerId: 'P1', baseRevision: 12, objectId: 'PC2:0', note: '  手動で確認  ' }),
      action(projection, { kind: 'request-life-correction', actorPlayerId: 'P1', baseRevision: 12, playerId: 'P2', replacementLifeTotal: 35, reason: '  紙の記録と照合  ' }),
      action(projection, { kind: 'note-commander-damage-correction', actorPlayerId: 'P1', baseRevision: 12, commanderObjectId: 'PC5:0', defendingPlayerId: 'P2', replacementDamageTotal: 7, reason: '  手動集計  ' }),
    ];
    expect(values.map((value) => value.kind)).toEqual([
      'complete-search', 'apply-control', 'declare-attacker', 'declare-blocker',
      'note-face-down', 'request-life-correction', 'note-commander-damage-correction',
    ]);
    expect(values[4]).toMatchObject({ note: '  手動で確認  ' });
    expect(values[5]).toMatchObject({ reason: '  紙の記録と照合  ' });
    expect(values.every((value) => deeplyFrozen(value))).toBe(true);
    expect(JSON.stringify(projection)).toBe(before);
    expect(() => action(projection, { kind: 'complete-search', actorPlayerId: 'P1', baseRevision: 12, sessionId: 'search-review-04d', selectedObjectIds: ['PC3:0', 'PC3:0'] })).toThrow();
    expect(() => action(projection, { kind: 'request-life-correction', actorPlayerId: 'P1', baseRevision: 12, playerId: 'P2', replacementLifeTotal: 35, reason: '   ' })).toThrow();
  });

  it('binds only four guided attempts to exact validator-accepted envelopes', () => {
    const projection = personal();
    const guided = [
      [action(projection, { kind: 'complete-search', actorPlayerId: 'P1', baseRevision: 12, sessionId: 'search-review-04d', selectedObjectIds: ['PC3:0'] }), 'review-search-13', 'search-complete'],
      [action(projection, { kind: 'apply-control', actorPlayerId: 'P1', baseRevision: 12, effectKey: 'control-review', targetObjectId: 'PC1:0', gainingControllerPlayerId: 'P2', sourceObjectId: null, duration: { kind: 'manual' } }), 'review-control-13', 'control-effect-apply'],
      [action(projection, { kind: 'declare-attacker', actorPlayerId: 'P1', baseRevision: 12, attackerObjectId: 'PC1:0', defendingPlayerId: 'P2' }), 'review-attack-13', 'combat-attack-add'],
      [action(projection, { kind: 'declare-blocker', actorPlayerId: 'P1', baseRevision: 12, blockerObjectId: 'PC1:0', attackedObjectId: 'PC1:0', defendingPlayerId: 'P2' }), 'review-block-13', 'combat-block-add'],
    ] as const;
    for (const [current, commandId, payloadKind] of guided) {
      const envelope = bindOnlineGuidedCommandActionV1({ session: session(projection), action: current, commandId });
      expect(envelope).toMatchObject({
        kind: 'online-command-envelope-v1', baseRevision: 12, commandId,
        command: {
          kind: 'mode-neutral-core-command-v1', schemaVersion: 1, sequence: 13,
          actorPlayerId: 'P1', decisionMakerPlayerId: 'P1',
          payload: { kind: payloadKind },
        },
      });
      expect(validateOnlineCommandEnvelopeV1(envelope).ok).toBe(true);
      expect(deeplyFrozen(envelope)).toBe(true);
      if (current.kind === 'complete-search') {
        expect(envelope.command.decisionContext).toEqual({ kind: 'search-session', searchSessionId: 'search-review-04d' });
      } else {
        expect(envelope.command.decisionContext).toEqual({ kind: 'decision', decisionKey: commandId });
      }
    }
  });

  it('rejects manual binding, drift, bearer fragments, and hostile roots without reflection', () => {
    const projection = personal();
    const manual = action(projection, { kind: 'note-face-down', actorPlayerId: 'P1', baseRevision: 12, objectId: 'PC2:0', note: 'LEAK_MANUAL' });
    expect(() => bindOnlineGuidedCommandActionV1({ session: session(projection), action: manual, commandId: 'manual-13' })).toThrow();

    const guided = action(projection, { kind: 'declare-attacker', actorPlayerId: 'P1', baseRevision: 12, attackerObjectId: 'PC1:0', defendingPlayerId: 'P2' });
    for (const input of [
      { session: session(projection), action: { ...guided, baseRevision: 11 }, commandId: 'attack-13' },
      { session: session(projection), action: guided, commandId: 'AAAAAAAA' },
      new Proxy({}, { ownKeys: () => { throw new Error('LEAK_PROXY'); } }),
    ]) {
      let message = '';
      try { bindOnlineGuidedCommandActionV1(input); } catch (error: unknown) { message = String(error); }
      expect(message).not.toMatch(/LEAK_|seat_capability|AAAAAAAA|PC1|P1|stack/i);
      expect(message.length).toBeGreaterThan(0);
    }
  });

  it('renders five truthful reachable sections and keeps offline actions disabled', () => {
    const ready = mountGuided(personal());
    expect(ready.container.querySelector('[data-testid="online-guided-actions"]')).not.toBeNull();
    for (const id of ['guided-control', 'guided-search', 'manual-face-down', 'guided-combat', 'manual-correction']) {
      expect(ready.container.querySelector(`[data-testid="${id}"]`), id).not.toBeNull();
    }
    expect(ready.container.textContent).toMatch(/コントロール.*ライブラリー探索.*裏向き情報.*戦闘.*手動修正/s);
    expect(ready.container.textContent).toContain('サーバーへ確認する');
    expect(ready.container.textContent?.match(/手動記録（未送信）/g)?.length).toBeGreaterThanOrEqual(2);
    expect(ready.container.innerHTML).not.toMatch(/expectedBeforeStateDigest|physicalCardId/i);
    expect(ready.container.querySelector<HTMLOptionElement>('option[value="PC2:0"]')?.textContent)
      .toBe('《裏向きのカード》 / battlefield');
    act(() => ready.root.unmount());

    const offline = mountGuided(personal(), 'offline');
    expect([...offline.container.querySelectorAll('button')].every((button) => button.disabled)).toBe(true);
    expect(offline.container.textContent).toContain('手動記録（未送信）');
    act(() => offline.root.unmount());
  });

  it('drops a confirmed action after same-reference same-revision candidate drift', () => {
    const projection = personal();
    const actions: OnlineGuidedActionV1[] = [];
    const container = document.createElement('div');
    const root = createRoot(container);
    const render = (): void => act(() => root.render(
      <OnlineGuidedActions
        projection={projection}
        interactionState="ready"
        onAction={(current) => actions.push(current)}
      />,
    ));
    render();

    const section = container.querySelector<HTMLElement>('[data-testid="guided-control"]');
    if (section === null) throw new Error('Missing guided control section');
    const selects = section.querySelectorAll<HTMLSelectElement>('select');
    act(() => {
      const target = selects[0];
      const controller = selects[1];
      if (target === undefined || controller === undefined) throw new Error('Missing control selects');
      target.value = 'PC1:0';
      target.dispatchEvent(new Event('change', { bubbles: true }));
      controller.value = 'P2';
      controller.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const form = section.querySelector('form');
    if (form === null) throw new Error('Missing control form');
    act(() => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(container.querySelector('[data-testid="guided-confirmation"]')).not.toBeNull();
    expect(actions).toEqual([]);

    projection.game.zones.battlefield.entries = projection.game.zones.battlefield.entries
      .filter((entry) => (entry as MutableRecord).objectId !== 'PC1:0');
    projection.game.zones.battlefield.count = projection.game.zones.battlefield.entries.length;
    render();

    expect(container.querySelector('[data-testid="guided-confirmation"]')).toBeNull();
    expect(container.querySelector('option[value="PC1:0"]')).toBeNull();
    expect(actions).toEqual([]);
    act(() => root.unmount());
  });

  it('fails generically and pairing drops every child after same-reference drift', () => {
    const getter = personal();
    Object.defineProperty(getter, 'revision', {
      enumerable: true, configurable: true, get: () => { throw new Error('LEAK_GETTER'); },
    });
    const hostile = mountGuided(getter);
    expect(hostile.container.textContent).toBe('表示できません');
    expect(hostile.container.innerHTML).not.toMatch(/LEAK_|getter|stack|error/i);
    act(() => hostile.root.unmount());

    const projections = pair();
    const container = document.createElement('div');
    const root = createRoot(container);
    const render = (): void => act(() => root.render(
      <OnlineDisplayPairing
        personalProjection={projections.personal}
        tableProjection={projections.table}
        interactionState="ready"
        focusedPlayerId={null}
        onFocus={() => undefined}
        onAction={() => undefined}
        onGuidedAction={() => undefined}
      />,
    ));
    render();
    expect(container.querySelector('[data-testid="online-guided-actions"]')).not.toBeNull();
    projections.table.revision += 1;
    render();
    expect(container.querySelector('[data-testid="online-display-pairing-unavailable"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="personal-workbench"]')).toBeNull();
    expect(container.querySelector('[data-testid="online-guided-actions"]')).toBeNull();
    expect(container.querySelector('[data-testid="table-display"]')).toBeNull();
    act(() => root.unmount());
  });
});
