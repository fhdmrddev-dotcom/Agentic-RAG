---
seed_id: SEED-117
title: v3.4 config-consolidation — retrofit every remaining dynamic knob into the Control Room + revive the per-user preference layer
planted: 2026-07-13
status: open
related_seeds: [SEED-116, SEED-115, SEED-113, SEED-014, SEED-023]
related_memory: [project_settings_control_room_boundary, project_dynamic_settings_direction, project_admin_panel_plan, project_target_scale, project_org_level_deferred]
source_of_truth: ".planning/notes/dynamic-control-inventory.md (the LIVING master registry — every knob + home + milestone). The boundary RULE it applies lives in .planning/notes/settings-control-room-boundary.md."
re_open_trigger: "At /gsd:new-milestone for v3.4 (i.e. once v3.3 CORE 146–155 closes). This is the milestone that executes the ➡️MOVE / 🔴GAP rows the SEED-116 inventory deferred out of v3.3. Sweep dynamic-control-inventory.md and promote each deferred row to a REQ-ID."
surface: Agentic-RAG
trigger_when: unset
---

> **Why this exists:** SEED-116 mapped *every* controllable element in the app and decided its home
> (Control Room / Settings-personal / Profile). v3.3 executed only the first slice of that map — the
> operator foundation (146–148), Model Registry (149), and Secrets (150). The **bulk of the "make
> everything dynamic in the UI" work was deliberately deferred to a dedicated v3.4 milestone** so v3.3
> wouldn't try to boil the ocean. This seed is that milestone's first-class placeholder, so the deferred
> rows are tracked as a real backlog entry — not left living only inside a notes file.

# SEED-117: v3.4 config-consolidation + per-user preference layer

## The reframe this milestone finally acts on (inventory F1)

Today's Settings page is **already global + already operator-gated** — a *misplaced Control Room*, not a
personal surface. The honest target the inventory locked (operator-approved 2026-07-12):

- **Control Room (operator governance)** absorbs the global platform config.
- **Settings (personal)** shrinks to a genuine, mostly-*new* per-user sliver (pick within the
  operator-allowed set).
- **Profile menu** holds identity (SEED-113).

## Scope — the deferred rows to promote to REQ-IDs at v3.4 new-milestone

Pulled from `.planning/notes/dynamic-control-inventory.md` (§ letters map to that file's decision table).
Sweep it fresh at milestone-start; this list is the snapshot as of 2026-07-13.

### 1. Retrofit existing global knobs into Control Room config tabs (➡️MOVE)
- **Retrieval & Ingestion tab (C):** embedding model/dims/base_url + re-embed lifecycle · extraction
  model + per-type engines (text/table/image/equation) · reranking (enable/provider/model/top-n) ·
  retrieval (top-k, threshold, hybrid, vector/keyword weights, rrf_k, candidate count) · multimodal
  caps, extraction window cap, confidence buckets (surface the no-UI `app_settings` rows).
- **Models/routing residuals (A rows 4–5):** context/output/sub-agent tokens · sub-agent model ·
  OpenRouter strategy · provider roster + base URLs (base URLs partially touched in 150) ·
  `MODEL_CAPABILITIES` routing facets (emit_tier, max_tools, parallel, prefill, strict_json — not yet
  in the DB-override field list).
- **Tools & safety (D):** web-search key + max-results · sandbox image/timeouts/TTL.
- **Eval/observability (F):** judge model · skill-builder model home review; engine-health + dependency-
  health → System Health surface (observability milestone, may split out).

### 2. Revive the per-user preference layer (inventory F3 — the genuinely new sliver)
- `user_settings.preferences` has been **dead since migration 011**. Revive it as the substrate for
  "user picks a default model *within the operator-allowed set*," honoring operator lock flags (the
  two-layer pattern from SEED-116: operator allowed-set + lock → user preference → gated visibility).

### 3. True blanks — dynamic NOWHERE today (inventory F5 / §G, §I) — scope carefully, may span v3.4+
- **Prompt Governance (§G):** system / explorer / sub-agent / title-gen / vision prompts are all
  hardcoded strings → a Control Room Prompt Governance surface.
- **Chunking (§C):** `chunk_size`=1000 / `chunk_overlap`=200 are env-only → Ingestion tab.
- **Cost / Budget caps + usage metering (§I):** none exists anywhere; prereq for scheduling. Depends on
  duration telemetry (SEED-023).
- **Scheduled / recurring triggers + internal reactive automation (§I):** no scheduler exists → SEED-014
  (event bus + triggered_runs + pending-human-approval run state).
- **Per-user / per-key rate limiting (§I):** none exists → Control Room Controls.
- **Org RBAC / departments / greenlists / doc-level ACL:** → SEED-115 (may be its own v3.4 milestone).

### 4. Housekeeping (quick/backlog — can pre-empt before v3.4 if cheap)
- **F2 duplication:** `web_search_enabled` + `sandbox_enabled` are ONE `app_settings` column exposed as
  BOTH a Settings toggle AND a Control Room kill-switch. Consolidate to one home.
- **Dead-knob cleanup (F3/§I):** `title_drafting_config`, `sub_agent_config`, `token_capture_enabled`,
  `user_settings.preferences` (columns unread) → wire-or-remove.
- **Resource-cap knobs → `app_settings` (from Phase 151 plan-review, 2026-07-13):** `fetch_document_file_max_mb`
  (D-02, added as an env var in Phase 151 to avoid a second migration) + the existing `sandbox_exec_timeout_seconds`
  are operator-tunable business caps currently living in `config.py` env vars, in tension with the "env vars = secrets/infra only"
  rule. Consolidate both into `app_settings` alongside `template_ttl_hours` when this milestone builds the resource-cap tab (§1).

## Guardrails to carry in
- This is a **config-consolidation** milestone touching the shared `app_settings` substrate + Settings/
  Control Room UI — apply the two-layer pattern uniformly; do NOT build knob-by-knob bespoke homes.
- Every moved knob must preserve its **env-fallback precedence** (DB > env) and cross-provider behavior —
  no regressions to the shared path (the standing cross-provider + no-regression rules).
- Splitting: cost/budget + scheduler + rate-limiting are large; each may warrant its own phase or even
  slip to v3.4+ / v3.5. Prompt Governance is 🔮 and can be sequenced independently.

## Related
[[SEED-116]] (the resolved boundary + inventory that spawned this) · [[SEED-115]] (org-RBAC / greenlists
/ doc-ACL — sibling v3.4 track) · [[SEED-113]] (Profile menu / identity split) · [[SEED-014]] (automations
& routines — the scheduler/reactive half) · [[SEED-023]] (duration telemetry — cost-cap prerequisite) ·
`.planning/notes/dynamic-control-inventory.md` (living master registry) ·
`.planning/notes/settings-control-room-boundary.md` (the RULE).
