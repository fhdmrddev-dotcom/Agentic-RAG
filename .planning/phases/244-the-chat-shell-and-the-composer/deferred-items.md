# Phase 244 — deferred items (out-of-scope discoveries)

Opened by `244-03`. Append, never rewrite — a later plan's entry goes at the bottom.

---

## D-1 · `ChatHistoryColumn.rowIdentity.test.tsx` goes RED between 00:00 and ~02:00 local

**Found by:** `244-03`, running the wave's full count gate at 00:17 local on 2026-09-12.
**Owner:** `244-01` (it authored and pinned the suite).
**Status:** NOT fixed here — out of scope, and editing another plan's test file mid-wave
collides with the registry merge. The fix is one line and is written out below.

**Measured cause, not guessed.** The suite builds its fixtures relative to wall-clock now:

```ts
const NOW = Date.now()
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString()
const HOUR = 3_600_000
// …threads at iso(HOUR) and iso(2 * HOUR)
```

…and the case `FOLDER mode still groups an unscoped thread under an 'Unfiled' HEADER` asserts
`screen.getAllByText("Today").length > 0`.

Between local midnight and 02:00, `NOW - 1h` and `NOW - 2h` fall on the **previous calendar
day**, so the date grouper emits `Yesterday` and `Today` is never rendered. Confirmed at the
moment of the red run:

```
now      : Sat Sep 12 2026 00:19:37 GMT+0400
1h ago   : Fri Sep 11 2026 23:19:37 GMT+0400
same day?: false
```

⚠ **This is reproducible, not a flake.** It was green when `244-01` pinned it at 7 (it ran on
2026-09-11 well before midnight) and it will be green again after ~02:00 local. It re-breaks
**every night**, for two hours, on a shared gate — which is the worst shape for this class of
defect, because the next agent to meet it will read it as drift or as their own fault.

**The fix (one line).** Anchor the clock instead of reading it:

```ts
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-11T12:00:00Z")) })
afterEach(() => { vi.useRealTimers() })
```

…or build fixtures from a midday anchor (`new Date(); d.setHours(12,0,0,0)`) rather than from
`Date.now()`. Either removes the boundary entirely. ⛔ Do NOT "fix" it by deleting the `Today`
assertion — the grouping IS what that case guards.

**Sweep obligation:** any other suite deriving fixtures from `Date.now()` minus hours has the
same trap. Worth one `grep -rn "Date.now() -" frontend/src --include=*.test.tsx` at the phase
close.

---

## D-2 · `LibraryPage.initialTab.test.tsx` — 5000 ms timeouts, shifting failing set

**Found by:** `244-03`, same gate run.
**Owner:** nobody in Phase 244 — the file is untouched by the whole phase.
**Status:** NOT fixed here. Candidate **seventh entry for `SEED-171`**.

**Provably unmodified by `244-03`**, and stronger than that: `LibraryPage.tsx` has **no import
path** to either frontend file this plan changed (`grep -rn 'ChatArea\|MessageItem'
frontend/src/pages/LibraryPage.tsx` → no matches), and the plan's only other production change
is Python. The suite's behaviour at this HEAD is identical to base by construction.

**The failing SET is never the same twice** — SEED-171's defining signature:

| Run | Failing |
|---|---|
| inside the full gate | 2 (`lands on Documents…` STACK_TRACE_ERROR; `lands on Health…` *"Found multiple elements with the role `tab` and name `Health`"*) |
| with one sibling suite | 1 (`lands on Documents…`) |
| **alone, nothing else on the box** | **6**, every one a flat 5000 ms timeout (one at 36 718 ms) |

⛔ **The cap was NOT touched at any point** — `GSD_VITEST_MAX_WORKERS=2` throughout, per the
standing rule that adjusting the cap is measured NOT to fix these. ⚠ *"Failing worse ALONE than
under load"* is the observation that rules oversubscription out here, the same way SEED-171's
"one suite flakes in isolation" did.

⚠ **One green sample would prove nothing and there wasn't one** — this suite was red on all
three invocations. It is named rather than left unlooked-for.

---

## `244-05` — DEFERRED, with named triggers

### 1. The `+` menu shows TWO connectors headings (cosmetic, recorded not hidden)

Sketch 236's third menu item is `Tools and connectors` (`COPY.a.itemConnectors`). The shipped
`ConnectorsFlyout` **inlines the whole connectors panel** rather than being a door, and its own
header already reads `Connectors`. So the built menu now carries a section label
(`Tools and connectors`) directly above the flyout's own `Connectors` title.

⛔ **The obvious fix — re-label the flyout — was REFUSED, and the reason is not taste.**
`MessageInput.connectors.test.tsx` asserts `screen.getByText("Connectors")`, an exact full-string
match, at BASELINE 5 (measured 9 cases at this base). Renaming a shipped surface so a NEW fence can
pass is breaking a guard to make a guard, and `ConnectorsFlyout.tsx` is not in this plan's
`files_modified` or in the ledger's scan list.

**Re-open trigger:** the next plan whose `files_modified` names
`frontend/src/components/chat/ConnectorsFlyout.tsx` — `244-06` touches this same menu and is the
natural home. The fix is to drop the flyout's internal header and let the menu's section label be
the only title, updating `MessageInput.connectors.test.tsx` in the same commit.

### 2. Remove is a DETACH, not a DELETE — `workspace.py` has no DELETE route

