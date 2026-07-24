# Phase 182 — Decision Notes (verifier findings that are DECISIONS, not defects)

**Purpose.** This file is the standing answer to verification findings on Phase 182 that a
locked decision already resolves. A verifier reading `182-VERIFICATION.md` cold will see design
choices that look like oversights; this note records which of them were decided deliberately,
with the citation, the honest residual risk, and the narrow condition under which each reopens —
so a re-verification of this phase does not re-raise settled ground as a new defect. It covers
**only** findings that were rejected. Findings that were FIXED during the gap-closure wave (the
SC#4 `folder_scope` per-node keying blocker, the publish-enforcement gap, and the fail-open
severity classifier) are closed by plans 182-04 / 182-06 / 182-07 and are documented in those
plans' SUMMARY files, not here.

---

## WR-08 — authorization asymmetry with sibling authoring routes — **REJECTED**

**Source:** `182-VERIFICATION.md`, Anti-Patterns Found, row for `backend/app/api/workflows.py`
lines 374, 474 (severity WARNING).

### The finding as the verifier stated it

> The 2 new routes carry `require_canvas()` alone; all 8 other authoring routes on the same
> router also carry `require_visible("workflow_authoring")`. Currently latent (default audience
> "everyone") but a silent authz gap the moment an operator narrows authoring visibility.

The verifier's Key Link table corroborates the observation itself, naming the 8 sibling routes at
`workflows.py:559, 623, 656, 685, 720, 790, 820, 960`. **The observation is factually correct.**
`POST /workflows/validate` (`workflows.py:374`) and `GET /workflows/grounding-bundle`
(`workflows.py:474`) each carry `dependencies=[Depends(require_canvas())]` and nothing else.

### Verdict

**REJECTED — the asymmetry is the intended design, not an oversight.** Stacking
`require_visible("workflow_authoring")` on these two routes would actively break the property the
entire canvas off-switch is built on.

### Rationale

**1. It is locked by decision, not left to discretion.** `182-CONTEXT.md` → **D-182-05** (under
"Inherited / red-line (locked — not re-litigated)"):

> Both routes inherit 181's `require_canvas` 404 posture verbatim. `/validate` and
> `/grounding-bundle` attach `Depends(require_canvas())` and return a byte-identical 404 when
> `visual_workflow_canvas` is off — for everyone incl. operators (D-181-01), fail-closed on
> cold-cache/DB-blip (D-181-02). The off-flag check runs BEFORE any auth dependency can leak
> route existence (the 181 code-review pre-auth fix).

Note that `182-CONTEXT.md` did list auth stacking under "Claude's Discretion" as a planner call —
and the planner made it, in the direction D-182-05 already pointed. The discretion was exercised,
not skipped.

**2. `require_visible` raises 403, and a 403 leaks route existence.** This is the load-bearing
technical reason, and it is verifiable in source rather than from memory:

- `require_visible` (`backend/app/dependencies.py:517-555`) ends in
  `raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, ...)` at `:551-554`. Its own
  docstring states the choice explicitly: it "raises **403 — NOT 404** for a non-operator who is
  not greenlisted… The /admin surface keeps its byte-identical 404; a governed product feature is
  a deliberate 403 an end user can understand."
- `require_canvas` (`backend/app/dependencies.py:600-652`) does the opposite on purpose: it
  "MIRRORS `require_operator`'s byte-identical 404 (NOT `require_visible`'s 403) so the off state
  is indistinguishable from 'the route was never built'. A 403 would leak that a canvas route
  exists-but-forbidden; a 404 does not (D-181-02)." Every deny path in it — off flag,
  unauthenticated, invalid token, un-greenlisted audience — terminates in the same `_NOT_FOUND`
  (`:636`, `:642`, `:651`), never a 403 or 401.

A 403 is, by construction, an admission that the route exists. Stacking a dependency that can emit
one onto a route whose whole contract is a byte-identical 404 would defeat REVERT-01/REVERT-02 —
the Phase 181 HARD gate — for any caller who trips it. Phase 181's own code review found and fixed
exactly this class of bug in the other direction (auth dependencies firing 403/401 *ahead* of the
off-flag check, leaking route existence to an anonymous prober); re-introducing a 403 path
downstream would undo that fix's intent.

