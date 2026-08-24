# AUDIT — `step-panel` · `builder-canvas` · `node-identity` · `builder-spine`

**Read-only audit, 2026-08-20.** Every row below was derived from the SHEET's own markup
(`.planning/sketches/200-journey-interactive/screens/*.html`), never from `200-CHECKLIST.md`
and never from the `JOURNEY` array. Every row carries a `file:line`, a grep result, or the
literal `grep → 0`.

⚠ **A sibling agent was editing `WorkflowCanvas.tsx` / `PhaseNodeCard.tsx` / `PhaseFormPanel.tsx`
during this audit.** Line numbers in those three files may have shifted by a few lines; the
symbols and strings cited are stable.

---

## ⚠ Two corrections to the brief, stated before the tables

**(a) NEITHER `builder-spine.html` NOR `builder-canvas.html` DRAWS A PER-STEP TIMING.** The brief
says both do. Measured, not assumed — a regex for `N s` / `N m` / `N ms` / `MM:SS` over the four
sheets' rendered text returns:

```
builder-spine.html   → (nothing)
builder-canvas.html  → ">Over £2m?<"      (a branch predicate, not a duration)
step-panel.html      → (nothing)
node-identity.html   → ">00:15<"          (the ONLY duration in the four sheets)
```

The single per-step timing in this audit's scope is `node-identity.html`'s `00:15`, on its
**Running** run-state swatch — a RUN surface atom on a catalogue page. It is audited as one row.

**(b) BOTH BUILDER SHEETS ARE AUTHORING SURFACES, AND BOTH DRAW AT LEAST ONE RUN-TENSE ATOM.**
Each header reads `draft` + `Save draft` + `Publish...`, so there is no run behind either.

- `builder-canvas.html` draws a `<textpath>` label reading **`running`** on the active edge, plus
  a marching-ants stroke animation (`.animate-march`) and a border pulse (`.animate-border-pulse`)
  on the branch node. On a draft these are fabricated liveness claims — the same class `199-02`
  refused on the spine.
- `builder-spine.html` draws **`Approve` / `Send back`** buttons inside a step card. Those are run
  controls; on a draft they are dead controls.

Each is bucketed by what the element needs and the refusal is named in its evidence cell.

---

## `step-panel.html`

The subject is the 400px right aside. The left rail and the dimmed canvas behind it are drawn by
the sheet and are therefore enumerated, at group granularity for the rail.

