# Phase 101: Template-Fill + Integrity Validation - Context

**Gathered:** 2026-06-10
**Status:** Ready for planning

<domain>
## Phase Boundary

A workflow (or the Deep agent) takes a template — the **Phase-100 ephemeral upload**
*or* a **workflow-owned library asset** — and fills it from **project-KB content** into a
**real, openable deliverable**. Every filled value is **cited**, and a corrupt or
unopenable file can **never** reach the user as "done." Delivers **TMPL-02** (cited
field-map → deterministic render, both fill paths) and **TMPL-03** (integrity re-open +
sandboxed SSTI containment).

**The golden rule (locked by the 097 spike, a PROJECT anchor):** the **LLM produces DATA**
(a typed, cited field-map); **deterministic pinned sandbox code produces the FILE**. The
model never touches OOXML bytes — this is *why* the spike saw zero corruption.

**In scope:**
- A reusable **`render_template` agent tool** (deterministic; runs in the sealed Docker
  sandbox; selects engine by template provenance; deterministic citation + integrity gate;
  returns the produced workspace file + a structured verdict). Callable from both workflow
  phases AND Deep chat.
- **Two fill engines, selected by provenance:** published **library asset** → `docxtpl`/Jinja
  (supports `{%tr %}` variable-row growth); **ephemeral upload** → **non-Jinja run-safe
  `{{token}}` replace** (scalar slots only).
- The **cited Pydantic field-map** ported from the spike (`field_map.py`) into production —
  nullable leaves, `source_chunk_id` provenance, forced tool-use; deterministic
  uncited/over-null reject **before** render.
- **Integrity re-open** with the same library on all three formats; corrupt → never delivered.
- **Asset RESOLUTION** (given an `AssetRef`, fetch template bytes from Storage) + filling both
  sources. The `assets[]` behavior Phase 100/D-13 assigned here.
- **Stack add:** `docxtpl==0.20.2` → `backend/Dockerfile.sandbox` + `SANDBOX_IMAGE` bump
  (`python-docx`/`python-pptx`/`openpyxl` are already in the image).
- **SC#10 full-native-roster** cross-provider validation of the field-map structured output
  (Cond 7) + the SC#4 named-failure-mode UAT rows.

**Out of scope:**
- **Author-facing "attach a template to your workflow" UX** → Phase 103 (authoring). 101's
  trusted-path UAT seeds a library-asset fixture.
- **Semantic fill of *unmarked* free-form docs** (no tokens) → harder problem, deferred SEED.
- **In-file citation embedding** (footnotes / sources appendix / per-cell traceback) →
  STRETCH 106/107.
- **pptx table-row growth + xlsx chart preservation as first-class** → upstream library limits;
  documented, not solved, here.
- **The launch form with file inputs** (`InputFieldSpec.type:"file"`) → Phase 103.
- **Output re-ingestion** (living-document) → SEED-069 / Phase 102.
- **The reusable validator-gate library + output-quality judge** → Phase 102 (101 builds
  `output_file_valid` + `citations_required` *concretely first*).

</domain>

<decisions>
## Implementation Decisions

