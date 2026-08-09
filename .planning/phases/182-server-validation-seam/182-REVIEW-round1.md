---
phase: 182-server-validation-seam
reviewed: 2026-07-25T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - backend/app/services/harness/grounding.py
  - backend/app/services/workflow_authoring.py
  - backend/app/services/harness/publish_service.py
  - backend/app/api/workflows.py
  - backend/app/main.py
  - backend/tests/test_182_extraction_parity.py
  - backend/tests/test_182_grounding_bundle.py
  - backend/tests/unit/test_182_validate.py
  - backend/tests/unit/test_103_nl_generate.py
  - backend/tests/test_revert_byte_identical.py
  - backend/tests/test_181_flip_on.py
findings:
  critical: 4
  warning: 9
  info: 6
  total: 19
status: issues_found
---

# Phase 182: Code Review Report

**Reviewed:** 2026-07-25
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Phase 182 extracted the grounding compute + the three fidelity rules into
`backend/app/services/harness/grounding.py` and added `POST /workflows/validate` +
`GET /workflows/grounding-bundle` behind `Depends(require_canvas())`.

**The extraction itself is faithful.** I diffed the pre-182 bodies against the new
module line-by-line: the short-circuit order (folder ⊆ → per-phase tools → `skill_ref`),
the first-offender selection (`_unregistered_tools` is order-preserving, so `offending[0]`
is the same offender the old inner `for` returned), the `{str(ref)!r}` → `{ref!r}` message
(identical, because `_unregistered_skill_ref` already returns `str(ref)`), the
`(str, set, set)` tuple contract, the `run_in_threadpool` wrap, and the function-local
`app.services.harness.scope` import (the Phase-103 monkeypatch seam) are all preserved.
`', '.join(bundle.tools)` is provably `', '.join(sorted(tool_names))`. The 44 tests in the
phase's 5 test files pass. The canary router is fully removed with no dangling references.

**What does not hold up is the seam's two headline claims.**

1. **"Byte-identical 404 when off, indistinguishable from a route that was never built"
   is false on two independent, anonymously-probeable channels** (both verified by running
   the real app with the flag off): unauthenticated `GET /openapi.json` returns 200 and
   advertises both routes with full schemas (CR-04), and `POST /workflows/validate` with a
   malformed JSON body returns **422 before the flag gate runs** where a never-built route
   returns 405 (CR-03). The test that is supposed to guard #2 asserts `!= 422` on a *valid*
   body — an assertion that cannot fail.

2. **"Every rule the canvas previews is the SAME copy the publish gauntlet enforces"
   (`workflows.py:230-237`) is factually wrong.** `publish_workflow` never runs grounding
   fidelity at all. Rules 2/3 (`available_tools ∈ registry`, `skill_ref ∈ enabled set`)
   have *no* enforcing call site outside NL generation, so the canvas can warn and the
   author can publish + run anyway (WR-01).

Separately, the palette route re-opens two *already-closed* multi-tenancy leaks on a
brand-new public surface: `_skill_registry` carries the exact un-org-gated PostgREST
predicate that SEED-125/CR-01 fixed elsewhere (CR-01), and the response serializes raw DB
rows, bypassing the `_null_foreign_global_owner` projection that every other folder/skill
read path applies (CR-02).

Verification commands used for the empirical claims are inline with each finding.

## Critical Issues

### CR-01: `/grounding-bundle` + `/validate` read skills with NO org predicate — re-opens the SEED-125 cross-org skill leak

**File:** `backend/app/services/harness/grounding.py:96-126` (consumed by
`backend/app/api/workflows.py:365-368, 380-388, 458-470`)