| Sheet element | Bucket | Evidence |
|---|---|---|
| Left nav rail — app mark, `+` New chat, Chat, **Workflows (active, left border)**, Documents, Classification, Library Health, Governance, Skills, Settings, Account | **SHIPS** | `frontend/src/lib/nav-items.ts:31-60` declares exactly these eight views in this order; rendered at `frontend/src/components/layout/ChatLayout.tsx:578` (`navItems.map`). |
| Dimmed workflow canvas behind the open panel (`opacity-60 pointer-events-none`) | **FE-WIRING** | The canvas and panel are two tracks of one grid — `WorkflowBuilderPage.tsx:2652` `gridTemplateColumns: "minmax(0,1fr) " + (panelOpen ? "400px" : "44px")`. Opening the panel narrows the plane; nothing dims or inerts it. `grep -n "opacity-60" WorkflowCanvas.tsx` → 0. |
| Grid-pattern ground behind those mock nodes | **SHIPS** | `WorkflowCanvas.tsx:1591` `<Background variant={BACKGROUND_GROUND.variant} …>`; `canvasGround.ts:24-33` (Dots · gap 20 · size 1 — the sheet draws 24px LINES). |
| 44px collapsed strip at the far right, with a `chevron_right` | **SHIPS** | `PhaseFormPanel.tsx` resting rail — `data-testid="phase-form-rail"`, vertical text `select a step to refine it`. ⚠ In the product the 44px strip **IS** the collapsed panel (same grid track), so the sheet's simultaneous open-panel-plus-strip is not a reachable state. |
| Panel header: bordered small-caps TYPE BADGE (`AI AGENT STEP`) on its own line | **SHIPS** | `PhaseFormPanel.tsx:1000` `friendlyType = PHASE_TYPE_FRIENDLY[pt] ?? pt`; rendered `:1025`. Ported from this sheet's markup (badge-above-title). |
| Panel header: step NAME as the heading under the badge | **SHIPS** | `PhaseFormPanel.tsx:1027-1029` — `{phase.name?.trim() || phase.slug}`. |
| Panel header: `✕` close | **SHIPS** | `PhaseFormPanel.tsx:1043-1052`, `data-testid="phase-form-close"`, `aria-label="Close step details"`. |
| Header control `ⓘ Explain each field` | **SHIPS** | `fieldGuidanceContext.ts:31` `FIELD_GUIDANCE_SHOW = "Explain each field"` (+ `:34` `FIELD_GUIDANCE_HIDE`); consumed by `FieldGuidance.tsx`, mounted at `PhaseFormPanel.tsx:~1075`. |
| Group title `What it does` | **SHIPS** | `stepCardSectionContext.ts` → `STEP_CARD_WHAT_IT_DOES_TITLE = "What it does"`; mounted on all seven type branches (`PhaseFormPanel.tsx:1104`, `1160`, `1223`, `1285`, `1325` …). |
| Instructions textarea + placeholder | **SHIPS** | `PhaseFormPanel.tsx:1167-1175` — `TextField label="Instructions"` over `config.prompt`, `textarea full`. |
| Group title `Model` | **SHIPS** | `stepCardSectionContext.ts` → `STEP_CARD_MODEL_TITLE = "Model"`; card at `PhaseFormPanel.tsx:1142-1146`. |
| Model `<select>` | **SHIPS** | `ModelField.tsx`, mounted `PhaseFormPanel.tsx:1144 / 1196 / 1268 / 1349`. |
| Option `Use the run's model — today that would be GPT-4o` | **SHIPS** | `ModelField.tsx:143` `INHERIT_LABEL = "Use the run's model"`; the trailing clause "is appended only when the server resolved something to name" (same docblock). The sheet's `GPT-4o` is placeholder text — models come from the registry, never a literal. |
| Green fitness chip `✓ Strong for judging` | **SHIPS** *(different words, narrower gate)* | `modelFitness.ts:76-80` `MODEL_FITNESS_WORD` = `Can fill a document — guaranteed format` / `Can fill a document` / `Best-effort only — may not fill a document`. ⚠ Rendered ONLY under `showFitness`, which rides `llm_emit` alone (`PhaseFormPanel.tsx:1349`, D-12) — so on the sheet's own AI-agent step it does **not** render. |
| Red error row `We couldn't load the list of models.` | **SHIPS** *(muted tone, not the sheet's danger tone)* | `ModelField.tsx:169` `REGISTRY_UNAVAILABLE`, reached via `noAnswer === "unavailable"` (`:214-247`). The colour disagreement is recorded, not silently resolved — `ModelField.tsx:150-160` and `199-06-SUMMARY.md`. |
| Group title `What it can reach` | **SHIPS** | `stepCardSectionContext.ts` → `STEP_CARD_REACH_TITLE`; cards at `PhaseFormPanel.tsx:1148`, `1204`, `1268`, `1345`. |
| Sub-label `Folders it can read` | **SHIPS** | `PhaseFormPanel.tsx:635`. |
| Full-width folder ROW (`📁` + name, bordered, `bg-raised`) | **SHIPS** | `PhaseFormPanel.tsx:648-668` — one row per id, `data-testid="folder-scope-display"`. Ported from this sheet (rows, not inline chips). |
| Per-folder `Lock` button | **BE-NEEDED** | `backend/app/models/harness.py:85 / 104 / 123 / 160` — `folder_scope: list[UUID] \| None`. **No lock bit, no holder, no wire field of any kind.** Needs a per-folder lock record (holder + timestamp) on the phase config or a sibling table. |
| Locked folder row: `lock` glyph + `Locked — only the person who locked it can release it` | **BE-NEEDED** | Same field as above. The shipped one-way lock is **step-level**, not folder-level: `harness.py:403` `grounding_escalated: bool` + its refusal `definitionOps.ts:529` `GROUNDING_LOCK_REFUSAL`. |
| `+ Add a source` dashed button | **FE-WIRING** *(fix is BE-gated)* | The panel's write seam exists and drives every other config key (`PhaseFormPanel.tsx:1002` `set(key)` → `onChange`); **nothing supplies a control for `folder_scope`** — it is a read-only display, pinned by a source assertion in `WorkflowBuilderPage.header.test.tsx`. ⚠ Wiring it alone is not enough: a phase declaring `folder_scope` on a workflow with no `project_folder_id` raises a raw 422 (`_folder_scope_requires_project`, recorded at `WorkflowBuilderPage.tsx:2312`). Ported today as a STATEMENT: `stepCardSectionContext.ts` → `STEP_CARD_NO_SOURCE_ADD`, rendered by `NoSourceAddLine` (`PhaseFormPanel.tsx:688-697`). |
| `<hr>` divider inside the reach card | **SHIPS** | `PhaseFormPanel.tsx:684-686` `CardDivider`. |
| Sub-label `What this step can do` | **SHIPS** | `PhaseFormPanel.tsx:756` and `:842`. |
| Two ACTIVE (chosen) tool pills — `Read a document`, `Search documents` | **SHIPS** | `ToolChoiceSet.tsx` — `aria-pressed={on}`, `border-primary bg-primary/10`; both phrases in `toolNames.ts` `TOOL_PHRASES` (`read_document`, `search_documents`). Chosen tools are pinned open and render FIRST. |
| Ten INACTIVE tool pills | **SHIPS** | `ToolChoiceSet.tsx` — `SHEET_VISIBLE_COUNT = 12` measured off this sheet; the server offers 28 ids, the rest fold behind `Show n more` / `Show fewer`. |
| Each of the sheet's twelve phrases (`Run code`, `Search a saved view`, `Write a file`, `Track its to-dos`, `Ask a person`, `Attach a skill file`, `Browse the web`, `Read related documents`, `Query tables`, `Remember something`, + the two above) | **SHIPS** | `toolNames.ts` `TOOL_PHRASES` — all twelve present verbatim (`execute_code`, `query_documents_by_view`, `workspace_write`, `write_todos`, `ask_user`, `attach_skill_file`, `web_search`, `get_related_documents`, `query_tables`, `remember`). |
| `Pick from the tools this workspace allows — you cannot add one by typing.` | **SHIPS** | `PhaseFormPanel.tsx:828-829` `TOOL_WHITELIST_NO_TYPING` — byte-identical to the sheet, always on screen (never behind the guidance fold). |
| Group title `What it changes outside this workflow` | **SHIPS** | `stepCardSectionContext.ts` → `STEP_CARD_OUTSIDE_TITLE`; card at `PhaseFormPanel.tsx:1420-1433`. |
| Amber left edge on that card | **SHIPS** | `PhaseFormPanel.tsx:1429` `accent="consequence"` → `StepCardSection.tsx:103` `CARD_BODY_CONSEQUENCE = "border-l-2 border-l-warning"`. |
| Capability title `Writes to your database` | **BE-NEEDED** | `backend/app/models/harness.py:251` — `capability: Literal["send_email", "create_ticket", "post_message"]`. A CLOSED set of three; no database-write capability exists. Adding one is a new `Literal` member + an executor + a `phaseVocabulary.EXTERNAL_CAPABILITY_SENTENCES` entry. |
| `NEEDS ARMING` badge | **SHIPS** | `stepCardSectionContext.ts` → `STEP_CARD_NEEDS_ARMING`; passed as `mark` at `PhaseFormPanel.tsx:1427`. True by construction — `GovernanceSection.tsx:141` `ARM_PINNED_TYPES = ["external_action"]`. |
| `This step can change records that live outside this workflow.` | **SHIPS** | `stepCardSectionContext.ts` → `STEP_CARD_OUTSIDE_SENTENCE`, verbatim; passed as `note` at `PhaseFormPanel.tsx:1428`. |
| Dimmed second row `Sends a Slack message` | **BE-NEEDED** | ⚠ The ROW SHAPE ships — `ExternalActionSection.tsx:188-218` renders every closed-set capability as a row, unselected ones muted — but this capability does not exist. The nearest live member is `post_message` → `phaseVocabulary.ts:589` `"Posts a message"`, which names no destination. A destination-named sentence is a separate row on the canvas sheet below. |
| Group title `Files it starts from` | **SHIPS** *(different words)* | `TemplateAttachSection.tsx:60` `TEMPLATE_SECTION_HEADING = "The file this step fills in"`. Deliberate — `stepCardSectionContext.ts` records the refusal to re-spell it ("that sentence says what the file is FOR, which the sheet's does not"). Mounted in the sheet's POSITION at `PhaseFormPanel.tsx:1450-1452`. |
| Empty state `Nothing attached yet` (italic, dimmed) | **SHIPS** *(different words)* | `TemplateAttachSection.tsx:64-65` `TEMPLATE_NONE_NOTE = "No template attached yet. This step fills in a document you supply."` |
| Attached file row (doc glyph + `Renewal brief template`) | **SHIPS** | `TemplateAttachSection.tsx:193` — `filename`, resolved by the caller off `definition.assets[]`. |
| Error row `We could not read this file` (red, under a named file) | **SHIPS** *(different claim)* | `TemplateAttachSection.tsx:142-143` `TEMPLATE_FIELDS_UNAVAILABLE = "We could not read this template's fields. It is still attached — this says nothing about what is in it."` ⚠ The shipped sentence disclaims a FIELDS read; the sheet's disclaims the FILE. Not the same claim. |
| **Three** file rows in one step | **BE-NEEDED** | One template per step: `TemplateAttachSection.tsx:6` resolves `assets.find(a => a.kind === "template")?.filename` — a `find`, not a filter. A multi-file start set needs a list on the definition and an executor that reads it. |
| Group title `How strictly it is held` | **SHIPS** *(different words)* | `GovernanceSection.tsx:101` `SECTION_HEADING = "How strictly this step is held"` — it doubles as the dial group's accessible name (`:288`), which is why `stepCardSectionContext.ts` declines a second spelling. |
| `Loose` / `Strict` segmented toggle | **SHIPS** *(different words)* | `definitionOps.ts:489` `GROUNDING_DIAL_LOOSE_LABEL = "○ Free to think"` · `:492` `GROUNDING_DIAL_STRICT_LABEL = "⛨ Must prove it"`; rendered `GovernanceSection.tsx:294-326`, `aria-pressed` on both arms. |
| Shield glyph + `Every claim must be cited from your documents.` | **SHIPS** *(different words)* | `PhaseFormPanel.tsx:367` `strict: "Every claim must be cited — the deliverable fails if anything is uncited."` (the `citation_policy` caption). The dial's own why-line is `definitionOps.ts:511` `GROUNDING_WHY_DETECTED = "Because this step reads your documents."` |
| Closing card pinned to the bottom above a top border, amber left edge | **SHIPS** | `StepReadiness.tsx` — `mt-4 border-t border-border pt-4` + `border-l-2 border-l-warning`; mounted last at `PhaseFormPanel.tsx:1462-1470`. |
| Heading `2 things still missing` | **SHIPS** | `stepReadinessContext.ts` → `stillMissingHeading(count)`. ⚠ Renders NOTHING at zero (never `0 things still missing`) — `StepReadiness.tsx` early return. |
| Checklist row `Choose a model ›` | **FE-WIRING** | The row mechanism ships (`stepGaps()` returns rows; `StepReadiness` renders them as real `<button>`s). Nothing emits this row: `stepReadinessContext.ts` refuses it, with the measurement — *"a blank `model` is the shipped, documented, correct state … 239 of 257 real phases are in it."* Adding it is one `gaps.push`. |
| Checklist row `Connect a knowledge source ›` | **FE-WIRING** *(and its FIX is BE-gated)* | Same seam, same refusal in `stepReadinessContext.ts` — *"a checklist row for a thing the surface refuses to let you fix is a dead end wearing a chevron."* The dead end is the `Add a source` row above (422 gate), so this row only becomes honest after that BE-NEEDED item lands. |
| Chevron glyph on each row | **SHIPS** | `StepReadiness.tsx` renders `›`, `aria-hidden`. ⚠ The sheet's Material ligature `chevron_right` is forbidden as visible text — `PhaseFormPanel.test.tsx` scans rendered text nodes for exactly that class of literal. |

**Summary — `step-panel.html`: SHIPS 37 · FE-WIRING 4 · BE-NEEDED 5 · NEW 0** (46 rows).
The sheet's seven card titles all exist; four of them under this project's own wording, each with
a recorded one-home reason. The only genuinely missing DATA is the per-folder lock, a database-write
capability, and a multi-file start set.

---

## `builder-canvas.html`

An **AUTHORING** surface — its own header reads `draft` / `Save draft` / `Publish...`. Every
run-tense atom it draws is called out as such.

| Sheet element | Bucket | Evidence |
|---|---|---|
| Left nav rail (same eight + Account) | **SHIPS** | `frontend/src/lib/nav-items.ts:31-60`; `ChatLayout.tsx:578`. |
| Header: `← Workflows` back control | **SHIPS** | `BuilderHeaderBar.tsx` `lead` slot ← `headerLead` (`WorkflowBuilderPage.tsx:2599`), which "still closes over `WorkflowsPage`'s `backToLibrary`" (`BuilderHeaderBar.tsx:11-13`). |
| Header: vertical hairline divider | **SHIPS** | `BuilderHeaderBar.tsx:70-72` — `data-testid="builder-header-seam"`, `mx-0.5 h-4 w-px bg-border`, gated on both `lead` and `identity`. |
| Header: workflow title `Northwind QBR` | **SHIPS** | `WorkflowBuilderPage.tsx:2532-2534` — `identityLabel = authoredName ?? meta.slug ?? "Untitled workflow"`; rendered `:2545-2549`. |
| Header: `draft` badge | **SHIPS** | `WorkflowBuilderPage.tsx:2550-2552`. |
| Sub-tabs `Spine` / `Canvas` (Canvas active, underlined) | **SHIPS** *(different placement)* | `WorkflowBuilderPage.tsx:2153-2194` — `data-testid="builder-view-toggle"`, `role="tablist"`, buttons `builder-view-spine` (`≣ Spine`) and `builder-view-canvas` (`⬡ Canvas`). ⚠ Its own strip above the graph column, not inside the header row the sheet draws it in. |
| Header: `Save draft` | **SHIPS** | `WorkflowBuilderPage.tsx:2560-2568` → `BuilderSaveRegion` (`builder-save-draft`). |
| Header: `Publish...` | **SHIPS** | `WorkflowBuilderPage.tsx:2574-2576` `renderPublish(definition, draftId, blockedReason, setPublishInFlight)` → `PublishGauntlet.tsx`. |
| Canvas plane ground (24px line grid) | **SHIPS** *(dots, 20px)* | `WorkflowCanvas.tsx:1591-1595`; `canvasGround.ts:24-33` — `BackgroundVariant.Dots`, gap 20, size 1. The sheet's colours are explicitly declined (`WorkflowCanvas.tsx:1585-1590`): "they are that sheet's palette, and this repo's config does not carry them." |
| Node card: 240×72 compact horizontal row | **SHIPS** | `PhaseNodeCard.tsx` — `"mx-auto flex w-[240px] items-start gap-2 rounded border bg-card p-4 text-left"`; ported from this sheet's markup, replacing 137-B's 248px centred frosted card. |
| Node: 24px icon well on the LEFT | **SHIPS** | `PhaseNodeCard.tsx` `data-testid="canvas-icon-well"` — `relative grid h-6 w-6 shrink-0 place-items-center`, glyph at `text-[18px]`. `NodeIconWell.tsx` (the old floating 62px disc) was DELETED by this port. |
| Node: 13px title, truncated | **SHIPS** | `PhaseNodeCard.tsx` — `truncate text-[13px] font-medium leading-tight text-foreground`. |
| Node: 11px supporting line (`Initial retrieval step`, `Entity extraction` …) | **SHIPS** | `PhaseNodeCard.tsx` `subtitle` slot; source `phaseVocabulary.ts:228-242` `PHASE_TYPE_SUBTITLES` (7 entries). |
| Node: hover changes the border | **SHIPS** | `PhaseNodeCard.tsx` — `hover:-translate-y-1 hover:border-muted-foreground`, Builder mode only (`reading === null`). |
| Violet shield corner mark, top-right (node 1) | **SHIPS** | `NodeCornerMarks.tsx:24` — the ⛨ governance seal at top-right, fed by the card's `grounded` slot (`:130`). |
| Hexagonal branch node (`clip-path: polygon(...)`) | **NEW** | `grep -rn "clip-path\|clipPath\|hexagon\|polygon("` over `frontend/src` (excluding tests) → **0 matches**. Every node renders as a rounded rectangle. Would require a per-type node shape in `PhaseNodeCard` + edge-anchor geometry that survives it. |
| Branch condition text on the branch node (`Over £2m?`) | **BE-NEEDED** | A branch line DOES render — `PhaseNodeCard.tsx` `condition` slot (`data-testid="canvas-node-condition"`), sourced `canvasModel.ts:424` `branchConditionOf(phase, resolveName)`. But it is derived from `validators[].on_failure: "skip_to_phase:<slug>"` and worded as the TARGET STEP'S NAME. **There is no author-written predicate field anywhere**: `harness.py:333` `ValidatorSpec` carries no condition expression, and `PhaseFormPanel.tsx` `OrderRail`'s docblock states it outright — *"`phase_index` IS the order: there is no `depends_on`, and branching is not representable in the definition at all."* |
| Branch node border pulse (`.animate-border-pulse`) | **NEW** | `grep -n "animate-" PhaseNodeCard.tsx` → the card's suite asserts the ABSENCE of an animation utility on this element. Presentation only — but ⚠ it is run-tense motion on a draft; `PhaseNodeCard.tsx` records the standing rule "Motion on this canvas keys off RUN STATE and never off anything else." |
| Edge — `at rest` (2px, border colour) | **SHIPS** | `connectionState.ts:87` `CONNECTION_STATE_DELTA["at-rest"] = {}` (deliberately empty, so a shipped canvas renders byte-identically). |
| Edge — `selected` (2px, brand) | **SHIPS** | `connectionState.ts:88` `{ stroke: "hsl(var(--primary))", strokeWidth: 3 }`; wired `WorkflowCanvas.tsx:973-975` (`selectedEdgeId`). |
| Edge — `hovered` (light neutral) | **SHIPS** | `connectionState.ts:89` `{ stroke: "hsl(220 30% 100% / 0.72)", strokeWidth: 2.5 }`; wired `WorkflowCanvas.tsx:1554` `onEdgeMouseEnter`. |
| Edge — `not taken` (dashed, dim) | **SHIPS** | `connectionState.ts:90` — empty delta by design; the shipped `EDGE_STYLE[skip]` has been `strokeDasharray: "5 4"` since Phase 183. |
| Marching-ants animation on the active edge (`.animate-march`) | **NEW** | `grep -n "animate\|march\|dashoffset" FlowEdge.tsx` → no stroke animation. Presentation only. |
| `running` text label riding the edge (`<textPath>`) | **NEW** *(and refused)* | The two shipped edge labels are `FlowEdge.tsx:227` `DETOUR_ARMED_LABEL = "you say yes"` and `:235` `DETOUR_OPEN_LABEL = "nobody is asked"`. ⚠ A run word on this sheet is a fabricated claim — the header on this same sheet says `draft` / `Save draft`. |
| Two outgoing lanes from one node (nodes 4 + 5 fan out of node 3, rejoining at node 6) | **BE-NEEDED** | The definition has no branch model — `phase_index` order plus at most one dashed `skip_to_phase` per validator (`PhaseSpineGraph.tsx:205-214` builds `skipEdges` from exactly that). Needs a real outcome model on `PhaseSpec`: a condition + N labelled outcome targets. |
| Per-lane label (`High risk path` / `Standard path`) | **BE-NEEDED** | Same gap. Today these positions carry `PHASE_TYPE_SUBTITLES`, which is a fact about the step KIND, not about which lane it sits on. |
| Semantic lane glyphs (`warning` on the risk lane, `check_circle` on the routine lane) | **NEW** | The node glyph is per-TYPE, not per-outcome: `soulData.ts:57-65` `PHASE_GLYPHS` (7 entries, keyed on `phase_type`). |
| Untaken lane node dimmed (`opacity-70`) | **NEW** | `grep -n "opacity-" PhaseNodeCard.tsx` → no node-level dimming. The `skipped` run reading (`runVocabulary.ts:84`) claims neither border nor opacity — `RUN_READING_BORDER` (`:380-384`) has exactly three members. |
| Third-party app logos on nodes (Slack, Google Drive, Jira SVGs) | **NEW** | `frontend/src/lib/providerLogo.ts:85-95` `MARKS` covers LLM providers ONLY (openai, anthropic, google, deepseek, moonshot, zhipu, minimax, openrouter, ollama, lmstudio). `grep -rn "Slack\|GoogleDrive\|Jira"` over `frontend/src` (non-test) → prose + one API host constant only (`ConnectionPicker.tsx:119` `SLACK_FIXED_DESTINATION`). No app mark exists anywhere. |
| Connector node subtitle naming the destination (`Posts a message to Slack`, `Files the report in Google Drive`, `Raises a ticket in Jira`) | **FE-WIRING** | The binding IS on the wire — `harness.py:277` `connection_id: str \| None` on `ExternalActionPhaseConfig` — and the client can read it: `frontend/src/lib/api.ts:6259-6268` `GET /connectors/connections` (`backend/app/api/connectors.py:277`). What is missing is a threaded id→name map: `phaseVocabulary.ts:586-590` `EXTERNAL_CAPABILITY_SENTENCES` is deliberately destination-free (`"Posts a message"`), and `canvasModel`'s `NameContext` (`phaseVocabulary.ts:599-604`) carries `folderNames` / `skillNames` and **no connection map**. |
| `CHANGES SOMETHING OUTSIDE` banner (9px, bold, wide-tracked, warning tone) | **SHIPS** | `nodeEffectBanner.ts:64` `EFFECT_BANNER_OUTSIDE`; rendered `PhaseNodeCard.tsx` at `data-testid="canvas-effect-banner"`, `text-[9px] font-bold tracking-wider text-warning`. |
| `ONLY READS` banner (same shape, dim tone) | **BE-NEEDED** | Documented decline, `nodeEffectBanner.ts:16-36`: *"all three of its members — `send_email`, `create_ticket`, `post_message` — are WRITES. There is no capability, no column and no flag anywhere on the wire that could resolve a step to `ONLY READS`."* Dated re-open trigger recorded there. Needs a read/write bit (or a non-mutating capability) on `ExternalActionPhaseConfig`. |
| 84px three-line node (the connector cards) | **SHIPS** | `PhaseNodeCard.tsx` `RUN_MODE_NODE_MIN_HEIGHT = 84`; the card grows downward from `CANVAS_LAYOUT.NODE_MIN_HEIGHT` in Builder mode, so a third line already produces the sheet's own 84px. |
| Floating controls: `−` / `+` zoom | **SHIPS** | `WorkflowCanvas.tsx:1598` `<Controls showInteractive={false} />` (xyflow zoom-in / zoom-out). |
| Zoom readout `100%` | **FE-WIRING** | xyflow exposes the zoom (`useReactFlow().getZoom()`, `onMove`) and the canvas already sets `minZoom={0.3} maxZoom={2}` (`WorkflowCanvas.tsx:1510-1511`). `grep -n "100%\|getZoom\|zoomLevel" WorkflowCanvas.tsx` → **0**. Nothing renders a percentage. |
| Fit-to-view control | **SHIPS** | `<Controls>`' fitView button, plus `fitView` + `fitViewOptions={{ padding: 0.1, minZoom: 0.3 }}` at `WorkflowCanvas.tsx:1508-1509`. |
| `Lock canvas` control | **FE-WIRING** *(deliberately suppressed)* | The library ships it; `WorkflowCanvas.tsx:1596-1598` removes it on purpose — `showInteractive={false}`, with the reason at `:139-152` ("without it read-only is two clicks deep"). Re-enabling is a prop flip; the sheet's separate lock semantics would need a decision. |
| Legend strip: `at rest` · `selected` · `hovered` · `not taken` | **SHIPS** | `WorkflowCanvas.tsx:1609-1631` `data-testid="canvas-connection-legend"`, bottom-right, `aria-hidden`, swatches carrying weight + dash; words from `connectionState.ts:70-75` `CONNECTION_STATE_WORD`. |

**Summary — `builder-canvas.html`: SHIPS 24 · FE-WIRING 3 · BE-NEEDED 4 · NEW 7** (38 rows).
Everything that is a *face* is ported. Everything missing is either the **branch model** (four rows)
or **presentation the project has refused** (shape variation, run-tense motion, app logos).

---

## `node-identity.html`

⚠ This is a **catalogue sheet**, not a product screen — it draws swatches, not a surface. Its
page chrome is enumerated for completeness and classified honestly.

| Sheet element | Bucket | Evidence |
|---|---|---|
| Page title `The step node` | **NEW** | Sheet chrome — a catalogue heading with no product surface behind it. `grep -rn "The step node" frontend/src` → 0. |
| Subtitle `Every kind, every state, one sheet.` | **NEW** | `grep -rn "Every kind, every state" frontend/src` → 0. Same. |
| Section heading `Shape carries what kind of thing it is` | **NEW** | `grep → 0`. Catalogue chrome. |
| Shape 1 — rounded rectangle, `Does work` | **SHIPS** | `PhaseNodeCard.tsx` — the single card shape, `rounded border bg-card`. |
| Shape 2 — notched rectangle + 4px violet left bar, `Waits for a person` | **NEW** | `grep -rn "clip-path\|notched"` over `frontend/src` → 0. No per-type shape; no violet left bar (`grep -n "895AF6\|violet" PhaseNodeCard.tsx nodePresentation.ts` → one prose mention only, `nodePresentation.ts:94`). |
| Shape 3 — hexagon, `Chooses next` | **NEW** | Same grep → 0. And there is no "chooses next" step kind (see the branch rows on the canvas sheet). |
| Caption `Shape tells you the kind. The mark inside tells you which one.` | **NEW** | `grep → 0`. |
| Section heading `The kinds that exist today` | **NEW** | `grep → 0`. Catalogue chrome. |
| Kind — `Find renewing` / `Searches & decides move` (search glyph) | **SHIPS** | `llm_agent`. `phaseVocabulary.ts:231` `"Searches and decides its own next move"`; glyph `soulData.ts:60` `compass`. |
| Kind — `Check contracts` / `Runs step over items` (repeat glyph) | **SHIPS** *(different words)* | `llm_batch_agents`. `phaseVocabulary.ts:232` `"Several assistants work in parallel"`; glyph `soulData.ts:61` `handshake`. ⚠ The sheet words it as a LOOP; the product's is a FAN-OUT. Same type, different claim. |
| Kind — `Draft summary` / `Writes in single pass` | **SHIPS** | `llm_single`. `phaseVocabulary.ts:230` `"Writes one piece in one pass"`; glyph `soulData.ts:59` `memo`. |
| Kind — `Work out totals` / `Fixed calculation, no AI` | **SHIPS** | `programmatic`. `phaseVocabulary.ts:229` `"A fixed step the server runs"`; glyph `soulData.ts:58` `gear`. |
| Kind — `Confirm before` / `Waits for a person` (notched + violet + person glyph) | **SHIPS** | `llm_human_input`. `phaseVocabulary.ts:233` `"Pauses here until you answer"`; glyph `soulData.ts:62` `raised-hand`. The notch and the violet bar: `grep → 0` (see shape rows above). |
| Kind — `Grade the draft` / `Scores against rubric` (grading glyph) | **BE-NEEDED** | **There is no judge/grade step type.** `backend/app/models/harness.py` declares exactly seven config classes (`:67 ProgrammaticPhaseConfig`, `:76 LlmSinglePhaseConfig`, `:92 LlmAgentPhaseConfig`, `:109 LlmBatchAgentsPhaseConfig`, `:128 LlmHumanInputPhaseConfig`, `:138 LlmEmitPhaseConfig`, `:172 ExternalActionPhaseConfig`), mirrored by exactly seven keys in `soulData.ts:57-65` and `phaseVocabulary.ts:249-262`. The shipped judge is a **validator on** a step (`backend/app/services/harness/validator_kinds.py`), never a step. Needs an eighth `PhaseSpec` config member + an executor. |
| Kind — `Produce brief` / `Makes finished file` | **SHIPS** | `llm_emit`. `phaseVocabulary.ts:234` `"Fills your template and produces the file"`; glyph `soulData.ts:63` `package`. |
| Kind — `Post to Slack` / `Acts on another app` (forum glyph) | **SHIPS** | `external_action`. `phaseVocabulary.ts:241` `"Stops for your approval before it acts outside"`; glyph `soulData.ts:64` `outbox-tray` — **ours**, not Slack's. No app logo exists (see the canvas sheet's logo row). |
| Corner tag `OUTSIDE` (top-right, amber, `rounded-bl`) | **SHIPS** *(different placement)* | The shipped carrier is a BODY banner, not a corner tag: `nodeEffectBanner.ts:64` `EFFECT_BANNER_OUTSIDE = "CHANGES SOMETHING OUTSIDE"`, rendered under the subtitle (`PhaseNodeCard.tsx`, `canvas-effect-banner`). ⚠ The card's top-right corner is already claimed by the ⛨ governance seal (`NodeCornerMarks.tsx:24`). |
| Caption `A step that touches another application wears that application's own mark. Everything else wears ours.` | **NEW** | `grep → 0`. `nodeEffectBanner.ts:9-13` quotes this sentence and ships only its WORD half — "the half that survives a connector whose logo we do not ship." |
| Section heading `Interaction States` | **NEW** | `grep → 0`. Catalogue chrome. |
| State — `At rest` | **SHIPS** | `PhaseNodeCard.tsx` border ternary, default arm `"border-border"`. |
| State — `Hovered` (border lift **and** `-translate-y-1`) | **SHIPS** | `PhaseNodeCard.tsx` — `"transition-[transform,border-color] duration-150 hover:-translate-y-1 hover:border-muted-foreground"`. ⚠ Both halves; `199-01` had shipped the fill only and its refusal is preserved in that file's comment as OVERRULED by this sheet. |
| State — `Selected` (primary border) | **SHIPS** | `PhaseNodeCard.tsx` — `"border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]"`. |
| State — `Moving` (`opacity-50` + dashed border) | **NEW** | `grep -rn "isDragging\|dragging" PhaseNode.tsx PhaseNodeCard.tsx phaseNodeCardContract.ts` → one prose mention (`PhaseNode.tsx:446`), no visual. Drag itself exists (`WorkflowCanvas.tsx:1493-1494` `onNodeDragStart` / `onNodeDragStop`; `nodesDraggable={false}` on the read-only render, flipped on in editing mode per `:141-144`) — the card just never changes appearance while it moves. |
| State — `Needs attention` (amber 4px left bar) | **SHIPS** *(different carrier)* | The card already carries a per-node problem mark on its LEFT edge, in three kinds: `nodePresentation.ts:221 / 226 / 231` `VERDICT_MARK` (`✕` / `○` / `?`), fed by `phaseNodeCardContract.ts` `verdict` and rendered by `NodeCornerMarks.tsx:162`. It straddles the border at `left-[-1px]`. Not an amber bar, but the same job, on the same edge. |
| State — `Locked` (lock glyph + muted fill) | **NEW** *(as a node state)* | No node lock treatment: `grep -n "locked\|Locked" phaseNodeCardContract.ts NodeCornerMarks.tsx` → one prose hit. The nearest shipped thing is the ⛨ grounded seal (`NodeCornerMarks.tsx:24`), which is a GOVERNANCE mark, and `harness.py:403` `grounding_escalated` (a one-way step-level lock) — neither dims a node nor draws a padlock. |
| Section heading `Run States` | **NEW** | `grep → 0`. Catalogue chrome. |
| Run state — `Waiting` (`opacity-50`) | **SHIPS** | `runVocabulary.ts:80` `"not-started": "Not started"` — rendered as the run line at every reading. `RUN_READING_BORDER` (`:380-384`) has three members and `not-started` is not one; nothing dims the card. |
| Run state — `Running` (pulsing border, primary word) | **SHIPS** | `runVocabulary.ts:81` `running: "Running"`; `:381` `running: "border-primary"`; the motion is the ring's infinite `canvas-ring-spin` in `NodeRunOverlay.tsx`. |
| Run state — the `00:15` elapsed on the running node | **FE-WIRING** | Every piece exists and is used one surface over. **Data:** `backend/app/api/workflow_runs.py:114 started_at` / `:125 completed_at` (mig `supabase/migrations/121_workflow_phases_timings.sql:122-123`, applied). **Formatter:** `frontend/src/lib/fmtElapsed` via `phaseDuration.ts:65,267` (`timeRunning(fmtElapsed(now - startedAt))`). **Consumer:** the SPINE (`PhaseSpineGraph.tsx` `node-run-time`, gated on the `runTense` prop). `PhaseNodeCard` has no such slot — `grep -n "elapsed\|duration" PhaseNodeCard.tsx phaseNodeCardContract.ts` → 0 — and no caller supplies one. |
| Run state — `Worked` (green `border-l-4`) | **SHIPS** | `runVocabulary.ts:82` `done: "Complete"`. `done` deliberately does NOT claim the border — `RUN_READING_BORDER` (`:380-384`) is `running` / `waiting-for-you` / `failed` only. |
| Run state — `Failed` (red tinted background + border) | **SHIPS** | `runVocabulary.ts:83` `failed: "Failed"`; `:383` `failed: "border-destructive"`. No background tint on the card. |
| Run state — `Not taken` (dashed border + `opacity-60`) | **SHIPS** | `runVocabulary.ts:84` `skipped: "Skipped"`; claims no border and no opacity. |
| Run state — `Waiting for you` (notched + violet bar) | **SHIPS** | `runVocabulary.ts:85` `"waiting-for-you": "Paused for your answer"`; `:382` `"border-[hsl(var(--warning))]"` — warning, not violet; and no notch (shape grep → 0). |
| *(bonus, not on the sheet)* two further shipped readings — `unknown`, `recorded-not-sent` | **SHIPS** | `runVocabulary.ts:86-87`. Noted so a future port does not read this sheet's six as the complete set: the product carries **eight**. |

