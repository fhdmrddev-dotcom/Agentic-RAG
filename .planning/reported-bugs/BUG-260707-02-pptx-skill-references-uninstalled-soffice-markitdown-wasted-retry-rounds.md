---
id: BUG-260707-02
title: pptx skill QA workflow calls uninstalled soffice/markitdown (+ wrong output path) → 8 wasted execute_code retry rounds
reported: 2026-07-07
surface: Agentic-RAG
severity: major
status: folded                    # per-user data fix APPLIED 2026-07-07; durable SYSTEMIC fix folded into Phase 142 (SRH-01) at discuss-phase 2026-07-08 (G-C worked example). Flips to `closed` when 142's mechanism verifiably stops such a loop generically.
affected_areas: [skills, sandbox, backend/tools]
folded_into: 142
verified_closed_by: null
resolution_applied: 2026-07-07     # data fix to skills.instructions (id a573ebc5); see Resolution section
related_seeds: [SEED-093]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: cb9fef39
  date: 2026-07-07
---

# BUG-260707-02: `pptx` skill's QA workflow depends on tools missing from the sandbox → long retry loop

## What we observed

The RPA 5-slide pptx task (GLM, run `a4f41f5e-…`) produced **18 tool calls**, of
which **10 were `execute_code`**. The deliverable itself succeeded early; the bulk
of the run was a **~8-round retry loop in skill-driven QA** against tools that are
not installed in the sandbox image (`agentic-rag-sandbox:101.1`).

Reconstructed from the persisted `tool_calls` (message `c3bba996-…`):

| Step | Description | Result |
|---|---|---|
| [7] | Building 5-slide presentation | ✅ `RPA_Study_Fahed_Mrad.pptx`, 5 slides, 64 KB |
| [9] | Convert PPTX→PDF for visual QA | `python /sandbox/scripts/office/soffice.py` → **No such file or directory** |
| [10] | Locating LibreOffice | **exit_code 124 (timeout)** — hung until killed |
| [11] | Direct `soffice` PDF conversion | **FileNotFoundError: 'soffice'** |
| [12] | Skill `soffice.py` helper | "Injected skill file: soffice.py" → **RC:1** (soffice binary missing) |
| [13] | Content QA via markitdown | **No module named markitdown** |
| [14] | Layout audit | **FileNotFoundError** on `/sandbox/output/RPA_Study_…pptx` (wrong path) |
| [15] | Check output dir | `Exists check: False` — confirms wrong path |
| [16] | Rebuild + **in-memory** layout audit | ✅ recovered (0 out-of-bounds, 5 slides) |
| [17] | Final content/chart verification | ✅ |

Run ended `completed` — the agent recovered via the in-memory path — but only
after burning ~8 rounds (incl. a full **timeout**) on missing dependencies.

The loaded skill is the built-in **`pptx`** skill. Its own Quick Reference
instructs:

> `Read/analyze content | python -m markitdown presentation.pptx`

and its editing guide drives the LibreOffice/`soffice` PPTX→PDF path — so the
agent was faithfully following the skill into tools that don't exist in the image.

## Why it matters

- **Wasted time + dead air.** ~8 failed rounds including a full timeout (exit 124)
  = the "silence" the user reported, and a direct amplifier of BUG-260707-01
  (each mid-run stream-end can trigger the composer/feedback premature-done flip).
- **Fragile.** The run only completed because the agent improvised an in-memory
  fallback. A less capable model may loop until the Continue budget is exhausted
  and ship a worse/failed result.
- Confirms the operator's hypothesis directly: **it is the skill** — its documented
  QA workflow assumes resources not present in the sandbox.

## Hypothesized cause

**Verified, not hypothesis.** The `pptx` skill documents a QA/verification
workflow that requires:
1. **`soffice` / LibreOffice** (PPTX→PDF visual QA; skill even ships a `soffice.py`
   helper) — NOT in `agentic-rag-sandbox:101.1` (per CLAUDE.md the image ships
   matplotlib/numpy/pandas/python-pptx/openpyxl/python-docx/pypdf/reportlab/
   seaborn/scipy/scikit-learn/plotly/docxtpl — **no LibreOffice**).
2. **`markitdown`** module (content QA) — NOT in the image.
3. A **`/sandbox/output/…` path** for the produced file — but files land in a
   per-run `sandbox-outputs/{session}/{run}/…` path, so the assumed path 404s.

Skill instructions are not sandbox-aware; the skill was authored against an
environment that had LibreOffice + markitdown and a fixed output dir.

## Surface classification

`Agentic-RAG` — built-in skill + sandbox image, our app. Routing candidate.
(Distinct from the external `claude-ai-multi-step-code-execution-ux.md`, which is
`surface: Claude.ai`, external-noted.)

## Suggested routing

