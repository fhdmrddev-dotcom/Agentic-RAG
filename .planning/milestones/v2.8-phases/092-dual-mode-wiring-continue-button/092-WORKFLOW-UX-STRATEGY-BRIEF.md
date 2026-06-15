# Workflow & Composer UX Strategy Brief

**For:** Operator (vibe coder)
**Date:** 2026-05-31
**Context:** v2.8 Harness Engine & Workflow Mode, mid-Phase 092
**Drives two decisions:** (1) the chat composer has up to 5 controls and feels overloaded/conflict-prone; (2) how users should BUILD workflows and how we beat competitors realistically given our app.

---

## 1. TL;DR

- **Composer:** Converge on a steady-state of **two pills — `[ Model ▾ ]` and `[ General/Explorer ▾ ]`**. Fold Provider INTO Model (one grouped dropdown), and **move workflow start OUT of the composer** into the Phase 087 workspace panel as an explicit "Run workflow" action. This is the clean fix because Deep/Harness and General/Explorer are *orthogonal axes* (a 2×2), not four sibling modes — and rendering them as identical adjacent pills is exactly what confuses people.
- **Workflows are a mode OF a thread, not a separate page.** They share the thread's SSE run buffer, anchor, and lock. A dedicated `/workflows` route would fight the architecture we spent the 068/075.x phases stabilizing. Keep them thread-bound; just change *where you start them* (panel, not composer).
- **Workflow authoring:** Do NOT build a visual drag-and-drop canvas. The 2025–26 evidence is clear that the visual-builder middle is being squeezed dead from both ends. Our differentiated form is **NL-describe → strict-parse → edit-as-form → lint-on-publish**, because we are *roughly one thin router away* from safe user-published workflows — validation, structural lint, immutable versioning, and RLS all already shipped (Phase 091).
- **Differentiation thesis:** No competitor combines **KB-grounded phases + sandboxed code phases + persistent skills + NL-to-validated-WorkflowDefinition over our own provider layer + gates/human-input**. Our strict Pydantic schema + reachability lint make LLM-authored workflows *safe by construction* — the model literally cannot emit a runnable-but-broken graph. That is the unfair advantage.
- **Phase 092 sequencing:** **F1 is a pure correctness blocker — fix it regardless of any UX decision.** Close F1/F2/F3 (lock-UX) as-is FIRST so a workflow can actually run end-to-end, THEN re-scope the composer consolidation + authoring as NEW phases. You cannot validate composer changes against lock states that don't yet work.
- **Next step:** `/gsd:sketch` the composer consolidation (G-2 sketch-before-plan fires — this is live-UI/panel work), and `/gsd:explore` the authoring direction, BEFORE any plan-phase.

---

## 2. Problem 1 — Composer overload

### The real conflict/confusion

The composer (`MessageInput.tsx`) renders up to **five controls** in one flat row of identical pills: Provider, Model, General/Explorer (`agent_mode`), Deep/Harness (`workflow_mode`), and the workflow picker. The crowding is a *flattened hierarchy* — three different change cadences forced into one row:

- **Persistent / rarely changed:** Provider + Model (set once, live in settings). Yet they're the widest, leftmost pills.
- **Per-message intent:** General/Explorer + Deep/Harness (legitimately vary turn-to-turn).
- **Run-scoped commitment:** the workflow picker (the *most consequential* control — it kicks off a state-machine run — but presented as the smallest, most ephemeral pill, and it appears/disappears).

**The core confusion is an orthogonality the UI hides.** Per the locked decision (STATE.md L129, the v2.8 mode-axis clarification): **"Deep Mode" = `active_workflow_run_id IS NULL`, an umbrella over BOTH General AND Explorer.** So Deep/Harness ⊥ General/Explorer — they are two *independent* axes, a 2×2 of {General, Explorer} × {Deep, Harness}. But the UI renders them as two adjacent, identical-looking pills, so a reasonable user reads **four mutually-exclusive modes** (General / Explorer / Deep / Harness). This is the exact "where does this lever live / two controls that feel like the same thing" anti-pattern that left ChatGPT "as complicated as ever" even after consolidation.

