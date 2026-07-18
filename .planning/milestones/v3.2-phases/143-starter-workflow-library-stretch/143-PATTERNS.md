# Phase 143: Starter Workflow Library (WF-01, STRETCH) - Pattern Map

**Mapped:** 2026-07-10
**Files analyzed:** 11 (7 source + 3 test + 1 shared card-chip reuse)
**Analogs found:** 11 / 11 (all have a concrete in-repo analog; 1 is a NEW test-dir with the closest analog in `tests/unit/`)

> Every file this phase touches is a **reuse + a tiny delta** — there is no net-new
> mechanic. The next free migration number is **094** (last applied is `093`).

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/094_starter_workflows.sql` (NEW) | migration (seed) | batch INSERT | `supabase/migrations/061_harness_seed_templates.sql` + `056` (seed user/RLS/trigger) + `seed-pm-pack.py:_build_def` (the def shape) | exact |
| `scripts/seed-starters.py` (NEW) | utility / seed script | file-I/O + batch | `scripts/seed-pm-pack.py` | exact |
| `scripts/pm-pack/templates/compliance-gap-report.docx` (NEW) | asset (built artifact) | transform / file-I/O | `scripts/pm-pack/make_pm_templates.py::build_risk_register` (the `{%tr%}` table builder) | exact |
| `backend/app/db/workflows.py` (MODIFY) | db access | CRUD / read | in-file `list_published_workflows` (lines 159-200) | exact (extend in place) |
| `backend/app/api/workflows.py` (MODIFY) | controller / route | request-response (read) | in-file `get_published_workflows` (lines 104-139) | exact (extend in place) |
| `frontend/src/lib/api.ts` (MODIFY) | api client | request-response | `listPublishedWorkflows` (1203-1218) + `createWorkflowDraft` (3076-3089) | exact (extend in place) |
| `frontend/src/pages/WorkflowsPage.tsx` (MODIFY) | component / page | event-driven + request-response | in-file `onTweak` (151-177), shelf sections (350-413), `PublishedCard` (514-573) | exact (extend in place) |
| `frontend/src/pages/WorkflowsPage.test.tsx` (EXTEND) | test (frontend unit) | — | itself — the "Tweak forks a v(N+1) draft" describe block (334-372) | exact |
| `backend/tests/unit/test_starter_workflows.py` (NEW) | test (backend unit / db) | — | `backend/tests/unit/test_103_draft_crud.py` (live-`:54322` asyncpg pool + skip-guard + rollback) | exact |
| `backend/tests/integration/test_workflows_routes.py` (NEW) | test (integration / route) | — | `test_103_draft_crud.py::test_route_round_trip_...` (patched `get_pg_pool`) + `test_103_tweak_fork.py` | role-match* |
| Starter card "Official/Starter" chip | component (chrome reuse) | — | `WorkflowsPage.tsx` `PublishedCard` `published` pill (543-545) + `<WorkflowSoul scale="card">` (549) | exact (no new component — G-2 waived) |

\* No file exists at `backend/tests/integration/test_workflows_routes.py` today; the closest existing route-level tests live in `backend/tests/unit/test_103_draft_crud.py` (route round-trip) and `test_103_tweak_fork.py`. Planner decides whether new route tests join `tests/integration/` (per RESEARCH's Test Map) or extend the unit files where the precedent physically lives.

---

## Pattern Assignments

### `supabase/migrations/094_starter_workflows.sql` (migration, batch INSERT)

**Analog:** `supabase/migrations/061_harness_seed_templates.sql` (the `is_global` seed-INSERT block) + `056_workflow_definitions.sql` (seed user + RLS + immutability trigger) + `scripts/seed-pm-pack.py:_build_def` (the transformed def JSONB).

**Seed system user + idempotent INSERT pattern** (`061`:33-82) — copy verbatim; the seed user `00000000-0000-0000-0000-000000000001` satisfies the `created_by` FK, and `ON CONFLICT (id) DO NOTHING` + a FIXED uuid make the migration re-runnable:
```sql
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, ...)
VALUES ('00000000-0000-0000-0000-000000000001', 'seed@system.local', '', now(), ...)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workflow_definitions (id, slug, version, name, status, definition, created_by, is_global)
VALUES (
  '00000000-0000-0000-0000-0000000000c1',   -- FIXED uuid (idempotency key) — pick a fresh 00…00cN block
  'pm-risk-register', 1, 'Risk Register', 'published',
  '{ ...FULL WorkflowDefinition JSONB... }'::jsonb,
  '00000000-0000-0000-0000-000000000001',    -- seed system user
  true                                        -- is_global (ONLY a seed can set this)
)
ON CONFLICT (id) DO NOTHING;
```

**The transform (NOT a verbatim copy) — D-143-4b / Pitfall 1.** The def JSONB must be `seed-pm-pack.py:_build_def`'s shape (lines 346-398) with three deltas vs the live source rows: (1) `category: "starter"` added; (2) `project_folder_id` **absent** + every phase `folder_scope` **absent**; (3) `assets[].asset_id` re-homed to `00000000-0000-0000-0000-000000000001/_library/<slug>.docx`. The strict-gate shape stays (D-143-7):
```jsonc
// per emit phase (mirror _build_def :366-388):
"citation_policy": "strict", "integrity_policy": "strict",
"validators": [
  {"kind":"citations_required","config":{"mode":"deterministic"},"on_failure":"fail_run"},
  {"kind":"output_file_valid","config":{},"on_failure":"fail_run"}
]
```
> ⚠️ **DO NOT** include `project_folder_id` or `folder_scope` — the model_validator `_folder_scope_requires_project` (`harness.py`:242-254) would FAIL if a `folder_scope` survives without a `project_folder_id`, and a private folder id makes a forker's run retrieve zero evidence → strict gate fails the run.

**Apply discipline** (`061`:24-27 header + CLAUDE.md): paste into the Supabase SQL editor (never `db push`/`db reset`), then `bash scripts/regenerate-full-schema.sh` (no `--reset`), commit both files. Filename must match `<digits>_name.sql` (no letter suffix).

---

### `scripts/seed-starters.py` (utility, file-I/O + batch)

**Analog:** `scripts/seed-pm-pack.py` (mechanic-for-mechanic — this IS how the two source rows were seeded).

**Name-only secret bootstrap + service-role client** (`seed-pm-pack.py`:64-140) — `REPO_ROOT = parents[1]` (script lives at repo-root `scripts/`), `load_dotenv(BACKEND_DIR/".env")`, `get_supabase()` reads `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` name-only (never echo). Reuse verbatim.

**Storage upload + byte round-trip** (`seed-pm-pack.py:upload_template` :292-314) — the exact re-home step D-143-4b needs, with `DEMO_USER_ID` swapped for the seed user `00000000-…-01`:
```python
def upload_starter_template(supabase, local_path: Path, slug: str) -> str:
    _assert_slug(slug)                         # path-traversal guard (:118-125) — keep
    data = local_path.read_bytes()
    path = f"{SEED_UID}/_library/{slug}.docx"  # SEED_UID = 00000000-…-01 (NOT the operator uid)
    storage = supabase.storage.from_(BUCKET)   # BUCKET = "workspace-files"
    storage.upload(path, data, {"content-type": MIME, "upsert": "true"})
    assert len(storage.download(path)) == len(data)   # byte round-trip (:308-313)
    return path                                # this string IS assets[].asset_id
