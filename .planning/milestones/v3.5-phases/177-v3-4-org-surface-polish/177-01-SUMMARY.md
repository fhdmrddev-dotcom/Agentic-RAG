---
phase: 177-v3-4-org-surface-polish
plan: 01
subsystem: ui
tags: [react, tailwind, shadcn, lucide-react, vitest, org, auth, chip, badge, notice]

# Dependency graph
requires:
  - phase: 166-org-admin-shell
    provides: OrgBand role badge + org-indigo band (inline source for RoleBadge extraction)
  - phase: 167-invites-roles
    provides: InvitationsTab CHIP_TONE_CLASS + roleLabel + gradient avatar (inline source for StatusChip/OrgIdentity)
  - phase: 168-sso
    provides: SsoTab CHIP_TONE_CLASS + off-grid UPPERCASE fork (the D-08/D-09 retirement target) + victim-naming callout
  - phase: 112-document-detail-panel
    provides: metadata/ConfidenceChip.tsx (the structural template every primitive clones)
provides:
  - "frontend/src/components/org/StatusChip.tsx — ONE shared org-zone status chip COMPONENT (D-08) + statusChipMeta invitation+SSO lifecycle mapper"
  - "frontend/src/components/org/OrgIdentity.tsx — shared RoleBadge + OrgAvatar + roleBadgeMeta reconciled 4-tier mapper (D-04)"
  - "frontend/src/components/auth/HonestNotice.tsx — shared severity-keyed auth callout (D-11/D-12)"
affects: [177-02, 177-03, 177-04, 177-05]

# Tech tracking
tech-stack:
  added: []  # RED LINE held — no new npm package (D-01); frontend/package.json unchanged
  patterns:
    - "cn(BASE_CLASSES, VARIANT[key]) tone-keyed presentational primitive (ConfidenceChip template) applied to org/auth zone"
    - "domain-scoped mappers exported beside the shared component (statusChipMeta lifecycle-only; roster adoption stays its own domain)"
    - "presentational span/div, gates NOTHING — honest-absent gate stays at the call site (D-05/D-06)"

key-files:
  created:
    - frontend/src/components/org/StatusChip.tsx
    - frontend/src/components/org/StatusChip.test.tsx
    - frontend/src/components/org/OrgIdentity.tsx
    - frontend/src/components/org/OrgIdentity.test.tsx
    - frontend/src/components/auth/HonestNotice.tsx
    - frontend/src/components/auth/HonestNotice.test.tsx
  modified: []

key-decisions:
  - "statusChipMeta is scoped to the invitation+SSO LIFECYCLE domain only — OrgMembersTab keeps its own adoption mapper in 177-04 (no overclaim; the cohesion win is the ONE shared COMPONENT, the tone MAPPING stays domain-specific)"
  - "roleBadgeMeta unifies the 4-site drift onto the fuller 4-tier mapping (org-admin/super-admin + dept-admin are admin; else Member)"
  - "HonestNotice calm severity uses Info + muted tokens (never AlertTriangle/red) — danger weight + role=alert earned by error only (D-12)"
  - "OrgAvatar keeps the hand-rolled gradient initial-circle — NOT swapped to shadcn ui/avatar.tsx (look/behavior differs)"

patterns-established:
  - "Shared org-zone StatusChip: BASE_CLASSES + exported CHIP_TONE_CLASS Record + cn() on a single <span>"
  - "Shared RoleBadge/OrgAvatar: verbatim-token extraction, zero gating logic inside the primitive"
  - "Shared HonestNotice: severity → {tokens, glyph, role} single source; glyph decoupled from colour (never colour-alone)"

requirements-completed: []  # ORGUX-01 / ORGUX-02 span the whole wave; this Wave-1 plan ships the primitives only — Wave 2 (177-02..05) wires them into the surfaces that CLOSE the requirements. Orchestrator owns REQUIREMENTS.md marking.

# Metrics
duration: 12min
completed: 2026-07-23
---

# Phase 177 Plan 01: Shared Org-Zone Primitives Summary

**Extracted the three shared org-zone primitives — one StatusChip COMPONENT (D-08), one RoleBadge/OrgAvatar identity element (D-04), and one severity-keyed HonestNotice (D-11) — as byte-identical-token extractions with co-located vitest, ZERO consumer wiring (Wave 2 wires them).**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-23T08:20:48Z
- **Completed:** 2026-07-23T08:26:00Z
- **Tasks:** 3 (all TDD: RED → GREEN)
- **Files modified:** 6 created (3 components + 3 co-located tests), 0 existing files touched

