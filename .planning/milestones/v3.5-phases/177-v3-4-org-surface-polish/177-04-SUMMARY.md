---
phase: 177-v3-4-org-surface-polish
plan: 04
subsystem: ui
tags: [react, tailwind, org, roster, invite, chip, badge, avatar, vitest, cohesion]

# Dependency graph
requires:
  - phase: 177-01-shared-org-zone-primitives
    provides: RoleBadge + OrgAvatar (OrgIdentity.tsx) + StatusChip component (StatusChip.tsx)
  - phase: 167-invites-roles
    provides: OrgMembersTab roster + InviteMemberDialog (the surfaces being polished)
provides:
  - "frontend/src/components/org/OrgMembersTab.tsx — members roster on the shared RoleBadge + StatusChip COMPONENT + OrgAvatar; adoptionChip domain-exempt (active→muted, documented)"
  - "frontend/src/components/org/InviteMemberDialog.tsx — invite dialog on the shared 4px grid + org-zone micro-label style; link-first preserved verbatim"
affects: [177-05]

# Tech tracking
tech-stack:
  added: []  # RED LINE held — no new npm package; frontend/package.json unchanged
  patterns:
    - "consume the 177-01 shared primitives at the call site; keep domain-specific tone MAPPING local (adoptionChip) while sharing the visual COMPONENT (StatusChip)"
    - "grid-snap off-grid half-steps (1.5→2) + reconcile micro-label tokens toward the org-zone convention for family cohesion — spacing/token only, behavior byte-identical"

key-files:
  created: []
  modified:
    - frontend/src/components/org/OrgMembersTab.tsx
    - frontend/src/components/org/InviteMemberDialog.tsx

key-decisions:
  - "adoptionChip stays a DOCUMENTED domain exemption — member-adoption (active→muted) is distinct from the invitation/SSO lifecycle (statusChipMeta); rendered THROUGH the shared StatusChip component but with the roster's own tone so an active roster is not a wall of green"
  - "InviteMemberDialog role-picker stays interactive (aria-pressed / disabled Dept-admin) — NOT swapped to the display RoleBadge (those are controls, not badges)"
  - "micro-labels reconciled to `text-[11px] uppercase tracking-wide text-muted-foreground` (the SsoTab sibling convention) — matched the plan's literal target rather than inserting font-normal, so a grep of the reconciled class holds"

requirements-completed: []  # ORGUX-01/ORGUX-02 span the whole wave; orchestrator owns REQUIREMENTS.md marking

# Metrics
duration: 9min
completed: 2026-07-23
---

# Phase 177 Plan 04: Members Roster + Invite Dialog Family-Cohesion Summary

