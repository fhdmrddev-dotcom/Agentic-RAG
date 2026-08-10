# Phase 192: Workflow Library IA - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning

<domain>
## Phase Boundary

The Workflows page **library view** — how 50–200 workflows are framed, found, narrowed, and how a
card's actions announce themselves before they are clicked. Requirements LIB-01…04.

**In scope:** the page frame (shelves → one list + toolbar), page search, the filter chip set, the
project filter's instrument, the card's action vocabulary, and the consequence text that makes an
action predictable.

**Out of scope:** the Builder / authoring doors (Phase 193), the run surface (Phase 194+), the
canvas, the publish gauntlet, and the workflow *soul* itself — `WorkflowSoul.tsx` already renders
the 5-atom card (purpose hero, needs, spine, tier, deliverable) and this phase **consumes it
unchanged**.

**G-2 is SATISFIED.** Sketches 157/158/159 were built and driven 2026-08-10; the operator picked
**157-B · 158-A · 159-C**. Those mockups are the acceptance bar — this discussion resolves what the
sketches deliberately left open, it does not re-open the frame.
</domain>

<decisions>
## Implementation Decisions

### G-5 — the refactor question, answered FIRST

- **D-01: G-5 is HONORED, not overridden — and the seam is split by what survives 192.**
  `frontend/src/pages/WorkflowsPage.tsx` measures **1407 lines / 21 commits / 10 phases** at HEAD
  (re-measured, not inherited: `wc -l` and `git log --oneline -- <file> | wc -l`). It was absent from
  the CLAUDE.md hot-file ledger for all ten phases, which is why the guardrail never fired — the
  audit scans against that table, so a file missing from it is invisible to its own rule. Row added
  2026-08-10 (`d0c76525`).

  The extraction is **not** a uniform 188.2-style verbatim cut, because 188.2 measured that a pure
  extraction grows the subtree **+67%** — and paying that on code this phase deletes is waste. Split
  by survival:

  | Code | Survives 192? | Treatment |
  |---|---|---|
  | `RunModal` (`:1054–1407`, ~354 L) | **yes, unchanged** | **Verbatim move** to its own module. Capture the characterization baseline **BEFORE** the move (the 188.1 lesson: a baseline only proves something if it PREDATES the change). |
  | WFIN-03 victim-naming delete Sheet (`:872–1003`, nested inside `PublishedCard`) | **yes, unchanged** | **Verbatim move** to its own module, same baseline-first rule. It is currently trapped inside a card component that is being replaced. |
  | `DraftCard` (`:693`) · `PublishedCard` (`:745`) · `StarterCard` (`:1014`) | **no — replaced by 159-C's single card** | **Rewritten as new code** directly under `frontend/src/components/workflows/library/`. Do NOT extract-then-rewrite. |
  | `FilterItem` (`:675`) · `NetNewFlag` (`:80`) | **no — see D-05, D-11** | Removed or re-homed with the toolbar work. |

  **Target end state:** `WorkflowsPage.tsx` is composition — the 188.2 shape, reached without the
  188.2 tax. Destination directory `frontend/src/components/workflows/library/` **does not exist
  today** (verified) and is created by this phase.

### The frame — 157-B (one list, shelves become filters)

- **D-02:** The three shelves (Starters → Published → Drafts, `:544`/`:568`/`:604`) collapse into a
  **single flat result list** with a persistent toolbar. **Create leads the toolbar** — this fixes
  SC#4 *structurally* rather than by promotion, so the create affordance can never drift back down a
  grid the way the dashed build-card did (it is currently the first cell of the *third* grid,
  `:613`).
- **D-03: Six chips ship** — *Ready to run · Yours · Still building · Starters · Makes a file ·
  🔒 Strict*. Every chip **recounts against the live search**, so a chip can never promise results it
  cannot deliver. The three shelf names are **re-homed, not dropped**: "Published" → *Ready to run*,
  "Drafts & seeds" → *Still building*, "Starters" → *Starters* (provenance) — plain-language labels
  per the 146 LANG-01 pattern.
