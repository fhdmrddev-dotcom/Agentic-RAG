# Phase 162: Personal-Org Backfill - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-18
**Phase:** 162-personal-org-backfill
**Areas discussed:** Personal-org identity, New-user auto-org hook, is_global rename boundary, Backfill vehicle & proof

Gray-area selection: user selected **all four** presented areas to discuss.

---

## Personal-Org Identity

### Org name

| Option | Description | Selected |
|--------|-------------|----------|
| `"{email}'s Organization"` | Always available, unique per user, recognizable in switcher/roster; no dependency on a possibly-NULL display name | ✓ |
| Display-name, fallback email | Nicer when a name exists, but many users have no display name → inconsistent | |
| `"Personal"` | Simplest, but indistinguishable across users in cross-org/admin views | |

### Org tier

| Option | Description | Selected |
|--------|-------------|----------|
| `NULL` (unset) | Un-opinionated + forward-safe; STRETCH 170/ENT-01 owns tier vocabulary | ✓ |
| `'free'` | Pre-commits a tier string before 170 defines the tiers | |
| `'solo'` | Matches the Solo deploy preset, but same pre-commit risk | |

**User's choice:** `"{email}'s Organization"` + tier `NULL` (+ default dept `'General'` = helper default).
**Notes:** Name surfaces in the Phase-166 org switcher + Phase-148 roster; tier stays unset until STRETCH 170 defines semantics.

---

## New-User Auto-Org Hook

### Ship in 162 vs defer to 167

| Option | Description | Selected |
|--------|-------------|----------|
| Ship hook in 162 | Reuse backfill logic on new-user creation; closes the 163→167 window where a fresh signup under enforced RLS lands org-less | ✓ |
| Defer to 167 | Smaller 162, but leaves a real multi-phase gap (any signup between the 163 crux and 167) with no org | |
| You decide | Take recommendation | |

### Hook home / mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Extend `handle_new_user` trigger | Fires for every new `auth.users` row (email/pw now, SSO-callback in 168), atomic, established pattern; kept minimal + idempotent | ✓ |
| App-layer on signup path | More visible/debuggable, but risks missing entry paths (esp. the SSO callback 168 adds) | |
| Both (trigger + app-layer) | Belt-and-suspenders; more surface for little gain now | |

**User's choice:** Ship in 162, via extending the `handle_new_user` DEFINER trigger.
**Notes:** Trigger body must stay minimal + idempotent (`ON CONFLICT DO NOTHING`, gate on no-existing-personal-org) so it can never abort a signup. Invitations (167) / SSO JIT (168) later ADD "also join org X" on top of the universal personal-org.

---

## is_global rename boundary

| Option | Description | Selected |
|--------|-------------|----------|
| 162 hands-off; 165 renames | 162 never touches `is_global` (data-loss threat closed by construction); 163 uses current names; 165 does the atomic column-rename + all readers + rewrites 163's flag-refs, backstopped by 164's isolation suite | ✓ |
| Pull rename into 162/163 | 163 writes final names once, but drags all of 165's reader-updates (`folder_utils.py`/Storage/frontend) into an earlier, security-critical phase — heavier/riskier | |
| You decide | Take recommendation | |

**User's choice:** 162 hands-off; 165 owns the atomic rename.
**Notes:** Renaming the *column* forces updating every reader simultaneously — exactly 165's bundle. Handoff note recorded (binding on 163 + 165 planners): 163 writes RLS predicates against the CURRENT names `is_global`/`is_system`; the roadmap's `is_org_shared`/`is_system_global` in 163 SC#1 is forward-naming shorthand.

---

## Backfill vehicle & proof

### Vehicle

| Option | Description | Selected |
|--------|-------------|----------|
| SQL migration + batched procedure | Idempotent migration (slot 105) w/ a stored procedure looping `UPDATE … WHERE org_id IS NULL LIMIT 10k` + `COMMIT` between batches (real lock-release, unlike a `DO` block); matches SQL-editor discipline | ✓ |
| App-layer Python script | Familiar control flow + logging, but couples the backfill to an app run and diverges from the numbered-migration discipline | |
| You decide | Take recommendation | |

### NOT-NULL flip proof

| Option | Description | Selected |
|--------|-------------|----------|
| Self-verifying, one migration | Before each `SET NOT NULL`, a guard RAISEs if any `org_id IS NULL` remains (+ SELECTs counts); DB enforces the zero-NULL gate; re-paste-safe | ✓ |
| Split two-step + human gate | Migration 105 backfill → operator eyeballs zero-NULL → migration 106 flip; explicit human checkpoint but two operator actions | |
| You decide | Take recommendation | |

### Shared/system row org assignment

| Option | Description | Selected |
|--------|-------------|----------|
| Owner's personal org | Global folders / `is_system` skill-creator / global views get their creating user's personal org; cross-org reach stays an orthogonal flag; no synthetic principal | ✓ |
| Dedicated system org | One synthetic org owning shared/system resources; invents a new principal + duplicates the `is_system_global` allow-list | |
| You decide | Take recommendation | |

**User's choice:** SQL migration + batched stored procedure (per-batch COMMIT); self-verifying single migration (RAISE-guarded flip); shared/system rows → owner's personal org.
**Notes:** `DO`-block-is-one-transaction trap explicitly avoided via a stored procedure. Invariant recorded: `org_id` = home org, sharing flag = reach.

---

## Claude's Discretion

- Exact batch size (~10k), procedure/index/constraint names, per-child-table parent-FK resolution joins, and the per-table NOT-NULL decision (within the D-11 guidance) — executor discretion within SC#1–4 + D-01…D-11.
- Idempotency idioms follow mig 104's re-paste-safe style.

## Deferred Ideas

- `is_global`→`is_org_shared` rename + `is_system_global` allow-list → Phase 165.
- `document_chunks`/`skill_embeddings` `org_id` + backfill → Phase 163 (TEN-04).
- Membership RLS rewrite of the 38 existing tables + user-JWT client swap → Phase 163 (crux).
- Invitation / SSO join-existing-org onboarding → Phases 167/168.
- Subscription-tier semantics → STRETCH 170 / ENT-01.
- **OPEN planning item:** per-table NOT-NULL decision for org-agnostic audit/operator tables (`audit_log`/`operator_audit_log`) — planner resolves (default lean: keep genuinely org-agnostic rows nullable).
- **Reviewed, not folded:** `spike-nl-workflow-authoring.md` (todo keyword false-positive — belongs to the post-v3.4 no-code-builder track / SEED-123).
