---
phase: 101
slug: template-fill-integrity-validation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-10
---

# Phase 101 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `101-RESEARCH.md` → `## Validation Architecture` + `## Security Domain`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend; `backend/tests/unit/` + `backend/tests/`) |
| **Config file** | `backend/pyproject.toml` / `backend/pytest.ini` (existing — Phase 100 added `test_workspace_template.py`) |
| **Quick run command** | `backend/venv/Scripts/python.exe -m pytest backend/tests/unit/test_template_render.py -x` |
| **Full suite command** | `backend/venv/Scripts/python.exe -m pytest backend/tests -q` |
| **Estimated runtime** | ~60–90 seconds (full backend suite) |

> **Sandbox caveat:** production render runs in Docker, so unit tests cover the **deterministic helpers** (`build_context`, `residual_tags`, `assert_integrity`, the run-merge algorithm, `check_coverage`) directly against fixture bytes in the backend venv (`docxtpl` is pip-installable into the venv for the TEST tier). The end-to-end sandbox render + cross-provider emission is **live UAT**.

---

## Sampling Rate

- **After every task commit:** Run `backend/venv/Scripts/python.exe -m pytest backend/tests/unit/test_template_render.py -x`
- **After every plan wave:** Run `backend/venv/Scripts/python.exe -m pytest backend/tests -q` (account for the ~14–17 pre-existing vitest/E2E rot on the frontend — prove net-new via baseline checkout per SEED-056, NOT raw count)
- **Before `/gsd-verify-work`:** Full backend suite green + the live cross-provider scoreboard (8 providers) + the 6 SC#4 UAT rows
- **Max feedback latency:** ~90 seconds

---

## Per-Task Verification Map

> Task IDs (`101-NN-MM`) are assigned by the planner in step 8 and back-filled here at plan time. Rows below are the requirement→behavior→test contract the planner MUST cover; each behavior maps to at least one task's `<automated>` verify or a Wave 0 stub.

| Behavior | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command / Signal | File Exists | Status |
|----------|-------------|------------|-----------------|-----------|----------------------------|-------------|--------|
| Cited field-map shape validates; nullable leaves; coverage oracle covers template keys | TMPL-02 | T-097-07 | invented/uncited `source_chunk_id` rejected | unit | `test_field_map_covers_template_keys` | ❌ W0 | ⬜ pending |
| Deterministic citation check rejects uncited/invented before render | TMPL-02 | T-097-07 | reject-before-render | unit | `test_check_coverage_flags_uncited_and_invented` | ❌ W0 | ⬜ pending |
| Truncation guard rejects `stop_reason=max_tokens` emission | TMPL-02 | — | no partial field-map rendered | unit | `test_truncated_emission_rejected` | ❌ W0 | ⬜ pending |
| Trusted docxtpl render produces openable docx with grown `{%tr %}` rows | TMPL-02 | — | N/A | unit (venv docxtpl) | `test_trusted_render_grows_rows[1,5,20]` | ❌ W0 | ⬜ pending |
| Arbitrary run-merge replaces a token split across runs; scalar-only | TMPL-02 | T-097-08 | non-Jinja → SSTI impossible | unit | `test_run_merge_replaces_split_token` | ❌ W0 | ⬜ pending |
| Engine selected by PROVENANCE (AssetRef→docxtpl, template_input→run-replace) | TMPL-02 | T-097-08 | untrusted never reaches Jinja | unit | `test_engine_selection_by_provenance` | ❌ W0 | ⬜ pending |
| Cross-provider field-map emission — FULL native roster (D-14) | TMPL-02 | — | provider handling at service boundary | live UAT | one row per provider (OpenAI/Anthropic/Google/DeepSeek/Moonshot/GLM/MiniMax + OpenRouter); signal = openable file + cited field-map JSON in run log | manual | ⬜ pending |
| GLM/MiniMax registry-miss → STRUCTURED recovery still emits the field-map | TMPL-02 | — | shared fill path never branches | live UAT | signal = produced file (not narrated prose); cross-check `resolve_calling_mode` | manual | ⬜ pending |
| Integrity re-open catches a corrupt file before delivery | TMPL-03 | T-097-10 | corrupt file never delivered | unit | `test_corrupt_file_never_delivered` | ❌ W0 | ⬜ pending |
| `SandboxedEnvironment(autoescape=True)` escapes `& < >` (Pitfall 2) | TMPL-03 | T-097-02 | XML special chars survive as literals | unit | `test_autoescape_contains_xml_special_chars` | ❌ W0 | ⬜ pending |
| Render runs in the sealed sandbox (not local) | TMPL-03 | T-097-08 | network-less, no host FS | live UAT | render works only with `SANDBOX_ENABLED` + new image; ModuleNotFoundError on old cached session proves isolation | manual | ⬜ pending |
| Untrusted upload never reaches Jinja (SSTI structurally impossible) | TMPL-03 | T-097-08 | provenance boundary | unit | `test_template_input_routes_to_non_jinja_engine` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### SC#4 Named Failure Modes (G-6 — the pre-named "How we'd know this failed" rows)

