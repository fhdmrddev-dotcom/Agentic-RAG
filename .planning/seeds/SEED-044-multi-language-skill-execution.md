---
title: Multi-Language Skill Execution — Sandbox Runtimes Beyond Python
seed_id: SEED-044
status: folded
partial: true
status_note: |
  ORIGINAL `status:` line, verbatim — displaced by Phase 251's frontmatter migration (D-10):
  status: partially-folded

  Mapped `partially-folded` -> `folded` + `partial: true`. Reason: D-16 — folded on one axis, pending on another.
planted: 2026-05-31
planted_during: v2.8 (Harness Engine & Workflow Mode — surfaced during Phase 090 operator-testing-notes triage)
trigger_when: A user imports or runs a skill whose scripts are not Python (e.g. a marketplace skill with .js), OR a skill manifest declares a non-Python runtime, OR Skill Studio (v3.0) adds per-skill dependency/runtime declarations
scope: Large
folded_into: v3.1 Phase 131 (Layer 1 only — SRH-01)
re_open_trigger: v3.2 planning (Layers 2-4 = DISC-01 + STD-01 — Node runtime, skill-declared runtime, language routing)
surface: Agentic-RAG
---

# SEED-044: Multi-Language Skill Execution — Sandbox Runtimes Beyond Python

> **CROSS-REF 2026-06-29 ([[SEED-096]]):** A docx-skill execution audit found the dominant blocker for Anthropic's `docx` skill is NOT language — its edit path is all-Python — but **bundle file-tree fidelity** (import flattens `scripts/office/*.py`; sandbox injects flat at `/sandbox/{basename}` while user code is chdir'd to `/sandbox/output`) + **missing system binaries** (pandoc/LibreOffice/Poppler). SEED-044 owns the LANGUAGE slice (docx-js create path / Node); [[SEED-096]] owns tree-fidelity + tooling. The SRH-01 honesty gate should cover all three.
>
> **STATUS 2026-06-22 — partially folded.** A JS-skill-import investigation (workflow `wf_8f8177ba-805`) re-confirmed all three Python-only pins below against live code AND surfaced an important nuance: Anthropic's own docx/pptx skills document a **Node** create-from-scratch path (`docx` npm / `pptxgenjs`), so JS is **not** purely long-tail for documents — though our app's Python emission layer (Phases 100/101) already generates those documents, so this is about running market skills' bundled scripts verbatim, not document generation. **Layer 1 (graceful degradation / honest message) folded into v3.1 as STRETCH Phase 131 (SRH-01)**, kept OFF the COLL-01 sandbox seam. **Layers 2-4 (skill-declared runtime, Node in the image, language routing) remain deferred → v3.2 DISC-01 + STD-01** (DISC-01 must sequence strictly AFTER COLL-01 — same sandbox-injection seam).

## Why This Matters

The code sandbox is **Python-only today, three layers deep**, but the skill marketplace is not — many skills ship `.js` (and other-language) scripts. The operator imported a marketplace skill on 2026-05-31: it **imported successfully** (skill files are just stored) but **failed to execute the parts that were JavaScript, not Python.** That "imports fine, then partially fails" experience is confusing and undermines the marketplace-import value prop.

The three layers that pin it to Python:
1. `backend/app/services/sandbox_service.py:41` hardcodes `session_kwargs = {"lang": "python", ...}` — every sandbox session is a Python interpreter.
2. The sandbox image is `python:3.11-slim` (`backend/Dockerfile.sandbox`) — there is **no Node.js** (or Ruby/Deno/etc.) runtime installed.
3. The system prompt (`agent_loop.py` SYSTEM_PROMPT) frames `execute_code` as "write complete **Python** code."

What happens with a JS skill: `load_skill` works (files stored in `skill_files` / `skill-files` bucket); the execute_code skill-file injector even **writes the `.js` into `/sandbox/{filename}`** (`tool_dispatcher.py:498-541`, via a base64 Python preamble) — but nothing can run it: no `node` binary, and the session only executes Python. So the file is present and dead.

