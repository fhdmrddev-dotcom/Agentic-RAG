# Phase 244: The Chat Shell and the Composer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `244-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-09-11
**Phase:** 244-the-chat-shell-and-the-composer
**Base SHA:** `5ebd0fbca`
**Areas discussed:** Attachment store + agent awareness · The two inverted doors · The cap-paused
composer · Approval in the thread · (+ SHELL-05 reframe, SHELL-01 measurability, plan decomposition)

---

## Gray-area selection

All four offered areas were selected. No area was skipped.

---

## Reported-bug routing

| Option | Description | Selected |
|---|---|---|
| `BUG-260911-03` — tab badge | minor; its `affected_areas` names `SURF-03` and it routes itself to 244 | ✓ |
| `BUG-260911-02` — first click selects, doesn't open | major; filed 2026-09-10 driving 243's UAT, never checked against production | ✓ |
| `BUG-260816-03` — thread row identity + truncation | major; the surface `SEED-045`'s fold pointed at | ✓ |
| None — keep 244 to its five criteria | Smallest blast radius on three G-5 files | |

**Notes:** all three folded. Frontmatter written back on **seven** reports (the four named by
`SHELL-01..04` plus these three) → `status: folded`, `folded_into: 244`. ⚠ Three of the seven are
**CRLF** files and the first `perl -0777 -pi` pass silently matched nothing on them — the same class of
defect as Phase 242's `check-hot-file-ledger.cjs` passing vacuously over a CRLF plan. Caught by
re-reading the frontmatter rather than trusting the command's exit status.

---

## Area 1 — Attachment store and how the agent learns

### Q1: Where do a chat attachment's bytes live?

| Option | Description | Selected |
|---|---|---|
| Reuse `workspace_files` via the shipped POST | Thread-scoped, TTL, RLS insert, cascade, validator, cap — all already built. Zero migrations | ✓ |
| New `chat_attachments` table | `SEED-042` option (i): cleanest separation, but a migration + bucket + RLS + TTL sweeper duplicating what exists | |
| `documents` with a thread scope flag | Cheapest to embed; puts conversational scratch in the Library table | |

**User's choice:** Reuse `workspace_files`.
**Notes:** this is what makes the ROADMAP's *"Migrations: none expected"* true rather than aspirational.

### Q2: How does the agent learn a file was attached?

| Option | Description | Selected |
|---|---|---|
| A line in the turn's system prompt listing attached files | Deterministic, provider-uniform, no tool call to discover existence | ✓ |
| The user message carries the mention | Simplest wiring, but it edits the person's own words | |
| Agent must call `workspace_list` unprompted | Zero wiring — and the status quo, which is why an attached file is ignored today | |

**User's choice:** system-prompt line.
**Notes:** carries an 8-row cross-provider measurement obligation (full native roster + OpenRouter,
derived from `MODEL_CAPABILITIES`).

### Q3: Embedded and retrievable, or read inline?

| Option | Description | Selected |
|---|---|---|
| Read inline only — never chunked, never embedded | No vectors, no retrieval scope term, no RLS-site touch. Makes *"not in the KB"* structurally true | ✓ |
| Chunked + embedded with a thread scope term | Searchable inside the thread, but reopens `SEED-247` Q2/Q5/Q6 | |

**User's choice:** inline only.

### Q4: Lifetime, and can a person keep one?

| Option | Description | Selected |
|---|---|---|
| Existing TTL + cascade, no promote control in 244 | `template_ttl_hours` (24) + `ON DELETE CASCADE`; promote stays `SEED-247` Q4 | ✓ |
| Add an explicit "keep this in the Library" control now | Natural flow, but needs a folder picker + mint/splice + dedup ruling | |
| A longer TTL for chat attachments than for templates | A second TTL to reason about; only if 24 h is measured wrong | |