## Accomplishments

- **StatusChip (D-08)** — ONE shared org-zone chip COMPONENT rendering the three-tone vocabulary (primary/success/muted) on the grid-correct pill base. Retires the SsoTab off-grid UPPERCASE/`py-1` fork by construction (the base never carries `uppercase`/`tracking-wide`/`py-1`). Ships `statusChipMeta` — the invitation+SSO **lifecycle** mapper. Tone tokens verified byte-identical to `InvitationsTab.tsx:71-75`.
- **OrgIdentity / RoleBadge + OrgAvatar (D-04)** — the role badge that ships byte-identically at four sites is now one primitive. `roleBadgeMeta` reconciles the drift onto the fuller 4-tier mapping (adds Dept-admin, which OrgBand/ProfileMenu never knew). Hand-rolled gradient avatar kept (+ dashed pending variant).
- **HonestNotice (D-11/D-12)** — one severity→callout: calm=muted+Info · progress=indigo+Loader2 · success=green+CheckCircle2 · error=destructive+AlertTriangle. Calm is never alarming; danger weight + `role="alert"` earned by `error` only. Never colour-alone (glyph beside copy).
- **All RED LINES held** — StreamsProvider untouched, `frontend/package.json` unchanged (no new package), no server contract / authz / migration change. Nothing wired.

## Exported API (for the Wave-2 consumers — no source re-read needed)

**`frontend/src/components/org/StatusChip.tsx`**
- `type ChipTone = "primary" | "success" | "muted"`
- `const CHIP_TONE_CLASS: Record<ChipTone, string>` — the three verbatim tone token strings.
- `<StatusChip tone={ChipTone} testId?={string}>{children}</StatusChip>` — presentational `<span>` (default `data-testid="status-chip"`, `data-tone={tone}`). Pass `testId` to keep consumer hooks (`invitation-status` / `sso-status` / `adoption-chip`).
- `statusChipMeta(status: string): { label: string; tone: ChipTone }` — **invitation+SSO LIFECYCLE domain ONLY.** Maps `pending`/`pending_approval`→primary · `accepted`/`active`→success · `expired`/`revoked`/`disabled`→muted · unknown→`{ label: <raw status>, tone: "muted" }`.
  - **SCOPE (no overclaim):** the members-roster **adoption** state ("Active" reads *muted* by design, not green) is a DISTINCT domain — **177-04 keeps its own `adoptionChip` mapper**. `statusChipMeta` deliberately does not define an adoption-tone mapping. Wave-2 renders adoption through the shared `StatusChip` COMPONENT but with the roster's own mapper.

**`frontend/src/components/org/OrgIdentity.tsx`**
- `roleBadgeMeta(role: string): { label: string; admin: boolean }` — `org-admin`/`super-admin`→`{Org-admin,true}` · `dept-admin`→`{Dept-admin,true}` · else→`{Member,false}`.
- `<RoleBadge role={string} />` — `<span data-testid="role-badge" data-admin>`. Admin = the `◆` indigo primary pill (verbatim `OrgBand.tsx:79`, `◆` aria-hidden); non-admin = the muted pill (verbatim `OrgBand.tsx:84`). Gates NOTHING.
- `<OrgAvatar initial={string} pending?={boolean} />` — `<div data-testid="org-avatar" aria-hidden>` gradient initial-circle; `pending` → the dashed indigo variant (verbatim `OrgMembersTab.tsx:225-228`).

**`frontend/src/components/auth/HonestNotice.tsx`**
- `type NoticeSeverity = "calm" | "progress" | "success" | "error"`
- `<HonestNotice severity={NoticeSeverity}>{children}</HonestNotice>` — `<div data-testid="honest-notice" data-severity role={error ? "alert" : "status"}>`. calm=`border-border bg-muted/40 text-muted-foreground`+Info · progress=`border-primary/30 bg-primary/[0.06] text-primary`+Loader2(spin) · success=`border-success/30 bg-success/10 text-success`+CheckCircle2 · error=`border-destructive/30 bg-destructive/[0.06] text-foreground`+AlertTriangle.

## Task Commits

Each task was TDD (RED test → GREEN implementation), committed atomically:

1. **Task 1: StatusChip (D-08)** — `d62d4ce8` (test, RED) → `0f1a0ebf` (feat, GREEN) — 16 tests
2. **Task 2: RoleBadge + OrgAvatar (D-04)** — `3a940714` (test, RED) → `972097a7` (feat, GREEN) — 13 tests
3. **Task 3: HonestNotice (D-11/D-12)** — `13939535` (test, RED) → `a3642322` (feat, GREEN) — 10 tests

