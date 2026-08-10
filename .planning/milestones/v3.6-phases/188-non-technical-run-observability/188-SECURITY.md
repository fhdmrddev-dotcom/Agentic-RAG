# 188-SECURITY.md — Phase 188 Non-Technical Run Observability

```yaml
phase: 188
phase_name: non-technical-run-observability
audited: 2026-08-05
auditor: gsd-security-auditor
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
threats_total: 46
threats_closed: 46
threats_open: 0
rationale_drift: 3
unregistered_flags: 5
verdict: SECURED (with warnings)
phase_commit_range: 9d3d887d..7e1bff34
```

## How this audit was performed

Every CLOSED verdict below rests on a `file:line` citation read out of shipped source, or
on a measurement taken in this session — never on a PLAN or SUMMARY sentence. Three
measurements were re-derived from the repository rather than inherited, per the project's
standing "don't inherit unmeasured claims" rule:

| Measurement | Recorded | Re-measured here | Command |
|---|---|---|---|
| `WorkflowCanvas.tsx` G-5 diff cap (≤15 ins / ≤4 del over the WHOLE phase) | 13 / 2 | **13 / 2** ✅ | `git diff --numstat 9d3d887d..HEAD -- frontend/src/components/workflows/WorkflowCanvas.tsx` |
| Dependency-file churn (T-188-SC) | zero | **zero** ✅ — no `package.json`, lockfile, `pyproject.toml`, `requirements*.txt` touched | `git diff --numstat 9d3d887d..HEAD -- <dep globs>` |
| Frontend count gate (fences that RUN and are PINNED) | 2462 / 45 files | **2462 pinned · 2462 actual · 0 failing · 45/45 present** ✅ | `node scripts/vitest-count-gate.cjs` |
| Backend gate suites | passing | **20 passed** ✅ | `pytest tests/test_revert_byte_identical.py tests/test_182_canvas_gate.py tests/test_188_workflow_run_read.py` |
| Deploy-artifact drift (T-188-SC, 188-12 clause) | PASS | **RESULT: PASS**, exit 0 ✅ | `bash scripts/check-deploy-drift.sh` |
| Migrations shipped | zero | **zero** ✅ | `git diff --name-only 9d3d887d..HEAD -- supabase/` → empty |

**The TARGETS/BASELINE two-knob check was applied to every test-fenced mitigation.** All ten
suites this phase relies on as fences are inside `scripts/vitest-count-gate.cjs` `TARGETS`
(they RUN) *and* inside `BASELINE` (they are PINNED at their measured actual):
`PhaseReconcile.test.tsx` 19 · `PhaseTimeline.test.tsx` 8 · `phaseState.test.ts` 34 ·
`WorkflowRunPage.test.tsx` 87 · `ChatLayout.launch.test.tsx` 17 · `WorkspacePanel.test.tsx` 41 ·
`PhaseNodeCard.test.tsx` 105 · `PhaseNode.test.tsx` 25 · `WorkflowCanvas.test.tsx` 46 ·
`revertByteIdentical.test.tsx` 7. `BASELINE_TOTAL` now **equals** the measured total, so the
gate carries zero slack — a deleted guard is a `[count-decrease]`, not a silent pass.

---

## Threat verification — all 46

