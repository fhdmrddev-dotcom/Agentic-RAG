---
phase: 196
slug: registry-backed-model-picker-canvas
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-17
---

# Phase 196 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `196-RESEARCH.md` §"Validation Architecture" (`:1213-1357`). Every figure in that
> section was measured this session — **re-derive, never copy forward.**

---

## Test Infrastructure

| Property | Backend | Frontend |
|----------|---------|----------|
| **Framework** | pytest + pytest-asyncio | vitest + @testing-library/react |
| **Config file** | `backend/pytest.ini` | `frontend/vitest.config.*` |
| **Quick run command** | `cd backend && ./venv/Scripts/python.exe -m pytest tests/unit/test_196_*.py -x -q` | `cd frontend && GSD_VITEST_MAX_WORKERS=2 npx vitest run src/components/workflows/ModelField.test.tsx` |
| **Full suite command** | `cd backend && ./venv/Scripts/python.exe -m pytest tests/ -q` | `cd frontend && GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` |
| **Typecheck** | — | `cd frontend && npx tsc --noEmit -p tsconfig.app.json` ⚠ **the `-p` is load-bearing** — bare `tsc --noEmit` checks ZERO files |
| **Estimated runtime** | ~90 s unit / ~6 min full | ~15 s targeted / ~4 min count gate |

⚠ **`GSD_VITEST_MAX_WORKERS=2` on every frontend run.** Not optional — see CLAUDE.md
§"Parallel execution", and note the correction: **the cap does NOT fix SEED-171's flakes.**

---

## Sampling Rate

- **After every task commit:** the touched suite only —
  `GSD_VITEST_MAX_WORKERS=2 npx vitest run <suite>` and/or `pytest tests/unit/test_196_*.py -x`
- **After every plan wave:** `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`
  + `pytest backend/tests -q` + `npx tsc --noEmit -p tsconfig.app.json`
- **Before `/gsd:verify-work`:** both suites green **per the gate's own contract** (below)
- **Max feedback latency:** ~90 s (targeted suite)

### ⚠ The count-gate contract is NOT a fixed total

It is **no per-file DECREASE** and **zero failing**. A growing grand total is the gate **working**.
Re-derive with `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` and read the
**verdict line**, never a summary. **Do not write an acceptance criterion of "the gate is green"**
alone — pair it with per-file deltas and the explicitly-run in-scope suites, which ARE deterministic.

### ⚠ SEED-171 flakes run on EVERY gate run for this phase

`src/components/workflows/library/WorkflowCard.test.tsx` sits **inside** the bare gated directory
`src/components/workflows` that this phase's new tests land in. All three SEED-171 suites
(`WorkflowsPage.test.tsx`, `WorkflowCard.test.tsx`, `WorkflowBuilderPage.session.test.tsx`)
therefore execute on every run. **If the gate reds: capture failing filenames from the gate's
persisted JSON BEFORE re-running**, check `git diff --numstat` + `git status --short`, and if the
file is byte-unchanged and one of the three, record it as an observation. **Do NOT adjust the
worker cap** — SEED-171 measures that adjusting it does not fix these. Say *"provably unmodified"*,
never *"fine"*.

---

## Per-Task Verification Map

