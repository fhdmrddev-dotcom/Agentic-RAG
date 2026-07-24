---
phase: 177-v3-4-org-surface-polish
plan: 03
subsystem: ui
tags: [react, tailwind, org, sso, invitations, chip, cohesion, refactor]

# Dependency graph
requires:
  - phase: 177-01
    provides: shared StatusChip COMPONENT + statusChipMeta lifecycle mapper + RoleBadge/OrgAvatar (org/OrgIdentity)
  - phase: 167-invites-roles
    provides: InvitationsTab (local CHIP_TONE_CLASS + roleLabel + gradient avatar — the retirement source)
  - phase: 168-sso
    provides: SsoTab (local CHIP_TONE_CLASS + the off-grid UPPERCASE fork + victim-naming remove — the D-08/D-09 retirement target)
provides:
  - "frontend/src/components/org/InvitationsTab.tsx — invitations list on the shared StatusChip + RoleBadge + OrgAvatar; link-first + honest-absent preserved"
  - "frontend/src/components/org/SsoTab.tsx — SSO tab on the shared StatusChip, grid-correct row; UPPERCASE off-grid fork retired; victim-naming remove preserved"
affects: [177-04, 177-05]

# Tech tracking
tech-stack:
  added: []  # RED LINE held — no new npm package (D-01); frontend/package.json unchanged
  patterns:
    - "consumer wires the ONE shared StatusChip COMPONENT while keeping its OWN domain label mapper (statusChipMeta for invitations; the SSO-copy statusChip kept local in SsoTab)"
    - "presentational primitive gates NOTHING — the canInvite / canManageSso honest-absent gate stays at the call site (D-06)"

key-files:
  created: []
  modified:
    - frontend/src/components/org/InvitationsTab.tsx
    - frontend/src/components/org/SsoTab.tsx

key-decisions:
  - "InvitationsTab drops its local roleLabel too (not just the chip map) — it renders the shared RoleBadge directly from inv.role, so the 4-tier role mapping now flows through the single roleBadgeMeta source"
  - "SsoTab KEEPS its SSO-domain statusChip mapper (labels 'Pending approval'/'Active'/'Disabled' are SSO copy) but renders through the shared StatusChip — the cohesion win is the ONE component, the label MAPPING stays domain-specific (per 177-01 scope note)"
  - "SsoTab's ChipTone type now imports from StatusChip (inline `type` qualifier for verbatimModuleSyntax); the local type alias is deleted"
  - "The SpMetadataWell panel keeps px-4 (a card/well container, not the row anatomy) — only the CONNECTION ROW snapped to px-3.5 py-3; the SP-metadata/form micro-labels keep uppercase tracking-wide (labels, not the status chip)"

requirements-completed: []  # ORGUX-02 spans the wave; orchestrator owns REQUIREMENTS.md marking

# Metrics
duration: 15min
completed: 2026-07-23
---

# Phase 177 Plan 03: Invitations + SSO on the Shared StatusChip Summary

**Rewired InvitationsTab + SsoTab onto the ONE shared `StatusChip` (177-01), retired each file's local `CHIP_TONE_CLASS` map AND SsoTab's documented UPPERCASE off-grid status fork (snapping the connection row to the `px-3.5 py-3` sibling grid), while keeping link-first resend, the victim-naming SSO remove confirm, and every honest-absent gate byte-identical (D-08/D-09/D-10).**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-23
- **Tasks:** 2 (both `type="auto"`)
- **Files modified:** 2 (InvitationsTab.tsx, SsoTab.tsx); 0 created; InvitationsTab.test.tsx untouched (stayed green unchanged)

## Accomplishments

- **Task 1 — InvitationsTab (D-08/D-04/D-10).** Deleted the local `CHIP_TONE_CLASS`, the `ChipTone` type, the `statusChip` mapper, and the `roleLabel` mapper. Status now renders `<StatusChip tone={status.tone} testId="invitation-status">` off `statusChipMeta(inv.status)`; the role slot renders `<RoleBadge role={inv.role} />`; the avatar renders `<OrgAvatar initial={initial} />`. The grid-correct row anatomy is verbatim (it IS the shared baseline). The `cn` import was dropped (its only use was the retired inline chip). PRESERVED verbatim: the `canInvite &&` honest-absent Send affordance, the pending-only + inviter-only resend/revoke gate, the link-first fresh-link surface (`data-testid="invitation-fresh-link"`), the empty/loading states, and the InviteMemberDialog mount.
- **Task 2 — SsoTab (D-08/D-09/D-10).** Deleted the local `CHIP_TONE_CLASS` and the `ChipTone` type alias (now imported from StatusChip via the inline `type` qualifier). KEPT the SSO-domain `statusChip` label mapper but rendered it through `<StatusChip tone={chip.tone} testId="sso-status">` — which **retires the off-grid UPPERCASE fork** (the shared base carries no `uppercase tracking-wide` and uses `py-0.5`, not `py-1`). Snapped the connection **row** container from `px-4 py-3` to the sibling `px-3.5 py-3` grid baseline. Rewrote the misleading header comment (which had documented the UPPERCASE/off-grid deviation as "do NOT fix them back") to record that the fork was retired for phase-177 cohesion. PRESERVED verbatim: the create form, the `canManageSso &&` honest-absent CTA, the `pending_approval` waiting note, the `role="status"` Updating flash, the SP-metadata well, and — critically — the victim-naming remove confirm ("Remove SSO for {domain}?" + "members who sign in with {domain} will fall back to email and password" + the two-step Confirm).
- **All RED LINES held.** `StreamsProvider.tsx` untouched, `frontend/package.json` unchanged (no new package), no server/authz/migration change. The `canInvite &&` / `canManageSso &&` render-gate polarity + call sites are byte-identical. No file deletions.