| Threat ID | Category | Disposition | Status | Evidence |
|---|---|---|---|---|
| T-188-01-01 | Tampering | mitigate | CLOSED | `scripts/vitest-count-gate.cjs:439-440,456,483,510` (TARGETS entries) + `:309-320` (BASELINE pins); gate run here: 45/45 present, 0 failing, zero slack |
| T-188-01-02 | Repudiation | mitigate | CLOSED | `188-VALIDATION.md:51-105` — pre-edit baselines measured at `db086240` (tsc 33 · backend `tests/` 211 failed / 3296 passed), incl. the 62-vs-211 scope-confusion correction |
| T-188-02-01 | Spoofing of outcome | mitigate | CLOSED | `StreamsProvider.tsx:2843-2849` — sweep predicate is `running \| retrying`; `pending` no longer swept to `done`. Fenced `PhaseReconcile.test.tsx:240,267,293` (skip fixture + 2 positive controls) |
| T-188-02-02 | Spoofing of outcome | mitigate | CLOSED | `StreamsProvider.tsx:3464` `status: phaseStatusFromDb(r.status)`; fallback is `unknown`. Fenced `PhaseReconcile.test.tsx:353,366` |
| T-188-02-03 | Info disclosure | accept | CLOSED | `PhaseCard.tsx:89` — `unknown: { glyph: "?", text: "Unknown", … }`, fixed literals only; zero interpolation. `Phase.error` not rendered by this plan |
| T-188-IDOR | Info disclosure | mitigate | CLOSED | `workflow_runs.py:190-200` — `.eq("id")` AND `.eq("user_id")` on ONE `.maybe_single()` select → 404, never 403/200-empty; user-JWT client (`:177`). Fenced `test_188_workflow_run_read.py:253,277` (foreign ≡ missing, status AND body) |
| T-188-ROUTE-DISCLOSE | Info disclosure | mitigate | CLOSED (strengthened by CR-04) | `workflow_runs.py:163` — `dependencies=[Depends(require_canvas())]` ALONE (no `require_visible` anywhere in the file); flag resolved before auth at `dependencies.py:669-674`. Routing-layer channels closed at `canvas_gate.py:115-117,192-196` + `main.py:636`. Fenced `test_revert_byte_identical.py:180-287` |
| T-188-OPENAPI | Info disclosure | mitigate | CLOSED | `canvas_gate.py:91` — template in `CANVAS_GATED_PATHS`, added in the router's mount commit (`7dedc9d0`). Exact-set fence `test_182_canvas_gate.py:340`; literals kept test-local, mechanically, at `:372-399` |
| T-188-STALE-FLAG | EoP | accept | CLOSED (rationale drifted — see RD-3) | `dependencies.py:669` `await ensure_settings_fresh()` inside `require_canvas`; **and now also** `canvas_gate.py:218-219` since CR-04 made `_is_canvas_path` match the template. Staleness bound now held twice |
| T-188-BLOCKING-IO | DoS | mitigate | CLOSED | `workflow_runs.py:190,205,215` — all three Supabase calls go through `aexec(...)`; zero bare blocking calls in the async handler |
| T-188-04-01 | Tampering of meaning | mitigate | CLOSED (shape changed by CR-06/F2 — see below) | `StreamsProvider.tsx:3420-3425` — overlay carries `slug` + `phaseType`; status is never overlaid wholesale. Floor guard `PhaseReconcile.test.tsx:537` survives, joined by `:660-719` (CR-06) and `:769,782` (F2) |
| T-188-04-02 | Info disclosure / XSS | accept | CLOSED | Zero `dangerouslySetInnerHTML` / `innerHTML` in `PhaseCard.tsx`; slug + phase_type render as plain React text children; no new render site created |
| T-188-05-01 | Spoofing of outcome | mitigate | CLOSED | `lib/phaseState.ts:76-79` — `Object.prototype.hasOwnProperty.call` guard then map; `unknown` on every unmapped key. Totality (incl. `constructor`/`__proto__`) asserted in `phaseState.test.ts` (34, pinned) |
| T-188-05-02 | Tampering | mitigate | CLOSED | `phaseState.test.ts:346-370+` — `?raw` source fence: exactly one import (the types module), one declaration each, no provider/component import; positive controls at `:361,370` |
| T-188-05-03 | Info disclosure | accept | CLOSED | `lib/phaseState.ts` holds zero user-facing words, glyphs, colours or classes — pure data-to-data; enforced by the no-vocabulary grep in the suite |
| T-188-06-01 | Tampering (⛨ seal) | mitigate | CLOSED (and a live gap was found and fixed by F7 — see below) | `PhaseNodeCard.test.tsx:1113-1140` — BYTE-IDENTICAL seal across ALL SEVEN readings incl. `unknown`; seal block byte-unchanged |
| T-188-06-02 | Info disclosure (run line) | mitigate | CLOSED | `PhaseNodeCard.tsx:496` renders `runReadingLabel(reading, emitFailure)`; `runVocabulary.ts:128-141,170-192` compose only fixed constants keyed off the typed `EmitFailure` enum. Zero `.error` references in the whole canvas tree |
| T-188-06-03 | Tampering / XSS | accept | CLOSED | House fence `PhaseNodeCard.test.tsx:422-423` — assembled needle + positive control; zero raw-HTML sinks in the canvas tree |
| T-188-06-04 | DoS (usability) | mitigate | CLOSED | `index.css:251-253` — the single `ringspin` keyframe is applied only inside `@media (prefers-reduced-motion: no-preference)`; static arc coverage carries the reading when motion is suppressed |
| T-188-07-01 | Tampering (scope creep) | mitigate | CLOSED — **MEASURED** | `git diff --numstat 9d3d887d..HEAD` = **13 ins / 2 del** vs cap 15/4. Plus `WorkflowCanvas.test.tsx:640,646,668,680` — no reading words, type-only vocabulary import, no derivation import, no step ordinal in code |
| T-188-07-02 | Info disclosure | mitigate | CLOSED | `WorkflowCanvas.test.tsx:307-317` — no slug on any node face with ⌥ off; `:668-678` — zero ordinal in stripped code, prose count pinned at 1. Needles assembled from parts |
| T-188-07-03 | Tampering / XSS | accept | CLOSED | `WorkflowCanvas.tsx:952` — `ariaLabel` set as a string property on a node object, rendered by React Flow as an attribute; `run.label` is the closed-set `runReadingLabel` output |
| T-188-08-01 | Tampering / XSS | mitigate | CLOSED | `WorkflowRunPage.test.tsx:1293-1301` — assembled `dangerously`+`SetInnerHTML` needle over `?raw` source, with positive control. Zero raw-HTML sinks in `WorkflowRunPage.tsx` |
| T-188-08-02 | Spoofing of outcome | mitigate | CLOSED | `WorkflowRunPage.tsx:265-306` — TOTAL `switch` with `default:` → *"State unknown — this run reported a state we don't recognise."*, never *Complete*. Written as a switch (not an indexed literal) precisely to stay total over inherited keys |
| T-188-08-03 | Info disclosure (⌥ reveal) | accept | CLOSED | `WorkflowRunPage.tsx:899-906` — the reveal prints `claimed_at` / `created_at` / `updated_at` of a run the caller already owns; access control is the route's ownership gate (T-188-IDOR) |
| T-188-08-04 | DoS (assistive) | mitigate | CLOSED | `WorkflowRunPage.tsx:915-927` — `aria-live="polite"` region carries `band.sentence` ONLY; the ticking number lives in an `aria-hidden="true"` sibling. Per-node transitions are never announced; `role="alert"` fires once (`:929-932`, `ALERTING_STATUSES` `:311`) |
| T-188-08-05 | EoP (client gating) | accept | CLOSED — **RATIONALE DRIFT (RD-1)** | Risk still owned server-side: `workflow_runs.py:163` + `canvas_gate.py`. But the stated rationale ("the page performs NO flag check") is FALSE as shipped — see RD-1 |
| T-188-09-01 | Spoofing of identity | mitigate | CLOSED | `ChatLayout.tsx:346-350` — resolves `getThreadWorkflow(thread.id).then(wf => wf.active_workflow_run_id)`; `PostMessageResponse.run_id` is never referenced in `doRun`. Fenced in `ChatLayout.launch.test.tsx` (17, pinned) |
| T-188-09-02 | DoS / data loss | mitigate | CLOSED | `ChatLayout.tsx:288-297` — `deleteLaunchThread(thread.id)` in the catch, original error re-thrown, navigation reached only on success |
| T-188-09-03 | Info disclosure | accept | CLOSED | Authorisation is server-side (T-188-IDOR 404); a tampered id renders `WorkflowRunPage.tsx:104-105` *"That run isn't available."* |
| T-188-09-04 | EoP (client gating) | accept | CLOSED — **RATIONALE DRIFT (RD-1)** | Same as T-188-08-05 |
| T-188-10-01 | Info disclosure | mitigate | CLOSED | Two independent ownership checks: `workspace.py:322` (list) and `:454` (raw download) both call `_verify_thread_ownership` → 404, with RLS on top; the `thread_id` comes from the already-gated `GET /workflow-runs/{id}`. No new endpoint, no widened scope (`workspace.py` untouched by this phase) |
| T-188-10-02 | Tampering / XSS | mitigate | CLOSED | `WorkflowRunPage.tsx:975-1016` — filenames as React text children and `title=` values; `onDownload(file)` receives the object, never interpolated markup |
| T-188-10-03 | Spoofing of completeness | mitigate | CLOSED | `WorkflowRunPage.tsx:742-749` — `reconcileFiles()` in an effect gated on `isTerminal`, keyed on `run.thread_id`, firing once on the terminal transition |
| T-188-10-04 | Info disclosure | mitigate | CLOSED | `WorkspacePanel.tsx:382` — `{showTimeline && <RunSeam …/>}`; `RunSeam` additionally returns `null` without both `onOpenRun` and `runId` (`:234`). A Deep / no-run thread renders nothing new |
| T-188-11-01 | Spoofing of evidence | mitigate | CLOSED | `sc10_188_run_board.py:280-310` — `override_provider` probed BEFORE any row is driven; `:437-447` — `runs.provider` read back, `effective_providers != [pid]` → ⛔ `SC10-188-MISROUTE`, never a pass |
| T-188-11-02 | Tampering (operator settings) | mitigate | CLOSED | Rows driven with per-request `provider` on `POST /threads/{id}/messages` (`conc_probe.py:312-338`). Zero write operations in the board script — no UPDATE/INSERT/DELETE/commit/save_/put/patch |
| T-188-11-03 | Info disclosure (secrets) | mitigate | CLOSED | `sc10_188_run_board.py:306` — `api_key={'present' if has_key else 'MISSING'}`. The token `api_key` appears exactly three times in the file: twice in prose, once as this literal. No value, prefix or length is ever printed |
| T-188-11-04 | Repudiation | mitigate | CLOSED | `sc10_188_run_board.py:576-611` — every roster entry appends a row on EVERY branch (`_blocked_row` for not-driven / no-key / kickoff-refused, `drive_row` otherwise). Silent omission is unreachable |
| T-188-12-01 | Tampering (test estate) | mitigate | CLOSED | Gate run here: 45/45 pinned files present, `total 2462 == pinned total 2462` — zero slack. `[count-decrease]` observed live at `188-VALIDATION.md:193` (`total 2420 < pinned 2421`), so the pin is proven to bite |
| T-188-12-02 | Repudiation | mitigate | CLOSED | `188-VALIDATION.md:253-320` — failure set DIFFED against the Plan-01 baseline (211 → 211, Δ 0), with a 70-file name-level fingerprint summing to 211. No rollback run offered as evidence |
| T-188-12-03 | Tampering (G-5 cap) | mitigate | CLOSED — **MEASURED** | Cap measured over the whole `9d3d887d..HEAD` range, not one commit: 13/2. `188-VALIDATION.md:161` records identical numstat from both bases |
| T-188-13-01 | Spoofing of evidence | mitigate | CLOSED | Key probe re-run at gate time (8/8 present, `188-UAT.md:384`); effective provider read back; mismatch → ⛔ (see T-188-11-01) |
| T-188-13-02 | Repudiation | mitigate | CLOSED | `188-UAT.md` frontmatter: `rows_blocked: 1`, `rows_pending: 0`, 16 PASS / 0 FAIL. Each row carries a run id. The one ⛔ (row 6 `minimax`) carries reason + blocking id `SC10-188-RUN`. The `[pending]` table at `:258-265` is an explicitly superseded gate-open snapshot (`:43-47`) |
| T-188-13-03 | Info disclosure | mitigate | CLOSED | Same evidence as T-188-11-03 — `--derive-only` prints presence only |
| T-188-SC | Tampering (supply chain) | accept | CLOSED — **MEASURED** | Zero churn on `package.json`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `pyproject.toml`, `requirements*.txt`, `poetry.lock`, `Cargo.*` over the whole phase range. `check-deploy-drift.sh` → PASS (exit 0). Zero migrations |

