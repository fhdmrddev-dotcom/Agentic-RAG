---
phase: 101-template-fill-integrity-validation
type: live-uat-findings
status: open
created: 2026-06-11
driver: Claude (Chrome MCP) + psycopg2 DB cross-checks
provider_tested: deepseek-v4-flash, claude-opus-4-8 (Anthropic native)
fixture: published WorkflowDefinition 00000000-0000-0000-0000-0000000101a0 ("Risk Register Fill (101 UAT)"), unbound, available_tools=[search_documents, render_template]
---

# Phase 101 — Live UAT Findings (template-fill end-to-end)

Live UAT was run AFTER the 101-06 code fixes (WR-01/02, CR-01, WR-03/04) landed and the
operator rebuilt the sandbox image (agentic-rag-sandbox:101.1, docxtpl baked in) and restarted
the backend. Four full workflow runs were driven through the real UI; every run was
cross-checked against the live DB (workflow_runs / runs / messages / workspace_files).

## What is VERIFIED WORKING ✅

- **The 101-06 code fixes are correct.** Across runs the schema-visibility fix held: on the
  tight-directive run, opus **actually called `render_template`** (it relayed the resolver's own
  "must upload a .docx/.pptx/.xlsx" error) — proving the tool schema reaches the model (WR-01),
  the dispatcher routes to `_handle_render_template`, and the resolver executes. Deep stayed
  untouched.
- **Retrieval + citations are excellent.** Opus produced a fully-cited risk register — 6 risks
  (3 strategic + 3 operational), every value traced to a real chunk
  (`Project-Meridian-Charter-Excerpt.docx, Chunk 0` … `Status-Report-Week09.docx, Chunk 4`),
  honestly declined M-04/M-05 where the KB lacked detail, 20–25 sources. The RAG core is strong.
- **Sandbox image** carries docxtpl (operator-built 101.1).

## What BLOCKS end-to-end file production ❌ (NONE are 101-06 code regressions)

### GAP-A — The fill phase never *commits* to the render_template call (open agent loop)
- **Evidence:** Run 1 (DeepSeek) narrated the tool-call JSON as text; Run 2 (opus, vague prompt)
  wrote the register as Markdown; Run 3 (opus, directive prompt) said *"Let me render the
  risk-register template…:"* and STOPPED (572-char msg ending on a colon, run completed, 0 files)
  — i.e. it emitted a text-only turn instead of a `render_template` tool_use, so the agent loop
  ended.
- **Root cause:** the seeded `fill` phase is an `llm_agent` **open loop with auto tool-choice**
  (max_steps≈Explorer 8). Capable models satisfy "fill" by *writing* the answer; they are never
  *forced* to emit the structured `render_template` call, and search iterations can exhaust the
  step budget before any render.
- **Fix direction:** adopt the spike-097 pattern — **forced** single-emission of `render_template`
  (`tool_choice` forced) after bounded retrieval, a directive phase prompt, and adequate step
  budget. (Relates to the STRETCH-108 `phase_type` lock — a dedicated "fill" phase type.)

### GAP-B — The workflow's LIBRARY template (assets[] AssetRef) is never wired to the tool
- **Evidence:** Run 4 (opus, tight prompt) DID call `render_template`, but the resolver fell to
  the **ephemeral-upload** branch (asset_ref=None) and returned "no template uploaded" → opus
  relayed "please upload a .docx…". The published definition's `assets[]` AssetRef (→ the seeded
  `workspace-files` Storage object, the D-09 trusted docxtpl path) was **never surfaced to the
  model nor injected as the tool's `asset` argument**.
- **Root cause:** `_handle_render_template` reads `args.get("asset")`; nothing surfaces the
  definition's `assets[]` to the fill phase, so the model has no AssetRef to pass and defaults to
  the upload path. The trusted library path is unreachable end-to-end.
- **Fix direction:** surface the bound workflow's template AssetRef to the fill phase — either
  inject it into the phase tool-context so the handler auto-uses it when the model omits `asset`,
  or expose it in the phase framing so the model passes it. (Engine note: the library template is
  docxtpl `{%tr%}`-style → MUST route to the trusted docxtpl engine; the ephemeral `run_replace`
  engine cannot grow `{%tr%}` rows and WR-03's residual gate would correctly reject a docxtpl
  template fed through run_replace.)

### GAP-C — Run-honesty: the fill phase is a black box
- **Evidence:** chat sat on a static **"Step 0 · working…"** for the entire run (1–3 min) with no
  incremental tool cards; the workspace panel showed only phase-level status ("fill — running/
  done", "1 agent", "Sub-task"). The workflow has 1 phase, but its internal agent loop
  (search×N → render) is invisible.
- **Fix direction:** stream the fill sub-agent's tool calls as live cards (like Deep mode),
  advance the Step counter, and show a per-phase sub-step list in the panel.

### GAP-D — Cross-provider field-map emission (SC#10 / spike "Condition 7")
- **Evidence:** DeepSeek-v4-flash emitted the `render_template` field-map as **narrated text**
  (reasoning-model tool-call trap) → 0 files, 17.5 KB text dump.
- **Fix direction:** provider-boundary handling for the structured field-map emission across the
  native roster (esp. DeepSeek/Moonshot reasoning models; GLM/MiniMax tool-drop) — the shared
  fill path must not branch per provider.

## Disposition

Phase 101's GOAL ("a workflow fills the template into a real, openable deliverable") is **NOT met
live** — no run produced a `.docx`. The 101-06 code fixes are necessary and verified, but
GAP-A..D are **workflow-wiring + run-honesty** gaps above the dispatcher code. Recommend a
**Phase 101 gap-closure** covering GAP-A (forced emission), GAP-B (library-asset wiring),
GAP-C (fill-phase run honesty), and GAP-D (cross-provider). TMPL-02/TMPL-03 stay OPEN.