- **D-05: The 200px project rail becomes a searchable SELECT in the toolbar.** One filter home, not
  two — a rail beside a full chip toolbar splits one concern across two surfaces (the recorded
  "one home per concern" red line). A select also scales to any N projects where a rail becomes a
  scroll wall, and it returns 200px of width to the grid at 200 workflows. Project stays a
  **server-side** filter (`?project_folder_id=`, live re-query) — only its instrument changes.
- **D-11: Developer vocabulary leaves the user-visible surface.** The literal string
  `GET /workflows/published` renders to end users at **`:491`** (the D14 honesty banner) and
  **`:577`** (a chip on the Published shelf) — confirmed at HEAD, both are real DOM text, not
  comments. Both go, with the shelf they sat on. The honesty banner is **re-worded in plain
  language, not silently deleted**. ⚠ Plan-time check: the banner also claims draft
  create/list/update/delete are "net-new" (`NetNewFlag`, `:80–84`) — verify whether that claim is
  still true before deciding whether the disclosure has any remaining job.

### Search — 158-A (always-on page search)

- **D-06: The field is always visible** (not tap-to-open). Decided on use-count, not taste: at 200
  workflows the field is opened every visit, so a tap is pure recurring cost.
- **D-07: Scope = workflow name + the purpose sentence (`business_requirement`), with the hit
  highlighted.** Wider than SC#1's literal bar ("part of its name") and measurably more useful —
  `clause`, `assessments`, `sign-off` each find workflows whose *titles* lack the word. The purpose
  sentence is already the card's hero atom, so search matches what the reader can see.
- **D-08: It is SUBSTRING matching, not meaning — and the product must say so.** The paraphrase
  *"the thing that checks vendors"* returns **0** results. No copy, placeholder, tooltip, commit
  message or SUMMARY may imply semantic search.

### The card and its verbs — 159-C (one verb, consequence inline)

- **D-09: One primary verb + a `⋯` overflow, one action vocabulary for one list.** Six verbs measured
  across the three shipped card types (`Use this →` · `⑂ Tweak` · `▶ Run` · `⋯ Delete workflow…` ·
  `✎ Open` · `Publish…`) collapse to three:

  | Row state | Primary | Overflow `⋯` |
  |---|---|---|
  | Runnable (published or starter) | `▶ Run` | the fork verb · `Delete workflow…` |
  | Draft ("Still building") | `✎ Open` | `Delete` |

- **D-10: `Publish…` is REMOVED — it is a button that lies.** `✎ Open` (`:723`) and `Publish…`
  (`:731`) are **both** `onClick={onOpen}` — confirmed at HEAD. `Publish…` does not publish; it opens
  the Builder. The path to publish remains Open → Builder → publish gauntlet, which is where the
  gauntlet actually lives.

- **D-12: ⚠ `onTweak` and `onUseStarter` are SIBLINGS, NOT TWINS — share one WORD, never one
  FUNCTION.** This **corrects** the sketch MANIFEST, which calls them *"the same action in different
  words"*. Read at HEAD, they differ in two load-bearing ways:
  - `onTweak` (`:220–247`): **same slug**, version **N+1**.
  - `onUseStarter` (`:257–...`): **new auto-suffixed slug**, version **1** — and the shipped comment
    (`:250–256`) states why: `UNIQUE(slug, version)` is **GLOBAL across all users**, so two people
    forking one shared starter cannot both mint `<slug> v(N+1)`. It also retries once on a 409.

  **Merging the handlers would break that constraint.** Ship **one verb** on the card face — the
  user's intent is identical ("give me my own editable version of this"); the slug/version mechanics
  are ours, not theirs — and branch on **provenance** (`is_system_global` starter vs the user's own
  published row) to pick the handler. Both handlers stay intact.

- **D-13: The consequence sentence is spent once, on the fork verb.** It is the only action whose
  result is not obvious from its name, and it is the exact surprise LIB-03 names: it opens a full
  edit surface on a **new private copy** while the published version **stays live and frozen**.
  `Run` runs and `Open` opens — neither earns a sentence, and repeating one on every card at 200
  cards is the clutter LIB-02 exists to cure.