---

## Priority escalations — the 13 un-threat-modelled post-plan commits

### CR-04 (`cb7a793f`) — the 405/307 existence leak. **CLOSED, and the fix is complete.**

This was a REAL information-disclosure defect under `T-188-ROUTE-DISCLOSE` that the plan-time
mitigation did not catch: `require_canvas` is a *dependency*, and Starlette answers a
wrong-method probe (405) and a trailing-slash probe (307) during **routing**, before
`solve_dependencies` runs. Measured with the flag off, pre-fix:
`POST /workflow-runs/<uuid>` → **405** `{"detail":"Method Not Allowed"}` while the
genuinely-unbuilt `POST /workflow-runs/x/y` → 404. A 405 admits a handler is declared at that
exact path.

Verified complete as shipped:

* `canvas_gate.py:96-117` — templated members are compiled once to **fully anchored,
  segment-bounded** regexes (`{param}` → `[^/]+`, every literal `re.escape`-d), so
  `/workflow-runs/x/y` still 404s as an unbuilt path and a future member containing a regex
  metacharacter cannot widen the match.
* `canvas_gate.py:192-196` — `_is_canvas_path` normalises one trailing slash, then frozenset,
  then patterns.
* `canvas_gate.py:221-233` — the gate is **path-only, never method-aware**, and returns
  `JSONResponse(404, {"detail": "Not Found"})` with no custom message, no extra headers, no
  `WWW-Authenticate`, no `Allow`.