### Fill architecture (the core)
- **D-01: `render_template` is a reusable agent TOOL** — deterministic, runs in the sealed
  Docker sandbox, selects the engine by template provenance, runs the citation + integrity
  gate, and returns the produced workspace file + a structured verdict. The **LLM produces
  the cited field-map** (the tool's typed argument); **the tool produces the file.** Composes
  `llm_agent` + the tool — **no new `phase_type`** (Plugin Contract `phase_type` lock is
  STRETCH 108). Because it is a tool, **Deep chat can fill templates too** (the "AI colleague"
  core value), not just workflows.
- **D-02: Engine selection by PROVENANCE, not content-sniffing.** Published **library asset**
  (`AssetRef`, authored + versioned + no-TTL) → **`docxtpl`/Jinja** in the sandbox (supports
  `{%tr %}` row growth). **Ephemeral upload** (`kind='template_input'`, untrusted) →
  **non-Jinja run-safe `{{token}}` replace**. Consequence: **an untrusted upload NEVER reaches
  the Jinja engine → SSTI is structurally impossible for the upload path.** `SandboxedEnvironment(autoescape=True)`
  remains defense-in-depth on the trusted path (Cond 1, mandatory regardless).
- **D-03: Field-map = cited Pydantic** (port the spike's `field_map.py`): every leaf nullable,
  `source_chunk_id` provenance, forced tool-use. The tool **deterministically rejects an
  uncited or over-null field-map BEFORE render** (the `citations_required` preview / Pitfall 6).

### Arbitrary-upload (ephemeral) path
- **D-04: Token convention + run-safe replace.** The user types literal `{{tokens}}` into their
  OWN doc; the replace is **run-aware** — it must reassemble Word's split runs (a typed
  `{{project_name}}` gets fragmented across XML runs by spellcheck/formatting — Pitfall 1, the
  load-bearing technical risk of this path). **Scalar slots only** — no table growth on this
  path (variable-length collections are a trusted-path-only capability via `{%tr %}`).
- **D-05: Unmarked free-form docs (no recognizable tokens) are OUT of scope** — a clean,
  relay-able error, NOT a guess. Semantic structure-finding ("the model decides where data
  goes in an arbitrary doc") is the harder, separate problem the spike explicitly deferred →
  captured as a SEED.

### Format coverage
- **D-06: `docx` is first-class** (both engines, fully working). **`pptx`/`xlsx`: scalar fill
  where the library round-trips cleanly + the hard limits exercised AND *documented*** (SC#4:
  "pass OR documented"). Named documented limits: **pptx can't grow tables** (python-pptx #192),
  **xlsx may strip charts** on save (openpyxl), **merged-cell mis-write** (xlsx). **The integrity
  re-open ALWAYS runs on all three formats** — a non-opening file is never delivered, any format.
  The verdict states exactly what filled and what didn't (**no silent caps** — operator rule).
- Stack note: `python-docx`/`python-pptx`/`openpyxl` are **already** in `Dockerfile.sandbox`;
  **only `docxtpl==0.20.2` is net-new** (Cond 2).

### Integrity + failure behavior
- **D-07: Integrity = re-open the produced file with the same library** (TMPL-03), as a **hard
  gate inside the tool**: a file that fails re-open is **never delivered**.
- **D-08: Two failure classes + bounded retry + honest fail with data fallback.**
  (1) **Citation/coverage failure → reject BEFORE render** (deterministic; re-emit field-map).
  (2) **Integrity failure → reject AFTER render.** Both ride the **existing harness gate +
  bounded-retry loop** (re-emit field-map → re-render). On final failure: an **honest run error
  naming the integrity failure** + **preserve the cited field-map as fallback output** so the
  extracted data isn't lost. This IS the concrete `output_file_valid` + `citations_required`
  that **Phase 102 generalizes** into the reusable validator library.

### Library-asset scope
- **D-09: 101 = render engine + asset RESOLUTION + fill both sources; author-attach UX → 103.**
  101 builds `render_template` + **asset resolution** (given an `AssetRef`, fetch template bytes
  from Storage) and fills both sources (ephemeral 100 upload → arbitrary engine; library
  `AssetRef` → trusted `docxtpl` engine). The trusted-path **UAT uses a SEEDED library-asset
  fixture** (a published definition with an `assets[]` entry pointing at a Storage object). The
  rich author-facing "attach a template" UX lands with **Phase 103 authoring**. This implements
  the `assets[]` behavior 100/D-13 assigned here — **update the `harness.py` co-lock comment
  pointer** (`backend/app/models/harness.py:~154`) from "Phase 101" intent to "implemented."

### Citations on the deliverable
- **D-10: Citations live in run OUTPUT only; the delivered file stays clean.** Every value's
  `source_chunk_id` lives in the field-map + the `render_template` verdict (the run output /
  log) — exactly where Phase 102's `citations_required` gate reads it (spike open-Q-ii:
  provenance belongs in run OUTPUT). **In-file citation embedding** (footnotes / "Sources"
  appendix / cell comments) is deferred to **STRETCH 106/107**.

### Computed / derived fields
- **D-11: Cond 3 (worded→numeric, e.g. risk `score = P×I`) is honored via a DETERMINISTIC,
  non-LLM render-time mapping hook** — the LLM never computes derived values (it emits the raw
  cited inputs). The **domain-specific mapping VALUES** (Low=1/Med=2/High=3, `score=P×I`) are
  **Phase 104 content-pack** territory, authored on the generic primitive. 101 keeps the tool
  generic.

### Sandbox / stack / backend optionality
- **D-12: Render runs in the sealed, network-less Docker sandbox** (Cond 1). Add
  `docxtpl==0.20.2` to `backend/Dockerfile.sandbox` + bump `SANDBOX_IMAGE` tag (Cond 2; tag
  bump only affects NEW chats per CLAUDE.md). `SandboxedEnvironment(autoescape=True)` on the
  trusted path.
- **D-13: Keep the render-execution backend a SWAPPABLE seam** (engine optionality — operator
  ethos). Do not hardwire the sandbox backend into the tool; route render execution through the
  existing `sandbox_service` seam so a future **monty-vs-Docker dynamic selector** (SEED-070)
  stays open. Does not change 101's behavior — just don't paint it into a corner.

### Cross-provider (SC#10 for 101)
- **D-14: SC#10 for 101 = the FULL native roster** (OpenAI, Anthropic, Google, DeepSeek,
  Moonshot, GLM, MiniMax) **+ OpenRouter** for the field-map structured output (Cond 7) — **NOT**
  the representative-4. Explicitly cover the two known traps: **GLM/MiniMax silently drop native
  tool-use** (narrate the field-map as TEXT when the model ID misses the case-sensitive
  `MODEL_CAPABILITIES` registry) and **DeepSeek/Moonshot reasoning-model token-budget
  truncation** of the structured emission (the 4096-class the spike already caught on Anthropic).
  **Provider-specific handling stays at the service boundary; the shared fill path never branches.**

