# Phase 120: Collision Fix + Context Isolation - Research

**Researched:** 2026-06-22
**Domain:** Backend — sandbox-output harvest run-scoping (COLL-01) + Postgres column migration & history-reconstruction row filtering (CTX-01). FastAPI + Supabase/Postgres + raw LLM SDK (no LangChain/LangGraph).
**Confidence:** HIGH (both seams read in source; root-cause confirmed live; Postgres semantics verified against official docs)

## Summary

Phase 120 closes two independent, root-caused backend defects that share one symptom (workflow artifacts bleeding into Deep chat). **COLL-01** is a *seeding* fix, not new machinery: `harvest_output_files` already has a content-hash dedup baseline (`previous_files` dict, Phase 075.4 D-075.4-D1/D2), but the per-run baseline is initialized **empty** at two sites (`agent_loop.py:1316` for Deep, `harness/phase_types.py:343` for Harness). Because the baseline is empty and the harvest walks `/sandbox/output/` unfiltered, every file on disk — including a prior workflow's leftover `.docx` — enters the emitted delta. The fix is to **snapshot the existing `/sandbox/output/` files and seed `previous_files` with their content-hashes at run start**, so the existing hash-dedup naturally excludes pre-existing files. No schema change.

**CTX-01** adds `messages.origin` (`deep | harness`) via migration **076** and filters the history query that feeds `_reconstruct_history`. The critical architectural finding: the main assistant-message persist is a **shared asyncpg helper** (`insert_assistant_message`, `db/runs.py:145`) called by BOTH Deep (`agent_loop.py:1226`) and Harness (`harness_engine.py:439` success + `:513` failure). The cleanest tag mechanism is an `origin` parameter on that helper (default `'deep'`; Harness callers pass `'harness'`). The remaining insert sites are role='system' ask_user/warning rows scattered across 6 files. The filter is a **provider-agnostic row-level pre-filter at the `agent_loop.py:1024` query** — Deep replays `origin <> 'harness'` (deep OR legacy/NULL), Harness replays `origin = 'harness'` strictly. For any pure-Deep thread this returns the identical row set as today, so Deep Mode stays byte-identical (the red line).

**Primary recommendation:** COLL-01 = seed `previous_files` by snapshotting + content-hashing the existing `/sandbox/output/` contents at run start (mechanism (a), not mtime), reusing the existing hash-dedup. CTX-01 = `ADD COLUMN origin text DEFAULT 'deep' CHECK (origin IN ('deep','harness'))` (existing rows are FILLED with `'deep'`, not NULL — verified), add an `origin` param to `insert_assistant_message`, tag all 8 enumerated insert sites, and filter the `:1024` query asymmetrically.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Run-scope the sandbox harvest baseline (COLL-01) | API/Backend — `agent_loop.py` (Deep run boundary) + `harness/phase_types.py` (per-phase ctx build) | Backend — `sandbox_service.harvest_output_files` (already accepts the baseline) | The harvest runs server-side against the Docker container; the baseline lives in the run/phase ToolContext. |
| Snapshot existing files at run start | Backend — `sandbox_service.py` (new helper) | Docker / sandbox container | The container filesystem is the source of truth; a new pure helper lists+hashes it. |
| `messages.origin` column (CTX-01) | Database — migration 076 | — | Schema substrate; legacy-row fill semantics belong to Postgres DEFAULT. |
| Tag origin at insert (CTX-01) | Backend — shared `db/runs.py` helper + 6 system-row insert sites | — | Each insert site already exists; tagging is a one-line/one-param addition per site. |
| Filter history by origin (CTX-01) | Backend — `agent_loop.py:1024` history query | — | Row-level pre-filter BEFORE `_reconstruct_history`; provider-agnostic. |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**COLL-01 — Harvest run-scope (the 2-files bug)**
- **D-120-01:** Per-turn baseline-filter only, no clearing. Each Deep agent-turn (one `agent_runner` run) seeds `harvest_output_files`' `previous_files` baseline from the **actual `/sandbox/output/` listing at run start** (today `_previous_files_in_run` starts empty at `agent_loop.py:1316`). Only files the turn newly created enter the emitted delta; pre-existing files are excluded. Scope is **per run, not per cell** — a multi-cell run keeps its own intermediates.
- **D-120-02:** Do NOT proactively clear `/sandbox/output/` at the Harness→Deep boundary or workflow-run end. Stale files stay on disk (never re-emitted). Smallest blast radius. No schema change for COLL-01.
- **D-120-03:** Apply the same baseline-at-run-start seeding to the **Harness run** path so a workflow run only emits its own outputs (defense symmetry), without excluding the workflow's own legitimate deliverable from its own run.

**CTX-01 — `messages.origin` + history isolation**
- **D-120-04:** New column `messages.origin` in migration **076**, type text, `DEFAULT 'deep'`, `CHECK (origin IN ('deep','harness'))`. Default `'deep'` is the *safe* failure direction.
- **D-120-05:** No backfill of existing rows. Pre-migration rows take `DEFAULT 'deep'` on existing-row fill (planner to confirm exact column-add semantics — RESOLVED below). Treat legacy rows as Deep. Back-tagging historical harness rows via workflow-run joins was **rejected**.
- **D-120-06:** Filter semantics — asymmetric: a **Deep** turn's history reconstruction replays `origin <> 'harness'` (i.e. `deep` OR legacy/`NULL`); a **Harness** phase replays `origin = 'harness'` strictly.
- **D-120-07:** Tag origin explicitly at every message-insert site, not just rely on the default — Deep sites write `'deep'`; Harness sites write `'harness'`. The filter lives in the history query at `agent_loop.py:1024` (NOT in `threads.py`).

**Acceptance / verification**
- **D-120-08:** Faithful live-repro regression test is the headline bar. Mirror thread `99af24d5` — must **fail before** the fix and pass after.
- **D-120-09:** SC#10 4-axis is mandatory: cross-provider (native-7 representative) × multi-tool × parallel-thread × long (≥50-message) history. Deep Mode proven byte-identical.

### Claude's Discretion
- Exact mechanism for seeding the baseline (snapshot the directory listing + hash vs. mtime-filter against turn-start) — the contract is "only emit files this run created." **(Resolved: snapshot+hash — see Open Question 1.)**
- Exact column-add SQL semantics for existing rows (NULL vs DEFAULT-fill). **(Resolved: DEFAULT-fill — see Open Question 2.)**
- Whether `tool` / `ask_user` / sub-agent message rows need explicit origin tagging or inherit their insert-site's mode — planner to enumerate the full insert-site set. **(Resolved: full enumeration in Open Question 3.)**