Measured at this base: `backend/app/api/workspace.py` ships **six** routes — one `POST /files` and
five GETs — and **no DELETE**. So removing an attachment chip cannot un-upload the file. The bytes
stay in `workspace_files` inside their 24h read gate and are still hydrated into
`/sandbox/attachments/` for the thread by `244-02`.

`244-05` closes what it can: a session-scoped detach registry
(`ChatAttachmentChip.detachAttachment`) keeps a removed file out of the composer AND out of the
transcript's association rule, fenced by `ComposerAttach.composition.test.tsx`.

⛔ **Its limit, stated rather than hidden:** after a hard reload, within the TTL, a detached file
falls back inside the association window and re-associates with the next sent message. ⛔ Do NOT
close this with a persisted client-side hide — that would claim the bytes are gone when they are
not, which is the exact dishonesty `SHELL-04` exists to remove.

**Re-open trigger:** any plan that adds `DELETE /threads/{id}/workspace/files/{file_id}`. At that
point the registry becomes a real delete call and this note is deleted with it.

### 3. `MessageInput.tsx` — the extraction is OWED, not taken

`244-05` grew it `643 → 855` on a file already FIRING G-5 at 15 phases. The named seam
(`useComposerAttachments` + a `ComposerChipsRow` container) is written into
`docs/HOT-FILE-LEDGER.md` § `frontend/src/components/chat/MessageInput.tsx` — `244-05`.

**Re-open trigger:** the next plan whose `files_modified` names this file must **propose the
extraction first** — the `retrieval_service.py` / SEED-224 rule applied here.

> ✅ **DISCHARGED at `244-06` — and recorded here rather than deleted, because the trigger FIRING
> as written is the useful fact.** `244-06`'s `files_modified` named the file, so the rule bound.
> `useComposerAttachments.ts` was extracted and `MessageInput.tsx` went **`855 → 821` while gaining
> the cloud door**. ⛔ **The `ComposerChipsRow` half is STILL OWED** — see item 5 below.

### 4. `backend/app/api/connectors.py` — the extraction is OWED for a THIRD landing running

`2051 → 2071` (Phase 239 gap-closure) → `2091` (`238-04`) → **`2102` (`244-06`)**. Each landing was
small and each was defensible on its own; the pattern is not. `244-06` added eleven lines — one
request-body parameter and one forward — and is honoured by construction **for those eleven lines**,
which is narrower than "the file is fine".

**Re-open trigger:** the FOURTH landing. A plan whose `files_modified` names this file must propose
the split (the source-browse / preview / import routes away from connector CRUD) before adding
another line, in the same shape `244-05` used for `MessageInput.tsx` — which item 3 shows works.

### 5. `ComposerChipsRow` — the second half of `244-05`'s named seam, still owed

`244-06` took `useComposerAttachments` (the *behaviour* half) and deliberately left the *layout*
half. The chips row is still inline JSX in `MessageInput.tsx`, hoisted there by `244-05` under
`D-244-26`.

**Why not now:** moving it is a layout change whose blast radius runs through
`ComposerAttach.composition.test.tsx`'s DOM-order fences, and mixing it into a commit that also
re-points a door would make a red impossible to attribute.

**Re-open trigger:** the next plan whose `files_modified` names
`frontend/src/components/chat/MessageInput.tsx`.

### 6. ⛔ `BUG-260905-01` is BUILT but NOT VERIFIED-CLOSED

All three halves the operator reported are built and fenced (see the report's own
*Disposition at Phase 244 plan 06* table). `status:` stays **`folded`** and `verified_closed_by:`
stays **empty**, deliberately: a green unit test is not a reproduction. The close belongs to the
driven rows in `244-VALIDATION.md`, against a real Google Drive connection.

**Re-open trigger:** it is already open — `/gsd:verify-work` owns it.

---

## `244-07` — the review findings NOT fixed, each with a trigger

`244-07` was scoped by the operator to SIX of `244-REVIEW.md`'s eighteen findings (CR-01, WR-01,
WR-02, WR-03, WR-05, WR-06). The other twelve are listed here rather than left in a report
nothing sweeps — a finding that only exists in a review file is a deferral with no re-open,
which is a deletion that looks like a decision.

### 7. `WR-04` — the cloud attach buffers the whole provider file before the 10 MB cap

`workspace.py:400` calls `fetch_cloud_file` unbounded and checks `len(raw) > MAX_FILE_SIZE`
afterwards. A 2 GB pick from the person's own Drive is resident in a worker (`WORKER_COUNT=2`)
before the 422. ⚠ **Pre-existing on the Library path** (`import_single_file` has the same
shape) and inherited by a NEW route that documents a guard it does not have.

**Re-open trigger:** the next plan whose `files_modified` names `backend/app/api/workspace.py`
or `backend/app/services/sources/import_service.py`. The fix is to resolve the provider's
declared size from the listing the picker already rendered and refuse BEFORE `read_file`; the
stronger version is a streaming read with a running byte counter.

### 8. `WR-07` — `workflowLocked` unlocks a genuine harness lock when the run is cap-paused

`ChatArea.tsx:140`. ⚠ **Latent, not firing:** the review looked for a writer of
`workflow_runs.status = 'cap_paused'` and could not find one (every `cap_paused` write it
located targets `runs.status`). D-244-08 asked for both conjuncts and one was implemented.

