# Phase 088: Cross-Cutting Verification + Accessibility - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

This is the **close-out gate for the v2.7 Agent Workspace & Panel milestone** (final phase; all 23 feature plans across 083–087 already shipped). It delivers two things and adds **no new product capabilities**:

1. **Cross-cutting verification** — prove every new v2.7 capability works across providers via the mandatory 4-axis UAT matrix (SC#10) plus a deep sequential E2E workspace flow.
2. **Accessibility** — bring all new panel surfaces to **WCAG 2.1 AA** (A11Y-01, A11Y-02).

Plus one ROADMAP-mandated strategic decision: **SEED-034** (per-provider tool-use quality) — *measure* reliability here, then *conditionally* fold a cheap fix or route the architecture to v2.8.

**In scope:** the 4-axis UAT, a reusable cross-provider eval/measurement script, an Anthropic+Google deep E2E flow, WCAG 2.1 AA remediation of panel + seam surfaces, a11y tooling (jest-axe + Chrome MCP Lighthouse), and a conditional universal prompt/tool-description tuning slice.
**Out of scope (→ v2.8):** per-provider prompt overlays, a productized eval harness, new-model onboarding checklist, chat-surface/streaming polish bugs, the 087 feature deferrals (SEED-037/038/039).
</domain>

<decisions>
## Implementation Decisions

### Cross-Provider Verification (SC#1, SC#4)

- **D-01:** The **4-axis UAT matrix is MANDATORY and locked** (CLAUDE.md SC#10): cross-provider (OpenAI, Anthropic, Google, OpenRouter — one representative model each), multi-tool (≥1 row exercising 2+ tools in one prompt, e.g. `workspace_write` + `write_todos` or `search_documents` + `execute_code`), parallel-thread (Thread A streaming while Thread B accepts a prompt), long-message (≥50 prior messages OR ≥5 KB prompt). UAT rows authored under **VALIDATION.md, not PLAN tasks**. Long-message axis stays **manual per provider**; axes 1–3 may be automated.
- **D-02:** Build a small **reusable eval script** as the measurement engine (NOT a one-off scoreboard). Same N canonical prompts run across every provider: factual-doc-search (`search_documents`/`query_tables`), multi-tool (`write_todos` + `workspace_write`), `task` sub-agent, `ask_user`. Each run **asserts tool-invocation happened + arg-shape conformance + persistence in the DB** (Supabase: `todos` from migration 055, `workspace_files`, `messages.tool_calls`). This script seeds the v2.8 eval harness and doubles as a **regression gate** for new-model onboarding. Evidence sources: Supabase/DB + backend (uvicorn) logs + LangSmith + live Chrome MCP UAT.
- **D-03:** **Google representative = gemini-3.x (3.x+), NOT gemini-2.5.** Operator decision (SEED-034): focus Google on 3.x+ models; `gemini-2.5-flash` is **known-degraded** (narrates a todo list without ever emitting the tool call — DB shows 0 todos). Record gemini-2.5 as a known-degraded data point; do **not** gate phase success on it.
- **D-15:** Deep **E2E flow verified on Anthropic + Google**: agent writes file → user sees it in panel → agent updates file → user views diff → agent calls `ask_user` → user responds → agent resumes — all **without page refresh**. Anthropic = strong native-SDK caller; Google = highest-discovery (native SDK + known tool-use variance + the reopened gemini-3 thought-signature bug). The 4-axis UAT already touches all 4 providers at the event level; this is the deeper sequential scenario on the 2 most-divergent adapters.

### SEED-034 — Per-Provider Tool-Use Quality (conditional fold)

- **D-04:** **CONDITIONAL FOLD.** 088 *measures* per-provider tool-use reliability with the eval script (D-02). It folds a tuning slice into 088 **only if the fold-gate (D-05) passes**; otherwise SEED-034 architecture routes to v2.8.
- **D-05 (fold-gate — Claude's discretion on exact thresholds):** Fold a slice into 088 only if **ALL** hold: (a) the change is **prompt / tool-description TEXT only** (shared `SYSTEM_PROMPT` and/or tool-schema descriptions) — **no per-provider branching, no code-path/architecture change**; (b) re-running the eval script after the change shows **≥1 previously-failing model now invokes the tool correctly** (measurable improvement); (c) **ZERO strong-model regressions** (every previously-passing row still passes). If any condition fails → **do not fold; route to v2.8.**
- **D-06:** Fold scope, if folded = **UNIVERSAL ONLY** (approach A): add explicit universal tool-use directives to the one shared prompt + clarify tool-description text (e.g. "when asked to track multi-step work, ALWAYS call `write_todos`"; "for any question about uploaded documents/files, ALWAYS call `search_documents`/`query_tables` before answering"). **No per-provider overlay scaffold in 088** — that is the v2.8 architecture.
- **D-07:** **Provider-docs-first.** Any prompt/tool-description change must be grounded in the provider's OWN official docs (Anthropic tool-use/prompting, OpenAI function-calling, Google Gemini function-calling) cross-checked against our measured reality — never assumption. No shared-path change may regress a working provider (the gate's condition-c enforces this; consistent with [[feedback_no_cross_provider_regressions]]).
- **D-08 (→ v2.8):** Per-provider prompt overlays keyed off `MODEL_CAPABILITIES`, the productized cross-provider eval harness, and the new-model onboarding checklist are **deferred to v2.8**. 088's eval script (D-02) is the seed/MVP of this.

### Accessibility (A11Y-01, A11Y-02)

- **D-09:** Bar = **FIX ALL findings to WCAG 2.1 AA** on the in-scope surfaces so A11Y-01/02 genuinely **PASS** (not audit-and-document). Defer **only** a finding that requires a component restructure — and only as a logged SEED with a concrete `re_open_trigger`.
- **D-10:** Scope = **all `frontend/src/components/panel/*`** (WorkspacePanel, TodosSection, FilesSection, FilePreview, CsvTablePreview, VersionDiff, DiffLines, DiffExpandOverlay, PendingAskCard, PausedRunCue, PanelRail, PanelSection, PanelEmpty, SeamPointer, SeamCard) + `ui/sheet.tsx` + `layout/ChatLayout.tsx` **PLUS the 087 chat-surface seam additions** (SeamCard / SeamPointer / PausedRunCue) — a keyboard user traverses them during the E2E flow.
- **D-11:** AA criteria to satisfy: full **keyboard navigation** (Tab/Shift-Tab focus order, Enter/Space activate, Escape closes previews/overlays, **no mouse-only path**); **ARIA** labels/roles on todo items + checkboxes, file-browser nodes, ask_user choice buttons, diff base/target pills; **4.5:1 contrast** on Deep Midnight; **visible `:focus-visible` indicators** on every interactive element; **no color-only** semantic conveyance (icon + text + color). Known gaps from scout: **TodosSection has 0 roles/focus/SR-handling** (priority remediation); **no global `:focus-visible` ring** exists — add one to the Aether base styles.
- **D-12:** Screen-reader = **targeted `aria-live` regions** for the dynamic moments PRD Theme H names: **diff added/removed line counts**, **todo status changes**, **ask_user prompt appearing**. Not a blanket live-region sweep.

### A11y Tooling & Verification Method

- **D-13:** **BOTH tools** (complementary, not redundant): (a) **jest-axe** added to the existing 087-01 panel test suite as a durable **regression gate** — per-component structural a11y (roles/names/labels), including rendered states; each panel component test asserts no axe violations. (b) **Chrome MCP Lighthouse** a11y audit on the live app for what jsdom can't measure (real contrast ratios, real focus rings, real DOM). jest-axe is a **dev-dependency only** (~$0) — honors [[feedback_dont_hedge_to_no_new_infra]].
- **D-14:** Manual keyboard walk = **Chrome-MCP-driven systematic pass** (press_key Tab/Enter/Space/Escape through todos → files → diff → ask_user, screenshot focus states as evidence) **followed by an operator final lived-experience pass** (G-4). Both required before A11Y sign-off — per [[feedback_uat_lived_experience_gap]].

### Bug Policy at Milestone Close

- **D-16:** **FIX BLOCKERS, DEFER POLISH.** Fix in 088 only bugs that break a **verified v2.7 capability** (a panel surface, a new SSE event type, cross-provider tool-use correctness, or the E2E flow itself). Log everything else to `.planning/reported-bugs/` with a concrete `re_open_trigger` and carry to v2.8 / complete-milestone. Guardrail rationale: don't let the close-out gate become an open-ended bug-fix phase (the 075.x 8-phase cascade lesson).
- **D-17:** **gemini-3 thought-signature (BUG-260523-02) folded into 088.** It was folded into 075.4, hotfixed (Stage-4 in-flight echo), but is **reopened with `reverify_pending`**. 088's Google-axis UAT + the Anthropic+Google E2E re-verify the hotfix **live**. If it reproduces → **fix-in-088** (it's a flow-blocker for Google). If clean → **flip the report to `closed` (verified).**

### Claude's Discretion

- Exact fold-gate thresholds and the canonical prompt set (N) for the eval script (D-02/D-05).
- jest-axe wiring mechanics (shared axe helper, which test files).
- `aria-live` politeness levels (polite vs assertive) per announcement (D-12).
- Representative model pick per provider for the 4-axis UAT (Google subject to D-03).
- Eval-script location (backend tests vs a standalone `scripts/` util) and whether the deep E2E is authored as a Playwright scenario (reusing the 075.4 substrate) or driven live via Chrome MCP.

### Folded Todos

None — `todo.match-phase 088` returned 0 matches.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### SEED-034 / cross-provider tool-use
- `.planning/seeds/SEED-034-system-prompt-cross-provider-tool-use.md` — the central seed: approaches A/B/C/D, the fold-vs-defer mandate, current architecture (shared prompt + `active_system_prompt` assembly), evidence (gemini-2.5 no-tool-call, free-llama arg-shape), provider-docs-first rule.
- `backend/app/services/openai_service.py` — defines `SYSTEM_PROMPT` + `EXPLORER_SYSTEM_PROMPT` (the universal tuning-slice target if the fold-gate passes) and tool JSON schemas in `get_tools()` (tool-description clarity target).
- `backend/app/api/threads.py` §1512–1596 — builds the single `active_system_prompt` sent identically to every provider; the injection site for a universal directive (and the future per-provider overlay point — v2.8).
- `MODEL_CAPABILITIES` registry (per CLAUDE.md) — Google model gating (D-03) and the future home for per-model capability/prompt-selection flags (v2.8).

### Verification recipe
- `CLAUDE.md` → **"UAT scoreboard recipe (MANDATORY)"** — the SC#10 4-axis bandwidth table; UAT rows belong in VALIDATION.md; long-message stays manual.
- `CLAUDE.md` → **"Reported bugs cross-check (MANDATORY)"** — lifecycle + filter rule (surface: Agentic-RAG only).
- `.planning/phases/087-panel-ui/087-SCENARIO-MATRIX.md` — the panel scenario baseline the E2E flow extends.
- `.planning/reported-bugs/gemini-3-thought-signature-missing-on-tool-rounds.md` — **folded_into: 088**; the 075.4 Stage-4 hotfix history + `reverify_pending` that 088 closes.

### Accessibility
- `.planning/PRDs/v2.7.md` §Theme H (lines 107–109) + ACCESSIBILITY-01 (line 142) — the AA acceptance contract: keyboard nav, ARIA targets, 4.5:1 contrast, `:focus-visible`, no color-only, diff-hunk keyboard nav + SR line-count announcements, "automated axe-core scan + manual keyboard walk."
- `.planning/REQUIREMENTS.md` — A11Y-01, A11Y-02 verbatim.
- `.claude/skills/sketch-findings-agentic-rag/` — the **locked panel design contract**; a11y here is remediation against this approved design (why G-2 does not warrant a new sketch).

### Evidence tooling
- Memory [[reference_evidence_tools_inventory]] + [[reference_local_dev_app]] — Supabase CLI + supabase-py, backend logs = uvicorn console, LangSmith SDK/API, Chrome DevTools MCP; dev app `http://localhost:5173/`, test login `fhdmrd@gmail.com` / `123456`.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **087-01 panel test suite + fixtures** (frontend) — jest-axe attaches here; the Wave-0 GREEN `it.todo()` contracts (52, mapped to VALIDATION per-req) are the natural home for live a11y assertions (flip-your-own-todos pattern).
- **075.4 Playwright E2E substrate** — `frontend` E2E scenarios + auth / db-teardown / langsmith fixtures + `restart-backend.{sh,ps1}` (Windows orphan-worker aware) + `/health` endpoint + `.github/workflows/frontend-tests.yml`. The deep E2E flow (D-15) can be authored as a Playwright scenario on this substrate, or driven live via Chrome MCP.
- **087-08 cross-provider 4-axis scoreboard** (in 087 VALIDATION) — the pattern the eval script (D-02) formalizes/automates.
- **Supabase tables** — `todos` (migration 055), `workspace_files` / versions (084), `messages.tool_calls.kind` — the eval script asserts persistence against these.

### Established Patterns
- **"One UX, four adapters"** ([[feedback_provider_uniform_ux]]) — provider services translate native streaming/tool primitives into the shared SSE vocabulary; provider-specific handling stays at the service boundary, never the shared path.
- **SC#10 4-axis UAT recipe** — VALIDATION.md rows (not PLAN tasks); long-message manual per provider.
- **Wave-0 GREEN `it.todo()` contracts flipped to live tests per plan** (087-01) — the a11y plan flips its own.
- **Chrome DevTools MCP as the verified evidence tool**; reported-bugs cross-check lifecycle (open → folded → closed).

### Integration Points
- jest-axe → `frontend/package.json` devDependencies + panel component test files (D-13a).
- Lighthouse a11y → Chrome MCP `lighthouse_audit` on `http://localhost:5173` (authenticated via test login) (D-13b).
- Eval script → backend (canonical prompts → live LLM calls → assert DB) or `scripts/`; reads Supabase + uvicorn logs + LangSmith (D-02).
- Universal prompt directive → `openai_service.SYSTEM_PROMPT` + `get_tools()` descriptions — **only if the fold-gate (D-05) passes** (D-06).
- Global `:focus-visible` ring → Aether base styles (`frontend/src/index.css`) — currently absent (D-11).

### Scout findings (current a11y state, 2026-05-29)
- Partial coverage: `PendingAskCard` rich (aria=12, role=6, 1 sr-only); `FilesSection` / `WorkspacePanel` / `PanelRail` / `PanelSection` have roles + focus.
- Gaps: **`TodosSection` aria=4 but role=0, focus=0, sr-only=0** (weakest); `DiffLines` no SR line-count announcement; **no global `:focus-visible` ring**; only 1 `sr-only` usage repo-wide in panel.
- **No a11y tooling** in `frontend/package.json` today (no axe-core / jest-axe / lighthouse).
</code_context>

<specifics>
## Specific Ideas

- **gemini-2.5 is known-degraded** (narrates without emitting tool calls); test Google on **3.x+** (D-03).
- **The gemini-3 thought-signature 075.4 hotfix needs LIVE re-verification** — 088's E2E + Google-axis UAT *is* that re-verification (D-17). This is the single highest-value cross-provider check in the phase.
- **TodosSection is the priority a11y remediation target** (0 roles/focus/SR).
- **Add a global `:focus-visible` ring** to the Aether base styles — components currently rely on scattered per-utility focus classes.
- **Long-message axis is manual per provider** (≥50 prior messages OR ≥5 KB prompt) — cannot be fully automated.
- The eval script (D-02) is deliberately the **MVP seed** of the v2.8 harness — keep it small and repeatable, don't productize it here.
</specifics>

<deferred>
## Deferred Ideas

- **SEED-034 architecture → v2.8:** per-provider prompt overlays keyed off `MODEL_CAPABILITIES`, the productized cross-provider eval harness, and the new-model onboarding checklist. (088 ships the eval-script seed + a universal-only tuning slice if the fold-gate passes.)
- **087 feature deferrals → v2.8** (not in 088's verification+a11y scope): **SEED-037** (office/PDF in-panel viewing + working download), **SEED-038** (generated-files/artifacts unification — OutputFileCard in chat vs panel FILES), **SEED-039** (panel reliability/polish — fast-thread-switch stale-id race + minor findings). NOTE: SEED-039's fast-switch race *may be observed* during 088 UAT — if it blocks the E2E flow it gets pulled in under the blocker policy (D-16); otherwise it stays deferred.

### Reviewed Todos (not folded)
None — no pending todos matched Phase 088.

### Reported bugs reviewed at this discuss (cross-check)
- **`gemini-3-thought-signature-missing-on-tool-rounds`** (reopened→**folded_into: 088**, major) — see D-17. The one folded report.
- **`chat-tool-cards-scroll-collapse-duplicate`** (open, major) — chat-surface, not the workspace panel; **left open**, re-confirmed deferred to a dedicated **v2.8 chat-tool-card unification phase**. 088 verifies it does not block the workspace E2E flow but does not fix it.
- **`non-anthropic-generic-code-task-descriptions`** (open, minor) — tool-panel display polish (tool_args_progress extraction not wired for non-Anthropic); **left open**, deferred to **v2.8** (streaming polish / alongside SEED-034). 088's UAT may observe it.
- **`step-count-mismatch-timer-vs-panel`** (open, minor) — streaming polish, no panel/cross-provider/a11y overlap; **left open**, → v2.8.
- **`timer-disappears-long-runs`** (open, minor) — streaming polish; **left open**, → v2.8.
</deferred>

---

*Phase: 088-cross-cutting-verification-accessibility*
*Context gathered: 2026-05-29*
