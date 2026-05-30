# Phase 088: Cross-Cutting Verification + Accessibility — Research

**Researched:** 2026-05-29
**Domain:** Cross-provider tool-use verification (eval harness MVP) · WCAG 2.1 AA remediation · a11y tooling (vitest-axe + Lighthouse)
**Confidence:** HIGH (all codebase claims read from source at file:line; provider claims cited to official docs; package versions verified against npm registry)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** 4-axis UAT matrix is MANDATORY and locked (CLAUDE.md SC#10): cross-provider (OpenAI, Anthropic, Google, OpenRouter — one representative model each), multi-tool (≥1 row, 2+ tools in one prompt), parallel-thread, long-message (≥50 prior messages OR ≥5 KB prompt). UAT rows authored under **VALIDATION.md, not PLAN tasks**. Long-message stays **manual per provider**; axes 1–3 may be automated.
- **D-02:** Build a small **reusable eval script** as the measurement engine (NOT a one-off scoreboard). Same N canonical prompts run across every provider: factual-doc-search (`search_documents`/`query_tables`), multi-tool (`write_todos` + `workspace_write`), `task` sub-agent, `ask_user`. Each run asserts tool-invocation happened + arg-shape conformance + persistence in the DB. Seeds the v2.8 harness; doubles as a regression gate. Evidence sources: Supabase/DB + uvicorn logs + LangSmith + live Chrome MCP UAT.
- **D-03:** **Google representative = gemini-3.x (3.x+), NOT gemini-2.5.** `gemini-2.5-flash` is known-degraded (narrates a todo list without emitting the tool call). Record gemini-2.5 as a known-degraded data point; do NOT gate phase success on it.
- **D-04:** **CONDITIONAL FOLD.** 088 *measures* per-provider tool-use reliability; folds a tuning slice into 088 **only if the fold-gate (D-05) passes**; otherwise SEED-034 architecture routes to v2.8.
- **D-05 (fold-gate):** Fold only if **ALL** hold: (a) change is **prompt/tool-description TEXT only** (no per-provider branching, no code-path/architecture change); (b) re-running the eval script shows **≥1 previously-failing model now invokes correctly**; (c) **ZERO strong-model regressions**. Any condition fails → do not fold; route to v2.8.
- **D-06:** Fold scope if folded = **UNIVERSAL ONLY** (approach A): explicit universal tool-use directives in the one shared prompt + clarified tool-description text. **No per-provider overlay scaffold in 088.**
- **D-07:** **Provider-docs-first.** Any prompt/tool-description change grounded in the provider's OWN official docs, cross-checked against measured reality. No shared-path change may regress a working provider.
- **D-08 (→ v2.8):** Per-provider prompt overlays keyed off `MODEL_CAPABILITIES`, the productized eval harness, the new-model onboarding checklist. 088's eval script is the seed/MVP.
- **D-09:** Bar = **FIX ALL findings to WCAG 2.1 AA** so A11Y-01/02 genuinely PASS (not audit-and-document). Defer only a finding that requires a component restructure — as a logged SEED with a `re_open_trigger`.
- **D-10:** Scope = all `frontend/src/components/panel/*` + `ui/sheet.tsx` + `layout/ChatLayout.tsx` PLUS the 087 chat-surface seam additions (SeamCard / SeamPointer / PausedRunCue).
- **D-11:** AA criteria: full keyboard nav (Tab/Shift-Tab, Enter/Space, Escape, no mouse-only path); ARIA labels/roles on todo items + checkboxes, file-browser nodes, ask_user choice buttons, diff base/target pills; 4.5:1 contrast on Deep Midnight; visible `:focus-visible` indicators on every interactive element; no color-only conveyance. Known gaps: TodosSection (priority); no global `:focus-visible` ring (add to Aether base styles).
- **D-12:** Screen-reader = **targeted `aria-live` regions** for: diff added/removed line counts, todo status changes, ask_user prompt appearing. Not a blanket sweep.
- **D-13:** **BOTH tools** (complementary): (a) **jest-axe** added to the 087-01 panel suite as a regression gate; (b) **Chrome MCP Lighthouse** a11y audit on the live app. jest-axe is a dev-dependency only (~$0).
- **D-14:** Manual keyboard walk = **Chrome-MCP-driven systematic pass** (Tab/Enter/Space/Escape, screenshot focus states) + an **operator final lived-experience pass** (G-4). Both required before A11Y sign-off.
- **D-15:** Deep **E2E flow on Anthropic + Google**: write file → see in panel → update → view diff → ask_user → respond → resume — all WITHOUT page refresh.
- **D-16:** **FIX BLOCKERS, DEFER POLISH.** Fix only bugs that break a verified v2.7 capability. Log everything else to `.planning/reported-bugs/` with a `re_open_trigger`, roll to v2.8.
- **D-17:** **gemini-3 thought-signature (BUG-260523-02) folded into 088.** 088's Google-axis UAT + the Anthropic+Google E2E re-verify the 075.4/075.5 hotfix live. Reproduces → fix-in-088. Clean → flip report to `closed (verified)`.

### Claude's Discretion

- Exact fold-gate thresholds and the canonical prompt set (N) for the eval script (D-02/D-05).
- jest-axe wiring mechanics (shared axe helper, which test files).
- `aria-live` politeness levels (polite vs assertive) per announcement (D-12).
- Representative model pick per provider for the 4-axis UAT (Google subject to D-03).
- Eval-script location (backend tests vs a standalone `scripts/` util) and whether the deep E2E is authored as a Playwright scenario (reusing the 075.4 substrate) or driven live via Chrome MCP.

### Deferred Ideas (OUT OF SCOPE → v2.8)

- **SEED-034 architecture:** per-provider prompt overlays keyed off `MODEL_CAPABILITIES`, the productized cross-provider eval harness, the new-model onboarding checklist.
- **087 feature deferrals:** SEED-037 (office/PDF in-panel viewing + working download), SEED-038 (generated-files/artifacts unification), SEED-039 (panel reliability/polish — fast-thread-switch stale-id race + minor findings). NOTE: SEED-039's fast-switch race *may be observed* during 088 UAT — if it blocks the E2E flow it gets pulled in under D-16; otherwise stays deferred.
- Open `surface: Agentic-RAG` polish bugs left open at this discuss: `chat-tool-cards-scroll-collapse-duplicate` (→ dedicated v2.8 chat-tool-card phase), `non-anthropic-generic-code-task-descriptions`, `step-count-mismatch-timer-vs-panel`, `timer-disappears-long-runs` (all streaming polish → v2.8). 088 verifies they don't block the workspace E2E flow but does not fix them.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| A11Y-01 | All panel surfaces meet WCAG 2.1 AA — keyboard navigation, ARIA labels, ≥4.5:1 contrast, visible focus indicators | Domain 2 (§8–§12): per-component current state read from source; the panel is already 80% there (roles/roving-tabindex/aria-labels baked in by Phase 087). Net new work = global `:focus-visible` ring + targeted `aria-live` + contrast verification on Deep Midnight. WAI-ARIA APG patterns cited per interaction. |
| A11Y-02 | File browser and todo list fully keyboard-navigable, no mouse-only paths | `FilesSection.tsx` ALREADY has `role=listbox`/`role=option` + roving tabindex + Arrow/Enter/Space (lines 130–206) — VERIFY + axe-gate, no rebuild. `TodosSection.tsx` is a static `<ul>` (no interactive rows — it is display-only; no keyboard path *required* unless rows become actionable). Priority remediation is SR announcement of status changes, not keyboard nav (todos are not actionable). |
</phase_requirements>

## Summary

Phase 088 is the v2.7 close-out gate. It builds **no new product surface** — it proves the v2.7 capabilities work across providers and brings the (already largely a11y-aware) panel to WCAG 2.1 AA. Three workstreams, each grounded below in real source + official provider docs.

**Workstream 1 (cross-provider verification + eval script):** The repo already has every substrate the planner needs. A reusable eval script (D-02) can be modeled almost verbatim on `scripts/observe-run.py` — it already dumps the Redis run-buffer, queries Postgres (`runs`/`messages`), and pulls LangSmith traces via the same `backend/.env` path. The 4-axis UAT row format already exists in `087-VALIDATION.md` (the cross-provider scoreboard at lines 107–114), with representative models already chosen. The 075.4 Playwright E2E substrate (`frontend/tests/e2e/` — 12 scenarios + 3 fixtures + `scripts/restart-backend.{sh,ps1}` + `/health`) is mature; **`scenario-02-gemini-thought-signature.spec.ts` already exists** and re-verifies BUG-260523-02 at the network level — the D-15 deep flow extends that pattern with panel/workspace assertions.

**Workstream 2 (accessibility):** The Phase 087 components are remarkably a11y-mature — `FilesSection` has a full `role=listbox` + roving-tabindex keyboard contract; `PanelSection` is a real `<button aria-expanded aria-controls>` with `role=region` bodies; `WorkspacePanel` is `role=complementary`; `PendingAskCard` has a `radiogroup`, `aria-live`, and a `sr-only` label; `VersionDiff` pills carry `aria-label`+`aria-pressed` (not color-only); `DiffExpandOverlay` reuses the Radix Dialog (focus-trap + Escape for free). The real gaps are narrow and confirmed against source: (1) **NO global `:focus-visible` ring** in `index.css` (verified — zero `:focus-visible` rules exist); (2) **TodosSection has no `aria-live`** for status changes; (3) **DiffLines/VersionDiff have no SR line-count announcement**; (4) contrast must be measured on the live Deep Midnight theme (jsdom cannot).

**Workstream 3 (SEED-034 conditional fold):** The fold target is misdocumented in CONTEXT/SEED-034: `SYSTEM_PROMPT` lives at **`backend/app/api/threads.py:336`**, not `openai_service.py`. `openai_service.py` holds only `EXPLORER_SYSTEM_PROMPT` (line 738) + the tool JSON schemas (`get_tools()` at line 761). The universal-directive injection site is the `active_system_prompt` assembly at `threads.py:1510–1596`. All three providers' official docs converge on the D-06 approach (richer tool descriptions + universal system-prompt nudges) and explicitly warn that *forcing* tool use (`tool_choice: any/tool`) is per-call architecture — out of the universal-only scope.

**Primary recommendation:** Build the eval script as a standalone `scripts/eval_cross_provider.py` modeled on `observe-run.py` (reads `backend/.env`, asserts against `messages.tool_calls` JSONB + `todos`/`workspace_files` tables). Author the 4-axis UAT + the long-message axis + the deep E2E + the SEED-034 fold-gate decision under `088-VALIDATION.md`. Author the deep E2E flow (D-15) as a NEW Playwright scenario (`scenario-13-workspace-deep-flow.spec.ts`) on the existing substrate, NOT a new harness. For a11y: add ONE global `:focus-visible` rule to `index.css`, three targeted `aria-live` regions, wire `vitest-axe` (NOT `jest-axe` — the runner is Vitest) into the 8 existing panel test files, and run a Chrome-MCP Lighthouse + manual keyboard pass.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tool-call emission → shared SSE vocabulary | API/Backend (`threads.py` agent loop + `*_service.py` adapters) | — | "One UX, four adapters" — each provider service translates native tool primitives; the shared path never branches per-provider |
| Tool-invocation durable evidence | Database (`messages.tool_calls` JSONB, `todos`, `workspace_files`) + Observability (LangSmith, uvicorn logs) | — | The eval script asserts against persisted truth, not transient SSE |
| Eval script (measurement engine) | Standalone script (`scripts/`) reading backend env | API/Backend (drives live agent loop via the real `/threads/{id}/messages` route or the service layer) | MVP seed — must NOT be productized; reuse the live agent loop so it measures the REAL path, not a mock |
| 4-axis UAT execution | Operator / Chrome MCP (manual) + Playwright (axes 1–3 automatable) | VALIDATION.md (authoring home) | Long-message + lived-experience are felt, not wire-observable |
| Universal prompt directive (if folded) | API/Backend (`threads.py:336` SYSTEM_PROMPT + `openai_service.get_tools()` descriptions) | — | The one shared prompt sent identically to every provider; injection at `threads.py:1510–1596` |
| Panel a11y (roles/keyboard/focus) | Browser/Client (`frontend/src/components/panel/*`, `index.css`) | — | All remediation is client-side React + CSS; no API/DB change |
| a11y regression gate | Browser/Client test runner (Vitest + vitest-axe, jsdom) | — | Structural a11y (roles/names) — jsdom-observable |
| a11y real-contrast/focus audit | Chrome DevTools MCP (live browser, Lighthouse) | — | Real rendered contrast/focus rings — jsdom CANNOT measure |

## Standard Stack

### Core (already present — no new runtime deps)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | ^4.1.0 | Frontend test runner [VERIFIED: frontend/package.json] | Already the project runner; `npm test` = `vitest run` |
| @testing-library/react | ^16.3.2 | Component render/query in tests [VERIFIED] | Existing panel test pattern |
| @testing-library/jest-dom | ^6.9.1 | DOM matchers; loaded in `setupTests.ts` [VERIFIED] | Already wired |
| jsdom | ^29.0.0 | Test DOM environment [VERIFIED] | vitest.config.ts `environment: "jsdom"` |
| @playwright/test | ^1.60.0 | E2E runner (075.4 substrate) [VERIFIED] | `npm run e2e`; 12 scenarios live |
| Radix Dialog (`@radix-ui/react-dialog`) | ^1.1.15 | Focus-trap + Escape + focus-return for overlays [VERIFIED] | `DiffExpandOverlay` already uses it — no hand-rolled focus traps |

### Supporting (the ONLY acceptable new dependency — dev-only, ~$0)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **vitest-axe** | **0.1.0** | axe-core matcher for Vitest (`toHaveNoViolations`) [VERIFIED: npm registry, published 2025-01-22] | D-13a regression gate. **Use this, NOT jest-axe** — the runner is Vitest. jest-axe (10.0.0) is for Jest only and would require a Jest expect adapter. |
| axe-core | 4.11.4 (transitive via vitest-axe) | The a11y rule engine [VERIFIED: npm registry] | Pulled in by vitest-axe; no separate install needed |

**CRITICAL CORRECTION to D-13:** CONTEXT/D-13 names "**jest-axe**", but the project's test runner is **Vitest 4.1.0** (`frontend/package.json` scripts: `"test": "vitest run"`; `vitest.config.ts` exists; there is NO Jest config). The correct binding is **`vitest-axe`** (it re-exports axe-core's `toHaveNoViolations` shaped for Vitest's `expect`). Using `jest-axe` under Vitest works only if you manually `expect.extend(toHaveNoViolations)` from jest-axe — `vitest-axe` is the purpose-built choice. The planner should treat "jest-axe" in D-13 as "the axe-core matcher for our runner" and install `vitest-axe`.

**Installation:**
```bash
cd frontend && npm install -D vitest-axe
```

**Version verification (run before locking):**
```bash
npm view vitest-axe version      # → 0.1.0 (verified 2026-05-29)
npm view axe-core version        # → 4.11.4 (verified 2026-05-29)
```
*Note: `vitest-axe@0.1.0` is a 0.x package (low version number) but is the standard Vitest binding and pulls a current axe-core 4.x. It is dev-only; if the planner is risk-averse about the 0.x, the equivalent fallback is `import { axe, toHaveNoViolations } from "jest-axe"` + `expect.extend({ toHaveNoViolations })` in `setupTests.ts` — same axe-core engine, works under Vitest's Jest-compatible `expect`.*

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| vitest-axe | jest-axe + manual `expect.extend` | Same engine; jest-axe is more downloaded but not Vitest-native — needs the manual extend line. Either is acceptable; vitest-axe is cleaner. |
| New Playwright scenario for deep E2E | Live Chrome-MCP-driven walk | Chrome MCP is the lived-experience gate (D-14) regardless. A Playwright scenario adds a durable CI regression guard. **Recommend BOTH:** Playwright scenario as the automated backstop + Chrome MCP for the operator lived-experience pass. |
| Standalone eval script | pytest integration test | A `scripts/` util is operator-runnable on demand and matches `observe-run.py`'s shape; a pytest test ties it to CI. **Recommend `scripts/`** (D-02 says "small, NOT productized" + "doubles as a regression gate for new-model onboarding" — operators run it ad hoc per new model). |

## Architecture Patterns

### System Architecture Diagram

```
                        ┌─────────────── EVAL SCRIPT (scripts/eval_cross_provider.py) ───────────────┐
                        │  for provider in [openai, anthropic, google(3.x), openrouter]:            │
                        │    for prompt in N_CANONICAL_PROMPTS:                                      │
                        │      set active_provider/model  ──►  drive live agent loop                 │
                        └───────────────────────────────┬───────────────────────────────────────────┘
                                                         │ (real HTTP, not mock)
   user prompt ──► POST /threads/{id}/messages ──► AGENT LOOP (threads.py)
                                                         │   builds active_system_prompt (threads.py:1510-1596)
                                                         │   ┌── SYSTEM_PROMPT (threads.py:336) ── identical to every provider
                                                         │   └── get_tools() schemas (openai_service.py:761)
                                                         ▼
                              ┌──────────────────────────┴──────────────────────────┐
                              │           PROVIDER ADAPTERS (service boundary)        │
                  openai_service   anthropic_service   google_service (native genai SDK)
                              │           │                    │  attaches thought_signature → Part (D-17)
                              └───────────┴────────────────────┘
                                          │ normalize to shared SSE vocab (kind/tool_calls snapshot)
                                          ▼
                         ┌──────────────── DURABLE EVIDENCE (eval assertion targets) ─────────────┐
                         │  Supabase:  messages.tool_calls JSONB (.kind)   todos    workspace_files │
                         │  Redis:     run:{run_id} stream (SSE event buffer)                       │
                         │  LangSmith: trace tree (provider metadata)        uvicorn: console logs  │
                         └──────────────────────────────┬──────────────────────────────────────────┘
                                                         │ REST reconcile: GET /threads/{id}/todos, /ask_user/pending
                                                         ▼
   FRONTEND (a11y workstream) ── StreamsProvider Zustand store (todosByThread / workspaceFilesByThread / pendingAsksByThread)
                                                         │ reactive hooks: useTodos / useWorkspaceFiles / useAskUserPrompt
                                                         ▼
        WorkspacePanel(role=complementary) ─► PanelSection(button aria-expanded) ─► TodosSection / FilesSection(role=listbox) /
                                                 PendingAskCard(radiogroup) / VersionDiff(pills aria-pressed) / DiffLines
        ChatLayout grid (1fr | clamp(300px,30%,420px)|52px) ◄── ⌘. toggle ◄── seam (SeamPointer/SeamCard/PausedRunCue)
```

A reader can trace the primary flow: eval script → live agent loop → provider adapter normalizes → durable evidence (asserted) → frontend store → panel (a11y target).

### Recommended file touch-map (planner reference)

```
backend/
├── (NO change unless SEED-034 folds) app/api/threads.py:336        # SYSTEM_PROMPT — universal directive insertion (D-06, gated)
├── (NO change unless SEED-034 folds) app/services/openai_service.py # get_tools() tool descriptions (D-06, gated)
scripts/
└── eval_cross_provider.py            # NEW — D-02 eval script, modeled on observe-run.py
frontend/
├── package.json                      # + vitest-axe devDependency (D-13a)
├── src/setupTests.ts                 # + expect.extend(toHaveNoViolations) (D-13a)
├── src/index.css                     # + ONE global :focus-visible rule (D-11)
├── src/components/panel/TodosSection.tsx       # + aria-live status announce (D-12)
├── src/components/panel/DiffLines.tsx          # + SR line-count announce (D-12) — or in VersionDiff
├── src/components/panel/VersionDiff.tsx        # + aria-live +N/−M announce (D-12)
├── src/components/panel/__tests__/*.test.tsx   # + axe assertion per file (8 files, D-13a)
└── tests/e2e/scenario-13-workspace-deep-flow.spec.ts  # NEW — D-15 deep flow on Anthropic+Google
.planning/phases/088-.../088-VALIDATION.md      # 4-axis UAT rows + long-message + fold-gate decision + a11y manual pass
```

### Pattern 1: Eval script modeled on `observe-run.py` (D-02)

**What:** A standalone Python util that, per (provider × canonical-prompt), drives the live agent loop and asserts tool-invocation + arg-shape + DB persistence.
**When to use:** The D-02 measurement engine + the SEED-034 fold-gate evidence (D-05) + the new-model regression gate (D-08 seed).
**Why model on observe-run.py:** It already solves env loading, Redis dump, Postgres query, and LangSmith pull — the exact evidence sources D-02 names.

```python
# Source: scripts/observe-run.py (lines 36-48, 137-198) — the proven patterns to reuse
# Env loading (observe-run.py:36-48):
from dotenv import load_dotenv
env_path = Path(__file__).resolve().parent.parent / "backend" / ".env"
load_dotenv(env_path)   # gives SUPABASE_URL / DATABASE_URL / LANGSMITH_API_KEY / REDIS_URL

# Postgres assertion (observe-run.py:151-194 pattern) — assert write_todos persisted:
import psycopg2
from psycopg2.extras import RealDictCursor
db_url = os.getenv("DATABASE_URL") or "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
conn = psycopg2.connect(db_url)
with conn.cursor(cursor_factory=RealDictCursor) as cur:
    # (a) tool-invocation + arg-shape — read messages.tool_calls JSONB for this thread:
    cur.execute(
        "SELECT tool_calls FROM messages WHERE thread_id = %s AND role='assistant' "
        "AND tool_calls IS NOT NULL ORDER BY created_at DESC LIMIT 5", (thread_id,))
    # each tool_calls element: {tool_call_id, name, args, result, status, kind?, ...}
    # assert any(tc["name"] == "write_todos" for tc in calls)  ← invocation happened
    # assert isinstance(tc["args"]["todos"], list)             ← arg-shape conformance (NOT a JSON string — BUG-260529-01)

    # (b) DB persistence — assert write_todos actually wrote rows (todos table, migration 055):
    cur.execute("SELECT count(*) AS n FROM todos WHERE thread_id = %s", (thread_id,))
    # assert n > 0   ← "write_todos persisted N todos for this thread"

    # (c) workspace_write persistence (workspace_files, migration 054):
    cur.execute("SELECT count(*) AS n FROM workspace_files WHERE thread_id = %s", (thread_id,))
    # assert n > 0   ← "workspace_write created a file"
```

**How to drive live LLM calls across ALL providers (D-02):** Two options, recommend the FIRST:
1. **Drive the real HTTP route** — `POST /threads/{id}/messages` after switching `user_settings.active_provider`/`llm_model` (the same path the app + the Playwright `scenario-02` use). This measures the REAL agent loop (the whole point — SEED-034 is about the real shared path). Capture `run_id` from the response, then run the assertions above + (optionally) the `observe-run.py` Redis/LangSmith dumps. **Provider/model is set in `user_settings`** (per-user effective settings resolved in `openai_service.get_llm_client`, line 785) — the script flips it per provider before each prompt.
2. Call the service layer directly (`create_streaming_chat`) — lighter but bypasses `threads.py` history/system-prompt assembly, so it would NOT measure the real `active_system_prompt`. **Avoid** for the fold-gate (D-05 condition-a is about the shared prompt — must measure it).

### Pattern 2: 4-axis UAT row format (D-01) — copy from 087-VALIDATION.md

**What:** The cross-provider scoreboard table. It ALREADY exists at `087-VALIDATION.md:107-114` with the exact shape and representative models.
**The established row format (087-VALIDATION.md:107-114) — reuse verbatim:**

```markdown
| Provider (representative)     | Multi-tool          | Parallel-thread | Long-message    | Panel/seam parity | Status   |
|-------------------------------|---------------------|-----------------|-----------------|-------------------|----------|
| OpenAI (gpt-5.4-mini)         | ✅ todos+file+ask   | ✅ (A while B)   | ➖ (see Anthropic)| ✅                | ✅ PASS  |
| Anthropic (claude-haiku-4-5)  | ✅ todos+file       | ➖              | ✅ 5604-byte     | ✅                | ✅ PASS  |
| Google (gemini-3.5-flash)     | ✅ todos+file       | ➖              | ➖              | ✅                | ✅ PASS  |
| OpenRouter (z-ai/glm-5.1)     | ✅ todos+file       | ✅ (reconciled) | ➖              | ✅                | ✅ PASS  |
```

**Recommended representative models (D-01, Google per D-03)** — already validated in 087-08:
- OpenAI: `gpt-5.4-mini` · Anthropic: `claude-haiku-4-5` (or `claude-opus-4-x`) · **Google: `gemini-3.5-flash` (3.x+ per D-03)** · OpenRouter: `z-ai/glm-5.1` (or another capable model — free llama-3.3-70b is the known arg-shape-variance case, useful as a separate data point but NOT the representative).

**LOCKED rules (confirmed against CLAUDE.md "UAT scoreboard recipe (MANDATORY)" + 087-VALIDATION.md):**
- UAT rows live in **VALIDATION.md, NOT plan tasks** [VERIFIED: 087-VALIDATION.md authored them there; CLAUDE.md states it verbatim].
- Axes 1–3 may be combined into fewer live runs ("the bandwidth, not the cell count, is the bar" — 087-VALIDATION.md:116) and axes 1–3 are automatable via Playwright.
- **Long-message stays manual per provider** (≥50 prior messages OR ≥5 KB prompt) [VERIFIED: CLAUDE.md + 087-VALIDATION.md:87].

### Pattern 3: SSE event types that must appear in the matrix (D-01)

The shared SSE vocabulary does NOT use discrete `todos_updated`/`workspace_written` event types. Confirmed against `StreamsProvider.tsx`: panel state flows via a **`tool_calls` snapshot carrying a `kind` field** + dedicated REST reconcile endpoints. The "new v2.7 SSE event types" the matrix must exercise map to the panel-owned tools and their durable `kind` markers:

| v2.7 capability | How it surfaces (wire) | Durable evidence (matrix assertion) |
|-----------------|------------------------|--------------------------------------|
| `write_todos` | `tool_calls` snapshot (status preparing→running→done) → `useTodos` store update; `SeamPointer kind="write_todos"` live | `todos` table rows (migration 055); `messages.tool_calls[].name=="write_todos"` |
| `workspace_write` | `tool_calls` snapshot → `useWorkspaceFiles`; `SeamPointer kind="workspace_write"` live | `workspace_files` rows + versions (migration 054); `messages.tool_calls[].name=="workspace_write"` |
| `ask_user` (pause/resume) | `tool_calls` snapshot + paused run-card (PausedRunCue); `useAskUserPrompt` → PendingAskCard | `messages.tool_calls @> '[{"kind":"ask_user_prompt"}]'` (panel.py:128); resume → `ask_user_response` kind |
| `task` (sub-agent) | `tool_calls` snapshot with `sub_agent` record (threads.py:2725) | `messages.tool_calls[].sub_agent` present; `useTasks` store |
| `tool_args_progress` / `tool_preparing` / `tool_start` | live streaming events (openai_service / threads.py) | Redis `run:{run_id}` stream event counts (observe-run.py:112-123) |

### Pattern 4: Deep E2E flow (D-15) as a Playwright scenario on the 075.4 substrate

**What:** `scenario-13-workspace-deep-flow.spec.ts` — write file → see in panel → update → view diff → ask_user → respond → resume, no refresh, on Anthropic + Google.
**Why this substrate works (all VERIFIED):**
- Auth: `fixtures/auth.fixture.ts` (env-driven, local default `fhdmrd@gmail.com`/`123456`; asserts the "Ask anything…" composer post-login).
- DB cleanup: `fixtures/db-teardown.fixture.ts` — `teardownTestUserData` + `assertNoOrphanedStreamingRuns`, **hard-gated to localhost** (refuses non-local `SUPABASE_URL`).
- Trace assert: `fixtures/langsmith.fixture.ts` — `assertLangSmithTraceExists(runId, "google")`.
- Provider switch + multi-tool prompt + "no 400 INVALID_ARGUMENT" assertion: **`scenario-02-gemini-thought-signature.spec.ts` is the template** — it already sets google + gemini-3, sends a 2-tool prompt, asserts no 400, waits for run completion, checks the LangSmith provider. The deep flow EXTENDS it with panel-surface assertions (file row appears, diff renders, PendingAskCard renders, answer → resume).
- Config: `playwright.config.ts` — `testMatch: /scenario-\d+-.+\.spec\.ts$/`, `workers: 1` (DB-teardown shared state), `baseURL` http://localhost:5173.
- Backend restart (orphan-worker aware): `scripts/restart-backend.{sh,ps1}`.

**Recommendation:** Author the Playwright scenario as the **automated CI backstop** for axes 1–3 + the deep flow on Anthropic+Google, AND drive the SAME flow live via Chrome MCP for the operator lived-experience pass (D-14/G-4). The two are complementary, not redundant: Playwright catches wire-level regressions in CI; Chrome MCP catches felt-experience defects (the documented [[feedback_uat_lived_experience_gap]]).

**Panel selectors the scenario will need** (from source): file row = `[role="option"]` inside `[role="listbox"][aria-label="Workspace files"]` (FilesSection:170); diff region = `[role="region"][aria-label^="Diff v"]` (VersionDiff:207); ask_user card = `[role="group"]` with the `Needs you` text + the free-text `textarea#ask-{id}-free` + `Send Answer` button (PendingAskCard:163-244); paused cue = PausedRunCue `[role="status"]` "ask_user · awaiting your answer".

### Pattern 5: WCAG 2.1 AA — per-interaction ARIA pattern (D-11, WAI-ARIA APG)

| Interaction | Current state (source) | APG pattern + required contract | Action |
|-------------|------------------------|----------------------------------|--------|
| Todo list rows | `<ul>/<li>`, status as icon+text (TodosSection:60-79). NOT interactive. | [APG List](https://www.w3.org/WAI/ARIA/apg/patterns/) — a static list needs no roles beyond implicit `list`/`listitem`. **No keyboard path required** (rows aren't actionable). | Add `aria-live` status announce only (D-12). Confirm `<ul>` implicit `list` role survives (it does). |
| File browser | `role=listbox`+`role=option`, roving tabindex, Arrow/Enter/Space, focus restore (FilesSection:130-206) | [APG Listbox](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/) — single-select listbox. ✅ already conformant. **Note:** `aria-selected={false}` is hardcoded on every option (FilesSection:182) — should reflect the active row OR be omitted; an always-false `aria-selected` is an axe finding. | Fix `aria-selected` to track `isActive` (or drop it — drill-in replaces the list, so "selection" is transient). |
| ask_user choices | `role=radiogroup` + `role=radio` + `aria-checked` (PendingAskCard:184-208) | [APG Radio Group](https://www.w3.org/WAI/ARIA/apg/patterns/radio/) — ✅ correct choice (radiogroup, not buttons). **Gap:** radios are not arrow-key navigable (each is a separate `<button role=radio>` with default tab stops). APG radiogroup expects Arrow keys move selection + single tab stop. | Add roving tabindex + Arrow-key handler to the radio group, OR accept Tab-between-radios (axe passes either way; APG prefers roving). Low-priority — Tab works. |
| Diff base/target pills | `<button>` + `aria-label` ("base version 1"/"target version 3") + `aria-pressed` (VersionDiff:166-184); visible `v{n}` is `aria-hidden` | [APG Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/) toggle — ✅ text+aria, NOT color-only. Conformant. | Verify only. |
| File preview / diff overlay close | FilePreview: `window` keydown Escape + focus-to-back-button on mount (FilePreview:121-135). DiffExpandOverlay: Radix Dialog (focus-trap+Escape+return free). | [APG Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) for the overlay (✅ Radix). FilePreview is a full-replace (not a modal) — its `window` Escape + focus management is reasonable. | Verify FilePreview Escape doesn't conflict with the overlay's Escape (FilePreview uses `e.stopPropagation()` — could swallow). Test both open. |
| Section accordion | `<button aria-expanded aria-controls>` + `role=region aria-labelledby` (PanelSection:56-95) | [APG Disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) — ✅ conformant. | Verify only. |
| Panel landmark | `<aside role=complementary aria-label="Agent workspace">` (WorkspacePanel:164,191-201) | Landmark — ✅. | Verify only. |

### Pattern 6: Global `:focus-visible` ring (D-11)

**What:** Add ONE global rule to `frontend/src/index.css` `@layer base`. Confirmed: **NO `:focus-visible` rule exists today** [VERIFIED: grep of index.css returns zero matches].
**Token:** Use `--ring` (already defined: dark `239 100% 82%`, light `239 84% 67%` — index.css:74,28). This is the same token the scattered per-utility `focus-visible:ring-ring` classes already use, so it harmonizes.
**Pattern (avoid regressing components with their own focus classes):**

```css
/* Source pattern: frontend/src/index.css @layer base — ADD this block */
@layer base {
  :where(a, button, input, select, textarea, [tabindex]):focus-visible {
    outline: 2px solid hsl(var(--ring));
    outline-offset: 2px;
  }
}
```

Use `:where(...)` (zero specificity) so any component that sets its own `focus-visible:ring-*` Tailwind utility (FilesSection, PanelSection, PanelRail, PendingAskCard, VersionDiff, WorkspacePanel all do) **wins automatically** — the global rule is a floor, not an override. This avoids double-rings and regression. `:focus-visible` (not `:focus`) keeps the ring off mouse clicks, matching the existing component intent.

### Pattern 7: Targeted `aria-live` regions (D-12)

Three moments, recommended politeness with rationale:

| Moment | Where (source) | Politeness | Rationale |
|--------|----------------|------------|-----------|
| Todo status change | TodosSection — add a visually-hidden live region (NONE exists today; aria-live count = 0) | **polite** | Status flips are informational, not urgent; assertive would interrupt the SR mid-read on every todo flip in a multi-step run (noisy). Announce e.g. "2 of 3 todos complete" on change. |
| Diff added/removed line counts | VersionDiff (the `+N/−M` summary at :198-203) — wrap in `aria-live` OR add a hidden region | **polite** | The diff is user-initiated (they picked versions); a polite "8 added, 0 removed" after the diff loads is sufficient. |
| ask_user prompt appearing | PendingAskCard ALREADY has `aria-live="assertive"` on the "Needs you" span (:175) | **assertive** | Correct — the agent is BLOCKED on the user; this must interrupt. **BUT** the assertive span is a child that's always present when the card mounts — verify the SR actually announces on mount (a static assertive region may not re-announce). Safer: announce the prompt TEXT via a region that changes on mount. Consider moving the assertive announce to wrap the prompt `<p>` (:179) or add `role="alert"` to the card. |

**Implementation pattern (visually-hidden live region):**
```tsx
// Add to TodosSection (and VersionDiff). The region is empty until the value changes.
<span className="sr-only" aria-live="polite">
  {`${doneCount} of ${total} todos complete`}
</span>
// `sr-only` is already a defined utility (used in PendingAskCard:219). prefers-reduced-motion N/A for SR.
```

### Anti-Patterns to Avoid

- **Forcing tool use via `tool_choice: any`/`tool` in the universal slice.** All three providers' docs say this is per-call architecture (prefills the assistant message). It is OUT of the D-06 universal-text-only scope and risks regressing strong models (changes their natural narration). [CITED: Anthropic, OpenAI, Google docs below.]
- **Per-provider prompt branching in 088.** Explicitly deferred to v2.8 (D-08). The fold-gate condition-a forbids it.
- **Blanket `aria-live` sweep.** D-12 is targeted; a region on every dynamic node creates SR cacophony during a streaming run.
- **Hand-rolled focus traps.** Use Radix Dialog (already in `DiffExpandOverlay`); don't build keydown traps.
- **Productizing the eval script.** D-02 says MVP seed only; the harness is v2.8.
- **Gating phase success on gemini-2.5.** D-03 — it is known-degraded; record as a data point, do not block.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Eval-script DB/Redis/LangSmith plumbing | A new evidence collector | Copy `scripts/observe-run.py` patterns (env load, psycopg2 query, redis xrange, langsmith Client) | Already solved, same env path, proven |
| 4-axis UAT row schema | A new scoreboard format | Reuse `087-VALIDATION.md:107-114` table verbatim | Established, models already picked |
| E2E auth / DB-teardown / trace-assert | New fixtures | `frontend/tests/e2e/fixtures/{auth,db-teardown,langsmith}.fixture.ts` | Mature, localhost-hard-gated, used by 12 scenarios |
| Gemini thought-signature round-trip | OpenAI-compat serialization hack | Native google-genai SDK auto-management (already adopted, google_service.py:43,184-203) | The compat hack was the BUG (075.4); native SDK round-trips it [CITED: Google docs] |
| Overlay focus trap / Escape | Custom keydown handler | Radix Dialog (DiffExpandOverlay) | Focus-trap + Escape + focus-return for free |
| a11y rule engine | Custom contrast/role checks | axe-core (via vitest-axe) + Lighthouse (Chrome MCP) | Industry-standard rules; Lighthouse measures REAL contrast jsdom can't |
| CSV/diff/markdown rendering a11y | New renderers | Existing CsvTablePreview (`<table>`), DiffLines, MarkdownRenderer (already security-hardened, text-children) | Phase 087 already built + hardened them |

**Key insight:** Phase 088 is overwhelmingly a *verification and gap-closing* phase, not a build phase. Almost every capability it needs already exists in the repo (eval-script template, UAT format, E2E substrate, panel a11y scaffolding). The discipline is to REUSE and EXTEND, not rebuild — consistent with [[feedback_iterate_leverage_existing]] and the G-5 hot-file refactor guardrails (do not re-touch `threads.py`/`ToolCallPanel` shared paths).

## Runtime State Inventory

> This phase is verification + a11y remediation — NOT a rename/refactor/migration. No stored-string renames. The only "state" concern is **test-user data hygiene during UAT/E2E**, which the existing substrate already handles.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None renamed. UAT runs WRITE test data (todos/workspace_files/messages for the test user) | `db-teardown.fixture.ts::teardownTestUserData` purges runs→messages→threads between Playwright scenarios; operator should clear test threads after manual Chrome MCP UAT (precedent: STATE.md:115 "7 ask_user test-fixture threads purged 2026-05-28") |
| Live service config | None — no external service config carries a renamed string | None |
| OS-registered state | None | None |
| Secrets/env vars | The eval script + Playwright read `backend/.env` (SUPABASE_URL, DATABASE_URL, LANGSMITH_API_KEY, REDIS_URL) and CI secrets (E2E_USER_*, SUPABASE_SERVICE_ROLE_KEY) — code READS them, none renamed | None — verified the eval script reuses observe-run.py's exact env names |
| Build artifacts | `vitest-axe` added to `frontend/package.json` devDependencies → `npm install` regenerates `node_modules` + `package-lock.json` | Run `cd frontend && npm install` after adding the dep; commit the lockfile change |

**Verified:** No runtime-state migration required. The phase adds a dev-dependency, a script, a scenario file, and small frontend edits.

## Common Pitfalls

### Pitfall 1: Wrong axe binding (jest-axe under Vitest)
**What goes wrong:** Installing `jest-axe` and expecting `toHaveNoViolations` to "just work" — it ships a Jest-shaped matcher; under Vitest you must `expect.extend` it manually.
**Why it happens:** D-13 literally says "jest-axe", but the runner is Vitest.
**How to avoid:** Install `vitest-axe@0.1.0`; in `setupTests.ts` add `import * as matchers from "vitest-axe/matchers"; expect.extend(matchers)` (or use vitest-axe's auto-extend import). [VERIFIED: package.json `"test": "vitest run"`.]
**Warning signs:** `expect(...).toHaveNoViolations is not a function`.

### Pitfall 2: Measuring the wrong code path in the eval script
**What goes wrong:** Calling the service layer directly bypasses `threads.py`'s `active_system_prompt` assembly — so a SEED-034 prompt change wouldn't be measured.
**Why it happens:** The service layer is easier to call than the full HTTP route.
**How to avoid:** Drive `POST /threads/{id}/messages` (the real path) — that's where `SYSTEM_PROMPT` (threads.py:336) + `get_tools()` descriptions are assembled and sent. The fold-gate (D-05) is about the shared prompt; measure it.
**Warning signs:** Fold-gate "passes" but live UAT shows no change.

### Pitfall 3: `messages.tool_calls` is JSONB, not a table
**What goes wrong:** Querying a `tool_calls` table (observe-run.py:194 comment: "tool_calls table doesn't exist in this schema") returns nothing.
**Why it happens:** CONTEXT says "`messages.tool_calls`" but it's easy to read as a separate table.
**How to avoid:** It is a **JSONB column on `messages`** [VERIFIED: migration 013 `ALTER TABLE messages ADD COLUMN tool_calls JSONB`; migration 055 documents the `.kind` values]. Query `SELECT tool_calls FROM messages WHERE ...` and parse the JSON array. For `ask_user`, use the JSONB containment query `tool_calls @> '[{"kind":"ask_user_prompt"}]'` (panel.py:128).
**Warning signs:** Eval script reports 0 tool calls despite a successful run.

### Pitfall 4: Gemini thought-signature regresses silently on the reconstructed-history path
**What goes wrong:** Google's SDK auto-manages thought_signature ONLY when you "append the full model response object directly to history" [CITED: Google docs]. Our app reconstructs history from `messages.tool_calls` JSONB (threads.py `_reconstruct_history`), then manually re-attaches the signature to the `Part` (google_service.py:184-203). If a signature isn't captured/persisted (e.g. a new SSE shape), the round-trip breaks → 400 INVALID_ARGUMENT on the 2nd tool round.
**Why it happens:** The hybrid (reconstructed history + manual Part attach) is more fragile than the SDK-native append.
**How to avoid:** D-17's LIVE re-verification — run a 2+-tool-round prompt on a Gemini-3.x model and assert no 400. `scenario-02` already does this at the network level; the deep E2E (D-15) adds the panel surfaces. Cross-check `messages.tool_calls[].thought_signature` is persisted (threads.py:2596,2727).
**Warning signs:** "Function call is missing a thought_signature" 400 on round 2.

### Pitfall 5: Contrast can't be verified in jsdom
**What goes wrong:** axe-core under jsdom does NOT evaluate color-contrast (no layout/computed colors). A green vitest-axe run does not prove 4.5:1.
**Why it happens:** jsdom has no rendering/CSSOM color resolution.
**How to avoid:** axe-core's contrast rule is the **Lighthouse / Chrome MCP** job (D-13b) — it measures real rendered colors on the Deep Midnight theme. The 087-01 amber `--warning-foreground` was already darkened to ≥4.5:1 (index.css:65-68) as precedent; verify the rest live.
**Warning signs:** Treating vitest-axe green as full AA — it covers structure (roles/names/labels), not contrast.

### Pitfall 6: Over-asserting an empty `aria-selected` / always-false ARIA state
**What goes wrong:** FilesSection sets `aria-selected={false}` on every `role=option` (FilesSection:182) — axe flags a listbox where no option is selectable/selected as a potential violation; SRs announce nothing useful.
**How to avoid:** Track `aria-selected={isActive}` or omit it (drill-in replaces the list, so persistent selection is moot). Decide during the a11y plan.
**Warning signs:** axe "ARIA attribute is not allowed / state mismatch" on FilesSection.

## Code Examples

### Provider-docs-first directive candidates (D-06, if the fold-gate passes)

The SYSTEM_PROMPT (threads.py:336-477) has a strong "Tool selection guide" but **no explicit "ALWAYS call X before answering" universal directive** for the two measured weak spots (factual-doc-search and write_todos). Grounded candidates:

**Candidate A — search-before-answer (addresses DeepSeek/Kimi/GLM answering from training data; SEED-034 evidence):**
```text
# Insert into SYSTEM_PROMPT (threads.py:336) under "## Tool selection guide"
"- **ALWAYS search before answering questions about the user's documents.** "
"For ANY question that could be answered by the user's uploaded documents or files, "
"you MUST call search_documents (or query_documents/query_tables for structural/tabular "
"questions) BEFORE answering. Never answer a documents question from prior knowledge — "
"the user's documents are the source of truth."
```
[CITED: Google "Be extremely clear and specific in your descriptions… specify how and when to use functions" — https://ai.google.dev/gemini-api/docs/function-calling ; OpenAI "the description matters because the model uses it to decide when a function is relevant. Vague descriptions lead to wrong tool selection" — https://developers.openai.com/api/docs/guides/function-calling ; Anthropic "add explicit instructions in a user message… 'Use the get_weather tool in your response.'" — https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use]

**Candidate B — write_todos for multi-step (addresses gemini-2.5 narrate-without-calling, and weak-model tracking):**
```text
"- **When the user asks you to track, plan, or work through multiple steps, ALWAYS call "
"write_todos** to record the task list — do not just narrate the steps in text. The user "
"sees the todo list in their workspace panel; a narrated list they cannot see is not tracking."
```

**Candidate C — richer tool descriptions (Anthropic: "by far the most important factor"):**
The `WRITE_TODOS_TOOL` / `SEARCH_DOCUMENTS_TOOL` descriptions in `openai_service.py` should hit Anthropic's "3-4 sentences" bar with explicit when-to-use/when-not-to-use. Example shape (Anthropic's good-vs-poor contrast):
```python
# openai_service.py get_tools() — strengthen description text (NOT schema/args):
"description": (
    "Record or update the task list for a multi-step request. Call this whenever the user "
    "asks you to plan, track, or work through several steps so the task list appears in "
    "their workspace panel. Use it at the START of multi-step work and again to flip a "
    "todo's status as you complete it. Do NOT use it for single-step requests or to narrate "
    "— this tool persists a real, user-visible list."
)
```

**Fold-gate thresholds (D-05 — Claude's discretion, recommended concrete values):**
- **(a) text-only:** the change touches ONLY `SYSTEM_PROMPT` (threads.py:336) string content and/or `*_TOOL["description"]` strings in `openai_service.py`. ZERO changes to: argument schemas, `get_tools()` logic, any `*_service.py` adapter, any per-provider branch, `MODEL_CAPABILITIES`. (A `git diff` touching only those string literals proves it.)
- **(b) improvement:** Re-run `eval_cross_provider.py` AFTER the change. Pass requires **≥1 model that FAILED a canonical-prompt assertion before now PASSES it** (e.g. gemini-3.x or a DeepSeek/Kimi/GLM model that previously answered a doc question without `search_documents` now invokes it; measured by `messages.tool_calls` + DB rows).
- **(c) zero regression:** **EVERY (provider × prompt) row that PASSED before still PASSES** — the strong tool-callers from SEED-034 evidence (gpt-5.4-mini, claude-opus/haiku, deepseek-v4-flash, kimi-k2.6, gemini-3.5-flash) show no new failures (no over-constraint, no lost narration that breaks a row). If even one strong row regresses → DO NOT FOLD; route to v2.8.
- **Recommended canonical prompt set N (D-02):** 4 prompts —
  1. *factual-doc-search*: "What does my dissertation say about X?" → assert `search_documents` invoked + answer cites a doc.
  2. *multi-tool*: "Plan a 3-step analysis of my Q3 data and write the summary to a file." → assert `write_todos` (todos table rows) AND `workspace_write` (workspace_files row).
  3. *task sub-agent*: "Find every mention of Y across my documents and summarize." → assert `task` invoked (`messages.tool_calls[].sub_agent` present).
  4. *ask_user*: "Overwrite my existing report — but confirm with me first." → assert `ask_user` invoked (`tool_calls @> '[{"kind":"ask_user_prompt"}]'`).

### vitest-axe wiring (D-13a)

```ts
// frontend/src/setupTests.ts — extend (currently only imports jest-dom)
import "@testing-library/jest-dom"
import * as axeMatchers from "vitest-axe/matchers"
import { expect } from "vitest"
expect.extend(axeMatchers)
```
```tsx
// Per panel test file (8 files), add one assertion using existing fixtures:
import { axe } from "vitest-axe"
it("has no axe violations (rendered state)", async () => {
  setTodos(mockTodos)                       // existing fixture (fixtures.ts:29)
  const { container } = render(<TodosSection />)
  expect(await axe(container)).toHaveNoViolations()
})
```
Attach to all 8 existing files: `WorkspacePanel`, `TodosSection`, `FilesSection`, `FilePreview`, `CsvTablePreview`, `PendingAskCard`, `VersionDiff`, `Seam` (`__tests__/*.test.tsx`). Use the shared `fixtures.ts` mocks — assert rendered STATES (empty, populated, pending-ask, answered, expired) so axe sees real DOM.

### Chrome MCP Lighthouse a11y audit (D-13b/D-14)

```
# Operator-driven, against the live authenticated app:
# 1. Chrome MCP: navigate http://localhost:5173, login fhdmrd@gmail.com / 123456
# 2. Trigger a workspace run (write_todos + workspace_write + ask_user) so the panel is populated
# 3. Run Lighthouse a11y category (or the dedicated a11y audit) — captures REAL contrast ratios,
#    REAL focus rings, REAL DOM that jsdom/axe-core cannot see
# 4. Keyboard walk: press_key Tab/Shift-Tab/Enter/Space/Escape through
#    todos → files (Arrow nav) → file preview (Escape) → versions/diff (pills) → ask_user (radio + free-text)
#    screenshot focus states at each stop as phase evidence (D-14)
# 5. Repeat in BOTH themes (Deep Midnight dark + light) — contrast differs per theme
```
[Evidence tooling: [[reference_evidence_tools_inventory]] — Chrome DevTools MCP; [[reference_local_dev_app]] — dev app + test login.]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Gemini thought_signature via OpenAI-compat `extra_content.google.*` serialization | Native google-genai SDK attaches signature to `Part` directly | Phase 075.4 → 075.5 (google_service.py:22-23,184-203) | The compat hack WAS the 400 bug; native SDK round-trips it. D-17 re-verifies the native path live. [CITED: Google thought-signatures doc — SDK auto-manages] |
| Single shared prompt, no explicit tool-use floor | (Proposed, conditional) universal "ALWAYS call X" directives + richer tool descriptions | 088, IF fold-gate passes (D-05) | Lifts weak/new models toward strong-model tool-use without per-provider branching |
| No a11y tooling | vitest-axe (structural) + Chrome MCP Lighthouse (real contrast) | 088 (D-13) | Durable regression gate + real-DOM audit |
| `jest-axe` (named in D-13) | `vitest-axe` (runner is Vitest) | 088 research correction | Correct binding for the actual runner |

**Deprecated/outdated:**
- The `extra_content.google.thought_signature` OpenAI-compat shape — OBSOLETE (google_service.py:22-23, threads.py:2588-2591 comments). Do not reintroduce.
- gemini-2.5 series as a Google representative — known-degraded (D-03); use 3.x+.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The deep E2E (D-15) is best authored as a Playwright scenario AND a Chrome MCP walk (both) | Pattern 4 | If CI Playwright + Google API key is flaky, the automated backstop may be RED in CI; mitigated by `scenario-02`'s precedent (it tolerates env absence by failing loudly, which is intended). Operator Chrome MCP pass is the non-negotiable gate. |
| A2 | The eval script should drive the real HTTP route, not the service layer | Pattern 1, Pitfall 2 | If driving the full route is too heavy for a quick gate, a hybrid (route for the fold-gate prompts, service for smoke) is acceptable — but the fold-gate MUST use the real `active_system_prompt`. |
| A3 | gemini-2.5-flash narrate-without-calling and DeepSeek/Kimi/GLM answer-from-training are still reproducible at 088 time | Domain 1, Candidate B | SEED-034 evidence is from 2026-05-27/29 (fresh). If a provider has since improved, fold-gate condition-b ("≥1 previously-failing model now passes") may be unmet by the prompt change alone — that correctly routes SEED-034 to v2.8 (the gate is self-correcting). |
| A4 | The `vitest-axe@0.1.0` 0.x version is production-safe as a dev-dependency | Standard Stack | It's the standard Vitest axe binding; if the planner distrusts 0.x, the jest-axe + manual `expect.extend` fallback uses the identical axe-core engine. Dev-only, ~$0 either way. |
| A5 | TodosSection rows do NOT need a keyboard interaction path (they're display-only) | A11Y-02 row, Pattern 5 | If a future design makes todo rows actionable (toggle/edit), A11Y-02 would need keyboard handlers. Current source (TodosSection.tsx) renders static `<li>` — confirmed display-only. A11Y-02's "todo list keyboard-navigable" is satisfied by the list being reachable/readable, not actionable. **Flag to discuss-phase/planner: confirm todos are intentionally non-interactive.** |
| A6 | Long-message axis (≥50 msgs / ≥5KB) cannot be meaningfully automated | Validation Architecture | CLAUDE.md + 087-VALIDATION.md both mandate it manual per provider; an automated 50-message seed is possible but the "felt" no-drop behavior is the bar. Kept manual per the locked recipe. |

**Note:** A1–A6 are design-judgment assumptions, not unverified facts. All factual claims (file:line, schema, package versions, provider doc quotes) are VERIFIED/CITED.

## Open Questions

1. **Does the SEED-034 fold-gate evidence still reproduce at 088 execution time?**
   - What we know: SEED-034's gemini-2.5 no-tool-call + weak-model answer-from-training were fresh (2026-05-27/29).
   - What's unclear: whether a text-only prompt change can flip ≥1 failing model without regressing a strong one (the empirical core of D-05).
   - Recommendation: The eval script measures this directly. If condition-b fails (no measurable improvement) OR condition-c fails (a strong model regresses), the gate self-routes SEED-034 to v2.8 — that's the designed outcome, not a phase failure.

2. **Is FilePreview's `window`-level Escape (with `stopPropagation`) safe when the DiffExpandOverlay (Radix Dialog) is also open?**
   - What we know: FilePreview adds a `window` keydown listener (FilePreview:121-130) that `stopPropagation()` + closes; Radix Dialog has its own Escape.
   - What's unclear: ordering/conflict when both are mounted.
   - Recommendation: Test both-open during the keyboard walk; if Escape closes the wrong layer, scope FilePreview's listener to its own container or check `e.defaultPrevented`.

3. **Should `gemini-2.5` get a row in the 4-axis matrix (as a recorded known-degraded data point) or be omitted entirely?**
   - What we know: D-03 says record it as a data point, don't gate on it.
   - Recommendation: Include a clearly-marked `gemini-2.5-flash (known-degraded — not gating)` row in the VALIDATION scoreboard for provenance; the gating Google row is 3.x+.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vitest | a11y unit tests | ✓ | ^4.1.0 | — |
| Playwright | E2E deep flow | ✓ | ^1.60.0 | Chrome MCP live walk |
| Chrome DevTools MCP | Lighthouse + manual a11y walk + lived-experience UAT | ✓ (per [[reference_evidence_tools_inventory]]) | — | — (required for D-13b/D-14) |
| Supabase (local) | DB persistence assertions | ✓ (CLAUDE.md local dev) | CLI v2.101 | — |
| Redis (local) | run-buffer evidence | ✓ (docker-compose.dev.yml) | — | eval script degrades gracefully (observe-run.py pattern skips if absent) |
| LangSmith | trace evidence | ✓ (SDK/API) | — | eval script + langsmith.fixture soft-skip if key unset |
| Backend uvicorn (operator-started) | live agent loop for eval/UAT | ✓ (operator starts it — [[feedback_user_starts_backend]]) | — | — |
| vitest-axe | a11y regression gate | ✗ (NOT installed) | — | `npm install -D vitest-axe` (or jest-axe + manual extend) |
| Google API key + gemini-3.x model | D-15/D-17 Google axis | ⚠️ operator-configured | — | If absent, the Google axis fails LOUDLY (scenario-02 precedent) — operator must configure |
| Anthropic API key | D-15 Anthropic axis | ⚠️ operator-configured | — | required for the deep flow's 2nd provider |

**Missing dependencies with no fallback:**
- Chrome DevTools MCP is required for the D-13b Lighthouse audit + D-14 lived-experience pass (the contrast/focus checks jsdom can't do). Confirmed available.

**Missing dependencies with fallback:**
- `vitest-axe` — install via `npm install -D` (the only new dep).
- LangSmith / Redis — eval script degrades gracefully (DB assertions are the hard gate; traces/streams are supplementary evidence).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (unit) | Vitest ^4.1.0 + @testing-library/react + jsdom [VERIFIED: frontend/package.json, vitest.config.ts] |
| Framework (E2E) | Playwright ^1.60.0 [VERIFIED: playwright.config.ts] |
| a11y matcher | vitest-axe 0.1.0 (NEW dev-dep) [VERIFIED: npm] |
| Config files | `frontend/vitest.config.ts`, `frontend/playwright.config.ts`, `frontend/src/setupTests.ts` |
| Quick run command | `cd frontend && npx vitest run src/components/panel/` |
| Full suite command | `cd frontend && npm test` (`vitest run`) |
| E2E command | `cd frontend && npm run e2e` (`playwright test`) |
| Real-browser audit | Chrome DevTools MCP (Lighthouse a11y + manual keyboard walk) |

**Baseline note (carry from 087-VALIDATION.md:28):** Phase 086 has a known ~17-failure pre-existing baseline in StreamsProvider tests — unrelated to panel/088 work. 088 must not regress beyond that baseline; new axe assertions are GREEN-only.

### ROADMAP Success Criteria + A11Y reqs → Validation Map

| Criterion | What proves it true | Method | Automatable? |
|-----------|---------------------|--------|--------------|
| **SC#1** — 4-axis UAT matrix complete (all new SSE event types × OpenAI/Anthropic/Google/OpenRouter × multi-tool/parallel/long-message) | Filled scoreboard (087-VALIDATION format) showing every panel-owned tool firing + persisting per provider | Axes 1–3: Playwright `scenario-13` + eval script (DB assertions). **Long-message: MANUAL per provider.** Lived parity: Chrome MCP | Axes 1–3 yes; **long-message MANUAL** |
| **SC#2** — All panel surfaces pass WCAG 2.1 AA (keyboard, ARIA, ≥4.5:1, focus) | vitest-axe green on all 8 panel test files (structural) + Lighthouse green on real contrast/focus | vitest-axe (structure) + **Chrome MCP Lighthouse (contrast/focus — jsdom CANNOT)** | Structure yes; **contrast MANUAL/Lighthouse** |
| **SC#3** — File browser + todo list fully keyboard-navigable, no mouse-only | FilesSection Arrow/Enter/Space/focus-restore verified (already in source); todos reachable/readable | vitest-axe + **Chrome MCP keyboard walk (D-14, screenshots)** | Partial; **lived walk MANUAL** |
| **SC#4** — E2E workspace flow verified (write→see→update→diff→ask_user→respond→resume, no refresh, ≥2 providers) | `scenario-13` green on Anthropic + Google + operator Chrome MCP confirmation | Playwright `scenario-13` (automated backstop) + **Chrome MCP lived pass (D-14/G-4)** | Backstop yes; **lived pass MANUAL** |
| **A11Y-01** | = SC#2 + SC#3 combined; global `:focus-visible` ring present (index.css); aria-live regions present | vitest-axe + Lighthouse + manual walk | Structure yes; **contrast/lived MANUAL** |
| **A11Y-02** | = SC#3; FilesSection keyboard contract green; todos display-only confirmed | vitest-axe + manual walk | Partial; **walk MANUAL** |
| **D-17** — gemini-3 thought-signature re-verified | 2+-tool-round Gemini-3.x run, no 400 INVALID_ARGUMENT, run completes, panel renders | `scenario-13` (Google axis) + `scenario-02` (network) + Chrome MCP. Reproduces→fix-in-088; clean→close report | Yes (network) + **lived MANUAL** |
| **SEED-034 fold-gate (D-05)** | eval script before/after diff: ≥1 failing model improves, 0 strong regress, text-only git diff | `scripts/eval_cross_provider.py` (run twice) + `git diff` inspection | Yes |

### Sampling Rate
- **Per task commit (a11y):** `cd frontend && npx vitest run src/components/panel/` (panel + axe, ~5s)
- **Per wave merge:** `cd frontend && npm test` (full suite, must not regress past baseline)
- **Phase gate:** Full vitest suite green + `scenario-13` green (Anthropic+Google) + Chrome MCP Lighthouse green + operator lived-experience pass (D-14) + 4-axis scoreboard filled (long-message manual) + SEED-034 fold-gate decision recorded — all before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `frontend/package.json` + `frontend/src/setupTests.ts` — install/wire `vitest-axe` (the only framework-install gap)
- [ ] `scripts/eval_cross_provider.py` — NEW (model on `observe-run.py`); no test-infra exists for it yet
- [ ] `frontend/tests/e2e/scenario-13-workspace-deep-flow.spec.ts` — NEW (extends `scenario-02` + fixtures)
- [ ] `088-VALIDATION.md` — author 4-axis UAT rows + long-message manual rows + deep-E2E manual rows + SEED-034 fold-gate decision + a11y manual-walk checklist (mirror 087-VALIDATION.md structure)

*(Existing test infrastructure — 8 panel test files + `fixtures.ts` + 3 E2E fixtures + `restart-backend.{sh,ps1}` + `/health` — covers everything else.)*

### MANUAL-ONLY validations (planner: author under VALIDATION.md, NOT as automatable plan tasks)
1. **Long-message axis** (≥50 prior messages OR ≥5 KB prompt) per provider — felt no-drop behavior, not wire-observable. [LOCKED: CLAUDE.md + 087-VALIDATION.md:87]
2. **Operator final lived-experience a11y pass** (D-14/G-4) — keyboard walk + screen-reader feel + both themes; the recognize-failure-here gate.
3. **Real-contrast 4.5:1 verification** (Chrome MCP Lighthouse) — jsdom/axe-core cannot measure rendered colors (Pitfall 5).
4. **Cross-provider lived parity** — panel renders identically across providers (the [[feedback_uat_lived_experience_gap]] felt check).

## Security Domain

> `security_enforcement` is not set to `false` in config.json — include. Phase 088 adds no new attack surface (verification + a11y remediation), but the eval script + E2E touch live data/secrets.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (test) | E2E uses the env-driven test login; never commit creds (auth.fixture defaults are the documented local test user; CI uses GitHub secrets) [VERIFIED: auth.fixture.ts header] |
| V3 Session Management | no | No session logic changed |
| V4 Access Control | yes (verify) | RLS on `todos`/`workspace_files` via FK→threads.user_id (migration 055:20-37) — the eval script must use the test user's own thread; do not bypass RLS |
| V5 Input Validation | yes (already hardened) | Panel renderers (DiffLines, CsvTablePreview, SeamCard, PendingAskCard) render agent content as React TEXT children — never `dangerouslySetInnerHTML` (T-087-04/08/13). a11y edits must PRESERVE this — do not introduce raw-HTML for an aria-label/announce. |
| V6 Cryptography | no | No crypto; thought_signature is opaque/SDK-managed, never decoded by us beyond base64/bytes pass-through (google_service.py:48-66) |
| V7 Secrets | yes | Eval script reads `backend/.env` via dotenv (observe-run.py pattern) — never log key values; db-teardown is **localhost-hard-gated** (db-teardown.fixture.ts:18-29). Honor [[feedback_env_secrets_handling]] — name-only extraction, never paste full .env. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| E2E/eval script wiping production data | Tampering/DoS | `assertLocalhostOnly()` hard-gate refuses non-local `SUPABASE_URL` (db-teardown.fixture.ts) — reuse it; never point the eval script at cloud |
| Secret leakage in logs/CI | Info Disclosure | LangSmith/Supabase keys flow via GitHub secrets (auto-redacted); eval script must not print key values (observe-run.py only prints absence/presence) |
| XSS via agent content in a new aria-label/announce | Tampering | a11y announces render as React text/`sr-only` children — preserve the Phase 087 no-raw-HTML invariant |
| Cross-thread data bleed in panel during parallel UAT | Info Disclosure | The parallel-thread axis explicitly tests reconcile-abort (no cross-thread bleed) — a verification target, not a new risk |

## Sources

### Primary (HIGH confidence — read from source this session)
- `backend/app/api/threads.py:336-477` — SYSTEM_PROMPT (the real fold target, NOT openai_service); `:1510-1596` active_system_prompt assembly; `:2575-2600,2719-2728` tool_calls persistence + thought_signature echo
- `backend/app/services/openai_service.py:636-735` (tool schemas), `:738-783` (EXPLORER_SYSTEM_PROMPT + get_tools), `:785-823` (per-provider client + LangSmith wrap)
- `backend/app/services/google_service.py:22-23,43-66,184-203,380-456` — native genai SDK + thought_signature Part attach
- `backend/app/api/panel.py:67-156` — `/todos`, `/ask_user/pending`, `/tasks`; JSONB containment query `tool_calls @> '[{"kind":"ask_user_prompt"}]'`
- `scripts/observe-run.py` — eval-script template (env load, Postgres/Redis/LangSmith dump)
- `supabase/migrations/013_messages_tool_calls.sql` (tool_calls JSONB), `055_todos_table.sql` (todos + .kind doc-comment), `054_workspace_files.sql`
- `frontend/src/components/panel/*.tsx` (all 15) — current a11y state (roles/aria/focus/keyboard) per component
- `frontend/src/components/layout/ChatLayout.tsx`, `frontend/src/index.css:44-85` (Deep Midnight tokens; NO :focus-visible), `frontend/src/components/panel/__tests__/{TodosSection.test.tsx,fixtures.ts}`
- `frontend/tests/e2e/{playwright.config.ts,scenario-02-...spec.ts,fixtures/*.fixture.ts}` — E2E substrate
- `.planning/phases/087-panel-ui/087-VALIDATION.md:83-116` (4-axis scoreboard format + models), `087-SCENARIO-MATRIX.md` (deep flow already verified manually, line 22)
- `.planning/reported-bugs/gemini-3-thought-signature-missing-on-tool-rounds.md` (D-17 history)

### Secondary (HIGH confidence — official provider docs, cited)
- Anthropic tool use / define tools — https://platform.claude.com/docs/en/agents-and-tools/tool-use/implement-tool-use ("extremely detailed descriptions… by far the most important factor"; tool_choice auto/any/tool/none; "add explicit instructions in a user message")
- Anthropic prompt engineering overview — https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview
- OpenAI function calling — https://developers.openai.com/api/docs/guides/function-calling ("the description matters because the model uses it to decide when a function is relevant. Vague descriptions lead to wrong tool selection")
- Google Gemini function calling — https://ai.google.dev/gemini-api/docs/function-calling (modes AUTO/ANY/VALIDATED/NONE; "Be extremely clear and specific in your descriptions"; max 10-20 tools)
- Google Gemini thought signatures — https://ai.google.dev/gemini-api/docs/thought-signatures (Gemini 3 mandatory; 400 if missing; "handled automatically when you use the official Google Gen AI SDKs and append the full model response object directly to history")
- WAI-ARIA APG patterns — https://www.w3.org/WAI/ARIA/apg/patterns/ (Listbox, Radio Group, Disclosure, Dialog (Modal), Button)
- npm registry — `vitest-axe@0.1.0` (2025-01-22), `axe-core@4.11.4`, `jest-axe@10.0.0` (verified via `npm view`)

### Tertiary (MEDIUM — community, cross-verified against official)
- OpenAI dev community "Prompting Best Practices for Tool Use" — directional, consistent with official function-calling guide

## Metadata

**Confidence breakdown:**
- Cross-provider verification + eval script: **HIGH** — every assertion target (tables/columns/endpoints) and the eval-script template read from source; UAT format + models reused from 087-VALIDATION.
- SEED-034 fold + provider docs: **HIGH** — fold target corrected against source (threads.py:336); all three providers' official docs fetched and quoted; the gate is empirically self-correcting.
- Accessibility: **HIGH** — every in-scope component's a11y state read from source; gaps confirmed (no :focus-visible, no todo aria-live, no diff announce); APG patterns cited.
- a11y tooling: **HIGH** — runner confirmed Vitest (correcting D-13's "jest-axe"); package versions verified on npm.
- D-17 thought-signature: **HIGH** — current native-SDK path + Google's auto-management doc + the existing scenario-02 all read/cited.

**Research date:** 2026-05-29
**Valid until:** ~2026-06-28 (30 days — stable; provider tool-use docs + model behavior are the fastest-moving inputs, re-confirm gemini-3.x + SEED-034 reproduction at execution time)

## RESEARCH COMPLETE