### Reported-bug routing (mandatory cross-check)
- **D-15: `BUG-260607-03` (MiniMax-M3 malformed tool-arg JSON → 400) — COVER + DOCUMENT, leave
  open.** 101's cross-provider field-map UAT explicitly includes the MiniMax row; it either
  passes or is documented as a known provider limitation (SC#4 "pass OR documented" + Cond 7's
  service-boundary rule). **101 does NOT own fixing MiniMax's malformed JSON.** The bug's own
  re-open trigger ("cross-provider workflow UAT surfaces it") is satisfied by this phase. The
  five other open `Agentic-RAG` bugs (nav-timer-reset, "phase-0" slug, phantom Sub-task,
  "Setting up agent" banner, silent send-drop) are run-honesty/composer/Deep-UX polish **outside
  the template-fill domain** → not folded; 101 UAT must-not-regress them (SC#10 blast radius).

### Claude's Discretion
- Exact token-marker syntax for the arbitrary path (lean `{{ }}` for familiarity; planner picks)
  + the run-merging algorithm for Pitfall 1.
- `render_template` tool name, exact typed argument schema, and per-phase whitelisting
  (the 099 D-04/D-05 tool-context pattern — `_effective_tools` / `phase_whitelist`).
- Exact sandbox invocation (reuse the `execute_code` substrate vs a sibling render entry); how
  the field-map + template bytes are passed into the sandbox.
- Retry bound count (lean ~2, matching the existing `max_retries` default).
- Whether the worded→ordinal hook is a declarative field on the render config or a small
  mapping passed alongside the field-map.
- Whether the produced file reuses the existing `workspace_file_written` SSE event for panel
  appearance (lean: reuse).

### Folded Todos
*None — `todo.match-phase 101` surfaced no pending todos.*

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner) MUST read these before planning or implementing.**

