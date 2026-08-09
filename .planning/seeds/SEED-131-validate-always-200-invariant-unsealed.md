---
seed_id: SEED-131
title: "POST /workflows/validate documents an ALWAYS-HTTP-200 invariant that is not sealed — an uncaught postgrest APIError from the grounding reads 500s the route the canvas calls on every edit"
status: open
planted: 2026-07-25
phase_origin: "Phase 182 verification (182-VERIFICATION.md Anti-Patterns, WR-04) — surfaced at verification, deliberately deferred at gap closure. The gap-closure wave fixed the SC#4 keying blocker (182-04), the publish-enforcement gap (182-06) and the fail-open severity classifier (182-07). This one is deferred because the honest fix is not a try/except — it needs a degraded-verdict vocabulary the canvas can render, and the canvas does not exist yet."
folded_into: null
category: reliability / unsealed invariant — a documented API contract with no enforcement and no test. Today the blast radius is one hand-crafted API call; the moment Phase 184's canvas calls this route on every keystroke-ish edit, the same DB blip becomes a visible 500 storm mid-authoring.
related_seeds: [SEED-097, SEED-132]
related_decisions:
  - "D-182-02 (182-CONTEXT.md) — `/validate` reports the FULL static publish gauntlet, and two of its four check categories are DB-backed (grounding fidelity reads the folder tree + skill registry; the folder-scope rule walks the real project subtree). The invariant is therefore a promise made ON TOP of I/O, not a promise about a pure function — which is exactly why it needs an explicit seal rather than being true by construction."
  - "D-182-01 — `/validate` fires on EVERY canvas edit (the stated reason the palette was split into a separate cacheable GET). That call frequency is the whole argument for the priority below: an unsealed route called once per authoring session is a nuisance; called once per edit it is the authoring experience."
  - "CR-01 (182-REVIEW.md) — `grounding._skill_registry` was deliberately made FAIL-CLOSED on a read miss (`except Exception: return []`) with the reasoning written in-line: on a service-role client there is no safe fallback read, so an empty set beats a possibly-polluted one. That is the model for how a sealed read should behave; it just has not been applied to the sibling reads."
  - "D-182-03 — verdicts already carry a severity taxonomy (`error` / `incomplete`). A degraded-read outcome does not fit either value honestly, so sealing this route probably means the taxonomy gains a third state (or a top-level `degraded` flag on the envelope). That design call is why this is not a mechanical patch."
confirmed:
  - "The promise is explicit and in the code. `backend/app/api/workflows.py` (`validate_workflow`, docstring at :383-404 at HEAD — the verification cited the surrounding block as :338-368): `ALWAYS HTTP 200 with the machine-renderable envelope: a dirty definition is not an HTTP error, it is advice.` The handler body the promise covers is :405-456. STILL TRUE as a promise; it is now ENFORCED for the two grounding I/O stages (plan 182-11) and still unenforced elsewhere."
  - "[SUPERSEDED by plan 182-11] `grounding._skill_registry` DOES fail closed. It did — `except Exception: ... return []` — and that turned out to be the WR-01 defect rather than the model to copy: the swallow was invisible to both consumers, so an empty registry looked healthy and every valid phase skill reference was reported unregistered. The swallow is GONE; the fail-closed decision moved up to `assemble_grounding_bundle`, which records the failure on `GroundingBundle.degraded` instead."
  - "[PARTIALLY SUPERSEDED by plan 182-11] `_resolve_caller_org_ids` (`backend/app/utils/folder_utils.py`) still has an unguarded `aexec(...)` of its own — a postgrest `APIError` still propagates OUT OF THE HELPER. What changed is that both of its call sites inside `assemble_grounding_bundle` are now wrapped, so on the `/validate` and publish paths that raise degrades the bundle instead of escaping. Other callers are unchanged."
  - "[SUPERSEDED by plan 182-11] `fetch_visible_folders` (`backend/app/utils/folder_utils.py`) does NOT fail closed. The helper itself still raises by design, but its call inside `assemble_grounding_bundle` is now wrapped AND opts into the new truncation-aware `strict=True` read, so both a raise and a PostgREST `max-rows` truncation degrade the bundle rather than 500ing the route or fabricating a `folder_scope` violation (WR-07)."
  - "[PARTIALLY SUPERSEDED by plan 182-11] `resolve_project_subtree` (`backend/app/services/harness/scope.py`) does NOT fail closed. Still true of the helper. It is reached from `/validate` via `grounding.grounding_verdicts`, and THAT call is now inside the handler's seal, so a raise from the ⊆ walk returns a structured 200 instead of a 500. Its own reads remain unguarded for every other caller."
  - "[SUPERSEDED by plan 182-11] No test exercises any of these failure paths. `backend/tests/unit/test_182_grounding_degradation.py` (19 tests) now injects each failure — a raising skills read, a raising folders read, a truncated folders read, a non-`ValueError` `APIError`-shaped raise from both grounding stages — and asserts a 200 with an honest `grounding_unavailable` verdict, never a 500 and never a false `unregistered_skill` / `folder_scope`. All of them were observed FAILING against the pre-fix code."
