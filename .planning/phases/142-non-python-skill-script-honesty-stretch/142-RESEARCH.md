# Phase 142: Non-Python Skill-Script Honesty (SRH-01) - Research

**Researched:** 2026-07-08
**Domain:** Agent tool-dispatch honesty — sandbox capability declaration + untrusted-stderr error reshaping + per-run loop suppression (Python-only sandbox, three runtime-gap classes G-A/G-B/G-C)
**Confidence:** HIGH (all integration seams read + verified in-tree; the only MEDIUM band is cross-provider narration behavior, which is inherently behavioral and covered by UAT)

## Summary

Phase 142 is a pure **honesty mechanism** layered onto the existing `execute_code` / `load_skill` / `read_skill_file` / `import_skill` paths. Nothing new runs; the phase makes the agent stop **pretending** a skill step ran when the sandbox physically cannot run it. Three gap classes are in scope (SEED-096 taxonomy): **G-A** a bundled file that the flat-injection loses (`scripts/office/unpack.py` → never resolves), **G-B** a non-Python script (`.js` dies on `const`/`=>` under `python -u`), **G-C** a missing system binary/module (`soffice`/`pandoc`/`pdftoppm`/`markitdown`/`node`). All three are handled honesty-only — no tree-fidelity, no un-hardcoding `sandbox_service.py:41` `lang="python"`, no new binaries (those are DISC-01 / v3.3+, and must sequence after the COLL-01 injection seam). `[VERIFIED: codebase]`

The design is **two-layered and additive**, exactly as CONTEXT locked it. Proactive: (1) extend the `EXECUTE_CODE_TOOL` description with generic capability facts (available pip set vs NOT-available node/soffice/pandoc/pdftoppm/markitdown/`scripts/office/*`), and (2) attach a per-skill "includes a step this sandbox can't run" flag to the `load_skill` result, computed by an extension scan of the loaded file list (reusing the `lint_warnings` ride-along shape). Reactive: (3) reshape the raw sandbox error into a **permanent-framed** honest tool_result (name the exact gap + offer the in-sandbox alternative + "do not retry"), gated by a **tight known-gap-token allowlist** so a genuine error is NEVER suppressed, and (4) a **per-run repeat-guard** that short-circuits a *repeat* of a call referencing a token that already produced a gap error this run — killing the pptx 8-round loop by construction. Plus SC#1: a non-blocking import note (static ZIP extension scan) and SC#3: `read_skill_file` returns `.js`/`.sh`/… as reference text with a "not executable here" caveat. `[VERIFIED: codebase]`