**Re-open trigger:** either a plan whose `files_modified` names `ChatArea.tsx`, or the first
writer of `'cap_paused'` onto `workflow_runs.status` — whichever comes first. ⛔ Do not close
this by asserting it is unreachable: the value is schema-valid (`063_dual_mode_continue.sql:57`,
added explicitly "on BOTH status columns") and is read as live by `db/workflows.py:1320`.

### 9. `WR-08` — the transcript says `Read <file>` for a turn that could not read it

`MessageItem.tsx:455-465`. In Explorer mode the announcement is gated out AND the tool set
carries neither `execute_code` nor a workspace tool, so no hydration happens either — and the
row still says `Read contract.pdf`, in the past tense. ⚠ **`244-07` made this WORSE-SHAPED,
not worse:** WR-03 adds `harness` to the excluded set, so there are now two modes for which the
line's justification does not hold. The count of affected modes changed; the defect did not.

**Re-open trigger:** the next plan whose `files_modified` names `MessageItem.tsx`.
⚠ The wording half (`Available to the agent: X` instead of `Read X`) is an OPERATOR call — the
strings are ported from sketch 236's `COPY.js`. The mode gate is not an operator call.

### 10. `IN-01` … `IN-09` — nine info-level findings, carried verbatim

Not restated here; they are in `244-REVIEW.md` with file:line, and the review file is the
record. Two are worth naming because they are one-liners a future plan will want:
`IN-03` (two new files disagree about how many routes `workspace.py` ships — SIX vs SEVEN; the
seven is correct) and `IN-07` (the lockstep fence sweeps `TemplateUpload.tsx` only, so a
hand-typed `accept=` re-introduced in `MessageInput.tsx` would be invisible to it).

**Re-open trigger:** each rides the next plan that names its file.

---

## `244-07` — two findings the FIXING produced, recorded because nobody else saw them

### 11. The HYDRATOR still copies agent-written files into `/sandbox/attachments/`

`WR-01` was fixed in the ANNOUNCEMENT (`_build_attachment_note`) because that is what the
operator's list asked for. The review named a second half: `_hydrate_thread_attachments` reads
the same unfiltered listing, so `workspace_write` output is still copied into a directory
called `attachments`. ⚠ **This is a consistency wart, not a lie** — nothing tells the model
those files are the user's any more — and it is bounded by the WR-02 fix, which makes the copy
happen once per sandbox session rather than once per iteration.

⛔ **Not folded in** because it is a behaviour change beyond the stated scope: agent files have
been reachable at that path since `244-02` shipped, and removing a path the agent may already
be using belongs in a plan that can drive it.

**Re-open trigger:** the next plan whose `files_modified` names
`backend/app/services/tool_dispatcher.py`. The fix is one line, in the helper, mirroring
`_ATTACHMENT_KIND`.

### 12. `_output_baseline_seeded` has the EXACT bug WR-02 fixed, one guard above it

`tool_dispatcher.py:1979-1982` stores its flag on `ctx`, and `ctx` is rebuilt every agent-loop
iteration — which is the whole of WR-02. It was left alone deliberately: it is a different
claim on a different cadence (an output-file BASELINE arguably SHOULD be re-snapshotted per
iteration), and changing it inside a defect fix for a different guard would make a red
unattributable.

⚠ **Stated rather than silent, because the shipped comment on the attachment guard said "in
the exact shape of the `_output_baseline_seeded` guard" — and that shape was the defect.**
Whoever picks this up must decide what the baseline MEANS before moving its flag, not copy the
WeakSet.

**Re-open trigger:** the next plan whose `files_modified` names
`backend/app/services/tool_dispatcher.py`.

### 13. `deferred-items.md` item 4's trigger FIRED and was honoured by proposal, not by action

`backend/app/api/connectors.py` took its FIFTH landing (`2102 → 2113`). Item 4 says the fourth
must propose the split before adding a line. The split IS proposed — source-browse / preview /
import away from connector CRUD — and recorded in `docs/HOT-FILE-LEDGER.md`, and it was
declined for this round because a defect fix and an extraction in one commit make a red
unattributable.

**Re-open trigger:** the SIXTH landing. ⛔ A sixth plan that proposes-and-declines again is
the pattern item 4 exists to stop; at that point the split is the plan.

### 14. The tombstone is a LISTING fix; the DETACH and the transcript's own read are not covered

**Found by:** `244-08`, while closing `T-244-05-05`.

`GET /threads/{id}/workspace/files?include_expired=true` now lets an expired attachment reach
the transcript, and the chip renders `No longer available`. ⛔ **Three things that fix does NOT
do, named so nobody reads the row as wider than it is:**

1. **A DETACHED file is still detached forever, and the detach registry is still session-scoped.**
   `ChatAttachmentChip.tsx`'s own docblock already records this (*"after a hard reload, within
   the TTL, a detached file falls back inside the time window"*). Widening the listing changes
   neither arm. The honest close is still a DELETE route on the workspace door.
2. **The transcript's expired rows are bounded by whatever the PANEL last fetched.** The slice
   is filled by `usePanelReconcile` on thread-switch and by the `run_completed` self-heal —
   both now ask for expired rows — but nothing re-fetches when a file expires *while the tab is
   open*. Within a session, a chip crosses from live to expired only because `expiryCaption`
   re-derives on the next render; it does not poll. That is correct for a flat `24h` promise
   (D-244: *"never a per-second countdown"*) and it means a tab left open for a day can show a
   live chip for a file that has just expired. The chip's CONTENT route already 404s, so the
   worst case is an optimistic label, not a false download.
