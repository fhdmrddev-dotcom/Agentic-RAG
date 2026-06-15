---
phase: 093-harness-cross-provider-parity
artifact: D-21 native-7 LIVE re-UAT runbook
status: ready
created: 2026-06-03
driver: Claude (Chrome-DevTools-MCP) — operator watches + owns quality judgment + uvicorn lifecycle
binding_gate: PARITY-02 (flip to Validated + phase->passed only on a clean sweep)
pass_bar: BACKEND-TRUTH (DB + log-sink + LangSmith). Known UI defects S1/S2/S5 are deferred to 094/095 and MUST NOT fail a cell.
---

# Phase 093 — D-21 native-7 LIVE re-UAT Runbook

The binding gate for PARITY-02. Proves the gap-closure plans (06-09) actually work
against the live native-7, targeting the exact cells they fixed:
- **093-07** Google `thought_signature` + Moonshot `reasoning_content` round-trip (no round-2 400)
- **093-07 / S4** `runs.input/output_tokens` non-NULL on harness sub-agent runs
- **093-08 / S3** sub-agent model is the correct per-provider model, never `gpt-4o`
- **093-09** GLM `max_steps` convergence — no "reached max_steps" placeholder in the merged review

---

## 0. Live anchors (captured 2026-06-03 pre-flight)

| Thing | Value |
|---|---|
| App | `http://localhost:5173/` · login `fhdmrd@gmail.com` / `123456` |
| Backend | `:8000` (200) · log-sink LIVE → `backend/logs/backend.log` |
| KB folder **DBA** | `37380338-2ccd-4eec-84be-645036d37a09` — `Fahed Mrad Chapters 1 to 4.pdf` (441 chunks) + `.docx` (402 chunks). Topic: **RPA adoption within BPM**. **RQ1–RQ4 ↔ O1–O6. Survey N = 309** (NOT 165 — prior OpenAI defect). |
| Definition IDs | `…b1` research_summarize · `…b2` plan_execute_verify · `…b3` literature_review · `…b4` doc_qa_human |
| **Baseline cutoff** | newest existing `workflow_run` = `2026-06-02T21:12`. Anything newer = this re-UAT. Each cell = its own thread → match by `thread_id`. |
| **"Before" anchor** | `runs` row `2f54f88e` (google/gemini-3.5-flash, `status=failed`, tokens NULL, `error="400 … missing a thought_signature … position 2"`). Cell 1 must produce the OPPOSITE. |
| Supabase reader | `backend/venv/Scripts/python.exe "C:/Users/fhdmr/AppData/Local/Temp/uat093_db.py" select <table> [--eq c=v] [--order col:desc] [--limit N] [--cols a,b]` (read-only, outside the watched tree) |
| LangSmith | project `agentic-rag-module2` (token + tool-fire backstop) |

---

## 1. Evidence streams (capture ALL per cell)

1. **Chrome MCP** — drive the UI, watch the run stream **end-to-end** (never declare done early), screenshot.
2. **Backend log-sink** — snapshot line count before the cell, scan the delta after:
   - Grep `backend/logs/backend.log` for: `gpt-4o.*falling back` · `runs\.usage missing` · `400.*thought_signature` · `reasoning_content` (in a 400) · `reached max_steps` · `cap_paused`.
   - Logger anchors: `app.api.runs`, `app.services.harness_engine`, `app.services.task_service`, `app.db.runs`.
3. **Supabase** — find the new `workflow_run` for the cell's thread, then its `runs` rows:
   - `workflow_runs --eq thread_id=<tid>` → assert `status=completed`, `model`=correct, right `definition_id`.
   - `runs --eq thread_id=<tid> --cols run_id,parent_run_id,provider,model,status,input_tokens,output_tokens,error` → assert per-provider `model` (≠ gpt-4o), tokens **non-NULL**, `status=completed`, `error` null.
4. **LangSmith** — token totals + `search_documents` tool fire (backstop when DB usage is the thing under test).
5. **Screenshots** — `screenshots/093-reuat-{workflow}-{provider}-{stage}.png` (stage ∈ kickoff / mid-stream / answer / error). **Flow-intent note per cell:** record what tools/workspace *should* show, what showed, and tag any gap as **093-defect** vs **planned-094/095/096** vs **NEW-unplanned**.

