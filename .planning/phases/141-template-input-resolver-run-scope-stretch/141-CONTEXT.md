# Phase 141: template_input Resolver Run-Scope (STRETCH) - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the **ephemeral-template resolver** run-aware so a `.docx/.pptx/.xlsx`
template consumed by one run's `render_template` cannot be silently resolved by a
**foreign** run's `render_template` — while the normal single-thread render keeps
working. This is **COLL-02**, the defense-in-depth twin of Phase 120's COLL-01
(Mechanism B, which never fired in the live evidence — keep it narrow, don't
over-build).

**The one seam that changes:** `template_asset_service.resolve_template_source`,
Branch 2 (the ephemeral `kind='template_input'` upload path). Today it scopes only
on `thread_id + created_by + kind='template_input'`, newest-wins, not-expired —
there is **no run dimension at all**. `render_template` is reachable from BOTH Deep
chat and Harness/workflow phases (harness `emitters.py` re-dispatches the same
`_handle_render_template`), so a shared thread lets a workflow-run's template leak
into a Deep turn (and vice-versa). That cross-context leak is the concrete target.

**In scope:**
- A run-lineage **claim** on ephemeral `template_input` rows (new nullable column,
  migration **092**) + resolver filter/stamp that blocks foreign-lineage templates.
- The library `AssetRef` branch (Branch 1, published workflow assets) is UNCHANGED —
  it's already immutable/authored/no-TTL and carries no cross-run leak.
- Faithful cross-run repro test (fails-before / passes-after) + a cross-provider
  render smoke.

**Out of scope:**
- Strict per-run isolation that forces a re-upload on every follow-up message
  (rejected — see D-141-01). Same-mode reuse stays working.
- Any change to the citation / coverage / integrity gates, the sandbox render
  driver, the upload endpoint UX, or the Phase-100 run-pin expiry contract.
- Growing `threads.py` (G-5 firing hot file) — the change lives in
  `template_asset_service.py` + the migration; the resolver does the claim.

**Red line:** Deep Mode stays byte-identical when no cross-context template exists;
provider differences (if any) stay at the gateway/adapter boundary; no shared-path
fork. `render_template` remains inert unless the model calls it.
</domain>

<decisions>
## Implementation Decisions

### Scope semantics — what "run-scoped" means (the core decision)
- **D-141-01: Narrow — block the cross-context leak, PRESERVE same-mode reuse.**
  The requirement text ("uploaded in one run… not visible in another run") does not
  match the architecture: templates are uploaded to a **thread**, between runs, with
  **no run_id** (`api/workspace.py` — "the handler has no run"); runs merely *consume*
  them. So the honest reading is "a template **claimed by** one run's context is not
  reachable by a **foreign** run's context." We block:
  - a **workflow-run** template → a **Deep** turn, and vice-versa (the Phase-120
    collision), and
  - a **workflow-run W1** template → a **different workflow-run W2**.

  We KEEP working:
  - **Deep → Deep** reuse (upload once, "now do it again for Q2" in the next Deep
    turn still resolves the same template — no re-upload), and
  - reuse **across phases of the SAME workflow_run** (they share one `workflow_run_id`).

  Rationale: this satisfies SC#1's real intent AND SC#2's no-regression; strict
  per-run isolation was **rejected** because it's a felt UX change for a leak that
  never fired live and it fights the Phase-100 D-09 design that deliberately keeps
  templates alive across a thread.

### Mechanism — how the scope is enforced
- **D-141-02: Claim-stamp column, migration 092.** Add **one nullable column** to
  `workspace_files` holding the claiming **lineage** (not the raw run_id — a raw
  run_id would break Deep→Deep reuse). The claim value:
  - `str(workflow_run_id)` when a **workflow phase** resolves, else
  - a fixed **`'deep'` sentinel** when a **Deep** turn resolves.

  A text column is the pragmatic type because the value is "a workflow_run_id **or**
  the `deep` sentinel" (a plain uuid FK can't hold the sentinel, and the sentinel is
  what makes the block **symmetric** — without it, a Deep-touched NULL row could be
  claimed by a later workflow run = an unblocked Deep→workflow leak). Column
  name/exact type is planner's call; the contract is "holds workflow_run_id OR the
  deep sentinel." Mirrors how Phase 120 added `messages.origin` for its isolation
  half. **No-schema time-cutoff was rejected** — it catches "stale previous run" but
  cannot cleanly tell Deep from workflow, which is the actual leak.