### Phase requirements & success criteria
- `.planning/ROADMAP.md` → "### Phase 101: Template-Fill + Integrity Validation" — 4 success
  criteria (both fill paths; integrity re-open; SSTI-contained sandbox; 6 named-failure-mode
  UAT rows). UI hint: yes. **SC#10-flagged** (workflow-run-bearing + produces files). **G-6**:
  the SC#4 failure modes ARE the pre-named "How we'd know this failed" UAT rows.
- `.planning/REQUIREMENTS.md` → **TMPL-02** (cited field-map → deterministic render, both
  paths) + **TMPL-03** (integrity re-open + `SandboxedEnvironment` SSTI containment).

### The spike — THE primary research for this phase (read first)
- `scripts/spike-097/CONCLUSION.md` — the operator-confirmed **GO** + **Conditions 1–8**
  (every Condition is a 101 obligation). §1 (4 unknowns), §2 (go/no-go), §3 (the locked
  additive-optional schema shape — `assets`/`InputFieldSpec`/`folder_scope`), §4 (the **6 named
  failure-mode UAT seed** + pptx/xlsx/merged-cell/arbitrary-upload deferrals).
- `scripts/spike-097/derive_fields.py` + `field_map.py` — the **cited Pydantic field-map** +
  bound-scope retrieval + forced-tool emission + deterministic coverage/citation check. **Port
  to production** (mirrors-not-imports the prod service in the spike; production threads it
  through the real gateway).
- `scripts/spike-097/render_docx.py` — the **render body blueprint** for the `render_template`
  tool: `DocxTemplate.render(jinja_env=SandboxedEnvironment(autoescape=True))` + `assert_integrity`
  (python-docx re-open + residual-tag scan) + the deterministic non-LLM `score` compute (D-11).
- `scripts/spike-097/out/` — `field-map.json` (100% citation coverage, 11% decline-rate),
  `risk-register-filled.docx` (+ `-1/-5/-20`), `corruption.log` (Pitfalls 1–7), `unknown-a/b.md`.

### Prior-phase decisions this phase builds on
- `.planning/phases/100-ephemeral-template-upload/100-CONTEXT.md` — D-11 (templates optional
  everywhere), D-13 (`assets`/`AssetRef` behavior deferred HERE), D-14 (runs find templates by
  `kind='template_input'` in-thread, newest wins). The upload, run-pin, and sweep already ship.
- `.planning/phases/099-workflow-skill-composition/099-CONTEXT.md` — D-04/D-05 (per-phase tool
  whitelist via `_effective_tools` + `phase_whitelist` — the `render_template` tool whitelists
  the same way); gated-branch-on-shared-handler pattern (Deep byte-identical red line).
- `.planning/phases/098-project-binding-server-side-kb-scope-governance/098-CONTEXT.md` —
  additive-optional `_StrictBase` co-lock (zero-migration); **bound `folder_scope`** server-side
  resolution (the field-map retrieval runs under the bound scope, not a prompt hint); D-05a
  gated-no-op on shared paths.

### Existing code seams (where the work lands)
- `backend/app/models/harness.py:~157-189` — `InputFieldSpec`, **`AssetRef`** (`asset_id`/
  `filename`/`kind`/`mime`), `assets: list[AssetRef] | None` on `WorkflowDefinition`. The
  co-lock comment (~151-156) assigns "assets behavior" to Phase 101 — **update its pointer**.
- `backend/app/services/harness/phase_types.py` — the 5 executors (`_exec_llm_single`/`_agent`/
  `_batch_agents`/`_human_input`/`_programmatic`); `_build_phase_tool_context`, `_effective_tools`,
  `apply_tool_budget` (per-phase tool whitelist — how `render_template` is exposed to a fill phase).
- `backend/app/services/tool_dispatcher.py` — where the `render_template` tool handler lands +
  the existing `_handle_workspace_read`/`_list`/`_write` (shared with Deep — **gate any change**).