- **Fold into in-flight phase:** n/a — unrelated to 139 / 140.
- **Defer to future phase / milestone:** a skills-hardening / sandbox-parity phase.
  Two independent fix levers (do one or both):
  - **Skill fix (preferred, cheap):** rewrite the `pptx` skill QA steps to be
    sandbox-aware — use in-memory python-pptx audits (as the agent's own step [16]
    recovery did), resolve the real output path, and drop the markitdown/soffice
    instructions (or gate them behind a capability check).
  - **Image fix:** add LibreOffice (`soffice`) + `markitdown` to `Dockerfile.sandbox`,
    bump the tag, update `SANDBOX_IMAGE` (per CLAUDE.md tag-discipline rule). Heavier
    (LibreOffice is large); only if PDF-from-office is a first-class need.
- **Plant as seed:** ties to **SEED-093** (tuner/skill residuals) and the skill
  bundle-fidelity thread ([[reference_js_skill_import_gap]]); a "skills must declare
  / be validated against sandbox capabilities" seed is warranted.
- **External — note only:** no.

## Workarounds (prompt-side, code-side, or UI-side)

- Prompt-side: tell the agent "skip PDF/visual QA; verify the pptx in-memory with
  python-pptx and use the returned output path" to bypass the soffice/markitdown/
  path steps.
- Op-side: if PPTX→PDF is genuinely needed, add LibreOffice to the sandbox image.

## Resolution applied (2026-07-07)

Per operator choice "Fix the pptx skill", the skill's `instructions`
(`skills.instructions` where `id = a573ebc5-a739-4389-87fe-53ae1ec7cc4e`) were
rewritten to be **sandbox-aware** — the tool-dependent sections now use in-memory
python-pptx and explicitly forbid the missing tools:

- **Quick Reference / Reading Content** → read slide text in-memory with
  python-pptx (was `python -m markitdown …`).
- **QA → Content QA** → in-memory text dump + a Python placeholder-text scan (was
  `markitdown output.pptx | grep …`).
- **QA → Visual QA** → a programmatic python-pptx layout audit (out-of-bounds /
  overflow / margins) — the exact in-memory check the agent itself improvised at
  step [16] (was subagent image inspection via soffice→pdf→image).
- **Converting to Images** → replaced with a "not available in this sandbox" note
  (was `scripts/office/soffice.py --convert-to pdf` + `pdftoppm`).
- **Dependencies** → now lists python-pptx as the only available tool and marks
  `markitdown` / LibreOffice(`soffice`) / Poppler(`pdftoppm`) / `scripts/office/*`
  as NOT available.
- A top **Sandbox note** tells the agent to work in-memory and use relative output
  paths (addresses the `/sandbox/output/…` wrong-path assumption at steps 14-15).

The **design guidance** block (color palettes, typography, layout, avoid-list) is
preserved byte-for-byte. Verified post-edit: the smoking-gun commands
`markitdown output` and `soffice.py --headless` no longer appear in the
instructions. New length 9366 chars (was 8618).

**Durable copy of the applied instructions:**
`.planning/reported-bugs/BUG-260707-02-pptx-skill-instructions-sandbox-aware.md`
(the skill is user-imported DB+Storage data, not repo-seeded, so this companion
file is the recoverable source if the dev DB is reset). Original pre-edit
instructions are backed up in the session scratchpad.

### Residuals (why status stays `open`)

1. **Not live-verified** — flip to `closed` after ONE live pptx run confirms the
   agent no longer loops on soffice/markitdown (should now go build → in-memory
   audit → done).
2. **Storage aux files** (`editing.md`, `soffice.py`, `python-pptx-guide.md`) still
   live in Supabase Storage with their original soffice/markitdown references. The
   rewritten instructions no longer point the agent at them and explicitly forbid
   them, so the observed create-from-scratch loop is closed — but a template-edit
   path that reads `editing.md` could still surface soffice guidance. Low risk;
   track if a template-based pptx run loops.
3. **Per-user / re-import scope** — this is a data fix to ONE user's imported skill.
   A re-import or another user importing the stock Anthropic pptx skill reintroduces
   it. The durable cross-user fix (sandbox parity OR import-time capability
   sanitization) remains a future skills-hardening concern — see SEED-093 /
   [[reference_js_skill_import_gap]].

## Reference / evidence links

- Run `a4f41f5e-0314-4f8e-bb17-e601733a3a0d`, thread `eda49aa0-4332-4bf7-a088-c663a0b8be92`,
  assistant message `c3bba996-3f0c-409d-b0d1-b94a9ac103ec` (18 tool_calls; 10 execute_code).
- Skill: built-in `pptx` (load_skill step [1]; `read_skill_file python-pptx-guide.md` step [5]).
- Sandbox image package set: CLAUDE.md (`Dockerfile.sandbox`, tag `101.1`).
- Related: BUG-260707-01 (the retry loop's mid-run stream-ends trigger the
  composer/feedback premature-done flip).