---

## 2. Pass bar + the deferred-UI rule

A cell **PASSES** on backend-truth: no round-2 400 · real deliverable (not a narrated API error, not a "reached max_steps" placeholder) · correct per-provider model · tokens present · grounded in the dissertation (search_documents fired, cites real content / N=309).

**Do NOT fail a cell on these known-deferred UI defects** (confirmed in code + findings doc; routed to 094/095):
- **S1** duplicate final answer in chat (UI re-render; DB has exactly 1 assistant row) → **095**.
- **S2** ghost empty avatar bubbles for fan-out sub-agents (`MessageItem.tsx:268-284` empty body) → **094**.
- **S5** harness panel shows "No workspace activity yet" the whole run (`PanelEmpty.tsx:18`; no harness live-execution surface yet) → **094 / D-094-UNIFY**.

If something appears that is **not** S1/S2/S5 and **not** on the roadmap → flag as a NEW candidate for the right future phase; do not force-fix in 093.

---

## 3. Shared UI driver steps (every cell)

Always `take_snapshot` first for fresh uids; match on the stable anchors below.

1. **New Chat** (two-click gotcha): click `title="New Chat"` (NavPanel). `wait_for` the thread to switch; if not, click again. Scope to the **DBA** folder so `search_documents` hits the dissertation.
2. **Harness mode**: click `data-testid="workflow-mode-selector"` → click **"Harness"**.
3. **Workflow**: click `data-testid="workflow-picker"` → click `data-testid="workflow-option-<slug>"`.
   - `research_summarize` → "Research -> Summarize" · `plan_execute_verify` → "Plan -> Execute -> Verify" · `literature_review` → "Literature review" · `doc_qa_human` → "Doc Q&A".
4. **Provider + Model**: click the provider button (Layers icon, left of `agent-mode-selector`) → pick provider; then the model button (Cpu icon) → pick the model. **Provider first, then model** (model list depends on provider).
5. **Prompt + Send**: click the textarea (`placeholder="Ask anything…"`), `type_text` the prompt (real keystrokes drive `onChange`); if needed nudge with `press_key End` then `Space`. Confirm `composer-send` is enabled, then click it (or `Enter`). `composer-stop` appearing = run started.
6. **Watch + screenshot** kickoff → mid-stream → final answer. Open the panel (`Expand workspace`) — expect empty for harness (S5).

---

## 4. Dimension 1 — the 8-cell native-7 rotation (run per-workflow)

Each row pairs a **fixed** provider (confirm the gap-closure landed) with a **control** (confirm no regression).
Expected per-provider model in parentheses (from the registry defaults; confirm in the picker live).

### Workflow A — research_summarize  (`…b1`)
Kickoff prompt (both cells):
> *What are the critical success factors for RPA adoption identified in the dissertation, and what survey evidence (sample size, key statistics) supports them? Search the knowledge base and write a cited summary.*

| Cell | Provider (model) | Target | Cell-specific pass criteria |
|---|---|---|---|
| **1** | **Google** (gemini-3.5-flash) | 093-07 thought_signature | `runs` row completed, **no `400 thought_signature`** (vs before-anchor 2f54f88e), tokens non-NULL, grounded summary cites dissertation. |
| **2** | OpenAI (gpt-5.4-mini) | control | completed, grounded, no regression. |

### Workflow B — plan_execute_verify  (`…b2`)  ← also the **Dim-2 multi-tool** axis
Kickoff prompt (both cells — forces `search_documents` **AND** `execute_code`):
> *Find the survey sample size and a numeric table (respondent demographics or the RPA-adoption / digital-maturity score distribution) in the dissertation, then use Python to compute summary statistics (mean, standard deviation, counts/percentages) and render a bar chart of that distribution. Plan it, execute it, and verify the chart matches the numbers in the document.*

