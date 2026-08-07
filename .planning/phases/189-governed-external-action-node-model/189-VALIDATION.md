---
phase: 189
slug: governed-external-action-node-model
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-07
---

# Phase 189 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `189-RESEARCH.md` § "Validation Architecture" (all baselines measured 2026-08-07, not inherited).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (frontend)** | **vitest** (`frontend/package.json` → `"test": "vitest run"`) + jsdom + @testing-library |
| **Framework (backend)** | **pytest** (`backend/pytest.ini`) — MUST run via `backend/venv/Scripts/python.exe` (conftest imports `app.main`) |
| **Config files** | `frontend/vitest.config.ts` · `backend/pytest.ini` + `backend/tests/conftest.py` |
| **Quick run (frontend)** | `cd frontend && npx vitest run src/components/workflows/<file>.test.tsx` |
| **Quick run (backend)** | `cd backend && venv/Scripts/python.exe -m pytest tests/unit/<file>.py -q` |
| **Full suite (frontend)** | `node scripts/vitest-count-gate.cjs` — **baseline 2508 tests / 45 files / 0 failing at HEAD** |
| **Frontend typecheck** | `cd frontend && npx tsc --noEmit -p tsconfig.app.json` — **baseline 33** (bare `--noEmit` checks ZERO files) |
| **Full suite (backend, 189 scope)** | the 9-file command in RESEARCH §D15 — **baseline 166 passed / 2 pre-existing failures** (named there) |
| **Estimated runtime** | quick < 15 s · count gate ~2–3 min · backend 189-scope ~40 s |

⚠ **The count gate has TWO knobs.** `TARGETS` selects which files RUN; `BASELINE` is the pinned
count. A new suite needs its `TARGETS` entry **in the commit that creates it** — earlier is exit 2
(ERROR), later means the gate silently never runs it. `src/lib/` and `src/pages/` are named-file-only.

⚠ **`D-188.2-DEF-01`: the count gate's `failed` column is NOT a regression backstop on this machine**
— it varied 1 → 21 → 50 → 10 → 0 → 0 across eight runs at an identical total of 2502 (pre-existing
SEED-056 rot). **The COUNT columns are the backstop. Never read `failed 0` as "no regression".**

---

## Sampling Rate

- **After every task commit:** the ONE quick command for the file touched (< 15 s).
- **After every plan wave:** `node scripts/vitest-count-gate.cjs` **AND**
  `npx tsc --noEmit -p tsconfig.app.json` (must read exactly **33**, or the delta is explained in the
  commit) **AND** the 9-file backend command (must read **166 passed / 2 failed**, the two named).
- **Before `/gsd:verify-work`:** both full suites at their measured baselines + every driven row below.
- **Max feedback latency:** 15 s per task · ~3 min per wave.

---

## Per-Task Verification Map

> Populated by `gsd-planner` — every task in every `189-NN-PLAN.md` carries its own `<automated>`
> verify command. The **requirement → behaviour → command** map that those tasks must satisfy is the
> table below, lifted verbatim from `189-RESEARCH.md` § "Phase Requirements → Test Map".