- **D-14: The sentence is an a11y CONTRACT, not a caption.** Real DOM text wired via
  `aria-describedby` — **never** a `title=`, because **touch has no hover**, and Phase 185's own
  graded-governance rule already holds this everywhere else in the codebase. The two shipped `title=`
  explanations are removed **by being replaced**, never by being deleted and left unexplained:
  - `:857` region — `title="Fork a new version into the Builder (the published row stays frozen)"`
  - `:155` region — `title="Fork a fresh personal copy of this starter into the Builder"`

- **D-15: NO confirm sheet on the fork.** The recorded 146–148 graded action-guards rule grades the
  guard by consequence (victim-naming sheet / arm-to-confirm / direct flip). Forking is
  non-destructive and reversible — the published row stays frozen — so it earns a **direct flip**. A
  sheet on a harmless action spends the guard vocabulary that `Delete workflow…` relies on to mean
  something. (The sketch attached one to 159-C; it is deliberately not shipped.)

### Data — and the scope fact this creates

- **D-04: ⚠ 192 IS NOT FRONTEND-ONLY.** `PublishedWorkflow` is `{ id, slug, name, definition? }`
  (`frontend/src/lib/api.ts:1349`) — **there is no ownership field**. Four of the six chips derive
  client-side from `definition` (*Ready to run*, *Still building* from row state; *Makes a file* via
  `soulDeliverable`; *🔒 Strict* via `tierForDefinition` — tier is derived, never stored). **"Yours"
  cannot.** Today it is a server round-trip (`GET /workflows/published?scope=mine`,
  `backend/app/api/workflows.py:~198`).

  **Decision: add the ownership field to the payload** (`is_mine` / `created_by`, plus
  `is_system_global` for the *Starters* provenance chip). One backend field, and all six chips then
  filter client-side instantly with honest simultaneous counts — which is 157-B's actual promise. A
  re-query chip cannot keep it.

  **Consequence for downstream: this phase touches `backend/app/api/workflows.py`, the repository
  query behind `list_published_workflows`, and `frontend/src/lib/api.ts`.** Record this now — Phase
  184 shipped on a "frontend-only" assumption that was measurably false, and verification inherited
  it.

- **D-16: The flat list is a client-side MERGE of separate feeds.** `/workflows/published` and
  `/workflows/starters` are distinct endpoints (starters = `is_system_global` published rows,
  world-readable), and drafts come from a third source. 157-B's single list merges them and tags
  provenance. Both feeds are the documented **RUN CARVE-OUT** and are explicitly NOT
  feature-gated (`workflows.py:171` — "DO NOT gate /published or /starters"); the merge must not
  introduce a gate. Dedupe is a plan-time concern.

### Claude's Discretion

- Toolbar layout order and responsive collapse behaviour below the mockup's breakpoints.
- Whether the merged feed fetches in parallel or sequentially, and the loading/empty-state
  composition — subject to the honest-empty-state rule (`WorkflowSoul`'s D-03 pattern: the atom is
  always rendered, never hidden, never fabricated).
- Module boundaries inside `components/workflows/library/` beyond the two verbatim moves named in
  D-01.

### Folded Todos

None folded.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The locked design (G-2 — the acceptance bar)
- `.planning/sketches/157-the-library-at-scale/README.md` + `index.html` — winner **B**, one list,
  shelves become filters. Carries the 12/54/200 scale selector; judge density at 200, not 12.
- `.planning/sketches/158-finding-and-narrowing/README.md` + `index.html` — winner **A**, always-on
  page search. §"Deferred: B" carries the ⌘K three-condition re-open trigger verbatim.
- `.planning/sketches/159-what-a-card-promises/README.md` + `index.html` — winner **C**, one verb,
  consequence inline. Its "Today (shipped)" tab is the diagnosis, built from the real code.
- `.planning/sketches/MANIFEST.md` §"Winners (operator, 2026-08-10)" + §"Obligations the winners
  inherit" — the seven inherited obligations. ⚠ **Its claim that `onTweak` and `onUseStarter` are
  "the same action in different words" is CORRECTED by D-12 above** — read D-12, not the MANIFEST, on
  that point.

