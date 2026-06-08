# Modes, the Model Behind Them, and Where We Go Next

**For:** the product owner (plain-language brief)
**Date:** 2026-05-31
**Context:** v2.8 Harness Engine & Workflow Mode, end of Phase 092
**Purpose:** answer the honest question — "what is Deep actually worth, why did General and Deep give me the same answer, and why do workflows feel like a normal chat?" — and set clean ground to continue.

---

## 0. The short version (read this first)

You found a real thing, and your instinct is correct on every point. Here is the truth in four sentences:

1. **You were comparing two settings that are not opposites.** "General" and "Deep" sit on two *different* knobs, so picking one on each knob and expecting a difference is like comparing "large coffee" to "decaf" — they answer different questions, and you can have both at once.
2. **Deep is, on purpose, just the normal chat.** It is not a smarter or deeper version of anything — it is literally "no workflow is running." So General-in-Deep and Deep-with-General are the *same configuration*, which is why you got the identical answer with identical sources. That is correct behavior, not a bug.
3. **Workflows (Harness) really DO run differently** — they run locked, ordered, governed steps over your documents that the AI cannot skip or reorder — but right now the screen only shows you the final answer, so the governed work happens invisibly. That is a **presentation gap, not a logic gap.** We have proof (below) that a workflow searched your real DBA documents across two locked phases and produced a grounded, sourced answer.
4. **Your business framing is exactly right.** Workflows are the intended home for "legal/finance/HR runs the same multi-step procedure (SOP) the same trustworthy way every time" — contracts, monthly reports, compliance reviews. That is written into the design docs as the core value proposition, not something we are inventing now.

The recommendation: **close Phase 092 on its verified core (the wiring works), then make the next step a DESIGN step — sketch and spec how to SHOW the mode and the workflow steps — not more plumbing.**

---

## 1. The two-axis mental model

The single most important correction: there are **not four modes.** There are **two separate knobs**, and you set both on every message. Combining them gives a 2×2 grid.

| | **Knob B — workflow knob** → | **Deep** (no workflow running, the default) | **Harness** (a workflow is running) |
|---|---|---|---|
| **Knob A — agent knob** ↓ | | | |
| **General** (the full toolbox, ~16 tools) | | Normal chat with everything: search your KB, run code, learn skills | A workflow's steps run; the General/Explorer knob is *ignored* — the workflow controls the tools per step |
| **Explorer** (KB-focused, 6 tools, terse) | | KB-only "scout" chat — explore your documents like a codebase, return synthesized findings | (same — workflow ignores this knob while it runs) |

Two things fall straight out of this grid:

**"General vs Deep" is a category error.** They live on different knobs. General is a choice on Knob A (how the agent behaves). Deep is a choice on Knob B (is a workflow running — no). You can't compare them any more than you can compare "spicy" to "takeout." When you picked "General mode" once and "Deep mode" another time, on the *other* knob both runs were still General + Deep. **Same square of the grid, both times.** Same answer is the only correct outcome.

**Why the answer and the references were byte-for-byte identical.** Under the hood, "Deep" is defined as *"no workflow is attached to this thread"* — the system checks one flag (`active_workflow_run_id IS NULL`) and, when it's empty, runs the ordinary agent loop. The code path the team uses is even labeled *"Deep — byte-identical"* to the old behavior. So a Deep run **is** a General (or Explorer) agent run — same model, same system prompt, same document search, same citation builder. There is no extra "deep thinking" step hiding behind the Deep label. **Deep is the umbrella word for "regular chat," and it sits over both General and Explorer.**

> Plain analogy: think of a word processor. **Knob A (General/Explorer)** is "which toolbar is showing — the full one or the slimmed-down one." **Knob B (Deep/Harness)** is "am I free-typing, or am I running a saved mail-merge template that fills in fixed steps?" Free-typing with the full toolbar and free-typing with the slim toolbar are still both free-typing. To feel the mail-merge difference, you have to actually *start* the template.

*(Sources: the 2×2 is a locked decision — `.planning/STATE.md:161`, `092-WORKFLOW-UX-STRATEGY-BRIEF.md §2`. The "Deep is byte-identical to the normal loop" fact is in the code at `backend/app/api/threads.py:1144` and `:1417`, and the agent-knob branch is `backend/app/services/agent_loop.py:943-951`.)*

