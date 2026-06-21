# Phase 100: Ephemeral Template Upload - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Phase Boundary

A user can hand a workflow a template file (docx/pptx/xlsx) for one run — uploaded into a
thread's **workspace** (never the knowledge base), RLS-scoped to the owner, **never ingested,
never embedded, never appearing in KB search**, and automatically expiring via TTL
(`expires_at`) + a sweep so it is no longer retrievable after expiry. Delivers REQ **TMPL-01**
and closes the injection-via-uploaded-doc vector structurally.

This is the one genuinely net-new plumbing piece of v2.9: the workspace API is GET-only today
(no user upload exists anywhere), and `workspace_files` has no `kind` or `expires_at` columns
(a real SQL migration — the first to touch this table since v2.7). Everything else is additive
reuse of the v2.7 workspace (table, hybrid inline/Storage service, RLS, panel FilesSection).

**In scope:** migration adding `kind` + `expires_at` to `workspace_files`; a
`POST /threads/{tid}/workspace/files` upload endpoint (multipart) in `workspace.py`;
strict type validation; read-path expiry filtering (API + agent tools, gated);
in-process janitor sweep (rows + Storage bytes); run-pin at workflow kickoff;
panel upload affordance + ephemeral badge/countdown; the `kind='template_input'` seam
Phase 101 consumes; 7 G-4 lived-experience UAT rows.
**Out of scope:** the fill/render behavior (Phase 101); definition-level `assets`/`AssetRef`
behavior — workflow-owned library templates (Phase 101); the launch form with file inputs
(Phase 103); output re-ingestion (SEED-069, Phases 101/102); any Settings-UI work for the TTL.

</domain>

<decisions>
## Implementation Decisions

### Upload UX & ephemeral visibility (sketch-aligned)
- **D-01: Entry point = an "Upload template" affordance in the workspace panel's Files
  section** (`FilesSection.tsx`). The composer stays untouched — the sketched 2-pill resting
  composer (sketch 011) is deliberately minimal, and a composer attach would read as
  "add to knowledge base", the exact ambiguity TMPL-01 closes. Phase 103's launch form
  (`InputFieldSpec.type: "file"`, already locked) becomes the second entry point later.
- **D-02: Ephemeral cue = kind-distinct file card with a "Template" badge + live expiry
  countdown** (muted mono caption, e.g. "expires in 23h"; amber tint when close to expiry —
  the established amber = needs-attention color language; per-extension file icons per
  sketch 016).
- **D-03: Expiry UX = the file simply disappears from the list** (panel = now, reconciles to
  current state). No tombstone. Chat history untouched.
- **D-04: No chat artifact on upload.** Upload is a user action on the panel; nothing renders
  in the conversation.

### TTL + sweep mechanics
- **D-05: Default TTL = 24 hours, stored in `app_settings`** (tunable without code; no
  Settings-UI work this phase). Planner picks the key name.
- **D-06: The "not retrievable after expiry" guarantee lives in read-path filtering, NOT the
  sweep.** Every read (workspace API routes + `workspace_read`/`workspace_list` agent tools)
  excludes expired rows the instant `expires_at` passes. The filter is **gated on
  `expires_at IS NOT NULL`** so all existing workspace files (agent-written, NULL expiry)
  behave byte-identically — the 098 D-05a gated-no-op pattern. Sweep timing can never open a
  security window.
- **D-07: Physical deletion = in-process asyncio periodic task** in the FastAPI lifespan
  (~15 min cadence; planner picks exact interval), deleting expired rows AND their Storage
  bytes via supabase-py. Idempotent by construction so `WORKER_COUNT=2` double-running is
  harmless (no lock needed; a Redis lock is optional polish, not required). Precedent: the
  harness startup resume sweep in `main.py`. pg_cron rejected — it cannot call the Storage
  API, so bytes would orphan; startup-only sweep rejected — bytes would linger until restart.

