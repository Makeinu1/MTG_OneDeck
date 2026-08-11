import type { ModeNeutralCoreRootV1 } from './rootV1';
import type { CoreDomainEventV1 } from './domainEventV1';

export type CoreCommandIssueV1 = Readonly<{ readonly code: string; readonly path: string; readonly message: string }>;
export type CoreCommandWarningV1 = Readonly<{ readonly code: 'MANUAL_CORRECTION_APPLIED'; readonly path: string; readonly message: string }>;
export type CoreCommandResultV1 =
  | Readonly<{ readonly status: 'accepted'; readonly root: ModeNeutralCoreRootV1; readonly events: readonly CoreDomainEventV1[]; readonly warnings: readonly []; readonly beforeStateDigest: string; readonly afterStateDigest: string }>
  | Readonly<{ readonly status: 'accepted-with-warning'; readonly root: ModeNeutralCoreRootV1; readonly events: readonly CoreDomainEventV1[]; readonly warnings: readonly CoreCommandWarningV1[]; readonly beforeStateDigest: string; readonly afterStateDigest: string }>
  | Readonly<{ readonly status: 'rejected'; readonly root: ModeNeutralCoreRootV1; readonly events: readonly []; readonly warnings: readonly []; readonly issues: readonly CoreCommandIssueV1[]; readonly beforeStateDigest: string; readonly afterStateDigest: string }>;

export function freezeCoreCommandIssuesV1(issues: readonly CoreCommandIssueV1[]): readonly CoreCommandIssueV1[] {
  return Object.freeze(issues.map((issue) => Object.freeze({ ...issue })));
}
