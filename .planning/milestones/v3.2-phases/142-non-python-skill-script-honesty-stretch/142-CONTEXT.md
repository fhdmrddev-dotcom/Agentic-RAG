# Phase 142: Non-Python Skill-Script Honesty (STRETCH) - Context

**Gathered:** 2026-07-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the agent **honest** about skill steps its sandbox cannot actually run —
instead of silently running non-Python code as Python, **narrating fake success**,
or burning agent-loop rounds looping on a missing file/binary.

This is an **HONESTY slice, not a capability fix.** 142 detects a "runtime can't
do this" condition and surfaces an honest signal. It does NOT add the capability
(no folder-tree fidelity on import, no un-hardcoding the sandbox language, no new
runtimes/binaries) — those stay DISC-01 / v3.3+ and must sequence after the
Phase 120 COLL-01 sandbox-injection seam. 142 is additive and stays OFF that seam.

**Requirement:** SRH-01 (DISC-01 Layer 1 / SEED-044; broadened by SEED-096).

Covers all three "runtime can't do this" classes (SEED-096 taxonomy):
- **G-A — missing bundled file:** import flattens the skill's folder tree
  (`skills.py:321` `os.path.basename`), so a skill that says
  `python scripts/office/unpack.py` never resolves the file (Anthropic's `docx`
  skill is inert for exactly this reason).
- **G-B — non-Python script:** the sandbox is Python-only 3 layers deep
  (`sandbox_service.py:41` `lang:"python"`, no node binary, everything runs as
  `python -u`). A `.js` either dies on `const`/`=>` or is silently skipped.
- **G-C — missing system binary:** no `soffice`/`pandoc`/`pdftoppm`/`markitdown`
  in the image (`Dockerfile.sandbox` = `python:3.11-slim`, no `apt-get`).

</domain>

<decisions>
## Implementation Decisions

### Coverage breadth
- **D-01:** The honesty gate covers **all three** runtime-gap classes — G-A
  (missing bundled file), G-B (non-Python script), G-C (missing system binary).
  Confirms SEED-096's routed broadening (the original SRH-01/Phase 131 scope was
  G-B only).
- **D-02:** **Honesty-ONLY.** Capability fixes are explicitly OUT of 142 — no
  import tree-fidelity, no un-hardcoding `sandbox_service.py` `lang`, no Node, no
  new system binaries. Those touch the risky COLL-01 injection seam and stay
  DISC-01 / v3.3+ (must sequence after COLL-01). 142 stays additive + off the seam.
