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
