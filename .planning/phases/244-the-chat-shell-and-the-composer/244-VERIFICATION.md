---
phase: 244-the-chat-shell-and-the-composer
verified: 2026-09-12T00:00:00Z
status: human_needed
score: "5/5 built (code + fences), 0/5 driven — the ROADMAP's own rule is that no criterion closes on a unit test"
re_verification: false
requirements_trace:
  SHELL-01: built, drive owed (L-1)
  SHELL-02: built, drive owed (L-2, L-3)
  SHELL-03: built, drive owed (L-4)
  SHELL-04: built, drive owed (L-5, L-6, A, B) — 2 open non-blocking code findings (WR-04, WR-08)
  SHELL-05: built, drive owed (L-7) — never driven end-to-end since Phase 235 shipped the base signal
known_open_findings:
  - id: WR-04
    severity: warning
    status: open
    summary: "cloud attach buffers the whole provider file before the 10 MB cap is applied (backend/app/api/workspace.py:400)"
  - id: WR-07
    severity: warning
    status: open-latent
    summary: "workflowLocked expression could unlock a genuine harness lock if workflow_runs.status ever gets written 'cap_paused' — no current writer found (frontend/src/components/chat/ChatArea.tsx:140)"
  - id: WR-08
    severity: warning
    status: open
    summary: "the transcript's 'Read <file>' line renders in Explorer/harness turns where the agent could not have read the file (frontend/src/components/chat/MessageItem.tsx:455-465)"
  - id: IN-01..IN-09
    severity: info
    status: open
    summary: "nine info-level findings from 244-REVIEW.md, none blocking a success criterion — see deferred-items.md items 10-13"
  - id: REQUIREMENTS.md-stale-note
    severity: warning
    status: open
    summary: "REQUIREMENTS.md:207-208 still reads 'Pending — G-2 sketch owed (net-new surface)' for both SHELL-04 and SHELL-05; SHELL-04's sketch (236) is done and SHELL-05 was never net-new (F-1/D-244-18) — a one-line correction, not a build gap"
---

# Phase 244: The Chat Shell and the Composer — Verification Report

**Phase Goal:** The chrome around a conversation stops getting in the way of it — the page holds
still while the messages move, a paused run leaves the operator something to do, an approval is
answerable where they are already looking, and a file can join a message.

**Verified:** 2026-09-12
**Status:** `human_needed`
**Re-verification:** No — initial verification.
**Self-verified build, independently re-checked here.** Every one of the phase's own 7 artifacts
(6 SUMMARYs + 1 review-fix SUMMARY) already states, in writing, that it is a self-verification
(D-244-21 / OV-SOLO-01, Gemini unavailable) and that no criterion closes without a browser drive.
This report does not repeat that disclosure as a finding — it is confirmed true and is the honest
baseline this verification starts from, per the task's own `<decisive_constraint>`.

---

## How this verdict was reached

The ROADMAP states verbatim for this phase: *"No success criterion closes on a unit test."* Every
one of `244-VALIDATION.md`'s rows (L-1 through L-7, the 8-row cross-provider board, and the 3
four-axis rows) is marked `⬜ owed`. Zero rows were driven. Every SUMMARY independently states its
own criterion "does not close here." This is not spin — it is the correct and consistent claim
across seven separately-written documents, and I re-derived a sample of the underlying code myself
(below) rather than trusting the SUMMARYs' self-report.

So the central question per the task brief is not "did the code ship" (it did) but: **for each of
the 5 success criteria, is the code (a) present and correct as far as static evidence can show, (b)
absent/contradicting, or (c) claimed but unsupported?** I re-verified a sample of load-bearing
claims directly against the current tree (commands and output below) rather than accepting the
SUMMARY prose.

---

## Direct re-verification (spot checks against the current tree, not from SUMMARY text)

