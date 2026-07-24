# Phase 182: Server Validation Seam - Pattern Map

**Mapped:** 2026-07-24
**Files analyzed:** 10 (3 NEW code, 2 MODIFIED code, 1 REMOVED, 3 NEW tests, 2 REPOINTED tests)
**Analogs found:** 10 / 10 (every file has an in-repo analog — this is a pure reuse/extraction phase)

> Backend-only phase (no frontend). All analogs verified by `Read` this session. The
> "closest analog" for most files is named directly in `182-RESEARCH.md`; this map pins the
> concrete line ranges + signatures/conventions the planner instructs each plan to mirror.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/services/harness/grounding.py` (NEW) | service (shared source) | transform + CRUD-read (DB) | `workflow_authoring.py:262-355` (`_assemble_grounding`/`_check_grounding_fidelity`/`_grounding_failed`) | exact (moves the code) |
| `backend/app/api/workflows.py` → `POST /validate` (NEW route) | route/controller | request-response | `create_draft` (`workflows.py:297-328`) + `publish_workflow` (`:234-285`) | exact |
| `backend/app/api/workflows.py` → `GET /grounding-bundle` (NEW route) | route/controller | request-response (cacheable read) | `generate_workflow` (`workflows.py:636-671`) + `get_starter_workflows` (`:180-207`) | exact |
| verdict/envelope models (`ValidateResponse` / `Verdict` / `GroundingBundleResponse`) (NEW) | model | config/shape | `PublishVerdict` (`workflows.py:222-231`) + `_StrictBase` (`harness.py:27-30`) | exact |
| `backend/app/services/workflow_authoring.py` (MODIFIED — thin delegates) | service | transform | itself pre-extraction (byte-identical output invariant) — RESEARCH Pattern 1 | exact (self) |
| `backend/app/main.py` (MODIFIED — drop canary import/include) | config/wiring | — | `main.py:657` import list + `:659-688` include block | exact |
| `backend/app/api/canvas_canary.py` (REMOVED) | route | — | n/a (delete) — RESEARCH D-182-04 | n/a |
| `backend/tests/unit/test_182_validate.py` (NEW) | test | request-response + unit | `test_103_grounding_fidelity.py` (monkeypatch grounding) + `test_103_lint_block.py` (code assertion) | role-match |
| `backend/tests/test_182_grounding_bundle.py` (NEW) | test | request-response + live-DB | `test_workflows_routes.py:30-52` (psycopg2 skip-guard) | role-match |
| `backend/tests/test_182_extraction_parity.py` (NEW) | test (regression guard) | invariant | existing `test_103_grounding_fidelity.py` / `test_103_nl_generate.py` (guard COUNT stays) | role-match |
| `backend/tests/test_revert_byte_identical.py` (REPOINT) | test | request-response | itself — swap `/canvas/ping` → real routes | exact (self) |
| `backend/tests/test_181_flip_on.py` (REPOINT) | test | request-response | itself — swap `/canvas/ping` → `GET /grounding-bundle` | exact (self) |

---

## Pattern Assignments

### `backend/app/services/harness/grounding.py` (NEW — service, the ONE shared grounding source)

**Analog:** `backend/app/services/workflow_authoring.py:262-355` (the code being MOVED), with module-shape discipline copied from `backend/app/services/harness/reachability.py:1-22`.

**Extract-verbatim source — `_assemble_grounding` (`workflow_authoring.py:262-313`).** Split this into `assemble_grounding_bundle(...) -> GroundingBundle` (the registry computation, lines 275-288) + `render_grounding_prompt(bundle, project_folder_id) -> str` (the string render, lines 290-312 — lift VERBATIM). The registry computation to lift:
```python
from app.services.openai_service import get_tools  # function-local
from app.utils.folder_utils import fetch_visible_folders  # function-local

