# Plan 143-05 SUMMARY — Apply seed + prove starters end-to-end (operator-gated)

**Plan:** 143-05 (Wave 3) · **Requirement:** WF-01 · **Status:** apply COMPLETE; run-UAT DEFERRED
**Type:** operator-gated (all 3 tasks are blocking human checkpoints)

## What happened

### Task 1 — Apply migration 094 + upload templates + regenerate full-schema — ✅ COMPLETE

Operator chose the split "I paste the SQL, Claude does the rest." Executed in order:

1. **Templates uploaded** (Claude ran `scripts/seed-starters.py --upload`) — 3 `.docx` placed at
   `00000000-0000-0000-0000-000000000001/_library/{risk-register,weekly-status-report,compliance-gap-report}.docx`
   with byte round-trip OK.
2. **Migration 094 applied** by the operator via the Supabase SQL editor (never `db push`/`reset`).
3. **full-schema regenerated** (`bash scripts/regenerate-full-schema.sh`, no `--reset`).

**BLOCKER found + fixed during apply (real defect in Plan 03's migration):**
The first paste landed only **2 of 3** starters — `risk-register` was silently missing. Root cause:
migration 094's `risk-register` row used the fixed uuid `00000000-…-0000000000c1`, but that id is
**already owned by the pre-existing `eval_coverage` eval seed**, so `ON CONFLICT (id) DO NOTHING`
silently skipped the INSERT (no error surfaced). Diagnosed via psycopg2 against the live DB (port
54322): the short-suffix seed-id space `…00b1–…00b4` (mig-061 scaffolds) + `…00c1` (eval_coverage)
was already occupied. **Fix (commit `5d24c48f`):** re-homed `risk-register` to the mig-094-namespaced
free id `…0094c1`; left the already-landed `c2`/`c3` rows untouched (changing a landed row's id would
duplicate its slug → 23505). Validated the fix with a rolled-back trial txn (all 3 starters visible),
operator re-pasted, and the live DB now has **3 `category='starter'` rows** (independently verified).

- `risk-register` → `…0094c1`, `weekly-status-report` → `…00c2`, `compliance-gap-report` → `…00c3`;
  all `is_global=true`, `status='published'`, `version=1`.
- **`full-schema.sql` unchanged** by the regen (and NOT committed): it is a **schema-only** dump —
  it never carried workflow_definition seed rows (not even the mig-061 scaffolds). The starter DATA
  ships in **committed migration 094**, not the schema bootstrap. ⚠️ The plan's `must_haves.artifacts`
  entry `contains: "starter"` for `full-schema.sql` was written on a wrong assumption about this
  artifact — it cannot be satisfied by a schema-only dump and is not a real gap.

### Task 2 — Fork + run each starter to a cited `.docx` (incl. non-operator A1) — ✅ CORE PROVEN LIVE (operator account); A1 still deferred

Verified live via Chrome MCP (operator-directed, operator account):
- ✅ All 3 starters render on the **top CURATED Starters shelf** with the **STARTER** chip, **STRICT**
  lock, provider/model icons, "produces: … · file", and the **"Use this →"** CTA.
- ✅ **Fork works (SC-d):** "Use this →" on Risk Register created a new owned **draft** with a suffixed
  slug (`risk-register-98k7sq`, also `-d438rw` earlier) at version 1 (NOT a v2 of the starter), opened
  in the Builder with the correct 2-step spine (`retrieve` llm_agent → `emit` llm_emit), `search_documents`
  tool on retrieve, STRICT emit. Published starter row unchanged (fork = fresh INSERT).
- ✅ **Publish gauntlet PASSED:** the forked Risk Register ran the full 8-stage gauntlet — a **real golden
  run** of the workflow against the KB + an **independent judge** — and published ("Published Risk Register
  v1"). Judge-approval = the workflow produces a valid, grounded, cited deliverable.
- ✅ **Run → cited `.docx` PRODUCED:** ran it (kickoff = "Build a project risk register for Project
  Meridian…") on the workspace default model `deepseek-v4-flash`. The STRICT emit gate **rejected the
  emit TWICE** ("emitted field-map has uncited or invented values or is missing required template keys —
  the deliverable was NOT produced") before producing **`/risk-register.docx` (37.4 KB), HIGH confidence,
  17 real citations** traced to the actual Project Meridian corpus (Charter-Excerpt, risk-log.md,
  Status-Report-Week09, weekly-meeting-notes-week9). This is BOTH the success path AND the D-143-7 honesty
  gate demonstrated in one run.

**Still deferred (small):** the non-operator fork+run (A1 / T-143-06 cross-user service-role Storage read)
— low-risk now that the operator run resolved the re-homed seed template cleanly.

**UX signal (operator north star = smooth/error-free):** on the fast `deepseek-v4-flash` the strict gate
needed 2 retries before grounding every cell — correct honesty, but a weaker model can loop. Tunable-gate
lever already captured as SEED-082 (emit-gate-policy-flexibility); a stronger default model runs smoother.

### Task 3 — Empty-KB honesty + chip/CTA read — ◑ MOSTLY PROVEN LIVE; explicit empty-folder test deferred

- ✅ Chip / CTA / Starters-on-top layout read as intended (verified live).
- ✅ **Honesty gate demonstrated live** (D-143-7): during the Task-2 run the STRICT emit validator
  rejected 2 incompletely-cited emits ("deliverable was NOT produced") before shipping — the honest
  no-fabrication behavior, observed over a REAL corpus (even stronger than the empty-KB case).
- **Deferred (small):** the explicit empty/mismatched-KB fork run (a run that fails and produces NO
  file at all) — the mechanism is proven; only the dedicated empty-folder scenario is unrun.

## Operator UX findings (captured, not built — 143 red line held)

Operator clarified two desires that are OUT of 143 scope:
- **"Fill my own template"** (upload a template as a run input) → already **SEED-110** (v3.3 candidate).
- **"Search only a specific project folder"** (per-workflow retrieval scope) → planted **SEED-112**
  (commit `3732c759`). Starters ship intentionally unscoped (D-143-4b).
- Directive: **research competitors (Glean, Beam AI) FIRST** before the v3.3 workflow-UX expansion;
  north star = simplify UX while keeping workflows accurate, smooth, error-free. Folded into SEED-112.

## Files
- `supabase/migrations/094_starter_workflows.sql` — risk-register id re-homed `…00c1`→`…0094c1` (fix).
- `supabase/full-schema.sql` — regenerated (no-reset), unchanged (schema-only; not committed).

## Self-Check: PASSED (apply + core run-UAT); 2 small items deferred
Apply landed + verified; live end-to-end PROVEN on operator account: fork → publish gauntlet (golden
run + judge approved) → run produced `/risk-register.docx` (37.4 KB, high confidence, 17 real citations),
with the STRICT gate rejecting 2 uncited emits first (honesty). Remaining deferred (low-risk): the
non-operator A1 run + the dedicated empty-folder honesty scenario. WF-01 substantively PROVEN;
`/gsd:verify-work 143` can close it once A1 + empty-folder are ticked (or accept as-is).
