---
seed_id: SEED-169
title: Chat says the workflow made nothing — RunCard's file badge reads 0 for a real deliverable, and ThreadRunLine carries no file data at all
created: 2026-08-17
planted_during: Phase 195 (Show the Deliverable) — plan 195-08, at phase close
status: planted
priority: medium
relates_to:
  - SEED-148 (workflow output files not surfaced) — the origin of Phase 195. ⚠ **This seed is the
    half 195 did NOT take.** 195 fixed the RUN SURFACE and the panel; the CHAT receipts still lie.
  - SEED-170 (records that name OutputFileCard for work it does not do) — the sibling seed planted by
    the same plan. Both are cheap corrections in files Phase 195 deliberately did not open.
  - "195-CONTEXT.md D-14" — the decision that declined this fix, recorded as a MEASURED LIE rather
    than as an unknown. This seed is that decision's discharge.
  - "195-CONTEXT.md D-13" — chat gains NO new file affordance in Phase 195. ⚠ **This seed does not
    contradict D-13 and must not be read as doing so:** making an existing badge tell the truth is
    not a new affordance. Whoever picks this up should say which they are doing.
  - "BUG-260816-05" — the operator's *"see in the future files it produced"* complaint. Its FILE half
    is delivered on the canvas; the chat-side count is still wrong.
  - "docs/HOT-FILE-LEDGER.md — MessageItem.tsx (29 phases, extraction UNDISCHARGED) and RunCard.tsx
    (9 phases)" — the two files this fix opens, and the reason it was declined.
trigger_when: >
  ANY phase that opens `frontend/src/components/chat/RunCard.tsx` or
  `frontend/src/components/chat/MessageItem.tsx` for any reason, OR any phase touching
  `frontend/src/components/chat/ThreadRunLine.tsx`, OR a user reporting "chat says my workflow made
  nothing" / "the run card shows 0 files but the file is right there", OR any phase scoped to chat
  run receipts. ⚠ **G-5 fires on BOTH files — a refactor recommendation is owed FIRST.**
trigger_paths:
  - "frontend/src/components/chat/MessageItem.tsx"
  - "frontend/src/components/chat/RunCard.tsx"
  - "frontend/src/components/chat/ThreadRunLine.tsx"
surface: Agentic-RAG
---

# SEED-169: chat's run receipts say a workflow produced nothing, while a 38-40 KB `.docx` sits in the workspace

## The lie, in one sentence

**A workflow run that produced a real deliverable renders a file badge reading `0` in chat, and the
chat run line renders no file information at all — while the run surface and the workspace panel both
show the file, named, sized and downloadable.**

## What was measured, and where

⚠ **This is a MEASUREMENT taken during Phase 195, not a suspicion.** Two independent readings:

**1. The badge derives its count from the wrong field.** `RunCard.tsx:179-189` computes the file count
by reducing over `tool_calls` and parsing an **`output_files`** key out of each call. That is the
**sandbox** shape — what `execute_code` returns.

**2. A workflow emit returns a different shape entirely.** `_exec_llm_emit`
(`backend/app/services/harness/phase_types.py`) returns **`path` / `output_file`** on its success
path. The file is persisted as a **workspace file** (`ws_write_file`, thread-scoped) by
`_handle_render_template` (`tool_dispatcher.py:3550-3578`), which also emits `workspace_file_written`
on the producer stream.

⇒ **`output_files` is never present on a workflow emit, so the reduce sums to zero.** The badge is not
stale, not racing and not mis-rendered — **it is reading a field the producer never writes.**

**3. `ThreadRunLine.tsx` carries no file data at all.** `grep -c "output_files"` → **0**. Phase 194.1's
chat run receipt has no file concept whatsoever, so there is nothing to be wrong — which is a
different defect from a wrong number and should be fixed as one.