* `main.py:636` — registered FIRST, therefore **innermost**: it runs before Starlette routing
  and before any dependency (so before auth), and after Setup/Maintenance so an unbuilt path
  still answers 503 where an unbuilt path would.
* `test_revert_byte_identical.py:215-287` — anonymous / bogus-token / end-user / injected-operator
  all fold into the same 404 body; the wrong-method probe and the `follow_redirects=False`
  trailing-slash probe are each asserted **byte-equal to the genuinely-unbuilt path's answer**,
  not merely `== 404`; a positive control proves the template really is mounted with the probed
  method, so the 404 is the gate and not an absent route. 20/20 backend tests pass here.

`PUT` / `DELETE` are not probed by name. This is acceptable: the gate matches on path with no
reference to `scope["method"]`, so `POST` is representative of every method by construction.

### CR-06 (`50c534cf`) + F2 (`d2070136`) — the forward-only floor. **T-188-04-01 still CLOSED, shape changed.**

The registered mitigation read "the overlay is IDENTITY ONLY … overlaying status would let a
lagging DB row move the counter backward." As shipped, status *is* partly derived from the DB
row (`StreamsProvider.tsx:3391-3418`) — but strictly in the fail-**closed** direction:

* `resolved` (`:3396`) — a row the engine already resolved (`done`/`failed`/`skipped`/`unknown`)
  wins over the positional value, so a skipped step is never painted Complete or Running;