needs_confirmation:
  - "There is a SECOND-ORDER hazard that must be examined in the same pass and may be worse than the 500. `_folder_scope_violation` (`grounding.py:352-382`) catches bare `ValueError` — deliberately NOT narrowed to `FolderScopeSubsetError`, with an in-line comment explaining that the test doubles raise plain `ValueError` and that narrowing would risk a 500 on a documented-200 route. That catch is correct for its stated purpose, but it means ANY `ValueError` raised anywhere beneath `assert_folder_scopes_subset` — including one from a malformed DB row rather than a real scope violation — is silently rendered as a `folder_scope` ERROR verdict with `phase: None`. So the route can already paint a HEALTHY workflow red because of an infrastructure problem. Confirm whether any read under `resolve_project_subtree` can raise `ValueError` (as opposed to `APIError`) before deciding how tight the seal should be."
  - "Whether the canvas should be told the difference. A sealed route that returns `ok: false` with a degraded marker is honest; one that returns `ok: true` on a failed read is dangerous; one that returns `ok: false` with a normal-looking verdict is the current folder-scope behavior and is the shape to avoid. This is a small UX/API design call for whoever owns the canvas's error surface."
re_open_triggers:
  - "Phase 184 lands the live editable canvas. Its SC#3 requires structural violations to `surface live from the server validate route` as the user builds — i.e. `/validate` is called continuously during authoring (D-182-01 says so explicitly). A single transient Supabase blip then turns into a visible 500 storm in the middle of someone drawing a workflow, with no verdict payload and no rendered explanation. This is the primary trigger and the reason for the `high` priority."
  - "Any observed 5xx on `POST /workflows/validate` in backend logs, LangSmith, or a browser network panel. One occurrence is sufficient — the route is documented as never returning one, so a single 5xx is a contract violation, not a flake to retry past."
  - "The route gains a second I/O dependency, or any of `assemble_grounding_bundle` / `grounding_verdicts` / `fetch_visible_folders` / `_resolve_caller_org_ids` / `resolve_project_subtree` is edited. Seal it in that commit; each added read widens the unsealed surface."
  - "Phase 185 extends the verdict with the per-node grounding-MODE verdict (GOVERN-01). That adds a THIRD DB-backed check category to the same envelope and makes an unsealed route strictly more likely to fail — and a grounding-mode verdict that silently disappears on a read error is a governance claim the product cannot make."
priority: high
suggested_phase: "A dedicated /gsd:quick immediately BEFORE or as the opening wave INSIDE Phase 184 — the canvas is the amplifier, so sealing must land no later than the code that starts hammering the route. Cheap in code terms (one handler-level guard plus the degraded-verdict shape), but it needs the canvas's error rendering decided alongside it, which is why it belongs adjacent to 184 rather than as a standalone backend patch now."
---

# SEED-131 — the `/validate` ALWAYS-200 invariant is documented but not sealed

## Partially addressed in Phase 182 gap closure, plan 182-11 (2026-07-25)

**The seed is NOT closed.** Round-2 review re-reported this as **WR-02** (escalated: 182-06 had
built exactly the fail-closed wrapper this route needed, applied it to publish only, and then
documented the two sides as "the SAME copy" in the seam header — same *rules*, opposite *failure
postures*, with the unsealed one being the route that fires on every canvas edit). The operator
selected it as item 5 of the D-182-R2-03 scope, together with WR-01 and WR-07, and plan 182-11
shipped the following.

**What shipped:**