The single most important safety property (threat #1): the reactive backstop parses **untrusted sandbox stderr** and must only ADD honesty, never SUPPRESS a real error class. The research below bounds every reshape to a fixed allowlist of missing-binary/module tokens and the JS-token+SyntaxError combination — first occurrences pass through with the honest note appended (the model still sees the real error); only *repeats of an already-failed token this run* are short-circuited without re-invoking the sandbox.

**Primary recommendation:** Implement four surgical, additive touchpoints — (a) `EXECUTE_CODE_TOOL` description edit in `openai_service.py`; (b) a `_handle_load_skill` result flag + a `_handle_execute_code` post-hoc reshape/pre-flight-repeat-guard, both driven by one shared `_classify_runtime_gap(code, stderr, exit_code)` pure helper keyed off a KNOWN_MISSING allowlist; (c) `_decode_skill_file_bytes` whitelist extension + caveat (byte-symmetric with the 099 snapshot branch); (d) a per-skill import note field on `import_skill`. Store the repeat-guard state as a new by-reference run-scoped `set` field on `ToolContext`, threaded exactly like `previous_files_in_run` — NOT a `setattr` (see Pitfall 1).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (verbatim)

**Coverage breadth**
- **D-01:** The honesty gate covers **all three** runtime-gap classes — G-A (missing bundled file), G-B (non-Python script), G-C (missing system binary). Confirms SEED-096's routed broadening (the original SRH-01/Phase 131 scope was G-B only).
- **D-02:** **Honesty-ONLY.** Capability fixes are explicitly OUT of 142 — no import tree-fidelity, no un-hardcoding `sandbox_service.py` `lang`, no Node, no new system binaries. Those touch the risky COLL-01 injection seam and stay DISC-01 / v3.3+ (must sequence after COLL-01). 142 stays additive + off the seam.
- **D-03:** **BUG-260707-02** (the pptx skill → uninstalled `soffice`/`markitdown` → 8 wasted `execute_code` retry rounds incl. a full timeout — the G-C worked example) **folds into 142** as its durable systemic fix. The existing per-user data-fix becomes belt-and-suspenders. The bug flips to `closed` only once the 142 mechanism is verified to stop such a loop generically (across skills / re-imports / users).

**Detection strategy**
- **D-04:** **Both** proactive (prevent the dead path) + reactive (backstop that catches what slips through). The 8-round loop is what "reactive-missing" looks like.
- **D-05:** Proactive declaration home = the **`execute_code` tool DESCRIPTION** (generic sandbox capability facts: Python-only; no node/soffice/pandoc/pdftoppm/markitdown) **+ a per-skill flag in the `load_skill` RESULT** (computed from the loaded skill's file list). Deliberately **OFF the shared system prompt** — protects the D-14 "Deep Mode stays byte-identical" red line.
- **D-06:** Reactive backstop = **reshape** the raw sandbox error into an honest, specific, **PERMANENT-framed** message (name the exact language/file/binary + the in-sandbox alternative + "do not retry") **AND a per-run repeat-guard** that short-circuits a repeated identical dead call so even a weak model can't burn multiple rounds on the same gap. Kills the 8-round loop by construction.

**Signal surface + audience**
- **D-07:** Honesty is primarily **model-facing** — the reshaped tool_result + the `load_skill` flag are what the model reads and narrates honestly. This is the mechanism that kills fake "it ran" narration (SC#2).
- **D-08:** The one explicitly **user-facing** surface = a **non-blocking import note** (SC#1), added as a note/warning field on the existing `import_skill` result flow. No new bespoke card/panel.
- **D-09:** **No new UI → the G-2 sketch-first gate does NOT fire.**
- **D-10 (derived):** The import note is inherently the **G-B case only** — a static ZIP extension scan is the only import-time-knowable signal. G-A and G-C are runtime-only conditions and surface via the reactive backstop (D-06).

**read_skill_file (SC#3) + skill hygiene**
- **D-11:** **SC#3 is IN scope.** Extend `_decode_skill_file_bytes`'s text-extension whitelist to script types (`.js`/`.ts`/`.sh`/`.rb`/…), return the source as **reference TEXT** with a "reference only — not executable in this sandbox" caveat, replacing today's misleading "binary — upload a text version" else-branch. Preserve byte-symmetry with the 099 snapshot-decoder branch that shares this function.
- **D-12:** **Mechanism-only hygiene** — NO per-skill instruction edits and NO save/import lint in 142. The generic mechanism makes any tool-referencing skill honest without touching skill content. (A missing-tool lint at save/import drifts toward STD-01/skill-manifest scope — deferred.)

### Claude's Discretion (verbatim)
- Exact reactive detection signatures (which sandbox stderr patterns map to G-A/G-B/G-C — e.g. `FileNotFoundError`/`No such file or directory` for a missing binary, `No module named markitdown`, a JS `SyntaxError` on `const`/`=>`, a missing injected `scripts/…` path, exit-124 timeout hunting a binary), the repeat-guard's "identical dead call" key, and precise message wording — research/planning defines these, honoring D-06 (permanent-framing + name-the-gap + offer-the-alternative). Pre-flight vs post-hoc detection per class is an implementation choice (e.g. the ignored `language` arg at `tool_dispatcher.py:1271` is a clean pre-flight hook for a `language != python` call).

### Deferred Ideas (OUT OF SCOPE — verbatim)
- **G-A tree-fidelity fix** (preserve nested import paths + inject the tree under a stable skill root + reference it absolutely) → DISC-01 / a dedicated phase, AFTER the COLL-01 injection seam. Retires part of `project_skills_mime_known_gap`.
- **G-B/G-C capability** (Node in the image, un-hardcode `sandbox_service.py` lang, route `execute_code` by language, add system binaries) → DISC-01 / v3.3+. The ignored `language` arg (`tool_dispatcher.py:1271`) is the wiring hook.
- **STD-01 skill-declared runtime / manifest** + a save/import lint that warns when instructions reference known-missing tools → its own phase (D-12 keeps it out of 142).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SRH-01 | When a skill's script is non-Python (JS, shell, etc.), the agent surfaces an honest "cannot execute this skill type" signal rather than silently failing or narrating the code as if it ran. Broadened by SEED-096 to all three gap classes (G-A/G-B/G-C). Success criteria: SC#1 honest import message (G-B static scan), SC#2 clean run-time fail (reactive reshape + repeat-guard), SC#3 (optional-but-IN) `read_skill_file` returns non-Python as reference text. | Detection Signature Matrix (§Architecture) enables SC#2; the import static-scan design (§Import-Time Static Scan) enables SC#1; the `_decode_skill_file_bytes` whitelist extension (§read_skill_file) enables SC#3. All four touchpoints verified against live code. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Actionable directives that bound this phase's plan:

- **D-14 red line (RED):** Never fork the shared Deep/agent-loop/provider path. Provider differences stay at the gateway/adapter/sanitizer boundary. **Deep Mode stays byte-identical; no new runtime.** `[CITED: CLAUDE.md, REQUIREMENTS.md §Red line]`
  - *Implication verified:* `get_tools()` (`openai_service.py:1018`) is the **single tool-schema source** for all providers — the Anthropic gateway (`provider_gateway/anthropic.py:88`) and Google gateway (`provider_gateway/google.py:71`) both convert the SAME list via `_convert_tools_to_anthropic` / `_convert_tools_to_google`. Editing `EXECUTE_CODE_TOOL`'s description is therefore a **uniform additive change across every provider**, not a fork — D-14-safe. It changes the tool *contract* string (a capability fact), NOT the shared SYSTEM_PROMPT (`agent_loop.py:567`) that the D-14 byte-identical invariant specifically guards. `[VERIFIED: codebase]`
- **Sandbox is Python-only, honesty-only:** `sandbox_service.py:41` `{"lang": "python", ...}` and `Dockerfile.sandbox` (`python:3.11-slim`, no `apt-get`, no node) are **UNTOUCHED** in 142 (D-02). `[VERIFIED: codebase]`
- **Sandbox image package set (tag `101.1`) — what IS installed:** `python-pptx 1.0.2, matplotlib 3.9.2, numpy 2.1.3, pandas 2.2.3, openpyxl 3.1.5, python-docx 1.1.2, pypdf 5.1.0, reportlab 4.2.5, docxtpl 0.20.2, seaborn 0.13.2, scipy 1.14.1, scikit-learn 1.5.2, plotly 5.24.1` + Python 3.11 stdlib. **NOT installed:** node/npm, LibreOffice (`soffice`), pandoc, Poppler (`pdftoppm`), `markitdown`, `extract-text`, and any bundled `scripts/office/*` helpers (lost at flat injection). `[VERIFIED: Dockerfile.sandbox]`
- **No LangChain/LangGraph; raw SDK calls only.** (Irrelevant to this phase's touchpoints but binds any helper code.) `[CITED: CLAUDE.md]`
- **Blocking I/O off async handlers:** wrap container I/O with `run_in_threadpool` (D-v2.5-01). The reshape/repeat-guard runs on already-harvested stderr in-memory (no new container I/O), so no new threadpool wrap is required. `[VERIFIED: codebase]`
- **Reported-bugs cross-check (plan-phase touchpoint):** BUG-260707-02 has `folded_into: 142`. The plan MUST include at least one task whose verification asserts the generic mechanism stops the soffice/markitdown loop; otherwise revert the report's status. `[CITED: CLAUDE.md §Reported bugs]`
- **G-5 does NOT fire:** `tool_dispatcher.py` and `skills.py` are not on the hot-file ledger — no refactor-first requirement. `[CITED: CLAUDE.md hot-file ledger + CONTEXT D-decisions]`
- **UAT scoreboard (SC#10-adjacent):** CONTEXT flags cross-provider UAT as warranted — the reshaped tool_result's *narration* is provider-behavioral even though the backend guard is deterministic. Include cross-provider rows (§Validation Architecture). `[CITED: CLAUDE.md §UAT scoreboard]`

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Proactive capability facts (generic) | API/Backend — tool schema (`openai_service.EXECUTE_CODE_TOOL`) | LLM provider gateways (translate uniformly) | The tool contract is where "what this tool can/can't do" belongs; single source feeds all providers (D-14-safe). |
| Per-skill runtime-gap flag | API/Backend — `_handle_load_skill` result | Model context (model reads + narrates) | Computed from the skill's own file list at load time; rides the tool_result like `lint_warnings`. |
| Reactive error reshape | API/Backend — `_handle_execute_code` result builder | Model context (llm_content) | Operates on already-harvested sandbox stderr; the honest note is appended to the model-facing `llm_content`. |
| Per-run repeat-guard | API/Backend — `ToolContext` run-scoped state (by-reference set) | `_handle_execute_code` pre-flight | Must persist across agent-loop iterations → lives in the run-scoped by-reference container, not per-ctx setattr. |
| Import-time static scan note (SC#1) | API/Backend — `import_skill` response | Frontend — `SkillImportResult` render (`SkillsPage.tsx`) | Only import-time-knowable signal (G-B, static ZIP ext scan); non-blocking field on the existing response contract. |
| `read_skill_file` reference-text decode (SC#3) | API/Backend — `_decode_skill_file_bytes` | 099 snapshot read branch (byte-symmetry) | Shared decoder must decode identically live vs snapshot. |

**Tier-correctness note for the plan-checker:** ALL logic is backend/tool-tier. The ONLY frontend touch is a one-field render addition to the import result (D-08). There is deliberately no browser-tier logic, no new UI component (D-09), and no system-prompt (agent-loop-tier) change (D-05 protects D-14).

## Standard Stack

**No new libraries.** This phase is additive edits to existing modules using the Python 3.11 stdlib already in the backend venv. `[VERIFIED: codebase]`

### Core (existing modules touched)
| Module / Symbol | Location | Role in 142 |
|-----------------|----------|-------------|
| `EXECUTE_CODE_TOOL` | `backend/app/services/openai_service.py:581` | D-05 proactive capability facts appended to `description`. Single source for all providers. |
| `_handle_load_skill` | `backend/app/services/tool_dispatcher.py:666` | D-05 per-skill gap flag on the returned `{name, instructions, files}` JSON. `file_names` at `:710`. |
| `_handle_execute_code` | `backend/app/services/tool_dispatcher.py:891` | D-06 reactive reshape (result builder `:1249-1275`) + pre-flight repeat-guard. |
| `_decode_skill_file_bytes` | `backend/app/services/tool_dispatcher.py:788` | D-11 whitelist extension + caveat (whitelist at `:822`, else-branch `:824-829`). Shared with 099 snapshot branch (`:838`). |
| `_handle_read_skill_file` | `backend/app/services/tool_dispatcher.py:832` | Live read path (`:854+`); unchanged except via the shared decoder. |
| `import_skill` | `backend/app/api/skills.py:245` | D-08 static ZIP extension scan → non-blocking note field. 202 background path `:372`; response `:381`. |
| `ToolContext` | `backend/app/services/tool_dispatcher.py:78` (non-slots `@dataclass`) | New run-scoped by-reference `set` field for the repeat-guard. |
| `SkillImportResult` | `frontend/src/lib/api.ts:4` + `SkillsPage.tsx:63` `handleImport` | D-08 render of the import note. |

### Supporting (patterns to imitate, not import)
| Pattern | Location | When to Use |
|---------|----------|-------------|
| `lint_warnings` ride-along on a tool_result | `tool_dispatcher.py:744-761` (`_handle_save_skill`) | The exact non-blocking-note shape for the `load_skill` gap flag + the import note. |
| `_safe_out_filename` untrusted-string coercion | `tool_dispatcher.py:1909` (101-06 CR-01) | Precedent for treating sandbox stderr as untrusted input in the reshape parser. |
| `previous_files_in_run` / `new_file_hashes_in_run` by-reference run-scoped share | `agent_loop.py:1579/1585` init → both `ToolContext` builds (`:1635`, `:2418`) → `task_service.py:602` fresh for sub-agents | The exact threading pattern for the repeat-guard set. |
| `snapshot_output_baseline` best-effort container-I/O idiom | `sandbox_service.py:364` | Only if any pre-flight probe were needed (it is NOT — see Pitfall 4). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Post-hoc stderr classification | Pre-flight `language` arg (`:1271`) branch for G-B | The `language` param is NOT in the `EXECUTE_CODE_TOOL` schema, so the model never sends it today. Adding it implies multi-language support (out of scope, D-02). Keep as a documented DISC-01 hook only. `[VERIFIED: codebase]` |
| Repeat-guard as a new `ToolContext` field | `setattr(ctx, "_dead_calls", ...)` like `_output_baseline_seeded` | The setattr survives only WITHIN one iteration (a fresh `ToolContext` is built per iteration at `:2405`); the 8-round loop spans iterations → run-lifetime state is required → by-reference field. (Pitfall 1.) `[VERIFIED: codebase]` |
| Known-token allowlist reshape | Broad regex on any `FileNotFoundError`/`SyntaxError` | Broad matching risks suppressing genuine bugs (threat #1). A fixed allowlist bounds false positives to near-zero. |

**Installation:** none. No `pip install`, no `Dockerfile.sandbox` change, no new npm package. `[VERIFIED: codebase]`

## Package Legitimacy Audit

**N/A — this phase installs zero external packages.** All work uses the Python 3.11 standard library (`os.path.splitext`, string operations, `json`) already present in the backend venv, plus TypeScript already in the frontend. No `pip install`, no `npm install`, no `Dockerfile.sandbox` package additions (explicitly forbidden by D-02). The slopcheck / registry-verification gate does not apply. `[VERIFIED: codebase — no dependency manifests are modified by any of the four touchpoints]`

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────────────┐
  SKILL IMPORT (SC#1)    │  import_skill  (skills.py:245)               │
  user uploads ZIP  ────▶│  ├─ _sanitize_zip_name (:269) [already safe] │
                         │  ├─ per-skill: scan file extensions          │
                         │  │    non-Python-script ext present?         │
                         │  │      └─▶ attach non-blocking note ────────┼──▶ {created, errors, notes[]}
                         │  └─ return (200 or 202 background :372)       │        │
                         └─────────────────────────────────────────────┘        ▼
                                                                     SkillsPage.handleImport
                                                                     renders "includes a step
                                                                     the sandbox can't run yet"

  MODEL CONTEXT (proactive, D-05)
  ┌───────────────────────────────┐        ┌──────────────────────────────────────┐
  │ EXECUTE_CODE_TOOL.description  │        │ load_skill result (:720)              │
  │ + "available: <pip set>;       │        │ {name, instructions, files,           │
  │    NOT available: node/soffice/│        │  runtime_note?}  ← ext-scan of files  │
  │    pandoc/pdftoppm/markitdown/ │        │  (rides like lint_warnings :744-761)  │
  │    scripts-office; do not call" │        └──────────────────────────────────────┘
  └───────────────┬───────────────┘                         │
                  │  (single source → all provider gateways) │
                  ▼                                          ▼
          ┌───────────────────────────────────────────────────────────────┐
          │              model plans an execute_code call                  │
          └───────────────────────────────┬───────────────────────────────┘
                                          ▼
  RUN (reactive, D-06)   ┌────────────────────────────────────────────────────────┐
                         │ _handle_execute_code (tool_dispatcher.py:891)           │
                         │                                                          │
   (A) PRE-FLIGHT ──────▶│  repeat-guard: does `code` reference a token already    │
                         │  in ctx.dead_gap_tokens_in_run (this run)?              │
                         │     YES ─▶ SHORT-CIRCUIT: return reshaped honest        │
                         │             tool_result, NEVER invoke sandbox ──────────┼─▶ model
                         │     NO  ─▶ run `python -u {code_file}` (:1054)          │        (stops
                         │                                                          │         looping)
   (B) POST-HOC ────────▶│  classify stderr+stdout+exit_code via                   │
                         │  _classify_runtime_gap()  (KNOWN_MISSING allowlist)      │
                         │     gap found ─▶ append PERMANENT-framed honest note     │
                         │                 to llm_content (:1260) + record token   │
                         │                 in ctx.dead_gap_tokens_in_run           │
                         │     no gap   ─▶ pass raw stdout/stderr UNCHANGED         │
                         └────────────────────────────────────────────────────────┘

  READ (SC#3, D-11)      ┌────────────────────────────────────────────────────────┐
  read_skill_file  ─────▶│ _decode_skill_file_bytes (:788)                         │
                         │  ext in SCRIPT_EXTS (.js/.ts/.sh/.rb/…)?                 │
                         │     YES ─▶ decode utf-8 + prepend "reference only —      │
                         │             not executable in this sandbox" caveat      │
                         │     (byte-symmetric: live path :884 AND 099 snapshot     │
                         │      path :849 both call this same fn)                   │
                         └────────────────────────────────────────────────────────┘
```

### Recommended change surface (files, not new folders)
```
backend/app/services/openai_service.py     # EXECUTE_CODE_TOOL.description (D-05a)
backend/app/services/tool_dispatcher.py    # _classify_runtime_gap() helper (new, pure)
                                           #   + ToolContext new set field
                                           #   + _handle_load_skill flag (D-05b)
                                           #   + _handle_execute_code reshape+guard (D-06)
                                           #   + _decode_skill_file_bytes whitelist (D-11)
backend/app/services/agent_loop.py         # init run-scoped set + thread into 2 ToolContext builds
backend/app/services/task_service.py       # fresh set for sub-agent ctx (Pitfall 7 mirror)
backend/app/api/skills.py                  # import_skill static ext-scan note (D-08)
frontend/src/lib/api.ts                    # SkillImportResult note field type
frontend/src/pages/SkillsPage.tsx          # render the import note in handleImport
```

### Detection Signature Matrix (Open Question 1 — the core research deliverable)

The reactive classifier is one pure function `_classify_runtime_gap(code: str, stdout: str, stderr: str, exit_code: int) -> GapHit | None`. It returns a hit ONLY when a token from a **fixed KNOWN_MISSING allowlist** matches, or the tightly-bounded JS-syntax combination matches. Everything else returns `None` (pass-through — the real error reaches the model unchanged). `[VERIFIED: codebase — stderr/exit surfaced at tool_dispatcher.py:1189-1207, 1256-1266; the exit-124 timeout path at :1121-1131]`

| Gap | Reliable signature(s) | Detection point | Reliability | False-positive bound |
|-----|----------------------|-----------------|-------------|----------------------|
| **G-C missing binary** | stderr/stdout contains `<TOKEN>` where `<TOKEN>` ∈ KNOWN_MISSING **AND** one of: `No such file or directory`, `FileNotFoundError`, `command not found`, `not found`, exit-124 | Post-hoc (result builder) + Pre-flight (repeat-guard on `code`) | **HIGH** | Bounded to the fixed token list (`soffice`, `libreoffice`, `pandoc`, `pdftoppm`, `pdfinfo`, `node`, `npm`, `npx`, `extract-text`). A user file literally named `soffice` is astronomically unlikely; require the co-occurring "not found"-class phrase to further bound. |
| **G-C missing module** | stderr contains `No module named '<MOD>'` (or `ModuleNotFoundError: No module named <MOD>`) where `<MOD>` ∈ KNOWN_MISSING_MODULES (`markitdown`, `docx` [the JS docx-js name, not python-docx], `pptxgenjs` where applicable) | Post-hoc | **HIGH** | `No module named X` is an unambiguous Python signal; bounded to the module allowlist so a genuine `No module named some_pip_pkg` (that the user could `libraries=[...]` install) is NOT reshaped as permanent. |
| **G-B non-Python script** | Python `SyntaxError` **AND** the executed `code` (or an injected script it exec's) contains ≥1 JS-exclusive token: `const `, `let `, `=>`, `require(`, `console.log`, `export default`, `import ... from '...'` (JS module form), `function*` | Post-hoc only | **MEDIUM** | JS tokens co-occurring with a `SyntaxError` is strong, but a Python file with `=>` in a comment could false-positive. Require BOTH a `SyntaxError` in stderr AND a JS token OUTSIDE a Python string/comment context; when uncertain, DO NOT reshape (pass through). Prefer the static import note (SC#1) as the primary G-B surface. |
| **G-A missing bundled file** | stderr contains `No such file or directory` / `FileNotFoundError` naming a path with a `/` segment that looks like a lost tree path (`scripts/`, `office/`, a `.py` referenced by relative subdir) **AND** that basename was NOT among the injected `skill_files` for this call | Post-hoc; **plus a clean pre-flight hook**: skill-file injection failures are currently swallowed at `tool_dispatcher.py:1013` — capture them into a per-call `failed_injections` list to feed the classifier | **MEDIUM** | Only reshape when the missing path is a **relative subdir path** (contains `/` and is not absolute `/sandbox/output/...`) OR corresponds to a known-failed injection. A genuine missing user output file (`/sandbox/output/foo.csv`) must pass through unchanged. |

**KNOWN_MISSING (proposed, planner to lock):**
```python
KNOWN_MISSING_BINARIES = {"soffice", "libreoffice", "pandoc", "pdftoppm",
                          "pdfinfo", "node", "npm", "npx", "extract-text"}
KNOWN_MISSING_MODULES  = {"markitdown"}   # + JS-lib names if the docx-js path is hit
NOT_FOUND_PHRASES = ("no such file or directory", "filenotfounderror",
                     "command not found", "not found")
JS_TOKENS = ("const ", "let ", "=>", "require(", "console.log",
             "export default", "function*")
```

**Design law (threat #1):** `_classify_runtime_gap` returns `None` (pass-through) unless a KNOWN_MISSING token co-occurs with a NOT_FOUND phrase, OR a KNOWN_MISSING_MODULE matches `No module named`, OR a JS token co-occurs with `SyntaxError`. It must NEVER key off `FileNotFoundError` alone, `SyntaxError` alone, or a non-zero exit code alone. This is the single most important correctness property in the phase and MUST have a dedicated negative test (a genuine Python `SyntaxError`, a genuine missing user file, a genuine `ValueError` — all pass through untouched).

### The Per-Run Repeat-Guard (Open Question 2)

**Where state lives:** `ToolContext` is a non-slots `@dataclass` (`tool_dispatcher.py:77-142`), and the codebase ALREADY threads two run-scoped mutable containers by reference — `previous_files_in_run: dict` and `new_file_hashes_in_run: set` — initialized once per run in `agent_loop.py` (`:1579`, `:1585`) and passed to EVERY per-iteration `ToolContext` build (`:1635` resume path, `:2418` main loop) plus a *fresh* copy for sub-agents in `task_service.py` (`:602`, Pitfall 7). `[VERIFIED: codebase]`

**Add one field, threaded identically:**
```python
# tool_dispatcher.py ToolContext
dead_gap_tokens_in_run: set | None = None   # run-scoped repeat-guard; None on
                                            # legacy/duck-typed callers => guard is a no-op
```
- `agent_loop.py`: `_dead_gap_tokens_in_run: set[str] = set()` alongside `_new_file_hashes_in_run` (`:1585`); pass `dead_gap_tokens_in_run=_dead_gap_tokens_in_run` into BOTH `ToolContext(...)` builds.
- `task_service.py`: give the sub-agent ctx a **fresh** `set()` (mirror the `previous_files_in_run={}` Pitfall-7 decision) so a sub-agent's dead calls do not pollute the parent.
- Every OTHER caller (harness `phase_types.py`, eval `eval_runner_service.py`, tests) leaves it `None` → the guard's `if ctx.dead_gap_tokens_in_run is not None` check makes it a **literal no-op** → byte-identical Deep/harness where not wired. (Same additive-default-off discipline as `phase_whitelist` / `skill_snapshot` / `skill_instructions_override`.) `[VERIFIED: codebase — this is the exact pattern used at :92-142]`

**Why NOT `setattr` (`ctx._output_baseline_seeded`-style):** A **new** `ToolContext` is built per agent-loop iteration (`:2405`, inside the iteration loop). A `setattr` on one iteration's ctx does NOT survive to the next iteration. The pptx 8-round loop spans multiple iterations (each dead `execute_code` → model reads result → next iteration retries). Run-lifetime persistence therefore REQUIRES the by-reference container. `_output_baseline_seeded` works only because it guards a within-iteration concern. (This is the single most common way to get the repeat-guard wrong — see Pitfall 1.) `[VERIFIED: codebase — :942-945 vs the per-iteration ctx build at :2405]`

**Keying an "identical dead call":** key on the normalized **gap token**, not the whole code string. `signature = f"{gap_class}:{token}"` (e.g. `"G-C:soffice"`, `"G-C:markitdown"`). Store the raw token(s) that failed.
- **First occurrence:** call runs normally; if `_classify_runtime_gap` returns a hit, append the honest reshaped note to `llm_content` AND `ctx.dead_gap_tokens_in_run.add(token)`.
- **Repeat occurrence (pre-flight, before invoking the sandbox):** if the incoming `code` contains any `token` already in `ctx.dead_gap_tokens_in_run`, short-circuit — return a `ToolResult` carrying the same PERMANENT-framed honest message plus a "you already attempted this in the current run; it will not succeed — stop retrying and use the alternative or tell the user" line, and DO NOT touch the sandbox. This is what structurally kills rounds 9-16 of the loop. `[design; grounded in the BUG-260707-02 evidence trail]`

**Correctness bound:** the pre-flight short-circuit only fires for tokens that ALREADY produced a real gap error THIS run. A novel first attempt is never blocked. This makes the guard safe-by-construction against false positives.

### Proactive Wording + Placement (Open Question 3)

**(a) `EXECUTE_CODE_TOOL.description` (D-05a) — append generic capability facts.** Model the tone on the applied pptx copy (`BUG-260707-02-pptx-skill-instructions-sandbox-aware.md`). Proposed appended sentence(s) (planner to finalize wording):

> "This sandbox runs **Python only**. Pre-installed: python-pptx, matplotlib, numpy, pandas, openpyxl, python-docx, pypdf, reportlab, docxtpl, seaborn, scipy, scikit-learn, plotly (install other PyPI packages via `libraries`). **NOT available and cannot be installed here:** Node/npm/npx, LibreOffice (`soffice`), pandoc, Poppler (`pdftoppm`), `markitdown`, and any bundled `scripts/office/*` helpers. If a skill's instructions tell you to shell out to those, do NOT — they will fail; do the equivalent work in-memory with the Python libraries above, or tell the user it is not available."

Placement: extend the existing `description` string at `openai_service.py:585-596`. This is the SINGLE source consumed by all providers (verified). It is NOT the SYSTEM_PROMPT — D-14-safe. `[VERIFIED: codebase]`

**(b) `load_skill` result flag (D-05b) — computed from the file list.** In `_handle_load_skill`, after `file_names` is built (`:710`), run the same extension scan used for the import note and attach a non-blocking field to the returned JSON (`:720-724`):
```python
runtime_note = _skill_runtime_note(file_names)   # None or a short string
# add to the dict only when present, or always-present-nullable — planner picks
```
Shape it like `lint_warnings` (`:744-761`): additive, never blocks the load, purely advisory for the model. Wording e.g.: `"This skill bundles non-Python script file(s) (script.js, setup.sh) that this Python-only sandbox cannot execute. Their instructions/content may still guide you; do not try to run them as programs."` The flag is computed from the file **extensions** only (a static signal — G-B/G-A hint), which is all `load_skill` knows. `[VERIFIED: codebase — file_names at :710; lint_warnings pattern at :744-761]`

### read_skill_file Extension Set + Snapshot Byte-Symmetry (Open Question 4 / D-11)

`_decode_skill_file_bytes` (`:788`) is called by BOTH the live read path (`:884`) and the 099 snapshot read path (`:849`) — so any change is automatically byte-symmetric as long as it lives inside this one function (the whole point of the 099 extraction). `[VERIFIED: codebase — :832-888 shows both call sites hit the same fn]`

**Change:** add a script-extension branch BEFORE the binary else-branch (`:824-829`):
```python
SCRIPT_EXTS = {"js", "ts", "jsx", "tsx", "mjs", "cjs", "sh", "bash",
               "rb", "go", "rs", "php", "pl", "lua", "ps1", "bat"}
# ...
elif ext in SCRIPT_EXTS:
    src = raw_bytes.decode("utf-8", errors="replace").replace("\x00", "")
    caveat = (f"[reference only — '{filename}' is a {ext} script; this sandbox "
              f"runs Python only and cannot execute it. Read it for reference; "
              f"do not attempt to run it.]\n\n")
    return caveat + src
```
This replaces the misleading "binary — upload a text version" message (`:826-829`) for these types, which is factually wrong (a `.js` is text). Keep the existing else-branch for truly-binary types. The caveat is a **prefix string** (not JSON) so the model reads it as reference text with a warning, matching the existing text-return contract for `.py`/`.md`. `[VERIFIED: codebase]`

**Byte-symmetry test (red line):** a test must assert that for a `.js` payload, the live path and the snapshot path return the identical string (the 099 SC#3 red line). Existing pattern: `test_099_skill_composition.py::test_snapshot_routing` / `test_deep_noop`. `[VERIFIED: codebase]`

### Import-Time Static Scan (Open Question 5 / SC#1, D-08)

`import_skill` (`skills.py:245`) already loops per-skill (`for prefix, fm, instructions in parsed`, `:298`) and per-skill iterates the ZIP entries (`:315`). The scan reuses that same iteration — for each skill, collect the non-`SKILL.md` entry basenames whose extension ∈ `SCRIPT_EXTS`, and if non-empty, attach a per-skill note. `[VERIFIED: codebase]`

**Response contract (must not break existing frontend):** the endpoint returns `{created, errors}` (200) or `{created, errors, message}` (202 background, `:372-380`). Add a NEW optional key `notes: list[{skill, note}]` — additive, so existing consumers ignore it. Both the 200 and 202 paths must include it. `[VERIFIED: codebase — response shapes at :372-381]`

**Frontend (D-08 render):** `SkillImportResult` (`api.ts:4`) gains `notes?: Array<{skill: string; note: string}>`; `SkillsPage.handleImport` (`:63-87`) appends the note text to the existing `importMessage` (a `text-muted-foreground` line, non-error), e.g. `"1 skill imported. Note: 'docx' includes a step the sandbox can't run yet; its instructions still work."` No new component (D-09). `[VERIFIED: frontend api.ts:4, SkillsPage.tsx:63-124]`

**Security (threat #3):** the scan reads entry names AFTER `_sanitize_zip_name` (`:269`) has already validated every entry — no new path-traversal surface; it only inspects `os.path.splitext(basename)`. `[VERIFIED: codebase — sanitize runs at :267-274 before any per-skill work]`

### Cross-Provider Honesty (Open Question 6, provider-docs-first)

The backend guard is deterministic and provider-agnostic (one shared `execute_code` path, one shared tool schema translated by each gateway). What varies is whether each provider's model, on receiving the reshaped PERMANENT-framed tool_result, actually STOPS retrying and narrates honestly vs. fabricates success or retries anyway. `[VERIFIED: codebase — single shared path per D-14]`

Design levers that make permanent-framing reliably stop retries across providers (per provider-docs-first + `feedback_provider_docs_first`):
- **Explicit "do not retry" + "cannot become available" language** in the tool_result — removes the model's implicit "transient error → retry" prior. The applied pptx copy proves the pattern reads clearly.
- **State the alternative in the same message** (in-memory python-pptx / pypdf) — gives the model a forward action instead of a dead end (models retry when they see no path forward).
- **The pre-flight repeat-guard is the backstop that does NOT depend on model behavior** — even a provider that ignores the framing and retries gets a short-circuit on the 2nd+ identical-token call, so the loop cannot exceed one real sandbox invocation per gap token regardless of provider. This is why the deterministic guard (D-06) is the load-bearing SC#2 mechanism and the narration is the "nice-to-have" honesty layer.
- Provider nuance to watch (from MEMORY): Gemini/Google can behave differently on tool-result handling (`reference_gemini_schema_type_array_trap`); OpenRouter is experimental/lower-priority (`feedback_openrouter_is_experimental`). The UAT rows should cover OpenAI, Anthropic, Google natively; OpenRouter is best-effort.

**Assumption to confirm:** that PERMANENT-framing meaningfully reduces retry across all four providers is `[ASSUMED]` (behavioral, model-dependent) — the deterministic repeat-guard is the guarantee; the framing is the enhancement. This is why cross-provider UAT rows exist.

### Anti-Patterns to Avoid
- **Broad stderr matching:** never reshape on bare `FileNotFoundError` / `SyntaxError` / non-zero exit — always require a KNOWN_MISSING token (or JS-token+SyntaxError) co-occurrence. (Threat #1.)
- **Repeat-guard via `setattr` on ctx:** does not survive across iterations (Pitfall 1).
- **Editing the SYSTEM_PROMPT for capability facts:** violates D-05 / risks D-14 byte-identical invariant. Facts go in the tool description + load_skill result only.
- **Touching `sandbox_service.py:41` or `Dockerfile.sandbox`:** that is capability (D-02 OUT).
- **Blocking the import or the load on a note:** notes are advisory (D-08 non-blocking; mirror `lint_warnings`).
- **Reshaping inside the exception handler (`:1277-1281`) as the primary path:** most gaps surface as a *completed* run with non-zero/heuristic exit + stderr (`:1189-1207`), not a Python exception in the handler. Classify on the completed-result branch; the timeout path (`:1121-1131`, exit 124) is a separate G-C hit for a hung binary.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Non-blocking advisory note on a tool_result | A new SSE event / bespoke field shape | The `lint_warnings` ride-along pattern (`tool_dispatcher.py:744-761`) | Proven, additive, model reads it, never blocks. |
| Run-scoped state across iterations | A module-global dict keyed by run_id / a `setattr` | A new by-reference `ToolContext` field threaded like `previous_files_in_run` | Module globals leak across concurrent runs/workers; setattr doesn't survive iterations. |
| Untrusted string coercion | Ad-hoc `.replace()` scrubbing | Follow `_safe_out_filename` (`:1909`) precedent | Established "distrust model/sandbox strings" pattern. |
| ZIP entry safety | New path validation | `_sanitize_zip_name` already runs on every entry before the scan (`:269`) | No new traversal surface (threat #3). |
| Skill-file byte decode | A second decoder for the read path | Extend the shared `_decode_skill_file_bytes` (`:788`) | Guarantees live/snapshot byte-symmetry (099 SC#3). |

**Key insight:** every capability this phase needs already has a blessed in-tree pattern — the work is composing four small additive edits, not inventing mechanisms. The one genuinely new artifact is the pure `_classify_runtime_gap` helper, which is a bounded string-matcher with a fixed allowlist.

## Runtime State Inventory

This is an additive-code phase (not a rename/migration), but the checklist confirms there is **no stored/registered state to migrate**:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None. No DB schema change; no migration. The repeat-guard set is in-memory, run-scoped, never persisted. | None — verified: no `supabase/migrations/*` touched; `ToolContext` field is process-memory only. |
| Live service config | None. No n8n/Datadog/external config. | None. |
| OS-registered state | None. No Task Scheduler / pm2 / systemd. | None. |
| Secrets/env vars | None. `SANDBOX_IMAGE` tag unchanged (`101.1`); no new env var. | None — verified: `Dockerfile.sandbox` untouched (D-02). |
| Build artifacts | None. No sandbox image rebuild (D-02); no new pip/npm package. | None. |

**Nothing found in any category** — verified by: no migration file added, no Dockerfile change, no dependency-manifest change; the only persistent artifact is code.

## Common Pitfalls

### Pitfall 1: Repeat-guard stored where it doesn't survive the loop
**What goes wrong:** the guard is stored via `setattr(ctx, ...)` (copying the `_output_baseline_seeded` pattern) and the 8-round loop is NOT suppressed.
**Why it happens:** a fresh `ToolContext` is built every agent-loop iteration (`agent_loop.py:2405`); the loop spans iterations, so per-ctx state resets each round.
**How to avoid:** store as a by-reference run-scoped `set` field initialized once in `agent_loop.py` and threaded into every `ToolContext` build (mirror `new_file_hashes_in_run`).
**Warning signs:** a repeated-call unit test that mocks two iterations still shows 2 sandbox invocations.

### Pitfall 2: Over-broad reshape suppresses a real bug
**What goes wrong:** the classifier reshapes any `FileNotFoundError`/`SyntaxError`, hiding a genuine user bug behind a false "not available here" message.
**Why it happens:** matching on the error TYPE instead of a specific missing-tool token.
**How to avoid:** require a KNOWN_MISSING token co-occurrence (or JS-token+SyntaxError). Add a dedicated negative test: genuine `ValueError`, genuine missing `/sandbox/output/x.csv`, genuine Python `SyntaxError` all pass through unchanged.
**Warning signs:** the pass-through negative test fails; the model stops seeing real tracebacks.

### Pitfall 3: Breaking the 099 snapshot byte-symmetry
**What goes wrong:** the `.js` caveat is added in `_handle_read_skill_file` (live path) but not in the shared decoder, so the workflow snapshot read diverges from the live read.
**Why it happens:** editing the caller instead of `_decode_skill_file_bytes`.
**How to avoid:** make the change ONLY inside `_decode_skill_file_bytes` (`:788`); both paths call it. Add a live-vs-snapshot equality test.
**Warning signs:** `test_099_skill_composition` snapshot tests diverge.

### Pitfall 4: Trying to pre-detect a gap from code alone (over-engineering)
**What goes wrong:** attempting to scan `code` for `soffice`/`node` on the FIRST call and block it pre-emptively → false positives (the model might reference a token in a comment/string legitimately) and scope creep toward capability-gating.
**Why it happens:** wanting to prevent the first dead call, not just the repeats.
**How to avoid:** first call runs; classify post-hoc; only pre-flight-block a token that ALREADY failed this run. Let the proactive tool-description do the "prevent the first call" job (D-04 split: proactive prevents, reactive backstops).
**Warning signs:** a legit call that merely mentions "soffice" in a string comment gets blocked on its first attempt.

### Pitfall 5: Import note breaks the response contract / 202 path
**What goes wrong:** the note field is added to the 200 path but not the 202 background path (`:372`), or the frontend type isn't updated and TS build fails (Vercel `vite build` skips tsc, but local `tsc` and tests will catch it).
**How to avoid:** add `notes` to BOTH response branches and to `SkillImportResult`. The field is optional so old clients ignore it.
**Warning signs:** `test_skills_import_export.py` assertions on the response dict shape; a background-branch import returns no note.

### Pitfall 6: Sub-agent dead-calls leaking into the parent guard
**What goes wrong:** the sub-agent ctx shares the parent's `dead_gap_tokens_in_run` set (by reference), so a sub-agent's failed soffice call blocks a legitimately-different parent context.
**How to avoid:** give sub-agents a FRESH `set()` in `task_service.py` (mirror the `previous_files_in_run={}` Pitfall-7 decision at `:602`).
**Warning signs:** a parent execute_code is short-circuited after only a sub-agent failed.

## Code Examples

### Existing pattern — non-blocking ride-along note (imitate for load_skill flag + import note)
```python
# tool_dispatcher.py:744-761  (_handle_save_skill)  [VERIFIED: codebase]
lint_warnings: list[dict] = []
try:
    # ... compute siblings ...
    lint_warnings = lint_description(name, description, siblings)
except Exception:
    lint_warnings = []
# ... always proceeds; warnings ride along, never block:
return ToolResult(result=json.dumps(
    {"status": "created", "name": name, "lint_warnings": lint_warnings}
))
```

### Existing pattern — run-scoped by-reference state threaded through ToolContext builds (imitate for the repeat-guard set)
```python
# agent_loop.py:1579-1585  [VERIFIED: codebase]
_previous_files_in_run: dict[str, dict] = {}
_new_file_hashes_in_run: set[str] = set()
# ... passed into BOTH ToolContext(...) builds at :1635 and :2418:
#     previous_files_in_run=_previous_files_in_run,
#     new_file_hashes_in_run=_new_file_hashes_in_run,
# task_service.py:602 gives sub-agents a FRESH {} (Pitfall 7).
```

### Existing pattern — the completed-run result builder where the reshape hooks in
```python
# tool_dispatcher.py:1249-1267  [VERIFIED: codebase]
exec_status = "completed" if actual_exit_code == 0 else "error"
tool_result = json.dumps({... "stdout": ..., "stderr": ...})
# llm_content is what the MODEL sees — append the honest note here on a gap hit:
llm_content = json.dumps({
    "status": exec_status, "exit_code": actual_exit_code,
    "output_files": [...], "stdout": exec_result.stdout or "",
    "stderr": exec_result.stderr or "",
    # 142: + "runtime_gap": {"class": ..., "token": ..., "message": <permanent-framed>}
})
```

### Existing shared decoder to extend (SC#3 byte-symmetry point)
```python
# tool_dispatcher.py:822-829  [VERIFIED: codebase] — insert a SCRIPT_EXTS branch BEFORE the else
elif ext in {"txt","md","py","csv","json","yaml","yml","toml","html","xml","rst","log"}:
    return raw_bytes.decode("utf-8", errors="replace").replace('\x00', '')
else:
    return json.dumps({"error": f"File '{filename}' is a binary file ... Upload a text-based version instead."})
```

## State of the Art

| Old Approach | Current (142) Approach | When Changed | Impact |
|--------------|------------------------|--------------|--------|
| Silent partial failure / fake "it ran" narration on non-Python or missing-binary skill steps | Honest reshaped tool_result + per-run repeat-guard + proactive capability facts | This phase | Kills the BUG-260707-02 8-round loop generically; SC#2. |
| Per-user data-fix (rewrote pptx skill instructions to be sandbox-aware) | Generic mechanism makes ANY tool-referencing skill honest without editing skill content (D-12) | This phase | The data-fix becomes belt-and-suspenders; bug closes when the generic mechanism is verified. |
| `read_skill_file` returns "binary — upload a text version" for `.js`/`.sh` (misleading) | Returns the source as reference text with a "not executable here" caveat (D-11) | This phase | Correct + honest; SC#3. |

**Deprecated/outdated within scope:** the `else` branch of `_decode_skill_file_bytes` claiming `.js`/`.sh` are "binary" — factually wrong; replaced for script types.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PERMANENT-framing meaningfully reduces model retry across all four providers | Cross-Provider Honesty | LOW — the deterministic pre-flight repeat-guard is the actual SC#2 guarantee; framing is an enhancement. Confirm via cross-provider UAT. |
| A2 | The KNOWN_MISSING token list (soffice/libreoffice/pandoc/pdftoppm/pdfinfo/node/npm/npx/extract-text + markitdown) is the complete set of tokens skills reference | Detection Signature Matrix | LOW-MEDIUM — a missed token means a gap passes through as a raw error (still honest, just not reshaped). The list is easily extended; derived from SEED-096 + BUG-260707-02 + Anthropic docx/pptx skill audit. |
| A3 | `markitdown` should be framed as permanently unavailable even though it is pip-installable | Detection / Proactive wording | LOW — D-02 forbids adding it; the honest in-memory alternative (python-pptx/pypdf) is what the applied pptx fix uses. If the operator later wants markitdown, that's a capability decision (DISC-01). |
| A4 | Adding an optional `notes` key to the import response does not break any consumer | Import-Time Static Scan | LOW — verified the only consumer is `importSkillZip`/`handleImport`; additive optional field. |
| A5 | G-B raw-JS-as-`code` is rare in practice (models rarely paste JS into the Python `code` arg); the static import note is the primary G-B surface | Detection Matrix (G-B row) | LOW — if a provider does paste JS, the SyntaxError+JS-token post-hoc branch still catches it; worst case it passes through as a real SyntaxError (still honest). |

**No assumptions touch compliance, retention, security standards, or performance targets.** The one behavioral assumption (A1) is explicitly backstopped by a deterministic mechanism.

## Open Questions (RESOLVED)

1. **Exact reshape wording per gap class (planner/discuss to finalize).** — RESOLVED: authored as the `GAP_MESSAGES` dict verbatim in Plan 142-01 `<authored_content>`.
   - What we know: must be permanent-framed, name the gap, offer the in-sandbox alternative, say "do not retry" (D-06). The applied pptx copy is the tone model.
   - What's unclear: the precise sentence per token (soffice → "QA in-memory with python-pptx"; pandoc/pdftoppm → "no conversion available; work with the source format"; node → "JS cannot run here").
   - Recommendation: the plan defines a small `GAP_MESSAGES: dict[str, str]` keyed by token, each ending with a forward action. Author the strings in the plan, not left to the executor.

2. **Should the `language` param be added to the schema as a clean G-B pre-flight hook?** — RESOLVED: NO — no plan touches it; DISC-01 wiring hook stays documented-only.
   - What we know: `args.get("language","python")` is read at `:1271` (audit only); the param is NOT in the schema, so the model never sends it.
   - What's unclear: adding it gives a zero-false-positive G-B pre-flight but risks implying multi-language support (out of scope, D-02).
   - Recommendation: DO NOT add the param in 142 (keep the DISC-01 wiring hook documented). Rely on post-hoc + the import note for G-B.

3. **Note dedup across re-imports (belt-and-suspenders for D-03).** — RESOLVED: D-03 verification re-imports the STOCK pptx skill (142-VALIDATION.md "D-03 stock-skill proof" manual row) to prove the generic fix.
   - What we know: BUG-260707-02 is per-user data; a re-import of the stock skill reintroduces the tool-referencing instructions.
   - What's unclear: nothing blocking — the generic mechanism handles re-imports by design (the reshape/guard fire regardless of which skill).
   - Recommendation: the D-03 verification should re-import the stock pptx skill and confirm no loop, proving the generic (not per-user) fix.

## Environment Availability

The phase's *domain* is the ABSENCE of tools — those absences are the thing being made honest, not blockers. The only hard dependency for running the mechanism is the existing Docker sandbox, already present. `[VERIFIED: codebase + CLAUDE.md]`

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Docker sandbox (`agentic-rag-sandbox:101.1`) | execute_code path (to observe real gap stderr in UAT) | ✓ (operator-run) | tag `101.1` | Unit tests mock the session; no live sandbox needed for automated tests. |
| `soffice`/`node`/`pandoc`/`pdftoppm`/`markitdown` | (the gaps being detected — intentionally absent) | ✗ | — | N/A — their absence is the tested condition. |
| Python 3.11 backend venv | all edits | ✓ | 3.11 | — |
| Node/npm (frontend build) | SkillImportResult type + render | ✓ | — | — |

**Missing dependencies with no fallback:** none block execution.
**Missing dependencies with fallback:** none needed — the absent binaries are the subject, not a requirement.

## Validation Architecture

> nyquist_validation is enabled (config.json `workflow.nyquist_validation: true`). This section feeds VALIDATION.md.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (`asyncio_mode = auto`) + frontend Vitest | 
| Config file | `backend/pytest.ini` (`testpaths = tests`) |
| Quick run command | `cd backend && venv/Scripts/python -m pytest tests/unit/test_tool_dispatcher.py tests/unit/test_sandbox_tools.py -x -q` |
| Full suite command | `cd backend && venv/Scripts/python -m pytest -q` (+ `cd frontend && npm run test` for the import-render change) |

### Phase Requirements → Test Map
| Req / SC | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|-------------|
| SC#2 / D-06 detection | `_classify_runtime_gap` returns a hit for each of G-A/G-B/G-C from representative stderr | unit | `pytest tests/unit/test_142_runtime_gap.py::test_classify_gc_soffice -x` | ❌ Wave 0 |
| SC#2 / threat #1 | genuine `ValueError` / missing user file / real `SyntaxError` all pass through unchanged (NO reshape) | unit | `pytest tests/unit/test_142_runtime_gap.py::test_non_gap_passthrough -x` | ❌ Wave 0 |
| SC#2 / D-06 repeat-guard | a 2nd execute_code referencing an already-failed token short-circuits WITHOUT invoking the sandbox (assert N sandbox calls → 1) | unit (mock session) | `pytest tests/unit/test_142_repeat_guard.py::test_repeat_short_circuits -x` | ❌ Wave 0 |
| D-06 run-scope | the guard set is shared across per-iteration ToolContext builds and FRESH for sub-agents | unit | `pytest tests/unit/test_142_repeat_guard.py::test_run_scoped_not_setattr -x` | ❌ Wave 0 |
| D-05a proactive | `EXECUTE_CODE_TOOL.description` contains the capability facts (available + NOT-available tokens) | unit | `pytest tests/unit/test_sandbox_tools.py::test_execute_code_capability_facts -x` | ❌ Wave 0 (extend existing file) |
| D-05b load_skill flag | `_handle_load_skill` attaches a runtime note when file list has a `.js`; none when all-Python | unit | `pytest tests/unit/test_142_load_skill_flag.py -x` | ❌ Wave 0 |
| SC#3 / D-11 decode | `.js`/`.sh` return reference text + caveat; live path == snapshot path (byte-symmetry) | unit | `pytest tests/unit/test_142_read_skill_file.py -x` | ❌ Wave 0 |
| SC#1 / D-08 import note | importing a `.js`-bundling ZIP returns a non-blocking note; all-Python ZIP does not; 200 AND 202 paths | integration | `pytest tests/integration/test_skills_import_export.py::TestImportSkill::test_import_note_for_js -x` | ❌ Wave 0 (extend existing file) |
| D-03 (BUG fold) | the generic mechanism stops the soffice/markitdown repeat loop (simulated multi-round) | unit/integration | `pytest tests/unit/test_142_repeat_guard.py::test_pptx_soffice_loop_capped -x` | ❌ Wave 0 |
| SC#1 render | `SkillsPage.handleImport` surfaces the note text | frontend | `cd frontend && npm run test -- SkillsPage` | ❌ Wave 0 (may need a new/extended test) |

### Sampling Rate
- **Per task commit:** the quick run command above (dispatcher + sandbox-tools unit tests) — < 30 s.
- **Per wave merge:** `pytest tests/unit tests/integration -q` (backend) + the frontend import test.
- **Phase gate:** full backend suite green + frontend build/test green before `/gsd:verify-work`.

### Cross-Provider Narration UAT (manual — SC#10-adjacent, per CONTEXT validation notes)
Automated tests prove the deterministic guard; the model's honest *narration* is behavioral → manual UAT rows. Cover the 4-axis bandwidth where relevant:
- **Cross-provider (OpenAI, Anthropic, Google, OpenRouter):** load the stock pptx skill (or a `.js`-bundling skill), prompt a task that drives the skill's soffice/markitdown QA step. Assert per provider: the agent does NOT loop (≤1 real dead sandbox call per token), tells the user honestly it can't run that step, and completes via the in-memory path. OpenRouter is best-effort.
- **Multi-tool:** one row combining `load_skill` + `execute_code` + (the gap) so the load_skill flag AND the reactive reshape are both exercised in one prompt.
- **Long-message / parallel-thread:** low relevance to this phase (no streaming/UI-state change); a single representative row suffices per SC#10 minimum.

### Wave 0 Gaps
- [ ] `tests/unit/test_142_runtime_gap.py` — classifier hits (G-A/G-B/G-C) + pass-through negatives (threat #1). Covers SC#2.
- [ ] `tests/unit/test_142_repeat_guard.py` — repeat short-circuit + run-scope-not-setattr + loop-cap (D-03). Needs a mock sandbox session (see `test_sandbox_tools.py` / `make_tool_context` fixture in `conftest.py`).
- [ ] `tests/unit/test_142_load_skill_flag.py` — D-05b flag present/absent.
- [ ] `tests/unit/test_142_read_skill_file.py` — SC#3 decode + byte-symmetry (mirror `test_099_skill_composition` shape).
- [ ] Extend `tests/unit/test_sandbox_tools.py` — D-05a capability-facts assertion.
- [ ] Extend `tests/integration/test_skills_import_export.py` — SC#1 import note (200 + 202 paths), reuse `_make_zip` helper.
- [ ] Frontend: extend/add a `SkillsPage` test for the note render.
- [ ] Shared fixtures already exist: `make_tool_context` (`conftest.py:621`), `_make_zip`/`_valid_skill_md` (`test_skills_import_export.py:66-78`), `mock_builder`/`_supabase`. No new conftest fixture required.

## Security Domain

> security_enforcement is absent from config.json → enabled. This phase parses untrusted sandbox stderr and returns more skill content as text — both are honesty-additive but must be threat-modeled.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Additive-only, off the COLL-01 seam; D-14 shared-path preserved (single tool schema, no system-prompt fork). |
| V2 Authentication | no | No auth surface touched. |
| V3 Session Management | no | Repeat-guard state is run-scoped in-process memory, not a session token. |
| V4 Access Control | yes | `_handle_load_skill` / `read_skill_file` / `import_skill` already enforce owner+global RLS scoping (`.or_(user_id.eq, is_global.eq.true)`); the new note/flag adds no new data read beyond the already-authorized file list. |
| V5 Input Validation | yes | The classifier treats sandbox stderr as UNTRUSTED (follow `_safe_out_filename` precedent); the import scan reads already-`_sanitize_zip_name`-validated entries. |
| V6 Cryptography | no | None. |
| V12 Files & Resources | yes | ZIP entry names already sanitized before the scan; no new file write; no path constructed from untrusted input. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| **Reshape suppresses a real error** (untrusted stderr parsed → false "not available" hides a genuine bug) | Tampering / Repudiation | Fixed KNOWN_MISSING allowlist + required co-occurring "not found"-class phrase; NEVER reshape on error-type alone; dedicated pass-through negative test (threat #1). |
| **read_skill_file returns more untrusted content as text** (`.js`/`.sh` source → model context) | Information disclosure / Injection (prompt-injection via skill content) | Same posture as today's `.md`/`.py` reads — NOT a new class; the caveat prefix explicitly frames it as reference-only. Owner/global RLS already gates which files are readable (threat #2, named per CONTEXT). |
| **Import note reads ZIP entry names** | Tampering (path traversal) | Entries pass `_sanitize_zip_name` (`skills.py:269`) BEFORE the scan; the scan only inspects `splitext(basename)` — no new traversal surface (threat #3, confirmed). |
| **Repeat-guard token from untrusted `code`/stderr used as a dict/set key** | DoS (unbounded set growth) | Keys are drawn from the FIXED KNOWN_MISSING allolist, not arbitrary strings → the set is bounded by the allowlist size; no attacker-controlled unbounded growth. |
| **Cross-run/sub-agent state bleed** (guard set shared where it shouldn't be) | Tampering (one run blocks another) | Run-scoped by-reference set; FRESH set for sub-agents (Pitfall 6); `None` default = no-op everywhere unwired. |

**Net posture:** every change is additive and honesty-only; the highest-severity concern is threat #1 (suppressing a real error), fully mitigated by the allowlist-bounded classifier + a mandatory pass-through negative test. No new authentication, storage, network, or crypto surface.

## Sources

### Primary (HIGH confidence — read in-tree this session)
- `backend/app/services/tool_dispatcher.py` — `ToolContext` (:78), `_handle_load_skill` (:666), `_handle_save_skill`/`lint_warnings` (:727/:744), `_decode_skill_file_bytes` (:788), `_handle_read_skill_file` (:832), `_handle_execute_code` (:891; skill-file flat inject :970-1016; `python -u` :1054; exit heuristic :1189-1207; result/llm_content :1249-1275; ignored `language` arg :1271; timeout exit-124 :1121-1131).
- `backend/app/services/sandbox_service.py:41` — `lang="python"` pin (untouched); `snapshot_output_baseline` idiom (:364).
- `backend/app/services/openai_service.py` — `EXECUTE_CODE_TOOL` (:581), `LOAD_SKILL_TOOL`/`READ_SKILL_FILE_TOOL` (:430/:472), `get_tools` single source (:1018).
- `backend/app/services/agent_loop.py` — run-scoped state init (:1579/:1585) + both `ToolContext` builds (:1635/:2405); `SYSTEM_PROMPT` (:567).
- `backend/app/services/task_service.py:590-644` — sub-agent ctx (fresh `previous_files_in_run`, Pitfall 7).
- `backend/app/services/provider_gateway/anthropic.py:88`, `google.py:71` — single-schema translation (D-14-safe confirmation).
- `backend/app/api/skills.py` — `import_skill` (:245), `_sanitize_zip_name` (:48/:269), flat basename (:321), 202 path (:372), response (:381), helpers (:56-154).
- `backend/Dockerfile.sandbox` — exact installed package set (tag `101.1`).
- `frontend/src/lib/api.ts:4/:2274` (`SkillImportResult`, `importSkillZip`), `frontend/src/pages/SkillsPage.tsx:63-124` (`handleImport` render).
- `backend/tests/integration/test_skills_import_export.py`, `backend/tests/unit/test_tool_dispatcher.py`, `backend/tests/unit/test_sandbox_tools.py`, `backend/tests/test_099_skill_composition.py`, `backend/tests/conftest.py:621` (`make_tool_context`).
- `.planning/phases/142-.../142-CONTEXT.md`, `.planning/seeds/SEED-096`, `.planning/seeds/SEED-044`, `.planning/reported-bugs/BUG-260707-02*` (both files), `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `CLAUDE.md`, `.planning/config.json`.

### Secondary (MEDIUM — project memory / feedback notes)
- MEMORY: `feedback_provider_docs_first`, `feedback_openrouter_is_experimental`, `reference_gemini_schema_type_array_trap`, `reference_render_template_workflow_only`, `project_skills_mime_known_gap`, `reference_js_skill_import_gap`.

### Tertiary (LOW — none)
- No WebSearch/Context7 needed: the phase is entirely internal-codebase mechanics with no external library surface.

## Metadata

**Confidence breakdown:**
- Standard stack (which modules/lines to touch): HIGH — every seam read and line-verified in-tree this session.
- Architecture (detection matrix, repeat-guard placement, byte-symmetry, import note): HIGH — grounded in verified code + established in-tree patterns (`lint_warnings`, `previous_files_in_run`, shared decoder).
- Cross-provider narration behavior: MEDIUM — inherently behavioral; deterministic guard is the guarantee, framing is the enhancement, covered by UAT.
- Pitfalls: HIGH — each derived from a concrete verified code fact (per-iteration ctx rebuild, shared decoder, 202 path, sub-agent fresh-dict precedent).

**Research date:** 2026-07-08
**Valid until:** ~2026-08-07 for the codebase seams (stable, internal). Re-verify line numbers if `tool_dispatcher.py` / `skills.py` are edited by an intervening phase (neither is on the hot-file ledger, so drift is unlikely).
