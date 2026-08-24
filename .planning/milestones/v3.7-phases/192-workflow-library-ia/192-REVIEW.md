---
phase: 192-workflow-library-ia
reviewed: 2026-08-11T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - backend/app/api/workflows.py
  - backend/app/db/workflows.py
  - backend/tests/unit/test_published_workflow_ownership.py
  - frontend/src/components/workflows/library/LibraryToolbar.tsx
  - frontend/src/components/workflows/library/LibraryToolbar.test.tsx
  - frontend/src/components/workflows/library/RunModal.tsx
  - frontend/src/components/workflows/library/WorkflowCard.tsx
  - frontend/src/components/workflows/library/WorkflowCard.test.tsx
  - frontend/src/components/workflows/library/WorkflowDeleteSheet.tsx
  - frontend/src/components/workflows/library/libraryFilter.ts
  - frontend/src/components/workflows/library/libraryFilter.test.ts
  - frontend/src/components/workflows/library/libraryRow.ts
  - frontend/src/components/workflows/library/libraryVocabulary.ts
  - frontend/src/components/workflows/library/librarySubtree.fences.test.ts
  - frontend/src/lib/api.ts
  - frontend/src/pages/WorkflowsPage.tsx
  - frontend/src/pages/WorkflowsPage.test.tsx
  - frontend/src/pages/__tests__/PublishedCardDelete.test.tsx
  - frontend/src/pages/__tests__/RunModal.test.tsx
  - frontend/src/pages/__tests__/RunModal.a11y.test.tsx
  - scripts/vitest-count-gate.cjs
findings:
  critical: 1
  warning: 8
  info: 6
  total: 15
status: issues_found
---

# Phase 192: Code Review Report

**Reviewed:** 2026-08-11
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