```

**DELETE-then-INSERT idempotency (published-row immutability)** (`seed-pm-pack.py:upsert_definition` :470-517) — SELECT existing `definition::text`, compare **parsed dicts** (not raw text — Postgres normalizes JSONB key order; WR-02 note :487-492), DELETE only on a real diff, then `INSERT … ON CONFLICT (id) DO NOTHING`. Never UPDATE a published row. If the SQL migration already seeds the rows, this script's DB half is redundant — planner decides whether `seed-starters.py` does storage-only (upload the 3 `.docx`) or storage + the DELETE-INSERT refresh.

**Pre-flight + validate-before-insert** (`seed-pm-pack.py`:143-173, 460-467) — `assert_demo_uid`-style fail-closed guard is optional here (seed user is fixed, not carried-forward), but keep `_validate_def` → `WorkflowDefinition.model_validate(def_dict)` **only if** the `category` field is added to the model (see Shared Pattern 1 — otherwise `extra='forbid'` rejects it and aborts the seed).

---

### `scripts/pm-pack/templates/compliance-gap-report.docx` (asset, transform/file-I/O)

**Analog:** `scripts/pm-pack/make_pm_templates.py::build_risk_register` (lines 118-152) — the `{%tr for r in rows %}` table builder.

**Pitfall-4-safe docxtpl authoring conventions** (file header :13-33 + `build_risk_register`):
- Each Jinja tag in its **own single-run paragraph/cell** (a tag split across runs → `TemplateSyntaxError`).
- A `{%tr%}` loop uses **dedicated open/content/close rows** — docxtpl replaces the whole `<w:tr>` holding a `{%tr%}` tag with the bare statement:
```python
table = doc.add_table(rows=4, cols=len(HEADERS)); table.style = "Table Grid"
# row 0 = headers; row 1 = "{%tr for r in rows %}" in cell 0; row 2 = content tags; row 3 = "{%tr endfor %}"
content_cells = table.rows[2].cells
for i, tag in enumerate(BODY_TAGS): content_cells[i].text = tag   # {{ r.<col>.value }}
doc.save(str(PATH)); Document(str(PATH))   # re-open to confirm integrity (:150-151)
```
- Scalar header block = `{{ key.value }}` single-run paragraphs (`build_status_report` :64-78).
- The Compliance Gap Report columns per RESEARCH Code Examples (§"Compliance Gap Report" :331-347): `{{ r.requirement.value }}`, `{{ r.source_clause.value }}`, `{{ r.current_state.value }}`, `{{ r.gap.value }}`, `{{ r.severity.value }}`, `{{ r.owner.value }}`.
- Build the file by **adding a `build_compliance_gap_report()` fn to `make_pm_templates.py`** (or a sibling builder) and running it — do not hand-author in Word (python-docx output is not byte-deterministic; commit the built bytes). NOTE (`seed-pm-pack.py`:100-103): the seed uploads the **committed bytes**, never a re-build at seed time.

---

### `backend/app/db/workflows.py` (db access, CRUD/read) — MODIFY

**Analog:** in-file `list_published_workflows` (lines 159-200).

**Add `list_starter_workflows` — the JSONB-path predicate** (mirror the `definition->>'project_folder_id'` precedent at :195-197). The `category` literal is a **constant, not user input**, so it is a `$`-free literal (the `$N` binding rule at :179-182 applies only to user-supplied values):
```python
async def list_starter_workflows(pool: asyncpg.Pool) -> list[dict]:
    """Curated global starters (the Starters shelf). is_global rows are world-readable
    by the mig-056 SELECT policy; category='starter' narrows to curated. No user scope."""
    rows = await pool.fetch(
        "SELECT id, slug, name, definition FROM workflow_definitions "
        "WHERE status = 'published' AND is_global = true "
        "AND definition->>'category' = 'starter' "
        "ORDER BY name"
    )
    return [dict(r) for r in rows]
