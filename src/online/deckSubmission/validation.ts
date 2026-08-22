import { coreSha256HexV1 } from '../../engine/core/index';
import { isOnlineRoomApplicationIdV1, isOnlineRoomSeatCapabilityV1 } from '../room/validationSupport';
import {
  ONLINE_DECK_SUBMISSION_MAX_CANONICAL_BYTES_V2,
  ONLINE_DECK_SUBMISSION_SCHEMA_VERSION_V2,
  type OnlineDeckSubmissionEntryV2,
  type OnlineDeckSubmissionIssueV2,
  type OnlineDeckSubmitV2,
  type OnlineDeckSubmissionValidationResultV2,
} from './types';

const ROOT_FIELDS = ['kind', 'schemaVersion', 'participantId', 'seatCapability', 'deckId', 'submissionId', 'entries'] as const;
const ENTRY_FIELDS = ['section', 'quantity', 'scryfallId', 'oracleId'] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function plainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype: object | null = Object.getPrototypeOf(value) as object | null;
    return prototype === Object.prototype || prototype === null;
  } catch { return false; }
}

function ownData(record: Record<string, unknown>, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    return descriptor !== undefined && descriptor.enumerable && 'value' in descriptor && descriptor.get === undefined && descriptor.set === undefined
      ? descriptor.value : undefined;
  } catch { return undefined; }
}

function exactRecord(value: unknown, fields: readonly string[]): value is Record<string, unknown> {
  if (!plainRecord(value)) return false;
  try {
    const keys = Reflect.ownKeys(value);
    return keys.length === fields.length && keys.every((key) => typeof key === 'string' && fields.includes(key) && Object.prototype.propertyIsEnumerable.call(value, key));
  } catch { return false; }
}

function issue(code: OnlineDeckSubmissionIssueV2['code'], entryIndex: number | null, retryable = false): OnlineDeckSubmissionIssueV2 {
  return Object.freeze({ code, entryIndex, retryable });
}

function canonicalInput(value: Pick<OnlineDeckSubmitV2, 'deckId' | 'entries'>): string {
  return JSON.stringify({ deckId: value.deckId, entries: value.entries });
}

export function isCanonicalScryfallIdV2(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

export function parseOnlineDeckSubmitV2(input: unknown): OnlineDeckSubmissionValidationResultV2 {
  try {
    if (!exactRecord(input, ROOT_FIELDS)) return { ok: false, issues: Object.freeze([issue('INVALID_CARD_ID', null)]) };
    const kind = ownData(input, 'kind');
    const schemaVersion = ownData(input, 'schemaVersion');
    const participantId = ownData(input, 'participantId');
    const seatCapability = ownData(input, 'seatCapability');
    const deckId = ownData(input, 'deckId');
    const submissionId = ownData(input, 'submissionId');
    const rawEntries = ownData(input, 'entries');
    if (kind !== 'online-forming-lobby-deck-submit-v2' || schemaVersion !== ONLINE_DECK_SUBMISSION_SCHEMA_VERSION_V2 || !isOnlineRoomApplicationIdV1(participantId) || !isOnlineRoomSeatCapabilityV1(seatCapability) || !isOnlineRoomApplicationIdV1(deckId) || !isOnlineRoomApplicationIdV1(submissionId)) {
      return { ok: false, issues: Object.freeze([issue('INVALID_CARD_ID', null)]) };
    }
    if (!Array.isArray(rawEntries) || Object.getPrototypeOf(rawEntries) !== Array.prototype || rawEntries.length === 0) return { ok: false, issues: Object.freeze([issue('EMPTY_LIST', null)]) };
    const entries: OnlineDeckSubmissionEntryV2[] = [];
    for (let index = 0; index < rawEntries.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(rawEntries, index)) return { ok: false, issues: Object.freeze([issue('EMPTY_LIST', index)]) };
      const raw = rawEntries[index] as unknown;
      if (!exactRecord(raw, ENTRY_FIELDS)) return { ok: false, issues: Object.freeze([issue('INVALID_CARD_ID', index)]) };
      const section = ownData(raw, 'section');
      const quantity = ownData(raw, 'quantity');
      const scryfallId = ownData(raw, 'scryfallId');
      const oracleId = ownData(raw, 'oracleId');
      if (section !== 'commander' && section !== 'main') return { ok: false, issues: Object.freeze([issue('INVALID_SECTION', index)]) };
      if (typeof quantity !== 'number' || !Number.isSafeInteger(quantity) || quantity <= 0) return { ok: false, issues: Object.freeze([issue('INVALID_QUANTITY', index)]) };
      if (!isCanonicalScryfallIdV2(scryfallId) || !isCanonicalScryfallIdV2(oracleId)) return { ok: false, issues: Object.freeze([issue('INVALID_CARD_ID', index)]) };
      entries.push(Object.freeze({ section, quantity, scryfallId, oracleId }));
    }
    const value: OnlineDeckSubmitV2 = Object.freeze({ kind, schemaVersion, participantId, seatCapability, deckId, submissionId, entries: Object.freeze(entries) });
    const serialized = canonicalInput(value);
    if (new TextEncoder().encode(serialized).length > ONLINE_DECK_SUBMISSION_MAX_CANONICAL_BYTES_V2) return { ok: false, issues: Object.freeze([issue('SNAPSHOT_TOO_LARGE', null)]) };
    return Object.freeze({ ok: true as const, value, canonicalInput: serialized, contentDigest: coreSha256HexV1(serialized) });
  } catch {
    return { ok: false, issues: Object.freeze([issue('INVALID_CARD_ID', null)]) };
  }
}

export const validateOnlineDeckSubmitV2 = parseOnlineDeckSubmitV2;

/** Reject any configured bearer/public metadata fragment before persistence. */
export function assertSafeOnlineDeckMetadataV2(value: string, forbidden: readonly string[]): void {
  for (const secret of forbidden) {
    for (let length = 8; length <= secret.length; length += 1) {
      for (let start = 0; start + length <= secret.length; start += 1) {
        if (value.includes(secret.slice(start, start + length))) throw new Error('Unsafe deck metadata');
      }
    }
  }
}

export function canonicalDeckSubmissionInputV2(value: Pick<OnlineDeckSubmitV2, 'deckId' | 'entries'>): string {
  return canonicalInput(value);
}

export function contentDigestOfDeckSubmissionV2(value: Pick<OnlineDeckSubmitV2, 'deckId' | 'entries'>): string {
  return coreSha256HexV1(canonicalInput(value));
}