**User's choice:** existing TTL + cascade.
**Notes:** the TTL is a **read gate**, not a delete sweeper — an expired row survives invisibly. A plan
must not describe it as deletion.

---

## Area 2 — The two inverted doors

### Q1: What happens to the cloud-import item in the composer's `+` menu?

| Option | Description | Selected |
|---|---|---|
| Re-point it at the thread, not the Library | Both composer doors mean *this conversation*; neither writes to the KB | ✓ |
| Keep it writing to the Library, add a folder picker | Literal reading of criterion 4; leaves the composer as a door into the permanent KB | |
| Both — the modal asks "this thread" or "a Library folder" | Most legible, two-arm modal, both wirings | |

### Q2: Where does the folder choice get enforced?

| Option | Description | Selected |
|---|---|---|
| Route body + forward to `import_single_file`'s existing `folder_id` | No new ingest path; `mint_document_row`/`splice_document` stay the only minter | ✓ |
| Reuse Phase 233's preview + commit path wholesale | Stronger, but mounts a folder-level preview in a single-file flow | |
| Not applicable — no Library arm in chat | Zero folder work | |

### Q3: What is worth sketching, given G-2?

| Option | Description | Selected |
|---|---|---|
| One sketch: the composer's `+` menu and the destination moment | The net-new thing a person sees. ⛔ do NOT sketch the shell signal — it is shipped | ✓ |
| Two sketches — keep the ROADMAP's pair | Honours the flag literally, but redraws an approved shipped surface | |
| No sketch — it is a menu item and a picker | Cheapest; misses where the mental model is formed | |

### Q4 (reconciliation): Answers 1 and 2 appeared to conflict — where does criterion 4's "asks which Library folder" get satisfied?

| Option | Description | Selected |
|---|---|---|
| Build the folder-asking wiring, put its door in the **Library** | Both halves of criterion 4 true; doors un-inverted | ✓ |
| Drop the single-file Library import — Phase 233's folder door is enough | Smallest diff; loses pulling ONE named file without previewing a folder | |
| Keep a Library arm in the chat modal after all | Supersedes the re-point answer; largest diff | |

**Notes:** the apparent conflict was surfaced and resolved rather than assumed — the capability is
built, its **door** moves to the Library, and chat's cloud item points at the thread.

---

## Area 3 — The cap-paused composer

### Q1: How does a cap-paused Deep run stop lying?

| Option | Description | Selected |
|---|---|---|
| Unlock the composer — gate on harness mode, not lock presence | The bug's own analysis says the lock is the wrong instrument | ✓ |
| Keep the lock, fix the copy, make Continue the only door | Honest and minimal, but leaves a thread permanently unusable at exhaustion | |
| Both — unlock AND rewrite the exhausted copy | Closes the named failure mode from both sides | |

**Notes:** unlocking makes the **existing** sentence (*"Start a new message to keep going"*) true, so no
copy rewrite is needed — which is why "Both" was not required. ⚠ The plan must **assert** that posting a
message at `cap_paused` actually starts a run; the server has no refusal, but whether posting clears the
paused row is unverified.

### Q2: Does the harness lock copy change too?

| Option | Description | Selected |
|---|---|---|
| Only the cap-paused case changes; harness copy untouched | A real harness run *is* running and the sentence is true | ✓ |
| Rewrite the lock vocabulary for both cases | Tidier, but widens a G-5 file with no reported defect | |

---

## Area 4 — Approval in the thread

### Q1: What renders it?

| Option | Description | Selected |
|---|---|---|
| Mount the same `PendingAskStack` in chat | Zero-prop; one store slice + one `reconcile` makes "settles in both" structural | ✓ |
| A chat-native compact control | Better fit, but a second renderer of the same pause | |
| `PendingAskStack`, restyled for both homes | One renderer, two contexts; redesigns a shipped panel surface | |

### Q2: Where in the thread?

