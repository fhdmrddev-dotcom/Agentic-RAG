---
phase: 244-the-chat-shell-and-the-composer
plan: "07"
subsystem: chat-composer, cloud-import, agent-prompt, sandbox-hydration
tags: [review-fixes, defect-round, tdd, SHELL-04, BUG-260905-01]
kind: review-fix-round
reviews_closed: 244-REVIEW.md
findings_scoped: 6
findings_fixed: 6
findings_deferred: 12
requires:
  - 244-REVIEW.md (2026-09-12, diff base 223b3ea4f)
  - 244-05-SUMMARY.md
  - 244-06-SUMMARY.md
provides:
  - a threadless composer that refuses visibly instead of silently succeeding
  - deliberate refusals that keep their own status code on the Library cloud-import route
  - a folder_id that cannot be blank or non-UUID
  - attachment hydration that is genuinely once per sandbox session
  - an attachment announcement gated to General mode and filtered to real attachments
affects:
  - frontend/src/components/chat/useComposerAttachments.ts
  - frontend/src/components/chat/composerCopy.ts
  - backend/app/api/connectors.py
  - backend/app/models/connector.py
  - backend/app/services/agent_loop.py
  - backend/app/services/tool_dispatcher.py
key-files:
  created: []
  modified:
    - frontend/src/components/chat/useComposerAttachments.ts
    - frontend/src/components/chat/composerCopy.ts
    - frontend/src/components/chat/__tests__/ComposerAttach.composition.test.tsx
    - frontend/src/components/chat/__tests__/ConnectedFilePickerModal.thread.test.tsx
    - backend/app/api/connectors.py
    - backend/app/models/connector.py
    - backend/app/services/agent_loop.py
    - backend/app/services/tool_dispatcher.py
    - backend/tests/unit/test_244_import_destination_required.py
    - backend/tests/unit/test_244_attachment_hydration.py
    - backend/tests/unit/test_244_attachment_prompt_line.py
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md
    - .planning/phases/244-the-chat-shell-and-the-composer/deferred-items.md
decisions:
  - D-244-07-01 CR-01 takes option (b) — refuse visibly + throw — not option (a), create-the-thread
  - D-244-07-02 folder_id is Annotated[str] validated as UUID, NOT typed UUID, to avoid a runtime-type change on a shipped path
  - D-244-07-03 the WR-02 marker is a weakref.WeakSet of sessions, not an attribute on the session — MagicMock's truthy auto-attribute made the obvious fix unfenceable
  - D-244-07-04 the kind filter lives in the RENDERER and is an ALLOW-LIST on template_input
  - D-244-07-05 the connectors.py split is PROPOSED and declined; the hydrator's kind filter and _output_baseline_seeded are deferred with triggers
metrics:
  commits: 13
  red_green_pairs: 6
  duration: ~2h
  completed: 2026-09-12
---

# Phase 244 Plan 07: Review-Fix Round Summary

**Six defects from phase 244's own review gate, each driven RED before GREEN; all six fixed, and
two of them turned out to be a claim in a comment rather than a bug in a branch.**

⛔ This was a DEFECT ROUND on code the phase shipped hours earlier. No new capability, no
STATE.md, no ROADMAP.md.

---

## The six, in the order they were fixed

| # | Finding | Verdict | RED → GREEN |
|---|---|---|---|
| 1 | **CR-01** both attach doors are a silent no-op with no thread | FIXED — option (b) | `37f260306` → `a10a528a5` |
| 2 | **WR-06** the folder 403 is masked as a 502 | FIXED | `7788d8a06` → `3e320cfab` |
| 3 | **WR-05** `folder_id` accepts `""` | FIXED | `dca60a651` → `962f4387c` |
| 4 | **WR-02** `"ONCE PER SESSION"` is false and is a DoS | FIXED — flag re-homed | `7721f43cc` → `a774104c7` |
| 5 | **WR-03** `"General mode only"` is false | FIXED — gate matched to claim | `733162763` → `eeca91b84` |
| 6 | **WR-01** the announcement has no `kind` filter | FIXED — allow-list in the renderer | `2b70a99e0` → `585cf60e2` |

⭐ **Every one of the six was verified against the CURRENT file before being fixed.** All six
reproduced exactly as the review described; nothing had been changed by a later commit, and no
"could not reproduce" was written. The review's `diff_base` (`223b3ea4f`) and the tree this round
started from differ only by the three tracking commits `3405127ff`, `9762b9e48`, `4885d6838`.

---

## 1 · CR-01 — the threadless composer (`a10a528a5`)

**Chosen: option (b) — refuse VISIBLY, and make the cloud verb THROW.** Both arms of the choice
are recorded because the task asked which, and why.

