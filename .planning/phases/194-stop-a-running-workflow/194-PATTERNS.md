# Phase 194: Stop a Running Workflow - Pattern Map

**Mapped:** 2026-08-16
**Measured at HEAD:** `0dcb4a8e`, branch `develop` (RESEARCH was written at `05f664a0`; every figure below
was **re-derived at `0dcb4a8e`**, not inherited — all matched)
**Files analyzed:** 13 (7 modify · 3 create · 3 test-extend) + 1 doc
**Analogs found:** 13 / 13 with a named analog · 12 exact · 1 partial · **0 with no analog**

> **How to read this file.** Every excerpt below was read from source at HEAD in this session. Where
> RESEARCH named a line number, it was verified; where it was off, the corrected number is given
> **beside** the original, never over it — this project's standing habit. Two RESEARCH pointers drifted
> by 1-2 lines (both noted inline) and nothing else moved.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `backend/app/api/runs.py` (mod) | route/controller | request-response | **`continue_run`'s fallback, same file `:722-756`** + `ask_user_response`'s `:536-584`; forward-resolution from `api/workflows.py:1483-1493` | **exact ×2, in the same module** |
| `backend/app/services/run_lifecycle.py` (mod) | service | event-driven (lifecycle) | **`delete_workflow_cascade`'s composition, `api/workflows.py:1494-1518`** (the co-write already written, in another file); discipline analog `finalize_run_terminal` `:117-155` (same file) | **exact** |
| `backend/app/db/workflows.py` (mod: new phase writer) | data-access/model | CRUD (single UPDATE) | **`record_phase_not_sent` `:1261-1290`** (the newest phase writer, Phase 189, the sibling of the migration this phase copies) | **exact** |
| `backend/app/db/workflows.py` (mod: `finish_run` docstring) | data-access | docs | The correct-beside-not-over habit; `WorkspacePanel.tsx:166-181` (`⚠ CORRECTED (CR-03)`) is the shipped shape | exact |
| `backend/app/services/harness_engine.py` (mod) | service | event-driven | **The `fail_run` arm `:1646-1651`** — `fail_phase(pool, phase_id, …)` then `finish_run(…)`, three lines below the cancel arm being edited | **exact** |
| `supabase/migrations/119_*.sql` (new) | migration | DDL | **`115_workflow_phases_recorded_not_sent.sql`** (whole file) | **exact** |
| `backend/tests/test_migration_119.py` (new) | test | live-DB gate | **`backend/tests/test_migration_115.py`** (whole file, 300 L) | **exact** |
| `backend/tests/test_062_cancel_run.py` (extend) | test | unit | **itself** — `:141-174` is the zombie-arm case to extend | exact |
| `frontend/src/components/panel/WorkspacePanel.tsx` (mod) | component | request-response (action) | **`RunSeam` `:147-248` / `RunSoul` `:85-145`** — the two shipped additive siblings **in this file**; control analog `ActiveRunsTray.tsx:127-133` | **exact** |
| `frontend/src/components/panel/__tests__/WorkspacePanel.test.tsx` (extend) | test | unit | **itself** — ⚠ its `vi.mock` is an **explicit 8-key object with no `useStreamActions`** (see Pattern 6) | exact |
| `frontend/src/components/chat/MessageItem.tsx` (mod) | component | event-driven (store slice) | **its own `useWorkflowLockForThread(message.thread_id ?? null)` at `:303`** — a chat component already reading a harness-demux slice | **exact** |
| `frontend/src/components/chat/RunCard.tsx` (mod) | component | render/vocabulary | **itself** — `statusGlyph` `:530-536` / `statusWord` `:538-550` | exact |
| `CLAUDE.md` (mod) | docs | — | the `backend/app/db/workflows.py` and `.../publish_service.py` ledger rows | **exact** |

**Descoped / excluded — do NOT map or touch** (D-16, D-13, deferred list): `frontend/src/pages/WorkflowsPage.tsx`,
anything under `frontend/src/components/workflows/library/`, `frontend/src/lib/toolMeta.ts`'s copy, and
any behaviour change to the Deep-run cancel path.

---

## ⚠ THE LANDMINE — map this before any Stop is wired

**`WorkflowLock.runId` carries TWO id types.** Its JSDoc asserts only one.

```ts
// Source: frontend/src/stores/streamsStore.ts:51-59 (verified at HEAD)
export interface WorkflowLock {
  /** The workflow_runs.id (active_workflow_run_id) that owns the lock. */
  runId: string
  mode: "harness"
  capPaused: boolean
  continuesRemaining: number
}
```

**All five write sites, re-measured at HEAD** (RESEARCH's `:1839` and `:3032` are the `setWorkflowLockForThread(` call lines; the **assignments** are one/two lines lower — corrected beside):

| # | Write site (exact assignment line) | Value assigned | Actual id type |
|---|---|---|---|
| 1 | `StreamsProvider.tsx:965` — `onCapPaused` SSE | `info.runId` | **inherits whatever the SSE carried** |
| 2 | `StreamsProvider.tsx:1840` (call at `:1839`) — mount reconcile | `wf.active_workflow_run_id` | **`workflow_runs.id`** |
| 3 | `StreamsProvider.tsx:1983` — kickoff seed | `run_id` from the kickoff POST body | **`runs.run_id` (producer)** |
| 4 | `StreamsProvider.tsx:3034` (call at `:3032`) — Continue re-subscribe | `producerRunId` | **`runs.run_id` (producer)** |
| 5 | `ChatArea.tsx:176` — banner path | `state.active_workflow_run_id` | **`workflow_runs.id`** |

**The confirming measurement nobody has written down yet — and it is the sharpest evidence in this file.**
`workflowLock.runId` has **exactly ONE production read in the whole frontend**:

```
grep -rn "workflowLock\.runId\|workflowLock?\.runId\|lock\.runId" frontend/src --include=*.ts --include=*.tsx
→ frontend/src/components/chat/MessageItem.tsx:596   if (!workflowLock.runId) return
→ frontend/src/components/chat/MessageItem.tsx:599   const res = await continueRun(workflowLock.runId)
```

**That single read calls `/continue` — the one route that already has the dual-id fallback.** The lock's
id works today *because the server tolerates both*. `DELETE /runs/{id}` does not, and:

```ts
// Source: frontend/src/lib/api.ts:1259-1269 (verified at HEAD) — the deliberate 404 swallow
export async function cancelRun(runId: string, signal?: AbortSignal): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/runs/${runId}`, { method: "DELETE", headers, signal })
  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to cancel run (status ${res.status})`)
  }
}
```

⇒ **A Stop wired to `workflowLock.runId` silently succeeds while doing nothing, roughly half the time.**

**And `cancelRun` has exactly TWO production call sites, both inside the correct resolver:**

```
grep -rn "cancelRun(" frontend/src --include=*.ts --include=*.tsx | grep -v __tests__
→ lib/api.ts:304    (a comment)
→ lib/api.ts:1259   (the definition)
→ providers/StreamsProvider.tsx:2389   ← stopStream
→ providers/StreamsProvider.tsx:2411   ← stopThread
```

**Every new mount must route through `stopThread(threadId)` / `stopStream()` and add NO third call site.**

The project already recorded this once and it was not carried forward — `WorkspacePanel.tsx:160-164`:

