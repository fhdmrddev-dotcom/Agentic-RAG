# Phase 192: Workflow Library IA - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-10
**Phase:** 192-workflow-library-ia
**Areas discussed:** G-5 routing, Chip set + project rail, Search scope, Verb collapse, Consequence line

---

## G-5 routing — WorkflowsPage.tsx (1407 L / 21 commits / 10 phases)

| Option | Description | Selected |
|--------|-------------|----------|
| Split by what survives | Wave 0 verbatim-moves `RunModal` + the delete Sheet with baselines captured first; cards/shelves rewritten straight into `components/workflows/library/` as new code | ✓ |
| Full verbatim extraction first | Strict 188.2 shape — move all six components out verbatim with DOM baselines, then build on them | |
| Separate phase 192.0 | A dedicated refactor phase before 192, the literal G-5 reading | |
| Defer the refactor | Build in place, record a G-5 override in STATE.md | |

**User's choice:** Split by what survives.
**Notes:** G-5 was surfaced BEFORE the feature per the orchestrator protocol, and is recorded as
**HONORED — no override, no waiver.** The rationale that decided it: 188.2 measured that a pure
extraction grows the subtree +67%, and three of the six components are being *replaced* by 159-C, so
extracting them first pays that tax on code the phase deletes. `RunModal` and the WFIN-03 delete
Sheet survive 192 unchanged, so a pre-move characterization baseline is meaningful for them and only
for them.

---

## Chip set

| Option | Description | Selected |
|--------|-------------|----------|
| The sketch six | Ready to run · Yours · Still building · Starters · Makes a file · 🔒 Strict | ✓ |
| Five — drop "Yours" | Avoids any backend change; loses the ownership axis entirely | |
| Four — state + provenance only | Pure re-homing of the three shelves plus ownership | |
| Seven+ — add a project chip | Rejected in analysis: projects are unbounded N, so the chip row grows without limit | |

**User's choice:** The sketch six.
**Notes:** The MANIFEST flagged the chip set as "a decision owed at plan time, not a detail" — taken
here instead, because 157-B's navigability depends entirely on it.

---

## "Yours" data path

| Option | Description | Selected |
|--------|-------------|----------|
| Add the field to the payload | Return `is_mine`/`created_by` + `is_system_global` on `PublishedWorkflow`; all six chips then filter client-side with honest simultaneous counts | ✓ |
| Re-query with `?scope=mine` | No backend change, but "Yours" behaves unlike the other five — async, and its count lags | |
| Derive from the three feeds | Merge `?scope=mine` + `/published` + `/starters` client-side; third fetch plus a dedupe | |

**User's choice:** Add the field to the payload.
**Notes:** Discovered during scouting, not inherited: `PublishedWorkflow` is
`{ id, slug, name, definition? }` (`api.ts:1349`) — no ownership field exists. Four of six chips
derive client-side from `definition`; "Yours" was the only one that could not. **This choice makes
192 not-frontend-only** — recorded explicitly in CONTEXT.md D-04 because Phase 184 shipped on a
"frontend-only" assumption that was measurably false and verification inherited it.

---

## Project rail

| Option | Description | Selected |
|--------|-------------|----------|
| Rail → searchable select in the toolbar | One filter home; scales to any N projects; returns 200px to the grid | ✓ |
| Rail survives unchanged | Lowest risk — shipped and working — but two filter homes, and it scrolls at ~20 projects | |
| Project becomes chips in the same row | Fully flat, but unbounded N chips | |

**User's choice:** Rail → searchable select.
**Notes:** Decided on the recorded **"one home per concern"** red line rather than on taste — a rail
beside a full chip toolbar splits one concern across two surfaces. The filter stays server-side
(`?project_folder_id=`); only the instrument changes.

---

## Search scope

| Option | Description | Selected |
|--------|-------------|----------|
| Name + purpose sentence | What 158-A demonstrated, hit highlighted; `business_requirement` is already the card hero | ✓ |
| Name only | SC#1's literal bar; zero ambiguity, but misses anyone who remembers what a workflow does | |
| Name + purpose + deliverable | Widest net; risk of hits whose match isn't visible on the card | |

