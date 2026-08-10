---
phase: 189
slug: governed-external-action-node-model
status: driven-complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-07
consolidated: 2026-08-07
consolidated_by: 189-16 Task 2
---

<!--
FLAG EVIDENCE — both flags below are set from measurement, and the one that stayed false
stayed false deliberately.

wave_0_complete: true
  All three Wave-0 backend suites exist and run, and the migration gate is no longer skipping:
    backend/tests/unit/test_189_external_action_model.py   (189-01, 8 REDs observed at HEAD)
    backend/tests/unit/test_189_no_egress.py               (189-01, 3 REDs observed at HEAD)
    backend/tests/test_migration_115.py                    (189-01 green-skip -> 189-06, 3 passed)
  The fourth Wave-0 item (a picker component suite) landed as
    frontend/src/components/workflows/ExternalActionSection.test.tsx (189-14 T1, 25 cases).

nyquist_compliant: false  <-- NOT an oversight. It is the honest reading.
  Every V row has an automated command and a verdict (all 23 green). But SIX of the seven U
  rows have NEVER BEEN DRIVEN, and they are precisely the rows no automated command can
  reach: jsdom applies no CSS, computes no stacking contexts, and .click() bypasses
  hit-testing entirely. Setting this true on the strength of "an explicit owed note" would
  make the flag mean "we wrote down that we did not look", which is the scoreboard-that-lists-
  only-what-passed failure this file exists to prevent.

  FLIPS TO true WHEN: the 189-16 Task 3 live session records PASS/FAIL verdicts for U1-U6
  plus the D-25 pairing and BUG-260807-01's reachability row, with U2's falsification control
  observed swinging BOTH ways. Nothing else is outstanding.

  ⚠ FLIPPED TO true at /gsd:verify-work 189, 2026-08-08. The trigger above fired exactly as
  written — checked condition by condition rather than on a general sense that the session
  "went well":
    U1 ✅ · U2 ✅ · U3 ✅ · U4 ✅ · U5 ✅ · U6 ✅ · U7 ✅   (all seven have verdicts)
    D-25 ✅ — the RENDERED half, not just the wire
    U2's falsification control OBSERVED SWINGING BOTH WAYS — a zIndex 99999 plant drove
      badgeReachable true -> false, removal drove it false -> true. Both recorded.
    BUG-260807-01's reachability row ⛔ FAILED — which SATISFIES the trigger. The trigger
      asked for a PASS/FAIL verdict, not a pass. The row failed into a named successor
      (BUG-260808-01) and the operator routed it out of this phase at the verify gate.
  The flag now means "we looked, and here is what we saw" — which is what it was held false
  to protect. It is NOT being set on the strength of an owed note.
-->

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
| **Full suite (backend, 189 scope)** | the 9-file command in RESEARCH §D15 — **baseline 166 passed / 2 pre-existing failures** (named there). ⚠ **189-02 added a TENTH file, `tests/unit/test_publish_service.py`** (baseline 20 passed, now 23 passed / 2 intentional CONFLICT-1 REDs) — the 9-file command does NOT cover the D-19 falsification. Append it. |
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
| V20 | D-06 · **D-19** | **An `external_action` workflow PUBLISHES** — mock the judge, assert `published: true`, `blocked_stage` absent. **This test fails RED at HEAD and is the phase's headline gate.** | unit | `pytest tests/unit/test_publish_service.py -q` | ✅ extend ⚠ **POINTER CORRECTED 2026-08-07 (189-02)** |
| V21 | D-06 · **D-20** | Stage 2.6 emits **no** `unregistered_tool` finding for the three capabilities | unit | `pytest tests/unit/test_103_grounding_fidelity.py -q` | ✅ extend |
| V22 | **D-20** leak | The three capabilities are **NOT** in `GroundingBundle.tools` — so no `llm_agent` can whitelist one | unit | `pytest tests/test_182_grounding_bundle.py -q` | ✅ extend ⚠ 2 pre-existing DB failures in this file |
| V23 | SC#3 · D-10 | The `docs/` doc exists and the `DECISIONS.md` entry **points at it without restating it** | grep fence | doc-fence test **or** `checkpoint:human-verify` | ❌ **Wave 0 or checkpoint** |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `backend/tests/unit/test_189_external_action_model.py` — **NEW.** D-04's stored-false coercion
      (V06), D-02's closed-set raise, the emptied-`available_tools` refusal (V09).
      **DONE — 189-01 (`d8926830`), 8 failed / 2 passed at HEAD.** All 8 flipped by 189-07.
- [x] `backend/tests/unit/test_189_no_egress.py` — **NEW.** SC#4: the `grep mcp → 0` source fence
      (V11) + the patched-transport falsification (V10).
      **DONE — 189-01 (`47d0a988`), 3 failed / 5 passed at HEAD.** All 3 flipped by 189-09; 16 passed now.
      ⚠ **The mandated positive control FALSIFIED ITS OWN PLAN'S REGEX**: `\bmcp\b` does not match
      `MCPClient`, so the fence was strengthened to fire on camel/Pascal segment starts too.
- [x] `backend/tests/test_migration_115.py` — **NEW.** The positive/negative CHECK controls (V13);
      runs only after the operator applies the migration.
      **DONE — 189-01 (`41e289f8`) 3 skipped → 189-06 3 passed.** ⚠ **The apply method DEVIATED from
      the plan's stated one** and 189-06 recorded it rather than smoothing it: operator-AUTHORISED,
      but executed verbatim in ONE psycopg2 transaction against `127.0.0.1:54322`, not pasted into
      the Supabase SQL editor. The prohibition the rule exists to enforce HELD — no `supabase db push`,
      no `db reset` — and that is proved by DATA, not asserted: `workflow_phases` reads **439 rows**
      before and after, `workflow_runs` 197, `threads` 711.
- [x] A capability-picker component test file **if** the picker becomes its own component.
      **DONE — the picker DID become its own component.** `ExternalActionSection.tsx` (185 L) +
      `ExternalActionSection.test.tsx` (25 cases), 189-14 T1 (`0024e03e`).
- [x] **No framework install needed** — vitest and pytest are both present and green at baseline.
      **CONFIRMED — Phase 189 installed NOTHING.** No `npm install`, no `pip install`, no
      package-legitimacy checkpoint was owed (`T-189-SC`).
- [x] ⚠ **Every new frontend suite needs its `TARGETS` entry IN THE COMMIT THAT CREATES IT.**
      **SATISFIED — but the RULE AS WRITTEN WAS MEASURED FALSE, twice, and the correction is the
      useful part.** `src/components/workflows` is a **DIRECTORY** entry in the gate's `TARGETS`, so
      both new suites (`runVocabulary.test.ts`, 189-10; `ExternalActionSection.test.tsx`, 189-14) RAN
      THE MOMENT THEY EXISTED and `TARGETS` was never edited — only `BASELINE` was owed. The gate
      printed `runVocabulary.test.ts — 12 new` before any pin was written. The rule's INTENT (a new
      suite must not be able to hide from the gate) held both times; its LETTER applies only to
      `src/lib/` and `src/pages/`, which are named-file-only.

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

- [x] All tasks have `<automated>` verify or a Wave 0 dependency — **MEASURED, not assumed:**
      `grep -c "<task type=" ` vs `grep -c "<automated>"` over all sixteen plans reads
      **34 tasks / 34 `<automated>` blocks**, a per-plan exact match on every one.
- [x] Sampling continuity: no 3 consecutive tasks without an automated verify — **follows from the
      line above**: the count matches per plan, so there is no run of even ONE unverified task,
      let alone three.