**Folded `OrgMembersTab` (roster) and `InviteMemberDialog` into the shared 177-01 org family — the roster now renders its role slot via `RoleBadge`, its adoption chip via the shared `StatusChip` COMPONENT (fed the roster's own `active→muted` adoption tone, kept as a documented domain exemption so it is not recolored to green), and both avatars via `OrgAvatar`; the invite dialog snaps to the shared 4px grid + org-zone micro-label style — all honest behaviors (pure-read-leaf, link-first) byte-identical.**

## Performance

- **Duration:** ~9 min
- **Completed:** 2026-07-23
- **Tasks:** 2 (both `type="auto"`)
- **Files modified:** 2 existing (0 created)

## Accomplishments

- **Task 1 — OrgMembersTab (D-04/D-08/D-09).** Deleted the inline `roleBadge` mapper and the four inline presentational blocks (role admin/member spans, the two-ternary adoption span, both gradient/dashed avatar `<div>`s). The role slot is now `<RoleBadge role={role} />`; the adoption slot is `<StatusChip tone={adoption.tone} testId="adoption-chip">`; the identity avatars are `<OrgAvatar initial=… />` and `<OrgAvatar initial=… pending />`. Row anatomy, header + search, empty/loading states, and the "no coming-soon banner" are verbatim.
- **adoptionChip domain exemption PRESERVED + DOCUMENTED.** The local `adoptionChip` mapper still returns `{ "Active", "muted" }` for active members (NOT `success`-green). Its comment was rewritten into an explicit `DOMAIN EXEMPTION — DO NOT "fix" this to green` note explaining that member-adoption is a distinct domain from the invitation/SSO lifecycle (`statusChipMeta`), so a healthy roster stays calm, not a wall of green. The cohesion win is the ONE shared COMPONENT; the tone MAPPING stays adoption-domain-specific.
- **Pure-read-leaf invariant held.** `RoleBadge`/`StatusChip`/`OrgAvatar` render `<span>`/`<div>` only — the roster still renders ZERO `<button>` (its test's `queryByRole("button") === null` stays green).
- **Task 2 — InviteMemberDialog (D-09/D-10).** Reconciled the two field micro-labels ("Email address", "Role") from `text-[0.7rem] tracking-[0.06em]` to the org-zone convention `text-[11px] uppercase tracking-wide text-muted-foreground` (matching the sibling SsoTab labels); snapped the off-grid `1.5` half-steps (role group `gap-1.5`, label `mb-1.5`, hint `mt-1.5`) to the 4px grid (`gap-2`/`mb-2`/`mt-2`). The role-picker stays interactive (`aria-pressed`, disabled Dept-admin "(soon)") — deliberately NOT swapped to `RoleBadge` (those are controls, not display badges).
- **All honest behaviors byte-identical.** Link-first success panel (`data-testid="invite-link"` + Copy link, lines untouched), `ROLE_OPTIONS` (Member/Org-admin enabled, Dept-admin disabled), the 422/400 error discrimination, reset-on-open, and the `sendInvitation` call are unchanged.

## Task Commits

1. **Task 1: OrgMembersTab → shared RoleBadge + StatusChip + OrgAvatar (D-04/D-08/D-09)** — `a962d3e7` (feat) — 1 file, +25/−47
2. **Task 2: InviteMemberDialog → shared 4px grid + org-zone micro-labels (D-09/D-10)** — `896f37c1` (feat) — 1 file, +4/−4

## Verification Results

- **OrgMembersTab suite:** `OrgMembersTab.test.tsx` — **7/7 pass**, incl. `queryByRole("button") === null` (pure read leaf), `getAllByText("Active").length === 3` (muted adoption chips — NOT a wall of green), `getByText("Pending")`, `Org-admin`/`Member`.
- **InvitationsTab suite (invite-modal role picker):** `InvitationsTab.test.tsx` — **8/8 pass**; Member/Org-admin enabled, Dept-admin disabled stays green. (Pre-existing shadcn `DialogContent` aria-describedby warning is unrelated to this change.)
- **tsc -b:** zero type errors reference the two modified files (pre-existing repo rot in unrelated files is out of scope, SEED-056 baseline).
- **Differential (SEED-056):** `npx vitest run src/components/org --reporter=dot` → **6 files / 61 tests PASS, 0 failures, 0 net-new** vs baseline `6d145860`.
- **Acceptance greps (Task 1):** `grep -c "◆" OrgMembersTab.tsx` → **0**; imports `RoleBadge`/`StatusChip`/`OrgAvatar`; `grep -c "border-primary/30 bg-primary/10 text-primary"` → **0** (inline chip tokens gone — they live only in the primitives); `adoptionChip` `active → "muted"` present; domain-exemption comment present.
- **Acceptance greps (Task 2):** `aria-pressed` present; `RoleBadge` count **0** (role picker not converted); `invite-link` present; reconciled micro-label class present ×2.

## RED LINES — all held

- **D-02 (StreamsProvider):** `git diff --name-only 6d145860..HEAD -- frontend/src/providers/StreamsProvider.tsx` → **empty (UNTOUCHED)**.
- **Roster invariant:** zero `<button>` in the roster — `queryByRole("button") === null` green.
- **Adoption domain:** `active→muted` mapping preserved (not recolored to green) — documented in source, not silently changed.
- **D-10 (link-first):** the dialog's `invite-link` success panel is unchanged (verbatim).
- **No new package / no server contract / no authz / no migration:** `sendInvitation` and `ROLE_OPTIONS` untouched; my commit scope is exactly the 2 frontend org files (no deletions).

## Decisions Made

- **Micro-label token target.** The plan quotes the org-zone convention as `text-[11px] uppercase tracking-wide text-muted-foreground`; the sibling SsoTab labels also carry `font-normal`. I matched the plan's literal quoted class (no interposed `font-normal`) so the acceptance grep of the reconciled class holds; the visual weight is identical (a `<label>`/`<p>` default to normal weight anyway).
- **`◆` in comments.** The Task-1 acceptance criterion is a literal `grep -c "◆" → 0`. The rendered glyph moved into `RoleBadge`, but two prose comments still mentioned `◆`; I removed the glyph from those comments so the literal grep returns 0 (no behavioral effect).

## Deviations from Plan

None — plan executed exactly as written. The two decisions above are token/comment reconciliations within the plan's stated intent, not scope changes.

## Known Stubs

None. Both files are fully wired to real data (roster props from the shell; `sendInvitation` from the API). No placeholder/empty-data paths introduced.

## Threat Flags

None. D-01/D-03: visual cohesion over the already-secured 166/167 surfaces. No new endpoint, auth path, file access, or schema surface — spacing/token/component-swap changes only; `sendInvitation` and every render-gate call site are byte-identical.

## Self-Check: PASSED

- Both modified files verified on disk (FOUND ×2): `OrgMembersTab.tsx`, `InviteMemberDialog.tsx`.
- Both task commits verified in `git log` (FOUND ×2): `a962d3e7`, `896f37c1`.
- Differential green (org: 61/61, 0 net-new); all RED LINES held.

---
*Phase: 177-v3-4-org-surface-polish*
*Completed: 2026-07-23*