### Deferred Ideas (OUT OF SCOPE)
- **COLL-02** — `template_input` / `render_template` resolver run-scope → STRETCH **Phase 130**. Mechanism B did NOT fire in the live evidence.
- **Proactive `/sandbox/output/` cleanup at mode boundary** — considered and rejected for 120 (D-120-02).
- **IA-01** composer 2-pill simplification → Phase 121 (clarity, not the collision fix).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COLL-01 | Run-scope the sandbox harvest baseline so a skill that saves one file in a thread that previously ran a workflow emits exactly that file (the live 2-files bug, Mechanism A). | Seed `previous_files` by snapshotting+hashing `/sandbox/output/` at run start (both `agent_loop.py:1316` Deep + `harness/phase_types.py:343` Harness). Existing hash-dedup (`sandbox_service.py:333-361`) then excludes pre-existing files. Headline regression test scaffold exists (`test_075_4_dedup_supersedes.py`, `test_sandbox_service.py`). |
| CTX-01 | Record `messages.origin` (`deep`/`harness`) + filter `_reconstruct_history` so neither mode replays the other's rows. | Migration 076 `ADD COLUMN ... DEFAULT 'deep'` (fills legacy rows with `'deep'`). Tag shared helper `insert_assistant_message` + 6 system-row sites. Filter at `agent_loop.py:1024` query (provider-agnostic, asymmetric per D-120-06). |

## Project Constraints (from CLAUDE.md)

- **Migrations:** numbered SQL under `supabase/migrations/` (next = `076_*.sql`); filename must match `<digits>_name.sql`. **Apply by pasting into the Supabase SQL editor — NEVER `supabase db push`/`db reset`** (preserves dev data). Then `bash scripts/regenerate-full-schema.sh` (default = no reset). **Never hand-edit `full-schema.sql`.**
- **Raw SDK calls only** (no LangChain/LangGraph); **Pydantic** for structured LLM outputs. (Neither seam introduces new LLM I/O — no impact.)
- **All tables need RLS** — `messages` already has RLS bound to thread owner. Adding a column inherits the existing policy; no new policy needed (precedent: migration 050 reasoning_content added no policy).
- **Provider-docs-first:** CTX-01 touches context management / history reconstruction → confirmed the filter is provider-agnostic at the row level (Open Question 4). Provider-specific handling (Google `thought_signature`, DeepSeek `reasoning_content`) stays inside `_reconstruct_history` / provider services and is unchanged.
- **Do not run blocking I/O directly inside async handlers** — `harvest_output_files` is already wrapped with `run_in_threadpool` (`tool_dispatcher.py:1139`); the new snapshot helper (which calls `session.execute_command` / container I/O) MUST also run via `run_in_threadpool` (D-v2.5-01).
- **G-5 hot files:** `threads.py` and `agent_loop.py` are firing hot files — minimal touch. `threads.py:1020` is a `role='user'` insert → it does NOT need an origin tag (user rows replay in both modes; see Open Question 3). The filter lives in `agent_loop.py:1024` (one query change), not in `threads.py`. The CONTEXT (D-120-07) names `threads.py:1020` as a Deep site but it is a USER row — see the precise enumeration below.
- **Multi-worker uvicorn** (`WORKER_COUNT=2`): the per-run `previous_files` baseline is closure-local (no cross-worker shared state); safe.

## Standard Stack

No new packages. This phase uses only the existing stack.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `hashlib` (stdlib) | — | SHA-256 content-hash for the snapshot baseline | Already the harvest dedup key (`sandbox_service.py:280`). Reuse the same hash so seeded baseline entries collide correctly with harvested entries. |
| `asyncpg` | (pinned) | `insert_assistant_message` raw INSERT (gets new `origin` param) | Already the Phase 073 write path for the shared assistant-message persist. |
| `supabase-py` | (pinned) | Migration applied by hand; system-row inserts | Existing convention. |
| `fastapi.concurrency.run_in_threadpool` | (FastAPI pinned) | Wrap the new container-listing snapshot helper | D-v2.5-01 — never block the event loop with `llm_sandbox` calls. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Snapshot+hash at run start (mechanism a) | mtime-filter against turn-start (mechanism b) | mtime is coarser (filesystem timestamp resolution, container clock skew, and a file written then overwritten in the same second can be missed); hash reuses the EXISTING dedup machinery exactly, so a seeded entry and a harvested entry collide on the same key with zero new comparison logic. Snapshot+hash is strictly more aligned with the current code. |

**Installation:** None — no new dependencies.

## Package Legitimacy Audit

> Not applicable — Phase 120 installs **no external packages**. All code uses the existing pinned stack (stdlib `hashlib`, already-pinned `asyncpg` / `supabase-py` / `fastapi`). No npm/PyPI/crates install occurs. slopcheck N/A.

## Architecture Patterns

### System Architecture Diagram — COLL-01 (harvest run-scope)

```
                       Deep run start (agent_loop.py:1316)
                                │
                                ▼
            ┌──────────────────────────────────────────┐
  TODAY:    │ _previous_files_in_run = {}  (EMPTY)       │
            └──────────────────────────────────────────┘
                                │
   FIX:     ┌──────────────────────────────────────────┐
            │ snapshot /sandbox/output/  →  {hash: meta} │  ← NEW: list + SHA-256 every
            │ _previous_files_in_run = <seeded baseline> │     pre-existing file at run start
            └──────────────────────────────────────────┘
                                │
                                ▼  (per execute_code cell)
            ┌──────────────────────────────────────────┐
            │ harvest_output_files(... previous_files=  │
            │   _previous_files_in_run ...)             │
            │   walks /sandbox/output/, hashes each     │
            │   file, SKIPS any hash already in baseline│  ← existing dedup (sandbox_service.py:349)
            └──────────────────────────────────────────┘
                                │
                                ▼
              delta_files = ONLY files this run created
              (stale workflow .docx excluded — its hash was seeded)

  Harness mirror (D-120-03): identical seeding at harness/phase_types.py:343
  (per-phase ctx build) — snapshot BEFORE the phase runs its execute_code so a
  PRIOR phase's leftover is excluded but THIS phase's own deliverable is kept.
```

### System Architecture Diagram — CTX-01 (origin tag + filter)

```
  INSERT PATHS (tag origin at write)                  HISTORY READ (filter at query)
  ─────────────────────────────────                  ──────────────────────────────
  Deep user msg ─ threads.py:1020 (role=user, NO tag needed*)
  Deep asst msg ─┐
  Harness asst ──┤ insert_assistant_message(db/runs.py:145)   agent_loop.py:1024
                 │  + NEW origin param (default 'deep';   ─►   SELECT ... FROM messages
                 │  harness callers pass 'harness')             WHERE thread_id=? AND user_id=?
  Deep sys warn ─ agent_loop.py:209, :1269 (role=system)         AND  ┌─ Deep:    origin <> 'harness'
  Deep ask_user ─ tool_dispatcher.py:2548 (role=system)               └─ Harness: origin = 'harness'
  Harness ask_user ─ phase_types.py:629, harness_engine.py:889         ORDER BY created_at
  Harness expiry ─ harness_engine.py:225 (raw SQL)                          │
  ask_user reply ─ runs.py:580 (role=system, BOTH paths**)                  ▼
                                                              _reconstruct_history(rows, provider)
  * user rows are replayed by BOTH modes → leave 'deep'        (PROVIDER-AGNOSTIC — same filtered
    (Deep filter is origin<>'harness'; user='deep' passes;      row set feeds every provider; Deep
    Harness deliberately does NOT replay the Deep user turn).   pure-thread row set == today → byte-identical)
  ** runs.py:580 must tag by the run's mode (see Q3).
```