Why it matters against the project objectives the operator named:
- **Accuracy / error-free / failure-free:** scripts in the skill's real language actually run, instead of silently or confusingly failing partway.
- **Integration / competitive advantage:** the marketplace (and Claude.ai's own skills) include non-Python skills; supporting them is table stakes for "import any skill."
- **Stability:** each runtime stays isolated in the sandbox container (no host exposure).
- **Flexibility:** a skill declares what it needs; the harness provides it.

## When to Surface

**Trigger:** a user imports/runs a non-Python skill (marketplace `.js` etc.), OR a skill manifest declares a non-Python runtime, OR Skill Studio (v3.0) introduces per-skill dependency/runtime declarations.

Present during `/gsd:new-milestone` when the milestone scope matches any of:
- Skill Studio / skill-marketplace work (v3.0 — natural parent; skill manifests are the clean home for a declared runtime)
- Sandbox / code-execution runtime work (pairs with [[SEED-043]])
- Any "import any skill from the marketplace" reliability goal

## Scope Estimate

**Large** — spans sandbox image, session manager, the execute_code dispatch, skill manifests, and the system prompt. Sequence the layers so value lands early and risk stays bounded:

1. **Graceful degradation FIRST (near-term safety net, small):** detect that a skill script / `execute_code` call targets a non-Python runtime that isn't available, and **fail cleanly** with a clear message ("this skill includes a JavaScript step, which the sandbox doesn't run yet") instead of a confusing partial failure. This protects the error-free/failure-free objective immediately, before full support exists. Candidate for a standalone small fix once scoped.
2. **Skill-declared runtime (cleanest):** add a `runtime`/`language` + `dependencies` field to the skill manifest (ties into [[SEED-002]] / v3.0 Skill Studio); the harness reads it and provisions the right interpreter. Marketplace skills carry this metadata.
3. **Multi-runtime image:** add Node.js (and likely a small curated set) to `Dockerfile.sandbox`; route `execute_code` by language. NOTE a low-hanging structural hook already exists — `execute_code` ALREADY accepts a `language` arg (`tool_dispatcher.py:732` records `args.get("language", "python")`) but it is **ignored** for session creation (the session is hardcoded Python). Honoring it is the wiring point.
4. **Per-language sessions:** `llm_sandbox` natively supports `lang="javascript"` (and others) — spin the correct session per script/skill rather than forcing one interpreter. Decide session-per-language vs one polyglot container (Node + Python coexisting) — trade isolation vs warm-up cost.

## Breadcrumbs

- `backend/app/services/sandbox_service.py:41` — `lang: "python"` hardcoded in `session_kwargs` (the single pin point)
- `backend/Dockerfile.sandbox` — `python:3.11-slim` base, no Node/other runtime (pairs with [[SEED-043]] sandbox package/runtime management)
- `backend/app/services/tool_dispatcher.py:498-541` — skill-file injection writes ANY file (incl. `.js`) into `/sandbox/` via a Python base64 preamble; :732 — `language` arg exists in metadata but is ignored for execution
- `backend/app/services/agent_loop.py` SYSTEM_PROMPT — frames `execute_code` as Python only
- `llm_sandbox` library — supports `lang="javascript"` and other runtimes natively (the enabling primitive)
- Related: [[SEED-043]] (managed/extensible sandbox runtimes + package set), [[SEED-002]] (Skill Studio — manifest/deps), [[SEED-005]] (document/skill mgmt). Marketplace-import flow.

## Notes

The fastest risk-reducer is layer 1 (graceful degradation) — it converts a confusing silent/partial failure into a clear, honest message, which directly serves the failure-free objective while the full multi-runtime build is scheduled. The structural hook (the ignored `language` arg) means honoring it + a Node-capable image is a relatively contained first real-support increment; the skill-manifest runtime declaration is the durable, marketplace-correct design and should anchor the v3.0 Skill Studio work. Keep runtimes sandbox-isolated (no host execution) — same security posture as today's Python sandbox.
