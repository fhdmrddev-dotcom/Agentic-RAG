---
title: Sandbox image parity with the big providers' skill runtimes
seed_id: SEED-106
status: planted
planted: 2026-07-07
planted_during: v3.2 STRETCH (Phase 140 in flight — operator asked after the BUG-260707-02 pptx-skill fix "should the sandbox be up to the standard of the big providers' skill runtimes?")
trigger_when: A user imports/runs any OFFICIAL provider skill (Anthropic pptx/docx/xlsx/pdf, Google, OpenAI) that calls a document-conversion binary or a non-baked Python lib — OR the "official skills work out of the box, without missing anything" reliability goal is scoped — OR any sandbox-image (`backend/Dockerfile.sandbox`) rebuild is on the table
trigger_paths:
  - "backend/Dockerfile.sandbox"
scope: Medium-Large
related: [[SEED-096]] (this seed IS the focused execution of its G-C "system binaries" gap), [[SEED-044]] (the SEPARATE non-Python/JS runtime gap — G-B), [[project_skills_mime_known_gap]] (MIME/flatten loss on import), [[SEED-093]] (skill residuals), BUG-260707-02 (the worked example that motivated this)
re_open_trigger: Next milestone planning (v3.3+ / a skills-hardening milestone) OR any operator report of an official skill looping/failing on a missing binary or library
surface: Agentic-RAG
---

# SEED-106: Sandbox image parity with the big providers' skill runtimes

> **North star (operator, 2026-07-07):** "We should support the official Cloud [Claude] / Google / OpenAI skills somehow without missing anything, so our app supports them to the standard of the big providers." This seed is the **capability** half of that — bring `backend/Dockerfile.sandbox` up to the toolchain those official skills are authored against, so an imported flagship skill *just works* instead of needing a per-skill patch.

## Worked example (fresh evidence — BUG-260707-02, 2026-07-07)

The user's imported stock Anthropic **`pptx`** skill ran a 5-slide RPA task (GLM run `a4f41f5e`). The deliverable built fine, then the skill's own QA workflow burned **~8 execute_code retry rounds** calling tools our sandbox doesn't have:
- `python -m markitdown …` → **No module named markitdown** (pip lib, not baked)
- LibreOffice `soffice` (PPTX→PDF for visual QA) → **FileNotFoundError; one round hit exit_code 124 = timeout** (OS binary, not installable at runtime)
- `pdftoppm` (Poppler, PDF→image) → absent (OS binary)

The agent only recovered by improvising an in-memory python-pptx audit. **The band-aid** (BUG-260707-02) rewrote *that one user's `pptx` skill* to be in-memory-only — but that's per-skill, per-user, and re-import reverts it. The docx/xlsx/pdf skills carry the same assumptions.

## Root cause — parity gap, NOT a language problem

`backend/Dockerfile.sandbox` is `python:3.11-slim` + 13 pip wheels (the Claude.ai **analysis-tool** data-science set: matplotlib/pandas/python-pptx/…). Official **Agent Skills** are authored against Anthropic's **skills-execution runtime**, which additionally ships a document toolchain (LibreOffice, Poppler, pandoc, markitdown, …). We mirror the analysis-tool set but NOT the skills-runtime toolchain → imported official skills reference tools we lack.

Two dependency layers, and the distinction is the whole point:

| Layer | Examples | Can it be installed at run time? | Fix |
|-------|----------|----------------------------------|-----|
| **Python packages** | `markitdown`, `pandoc` (py wrapper) | In principle via pip, but the sandbox network is sealed (`Dockerfile.sandbox` comment) + costs 10-30s warm-up → unreliable | **Bake into the image** (pip in Dockerfile) |
| **OS binaries** | LibreOffice (`soffice`), Poppler (`pdftoppm`), pandoc (native) | **No** — not pip; needs `apt-get` at build; the agent has no root/apt mid-run | **Bake into the image** (`apt-get` in Dockerfile) — the ONLY place they can live |

So the durable fix lives entirely in the image build. This is **G-C** in [[SEED-096]]'s four-gap table; this seed is the concrete execution of it (with a real evidence trail + a proposed toolchain list). It is DISTINCT from [[SEED-044]] (running non-Python skill *code* — the JS gap) and from G-A bundle-tree fidelity.

## Proposed toolchain to bake (parity target — refine at scoping)

Add via `apt-get` + pip to `Dockerfile.sandbox`, then bump the tag + `SANDBOX_IMAGE`:
- **LibreOffice** (`soffice`, headless) — PPTX/DOCX/XLSX → PDF conversion (the biggest single add)
- **Poppler** (`pdftoppm`, `pdftotext`) — PDF → image / text
- **pandoc** — universal document conversion (docx/md/html/…)
- **markitdown** (pip) — document → markdown text extraction
- (evaluate) fonts package for correct rendering (e.g. `fonts-liberation`), `libreoffice-writer/impress/calc` subsets instead of full suite to trim size

## Operator constraints (2026-07-07)

- **Storage/image size: acceptable.** LibreOffice alone adds ~300-500 MB (image ~700 MB → ~1.1-1.3 GB). Operator confirmed the storage cost is fine.
- **Performance: measure and weigh — this is the real trade to watch.** A bigger image means slower first `docker pull` and potentially slower cold container spin-up. Because sandbox sessions are cached per `thread_id` until idle eviction, this hits **first-run / new-chat latency**, not warm reuse. Scoping MUST include: (1) measure cold-start delta before/after; (2) consider LibreOffice subset packages + `--no-install-recommends` to trim; (3) confirm the sealed-network / build-only-install assumption holds. If cold-start regresses meaningfully, prefer subset packages or a lazy/second image variant over dropping the capability.

## Why it matters

The value prop is "import any skill — including the providers' own flagship skills — and have it work." Today an imported official document skill triggers, the model follows it, then a binary/lib isn't there → it loops (wasted rounds + dead-air timeout) or, worse, narrates success it didn't achieve. Per-skill instruction patches don't scale and revert on re-import. Image parity fixes the whole class at once.

## Routing recommendation (operator to confirm at surfacing)

- **This seed (capability):** a dedicated **sandbox-parity phase** — extend `Dockerfile.sandbox` with the toolchain above, bump tag + `SANDBOX_IMAGE`, measure cold-start, verify the pptx/docx/xlsx/pdf official skills run end-to-end unpatched. Sequence AFTER (or with) [[SEED-096]] G-A bundle-tree fidelity so the skills' nested `scripts/office/*` helpers also resolve.
- **Surfacing:** operator asked to surface this **after Phase 140** (in flight now) — candidate for the next milestone / a skills-hardening milestone (v3.3+), alongside SEED-096 DISC-01.
- **Not now:** don't rebuild the image mid-140; the pptx band-aid (BUG-260707-02) holds the immediate case.
- **Companion (separate seeds):** [[SEED-044]] for non-Python execution; [[SEED-096]] G-A for import tree fidelity.