folders = await fetch_visible_folders(supabase, user_id)
tool_names = {t["function"]["name"] for t in get_tools(None)}
skills = await run_in_threadpool(_skill_registry, supabase, user_id)   # D-v2.5-01 blocking read wrapped
skill_ids = {str(s["id"]) for s in skills}
placeholders = await _resolve_template_placeholders(...)
```
The GET bundle endpoint serializes `bundle.tools / bundle.folders / bundle.skills / bundle.placeholders`; the fidelity checks read `bundle.tool_names / bundle.skill_ids`. **One computation, three consumers** (RESEARCH Pattern 1).

**Grounding-failure envelope to preserve for NL-gen — `_grounding_failed` (`workflow_authoring.py:316-319`):**
```python
def _grounding_failed(detail: str) -> dict:
    return {"ok": False, "error": "grounding_failed", "detail": detail}
```
This is the `{ok, error, detail}` vocabulary the whole phase's envelope aligns to (Discretion item 4).

**Per-node collector — build a sibling to `_check_grounding_fidelity` (`workflow_authoring.py:322-355`).** The verbatim fidelity check SHORT-CIRCUITS on first violation and returns a dict; `/validate` needs a per-node LIST. Reuse the SAME three atomic rules but APPEND (RESEARCH Pattern 2). The three rules to preserve verbatim:
```python
# 1. folder ⊆ subtree — reuse assert_folder_scopes_subset VERBATIM (raises ValueError, names the slug)
await assert_folder_scopes_subset(wd, supabase=supabase, user_id=user_id)
# 2. tool ∈ registry
for tool in getattr(phase.config, "available_tools", None) or []:
    if tool not in tool_names: ...
# 3. skill_ref ∈ enabled set
ref = getattr(phase.config, "skill_ref", None)
if ref is not None and str(ref) not in skill_ids: ...
```
Keep `_check_grounding_fidelity` as a thin short-circuit wrapper for NL-gen (same rules, two presentations).

**Module-shape discipline (Anti-pattern to avoid — Pitfall 1):** copy `reachability.py:1-22`'s "PURE / no DB in this module's neighbor" intent by keeping grounding in its OWN `grounding.py` — do NOT fold it into `reachability.py` (which is deliberately I/O-free). The route imports lint via `from app.services.harness.reachability import lint_workflow` (module-direct, import-light).

---

### `backend/app/api/workflows.py` → `POST /validate` (NEW route — controller, request-response)

**Analog:** `create_draft` (`workflows.py:297-328`) for the raw-body + `extra="forbid"` shape; `publish_workflow` (`:234-285`) for the verdict-return shape.

**Raw `WorkflowDefinition` body + 422-for-free — mirror `create_draft` (`workflows.py:303-312`):**
```python
@router.post("", response_model=DraftCreateResponse, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_visible("workflow_authoring"))])
async def create_draft(body: WorkflowDefinition, current_user: dict = Depends(get_current_user)):
    # "A hallucinated/extra key in the body is already a 422 (WorkflowDefinition is extra='forbid')."
```
For `/validate`: take `body: WorkflowDefinition` the SAME way → FastAPI 422 on a malformed body for free. Do NOT relax to a lenient `dict` (Anti-pattern — the 422 IS the shape tier).

**Gate attach — SWAP `require_visible` for `require_canvas` (D-182-05, Pitfall 3).** The existing authoring routes carry `dependencies=[Depends(require_visible("workflow_authoring"))]` (`workflows.py:301,334,363`) which raises **403** on deny. The new canvas routes MUST use `require_canvas` ALONE:
```python
@router.post("/validate", response_model=ValidateResponse,
             dependencies=[Depends(require_canvas())])   # 404-when-off, NOT require_visible's 403
```

**Verdict-return + service delegation — mirror `publish_workflow` (`workflows.py:262-285`) and `generate_workflow` (`:659-671`).** The handler runs the 4 static checks, classifies severity, returns the envelope. `publish_workflow` shows the pattern of building a structured verdict and returning it as 200 (not raising for a "blocked" result):
```python
result = await publish_service.publish(...)
# blocked stages map to HTTP; a business verdict returns 200 with the machine-renderable body
return PublishVerdict(**result)
```
`/validate` is even simpler — it never persists/executes; it always returns 200 with `{ok, verdicts}` (a read-only advice surface).

**The 4 verbatim checks to aggregate (RESEARCH §Architecture diagram):**
1. `lint_workflow(body)` — `reachability.py:83` (pure; import module-direct). Map each `LintError(code, phase_slug, message)` → verdict.
2. `grounding_verdicts(body, bundle, ...)` — the NEW shared collector (`grounding.py`).
3. `business_requirement_missing(body)` — the D-13 predicate `not (definition.business_requirement or "").strip()` (`publish_service.py:124`) → extract to a shared one-liner (Pitfall 4).
4. `_interactive_phase_failures(body)` — `publish_service.py:402` (module-level, pure — reuse verbatim).

**Owner-id coercion helper to reuse — `_coerce_user_id` (`workflows.py:291-294`):**
```python
def _coerce_user_id(current_user: dict) -> UUID:
    user_id = current_user["id"]
    return UUID(user_id) if isinstance(user_id, str) else user_id
