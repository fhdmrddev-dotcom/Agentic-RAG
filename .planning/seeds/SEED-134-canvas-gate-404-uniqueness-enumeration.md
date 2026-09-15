---
seed_id: SEED-134
title: The canvas gate's uniform 404 is uniquely identifying — an anonymous method sweep enumerates the two gated routes
status: open
planted: 2026-07-25
planted_by: Phase 182 round-3 gap closure (operator-accepted residual)
surface: Agentic-RAG
severity: warning
affected_areas: [canvas-gate, middleware, flag-gating, information-disclosure]
re_open_trigger: >
  Re-open if ANY of these becomes true: (1) a NEW flag-gated route lands on a router whose
  path shape is not already shadowed by a wildcard route — the accepted rationale below does
  not generalize, it depends on the specific `/workflows/{definition_id}` shadowing; (2) the
  flag-off state must survive an adversarial audit / pentest / customer security review, where
  "it only discloses route names" is not an accepted answer; (3) a gated route's NAME itself
  becomes sensitive (e.g. a customer-specific or unannounced-feature path); (4) Phase 181's
  REVERT-01/02 HARD gate is re-asserted as byte-identity for EVERY probe shape rather than for
  the body/status of a matched path.
trigger_when: unset
---

# SEED-134 — the flag-off 404 is uniform, and that is what makes it unique

## What was found

Phase 182 plan 182-08 moved the `visual_workflow_canvas` off-switch into a pure-ASGI
`CanvasGateMiddleware` that runs before Starlette routing. It genuinely closed the round-2
leaks: a malformed body now returns a byte-identical 404 instead of a 422, and `/openapi.json`
no longer advertises the routes or their schemas.

The round-3 verification then found the leak had changed shape rather than closed. The gate
answers a **uniform 404 for every method** on `/workflows/validate` and
`/workflows/grounding-bundle`. But `api/workflows.py` also declares
`PATCH /workflows/{definition_id}` and `DELETE /workflows/{definition_id}`, which shadow every
other single-segment `/workflows/<x>` name — those answer 405, 403 or 422, never 404.

So with the flag off, the two gated paths are the **only** single-segment `/workflows/` paths
that answer 404 to a `PATCH` probe. A single anonymous sweep over a wordlist enumerates exactly
the gated surface. The gate's own honesty baseline (`/workflows/__nope__/__nope__`) is a
TWO-segment path, which is why the shipped tests did not catch this: it is the wrong shape to
prove byte-identity against.

## Why it was accepted rather than fixed (2026-07-25)

Operator decision, taken after the round-3 verification with the finding on the table:

- **What leaks is two route NAMES.** No data, no access, no credential, no tenant identifier.
  Every deny path still terminates in the same `_NOT_FOUND`; `require_canvas` is still stacked
  as defense in depth; nothing behind the gate is reachable.
- **The names go public shortly anyway.** Phase 183/184 flip `visual_workflow_canvas` on, at
  which point `/workflows/validate` and `/workflows/grounding-bundle` are documented, advertised
  in `/openapi.json`, and called by the canvas on every edit. The window in which the names are
  secret is the window before the feature ships.
- **The fix is not small, and this surface has already absorbed three fix rounds.** Doing it
  right means deriving the gate's response from what the router *would* have answered for that
  path+method shape had the routes never been declared — a behavior the middleware currently
  cannot see, since it runs before routing on purpose. A fourth patch wave on the same files is
  exactly the pattern guardrails G-1/G-5 exist to interrupt.

**This rationale is load-bearing and does not generalize.** It rests on the specific
`/workflows/{definition_id}` shadowing and on the flag flipping on soon. A future gated route on
a differently-shaped router does not inherit this decision — see the re-open triggers.

## Fix sketch (when it is time)

Give the gate a way to answer as the router would for an undeclared path:

- On a gated hit, resolve the request against a route table with the gated routes REMOVED and
  return whatever that resolution yields (404 vs 405 vs the wildcard's own 403/422). This makes
  the off-state genuinely indistinguishable for every probe shape, which is what Phase 181's
  REVERT-01/REVERT-02 HARD gate asks for.
- Then update `tests/test_182_canvas_gate.py::test_wrong_method_probe_404s_not_405`, whose
  docstring already carries a pointer here explaining that its expectation encodes this accepted
  risk and must be updated BY a correct fix, not defended against one.

## Evidence

- `.planning/phases/182-server-validation-seam/182-VERIFICATION.md` — Truth 3 (live 5-method
  sweep against a fresh unmocked `app.main.app` import)
- `.planning/phases/182-server-validation-seam/182-REVIEW.md` — CR-01, and WR-07 on the test
  that pins the behaviour
- `backend/app/middleware/canvas_gate.py` — `CANVAS_GATED_PATHS`, the path-only match

Related: [[SEED-133]] (the other consumer gap from the same round). The Phase-181 inheritance is
D-181-02 / REVERT-01 / REVERT-02.
