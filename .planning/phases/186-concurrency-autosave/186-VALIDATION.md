---
phase: 186
slug: concurrency-autosave
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-01
---

# Phase 186 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `186-RESEARCH.md` § "Validation Architecture" (measured by execution 2026-08-01).

---

## Test Infrastructure

| Property | Backend | Frontend |
|----------|---------|----------|
| **Framework** | pytest, `asyncio_mode = auto` | vitest 4.1.0 + jsdom |
| **Config file** | `backend/pytest.ini` (`testpaths = tests`) | `frontend/vitest.config.ts` (excludes `tests/e2e/**`) |
| **Quick run command** | `cd backend && ./venv/Scripts/python.exe -m pytest tests/unit/<file> -x -q` | `cd frontend && npx vitest run <files>` |
| **Full suite command** | `cd backend && ./venv/Scripts/python.exe -m pytest -q` | `cd frontend && npx vitest run` |
| **Measured baseline** | **3457 tests collected** (`--collect-only -q`, 5.22 s) | **209 passing** across the 7 builder-related files (30.9 s) |
| **Estimated runtime** | ~5 s collect / full suite per run | ~31 s (builder subset) |
| **E2E** | — | Playwright `frontend/tests/e2e/`. **Known rot 16/17 fail (SEED-049) — NOT a backstop for this phase.** |

The 209-test frontend baseline covers: `WorkflowBuilderPage.test.tsx`,
`WorkflowBuilderPage.session.test.tsx`, `WorkflowBuilderPage.header.test.tsx`,
`WorkflowBuilderPage.canvas.test.tsx`, `lib/api.workflows.test.ts`,
`components/workflows/PublishGauntlet.test.tsx`, `components/workflows/builderStore.test.ts`.

> **Guard the COUNT, not just the failures (the Phase 177 lesson).** Two changes in this phase
> delete assertions if handled carelessly: retiring `saveState` (`builderStore.test.ts:337`) and
> reshaping the published-409 detail (`test_103_published_409.py`). Record before/after counts for
> **both** suites and treat a decrease as a failure. Repo-wide frontend rot (~14–17 pre-existing
> failures, SEED-056) is why the 209 figure is a **clean subset** — that is what makes it usable.

---

## Sampling Rate

- **After every task commit:** the touched file's suite —
  `npx vitest run src/hooks/useDraftPersistence.test.tsx` (< 30 s) or
  `./venv/Scripts/python.exe -m pytest tests/unit/test_186_*.py -x -q` (< 30 s)
- **After every plan wave:** `npx vitest run` (frontend, full) **+** `pytest -q` (backend, full),
  with **counts** compared against the 3457 / 209 baselines
- **Before `/gsd:verify-work`:** both full suites green **and** counts non-decreasing
- **Max feedback latency:** 30 seconds

---

## Falsification-First Guards (G-6)

Each guard has a **RED** state that must be observed failing before the fix and passing after.
The Phase 185 lesson is binding: *verify the PROPERTY, not the PATCH; observe falsification RED first.*