Secondary tells: the picker mount/unmount makes the row **jump from 4→5 controls** (breaks the calm-instrument promise), Provider and the picker **both use the `Layers` icon** (two different things look the same), and — critically — **the F3 bug means a locked thread still shows General/Explorer + Deep/Harness as clickable** (`modeSelDisabled:false`), inviting the very conflict you fear.

### Consolidation options

**Option A — Fold Provider into Model (one grouped pill)**
```
[ ⚙ Anthropic · claude-… ▾ ]   [ General/Explorer ▾ ]   [ Deep/Harness ▾ ]   …
```
One dropdown; trigger shows the active model, menu groups by provider (cascade happens inside). Matches the industry router pattern (Cursor/Copilot/ChatGPT front a single model entry; provider is an implementation detail).
- **Pros:** removes the most-persistent-least-touched pill with zero backend change; `MODEL_INFO` metadata already makes a grouped menu natural; takes the row 5→4.
- **Cons:** trigger label gets long; grouped menu is taller.
- **Effort:** **S** (~half day, one component).

**Option B — Command palette for the mode/workflow axes**
```
[ ⌘K  General · Deep ]   ← one pill opens a palette for all axes + workflows
```
- **Pros:** collapses 3 pills into one; on-brand (Raycast reference in our sketch skill); great for power users; "/" palette also makes workflows *discoverable by browsing*.
- **Cons:** hides the *frequent* General↔Explorer toggle behind a click; net-new component; discoverability cost for vibe-coder users.
- **Effort:** **M** (1–2 days).

**Option C — Move workflow start OUT of the composer into the Phase 087 panel**
```
Composer:  [ Model ▾ ]  [ General/Explorer ▾ ]          ← Deep only, always 2 pills
Panel:     [ + Run workflow ]  → picks + kicks off, panel owns lock/Continue/cap
```
The Deep/Harness toggle and picker leave the composer; starting a workflow becomes an explicit, run-scoped action in the panel that *already* owns run state, todos, files, the `ask_user` interrupt, and the amber "needs-you" color language. This mirrors the universal **authoring-vs-running separation** (Lindy/Manus/Gems/Projects all push config out of the live composer).
- **Pros:** restores a stable 2-pill composer (no width jump); aligns with the *truth* that a workflow is a run commitment, not a message option; **shrinks the lock-UX surface** — the composer only has to gate textarea/Send during a run, not disable two extra pills.
- **Cons:** biggest conceptual move; needs the panel "Run workflow" entry; the current "send a message that also kicks off a workflow" (`kickoffWorkflowId`-on-send) must be decoupled.
- **Effort:** **M–L** (2–3 days; touches `ChatArea`, the panel, kickoff wiring). **G-2 sketch-before-plan fires.**

**Option D — Progressive disclosure (advanced behind a gear) — FALLBACK**
```
[ ⚙ ]  [ General/Explorer ▾ ]  [ Deep/Harness ▾ ]  …   ← provider+model behind gear
```
- **Pros:** smallest footprint; keeps the frequent intent toggles visible.
- **Cons:** model is sometimes changed per-message (cost/capability), so burying it has a cost; a gear next to chat reads as *global* settings, not per-thread config.
- **Effort:** **S** (~half day).

### Recommendation

**Ship A now; pursue C as the structural fix; hold D as the fallback if C slips. Do NOT do a separate `/workflows` route.**

