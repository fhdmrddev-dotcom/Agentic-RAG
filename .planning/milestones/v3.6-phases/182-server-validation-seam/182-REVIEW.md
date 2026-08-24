---
phase: 182-server-validation-seam
reviewed: 2026-07-25T00:00:00Z
depth: standard
round: 3
files_reviewed: 18
files_reviewed_list:
  - backend/app/api/workflows.py
  - backend/app/dependencies.py
  - backend/app/main.py
  - backend/app/middleware/canvas_gate.py
  - backend/app/services/harness/grounding.py
  - backend/app/services/harness/publish_service.py
  - backend/app/services/harness/scope.py
  - backend/app/utils/folder_utils.py
  - backend/tests/test_182_canvas_gate.py
  - backend/tests/test_revert_byte_identical.py
  - backend/tests/unit/test_182_canvas_auth.py
  - backend/tests/unit/test_182_folder_scope_keying.py
  - backend/tests/unit/test_182_grounding_degradation.py
  - backend/tests/unit/test_182_grounding_skill_org_gate.py
  - backend/tests/unit/test_182_publish_grounding_stage.py
  - backend/tests/unit/test_182_publish_org_scope.py
  - backend/tests/unit/test_182_severity_codes.py
  - backend/tests/unit/test_182_validate.py
findings:
  critical: 3
  warning: 9
  info: 0
  total: 12
status: issues_found
---

# Phase 182: Code Review Report (round 3 — gap-closure plans 182-08 … 182-12)

**Reviewed:** 2026-07-25
**Depth:** standard
**Diff base:** `ed80de3b..HEAD`
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Third adversarial pass, scoped to the five plans that exist to close round-2's findings. I
verified each claim against the source rather than the SUMMARYs, and drove the real app with the
flag cold-off and no credentials to falsify the two claims that are only observable at the wire.

### Round-2 dispositions, verified against HEAD

| Round-2 | Status |
|---|---|
| CR-01 malformed body 422 pre-flag | **PARTIALLY closed.** `POST /workflows/validate` + `b"{"` is now 404 — but the gate replaced a 422-vs-405 oracle with a 404-vs-405/403 one. See **CR-01**. |
| CR-02 `/openapi.json` advertises both routes | **CLOSED.** Verified live: both paths and all five models are absent while off, `PublishVerdict` + `HTTPValidationError` survive, and the hook never writes the filtered doc into FastAPI's memo (`canvas_gate.py:263-272`). The off→on→off test is a genuine falsifier. |
| WR-01 false `unregistered_skill` on a degraded read | **CLOSED.** The `_skill_registry` swallow is gone, `GroundingBundle.degraded` is real, and `test_182_grounding_degradation.py` drives the REAL registry read against a raising client (not just a synthetic bundle). Discriminating. |
| WR-02 `/validate` unsealed → HTTP 500 | **CLOSED for the two grounding stages.** The seal is deliberately scoped so the pure checks still run, and the injected exception in the test is asserted *not* to be a `ValueError` — the premise the finding rested on. |
| WR-04 `folder_scope` multiplicity | **CLOSED.** `scope.folder_scope_violations` is the one non-raising walk; the 3-offender test runs the real walk and the "resolved exactly once" counter is a real guard. |
| WR-05 publish org scope | **CLOSED for skills and per-phase `folder_scope`.** NOT closed for `project_folder_id` itself — see **WR-02**. |
| WR-07 `folders` truncation | **DETECTED, not fixed.** The read is still unbounded and unfiltered; the change makes a truncation *fatal* instead of bounding it. See **CR-03** and **WR-01**. |
| WR-08 double auth | **CLOSED.** One GoTrue round-trip + one ban query, `run_in_threadpool` added, `canvas_caller` fails closed to 404. The counting test pops conftest's override and counts at the shared seam, so it genuinely discriminates. |
| WR-03 (`except ValueError`), WR-06/SEED-130, WR-09, WR-10, IN-01..07 | deferred / not addressed — **not re-reported**, except where this round created a new instance (**WR-06**) or made a deferral materially worse (**CR-01**, which explicitly builds on WR-09). |

### What this round got wrong

Three defects, all inside the fixes themselves:

1. **The non-discoverability gate leaks in the opposite direction** (CR-01). Proven at HEAD, flag
   cold-off, no credentials. The oracle is one probe:

   ```
   POST   /workflows/validate          b"{"  -> 404 {"detail":"Not Found"}
   POST   /workflows/zzzunknown        b"{"  -> 405 {"detail":"Method Not Allowed"}
   PATCH  /workflows/validate                -> 404      PATCH /workflows/zzzunknown   -> 403
   GET    /workflows/validate                -> 404      GET   /workflows/zzzunknown   -> 405
   GET    /workflows/grounding-bundle/       -> 404      GET   /workflows/zzzunknown/  -> 405
   ```
   Every single-segment `/workflows/<x>` answers 405 (or 403 for PATCH/DELETE); the two gated
   names answer 404. ROADMAP SC#3 is not met.

2. **The honest-failure signal has three consumers and only two branch on it** (CR-02). The
   `GET /workflows/grounding-bundle` palette — in the same file, 80 lines below the consumer that
   *does* branch — ignores `bundle.degraded` and serves an empty folder/skill palette at HTTP 200.
   For the folders half this is a **net-new regression**: before this round that read had no guard
   and a failure surfaced as a loud 500.

3. **The truncation guard trades a wrong answer for a permanent outage** (CR-03). At ≥ `max-rows`
   folders deployment-wide — a scale the new docstring itself calls "not a large deployment" —
   every `/validate` returns `grounding_unavailable`, the palette is empty, and **publish is
   permanently blocked**, with no pagination, no `.limit()`, and no operator remedy.

---

## Critical Issues

### CR-01: **BLOCKER** — the path-only canvas gate makes both gated routes uniquely enumerable by an anonymous method sweep (404 where an identically-shaped unbuilt path answers 405/403)

**File:** `backend/app/middleware/canvas_gate.py:119-135` (the `_is_canvas_path(path) and
_read_canvas_is_off()` short-circuit); registered at `backend/app/main.py:633`; enshrined by
`backend/tests/test_182_canvas_gate.py:104` and `:128-148`

**Issue:** The middleware gates on **path only, for every method**, by explicit design
(`canvas_gate.py:121-125`). The reasoning in that comment — "`GET /workflows/validate` returns 405
… which admits a POST handler is declared at exactly that path" — is factually wrong. Every
single-segment `/workflows/<anything>` is shadowed by `PATCH|DELETE /workflows/{definition_id}`
(`workflows.py:866`, `:901`), so Starlette returns `Match.PARTIAL` → **405 for GET/POST/PUT and
403 "Not authenticated" for PATCH/DELETE**, for *any* unknown name. 405 therefore admits nothing;
returning 404 instead is what admits something.

Re-proved against the real app at HEAD with `feature_visibility={}` and no `Authorization` header
(`TestClient`, anonymous):

```
canvas OFF, anonymous
  POST   /workflows/validate          b"{"  -> 404 {"detail":"Not Found"}
  POST   /workflows/zzzunknown        b"{"  -> 405 {"detail":"Method Not Allowed"}
  POST   /workflows/validate/         b"{"  -> 404          POST   /workflows/zzzunknown/  -> 405
  GET    /workflows/validate                -> 404          GET    /workflows/zzzunknown   -> 405
  GET    /workflows/grounding-bundle/       -> 404          GET    /workflows/zzzunknown/  -> 405
  PUT    /workflows/validate                -> 404          PUT    /workflows/zzzunknown   -> 405
  PATCH  /workflows/validate                -> 404          PATCH  /workflows/zzzunknown   -> 403 {"detail":"Not authenticated"}
  DELETE /workflows/grounding-bundle        -> 404          DELETE /workflows/zzzunknown   -> 403
```

One `PATCH` sweep over a wordlist enumerates the gated canvas paths exactly: every miss is 403, the
two hits are 404. That is a *crisper* oracle than the 422 round-2 CR-01 reported, and it is
method-agnostic rather than confined to the declared verb — so this is round-2 **WR-09 escalated
from "the tests are green for the wrong reason" into an exploitable enumeration**, caused by this
round's fix. REVERT-01 / D-181-02 / ROADMAP SC#3 ("byte-identical to a path that was never built")
is not met.