3. **`useResolvedFileId` was left on the GATED default deliberately.** It backfills a missing
   `id` by path for the PANEL's selected file, and an expired row has no honest use there.
   Recorded because it is the one caller of `getThreadWorkspaceFiles` that does NOT pass
   `includeExpired`, and a future reader will wonder whether that was an oversight.

**Re-open trigger:** a plan that adds a DELETE route to `backend/app/api/workspace.py`, or the
first UAT row that drives an attachment across its TTL boundary in a single open session
(`244-VALIDATION.md` has no such row today).

### 15. Three suites were RED at `5edb08292` and are outside the count gate's pinned set

**Found by:** `244-08`, running `src/providers src/components/panel src/components/chat src/lib`.

- `src/lib/model-info.test.ts` — `expected 'mid' to be 'high'` (a costTier pin)
- `src/lib/__tests__/termMap.test.tsx` — 19 mapped keys against a contract table of 18
- `src/components/panel/__tests__/PendingAskCard.retired.baseline.test.tsx` — `expected 766 to
  be 737`, a source-LENGTH pin

⛔ **Inherited, and provably not this round's.** None appears in
`git diff --name-only 5edb08292 HEAD`, and `PendingAskCard.tsx` is byte-identical at the base
commit (765 lines both sides) — so the source was already 29 lines past its pin before this
work began. ⚠ **They are invisible to `vitest-count-gate.cjs`**, which read `failed 4` on the
same tree and named none of them: these three files sit in NEITHER knob. That is the
`sourceComposition.test.tsx` situation CLAUDE.md already records, three more times.

**Re-open trigger:** the next plan whose `files_modified` names `model-info.ts`, `termMap`, or
`PendingAskCard.tsx` — at which point the pin must be re-baselined deliberately rather than
discovered.

### 16. ⚠ ANOTHER WRITER WAS ACTIVE IN THIS WORKING TREE DURING `244-08`

**Found by:** `244-08`, at 09:0x local on 2026-09-12.

Five frontend files were modified in the worktree *during this session*, by something that is
not this executor — `frontend/src/components/admin/ControlRoomPage.tsx`,
`ModelDiscoveryPanel.tsx`, `ModelRegistryTab.tsx`, `frontend/src/lib/api.ts` and
`frontend/src/lib/api/admin.ts` (+438/-17, mtimes 08:42–08:47). They were absent from
`git status` when this session started.

⛔ **They were left strictly alone** — not staged, not reverted, not tested against. But they
were PRESENT on disk for every gate reading recorded in `244-08-SUMMARY.md`, so the
whole-tree verdicts are not solely attributable to this round. The per-file readings are: the
count gate's per-file deltas are `+6` and account for exactly the six cases added here, and the
backend failing-test-id SET is byte-identical to the pre-work baseline.

⚠ This is the condition CLAUDE.md warns makes a shared gate non-deterministic. **A gate run
while another agent writes the same tree measures both of you.**

⚠ **AND IT KEPT GOING, WHICH MATTERS FOR THE ONE ZERO-HEADROOM GATE.** By 09:07:46 two BACKEND
files had joined them — `backend/app/api/admin.py` and `backend/app/services/model_registry.py`.
**The timing is the finding:** this executor's backend BASELINE ran ~08:35–08:45 (before those
edits) and its final backend run ~09:20–09:26 (after them). The two readings are therefore
**not** taken on the same tree.

⭐ **The comparison survives it, and the reason is that a SET was captured rather than a count.**
The failing **test-id set** is byte-identical across the two runs — 71 ids each side, `diff`
empty — so neither this round's changes nor the other writer's introduced a new backend failure.
Had only the count `71` been recorded, a one-in/one-out swap would have been invisible. This is
CLAUDE.md's *"capture the SET, never a tail"* rule paying for itself.

**Re-open trigger:** none — this is a standing hazard, not a defect. Recorded so a later reader
of this phase's numbers knows the tree was not quiet.

---

## `244-09` — the phase-wide ledger gate is RED for a plan that has not run yet (inherited, out of scope)

`node scripts/check-hot-file-ledger.cjs 244` exits **1** at `244-09`'s base (`a2c8da1af`) and still
exits 1 at its close. The single finding is **not this plan's**:

```
  scan list: 265 rows · subject: 61 files · watched: 29
  [no-row] frontend/src/stores/streamsStore.ts   (named by 244-13-PLAN.md)
```

⚠ **Measured at base BEFORE this plan's first edit, so it is inherited rather than introduced** —
the base run printed byte-identical output. `244-09` touched neither `streamsStore.ts` nor
`244-13-PLAN.md`.

⭐ **The parse is NOT vacuous, and that is the thing worth asserting.** Phase 242 recorded a run
reporting `subject: 0 files` on a CRLF plan — exit 0 over nothing parsed. This run reads
`subject: 61 files · watched: 29`, so the gate genuinely inspected the phase. Scoped to this plan's
own file it is clear: `check-hot-file-ledger.cjs --files frontend/src/components/layout/NavPanel.tsx`
→ `ledger gate OK`, exit 0.

⛔ **Not fixed here, deliberately.** Adding a row for a file this plan does not modify, on behalf of
a plan that has not been written into the tree, would put a triple in the ledger derived at a commit
before the work that makes it hot — the exact staleness this ledger's own rows keep recording. It
also risks a `[duplicate-row]` collision with `244-13` when it runs.