1. **A immediately (S, zero backend):** collapse Provider+Model into one grouped pill. Takes the row to 4 controls and frees horizontal room with no conceptual disruption.
2. **C is the real answer to the *conflict* worry:** promote workflow start to the panel. The composer converges on the two genuine per-message axes — **`[ Model ▾ ] [ General/Explorer ▾ ]`** — the orthogonal axes stop masquerading as confusable siblings, the 4↔5 width jump disappears, and the lock-UX footprint shrinks.
3. **Workflows belong in-thread, NOT on a dedicated page.** A workflow *runs inside a thread* (shared `run:{run_id}` SSE, thread anchor, lock). A hard route split fights the architecture and re-introduces the reconciliation complexity 068/075.x eliminated. Change *where you start* a workflow (panel), not *where it lives* (the thread).

Optionally layer B's "/" palette later purely for workflow *discovery* — but keep General↔Explorer a visible pill, not buried, since it's a frequent toggle.

---

## 3. Problem 2 — Workflow building

### How competitors let users build (one line each)

- **Zapier:** linear trigger→action form; fast but weak branching.
- **Make / n8n / LangFlow / Sim / Flowise / Dify:** visual node canvas — powerful, but blank-canvas paralysis and doesn't scale past a few branches.
- **Gumloop (Gummie) / Sim / n8n:** "describe it → AI drafts the flow" NL-to-flow generation — the strongest 2025 entry pattern.
- **Lindy / Gems / Custom GPTs / Projects:** template-fork + a dedicated build surface separate from the running chat.
- **LangGraph / CrewAI / OpenAI Agents SDK:** code-first graph/role definitions — maximal control, 1–2 week curve.

### Best-practice essentials