- `attachLocalFile` sets `refusal` and returns. The refusal renders the same three atoms a server
  422 renders (filename · sentence · dismiss), which is D-244-27's "one vocabulary for one fact".
- `attachCloudFile` sets the refusal and then **throws**. That half is load-bearing:
  `ConnectedFilePickerModal.handleConfirm` branches on the promise, so an early `return undefined`
  took the SUCCESS path. ⚠ The modal still closes either way — its `finally` does that by design —
  so the OBSERVABLE difference is the refusal strip, and the throw is what stops any future caller
  reading a no-op as a success. Both are fenced.
- One new string, `COPY.shared.refuseNoThread`. ⚠ **Not a port** — sketch 236 does not draw this
  case, because it draws a chat that already exists. Its docblock says so, so the `?raw`
  set-equality fence against `COPY.js` is not misread as drift later.

### ⛔ Why option (a) — create the thread at attach time — was refused

The task said to check how the welcome branch sends before choosing. It was checked:
`ChatArea.handleSend:330-364` DOES create the thread on first send (`onCreateThread(scopeFolderId)`),
so option (a) is coherent and is the nicer product. It was still refused, for a reason that is
about blast radius, not taste:

1. `MessageInput` has no `onCreateThread` prop; it would have to be threaded down from `ChatArea`
   (G-5 firing, 70 commits / 35 phases) through `MessageInput` (G-5 firing, 15 phases, with an
   extraction already owed).
2. **It would not work without a second change.** `MessageInput`'s draft-key effect calls
   `clearAttachments()` on every `threadId` change. Creating the thread at attach time changes
   `threadId`, so **the chip the person just made would be wiped by the thread its own creation
   produced** — a different silent no-op, shipped as the fix for this one.
3. It is a capability ("attach before the first message"), not a defect fix, and it needs its own
   fences.

The contract this commit actually honours is narrower and absolute: **a door may never do nothing.**
Recorded with a re-open trigger in `deferred-items.md`.

**Fences:** `ComposerAttach.composition.test.tsx` 10 + **10b (positive control)**;
`ConnectedFilePickerModal.thread.test.tsx` 9, 9b (the throw, at the seam) + **9c (positive
control)**. ⚠ The two positive controls exist because a blanket refusal would satisfy every
negative case above while breaking the door outright — a worse defect than the one being fixed.

---

## 2 · WR-06 — the masked 403 (`3e320cfab`)

One arm, `except HTTPException: raise`, immediately before the catch-all — the arm the sibling
route (`workspace.py:405`) has carried since it was written.

⭐ **The dating is the finding.** `async_mint_document_row`'s 403/404 branches were UNREACHABLE
before `244-06`, which is the first commit that passed `folder_id` at all. `244-06` made a
downstream refusal live without asking what its caller did with it — and its caller relabelled it
as the provider's fault, in a sentence `LibraryCloudImport` renders verbatim.

**RED evidence, measured not reasoned:**
```
AssertionError: {"detail":"Failed to download cloud file: 409: This file is already in the Library"}
assert 502 == 409
```
Parametrized over 403 / 404 / 409 so it fences the CLASS, not one exception type. ⚠ Case 7 (a
GENUINE provider failure still reads 502) already existed and is the positive control; it stayed
green throughout.

⚠ **FIFTH landing on `connectors.py`** (`2051 → 2071 → 2091 → 2102 → 2113`).
`deferred-items.md` item 4's trigger fired. **The split is PROPOSED** — source-browse / preview /
import routes away from connector CRUD — and recorded in `docs/HOT-FILE-LEDGER.md`; it is
**declined for this round** because an extraction in the same commit as a behaviour fix makes a
red unattributable. ⛔ A sixth plan that proposes-and-declines again is the pattern item 4 exists
to stop.

---

## 3 · WR-05 — `folder_id` accepts `""` (`962f4387c`)

`LibraryFolderId = Annotated[str, Field(min_length=1), AfterValidator(_require_library_folder_id)]`
— the shape `ServiceId` already uses two hundred lines up in the same file.

**D-244-07-02: the runtime type stays `str` on purpose.** Declaring the field `UUID` validates the
same shape and then hands a `UUID` object to `supabase-py`'s query builder and to the insert
payload — a runtime-type change on a shipped path, inside a commit whose only job is a defect fix.
Validating the shape and returning the caller's own string changes nothing but what is ACCEPTED.

**The comment was fixed too, as asked.** The class docstring claimed a structural guarantee that
held for ABSENCE and not for BLANKNESS. ⚠ A paragraph asserting a guarantee the code does not have
is worse than no paragraph: it answers the next auditor with *satisfied* and stops the audit.