| Claim | Command | Result |
|---|---|---|
| `min-h-0` chain exists on all 4 links | `grep -n "min-h-0" ChatLayout.tsx / ChatArea.tsx / MessageList.tsx` | ✅ `ChatLayout.tsx:803,809`; `ChatArea.tsx:501,584`; `MessageList.tsx:219` — matches SUMMARY exactly |
| Invisible click-sink fix (`BUG-260911-02` partial) | `grep -n pointer-events ChatHistoryColumn.tsx` | ✅ `pointer-events-none` on the container (`:227`, `:255`), `pointer-events-auto` on both real controls (`:267`, `:275`) |
| Server-side cap_paused bound to latest run | `grep -n cap_paused threads.py` | ✅ `:1237` reads the latest row's status directly; the stale `AND status = 'cap_paused' ORDER BY … LIMIT 1` pattern is gone from the live query (only survives in a docblock quoting the OLD query, `:1244`) |
| `PendingAskStack` mounted inline in the thread | `grep -n PendingAskStack MessageItem.tsx` | ✅ imported `:72`, rendered `:547`, inside the existing `hasPendingAsk` arm |
| `.pdf` accepted with magic-byte validation | `grep -n "_PDF_EXT\|_pdf_magic_ok\|%PDF" workspace.py` | ✅ `_PDF_EXT = {".pdf"}` (`:138`), `_pdf_magic_ok` checks `raw[:5] == b"%PDF-"` (`:208`), wired into `validate_upload` (`:253-254`) |
| WR-03 fix: harness excluded from the announcement, not just explorer | `grep -n 'agent_mode not in' agent_loop.py` | ✅ `:1685` — `if body.agent_mode not in ("explorer", "harness"):` |
| WR-05 fix: `folder_id` validated as non-blank UUID-shaped string | `grep -n LibraryFolderId models/connector.py` | ✅ `:155` — `Annotated[str, Field(min_length=1), AfterValidator(_require_library_folder_id)]` |
| WR-06 fix: deliberate refusals keep their own status (not masked as 502) | `grep -n "except HTTPException" connectors.py` | ✅ `:1841` |
| CR-01 fix: threadless composer refuses visibly instead of silently no-op-ing | read `useComposerAttachments.ts` | ✅ `if (!threadId) { setRefusal(...); throw ... }` present on both `attachLocalFile` (`:89-99`) and `attachCloudFile` (`:115-133`, cloud arm throws so the modal cannot read a no-op as success) |

All eight sampled claims check out against the tree exactly as the SUMMARYs describe. This is
unusually well-corroborated self-reporting — I did not find a SUMMARY claim that overstates what
the code does. That raises confidence in the remaining, unsampled claims but does not substitute
for the browser drive the ROADMAP requires.

---

## Per-criterion verdict

| # | Criterion (ROADMAP) | Built? | Driven (UAT)? | Status | Evidence |
|---|---|---|---|---|---|
| 1 | Nav rail stays put; message list scrolls inside; no dead space at any height / panel state (SHELL-01) | ✅ 5-site `min-h-0` chain, fenced (`244-01`) | ⬜ owed — `244-VALIDATION.md` L-1, 6 samples (3 heights × panel open/closed) | **human_needed** | jsdom cannot lay out or hit-test; the SUMMARY says so explicitly and the fence's own docblock states "a fence is a presence assertion and does not satisfy SHELL-01" |
| 2 | Cap-paused Deep run leaves the operator able to act; never a disabled composer beside instructions to use it; holds after reload (SHELL-02) | ✅ client boolean (`ChatArea.tsx:140`) AND server-side read bound to the thread's latest run (`threads.py:1237-1276`) | ⬜ owed — L-2 (post-reload drive), L-3 (genuine harness lock still holds) | **human_needed** | D-244-09 explicitly: *"whether posting at cap_paused actually starts a run and survives reload is UNVERIFIED… drive it, do not reason about it"* — this is the single most load-bearing untested claim in the phase |
| 3 | Approval answerable from the chat thread with the panel's same two actions; answering in either home settles both (SHELL-03) | ✅ `PendingAskStack` mounted inline beside `PausedRunCue`, reusing the one shared store slice (no second renderer) | ⬜ owed — L-4, both directions, plus the third home (`WorkflowRunPage`) | **human_needed** | The mount is structural (shared `useAskUserPrompt` selector) so the "settles in both" property follows by construction rather than by sync code — but a synthetic mount test "proves mounting, not answering" (244-03's own words), and `BUG-260828-07`'s complaint was literally "looked right and did nothing" |
| 4 | Local file attaches and the agent can use it; cloud import asks which folder, never writes to root silently (SHELL-04) | ✅ built across 3 plans (244-02/05/06) + 1 fix round (244-07); PDF accepted, sandbox hydration, system-prompt announcement, chip UI, two-door un-inversion, structural "no `documents` row" guarantee, required non-blank `folder_id` | ⬜ owed — L-5, L-6, the 8-row cross-provider board (A), the 3 four-axis rows (B) | **human_needed**, with 2 open non-blocking findings (see below) | Confirmed structurally: `workspace.py` imports neither `import_single_file` nor `ingest_splice` (grep confirms zero hits outside a docstring), so "not in the KB" is enforced by module placement, not a promise |
| 5 | Watched-source-stopped signal visible in the app shell while doing something else, not only on Health tab (SHELL-05) | ✅ signal itself shipped at Phase 235 (F-1, pre-existing); tab attribution built in 244-04 (`AttentionCondition.tab`, `attentionCountByTab`, `LibraryHeaderBar` count) | ⬜ owed — L-7, both the positive (stopped source) and the ROADMAP's named negative (healthy source raises nothing) | **human_needed** | ⚠ **This is the highest-risk unverified criterion in the phase.** `244-CONTEXT.md` D-244-15 and `244-04-SUMMARY.md` both state, unprompted, that *"Phase 235 closed `SURF-03` UNTICKED and nothing has ever driven criterion 5 end to end"* — i.e. the underlying badge mechanism (not just the new tab attribution) has literally never been observed to work in a browser, across two milestones |