**Summary — `node-identity.html`: SHIPS 20 · FE-WIRING 1 · BE-NEEDED 1 · NEW 12** (34 rows).
⚠ The NEW count is high because **every one of the twelve is pure presentation or catalogue
chrome** — seven sheet headings/captions with no product surface behind them, two node shapes, and
three state treatments (`Moving`, `Locked`, and the notch). Where a run state's WORD ships and only
its TREATMENT differs, the row is counted **SHIPS** and the delta is named in its evidence cell.
The only real capability gaps are the **judge/grade step kind** (BE) and the **per-node elapsed** (FE).

---

## `builder-spine.html`

An **AUTHORING** surface — `draft` / `Save draft` / `Publish...` in its own header, and the tab
strip says `View only — this is the order it will run in.` It draws **no per-step timing**
(measured; see the correction at the top). It DOES draw two run controls, flagged below.

| Sheet element | Bucket | Evidence |
|---|---|---|
| Left nav rail (same eight + Account) | **SHIPS** | `frontend/src/lib/nav-items.ts:31-60`; `ChatLayout.tsx:578`. |
| Header: `← Workflows` | **SHIPS** | `BuilderHeaderBar.tsx` `lead` ← `headerLead` (`WorkflowBuilderPage.tsx:2599`). |
| Header: hairline divider | **SHIPS** | `BuilderHeaderBar.tsx:70-72` `builder-header-seam`. |
| Header: workflow title `Quarterly review` | **SHIPS** | `WorkflowBuilderPage.tsx:2532-2534 / 2545-2549`. |
| Header: `draft` | **SHIPS** | `WorkflowBuilderPage.tsx:2550-2552`. |
| Header: folder chip `📁 DBA` | **SHIPS** | `WorkflowBuilderPage.tsx:2272-2286` `kbAffordance` — `data-testid="builder-bound-folder"`, `📁` + a `<select>` (`project-folder-picker`) bound to `meta.project_folder_id`. Gated on `canvasEnabled`. |
| Header: `Save draft` | **SHIPS** | `WorkflowBuilderPage.tsx:2560-2568` → `BuilderSaveRegion`. |
| Header: `Publish...` | **SHIPS** | `WorkflowBuilderPage.tsx:2574-2576` → `PublishGauntlet`. |
| Tab strip: `Spine` (active, underlined) / `Canvas` | **SHIPS** | `WorkflowBuilderPage.tsx:2153-2194`. |
| Quiet right-aligned line `ⓘ View only — this is the order it will run in.` | **SHIPS** *(split, and inside the spine)* | Character-complete across two nodes: `👁 View only` badge (`PhaseSpineGraph.tsx:~240`, the shipped cross-surface vocabulary also at `WorkflowCanvas.tsx:1000` and `WorkflowRunPage.tsx:960`) + `PhaseSpineGraph.tsx:145` `SPINE_ORDER_SENTENCE = "This is the order it will run in."` rendered at `data-testid="graph-order-sentence"`. ⚠ Placed inside the spine, not on the tab row. |
| Dashed vertical rule down the left, behind the cards | **SHIPS** | `PhaseSpineGraph.tsx:~347-352` — `absolute left-[28px] top-[34px] bottom-0 z-0 w-px border-l border-dashed border-border`, suppressed on the last node. |
| Step card: 56px bordered icon gutter with a ringed 24px glyph | **SHIPS** | `PhaseSpineGraph.tsx:~378-388` — `flex w-14 shrink-0 justify-center border-r border-border bg-muted/30 pt-4` wrapping `grid h-6 w-6 place-items-center rounded-full border`. |
| Step title, 13px, truncated | **SHIPS** | `PhaseSpineGraph.tsx:~396-401` `data-testid="node-title"`, from `nodeTitle(phase, nameContext)`. |
| Per-step model chip, right-aligned (`GPT-4o`, `Claude Sonnet`) | **SHIPS** | `PhaseSpineGraph.tsx:~404-411` `data-testid="node-model"`. ⚠ Renders ONLY where `config.model` is a non-blank string (`:323-325`) — an absent model means *use the run's model*, and the sheet's `GPT-4o` is placeholder text. |
| One-line supporting reading (`Searches the knowledge base and decides its own next move`) | **SHIPS** | `PhaseSpineGraph.tsx:~415-421` `data-testid="node-subtitle"` ← `phaseVocabulary.ts:228-242` `PHASE_TYPE_SUBTITLES`. |
| Uppercase type badge (`AI AGENT`, `ONE-SHOT WRITER`) | **SHIPS** *(different words)* | `PhaseSpineGraph.tsx:~425-434` `data-testid="node-type-word"` ← `phaseVocabulary.ts:249-262` `PHASE_TYPE_LABELS` (`AI agent step`, `AI write step`, `Server step`, `Parallel agents`, `Needs you`, `Deliverable`, `External action`), uppercased by CSS so there is still one spelling in the tree. |
| Hover: row background lifts, icon ring turns primary | **SHIPS** | `PhaseSpineGraph.tsx:~370` `hover:bg-accent/40` + `:~382` `group-hover:border-primary/50 group-hover:text-primary`. |
| Selected: primary border + 1px ring, primary icon ring | **SHIPS** | `PhaseSpineGraph.tsx:~368-372` — `border-primary bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]`, `aria-pressed`. |
| Selected step EXPANDS in place, dashed top-border detail block | **NEW** | `grep -n "expand\|disclosure\|open" PhaseSpineGraph.tsx` → nothing; a spine row is a single `<button>` whose whole subtree is fixed. Selection opens the side PANEL instead (`onSelectNode` → `PhaseFormPanel`). |
| Detail label `WHAT IT IS TOLD TO DO` + the prompt inline | **FE-WIRING** | `grep -rn "WHAT IT IS TOLD TO DO" frontend/src` → **0**. The value is already in hand (`phase.config.prompt`, the same object the spine sorts) and is rendered one component over as `Instructions` (`PhaseFormPanel.tsx:1167`). The spine has no slot and no caller asks for one. |
| Detail label `HOW LITERAL IT SHOULD BE` + value `Very literal` | **FE-WIRING** *(the words would be new copy)* | `grep -rn "Very literal" frontend/src` → **0**. The underlying value ships as a raw number — `PhaseFormPanel.tsx:1180-1188` `TextField label="Creativity"` over `config.temperature`. Turning a temperature into a worded scale is a new vocabulary leaf, not new data. |
| Logic-fork marker: rotated square + `Which way this goes` | **NEW** | `grep -rn "Which way this goes" frontend/src` → **0**. The spine's only non-linear affordance is a one-line skip-edge row (`PhaseSpineGraph.tsx:~450-470`, `data-testid="skip-edge"`). |
| Left lane `THIS WAY` badge | **BE-NEEDED** | `grep -rn "THIS WAY" frontend/src` → **0**, and the model cannot express it: `PhaseSpineGraph.tsx:205-214` builds edges only from `validators[].on_failure` parsed by `parseSkipTarget`, and `PhaseFormPanel.tsx` `OrderRail` records *"branching is not representable in the definition at all."* Needs labelled outcome targets on `PhaseSpec`. |
| Left lane condition `If the draft needs a person` | **BE-NEEDED** | `backend/app/models/harness.py:333` `ValidatorSpec` carries no condition-expression field; `on_failure` is a `skip_to_phase:<slug>` string only. |
| Left lane target title `Confirm the QBR before rendering` | **FE-WIRING** | The spine's skip row prints the RAW SLUG — `PhaseSpineGraph.tsx:~464-467`, `on fail → skip to <span className="font-mono">{edge.toSlug}</span>`. The name resolver already exists and the CANVAS uses it: `canvasModel.ts:424` `branchConditionOf(phase, resolveName)` resolves the same target to `nodeTitle`. One call away. |
| Right lane `NOT THIS WAY` badge, dimmed + dashed, `If it does not`, `Fill the QBR template` | **BE-NEEDED** | Same missing branch model. A "not taken" LANE is a second outcome target; today an unfired skip edge is simply the absence of a jump, with nothing to render. |
| Step 4: violet `wait-border` left edge | **NEW** | `grep -n "895AF6\|violet\|border-l-" PhaseSpineGraph.tsx` → **0**. The spine spends no per-type colour; every type badge is primary-toned. |
| Step 4: person glyph in the gutter ring | **SHIPS** | `soulData.ts:62` `llm_human_input: "raised-hand"`, resolved by `phaseGlyph()` at `PhaseSpineGraph.tsx:~310`. |
| Step 4: badge `WAITS FOR A PERSON` | **SHIPS** *(different words)* | `phaseVocabulary.ts:253` `llm_human_input: "Needs you"`. |
| Step 4: detail `Someone has to approve this before it continues.` | **SHIPS** *(different words, different slot)* | `phaseVocabulary.ts:233` `llm_human_input: "Pauses here until you answer"` — rendered as the row's subtitle rather than inside a detail block. |
| Step 4: `Approve` / `Send back` buttons | **FE-WIRING** *(and dead on THIS surface)* | The answer seam ships end-to-end: `frontend/src/lib/api.ts:1234` `answerAskUser(run_id, {tool_call_id, response_text, choice_index})`, driven by `frontend/src/components/panel/PendingAskCard.tsx:304`. The AUTHOR-side choices are authored at `PhaseFormPanel.tsx:1301-1310` (`options` — "Choices to offer the person"). ⚠ On the authoring spine there is no run and no `tool_call_id`, so these would be dead controls; the honest mount is the RUN spine (`PhaseSpineGraph.runTense`). |
| Step 5: `output` glyph + badge `PRODUCES THE FILE` | **SHIPS** *(different words)* | `soulData.ts:63` `llm_emit: "package"`; `phaseVocabulary.ts:254` `llm_emit: "Deliverable"`. |
| Divider label `How a workflow can end` | **NEW** | `grep -rn "How a workflow can end" frontend/src` → **0**. |
| Terminal card A: `Fill the report template` / `Produces the finished file` / footer `Ends by making a file` | **NEW** *(the card; the FACT ships)* | `grep -rn "Ends by making a file" frontend/src` → **0**. The underlying derivation exists: `soulData.ts:172` `soulDeliverable(def)` returns `kind: "file"` with a label, and `terminalEmitSlug` names the producing step (`soulData.ts:~231`). Nothing composes a terminal explainer on the spine. |
| Terminal card B: `Answer in the chat` / `Writes the answer straight into the conversation` / footer `Ends by answering` | **NEW** *(the card; the FACT ships)* | `grep -rn "Ends by answering" frontend/src` → **0**. `soulData.ts:168` records `kind: "chat"` as "the LOCKED honest fallback — never a fabricated deliverable." |
| Caption `A workflow ends one way or the other. Both are complete.` | **NEW** | `grep → 0`. |
| Connector rows 7/8/9: Google Drive / Slack / Jira images in the gutter ring | **NEW** | No app marks exist — `frontend/src/lib/providerLogo.ts:85-95` `MARKS` is LLM providers only; `grep -rn "Slack\|GoogleDrive\|Jira"` over `frontend/src` (non-test) → prose + `ConnectionPicker.tsx:119` only. ⚠ The sheet's three `<img>` srcs are `lh3.googleusercontent.com` URLs, which a CSP-clean build could not use anyway. |
| Connector subtitles naming the destination (`Saves the file to Google Drive`, `Posts a message to Slack`, `Creates an issue in Jira`) | **FE-WIRING** | Binding is on the wire (`harness.py:277` `connection_id`) and readable (`frontend/src/lib/api.ts:6259` `GET /connectors/connections`); `phaseVocabulary.ts:586-590` `EXTERNAL_CAPABILITY_SENTENCES` is destination-free by design and `NameContext` (`phaseVocabulary.ts:599-604`) carries no connection map. |
| Badge `CHANGES SOMETHING OUTSIDE` on a spine row | **FE-WIRING** | `nodeEffectBanner.ts:64 / 72` `effectBannerFor()` ships and is TOTAL over phase type — but `grep -rn "effectBannerFor" frontend/src` returns exactly **two** consumers, both in `PhaseNodeCard.tsx:114,186`. The spine imports it nowhere. |
| Badge `ONLY READS` | **BE-NEEDED** | Documented decline with a dated re-open trigger, `nodeEffectBanner.ts:16-36` — all three capabilities in the closed set are writes; no wire field distinguishes a read. |
| `＋ Add Step` dashed pill at the foot of the spine | **FE-WIRING** *(refused by this component's contract)* | The insert seam ships on the CANVAS: `PlaneEditingLayer.tsx:208-211` `data-testid="canvas-insert-N"`, opening `StepTypePicker.tsx`. The spine refuses it structurally — `PhaseSpineGraph.tsx:15-19`: *"there is NO `draggable` attribute, NO drag handler …, NO connection handle, and NO add-node control anywhere in the DOM."* Adding it means re-opening a locked read-only contract, not building a capability. |
| Footer sentence `5 steps, runs top to bottom, one person gate` | **SHIPS** | `PhaseSpineGraph.tsx:157-162` `spineFooterSentence(stepCount, personGates)` → `data-testid="graph-footer-count"` (`:~268-275`), counting `llm_human_input` phases. The zero case omits the clause rather than printing `0 person gates`. |
| *(not on this sheet, but shipped)* per-step run readings — timing + declared count + branch outcome | **SHIPS** | `PhaseSpineGraph.tsx:~437-447` `data-testid="node-run-reading"` / `node-run-time` / `node-run-count`, plus `skip-edge-reading` (`:~470-480`), all gated on the optional `runTense` prop. ⚠ The AUTHORING mount (`WorkflowBuilderPage.tsx:2136`) passes nothing, which is what keeps `199-02`'s refusal intact by construction. |

**Summary — `builder-spine.html`: SHIPS 24 · FE-WIRING 7 · BE-NEEDED 4 · NEW 8** (43 rows).
The row FACE is fully ported. Everything outstanding is the **branch model** (4 BE rows + the fork
marker), the **terminal-ends explainer** (3 NEW rows), and **six atoms that are one import away**.

---

## COMBINED TOTALS — four sheets, 161 rows

| | SHIPS | FE-WIRING | BE-NEEDED | NEW |
|---|---|---|---|---|
| `step-panel.html` (46) | 37 | 4 | 5 | 0 |
| `builder-canvas.html` (38) | 24 | 3 | 4 | 7 |
| `node-identity.html` (34) | 20 | 1 | 1 | 12 |
| `builder-spine.html` (43) | 24 | 7 | 4 | 8 |
| **TOTAL** | **105** | **15** | **14** | **27** |

**65% of what these four sheets draw already renders in the product** (105 of 161). Of the 27 `NEW`
rows, **20 need no data and no endpoint** — seven sheet headings/captions, three node shapes, six
state treatments, two edge animations, and two section labels. The decision-bearing remainder is
small: `running` on an authoring edge (a refusal), per-outcome lane glyphs and a dimmed untaken
lane (both blocked on the branch model), third-party app logos (assets), and the spine's
terminal-ends explainer.

⚠ **Counting rule, so a re-derive lands on the same number.** Each row carries exactly ONE bucket.
Where a sheet atom's WORD ships and only its visual TREATMENT differs — e.g. `Worked` ships as the
reading `Complete` but claims no green edge — the row is **SHIPS** and the delta is named in its
evidence cell. Re-derive by counting the bucket cell of every table row under the four `##` sheet
headings.

---

## THE BE-NEEDED LIST — the 14 rows that gate any further building

Grouped, because four of them are one gap.

### ① The branch model — 6 rows across two sheets, ONE missing capability
Today: `phase_index` is the order, and the only non-linear edge is `validators[].on_failure =
"skip_to_phase:<slug>"` (`backend/app/models/harness.py:333` `ValidatorSpec`; parsed by
`phaseVocabulary.parseSkipTarget`). `PhaseFormPanel.tsx`'s `OrderRail` states it plainly:
*"branching is not representable in the definition at all."*

1. **`builder-canvas` — two outgoing lanes from one node.** Needs labelled outcome targets on `PhaseSpec`.
2. **`builder-canvas` — per-lane label** (`High risk path` / `Standard path`).
3. **`builder-canvas` — author-written branch predicate** (`Over £2m?`). No condition field exists on `PhaseSpec` or `ValidatorSpec`.
4. **`builder-spine` — `THIS WAY` lane.**
5. **`builder-spine` — lane condition** (`If the draft needs a person`).
6. **`builder-spine` — `NOT THIS WAY` lane.**

> Until this lands, the hexagon shape (`NEW`) and the fork marker (`NEW`) have nothing to draw.

### ② External-action capabilities — 4 rows
The closed set is three writes: `backend/app/models/harness.py:251`
`capability: Literal["send_email", "create_ticket", "post_message"]`.

7. **`step-panel` — `Writes to your database` capability.** New `Literal` member + executor + a `EXTERNAL_CAPABILITY_SENTENCES` entry.
8. **`step-panel` — `Sends a Slack message`** as a distinct capability (nearest live: `post_message` → `"Posts a message"`).
9. **`builder-canvas` — `ONLY READS` banner.** Needs a read/write bit, or a non-mutating capability. Documented decline + dated re-open trigger: `nodeEffectBanner.ts:16-36`.
10. **`builder-spine` — `ONLY READS` badge.** Same field.

### ③ Per-folder governance — 2 rows
`folder_scope` is a bare `list[UUID] | None` at `backend/app/models/harness.py:85 / 104 / 123 / 160`.
The shipped lock (`grounding_escalated`, `:403`) is STEP-level.

11. **`step-panel` — per-folder `Lock` button.** Needs a lock record: holder + timestamp, per folder per step.
12. **`step-panel` — `Locked — only the person who locked it can release it`.** Same record; the sentence needs a HOLDER identity to be true.

> ⚠ This also unblocks the `Add a source` FE-WIRING row — which is itself half-BE: writing
> `folder_scope` on a workflow with no `project_folder_id` raises a raw 422
> (`_folder_scope_requires_project`), which under D-186-04 leaves a permanently unsaveable draft.

### ④ Two standalone gaps
13. **`step-panel` — three files in one step's `Files it starts from`.** One template per step today: `TemplateAttachSection.tsx:6` uses `assets.find(a => a.kind === "template")`. Needs a template LIST on the definition and an executor that reads it.
14. **`node-identity` — the `Grade the draft` / `Scores against rubric` step kind.** There are exactly seven `PhaseSpec` config classes (`harness.py:67-251`), mirrored by seven keys in `soulData.PHASE_GLYPHS` and `phaseVocabulary.PHASE_TYPE_LABELS`. The shipped judge is a VALIDATOR on a step (`backend/app/services/harness/validator_kinds.py`), never a step. Needs an eighth union member + an executor.

---

## Cheapest wins, for sequencing (the 16 FE-WIRING rows, all data already on the wire)

| Row | Sheet | One-line fix |
|---|---|---|
| `CHANGES SOMETHING OUTSIDE` on a spine row | spine | `import { effectBannerFor }` — `grep` shows exactly 2 consumers, both in `PhaseNodeCard.tsx`. |
| Skip-edge target shows the step's NAME | spine | The canvas already resolves it via `canvasModel.ts:424 branchConditionOf`; the spine prints `edge.toSlug`. |
| `Choose a model ›` / `Connect a knowledge source ›` checklist rows | step-panel | One `gaps.push` each in `stepReadinessContext.ts` — both currently refused, with reasons. |
| Zoom `100%` readout | canvas | xyflow already exposes it; `minZoom`/`maxZoom` set at `WorkflowCanvas.tsx:1510-1511`. |
| `Lock canvas` control | canvas | `showInteractive={false}` at `WorkflowCanvas.tsx:1598` → flip. |
| Per-node elapsed `00:15` | node-identity | `phaseDuration.ts` + `fmtElapsed` + `started_at` all ship; the SPINE consumes them, `PhaseNodeCard` has no slot. |
| Destination-named connector subtitles | canvas + spine | `harness.py:277 connection_id` + `api.ts:6259 GET /connectors/connections`; thread a connection map into `NameContext`. |
| `WHAT IT IS TOLD TO DO` / `HOW LITERAL IT SHOULD BE` on a selected spine row | spine | Both values are on the phase the spine already holds; the second needs a worded scale (new copy leaf). |
| Canvas dimming while the panel is open | step-panel | Same grid; nothing dims. |
| `Approve` / `Send back` | spine | `api.ts:1234 answerAskUser` + `PendingAskCard.tsx:304` ship — but mount on the RUN spine, never the authoring one. |
| `＋ Add Step` on the spine | spine | Seam ships on the canvas (`PlaneEditingLayer.tsx:208`); the spine's read-only contract refuses it — a decision, not a build. |
| `+ Add a source` | step-panel | Write seam exists; blocked by the 422 above (see ③). |
