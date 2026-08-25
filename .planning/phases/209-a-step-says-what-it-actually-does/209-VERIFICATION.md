---
phase: 209-a-step-says-what-it-actually-does
verified: 2026-08-26
status: passed_retroactively
retroactive: true
retroactive_reason: "No VERIFICATION.md existed. Written at milestone close from evidence RE-DERIVED at HEAD, never transcribed."
requirements: "CONN-02 (follow-up), CONN-03 (follow-up)"
gaps_count: 5
---

# Phase 209 - Verification Report (RETROACTIVE)

> ## THIS REPORT IS RETROACTIVE, AND SAYS SO IN ITS OWN FRONTMATTER
>
> It was written on **2026-08-26**, at milestone close, because `/gsd:audit-milestone` found that
> **seven of v3.8's twelve phases had no `VERIFICATION.md` at all** - 201, 202, 203, 204, 205,
> 206 and 209. The phases shipped; the verification ARTEFACT was never written. This file closes
> the artefact gap and **must not be read as a contemporaneous verification**.
>
> **What that costs, stated plainly:** a verification written at execution time can catch a phase
> before anything is built on top of it. This one cannot - five later phases already stand on this
> work. What it can still do honestly is **re-derive the evidence at today's HEAD** rather than
> transcribe the phase's own SUMMARY, and that is what the scorecard below does. Every number in
> it was MEASURED on 2026-08-26, not copied.
>
> **`status: passed_retroactively` is deliberately NOT `passed`.** It records that the code
> satisfies its requirement on evidence re-derived today - never that the phase was verified when
> it shipped, which it was not.


**Phase Goal:** A person reading the canvas can tell what a step will really do - which service, which action - and a person reading Settings can find every connection they have.

**Requirements:** CONN-02 (follow-up), CONN-03 (follow-up)  
**Verified:** 2026-08-26 - **Status:** `passed_retroactively`

## Measured at HEAD on 2026-08-26

`scripts/drive_phase_209_sc1_sc3.py` (Playwright/Chromium, live stack) -> **16/16 assertions passed**. Gates: `tsc -p tsconfig.app.json` **34** = baseline; count gate **OK 114/114, failed 0, total 5793, pinned 5180 unchanged**; backend **68 failed / 2679 passed** (baseline 68/2678).

## Evidence

- **DRIVEN IN A REAL BROWSER**, navigating by clicking. Canvas AND Spine both render `DriveWiki - <tool>` with the MCP mark. Evidence: `scripts/209-sc1-canvas.png`, `209-sc1-spine.png`, `209-sc3-connections.png`.
- **SC#2's positive arm is driven**: a seeded connection declaring `readOnlyHint: true` renders `ONLY READS`, and the control beside it - `get_and_purge_records`, a read-VERB name declaring nothing - correctly renders `CHANGES SOMETHING OUTSIDE`.
- SC#3 holds as a PARTITION: the row is visible under `All` and under exactly one state chip (`['All','Not connected']`), so it can never vanish - which is what the old capability chips did to it.
- Three guards were **driven RED against planted defects** and each source restored **md5-identical**.

## Gaps and honest limits

- **TWO BLOCKING DEFECTS SHIPPED IN THE FIRST DRAFT AND WERE CAUGHT ONLY BY REVIEW**, both the same shape - each half green, the JOIN dead. (a) read-ness was inferred from a regex over the TOOL NAME, so `get_user_and_purge_records` rendered `ONLY READS` while deleting; (b) `canvasModel` read `phase.config.mcp_server_url`, a field `ExternalActionPhaseConfig` never declares, so the MCP mark could never render. **Every gate was green over both.**
- **PARTLY SELF-ASSESSED - the REVIEWER authored the final fix** (the link that made `readOnlyHint` reach the banner at all), because the builder ran out of context. Whoever builds does not verify: **that fix has had no independent review and is OWED.**
- **SC#2's positive arm is proven only against a SEEDED declaration.** DeepWiki - the one MCP server reachable without OAuth - ships no annotations on any of its 3 tools. What is proven is OUR rendering of a declared hint, not that any given server declares one.
- The tool name is **clamped on the canvas face** (`read_wiki...`) though full on the Spine.
- Both steps still read *'Stops for your approval before it acts outside'* - including the one that `ONLY READS`. The type subtitle now sits in mild tension with the banner directly beneath it.

## Verdict

Requirement(s) **CONN-02 (follow-up), CONN-03 (follow-up)** are satisfied by code whose evidence was re-derived on 2026-08-26.
The gaps above are recorded as **carried debt**, not blockers - none of them claims the shipped
behaviour is absent. **This is not a claim that the phase was verified when it shipped.**

---

## ⚠ CORRECTION 2026-08-26 — THE BROWSER EVIDENCE ABOVE IS QUALIFIED, BY THE INTEGRATION CHECK

The 16/16 drive was run against **this machine's** database, where
`app_settings.feature_visibility.visual_workflow_canvas` is `{"audience": "everyone"}` — an
operator has flipped it ON. **The cold default is `"off"`** (`user_settings.py:1203`, and its own
comment calls it *"the ONE authoritative cold default"*).

`WorkflowBuilderPage.tsx:2234` passes the context **spread-conditionally**:

```tsx
{...(canvasEnabled ? { nameContext } : {})}
```

So with the flag at its shipped default, `nameContext.toolReadOnly` and `.mcpServerUrls` are
`undefined`, every `external_action` step reads `CHANGES SOMETHING OUTSIDE` whatever the server
declared, and the face degrades to a bare `tool_name`.

**This does not make Phase 209 wrong** — the degraded state is fail-closed and therefore honest.
**It does mean the drive proves the behaviour on a flag-flipped install, not on a fresh one**, and
the row above should be read that way. ⚠ **I did not know this when I wrote it**; the cross-phase
integration check found it, which is precisely the value of a check the builder does not run.

## ⚠ AND THE FACE IS ABSENT FROM THE RUN SURFACE (W-2)

`WorkflowRunPage.tsx:985` calls `nodeTitle(spec)` with **no** name context, so
`phaseVocabulary.ts` falls through to the bare tool name instead of `connection · tool`. A grep for
`effectBannerFor` returns only `canvasModel.ts` and `PhaseSpineGraph.tsx` — the run page,
`RunSpine.tsx`, `RunStepList.tsx` and the panel's `PhaseCard` / `PhaseTimeline` render **no effect
banner at all**.

**So the step that "says what it actually does" says it in the BUILDER only, not while it runs** —
which is `SEED-206`, planted 2026-08-26 before this was measured, and now confirmed rather than
suspected.