### Recommended Project Structure
No new files required for the production code. Add ONE small pure helper to `sandbox_service.py` (snapshot+hash). Migration `076_messages_origin.sql`. New test file(s) under `backend/tests/`.

```
backend/app/services/sandbox_service.py   # + snapshot_output_baseline() helper (pure-ish; container I/O)
backend/app/services/agent_loop.py        # :1316 seed Deep baseline; :1024 filter query (origin <> 'harness')
backend/app/services/harness/phase_types.py  # :343 seed Harness per-phase baseline
backend/app/db/runs.py                     # insert_assistant_message: + origin param
backend/app/services/harness_engine.py     # :439/:513 pass origin='harness'; :225 raw INSERT add origin
backend/app/services/tool_dispatcher.py    # :2548 ask_user prompt origin
backend/app/api/runs.py                    # :580 ask_user_response origin (mode-aware)
supabase/migrations/076_messages_origin.sql   # ADD COLUMN origin
backend/tests/test_120_collision_regression.py  # headline live-repro test (D-120-08)
backend/tests/test_120_origin_filter.py          # CTX-01 asymmetric filter + Deep byte-identical
```

### Pattern 1: Seed the harvest baseline by snapshotting + hashing existing files
**What:** Before the first harvest of a run, list `/sandbox/output/` and SHA-256 every file, building the same `{content_hash: meta}` dict shape `harvest_output_files` already consumes as `previous_files`.
**When to use:** At Deep run start (`agent_loop.py:1316`) and at Harness per-phase ctx build (`phase_types.py:343`).
**Example:**
```python
# Source: derived from sandbox_service.harvest_output_files (sandbox_service.py:251-326)
# New helper — runs container I/O, so callers wrap with run_in_threadpool (D-v2.5-01).
def snapshot_output_baseline(session) -> dict[str, dict]:
    """List + SHA-256 every file already in /sandbox/output/ so the run's
    harvest excludes pre-existing files. Returns the {hash: meta} dict shape
    harvest_output_files consumes as `previous_files`. Best-effort: an empty
    /sandbox/output/ (or a copy failure) returns {} — identical to today."""
    baseline: dict[str, dict] = {}
    try:
        session.execute_command("mkdir -p /sandbox/output")
    except Exception:
        pass
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            session.copy_from_runtime("/sandbox/output", tmpdir)
            for root, _dirs, files in os.walk(tmpdir):
                for fname in files:
                    with open(os.path.join(root, fname), "rb") as f:
                        data = f.read()
                    h = hashlib.sha256(data).hexdigest()
                    baseline[h] = {"filename": fname, "url": None,
                                   "size": len(data), "iteration": -1}  # -1 = pre-run
    except Exception:
        pass  # no baseline = legacy behavior; never blocks the run
    return baseline
```
```python
# Source: agent_loop.py:1316 — Deep seed
session = sandbox_manager.get_or_create(thread_id)
_previous_files_in_run: dict[str, dict] = await run_in_threadpool(
    snapshot_output_baseline, session
)
```

### Pattern 2: Add an `origin` parameter to the shared assistant-message helper
**What:** The single highest-leverage tag — `insert_assistant_message` is the ONE persist path for both Deep and Harness final answers.
**When to use:** Tag the helper once; each caller declares its mode.
**Example:**
```python
# Source: db/runs.py:145-190 (extended)
async def insert_assistant_message(
    pool, *, thread_id, user_id, content,
    tool_calls=None, source_refs=None,
    confidence_level=None, confidence_avg_similarity=None,
    confidence_disclaimer=None, reasoning_content=None,
    origin: str = "deep",   # NEW — default keeps every existing Deep caller correct
) -> UUID:
    return await pool.fetchval(
        """
        INSERT INTO messages (
            thread_id, user_id, role, content, tool_calls, source_refs,
            confidence_level, confidence_avg_similarity, confidence_disclaimer,
            reasoning_content, origin
        )
        VALUES ($1, $2, 'assistant', $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
        """,
        thread_id, user_id, content, tool_calls, source_refs,
        confidence_level, confidence_avg_similarity, confidence_disclaimer,
        reasoning_content, origin,
    )
# Harness callers (harness_engine.py:439 success, :513 failure) pass origin="harness".
# Deep caller (agent_loop.py:1226) passes nothing → 'deep'.
```

### Pattern 3: Asymmetric, provider-agnostic history filter at the query
**What:** Reduce the row set BEFORE `_reconstruct_history`. Deep gets `origin <> 'harness'`; Harness gets `origin = 'harness'`.
**When to use:** At `agent_loop.py:1024`. The Harness reconstruction path (if it reads history via the same query) must invert.
**Example:**
```python
# Source: agent_loop.py:1024 (extended) — DEEP path
_history_q = (
    supabase.table("messages")
    .select("role, content, tool_calls, reasoning_content")  # origin NOT selected — pure filter
    .eq("thread_id", thread_id)
    .eq("user_id", current_user["id"])
)
if body.agent_mode != "harness":   # Deep / Explorer
    _history_q = _history_q.neq("origin", "harness")  # deep OR legacy/NULL → replays
else:                              # Harness
    _history_q = _history_q.eq("origin", "harness")
history_resp = await aexec(_history_q.order("created_at"))
```
> **NOTE on NULL semantics:** Postgres `<>` and `=` both return UNKNOWN (not TRUE) for NULL, so a NULL `origin` would be EXCLUDED by `neq('origin','harness')`. **This is why D-120-04's `DEFAULT 'deep'` is load-bearing** — because the column is added WITH a default, existing rows are FILLED with `'deep'` (verified, Open Question 2), so there are NO NULLs in practice and `neq('origin','harness')` correctly replays them. If the planner ever switches to a no-default add (do NOT), the filter must become `.or_("origin.is.null,origin.neq.harness")`.

