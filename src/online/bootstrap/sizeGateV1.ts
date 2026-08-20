import {
  deserializeOnlineCloudflareProtocolStateV1,
  serializeOnlineCloudflareProtocolStateV1,
} from '../cloudflare/codec';
import {
  ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1,
  ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1,
} from '../cloudflare/types';
import type { OnlineProtocolStateV1 } from '../protocol/index';

export type BootstrapSizeArtifactIdV1 =
  | 'canonical-core-root'
  | 'online-protocol-state'
  | 'cloudflare-initialize-envelope';

export type BootstrapSizeMeasurementV1 = Readonly<{
  readonly id: BootstrapSizeArtifactIdV1;
  readonly bytes: number;
  readonly withinLimit: boolean;
}>;

export type BootstrapSizeEvidenceV1 = Readonly<{
  readonly kind: 'o4p-06a-size-evidence-v1';
  readonly limitBytes: typeof ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1;
  readonly measurement: 'TextEncoder-UTF-8';
  readonly artifacts: readonly [BootstrapSizeMeasurementV1, BootstrapSizeMeasurementV1, BootstrapSizeMeasurementV1];
}>;

export type BootstrapSizeIssueV1 = Readonly<{
  readonly code: 'CORE_ROOT_SIZE_LIMIT_EXCEEDED' | 'PROTOCOL_STATE_SIZE_LIMIT_EXCEEDED' | 'INITIALIZE_ENVELOPE_SIZE_LIMIT_EXCEEDED';
  readonly path: `/measurements/${BootstrapSizeArtifactIdV1}`;
  readonly message: string;
}>;

function bytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

function sizeIssue(id: BootstrapSizeArtifactIdV1, measured: number): BootstrapSizeIssueV1 {
  const code = id === 'canonical-core-root'
    ? 'CORE_ROOT_SIZE_LIMIT_EXCEEDED'
    : id === 'online-protocol-state'
      ? 'PROTOCOL_STATE_SIZE_LIMIT_EXCEEDED'
      : 'INITIALIZE_ENVELOPE_SIZE_LIMIT_EXCEEDED';
  return Object.freeze({ code, path: `/measurements/${id}`, message: `measuredBytes=${measured}; limitBytes=${ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1}` });
}

function evidenceFor(values: readonly [number, number, number]): BootstrapSizeEvidenceV1 {
  const ids: readonly BootstrapSizeArtifactIdV1[] = ['canonical-core-root', 'online-protocol-state', 'cloudflare-initialize-envelope'];
  return Object.freeze({
    kind: 'o4p-06a-size-evidence-v1',
    limitBytes: ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1,
    measurement: 'TextEncoder-UTF-8',
    artifacts: Object.freeze(ids.map((id, index) => Object.freeze({ id, bytes: values[index] ?? 0, withinLimit: (values[index] ?? 0) <= ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1 })) as [BootstrapSizeMeasurementV1, BootstrapSizeMeasurementV1, BootstrapSizeMeasurementV1]),
  });
}

function measuredBytes(
  canonicalCoreRoot: string,
  protocolSerialized: string,
  envelope: string,
): readonly [number, number, number] {
  return [bytes(canonicalCoreRoot), bytes(protocolSerialized), bytes(envelope)];
}

function issuesFor(values: readonly [number, number, number]): readonly BootstrapSizeIssueV1[] {
  return [
    values[0] > ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1 ? sizeIssue('canonical-core-root', values[0]) : null,
    values[1] > ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1 ? sizeIssue('online-protocol-state', values[1]) : null,
    values[2] > ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1 ? sizeIssue('cloudflare-initialize-envelope', values[2]) : null,
  ].filter((value): value is BootstrapSizeIssueV1 => value !== null);
}

