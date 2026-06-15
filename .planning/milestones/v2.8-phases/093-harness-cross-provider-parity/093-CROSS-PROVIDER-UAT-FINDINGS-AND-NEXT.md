# Phase 093 — Cross-Provider LIVE UAT: Findings, Decisions & Next Steps (handoff)

**Date:** 2026-06-02 · **Driver:** Claude (Chrome-MCP live UAT + cross-cutting evidence) + operator report
**Why this doc:** consolidate a long session (verify-work 093 → cross-provider UAT → operator report cross-check → execution-surface decision) into clean ground to continue in a fresh context.

---

## 1. Status

- Phase 093 is **code-complete (28/28 must-haves)**; LIVE UAT now run across **all native-7 + Deep**.
- Phase stays **human_needed / partial** — real gaps found (below). Do NOT flip PARITY-02 to Validated.
- UAT tracker: `093-HUMAN-UAT.md` (committed: `253a17d2`, `80e4a9c5`).

## 2. Cross-cutting evidence method (ALL working — reuse next session)

| Source | How |
|--------|-----|
| **Supabase (DB truth)** | backend venv + `supabase-py` reading `backend/.env` (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`). PostgREST `.select()` on `runs`, `workflow_runs`, `messages`, `workflow_definitions`, `folders`. (helper was `C:/Users/fhdmr/AppData/Local/Temp/uat093_db.py` — recreate if cleared. No psql, no docker access.) |
| **LangSmith (traces)** | SDK reachable, project `agentic-rag-module2`, tracing on. **Has token usage even when DB `runs.usage` is NULL** — key for S4. `Client().list_runs(project_name=...)`. |
| **Chrome DevTools MCP** | drives UI at `http://localhost:5173/` (login fhdmrd@gmail.com / 123456). Note: React composer needs an End+Space keystroke nudge after `fill` to enable Send; the panel answer box needs real `type_text` (fill resets it). "New Chat" needs **two** clicks. |
| **Backend logs** | operator's uvicorn terminal (agent CANNOT see it live; rely on `runs.error` + LangSmith, or add a file log sink). |

**Definition IDs:** `…b1`=research_summarize · `…b2`=plan_execute_verify · `…b3`=literature_review · `…b4`=doc_qa_human. **KB:** folder **DBA** = "Fahed Mrad Chapters 1-4" dissertation (441+402 chunks).

## 3. Cross-provider matrix — harness tool-using workflow (multi-turn tool use)

| Provider | Verdict | Evidence |
|----------|---------|----------|
| OpenAI | ✅ PASS | grounded, verify-gate forward, ask_user F10 200 |
| Anthropic | ✅ PASS | 48 sources, CR-01 confirmed, Deep 8-tool loop intact |
| DeepSeek | ✅ PASS | research + lit-review N=3 fan-out (96 src), NATIVE tool fire |
| MiniMax | ✅ PASS | 35 sources, NATIVE tool fire |
| **Google** | 🔴 FAIL | `400 thought_signature missing in functionCall parts ... position 2` |
| **Moonshot** | 🔴 FAIL | `400 thinking enabled but reasoning_content missing ... index 2` |
| **GLM/zhipu** | 🟡 PARTIAL | native tool fire works (36 src) but sub-agent **max_steps without final answer** |

## 4. The gaps

### 4a. Provider round-trip (Google + Moonshot) — ONE root cause, ONE additive fix
The harness/`task_service` sub-agent iteration consumer **ignores the gateway `finish` event** (`task_service.py:299-300`, comment: *"finish ignored — sub-agent return needs no … thought_signature round-trip (A1)"*). Reasoning-model providers REQUIRE per-turn reasoning metadata echoed back on the next assistant tool-call: Gemini → `thought_signature`; Moonshot/Kimi(thinking) → `reasoning_content`. **Deep** (`agent_loop.py` `_on_chunk` finish-branch) hydrates BOTH (adapters `google.py`/`openai_compat.py` already EMIT them); **harness** drops them. Fix = mirror Deep in the harness consumer; provider-scoped + additive; must NOT touch the 4 passing providers or the Deep byte-identical path. `reasoning_content` is not referenced in `task_service.py` at all.

### 4b. GLM/zhipu max_steps — separate, root cause UNCONFIRMED
Sub-agent (glm-4.6) loops to max_steps without a terminal answer (no 400). Diagnose: tool-loop behavior vs step-cap vs a softer reasoning-handling manifestation.

## 5. SHARED (provider-independent) issues — fix-first, highest leverage

| # | Issue | Layer | Evidence |
|---|-------|-------|----------|
| **S1** | Duplicate final answer in UI (**all providers incl. Anthropic**) | Frontend stream render | DB has exactly **1** assistant msg per thread; UI showed 2 → it's a re-render, NOT a double-save (data clean) |
| **S2** | Fan-out sub-agents render as **ghost empty avatar bubbles** in chat; no Run-Card for harness | Frontend render | imgs show 3-4 stacked empty avatars; DB confirms 3 sub-agent runs |
| **S3** | Sub-agent model defaults to **`gpt-4o`** → resolver falls back to provider default every call | Backend config | log `sub_agent_model='gpt-4o' is not in … falling back`; subs ran on `…-flash`/`…-haiku`, never the selected model. 093 resolver fix IS working (prevents cross-provider call); the gpt-4o DEFAULT is the root |
| **S4** | Token usage never persisted (`runs.usage missing`) | Backend telemetry | DB `input_tokens`/`output_tokens` = NULL on every run; **LangSmith HAS them** → persistence gap in harness path |
| **S5** | No workflow live-execution surface (= the design work below) | Frontend UX | panel said "No workspace activity yet" through every run |

## 6. Decisions locked this session

- **D-092-UX reconfirmed** (operator-approved, 2026-05-31): workflow execution → **workspace panel** timeline (**Phase 094**, not started); workflow **start** moves out of composer → panel; composer simplifies to **`[ Model ▾ ] [ General/Explorer ▾ ]`**. NOT a separate `/route` (would fight the shared SSE/anchor/lock architecture from 068/075.x).
- **NEW — UNIFY (D-094-UNIFY, operator-SIGNED-OFF 2026-06-02 → Phase 094 scope expansion):** the workspace panel becomes the **SINGLE live-execution surface for BOTH Deep AND Harness**. Deep's agent-loop steps + tool calls move OUT of the chat into the panel too (**deliberately reverses sketch-001's in-chat Run-Card for Deep**). Chat keeps only prompt + final answer + a quiet "ran in workspace ▸" pointer. This is the correct fix for **S2 across all modes**.
- **Separate SURFACE (panel), thread-bound — NOT a separate route.** Confirmed.
- **Testing approach (operator, 2026-06-02):** run UAT **per-workflow** (one workflow × providers at a time), not all workflows at once — cleaner.