| # | Guard | RED (must FAIL before) | GREEN (must PASS after) | Where |
|---|-------|------------------------|-------------------------|-------|
| F1 | Stale PATCH refused | Second write lands; first writer's content lost | Second write matches 0 rows; winner's content survives | `backend/tests/unit/test_186_concurrent_patch.py` (live :54322) |
| F2 | Stale ≠ 404 | Stale PATCH returns 404 "draft not found" | 409 with `detail.code == "stale_token"` | same file |
| F3 | 404-collapse still closed | Foreign draft id returns ≠404 or leaks status | Foreign + unknown id both 404, identical detail | same file |
| F4 | Published 409 unchanged | (regression) | Published-row PATCH still 409, `detail.code == "already_published"` | `test_103_published_409.py` (updated, **not** replaced) |
| F5 | Publish race refused | Edit mid-gauntlet ⇒ publish succeeds, ships unchecked definition | `publish_definition` returns `-2`; `blocked_stage == "draft_changed"`; row still `draft` | `backend/tests/unit/test_186_publish_race.py` |
| F6 | Golden-run receipt preserved | `harness_audit` golden-run rows absent after refusal | `judge_verdict` + run rows survive; `publish_blocked` receipt added | same file |
| F7 | **Unknown stage never renders green** | A bogus `blocked_stage` renders **8 ✓ badges** | Zero ✓ badges; headline contains no raw code | `PublishGauntlet.test.tsx` |
| F8 | Never a false `Saved ✓` | A 422 PATCH still shows `Saved · still a draft` | Shows `Not saved — …`; `dirty` stays true | `useDraftPersistence.test.tsx` |
| F9 | Single-flight | Two overlapping edits issue two concurrent PATCHes | ≤ 1 outstanding PATCH; second carries the token returned by the first | `useDraftPersistence.test.tsx` |
| F10 | Conflict halts writing | After a `stale_token` 409, further edits keep PATCHing (retry storm) | Zero further PATCHes until Reload or Overwrite pressed | `useDraftPersistence.test.tsx` |
| F11 | Hold flushes on release | A held edit is dropped when the hold clears | Exactly one PATCH on release, carrying the latest definition | `useDraftPersistence.test.tsx` |
| F12 | Cosmetic drag writes nothing | A nudge issues a PATCH | **0** network calls (extend the shipped 184-07 zero-call spy) | `WorkflowCanvas.editing.test.tsx` (existing) |
| F13 | No version minted | Autosave increments `version` | `version` byte-identical across N autosaves | F1's file |
| F14 | KB bind arms the guard | Binding leaves `dirty === false` | `dirty === true`; leave guard prompts | `builderStore.test.ts` + `WorkflowBuilderPage.session.test.tsx` |
| F15 | Token never parsed | — (source fence) | `useDraftPersistence.ts` source contains no `new Date` / `Date.parse` | `?raw` fence test (shipped idiom) |
| F16 | Unbound chip is an invitation | Chip emits a severity/code or adds a problems-tray row | Chip renders the consequence sentence; `verdicts` unchanged; tray count unchanged | `WorkflowBuilderPage.header.test.tsx` |

---

## Per-Task Verification Map

> Filled by `gsd-planner` — one row per task, keyed to the F-guards above.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _pending planner_ | | | | — | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Requirements → test map (from research):**

