---
phase: 097-spike-risk-register-template-fill-authoring-feel
plan: 01
subsystem: infra
tags: [docxtpl, jinja2, python-docx, supabase, spike, risk-register, template-fill, kb-folder-scope]

# Dependency graph
requires:
  - phase: 097 (RESEARCH/VALIDATION)
    provides: throwaway-layout recommendation, docxtpl {%tr %} pitfall log, A2 "real risk-content KB folder is THE prerequisite"
provides:
  - Throwaway spike workspace at scripts/spike-097/ (repo root, outside backend/ --reload tree) with out/ artifacts dir
  - docxtpl==0.20.2 importable in the backend venv (venv-only — NOT in Dockerfile.sandbox/requirements; Phase 101 does the prod add)
  - A {%tr %} variable-row risk-register.docx template that parses via docxtpl (exposes project_name, report_date, rows)
  - find_risk_folder.py — service-role folder-discovery helper (mirrors get_supabase() + kb.py:186 BFS subtree)
  - out/kb-folders.json — ranked candidate KB folders with subtree ids + doc counts
  - out/spike-config.json — the operator-confirmed folder_id + user_id + bound subtree scope + template_path the downstream experiments consume
  - A controlled synthetic risk corpus (sample-corpus/*.docx + make_sample_corpus.py) ingested into a fresh "Project Meridian — Risks" folder to ground the fill experiments
affects: [097-02, 097-03, 097-04, 097-05, 101]

# Tech tracking
tech-stack:
  added: [docxtpl==0.20.2 (backend venv only), jinja2 + lxml (transitive)]
  patterns:
    - "Throwaway spike code lives at repo-root scripts/spike-097/ — never under backend/ (CLAUDE.md --reload-tree hard rule)"
    - "Read-only service-role Supabase mirror: every query filtered by the test user's user_id (T-097-01); key sourced name-only from backend/.env, never echoed"
    - "docxtpl {%tr %} row-loop tag placed inside table-row cells (not a free paragraph) to avoid TemplateSyntaxError (Pitfall 4)"

key-files:
  created:
    - scripts/spike-097/README.md
    - scripts/spike-097/make_template.py
    - scripts/spike-097/templates/risk-register.docx
    - scripts/spike-097/find_risk_folder.py
    - scripts/spike-097/out/.gitkeep
    - scripts/spike-097/out/kb-folders.json
    - scripts/spike-097/out/spike-config.json
    - scripts/spike-097/make_sample_corpus.py
    - scripts/spike-097/sample-corpus/Project-Meridian-Charter-Excerpt.docx
    - scripts/spike-097/sample-corpus/Project-Meridian-Risk-Workshop-Notes.docx
    - scripts/spike-097/sample-corpus/Project-Meridian-Status-Report-Week09.docx
  modified: []

key-decisions:
  - "Operator confirmed folder 75755ec9-5ba7-495b-ad93-7500011cf6f2 (Project Meridian — Risks) as the bound risk-content scope — no existing KB folder matched the risk-name heuristic, so a controlled synthetic corpus was generated + ingested rather than grounding the spike on off-topic content (Weekly reports / DBA / Hybrid Search)"
  - "docxtpl stays a venv-only install for the spike; the production Dockerfile.sandbox/requirements add is deferred to Phase 101 (kept the spike zero-impact on the shipped sandbox image)"
  - "subtree_folder_ids copied verbatim from kb-folders.json (the BFS-resolved bound scope) — never hand-fabricated; it is the folder_ids parameter the experiments pass to search_documents(), not a prompt hint"

patterns-established:
  - "Pattern 1: Spike grounding corpus is a committed test fixture (make_sample_corpus.py + sample-corpus/*.docx) so the spike is reproducible from a clean checkout"
  - "Pattern 2: spike-config.json is the single source of truth every downstream experiment plan reads (user_id / folder_id / subtree_folder_ids / template_path)"

requirements-completed: []  # SPIKE — closes NO REQ-ID (ROADMAP: "Requirements: None closed")

# Metrics
duration: ~27min active (spans the operator-action checkpoint pause)
completed: 2026-06-08
---

# Phase 097 Plan 01: Spike Workspace + Confirmed Risk-Content KB Folder Summary

**Throwaway scripts/spike-097/ workspace stood up: docxtpl 0.20.2 (venv-only), a {%tr %} variable-row risk-register.docx template, a service-role folder-discovery helper, and out/spike-config.json pinning the operator-confirmed "Project Meridian — Risks" folder (grounded by a freshly-ingested synthetic risk corpus) as the bound retrieval scope for the experiments.**

## Performance

- **Duration:** ~27 min active execution (Tasks 1-2 ran 2026-06-08 ~22:54–22:59 local; Task 3 resumed after the operator-action checkpoint — the operator ingested the synthetic corpus and confirmed the folder, then this continuation finished it ~23:18–23:20 local)
- **Started:** 2026-06-08T18:54:00Z (approx, Task 1)
- **Completed:** 2026-06-08T19:21:00Z
- **Tasks:** 3 (2 auto committed pre-checkpoint; 1 human-action resolved + committed this continuation)
- **Files modified:** 11 created (all under scripts/spike-097/)

## Accomplishments
- Throwaway spike home at `scripts/spike-097/` (repo root, OUTSIDE backend/'s uvicorn `--reload` watch tree) with an `out/` artifacts dir — CLAUDE.md "no scratch .py in backend/" rule honored end-to-end.
- `docxtpl==0.20.2` installed into the backend venv ONLY (pulls jinja2 + lxml); verified `import docxtpl, jinja2.sandbox` and `__version__ == 0.20.2`. The shipped `Dockerfile.sandbox`/`requirements*.txt` were left untouched (Phase 101 owns the prod add).
- `make_template.py` programmatically generated `templates/risk-register.docx` — a title block (`{{ project_name.value }}`, `{{ report_date.value }}`) plus a 10-column risk table whose single body row is a docxtpl `{%tr for r in rows %}` row-loop. `get_undeclared_template_variables()` lists `project_name`, `report_date`, `rows` (covers template-shape unknowns a/b).
- `find_risk_folder.py` mirrors `dependencies.get_supabase()` (service-role) read-only, filters every query by the test user's `user_id`, mirrors the `kb.py:186` BFS subtree-collect, ranks folders, and writes `out/kb-folders.json`. Resolved test-user `user_id = d8a54002-6a29-4b88-b918-cff2aa4a06d5`.
- **Operator confirmed the risk-content folder and the synthetic corpus was ingested** to make a valid grounding source: `out/spike-config.json` now pins `folder_id = 75755ec9-5ba7-495b-ad93-7500011cf6f2` ("Project Meridian — Risks", 3 docs / 9 embedded chunks), its `subtree_folder_ids` (the bound retrieval scope), `user_id`, and `template_path`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold scripts/spike-097/ + docxtpl 0.20.2 + {%tr %} template** - `75be6f92` (feat)
2. **Task 2: find_risk_folder.py — rank candidate risk-content KB folders** - `5b6a87f3` (feat)
3. **Task 3: Operator-confirmed risk-content folder → spike-config.json + synthetic corpus fixtures** - `61025148` (feat)

**Checkpoint pause marker:** `85d6513a` (docs — recorded the Task 3 human-action pause)
**Plan metadata:** _final docs commit_ (SUMMARY.md + STATE.md + ROADMAP.md)

## Files Created/Modified
- `scripts/spike-097/README.md` - Throwaway-spike (SEED-051) orientation: artifacts land in out/, docxtpl venv-only, run from repo root.
- `scripts/spike-097/make_template.py` - Generates risk-register.docx via python-docx (no manual Word authoring).
- `scripts/spike-097/templates/risk-register.docx` - The {%tr %} variable-row template under test.
- `scripts/spike-097/find_risk_folder.py` - Service-role read-only folder-discovery helper (user_id-scoped, BFS subtree).
- `scripts/spike-097/out/.gitkeep` - Keeps the artifacts dir tracked.
- `scripts/spike-097/out/kb-folders.json` - Ranked candidate folders (top: Project Meridian — Risks, doc_count 3, name_match true).
- `scripts/spike-097/out/spike-config.json` - Confirmed folder_id + user_id + bound subtree scope + template_path (single source of truth for the experiments). No secrets.
- `scripts/spike-097/make_sample_corpus.py` - Generates the synthetic Project-Meridian risk corpus (reproducible from a clean checkout).
- `scripts/spike-097/sample-corpus/Project-Meridian-Charter-Excerpt.docx` - Synthetic CRM-migration charter excerpt.
- `scripts/spike-097/sample-corpus/Project-Meridian-Risk-Workshop-Notes.docx` - Synthetic risk-workshop notes (causes/events/owners/mitigations).
- `scripts/spike-097/sample-corpus/Project-Meridian-Status-Report-Week09.docx` - Synthetic weekly status report (table-heavy).

## Decisions Made
- Confirmed `folder_id 75755ec9-...` ("Project Meridian — Risks") over the larger-but-off-topic candidates (Weekly reports / DBA / Hybrid Search) because grounding a risk-register fill on non-risk content would defeat the spike's purpose. Picking the folder is operator judgment (the plan forbids the executor from auto-picking).
- `subtree_folder_ids` is copied verbatim from `kb-folders.json` (BFS-resolved), not hand-written — it is the bound retrieval scope, not a prompt hint.
- docxtpl remains venv-only; the production sandbox-image add is intentionally deferred to Phase 101.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking / Wave-0 prerequisite] No existing KB folder held risk content — generated + ingested a controlled synthetic corpus**
- **Found during:** Task 2 → Task 3 (the human-action checkpoint)
- **Issue:** `find_risk_folder.py` found NO folder matching the risk-name heuristic; the existing candidates (Weekly reports 5 docs, DBA 2, Hybrid Search 2, Test Wasim 1) are off-topic for a risk register. The experiments cannot ground a risk-register fill on an empty or off-topic folder (research assumption A2 — a real risk-content folder is THE prerequisite). The plan's Task 3 explicitly anticipates this: "If none fit, ingest a small risk corpus … then re-run find_risk_folder.py."
- **Fix:** A controlled synthetic risk corpus was generated (`scripts/spike-097/make_sample_corpus.py` → 3 `.docx`: a CRM-migration charter excerpt, risk-workshop notes, and a Week-09 status report — all "Project Meridian") and the operator ingested it into a fresh "Project Meridian — Risks" folder. All 3 docs reached `status=completed` with all chunks embedded (9 embedded chunks total). `find_risk_folder.py` was re-run, surfacing the new folder as the top candidate (name_match true). `spike-config.json` pins it.
- **Files modified:** scripts/spike-097/make_sample_corpus.py, scripts/spike-097/sample-corpus/*.docx, scripts/spike-097/out/kb-folders.json, scripts/spike-097/out/spike-config.json
- **Verification:** Task 3 automated verify printed `confirmed folder 75755ec9-5ba7-495b-ad93-7500011cf6f2`; folder_id ∈ kb-folders.json candidates; subtree_folder_ids non-empty.
- **Committed in:** `61025148` (Task 3 commit)

---

**Total deviations:** 1 (Wave-0 grounding prerequisite — anticipated by the plan's Task 3 fallback)
**Impact on plan:** Necessary to satisfy the spike's grounding prerequisite (A2). No scope creep — the corpus is a committed throwaway test fixture; no production schema, migration, or backend/app source was touched.

## Issues Encountered
- **Citation-granularity note for Plan 03:** One table-heavy synthetic doc (the Week-09 status report) chunked coarsely — it landed as a single chunk. This is a real signal for unknown (b)/Plan 097-03: table-dense source docs may yield low citation granularity (one chunk = one citation for the whole table), which the docx-fill citation-coverage check should account for. Logged here so Plan 03 watches for it rather than treating it as a surprise.

## User Setup Required
None - no external service configuration required. (The synthetic corpus was ingested by the operator at the checkpoint; it is captured as a committed fixture so the spike is reproducible.)

## Next Phase Readiness
- **Wave 0 complete.** The three prerequisites are satisfied: throwaway workspace + docxtpl venv-only + {%tr %} template + a confirmed, genuinely-risk-content KB folder recorded in `out/spike-config.json`.
- **Ready to fan out to Wave 1:** Plan 097-02 (unknown a — cited Pydantic field-map + bound-scope retrieval) and Plan 097-04 (unknowns c+d — grounded WorkflowDefinition generation + feel verdict) both consume `out/spike-config.json`.
- **Carry to Plan 097-03:** the table-heavy-doc coarse-chunking citation-granularity note above.
- **Reminder:** docxtpl is venv-only — Phase 101 must add it to `Dockerfile.sandbox` + bump `SANDBOX_IMAGE`.

## Self-Check: PASSED
- Created files verified present: README.md, make_template.py, templates/risk-register.docx, find_risk_folder.py, out/.gitkeep, out/kb-folders.json, out/spike-config.json, make_sample_corpus.py, sample-corpus/*.docx (3).
- Commits verified in git log: `75be6f92` (Task 1), `5b6a87f3` (Task 2), `61025148` (Task 3).
- Task 3 verify command PASS: `confirmed folder 75755ec9-5ba7-495b-ad93-7500011cf6f2`.
- Zero files under backend/ (CLAUDE.md hard rule); spike-config.json contains no secret/key fields.

---
*Phase: 097-spike-risk-register-template-fill-authoring-feel*
*Completed: 2026-06-08*