| Cell | Provider (model) | Target | Cell-specific pass criteria |
|---|---|---|---|
| **3** | **Moonshot** (kimi-k2.6) | 093-07 reasoning_content + multi-tool | completed, **no `400 reasoning_content`**, execute phase fires BOTH search_documents + execute_code, tokens non-NULL. |
| **4** | Anthropic (claude-haiku-4-5) | control + multi-tool | completed, both tools fire, grounds on **N=309** (Dim-5 — flag if it invents N=165 / "figures you provided"). |

### Workflow C — literature_review  (`…b3`)
**Cell 5 prompt — RE-RUN THE GLM DIAGNOSIS PROMPT VERBATIM** (proves 093-09):
> *Write a literature review covering these themes from the dissertation: RPA integration challenges; critical success factors for RPA adoption; and digital maturity as a predictor of success.*

(Cell 6 uses the same prompt for a clean comparison.)

| Cell | Provider (model) | Target | Cell-specific pass criteria |
|---|---|---|---|
| **5** | **GLM/zhipu** (glm-4.6) | 093-09 max_steps | split → 3 sub_questions; **NO "reached max_steps" placeholder** in any "Result N"; sub-agent `runs` show real output tokens (not the `…/210` looper pattern); merged review integrates 3 distinct subtopics. |
| **6** | DeepSeek (deepseek-v4-pro→flash subs) | control | N=3 fan-out completes, merged review integrates distinct subtopics. |

### Workflow D — doc_qa_human  (`…b4`)  ← the **ask_user round-trip**
Kickoff prompt (both cells):
> *Based on the dissertation, what are the research questions and objectives, and how do they relate to each other? Use the knowledge base.*

Correction to submit at the interrupt (choose **"Needs changes"**, free-text via `type_text` into `#ask-<tool_call_id>-free` — NOT fill):
> *Correction: there are exactly 4 research questions RQ1–RQ4, and they map to 6 objectives O1–O6. Make sure the final answer states exactly 4 research questions (not 6) and shows the RQ→objective mapping explicitly.*

| Cell | Provider (model) | Target | Cell-specific pass criteria |
|---|---|---|---|
| **7** | MiniMax (MiniMax-M2.x) | ask_user round-trip | draft → PendingAskCard renders → submit answer → card flips green "Answered · agent resumed" → finalize completes. |
| **8** | **Google** (gemini-3.5-flash) | 2nd reasoning provider + ask_user | same round-trip on a reasoning provider; finalize **incorporates the correction** (exactly 4 RQs + RQ→O mapping — Dim-5). |

---

## 5. Dimension 2 — 4-axis bandwidth (SC#10)

- **Cross-provider** — covered by the 8 cells (all native-7; Google ×2).
- **Multi-tool** — Cells 3 & 4 (search_documents + execute_code in the execute phase). Confirm via `messages.tool_calls[].name` containing both + a code-exec run.
- **Parallel-thread** — during Cell 5 (Thread A = GLM literature_review streaming), open Thread B and kick off a research_summarize. **Observe:** A keeps streaming (no global `isStreaming` lockout — the 075.3 regression), B starts its own run, A↔B switch reconciles via `GET /threads/{id}/workflow`, no event bleed.
- **Long-message** — one dedicated row: paste a ≥5 KB kickoff prompt (e.g. a long multi-part research brief) into a research_summarize kickoff. **Observe:** run starts, kickoff persists in `workflow_runs.inputs`, agent acts on the full question.

---

## 6. Dimension 3 — durability (operator drives uvicorn kill/restart)

Resume mechanism: `resume_stranded_workflows` (harness_engine.py:1008), startup hook (main.py:238-250), log line `Harness resume sweep re-ran %d stranded run(s)`. Continue: `POST /runs/{id}/continue` (runs.py:667).