```

**Route-ordering — declare as explicit STATIC segments (the `/drafts`/`/starters` precedent, `workflows.py:180-196,331-335`)** so no future `/{definition_id}` path shadows them.

---

### `backend/app/api/workflows.py` → `GET /grounding-bundle` (NEW route — controller, cacheable read)

**Analog:** `generate_workflow` (`workflows.py:636-671`) for the `supabase=Depends(get_supabase)` + `current_user` service-delegation shape; `get_starter_workflows` (`:180-207`) for a pure-read GET returning a mapped list.

**Supabase dependency + service delegation — mirror `generate_workflow` (`workflows.py:640-646`):**
```python
async def generate_workflow(body: GenerateRequest,
                            current_user: dict = Depends(get_current_user),
                            supabase=Depends(get_supabase)):   # service-role carve-out (grounding reads)
```
For `/grounding-bundle`: same `current_user` + `supabase=Depends(get_supabase)`, attach `dependencies=[Depends(require_canvas())]`, delegate to `assemble_grounding_bundle(supabase, user_id)` and return `bundle.tools / .folders / .skills / .placeholders` as JSON. `template_placeholders` only populated behind an optional `?template_asset_id=` query param (RESEARCH A3), else `[]`.

**Owner-scoped read discipline (V4):** `fetch_visible_folders(supabase, user_id)` + `_skill_registry` are OWNER-scoped by `user_id` — the extraction MUST preserve the exact scoping (never widen the palette to another user's folders/skills).

---

### verdict/envelope models — `ValidateResponse` / `Verdict` / `GroundingBundleResponse` (NEW)

**Analog:** `PublishVerdict` + `PublishRequest` (`workflows.py:215-231`) for co-located route models; `_StrictBase` (`harness.py:27-30`) for the `extra="forbid"` base.

**Structured verdict model — mirror `PublishVerdict` (`workflows.py:222-231`):**
```python
class PublishVerdict(BaseModel):
    """The D-08 structured verdict. Machine-renderable (nothing prose-only)."""
    published: bool
    version: int | None = None
    golden_run_id: UUID | None = None
    blocked_stage: str | None = None
    named_failures: list = Field(default_factory=list)
```
The `/validate` envelope (Discretion item 4 — align with `{ok, error, detail}` + D-08 vocab):
```python
class Verdict(BaseModel):
    code: str
    phase: str | None = None       # phase.slug, or None for workflow-global (SC#4)
    message: str
    severity: Literal["error", "incomplete"]

class ValidateResponse(BaseModel):
    ok: bool                       # ok == (verdicts == []) — the "can this pass?" signal (A1)
    verdicts: list[Verdict] = Field(default_factory=list)
```
Where these models LIVE is discretion — co-locate in `workflows.py` next to `PublishVerdict` (the established convention: `PublishRequest`/`PublishVerdict`/`DraftCreateResponse`/`GenerateRequest` all live inline in the router), OR add to `models/harness.py`. The lint-verdict dict shape MUST mirror `publish_service.py:146-149` exactly: `{"code": e.code, "phase": e.phase_slug, "message": e.message}`.

**Severity taxonomy (verbatim from RESEARCH §Code Examples — the full table is in RESEARCH lines 345-360):** structural + grounding-fidelity → `error`; empty-draft `no_terminal` / `business_requirement` / `input_unsatisfied` / `interactive_phase` → `incomplete`. Special-case `no_terminal`: `len(phases)==0 → incomplete`, else `error` (Pitfall 2).

---

### `backend/app/services/workflow_authoring.py` (MODIFIED — become thin delegates)

**Analog:** itself, pre-extraction. The INVARIANT: `_assemble_grounding` must return the byte-identical `(grounded_prompt, tool_names, skill_ids)` tuple after delegating (SC#2 anti-drift). RESEARCH Pattern 1 gives the exact rewrite:
```python
async def _assemble_grounding(*, supabase, pool, user_id, project_folder_id,
                              template_asset_id=None, template_placeholders=None):
    from app.services.harness.grounding import assemble_grounding_bundle, render_grounding_prompt
    bundle = await assemble_grounding_bundle(...)
    grounded = render_grounding_prompt(bundle, project_folder_id)
    return grounded, bundle.tool_names, bundle.skill_ids   # ← identical tuple, NL-gen unchanged
