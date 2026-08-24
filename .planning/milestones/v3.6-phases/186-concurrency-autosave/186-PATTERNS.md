# Phase 186: Concurrency & Autosave - Pattern Map

**Mapped:** 2026-08-01
**Files analyzed:** 16 (4 created, 12 modified) + 2 read-only fences
**Analogs found:** 16 / 16 (every file has a shipped in-repo analog — this phase invents no new idiom)

> **Scope of this document.** CONTEXT.md's D-186-01..17 are LOCKED and RESEARCH.md's findings
> are VERIFIED — nothing here re-derives or re-litigates either. This file answers one
> question: *for each file, which shipped file is the idiom, and what exactly does it look
> like?* Every excerpt below was read at the cited `file:line` in this session.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| **NEW** `frontend/src/hooks/useDraftPersistence.ts` | hook | request-response (debounced write) | `frontend/src/hooks/useLiveValidation.ts` | exact (role) / deliberate divergence on abort |
| **NEW** `frontend/src/hooks/useDraftPersistence.test.tsx` | test | request-response | `frontend/src/hooks/useLiveValidation.test.tsx` | exact |
| **NEW** `backend/tests/unit/test_186_concurrent_patch.py` | test | CRUD (live DB) | `test_publish_flip.py:21-46` + `test_103_draft_crud.py:77-107` + `test_103_published_409.py:80-113` | exact |
| **NEW** `backend/tests/unit/test_186_publish_race.py` | test | CRUD (live DB) | same three | exact |
| `backend/app/db/workflows.py` | data-access | CRUD | in-file: `publish_definition:310-332` (sentinel) + `update_workflow_definition:392-422` (owner scope) | self-analog |
| `backend/app/api/workflows.py` | controller | request-response | in-file: `update_draft:906-938` + `publish_workflow:769-822` (3-way refusal mapping) | self-analog |
| `backend/app/services/harness/publish_service.py` | service | batch / staged orchestration | in-file: the WR-03 `-1` branch at `:358-375` + `_block:396-424` | self-analog |
| `frontend/src/pages/WorkflowBuilderPage.tsx` | page (composition point) | request-response | in-file: the `useLiveValidation` composition at `:163`, `:682-685`, `:727` | self-analog |
| `frontend/src/components/workflows/builderStore.ts` | store | event-driven | in-file: the untracked setters `:517-523` + the dirty subscription `:585-597` | self-analog |
| `frontend/src/components/workflows/PublishGauntlet.tsx` | component | request-response | in-file: `STAGES:112-121` + `GauntletSpine:329-338` + `wordedHeadline:520-526`; wording-map analog `verdictModel.ts:79-98` | self-analog |
| `frontend/src/lib/api.ts` | transport client | request-response | in-file: `WorkflowValidateUnreadableError:3445-3467` (named 422 error) + `publishWorkflow:3619-3638` (WR-02 malformed-body guard) | self-analog |
| `backend/tests/unit/test_103_published_409.py` | test (UPDATE, do not delete) | CRUD | itself — assertion reshape only | n/a |
| `frontend/src/components/workflows/builderStore.test.ts` | test (retarget) | event-driven | itself (`:337-339`) | n/a |
| `frontend/src/components/workflows/PublishGauntlet.test.tsx` | test (F7, new case) | request-response | itself | n/a |
| `frontend/src/components/workflows/WorkflowCanvas.editing.test.tsx` | test (F12, extend spy) | — | itself (`:75-85`, `:431`) | n/a |
| `frontend/src/pages/WorkflowBuilderPage.header.test.tsx` | test (F16, new case) | — | itself (`:115-120` `?raw` imports) | n/a |
| **READ-ONLY** `frontend/src/components/workflows/canvasNudge.ts` | utility | browser-local | — MUST NOT CHANGE (D-186-02) | fence |
| **READ-ONLY** `frontend/src/components/workflows/WorkflowCanvas.tsx` | component | — | — MUST NOT CHANGE (G-5, extraction due 188) | fence |

---

## Pattern Assignments

### `frontend/src/hooks/useDraftPersistence.ts` — NEW (hook, debounced write)

**Analog:** `frontend/src/hooks/useLiveValidation.ts` (275 lines, read whole).
Mirror its **composition** exactly; diverge on **abort** only, and say so in the docblock.

**1 — Docblock shape** (`useLiveValidation.ts:1-83`). The analog opens with a
`── SECTION ──` docblock that names each rule *and its reason*, including its own
construction rule. Copy that structure; the executor's new hook must state (a) what it
copies verbatim, (b) what it deliberately diverges on. The precedent sentence to imitate:

```ts
/**
 * ── COMPOSED, NOT COPIED (the `usePanelReconcile.ts:1-26` precedent) ────────────────
 *
 * There is no shipped debounced-fetch hook to copy, so this one is composed from the two
 * halves the app already has:
 *   1. The AbortController half — `usePanelReconcile.ts:114-130` (a controller per effect
 *      run, aborted in the cleanup) plus its double-shaped abort-error check at `:84-92`,
 *      copied verbatim rather than paraphrased.
 *   2. The timer half — `lib/throttle.ts`'s hand-rolled `setTimeout` closure, which is the
 *      house answer to "do not add a debounce dependency". ...
 */
```

**2 — Exported constant with a stated reason** (`useLiveValidation.ts:89-96`):

```ts
/** The quiet period an edit burst coalesces over before one request is issued (D-184-13).
 *  ONE window covers structural and config edits alike — the server has an opinion about
 *  both, so splitting them would mean two loops disagreeing about which answer is current. */
export const VALIDATE_DEBOUNCE_MS = 500

/** The minimum time the checking beat stays visible once it has started, so a fast answer
 *  cannot make it strobe on every keystroke. */
export const CHECKING_MIN_VISIBLE_MS = 300
```

`AUTOSAVE_DEBOUNCE_MS` gets the same treatment. The reason line is not optional — the
suite and the plan-checker both read these docblocks.

**3 — Discriminated union, never a boolean pair** (`useLiveValidation.ts:103-127`). This is
the shape `PersistState` must take (RESEARCH §3 says a flat 4-value enum cannot represent
*held* + *conflict*):

```ts
/**
 * The loop's four distinguished states, in the `PublishOutcome` discriminated-union idiom
 * whose own docblock states the rule this inherits: *a binary ok/error handler is
 * FORBIDDEN*. A boolean pair could represent "clean AND degraded" and "checking AND idle";
 * this cannot.
 *
 *   idle      — nothing has been asked yet (D-184-15), and nothing is claimed.
 *   checking  — the FIRST check is in flight and there is no previous answer to hold. It
 *               deliberately carries no `ok` field: an unanswered check must not be able to
 *               render as a verdict of any kind.
 *   ...
 */
export type ValidationState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "verdicts"; ok: boolean; verdicts: Verdict[]; checking: boolean }
  | { kind: "degraded"; cause: DegradedValidationCause; verdicts: Verdict[]; checking: boolean }
```

**4 — Error classification by NAME, never `instanceof`, never prose**
(`useLiveValidation.ts:175-186`). This is the exact function the new hook copies for
`stale_token` / `already_published` / `unreadable`:

```ts
/**
 * Which honest line the caller should render. Branches on the error's NAME rather than on
 * `instanceof`, so a rejection that crossed a module or realm boundary still classifies —
 * and so this never has to parse a message. Anything that is not the typed shape rejection
 * is the unreachable class: a real network failure, a timeout, an expired token, and a
 * mid-session flag flip all mean "we could not get an answer", and all of them fail closed.
 */
function causeOf(err: unknown): DegradedValidationCause {
  const name =
    err && typeof err === "object" && "name" in err ? (err as { name: string }).name : ""
  return name === "WorkflowValidateUnreadableError" ? "unreadable" : "unreachable"
}
```