## Verification Results

- **Task 1:** `npx vitest run src/components/org/InvitationsTab.test.tsx` → **8/8 pass** (Pending/Accepted text, resend→fresh-link, honest-absent, role picker). The `DialogContent` a11y warning is pre-existing, unrelated to this change.
- **Task 2 + differential:** `npx vitest run src/components/org` → **6 files / 61 tests pass, 0 failures, 0 net-new** vs baseline `6d145860` (SEED-056: the org suites are green at baseline; the pre-existing rot lives in chat/hooks/panel/skills/settings dirs, not touched here).
- **`npx tsc -b`:** the two modified files compile clean — **zero** type errors reference `InvitationsTab`/`SsoTab`/`StatusChip`/`OrgIdentity`. `tsc -b` exits non-zero ONLY on documented SEED-056 rot in unrelated files (SettingsPage, chat, panel, skills, hooks, api.test, OrgProvider.test, NavPanel.test) — the same baseline the 177-01 SUMMARY recorded.
- **Acceptance greps (Task 1):** `CHIP_TONE_CLASS` → 0 · `◆` → 0 (badge via RoleBadge) · imports StatusChip/statusChipMeta/RoleBadge/OrgAvatar · `invitation-fresh-link` present · `cn` import removed.
- **Acceptance greps (Task 2):** `CHIP_TONE_CLASS` → 0 · connection-row `px-4 py-3` → 0 (snapped to `px-3.5 py-3`; the remaining `px-4 py-3` is the SpMetadataWell panel) · status chip renders `<StatusChip>` (no `uppercase tracking-wide` on the status chip; the remaining matches are SP-metadata/form LABELS) · imports StatusChip · header no longer instructs to keep the off-grid fork · victim-naming copy intact (`Remove SSO for` + `back to email and password`).
- **RED LINE (D-02):** `git diff --name-only` shows only the two org files — `StreamsProvider.tsx` UNTOUCHED.
- **RED LINE (authz):** `canInvite &&` (×2 in InvitationsTab) + `canManageSso &&` (×4 in SsoTab) polarity + call sites unchanged.

## Task Commits

1. **Task 1: InvitationsTab → StatusChip + RoleBadge + OrgAvatar** — `c1cce110` (refactor)
2. **Task 2: SsoTab → StatusChip; retire UPPERCASE off-grid fork; snap row to grid** — `b79efa6b` (refactor)

## Decisions Made

Per the plan — see `key-decisions` frontmatter. The one judgment call worth flagging: SsoTab keeps its own `statusChip` label mapper (SSO-domain copy) while rendering through the shared component; only the tone→class rendering + the row/chip spacing unify. This matches the 177-01 scope note (ONE shared component; domain-specific label mappings stay local).

## Deviations from Plan

None affecting behavior. One phrasing adjustment: the plan's Task-2 acceptance grep `grep -q "fall back to email and password"` returns 0 because that copy is line-wrapped in the source (`… will fall` / `back to email and password.`) — it was line-wrapped identically before this plan and is preserved verbatim (confirmed via `Remove SSO for` + `back to email and password` greps). No source change was made to the victim-naming block.

## Known Stubs

None. Both tabs render live server-truth data (invitations / SSO configs) through the shared primitives with full tone mappings and passing tests.

## Threat Flags

None. D-01/D-03: visual/cohesion polish over the already-secured 167/168 surfaces. No new endpoint, auth path, file access, or schema surface. The `canInvite` / `canManageSso` render-gates and all `/org/*` · `/org/sso/*` server contracts are untouched — the server gates remain the wall.

## Issues Encountered

None. `verbatimModuleSyntax` + `noUnusedLocals` are both on, so the retired `cn` imports were removed and the SsoTab `ChipTone` import uses the inline `type` qualifier — both compile clean.

## Self-Check: PASSED

- Both modified files verified on disk (FOUND ×2): InvitationsTab.tsx, SsoTab.tsx.
- Both task commits verified in `git log` (FOUND ×2): `c1cce110`, `b79efa6b`.
- 61/61 org tests green; RED LINES held (StreamsProvider + package.json untouched; only the two org files changed).

---
*Phase: 177-v3-4-org-surface-polish*
*Completed: 2026-07-23*