| # | Failure mode | Validation method | Observable signal of PASS |
|---|--------------|-------------------|---------------------------|
| 1 | docx run-split silent miss (arbitrary path) | unit + live UAT | fragmented `{{token}}` fills correctly; residual-tag scan = `[]` after fill |
| 2 | unescaped `& < >` XML corruption | unit | `Acme & <Corp>` re-opens; literal text survives; no repair banner |
| 3 | produced file won't open | unit + live UAT | `assert_integrity` raises → `verdict.opened=false` → file NOT delivered; honest error + field-map fallback (D-08) |
| 4 | pptx variable-row table | live UAT | pptx fill produces openable file; verdict carries `documented_limit: "pptx cannot grow tables (python-pptx ≥1.0.0)"` — pass OR documented |
| 5 | xlsx chart strip | live UAT | chart-bearing xlsx fills scalars + verdict carries `documented_limit: "openpyxl drops charts on save"` |
| 6 | xlsx merged-cell mis-write | unit + live UAT | merged-cell anchor fills correctly OR verdict documents the limit; integrity re-open passes |
| (impl) | won't-render (Jinja TemplateSyntaxError) | unit | `render` returns `{rendered:false, error:"TemplateSyntaxError..."}` not a crash |

---

## Wave 0 Requirements

- [ ] `backend/tests/unit/test_template_render.py` — TMPL-02 deterministic core (field-map, coverage, run-merge, engine selection, render-grows-rows)
- [ ] `backend/tests/unit/test_template_integrity.py` — TMPL-03 (corrupt-rejected, autoescape, SSTI routing)
- [ ] Test fixtures under `backend/tests/fixtures/templates/`: a `{%tr %}` docx template, an arbitrary-upload docx with a run-fragmented `{{token}}`, a pptx with a table, a chart-bearing xlsx (small binaries committed)
- [ ] **SEEDED library-asset fixture** (D-09): a published `WorkflowDefinition` with an `assets[]` entry pointing at a real Storage object (trusted-path UAT needs this — Storage upload + a definition row; seed via setup script — RESEARCH Open Question 3)
- [ ] Framework install for the venv TEST tier: `backend/venv/Scripts/pip install docxtpl==0.20.2` (test-tier render only; production render is the sandbox)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cross-provider field-map emission across the FULL native roster | TMPL-02 | Live LLM calls per provider; non-deterministic; SC#10 4-axis scoreboard | Run a fill workflow on each of OpenAI/Anthropic/Google/DeepSeek/Moonshot/GLM/MiniMax + OpenRouter; confirm an openable file + a cited field-map in the run log; document any provider that degrades (D-15 / Cond 7 "pass OR documented") |
| Render is sandbox-isolated (not local) | TMPL-03 | Requires a fresh chat against the new `SANDBOX_IMAGE` | New chat → fill → file produced; an OLD cached session (pre-image-bump) raises `ModuleNotFoundError` proving isolation (CLAUDE.md cached-session gotcha) |
| pptx variable-row table limit | TMPL-02/SC#4 | Upstream library hard limit; verdict-documented, not silently filled | Fill a pptx with a table; confirm openable + verdict `documented_limit` present |
| xlsx chart strip + merged-cell | TMPL-02/SC#4 | Upstream openpyxl behavior on save | Fill a chart-bearing xlsx; confirm verdict documents the chart-strip / merged-cell limit |
| Integrity-fail → honest error + cited field-map fallback surfaced (D-08) | TMPL-03 | UI run-honesty surface; operator-recognizable failure | Force an integrity failure; confirm the run shows a specific error naming the integrity failure + the extracted cited data is preserved as fallback output |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