function evaluateProductionStrings(
  canonicalCoreRoot: string,
  protocolSerialized: string,
  envelope: string,
): BootstrapSizeGateResultV1 {
  const measured = measuredBytes(canonicalCoreRoot, protocolSerialized, envelope);
  const issues = issuesFor(measured);
  if (issues.length > 0) return Object.freeze({ ok: false, issues: Object.freeze(issues) });
  return Object.freeze({
    ok: true,
    evidence: evidenceFor(measured),
    serialized: Object.freeze({ coreRoot: canonicalCoreRoot, protocolState: protocolSerialized, initializeEnvelope: envelope }),
  });
}

export type BootstrapSizeProbeMeasurementV1 = Readonly<{
  readonly id: BootstrapSizeArtifactIdV1;
  readonly bytes: number;
  readonly withinLimit: boolean;
}>;

export type BootstrapSizeProbeResultV1 = Readonly<
  | {
      readonly ok: true;
      readonly kind: 'o4p-06a-size-probe-v1';
      readonly limitBytes: typeof ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1;
      readonly measurement: 'TextEncoder-UTF-8';
      readonly measurements: readonly [BootstrapSizeProbeMeasurementV1, BootstrapSizeProbeMeasurementV1, BootstrapSizeProbeMeasurementV1];
    }
  | { readonly ok: false; readonly issues: readonly BootstrapSizeIssueV1[] }
>;

function probeResult(values: readonly [number, number, number]): BootstrapSizeProbeResultV1 {
  const ids: readonly BootstrapSizeArtifactIdV1[] = ['canonical-core-root', 'online-protocol-state', 'cloudflare-initialize-envelope'];
  return Object.freeze({
    ok: true,
    kind: 'o4p-06a-size-probe-v1' as const,
    limitBytes: ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1,
    measurement: 'TextEncoder-UTF-8' as const,
    measurements: Object.freeze(ids.map((id, index) => Object.freeze({ id, bytes: values[index] ?? 0, withinLimit: (values[index] ?? 0) <= ONLINE_CLOUDFLARE_MAX_BODY_BYTES_V1 })) as [BootstrapSizeProbeMeasurementV1, BootstrapSizeProbeMeasurementV1, BootstrapSizeProbeMeasurementV1]),
  });
}

export type BootstrapSizeGateResultV1 = Readonly<
  | { readonly ok: true; readonly evidence: BootstrapSizeEvidenceV1; readonly serialized: Readonly<{ readonly coreRoot: string; readonly protocolState: string; readonly initializeEnvelope: string }> }
  | { readonly ok: false; readonly issues: readonly BootstrapSizeIssueV1[] }
>;

export function evaluateO4P06ASizeGateV1(
  canonicalCoreRoot: string,
  protocolState: OnlineProtocolStateV1,
): BootstrapSizeGateResultV1 {
  const protocolSerialized = serializeOnlineCloudflareProtocolStateV1(protocolState);
  // Deserialization is part of the production-state gate and rejects non-canonical output.
  deserializeOnlineCloudflareProtocolStateV1(protocolSerialized);
  const envelope = JSON.stringify({
    kind: 'online-cloudflare-room-initialize-v1',
    schemaVersion: ONLINE_CLOUDFLARE_ROOM_SCHEMA_VERSION_V1,
    state: protocolState,
  });
  return evaluateProductionStrings(canonicalCoreRoot, protocolSerialized, envelope);
}

/** Measures fixed serialized artifacts for deterministic boundary probes. */
export function evaluateO4P06ASerializedArtifactsV1(
  canonicalCoreRoot: string,
  protocolState: string,
  initializeEnvelope: string,
): BootstrapSizeProbeResultV1 {
  const measured = measuredBytes(canonicalCoreRoot, protocolState, initializeEnvelope);
  const issues = issuesFor(measured);
  if (issues.length > 0) return Object.freeze({ ok: false, issues: Object.freeze(issues) });
  return probeResult(measured);
}

export function measureO4P06ASizeEvidenceV1(
  canonicalCoreRoot: string,
  protocolState: OnlineProtocolStateV1,
): BootstrapSizeGateResultV1 {
  return evaluateO4P06ASizeGateV1(canonicalCoreRoot, protocolState);
}