> *"THE ID IS RESOLVED FROM THE THREAD FRAME, and deliberately NOT from the panel's workflow lock. The
> lock's id field is documented as the anchor but is overwritten with a PRODUCER run id at kickoff and
> again on a Continue re-subscribe (StreamsProvider) … **Both ids are bare uuids, so a swap typechecks
> and then resolves nothing.**"*

---

## ⚠ THE ICON VOCABULARY — three marks ship for one concept

| Mark | Where it ships | Status |
|---|---|---|
| `■` | `RunCard.tsx:534` — `statusGlyph('cancelled')`, the cancelled **state** | shipped; D-14 says it is the starting point |
| lucide `<Square className="… fill-current" />` | `MessageInput.tsx:420` (`data-testid="composer-stop"`) and `ActiveRunsTray.tsx:132` — the Stop **control** | shipped ×2, byte-consistent with each other |
| `⏹` | the validated sketch `references/workflow-run-surface.md:25,:135,:227` | designed, **never built** |

**Neither `■` nor `⏹` appears in `icon-convention.md` §4's canvas glyph table** (§4's rows are `⛨ 🔒 ⤳ ＋ ✕ ↶ ↷ ◆` + the phase-type map). §4's rule, verbatim:

> **Net-new marks must be FLAGGED as proposals** … *"a sketch that invents a glyph teaches the wrong
> vocabulary to whoever builds from it."*

**The option that needs no new vocabulary at all** — §4's own *"The word-badge carries NO glyph"* section,
whose shipped exemplar is:

```tsx
// Source: frontend/src/components/workflows/PhaseNode.tsx:222-227 (verified at HEAD)
const waitsForYou: BadgeSlot = {
  testId: "canvas-waits-for-you",
  tone: "primary",
  label: "Waits for you",
  dataAttr: { "data-waits-for-you": "true" },
}
```

with the rule stated at `PhaseNode.tsx:244`: *"The WORD carries the meaning either way (WCAG 1.4.1) — tone
is decoration — and `icon-convention.md` §4 is explicit that a word-badge carries NO glyph."*

⚠ **The sketch's cancel COPY contradicts D-13.** `workflow-run-surface.md:25` reads
`⏹ Run cancelled — no deliverable produced · partial work discarded`, while D-13 explicitly rejects
"collapsing to a bare `cancelled` that hides partial work." Amend under D-14 and record the amendment
**beside** the sketch's original.

---

## Pattern Assignments

### 1. `backend/app/api/runs.py` (route, request-response) — the dual-id fallback

