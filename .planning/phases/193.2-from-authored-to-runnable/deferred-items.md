# Phase 193.2 — deferred items

Out-of-scope discoveries, logged rather than fixed (executor SCOPE BOUNDARY: only auto-fix
issues DIRECTLY caused by the current task's changes, in files the plan names).

---

## DEF-193.2-03-01 — three frontend prose citations of `db/workflows.py` line numbers went stale

**Found during:** plan `193.2-03`, Task 2, while proving that no frontend module can reach the
two changed backend files.

**What happened.** `193.2-03` inserted **+111 lines** into `backend/app/db/workflows.py` (109 of
them comment — the D-16 divergence record at all three feed sites). Three frontend files cite
line ranges in that module **as prose inside comments**, and two of those ranges sit *below* the
insertion points, so their numbers no longer name what they claim:

| File | Citation | Status after 193.2-03 |
|---|---|---|
| `frontend/src/components/workflows/library/libraryFilter.ts:133` | `db/workflows.py:477-478` | ⚠ **stale** — below sites 1 + 2 (+75 L) |
| `frontend/src/components/workflows/library/useWorkflowFork.ts:299` | `db/workflows.py:508-513` | ⚠ **stale** — below sites 1 + 2 (+75 L) |
| `frontend/src/pages/WorkflowsPage.test.tsx:1073` | `db/workflows.py:508-513` | ⚠ **stale** — below sites 1 + 2 (+75 L) |

Four further citations were checked and are **still accurate** because they sit above every
insertion point: `db/workflows.py:206-214` (×2 — `PhaseReconcile.test.tsx:394`,
`StreamsProvider.tsx:3344`), `:93-95` (`librarySubtree.fences.test.ts:437`) and `:291-293`
(`LibraryToolbar.tsx:325`).

**Why it is NOT fixed here.** All three live in files outside `193.2-03`'s `files_modified`
(`backend/app/db/workflows.py`, `backend/tests/unit/test_workflows_updated_at.py`). Two of them
sit under `frontend/src/components/workflows/library/`, whose subtree is fence-swept and whose
sibling `WorkflowCard.tsx` is explicitly **out of scope by D-04**. Editing a `library/` file to
correct a comment would put this plan inside a scope fence for zero behavioural gain.

**Severity: cosmetic.** Every one of these is a `//` or `*` comment — **not one is an import**.
Nothing executes, typechecks or asserts against them, which is exactly why `git` cannot notice
them and why they are recorded here instead of being trusted to a later reader's memory.

**Re-open trigger.** The next plan whose `files_modified` already names one of the three files
corrects that file's citation **in the same commit**. If none does before Phase 193.2 closes, a
`/gsd:fast` pass (3 files, 3 lines, no schema or API surface — G-3) closes all three at once.

⚠ **The general lesson, which is this repository's own recurring one: a line-number citation is a
figure that goes stale on the next commit to the file it names, and nothing mechanically checks
it.** The `CLAUDE.md` hot-file ledger documents the identical staling about its own cells four
times over. Prefer citing a *symbol* (`list_draft_workflows`) over a *line* where the choice
exists.