- [x] Wave 0 covers all ❌ MISSING references above (V06, V09, V10, V11, V13, V23) — **five of six
      by Wave-0 suite; V23 by the alternative this file already offered.** V06/V09 →
      `test_189_external_action_model.py`; V10/V11 → `test_189_no_egress.py`; V13 →
      `test_migration_115.py`. **V23 took the `grep fence` branch of its own "doc-fence test **or**
      `checkpoint:human-verify`" spec**, in 189-03: thirteen greps whose expected values would change
      if the content were wrong. See the V23 row for why neither guard is vacuous — and for the one
      thing that is honestly weaker about it.
- [x] Every new frontend suite has its `TARGETS` entry in the same commit — ⚠ **ticked WITH A
      CORRECTION, not as written.** Neither new suite needed a `TARGETS` entry: both live under a
      DIRECTORY target and ran on creation. See the Wave-0 item above.
- [x] No watch-mode flags anywhere — **MEASURED:** `grep -c -- "--watch\|vitest watch"` over all
      sixteen `189-NN-PLAN.md` returns **0** in every file.
- [x] Feedback latency < 15 s per task — the per-task targeted commands ran in **0.28 s – 5.04 s**
      (backend) and seconds (frontend targeted). The count gate (~2–3 min) is a per-WAVE gate, as
      specified, not a per-task one.
- [ ] Driven rows U1–U4 executed via Chrome MCP; U5/U6 ridden on the first live run
      — ⚠ **UNTICKED. NOT DONE. NOT PARTLY DONE.** 189-16 Task 3 is a BLOCKING human-verify
      checkpoint and it has not been run. This box is the whole reason `nyquist_compliant`
      stays `false`. **An unticked box with a reason is information; a ticked box without
      evidence is not.**
- [ ] `nyquist_compliant: true` set in frontmatter — ⚠ **UNTICKED**, and deliberately. See the
      flag-evidence comment in the frontmatter for the exact condition that flips it.

**Approval:** ⚠ **PENDING — and specifically pending ONE live session, not pending more code.**
All 23 automated rows are green and all three full-suite gates are at or above baseline. What is
owed is the set of claims a green unit suite structurally cannot make.

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
| V20 | **189-02 T1 ✅ RED CAPTURED** → **189-05 T2** + **189-04 T2** (fixes) → **189-11 T2** (green) | **the phase's headline gate** — RED at HEAD for TWO independent reasons. ⚠ Lives in `tests/unit/test_publish_service.py`, NOT `tests/test_publish_gate.py` (which is the Phase-136 SKILL gate — see `189-02-SUMMARY.md` Deviation 1). **189-05 must turn `test_an_armed_phase_does_not_subscribe_to_the_ask_channel_on_a_golden_run` and `test_the_armed_golden_run_subscribe_carries_the_indefinite_wait` green WITHOUT breaking `test_a_live_non_golden_run_still_pauses_on_an_armed_phase` or `test_the_armed_checkpoint_is_not_a_validator`.** |
| V21 | **189-02 T2 ✅ RED CAPTURED** → **189-04 T2** (green) | with a control forbidding a fix that weakens rule 2. **189-04 must turn `test_an_external_capability_in_available_tools_produces_no_unregistered_tool_finding` green while `test_a_genuinely_unknown_tool_still_produces_the_finding` stays green.** |
| V22 | **189-02 T3 ✅ AUTHORED + PLANT OBSERVED RED** → **189-04 T2** (stays green) | ⚠ **T1 — the D-20 governance hole.** `test_external_action_capabilities_are_absent_from_the_author_facing_tool_options` PASSES today and must never go red. |
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


---

## ⚠ CONSOLIDATED COVERAGE MAP — closed out at 189-16 Task 2, 2026-08-07

> The plan-time map above records what was PROMISED. This one records what was DELIVERED, and the
> two are meant to be read against each other. Every figure here was **re-derived by running the
> command**, never carried from a plan or a prior SUMMARY — twenty-plus pointer-drift catches in
> this phase are why.
>
> **The RED column is the point of this table.** A green whose RED was never observed is recorded
> as such, not as a pass. Four distinct grades appear, and they are not interchangeable:
>
> | Grade | Meaning |
> |---|---|
> | **RED→GREEN** | The assertion was observed FAILING at HEAD in one plan and PASSING in a later one. The strongest grade. |
> | **PLANT RED** | Authored green, but a deliberate wrong fix was driven into PRODUCTION source and observed turning it red, then restored (md5-verified). Non-vacuity is proved. |
> | **CONTROL** | Authored green with a matched positive/negative control in the same suite, so the assertion cannot pass for the wrong reason. No falsification observed. |
> | **GREEN-ONLY** | Authored green in the same plan as the source change, with no observed falsification. Weakest. Named explicitly wherever it applies. |

### Automated rows — V01 … V23

