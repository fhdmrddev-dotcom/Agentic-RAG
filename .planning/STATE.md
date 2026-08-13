---
gsd_state_version: 1.0
milestone: "v3.7"
milestone_name: "Workflow Product Completion"
status: in-progress
last_updated: 2026-08-14T00:30:00.000Z
last_activity: "2026-08-10 — **v3.7 Workflow Product Completion OPENED** (Phases 192-198, 13 requirements; 191 reserved). Prior: 2026-08-09 — **v3.6 Visual / No-Code Workflow Studio CLOSED and TAGGED.** 13 phases (CORE 181-189 + STRETCH 190 + inserts 184.1/188.1/188.2), 151 plans, 1,064 commits over 18 days, migrations 114-118. Closed on a FRESH audit re-run at HEAD `bdd3e54b` (`41ae2618`) after the on-disk one was found to predate Phases 189 and 190 entirely. **CORE closed 19/21 satisfied with ZERO unsatisfied — every CORE requirement wired in shipped source, confirmed file:line.** The one unsatisfied requirement is STRETCH **CONN-02**: only 1 of 3 connectors is drivable from a workflow, and Slack works by coincidence. STRETCH 191 deferred, never built."
stopped_at: "2026-08-13 — **Phase 193 Authoring Doors + Template Placement: PLANNED (`68e6a173`) — 11 plans in 7 waves, plan-checker VERIFICATION PASSED, 0 blockers. NEXT = `/gsd:execute-phase 193`.** ⚠ **RESEARCH OVERTURNED AUTH-03's PREMISE and the operator re-decided it at plan time (D-21…D-25, in CONTEXT.md's dated amendment section).** The contract's `render_template`-in-`available_tools` signal is on **ZERO of 223 live definitions**; the live signal is `phase_type == \"llm_emit\"`. And `resolve_template_source` **returns unconditionally on Branch 1** when a definition binds a library template, so on 16 of 17 rows the run-time upload is **unreachable code**. ⇒ the predicate is **P2 + an unknown arm** (1 admits / 34 no / 110 unknown). ⚠ **The card mark is visible on exactly ONE published row — `ephemeral-template-fill-101uat` — so UAT rows U4/U5 MUST be driven against that slug or they cannot see the feature.** ⚠ **TEN inherited claims measured FALSE**, four of which would each have cost a wave: `runVocabulary.ts` is the analog, not `libraryVocabulary.ts`; **the 188.2 two-badge ceiling guards the CANVAS `PhaseNodeCard`, not `library/WorkflowCard.tsx`** (D-13 stands on SEED-155 grounds — no plan may claim a typecheck enforces it); `launchError` is not template-only and lives INSIDE the wrapper D-17 removes (WR-03 all over again); `definition` is a jsonb **string scalar on 194 of 223 rows**. ⚠ **The landmine CONTEXT never named:** `WorkflowBuilderPage.header.test.tsx:304` holds a byte-exact `innerHTML` of the whole `doorGroup` band — waves 2–3 keep it green with ZERO edits (a stronger move-proof than any baseline 193 could author), waves 4 and 5 red it once each, both labelled. ⚠ **The decision-coverage gate returned a VACUOUS PASS** (`skipped — no trackable decisions`) and was re-run by hand: **25/25 covered**. G-5 fires on `WorkflowDoorSwitch.tsx` and is **honoured by construction**, no override. UI-SPEC gate skipped by operator decision, audited in the guardrail table. **Prior:** CONTEXT CAPTURED (`48ad67fd`) — 20 decisions. G-2 SATISFIED: sketch 164 is the acceptance bar and the operator picked **variant D — the mix** (B's door NAMES + C's two TIER labels), committed at `20ca7cf7` with the ruling that the **header-strip restack is IN SCOPE**. D is DERIVED in `build.cjs` (`D_FROM_C`), never re-typed — audit 18 matched / 0 missed against the real `WorkflowDoorSwitch` DOM. ⚠ **G-5 FIRES on `WorkflowDoorSwitch.tsx` and the file was ABSENT from the CLAUDE.md hot-file ledger** — measured 8 commits / 6 phases (124, 155, 184, 184.1, 186, 187) / 385 L; the identical failure to `WorkflowsPage.tsx` escaping G-5 for ten phases, because the audit scans `files_modified` AGAINST the table and a file missing from the table is invisible to its own guardrail. **193 owes it a ledger row at close.** HONOURED BY CONSTRUCTION, not waived — the sketch's build contract already requires the vocabulary module, so wave 1 is a pure move with baselines captured on the UNMOVED tree (188.1: a baseline only proves something if it PREDATES the change) and wave 2+ applies variant D + the restack. NO override recorded. ⚠ **AUTH-03 needs NO backend change — measured, not assumed:** `definition` is already projected on the wire (`backend/app/db/workflows.py`) and the card already derives its tier from it — the OPPOSITE of Phase 192's D-04 surprise. ⚠ **The two unknown-fallbacks are OPPOSITE ON PURPOSE (D-15 vs D-20):** the card renders NOTHING on an absent `definition` (absence must never read as a claim); the Run modal renders the control EXACTLY AS TODAY (hiding on unknown would silently strip shipped WFIN-01) ⇒ **the predicate must be THREE-STATE, not boolean.** Do not \"fix\" this into consistency. **The card mark is PLAIN TEXT, never a chip** — a third badge is a typecheck error (188.2) and `SEED-155` exists because sketch 163 drew a chip the card could not render. ⚠ **This discussion was the SECOND attempt — the first was lost ENTIRELY to a laptop restart:** the session died on the sketch's `AskUserQuestion` and nothing reached disk (no commit, no file, no transcript message, no subagent dir). Nine recovery angles searched; the work was NEVER WRITTEN, not deleted. The two operator answers were therefore committed BEFORE the discussion re-ran — the durability lesson applied rather than noted. **Ledger drift found while measuring:** the `WorkflowCard.tsx` row reads 6 commits / 721 L; measured **7 / 747**, and 193 makes it the card's 3rd phase, arming G-5 for the phase after. Reported-bugs cross-check: BUG-260813-01 (canvas hardcodes `colorMode`) left OPEN, routed to `/gsd:fast` under G-3, NOT folded. `todo.match-phase` returned one 0.6 match (`spike-nl-workflow-authoring`) which is STALE — its own routing note closes it on Phase 152, which shipped; recommended for closure, deliberately not edited here. **Prior: Phase 192.1 Workflow Identity ✅ CLOSED 2026-08-13** (8/8 plans, 7 waves, LIB-05 satisfied, UAT 9/9 driven — 7 pass / 2 fail, U7 fixed same-day under G-3, U8 accepted → `SEED-155`; `threats_open: 0`; ⚠ no `192.1-VERIFICATION.md` exists; ⚠ 192.1 was ABSENT from the ROADMAP checklist until its own close, exactly as 188.2 was at the v3.6 close). Full 192 / 192.1 detail lives in § Current Position below and in `git log`, no longer duplicated here."
resume_file: null
---

# Project State

> ⚠ **This file was RESET at the v3.6 close (2026-08-09).** The previous STATE.md had ballooned to
> **562 KB** and its YAML frontmatter was corrupted — unquoted multi-line strings had been parsed
> as top-level keys (`recorded:`, `carrying:`, `change:`, `measured:`, `inherited:`, `verbatim:` …),
> which is exactly the damage the GSD SDK `state.*` verbs did five times during Phase 190 alone
> while reporting success. **Nothing was deleted:** the full 562 KB file is archived verbatim at
> `.planning/milestones/v3.6-STATE-at-close.md`, including every Decisions entry, Performance
> Metrics table and Roadmap-shape block back to v2.9.
>
> **Hand-edit this file. Do NOT call the `state.*` SDK verbs** — seven of them write false records.

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-08-09)

**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared.

**Current focus:** *No milestone active.* Planning the next one.

## Current Position

**Milestone:** v3.7 Workflow Product Completion — **opened 2026-08-10**
**Phase:** **193 Authoring Doors + Template Placement — EXECUTED 2026-08-14, NOT YET COMPLETE**
**Plan:** **10 of 11 plans have a SUMMARY.** `193-11` (the operator UAT checkpoint) is PART-DONE: its Task 1 and Task 3 are written, its Task 2 is 6 of 8 rows.
**Status:** ⏸ **ALL GATES RUN AND GREEN — blocked on human evidence, not on code.** `tsc -p tsconfig.app.json` **33 (baseline, unmoved all phase)** · count gate **exit 0 · total 3561 · failed 0 · 67/67 pinned** · code review **11 findings, ALL resolved** (10 fixed, 1 ruled+seeded) · security audit **50/51 closed, 0 code threats open** · verification **`human_needed`, 1/3**.
**NEXT = drive UAT row U1, then U2**, with a person who has not used the Builder (`193-UAT.md`). Nothing else is owed by the code.

**⚠ THE PHASE IS DELIBERATELY NOT MARKED COMPLETE.** `phase.complete` was NOT called. Marking it
would write `[x]` against a phase whose headline claim — *the two doors are tellable apart* — has
no evidence, and this project's STATE.md has been corrupted five times by verbs that wrote
optimistic records. **1 of 3 success criteria verified is the honest number.**

### Phase 193 — the four gates, run 2026-08-14 (all after execution, none skipped)

| Gate | Verdict |
|---|---|
| **Code review** (`193-REVIEW.md`) | 0 Critical / 8 Warning / 3 Info — **all 11 resolved**: 10 fixed in code, WR-04 ruled ACCEPT+SEED. Scoped from `git diff`, NOT from SUMMARY `key_files` — the default would have missed `WorkflowBuilderPage.tsx`, the least-reviewed file in the phase. |
| **Security** (`193-SECURITY.md`) | **50/51 closed, 0 code threats open.** The provenance claim was RE-TRACED TO CODE (`workspace.py:281` → `template_asset_service.py:197` → `tool_dispatcher.py:3320` → `template_render_service.py:947-951`, `assert engine != "docxtpl"`) rather than string-matched. T-193-48 was a blank-field gap, closed by marking U1/U2 ⛔ per the UAT file's own rule. |
| **Verification** (`193-VERIFICATION.md`) | **`human_needed`, 1/3.** Reached independently rather than by trusting this file. |
| **G-7** | **CLEAR** — `plans: 11 total · 0 gap-closure`, exit 0. Zero fails to route; no round opened. |

**⚠ THE MOST IMPORTANT SINGLE FINDING — `SEED-156`, measured not impressionistic.** Comparing this
phase's own committed captures node by node, **`GOVERN_STANDALONE` shares 11 of its 14 text nodes
with `DESCRIBE_STANDALONE`**: below the header strip the two authoring doors open onto **the same
screen**. Someone who picks *"you decide every setting"* is shown a box asking them to describe the
goal, under *"the AI writes the steps, sets how strict it is"* — door A's promise, on door B.
**It was NOT caused by the phase's fast-fix** — before it the same two screens read
`Draft the workflow`/`drafts the phases` against `Write the first draft`/`writes the steps`:
synonymous words on an identical screen. The fix removed the cosmetic difference and made the
duplication legible. **No copy was authored in response**, because G-2 requires a sketch and
sketch 164 draws no mockup of either pre-draft screen; the instrument that settles it is U1/U2.

