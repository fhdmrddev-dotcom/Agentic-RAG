---
seed_id: SEED-201
title: A workflow containing ANY external_action step cannot publish — the golden run stops at the step's mandatory approval and nobody is there to answer it
created: 2026-08-25
planted_during: Phase 206.2 plan 04, task 3 (the driven round trip) — found by actually pressing ◆ Publish, not by reading code
status: planted
priority: high
surface: Agentic-RAG
relates_to:
  - SEED-200 (an MCP connection cannot be bound to any step) — the door 206.2 opened; this is the NEXT closed door behind it
  - D-206.2-19 (206.2-01's publish-validator fix) — that fix is CORRECT and PROVED; this blocker is one stage LATER
  - D-04 / Phase 185 (the action-risk checkpoint, "Stop and ask me first" — "That cannot be switched off")
  - Phase 103 (the 8-stage publish gauntlet and its golden run)
trigger_when:
  - Any request to PUBLISH a workflow that reaches outside — every such workflow is affected, not just MCP ones
  - Any work on the golden run, the publish gauntlet's stage 3, or unattended run execution
  - Any change to the external_action approval checkpoint's "cannot be switched off" rule
  - The first operator report of "I can Test Run it but I cannot publish it"
---

# The measurement

Driven 2026-08-25 in real Chromium against the live local backend, on a draft carrying one
`external_action` step (MCP shape, DeepWiki, `read_wiki_structure`, granted) plus two LLM steps.
`◆ Publish…` → a golden input typed → **`Publish — run the checks`** pressed. The gauntlet's own
verdict, read verbatim off the modal:

```
✓Owner  ✓Valid  ✓Goal  ✓Structure  ✓Pause  ✓Grounding    Golden run  Citations  Judge  Commit
⛔ Publish was blocked — nothing was published. What stopped it is named below.

published        false
version          null
golden_run_id    null
blocked_stage    golden_run_error
named_failures   ["golden run could not complete: None"]
```

And the corresponding audit rows, in order, at `07:32:00`:

```
phase_started    {"phase": "act", "phase_index": 0}
publish_blocked  {"definition_id": "22a99fa2-…", "blocked_stage": "golden_run_error",
                  "named_failures": ["golden run could not complete: None"], "golden_run_id": null}
```

The golden run `5d67d004-acc6-44b4-95f3-35528868433d` was created, started its first phase, and was
still `status: active` minutes later — **waiting at the external-action approval checkpoint.** It was
cancelled through the UI at teardown.

# Why it happens

An `external_action` step ALWAYS stops for the author's approval before it acts outside. The panel
says so in its own words and states that the rule is not negotiable:

> *This step reaches outside your workspace, so it always stops and asks you first. That cannot be
> switched off.*

The golden run is an UNATTENDED trial run. There is nobody to press *Approve this step*, so it waits
until the publish service gives up. **Every workflow containing any external_action step is therefore
unpublishable, whatever its shape** — this is not MCP-specific, and it is not a regression: it is the
collision of two correct rules that had never met, because until Phase 206.2 no MCP step could be
authored and (per `D-206-06`) the capability shapes were rarely published either.

⚠ **DO NOT CONFUSE THIS WITH THE STAGE-2.6 BLOCKER `206.2-01` FIXED.** That one WAS about MCP, and it
is CLOSED and proved: `✓Grounding` above is that fix passing, with the MCP step present, in the real
gauntlet. This blocker is one stage later and has a different cause.

# A SECOND defect, found by the same drive

The verdict reports `golden_run_id: null` and the receipt explains, in rendered copy:

> *golden_run_id is null — this blocked before stage 3, so there is no run to open. (A pre-run block
> never has a run link.)*

**Both halves are false here.** It blocked INSIDE stage 3, and the run exists (`5d67d004…`). The
person is told there is nothing to look at, about the one artifact that would explain the failure. And
`named_failures` reads `"golden run could not complete: None"` — the cause is literally the string
`None`, so even the named failure names nothing.

# What a fix probably has to decide

Three routes, none obviously right, which is why this is a seed and not a fast-fix:

1. **The golden run auto-approves its own action-risk checkpoints** — and then a trial run really does
   reach outside, unattended, during a publish. That is a governance decision, not a bug fix.
2. **The golden run stops SHORT of an external_action step and records that it did** — honest, but the
   published workflow then carries a golden run that never exercised its riskiest step.
3. **Publishing such a workflow requires an attended golden run** — the author answers the checkpoint
   inside the publish flow. Most honest, most UI work.

⚠ **Whichever is chosen, the `golden_run_id: null` half is separable and should be fixed regardless:**
carry the run id when a run was created, and stop printing an explanation that contradicts the reading
beside it.
