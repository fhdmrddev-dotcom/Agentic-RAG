---
phase: 188
slug: non-technical-run-observability
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-08-05
---

# Phase 188 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `188-RESEARCH.md` §"Validation Architecture" — every number below was **measured at `db086240`**, not inherited.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Frontend: `vitest` + `@testing-library/react` (+ `vitest-axe` where a11y applies) · Backend: `pytest` (`backend/venv`), `TestClient` + `monkeypatch` |
| **Config file** | `frontend/vitest.config.*` — but **the gate** is `scripts/vitest-count-gate.cjs` (two knobs: `TARGETS` = what RUNS, `BASELINE` = what's PINNED) |
| **Quick run command** | `node scripts/vitest-count-gate.cjs` |
| **Full suite command** | `cd frontend && npx vitest run` (⚠ carries pre-existing rot **outside** the gate's blast radius) + `cd backend && ./venv/Scripts/python.exe -m pytest tests/ -q -p no:randomly` |
| **Typecheck** | `cd frontend && npx tsc --noEmit -p tsconfig.app.json` — must stay at **33** errors, NOT 0. The root config checks **zero** files. |
| **Estimated runtime** | count gate ~120 s · typecheck ~30 s · backend canvas/gate suites ~20 s · full backend suite ~6 min |

**Measured baselines that every gate is diffed against (do not re-derive, do not assume):**

| Baseline | Measured value at `db086240` |
|---|---|
| Frontend count gate | **2196 tests / 0 failing / 946 pinned** — green |
| `tsc -p tsconfig.app.json` | **33** pre-existing errors, **0** in `components/workflows` |
| Backend full suite | **211 failed / 3296 passed** (`pytest tests/ -q -p no:randomly`, deterministic across two runs) |

> ⚠ **Scope correction (orchestrator, 2026-08-05).** `188-RESEARCH.md` states that session memory's
> *"~62-red backend suite"* is **REFUTED** by the 211 figure. That framing is a **scope confusion, not
> a refutation**: the 62-red measurement was `pytest tests/unit -q` (62 failed / 1700 passed, Phase 187
> round 5); the 211 figure is `pytest tests/ -q -p no:randomly` over the **whole** `tests/` tree. A
> subset being 62-red and its superset being 211-red are consistent. **Use 211 as the full-suite
> non-attribution baseline** (that part is correct and is what `188-01` records) — but do not conclude
> the `tests/unit` async-mock rot was imagined, and do not cite "REFUTED" in any summary.
| Backend canvas/gate suites | `test_revert_byte_identical.py` + `test_182_canvas_gate.py` = **12 passed** |
| ⚠ `test_thread_workflow_endpoint.py` | **1 of 7 RED at HEAD** — this is the suite fencing the endpoint the run surface reads. Record it; do not attribute it to this phase. |
| Unpinned but running | `PhaseNode.test.tsx` (13) · `PhaseNodeCard.test.tsx` (68) — they RUN but are **not pinned**; this phase should pin them. |
| Outside `TARGETS` entirely | `src/lib/**`, `src/components/panel/**`, `src/pages/**` — a new file there is **silently never run** unless `TARGETS` is extended. |

---

## Measured baselines — recorded at plan 188-01, before any production edit

> Measured on **2026-08-05** at the working tree as it stood after 188-01 tasks 1–2 (which touch
> `scripts/vitest-count-gate.cjs` only) and **before any file under `frontend/src` or `backend/app`
> was modified by this phase**. Every figure below is the command's own printed output — none is
> inherited from `188-RESEARCH.md`, and none is hand-counted. Where a figure differs from the
> `db086240` value already recorded above, BOTH are kept and the current one is named.
>
> These are what the phase-close **non-attribution diff** is taken against. Non-attribution is
> proved by diffing the recorded failure SET, never by a rollback run (T-188-01-02).

### 1. Frontend count gate — POST-task-1/2

```
node scripts/vitest-count-gate.cjs
```

| Figure | Measured now | At `db086240` | Which is current |
|---|---|---|---|
| `total` | **2206** | 2196 | **2206** — task 1 brought `PhaseReconcile.test.tsx` (2) and `PhaseTimeline.test.tsx` (8) into `TARGETS`, so they now EXECUTE. +10 is exactly 2 + 8; no other suite's count moved. |
| `failed` | **0** | 0 | unchanged |
| `pinned total` | **1037** | 946 | **1037** — task 2 pinned four suites: `PhaseNodeCard.test.tsx` 68, `PhaseNode.test.tsx` 13, `PhaseTimeline.test.tsx` 8, `PhaseReconcile.test.tsx` 2. 946 + 91 = 1037. `BASELINE_TOTAL` remains the computed reduce. |
| pinned files present | **26/26** | 22/22 | **26/26** — grew by exactly the 4 entries added. |

All four pin values were read from the script's own printed `actual` column across **two agreeing
runs**, never hand-counted (unsound under `it.each`). The `PhaseNodeCard.test.tsx` pin was then
**observed biting**: one whole `it(` block deleted → exit 1, `[count-decrease] PhaseNodeCard.test.tsx
— pinned 68, ran 67 (-1)` at `failed 0`, then restored. Raw output in `188-01-SUMMARY.md`.

### 2. Frontend typecheck

```
cd frontend && npx tsc --noEmit -p tsconfig.app.json
```

**33 errors.** Matches the `db086240` figure. ⚠ The passing gate for every later task is
**"still 33"**, NOT 0 — the 33 are pre-existing (the tail one is a `StreamsState` /
`viewedThreadId: string | null` vs `null` widening in the streams store). And the `-p tsconfig.app.json`
flag is load-bearing: the root `tsconfig.json` is `{"files": [], "references": [...]}` and therefore
checks **zero** files, so a bare `npx tsc --noEmit` reports 0 errors while checking nothing.

### 3. Backend full suite — THE non-attribution baseline

```
cd backend && ./venv/Scripts/python.exe -m pytest tests/ -q -p no:randomly
```

**211 failed · 3296 passed · 19 skipped · 5 xfailed · 9 xpassed · 1 error** in **308.39 s (5 m 08 s)**.
Identical to the `db086240` measurement. This is the baseline the phase-close non-attribution diff
is taken against.

Full `tests/` baseline = **211 failed / 3296 passed**; the separate `tests/unit` async-mock rot
figure (62 failed / 1700 passed, measured at Phase 187 round 5 with `pytest tests/unit -q`) is a
**different, narrower measurement and is not contradicted by this one** — a subset at 62-red and its
superset at 211-red are consistent. Do not treat the narrower figure as overturned, and do not
describe it as such in any summary.

> ⚠ Use `./venv/Scripts/python.exe -m pytest`. `source venv/Scripts/activate` does not take in the
> Bash tool and falls through to a system python missing `pydantic_settings`.

### 4. Backend canvas / byte-identity gate suites

```
cd backend && ./venv/Scripts/python.exe -m pytest tests/test_revert_byte_identical.py tests/test_182_canvas_gate.py -q
```

**12 passed** in 1.83 s. Matches the expected 12. This is the honest gate for the SPEC's
byte-identity criterion, and it is **green today** — so any red here later belongs to this phase.

### 5. ⚠ Pre-existing RED in the endpoint the run surface reads

```
cd backend && ./venv/Scripts/python.exe -m pytest tests/test_thread_workflow_endpoint.py -q
```

**1 failed · 6 passed** in 1.12 s — the 1-of-7 RED, recorded here **by name and failing assertion**
because this suite fences `GET /threads/{id}/workflow`, which the run surface reads:

| Field | Value |
|---|---|
| Failing test | `tests/test_thread_workflow_endpoint.py::test_thread_workflow_state_shape` |
| Failing assertion | `assert body["locked"] is True` → `E assert False is True` (`test_thread_workflow_endpoint.py:99`) |
| Note | The endpoint answers **HTTP 200** and the full key shape is present (the loop over `thread_id … continues_remaining` passes, as does `body["mode"] == "harness"`). Only the `locked` value disagrees. |

**This RED pre-dates every line this phase writes.** It must not be attributed to Phase 188, and
Phase 188 must not be credited with fixing it unless a plan deliberately does so.

### 6. Other pre-existing reds in the adjacent canvas suites

```
cd backend && ./venv/Scripts/python.exe -m pytest tests/test_181_flip_on.py tests/test_182_grounding_bundle.py -q
```

**3 failed · 10 passed** in 1.64 s — matching `188-RESEARCH.md`'s 1 and 2 respectively:

| Suite | Failing tests |
|---|---|
| `test_181_flip_on.py` | `test_canvas_ping_200_after_flip_on` (1) |
| `test_182_grounding_bundle.py` | `test_grounding_bundle_returns_server_sourced_palette`, `test_grounding_bundle_fields_come_from_the_bundle` (2) |

---

## Sampling Rate

- **After every task commit:** `node scripts/vitest-count-gate.cjs` + `npx tsc --noEmit -p tsconfig.app.json` (expect **33**)
- **After every plan wave:** the above, plus `pytest tests/test_revert_byte_identical.py tests/test_182_canvas_gate.py tests/test_188_workflow_run_read.py -q`
- **Before `/gsd:verify-work`:** count gate green with **every new pin present**; full backend suite run once and diffed against the recorded **211**-failure baseline; both falsification REDs pasted verbatim into their plan summaries; the 8-row SC#10 board complete
- **Max feedback latency:** ~150 seconds (count gate + typecheck)

---

## Per-Task Verification Map

> Seeded **by requirement** — the planner fills `Task ID` / `Plan` / `Wave` when plans are authored, and the executor flips `Status`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 1 | RUNVIZ-01 (Req 1 parity) | — | N/A | unit (pure fn) | `npx vitest run src/lib/phaseState.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | RUNVIZ-01 (Req 1 seal invariance, **all 7 readings**) | — | N/A | render | `npx vitest run src/components/workflows/PhaseNodeCard.test.tsx` | ✅ (68, **unpinned**) | ⬜ pending |
| TBD | TBD | 2 | RUNVIZ-01 (Req 2 no harness vocabulary) | T-188-XSS | authored strings render as plain React text children — never `dangerouslySetInnerHTML` | source grep + render | `npx vitest run src/components/workflows/PhaseNode.test.tsx` | ✅ (13, **unpinned**) | ⬜ pending |
| TBD | TBD | 1 | RUNVIZ-02 (Req 3 `?? "done"`) — **observe RED first** | — | N/A | unit | `npx vitest run src/lib/phaseState.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | RUNVIZ-02 (Req 3 — ⚠ **the second, REACHABLE fail-open**: `finalizeAllPhasesForThread` sweeps `pending` → `done`) — **observe RED first** | — | N/A | unit (store) | `npx vitest run src/components/panel/__tests__/PhaseReconcile.test.tsx` | ✅ exists, **outside `TARGETS`** | ⬜ pending |
| TBD | TBD | 1 | RUNVIZ-02 (Req 4 paintable ⊆ reconcilable) | — | N/A | unit (property) | `npx vitest run src/lib/phaseState.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 3 | RUNVIZ-02 (Req 4 mid-run reconcile identity) | — | N/A | integration (RTL) | `npx vitest run src/pages/WorkflowRunPage.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | TBD | 2 | RUNVIZ-01 (Req 5 waiting words ≠ badge, not a tense variant) | — | N/A | render + grep | `npx vitest run src/components/workflows/PhaseNode.test.tsx` | ✅ exists | ⬜ pending |
| TBD | TBD | 3 | RUNVIZ-03 (Req 6 no chat nav, no message list, no composer) | — | N/A | integration | `npx vitest run src/pages/WorkflowRunPage.test.tsx` | ❌ W0 | ⬜ pending |
| TBD | TBD | 3 | RUNVIZ-03 (Req 6 thread still created + still anchors the run) | — | N/A | integration (wire) | same file — assert `createThread` + `postMessage` called and `onNavigate` arg is `"workflow-run"` | ❌ W0 | ⬜ pending |
| TBD | TBD | 3 | RUNVIZ-03 (Req 7 terminal run re-opens, no stream) | T-188-IDOR | owner-scoped SELECT + 404-on-miss | integration | same file | ❌ W0 | ⬜ pending |
| TBD | TBD | 3 | RUNVIZ-03 (Req 7 deliverable listed + downloadable) | — | N/A | integration | same file (mock `useWorkspaceFiles` + `downloadWorkspaceFile`) | ❌ W0 | ⬜ pending |
| TBD | TBD | 3 | RUNVIZ-03 (Req 7 elapsed labelled with its anchor; `claimed_at = null` shows **no** clock) | — | N/A | render | same file | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | RUNVIZ-01 (Req 8 one derivation, zero local re-derivations) | — | N/A | source grep fence | `npx vitest run src/lib/phaseState.test.ts` (`FORBIDDEN_SYMBOLS` pattern, per `DescribeKbPicker.test.tsx`) | ❌ W0 | ⬜ pending |
| TBD | TBD | — | Req 8 `WorkflowCanvas.tsx` diff cap | — | N/A | shell | `git diff --numstat -- frontend/src/components/workflows/WorkflowCanvas.tsx` | n/a | ⬜ pending |
| TBD | TBD | 2 | SPEC — new route 404s when `visual_workflow_canvas` off | T-188-ROUTE-DISCLOSE | flag resolved **before** auth; anonymous/invalid/banned fold into the same 404; body byte-identical `{"detail":"Not Found"}` | backend | `pytest tests/test_188_workflow_run_read.py tests/test_182_canvas_gate.py tests/test_revert_byte_identical.py -q` | ❌ W0 (new file) | ⬜ pending |
| TBD | TBD | 2 | SPEC — route absent from `/openapi.json` when off | T-188-OPENAPI | path **template** registered in `CANVAS_GATED_PATHS` | backend | `pytest tests/test_182_canvas_gate.py -q` | ✅ exists (**exact-set** assertion — will fail loudly if the set changes) | ⬜ pending |
| TBD | TBD | — | SPEC — zero migrations | — | N/A | shell | `git diff --name-only HEAD -- supabase/migrations/` is empty | n/a | ⬜ pending |
| TBD | TBD | 4 | SC#10 — 8 rows, each PASS or ⛔-with-reason | — | N/A | script + DB read | roster derived by executing `MODEL_CAPABILITIES` (61 models → 8 provider groups); verdicts read from `workflow_runs` / `workflow_phases` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/lib/phaseState.ts` + `frontend/src/lib/phaseState.test.ts` — the shared derivation and its parity / total-function / subset / grep-fence tests (RUNVIZ-01, RUNVIZ-02)
- [ ] `frontend/src/pages/WorkflowRunPage.test.tsx` — the run-surface integration suite (RUNVIZ-03)
- [ ] `backend/tests/test_188_workflow_run_read.py` — the new route's ownership, 404-when-off, and shape tests
- [ ] **`scripts/vitest-count-gate.cjs` — extend `TARGETS` to include `src/lib/`, `src/components/panel/__tests__/` and `src/pages/`.** ⚠ **Load-bearing.** These directories are outside `TARGETS` today, so a new test file there is *silently never run*. A suite that does not run cannot fail, and a phase whose falsification tests never execute has proved nothing.
- [ ] **Extend `BASELINE`** to pin the new counts **and** the two already-running-but-unpinned suites (`PhaseNode.test.tsx` 13, `PhaseNodeCard.test.tsx` 68). Pinning is a separate knob from running — pin both.
- [ ] Record the pre-existing `test_thread_workflow_endpoint.py` 1-of-7 RED **before** any edit, so it can be proven non-attributable.

*No framework install needed — vitest and pytest are both in tree.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| **"Colour off" legibility** — all seven readings remain distinguishable with colour disabled | RUNVIZ-01 | Sketch 153's explicit acceptance test; a machine can assert the arc geometry differs but not that a human can *read* it | Launch a run with `visual_workflow_canvas` on; apply a greyscale filter (DevTools rendering → emulate `achromatopsia`); confirm all seven readings separate by shape alone |
| **G-4 lived-experience run watch** — watch a real multi-phase run end to end on the run surface | RUNVIZ-01/02/03 | The documented UAT-gap pattern: regressions hide in slow streams. Wire format + screenshot are insufficient | Chrome MCP drives a real published workflow launch; watch ≥3 phase transitions; refresh mid-run and confirm no reading changes; reach terminal; open the deliverable |
| **The `🕐 Tomorrow` moment** — navigate away, come back, find the run and its file | RUNVIZ-03 | Tests the bidirectional seam (D-188-13), which only exists as a user journey | Launch → navigate to Chat → find the run's thread in history → follow "Open the run" → confirm spine, final state, and deliverable all render with no live stream |
| **`.docx` deliverable is download-only, and says so** | RUNVIZ-03 | `FilePreview` routes DOCX/PPTX/XLSX/PDF to a download fallback; the surface must not promise a preview | Run a workflow whose `llm_emit` produces `.docx`; confirm it is listed, downloads in one click, and no broken preview pane renders |
| **SC#10 — 8-row cross-provider board** | SC#10 | Requires live provider keys; a keyless row **silently looks like a pass** | ⚠ **Probe API-key availability per provider FIRST.** Then drive each row with a per-request `provider`. ⚠ **Per-request `model` does NOT reach a harness phase** (`ctx.model` reads `user_settings.llm_model`); only `provider` does. `phase.config.model` beats everything. `override_provider` fails **silently** without a key. Record each row PASS or ⛔-with-reason + blocking id; never omit |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references — **including the `TARGETS`/`BASELINE` extension**
- [ ] No watch-mode flags
- [ ] Feedback latency < 150s
- [ ] Both falsification tests observed **RED against unmodified HEAD** and the raw output recorded
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
