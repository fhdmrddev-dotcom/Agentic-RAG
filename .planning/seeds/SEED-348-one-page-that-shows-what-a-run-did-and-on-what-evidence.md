---
seed_id: SEED-348
title: Per-run provenance receipt — one read-only page (and export) showing what a workflow run did and on what evidence; v2.9 STRETCH Phase 107 (GOV-02) never built
created: 2026-10-04
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "The first customer or auditor request for a per-run evidence export; OR a compliance question cannot be answered from the Control Room audit ledger; OR any governance-adjacent phase whose files_modified names RunReceipt.tsx, WorkflowRunPage.tsx or the audit tab."
trigger_paths: ["frontend/src/components/workflows/RunReceipt.tsx", "frontend/src/components/workflows/receiptVocabulary.ts", "frontend/src/pages/WorkflowRunPage.tsx", "frontend/src/components/admin/AuditTab.tsx", "backend/app/api/workflow_runs.py"]
trigger_surfaces: ["workflow", "admin", "harness"]
migration_note:
relates_to: [".planning/v2.9-STRETCH-CARRYFORWARD.md § 107", "docs/history/v2.9-workflow-studio.md", "docs/history/v2.2-trust-and-compliance.md (citation export, deferred)", "SEED-223"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-348: one page that shows what a run did and on what evidence

## The finding

v2.9 STRETCH Phase 107 (GOV-02) was to be a read-only per-run receipt: `definition@version`, the
append-only run log, gate verdicts and cited sources, in the EU AI Act Art. 12 traceability shape,
assembled from data already recorded (no new writes, no migration).

Most pieces now exist in separate places: `harness_audit` and `workflow_phases` record the chain; the
Control Room audit browser exports CSV (v3.3); a chat run receipt (`RunReceipt.tsx`) and the run surface's
phase spine (v3.6/v3.7) show parts of it. **The consolidated view does not exist** (carry-forward,
measured 2026-08-10; history doc v2.9 107 row: "no consolidated receipt view"). v2.2 also deferred
**citation export**, which is the same artefact from the chat side.

The plan lives only in `.planning/v2.9-STRETCH-CARRYFORWARD.md`, which no sweep reads.

## Why it matters

For a regulated buyer "show me what this run did and on what evidence" is a purchase condition. Today it
takes an operator stitching three screens together.

## When to surface

The first request for a per-run evidence export, or a compliance question the audit ledger cannot answer.

## Scope estimate

Small to Medium. Treat it as assembly, not a build: if a plan proposes new runtime writes, the scope has
drifted. Include a print/PDF or JSON export. Mind SEED-223 (what the approval receipt records).

## Breadcrumbs

- `.planning/v2.9-STRETCH-CARRYFORWARD.md` lines 113-150