* `floored` (`:3418`) — an *unresolved* (`pending`/`active`) row before the cursor keeps its DB
  reading instead of being upgraded to `done`, which is F2's fix: success may never be inferred
  from the absence of an event.

The declared mechanical fence survived and grew: the all-`pending` floor guard is still at
`PhaseReconcile.test.tsx:537`, joined by five CR-06 cases (`:660-719`) and two F2
cross-branch-agreement cases (`:769,782`). Net effect is a strengthening, not an erosion.

### F7 (`c50e93f4`) — the governance seal never rendered on the run surface. **T-188-06-01 CLOSED, but note what this means.**

`T-188-06-01`'s mitigation was framed entirely as an *invariance* property inside
`PhaseNodeCard` — "the seal block is byte-unchanged … the byte-identical render guard is widened
from four run states to seven." That property held throughout, and is verified
(`PhaseNodeCard.test.tsx:1113-1140`). But for the whole phase up to `c50e93f4`, **the seal did
not render on the new run surface at all**: `WorkflowRunPage` passed no `kbTools` prop, so
`toCanvas` intersected `available_tools` against the frozen empty `NO_KB_TOOLS` and the dominant
`detected` grounding cause could never resolve. The governance claim was absent, not wrong.

This is a lesson for the register rather than an open threat: an invariance fence on a shared
component proves nothing about whether the component's security-relevant output is *reachable*
on a newly-built surface. The fix (`WorkflowRunPage.tsx:441+`, fenced at
`WorkflowRunPage.test.tsx:1596-1618`) reads the server's kb-tool list via `useGroundingBundle`
and asserts the page never authors its own whitelist (R11), with a positive control.

### CR-01 / CR-02 / CR-03 / F1 / F3–F6 — no mitigated threat altered.

* CR-01 (`f13fdb3a`) polls the already-registered `GET /workflow-runs/{id}` (`RUN_POLL_MS` 5000,
  `WorkflowRunPage.tsx:314,713`). No new surface.
* CR-02 (`29e2d042`) calls the shipped `useStreamActions().reconcile(threadId)` — an existing
  thread-scoped, server-ownership-gated reconnect. No new endpoint.
* CR-03 (`fa8f73a2`) adds a wire field — see UF-1 below.
* F1/F3/F4/F5/F6 are reducer, anchor, copy and tick-gate fixes with no security surface.

---

## Rationale drift — the accepted rationale no longer describes shipped code

A rationale-drift finding is **not** an open threat: in all three cases the residual risk is
unchanged or reduced. It is recorded because an accepted-risk log that describes *planned* code
teaches the next reader something false about the product.

### RD-1 — `T-188-08-05` and `T-188-09-04`: the client-side flag gate now exists.

**Accepted rationale (both plans):** *"The page performs NO flag check … No flag check is added
on the client; client gating would be a D-14 / D-181-02 red-line violation."*

**As shipped (`bce384ef`, CR-05):** a client-side flag check exists in three places —

