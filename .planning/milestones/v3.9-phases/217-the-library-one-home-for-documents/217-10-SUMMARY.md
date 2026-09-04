---
phase: 217-the-library-one-home-for-documents
plan: 10
subsystem: frontend-panel
tags: [library, documents, detail-panel, lazy-fetch, barrel, xss, LIB-04]

# Dependency graph
requires:
  - phase: 217-01
    provides: "`extractor` on `DocumentResponse` (D-217-08) — the provenance the Text section names"
  - phase: 217-02
    provides: "`GET /{id}/content` (unnumbered, line-range paged, `has_more`) + `/chunks` / `/tables` / `/images`"
  - phase: 217-03
    provides: "`GET /{id}/queries` — the fifth client fn lands here, plan 11 renders it"
  - phase: 217-08
    provides: "`DocumentContentResponse` / `DocumentChunkRow` / `DocumentTableRow` / `DocumentImageRow` / `DocumentQueryRow` in `types/index.ts`"
  - "frontend/src/components/panel/PanelSection.tsx:94 — children render only when open; the lazy mechanism is FREE"
  - "frontend/src/components/relationships/RelationshipsSection.tsx — the section-owns-its-fetch pattern (copied), and its eager default (deliberately NOT copied)"
provides:
  - "`getDocumentContent` / `listDocumentChunks` / `listDocumentTables` / `listDocumentImages` / `listDocumentQueries` — on `api/documents.ts` AND on the `@/lib/api` barrel"
  - "`apiBarrel.test.ts` extended from `connectors.ts` to `documents.ts` — D-207-06 guarded for a second module"
  - "`DocumentContentSection` — the parsed text, unnumbered, server-authoritative paging, extractor as provenance"
  - "`DocumentChunksSection` — chunks in index order with the embedding model PER ROW"
  - "`DetailSections.lazy.test.tsx` — 14 cases; the zero-requests-before-expand criterion with a non-vacuity control"
affects:
  - "217-11 — mounts Tables / Images / Found by using the same `defaultOpen={false}` pattern and the three client fns shipped here"
  - "217-12 — owns the count-gate pins; this plan raises `apiBarrel.test.ts` 3 -> 5 and adds one UNPINNED suite"
  - "⚠ THE CHAT SURFACE — `DocumentDetailPanel` reuses `WorkspacePanel`'s sheet, which `ChatLayout` mounts. See the section below."

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "lazy-by-construction section: a bare `useEffect` fetch is SAFE only because `defaultOpen={false}` prevents the component being constructed — the prop is the mechanism, not a hint"
    - "a barrel-completeness loop per domain module, each with its own non-vacuity control"
    - "a failed CONTINUATION gets its own flag rather than the shared `LoadState`, so a mid-paging failure does not unmount the pages already read"

key-files:
  created:
    - frontend/src/components/metadata/DocumentContentSection.tsx
    - frontend/src/components/metadata/DocumentChunksSection.tsx
    - frontend/src/components/metadata/__tests__/DetailSections.lazy.test.tsx
  modified:
    - frontend/src/lib/api/documents.ts
    - frontend/src/lib/api.ts
    - frontend/src/lib/__tests__/apiBarrel.test.ts
    - frontend/src/components/metadata/DocumentDetailPanel.tsx

key-decisions:
  - "A failed *Load more* sets its own `appendError` flag, NOT `state='error'` — flipping the load state would unmount the pages already read. Caught in my own first draft, before commit."
  - "The per-chunk embedding-model chip renders on EVERY row, never collapsed to a header when the values agree — collapsing would hide the mid-re-embed split, the only case the field is per-chunk for."
  - "Two fences caught PROSE, not code, and the prose was changed rather than the fences."
  - "The lazy suite asserts `listRelationships` IS called once (D-217-25c) rather than claiming the panel fires nothing."

patterns-established:
  - "A fence that greps a file-wide literal is tripped by a docblock ABOUT the rule; and a fence that COUNTS a literal can pass on comments alone. Both directions measured here in one plan."

requirements-completed: [LIB-04]

# Metrics
metrics:
  duration: "~45 min"
  completed: "2026-08-29"
  tasks: 3
  commits: 3
  files_created: 3
  files_modified: 4
---

