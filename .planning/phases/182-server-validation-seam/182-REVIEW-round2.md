---
phase: 182-server-validation-seam
reviewed: 2026-07-25T00:00:00Z
depth: standard
round: 2
files_reviewed: 18
files_reviewed_list:
  - backend/app/api/workflows.py
  - backend/app/main.py
  - backend/app/services/harness/grounding.py
  - backend/app/services/harness/publish_service.py
  - backend/app/services/harness/reachability.py
  - backend/app/services/harness/scope.py
  - backend/app/services/workflow_authoring.py
  - backend/tests/test_181_flip_on.py
  - backend/tests/test_182_extraction_parity.py
  - backend/tests/test_182_grounding_bundle.py
  - backend/tests/test_revert_byte_identical.py
  - backend/tests/unit/test_103_nl_generate.py
  - backend/tests/unit/test_182_folder_scope_keying.py
  - backend/tests/unit/test_182_publish_grounding_stage.py
  - backend/tests/unit/test_182_severity_codes.py
  - backend/tests/unit/test_182_validate.py
  - backend/tests/unit/test_publish_service.py
findings:
  critical: 2
  warning: 10
  info: 7
  total: 19
status: issues_found
---

# Phase 182: Code Review Report (round 2 — full final state, plans 182-01..07)

**Reviewed:** 2026-07-25
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Second adversarial pass, covering the full phase including the four gap-closure plans
(182-04..07). All 86 tests across the phase's 10 test files pass at HEAD (`2f511f44`).

**What the gap closure genuinely fixed.** I verified each claim against the source rather
than the summaries:

- **182-04 (SC#4)** — `scope.FolderScopeSubsetError` is a real `ValueError` subclass with a
  byte-identical `str(exc)` / `args`, and `grounding._folder_scope_violation` reads
  `phase_slug` off the attribute (`getattr(..., None)`), never the prose. The end-to-end test
  drives the *real* ⊆ walk, so it is not a mock echoing itself.
- **182-06 (WR-01)** — publish stage 2.6 calls the SAME `grounding_verdicts` collector
  `/validate` calls, blocks before the golden run, and fails closed with
  `grounding_unavailable`. The validate-vs-publish agreement test compares two independently
  produced `(code, phase)` sets. This is a real fix to a real, exploitable gap.
- **182-07 (WR-05)** — `_KNOWN_CODES` really is composed from `reachability.LINT_CODES |
  grounding.GROUNDING_VERDICT_CODES | _ROUTE_ASSIGNED_CODES`, `_ERROR_CODES` is derived, the
  unknown branch returns `error` + logs, and the drift scanners carry a teeth self-test.
- **Round-1 CR-01** — the un-org-gated skill predicate is gone. `app/utils/skill_visibility.py`
  is the single home and `tool_dispatcher.py:1176` uses the same function, so query and
  post-filter cannot diverge. I re-walked the org gate on every read
  (`fetch_visible_folders`, `_skill_registry`, `_resolve_caller_org_ids`) and found no
  remaining cross-org path through the grounding registry.

**What did not get closed, and was never triaged.** The two round-1 criticals about the
off-switch — CR-03 (malformed-JSON 422 before the flag gate) and CR-04 (`/openapi.json`
advertising both routes anonymously) — appear in *no* plan, *no* seed, and *no* decision
note. A grep across the whole phase directory returns hits only inside the two review files
themselves. WR-03/04/07 were seeded (SEED-130/131/132) and WR-08 was formally rejected with a
recorded rationale; these two were simply skipped. **I re-proved both empirically against the
real app at HEAD with the flag off and no credentials:**

```
POST /workflows/validate  valid json      -> 404 {"detail":"Not Found"}
POST /workflows/validate  MALFORMED json  -> 422 {"detail":[{"type":"json_invalid",...}]}
POST /workflows/__nope__  (never built)   -> 405 {"detail":"Method Not Allowed"}
GET  /openapi.json (anonymous, flag off)  -> 200   advertises both routes + all 5 schemas
GET  /docs                                -> 200
```

Both defeat REVERT-01 / D-181-01 — operator HARD gate #1 — which is the very gate 182-03
retired the canary in favour of.

**Two findings the gap closure created or sharpened**, both about *which* failure the author
is shown:

1. `grounding._skill_registry`'s fail-closed `return []` (grounding.py:148-158) sits INSIDE
   `assemble_grounding_bundle`, so the stage-2.6 wrapper never sees it. A transient skills
   read failure therefore blocks publish with a **false `unregistered_skill`** naming the
   author's `skill_ref`, not the honest `grounding_unavailable` the stage exists to emit.
2. `/validate` is still unsealed while publish is now sealed, so the two sides of the "one
   shared copy" claim have *opposite* postures on the same failure. Proven: a PostgREST
   `APIError` from either the palette read or the ⊆ walk escapes `validate_workflow` as an
   unhandled exception (HTTP 500), while the identical failure on the publish side returns a
   structured block.

**On the 182-05 open question** (does `_folder_scope_violation`'s bare `except ValueError`
render an infrastructure error as a normal-looking `folder_scope` verdict?) — **partially
refuted, partially confirmed and escalated.** See WR-03.

### Round-1 finding dispositions

| Round-1 | Status at HEAD (`2f511f44`) |
|---|---|
| CR-01 skills read has no org predicate | **RESOLVED** — `0559e64b`, `app/utils/skill_visibility.py`, shared with `tool_dispatcher` |
| CR-02 palette serializes raw DB rows | **RESOLVED** — `PaletteFolder` / `PaletteSkill` + `_null_foreign_global_owner` |
| CR-03 malformed body 422 pre-flag | **STILL LIVE, never triaged** → this review's **CR-01** |
| CR-04 openapi / docs advertise the routes | **STILL LIVE, never triaged** → this review's **CR-02** |
| WR-01 publish does not enforce grounding | **RESOLVED** — 182-06 stage 2.6 |
| WR-02 unbuilt-route parity baseline (404 vs 405) | **STILL LIVE** → WR-09 |
| WR-03 `template_placeholders` dead path | STILL LIVE, deferred as SEED-130 → WR-06 adds the security note the seed omits |
| WR-04 `/validate` not sealed | STILL LIVE, deferred as SEED-131 → WR-02 (escalated by 182-06) |
| WR-05 severity fails open / hardcoded literals | **RESOLVED** — 182-07 |
| WR-06 `folder_scope` slug stranded in prose | **PARTIALLY RESOLVED** — 182-04 keys it; the multiplicity gap remains → WR-04 |
| WR-07 `@model_validator` 422s bypass the envelope | STILL LIVE, deferred as SEED-132 — not re-reported |
| WR-08 `require_canvas` alone drops the authoring audience | **REJECTED** with recorded rationale (`182-DECISION-NOTES.md`) — not re-reported |
| WR-09 `_skill_registry` duplicate retry + missing `coerce_uid` | **RESOLVED** |
| IN-01..IN-06 | all six still live — see Info |

## Critical Issues

### CR-01: `POST /workflows/validate` still leaks its own existence pre-auth — one malformed byte returns 422 where an unbuilt route returns 405

**File:** `backend/app/api/workflows.py:469-480`; vacuous guard at
`backend/tests/test_revert_byte_identical.py:128-133`

**Issue:** FastAPI decodes the request body in `get_request_handler` **before**
`solve_dependencies` runs, so a `json.JSONDecodeError` becomes a `RequestValidationError`
(422) without `require_canvas` ever executing. Route-level `dependencies=[...]` are inserted
at the front of `dependant.dependencies`, which is why a *valid* body correctly 404s — but
that ordering only governs the dependency phase, not the body decode that precedes it.

Re-verified against the real app at HEAD with `feature_visibility={}` and no `Authorization`
header (transcript in the Summary): valid JSON → 404, malformed JSON → **422**, never-built
sibling path → **405**. `POST /workflows/__nope__` returns 405 *even with the same malformed
byte*, so the two are cleanly distinguishable. An anonymous scanner therefore learns that a
POST handler is declared at exactly `/workflows/validate` while the canvas is off — the same
class of pre-auth existence leak Phase 181's own review caught (`dependencies.py:558-566`
documents the fix for the 403/401 variant), reappearing on the route that replaced the canary.

