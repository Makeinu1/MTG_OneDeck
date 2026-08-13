import {
  validateOnlineProtocolStateV1,
  type OnlineProtocolStateV1,
} from '../protocol/index';
import { ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1 } from './types';

export class OnlineCloudflareSerializationError extends Error {}

export function assertNoConfiguredCapabilityFragmentV1(
  value: string,
  capabilities: readonly string[],
): void {
  for (const capability of capabilities) {
    for (let length = 8; length <= capability.length; length += 1) {
      for (let start = 0; start + length <= capability.length; start += 1) {
        if (value.includes(capability.slice(start, start + length))) {
          throw new OnlineCloudflareSerializationError('Command contains capability data');
        }
      }
    }
  }
}

export function serializeOnlineCloudflareProtocolStateV1(input: unknown): string {
  const result = validateOnlineProtocolStateV1(input);
  if (!result.ok) throw new OnlineCloudflareSerializationError('Invalid protocol state');
  const serialized = JSON.stringify(result.value);
  if (serialized === undefined) throw new OnlineCloudflareSerializationError('State is not serializable');
  return serialized;
}

export function deserializeOnlineCloudflareProtocolStateV1(serialized: string): OnlineProtocolStateV1 {
  if (new TextEncoder().encode(serialized).length > ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1) {
    throw new OnlineCloudflareSerializationError('Serialized state is oversized');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new OnlineCloudflareSerializationError('Serialized state is malformed');
  }
  const result = validateOnlineProtocolStateV1(parsed);
  if (!result.ok || JSON.stringify(result.value) !== serialized) {
    throw new OnlineCloudflareSerializationError('Serialized state is not canonical');
  }
  return result.value;
}

export function serializeAcceptedCoreCommandV1(command: unknown, capabilities: readonly string[]): string {
  const serialized = JSON.stringify(command);
  if (serialized === undefined) throw new OnlineCloudflareSerializationError('Command is not serializable');
  assertNoConfiguredCapabilityFragmentV1(serialized, capabilities);
  return serialized;
}