The suite cannot see it because every parity assertion compares against
`/workflows/__nope__/__nope__` — **two** segments, the one shape with no `{definition_id}` shadow,
which is why it genuinely 404s (`test_182_canvas_gate.py:44, 104`;
`test_revert_byte_identical.py:255`). Worse, `test_wrong_method_probe_404s_not_405`
(`test_182_canvas_gate.py:128-148`) *requires* the leaking answer: it asserts
`GET /workflows/validate == 404` and rejects 405 — the exact value an unbuilt path returns.

**Fix:** make the gate reproduce what the router would answer if the canvas routes had never been
declared, derived from the route table rather than hardcoded:

```python
# canvas_gate.py — compute once at startup from app.routes with the canvas paths removed:
#   _DECLARED_METHODS[path]  -> {"POST"} / {"GET"}
#   _UNBUILT_ANSWER[path][m] -> the (status, body) the surviving routes produce for that method
class CanvasGateMiddleware:
    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http":
            await self.app(scope, receive, send); return
        path = get_route_path(scope)                        # see WR-05 — root_path-safe
        if not _is_canvas_path(path) or not _read_canvas_is_off():
            await self.app(scope, receive, send); return
        if scope["method"] not in _DECLARED_METHODS[_normalize(path)]:
            await self.app(scope, receive, send); return    # 405/403/307 exactly as unbuilt
        status, body = _UNBUILT_ANSWER[_normalize(path)][scope["method"]]   # 405 here today
        await JSONResponse(body, status_code=status)(scope, receive, send)  # still pre-body-decode
```

and replace the two-segment baseline in both test files with a **same-shape, same-method** probe:

```python
for method in ("GET", "POST", "PUT", "PATCH", "DELETE"):
    gated   = client.request(method, _VALIDATE_PATH, content=b"{", headers=_JSON_CT)
    unbuilt = client.request(method, "/workflows/zzzunknown", content=b"{", headers=_JSON_CT)
    assert (gated.status_code, gated.content) == (unbuilt.status_code, unbuilt.content), method
```

That single loop fails on today's code for all five methods and is the honest gate.

If the operator prefers not to chase byte-identity across every method/slash permutation, the
alternative is to **narrow the REVERT-01 wording in the same commit** and record the residual as a
decision (the `182-DECISION-NOTES.md` precedent). What must not ship is the current state: an
unproven byte-identity claim *plus* a sharper enumeration oracle than the one it replaced.

---

### CR-02: **BLOCKER** — `GET /workflows/grounding-bundle` ignores `bundle.degraded` and serves an unreachable registry as "you have no folders and no skills" (HTTP 200)

**File:** `backend/app/api/workflows.py:670-697`; the contract it violates is written at
`backend/app/services/harness/grounding.py:120-132`

**Issue:** `GroundingBundle.degraded` is documented as "THE CONTRACT **BOTH CONSUMERS** RELY ON".
There are **three** consumers of `assemble_grounding_bundle`, and the third one — the palette route,
80 lines below the `/validate` handler that does branch correctly — never reads it:

```python
bundle = await grounding.assemble_grounding_bundle(...)     # :674
_null_foreign_global_owner(bundle.folders, str(user_id))    # :690
return GroundingBundleResponse(                             # :692
    tools=bundle.tools, folders=bundle.folders, skills=bundle.skills, ...
)
```

