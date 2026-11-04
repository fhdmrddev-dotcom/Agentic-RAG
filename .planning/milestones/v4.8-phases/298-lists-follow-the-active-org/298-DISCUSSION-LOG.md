# Phase 298: Lists Follow the Active Org - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-28
**Phase:** 298-lists-follow-the-active-org
**Mode:** `--auto` (operator: "continue autonomously end to end"). No question was put to the operator; each
area took the research recommendation or what the measured audit decided.
**Areas discussed:** per-org vs per-person, where to narrow, org read polarity, refresh on switch, ORG-05
refusal points, honest count, move shape, guardrails.

---

## Per-org vs per-person (SEED-389)

| Option | Selected |
|---|---|
| Per-org lists (milestone intake) | ✓ |
| Per-person lists (today) | |

[auto] Q: "Is a person's library per-org?" → Selected: per-org (recommended; milestone intake).

## Where to narrow

| Option | Selected |
|---|---|
| At the list routes only, via existing `restrict_org_ids` / one `org_id` predicate | ✓ |
| Inside `fetch_visible_folders` (~20 callers) | |

[auto] → list routes only (research pitfall 13: the shared helper breaks unattended runs).

## Org read on list routes

| Option | Selected |
|---|---|
| `resolve_active_org_or_none` — no header → today's behaviour | ✓ |
| `get_active_org_id` — 400 for a header-less two-org caller | |

[auto] → soft resolver (API-key / unattended callers must not 400; empty never widens).

## Root documents

| Option | Selected |
|---|---|
| Narrow Root too, and stamp Root uploads with the active org (fold SEED-313 no-folder arm) | ✓ |
| Leave Root unnarrowed | |

[auto] → narrow + stamp. The 296 observation listed 206 Root documents across the switch; narrowing without
the upload stamp would make fresh Root uploads vanish.

## Refresh on switch

| Option | Selected |
|---|---|
| Re-fetch keyed on `activeOrgId`, clear rows at once, discard late old-org responses | ✓ |
| Keyed remount of pages | |

[auto] → re-fetch with guard (297 rule: no keyed remounts). Folds SEED-317.

## ORG-05 refusal points

| Option | Selected |
|---|---|
| Save refuses a newly-set foreign binding; launch refuses on every door; existing binding preserved | ✓ |
| Save refuses any foreign binding, including unchanged ones | |
| Attended launch only | |

[auto] → measured: 0 production workflows carry a cross-org binding, so launch refusal on all doors breaks
nothing that worked. 422 with a sentence naming folder and orgs.

## Honest count

| Option | Selected |
|---|---|
| One read route of per-kind per-org counts; "N more in <org> · Switch" line under each list | ✓ |
| Extra field on every list response | |

[auto] → one route (list responses keep their shapes).

## Move shape (decided by the audit)

| Option | Selected |
|---|---|
| Per-item owner move for workflows, owned folders (subtree + docs, one transaction) and Root documents; threads/runs count-only | ✓ |
| Every kind including threads and runs | |
| No move, count only | |
| Bulk re-stamp migration | ⛔ never |

[auto] → audit: cloud 0 multi-org users, local only deliberate fixtures. Move kept per item, both-org
membership, audited; migration 217 only to add the audit action type.

## Claude's Discretion

Route/module names, the count route's response shape, copy beyond the recorded sentences, the stale-response
guard mechanism.

## Deferred Ideas

Thread and run moves (new seed at plan time); org-scoping chat retrieval (accepted unchanged); per-run folder
override naming another org's folder (inherited); BUG-261027-02 (Phase 299); SEED-351, SEED-311, SEED-377
reviewed and left.