- `backend/app/services/sandbox_service.py` — the `execute_code` Docker substrate; `get_or_create`
  (per-thread cached sessions, idle eviction); `SANDBOX_IMAGE` fallback. **The render-backend seam
  (D-13) routes through here** — keep it swappable for SEED-070.
- `backend/app/services/template_service.py` — Phase 100's template lifecycle (`sweep_expired`,
  `pin_templates_for_run`, `run_cap_seconds`); the `kind='template_input'` resolution the
  arbitrary engine consumes.
- `backend/app/api/workspace.py` — the POST upload endpoint (sets `kind='template_input'` +
  `expires_at`); produced files land back in the workspace via `workspace_service.write_file`.
- `backend/app/services/workspace_service.py` — `write_file()` (hybrid inline/Storage),
  `BUCKET_NAME`, `validate_path`, `guess_mime_type` — the produced deliverable persists here.
- `backend/Dockerfile.sandbox` — add `docxtpl==0.20.2` (the ONLY net-new dep; bump the
  `SANDBOX_IMAGE` tag). `python-docx`/`python-pptx`/`openpyxl`/`reportlab` already present.
- `backend/app/db/workspace.py` — `get_storage_paths_for_file` (version-aware Storage walk).

### Design contracts
- `.claude/skills/sketch-findings-agentic-rag` — **OutputFileCard** (hero/working split,
  per-extension file icons — the delivered-deliverable surface, already designed, sketch 016/095);
  run-honesty error surfaces (the integrity-fail "couldn't produce a valid file, here's the data"
  state — D-08). **G-2 check:** the UI is expected to REUSE these; a new sketch only if the
  integrity-fail-with-data-fallback state proves novel (ui-phase/planner confirms).

### Governing rules
- `CLAUDE.md` — provider-docs-first + cross-provider-from-day-1 (D-14); sandbox setup
  (`Dockerfile.sandbox` + `SANDBOX_IMAGE` bump, D-12); RLS mandate; G-5 hot-file ledger
  (**`threads.py` must not grow** — render is a tool + `workspace.py`/`tool_dispatcher.py`, not
  `threads.py`); G-6 failure-mode UAT rows; UAT scoreboard 4-axis recipe (SC#10); "ingestion is
  manual upload only" is NOT violated (produced files land in the workspace, never the KB).
- `.planning/seeds/SEED-069-living-document-workflow-output-reingestion.md` — output
  re-ingestion (the workflow OUTPUT side); 101 produces the file, re-ingestion wiring is 102.
- `.planning/seeds/SEED-070-monty-dynamic-execute-backend.md` — D-13's forward option.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **The spike IS the blueprint.** `render_docx.py` (render + `assert_integrity`), `field_map.py`
  (cited Pydantic models), `derive_fields.py` (parse-template→bound-retrieve→forced-emit→coverage
  check) are throwaway but mirror the production shape exactly — port them, threading the real
  provider gateway (Deep + workflow share it) and the sandbox.
- **`sandbox_service` already runs library-heavy Python in Docker** — `render_template` reuses
  this substrate; the per-thread cached session + `SANDBOX_IMAGE` are in place.
- **The harness gate + bounded-retry loop already exists** (`ValidatorSpec`, `on_failure`,
  `max_retries`) — D-08's integrity/citation retries ride it; 101 doesn't build a new loop.
- **Per-phase tool whitelist (099 D-04/D-05)** — `_effective_tools` + `phase_whitelist` is exactly
  how `render_template` is admitted to a fill phase without widening Deep.
- **`workspace_service.write_file` + the `workspace_file_written` SSE** — the produced deliverable
  persists + appears in the panel for free (reuse the event).
- **`AssetRef` + `assets[]` already locked** in `harness.py` (098 co-lock) — 101 implements the
  behavior, no schema migration needed for the definition model.

### Established Patterns
- **LLM produces DATA, deterministic code produces FILE** (spike golden rule / PROJECT anchor).
- **Gated no-op on shared paths** (098 D-05a / 099 D-04) — any touch to shared workspace
  tools/handlers gates so Deep + existing workspace behavior stay byte-identical.
- **Provider handling at the service boundary; shared fill path never branches** (Cond 7 / the
  cross-provider red line).
- **Run-honesty error surfaces** — specific, relay-able tool errors (D-08/D-10) over generic 404s.

### Integration Points
- `render_template` tool → `tool_dispatcher.py` (handler) + the registry; whitelisted per fill
  phase via the 099 pattern; the render body runs in `sandbox_service`.
- Field-map emission → an `llm_agent`/`llm_single` phase's forced structured output (the tool's
  typed argument), retrieving under the 098 bound `folder_scope`.