_TDD gate sequence satisfied for each task: a `test(...)` commit precedes its `feat(...)` commit; no REFACTOR needed (extractions were clean on first GREEN)._

## Files Created/Modified

- `frontend/src/components/org/StatusChip.tsx` — shared org-zone status chip + lifecycle mapper.
- `frontend/src/components/org/StatusChip.test.tsx` — 16 co-located tests.
- `frontend/src/components/org/OrgIdentity.tsx` — shared RoleBadge + OrgAvatar + roleBadgeMeta.
- `frontend/src/components/org/OrgIdentity.test.tsx` — 13 co-located tests.
- `frontend/src/components/auth/HonestNotice.tsx` — shared severity-keyed callout.
- `frontend/src/components/auth/HonestNotice.test.tsx` — 10 co-located tests.

## Verification Results

- **3 new suites:** 39/39 tests pass (`StatusChip` 16 · `OrgIdentity` 13 · `HonestNotice` 10).
- **tsc -b:** the three new files compile clean — **zero** type errors reference them. (Pre-existing repo rot in unrelated files — SettingsPage, StreamsProvider, streamsStore, skills, OrgProvider.test, api.test — is out of scope, SEED-056 baseline.)
- **RED LINE (D-02):** `git diff` does NOT include `frontend/src/providers/StreamsProvider.tsx` — UNTOUCHED.
- **RED LINE (D-01):** `frontend/package.json` diff is empty — no new package.
- **Differential (SEED-056):** `src/components/org src/components/auth src/components/metadata` → 11 files / 99 tests PASS, **0 failures, 0 net-new** vs baseline `6d145860` (these suites are green at baseline; the ~25 pre-existing failures live in other directories — chat/hooks — not touched here).
- **Token parity:** StatusChip tone tokens `diff`-identical to `InvitationsTab.tsx:71-75`; RoleBadge admin/member pills verbatim from `OrgBand.tsx:79/:84`; avatar variants verbatim from `InvitationsTab.tsx:236-241` / `OrgMembersTab.tsx:225-228`.

## Decisions Made

None beyond the plan — executed as specified. The one scope nuance (explicit in the plan): `statusChipMeta` covers the invitation+SSO lifecycle only; the roster adoption mapper stays in 177-04. Documented above so Wave-2 does not fold adoption into `statusChipMeta`.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. These are complete presentational primitives with full tone/role/severity mappings and passing tests. They intentionally ship with NO consumer wiring — that is the plan's design (Wave 2 wires them), not a stub.

## Threat Flags

None. D-01/D-03: polish over the already-secured 166–168 surfaces (`threats_open: 0`). No new endpoint, auth path, file access, or schema surface — the three files are pure presentational React components with zero network/authz/storage reach.

## Issues Encountered

None. lucide-react's `AlertTriangle` renders a class matching `/triangle/i`, so the calm-never-alarming assertion (D-12) is version-robust as written.

## Next Phase Readiness

- **Wave 2 (177-02..05) is unblocked.** The three primitives ARE the interface contracts the application plans build against:
  - 177-02 (identity/shell/switcher) consumes `RoleBadge` + `OrgAvatar` (swap OrgBand/ProfileMenu/roster inline badges).
  - 177-03 (invitations + SSO) consumes `StatusChip` + `statusChipMeta` (delete the duplicated `CHIP_TONE_CLASS` maps; retire the SsoTab UPPERCASE fork).
  - 177-04 (roster) consumes the `StatusChip` COMPONENT with its OWN `adoptionChip` mapper (not `statusChipMeta`).
  - 177-05 (entry/failure honesty) consumes `HonestNotice` (route AcceptInvitePage's 6 states + SignInForm's error/fail-open through it; recolor recoverable → calm).
- No blockers. STATE.md / ROADMAP.md deliberately NOT written here — orchestrator owns those (STATE.md balloon-bug mitigation).

## Self-Check: PASSED

- All 6 files verified on disk (FOUND ×6).
- All 6 task commits verified in `git log` (FOUND ×6): `d62d4ce8`, `0f1a0ebf`, `3a940714`, `972097a7`, `13939535`, `a3642322`.
- Tone-token byte-parity confirmed (`diff` StatusChip vs InvitationsTab: identical).

---
*Phase: 177-v3-4-org-surface-polish*
*Completed: 2026-07-23*