| Req | Behaviour | Type | Automated command | Exists? |
|-----|-----------|------|-------------------|---------|
| CONCUR-01 | Autosave updates in place; no version minted | unit (live DB) | `pytest tests/unit/test_186_concurrent_patch.py -x -q` | ❌ Wave 0 |
| CONCUR-01 | Cosmetic drag = 0 network calls | unit | `npx vitest run src/components/workflows/WorkflowCanvas.editing.test.tsx` | ✅ extend |
| CONCUR-02 | Stale writer refused, honestly | unit (live DB) | same as above | ❌ Wave 0 |
| CONCUR-02 | Client halts + banner, never overwrites | unit | `npx vitest run src/hooks/useDraftPersistence.test.tsx` | ❌ Wave 0 |
| CONCUR-02 | Publish refuses a drifted draft | unit | `pytest tests/unit/test_186_publish_race.py -x -q` | ❌ Wave 0 |
| CONCUR-02 (SC#4) | Two-tab / stale-tab / publish-race, lived | **manual (G-4)** | Chrome, operator-driven — see scoreboard below | ❌ |
| BUG-260731-03 (control) | KB re-bindable from the canvas, all paths | unit + manual | `npx vitest run src/pages/WorkflowBuilderPage.header.test.tsx` + UAT | ❌ Wave 0 |

---

## Wave 0 Requirements

- [ ] `backend/tests/unit/test_186_concurrent_patch.py` — F1/F2/F3/F13. Use the shipped live-DB
      skip-guard (`test_publish_flip.py:28-46`) and the direct-route-call idiom
      (`test_workflows_routes.py:17-21`: call the route fn with a `current_user` dict + a patched
      `get_pg_pool`, no HTTP client).
- [ ] `backend/tests/unit/test_186_publish_race.py` — F5/F6. Same idioms; `publish_definition` is
      exercisable directly without running a real golden run.
- [ ] `frontend/src/hooks/useDraftPersistence.test.tsx` — F8/F9/F10/F11/F15. Mirror
      `useLiveValidation.test.tsx` (fake timers + a spied API module).
- [ ] `PublishGauntlet.test.tsx` — **F7**, the fail-open guard. Highest-value single test in the
      phase; it protects every future `blocked_stage`, not just `draft_changed`.
- [ ] `test_103_published_409.py` — update for the object-shaped detail. **Do not delete.**
- [ ] `builderStore.test.ts` — retarget the `setSaveState` invariant; add F14.

*No framework install needed — existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

**G-4 lived-experience UAT (locked by D-186-13).** Chrome, driven live by the operator.
Wire format + screenshot are **insufficient** per G-4.

| # | Scenario | Requirement | Expected | Status |
|---|----------|-------------|----------|--------|
| 1 | **Two tabs** — same draft open in A and B; edit in A (let it autosave), then edit in B | CONCUR-02 | B shows the honest banner, **stops writing**, offers **Reload** (default) then **Overwrite**. A's content intact. | to run |
| 2 | **Stale tab** — leave B open, edit + save in A, return to B minutes later and type | CONCUR-02 | Same honest outcome. No silent overwrite, no retry storm. | to run |
| 3 | **Publish race** — start a publish in A, edit in B mid-gauntlet | CONCUR-02 / SC#3 | Publish refuses with the worded `draft_changed` verdict; the golden-run receipt still browsable; the spine shows a **block**, **not** 8 green pips. | to run |
| 3b | **Publish hold** — start a publish in A, then edit **in A** | D-186-12 | Status line reads *"Publishing — changes will save when it finishes"*; the edit flushes on resolution. | to run |
| 4 | **Colleague clobber** — a second user PATCHes the same draft | CONCUR-02 (literal) | ⛔ **BLOCKED — not reachable in the product.** UPDATE is `auth.uid() = created_by` at both the RLS layer (`108_rls_membership_rewrite.sql:484-500`) and the service-layer WHERE (`db/workflows.py:415`); mig 111 gave workflows `is_system_global` (a platform flag), **not** `is_org_shared`. Recorded with its reason, **never dropped** — the scoreboard rule. Re-opens if the org-share toggle ships. | ⛔ |
| 5 | **KB re-bind, three paths** — bind/re-bind from (a) NL-generated, (b) forked starter, (c) Tweak fork | BUG-260731-03 | The chip is a picker in all three; the unbound state reads *"No knowledge base · searches everything"* with **no** severity, code, or tray row; the binding persists through autosave and survives a reload. | to run |
| 6 | **Never a false `Saved ✓`** — force a 422 (e.g. mid-edit invalid shape) | D-186-04 | `Not saved — …`; the draft stays dirty; the leave guard fires on navigate-away. | to run |

**On SC#10 scope:** the roadmap scopes **no full cross-provider matrix** for this phase — *"Phase
186 (Concurrency) carries the SC#10 parallel axis (two-editor UAT row) but not full cross-provider
streaming"* (`.planning/ROADMAP.md` §Guardrails firing (v3.6)). Nothing here touches streaming, the
agent loop, or provider routing. **The parallel axis alone requires rows 1–3 above** — two
concurrent editing sessions against one draft, driven live. The 8-provider roster is **not**
required; manufacturing it would be ceremony, not evidence. Row 3 is the parallel axis's sharpest
instance because it crosses a minutes-long server operation.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (6 files above)
- [ ] Every F-guard observed **RED before GREEN** (falsification-first, G-6)
- [ ] Test COUNT recorded before/after for both suites; no decrease (baselines 3457 / 209)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30 s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