**Review findings worth carrying forward:** WR-01 — the D-24(a) copy fence swept two files while
`WorkflowBuilderPage.tsx` had become a third consumer, so **the exact regression the phase closed
could have recurred with every gate green**; fixed and DRIVEN RED. WR-05 — `templateAdmission`
returned a POSITIVE `does-not-admit` for a `config`-silent phase list, inverting D-20; fixed and
driven RED. WR-07 — nothing pinned the jsonb string scalar, **the shape 194 of 223 live rows
carry**; now pinned.

### ⚠ Phase 193 — why it is NOT complete, stated so a later reader cannot mistake green gates for a delivered phase

**SC#1 and SC#2 are NOT verified, and nothing in the repository can verify them.**

| SC | What must be TRUE | Decided by | Status |
|---|---|---|---|
| SC#1 | a person who has not seen the Builder can predict what each door does before clicking | **U1** | ⏸ **owed** |
| SC#2 | the number of perceived choices does not increase | **U2** | ⏸ **owed** |
| SC#3 | a user with a template to fill can find where to supply it | **U4** pass (+U5) | ✅ verified |

Both open criteria are, by their own wording, properties of *a person's* prediction and *a person's*
count. **3557 passing frontend cases cannot stand in for either.** The phase's headline claim — the
two doors are tellable apart — is therefore **not yet evidenced**, and six other rows passing does
not change that.

**UAT tally: 6 driven · 5 pass · 1 partial · 0 fail · 2 owed** (`193-UAT.md`, commits `18404fe5`,
`cd94618b`). Driven in Chrome against the operator's real library at `eb7f7e5e` — 107 identity lines
rendered, 145 published / 78 draft.

- ✅ **U3** — driven at **BOTH** `visual_workflow_canvas` values, and D-05's conditional is proved in
  **both directions**: `ml-auto` is **absent** on the badge in the merged row and **present** in the
  standalone band (gap label→badge 95 px vs **937 px**). Driving only one value would have reported a
  pass while half the shipped behaviour went unmeasured. The flag was flipped through the Control Room
  UI (not SQL — the settings sync-cache has no staleness check) and **restored to its exact recorded
  pre-test value** `{"roles": [], "groups": [], "audience": "everyone"}`.
- ✅ **U3b** — the describe band's escape classes are **byte-identical** to the govern band's;
  `dividerCount: 0` where there is no third peer to divide from.
- ✅ **U4** — both halves. The provenance sentence matched **byte-for-byte** against
  `RunModal.tsx:429`. The non-admitting modal has `fileInputCount: 0` and `orphanSeparators: 0` —
  shorter, not damaged, so D-17's claim holds at the surface.
- ✅ **U6** — the card says `Build it myself`, the strip says `Build it myself`.
- ✅ **U7** — a blocked `POST /threads` produced a **visible `role="alert"`** on a workflow with **no
  template control at all**. This is the WR-03 class defect Phase 192 had to repair on this very
  surface; a naive hide would have silenced every non-template launch failure. It does not.
- ◐ **U5** — structure/placement/treatment pass and are proved (`<span>needs a template</span>` with
  **no class attribute**, index 2 per D-14, 5 of 107 rows). Its verdict turns on whether it reads as a
  **requirement of you**; that is a reader's property. Becomes a fail if a reader concludes the
  unmarked rows definitely need no template — D-15 failing at the surface though it holds in code.
- ⏸ **U1, U2** — structurally not the assistant's to drive. Scoring them from an agent that has read
  the source would be the check-that-cannot-fail `193-UAT.md` exists to prevent.

**G-7: CLEAR** — `node scripts/check-gap-closure-rounds.cjs 193` → `plans: 11 total · 0 gap-closure`,
exit `0`. **Zero fails to route, so no gap-closure round is warranted and none was opened.**

**Guardrail overrides: NONE recorded for Phase 193.** G-5 fired on `WorkflowDoorSwitch.tsx` and was
**honoured by construction** (the extraction `193-03` shipped BEFORE the feature that needed it), so
no override was required and D-09 declined to record one.

**Hot-file ledger, re-derived at close by `193-10` (do not quote — re-derive):**
- `WorkflowDoorSwitch.tsx` — **11 commits / 7 phases / 426 L.** The row G-5 never had: this file was
  ABSENT from the `CLAUDE.md` ledger for six phases, which is why the guardrail never fired on it.
- `library/WorkflowCard.tsx` — **8 commits / 3 phases / 818 L. G-5 now FIRES.** The next phase to
  touch it owes a refactor recommendation FIRST.

**⚠ One operator-approved change landed mid-phase that no plan owned** (`294a2ac8`): `193-08` found a
SECOND, ungoverned copy of the describe screen's words in `WorkflowBuilderPage.tsx`. Four strings were
predicted; **five were found** (`DESCRIBE_H1` too, caught only by sweeping the page programmatically
against all 21 governed values). It redded **24 cases across five suites** — a red `193-08` had
PREDICTED IN WRITING in `WorkflowBuilderPage.describe.test.tsx`'s docblock, which is the only reason
those reds could be trusted as the fix working. **A literal-only sweep cannot see a regex query**: the
first sweep missed two sites querying `/draft the workflow/i`. This change is the least-reviewed code
in the phase and is the reason `/gsd:code-review 193` matters.

**⚠ Environmental finding for the next phase — the vitest worker cap is now wrong in `CLAUDE.md`.**
`GSD_VITEST_MAX_WORKERS=4` was calibrated at ~3400 gated cases for TWO concurrent agents; the gate now
executes **3557**. On one identical commit it reported, in order: cap 4 → **17, 4, 3** failures;
UNCAPPED → **11**; **cap 2 → 0 and 0**. Every failure was `STACK_TRACE_ERROR` (a timeout, never an
assertion), in files no plan touched, each passing IN ISOLATION at full green counts. **Use
`GSD_VITEST_MAX_WORKERS=2`.** The gate remains non-deterministic under load on
`WorkflowsPage.test.tsx` — worth a seed, not a phase defect.

**Deferred triggers checked at close:** BUG-260813-01 **not fired** (still `open`, routed to
`/gsd:fast`); D-06 breadcrumb move **not fired**; `WorkflowCard.tsx` refactor **FIRED** (now armed for
the next phase); D-10 vocabulary merge **FIRED and SPENT** — `doorVocabulary.ts` is confirmed the
**fourth** `*Vocabulary` module (`door`, `library`, `phase`, `run`), and the deferral was still judged
right because merging them mid-phase would have put a shared module under a words-only proof.

### Phase 193 — PLANNED (2026-08-13): the four things a later reader should not re-derive

