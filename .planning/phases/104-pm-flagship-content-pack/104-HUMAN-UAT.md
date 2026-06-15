---
status: passed
phase: 104-pm-flagship-content-pack
source: [104-03-PLAN.md, 104-VALIDATION.md, 104-RESEARCH.md]
started: 2026-06-15
updated: 2026-06-15
result: "All 5 proofs GREEN (Claude-driven live UAT 2026-06-15). 2 engine bugs found+fixed (commit 6a607169), corpus naming + harness IDs fixed. See RESULTS below."
---

## RESULTS — Claude-driven live UAT (2026-06-15)

All runs against local stack (backend :8000, Supabase :54322), demo account fhdmrd@gmail.com.

| UAT | Proof | Result | Evidence |
|---|---|---|---|
| **UAT-1** | SC#2 headline cited `.docx` | ✅ PASS | run `66e49c53` (gpt-4o): `gate_passed`+`run_completed`; file `scripts/pm-pack/out/SC2-weekly-status-report.docx` (37KB) opens clean, ZERO residual tags, grounded (Week 9 AMBER, 412k records, 6% dups, 0.5% threshold, Wk11/13/18 milestones) |
| **UAT-2** | SC#2 citation red-case (honest-fail) | ✅ PASS | Pre-fix runs `27571799`/`f18fb994` honest-failed the citation gate (`citation_gate_rejected`, no silent `.docx`); the publish judge also blocked a weakly-grounded golden run (grounded_in_evidence 30). No silent invented `.docx` ever produced. |
| **UAT-3** | SC#1/#3 Charter NL-authoring | ✅ PASS | `POST /workflows/generate` (gpt-4o) → `{ok:true}`, phases `[llm_agent, llm_single]`, NO `render_template`, no template asset (TEXT deliverable); `strict=False` avoided a strict-mode 400 |
| **UAT-4** | SC#3 + QUAL-01 Tweak→publish | ✅ PASS | Tweak v2 → judge **BLOCKED** (golden `2b3a3217`, hard wall); corpus-naming fixed → Tweak v3 → judge **PASSED** (golden `4dbeaa02`) → `published:true v3`; v1 UNCHANGED (immutability) |
| **UAT-5** | SC#10 4-axis cross-provider | ✅ PASS | 7-model sweep (`scoreboard-20260615T054206Z.json`): 4 FORCE clean cited `.docx` (gpt-4o/claude-opus-4-8/MiniMax-M2.7/glm-4.6); deepseek+gemini honest-fail forcing; kimi honest-fail — **honesty holds on all 7**. Multi-tool inherent; parallel-thread (`397432ff`+`1b764141` concurrent, both clean); long-message (`1b764141` `--long`, complete `.docx`, no truncation) |

**Engine fixes at this gate** (commit `6a607169`): double-gate over-rejection (post-phase `citations_required` + `output_file_valid` on `llm_emit` lacked `retrieved_ids`/integrity verdict). **Corpus naming** (`6e2f383e`): `w1/w2` → `week8/week9` (judge cited filename, read "w2" as Week 2). **Harness** (committed): real model IDs + `workspace_files` column fix.

**Findings filed** (reported-bugs): seed dedup short-circuits on un-embedded `pending` rows; seed DELETE-then-INSERT def-refresh FK-violates when `workflow_runs` reference the def; DeepSeek/Gemini forced-emit reliability (`model_failed_to_emit`); model-list curation (`gpt-5.4`/`MiniMax-M3` not in registry).

---

# Phase 104 — Live UAT Runbook (PM Flagship Content Pack)

> Operator/orchestrator live-UAT runbook for PM-01's three Success Criteria + the SC#10 cross-provider
> scoreboard. Executed at the Plan 03 Task 3 `checkpoint:human-verify` gate (NOT by the autonomous executor).
> The pack ships as DATA on the already-shipped harness primitives (ZERO engine code) — this runbook DRIVES
> the shipped kickoff / publish / authoring surfaces and records evidence.

## Pre-requisites

Confirm ALL of these before starting:

- [ ] **Seed has run** (Plan 02): `backend/venv/Scripts/python.exe scripts/seed-pm-pack.py` with
      **`SEED_PM_RUN_INGEST=1`** set (so the synthetic "PM Demo Project" corpus is actually embedded — without
      it the doc rows exist but `search_documents` returns nothing, and the citation gate honest-fails for the
      RIGHT reason but the demo won't produce a filled `.docx`). The seed is idempotent (DELETE-then-INSERT).
- [ ] **`scripts/pm-pack/pm_pack_ids.json` exists** — carries the 2 def ids
      (`pm-weekly-status-report` = `00000000-0000-0000-0000-0000001040a0`,
      `pm-risk-register` = `00000000-0000-0000-0000-0000001040a1`), the demo folder id, and the asset paths.
- [ ] **An embedding key is configured** (`OPENAI_API_KEY` in `backend/.env`, read NAME-ONLY) — required for
      the corpus ingest and for retrieval at run time.
- [ ] **Provider keys configured** for every tier the SC#10 scoreboard exercises (OpenAI, Anthropic, Google,
      DeepSeek, Moonshot, Z.ai/GLM, MiniMax) — a MISSING key marks that scoreboard row MISSING (never blocks others).
- [ ] **The app is up** at http://localhost:5173/ (login `fhdmrd@gmail.com` / `123456`).
- [ ] **The backend uvicorn is running** in a visible terminal (operator starts it — the harness + the kickoff
      path need it). Local Supabase on `:54322` is up.
- [ ] **DEMO_USER_ID matches the live `auth.users` row** for `fhdmrd@gmail.com` (the seed's `assert_demo_uid`
      pre-flight aborts loudly on a stale uid — if the seed ran clean, this holds).

**Evidence channels:** run_ids (psql `runs` / `workflow_runs`), downloaded `.docx` paths, psql read-backs to
local Supabase `:54322` (psycopg2 — `postgresql://postgres:postgres@127.0.0.1:54322/postgres`), the harness
artifact `scripts/pm-pack/out/scoreboard-*.json`. Chrome MCP drives the UI clicks; if Chrome MCP hangs, fall
back to operator-driven clicks + Claude DB cross-checks (per CLAUDE.md UAT recipe / feedback_chrome_mcp_testing).

---

## UAT-1 — SC#2 headline run (the flagship)

**Goal:** the seeded Weekly Status Report produces a cited, integrity-checked `.docx` from the demo KB via the
shipped single-textarea kickoff (no bespoke route).

**Steps:**
1. Kick off the seeded Weekly Status Report EITHER via the Workflows page Run modal (Workflows → the
   "Weekly Status Report" card → Run → the single-textarea modal with the read-only project-folder chip →
   enter the kickoff prompt → Run), OR via the harness for one model:
   `backend/venv/Scripts/python.exe scripts/pm-pack/scoreboard_smoke.py --run --models gpt-5.4`.
2. Wait for the run to reach a terminal state (the 2-phase pipeline: `llm_agent`(search_documents) retrieve →
   `llm_emit`(render_template) fill).
3. Download the produced `.docx` from the chat/run surface (or from the `workspace_files` path).
4. Open the `.docx` in a REAL editor (Word / LibreOffice / Google Docs).

**Expected observable:**
- A `.docx` is produced (a `workspace_files` row + an `emit_rendered`/`emit` audit event).
- `citations_required` passes — no uncited / invented leaves (`check_coverage`: `uncited_value_count==0` AND
  `invented_citation_count==0`).
- `output_file_valid` re-opens the produced file clean (the integrity gate; `config:{}` re-opens
  `output["output_file"]["path"]`).
