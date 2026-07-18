# Phase 148: Governance — Audit, Users & Feature Visibility - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-11
**Phase:** 148-governance-audit-users-feature-visibility
**Areas discussed:** Operator grant/revoke, Impersonation, Hidden-feature refusal, Rollout defaults

---

## Operator grant/revoke

| Option | Description | Selected |
|--------|-------------|----------|
| Ship grant + revoke (Recommended) | Roster role column gets the amber grant sheet + revoke per sketch 068-A; `operator_users` insert/delete + audit rows; mig 095 `granted_by` was added for exactly this; closes the 146 deferral | ✓ |
| Grant only, no revoke UI | Grant from UI, revoke stays manual SQL; smaller surface but the roster shows a role it can't fully manage | |
| Defer both | Env-seed + manual SQL remain the only paths; roster chip read-only; ADMIN-03 'manage users' reads hollow | |

**User's choice:** Ship grant + revoke (Recommended)
**Notes:** Guards were already locked by sketch 068-A (amber blast-radius sheet, revoke keeps normal account, past actions stay in trail, lockout-proof self-rows); this ratified the sketch's "ratify at discuss" scope flag.

---

## Impersonation

| Option | Description | Selected |
|--------|-------------|----------|
| Defer + named trigger (Recommended) | Fails the ROADMAP's 'only if scoped cheaply' bar (no clean GoTrue API, dual-identity threading through shared paths); trigger: first real support case unresolvable from audit browser + active-runs + roster alone | ✓ |
| Ship read-only 'view as' | The 069-B middle path — see the app as a chosen user would, no acting-as; still grows 148 beyond its sketch contract | |
| Ship full impersonation | Dual-identity audit on every action; realistically its own phase | |

**User's choice:** Defer + named trigger (Recommended)

---

## Hidden-feature refusal

### Q1 — refusal shape

| Option | Description | Selected |
|--------|-------------|----------|
| 403 plain refusal (Recommended) | Plain-language body; matches the sketch's 'refused server-side' consequence line; frontend can distinguish governed refusal from real bugs; /admin keeps its 404 | ✓ |
| 404 non-discoverable | Byte-identical to the operator gate; but previously-visible features would read as breakage | |

**User's choice:** 403 plain refusal (Recommended)

### Q2 — UI mechanism + mid-session flip

| Option | Description | Selected |
|--------|-------------|----------|
| Map endpoint + graceful bounce (Recommended) | Authenticated effective-features fetch on app bootstrap drives nav; hidden features don't render; mid-session next fetch 403 → plain refusal + route home; ~30s TTL propagation (147 precedent) | ✓ |
| React-to-403 only | No map endpoint; nav renders everything, surfaces hide after first 403 — dishonest vanish | |
| Push/instant eviction | Realtime/aggressive polling for second-level eviction; new plumbing on a best-effort substrate for a rare action | |

**User's choice:** Map endpoint + graceful bounce (Recommended)

---

## Rollout defaults

### Q1 — day-one audience defaults

| Option | Description | Selected |
|--------|-------------|----------|
| Mixed defaults (Recommended) | Skill Studio + model management → Operators only at deploy (SC#3 TRUE verbatim); workflow authoring & governance health → Everyone (shipped end-user capabilities keep working); Run stays for everyone | ✓ |
| All four Operators only | Strictest read of VIS-01, but silently removes v2.9/v3.0 end-user capabilities at deploy | |
| All four Everyone | Zero behavior change but SC#3 not TRUE until a manual flip | |

**User's choice:** Mixed defaults (Recommended)

### Q2 — cold-read failure polarity

| Option | Description | Selected |
|--------|-------------|----------|
| Per-feature hardcoded default (Recommended) | Cold-read falls back to each feature's day-one default (deny for Skill Studio/model mgmt, allow for authoring/gov health) — the 147 D-Q4 per-flag-by-consequence pattern | ✓ |
| Fail-closed everywhere | Purest default-deny but a cold start under DB trouble hides workflow authoring from every end user | |
| Fail-open everywhere | Never amplifies an outage but briefly exposes tightened features | |

**User's choice:** Per-feature hardcoded default (Recommended)

---

## Claude's Discretion

- Audience-record storage shape on `app_settings` (enum-shaped, never boolean) + the single swappable audience-resolver in `require_visible`
- Per-router `require_visible` wiring (evals/skill_tuner/skill_test_cases under ONE Skill Studio flag; settings model-management sections; workflows authoring/publish with the Run carve-out; governance-health routes)
- Effective-features endpoint shape + bootstrap-fetch fold-in; graceful-bounce UX detail
- Disable mechanics: `banned_until` value, app-layer check location, in-flight cancellation via 147's `_cancel_run_internals`, JWT-window handling
- Platform `audit_log` browse API shape (parameterized filters, page size, CSV streaming/size cap)
- Audit action vocabulary for new writes; plain-first grouping of the 19 platform action codes
- Migration numbering + full-schema regen + cloud parity notes

## Deferred Ideas

- Impersonation ("Sign in as user") — STRETCH; trigger: first support case unresolvable from audit browser + active-runs + roster alone
- 069-B live end-user preview ("view as user" mini-app + API probe) — documented enhancement
- 067-B day-grouped feed headers — possible later graft
- Audience picker beyond two positions (groups/departments) — v3.4 / SEED-115
- Sub-tabbed Control Plane (063-C) — documented scale-up