### Requirements + roadmap
- `.planning/REQUIREMENTS.md` — LIB-01…04 (lines 18–21), all sourced to SEED-136.
- `.planning/ROADMAP.md` §"Phase 192: Workflow Library IA" — goal + the four success criteria.

### Project rules this phase is bound by
- `CLAUDE.md` §"Workflow guardrails" — **G-5** (the hot-file ledger row for `WorkflowsPage.tsx`),
  G-4 (lived-experience UAT gate — 192 touches user-visible UI), G-6, G-7.
- `CLAUDE.md` §"UAT scoreboard recipe" — 192 is UI/frontend + one API field; it does **not** touch
  streaming, the agent loop, or provider routing, so the 8-row cross-provider roster is **not**
  triggered. Say so explicitly in VALIDATION.md rather than silently omitting it.
- `.claude/skills/sketch-findings-agentic-rag/SKILL.md` — **load the skill, do not paraphrase the
  MANIFEST.** §`references/icon-convention.md` §4 is the canvas glyph vocabulary; no glyph may be
  invented, and no phase-type glyph may be repurposed as a category icon.

### Code that constrains the implementation
- `frontend/src/pages/WorkflowsPage.tsx` — the file being restructured. 1407 L at HEAD.
- `frontend/src/components/workflows/WorkflowSoul.tsx` — the 5-atom card soul, **consumed
  unchanged**. Its docblock carries the locked 046-A atom order (purpose is the hero at every scale),
  the honest-empty-state rule, the XSS rule (never `dangerouslySetInnerHTML` on
  `business_requirement`), and a **G-5 RED LINE**: it must not import the run-surface phase timeline.
- `frontend/src/components/workflows/soulData.ts` — `tierForDefinition`, `entryInputKeys`,
  `soulDeliverable`, and `PHASE_GLYPHS` (7 types). The *Makes a file* and *🔒 Strict* chips derive
  from here.
- `frontend/src/components/workflows/deriveTier.ts` — tier is DERIVED from real enums
  (`citation_policy` + the set of `ValidatorSpec.kind`), never stored. No invented strictness
  vocabulary.
- `frontend/src/lib/api.ts:1349` — `PublishedWorkflow`, the type D-04 extends.
- `backend/app/api/workflows.py` — `/published` (`:175`), `/starters` (`:~229`), the `?scope=mine`
  parameter, and the `:171` RUN CARVE-OUT comment (do not gate these two).
- `frontend/src/pages/WorkflowsPage.test.tsx` — the existing suite the restructure must keep green.

### Deployment / parity
- `CLAUDE.md` §"Deployment (cloud)" — D-04 adds no migration and no env var, so the deploy-artifact
  same-commit rule is not triggered. Confirm at plan time rather than assuming.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`WorkflowSoul.tsx` (scale `card`)** — the rich card 159-C keeps is **already built**. Purpose
  hero (`business_requirement`), needs, glyph-dot spine, tier chip, deliverable line. This phase adds
  chrome and one consequence sentence around it; it does not rebuild the card's content.
- **`ui/input.tsx`** — exists. 158-A needs no new dependency and has page-local blast radius.
- **`Sheet` (`components/ui/sheet`)** — already imported (`:37`); the WFIN-03 delete Sheet is the
  shipped 064-B primitive and moves out intact.
- **`DropdownMenu`** — already the `⋯` host on `PublishedCard` (`:820–845`); D-09's overflow extends
  a pattern that ships rather than inventing one.
- **`deriveTier` / `soulDeliverable`** — the two capability chips are pure client-side derivations
  over `definition`. No new endpoint.

### Established Patterns
- **There is NO router on this page.** Navigation is a `useState` — the three-homes contract, stated
  in the file's own comment at `:320`. The toolbar, chips and search are page-local state; do not
  introduce routing or URL params without treating that as its own decision.
- **Tier is derived, never fetched** — `deriveTier.ts` imports nothing from the API client.
- **Honest empty states** — the atom renders always, never hidden, never fabricated
  (`WorkflowSoul` D-03). Chips with a zero count must obey the same rule.
