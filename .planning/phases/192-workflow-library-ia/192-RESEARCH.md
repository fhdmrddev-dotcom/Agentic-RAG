# Phase 192: Workflow Library IA — Research

**Researched:** 2026-08-10
**Measured against:** `HEAD = a0795512` (branch `develop`)
**Domain:** React page restructure (frontend) + one additive FastAPI/asyncpg payload field (backend)
**Confidence:** HIGH on everything measured in this repo · MEDIUM on the two recommendations that
are genuinely open design calls (project-filter semantics under a merged list; module boundaries)

> **This research re-derived every number.** Nothing below is inherited from CONTEXT.md, the sketch
> READMEs or the MANIFEST. Each claim carries the command or `file:line` that produced it. Where
> CONTEXT.md is wrong, § "Line-number audit" states the corrected value — that is a service, not a
> contradiction (CONTEXT.md itself corrects the MANIFEST on D-12).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: G-5 is HONORED, not overridden — and the seam is split by what survives 192.**
`frontend/src/pages/WorkflowsPage.tsx` measures 1407 lines / 21 commits / 10 phases at HEAD. The
extraction is **not** a uniform 188.2-style verbatim cut. Split by survival:

| Code | Survives 192? | Treatment |
|---|---|---|
| `RunModal` (`:1054–1407`, ~354 L) | yes, unchanged | Verbatim move to its own module. Capture the characterization baseline **BEFORE** the move. |
| WFIN-03 victim-naming delete Sheet (`:872–1003`) | yes, unchanged | Verbatim move to its own module, same baseline-first rule. |
| `DraftCard` (`:693`) · `PublishedCard` (`:745`) · `StarterCard` (`:1014`) | no — replaced by 159-C's single card | Rewritten as new code under `frontend/src/components/workflows/library/`. Do NOT extract-then-rewrite. |
| `FilterItem` (`:675`) · `NetNewFlag` (`:80`) | no — see D-05, D-11 | Removed or re-homed with the toolbar work. |

Target end state: `WorkflowsPage.tsx` is composition. Destination dir
`frontend/src/components/workflows/library/` does not exist today and is created by this phase.

**D-02:** The three shelves (`:544`/`:568`/`:604`) collapse into a **single flat result list** with a
persistent toolbar. **Create leads the toolbar** — this fixes SC#4 structurally rather than by
promotion.

**D-03: Six chips ship** — *Ready to run · Yours · Still building · Starters · Makes a file · 🔒 Strict*.
Every chip **recounts against the live search**. Shelf names are re-homed: "Published" → *Ready to
run*, "Drafts & seeds" → *Still building*, "Starters" → *Starters*.

**D-04: ⚠ 192 IS NOT FRONTEND-ONLY.** Add the ownership field to the `/workflows/published` payload
(`is_mine` / `created_by`, plus `is_system_global`) so all six chips filter client-side with honest
simultaneous counts. This phase touches `backend/app/api/workflows.py`, the repository query behind
`list_published_workflows`, and `frontend/src/lib/api.ts`.

**D-05: The 200px project rail becomes a searchable SELECT in the toolbar.** One filter home, not two.
Project stays a **server-side** filter (`?project_folder_id=`, live re-query) — only its instrument
changes.

**D-06: The search field is always visible** (not tap-to-open).

**D-07: Scope = workflow name + the purpose sentence (`business_requirement`), with the hit
highlighted.**

**D-08: It is SUBSTRING matching, not meaning — and the product must say so.** No copy, placeholder,
tooltip, commit message or SUMMARY may imply semantic search.

**D-09: One primary verb + a `⋯` overflow, one action vocabulary for one list.**

| Row state | Primary | Overflow `⋯` |
|---|---|---|
| Runnable (published or starter) | `▶ Run` | the fork verb · `Delete workflow…` |
| Draft ("Still building") | `✎ Open` | `Delete` |

**D-10: `Publish…` is REMOVED — it is a button that lies.** `✎ Open` (`:723`) and `Publish…` (`:731`)
are both `onClick={onOpen}`.

**D-11: Developer vocabulary leaves the user-visible surface.** `GET /workflows/published` renders at
`:491` (honesty banner) and `:577` (Published shelf chip). Both go. The honesty banner is **re-worded
in plain language, not silently deleted**. ⚠ Plan-time check delegated to research: verify whether
the "net-new" draft-CRUD claim is still true.

**D-12: `onTweak` and `onUseStarter` are SIBLINGS, NOT TWINS — share one WORD, never one FUNCTION.**
`onTweak` (`:220–247`): same slug, version N+1. `onUseStarter` (`:257–…`): new auto-suffixed slug,
version 1, because `UNIQUE(slug, version)` is GLOBAL across all users; retries once on 409. Ship one
verb on the card face and branch on **provenance** to pick the handler. Both handlers stay intact.

**D-13: The consequence sentence is spent once, on the fork verb.**

**D-14: The sentence is an a11y CONTRACT, not a caption.** Real DOM text via `aria-describedby` —
never `title=`, because touch has no hover. The two shipped `title=` explanations are removed by being
replaced: `:857` and `:155` region.

**D-15: NO confirm sheet on the fork.** Forking is non-destructive and reversible → direct flip.

**D-16: The flat list is a client-side MERGE of separate feeds.** `/workflows/published` and
`/workflows/starters` are distinct endpoints; drafts come from a third source. Both feeds are the
documented **RUN CARVE-OUT** and are explicitly NOT feature-gated (`workflows.py:171`); the merge must
not introduce a gate. Dedupe is a plan-time concern.

### Claude's Discretion

- Toolbar layout order and responsive collapse behaviour below the mockup's breakpoints.
- Whether the merged feed fetches in parallel or sequentially, and the loading/empty-state composition
  — subject to the honest-empty-state rule (`WorkflowSoul`'s D-03 pattern: the atom is always
  rendered, never hidden, never fabricated).
- Module boundaries inside `components/workflows/library/` beyond the two verbatim moves named in D-01.

### Deferred Ideas (OUT OF SCOPE)

- **158-B — teach ⌘K about workflows.** Deferred, not rejected, on blast radius. Re-open when ANY of:
  (1) a second surface asks to be findable from ⌘K; (2) a user is observed pressing ⌘K on the
  Workflows page and getting only chats; (3) **any phase touches `ThreadCommandPalette.tsx` or
  `lib/threadGroups.ts` for another reason** — fold B in then.
- **Semantic / meaning-based workflow search.** D-08 ships substring matching.
- **The hover-only phase-type word on chain glyphs.** Carried, unfixed, inherited.
- **URL-addressable filter state.** Out of scope — the page has no router by design (`:320`).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **LIB-01** | A user can search the Workflows page by name and filter the list, instead of scanning three unlabelled shelves. | § "The search primitive already exists" (`HighlightTitle`, `threadGroups.tsx:137` — importable unchanged, carries the T-156-01 XSS control); § "The D-16 merge" (the three feeds, their exact predicates, and a proof that they cannot collide); § "Chip derivation inventory" (which of the six chips derive from data already on the wire). |
| **LIB-02** | A workflow card shows what the workflow is for, at a glance, without decoding internal vocabulary. | § "What survives untouched" — `WorkflowSoul scale="card"` is consumed unchanged; `business_requirement` is present on every feed including starters (measured in mig 094). § "Developer vocabulary census" lists every internal string that renders to a user today. |
| **LIB-03** | A user can predict what each card action does before clicking — "Tweak" must not silently open a full edit surface. | § "D-12 — the fork branch, and whether it blocks on D-04" (it does **not**); § "The `title=` census" (six, not three); § "Verb inventory measured at HEAD". |
| **LIB-04** | The create affordance is findable without scrolling past two shelves of existing workflows. | § "The frame today" — build-card is the first cell of the third grid (`:613`) inside one scroll container (`:518`). D-02 makes this structural. |
</phase_requirements>

---

## Summary

**This is a three-concern phase, and the wave structure should say so.** (1) A **frontend restructure**
of a 1407-line page that six other test files render live. (2) A **two-line backend payload widening**
that carries a real, if small, disclosure decision. (3) A **safety-net problem** — the suites that
cover this page are *entirely outside* the vitest count gate, which is the eighth occurrence of the
documented two-knob trap and the single most consequential finding in this document.

The good news is measured and large: `WorkflowsPage.tsx` and `WorkflowsPage.test.tsx` are at **0 lint
errors** and **0 a11y-lint errors** today, the typecheck baseline is **exactly 33 errors** (matching
the figure CLAUDE.md recorded at 188.2, re-derived here), and all eight affected suites are
**123 tests / 0 failures** on a clean run. Every guard this phase adds starts from a clean stick.

The bad news is also measured. The delete-Sheet "verbatim move" CONTEXT.md scopes at `:872–1003` is
**under-specified by 37 lines of closure** that live *above* the JSX inside the card being deleted.
`NetNewFlag` is rendered in the **Builder breadcrumb** as well as the library, and one of its renders
is asserted **byte-exactly, including its full `title=` string and Tailwind class list**, inside a
suite pinned at 32 in the count gate. And there is a genuine, unnamed IA defect the merge creates: the
project filter is server-side on published rows only, while **starters carry no `project_folder_id`
at all** — so under one flat list, picking a project silently deletes every starter from view.

**Primary recommendation:** structure the plans as **Wave 0 = test-safety-net + characterization
baselines** (adopt the four unguarded suites into `TARGETS`/`BASELINE`, capture pre-move `innerHTML`
baselines while the destination modules provably do not exist), then run the **backend field** and the
**frontend restructure** as *independent parallel waves* — because D-12's provenance branch does **not**
depend on D-04 (proven below), which is the one dependency everyone will assume exists.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Page search (name + `business_requirement`, substring) | Browser / Client | — | Every row is already in memory after the three feeds land; a server search would need a new endpoint and would contradict D-08's "substring, not meaning" honesty. |
| Five of six filter chips (*Ready to run · Still building · Starters · Makes a file · 🔒 Strict*) | Browser / Client | — | All derive from `definition` JSONB already on the wire (`soulData.ts`, `deriveTier.ts` import nothing from the API client). |
| *Yours* chip | Browser / Client | API (one additive field) | D-04. Derivable from feed origin today, but an explicit row field survives the merge — see § "D-04". |
| Project filter | API / Backend | Browser (for rows the server does not filter) | Shipped as `?project_folder_id=` (`workflows.py:176`, bound as `$N` at `db/workflows.py:293`). Starters and drafts are **not** covered by it — see § "The unnamed IA defect". |
| Chip counts | Browser / Client | — | Must recount over the *rendered* row set, never over a set a pending re-query has not returned. |
| Fork (`onTweak` / `onUseStarter`) | Browser (branch) | API (`POST /workflows` INSERT) | The `UNIQUE(slug, version)` GLOBAL constraint is a DB invariant; the client picks which handler, the server enforces `status='draft'`, `is_system_global=false`, `created_by=caller` (`db/workflows.py:477–478`). |
| Delete | API / Backend | Browser (victim-naming sheet) | Server-confirmed only, no optimistic vanish (D-LOCK-04). Moves verbatim. |
| Run launch | Frontend Server host (`ChatLayout.doRun`) | — | `onLaunch` is a prop from `ChatLayout` (`ChatLayout.tsx:704`). 192 must not change this handoff. |

---

## Line-number audit — CONTEXT.md verified against `HEAD = a0795512`

Commands: `wc -l`, `grep -n`, `git log --oneline -- <file> | wc -l`, `sed -n '<n>p'`.

### ✅ Confirmed exactly

| Claim | Measured |
|---|---|
| `WorkflowsPage.tsx` = **1407 lines** | `wc -l` → 1407 |
| **21 commits across 10 phases** | `git log --oneline -- <file> \| wc -l` → 21; phases `103 124 143 152 155 165 184 184.1 186 188` |
| `frontend/src/components/workflows/library/` **does not exist** | `ls` → *No such file or directory* |
| `NetNewFlag` at `:80` | `function NetNewFlag(` at 80, body 80–90 |
| `onTweak` at `:220–247` | `const onTweak = useCallback(` at 220, closes `)` at **248** |
| shelves at `:544` / `:568` / `:604` | `<section data-testid="starters-shelf">` 544 · `published-shelf` 568 · `drafts-shelf` 604 |
| build-card at `:613` | `<button … data-testid="build-card"` 613 |
| `FilterItem` `:675` · `DraftCard` `:693` · `PublishedCard` `:745` · `StarterCard` `:1014` | all exact |
| honesty-banner `GET /workflows/published` at `:491` | exact, real DOM text |
| Published-shelf chip `GET /workflows/published` at `:577` | exact, real DOM text |
| `✎ Open` `:723` and `Publish…` `:731` **both `onClick={onOpen}`** | testids at 722 / 730, handlers at 723 / 731 |
| Tweak `title=` at `:857` | `title="Fork a new version into the Builder (the published row stays frozen)"` |
| "no router" comment at `:320` | `THERE IS NO ROUTER HERE (the three-homes contract…` |
| `Sheet` import at `:37` | exact |
| `DropdownMenu` `⋯` host at `:820–845` | right-cluster div 820, `DropdownMenu` 821–841, pill 842–844, div closes 845 |
| `frontend/src/lib/api.ts:1349` = `PublishedWorkflow` | `export interface PublishedWorkflow {` at 1349 |
| `workflows.py:171` RUN CARVE-OUT | `# Phase 148 (VIS-01) — RUN CARVE-OUT: DO NOT gate /published or /starters.` |
| `workflows.py:175` `/published` | `@router.get("/published", …)` at 175 |
| starters seeded, world-readable, `category='starter'` | `db/workflows.py:317–322` |

