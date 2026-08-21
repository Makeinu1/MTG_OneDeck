# O4P-06E cold audit record

- Date: 2026-08-21
- Milestone: `O4P-06E`
- Base SHA: `affb28de31ab562238b74199d0469a5bacef3d73`
- Auditor: `/root/o4p06e_luna_cold_auditor`
- Profile: BROAD, context-free, findings only

## Initial audit

The frozen candidate fingerprint was
`f57c595286ff11bab79e8196d8a740b69a501c4d35e2b27e4c45a44ebafc6fe0`.
The independent audit found `BLOCKER 0 / HIGH 8 / MEDIUM 0 / LOW 0` and
returned `AUDIT-FIX-REQUIRED`.

The eight HIGH findings were:

1. a response body completing after disconnect could resurrect Room and invite state;
2. overlapping refreshes could let an older projection replace a newer projection;
3. create and other lobby mutations lacked a synchronous in-flight guard;
4. host invite capabilities were omitted from private response-fragment checks;
5. dense-array validation reused raw arrays, invoked Proxy indexed gets, and accepted noncanonical extra keys;
6. a joined client observing an already-started lobby did not start its Player browser;
7. Table-start capability-fragment checking was not bidirectional across all configured capabilities; and
8. Room/security/checkpoint initialization and the ready-to-started lobby transition used separate SQLite transactions.

## Corrected candidate

The bounded correction added post-parse epoch fencing, monotonic request
sequencing and controller-wide single-flight guards; retained invite secrets
only in private memory and applied descriptor-safe graph fragment checks;
copied exact dense arrays from descriptors; handled started joins; enforced
bidirectional capability separation; and introduced one SQLite transaction for
Room/security/checkpoint initialization plus lobby compare-and-set transition.
Ordinary regressions cover every finding, injected rollback/retry, and the
1,048,576-byte protocol bound.

The corrected frozen fingerprint was
`40fe5a0f766e0899f6488b56fc89578fcb865d164e34e331f7450baac975c7c2`.
The auditor independently reproduced all eight hostile probes as closed.
An identical start POST after a lost successful response returned generic 400
without mutation; subsequent Room and lobby reads remained 200 with lifecycle
`started`, satisfying safe duplicate rejection without reapplying start.

Independent evidence on the corrected fingerprint:

- O4P-06E invalidated suites: 13 files / 78 tests passed;
- predecessor Lobby/Protocol/Projection/Cloudflare/Browser reviews: 9 files / 100 tests passed;
- affected Online verifiers: 7/7 passed;
- `npx tsc -b`, affected ESLint, and staged diff check passed;
- generated API and migration map were current;
- final Table-capable protocol serialization was 406,996 bytes of the 1,048,576-byte limit;
- `check:docs` had only the documented pre-commit `CONTRACT-ENGINE-MULTIPLAYER` manifest reanchor gate; and
- `check:forbidden` reported only the expected Judge-owned draft/review boundary.

## Final verdict

`BLOCKER 0 / HIGH 0 / MEDIUM 0 / LOW 0`

`AUDIT-OK-PENDING-FULL-CHECK`