| # | Req / SC / D | Behaviour that must be proven | Type | Automated command | File |
|---|---|---|---|---|---|
| V01 | SC#1 · CONN-01 | The 7th union member parses; an unknown key still 422s; a **pre-189 JSONB row still validates** | unit | `pytest tests/unit/test_harness_models.py -q` | ✅ extend |
| V02 | SC#1 | `PHASE_TYPE_REGISTRY` resolves `external_action` — no `PhaseTypeNotRegistered` | unit | `pytest tests/test_harness_engine.py -q` | ✅ extend |
| V03 | SC#1 | The picker offers **7**; `slugForType` + `minimalPhaseFor` produce a valid phase | unit | `npx vitest run src/components/workflows/definitionOps.test.ts src/components/workflows/StepTypePicker.test.tsx` | ✅ extend ⚠ **8 `toHaveLength(6)` pins** |
| V04 | SC#1 · D-03 | The capability lands in `available_tools`; the whitelist refuses a name not on it | unit | `pytest tests/test_harness_whitelist.py -q` | ✅ extend |
| V05 | SC#1 · D-03 | **Disjointness: `{send_email, create_ticket, post_message} ∩ KB_TOOLS == ∅`** and `grounding_cause` returns `None` — **assert the SET, not one name** | unit | `pytest tests/unit/test_185_detection.py -q` | ✅ extend |
| V06 | SC#2 · D-04 | `action_risk_armed` **cannot be stored false** — round-trip a definition with `armed: false` through `model_validate`, assert `True` | unit | `pytest tests/unit/test_189_external_action_model.py -q` | ❌ **Wave 0** |
| V07 | SC#2 · D-04 | The run-time checkpoint fires on an `external_action` phase (`harness_engine.py:754`) | unit | `pytest tests/test_harness_engine.py -q` | ✅ extend |
| V08 | SC#2 · D-04 | The canvas arming switch renders **on and non-interactive** for the type | unit (jsdom) | `npx vitest run src/components/workflows/GovernanceSection.test.tsx` | ✅ extend |
| V09 | SC#2 | Cannot be wired around — an `external_action` phase with emptied `available_tools` is a validation error | unit | `pytest tests/unit/test_189_external_action_model.py -q` | ❌ **Wave 0** |
| V10 | SC#4 · D-05 | The executor performs **NO network I/O** — falsifying control: patch the HTTP transport to RAISE, run the executor, assert it does not raise | unit | `pytest tests/unit/test_189_no_egress.py -q` | ❌ **Wave 0 — SC#4's only mechanical proof** |
| V11 | SC#4 | **`grep -rn "mcp" backend/app` returns 0** — a source fence (the `?raw` idiom in Python) | unit | `pytest tests/unit/test_189_no_egress.py -q` | ❌ **Wave 0** |
| V12 | D-05 | On approval the phase writes `status='recorded_not_sent'` **and the run CONTINUES** — assert the NEXT phase ran, not just the status | unit | `pytest tests/test_harness_engine.py -q` | ✅ extend |
| V13 | D-08 / D-17 | Migration 115 admits `recorded_not_sent` **and rejects `'Not sent — recorded'`** (positive AND negative control against the CHECK) | integration | `pytest tests/test_migration_115.py -q` (live :54322) | ❌ **Wave 0**, runs after operator apply |
| V14 | D-07 / D-16 | `phaseStatusFromDb("recorded_not_sent")` ≠ `"done"`; the word ≠ `"Complete"`, **≠ `"Running"`, ≠ the waiting word** | unit | `npx vitest run src/lib/phaseState.test.ts src/components/workflows/PhaseNodeCard.test.tsx` | ✅ extend |
| V15 | D-07 | The word renders at all **three** surfaces — canvas node, run surface, phase output | unit | `npx vitest run src/pages/WorkflowRunPage.test.tsx src/components/workflows/PhaseNode.test.tsx` | ✅ extend |
| V16 | D-09 | **NO new `harness_audit` event type** — the Python literal set is unchanged | unit | `pytest tests/unit/test_audit_event_registration.py -q` | ✅ **already guards it** |
| V17 | D-12 / D-18 | Badge slot 1 carries "Not connected" **only when not connected**; slot 2 unchanged; **a third badge is a typecheck error** (`@ts-expect-error` control) | unit + tsc | `npx vitest run src/components/workflows/PhaseNodeCard.test.tsx src/components/workflows/WorkflowCanvas.test.tsx` + `tsc -p tsconfig.app.json` | ✅ **rewrite the two slot-1-reserved pins** |
| V18 | D-13 | The derived face is capability-specific for **all three** capabilities and falls to the type sentence when none is chosen | unit | `npx vitest run src/components/workflows/phaseVocabulary.test.ts` | ✅ extend |
| V19 | glyph | `PHASE_GLYPHS` and `PHASE_GLYPH_MARKS` agree (7 = 7, same keys) — the split-brain fence | unit | `npx vitest run src/components/workflows/soulData.test.ts` | ✅ extend |
| V20 | D-06 · **D-19** | **An `external_action` workflow PUBLISHES** — mock the judge, assert `published: true`, `blocked_stage` absent. **This test fails RED at HEAD and is the phase's headline gate.** | unit | `pytest tests/test_publish_gate.py -q` | ✅ extend |
| V21 | D-06 · **D-20** | Stage 2.6 emits **no** `unregistered_tool` finding for the three capabilities | unit | `pytest tests/unit/test_103_grounding_fidelity.py -q` | ✅ extend |
| V22 | **D-20** leak | The three capabilities are **NOT** in `GroundingBundle.tools` — so no `llm_agent` can whitelist one | unit | `pytest tests/test_182_grounding_bundle.py -q` | ✅ extend ⚠ 2 pre-existing DB failures in this file |
| V23 | SC#3 · D-10 | The `docs/` doc exists and the `DECISIONS.md` entry **points at it without restating it** | grep fence | doc-fence test **or** `checkpoint:human-verify` | ❌ **Wave 0 or checkpoint** |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/unit/test_189_external_action_model.py` — **NEW.** D-04's stored-false coercion
      (V06), D-02's closed-set raise, the emptied-`available_tools` refusal (V09).