**No criterion is FAILED.** No SUMMARY claim was found to be contradicted by the code (the 8-point
spot check above corroborates this). Every criterion is genuinely **built** and **genuinely
undriven**, which the task brief's decisive_constraint calls `human_needed`, not `gaps_found`.

---

## Requirement traceability (SHELL-01..05 against REQUIREMENTS.md)

| REQ-ID | Named in a plan? | REQUIREMENTS.md status | Consistent? |
|---|---|---|---|
| SHELL-01 | `244-01` (`requirements: [SHELL-01]`) | `Pending` | ✅ consistent (no owed-note attached, correctly) |
| SHELL-02 | `244-03` frontmatter tags it, no `requirements:` field lists it explicitly in the plan (folded into scope) | `Pending` | ✅ consistent |
| SHELL-03 | `244-03` (tagged) | `Pending` | ✅ consistent |
| SHELL-04 | `244-02` (`requirements-completed: [SHELL-04]`), also `244-05`/`244-06` (tagged, `requirements-completed: []`) | `Pending — ⚠ G-2 sketch owed (net-new surface)` | ⚠ **STALE.** Sketch 236 (D-244-18/D-244-22) was completed at discuss and is the acceptance bar the build shipped against. The note should read "sketch done" not "owed." |
| SHELL-05 | `244-04` (tagged) | `Pending — ⚠ G-2 sketch owed (net-new surface)` | ⚠ **STALE, and wrong in a different way.** Per locked `D-244-18` and finding `F-1`, SHELL-05's signal is **not** a net-new surface — it shipped at Phase 235 with operator-approved design, and this phase deliberately did NOT sketch it (sketching it would have re-designed already-approved live UI). The note asserts the opposite of the locked decision. |

**No orphaned requirements.** All 5 REQ-IDs for this phase are claimed by at least one plan; every
plan's claimed requirement is addressed by shipped code. The two stale traceability notes are a
one-line register fix, not a build gap — `244-04-SUMMARY.md` itself flags this exact correction as
owed and recommends `/gsd:verify-work` fix it in one edit, which this report is doing by recording
it rather than silently editing REQUIREMENTS.md out of band.

---

## Known open code findings (not blocking any success criterion, tracked with re-open triggers)

`244-REVIEW.md` found 1 critical + 8 warnings + 9 info (18 total). The `244-07` fix round closed
6 (the critical + 5 warnings) with RED→GREEN drives, each independently spot-checked above.**12
remain open**, all recorded in `deferred-items.md` with concrete re-open triggers — this is the
correct disposition per this project's own rules (a finding that lives only in a review file with
no re-open trigger is treated as a deletion wearing a decision's clothes; these are not that).