```

**Add an additive `owned_only` param to `list_published_workflows` — D-143-2b (Pitfall 3).** Default `False` keeps every existing caller byte-identical (the shared helper also feeds the composer picker, `WorkspacePanel.tsx:125`, and `threads.py:51` — do NOT blanket-narrow):
```python
async def list_published_workflows(pool, *, user_id, project_folder_id=None, owned_only=False):
    if owned_only:
        sql = ("SELECT id, slug, name, definition FROM workflow_definitions "
               "WHERE status = 'published' AND created_by = $1")          # mine-only (drops bare is_global)
    else:
        sql = ("SELECT id, slug, name, definition FROM workflow_definitions "
               "WHERE status = 'published' AND (is_global = true OR created_by = $1)")  # UNCHANGED default
    params: list = [user_id]
    # …project_folder_id AND-append (:195-197) + " ORDER BY name" — unchanged…
```

**Fork INSERT path is UNCHANGED** — `create_workflow_definition` (:269-297) already hard-sets `status='draft'`, `is_global=false`, `created_by=user_id` server-side (the fork's server backstop). Do not touch it.

---

### `backend/app/api/workflows.py` (controller, request-response read) — MODIFY

**Analog:** in-file `get_published_workflows` (lines 104-139).

**Add `GET /workflows/starters`** — a thin delegate mirroring the published route (pool via `get_pg_pool()`, map rows through the existing `PublishedWorkflow` model + `_coerce_definition` :43-63). Declare it as an explicit static segment (the `/drafts` precedent :254-263) so `/{definition_id}` never shadows it:
```python
@router.get("/starters", response_model=list[PublishedWorkflow])
async def get_starter_workflows(current_user: dict = Depends(get_current_user)):
    pool = await get_pg_pool()
    rows = await list_starter_workflows(pool)          # no user scope — curated globals
    return [PublishedWorkflow(id=r["id"], slug=r["slug"], name=r["name"],
                              definition=_coerce_definition(r.get("definition"))) for r in rows]