**4. The consequence, confirmed live in the browser during Phase 195's baseline.** On the very thread
that owns a completed Northwind QBR deliverable,
`document.querySelector('[data-testid="output-file-card"]')` returned **`null`**. The only trace of
the deliverable anywhere in chat is plain markdown inside the assistant message: *"Produced the filled
deliverable: /Northwind-QBR-Template.docx"*. Meanwhile `workspace_files` held the row, and the file
downloaded to disk at **39,660 bytes — byte-exact with `size_bytes`** — a CRC-clean OOXML package
carrying 5,843 characters of filled report prose.

**So the file is real, transferable and openable, and chat says the run made nothing.**

## Why Phase 195 declined it, stated as a decision rather than an omission

`195-CONTEXT.md` **D-14** recorded this as *a MEASURED LIE that this phase declines*, and the reason is
structural rather than a matter of effort:

- Fixing the badge opens **`RunCard.tsx`** — **21 commits / 9 phases / 608 lines**, G-5 FIRES.
- Fixing the chat receipt opens **`MessageItem.tsx`** — **57 commits / 29 phases / 856 lines**, G-5
  FIRES with its **extraction obligation UNDISCHARGED**.
- Phase 195 was already converting **three** files onto a new shared row. Opening a 29-phase file with
  an outstanding refactor debt inside that phase would have meant either taking the extraction too
  (doubling the phase) or spending the obligation without discharging it.

⚠ **Phase 195 kept `OutputFileCard`'s public prop shape BYTE-IDENTICAL specifically so that neither
call site was opened**, proved three ways against a named base SHA. **That property is what this seed
would spend.** Whoever picks it up should know they are cashing in a boundary that was defended on
purpose.

## What "fixing it" actually means — and the trap in the obvious fix

⚠ **DO NOT simply widen the reduce to also count `path` / `output_file`.** That would make the number
non-zero without making it *true*, and it re-creates a scoping problem Phase 195 spent the phase
removing:

- The workspace-file read is **thread-scoped**, and there is **no run-attribution column** on
  `workspace_files`. A run is only *near*-1:1 with a thread (**226 runs / 222 distinct threads**).
- ⚠ **`run_claim` LOOKS like the attribution field and IS NOT.** It is 100% NULL across every row and
  belongs to Phase 141 template-asset context isolation. `kind` is likewise NULL on 84/86 rows. **Do
  not repurpose either.**
- Phase 195 hit exactly this and answered it with **honesty in the copy**, not with a new column: the
  run surface's region is labelled **`Files in this run's workspace`**, because naming *where* the
  files are is the only thing a thread-scoped read can prove. **A chat badge that says "3 files" about
  a thread's workspace is the same overclaim in a smaller box.**

**So the real question this seed poses is a product one, and it should be answered before any code is
written:** *what should a chat run receipt claim about files it cannot attribute to the run?* The
honest options are (a) count nothing and say nothing, as today — but say it deliberately rather than
by a field-name mismatch; (b) count the thread's workspace files and label them as such; or (c) build
real run-level attribution, which is the deferred item below.

## The deferral this sits next to

**Run-level file attribution** — a real `run_id` on `workspace_files`, written by both the emit path
and the `execute_code` persist path — is deferred by `195-CONTEXT.md` **D-01**, with its own re-open
trigger: *"a workflow-run thread that is ALSO an agent chat becomes common (today: 1 of 222), or any
user reports unrelated files shown as a run's output."* **If that trigger fires, it should be taken
together with this seed** — attribution is the only thing that makes an honest per-run count possible,
and doing this seed first would build a count that attribution then has to redo.

## Re-open trigger

**Any phase opening `RunCard.tsx` or `MessageItem.tsx`, or any phase touching `ThreadRunLine.tsx`, or
a user reporting *"chat says my workflow made nothing."*** ⚠ Both files fire G-5, so **the phase owes a
refactor recommendation FIRST** — this is a fix to fold into a refactor, not a reason to open a hot
file on its own.

*Not a date. Not "next milestone". A named file and an observable user report.*