**RED evidence:**
```
AssertionError: {"id":"doc-1","filename":"Q4.docx","status":"processing"}
assert 200 == 422
```
— i.e. a file landed with a blank destination, having skipped the ownership check entirely
(`ingest_splice.py:154` is `if folder_id:`). Parametrized over `""`, `"   "`, `"root"`,
`"not-a-uuid"`, plus a model-level case and a positive control that a real folder id still
constructs.

---

## 4 · WR-02 — "ONCE PER SESSION" (`a774104c7`)

**What was done: the marker was moved to a home that genuinely survives the iteration loop.** The
comment was true of nothing; it is now true.

⚠ **THE EXISTING TEST COULD NOT SEE THE DEFECT, AND THAT IS THE FINDING.**
`test_hydration_runs_once_per_session` re-used ONE `ctx`, and the flag lived on `ctx` — so it
proved only that parallel tool calls inside a single iteration do not re-copy. The new case 2b
holds the SESSION fixed and varies the ctx, which is what `agent_loop.py:2790` actually does.

**RED evidence:**
```
AssertionError: the attachment was copied AGAIN on the second agent-loop iteration — the guard
is per-ToolContext, not per sandbox session, and the comment says otherwise
assert 2 == 1
```

### ⭐ Measured surprise that changed the design (D-244-07-03)

The obvious fix — `setattr(session, flag, True)` + `getattr(session, flag, False)` — turned
**every** hydration case red with **zero** copies. `getattr` on a `MagicMock` auto-creates a child
mock, which is **truthy**, so the guard read *"already hydrated"* on the very first call.

> **A guard whose correctness depends on the test double's attribute policy cannot be fenced.**

The marker is therefore a module-level `weakref.WeakSet` of sessions, keyed by identity. It needs
nothing of the object but a weakref, and its lifetime is exactly the lifetime of the
`/sandbox/attachments` directory it describes — `SandboxSessionManager` holds the session until
idle eviction, and a new container is a new object that correctly re-hydrates.
`test_a_DIFFERENT_session_hydrates_again` is that positive control and was green at RED and GREEN.

⚠ `_output_baseline_seeded`, one guard above, has the **exact same bug** and was left alone
deliberately — deferred with a trigger, and with a warning not to copy the WeakSet without first
deciding what an output baseline MEANS per iteration.

---

## 5 · WR-03 — "General mode only" (`eeca91b84`)

**The gate was made to match the claim**, not the claim softened. `agent_mode` has three values and
the block was gated on the negation of one other mode; `harness` reached the announcement, and a
harness phase whose `phase_whitelist` omits `execute_code` was told *"read ANY of them … inside
execute_code"* — a promise refused at dispatch, which is the precise failure the explorer exclusion
exists to prevent.

`if body.agent_mode not in ("explorer", "harness"):`, **deliberately redundant** with the enclosing
block. ⭐ A rule enforced by indentation cannot see a value being added to the thing it is
indented under; a gate that states its whole rule can.

**RED evidence:**
```
AssertionError: the attachment note at line 1667 is NOT excluded from harness mode — a phase
whose whitelist omits execute_code is told to use it.
```
⚠ `test_the_harness_fence_can_actually_fire` asserts the **OLD** fence PASSES on the shipped shape
and the new one fails on it — which is exactly why this defect shipped green.

---

## 6 · WR-01 — the announcement's `kind` filter (`585cf60e2`)

Filtered in `_build_attachment_note`, the renderer, so the rule has one home and the dynamic fence
drives the real thing. **An ALLOW-LIST on `_ATTACHMENT_KIND = "template_input"`**, never a
deny-list: migration 068 permits `'template_input'`, `'agent'` and NULL, and a kind added tomorrow
must default to NOT being called something the user attached.

⛔ A thread whose only workspace rows are agent-written now renders **no heading at all** — a
true-sounding heading over an empty list is the same false sentence with the evidence removed.

**RED evidence** (verbatim from the rendered prompt):
```
- scratch-notes.md (44 bytes, text/plain) — readable at `/sandbox/attachments/scratch-notes.md`
```
…under a heading reading *"The user attached these files to THIS conversation … They expire"*.
Both halves false: nobody attached them and their `expires_at` is NULL.