### ⚠ Corrected — these are wrong at HEAD and would send a plan task to the wrong code

| CONTEXT.md | Measured at HEAD | Impact |
|---|---|---|
| D-14: *"`:155` region — `title="Fork a fresh personal copy of this starter into the Builder"`"* | **`:1044`**. Line 155 is `const publishedSeqRef = useRef(0)`. | **Highest impact of the set.** A plan task "convert the `title=` at `:155`" edits a race-guard ref. Inherited from the sketch READMEs (159 and the MANIFEST both say `:155` region). |
| code_context: *"breaks this rule in at least three places (`:84`, `:576`, `:857`)"* | **Six** `title=` attributes: `:84`, `:550`, **`:574`**, `:857`, `:1028`, `:1044`. `:576` is a `className` line. | Under-counts the conversion surface by half. Full census below. |
| D-01: `RunModal` (`:1054–1407`, ~354 L) | `function RunModal(` at 1054, closing `}` at **1405**. `:1406` is blank and **`:1407` is `export default WorkflowsPage`** — which must NOT move. Extent = **352 L**. | A range that includes 1407 moves the default export out of the page. |
| D-01: delete Sheet `:872–1003` | The `<Sheet>` JSX is 877–1003 (comment from 872) ✅ — **but it closes over `type DeletePhase` at `:743`, five `useState` hooks + `descId` at `:768–772`, `openDeleteSheet` at `:774–786` and `handleDelete` at `:788–799`**, all inside `PublishedCard`, which D-01 deletes. Real extent ≈ **169 lines**, not 132. | See § "The delete Sheet is not a self-contained block". |
| D-12: `onUseStarter` (`:257–…`), shipped comment `:250–256` | `const onUseStarter = useCallback(` at **258**, closes at **291**. Comment block **250–257**. | Off-by-one; harmless, but the extent 258–291 is what a move needs. |
| canonical_refs: `/starters` at `:~229`, `?scope=mine` at `:~198` | `/starters` decorator at **223**, handler `224`. `scope: str \| None = None` at **178**; `owned_only=(scope == "mine")` at **210**. | Both were written with `~`, so this is precision not error. |
| deferred: `lib/threadGroups.ts` | The file is **`frontend/src/lib/threadGroups.tsx`** (its own docblock at `:17–19` explains why: it ships a JSX component). | Matters — see § "The search primitive already exists". |
| deferred: *"Twelve reports are `status: open`"* | **13** non-template reports carry `status: open` (`BUG-260810-01-cloud-settings-connections-no-add-button.md` was filed the same day). Its `affected_areas` is `[settings/connections, deployment/cloud-parity, admin/feature-visibility]` — **no overlap with the workflow library.** | CONTEXT.md's routing conclusion ("nothing folded into 192") **stands, verified.** |

---

## Standard Stack

Nothing is installed. **This phase adds zero dependencies** — verified against
`frontend/package.json` at HEAD.

### Core (all already in the tree)

| Module | Where | Purpose | Why it is the answer |
|---|---|---|---|
| `HighlightTitle` | `frontend/src/lib/threadGroups.tsx:137` | D-07's "with the hit highlighted" | Signature is `{ title: string; query: string }` — **thread-agnostic**, importable with zero edits. Carries the **T-156-01 XSS control**: renders segments as JSX text nodes, never `innerHTML`. Aligns exactly with `WorkflowSoul`'s XSS rule (never `dangerouslySetInnerHTML` on `business_requirement`). |
| `ui/input.tsx` | `frontend/src/components/ui/input.tsx` | D-06's always-on search field | Exists. No new dependency; page-local blast radius. |
| `ui/select.tsx` | Radix `@radix-ui/react-select` wrapper | D-05's project select | Exists — **but see the caveat below.** |
| `ui/dropdown-menu.tsx` | already the `⋯` host at `:821` | D-09's overflow | Extends a shipped pattern. |
| `ui/sheet.tsx` | already imported at `:37` | the WFIN-03 delete sheet | Moves out intact. |
| `WorkflowSoul` (`scale="card"`) | `components/workflows/WorkflowSoul.tsx` | the 5 card atoms | **Consumed unchanged.** |
| `soulData.ts` (`tierForDefinition`, `soulDeliverable`, `entryInputKeys`, `PHASE_GLYPHS`) | `components/workflows/soulData.ts` | *Makes a file* + *🔒 Strict* chips | Pure client-side derivations over `definition`. `soulDeliverable` returns `{kind:"file"|"chat"}` (`:161`); `tierForDefinition` returns a `deriveTier` result (`:111`). |
| `deriveTier.ts` | `components/workflows/deriveTier.ts` | tier ids `STRICT / MIDDLE / LOOSE` | Derived, never stored; imports nothing from the API client. |

**⚠ Radix `Select` has no built-in search.** D-05 asks for a *searchable* select and `ui/select.tsx` is
a thin Radix wrapper (`SelectPrimitive.Root/Trigger/Value/…`) with no filter input. There is **no
`cmdk`** in `package.json` (verified — this is also why 158-B is expensive). The two shipped picker
precedents both render a **native `<select>`**: `DescribeKbPicker.tsx:173` and `ConnectionPicker.tsx:344`.