# Phase 217 Plan 10: The parsed text and the chunks reach the screen — Summary

**`document_chunks.content` (stored since migration `002:24`) and `full_markdown` (stored since the pipeline's terminal write) are now readable in the browser for the first time — behind an accordion that costs ZERO requests until it is clicked, with the embedding model on every chunk so a half-re-embedded document is legible, and with the `@/lib/api` barrel guarded for a second domain module.**

## Task Commits

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | Five client fns, the barrel re-export, the barrel test extended | `3e24f81b6` | `lib/api/documents.ts`, `lib/api.ts`, `lib/__tests__/apiBarrel.test.ts` |
| 2 | The Content + Chunks sections, lazily mounted | `95672c063` | `metadata/DocumentContentSection.tsx`, `metadata/DocumentChunksSection.tsx`, `metadata/DocumentDetailPanel.tsx` |
| 3 | The lazy suite — zero requests before the accordion is clicked | `4551a0d2d` | `metadata/__tests__/DetailSections.lazy.test.tsx` |

## The numbers plan 12 needs (so its BASELINE arithmetic is attributable)

| Suite | before | after | delta | TARGETS | BASELINE |
|---|---|---|---|---|---|
| `src/lib/__tests__/apiBarrel.test.ts` | **3** | **5** | **+2** | ✅ `:3981` | ✅ pinned `3` at `:2796` — **needs re-pin to 5** |
| `src/components/metadata/__tests__/DetailSections.lazy.test.tsx` | — | **14** | **+14** | ⛔ **absent** | ⛔ **absent** |
| `src/components/metadata/DocumentDetailPanel.images.test.tsx` | 3 | 3 | 0 | ✅ `:4001` | ✅ pinned `3` at `:2805` |

The `+2` on `apiBarrel` is exactly the two new `it(...)` blocks (the documents loop + the five-by-name check). No case was removed and none was renamed, so there is **no residual** — the whole delta is attributable.

### ⚠ Which gate knob the new suite is missing from: BOTH

`grep -n '"src/components/metadata'` over `scripts/vitest-count-gate.cjs` returns **one line** — the file-level `DocumentDetailPanel.images.test.tsx` entry that SEED-227 added, whose own comment records that `src/components/metadata` is covered by **no directory entry** and that the gate has therefore never executed a suite there. `grep -c "DetailSections"` returns **0**.

So `DetailSections.lazy.test.tsx` — including the criterion this plan exists to defend — **runs in neither knob**: the gate will not execute it and would not notice if its 14 cases became 0. That is exactly the two-knob trap Phase 214's close names (*TARGETS decides what RUNS, BASELINE decides what is GUARDED*). **Plan 12 owns the pins**; this plan deliberately did not edit `vitest-count-gate.cjs`. If plan 12 adopts the bare `src/components/metadata` directory it will also pull in `DocumentDetailPanel.a11y.test.tsx` and the `InlineEdit` suites and become the owner of their future rot — the same reasoning SEED-227 already recorded when it declined the directory.

## The driven REDs (both required, both observed)

**1. Deleting one of the five from the barrel.** Removed `listDocumentImages` from the `./api/documents` re-export block in `lib/api.ts`:

```
AssertionError: expected { …(216), …(1) } to have property "listDocumentImages"
AssertionError: expected 'undefined' to be 'function'
Tests  2 failed | 3 passed (5)
```

`lib/api.ts` was restored byte-for-byte (`grep -c listDocumentImages` = 1) and the suite returned to 5 passed. ⚠ **Before this commit that omission typechecked perfectly and shipped silent** — `D-207-06` has had no guard for any module but `connectors.ts`.

**2. Dropping `defaultOpen={false}` from the Text mount.**

```
× fires NO content or chunks request on open, and exactly one on each expand
AssertionError: expected "vi.fn()" to be called +0 times, but got 1 times
Tests  6 failed | 8 passed (14)
```

Six cases red, not one — because the Text section's four-arm cases also mount eagerly and stop matching. Restored; `grep -c 'defaultOpen={false}'` back to **2**.

**3. The order fence, against a build that APPENDS the two sections after Classification** (the plan's explicit non-vacuity requirement). Built the variant programmatically, ran, restored:

```
× keeps the eight sections in the D-217-25a order, read from the rendered DOM
AssertionError: expected [ 'Details', 'Relationships', …(1) ] to deeply equal [ 'Details', 'Text', 'Chunks' ]
Tests  1 failed | 13 passed (14)
```

**Exactly one case red** — the fence is targeted at the order and does not incidentally depend on it elsewhere.

## ⚠ What the CHAT surface inherits from this change

`DocumentDetailPanel` is a **cross-surface shell**: it reuses `WorkspacePanel`'s `Sheet`, which `ChatLayout` mounts, so anything that alters the shell's shape lands on chat too. What this plan actually did to it:

- **Two additional `PanelSection` children** inside the existing `overflow-y-auto` sections column, and **five lines of `useState`/reset**. No change to the shell: the header, the `Sheet`/mobile bottom-sheet branch, the 430px track (fixed by the HOST grid, not by this file), the focus management, and the metadata section are all untouched.
- **The three shipped mounts MOVE DOWN and their props do not change.** `git diff` over the file shows **no `-` line touching any `title=` / `count=` / `warn=` / `defaultOpen` / `docId=` / `onTotalChange=` on the shipped mounts** — every such line is a `+`. That satisfies the fence as D-217-25a words it (*"no hunk altering their props"*; a relocation alters no prop).
- **Nothing new fetches on mount.** The chat surface's cost of opening this panel is unchanged at one request.

**What is therefore owed:** a chat-surface look at a panel that is now eight sections tall rather than three. The two new sections are collapsed by default, so the first-paint height grows by two 44px accordion heads and nothing else — but *scroll* behaviour inside the chat sheet on a small viewport is a lived-experience question jsdom cannot answer. **G-4 row owed, on the chat surface, not the Library.**

### Ledger triple, re-derived rather than copied

`frontend/src/components/metadata/DocumentDetailPanel.tsx` — **8 / 6 / 453** at my HEAD (the CLAUDE.md row reads `6 / 5 / 405`, measured at the phase start and now stale by two commits and one phase). **G-5 FIRES**, and it is **honoured by construction**: two additive children and five lines of state, zero branches touched, zero shipped props changed. The ledger row + its `docs/HOT-FILE-LEDGER.md` section are the phase close's to update (same-commit sync rule) — this plan does not edit CLAUDE.md.

⚠ `frontend/src/lib/api/documents.ts` **has no ledger row of its own**. `lib/api.ts`'s row is the **BARREL**; the twelve domain modules the Phase 207 split created are separate files and only `knowledge.ts` / `threads.ts` / `workflows.ts` were ever given rows. This is a finding to record, not one to repeat.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — Bug] A failed *Load more* would have unmounted the text already read**
- **Found during:** Task 2, reviewing my own first draft before commit
- **Issue:** `loadMore`'s catch set `state = "error"`. The text is rendered by the `state === "ready" && text.length > 0` arm, so a continuation failure on page 4 of 13 would have blanked the three pages the reader was looking at — while the docblock claimed the opposite.
- **Fix:** a dedicated `appendError` flag; `state` is untouched, the text stays, and an inline `role="alert"` says the continuation failed.
- **Files:** `DocumentContentSection.tsx` · **Commit:** `95672c063`

**2. [Rule 1 — Bug] The lazy suite's mock generics made its argument assertions untypeable**
- **Found during:** Task 3, when `tsc` rose 33 → **37**
- **Issue:** `vi.fn<() => Promise<T>>()` types every call tuple as `[]`, so `mock.calls[0][0]` (the document id) and `[1][1]` (the paging opts) were `TS2493`. Four errors, all mine.
- **Fix:** real argument types on both mocks and the matching cast in the factory. Back to **33**.
- **Files:** `DetailSections.lazy.test.tsx` · **Commit:** `4551a0d2d`

### ⚠ Two fences caught my PROSE, not my code — in opposite directions, in one plan

This is the finding worth carrying forward, because both halves of it are now measured rather than theorised.

- **A grep fence is tripped by prose ABOUT the rule.** Task 2's source gate greps each section file for `dangerouslySetInnerHTML` and fails on a hit. It failed — on my docblock sentence *"there is NO `dangerouslySetInnerHTML` in this file"*. The code was already correct. This is the trap `lib/api/documents.ts`'s own docblock records from 187-24; **the prose was de-spelled, the fence was not weakened.**
- **A COUNTING fence can pass on comments alone.** The same gate counts `defaultOpen={false}` and requires ≥ 2. It read **3** — two mounts plus my explanatory comment. It would have passed with *one* real mount and two comments. **The comment was de-spelled and the count now reads 2, meaning two mounts.**

The general rule: **a fence that reads a file-wide literal cannot distinguish a use from a mention.** Prose in a fenced file must either avoid the literal or the fence must be scoped to the code region — and the second is more work than it is worth for a leaf component.

### Deviation from an acceptance criterion's LITERAL (intent satisfied)

The plan's task-3 criterion greps for `vi.mock("@/lib/api")` — with a closing paren. The mock takes a factory, so the shipped line is `vi.mock("@/lib/api", async () => {` and the paren-terminated literal cannot appear. **The criterion's intent — mocked at the BARREL path, not the domain path — is satisfied and verified:** `grep -n 'vi.mock("@/lib/api"'` returns line 54, and there is no `vi.mock("@/lib/api/documents")` anywhere in the file. The factory form is also exactly what the shipped `DocumentDetailPanel.images.test.tsx` uses.

## Verification

| Check | Result |
|---|---|
| `vitest run DetailSections.lazy.test.tsx` | **14 passed** (plan asks ≥ 10) |
| `vitest run apiBarrel.test.ts` | **5 passed** (was 3) |
| `vitest run DocumentDetailPanel.images.test.tsx` | **3 passed** — the shipped panel suite, unchanged |
| all three together, `--maxWorkers=2` | **3 files / 22 passed** |
| `tsc --noEmit -p tsconfig.app.json` | **33** errors — **exactly the inherited baseline**, 0 from any file this plan touched |
| Task 2 automated source gate (plan's, verbatim) | `task 2 source gate OK` |
| `grep -c 'defaultOpen={false}' DocumentDetailPanel.tsx` | **2** (two mounts; no prose inflation) |
| `grep -n 'title="Details"' DocumentDetailPanel.tsx` | **nothing** — D-217-25b holds |
| `grep dangerouslySetInnerHTML src/components/metadata/` | **nothing** |
| `git diff --diff-filter=D` over the three commits | **no deletions** |
| `git status --short` | **clean** — no untracked files |

**Not run, deliberately:** the full `vitest-count-gate.cjs`. Its pins are plan 12's to move, and the inherited baseline records the gate as **nondeterministic** (`failed 4` then `failed 0` minutes apart on a byte-identical tree). The three in-scope suites above are deterministic and were run explicitly, which is the pairing CLAUDE.md's cap correction (b) asks for.

## Known stubs

None. All five client functions call real shipped routes; both sections render real data with four honest arms each. `listDocumentTables` / `listDocumentImages` / `listDocumentQueries` ship here **without a consumer by design** — plan 11 mounts their sections, and they are covered by the barrel test rather than left unguarded.

## Threat flags

None. No new network endpoint, no auth path, no schema change. T-217-37 (XSS) is mitigated by React text children plus a grep fence plus a render case proving an `<img src=x onerror=...>` payload produces no `img` element; T-217-38 (DoS on open) by `defaultOpen={false}` with the zero-call assertion and its non-vacuity control.

## Owed

- **Manual row M-5** (the empty arms are honest across real documents of each kind) stays **OWED** — it is read against real files, not fixtures. This plan ships two of the five empty sentences: *"No text was extracted from this file"* and *"This document has no indexed chunks"*, each measurably different from its section's error sentence.
- **A G-4 chat-surface row** on the now-eight-section panel (see above).
- **Plan 12:** re-pin `apiBarrel.test.ts` 3 → 5, and decide whether `DetailSections.lazy.test.tsx` is adopted file-level or the `src/components/metadata` directory is taken whole.

## Self-Check: PASSED

All 8 files asserted present on disk (3 created, 4 modified, plus this SUMMARY). All 3 task
commits resolve in `git log --all`: `3e24f81b6`, `95672c063`, `4551a0d2d`. No file claimed in
`key-files` is missing; no commit hash quoted in this document is unresolvable.