**User's choice:** Name + purpose sentence.
**Notes:** Carries a binding constraint into planning — it is **substring matching, not meaning**.
The paraphrase "the thing that checks vendors" returns 0, and no copy, placeholder or summary may
imply otherwise.

---

## Verb collapse

| Option | Description | Selected |
|--------|-------------|----------|
| One primary + ⋯ overflow | 159-C's shape; six verbs → three; the duplicate `Publish…` removed | ✓ |
| Rename only, keep every button | Zero behaviour change, but drafts still ship two buttons calling one handler | |
| One verb, everything else in ⋯ | Cleanest at 200 rows; forking becomes a two-step discovery | |

**User's choice:** One primary + ⋯ overflow.
**Notes:** The MANIFEST explicitly left this as "a scope call for discuss-phase, not a silent rename
during execution" because collapsing verbs touches behaviour. Confirmed at HEAD that `✎ Open`
(`:723`) and `Publish…` (`:731`) are both `onClick={onOpen}` — `Publish…` does not publish.

---

## Fork naming

| Option | Description | Selected |
|--------|-------------|----------|
| One word, handler branches on provenance | Intent is identical; slug/version mechanics are ours, not the user's | ✓ |
| Keep two words | Preserves the shipped distinction, but re-teaches the two vocabularies LIB-03 exists to end | |

**User's choice:** One word, handler branches.
**Notes:** **A correction to the sketch MANIFEST was surfaced here.** It calls `onTweak` and
`onUseStarter` "the same action in different words". Read at HEAD they are siblings, not twins:
Tweak forks same-slug v(N+1); Use-starter forks a new auto-suffixed slug at v1, *because*
`UNIQUE(slug, version)` is global across all users. Merging the handlers would break that
constraint — so they share one word and two functions. Recorded as CONTEXT.md D-12.

---

## Consequence line

| Option | Description | Selected |
|--------|-------------|----------|
| The fork verb | The only action whose result isn't obvious from its name — the exact surprise LIB-03 names | ✓ |
| Run | Largest real-world consequence, but its name already says what it does | |
| Both | Most explicit; the repeated prose 159-A lost on | |

**User's choice:** The fork verb.
**Notes:** It is an a11y contract, not a caption — real DOM text via `aria-describedby`, replacing
(never merely deleting) the two shipped `title=` tooltips at `:857` and the `:155` region. Touch has
no hover, and Phase 185's rule already holds this everywhere else in the codebase.

---

## Fork confirm sheet

| Option | Description | Selected |
|--------|-------------|----------|
| No sheet — the sentence is enough | Graded action-guards (146–148): forking is non-destructive, so it earns a direct flip | ✓ |
| Ship the sheet | Most honest at click-time, but one extra click on a harmless action and it softens the guard signal | |

**User's choice:** No sheet.
**Notes:** Sketch 159-C attached a confirm sheet; it is deliberately not shipped, so the sheet
vocabulary stays reserved for `Delete workflow…` where it carries meaning.

---

## Claude's Discretion

- Toolbar layout order and responsive collapse below the mockup's breakpoints.
- Parallel vs sequential fetching of the merged feed, and the loading/empty-state composition
  (subject to the honest-empty-state rule).
- Module boundaries inside `components/workflows/library/` beyond the two verbatim moves.

## Deferred Ideas

- **158-B — teach ⌘K about workflows.** Deferred, not rejected; three-condition re-open trigger
  recorded verbatim in CONTEXT.md and in the sketch README.
- **Semantic / meaning-based search.** A different capability with a different engine — its own
  phase, never a quiet upgrade to the substring field.
- **The hover-only phase-type word on chain glyphs.** Carried and unfixed; belongs to a
  glyph-vocabulary phase.
- **URL-addressable filter state.** Out of scope — the page has no router by design.
- **`spike-nl-workflow-authoring.md`** (todo match, score 0.6) — keyword match only; belongs to
  Phase 193.