**Issue:** `_skill_registry` runs on the **service-role** client (`Depends(get_supabase)` —
BYPASSRLS, as the module's own docstring states) with only:

```python
.or_(f"user_id.eq.{user_id},is_org_shared.eq.true")
```

and a Python post-filter that also has no org check:

```python
if r.get("is_enabled") and (str(r.get("user_id")) == str(user_id) or r.get("is_org_shared"))
```

This is *verbatim* the predicate the project already identified as a cross-org leak.
`backend/app/services/tool_dispatcher.py:1143-1179` documents it explicitly:

> "Without an org predicate the legacy `.or_(user_id.eq.<caller>,is_org_shared.eq.true)`
> filter matched ANY org's `is_org_shared` skill → a disjoint-org caller's agent could load
> another org's skill instructions..."

and ships the corrected predicate as `_build_skill_visibility_or`. The live RLS policy
(`supabase/full-schema.sql:4833`) is the same shape:
`is_system OR (org_id IN current_user_org_ids() AND (auth.uid() = user_id OR is_org_shared))`.
Because every user got a personal org in mig 105, "another org" is effectively "any other
user who shared a skill."

Consequences, both net-new in this phase:
- `GET /workflows/grounding-bundle` returns **every** org's enabled `is_org_shared` skills
  (`id`, `name`, `user_id`) to any authenticated caller once the canvas flag is on.
- `POST /workflows/validate` treats a `skill_ref` pointing at a **foreign org's** skill as
  grounded (fidelity rule 3 passes), i.e. the seam tells the author a cross-tenant
  reference is valid.

Note the sibling folder read is *correct* here — `fetch_visible_folders` resolves
`caller_org_ids` and gates on them (D-165-04). Skills were simply never given the same
treatment on this path.

**Fix:** reuse the existing corrected predicate rather than adding a third copy — resolve
the caller's org set the way `folder_utils._resolve_caller_org_ids` does and push the org
gate down to the DB:

```python
# grounding.py — mirror tool_dispatcher._build_skill_visibility_or (SEED-125 / D-165-02)
from app.utils.db import coerce_uid
from app.utils.folder_utils import _resolve_caller_org_ids

async def _skill_registry_or(supabase, user_id: str) -> str:
    org_ids = await _resolve_caller_org_ids(supabase, user_id)
    caller = coerce_uid(user_id)
    if not org_ids:
        return "is_system.eq.true"          # fail closed: over-restrict, never over-share
    org_list = ",".join(coerce_uid(o) for o in sorted(org_ids))
    return (
        f"is_system.eq.true,"
        f"and(org_id.in.({org_list}),or(user_id.eq.{caller},is_org_shared.eq.true))"
    )
```

and mirror the same org check in the Python post-filter (select `org_id`, `is_system`). Add
a regression test: a skill owned by user B with `is_org_shared=true` in B's org must be
absent from A's `/grounding-bundle` and must produce an `unregistered_skill` verdict from
`/validate`.

---

### CR-02: `GET /grounding-bundle` serializes raw DB rows, bypassing the `_null_foreign_global_owner` owner-identity projection

**File:** `backend/app/api/workflows.py:277-293, 458-470` (rows produced at
`backend/app/services/harness/grounding.py:241, 255-257`)

**Issue:** `GroundingBundleResponse.folders` / `.skills` are typed `list[dict]` and the
route returns `bundle.folders` / `bundle.skills` untouched. `bundle.folders` comes from
`fetch_visible_folders` → `fetch_all_folders(supabase, fields="*")`, i.e. **every column**
of `public.folders` (`id, user_id, name, parent_id, is_org_shared, created_at, updated_at,
org_id` — `full-schema.sql:1093-1102`). `bundle.skills` carries `user_id` too.

Every other read path in the codebase deliberately nulls the owner on non-owned shared
rows, as an explicit security control:

- `backend/app/api/folders.py:20, 34` — `_null_foreign_global_owner(folders, current_user["id"])`
- `backend/app/api/kb.py:123` — same, plus the D-165-05 subtree-descendant set
- `backend/app/api/skills.py:218-222` — inline null for `is_org_shared`/`is_system` rows
- `backend/app/models/folder.py:22-27` — `FolderResponse.user_id: UUID | None`, with the
  comment "SEED-091 / D-164-05 (TEN-06): nullable owner… the seeding owner's identity is
  not disclosed"

`/grounding-bundle` applies none of it, so it discloses the seeding owner of every
org-shared folder and skill the caller can see, plus `org_id` (which `FolderResponse` does
not expose at all). This survives fixing CR-01 — it applies to in-org shared rows too.

**Fix:** project explicitly and reuse the shared helper; do not ship raw rows on a new
public surface.

```python
class PaletteFolder(BaseModel):
    id: UUID
    name: str
    parent_id: UUID | None = None

class PaletteSkill(BaseModel):
    id: UUID
    name: str | None = None

class GroundingBundleResponse(BaseModel):
    tools: list[str] = Field(default_factory=list)
    folders: list[PaletteFolder] = Field(default_factory=list)
    skills: list[PaletteSkill] = Field(default_factory=list)
    template_placeholders: list[str] = Field(default_factory=list)
```

The palette only needs `id`/`name`/`parent_id` (that is all `render_grounding_prompt`
consumes), so an explicit projection closes the leak *and* removes the `*` read. If raw
dicts must stay, call
`_null_foreign_global_owner(bundle.folders, user_id, await get_globally_visible_folder_ids(...))`
and the skills equivalent before returning.

---

### CR-03: the flag gate does not precede body parsing — a malformed JSON POST leaks that `/workflows/validate` exists (422, pre-auth)

**File:** `backend/app/api/workflows.py:326-337`; vacuous guard at
`backend/tests/test_revert_byte_identical.py:129-133`

**Issue:** FastAPI parses/decodes the request body in `get_request_handler` **before**
`solve_dependencies` runs, so a `json.JSONDecodeError` becomes a `RequestValidationError`
(422) without ever reaching `require_canvas`. Verified against the real app with the flag
off (`load_app_settings → feature_visibility={}`, no `Authorization` header):

```
POST /workflows/validate  valid body      -> 404 {"detail":"Not Found"}
POST /workflows/validate  MALFORMED json  -> 422 {"detail":[{"type":"json_invalid",...}]}
POST /workflows/__nope__  (never built)   -> 405 {"detail":"Method Not Allowed"}
```

A never-built route at that path+method answers **405** (the path matches
`PATCH|DELETE /workflows/{definition_id}`). So an anonymous prober sending one malformed
byte learns that a POST handler is declared at exactly `/workflows/validate` — the same
class of pre-auth existence leak Phase 181's review caught, on the new route.

The assertion meant to cover this cannot fail: `_MINIMAL_VALID_DEFINITION` is validated
against the real model on the line above, so `assert resp_validate.status_code != 422`
("the gate fired BEFORE body validation") is tautological.

**Fix:** move the flag decision ahead of body parsing (middleware or a router-level
gate), and make the test probe the actual hostile input.

```python
# app/middleware/canvas_gate.py — pure-ASGI, mirrors MaintenanceMiddleware's posture
_CANVAS_PATHS = frozenset({"/workflows/validate", "/workflows/grounding-bundle"})

class CanvasGateMiddleware:
    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and scope["path"] in _CANVAS_PATHS:
            from app.models.user_settings import feature_audience
            if feature_audience("visual_workflow_canvas") == "off":
                await JSONResponse({"detail": "Not Found"}, status_code=404)(scope, receive, send)
                return
        await self.app(scope, receive, send)
```

Keep `Depends(require_canvas())` on the routes (defense in depth), and replace the
tautology with the falsifiable probe:

```python
bad = client.post(_VALIDATE_PATH, content=b"{", headers={"content-type": "application/json"})
assert bad.status_code == 404, bad.text   # fails on today's code (422)
```

---

### CR-04: with the canvas off, unauthenticated `GET /openapi.json` and `/docs` advertise both canvas routes

**File:** `backend/app/main.py:592` (`app = FastAPI(title=..., version=..., lifespan=...)`),
routes at `backend/app/api/workflows.py:326-330, 426-430`

**Issue:** no `openapi_url=None` / `docs_url=None` and no `include_in_schema=False`, so the
schema is public and static with respect to the flag. Verified on the real app with the
flag off and **no credentials**:

```
GET /openapi.json (no auth, flag off) -> 200
   advertised /workflows/validate: True
   advertised /workflows/grounding-bundle: True
GET /docs -> 200
```

The schema also publishes `ValidateResponse`, `Verdict` (including the `severity` literals)
and `GroundingBundleResponse`. `SetupMiddleware` only gates a pre-finalize box, so on any
finalized deploy this is open. This directly falsifies REVERT-01's claim of "the same
**reachable-route set**… every canvas-gated route is a 404, byte-identical to a path that
was never built" (`test_revert_byte_identical.py:8-16`) — the routes are *published*
regardless of the flag, which is a strictly louder existence leak than any status-code
nuance.

**Fix:** keep the schema honest about the off state, and assert it in the byte-identity
gate. Minimal change:

```python
# workflows.py — both canvas routes
@router.post("/validate", response_model=ValidateResponse, include_in_schema=False,
             dependencies=[Depends(require_canvas())])
```

Better (keeps `/docs` useful when the canvas is on): filter in a custom `app.openapi()`
hook driven by `feature_audience("visual_workflow_canvas") == "off"`. Either way add:

```python
def test_openapi_does_not_advertise_canvas_routes_when_off(client, monkeypatch):
    _cold_off(monkeypatch)
    paths = client.get("/openapi.json").json()["paths"]
    assert _BUNDLE_PATH not in paths and _VALIDATE_PATH not in paths
```

If the operator decides the schema exposure is acceptable, the REVERT-01 wording must be
narrowed in the same commit — silently claiming an unproven property is the worse outcome.

## Warnings

### WR-01: publish does not enforce grounding fidelity — the "same copy publish enforces" claim is false

**File:** `backend/app/api/workflows.py:230-237, 338-348`;
`backend/app/services/harness/publish_service.py:127-177`

**Issue:** the seam's header states "Every rule it previews is the SAME copy the publish
gauntlet enforces — `lint_workflow` (structural), `grounding.grounding_verdicts`
(fidelity)…". `publish_workflow`'s stages are 0 owner-check → 1 `business_requirement` →
2 `lint_workflow` → 2.5 `_interactive_phase_failures` → 3 golden run → 4 judge → 5 flip.
**Grounding fidelity is not among them.** A grep of the whole backend confirms rules 2/3
have exactly one enforcing caller — `workflow_authoring.generate_workflow_definition:331`
(the NL path). Rule 1 (`assert_folder_scopes_subset`) *is* enforced, but at run start
(`workflow_kickoff.py:246`, `runs.py:946`, `harness_engine.py:1588`), not at publish.

So a Builder/canvas-authored draft with a hallucinated `available_tools` entry or a
`skill_ref` the owner cannot use will show a red `error` verdict in `/validate` and then
publish and run anyway. That is the inverse of the intended anti-drift posture: the rule
lives only on the advisory surface.

**Fix:** add a fidelity stage to `publish_workflow` between stages 2 and 2.5, reusing the
same shared collector so there is still one copy:

```python
bundle = await grounding.assemble_grounding_bundle(supabase=supabase, user_id=str(user_id))
fidelity = await grounding.grounding_verdicts(
    definition, supabase=supabase, user_id=str(user_id),
    tool_names=bundle.tool_names, skill_ids=bundle.skill_ids,
)
if fidelity:
    return await _block(..., stage="grounding", named_failures=fidelity, golden_run_id=None)
```

(`publish_workflow` already accepts `supabase`; when it is `None` it builds an org-scoped
client at `_drive_golden_run:505-517` — hoist that resolution if needed.) If enforcing at
publish is deliberately out of scope, correct the header text so the next phase does not
inherit a false invariant.

---

### WR-02: the "unbuilt-route parity" assertions compare against a different route shape (404 vs 405)

**File:** `backend/tests/test_revert_byte_identical.py:231-236`;
`backend/tests/test_182_grounding_bundle.py:99-104`

**Issue:** both tests establish parity against `GET /workflows/__nope__/__nope__` (two
segments → genuine 404) because a one-segment unknown returns 405. But the gated routes
*are* one-segment, so the honest baseline is 405:

```
GET /workflows/grounding-bundle (flag off) -> 404
GET /workflows/__nope__ (never built)      -> 405
```

Pre-181, `GET /workflows/grounding-bundle` returned 405; with the flag off it now returns
404. The observable response therefore *did* change with the flag off, and the test's
comment ("the body is the same 404 an unknown path returns") is proven only against a
route shape the gated routes do not have.

**Fix:** assert the real baseline and pick a deliberate posture. Either accept the residual
and say so explicitly in the test (`# residual: a 1-segment probe is 405 pre-181 vs 404
now — accepted deviation D-182-xx`), or make the canvas middleware from CR-03 return the
*same* response Starlette would have produced for an unmatched path+method, and pin it:

```python
assert client.get(_BUNDLE_PATH).status_code == client.get("/workflows/__nope__").status_code
```

---

### WR-03: `template_asset_id: UUID` can never resolve a real library asset, so `template_placeholders` is permanently `[]` (silently)

**File:** `backend/app/api/workflows.py:436, 446-449, 457-469`;
`backend/app/services/harness/grounding.py:156-204`

**Issue:** `AssetRef.asset_id` is a **Storage path**, not a UUID —
`backend/tests/integration/test_seed_pm_pack.py:218` asserts
`d["assets"][0]["asset_id"].startswith(f"{DEMO_USER_ID}/_library/")`, and
`template_asset_service.resolve_template_source:158-161` passes it straight to
`_read_from_storage(supabase, asset_id)` → `storage.from_("workspace-files").download(path)`.
Because the query param is typed `UUID`:

- the real asset id (a path) is rejected with 422 — pinned as intended behavior by
  `test_182_grounding_bundle.py:169-175`;
- any UUID that *is* accepted cannot match an object (every stored path is
  `{user_id}/{thread_id}/{file_id}/v{n}` or `{user_id}/_library/…` —
  `workspace_service.py:307`), so the download raises, `_resolve_template_placeholders`
  swallows it (`except Exception` → `return []`), and the response carries `[]` with no
  error signal.

So the D-182-01 palette field Phase 184's dropdowns are supposed to bind to is dead on
arrival, and the tests confirm rather than catch it:
`test_grounding_bundle_returns_server_sourced_palette` asserts
`body["template_placeholders"] == []`, and the only non-empty case fakes the whole
assembler. (`GenerateRequest.template_asset_id` has the same UUID typing, so the Phase-103
library-template grounding path is equally inert — this is inherited, not introduced.)

**Fix — and read the security note before doing the obvious thing:** do **not** simply
widen the type to `str`. Branch 1 of `resolve_template_source` performs **zero** ownership
check and downloads with the service-role key, so a free-form string would become an
arbitrary-object read (`../`, another user's `_library/`) on the `workspace-files` bucket.
Accept a string and gate it on the caller:

```python
template_asset_id: str | None = None   # a library storage path, not a UUID
...
if template_asset_id is not None:
    if not template_asset_id.startswith(f"{user_id}/") or ".." in template_asset_id:
        raise HTTPException(status_code=404, detail="Not Found")   # no existence leak
```

and surface the resolution miss (e.g. `template_placeholders: []` plus a
`template_error: str | None`) instead of swallowing it, so Phase 184 can tell "no
placeholders" from "could not read the template". Add a test that drives a real seeded
`_library` asset through the route and asserts a non-empty list.

---

### WR-04: `/validate` is not sealed — a DB blip escapes as a 500 despite the documented "ALWAYS HTTP 200"

**File:** `backend/app/api/workflows.py:338-368, 379-388`

**Issue:** the handler docstring promises "ALWAYS HTTP 200 with the machine-renderable
envelope: a dirty definition is not an HTTP error, it is advice." Nothing enforces it:

- `grounding.assemble_grounding_bundle` → `fetch_visible_folders` → `aexec(...)` raises a
  PostgREST `APIError` on any read failure (only `_skill_registry` fails closed);
- `grounding_verdicts` → `_folder_scope_violation` catches **only** `ValueError`, so a DB
  error inside `resolve_project_subtree` propagates;
- `_coerce_user_id` raises `ValueError` on a non-UUID identity.

`publish_service` is explicitly "SEALED ORCHESTRATION… NEVER raises into the route"; the
route that fires on **every canvas keystroke** is not. A transient blip will surface to the
canvas as a 500 with no verdict envelope.

**Fix:** wrap the two I/O stages and degrade honestly rather than 500:

```python
try:
    bundle = await grounding.assemble_grounding_bundle(supabase=supabase, user_id=str(user_id))
except Exception:
    logger.warning("validate: grounding palette read failed; structural-only verdicts", exc_info=True)
    bundle = grounding.GroundingBundle()          # empty palette
    findings.append({"code": "grounding_unavailable", "phase": None,
                     "message": "grounding could not be checked right now"})
```

Note the fail-closed/fail-open choice matters: an empty palette makes every
`available_tools`/`skill_ref` look unregistered, so prefer an explicit
`grounding_unavailable` finding (classified `incomplete`) over silently reporting false
`error` verdicts.

---

### WR-05: the severity taxonomy re-declares the lint code literals in the route and fails **open** on an unknown code

**File:** `backend/app/api/workflows.py:296-323`

**Issue:** `_ERROR_CODES` hardcodes six string literals that are owned elsewhere
(`reachability.LintError.code` values and `grounding_verdicts`' codes), and `_severity`'s
final `return "incomplete"` means any code not in the set is painted grey
"still building" rather than red "broken". A new structural lint code added in a later
phase — or a rename that the current tests happen not to cover — silently downgrades a
hard break to a soft one. No test asserts that `_ERROR_CODES` covers the codes the four
checks can actually emit; the coverage is incidental (each existing code has its own
hand-written expectation).

**Fix:** make the mapping explicit and loud, and pin coverage:

```python
_SEVERITY_BY_CODE: dict[str, str] = {
    "bad_index": "error", "orphan_phase": "error", "unsatisfiable_skip": "error",
    "folder_scope": "error", "unregistered_tool": "error", "unregistered_skill": "error",
    "input_unsatisfied": "incomplete", "business_requirement": "incomplete",
    "interactive_phase": "incomplete",
    # "no_terminal" is split by phases_empty — handled before this lookup
}

def _severity(code: str, *, phases_empty: bool) -> str:
    if code == "no_terminal":
        return "incomplete" if phases_empty else "error"
    sev = _SEVERITY_BY_CODE.get(code)
    if sev is None:
        logger.error("validate: unclassified verdict code %r — defaulting to error", code)
        return "error"          # fail LOUD + fail SAFE, never silently grey
    return sev
```

plus a test asserting every code emitted by `lint_workflow` / `grounding_verdicts` /
the two publish predicates has an entry.

---

### WR-06: the `folder_scope` verdict drops the offending phase slug into prose, forcing the canvas to parse messages

**File:** `backend/app/services/harness/grounding.py:305-320, 366-369`

**Issue:** `_folder_scope_violation` returns `str(exc)` and the verdict is emitted with
`"phase": None` plus the slug embedded in the message
(`"phase 'answer' folder_scope is not a subset of…"`). The route's own contract is
per-node keying ("`phase` is the phase `slug` — the node identity the canvas paints on"),
so the one rule with a genuine per-phase offender is the one rule the canvas cannot key.
The only way for the canvas to highlight the node is to regex the message — a client-side
re-derivation of a server rule, which is exactly what the D-182-06 red line forbids.
`test_182_validate.py:230-231` freezes the weakness (`verdict.phase is None`;
`"answer" in verdict.message`).

**Fix:** carry the slug structurally without re-deriving the ⊆ walk. Either raise a typed
error from the shared checker:

```python
# scope.py
class FolderScopeViolation(ValueError):
    def __init__(self, phase_slug: str, outside: list[str]):
        self.phase_slug, self.outside = phase_slug, outside
        super().__init__(f"phase '{phase_slug}' folder_scope is not a subset of the "
                         f"project subtree: {sorted(outside)}")
```

(message text unchanged, so the NL short-circuit `detail` stays byte-identical), then in
`grounding_verdicts` emit `{"code": "folder_scope", "phase": exc.phase_slug, "message": str(exc)}`
— or emit one verdict per offending phase. Also note the current wording of Rule 1 means a
definition with several bad phases reports only the first.

---

### WR-07: normal mid-edit canvas states are shape-tier 422s that cannot be expressed as verdicts

**File:** `backend/app/api/workflows.py:352-358`;
`backend/app/models/harness.py:252-280`

**Issue:** the handler docstring treats the 422 as free input validation, but two of the
`@model_validator` rules describe states an author legitimately passes through:
`folder_scope` set before `project_folder_id` (`_folder_scope_requires_project`) and
`skill_snapshot` without `skill_ref` (`_skill_snapshot_requires_ref`). Both return a
Pydantic error envelope, not `{ok, verdicts}` — so the canvas gets no per-node verdict and
must implement its own explanation for a shape error. That is a second client-side rule
surface, growing precisely where the phase intends one server seam.

**Fix:** either accept a lenient input on this route only and re-emit shape failures as
`incomplete` verdicts…

```python
@router.post("/validate", response_model=ValidateResponse, dependencies=[Depends(require_canvas())])
async def validate_workflow(body: dict, ...):
    try:
        wd = WorkflowDefinition.model_validate(body)
    except ValidationError as e:
        return ValidateResponse(ok=False, verdicts=[
            Verdict(code="definition_invalid", phase=_phase_from_loc(err["loc"], body),
                    message=err["msg"], severity="incomplete")
            for err in e.errors()
        ])
```

…or document that the canvas must render 422 through a *server-provided* mapping, and ship
that mapping here. Do not leave the decision to Phase 184 — that is how the client-side
copy gets written.

---

### WR-08: `require_canvas` alone lets a user excluded from `workflow_authoring` reach the palette + validation oracle

**File:** `backend/app/api/workflows.py:326-330, 426-430`

**Issue:** every other authoring endpoint on this router carries
`require_visible("workflow_authoring")` (`:500, :564, :597, :626, :661, :731, :761, :901`).
The two new routes carry only `require_canvas()`, justified because `require_visible`
raises 403 and would leak route existence. The justification is correct, but the
*authorization* was dropped along with the 403: once the canvas audience is `everyone`,
any authenticated user can pull the palette and run the validation gauntlet even if the
operator has restricted authoring to admins. `workflow_authoring` is `everyone` today, so
the gap is latent — but it is a silent authorization asymmetry the moment an operator
narrows that audience.

**Fix:** fold the authoring audience into the canvas gate, keeping the 404 shape (no 403,
no existence leak):

```python
def require_canvas(*, also_visible: str | None = None):
    ...
    if also_visible and not await _audience_allows(also_visible, caller, request):
        raise _NOT_FOUND        # 404, never 403
```

then `dependencies=[Depends(require_canvas(also_visible="workflow_authoring"))]`. If the
decoupling is deliberate (canvas availability intentionally independent of authoring
visibility), record it as a decision — the current comment argues only about the status
code, not about the dropped check.

---

### WR-09: `_skill_registry`'s retry re-runs a byte-identical query, and interpolates `user_id` into the PostgREST DSL without `coerce_uid`

**File:** `backend/app/services/harness/grounding.py:96-126`

**Issue:** two defects in the block carried over verbatim from Phase 103:

1. The `except` branch retries **the exact same query** (same `.select`, same `.or_`), while
   its comment describes it as a narrowing retry ("A bare full-table fallback would… Retry
   with the SAME owner+global predicate pushed down to the DB"). There is no wider first
   attempt for it to narrow from, so the block is a duplicated no-op: any deterministic
   failure fails twice, and the misleading comment invites a future reader to "restore" the
   fallback the comment warns about.
2. `user_id` is spliced into the `.or_()` grammar with an f-string. The project has a shared
   guard for exactly this — `app/utils/db.py:33-44 coerce_uid`, whose docstring says
   "Service-role reads bypass RLS, so the in-app `user_id.eq.<uuid>` predicate is the SOLE
   owner-scoping gate… any value that is not a well-formed UUID raises `ValueError` instead
   of breaking out of the `user_id.eq.<...>` term" — and `tool_dispatcher._build_skill_visibility_or`
   uses it. The new routes happen to pass a `UUID`-coerced string, but
   `workflow_authoring`'s caller (`workflows.py:923-926`) passes `str(current_user["id"])`
   un-coerced, so the shared module's only protection is the caller's discipline.

**Fix:** delete the duplicate attempt (keep one query, fail closed to `[]`) and wrap the id:

```python
from app.utils.db import coerce_uid          # module top — stdlib-light, no cycle

def _skill_registry(supabase, user_id: str) -> list[dict]:
    caller = coerce_uid(user_id)             # non-UUID -> ValueError, never DSL breakout
    try:
        rows = (supabase.table("skills")
                .select("id,name,is_org_shared,is_system,org_id,user_id,is_enabled")
                .or_(_skill_visibility_or(caller, org_ids))   # see CR-01
                .execute().data) or []
    except Exception:
        logger.warning("grounding: scoped skills read failed; using empty skill set", exc_info=True)
        return []
    ...
```

## Info

### IN-01: `_coerce_user_id` is called ~200 lines before it is defined

**File:** `backend/app/api/workflows.py:360, 454` (definition at `:554`)
**Issue:** works at runtime (module-level name resolved at call time) and the comment at
`:246-247` acknowledges it, but the new routes were inserted above a helper they depend on.
**Fix:** hoist `_coerce_user_id` next to `_coerce_definition` (`:84`) so all helpers precede
the routes.

### IN-02: private symbols crossed module boundaries

**File:** `backend/app/services/workflow_authoring.py:208-210`;
`backend/app/api/workflows.py:410`
**Issue:** `grounding._check_grounding_fidelity` and
`publish_service._interactive_phase_failures` are underscore-private but imported/called
from other modules — the underscore no longer communicates anything.
**Fix:** promote both to public names (`check_grounding_fidelity`,
`interactive_phase_failures`) with a one-line back-compat alias, so "private" stays
meaningful.

### IN-03: `assemble_grounding_bundle(project_folder_id=...)` is accepted and ignored

**File:** `backend/app/services/harness/grounding.py:221, 233-236`
**Issue:** documented as "for signature symmetry", but a parameter that silently does
nothing is a trap — `/grounding-bundle` passes `project_folder_id=None` explicitly while
`/validate` omits it, and a future caller may reasonably expect the palette to narrow.
**Fix:** drop the parameter (the two call sites do not need it) or raise on a non-`None`
value until narrowing is actually implemented.

### IN-04: two assertions cannot fail

**File:** `backend/tests/unit/test_182_validate.py:322-335`;
`backend/tests/test_revert_byte_identical.py:132`
**Issue:** `assert {v.severity for v in resp.verdicts} <= {"error", "incomplete"}` is
guaranteed by `Verdict.severity: Literal[...]` (a third value would raise at construction),
and `!= 422` on a body validated in-test is tautological (see CR-03).
**Fix:** assert the taxonomy against the classifier instead
(`_severity("some_new_code", phases_empty=False)`), and probe the real malformed body.

### IN-05: the palette does a full-table `folders` read per `/validate` call

**File:** `backend/app/utils/folder_utils.py:8-24` via
`backend/app/services/harness/grounding.py:241`
**Issue:** `fetch_all_folders(supabase, fields="*")` selects every folder row in the
deployment with no filter or limit, then filters in Python — on a route documented as
firing "on every canvas edit". Beyond cost (out of scope for this review), PostgREST's
`max-rows` cap would silently truncate the set, which *is* a correctness risk: a truncated
`folder_map` makes `is_in_global_subtree` miss ancestors, so folders vanish from the
palette and `folder_scope` ⊆ checks can report false violations.
**Fix:** covered by the CR-02 projection (stop selecting `*`); longer term, push the
owner/org predicate into the query instead of fetching the whole table.

### IN-06: verdict keying is ambiguous for duplicate slugs

**File:** `backend/app/services/harness/grounding.py:372-391`
**Issue:** verdicts are keyed by `phase.slug`, but duplicate slugs are only a `bad_index`
lint finding, not a rejection — so a definition with two phases named `answer` produces
verdicts the canvas cannot attribute to a single node.
**Fix:** note the precedence in the contract (a `bad_index` duplicate-slug verdict
invalidates per-node keying) or key on `phase_index` with `slug` as a label.

---

_Reviewed: 2026-07-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