* `ChatLayout.tsx:248-249` — `const canvasEnabled = featuresCtx?.features.visual_workflow_canvas === true`
* `ChatLayout.tsx:346-350` — `doRun` consults it BEFORE the run-anchor read
* `ChatLayout.tsx:752` — the render branch carries `&& canvasEnabled`
* `ChatLayout.tsx:678-682` — the panel receipt's `onOpenRun` callback is withheld while off

**Is the risk still acceptable? YES — this is defence in depth, not a substitute.** The server
boundary is intact and independently verified above (`workflow_runs.py:163` `require_canvas()`
alone + `canvas_gate.py` middleware + the OpenAPI filter). The client gate is **fail-closed**:
strict `=== true`, and a null features context (no provider) reads as HIDDEN. Nothing was moved
from the server to the client.

**But the cited red line does not say what the plans said it says, and that part should be
corrected rather than carried forward.** Read at source:

* **D-181-02** (`181-CONTEXT.md:42`, `181-01-PLAN.md:23`) = *"Canvas routes refuse with 404, never
  403; fail-closed to `off` on any cold-cache/DB error."* It is about **refusal polarity**. It
  says nothing about client-side gating.
* **D-14** (`188-SPEC.md:190,199`) = *"the canvas is a projection, never a second source of truth
  and never a second runtime; runs stay thread-backed."* It is about **run-state derivation**. It
  says nothing about feature-flag gating.

Neither decision forbids a client feature-flag gate, and `WorkflowBuilderPage` already gated its
canvas on the *identical* expression before this phase — a shipped precedent that predates the
plan. So the acceptance rested on a misreading at authoring time, and that misreading produced a
real defect the review had to catch: with the flag off, a launch landed on a surface the
pre-canvas product never had, 404'd on its own read, and reported the operator's kill switch as
*"It may have been deleted, or it belongs to another account"* — both stated reasons false — while
`doRun` had not selected the thread, leaving the live run unreachable in exactly the state the
kill switch exists to make safest.

**Corrected accepted-risk wording for the log:**

> **T-188-08-05 / T-188-09-04 (EoP — client-side gating) — ACCEPTED.** The run home IS gated on
> `visual_workflow_canvas` on the client, at both doors (`doRun` navigation, panel-receipt
> callback) and at the render branch, fail-closed on a null features context
> (`ChatLayout.tsx:248-249,346-350,678-682,752`). This is **defence in depth on top of** the
> authoritative server boundary — `require_canvas()` on `GET /workflow-runs/{id}` plus the
> pre-routing `CanvasGateMiddleware` and the OpenAPI filter — never a substitute for it. It exists
> to satisfy REVERT-01 byte-identity at the LAYOUT level (a fourth home is distinguishable from a
> product where the canvas was never built), which is a *different* requirement from
> non-discoverability. Neither D-14 nor D-181-02 forbids this; the plan-time claim that they did
> was a misattribution.

**Residual worth naming:** `WorkflowRunPage.tsx` itself carries **no** flag check (verified: zero
`visual_workflow_canvas` / `EffectiveFeatures` references in the file). Its single mount site is
`ChatLayout.tsx:790`, and the app has no router, so the layout gate is currently total. Any future
second mount point inherits no gate. This is an acceptable design today; it is a landmine for the
next phase that mounts this page.

### RD-2 — `T-188-ROUTE-DISCLOSE`: a stale inline comment now contradicts the shipped gate.

The module docblock in `canvas_gate.py` was correctly rewritten by CR-04 (`:76-84` explicitly
labels the old claim FALSE). But two sites still assert the pre-CR-04 model:

* `canvas_gate.py:89-90` — *"TEMPLATE form: OpenAPI-half only (see the asymmetry note above); its
  request-path 404 comes from require_canvas."* This is now false; the request-path 404 comes from
  the middleware.
* `test_revert_byte_identical.py:186-192` — the same claim in the test docblock, immediately above
  the CR-04 assertions that disprove it.

No security impact — the code is correct. But this codebase's own rule is that *"a comment that
still names a shape the code no longer has is the same defect as a false docblock"*
(`canvas_gate.py:66-67`), and this is that defect, twice, in the file that states the rule.

### RD-3 — `T-188-STALE-FLAG`: the accepted rationale describes pre-CR-04 code.