```
`_check_grounding_fidelity` (`:322-355`) similarly delegates to the shared atomic rules (kept short-circuit). The existing `test_103_grounding_fidelity.py` / `test_103_nl_generate.py` MUST stay green byte-for-byte — they are the extraction regression backstop.

**Note on the test monkeypatch seam:** `test_103_grounding_fidelity.py:61` does `monkeypatch.setattr(wa, "_assemble_grounding", _fake_assemble)`. As long as `wa._assemble_grounding` remains a module attribute with the SAME `(str, set, set)` tuple contract, this test seam survives the extraction untouched.

---

### `backend/app/main.py` (MODIFIED — canary retirement, D-182-04)

**Analog:** the exact lines to remove. Line 657 import list currently ends `... , me_preferences, canvas_canary  # noqa: E402` — drop `canvas_canary`. Line 688 `app.include_router(canvas_canary.router)  # Phase 181 REVERT-01 ...` — delete the whole include line. No other line in `main.py` references the canary.

---

### `backend/app/api/canvas_canary.py` (REMOVED — D-182-04)

**Analog:** n/a — delete the file (`canvas_canary.py:1-31`). Its docstring already anticipates this: *"REMOVE / REPURPOSE when the first real canvas route lands (182/183)."* `POST /validate` + `GET /grounding-bundle` carry the SAME `dependencies=[Depends(require_canvas())]` attach, so the throwaway `GET /canvas/ping` is redundant.

---

### `backend/tests/unit/test_182_validate.py` (NEW — verdict unit set)

**Analog:** `test_103_grounding_fidelity.py` (grounding monkeypatch) + `test_103_lint_block.py` (code-set assertion).

**Monkeypatch the shared grounding module (mirror `test_103_grounding_fidelity.py:51-70`):**
```python
async def _fake_assemble(**_kwargs):
    return ("GROUNDED", set(tool_names), set(skill_ids))
monkeypatch.setattr(wa, "_assemble_grounding", _fake_assemble)
```
For 182 point the monkeypatch at the NEW `grounding` module's `assemble_grounding_bundle` (return a fake `GroundingBundle`) so no live DB is needed. Also monkeypatch `assert_folder_scopes_subset` to raise for the folder-⊆ verdict case (mirror `test_103_grounding_fidelity.py:104-107`).

