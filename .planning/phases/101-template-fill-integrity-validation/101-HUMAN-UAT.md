---
status: partial
phase: 101-template-fill-integrity-validation
source: [101-VERIFICATION.md, 101-VALIDATION.md]
started: 2026-06-11
updated: 2026-06-11
---

## Current Test

[live UAT run 2026-06-11 — BLOCKED: no run produced a .docx. See `101-LIVE-UAT-FINDINGS.md` (GAP-A forced-emission, GAP-B library-asset-not-wired, GAP-C run-honesty, GAP-D cross-provider). The 101-06 code fixes are verified working (opus called render_template; resolver executed); the blockers are workflow-wiring + run-honesty above the dispatcher.]

> **Operator prerequisite for ALL rows below:** rebuild + bump the sandbox image so it carries `docxtpl`:
> ```
> docker build -f backend/Dockerfile.sandbox -t agentic-rag-sandbox:101.1 backend/
> ```
> then set `SANDBOX_IMAGE=agentic-rag-sandbox:101.1` in `backend/.env` and use **FRESH chats** (cached sandbox sessions keep the old image for ~30 min). Without this, `render_template` returns the honest `sandbox_image_stale` error. Trusted-path fixture to fill against: published `WorkflowDefinition` `00000000-0000-0000-0000-0000000101a0` (IDs in `backend/tests/fixtures/uat_fixture_ids.json`).

## Tests

### 1. Cross-provider field-map emission — full native roster (TMPL-02, D-14, SC#10)
expected: Run a fill workflow on each of OpenAI / Anthropic / Google / DeepSeek / Moonshot / Z.ai-GLM / MiniMax + OpenRouter. Each produces an openable deliverable AND a cited field-map JSON visible in the run log. Any provider that degrades is documented (Cond 7 "pass OR documented"). The shared fill path must never branch per provider.
result: [pending]

### 2. GLM/MiniMax registry-miss → structured recovery still emits the field-map (TMPL-02)
expected: On GLM and MiniMax (the known native-tool-drop providers), the fill produces an actual FILE (not narrated prose). Cross-check `resolve_calling_mode` selected structured recovery; the field-map still emitted as the tool argument.
result: [pending]

### 3. SC#4 #1 — docx run-split silent miss, live arbitrary-upload path (TMPL-02)
expected: Upload a .docx whose `{{token}}` is fragmented across `<w:r>` runs; fill via the ephemeral (non-Jinja run_replace) path in the sealed sandbox. The fragmented token fills correctly; a residual-tag scan returns `[]` after fill.
result: [pending]

### 4. SC#4 #3 — produced file won't open → honest error + field-map fallback (TMPL-03, D-08)
expected: Force an integrity failure. The run shows a specific error naming the integrity failure; the deliverable is NOT delivered; the extracted cited field-map is preserved as fallback output and is visible to the operator on the run/panel surface.
result: [pending]

### 5. SC#4 #4 — pptx variable-row table limit (TMPL-02)
expected: Fill a pptx carrying a table in the sandbox. Produces an openable file; scalar tokens fill; the verdict carries `documented_limit: "pptx cannot grow tables (python-pptx ≥1.0.0)"` — pass OR documented.
result: [pending]

### 6. SC#4 #5 — xlsx chart strip (TMPL-02)
expected: Fill a chart-bearing xlsx in the sandbox. Scalar cells fill + the verdict carries `documented_limit: "openpyxl drops charts on save"`.
result: [pending]

### 7. SC#4 #6 — xlsx merged-cell mis-write (TMPL-02)
expected: Fill a merged-cell xlsx. The merged-cell anchor fills correctly OR the verdict documents the limit; the integrity re-open passes (openable file).
result: [pending]

### 8. Sandbox isolation proof (TMPL-03)
expected: A NEW chat against the bumped `SANDBOX_IMAGE` produces a file (render works). An OLD cached session (pre-bump) raises `ModuleNotFoundError` for docxtpl — proving the render is sandbox-isolated, network-less, and not running on the host.
result: [pending]

## Summary

total: 8
passed: 0
issues: 4
pending: 1
skipped: 0
blocked: 3

## Gaps

- **GAP-A — fill phase never commits to render_template** (open agent loop, auto tool-choice): models narrate/write Markdown instead of emitting the tool call. DeepSeek narrated JSON; opus (vague) wrote Markdown; opus (directive) said "Let me render…" then stopped. → forced single-emission pattern (spike 097).
- **GAP-B — library template (assets[] AssetRef) not wired**: opus DID call render_template (tight prompt) but the resolver fell to the ephemeral-upload path (no `asset` injected) → "please upload a template." The D-09 trusted docxtpl/library path is unreachable end-to-end.
- **GAP-C — run-honesty**: fill phase shows static "Step 0 · working…" with no live tool cards; internal agent steps invisible (1 phase, N hidden steps).
- **GAP-D — cross-provider**: DeepSeek emits the field-map as narrated text (reasoning-model tool-call trap).

Full detail + fix directions: `101-LIVE-UAT-FINDINGS.md`. VERIFIED working: 101-06 code fixes (schema reaches model, tool callable, resolver executes), retrieval + citations excellent, sandbox image carries docxtpl.
