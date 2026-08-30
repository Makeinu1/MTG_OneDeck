import { createCoreCommandV1, validateCoreCommandV1, type CoreCommandV1, type CoreCommandPayloadV1, type CoreObjectId, type CorePlayerId } from '../../engine/core/index';
import type { CoreDecisionContextV1 } from '../../engine/core/rules/decisionAuthorityV1';
import type { CoreRuleZoneRefV1 } from '../../engine/core/rules/ruleZoneRefV1';
import type { OnlineTabletopIntentEnvelopeV1 } from './types';

type ServerRandomBindingV1 = Readonly<{ readonly randomDecisionId: string; readonly zone: Extract<CoreRuleZoneRefV1, { readonly kind: 'player-zone' }>; readonly beforeOrder: readonly CoreObjectId[]; readonly afterOrder: readonly CoreObjectId[] }>;
export type OnlineTabletopCommandBindingV1 = Readonly<{ readonly actorPlayerId: CorePlayerId; readonly decisionMakerPlayerId: CorePlayerId; readonly decisionContext: CoreDecisionContextV1; readonly random?: ServerRandomBindingV1 }>;
export type OnlineTabletopCommandResultV1 = Readonly<{ readonly envelope: OnlineTabletopIntentEnvelopeV1; readonly command: CoreCommandV1 }>;

export function bindOnlineTabletopIntentToCoreCommandV1(input: { readonly envelope: OnlineTabletopIntentEnvelopeV1; readonly binding: OnlineTabletopCommandBindingV1 }): OnlineTabletopCommandResultV1 {
  const { envelope, binding } = input; const p = envelope.primitive; let payload: CoreCommandPayloadV1;
  const mode = envelope.mode;
  switch (p.kind) {
    case 'move': payload = { kind: 'table-zone-move', objectId: p.objectId as CoreObjectId, destination: p.destination as never, manualMode: mode }; break;
    case 'draw': payload = { kind: 'table-draw', count: p.count as number, manualMode: mode }; break;
    case 'shuffle': { const random = binding.random; if (random === undefined) throw new Error('Server random binding required'); payload = { kind: 'random-zone-order', randomDecisionId: random.randomDecisionId, zone: random.zone, beforeOrder: random.beforeOrder, afterOrder: random.afterOrder, manualMode: mode }; break; }
    case 'reorder': payload = { kind: 'table-reorder', zone: p.zone as never, order: p.order as CoreObjectId[], manualMode: mode }; break;
    case 'tap': payload = { kind: 'table-tap', objectId: p.objectId as CoreObjectId, tapped: p.tapped as boolean, manualMode: mode }; break;
    case 'counter': payload = { kind: 'table-counter-adjust', objectId: p.objectId as CoreObjectId, counterKind: p.counterKind as string, delta: p.delta as number, manualMode: mode }; break;
    case 'mana': payload = { kind: 'table-mana-adjust', color: p.color as never, delta: p.delta as number, manualMode: mode }; break;
    case 'life': payload = { kind: 'table-life-adjust', field: p.field as never, delta: p.delta as number, manualMode: mode }; break;
    case 'token-create': payload = { kind: 'table-token-create', tokenSeed: p.tokenSeed as string, definitionId: p.definitionId as never, definition: p.definition as never, manualMode: mode }; break;
    case 'token-remove': payload = { kind: 'table-token-remove', objectId: p.objectId as CoreObjectId, manualMode: mode }; break;
    case 'controller': payload = { kind: 'table-controller-change', objectId: p.objectId as CoreObjectId, gainingControllerPlayerId: p.gainingControllerPlayerId as CorePlayerId, manualMode: mode }; break;
    case 'attach': payload = { kind: 'table-attach', objectId: p.objectId as CoreObjectId, targetObjectId: p.targetObjectId ?? null, manualMode: mode }; break;
    case 'damage': payload = { kind: 'table-damage-mark', objectId: p.objectId as CoreObjectId, amount: p.amount as number, manualMode: mode }; break;
    case 'priority-hold': payload = { kind: 'table-priority-hold', held: p.held as boolean }; break;
    case 'note-set': payload = { kind: 'table-note-set', noteId: p.noteId as string, text: p.text as string, manualMode: mode }; break;
    case 'note-clear': payload = { kind: 'table-note-clear', noteId: p.noteId as string, manualMode: mode }; break;
    case 'stack-entry': payload = { kind: 'table-stack-entry', entryId: p.entryId as string, label: p.label as string, sourceObjectId: p.sourceObjectId ?? null, manualMode: mode }; break;
    case 'manual-resolve': payload = { kind: 'table-manual-resolve', ...(p.entryId === undefined ? {} : { entryId: p.entryId }), manualMode: mode }; break;
    case 'play-land': case 'cast-spell': throw new Error('Land play and spell cast require the server Core binding');
    case 'look': case 'reveal': case 'choose': throw new Error('Hidden-information primitive is unavailable');
    default: throw new Error('Unknown tabletop primitive');
  }
  const command = createCoreCommandV1({ schemaVersion: 1, sequence: envelope.baseRevision + 1, actorPlayerId: binding.actorPlayerId, decisionMakerPlayerId: binding.decisionMakerPlayerId, decisionContext: binding.decisionContext, payload });
  const checked = validateCoreCommandV1(command); if (!checked.ok) throw new Error('Core command binding failed');
  return Object.freeze({ envelope, command: checked.value });
}
