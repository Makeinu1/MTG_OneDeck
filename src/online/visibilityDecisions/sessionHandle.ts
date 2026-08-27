import { coreCanonicalDigestFromValueV1 } from '../../engine/core/index';

/**
 * Stable client handle for an authoritative Core search-session incarnation.
 *
 * The Core key is intentionally used only as digest input.  The returned
 * handle is a one-way, namespaced value suitable for the projection and E
 * intent wire; it never embeds or echoes the authoritative key.  The
 * projection revision is part of the digest so a Core session key reused by a
 * later incarnation cannot be confused with an earlier projected session.
 */
export function onlineProjectedSearchSessionHandleV1(sessionKey: string, projectionRevision = 0): string {
  if (!Number.isSafeInteger(projectionRevision) || projectionRevision < 0) throw new Error('Invalid projection revision');
  return `search-handle-${coreCanonicalDigestFromValueV1({
    kind: 'online-projected-search-session-handle-v1',
    sessionKey,
    projectionRevision,
  })}`;
}