- [ ] `backend/tests/unit/test_189_no_egress.py` — **NEW.** SC#4: the `grep mcp → 0` source fence
      (V11) + the patched-transport falsification (V10).
- [ ] `backend/tests/test_migration_115.py` — **NEW.** The positive/negative CHECK controls (V13);
      runs only after the operator applies the migration via the Supabase SQL editor.
- [ ] A capability-picker component test file **if** the picker becomes its own component
      (`ExternalActionSection.tsx` — RESEARCH recommends it should, to honour 185's PhaseFormPanel shape).
- [ ] **No framework install needed** — vitest and pytest are both present and green at baseline.
- [ ] ⚠ **Every new frontend suite needs its `TARGETS` entry IN THE COMMIT THAT CREATES IT.**

**RED-first is mandatory on every one of these.** The standing project lesson (185, 186, 188.1,
188.2) is: *observe the falsification RED before trusting the green.* V20 in particular already
fails RED at HEAD — capture that failure verbatim before fixing it, so the fix is proven and not
merely coincident.

---

## Manual-Only Verifications

**jsdom applies no CSS, computes no stacking contexts, and `.click()` bypasses hit-testing entirely.**
That is how `BUG-260806-01` survived from 184-12 and how `BUG-260807-01` survived until 2026-08-07.
**A green unit suite is not evidence for any row below.**

| # | Behaviour | Req | Why manual | Driven method |
|---|---|---|---|---|
| U1 | The 7th glyph is **visible** on Deep Midnight and not ~4× dimmer than the other six | SC#1 | jsdom computes no colour | Chrome MCP `evaluate_script` reading computed fill/luminance of the mark **against the other six on one canvas** (the exact `llm_batch_agents` luminance-34.5 defect that forced the 184 swap) |
| U2 | The "Not connected" badge does **not occlude, and is not occluded by**, the ⛨ seal, the verdict mark, or the ✕/＋ lane affordances | D-12 / D-18 | no stacking contexts in jsdom | `document.elementFromPoint(x,y)` at the badge's own centre AND at each neighbour's — **with a falsification control observed swinging BOTH ways**, exactly as `BUG-260806-01` was closed |
| U3 | The 8th ring reading is distinguishable **by shape alone in greyscale** from the other seven | D-07 | a design property, not a table entry | read `stroke-dasharray` / `stroke-dashoffset` presentation attributes for all eight; `filter: grayscale(1)` |
| U4 | Adding a badge does not change card height or push the subtitle out of the 248 px / 62 px body budget | D-12 | layout | `getBoundingClientRect()` on the card **before and after** |
| U5 | **OWED — `D-188.2-DEF-07`, row A2:** the seven readings stay distinguishable by shape on a **live run**; the running arc spins; a card with no reading is still | 188.2 debt | needs a live run | **ride the first D-06 live run this phase launches** |
| U6 | **OWED — `D-188.2-DEF-08`, row A1's visual half:** one glance at a Builder card | 188.2 debt | subjective | zero-cost; pair with U5 |
| U7 | Migration 115 is APPLIED to the live local DB | D-08 | CLAUDE.md forbids `supabase db push` / `db reset` | operator pastes `115_*.sql` into the Supabase SQL editor, then `bash scripts/regenerate-full-schema.sh` (no `--reset`) |

⚠ **The app has no URL router** — `ActiveView` is React state at `App.tsx:102`, so visiting
`/workflows` renders chat and the URL is inert. **Every driven row must navigate by CLICKING, never
by deep link.**
⚠ **`take_screenshot` times out repeatedly in this estate** (`Page.captureScreenshot`). Prefer
`evaluate_script` DOM/geometry reads — machine-checkable and they do not wedge the session.

**No SC#10 cross-provider scoreboard is owed** — ROADMAP exempts 189 (design / vocabulary, no live
stream).

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Wave 0 covers all ❌ MISSING references above (V06, V09, V10, V11, V13, V23)
- [ ] Every new frontend suite has its `TARGETS` entry in the same commit
- [ ] No watch-mode flags anywhere
- [ ] Feedback latency < 15 s per task
- [ ] Driven rows U1–U4 executed via Chrome MCP; U5/U6 ridden on the first live run
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending

---