**Accepted rationale:** *"`_is_canvas_path` does exact-set membership on the REQUEST path, so
`/workflow-runs/<uuid>` skips the middleware's `_ensure_flag_fresh()` pre-refresh — but
`require_canvas` awaits `ensure_settings_fresh()` itself as its step (0), so the staleness bound
still holds."*

**As shipped:** the first half is no longer true. CR-04 made `_is_canvas_path` match the template
(`canvas_gate.py:115-117,196`), so the path now **does** hit `_ensure_flag_fresh()` at
`canvas_gate.py:218-219`. The bound is held twice, at both layers. Drift in the safer direction;
the risk decision is unaffected. Reword to state the current mechanism.

---

## Unregistered flags (WARNING — not blockers under `block_on: high`)

All thirteen `## Threat Flags` sections claim "None." That was true **as of each plan's own
commit**. It was not re-run after the 13 post-plan fix commits, and five items of new or
newly-visible surface carry no threat mapping.

### UF-1 — `last_workflow_run_id` added to a NON-canvas-gated endpoint (CR-03, `fa8f73a2`)

`backend/app/models/thread.py:101-115` adds `last_workflow_run_id: UUID | None` to
`ThreadWorkflowState`, populated at `backend/app/api/threads.py:1261-1271`. This ships on
`GET /threads/{id}/workflow` — which is **not** in `CANVAS_GATED_PATHS`. So with
`visual_workflow_canvas` OFF, an owner can still learn that a `workflow_runs` row exists for their
thread and obtain its id, even though `GET /workflow-runs/{id}` is a 404.

**Assessed low.** The endpoint is ownership-gated, the id disclosed is the caller's own, and the
sibling fields `latest_producer_run_id` and `phases` already disclosed workflow-run existence
through this endpoint before Phase 188 — so no *new class* of information crosses the boundary.
It is nonetheless net-new wire surface added after the register closed, on the one endpoint whose
un-gated status CR-05's own commit message calls out as load-bearing (*"`getThreadWorkflow` is NOT
canvas-gated"*). Register it in the next phase touching this file.

### UF-2 — WR-04 (deferred): unguarded prototype-key lookups, one reaching a CSS sink

**Verified still present as shipped**, all five sites:

| Site | Expression |
|---|---|
| `PhaseNode.tsx:149` | `ICON_TINT[data.phaseType] ?? DEFAULT_TINT` |
| `PhaseCard.tsx:53` | `PHASE_TYPE_LABEL[phaseType] ?? UNKNOWN_PHASE_META` |
| `PhaseCard.tsx:257` | `STATUS_META[phase.status]` |
| `PhaseNodeCard.tsx:396` | `VERDICT_MARK[verdict] ?? VERDICT_MARK.unknown` |
| `PhaseNodeCard.tsx:689` | `RING_STROKE[reading]` |

The first one's result is then **string-interpolated into CSS** at `PhaseNodeCard.tsx:738`:
`` background: `radial-gradient(circle, ${tint}, transparent 68%)` ``. A prototype key
(`constructor`, `toString`, `__proto__`) yields a *function*, not a nullish value, so the `??`
never fires — the exact failure mode this phase measured and closed one file away in
`phaseState.ts:65-79` (observed value: `[Function Object]`).

This is a security finding filed under a non-security label. It is deferred correctly on
*reachability* — `phase_type` is `Literal[...]`-validated server-side today — but that is verbatim
the argument `phaseState.ts:73-74` explicitly rejects: *"totality is a property of the function,
not of its current callers."* The phase built `own()` (`runVocabulary.ts:84-88`) for precisely this
and did not apply it to its own siblings. **Route all five through `own()` / `Object.hasOwn` in the
next phase touching these files**, and correct the two docblocks that currently claim a totality
the expression does not provide.

### UF-3 — WR-07 (deferred): `getWorkflowRun` interpolates the run id unencoded

**Verified still present:** `frontend/src/lib/api.ts:3751` —
`` fetch(`${API_BASE}/workflow-runs/${runId}`, { headers, signal }) ``. No `encodeURIComponent`.
The helper is **exported** and `runId` is a plain `string`, so a value containing `/`, `?` or `#`
reshapes the request path. Today's only caller (`WorkflowRunPage.tsx:333`) sources the id from our
own state via `ChatLayout`'s `activeRunId`, which is why this is low and not high — but the
mitigation is one function call and the surface is public. Fix: `encodeURIComponent(runId)`.

### UF-4 — WR-03 (deferred): navigation proceeds after a failed thread lookup