**5 — The debounce timer + cleanup** (`useLiveValidation.ts:206-272`). The whole effect
body, which is the shape to mirror — note the **deps are `[def, enabled]` and nothing
else** (RESEARCH §3's hard rule), the guard-return before any work, the monotonic
`seqRef`/`appliedRef` pair, and the cleanup that clears every timer it created:

```ts
  // Monotonic per effect run. Survives a StrictMode double-invoke: the first run's timer is
  // cleared by its own cleanup before it can fire, and the second run simply takes the next
  // sequence number.
  const seqRef = useRef(0)
  // The highest sequence already rendered. A resolution that is not strictly newer is dropped.
  const appliedRef = useRef(0)

  useEffect(() => {
    // D-184-15 — nothing is asked, and nothing is claimed. ...
    if (!enabled || def === null) return

    const seq = ++seqRef.current
    const controller = new AbortController()
    ...
    const debounceTimer = setTimeout(() => {
      setState(beginBeat)
      ...
      validateWorkflow(def, controller.signal)
        .then((res) => {
          // BRACES, and the only staleness test on this path — see the docblock.
          if (seq <= appliedRef.current) return
          appliedRef.current = seq
          ...
        })
        .catch((err: unknown) => {
          // Superseded by a newer edit — dropped silently, never degraded.
          if (isAbortError(err)) return
          ...
        })
    }, VALIDATE_DEBOUNCE_MS)

    return () => {
      // An edit inside the window cancels the pending call outright — zero requests issued.
      clearTimeout(debounceTimer)
      if (minVisibleTimer !== null) clearTimeout(minVisibleTimer)
      // BELT: an in-flight call is aborted. ...
      controller.abort()
    }
  }, [def, enabled])
```

> **⚠ THE ONE DELIBERATE DIVERGENCE.** `controller.abort()` in the cleanup (`:270`) is
> **correct for a read and forbidden for a write** (RESEARCH §3 / anti-patterns). Replace
> it with the `inFlightRef` / `pendingRef` / `tokenRef` single-flight queue and write the
> reason in the docblock — the analog's own style is to *state what it copies and why it
> diverges*, so a divergence with no sentence is a style violation as well as a hazard.

**6 — The create-once guard, moved VERBATIM** (`WorkflowBuilderPage.tsx:532-538`,
`:1128-1146`). RESEARCH §3: *"Move it into the hook verbatim; do not re-derive it."*

```ts
  // Synchronous mirrors of the persist state. setDraftId is async, so several
  // onPersist calls can fire while draftId is still null and each would re-run
  // createWorkflowDraft → a UniqueViolation storm on (slug, version). The refs
  // collapse the first save to EXACTLY ONE create (UAT-103 save-loop fix). For
  // Open/Tweak the ref is pre-seeded → every save PATCHes the existing row.
  const draftIdRef = useRef<string | null>(initial?.draftId ?? null)
  const creatingRef = useRef(false)
```

```ts
  const onPersist = useCallback(async (): Promise<boolean> => {
    const snapshot = store.getState()
    if (snapshot.builderPhase !== "drafted") return false
    const def = selectDefinition(snapshot) as unknown as Record<string, unknown>
    if (draftIdRef.current === null) {
      // First save: create EXACTLY ONCE. If a create is already in flight,
      // skip — re-running it would collide on UNIQUE(slug, version) → 500.
      if (creatingRef.current) return false
      creatingRef.current = true
      try {
        const created = await createWorkflowDraft(def)
        draftIdRef.current = created.id // synchronous: subsequent calls PATCH
        setDraftId(created.id)
      } finally {
        creatingRef.current = false
      }
    } else {
      await updateWorkflowDraft(draftIdRef.current, def)
    }
    // Phase 184-11: a CONFIRMED write is the only thing that clears `dirty` — the store's
    // `markSaved()` is its one setter and it writes nothing itself. ...
    store.getState().markSaved()
    return true
  }, [store])
```

Note the two load-bearing details the hook inherits: the store read is a **side-effect
`getState()`**, not a closure over rendered state (that is what keeps the callback
referentially stable across every edit), and `markSaved()` is called **only after a
confirmed write** — which is exactly the "never a false `Saved ✓`" rule (F8).

**7 — How the page consumes a hook of this shape.** Three lines, all in
`WorkflowBuilderPage.tsx`:

```ts
// :163  — a plain named import, no provider, no context
import { useLiveValidation } from "@/hooks/useLiveValidation"

// :682-685 — the CALLER CONTRACT: a `useMemo` over the store slices, so identity
//            changes once per EDIT, not once per render.
//            deps are [builderPhase, meta, phases]
const definition = useMemo(...)

// :727 — one call, result held as a plain value and passed down as props
const validation = useLiveValidation(definition, hasEdited)
```

The `definition` memo already exists and already covers `meta` — so binding a KB produces
a new identity and the autosave effect *does* fire. (What it does **not** do is set `dirty`
or `hasEdited` — see the `builderStore.ts` section.)

---

### `frontend/src/hooks/useDraftPersistence.test.tsx` — NEW (test)

**Analog:** `frontend/src/hooks/useLiveValidation.test.tsx`.

**Module mock — spread the REAL module, override ONE export** (`:38-43`). Do not
hand-write a replacement object (that is the shipped mock-completeness failure mode):

```ts
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return { ...actual, validateWorkflow: vi.fn() }
})

const mockedValidate = vi.mocked(validateWorkflow)
```

Its docblock states why, verbatim (`:4-12`):

> *"That suite replaces the whole module with a hand-written object, which is the shipped
> mock-completeness failure mode: every symbol the render path reaches has to be re-listed,
> and one that is forgotten fails far from its cause. This suite spreads the REAL module and
> overrides exactly one export (the shipped `FailReason.test.tsx:40-48` idiom), so
> completeness is automatic AND the typed shape-rejection error under test is the REAL class
> from `lib/api.ts`."*

**Fake timers + the three helpers** (`:45-83`, `:136-147`). `advance` **must** be the async
form — F9/F11 depend on microtasks flushing between a timer firing and its promise settling:

```ts
interface Deferred<T> { promise: Promise<T>; resolve: (value: T) => void; reject: (reason: unknown) => void }

/** A promise whose settlement is controlled from OUTSIDE the executor, so a test can
 *  choose the order two in-flight replies land in. File-local until a second suite needs it. */
function deferred<T>(): Deferred<T> { /* ... */ }

/** Advance the fake clock inside `act`, so React flushes the state updates the timers
 *  cause. The ASYNC form is required — the sync form does not flush the awaited
 *  microtasks between a timer firing and its promise resolving. */
async function advance(ms: number): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}

/** Flush pending microtasks (a settled deferred) without moving the clock. */
async function flush(): Promise<void> { return advance(0) }

function mount(initial: { def: WorkflowDefinitionJSON | null; enabled: boolean }) {
  return renderHook(({ def, enabled }) => useLiveValidation(def, enabled), { initialProps: initial })
}

beforeEach(() => { vi.useFakeTimers(); mockedValidate.mockReset(); /* warnSpy */ })
afterEach(() => { warnSpy.mockRestore(); vi.useRealTimers() })
```

**The `deferred` pair is exactly what F9 (single-flight) needs** — the analog's own
load-bearing test uses it to control settlement order (`:152-176`):

```ts
    const first = deferred<ValidateResponse>()
    const second = deferred<ValidateResponse>()
    mockedValidate.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    const { result, rerender } = mount({ def: DEF_A, enabled: true })
    await advance(VALIDATE_DEBOUNCE_MS) // request seq 1 issued
    rerender({ def: DEF_B, enabled: true })
    await advance(VALIDATE_DEBOUNCE_MS) // request seq 2 issued
    expect(mockedValidate).toHaveBeenCalledTimes(2)
```

For F9 the assertion **inverts**: after an edit lands mid-flight, `mockedUpdate` must have
been called **once**, and the second call fires only after the first deferred resolves —
carrying the token that resolution returned.

**Whole-reachable-graph assertions** (`:122-134`) — the idiom for "the raw body never
reaches a rendered value", reusable for "the token is never rendered":

```ts
/** Every string reachable from the state, so "the body is not shown" is checked over the
 *  whole reachable graph rather than over the two fields we happened to think of. */
function reachableStrings(value: unknown, out: string[] = []): string[] { /* ... */ }
```

**F15 — the `?raw` source fence.** The house idiom, with its **positive control**, from
`canvasNudge.test.ts:346-388` (the closest analog: a purity fence over a module that must
not name a thing):

```ts
// ── T-184-07-02: the source fence (the shipped `?raw` grep idiom) ──────────────
import canvasNudgeSource from "./canvasNudge?raw"

describe("canvasNudge — source purity (the ?raw grep, the shipped house idiom)", () => {
  it("names no server seam and opens no network call", () => {
    expect(canvasNudgeSource).not.toMatch(/fetch\(/)
    expect(canvasNudgeSource).not.toMatch(/workflows\/validate/)
    expect(canvasNudgeSource).not.toMatch(/XMLHttpRequest|EventSource|navigator\.sendBeacon/)
  })

  it("those fences are real — each regex matches its planted literal", () => {
    expect('const r = await fetch("/x")').toMatch(/fetch\(/)
    expect("new EventSource(url)").toMatch(/XMLHttpRequest|EventSource|navigator\.sendBeacon/)
  })
})
```

For F15 the fence is `import useDraftPersistenceSource from "./useDraftPersistence?raw"`
plus `expect(src).not.toMatch(/new Date|Date\.parse/)` and a planted-literal control.

> **⚠ Word the fence narrowly, and check the negative control.** `useGroundingBundle.test.ts:294-316`
> is the shipped warning about over-broad fences — *"A blanket grep would forbid this module's
> own docblock from naming the identifiers it exists to describe … which is exactly the guard
> shape that has cost this phase several forced docblock edits."* The token docblock **must**
> be free to say the words "Date" and "microseconds"; scope the regex to the constructor/call
> forms (`new Date(`, `Date.parse(`), and assert the negative control:
>
> ```ts
> const PARSES_A_DATE = /new Date\(|Date\.parse\(/
> it("the fence is a REAL control — it FINDS a planted parse and LEAVES prose alone", () => {
>   expect(PARSES_A_DATE.test("const d = new Date(token)")).toBe(true)
>   expect(PARSES_A_DATE.test("// NEVER parse this into a JS Date — µs are lost")).toBe(false)
> })
> ```

---

### `backend/tests/unit/test_186_concurrent_patch.py` and `test_186_publish_race.py` — NEW

**Analogs (three, all copied verbatim):**

**A — The live-DB module skip-guard** (`test_publish_flip.py:15-46`; the `pytestmark`
whole-file form at `test_103_draft_crud.py:40-45` is the one to use for a multi-test file):

```python
from __future__ import annotations

import os

import pytest

_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)


def _pg_reachable(dsn: str = _DSN) -> bool:
    """Probe local Postgres availability without raising (skipif guard)."""
    try:
        import psycopg2

        conn = psycopg2.connect(dsn, connect_timeout=2)
        conn.close()
        return True
    except Exception:
        return False


PG_AVAILABLE = _pg_reachable()

pytestmark = pytest.mark.skipif(
    not PG_AVAILABLE,
    reason=f"Local Postgres on {_DSN} not reachable; skipping live draft-CRUD tests",
)
```

The stated convention, which the new files inherit (`test_publish_flip.py:12`,
`test_103_draft_crud.py:12-13`):

> *"CONVENTION (Phase 102 posture): imports INSIDE the test bodies; the DB connect is
> guarded."*

…and its reason (`test_workflows_routes.py:18-19`): *"so `--collect-only` stays clean and the
RED surfaces at RUNTIME on AttributeError / an unexpected-kwarg TypeError — never a
collection error."* This is precisely what a Wave-0 RED test needs.

**B — The direct-route-call idiom** (`test_workflows_routes.py:111-144`): call the route
function directly with a `current_user` dict + a patched `get_pg_pool`. **No HTTP client,
no app wiring.**

```python
@pytest.mark.asyncio
async def test_get_starter_workflows_returns_seeded_starters():
    import asyncpg
    from unittest.mock import AsyncMock, patch

    from app.api import workflows as wf_api

    pool = await asyncpg.create_pool(dsn=_DSN, min_size=1, max_size=1)
    starter_slug = f"red-starter-route-{os.getpid()}"
    try:
        async with pool.acquire() as con:
            owner = await con.fetchval("SELECT id FROM auth.users ORDER BY id LIMIT 1")
            await _insert_published(con, slug=starter_slug, ..., created_by=owner, ...)
        current_user = {"id": str(owner)}
        try:
            with patch("app.api.workflows.get_pg_pool", AsyncMock(return_value=pool)):
                rows = await wf_api.get_starter_workflows(current_user=current_user)
            slugs = {r.slug for r in rows}
            assert starter_slug in slugs
        finally:
            async with pool.acquire() as con:
                await con.execute("DELETE FROM workflow_definitions WHERE slug = $1", starter_slug)
    finally:
        await pool.close()
```

Three details worth copying exactly: the `f"...-{os.getpid()}"` slug (parallel-safe fixture
naming), the **nested** `try/finally` (inner cleans the row, outer closes the pool), and
`patch("app.api.workflows.get_pg_pool", ...)` — patched at the **importing module's**
namespace, not at its definition site.

**C — Asserting the route's HTTPException** (`test_103_published_409.py:80-123`). This is
the exact shape F2/F3/F4 take — including the **re-read that proves no mutation happened**:

```python
@pytest.mark.asyncio
async def test_patch_published_row_is_immutable_via_route_404_and_no_mutation():
    """LIVE: a PATCH against the OWNER's published row matches 0 draft rows -> 404,
    and the published ``definition`` is UNCHANGED ..."""
    import asyncpg
    from fastapi import HTTPException

    from app.api import workflows as wf_api
    from app.models.harness import WorkflowDefinition
    ...
            patched = dict(body)
            patched["name"] = "Tampered"
            with pytest.raises(HTTPException) as exc:
                await wf_api.update_draft(
                    definition_id=def_id,
                    body=WorkflowDefinition.model_validate(patched),
                    current_user={"id": str(owner)},
                )
            # The draft-only guard refuses the published row -> 404 (no mutation):
            assert exc.value.status_code == 404
            async with pool.acquire() as con:
                after = await con.fetchval(
                    "SELECT definition->>'name' FROM workflow_definitions WHERE id = $1", def_id
                )
            assert after == "Published Lock Test"  # UNCHANGED
```

> **F1's "the winner's content survives" assertion is exactly the `after == ...` line above.**
> Do not assert only the status code — the analog's own value is that it proves the *row*,
> not just the *response*.

**D — Driving an exception branch without a live race** (`test_103_published_409.py:166-197`) —
the shape for exercising `CheckViolationError` (which F4 must keep working) and, by
extension, any hard-to-race branch:

```python
    violation = asyncpg.exceptions.CheckViolationError("workflow_definitions_block_published")

    body = WorkflowDefinition.model_validate(_published_definition("toctou-patch"))
    with (
        patch("app.api.workflows.get_pg_pool", AsyncMock(return_value=AsyncMock())),
        patch("app.api.workflows.update_workflow_definition", AsyncMock(side_effect=violation)),
    ):
        with pytest.raises(HTTPException) as exc:
            await wf_api.update_draft(...)
    assert exc.value.status_code == 409  # 23514 -> 409
```

**Fixture builder** (`test_103_draft_crud.py:48-64`) — every file in this family declares a
module-level `_draft_definition(slug)` returning a lint-clean single-phase body:

```python
def _draft_definition(slug: str) -> dict:
    """A single-phase llm_single draft definition body (lint-clean)."""
    return {
        "slug": slug,
        "version": 1,
        "name": "Draft CRUD Test",
        "status": "draft",
        "phases": [
            {
                "slug": "answer",
                "phase_index": 0,
                "config": {"phase_type": "llm_single", "prompt": "Answer."},
                "validators": [],
                "name": "Answer",
            }
        ],
    }
```

**Two-owner helper** for F3's 404-collapse row (`test_103_draft_crud.py:67-73`):

```python
def _two_owners(cur):
    """Return two DISTINCT auth.users ids (owner + a second user) or skip."""
    cur.execute("SELECT id FROM auth.users ORDER BY id LIMIT 2")
    rows = cur.fetchall()
    if len(rows) < 2:
        pytest.skip("need >=2 auth.users rows on the local stack for the owner-scope test")
    return rows[0][0], rows[1][0]
```

---

### `backend/app/db/workflows.py` — MODIFIED (data-access, CRUD)

**Analog: itself.** Two shipped shapes, both to be extended rather than replaced.

**1 — The honest-refusal SENTINEL** (`:310-332`) — the shape D-186-10 copies for the new
`-2`. Read the docstring closely: the sentinel's *meaning* is documented at its return site,
and the caller's obligation is spelled out.

```python
async def publish_definition(pool: asyncpg.Pool, definition_id: UUID) -> int:
    """Flip a definition ``status`` draft -> published (D-07), RETURNING the version.

    The ONLY draft->published flip site. Mirrors ``finish_run``'s
    ``UPDATE ... SET ... WHERE id=$1`` status-flip shape (``$N`` only). The
    ``workflow_definitions_block_published_update`` immutability trigger ALLOWS
    this transition (it only blocks an UPDATE where ``OLD.status='published'`` —
    a published->edit), ...

    The ``status='draft'`` WHERE guard makes a double-publish a no-op (idempotent):
    a re-flip finds 0 matching rows and returns ``-1``. The caller (publish_service)
    has already owner-checked + state-checked, so ``-1`` here means "not a draft /
    already published / not found" — a defensive sentinel, not the happy path.

    Returns the published ``version`` (for the D-08 success verdict), or ``-1``.
    """
    row = await pool.fetchrow(
        "UPDATE workflow_definitions SET status = 'published' "
        "WHERE id = $1 AND status = 'draft' RETURNING version",
        definition_id,
    )
    return row["version"] if row is not None else -1
```

**2 — The owner-scoped `created_by = $N` conjunct** (`:392-422`) — the only authorization
boundary. **The token clause is a THIRD conjunct added alongside it, never in place of it.**

```python
async def update_workflow_definition(
    pool: asyncpg.Pool, definition_id: UUID, *, definition: WorkflowDefinition, user_id: UUID
) -> dict | None:
    """UPDATE a DRAFT's ``name`` + ``definition`` JSONB (REQ-1 PATCH), RETURNING
    ``{id, version}`` or ``None``.

    Owner-scoped + draft-only (``id = $1 AND created_by = $2 AND status = 'draft'``):
    a row not owned by the caller, not a draft, or not found matches 0 rows -> ``None``
    (the route maps ``None`` -> 404; no existence leak — the get_definition precedent).

    PUBLISHED-ROW FREEZE (T-103-01-02): ... The trigger is NOT caught here — it is left to
    PROPAGATE as ``asyncpg.exceptions.CheckViolationError`` so the route maps it to HTTP
    409 ... ``$N`` placeholders only.
    """
    row = await pool.fetchrow(
        "UPDATE workflow_definitions SET name = $3, definition = $4::jsonb "
        "WHERE id = $1 AND created_by = $2 AND status = 'draft' "
        "RETURNING id, version",
        definition_id,
        user_id,
        definition.name,
        json.dumps(definition.model_dump(mode="json")),
    )
    return dict(row) if row is not None else None
```

**3 — The section-header comment that states the `$N`-only discipline** (`:335-340`). This
is the comment the executor must **amend** (not silently violate) when introducing
`CONCURRENCY_TOKEN_SQL`, because it literally reads "no f-string on SQL":

```python
# ── draft CRUD (Phase 103 / REQ-1 / WFAUTH-01) ───────────────────────────────
# The authoring substrate the Workflows page (Plan 06) + Builder (Plan 04) sit on.
# Mirror the in-file owner-scoped ``$N``-only precedent (get_definition /
# list_published_workflows / create_workflow_run). The service-role engine bypasses
# RLS, so EVERY query self-scopes ``created_by = $N`` (a second user's draft is
# absent — T-103-01-01). ``$N`` placeholders only (no f-string on SQL).
```

> RESEARCH §1 already supplies the amendment wording: *"`CONCURRENCY_TOKEN_SQL` is a
> module-level constant containing no user input — a code literal spliced into an f-string,
> not an interpolated value. Every VALUE still travels as `$N`."* Put that sentence in this
> comment block, not only in the constant's docblock, so the plan-checker's grep lands on it.

**4 — The 404-collapse read, and why the disambiguating re-read must keep it**
(`:278-307`). The existence-leak collapse is documented here in its canonical form:

```python
    """Load ONE workflow definition (the OWNER's drafts INCLUDED) the user may publish.
    ...
    A non-owner now gets ``None`` for ANY draft (including a global draft); the publish
    endpoint converts ``None`` to a uniform 404 so a not-found and a cross-user /
    non-owned-draft id are indistinguishable (no existence leak — T-102-05-06 /
    T-102-09-01, the 101.1-09 404-collapse precedent). ``$N`` placeholders only.
    """
    row = await pool.fetchrow(
        "SELECT id, slug, version, name, status, definition, created_by "
        "FROM workflow_definitions "
        "WHERE id = $1 AND (created_by = $2 OR (is_system_global = true AND status = 'published'))",
        definition_id,
        user_id,
    )
    return dict(row) if row is not None else None
```

**5 — The INSERT with server-forced invariants** (`:341-369`), which gains
`{CONCURRENCY_TOKEN_SQL} AS token` in its RETURNING:

```python
    row = await pool.fetchrow(
        "INSERT INTO workflow_definitions (slug, version, name, status, definition, created_by, is_system_global) "
        "VALUES ($1, $2, $3, 'draft', $4::jsonb, $5, false) "
        "RETURNING id, version",
        definition.slug, definition.version, definition.name,
        json.dumps(definition.model_dump(mode="json")), user_id,
    )
    return dict(row)
```

---

### `backend/app/api/workflows.py` — MODIFIED (controller, request-response)

**Analog: itself.**

**1 — The current `update_draft` mapping** (`:906-938`) — the exact function D-186-09
rewrites. `CheckViolationError` → 409 and `None` → 404 both **stay** (RESEARCH §2:
*"Keep both."*):

```python
@router.patch(
    "/{definition_id}",
    response_model=DraftCreateResponse,
    dependencies=[Depends(require_visible("workflow_authoring"))],  # Phase 148 (VIS-01) — authoring gate
)
async def update_draft(
    definition_id: UUID,
    body: WorkflowDefinition,
    current_user: dict = Depends(get_current_user),
) -> DraftCreateResponse:
    """Update a DRAFT (REQ-1 PATCH) — returns ``{id, version}``.

    A published-row PATCH hits the immutability trigger (Postgres ``23514``); we catch
    ``asyncpg.exceptions.CheckViolationError`` -> HTTP 409 (mirroring the
    ``already_published`` -> 409 mapping), never a silent overwrite or a 500
    (T-103-01-02). A not-owned / non-draft / missing id returns ``None`` -> 404 (no
    existence leak). ``definition_id`` is a path ``UUID`` -> FastAPI 422 on a malformed id.
    """
    pool = await get_pg_pool()
    user_id = _coerce_user_id(current_user)
    body = body.model_copy(update={"status": "draft"})
    try:
        row = await update_workflow_definition(
            pool, definition_id, definition=body, user_id=user_id
        )
    except asyncpg.exceptions.CheckViolationError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="workflow is published and cannot be modified",
        )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="draft not found")
    return DraftCreateResponse(**row)
```

**2 — The 3-way structured refusal mapping to copy** (`publish_workflow:785-822`). This is
the in-file precedent for "one service result, several HTTP outcomes, each named":

```python
    """...
    The orchestration lives in ``publish_service.publish`` (owner-scoped via
    ``get_definition``). HTTP mapping:
      - ``not_found`` (not owned / does not exist) -> 404 (no existence leak, V4)
      - ``already_published`` -> 409
      - ``business_requirement`` (D-13) -> 400 with the structured verdict
      - any other block -> 200 ``{published: False, blocked_stage, named_failures, golden_run_id}``
      - success -> 200 ``{published: True, version, golden_run_id}``

    ``grounding_fidelity`` (like ``lint`` and ``interactive_phase``) is an UNRECOGNISED
    ``blocked_stage`` for the branches above, so it falls through to the 200 + structured
    verdict — a new pre-run stage needs NO route branch here, only this docstring.

    ``definition_id`` is a path ``UUID`` -> FastAPI 422 on a malformed id (V5).
    """
    ...
    blocked = result.get("blocked_stage")
    if blocked == "not_found":
        # not-found AND cross-user collapse to a uniform 404 (no existence leak).
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="workflow not found")
    if blocked == "already_published":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="workflow is already published"
        )
    if blocked == "business_requirement":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=result)

    # A lint / structural-gate / judge block, or a success, returns 200 with the
    # machine-renderable verdict (the run is a real, browsable workflow_run).
    return PublishVerdict(**result)
```

> **This docstring is the reason `draft_changed` needs no route branch** — it is already
> written down that an unrecognised `blocked_stage` falls through to 200. Update the
> docstring's stage list (that is what it asks for: *"only this docstring"*); add no branch.

**3 — The response models that gain `token: str`** (`:132-151`):

```python
# ── Phase 103 (REQ-1 / WFAUTH-01) — draft CRUD response shapes ────────────────
class DraftCreateResponse(BaseModel):
    """The create/PATCH return — the new (or updated) draft id + its version."""

    id: UUID
    version: int


class DraftRow(BaseModel):
    """A drafts-shelf row (the caller's own drafts — D-103-4).

    Phase 103-06 (REQ-7 D9/D10): ``definition`` is ADDITIVE so the drafts-shelf
    card can derive the tier badge + phase chain client-side; optional to keep the
    pre-103 id/slug/version/name shelf shape valid."""

    id: UUID
    slug: str
    version: int
    name: str | None = None
    definition: dict | None = None
```

Note the shipped precedent for an **additive** field: it is declared optional with a
docstring stating who added it and why old callers stay valid. `token` follows the same
form — and RESEARCH's typing table is binding: **`str`, never `datetime`**.

**4 — The `blocked_stage` field D-186-11 rides on** (`:752-761`) — free-form `str | None`,
no enum, no CHECK:

```python
class PublishVerdict(BaseModel):
    """The D-08 structured verdict. A block names the stage + the failures + the
    golden run id (a real, browsable run); a success carries the published version.
    Machine-renderable for 103 (nothing prose-only)."""

    published: bool
    version: int | None = None
    golden_run_id: UUID | None = None
    blocked_stage: str | None = None
    named_failures: list = Field(default_factory=list)
```

**5 — The user-id coercion helper** (`:828-831`), used by every draft route:

```python
def _coerce_user_id(current_user: dict) -> UUID:
    """The get_published_workflows boilerplate: the trusted owner id as a UUID."""
    user_id = current_user["id"]
    return UUID(user_id) if isinstance(user_id, str) else user_id
```

**6 — A pre-existing decision comment the executor must not trip over** (`:834-840`). Autosave
lands in exactly this seam; do not "fix" it:

```python
# DRAFT ROUTES ARE DELIBERATELY NOT GROUNDING-GATED (Phase 182 plan 06 — a DECISION, not an
# oversight). Neither ``create_draft`` below nor ``update_draft`` further down runs the
# grounding-fidelity checks: a work-in-progress draft must stay storable while incomplete, or
# the Phase 184 canvas editing loop becomes hostile — every save that outruns its node config
# would be rejected mid-authoring. ... Do not "fix" this by adding a check here.
```

---

### `backend/app/services/harness/publish_service.py` — MODIFIED (service, staged orchestration)

**Analog: itself.**

**1 — The WR-03 `-1` branch** (`:358-375`) — the exact block the `-2` branch is inserted
immediately after. The comment explains *why the sentinel exists* (a false receipt), which
is the same sentence `draft_changed` needs:

```python
    # ── stage 5: flip (all passed) ───────────────────────────────────────────────
    version = await publish_definition(pool, definition_id)
    # WR-03 (T-102-09-02): publish_definition returns -1 when its ``status='draft'``
    # WHERE guard matched 0 rows — a concurrent double-publish (the race loser) or a
    # row no longer a draft. Without this check the caller returned a FALSE
    # ``{published: True, version: -1}`` receipt + a FALSE ``publish_succeeded``
    # governance row. Route the sentinel to an honest ``already_published`` block (the
    # route maps it to 409) so neither the API response nor the governance trail lies.
    if version == -1:
        return await _block(
            pool,
            run_id=golden_run_id,
            user_id=user_id,
            definition_id=definition_id,
            stage="already_published",
            named_failures=["the draft was published concurrently or is no longer a draft"],
            golden_run_id=golden_run_id,
        )
```

**2 — `_block` — why the golden-run receipt survives by doing nothing** (`:396-424`). It
only **adds** a `publish_blocked` audit row; it deletes nothing. F6 is satisfied by
construction, and this is the code that proves it:

```python
async def _block(
    pool, *, run_id, user_id, definition_id, stage: str, named_failures: list, golden_run_id,
) -> dict:
    """Write a ``publish_blocked`` receipt + return the D-08 structured verdict.

    ``run_id`` is the golden run id once it exists (stage 3+), else ``None`` (a
    stage-0/1/2 block before any run — ``harness_audit.run_id`` is nullable). The
    definition id is always carried in the metadata so a NULL-run receipt is still
    attributable to the definition (Phase 107 receipt VIEW).
    """
    await _safe_audit(
        pool, run_id, user_id=user_id,
        event_type="publish_blocked",
        metadata={
            "definition_id": str(definition_id),
            "blocked_stage": stage,
            "named_failures": named_failures,
            "golden_run_id": str(golden_run_id) if golden_run_id else None,
        },
    )
    return {"published": False, "blocked_stage": stage, "named_failures": named_failures,
            "golden_run_id": golden_run_id}
```

**3 — Stage 0, where the token is captured** (`:102-133`). Note the `row` local held through
the whole gauntlet, and the **defensive `json.loads`** SEED-138 requires stay:

```python
    # ── stage 0: load + owner-check (V4 — a non-owner gets not_found -> 404) ──────
    row = await get_definition(pool, definition_id, user_id=user_id)
    if row is None:
        # not-found AND cross-user collapse to the SAME structured block (no existence
        # leak — T-102-05-06); the route 404s uniformly. NOT a publish_attempted (no
        # row was even owned to attempt against).
        return {"published": False, "blocked_stage": "not_found",
                "named_failures": ["workflow not found"], "golden_run_id": None}

    if row.get("status") != "draft":
        return await _block(pool, run_id=None, user_id=user_id, definition_id=definition_id,
                            stage="already_published",
                            named_failures=["only a draft can be published"], golden_run_id=None)

    raw_definition = row.get("definition")
    if isinstance(raw_definition, str):
        import json
        try:
            raw_definition = json.loads(raw_definition)   # ← SEED-138 defensive decode: KEEP
        except (ValueError, TypeError):
            raw_definition = None
```

---

### `frontend/src/lib/api.ts` — MODIFIED (transport client)

**Analog: itself.**

**1 — The 409 arm that currently DISCARDS the body** (`:3338-3357`) — the exact lines
D-186-09 changes:

```ts
/** PATCH /workflows/{id} — update a draft. Throws WorkflowConflictError on 409
 *  (the row is published/frozen) and WorkflowNotFoundError on 404 — a 409/404 is
 *  NEVER swallowed as success (T-103-03-04). */
export async function updateWorkflowDraft(
  id: string,
  def: WorkflowDefinitionJSON,
  signal?: AbortSignal,
): Promise<WorkflowDefinitionJSON> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/workflows/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(def),
    signal,
  })
  if (res.status === 409) throw new WorkflowConflictError()   // ← body NEVER read
  if (res.status === 404) throw new WorkflowNotFoundError()
  if (!res.ok) throw new Error(`Failed to update workflow draft (status ${res.status})`)
  return (await res.json()) as WorkflowDefinitionJSON
}
```

**2 — The named-error class idiom** (`:3296-3312`) — the shape `WorkflowStaleTokenError`
copies. A one-line docblock naming the HTTP cause; `this.name` set explicitly (that name is
what every consumer branches on):

```ts
/** A published-row mutation (or a cross-user attempt resolving to a published
 *  row) → HTTP 409. Thrown (never swallowed) so the UI surfaces it instead of a
 *  silent overwrite (T-103-03-04). */
export class WorkflowConflictError extends Error {
  constructor(message = "workflow is published and cannot be modified") {
    super(message)
    this.name = "WorkflowConflictError"
  }
}

/** A draft mutation against a non-existent / non-owned definition → HTTP 404. */
export class WorkflowNotFoundError extends Error {
  constructor(message = "workflow not found") {
    super(message)
    this.name = "WorkflowNotFoundError"
  }
}
```

**3 — The 422 named error that logs the body at the boundary and carries it no further**
(`:3445-3467`, `:3492-3501`) — the exact precedent for `WorkflowDraftUnreadableError`:

```ts
/**
 * `POST /workflows/validate` answered HTTP 422 — the definition's SHAPE was rejected
 * before the handler ran ...
 *
 * THE RAW BODY IS LOGGED HERE AND CARRIED NO FURTHER (D-184-14 / T-184-06-01). The
 * constructor writes it to the console once, at this boundary, and the error's `message`
 * is a FIXED business-plain sentence with nothing interpolated into it. A validation
 * error body is a list of internal field paths and framework phrasing; pretty-printing it
 * onto an authoring surface aimed at business users would leak implementation detail and
 * still not tell them what to do. ... this class exists so the hook can branch on `name`
 * rather than parse a string.
 */
export class WorkflowValidateUnreadableError extends Error {
  constructor(rawBody?: unknown) {
    super("the workflow's shape could not be read by the validator")
    this.name = "WorkflowValidateUnreadableError"
    // Logged, never shown. One line, at the boundary that received it.
    console.warn("POST /workflows/validate → 422 (shape rejected before the handler):", rawBody)
  }
}
```

```ts
  if (res.status === 422) {
    // Read the body for the LOG only; a body that will not parse must not mask the 422.
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      body = null
    }
    throw new WorkflowValidateUnreadableError(body)
  }
```

**4 — The malformed-body fallback (WR-02)** (`:3623-3634`) — the shape for "an unparseable
409 falls back to today's behaviour, never to success":

```ts
  if (res.status === 400) {
    // WR-02: defend against a detail-less / mistyped 400 body. The backend rides the
    // full PublishVerdict in `detail` (api/workflows.py:209), but a malformed body must
    // NEVER cast `undefined` to PublishVerdict — the gauntlet would then crash on
    // `verdict.named_failures.length`. Verify the shape; otherwise throw an honest error.
    const body = (await res.json().catch(() => ({}))) as { detail?: unknown }
    const detail = body.detail
    if (detail && typeof detail === "object" && "published" in detail) {
      return { kind: "business_requirement", verdict: detail as PublishVerdict }
    }
    throw new Error("business_requirement block: malformed verdict body (no PublishVerdict in detail)")
  }
```

**5 — The row interface that gains `token`** (`:3260-3271`) — same additive-field docblock
convention as the backend model:

```ts
/** A draft row from GET /workflows/drafts (owner-scoped on the backend).
 *
 *  Phase 103-06 (REQ-7 D9/D10): `definition` is the ADDITIVE full WorkflowDefinition
 *  JSONB the drafts-shelf card uses to derive the tier badge + phase chain
 *  client-side. Optional — pre-103 shelf callers ignore it. */
export interface WorkflowDraftRow {
  id: string
  slug: string
  version: number
  name: string | null
  definition?: WorkflowDefinitionJSON | null
}
```

**6 — Where the "server owns the vocabulary" rule is written** (`:3377-3406`). The
`Verdict.code: string` docblock is the canonical statement of D-182-06 on the client, and it
is the reason `blocked_stage` may **not** get a client allow-list:

```ts
 * `code` IS DECLARED AS `string`, DELIBERATELY, AND MUST STAY THAT WAY (VALID-03 /
 * D-182-06). The SERVER owns the whole verdict vocabulary ... The client's job is to render
 * whatever arrives, including codes it has never seen ... Narrowing this to a union of
 * literals would make the client a second, drifting copy of a vocabulary that has exactly
 * one owner — which is the red line the whole server-validation seam exists to hold.
 * Do not "helpfully" narrow it.
```

---

### `frontend/src/pages/WorkflowBuilderPage.tsx` — MODIFIED (page / composition point)

**Analog: itself** — it already composes `useLiveValidation` in exactly the shape
`useDraftPersistence` must arrive in.

**1 — What leaves.** `:520-546` (state + refs), `:1128-1188` (`onPersist` / `onSaveDraft`),
`:1286-1299` (the `beforeunload` half). The refs and `onPersist` body are excerpted in the
`useDraftPersistence.ts` section above — move them, do not retype them.

```ts
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  // Phase 184-11 (D-184-16 debt 3): WHICH failure the error state is reporting. `null`
  // keeps today's generic line; a 409 replaces it with the published-row sentence.
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
```

```ts
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [dirty])
```

**2 — The named-constant block the new sentences join** (`:244-263`). Every user-visible
string in this page is an **exported named constant with a reason**. The conflict banner,
the two hold sentences and the `Saved · just now` line all belong here:

```ts
export const PUBLISHED_CONFLICT_MESSAGE =
  "This version is published and can't be edited — use Tweak to start a new draft"

/** The generic failure line, unchanged: a 404 / network failure is still never
 *  swallowed as a success and still reads as itself. */
export const GENERIC_SAVE_ERROR = "Couldn't save"

/**
 * The empty draft's publish reason (D-184-15). An INVITATION, not a claimed verdict:
 * the client is not validating anything here, it is saying what to do next on a
 * workflow that has no steps yet. D-182-06 stays intact precisely because no severity,
 * no code and no lint rule is being computed — a zero-length phases array is not a
 * finding, and the moment a step exists the server owns every verdict.
 */
export const EMPTY_DRAFT_INVITATION = "Add a step to get started"

/** The unsaved-work prompt (D-184-16 debt 1). Named, because a session can now be five
 *  structural edits deep with no autosave until Phase 186. */
export const UNSAVED_LEAVE_PROMPT =
  "This draft has unsaved changes. Leave without saving?"
```

> **`EMPTY_DRAFT_INVITATION` is the D-186-16 precedent, and it is right here.** The unbound-KB
> chip copy is written the same way: an exported constant whose docblock states *"an
> INVITATION, not a claimed verdict … no severity, no code and no lint rule is being
> computed."* Copy that sentence structure literally.

**3 — Where the invitation is allowed to travel, and where it is not** (`:989-997`). The
invitation feeds `blockedReason` as **prose only**; the KB invitation must **not** join it
(RESEARCH §5 — that would make an unbound workflow unpublishable, which is 187's call):

```ts
  const blockedReason = useMemo<string | null>(() => {
    if (!canvasEnabled || builderPhase !== "drafted") return null
    if (phases.length === 0) return EMPTY_DRAFT_INVITATION
    if (validation.kind === "degraded") return DEGRADED_SENTENCE[validation.cause]
    if (validation.kind !== "verdicts" || validation.ok) return null
    const first =
      validation.verdicts.find((v) => v.severity !== "incomplete") ?? validation.verdicts[0]
    return first?.message ?? null
  }, [canvasEnabled, builderPhase, phases, validation])
```

**4 — The KB picker to promote** (`:1345-1367`) — the component D-186-15 reuses verbatim.
Its options come from `folderOptions`, already fetched unconditionally on mount:

```tsx
          {/* Phase 103-ux: ONE calm project picker — binds the generated workflow to
              a knowledge base. Only shown once folders have loaded (keeps the empty
              screen calm when there are none). NOT the sketch's full infer+confirm loop. */}
          {folderOptions.length > 0 && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] text-muted-foreground">Which knowledge base should this use?</span>
              <select
                data-testid="project-folder-picker"
                aria-label="Which knowledge base should this use?"
                value={projectFolderId}
                onChange={(e) => setProjectFolderId(e.target.value)}
                disabled={builderPhase === "composing"}
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-[14px] text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">No specific knowledge base</option>
                {folderOptions.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </label>
          )}
```

**5 — The header chip to replace, and its gate** (`identityGroup`, `:1533-1551`). The
`boundFolderName &&` gate is what D-186-15 removes so the unbound state renders too:

```tsx
  const identityGroup = (
    <>
      <span className="min-w-0 truncate text-[14px] font-semibold text-foreground">
        {meta.slug ?? "Untitled workflow"}
      </span>
      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
        draft
      </span>
      {/* Phase 103-ux: the bound project (knowledge base) NAME, not a UUID. */}
      {boundFolderName && (
        <span
          data-testid="builder-bound-folder"
          className="shrink-0 truncate rounded border border-border bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground"
        >
          📁 {boundFolderName}
        </span>
      )}
    </>
  )
```

**6 — `actionGroup`, the UI-budget home for the status line + conflict banner**
(`:1553-1594`). RESEARCH's open risk #8 pins the mount HERE (touching
`WorkflowCanvas.tsx` instead would fire G-5):

```tsx
  const actionGroup = (
    <>
      {/* Phase 103-ux: explicit Save draft + transient confirmation.
          Phase 184-11 (R6): this region is the ONLY place the page says anything
          about the save, and what it says is `Saved · still a draft`. */}
      <div data-testid="builder-save-state" className="flex items-center gap-2">
        <button
          type="button"
          data-testid="builder-save-draft"
          onClick={() => void onSaveDraft()}
          disabled={saveState === "saving"}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 ..."
        >
          {saveState === "saving" ? (<>…<span className="… animate-spin …" />Saving…</>) : "Save draft"}
        </button>
        {saveState === "saved" && (
          <span data-testid="builder-save-confirm" role="status" className="text-[13px] font-medium text-success">
            {SAVED_STILL_A_DRAFT}
          </span>
        )}
        {saveState === "error" && (
          <span data-testid="builder-save-error" role="alert" className="text-[13px] font-medium text-destructive">
            {saveErrorMessage ?? GENERIC_SAVE_ERROR}
          </span>
        )}
      </div>
      {renderPublish && definition && <div>{renderPublish(definition, draftId, blockedReason)}</div>}
    </>
  )
```

Note the **`role="status"` vs `role="alert"`** split and the `data-testid` naming
(`builder-save-*`). The new status line and conflict banner follow both conventions —
`role="status"` for the quiet `Saving… / Saved · just now`, `role="alert"` for the conflict
banner.

**7 — The 409-by-name branch that already exists** (`:1171-1185`), which the hook absorbs
and extends with `WorkflowStaleTokenError`:

```ts
    } catch (err) {
      // A 409 (published/frozen) / 404 / network failure is surfaced honestly —
      // never silently swallowed as a success.
      //
      // Phase 184-11 (D-184-16 debt 3): the 409 gets its OWN sentence. The branch reads
      // the error's NAME rather than using `instanceof WorkflowConflictError`, which is
      // the idiom `useLiveValidation.causeOf` already shipped and states its reason for:
      // a rejection that crossed a module or realm boundary still classifies, and the
      // page needs no value import from the API client to recognise it. Everything else
      // keeps today's generic state — a 404 or a network failure is a different thing
      // and must not be told the workflow is published.
      const name = err && typeof err === "object" && "name" in err ? (err as { name: string }).name : ""
      setSaveErrorMessage(name === "WorkflowConflictError" ? PUBLISHED_CONFLICT_MESSAGE : null)
      setSaveState("error")
    }
```

---

### `frontend/src/components/workflows/builderStore.ts` — MODIFIED (store)

**Analog: itself.**

**1 — The slot to retire, and the note that hands the call to 186** (`:189-201`):

```ts
  /** The in-memory definition differs from what was last PATCHed. Untracked, and
   *  re-armed by an undo (D-184-03) via the subscription in the factory below. */
  dirty: boolean
  /** Transient save feedback. Untracked, and STILL UNREAD by anything in the app.
   *
   *  ⚠ 184-04 reserved this slot "for the canvas toolbar (141-B)". 184-13 built that
   *  toolbar and did NOT use it, so the reservation is retired rather than left standing
   *  as a promise nothing keeps. The toolbar's reading is joined on the page from the
   *  page's own `saveState` and this store's `dirty` — because persistence lives on the
   *  page (D-184-05) and mirroring it here would be a second copy of a state whose one
   *  writer is `onSaveDraft`. Phase 186, which rewrites that seam for autosave, is the
   *  plan that gets to decide whether this slot earns its keep. */
  saveState: SaveState
```

Retirement touches four sites: `SaveState` type (`:132`), the field (`:201`), the action
signature (`:236`), the initial value (`:321`), and the setter (`:521`).
**`SAVED_STILL_A_DRAFT` (`:152`) STAYS** — `CanvasToolbar` imports it.

**2 — The untracked-setter block the new `setProjectFolder` joins** (`:517-523`):

```ts
        // ── untracked setters: none of these may reach the undo stack ──
        setVerdicts: (verdicts) => set({ verdicts }),
        setChecking: (checking) => set({ checking }),
        setDegraded: (degraded) => set({ degraded }),
        setSaveState: (saveState) => set({ saveState }),
        markSaved: () => set({ dirty: false }),
        flushHistory: () => flushCoalesced(),
```

**3 — The dirty subscription and why `meta` arms nothing** (`:585-597`) — the shipped code
behind Pitfall 4:

```ts
  /**
   * D-184-03 — the honest dirty re-arm. Whenever the `phases` reference changes and the
   * draft is currently clean, it becomes dirty. Because zundo's `undo()` writes through
   * the store's raw `set`, an undo across the save boundary lands here too and the
   * surface honestly reads `dirty` again — without any action knowing that undo exists,
   * and without anything writing to the server.
   */
  store.subscribe((state, prev) => {
    if (suppressDirty) return
    if (state.phases !== prev.phases && state.dirty === false) {
      store.setState({ dirty: true })
    }
  })
```

**4 — The document-transition guard shape** the new action must respect (`:324-341`):
`suppressDirty` brackets any set that replaces the DOCUMENT. `setProjectFolder` is an
**edit**, not a document transition, so it sets `dirty: true` explicitly and does **not**
touch `suppressDirty` or `temporalRef`.

**5 — The two source fences on this module** (`:38-45`, `:47-52`). Both are asserted by
`builderStore.test.ts` and neither may be weakened:

```
 * ── UNDO NEVER WRITES TO THE SERVER (D-184-03) ────────────────────────────────────
 * No action in this module calls the API client or the network — asserted by a `?raw`
 * source fence and by a whole-suite zero-call spy. ... `markSaved()` is the only thing
 * that clears `dirty`.
 *
 * ── WHAT STAYS ON THE PAGE (D-184-05) ─────────────────────────────────────────────
 * Persistence. `draftIdRef` / `creatingRef` / `onPersist` / `onSaveDraft` are NOT here
 * and must not move here: Phase 186 rewrites exactly that seam for autosave, and
 * extracting it now would be churn against a seam about to move. This store owns the
 * definition STATE; the page owns the WRITE.
```

> **Update this second block when the extraction lands** — the sentence promises a rewrite,
> and after 186 it should read that the seam now lives in `useDraftPersistence`, not on the
> page. Leaving a docblock that says "the page owns the WRITE" after the write moved is the
> "a comment that lies" trap (D-ITEM-183-02) the codebase names elsewhere.

**6 — The `meta` type that already carries `project_folder_id`** (`:154-167`) — no model
change needed; the remap is deliberately not `Omit`:

```ts
/**
 * The working definition MINUS its phases.
 *
 * Spelled as a key-remapped mapped type rather than `Omit<BuilderDefinition, "phases">`:
 * `BuilderDefinition` carries an index signature, and `Omit` collapses such a type to
 * `{}` ..., which would silently lose `slug` / `project_folder_id` and every other declared
 * field. ...
 */
export type DefinitionMeta = {
  [K in keyof BuilderDefinition as K extends "phases" ? never : K]: BuilderDefinition[K]
}
```

---

### `frontend/src/components/workflows/PublishGauntlet.tsx` — MODIFIED (component)

**Analog: itself**, plus `verdictModel.ts` for the wording map.

**1 — `STAGES`, the table a 9th entry joins** (`:105-121`):

```ts
/**
 * The 8 server-fixed stages (sketch 020-B D2 / publish_service.py `STAGES`). The
 * client DISPLAYS them in order — it does not invent or reorder them. The
 * `code` is the verbatim `blocked_stage` a block at that stage emits; the spine
 * highlight (passed-up-to / blocked-at) is a VISUAL derivation only — the PASS/BLOCK
 * truth comes from the server verdict, never re-computed here.
 */
const STAGES: { label: string; what: string; codes: string[]; Icon: StageIcon }[] = [
  { label: "Owner", what: "Owner check — RLS-resolve + you own it", codes: ["not_found"], Icon: Shield },
  { label: "Valid", what: "Definition valid — re-validates as a WorkflowDefinition", codes: ["definition_invalid"], Icon: CheckMarkButton },
  { label: "Goal", what: "business_requirement — exactly one must be declared", codes: ["business_requirement"], Icon: Bullseye },
  { label: "Structure", what: "Structural lint — reachable · terminal · inputs satisfied · no orphans", codes: ["lint"], Icon: MagnifyingGlassTiltedLeft },
  { label: "Pause", what: "Interactive-phase check — human-pause phases can't validate synchronously", codes: ["interactive_phase"], Icon: RaisedHand },
  { label: "Golden run", what: "Golden run — a REAL harness run against the project KB", codes: ["golden_run_timeout", "golden_run_error"], Icon: Rocket },
  { label: "Citations", what: "Structural gate — citations / integrity checked during the run", codes: ["structural_gate"], Icon: Locked },
  { label: "Judge", what: "Independent judge — an independent model grades the deliverable", codes: ["judge"], Icon: BalanceScale },
]
```

The row shape to match: one-word `label`, an em-dash `what` in plain language (the Phase 127
lead-with-words rule), a `codes` array, and a 3D `Icon` from the shared glyph set.

**2 — The fail-open at `:329-342`** — the lines RESEARCH §4 traced. `blockedIndex === -1`
takes the same branch for "unknown stage" as for "no block at all":

```ts
function GauntletSpine({ blockedStage, running }: { blockedStage: string | null; running: boolean }) {
  // Find the FIRST stage whose codes contain the server's blocked_stage (visual only).
  const blockedIndex = blockedStage
    ? STAGES.findIndex((s) => s.codes.includes(blockedStage))
    : -1
  return (
    <div data-testid="gauntlet-spine" className="flex items-start overflow-x-auto py-4">
      {STAGES.map((stage, i) => {
        const isBlocked = blockedIndex === i
        const isPassed = blockedIndex === -1 ? !running : i < blockedIndex
        const isRunning = running && i === 5
        const Icon = stage.Icon
        // The connector LEADING INTO this node is "reached" up to (and incl.) the block.
        const connReached = blockedIndex === -1 ? !running : i <= blockedIndex
        const nodeTone = isBlocked
          ? "border-destructive/60 bg-destructive/10"
          : isPassed
            ? "border-success/50 bg-success/10"
            : ...
```

> **`connReached` at `:342` has the SAME `-1` shape and is easy to miss.** Fix both, or the
> spine's connectors still light up under an unknown block.

**3 — The headline that prints a raw code** (`:515-526`):

```ts
  // Phase 127-02 Task 2 (WUX-03, sketch 051-A): the plain-worded headline that LEADS
  // the resolved block — DERIVED from server truth (verdict.published / blocked_stage),
  // it NEVER re-derives pass/block (T-127-03). Lead-with-words: a business user reads a
  // pass/block in ~3 seconds; the verbatim 5-field grid is demoted behind the <details>
  // below (one click away, never removed).
  const wordedHeadline = verdict
    ? isSuccess
      ? `Published — v${verdict.version ?? "—"} is live`
      : verdict.blocked_stage === "judge"
        ? "Blocked by the grader — the run finished, but the independent grader would not pass the result"
        : `Blocked early — ${verdict.blocked_stage ?? "unknown"}`
    : ""
```

**4 — The wording-map shape RESEARCH recommends** (`verdictModel.ts:79-98`) — a
`Record<code, sentence>` in a **pure module**, not beside the component. The docblock states
the mechanical reason, which applies identically to `BLOCKED_SENTENCE`:

```ts
/**
 * The two sentences a surface says when the check did not run at all (D-184-14).
 *
 * SAME BEHAVIOUR, DIFFERENT WORDS, ON PURPOSE. A shape rejection is reproducible: an
 * author who hits one and is told "try again" will try forever. An unreachable server
 * usually is worth retrying. ... neither of them may ever be swapped for silence or for
 * the clean line above, because "we could not check" rendering as "fine" is the single
 * worst thing this surface can do.
 *
 * They live in this module, and not beside the component that says them, for a
 * mechanical reason worth writing down: a component file may not export shared
 * constants (`react-refresh/only-export-components`). It is also the right home —
 * every word a surface says ABOUT a check now sits in one pure module, next to the
 * resting-state line it has to be chosen against.
 */
export const DEGRADED_SENTENCE: Record<DegradedValidationCause, string> = {
  unreadable: "We couldn't check this — the workflow's shape isn't something we can read yet.",
  unreachable: "We couldn't reach the check.",
}
```

> **`react-refresh/only-export-components` is the constraint** — a new `BLOCKED_SENTENCE`
> map may **not** be exported from `PublishGauntlet.tsx`. It goes in `verdictModel.ts` (or a
> sibling pure module), exactly as `DEGRADED_SENTENCE` did, with a **fallback that is a
> sentence, not a code**.

**5 — The status-per-kind switch** (`:123-135`), which RESEARCH's open risk #3 says grows a
5th arm only if the planner overrules 409-with-code in favour of 412:

```ts
/** The HTTP status surfaced for each discriminated outcome kind (for the badge). */
function httpStatusForKind(kind: PublishOutcome["kind"]): number {
  switch (kind) {
    case "verdict": return 200
    case "business_requirement": return 400
    case "not_found": return 404
    case "already_published": return 409
  }
}
```

---

## Shared Patterns

### 1. The honest-refusal SENTINEL (copied TWICE in this phase)

**Source:** `backend/app/db/workflows.py:310-332` (the `-1` return) + its consumer
`backend/app/services/harness/publish_service.py:358-375`.
**Apply to:** the new `-2` in `publish_definition`; the `{"ok": False, "cause": ...}` refusal
shape in `update_workflow_definition`.

The full pattern is three parts, and all three are load-bearing:

1. **A WHERE-guard that matches 0 rows returns a NAMED sentinel**, never a falsy success:
   `return row["version"] if row is not None else -1`
2. **The docstring says what the sentinel means and who is responsible for the check it
   substitutes for**: *"The caller (publish_service) has already owner-checked +
   state-checked, so `-1` here means 'not a draft / already published / not found' — a
   defensive sentinel, not the happy path."*
3. **The caller's comment names the false receipt that would otherwise be filed**:

   > *"Without this check the caller returned a FALSE `{published: True, version: -1}` receipt
   > + a FALSE `publish_succeeded` governance row. Route the sentinel to an honest
   > `already_published` block … so neither the API response nor the governance trail lies."*

That third sentence is the T-185-04-01 rule in its shipped form. The `-2` branch needs its
own version of it, naming what a collapsed `-1`/`-2` would lie about.

### 2. Owner-scoped `created_by = $N` — the ONLY authorization boundary

**Source:** `backend/app/db/workflows.py:335-340` (the discipline comment), `:303`, `:385`,
`:415`, `:443` (the four query sites).
**Apply to:** every query the phase touches — the guarded UPDATE, the disambiguating
re-read, and any new SELECT.

Representative query, with the conjunct order to preserve:

```python
    row = await pool.fetchrow(
        "UPDATE workflow_definitions SET name = $3, definition = $4::jsonb "
        "WHERE id = $1 AND created_by = $2 AND status = 'draft' "
        "RETURNING id, version",
        definition_id, user_id, definition.name,
        json.dumps(definition.model_dump(mode="json")),
    )
```

The rule as the file states it (`:337-340`):

> *"The service-role engine bypasses RLS, so EVERY query self-scopes `created_by = $N` (a
> second user's draft is absent — T-103-01-01)."*

**The token clause is a THIRD conjunct appended after `status = 'draft'`.** It is a
concurrency check, never an authorization check. Replacing `created_by = $2` with it — or
omitting it from the disambiguating re-read — reopens T-103-01-01.

### 3. The 404-collapse (no existence leak)

**Source:** `backend/app/db/workflows.py:285-294` (the doctrine), `api/workflows.py:936-937`
and `:808-810` (the two mappings).
**Apply to:** the D-186-09 three-way branch — `not_found` must stay identical for "no such
id" and "someone else's id", with the same detail string.

```python
    # api/workflows.py:936-937
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="draft not found")

    # api/workflows.py:808-810
    if blocked == "not_found":
        # not-found AND cross-user collapse to a uniform 404 (no existence leak).
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="workflow not found")
```

The doctrine, verbatim from `db/workflows.py:291-294`:

> *"A non-owner now gets `None` for ANY draft (including a global draft); the publish
> endpoint converts `None` to a uniform 404 so a not-found and a cross-user /
> non-owned-draft id are indistinguishable (no existence leak — T-102-05-06 / T-102-09-01,
> the 101.1-09 404-collapse precedent)."*

**F3's assertion follows from this:** a foreign id and an unknown id must produce the same
status **and the same detail** — assert both, not just the status.

### 4. Invitation ≠ verdict (D-184-15 / D-182-06)

**Source:** `frontend/src/pages/WorkflowBuilderPage.tsx:251-258`.
**Apply to:** the unbound-KB chip copy (D-186-16).

```ts
/**
 * The empty draft's publish reason (D-184-15). An INVITATION, not a claimed verdict:
 * the client is not validating anything here, it is saying what to do next on a
 * workflow that has no steps yet. D-182-06 stays intact precisely because no severity,
 * no code and no lint rule is being computed — a zero-length phases array is not a
 * finding, and the moment a step exists the server owns every verdict.
 */
export const EMPTY_DRAFT_INVITATION = "Add a step to get started"
```

Four properties to reproduce exactly:
- an **exported named constant**, not an inline string;
- a docblock that says *"an INVITATION, not a claimed verdict"* and names the decision;
- an explicit statement that **no severity, no code, no lint rule is computed**;
- rendered as **prose only** — `EMPTY_DRAFT_INVITATION` reaches `blockedReason`
  (`:989-997`) and nothing else. It never becomes a `Verdict`, never enters `verdicts`,
  never produces a `groupVerdicts` row, never adds a problems-tray line.

> The KB invitation reproduces the first three and **narrows** the fourth: per RESEARCH §5 it
> must **not** join `blockedReason` either (that would make an unbound workflow
> unpublishable — 187's call). It renders on the chip and stops there. F16 asserts
> `verdicts` unchanged and the tray count unchanged.

### 5. The `?raw` source-fence test (the shipped house idiom)

**Source:** `canvasNudge.test.ts:33`, `:346-388` (purity + positive controls);
`useGroundingBundle.test.ts:294-316` (the narrow-wording warning + negative control);
`builderStore.test.ts:20`, `definitionOps.test.ts:19`, `:600-602`,
`WorkflowBuilderPage.header.test.tsx:115-120`, `WorkflowBuilderPage.canvas.test.tsx:81-83`,
`PhaseNodeCard.test.tsx:37-41` — this idiom ships in at least eight suites.
**Apply to:** F15 (`useDraftPersistence.ts` contains no `new Date` / `Date.parse`).

Three-part shape:

```ts
// 1. Import the SOURCE via Vite's ?raw loader (typechecks under `vite/client`).
import canvasNudgeSource from "./canvasNudge?raw"

// 2. Assert the ABSENCE.
it("names no server seam and opens no network call", () => {
  expect(canvasNudgeSource).not.toMatch(/fetch\(/)
  expect(canvasNudgeSource).not.toMatch(/XMLHttpRequest|EventSource|navigator\.sendBeacon/)
})

// 3. Prove the fence is REAL — each regex matches its planted literal.
it("those fences are real — each regex matches its planted literal", () => {
  expect('const r = await fetch("/x")').toMatch(/fetch\(/)
  expect("new EventSource(url)").toMatch(/XMLHttpRequest|EventSource|navigator\.sendBeacon/)
})
```

Part 3 is non-negotiable — a fence with no positive control is a test that cannot fail. And
per `useGroundingBundle.test.ts:296-301`, add the **negative** control too, so the regex
cannot forbid the docblock from naming the thing it exists to describe.

### 6. The zero-network-call spy (184-07's, extended for F12)

**Source:** `frontend/src/components/workflows/WorkflowCanvas.editing.test.tsx:75-85` +
its four assertion sites (`:431`, `:790`, `:819`, `:918`); the whole-suite variant at
`canvasNudge.test.ts:391-394`.
**Apply to:** F12 — a cosmetic drag issues 0 network calls after autosave exists.

```ts
/** R3's tripwire: a cosmetic nudge must reach the network zero times. Whole-suite, so
 *  the claim covers every path this file drives, not only the one that names it. */
let fetchSpy: MockInstance

beforeAll(() => {
  fetchSpy = vi.spyOn(globalThis, "fetch")
})

afterAll(() => {
  fetchSpy.mockRestore()
})
```

```ts
    expect(fetchSpy).not.toHaveBeenCalled()
```

Two properties worth preserving when extending it:
- the spy is **whole-suite** (`beforeAll`, not `beforeEach`), and the docblock says why —
  *"the claim covers every path this file drives, not only the one that names it"*;
- `canvasNudge.test.ts:391-393` adds a **final describe block that runs LAST** and asserts
  the accumulated count is 0 — the belt to the `?raw` fence's braces. Extending F12 means
  keeping the assertion **count** from decreasing (the Phase 177 lesson), so add cases,
  never replace them.

### 7. Additive wire field, documented at both ends

**Source:** `api/workflows.py:139-150` (`DraftRow.definition`) and `lib/api.ts:3260-3271`
(`WorkflowDraftRow.definition`).
**Apply to:** `token` on `DraftCreateResponse`, `DraftRow`, and `WorkflowDraftRow`.

Both ends carry the same style of note: which phase added it, why it is additive, and why
existing callers stay valid. RESEARCH §1 supplies the client-side docblock text verbatim —
including the *"NEVER `new Date(...)` it"* sentence, which is the human half of the F15 fence.

---

## No Analog Found

None. Every file this phase creates or modifies has a shipped in-repo analog. The one thing
with **no** direct precedent is the **single-flight write queue** (`inFlightRef` /
`pendingRef` / `tokenRef`) — but that is a *deliberate divergence* from a located analog
(`useLiveValidation`'s `AbortController`), not an absent one, and RESEARCH §3 supplies the
exact refs, the invariant, and the docblock reasoning. Treat it as "copy
`useLiveValidation`, replace the belt, and write down why."

---

## Read-Only Fences (MUST NOT CHANGE)

| File | Why | Enforcement |
|---|---|---|
| `frontend/src/components/workflows/canvasNudge.ts` | D-186-02 — CONCUR-01 stays true **by construction**. The module must keep importing neither the builder store, the canvas model, nor the API client. Its own docblock (`:16-19`) names Phase 186 as the reason it exists in this shape: *"Phase 186 / CONCUR-01's requirement 'a cosmetic drag never mints a version' is true by construction here rather than being a live code path someone has to defend. A nudge cannot mint a version because a nudge cannot reach the server."* | `canvasNudge.test.ts:346-389` (3 fences + positive controls) and the whole-suite zero-call spy at `:391-394` |
| `frontend/src/components/workflows/WorkflowCanvas.tsx` | G-5 — extraction due in Phase 188. RESEARCH's G-5 table: 186 needs **zero** changes here; the status line and conflict banner mount in the page header (`actionGroup`), and the toolbar already receives `saveState` through the existing `CanvasSession` prop. A plan proposing a change here is a guardrail fire the orchestrator must surface. | orchestrator / plan-check |

---

## Metadata

**Analog search scope:** `backend/app/db/`, `backend/app/api/`, `backend/app/services/harness/`,
`backend/tests/unit/`, `backend/tests/integration/`, `frontend/src/hooks/`,
`frontend/src/lib/`, `frontend/src/pages/`, `frontend/src/components/workflows/`

**Files read at `file:line` in this session (16):**
`useLiveValidation.ts` (whole) · `useLiveValidation.test.tsx:1-219` ·
`useGroundingBundle.test.ts:290-317` · `canvasNudge.ts:1-45` · `canvasNudge.test.ts:340-394` ·
`WorkflowCanvas.editing.test.tsx:70-99` · `builderStore.ts:30-208, 517-600` ·
`verdictModel.ts:79-98` · `PublishGauntlet.tsx:96-145, 320-359, 505-549` ·
`WorkflowBuilderPage.tsx:240-268, 505-564, 1120-1199, 1293-1299, 1330-1379, 1520-1609, 980-998` ·
`lib/api.ts:3259-3271, 3290-3357, 3377-3406, 3440-3504, 3596-3638` ·
`db/workflows.py:278-452` · `api/workflows.py:125-164, 740-971` ·
`publish_service.py:85-160, 330-430` · `test_publish_flip.py` (whole) ·
`test_103_draft_crud.py:1-120` · `test_103_published_409.py` (whole) ·
`test_workflows_routes.py:1-209`

**Pattern extraction date:** 2026-08-01