- **D-141-03: Claim-on-first-resolve, in the resolver (not at run-start pin).**
  When the resolver finds an eligible row whose claim `IS NULL`, it **stamps** it with
  the current run's own-claim (a single asyncpg `UPDATE` on the pool — non-blocking,
  no supabase-py). Lazy claiming (only what's actually rendered) is more precise than
  claiming all thread templates at the run-start pin, and it keeps `threads.py`
  untouched (G-5). Resolver rule:
  - resolve rows where `claim IS NULL` (then stamp own-claim) **OR** `claim = own-claim`;
  - a row with a **foreign** claim is invisible → the clean "no template" path.

  Whether the stamp fires on *resolve* vs only on *successful* render is Claude's
  discretion (on-resolve is the simplest and safe — the claim is about *visibility*,
  not success; a same-run retry still sees `claim = own-claim`).
- **D-141-04: No backfill (mirror 120 D-05).** Pre-migration `template_input` rows have
  claim `NULL` → treated as **unclaimed** → the first run of any context to resolve
  them claims them. Safe: a legacy template is exposed only to its first claimer, never
  cross-context afterward. Back-tagging historical rows is not worth the complexity.

### Failure / honesty behavior
- **D-141-05: Distinct, honest "belongs to another run" message when a foreign-claimed
  row exists.** The resolver already runs a second query to distinguish *expired* from
  *never-uploaded* (returning different relay-able strings). Extend that pattern: when
  an eligible-but-foreign-claimed `template_input` row exists, return a distinct
  message — e.g. "This template belongs to a different run/context. Upload it again for
  this run." — rather than the generic "no template uploaded" (which would confuse a
  user who *did* upload one). Still a clean relay string (D-05), never a raw 404/leak
  of the other run's bytes. Exact wording is planner's call.

### Verification bar
- **D-141-06: Faithful cross-run repro test is the headline bar (mirror 120 D-08).**
  Shared thread: a **workflow run** uploads/claims a `template_input` and renders; then
  a **Deep** `render_template` in the same thread must **NOT** resolve that template
  (→ the honest "belongs to another run" path), and an **in-scope** render (a run with
  its own upload, and a Deep→Deep reuse) is **unchanged**. The test must **fail before**
  the fix and **pass after**. Add the symmetric Deep-template-vs-workflow-run direction
  and the cross-workflow-run (W1→W2) direction.
- **D-141-07: Cross-provider SMOKE, not the full SC#10 4-axis.** This is a
  **provider-agnostic** resolver change (the model only emits the tool call; the
  resolver is shared backend), and Phase 141 is **not** in the ROADMAP's SC#10 headline
  list. One representative model rendering an in-scope template successfully is enough
  to prove no cross-provider regression; the full cross-provider × multi-tool ×
  parallel-thread × long-message matrix is **not** required here.

### Claude's Discretion
- Exact column name + type (text sentinel vs. an enum+uuid pair) — planner picks;
  contract is "holds workflow_run_id OR a deep sentinel" (D-141-02).
- Stamp timing: on-resolve vs. on-successful-render (D-141-03) — on-resolve is the lean.
- Exact wording of the "belongs to another run" message (D-141-05).
- Whether sub-agent runs (`parent_run_id` set) inherit the parent's claim or claim
  independently — enumerate against the resolve path; the intent is "a sub-agent of a
  run shares that run's context," so it should inherit the parent's lineage.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements + roadmap
- `.planning/REQUIREMENTS.md` — COLL-02 (line 47): "resolver scoped to the current run…
  depends on Phase 120 COLL-01 run-scope seam"; traceability row (line 89).
- `.planning/ROADMAP.md` §"Phase 141: template_input Resolver Run-Scope (STRETCH)"
  (lines 374–384) — the 2 Success Criteria (what must be TRUE).

### The code seam that changes (read to ground the plan)
- `backend/app/services/template_asset_service.py` — **the whole file is the target.**
  `resolve_template_source` Branch 2 (lines 136–210) is the ephemeral `template_input`
  path whose WHERE clause gets the claim filter + the stamp UPDATE. Branch 1 (library
  AssetRef, lines 99–134) is UNCHANGED.
- `backend/app/services/tool_dispatcher.py:1925` — `_handle_render_template`; calls
  `resolve_template_source` at `:2051` with `ctx.thread_id` + `ctx.current_user["id"]`.
  The handler already has `ctx` (which carries `run_id`, `workflow_run_id`,
  `parent_run_id`) — pass the lineage through to the resolver.
- `backend/app/services/tool_dispatcher.py` `ToolContext` (lines ~81–141) —
  `run_id` (producer runs id), `parent_run_id` (sub-agent), **`workflow_run_id`
  (None on EVERY Deep caller, set on a workflow phase)** — this is the Deep-vs-workflow
  discriminator, no plumbing needed.
- `backend/app/services/harness/emitters.py:98-166` — `_render_template_post`
  re-dispatches the SAME `_handle_render_template` with a workflow `ctx`; this is why
  the cross-mode leak is real and why the fix at the resolver covers both modes at once.