⚠ **Scoped to the ANNOUNCEMENT, as asked.** The HYDRATOR still copies agent files into
`/sandbox/attachments/`. That is now a consistency wart rather than a lie (nothing tells the model
they are the user's), it is bounded by the WR-02 fix, and it is deferred with a trigger rather than
folded in — removing a path the agent may already be using since `244-02` belongs in a plan that
can drive it.

---

## Gates — measured, from the repo root, on a quiet tree

| Gate | Contract | Result |
|---|---|---|
| **Count gate** | no per-file DECREASE, 0 failing | `count gate OK` · **total 8194** · failed 0 · pinned total 7419 · **271/271** |
| **Backend unit** | exactly 71 failed, ZERO headroom | **71 failed / 4636 passed / 2 xfailed / 2 xpassed** |
| **Typecheck** (`tsc -p tsconfig.app.json`) | set diff vs 67 at base | **67 errors**, set unchanged |
| `check-hot-file-ledger.cjs 244` | exit 0 | exit 0 — 265 rows · 26 watched |
| `check-claude-md-size.cjs` | exit 0 | exit 0 — **95 656 chars**, 63.8% of limit |

⭐ **The count gate total rose 8189 → 8194: `+5`, and every one is accounted for** — cases 10 and
10b in `ComposerAttach.composition.test.tsx`, cases 9, 9b and 9c in
`ConnectedFilePickerModal.thread.test.tsx`. No new suite, so no registry edit; both files were
already pinned in both knobs. A growing number is the gate working.

⭐ **The backend gate held at EXACTLY 71 with the failing SET identical**, captured with `grep`
and diffed as a set (never a `| tail`): base 71 lines vs after 71 lines, the only textual
difference being pytest stderr interleaving on two unchanged test names. Passed rose
`4621 → 4636` = **+15**, which is exactly this round's new cases (3 + 5 + 2 + 2 + 3).

⚠ **SEED-171's five known flakes were green on the single count-gate invocation, and one green
sample proves nothing** — they are recorded as provably unmodified by this round, not as "fine".
⛔ **The cap was never touched:** `GSD_VITEST_MAX_WORKERS=2` throughout.

---

## Deviations from plan

There was no PLAN.md — this round is driven by `244-REVIEW.md` plus the operator's six-item list.
Three things were done that the list did not name, each recorded rather than folded in silently:

1. **`COPY.shared.refuseNoThread` landed in the RED commit**, not the GREEN one. It is vocabulary,
   not behaviour, and putting it in GREEN would have meant either a hand-typed literal in the test
   (breaking this suite's "every word is read from the port" rule) or a new `tsc` error in the RED
   commit (breaking the 67-error baseline).
2. **The ledger was synced in ONE commit at the end** (`f4d2eeb81`), not per source commit as
   CLAUDE.md's same-commit rule asks. ⚠ Stated as a deviation, with the reason: the triples must
   be re-derived AFTER the last landing or every row written earlier in the round is stale by the
   time the round closes — which is this ledger's own recurring finding. Six triples were
   re-derived and **two cells were found actively WRONG rather than merely stale**
   (`agent_loop.py` read *"gated General-mode-only"*; `models/connector.py` repeated the
   `folder_id: str` claim WR-05 falsified).
3. **`deferred-items.md` gained items 7-13** — the twelve review findings this round did not
   scope, plus the two the fixing itself produced, plus the record of item 4's trigger firing.

---

## Known Stubs

None. No placeholder, no hardcoded empty value and no "coming soon" was introduced; every change
is a behaviour change with a driven fence.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or schema change at a trust
boundary. ⭐ Three of the six changes NARROW an existing surface: `folder_id` now refuses blank and
non-UUID input at the wire boundary (WR-05), the attachment announcement no longer leaks
agent-written filenames into the system prompt as user content (WR-01), and the harness exclusion
removes a prompt line from a mode whose tool set cannot honour it (WR-03).

---

## What is still open, honestly

**Twelve of the review's eighteen findings are NOT fixed** and were never in scope: `WR-04`
(unbounded cloud download before the 10 MB cap), `WR-07` (`workflowLocked` — latent, no current
writer of `workflow_runs.status='cap_paused'`), `WR-08` (`Read <file>` for a turn that could not
read it — ⚠ this round made it worse-SHAPED, since WR-03 adds a second mode for which the line's
justification does not hold), and `IN-01`…`IN-09`. Each is in `deferred-items.md` with a concrete
re-open trigger, and `244-REVIEW.md`'s frontmatter now records which are resolved and which stand.

⛔ **Nothing here was driven in a browser.** Every claim above is a unit-level or source-level
measurement. The lived-experience half of CR-01 — open a new chat, click `+`, pick a contract, and
see a sentence instead of silence — is a G-4 UAT row and is owed.

_Plan 07 — 2026-09-12. Solo run (OV-SOLO-01): no independent second reviewer exists, so the fixes
to a review are not themselves independently reviewed._