Phase 192 restructures the Workflows library: three shelves collapse to one flat list under one
toolbar, three card components collapse to one, and two components (`RunModal`,
`WorkflowDeleteSheet`) are moved verbatim into a new `library/` subtree. The backend change is
narrow and correct — two additive, defaulted booleans on `PublishedWorkflow`, computed
server-side, with `created_by` fenced off the wire by an exact-field-set test *and* a
serialized-payload sweep. The SQL projections widen; no predicate moves. I found **no
cross-tenant or RLS defect** in this diff, and no new `run_in_threadpool` violation (the
workflow cluster's service-role asyncpg carve-out is unchanged and pre-existing).

**The live lead was verified independently, and the phase's claim is accurate.** I traced every
call into `refetchPublished` / `refetchStarters` / `refetchDrafts` (`WorkflowsPage.tsx:297-399`,
`:626-669`): each holds its own `try`/`catch`, marks its own `sourceState` entry, and commits
behind its own sequence ticket before re-throwing. No single source can empty the list. The
aggregate at `:395` genuinely has no consumer, so `Promise.allSettled` is not what provides the
isolation — exactly as the source comment states. The `?raw` fence at `WorkflowsPage.test.tsx:569-570`
is therefore the right shape (and it is not vacuous: `"Promise.allSettled("` does not contain
`"Promise.all("`, and the prose spellings in the docblock are followed by a backtick, not a
paren). Keeping `allSettled` still has value beyond the comment's argument: with `Promise.all`
the `void`-discarded aggregate would raise a browser `unhandledrejection` on every 403.

What the merged feed **does** get wrong is the state *after* isolation succeeds: the page holds
"we could not ask" and "there are none" apart in three places and collapses them in the fourth —
the empty state. `libraryVocabulary.ts` even ships the correct sentence for it, and nothing
renders it. That is the one BLOCKER.

Per the phase context, I did **not** file style findings against the two verbatim-moved bodies,
did not suggest merging `onForkNewVersion`/`onForkStarter`, did not suggest `title=` tooltips,
did not treat the retained `?scope=mine` as dead code, and did not file file-length findings.
Two genuine *bugs* inside moved code are reported and labelled pre-existing.

## Critical Issues

### CR-01: When every feed fails, the library asserts "You have no workflows yet."

**File:** `frontend/src/pages/WorkflowsPage.tsx:919-945` (with `frontend/src/components/workflows/library/libraryVocabulary.ts:142-147`)

**Issue:**
The empty-state branch keys off `rows.length === 0` alone and never consults `failedSources`:

```tsx
{loading ? null : visibleRows.length > 0 ? (
  <div data-testid="library-list">…</div>
) : rows.length === 0 ? (
  <p data-testid="library-empty">{LIBRARY_STATES.empty}</p>   // "You have no workflows yet."
) : (
  <p data-testid="library-filtered-empty">…</p>
)}
```

`loading` is `!anySettled`, and a *failed* source counts as settled (`:475-483`). So the moment
all three feeds reject — backend down, expired session, network drop — the page renders:

- three banners, each reading **"We couldn't load {X}. Everything else is shown below."**
  (`libraryVocabulary.ts:161`) when there is nothing below; and
- **"You have no workflows yet."**

Both sentences are false, and the second is the specific failure shape this codebase has a
memory entry about — the one that *looks like lost data*. The same collapse fires in the
narrower, likelier case: `published` and `starter` fail while `drafts` legitimately returns `[]`.

This is exactly the rule the phase authored and enforces everywhere else. `libraryVocabulary.ts:136-140`:
*"'There are none' and 'we could not ask' are DIFFERENT FACTS … and a count of zero rendered
during a load is a lie."* `WorkflowsPage.tsx:275-283` and `:859-863` repeat it. And the sentence
written for precisely this state — `LIBRARY_STATES["source-failed"]` = *"Some workflows could
not be loaded, so this list is incomplete."* — **is dead code**: `grep` over `frontend/src` finds
it referenced only in its own declaration. The vocabulary knows the right answer; the page never
asks for it.

No test covers this. The two failure cases (`WorkflowsPage.test.tsx:525-571`, `:1032-1065`)
both reject only `/drafts` while the other two feeds return rows, and each asserts
`queryByTestId("library-empty")` is **null** — i.e. the suite pins the branch that is correct
and never enters the branch that is wrong.

**Fix:** make the empty branch three-way, and use the string that already exists.

```tsx
// WorkflowsPage.tsx — replace the `rows.length === 0` arm
) : failedSources.length > 0 ? (
  // "we could not ask" is NOT "there are none" — say which one this is.
  <p data-testid="library-source-failed" className="text-[13px] italic text-muted-foreground">
    {LIBRARY_STATES["source-failed"]}
  </p>
) : rows.length === 0 ? (
  <p data-testid="library-empty" …>{LIBRARY_STATES.empty}</p>
) : (
  <p data-testid="library-filtered-empty" …>{LIBRARY_STATES["filtered-empty"]}</p>
)
```

And fix the banner sentence so it does not promise a remainder that may not exist — either split
`sourceFailedMessage` into a "…everything else is shown below" form and a bare form, or drop the
second clause and let the new `source-failed` line carry the completeness statement.

Add the missing case to `WorkflowsPage.test.tsx`:

```tsx
it("when EVERY feed fails, the page never claims the user has no workflows", async () => {
  mockListPublished.mockRejectedValue(new Error("500"))
  mockListStarters.mockRejectedValue(new Error("500"))
  mockListDrafts.mockRejectedValue(new Error("403 Forbidden"))
  render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
  await screen.findByTestId("library-source-failed-published")
  expect(screen.queryByTestId("library-empty")).toBeNull()   // RED before the fix
  expect(screen.getByTestId("library-source-failed")).toBeInTheDocument()
})
```

## Warnings

### WR-01: A by-design 403 on the gated `/drafts` feed renders as a permanent load-failure banner

**File:** `frontend/src/pages/WorkflowsPage.tsx:346-362`, `:869-877`

**Issue:** `GET /workflows/drafts` carries `require_visible("workflow_authoring")`
(`backend/app/api/workflows.py:1067-1071`). For every user *without* that visibility — the
run-only audience the Phase-148 carve-out exists for — the mount fetch rejects with 403 and the
page paints **"We couldn't load your drafts. Everything else is shown below."** on every single
visit, permanently, for a feature that is not available to them by policy. The code comment at
`:356-358` acknowledges this ("a refusal here is a NORMAL outcome … not an exception") and then
routes it through the same `failed` state as a genuine outage. The *Still building* chip
simultaneously shows `0` with no explanation. An authorization refusal is not an error, and
telling a user something failed when nothing did is the same class of dishonesty this phase
removed elsewhere.

`refetchDrafts` also never re-runs on the library surface (only `backToLibrary` and
`handleDeleted` retry it), so the banner has no dismissal and no recovery path from the list view.

**Fix:** distinguish refusal from failure. The api client already throws a message carrying the
status (`api.ts:3474`); give `SourceState` a fourth value and suppress the banner for it:

```ts
type SourceState = "pending" | "ok" | "failed" | "unavailable"   // 403 = not for you, not broken

// in refetchDrafts's catch:
markSource("draft", /\b403\b/.test(String(err)) ? "unavailable" : "failed")
```

Better still, have `listDraftWorkflows` surface the status as a typed field rather than making
the page regex an error string (see WR-08 for the same anti-pattern).

### WR-02: A failed published re-query leaves the *previous* project's rows on screen, presented as matching the new one

**File:** `frontend/src/pages/WorkflowsPage.tsx:318-323`, `frontend/src/components/workflows/library/libraryFilter.ts:214-233`

**Issue:** `matchesProject` returns `true` unconditionally for `provenance === "published"`
whenever `projectId` is a real folder id — the documented "the server already narrowed it"
contract. That contract holds only while the last published fetch *succeeded for the current
selection*. On the failure path `refetchPublished` marks the source `failed` and re-throws
without clearing or invalidating `published`, so the rows fetched under the **previous** project
stay in state and are then waved through the project filter as if they belonged to the new one.
The user sees rows that do not belong to the selected project, with a banner saying those rows
could not be loaded — two mutually contradictory statements about the same list.

The same holds for the `UNBOUND` narrow, which is applied at commit time (`:312-316`) and so is
never re-applied to the retained rows.

**Fix:** on a non-superseded published failure, drop the rows the failure invalidates rather than
keeping a list whose project provenance is now unknown:

```ts
} catch (err) {
  if (seq !== publishedSeqRef.current) return
  setPublished([])            // the retained rows describe a selection that is no longer current
  markSource("published", "failed")
  throw err
}
```

If retaining them is deliberate, then `matchesProject` must stop trusting the server for the
published arm while `sourceState.published === "failed"`, and the banner wording must change —
but clearing is the simpler honest answer and matches D-17's "never present stale as current".

### WR-03: The shared fork verb fails silently — `console.error` is its only failure surface

**File:** `frontend/src/pages/WorkflowsPage.tsx:499-514`, `:538-555`

**Issue:** Both fork handlers swallow every error into `console.error` and return. The user
clicks **"Make my own copy"** (`FORK_VERB`) and *nothing happens at all*: no error text, no
toast, no state change, no view switch. D-15 deliberately made the fork a direct flip with no
confirm step, which makes the absence of any completion or failure signal worse, not better —
there is no dialog left open to show the failure in. The card's own D-18 delete honours the rule
this violates (`WorkflowCard.tsx:196-197`: *"Never silent (D-18). A guard that fails quietly is a
guard that lies about succeeding."*); the fork does not.

Real triggers: a 409 slug/version collision on Tweak (unretried — only `onUseStarter` retries), a
401 after session expiry, any 5xx.

**Fix:** lift the failure into the surface. The page already renders per-source banners; add a
transient action-failure line, or pass an `onForkFailed` back to the card so the row that
initiated it can say so:

```ts
const [forkError, setForkError] = useState<string | null>(null)
// …
} catch (e) {
  console.error("[WorkflowsPage] Tweak fork failed", e)
  setForkError("Couldn't make your copy — try again.")
}
```
and render `forkError` beside the toolbar with `role="status"`, clearing it on the next fork.

### WR-04: The destructive-delete gate reuses the *Yours* filter predicate, whose degraded default is "assume it's yours"

**File:** `frontend/src/components/workflows/library/WorkflowCard.tsx:345`, `:414-423`, `:536-542`

**Issue:**

```ts
const owned = CHIP_PREDICATES.yours(row)   // = row.isMine ?? row.provenance !== "starter"
```

`owned` gates *both* the `published-delete` menu item and the mount of the cascade
`WorkflowDeleteSheet`. `CHIP_PREDICATES.yours` is documented (`libraryFilter.ts:152-159`,
`libraryRow.ts:83-93`) as deliberately reading an absent `is_mine` as **true** for non-starters,
because for a *filter chip* an empty *Yours* list on a stale deploy is the failure that looks
like lost data. That default is right for a chip and wrong for an authorization-shaped gate: for
the delete it means *"we do not know whether you own this, so offer the heaviest destructive
guard."*

Today this is latent rather than live, because `WorkflowsPage` fetches published rows with
`?scope=mine`. But `WorkflowCard` is an exported component with no such precondition in its
props, and `list_published_workflows`' default predicate is
`is_system_global = true OR created_by = $1` (`backend/app/db/workflows.py:297-298`) — i.e. the
default feed *does* return rows the caller does not own. Any future consumer that renders
`WorkflowCard` over the default feed, against a backend that has not yet shipped `is_mine`, is
offered "Delete workflow…" and the victim-naming Sheet on another user's global workflow. The
server correctly 404s, so this is a dishonesty defect rather than an authorization hole — but
"offering an action that can only fail is the dishonesty this whole phase exists to remove" is
the card's own docblock at `:341-343`.

`WorkflowCard.test.tsx` never exercises a published row with `isMine: undefined`.

**Fix:** give the destructive gate its own predicate with the opposite default, and say why:

```ts
/** The delete gate fails CLOSED. Unlike the *Yours* chip, an unknown owner must not be
 *  read as "yours" — a chip that under-reports is a nuisance; a delete offered on a row
 *  you do not own is a control that can only fail. */
const owned = row.isMine === true || (row.isMine === undefined && row.provenance === "draft")
```

and add the case: `renderCard(rowOf("published", { isMine: undefined }))` →
`expect(screen.queryByTestId("published-delete")).toBeNull()`.

### WR-05: `WorkflowDeleteSheet`'s preview fetch has no latest-wins guard (pre-existing, verbatim move)

**File:** `frontend/src/components/workflows/library/WorkflowDeleteSheet.tsx:128-140`

**Issue — reported because it is a bug, not a cleanliness note; the code is a verbatim move and
this defect is inherited.** `openDeleteSheet` fires `getWorkflowDeletePreview(wf.id)` with no
sequence ticket and no `AbortSignal`, while resetting `preview` to `null` on every open. Close
the sheet and reopen it before the first response lands and two fetches are in flight; the older
can resolve second and overwrite the newer. The whole point of this guard is the sentence in its
own docblock — *"fetches the EXACT server counts BEFORE offering the destructive action"* — and
`in_flight` in particular gates the amber cancel-first banner, so a stale value can hide a live
run from the person about to destroy it.

The same function's `.catch` also cannot be superseded, so a stale rejection can paint
`previewError` over a freshly-loaded preview.

**Fix:** the ticket idiom the page already uses two files away:

```tsx
const previewSeq = useRef(0)
const openDeleteSheet = () => {
  const seq = ++previewSeq.current
  setPreview(null); setPreviewError(null); setDeletePhase("idle"); setSheetOpen(true)
  getWorkflowDeletePreview(wf.id)
    .then((p) => { if (seq === previewSeq.current) setPreview(p) })
    .catch((e) => { if (seq === previewSeq.current) setPreviewError(…) })
}
```

Note this changes bytes inside the verbatim-move range, so it must land with a re-capture of the
`PublishedCardDelete.test.tsx` baselines and a stated reason — or be deferred with a trigger.

### WR-06: The armed draft-delete prompt is neither announced nor focused

**File:** `frontend/src/components/workflows/library/WorkflowCard.tsx:430-442`, `:497-532`

**Issue:** Clicking `draft-delete` closes the Radix dropdown (which returns focus to the `⋯`
trigger) and renders `draft-delete-prompt` at the *bottom* of the card. The prompt carries no
`role="alertdialog"`, no `aria-live`, and receives no programmatic focus, so a screen-reader or
keyboard user gets no signal that a confirmation appeared — the only announced node in the whole
guard is the *failure* (`role="status"` at `:527`). A keyboard user must tab past the primary
`✎ Open` button to reach Cancel/Confirm, and there is nothing tying the prompt to the menu item
that produced it.

This is a live accessibility contract break in a phase whose card suite otherwise resolves every
`aria-describedby` as a round trip (`WorkflowCard.test.tsx:282-298`) and whose D-14 rationale is
explicitly *"the explanation reaches a touch user and a screen reader alike."*

**Fix:**

```tsx
const promptRef = useRef<HTMLDivElement>(null)
useEffect(() => { if (armed) promptRef.current?.focus() }, [armed])
// …
{armed && (
  <div ref={promptRef} tabIndex={-1} role="alertdialog" aria-modal="false"
       aria-labelledby={promptId} data-testid="draft-delete-prompt" …>
    <p id={promptId} …>{DELETE_DRAFT_PROMPT}</p>
```
and assert it in `WorkflowCard.test.tsx`: after arming, `document.activeElement` is inside
`draft-delete-prompt`.

### WR-07: `vitest-count-gate.cjs` interpolates an env var into a `shell: true` command line

**File:** `scripts/vitest-count-gate.cjs:1512-1516` (with `spawnSync(… { shell: true })` at `:1524-1529`)

**Issue — pre-existing, but the file is in scope and the gate is now load-bearing for this phase.**

```js
if (process.env.GSD_VITEST_MAX_WORKERS) {
  args.push(`--maxWorkers=${process.env.GSD_VITEST_MAX_WORKERS}`)
}
…
spawnSync("npx", args, { …, shell: true, … })
```

With `shell: true` the argv is re-parsed by the shell, so an env var containing shell
metacharacters is executed. `GSD_VITEST_MAX_WORKERS='4 && <anything>'` runs `<anything>`. The var
is documented in `CLAUDE.md` and set by orchestration, so this is defence-in-depth rather than a
live exploit — but the value is meant to be an integer and nothing checks that it is.

**Fix:**

```js
const mw = process.env.GSD_VITEST_MAX_WORKERS
if (mw) {
  if (!/^\d+$/.test(mw)) fatal(`GSD_VITEST_MAX_WORKERS must be an integer, got '${mw}'.`)
  args.push(`--maxWorkers=${mw}`)
}
```

### WR-08: The starter-fork retry classifies a 409 by substring-matching an error message

**File:** `frontend/src/pages/WorkflowsPage.tsx:550-555`

**Issue:**

```ts
} catch (e) {
  if (attempt === 0 && String(e).includes("409")) continue
  console.error("[WorkflowsPage] starter fork failed", e)
  return
}
```

`String(e).includes("409")` is control flow keyed on prose. It works today only because
`createWorkflowDraft` happens to throw `Failed to create workflow draft (status 409)`
(`api.ts:3466`); rewording that message silently disables the collision retry, and no test would
notice (`WorkflowsPage.test.tsx:849-867` only exercises the success path). It also matches any
error whose text happens to contain `409`. The api client already defines typed errors
(`WorkflowConflictError`, `WorkflowNotFoundError`) used by the sibling clients — this call site
does not get one.

**Fix:** throw a typed error from `createWorkflowDraft` on 409 and branch on the type:

```ts
if (res.status === 409) throw new WorkflowConflictError()
// …
if (attempt === 0 && e instanceof WorkflowConflictError) continue
```
plus a test that plants a 409 on the first call and asserts a second `createWorkflowDraft` with a
different slug suffix.

## Info

### IN-01: `showOverflow` is a constant `true` guarding a conditional

**File:** `frontend/src/components/workflows/library/WorkflowCard.tsx:348`, `:375`

`const showOverflow = true` followed by `{showOverflow && (<DropdownMenu>…)}`. The comment above
it explains that every row state has *something* behind `⋯`, which is the argument for deleting
the flag, not for keeping it. An always-true guard reads as a state that can vary and cannot.
**Fix:** delete the constant and the `&&`.

### IN-02: Three declared-but-unconsumed exports

**Files:** `frontend/src/components/workflows/library/libraryVocabulary.ts:146`;
`frontend/src/components/workflows/library/RunModal.tsx:430`

- `LIBRARY_STATES["source-failed"]` — referenced nowhere outside its own declaration (this is the
  string CR-01 needs; it becomes live with that fix).
- `LibraryStateId` is only used to type the table it indexes.
- `RunModalProps` is exported and imported by nothing; `RunModal.test.tsx:705` re-derives the
  same type inline instead. Harmless, but it is a public surface with zero consumers.

### IN-03: `freshHash()` uses `Math.random()`

**File:** `frontend/src/pages/WorkflowsPage.tsx:140-144`

Non-cryptographic randomness for a 6-char slug suffix against a *global* `UNIQUE(slug, version)`
constraint. Collision is not a security issue and is handled by the one retry, but
`crypto.getRandomValues` is available in every target browser and costs one line. Noted, not
required.

### IN-04: The D-04 "cross-check" derives both sides of the comparison from the same fixture

**File:** `frontend/src/pages/WorkflowsPage.test.tsx:1179-1190`

```ts
const merged = [
  ...bulkPublished.map((row) => ({ is_mine: row.is_mine, provenance: "published" as const })),
  ...bulkStarters.map((row) => ({ is_mine: row.is_mine, provenance: "starter" as const })),
]
for (const row of merged) expect(row.is_mine).toBe(row.provenance !== "starter")
```

`provenance` here is a literal the test writes, and `is_mine` is a literal the fixture writes.
Nothing under test participates. The comment above it claims this checks that two *independent*
answers agree; it checks that two hand-written literals agree. The assertion is not wrong, but it
is weaker than its own docblock says — the real check is the surface half at `:1194-1200`.
**Fix:** either delete the first half or run it over `mergeLibrary(...)`'s output so the
provenance comes from the code rather than from the test.

### IN-05: `RunModal`'s focus trap includes the hidden file input (pre-existing, verbatim move)

**File:** `frontend/src/components/workflows/library/RunModal.tsx:223-225`, `:307-315`

The focusable selector is `'button:not([disabled]), [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'`.
The bare `input` term matches the `hidden` / `tabIndex={-1}` file input, so it is inside the trap's
node set. It sits mid-list today, so the `first`/`last` boundary logic is unaffected — but a
reorder that puts it first or last would send focus to a `display:none` element and drop it out of
the dialog. The `[tabindex]:not([tabindex="-1"])` term was clearly meant to cover this and is
defeated by the bare `input`. **Fix:** `input:not([type="hidden"]):not([tabindex="-1"])`. Same
verbatim-move caveat as WR-05.

### IN-06: `NetNewFlag`'s hover-only tooltip and route literal survive in the Builder band

**File:** `frontend/src/pages/WorkflowsPage.tsx:169-179`

Recorded here only so a later reviewer does not re-find it as new: the surviving `title=` and the
`GET /workflows/published + POST /workflows/{id}/publish` string are outside the `library/` fence
by construction, are pinned byte-exactly by `WorkflowBuilderPage.header.test.tsx`, and are
explicitly deferred to Phase 193 with a trigger at `:159-167`. **No action in 192.** Verified the
deferral is real: `librarySubtree.fences.test.ts` sweeps seven named `library/` modules and this
render is not in that subtree.

---

_Reviewed: 2026-08-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