| Row | Procedure | Observe |
|---|---|---|
| **A resume** | kick a multi-phase workflow to a mid-phase `active` state → **operator kills + restarts uvicorn** | resume sweep re-claims (CAS, single-producer), re-drives; refresh thread → run resumes; no stranded `streaming` row. |
| **B resume-mid-ask_user** | doc_qa_human paused at confirm (unanswered) → **kill + restart** | sweep re-emits the prompt (subscribe-before-emit); PendingAskCard reappears; submit → completes. |
| **C Continue at cap** | drive a run to `cap_paused` → click Continue | `continues_used` increments (durable), re-drives in fresh budget; 4th Continue refused (`max_continues_per_run=3`). |
| **D reload** | `cap_paused` + Continue visible → hard-reload → click Continue | Facet-C fallback resolves the WORKFLOW_RUN id as `workflow_runs.id` (owner+anchor), no 404; state reconciled via `GET /threads/{id}/workflow`. |

---

## 7. Dimension 4 — Deep-parity regression + WR-01 sign-off

```powershell
# Deep SSE skeleton-diff (BEFORE was captured Jun 1 in scripts\.sse_baseline\)
backend\venv\Scripts\python.exe scripts\capture_sse_baseline.py --mode after
#   GATE: SSE_DIFF_RESULT: PASS. Anthropic = 0 skeleton edits (byte-identical twin).
#   Other native-7 edits allowed ONLY if flaky across run1-vs-run2 (re-run 2-3x), never persistent.

# eval factual-doc-search floor — must be 7/7 on native-7 (the hard floor)
backend\venv\Scripts\python.exe scripts\eval_cross_provider.py --prompt factual-doc-search
#   plus the Deep task() sub-agent non-regression cell:
backend\venv\Scripts\python.exe scripts\eval_cross_provider.py --provider anthropic --prompt task
```
- **WR-01 sign-off** (operator): 093-08 makes Deep `task()` honor a user-set `sub_agent_model` — a deliberate, more-correct behavior change. Confirm a Deep `task` cell shows the honored model and no semantic regression; **record acceptance**.
- Note: the file-level RED LINE (agent_loop.py + sub_agent_service.py ZERO-diff) is already verified; this proves the *semantic* Deep path (esp. CR-01 Anthropic system-prompt round-trip) didn't regress.

---

## 8. Dimension 5 — result-quality (operator pass/fail per cell)

For each workflow (sampled ≥2 providers incl. ≥1 OpenAI-compat native), operator judges:
- **research_summarize** — grounded + cited; does NOT ask the user to share research (065 anti-delegation prompt). Cites N=309.
- **plan_execute_verify** — answer reflects the actually-executed result; numbers grounded in the doc (N=309, not 165; no "figures you provided"). *(Known residual → SEED-050/096.)*
- **literature_review** — merge integrates DISTINCT subtopics; does not re-ask for them.
- **doc_qa_human** — finalize incorporates the correction (exactly 4 RQ1–RQ4 + RQ→O mapping); does not restart. *(Known residual → SEED-050/096.)*

---

## 9. Dimensions 10 & 11 — data check + STRUCTURED-recovery split

- **WR-02 / IN-03 (available_models data check):** `user_settings` is empty → provider defaults are used → confirm each cell's `runs.model` is the legit per-provider default (the D-06 fallback didn't replace a real model); confirm `gemini-3.5-flash` is Google's default.
- **STRUCTURED-recovery split (Landmine 4):** (a) the 4 compat-natives (DeepSeek/Moonshot/GLM/MiniMax) fire `search_documents` via **NATIVE** mode (covered by the cells — grounding proves it). (b) the registry-MISSING / `native_tools:false` STRUCTURED safety-net is **code-verified only** (UI doesn't expose a mis-cased model id) — note as operator/edge-config follow-up, not blocking.

---

## 10. Close criteria

On a clean sweep across Dimensions 1–11 (UI-only S1/S2/S5 noted, not failing):
1. Fill `093-HUMAN-UAT.md` Re-UAT section with per-cell evidence (workflow_run id, runs models+tokens, log-delta, screenshots).
2. Flip **PARITY-02 → Validated** in REQUIREMENTS.md.
3. Flip phase **093 → passed** (status update + `093-HUMAN-UAT.md` frontmatter `status: passed`, `reuat_pending: false`).
4. Route forward to Phase 094 (sketch-first, G-2) — which fixes S1/S2/S5 by construction.