**3. It would couple canvas availability to a different feature's audience.** `require_canvas`
already applies the `visual_workflow_canvas` audience itself (`dependencies.py:643-651`: operator
no-op, `everyone` no-op, `role` greenlist check, else 404). These routes are therefore governed —
by their own feature flag. Stacking `require_visible("workflow_authoring")` would mean flipping
`workflow_authoring` off silently disables the canvas validation seam, which is neither what that
switch says it does nor something an operator could reasonably predict.

**4. The rule is already asserted in source and in two phase documents.** The seam header comment
at `backend/app/api/workflows.py:244-248` states it in the code itself, where a future editor will
actually encounter it:

```python
# GATE (D-182-05, Pitfall 3): both routes carry ``Depends(require_canvas())`` **ALONE** — a
# byte-identical 404 when ``visual_workflow_canvas`` is off, for EVERYONE incl. operators,
# resolved PRE-AUTH. They must NEVER stack ``require_visible`` (which raises 403 and would
# leak that the route exists) nor couple canvas availability to another feature's audience.
```

Cross-references: `182-RESEARCH.md:254` lists "Stacking `require_visible` and expecting a 404" as
an explicit Anti-Pattern — "`require_visible` raises **403** on deny (`dependencies.py:551`), which
would leak route existence when the canvas is ON but authoring-visibility is restricted
(Pitfall 3)". `182-PATTERNS.md:270-272` ("The flag gate — `require_canvas()` (D-182-05)") repeats
the instruction: "`require_canvas` ALONE, never stacked with `require_visible` (Pitfall 3)".

### Residual risk (stated honestly — the finding is not risk-free, it is bounded)

The verifier's concern is not empty. If an operator narrows `workflow_authoring` visibility while
`visual_workflow_canvas` stays on, there is a real window: a caller who is inside the
`visual_workflow_canvas` audience but outside the `workflow_authoring` audience can still reach
these two routes, while being denied the 8 sibling authoring routes.

What that window actually yields:

- **`POST /workflows/validate`** — read-only advice. It never persists, never executes, never
  mints a version, and touches no provider (the seam header at `workflows.py:241-242` states this;
  the golden-run and judge stages are deliberately publish-only). Its input is a definition the
  caller already supplied. It returns verdicts about that caller's own submitted body.
- **`GET /workflows/grounding-bundle`** — the caller's OWN palette. Every read is owner-scoped by
  `user_id` and org-gated: folders via `fetch_visible_folders` (D-165-04 / SEED-124), skills via
  the one shared predicate in `app/utils/skill_visibility.py` (CR-01 / SEED-125), both fail-closed
  on an unresolvable org set. The response is an explicit `PaletteFolder` / `PaletteSkill`
  projection, so `org_id` and the seeding owner's `user_id` never reach the wire (CR-02). The only
  non-caller-specific content is `tools` — the in-process tool-registry name list, which is not
  secret.

So the exposure is **the caller's own data plus the public tool-name registry, through two
read-only routes, with no write, persist, publish, or execute path reachable**. The routes are
governed — by `visual_workflow_canvas`, which is the switch that actually describes them. Accepting
this is a deliberate trade: a bounded, own-data-only read window in exchange for keeping the
byte-identical-404 revert guarantee intact, which is the Phase 181 HARD gate the whole milestone is
built on.

### Re-open trigger (narrow by design)

This decision is revisited **only** if:

1. **The operator explicitly supersedes D-182-05.** It is a locked, not-re-litigated decision; a
   planner, verifier, or reviewer cannot flip it unilaterally, and a finding that merely restates
   the asymmetry is answered by this note.
2. **`POST /workflows/validate` or `GET /workflows/grounding-bundle` gains a write, persist, or
   execute side effect** — anything that makes either route more than read-only advice or an
   own-palette read. At that point the "bounded exposure" argument above no longer holds, and the
   gate stack must be re-derived from scratch rather than inherited. Note this must still be solved
   WITHOUT a 403-capable dependency (the byte-identical 404 is non-negotiable while the off-switch
   is a HARD gate) — most likely by moving the write to a new, separately-gated route rather than
   by stacking `require_visible` onto these two.

---

*Phase: 182-server-validation-seam*
*Recorded: 2026-07-25 (plan 182-05, gap-closure bookkeeping)*