| # | Owning plan · task | Status | Command (re-run at phase close) | RED evidence |
|---|---|---|---|---|
| **V01** | **189-01 T1** (behaviour) → **189-07 T1** (assertions) | ✅ green | `pytest tests/unit/test_harness_models.py -q` | ⚠ **MIXED, and the distinction is recorded rather than rounded up.** The BEHAVIOUR was RED at HEAD — 189-01 observed 8 failures in `test_189_external_action_model.py`. But V01's own assertions in `test_harness_models.py` were **authored GREEN by 189-07 in the same plan as the union member**, and could not have been red. Grade: RED→GREEN for the behaviour, **GREEN-ONLY for the row as written**. |
| **V02** | **189-09 T1** | ✅ green | `pytest tests/test_harness_engine.py -q` → **44 passed** | **CONTROL.** Authored green beside the executor (+1 case, 40→41 at 189-09). Non-vacuity carried by an **unregistered-type control** in the same test, not by an observed RED. |
| **V03** | **189-12 T1 + T2** (ONE commit — the type reds five suites the instant it lands) | ✅ green | `npx vitest run src/components/workflows/definitionOps.test.ts src/components/workflows/StepTypePicker.test.tsx` → **243 / 46** | **RED→GREEN + PLANT RED.** `tsc` moved **33 → 37 → 33**: the 7th type raised four real errors, one of them a `TS7053` at `slugForType` **that no planning document lists**. Plants **V / W / X** each observed RED — and only the D-23 cross-language fence can see V (a client member the server lacks). ⚠ RESEARCH's *"sixteen six-count pins"* was **WRONG BOTH WAYS — 5 missing, 6 that do not move**; four of the five were SHAPE assertions a grep cannot see, found by RUNNING the suite. |
| **V04** | **189-09 T2** | ✅ green | `pytest tests/test_harness_whitelist.py -q` → **12 passed** (was 8) | **CONTROL.** Four DRIVEN proofs that D-03 rides the **shipped** `phase_whitelist` refusal with no second guard added. No observed RED. |
| **V05** | **189-01 T1** → **189-07 T2** | ✅ green | `pytest tests/unit/test_185_detection.py -q` | **RED→GREEN.** The D-15 assertion is on the **SET** (`{send_email, create_ticket, post_message} ∩ KB_TOOLS == ∅`), never one name, exactly as the row demands. 185's L-2 fence was NARROWED and the reason recorded. |
| **V06** | **189-01 T1** (RED) → **189-07 T2** (green) | ✅ green | `pytest tests/unit/test_189_external_action_model.py -q` | **RED→GREEN.** One of 189-01's 8 observed REDs. The D-04 pin lives on **`PhaseSpec`, not `WorkflowDefinition`** — a definition-level validator only fires when a WHOLE definition is parsed, so a `PhaseSpec` parsed alone would have read unarmed. Carries an `llm_single` negative control. |
| **V07** | **189-05 T2** | ✅ green | `pytest tests/unit/test_187_armed_checkpoint_property.py -q` → **30 passed** | **PLANT RED.** Four wrong-fix plants driven into production source, each observed RED. The **preservation** half is the load-bearing one: `test_a_live_non_golden_run_still_pauses_on_an_armed_phase` had to STAY green while the golden-run branch landed, and it did. |
| **V08** | **189-14 T2** | ✅ green | `npx vitest run src/components/workflows/GovernanceSection.test.tsx` → **49 passed** (was 42) | **CONTROL (negative-first) + PLANT RED.** The negative control was written **FIRST**, because the "renders ON and non-interactive" pin is otherwise satisfiable by disabling the control everywhere. Six plants. The switch is rendered ON, `disabled`, `aria-disabled`, explained in text, and **not struck through** (185's "remove a dead control" does not apply — the control is pinned, not dead). |
| **V09** | **189-01 T1** (RED) → **189-07 T1** (green) | ✅ green | `pytest tests/unit/test_189_external_action_model.py -q` | **RED→GREEN.** `available_tools` is **TOTAL REPLACEMENT** by `[capability]`, not a merge — a merge would let an author park `search_documents` on the step and silently arm the grounding dial, since detection is `available_tools ∩ KB_TOOLS`. Replacement is fail-CLOSED. |
| **V10** | **189-01 T2** (3 REDs) → **189-09 T1** (green) | ✅ green | `pytest tests/unit/test_189_no_egress.py -q` → **16 passed** (was 3 failed / 5 passed) | **RED→GREEN + PLANT RED.** SC#4's **only mechanical proof**: the HTTP transport is patched to RAISE, the executor runs, and it does not raise. Three wrong-fix plants each observed RED. |
| **V11** | **189-01 T2** | ✅ green | `pytest tests/unit/test_189_no_egress.py -q` · `grep -rni "\bmcp\b" backend/app --include=*.py` → **0** | ⚠ **CONTROL — and the strongest single control in the phase, because it falsified the plan that mandated it.** The plan specified `\bmcp\b`; the positive control proved that regex **does not match `MCPClient`**, so the fence would have passed over a real MCP client. Strengthened to fire on word AND camel/Pascal segment starts. **A control that never fires is a control nobody has tested.** |
| **V12** | **189-11 T2** | ✅ green | `pytest tests/test_harness_engine.py -q` → **44 passed** | **PLANT RED — and the plants found what the assertions could not.** Plants **J / K / L / M** each observed RED. ⚠ Under **J** the receipt fence stayed GREEN, and under **L** BOTH V20 and the D-05 core test stayed GREEN — the fourth time this phase that the headline proof was blind to a real defect and exactly one test could see it. "The run CONTINUES" is bought **by placement** and proven **by the next phase running**, never by the status alone. |
| **V13** | **189-01 T3** (green-skip) → **189-06 T2/T3** (PASS) | ✅ green | `pytest tests/test_migration_115.py -q` → **3 passed** (live `:54322`) | **CONTROL, both directions driven.** V13a: `recorded_not_sent` is ADMITTED. V13b: the rendered sentence `'Not sent — recorded'` is **REJECTED** with SQLSTATE **23514** naming `workflow_phases_status_check`. D-17 is now an executable test, not a comment. Every write rolls back — `workflow_phases` reads 439 before and after. |
| **V14** | **189-08 T1** + **189-10 T1** | ✅ green | `npx vitest run src/lib/phaseState.test.ts src/components/workflows/PhaseNodeCard.test.tsx` → **40 / 132** | **CONTROL + PLANT RED.** Exact-match **inequality** against every word the surface ships (`Locked`, `Running`, `Complete`, `Failed`, `Attempt`, `Skipped`, `Unknown`), never `toContain` — the new word shares a prefix with a shipped one. A positive control renders a `done` card and confirms the comparison **can** find equality, so seven inequalities are seven measurements rather than seven no-ops. |
| **V15** | canvas **189-10 T1** · panel **189-08 T2** · phase output **189-09 T1** | ✅ green | `npx vitest run src/pages/WorkflowRunPage.test.tsx src/components/workflows/PhaseNode.test.tsx` + `pytest tests/unit/test_189_no_egress.py -q` | **PLANT RED (canvas half).** Six wrong fixes planted into production source in 189-10, each observed RED, each restored by md5. ⚠ The **intermediate state was MEASURED rather than argued**: with 189-08 shipped and 189-10 not yet, the canvas rendered the reading as `State unknown` with the DOTTED unknown ring — **never `Complete`**, never the closed circle. |
| **V16** | **189-11 T1** | ✅ green | `pytest tests/unit/test_audit_event_registration.py -q` → **6 passed** | ⚠ **NO RED IS POSSIBLE, and that is the row's meaning.** The guard PREDATES 189; its value is that it **did not move**. D-09 declines a new `harness_audit` event type, so the recorded terminal rides the EXISTING `phase_transition` kind (`via: recorded_not_sent`) and the Python literal set carries a **zero-line diff**. A `recorded_not_sent` phase writes **no** `phase_completed` receipt — consequence is not receipt. |
| **V17** | **189-15 T1 + T2** | ✅ green | `npx vitest run src/components/workflows/PhaseNodeCard.test.tsx src/components/workflows/WorkflowCanvas.test.tsx` → **132 / 53** + `tsc -p tsconfig.app.json` = **33** | ⚠ **THE ONE ROW WITH A CONTROL OBSERVED SWINGING BOTH WAYS IN THE AUTOMATED SET: the `@ts-expect-error` third-badge control moved 33 → 34 → 33, planted and restored.** A third badge is a **typecheck error**, not a convention. **AND the phase's most valuable negative finding lives here:** under **PLANT 1** (a type-conditional gate instead of D-12's state-conditional one) **all four RENDER cases stayed GREEN** and only the SOURCE fence went red — because nothing can be connected to anything until Phase 190, so the two gates render byte-identically. **A DOM-only suite would have shipped the coupling D-12 exists to prevent.** |
| **V18** | **189-13 T2** | ✅ green | `npx vitest run src/components/workflows/phaseVocabulary.test.ts` → **112 passed** (was 96) | **PLANT RED.** **Z2** (an ungated tier let `llm_single` claim *Sends an email*) and **Z3** (a FABRICATED face for an unknown capability) each observed RED. All three capabilities covered; an unrecognised value falls to the tier-3 sentence **without fabricating**. |
| **V19** | **189-13 T1** | ✅ green | `npx vitest run src/components/workflows/soulData.test.ts` → **17 passed** (was 14) | **PLANT RED.** **PLANT Y** — the key added to ONE map only — produced **3 failures**. The split-brain rule is now a **KEY-SET property** via `PHASE_GLYPH_MARK_KEYS`, so a **NINTH** type inherits the guard. ⚠ The **KEYS** are exported and the **MAP** is not, deliberately: handing out the map would let a caller bypass `phaseGlyph()`'s own-property guard — the `[Function Object]` React child that hard-crashed a node face at 188.1-04. |
| **V20** | **189-02 T1** (RED CAPTURED) → **189-05 T2** + **189-04 T2** (the two fixes) → **189-11 T2** (GREEN) | ✅ green — **the phase's headline gate** | `pytest tests/unit/test_publish_service.py -q` → **28 passed** ⚠ **NOT `tests/test_publish_gate.py`** | ⚠ **RED→GREEN, AND THE STRONGEST RESULT IN THE PHASE: both original REDs were RE-OBSERVED THROUGH V20 ITSELF.** Quoting a prior plan's RED beside a green proves two things happened, not that they are connected — so each upstream fix was **UNDONE in production source** and V20 re-run: reverting 189-05 → `blocked_stage='golden_run_error'`; reverting 189-04 → `blocked_stage='grounding_fidelity'` with `{'code': 'unregistered_tool', … 'send_email'}`. Both restored md5-identical, `grep -c REVERTPLANT` → 0. Four more plants (J/K/L/M) each RED. ⚠ **AND ONE DEFECT FOUND BY ACCIDENT:** V20's first run passed every publish assertion **over an EMPTY phase spine** (`load_run_phases → []`, `published: True`) — a publish test asserting only the verdict cannot tell a workflow that ran from one that did not. |
| **V21** | **189-02 T2** (RED CAPTURED) → **189-04 T2** (green) | ✅ green | `pytest tests/unit/test_103_grounding_fidelity.py -q` | **RED→GREEN, with a control forbidding the wrong fix.** RED at HEAD across **all three** capabilities. The green had to arrive by widening `tool_names` ONLY — `test_a_genuinely_unknown_tool_still_produces_the_finding` stays green, so rule 2 cannot be weakened into a pass. ⚠ `tool_names` is read **off the production `assemble_grounding_bundle`**, never recomputed: a re-typed set would have had to be EDITED to go green, which is a test that measures the patch. |
| **V22** | **189-02 T3** (authored green, **PLANT OBSERVED RED**) → re-run green at 189-04 / 07 / 09 / 11 / 13 / 14 | ✅ green — **the phase's single net-new security property** | `pytest tests/test_182_grounding_bundle.py -k "author_facing or external_action"` → **1 passed** | **PLANT RED — and it is the ONLY thing that can see the D-20 hole.** 189-04's PLANT 2 showed the entire fidelity suite stays **GREEN** while the governance hole is open. 189-13's **PLANT Z5** (the exact D-20 wrong fix — give the type the generic rail and widen its options) went RED on four of five guards. ⚠ **189-04 deliberately REFUSED to edit this file** though the plan listed it: editing the only guard between a change and a governance hole, in the commit that could open that hole, is the one edit worth refusing. |
| **V23** | **189-03 T1 + T2** | ✅ green | `grep -c "MCP-first" docs/CONNECTOR-ARCHITECTURE.md` → **3** · `grep -c "^\|" …` → **0** · `grep -c "D-v3.6-01" .planning/prd-reset/DECISIONS.md` → **2** · `grep -c '^### '` inside the new section → **0** | ⚠ **GREEN-ONLY — the weakest grade in the table, and it is named rather than dressed up.** No RED was observed and none was possible: this is a doc-existence fence, and it took the `grep fence` branch of its own "doc-fence test **or** checkpoint" spec. What keeps it non-vacuous is that the two guards count things the **REJECTED** shapes would produce: `^\|` = 0 is the D-11 no-competitor-scoring-table guard, `^### ` = 0 is the D-10 not-a-full-ADR guard. What it still cannot tell you is whether the doc is any GOOD — SC#3 is satisfied structurally, not editorially. |

