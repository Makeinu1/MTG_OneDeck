# fix/cockpit-turn-cleanup-stage2b-20260914 provenance archive

Status: HISTORICAL / PROVENANCE ONLY  
Current semantic authority: none  
Current verification authority: none  
External-write authority: none

Archived branch: `fix/cockpit-turn-cleanup-stage2b-20260914`  
Archived head: `ea02aaeec0bde73a1d378c3f9ecf666668f72791`

## Why this archive exists

The current browser evidence owner is `COCKPIT-TURN-CLEANUP-BROWSER` in `scripts/evidence/registry.json`, executed by the current `scripts/online/cockpit-turn-evidence.mjs`.

The old branch still contains unique negative/provenance evidence: its Stage2B candidate was local-only, normal-UI / real-browser verification was explicitly incomplete, and blocked CI/browser verification was not claimed as acceptance. That historical limitation is worth retaining; the old branch ref is not.

## Archive unit

- `stage2b-local-only-evidence.md` — exact historical branch document recording the local-only candidate, blocked browser/CI verification, and non-acceptance status.

The old branch's browser script is not separately archived here because a current executor exists on main and M5.1 owns its current evidence contract.