### Expiry semantics vs runs
- **D-08: TTL is fixed from upload — no silent refresh on use.** Predictable ephemerality.
- **D-09: Run-pin exception:** a workflow run that starts before expiry bumps `expires_at`
  forward just enough to cover the run's wall-clock cap (+ margin) at kickoff — one UPDATE,
  no snapshot machinery (an ephemeral file doesn't need 099-style snapshots). No run can die
  mid-flight from template expiry.
- **D-10: Expired/missing template reads return a clear tool error naming expiry**
  ("template expired") so the model can relay honestly — run-honesty design direction. NOT a
  generic not-found (the model would confabulate about a file the user knows they uploaded).
- **D-11 (locked invariant): The template is OPTIONAL everywhere.** No workflow requires a
  template; the kickoff path doesn't check for one; a workflow without a template runs
  byte-identically to today. An uploaded template never used by any run simply expires and is
  swept. Every touched code path is a literal no-op when no `template_input` file exists.

### Template typing & the Phase-101 seam
- **D-12: Strict allowlist + magic-byte validation.** Only `.docx`/`.pptx`/`.xlsx`; verify
  the actual bytes are a ZIP/OOXML container (all three are ZIPs — one cheap check), not just
  extension/MIME. Renamed binaries are rejected at the door with a clean visible error.
  The existing `workspace_files_size_limit` CHECK (10 MB) applies.
- **D-13: Definition-level `assets`/`AssetRef` behavior is DEFERRED to Phase 101.** The
  locked `AssetRef` shape describes workflow-owned library assets (no TTL, bound to a
  published definition) — a different lifecycle from this phase's per-thread ephemeral
  upload. Phase 101 builds the trusted-library fill path that actually consumes `assets`;
  the 098 co-lock comment in `harness.py` should be updated to point at 101 when convenient.
- **D-14: Runs find the template by kind, in-thread.** Phase 101's fill step looks for the
  thread's live (non-expired) workspace file(s) with `kind='template_input'` — newest wins;
  the agent can also list them via `workspace_list`. Zero kickoff-API changes in this phase;
  the seam is just the `kind` column + readable tools. (Explicit kickoff references arrive
  with 103's launch form if needed.)

### G-4 lived-experience UAT rows (operator-defined at scope time — MANDATORY, all 7)
1. **Upload→visible→readable:** upload a real docx in the panel → card appears with badge +
   countdown → a workflow/agent reads it in-thread.
2. **Never-in-search proof:** search the KB (agent `search_documents` + any UI search) for
   distinctive text inside the uploaded template — it must never appear in results.
3. **Expiry end-to-end:** short-TTL upload → file disappears from panel → agent read fails
   with the expiry message → after sweep, the DB row AND Storage bytes are physically gone.
4. **Bad-file rejection:** disallowed type (e.g. `.exe` renamed `.docx`, or a PDF) → clean
   visible rejection, nothing persisted.
5. **Run-straddles-expiry:** start a workflow near expiry → run-pin (D-09) extends the file →
   run completes successfully.
6. **Cross-user isolation:** a second user cannot list or download the template (RLS half of
   SC#1; `/gsd:secure-phase` will reuse this row).
7. **No-template regression:** agent-written workspace files (`expires_at NULL`) list/read/
   diff exactly as today, AND a workflow with no template runs byte-identically (the D-11
   invariant, proven live).

### How we'd know this failed (G-6)
- An expired template is still readable by any path (API, tool, Storage URL) after
  `expires_at` — the guarantee failed.
- Distinctive template content appears in any KB search result — the isolation failed.
- A workflow run dies mid-flight because its template expired — the pin failed.
- Existing workspace files or no-template workflows behave differently than before — the
  gated no-op failed.
- Storage bytes for expired templates accumulate unbounded — the sweep failed.

### Claude's Discretion
- Exact `kind` column design (e.g. text column with CHECK vs enum; default `'agent'` or NULL
  for existing rows) — must keep existing rows valid with zero behavioral change.
- `app_settings` key naming, sweep interval, run-pin margin size.
- Multipart upload implementation details (streaming vs buffered; reuse of
  `workspace_service.write_file` vs a thin sibling).
- Whether the countdown updates live or on panel re-render (lean: cheap re-render cadence,
  no per-second timers).
- Whether upload emits the existing `workspace_file_written` SSE event or a sibling event for
  panel reconciliation (lean: reuse, the panel already consumes it).
- Duplicate-filename handling on re-upload (workspace versioning exists; lean: new version,
  same expiry rules).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner) MUST read these before planning or implementing.**

### Phase requirements & success criteria
- `.planning/ROADMAP.md` → "### Phase 100: Ephemeral Template Upload" — 3 success criteria
  (workspace-only upload via `POST /threads/{tid}/workspace/files` with `kind='template_input'`;
  never ingested/embedded/searchable; TTL + sweep). UI hint: yes. NOT SC#10-flagged (no
  provider-bearing runs in upload plumbing).
- `.planning/REQUIREMENTS.md` → **TMPL-01**.

### Prior-phase decisions this phase builds on
- `.planning/phases/098-project-binding-server-side-kb-scope-governance/098-CONTEXT.md` —
  D-05a (gated no-op on shared paths — D-06's filter gate reuses it), D-08/D-10
  (additive-optional `_StrictBase` co-lock; `assets`/`InputFieldSpec` shapes already landed).
- `.planning/phases/099-workflow-skill-composition/099-CONTEXT.md` — D-04 (gated branch on a
  shared tool handler — the same pattern for expiry filtering in workspace tools); D-03a
  (first-kickoff seam in `threads.py` via thin service call — the run-pin lands the same way,
  WITHOUT growing the hot file).
- `scripts/spike-097/CONCLUSION.md` — §3 schema shape (`assets: list[AssetRef]` is the
  LIBRARY path, deferred per D-13); Condition 5 (the arbitrary-upload fill path is an OPEN
  unknown for Phase 101 — this phase only delivers the upload, not the fill).

### Existing code seams (where the work lands)
- `backend/app/api/workspace.py` — router prefix `/threads/{thread_id}/workspace`,
  `_verify_thread_ownership` (404 on non-owner), GET-only routes today (files list ~98,
  content ~124, versions ~202, diff ~238). **The POST upload endpoint lands HERE — NOT in
  `threads.py`** (G-5: threads.py extraction is still due; do not grow it).
- `backend/app/services/workspace_service.py` — `write_file()` (hybrid: inline ≤256 KB
  `DEFAULT_INLINE_THRESHOLD`, else Storage at `{user_id}/{thread_id}/{file_id}/v{n}`),
  `validate_path`, `guess_mime_type`, `_get_file_content`. The upload reuses this service.
- `backend/app/services/tool_dispatcher.py` — `_handle_workspace_read` (~1049),
  `_handle_workspace_list` (~1085), `_handle_workspace_write` (~1007; emits
  `workspace_file_written` SSE with the row id). **Shared with Deep mode — expiry filtering
  must be gated (D-06).**
- `supabase/full-schema.sql` — `workspace_files` (thread_id, path ≤500, size ≤10 MB CHECK,
  mime_type, content_inline/content_storage_path, created_by; **no kind, no expires_at**) +
  RLS policies (`workspace_files_*_own` via threads.user_id join) + `workspace_file_versions`.
- `backend/app/main.py` — FastAPI lifespan (harness resume sweep ~246 — the precedent the
  D-07 janitor task follows; mind `WORKER_COUNT=2` idempotency, D-PRD-12).
- `backend/app/services/sandbox_service.py` — `_evict_expired` (~187, lazy TTL precedent).
- `backend/app/api/threads.py` — workflow kickoff block (~837-857, where 099's
  `_ensure_skill_snapshots` thin seam sits — the D-09 run-pin is the same shape: one thin
  service call, nothing more).
- `backend/app/models/harness.py` — `AssetRef` (~166) + `InputFieldSpec` (~156) locked
  shapes + the 098 co-lock comment (~151-155) that assigns "assets behavior" — update its
  pointer to Phase 101 per D-13.
- `frontend/src/components/panel/FilesSection.tsx` — the panel file browser the upload
  button + badge/countdown land in.
- `frontend/src/components/panel/WorkspacePanel.tsx` — panel shell hosting FilesSection.

### Design contracts
- `.claude/skills/sketch-findings-agentic-rag` — panel = now / chat = happened (D-03/D-04);
  2-pill composer stays untouched (D-01); `references/file-browser-and-diff.md` (file card
  shapes); sketch-016 per-extension file icons + amber color language (D-02).

### Governing rules
- `CLAUDE.md` — migration rules (numbered SQL under `supabase/migrations/` — next number
  after 067; apply via SQL editor, never db push/reset; regenerate `full-schema.sql` no-reset);
  RLS mandate; settings live in `app_settings` (D-05); G-5 hot-file ledger (`threads.py` must
  not grow); G-4 lived-experience UAT (the 7 rows above); "ingestion is manual file upload
  only" is NOT violated — this upload is workspace-only, never ingestion.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`workspace_service.write_file()`** — the entire persistence path (hybrid inline/Storage,
  versioning, size accounting) already exists; the upload endpoint is multipart parsing +
  validation + one call into it.
- **RLS is already correct** — `workspace_files` policies scope every row to the thread
  owner via the threads join; the upload inherits SC#1's RLS clause for free.
- **The panel already reconciles files** — `FilesSection.tsx` + the `workspace_file_written`
  SSE event; the upload can reuse the same event for live appearance.
- **Sweep precedents** — harness startup sweep (lifespan) + sandbox lazy eviction; the D-07
  periodic task is a small composition of both ideas.
- **Kickoff seam precedent** — 099's `_ensure_skill_snapshots` thin-wrapper shows exactly how
  the D-09 run-pin enters `threads.py` without growing it.

### Established Patterns
- **Gated no-op on shared paths** (098 D-05a / 099 D-04) — expiry filtering on workspace
  reads/tools gates on `expires_at IS NOT NULL`; agent-written files are byte-identical.
- **Additive migration + regenerate full-schema** — numbered SQL, SQL-editor apply,
  `scripts/regenerate-full-schema.sh` (no reset), commit both.
- **Run-honesty error surfaces** — specific, relay-able tool errors (D-10) over generic 404s.

### Integration Points
- Migration: `kind` + `expires_at` (+ partial index on non-null `expires_at` for the sweep
  query) on `workspace_files`.
- `POST /threads/{thread_id}/workspace/files` → `workspace.py` (multipart; validation D-12;
  sets `kind='template_input'` + `expires_at = now + TTL`).
- Expiry filter → `workspace.py` GET routes + `_handle_workspace_read`/`_handle_workspace_list`
  (gated).
- Janitor task → `main.py` lifespan (idempotent; rows + Storage bytes).
- Run-pin → thin service call at the workflow kickoff block in `threads.py` (D-09).
- Upload button + badge/countdown → `FilesSection.tsx`.
- **RED LINE:** Deep-mode chat and all existing workspace behavior stay byte-identical; every
  new code path is a literal no-op when no `template_input`/non-null-expiry file exists (D-11).

</code_context>

<specifics>
## Specific Ideas

- **"Panel = now" governs the whole UX:** upload lives in the panel, expiry makes the file
  vanish from the panel, chat never mentions it.
- **The guarantee is the filter, the sweep is the janitor** — expiry must be enforceable to
  the second without depending on a scheduler being alive.
- **Templates are optional everywhere** (D-11) — operator explicitly confirmed no workflow
  ever requires one; absence = byte-identical behavior.

</specifics>

<deferred>
## Deferred Ideas

- **Definition-level `assets`/`AssetRef` behavior** (workflow-owned library templates, no-TTL
  lifecycle) → **Phase 101** (the trusted-library fill path consumes it). Update the 098
  co-lock comment pointer in `harness.py` accordingly.
- **Explicit template reference at kickoff / launch-form file input** → Phase 103
  (`InputFieldSpec.type: "file"` already locked).
- **Settings-UI exposure of the template TTL** → future Settings polish; 100 ships the
  `app_settings` row only.
- **Composer attach affordance** → only if real usage shows the panel button is
  undiscoverable; revisit at Phase 104 (flagship content pack UAT) at the earliest.
- **Template preview in the panel** (rendering docx/pptx/xlsx) → SEED-037 / Phase 108
  `file_preview` plugin territory.

*No reviewed-but-deferred todos — `todo.match-phase` surfaced none for this phase.*

</deferred>

---

*Phase: 100-ephemeral-template-upload*
*Context gathered: 2026-06-10*