**Automated total: 23 / 23 green.** Grades: **8 RED→GREEN · 8 PLANT RED · 5 CONTROL · 2 GREEN-ONLY (V01-as-written, V23).**

### Driven rows — U1 … U7. jsdom reaches NONE of U1–U6.

**jsdom applies no CSS, computes no stacking contexts, and `.click()` bypasses hit-testing entirely.
That is how `BUG-260806-01` survived from 184-12 and how `BUG-260807-01` survived until 2026-08-07.
A green unit suite is not evidence for any row below.**

| # | Owning plan · task | Status | What is owed | Blocking condition |
|---|---|---|---|---|
| **U1** — 7th glyph VISIBLE, not ~4× dimmer than the other six | **189-16 T3** | ⛔ **NOT DRIVEN — OWED** | Seven computed fill/luminance figures read off ONE canvas showing all seven types, the seventh compared against the other six | Live stack (backend + local DB + Redis, **operator-started**) + a Chrome MCP session. ⚠ 189-13 recorded, IN THE TEST'S OWN COMMENT, that **presence is not visibility**: the slug `outbox-tray` was verified present in the INSTALLED `@iconify-json/fluent-emoji@1.2.7` (3174 icons) and a missing slug was PROVED to fail the build — but **168.4 is an unweighted palette estimate**, and the `llm_batch_agents` luminance-34.5 defect was a present, in-band, plausible value that still disappeared on screen. |
| **U2** — the "Not connected" badge neither occludes nor is occluded | **189-16 T3** | ⛔ **NOT DRIVEN — OWED** | `document.elementFromPoint(x,y)` at the badge's own centre AND at the ⛨ seal, the verdict mark and the ✕/＋ lane affordances — **with a falsification control observed swinging BOTH ways** | Same. ⚠ **An unfalsified pass proves nothing here.** This is exactly how `BUG-260806-01` was closed: move or resize something so the check FAILS, confirm it fails, restore, confirm it passes. |
| **U3** — the 8th ring distinguishable **by shape alone in greyscale** | attribute half **189-10 T1** ✅ · **visual half 189-16 T3** | ⚠ **HALF DONE.** Attribute half ✅ green; **greyscale half ⛔ NOT DRIVEN** | The eight `stroke-dasharray` / `stroke-dashoffset` strings read off the LIVE DOM, then the canvas viewed with `filter: grayscale(1)` | Same. **What 189-10 DID prove, mechanically:** the new reading is the **only FOUR-arc** one, captured from the rendered DOM twice and md5-identical, with an `EXPECTED_RING` falsification row and six plants each RED. Every number UI-SPEC §4b predicted was independently recomputed and matched — including dashoffset **16.022** and the four gap centres **.125 / .375 / .625 / .875**, none of which is 0.75. **What no unit test can say is whether eight shapes are still eight shapes to a human eye with the colour taken out.** |
| **U4** — the badge does not push the card out of its height budget | **189-16 T3** | ⛔ **NOT DRIVEN — OWED** | `getBoundingClientRect()` on the card with and without the badge, **and** an adjacent node's position both times | Same. ⚠ **The acceptance is that the spine's edge baseline does not move and no neighbour reflows — NOT that all cards are the same height.** This card is legitimately taller than its neighbours. |
| **U5** — **OWED SINCE 188.2** (`D-188.2-DEF-07`, row A2) | **189-16 T3** | ⛔ **NOT DRIVEN — OWED (a debt older than this phase)** | On a live run: the seven shipped readings stay distinguishable by shape · the running arc actually **spins** · a card with no reading is **still** | Same session. It has been owed since Phase 188.2 **because it needs a live run**, and this phase launches live runs — which is the entire reason all three debts were routed onto ONE session rather than three. |
| **U6** — **OWED SINCE 188.2** (`D-188.2-DEF-08`, row A1's visual half) | **189-16 T3** | ⛔ **NOT DRIVEN — OWED (a debt older than this phase)** | One glance at a Builder card | Same session. **Zero marginal cost** — pair with U5. |
| **U7** — migration 115 APPLIED to the live local DB | **189-06 T2** | ✅ **DONE** | — | ⚠ **Applied by a method the plan did not name, and 189-06 recorded the deviation rather than smoothing it.** Operator-AUTHORISED, executed verbatim in ONE psycopg2 transaction against `127.0.0.1:54322`, **not** pasted into the Supabase SQL editor. **The prohibition the rule exists to enforce held completely** — no `supabase db push`, no `db reset` — and that is proved by DATA: `workflow_phases` **439 rows** before and after. `full-schema.sql` was regenerated by `scripts/regenerate-full-schema.sh` in DEFAULT mode (**no `--reset`**), never hand-edited, and the diff is **ONE line**. |

### Also owed on the SAME live session (189-16 T3) — neither is a U row, and neither may be dropped

| Item | Status | What is owed |
|---|---|---|
| **D-25** — the run band's RUN-level verdict above a node's PHASE-level *"Not sent — recorded"* | ⛔ **NOT DRIVEN — OWED** | Confirm on screen that the pairing reads as **intended**, not as a contradiction. ⚠ **This is a RECORDED DECISION, not a defect found in testing** — the band is a RUN-level verdict, the node a PHASE-level one, and the run genuinely did complete. It is listed because *an accepted divergence nobody wrote down is indistinguishable from a bug when someone meets it on screen.* |
| **`BUG-260807-01`** — the WR-04 driven reachability row | ⛔ **NOT DRIVEN — OWED**; the report stays `status: open` for this row **only** | Create a phase whose slug is an INHERITED PROPERTY NAME (e.g. `constructor`) and confirm its affordances remain reachable **at their own coordinates** via `document.elementFromPoint`. The code fix already shipped standalone (`267f6347`) — see D-14 below. **jsdom cannot see this defect**, so a green unit suite is not evidence. |
| **`D-189-DEF-03`** — the latency-of-honesty gap | ⛔ **NOT DRIVEN — and it is the single thing this session is most likely to catch that no unit test will** | The `recorded_not_sent` branch emits **NO SSE**, deliberately (`phase_completed` maps to a *"✓ Complete"* card in `StreamsProvider.onPhaseCompleted`, so emitting it would paint the exact lie the branch exists to prevent). But emitting nothing lets `finalizeAllPhasesForThread` sweep the card to `done` at `run_completed`, **so a live viewer sees "Complete" until a reconcile fetch.** Watch for it during the run. Phase 190 owns the fix (a new SSE + a client handler + a sweep exclusion, in ONE commit — a plan, not a deviation). |

**Driven total: 1 done (U7) · 1 half (U3) · 5 not driven · 3 further items owed on the same session.**
**No driven row was silently dropped, and none is recorded as passing on a unit suite's evidence.**

---

## Standing debts recorded at phase close — not V/U rows, and not to be lost

| Item | State at close | Trigger |
|---|---|---|
| **`D-189-DEF-01`** — `test_182_extraction_parity.py::test_nl_gen_regression_test_count_unchanged` | ⚠ **STILL RED. Re-measured at close, not inherited:** `1 failed, 5 passed`; the pin expects **2** and `test_103_grounding_fidelity.py` now holds **7** `def test_`. Broken by **189-02** (`fe7bd092`), not by any later plan. ⚠ **It is invisible to every phase-scope command** — it is in neither the 9-file nor the 10-file nor the 14-file set, so the phase's standing baseline structurally cannot see it. | Its own re-open trigger has **NOW FIRED**: 189 has stopped adding tests to that file and this is the last plan. The fix is ONE literal at `backend/tests/test_182_extraction_parity.py:303` (`== 2` → the then-current count). ⚠ Whoever bumps it must ALSO add `tests/test_182_extraction_parity.py` to the phase-scope command, so the next drift is visible the day it happens. The sibling `test_103_nl_generate.py` pin (`== 6`) is still correct and **must not be touched**. |
| **`D-189-DEF-02`** — the author-facing tool rail | ✅ **CLOSED at 189-13** (`5963ba4b`) — ⚠ **and its PREMISE was measured FALSE first.** `PhaseFormPanel.tsx` has six mutually exclusive `pt === …` branches and **no default arm**, so `external_action` never reached the generic rail and **no render code changed**. What was missing was the MECHANICAL guard: five cases now fence it, four went RED under PLANT Z5. | None. Closed. |
| **`D-189-DEF-03`** — the live run surface has no honest wire signal | ⛔ **OPEN.** Recorded in full above. | **Phase 190**, which MUST close it — or `/gsd:verify-work 189` if the owed live session observes it first. |
| **Cloud parity for migration 115** | ⛔ **OWED — UNAPPLIED to cloud.** 115 joins the standing queue at **migs 099 onward**, plus `SECRETS_ENCRYPTION_KEY`. | The next **operator-gated** production push. Order matters; apply in sequence via the cloud Supabase SQL editor. **Code deploying ≠ cloud configured.** |
| **`BUG-260807-01`** | ⛔ **OPEN — for its driven browser row ONLY.** The code fix shipped standalone. | The owed live session (above). |

---

## D-14 — the boundary, PROVEN BY A DIFF rather than asserted

`BUG-260807-01` was routed **OUT** of this phase by the operator (D-14): its own report proposed
folding it in as *"a natural, cheap rider"*, and the sizing said otherwise — one file, one import,
two call sites, no schema, no API surface, squarely G-3 `/gsd:fast` territory. It is **188.2's own
residue** and it degrades a fix 188.2 had just shipped, so it does not belong on 189's ledger.

**Measured at phase close, over the WHOLE phase (`eef887bf..HEAD`, where `eef887bf` is the parent of
`d8926830`, the first 189-01 commit):**

```
$ git diff --stat eef887bf..HEAD -- frontend/ backend/ supabase/ docs/ CLAUDE.md
  60 files changed, 7757 insertions(+), 228 deletions(-)

$ git diff --name-only eef887bf..HEAD | grep -ci "editAffordance\|providerLogo"
  0                     <-- NEITHER D-14 file appears anywhere in the phase

$ git diff --name-only eef887bf..HEAD | grep -ci "PhaseNode.tsx"
  1                     <-- POSITIVE CONTROL: the grep CAN find a file that IS in the diff

$ git diff --diff-filter=D --name-only eef887bf..HEAD | wc -l
  0                     <-- no tracked file deleted anywhere in the phase

$ git merge-base --is-ancestor 267f6347 eef887bf   ->  true
  267f6347 2026-08-07 fix(WR-04): guard the sixth and seventh prototype-pollution sinks (BUG-260807-01)
```

**D-14 HELD.** The WR-04 fix landed in a standalone commit that is an **ancestor of the phase base**,
and no 189 commit touched `editAffordance.ts` or `providerLogo.tsx`. The bug stays OPEN for its
driven browser row only.

## The reported-bugs cross-check — re-run at close, and the result is "none"

```
$ grep -ln "folded_into: *189" .planning/reported-bugs/*.md
  (no match)
```

**NO report carries a `folded_into` value naming 189.** There is therefore nothing this phase owed a
reported bug, and **that is the finding, not an omission** — the project rule requires the check to
be RUN and its result RECORDED, including when the result is empty. (`BUG-260807-01` reads
`folded_into: null` by D-14's design, not by oversight.)

---

## Full-suite gates — re-run at phase close, 2026-08-07, every figure re-derived

| Gate | Baseline in this file | **Measured at close** | Reconciliation |
|---|---|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | 33 | **33** ✅ | Unmoved across all fifteen code plans. It excursioned **33 → 41 → 40** (189-08 armed seven exhaustive tables as a compiler-generated worklist) and **40 → 33** (189-10 consumed them to exhaustion), and **33 → 37 → 33** at 189-12. ⚠ A bare `tsc --noEmit` checks **ZERO** files — the `-p tsconfig.app.json` is load-bearing. |
| `node scripts/vitest-count-gate.cjs` | 2508 / 45 files | **2627 / 47 of 47 pinned, 0 failing** ✅ | **+119 tests, +2 files.** Attribution: 189-08 +13 (2508→2521) · 189-10 +25 (→2546, `runVocabulary.test.ts` NEW) · 189-12 +14 (→2560) · 189-13 +27 (→2587) · 189-14 +32 (→2619, `ExternalActionSection.test.tsx` NEW) · 189-15 +8 (→2627). **No per-file DECREASE at any point.** ⚠ Per `D-188.2-DEF-01` the gate's `failed` column is **NOT** a regression backstop on this machine (it varied 1→21→50→10→0→0 at an identical total). **The COUNT columns are.** ⚠ The script's own `BASELINE_TOTAL` prose comment drifted for **six consecutive plans** — trust the PRINTED value, never the comment. |
| backend — **the canonical NINE** (RESEARCH §D15) | 166 passed / 2 failed | **181 passed / 2 failed** ✅ | **+15 passed**; the two failures are the two NAMED pre-existing `asyncpg … pool is closing` live-DB rows in `test_182_grounding_bundle.py`, unmoved. **No third.** |
| backend — **the TEN** (nine + `tests/unit/test_publish_service.py`) | — | **209 passed / 2 failed** ✅ | ⚠ **THE NINE-FILE COMMAND CANNOT SEE THE D-19 FALSIFICATION OR V20 — the phase's headline gate.** V20 lives in `tests/unit/test_publish_service.py`, which is in NO §D15 set. **Append it.** (+28 = that file entire.) |
| backend — **the FULL 189 scope** (the ten + `test_189_external_action_model.py` + `test_189_no_egress.py` + `test_migration_115.py` + `test_harness_whitelist.py`) | — | **251 passed / 2 failed** ✅ | The honest whole-phase picture. Same two pre-existing failures, nothing else. |

⚠ **`tests/test_publish_gate.py` is the Phase-136 SKILL gate and does not import `publish_service`.**
**THREE consecutive plans (189-02, 189-05, 189-11) were sent to it by their own `files_modified`.**
It was RUN and left unedited every time — 11 passed, unchanged. **V20 lives in
`tests/unit/test_publish_service.py`.** This is written here rather than in a SUMMARY because a
SUMMARY is read once and this file is read by whoever comes next.

⚠ **No SC#10 cross-provider scoreboard is owed for this phase, and none was manufactured** — the
ROADMAP exempts 189 as design/vocabulary work with no live stream.

---

## ⚠ DRIVEN SESSION — 189-16 Task 3, executed 2026-08-07 (Chrome MCP, operator-started stack)

**Stack confirmed up before starting:** backend `:8000` → 200, frontend `:5173` → 200, Supabase
`:54321` → 200, Redis reachable via `REDIS_URL`. Navigation was by CLICKING throughout (the app has
no URL router); every figure below is a script-evaluated DOM/geometry read or a live DB/Redis query —
`take_screenshot` was never used, per the estate's known timeout.

**What was built, by clicking:** the `Compliance Gap Report` draft was opened, switched to the Canvas
tab, and an `external_action` step was inserted **between** `retrieve` and `emit` — deliberately NOT
last, because that is the only arrangement in which the CR-02 mid-run sweep can fire. A second
workflow (`KB Cited Answer`) was built the same way, giving two independent observations of the
picker defect below.

### ⛔ NEW BLOCKER FOUND — the 7th step type is unreachable by mouse

**This is the phase's own headline capability, and it cannot be placed with a mouse.** Found by the
first action of the session; it is why two rows below are recorded as driven-by-workaround.

The `StepTypePicker` menu renders INSIDE the `.react-flow` container, which has `overflow-y: hidden`.
The menu is `position: static`, `z-index: auto`, `maxHeight: none`, and **is not scrollable**
(`scrollHeight === clientHeight`); the document does not scroll either
(`scrollHeight === clientHeight === 666`). Rows extending past the container's bottom edge are
therefore clipped away with **no scroll path to them at all**.

Measured at the default window (`innerHeight` 666, `.react-flow` bottom **656**):

| Row | Label | y range | `elementFromPoint` reachable |
|---|---|---|---|
| 1 | Prepare the inputs | 404..452 | ✅ |
| 2 | Write it up | 452..500 | ✅ |
| 3 | Work out how to do it | 500..548 | ✅ |
| 4 | Work on the parts together | 548..596 | ✅ |
| 5 | Wait for your approval | 596..644 | ✅ |
| 6 | Produce the deliverable | 644..692 | ⛔ |
| **7** | **Sends an email** ← *this phase's type* | **692..740** | ⛔ |

**All three insertion doors fail identically** — `Add a step before step 1`, `before step 2`, and
`at the end` (the last is worst: 3 rows clipped). **Four independent user actions were tried; all
four fail:**

1. **Window resize** — the estate caps `innerHeight` at 732; row 7 still clipped.
2. **Browser zoom** at `0.67` and `0.5` — the anchor sits at a fixed fraction of the container, so the
   overflow is **scale-invariant**. At 0.67 row 6 came back; row 7 never did.
3. **Keyboard** — `ArrowDown` and `Tab` both leave focus on the `＋` button. Focus never enters the
   menu, so there is no keyboard path either.
4. **React Flow's own Zoom Out control** — moves the affordance *down* (306 → 325), making it worse.

**Reproduced on a second, independent workflow** (`KB Cited Answer`), so it is not fixture-specific.

⚠ **Both placements in this session were therefore made with a synthetic `element.click()`, which
bypasses hit-testing.** Recorded rather than smoothed over: the steps below were driven on a workflow
a real user could not have built with a mouse at this viewport.

### Rows driven

| Row | Verdict | Evidence |
|---|---|---|
| **U1** — 7th glyph visible, not ~4× dimmer | ✅ **PASS** | Marks are **identical**, not merely in-band. All seven picker rows: fill `rgb(243,245,252)`, opacity 1, 32×32. On the canvas, all three placed types: fill `rgb(243,245,252)`, **luminance 91.39**, 48×48. Only the tint WELLS differ; the 7th's is `rgba(242,95,217,0.38)` = 189-13's `hsl(310 85% 66% / 0.38)`, luminance **32.07**, mid-range against the other six (21.62 / 24.45 / 32.07 / 42.95 / 53.66 / 62.56 / 100). **The `llm_batch_agents` luminance-34.5 defect does not repeat** — that was a dim MARK; this mark is the same colour as its six siblings. |
| **U2** — badge occlusion | ✅ **PASS, control observed swinging BOTH ways** | Badge rect `747,460 142×33`. `elementFromPoint` at its own centre returns the badge (`SPAN "Not connected"`). Probes at the ⛨ seal position (card top-right), the verdict-mark edge, and both badge corners all resolve to the expected element — the badge occludes nothing and is occluded by nothing. **Falsification control:** a `zIndex 99999` div planted over the badge centre → `badgeReachable` **true → false**; removed → **false → true**. Both observations recorded. |
| **U4** — badge does not break the height budget | ✅ **PASS** | All three cards share **`y=302`** — the spine's top baseline does not move — and are spaced uniformly **478 px** apart, so no neighbour reflows. `act` is **222 h** vs **172 h** for both neighbours: 50 px taller, growing **downward only**. That is the documented acceptance (*"NOT that all cards are the same height"*). ⚠ The *without-badge* half could not be measured on the same card: the badge is state-conditional on `notConnected`, and nothing can connect a capability while zero MCP code exists. The neighbour-reflow half — the part the row actually protects — is fully measured. |
| **U3** — 8th ring distinguishable in greyscale | ⛔ **STILL NOT DRIVEN** | Unchanged. The ring readings live on `NodeRunOverlay`, which paints only on a **run surface**; reaching one needs a PUBLISHED external-action workflow (see the publish blocker below). |
| **U5** — 188.2 debt: seven readings on a live run | ⛔ **STILL NOT DRIVEN** | Same blocker. |
| **U6** — 188.2 debt: one glance at a Builder card | ✅ **PASS** | Builder cards were on screen throughout. Type name, subtitle sentence and badge render in the intended hierarchy; the ⛨ *"Must prove it"* seal sits top-right on `retrieve`/`emit` and is correctly **absent** on `act`. No layout break at any of the three window sizes exercised. |
| **D-25** — run-level verdict over a phase-level "not sent" | ✅ **PASS (on the wire)** | Observed in the run's own event stream: `run_completed status=completed` while `act` sits at `recorded_not_sent`. The pairing is real and exactly as recorded — the run genuinely completed. Its *rendered* half rides the same blocked run surface. |
| **BUG-260807-01** — `constructor`-slug reachability | ⛔ **NOT DRIVEN** | Deprioritised behind the new blocker above. Its code fix is confirmed present at HEAD (`own()` at `editAffordance.ts:244-247`, `providerLogo.tsx:107`); the report stays `open` for this row only. |

### The two headline governance rows — DRIVEN, and they pass

Three real golden runs were executed against the live KB (each a full harness run + independent judge).

**SC#4 — no egress, OBSERVED not assumed.** The `act` phase output, read straight from
`workflow_phases.output`:

> `NOT SENT — recorded only.` / `What this step would have done` / `Action : Sends an email` / …
> **`No email was sent. Nothing left this workflow. This is a record of an intention, not a receipt.`**

with `recorded_intent.capability = "send_email"`.

**WR-02's fix verified live:** `recorded_intent.inputs` keys are **`['content']`** —
`kickoff_prompt` is **absent**. Before the fix the user's chat question was swept into the record.

**D-19 verified live — the armed checkpoint auto-continues on a golden run.** Two full runs went
straight through without hanging (the pre-fix behaviour died at 7200 s):

```
[   0s] run=active     retrieve=active    | act=pending           | emit=pending
[  69s] run=active     retrieve=completed | act=recorded_not_sent | emit=active
[ 150s] run=completed  retrieve=completed | act=recorded_not_sent | emit=completed
```

**Migration 115 proven in production use:** `act` persisted as **`recorded_not_sent`** on every run —
the widened CHECK admits the new literal against the live DB, not just in a test.

**CR-02 — the code-review fix — PROVEN ON THE WIRE, twice.** The full ordered event stream for run
`45bfe74d`, read from the Redis run buffer:

```
 0. phase_started            phase=retrieve  phase_index=0
 1. gate_failed              phase=retrieve
 2. phase_completed          phase=retrieve  phase_index=0
 3. phase_transition
 4. phase_started            phase=act       phase_index=1
 5. phase_recorded_not_sent  phase=act       phase_index=1   <-- THE FIX
 6. phase_transition
 7. phase_started            phase=emit      phase_index=2   <-- the sweep trigger
 8. phase_completed          phase=emit      phase_index=2
 …
13. run_completed            status=completed
```

**Event 5 arrives BEFORE event 7**, and event 7 is what fires `finalizeEarlierPhasesForThread`. The
sweep acts on exactly `{running, retrying}` and skips every terminal, so by the time it runs the card
is already `"recorded-not-sent"`. **Before the fix event 5 did not exist**, so the card was still
`running` when event 7 arrived and was repainted *"✓ Complete"* mid-run, within milliseconds. The
ordering is the proof that the fix closes the gap at the right moment. Same event observed on run
`f744de07`.

### ⛔ Why the *rendered* run surface is still owed — a real blocker, named

**No external-action workflow could be published**, so no run surface could be opened. Three publish
attempts, three honest blocks, **none caused by the external-action step** — it cleared the
`Golden run` and `Citations` gauntlet stages every time:

| # | Workflow · KB | Blocked at | Why |
|---|---|---|---|
| 1 | Compliance Gap Report · Weekly reports | **Judge** | the KB holds weekly status updates, not compliance obligations |
| 2 | Compliance Gap Report · SOPs | **Judge** | an SOP deck defines the ideal procedure, not deviations from it |
| 3 | KB Cited Answer · Weekly reports | **Golden run** | `gather-evidence` failed a structural gate |

This is the publish gauntlet working as designed (186's hard wall — *"no override · publish anyway"*),
and it is a **content** mismatch, not a defect. Worth recording: the pip strip rendered ✓ for the eight
passed stages with `Judge`/`Commit` unticked — **the Phase-186 `findIndex → -1` bug, which painted an
unknown `blocked_stage` as 8/8 GREEN, does not reproduce.**

**Blocking condition for U3 / U5 / the D-25 render / BUG-260807-01:** a PUBLISHED workflow containing
an `external_action` step. **Run this first when it clears:** author a workflow whose deliverable the
judge will pass against a matching KB (a simple cited-answer shape bound to `Weekly reports` is the
closest attempt so far), publish it, launch it, and watch the panel spine — U3, U5, D-25's render and
the `constructor`-slug row all ride that one run.

### Rows driven incidentally, outside the U set

| Item | Verdict | Evidence |
|---|---|---|
| **WR-04** — capability picker is a real radiogroup | ✅ **PASS** | Roving tabindex `0,-1,-1`. A real `ArrowDown` moved focus 0 → 1, selection followed (`aria-checked` `false,true,false`), and the roving tabindex moved with it (`-1,0,-1`). `ArrowUp` restored. Correct APG behaviour. |
| **189-14** — the arming switch renders ON and refuses | ✅ **PASS** | `role="switch"`, `aria-checked="true"`, `aria-disabled="true"`, copy *"This step reaches outside your workspace, so it always stops and asks you first. That cannot be switched off."* A real click left it `true` — it visibly refuses, the Phase-185 shape. |
| **Card invariant** — no focusable control inside the card | ✅ **PASS** | `act.querySelectorAll('button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')` → **0**. The ✕ and ＋ live on the lane, as designed. |
| **WR-03** — the picker row previews the card that lands | ✅ **PASS** | Row 7 reads *"Sends an email / Stops for your approval before it acts outside"*; the placed card reads the same two lines plus the `Not connected` badge. |
| **D-13 tier 4 / D-12 badge slot 1** | ✅ **PASS** | The placed card's face is capability-derived, and the `Not connected` badge occupies slot 1 — the slot 188.2 was forbidden from spending and 189-15 spent. |

**Session total: 8 PASS · 3 still not driven (all behind ONE named blocker) · 1 NEW BLOCKER FOUND.**

---

## ⚠ THE OWED ROWS, DRIVEN — 2026-08-08, on a PUBLISHED external-action workflow

The blocker recorded in the previous session — *"no external-action workflow could be published, so
no run surface could be opened"* — is **discharged**. `BUG-260807-02` (both halves) shipped in the
interim, so the 7th step type is now placeable; the workflow below was published and run live.

**How the blocker was cleared, since three earlier attempts failed at the judge on content:** fork a
STARTER (`Weekly Status Report`), which is the only path that populates `business_requirement` — see
the finding below — bind it to the KB the published sibling already used
(`PM Demo Project (sample data)`), insert the external-action step **mid-spine**, publish.
Result: **`weekly-status-report-wfzqel` v1, `published`**, phases `retrieve · act · emit` with
`act = external_action / capability: send_email`. `act` is phase **2 of 3** — deliberately NOT last,
because that is the only arrangement in which the CR-02 mid-run sweep can fire.

**The step was placed BY KEYBOARD** — `End` then `Enter` on the picker — a path that did not exist
before yesterday's two fixes. `End` scrolled the panel and row 7 became genuinely hit-testable
(`elementFromPoint` reached it) before `Enter` chose it.

### Rows now driven

| Row | Verdict | Evidence |
|---|---|---|
| **U3** — the 8th ring distinguishable **by shape alone in greyscale** | ✅ **PASS — the previously-owed visual half is now DRIVEN** | Read off the LIVE rendered canvas of a real run. The `Not sent` ring: `stroke-dasharray = "32.044 21.363 32.044 21.363 32.044 21.363 32.044 21.363"` — **FOUR arcs** — with `stroke-dashoffset = 16.022` and `stroke = hsl(var(--muted-foreground))`. **Every number 189-10 predicted from a synthetic DOM is confirmed on a real one, including the 16.022.** `animationName: none` → the reading is **still**, not spinning. Under `filter: grayscale(1)` the dash pattern is byte-identical (shape is colour-independent) and the computed stroke reads `rgb(151,161,180)`. It is the **only** ring on the canvas: both `Complete` cards carry **zero** rings, so four-arcs-vs-nothing is unmistakable. |
| **U5** — **the 188.2 debt** (`D-188.2-DEF-07` row A2): readings distinguishable on a live run · the running arc **spins** · a card with no reading is **still** | ✅ **PASS** | Sampled across the live run as phases transitioned. `Running` → one arc, `stroke-dasharray "55.543 158.085"`, offset 0, **`animating: true`** — the arc genuinely spins. `Not started` / `Locked` → **no ring at all** and `animating: false` — still, as required. `Complete` → no ring. `Not sent` → four arcs, still. Four readings, four distinct shapes, observed on one run. |
| **D-25** — the run band's RUN-level verdict above a node's PHASE-level *"Not sent"* | ✅ **PASS — the RENDERED half, not just the wire** | On screen at run end: the band reads **"Phase 3 of 3, emit, complete"** and the run completes, while the spine reads `retrieve ✓ Complete ▸ act ↛ Not sent ▸ emit ✓ Complete`. The pairing reads as intended — a completed RUN containing a step that honestly did not send — not as a contradiction. |
| **`BUG-260807-01`** — the `constructor`-slug reachability row | ⛔ **FAIL — and the failure is the point.** The NaN cause is FIXED; a DIFFERENT sink produces the same rendered symptom | See below. Filed as **`BUG-260808-01`**. |

### ⚠ CR-02 — proven on the LIVE SURFACE, through BOTH sweeps

The previous session proved CR-02 on the wire. This one proves the paint.

As `act` resolved, the live surface read **`act — Not sent`**, `↛ Not sent`, and the milestone
announced **"Phase 2 of 3, act, not sent"**. Then `emit` started — firing
`finalizeEarlierPhasesForThread` — and later the run completed, firing
`finalizeAllPhasesForThread`. **After both**, the timeline still read:

```
retrieve ✓ Complete   ▸   act ↛ Not sent   ▸   emit ✓ Complete
```

`act` never flashed *"✓ Complete"*. Before the fix it would have been repainted within milliseconds
of `emit` starting, because `act` is not the last phase. **This is the exact scenario the defect
needed, and the card holds its honest terminal through both sweeps.**

### ⚠ The live armed checkpoint — observed, and one wording concern

The live run **paused at `act`** and would not continue: *"This step is marked as needing your
approval first. The run is waiting here and will not continue until you answer."* That is D-04 /
189-14 working, and it is the correct counterpart to D-19 (golden runs auto-continue; live runs
pause) — both halves are now observed on real runs.

⚠ **The approve control reads "Approve and run this step."** By this phase's own contract that step
**never runs anything outward** — it records an intention and sends nothing. The copy promises an
action the governed node exists not to take. Not filed as a bug (it is wording, and the recorded
output is unambiguous), but it is the one sentence on this surface that argues against SC#4 and it
should be reviewed with Phase 190, when the same button WILL cause a send.

### ⛔ `BUG-260807-01`'s driven row FAILED — a seventh WR-04 sink, filed as `BUG-260808-01`

`BUG-260807-01` was held open for exactly this row, on the recorded ground that *"only the driven
row can confirm no other path produces the same rendered symptom."* **That caution was correct.**

The `own()` guard shipped for `verticalOffsetFor` **holds** — `transformHasNaN: false` on every node
and every affordance, including the `constructor` one. Nothing regressed. But a phase slugged
`constructor` still renders wrong, because a *different* slug-keyed lookup writes **no transform at
all**:

| Node slug | `node.style.transform` |
|---|---|
| `retrieve` | `translate(0px, 0px)` |
| **`constructor`** | **`(empty)`** → computed `none` |
| `emit` | `translate(640px, 0px)` |

Both `retrieve` and `constructor` measure at rect `58,176` — **identical coordinates**; the card
paints at the origin, stacked on phase 1. **Control observed swinging both ways:** the same fixture
with the slug changed to `ordinaryslug` renders `translate(320px, 0px)`, its correct lane.

Not a NaN this time — an **absent** value: the lookup resolves the inherited
`Object.prototype.constructor` (a function, never nullish, so every `!== undefined` / `?? fallback`
passes) instead of an `{x, y}`. Same class, same visible outcome, different sink.

⚠ The UI cannot author this slug at all (`D-184-11` — there is no slug field; the caller derives it),
so the row was driven from a seeded fixture, which was **deleted afterwards**. Reproduction steps are
in the new report.

**`BUG-260807-01` therefore stays `open`**, now for a named successor rather than an unrun row.

### Two authoring defects found on the way to publishing

Neither is a Phase 189 regression; both blocked this session and cost real time.

1. **⑂ Tweak fails with a 409 and says nothing.** Forking a published workflow returns
   `409 Conflict` — `[WorkflowsPage] Tweak fork failed Error: Failed to create workflow draft
   (status 409)` — visible ONLY in the browser console. The page gives no toast, no inline error, no
   state change; the button simply does nothing. The cause appears to be a slug collision with an
   existing draft of the same workflow. **A silent failure on the primary "make a new version" path.**
2. **The LOOSE "Describe & run" door never persists `business_requirement`, so nothing it creates can
   ever be published.** Measured end to end: the door consumed the text (the generated workflow is
   even NAMED from it) and the AI drafted four correct phases — but the saved definition has
   `business_requirement: None`, and publish then refuses with *"a workflow must declare exactly one
   business_requirement before publish."* The POWER "Author & govern" door has **no editor for that
   field at all**, so there is no recovery path: a workflow born through the FASTEST PATH is
   unpublishable forever. Across the whole table, **87 of 193 definitions carry the field, and every
   one traces to a STARTER template** (`definitionOps.ts:903` reads
   `starter.definition?.business_requirement`) — which is why forking a starter was the only route
   that worked here.

### ✅ One genuinely good result worth recording

**The AI seed placed `external_action` by itself.** Given the plain-language requirement *"…then
email that answer to the requester"*, the NL generator produced four steps ending in
`Phase 4: Email the cited answer to the requester (external_action)` with `capability: send_email` —
and its seed receipt explained the grounding it had chosen (*"1 step reads your documents, so I set
it to must prove it"*). 189-09 taught the generator the 7th type and it holds on a real request.

### Coverage after this session

**U1 ✅ · U2 ✅ (control both ways) · U3 ✅ · U4 ✅ · U5 ✅ · U6 ✅ · U7 ✅ — all seven driven.**
D-25 ✅ rendered. CR-02 ✅ wire **and** paint. SC#4 ✅ observed. D-19 ✅ and its live-pause counterpart ✅.
`BUG-260807-01`'s row ⛔ **FAILED into a named successor** (`BUG-260808-01`), which is a result, not a gap.