A folders or skills read failure (or a truncation — CR-03) therefore returns
`{"tools":[...], "folders":[], "skills":[], "template_placeholders":[]}` at **HTTP 200**, which is
byte-indistinguishable from a user who genuinely owns nothing. `GroundingBundleResponse` has no
field that could carry the degradation, so no client can tell either. This is exactly the defect
182-11 exists to close ("a vacuously-false membership test … reads as a specific, factual
accusation"), reproduced on the surface D-182-01 says Phase 184's node-config dropdowns bind to:
the author opens the folder picker mid-outage, sees an empty tree, and concludes their KB is gone.

**For the folders half this is a net-new regression.** Before this round
(`git show ed80de3b:backend/app/services/harness/grounding.py`) the call was
`folders = await fetch_visible_folders(supabase, user_id)` with no guard, so a PostgREST error
propagated and the palette 500'd — loud and honest. 182-11 wrapped it (`grounding.py:360-369`)
without giving this consumer the branch, converting a loud failure into a silent lie.

**Fix:** branch on the same signal the other two consumers use, and make the degradation part of
the response contract rather than an invisible absence:

```python
class GroundingBundleResponse(BaseModel):
    ...
    degraded: list[str] = Field(default_factory=list)   # additive; pre-184 clients ignore it

# get_grounding_bundle
bundle = await grounding.assemble_grounding_bundle(...)
if bundle.degraded:
    logger.warning("GET /workflows/grounding-bundle: registries %s unresolved — "
                   "returning a partial palette marked degraded", sorted(bundle.degraded))
return GroundingBundleResponse(..., degraded=sorted(bundle.degraded))
```

(Returning 503 is the other defensible posture; either way the caller must be able to distinguish
"empty" from "unknown".) Add the regression test mirroring
`test_validate_reports_grounding_unavailable_not_a_false_unregistered_skill`: a raising `skills`
table must not produce a 200 whose `skills: []` is indistinguishable from a healthy empty registry.

---

### CR-03: **BLOCKER** — `strict=True` converts a PostgREST `max-rows` truncation into a permanent, unrecoverable shutdown of the whole grounding seam (publish included) at the scale the code itself calls normal

**File:** `backend/app/utils/folder_utils.py:36-86`; opted into at
`backend/app/services/harness/grounding.py:347-369`; consumed at
`backend/app/services/harness/publish_service.py:637-647`

**Issue:** Round-2 WR-07 asked for the read to be **bounded** ("push the predicate down and bound
the read … at minimum add an explicit `.limit(N)` with a loud log"). Neither was done.
`fetch_all_folders` still issues an unbounded, unfiltered, cross-tenant `select("*")`
(`folder_utils.py:68`, `:71`) — no `user_id`/`org_id` predicate, no `.limit()`, no `.range()`
pagination. The only change is that a truncation is now **detected and made fatal**.

Follow the consequence at ≥ `max-rows` folders across all tenants — the exact threshold the new
docstring names as reachable ("1000 folders ACROSS ALL TENANTS is not a large deployment",
`folder_utils.py:24-26`):

1. `fetch_all_folders(strict=True)` raises `FolderReadTruncatedError` on **every** call;
2. `assemble_grounding_bundle` catches it → `folders = []`, `degraded = {"folders"}` — always;
3. `POST /workflows/validate` returns exactly one `grounding_unavailable` verdict, `ok: False`,
   forever, for every definition (`workflows.py:575-580`);
4. `GET /workflows/grounding-bundle` returns an empty palette at 200, silently (CR-02);
5. **publish stage 2.6 blocks every publish** at `blocked_stage="grounding_fidelity"` with
   `grounding_unavailable` (`publish_service.py:640-647`). `POST /workflows/{id}/publish` is live
   today behind `require_visible("workflow_authoring")` (audience `everyone`), independent of the
   canvas flag — so no workflow can ever be published again;
6. NL generation silently emits folder-blind drafts (WR-03).

There is no pagination, no operator switch, no partial-result path and no remediation other than
deleting folders. The polarity is fail-*closed*, which is right for a single blip — but this is not
a blip: it is a permanent state that arrives at a fixed, low, deployment-wide row count and takes
the phase's own hard gate down with it.

**Fix:** bound the read so truncation cannot occur, and keep `strict` as a last-resort assertion
rather than the mechanism:

```python
# folder_utils.fetch_all_folders — page instead of truncating
async def fetch_all_folders(supabase, fields=..., *, strict=False, page=1000):
    rows, start = [], 0
    while True:
        resp = await aexec(supabase.table("folders").select(fields).range(start, start + page - 1))
        batch = resp.data or []
        rows.extend(batch)
        if len(batch) < page:
            return rows
        start += page
```

Better still — and what WR-07 actually asked for — push the owner+org predicate down in
`fetch_visible_folders` so the read is proportional to the caller, not to the deployment:

```python
org_ids = await _resolve_caller_org_ids(supabase, user_id)
q = supabase.table("folders").select(fields)
q = q.or_(f"user_id.eq.{coerce_uid(user_id)}," +
          (f"and(is_org_shared.eq.true,org_id.in.({','.join(sorted(org_ids))}))"
           if org_ids else "id.is.null"))
```

Keep `FolderReadTruncatedError` as the belt-and-braces assertion after paging (it should then be
unreachable). Add a test at the real threshold: a fake returning 1000 rows with `count=5000` must
still yield a usable palette and a publishable definition.

---

## Warnings

### WR-01: **WARNING** — the truncation guard covers exactly ONE call site, not the "two grounding GATE call sites" its docstring claims, leaving the run-start ⊆ callers to answer a truncation with a false HTTP 400

**File:** `backend/app/utils/folder_utils.py:49-56`; the single opt-in at
`backend/app/services/harness/grounding.py:361`; unprotected victims at
`backend/app/services/workflow_kickoff.py:245-253`, `backend/app/api/runs.py:946`,
`backend/app/services/harness_engine.py:1588`

**Issue:** `fetch_all_folders`' new docstring says "Only the two grounding GATE call sites — the
ones that turn this read into a verdict about the author's definition — opt in." A repo-wide grep
finds exactly **one** `strict=True` in `app/`. Meanwhile the error class' own docstring
(`folder_utils.py:19-22`) names `assert_folder_scopes_subset` as the primary victim — and all three
of that function's run-start callers reach `resolve_project_subtree` →
`fetch_visible_folders(supabase, user_id)` with `strict` defaulted to `False` (`scope.py:138`).
`workflow_kickoff` maps the resulting `ValueError` to a hard **HTTP 400** refusing to start the run:

```python
except ValueError as _scope_err:
    raise HTTPException(status_code=400, detail=str(_scope_err))   # workflow_kickoff.py:249-253
```

So under truncation the author is told "phase 'X' folder_scope is not a subset of the project
subtree" and their run is refused — the identical false accusation, on a path the fix did not
touch, with a worse outcome than the advisory verdict it did fix. `scope.resolve_run_scope_root`
(`scope.py:226`) has the same exposure: a truncated read silently *drops* a legitimate per-run
folder override.

**Fix:** correct the docstring to say "one call site", and either (a) thread `strict` through
`resolve_project_subtree` / `folder_scope_violations` so the run-start callers can opt in and map
`FolderReadTruncatedError` to a 503 rather than a 400, or (b) fix the read itself (CR-03), which
makes the opt-in moot everywhere at once. (b) is strictly better.

---

### WR-02: **WARNING** — the WR-05 org gate never checks `project_folder_id`, so the exact run-time failure it was built to prevent still publishes clean

**File:** `backend/app/services/harness/scope.py:124-156` (`resolve_project_subtree`), consumed at
`scope.py:314-319` and `publish_service.py:648-655`

**Issue:** `resolve_project_subtree` unconditionally seeds its walk with the root, regardless of
whether the root is in the caller's (now org-restricted) visible set:

```python
root = str(project_folder_id)
folders = await fetch_visible_folders(supabase, user_id, **_org_kw)
def _walk(rid, seen=None):
    ...
    out = [rid]                       # the root is ALWAYS included, visible or not
```

Trace the org-A/org-B fixture the new suite already builds
(`test_182_publish_org_scope.py:168-202`) with `project_folder_id = _FOLDER_B` (the org-B-shared
child) instead of `_PROJECT_A`:

- restricted `fetch_visible_folders` returns `{_PROJECT_A, _CHILD_A}` — `_FOLDER_B` is excluded;
- `_walk("_FOLDER_B")` returns `["_FOLDER_B"]`, so `allowed == {_FOLDER_B}`;
- phases with no `folder_scope` are unchecked, and a phase scoped to `_FOLDER_B` is a subset;
- stage 2.6 returns `[]` → **the definition publishes**.

At run time an org-A colleague's kickoff resolves the same subtree from *their* view, gets
`["_FOLDER_B"]`, and every phase retrieves from a folder they cannot read — zero documents,
silently. That is verbatim the failure mode `publish_service.py:609-616` says the fix prevents
("a workflow that cleared the hard gate and silently under-performs for everyone but its author").
The restriction closed the two secondary bindings (`skill_ref`, per-phase `folder_scope`) and left
the primary one open. The suite does not catch it because both `_bound_payload` cases bind to
`_PROJECT_A`.

**Fix:** validate the binding itself, in the one place the restricted tree is already resolved:

```python
# scope.folder_scope_violations, right after the subtree resolves
if restrict_org_ids is not None and definition.project_folder_id is not None:
    visible = {f["id"] for f in await fetch_visible_folders(
        supabase, user_id, restrict_org_ids=restrict_org_ids)}
    if str(definition.project_folder_id) not in visible:
        violations.append(FolderScopeSubsetError(
            f"the workflow's project_folder_id {definition.project_folder_id} is not "
            "reachable from the definition's own organization", phase_slug=None))
```

Add the mirror test: `_bound_payload(project=_FOLDER_B)` with no per-phase scope must block at
`grounding_fidelity`.

---

### WR-03: **WARNING** — NL generation's behaviour DID change, and the docstring asserting it did not is the reason nobody checked

**File:** `backend/app/services/harness/grounding.py:312-318`;
`backend/app/services/workflow_authoring.py:175-184` and `:276-283`

**Issue:** `assemble_grounding_bundle`'s new docstring states: *"NL generation
(`workflow_authoring`) is the third consumer and deliberately ignores `degraded`: its own fidelity
check re-reads the folder tree through the ⊆ walk, **so its behaviour is unchanged by this
guard**."* Both halves are false.

`workflow_authoring._assemble_grounding` calls `assemble_grounding_bundle` with no
`restrict_org_ids`, so it takes the *unconditional* `strict=True` folders read at `grounding.py:361`
and the new blanket `except Exception`. Before this round the same call was
`fetch_visible_folders(supabase, user_id)` with **no guard at all**, and
`generate_workflow_definition` has no `try` around it (`workflow_authoring.py:276-283`), so a
folders read failure propagated and surfaced. Now:

- a read failure or truncation → `folders = []` → `render_grounding_prompt` emits
  `"(no folders)"` (`grounding.py:226`);
- the model is grounded on an empty KB tree and emits a workflow that binds no folder;
- `_check_grounding_fidelity`'s ⊆ walk is a **no-op for an unbound definition**
  (`scope.py:124-125`: `project_folder_id is None → return None → []`), so it cannot "re-read the
  folder tree" as claimed;
- the caller receives `{"ok": True, "definition": …}` — a folder-blind draft presented as a
  successful generation.

Under CR-03's truncation this is not an edge case: *every* NL generation silently produces
folder-blind drafts.

**Fix:** either have NL generation honour the signal, or stop claiming it is unaffected:

```python
# workflow_authoring — return the bundle (or bundle.degraded) from _assemble_grounding, then:
if degraded:
    return {"ok": False, "error": "grounding_unavailable",
            "detail": f"the grounding registry could not be resolved "
                      f"({', '.join(sorted(degraded))}) — not generating an ungrounded draft"}
```

At minimum, correct the docstring — an inaccurate "unchanged" claim on a shared seam is what stops
the next reader from checking.

---

### WR-04: **WARNING** — `CANVAS_GATED_PATHS` is a hand-maintained duplicate of the route table with no drift guard, in a phase that ships drift scanners for everything else

**File:** `backend/app/middleware/canvas_gate.py:56-66`

**Issue:** Both halves of the off-switch (the request gate and the schema filter) read one
hardcoded frozenset, kept in sync with the router by a comment ("add its absolute path HERE in the
SAME commit that mounts it"). Nothing enforces it. A Phase-183+ route that carries
`dependencies=[Depends(require_canvas())]` but is not added to the constant silently:

* 422s on a malformed body, 405s on a wrong method and 307s on a trailing slash while off, and
* is published in `/openapi.json` with all its models while off

— i.e. both round-2 criticals reopen for the new route, with a green suite. This is the same class
of defect `test_182_severity_codes.py` was written to prevent for verdict codes, on a strictly more
security-relevant vocabulary, and it is mechanically checkable.

**Fix:** derive the expectation from the route table:

```python
def test_every_require_canvas_route_is_in_canvas_gated_paths():
    from app.main import app
    from app.middleware.canvas_gate import CANVAS_GATED_PATHS
    gated = {
        r.path for r in app.routes
        if any(getattr(d.call, "__qualname__", "").startswith("require_canvas")
               for d in getattr(getattr(r, "dependant", None), "dependencies", []))
    }
    assert gated <= set(CANVAS_GATED_PATHS), (
        f"{sorted(gated - set(CANVAS_GATED_PATHS))} carry require_canvas but are not gated by "
        "CanvasGateMiddleware / filtered out of /openapi.json while off"
    )
```

---

### WR-05: **WARNING** — the middleware matches the raw ASGI `scope["path"]`, so the whole pre-routing gate is bypassed under a `root_path` / sub-path mount

**File:** `backend/app/middleware/canvas_gate.py:119`

**Issue:** `path = scope.get("path", "")` is the raw request path *including* any `root_path`.
Starlette routes on `get_route_path(scope)`, which strips `root_path`. Behind an ingress or an
`--root-path /api` deploy, `scope["path"]` is `/api/workflows/validate`, `_is_canvas_path` returns
False, and the request reaches the router — restoring the 422 / 405 / 307 leaks the middleware
exists to close. `Depends(require_canvas())` still 404s the *declared* method (defence in depth
held), but the body-decode and wrong-method channels — the entire reason this module exists — are
open again. `docs/DEPLOYMENT-PIPELINE.md` puts the backend behind Coolify, so this is one
configuration flip away.

**Fix:**

```python
from starlette.routing import get_route_path
...
path = get_route_path(scope)     # root_path-stripped, exactly what the router will match on
```

and add a probe that sets `root_path` in the scope to prove it.

---

### WR-06: **WARNING** — a new whole-file substring scan over the 1178-line workflows router (a fresh instance of the pattern round-2 WR-10 flagged, not a fix of it)

**File:** `backend/tests/unit/test_182_publish_org_scope.py:734-751`

**Issue:**

```python
source = Path(wf.__file__).read_text(encoding="utf-8")
assert "restrict_org_ids" not in source, (
    "the /validate seam grew an org restriction — …")
```

`app/api/workflows.py` is the whole workflows router: pickers, draft CRUD, publish, the destructive
cascade, NL generation, and the validation seam. Any future route in that file that legitimately
org-scopes a read fails this test with a message about `/validate`. It is simultaneously
over-broad and trivially evaded (the name via a constant, a `**kwargs` splat, or a helper).
`test_182_folder_scope_keying.py:611-636` scans the same file for six other tokens, so the router
now carries two whole-file source guards from two different plans. Round-2 WR-10 named this exact
anti-pattern; this round added a new instance rather than closing it.

**Fix:** scope the guard to the two functions that own the decision:

```python
import inspect
from app.api import workflows as wf
src = inspect.getsource(wf.validate_workflow) + inspect.getsource(wf.get_grounding_bundle)
assert "restrict_org_ids" not in src
```

---

### WR-07: **WARNING** — ~14 unreachable assertions added across the new gate/auth suites, and one of them pins the CR-01 leak as the required behaviour

**File:** `backend/tests/test_182_canvas_gate.py:110-114, 144-147, 166-168, 201`;
`backend/tests/unit/test_182_canvas_auth.py:329-333, 368`;
`backend/tests/test_revert_byte_identical.py:142-143, 197, 201, 238-239, 245-246, 250`

**Issue:** The recurring shape is

```python
assert resp.status_code == 404, ...
assert resp.status_code != 422, "CR-01 regression …"     # cannot fail: 404 != 422 already proven
```

repeated for `!= 405`, `not in (307, 422)`, `not in (200, 401, 403, 422)`, `!= 500`, `!= 403`,
`!= 401`, `not in (200, 401, 403, 422, 500)`. Every one is dominated by the equality assertion on
the line above. Round-2 IN-04 called out exactly two of these; this round added roughly fourteen
more, each carrying a long explanatory message that reads like coverage and provides none.
`test_182_canvas_auth.py:329-333` is the clearest: four assertions, three unreachable.

Worse than noise: `test_wrong_method_probe_404s_not_405` (`test_182_canvas_gate.py:128-148`) turns
the dead assertion into a *specification* — it demands 404 and forbids 405 on
`GET /workflows/validate`, which is precisely the divergence from the unbuilt baseline documented
in CR-01. The suite now defends the leak.

**Fix:** delete the dominated assertions and move their prose into the surviving equality
assertion's message. Replace the wrong-method test with the same-shape/same-method parity loop from
CR-01, which fails today and is what the property actually is.

---

### WR-08: **WARNING** — the "fails LOUDLY" contract for the conditionally-forwarded `restrict_org_ids` keyword is silently defeated on the publish path by 182-11's seal

**File:** `backend/app/services/harness/scope.py:127-137` (the contract);
`backend/app/services/harness/grounding.py:359-369` (where it is swallowed)

**Issue:** 182-12 wrote the seam-contract rule for the `_org_kw` idiom explicitly:

> "A RESTRICTED call still passes it explicitly, so a double that cannot accept it fails **LOUDLY**
> rather than silently ignoring a tenancy narrowing." (`scope.py:135-136`)

That holds for the three call sites inside `scope.py` and for
`grounding._folder_scope_violations`. It does **not** hold for the one that matters most, because
182-11 (which landed first and could not see it) wrapped the identical forwarding call in a blanket
`except Exception`:

```python
_org_kw = {} if restrict_org_ids is None else {"restrict_org_ids": restrict_org_ids}
try:
    folders = await fetch_visible_folders(supabase, user_id, strict=True, **_org_kw)
except Exception:                       # swallows TypeError from a signature drift
    folders = []; degraded.add("folders")
```

A future monkeypatch, adapter or refactor whose `fetch_visible_folders` cannot accept
`restrict_org_ids` therefore produces `TypeError` → `degraded={"folders"}` → publish blocks with
`grounding_unavailable`. The tenancy narrowing is dropped, the operator sees "the grounding registry
could not be resolved", and the real cause survives only in an `exc_info` log line. The same
`except Exception` converts a `RecursionError` from WR-09, and any genuine programming error in the
visibility walk, into that same message.

**Fix:** let programming errors through; catch only what the finding is about:

```python
except (FolderReadTruncatedError, APIError, OSError, asyncio.TimeoutError):
    folders = []; degraded.add("folders")
```

or, if the broad catch must stay for the always-200 contract, re-raise the classes that mean "the
code is wrong" (`TypeError`, `AttributeError`, `NameError`) before degrading, and record the
decision next to the `scope.py:127-137` contract so the two halves stop disagreeing.

---

### WR-09: **WARNING** — `is_in_global_subtree` still has no cycle guard, and `folder_utils.py` was hardened this round without adding the one its sibling walk already has

**File:** `backend/app/utils/folder_utils.py:115-146`; contrast
`backend/app/services/harness/scope.py:140-154`

**Issue:** The recursion memoizes *after* recursing, so the cache cannot break a cycle:

```python
if folder_id in cache: return cache[folder_id]
f = folder_map.get(folder_id)
...
result = is_in_global_subtree(parent_id, folder_map, cache, caller_org_ids) if parent_id else False
cache[folder_id] = result     # written only AFTER the recursive call returns
```

A self-parented row (`parent_id == id`) or any cyclic folder hierarchy recurses unbounded →
`RecursionError`. `scope.resolve_project_subtree._walk` carries an explicit `seen` set for exactly
this reason, with an IN-01 comment saying "this shared helper is the right place to harden against
bad data" — and `folder_utils` *is* the shared helper. Every `/folders` route
(`folders.py:17, 30, 45, 218`), the chat agent loop (`agent_loop.py:1209`) and the document-view
resolver reach it; on those paths the result is a 500. On the grounding path it is now silently
absorbed as `degraded={"folders"}` (WR-08), which makes the corruption harder to find, not easier.

**Fix:** mirror `_walk`'s guard:

```python
def is_in_global_subtree(folder_id, folder_map, cache=None, caller_org_ids=None, _seen=None):
    ...
    _seen = _seen if _seen is not None else set()
    if folder_id in _seen:
        cache[folder_id] = False
        return False
    _seen.add(folder_id)
```

---

_Reviewed: 2026-07-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard (round 3 — gap-closure plans 182-08 … 182-12, diff base `ed80de3b`)_
