# Phase 141: template_input Resolver Run-Scope (STRETCH) - Research

**Researched:** 2026-07-07
**Domain:** Backend ephemeral-template resolver run-scoping (asyncpg WHERE-filter + claim-stamp column) + additive Postgres migration
**Confidence:** HIGH (every seam read and verified against live code; the three landmines below are the load-bearing findings)

## Summary

CONTEXT.md is authoritative, detailed, and — for the seams it names — accurate. Every file:line reference in CONTEXT.md still matches the live code: `resolve_template_source` Branch 2 is at `template_asset_service.py:136-210` with exactly the described WHERE clause (`thread_id + created_by + kind='template_input' + not-expired`, newest-wins, `pool.fetchrow`, `{bytes,filename,provenance,mime,error}` envelope, two-query expired/never-uploaded distinction); Branch 1 (library `AssetRef`, `:99-134`) is untouched-safe; `ToolContext` (`tool_dispatcher.py:77-142`) carries `run_id`/`parent_run_id`/`workflow_run_id`; `_handle_render_template` is at `:1925` calling the resolver at `:2051`; the harness emitter re-dispatches the same handler; the upload endpoint is run-less; `pin_templates_for_run` must stay out of scope; the schema has no run/claim column; next migration is `092`.

However, CONTEXT.md's central simplifying claim — **"Single write site (`_handle_render_template` → `resolve_template_source`) covers BOTH Deep and Harness"** — is **incomplete and, if trusted literally, will ship a fix that silently fails to block the workflow-emit leak.** There are **three** production callers of `resolve_template_source`, **two** of which reach Branch 2 (ephemeral). The harness forced-emit path (`_exec_llm_emit`) has a **direct** resolve at `phase_types.py:1105` that CONTEXT.md never mentions, and it re-dispatches through a `_ProducerStreamCtx` proxy that **does not expose `workflow_run_id`** — so a naive `ctx.workflow_run_id` derivation returns `None` there and mis-claims a workflow render as the `'deep'` sentinel, re-opening the exact leak the phase exists to close.

