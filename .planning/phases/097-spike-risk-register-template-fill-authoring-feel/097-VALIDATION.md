---
phase: 097
slug: spike-risk-register-template-fill-authoring-feel
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-08
---

# Phase 097 — Validation Strategy (SPIKE-framed)

> **This is a throwaway spike (SEED-051), not production code.** "Validation" here = the **observable evidence that proves each of the 4 unknowns was actually answered** + a written go/no-go — NOT production test coverage. There is no durable code to unit-test; the deliverable is the captured artifacts under `scripts/spike-097/out/` plus a written conclusion. Source: `097-RESEARCH.md` → "## Validation Architecture (spike-framed)".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — throwaway script; no test suite is added. The spike's "tests" are the captured artifacts. |
| **Config file** | none — Wave 0 installs `docxtpl==0.20.2` into the spike venv only |
| **Quick run command** | `python scripts/spike-097/run_spike.py --folder <id> --template scripts/spike-097/templates/risk-register.docx` |
| **Full evidence run** | quick run + `python scripts/spike-097/authoring_feel.py` (transcript capture) |
| **Estimated runtime** | < 1 min per quick run after a warm KB |

---

## Sampling Rate

- **After every task commit:** Re-run the quick run; confirm `out/` artifacts regenerate cleanly.
- **After the render task:** Re-open the produced `.docx` for 1 / 5 / 20-row field-maps; confirm `out/corruption.log` shows clean.
- **Before `/gsd-verify-work`:** All four unknowns have a written answer, the six failure-mode rows are logged, and the go/no-go is written (ROADMAP SC#1–4).
- **Max feedback latency:** ~60 seconds (quick run).

---

## Per-Task Verification Map

> For a spike, "verification" is **the artifact each task must leave on disk**, not an automated assertion command. Each row maps a planned task to the observable evidence that proves it ran.

| Task ID | Plan | Wave | Unknown / SC | Evidence artifact (pass condition) | Status |
|---------|------|------|--------------|-------------------------------------|--------|
| 097-W0 | — | 0 | env | `docxtpl==0.20.2` importable in spike venv; a `{%tr %}` `risk-register.docx` exists; a real risk-content KB folder id is known | ⬜ pending |
| 097-a | TBD | — | (a) derive fields / SC2a | `out/field-map.json` keys ⊇ template placeholder set; null-rate sane; non-null rows carry `source_chunk_id`/page | ⬜ pending |
| 097-b | TBD | — | (b) clean fill / SC1, SC2b | `out/risk-register-filled.docx` re-opens; `out/corruption.log` clean for 1/5/20-row renders | ⬜ pending |
| 097-c | TBD | — | (c) authoring grounding / SC2c | `out/transcript.md` lists the grounding the draft used (folder tree + tool/skill registry + template); draft proposes correct fields/tools/scope | ⬜ pending |
| 097-d | TBD | — | (d) describe→refine→publish feel / SC2d | `out/transcript.md` captures describe → ≥1 refine → re-draft; a written subjective verdict | ⬜ pending |
| 097-fm | TBD | — | failure modes / SC4 (G-6) | `out/corruption.log` has one row per Pitfall 1–6 (clean / corrupt / where-broke) — the Phase 101 UAT seed | ⬜ pending |
| 097-go | TBD | — | go/no-go / SC3 | a written go/no-go on the docxtpl path + a recommended `inputs`/`assets`/`folder_scope` schema shape | ⬜ pending |

*Status: ⬜ pending · ✅ evidence captured · ❌ blocked · ⚠️ partial/inconclusive*

---

## Wave 0 Requirements

- [ ] `pip install docxtpl==0.20.2` into the **spike venv** (NOT a production dependency yet — Phase 101 adds it to `backend/Dockerfile.sandbox` + bumps `SANDBOX_IMAGE`)
- [ ] Author `scripts/spike-097/templates/risk-register.docx` — a small `{%tr %}` variable-row table template (covers unknowns a/b)
- [ ] Confirm a real risk-content KB folder exists for the dev test user (`fhdmrd@gmail.com`) — else there is nothing to ground/fill (covers grounding, research assumption A2)
- [ ] Create `scripts/spike-097/` at the **repo root** (outside `backend/`'s uvicorn `--reload` watch tree, off the G-5 hot files) with an `out/` artifacts dir

*No conftest/framework install — throwaway script, no suite.*

---

## Manual-Only Verifications

| Behavior | Unknown | Why Manual | Test Instructions |
|----------|---------|------------|-------------------|
| Produced `.docx` opens correctly in a real editor | (b) | "re-opens via python-docx" proves it parses, not that it renders visually correctly | Open `out/risk-register-filled.docx` in Word/LibreOffice; confirm the risk table rendered with the expected rows and no corruption banner |
| describe→refine→publish *feels* like talking, not wiring | (d) | "feel" is inherently subjective — the spike's job is to produce a written human verdict, not a metric | Walk the authoring loop in `authoring_feel.py`; write the verdict + friction notes into `out/transcript.md` |
| Field-map citations actually point at the right source spans | (a) | citation *correctness* needs a human to confirm the cited chunk really supports the value | Spot-check ≥3 non-null rows in `out/field-map.json` against the cited `source_chunk_id` content |

---

## Validation Sign-Off

- [ ] All four unknowns (a–d) have a written answer backed by a named artifact under `scripts/spike-097/out/`
- [ ] The six named failure modes each have a `corruption.log` row (clean / corrupt / where-broke) — the Phase 101 UAT seed (G-6)
- [ ] A written go/no-go on the docxtpl fill path exists
- [ ] A recommended additive-optional `inputs` / `assets` / `folder_scope` schema shape is written (the spike's output that BECOMES the lock candidate — nothing committed in the spike)
- [ ] SSTI containment pattern (`jinja2.sandbox.SandboxedEnvironment`) is wired and demonstrated, even on the trusted spike template (proves the TMPL-03 mechanism for Phase 101)
- [ ] `nyquist_compliant: true` set in frontmatter once the above hold

**Approval:** pending
