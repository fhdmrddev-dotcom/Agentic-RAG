# Phase 200: The Run Becomes Measurable — Pattern Map

**Mapped:** 2026-08-19
**Files analyzed:** 31 (11 create · 20 modify)
**Analogs found:** 29 / 31 (2 have no analog — named in § No Analog Found)

> **Precedence rule applied throughout.** Where `200-CONTEXT.md` and `200-RESEARCH.md` disagree,
> **RESEARCH wins** — it measured, CONTEXT inferred. Every disagreement is called out inline with
> its `X-NN` correction id rather than silently resolved.
>
> **Two suggested analogs were REPLACED.** See § Analog Replacements at the end — read it before
> using the kickoff table's suggestions.

---

## File Classification

### NEW files

| To create | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `supabase/migrations/121_workflow_phases_timings.sql` | migration | schema DDL | `supabase/migrations/119_workflow_phases_cancelled.sql` | **exact** |
| `backend/app/services/harness/human_input.py` | service (executor leaf) | event-driven (pub/sub wait) | `backend/app/services/run_transport.py` | **exact (shape)** |
| `backend/tests/test_migration_121.py` | test (live-DB gate) | schema assertion | `backend/tests/test_migration_119.py` | **exact** |
| `backend/tests/test_200_human_input_baseline.py` (characterization pin, **committed BEFORE the cut**) | test (characterization) | request-response | `backend/tests/test_cancel_run.py` (backend) + `WorkflowDoorSwitch.baseline.test.tsx` (discipline) | **role-match** |
| `backend/tests/test_200_human_gate_pause.py` | test (unit, engine control flow) | event-driven | `backend/tests/test_096_askuser_cleanup.py` | **exact** |
| `frontend/src/components/workflows/receiptVocabulary.ts` | vocabulary leaf | pure value | `frontend/src/components/workflows/doorVocabulary.ts` | **exact** |
| `frontend/src/components/workflows/phaseDuration.ts` (D-06's six arms — **recommended, see §7**) | resolver leaf | transform | `frontend/src/components/workflows/library/runFacts.ts` | **exact** |
| `frontend/src/providers/ThemeProvider.tsx` | provider (React context) | pub-sub (context broadcast) | `frontend/src/providers/TechnicalNamesProvider.tsx` | **exact** |
| 4 × per-screen `MUST NOT RENDER` fences | test (negative fence) | source + DOM scan | `PublishGauntlet.test.tsx:1095-1334` (role-SET scan) + `librarySubtree.fences.test.ts:82-210` (explicit list) | **exact** ⚠ *replacement — see end* |
| 0-3 × disclosure leaves for `PhaseFormPanel`'s c4 card sections | component leaf + context leaf | UI state | `FieldGuidance.tsx` + `fieldGuidanceContext.ts` | **exact** |
| `backend/app/db/workflows.py::pause_run` (new writer — a NEW FUNCTION in an existing file) | db writer | CRUD | `db/workflows.py::cancel_active_phases` / `finish_run` | **exact** |

### MODIFIED files

| File | Role | Data flow | In-file convention to inherit |
|---|---|---|---|
| `backend/app/db/workflows.py` | db access layer | CRUD | seven `UPDATE workflow_phases SET status=…` writers + two SELECT lists |
| `backend/app/api/workflow_runs.py` | route + wire model | request-response | THREE-place lockstep widening (`.select()` / model / serializer) |
| `backend/app/api/threads.py:1191` | route (reconcile) | request-response | raw SQL via `_rls_fetch` |
| `backend/app/models/thread.py:48` | wire model | request-response | **a SECOND independent model for the same rows** |
| `backend/app/services/harness/phase_types.py` | service (7 executors) | request-response | one additive line per type; the human-input executor LEAVES |
| `backend/app/services/harness_engine.py` | service (control flow) | event-driven | `PhaseOutcome` namedtuple + one `if outcome.kind == …` arm |
| `backend/app/api/runs.py:503` | route | event-driven | branch-never-replace; persist-then-publish |
| `backend/tests/test_188_workflow_run_read.py` | test (route TestClient) | request-response | `_FakeSupabase` / `_FakeQuery` recording chain |
| `frontend/src/lib/api.ts:4178` | wire types | type-only | `export interface`, zero runtime exports (D-15) |
| `frontend/src/components/panel/PhaseTimeline.tsx` | component | streaming + reconcile | `<ol>/<li>/<PhaseCard>` |
| `frontend/src/components/panel/PhaseCard.tsx` | component | streaming | `statusMeta()` vocabulary read |
| `frontend/src/components/panel/phaseStatusMeta.ts` | vocabulary + TOTAL lookup | pure value | `hasOwnProperty.call` guard + explicit `unknown` row |
| `frontend/src/components/workflows/PhaseFormPanel.tsx` | component (form panel) | request-response | ONE gated mount line per new leaf; **absolute-zero hook pin** |
| `frontend/src/components/workflows/PhaseSpineGraph.tsx` | component (authoring spine) | pure render | optional prop, absent ⇒ byte-identical |
| `frontend/src/components/workflows/WorkflowCanvas.tsx` | component (canvas plane) | pure render + optional run seam | `runState?: (slug) => NodeRunState \| undefined` |
| `frontend/src/components/workflows/FlowEdge.tsx` | component (edge) | pure render | one exported label constant per string |
| `frontend/src/pages/WorkflowRunPage.tsx` | page | streaming + fetch | `@/lib/fmtElapsed`, the no-previewer fence |
| `scripts/vitest-count-gate.cjs` | config (test gate) | config | TARGETS + BASELINE are TWO knobs |
| `CLAUDE.md` (hot-file scan list) | doc | config | same-commit sync rule |
| `docs/HOT-FILE-LEDGER.md` | doc | config | one `##` section per file, `### Phases touched` + `### G-5 status` |

---

## Repo-Wide Idioms (locate once, apply everywhere)

### IDIOM-1 — `own()` / `hasOwnProperty.call`, NEVER `TABLE[key] ?? fallback`

**Source:** `frontend/src/components/workflows/ownProperty.ts` (zero imports **by contract**)

```ts
export function own<T>(table: Record<string, T>, key: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(table, key)
    ? (table as Record<string, T>)[key]
    : undefined
}
```

**Shipped call site — `frontend/src/components/workflows/WorkflowCanvas.tsx:699,738` and `editAffordance.ts:540-543`:**

```ts
import { own } from "./ownProperty"
const live = own(overlay, slug)          // NOT overlay[slug]
return own(nudges, slug) ?? 0            // safe: own() returns undefined for inherited keys
```

**Second shipped spelling (in-file, for a module that must stay leaf-pure) — `phaseStatusMeta.ts:177-180`:**

```ts
export function statusMeta(status: Phase["status"]): StatusMeta {
  if (!Object.prototype.hasOwnProperty.call(STATUS_META, status)) return STATUS_META.unknown
  return STATUS_META[status]
}
```

**Binding invariant.** `TABLE["constructor"]` resolves the inherited `Object.prototype.constructor`
— a **function**, never nullish — so `??` never fires. Seven sinks have been fixed this way.
**RESEARCH §E-R5 found an EIGHTH, live, inside this phase's own primary file:**

```ts
// frontend/src/components/workflows/PhaseFormPanel.tsx:873-883  ← LIVE DEFECT
function friendlyToolName(id: string): string {
  const map: Record<string, string> = { search_documents: "Search documents", /* …4 more */ }
  return map[id] ?? id          // ⚠ map["constructor"] returns a FUNCTION into JSX at :638, :733, :791
}
```

⚠ **Every new slug-keyed or type-keyed lookup this phase adds** — the edge-label count map, the
receipt row map, the `{count, noun}` client read, the duration arm table — **must route through
`own()` or the in-file `hasOwnProperty.call` spelling.** `workflow_phases.slug` is unconstrained
`text` (`058_workflow_phases.sql:18`; `models/harness.py:202` is a bare `str`) — an author-supplied
key reaches these tables. `SEED-143` is the open class.

⚠ **CONTEXT vs RESEARCH (X-6):** CONTEXT says `BUG-260807-01` / `BUG-260808-01` are *"correctness
defects under the rebuilt canvas… budget for it"*. **RESEARCH measured both ALREADY CODE-FIXED.**
What is owed is **one driven browser row + a ~3-line seeded fixture**, not a repair.

---

### IDIOM-2 — Absence gets its OWN arm; a boolean cannot express it

**Source A (four arms) — `frontend/src/components/workflows/library/runFacts.ts:200-240`:**

```ts
export type RunFact =
  | { kind: "ran"; outcome: RunOutcome; when: string | null; word: string }
  | { kind: "never"; word: string }        // has_any_run === false — an AFFIRMED row-level fact
  | { kind: "not-by-you"; word: string }   // has_any_run === true, no caller-scoped run
  | { kind: "unknown"; word: string }      // the wire did not say

export function runFacts(row: LibraryRow, now: number = Date.now()): RunFact {
  const status = row.lastRunStatus
  // (1) the KEY WAS ABSENT from the payload — must not fall through to anything reading a value
  if (status === undefined) return { kind: "unknown", word: RUN_UNKNOWN }
  if (status === null) {
    if (row.hasAnyRun === true)  return { kind: "not-by-you", word: RUN_NOT_BY_YOU }
    if (row.hasAnyRun === false) return { kind: "never",      word: RUN_NEVER }
    return { kind: "unknown", word: RUN_UNKNOWN }          // absent bit ⇒ unknown, NEVER never
  }
  const outcome = ownOutcome(status)
  if (outcome === undefined) return { kind: "unknown", word: RUN_UNKNOWN }   // never success by default
  ...
}
```

Its own docblock states the binding rule verbatim:
> *"⚠ AND THE COMPARISONS ARE `=== true` / `=== false`, NEVER A TRUTHINESS TEST. A truthiness test
> folds `false`, `null` and `undefined` into ONE answer, and 2a/2b/2c turn on those being THREE."*

> *"⚠ NO ABSENCE ARM IS STRUCTURALLY READABLE AS A RUN. The three non-`ran` arms carry a `word` and
> NOTHING ELSE — no `outcome`, no `when` — so a consumer cannot reach an outcome or a time through
> them even by mistake. That is the TYPE doing the work rather than a convention."*

**Source B (three arms, the absence arm is the third) — `DecisionsList.tsx:42-57`:**

> *"The three arms: `readiness` ABSENT → the row renders its answer and NO verdict node at all.
> status is missing → the server's own `message`, verbatim. status is present → NO verdict node —
> exactly what absence renders. The second and third bullets are why absence can never be mistaken
> for a pass: they are indistinguishable to the author… a boolean coercion is what turns *the server
> did not say* into *the server said yes*."*

**Binding invariant for D-06.** Six arms, six distinct renders, expressed as a **discriminated
union** (not a status string plus an `if`):
`pending` (silent) · `skipped` (silent — *correct silence*, a different reason from pending) ·
`active` (ticks from `started_at`) · `completed` (`12.4s`) · `cancelled` (`ran 8.1s, interrupted`) ·
**`not-recorded`** (`status` terminal, both timestamps NULL — a **different render** from "never ran").

⚠ **RESEARCH §B4 recommends a SEVENTH arm CONTEXT does not have: `active` on a TERMINAL run ⇒
"did not finish".** `harness_engine.py:1707` only terminalizes the interrupted phase on
`asyncio.CancelledError`; the docblock at `:1698-1706` records the residual verbatim — *"an `active`
phase row under a run that ends `failed`. That is PRE-EXISTING and inherited."* Without the arm,
a crashed run renders a **live-ticking clock forever** — `BUG-260610-01`'s symptom re-created by the
fix for it. **Assumption A3 — confirm with the operator, do not silently add or silently omit.**

---

### IDIOM-3 — A count of `0` is a FACT, not an absence

**The wire-level idiom (absent KEY vs present value) — `runFacts.ts:218` vs `:225`, quoted above:**
`=== undefined` (key absent from the payload) is tested FIRST and separately from `=== null`
(key present, value empty). That two-step is the whole shipped idiom, and it is what the client arm
for `{count, noun}` must copy.

**The rendered-word idiom — `frontend/src/pages/WorkflowRunPage.tsx:163-170`:**

```ts
/** ⚠ THE TWO EMPTY STRINGS BELOW ARE DELIBERATELY UNCHANGED and must stay that way.
 *  "This run produced no files." looks like the same overclaim and is not: a run is a
 *  subset of its thread, so an EMPTY thread-scoped list entails the run produced
 *  nothing. […] a source fence pins each at exactly one occurrence. */
const COPY_NO_FILES_LIVE     = "No files yet — this run hasn't written anything."
const COPY_NO_FILES_TERMINAL = "This run produced no files."
```

Two distinct sentences for the SAME `files.length === 0`, because *zero-so-far* and *zero-forever*
are different truths — the exact split D-07 needs between `count: 0` and no count at all.

**Binding invariant.** `source_refs: []` on `llm_agent` / `llm_batch_agents` is a **REAL fact**
("we searched and found nothing") and must reach the client as `count: 0` with its noun. A type that
declares no count emits **NO KEY AT ALL** — not `0`, not `null`, not a dash (SEED-159). So:
- **Backend:** the executor either puts the key in the dict or does not. Never a sentinel.
- **Client:** the arm is `hasOwnProperty`-shaped or `=== undefined`-shaped. **Never `count ?? 0`,
  never `if (count)`** — both fold `0` into absence, which is Pitfall 8.

---

### IDIOM-4 — `run_in_threadpool` around blocking I/O in an async handler (D-v2.5-01)

**Source — `backend/app/utils/db.py:47-59`:**

```python
from starlette.concurrency import run_in_threadpool

async def aexec(query):
    """Run a sync supabase-py query off the event loop."""
    return await run_in_threadpool(query.execute)
```

**Shipped call site — `backend/app/api/workflow_runs.py:228-233` (the exact site this phase widens):**

```python
phases_resp = await aexec(
    supabase.table("workflow_phases")
    .select("slug, phase_index, status")
    .eq("workflow_run_id", str(run["id"]))
    .order("phase_index")
)
```

**Direct form, where a builder is not available — `backend/app/api/admin.py:922`, `document_governance.py:106`:**
```python
row_res = await run_in_threadpool(lambda: supabase.table(...).select(...).execute())
```

**Binding invariant.** `api/workflow_runs.py` already routes **every** call through `aexec` — keep it.
Widening the `.select()` string adds no new call and no second query (see § Security below).
`db/workflows.py` uses **asyncpg directly** (`await pool.execute(...)`), which is natively async — no
wrapper is owed or wanted there. Do not mix the two idioms in one function.

---

## Pattern Assignments

### 1. `supabase/migrations/121_workflow_phases_timings.sql` (migration, schema DDL)

**Analog:** `supabase/migrations/119_workflow_phases_cancelled.sql` — same role (a targeted `ALTER`
on `workflow_phases`), same data flow (DDL applied by SQL-editor paste), same table, and it is the
most recent migration on this table, so it carries the current house style.

**Excerpt — the shape (119's tail, verbatim):**

```sql
BEGIN;

ALTER TABLE public.workflow_phases DROP CONSTRAINT IF EXISTS workflow_phases_status_check;
ALTER TABLE public.workflow_phases ADD CONSTRAINT workflow_phases_status_check CHECK (
    status = ANY (ARRAY[
        'pending'::text, 'active'::text, 'completed'::text, 'failed'::text, 'skipped'::text,
        'recorded_not_sent'::text,
        'cancelled'::text
    ])
);

COMMIT;
```

**The four rules 119's own header states, each of which 121 inherits (`119:…` header, verbatim):**

> 1. **BEGIN / COMMIT** (mig 115's review finding WR-01). *"Without it, the two ALTERs each run in
>    their OWN implicit transaction when pasted into the Supabase SQL editor, so a dropped session
>    … leaves the table with NO constraint AT ALL … fail-open, and SILENTLY."*
> 2. **`IF NOT EXISTS` / `DROP … IF EXISTS`** — *"makes a re-paste safe"*.
> 3. **`= ANY (ARRAY[…])` with `::text` casts, NOT `IN (…)`** — the form `pg_dump` regenerates, so the
>    `full-schema.sql` diff stays one line.
> 4. **Re-add every shipped literal VERBATIM.** *"A re-typed `ARRAY[…]` is precisely where a shipped
>    literal gets silently dropped."*

**The 121 shape (RESEARCH § Code Examples, adopt verbatim):**

```sql
BEGIN;
ALTER TABLE public.workflow_phases
  ADD COLUMN IF NOT EXISTS started_at   timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;
COMMENT ON COLUMN public.workflow_phases.started_at IS
  'Phase 200 (DES-02 / D-05). Set at the mark_phase_active transition. NULL on every pre-200 row by
   decision — NO BACKFILL (a backfill from updated_at is right for some rows and silently wrong for others).';
COMMENT ON COLUMN public.workflow_phases.completed_at IS
  'Phase 200 (DES-02 / D-05). Set at each of the SIX terminal transitions AND at cancel_active_phases
   (db/workflows.py:1649 — the seventh site, the engineless Stop arm).';
COMMIT;
```

**Binding invariants (violate any of these and the migration is wrong):**
1. **Both columns NULLABLE, no DEFAULT, NO BACKFILL** (D-06). A `DEFAULT now()` would silently
   backfill on ALTER and destroy the "time not recorded" arm's whole reason to exist.
2. **Rule 3 above does not apply** — 121 adds columns, it does not rewrite a CHECK. **Do not touch
   `workflow_phases_status_check`.** Phase 200 adds **no new phase status** (D-10 pauses the RUN).
3. **No RLS work is owed.** `058:38-77`'s four policies share one predicate
   (`auth.uid() = (SELECT t.user_id FROM threads t JOIN workflow_runs wr … )`) and **none names a
   column list**, so `ADD COLUMN` touches no policy. State this in the plan; a reviewer will ask.
4. **The `updated_at` trigger is inert here.** `set_updated_at()` (`014_folders.sql:52-58`) writes
   **only** `NEW.updated_at`, is `BEFORE UPDATE` (not INSERT), and fires on every UPDATE regardless of
   which column moved. So the seven write sites **keep their explicit `updated_at=now()`** unchanged.
5. **Number `121` is Claude's Discretion but must be re-checked at plan time** (`ls supabase/migrations/ | sort -V | tail -1` → `120_…` at research time; A5). Letter suffixes (`121b`) are silently skipped by the CLI.
6. **Apply by pasting into the Supabase SQL editor**, never `db push`/`db reset`, then
   `bash scripts/regenerate-full-schema.sh` (no `--reset`) and commit the artifact. 119 makes the
   apply its **own serialized plan** (194-12) — copy that.
7. ⚠ **Do NOT take `SEED-143` (a CHECK on `slug`) here.** RESEARCH Open Question 4 recommends
   declining; record the decline with the trigger *"the next phase that opens a `workflow_phases`
   migration for another reason."*

---

### 2. `backend/app/services/harness/human_input.py` (service leaf, event-driven)

**Analog:** `backend/app/services/run_transport.py` — the named precedent, verified by RESEARCH §B9
(116 lines, 1 commit, extracted 2026-08-17 to discharge `threads.py`'s G-5). Same role (a leaf cut
out of a hot file), same data flow (the extraction is a **MOVE plus an IMPORT-BACK**, never a MOVE
plus N edits). Sibling placement follows `harness/validator_kinds.py` / `harness/grounding.py` /
`harness/programmatic.py` — the package already splits by concern.

**Excerpt — the docblock shape that makes the move auditable (`run_transport.py:1-38`, condensed):**

```python
"""SSE transport primitives for the run/producer path.

EXTRACTED FROM ``app.api.threads`` on 2026-08-17 to discharge the G-5 obligation
recorded for that file in ``CLAUDE.md``'s hot-file ledger […]. The bodies below are a
VERBATIM move — not a rewrite […].

⚠ CONSUMERS WERE DELIBERATELY NOT REPOINTED, AND THAT IS THE POINT OF THE MOVE'S
SAFETY. Every existing consumer still says ``from app.api.threads import RUN_TASKS`` […],
and ``threads.py`` re-imports these names, so there is ONE object:
``app.api.threads.RUN_TASKS is app.services.run_transport.RUN_TASKS``.
"""
```

**The import-back, verbatim — `backend/app/api/threads.py:153-173`:**

```python
# ── SSE transport primitives — MOVED to app.services.run_transport (G-5, 2026-08-17) ──
# […]
#   app.api.threads.RUN_TASKS is app.services.run_transport.RUN_TASKS
from app.services.run_transport import (  # noqa: F401 — re-exported for consumers + patch surface
    ...
)
```

**The four proofs the precedent used (`docs/HOT-FILE-LEDGER.md` → `threads.py` → *G-5 discharge*) —
copy all four as acceptance criteria:**
1. **The moved block is byte-identical** — a scripted diff against `git show`'s pre-move text, driven
   by a script with **pre-move line-boundary assertions** so a drifted line aborts rather than cutting
   the wrong span.
2. **One object, not two** — `app.services.harness.phase_types._exec_llm_human_input is
   app.services.harness.human_input._exec_llm_human_input`.
3. ⚠ **That identity check must be DRIVEN RED against a real plant** (the precedent appended a
   duplicate definition and watched it flip to `False`). *"An identity assertion that has never been
   shown to fail is not evidence."*
4. **The full backend suite's FAILURE SET is byte-identical before and after — not merely the count.**
   A `comm` diff of sorted failing node ids: zero newly-failing **and zero newly-passing** (the second
   half matters as much — a newly-passing test means the suite was not exercising the moved code).
   Baseline: **62 failed / 2350 passed** (RESEARCH §D19; re-derive, it moved once already).

**Binding invariants:**
1. ⚠ **THE IMPORT-BACK IS LOAD-BEARING AND MUST NOT BE "TIDIED" AWAY** (ledger, red line #1).
   `phase_types.py` re-imports the symbol and the registry entry at `:2404` stays **character-identical**.
   `git diff` over `phase_types.py` then shows *an import and a deletion* — nothing else.
2. **The new module must stay a leaf** (ledger #3 — *"the moment it imports anything from `app.`, the
   cycle it was created to dissolve comes back"*). ⚠ For this cut that is **aspirational, not
   achievable**: the moved function needs `settings`, `subscribe_for_response`
   (`app.services.ask_user_service`), `aexec` and `_latest_phase_text`. **So state the honest weaker
   invariant instead: it must not import `phase_types` back** — that is the cycle that actually exists.
3. **Move `_latest_phase_text` too** (`phase_types.py:1715`). `grep -c` → 2 (the def and this one
   call), so it is used only here; moving it makes the new module self-contained. Leaving it means a
   back-import into `phase_types.py`, which is invariant 2's forbidden edge.
4. **`harness/__init__.py:20` imports `phase_types` last so `register_all()` runs.** The new module
   must be imported before `register_all()` binds the dict.
5. **The D-10 fix lands INSIDE the new module**, after the move commit — never in the same commit
   (see § 4, the characterization pin).
6. ⚠ **CONTEXT's line pointers are STALE (X-4).** CONTEXT/`BUG-260816-06` say `:765-856` / `:818-856`.
   At HEAD: def `:760`, `subscribe_for_response` `:851`, shutdown branch `:866`, `answer = ""` **`:872`**,
   return `:888` — a ~54-line drift. **Re-derive before cutting.**

---

### 3. `backend/tests/test_migration_121.py` (test, live-DB gate)

**Analog:** `backend/tests/test_migration_119.py` — same role, same data flow (a real asyncpg
connection to `:54322`, all writes inside a rolled-back transaction), and it gates the immediately
preceding migration on the very same table.

**Excerpt — the two clean skips (`test_migration_119.py:97-160`):**

```python
_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN", "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)

async def _pg_reachable(dsn: str = _POSTGRES_TEST_DSN) -> bool:
    try:
        conn = await asyncio.wait_for(asyncpg.connect(dsn), timeout=2.0)
        await conn.close()
        return True
    except Exception:
        return False

# SKIP 1 of 2 — no live DB to gate against.
PG_AVAILABLE = _check_pg_available_sync()
pytestmark = pytest.mark.skipif(not PG_AVAILABLE, reason=(...))

async def _migration_119_applied(conn) -> bool:
    """True when migration 119 is applied — the CHECK physically names the new slug.

    Read from ``pg_constraint`` rather than probed by an INSERT: the constraint definition is
    the definitive artefact, and reading it cannot mutate anything.
    """
    definition = await conn.fetchval(
        "SELECT pg_get_constraintdef(oid) FROM pg_constraint "
        "WHERE conname = 'workflow_phases_status_check'"
    )
    return bool(definition) and CANCELLED_SLUG in definition

# SKIP 2 of 2 — the migration this file gates has not been applied yet.
```

**Excerpt — the rolled-back transaction + FK seed (`:161-250`):**

```python
async def _seed_phase_parents(conn):
    """Seed auth.users -> threads -> workflow_definitions -> workflow_runs inside the
    caller's ROLLED-BACK transaction […]"""
    ...

@pytest.mark.asyncio
async def test_cancelled_is_admitted(pg_pool):
    async with pg_pool.acquire() as conn:
        if not await _migration_119_applied(conn):
            pytest.skip(_SKIP_UNAPPLIED)
        tx = conn.transaction(); await tx.start()
        try:
            run_id, org_id = await _seed_phase_parents(conn)
            ...
        finally:
            await tx.rollback()      # NEVER mutate live dev data
```

**Binding invariants:**
1. **The applied-check reads `information_schema.columns` (121's analogue of `pg_constraint`), never
   an INSERT probe.** Reading cannot mutate; a probe would both write to the operator's live dev DB
   and conflate *"the column is absent"* with *"some other constraint rejected the row."*
2. **Every write inside a transaction that ROLLS BACK.** The operator's local DB is the working
   environment.
3. ⚠ **A GREEN-SKIP IS NOT A PASSING FENCE** (119's docblock, verbatim: *"nobody may later read it as
   one"*). Until the migration is applied, the only thing the file has demonstrated is that it skips —
   so the **RED observations are owed by the APPLY plan**, not by the authoring plan.
4. **The NO-BACKFILL negative control is this file's D-17 analogue and is as load-bearing as the
   positive one:** assert that pre-existing rows (seed one at `status='completed'` **before** simulating
   the ALTER, or read a real historic row) carry `started_at IS NULL` and `completed_at IS NULL`.
   A test that only asserts the columns exist cannot tell a no-backfill migration from a backfilled one.
5. ⚠ **THIS PLAN MUST BE DISPATCHED ALONE** — CLAUDE.md parallel-execution rule 4 (tests that MUTATE
   the local database are serialized). RESEARCH §D19 names this explicitly.
6. **Assert nullability, not just existence** — `is_nullable = 'YES'`; a `NOT NULL` column would have
   required a backfill and its absence is the proof that none happened.

---

### 4. `backend/tests/test_200_human_input_baseline.py` (characterization pin, **committed BEFORE the cut**)

**Analog:** `backend/tests/test_cancel_run.py` — **the nearest BACKEND characterization pin**
(`grep -rln "characterization" backend/tests` → this file + `unit/test_library_run_facts.py`). The
DISCIPLINE comes from `frontend/src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx`.

**Excerpt — `test_cancel_run.py:1-29` (the docblock shape that separates GREEN-parity from RED→GREEN):**

```python
"""[…] Proves the two load-bearing cancel behaviors of the extraction:

  1. ``test_cancel_finalizes_and_zrems``: […] Because the owner already exists (Plan 02),
     this is a GREEN parity/characterization test — it locks the ``status='cancelled'`` + ZREM
     co-write the handler routes onto […]

  2. ``test_cancel_handler_routes_zombie_heal_through_owner``: drives the REAL handler […]
     This is the RED→GREEN gate: before Plan 03's change […] the spy stays uncalled (RED);
     after the swap it fires exactly once.

No live DB / no live Redis (CLAUDE.md / the operator's dev :54322 + :6379 are LIVE and
MUST NOT be touched): the ``pool`` is an in-memory ``_FakePool`` […]
"""
```

**The discipline, verbatim from `WorkflowDoorSwitch.baseline.test.tsx` (quoted in CONTEXT D-03):**
> *"A baseline taken after the edit proves the edit against itself."*

**Binding invariants:**
1. ⚠ **It must be its own COMMIT, landing BEFORE the extraction commit.** `192.2-02` did exactly this
   — *"the characterization pin was committed ONE COMMIT BEFORE the seam existed, then passed with a
   `numstat` of nothing."* That `numstat` of nothing IS the proof.
2. **Pin the CURRENT (defective) return shape**, including the `answer: ""` timeout path. It is a
   characterization pin, not a correctness pin — pinning the fixed behaviour would make the move
   unprovable and would be a second concern in the same file.
3. **Then, in the D-10 commit, this pin RED-flips on exactly one case** (the timeout arm) and every
   other case stays GREEN and UNEDITED. That split is what proves *"the extraction changed nothing;
   the fix changed one thing"* — SC#5's whole claim.
4. **No live DB, no live Redis.** Use in-memory fakes (the `_NoopRedis` / `mock_asyncpg_pool` idiom —
   § 5 below), so this plan is safe to run concurrently.

---

### 5. `backend/tests/test_200_human_gate_pause.py` (test, unit / engine control flow)

**Analog:** `backend/tests/test_096_askuser_cleanup.py` — same role (a unit test over
`harness_engine`'s terminal/pause arms), same data flow (event-driven ask_user + SQL-order recording).
Its own header names its own analog, which is the chain to follow: *"Modeled on
`test_harness_resume.py:174-232` (mock_asyncpg_pool SQL-order recording — conftest.py)."*

**Excerpt — the fakes and the SQL-order assertions (`test_096_askuser_cleanup.py:26-56`):**

```python
class _NoopRedis:
    """Minimal redis stand-in for the engine's _emit XADD (records nothing)."""
    async def xadd(self, *args, **kwargs):
        return "0-0"

def _expiry_insert_indices(calls):
    """Indices of ``INSERT INTO messages`` calls carrying an ask_user_response
    expiry payload (``kind == 'ask_user_response'`` with ``expired`` truthy)."""
    ...

def _first_index(calls, needle):
    """Index of the first recorded call whose SQL contains ``needle`` (or None)."""
    for i, (sql, _args) in enumerate(calls):
        if needle in str(sql):
            return i
    return None
```

**Binding invariants — the five assertions D-10 needs, each mapped to a measured failure mode:**

| Assertion | Why (RESEARCH §B8 / Pitfalls 3-4) |
|---|---|
| the run reads `paused` | there are **ZERO writers of `'paused'` in the whole backend today** — 7 grep hits, all reads |
| the phase is still `active` | `find_resumable_runs` (`db/workflows.py:1250`) **requires an `active` phase row** |
| the prompt is NOT expired | a `CancelledError` pause routes into `harness_engine.py:1632`'s `_expire_pending_ask_user` — killing the very prompt the person must answer |
| `finish_run` is NEVER called | it clears `threads.active_workflow_run_id` in the same transaction (092 SC#2) ⇒ **permanently unresumable** |
| the thread anchor is intact | same; `find_resumable_runs` requires `t.active_workflow_run_id = wr.id` |

⚠ **`cancel_phase` must NOT be reached either** — `harness_engine.py:1709` calls it for any
`CancelledError`, flipping the phase to `cancelled`. *"A paused run whose spine shows the human step
as Stopped"* is the warning sign.

⚠ **The resume half is MANUAL** (VALIDATION § Manual-Only). No automated path drives Redis pub/sub +
a re-drive. The unit half can only prove the executor's return and the engine's writes.

---

### 6. `frontend/src/components/workflows/receiptVocabulary.ts` (vocabulary leaf, pure value)

**Analog:** `frontend/src/components/workflows/doorVocabulary.ts` — same role (the ONE string home
for one surface), same data flow (a pure leaf, type-only imports, no React), same directory, and it
is the most recent vocabulary module in this subtree. `decisionsVocabulary.ts` is the second model
(a TRUE leaf — it imports nothing).

⚠ **`libraryVocabulary.ts` is the WRONG analog for the MODULE and the RIGHT one for the REGISTER
(X-11).** CONTEXT D-09 says *"past-tense words come from `libraryVocabulary.ts`'s register."* That
module is **fenced to `library/**` by an explicit 14-path list**
(`librarySubtree.fences.test.ts:82-131`, `:169` asserts `toHaveLength(14)`, `:202` asserts the glob
equals the list). Importing it from outside `library/` would put library words on a non-library
surface **and** make `LIBRARY_SUBTREE_PATHS` stop describing the subtree's blast radius. **Copy the
TONE, import nothing.**

**Excerpt — the export shape (`doorVocabulary.ts`, tail):**

```ts
/** `switch.prompt` — the `switch-strip` prompt. */
export const SWITCH_PROMPT = "Need to set citations, checks, or per-step sources yourself?"

/**
 * `switch.cta` — the `switch-to-govern` button: `DOOR_B_NAME` plus a chevron, which is why
 * the door name is a strict PREFIX of this string and why no assertion anywhere in this repo
 * may use containment to tell the two apart.
 * The trailing character is U+203A […]. Asserted by codepoint in the suite.
 */
export const SWITCH_CTA = "Build it myself ›"
```

**Excerpt — the header rule the new module must restate (`doorVocabulary.ts:1-30`):**

> *"EVERY GOVERNED USER-FACING STRING ON THE … SURFACE, IN ONE HOME … which is the whole COPY table
> and not a subset of it."*
> *"The anti-drift property only holds if EVERY consumer imports from here: one literal left in JSX
> is a second home, and a second home cannot be re-worded by a one-line diff."*
> *"⚠ EXACT-MATCH ASSERTIONS ONLY."*

**Binding invariants:**
1. **One home for the WHOLE receipt table, never a subset.** A module holding a subset means the
   module and the acceptance checklist describe different things.
2. **It must NOT duplicate `runVocabulary.ts`'s EIGHT LOCKED canvas words.** Different audience
   (a whole PAST run vs one step being watched, per the hot-file ledger); copying one register into
   the other is the recorded defect.
3. **Zero glyph strings** (`runVocabulary.ts` exports none; `libraryVocabulary.ts` nets none).
4. ⚠ **Pin it in `scripts/vitest-count-gate.cjs` IN THE SAME COMMIT that creates it** — the
   `196-05`/`196-07` rule: *"an unpinned file is not a lightly-guarded one, it is an unguarded one."*
   **BOTH knobs** (see § 20): the `src/components/workflows` directory entry in `TARGETS` already
   sweeps it, so what is owed is the `BASELINE` entry for its `.test.ts`.
5. **Build tokens, never spell them, in any prose that a `?raw` fence will read** (the 187-24 trap).

---

### 7. `frontend/src/components/workflows/phaseDuration.ts` (resolver leaf — **RECOMMENDED, not mandated**)

**Analog:** `frontend/src/components/workflows/library/runFacts.ts` — same role (the ONE place a wire
truth becomes a rendered fact), same data flow (a pure, value-only transform), same six-vs-four-arm
problem, same own-property hazard. Full excerpt in **IDIOM-2** above.

**Why a new leaf rather than growing `phaseStatusMeta.ts`:** RESEARCH §D18 measured
`phaseStatusMeta.ts` as **UNPINNED** (no dedicated suite; exercised only transitively through
`PhaseTimeline`/`PhaseCard`). D-06's six arms are the highest-consequence logic in the phase and
would land in the one module in the blast radius with no direct guard. A new leaf is pinned in the
commit that creates it (rule 4 above) and `runFacts.ts` is the precedent for exactly this split:
`lib/phaseState` owns derivation and holds **no** words; the vocabulary module owns words and holds
**no** derivation.

**Binding invariants:** IDIOM-2 (six — possibly seven — discriminated arms, `=== undefined` tested
first and separately from `=== null`), IDIOM-1 (`own()` on any status-keyed table), IDIOM-3
(`count: 0` renderable and distinct from absence), and:
- **`now` is a PARAMETER with a `Date.now()` default** — `runFacts.ts`'s exact signature, for the
  exact reason (`relativeChanged.ts` P-1): the page hoists ONE `now` per render so two rows cannot
  straddle a boundary, and a suite injects a fixed instant with no clock mock.
- **No fourth elapsed formatter.** `@/lib/fmtElapsed` is the ONE (hoisted by 194.1-06 after the tree
  carried three). Import it; do not re-spell it.
- **The words come from `receiptVocabulary.ts`; the DECISION lives here.** *"That is the same split
  `cardFace.ts` made for the state axis, one field over."*

---

### 8. `frontend/src/providers/ThemeProvider.tsx` (provider, context broadcast)

**Analog:** `frontend/src/providers/TechnicalNamesProvider.tsx` — the **shipped provider-shaped
precedent**, and its own docblock names `useTheme.ts` as the anti-pattern it deliberately did not
copy. Same role, same data flow, same directory, same persistence mechanism.

**Excerpt — `TechnicalNamesProvider.tsx:11-20` (the reason, verbatim):**

```
 *   - SHARING — modeled on `frontend/src/lib/citationNav.tsx`:
 *     `createContext<T | null>(null)` + a throwing `useTechnicalNames()` (for
 *     writers) + a non-throwing `useTechnicalNamesOptional()` (for leaf reads).
 *     This is NOT a bare per-consumer hook — copying `useTheme.ts` verbatim
 *     would give each consumer its OWN useState and the toggles would drift.
 *   - PERSISTENCE — modeled on `frontend/src/hooks/useTheme.ts`: a `typeof
 *     window` guard + localStorage get/set.
```

**Excerpt — the full shape:**

```tsx
const STORAGE_KEY = "technical-names"

function getInitial(): boolean {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(STORAGE_KEY) === "true"
}

const TechnicalNamesContext = createContext<TechnicalNamesValue | null>(null)

export function TechnicalNamesProvider({ children }: { children: ReactNode }) {
  const [showTechnical, setShowTechnical] = useState<boolean>(getInitial)
  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(STORAGE_KEY, showTechnical ? "true" : "false")
  }, [showTechnical])
  const toggle = useCallback(() => setShowTechnical((v) => !v), [])
  const value = useMemo<TechnicalNamesValue>(() => ({ showTechnical, toggle, setShowTechnical }),
    [showTechnical, toggle])
  return <TechnicalNamesContext.Provider value={value}>{children}</TechnicalNamesContext.Provider>
}

export function useTechnicalNames(): TechnicalNamesValue {          // WRITERS — throws outside
  const ctx = useContext(TechnicalNamesContext)
  if (ctx === null) throw new Error("useTechnicalNames must be used within a TechnicalNamesProvider")
  return ctx
}

export function useTechnicalNamesOptional(): TechnicalNamesValue | null {   // LEAF READS — null outside
  return useContext(TechnicalNamesContext)
}
```

**The shipped hook it replaces — `frontend/src/hooks/useTheme.ts` (12 lines of state per consumer):**

```ts
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)
  useEffect(() => {
    const root = document.documentElement
    if (theme === "dark") root.classList.add("dark"); else root.classList.remove("dark")
    localStorage.setItem("theme", theme)
  }, [theme])
  ...
}
```

**Binding invariants:**
1. ⚠ **The canvas does NOT consume `useTheme` today.** `grep -rn "useTheme" frontend/src` returns
   exactly TWO sites: `hooks/useTheme.ts:12` (the def) and `components/layout/ChatLayout.tsx:31,:111`
   (the ONE consumer). **There is no `ThemeProvider`.** A second `useTheme()` call forks the state:
   two `useState`s, both effects writing `localStorage` and toggling the root class, neither
   re-rendering the other. That is `BUG-260813-01`'s own analysis and it is why a bare hook call is
   the wrong fix.
2. **The non-throwing accessor is required**, so a component still renders in isolation (unit tests /
   the four canvas suites) without a provider mounted.
3. ⚠ **THIS IS A CROSS-SURFACE CHANGE THAT LANDS IN CHAT FIRST.** `ChatLayout.tsx` is the sole
   `useTheme` consumer, so converting it to the provider touches the chat shell before it touches any
   workflow surface. **Budget it; do not discover it.** The alternative — lifting `theme` down as a
   prop from `WorkflowBuilderPage`/`WorkflowRunPage` — is smaller but leaves the fork in place for
   whoever mounts the canvas next.
4. **`colorMode="dark"` is at `WorkflowCanvas.tsx:1317`, NOT `:1250`** — the bug report is stale by
   67 lines (X-5).
5. **The G-4 UAT row is the acceptance:** toggle light mode with the canvas open on **both** the
   builder and the run page, and **toggling in `ChatLayout` must re-render the canvas**. A forked
   `useTheme` passes on first load and fails exactly here.

---

### 9. Four per-screen `MUST NOT RENDER` fences (test, negative fence)

**Analog:** `frontend/src/components/workflows/PublishGauntlet.test.tsx:1095-1334` — the **role-SET
scan with three planted positive controls**. This is the only analog in the tree that has been
*proved* able to fire against a live planted violation.

⚠ **THIS REPLACES the kickoff table's `gutterTokens.fences.test.ts` suggestion.** See § Analog
Replacements.

**Excerpt — the selector and the predicate (`:1095-1129`):**

```ts
/**
 * Every way a "go forward anyway" control could actually ARRIVE on this surface —
 * deliberately wider than the two words the shipped scan needled, and matched over a ROLE
 * set rather than over `<button>` alone.
 */
const FORWARD_CONTROL_SELECTOR = [
  "button", "a[href]", '[role="button"]', '[role="link"]', '[role="menuitem"]',
  'input[type="submit"]', 'input[type="button"]',
].join(", ")

const OVERRIDE_NEEDLE = /publish anyway|override|proceed|force[-\s]?publish|bypass|.../i

function forwardControlsIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FORWARD_CONTROL_SELECTOR)).filter((el) => {
    const surfaces = [el.textContent ?? "", el.getAttribute("aria-label") ?? "",
                      el.getAttribute("title") ?? ""]
    return surfaces.some((s) => OVERRIDE_NEEDLE.test(s))
  })
}
```

**Excerpt — the TWO non-vacuity controls, both required (`:1304-1334`):**

```ts
it("(non-vacuity) the scan FIRES on a planted button, a planted link and a planted menu item", () => {
  // Three plants, three arms. The shipped guard scanned `<button>` only, so a link or a
  // menu item offering the same thing was invisible to it. Driving the predicate RED
  // here — permanently — is what keeps the absence assertion below falsifiable rather
  // than vacuous: a selector typo matching nothing fails THIS case first.
  const { container } = render(<div>
    <button type="button">Publish anyway</button>
    <a href="/x">Override the grader</a>
    <div role="menuitem">Proceed to publish</div>
  </div>)
  expect(forwardControlsIn(container)).toHaveLength(3)
})

it("(non-vacuity) the scan does NOT fire on the deliberate absence the hard wall renders", () => {
  // `no override · <s>publish anyway</s>` is TEXT, not a control. A scan that flagged it
  // would force the honest absence to be deleted to go green — the opposite of the point.
  const { container } = render(<p>no override · <s>publish anyway</s></p>)
  expect(forwardControlsIn(container)).toHaveLength(0)
})
```

**Second analog, for the LIST-COMPLETENESS half — `librarySubtree.fences.test.ts:82-210`:**

```ts
const LIBRARY_SUBTREE_PATHS = ["./libraryRow.ts", "./libraryVocabulary.ts", /* …12 more */] as const

/** The house `?raw` / `import.meta.glob` idiom (`PhaseFormPanel.rails.test.tsx:422`). */
const LIBRARY_MODULES = import.meta.glob("./*.{ts,tsx}",
  { query: "?raw", eager: true, import: "default" }) as Record<string, string>

const SWEPT = LIBRARY_SUBTREE_PATHS.map((path) => ({ path, source: LIBRARY_MODULES[path] ?? "" }))
  .filter(({ source }) => source.length > 0)

it("loads EVERY listed module, and none of them is empty", () => {
  // ⚠ […] `SWEPT` DROPS an unresolved path, and every sweep reads `LIBRARY_MODULES[path] ?? ""`
  // — so a module renamed or moved was swept against the EMPTY STRING and passed green […]
  // That is the Phase-190 CR-01 shape exactly: a fence that cannot fire.
  expect(SWEPT.map((f) => f.path)).toEqual([...LIBRARY_SUBTREE_PATHS])
  expect(subtreeSource.length).toBeGreaterThan(1000)
})
expect(LIBRARY_SUBTREE_PATHS).toHaveLength(14)
```

**Binding invariants:**
1. ⚠ **`199-03` MEASURED that a `?raw` source regex AND a `queryAllByRole("button")` filter BOTH
   passed GREEN against a live planted violation** (`<a href="/publish?force=1">Proceed to publish
   anyway</a>` inside `HardWall`). **A source regex cannot see a control composed from a variable;
   a button scan cannot see a link. Only the role-SET scan went red.** A `MUST NOT RENDER` fence built
   on either weaker instrument is a fence that cannot fire.
2. **Every fence needs a PLANTED-VIOLATION positive control that goes RED**, committed permanently.
3. **Non-vacuity BEFORE contents.** `librarySubtree`'s lesson: assert the corpus resolved and is
   non-empty first, or every negative below passes against the empty string.
   ⚠ **`?raw` CANNOT READ CSS UNDER VITEST — it returns the EMPTY STRING, silently** (`test.css`
   defaults to `false`; `gutterTokens.fences.test.ts` works around it with
   `vi.importActual("node:fs")`). Only relevant if a screen fence reaches for a stylesheet.
4. **A DELIBERATE ABSENCE must not trip the fence.** `builder-spine`'s `MUST NOT RENDER` list
   forbids `READ_ONLY_LEGEND` **as a rendered string** — but that identifier is still `export`ed from
   `PhaseSpineGraph.tsx:71`, and a source-level scan for the words would red on the export. Scan the
   **rendered DOM**, and if a source scan is also wanted, scan for the JSX *mount*, not the constant.
5. **Build tokens, never spell them** in the fence's own prose (the 187-24 trap, hit three times in
   `PhaseFormPanel.test.tsx` alone).

---

### 10. Disclosure leaves for `PhaseFormPanel`'s c4 card sections (component leaf + context leaf)

**Analog:** `frontend/src/components/workflows/FieldGuidance.tsx` + `./fieldGuidanceContext.ts` —
created by `199-06` for **exactly this**, and its docblock is the argument verbatim.

**Excerpt — `FieldGuidance.tsx:15-30`:**

> *"`PhaseFormPanel.test.tsx` asserts an ABSOLUTE ZERO of `useState` / `useMemo` / `useEffect` over the
> panel's own `?raw` source … A disclosure switch is state, so putting it in the panel would have meant
> re-baselining a guard whose whole point is that it reads zero rather than "no increase" — **and a pin
> relaxed to make red go green is a pin that will never fail again.**"*
>
> *"THE DEFAULT IS `true`, AND THAT IS THE SAFE DIRECTION. A consumer rendered OUTSIDE a provider reads
> `true` and therefore behaves EXACTLY as it did before this module existed … `false` would have made a
> missing wrapper look like a successful subtraction, which is the failure mode that is hard to see."*

**Excerpt — the two-file split and the `mousedown` suppression:**

```tsx
// 199 CR WR-03 — the context, the hook and the two control words live in `fieldGuidance.ts`.
// A component file may not export a shared HOOK (`react-refresh/only-export-components`), and
// this project answers that rule with a leaf module rather than a suppression — 27 files do,
// zero disables exist. ⚠ The `useState` below deliberately did NOT move: it is the entire
// reason this file exists […]
import { FieldGuidanceContext, FIELD_GUIDANCE_HIDE, FIELD_GUIDANCE_SHOW } from "./fieldGuidanceContext"

export function FieldGuidance({ children }: FieldGuidanceProps) {
  const [shown, setShown] = useState(false)
  return (
    <FieldGuidanceContext.Provider value={shown}>
      <button type="button" data-testid="field-guidance-toggle" aria-expanded={shown}
        onClick={() => setShown((c) => !c)}
        // ⚠ asking to see the explanations must not fire the panel's blur-persist seam.
        onMouseDown={(event) => event.preventDefault()} …>
        {shown ? FIELD_GUIDANCE_HIDE : FIELD_GUIDANCE_SHOW}
      </button>
      {children}
    </FieldGuidanceContext.Provider>
  )
}
```

**Binding invariants:**
1. **A component file may not export a shared HOOK** — split into `<Name>.tsx` + `<name>Context.ts`.
   27 files do this; **zero eslint disables exist** in the tree.
2. **`onMouseDown={(e) => e.preventDefault()}` on every new control inside the panel.** The panel's
   persist seam is a field's `onBlur`; a press moves focus off the focused field and PATCHes a
   version. This is the 184-11 trap and it has already bitten once.
3. **The default must degrade to the SHIPPED surface**, not to an emptier one.
4. ⚠ **`PhaseFormPanel.rails.test.tsx:526` runs an `import.meta.glob` scan asserting "no module other
   than `PhaseFormPanel.tsx` exports a phase-config form component."** A new leaf must not read as
   one. **Read `:526-540` before naming or shaping the leaf.**
5. **D-11 accepts leaf sprawl deliberately** — up to three more leaves if all three c4 card sections
   need state. Stated cost, not a discovery.

---

### 11. `backend/app/db/workflows.py` (db access layer, CRUD) — MODIFIED

**In-file convention — the seven phase-status writers.** Each is a single `pool.execute` with an
inline SQL string, a keyed `WHERE`, and a docstring that names its **key axis** in a fixed phrase.

**Excerpt — the simplest (`:1435-1443`):**

```python
async def mark_phase_active(pool: asyncpg.Pool, phase_id: UUID) -> None:
    """Flip a phase to ``active`` BEFORE its work runs (Pitfall 1: durable-first).

    PHASE-KEYED write → ``WHERE id=$1``.
    """
    await pool.execute(
        "UPDATE workflow_phases SET status='active', updated_at=now() WHERE id = $1",
        phase_id,
    )
```

**Excerpt — the terminal guard every terminal writer carries (`complete_phase`, `:1483`):**

```python
"UPDATE workflow_phases SET status='completed', output=$2::jsonb, updated_at=now() WHERE id = $1 AND status IS DISTINCT FROM 'cancelled'",
```
> *"`IS DISTINCT FROM` rather than `<>` on purpose: `status` is NOT NULL today, and `<>` would silently
> stop matching if that ever changed."*

**Excerpt — the SEVENTH site CONTEXT misses (`cancel_active_phases`, `:1649`):**

```python
    # ⚠ The predicate below is written on ONE source line ON PURPOSE (193.2-08: a rule
    # written WRAPPED failed its own literal ``grep -q`` and read as "already fixed").
    await pool.execute(
        "UPDATE workflow_phases SET status='cancelled', updated_at=now() WHERE workflow_run_id = $1 AND status = 'active'",
        workflow_run_id,
    )
```

**The seven sites, re-derived by RESEARCH §B4 with `grep -n "UPDATE workflow_phases SET status"`:**

| # | Function | UPDATE line | New column |
|---|---|---|---|
| 1 | `mark_phase_active` | **1441** | `started_at = now()` |
| 2 | `complete_phase` | **1483** | `completed_at = now()` |
| 3 | `fail_phase` | **1505** | `completed_at = now()` |
| 4 | `skip_phase` | **1517** | ⚠ **neither** — a skipped phase never ran (D-06: *correct silence*) |
| 5 | `record_phase_not_sent` | **1548** | `completed_at = now()` |
| 6 | `cancel_phase` | **1597** | `completed_at = now()` |
| **7** ⚠ | **`cancel_active_phases`** | **1649** | `completed_at = now()` |

⚠ **CONTEXT D-05 enumerates SIX and every one of its line numbers is exact — the enumeration is one
short (X-1).** Site 7 is the engineless-Stop arm (`WHERE … status = 'active'`, so it only moves rows
that already have a `started_at`, making `completed_at = now()` correct there). **A plan that writes
six sites leaves a hole on exactly the Stop-with-no-producer path 194 was built for**, and D-06's
`cancelled → ran 8.1s, interrupted` arm renders *"time not recorded"* on it (Pitfall 5).

**Eighth site — the batch INSERT (`:334`) — MUST NOT LEARN A TIMESTAMP:**
```sql
INSERT INTO workflow_phases (workflow_run_id, phase_index, slug, status) VALUES ($1, $2, $3, 'pending')
```
`started_at` is precisely the thing `created_at` cannot be — that is D-05's entire argument.

**The two SELECT lists that also widen (X-10):**
```python
# load_run_phases (:1237-1245)          # get_active_phase (:1329-1337)
SELECT id, slug, phase_index, status, output   ← add started_at, completed_at
```

**The new `pause_run` writer.** Model it on `cancel_active_phases`' shape (a single keyed
`pool.execute`, a docstring naming the key axis and the ownership division). ⚠ **It must NOT reuse
`finish_run`** (`:1754`): its guard would *accept* a `paused` write, but it clears
`threads.active_workflow_run_id` in the same transaction (092 SC#2), and `find_resumable_runs`
requires that anchor — so the run becomes permanently unresumable (Pitfall 4).

**Binding invariants (hot-file ledger, `db/workflows.py`):**
- G-5 fires at **19 phases** — TIED with `api/workflows.py` for hottest backend module; honoured by
  construction for three consecutive phases, **no override recorded**. The named seam:
  *"the three list feeds vs the single-definition read, vs the publish-flip, vs the run CRUD,
  vs (now) the seven phase-status writers."* **Adding two columns to writers the file already owns
  is not a second concern** — that is the exact test 194's clearance was recorded on.
- ⚠ **`finish_run` WRITES NO `workflow_phases` ROW AND MUST NOT LEARN TO.**
- ⚠ **`cancel_active_phases`' `AND status = 'active'` is the only thing between it and a bulk
  terminalize** — do not widen it.
- **These feeds run on a pool that BYPASSES RLS, so the `WHERE` clause IS the access boundary.**
  Adding a column to a `SET` or a `SELECT` moves no `WHERE`; state that explicitly.
- **`$N` placeholders only. No string interpolation anywhere in the slice.**

---

### 12. `backend/app/api/workflow_runs.py` (route + wire model) — MODIFIED

**In-file convention — the THREE places that must widen in LOCKSTEP.** RESEARCH §B6:

```python
# (a) the PostgREST projection — :230
.select("slug, phase_index, status")

# (b) the Pydantic model — :85-103
class WorkflowRunPhaseRead(BaseModel):
    slug: str
    phase_index: int
    status: str = Field(description=("pending | active | … "
        "⚠ THE AUTHORITY IS ``supabase/migrations/119_workflow_phases_cancelled.sql``'s "
        "``ADD CONSTRAINT workflow_phases_status_check`` ARRAY, NEVER this prose — this "
        "description listed only six literals from Phase 194 until 194.1 corrected it …"))
    phase_type: str | None = None      # DERIVED from the definition JSON, never a column

# (c) the serializer — :237-245
phases = [
    WorkflowRunPhaseRead(
        slug=row["slug"], phase_index=row["phase_index"], status=row["status"],
        phase_type=slug_to_type.get(row["slug"]),
    )
    for row in phase_rows
]
```

**Binding invariants:**
1. ⚠ **The route declares `response_model=WorkflowRunRead` (`:173`), which DROPS UNDECLARED KEYS
   SILENTLY.** 192.2's measured lesson on `api/workflows.py`: a green db test beside an unchanged UI.
   **Widening two of three produces a green model and an empty field** (Pitfall 1).
2. ⚠ **CONTEXT names only this file. THREE MORE narrowings exist (X-10)** — `.select()` at `:230`
   (this file), `api/threads.py:1191` + `models/thread.py:48`, and `db/workflows.py:1240`/`:1331`.
   **A plan that widens only `WorkflowRunPhaseRead` ships a run page with durations and a chat panel
   without them.**
3. **The status Field description is documentation, NOT the authority.** Update it if the set
   changes — it does not this phase (Phase 200 adds no phase status).
4. **V4 ACCESS CONTROL — the module's primary deliverable (`:24-47`).** `id` AND `user_id` on the
   SAME select, `.maybe_single()`, **404 never 403**, `Depends(require_canvas())` standing ALONE.
   **The widening must not add a second query, must not add a dependency, and must not change any
   404 body.** `test_188_workflow_run_read.py` tests 1, 2 and 6 pin this. The widened `.select()`
   adds columns to a query **already scoped** by `.eq("workflow_run_id", run["id"])` where `run`
   came from the ownership select — **no scope widens**. Say this in the plan; a reviewer will ask.
5. ⚠ **D-16 — this file OWES A HOT-FILE LEDGER ROW in the SAME COMMIT that modifies it.** It measures
   `3 / 3 / 260` — exactly at the G-5 threshold, the `libraryRow.ts` / `doorVocabulary.ts` state where
   a missing row costs most. **RESEARCH X-16 finds THREE MORE files owing rows — see § 20.**
6. **If the counts ride in `output` jsonb, the `.select()` must gain `output` too.** ⚠ **RESEARCH A7
   flags this for discuss:** `_persist_output` stores each executor's dict **full and inline**, so
   selecting `output` returns `field_map`, `citations` and prompts to the browser — *"a payload-size
   and information-exposure consideration nobody has weighed."* **Recommendation: a narrow computed
   projection or two small columns.**

---

### 13. `backend/app/api/threads.py:1191` + `backend/app/models/thread.py:48` — MODIFIED

**In-file convention — raw SQL through the RLS helper (`threads.py:1191-1194`):**

```python
phase_rows = await _rls_fetch(
    "SELECT slug, phase_index, status FROM workflow_phases "
    "WHERE workflow_run_id = $1 ORDER BY phase_index",
    UUID(phases_source_run_id) if isinstance(phases_source_run_id, str) else phases_source_run_id,
)
```
followed by the **same** `slug_to_type` derivation from the definition JSON that `workflow_runs.py`
performs — *"there is exactly one shape and this mirrors it rather than inventing a second."*

**The second wire model (`models/thread.py:48-60`):**

```python
class WorkflowPhaseState(BaseModel):
    """Phase 098-UAT run-honesty fix (B) — one ``workflow_phases`` row's durable
    per-phase status, surfaced so the frontend reconcile floor can rebuild an
    HONEST timeline for a terminal (completed/failed/cancelled) run instead of blanking it. […]"""
    slug: str
    phase_index: int
    status: str
    phase_type: str | None = None
```

**Binding invariants:**
1. ⚠ **This is a SECOND, INDEPENDENT wire model for the SAME rows**, feeding the workspace panel's
   `PhaseTimeline`/`PhaseCard` — which are `200-03`'s render targets. **CONTEXT does not name it.**
2. **Widen the raw `SELECT` and the model together** — same lockstep hazard as § 12, minus the
   `response_model` drop (this one returns a plain model).
3. ⚠ **`test_thread_workflow_endpoint.py::test_thread_workflow_state_shape` is ALREADY RED at HEAD**
   (`assert body["locked"] is True` → `assert False is True`) and it asserts the very shape this
   widens. **Record it RED-BEFORE as a baseline. Do not fix it silently and do not let it read as a
   regression.**
4. **`_rls_fetch` goes through the user-JWT path** — RLS backs the query. Adding columns changes no
   policy (§ 1 invariant 3).

---

### 14. `backend/app/services/harness/phase_types.py` (7 executors) — MODIFIED

**In-file convention — an executor returns a plain dict; the registry is the only importer.**

**The seven types and their real count facts (RESEARCH §B7 — the whole bounded surface):**

| # | `phase_type` | Executor | Real count? | Honest noun |
|---|---|---|---|---|
| 1 | `programmatic` | `_exec_programmatic` `:507` | ⚠ registry-dependent | — **do NOT declare this phase** |
| 2 | `llm_single` | `:540` | **NO** | — (emit no key) |
| 3 | `llm_agent` | `:566` | **YES** `len(source_refs)` | `sources` |
| 4 | `llm_batch_agents` | `:655` | **YES** `len(sub_run_ids)` | `agents` |
| 5 | `llm_human_input` | `:760` | **NO** | — (and this executor LEAVES — § 2) |
| 6 | `llm_emit` | `:1225` | **YES** `len(field_map)` | `fields` |
| 7 | `external_action` | `:2079` | **NO** — one send is not a count | — |

⚠ **CONTEXT D-07 says "eight shipped phase types". THERE ARE SEVEN (X-2).**
`PHASE_TYPE_REGISTRY_ENTRIES` (`:2398-2410`) has seven keys and its own comment says *"The 7
executors"*; `PhaseConfig`'s discriminated union (`models/harness.py:68,77,93,110,129,154,242`) has
seven members. **`llm_judge_rubric` is a `ValidatorSpec.kind`** (`harness.py:350`,
`validator_kinds.py:500` `@register_validator`), not a phase type.

⚠ **THE `PHASE_GLYPHS` GAP DOES NOT EXIST (X-2).** `soulData.ts:57-65` has **seven** keys and the
backend has **seven** phase types — **the map is TOTAL.** CONTEXT `<specifics>`, `.planning/ROADMAP.md`
and the sketch's `FORWARD-CHECK.md` all carry the error; **all three should be corrected.** A validator
is a gate attached to a phase, has no node, and needs no glyph.

**Binding invariants:**
1. **The count declaration is ONE additive line per type** — that is what keeps it "not a second
   concern" under G-5. `_effective_model_checked` (196) is the precedent: *"One function plus
   call-site edits is a call-out, not a concern."*
2. **Types 2, 5, 7 emit NOTHING — an ABSENT KEY.** Not `0`, not `null`-with-a-noun, not a dash.
3. **`programmatic` must NOT declare a count in this phase.** Its registry members are pluggable and
   their shapes differ per `fn`; `len(whatever_list_is_there)` is precisely the structural derivation
   D-07 rejected. A per-`fn` declaration would be a fifth site and a **second concern** — G-5 fires.
4. ⚠ **`source_refs: []` ⇒ `count: 0` IS EMITTED.** IDIOM-3. CONTEXT does not state this.
5. **`_build_phase_tool_context` is `(phase, ctx, *, model=None)`** — a stub lambda of the form
   `lambda phase, ctx: …` now raises `TypeError` (ledger, invariant 1). Widen any new stub to
   `lambda phase, ctx, **_: …`.
6. **G-5 named seam, still standing and NOT taken by the counts change:** *"one module per executor
   under `harness/phase_types/`."* D-13 takes **one** executor out — the human-input one — as the
   vehicle for its own fix.

---

### 15. `backend/app/services/harness_engine.py` (control flow, event-driven) — MODIFIED

**In-file convention — `PhaseOutcome` + one `if outcome.kind == …` arm per disposition.**

**Excerpt — the type and its declared kinds (`:573-579`):**

```python
# ── on_failure routing (Plan 05 / D-07/D-08/D-09) ────────────────────────────
# The outcome of running a phase through its bounded-retry gate loop.
#   kind == "completed"  → output is durable-ready; advance to the next phase.
#   kind == "skip_to"    → jump to target_slug (D-09); this phase is `skipped`.
#   kind == "fail_run"   → the run is `failed`; stop cleanly keeping partials (D-07).
PhaseOutcome = namedtuple("PhaseOutcome", ["kind", "output", "target_slug", "reason"])
```

**Excerpt — the arm shape to copy (`:1720-1745`, the `fail_run` arm):**

```python
        if outcome.kind == "fail_run":
            await fail_phase(pool, phase_id, outcome.reason)
            await finish_run(pool, run_id, "failed")
            await write_audit(pool, run_id, user_id=_audit_user_id,
                              event_type="run_failed", metadata={"reason": outcome.reason})
            await _emit(redis, stream_run_id, "run_failed", reason=outcome.reason)
            await _surface_failure_message(ctx, run_id, outcome.reason, pool)
            try:
                await _expire_pending_ask_user(pool, getattr(ctx, "thread_id", None), run_id,
                                               org_id=getattr(ctx, "org_id", None))
            except Exception:  # noqa: BLE001 — cleanup never crashes a terminal
                logger.exception(...)
            return  # stop — no further phases
```

**Excerpt — the WRITE-before-EMIT ordering (`:1580-1594`, the `phase_started` site):**

```python
        # WRITE-before-EMIT.
        await write_audit(pool, run_id, user_id=_audit_user_id, event_type="phase_started",
                          metadata={"phase": phase.slug, "phase_index": phase.phase_index})
        await _emit(redis, stream_run_id, "phase_started",
            phase=phase.slug, phase_index=phase.phase_index, phase_type=phase.config.phase_type,
        )
```

**The three transports that must ALL widen (RESEARCH §B10):**

| # | Transport | Site | Gains |
|---|---|---|---|
| 1 | SSE `phase_started` | `harness_engine.py:1589-1594` | `started_at` (the live tick's anchor, without a fetch) |
| 2 | SSE `phase_completed` | `:1962-1966` (siblings `phase_recorded_not_sent` `:1950`, `phase_transition` `:1975`) | `completed_at` + `{count, noun}` |
| 3+4 | fetch reconcile A & B | § 12, § 13 | all of the above |

**Binding invariants:**
1. **WRITE-before-EMIT everywhere.** Never emit a fact the DB does not yet carry.
2. ⚠ **THE PAUSE ARM MUST NOT `raise asyncio.CancelledError`.** The escape handler (`:1632-1716`)
   then (i) calls `_expire_pending_ask_user` — killing the prompt the person must answer — and
   (ii) calls `cancel_phase(pool, phase_id)` at `:1709`, flipping the phase to `cancelled`.
   **Both are exactly wrong for a pause** (Pitfall 3).
3. **It must not call `finish_run`** (anchor clear ⇒ unresumable) and **must not leave the phase
   `completed`** (`find_resumable_runs` needs an `active` row).
4. **The new kind is a NEW `PhaseOutcome` kind + its own arm**, added to the comment block at `:573`
   in the same edit — the block IS the kind vocabulary.
5. **BOTH transports, with FETCH AUTHORITATIVE** (the Claude's-Discretion answer). Reasons, each
   measured: CLAUDE.md D-v2.5-03; 196's live-SSE-lock failure that hid a shipped control;
   `PhaseTimeline`'s reconcile floor exists because a terminal run has no stream; and a live tick
   needs `started_at` at the instant the step starts, which only the SSE emit delivers without polling.
6. ⚠ **A crash/non-`CancelledError` escape leaves an `active` phase under a `failed` run — PRE-EXISTING
   and inherited** (`:1698-1706`, verbatim). This is why D-06 likely needs a seventh arm (§ IDIOM-2).

---

### 16. `backend/app/api/runs.py:503` `submit_ask_user_response` — MODIFIED

**In-file convention — BRANCH, never replace; persist FIRST, then publish.**

**Excerpt — the ownership + harness-fallback shape (`:512-560`, condensed):**

```python
    # ── Step 1: ownership check (T-085-T12 / T-085-T13 / D-062-12) ──
    # maybe_single() returns None on no-row instead of raising APIError.
    # 404 (NOT 403) on missing row — never leak existence to other users.
    row_resp = await aexec(supabase.table("runs").select("run_id, thread_id, status")
        .eq("run_id", str(run_id)).eq("user_id", current_user["id"]).maybe_single())
    row = row_resp.data if row_resp is not None else None
    if not row:
        # ── F10 (093 / D-07 / D-08): harness ask_user workflow_run-id fallback ──
        # […] BRANCH, never replace (D-08): the Step-1 ``runs`` SELECT above stays FIRST and
        # unchanged — Deep's runs-keyed ask_user path is byte-identical and still returns 200;
        # this fallback only engages AFTER that SELECT misses.
```

**Excerpt — Step 4, and why publish failure is not an error (`:639-655`):**

```python
    # ── Step 4: PUBLISH — wakes the paused SUBSCRIBE if it's alive ──
    # PUBLISH failure (no subscriber, worker dead, etc.) is logged but NOT
    # raised. The persist succeeded — the response is durable.
    try:
        from app.services.ask_user_service import publish_response  # noqa: PLC0415
        await publish_response(redis, run_id, body.tool_call_id, body.response_text, body.choice_index)
    except Exception:
        logger.exception("ask_user_response: publish failed for run %s tcid %s", run_id, body.tool_call_id)
    return {"status": "ok"}
```

**The re-drive analog — `harness_engine._build_resume_context` (`:2066`), called from
`resume_stranded_workflows` (`main.py:406-408`):**

```python
async def _build_resume_context(run, redis, pool):
    """Build the minimal run-identity ctx bag the engine threads through on resume.

    Mirrors the live producer ctx surface (run_id / thread_id / redis / pool / user / emit) […]
    Facet C (092-07): […] we MINT a fresh producer-shell ``runs`` row here (status='streaming',
    parent_run_id=None, NON-NULL placeholder model/provider […]). ``ctx.run_id`` stays the
    workflow_run id […]. The caller (``resume_stranded_workflows``) MUST terminalize this shell
    on every exit path (no stranded streaming row → the F2 self-heal is never defeated).
    """
```

**Binding invariants:**
1. ⚠ **D-10's sentence "Answering later still resumes; nothing is discarded" is NOT TRUE of the
   current architecture (X-3, R1).** `'paused'` has **zero writers**; the only re-drive in the product
   is `main.py`'s **boot-time sweep**; and once `subscribe_for_response` has timed out, the Step-4
   PUBLISH reaches no listener. **RESEARCH recommends option (b): an answer-triggered re-drive in
   `submit_ask_user_response` reusing `_build_resume_context` → `run_workflow`.** This is Assumption
   **A2** — the operator has not chosen between (b) and (c).
2. **BRANCH, never replace.** Step 1's `runs` SELECT stays FIRST and byte-identical. The paused
   re-drive engages only after the existing paths, exactly as the F10 fallback does.
3. **The re-drive MUST terminalize the minted producer shell on every exit path**, or the F2
   self-heal is defeated by a stranded `streaming` row.
4. **404 never 403; owner-scoped + anchor-confirmed.** No existence leak.
5. **Spawning must not block the 200.** The persist already succeeded; a re-drive failure is logged,
   never raised — same posture as the PUBLISH.
6. **After the change, verify the boot sweep STILL re-drives a paused run** — `resume_pending_prompt`
   re-emits the SAME prompt (`ask_user_service.py:239`); that is the existing 096-09 contract.

---

### 17. `backend/tests/test_188_workflow_run_read.py` — MODIFIED (Wave 0)

**In-file convention — a `TestClient` + `app.dependency_overrides[get_user_supabase_client]` +
`_FakeSupabase` row store.**

**The defect to fix (`:121-122`):**

```python
def select(self, *_columns, **_kwargs):
    return self
```

⚠ **A no-op that discards its column list and returns whole seeded rows** — the exact OPPOSITE of
PostgREST. A test that seeds `started_at` reads it back **even if `:230` was never widened**. *"The
suite that looks like it protects the wire cannot see the projection at all."* That is 192.2's
silent-drop lesson **with the safety net removed** (Pitfall 2).

**Binding invariants — encode at least one, preferably both:**
1. Make `_FakeQuery.execute` **project to the requested columns** (~4 lines), **with a positive
   control asserting an UNSELECTED key is ABSENT**.
2. Add a source fence over `api/workflow_runs.py` asserting the `.select(` string names each new column.
3. ⚠ **A plain `.select("*")` in production would also "work" and WEAKENS the read** — reject it.
4. **Warning sign to name in the plan:** *a test that would still pass if you deleted the `.select()`
   line.*

---

### 18. Frontend render targets — MODIFIED

#### `frontend/src/lib/api.ts:4178-4183` (type-only)

```ts
export interface WorkflowRunPhase {
  slug: string
  phase_index: number
  status: string
  phase_type: string | null
}
```

**Binding invariants:**
- **D-15 — the 197 decline HOLDS and its trigger must be VERIFIED BY GREP OVER THE REAL DIFF**, not
  by quoting the paragraph. RESEARCH §C13 gives the command:
  ```bash
  git diff -U0 -- frontend/src/lib/api.ts | grep -E '^\+' \
    | grep -E '^\+\s*export\s+(const|function|class|let|var|enum)\b' \
    | grep -v '^\+\s*export\s+\(interface\|type\)'
  ```
  **Expected: EMPTY.** Non-empty ⇒ `196-08`'s mock-factory failure mode (nine suites throwing at
  mount) becomes reachable and the trigger fires.
- ⚠ **The `WorkflowRunRead` docblock at `:4200-4204` GOES STALE and must be corrected in the same
  commit.** It says *"`claimed_at` is the ONLY honest elapsed anchor."* That stays true of
  `workflow_runs`, but the phase rows now carry both timestamps and `min(started_at) → max(completed_at)`
  is strictly better. **Measured why it matters: `claimed_at` is null on 100% of completed runs**
  (`WorkflowRunPage.tsx:849-851` — 149 completed rows, 0 with `claimed_at`).
- **Do NOT grow a second DB-status→client-union mapping.** `@/lib/phaseState`'s `DB_PHASE_STATUS`
  (`:59`) + `phaseStatusFromDb` (`:110`) is the one; `api.ts:4172`'s docblock says so outright.
- **Ledger:** `174 / 101 / 6357` (X-8 corrects CONTEXT's `99` phases) — **still the hottest file in
  the repository**, refuting CLAUDE.md's `threads.py` claim (X-16 / 196-09).

#### `frontend/src/components/panel/PhaseTimeline.tsx` (267 L) · `PhaseCard.tsx` (543 L) · `phaseStatusMeta.ts` (206 L)

- `PhaseTimeline` renders `<ol>/<li>/<PhaseCard>` (`:258`), aria-busy, a doing-now line. Sole mount:
  `WorkspacePanel.tsx:542`.
- `phaseStatusMeta.ts` is the **9-member status vocabulary** with the TOTAL `statusMeta()` lookup
  (excerpt in IDIOM-1) and the exported `statusWord()` (`:204`).
- ⚠ **`phaseStatusMeta.ts` is UNPINNED** (§ 7). If D-06's arms land here, pin it in the same commit.
- ⚠ **`WorkspacePanel` is a CROSS-SURFACE shell with exactly one production mount —
  `ChatLayout.tsx:673`.** No workflow page mounts it. **A change to the panel lands in CHAT first**;
  UAT on the workflow surface alone will miss it.
- **Its `statusWord`'s WR-05 lesson binds any new word:** never interpolate an internal status
  member into user-visible copy — route through the vocabulary table.

#### `frontend/src/components/workflows/PhaseSpineGraph.tsx` (278 L)

```ts
/** The verbatim read-only legend (locked contract — sketch 019-D / 103-PLAN). */
export const READ_ONLY_LEGEND =
  "READ-ONLY GRAPH · ordered by phase_index · run order (i→i+1) · " +
  "on-fail branch (skip_to_phase) · no depends_on · no parallel lanes · inspect, don't drag"

export interface PhaseSpineGraphProps {
  phases: PhaseSpecJSON[]
  selectedSlug: string | null
  onSelectNode: (slug: string) => void
  /** The page-owned folder/skill id→name maps […] Absent ⇒ every derived tier misses and the
   *  generic type sentence renders — never a fabricated or id-shaped face. */
  nameContext?: NameContext
}
```

⚠ **THE STRUCTURAL PROBLEM IN BS-4, and CONTEXT contradicts itself on it.** `<canonical_refs>` says
the spine *"reads a DRAFT definition and has no run, so any run-time word on it is a fabricated claim
— 199-02 refused exactly that."* `<specifics>` says the slice *"clears the spine's per-step timings."*
**Both cannot be true of the same component in the same mode.** The reconciliation is **D-09**:
*"the same spine re-read in the PAST TENSE — one component, two tenses."*

**⇒ Give `PhaseSpineGraph` an OPTIONAL run-tense prop, absent ⇒ byte-identical authoring render.**
That is the house pattern three times over (`WorkflowCanvas.runState`, `WorkflowCanvas.editable`,
`PhaseFormPanel.rails`), and `nameContext` above is this file's own instance of it. The authoring
mount at `WorkflowBuilderPage.tsx:2136` passes nothing and stays unchanged; **the receipt mounts on
`WorkflowRunPage.tsx`** (it already holds run + definition in one fetch), which keeps 199-02's
refusal intact **by construction**. ⚠ **Say this in the plan or `200-04` will re-litigate the refusal.**

⚠ **Its suite has ~4 cases of SLACK** (pinned 20, running ~24). *"A pinned TOTAL rising proves nothing
about the NEW cases, because slack inside an already-listed file absorbs them."* **De-slack it.**

#### `frontend/src/components/workflows/WorkflowCanvas.tsx` (1390 L) · `FlowEdge.tsx` (378 L)

**The seam D-08 rides — `WorkflowCanvas.tsx:555-567`:**

```ts
  /**
   * One node's live run state, `undefined` when the run says nothing about it. The PAGE
   * owns all of it — the join onto the definition (D-188-01), the reading and the words —
   * so **this canvas derives no run state, reads no step ordinal and imports no
   * vocabulary**; its own suite greps for all three. Optional and inert when absent.
   */
  runState?: (slug: string) => NodeRunState | undefined
```

**`FlowEdge.tsx` already renders labels — the payload label has a home (`:196-204`):**

```ts
/** ARMED. Reads as a state of the run, not as a judgement: the flow goes through you. */
export const DETOUR_ARMED_LABEL = "you say yes"
/** OPEN. The sketch wrote *"nobody asked"*, which reads as a verdict on the author.
 *  Reworded to the same fact stated as a STATE of this point in the run […] */
export const DETOUR_OPEN_LABEL = "nobody is asked"
```

**Binding invariants:**
- **D-08 — ONE mechanism.** The edge label is the **upstream node's already-declared count**, read
  through `runState`. **The canvas gets no second counting path and no new fetch.** An edge whose
  upstream step declared no count renders **no label** (D-07).
- ⚠ **`WorkflowCanvas.tsx` is mounted on BOTH pages** (`WorkflowBuilderPage.tsx:2106` editable;
  `WorkflowRunPage.tsx:1091` `editable={false}` + `runState`). **Any `200-05` change is a change to
  the run surface too**, so a regression here lands on `200-06`'s screen.
- **The canvas must keep deriving nothing** — no run state, no step ordinal, no vocabulary import.
  Its own suite greps for all three.
- **A live ESM-cycle constraint is FENCED, not documented:** `WorkflowCanvas` imports `FlowEdge`'s
  VALUE at module scope for the `edgeTypes` map, **so an extracted module must not import back**.
  Enforced by a `?raw` cycle fence in `WorkflowCanvas.test.tsx` with inline positive controls,
  observed RED against a deliberate back-import.
- **Ledger:** `26 / 7 / 1390` (D-14 re-derive; the ledger cell reads `25 / 7 / 1405` — stale, and
  **lines went DOWN**, which is 199 subtracting: the desirable direction).
- **Icon marks:** `icon-convention.md` §1/§2/§4 are the authority. ⚠ **N-5: every in-scope sketch
  screen draws Material Symbols ligature names** (`description`, `bolt`, `psychology`, …).
  **No Material Symbols ligature is a shippable atom.** §4's last row reads *"the 6 workflow phase
  types"* — **7 since 189** (X-15); correct it if `200-05` touches §4 anyway.

#### `frontend/src/pages/WorkflowRunPage.tsx` (1197 L)

**Binding invariants:**
- ⚠ **THE NO-PREVIEWER FENCE STANDS (D-17).** `WorkflowRunPage.test.tsx` carries an ACTIVE fence —
  *"promises no preview: the previewer is neither imported nor named"* — with its reason recorded
  verbatim. **Mounting `FilePreview` would break a tested decision.** SEED-148's run-surface half was
  closed by Phase 195; under D-02 it is a **green row: verify, do not rebuild.**
- ⚠ **X-9: the "correct `SEED-148`'s frontmatter" action is ALREADY DONE.** Do not re-plan it.
- **`@/lib/fmtElapsed` is the ONE formatter** (imported `:68`). No fourth.
- **The two empty strings must stay byte-identical** and each is pinned at exactly one occurrence
  (IDIOM-3 excerpt).
- ⚠ **`BUG-260610-01`'s frontmatter says `status: open` DELIBERATELY** — the duplicate-avatar half is
  live and a `folded` status would hide it from the routing scan. **Do not flip it.**
- **Its suite is pinned at 108 and is one of SEED-171's five flaky suites** — see § Shared Patterns.

---

### 19. `frontend/src/components/workflows/PhaseFormPanel.tsx` (1290 L) — MODIFIED

**The ABSOLUTE-ZERO hook pin, verbatim (`PhaseFormPanel.test.tsx:711-721`):**

```ts
import phaseFormPanelSource from "./PhaseFormPanel?raw"          // :23
...
it("SOURCE — the panel computes NOTHING for the picker: an ABSOLUTE zero, not a non-increase", () => {
  // Built, never spelled — this assertion would otherwise count itself.
  for (const token of ["use" + "Memo(", "use" + "State(", "use" + "Effect("]) {
    expect(phaseFormPanelSource.split(token).length - 1).toBe(0)
  }
})

it("POSITIVE CONTROL — the zero-compute needle really can find what it forbids", () => {
  const planted = "  const rows = use" + "Memo(() => models.filter(Boolean), [models])"
  expect(planted.split("use" + "Memo(").length - 1).toBe(1)
})
```

**Its docblock, clause 3 verbatim (`:634-661`):**
> *"`useMemo` / `useState` / `useEffect` are at an ABSOLUTE ZERO in this file's source. Not "no
> increase" — zero, because all three measured zero before this phase, and a non-decrease criterion on
> a file that already reads 0 is a criterion that permits the first one."*
>
> *"⚠ THE MATCHED TOKENS ARE BUILT, NEVER SPELLED … A comment that names the needle is COUNTED BY the
> fence that greps for it — the 187-24 trap, which this phase hit three separate times while writing
> these very paragraphs."*

**Binding invariants:**
1. **D-11 — honour by EXTRACTION, never re-baseline.** Any state goes in a new leaf (§ 10) and the pin
   passes **UNEDITED** — proof rather than promise. `199-06` is the precedent.
2. ⚠ **`useCallback` / `useRef` / `useReducer` / `useId` are NOT in the needle set.** A refactor
   reaching for `useRef` would pass the pin while defeating its intent. **State the INTENT ("the panel
   computes nothing") in the acceptance criterion, not just the pin.**
3. ⚠ **It is a SUBSTRING scan over the WHOLE FILE, comments included.** Any docblock this phase adds
   that spells `useState(` **turns the pin red.**
4. **The other fences in the same file that constrain § 10 and SP-2:**
   - `:626-631` — exactly ONE `<TemplateNameCheck` mount line, gated `pt === "llm_emit"`, forwarding `{...nameCheck}`.
   - `:693-703` — exactly FOUR `<ModelField` mounts, compared as a **sorted SET**, one per
     `["llm_agent","llm_batch_agents","llm_emit","llm_single"]`, each forwarding `{...modelPicker}` and `onPersist`.
   - `:705-709` — `showFitness` on the `llm_emit` mount and only it.
   - `:723+` — absent registry ⇒ **no control at all, emphatically no free-text box** (AUTH-04).
   - `:676-677` non-vacuity: source length > 1000 and contains `export function PhaseFormPanel`.
   - `rails.test.tsx:526` — `import.meta.glob` scan: no other module exports a phase-config form component.
   - `rails.test.tsx:345/:355` — `programmatic` / `llm_human_input` still show no model, no tools, no folder scope.
5. **The one-gated-line order is MECHANICALLY GUARDED** (ledger, PhaseFormPanel §): a source fence
   splits the panel's `?raw` text, filters mount lines, asserts `toHaveLength(1)`, and asserts that
   line carries both the gate and the spread. **Four consecutive phases have honoured it.**
6. ⚠ **THE EIGHTH WR-04 SINK IS IN THIS FILE** — `friendlyToolName` at `:873-883` (IDIOM-1).
   **Route it through `own()`, RED-first** (a case asserting `friendlyToolName("constructor") === "constructor"`).
7. ⚠ **SP-1's "3 of 27 named" is STALE (X-13)** — `friendlyToolName` has **FIVE** entries.
   `200-01` re-measures against `rails.toolOptions` rather than inheriting the number.
8. **Ledger:** `22 / 11 / 1290` (X-7 corrects CONTEXT's `10` phases).

---

### 20. `scripts/vitest-count-gate.cjs` · `CLAUDE.md` · `docs/HOT-FILE-LEDGER.md` — MODIFIED

**In-file convention — TARGETS and BASELINE are TWO KNOBS (`vitest-count-gate.cjs:2540-2546`):**

```js
  // TARGETS and BASELINE are TWO knobs: TARGETS decides what RUNS, BASELINE decides what is
  // PINNED, and a page-level suite lands outside BOTH by default because the directory entry
  // above only covers `src/components/workflows`. Round 5 pinned three suites and still left
  // GAP A's only end-to-end wire fence unguarded — this file was never even EXECUTED by the gate.
const TARGETS = [
  "src/components/workflows",                      // directory entry — sweeps everything under it
  "src/pages/WorkflowBuilderPage.canvas.test.tsx", // file entries for anything outside it
  "src/pages/WorkflowRunPage.test.tsx",
  ...
]
const BASELINE = { "PhaseSpineGraph.test.tsx": 20, "WorkflowRunPage.test.tsx": 108, ... }
```

**Binding invariants:**
1. **Pin every new leaf in the SAME COMMIT that creates it** — *"an unpinned file is not a lightly-
   guarded one, it is an unguarded one."* Check **both knobs**: a new file under
   `src/components/workflows` is already RUN; what it needs is a `BASELINE` entry. A new file under
   `src/providers/` or `src/pages/` needs **both**.
2. **Raising a pin necessarily DELETES one line, so a `grep -c '^-[^-]'` expecting 0 is WRONG —
   but ADDING a pin is `+n / -0`.** 197's edit here was `+44 / -0`.
3. **Re-derive the baseline in `200-01` and record it as THE PHASE BASELINE.** Measured 2026-08-19:
   ```
   total 4970  ·  failed 0  ·  pinned total 4543
   count gate OK — 96/96 pinned files present, no per-file decrease, 0 failing.
   ```
   ⚠ **CLAUDE.md's `4594 · 4328 · 92/92` is the FIFTH rot of this constant and it happened the SAME
   DAY the fourth was written** (X-12). **Every later plan compares against `200-01`'s number, not
   CLAUDE.md's.** A growing number is the gate WORKING; its contract is *no per-file DECREASE* and
   *zero failing*, never a fixed total.

**⚠ FOUR FILES OWE LEDGER ROWS, NOT ONE (X-16). CONTEXT D-16 names only the first:**

| File | measured | Status |
|---|---|---|
| `backend/app/api/workflow_runs.py` | `3 / 3 / 260` | **at threshold — no row** (D-16) |
| `frontend/src/components/panel/PhaseTimeline.tsx` | `7 / 5 / 267` | ⚠ **G-5 FIRES — no row** |
| `frontend/src/components/panel/phaseStatusMeta.ts` | `2 / 2 / 206` | below threshold — no row |
| `frontend/src/components/workflows/FlowEdge.tsx` | `2 / 2 / 378` | below threshold — no row |

**Add rows for the two below threshold too** — *"listed BELOW the threshold on purpose"* is the
ledger's own precedent (`fileIcon.tsx`, `useTemplateFirstDraft.ts`). This is the
`WorkflowsPage.tsx`-for-ten-phases failure recurring: **a hot file missing from the scan list is
permanently invisible to its own guardrail.**

**The section shape to copy (`docs/HOT-FILE-LEDGER.md`, every entry):**
```markdown
## `path/to/file.ext`

**Re-derived <date>:** `N commits / M phases / L lines` · **G-5 <verdict>** — <disposition>.

### Phases touched (verbatim)
<list> — <derivation command>

### G-5 status (verbatim)
<the fire or the honouring, the measured test applied, and THE NAMED NEXT SEAM>
```

**Same-commit sync rule:** the CLAUDE.md table row and the `docs/HOT-FILE-LEDGER.md` section land
**together**. *A row without a section, or a section without a row, is drift.* Then run
`node scripts/check-claude-md-size.cjs` (C-11).

---

## Shared Patterns

### The optional-prop, absent-is-byte-identical seam
**Source:** `WorkflowCanvas.tsx:567` · `PhaseSpineGraph.tsx:82` (`nameContext?`) · `PhaseFormPanel` rails
**Apply to:** every run-tense variant this phase adds (the spine's receipt tense, the canvas edge
label, any new panel section).
```ts
runState?: (slug: string) => NodeRunState | undefined
```
Mounted with it on the run surface (`WorkflowRunPage.tsx:1091-1099`) and without it on the builder
(`WorkflowBuilderPage.tsx:2106`). **`PhaseFormPanel.rails.test.tsx:125` even pins that the prop is
load-bearing** ("the rails-absent and rails-present renders are NOT the same DOM"). **Never a second
component.**

### One home per concern, one string home per surface
**Source:** `doorVocabulary.ts` · `libraryVocabulary.ts` · `decisionsVocabulary.ts` · `runVocabulary.ts`
**Apply to:** § 6 (`receiptVocabulary.ts`), and to any word this phase adds anywhere.
**Never cross the registers.** `libraryVocabulary.ts` the MODULE is fenced to `library/**` by a
14-path list; only its REGISTER is the model (X-11).

### Characterization capture must PREDATE the change
**Source:** `WorkflowDoorSwitch.baseline.test.tsx` docblock — *"A baseline taken after the edit proves
the edit against itself."* Re-proved in 188.1, 188.2, 192-06, 192-08, 192.2-02, 193-05.
**Apply to:** the human-input executor pin (§ 4), the D-03 checklist commit
(`git diff --name-only` over that commit is the proof rather than a promise), and the backend
failure-set baseline (§ 2, proof 4).

### A green-skip / an unfired fence is NOT a passing guard
**Source:** `test_migration_119.py` docblock · `librarySubtree.fences.test.ts:160-210` ·
`PublishGauntlet.test.tsx:1304`
**Apply to:** every fence and every migration test this phase writes.
*"This project has shipped five inert fences in Phase 193.2, four in 193.1, three in 192.1 and five in
190 — every one caught by PLANTING, none by reading."*

### The SEED-171 triage procedure (⚠ NOT the cap)
**Source:** `CLAUDE.md` § Parallel execution · `SEED-171:147-149`
**Apply to:** `200-05` and `200-06` — **TWO of SEED-171's five flaky suites are their primary suites**
(`WorkflowRunPage.test.tsx` pinned 108; `WorkflowBuilderPage.canvas.test.tsx`), plus one adjacent
(`WorkflowBuilderPage.session.test.tsx`, edited by `200-03`/`200-04`).
1. **Do NOT reach for the cap.** `GSD_VITEST_MAX_WORKERS=2` stands and adjusting it is measured NOT to
   fix these.
2. **Capture failing filenames from the gate's OWN PERSISTED JSON before re-running anything.**
3. Check each against `git diff --numstat <base> HEAD` and `git status --short`.
4. Byte-unchanged + one of the five ⇒ record as an observation. **Say "provably unmodified", never "fine".**
5. ⚠ **Red is sometimes REAL** — `196-08` hit `failed 249` because nine `@/lib/api` mock factories did
   not declare a newly-added export. **§ 18's grep is what keeps that unreachable here.**
6. ⚠ **`count gate OK` is not reliably reachable on demand** — pair it with **per-file deltas and the
   explicitly-run in-scope suites**, which are deterministic. Never write "the gate is green" as the
   sole criterion.

### Serialize DB-mutating plans
**Source:** CLAUDE.md parallel-execution rule 4
**Apply to:** the plan authoring/applying migration 121 + `test_migration_121.py` — **dispatched
ALONE**, never as one of the two concurrent plans. `tests/unit/**` and
`tests/test_188_workflow_run_read.py` are fully mocked and safe to run concurrently.

### Build tokens, never spell them (the 187-24 trap)
**Source:** `PhaseFormPanel.test.tsx:711` (`"use" + "State("`) · `runFacts.ts` header (the fifth
occurrence) · `DecisionsList.tsx:125-127` (`196-08` tripped it four times, *"once inside the comment
written to explain the first three"*)
**Apply to:** every docblock, comment and plan artifact that a `?raw` fence will read.

---

## No Analog Found

| File | Role | Data flow | Reason |
|---|---|---|---|
| `backend/app/db/workflows.py::pause_run` | db writer (run status) | CRUD | ⚠ **`workflow_runs.status = 'paused'` has ZERO writers in the entire backend.** The only `UPDATE workflow_runs SET status` is `finish_run` (`:1754`), and it is **unusable** (anchor clear ⇒ unresumable). Copy `cancel_active_phases`' *shape* (a single keyed `pool.execute` + a docstring naming the key axis) — but there is no existing pause semantics to copy. **This is R1, the largest under-estimate in CONTEXT.** |
| The answer-triggered re-drive in `submit_ask_user_response` | route → engine | event-driven | ⚠ **No resume path exists outside `main.py:406-408`'s boot sweep.** `_build_resume_context` (`harness_engine.py:2066`) is the closest thing and is a **partial** analog — it is written for a process-restart sweep with no request context, so its service-role/org-resolution machinery is not what a request-scoped re-drive needs. **RESEARCH recommends reusing it anyway (option b); the planner must budget for the divergence.** |

Also record: **RS-1 (the run surface's NOW capture)** has no shipped half to compare against —
`JOURNEY.run-surface.now` is literally `null`. **REPORT under D-02**, do not fabricate a comparison.

---

## Analog Replacements

**Two suggestions in the kickoff table were replaced after measurement:**

1. **`gutterTokens.fences.test.ts` → `PublishGauntlet.test.tsx:1095-1334` + `librarySubtree.fences.test.ts:82-210`.**
   `gutterTokens.fences.test.ts` is a **CSS-chain** fence (utility → tailwind config key → CSS var, in
   both themes). Its transferable lessons are real but narrow: *"`?raw` cannot read CSS under vitest —
   it returns the EMPTY STRING silently"* and *"assert non-vacuity BEFORE contents"*. **It is the wrong
   role and the wrong data flow for a `MUST NOT RENDER` fence over a rendered screen.** The
   `PublishGauntlet` role-SET scan is the only fence in the tree **proved able to fire against a live
   planted violation** — which is precisely `199-03`'s lesson and the kickoff prompt's own stated
   requirement. `librarySubtree.fences.test.ts` supplies the complementary half (an explicit path list
   with `toHaveLength`, so forgetting to add a file is impossible).

2. **`libraryVocabulary.ts` → `doorVocabulary.ts` / `decisionsVocabulary.ts` for the MODULE shape.**
   Flagged in the kickoff prompt and CONFIRMED by measurement (X-11): `libraryVocabulary.ts` is fenced
   to `library/**` by `librarySubtree.fences.test.ts`'s explicit 14-path list. Its **register** (the
   past tense, the settled business-noun tone) is what D-09 means and is what `receiptVocabulary.ts`
   should copy. **Its module is not importable from outside the subtree without breaking the fence's
   own contract.**

**Two suggestions CONFIRMED as correct:** `119_workflow_phases_cancelled.sql` (§ 1) and
`run_transport.py` (§ 2) — both verified at HEAD, both carry the exact discipline the phase needs.

**One suggestion PARTIALLY confirmed:** *"whatever the nearest BACKEND characterization pin is — find
it."* Found: `backend/tests/test_cancel_run.py` (§ 4). It is the only backend file in the tree whose
docblock names a case as a *characterization* test and separates it from a RED→GREEN gate.

---

## Metadata

**Analog search scope:** `supabase/migrations/` · `backend/app/{api,db,models,services,utils}/` ·
`backend/tests/` · `frontend/src/{components/{workflows,workflows/library,panel},providers,hooks,lib,pages}/` ·
`scripts/` · `docs/HOT-FILE-LEDGER.md`
**Files read for excerpts:** 26
**Pattern extraction date:** 2026-08-19
**Upstream inputs:** `200-CONTEXT.md` (D-01…D-17) · `200-RESEARCH.md` (§A–§F, X-1…X-16) ·
`200-VALIDATION.md` (Wave 0) · `CLAUDE.md` · `docs/HOT-FILE-LEDGER.md`
**⚠ Validity:** RESEARCH's own expiry is **2026-08-26**. Every `:NNN` in this file inherits it —
**re-derive line numbers before relying on them.** Four pointers were already measured stale this
phase (X-4 ~54 lines, X-5 67 lines, X-7, X-8).