`ChatLayout.tsx:754-758` — when the run's thread is absent from the loaded list, `selectThread`
is skipped but `onNavigate("chat")` still fires, landing the user in **whatever thread was
previously selected** while believing it is the run's. Confidentiality-adjacent (shows a different
conversation than the one requested) rather than an access-control failure — the other thread is
still the user's own. Worth closing next phase.

### UF-5 — process gap: `188-01-SUMMARY.md` has no `## Threat Flags` section

Twelve of thirteen summaries carry the section. `188-01-SUMMARY.md` omits it entirely. No
substantive impact — plan 01 is CI-tooling only — but the omission means the section's absence
cannot be distinguished from a "None" that was never considered.

### Not security findings

WR-02 (the `canvas_caller` double-auth saving is defeated by `get_user_supabase_client`'s own
`Depends(get_current_user)`) is a **performance and docblock-accuracy** issue: the route pays 2
GoTrue round-trips and 2 ban queries instead of 1. Authorisation is unaffected — if anything the
resolver runs *more*, not less. WR-01, WR-05, WR-06, WR-08, WR-09 and WR-10 are correctness and
a11y findings with no security dimension.

---

## Accepted risks log

| ID | Risk | Why accepted | Re-open trigger |
|---|---|---|---|
| T-188-SC | A malicious dependency enters via this phase | Zero packages installed; measured — no manifest or lockfile touched over `9d3d887d..HEAD`; `check-deploy-drift.sh` PASS | Any dependency added by a phase touching this surface |
| T-188-02-03 | `STATUS_META["unknown"]` reflects a server string | It does not: `PhaseCard.tsx:89` is a fixed literal with no interpolation | A server-supplied string is interpolated into any `STATUS_META` value |
| T-188-04-02 | XSS via overlaid `slug` / `phase_type` | Plain React text children through the shipped `PhaseCard`; no new render site; same strings the terminal branch already surfaced | Any raw-HTML sink appears in the panel tree |
| T-188-05-03 | Vocabulary leaks into the shared derivation | `lib/phaseState.ts` holds zero words/glyphs/colours; enforced by grep in a pinned suite | The no-vocabulary grep is deleted or the module gains a user-facing string |
| T-188-06-03 | XSS via authored title/subtitle | House fence `PhaseNodeCard.test.tsx:422-423` with positive control; zero sinks | The assembled-needle fence is removed |
| T-188-07-03 | XSS via `ariaLabel` | Set as a string property on a node object; React Flow renders it as an attribute; `run.label` is a closed set | `ariaLabel` ever composes a free-text server field |
| T-188-08-03 | ⌥ reveal discloses run internals | Only `claimed_at` / `created_at` / `updated_at` of a run the caller already owns; access control is the route's ownership gate | The reveal grows a field that is not a timestamp of the owned run |
| T-188-08-05 / T-188-09-04 | Client-side gating relied on for access control | **See RD-1 for the corrected wording.** A fail-closed client gate now exists as defence in depth; the authoritative boundary remains `require_canvas()` + `CanvasGateMiddleware` + the OpenAPI filter | Any access decision moves to the client with no server counterpart; or `WorkflowRunPage` acquires a second mount point outside `ChatLayout`'s gate |
| T-188-09-03 | Run surface reached with someone else's run id | Addressing is client-side, authorisation is not: the route 404s (T-188-IDOR); the surface renders *"That run isn't available."* | The route's ownership SELECT is split into two queries or the 404 becomes a 403 |
| T-188-STALE-FLAG | A stale per-worker flag cache enforces a pre-flip audience | **See RD-3.** Bounded at BOTH layers now: `canvas_gate.py:218-219` and `dependencies.py:669`. No module-level cache on the new route | `ensure_settings_fresh` is removed from either layer |

---

## Verdict

**SECURED — 46/46 threats closed, 0 open.**

Every declared mitigation was located in shipped code with a `file:line` citation; every accepted
risk was evaluated against shipped code rather than against its plan. The two priority escalations
resolve as: **CR-04 is a complete fix** to a genuine plan-time miss, and **CR-05 is a
rationale-drift, not a red-line violation** — the risk decision stands, the words describing it do
not.

Carried forward as WARNINGs, none blocking under `block_on: high`: five unregistered-surface items
(UF-1 … UF-5), of which **UF-2 (prototype-key lookup reaching a CSS interpolation) and UF-3
(unencoded id interpolation in an exported fetch helper) are security findings deferred under a
non-security label** and should be registered explicitly in the next phase that touches those
files, rather than left in the review's warning list.