> Plan/task IDs are assigned by `gsd-planner`. This table is the **criterion→proof** contract each
> task must satisfy; the executor fills `Task ID` and `Status`. Sourced from RESEARCH §1229-1252.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | P-02 | 0 | AUTH-04 / SC#1 | T-196-AC1 | Union route returns the full 61∪8 registry union (re-derive the count; **69 was today's reading, not a target**) | integration | `pytest backend/tests/test_196_model_registry_route.py::test_union_size -x` | ❌ W0 | ⬜ pending |
| TBD | P-02 | 0 | SC#1 | T-196-AC1 | Route readable by a **non-operator** (not 404) | integration | `…::test_non_operator_can_read -x` | ❌ W0 | ⬜ pending |
| TBD | P-02 | 0 | SC#1 | **T-196-AC2** | ⚠ `GET /admin/models` STILL 404s a non-operator — the operator gate was **not widened** | integration | `…::test_admin_route_still_gated -x` | ❌ W0 | ⬜ pending |
| TBD | P-02 | 0 | SC#1 | **T-196-LEAK** | Payload carries **only** the allowlisted projection — no `deprecated_reason`, no `overridden_fields`, no timeouts, no endpoint/base-url, no key material | integration | `…::test_field_allowlist -x` | ❌ W0 | ⬜ pending |
| TBD | P-04 | 1 | AUTH-04 / SC#1 | — | `ModelField` renders **only** ids from the payload; **no free-text input path** | unit (render) | `vitest ModelField.test.tsx -t "registry-only"` | ❌ W0 | ⬜ pending |
| TBD | P-04 | 1 | D-20 | — | The panel mounts it as **exactly 4 one-line gated mounts** | unit (source fence) | `vitest PhaseFormPanel.test.tsx -t "gated line"` | ⚠ **a NEW fence is owed** — the 193.1 fence at `PhaseFormPanel.test.tsx:481-497` is scoped to `<TemplateNameCheck` and **will not fire on a `ModelField` mount** | ⬜ pending |
| TBD | P-04 | 1 | D-20 | — | Panel body gains **zero** `useMemo`/`useState`/`useEffect`/`.filter(`/`.map(` lines | CI grep on the diff | `git diff -U0 -- …/PhaseFormPanel.tsx \| grep '^+' \| grep -cE 'useMemo\|useState\|useEffect\|\.filter\(\|\.map\('` → must be `0` | ❌ W0 | ⬜ pending |
| TBD | P-05 | 1 | **SC#2** | T-196-IV1 | `POST`/`PATCH /workflows` with `config.model="not-a-real-model"` → **400** | integration | `pytest backend/tests/test_196_save_refusal.py -x` | ❌ W0 | ⬜ pending |
| TBD | P-05 | 1 | SC#2 / D-04 | — | A **blank** model still saves (zero-data-change invariant) | integration | `…::test_blank_still_saves -x` | ❌ W0 | ⬜ pending |
| TBD | P-05 | 1 | SC#2 / D-08 | — | An already-stored **unknown** model still saves — retiring a registry row must not brick a workflow | integration | `…::test_stored_unknown_still_saves -x` | ❌ W0 | ⬜ pending |
| TBD | P-04 | 1 | SC#2 / D-08 | — | Unknown value kept as `(current)` **and names its consequence** in user words | unit (render) | `vitest ModelField.test.tsx -t "unknown keeps and names"` | ❌ W0 | ⬜ pending |
| TBD | P-04 | 1 | **D-07** | — | ⚠ Opening the form **never** calls `onChange`/`onPersist` — viewing is not editing | unit (render) | `vitest ModelField.test.tsx -t "does not rewrite on open"` | ❌ W0 | ⬜ pending |
| TBD | P-06 | 1 | **D-10** | — | A **disabled** per-phase model falls back to the run model **with a notice** | unit | `pytest backend/tests/unit/test_196_harness_enabled_check.py -x` | ❌ W0 | ⬜ pending |
| TBD | P-06 | 1 | D-10 | — | An **enabled** model is byte-identical — no fallback, no notice | unit | `…::test_enabled_is_noop -x` | ❌ W0 | ⬜ pending |
| TBD | P-06 | 1 | **A1** | — | ⚠ `phase_types` imports fresh with **no import cycle** — RED test FIRST, before any other work in that plan | unit (import) | `…::test_no_import_cycle -x` | ❌ W0 | ⬜ pending |
| TBD | P-02 | 0 | D-13 | — | `emit_tier` reaches the client on **every** union row | integration | `…test_196_model_registry_route.py::test_emit_tier_on_wire -x` | ❌ W0 | ⬜ pending |
| TBD | P-01 | 0 | **D-14** | — | A DB `emit_tier` override **wins** over the code value | integration | `pytest backend/tests/test_196_emit_tier_overlay.py -x` | ❌ W0 | ⬜ pending |
| TBD | P-01 | 0 | D-14 | **T-196-IV2** | An off-allowlist `emit_tier` PATCH → **422 before any DB touch** | integration | `…::test_bad_tier_422 -x` | ❌ W0 | ⬜ pending |
| TBD | P-01 | 0 | **A7** | — | The migration's `CHECK` value set **equals** `set(_RUNGS_BY_TIER)` — two-layer pin, `test_audit_event_registration.py` style | unit | `…::test_check_matches_rungs -x` | ❌ W0 | ⬜ pending |
| TBD | P-01 | 0 | SEED-172 (free) | T-196-IV2 | Numeric range guard on the registry PATCH path — `0`, negative, and absurd values rejected | integration | `…::test_numeric_range -x` | ❌ W0 | ⬜ pending |
| TBD | P-04 | 1 | **D-12/D-15** | — | `llm_emit` distinguishes `coerce` from `force`/`force_strict` **in user words, before selection**; other step types do **not** group | unit (render) | `vitest ModelField.test.tsx -t "fitness"` | ❌ W0 | ⬜ pending |
| TBD | **P-07** | 1 | **D-17 ⚠ BINDING** | — | **Each of the 4 consumers** resolves the model set in `app_settings` — set the row, assert the **RESOLVED** model changes. **RED-first, all four, + 1 control.** *The absence of this test is why the bug survived 2026-07-31 → 2026-08-17.* | unit ×4 + control | `pytest backend/tests/unit/test_196_judge_model_db_backed.py -x` | ❌ W0 — **BINDING** | ⬜ pending |
| TBD | P-08 | 1 | **D-18** | — | A thread restores its last-used **enabled** model | unit (hook) | `vitest useComposerModel.test.ts` | ❌ W0 | ⬜ pending |
| TBD | P-08 | 1 | D-18 | — | ⚠ `'unknown'` (**121 live rows**) and `undefined` (user rows) are **skipped** | unit (hook) | `…-t "skips unknown"` | ❌ W0 | ⬜ pending |
| TBD | P-08 | 1 | D-18 / D-07 | — | A **disabled** last-used model falls back — reuses D-07's rule, does not invent a second | unit (hook) | `…-t "disabled falls back"` | ❌ W0 | ⬜ pending |
| TBD | P-08 | 1 | D-18 | — | ⚠ `provider` is restored **first** or `ChatArea.tsx:201` clobbers the model | unit (hook) | `…-t "provider restored first"` | ❌ W0 | ⬜ pending |
| TBD | P-08 | 1 | **G-5** | — | `ChatArea.tsx` `useState` **7→2** and `useEffect` **4→3** — G-5 honoured by **reduction**, not by argument | source count | `grep -c "useState\|useEffect" …/ChatArea.tsx` vs the pre-change baseline | ❌ W0 | ⬜ pending |
| TBD | P-09 | 2 | **SC#3** | — | The app-wide sweep was **not** attempted — no plan's `files_modified` names `SettingsPage.tsx` or `ModelPillRow.tsx`, and `verified_models` is unchanged | negative fence | grep over the phase's `files_modified` + `git diff --stat` | ❌ W0 | ⬜ pending |
| TBD | P-01 | 0 | **A3** | — | `scripts/check-deploy-drift.sh` passes — no new env var, no seed row, deploy artifacts unaffected | CLI | `bash scripts/check-deploy-drift.sh` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/test_196_model_registry_route.py` — SC#1 + the field-allowlist leak fence
- [ ] `backend/tests/test_196_save_refusal.py` — SC#2
- [ ] `backend/tests/test_196_emit_tier_overlay.py` — D-14 + the `CHECK`↔`_RUNGS_BY_TIER` two-layer pin
- [ ] `backend/tests/unit/test_196_harness_enabled_check.py` — D-10 + the **A1 import-cycle RED test first**
- [ ] `backend/tests/unit/test_196_judge_model_db_backed.py` — **D-17, BINDING, RED-first ×4 + control**
- [ ] `frontend/src/components/workflows/ModelField.test.tsx` — the picker contract (auto-gated: `src/components/workflows` is a bare `TARGETS` directory)
- [ ] `frontend/src/components/workflows/PhaseFormPanel.test.tsx` — **a NEW four-line source fence** scoped to the `ModelField` mounts (the 193.1 fence does not cover them)
- [ ] `frontend/src/hooks/__tests__/useComposerModel.test.ts` — ⚠ **UNGATED** until added to `TARGETS`
- [ ] `frontend/src/components/chat/__tests__/ChatArea.model.test.tsx` — ⚠ **UNGATED** until added to `TARGETS`
- [ ] `scripts/vitest-count-gate.cjs` — add the two ungated entries above to `TARGETS`, and **reconcile pinned totals to the gate's own printed `actual`, never to a number quoted in a document**

⚠ **Author every test as patched/stubbed, not DB-inserting.** Idioms:
`monkeypatch.setattr("app.models.user_settings._load_settings_from_db", …)` and patching
`load_all_model_overrides`. This removes CLAUDE.md rule 4's serialisation constraint entirely.
**P-01** (if an overlay test INSERTs) and **P-06** (if a harness test creates a real `workflow_runs`
row) are the two that could accidentally become DB-mutating — **a `files_modified` check cannot see
a database write.**

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| *"the operator's judge knob now takes effect"* | **D-17** | A unit test proves the resolver returns the row's value; it cannot prove a real publish shot routed to that provider | Set the knob, run a real publish, read `workflow_runs` / `harness_audit` `judge_verdict` metadata for the model **actually** used. ⚠ **Live consequence:** after D-17 the gauntlet judge becomes `deepseek-v4-pro` on the operator's box |
| *"a thread restores its model across refresh"* | **D-18** | jsdom has no page reload — a hook test proves the derivation, not the lifecycle | Chrome MCP / manual: refresh and read the composer's DOM value |
| *"a `coerce` model is distinguishable BEFORE selection"* | D-12 | A render test proves the markup exists; it cannot prove a human sees it | Operator UAT — the G-4 lived-experience row U-A2 below |
| *"the harness fallback notice is visible in the run surface"* | D-10 / **A2** | The emit is testable; the PhaseCard rendering of a new status is a separate surface | ⚠ **First verify the frontend `phase_substep` status switch has a default arm** — an unmapped status renders blank, which is the exact silent-notice defect this phase removes. Then run a real workflow with a disabled per-phase model |
| *"an unregistered model cannot be **silently** selected"* | **SC#2** | Coverage of the honest-consequence copy is a judgement, not an assertion | Operator UAT |
| *"`emit_tier` for a local LM Studio model is correct"* | D-14 / SEED-172 | Requires LM Studio listening on `127.0.0.1:1234` | ⛔ **BLOCKED at research time** (measured: no response). Unblocks when the operator starts LM Studio with `glm-4.7-flash` loaded |

---

## UAT Scoreboard (MANDATORY — CLAUDE.md §"UAT scoreboard recipe")

### Cross-provider roster — **DERIVED, never typed**

Re-derive at UAT time; do not trust this table's rows:

```bash
cd backend && ./venv/Scripts/python.exe -c "
import sys, collections, psycopg2; sys.path.insert(0,'.')
from app.config import MODEL_CAPABILITIES
by = collections.defaultdict(list)
for m, c in MODEL_CAPABILITIES.items(): by[c.get('provider')].append((m, c.get('emit_tier'), 'code'))
c = psycopg2.connect('postgresql://postgres:postgres@127.0.0.1:54322/postgres'); cur = c.cursor()
cur.execute('select model_id, provider, enabled from model_capabilities_overrides')
for m, p, e in cur.fetchall():
    if m not in MODEL_CAPABILITIES: by[p].append((m, None, 'db-only'))
