import type { OnlineCommandEnvelopeV1 } from '../protocol/index';
import {
  type CreateRemoteGameApplicationAdapterV1Input,
  type GameApplicationAdapterV1,
  type GameApplicationExecutionV1,
  registerGameApplicationAdapterV1,
} from './types';
import { validateGameApplicationAuthorityV1, validateGameApplicationExchangeV1 } from './applicationV1';

export function createRemoteGameApplicationAdapterV1(
  input: CreateRemoteGameApplicationAdapterV1Input,
): GameApplicationAdapterV1 {
  const authorityResult = validateGameApplicationAuthorityV1(input.authority);
  if (!authorityResult.ok || typeof input.submit !== 'function') throw new Error('Invalid remote application input');
  const authority = authorityResult.value;
  const applyEnvelope = async (envelope: OnlineCommandEnvelopeV1): Promise<GameApplicationExecutionV1> => {
      let response: unknown;
      try {
        response = await input.submit(envelope);
      } catch {
        return Object.freeze({
          ok: false as const,
          issues: Object.freeze([Object.freeze({
            code: 'TRANSPORT_FAILURE' as const,
            path: '',
            message: 'Remote application transport failed',
          })]),
        });
      }
      const intentLike = Object.freeze({
        kind: 'game-intent-v1' as const,
        schemaVersion: 1 as const,
        commandId: envelope.commandId,
        baseRevision: envelope.baseRevision,
        command: envelope.command,
      });
      const checked = validateGameApplicationExchangeV1(response, authority, intentLike);
      if (!checked.ok) {
        return Object.freeze({
          ok: false as const,
          issues: Object.freeze([Object.freeze({
            code: 'APPLICATION_FAILURE' as const,
            path: '',
            message: 'Remote application response was invalid',
          })]),
        });
      }
      return Object.freeze({ ok: true as const, value: checked.value });
  };
  return registerGameApplicationAdapterV1('remote', authority, applyEnvelope);
}