**Recommendation (Claude's discretion territory):** for the project filter, ship a **native `<select>`**
matching the two shipped precedents, and add the search input *only if* the folder count in the target
tenant justifies it. Reasons, in order: (a) it is the pattern this codebase already holds in two
places and the RunModal's own KB-scope select (`:1253`) is a third; (b) a native `<select>` is
free a11y and free keyboard type-ahead — browsers already do prefix matching on option text, which
covers a meaningful share of "searchable"; (c) building a filtered combobox on Radix Select means
hand-rolling focus management, and this phase already has to hand-roll nothing else. **If the plan
does build a filtered combobox, it must not reach for `cmdk`** — adding it here would put a
command-palette dependency in the tree that 158-B's deferral was explicitly costed against.

### Alternatives considered

| Instead of | Could use | Tradeoff |
|---|---|---|
| Importing `HighlightTitle` from `lib/threadGroups.tsx` | A page-local copy under `library/` | A copy violates the recorded **"one home per concern"** red line and duplicates the XSS control — the exact thing `threadGroups.tsx`'s docblock (`:12–15`) says it exists to prevent. **Import it.** See the 158-B trigger analysis below. |
| Native `<select>` for project | Radix Select + filter input | See above — recommend native. |
| Client-side merge (D-16, locked) | A server-side merged endpoint | Locked out by D-16 and by `workflows.py:171` — a new merged endpoint would need its own gating decision and could re-introduce the gate the RUN CARVE-OUT forbids. |

### Installation

```bash
# none — zero new dependencies
```

---

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.** Verified: the Standard Stack above is
entirely modules already present in `frontend/package.json` at HEAD and existing source files in
`frontend/src/`. No `npm install` task belongs in any plan for this phase. If a plan proposes one, that
is a scope change and should be surfaced, not executed.

**Packages removed due to slopcheck `[SLOP]` verdict:** none — no packages evaluated.
**Packages flagged `[SUS]`:** none.

---

## ⚠ Does importing `HighlightTitle` fire 158-B's re-open trigger #3?

The trigger reads: *"any phase touches `ThreadCommandPalette.tsx` or `lib/threadGroups.ts` for another
reason — fold B in then."*

**Recommendation: import it, and prove the file is byte-unchanged.**

Reasoning: the trigger's stated basis (sketch 158 README, § "Deferred: B") is **blast radius** — *"it
changes a global component … and its one shared match engine."* A zero-edit import changes neither. But
"touches" is ambiguous enough that a reviewer could read it either way, and this project's recorded
lesson is that an ambiguity resolved in prose gets re-litigated later. So convert it to a mechanical
fact: add a source fence asserting `lib/threadGroups.tsx` is unmodified by the phase — e.g. a `?raw`
content hash pinned in a test, or a plan-level `git diff --stat` assertion that the file appears in
zero commits of this phase. `?raw` imports are supported here (vite native; already used in 10+ test
files including `WorkflowBuilderPage.header.test.tsx:119`).

**Do NOT reuse `matchesTitle` (`threadGroups.tsx:74`)** — its signature is `(t: Thread, q: string)`, so
it is not applicable, and widening it *would* be touching the shared engine.

---

## The frame today — measured

| Fact | Evidence |
|---|---|
| Header has no create button, no search, no sort, no view toggle | `:479–486` |
| Body is ONE scroll container, `grid-cols-[200px_1fr]` | `:518` |
| 200px project rail is a `<nav aria-label="Project filter">` of `FilterItem` buttons | `:520–538` |
| Shelf order Starters → Published → Drafts | `:544` / `:568` / `:604` |
| Build-card is the FIRST cell of the THIRD grid | `:613` |
| Three sequential feeds, each latest-wins guarded by a `useRef` ticket | `:155–157`, `:159–195` |
| Only `aria-describedby` on the page is the delete Sheet's | `:886` (`descId`) |
| Navigation is `useState<PageView>`, no router | `:116`, comment at `:320` |

### Verb inventory at HEAD (LIB-03's real surface)

| Verb | Line | Handler |
|---|---|---|
| `✎ Open` | 727 (testid 722) | `onOpen` |
| `Publish…` | 735 (testid 730) | `onOpen` — **the same handler** |
| `⑂ Tweak` | 860 (testid 855) | `onTweak` |
| `▶ Run` | 868 (testid 864) | `onRun` |
| `⋯ Delete workflow…` | 838 (testid 833) | `openDeleteSheet` |
| `Use this →` | 1047 (testid 1042) | `onUse` → `onUseStarter` |
| `▶ Run now` (post-publish CTA) | 513 | opens `RunModal` |

**Seven, not six** — the post-publish Run CTA (`:496–516`, testid `run-cta`) is a seventh action
surface on this page. CONTEXT.md's D-09 table covers the card verbs; the plan must decide what happens
to `run-cta` under the single-list frame (it is a page-level banner, not a card verb, so the honest
default is: **keep it unchanged**, and say so).

### `title=` census — six, not three

| Line | Text | Fate under the locked decisions |
|---|---|---|
| `:84` | `"Net-new surface — only GET /workflows/published + POST /workflows/{id}/publish are live today"` | ⚠ **`NetNewFlag` also renders in the BUILDER band at `:382`.** See § "The NetNewFlag landmine". |
| `:550` | `"Curated, official starter workflows — fork one into your own editable copy"` | Dies with the Starters shelf (D-02). |
| `:574` | `"The live, owner-scoped endpoint (mine-only via ?scope=mine)"` | Dies with the Published shelf (D-02/D-11). |
| `:857` | `"Fork a new version into the Builder (the published row stays frozen)"` | **D-14 → `aria-describedby`.** |
| `:1028` | `"A curated, official starter — fork it into your own editable copy"` | Dies with the rewritten card (D-09). |
| `:1044` | `"Fork a fresh personal copy of this starter into the Builder"` | **D-14 → `aria-describedby`.** (CONTEXT.md says `:155` — corrected.) |

Five of six leave naturally. Only `:84` survives, and only in the Builder band — which is the trap.

---

## ⚠ The NetNewFlag landmine (this is not in CONTEXT.md)

`NetNewFlag` (`:80–90`) is rendered **three times**:

| Line | Surface | In 192's scope? |
|---|---|---|
| `:382` | The **Builder** breadcrumb band (`pageView === "builder"`) | **No** — that is Phase 193's surface |
| `:492` | The library honesty banner | Yes (D-11) |
| `:609` | The Drafts shelf header, `label="net-new list"` | Yes (D-02) |

And `frontend/src/pages/WorkflowBuilderPage.header.test.tsx:303` asserts the flag-off breadcrumb band
by **byte-exact `innerHTML`**, including the flag's full `title=` string and its complete Tailwind
class list. Two more assertions at `:363` and `:794` require `getByTestId("net-new-flag")` to be
present. **That suite is pinned at 32 in `scripts/vitest-count-gate.cjs`.** Deleting `NetNewFlag`
outright fails the gate with `[failing-tests]` on a suite this phase never intended to open.

**Recommendation:** 192 removes only the **two library-view renders** (`:492` with the banner, `:609`
with the shelf) and leaves the `NetNewFlag` *function* and its `:382` render untouched.
`noUnusedLocals` is on (`tsconfig.app.json`) but the function stays used, so no type error. Record the
surviving `:84` `title=` as a Builder-band residual, deferred to Phase 193 with a named trigger. This
keeps 192's blast radius inside the phase boundary CONTEXT.md drew, and avoids editing a pinned
suite's byte-exact baseline for a surface this phase does not own.

---

## ⚠ D-11 plan-time check — ANSWERED: the "net-new" claim is FALSE at HEAD

CONTEXT.md D-11 delegates this. **Measured:**

| Draft operation | Route | Line | Gate |
|---|---|---|---|
| create | `POST /workflows` | 979 | `require_visible("workflow_authoring")` |
| list | `GET /workflows/drafts` | 1012 | `require_visible("workflow_authoring")` |
| update | `PATCH /workflows/{id}` | 1044 | `require_visible("workflow_authoring")` |
| delete | `DELETE /workflows/{id}` | 1141 | `require_visible("workflow_authoring")` |

All four are **live, shipped and in production use** — `createWorkflowDraft`, `listDraftWorkflows`,
`updateWorkflowDraft` and the cascade delete are all called from this very page. The banner's two
claims are therefore **both false**:

1. *"only `GET /workflows/published` + `POST /workflows/{id}/publish` are live"* — false since Phase 103.
2. *"Draft create/list/update/delete are net-new"* — false.

**Recommendation:** the disclosure has **no remaining job**, and a disclosure of a falsehood cannot be
honestly re-worded — re-wording it would ship a *new* false statement in plain language. D-11's bar
("not silently deleted") is satisfied by deleting it **loudly**: the plan records the measurement
above as the reason, and the SUMMARY states that the banner was removed because its claim was
verified false, not because it was inconvenient. This is the honest reading of D-11's own conditional
("*verify whether that claim is still true before deciding whether the disclosure has any remaining
job*") — the check was performed and the answer is no.

---

## The D-04 backend question — the highest-value unknown

### What the query actually selects

`backend/app/db/workflows.py:231–296`, `list_published_workflows` (name **confirmed**, not guessed):

```sql
-- owned_only = True   (what the Workflows page sends today, via ?scope=mine)
SELECT id, slug, name, definition FROM workflow_definitions
WHERE status = 'published' AND created_by = $1

-- owned_only = False  (every other caller: composer picker, WorkspacePanel, threads.py kickoff)
SELECT id, slug, name, definition FROM workflow_definitions
WHERE status = 'published' AND (is_system_global = true OR created_by = $1)
```
Plus `AND definition->>'project_folder_id' = $N` when a project is supplied (`:293`), then
`ORDER BY name` (`:294`).

**Answer to "does the row already carry ownership?": NO — neither `created_by` nor `is_system_global`
is in the SELECT list.** They exist as *columns on the table* and are used in the `WHERE`, but they
are never projected. So D-04 is **not** "un-drop a field at serialization"; it is "add columns to two
SELECTs and two Pydantic fields." That distinction matters — it is the smaller of the two possible
tasks, and it means the wire shape genuinely changes for the first time since Phase 103.

`/starters` (`db/workflows.py:299–323`) selects the same four columns with
`status='published' AND is_system_global=true AND definition->>'category'='starter'`.

### RLS: it is NOT the boundary here — the WHERE clause is

`get_pg_pool()` is a **service-role asyncpg pool that bypasses RLS**, stated in the module's own
comments at `db/workflows.py:445–447` (*"The service-role engine bypasses RLS, so EVERY query
self-scopes `created_by = $N`"*) and `:493` (*"the service role bypasses RLS so the WHERE is the
boundary"*). `workflows.py:75–86` records why `/published` and `/starters` deliberately keep
service-role rather than the per-request user-JWT swap: a user-JWT read would **hide cross-org
starters**.

**Consequence for D-04:** you cannot lean on RLS to make a returned `created_by` safe. Whatever the
SELECT projects, the caller receives.

### Recommendation: ship `is_mine: bool` + `is_system_global: bool` — NOT a raw `created_by` UUID

**Security reasoning, and it is the Phase-190 CR-01 lesson applied prospectively.** Today the
predicate `(is_system_global = true OR created_by = $1)` means the only non-caller rows in the feed
are globals, whose `created_by` is the seed system user
`00000000-0000-0000-0000-000000000001` (`supabase/migrations/094_starter_workflows.sql:15`). So a raw
`created_by` leaks nothing *today*. That is exactly the shape of the mig-116 mistake: a projection
that is safe under today's predicate, shipped into a query whose predicate a later phase widens.
v3.4's org model (co-tenant `org_id` + membership RLS, `is_org_shared`) is precisely the widening on
the roadmap — the moment a co-tenant's published workflow enters this feed, a raw `created_by`
silently starts emitting other users' UUIDs, with no code change and no review.

`is_mine` **cannot** widen: it is computed server-side against the authenticated caller and discloses
exactly one bit that the UI actually renders. `is_system_global` discloses a property of the *row*,
not of a person.

```python
# backend/app/api/workflows.py — PublishedWorkflow (:1349-equivalent, :115–128)
class PublishedWorkflow(BaseModel):
    id: UUID
    slug: str
    name: str
    definition: dict | None = None
    # Phase 192 (LIB-01 / D-04) — ADDITIVE, DEFAULTED. Both default so every existing
    # consumer keeps validating unchanged (the Phase-103 `definition` precedent).
    is_mine: bool = False
    is_system_global: bool = False
```
```python
# in BOTH handlers, computed from the row — never from the client
PublishedWorkflow(
    id=r["id"], slug=r["slug"], name=r["name"],
    definition=_coerce_definition(r.get("definition")),
    is_mine=(r.get("created_by") == caller_uuid),
    is_system_global=bool(r.get("is_system_global")),
)
```
SQL change is two words in each of the three SELECTs:
`SELECT id, slug, name, definition, created_by, is_system_global FROM …`.

### Blast radius of the added field

`PublishedWorkflow` is the response model for **both** `/published` (`:175`) and `/starters` (`:223`) —
one model, two endpoints. Adding **defaulted** fields is additive and safe for every consumer, of
which there are 22 files on the frontend referencing the type. The three production consumers are:
`WorkflowsPage.tsx`, `components/panel/WorkspacePanel.tsx`, and
`components/workflows/StarterTemplatePicker.tsx` (plus `ChatLayout.tsx` and `definitionOps.ts` which
carry the type). None reads unknown keys; TypeScript excess-property checks do not apply to values
returned from `as` casts on `fetch` JSON.

**Backend test note:** the `/starters` handler must set `is_mine` too. Under the shipped predicate it
is always `False` for a real caller (starters are `created_by = seed system user`), but hard-coding
`False` there would be an unstated invariant. Compute it the same way in both handlers.

### `?scope=mine` — keep it. Recommendation with reasoning.

**Recommendation: KEEP `?scope=mine`, and keep the Workflows page passing it.**

Three reasons, in order of weight:
1. **It is what makes the D-16 merge dedupe-free by construction** (proven in the next section).
   Dropping it switches the page to the `(is_system_global OR created_by)` predicate, which returns
   *every starter as well*, and the merge would then duplicate all three curated rows.
2. Other callers depend on `owned_only=False` — the composer Harness picker, `WorkspacePanel` run-soul
   recovery and `threads.py` kickoff (`db/workflows.py:267–270`, "Pitfall 3"). The parameter is the
   *only* thing separating those two feeds.
3. Removing it is a behaviour change on a RUN CARVE-OUT endpoint for zero user-visible benefit.

### Migration / env / deploy-parity — CONFIRMED, D-04 triggers nothing

- **No migration.** `created_by` and `is_system_global` are existing columns on
  `workflow_definitions` (used in every `WHERE` in `db/workflows.py`). Nothing is created, altered or
  seeded.
- **No env var.**
- **`scripts/check-deploy-drift.sh` is therefore not triggered** — its scope is env vars the app
  reads, seed-bearing migrations, bundled services and the sandbox image tag. None applies.
- **The cloud-parity rule still applies to the code deploy itself** (backend must ship with the
  frontend, or the chips silently see `is_mine: undefined`). Because both fields are **defaulted**,
  a frontend-ahead-of-backend deploy degrades to "nothing is mine" rather than crashing — which is
  wrong-but-safe. **Recommend the frontend treat a missing field as `undefined` and fall back to
  feed-origin provenance**, so the degraded state is *correct* rather than merely non-fatal.

---

## The D-16 merge — two feeds, three sources, one list

### The three sources, named and measured

| Source | Client fn | Endpoint | Server predicate | Row type |
|---|---|---|---|---|
| Published (mine) | `listPublishedWorkflows(projectArg, undefined, {scope:"mine"})` (`api.ts:1379`, call site `WorkflowsPage.tsx:169`) | `GET /workflows/published?scope=mine` | `status='published' AND created_by = $1` | `PublishedWorkflow` |
| Starters | `listStarterWorkflows()` (`api.ts:1411`) | `GET /workflows/starters` | `status='published' AND is_system_global=true AND definition->>'category'='starter'` | `PublishedWorkflow` |
| **Drafts** — the "third source" | `listDraftWorkflows()` (`api.ts:3454`) | `GET /workflows/drafts` | `status='draft' AND created_by = $1` (`db/workflows.py:506`) | **`WorkflowDraftRow`** (`api.ts:3311`) — a *different* type |

### Can the same row appear in both feeds? **NO — and here is the proof, not an assertion**

Starters require `is_system_global = true`. `create_workflow_definition` binds
`is_system_global` to the **literal `false`** (`db/workflows.py:477–478`:
`INSERT … (…, created_by, is_system_global) VALUES ($1,$2,$3,'draft',$4::jsonb,$5,false)`), and the
publish flip changes `status`, not that column. So **no app path can ever produce a user-owned
`is_system_global=true` row.** The only globals are migration-seeded, with
`created_by = '00000000-0000-0000-0000-000000000001'`
(`supabase/migrations/094_starter_workflows.sql:15`, three `INSERT`s at `:59/:114/:169`).
`?scope=mine` filters `created_by = <caller>`. The intersection is empty.

**But make it defensive anyway.** The property holds *because* the page passes `?scope=mine`; if a
later phase drops that param the two feeds overlap on every starter, silently. **Recommendation:**
dedupe by `id` with a single `Map` at merge time (O(n), three lines), *and* add a test that asserts
the merged list contains no duplicate `id` when both feeds are stubbed to return the same row. That
converts an invariant held by a query parameter into one held by code.

**Dedupe key = `id`.** Not `slug`, not `slug+version`: `onTweak` deliberately creates a *second row
with the same slug* (version N+1), so a slug-keyed dedupe would swallow a user's own fork the instant
it appears in the drafts feed alongside the published original. `id` is a UUID PK and is present on
all three row types.

### The RUN CARVE-OUT — what the merge must not do

`workflows.py:171–174`:
> *"Phase 148 (VIS-01) — RUN CARVE-OUT: DO NOT gate /published or /starters. They are the Run picker
> feeds … end users need them so Run stays for everyone (D-05). … Only the AUTHORING/publish endpoints
> below carry `require_visible('workflow_authoring')`."*

Mechanically: `/published` (`:175`) and `/starters` (`:223`) carry **no `dependencies=[…]`** at all,
while the seven authoring routes each carry `Depends(require_visible("workflow_authoring"))`
(`:882, :979, :1012, :1044, :1141, :1217, :1247, :1387`) and the two canvas routes carry
`Depends(require_canvas())` (`:603, :784`).

**What the client-side merge must avoid, stated precisely:**
1. **Never make the runnable rows conditional on the drafts fetch.** `GET /workflows/drafts` **is**
   gated (`:1012`). If the merge awaits all three and renders nothing until all three resolve, a user
   without `workflow_authoring` visibility gets a 403 on drafts and — under a naive
   `Promise.all` + single error path — an **empty library**. That is the gate, re-introduced client-side
   on the two feeds the carve-out protects. This is the single highest-risk defect the merge can ship.
2. Do not add a feature-flag/visibility read that guards rendering of the merged list.
3. Do not route the two carve-out feeds through any new endpoint.

### Parallel vs sequential, loading and empty state — recommendation

**Recommend: `Promise.allSettled`, three independent fetches, per-source failure isolation.**

- **Parallel**, because the three feeds are independent and today's sequential-effect layout
  (`:197–207`, three separate `useEffect`s) already fires them concurrently in practice — so parallel
  is not a change in behaviour, only in how the result is composed.
- **`allSettled`, not `all`** — this is what discharges risk #1 above. A rejected drafts fetch must
  degrade to "zero drafts", never to "zero library".
- **Keep the three latest-wins `useRef` tickets** (`:155–157`). They exist because of a measured live
  symptom (`:149–154`: *"All projects showed 7, a specific project showed 16, but the rendered list
  lagged the selection"*). A merge that collapses them into one guard must preserve per-source
  latest-wins, because only `published` re-queries on project change.
- **Honest empty state**, per `WorkflowSoul`'s D-03 rule (the atom is always rendered, never hidden,
  never fabricated). Three distinct states must be **held apart**, following the shipped
  `DescribeKbPicker` / `StarterTemplatePicker` rule ("*there are none*" and "*we could not ask*" are
  DIFFERENT FACTS):
  1. **Loading** — no counts rendered at all (a count of 0 during load is a lie).
  2. **Genuinely empty** — "You have no workflows yet", create affordance already in the toolbar.
  3. **Filtered to empty** — "No workflows match *«query»*", with a one-click *Clear search & filters*
     (the sketch 158 behaviour), and the chips still showing their real recounted totals.
  4. **A source failed** — say which one failed and keep the others rendered. Never present a partial
     library as a complete one.

---

## ⚠ The unnamed IA defect the merge creates — project filter vs starters

**Measured facts:**
- `?project_folder_id=` narrows **only** `/published` (`db/workflows.py:291–293`). It is not a
  parameter on `/starters` or `/drafts`.
- On the shipped page, changing the project re-fetches **only** `published` — `refetchStarters` and
  `refetchDrafts` have `[]` deps (`:187`, `:195`) and their effects never re-run.
- **The three seeded starters carry no `project_folder_id` at all**: `grep -c "project_folder_id"
  supabase/migrations/094_starter_workflows.sql` → **0**.

Today, in three labelled shelves, this reads as *"the project filter applies to the Published shelf"* —
mildly confusing but survivable. **Under one flat list it reads as a broken filter**: a user picks
"DBA Chapters", the published rows narrow correctly, and thirty unrelated starters and drafts stay on
screen. Or, if the plan naively narrows all rows client-side by `definition.project_folder_id`, **every
starter vanishes** the moment any project is selected.

**This is a decision CONTEXT.md does not make and the planner must.** Recommendation, with reasoning:

> **Apply the project filter to published rows (server) and drafts (client-side on
> `definition.project_folder_id`), and hold starters OUT of it — with the toolbar saying so in one
> short phrase.** e.g. the select's helper line reads *"Starters aren't tied to a project."*

Why: a starter genuinely has no project — that is a property of the data, not a gap in the filter. The
honest surface states the fact rather than silently dropping rows (starters vanishing) or silently
ignoring the filter (starters persisting unexplained). It also reuses the mechanism that already
exists: the `UNBOUND` sentinel at `:67` and its client-side narrow at `:172–173` are exactly this
pattern, shipped. Drafts *do* carry `project_folder_id` in `definition`, so narrowing them client-side
is free and matches user expectation.

**Chip counts while a server re-query is in flight** (the D-03 × D-05 interaction). The honest
behaviour, stated as a rule the plan can test:

> **A chip count always describes the rows currently rendered.** While a project re-query is
> in flight, the previously-committed rows stay rendered and their counts stay correct for what is on
> screen; the list carries a quiet "updating…" marker. Counts are **never** zeroed, never
> pre-computed for rows that have not arrived, and never left describing a set the user cannot see.

This falls straight out of the honest-empty-state rule and is mechanically checkable: assert that at
every render, `chipCount(c) === renderedRows.filter(pred(c)).length`.

---

## D-12 — the fork branch, and whether it blocks on D-04

**It does not. This is a wave-structure finding.**

The two handlers differ exactly as D-12 says (re-read at HEAD):

| | `onTweak` (`:220–248`) | `onUseStarter` (`:258–291`) |
|---|---|---|
| slug | `wf.slug` — **same** (`:227`) | `` `${starter.slug}-${freshHash()}` `` — **new** (`:266`) |
| version | `currentVersion + 1` (`:224`) | `1` (`:267`) |
| 409 retry | none | **retries once** (`:284`) |
| Builder label | `` `Tweak · ${wf.slug} v${nextVersion}` `` | `` `From starter · ${starter.name}` `` |

The shipped comment at `:250–257` states the reason: `UNIQUE(slug, version)` is **GLOBAL across all
users**, so two people forking one shared starter cannot both mint `<slug> v(N+1)`.
`create_workflow_definition` forces `is_system_global=false / status='draft' / created_by=caller`
(`db/workflows.py:461`, `:477–478`), so the frozen starter row is never mutated. **Merging the handlers
would break the constraint. Keep both.**

**Is the provenance signal available on the client today?** Three independent routes, measured:

| Route | Available today? | Reliability |
|---|---|---|
| **Feed origin** (which array the row arrived in) | **Yes** — and it is *exact*, given `?scope=mine` (proved above) | Implicit; survives only while the query param does |
| `definition.category === "starter"` | **Yes, already on the wire.** `DefShape` has an index signature `[k: string]: unknown` (`soulData.ts:81`), the JSONB carries `"category": "starter"` (mig 094 `:68/:123/:178`), and the test fixture at `WorkflowsPage.test.tsx:142` literally sets it | Explicit but definition-derived |
| `is_system_global` on the row | **No** — arrives only with D-04 | Explicit and authoritative |

**Recommendation:** the merge assigns an explicit `provenance: "starter" | "published" | "draft"` field
on each normalized row **from feed origin**, and the card branches on that. D-04's `is_mine` /
`is_system_global` then act as a **cross-check**, asserted in a test to agree with the feed-derived
value. Consequence: **the frontend restructure wave does NOT have to wait for the backend wave.** The
only thing that genuinely needs `is_mine` is the *Yours* chip, and even that has a correct fallback
(`provenance !== "starter"`).

**Wave-structure flag for the planner:** do not serialize the frontend behind the backend. They are
independent, and `use_worktrees: true` makes parallel real. Add one integration task at the join that
asserts `is_mine === (provenance !== "starter")` over the merged list.

---

## The G-5 extraction (D-01) — how to move code without breaking it

### The RunModal move

**Extent: `:1054–1405` (352 lines).** Line `:1407` is `export default WorkflowsPage` and must not move.

**Everything it closes over** — a verbatim move fails on exactly the closure a reader does not notice.
`RunModal` is already a top-level function taking eight props, so it closes over **no page state**.
Its module-level dependencies are:

| Needs | From | Line |
|---|---|---|
| `useState`, `useEffect`, `useMemo`, `useRef` | `react` | `:28` |
| `Upload`, `Check`, `X` | `lucide-react` | `:29` |
| `cn` | `@/lib/utils` | `:30` |
| `entryInputKeys`, `DefShape` | `@/components/workflows/soulData` | `:58` |
| `useCanvasGate` | `@/pages/WorkflowBuilderPage` | `:53`, used at `:1083` |
| `PublishedWorkflow` (type) | `@/lib/api` | `:45` |
| `Folder` (type) | `@/types` | `:64` |

It also reads `def.phases[].config.folder_scope` (`:1111–1124`) — that is inside `DefShape`'s index
signature, no new type needed.

**ESM cycle risk: NONE, verified.** `library/RunModal.tsx` would import from `@/pages/WorkflowBuilderPage`
(for `useCanvasGate`), and `WorkflowBuilderPage.tsx` imports nothing from `WorkflowsPage` — every
reference in that file is prose in comments (`:112`, `:223`, `:474`, `:509`, `:557`, `:570`, `:1427`,
`:1462`). `BuilderHeaderBar.tsx:11` and `WorkflowDoorSwitch.tsx:25/:91` likewise mention it only in
comments. So `WorkflowsPage → library/RunModal → WorkflowBuilderPage` is a DAG.

**The constraint to hold, stated so a later phase inherits it:** nothing under
`components/workflows/library/` may import `@/pages/WorkflowsPage`, and `WorkflowBuilderPage.tsx` must
not import from `library/`. That is *not* a cycle today, and 188.1's lesson is that this kind of
constraint is enforced by a `?raw` fence in a test, not by prose — a cycle here typechecks clean, lints
clean and fails only at runtime. **Recommend porting 188.1's fence shape** (`WorkflowCanvas.test.tsx`,
which is pinned at 53 partly for this): assert the new modules' source contains no
`from "@/pages/WorkflowsPage"`, with a positive control that plants one and observes the assertion RED.

**A layering note worth stating rather than fixing:** `useCanvasGate` living in a *page* module and
being imported by a *component* is a smell the shipped page already has (`:53`). 192 should not fix it
— that widens scope — but the plan should note it so a reviewer does not read it as introduced here.

### The delete Sheet is NOT a self-contained block

CONTEXT.md's `:872–1003` is the JSX only. The move needs:

| Piece | Lines | Note |
|---|---|---|
| `type DeletePhase = "idle" \| "deleting" \| "deleted" \| "error"` | `:743` | module-level, currently above `PublishedCard` |
| `sheetOpen`, `preview`, `previewError`, `deletePhase` state + `descId` | `:768–772` | inside `PublishedCard` |
| `openDeleteSheet` | `:774–786` | calls `getWorkflowDeletePreview` |
| `handleDelete` | `:788–799` | calls `deleteWorkflowCascade`, then `onDeleted()` |
| The `<Sheet>` JSX | `:877–1003` | (comment from `:872`) |

Real extent ≈ **169 lines**, not 132. It also needs `getWorkflowDeletePreview`, `deleteWorkflowCascade`
and `WorkflowDeletePreview` from `@/lib/api` (`:43–44`, `:48`), the four `Sheet` primitives (`:37`) and
`Check`, `Loader2`, `AlertTriangle` from lucide (`:29`).

**Recommended boundary:** a single `WorkflowDeleteSheet` component that owns **both** the state and the
JSX, and exposes opening via a controlled `open`/`onOpenChange` pair **or** an imperative
`useWorkflowDelete(wf)` hook returning `{ openDeleteSheet, sheet }`. The new card's `⋯` menu then
renders one menu item wired to `openDeleteSheet` and drops `{sheet}` into its tree. Do **not** split
state into the card and JSX into the module — that is the version of this move that looks verbatim and
is not.

**The two graded-guard invariants that must survive the move** (146–148 rule; D-15 depends on them
still meaning something): the sheet **never dismisses mid-delete** (`:879–883`), and the card leaves
the list **only on server confirmation** — `onDeleted()` re-fetches, the list is never filtered locally
(`:593–596`, D-LOCK-04).

### Characterization baselines — capture BEFORE the move, and prove the capture predates it

The 188.1/188.2 lesson is binding: *a characterization baseline only proves something if it PREDATES
the change.* 188.2 proved this by confirming its five destination modules answered *"No such file or
directory"* at the capture commit.

**Recommended capture, in the plan's first commit, before one line moves:**

| Capture | How | Render states to cover |
|---|---|---|
| Whole-`innerHTML` of the RunModal dialog | `render(<WorkflowsPage …/>)` → click `published-run` → snapshot `getByTestId("run-modal").innerHTML` | (a) bound workflow with folders, (b) unbound workflow, (c) `folders=[]` (the `:1250` guard hides the scope select), (d) template staged, (e) `launchError` set, (f) `submitting` |
| Whole-`innerHTML` of the delete Sheet | open `published-delete` → snapshot `SheetContent.innerHTML` | (a) loading (`preview === null`), (b) loaded with `in_flight = 0`, (c) loaded with `in_flight > 0` (amber banner), (d) `deleting`, (e) `deleted`, (f) `error`, (g) `previewError` |
| `run-destination` copy under both canvas-gate values | `useCanvasGate` mocked true/false | the `:1369` branch |
| Focus/a11y contract | assert `role="dialog"`, `aria-modal`, initial focus on the textarea, Escape-to-close, Tab containment | `:1190–1229` |

**Proving the capture predates the move** — the mechanical form: the capture commit must be one in
which `frontend/src/components/workflows/library/` does not exist. State it as a runnable check in the
plan, e.g. `git show <capture-sha>:frontend/src/components/workflows/library/RunModal.tsx` must exit
non-zero. That is 188.2's exact method and it is auditable after the fact.

**Also capture before the rewrite** (these are *not* verbatim moves, so the baseline is a *reference*,
not a contract): the three card types' `innerHTML`. They will legitimately change — the value is having
the "before" in the commit history when a reviewer asks whether an atom was lost.

### The subtree delta — stated, not smoothed

188.2 measured a pure extraction **growing** its subtree **+67.1%** (797 → 1332 L across six files),
because every new module carries its own header, imports, props types and wrapper. D-01's split-by-
survival avoids paying that on the ~470 lines of card code 192 *deletes*, which is the whole point of
the decision.

**Honest expectation** (an ESTIMATE — the plan must MEASURE it, per the 188.2 rule that both figures
are stated rather than smoothed):

| | Before | After (est.) |
|---|---|---|
| `WorkflowsPage.tsx` | 1407 | 250–400 (composition) |
| `library/RunModal.tsx` | — | ~380 (352 moved + header/imports) |
| `library/WorkflowDeleteSheet.tsx` | — | ~200 (169 moved + header/imports) |
| `library/WorkflowCard.tsx` (new) | — | ~250 |
| `library/LibraryToolbar.tsx` + chips/search (new) | — | ~250 |
| `library/libraryFilter.ts` (merge + normalize + predicates, new) | — | ~150 |
| **Subtree total** | **1407** | **~1480–1630 (+5% to +16%)** |

Far below 188.2's +67% — because roughly a third of the "after" is *new capability*, not relocated
prose, and ~470 lines of card code are deleted outright. **The plan must record the measured
before/after in the SUMMARY**, and the card's own docblock should carry the figure so a later reader
cannot mistake growth for regression.

---

## ⚠ The test blast radius is SEVEN files, not one

`WorkflowsPage.test.tsx` is not the only suite that renders this page. Measured
(`grep -rn "WorkflowsPage" frontend/src`):

| Suite | Tests | Renders the LIVE page? | In count gate? |
|---|---|---|---|
| `src/pages/WorkflowsPage.test.tsx` | **23** | yes | ❌ **no** |
| `src/pages/__tests__/RunModal.test.tsx` | **11** | yes (`:162`) — drives the modal through the real page | ❌ **no** |
| `src/pages/__tests__/RunModal.a11y.test.tsx` | **8** | yes (`:117`, `:203`) | ❌ **no** |
| `src/pages/__tests__/PublishedCardDelete.test.tsx` | **7** | yes (`:107`) — opens the ⋯ menu off a real `PublishedCard` | ❌ **no** |
| `src/pages/WorkflowBuilderPage.header.test.tsx` | **32** | yes (`:192`, `:387`) + **imports `./WorkflowsPage?raw`** (`:119`) and asserts against its **source text** (`:842–843`) | ✅ TARGETS + BASELINE 32 |
| `src/pages/WorkflowBuilderPage.session.test.tsx` | **23** | yes (`:482`, `:510`, `:768`) | ❌ **no** |
| `src/components/layout/ChatLayout.launch.test.tsx` | 17 | **no** — `vi.mock`s it (`:136`) | ✅ BASELINE 17 |
| `src/components/layout/__tests__/ChatLayoutLaunch.test.tsx` | **2** | yes, via `ChatLayout` | ❌ **no** |

**Measured baseline, two runs:** `123 tests / 0 failures`. (First run reported 1 failure —
`WorkflowBuilderPage.session.test.tsx > "pane click …"` timed out at **5060 ms** against a 5000 ms
limit under `--maxWorkers=4`; it passed on re-run. **That suite is flaky under parallel load** and the
plan should expect it, not chase it.)

Command used:
```bash
cd frontend && GSD_VITEST_MAX_WORKERS=4 npx vitest run --maxWorkers=4 \
  src/pages/WorkflowsPage.test.tsx src/pages/__tests__/RunModal.test.tsx \
  src/pages/__tests__/RunModal.a11y.test.tsx src/pages/__tests__/PublishedCardDelete.test.tsx \
  src/pages/WorkflowBuilderPage.header.test.tsx src/pages/WorkflowBuilderPage.session.test.tsx \
  src/components/layout/ChatLayout.launch.test.tsx \
  src/components/layout/__tests__/ChatLayoutLaunch.test.tsx
```

### ⚠ THE eighth two-knob trap — and it is on this phase's own file

`scripts/vitest-count-gate.cjs` has two independent knobs, documented in its own comments seven times:
**`TARGETS` decides what RUNS; `BASELINE` decides what is PINNED; a file can be outside BOTH.**

- `TARGETS` covers `src/components/workflows` (directory) plus **five named `src/pages/` files**:
  `WorkflowBuilderPage.test.tsx`, `.canvas.test.tsx`, `.header.test.tsx`, `.describe.test.tsx`,
  `WorkflowRunPage.test.tsx`.
- `BASELINE` has **51 pinned files, total 2775**. Verified by grep of the pin map.

**`WorkflowsPage.test.tsx` appears in NEITHER.** Nor do the three `src/pages/__tests__/` suites, nor
`WorkflowBuilderPage.session.test.tsx`, nor `ChatLayoutLaunch.test.tsx`.

**Consequence, stated plainly: 74 of the 123 tests covering the surface this phase rewrites are
currently invisible to the count gate — 49 of them cover the library view directly. A plan that
deletes an `it()` block during the restructure leaves the gate green.** That is verbatim the
Phase-177 lesson the script exists for, and the round-5 "verification truth 14" failure Phase 187 had
to fix afterwards.

**Recommendation — this is Wave 0, task 1:** adopt four suites into `TARGETS` **and** `BASELINE`, at
numbers read from the script's own `actual` column across two agreeing runs (never hand-counted):
`WorkflowsPage.test.tsx` (23), `RunModal.test.tsx` (11), `RunModal.a11y.test.tsx` (8),
`PublishedCardDelete.test.tsx` (7). `src/pages/__tests__/` is covered by nothing today, so those three
need **file-level** `TARGETS` entries (not the bare directory — the directory holds other suites this
phase does not read; that is the reasoning the script records for `src/components/panel/__tests__`,
`src/lib`, `src/pages` and `src/components/layout`).

⚠ **Timing is not cosmetic:** a `TARGETS` entry pointing at a non-existent path makes the gate ERROR
(exit 2), not fail. All four files exist, so they can be adopted immediately — but any *new* suite this
phase creates must get its entry in the same commit that creates the file.

⚠ **Adopting imports no rot** — all four measured `0 failing` above.

⚠ **This phase will LOWER pins**, and the rule is explicit: *a pin is lowered only alongside a
deliberate, plan-authorized deletion, in the same commit — never to make a red gate go quiet.*
Deleting the shelf-order tests (below) is exactly such a deletion. Adopt at 23 in Wave 0, then lower to
the measured post-restructure number in the same commit as the deletions, reading the new number from
the `actual` column.

### Which `WorkflowsPage.test.tsx` tests break BY DESIGN vs must stay green

23 tests. Classified against the locked decisions:

| # | Test (`:line`) | Verdict |
|---|---|---|
| 1 | `'All projects' calls listPublishedWorkflows with no project filter` (`:166`) | **Must stay green** — D-05 changes the instrument, not the contract |
| 2 | `selecting a project re-queries … with that project_folder_id` (`:174`) | **Must stay green** (rewrite the *interaction* from a `FilterItem` click to a select change; the assertion is unchanged) |
| 3 | `latest-wins: a STALE earlier response never paints over the current selection` (`:187`) | **Must stay green** — load-bearing, `:149–154` records the live symptom |
| 4 | `the Published shelf renders ABOVE the Drafts shelf` (`:212`) | **Breaks by design** (D-02 deletes both shelves) → **delete + lower the pin** |
| 5 | `the dashed build-card is present in the drafts shelf and opens the two-door chooser` (`:224`) | **Contract changed** — the *build-card in the drafts shelf* half dies (D-02); the *opens the two-door chooser* half is the seam to Phase 193 and **must stay green**. Rewrite as "the toolbar create affordance opens the two-door chooser" |
| 6 | `NO draft card exposes a Run affordance; published cards DO` (`:237`) | **Contract survives, assertions change.** D-09 keeps the invariant (a draft gets `✎ Open`, never `▶ Run`) but the testids change and `draft-publish` disappears (D-10). **Rewrite, do not delete** — this is the only mechanical guard on "a DRAFT cannot be Run", a load-bearing contract from the file's own docblock (`:14`) |
| 7–8 | soul renders / derived tier chip (`:251`, `:265`) | **Must stay green** — `WorkflowSoul` is consumed unchanged |
| 9 | strictest emit policy order-independence (`:279`) | **Must stay green** |
| 10–14 | Run modal opens / enabled on empty / calls `onLaunch` / not routed through the door fork / double-tap guard (`:306`–`:374`) | **Must stay green** — RunModal moves verbatim; if any of these reds, the move was not verbatim |
| 15–17 | Tweak forks v(N+1), opens the fork, seeds the gauntlet id (`:394`–`:421`) | **Must stay green** — D-12 keeps `onTweak` intact; only the button that reaches it changes |
| 18 | `renders the Starters shelf with the curated card, its chip, and a Use-this-starter control` (`:434`) | **Breaks by design** (D-02, D-09) → rewrite as "a starter row renders with its provenance mark and the fork verb" |
| 19 | `onUseStarter forks a FRESH copy: new suffixed slug + v1` (`:446`) | **Must stay green** — D-12's whole point; only the click target changes |
| 20 | `section order is Starters → Published → Drafts` (`:460`) | **Breaks by design** → **delete + lower the pin** |
| 21–22 | Open-a-draft loads it in the Builder / build-card opens a TRUE fresh build (`:476`, `:488`) | **Must stay green** (the second needs the new create affordance as its click target) |
| 23 | `← Workflows back button refetches drafts + published` (`:499`) | **Must stay green** |

**Two deletions (4, 20), four rewrites (2, 5, 6, 18), seventeen that must stay green.** That
distinction is the difference between a real regression and a plan task, and it should appear in the
plan verbatim.

### Fixture pattern — and how a test creates 200 workflows

**There is no factory and no MSW** (`grep "msw\|@faker" frontend/package.json` → nothing). The shipped
idiom is `vi.hoisted` + `vi.mock("@/lib/api")` with **hand-written literal rows**
(`WorkflowsPage.test.tsx:21–57`, four fixtures at `:75–152`). `SettingsPage.test.tsx:14` records that
it *"mirrors the WorkflowsPage.test.tsx api-mock idiom"* — so this is the house pattern.

**Recommendation:** write a small `makePublishedRow(i, overrides)` / `makeDraftRow(i, overrides)`
factory **inside the test file** (not a shared fixtures module — nothing else needs it, and a shared
one becomes this phase's rot to own). Generate 200 with `Array.from({length: 200}, …)`, varying
`business_requirement`, `citation_policy`, `phase_type` and `project_folder_id` so the six chips and
the search have real spread. **The 045 real-scale lesson binds: judge density at 200, never at 12.**

---

## Runtime State Inventory

Not a rename/refactor/migration phase in the state-carrying sense — but the D-01 extraction moves code
and the D-04 change alters a wire shape, so the categories are answered explicitly rather than skipped.

| Category | Items found | Action required |
|---|---|---|
| Stored data | **None.** No column added, no row rewritten. `created_by` / `is_system_global` already exist on `workflow_definitions` and are already used in every `WHERE` in `db/workflows.py`. Verified: `grep -n "is_system_global" backend/app/db/workflows.py` → 19 hits, all predicates or docs. | none |
| Live service config | **None.** No n8n / Datadog / Tailscale / Cloudflare surface touched. | none |
| OS-registered state | **None.** | none |
| Secrets / env vars | **None.** D-04 adds no env var; `scripts/check-deploy-drift.sh` is not triggered (verified against its documented scope: env vars the app reads, seed-bearing migrations, bundled services, sandbox image tag). | none |
| Build artifacts | **None** on the backend. On the frontend, `tsconfig.app.tsbuildinfo` is incremental state under `node_modules/.tmp/` — irrelevant to `--noEmit` runs. | none |
| **Test-harness state (the one that matters)** | `scripts/vitest-count-gate.cjs` `TARGETS` + `BASELINE` — a *committed artifact* that will be stale the moment this phase deletes an `it()` block. `BASELINE_TOTAL` is derived (`:989`, currently 2775 across 51 files). | **Wave 0 adoption + same-commit pin lowering** — see above |
| **Cross-phase test coupling** | `WorkflowBuilderPage.header.test.tsx:303` holds a **byte-exact `innerHTML`** of the Builder breadcrumb band including `NetNewFlag`'s full `title=` and class list; `:842–843` holds a **byte-exact source string** `"export function WorkflowsPage({ folders, onLaunch }: WorkflowsPageProps) {"` used as a positive-control plant target | **Do not change the `WorkflowsPage` export signature line**, and do not delete `NetNewFlag`. If either is unavoidable, the plan must update that suite in the same commit. |

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Highlighting the search hit | A regex → `innerHTML` replace | `HighlightTitle` (`lib/threadGroups.tsx:137`) | Its docblock (`:8–10`) records that the sketch's `innerHTML` highlight was **deliberately not ported** — it is an XSS vector on user-controlled text. `business_requirement` is user-authored. This is the *same* rule `WorkflowSoul` holds. |
| Strictness tier for the 🔒 Strict chip | A `citation_policy === "strict"` check | `tierForDefinition` (`soulData.ts:111`) | It takes the **strictest** policy across multiple emit phases deterministically (`stricterPolicy`, WR-03) and unions validator kinds. A naive check is order-dependent and already has a regression test (`WorkflowsPage.test.tsx:279`). |
| "Makes a file" chip | `phases.some(p => p.type === "llm_emit")` inline | `soulDeliverable` (`soulData.ts:161`) | Returns the honest `{kind:"chat"}` fallback and a non-fabricated label. Duplicating the predicate is exactly the drift `soulData.ts`'s docblock forbids. |
| The delete confirm | A new dialog | The moved 064-B `Sheet` | Victim-naming with **exact server counts**, amber cancel-first banner, no optimistic vanish, audit receipt. Rebuilding it loses the graded-guard vocabulary `D-15` depends on. |
| The `⋯` overflow | A custom popover | `ui/dropdown-menu` — already the host at `:821` | Shipped pattern; free keyboard + focus. |
| Modal focus trap for RunModal | Anything | The moved `:1190–1229` block | It is a deliberate minimal trap ("no heavy dep / no shadcn Dialog rewrite"). Replacing it during a "verbatim move" is not a verbatim move. |
| A searchable combobox | `cmdk` | Native `<select>` (two shipped precedents) | Adding `cmdk` puts a command-palette dependency in the tree that 158-B's deferral was costed against. |

**Key insight:** every "derive a chip" problem in this phase has a shipped, tested, single-source
helper. The chips are *composition over `soulData` + `deriveTier`*, not new logic. Any plan task that
writes a new predicate over `definition` should be challenged.

---

## Architecture Patterns

### System architecture — the merged library

```
                       ┌──────────────────────────────────────────────┐
  ChatLayout ──────────► WorkflowsPage  (pageView: "library"|"builder")│
    folders, onLaunch  │  ── owns: fetches, merge, filter state ──     │
                       └───────┬──────────────────────────────┬───────┘
                               │ pageView==="builder"         │ pageView==="library"
                               ▼                              ▼
                    WorkflowDoorSwitch          ┌────────────────────────────┐
                    (unchanged, 193's door)     │  LibraryToolbar             │
                                                │  ＋Create · 🔎search ·      │
                                                │  6 chips · project <select> │
                                                └────────────┬───────────────┘
   GET /workflows/published?scope=mine ─┐                    │ query, chips, projectId
   GET /workflows/starters ─────────────┼─► allSettled       ▼
   GET /workflows/drafts   ─────────────┘   ──► normalize ──► libraryFilter (PURE)
        (gated — must not          │             + provenance      │  search: name+purpose
         gate the other two)       │             + dedupe by id    │  chips: soulData/deriveTier
                                   ▼                               ▼
                            latest-wins refs ──────────► one flat list of <WorkflowCard>
                                                                   │
                                            ┌──────────────────────┼──────────────────────┐
                                            ▼                      ▼                      ▼
                                   WorkflowSoul(card)      primary verb          ⋯ overflow
                                   (UNCHANGED)          ▶Run | ✎Open      fork verb + Delete…
                                                             │                     │       │
                                                             ▼                     ▼       ▼
                                                        RunModal          onTweak/onUseStarter
                                                     (moved verbatim)      WorkflowDeleteSheet
                                                             │              (moved verbatim)
                                                             ▼
                                                   onLaunch (ChatLayout.doRun)
```

The load-bearing shapes: the **three feeds settle independently**; the **filter is a pure function** of
(rows, query, chips, projectId) so it is unit-testable with zero rendering; and the **two moved modules
sit at the leaves** so nothing imports back up.

### Recommended structure

```
frontend/src/components/workflows/library/     # created by this phase
├── RunModal.tsx                  # VERBATIM move of :1054–1405
├── WorkflowDeleteSheet.tsx       # VERBATIM move of :743 + :768–799 + :877–1003
├── WorkflowCard.tsx              # NEW — 159-C, one verb + ⋯, consumes WorkflowSoul
├── LibraryToolbar.tsx            # NEW — create · search · chips · project select
├── libraryFilter.ts              # NEW — PURE: normalize, merge+dedupe, predicates, counts
└── libraryVocabulary.ts          # NEW — chip labels + the one consequence sentence, in ONE place
```

**Why `libraryVocabulary.ts` is worth its own file:** D-03 re-homes three shelf names into
plain-language chip labels and D-13 spends exactly one consequence sentence. This project has a shipped
precedent for putting user-facing word-choices in a single module with word-class fences over it
(`phaseVocabulary.ts`, `governanceVocabulary.ts`, `runVocabulary.ts`, `verdictModel.ts` — all four are
pinned in the count gate). D-08's "no copy may imply semantic search" is a **word-class rule**, and a
word-class rule is only mechanically enforceable if the words live in one place.

### Pattern: normalize to one row type before filtering

`PublishedWorkflow` and `WorkflowDraftRow` are **different types** — measured:

```ts
// api.ts:1349
interface PublishedWorkflow { id: string; slug: string; name: string; definition?: WorkflowDefinitionJSON | null }
// api.ts:3311
interface WorkflowDraftRow  { id: string; slug: string; version: number; name: string | null
                              definition?: WorkflowDefinitionJSON | null; token: string }
```
Published has **no `version`** (it comes from `definition.version`, read at `:762`); draft `name` is
**nullable** (the card falls back to `slug` at `:706`); draft carries a **`token`** that `onOpenDraft`
must pass through (`:304`) — and `WorkflowBuilderPage.session.test.tsx:750` exists specifically because
dropping `token` from a hand-built object ships a *silent clobber*, not a type error.

```ts
// library/libraryFilter.ts — the normalized view-model
export type Provenance = "starter" | "published" | "draft"

export interface LibraryRow {
  id: string
  slug: string
  name: string                    // draft null → slug (mirrors :706)
  version: number | undefined     // published → definition.version; draft → row.version
  def: DefShape | undefined
  provenance: Provenance
  // KEEP THE ORIGINAL. onOpenDraft needs `token`; onLaunch needs the real PublishedWorkflow.
  // A hand-rebuilt object that forgets a field is the D-186-07 silent-clobber shape.
  source: PublishedWorkflow | WorkflowDraftRow
}
```

### Anti-patterns to avoid

- **`Promise.all` across the three feeds.** A gated `/drafts` 403 must not empty the library — that
  re-introduces the gate the RUN CARVE-OUT forbids. Use `allSettled`.
- **Dedupe by `slug`.** Swallows a user's own v(N+1) fork. Dedupe by `id`.
- **Collapsing the three latest-wins refs into one.** Only `published` re-queries on project change.
- **Rebuilding the row object for a handler.** Carry `source`.
- **Introducing routing or URL params.** The page has no router by design (`:320`); URL-addressable
  filter state is explicitly deferred.
- **A `title=` anywhere in new code.** D-14. Make it a negative source fence.
- **Deleting `NetNewFlag`.** See the landmine section.

---

## Common Pitfalls

### Pitfall 1: the "verbatim move" that is not
**What goes wrong:** the delete Sheet moves as `:872–1003` and the five `useState`s stay behind.
**Why:** the block reads self-contained; the closure lives 100 lines above it inside a component being
deleted.
**Avoid:** move `:743` + `:768–799` + `:877–1003` as one unit; assert the pre-captured `innerHTML`
baselines across all seven sheet states with **zero re-capture**.
**Warning sign:** any need to "adjust" a captured baseline. 188.2's proof was *zero* re-capture.

### Pitfall 2: the count gate reports green on a deleted test
**What goes wrong:** the restructure drops an `it()`; `numFailedTests` is 0; the gate passes.
**Why:** four of the covering suites are in neither `TARGETS` nor `BASELINE`.
**Avoid:** Wave 0 adoption before any source change.
**Warning sign:** a plan whose first source commit precedes its gate commit.

### Pitfall 3: the gated drafts feed empties the library
**What goes wrong:** a user without `workflow_authoring` visibility 403s on `/workflows/drafts`; a
`Promise.all` rejects; the merged list renders empty; Run is unreachable.
**Why:** `/drafts` is gated (`workflows.py:1012`) while `/published` and `/starters` are the
carve-out.
**Avoid:** `allSettled`, per-source failure isolation, and a test that stubs `listDraftWorkflows` to
reject and asserts published + starter rows still render.
**Warning sign:** one shared `error` state for the whole page.

### Pitfall 4: chip counts describe rows the user cannot see
**What goes wrong:** the project select fires a server re-query; counts are recomputed against the
not-yet-arrived set, or zeroed.
**Avoid:** count over rendered rows only; never zero during load.
**Warning sign:** a chip reading `0` while its rows are visibly on screen, or vice versa.

### Pitfall 5: `NetNewFlag` deletion reds a pinned suite
See § "The NetNewFlag landmine". **Warning sign:** `WorkflowBuilderPage.header.test.tsx` failing at
`:303` with an `innerHTML` mismatch during a phase that never opened the Builder.

### Pitfall 6: the fork branch picks the wrong handler
**What goes wrong:** one card, one verb, and a merge that lost provenance → a starter fork mints
`<same-slug> v2`, colliding on the **global** `UNIQUE(slug, version)` for the second user who tries it.
**Why:** the constraint is global; the shipped comment at `:250–257` says so.
**Avoid:** assign `provenance` at merge time; assert in a test that a `starter`-provenance row routes
to `createWorkflowDraft` with a `<slug>-[a-z0-9]{6}` slug and `version: 1`, and a `published`-provenance
row routes to same-slug `version: N+1`. **Both assertions already exist** (`WorkflowsPage.test.tsx:394`,
`:446`) — keep them green through the rewrite.
**Warning sign:** a single `onFork` function.

### Pitfall 7: `WorkflowBuilderPage.session.test.tsx` flakes under parallel load
**Measured:** the "pane click" case timed out at 5060 ms against a 5000 ms limit at
`--maxWorkers=4`, and passed on re-run. **Avoid** chasing it as a regression; **do** re-run before
declaring red, and always set `GSD_VITEST_MAX_WORKERS=4` in worktree runs (CLAUDE.md rule 2).

### Pitfall 8: `noUnusedLocals` turns a partial removal into a build break
`tsconfig.app.json` sets `noUnusedLocals` **and** `noUnusedParameters`. Removing the last render of a
helper (e.g. `FilterItem`) without removing the function is a **type error**, not a lint warning.
Remove function and last usage in the same commit.

---

## Code Examples

### The merge, with the three risks handled (D-16)
```ts
// library/libraryFilter.ts — pure; imports NOTHING from the API client
export function mergeLibrary(
  published: PublishedWorkflow[],
  starters: PublishedWorkflow[],
  drafts: WorkflowDraftRow[],
): LibraryRow[] {
  const byId = new Map<string, LibraryRow>()
  // Order matters only for which duplicate wins; `id` collisions are proven impossible
  // under ?scope=mine (mig 094 seeds starters as created_by = the seed system user),
  // but the Map is the guard that survives a future change to that query param.
  for (const r of starters)  byId.set(r.id, fromPublished(r, "starter"))
  for (const r of published) byId.set(r.id, fromPublished(r, "published"))
  for (const r of drafts)    byId.set(r.id, fromDraft(r))
  return [...byId.values()]
}
```
```tsx
// WorkflowsPage.tsx — allSettled so a GATED /drafts 403 cannot empty the carve-out feeds
const [pub, star, drf] = await Promise.allSettled([
  listPublishedWorkflows(projectArg, undefined, { scope: "mine" }),  // ungated (workflows.py:175)
  listStarterWorkflows(),                                            // ungated (workflows.py:223)
  listDraftWorkflows(),                                              // GATED   (workflows.py:1012)
])
// Each source commits independently behind its OWN latest-wins ticket (:155-157).
```

### The consequence sentence as an a11y contract (D-13 / D-14)
```tsx
// library/WorkflowCard.tsx — real DOM text, never title=. Touch has no hover.
const forkDescId = `wf-fork-${row.id}`
<DropdownMenuItem onClick={onFork} aria-describedby={forkDescId}>
  {FORK_VERB}
</DropdownMenuItem>
<p id={forkDescId} className="…">{FORK_CONSEQUENCE}</p>
```
```ts
// library/libraryVocabulary.ts — ONE home, so the word-class fences have something to bind to.
// D-13: name BOTH halves — what you get AND what stays true. Naming only the first half
// reproduces the exact surprise LIB-03 exists to end.
export const FORK_CONSEQUENCE =
  "Opens a new private copy you can edit. The published version stays live and unchanged."
```

### The XSS-safe highlight (D-07) — reuse, do not re-implement
```tsx
import { HighlightTitle } from "@/lib/threadGroups"   // :137 — zero edits to that file
<h3><HighlightTitle title={row.name} query={query} /></h3>
<p><HighlightTitle title={row.def?.business_requirement ?? ""} query={query} /></p>
```

### The backend field (D-04)
```python
# backend/app/db/workflows.py — both branches of list_published_workflows (:275-289)
"SELECT id, slug, name, definition, created_by, is_system_global FROM workflow_definitions "
"WHERE status = 'published' AND created_by = $1"
# …and list_starter_workflows (:318)
```
```python
# backend/app/api/workflows.py — computed server-side; never a raw created_by on the wire
caller = UUID(user_id) if isinstance(user_id, str) else user_id
PublishedWorkflow(
    id=r["id"], slug=r["slug"], name=r["name"],
    definition=_coerce_definition(r.get("definition")),
    is_mine=(r.get("created_by") == caller),
    is_system_global=bool(r.get("is_system_global")),
)
```

---

## State of the Art

| Old approach (shipped) | New approach (192) | Why it changed |
|---|---|---|
| Three shelves as *places* (`:544/:568/:604`) | One list, shelves become chips | 155-C rule: *a category that is a chip survives a fourth category; a category that is a place needs a fourth shelf* |
| Create as the first cell of the third grid (`:613`) | Create leads the toolbar | SC#4 fixed structurally, so it cannot drift back down a grid |
| 200px rail of `FilterItem` (`:520–538`) | One toolbar select | "One home per concern" red line; returns 200px of grid width at 200 workflows |
| Explanations in `title=` (6 instances) | `aria-describedby` real DOM text | Phase 185's rule; **touch has no hover** |
| Seven verbs across three card types | Three verbs, one vocabulary | LIB-03 |
| `Publish…` that does not publish (`:731`) | Removed | It is a button that lies (D-10) |
| `GET /workflows/published` as user-facing copy (`:491`, `:577`) | Plain language | D-11 |
| The D14 honesty banner (`:489–493`) | **Removed** — its claim is measurably false at HEAD | § "D-11 plan-time check" |

**Deprecated / outdated after this phase:** `FilterItem` (`:675`), `DraftCard` (`:693`),
`PublishedCard` (`:745`), `StarterCard` (`:1014`), the two library `NetNewFlag` renders, and the
`WorkflowsPage.test.tsx` shelf-order tests (`:212`, `:460`).

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node + npm | frontend build/test | ✓ | vitest **4.1.0** (from run output) | — |
| TypeScript | `tsc -p tsconfig.app.json --noEmit` | ✓ | runs, 33 pre-existing errors | — |
| ESLint + `eslint.a11y.config.js` | `npm run lint`, `npm run lint:a11y` | ✓ | both run clean on the target files | — |
| `scripts/vitest-count-gate.cjs` | count gate | ✓ | 51 pinned files, `BASELINE_TOTAL` 2775 | — |
| `scripts/bootstrap-worktree.sh` | worktree parallelism | ✓ | referenced by `.planning/config.json` `worktree_bootstrap` | — |
| Local Supabase | backend integration tests only | not probed | — | Frontend work needs none; the backend change is unit-testable against the SQL string + Pydantic model |
| Chrome MCP | G-4 lived-experience UAT | assumed available | — | ⚠ `take_screenshot` **times out repeatedly** — read DOM geometry via `evaluate_script` |
| `cmdk` | — | ✗ (deliberately) | — | Not needed; native `<select>` |

**Missing with no fallback:** none.

---

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | **vitest 4.1.0** + `@testing-library/react`, jsdom |
| Config file | `frontend/vite.config.ts` (`test:` block — `environment: "jsdom"`, `setupFiles: ["./src/setupTests.ts"]`, `globals: true`, excludes `tests/e2e/**`) |
| Quick run command | `cd frontend && GSD_VITEST_MAX_WORKERS=4 npx vitest run --maxWorkers=4 <files>` |
| Full suite command | `node scripts/vitest-count-gate.cjs` (runs `TARGETS` under vitest, then gates counts) |
| Typecheck command | `cd frontend && npx tsc -p tsconfig.app.json --noEmit` |
| Lint commands | `cd frontend && npx eslint <paths>` · a11y: `npx eslint <paths> -c eslint.a11y.config.js` |

⚠ **`tsc --noEmit` alone checks ZERO files here.** The root `tsconfig.json` is a solution file; the
real project is `tsconfig.app.json`. A plan that writes `npx tsc --noEmit` has written a no-op gate.

⚠ **`npm run build` runs `tsc -b && vite build`** — `-b` is *not* the same as `-p … --noEmit` (the
recorded v3.3 lesson). Use `-p tsconfig.app.json --noEmit` for a typecheck gate.

### Measured baselines at `HEAD = a0795512` — the sticks everything is measured against

| Measurement | Value | Command |
|---|---|---|
| Typecheck errors (whole app) | **33** | `npx tsc -p tsconfig.app.json --noEmit 2>&1 \| grep -c "error TS"` |
| Lint on `WorkflowsPage.tsx` + its test | **0** | `npx eslint src/pages/WorkflowsPage.tsx src/pages/WorkflowsPage.test.tsx` |
| a11y-lint on `WorkflowsPage.tsx` | **0** | `npx eslint src/pages/WorkflowsPage.tsx -c eslint.a11y.config.js` |
| Lint on `src/pages` (whole dir) | 21 errors (pre-existing, other files) | `npx eslint src/pages` |
| The 8 affected suites | **123 tests / 0 failed** | see § "The test blast radius" |
| Count gate | 51 pinned files, `BASELINE_TOTAL` = **2775** | `grep -n "BASELINE_TOTAL = " scripts/vitest-count-gate.cjs` |

Any regression above these is introduced by this phase. Both zeros are load-bearing: **any new lint or
a11y-lint error in the phase's files is the phase's**.

### ⚠ Does the count gate protect `WorkflowsPage.test.tsx`? **NO.**

Stated here because the question was asked explicitly and the answer determines Wave 0.
`src/pages/WorkflowsPage.test.tsx` appears in **neither** `TARGETS` **nor** `BASELINE`. Nor do
`src/pages/__tests__/RunModal.test.tsx`, `RunModal.a11y.test.tsx`, `PublishedCardDelete.test.tsx`,
`WorkflowBuilderPage.session.test.tsx`, or `ChatLayoutLaunch.test.tsx`. `src/pages/` is reached only by
five *named files*; `src/pages/__tests__/` is reached by nothing at all. **74 of the 123 covering tests
are invisible to the gate.** This is the eighth recorded occurrence of the two-knob trap.

### Phase Requirements → Test Map

| Req | Behavior | Type | Automated command | Exists? |
|---|---|---|---|---|
| LIB-01 | Typing part of a name filters the list | unit | `npx vitest run src/pages/WorkflowsPage.test.tsx -t "search by name"` | ❌ Wave 2 |
| LIB-01 | Typing a word only in `business_requirement` finds the row (D-07) | unit | same file, `-t "search matches the purpose sentence"` | ❌ Wave 2 |
| LIB-01 | A paraphrase returns 0 and no copy implies otherwise (D-08) | unit + **source fence** | `-t "substring, not meaning"` | ❌ Wave 2 |
| LIB-01 | Each chip's count equals the rendered row count under the live query (D-03) | unit (pure) | `npx vitest run src/components/workflows/library/libraryFilter.test.ts` | ❌ Wave 1 |
| LIB-01 | The merge dedupes by `id` when both feeds return the same row (D-16) | unit (pure) | same file, `-t "dedupe"` | ❌ Wave 1 |
| LIB-01 | A rejected `/drafts` fetch still renders published + starter rows (carve-out) | unit | `WorkflowsPage.test.tsx -t "gated drafts feed"` | ❌ Wave 2 |
| LIB-01 | Project select re-queries with `project_folder_id` | unit | `WorkflowsPage.test.tsx:174` (**rewrite interaction, keep assertion**) | ✅ exists |
| LIB-01 | Latest-wins: a stale response never paints over the selection | unit | `WorkflowsPage.test.tsx:187` | ✅ **must stay green** |
| LIB-02 | Every row renders `WorkflowSoul` with all five atoms | unit | `WorkflowsPage.test.tsx:251`, `:265` | ✅ **must stay green** |
| LIB-02 | No developer string (`GET /workflows/...`) in user-visible DOM (D-11) | **negative fence** | `-t "no endpoint string in the DOM"` | ❌ Wave 2 |
| LIB-03 | A draft row never exposes Run; a runnable row does | unit | `WorkflowsPage.test.tsx:237` (**rewrite testids, keep contract**) | ⚠ rewrite |
| LIB-03 | `Publish…` is gone (D-10) | **negative fence** | `-t "no Publish button"` | ❌ Wave 2 |
| LIB-03 | Fork on a **starter** row → new suffixed slug + v1 | unit | `WorkflowsPage.test.tsx:446` | ✅ **must stay green** |
| LIB-03 | Fork on a **published** row → same slug + v(N+1) | unit | `WorkflowsPage.test.tsx:394` | ✅ **must stay green** |
| LIB-03 | The consequence sentence is wired by `aria-describedby` and names BOTH halves (D-13/D-14) | unit + word-class | `-t "fork consequence"` | ❌ Wave 2 |
| LIB-03 | **Zero `title=` in the new library subtree** (D-14) | **negative source fence** | `?raw` over `library/*` | ❌ Wave 2 |
| LIB-03 | No confirm sheet on the fork (D-15) | absence + positive control | `-t "fork opens no dialog"` | ❌ Wave 2 |
| LIB-04 | The create affordance precedes every row in DOM order | unit | `compareDocumentPosition` | ❌ Wave 2 |
| D-01 | RunModal renders byte-identically after the move, 6 states | **characterization** | pre-captured `innerHTML` | ❌ **Wave 0** |
| D-01 | Delete Sheet renders byte-identically after the move, 7 states | **characterization** | pre-captured `innerHTML` | ❌ **Wave 0** |
| D-01 | No module under `library/` imports `@/pages/WorkflowsPage` | **source fence** + positive control | `?raw` | ❌ Wave 1 |
| D-01 | `lib/threadGroups.tsx` is byte-unchanged by this phase (158-B trigger #3) | **source fence** | `?raw` hash | ❌ Wave 1 |
| D-04 | `/published` and `/starters` both return `is_mine` + `is_system_global` | backend unit | `pytest backend/tests/unit -k published_workflows` | ❌ Wave 1 |
| D-04 | No raw `created_by` UUID appears on the wire | **negative fence** | assert the serialized dict's keys | ❌ Wave 1 |
| D-04 | `is_mine` agrees with feed-derived provenance | integration | frontend, merged list | ❌ Wave 3 |

### The negative fences — and how to prove each one FIRES

188.2's binding lesson: **a negative fence must be driven RED against a real plant before it is
trusted.** Five fences, each with its named plant:

| # | Fence | Plant that must turn it RED | Restore |
|---|---|---|---|
| **F1** | No `title=` attribute anywhere in `components/workflows/library/**` (`?raw` over every module) | Add `title="x"` to one button in `WorkflowCard.tsx` | file md5-identical after |
| **F2** | The rendered library view contains no node whose text matches `/GET \/workflows\//` | Re-insert the `:577` chip text into the toolbar | — |
| **F3** | No element with text `/^Publish…?$/` renders on any row (D-10) | Add a `Publish…` button to the draft branch | — |
| **F4** | No module under `library/` contains `from "@/pages/WorkflowsPage"` (ESM cycle) | Add that import to `RunModal.tsx` — note it **typechecks and lints clean**, which is why the fence must exist | — |
| **F5** | No copy in `libraryVocabulary.ts` contains a meaning-search word (`semantic`, `meaning`, `similar`, `AI-powered`, `smart`, `understands`, `natural language`) (D-08) | Set the placeholder to `"Search by meaning…"` | — |

Each plant must be observed RED **in production source**, then the file restored byte-identically —
and the SUMMARY records the md5 before/after, the way 190-16 did for its seven absence assertions.

**One positive control is also required**, per the 187 lesson that an absence assertion with no
positive control proves nothing: F3's selector must be shown to actually *find* a `Publish…` button
when one exists.

### Sampling rate

- **Per task commit:** `npx tsc -p tsconfig.app.json --noEmit` (must stay at **33**) +
  `npx eslint <files touched>` (must stay at **0** for this phase's files) +
  `GSD_VITEST_MAX_WORKERS=4 npx vitest run --maxWorkers=4 <the suites the task touches>`
- **Per wave merge:** `node scripts/vitest-count-gate.cjs` — must be **green**, and any lowering
  must ride in the same commit as its authorized deletion.
- **Phase gate:** full count gate green + `npx eslint src -c eslint.a11y.config.js` on the new
  subtree + the G-4 UAT rows below, before `/gsd:verify-work`.

### Wave 0 gaps

- [ ] **Adopt four suites into `TARGETS` + `BASELINE`** at numbers read from the gate's own `actual`
      column across two agreeing runs: `WorkflowsPage.test.tsx` (measured 23),
      `RunModal.test.tsx` (11), `RunModal.a11y.test.tsx` (8), `PublishedCardDelete.test.tsx` (7).
      `src/pages/__tests__/` needs three **file-level** `TARGETS` entries; the directory is covered by
      nothing. *(This must be the first commit of the phase — before any source change, so every later
      commit is measured against a stick that already existed.)*
- [ ] **Capture the RunModal characterization baseline** (6 render states) — in a commit where
      `library/RunModal.tsx` provably does not exist.
- [ ] **Capture the delete-Sheet characterization baseline** (7 render states) — same rule.
- [ ] **Decide + record** whether `WorkflowBuilderPage.session.test.tsx` (23) and
      `ChatLayoutLaunch.test.tsx` (2) are adopted too. *Recommendation: adopt `session` (it renders the
      live page three times and is currently unguarded), decline `ChatLayoutLaunch` (2 tests, owned by
      the layout concern) — and state the reason either way, per the script's own adoption rule.*
- [ ] No framework install needed.

### ⚠ The cross-provider roster does NOT apply to this phase — stated, not omitted

CLAUDE.md § "UAT scoreboard recipe" requires the **full native roster (7) + OpenRouter** for any phase
touching **streaming, the agent loop, provider routing, or UI state** in that sense. **Phase 192
touches none of them.** Verified: `WorkflowsPage.tsx` imports no provider symbol, reads no model
registry, and opens no SSE stream; the only backend change is two projected columns on two read
endpoints. The launch path (`onLaunch` → `ChatLayout.doRun`) is **unchanged** by this phase and is
already covered by `ChatLayout.launch.test.tsx` (pinned at 17).

**Therefore the 8-row cross-provider scoreboard is NOT triggered, and VALIDATION.md must say so in
those words rather than silently omitting the table.** A scoreboard that lists only what passed is not
a scoreboard; a phase that omits a required table without stating why is indistinguishable from one
that forgot.

### G-4 lived-experience UAT (fires — this phase touches user-visible UI)

**All rows judged at 200 workflows, never at 12** (the 045 real-scale lesson; all three sketches ship
a 12/54/200 selector for exactly this reason). Chrome MCP constraints, recorded and binding:
`take_screenshot` **times out repeatedly** → read DOM geometry via `evaluate_script`; `computer` CLICKS
can deliver **zero events** while `hover` / `left_click_drag` work; `elementFromPoint` is
machine-checkable reachability.

| # | "I'd recognise failure here" scenario | Driven how | Pass bar |
|---|---|---|---|
| **U1** | At 200 workflows, find one named workflow by typing three characters | `evaluate_script` types into the search input, then counts rendered rows | The target row is visible **without scrolling**; `elementFromPoint` on its centre returns a node inside that row |
| **U2** | Narrow with two chips at once and read the counts | click chips, read chip label text + `querySelectorAll` row count | Every chip's number **equals** the rows it produces; no chip promises results it cannot deliver |
| **U3** | The create affordance is reachable with **zero scroll** (SC#4) | measure `getBoundingClientRect().top` of the create control vs viewport at 200 rows | `top < window.innerHeight` at first paint, and it is the **first** interactive element in DOM order |
| **U4** | The fork verb's consequence is readable **without hover** (D-14) | `document.querySelectorAll('[title]')` inside the library subtree; then read the `aria-describedby` target's `textContent` | `title` count = **0**; the described text is present, non-empty, and names **both** halves (new private copy **and** published stays live) |
| **U5** | `Tweak` no longer surprises (SC#3 / LIB-03) — operator reads the card and states what the verb will do *before* clicking | manual, operator | The stated expectation matches what happens |
| **U6** | Pick a project → what happens to starters is **explained, not silent** | click the project select, read the toolbar | Either starters remain with a stated reason, or they are absent with a stated reason. **Silence is a fail.** |
| **U7** | A paraphrase returns zero and the page does not pretend otherwise (D-08) | type *"the thing that checks vendors"* | 0 results, honest empty state, one-click *Clear search & filters*, **no copy implying meaning-search** |
| **U8** | The delete Sheet still names exact counts and refuses to dismiss mid-delete (the moved code) | open ⋯ → Delete workflow… | Exact server counts render; `Escape` during `deleting` does **not** close |
| **U9** | Run still launches (the moved RunModal) | open Run → confirm | Lands on the run surface (canvas flag on) or a new chat thread (flag off) — matching the `run-destination` copy shown |
| **U10** | Touch, no hover (the actual experience for a large share of users) | emulate touch, re-read every action | Every explanation still legible |

**U6 exists because of the measured defect** in § "The unnamed IA defect". It is the row most likely to
fail, and it is the one no structural test can catch.

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | Radix `Select` has no built-in filter/search, so a native `<select>` is the right instrument for D-05 | Standard Stack | LOW — if a filtered combobox is wanted, it is buildable; the recommendation is about cost, and the alternative is stated. `[ASSUMED]` on the Radix capability (read from the local wrapper, not from Radix docs); `[VERIFIED]` that no `cmdk` exists and that two shipped pickers use native `<select>` |
| A2 | The estimated post-refactor subtree size (~1480–1630 L, +5% to +16%) | The subtree delta | LOW — explicitly labelled an estimate; the plan must MEASURE and record the real figure |
| A3 | Importing `HighlightTitle` does not fire 158-B re-open trigger #3 | § "Does importing…" | MEDIUM — the trigger's wording is ambiguous. Mitigated by the recommendation to add a byte-unchanged fence, which makes the claim mechanically checkable rather than a judgment |
| A4 | The `is_mine` recommendation over raw `created_by` | D-04 | LOW — strictly less disclosure; the only cost is that a future feature wanting an author *name* would need a second change. Stated so the tradeoff is visible |
| A5 | Chrome MCP is available and behaves as recorded (`take_screenshot` times out) | Environment | LOW — the fallback (`evaluate_script` DOM geometry) is what the UAT rows already prescribe |
| A6 | `WorkflowBuilderPage.session.test.tsx`'s "pane click" timeout is a parallel-load flake, not latent rot | Pitfall 7 | MEDIUM — measured twice (fail at `--maxWorkers=4` in a mixed run, pass in a second run of the same set). If it reds consistently during the phase, it is not this phase's |
| A7 | The recommended project-filter semantics (published+drafts filtered, starters held out with a stated reason) | The unnamed IA defect | MEDIUM — this is a genuine design call the sketches did not resolve. The *facts* are verified; the *recommendation* is a judgment and should be confirmed at plan time |

---

## Open Questions (RESOLVED)

> All four were resolved at plan time (2026-08-10) and each carries an inline `RESOLVED:` token
> naming where it landed. Nothing else in this section has been edited.

1. **Does the post-publish Run CTA (`:496–516`, testid `run-cta`) survive the single-list frame?**
   **RESOLVED:** `192-10` Task 2 — it survives unchanged above the toolbar, with its lookup retargeted to
   the merged list, recorded as an explicit decision.
   - Known: it is a page-level banner, not a card verb; it is set on a gauntlet PASS
     (`onGauntletPublished`, `:347–355`) and looks up the row by slug in `published` (`:473–474`).
   - Unclear: whether it should now target the merged list instead, and whether it belongs above or
     below the toolbar.
   - **Recommendation:** keep it, unchanged, above the toolbar. Retarget its lookup to the merged list
     so a just-published row is found regardless of feed. Record it as an explicit decision so a
     reviewer does not read the survival as an oversight.

2. **Does the `Delete` overflow item appear on draft rows?**
   **RESOLVED:** superseded by locked **D-18** (operator decision, 2026-08-10) — it ships as WIRING of the
   already-shipped `deleteWorkflowDraft`, never through the cascade path, behind an arm-to-confirm guard.
   Implemented in `192-09` Task 2, asserted in `192-11` Task 3. D-09's table says the draft overflow
   carries `Delete` — but the shipped delete is `deleteWorkflowCascade` wired to a *published* row's
   preview (`getWorkflowDeletePreview(wf.id)`), and no draft card has ever exposed delete.
   - **Recommendation:** verify at plan time that `DELETE /workflows/{id}` (`:1141`) and the preview
     endpoint (`:1214`) accept a draft id. If they do, the same Sheet serves both. If they do not,
     `Delete` on drafts is **net-new capability** and — per **G-7** — does not belong inside this
     phase's scope without being named as such.

3. **Adopt `WorkflowBuilderPage.session.test.tsx` (23 tests) into the count gate?**
   **RESOLVED:** `192-01` Task 2 — adopt `session` (assumption A6 recorded in the adoption comment first),
   decline `ChatLayoutLaunch.test.tsx` with its reason written down. It renders the live
   `WorkflowsPage` three times and is unguarded. **Recommendation: yes** — but with the flake in A6
   recorded first, so the adoption does not import a red gate.

4. **Where does the "updating…" marker live during a project re-query?**
   **RESOLVED:** `192-07` Task 2 — in the toolbar, adjacent to the chip row, carrying a `data-state`
   attribute in `DescribeKbPicker`'s convention so the state is machine-readable. Toolbar, list header, or a row
   overlay. Purely a composition call (Claude's discretion), but it must exist — the honest-count rule
   depends on the user being able to tell "these counts describe stale rows" from "these counts are
   final".

---

## Sources

### Primary (HIGH confidence — read in this repo at `HEAD = a0795512`)
- `frontend/src/pages/WorkflowsPage.tsx` — full read, 1407 lines
- `frontend/src/pages/WorkflowsPage.test.tsx` — full structure, 23 tests
- `frontend/src/lib/api.ts` — `PublishedWorkflow` `:1349`, `WorkflowDraftRow` `:3311`,
  `listPublishedWorkflows` `:1379`, `listStarterWorkflows` `:1411`, `listDraftWorkflows` `:3454`
- `frontend/src/lib/threadGroups.tsx` — full read; `HighlightTitle` `:137`
- `frontend/src/components/workflows/soulData.ts` — `DefShape` `:68`, `tierForDefinition` `:111`,
  `entryInputKeys` `:137`, `soulDeliverable` `:161`, `PHASE_GLYPHS` `:57`
- `backend/app/api/workflows.py` — `:75–86`, `:92–128`, `:171–256`, route/gate census
- `backend/app/db/workflows.py` — `list_published_workflows` `:231–296`,
  `list_starter_workflows` `:299–323`, `create_workflow_definition` `:459–486`,
  `list_draft_workflows` `:489–510`
- `supabase/migrations/094_starter_workflows.sql` — starter seeding, `created_by` `:15`
- `scripts/vitest-count-gate.cjs` — `BASELINE` (51 files), `TARGETS`, `BASELINE_TOTAL` `:989`,
  `GSD_VITEST_MAX_WORKERS` handling `:1240–1241`
- `frontend/tsconfig.app.json`, `frontend/vite.config.ts`, `frontend/package.json`
- `frontend/src/pages/WorkflowBuilderPage.header.test.tsx` — `:23`, `:119`, `:303`, `:363`,
  `:794`, `:842–843`
- `.planning/config.json` — `nyquist_validation: true`, `use_worktrees: true`
- Measured runs: `tsc` (33 errors), `eslint` (0 / 0 / 21), vitest (123 tests / 0 failed, two runs)

### Secondary (MEDIUM — planning documents, cross-checked against code)
- `.planning/phases/192-workflow-library-ia/192-CONTEXT.md` — the locked decisions
- `.planning/sketches/157|158|159/README.md` + `.planning/sketches/MANIFEST.md` — the acceptance bar
- `.planning/ROADMAP.md` § Phase 192 · `.planning/REQUIREMENTS.md` LIB-01…04
- `CLAUDE.md` — guardrails G-1…G-7, hot-file ledger, worktree rules, UAT scoreboard recipe

### Tertiary (LOW — none)
No claim in this document rests on an unverified external source. No web search was required: every
question this phase asks is answerable from this repository, and every answer above cites where.

---

## Metadata

**Confidence breakdown:**
- Line-number audit: **HIGH** — every citation re-derived with `grep -n` / `sed -n` at a named SHA
- Backend (D-04, D-16): **HIGH** — SQL, Pydantic models, gating and the seed migration all read directly
- Extraction risk (D-01): **HIGH** — closures enumerated line by line; cycle risk checked by grepping
  every reverse reference
- Test blast radius + count-gate gap: **HIGH** — measured by running the suites and grepping the pin map
- Project-filter semantics recommendation: **MEDIUM** — the facts are verified; the resolution is a
  design judgment the plan should confirm
- Subtree-size estimate: **LOW as a number, HIGH as a method** — labelled an estimate; the plan measures

**Research date:** 2026-08-10
**Valid until:** 2026-09-09 (30 days) — **or immediately invalid if `WorkflowsPage.tsx`,
`scripts/vitest-count-gate.cjs`, or `backend/app/db/workflows.py` receives any commit.** Re-run
`git log --oneline -- <file>` against the counts in § "Line-number audit" before planning.
