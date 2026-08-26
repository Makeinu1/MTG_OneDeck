// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import type { OnlinePregameCommandV1, OnlinePregameProjectionV1 } from '../../../online/pregame/index';
import { PregameLayer, type OnlinePregamePresentationPort } from '../OnlinePregameLayer';

type FixturePlayerId = OnlinePregameProjectionV1['turnOrder'][number];
const P1 = 'P1' as FixturePlayerId;
const P2 = 'P2' as FixturePlayerId;

function projection(
  phase: OnlinePregameProjectionV1['phase'],
  currentPlayerId: OnlinePregameProjectionV1['currentPlayerId'],
  corePlayerId?: OnlinePregameProjectionV1['protocol']['corePlayerId'],
): OnlinePregameProjectionV1 {
  return {
    kind: 'online-pregame-projection-v1',
    schemaVersion: 1,
    revision: 3,
    phase,
    currentPlayerId,
    startingPlayerId: P1,
    turnOrder: [P1, P2],
    players: [
      { playerId: P1, commanderConfirmed: false, mulliganDecision: 'pending', mulligansTaken: 0, bottomCountRequired: phase === 'mulligan-bottom' ? 1 : 0, pendingBottomCount: 0, manualActionCount: 0, manualActionsComplete: false, ready: false },
      { playerId: P2, commanderConfirmed: false, mulliganDecision: 'pending', mulligansTaken: 0, bottomCountRequired: 0, pendingBottomCount: 0, manualActionCount: 0, manualActionsComplete: false, ready: false },
    ],
    protocol: {
      kind: 'online-participant-projection-v3',
      schemaVersion: 3,
      protocolVersion: 1,
      roomId: 'pregame-test-room',
      participantId: 'pregame-test-participant',
      role: 'player',
      corePlayerId: corePlayerId ?? P1,
      revision: 0,
      configuration: { playerCount: 2, startingLife: 40 },
      room: { lifecycle: 'started', hostParticipantId: 'pregame-test-host', participants: [], seats: [] },
      game: {
        turnOrder: [P1, P2],
        turn: {},
        players: [],
        zones: {
          command: { entries: [{ kind: 'visible-object', objectId: 'commander-1', commander: true, definition: { name: 'Test Commander' } }] },
          byPlayer: [{ playerId: 'P1', zones: { hand: { entries: [{ kind: 'visible-object', objectId: 'hand-1', definition: { name: 'Test Hand Card' } }, { kind: 'visible-object', objectId: 'hand-2', definition: { name: 'Test Hand Card 2' } }] } } }],
        },
        visibilityGrants: [],
        searchSessions: [],
        playPermissions: [],
      },
    },
  };
}

function port(value: OnlinePregameProjectionV1): OnlinePregamePresentationPort {
  return {
    projection: value,
    busy: false,
    connection: 'online',
    error: null,
    onConfirmCommanders: () => undefined,
    onMulliganDecision: () => undefined,
    onSubmitMulliganBottom: () => undefined,
    onRecordPregameAction: () => undefined,
    onCompletePregameActions: () => undefined,
    onSetReady: () => undefined,
  };
}

function interactivePort(value: OnlinePregameProjectionV1, commands: OnlinePregameCommandV1[]): OnlinePregamePresentationPort {
  return {
    projection: value,
    busy: false,
    connection: 'online',
    error: null,
    onConfirmCommanders: () => { commands.push({ kind: 'confirm-commanders' }); },
    onMulliganDecision: (decision) => { commands.push({ kind: 'declare-mulligan', decision }); },
    onSubmitMulliganBottom: (objectIds) => { commands.push({ kind: 'submit-mulligan-bottom', objectIds: objectIds as never }); },
    onRecordPregameAction: () => { commands.push({ kind: 'record-manual-pregame-action' }); },
    onCompletePregameActions: () => { commands.push({ kind: 'complete-pregame-actions' }); },
    onSetReady: () => { commands.push({ kind: 'set-ready', ready: true }); },
  };
}

afterEach(() => { document.body.replaceChildren(); });

describe('PregameLayer', () => {
  it('gates commander confirmation to the projected current actor', () => {
    const actor = renderToStaticMarkup(<PregameLayer port={port(projection('commander-reveal', P1))} />);
    const waiting = renderToStaticMarkup(<PregameLayer port={port(projection('commander-reveal', P2))} />);
    expect(actor).toContain('統率者を確認した');
    expect(actor).not.toMatch(/<button[^>]*disabled[^>]*>統率者を確認した/u);
    expect(waiting).toMatch(/<button[^>]*disabled[^>]*>統率者を確認した/u);
  });

  it('shows only own hand identities and gates the exact bottom count', () => {
    const markup = renderToStaticMarkup(<PregameLayer port={port(projection('mulligan-bottom', P1))} />);
    expect(markup).toContain('《Test Hand Card》');
    expect(markup).toContain('《Test Hand Card 2》');
    expect(markup).not.toContain('participantCapability');
    expect(markup).toMatch(/<button[^>]*disabled[^>]*>選んだカードを下へ置く/u);
  });

  it('activates commander confirmation with the keyboard while preserving focus', () => {
    const commands: OnlinePregameCommandV1[] = [];
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    act(() => { root.render(createElement(PregameLayer, { port: interactivePort(projection('commander-reveal', P1), commands) })); });
    const button = container.querySelector('[data-testid="pregame-confirm-commanders"]');
    if (!(button instanceof HTMLButtonElement)) throw new Error('Commander button missing');
    button.focus();
    act(() => { button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
    expect(commands).toEqual([{ kind: 'confirm-commanders' }]);
    expect(document.activeElement).toBe(button);
    act(() => { root.unmount(); });
  });

  it('supports interactive mulligan-bottom selection with an exact card count', () => {
    const commands: OnlinePregameCommandV1[] = [];
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    act(() => { root.render(createElement(PregameLayer, { port: interactivePort(projection('mulligan-bottom', P1), commands) })); });
    const checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"]'));
    const submit = container.querySelector('[data-testid="pregame-submit-bottom"]');
    if (checkboxes.length !== 2 || !(submit instanceof HTMLButtonElement) || !(checkboxes[0] instanceof HTMLInputElement) || !(checkboxes[1] instanceof HTMLInputElement)) throw new Error('Mulligan controls missing');
    expect(submit.disabled).toBe(true);
    act(() => { (checkboxes[0] as HTMLInputElement).click(); });
    expect(submit.disabled).toBe(false);
    act(() => { (checkboxes[1] as HTMLInputElement).click(); });
    expect(submit.disabled).toBe(true);
    act(() => { (checkboxes[1] as HTMLInputElement).click(); });
    expect(submit.disabled).toBe(false);
    act(() => { submit.click(); });
    expect(commands).toEqual([{ kind: 'submit-mulligan-bottom', objectIds: ['hand-1'] }]);
    act(() => { root.unmount(); });
  });
});