### Anti-Patterns to Avoid
- **Clearing `/sandbox/output/` at the mode boundary** — explicitly rejected (D-120-02). Destroys files the user may still want.
- **Per-cell baseline reset** — would drop a multi-cell run's own intermediates (D-120-01 scope is per-RUN). Seed ONCE at run start, then let the existing per-cell `_previous_files_in_run.update(_iter_files)` accumulate.
- **Putting the filter in `threads.py`** — G-5 violation; the filter lives at `agent_loop.py:1024` (D-120-07).
- **Forking `_reconstruct_history` per provider** — RED LINE. The filter is row-level; reconstruction is unchanged and provider-agnostic.
- **Selecting `origin` into the reconstructed message dict** — it must stay a pure WHERE filter; do not add it to the `.select()` projection or pass it into `_reconstruct_history` (would risk altering reconstruction shape).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Excluding pre-existing files from the harvest delta | A new filename-based "is this file new?" comparison | Seed the EXISTING `previous_files` hash-dedup (`sandbox_service.py:333-361`) | The hash-dedup already does exactly this; filename comparison was explicitly rejected by the live evidence (both files shared one execution_id; filename heuristic returned NONE). |
| Detecting "files created this run" | mtime arithmetic / container clock comparison | Content-hash snapshot at run start | Reuses the authoritative dedup key; immune to clock skew and same-second overwrites. |
| Legacy-row "behave as Deep" backfill | An `UPDATE messages SET origin='deep' WHERE origin IS NULL` migration step | `ADD COLUMN ... DEFAULT 'deep'` (fills existing rows) | Postgres fills existing rows with the DEFAULT automatically (verified); no separate UPDATE needed; D-120-05 rejected join-based backfill. |
| Tagging every Deep/Harness final answer | Tagging at each call site independently | The shared `insert_assistant_message` `origin` param | One helper is the single persist path for both modes; tag once. |

**Key insight:** COLL-01 is *seeding* an existing baseline, and CTX-01's legacy semantics are *delegated to Postgres DEFAULT* — both fixes are deliberately minimal additions to machinery that already exists, matching the COLL-03 evidence's "smallest blast radius" prescription.

## Runtime State Inventory