## Plan coverage map — authored at plan-phase 2026-08-07

> Every row below names the plan and task that OWNS it. Statuses are filled in by each plan's SUMMARY
> and consolidated by **189-16 Task 2**. A row whose RED was never observed is recorded as such, not
> as a pass.

### Automated rows

| # | Owning plan · task | Note |
|---|---|---|
| V01 | **189-01 T1** (authored RED) → **189-07 T1** (green) | the 7th union member; unknown key still 422s; a pre-189 row still validates |
| V02 | **189-01 T2** (authored) → **189-09 T1** (green) | `PHASE_TYPE_REGISTRY` resolves the type |
| V03 | **189-12 T1 + T2** | the picker offers SEVEN, the 7th LAST, the shipped six unmoved |
| V04 | **189-09 T2** | the capability rides `phase_whitelist`; `dispatch_tool` refuses an off-list name |
| V05 | **189-01 T1** (set assertion) → **189-07 T2** (`grounding_cause` is None) | assert the SET, never one name |
| V06 | **189-01 T1** (RED) → **189-07 T2** (green) | ⚠ **T2 — the D-04 disarm paths.** Round-trip `armed: false`, assert True, with an `llm_single` negative control |
| V07 | **189-05 T2** | the run-time checkpoint fires on an armed phase (live, non-golden) |
| V08 | **189-14 T2** | the arming switch renders ON and non-interactive, driven by a real click |
| V09 | **189-01 T1** (RED) → **189-07 T1** (green) | cannot be wired around: `available_tools` carries the capability |
| V10 | **189-01 T2** (RED) → **189-09 T1** (green) | SC#4's only mechanical proof — patched transport, plus an inertness control |
| V11 | **189-01 T2** | the `mcp` source fence over `backend/app`, with a POSITIVE CONTROL |
| V12 | **189-11 T2** | ⚠ assert **the NEXT phase ran**, not merely the status |
| V13 | **189-01 T3** (green-skip) → **189-06 T2/T3** (PASS after the operator applies) | positive AND negative CHECK controls — D-17 as a test |
| V14 | **189-08 T1** + **189-10 T1** | ⚠ exact-match assertions only — the new word shares a prefix with a shipped one |
| V15 | canvas **189-10 T1** · panel **189-08 T2** · phase output **189-09 T1** | D-07's three surfaces |
| V16 | **189-11 T1** (guard confirmed unchanged) | D-09 — the shipped registration test already guards it |
| V17 | **189-15 T1 + T2** | badge slot 1 conditional; the third-badge control RE-OBSERVED swinging |
| V18 | **189-13 T2** | all three capabilities, plus an unknown value falling through without fabricating |
| V19 | **189-13 T1** | the split-brain fence as a KEY-SET property, observed RED |
| V20 | **189-02 T1** (RED captured) → **189-05 T2** + **189-04 T2** (fixes) → **189-11 T2** (green) | **the phase's headline gate** — RED at HEAD for TWO independent reasons |
| V21 | **189-02 T2** (RED) → **189-04 T2** (green) | with a control forbidding a fix that weakens rule 2 |
| V22 | **189-02 T3** (guard + observed plant) → **189-04 T2** (stays green) | ⚠ **T1 — the D-20 governance hole** |
| V23 | **189-03 T1 + T2** | the doc exists; the D-entry points at it without restating it |

### Driven rows — jsdom cannot reach any of these

| # | Owning plan · task | Note |
|---|---|---|
| U1 | **189-16 T3** | glyph luminance against the other six on one canvas |
| U2 | **189-16 T3** | occlusion, **with a falsification control observed swinging BOTH ways** |
| U3 | **189-16 T3** | eight dash-arrays; the new reading is the only FOUR-arc one; greyscale pass |
| U4 | **189-16 T3** | card height + the spine's edge baseline unmoved; neighbours do not reflow |
| U5 | **189-16 T3** | **OWED from 188.2** — rides the SAME live run |
| U6 | **189-16 T3** | **OWED from 188.2** — one glance, zero cost, same session |
| U7 | **189-06 T2** | the operator applies migration 115 via the Supabase SQL editor |

**Also ridden on the same live session (189-16 T3):** D-25's accepted band-versus-node pairing, and the
driven reachability row the separately-tracked WR-04 bug is still open for.

**Wave-0 gap ownership:** the three new backend suites are **189-01**; the new frontend suite
(`ExternalActionSection.test.tsx`) is **189-14 T1**, and its `TARGETS` entry lands in the commit that
creates it.
