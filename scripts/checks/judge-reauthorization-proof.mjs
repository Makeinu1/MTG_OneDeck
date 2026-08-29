import { equivalentGuardAcknowledgement } from './guard-impact.mjs';

const PROVENANCE_ACTIONS = new Set([
  'bootstrap', 'refresh-fingerprint', 'acknowledge-guard-impact',
  'push', 'record-semantic-push', 'record-replacement-push',
]);

const SCOPE_KEYS = [
  'id', 'domainId', 'baseSha', 'treeFingerprint', 'acceptanceFingerprint',
  'authority', 'authoritySource', 'repairOf', 'lineages', 'waitChains',
  'releaseHeadSha',
];

function sameProofScope(candidate, latestCandidate) {
  return SCOPE_KEYS.every((key) =>
    JSON.stringify(candidate?.[key] ?? null) === JSON.stringify(latestCandidate?.[key] ?? null));
}

export function selectJudgeReauthorizationProof({
  events,
  baseEventCount,
  latestCandidate,
  cumulativeReport,
  activeReport,
  activeAuthorityPath,
}) {
  if (!equivalentGuardAcknowledgement(
    latestCandidate?.guardImpact?.acknowledgement,
    activeReport,
    activeAuthorityPath,
  )) return { ok: false, code: 'GUARD_ACKNOWLEDGEMENT_MISMATCH' };

  const proof = events.slice(baseEventCount).find((event) =>
    event.actorRole === 'supervisor' &&
    PROVENANCE_ACTIONS.has(event.action) &&
    sameProofScope(event.candidate, latestCandidate) &&
    equivalentGuardAcknowledgement(
      event.candidate?.guardImpact?.acknowledgement,
      cumulativeReport,
      activeAuthorityPath,
    ));
  if (!proof) return { ok: false, code: 'MISSING_SUPERVISOR_ACKNOWLEDGEMENT_PROVENANCE' };
  return {
    ok: true,
    acknowledgement: proof.candidate.guardImpact.acknowledgement,
  };
}