### Run-pin + upload context (read to understand what does/doesn't carry a run)
- `backend/app/api/workspace.py:158-204` — the template upload endpoint; sets
  `kind='template_input'` + `expires_at`. Note "**the handler has no run**" — uploads
  are born run-less (why upload-time run tagging is impossible; claim-on-resolve is
  the mechanism).
- `backend/app/api/threads.py:1001-1007` + `backend/app/services/template_service.py:91-107`
  — `pin_templates_for_run` (Phase 100 D-09): at run start, EXTENDS every
  `template_input` expiry thread-wide. This is the keep-alive design D-141-01 must not
  regress; do NOT add the claim here (keep threads.py untouched — G-5).

### Schema + migration process
- `supabase/full-schema.sql:1457` — `workspace_files` table (no `run_id`, no claim
  column today; `thread_id`, `created_by`, `kind`, `expires_at`).
- `supabase/migrations/` — latest is `091_skill_embeddings.sql`; **next = `092_*`**.
  Apply per CLAUDE.md (paste into the Supabase SQL editor / psycopg2 :54322 — never
  `db push`/`db reset`), then `bash scripts/regenerate-full-schema.sh` (no reset),
  commit migration + regenerated `full-schema.sql` together.
- `.planning/phases/120-collision-fix-context-isolation/120-CONTEXT.md` — the COLL-01
  parent; §Deferred names COLL-02 as defense-in-depth, "Mechanism B did not fire in
  the live evidence." Its D-05 (no backfill) + D-08 (faithful-repro test) are the
  precedents D-141-04 / D-141-06 mirror.

### Cloud deploy note
- v3.2 cloud deploy must apply migration 092 to cloud Supabase by hand (see
  `.planning/` cloud-migration note; `scripts/pending-cloud-migrations.sh` lists it).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`resolve_template_source` already returns a clean `{bytes, filename, provenance,
  mime, error}` envelope** and already does a two-query "distinguish the failure
  reason" pattern (expired vs never-uploaded). D-141-05's "belongs to another run"
  message reuses exactly this shape — no new error plumbing.
- **`ToolContext.workflow_run_id`** is the ready-made Deep-vs-workflow discriminator
  (None ⇒ Deep) — the lineage/own-claim derivation is a one-liner off `ctx`.
- **The resolver already uses `pool.fetchrow`** (asyncpg) — the claim stamp is a
  non-blocking `pool.execute("UPDATE …")`; no `run_in_threadpool`/supabase-py concern.

### Established Patterns
- Migrations numbered, applied by hand to the live DB, then `full-schema.sql`
  regenerated (never hand-edited) — same as 120's migration 076.
- Isolation-by-column precedent: Phase 120 `messages.origin` (nullable, safe default,
  no backfill, filter at the read path). D-141-02/04 follow it 1:1.
- Clean-error / run-honesty (D-05): the resolver NEVER raises a raw 404 or leaks
  another user's/run's bytes — it returns a relay-able string.

### Integration Points
- Single write site (`_handle_render_template` → `resolve_template_source`) covers
  BOTH Deep and Harness because harness re-dispatches the same handler. Fixing the
  resolver fixes both modes without touching the harness emitter or threads.py.
- The claim filter sits in Branch 2's WHERE clause; the stamp is an UPDATE right after
  a NULL-claim row is selected. Branch 1 (library assets) is not touched.

</code_context>

<specifics>
## Specific Ideas

- The block must be **symmetric**: workflow→Deep AND Deep→workflow AND workflow-run
  W1→W2 are all blocked; Deep→Deep and same-workflow_run-across-phases are all allowed.
  The `'deep'` sentinel (vs. leaving Deep rows NULL) is what makes the Deep→workflow
  direction actually block — call this out in the plan so it isn't dropped.
- The repro test should mirror 120's discipline: assert the exact wrong behavior today
  (a foreign-context `render_template` resolving the other run's template) fails before
  the fix and passes after — not a proxy assertion.
</specifics>

<deferred>
## Deferred Ideas

- **Strict per-run isolation (re-upload every run)** — considered and rejected for 141
  (D-141-01); revisit only if a real cross-run-reuse leak is ever observed that the
  narrow cross-context block misses.
- **Claiming at the run-start pin instead of on-resolve** — considered; rejected for
  precision + to keep `threads.py` untouched (D-141-03). Could revisit if a future need
  arises to claim templates a run never actually rendered.

**Reported-bugs cross-check (mandatory):** none of the open `surface: Agentic-RAG`
reports fold into this phase — the resolver / `template_input` / run-scope domain does
not overlap any open report's `affected_areas` (all open ones are frontend/streaming,
chat-ui, provider-routing, title-gen, skills-studio, or workflows-page). No routing
changes made.

</deferred>

---

*Phase: 141-template_input Resolver Run-Scope (STRETCH)*
*Context gathered: 2026-07-07*