---

## 2. What each mode is actually FOR (the value of each, in business terms)

Here is what each square is good at, why it exists, and who it's for.

### Knob A — the agent knob

**General agent — "the AI colleague."**
The default. The full toolbox (~16 tools): search and read your knowledge base, run code in a sandbox, browse the web, remember things, learn new skills that persist. This is your day-to-day assistant that *knows your company's documents and can do work*, not just chat.
*Value:* one place to ask anything and have it actually act — find the contract, run the numbers, draft the memo.

**Explorer agent — "the KB scout."**
A deliberately narrow mode: 6 knowledge-base navigation tools only (list, tree, grep, glob, read, analyze), a terse prompt, a tighter step budget. It "explores the knowledge base the way a developer's tool explores a codebase" and returns *synthesized findings*, not a dump of raw tool output.
*Value:* fast, focused "go read across my documents and tell me what's there" — when you don't want the agent reaching for code execution or the web, just disciplined reading of your corpus.

> General vs Explorer is the comparison that **does** produce different answers (different prompt, different tools, different limits). If you want to *feel* a difference today, that's the A/B to run — keep Deep constant, switch General↔Explorer.

### Knob B — the workflow knob

**Deep — "free-form chat" (the default, unchanged).**
This is the absence of a workflow. The AI decides its own steps turn by turn. Maximum flexibility, zero guarantees about *how* it gets there.
*Value:* exploration, one-off questions, open-ended work where you don't need the same procedure every time. **Important:** Deep adds nothing on top of the agent knob — it *is* the normal agent run. It is the safe, unchanged default, and it stays that way.

**Harness / Workflows — "the governed, repeatable procedure."**
This is the new thing in v2.8, and it is the real answer to "what's the added power?" A workflow is a **locked, ordered set of steps the AI cannot skip, reorder, or escape.** The server drives the steps; the model just does the work inside each one. Steps come in five shapes: pure-code steps (no AI), single-AI-call steps, bounded agent steps, fan-out-to-several-sub-agents steps, and pause-and-ask-the-human steps. Between steps there are validation gates, and each step has its own allowed-tools list. The whole run is saved in the database so it survives restarts and is auditable after the fact.

The official value statement, verbatim from the requirements doc:

> *"v2.8 gives the agent a deterministic, auditable workflow runtime — locked ordered phases the model cannot escape — so the same multi-step job runs the same trustworthy way every time, alongside today's free-form chat."* (`.planning/REQUIREMENTS.md:4`)

### Yes — your legal/finance/HR-SOP framing IS the intended purpose

You asked whether the point is "to resolve business problems like legal, finance, and HR SOPs that generate contracts and monthly reports." **Confirmed — that is exactly the documented intent**, not a stretch:

- The platform targets **mid-to-large enterprises**, and Harness Mode is positioned as *"the enterprise-grade auditable execution surface buyers expect."* (`.planning/PRDs/v2.7.md:19`, decision D-PRD-01)
- The product roadmap explicitly plans **opt-in vertical packs for legal, finance, and healthcare.** (`.planning/prd-reset/PLAN.md:50-51`)
- The design docs name the exact use cases you described: a *"compliance-review step (legal pack), a PII-redaction step (healthcare pack), a legal contract-clause viewer, a financial-model summary table."* (`.planning/PRDs/v2.7.md:85-93`)

A workflow is the natural shape of an SOP: "Step 1 — pull the relevant clauses from the contract library. Step 2 — check them against this month's policy. Gate — did anything fail? Step 3 — draft the report. Step — pause and ask a human to approve before sending." Every run does it the *same way*, and every run is logged. That is precisely what compliance, finance close, and HR onboarding need and what free-form chat can never promise.

**One honest caveat:** today the *shipped* examples are four seed workflow templates — Research→Summarize, Plan→Execute→Verify, Literature Review, and Doc-Q&A-with-human-approval. The legal/finance/HR vertical packs are real on the roadmap but land later (v2.9+ via the plugin contract), not in v2.8. So the *engine* and the *intent* are here now; the polished industry packs come next.

### The competitive angle (why this matters, briefly)

