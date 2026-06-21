# Phase 116: Document Relationships — Backend + Agent Tool - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Let users **typed-link** documents and let the agent **traverse** those links. Two
surfaces ship here:

1. **A backend create/remove REST API** for typed directional relationships
   (`supersedes` / `amends` / `references` / `attached_to`) over the existing
   `document_relationships` table — consumed by the **Phase 117** panel UI (no UI in
   this phase; ROADMAP "UI hint: no", no G-2 sketch).
2. **One read-only agent tool** `get_related_documents`, registered in `_TOOL_REGISTRY`
   **AND** advertised in `get_tools` (REL-04), leak-safe per the 113/114/115 pattern.

**Backend-only.** **Zero new SQL migration** — the `document_relationships` table
(migration 071) and the `relationship.create` / `relationship.delete` audit actions are
already live. This phase wires create/remove handlers, the read tool, version-stable
resolution, and the SC#10 UAT on top of that substrate.

**Requirements:** REL-01 (create typed link), REL-03 (remove), REL-04 (`get_related_documents`
tool). **No SPEC.md** — ROADMAP §"Phase 116" SC#1–3 are the authoritative acceptance bar:
1. Create + remove a typed link; links reference document identity via latest-resolved/`is_latest`
   so a new version or restore does not orphan them; a `relationship.create` audit row lands live.
2. Agent retrieves related docs via `get_related_documents` (registry **AND** `get_tools`); a
   relationship pointing at a document the caller can't see renders as **"linked document (no
   access)"** — never leaking the target's title/metadata.
3. SC#10 4-axis cross-provider UAT (native-7 × multi-tool × parallel-thread × long-message),
   authored in VALIDATION.md.

REL-02 (the relationship **panel UI**) is **Phase 117** — out of scope here.

</domain>

<decisions>
## Implementation Decisions

### Version-stable link identity (SC#1 core)
- **D-116-1 (Follow-to-latest — links never go stale):** A link always surfaces the
  **CURRENT latest version** of the linked document. A re-upload (new version) or a version
  restore MUST NOT orphan or stale the link. This is the ROADMAP SC#1 "latest-resolved/`is_latest`"
  contract. *Rejected:* pin-to-exact-version (link points at the superseded row after re-upload —
  feels orphaned); follow-with-version-note (provenance is nice but unrequested scope).
  - **Versioning model the researcher MUST account for:** re-uploading a file INSERTs a **new
    `documents` row with a new `id`**, bumps `version_number`, and sets the **old** row
    `is_latest=false` (it is **kept**, not deleted — `documents.py:456-486`, `:651-663` for
    restore). Hard-delete CASCADEs the relationship away (FK `ON DELETE CASCADE`). Version lineage
    is grouped **only by `(user_id, filename, is_latest=true)`** (migration 025) — **there is NO
    stable lineage/group UUID** and **no `previous_version_id`**.
  - **D-116-1a (Mechanism = researcher/planner discretion):** "follow-to-latest" can be realized as
    **(a) read-time resolution** (store the creation-time `doc_id`; at read time resolve each
    endpoint to the latest version via `(user_id, filename, is_latest=true)`) — no upload-pipeline
    change, read does a lineage lookup; OR **(b) re-point on version bump** (the documents.py
    version cascade UPDATEs `document_relationships` old_id→new_id) — trivial reads, but couples to
    the upload pipeline. Researcher picks; **policy (links follow latest) is locked.**
  - **⚠ Flagged fragility (researcher MUST address):** because lineage = `(user_id, filename)`, a
    **filename rename** breaks the grouping. Confirm whether documents can be renamed today; if so,
    pick a mechanism robust to it (favors (b) re-point, which is rename-agnostic).