## 7. Phase mapping (STRUCTURED — every finding maps to an EXISTING roadmap phase; NO new parallel track)

The roadmap order **093 → 094 → 095 → 096** already covers all of this. Do not create a separate "fixes" track.

| Finding | Home phase | Why (roadmap text) |
|---------|-----------|--------------------|
| Provider round-trip (Google `thought_signature` + Moonshot `reasoning_content`) · GLM max_steps · **S3** gpt-4o sub-agent default · **S4** token usage missing | **093 gap-closure** (new 093-06+ plans, or 093.x) | 093 = "first-class, provider-agnostic, robust backend surface; all 5 phase-types + 4 workflows on native-7" = PARITY-02. These are the backend gaps that keep 093 from closing. |
| **S2** ghost avatars / RunCard-for-harness · **S5** panel execution surface / phase timeline · mode clarity + composer simplification (D-092-UX) | **094** (Workflow Legibility + Mode Clarity) | 094 verbatim: "Live phase-timeline + RunCard-for-harness in the panel … mode disambiguation (D-092-UX)". Sketch-first (G-2). |
| **UNIFY Deep+Harness into the panel** (NEW operator decision 2026-06-02) | **094 scope EXPANSION** (not a new phase) | 094 already owns the panel exec surface; unifying Deep into it expands 094. Reverses sketch-001 in-chat run-card for Deep — record as a 094 scope note. |
| **S1** duplicate final answer (UI re-render) · multi-stream-subscription root | **095** (Chat Tool-Card Unification — "no duplicates") and/or **096 CONC-01** (frontend stream saturation, BUG-260530-01) | 095 owns "no duplicates"; may also dissolve in 094's chat rework. Track explicitly so it isn't lost. |
| **Automated cross-cutting UAT (per-workflow)** + the assertion set | **096** (Eval Harness + Cross-Provider Verification) | 096 verbatim: "SEED-034 eval CI gate, 4-axis + restart-mid-workflow UAT". The automated UAT IS 096's mandate. |

### Sequenced plan (respects roadmap deps + "fix-first" + "per-workflow testing")