```

**Add `scope=mine` to `GET /workflows/published`** — a `Query` param threaded to `owned_only` (mirror the `project_folder_id: UUID | None = Query(None)` param at :106):
```python
@router.get("/published", response_model=list[PublishedWorkflow])
async def get_published_workflows(project_folder_id: UUID | None = Query(None),
                                  scope: str | None = Query(None),           # "mine" → owned_only
                                  current_user: dict = Depends(get_current_user)):
    ...
    rows = await list_published_workflows(pool, user_id=..., project_folder_id=project_folder_id,
                                          owned_only=(scope == "mine"))
```

**Fork route is UNCHANGED** — `POST /workflows` `create_draft` (:225-251) already forces `status='draft'` server-side and maps `UniqueViolationError → 409` (Pitfall 5, the fork's hash-collision path). No new fork endpoint.

---

### `frontend/src/lib/api.ts` (api client, request-response) — MODIFY

**Analog:** `listPublishedWorkflows` (1203-1218) + `createWorkflowDraft` (3076-3089).

**Add `listStarterWorkflows()`** — clone `listPublishedWorkflows`'s shape, no query params, same `PublishedWorkflow[]` return:
```typescript
export async function listStarterWorkflows(signal?: AbortSignal): Promise<PublishedWorkflow[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/workflows/starters`, { headers, signal })
  if (!res.ok) throw new Error(`Failed to list starter workflows (status ${res.status})`)
  return (await res.json()) as PublishedWorkflow[]
}
```

**Thread a `scope` option into `listPublishedWorkflows`** — add `?scope=mine` for the Published shelf only (the composer picker / WorkspacePanel keep calling it WITHOUT scope). Follow the existing `projectFolderId` URL-append at :1212-1214.

**`createWorkflowDraft` is the fork INSERT client — UNCHANGED** (3076-3089). `onUseStarter` reuses it as-is.

---

### `frontend/src/pages/WorkflowsPage.tsx` (component, event-driven) — MODIFY

**Analog:** in-file `onTweak` (151-177), the shelf `<section>`s (350-413), `PublishedCard` (514-573).

**`onUseStarter` = a sibling of `onTweak`** (151-177). The ONLY deltas: a **new suffixed slug** + `version: 1` (vs `onTweak`'s same-slug + `version: N+1`) — driven by D-143-1 (`UNIQUE(slug, version)` is global, so a shared-starter fork must mint a fresh identity):
```typescript
const onUseStarter = useCallback(async (starter: PublishedWorkflow) => {
  const def = (starter.definition ?? {}) as Record<string, unknown>
  const shortHash = Math.random().toString(36).slice(2, 8)                    // discretion: hash vs counter
  const forked = { ...def, slug: `${starter.slug}-${shortHash}`, version: 1, status: "draft" } as WorkflowDefinitionJSON
  try {
    const created = await createWorkflowDraft(forked)                        // POST /workflows → is_global=false/draft/created_by
    await refetchDrafts()
    setBuilderInitial({ definition: forked, draftId: created.id, label: `From starter · ${starter.name}` })
    setPageView("builder")
  } catch (e) { console.error("[WorkflowsPage] starter fork failed", e) }    // 409 hash-collision → retry with fresh hash
}, [refetchDrafts])
```
> ⚠️ If `def` carries `category:"starter"` and the `category` field is NOT added to `WorkflowDefinition`, `createWorkflowDraft` → `create_draft` returns **422** (`extra='forbid'`). See Shared Pattern 1 — either add the field OR strip `category` from `forked`.

**Starters `<section>` mirrors the Published `<section>`** (384-413). Reuse the exact `data-testid="…-shelf"` + heading + `grid grid-cols-1 gap-3 md:grid-cols-2` + `.map(PublishedCard)` structure. Feed it from a new `starters` state fetched via `listStarterWorkflows()` (mirror `refetchPublished` :108-122, minus the project-filter branch — starters are global/unscoped).

**BUG-260628-01 fold = a JSX section REORDER, not a within-list sort** (Pitfall 6). Today the order is Drafts (350-381) → Published (383-413). Target order per D-143-5/D-143-8: **Starters (top) → Published (mine) → Drafts & seeds**. Move the `<section>` blocks; keep the Build-card discoverable in Drafts (Open Question 3).

**Published shelf → mine-only.** In `refetchPublished` (:108-122) call `listPublishedWorkflows(projectArg, { scope: "mine" })` (or the chosen signature) so scaffolds + starters stop double-rendering (D-143-2a end state).

**Run modal / latest-wins guards are UNCHANGED** — the `publishedSeqRef` latest-wins pattern (:99-122) is the template if the Starters fetch also needs a race guard (it is a single unscoped fetch, so likely not).

---

### `frontend/src/pages/WorkflowsPage.test.tsx` (test, frontend unit) — EXTEND

**Analog:** itself — the "Tweak forks a v(N+1) draft (INSERT, never UPDATE)" describe block (334-372) and "drafts-above-published shelves" block (175-208).

**Fork-assertion pattern** (335-346) — clone for `onUseStarter`, asserting the D-143-1 deltas (new suffixed slug + `version === 1`, NOT `N+1`):
```typescript
fireEvent.click(within(starterCard).getByTestId("use-starter"))
await waitFor(() => expect(mockCreateDraft).toHaveBeenCalledTimes(1))
const forked = mockCreateDraft.mock.calls[0][0]
expect(forked.slug).toMatch(/^risk-register-[a-z0-9]{6}$/)   // new suffixed slug
expect(forked.version).toBe(1)                                // v1, not N+1
expect(forked.status).toBe("draft")
expect(mockUpdate).not.toHaveBeenCalled()                     // INSERT, never UPDATE the frozen starter
```

**Section-order assertion pattern** (176-182) — `compareDocumentPosition` DOM-order check; extend to assert Starters precedes Published precedes Drafts (the BUG-260628-01 fold):
```typescript
const starters = await screen.findByTestId("starters-shelf")
const published = screen.getByTestId("published-shelf")
expect(starters.compareDocumentPosition(published) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
```

**Mock seam** (44-53, 124-132) — add `listStarterWorkflows: mockListStarters` to the `vi.mock("@/lib/api", …)` block + a `beforeEach` default `mockListStarters.mockResolvedValue([...])`.

---

### `backend/tests/unit/test_starter_workflows.py` (test, backend unit/db) — NEW

**Analog:** `backend/tests/unit/test_103_draft_crud.py` (the whole file — live-`:54322` asyncpg pattern).

**Skip-guard + DSN + rollback scaffolding** (`test_103_draft_crud.py`:22-45) — copy verbatim:
```python
_DSN = os.environ.get("POSTGRES_DSN", "postgresql://postgres:postgres@127.0.0.1:54322/postgres")
def _pg_reachable(dsn=_DSN) -> bool: ...          # psycopg2 connect_timeout=2, never raises
PG_AVAILABLE = _pg_reachable()
pytestmark = pytest.mark.skipif(not PG_AVAILABLE, reason="…Postgres not reachable…")
```

**Per-test asyncpg pool + seed-then-cleanup** (`test_103_draft_crud.py`:77-107) — the `create_pool(min_size=1,max_size=1)` → `try/finally: DELETE WHERE slug=$1` → `await pool.close()` envelope. Imports INSIDE the test body (Phase 102 posture). Cover:
- **SC-a**: seed a `category='starter'` global row + confirm `list_starter_workflows` returns it and EXCLUDES the 5 mig-061 scaffolds (they lack the marker).
- **SC-b**: `list_published_workflows(owned_only=True)` returns `created_by=me` only; `owned_only=False` (default) still returns globals (the picker regression guard, Pitfall 3).

---

### `backend/tests/integration/test_workflows_routes.py` (test, integration/route) — NEW

**Analog:** `test_103_draft_crud.py::test_route_round_trip_create_list_patch_delete` (:210-272) + `test_103_tweak_fork.py`.

**Route-under-test with patched pool** (`test_103_draft_crud.py`:232-234) — call the route fns directly with a `current_user` dict + `patch("app.api.workflows.get_pg_pool", AsyncMock(return_value=pool))`:
```python
with patch("app.api.workflows.get_pg_pool", AsyncMock(return_value=pool)):
    rows = await wf_api.get_starter_workflows(current_user={"id": str(owner)})
    # assert the 3 seeded starters present; scope="mine" narrows get_published_workflows
```
Cover the RESEARCH Test Map: `GET /workflows/starters` returns the seeded starters; `GET /workflows/published?scope=mine` narrows; fork 409 (mirror `test_103_tweak_fork.py`'s publish-a-fork → `UNIQUE(slug,version)` shape at :64-114, adapted to the new-slug fork).

---

### Starter card "Official/Starter" chip (component chrome — NO new component)

**Analog:** `WorkflowsPage.tsx` `PublishedCard` `published` status pill (543-545) + the shared `<WorkflowSoul def={def} scale="card">` atom (549). G-2 sketch waived — reuse the exact pill chrome, only swap label/color:
```tsx
// clone the "published" pill (543-545); D-143-8: Glean verified-badge analog
<span className="shrink-0 rounded-full border border-primary/40 px-1.5 py-0.5 font-mono text-[9px] uppercase text-primary">
  Starter
</span>
```
Fork CTA copy = **"Use this starter"** (D-143-8, Zapier analog) — replace the `⑂ Tweak` button copy/handler (`PublishedCard` :552-561) with the `onUseStarter` wiring on the Starters shelf's card variant. The soul atom (`WorkflowSoul scale="card"`) renders unchanged from the raw `definition` JSONB.

---

## Shared Patterns

### 1. ⚠️ The `category` marker vs `extra="forbid"` — LOAD-BEARING (add a field, mirror the 098 additive-optional lock)
**Source:** `backend/app/models/harness.py` — `WorkflowDefinition(_StrictBase)`; `_StrictBase.model_config = ConfigDict(extra="forbid")` (line 30); the "098 additive-optional schema lock" field block (228-240).
**Applies to:** the seed migration, `seed-starters.py` (`_validate_def`), and the fork round-trip (`onUseStarter` → `create_draft`).
**The trap:** `WorkflowDefinition` does **not** declare a `category` field, and `extra="forbid"` **rejects** unknown keys. D-143-2 puts `category` INSIDE the `definition` JSONB. That is safe for READS (`list_starter_workflows` returns raw dicts, the frontend reads raw JSON), but breaks two write paths:
1. `seed-starters.py:_validate_def` → `WorkflowDefinition.model_validate(def_dict)` raises (aborts the seed).
2. **Fork:** `onUseStarter` copies `starter.definition` (with `category`) → `createWorkflowDraft` → `POST /workflows` parses the body as `WorkflowDefinition` → **422 Unprocessable Entity** on the `category` key.
**The fix (mirror the 098 precedent, lines 228-235):** add one additive-optional field — old JSONB rows model_validate to the default, and no migration is needed:
```python
category: str | None = None   # 143 WF-01 — the Starters-shelf curation marker (D-143-2)
```
Alternative (if the model is intentionally frozen): strip `category` from the `forked` object in `onUseStarter` before `createWorkflowDraft`, and skip `_validate_def` in the seed script. Planner must pick one — this is the single highest-risk detail in the phase.

### 2. `is_global` is seed-only; the immutability trigger freezes published rows
**Source:** `supabase/migrations/056_workflow_definitions.sql` — RLS INSERT `WITH CHECK (auth.uid() = created_by AND is_global = false)` (55-57); the `workflow_definitions_block_published_update` trigger (81-99, SQLSTATE 23514); the seed system user (107-117).
**Applies to:** the seed migration + `seed-starters.py`.
There is NO app path to author a global starter — it MUST be a seed migration (SQL-editor superuser bypasses RLS). Re-authoring a published starter row is `23514`; use a FIXED uuid + `ON CONFLICT (id) DO NOTHING` (mig 061) or DELETE-then-INSERT (`seed-pm-pack.py:upsert_definition` :470-517). Never UPDATE.

### 3. Transform-on-promote (strip private binding, re-home template)
**Source:** RESEARCH Runtime State Inventory + `scripts/seed-pm-pack.py:_build_def` (346-398) / `upload_template` (292-314).
**Applies to:** the seed migration + `seed-starters.py`.
The two live source rows (`pm-risk-register`, `pm-weekly-status-report`) bind a private `project_folder_id`/`folder_scope` (`1564da7e…`) and a private `_library` template (`d8a54002…`). Promote = a TRANSFORM: drop `project_folder_id` + every `folder_scope`, re-home `assets[].asset_id` to `00000000-…-01/_library/<slug>.docx`, set the curation fields. A verbatim copy produces a non-runnable starter (Pitfall 1).

### 4. Scoped narrowing, not blanket change (additive default-off param)
**Source:** the `owned_only` / `scope=mine` pattern (RESEARCH Pattern 2); shared consumers `backend/app/api/threads.py:51`, `frontend/src/components/panel/WorkspacePanel.tsx:125`, plus the composer picker.
**Applies to:** `list_published_workflows` (db) + `get_published_workflows` (api) + `listPublishedWorkflows` (client).
Every new param defaults OFF so existing callers stay byte-identical (the 098 `project_folder_id=None` precedent + `create_workflow_run`'s `is_golden_run=False` keyword-only precedent, `db/workflows.py`:86,118-122).

### 5. Migration apply + full-schema regen discipline
**Source:** `061`:24-27 header + CLAUDE.md.
**Applies to:** migration 094.
Paste into the Supabase SQL editor (never `db push`/`db reset`) → `bash scripts/regenerate-full-schema.sh` (no `--reset`) → commit the migration AND the regenerated `supabase/full-schema.sql`. Filename `094_starter_workflows.sql` (no letter suffix — silently skipped by the CLI).

### 6. `$N`-only SQL; literals for constants
**Source:** `db/workflows.py` file header (T-073-02 / T-091-03) + the `project_folder_id` binding note (:179-182).
**Applies to:** `list_starter_workflows`, `list_published_workflows`.
User-supplied values bind as positional `$N` (never f-string-interpolated). The `category = 'starter'` predicate is a constant literal, so it needs no parameter (RESEARCH Pattern 1).

---

## No Analog Found

None. Every file has a concrete in-repo analog. The only NEW **directory-placement** is `backend/tests/integration/test_workflows_routes.py` — no integration test for the workflows router exists yet, but the route-testing MECHANIC (patched `get_pg_pool` + direct route-fn calls) has an exact precedent in `backend/tests/unit/test_103_draft_crud.py:210-272`.

---

## Metadata

**Analog search scope:** `supabase/migrations/`, `scripts/` (+ `scripts/pm-pack/`), `backend/app/db/`, `backend/app/api/`, `backend/app/models/`, `backend/tests/{unit,integration}/`, `frontend/src/pages/`, `frontend/src/lib/`, `frontend/src/components/workflows/`.
**Files scanned (read in full or targeted):** `061`, `056` (migrations); `seed-pm-pack.py`, `make_pm_templates.py`; `db/workflows.py`, `api/workflows.py`, `models/harness.py` (fields); `WorkflowsPage.tsx`, `WorkflowsPage.test.tsx`, `api.ts` (targeted); `test_103_draft_crud.py`, `test_103_tweak_fork.py`. Live migration listing confirms **094** is the next free number.
**Pattern extraction date:** 2026-07-10