- **Templates as the default start, never a blank canvas** (find ~80% match, customize).
- **NL entry to draft the flow** — but the draft must be *editable + inspectable*, not a black box.
- **Validation/guardrails + human-in-the-loop baked in.**
- **Test/preview before commit** (Dify's per-node debugger is the cited gold standard).
- **Versioning / publish / rollback** is table-stakes for production iteration.
- **Readable, portable definitions** (JSON) for evaluate-before-import and forking.

### Strategic framing (the load-bearing insight)

Visual builders are **being squeezed from both ends**: modern LLMs handle simple logic conversationally (no canvas needed), and AI-assisted coding lets non-engineers co-write real code for the hard cases — leaving the canvas "too constrained for engineers and too complex for non-coders." **Do not build a generic visual canvas.** It is the churning middle.

### Recommended authoring approach for US (phased)

Our substrate is *already* the back half of a builder. The strict, typed definition schema (`WorkflowDefinition` → `PhaseSpec[]` → discriminated-union `PhaseConfig` over the 5 phase types, every model `extra="forbid"`) **IS the input-validation layer** — `WorkflowDefinition.model_validate(json)` is the security boundary, already written (threat T-090-01). The pure reachability lint (`lint_workflow`) already catches the four structural break-modes and was *written for a publish endpoint that was deferred to 092*. Immutable-on-publish versioning, `UNIQUE(slug,version)`, and owner/global RLS all shipped (migrations 056/061/062). The executor already consumes exactly this format (Phase 091, 95/95 tests green). **The only gap is the author-facing front half.**

- **Phase A — Authoring API (small, ~1 router).** Wire three routes onto the existing validator + lint + immutable trigger + RLS:
  - `POST /workflows` → insert `status='draft'`, `is_global=false` forced server-side.
  - `PUT /workflows/{id}` → allowed only while draft (surface a clean 409, the trigger already refuses published edits).
  - `POST /workflows/{id}/publish` → run `model_validate` then `lint_workflow`; refuse with structured field-level errors if non-empty, else flip to `published`. Versioning is free (publish a new version, never mutate). **No new validation logic, no schema change.**
- **Phase B — NL-to-draft generation.** `generate_workflow_definition(nl_description)` using our existing Pydantic-structured-output layer (no LangChain) with `WorkflowDefinition` as the response schema. `extra="forbid"` rejects hallucinated fields; `lint_workflow` rejects unreachable graphs. Output is always a **draft** (never auto-published). Gate generation quality with the SEED-034 cross-provider eval harness.
- **Phase C — Guided form editor over `PhaseSpec`.** One phase = one card: pick `phase_type` → reveal that variant's fields (the discriminated union *is* the form schema, so the form can be generated from the Pydantic model rather than hand-built); whitelist = a multiselect of registered tool names; validators = a small kind+config sub-form. Publish calls Phase A and renders lint errors inline. **G-2 fires → sketch first.**
- **Phase D (later, optional) — light read-mostly DAG view.** Phases as nodes, sequential + `skip_to_phase` edges (the exact graph `reachability.py` already builds) for visualization/reorder. The *only* piece that's real new frontend cost — defer until telemetry proves authoring demand, same "lock on real usage" rationale that deferred the Plugin Contract to v2.9.

**Honest constraints:** `programmatic` phases reference server-defined Python fns (`PROGRAMMATIC_PHASE_REGISTRY`) — a user builder exposes only the *registered* fns as a dropdown (no arbitrary code authoring); that registry is the seam the v2.9 Plugin Contract will formalize, so treat it as a curated-list field now. Authoring is **orthogonal to the rest of v2.8** (092–096) — it shares the `workflow_definitions` table but touches no hot files. **Recommendation: ship Phase A (API only) as a small late-v2.8 enabler** so the dual-mode picker shows user-authored workflows, not just the 4 seeds; carry **B/C/D into v2.9** alongside the plugin contract.

---

## 4. Differentiation — what we can offer that they can't

Grounded in our actual primitives, honestly:

- **KB-grounded phases out of the box.** `llm_agent`/`llm_batch_agents` take a tool whitelist; `search_documents`, `grep`, `read`, `query_tables`, `ls/tree/glob` are already registered. A "Literature review" or "Doc Q&A" workflow runs *inside the user's own RLS-scoped corpus* with citations and confidence (seeds `literature_review`, `doc_qa_human`) — not a connector bolt-on. **This is the direct Glean differentiator:** the workflow runs in the knowledge base, not over an external index.
- **Sandboxed code as a workflow step.** `execute_code` in a phase whitelist (seed `plan_execute_verify`) runs real Python (matplotlib/pandas/reportlab already in `Dockerfile.sandbox`) deterministically, gated and auditable. This **collapses the squeezed middle** — visual tools bolt Python on awkwardly; here code is native, so the hard 20% stays conversational instead of forcing a canvas.
- **NL-to-validated-WorkflowDefinition over our own LLM layer.** Highest-leverage and architecturally trivial for us: the strict model is the response schema, `extra="forbid"` kills hallucinated fields, `lint_workflow` kills unreachable graphs. The model **cannot emit a runnable-but-broken workflow** — safe by construction. RAG-on-your-own-KB is also the cited mitigation for NL-to-workflow hallucination, and *no competitor grounds the builder itself in the user's KB.*
- **Persistent, shareable skills as living workflows.** Skills already persist and inject into the General-mode prompt. A published workflow becomes a shareable artifact alongside skills (same RLS pattern as the `skills` table, migration 017) — "teach the agent a repeatable procedure once → it persists, versioned and immutable, for the org to run." Authoring by demonstration, not by dragging nodes — dodging blank-canvas paralysis, false-low-code, and visual-scaling collapse simultaneously.
- **Reliability + inspectability without a canvas.** Cascading multi-step failure (even 85%/step → ~20% over 10 steps) is the core agentic risk. We combine the two endorsed mitigations: **grounding** (retrieval-check against the KB) + **sandbox execution** (run/validate). LangGraph's praised superpower is that every path is inspectable — our existing run-card/tool-call panel already gives that transparency *without* the canvas's scaling penalty. And **conversational debugging** (explain the failure + propose a fix in the same thread) beats Dify's separate per-node debugger.
- **Gates + human-input as first-class phase types.** `llm_human_input` + the gate/retry/`on_failure` routing are native phase types, not bolt-ons — human-in-the-loop is built into the format the user authors.

**Honest caveat:** the unique combination is real, but it's only *realized* once Phases A/B/C ship. Today the differentiation is latent in the substrate, not yet user-reachable.

---

## 5. How this changes Phase 092

**Close the F1/F2/F3 correctness gaps AS-IS first; re-scope composer + authoring as NEW phases.** Reasoning:

- **F1 (the `harness_audit.user_id` NOT-NULL crash) is a pure correctness blocker, independent of any UX decision — fix it regardless.** Until a workflow can run end-to-end, nothing downstream is validatable.
- **F2 (wedged lock with no recovery)** is likewise a correctness/recovery bug — must ship before any composer change, because the consolidation has to coexist with real lock states.
- **F3 (lock-UX: disable-with-tooltip while locked not actually wired to `useWorkflowLockForThread`)** is the one that interacts with the composer direction — but it's still a correctness bug *today* and should be fixed in 092 as spec'd. Note that **Option C reduces F3's surface area**: if the picker and Deep/Harness toggle leave the composer, there's less to disable while locked (the composer only gates textarea/Send), making the eventual fix simpler and more honest. So fix F3 now to the current design; the consolidation later *simplifies* it rather than redoing it.

**Recommended sequence:**

```
092 (current): fix F1 + F2 + F3 lock-UX  →  workflow runs end-to-end, lock honest
  └─ also (optional small enabler): Authoring Phase A (API) so the picker shows user workflows
        ↓
G-2 sketch: composer consolidation (Option A + C) + form-editor shell
        ↓
NEW phase: composer consolidation (A ship-now, C structural)
        ↓
v2.9: Authoring B (NL-generate) + C (form editor) + D (optional DAG view), with Plugin Contract
```

Do **not** fold composer consolidation or the authoring builder into 092 — 092 owns dual-mode wiring + the Continue button, and the lock bugs are the blocking work. Treat UX consolidation and authoring as their own scoped phases with sketch-first gates.

---

## 6. Open questions for the operator

1. **Composer steady state:** do you agree the target is **`[ Model ▾ ] [ General/Explorer ▾ ]`** with workflow start moved to the panel (Option C)? Or do you prefer to keep workflow start in the composer and only do the cheaper Provider-into-Model fold (A) + gear (D)?
2. **Workflow start location:** is the Phase 087 workspace panel the right home for "Run workflow," or do you want a "/" command-palette entry (Option B) as the primary discovery path?
3. **Authoring timing:** ship **Authoring Phase A (API only)** as a small late-v2.8 insert so the dual-mode picker shows user-authored workflows — or keep the picker seed-only through v2.8 and do all authoring in v2.9?
4. **NL-generation appetite:** is "describe a workflow in plain English → get a validated editable draft" (Phase B) a v2.9 headline feature you want to invest the eval-gating effort in, or a nice-to-have after the form editor proves out?
5. **Differentiation emphasis:** which differentiator do you want to lead the marketing/positioning with — KB-grounded phases (anti-Glean), or NL-to-safe-workflow, or persistent-skills-as-workflows? (Affects which authoring phase gets priority.)

---

## 7. Suggested next GSD step

1. **Finish 092 first** — close F1/F2/F3 as currently spec'd (F1 is non-negotiable; it's a crash). Optionally tack on Authoring Phase A (API) if you want the picker non-seed-only this milestone.
2. **`/gsd:sketch`** the composer consolidation — **G-2 (sketch-before-plan for UX) fires** because this is live-UI + panel work; the operator-approved mockup is the acceptance bar. Use the `sketch-findings-agentic-rag` panel-shell + chat↔panel-seam findings as the baseline.
3. **`/gsd:explore`** the workflow-authoring direction (NL-generate → form-edit → lint-on-publish) to lock scope and the A/B/C/D split before any plan-phase.
4. Only then `/gsd:spec-phase` / `/gsd:plan-phase` the consolidation and authoring phases.

**Do not** jump to plan-phase on either the composer or the builder — both trip sketch/explore gates, and both should wait until 092's lock bugs are closed.