1. **The two grounding I/O stages of `/validate` are SEALED.** `assemble_grounding_bundle` and
   `grounding_verdicts` are wrapped in one `try/except` inside `validate_workflow`. A real
   `postgrest` `APIError` from either the palette read or the ⊆ walk now returns HTTP 200 with a
   structured verdict instead of escaping as a 500.
2. **An honest degraded vocabulary exists.** `grounding.GROUNDING_UNAVAILABLE_CODE` +
   `grounding.grounding_unavailable_finding` are the one code string and the one message builder;
   `/validate` composes the code into `_KNOWN_CODES` via `_DEGRADED_CODES`, and the DERIVED
   `_ERROR_CODES` classifies it **`error`** in both `phases_empty` states. `ok` is therefore never
   `true` when a check did not run — the seed's point 2, answered with a verdict code.
3. **The pure checks stay outside the seal** (the seed's point 4). `lint_workflow`, the D-13
   business-requirement invariant and the interactive-phase check keep running and keep
   contributing verdicts when grounding is unavailable — a registry blip costs the author three
   rules, not the whole validation. Pinned by a test.
4. **A degraded read is never dressed up as a violation** (the seed's point 3, and the
   "related hazard" section below). A degraded bundle SKIPS the fidelity collector entirely rather
   than running it against an empty registry, which is what produced the false `unregistered_skill`
   (WR-01) and, via a truncated folder tree, the false `folder_scope` (WR-07).
5. **The folders read is truncation-aware at the two grounding gate call sites.**
   `folder_utils.fetch_all_folders` / `fetch_visible_folders` gained a keyword-only
   `strict=False`; `strict=True` requests an exact count and raises the new
   `FolderReadTruncatedError` (a `RuntimeError`, deliberately **not** a `ValueError`, so the ⊆
   rule cannot re-dress it as a `folder_scope` verdict). Every other caller is byte-identical and
   issues no extra `COUNT(*)`.
6. **Publish and `/validate` now share one FAILURE posture**, not just one rule set — both branch
   on `GroundingBundle.degraded` and both mint the same finding from the same builder. The seam
   header's parity claim was updated to say so.

**Effect on the risk this seed exists to flag:** the acute failure mode — a Phase-184 canvas
turning one transient Supabase blip into a visible 500 storm mid-authoring — is **closed** for the
grounding reads, which were the only DB-backed calls on the handler. The seed's `priority: high`
is left unchanged because the remaining scope below is what Phase 184 must still decide, not
because the 500 is still live.

**What remains, DEFERRED to Phase 184:**

- **The envelope-level design question this seed actually raises.** 182-11 answered it with a
  verdict code because that is what the existing `{ok, verdicts}` envelope could carry honestly
  today. The alternative shapes — a top-level `degraded: [category]` marker, or a third severity
  alongside `error` / `incomplete` — are still open, and the right call depends on how the canvas
  renders "we could not check right now" versus "this node is broken". That is a UX/API decision
  for whoever owns the canvas's error surface (the seed's `needs_confirmation` #2).
- **The `@model_validator` 422s that bypass the envelope entirely** before the handler is even
  entered — **SEED-132**, untouched and unchanged.
- **Any other unguarded read added to this handler later.** The seal covers the grounding stages
  specifically; nothing structurally prevents a future stage from being added outside it.
- **A contract test enforcing always-200 across the WHOLE handler**, rather than across the two
  grounding stages only. `tests/unit/test_182_grounding_degradation.py` proves the sealed stages;
  it does not prove the invariant for the handler as a unit.
- **The live check** (the seed's "how we would know this is closed" #5): break the Supabase
  connection with `visual_workflow_canvas` on and confirm a 200 with the degraded verdict plus a
  logged underlying error. Not performed in 182-11 — the automated proof is failure injection, not
  a live outage.

## The gap

`POST /workflows/validate` states its own contract in its docstring
(`backend/app/api/workflows.py`, `validate_workflow` — docstring at **:383-404** at HEAD; the
verification report cited the surrounding block as **:338-368**, and the handler body it covers as
**:405-456**):

> ALWAYS HTTP 200 with the machine-renderable envelope: a dirty definition is not an HTTP
> error, it is advice.

The promise holds for every *definition* input — a broken graph, an empty draft, a missing
business requirement all come back 200 with verdicts. It does **not** hold for *infrastructure*
input. Two of the four check categories are DB-backed, and most of their reads are unguarded.

## Which reads are sealed and which are not

*(As originally planted. Superseded by plan 182-11 — see the section above; the post-182-11 state
is in the right-hand column.)*

| Read | Reached from | Fails closed? (at planting) | After plan 182-11 |
|---|---|---|---|
| `grounding._skill_registry` | `assemble_grounding_bundle` | **Yes** — `except Exception: ... return []` | The swallow is **removed**. It was the WR-01 defect, not the model: an invisible failure produced a healthy-looking empty registry. The read now raises and the caller records `degraded={"skills"}` |
| `_resolve_caller_org_ids` | `assemble_grounding_bundle`, `fetch_visible_folders` | **No** (only against an empty result) | Helper unchanged; **both grounding call sites wrapped**, so a raise degrades the bundle on those paths |
| `fetch_visible_folders` (+ `fetch_all_folders`) | `assemble_grounding_bundle`, called FIRST | **No** | Helper still raises by design; the grounding call site is **wrapped AND `strict=True`**, so a raise *or* a `max-rows` truncation degrades the bundle (WR-07) |
| `resolve_project_subtree` | `grounding_verdicts` -> the ⊆ walk | **No** | Helper unchanged; the `/validate` call into `grounding_verdicts` is **inside the seal** |

At planting, the seal existed for exactly one read, with the right reasoning written next to it —
and it simply had not been extended to its siblings. Round 2 found the sharper version of that
observation: the one "sealed" read was sealed in the WRONG PLACE (inside the bundle, invisible to
both consumers), which is why extending the same pattern would have been the wrong fix.

## The related hazard worth fixing in the same pass

`_folder_scope_violation` (`grounding.py:352-382`) catches **bare `ValueError`**, deliberately not
narrowed to `FolderScopeSubsetError` — the in-line comment says narrowing would risk a 500 on a
documented-200 route. Correct instinct, but the consequence is that any `ValueError` raised
anywhere beneath the ⊆ walk is rendered as a normal-looking `folder_scope` **error** verdict with
`phase: None`. A read problem is currently indistinguishable, on the wire, from a real
governance violation.

That is the failure shape a fix must avoid reproducing at handler level.

## The fix is NOT a blanket try/except

Wrapping the handler body in `try: ... except Exception: return ValidateResponse(ok=True,
verdicts=[])` would technically satisfy the docstring and would be **worse than the 500**: it
paints a possibly-broken workflow green, and the canvas would render a confident all-clear built
on checks that never ran. The publish gauntlet would then reject at publish time for reasons the
author was explicitly told did not exist — precisely the drift the whole Phase-182 seam exists to
prevent (D-182-06 / ROADMAP SC#2).

The honest shape is:

1. **Seal at the handler**, not inside each read — one guard per check category, so a failure in
   the grounding reads does not discard the structural lint results, which are pure and cannot
   fail.
2. **Emit an honest degraded outcome.** `ok` must NOT be `true` when a check did not run. Either a
   new severity/verdict code (`check_unavailable` or similar) naming WHICH category degraded, or a
   top-level `degraded: [category]` marker on the envelope. Either way the client can render "we
   could not check grounding right now" instead of a false all-clear or a raw 500.
3. **Never let a degraded read look like a violation** — the inverse of the `_folder_scope_violation`
   behavior above.
4. **Keep the pure checks pure.** `lint_workflow` cannot fail; its verdicts should always survive a
   grounding-read outage.

## How we would know this is closed

1. A test exists per unguarded read that makes it raise (`APIError`, then a generic `Exception`)
   and asserts the response is **HTTP 200** — e.g. monkeypatch `fetch_visible_folders` to raise,
   POST a valid definition, assert `resp.status_code == 200`. It must FAIL against today's code
   before it is trusted.
2. The same tests assert the response is **honest**: `ok` is not `true`, and the payload names the
   degraded check category. A test that only asserts `200` would re-create the blanket-try/except
   failure mode it is supposed to prevent.
3. A test asserts the structural lint verdicts still appear when the grounding reads are down —
   a partial result, not an empty one.
4. `grep -n "except" backend/app/api/workflows.py` shows a guard inside `validate_workflow`, and a
   reader can trace every DB-backed call in the handler to either a fail-closed read or that guard.
5. A live check: with `visual_workflow_canvas` on, break the Supabase connection (or point at a bad
   URL) and confirm `POST /workflows/validate` returns 200 with a degraded marker rather than a
   500 — and that the backend log records the underlying error, so sealing the route does not
   also hide the outage.