**Primary recommendation:** Implement the claim as CONTEXT.md specifies (nullable claim column, migration 092, claim-on-resolve in Branch 2), but (1) make the claim-eligibility decision a **pure helper** keyed off `workflow_run_id` (→ correct sub-agent inheritance with zero new plumbing), (2) thread the own-claim to **all three** Branch-2-reaching resolve sites, and (3) explicitly stamp `workflow_run_id` onto the harness `_ProducerStreamCtx` (or derive lineage from the raw harness bag's `run_id`) so the emit path claims the workflow lineage, not `'deep'`.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-141-01: Narrow — block the cross-context leak, PRESERVE same-mode reuse.** Block: workflow-run→Deep (and vice-versa), and workflow-run W1→workflow-run W2. Keep working: Deep→Deep reuse, and reuse across phases of the SAME `workflow_run`. Strict per-run isolation (re-upload every run) is **rejected**.
- **D-141-02: Claim-stamp column, migration 092.** One nullable column on `workspace_files` holding the claiming **lineage** — `str(workflow_run_id)` when a workflow phase resolves, else a fixed **`'deep'` sentinel** when a Deep turn resolves. Text column (holds a workflow_run_id OR the deep sentinel). Column name/exact type is planner's call. The `'deep'` sentinel is what makes the Deep→workflow direction actually block. No-schema time-cutoff was rejected.
- **D-141-03: Claim-on-first-resolve, in the resolver (not at run-start pin).** When the resolver finds an eligible row whose claim `IS NULL`, stamp it (single asyncpg `UPDATE` on the pool). Resolver rule: resolve rows where `claim IS NULL` (then stamp own-claim) OR `claim = own-claim`; a foreign-claimed row is invisible → the clean "no template" path. `threads.py` stays untouched (G-5). On-resolve vs on-successful-render is Claude's discretion (on-resolve is the lean).
- **D-141-04: No backfill (mirror 120 D-05).** Pre-migration rows have claim `NULL` → unclaimed → the first run of any context to resolve them claims them.
- **D-141-05: Distinct, honest "belongs to another run" message** when an eligible-but-foreign-claimed row exists — extend the existing two-query expired/never-uploaded pattern. Never a raw 404 / never leaks the other run's bytes. Exact wording is planner's call.
- **D-141-06: Faithful cross-run repro test is the headline bar (mirror 120 D-08).** Fail-before / pass-after for workflow→Deep, plus the symmetric Deep→workflow and cross-workflow-run W1→W2 directions; in-scope renders (own-upload + Deep→Deep reuse) unchanged. Not a proxy assertion.
- **D-141-07: Cross-provider SMOKE, not the full SC#10 4-axis.** One representative model rendering an in-scope template successfully. The full 4-axis matrix is NOT required here (141 is not on the ROADMAP SC#10 headline list; the resolver is provider-agnostic).

### Claude's Discretion
- Exact column name + type (text sentinel vs. an enum+uuid pair) — contract is "holds workflow_run_id OR a deep sentinel."
- Stamp timing: on-resolve vs. on-successful-render (on-resolve is the lean).
- Exact wording of the "belongs to another run" message.
- Whether sub-agent runs (`parent_run_id` set) inherit the parent's claim or claim independently — enumerate against the resolve path; intent is "a sub-agent of a run shares that run's context," so it should inherit the parent's lineage. **(RESOLVED below — inheritance is automatic if the claim keys off `workflow_run_id`.)**

### Deferred Ideas (OUT OF SCOPE)
- Strict per-run isolation (re-upload every run) — rejected for 141; revisit only if a real cross-run-reuse leak is observed that the narrow block misses.
- Claiming at the run-start pin instead of on-resolve — rejected for precision + to keep `threads.py` untouched.
- Any change to citation/coverage/integrity gates, the sandbox render driver, the upload endpoint UX, or the Phase-100 run-pin expiry contract.
- Growing `threads.py` (G-5 hot file).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COLL-02 | The `template_input` resolver is scoped to the current run — a template uploaded in one run is not visible/accessible in another. | The claim-filter + stamp on Branch 2 of `resolve_template_source` (verified `template_asset_service.py:136-210`), keyed off `ToolContext.workflow_run_id` (verified `:125`) with a `'deep'` sentinel. Must cover all THREE resolve callers (`tool_dispatcher.py:2051`, `phase_types.py:1105`, and the `_ProducerStreamCtx` re-dispatch). Validation Architecture below gives the fail-before/pass-after repro. |

## Project Constraints (from CLAUDE.md)

- **Python backend uses a `venv`.** No LangChain/LangGraph — raw SDK. Pydantic for structured outputs (N/A here). **Do not run blocking I/O in async handlers** — wrap `supabase-py` in `run_in_threadpool` (the resolver already avoids this: the claim stamp is `pool.execute`/asyncpg, non-blocking — no `run_in_threadpool` needed).
- **All tables need RLS.** `workspace_files` already has thread-owner RLS; the additive claim column inherits it (mirror migration 076/050 — no new policy). The resolver's `created_by = $user_id` scope is the app-layer backstop (V4).
- **Migrations ship as numbered SQL under `supabase/migrations/`** matching `<digits>_name.sql`. Next = `092_*` (latest is `091_skill_embeddings.sql` — verified). **Apply BY HAND** (paste into Supabase SQL editor / psycopg2 to local `:54322`) — **never `supabase db push`/`db reset`**. Then `bash scripts/regenerate-full-schema.sh` (no `--reset`) and **commit migration + regenerated `full-schema.sql` together**. Never hand-edit `full-schema.sql`.
- **Cloud parity:** migration 092 must be applied to cloud Supabase by hand at deploy (`scripts/pending-cloud-migrations.sh` lists it; joins the 079–086 pending set per MEMORY `project_v32_cloud_migrations`).
- **Red line:** never fork the shared Deep/agent-loop/provider path; provider differences stay at the gateway/adapter boundary. Deep Mode byte-identical when no cross-context template exists.
- **Execute-phase note (from MEMORY, Phase 140 lesson):** `config.json` has `use_worktrees: true`, but Python phases must run **worktrees-off / sequential main-tree** — the `venv` lives only in the main checkout. Flag for the planner/orchestrator; not a plan-content constraint but a real execution landmine.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Run-scope claim on ephemeral template rows | Database / Storage (schema) | — | Additive nullable column on `workspace_files`; NULL = unclaimed sentinel |
| Claim eligibility decision + stamp | API / Backend service (`template_asset_service`) | — | The single resolver seam; a pure helper decides visibility, the resolver stamps |
| Lineage derivation (`'deep'` vs `str(workflow_run_id)`) | API / Backend (tool_dispatcher + harness ctx builders) | — | Off `ToolContext.workflow_run_id` (Deep=None); the harness bag carries it via `run_id`=workflow_runs.id — must be threaded, see Landmine 2 |
| Honest "belongs to another run" relay | API / Backend service | — | Reuses the existing envelope's `error` string; never a raw 404, never foreign bytes |
| Cross-provider render (unchanged) | LLM provider (gateway) | Sandbox render driver | The model only emits the tool call; the resolver is shared backend — provider-agnostic |

## Standard Stack

No new libraries. This phase is (1) one additive SQL migration and (2) an edit to one service + the two harness-ctx build points that feed it. Existing stack in play:

| Component | Role | Verified location |
|-----------|------|-------------------|
| `asyncpg` (`pool.fetchrow` / `pool.execute`) | The resolver's DB access (SELECT + the new claim UPDATE) | `template_asset_service.py:141`, `:161` |
| Postgres / Supabase local `:54322` | Migration 092 apply target (by hand) | `supabase/migrations/` |
| `workspace_files` table | Row store for `template_input` uploads | `full-schema.sql:1457-1473` |
| Existing offline test harness | `mock_asyncpg_pool` recorder, `fake_redis`, supabase mock + TestClient | `backend/tests/conftest.py:455-509` |

## Package Legitimacy Audit

**No external packages are installed by this phase.** It is a pure-backend code + SQL-migration change. The Package Legitimacy Gate (slopcheck / registry verification) is **not applicable** — there is nothing to install. If the planner discovers a need for a helper library (not anticipated), run the gate before recommending it.

## Verification of CONTEXT.md's Named Seams

| Seam | CONTEXT.md claim | Verified? | Notes |
|------|------------------|-----------|-------|
| `template_asset_service.py` Branch 2 | ~136–210, `thread_id+created_by+kind+not-expired`, newest-wins, `pool.fetchrow`, `{bytes,filename,provenance,mime,error}`, two-query expired/never distinction | ✅ EXACT | Branch 2 = `:136-210`. Projection at `:143-148` already selects 10 columns — adding the claim column is trivial. Two-query distinction at `:157-186`. |
| Branch 1 (library `AssetRef`) | `:99-134`, unchanged, no cross-run leak | ✅ | Keys on `asset_id` (Storage path), never `thread_id`. Safe to leave untouched. |
| `_handle_render_template` | `tool_dispatcher.py:1925`; resolver call at `:2051` with `ctx.thread_id` + `ctx.current_user["id"]` | ✅ EXACT | Call at `:2051`. Passes `pool`, `supabase`, `thread_id`, `user_id`, `asset_ref` — does NOT yet pass any lineage. |
| `ToolContext` | `:81-141`; `run_id`, `parent_run_id`, `workflow_run_id` (None on Deep, set on workflow) | ✅ EXACT | `run_id`=`:81`, `parent_run_id`=`:105`, `workflow_run_id`=`:125`. `workflow_run_id` is the Deep-vs-workflow discriminator, available on the tool-call path with no new plumbing. |
| `harness/emitters.py` `_render_template_post` | `:98-166`, re-dispatches the SAME `_handle_render_template` with a workflow `ctx` | ✅ | Re-dispatch at `emitters.py:166`. BUT see Landmine 2 — the `ctx` it receives is a `_ProducerStreamCtx` proxy, not a `ToolContext`. |
| `api/workspace.py` upload | `:158-204`, `kind='template_input'` + `expires_at`, "handler has no run" | ✅ EXACT | Upload at `:149-204`. Born run-less — claim-on-upload is impossible; claim-on-resolve is the only mechanism. |
| `threads.py` + `template_service.py` pin | `pin_templates_for_run` (Phase 100 D-09) — do NOT add claim here | ✅ | `threads.py:1001-1011` (thin delegate), `template_service.py:90-112` (extend-only expiry, no claim). Keep both untouched. |
| `full-schema.sql` `workspace_files` | `:1457`, cols `thread_id/created_by/kind/expires_at`, no run_id/claim | ✅ EXACT | `:1457-1473`. `workspace_files_kind_check` CHECK allows `kind IN ('template_input','agent')` or NULL. |
| Migration numbering | latest `091`, next `092` | ✅ EXACT | Verified `ls supabase/migrations/` — `091_skill_embeddings.sql` is latest. |
| Precedent 076 (`messages.origin`) | additive column, no backfill, filter at read | ✅ (with a divergence — see below) | `messages.origin` used `NOT NULL DEFAULT 'deep'`; the claim column must be **NULLABLE, no default** (see Pitfall 3). |

## Drift & Landmines (the load-bearing findings)

### Landmine 1 — CONTEXT.md's "single write site" is incomplete: THREE resolve callers, TWO reach Branch 2
`resolve_template_source(` has three production call sites (`grep` verified):

| # | Caller | Branch reached | Lineage available on `ctx`? | Action |
|---|--------|----------------|------------------------------|--------|
| 1 | `tool_dispatcher.py:2051` (`_handle_render_template`) — Deep tool calls, workflow **llm_agent** sub-agent tool calls, AND the emitter re-dispatch | Branch 2 (ephemeral) when `asset=None`; Branch 1 when bound | Deep: `ToolContext.workflow_run_id=None`. Sub-agent: inherited (see Landmine below). Emit re-dispatch: **NOT directly** — see Landmine 2. | Thread own-claim into the resolver. |
| 2 | `phase_types.py:1105` (`_exec_llm_emit`, the forced-emit **pre-resolve**) | Branch 1 when the definition binds a `kind=="template"` asset; **Branch 2 (ephemeral)** when it does not (`_emit_bound_asset_ref` → `None` fall-through) | `ctx` = raw harness bag → `ctx.run_id` **IS** `workflow_runs.id` (verified via `_build_phase_tool_context:354`). No `workflow_run_id` attr on the bag. | Thread own-claim = `str(ctx.run_id)` here (always a workflow phase, never `'deep'`). |
| 3 | `workflow_authoring.py:240` (`_resolve_template_placeholders`) | Branch 1 ONLY — passes `thread_id=""`, always an `asset_ref` | N/A (Branch 1 has no claim filter) | No change needed; if the new param is optional-with-safe-default this caller is untouched. |

**Consequence:** On the workflow **emit** path a single ephemeral template is resolved **twice** — once directly at `phase_types.py:1105` (bytes-check + engine-select) and once again inside `_handle_render_template` at `:2051` (the authoritative bytes read that gets rendered). Both must derive the **same** own-claim, or the stamp/filter is inconsistent (the first would read/stamp with one lineage, the second block with another). The planner must decide: filter+stamp at both, or filter+stamp only at the authoritative `:2051` re-resolve and leave `:1105` as an unfiltered bytes-probe (functionally blocks the render at `:2051`, but wastes a forced-emit shot and produces a `render_failed` instead of the cleaner "belongs to another run"). **Recommendation:** filter+stamp at both; the derivation at `:1105` is trivial (`str(ctx.run_id)`).

### Landmine 2 — The harness emit re-dispatch hides `workflow_run_id` behind `_ProducerStreamCtx`
`phase_types.py:1398` builds `_render_ctx = _ProducerStreamCtx(ctx, producer_id)` and passes it to `_render_template_post` → `_handle_render_template(args, _render_ctx)`. `_ProducerStreamCtx` (`:1026-1049`) is a **shallow proxy** that sets `run_id` **locally to the producer id** and delegates every other attribute via `__getattr__` to the inner harness bag. The inner bag has **no `workflow_run_id` attribute** (it carries `run_id`=workflow_runs.id; the ToolContext elsewhere *derives* `workflow_run_id` from that `run_id`).

**Therefore, inside `_handle_render_template` on the emit path:**
- `getattr(ctx, "workflow_run_id", None)` → delegates to the bag → attribute missing → **returns `None`** → derives the `'deep'` sentinel → **a workflow render mis-claims as `'deep'`** → workflow↔Deep is no longer symmetric and the leak the phase exists to close stays open (both claim `'deep'`).
- `_render_ctx.run_id` is the **producer** id, NOT `workflow_runs.id`, so you cannot recover the workflow lineage from `run_id` on this proxy either.

**Fix (planner's call, but the surgical option):** at `_render_ctx` construction (`phase_types.py:1398`), explicitly stamp the workflow lineage onto the proxy from the raw bag's `run_id`, e.g. `_render_ctx.workflow_run_id = getattr(ctx, "run_id", None)`. Because a locally-set attribute short-circuits `__getattr__`, this makes `_handle_render_template`'s `getattr(ctx, "workflow_run_id", None)` return the workflow_runs.id on the emit path — matching the tool-call path's contract. This lives entirely in the harness module; **it does not touch `threads.py`**. A guard test must lock this (a workflow emit render claims `str(workflow_run_id)`, never `'deep'`) — it is the single most likely way this phase ships green-but-broken.

### Sub-agent lineage open item — RESOLVED: inheritance is automatic if the claim keys off `workflow_run_id`
Verified propagation:
- `task_service.py:585-636` builds the sub-agent `ToolContext` with `run_id=sub_run_id` (its own), `parent_run_id=parent_ctx.run_id` (`:605`), and **`workflow_run_id=parent_ctx.workflow_run_id` (`:625`)** — i.e. a sub-agent **inherits** the parent's `workflow_run_id`.
- `phase_types.py:354` sets the parent workflow ctx's `workflow_run_id` from the harness run.

So if the own-claim derivation keys off **`workflow_run_id`** (NOT `run_id`, NOT `parent_run_id`):
- Deep parent + Deep sub-agent → both `workflow_run_id=None` → both claim `'deep'` → sub-agent shares the parent's context. ✅
- Workflow parent + sub-agent → both `workflow_run_id=W` → both claim `str(W)` → sub-agent inherits. ✅

**This satisfies the D-141 discretion intent ("a sub-agent shares that run's context") with zero new plumbing.** Do **not** key the claim off `run_id` (differs between parent and sub-agent) or `parent_run_id` (null on top-level runs). Keying off `workflow_run_id` is the correct and only clean choice — call this out in the plan.

## Architecture Patterns

### System data flow (who resolves the ephemeral template, and with what lineage)

```
                          UPLOAD (born run-less)
   POST /threads/{id}/workspace/files  ── kind='template_input', expires_at ──▶ workspace_files row
   (api/workspace.py:149-204)                                                   (claim = NULL)

   ── RESOLVE PATHS ──────────────────────────────────────────────────────────────────────────

   [A] Deep chat: model emits render_template tool call
        _handle_render_template(args, ToolContext)              ctx.workflow_run_id = None
          └─ resolve_template_source(...)  Branch 2  ───────────▶ own-claim = 'deep'

   [B] Workflow llm_agent phase: sub-agent model emits render_template tool call
        _handle_render_template(args, sub_ctx: ToolContext)      sub_ctx.workflow_run_id = W (inherited :625)
          └─ resolve_template_source(...)  Branch 2  ───────────▶ own-claim = str(W)

   [C] Workflow llm_emit phase (forced emit) — TWO resolves, same template:
        _exec_llm_emit(phase, ctx=harness bag)                   ctx.run_id = workflow_runs.id = W
          ├─ (i)  resolve_template_source(...)  Branch 2  ──────▶ own-claim = str(W)   [phase_types.py:1105]
          └─ _render_template_post → _handle_render_template(args, _ProducerStreamCtx)
                └─ (ii) resolve_template_source(...) Branch 2 ──▶ own-claim MUST = str(W)  [tool_dispatcher.py:2051]
                        ⚠ _ProducerStreamCtx hides workflow_run_id → Landmine 2

   Branch 2 claim rule (all paths):
     SELECT ... WHERE thread_id=$ AND created_by=$ AND kind='template_input'
                     AND (expires_at IS NULL OR expires_at > now())
                     AND (claim IS NULL OR claim = $own_claim)      ◀── NEW predicate
       row found, claim IS NULL  → stamp: UPDATE ... SET claim=$own_claim WHERE id=$ AND claim IS NULL
       row found, claim = own    → return bytes (no stamp)
       no eligible row           → probe for a FOREIGN-claimed non-expired row
                                     → "belongs to another run" (D-141-05)
                                   → else expired / never-uploaded (existing two-query pattern)
```

### Pattern: pure claim-visibility helper (mirror Phase 120's `_apply_origin_filter`)
**What:** A tiny pure function `claim_visible(row_claim: str | None, own_claim: str) -> bool` (name planner's call) returning `row_claim is None or row_claim == own_claim`. Keep the SQL WHERE predicate and this helper as the single source of the eligibility truth so tests can assert the full 5-direction truth table without a live DB (exactly how `test_120_origin_filter.py` proves isolation offline).
**Why:** The 120 precedent's "faithful repro" was a semantic simulation over a row set + a source contract, not a live-DB test (verified `test_120_origin_filter.py:66-92`). A pure helper makes the 141 repro follow the same discipline.

### Anti-Patterns to Avoid
- **Keying the claim off `run_id` or `parent_run_id`.** Breaks Deep→Deep reuse (every Deep turn has a different `run_id`) and sub-agent inheritance. Key off `workflow_run_id` with the `'deep'` sentinel.
- **Copying migration 076's `NOT NULL DEFAULT 'deep'`.** That fills every legacy row → every pre-migration template is instantly "deep-claimed" → a legitimate later workflow run can never resolve a pre-existing thread template. The claim column MUST be nullable with **no default** (NULL = unclaimed, D-141-04).
- **Trusting CONTEXT.md's "single write site"** and only editing `_handle_render_template`. The emit pre-resolve (`phase_types.py:1105`) and the `_ProducerStreamCtx` proxy will silently defeat the fix (Landmines 1–2).
- **Adding the claim/stamp to `pin_templates_for_run` or `threads.py`.** G-5 hot file; also the pin is thread-wide and eager (would claim templates a run never renders — explicitly rejected in D-141-03).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Clean "belongs to another run" error surface | A new exception type / 404 branch | The existing `{bytes,filename,provenance,mime,error}` envelope's `error` string + the existing two-query probe pattern (`:157-186`) | D-141-05 explicitly reuses this shape — no new error plumbing; already run-honesty-safe (never raw 404) |
| Non-blocking claim write | `run_in_threadpool` / supabase-py update | `pool.execute("UPDATE ...")` (asyncpg) | The resolver is already on the asyncpg pool (`pool.fetchrow`); the stamp is a plain non-blocking `execute` (CLAUDE.md D-v2.5-01 satisfied by construction) |
| Deep-vs-workflow discrimination | New context flags / plumbing | `ToolContext.workflow_run_id` (None ⇒ Deep) | Already threaded through Deep, sub-agent (`task_service.py:625`), and workflow ctx (`phase_types.py:354`) |
| Offline isolation repro | Live-DB integration test | Pure `claim_visible` helper + `mock_asyncpg_pool` recorder | Mirrors the 120 discipline; the offline suite has no live DB by design |

## Runtime State Inventory

This is an additive-migration + resolver change (migration trigger applies). No string rename, so most categories are empty — stated explicitly per protocol.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `workspace_files` rows with `kind='template_input'`: existing rows get `claim = NULL` (unclaimed). **No backfill** (D-141-04). Local dev DB `:54322` + cloud Supabase both hold such rows. | Code edit only (nullable column ADD, no data migration). First resolve of any context claims a legacy row. |
| Live service config | None — this phase adds no external-service config. n8n/Datadog/etc. not involved. | None — verified (backend-only + one SQL migration). |
| OS-registered state | None — no Task Scheduler / pm2 / systemd involvement. | None — verified. |
| Secrets / env vars | None — no new secret or env var; `SANDBOX_IMAGE` unchanged. | None — verified. |
| Build artifacts | The migration must reach two DBs by hand (local `:54322` + cloud Supabase) AND regenerate `supabase/full-schema.sql` (the single-file deploy artifact — do not hand-edit). | (1) Apply 092 to local via SQL editor / psycopg2; (2) `bash scripts/regenerate-full-schema.sh` (no `--reset`); (3) commit migration + regenerated schema together; (4) cloud apply is a deploy-time by-hand step (`pending-cloud-migrations.sh`). |

**The canonical question — "after every file is updated, what runtime systems still hold old state?"** Answer: only the DB schema itself. The nullable column + no-backfill design means no live data is stale — legacy rows are simply unclaimed and get claimed on first resolve. The one non-code half is the by-hand migration apply to local and cloud Postgres.

## Common Pitfalls

### Pitfall 1: `workflow_run_id` invisible on the harness emit path (green-but-broken)
**What goes wrong:** `getattr(ctx, "workflow_run_id", None)` returns `None` inside `_handle_render_template` when reached via `_ProducerStreamCtx`, so a workflow emit render claims `'deep'` and the workflow↔Deep block silently fails.
**Why:** `_ProducerStreamCtx` overrides `run_id` to the producer id and delegates all else to a harness bag that has no `workflow_run_id` attr (Landmine 2).
**Avoid:** Stamp `workflow_run_id` onto `_render_ctx` at construction from the raw bag's `run_id`. Lock with a guard test asserting a workflow emit render's claim is `str(workflow_run_id)`, not `'deep'`.
**Warning sign:** The repro test for workflow→Deep passes but the workflow-emit-phase variant (not the llm_agent tool-call variant) is untested — add the emit-phase direction explicitly.

### Pitfall 2: Claim-stamp race between two concurrent same-thread runs
**What goes wrong:** Two runs (e.g. a Deep turn and a workflow phase) resolve the same NULL-claim row nearly simultaneously; both read NULL, both stamp — last write wins, one context's block is bypassed.
**Why:** `SELECT ... claim IS NULL` then `UPDATE ... SET claim` is not atomic if split.
**Avoid:** Make the stamp conditional and check the result: `UPDATE workspace_files SET claim=$own WHERE id=$id AND claim IS NULL` and inspect the rowcount; on `UPDATE 0`, re-SELECT to see whether the row is now own-claim (proceed) or foreign (→ "belongs to another run"). Low real-world risk (same user, same thread, sub-second overlap is rare) but cheap to make correct.
**Warning sign:** Flaky repro under parallel-thread execution.

### Pitfall 3: NOT NULL DEFAULT on the claim column (copy-paste from 076)
**What goes wrong:** Every pre-migration template becomes deep-claimed (or workflow-claimed), permanently blocking the other context — a regression that fails D-141-01's "preserve reuse."
**Why:** `messages.origin` legitimately used `NOT NULL DEFAULT 'deep'` because every message is written by a known mode at insert; a `template_input` row is born run-less and must stay unclaimed until first resolve.
**Avoid:** `ADD COLUMN IF NOT EXISTS <claim> text` — nullable, **no** default, **no** backfill (D-141-04). Idempotent re-apply (`IF NOT EXISTS`), inherits existing RLS (no new policy — mirror 076/050).
**Warning sign:** The migration file contains `NOT NULL` or `DEFAULT` on the new column.

### Pitfall 4: "newest-wins" now means "newest ELIGIBLE-wins"
**What goes wrong:** With the claim predicate in the WHERE + `ORDER BY created_at DESC LIMIT 1`, a newest **foreign-claimed** upload is skipped and an older own/unclaimed row resolves — a subtle change from pure newest-wins.
**Why:** The claim filter narrows the candidate set before the ORDER BY.
**Avoid:** This is the *desired* behavior (you get your own template, not the foreign one). But the "belongs to another run" message (D-141-05) should only fire when there is **no** eligible row AND a foreign non-expired row exists — order the probes: eligible → foreign-claimed → expired → never-uploaded. Document the semantics in the resolver.
**Warning sign:** A test with mixed-claim rows on one thread asserts the wrong precedence.

## Code Examples

Existing resolver Branch 2 SELECT (the exact WHERE the claim predicate joins) — `template_asset_service.py:141-155`:
```python
# Source: backend/app/services/template_asset_service.py:141 (VERIFIED, read this session)
row = await pool.fetchrow(
    """
    SELECT id, thread_id, path, mime_type, content_inline,
           content_storage_path, created_by, created_at, kind, expires_at
    FROM workspace_files
    WHERE thread_id = $1
      AND created_by = $2
      AND kind = 'template_input'
      AND (expires_at IS NULL OR expires_at > now())
    ORDER BY created_at DESC
    LIMIT 1
    """,
    thread_id, user_id,
)
# 141 adds: `, claim` to the projection; `AND (claim IS NULL OR claim = $3)` to the WHERE;
#           a conditional stamp UPDATE when the returned row's claim IS NULL.
```

Sub-agent lineage inheritance (why keying off `workflow_run_id` gives free inheritance) — `task_service.py:625`:
```python
# Source: backend/app/services/task_service.py:625 (VERIFIED)
workflow_run_id=parent_ctx.workflow_run_id,   # sub-agent inherits the parent's lineage
```

Harness emit proxy that hides the lineage (Landmine 2) — `phase_types.py:1026-1049` + `:1398`:
```python
# Source: backend/app/services/harness/phase_types.py:1043 (VERIFIED)
class _ProducerStreamCtx:
    def __init__(self, inner, run_id) -> None:
        self._inner = inner
        self.run_id = run_id            # overrides run_id -> producer id
    def __getattr__(self, name):        # everything else -> inner harness bag
        return getattr(self._inner, name)   # inner bag has NO workflow_run_id attr
# _render_ctx = _ProducerStreamCtx(ctx, producer_id)   # :1398
# 141 must add: _render_ctx.workflow_run_id = getattr(ctx, "run_id", None)  # = workflow_runs.id
```

## State of the Art

| Old Approach | Current Approach | When | Impact |
|--------------|------------------|------|--------|
| Ephemeral resolver scoped on `thread_id + created_by` only (Phase 100/101) | + run-lineage claim (`workflow_run_id` OR `'deep'`), claim-on-resolve (Phase 141) | this phase | Blocks cross-context leak while preserving same-mode reuse |
| Phase 120 `messages.origin` `NOT NULL DEFAULT 'deep'` isolation half | Phase 141 nullable claim, no default, no backfill | this phase | Same "additive column, filter at read" family; nullability inverted (see Pitfall 3) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The workflow **emit** path (`_exec_llm_emit`) does reach Branch 2 (ephemeral) in practice when a definition has no bound `kind=="template"` asset — making the `_ProducerStreamCtx` lineage fix load-bearing. | Landmines 1–2 | LOW: verified in code (`_emit_bound_asset_ref` returns `None` → `resolve_template_source(asset_ref=None)` → Branch 2). If in practice every render-emitting workflow binds a library asset, Branch 1 (unchanged) covers it and the emit-path fix is belt-and-suspenders — still correct, just less exercised. Recommend the plan include the emit-phase repro direction regardless. |
| A2 | Phase 120's faithful repro used offline semantic simulation, not a live DB — so the 141 offline repro is acceptable to the D-141-06 bar. | Validation Architecture | LOW: verified by reading `test_120_origin_filter.py`. If the planner/verifier wants a truly stateful DB repro, an optional `backend/tests/integration/` test against `:54322` can supplement (asyncpg + real INSERT/stamp/re-select). |

## Open Questions (RESOLVED)

1. **Stamp at one resolve site or both on the emit path?**
   - What we know: the emit path resolves the ephemeral template twice (`phase_types.py:1105` + `tool_dispatcher.py:2051`); the second is authoritative for bytes.
   - What's unclear: whether to filter+stamp at both or only the authoritative second resolve.
   - Recommendation: filter+stamp at both (derivation at `:1105` is trivially `str(ctx.run_id)`); it yields the cleaner "belongs to another run" state and avoids a wasted forced-emit shot. Planner's discretion per D-141-03.
   - **RESOLVED:** filter+stamp at BOTH. Plan 141-02 wires the own-claim at `tool_dispatcher.py:2051` (Task 2, via `own_claim_for_ctx`) AND at the direct emit pre-resolve `phase_types.py:1105` (Task 3, via `str(ctx.run_id)`), plus the `_ProducerStreamCtx.workflow_run_id` stamp at `:1398` so the authoritative re-resolve derives the SAME `str(W)` (Landmine 1 & 2).

2. **Exact claim column type/name.**
   - What we know: contract is "holds `workflow_run_id` OR the `'deep'` sentinel"; a plain uuid FK cannot hold the sentinel.
   - Recommendation: a plain nullable `text` column (e.g. `run_claim`), no FK, no default. Simplest thing that holds both value shapes (D-141-02). Optionally a CHECK is unnecessary (server-set only).
   - **RESOLVED:** Plan 141-01 Task 1 authors a nullable `text run_claim` column on `workspace_files` (migration 092) — no FK, no default, no CHECK, no backfill (server-set value only).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Supabase Postgres `:54322` | Applying migration 092 by hand (psycopg2 / SQL editor) | ✓ (project standard; MEMORY confirms psycopg2 :54322 is the evidence tool) | Postgres 15 (Supabase local) | — (blocking for the migration apply step) |
| `scripts/regenerate-full-schema.sh` | Regenerating `full-schema.sql` after apply (no `--reset`) | ✓ (referenced in CLAUDE.md + used by 076) | — | — |
| Sandbox render image `agentic-rag-sandbox:101.1` | The cross-provider render SMOKE (D-141-07) — actually rendering an in-scope template | ✓ if `SANDBOX_IMAGE` set + built (CLAUDE.md) | tag `101.1` | Smoke is manual UAT; if sandbox unavailable, the automated resolver tests still prove the claim logic |
| At least one live LLM provider | The manual cross-provider render smoke | Operator-driven | — | Any one representative model suffices (D-141-07); note MEMORY: OpenAI embed quota 429 blocked some 140 UAT — the render smoke does not need embeddings, only a chat model that emits `render_template` |

**Missing dependencies with no fallback:** none (all standard project infra).

## Validation Architecture

> `workflow.nyquist_validation: true` (verified in `.planning/config.json`). This section drives VALIDATION.md generation.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (+ pytest-asyncio) — the backend suite |
| Config file | `backend/pytest.ini` / `backend/pyproject.toml` (existing; the suite is offline-friendly by design) |
| Quick run command | `cd backend && venv/Scripts/python -m pytest tests/test_141_run_scope.py -x -q` (new file) |
| Full suite command | `cd backend && venv/Scripts/python -m pytest -q` |
| Key fixtures (existing, reuse) | `mock_asyncpg_pool` (recorder: `set_fetchrow_result` / `set_fetchrow_results` / `set_fetch_results` / `set_execute_result` / `.calls`) — `conftest.py:455-509`; `fake_redis`; supabase mock + TestClient |

### How a run's lineage / DB rows are faked in tests (verified fixtures)
- **Fake a lineage:** construct a `ToolContext(...)` with `workflow_run_id=None` (Deep) or `workflow_run_id=<uuid W>` (workflow), OR call `resolve_template_source` directly with the new own-claim kwarg. No live DB needed. For the emit-path variant, wrap a `SimpleNamespace(run_id=W, ...)` in `_ProducerStreamCtx` and assert `workflow_run_id` is stamped.
- **Seed `workspace_files` rows:** `mock_asyncpg_pool.set_fetchrow_result({... "claim": None | "deep" | str(W) ...})` (single) or `set_fetchrow_results([...])` (successive: the claim-filtered SELECT, then any probe SELECT). The recorder returns canned dicts — it does NOT evaluate the WHERE, so pair it with the pure `claim_visible` helper for the truth-table proof.
- **Assert the stamp:** the claim UPDATE lands in `mock_asyncpg_pool.calls` as `(sql, args)`; assert the SQL contains the conditional `SET <claim> = $... WHERE ... AND <claim> IS NULL` and the args carry the own-claim, and that NO stamp fires for an already-own-claim row.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File |
|--------|----------|-----------|-------------------|------|
| COLL-02 | `claim_visible(None, own)` → True (unclaimed → resolvable+stamp) | unit | `pytest tests/test_141_run_scope.py::test_unclaimed_visible -x` | ❌ Wave 0 |
| COLL-02 | Deep→Deep reuse: `claim_visible('deep','deep')` → True | unit | `...::test_deep_to_deep_reuse -x` | ❌ Wave 0 |
| COLL-02 | Same-workflow across phases: `claim_visible(str(W), str(W))` → True | unit | `...::test_same_workflow_run_reuse -x` | ❌ Wave 0 |
| COLL-02 | **workflow→Deep blocked**: `claim_visible(str(W),'deep')` → False | unit | `...::test_workflow_to_deep_blocked -x` | ❌ Wave 0 |
| COLL-02 | **Deep→workflow blocked** (the `'deep'` sentinel earns its keep): `claim_visible('deep', str(W))` → False | unit | `...::test_deep_to_workflow_blocked -x` | ❌ Wave 0 |
| COLL-02 | **W1→W2 blocked**: `claim_visible(str(W1), str(W2))` → False | unit | `...::test_cross_workflow_run_blocked -x` | ❌ Wave 0 |
| COLL-02 | Resolver returns bytes + stamps for a NULL-claim row (own-claim recorded in `pool.calls`) | integration (offline) | `...::test_resolver_stamps_unclaimed -x` | ❌ Wave 0 |
| COLL-02 | Resolver returns the "belongs to another run" error (D-141-05), NOT bytes, for a foreign-claimed non-expired row | integration (offline) | `...::test_resolver_foreign_claim_honest_error -x` | ❌ Wave 0 |
| COLL-02 | Emit-path lineage: `_ProducerStreamCtx` yields `workflow_run_id == str(W)` → a workflow emit render claims `str(W)`, never `'deep'` (Landmine 2 guard) | unit | `...::test_emit_ctx_carries_workflow_lineage -x` | ❌ Wave 0 |
| COLL-02 (SC#2) | Happy path unchanged: an own-upload render + Branch 1 (library asset) render resolve byte-identically (no regression) | integration (offline) | `...::test_in_scope_render_unchanged -x` | ❌ Wave 0 |
| COLL-02 | Migration 092 static contract: nullable claim column, NO `NOT NULL`, NO default, `IF NOT EXISTS`, no `db push`/`db reset` (mirror `test_existing_rows_valid`, `test_workspace_template.py:400`) | static | `...::test_migration_092_additive_nullable -x` | ❌ Wave 0 |

### Faithful fail-before / pass-after structure (D-141-06)
- **Fail-before:** the assertions above reference a `claim_visible` helper + a claim-aware WHERE that do not exist yet → the tests import a missing symbol / assert absent behavior → RED by construction (the 098/099/100 cross-plan TDD convention: import the not-yet-created symbol *inside* the test body so the pre-fix state is a clean RED, optionally `xfail(strict=False)` until the implementing plan lands, then drop the marker). The foreign-claim resolver test additionally encodes the *current* wrong behavior explicitly: pre-fix, a foreign-claimed row (no claim dimension in the WHERE) is returned as bytes → the "returns error not bytes" assertion fails → proves the leak exists today.
- **Pass-after:** helper + WHERE predicate + stamp land → all directions green.
- **Three blocked directions covered:** workflow→Deep, Deep→workflow, W1→W2. **Two allowed directions covered:** Deep→Deep reuse, same-workflow-run across phases. All five are in the map above.

### Sampling Rate
- **Per task commit:** `pytest tests/test_141_run_scope.py -x -q`
- **Per wave merge:** `pytest tests/test_141_run_scope.py tests/test_workspace_template.py tests/unit/test_citation_policy.py tests/unit/test_llm_emit_executor.py -q` (the resolver's blast-radius neighbors)
- **Phase gate:** full `pytest -q` green before `/gsd:verify-work`

### Cross-provider SMOKE (D-141-07) — MANUAL UAT (one row, not the SC#10 4-axis)
| Axis | Coverage |
|------|----------|
| Cross-provider | **ONE** representative model (e.g. one of OpenAI / Anthropic / Google) uploads a `.docx` template in a Deep turn and renders it successfully via `render_template` → deliverable produced, in-scope, byte-correct. Proves the provider-agnostic resolver did not regress the render happy path (SC#2). |
| The full 4-axis matrix | **NOT required** (141 is not on the ROADMAP SC#10 headline list; the model only emits the tool call — the resolver is shared backend). |
| Where authored | VALIDATION.md "Manual-Only Verifications" (mirror `100-VALIDATION.md` G-4 rows). |

### Wave 0 Gaps
- [ ] `backend/tests/test_141_run_scope.py` — the new resolver + helper + migration-contract test file (covers COLL-02 above).
- [ ] Migration `supabase/migrations/092_*.sql` — authored in an implementing plan; applied by hand + `full-schema.sql` regenerated by an operator/blocking task (mirror the 120 split: one plan authors, an operator plan applies).
- [ ] No new framework install — pytest + pytest-asyncio already present.

## Security Domain

> `security_enforcement` key is absent in `config.json` → treated as enabled. This phase is an access-control isolation change, so the domain is directly relevant.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Unchanged; upload/resolve already behind `get_current_user`. |
| V3 Session Management | no | N/A. |
| V4 Access Control | **yes** | The claim is a **run-context** authorization boundary layered on the existing `created_by` (user) + `thread_id` scope. Resolver returns a relay string, never a raw 404, never foreign bytes (existing D-05 posture, preserved). Deny-by-default: a foreign-claimed row is invisible. |
| V5 Input Validation | partial | The claim value is **server-derived** (`workflow_run_id` or `'deep'`), never user/model input — no injection surface. `out_filename`/OOXML validation unchanged. |
| V6 Cryptography | no | N/A. |

### Known Threat Patterns for this change
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-context template read (workflow↔Deep, W1↔W2) — the phase's raison d'être | Information Disclosure | Claim predicate in the Branch-2 WHERE; symmetric via the `'deep'` sentinel |
| Server-set claim tampering (model tries to influence its own lineage) | Tampering | Claim is derived from `ToolContext.workflow_run_id` (server substrate), never from tool args — no model-controlled path |
| Claim-stamp race bypass | Elevation / Info Disclosure | Conditional `UPDATE ... WHERE claim IS NULL` + rowcount re-check (Pitfall 2) |
| Regression that widens scope (drops `created_by`/`thread_id`) | Info Disclosure | V4 backstop test asserts both existing scopes remain in the WHERE (mirror `test_120_origin_filter.py` scope-preservation test) |
| Foreign bytes leaked via the honest error | Info Disclosure | D-141-05 message names the condition only ("belongs to a different run"), never the other run's id, filename, or bytes |

## Sources

### Primary (HIGH confidence) — all read this session
- `backend/app/services/template_asset_service.py:1-210` — resolver, both branches, envelope, two-query distinction.
- `backend/app/services/tool_dispatcher.py:77-142` (ToolContext), `:1925-2074` (`_handle_render_template` + resolve call).
- `backend/app/services/harness/emitters.py:82-188` (`_render_template_post` re-dispatch).
- `backend/app/services/harness/phase_types.py:285-360` (`_build_phase_tool_context`), `:726-743` (`_emit_bound_asset_ref`), `:1026-1049` (`_ProducerStreamCtx`), `:1100-1124` + `:1360-1401` (`_exec_llm_emit` resolve + render dispatch).
- `backend/app/services/task_service.py:560-636` (sub-agent ctx propagation, `workflow_run_id` inheritance).
- `backend/app/services/template_service.py:90-112` (`pin_templates_for_run`), `backend/app/api/threads.py:995-1011` (pin call site), `backend/app/api/workspace.py:149-204` (run-less upload).
- `supabase/full-schema.sql:1457-1487` (`workspace_files`), `supabase/migrations/076_messages_origin.sql` (precedent), `ls supabase/migrations/` (latest = 091).
- `backend/tests/conftest.py:455-509` (`mock_asyncpg_pool`), `backend/tests/test_workspace_template.py` (fixture usage + migration static-contract pattern), `backend/tests/test_120_origin_filter.py` (the 120 faithful-repro discipline), `backend/tests/test_harness_templates.py` (harness ctx fixture shape).
- `.planning/config.json` (nyquist_validation true; security_enforcement absent → enabled; use_worktrees true).
- `.planning/phases/141-.../141-CONTEXT.md`, `.planning/REQUIREMENTS.md` (COLL-02).

### Secondary (MEDIUM)
- MEMORY: `project_140_executed` (worktrees-off for Python venv, psycopg2 apply), `project_v32_cloud_migrations` (092 to cloud by hand), `feedback_apply_migrations_via_sql_editor`, `feedback_regen_full_schema_no_reset`.

### Tertiary (LOW)
- None — no WebSearch needed; this is a closed-world codebase change.

## Metadata

**Confidence breakdown:**
- Seam verification: HIGH — every CONTEXT.md file:line read and confirmed against live code.
- Landmines (3 callers, `_ProducerStreamCtx`, sub-agent inheritance): HIGH — traced end-to-end in source.
- Validation Architecture: HIGH — modeled on the verified 120 offline-repro pattern + confirmed `mock_asyncpg_pool` API.
- Schema/migration mechanics: HIGH — confirmed against 076 + CLAUDE.md + full-schema.sql.

**Research date:** 2026-07-07
**Valid until:** 2026-08-06 (stable; the seams are settled since Phase 101.1/120 — re-verify only if `tool_dispatcher.py`, `phase_types.py`, or `template_asset_service.py` change before planning)
