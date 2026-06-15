---
phase: 097-spike-risk-register-template-fill-authoring-feel
plan: 03
subsystem: workflow-template-fill
tags: [docxtpl, jinja2-sandbox, python-docx, ooxml, ssti, spike, template-fill, risk-register]

# Dependency graph
requires:
  - phase: 097-01
    provides: "scripts/spike-097/ scaffold + docxtpl venv install + {%tr %} risk-register.docx template + confirmed KB folder (out/spike-config.json)"
  - phase: 097-02
    provides: "field_map.py / derive_fields.py — cited RiskRegisterFieldMap from bound-scope retrieval + forced-tool Anthropic emission (out/field-map.json)"
provides:
  - "render_docx.py — docxtpl render contained by SandboxedEnvironment(autoescape=True) + the mandatory python-docx integrity re-open + the corruption-log writer"
  - "run_spike.py — the 6-step end-to-end orchestrator (parse → retrieve → field-map → check → render → integrity) + 1/5/20-row growth runs + the &<> corruption probe"
  - "out/risk-register-filled.docx — the headline SC#1 artifact (real KB → real cited field-map → real openable file), operator-confirmed clean in a real editor"
  - "out/corruption.log — one row per Pitfall 1–6 (+7 observe-only, +pptx/xlsx not-exercised, +real-editor confirmation) — the pre-named Phase 101 UAT seed (SC#4)"
  - "out/unknown-b.md — the written answer to unknown (b): YES / GO on the docxtpl path"
affects: [101-template-fill-integrity-validation, 102-validation-gate-library, 105-go-no-go-conclusion, TMPL-02, TMPL-03]

# Tech tracking
tech-stack:
  added: []   # docxtpl==0.20.2 already venv-installed in Plan 01; no new deps this plan (throwaway spike — NOT added to Dockerfile.sandbox/requirements; that is the Phase 101 prod add)
  patterns:
    - "LLM produces DATA (the cited field-map), deterministic code produces the FILE (docxtpl owns the OOXML bytes — the LLM never touches XML)"
    - "SSTI containment: doc.render(jinja_env=SandboxedEnvironment(autoescape=True)) — sandbox blocks attribute/builtin access (T-097-08) + autoescape neutralises &<> (T-097-09)"
    - "Mandatory output-integrity gate: Document(out_path) re-open raises on corruption → run marked corrupt, never delivered (previews the production output_file_valid gate, T-097-10)"
    - "Variable-length rows via {%tr %} table-row repeat — the docx-path surprise python-docx/python-pptx structurally cannot do"

key-files:
  created:
    - "scripts/spike-097/render_docx.py"
    - "scripts/spike-097/run_spike.py"
    - "scripts/spike-097/out/risk-register-filled.docx (+ -1/-5/-20 variants)"
    - "scripts/spike-097/out/corruption.log"
    - "scripts/spike-097/out/unknown-b.md"
  modified:
    - "scripts/spike-097/out/corruption.log (real-editor confirmation line appended on operator approval)"
    - "scripts/spike-097/out/unknown-b.md (Real-editor confirmation note + worded-P/I Score carry-forward appended)"

key-decisions:
  - "Unknown (b) = YES / GO — docxtpl produces a clean, re-openable .docx; the docxtpl path is GO for trusted project-library templates (the Phase 101 production target)."
  - "Render runs LOCAL in the backend venv for the fast spike loop; production render is the sealed, network-less Docker sandbox (Phase 101, research Open Question 3)."
  - "Worded probability/impact (High/Med/Low) do NOT parse to ints → real-doc Score column blank by design (honest degrade, not corruption) — Phase 101 needs a categorical→ordinal mapping."

patterns-established:
  - "Corruption-log-as-UAT-seed: one pipe-delimited row per pre-named failure mode (Pitfall 1–6 + 7 observe-only + pptx/xlsx not-exercised) = the G-6 failure-criteria-upfront artifact Phase 101 inherits verbatim."
  - "python-docx re-open proves PARSE-validity; operator real-editor open proves RENDER-validity (no repair banner) — both gates required to call a produced file 'done'."

requirements-completed: []   # SPIKE — closes NO REQ-ID. Informs (does not close) TMPL-02/TMPL-03.

# Metrics
duration: ~35min
completed: 2026-06-09
---

# Phase 097 Plan 03: Unknown (b) — KB-Grounded docxtpl Template-Fill Summary