- **Graded action guards (146–148)** — sheet / arm / direct flip, graded by consequence. D-15 applies
  it; `Delete workflow…` keeps its victim-naming sheet.
- **Reasons are real DOM text via `aria-describedby`, never `title=` (Phase 185).** The page
  currently breaks this rule in at least three places (`:84`, `:576`, `:857`).

### Integration Points
- `GET /workflows/published` + `GET /workflows/starters` → the merged list (D-16). Payload extended
  by D-04.
- `?project_folder_id=` → the project select (D-05) — server-side re-query, instrument change only.
- `createWorkflowDraft` → both fork paths (D-12), untouched.
- `setPageView("builder")` + `setBuilderInitial` → the seam to Phase 193's authoring doors. 192 must
  not change this handoff.

### Known carried defect — NOT introduced by 192
⚠ The **phase-type word is still hover-only (`title=`) on every chain glyph**, in the shipped page
*and* in all four sketch tabs. It is the glyph vocabulary's own problem, out of LIB-01…04's scope.
**Recorded here so a later reviewer cannot discover it and assume 192 added it.**
</code_context>

<specifics>
## Specific Ideas

- **"A control you always open should always be open."** The operator's reasoning for 158-A, and the
  test for any future tap-to-reveal on this page.
- **"A category that is a chip survives a fourth category; a category that is a place needs a fourth
  shelf."** The 155-C rule 157-B re-applies — the reason shelves die.
- **The fork verb's sentence must name both halves**: what you get (a new private copy, open for
  editing) *and* what stays true (the published version stays live and frozen). Naming only the first
  half reproduces the surprise LIB-03 exists to end.
- **Judge every density decision at 200 workflows**, never at 12 (the 045 real-scale lesson, which is
  why all three sketches ship a scale selector).
</specifics>

<deferred>
## Deferred Ideas

- **158-B — teach ⌘K about workflows.** Deferred, **not rejected**, purely on blast radius: it
  changes a global component (`ThreadCommandPalette.tsx`, hand-rolled on Radix Dialog — **not**
  `cmdk`) and its one shared match engine. The Phase-156 precedent (sketch 078-D, *"the column
  filters what you see; ⌘K jumps anywhere"*) says a page filter and a global jump box are different
  instruments and both can be true. **Re-open when ANY of:** (1) a second surface asks to be findable
  from ⌘K (Skills, Documents, Views); (2) a user is observed pressing ⌘K on the Workflows page and
  getting only chats; (3) any phase touches `ThreadCommandPalette.tsx` or `lib/threadGroups.ts` for
  another reason — fold B in then. Full text: `.planning/sketches/158-finding-and-narrowing/README.md`
  §"Deferred: B".
- **Semantic / meaning-based workflow search.** D-08 ships substring matching. A paraphrase search is
  a different capability with a different engine — its own phase, never a quiet upgrade to this field.
- **The hover-only phase-type word on chain glyphs.** Carried, unfixed, inherited (see code_context).
  Belongs to a glyph-vocabulary phase, not to LIB-01…04.
- **URL-addressable filter state** (share a filtered library view). Out of scope — the page has no
  router by design (`:320`).

### Reviewed Todos (not folded)
- **`spike-nl-workflow-authoring.md`** (score 0.6) — matched on generic keywords only ("trigger",
  "milestone", "first", "before"), not on subject matter. NL→workflow authoring is **Phase 193**
  (Authoring Doors + Template Placement). Not folded.

### Reported bugs reviewed (none folded)
Twelve reports are `status: open`; **none** has `affected_areas` overlapping the workflow *library*
page. The nearest, `BUG-260808-02-approval-hands-off-to-chat.md`, is the workflow **run surface** /
approval checkpoint — a later phase's domain. Two open canvas WR-04 reports
(`BUG-260807-01`, `BUG-260808-01`) are the canvas, not this page. **Nothing folded into 192.**
</deferred>

---

*Phase: 192-Workflow Library IA*
*Context gathered: 2026-08-10*