| ID | What | Why it doesn't block a success criterion | Where tracked |
|---|---|---|---|
| WR-04 | Cloud attach buffers the whole provider file into memory before applying the 10 MB cap (`workspace.py:400`) | Resource-exhaustion / DoS robustness issue on an authenticated route, not a functional break of "attach a file and use it" | `deferred-items.md` #7, re-opens on next `files_modified` naming `workspace.py` or `import_service.py` |
| WR-07 | `workflowLocked` expression could theoretically unlock a genuine harness lock if `workflow_runs.status` is ever written `'cap_paused'` | **Latent, not firing** — the review could not find any current writer of that value on `workflow_runs` (every writer it found targets `runs.status` instead) | `deferred-items.md` #8, re-opens on the first such writer or the next edit to `ChatArea.tsx` |
| WR-08 | The transcript's `Read <file>` line renders even in Explorer/harness turns where the agent's tool set could not have read the file | A copy-honesty issue in a mode this phase did not focus on (Deep is the primary target of SHELL-04); does not contradict "a person attaches a file **and the agent can use it**" in the modes where the agent has the tools | `deferred-items.md` #9, re-opens on next edit to `MessageItem.tsx` |
| IN-01..09 | Nine info-level findings (dead comparisons, an unhidden `truncate` ellipsis bug, a stale route count in a docblock, a raw exception echoed to the client, an unbounded failure-note string, a badge/tab visibility mismatch, a lockstep fence with a blind spot, a fallback in a turn-window lookup, a clock-skew edge on chip association) | None affect whether the 5 ROADMAP criteria are true; all are UI/robustness polish | `deferred-items.md` #10, `244-REVIEW.md` verbatim |
| Registry staleness | `REQUIREMENTS.md:207-208` — see traceability table above | Documentation only | this report + `244-04-SUMMARY.md` |
| Test flakes (not this phase's defects) | `ChatHistoryColumn.rowIdentity.test.tsx` (goes red 00:00-02:00 local, `Date.now()`-relative fixture), `LibraryPage.initialTab.test.tsx` (SEED-171 7th-candidate flake, timeout-cascade) | Provably unmodified by this phase's diffs (established against base with sources reverted); do not affect the count gate's `0 failing` verdict on a clean run | `deferred-items.md` D-1, D-2 |

**None of the above is a BLOCKER.** They are exactly the kind of residual, honestly-recorded debt
this project's own rules ask for (named, triggered, not silently dropped) rather than evidence the
phase goal was missed.

---

## Data-flow / wiring spot checks (Level 3/4, beyond presence)

- **`SHELL-04`'s "not in the KB" guarantee is structural, not a fence.** `grep -c "import_single_file\|ingest_splice" backend/app/api/workspace.py` — confirmed by the reviewer and re-confirmed here: the only occurrence is inside a docstring. A module that never imports the Library minter cannot reach it on any code path, which is stronger than a unit test asserting "no `documents` row was created."
- **`SHELL-03`'s cross-surface settle is structural.** `useAskUserPrompt` (`StreamsProvider.tsx:4004`) is a single store selector now read by three concurrent mounts (`WorkspacePanel`, `WorkflowRunPage`'s direct `PendingAskCard`, and this phase's new `MessageItem` mount) — "answering in either home settles both" follows from there being one source of truth, not from a synchronization routine that could drift. This is good evidence the *behavior* is real, but it is still not the same as a human clicking Approve in the thread and watching the panel update, which is what `BUG-260828-07` actually complained about.
- **`SHELL-02`'s honesty depends on a claim nobody drove.** The composer unlocks (client) and the server no longer re-locks on every reconcile (server) — but whether **posting a message at cap-pause actually clears the thread's lock in practice, and stays clear after a reload**, is explicitly flagged by the phase's own authors as unverified. This is the single highest-value UAT row to run first (`244-VALIDATION.md` L-2, step 5 in particular: "poll again / navigate away and back — assert the lock does NOT return").

---

## Anti-pattern scan

No stub patterns, no `TODO`/`FIXME`/`XXX` without a tracked reference, no hardcoded empty returns
found in the reviewed diff. Every SUMMARY's own "Known Stubs: None" claim was spot-checked above by
grepping the actual implementation (not by trusting the sentence), and held in all 8 samples.

## Behavioral spot-checks / probe execution

**SKIPPED — no runnable entry point available to this verifier** (no live frontend/backend server,
no browser automation tool in this session). This is exactly the gap `244-VALIDATION.md` exists to
close and is the reason for `human_needed` rather than `passed`. Static/source-level verification
was substituted above (grep + read against the live tree) wherever a claim could be checked that
way.

---

## Human Verification Required

**Every row below is authored, unambiguous, and ready to run — none require additional planning.**
They are `244-VALIDATION.md`'s own rows, reproduced here per this task's output contract with the
single highest-priority row named first.

### 1. L-2 — the cap-paused composer, survives a reload (run this FIRST)

**Test:** Drive a Deep run to its iteration cap (Continue card appears). Reload the page
(confirm `navigation.type === "navigate"`). Confirm the composer is enabled with placeholder
`Ask anything…`. Post a message; confirm a NEW `runs` row appears for the thread (Supabase MCP
read) and the run streams. Then poll again / navigate away and back — confirm the lock does not
return.
**Expected:** Composer stays usable across the whole sequence; no re-lock.
**Why human:** This is a live interaction across a reload boundary and a Supabase state read; no
static analysis can observe it, and the phase's own authors state this specific behavior is
UNVERIFIED (D-244-09).

### 2. L-1 — the scroll frame, at ≥3 heights × panel open/closed (6 samples)

**Test:** On a long transcript, measure `document.scrollingElement.scrollHeight <=
clientHeight`, the nav rail's leaf bounding rect before/after scroll, and the composer's bottom
edge — at 3 viewport heights, with the workspace panel closed and open.
**Expected:** No page-root overflow; rail rect unchanged; composer bottom within 1px of viewport
bottom in all 6 samples.
**Why human:** jsdom performs no layout; this cannot be observed by any unit test in this repo.

### 3. L-4 — the approval, answered from both homes

**Test:** Arm a real `ask_user` approval. Answer it from the chat thread; open the workspace
panel and read its copy without refreshing. Arm a second approval, answer it from the panel,
return to the thread and confirm the inline controls are gone. Also check `WorkflowRunPage`'s
direct `PendingAskCard`.
**Expected:** Both homes agree, both directions, with no manual refresh.
**Why human:** `BUG-260828-07`'s complaint was specifically "it looked right and did nothing" —
a mount/presence test cannot distinguish "renders" from "answers."

### 4. L-5 / L-6 — the local attach and the two doors, end to end

**Test:** Follow `244-VALIDATION.md` L-5 (steps 1-9: menu order, chip states, sent-message
scope word, agent read pointer, negative `documents` check, `.pdf` accept, unsupported-type
refusal, one-item menu, expired chip) and L-6 (composer cloud attach vs Library cloud import,
including the negative `documents`-row check and the folder-required refusal).
**Expected:** All named behaviors hold; the two doors mean different things (this-chat-only vs
permanent Library) exactly as `BUG-260905-01` asked.
**Why human:** File upload, real cloud connection interaction, and reading the agent's live
sandbox reply are outside static analysis.

### 5. L-7 — the app-shell signal, both directions (highest residual risk)

**Test:** Break a watched source genuinely (revoke token / remove watched folder), wait past the
debounce, and — on the Chat view, doing something else — confirm the badge appears and names the
cause. Separately, with only healthy sources, confirm the badge does NOT appear. Click through and
confirm the Library opens on the Health tab with the count, and that a second visit uses the
Library's own default tab.
**Expected:** Positive and negative both hold; the one-shot hand-off stays spent.
**Why human:** Per this phase's own authors, this exact end-to-end behavior "has never been driven"
across two milestones (Phase 235 shipped the base mechanism unticked, and Phase 244 only added the
tab attribution on top of it) — it is the least-verified of the five criteria despite being the
oldest code.

### 6. A + B — the 8-row cross-provider board and 4-axis rows

**Test:** Per `244-VALIDATION.md` § A/B — derive the 8-provider roster from `MODEL_CAPABILITIES`
(never re-typed), attach a file, ask what's in it, and record O1-O4 per provider row, plus the
multi-tool / parallel-thread / long-message axis rows.
**Expected:** The system-prompt attachment line is present and used by at least the majority of
providers; failures are attributed to provider or shared path per O1's rule.
**Why human:** Requires live LLM calls across 8 providers with real API keys; not reproducible
statically.

---

## Gaps Summary

**No BLOCKER gaps.** Every one of the 5 ROADMAP success criteria has code that is present,
internally consistent, and — for the 8 claims independently spot-checked in this report —
corroborated against the live tree rather than merely asserted by the SUMMARYs. The phase's own
authors were unusually explicit and consistent, across 7 separate documents, that **no criterion
has been driven in a browser**, and that is the correct and honest state for a phase whose own
ROADMAP entry says "No success criterion closes on a unit test."

**WARNING-level open items** (not blocking, all tracked with re-open triggers): WR-04 (unbounded
buffer before size cap on cloud attach — robustness), WR-07 (latent lock-expression gap, no current
trigger), WR-08 (an honesty gap in the transcript's "Read" line for Explorer/harness turns), 9
info-level findings, and a stale REQUIREMENTS.md traceability note for SHELL-04/SHELL-05 that
contradicts locked decisions D-244-18/F-1 and should be corrected in the same pass that closes this
verification.

**The single highest-priority action:** drive `244-VALIDATION.md` L-2 (cap-paused composer across a
reload) and L-7 (the app-shell signal, both directions) first — L-2 because the phase's own authors
flag it as the one claim they could not verify by reasoning alone, and L-7 because it is the
criterion with the longest history of never having been driven at all (since Phase 235).

---

_Verified: 2026-09-12_
_Verifier: Claude (gsd-verifier) — solo run; no independent second reviewer exists for this phase
(D-244-21, OV-SOLO-01). This verification is itself a check ON a self-verified build, not a second
independent build review — it re-derived 8 load-bearing claims directly against the live tree
(commands quoted above) rather than accepting SUMMARY prose, and found no discrepancy in the sample._