> This is partly a data-isolation phase (not a rename), but the "stale state on disk / in DB" lens applies directly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `messages` rows for pre-migration mixed Deep+Harness threads carry NO origin. After migration 076 they are FILLED with `'deep'` (DEFAULT). D-120-05 accepts this — legacy harness rows in old mixed threads will replay into Deep (status quo, the safe direction). | None — intentional per D-120-05. |
| Stored data | Stale `/sandbox/output/` files persist on disk in active sandbox containers (e.g. the live thread `99af24d5`'s `weekly-status-report.docx`). D-120-02: do NOT clear them. The fix only stops RE-EMITTING them. | None — files stay; baseline excludes them from future emits. |
| Live service config | None — no external service config embeds Deep/Harness origin. | None — verified by scope (this is internal app state only). |
| OS-registered state | None — no OS-level registration involved. | None. |
| Secrets/env vars | None — no env var references the origin field or the harvest baseline. | None. |
| Build artifacts | `full-schema.sql` must be regenerated after migration 076 (`bash scripts/regenerate-full-schema.sh`, no `--reset`). Never hand-edit. | Regenerate-schema step (a plan task). |

**Sandbox-cache nuance:** Sandbox sessions are cached per `thread_id` until idle eviction (~30 min). The COLL-01 fix takes effect on the NEXT run in a thread (the run-start snapshot runs every run). Existing in-flight cached containers are unaffected until their next run — acceptable (the fix is per-run, not per-container).

## Common Pitfalls

### Pitfall 1: NULL `origin` silently excluded by `<>`/`neq` (the legacy-row trap)
**What goes wrong:** If `origin` were nullable with NO default, `neq('origin','harness')` would exclude NULL rows (Postgres three-valued logic: `NULL <> 'harness'` → UNKNOWN → not selected), silently dropping ALL legacy history from Deep replay — a severe regression.
**Why it happens:** Three-valued boolean logic on NULL.
**How to avoid:** `ADD COLUMN ... DEFAULT 'deep'` fills existing rows with `'deep'` (verified), so no NULLs exist. Confirm in the migration's validation that `SELECT count(*) FROM messages WHERE origin IS NULL` returns 0 post-migration.
**Warning signs:** A loaded old Deep thread suddenly loses all prior turns after the migration.

### Pitfall 2: Harness deliverable excluded from its own run (over-seeding)
**What goes wrong:** If the Harness baseline is snapshotted AFTER the phase writes its render output (or at the wrong scope), the phase's own legitimate `.docx` gets seeded into the baseline and excluded from emit.
**Why it happens:** Wrong timing of the snapshot relative to the phase's `execute_code`.
**How to avoid:** Snapshot at `_build_phase_tool_context` (`phase_types.py:343`) — BEFORE the phase's tool dispatch runs. A prior phase's leftover is on disk → excluded; this phase's output is written AFTER → kept. D-120-03 explicitly warns against this.
**Warning signs:** A workflow render reports "Produced the filled deliverable" but `output_files` is empty.

### Pitfall 3: Missing a Harness insert site → its row defaults to `'deep'` → bleeds into Deep replay
**What goes wrong:** Any UNTAGGED Harness insert takes `DEFAULT 'deep'` and then replays into a subsequent Deep turn — exactly the bleed CTX-01 must stop.
**Why it happens:** The insert-site list in D-120-07 was incomplete (it omitted `harness_engine.py:225` and the shared `insert_assistant_message` mechanism).
**How to avoid:** Use the EXHAUSTIVE enumeration in Open Question 3. The dangerous direction is an untagged HARNESS row (defaults to 'deep' → leaks into Deep). An untagged DEEP row is harmless (it would be 'deep' anyway).
**Warning signs:** A Deep turn after a workflow phase replays a workflow's intermediate reasoning.

### Pitfall 4: Selecting `origin` into the reconstruction projection changes Deep behavior
**What goes wrong:** Adding `origin` to the `.select(...)` and threading it into `_reconstruct_history` could subtly change the message dict shape and break the byte-identical guarantee.
**How to avoid:** Keep `origin` a pure WHERE filter; do NOT add it to the SELECT projection. The reconstructed messages are built from `role, content, tool_calls, reasoning_content` exactly as today.
**Warning signs:** Deep Mode regression on the native-7 (SC#10 fails).

### Pitfall 5: `harness_engine.py:225` raw SQL INSERT omits the new column
**What goes wrong:** This raw `INSERT INTO messages (thread_id, user_id, role, content, tool_calls)` (ask_user expiry, Harness terminal) doesn't list `origin` → takes DEFAULT `'deep'` → a Harness expiry row leaks into Deep replay.
**How to avoid:** Add `origin` to this raw INSERT's column list + values, with `'harness'`. (It's a Harness-context row — the run's mode is Harness.)
**Warning signs:** Hard to spot — caught only by the exhaustive enumeration.

## Code Examples

### Headline regression test (D-120-08) — faithful live-repro
```python
# Source: modeled on test_075_4_dedup_supersedes.py + test_sandbox_service.py
# Mirrors thread 99af24d5: a workflow leftover .docx already on disk +
# a skill execute_code that saves exactly ONE file → emit must contain ONLY the one file.
import hashlib, os
from unittest.mock import MagicMock
from app.services.sandbox_service import harvest_output_files, snapshot_output_baseline

STALE = b"x" * 37328          # the workflow's leftover weekly-status-report.docx (37,328 B)
SKILL = b"y" * 11545          # the skill's real Weekly_Report_2026-06-20.docx (11,545 B)

def _session_with(files: dict[str, bytes]):
    def _copy(_src, tmpdir):
        for fn, payload in files.items():
            with open(os.path.join(tmpdir, fn), "wb") as f:
                f.write(payload)
    s = MagicMock(); s.execute_command = MagicMock()
    s.copy_from_runtime = MagicMock(side_effect=_copy)
    return s

def test_stale_workflow_file_excluded_from_skill_emit():
    # 1. Run start: /sandbox/output/ ALREADY holds the workflow leftover.
    snap_session = _session_with({"weekly-status-report.docx": STALE})
    baseline = snapshot_output_baseline(snap_session)
    assert hashlib.sha256(STALE).hexdigest() in baseline   # leftover is seeded

    # 2. Skill execute_code saves exactly ONE new file (and the leftover still on disk).
    harvest_session = _session_with({
        "weekly-status-report.docx": STALE,                 # still there
        "Weekly_Report_2026-06-20.docx": SKILL,             # the skill's real output
    })
    sb = MagicMock()
    sb.storage.from_.return_value.upload = MagicMock()
    sb.table.return_value.insert.return_value.execute = MagicMock()

    delta, _current = harvest_output_files(
        session=harvest_session, execution_id="e13687e4", user_id="u-1",
        supabase=sb, previous_files=baseline, iteration=0,
    )
    # 3. EXACTLY the one skill file — the stale leftover is excluded.
    assert [f["filename"] for f in delta] == ["Weekly_Report_2026-06-20.docx"]
    assert all(f["filename"] != "weekly-status-report.docx" for f in delta)

# FAILS BEFORE the fix: with baseline={} (today's empty init) the delta would
# contain BOTH files (the exact 2-files bug). PASSES AFTER seeding.
```
> **Test-faithfulness note:** This reproduces the TRUE signature (one execution_id emitting MORE files than the code wrote), NOT the rejected "same filename across two execution_ids" heuristic. The byte sizes match the live evidence anchor.

### Deep byte-identical guard (CTX-01)
```python
# A pure-Deep thread (no harness rows) must produce the IDENTICAL filtered row set.
def test_deep_pure_thread_filter_is_noop():
    # Given rows all origin='deep' (or legacy filled to 'deep'), neq('origin','harness')
    # returns ALL of them — same set as the unfiltered today path.
    # Assert the query builder applied .neq('origin','harness') AND the resulting
    # row set equals the unfiltered set when no harness rows exist.
    ...
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `harvest_output_files` returned ALL files on disk (filename-set dedup) | Content-hash `previous_files` dedup with per-run accumulation | Phase 075.4 (D-075.4-D1/D2) | The dedup machinery COLL-01 reuses already exists; only the run-start SEED is missing. |
| `_reconstruct_history(rows, active_provider)` had provider-gated `thought_signature` handling | `active_provider` is "no longer load-bearing" (non-Google providers ignore the field); signature handling moved into provider services | Phase 075.5 (D-075.5-01) | Confirms the filter can be provider-agnostic — reconstruction reads stored fields uniformly. |
| `messages.role IN ('user','assistant')` | `role IN ('user','assistant','system')` | Migration 048 | system-role ask_user/warning rows are real `messages` rows → they DO flow into the history query and need origin tagging. |
| Postgres pre-11 `ADD COLUMN DEFAULT` rewrote the whole table | Postgres 11+ stores the default in the catalog (fast, metadata-only) | PG 11 | Migration 076 is a fast metadata-only operation even on a large `messages` table; existing rows return the catalog default on read. |

**Deprecated/outdated:**
- The "same filename across two execution_ids" collision heuristic — explicitly disproven by the live evidence (COLL-03-EVIDENCE.md §Refinement 1). Do not use.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The Harness reconstruction path reads thread history via (or analogous to) the `agent_loop.py:1024` query, so the `origin = 'harness'` inversion can be applied there. | Pattern 3 / Open Q4 | If Harness reconstructs history through a different code path, the planner must locate that path and apply the strict `= 'harness'` filter there instead. **Planner must confirm the Harness history-read site during planning** (the Deep query at :1024 is confirmed; the Harness read path was not exhaustively traced in this session). |
| A2 | `runs.py:580` (ask_user_response) serves BOTH Deep and workflow paths and must tag origin by the run's actual mode. | Open Q3 | If it can be unambiguously attributed to one mode, tagging simplifies. Mis-tagging a workflow reply as 'deep' is the safe direction; mis-tagging a Deep reply as 'harness' would drop it from Deep replay — planner must derive mode from the run/workflow_run lookup already present in that handler. |
| A3 | No additional `messages` insert site exists outside the 8 enumerated (greps covered `.table("messages").insert`, `INSERT INTO messages`, and the shared helper). | Open Q3 | A missed Harness site → leak into Deep. Mitigation: the planner should re-run the three greps as a verification step and a test asserting every insert site passes an explicit `origin`. |

## Open Questions

### 1. Baseline-seeding mechanism for COLL-01 — RESOLVED: snapshot + content-hash at run start
**Recommendation:** **Mechanism (a)** — snapshot the `/sandbox/output/` directory listing and SHA-256 each file at run start, seeding `previous_files` with `{hash: meta}`. Reject mechanism (b) mtime-filtering.
**Why:** (1) It reuses the EXISTING dedup key (`sandbox_service.py:280` already hashes every harvested file) — a seeded baseline entry and a later harvested entry collide on the identical key with zero new comparison logic. (2) mtime is coarse (filesystem timestamp resolution, container clock skew, same-second overwrite). (3) The contract "only emit files THIS run created" is satisfied exactly: any file whose bytes existed at run start is excluded by hash.
**Where the baseline is seeded (covers BOTH run paths — D-120-03):**
- **Deep:** `agent_loop.py:1316` — replace `_previous_files_in_run: dict[str, dict] = {}` with `_previous_files_in_run = await run_in_threadpool(snapshot_output_baseline, session)`. Scope = per-RUN (seeded once; per-cell `.update(_iter_files)` accumulation unchanged).
- **Harness:** `harness/phase_types.py:343` — replace `previous_files_in_run={}` with the seeded snapshot, computed at the per-PHASE ctx build (which runs BEFORE the phase's `execute_code`). This excludes a PRIOR phase's leftover but keeps THIS phase's own deliverable (written during dispatch, after the snapshot). Per-phase scope is correct for harness because each phase builds its own ToolContext.
- **Resume paths:** `agent_loop.py:1366` and `:2049` build a `ToolContext` reusing `_previous_files_in_run` — they inherit the seeded baseline automatically (no extra change needed since they reference the same closure var).
**Edge case:** Empty `/sandbox/output/` or a copy failure → `snapshot_output_baseline` returns `{}` = today's exact behavior. Never blocks the run.

### 2. Postgres `ADD COLUMN ... DEFAULT 'deep'` semantics — RESOLVED: existing rows are FILLED with `'deep'`
**Finding (verified against official Postgres docs):** When you `ALTER TABLE ... ADD COLUMN ... DEFAULT <value>`, **all existing rows are initialized with the column's default value** (NULL only if no DEFAULT is given). In Postgres 11+ this is a fast metadata-only operation (the default is stored in the catalog and returned for pre-existing rows on read) — no full table rewrite. The CHECK constraint is validated immediately and `'deep'` satisfies `origin IN ('deep','harness')`, so the ADD succeeds and **there are NO NULL `origin` rows post-migration.**
**Implication for the asymmetric filter (D-120-06):** Because existing rows are `'deep'` (not NULL):
- Deep filter `origin <> 'harness'` (i.e. `neq('origin','harness')`) correctly replays all legacy rows (they are `'deep'`). ✓
- Harness filter `origin = 'harness'` correctly excludes them. ✓
- The CHECK constraint cannot reject pre-existing rows — they are filled with a valid value before the constraint is evaluated. ✓
**Migration shape (recommended):**
```sql
-- 076_messages_origin.sql
-- Idempotent: IF NOT EXISTS guards re-application (matches migration 050 style).
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'deep';

-- Add the CHECK separately so re-runs don't error on a duplicate constraint.
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_origin_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_origin_check CHECK (origin IN ('deep','harness'));
-- RLS: messages is already RLS-bound to thread owner; the new column inherits
-- the existing policy — no new policy (precedent: migration 050 reasoning_content).
```
> `NOT NULL` is recommended (with the DEFAULT it's safe — existing rows are filled, and every insert site will pass a value or take the default). This eliminates the three-valued-logic NULL trap (Pitfall 1) at the schema level. If the planner prefers nullable for maximum caution, the Deep filter must become `.or_("origin.is.null,origin.neq.harness")`.

### 3. Exhaustive message insert-site enumeration — RESOLVED
Greps run: `\.table("messages")\.insert`, `INSERT INTO messages`, and the shared `insert_assistant_message` helper. **Complete list (8 logical sites; D-120-07's list was incomplete — it omitted the shared helper and `harness_engine.py:225`):**

| # | Site | Role | Mode | How to tag | Direction if missed |
|---|------|------|------|------------|---------------------|
| 1 | `db/runs.py:145` `insert_assistant_message` (SHARED helper) | assistant | BOTH | Add `origin` param (default `'deep'`). Called by Deep `agent_loop.py:1226` (→ default) AND Harness `harness_engine.py:439`/`:513` (→ pass `'harness'`). | **DANGEROUS if Harness caller not updated** — harness final answer defaults to 'deep' → bleeds into Deep AND fails to replay in Harness. |
| 2 | `api/threads.py:1020` | **user** | Deep | Leave `'deep'` (default). **No code change needed** — user rows are intentionally replayed by Deep only (Harness deliberately does NOT replay the Deep user turn). G-5 hot file: do NOT touch. | Harmless — user='deep' replays in Deep (correct); excluded from Harness (correct). |
| 3 | `agent_loop.py:209` | system (cap_paused carrier) | Deep | Default `'deep'` is correct; optionally tag explicitly per D-120-07. | Harmless (Deep row → 'deep'). |
| 4 | `agent_loop.py:1269` | system (warning) | Deep | Default `'deep'` correct; optionally tag explicitly. | Harmless. |
| 5 | `tool_dispatcher.py:2548` | system (ask_user_prompt) | Deep | Tag `'deep'` (Deep ask_user path). | Harmless (defaults 'deep'). |
| 6 | `harness/phase_types.py:629` | system (ask_user_prompt) | **Harness** (`_exec_llm_human_input`) | Tag `'harness'`. | **DANGEROUS if missed** — harness ask_user prompt → 'deep' → leaks into Deep replay + missing from Harness replay. |
| 7 | `harness_engine.py:889` | system (ask_user_prompt) | **Harness** (ask_user disposition) | Tag `'harness'`. | **DANGEROUS if missed.** |
| 8 | `harness_engine.py:225` (raw SQL) | system (ask_user expiry, `expired:True`) | **Harness** | Add `origin` column + `'harness'` to the raw INSERT. | **DANGEROUS if missed** (NOT in D-120-07's list). |
| 9 | `api/runs.py:580` | system (ask_user_response) | **BOTH** (workflow_run + Deep) | Tag by the run's mode (the handler already looks up the run/workflow_run — derive mode there). See A2. | Mis-tag Deep→'harness' drops the reply from Deep replay; mis-tag workflow→'deep' is safe. |

**Test-fixture / non-production:** `api/test_fixtures.py:103` is a dev-only fixture endpoint — tag `'deep'` for consistency, non-load-bearing.

**`tool` and sub-agent rows:** There is NO separate `role='tool'` insert into `messages` — tool results are stored inside the assistant row's `tool_calls` jsonb and reconstructed by `_reconstruct_history` (`agent_loop.py:782`). So tool results inherit the assistant row's `origin` automatically (no extra tagging). Sub-agent (`task`) rows persist their final answer through the SAME `insert_assistant_message` helper → inherit `origin` from the caller's mode.

**The asymmetry of risk (per the objective):** An untagged **Harness** row (sites 1-Harness, 6, 7, 8, 9-workflow) defaults to `'deep'` → leaks into Deep replay (the bug we are fixing) AND fails to replay in its own Harness phase. An untagged **Deep** row defaults to `'deep'` → correct (no harm). So the planner's verification MUST prioritize confirming every HARNESS site is tagged.

### 4. Provider-specific `_reconstruct_history` behavior — RESOLVED: filter is provider-agnostic
**Finding:** `_reconstruct_history(history_rows, active_provider)` (`agent_loop.py:723`) reads ONLY the stored row fields (`role, content, tool_calls, reasoning_content`) and rebuilds an OpenAI-compatible message list. The docstring (D-075.5-01) states `active_provider` is "no longer load-bearing (non-Google providers ignore the field)"; provider-specific handling (Google `thought_signature`, DeepSeek `reasoning_content`) lives downstream in `google_service.py` / provider services and reads the SAME fields off the reconstructed messages — unchanged by this phase.
**Therefore:** CTX-01 is a **pre-query, row-level filter at `agent_loop.py:1024`** that reduces WHICH rows enter `_reconstruct_history`. The same filtered row set feeds every provider's reconstruction → no shared-path fork. For any **pure-Deep thread** (no harness rows), `neq('origin','harness')` returns the IDENTICAL set as today's unfiltered query → **Deep Mode is byte-identical on the native-7**. Row COUNT/ORDERING only changes for mixed Deep+Harness threads, which is the intended behavior (and those rows were never supposed to cross modes).
**Provider flag to watch:** The only place row-count change could matter is DeepSeek (requires `reasoning_content` round-trip) — but the filter never drops a Deep row from a Deep thread, so the DeepSeek round-trip is preserved. No provider is at risk in the Deep path. **Confirm during planning:** the Harness reconstruction read site (A1) — apply the strict `= 'harness'` filter wherever Harness reads thread history.
**Red line satisfied:** No fork in the shared path; the filter is a single WHERE clause that is provider-independent.

### 5. SC#10 4-axis + headline regression test — RESOLVED (see Validation Architecture)
The headline test construction is in the Code Examples section and Validation Architecture below. It reproduces the EXACT live signature (one execution_id emitting more files than the code wrote) using the existing `fake_copy`/`_build_mock_session_with_payloads` scaffold. SC#10 4-axis matrix is in the Validation Architecture's Sampling/UAT section.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Postgres (Supabase local) | Migration 076 apply + integration tests | ✓ (per CLAUDE.md local-dev infra, :54322) | 15.x (Supabase CLI) | — |
| `pytest` (+ pytest-asyncio) | All tests (`asyncio_mode=auto`) | ✓ (`backend/pytest.ini`, extensive existing suite) | pinned | — |
| Docker / `llm_sandbox` | The headline regression test MOCKS the session — Docker NOT required for the unit test | ✓ (mocked) | — | Unit test uses `MagicMock` session (no Docker); live UAT (D-120-09) needs the running sandbox. |
| Supabase SQL editor | Applying migration 076 by hand (CLAUDE.md mandate) | ✓ (operator action) | — | Never `db push`/`db reset`. |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** Docker is not needed for the headline unit test (session mocked); it IS needed for the live UAT re-run of thread `99af24d5`.

## Validation Architecture

> nyquist_validation is `true` (`.planning/config.json`). This section is mandatory.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio (`asyncio_mode = auto`) |
| Config file | `backend/pytest.ini` |
| Quick run command | `cd backend && python -m pytest tests/test_120_collision_regression.py tests/test_120_origin_filter.py -x` |
| Full suite command | `cd backend && python -m pytest tests/ -q` |

### Phase Requirements / Success Criteria → Test Map
| SC | Behavior | Test Type | Automated Command | File Exists? |
|----|----------|-----------|-------------------|-------------|
| SC#1 (COLL-01) | Skill `execute_code` saving one file in a post-workflow thread emits EXACTLY that one file (stale leftover excluded). **Headline live-repro (D-120-08).** | unit | `pytest tests/test_120_collision_regression.py::test_stale_workflow_file_excluded_from_skill_emit -x` | ❌ Wave 0 |
| SC#1 (negative/guard) | With the OLD empty baseline, the same scenario emits BOTH files (proves the test fails before the fix). | unit | `pytest tests/test_120_collision_regression.py::test_empty_baseline_emits_both_files_pre_fix -x` | ❌ Wave 0 |
| SC#2 (COLL-01) | `snapshot_output_baseline` seeds every pre-existing file's hash; any file present before run start is excluded from the delta. Empty dir → `{}`. | unit | `pytest tests/test_120_collision_regression.py::test_snapshot_seeds_existing_files -x` | ❌ Wave 0 |
| SC#2 (Harness symmetry, D-120-03) | A Harness per-phase baseline excludes a PRIOR phase's leftover but keeps THIS phase's own deliverable. | unit | `pytest tests/test_120_collision_regression.py::test_harness_phase_keeps_own_output -x` | ❌ Wave 0 |
| SC#3 (CTX-01) | Migration 076: post-apply, every existing row has `origin='deep'` (zero NULLs); CHECK accepts deep/harness, rejects other. | integration (live DB) | `pytest tests/integration/test_120_migration.py -x` | ❌ Wave 0 |
| SC#3 (CTX-01) | Deep filter replays `origin <> 'harness'` (deep + legacy); Harness filter replays `origin = 'harness'` strictly — assert the query builder applied the right clause per mode. | unit | `pytest tests/test_120_origin_filter.py::test_asymmetric_filter_per_mode -x` | ❌ Wave 0 |
| SC#3 (CTX-01) | Every enumerated insert site passes an explicit/defaulted origin; HARNESS sites pass `'harness'`. | unit (source/behavior) | `pytest tests/test_120_origin_filter.py::test_harness_sites_tag_harness -x` | ❌ Wave 0 |
| SC#4 (Deep byte-identical) | A pure-Deep thread (no harness rows) yields the IDENTICAL filtered row set as the unfiltered query (no Deep regression). | unit | `pytest tests/test_120_origin_filter.py::test_deep_pure_thread_filter_is_noop -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/test_120_collision_regression.py tests/test_120_origin_filter.py -x` (< 10 s, mocked sessions)
- **Per wave merge:** `cd backend && python -m pytest tests/ -q` (full backend suite; watch for regressions in `test_075_4_*`, `test_dual_mode_wiring.py`, `test_093_surfacing.py` which exercise the harvest + shared persist helper)
- **Phase gate:** Full suite green + migration 076 applied to live DB + `full-schema.sql` regenerated, before `/gsd:verify-work`.

### Headline live-repro regression test (D-120-08) — construction
Use the existing `_build_mock_session_with_payloads` / `fake_copy` scaffold (`test_075_4_dedup_supersedes.py`, `test_sandbox_service.py`). Reproduce thread `99af24d5`:
1. Run-start session holds `weekly-status-report.docx` (37,328 B) → `snapshot_output_baseline` seeds its hash.
2. Harvest session holds BOTH the leftover AND `Weekly_Report_2026-06-20.docx` (11,545 B, the only file the code wrote).
3. Assert delta == `["Weekly_Report_2026-06-20.docx"]` exactly; the stale leftover is absent.
4. Companion negative test: with `previous_files={}` (the pre-fix empty init), delta contains BOTH → proves the test FAILS before the fix.
This reproduces the TRUE signature (one execution_id, more output_files than the code wrote), not the rejected same-filename-across-two-execution_ids heuristic.

### SC#10 4-axis matrix (D-120-09) — VALIDATION.md UAT rows (manual / live)
Per CLAUDE.md UAT recipe — authored under VALIDATION.md, NOT PLAN.md tasks. The collision fix touches the agent loop + sandbox harvest + history reconstruction, so all 4 axes apply:

| Axis | Required coverage | How |
|------|-------------------|-----|
| Cross-provider | One representative per provider: OpenAI, Anthropic, Google, OpenRouter (native-7) | Run the live repro (workflow render → Deep skill `execute_code`) on each; assert exactly one file emitted + Deep history clean. |
| Multi-tool | ≥1 prompt exercising 2+ tools (e.g. `search_documents` + `execute_code`) in the post-workflow Deep turn | Confirm only the new file emits and harness rows don't replay. |
| Parallel-thread | Thread A (workflow) streaming while Thread B accepts a new Deep prompt | Confirm baselines/origin filters are thread-scoped (no cross-thread bleed). |
| Long-message | A post-workflow thread with ≥50 prior messages (mixed Deep + harness origin) | Confirm Deep replays only deep+legacy rows and the new skill file emits cleanly. |

**Live UAT confirmation (D-120-09):** re-run the actual thread `99af24d5` (or an equivalent reproduction) end-to-end as the manual confirmation that the live bug is gone, with Deep Mode proven byte-identical on the native-7.

### Wave 0 Gaps
- [ ] `backend/tests/test_120_collision_regression.py` — covers SC#1, SC#2 (+ negative pre-fix guard, Harness symmetry)
- [ ] `backend/tests/test_120_origin_filter.py` — covers SC#3 (asymmetric filter, harness-site tagging), SC#4 (Deep byte-identical)
- [ ] `backend/tests/integration/test_120_migration.py` — covers SC#3 migration semantics against live DB (zero NULL origin, CHECK behavior)
- [ ] No framework install needed — pytest + pytest-asyncio already in use.

## Security Domain

> `security_enforcement` not set to false in config → included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth change. |
| V3 Session Management | no | No session change. |
| V4 Access Control | **yes** | The history query at `agent_loop.py:1024` MUST keep `.eq("user_id", current_user["id"])` AND `.eq("thread_id", thread_id)` — the new `origin` filter is ADDITIVE and must never relax owner/thread scoping. `messages` RLS (thread owner) is unchanged; the new column inherits the existing policy. The harvest baseline snapshot reads the thread's OWN container (`sandbox_manager.get_or_create(thread_id)`) — no cross-thread/cross-user read. |
| V5 Input Validation | **yes** | `origin` is a server-set enum (never user input); CHECK constraint `IN ('deep','harness')` enforces the domain at the DB. The asymmetric filter values are literals, not user-supplied. |
| V6 Cryptography | no | SHA-256 use is for dedup, not security; no key handling. |

### Known Threat Patterns for {FastAPI + Supabase + sandbox harvest}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Origin filter accidentally drops the owner/thread scope (IDOR via broadened query) | Information Disclosure / Elevation | Keep `.eq(user_id)` + `.eq(thread_id)`; add `origin` as an extra `.neq`/`.eq` only. Verify with a cross-user/cross-thread test that the filter never widens scope. |
| Harness row defaults to 'deep' and leaks workflow context into a later Deep turn | Information Disclosure (context bleed) | Exhaustive harness-site tagging (Open Q3); test asserts harness sites tag `'harness'`. |
| SQL injection via raw INSERT at `harness_engine.py:225` when adding `origin` | Tampering | Use `$N` positional placeholders (the file already does — keep the literal `'harness'` or bind it positionally; never f-string). |
| Snapshot helper reading another thread's container | Information Disclosure | Snapshot reads the session from `sandbox_manager.get_or_create(thread_id)` — the same thread-keyed container the run already uses; no new attack surface. |

## Sources

### Primary (HIGH confidence)
- `backend/app/services/sandbox_service.py:201-361` — `harvest_output_files` + content-hash dedup baseline (the COLL-01 seam).
- `backend/app/services/agent_loop.py:723` (`_reconstruct_history`), `:1024` (history query), `:1118-1128` (reconstruction call), `:1316` (Deep empty baseline init), `:209`/`:1269` (Deep system inserts), `:1226` (shared persist call).
- `backend/app/services/harness/phase_types.py:343` (Harness empty baseline init in per-phase ctx build), `:629` (harness ask_user prompt).
- `backend/app/services/harness_engine.py:225` (raw ask_user-expiry INSERT), `:439`/`:513` (harness final-answer + failure persist via shared helper), `:889` (harness ask_user prompt).
- `backend/app/db/runs.py:145-190` — `insert_assistant_message` (the SHARED Deep+Harness persist path).
- `backend/app/services/tool_dispatcher.py:864-1146` — `execute_code` handler + `_previous_files_in_run` wiring + harvest call (:1139).
- `backend/app/api/threads.py:1020` (user-message insert), `api/runs.py:580` (ask_user_response, both paths).
- `supabase/full-schema.sql:601-616` (messages table + role CHECK), `supabase/migrations/048`, `050` (column/CHECK migration precedents).
- `backend/tests/unit/test_075_4_dedup_supersedes.py`, `backend/tests/unit/test_sandbox_service.py` — the headline-test scaffold.
- `.planning/research/v3.1-skills-eval/COLL-03-EVIDENCE.md` — live root-cause (Mechanism A, thread 99af24d5).
- `.planning/research/v3.1-skills-eval/CONSOLIDATED-SCOPE.md` — locked v3.1 scope; COLL/CTX/IA split rationale.
- `.planning/REQUIREMENTS.md` (COLL-01 L15, CTX-01 L16), `.planning/ROADMAP.md` §Phase 120 (SC#1-4).

### Secondary (MEDIUM confidence)
- [PostgreSQL Documentation — Modifying Tables (ADD COLUMN fills existing rows with DEFAULT, fast in PG 11+)](https://www.postgresql.org/docs/current/ddl-alter.html) — verified existing-row DEFAULT-fill semantics + CHECK immediate validation.
- [PostgreSQL Documentation — ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html) — ADD COLUMN + CHECK constraint behavior.

### Tertiary (LOW confidence)
- None — all claims are sourced from code reads or official docs.

## Metadata

**Confidence breakdown:**
- COLL-01 (harvest seeding): HIGH — both empty-baseline init sites read in source; the dedup machinery it reuses is confirmed present; test scaffold exists.
- CTX-01 (migration + filter + tagging): HIGH for the column semantics (official Postgres docs) and the Deep query/filter (read in source); MEDIUM for the Harness history-read site (A1 — the Deep read at :1024 is confirmed; the symmetric Harness read site should be confirmed during planning).
- Insert-site enumeration: HIGH — three independent greps + the shared-helper discovery; flagged A2/A3 for the two mode-ambiguous/verification points.
- Pitfalls / Security: HIGH — derived from the three-valued-logic NULL trap, the timing trap, and the owner/thread scoping invariant, all grounded in the read code.

**Research date:** 2026-06-22
**Valid until:** 2026-07-22 (stable internal backend code; ~30 days). Re-confirm the `messages` insert-site set if any phase between now and execution adds a new message persist path.