| Option | Description | Selected |
|---|---|---|
| Inline at the paused message, beside the existing `PausedRunCue` | The cue is already there with no controls — that IS the bug | ✓ |
| Pinned above the composer | Cannot be scrolled past, but competes with the run-status strip | |
| Both — inline plus a pinned reminder | Strongest, but couples to the scroll work `SHELL-01` is fixing | |

### Q3: What proves criterion 3?

| Option | Description | Selected |
|---|---|---|
| A driven G-4 row: answer in chat, watch the panel settle | The complaint is "it looked right and did nothing" | ✓ |
| Component tests both directions + one driven row | Cheaper to repeat; the fence survives | |
| Fences only — defer the browser row | How 243 closed; inadequate for a HIGH-severity perception defect | |

---

## Closing batch — three items that change the plan

### SHELL-05's actual work, given the signal is already built

| Option | Description | Selected |
|---|---|---|
| Verify the shipped signal, then build the tab attribution | Phase 235 closed `SURF-03` **unticked**; nothing has driven criterion 5 | ✓ |
| Tab attribution only — treat criterion 5 as satisfied | Ticking on a code reading repeats the recurring failure | |
| Widen it — a second tenant for approvals (`SEED-231`) | Forbidden by `D-235-03` and enforced by a test | |

### What makes SHELL-01 measurable

| Option | Description | Selected |
|---|---|---|
| Measure root overflow at N heights, panel closed and open | `scrollHeight <= clientHeight` + the rail's **bounding rect** unchanged | ✓ |
| One screenshot at the reported height | Cannot see "returns at another height", the named failure mode | |
| A CSS-chain fence only | Asserts code shape, not rendered result | |

**Notes:** `scrollTop` is explicitly **not** the instrument — it once reported a 1,039 px drag that
never happened. Measure a leaf element's rect.

### Decomposition (G-8)

| Option | Description | Selected |
|---|---|---|
| 4 plans by surface seam | scroll+chat-list · composer · approval · SHELL-05 | ✓ |
| 5 plans — one per SHELL requirement | Two plans would contend for `ChatLayout`/`NavPanel` | |
| 3 plans — shell / composer / signals | Puts four hot files and the highest-severity bug in one worktree | |

---

## Claude's Discretion

- Exact wording and placement of the system-prompt attachment line (pending the 8-row measurement).
- `+` menu item labels and ordering, subject to the approved sketch.
- How the tab attribution renders (count vs dot), once the condition-kind question is traced.
- Test-knob placement for net-new suites — **both** `TARGETS` and `BASELINE`.

---

## Deferred Ideas

Recorded in `244-CONTEXT.md` `<deferred>`, and written back into the seeds themselves so the next sweep
can see them: promote-to-Library (`SEED-247` Q4, narrowed to the seed's only remaining question) ·
embedding an attachment · voice/STT (`SEED-042` half C) · chat-list grouping and pinning (`SEED-045`'s
remaining umbrella) · a second attention tenant (`SEED-231`) · hoisting the attention verdict to a
context provider · `SEED-253` mobile drawer trigger · a separate attachment TTL · `SEED-271` unbounded
`retrieval_top_k`/`rrf_k` · Continue telemetry (`SEED-029`'s one remaining item).

**Register write-backs made during this discussion** — a routing not written into the register is
invisible to the next sweep:

| File | Change |
|---|---|
| 7 × `.planning/reported-bugs/*.md` | `status: open → folded`, `folded_into: 244` |
| `SEED-247` | 5 of 6 questions answered inline; **premise refuted** (`workspace_files` already takes user writes); `priority: high → medium`; trigger narrowed to Q4 |
| `SEED-042` | fork resolved as option (ii); **cost estimate refuted** (the endpoint + RLS already exist); half C explicitly still open |
| `SEED-029` | capability measured **already shipped**; only telemetry remains |
| `SEED-045` | **both folded anchors measured already shipped** at Phase 156; umbrella trigger narrowed |