The assertion meant to cover this cannot fail. `test_revert_byte_identical.py:128` validates
`_MINIMAL_VALID_DEFINITION` against the real model on the line above, so
`assert resp_validate.status_code != 422` (`:132`, commented "the gate fired BEFORE body
validation") is tautological — it asserts that a valid body is not a shape error.

**Fix:** decide the flag *before* body parsing, and make the test probe the hostile input.

```python
# app/middleware/canvas_gate.py — pure ASGI, mirrors MaintenanceMiddleware's posture
_CANVAS_PATHS = frozenset({"/workflows/validate", "/workflows/grounding-bundle"})

class CanvasGateMiddleware:
    def __init__(self, app): self.app = app
    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and scope["path"] in _CANVAS_PATHS:
            from app.models.user_settings import feature_audience
            if feature_audience("visual_workflow_canvas") == "off":
                await JSONResponse({"detail": "Not Found"}, status_code=404)(scope, receive, send)
                return
        await self.app(scope, receive, send)
```

Keep `Depends(require_canvas())` on both routes (defense in depth — it still owns the
role/everyone resolution), and replace the tautology with a falsifiable probe:

```python
bad = client.post(_VALIDATE_PATH, content=b"{", headers={"content-type": "application/json"})
assert bad.status_code == 404, bad.text   # fails on today's code (422)
```

If the operator instead accepts the residual, record it as a decision in the same commit and
narrow the REVERT-01 wording — silently claiming an unproven property is worse than an
audited exception, which is exactly what `182-DECISION-NOTES.md` did for WR-08.

---

### CR-02: with the canvas off, anonymous `GET /openapi.json` and `/docs` publish both canvas routes and all five of their schemas

**File:** `backend/app/main.py:592`; routes at
`backend/app/api/workflows.py:469-473, 569-573`

**Issue:** `app = FastAPI(title=..., version=..., lifespan=lifespan)` sets no
`openapi_url=None` / `docs_url=None`, and neither route carries `include_in_schema=False`, so
the schema is public and completely static with respect to the flag. Re-verified at HEAD with
no credentials and `feature_visibility={}`:

```
GET /openapi.json -> 200
   advertises /workflows/validate: True
   advertises /workflows/grounding-bundle: True
   schemas published: ValidateResponse, Verdict, GroundingBundleResponse, PaletteFolder, PaletteSkill
GET /docs -> 200
```

`SetupMiddleware` only gates a pre-finalize box, so on any finalized deploy (including the
live `superrag.cloud` one) this is open to the internet. This is a strictly *louder* existence
leak than CR-01's status-code nuance: it publishes the paths, the methods, the `severity`
literals and the full palette shape.

It also directly falsifies the acceptance gate the phase repointed onto these routes.
`test_revert_byte_identical.py:8-16` claims the off state has "the same **reachable-route
set** … every canvas-gated route is a 404, byte-identical to a path that was never built."
The routes are *published* regardless of the flag, and no test asserts otherwise.

**Fix:** minimal, and it leaves the 404 behaviour untouched:

```python
# workflows.py — both canvas routes
@router.post("/validate", response_model=ValidateResponse, include_in_schema=False,
             dependencies=[Depends(require_canvas())])
```

Better (keeps `/docs` useful once the canvas is on): a custom `app.openapi()` hook that drops
`_CANVAS_PATHS` and their schemas when `feature_audience("visual_workflow_canvas") == "off"`.
Either way, add the missing gate assertion so the property is enforced rather than asserted in
prose:

```python
def test_openapi_does_not_advertise_canvas_routes_when_off(client, monkeypatch):
    _cold_off(monkeypatch)
    paths = client.get("/openapi.json").json()["paths"]
    assert _BUNDLE_PATH not in paths and _VALIDATE_PATH not in paths
```

## Warnings

### WR-01: a transient skills-read failure blocks publish with a FALSE `unregistered_skill` naming the author's `skill_ref`, not the honest `grounding_unavailable`

**File:** `backend/app/services/harness/grounding.py:148-158, 290-291`;
`backend/app/services/harness/publish_service.py:525-589`

**Issue:** `_grounding_fidelity_failures`' docstring says it "FAILS CLOSED … the same
fail-closed posture `grounding._skill_registry` already takes on its own read (CR-01)". The
two are not the same, and the difference is the whole point of the stage.

`_skill_registry`'s fail-closed exit is *inside* `assemble_grounding_bundle`:

```python
except Exception:  # grounding.py:148-158
    logger.warning("grounding: org-gated skills read failed; using empty skill set", exc_info=True)
    return []
```

A PostgREST 5xx / timeout / connection reset on the skills read therefore produces
`skills = []` → `skill_ids = set()` → the bundle is returned *successfully*. The stage-2.6
`try` never sees an exception, so `_grounding_fidelity_failures` returns the collector's list
unchanged — and `_unregistered_skill_ref` (grounding.py:421-427) reports **every** `skill_ref`
as unregistered. Result:

- publish returns `blocked_stage="grounding_fidelity"` with
  `{"code": "unregistered_skill", "phase": "<slug>", "message": "phase '<slug>' references a
  non-registered skill_ref '<uuid>'"}` — a factual accusation against a correct definition;
- `/validate` paints that node red with the same message, so the author is actively directed
  to "fix" a valid reference.

The honest answer already exists three lines away (`grounding_unavailable`, "we could not
CHECK"). Note the three reads inside one bundle have three *different* postures today: folders
raise (WR-02), tools are in-process, skills degrade silently to `[]`. That asymmetry was
tolerable while the palette fed only an advisory surface; 182-06 made it gate a state
transition.

**Fix:** let the read failure reach the caller that knows how to describe it — either
propagate and let stage 2.6's wrapper mint `grounding_unavailable`, or carry the degradation
on the bundle so both consumers can branch on it:

```python
@dataclass
class GroundingBundle:
    ...
    degraded: frozenset[str] = frozenset()   # e.g. {"skills"} / {"folders"}

# _skill_registry's caller (assemble_grounding_bundle)
try:
    skills = await run_in_threadpool(_skill_registry, supabase, user_id, caller_org_ids)
except Exception:
    logger.warning(...); skills, degraded = [], degraded | {"skills"}

# publish_service._grounding_fidelity_failures
if bundle.degraded:
    return [{"code": "grounding_unavailable", "phase": None,
             "message": f"grounding could not be verified ({', '.join(sorted(bundle.degraded))})"}]
```

Add a regression test: `_skill_registry` raising must produce `grounding_unavailable`, never
`unregistered_skill`.

---

### WR-02: `/validate` is still not sealed — a real PostgREST error escapes as HTTP 500, while the *same collector* on the publish side returns a structured block

**File:** `backend/app/api/workflows.py:496-531`;
`backend/app/services/harness/publish_service.py:562-589`

**Issue:** the handler docstring promises "ALWAYS HTTP 200 with the machine-renderable
envelope: a dirty definition is not an HTTP error, it is advice." Nothing enforces it. Proven
at HEAD by driving the real handler with a genuine `postgrest.exceptions.APIError`:

```
(1) palette APIError  -> ESCAPES the handler as APIError => FastAPI 500
(2) subset APIError   -> ESCAPES as APIError            => FastAPI 500
```

Path (1) is `assemble_grounding_bundle` → `fetch_visible_folders` → `aexec` (folder_utils has
no try/except); path (2) is `grounding_verdicts` → `_folder_scope_violation` →
`assert_folder_scopes_subset`, whose `except ValueError` does not catch `APIError`
(`issubclass(APIError, ValueError)` is `False` — verified).

This was known and deferred as SEED-131, but **182-06 changed the calculus and the seed
predates it**: the phase built exactly the fail-closed wrapper this route needs, applied it to
publish only, and then documented the two sides as "the SAME copy" in the seam header
(`workflows.py:237-257`). They are the same *rules* with opposite *failure postures*, and the
route that fires on every canvas keystroke is the unsealed one.

**Fix:** wrap the two I/O stages and degrade honestly. Prefer an explicit
`grounding_unavailable` finding over an empty palette, which would report false
`unregistered_*` verdicts (WR-01):

```python
try:
    bundle = await grounding.assemble_grounding_bundle(supabase=supabase, user_id=str(user_id))
    fidelity = await grounding.grounding_verdicts(body, supabase=supabase, user_id=str(user_id),
                                                  tool_names=bundle.tool_names,
                                                  skill_ids=bundle.skill_ids)
except Exception:
    logger.warning("validate: grounding could not be resolved; structural-only verdicts",
                   exc_info=True)
    fidelity = [{"code": "grounding_unavailable", "phase": None,
                 "message": "grounding could not be checked right now"}]
```

and compose `grounding_unavailable` into `_KNOWN_CODES` (as `workflows.py:383-390` already
anticipates) so it classifies deliberately rather than through the fail-loud branch. Update
SEED-131 to record that the wrapper now exists on the publish side.

---

### WR-03: the bare `except ValueError` under the ⊆ walk swallows `pydantic.ValidationError` and renders it as a red `folder_scope` verdict — 182-05's hypothesis, half refuted and half escalated

**File:** `backend/app/services/harness/grounding.py:394-407`

**Issue — the refutation.** The 182-05 concern was that "an infrastructure error beneath the ⊆
walk could render as a normal-looking `folder_scope` verdict." For the errors that actually
occur today that is **false**: `postgrest` 2.29.0 converts every non-2xx response, every
malformed error body and every internal `ValidationError` into `APIError(Exception)`
(`_sync/request_builder.py:79-86`, `base_request_builder.py:255-261`), which is **not** a
`ValueError`. A DB blip therefore escapes as a 500 instead (WR-02) — the opposite failure.

**Issue — the escalation.** The catch is still unsafe, because **`pydantic.ValidationError` IS
a `ValueError` subclass in Pydantic v2** (verified: `issubclass(pydantic.ValidationError,
ValueError) == True`). Driving the real handler with a `ValidationError` raised under
`assert_folder_scopes_subset` produces:

```
verdicts: [('folder_scope', None, 'error')]
message shown to the author: "1 validation error for _M\nx\n  Input should be a valid integer, ..."
```

i.e. an unrelated internal failure is presented as "your phase's `folder_scope` is not a subset
of the project subtree", at `severity: error`. Post-182-06 the same misclassification **blocks
publish** at `blocked_stage="grounding_fidelity"` with that bogus named failure — and, exactly
as in WR-01, the stage-2.6 wrapper never sees it, so the honest `grounding_unavailable` is
bypassed. This is not theoretical: the ⊆ path is one `UUID(...)` coercion or one validated
model away from firing it, and Phase 185's graded-governance work is scheduled to extend this
exact walk.

**Fix:** narrow the catch to the type the rule owns and let anything else reach the caller that
can describe it. The Phase-103 test doubles that raise a plain `ValueError` are the only reason
the catch is broad — pin their contract instead of widening production code:

```python
from app.services.harness.scope import FolderScopeSubsetError

try:
    await assert_folder_scopes_subset(wd, supabase=supabase, user_id=user_id)
except FolderScopeSubsetError as exc:
    return str(exc), exc.phase_slug
# anything else propagates -> the caller's fail-closed wrapper mints grounding_unavailable
```

and update `test_182_folder_scope_keying.py::test_plain_value_error_degrades_to_an_unkeyed_verdict`
to assert the new contract (a non-`FolderScopeSubsetError` is a *read* failure, not a rule
finding). If the broad catch must stay, at minimum exclude `pydantic.ValidationError`
explicitly and never let a non-typed error reuse the `folder_scope` code.

---

### WR-04: only the FIRST non-⊆ phase ever produces a `folder_scope` verdict — the collector's "every violation" contract is still not met

**File:** `backend/app/services/harness/scope.py:258-270`;
`backend/app/services/harness/grounding.py:433-460`

**Issue:** 182-04 fixed the *keying* but not the *multiplicity*. `assert_folder_scopes_subset`
`raise`s inside its `for phase in definition.phases` loop on the first offending phase, so
`grounding_verdicts` — whose docstring says it "COLLECTS every violation … the canvas needs all
of them at once" — emits at most one `folder_scope` verdict per definition, no matter how many
phases are out of subtree. The author fixes node A, re-validates, and node B lights up: the
whack-a-mole loop the per-node collector exists to eliminate.

The gap closure also made the documentation overstate the fix. `grounding.py:23-26` now claims
"ALL THREE fidelity rules key to a phase slug — `folder_scope` included … so Phase 184 can
paint a per-node badge from the verdict alone", with no mention that it paints exactly one
badge. `test_182_folder_scope_keying.py` uses single-offender definitions throughout, so
nothing catches it. Compare `test_182_extraction_parity.py:271-274`, which explicitly proves
rule 2 reports *both* offending phases — the asymmetry is visible inside the suite itself.

**Fix:** collect all offenders without duplicating the ⊆ walk. Add a non-raising sibling in
`scope.py` (one source, two presentations — the pattern `grounding.py` already uses):

```python
# scope.py
async def folder_scope_violations(definition, *, supabase, user_id) -> list[FolderScopeSubsetError]:
    subtree = await resolve_project_subtree(definition.project_folder_id, supabase=supabase, user_id=user_id)
    if subtree is None:
        return []
    allowed = set(subtree)
    out = []
    for phase in definition.phases:
        outside = {str(f) for f in (getattr(phase.config, "folder_scope", None) or [])} - allowed
        if outside:
            out.append(FolderScopeSubsetError(
                f"phase '{phase.slug}' folder_scope is not a subset of the "
                f"project subtree: {sorted(outside)}", phase_slug=phase.slug))
    return out

async def assert_folder_scopes_subset(definition, *, supabase, user_id) -> None:
    violations = await folder_scope_violations(definition, supabase=supabase, user_id=user_id)
    if violations:
        raise violations[0]      # short-circuit presentation — message byte-identical
```

`grounding_verdicts` then appends one verdict per violation; `_check_grounding_fidelity` keeps
calling the raising form, so the NL-gen `detail` string stays byte-identical. Add a
two-bad-phase test mirroring `test_two_presentations_over_the_same_rules`. Until this ships,
correct `grounding.py:23-26` to say "the first offending phase".

---

### WR-05: publish validates grounding against the PUBLISHER's org-membership union, not the definition's `org_id` — the value `_resolve_publish_supabase` just read and discarded

**File:** `backend/app/services/harness/publish_service.py:499-522, 562-573`;
`backend/app/services/harness/grounding.py:289-291`

**Issue:** `_resolve_publish_supabase` reads
`SELECT org_id FROM workflow_definitions WHERE id = $1` specifically so the BYPASSRLS client is
org-scoped (D-05 / T-163-05b). It then passes only `user_id` down:

```python
bundle = await assemble_grounding_bundle(supabase=resolved, user_id=str(user_id))
```

and `assemble_grounding_bundle` resolves visibility from `_resolve_caller_org_ids(supabase,
user_id)` — **every** org the publisher belongs to. For a multi-org author this means publish
green-lights a definition in org A whose `skill_ref` points at an org-B skill, or whose
`folder_scope` names an org-B folder, because the *publisher* can see both. The `org_id` that
was just read is used to construct the client and then never consulted for the gate.

At run time the picture flips: `tool_dispatcher`'s skill resolution and `fetch_visible_folders`
gate on the *runner's* org set, so an org-A colleague running the published workflow gets an
unresolvable skill or an empty folder intersection — a workflow that passed the "hard gate" and
silently under-performs for everyone but its author. This is the same shape as SEED-124 /
SEED-125 (org-blind service-role reads), one layer up: the read is org-gated, the *scope* of
the gate is wrong. It is not a data leak — nothing crosses a tenant boundary on the wire — but
it is a multi-tenancy correctness gap in a brand-new publish gate, and 182-06 is what made it
authoritative.

**Fix:** intersect the gate with the definition's org rather than the publisher's union:

```python
async def _grounding_fidelity_failures(definition, *, definition_id, user_id, pool, supabase):
    resolved, org_id = await _resolve_publish_supabase(supabase, definition_id=definition_id, pool=pool)
    bundle = await assemble_grounding_bundle(supabase=resolved, user_id=str(user_id),
                                             restrict_org_ids={str(org_id)})
```

Threading an optional `restrict_org_ids` into `assemble_grounding_bundle` keeps the ONE-copy
rule — the intersection happens where `caller_org_ids` is already resolved (grounding.py:289).
Have `_resolve_publish_supabase` return `(client, org_id)` so the org is read once (see IN-05).
Add a test: a definition in org A whose `skill_ref` belongs to org B must block at
`grounding_fidelity` even when the publisher is a member of both.

---

### WR-06: the only thing preventing an un-gated service-role storage read on `/grounding-bundle` is the `UUID` annotation — and SEED-130's own Option B removes it

**File:** `backend/app/api/workflows.py:579`;
`backend/app/services/harness/grounding.py:193-241`

**Issue:** `_resolve_template_placeholders` builds an `AssetRef` from a **caller-supplied**
identifier and hands it to `resolve_template_source` Branch 1. That branch performs **zero**
ownership, org or traversal validation — `user_id` is accepted and never read
(`template_asset_service.py:146-181`) — and the download is a raw service-role bucket read:

```python
async def _read_from_storage(supabase, storage_path: str) -> bytes:   # workspace_service.py:169
    return await run_in_threadpool(supabase.storage.from_(BUCKET_NAME).download, storage_path)
```

Today the exposure is contained *only* because `template_asset_id: UUID` restricts the
reachable key space to bare-UUID objects at the bucket root, which the app never produces (real
paths are `{user_id}/{thread_id}/{file_id}/v{n}` and `{user_id}/_library/…`). The dead-path
consequence is round-1 WR-03 / SEED-130.

**The problem is the fix guidance, not just the dead path.** SEED-130 states "**Not a security
issue.** The path only ever narrows to `[]`; it cannot widen scope, leak a foreign asset, or
bypass the owner scoping the rest of the bundle applies" — and then offers "Option B: retype
the param as the storage path (`str`) and drop the UUID coercion" as one of two viable fixes.
Option B, applied literally, turns `GET /workflows/grounding-bundle?template_asset_id=…` into
an arbitrary-object read across every tenant's `workspace-files` objects, authenticated only by
"is a canvas user". Whoever picks this up in Phase 184 will read the seed's security verdict and
not re-derive it.

**Fix:** whichever option is chosen, the ownership gate belongs at the seam that accepts the
untrusted value — do not rely on the type:

```python
# grounding._resolve_template_placeholders, before building the AssetRef
path = str(template_asset_id)
if ".." in path or not path.startswith(f"{user_id}/"):
    return []          # no 404/403 distinction — never an existence signal on the palette
```

Prefer Option A (keep the `UUID` param, look the row up and derive its storage path from an
owner-scoped query) — that makes the gate structural instead of string-matched. Independently,
amend SEED-130's `category` and "What it does NOT break" section to record that Branch 1 has no
ownership check, so the un-gated read is visible to whoever implements the fix.

---

### WR-07: `/validate` and publish now both gate on two unbounded full-table `folders` reads, so a PostgREST `max-rows` truncation renders as a FALSE `folder_scope` block

**File:** `backend/app/services/harness/grounding.py:281, 457` (via
`backend/app/utils/folder_utils.py:8-24, 119-129`);
`backend/app/services/harness/publish_service.py:209-225`

**Issue:** each `/validate` call performs the deployment-wide `folders` scan **twice** — once in
`assemble_grounding_bundle` (`fetch_visible_folders` → `fetch_all_folders(fields="*")`, no
filter, no limit) and again inside `grounding_verdicts` → `_folder_scope_violation` →
`resolve_project_subtree` → `fetch_visible_folders`. Publish stage 2.6 does the same.

Cost is out of v1 review scope; **truncation is not.** PostgREST caps unbounded selects at
`max-rows` (Supabase's Data API default is 1000 rows). Past that cap the read silently returns a
prefix, and every downstream conclusion is wrong in the *accusatory* direction:

- `folder_map` loses ancestors → `is_in_global_subtree` returns False → org-shared folders
  vanish from the palette;
- `resolve_project_subtree` returns a truncated subtree → `assert_folder_scopes_subset` reports
  a **false** `folder_scope` violation;
- post-182-06 that false violation **blocks publish** at `blocked_stage="grounding_fidelity"`.

This project targets org-scale multi-tenant production; 1000 folders *across all tenants* is not
a large deployment. The root helper is pre-existing (`folder_utils`, outside this phase's file
set), but 182 is what routed a new public route and a new state-transition gate through it,
unbounded, twice per call.

**Fix:** push the predicate down and bound the read.

```python
# folder_utils.fetch_visible_folders — org+owner predicate instead of a full scan
org_ids = await _resolve_caller_org_ids(supabase, user_id)
q = supabase.table("folders").select("id,user_id,name,parent_id,is_org_shared,org_id")
q = q.or_(f"user_id.eq.{coerce_uid(user_id)},"
          f"and(is_org_shared.eq.true,org_id.in.({','.join(sorted(org_ids))}))")
```

and resolve the palette + the ⊆ subtree from **one** fetch per request (thread the already
fetched folder list into `assert_folder_scopes_subset` rather than re-reading). At minimum add
an explicit `.limit(N)` with a loud log when `len(rows) == N`, so a truncation is observable
instead of arriving as a fabricated `folder_scope` accusation.

---

### WR-08: the canvas routes authenticate the caller twice, both times with blocking `supabase-py` calls on the event loop (D-v2.5-01)

**File:** `backend/app/api/workflows.py:472-479, 572-578`;
`backend/app/dependencies.py:626-652, 569-597, 254-275`

**Issue:** both routes carry `dependencies=[Depends(require_canvas())]` **and**
`current_user: dict = Depends(get_current_user)`. `require_canvas._dep` resolves the caller
itself via `authenticate_canvas_request` → `supabase.auth.get_user(...)` + `_is_banned(...)`;
the handler's `get_current_user` then does `supabase.auth.get_user(token)` + `_is_banned(...)`
again on the same token. Per request that is **2 GoTrue round-trips + 2 `auth.users` pg
queries**, on a route the phase documents as firing "on every canvas edit".

`supabase.auth.get_user` is a synchronous `supabase-py` call invoked directly inside `async def`
in both places — the pattern CLAUDE.md forbids ("Do not run blocking I/O … directly inside async
handlers — wrap with `run_in_threadpool`", D-v2.5-01). The single-call form is pre-existing on
`get_current_user`; the *doubling* on a keystroke-frequency route is new here. The suite cannot
see it: conftest's blanket `get_current_user` override short-circuits one side, and
`test_182_grounding_bundle` / `test_181_flip_on` monkeypatch the other.

**Fix:** have the gate publish the identity it already validated instead of resolving it twice.

```python
# dependencies.require_canvas._dep — after the caller resolves
request.state.canvas_caller = caller
return caller

# workflows.py — replace Depends(get_current_user) on the two canvas routes
async def canvas_caller(request: Request) -> dict:
    return request.state.canvas_caller
```

(`Depends(require_canvas())` inside `dependencies=[...]` discards the return value, so the
`request.state` hand-off is the minimal change; alternatively declare
`caller: dict = Depends(require_canvas())` as a handler parameter.) Independently, wrap
`supabase.auth.get_user` in `run_in_threadpool` inside `authenticate_canvas_request`.

---

### WR-09: the "unbuilt-route parity" assertions still compare against a route shape the gated routes do not have

**File:** `backend/tests/test_revert_byte_identical.py:231-236`;
`backend/tests/test_182_grounding_bundle.py:103-108`

**Issue:** both tests establish parity against `GET /workflows/__nope__/__nope__` (two segments
→ a genuine 404) because a one-segment unknown returns 405. But the gated routes *are*
one-segment, so the honest baseline is 405. Re-verified at HEAD:

```
GET /workflows/grounding-bundle (flag off) -> 404
GET /workflows/__nope__ (never built)      -> 405
```

Pre-181 `GET /workflows/grounding-bundle` returned 405; with the flag off it now returns 404.
The observable response therefore *did* change with the flag off, and the comment ("the body is
the same 404 an unknown path returns") is proven only against a shape the routes do not have.
The tests are green for the wrong reason — precisely the failure mode
`test_182_severity_codes.py` was written to prevent for verdict codes.

**Fix:** assert the real baseline and pick a deliberate posture — either accept the residual and
say so in the test, or make the CR-01 middleware reproduce Starlette's unmatched-route response
for the same path+method and pin it:

```python
assert client.get(_BUNDLE_PATH).status_code == client.get("/workflows/__nope__").status_code
```

---

### WR-10: the D-182-06 source guard bans `re.search` / `re.match` / `re.findall` anywhere in a 1100-line general-purpose router

**File:** `backend/tests/unit/test_182_folder_scope_keying.py:292-317`

**Issue:** `test_no_message_parsing_exists_in_the_folder_scope_path` asserts that none of
`("re.search", "re.match", "re.findall", ".split(\"'\")", ".split(\"'\", ", 'verdict["message"]')`
appears anywhere in `app/api/workflows.py` (1107 lines) or
`app/services/harness/grounding.py`. `api/workflows.py` is the whole workflows router —
published/starter pickers, draft CRUD, publish, the destructive cascade, NL generation, and now
the validation seam. Any future, entirely unrelated use of `re.search` in that file fails this
test with the message "the folder_scope slug must travel STRUCTURALLY on
FolderScopeSubsetError.phase_slug", which is not what happened.

The guard also over-reaches in the other direction: it does not catch `import re as _re`,
`regex.search`, `str.partition("'")`, or any other way to parse the message — so it is both
false-positive-prone and trivially bypassable.

**Fix:** scope the guard to the code that owns the rule rather than the whole router.

```python
import inspect
from app.services.harness import grounding

src = inspect.getsource(grounding._folder_scope_violation) + inspect.getsource(grounding.grounding_verdicts)
assert "re." not in src and ".split(" not in src
assert 'getattr(exc, "phase_slug", None)' in inspect.getsource(grounding._folder_scope_violation)
```

An AST walk over `grounding_verdicts` asserting that no `Call` node targets `re.*` would be
stronger still, and would not fire on unrelated router changes.

## Info

### IN-01: `_coerce_user_id` is still defined 215 lines after its first use

**File:** `backend/app/api/workflows.py:503, 600` (definition at `:718`)
**Issue:** works at runtime (module-level name, resolved at call time) but the two Phase-182
routes were inserted above a helper they depend on; the other seven call sites all sit below it.
Unchanged since round 1.
**Fix:** hoist it next to `_coerce_definition` (`:91`) so every helper precedes every route.

### IN-02: four private (underscore) symbols now cross module boundaries

**File:** `backend/app/services/workflow_authoring.py:208-210`;
`backend/app/api/workflows.py:66, 553`; `backend/app/services/harness/grounding.py:276-279`
**Issue:** `grounding._check_grounding_fidelity`, `publish_service._interactive_phase_failures`,
`folder_utils._null_foreign_global_owner` and `folder_utils._resolve_caller_org_ids` are all
underscore-private and all imported/called from other modules — the last two are net-new in this
phase. The underscore no longer communicates anything, and
`test_182_publish_grounding_stage.py:406-413` now depends on the *absence* of certain identifiers
in another module's source, which is the kind of coupling private names are supposed to prevent.
**Fix:** promote the four to public names with one-line back-compat aliases.

### IN-03: `assemble_grounding_bundle(project_folder_id=...)` is still accepted and ignored

**File:** `backend/app/services/harness/grounding.py:258, 271-273`
**Issue:** documented as "accepted for signature symmetry", but `/grounding-bundle` passes
`project_folder_id=None` explicitly while `/validate` and publish stage 2.6 omit it — three call
sites, three conventions, zero effect. A future caller may reasonably expect the palette to
narrow.
**Fix:** drop the parameter, or raise on a non-`None` value until narrowing is implemented.

### IN-04: two tautological assertions survive, and one guards the exact case CR-01 breaks

**File:** `backend/tests/test_revert_byte_identical.py:132`;
`backend/tests/unit/test_182_validate.py:341`
**Issue:** `assert resp_validate.status_code != 422` runs against a body validated against the
real model two lines earlier — it cannot fail, and the malformed body it is meant to stand in for
*is* 422 (CR-01). `assert {v.severity for v in resp.verdicts} <= {"error", "incomplete"}` is
guaranteed by `Verdict.severity: Literal[...]`, which would raise at construction.
**Fix:** probe the malformed body (CR-01) and assert the taxonomy against the classifier —
`test_182_severity_codes.py` now does the latter properly, so `:341` can simply be deleted.

### IN-05: stage 2.6 and the golden run each build their own service-role client and each re-read the org

**File:** `backend/app/services/harness/publish_service.py:562-566, 651-653`
**Issue:** `publish_workflow` keeps `supabase=None` between the two calls, so
`_resolve_publish_supabase` runs its `SELECT org_id …` and `create_client(...)` twice per publish,
and the stage-2.6 client is discarded immediately. `create_client` opens an httpx client that is
never closed. The docstring's "exactly ONE construction path exists" is true of the *code path*
but not of the resulting clients. Neither test suite exercises the real resolution —
`test_182_publish_grounding_stage.py` patches `_resolve_publish_supabase` and
`test_publish_service.py` patches the whole stage — so the one net-new DB read added by 182-06
has zero coverage.
**Fix:** resolve once at the top of `publish_workflow` and thread the client (and the org id —
WR-05) into both consumers; add one test that lets the real `_resolve_publish_supabase` run
against a fake pool.

### IN-06: the fail-loud branch logs a WARNING per finding per request, on a route documented to fire on every keystroke

**File:** `backend/app/api/workflows.py:457-466`
**Issue:** the WR-05 fix is correct in polarity, but an unclassified code emitted once per phase
on a route called on every canvas edit produces an unbounded WARNING stream with no dedupe —
`test_182_severity_codes.py:284-288` acknowledges this ("logs a warning on EVERY request that
produces it"). The drift detectors make this unlikely, not impossible: they cover `reachability`
and `grounding` only, not a code minted by a future third module.
**Fix:** dedupe per process (`functools.lru_cache` on a `_warn_unknown(code)` helper) so the
signal survives without drowning the log.

### IN-07: `_KNOWN_CODES` snapshots `GROUNDING_VERDICT_CODES` at import time, contradicting the module-import-for-patchability comment 370 lines above

**File:** `backend/app/api/workflows.py:49-53, 419-421`
**Issue:** `grounding` is imported as a module with an explicit comment that the routes "resolve
`grounding.<fn>` at call time, so a test can monkeypatch the shared grounding source's
attributes" — but `_KNOWN_CODES` reads `grounding.GROUNDING_VERDICT_CODES` at module scope, so
patching that attribute is a no-op and the value becomes a hard import-order dependency.
Related: `test_182_severity_codes.py:47-58` deliberately strips only whole-line comments, not
docstrings, so a code mentioned as `"code": "x"` in any prose block in `grounding.py` or
`publish_service.py` would fail the drift/boundary tests.
**Fix:** note the import-time snapshot beside `_KNOWN_CODES`, or compute it in `_severity` via a
cached accessor if late binding is actually wanted.

---

_Reviewed: 2026-07-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard (round 2 — full phase, plans 182-01..07)_