**11 plans / 7 waves, `VERIFICATION PASSED` with 0 blockers and 2 warnings, both closed before this
was written** (the RESEARCH open-questions heading now carries its `RESOLVED` map; `193-11` now
carries an explicit `<worktree_protocol>` saying it runs against the **primary tree**, because its
instrument is a running dev server on the operator's machine, not a file checkout).

**1. ⚠ RESEARCH OVERTURNED AUTH-03'S PREMISE, AND THE OPERATOR RE-DECIDED IT AT PLAN TIME.**
The BUILD-CONTRACT, the sketch README and CONTEXT's own `<canonical_refs>` all describe the fill
signal as *"admits `render_template` in the phase tool whitelist"*. Measured over **223 live
definitions: ZERO carry it.** A predicate written to the contract's letter would have marked nothing
at all. The live signal is `phases[].config.phase_type == "llm_emit"`.
Underneath that sat the expensive half: `_exec_llm_emit` → `resolve_template_source` **returns
unconditionally on Branch 1** (`template_asset_service.py:144`) whenever the definition binds a
library template in `assets[]`, and **nothing clears `asset_ref` because a user uploaded something**.
So on the 16 published rows that bind one, the run-time upload is **unreachable code** — `Template to
fill` would promise what the engine discards.
⇒ **D-21: the predicate is P2 + an unknown arm** — admits ⟺ an emit phase is present **AND** no bound
`assets[kind=="template"]`; `phases: []` ⇒ `unknown` (110 of 145 published rows, so without that arm
D-17 would strip a shipped capability from three-quarters of the library on the strength of a stub).
Live scoring: **1 admits / 34 does-not-admit / 110 unknown.**
⚠ **THE COST IS RECORDED, NOT SMOOTHED: the card mark is visible on exactly ONE published row —
`ephemeral-template-fill-101uat`. UAT rows U4 and U5 MUST be driven against that slug** or they
cannot see the feature at all. `P1′` (17 rows) was rejected twice over: false on 16 of them, **and**
byte-for-byte the same predicate as `soulDeliverable`, which already drives the shipped *Makes a
file* chip — a second word for a fact the surface already states, against SC#2.

**2. Four more plan-time decisions, all recorded as `D-22…D-25` in `193-CONTEXT.md`'s dated
amendment section** (the original 20 left standing, not rewritten): the D-04 restack applies to
**both** bands, describe getting the demotion without a divider (**D-22**); `strip.labelGovern`
becomes the **21st** governed COPY id with the string `Build it myself`, added to `build.cjs` and
regenerated rather than typed into JSX (**D-23** — it was the one surviving instance of the exact
wording SEED-147 calls illegible); both new modules ship **with fences** (**D-24**); and
`templateAdmission()` lives in `soulData.ts` as a **three-state union, never a boolean** (**D-25** —
a boolean cannot express D-20's deliberate asymmetry).

**3. ⚠ TEN INHERITED CLAIMS MEASURED FALSE across research and pattern-mapping, all encoded in the
plans so no executor re-discovers them.** The four that would each have cost a wave:
`libraryVocabulary.ts` is the **wrong analog** (`runVocabulary.ts` is — same directory, and
`libraryVocabulary` cites it as *its* precedent and has no suite at all); the **188.2 two-badge
ceiling guards the CANVAS `PhaseNodeCard`, NOT `library/WorkflowCard.tsx`** — there is no badge
ceiling of any kind under `library/`, so D-13's plain-text ruling stands on **SEED-155 / U8 grounds
only** and **no plan may claim a typecheck enforces it**; `launchError` is **not template-only**
(`RunModal.tsx:198` sets it on *any* `onRun` rejection and its node sits **inside** the wrapper D-17
removes — hiding it naively reproduces WR-03 on the surface 192's gap round already repaired); and
`definition` is a jsonb **string scalar on 194 of 223 rows**, so `definition->'phases'` silently
returns nothing.

**4. ⚠ THE LANDMINE CONTEXT NEVER NAMED:** `frontend/src/pages/WorkflowBuilderPage.header.test.tsx:304`
holds a **byte-exact `innerHTML` literal of the entire `doorGroup` band**. Waves 2–3 must keep it
green with **ZERO edits** — it predates this phase by nine phases, so an unedited pass is a *stronger*
move-proof than any baseline 193 could author for itself. Waves 4 and 5 will red it once each
(copy, then structure); both re-captures are labelled "1 of 2" / "2 of 2" in the plans and must be
stated in the SUMMARYs, never quietly absorbed. Three further suites outside `components/workflows/`
also assert door copy; all are in `files_modified`.

### Phase 193 — the context it was planned from (2026-08-13)

**G-2 is SATISFIED.** Sketch 164 (`telling-the-doors-apart`) is the acceptance bar; the operator's
pick is **variant D — "the mix"** (B's door NAMES + C's two TIER labels), committed at `20ca7cf7`
together with the ruling that **the header-strip restack is IN SCOPE**. D is **derived** in
`build.cjs` (`D_FROM_C`), never re-typed — audit **18 matched / 0 missed** against the real
`WorkflowDoorSwitch` DOM.

**`193-CONTEXT.md` — 20 decisions** (`48ad67fd`). The four that a later reader should not re-derive:

- ⚠ **G-5 FIRES on `WorkflowDoorSwitch.tsx`, and the file was ABSENT from the CLAUDE.md ledger** —
  measured **8 commits / 6 phases** (124, 155, 184, 184.1, 186, 187) / **385 L**. The identical
  failure to `WorkflowsPage.tsx` escaping G-5 for ten phases: the audit scans `files_modified`
  *against the table*, so a file missing from the table is invisible to its own guardrail.
  **193 owes it a ledger row at close.** **HONOURED BY CONSTRUCTION, not waived** — the sketch's
  build contract already requires the vocabulary module, so wave 1 is a pure move with baselines
  captured on the UNMOVED tree and wave 2+ applies the copy. **No override is recorded.**
- ⚠ **AUTH-03 needs NO backend change — measured, not assumed.** `definition` is already projected
  on the wire (`backend/app/db/workflows.py`) and the card already derives its tier from it. The
  **opposite** of Phase 192's D-04 surprise.
- ⚠ **The two unknown-fallbacks are OPPOSITE ON PURPOSE** (D-15 vs D-20). Card: absent `definition`
  renders **nothing**, indistinguishable from "does not admit" — absence must never read as a claim.
  Run modal: absent `definition` renders the control **exactly as today**, because hiding on unknown
  would silently strip shipped WFIN-01 from a user who cannot know it existed. ⇒ **the predicate
  must be THREE-STATE, not boolean.** Do not "fix" this into consistency.
- **The card mark is PLAIN TEXT, never a chip** — the card structurally forbids a third badge
  (`@ts-expect-error` pinned, 188.2) and `SEED-155` exists *because* sketch 163 drew a chip the card
  could not render (UAT U8).

⚠ **This discussion is the SECOND attempt. The first was lost entirely to a laptop restart** — the
session died on the sketch's `AskUserQuestion` and **nothing reached disk**: no commit, no file, no
transcript message, no subagent dir. Nine recovery angles searched; the work was **never written**,
not deleted. The two operator answers were therefore committed BEFORE the discussion re-ran.

**Ledger drift found while measuring:** the `WorkflowCard.tsx` row reads `6 commits / 721 L`;
measured **7 / 747**. 193 makes it the card's **3rd phase**, arming G-5 for the phase after.

**Prior:** Phase 192.1 Workflow Identity ✅ CLOSED 2026-08-13 (8/8 plans, 7 waves, LIB-05 satisfied,
UAT 9/9 driven, `threats_open: 0`, U8 accepted → `SEED-155`) — detail below.

**The close, in one line each:** LIB-05 satisfied · 9/9 UAT rows driven (7 pass, 2 fail) · U7's fail
fixed same-day under G-3 · **U8's fail STANDS**, its in-scope half accepted → `SEED-155` · security
`threats_open: 0` with E-1/E-2 repaired and E-3 open by decision · G-5 honoured in the order D-01
requires (the extraction shipped Wave 3, *before* the feature it made room for) · ⚠ **no
`192.1-VERIFICATION.md` exists.**

⚠ **192.1 WAS ABSENT FROM THE ROADMAP CHECKLIST ENTIRELY UNTIL THIS CLOSE** — the list ran
192 → 193 while an eight-plan phase executed between them, exactly as **188.2** was missing at the
v3.6 close. Added as `- [x]` in the same commit. A phase missing from its own checklist is invisible
to every audit that reads the checklist.

⚠ **THIS BLOCK WAS STALE FROM `0b2b7520` UNTIL 2026-08-13, AND THE STALENESS DID DAMAGE RATHER THAN
JUST SITTING THERE.** It read *"⛔ AWAITING THE OPERATOR. Drive `U1…U9` … The phase is NOT complete
and NOT verified"* — written **before** the drive, and left unedited through the four commits that
performed it (`8b34eb69`, `a20414ab`, `773e6365`, `5646d043`). The consequence is recorded because it
is the whole reason this file matters: at the close of `/gsd:secure-phase 192.1` the orchestrator
emitted `▶ /gsd:verify-work 192.1 — U8 is the owed row`, which was **wrong twice over** — the UAT was
complete, and U8 was not *owed* but **driven and FAILED**. The operator caught it (*"I think we
already verified work why you are proposing it again"*). **A state file that describes work already
done manufactures a request to redo it.** This is the same class as the v3.6 close, where a stale
checklist read `184 | 1/13 In Progress` thirteen days after 184 shipped 13/13.

**G-4 UAT: 9 of 9 rows DRIVEN — 7 pass, 2 fail. Not owed, not deferred, not partial.**
Every row carries a recorded `result:` in `192.1-UAT.md` (`:275, 327, 372, 426, 480, 534, 606, 716,
826`), and D-27 held — no row located its target by id.

| Row | Result | Note |
|---|---|---|
| U1 | pass | SC#1, the row Phase 192 failed. Driven by the **operator**, by reading the screen |
| U2 · U3 · U9 | pass | U3 cross-checked against the database rather than the screen alone; U9 is *"the most decisive row in this file"* |
| U4 | pass | **the answer CHANGED THE PRODUCT** — `1 of 43` read as an index, fixed same-day under G-3 (`773e6365`) |
| U5 · U6 | pass | U6 passes on BEHAVIOUR with its **disclosure half recorded NOT VERIFIED** — carried, not hidden |
| U7 | **FAIL on salience → FIXED same-day** under G-3 (`5646d043`, one `className`) | wording half accepted, no change |
| U8 | **FAIL — stands, unrepaired** | driven by the **operator** with sketch 163 open beside the live library; two screenshots captured |

**U8 is a taste fail, not a breakage fail, and three of its four complaints are NOT this phase's
code** — dated by `git log --diff-filter=A`, which changes only WHERE a fix goes, never whether the
complaint is valid: the 2-bare-line cards and the description hero are **Phase 124**
(`PhaseSpine.tsx:50` — `showNames = scale !== "card"`, created `c5a6c610` 2026-06-27, seven weeks
before the sketch was drawn); the toolbar/create-button styling is **Phase 192**
(`LibraryToolbar.tsx`, `2dd9b748`). Every mechanical `fail:` condition measured green at 1536 px
**and** at 375 px true device emulation (0 of 108 collisions, 0 clipped, no horizontal scroll).

**192.1's own in-scope half of U8 is small and is THE ONE OPEN PRODUCT DECISION: the counter lost its
CHIP treatment.** The mockup renders `1 of 2` as a bordered pill; the build renders plain inline
text. ⚠ **It is not a free restyle** — U4's fix widened the string to `43 share this name`, roughly
**four times** the mockup's width, so the pill must hold a phrase it was never drawn for. Root cause
is **sketch→build drift and it is structural**: sketch 163 hand-wrote its own CSS and drew an atom
the card **cannot** produce, because the card consumes `WorkflowSoul scale="card"` UNCHANGED by
explicit decision. The acceptance bar and the build disagreed from the moment the sketch was approved.

**Security: `/gsd:secure-phase 192.1` COMPLETE — `threats_open: 0`** (`192.1-SECURITY.md`, `9a3df6f8`).
29 entries across 8 plans (24 mitigate CLOSED · 4 accept logged as ARL-01…04 · 1 n/a), audited in
**verify-mitigations** mode at HEAD `5646d043` because all 8 PLANs carried a parseable
`<threat_model>`. Every SUMMARY claim was re-verified independently rather than believed. It found
**three DURABILITY holes where the property held but nothing defended it** — the Phase-190 CR-01
shape. **E-1 and E-2 are CLOSED under G-3** (`15472e7c`): T-192.1-16's register claimed the `[rows]`
memo key was *"grep-asserted"* and it was not (the only hit in any test file was a **comment**), and
the subtree non-vacuity guard proved only **3 of 12** modules load. Both driven RED against real
plants; **E-2's plant showed the four `it.each` sweeps passing green against the empty string.**
`tsc` unmoved at 33; count-gate pin 117 → 118. **E-3 (INFO) is OPEN by decision** — the `forkFailed`
shape has no fence at its new home in `useWorkflowFork.ts`; routed to the next phase touching it.

**⚠ NO `192.1-VERIFICATION.md` EXISTS.** Phase 192 closed *verified 6/6*; 192.1 has **no
goal-achievement record at all**. That is a missing artifact, stated rather than implied — and per
the v3.6 close, 9 requirements once rode on 3 missing VERIFICATION.md files.

**NEXT = decide U8's counter-chip half** (restyle to a pill that fits `43 share this name`, or accept
the plain-text counter and record it as a deviation with its reason). Then the phase can close.
`/gsd:verify-work 192.1` would produce the missing VERIFICATION.md, but **its UAT half is already
done — do not re-drive the nine rows.**

Prior position (Phase 192, closed 2026-08-12):

**`192-15` — a fork click that fails now says so, on both handlers.** WR-03: `catch (e) {
console.error(…) }` and nothing else, which is why the operator's *"nothing happened, even the
card's still the same"* was **literally accurate**. One piece of state (`forkFailed`), one
`role="status"` node (`library-fork-failed`) in the region that already hosts this page's failure
banners, two catch blocks. **Both** handlers, because `onTweak` and `onUseStarter` share ONE WORD on
the card face (D-12) and a person cannot tell which they clicked. It fires on the shape that
actually still fails — Test A drives a published `vendor-risk` with **no** matching draft, i.e. the
2 residual `published + published` slugs `192-14` deliberately did not close.
**`onUseStarter`'s single 409 retry is PRESERVED and now pinned from the inside at exactly two
`createWorkflowDraft` calls — measured RED-side too**, so it provably pre-dates this plan and cannot
be deleted under cover of the repair. Both `console.error` calls survive: the log is the developer's
evidence, the sentence is the person's. `forkFailed` holds a display NAME and a BOOLEAN, never the
error, so no status code or server prose can reach the surface **by signature**. No toast library was
added — this repo has none.
**Driven RED first** against the unedited page (md5 `f2d2af05…` identical before and after): all
four cases failed as real `AssertionError`s (`expected null not to be null` on `library-fork-failed`),
never bare timeouts. ⚠ **That was designed in:** this file's `asyncUtilTimeout` (15 s) is LONGER than
vitest's 5 s per-test budget, so a plain `findByTestId` on the absent notice would have blown the
test timeout first and produced exactly the uninformative RED `192-14` warned about. Each case waits
on the call count (true on both paths) and then asserts the notice under an explicit 2 s budget.
Gates: tsc **33** unmoved, eslint 0 (incl. a11y), fences 64/64, library subtree **223/223**, count
gate **exit 0** capped (`total 3188 · failed 0`).
⚠ **`192-16`'s owed pin raise is now `WorkflowsPage.test.tsx` 40 → 48, NOT the 40 → 44 recorded
below** (192-14's 44 plus this plan's 4), still on top of `192-13`'s `WorkflowCard.test.tsx`
**35 → 39**. `ROADMAP.md` / `CLAUDE.md` / `192-UAT.md` again deliberately not written — `192-16`
owns them. **The U5 UAT row itself is still owed**, with the two slugs to drive it against named in
`WorkflowsPage.tsx`.

**`192-14` — the fork verb stops being a dead button.** `onTweak` now looks the caller's own drafts
up by slug (`draftBySlug`, highest version wins) and OPENS the existing draft instead of minting a
colliding version; nothing is created, so nothing can 409. `onOpenDraft` was relocated ABOVE
`onTweak` **verbatim** (proved by an empty extracted-function diff) because a dep array is evaluated
at render time and a later `const` is a TDZ crash, not a lint warning. `hasExistingFork` is now
passed from the page, so the card's sentence and the verb agree in the same render.
**Driven RED first** against the unedited page (md5 `b7799812…` identical before and after): the
shipped code called `createWorkflowDraft` with `{slug: "vendor-risk", version: 3}`. ⚠ **The only
difference between the new describe and the shipped one above it is ONE EXTRA ROW in the drafts
feed** — that is the whole reason 3176 passing tests never entered this branch.
**The residual is NOT hidden:** re-measured against the live DB, 18 slugs carry >1 version and
exactly **2** (`meridian-risk-summary-good-07aedc33`, `readonly_refusal_098uat`) are
`published + published` with no draft — their fork still 409s, and `192-15` is what makes that
refusal visible. Both are named in `WorkflowsPage.tsx`. Gates: tsc **33** unmoved, eslint 0 (incl.
a11y), fences 64/64, library subtree 219/219.
⚠ **D-192-DEF-01 REFINED by measurement:** the count gate exits **0** when run with
`GSD_VITEST_MAX_WORKERS=4` (and the gate's own 19-file argv runs **3184/3184 green** capped), and
reds `failed 1` / `failed 2` when run uncapped. The cap is a CLAUDE.md rule, not an optional flag —
`192-16` should read this before deciding what to do with that deferred item.
**Owed to `192-16`:** the count-gate pin raise `WorkflowsPage.test.tsx` **40 → 44**, on top of
`192-13`'s `WorkflowCard.test.tsx` **35 → 39**. ROADMAP.md was deliberately not written here —
`192-16` owns it, with `CLAUDE.md` and `192-UAT.md`.

### How 192 verified

Verification scored **5/6** and found ONE gap — the honest-empty-state contract — which the code
review had also found as **CR-01**. It was **closed under G-3 as a fast-fix, not a gap-closure
round** (`60b8842f`), because: G-7 ran **clear** (0 gap-closure plans); **all four ROADMAP success
criteria were already verified**; the offending code was DATED to this phase's own same-day output
(`b4d2f837` / `94a565f4`), which G-7 names as a signal to fast-fix; and the change is one render
branch plus one test with no schema or API surface.

**The defect, worth remembering:** `loading = !anySettled` and a **failed** source counts as settled,
so when all three feeds rejected the page rendered *"You have no workflows yet."* — an affirmative
claim about the user's own data made from evidence we do not have — directly beneath three banners
saying we could not load them. `LIBRARY_STATES["source-failed"]` had been authored in `192-05` for
exactly this state and had **zero consumers**: the vocabulary knew the honest answer before the page
asked for it. **Both existing failure tests reject only `/drafts` and let the other two feeds return
rows, so they never reach the empty-state branch at all — they pin the correct branch without ever
entering the wrong one.** That is the shape of a suite that looks thorough and cannot see the bug.
The new case was driven RED against the pre-fix source (failing exactly on
`queryByTestId("library-empty")`) and the source restored md5-identical before the green run.

**Also from the review, recorded as anti-patterns rather than gaps** (8 warnings, confirmed real,
non-blocking): a by-design 403 on gated `/drafts` shows a permanent un-retryable banner to run-only
users (WR-01); a failed published re-query keeps the PREVIOUS project's rows while `matchesProject`
waves published rows through unconditionally (WR-02); `CHIP_PREDICATES.yours` gates the cascade
delete although its documented degraded default is *assume yours* — right for a chip, wrong for an
authorization-shaped gate (WR-04); both fork handlers swallow failures into `console.error` while the
card's own delete honours "never silent" (WR-03). Two pre-existing bugs inside the verbatim-moved
bodies are labelled as such — fixing them requires re-capturing the move baselines.

**No cross-tenant or RLS defect in the diff** — the backend change is projection-only, predicates
untouched, and the `created_by` fence is load-bearing (exact field set + a serialized-payload sweep
on both handlers).

### Gap-closure round 1 — `192-13` executed 2026-08-11 (the U5 blocker's WORDS)

**Round 1 of 4 plans (13-16). G-7 clear at plan time.** `192-13` gives the library the two facts
the shipped surface could not state: *you already have a copy of this* and *your click failed*.
Three commits — `5bbe0a8a` (vocabulary), `efbd57e3` (the card's state-aware sentence), `f085c29d`
(4 new cases, 39/39). `tsc` **33** unmoved across three measurements, eslint + a11y clean, fences
**64** unmoved by the new copy, library subtree **175 passed**.

1. **The gap was not only the silent 409 — it was the sentence that was ABOUT to become a lie.**
   `FORK_CONSEQUENCE` promises *a new private copy*; under the operator's 2026-08-11 decision a row
   you already forked opens your EXISTING draft. `192-14` changes the verb; without this the card
   would have kept stating a false consequence, which is trading a silent failure for a quiet lie.
   `WorkflowCard` gains ONE optional prop defaulting to `false` — one node, two sentences, selected
   never appended, so no card atom was added (U5-b stays out of the round).
2. **⚠ THE PLAN'S OWN NUMBER WAS WRONG AND WAS CORRECTED IN THE OPEN.** It instructed the docblock
   to record *"16 of the 18"* multi-version slugs as `published v1 + draft v2`. Re-measured against
   the live DB: **18 is confirmed**, but the exact shape is **14** (**15** under a loose predicate
   that admits `pm-weekly-status-report`'s four versions). No predicate yields 16. Sixth phase in a
   row in which an inherited figure measured false.
3. **⚠ THE COUNT GATE IS RED AND IT IS NOT 192-13's — dated, not assumed.** Four runs alternating
   the source state: HEAD `failed 1`, HEAD `failed 1`, **base `7e4abd25` with all three files
   reverted to their shipped bytes `failed 2`**, HEAD `failed 4`. Every failure is
   `STACK_TRACE_ERROR` at **~5000–5500 ms** = vitest's default 5 s `testTimeout`, and all the
   `WorkflowsPage.test.tsx` ones sit in its `search finds a row among 200` describe — a file that
   runs **40 passed / 0 failed in 32 s standalone**. Same class 192-11 hardened elsewhere with
   `asyncUtilTimeout` and 192-12 rated at 2/14 on `WorkflowBuilderPage.canvas`. Logged as
   **`D-192-DEF-01`** in `.planning/phases/192-workflow-library-ia/deferred-items.md`, NOT fixed.
   **The PIN dimension is clean:** no `[count-decrease]`, `pinned total` 3152 unchanged.
4. **Owed to `192-16`:** the `WorkflowCard.test.tsx` pin raise **35 → 39** (read from the gate's own
   `actual`, measured 39 four times), plus the ROADMAP / CLAUDE.md / `192-UAT.md` writes — this plan
   deliberately wrote none of those three files, and `192-13-SUMMARY.md` says so, so the absence
   reads as ownership rather than oversight.

### ⛔ OWED — eleven G-4 UAT rows, NOT run (operator decision 2026-08-11)

**This is a DECISION, not a claim that everything ran.** The operator chose to close with the rows
owed. Record: `192-VALIDATION.md` § Manual-Only Verifications — `0 driven · 0 passed · 0 failed ·
11 owed`, every row ⛔. Threats `T-192-21` / `T-192-32` remain **UNMITIGATED — OWED**.

**Run U6 FIRST** — pick a project; starters must remain **with a stated reason**, and **silence is a
FAIL**. It exists because of a measured IA defect under D-17 that no structural test can catch; the
outcome must quote exact rendered text. **Then U4** — count `[title]` in the library subtree
**excluding `workflow-soul`**; must be 0 in this phase's chrome. Its two survivors
(`WorkflowSoul.tsx:99`, `PhaseSpine.tsx:77`) are INHERITED and out of scope by D-01 — left unstated,
that row fails 192 for a defect two prior phases shipped. Then U1, U2, U3, U5, U7, U8, U9, U10, U11.

**Driving notes (do not re-derive):** 200 workflows, **never 12**; `evaluate_script` for DOM geometry
because `take_screenshot` times out on this setup; `computer` clicks can deliver zero events while
`hover` / `left_click_drag` work. ⚠ **The search does NOT highlight the hit** — matched text renders
plain. Do not verify a behaviour that does not exist.

**Next action:** `/gsd:verify-work 192` when you want the owed rows driven — or proceed knowing they
are owed. Downstream MUST read `192-CONTEXT.md` (**18** decisions) and `192-RESEARCH.md`, which **corrects six CONTEXT.md line numbers** measured at `HEAD = a0795512` — re-derive every line number, HEAD has moved.
**Last activity:** 2026-08-10 — **Phase 192 wave 1 executed and merged** (`5178100e`). `192-01`: five `WorkflowsPage`-covering suites adopted into BOTH count-gate knobs (pinned files 51 → 56, pinned total 2838 → 2910), zero source changed. `192-02`: D-04 ownership — `is_mine` + `is_system_global` computed server-side on `/published` and `/starters`, raw `created_by` fenced off the wire. Post-merge gate green: `tsc -p tsconfig.app.json` unmoved at **33**, count gate exit 0 / `failed 0`, new backend suite 17/17.

### Wave 1 — three measured findings not to re-derive

1. **Claude Code's worktree isolation did NOT fork from the orchestrator's HEAD.** `192-02`'s
   worktree came up at `fda79214` (a `master` merge commit), not the dispatched base `17c30d4f`.
   The prompt's `git merge-base` assertion caught it and `reset --hard`-ed to the correct base;
   both branches merged from `17c30d4f` cleanly. **Keep the base assertion in every executor
   prompt — it is load-bearing here, not ceremony.**
2. **The count-gate marker was stale by 63 at HEAD** — it read `2775 (190-15)` while the reduce
   computed **2838** on an unmodified tree. Ninth staleness event; corrected in place. Two NEW
   drifted pins were found and deliberately left alone (`WorkflowBuilderPage.canvas.test.tsx` +5,
   `builderStore.test.ts` +6), joining the two owed since 190-12 (`ExternalActionSection` +9,
   `PhaseTimeline` +4) — **24 cases are deletable with the gate green today**, all outside 192's
   blast radius. Re-pinning them inside 192 would fold unrelated drift into a commit that did not
   cause it.
3. **One degradation claim in `192-02` was measured FALSE and scoped rather than shipped.** A
   malformed caller id does NOT yield `is_mine=False` on `/published`; it raises, because a
   **pre-existing** `UUID(user_id)` coercion at `workflows.py:252` fires first. The claim is true
   of the helper and of `/starters` only. The shipped coercion was left alone (out of scope) and
   the measurement recorded in the test docstring, so no later reader concludes 192 either
   introduced or removed a 500 path.

### Wave 2 — what it measured (merged `3d1a9567`)

`192-03` RunModal baseline (8 captured strings + 6 focus/dialog assertions, two dumps byte-identical
at 20,065 B) · `192-04` delete-Sheet baseline (7 states + both graded-guard invariants, three RED
plants each reddening only their own cases) · `192-05` the four library leaves + four subtree fences.
Post-merge: count gate exit 0 / `failed 0` / total 2910 → 3060 all-growth, `tsc` 33, eslint clean.

1. **The wrong-base bug is SYSTEMATIC, not incidental — 3 of 3 wave-2 worktrees hit it**, plus
   `192-02` in wave 1. Every one came up at `fda79214` (a `master` merge commit) instead of the
   dispatched base. Claude Code's `isolation="worktree"` does not fork from the orchestrator's HEAD
   here. The `git merge-base` assertion in the executor prompt is the only thing catching it —
   **keep it in every prompt**; a baseline captured on the wrong base proves nothing.
2. **`GSD_VITEST_MAX_WORKERS=4` is calibrated for TWO concurrent runs, not three.** At three agents
   `192-05` measured the count gate non-deterministic on ONE commit: `failed 6 → 0 → 1 → 3`. The
   failures were read from the gate's own JSON (session suite, canvas suite, two `WorkflowCanvas`
   axe assertions) — **none under `library/`**, and one run was `failed 0` with all code present.
   Re-run serially by the orchestrator it was green first try. **Amends CLAUDE.md's parallel-run
   rule: the cap holds at 2 concurrent vitest runs; at 3 it is still oversubscribed on 16 cores.**
3. **F1 (192-03): the mid-launch Escape guard is DOUBLE and the baseline can only see the outer
   half.** Deleting the modal's own `if (!submitting)` left the assertion GREEN — the page's
   `onCancel` still refuses; only deleting both reddens. D-01 moves the modal and LEAVES `onCancel`
   on the page, so nothing in the baseline would catch `192-06` dropping the inner guard. Closing it
   requires testing `RunModal` in isolation, which is only possible once it has its own module.
4. **RESEARCH's "≈169 L" delete-Sheet extent was 165 by its own span list** (192-04). The missing 4
   are the `onDeleted` prop + docblock — the re-fetch seam the no-optimistic-vanish invariant runs
   through, which cannot stay behind. Spans, not a number, are recorded in the test.
5. **Three plan-text corrections from 192-05, each of which would have cost a downstream plan:**
   the plan's `soulDeliverable` paraphrase is wrong (the real `chat` variant has **no `label`** —
   code written against it does not compile); `UNBOUND` could not be "reused" (module-private in
   `WorkflowsPage.tsx:67`, and fence F4 forbids the subtree importing the page) so it is re-homed in
   `libraryFilter.ts` at an identical value — **two identical declarations exist until 192-10
   deletes the page's copy**; and F1 must be parsed, not grepped, or the file documenting the rule
   trips it.

**Owed to `192-12`** (the pinning sweep): `RunModal.test.tsx` 11 → **32** (192-06 re-measured; wave 2 read 27 before the move added cases), `RunModal.a11y.test.tsx`
8 → **16**, `PublishedCardDelete.test.tsx` 7 → **32** (192-08 re-measured; 192-04-SUMMARY.md records 26, which is stale), plus first pins for `libraryFilter.test.ts`
(36) and `librarySubtree.fences.test.ts` (47), plus RED plants for the four subtree modules.
⚠ **If `192-06` moves tests into a new `library/RunModal.test.tsx`, the old files' counts DECREASE —
the one thing this gate fails on. 192-06 and 192-12 must settle those pins together.**
⚠ **F1 will fire on the moved code in 192-06/07** — `RunModal` and the delete Sheet carry `title=`
today. That is D-14 working; the `aria-describedby` conversion belongs with the move.

### Wave 3 — the first D-01 move, proved (merged `15f1b5c2`)

`192-06` moved `RunModal` out of the page; `192-07` built `LibraryToolbar` (358 L + 36 cases).
**`WorkflowsPage.tsx` 1407 → 1068 L.** Post-merge: count gate exit 0 / `failed 0` / total 3101,
`tsc` 33, eslint 0/0 incl. a11y.

1. **The verbatim move was proved MECHANICALLY, not asserted.** `sed` the moved range out of the
   base blob and out of the new module, strip the one added `export `, `diff` → IDENTICAL. **Zero
   re-capture**: `RunModal.test.tsx`'s diff is 143 insertions / **0 deletions**, so not one
   `*_BASELINE` literal was edited. This is the 188.1/188.2 method holding a third time.
2. **F1 (the double Escape guard) is CLOSED and was driven RED.** Once `RunModal` is a module it
   can be rendered in isolation with an `onCancel` carrying no outer guard; deleting the inner
   `if (!submitting)` gave 1 failed / 31 passed — exactly the isolated row, positive control green.
3. **An inherited claim was measured FALSE.** `192-05-SUMMARY.md` said `RunModal` "carries `title=`
   today" and that F1 would fire on the moved code. All six `title=` hits sit ABOVE the moved
   range — RunModal carries zero and no `aria-describedby` work was owed. ⚠ **The other half
   STANDS: `:857` is a genuine hit for `192-08`'s delete-Sheet move.**
4. **`192-05-SUMMARY.md` also maps this phase's plan numbers OFF BY ONE** (it calls 07 the
   delete-Sheet move and 09 the toolbar). Measured from the plan files: **07 toolbar · 08 delete
   Sheet · 09 card**. This matters because `192-12`'s owed obligations are addressed by plan number.
5. **`T-192-04` greps where `F1` parses** — an asymmetry that reddened a docblock for spelling the
   React prop the fence forbids. The next author will hit it too.
6. **A "create leads" plant that would have passed falsely was rejected** (192-07): CSS
   `flex-direction: row-reverse` leaves every `compareDocumentPosition` assertion green while
   visually putting create last. Replaced with a real JSX reorder — so the suite proves create
   leads in **focus and screen-reader order**; the visual half is owed to UAT U2/U7 and `192-11`
   and was NOT claimed.
7. **Wrong base: 6 of 6 worktrees.** Unchanged and systematic.

### Wave 4 — the second D-01 move, and a claim this orchestrator got wrong (merged `b52bd4f4`)

`192-08` moved the WFIN-03 delete Sheet out of `PublishedCard` into
`library/WorkflowDeleteSheet.tsx` (296 L). **Page 1068 → 926 L** (40 ins / 182 del). Four spans
`diff`ed IDENTICAL against the base blob, **zero characters added inside any span**. All seven
192-04 captures + both graded-guard invariants green with **zero re-capture** — `git diff` over
`pages/__tests__/` was empty at the moment they re-ran. Post-merge: count gate exit 0 / `failed 0` /
total 3107, `tsc` 33.

1. **⚠ THE `title=` CLAIM WAS FALSE, AND THIS ORCHESTRATOR PROPAGATED IT.** `192-05` claimed both
   D-01 moves would trip fence F1; `192-06` refuted it for `RunModal` but kept "`:857` is a genuine
   hit for 192-08" — and the wave-4 dispatch brief repeated that as fact **without re-deriving it**.
   Measured: the page's six `title` attributes sit at `:98 :564 :588 :871 :1042 :1058`, and `:871`
   (the post-cut position of old `:857`) is the **⑂ Tweak button in `PublishedCard`'s footer**, ten
   lines ABOVE the Sheet's comment at `:886`. **Zero `title` attributes were inside the moved
   range.** No conversion was owed; none was performed; the plan's own acceptance criterion
   (`grep -c "title=" ` on the module = 0) had it right. **⇒ The `:871` D-14 conversion is now
   `192-09`/`192-10`'s debt** — 192-09 must not reintroduce it on the new card, and 192-10 deletes
   the old one. **Lesson, same class as the project's standing rule: a claim inherited through two
   summaries and an orchestrator brief is still an unmeasured claim.**
2. **Every inherited line number was +14 stale** — all four spans re-derived by content, not number.
   Third line-number correction in this phase.
3. **192-04's "169-line extent" measures 175 here** — two comment blocks documenting the moved code
   that its span list did not name.
4. **The guard was re-proved ON the moved code:** deleting the mid-delete refusal inside
   `WorkflowDeleteSheet.tsx` reddened exactly 4 rows — **including 192-04's two page-driven rows**,
   which is the cleanest available proof the invariants follow the code and not the filename — with
   all four positive controls green, then restored.
5. **New pattern introduced, cost stated:** the Sheet opens via a React 19 ref-as-prop imperative
   handle, chosen so `sheetOpen` could not stay on the caller. `useImperativeHandle` had **zero**
   prior uses in this codebase.
6. **The count gate did NOT flake in this single-executor wave** — consistent with the
   concurrency-induced explanation, not a latent suite problem.

### Wave 5 — the unified card (merged `67f46794`)

`192-09` shipped `library/WorkflowCard.tsx` + 35 cases. Post-merge: count gate exit 0 / `failed 0` /
total 3142, `tsc` 33, eslint + a11y 0, library subtree 154 passed, the 10 suites consuming shipped
testids 176 passed untouched.

1. **The plan contained a genuine contradiction, resolved rather than papered over.** Task 1 requires
   `grep -c "Publish"` on the module = **0**; Task 2 named a prop `onForkPublished`, and the delete
   Sheet's row type is `PublishedWorkflow`. Both cannot hold. Resolution: props are
   `onForkNewVersion` / `onForkStarter` — named for what each fork PRODUCES, which is the real D-12
   distinction — and the delete target's type is derived as `WorkflowDeleteSheetProps["wf"]` rather
   than re-imported. The grep is truthfully 0 and D-10 is proved by rendered-DOM absence across all
   three row states with a self-planted positive control.
2. **The heavy `Delete workflow…` is gated on OWNERSHIP, not on "runnable".** D-09's table taken
   literally offers a destructive action on a curated system-global starter against an owner-gated
   endpoint — an action that can only fail. The shipped starter card never had one; the gate
   reproduces that through the shipped `CHIP_PREDICATES.yours`, not a second copy of the predicate.
3. **Eight plants, each RED, each restored md5-identical.** The suite passed 35/35 first try, which
   proves nothing on its own. **Plant 5 is the one to remember:** it left the consequence sentence
   fully rendered and changed only the id it is ADDRESSED BY — presence, attribute and text checks
   all stayed green; exactly two cases failed, both resolving the id through `getElementById`. That
   is the difference between asserting a contract and asserting its shadow.
4. **Two more stale numbers corrected — and one of them was in the orchestrator's own brief again.**
   The ⑂ Tweak tooltip is at `WorkflowsPage.tsx:853`, **not `:871`** (192-08's summary and the wave-5
   brief both carried the stale figure); it is now gone, replaced by `aria-describedby`.
   `deleteWorkflowDraft` is at `api.ts:3542` with signature `(id, signal?)`, not `:3525` /
   `(definitionId)`. **Running total: line numbers have been corrected in FIVE of the six waves.**
5. F1 / F4 / T-192-04 were driven RED inside a real module here, discharging that part of 192-12's
   obligation.

**Owed forward from wave 5:** `192-10` deletes the three shipped cards — `draft-publish` is the one
testid that dies with them and its single consumer is 192-10's own. Five module-private strings in
the card (plus 192-07's four) still owe a re-home into `libraryVocabulary.ts`.

### Wave 6 — the page becomes composition (merged `ee62cbbe`)

`192-10`: one merged feed, one toolbar, one flat list; the shelves, rail, three cards and banner are
gone. Post-merge: count gate exit 0 / `failed 0`; **pinned total 2910 → 2909, which is the one
authorized lowering** (`WorkflowsPage.test.tsx` 23 → 22) appearing exactly where it should and
nowhere else. `tsc` 33.

1. **⚠ `allSettled` IS NOT WHAT SAVES THE LIBRARY — and the orchestrator's brief said it was.**
   Plant 1 swapped `Promise.allSettled` for `Promise.all` and the partial-failure test stayed
   **GREEN**: the aggregate has no consumer, so the two forms are behaviourally identical here. The
   isolation that actually works is the **per-source `try`/`catch` in each `refetch*`**. Rather than
   let a green stand for a guarantee it does not provide, the property was proved RED against the
   REAL defect (gating the list on "no source failed"), the keyword pinned separately as source in
   the same `it()` (also RED), and `WorkflowsPage.tsx:359-371` says so plainly. **Same class as
   185's lesson: verify the PROPERTY, not the PATCH.**
2. **Two plan contradictions resolved rather than papered over.** `grep -c "GET /workflows/published"
   == 0` cannot hold alongside `NetNewFlag`'s byte-exact `title=`, which contains that literal — the
   count is honestly **1** at `:173`, recorded as two Phase-193 residuals with a named trigger.
3. **RESEARCH predicted "2 deletions, 4 rewrites"; measured, 13 of 23 tests went RED.** Its contract
   classification was right (all eleven survivors intact) but it did not model seven interaction
   changes — including two cases it called "must stay green" that both reach the page through the
   deleted rail or build-card.
4. **THE PAGE GREW: 926 → 1007 L.** Its CODE shrank **615 → 479 (−22.1 %)**; comments 270 → 484.
   Stated rather than smoothed, exactly as 188.2 did with its +67 % subtree.
5. **NO file was deleted** — the 223 removed lines are four function declarations inside a surviving
   file; all twelve deleted things are named in the SUMMARY. Three files outside the plan's
   `files_modified` were touched, all anticipated consumer updates: `build-card` → `library-create`
   and `drafts-shelf` → `library-toolbar` in two builder suites, and the delete-Sheet "exactly one
   host" row re-pointed from page to card. Each keeps the PROPERTY and re-points only its subject.
   Continuity testids survived verbatim; consumer suites 195 → 194 with the −1 fully accounted for.

### Wave 7 — the requirements proved at the surface (merged `62eef6d5`)

`192-11`: LIB-01…04 at **200 rows** through the real filter and real DOM. Post-merge: count gate
exit 0 / `failed 0` / total 3158, `tsc` 33 across four measurements. Twelve plants, all restored
md5-identical.

1. **⚠ D-07's search HIGHLIGHT is NOT shipped — found by measuring, not assuming.** No module under
   `components/workflows/library/` consumes `HighlightTitle` (its three live call sites are all in
   `components/layout/`), and `WorkflowCard` takes **no `query` prop at all** — 192-09's SUMMARY
   records the same fact from the other side. Wiring it is a source change across two files outside
   192-11's one-file gate, so the suite **asserts the gap BY NAME with a positive control** proving
   the `mark` selector finds a real highlight instantly. **It does NOT block LIB-01** —
   REQUIREMENTS.md's wording is "search by name and filter the list"; the highlight is decision
   D-07. ⚠ Related: `librarySubtree.fences.test.ts:355` asserts in prose that *"192 IMPORTS it and
   edits nothing"* — the byte-identity half holds, **the "imports it" half is now FALSE**.
   **Both files are in `192-12`'s `files_modified`.**
2. **The five-wave-old D-04 cross-check is DISCHARGED**, in two halves because either alone is weak:
   the wire half over all 140 rows (positive control: a contradicting starter fails it), and the
   surface half where the *Yours* chip promises and then delivers exactly the non-starter rows. The
   degraded case deletes the key from the payload entirely and proves the chip stays **correct**,
   not merely non-fatal — driven RED against `row.isMine ?? false`.
3. **Two plants proved the assertions are not redundant with one another.** A `Publish…` item hidden
   in the draft MENU reddened the menu fence and left the FACE fence green — exactly how that button
   could come back. Demoting create below the search field reddened *first-interactive* while
   leaving *row-precedence* green, because a control demoted inside the toolbar still precedes every
   row. A CSS `row-reverse` plant was deliberately NOT used: 192-07 measured it cannot fire.
   **SC#4 proves ORDER only; the visual half stays UAT's (U2/U3/U7).**
4. **One flake hardened rather than tolerated:** 1 failure in 646 on a first wide run, not reproduced
   in four re-runs; an UNCAPPED gate run reproduced one too. `configure({ asyncUtilTimeout: 15000 })`
   now applies to that file — it changes patience, never an assertion. The executor stated the
   evidence is consistent with BOTH the worker-cap and the timeout explanation and **proves neither**.
5. **`WorkflowsPage.test.tsx` is 22 → 39** (gate `actual`, three agreeing runs). 192-10's note that
   its pin was "settled at 22 and needs nothing further" is **stale**.

### Wave 8 (PARTIAL) — the close, minus the operator's rows (merged `62c3aab4`)

`192-12` Tasks 1-2 only. Fences 47 → 64 cases, all driven RED against real plants and restored
md5-identical; every suite pinned from a read number (**60/60 pinned files, total 3175, pinned total
3151**); the `WorkflowsPage.tsx` G-5 ledger row written into CLAUDE.md with re-derivable figures.
`tsc` 33, eslint + a11y 0, zero deletions. **Task 3 — the eleven G-4 UAT rows — is OUTSTANDING.**

1. **D-07's highlight is DEFERRED, and the reason was measured rather than argued: wiring
   `HighlightTitle` REDS fence F1 by construction**, because its prop is spelled `title`. Observed
   with a real plant, not reasoned. The plan's own `<what-built>` copy claimed "the hit highlighted"
   and was corrected before the operator could be asked to verify a behaviour that does not exist.
   LIB-01's REQUIREMENTS.md wording is "search by name and filter the list", so this is a deferred
   DECISION, not a requirement gap.
2. **⚠ THE INTERMITTENT GATE FAILURE IS NOW NAMED, LOCATED AND RATED — it is NOT 192's.** Across 14
   gate runs at this HEAD, 2 failed, both the SAME test:
   `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx` →
   *"WorkflowBuilderPage 184-11 — with the flag OFF the panel receives NO rails key (D-14) >>
   POSITIVE CONTROL — with the flag ON the very same read finds the key"*, failing
   `expected 0 to be greater than 0`. One occurrence was in the main tree, one inside an executor
   worktree. **This is a PHASE-184 suite**; 192 touched `WorkflowBuilderPage.header.test.tsx` and
   `.session.test.tsx` (testid re-points) and never `.canvas`. It is the same suite `192-05` named
   in its flaky-under-load set, and the same render-timing class `192-11` hardened elsewhere with
   `asyncUtilTimeout`. **Rate 2/14 (~14 %). Deliberately NOT fixed inside 192** — it would fold
   unrelated drift into a commit that did not cause it. Re-open trigger: any phase touching
   `WorkflowBuilderPage.canvas.test.tsx`, or a third sighting outside 192.
3. **Still owed, recorded not absorbed:** the four drifted pins outside 192's blast radius
   (`ExternalActionSection` +9, `PhaseTimeline` +4, `WorkflowBuilderPage.canvas` +5, `builderStore`
   +6 — **24 cases deletable with the gate green today**); the RED-plant obligation on
   `WorkflowDeleteSheet.tsx` from 192-08; nine string re-homes into `libraryVocabulary.ts`.
4. **LIB-01…04 remain UNMARKED by deliberate choice.** They are user-observable, which is exactly
   what makes an auto-flip look plausible and still be premature — the phase is not verified until
   the operator's rows are driven.

**Owed to a later plan** (raised by `192-02`, from RESEARCH): an integration assertion that
`is_mine === (provenance !== "starter")` over the merged list — the cross-check that makes feed
provenance and the new server bit agree. `192-10` or `192-11` is its home. And `?scope=mine` must
stay: D-16's dedupe-free property depends on it.

### Phase 192 planning — the four things a later reader should not have to re-derive

1. **The count gate does not cover this phase's own file.** `WorkflowsPage.test.tsx` and the three
   `src/pages/__tests__/` suites are in **neither `TARGETS` nor `BASELINE`** of
   `scripts/vitest-count-gate.cjs` — **74 of the 123 covering tests are invisible to it**, so a
   deleted `it()` during the restructure leaves it green. **Eighth recorded occurrence of the
   two-knob trap.** `192-01` is therefore commit 1 of the phase, before any source change.
2. **`/drafts` IS feature-gated; `/published` and `/starters` are the documented RUN CARVE-OUT and
   are not** (`workflows.py:171`). A naive `Promise.all` on the merged fetch re-introduces the gate
   client-side and **empties the entire library** for any user without the authoring capability. The
   merge uses `allSettled`, and dedupes by **`id`, never `slug`** (`onTweak` deliberately mints a
   same-slug row).
3. **D-04 does NOT block D-12 — the waves genuinely parallelize.** Provenance is already available
   three ways (feed origin, `definition.category`, and after D-04 `is_system_global`). This is the
   dependency everyone assumes exists; it is not encoded, on purpose.
4. **Four testids must survive the card rewrite verbatim** — `published-run` (`:864`),
   `published-tweak` (`:855`), `use-starter` (`:1042`) and **`draft-open` (`:722`)**. 22 references
   across five suites; three of those suites are pinned by `192-01` in wave 1, so a renamed id lands
   as a **gate red**. `draft-open` reaches `WorkflowBuilderPage.header.test.tsx`, which asserts its
   band by **byte-exact `innerHTML`** at a pinned 32. `draft-publish` is the one id that dies (D-10).

**Two decisions the operator made at plan time**, both on measured findings rather than taste:

- **D-17** — the project filter **holds starters out and says so** in the toolbar. `?project_folder_id=`
  narrows only `/published` (`db/workflows.py:291–293`) and mig 094 seeds starters with no project at
  all. Under three shelves that read as scoping; under one flat list it reads as a broken filter.
  **Silence is a FAIL** (UAT row U6).
- **D-18** — draft `Delete` **ships as wiring, not new capability**: `delete_draft` (204) and
  `deleteWorkflowDraft` (`api.ts:3525`) already exist and are tested, with **zero UI callers**.
  Never the cascade path — that resolves a *slug* and destroys every version under it.

### Guardrail activity

| Date | Rule | Phase | Outcome |
|---|---|---|---|
| 2026-08-13 | **UI-SPEC gate** (workflow gate, not a G-rule) | **193** | **SKIPPED BY OPERATOR DECISION — audited, not silent.** `/gsd:plan-phase 193` detected frontend indicators and no `193-UI-SPEC.md`, whose default is to stop and route to `/gsd:ui-phase 193`. Skipped on the **same reasoning as 192, and the reasoning is stronger here**: sketch 164's `BUILD-CONTRACT.generated.md` is **generated FROM the real component DOM** (substitution audit **18 matched / 0 missed**), which is a harder acceptance bar than a generated UI-SPEC — it cannot drift from the component because it is derived from it. ⚠ **The caveat was stated at decision time, not discovered later: the sketch draws NO mockup of the D-04/D-22 header restack**, so that half is a human comparison at UAT either way (rows U3/U3b). Recorded so a later reviewer does not read the absent artifact as an oversight. |
| 2026-08-13 | **G-5** (refactor between feature waves) | **193** | **FIRES → HONOURED BY CONSTRUCTION at discuss-phase (D-07/D-08). NOT an override — no waiver recorded** (a G-5 override was explicitly offered and **declined**, D-09). Measured at discuss-time: `frontend/src/components/workflows/WorkflowDoorSwitch.tsx` = **8 commits across 6 phases** (124/155/184/184.1/186/187), **385 L** — and the file was **ABSENT from the CLAUDE.md hot-file ledger**, the identical failure to `WorkflowsPage.tsx` escaping G-5 for ten consecutive phases, because the audit scans `files_modified` *against that table* and a file missing from it is permanently invisible to its own guardrail. **193 owes it a ledger row at close** (`193-10` owns that write). Honoured by construction because the sketch's own build contract already requires porting the COPY table into a vocabulary module: the extraction G-5 wants and the refactor the contract wants are **the same act**. Wave order is load-bearing — wave 1 captures baselines on the **UNMOVED** tree, wave 2–3 move nothing but structure, wave 4+ changes words (the 188.1 rule: a baseline only proves something if it PREDATES the change). |
| 2026-08-13 | **G-2** (sketch before discuss/spec on visual scope) | **193** | **SATISFIED BEFORE PLANNING.** Sketch **164 `telling-the-doors-apart`** is the acceptance bar; the operator picked **variant D — "the mix"** (B's door NAMES + C's two TIER labels) at `20ca7cf7`, together with the ruling that the header-strip restack is **in scope**. D is **derived** in `build.cjs` (`D_FROM_C`), never re-typed. **Not an override — no waiver recorded.** |
| 2026-08-13 | **G-7** (gap-closure round cap) | **193** | **NOT APPLICABLE** — first planning pass, no `--gaps`. Recorded so the absence of a check is distinguishable from a skipped one. |
| 2026-08-13 | **G-3 / reported-bugs routing** | **193** | **BUG-260813-01** (the workflow canvas stays DARK in light mode — `colorMode` hardcoded) left **`open`**, deliberately **NOT folded** into 193. Adjacent only (the govern door opens the Builder that hosts the canvas) but a different concern; it is a one-line `colorMode → useTheme` change and belongs to `/gsd:fast` under **G-3**. Re-open trigger: any phase touching `WorkflowCanvas.tsx`'s render props. |
| 2026-08-13 | **Decision-coverage gate** (workflow gate) | **193** | ⚠ **THE GATE RETURNED A VACUOUS PASS AND WAS RE-RUN BY HAND.** `check.decision-coverage-plan` reported `passed: true, skipped: true, reason: "no trackable decisions"` — it did not parse a single one of CONTEXT.md's **25** decisions (the known GSD quirk: the parser wants literal `D-NN` tokens in a shape this file does not use). A gate that passes without checking anything is exactly the failure class 192.1's security audit found in three fences. Coverage was therefore verified manually with `grep -o "D-NN\b"` over all 11 plans: **25 of 25 covered**, every id cited in at least one plan (`D-16` weakest at 1 mention / 1 plan; `D-23` strongest at 34 / 5). |
| 2026-08-10 | **G-2** (sketch before discuss/spec on visual scope) | 192 | **HONORED → SATISFIED same day.** `/gsd:discuss-phase 192` was requested; the ROADMAP itself flags 192 *G-2 fires (visual)*, and SEED-136 re-open trigger #3 independently says *"do the IA question FIRST, do not restyle underneath it."* No existing sketch covered this IA — sketch 021 (Phase 103) designed the very card-grid + project rail that SEED-136 now calls unbrowsable. Routed to `/gsd:sketch 192` → sketches **157/158/159** built and driven; operator picked **157-B · 158-A · 159-C** (2026-08-10). The approved mockup is now the acceptance bar. **Not an override — no waiver recorded.** |
| 2026-08-10 | **G-5** (refactor between feature waves) | 192 | **FIRED → HONORED at discuss-phase** (`514c8e64`). **Not an override — no waiver recorded.** The refactor question was asked FIRST, before the feature, per the orchestrator protocol. Answer: **split the seam by what survives 192**, rather than a uniform 188.2-style verbatim cut. `RunModal` (`:1054–1407`) and the WFIN-03 delete Sheet (`:872–1003`, currently trapped inside `PublishedCard`) survive unchanged → **verbatim move with the characterization baseline captured BEFORE the move** (the 188.1 rule: a baseline only proves something if it PREDATES the change). `DraftCard`/`PublishedCard`/`StarterCard` are **replaced** by 159-C's single card → rewritten as new code under `components/workflows/library/` (which does not exist today), never extracted-then-rewritten, because 188.2 measured that a pure extraction grows the subtree **+67 %** and paying that on code the phase deletes is waste. Target end state: the page is composition — the 188.2 shape, without the 188.2 tax. *Original firing evidence retained below.* |
| 2026-08-10 | **UI-SPEC gate** (workflow gate, not a G-rule) | 192 | **SKIPPED BY OPERATOR DECISION — audited, not silent.** `/gsd:plan-phase` detected frontend indicators and no `192-UI-SPEC.md`, whose default is to stop and route to `/gsd:ui-phase 192`. Skipped because the design contract already exists in a stronger form: **G-2 was satisfied the same day** (sketches 157/158/159 driven, operator picked 157-B · 158-A · 159-C) and CONTEXT.md fixes the frame (D-02/03/05), search scope (D-06/07/08), verb table (D-09/10/12) and a11y mechanism (D-14) at higher fidelity than a generated UI-SPEC would. Recorded so a later reviewer does not read the absent artifact as an oversight. |
| 2026-08-10 | **G-7** (gap-closure round cap) | 192 | **NOT APPLICABLE** — first planning pass, no `--gaps`. Recorded so the absence of a check is distinguishable from a skipped one. |
| 2026-08-10 | **G-5** — original firing evidence | 192 | **FIRES.** Measured during the sketch: `frontend/src/pages/WorkflowsPage.tsx` = **21 commits across 10 phases** (103/124/143/152/155/165/184/184.1/186/188), **1407 lines** — and the file was **ABSENT from the CLAUDE.md hot-file ledger**, so ten phases touched it without the guardrail ever firing, because the audit step scans against that table and a file missing from it is invisible to its own guardrail. Ledger row added 2026-08-10 (`d0c76525`). 157-B is a structural rewrite of this file's library view (not a 185-style mount point), so **`/gsd:discuss-phase 192` MUST produce a refactor recommendation as its FIRST option.** Named seam: three card components → `components/workflows/library/`; `RunModal` + the WFIN-03 delete Sheet → their own modules; page becomes composition (the 188.2 shape). |

> Phase numbering continues from 190 and **starts at 192** — **191 is reserved** for the deferred
> canvas-scale phase (`.planning/v3.6-STRETCH-CARRYFORWARD.md`). Do not reuse it.

---

<details>
<summary>Previous milestone — v3.6, shipped 2026-08-09</summary>

**v3.6 Visual / No-Code Workflow Studio — ✅ SHIPPED 2026-08-09, git tag `v3.6`.**

| | |
|---|---|
| Phases | 13 (CORE 181-189 + STRETCH 190 + inserts 184.1 / 188.1 / 188.2) |
| Plans | **151** (150 summaries — `184-14` has none) |
| Commits | 1,064 over 18 days (`7c85f9ec` 2026-07-23 → `bdd3e54b` 2026-08-09) |
| Migrations | 114, 115, 116, 117, 118 |
| Requirements | **20/24 satisfied · 2 partial · 1 unsatisfied · 1 deferred** — CORE **19/21 with zero unsatisfied** |
| Security | **zero debt** — 9/9 threat-modelled phases at `threats_open: 0` |
| Archives | `milestones/v3.6-ROADMAP.md` · `-REQUIREMENTS.md` · `-MILESTONE-AUDIT.md` · `-MILESTONE-AUDIT-midflight-260806.md` · `-STATE-at-close.md` |

**What shipped:** a drag-and-drop visual authoring + non-technical live-run-observability layer over
the existing governed harness engine. **The differentiator is graded per-node governance** — strict
when KB-grounded, flexible when open, enforced at RUN time so it is not author-loosenable-away; the
Beam / Glean / n8n deep crawl found none of them grade strictness by grounding. **The D-14 red line
held across all 13 phases: 7 harness executors at close, exactly as at open.**

</details>

## ⚠ Open at close — read before starting anything

**1. CONN-02 — the one unsatisfied requirement, and the reason the audit reads `gaps_found`.**
A real Slack message DOES send through the full governed path (approval gate → six ordered guards →
send → `external_action_sent` audit receipt, `6379787c`). But `_adapter_args`
(`phase_types.py:1985-2005`) fills exactly one field, the capability's `body_arg`. Slack requires
only `["text"]`, which IS that arg — **so Slack works by coincidence**. Jira requires `summary`
(`jira_adapter.py:422`) and SMTP requires `to`/`subject` (`smtp_adapter.py:296`), and none of those
has an author-facing field in `ExternalActionPhaseConfig` (`harness.py:242`). Both raise at
`phase_types.py:2318-2332`, are caught, and report `failed`. **`D-190-DEF-17` — a phase, not a
patch** → connections milestone.

**2. ✅ CLOUD PARITY IS CLEAR — closed 2026-08-09, corrected here 2026-08-12.**
Re-derived mechanically: `bash scripts/pending-cloud-migrations.sh` → **"(none) — cloud is already at
the same migration watermark."** Migrations **104 → 118 were applied to cloud on 2026-08-09** during
the v3.4+v3.5+v3.6 cutover (`origin/production` `4c9b487a` → `5d5ea200`, since advanced to
`7dc53ffa`), and **118 — the credential exposure — is closed in cloud.** For the record, the defect
118 fixed: both `anon` and `authenticated` held column-level SELECT on
`connector_connections.secret_ciphertext`. It shipped in the same operation as the
`connector_service.py` deploy, as its own rule required.

> ⚠ **Why this correction is recorded rather than silently overwritten.** For three days this block
> read *"Until 118 is applied, cloud still has that defect."* On **2026-08-12** an external reviewer
> read exactly that line and reported, in good faith, that a product sold on its governance story had
> **live customer credentials readable by the wrong database roles**. It did not. The reviewer was
> right to trust the file; the file was wrong. **A stale security line in STATE.md is itself a
> security-adjacent defect** — it is what an auditor, a technical buyer, or the next agent reads
> first. The standing instruction on this block has always been *"re-derive; never quote a prose
> number"* — that instruction was correct and nobody ran it, on either side. Run the script.

**3. Verification debt — nine requirements ride on three missing `VERIFICATION.md` files.**
Phase 184 (CANVAS-02/03/04 + VALID-02/03), Phase 188 (RUNVIZ-01/02/03), Phase 189 (**CONN-01**, the
CORE half of operator HARD gate #3). All nine are wired in shipped source and carry passing UAT.
**Documentation debt, not engineering debt** — the cheapest outstanding item in the project.
⚠ Phase 184 carries a standing instruction **not** to route to `/gsd:verify-work 184`; close it by
retroactive documentation from the existing UAT results.

**4. Two records that asserted more than happened.** SEED-133's binding re-open trigger — *"Phase
189's discuss-phase MUST surface this row"* — **fired and was not honoured, for the second
consecutive phase** (it also missed at 187). And seven Phase-190 summaries mark CONN-02/CONN-03
complete against that phase's own `D-190-DEF-02` convention; for CONN-02 that claim is measurably
false.

**5. Accepted risks, both still `open`:** SEED-133 (NL generation ignores `bundle.degraded` → a
folder-blind draft presented as `ok:true` during a registry outage) · SEED-134 (the two flag-gated
single-segment `/workflows/<x>` paths are the only ones answering 404 — an enumeration oracle).

**6. Nyquist:** 4 phases at `nyquist_compliant: false` — 181, 182, 183, 184. Phase 188.1 showed such
a file can often be closed by measurement alone, without generating a single test.

**7. G-5 hot files firing:** `backend/app/services/harness/phase_types.py` (35 commits / 14 phases /
1918 L — **the CONN-02 fix will touch it**), `backend/app/api/threads.py`,
`backend/app/services/anthropic_service.py`. `PhaseNodeCard.tsx` was PAID DOWN by Phase 188.2
(797 → 274 L).

## Next milestone — the sequenced slot

**Connections / integrations.** Not a fresh idea — a debt with four converging records.
**Read `SEED-146` first (the umbrella).** Inputs: `SEED-144` (connections should be
**provider-shaped**, not action-shaped) · `SEED-145` (connections are **platform assets usable in
CHAT**, not workflow-only assets) · `SEED-142` (two-way — read / pull / auto-ingest, which would
amend CLAUDE.md's manual-upload-only rule) · `D-190-DEF-17` (the concrete unfinished edge).

⚠ **Two standing warnings recorded with those seeds:** **every capability shipped so far is a
WRITE — no read / search / list exists at all**, and **no outbound capability may be added to
`_TOOL_REGISTRY` before the approval model exists.** Sequence with SEED-142 or Google gets connected
twice.

Also unclaimed: v3.4 STRETCH 169-173 · v3.5 STRETCH 178-180 (**180 agent-loop honesty = priority
revive**) · 11 dormant seeds.

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-08-09. **46 total.** None belongs to
v3.6 — the 25 quick tasks are legacy stubs (all `status: missing`, dating from 2026-03 onward) and
the 11 seeds are intentionally dormant.

| Category | Item | Status |
|---|---|---|
| quick_task | 260322-26g-improve-tool-call-display-for-ls-tree-gr | missing |
| quick_task | 260328-v6n-investigate-and-plan-fixes-for-duplicate | missing |
| quick_task | 260328-wqj-fix-folder-scoped-chat-returning-results | missing |
| quick_task | 260328-x6n-fix-bug-folder-not-created-when-pressing | missing |
| quick_task | 260404-vel-fix-streaming-cursor-bug-and-add-meaning | missing |
| quick_task | 260405-rgy-fix-folder-public-visibility-files-and-s | missing |
| quick_task | 260405-s1e-hide-toggle-global-from-non-owners-and-b | missing |
| quick_task | 260405-stg-add-chat-references-cascade-deletions-an | missing |
| quick_task | 260407-vqw-review-and-fix-context-window-management | missing |
| quick_task | 260411-wj5-fix-skill-file-upload-bug-files-not-save | missing |
| quick_task | 260412-dqu-fix-four-issues-in-backend-app-api-skill | missing |
| quick_task | 260412-jnc-import-skill-return-202-backgroundtask-f | missing |
| quick_task | 260522-gdg-google-15-iter-loop-diagnostic | missing |
| quick_task | 260529-0sc-fix-phase-086-wr-04-persist-panel-todo-t | missing |
| quick_task | 260529-1wb-fix-bug-260529-01-write-todos-crashes-on | missing |
| quick_task | 260530-wjp-infer-native-tools-for-deepseek-moonshot | missing |
| quick_task | 260530-wvt-fix-title-gen-stuck-on-new-chat-strip-th | missing |
| quick_task | 260531-00x-add-reportlab-to-sandbox-image-pdf-writi | missing |
| quick_task | 260611-irx-worker-log-rotation-pid | missing |
| quick_task | 260630-226-chat-tool-card-live-state-de-duplication | missing |
| quick_task | 260705-hz1-fix-seed-102-reverse-the-name-collision- | missing |
| quick_task | 260705-nfu-fix-a-silent-data-loss-bug-in-skill-zip- | missing |
| quick_task | 260731-3y4-armed-approval-allow-list | missing |
| quick_task | 260807-x9p-bound-steptypepicker-height-to-measured- | missing |
| quick_task | 260808-148-steptypepicker-keyboard-navigation-rovin | missing |
| seed | SEED-003-deployment-flexibility-install-ux | dormant |
| seed | SEED-004-org-multi-tenancy | dormant |
| seed | SEED-040-model-registry-self-service | dormant |
| seed | SEED-041-conversation-compaction | dormant |
| seed | SEED-042-chat-input-modalities | dormant |
| seed | SEED-043-sandbox-package-management | dormant |
| seed | SEED-045-ui-ux-polish-pass | dormant |
| seed | SEED-046-library-health-dashboard-enrichment | dormant |
| seed | SEED-084-starter-workflow-library | dormant |
| seed | SEED-127-reasoning-first-forced-emission-gap | dormant |
| seed | SEED-128-collapsible-reasoning-run-timeline | dormant |
| todo | spike-nl-workflow-authoring | high — largely satisfied by shipped work |
| uat_gap | 184 — 184-UAT-RESULTS.md | unknown (0 open scenarios) |
| uat_gap | 187 — 187-UAT.md | testing (7 open scenarios) |
| uat_gap | 188 — 188-UAT.md | complete (16 pass / 0 fail / 1 blocked) |
| uat_gap | 188.2 — 188.2-UAT.md | partial — 4 driven / 1 blocked |
| verification_gap | 182 — 182-VERIFICATION-round1.md | gaps_found |
| verification_gap | 182 — 182-VERIFICATION-round2.md | gaps_found |
| verification_gap | 182 — 182-VERIFICATION.md | gaps_found (⚠ its recorded regression is FIXED at `api/workflows.py:852`; the file is stale) |
| verification_gap | 188.2 — 188.2-VERIFICATION.md | human_needed |
| verification_gap | 190 — 190-VERIFICATION.md | human_needed (⚠ frontmatter says `3/5` + "no SECURITY.md"; its own body addendum says `4/5` and `190-SECURITY.md` exists at `threats_open: 0`) |

## Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260809-klo | fix BUG-260809-02 — add a `business_requirement` input to the canvas Builder | 2026-08-09 | `da668c96` + `1c58a3fb` | [260809-klo-…](./quick/260809-klo-fix-bug-260809-02-add-a-business-require/) |
| 260813-e12 | `/gsd:fast` — close **E-1** and **E-2** from `192.1-SECURITY.md`: the identity memo's `[rows]`-only key had NO assertion despite its register claiming one, and the subtree non-vacuity guard proved only 3 of 12 modules load. Both driven RED against real plants; E-2's plant showed the four `it.each` sweeps passing green against the empty string — the Phase-190 CR-01 shape. E-3 (INFO) left to the next phase touching `useWorkflowFork.ts`. | 2026-08-13 | `15472e7c` | — (inline, no plan dir) |

⚠ **`BUG-260809-02` is deliberately still `open`.** The unit suite proves the typed sentence reaches
the recorded `updateWorkflowDraft` argument; it cannot prove the live gauntlet accepts it. The plan
gates closure on a live reload + publish row that **was not driven** — no browser automation was
available in the executor session. **Owed manual UAT (run this first):** on the canvas door, type a
requirement, reload, confirm it survived, then Publish and confirm stage 1 "Goal" passes. Local
`feature_visibility.visual_workflow_canvas.audience` is `"everyone"`, so the control is visible.

## Guardrail overrides

None recorded during the v3.6 close. G-7 did not fire — no gap-closure round was opened; CONN-02
was routed to a future milestone precisely because closing it here would have added a user-facing
capability inside a closure round, which G-7 forbids.

## Accumulated Context

Cleared at the v3.6 close — the full decision log lives in `.planning/PROJECT.md` (`## Key
Decisions`) and the pre-close snapshot in `.planning/milestones/v3.6-STATE-at-close.md`. Open
blockers carried forward are the seven items under *Open at close* above.