### Retrieval shape & direction (REL-04)
- **D-116-2 (Both directions, inverse-labeled):** `get_related_documents` returns **both
  outgoing** (this doc is the source — "this supersedes X") **and incoming** (this doc is the
  target — "Y supersedes this") edges. Incoming edges are surfaced with **inverse phrasing**
  (`supersedes`→`superseded_by`, `amends`→`amended_by`, `references`→`referenced_by`,
  `attached_to`→`has_attachment` or planner's wording). Matches the 117 panel's outgoing+incoming
  view and gives the agent the full neighborhood. *Rejected:* outgoing-only (misses "what
  supersedes this?"); both-flat-no-inverse (more inference burden on weak models).
- **D-116-3 (Tool input — `document_id` primary + exact-filename fallback):** the tool identifies
  the subject document by **`document_id`** (the agent already holds these from
  `search_documents`/`query_documents` `source_refs` it cites) **and** accepts an **exact
  filename** for when the user names a doc directly. A filename resolves **caller-scoped → the
  latest accessible version** (own-or-global). Single clear arg shape weak models can fill —
  honors the `minimax-m3-invalid-tool-args-400` watch item (do not regress it; the SC#10 MiniMax
  row observes). *Rejected:* `document_id`-only (forces a prior lookup whenever the user names a
  doc by title); filename-only (ambiguous on duplicate filenames; diverges from the cited id).
- **D-116-4 (Compact, citable rows):** each returned related doc is a **compact row** — `filename`
  + `document_id` + `rel_type` + `direction` (and the inverse label for incoming) — mirroring the
  115 `query_documents_by_view` compact-row + `source_refs` shape so the answer is **citable** and
  the agent can chain to `read_document`/`analyze_document`. Exact field set = planner discretion
  within this shape.

### Create-time validation (REL-01)
- **D-116-5 (Visible-only — block probe-by-link):** link creation requires that **BOTH** source
  AND target are documents the **creator can currently see** (own-or-global). Linking to a doc you
  can't see is rejected — closes a probe-by-link existence leak. Self-link is already blocked by
  the table's `no_self_rel` CHECK.
- **D-116-6 (Idempotent on duplicate):** creating the **same `(source, target, rel_type)`** twice
  is an **idempotent no-op** that returns the existing edge — not a duplicate row and not an error.
  *Rejected:* allow-duplicates (messy reads, downstream dedupe); reject-409 (forces the 117 UI /
  agent to catch + interpret an error for a benign action). Note: the table has **no unique
  constraint** on `(source, target, rel_type)` today — planner decides whether to enforce
  idempotency in app code or add a partial unique index (additive, no data migration).
- **D-116-7 (Single directed edge — inverse derived, never stored):** "A supersedes B" stores
  **exactly one row** (A →supersedes→ B). The inverse ("B superseded_by A") is **derived at read
  time** from the incoming-direction query (D-116-2). *Rejected:* auto-create-inverse-row (stores
  the same fact twice, sync risk on delete, double audit).

### Write surface scope
- **D-116-8 (API write, agent read-only):** create + remove ship as **backend REST endpoints**
  (consumed by the Phase 117 panel UI); the agent gets **only** the read-only
  `get_related_documents` tool. REL-04 names just the read tool; humans curate the graph, the agent
  traverses it. Mirrors 115's read-only agent surface — lowest blast radius. Agent-driven
  create/remove is **deferred** (see Deferred Ideas).

### Carried forward from 113/114/115 (reaffirmed — locked, not re-discussed)
- **D-116-9 (Leak-safe masking — SC#2):** a relationship whose target the caller can't see renders
  as **"linked document (no access)"** — never the title/metadata. Same per-viewer leak-safe
  pattern as D-113-4 / D-115-6; **verify LIVE in secure-phase** (the real two-user test, not the
  RLS label — the D-102/D-110-5 "static would false-green" lesson). Note: `document_relationships`
  RLS is **user-scoped only** (no `is_global`; migration 071), so the tool returns only the
  caller's own edges — masking applies to the **target doc** access, not the edge ownership.
- **D-116-10 (Agent-tool wiring contract — SC#1, guard the Phase 101 visibility bug):**
  `get_related_documents` MUST be in `_TOOL_REGISTRY` **AND** in the default `get_tools()` assembly
  so the Deep-mode model actually sees + calls it (the INVERSE of harness-only `render_template`).
  Acceptance = the model **actually invokes it live**. New tool = one `_handle_*` + one
  `_TOOL_REGISTRY` line + one `get_tools` schema; **`threads.py` untouched** (G-5 extension
  contract). `dispatch_tool` whitelist guard = SC#2 for free (`phase_whitelist`-None = byte-identical
  Deep dispatch).
- **D-116-11 (No new migration):** composes the live `document_relationships` table + the live
  documents/version model. **Zero schema change** (a partial unique index per D-116-6, if chosen, is
  an additive index — planner's call).

### Audit (Claude's discretion — locked)
- **D-116-12 (First-class relationship audit — already in the enum):** a create writes the
  **`relationship.create`** audit action; a remove writes **`relationship.delete`** — both already
  in `VALID_ACTION_TYPES` (`audit_service.py:22`) and the live `audit_log` CHECK enum (migration
  071). **No frozenset-sync / boot-guard dance, no audit migration** (unlike 115, which reused
  `search.query`). Fire-and-forget via the same `ctx.spawn(write_audit_entry(...))` / threadpool
  pattern. SC#1 requires the `relationship.create` row to land **live**.

### Claude's Discretion
- The follow-to-latest **mechanism** (D-116-1a: read-time resolve vs re-point-on-upload).
- Idempotency enforcement **site** (app-code check vs additive partial unique index — D-116-6).
- Exact **inverse-label** wording for each rel_type (D-116-2) and the exact **field set** on each
  compact row (D-116-4).
- Tool **name** + JSON-schema arg shape for the `document_id`-XOR-`filename` discriminator
  (D-116-3) — planner/researcher per cross-provider tool-selection research; must read as "fetch a
  document's typed relationships," and keep the MiniMax arg-parsing watch item in view.
- The create/remove **route shape** (e.g. `POST /document-relationships`, `DELETE
  /document-relationships/{id}`) and request models.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & success criteria (read FIRST — no SPEC.md for this phase)
- `.planning/ROADMAP.md` §"Phase 116: Document Relationships — Backend + Agent Tool" —
  authoritative goal, REL-01/03/04, and SC#1–3 (version-stable links + live `relationship.create`
  audit; registry + advertised `get_tools` + leak-safe "no access" masking; SC#10 4-axis UAT).
- `.planning/REQUIREMENTS.md` — REL-01, REL-03, REL-04 (and REL-02 = Phase 117, out of scope).
- `CLAUDE.md` §"UAT scoreboard recipe (MANDATORY)" — the SC#10 4-axis bandwidth table
  (cross-provider / multi-tool / parallel-thread / long-message); rows authored under VALIDATION.md,
  not PLAN tasks.

### The substrate (already live — read before touching)
- `supabase/migrations/071_dm_foundations.sql` — `document_relationships` table (lines **57-69**:
  `source_doc_id`/`target_doc_id` FK→`documents(id)` `ON DELETE CASCADE`, `rel_type` CHECK over the
  4 types, `no_self_rel` CHECK, **no unique constraint**), its **user-scoped-only** RLS (lines
  **135-149**, no `is_global`), indexes on source/target (**184-185**), and the audit-enum CHECK
  (line **33** — `relationship.create`/`relationship.delete` present).
- `backend/app/services/audit_service.py:22` — `VALID_ACTION_TYPES` has `relationship.create` /
  `relationship.delete`; `:30` boot drift-guard. The D-116-12 reuse target (no new audit migration).
- `supabase/migrations/025_document_versioning.sql` — `version_number` + `is_latest`; "re-uploading
  creates a new version row; old version is_latest=false"; the **`(user_id, filename, is_latest)`**
  partial index. The lineage model D-116-1 resolves over (no lineage UUID exists).
- `backend/app/api/documents.py:420-486` (version-create cascade), `:545-558`, `:651-663` (restore)
  — how a new version / restore flips `is_latest`; the re-point hook site **if** D-116-1a chooses
  mechanism (b).

### The agent-tool seam (the net-new wiring — mirror Phase 115)
- `backend/app/services/tool_dispatcher.py` — `_TOOL_REGISTRY` (**~line 2353** — add one handler
  line), `dispatch_tool` + the `phase_whitelist` guard (**~2417/2424** = SC#2 free), the
  `ToolContext` dataclass (`current_user`, `folder_subtree_ids`, `user_settings`, `supabase`,
  `pool`, `spawn`) and `ToolResult` (`result`/`source_refs`/`citations`).
- `backend/app/services/tool_dispatcher.py:173` `_handle_search_documents` — **the closest handler
  analog**: caller-scoped resolution, `source_refs`/`citations` accumulation, the leak-safe
  scope-clip, and the fire-and-forget audit-spawn pattern.
- `backend/app/services/openai_service.py:873` `get_tools()` (assembly **876-882**) — **add the new
  tool's schema here** (SC#1). `SEARCH_DOCUMENTS_TOOL` schema at `:20` is the shape analog;
  `apply_tool_budget` (**892**) shows the harness/explorer filters.

### The closest prior analog (read for the pattern, do NOT re-derive)
- `.planning/phases/115-virtual-folders-agent-tool/115-CONTEXT.md` — the read-only agent-tool
  contract this phase mirrors: D-115-8 (registry **+** `get_tools`, guard the 101 visibility bug),
  D-115-6/7 (per-viewer leak-safe; whitelist free), D-115-3/4 (compact citable rows + `source_refs`),
  D-115-10 (fire-and-forget audit), and the cross-provider arg-design discipline (D-115-1).
- `.planning/phases/113-virtual-folders-filter-compiler-equality-views-backend/113-CONTEXT.md` —
  D-113-4 (per-viewer leak-safe; 404/not-found-not-403), the "static would false-green → verify
  leak-safety LIVE" lesson for secure-phase.

### Reported bug (watch item — NOT folded)
- `.planning/reported-bugs/minimax-m3-invalid-tool-args-400.md` — OPEN; `backend/provider-minimax`,
  `backend/tool-dispatch`. The `document_id`-XOR-`filename` arg (D-116-3) must not worsen it; the
  SC#10 MiniMax UAT row is the observation point. Same handling as Phase 115 — observe, don't fix
  here.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`_handle_search_documents` (`tool_dispatcher.py:173`)** — clone the handler shape: caller-scoped
  resolution, `source_refs`/`citations`, leak-safe scope-clip, fire-and-forget audit.
- **`document_relationships` table + RLS (migration 071)** — the live substrate; user-scoped only,
  both FKs CASCADE, rel_type + no_self_rel CHECKs already enforced.
- **`relationship.create` / `relationship.delete` in `VALID_ACTION_TYPES`** — first-class audit
  signals, already enum-synced + boot-guarded; no migration needed.
- **`get_tools()` assembly + a `*_TOOL` schema constant (mirror `SEARCH_DOCUMENTS_TOOL`)** — where
  the read tool becomes Deep-visible (SC#1).
- **`ToolResult.source_refs`** — the citable-answer channel for related-doc rows.
- **The `is_latest` / `(user_id, filename)` version model (migration 025, documents.py)** — the
  lineage D-116-1 resolves over (or re-points on bump).

### Established Patterns
- **G-5 extension contract** — new tool = one `_handle_*` + one `_TOOL_REGISTRY` line + one
  `get_tools` schema; `threads.py` untouched (Phase 083/101/115 precedent).
- **`dispatch_tool` whitelist guard** — `phase_whitelist`-None = byte-identical Deep dispatch (SC#2
  free).
- **Per-viewer leak-safe resolution; "no access" masking; not-found-not-403** (D-113-4 / D-115-6) —
  the SC#2 leak invariant, verified LIVE in secure-phase.
- **`run_in_threadpool` / `aexec`** around every sync supabase-py call in async handlers (D-v2.5-01).
- **One UX, N adapters** — the tool surfaces in the shared SSE/tool vocabulary; **no per-provider
  branch** ([[feedback-provider-uniform-ux]]).

### Integration Points
- `_TOOL_REGISTRY` (+1 line) and `get_tools()` (+1 schema) — the two wiring sites for the read tool;
  `threads.py` stays untouched.
- New create/remove REST endpoints (router mounted in `main.py`) — the write surface the Phase 117
  panel consumes.
- The version-create cascade in `documents.py` — the re-point hook site **only if** D-116-1a picks
  mechanism (b).

</code_context>

<specifics>
## Specific Ideas

- **Humans curate, the agent traverses** — write surface is human/UI (117); the agent gets a
  read-only neighborhood view. Auto-organizing the graph is a future capability, not this phase.
- **Links are one fact seen from both sides** — a single directed edge, with the inverse derived at
  read; no double rows, no sync risk.
- **Honesty + leak-safety are load-bearing** — "linked document (no access)" masking, caller-scoped
  results, citable `source_refs`; follow-to-latest so a link is never silently stale.
- **The MiniMax arg-parsing watch carries from 115** — the `document_id`-XOR-`filename` discriminator
  must be a clear shape weak models can fill.

</specifics>

<deferred>
## Deferred Ideas

- **Agent-driven create/remove of relationships** (the agent links documents autonomously during a
  chat) — out of REL-04's scope this phase (D-116-8). A bigger write surface with new leak/whitelist
  considerations; revisit as its own future phase if product wants auto-organizing.
- **Provenance / "linked against version N" history** (follow-to-latest *and* record the original
  version) — D-116-1 keeps v1 navigation-only; re-open if governance (Phase 119) wants version-aware
  relationship history.
- **Relationship types beyond the four** (`supersedes`/`amends`/`references`/`attached_to`) — fixed by
  the table CHECK; extending the enum is an additive migration in a later phase, not here.
- **The relationship panel UI** — Phase 117 (REL-02, G-2 sketch). This phase is backend-only.

### Reviewed Todos (not folded)
- `todo.match-phase` returned **0 matches** for Phase 116 (1 pending todo, none scoped to document
  relationships). Nothing folded, nothing to defer.

</deferred>

---

*Phase: 116-document-relationships-backend-agent-tool*
*Context gathered: 2026-06-20*