- **D-03:** **BUG-260707-02** (the pptx skill → uninstalled `soffice`/`markitdown`
  → 8 wasted `execute_code` retry rounds incl. a full timeout — the G-C worked
  example) **folds into 142** as its durable systemic fix. The existing per-user
  data-fix (rewrote that one skill's instructions to be sandbox-aware) becomes
  belt-and-suspenders. The bug flips to `closed` only once the 142 mechanism is
  verified to stop such a loop generically (across skills / re-imports / users).

### Detection strategy
- **D-04:** **Both** proactive (prevent the dead path) + reactive (backstop that
  catches what slips through). The 8-round loop is what "reactive-missing" looks like.
- **D-05:** Proactive declaration home = the **`execute_code` tool DESCRIPTION**
  (generic sandbox capability facts: Python-only; no node/soffice/pandoc/pdftoppm/
  markitdown) **+ a per-skill flag in the `load_skill` RESULT** (computed from the
  loaded skill's file list — e.g. flag a bundled `.js` or a `scripts/office/*`
  reference). Deliberately **OFF the shared system prompt** — protects the D-14
  "Deep Mode stays byte-identical" red line.
- **D-06:** Reactive backstop = **reshape** the raw sandbox error into an honest,
  specific, **PERMANENT-framed** message (name the exact language/file/binary + the
  in-sandbox alternative + "do not retry") **AND a per-run repeat-guard** that
  short-circuits a repeated identical dead call so even a weak model can't burn
  multiple rounds on the same gap. Kills the 8-round loop by construction.

### Signal surface + audience
- **D-07:** Honesty is primarily **model-facing** — the reshaped tool_result +
  the `load_skill` flag are what the model reads and narrates honestly. This is the
  mechanism that kills fake "it ran" narration (SC#2).
- **D-08:** The one explicitly **user-facing** surface = a **non-blocking import
  note** (SC#1), added as a note/warning field on the existing `import_skill`
  result flow ("this skill includes a step the sandbox can't run yet; its
  instructions still work"). No new bespoke card/panel.
- **D-09:** **No new UI → the G-2 sketch-first gate does NOT fire.**
- **D-10 (derived):** The import note is inherently the **G-B case only** — a static
  ZIP extension scan is the only import-time-knowable signal. G-A and G-C are
  runtime-only conditions and surface via the reactive backstop (D-06).

### read_skill_file (SC#3) + skill hygiene
- **D-11:** **SC#3 is IN scope.** Extend `_decode_skill_file_bytes`'s text-extension
  whitelist (`tool_dispatcher.py:822`) to script types (`.js`/`.ts`/`.sh`/`.rb`/…),
  return the source as **reference TEXT** with a "reference only — not executable in
  this sandbox" caveat, replacing today's misleading "binary — upload a text
  version" else-branch (`:824-829`). Preserve byte-symmetry with the 099
  snapshot-decoder branch (`:838`) that shares this function.
- **D-12:** **Mechanism-only hygiene** — NO per-skill instruction edits and NO
  save/import lint in 142. The generic mechanism (D-05/D-06) makes any
  tool-referencing skill honest without touching skill content. (A missing-tool
  lint at save/import drifts toward STD-01/skill-manifest scope — deferred.)

### Claude's Discretion
- Exact reactive detection signatures (which sandbox stderr patterns map to
  G-A/G-B/G-C — e.g. `FileNotFoundError`/`No such file or directory` for a missing
  binary, `No module named markitdown`, a JS `SyntaxError` on `const`/`=>`, a
  missing injected `scripts/…` path, exit-124 timeout hunting a binary), the
  repeat-guard's "identical dead call" key, and precise message wording — research/
  planning defines these, honoring D-06 (permanent-framing + name-the-gap +
  offer-the-alternative). Pre-flight vs post-hoc detection per class is an
  implementation choice (e.g. the ignored `language` arg at
  `tool_dispatcher.py:1271` is a clean pre-flight hook for a `language != python`
  call).

### Validation notes (for the planner / VALIDATION.md)
- **Cross-provider UAT warranted** — though 142 is not headline-SC#10-flagged, the
  model's honest **narration** in response to the reshaped result is
  provider-behavioral (does each provider stop retrying + tell the user honestly
  instead of fabricating?). The backend repeat-guard is deterministic; the
  narration is not → include cross-provider rows.
- **G-5 does NOT fire** — `tool_dispatcher.py` and `skills.py` are not on the
  hot-file ledger (that ledger is threads.py / agent_loop.py / the frontend chat
  surface). No refactor-first requirement.
- **D-14 red line** — all changes additive; proactive declaration kept off the
  shared system prompt; `sandbox_service.py:41` lang-hardcode + `Dockerfile.sandbox`
  are untouched (honesty-only).
- **Threat-model at plan/secure-phase:** (1) the reactive backstop parses untrusted
  sandbox stderr — it must only ADD honesty, never SUPPRESS a real error class (a
  false-positive reshape could hide a genuine bug). (2) The read_skill_file
  whitelist extension returns more untrusted skill content as text (`.js`/`.sh`) —
  same prompt-injection posture as today's `.md`/`.py` reads (not a new class), but
  name it. (3) Import note reads already-sanitized ZIP entries
  (`_sanitize_zip_name`, `skills.py:269`) — no new path-traversal surface.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope / requirements
- `.planning/ROADMAP.md` §"Phase 142: Non-Python Skill-Script Honesty" — goal, the
  3 success criteria (SC#1 import message / SC#2 clean run-time fail / SC#3 optional
  read-as-text), and the operator scope note broadening to G-A/G-C.
- `.planning/REQUIREMENTS.md` — SRH-01 requirement text.

### The gap taxonomy + worked examples (READ FIRST)
- `.planning/seeds/SEED-096-skill-bundle-tree-fidelity-and-runtime-tooling.md` —
  the four-gap taxonomy (G-A/G-B/G-C + G-D honest-failure), the routed decision to
  broaden the honesty gate to all three, and the file:line evidence for each gap.
  **The governing document for this phase.**
- `.planning/seeds/SEED-044-multi-language-skill-execution.md` — the LANGUAGE slice
  (G-B); the layered plan (Layer 1 = graceful-degradation honesty = this phase;
  Layers 2-4 = DISC-01/STD-01); the three Python pins + breadcrumbs.
- `.planning/reported-bugs/BUG-260707-02-pptx-skill-references-uninstalled-soffice-markitdown-wasted-retry-rounds.md`
  — the G-C worked example (8-round loop, folded into 142 per D-03); evidence trail.
- `.planning/reported-bugs/BUG-260707-02-pptx-skill-instructions-sandbox-aware.md` —
  the applied sandbox-aware instruction copy; a concrete model of how an honest
  "available X / NOT available Y — do not call them" declaration reads (reference
  for the proactive tool-desc / load_skill-flag wording, D-05).

### Substrate / constraints
- `CLAUDE.md` — the sandbox image package set (`Dockerfile.sandbox`, tag `101.1` —
  what IS installed), the D-14 red line, the G-5 hot-file ledger.

</canonical_refs>

<code_context>
## Existing Code Insights

### Integration points (verified 2026-07-08)
- `backend/app/services/tool_dispatcher.py:891` `_handle_execute_code` — the run
  path. Skill-file injection at `:970-1016` writes each file **flat** to
  `/sandbox/{basename}` (`:1009`); execution is `python -u {code_file}` (`:1054`);
  user code is `os.chdir('/sandbox/output')` (`:1016`); an **ignored** `language`
  arg is recorded at `:1271`. The proactive tool-desc note + the reactive backstop
  (D-05/D-06) live in/around this handler.
- `backend/app/services/tool_dispatcher.py:666` `_handle_load_skill` — returns
  `{name, instructions, files}`; the per-skill capability flag (D-05) attaches to
  this result, computed from `file_names` (`:710`).
- `backend/app/services/tool_dispatcher.py:788` `_decode_skill_file_bytes` — the
  text-extension whitelist (`:822`, excludes `.js`/`.sh`) + the misleading
  binary-error else-branch (`:824-829`). SC#3 (D-11) extends the whitelist + adds
  the caveat here. **Shared** with the 099 snapshot-routing read branch (`:838`) —
  keep byte-symmetry (Pitfall 4 / SC#3 red line).
- `backend/app/services/tool_dispatcher.py:832` `_handle_read_skill_file` — live
  read path (`:854+`); tool registry `TOOL_HANDLERS` at `:2780+`.
- `backend/app/api/skills.py:246` `import_skill` — flattens the tree at `:321`
  (`os.path.basename`); `_dedup_flattened_name` (`:329`) is a collision guard only
  (tree-fidelity still explicitly out); stores `application/octet-stream` (`:336`);
  returns `{created, errors}` (`:381`) with a 202 background path (`:372`). The SC#1
  import note (D-08) attaches as a new non-blocking field on this response.

### The Python pins (NOT changed in 142 — honesty-only, D-02)
- `backend/app/services/sandbox_service.py:41` — `{"lang": "python", ...}` hardcode
  (the G-B pin).
- `backend/Dockerfile.sandbox` — `python:3.11-slim`, no node/`apt-get` (the G-B/G-C
  substrate).

### Established patterns to reuse
- **Additive non-blocking note on a tool_result:** `_handle_save_skill`'s
  `lint_warnings` (`tool_dispatcher.py:744-761`) rides along a tool_result and never
  blocks the save — the exact shape for the load_skill flag + import note.
- **Coerce/distrust model- and sandbox-controlled strings:** `_safe_out_filename`
  (`tool_dispatcher.py:1910`, 101-06 CR-01) — precedent for treating the reactive
  backstop's stderr parsing as untrusted input.
- **D-v2.5-01 threadpool** wrapping for blocking container I/O — already pervasive
  in `_handle_execute_code`.

</code_context>

<specifics>
## Specific Ideas

- The reshaped run-time message (D-06) must be **permanent-framed**, not
  transient: name the exact gap, offer the in-sandbox alternative, and say "do not
  retry." Model the wording on the applied sandbox-aware pptx copy
  (`BUG-260707-02-pptx-skill-instructions-sandbox-aware.md`): e.g. *"`soffice`
  (LibreOffice) is not installed in this sandbox and will not become available —
  do NOT retry; QA the presentation in-memory with python-pptx, or tell the user."*
- The generic capability facts to declare (D-05): **available** = Python +
  the image's pip set (matplotlib/numpy/pandas/python-pptx/openpyxl/python-docx/
  pypdf/reportlab/seaborn/scipy/scikit-learn/plotly/docxtpl); **NOT available** =
  node/npm, LibreOffice(`soffice`), pandoc, Poppler(`pdftoppm`), `markitdown`, and
  the `scripts/office/*` helpers.

</specifics>

<deferred>
## Deferred Ideas

- **G-A tree-fidelity fix** (preserve nested import paths + inject the tree under a
  stable skill root + reference it absolutely) → DISC-01 / a dedicated phase, AFTER
  the COLL-01 injection seam. Retires part of `project_skills_mime_known_gap`.
- **G-B/G-C capability** (Node in the image, un-hardcode `sandbox_service.py` lang,
  route `execute_code` by language, add system binaries) → DISC-01 / v3.3+. The
  ignored `language` arg (`tool_dispatcher.py:1271`) is the wiring hook.
- **STD-01 skill-declared runtime / manifest** + a save/import lint that warns when
  instructions reference known-missing tools → its own phase (D-12 keeps it out of 142).

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md` (SPIKE — NL→workflow authoring) — weak keyword
  match (score 0.6: "run/real/2026"); unrelated to skill-script honesty. Not folded.

</deferred>

---

*Phase: 142-non-python-skill-script-honesty-stretch*
*Context gathered: 2026-07-08*