for p in sorted(by): print(p, len(by[p]), sorted(by[p]))"
```

⚠ **THE DERIVATION RETURNS NINE PROVIDER GROUPS, NOT EIGHT.** CLAUDE.md's roster table names
7 native + OpenRouter = 8. The **union** adds `lmstudio`, contributed entirely by SEED-172's three
hand-inserted DB-only rows. **This is exactly why the rule says derive, never re-type** — a phase
about the *live registry* whose UAT used the hand-typed 8 would test 8/9 of the registry it surfaces.

| # | Provider | Representative | `emit_tier` | Source | Status |
|---|---|---|---|---|---|
| 1 | `openai` | `gpt-5.6-terra` | `force_strict` | code | ⬜ RUN |
| 2 | `anthropic` | `claude-sonnet-5` | `force` | code | ⬜ RUN (native SDK) |
| 3 | `google` | `gemini-3.5-flash` | `force` | code | ⬜ RUN ⚠ highest-risk tool-call row; also SEED-135's null-verdict judge |
| 4 | `deepseek` | `deepseek-v4-pro` | `force` | code | ⬜ RUN ⚠ `strict_json_schema` **inert** (D-122-04). ⚠ Becomes the **live judge** after D-17 |
| 5 | `zhipu` | `glm-5.2` | `force` | code | ⬜ RUN ⚠ **zero zhipu rows have an override** → no zhipu model is in `allowed_models`: the cleanest live proof of why D-01's union is needed |
| 6 | `minimax` | `MiniMax-M3` | `force` | code | ⬜ RUN |
| 7 | `moonshot` | `kimi-k2.6` | **`coerce`** | code | ⬜ RUN ⚠ **the only `coerce` native rows** — therefore **the single most important `llm_emit` fitness row in this phase** |
| 8 | `openrouter` | `z-ai/glm-5.2` | `force` | code | ⬜ RUN ⚠ every OpenRouter row is `native_tools: False` — the non-native tool path |
| 9 | **`lmstudio`** | `glm-4.7-flash` | absent → `coerce` | **db-only** | ⛔ **BLOCKED — LM Studio not listening on `127.0.0.1:1234` (measured 2026-08-17). Blocking id: SEED-172. Recorded, never omitted.** |

**Method:** drive each row as a real run with a **per-request** `model` + `provider` on
`POST /threads/{id}/messages`; read verdicts from `workflow_runs` / `workflow_phases` /
`harness_audit`. **Mutates no global setting** — the operator's environment is untouched and rows
cannot contaminate each other.

⚠ **Prefer a registry-backed id.** An id absent from `MODEL_CAPABILITIES` resolves
`capability_source=inferred` and silently loses `emit_tier`.

### The other three required axes

| Axis | Required row | Status |
|---|---|---|
| **Multi-tool** | ≥1 row exercising 2+ tools in one prompt (`search_documents` + `execute_code`) | ⬜ |
| **Parallel-thread** | Thread A streaming while Thread B accepts a new prompt — ⚠ **doubles as D-18's hardest case**: does Thread A's restored model survive a switch to B and back? | ⬜ |
| **Long-message** | ≥50 prior messages OR a ≥5 KB prompt — ⚠ also D-18's realistic case (a long thread with a mid-thread model switch) | ⬜ |

### ⚠ Interesting test values — `gpt-5.4` alone proves NOTHING

It is registry-known, enabled, and `force_strict`, so it passes every check this phase adds.
The rows that actually probe the new behaviour:

| Value | Why it is interesting | Status |
|---|---|---|
| `gpt-5.2` | **disabled** — must be offered-never, kept-if-stored as `(current)` (D-07) | ⬜ |
| `glm-4.7-flash` | **DB-only, local, `coerce` by construction** — invisible to `verified_models` | ⬜ |
| `gpt-5.5` | **code-only** — absent from `allowed_models`; SEED-135's measured working judge | ⬜ |
| `gemini-3.6-flash` | **DB-only** — absent from `verified_models`; the seed's own failure case | ⬜ |
| `not-a-real-model` | the SC#2 refusal — must 400 on the wire, not merely be unselectable in the form | ⬜ |

---

## G-4 Lived-Experience Rows (operator-defined at scope time)

> CLAUDE.md G-4: *"Operator-defined 'I'd recognize failure here' scenarios at scope-time (not
> post-hoc). Chrome MCP drives all 3 at phase verification — wire format + screenshot are
> insufficient."* Three surfaces, four moments.

**✅ RATIFIED BY THE OPERATOR 2026-08-17, at plan time (before the planner ran) — not post-hoc.**

| # | Surface | Scenario | Status |
|---|---|---|---|
| **U-A1** | Canvas | Open a saved workflow with an `llm_emit` step, **touch nothing**, close it — then verify **via DB** that `config.model` is byte-unchanged. *D-07's no-rewrite property, as a lived moment.* | ✅ ratified — ⬜ not yet driven |
| **U-A2** | Canvas | On an `llm_emit` step, pick `kimi-k2.6` (`coerce`) and see it distinguished from a `force_strict` model **before** committing the pick, in user words — not `emit_tier:` engine words. | ✅ ratified — ⬜ not yet driven |
| **U-B1** | Settings | Set the judge knob to a cheap model, run a **real** publish, and see **that model** named in the verdict receipt. *The knob the operator turns is the control the code obeys.* | ✅ ratified — ⬜ not yet driven |
| **U-C1** | Chat | Pick a non-default model in a thread, send a message, navigate away, come back, **refresh** — and see the model still selected. | ✅ ratified — ⬜ not yet driven |

⚠ **Chrome MCP drives all four at phase verification.** Wire format and screenshots are explicitly
insufficient per G-4. U-A1's proof is a **DB read**, not a UI observation — the failure it catches
is invisible on screen.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90 s
- [ ] **D-17's BINDING test exists and was RED before it was GREEN** (all four consumers + control)
- [ ] **A new `ModelField` source fence exists** — the 193.1 fence does not cover it
- [ ] **The two ungated frontend suites were added to `TARGETS`**
- [ ] G-4 rows U-A1 / U-A2 / U-B1 / U-C1 confirmed by the operator and driven at verification
- [ ] The 9-row roster was **re-derived**, not copied from this file
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
