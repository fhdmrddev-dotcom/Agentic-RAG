---
id: SEED-096
status: routed
routed: 2026-06-29 — OPERATOR DECISION (during Phase 132 plan-phase). HONESTY slice → broaden v3.2 Phase 142 (SRH-01) at its discuss-phase to fire the "can't execute this" signal on missing-bundled-file (G-A) + missing-binary (G-C) cases, not only non-Python (G-B). CAPABILITY fix (real tree-fidelity + Node + system binaries) stays DISC-01 / v3.3+. v3.2 scope otherwise UNCHANGED.
planted: 2026-06-29
planted_during: v3.2 (Phase 132 plan-phase — operator asked to evaluate whether the imported Anthropic `docx` skill is triggered + executable end-to-end)
trigger_when: A user imports/runs an Anthropic (or marketplace) skill that ships a nested `scripts/` tree and/or relies on system binaries (pandoc, LibreOffice/soffice, Poppler) — OR any "import any skill and have it actually run" reliability goal — OR sandbox-image / skill-injection seam work
scope: Large
related: [[SEED-044]] (multi-language exec — the LANGUAGE slice), [[SEED-043]] (sandbox package mgmt), [[project_skills_mime_known_gap]] (MIME loss on import)
re_open_trigger: v3.2 Phase 142 (SRH-01) scoping — decide whether SRH-01's honesty gate covers ALL "runtime can't do this" cases (missing bundled file, missing binary) or only non-Python; AND v3.3+ DISC-01 (full runtime)
---

# SEED-096: Skill Bundle File-Tree Fidelity + Runtime Tooling — why Anthropic's `docx` skill is inert today

> **Worked example, fully evidence-checked 2026-06-29.** The operator imported Anthropic's official `docx` skill (https://github.com/anthropics/skills/tree/main/skills/docx) and asked: is it triggered and *executable* with our current capabilities? Answer: **it triggers but cannot actually execute.** Crucially, the dominant blocker is **NOT language** — the docx skill's edit path is **100 % Python** — it's that we lose the skill's directory tree on import + at sandbox injection, and we lack the system binaries the skill calls. This is broader than (and distinct from) [[SEED-044]]'s non-Python concern.

## Upstream bundle (canonical, via GitHub API `git/trees/main?recursive=1`)

`skills/docx/` ships: `SKILL.md`, `LICENSE.txt`, and a **deeply nested** `scripts/` tree — all Python + XSD:
- `scripts/__init__.py`, `scripts/accept_changes.py`, `scripts/comment.py`
- `scripts/office/unpack.py`, `scripts/office/pack.py`, `scripts/office/soffice.py`
- `scripts/office/helpers/{__init__,merge_runs,simplify_redlines}.py`
- `scripts/office/schemas/ISO-IEC29500-4_2016/*.xsd` (~25 schema files), `…/ecma/…`, `…/mce/…`, `…/microsoft/*.xsd`

The SKILL.md instructs invoking these by **relative path** (`python scripts/office/unpack.py document.docx unpacked/`, `python scripts/office/pack.py …`, `python scripts/comment.py …`) and also a **JavaScript** "create new document" path (`npm install -g docx`, docx-js) plus system binaries: `pandoc`, `extract-text`, LibreOffice (`soffice`), Poppler (`pdftoppm`).

## What our app actually does (file:line evidence)

1. **Import flattens the tree.** `import_skill` computes `filename = os.path.basename(relative)` and stores `file_path = {user}/{skill}/{basename}` (`backend/app/api/skills.py:264-269`, upload at `:96-103`). So `scripts/office/unpack.py` → stored as `unpack.py`; the `scripts/office/` segment is gone. Same-named files in different subdirs collide/overwrite. Export re-buckets by MIME (`skills.py:608-612`) — round-trip can't reconstruct the tree.
2. **Runtime injection is also flat + wrong CWD.** Skill files are injected only when the model passes `skill_files` to `execute_code`; each is written to `/sandbox/{basename}` (`backend/app/services/tool_dispatcher.py:966-977`), and user code is `os.chdir('/sandbox/output')` (`:981`). So a relative `scripts/office/unpack.py` resolves against `/sandbox/output/` and is never found. `load_skill` injects nothing — it only returns the filename list (`tool_dispatcher.py:690-703`).
3. **Sandbox is Python-only, no system tools.** `backend/Dockerfile.sandbox` is `python:3.11-slim` + pip wheels only — **no `apt-get`**, so no `pandoc`, no LibreOffice, no Poppler, and **no Node/npm** (`sandbox_service.py:41` hardcodes `lang="python"`). The docx-js create path and every binary the skill calls cannot run.
4. **This particular docx row imported with ZERO bundled files** (local DB: `skill_files` count = 0 for `docx`; by contrast `pptx` kept 55, but flattened + all `application/octet-stream` — see [[project_skills_mime_known_gap]]). So the docx skill is instructions-only: even the Python scripts aren't present to run.
5. **`read_skill_file` is text-only** (`tool_dispatcher.py:767-808`) — fine for reading, but not an execution path.

## The four distinct gaps (only one is "language")

| Gap | Blocks | Current owner |
|-----|--------|---------------|
| **G-A — bundle tree fidelity** (import-flatten + flat inject + chdir) | breaks even ALL-PYTHON skills (docx edit path) | **no phase owns it** — this seed |
| **G-B — non-Python runtime** (docx-js create path) | the JS slice only | [[SEED-044]] → SRH-01 (P142 honesty) / DISC-01 (v3.3+ Node) |
| **G-C — system binaries** (pandoc/soffice/pdftoppm/`extract-text`) | conversions, PDF→image, text extract | DISC-01 / sandbox-image scope (v3.3+) |
| **G-D — honest failure** when any of the above is hit | trust (agent may narrate fake success) | P142 SRH-01 — but currently scoped only to "non-Python script" |

## Why it matters

The operator's value prop is "import any skill (incl. Claude.ai's own) and have it work." Today an imported flagship skill **triggers**, the model **follows its instructions**, then the script/binary isn't there — so it either errors confusingly or (the real risk) **narrates success that didn't happen**. The honesty gate (SRH-01/P142) must therefore cover *all* "runtime can't do this" cases, not just non-Python — and a real fix needs bundle-tree fidelity (G-A) at minimum.

## Routing recommendation (operator to confirm)

- **Now / cheap:** broaden **P142 (SRH-01)** so the honest "can't execute this" signal fires on missing-bundled-file and missing-binary cases too — not only `.js`. (Honesty, not capability.)
- **Real fix, medium:** a dedicated phase for **G-A bundle-tree fidelity** (preserve relative paths on import + inject the tree under a stable skill root + reference it absolutely, not via CWD). Pairs with the COLL-01 sandbox-injection seam (sequence AFTER it). Retires part of [[project_skills_mime_known_gap]].
- **Capability, large:** **DISC-01 (v3.3+)** for Node + system binaries (G-B/G-C) — out of v3.2.
- **NOT Phase 132** — 132 is pure schema/versioning/test-case persistence; this is the execution substrate.
