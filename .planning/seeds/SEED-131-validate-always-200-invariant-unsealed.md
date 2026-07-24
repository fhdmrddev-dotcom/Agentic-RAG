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
  - "The promise is explicit and in the code. `backend/app/api/workflows.py` (`validate_workflow`, docstring at :383-404 at HEAD — the verification cited the surrounding block as :338-368): `ALWAYS HTTP 200 with the machine-renderable envelope: a dirty definition is not an HTTP error, it is advice.` The handler body the promise covers is :405-456."
  - "`grounding._skill_registry` DOES fail closed. `backend/app/services/harness/grounding.py:148` — `except Exception:  # noqa: BLE001 — a gated read miss must FAIL CLOSED, never widen scope.` returns `[]`. This one read cannot 500 the route."
  - "`_resolve_caller_org_ids` (`backend/app/utils/folder_utils.py:27-50`) does NOT fail closed against a raised error. It fails closed against an EMPTY or missing membership row set (returns an empty set — the documented D-165-04 over-restrict posture) and defensively coerces a dict-shaped response, but the `aexec(...)` call itself is unguarded: a postgrest `APIError` propagates."
  - "`fetch_visible_folders` (`backend/app/utils/folder_utils.py:119-129`) does NOT fail closed. It awaits `_resolve_caller_org_ids` and then `fetch_all_folders(supabase, fields=\"*\")` with no try/except at any level. It is called unconditionally at the top of `assemble_grounding_bundle`, which `/validate` calls FIRST (`workflows.py:410-413`) — so this is the earliest 500 opportunity on the route."
  - "`resolve_project_subtree` (`backend/app/services/harness/scope.py:79`) does NOT fail closed. It performs its own DB reads with no exception guard, reached from `/validate` via `grounding.grounding_verdicts` -> `_folder_scope_violation` -> `assert_folder_scopes_subset`."
  - "No test exercises any of these failure paths. `tests/unit/test_182_validate.py` (12 tests) drives definition SHAPES through a mocked/faked supabase; none of them makes a read raise."
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

| Read | Reached from | Fails closed? | Evidence |
|---|---|---|---|
| `grounding._skill_registry` | `assemble_grounding_bundle` | **Yes** | `grounding.py:148` — `except Exception: ... return []`, with CR-01's reasoning in-line: on a service-role client there is no safe fallback read |
| `_resolve_caller_org_ids` | `assemble_grounding_bundle`, `fetch_visible_folders` | **No** (only against an empty result) | `folder_utils.py:27-50` — empty/missing membership degrades to an empty set (D-165-04 over-restrict), but the `aexec(...)` call is unguarded |
| `fetch_visible_folders` (+ `fetch_all_folders`) | `assemble_grounding_bundle`, called FIRST at `workflows.py:410-413` | **No** | `folder_utils.py:119-129` — no try/except at any level; earliest 500 opportunity on the route |
| `resolve_project_subtree` | `grounding_verdicts` -> `_folder_scope_violation` -> `assert_folder_scopes_subset` | **No** | `scope.py:79` — own DB reads, no exception guard |

So the seal already exists for exactly one read, with the right reasoning written next to it. It
simply has not been extended to its siblings.

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
