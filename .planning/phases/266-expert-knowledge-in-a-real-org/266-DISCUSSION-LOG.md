# Phase 266: Expert Knowledge in a Real Org - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-23
**Phase:** 266-expert-knowledge-in-a-real-org
**Areas discussed:** Install trigger, Corpus source, How the Expert finds its copy, The copy in the org

Scout findings surfaced before questions: migration 194 already taken (→ 195); `is_system_folder`
bypass in `expert_service.py` approves system folders for every org. SEED-304 folded; the one todo
match (`spike-nl-workflow-authoring.md`) was keyword noise and not folded.

---

## Install trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit Install | Button on ExpertDetailModal; invite on uninstalled prompts install | ✓ |
| Auto on first invite | Silent provisioning; first run pays ingest latency | |
| Auto for every entitled org | Backfill + hook on tier; most cost | |

| Who may install | | |
|---|---|---|
| experts:manage only | Reuses Phase 261 gate | ✓ |
| Any member who can see it | | |

| Progress | | |
|---|---|---|
| Installing → Ready state | Invite blocked with reason; failure → retry | ✓ |
| Fire and forget | | |

| Tier gate | | |
|---|---|---|
| Yes, same capability | require_capability('experts') | ✓ |
| No tier gate | | |

## Corpus source

| Option | Description | Selected |
|--------|-------------|----------|
| Files shipped in the repo | Keyed by slug; no seed-org dependency; no cross-tenant read | ✓ |
| Supabase Storage bucket | Data, but a per-env upload parity item | |
| Copy the seed org's rows | Cross-tenant service-role read at install | |

| Seed rows (188) | | |
|---|---|---|
| Retire them in mig 195 | Keep reason in comment; keep skill …0264 (is_system) | ✓ |
| Leave them | | |

| Ingest | | |
|---|---|---|
| Yes — splice_document | One ingest path | ✓ |
| Insert pre-chunked rows | | |

## How the Expert finds its copy

| Option | Description | Selected |
|--------|-------------|----------|
| expert_installs table | Lookup + status + idempotency key, RLS | ✓ |
| Provenance column on folders | | |
| Per-org clone of the bundle row | Forks the Expert | |

| is_system_folder bypass | | |
|---|---|---|
| Delete it | Fence driven RED against the old rule | ✓ |
| Keep it | | |

| Seam | | |
|---|---|---|
| expert_service only | run_producer byte-unchanged (G-5 by construction) | ✓ |
| run_producer too | | |

## The copy in the org

| Owner | | |
|---|---|---|
| The installer, org-shared | No SYSTEM_USER_ID rows in tenant orgs | ✓ |
| System user, org-shared | | |

| Library | | |
|---|---|---|
| Visible, normal folder | Provenance note | ✓ |
| Visible, read-only | | |
| Hidden | | |

| Re-install | | |
|---|---|---|
| Restore missing, never overwrite | | ✓ |
| Strict no-op | | |
| Replace | | |

| Uninstall | | |
|---|---|---|
| Out of scope; keep the docs | | ✓ |
| Build uninstall now | | |

## G-2

| Option | Selected |
|---|---|
| No sketch; reuse patterns | ✓ |
| Quick /gsd:sketch first | |

## Claude's Discretion

Corpus path/layout and `corpus_version` derivation; background task vs existing ingest-status poll;
route shape; exact state wording.

## Deferred Ideas

Uninstall; corpus updates to existing installs; auto-provision on entitlement (revisit at 269).