**docxtpl renders the real KB-cited field-map into a clean, re-openable risk-register .docx — `{%tr %}` grows the table 1/5/20 → 2/6/21 rows, `SandboxedEnvironment(autoescape=True)` contains SSTI + `&<>`, the mandatory python-docx re-open gate passes, and the operator confirmed it opens with NO repair banner in a real editor: unknown (b) = GO.**

## Performance

- **Duration:** ~35 min (Task 1 render module → Task 2 end-to-end run → Task 3 operator real-editor open → plan close)
- **Started:** ~2026-06-08T19:55Z
- **Completed:** 2026-06-08T20:29Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint, operator-approved)
- **Files modified:** 5 (2 code created, 3 evidence files)

## Accomplishments

- **The headline SC#1 artifact:** `out/risk-register-filled.docx` — a real KB folder → real cited field-map (Plan 02) → real openable .docx, end-to-end on one provider (Anthropic native forced tool-use, `claude-opus-4-8`). This is the milestone go/no-go's load-bearing evidence.
- **Unknown (b) answered YES / GO** (`out/unknown-b.md`): KB-grounded docxtpl fill produces a clean, re-openable file; every named failure mode logged clean.
- **`{%tr %}` row growth verified at 1 / 5 / 20** (the single most likely docx-path surprise, Pitfall 5): table grew header+N exactly — 2 / 6 / 21 rows — where python-docx / python-pptx structurally cannot grow a table at all.
- **SSTI containment wired (T-097-08 / TMPL-03):** every render goes through `DocxTemplate.render(jinja_env=SandboxedEnvironment(autoescape=True))` — proving the containment mechanism Phase 101's untrusted-upload path inherits, even on a trusted template.
- **`&<>` contained (Pitfall 2 / T-097-09):** seeded `Acme & <Corp> risk` survived as literal text after `autoescape=True` escaped it in the OOXML; the file re-opened intact.
- **Mandatory integrity gate (Pitfall 3 / T-097-10):** `Document(out_path)` re-open passed on every produced file — a corrupt file would have raised here and never been delivered (previews the production `output_file_valid` gate).
- **The Phase 101 UAT seed (SC#4):** `out/corruption.log` carries one row per Pitfall 1–6 (all clean) + Pitfall 7 (observe-only, single-version corpus) + pptx/xlsx not-exercised rows + the operator real-editor confirmation line.
- **Operator real-editor confirmation (Task 3, approved 2026-06-09):** opened `risk-register-filled.docx` in Word/LibreOffice — NO "needs repair" banner, risk table grew to 6 risk rows (one per risk, not a single template row), scalar tags (`project_name`/`report_date`) filled. This upgrades Pitfall 3 from "parses via python-docx" to "renders clean in a real editor" — the strongest evidence for unknown (b).

## Task Commits

Each task was committed atomically:

1. **Task 1: render_docx.py — docxtpl SSTI-contained render + integrity re-open + corruption-log writer** - `19f8bdcc` (feat)
2. **Task 2: run_spike.py — real KB→field-map→docx end-to-end + 1/5/20 growth + &<> probe + Pitfall 1–6 log** - `b109df5b` (feat)
3. **Task 3: Operator opens the filled .docx in a real editor** - human-verify checkpoint, operator-approved; result recorded in this plan-close commit (no code produced)

**Plan metadata:** this commit (docs: record real-editor approval + complete Plan 03)

## Files Created/Modified

- `scripts/spike-097/render_docx.py` - `build_context` (computes deterministic `score = P×I` when numeric, else None) + `render` (docxtpl + `SandboxedEnvironment(autoescape=True)` + `jinja_env=`) + `assert_integrity` (python-docx re-open + residual-tag scan) + `log_pitfall` (pipe-delimited corruption-log writer)
- `scripts/spike-097/run_spike.py` - the 6-step end-to-end orchestrator + synthetic 1/5/20-row growth renders + the `&<>` corruption probe + the Pitfall 1–6 log emission + `unknown-b.md` writer
- `scripts/spike-097/out/risk-register-filled.docx` (+ `-1/-5/-20` variants) - the SC#1 artifact + the row-growth proofs
- `scripts/spike-097/out/corruption.log` - the Pitfall 1–6 UAT seed + the operator real-editor confirmation line (appended on approval; Pitfall 1–6 rows untouched)
- `scripts/spike-097/out/unknown-b.md` - the written unknown-(b) answer + the "Real-editor confirmation" note + the worded-P/I Score carry-forward

## Decisions Made

- **Unknown (b) = YES / GO.** docxtpl is the recommended fill path for trusted project-library templates (the Phase 101 production target). Evidence: clean re-openable .docx, `{%tr %}` 1/5/20 → 2/6/21 growth, autoescape-contained `&<>`, SandboxedEnvironment SSTI containment, all six pitfalls clean, AND an operator-confirmed real-editor open with no repair banner.
- **Render local in the venv for spike speed; production render = sealed Docker sandbox (Phase 101).** Throwaway code stays in `scripts/spike-097/` off the hot files; docxtpl is venv-only, NOT added to `backend/Dockerfile.sandbox`/requirements (that is the Phase 101 prod add).
- **Worded P/I → blank Score is an honest degrade, not corruption.** The deterministic `score = int(P)×int(I)` compute correctly leaves the column blank when the KB speaks in High/Med/Low; the synthetic numeric variants do show P×I.

## Phase 101 carry-forwards

1. **Worded likelihood/impact → numeric Score mapping (NEW, surfaced by the real-editor open).** The real KB states probability/impact as words (High/Medium/Low), so the deterministic P×I compute leaves the real doc's Score column blank. Production template-fill (TMPL-02) must add a categorical→ordinal mapping (e.g. Low=1/Med=2/High=3) at context-build time — still a deterministic, NON-LLM compute. Until then a worded-P/I register fills every field except Score (blank, not wrong).
2. **Coarse table chunking reduces workshop-table risk retrieval (carried from Plan 01).** One table-heavy source doc chunked to a single coarse chunk, so the 4 workshop-table risks were not retrievable as distinct rows. Production ingestion/chunking for register-style tables needs finer granularity so every tabulated risk is independently citable.
3. **pptx / xlsx variable-row growth still unexercised (deferred).** This plan was docx-first. python-pptx cannot grow tables (pptx #192) and openpyxl cell-write + chart-preservation is untested — both are logged as not-exercised Phase 101 UAT rows. Phase 101 must exercise the pptx/xlsx fill + integrity paths before they ship.

## Deviations from Plan

None - plan executed exactly as written. (The Plan 02 max_tokens truncation fix and the `chunk-N` citation-id carry-forward were resolved/recorded in Plan 02, not here. This plan's only out-of-PLAN additions are the operator-approved real-editor confirmation lines, which the Task 3 `<action>` explicitly directs to append.)

## Issues Encountered

None during execution. The one honest limitation — the blank Score column on the real (worded-P/I) artifact — is expected behaviour (deterministic P×I compute does not parse words), was understood and accepted by the operator, and is captured as a Phase 101 carry-forward rather than a defect.

## User Setup Required

None - no external service configuration required. (The synthetic "Project Meridian — Risks" KB folder was ingested by the operator in Plan 01; this plan consumed it read-only.)

## Next Phase Readiness

- **Wave 2 complete.** Unknown (b) is answered with the strongest possible evidence (operator real-editor open, not just python-docx parse). 4 of 5 plans done (80%).
- **Next = Wave 3 / Plan 097-05** — the go/no-go conclusion: with unknown (a) YES, unknown (b) GO, and unknowns (c)+(d) answered (MIXED), Plan 05 writes the milestone go/no-go + the recommended `inputs`/`assets`/`folder_scope` schema shape + consolidates the Phase 101 UAT seed. Plan 05 carries a human checkpoint.
- **No blockers.**

## Self-Check: PASSED

- `scripts/spike-097/render_docx.py` — FOUND (committed `19f8bdcc`)
- `scripts/spike-097/run_spike.py` — FOUND (committed `b109df5b`)
- `scripts/spike-097/out/risk-register-filled.docx` (+ `-1/-5/-20`) — FOUND
- `scripts/spike-097/out/corruption.log` (Pitfall 1–6 + real-editor line) — FOUND
- `scripts/spike-097/out/unknown-b.md` (verdict + Real-editor confirmation note) — FOUND
- Commits `19f8bdcc` + `b109df5b` — present in `git log`
- No files under `backend/` written by this plan — CONFIRMED

---
*Phase: 097-spike-risk-register-template-fill-authoring-feel*
*Completed: 2026-06-09*