**Code-set assertion lens (mirror `test_103_lint_block.py:23-29,92-97`):**
```python
_LOWERCASE_LINT_CODES = {"bad_index", "unsatisfiable_skip", "orphan_phase", "no_terminal", "input_unsatisfied"}
rendered_codes = {f["code"] for f in result["named_failures"] if isinstance(f, dict) and "code" in f}
assert rendered_codes <= _LOWERCASE_LINT_CODES
```
Extend for 182 to assert per-node `phase == slug` keying (SC#4) + the error/incomplete severity split (incl. the `no_terminal` empty-vs-cycle case, Pitfall 2). Shape-valid definition builders: copy `_definition_with_tool` (`test_103_grounding_fidelity.py:23-42`) and `_lint_failing_row`'s non-contiguous-index trick (`test_103_lint_block.py:32-59`).

**Convention:** imports INSIDE test bodies (Phase 102 posture); `pytest.mark.asyncio` for `async def` tests. `get_supabase`/`get_current_user` are centrally overridden by conftest (`conftest.py:133-142`).

---

### `backend/tests/test_182_grounding_bundle.py` (NEW — GET bundle shape + gate)

**Analog:** `test_workflows_routes.py:30-52` (live-DB psycopg2 skip-guard) for the real read; `test_revert_byte_identical.py` for the 404-when-off probe.

**Live-DB skip-guard (copy `test_workflows_routes.py:30-52` verbatim):**
```python
_DSN = os.environ.get("POSTGRES_DSN", "postgresql://postgres:postgres@127.0.0.1:54322/postgres")
def _pg_reachable(dsn=_DSN) -> bool:
    try:
        import psycopg2; conn = psycopg2.connect(dsn, connect_timeout=2); conn.close(); return True
    except Exception:
        return False
PG_AVAILABLE = _pg_reachable()
pytestmark = pytest.mark.skipif(not PG_AVAILABLE, reason="...")
```
The route-level 404-when-off assertion needs NO DB (it 404s before the read) — use the `_cold_off` helper (below). The real `{tools, folders, skills, template_placeholders}` shape read is live-DB-guarded.

---

### `backend/tests/test_182_extraction_parity.py` (NEW — anti-drift regression guard)

**Analog:** the existing NL-gen tests as the guard surface. Assert `_assemble_grounding` returns byte-identical output post-extraction; assert `grounding.py` is the ONE source (no second grounding definition). **Guard the COUNT** of existing NL-gen tests so a silent test-drop is caught (the Phase-177 coverage-loss lesson — a "net-new" file replacing an existing suite is invisible to a failures-only differential).

---

### `backend/tests/test_revert_byte_identical.py` (REPOINT — D-182-04)

**Analog:** itself. Three tests reference `/canvas/ping` and must repoint onto the real routes:
- `test_require_canvas_404s_when_off` (`:71-92`) — swap `client.get("/canvas/ping")` → `GET /workflows/grounding-bundle` (a GET, no body confound) AND add a `POST /workflows/validate` probe **with a minimal VALID `WorkflowDefinition` body** so the ONLY thing that can 404 is the flag (Pitfall 5 — a missing/invalid POST body could 422-race the 404).
- `test_require_canvas_404s_pre_auth_when_off` (`:97-138`) — the CR-01 pre-auth path; repoint onto `GET /workflows/grounding-bundle`. Keep the override-pop pattern (`app.dependency_overrides.pop(get_current_user, None)` at `:121`) and the `_cold_off` helper (`:38-42`) exactly.
- `test_existing_governed_features_unchanged` (`:143-168`) — touches `/features` only, NOT the canary; leave unchanged.

**The `_cold_off` helper to reuse verbatim (`:38-42`):**
```python
def _cold_off(monkeypatch):
    from app.models import user_settings as us
    monkeypatch.setattr(us, "load_app_settings", lambda: SimpleNamespace(feature_visibility={}))
```

---

### `backend/tests/test_181_flip_on.py` (REPOINT — D-182-04, RESEARCH Open Q1)

**Analog:** itself. RESEARCH Open Q1 flags this file — CONTEXT D-182-04 named only `test_revert_byte_identical`, but `test_181_flip_on.py` ALSO hits `/canvas/ping` (3 tests) and `test_canvas_ping_200_after_flip_on` (`:74-95`) WILL FAIL when the canary is deleted (no route → 404, not 200). Repoint:
- `test_canvas_ping_404s_when_off_for_operator` (`:54-61`) + `..._for_user` (`:64-71`) — swap `/canvas/ping` → `GET /workflows/grounding-bundle`.
- `test_canvas_ping_200_after_flip_on` (`:74-95`) — repoint onto `GET /workflows/grounding-bundle`; keep the `authenticate_canvas_request` monkeypatch seam (`:89-92`) that injects a fake caller so the flag-on no-op is proven without a live token. NOTE: a live-DB read may be needed for a real 200 body — either skip-guard it or monkeypatch `assemble_grounding_bundle` to return an empty bundle so the 200 is provable offline.
- The `/features` tests (`:100-148`) are canary-independent — leave unchanged.

---

## Shared Patterns

### The flag gate — `require_canvas()` (D-182-05)
**Source:** `backend/app/dependencies.py:600-652`
**Apply to:** BOTH new routes (`POST /validate` + `GET /grounding-bundle`), via `dependencies=[Depends(require_canvas())]` — `require_canvas` ALONE, never stacked with `require_visible` (Pitfall 3).
```python
async def _dep(request, credentials=Depends(_canvas_bearer_scheme), supabase=Depends(get_supabase)):
    audience = feature_audience("visual_workflow_canvas")
    if audience == "off":
        raise _NOT_FOUND                      # 404 for ALL callers, incl. operators — resolved FIRST
    caller = await authenticate_canvas_request(credentials, supabase)
    if caller is None:
        raise _NOT_FOUND                      # anon/invalid/banned → byte-identical 404 (CR-01 pre-auth)
    ...
```
The off-flag check runs BEFORE any auth can leak route existence (the 181 CR-01 fix). Both routes inherit the byte-identical 404 for free — no new gate logic.

### Response envelope vocabulary
**Source:** `_grounding_failed` `{ok, error, detail}` (`workflow_authoring.py:316-319`) + the D-08 `{published, blocked_stage, named_failures}` publish verdict (`workflows.py:222-231`; block dict at `publish_service.py:146-149`).
**Apply to:** the `ValidateResponse` envelope + `Verdict` items. Do NOT invent new vocabulary — `ok` (matches grounding) + per-node `{code, phase, message}` (matches the publish lint block dict) + the added `severity` (the ONLY net-new field, D-182-03).

### Blocking DB read wrapped in `run_in_threadpool` (D-v2.5-01)
**Source:** `_assemble_grounding` already does `await run_in_threadpool(_skill_registry, supabase, user_id)` (`workflow_authoring.py:280`).
**Apply to:** the extracted `assemble_grounding_bundle` — preserve the threadpool wrap verbatim (the grounding checks + bundle touch the DB via supabase-py; never call blocking supabase-py directly in an async handler).

### Reuse-verbatim security-critical checks (Don't-Hand-Roll)
**Sources:** `assert_folder_scopes_subset` (`scope.py:197-231`, owner-scoped ⊆, raises ValueError — threat T-098-02); `_interactive_phase_failures` (`publish_service.py:402-442`, module-level pure); `lint_workflow` (`reachability.py:83-178`, pure).
**Apply to:** `grounding.py` collector + the `/validate` handler — import and call these; NEVER re-derive their logic. The frontend never re-implements any rule (D-182-06 / D-14 red line).

### G-5 RED LINE — router placement
**Source:** the repeated `# G-5 RED LINE: ... NEVER api/threads.py` markers (`workflows.py:289,211,621`).
**Apply to:** both new routes — mount on `api/workflows.py` (`router = APIRouter(prefix="/workflows")`, `:64`), NEVER `api/threads.py` (the hot-file ledger forbids growing threads.py).

### Test conventions
**Source:** `conftest.py:133-167` (central `get_current_user`/`get_supabase` overrides + `reset_mocks` autouse) + the Phase-102 "imports inside test bodies" posture visible across all `test_103_*` files.
**Apply to:** all three new test files — `pytest.mark.asyncio` for async, imports inside bodies, monkeypatch the module attribute (not the imported name), central conftest overrides for the mock user/supabase.

## No Analog Found

None. Every file in this phase has a direct in-repo analog — it is a pure reuse/extraction/repoint phase (RESEARCH §Summary: "There is nothing to invent"). The only genuinely NEW code is the thin severity-classification layer + the envelope models + the two route shells, all modeled on the analogs above.

## Metadata

**Analog search scope:** `backend/app/api/` (workflows, canvas_canary, main), `backend/app/services/harness/` (reachability, publish_service, scope), `backend/app/services/workflow_authoring.py`, `backend/app/dependencies.py`, `backend/app/models/harness.py`, `backend/tests/` (revert, flip-on) + `backend/tests/unit/` + `backend/tests/integration/`.
**Files scanned (Read this session):** 14 (workflows.py ×4 ranges, workflow_authoring.py, reachability.py ×2, publish_service.py ×3, scope.py, dependencies.py, harness.py ×2, canvas_canary.py, main.py, test_revert_byte_identical.py, test_181_flip_on.py, test_103_grounding_fidelity.py, test_103_lint_block.py, test_workflows_routes.py, conftest.py).
**Pattern extraction date:** 2026-07-24