**Re-open trigger:** `244-13` executing. Its first ledger obligation is `streamsStore.ts`'s row +
section, in the same commit. If `244-13` is cut from the phase, the row is still owed by whichever
plan next names that file — the gate will keep saying so.

---

## `244-09` — the count gate RED on both runs, with a DIFFERENT suite each time (SEED-171's defining property, reproduced)

Two full `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` runs from the repo root, on a
**byte-identical tree** (clean `git status`, same HEAD `9de33f29c`), one sibling agent active
(`244-10`, backend-only, different worktree):

| run | verdict line | the one failing case |
|---|---|---|
| 1 | `total 8215 · failed 1 · pinned total 7426` | `src/components/library/__tests__/sketchComposition.test.tsx` — **its own POSITIVE CONTROL** (*"the page renders its heading — the mount harness works"*), `STACK_TRACE_ERROR` |
| 2 | `total 8215 · failed 1 · pinned total 7426` | `src/pages/WorkflowRunPage.test.tsx` — *"re-reads the ask slice on wake"*, `AssertionError: expected 0 to be greater than 0` |

⭐ **The failing SET is never the same twice** — SEED-171's defining property, and the reason it says
no number can be pinned for this. ⭐ **`WorkflowRunPage.test.tsx` IS one of SEED-171's five named
suites** (added at Phase 195's close), and `expected 0 to be greater than 0` is the exact signature
SEED-171 records for `WorkflowBuilderPage.canvas.test.tsx`. ⚠ **`sketchComposition.test.tsx` is NOT
one of the five** and is proposed as a **sixth** below.

**Filenames were captured from the gate's own persisted JSON BEFORE either re-run**, per CLAUDE.md.
⛔ **The cap was NOT touched.** It held at `2` for every invocation.

**Both files are provably unmodified by `244-09`.** Its whole diff against base `a2c8da1af` is seven
files — `244-09-UAT-ROW.md`, `deferred-items.md`, `CLAUDE.md`, `docs/HOT-FILE-LEDGER.md`,
`NavPanel.tsx`, `ChatLayout.scrollFrame.test.tsx`, `scripts/vitest-count-gate.cjs` — and neither
failing file is among them; `git status --short` is empty.

⭐ **And for `sketchComposition.test.tsx` there is a STRUCTURAL argument, not just a green sample:**
its only source import path is `@/pages/LibraryPage` (dynamic), and `grep -n NavPanel
frontend/src/pages/LibraryPage.tsx` returns **nothing** — **the suite's module graph cannot reach the
one source file this plan changed.** Run in isolation at this HEAD it reads `46 passed | 1 skipped`,
`failed 0`, in 15.63s of test time — a slow suite whose own harness control timed out under the
shared gate's load. ⚠ Stated as *"provably unmodified"*, never *"fine"*: **one green sample of a
flaky suite is not proof of innocence.**

⛔ **`ChatLayout.scrollFrame.test.tsx` read `6 6 0` on BOTH runs** (BASELINE 6, actual 6, delta 0) —
this plan's `+1` is fully attributed with no residual, and the gate reported **no per-file decrease
anywhere**. The sole `RESULT: COUNT GATE VIOLATED` reason on both runs was `[failing-tests]`.

**Re-open trigger:** `sketchComposition.test.tsx` failing a third time in any phase → add it to
`SEED-171`'s named set as the **sixth** cap-independent flaky suite, so a future red can be triaged
in one step instead of re-derived. It is deliberately NOT added to the seed here: `244-09` is a
gap-closure round (G-7) and editing a shared register outside its `files_modified` during a parallel
wave is a merge hazard the finding does not justify.

---

## `244-11` — two deferrals and one confirmation

### 1. ⛔ DEFERRED: consuming `Retry-After: 10` on a snapshot 503

The snapshot endpoint sets `Retry-After: 10` alongside its 503 body (`threads.py:517`/`:526`), and
`244-11` cites that header as **evidence the server is explicit** — it does **not** read it.
**Consuming it is an automatic-retry feature**, which is a new behaviour and not a gap fix (G-7),
and an automatic retry on a 503 storm is an amplification risk the plan's threat register accepts
precisely by NOT adding one (`T-244-11-03`). Recovery stays exactly one user click on the shipped
**Retry** control.

**Re-open trigger:** a phase that scopes snapshot/reconcile *resilience* (backoff, retry policy,
degraded-mode) rather than *legibility*. At that point read the header, and decide the backoff
there — never inside a banner.

### 2. ⛔ DEFERRED: the 503's own root cause

`244-11` closes the **legibility** half of UAT `G-3` (the UI now says a snapshot failed). It does
**not** touch why the snapshot fails. Partially established: `redis.xinfo_stream(f"run:{rid}")`
either times out (2.0 s) or errors; a `ResponseError('no such key')` is correctly degraded at
`:508`. ⚠ A `cap_paused` run is **non-terminal**, so it keeps being probed on every thread open,
and the seeded `cap_paused` thread produced both observed 503s — **whether that is causal was NOT
established and must not be written down as though it were.**

**Re-open trigger:** the UAT row's Arm 1 reproducing the banner on an UNPATCHED thread open — i.e.
a real 503 in the wild, not a forced one. That is the point at which the backend half becomes
worth a phase.

### 3. ⚠ CONFIRMATION, not a new finding: `sketchComposition.test.tsx` flaked AGAIN

`244-09`'s entry above set the re-open trigger: *"failing a third time in any phase → add it to
`SEED-171`'s named set as the sixth cap-independent flaky suite."* **`244-11`'s full gate run is a
further occurrence** — both its §2 positive controls timed out at 5000 ms under the shared gate,
and again when the three suites were re-run alone.

⭐ **AND IT WAS PROVED INHERITED, not merely argued.** With `244-11`'s two source files
(`ChatArea.tsx`, `StreamsProvider.tsx`) **checked out at the base commit** `32ada21e1`, the same
two `sketchComposition` cases **still failed**, alongside a `WorkflowsPage.test.tsx` case — and
`WorkflowCanvas.test.tsx`, red twice at HEAD, went **green**. **The failing set is never the same
twice**, which is `SEED-171`'s signature exactly. ⛔ The cap was never touched.

⚠ **Near-name hazard worth recording:** `src/components/library/__tests__/sketchComposition.test.tsx`
(this one) is a DIFFERENT file from `src/components/sources/sourceComposition.test.tsx`, which
CLAUDE.md records as a **standing red in NEITHER knob** by a Phase 235 decision. Two
`*Composition.test.tsx` files, two different dispositions — do not read a note about one as covering
the other.

**Re-open trigger (unchanged, now closer):** the NEXT phase to see it red should add it to
`SEED-171` as the sixth named suite. `244-11` does not, for the same reason `244-09` did not: this
is a gap-closure round running in a parallel wave, and editing a shared register outside
`files_modified` is a merge hazard the finding does not justify.

---

## `244-13` — the round's six deferrals, each with a trigger a reader can actually FIRE

⛔ **`244-13` is the LAST plan of gap-closure round 1**, and G-7 forbids a closure round from
introducing a new user-facing capability. Several of the items below are exactly that, which is
why they are deferred rather than taken. ⚠ **A `trigger_when` that names no file, command or
observable condition is not fireable, and a deferral without one is a deletion wearing a
decision's clothes** — so every entry names one.

⚠ **CROSS-CHECKED BEFORE WRITING, and the check is stated so it can be repeated:** items 1-6
below were compared against this file's existing entries **7 (`WR-04`), 8 (`WR-07`), 9
(`WR-08`) and 10 (`IN-01`…`IN-09`)**. Two are DELIBERATE re-statements with changed status
(`WR-08` and `WR-04`, whose triggers this round did not fire and which must not silently expire
with the phase); **one is REMOVED from the deferred set rather than restated — entry 8
(`WR-07`) is CLOSED by this plan**, see below. `IN-01`…`IN-09` are NOT restated: entry 10 already
carries them and duplicating a register is how two registers start disagreeing.

### ✅ NOT a deferral — `WR-07` (entry 8 above) is CLOSED by `244-13`

Recorded here because entry 8's re-open trigger was *"either a plan whose `files_modified` names
`ChatArea.tsx`, or the first writer of `'cap_paused'` onto `workflow_runs.status`"* — **the first
arm FIRED, and it was honoured.** `ChatArea.tsx:140` now reads `workflowLock !== null &&
workflowLock.mode === "harness"`, fenced by `ChatArea.capPausedComposer.test.tsx` **D5** (driven
RED: `Unable to find an element with the placeholder text of: Workflow running — Cancel to switch
back`) and by `ThreadRunLineKickoff.test.tsx` **D5b(a)** on the writer side. ⚠ Entry 8's own
instruction — *"⛔ Do not close this by asserting it is unreachable"* — is obeyed: the reconcile
route remains latent and the fix is fail-closed anyway.

### 1. `L-5` defect 6a — the sent-message attachment chip is LATE, not absent

⚠ **RETRACTED AND RE-SCORED MINOR DURING THE UAT ITSELF**, and that retraction is the reason this
is a deferral rather than a bug: the chip DOES appear in the settled transcript, so `D-244-22`'s
build obligation IS met. What is deferred is the window — a person who attaches a file and
immediately re-reads their own message sees **no scope word for the duration of the run**.

⚠ Likely the same mechanism as **`IN-09`** (a client-stamped message time compared against a
Postgres-stamped file time), which entry 10 above already carries; they should be investigated
together rather than separately.

**Re-open trigger:** the next plan whose `files_modified` names
`frontend/src/components/chat/ChatAttachmentChip.tsx` or
`frontend/src/components/chat/useComposerAttachments.ts`.

### 2. A Google-native Drive file cannot be attached — `Unsupported type (none)`

Two problems in one refusal. **Native Docs/Sheets/Slides are the most common thing in a real
Drive**, so the composer's cloud door refuses the majority case; and the copy leaks the extension
check's internal state (`none` is the absent extension, not a type the person can act on).

⚠ **THE LIBRARY INGEST PATH DOES HANDLE THEM** — `backend/app/security/egress.py` carries Drive
read **and EXPORT** pins — so the composer door appears to be missing an export step the other
door already has. ⛔ **Stated as the likely asymmetry to CHECK, not as a measured fact.** Nobody
drove the Library path against a native Doc during this round.

**Re-open trigger:** the next phase touching the composer's cloud door
(`frontend/src/components/chat/ConnectedFilePickerModal.tsx` /
`useComposerAttachments.ts`) **or** `backend/app/api/workspace.py`'s `_ALLOWED_EXT`.

### 3. A Library import answered HTTP 200 and created nothing — NOT REPRODUCED

⛔ **The response BODY was not captured**, so there is nothing to diagnose and nothing to assert.
Recording it with an honest *not reproduced* is the whole point: an unreproduced observation that
is deleted cannot be recognised the second time it happens.

**Re-open trigger:** any further Library import that answers **200** without producing a
`documents` row — ⛔ **capture the response body that time**, and the `documents` / `document_
chunks` counts either side of the call.

### 4. `Retry-After: 10` on a snapshot 503 is still discarded

`244-11` makes the failure VISIBLE and deliberately adds **no automatic retry** — an auto-retry is
a new behaviour, not a gap fix (G-7), and an automatic retry into a 503 storm is an amplification
risk its threat register accepts precisely by not adding one. Recovery stays exactly one user
click on the shipped **Retry** control. ⚠ This restates the `244-11` entry above with its status
unchanged, so the trigger does not expire when the phase closes.

**Re-open trigger:** a phase that adds ANY automatic retry to the snapshot path
(`frontend/src/providers/StreamsProvider.tsx`'s `reconcile` or `backend/app/api/threads.py:495-530`)
— at which point the header is read there and the backoff decided there, never inside a banner.

### 5. `WR-08` — the transcript says `Read <file>` for a turn that could not read it

`frontend/src/components/chat/MessageItem.tsx:455-465`. In Explorer mode the announcement is gated
out **and** the tool set carries neither `execute_code` nor a workspace tool, so no hydration
happens either — and the row still says `Read contract.pdf`, in the past tense.

⚠ **ENTRY 9 ABOVE SET THE TRIGGER *"the next plan whose `files_modified` names
`MessageItem.tsx`"* — AND THAT TRIGGER FIRED ON THIS VERY PLAN.** It is recorded as fired and
**declined**, not as unnoticed: `244-13` is a gap-closure round, the **mode gate is a code fix
but the WORDING is an OPERATOR call** (the strings are ported from sketch 236's `COPY.js`), and
changing shipped copy inside a closure round is the "smuggled feature" G-7 exists to stop. ⛔ A
trigger that fires and is silently re-armed is worse than one that never fired; this one is
answered.

**Re-open trigger (re-armed, narrowed):** the next plan that names
`frontend/src/components/chat/composerCopy.ts`, **or** any plan scoping Explorer-mode transcript
honesty. ⚠ Take the **mode gate** without waiting for the operator; take the wording only with one.

### 6. `WR-04` — the cloud attach buffers the whole provider file before the 10 MB cap

`backend/app/api/workspace.py:400` calls `fetch_cloud_file` unbounded and checks
`len(raw) > MAX_FILE_SIZE` afterwards, so a 2 GB pick is resident in a worker (`WORKER_COUNT=2`)
before the 422. ⚠ Pre-existing on the Library path too (`import_single_file` has the same shape).
Restated from entry 7 with its status unchanged — ⛔ **`244-13` is a frontend-only plan
(`git diff --stat -- backend/ supabase/` is EMPTY), so it could not have taken this even if the
round allowed it.**

**Re-open trigger (unchanged):** the next plan whose `files_modified` names
`backend/app/api/workspace.py` or `backend/app/services/sources/import_service.py`. The fix is to
resolve the provider's declared size from the listing the picker already rendered and refuse
BEFORE `read_file`; the stronger version is a streaming read with a running byte counter.

---

## `244-13` — two findings the WORK produced, recorded because nobody else saw them

### 7. The two ledger tables had DRIFTED APART, and only one of them is gated

Measured while updating rows: `CLAUDE.md`'s G-5-FIRING shortlist read `MessageItem.tsx
73 / 34 / 954` and `StreamsProvider.tsx 96 / 37 / 4614`, while `docs/HOT-FILE-LEDGER.md`'s
**authoritative** scan list still read `71 / 37 / 904` and `94 / 38 / 4528` for the same two
files. Waves 1-2 updated the shortlist and not the scan list. ⚠ **`scripts/check-hot-file-ledger.cjs`
reads ONLY the scan list**, so the table an agent is most likely to read at planning time is the
one nothing verifies — and the two disagreed on the phase count (`34` vs `37`) as well as the
triple, which is the figure G-5 actually fires on.

**Re-open trigger:** the next plan that edits either table should diff the two file lists; a
`--sync` mode on `check-hot-file-ledger.cjs` that fails when a path's triple differs between
`CLAUDE.md` and `docs/HOT-FILE-LEDGER.md` would close it mechanically.

### 8. `ThreadRunLine.tsx` is still at ONE phase — its ledger prose predicted otherwise

`244-13-PLAN.md` stated that this round *"makes it phase 2"* and asked for the row to record that
it is one phase from owing a detail section. **It is not:** `244` fixed `G-1` in the run line's
**INPUT** (`useHarnessLiveForThread`), leaving `ThreadRunLine.tsx` byte-unchanged, so the
re-derived triple is **`1 / 1 / 357` — unmoved**. Recorded as *checked, unmoved* rather than left
silent, because a reader who finds no `244` entry cannot otherwise tell that from *nobody checked*.

**Re-open trigger:** the next plan whose `files_modified` names
`frontend/src/components/chat/ThreadRunLine.tsx` — at its THIRD phase it owes a detail section in
`docs/HOT-FILE-LEDGER.md`.

---

## `244-14` — three items the ROUND-1 REVIEW raised that this fix round did NOT close

⚠ These are deferrals with FIREABLE triggers, not omissions. Each names a file, a command or an
observable condition, so the re-open is a check somebody can RUN rather than a memory somebody has
to have. (That discipline exists because this project measured its seeds register to be swept by
NOTHING — a `trigger_when` nobody reads is a deletion that looks like a decision.)

### 9. [review IN-04] `ChatArea.capPausedComposer.test.tsx` D5 seeds AFTER awaiting the reconcile

**Where:** `frontend/src/components/chat/__tests__/ChatArea.capPausedComposer.test.tsx:365-380`.

D5 waits for the lock to land, then calls `seedHarnessCapPausedLock()` to flip `capPaused` to
`true`. `ChatArea`'s workflow effect re-runs on `[thread?.id, streamActions]` and its `.then`
writes `capPaused: false`, so a second settle after the seed silently restores the state the case
is NOT about, and the following `waitFor` would then pass on its first tick only by ordering luck.

⚠ **MEASURED BY `244-14` WHILE WRITING D7, AND IT IS SHARPER THAN THE REVIEW STATED: the effect
really does settle TWICE in this harness** — the first call is aborted by the re-run and writes
nothing; the second writes the lock. The review presented the race as hypothetical; the double
settle is not. What remains unproven is only whether a THIRD settle can land after the seed.

⛔ **NOT FIXED HERE, deliberately.** D5 is `244-13`'s case and its pass is not in doubt; editing
another plan's case to remove a race it has not been observed to lose is a change with no driven
defect behind it. **D7, added by this round, does not reproduce the shape:** a late settle there
flips `capPaused` to `false`, which DELETES the Continue card and reds D7's positive assertion
before its negative assertion is reached — fail-safe by construction rather than by luck.

**Re-open trigger (any one):**
- `ChatArea.capPausedComposer.test.tsx` appears in a gate run's failing-file list with D5 named;
- any plan edits `ChatArea.tsx`'s mount-reconcile effect or its dependency array;
- the next plan that touches this suite for any reason.

**The fix, written out so it need not be re-derived:** assert the post-seed value once with
`expect(...)` instead of `waitFor(...)` — a regression then cannot be papered over by a retry — or
make `getThreadWorkflow` resolve exactly once (`mockResolvedValueOnce` plus a rejecting default
that `ChatArea`'s own `.catch` swallows). ⚠ The second form was TRIED here and needs care: with a
rejecting default the lock never lands at all, because the FIRST, aborted settle consumes the
`Once`.

### 10. [review IN-05] The truncation note repeats on every call once the copy budget is exhausted

**Where:** `backend/app/services/tool_dispatcher.py` — the
`len(already) + len(rows) > _ATTACHMENT_HYDRATION_MAX_FILES` arm.

Once the session has copied its cap, every later `execute_code` re-lists, re-computes the
comparison, appends *"Only the first 50 of N workspace files were copied…"* and returns. The note
is correct and NAMED (the `T-244-02-07` discipline), but a run calling `execute_code` eight times
pushes the same sentence into eight tool results.

⚠ **`244-14` changed this arm's reachability and says so rather than leaving it implied:** a path
now enters `already` on SUCCESS or after being given up on, so a session with flaky Storage reaches
the cap later than before — a long session still reaches it. ⛔ The related WR-03 finding — that
the note could be FALSE, because failed paths consumed the budget with no file arriving — **IS
fixed**, and is fenced by case F3. What remains is repetition of a TRUE note.

**Re-open trigger (any one):** a real run is observed emitting the truncation note in ≥ 3 tool
results of one turn; **or** `_ATTACHMENT_HYDRATION_MAX_FILES` is lowered from 50, which makes this
arm ordinary rather than exceptional; **or** any plan adds a second sentence to this arm.

**The fix:** a `noted` marker in the same per-session record pair (`_session_hydration_records`) —
emit the truncation note on the first call that hits the cap and not again while the count is
unchanged.

### 11. [review § Security, "not a vulnerability but worth recording once"] Under `WORKER_COUNT=2` the hydration record is PER PROCESS

**Where:** `_hydrated_files` / `_hydration_failures` in `backend/app/services/tool_dispatcher.py`,
and `SandboxSessionManager.get_or_create` (`backend/app/services/sandbox_service.py:25`).

Each uvicorn worker builds its OWN session object re-attached to the SAME container, so the record
is per-process and one file can be copied once per worker. ⛔ **PRE-EXISTING and NOT this round's
defect** — the `WeakSet` marker `244-07` shipped had the identical property and `244-10`'s
`WeakKeyDictionary` inherited it. It is bounded by worker count (2 by default), and it OVER-copies
rather than under-copies: the container ends up holding the file, which is the deliverable.

⚠ `244-14` adds a second `WeakKeyDictionary` and changes nothing about this property — both records
are keyed by the same session object and share its lifetime, so a worker bounce still yields empty
records and a re-hydrate.

**Re-open trigger (any one):**
- `WORKER_COUNT` is raised above 2 in `backend/.env.example`, `docker-compose.prod.yml` or
  `deploy/onebox.env.example` — the duplicate-copy count scales linearly with it;
- a UAT run observes `/sandbox/attachments/` receiving the same file twice, or a copy cost that
  scales with worker count;
- any plan moves the sandbox-session record off the process (Redis, or a marker written INSIDE the
  container — the latter is the cheaper one, because the container IS the thing the record is a
  claim about).