- Asset resolution → fetch `AssetRef` bytes from Storage (`workspace_service`/`db/workspace`
  Storage helpers); ephemeral template via `kind='template_input'` (`template_service`).
- Produced deliverable → `workspace_service.write_file` + `workspace_file_written` SSE → panel.
- Stack → `Dockerfile.sandbox` (`docxtpl`) + `SANDBOX_IMAGE` bump.
- **RED LINE:** Deep-mode chat + all existing workspace/agent behavior stay byte-identical;
  every new path is a literal no-op when no template/fill is involved (the 100 D-11 invariant
  extended to the fill side).

</code_context>

<specifics>
## Specific Ideas

- **Provenance is the security boundary.** Untrusted uploads never reach Jinja → SSTI is
  structurally impossible for them; the sandbox + `SandboxedEnvironment` are defense-in-depth on
  the trusted (authored) path. This is the single most important design property of the phase.
- **The integrity gate is universal and the work is never lost.** A non-opening file in ANY
  format is caught and never delivered; on final failure the cited field-map is surfaced so the
  user still gets the data.
- **No silent caps** (operator rule) — pptx/xlsx limits are *documented in the verdict*, never
  silently filled-wrong.
- **`render_template` as a tool unlocks the "AI colleague"** — Deep chat can fill a template in
  an ordinary conversation, not only inside an authored workflow.
- **Keep the render backend swappable** so the monty-vs-Docker future choice (SEED-070) stays open.

</specifics>

<deferred>
## Deferred Ideas

- **Monty / dynamic execute-backend selector (SEED-070, planted this session).** pydantic/monty
  is an experimental Rust restricted-Python interpreter with **microsecond startup** but **no
  third-party library support** → it **cannot** run the render libs, so it is NOT a Phase-101
  option. Forward value: a *dynamic execute-backend selector* — monty for lightweight, no-dependency
  Python (deterministic computes, simple agent code), Docker for library-heavy render — which could
  relieve the `BUG-260607-02` "Setting up agent…" warm-up latency. D-13 keeps the render-backend
  seam swappable to enable it later. Re-open trigger: a sandbox-warm-up/perf phase, or monty leaving
  experimental.
- **Semantic fill of unmarked free-form docs** (model decides where data goes, no tokens) → the
  harder problem the spike deferred; revisit after the token-convention path proves out.
- **In-file citation embedding** (footnotes / sources appendix / per-cell traceback) → STRETCH
  Phase 106 (citation-traceable grid) / 107 (provenance receipt).
- **pptx table-row growth + xlsx chart preservation as first-class** → upstream library limits
  (python-pptx #192 / openpyxl chart round-trip); documented in 101, solved later if needed.
- **Author-facing "attach a template to your workflow" UX** + no-TTL library-asset upload home →
  Phase 103 authoring.
- **Output re-ingestion (living-document feedback loop)** → SEED-069 / Phase 102 (the OUTPUT side;
  101 only produces the file).
- **Worded→numeric domain mapping VALUES** (risk Low=1/Med=2/High=3, score=P×I) → Phase 104
  content pack, authored on 101's generic deterministic hook.

*No reviewed-but-deferred todos — `todo.match-phase` surfaced none for this phase.*

</deferred>

---

*Phase: 101-template-fill-integrity-validation*
*Context gathered: 2026-06-10*