**Analog: `continue_run`, SAME FILE, `:722-756`.** Mirror **this one**, not `ask_user_response` — three
reasons, all structural: (a) it is the closer shape (it also needs a *forward* value out of the
`workflow_runs` row, `continues_used`, exactly as `DELETE` needs the producer id); (b) its own comment
names the id-type cause verbatim; (c) `ask_user_response` synthesizes `status: None` and then never reads
it — `DELETE` **does** read `row["status"]` (it is Step 2's terminal check), so a `None` there is a real
branch, not parity decoration.

**The shipped fallback — copy this shape, do not invent one:**
```python
# Source: backend/app/api/runs.py:722-756 (verified at HEAD 0dcb4a8e)
    if not row:
        # Facet C (092-07) Continue-404 repair: after a page reload
        # workflowLock.runId carries the WORKFLOW_RUN id (StreamsProvider seeds it
        # from wf.active_workflow_run_id on reconcile), which is NOT a `runs` row →
        # the SELECT above 404s before the harness branch ever runs. ...
        wf_self_resp = await aexec(
            supabase.table("workflow_runs")
            .select("id, thread_id, continues_used")
            .eq("id", str(run_id))
            .eq("user_id", current_user["id"])        # owner-scoped — no existence leak
            .maybe_single()
        )
        wf_self = wf_self_resp.data if wf_self_resp is not None else None
        if wf_self:
            anchor_resp = await aexec(
                supabase.table("threads")
                .select("active_workflow_run_id")
                .eq("id", wf_self["thread_id"])
                .eq("user_id", current_user["id"])    # thread-anchor confirm
                .maybe_single()
            )
            _anchor = (anchor_resp.data if anchor_resp is not None else None) or {}
            if str(_anchor.get("active_workflow_run_id")) == str(run_id):
                row = {
                    "run_id": str(run_id),
                    "status": None,
                    "thread_id": wf_self["thread_id"],
                    "continues_used": wf_self.get("continues_used") or 0,
                }

    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
```

**The second analog, for the "BRANCH, never replace" discipline** — `ask_user_response`'s own comment
(`:549-552`) states the rule the `DELETE` route must inherit:

> *"**BRANCH, never replace (D-08)**: the Step-1 `runs` SELECT above stays FIRST and unchanged — Deep's
> runs-keyed … path is byte-identical and still returns 200; this fallback only engages AFTER that
> SELECT misses."*

**The Step-1 SELECT the fallback must sit BELOW, unchanged** (`api/runs.py:1171-1183`):
```python
    row_resp = await aexec(
        supabase.table("runs")
        .select("run_id, status, thread_id")
        .eq("run_id", str(run_id))
        .eq("user_id", current_user["id"])
        .maybe_single()
    )
    row = row_resp.data if row_resp is not None else None
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
```

**⚠ THE HALF THE TWO SHIPPED FALLBACKS DO NOT HAVE — the FORWARD resolution.** `_cancel_run_internals`
keys `RUN_TASKS` and `finalize_run_terminal` on the **producer** `runs.run_id`. Handing it a
`workflow_runs.id` yields: `RUN_TASKS.get(wf_id)` → miss → Step 3b → `finalize_run_terminal` updates
**zero** `runs` rows → the live producer is never cancelled, and the API returns 204. Same silent
success, moved server-side.

**The forward-resolution analog — the delete cascade's LEFT JOIN, with its rule in its own comment:**
```python
# Source: backend/app/api/workflows.py:1483-1493 (verified at HEAD)
# RESEARCH cited :1486-1494 — the SQL starts at :1484; corrected beside.
    inflight = await pool.fetch(
        "SELECT wr.id AS wf_id, wr.thread_id, "
        "r.run_id AS producer_id, r.status AS producer_status "
        "FROM workflow_runs wr "
        "JOIN workflow_definitions wd ON wd.id = wr.definition_id "
        "LEFT JOIN runs r ON r.thread_id = wr.thread_id AND r.status = 'streaming' "
        "WHERE wd.slug = $1 AND wd.created_by = $2 "
        "AND wr.status IN ('active', 'paused', 'cap_paused')",
        slug, user_id,
    )
```
with `api/workflows.py:1478-1482` stating the rule:
> *"a live kickoff-started run's producer task is registered in RUN_TASKS under the **PRODUCER
> `runs.run_id`** (threads.py:2011), **NOT the `workflow_runs.id`**. Resolve that producer identity via a
> LEFT JOIN to the live `runs` row (status='streaming') and cancel through IT."*

**Late-import discipline** (the pattern every caller of the shared writer uses — `api/runs.py:1194`,
`api/workflows.py:1495-1496`, `admin.py:479`):
```python
    from app.services.run_lifecycle import _cancel_run_internals  # noqa: PLC0415
```

**Security note (V4 — the highest-risk category here).** The workflow cluster reads through a
service-role pool that **bypasses RLS**, so `.eq("user_id", …)` + the anchor confirm **are** the access
boundary. `404, never 403` is the shipped collapse in both analogs.

---

### 2. `backend/app/services/run_lifecycle.py` (service, lifecycle) — Step 3b's workflow co-write

**Analog: `delete_workflow_cascade`, `api/workflows.py:1494-1518`. The composition this phase needs is
already written — in the wrong file, where only one of three callers gets it.**

```python
# Source: backend/app/api/workflows.py:1494-1518 (verified at HEAD)
    if inflight:
        from app.services.ask_user_service import publish_cancel_sentinel  # noqa: PLC0415
        from app.services.run_lifecycle import _cancel_run_internals  # noqa: PLC0415

        redis = get_redis()
        for r in inflight:
            # (1) Cancel the LIVE producer task — RUN_TASKS is keyed by the producer
            # runs.run_id, never the workflow_runs id (CR-01). ...
            if r["producer_id"] is not None:
                await _cancel_run_internals(
                    run_id=r["producer_id"], status=r["producer_status"],
                    thread_id=str(r["thread_id"]) if r["thread_id"] else None,
                    redis=redis, supabase=supabase,
                )
            # (2) Wake any paused ask_user harness prompt ... (best-effort, never raises).
            await publish_cancel_sentinel(redis, r["wf_id"])
            # (3) Durably terminalize the workflow_runs row BEFORE the delete — the
            # cross-worker (WORKER_COUNT=2) + paused backstop D-LOCK-05 needs ...
            await finish_run(pool, r["wf_id"], "cancelled")
```

**The co-write DISCIPLINE analog (D-10) — `finalize_run_terminal`, same file `:117-155`:** one call
performs the durable status write and both mirror ZREMs, *"so a healed zombie can't leave `runs.status`
terminal while `runs:active` still lists it."*

**The exact block the new work sits between — Step 3b's shipped arms** (`run_lifecycle.py:226-259`).
⚠ RESEARCH said the anchor clear is at `:256-268`; **measured it is `:249-259`** (the comment starts
`:246`). Corrected beside.

```python
# Source: backend/app/services/run_lifecycle.py:231-259 (verified at HEAD)
    try:
        from app.dependencies import get_pg_pool  # noqa: PLC0415
        pool = await get_pg_pool()
        await finalize_run_terminal(
            pool=pool, redis=redis, run_id=run_id,
            thread_id=UUID(thread_id) if isinstance(thread_id, str) else thread_id,
            status="cancelled", error="cancelled_by_user",
            completed_at=datetime.now(timezone.utc),
        )
    except Exception:
        logger.exception("Zombie heal finalize (cancel) failed for run %s", run_id)

    # Phase 092 (092-03 / SC#2, MODE-02) — clear the per-thread workflow lock anchor on
    # cancel so a cancelled Harness/cap_paused run never strands the thread
    # Harness-locked. Best-effort, symmetric with the zombie-heal Redis ops (D-062-13).
    try:
        from app.utils.db import aexec  # noqa: PLC0415
        await aexec(
            supabase.table("threads")
            .update({"active_workflow_run_id": None})
            .eq("id", thread_id)
        )
    except Exception:
        logger.exception(
            "Zombie heal anchor-clear failed for thread %s (run %s)", thread_id, run_id
        )
```

⚠ **The anchor IS already cleared here** (RESEARCH correction #1 — verified). D-09's *"the anchor is
never cleared"* is FALSE; only `workflow_runs.status` is missing. **The new read must run BEFORE this
block** (`finish_run` keys its own anchor clear on `active_workflow_run_id = $1`; once this standalone
clear has run, the id is gone and the `workflow_runs` row is unreachable). **Keep the standalone clear** —
it is the Deep-path no-op and the belt-and-braces arm; deleting it is a Deep-path behaviour change,
forbidden by the deferred list.

**Best-effort framing to copy verbatim** — every Redis op in this function has its **own** `try/except` +
`logger.exception`, per D-062-13 (*"Postgres `runs.status` is the durable cancel record"*). The new
workflow co-write gets the same.

**The Deep byte-identity gate shape to copy** — `run_producer.py:246-247`:
> *"Deep runs / continuations (`active_workflow_run_id is None`) skip this entirely (byte-identical)."*

**⚠ Do NOT add `is_app_shutting_down()` here.** The gate lives at `run_producer.py:254-258` and must stay
there; RESEARCH proves in three independent ways that adding it to Step 3b would be wrong.

---

### 3. `backend/app/db/workflows.py` (data-access, CRUD) — the new phase-terminalize writer

**Analog: `record_phase_not_sent` `:1261-1290` — the newest phase writer, added by Phase 189, the same
phase that wrote migration 115.** Copy its shape, its docstring conventions and its *"THE COLUMN STORES
THE SLUG"* rule.

```python
# Source: backend/app/db/workflows.py:1261-1290 (verified at HEAD) — the shape to copy
async def record_phase_not_sent(pool: asyncpg.Pool, phase_id: UUID, output: dict) -> None:
    """Flip to ``recorded_not_sent`` AND write ``output`` in ONE atomic UPDATE (189 / D-05).

    WHAT THIS STATUS MEANS. ... None of the five shipped statuses is true of that outcome ...

    ⚠ THE COLUMN STORES THE SLUG (D-17). ``recorded_not_sent`` is the literal in
    ``workflow_phases_status_check`` (migration 115). The sentence a person reads —
    "Not sent — recorded" (D-16) — is RENDERED by the client's vocabulary layer from
    this slug and appears in no query and no constraint.
    ...
    PHASE-KEYED write → ``WHERE id=$1``.
    """
    await pool.execute(
        "UPDATE workflow_phases SET status='recorded_not_sent', output=$2::jsonb, updated_at=now() WHERE id = $1",
        phase_id,
        json.dumps(output),
    )
```

The five shipped phase writers, all `PHASE-KEYED → WHERE id=$1` (⚠ **mig 115's header cites
`db/workflows.py` lines 965/979/1001/1013 for these — STALE by ~240 lines; 119 must not copy that
pointer**): `mark_phase_active :1202` · `complete_phase :1213` · `fail_phase :1228` · `skip_phase :1250` ·
`record_phase_not_sent :1261`. **119 adds a sixth.**

**⚠ THE ONE DELIBERATE DEPARTURE FROM THE ANALOG — the zombie path is RUN-KEYED, not phase-keyed.** All
five shipped writers take a `phase_id` the engine already holds. The zombie arm **has no engine and no
`phase_id`**. The predicate to apply as a write comes from `get_active_phase`:

```python
# Source: backend/app/db/workflows.py:1088-1105 (verified at HEAD)
async def get_active_phase(pool: asyncpg.Pool, run_id: UUID) -> dict | None:
    """The single ``status='active'`` phase row for a stranded run (resume target).

    RUN-KEYED read → ``workflow_run_id`` (NOT ``run_id`` — column does not exist
    on workflow_phases; would raise Postgres 42703). ...
    """
    row = await pool.fetchrow(
        """
        SELECT id, slug, phase_index, status, output
        FROM workflow_phases
        WHERE workflow_run_id = $1 AND status = 'active'
        ORDER BY phase_index
        LIMIT 1
        """,
        run_id,
    )
```
⇒ Write the zombie-arm UPDATE as a **set-predicate** (`WHERE workflow_run_id=$1 AND status='active'`),
correct for 0, 1 or N rows and needing no read. `$N` binds only — never an f-string on user values.

**`finish_run` — reuse, and correct its docstring BESIDE, not over** (`:1308-1337`):
```python
async def finish_run(pool: asyncpg.Pool, run_id: UUID, status: str) -> None:
    """Terminal run status write (``completed`` / ``failed``) + lock-clear (SC#2).
    ...
    Both writes ride ONE transaction so a terminal run can never leave a dangling
    Harness lock ... The anchor-clear is idempotent: a re-run finds 0 matching rows and no-ops.
    """
    async with pool.acquire() as con:
        async with con.transaction():
            await con.execute("UPDATE workflow_runs SET status = $2 WHERE id = $1", run_id, status)
            await con.execute(
                "UPDATE threads SET active_workflow_run_id = NULL "
                "WHERE active_workflow_run_id = $1",
                run_id,
            )
```
The first line is narrower than the function — the F2 caller has passed `"cancelled"` since v2.8
(`run_producer.py:265-272`) and `delete_workflow_cascade` passes it too (`:1518`).

**The correct-beside-not-over SHAPE to copy** — `WorkspacePanel.tsx:166-181`:
> *"⚠ **CORRECTED (CR-03).** This block previously asserted that *"…"*. The claim was FALSE and the
> falseness is in the DB: … That clear is Phase 092's SC#2 and is NOT undone. Instead …"*

⚠ **Do NOT put the phase write inside `finish_run`.** It is called on the `completed` path
(`harness_engine.py:1651` and the success arm) and by the delete cascade; a phase write there changes
behaviour on paths this phase must not touch. A **new sibling writer** called from the two cancel sites is
the analog-conformant shape.

---

### 4. `backend/app/services/harness_engine.py` (service, event-driven) — the in-flight phase on the engine arm

**Analog: the `fail_run` arm, `:1646-1651` — three lines below the arm being edited.** It is the file's own
shipped "terminalize the phase, then the run" composition, and it carries D-07 verbatim:

```python
# Source: backend/app/services/harness_engine.py:1646-1651 (verified at HEAD)
        # ── fail_run: keep completed phases' outputs, stop cleanly, plain reason ─
        if outcome.kind == "fail_run":
            await fail_phase(pool, phase_id, outcome.reason)
            # Completed phases' outputs are ALREADY durable — finish_run does NOT
            # touch them (D-07). The run flips to `failed`; nothing silently dropped.
            await finish_run(pool, run_id, "failed")
```

**The arm to edit, with the two things that must survive byte-identical** (`:1613-1644`):
```python
        except BaseException:
            # ── cancel/escape path (D-06 / BUG-260605-01) ─────────────────────
            # A user Stop cancels the producer task while the phase await blocks ...
            #
            # 096-09 (UAT Test 2): on a GRACEFUL app shutdown we must NOT expire
            # the pending prompt — the run stays resumable ...
            if not is_app_shutting_down():
                try:
                    await asyncio.shield(
                        _expire_pending_ask_user(
                            pool, getattr(ctx, "thread_id", None), run_id,
                            org_id=getattr(ctx, "org_id", None),
                        )
                    )
                except BaseException:  # noqa: BLE001 — second cancel mid-cleanup
                    logger.exception(
                        "ask_user expiry cleanup failed on cancel/escape for run %s", run_id,
                    )
            raise
```

- **`phase_id` is in scope** — bound at `:1572` (`phase_id = row["id"]`), inside the same `while`
  iteration, before the `try` at `:1597`.
- **The `raise` must stay last** and the new write must be `asyncio.shield`-ed + its own `try/except`
  (cancellation is already in flight — the same discipline the ask_user expiry uses).
- **The 096-09 gate must not be moved, duplicated, or removed.**

---

### 5. `supabase/migrations/119_*.sql` (migration, DDL)

**Analog: `supabase/migrations/115_workflow_phases_recorded_not_sent.sql` — read its header IN FULL
(lines 1-108). It is the only migration that has ever touched this constraint.**

**Verified at HEAD:** `ls supabase/migrations/ | wc -l` → **112**; highest number **118**
(`118_connector_secret_column_privilege.sql`). ⇒ `119_*.sql` confirmed.

**The block to copy — add exactly one element:**
```sql
-- Source: supabase/migrations/115_workflow_phases_recorded_not_sent.sql:110-122 (verified at HEAD)
BEGIN;

ALTER TABLE public.workflow_phases DROP CONSTRAINT IF EXISTS workflow_phases_status_check;
ALTER TABLE public.workflow_phases ADD CONSTRAINT workflow_phases_status_check CHECK (
    status = ANY (ARRAY[
        'pending'::text, 'active'::text, 'completed'::text, 'failed'::text, 'skipped'::text,
        -- 189 (CONN-01 / D-08, D-17) — the governed external action that was recorded
        -- rather than transmitted. THE SLUG, never the rendered sentence:
        'recorded_not_sent'::text
    ])
);

COMMIT;
```

**The four header rules 119 must copy, each with the reason mig 115 gives:**
1. **`BEGIN`/`COMMIT`** (WR-01, 2026-08-07) — *"if the session dropped … the table was left with NO
   `workflow_phases_status_check` AT ALL — the closed vocabulary this whole migration exists to
   PRESERVE, gone, fail-open, and SILENTLY."*
2. **`DROP CONSTRAINT IF EXISTS`** — *"makes a re-paste safe. (House style: 048 and 063 …)"*
3. **`= ANY (ARRAY[…])` with `::text` casts, NOT `IN (…)`** — *"the form pg_dump regenerates … keeps the
   regenerated full-schema.sql diff to roughly one line."*
4. **Re-add every shipped literal verbatim** — *"A re-typed `ARRAY[…]` is precisely where a shipped literal
   gets silently dropped, which would orphan every existing row using it."*

**Header content to copy but RE-DERIVE, never transcribe:**
- The apply story (`:72-77`): SQL editor only, never `db push`/`db reset`, then
  `bash scripts/regenerate-full-schema.sh` (no `--reset`), never hand-edit `full-schema.sql`, and
  *"This plan ONLY AUTHORS the file — it is NOT applied here."*
- The ACCESS EXCLUSIVE note (`:79-82`): *"on cloud this belongs in the standing migration-parity window …
  Do NOT apply this to the cloud database during Phase 189"* → 194.
- ⚠ **The one line NOT to copy** — `115:56-59` says the phase-status literals live in *"the four UPDATEs in
  `backend/app/db/workflows.py` (lines 965, 979, 1001, 1013)"*. **Measured at HEAD those lines are inside
  `count_foreign_runs_on_global` / `load_run_phases`.** The real writers are `:1202`, `:1213`, `:1228`,
  `:1250`, `:1287` — **five, not four**, and 119 adds a sixth.

---

### 6. `backend/tests/test_migration_119.py` (test, live-DB gate)

**Analog: `backend/tests/test_migration_115.py` (300 L) — copy its whole scaffold.**

**The two clean skips, verbatim:**
```python
# Source: backend/tests/test_migration_115.py:46-49, 63-91 (verified at HEAD)
_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)

async def _pg_reachable(dsn: str = _POSTGRES_TEST_DSN) -> bool:
    try:
        conn = await asyncio.wait_for(asyncpg.connect(dsn), timeout=2.0)
        await conn.close()
        return True
    except Exception:
        return False

def _check_pg_available_sync() -> bool:
    import asyncio as _a
    try:
        loop = _a.new_event_loop()
        try:
            return loop.run_until_complete(_pg_reachable())
        finally:
            loop.close()
    except Exception:
        return False

PG_AVAILABLE = _check_pg_available_sync()
pytestmark = pytest.mark.skipif(
    not PG_AVAILABLE,
    reason=(
        f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; there is no live DB to gate "
        "migration 115 against"
    ),
)
```

```python
# Source: :110-129 — the applied-probe reads pg_constraint, never an INSERT probe
async def _migration_115_applied(conn) -> bool:
    definition = await conn.fetchval(
        "SELECT pg_get_constraintdef(oid) FROM pg_constraint "
        "WHERE conname = 'workflow_phases_status_check'"
    )
    return bool(definition) and NOT_SENT_SLUG in definition

_SKIP_UNAPPLIED = (
    f"migration 115 NOT applied - workflow_phases_status_check does not yet admit "
    f"'{NOT_SENT_SLUG}'. This green-skip is EXPECTED UNTIL PLAN 189-06 TASK 2 APPLIES IT "
    "(operator pastes ... into the Supabase SQL editor, then runs scripts/regenerate-full-schema.sh "
    "with no --reset; NEVER db push / db reset). Once applied, this file MUST PASS."
)
```

**The rollback-transaction + nested-savepoint shape** (`:187-214` positive, `:233-258` negative):
```python
    async with pg_pool.acquire() as conn:
        if not await _migration_115_applied(conn):
            pytest.skip(_SKIP_UNAPPLIED)
        tx = conn.transaction()
        await tx.start()
        try:
            run_id, org_id = await _seed_phase_parents(conn)
            ...
            inner = conn.transaction()        # nested savepoint for the DELIBERATE failure
            await inner.start()
            with pytest.raises(asyncpg.PostgresError) as exc:
                await _insert_phase(conn, run_id, org_id, NOT_SENT_DISPLAY_SENTENCE)
            assert exc.value.sqlstate == "23514", (...)
            assert "workflow_phases_status_check" in str(
                getattr(exc.value, "constraint_name", "") or exc.value
            ), (...)
            await inner.rollback()            # discard the aborted savepoint; keep the seeded outer tx
        finally:
            await tx.rollback()               # NEVER mutate live dev data
```

**The FK seed chain** (`:132-176`) — `auth.users` → `threads` → `workflow_definitions` → `workflow_runs`,
all inside the rolled-back transaction; `org_id` is NOT NULL with **no FK**, so a synthetic uuid is correct.

⚠ **The one thing to change, and RESEARCH's F-7 is right about why:** mig 115's positive control loops
per-literal (`for idx, status in enumerate(SHIPPED_STATUSES)`) — **keep the loop**. A single
`assert all(...)` short-circuits and proves only the first literal (the 193.2 clause-by-clause lesson).
119's tuple becomes **seven**: the six shipped + `cancelled`.

**F-8's negative control gets the phase's own display sentence** — `'Run cancelled — no deliverable
produced'` (the sketch's line), mirroring 115's `NOT_SENT_DISPLAY_SENTENCE = "Not sent — recorded"`.

---

### 7. `backend/tests/test_062_cancel_run.py` (test, unit) — extend

**Analog: itself.** The zombie case at `:141-174` is the exact template for the new workflow co-write case.

```python
# Source: backend/tests/test_062_cancel_run.py:141-174 (verified at HEAD)
async def test_internals_zombie_heal_routes_finalize_run_terminal(mock_asyncpg_pool, monkeypatch):
    from app.api.threads import RUN_TASKS

    rid = uuid4()
    RUN_TASKS.pop(rid, None)                        # ensure the happy path can't fire
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    fake_finalize = AsyncMock()
    monkeypatch.setattr("app.services.run_lifecycle.finalize_run_terminal", fake_finalize)

    fr = _FakeRedis(exists=0)
    out = await _cancel_run_internals(
        run_id=rid, status="streaming", thread_id=str(uuid4()),
        redis=fr, supabase=MagicMock(),
    )

    assert out == "zombie_healed"
    fake_finalize.assert_awaited_once()
    kwargs = fake_finalize.await_args.kwargs
    assert kwargs["status"] == "cancelled"
    assert kwargs["error"] == "cancelled_by_user"
    assert any(c[0] == "set" for c in fr.calls), "zombie heal must SETNX the cancel-lock"
    assert any(c[0] == "expire" for c in fr.calls), "zombie heal must EXPIRE the stream buffer"
```

**The supabase builder mock helpers to reuse** (`:60-79`) — `_chainable(...)` returns a MagicMock whose 17
builder methods all return `self`, and `_mock_supabase_runs_returns(data)` wraps it. The 404 route test
(`:84-99`) shows the `app.dependency_overrides[get_supabase]` pattern with a `finally: pop`.

⚠ **The mock level is the DATA-ACCESS layer** — the file's own docblock: *"Mocking matches the DATA-ACCESS
layer (MEMORY lesson, Phase 146) … We do NOT assert against the stale supabase `runs.update` layer the
145-03 co-write refactor retired."* A new fence asserting on a supabase `.update()` would be asserting
against a retired layer.

---

### 8. `frontend/src/components/panel/WorkspacePanel.tsx` (component, action) — the primary Stop

**⚠ G-5 FIRES (D-01) — honoured BY CONSTRUCTION only if the mount uses `stopThread(threadId)`.**
Re-derived at HEAD `0dcb4a8e`: **13 commits / 8 phases (`087 088 094 095.1 100 124 155 188`, zero
quick-task buckets) / 493 L** — matches RESEARCH exactly.

**Analog: the file's own two shipped additive siblings.** The G-5 red line is written INTO the file:

```tsx
/* Source: frontend/src/components/panel/WorkspacePanel.tsx:85-93 (verified at HEAD) */
/**
 * Phase 124-03 Task 1 (WUX-01, D-07/D-08, A2) — the run-surface soul header.
 *
 * An ADDITIVE SIBLING of the live PhaseTimeline (the G-5 red line): it reads the
 * DEFINITION only and renders <WorkflowSoul scale="run">. It must NEVER:
 *  - consume usePhases(threadId) for live phase state,
 *  - render an elapsed timer or a per-phase slug ...
 *  - read PhaseCard / PhaseTimeline internals or add a prop to either.
 */
```
and `RunSeam`'s restatement (`:182-190`):
> *"ADDITIVE SIBLING, and the same G-5 red line the run-soul section observes: it does not read PhaseCard /
> PhaseTimeline internals and adds a prop to neither. It also **renders nothing at all when the callback is
> absent, so every existing caller and every existing panel test is byte-unchanged**; and it sits inside the
> SAME harness gate as its neighbours, so a Deep / no-run thread sees nothing new (the D-08 discipline)."*

**The mount site — the gate and its two existing siblings, verbatim** (`:371-391`):
```tsx
          {showTimeline && (
            <PanelSection title="This workflow">
              <RunSoul threadId={threadId} />
            </PanelSection>
          )}

          {showTimeline && <RunSeam threadId={threadId} onOpenRun={onOpenRun} />}

          {showTimeline && (
            <PanelSection title="Workflow" count={phases.length || undefined}>
              <PhaseTimeline threadId={threadId} />
            </PanelSection>
          )}
```

**What the file ALREADY holds — the proof this is WIRING, not state plumbing** (all re-verified at HEAD):

| Need | Already present | Line |
|---|---|---|
| the thread id | `const threadId = useViewingThread()` | **`:271`** ✅ exact |
| provider hooks | an **8-key** import block from `@/providers/StreamsProvider` | **`:34-43`** ✅ exact |
| the harness gate | `const showTimeline = isHarness \|\| phases.length > 0` | **`:293`** ⚠ RESEARCH said `:292` — that is `const isHarness = workflowLock != null`; corrected beside |
| the lock | `const workflowLock = useWorkflowLockForThread(threadId)` | `:291` |
| phase state | `const { data: phases } = usePhases(threadId)` | `:278` |

⇒ **`useStreamActions` is a NINTH import from a module the file already imports eight from.** No new fetch,
no new prop, no new store slice, no new state.

**Control analog — `ActiveRunsTray.tsx:127-133`** (the shipped per-run Stop; copy the destructive tokens,
the `aria-label`, and the `void` on the promise):
```tsx
                <button
                  onClick={() => void streamActions.stopThread(id)}
                  className="flex shrink-0 items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] text-destructive hover:bg-destructive/20 transition-colors"
                  aria-label={`Stop run on ${titleFor(id)}`}
                >
                  <Square className="h-2.5 w-2.5 fill-current" aria-hidden="true" /> Stop
                </button>
```
with the tray's own rule in its docblock (`ActiveRunsTray.tsx:25-26`):
> *"Every Stop routes through the one durable cancel path (`stopThread` → DELETE /runs/{id}); **nothing
> here invents new backend behavior**."*

**The resolver it must call — `stopThread`, `StreamsProvider.tsx:2400-2415`** (⚠ RESEARCH cited
`:2400-2416`; the block ends `:2415`):
```ts
        stopThread: async (threadId: string) => {
          if (!threadId) return
          const bucket =
            useStreamsStore.getState().bucketsBySurface.get("chat")?.get(threadId) ?? []
          const streamingMsg = [...bucket]
            .reverse()
            .find((m) => m.role === "assistant" && m.runStatus === "streaming")
          const runId = streamingMsg?.runId
          if (!runId) return                      // ⚠ THE SILENT NO-OP WINDOW
          stoppedByUserRef.current = true
          try {
            await cancelRun(runId)
          } catch (err) {
            console.error("Stop failed (thread", threadId, "):", err)
          }
        },
```
⚠ **`if (!runId) return` at `:2408` (and `:2386` in `stopStream`) is the pre-stamp silent no-op** —
between the optimistic placeholder (`:1926-1936`, `runStatus:"streaming"`, no `runId`) and the kickoff
stamp (`:2030`, `runId: run_id`, the **producer** id ✅). Make it observable or disable the control until
the id lands; a silent success is the exact failure SC#2 forbids.

**⛔ The anti-analog, stated so it cannot be reached for:** `RunSeam`'s `useState<string | null>` fed from
`getThreadWorkflow` (`:201`, `:219`) holds the **`workflow_runs.id`** — the wrong type for `cancelRun`.
Copying `RunSeam`'s id-acquisition would be new state ownership ⇒ a SECOND concern ⇒ **G-5 fires and the
refactor recommendation is owed FIRST.**

---

### 9. `frontend/src/components/panel/__tests__/WorkspacePanel.test.tsx` (test) — extend

**Analog: itself (718 L).** ⚠ **A trap that will cost a plan a wave if it is not mapped: the
`StreamsProvider` mock is an EXPLICIT object literal with exactly eight keys and NO `useStreamActions`.**

```tsx
// Source: frontend/src/components/panel/__tests__/WorkspacePanel.test.tsx:71-81 (verified at HEAD)
vi.mock("@/providers/StreamsProvider", () => ({
  useTodos: (...a: unknown[]) => useTodos(...a),
  useWorkspaceFiles: (...a: unknown[]) => useWorkspaceFiles(...a),
  useAskUserPrompt: (...a: unknown[]) => useAskUserPrompt(...a),
  useViewingThread: (...a: unknown[]) => useViewingThread(...a),
  usePhases: (...a: unknown[]) => usePhases(...a),
  useTasks: (...a: unknown[]) => useTasks(...a),
  useWorkflowLockForThread: (...a: unknown[]) => useWorkflowLockForThread(...a),
  useDerivedPanel: (...a: unknown[]) => useDerivedPanel(...a),
}))
```

The file **already documents this exact failure mode**, at `:97-100`:
> *"Phase 100 (D-01): WorkspacePanel renders the REAL TemplateUpload inside the empty short-circuit (**it
> reads `useStreamActions`, which this file's StreamsProvider mock omits**) — sentinel-mock it like the
> other section bodies."*

⇒ Adding `useStreamActions` to `WorkspacePanel.tsx` **breaks this mock** unless a ninth key is added in the
same commit. The precedent Phase 100 chose was to sentinel-mock the *child*; 194 cannot, because the
caller **is** the panel. **Add the ninth key.**

**The `?raw` source-fence pattern this file already uses** (`:31`) — the shape F-1 must take:
```tsx
import workspacePanelSource from "@/components/panel/WorkspacePanel?raw"
```
⚠ **F-1's scope trap:** sweeping `components/panel/` alone will not see a Stop that later lands in
`components/chat/`. Scope the fence over the union of the mount directories and drive it RED with a plant
in **each** — this is the Phase 192.1 *"renamed module swept against the empty string and passed green"*
failure. Plant both `workflowLock.runId` **and** `workflowLock?.runId`.

---

### 10. `frontend/src/components/chat/MessageItem.tsx` (component, store slice) — the banner advance (D-18)

**The mechanism, verified at HEAD — it is not a copy bug and not a propagation gap:**
```tsx
// Source: frontend/src/components/chat/MessageItem.tsx:329 (verified at HEAD)
  const hasAnyTools = (message.tool_calls?.length ?? 0) > 0
```
```tsx
// Source: frontend/src/components/chat/MessageItem.tsx:635, :644 (verified at HEAD)
        ) : isStreaming && !hasAnyTools ? (
          // No tools yet — first LLM call is thinking
          <span className="flex items-center gap-2 text-muted-foreground text-sm animate-fadeSlideUp">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="italic">{outerBannerLabel(null, false, message.isPlanning ?? false, workflowLock != null, !message.content && !!message.reasoningContent)}</span>
```
```ts
// Source: frontend/src/lib/toolMeta.ts:90-93 (verified at HEAD) — ⚠ DO NOT EDIT THIS STRING
  if (!hasAnyTools && !isPlanning) {
    if (reasoningActive) return "Reasoning…"
    return isHarness ? "Starting workflow…" : "Setting up agent…"
  }
```
A harness run writes **no `tool_calls`** — its progress lives in `workflow_phases` rows and
`phase_started`/`phase_completed` SSE. So `hasAnyTools` is `false` for the whole run and the `:635` branch
holds from kickoff to terminal. **The banner is structurally incapable of advancing.**

**⭐ THE ANALOG IS IN THE SAME COMPONENT, ONE HOOK OVER — and it materially reframes D-18's PANEL-09 cost.**

```tsx
// Source: frontend/src/components/chat/MessageItem.tsx:300-303 (verified at HEAD)
  // Phase 092 (CONT-01 / D-07): the per-thread workflow lock for THIS message's
  // owning thread (out-of-band cap_paused state). ...
  const workflowLock = useWorkflowLockForThread(message.thread_id ?? null)
```

`workflowLockByThread` is written by the **same harness demux** as `phasesByThread`
(`StreamsProvider.tsx:963-968` `onCapPaused`, `:1839-1844`, `:1982-1987`). **So a chat component already
consumes a harness-demux slice, and has since Phase 092.**

**And PANEL-09's rule, read at source, is narrower than "the chat may not see phase data":**
```
// Source: frontend/src/providers/StreamsProvider.tsx:971-978 (verified at HEAD)
// Phase 094 Plan 02 (PANEL-08 / PANEL-09) — harness phase-lifecycle demux.
// ... They write phasesByThread ONLY — never bucketsBySurface
// (PANEL-09: the chat selector useThreadMessages reads bucketsBySurface
// exclusively → zero chat re-renders). ...
```
⇒ PANEL-09 is a rule about **what the demux WRITES**, not about what a component may READ. Adding
`usePhases(message.thread_id)` beside the existing `useWorkflowLockForThread(message.thread_id)` **does not
change one line of the demux** and does not touch `bucketsBySurface`. The accepted cost is a re-render of
`MessageItem` when `phasesByThread` is reassigned — **per phase transition, a handful per run, never per
token**, exactly as D-18 states. **Record the measured re-render count beside PANEL-09's original
reasoning, not over it.**

**The additive-default parameter shape, if `outerBannerLabel` gains a progress input** —
`toolMeta.ts:78` and `:88` both do it, and both say why:
> *"Mirrors the isHarness additive-default shape above — default false keeps every existing caller + Deep
> Mode byte-identical (D-14)."*

⚠ **`toolMeta.test.ts:31`'s byte pin must stay green** — the string is the pre-phase-1 value, not the only
value. (⚠ CONTEXT cites `toolMeta.test.ts:30`; the assertion is at **`:31`** and the file is at
`frontend/src/lib/__tests__/toolMeta.test.ts` — corrected beside.)

**The duplicate-icon symptom is a MEASUREMENT task, not a fix task** (RESEARCH A1, MEDIUM confidence).
Prior art to read, not to copy blind: `dedupMessages.ts:20-26`, `StreamsProvider.tsx:2490-2500`
(BUG-260609-03), `dedupMessages.ts:31-45` (BUG-260610-01). The report's own named prior art
(`toolcallpanel-dedup-duplicates-tool-card.md`) is the **wrong one**.

---

### 11. `frontend/src/components/chat/RunCard.tsx` (component, vocabulary)

**⚠ G-5 FIRES (D-01).** Re-derived at HEAD `0dcb4a8e`: **20 commits / 9 raw buckets / 550 L**.
Buckets: `075.7 075.8 076.1 076.2 095 095.1 128 155 streaming`. ⚠ **`streaming` is NOT a phase** — it is
`fix(streaming)` `0dce56aa` + `revert(streaming)` `61e5eb1e`, an untagged 075.x follow-up pair, counted OUT
exactly as `WorkflowBuilderPage.tsx`'s ledger row does about `260809`/`260814`. ⇒ **`20 / 8 / 550`.**

**Analog: itself.** The vocabulary already ships and reads only already-persisted `message.runStatus`:
```ts
// Source: frontend/src/components/chat/RunCard.tsx:529-550 (verified at HEAD)
// File-local helpers — UI-SPEC §8.2 copy contract.
function statusGlyph(s: Message["runStatus"]): string {
  if (s === "completed" || s === undefined) return "✓"
  if (s === "failed") return "✗"
  if (s === "timed_out") return "⏱"
  if (s === "cancelled") return "■"
  return "✓"
}

function statusWord(s: Message["runStatus"], runError?: string): string {
  if (s === "completed" || s === undefined) return "done"
  if (s === "failed") { ... }
  if (s === "timed_out") { ... }
  if (s === "cancelled") return "cancelled"
  return "done"
}
```
⇒ A vocabulary extension reads existing state; **no fetch, no prop, no store slice** ⇒ G-5 honoured by
construction. D-14: may extend, may not replace without stating why.

**The sibling already-shipped cancelled affordance** (`MessageItem.tsx:651-659`) is the precedent for a
*"cancelled — no output yet"* honest empty state, styled *"Square icon + muted italic"* — i.e. the chat
surface has already chosen lucide `Square` over `■` for the control-adjacent case.

---

### 12. `CLAUDE.md` (docs) — the two hot-file ledger rows (D-02)

**Analog rows: `backend/app/db/workflows.py` and `backend/app/services/harness/publish_service.py`.**
Both were added by Phase 193.2 and both carry the exact structure D-02 requires. Extract the seven
structural elements:

| # | Element | As the `db/workflows.py` row does it |
|---|---|---|
| 1 | **Touch list** — phases, with the landing plan + sha for this phase's own commits | `` 091 / 092 / … / **193.2 (193.2-03 `0d8b8bc5`)** `` |
| 2 | **The triple** — `N commits across M phases`, `before → after L` | *"**31 commits across 17 phases**, **1296 → 1405 lines**"* |
| 3 | **Quick-task subtraction, stated explicitly** | *"⚠ **ZERO quick-task buckets:** the standard `sed` recipe returns exactly 17 buckets and all seventeen are real phases — unlike … whose recipes return `260809` / `260814` / `quick`"* |
| 4 | **⚠ The ABSENT sentence — must survive future edits** | *"**THIS FILE WAS ABSENT FROM THIS TABLE UNTIL PHASE 193.2. Seventeen phases touched it … and G-5 never fired on it once, because the discuss-phase audit scans PLAN.md `files_modified` *against this table*. A hot file missing from the table is permanently invisible to its own guardrail.**"* |
| 5 | **Re-derive commands, inline** | ``Re-derive with: `git log --oneline -- <file> \| wc -l` → 31; `git log --format=%s -- <file> \| sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' \| sed -E 's/-.*//' \| sort -u`; `wc -l <file>` → 1405`` |
| 6 | **The G-5 verdict + the measured reason it was honoured by construction** | *"**G-5 FIRES … honoured BY CONSTRUCTION in 193.2, not waived.** … **The measured reason, which is a test rather than an argument:** …"* |
| 7 | **The binding invariants + the NAMED next seam + `It inherits N / M / L`** | *"the natural seam is named rather than implied — the three list feeds versus the single-definition read … **It inherits `31 / 17 / 1405`.**"* |

**Two more habits both analog rows keep and 194's rows must keep:**
- **A correction on measurement is recorded BESIDE, never over** — *"⚠ Corrections on measurement against
  this phase's own artifacts: `193.2-CONTEXT.md` D-01 … read `30 / 16 / 1296`; both moved on this phase's
  own commit."* **194 owes exactly this against D-01's `~9 buckets`** (measured: 9 raw buckets, **8
  phases**) and against D-01's *"both names occur only inside other rows' prose"* — measured,
  `grep -o "RunCard.tsx" CLAUDE.md | wc -l` → **0** and `grep -o "WorkspacePanel.tsx" CLAUDE.md | wc -l`
  → **0**; **neither filename appears in `CLAUDE.md` at all.**
- **A declined override is recorded as a measurement** — *"A G-5 override was OFFERED AND DECLINED … so
  `.planning/STATE.md` records NO guardrail override for Phase 193.2; that absence is a measurement, not an
  omission."*

**Draft row CONTENT is already written** in `194-RESEARCH.md:1043-1105`. It is measured-correct at HEAD
(re-verified this session) — but ⚠ **re-derive all six figures at the plan's own commit**: this table's
`WorkflowsPage.tsx` cell has gone stale **four consecutive times, once within a single day**, and a figure
written at a plan's close goes stale on the next commit touching the file.

---

## Shared Patterns

### S1. The dual-id fallback (owner-scoped + anchor-confirmed, 404 never 403)
**Source:** `backend/app/api/runs.py:722-756` and `:536-584`
**Apply to:** the `DELETE /runs/{run_id}` change only.
**The three clauses, none optional** — (a) `.eq("user_id", current_user["id"])` on the `workflow_runs`
select; (b) `.eq("user_id", …)` on the `threads` anchor read; (c)
`if str(_anchor.get("active_workflow_run_id")) == str(run_id)`. **The pool bypasses RLS — these ARE the
access boundary.** F-10 must plant against (a) and (b) **separately**; a fence asserting only one leaves
the other undefended (the 193.2 two-arms-one-assertion lesson), and Phase 190's CR-01 was a real
credential exposure that 19 plans of RED-first self-checking missed.

### S2. Best-effort Redis / per-op try-except (D-062-13)
**Source:** `backend/app/services/run_lifecycle.py:231-290` — four consecutive blocks, each with its own
`try` and `logger.exception`.
**Apply to:** every new op inside `_cancel_run_internals`.
**The rule:** *"Postgres `runs.status` is the durable cancel record."* A Redis or workflow-side failure
must never fail the cancel; the discriminator is still returned.

### S3. Late-import at the call site
**Source:** `api/runs.py:1194`, `api/workflows.py:1495-1496`, `run_lifecycle.py:202/232/250/278`,
`run_producer.py:254/261` — all carry `# noqa: PLC0415`.
**Apply to:** every new cross-module import in the backend cancel path.
**Why:** keeps `RUN_TASKS` off the module load path and avoids the `runs` ↔ `run_lifecycle` cycle.
`run_lifecycle.py` already late-imports from `app.api.threads`, `app.dependencies`,
`app.services.ask_user_service` and `app.utils.db` — `finish_run` joins that list.

### S4. The ordering that is load-bearing (D-085-04)
**Source:** `run_lifecycle.py:206-217` — `publish_cancel_sentinel` **then** `task.cancel()`.
**Apply to:** anything inserted into Step 3a. New work goes **after** Step 3a's `return` or **inside**
Step 3b — never between the sentinel publish and `task.cancel()` (F-12).

### S5. The additive-sibling frontend mount (the G-5 red line)
**Source:** `WorkspacePanel.tsx:85-93` (`RunSoul`) and `:182-190` (`RunSeam`)
**Apply to:** the panel Stop.
**The four clauses:** no `PhaseCard`/`PhaseTimeline` internals read; no prop added to either; mounted
inside the **existing** `showTimeline` gate so Deep threads stay byte-identical; **renders nothing when its
data is absent**, so every existing caller and panel test stays byte-unchanged.

### S6. `?raw` source fences
**Source:** `WorkspacePanel.test.tsx:31`
**Apply to:** F-1 and any negative fence over frontend source.
**Two scoping lessons from this repo:** scope over the **union of the mount directories** (192.1's
renamed-module-swept-against-the-empty-string failure), and where a docblock legitimately names the banned
token, scope the fence over the **composed value**, not the module source (193.2's F-3 lesson — directly
applicable to F-6, since `db/workflows.py` docblocks legitimately name `failed` and `skipped`).

### S7. Correct-beside-not-over
**Source:** `WorkspacePanel.tsx:166-181` (`⚠ CORRECTED (CR-03)`), `publish_service.py`'s `SUPERSEDED`
marker, every ledger cell in `CLAUDE.md`.
**Apply to:** `finish_run`'s docstring, the `WorkflowLock.runId` JSDoc, mig 115's stale line pointers, the
sketch's cancel copy, and every CONTEXT claim RESEARCH measured false.
⚠ **Two same-day lessons worth inheriting:** (193.2-08) a rule written **wrapped** across two lines failed
its own literal `grep -q` and read as *"already fixed"* — **write any grep-able sentence on ONE line**; and
(WR-05) *"a deferral that lives only in a deleted comment is exactly as invisible as one that was never
written."*

### S8. The live-DB gate discipline
**Source:** `backend/tests/test_migration_115.py`
**Apply to:** `test_migration_119.py` and any test seeding `workflow_runs`/`workflow_phases`.
**All writes inside a transaction that ROLLS BACK**; deliberate failures in a nested savepoint; the
applied-probe reads `pg_constraint`, never an INSERT probe; **exactly two clean skips**.
⚠ **CLAUDE.md parallel-execution rule 4 binds:** the migration apply, `test_migration_119.py`, any backend
test seeding those tables, and D-12/D-17's heal are all **SERIALIZED** — the `DROP+ADD CONSTRAINT` takes a
brief **ACCESS EXCLUSIVE** lock on `workflow_phases`.

---

## No Analog Found

**None.** Every file in the set has a named analog, and 12 of 13 are exact. The two closest things to a gap
are recorded here so the planner does not mistake them for missing precedent:

| Item | Why it is NOT an analog gap |
|---|---|
| The `DELETE` route's **forward** resolution to the producer id | Not present in any `/runs` route — but the query and its rule are already written and shipped in `api/workflows.py:1478-1493`. This is a composition of two shipped analogs, not a new pattern. |
| A **chat** component consuming the harness phase demux (D-18) | Reads as new only if PANEL-09 is remembered as "the chat may not see phase data". `MessageItem.tsx:303` has consumed `workflowLockByThread` — written by the **same demux** — since Phase 092. The analog is one line above the code being changed. |

---

## Metadata

**Analog search scope:** `backend/app/api/` · `backend/app/services/` · `backend/app/db/` ·
`backend/tests/` · `supabase/migrations/` · `frontend/src/components/{panel,chat,workflows}/` ·
`frontend/src/{providers,stores,lib}/` · `.claude/skills/sketch-findings-agentic-rag/references/` ·
`CLAUDE.md`

**Files read at HEAD this session:** 24 (17 source · 4 test · 1 migration · 1 skill reference · 1 doc)
**Commands executed:** `git log --oneline`/`--format=%s` + the standard `sed` bucket recipe on both G-5
files · `wc -l` ×3 · `ls supabase/migrations/ | wc -l` → 112 · `grep -rn "cancelRun("` ·
`grep -rn "workflowLock.runId"` · `git rev-parse --short HEAD` → `0dcb4a8e`

**Pointer corrections made on measurement** (all recorded beside, never over):
`WorkspacePanel.tsx` `showTimeline` is `:293` not `:292` · `stopThread` ends `:2415` not `:2416` ·
the cascade SQL starts `:1484` not `:1486` · the 092-03 anchor clear is `:249-259` not `:256-268` ·
`WorkflowLock.runId` assignments are `:1840`/`:3034` not `:1839`/`:3032` ·
`toolMeta.test.ts` byte pin is `:31` not `:30` (CONTEXT) · `RunCard.tsx` is **8 phases**, not
"~9 buckets" (CONTEXT D-01) · **neither G-5 filename appears in `CLAUDE.md` at all** (CONTEXT D-01 said
"only inside other rows' prose").

**Pattern extraction date:** 2026-08-16