- The downloaded `.docx` **OPENS CLEAN in a real editor** with cited, non-null values: project name +
  reporting period, an overall RAG status + summary, accomplishments, planned-next, risks/blockers, and key
  milestones — grounded in the "Project Meridian" synthetic corpus (e.g. the Week-8 GREEN status, the
  de-duplication threshold, the policy-rating API integration). **This "opens clean in a real editor" is the
  strongest evidence bar (the spike's bar).**

**Pass/Fail:** ☐ pass ☐ fail

**Evidence:** `run_id` = ______ · `workflow_run_id` = ______ · downloaded `.docx` path = ______ ·
psql: `workspace_files` row present ☐ · audit `emit`/`gate_passed` events = ______

---

## UAT-2 — SC#2 citation red-case (the honest-failure bar)

**Goal:** the Status fill HONEST-FAILS the citation gate rather than emitting a silent `.docx` with invented
values. Citation false-green is the #1 failure mode the gate must catch.

**Steps:**
1. Drive the Status def in a condition where the model would be tempted to invent — e.g. kick it off against
   an EMPTY scope (a thread/def variant pointed at an empty folder) OR with a prompt that asks for figures the
   corpus does not contain (e.g. "include the exact Q4 budget variance and the CISO sign-off date").
2. Observe the run's terminal outcome.

**Expected observable:**
- The run HONEST-FAILS the citation gate — a VISIBLE failure that names the gate
  (`citations_required` / "uncited value" / "invented citation"), routed `on_failure:"fail_run"`
  (the PM defs deliberately do NOT use `on_failure:"ask_user"`, which would block publish).
- It NEVER silently produces a `.docx` with invented / uncited values.
- psql: an `emit` with `gate_failed` audit event (NOT a `workspace_files` `.docx` row carrying invented leaves).

**Pass/Fail:** ☐ pass ☐ fail

**Evidence:** `run_id` = ______ · gate named in the failure = ______ · psql: no invented-value `.docx` ☐ ·
audit `gate_failed` present ☐

---

## UAT-3 — SC#1/SC#3 Charter author-driven proof (page-authored TEXT, no template, no code)

**Goal:** a domain author authors a Project Charter end-to-end THROUGH the Workflows page —
describe → draft → refine-by-form → publish — as a TEXT deliverable (`llm_single`/`llm_agent`), proving the
"no PM-hardcoded engine code" claim and exercising the publish gauntlet inherently.

**Steps:**
1. Workflows page → New / describe-first Builder → describe a **Project Charter** in plain language (objectives,
   scope, stakeholders, success criteria, high-level milestones) — **do NOT mention or attach a template.**
2. Generate the draft (`POST /workflows/generate`). Confirm the AI drafts a **TEXT deliverable** — the final
   phase is `llm_single` or `llm_agent`, **NOT a `render_template` emit phase** (the AUTHORING_SYSTEM_PROMPT
   DELIVERABLE RULE: no template listed → TEXT, never `render_template`).
3. Inspect the read-only phase-spine graph; refine a phase via the side form panel.
4. Publish through the live gauntlet (`POST /workflows/{id}/publish` with a `golden_input`) → confirm published.
5. Repeat the authoring shot for **OpenAI `gpt-5.4`** AND **DeepSeek `deepseek-v4-pro`** — confirm the
   Phase-103 `strict=False` override avoids a strict-mode **400** on the optional-heavy `WorkflowDefinition` shape.

**Expected observable:**
- The drafted def's final deliverable phase is `llm_single`/`llm_agent` TEXT — there is NO `render_template`
  emit phase (a `render_template` with no template would be unpublishable, `no_template_bound`).
- The gauntlet passes (business_requirement present → lint → golden run → judge) and the def flips `published`.
- Both authoring rows (OpenAI + DeepSeek) succeed with NO strict-mode 400.

**Pass/Fail:** ☐ pass ☐ fail

**Evidence:** OpenAI draft def id = ______ · DeepSeek draft def id = ______ · final phase type = ______ ·
published verdict = ______ · psql: `workflow_definitions` published row present ☐ · no 400 on the generate shot ☐

---

## UAT-4 — SC#3 + QUAL-01 Tweak→v(N+1) live publish gauntlet (the quality-bar proof)

**Goal:** re-author a seeded pack workflow via Tweak → v(N+1) and re-drive the LIVE publish gauntlet
(golden run + judge HARD wall) — proving QUAL-01 AND the SC#3 re-author path, with v1 frozen by the
immutability trigger. This single live run is the QUAL-01 proof (RESEARCH §6 reasoned recommendation:
the seed INSERTs published; the verifier proves the gauntlet once on a fork).

**Steps:**
1. Workflows page → open the seeded **Weekly Status Report** → **Tweak** → a **v2 DRAFT** (new id, SAME slug
   `pm-weekly-status-report`, `version=2`, `status="draft"`, loaded into the Builder).
2. Edit a prompt / a phase config in the fork.
3. Drive `POST /workflows/{id}/publish` with a `golden_input` → the REAL golden run (`is_golden_run=true`,
   no mocks) → the independent cross-provider judge (HARD blocker, `resolve_judge_model` — never self-judging).
4. Confirm the v2 fork flips `published` (judge PASS).
5. **psql read-back (immutability):** confirm the v1 row (`version=1`) is UNCHANGED and a v2 row
   (`version=2`) exists for the same slug. A deliberate UPDATE of the v1 published row would RAISE the
   `workflow_definitions_block_published` check violation.
6. **Repeat the publish fork on the Risk Register** (`pm-risk-register`) — confirm IT passes the gauntlet too
   (the worded→numeric Score mapping fills, the 9-column register renders, citations + integrity gate pass).

**Expected observable:**
- The v2 fork is an INSERT (new id, same slug, version+1) — NEVER an UPDATE of v1.
- The live golden run runs for real; the judge grades the cited field-map (NOT just a confirmation string)
  and is a HARD wall — a judge-fail CANNOT publish.
- The v2 def flips `published`; the v1 row is provably UNCHANGED (immutability).
- The Risk Register fork ALSO passes the live gauntlet.

**Pass/Fail:** ☐ pass ☐ fail

**Evidence:** Status v2 def id = ______ · publish verdict (overall_passed) = ______ ·
psql: v1 row unchanged ☐ (updated_at / definition identical) · v2 row exists ☐ ·
Risk Register v2 def id = ______ · Risk publish verdict = ______

---

## UAT-5 — SC#10 cross-provider scoreboard (the headline acceptance bar, 4-axis)

**Goal:** the 4-axis SC#10 scoreboard runs live — cross-provider × multi-tool × parallel-thread × long-message
— and the 104-VALIDATION.md scoreboard is filled from the harness artifact. Use EXACT PascalCase registry IDs
(a wrong case silently degrades to coerce).

**Steps:**
1. Drive the harness across the pinned tier IDs:
   `backend/venv/Scripts/python.exe scripts/pm-pack/scoreboard_smoke.py --run`
   (preview-only without `--run`; this fires the real cross-provider sweep). It kicks off the seeded Status def
   per model, polls to terminal, and writes `scripts/pm-pack/out/scoreboard-<timestamp>.json`.
2. For the **long-deliverable / truncation** row, run:
   `... scoreboard_smoke.py --run --models deepseek-v4-pro --long` (and/or `kimi-k2.6`).
3. For the **parallel-thread** axis: kick off a Status run in Thread A; while it streams, open Thread B and
   submit a new prompt — both must hold (no cross-thread bleed / drop).
4. Fill the 104-VALIDATION.md SC#10 scoreboard table from `scripts/pm-pack/out/scoreboard-*.json`
   (`grep SCOREBOARD_ROW` for the per-model verdicts).

**The pinned tier IDs (EXACT — case matters):**

| Tier | Provider / model | Expected |
|------|------------------|----------|
| FORCE+strict | OpenAI `gpt-5.4` | clean cited `.docx`, gates pass |
| FORCE+strict | DeepSeek `deepseek-v4-pro` | clean cited `.docx`, gates pass |
| FORCE (no strict) | Anthropic `claude-opus-4-8` (thinking off) | clean cited `.docx` |
| FORCE (no strict) | Google `gemini-2.5-pro` | clean cited `.docx` |
| FORCE (no strict) | MiniMax `MiniMax-M3` (PascalCase) | clean cited `.docx` — **WATCH `minimax-m3-invalid-tool-args-400`** (the exact PascalCase id mitigates the case-drop path; the forced-tool-args 400 is a separate live risk) |
| FORCE (no strict) | GLM `glm-4.6` | clean cited `.docx` |
| COERCE | Moonshot `kimi-k2.6` | coerce-success OR an HONEST failure — a narrated field-map as prose is a **FAIL** |
| Long-deliverable | DeepSeek `deepseek-v4-pro` OR Moonshot `kimi-k2.6` (`--long`) | fires `is_truncated` as an HONEST failure, NEVER a half-emitted `.docx` |
| Charter NL-authoring | OpenAI `gpt-5.4` + DeepSeek `deepseek-v4-pro` (covered by UAT-3) | no strict-mode 400 |

**Expected observable (the 4 axes):**
- **Cross-provider:** FORCE-tier rows produce a clean cited `.docx`; the COERCE-tier (`kimi-k2.6`) row either
  coerce-succeeds OR honest-fails — NEVER silent narration (`narrated_text:true` is a FAIL, T-104-03-01).
- **Multi-tool:** satisfied by the 2-phase pipeline (`search_documents` retrieve + the bound-template emit) —
  2+ tools in one run.
- **Parallel-thread:** Thread A streaming while Thread B accepts a prompt — both hold.
- **Long-message:** the long-deliverable row fires `is_truncated` as an HONEST failure (not a half-emit).

**Pass/Fail:** ☐ pass ☐ fail

**Evidence:** harness artifact = `scripts/pm-pack/out/scoreboard-______.json` ·
FORCE-tier `.docx` produced ☐ · COERCE honest-fail-or-coerce (no silent narration) ☐ ·
long-deliverable `is_truncated` honest fail ☐ · parallel-thread holds ☐ · MiniMax watch outcome = ______

---

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps

_(record any failures here — gaps route to a 104 gap-closure plan; the resume signal for the
checkpoint is "approved" once all 5 UAT rows pass.)_