1. **Finish 093 first — gap-closure (backend, blocks the milestone):** provider round-trip fix (one additive change unblocks Google+Moonshot), diagnose+fix GLM max_steps, S3 (gpt-4o sub-agent default), S4 (token persistence). Re-run the per-workflow LIVE UAT cross-check (DB+LangSmith) to confirm. → PARITY-02 closes.
2. **Phase 094 (sketch-first, G-2):** the unified panel execution surface (Deep+Harness) + mode clarity + composer (D-092-UX). S2/S5 fixed HERE (render in panel; ghost avatars gone by construction). Multi-variant sketch; baseline = `sketch-findings-agentic-rag`.
3. **Phase 095 (sketch-first):** chat tool-card unification incl. S1 duplicate (if not already dissolved by 094's chat rework).
4. **Phase 096:** the automated cross-cutting UAT harness — **per-workflow** (one workflow × providers at a time, operator's structure). Drive Chrome → cross-match Supabase + LangSmith + logs → assertions **A1** single-answer/no-dup · **A2** no ghost avatars · **A3** grounded (UI sources ∧ DB source_refs ∧ LangSmith search_documents) · **A4** correct models (not gpt-4o) · **A5** tokens present · **A6** real deliverable (not narrated error) · **A7** tool round-trip ok · **A8** confidence + anti-delegation · **A9** optional LLM-judge. Architecture: drive sequentially (one browser) → fan-out workflow agents to cross-check threads in parallel → scoreboard. CONC-01 (multi-stream saturation) lands here too.

**✅ SIGNED OFF (operator, 2026-06-02) — D-094-UNIFY:** "unify Deep+Harness into the panel" is an ACCEPTED Phase 094 scope expansion (deliberately reverses the sketch-001 in-chat Run-Card for Deep). Recorded in `ROADMAP.md` Phase 094 entry. No longer an open question.

## 8. Operator's report (`screenshots/Workflow test.docx`) — cross-checked & confirmed

Operator tested Literature Review on DeepSeek-v4-pro, DeepSeek-v4-flash, Anthropic-sonnet-4-6. Their backend logs surfaced S3 (`gpt-4o` fallback) and S4 (`runs.usage missing`); their screenshots surfaced S1 (duplicate) and S2 (ghost avatars). DB cross-check (threads f4990f15, 1cf88e93, ec2a4f69) confirmed: 1 persisted message each (S1 = UI-only), NULL tokens (S4), subs on flash/haiku via gpt-4o fallback (S3). Strong reporting method — backend logs + screenshots + quality judgment per cell.

---

## 9. Testing strategy — when, who, and the operator manual-test rotation

**Three test gates (testing is continuous, not one big event at the end):**

1. **Post-093-gap-closure — backend re-verify.** The moment the provider round-trip + S3/S4 + GLM fixes land, re-run the *previously-broken* cells to confirm: Google + Moonshot now COMPLETE, GLM converges (no max_steps dead-end), sub-agents use the correct per-provider model (not gpt-4o), `runs.usage` tokens recorded — plus non-regression on the 4 already-passing providers. **Backend-truth** focus (DB + LangSmith). UI will still be messy (ghost avatars S2 / duplicate S1) — expected; that's 094/095.
2. **Post-094/095 — experience re-verify.** Once execution moves to the panel and duplicates are gone, test the *felt* experience (clean panel timeline, no dup, legibility). **Operator lived-experience judgment essential** here (Chrome-MCP misses "feels broken").
3. **Phase 096 — automated, formalized.** The per-workflow cross-cutting harness becomes the standing regression backstop (assertions A1–A9, scoreboard).

**Division of labor (do NOT duplicate):**
- **Operator manual pass provides what only it can:** the **backend logs** (operator's uvicorn terminal — how S3/S4 surfaced; the agent cannot see it live) and the **lived-experience / quality judgment** (academic-grade? duplicate appeared minutes later? panel reads clearly?).
- **Agent automates breadth:** drive cells in Chrome → cross-match **DB + LangSmith + UI** vs A1–A9 → scoreboard (this is 096).
- ⇒ Operator does NOT need to run all 7×4 manually; the 2×2-per-workflow human spot-check + agent automated breadth = full coverage.

**Operator manual-test rotation (per-workflow · 2 providers · shared DBA doc).** Pair one **fixed** provider (confirm the fix lived) with one **known-good control** (confirm no regression); rotate so all native-7 are covered across the 4 workflows. Prefer two **different providers** over two models of the same provider (parity signal is in crossing providers). Keep the **same shared document (DBA dissertation)** so quality is directly comparable. Same prompt style as the literature_review report (final-quality + source count + confidence + anomalies + the exact prompt + screenshots + **backend log slice**).

| Workflow | Provider A (was broken → confirm fixed) | Provider B (known-good control) |
|----------|------------------------------------------|----------------------------------|
| research_summarize | **Google** (gemini — thought_signature) | OpenAI |
| plan_execute_verify | **Moonshot** (kimi — reasoning_content) | Anthropic |
| literature_review | **GLM/zhipu** (max_steps) | DeepSeek |
| doc_qa_human | MiniMax | (2nd reasoning provider, e.g. Google) |

→ covers all 7, every run pairs a fix with a control, each workflow tested with 2 providers, clean 2-cell comparison. Time these passes **after each fix gate** (not on the current broken state — already mapped).

**Enabler — backend log sink (small task in 093 or 096).** The only thing keeping the automated UAT from being fully self-sufficient is live backend-log access (the agent can't see the operator's terminal). Add a **file log sink** (uvicorn → a logfile) so the 096 harness can scan for `gpt-4o` fallback / `runs.usage missing` / `400` round-trip signals itself — then operator manual runs become a *quality/felt* spot-check rather than a *log-gathering* chore.