The differentiator over tools like Glean is that **our workflows run inside your own knowledge base**, with your access controls, citations, and confidence scores — not over some bolted-on external search index. Combined with sandboxed code steps and human-approval steps as first-class parts of the procedure, that combination is genuinely hard for competitors to match. (`092-WORKFLOW-UX-STRATEGY-BRIEF.md §4`)

---

## 3. Why it doesn't FEEL different today (the legibility gap)

Here is the crux of your confusion, and it is *not* your fault — it's a gap we have already diagnosed.

**A workflow genuinely runs governed steps. The screen just doesn't show them.**

When a workflow runs, the engine broadcasts a play-by-play: `phase started → phase completed → gate passed → next phase started → run completed`. Those events stream over exactly the same channel a normal chat uses. **But the chat screen has no code to display them.** It listens for "here's a chunk of the answer" and ignores everything else. So the entire governed procedure — the locked steps, the gates, the sub-agents searching your documents — happens silently, and you only ever see the **final answer**, presented in the identical chat bubble a Deep answer uses.

In other words: **Deep and Harness currently look the same on screen because they share the same answer-presentation, even though they did completely different work to get there.** This is a **presentation gap, not a logic gap.** The logic is real and verified.

**Proof the workflow actually did governed work (from this phase's live testing, 2026-05-31):**

A "Research → Summarize" workflow was run on a real folder of DBA dissertation documents. The audit trail in the database shows the full governed sequence — `phase_started(research) → phase_completed(research) → phase_transition → phase_started(summarize) → phase_completed(summarize) → run_completed`. The research step **actually called `search_documents` against the user's real DBA folder** (not generic world knowledge), and the final summary came back grounded in those specific documents — citing the actual study (mixed-methods RPA-in-BPM, 309 survey participants, 8 expert interviews, the named framework). The answer rendered in chat with a **"Medium confidence" badge and an expandable "5 sources" chip**, persisted to the database, and survived a page reload. (`092-07-UAT-FINDINGS.md`, Updates 3–4.)

So the machinery works end-to-end and is grounded in your documents. **The only thing missing is a window into the steps while they happen.** Right now the workflow is a black box that produces a good, sourced answer; what you're missing is the glass front panel that shows the box doing its work.

---

## 4. Systems-level direction to make the value legible (leverage what we have — do NOT over-build)

The fix is **not** new engine logic. The data is already streaming and already saved. The fix is **a thin presentation layer** that uses surfaces we already built. Two principles:

### Principle 1 — Reuse the surfaces, don't invent new ones

We already shipped three places that can carry this with almost no new concepts:

- **The workspace panel (Phase 087)** — the right-side panel that already shows files, todos, and the "the agent needs you" interrupt. It already knows how to react to a running thread. A workflow's step timeline belongs here.
- **The run-card / tool-call panel** — already renders "the agent is doing X right now." A workflow step is just a labeled version of the same thing.
- **The live event stream** — the `phase_started / gate_passed / run_completed` events are *already being sent*. Nothing new to emit; we just have to *catch and draw* them.

### Principle 2 — Separate the chrome (same for every workflow) from the content (unique per workflow)

Think of it like the difference between a *progress bar* and *the thing it's measuring*:

| **Chrome — identical across ALL workflows (build once)** | **Content — unique to each workflow (free, comes from the definition)** |
|---|---|
| A visible **mode label** so you always know "I'm in a workflow, not free chat" | The workflow's **name** ("Research → Summarize", "Monthly Finance Close") |
| A **step timeline / progress indicator**: "Step 2 of 3" | The **actual step names** ("Researching your documents", "Drafting the report") |
| A **"governed run" badge** + which tools each step is allowed | What each step *actually did* (searched these docs, ran this code) |
| **Gate pass/fail** markers and the **Continue** button when a step hits its budget | Which gate, what it checked |
| A clear **"workflow finished / failed and why"** end state | The final grounded answer + its sources & confidence (already shown) |

The chrome is built **one time** and works for every workflow forever. The content is **automatic** — it falls out of the workflow's own definition, so a new workflow needs zero new UI. This is the systems-thinking move: build the frame once, and every workflow you ever add fills it in for free.

### What "good" looks like, concretely

When you start a workflow, the panel opens and shows something like:

```
▶  Running: Research → Summarize  · governed workflow

  ✓  Step 1/3  Researching your documents     (searched DBA folder · 5 sources)
  ●  Step 2/3  Drafting the summary…           [tools: read, search]
  ○  Step 3/3  Final review
```

…and the chat still shows the final grounded answer at the end, exactly as it does now. The difference is you can *see the procedure run*, you know it's governed, and you know which SOP is executing.

### Who owns this, and what NOT to do now

- **Phase 094 (the Panel Phase Timeline) owns this.** It is already on the roadmap, not started. It is a **frontend-only** job — the backend already streams and saves the data. It must start with a **sketch** (the G-2 "sketch-before-plan for UI" guardrail fires), because it's visual work.
- **Do NOT build a workflow BUILDER yet.** The drag-and-drop visual canvas for *creating* workflows is explicitly a **later milestone (v2.9)** and is deliberately *not* the chosen direction (the evidence says the visual-canvas middle is "being squeezed dead"). For now, workflows come from the four seed templates plus an optional small "save your own via the API" enabler. Authoring is a separate concern from *showing* a workflow run — don't conflate them.
- **Do NOT add new engine logic to make Deep "feel deeper."** Deep is correctly the plain agent run. If you ever want a genuinely distinct "deep reasoning" behavior, that's a *new, named* capability — not something to retrofit onto the Deep label, which would mislead users.

---

## 5. Clean ground to continue (the recommendation)

**Phase 092's actual job — the WIRING — is done and verified.** A thread can switch into a workflow; the workflow runs end-to-end, locked and ordered, over the user's real documents; it searches the KB, surfaces sources and confidence, persists the answer, and survives reload; the thread unlocks cleanly when the run finishes. The blocking defects found during live testing (F1 through F8) are all fixed and verified. (`092-07-UAT-FINDINGS.md`, Disposition: *"F4, F5, F6, F7, F8 VERIFIED CLOSED live."*)

So the engine and the plumbing are solid. **What's left is presentation and clarity — and that is a design problem, not a wiring problem.** Here is the clean path:

**1. Close Phase 092 on its verified core.** Document two things as the explicit follow-on work (don't silently drop them):
   - The remaining *breadth* UAT rows still owed (the longer-running-workflow lock check, the ask-a-human step rendering, the cross-provider scoreboard, parallel-thread and reload-mid-run checks). These are verification breadth, not new features.
   - The *presentation* gap (Section 3) as Phase 094's mandate.

**2. Make the NEXT step a DESIGN step, not more code.** Specifically two design conversations, each starting with a **sketch** before any planning:
   - **(a) Mode clarity** — how to *show* the two knobs so "General vs Deep" confusion never happens again. The proposed direction is already on the table: simplify the chat composer to just `[ Model ▾ ] [ General / Explorer ▾ ]`, fold the provider choice into the model menu, and **move "Run a workflow" out of the message box and into the panel** as an explicit action — because starting a workflow is a *commitment to a run*, not a per-message toggle. (Decision D-092-UX, operator-approved.)
   - **(b) The workflow-legibility panel (Phase 094)** — the step timeline from Section 4. Sketch the frame first; the operator-approved mockup is the bar to clear before any build.

**3. Build small, after the sketches.** Once the look is agreed, both are modest, frontend-leaning builds on surfaces we already own. No new infrastructure, no engine rewrite.

### The one-line discipline to hold onto

> **Design first, then build small. The power is already in the box — the work now is putting a glass front on it and labeling the buttons, not rebuilding the box.**

You have clean ground: a working, grounded, auditable workflow engine; a correct (if currently invisible) two-axis model; and a clear, decided direction that says *don't over-engineer — sketch the presentation, then ship a thin layer.* That is exactly where you wanted to land.

---

*Anchoring decisions for whoever picks this up: D-v2.8-01 (harness + dual-mode is the v2.8 scope; plugin contract & vertical packs → v2.9), the v2.8 mode-axis clarification (the orthogonal 2×2 — STATE.md:161), D-092-UX (composer simplification A+C), D-092-AUTHOR (authoring is describe-in-words → validate → form-edit, NOT a drag canvas), SEED-029 (the Continue button), D-PRD-01 (mid-large enterprise target). Phase 094 owns the panel timeline and fires the sketch-before-plan guardrail.*
