---
phase: 189
slug: governed-external-action-node-model
status: draft
shadcn_initialized: true
preset: none (pre-existing shadcn install — `frontend/components.json`, style `default`, baseColor `slate`, cssVariables true, iconLibrary `lucide`)
created: 2026-08-07
---

# Phase 189 — UI Design Contract

> The visual and interaction contract for the **governed external-action node**. Every decision
> below is either LOCKED upstream (D-01 … D-22) or taken here under `## Claude's Discretion` with
> its reasoning. This document is prescriptive: an executor should be able to implement from it
> without re-deriving a number, a word or a shape.

**What 189 adds to the screen, in one paragraph.** A seventh step type appears in the picker with
its own 3D mark and tint. On the canvas its card carries one new word-badge — **"Not connected"** —
in the last free badge slot. Its face says what it does, derived from the chosen capability
("Sends an email" / "Creates a ticket" / "Posts a message"). In the side panel it gets a capability
picker in its own component, and the arming switch beside it is ON and refuses to move. At run time
the step reaches a sixth, honest terminal — **"Not sent — recorded"** — carried by a new ring shape,
a new word, and a phase-output body that reads unmistakably as *not sent*.

**Note on the GSD brand reference.** `.claude/get-shit-done/references/ui-brand.md` exists but
describes GSD's *CLI output* patterns (stage banners, checkpoint boxes). It has no bearing on this
app's UI and is not applied here. The binding visual authority is the Aether Deep Midnight theme
(`frontend/src/index.css .dark`) plus the sketch-findings references named throughout.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | **shadcn** (pre-existing — `frontend/components.json`) |
| Preset | none — the install predates 189; style `default`, baseColor `slate`, `cssVariables: true`, no prefix |
| Component library | Radix (via shadcn `@/components/ui`) — **189 adds no shadcn component** |
| Icon library | Three, by domain: `@iconify-json/fluent-emoji@1.2.7` (phase-type 3D marks, 3174 icons — measured) · `@lobehub/icons` (providers, not used here) · `lucide` (chrome, not used here) |
| Font | Inter (body) · Manrope (`font-headline` — the card title) · JetBrains Mono (`font-mono` — technical lines) |
| Theme | Aether **Deep Midnight** (`.dark`) — the only theme the canvas is designed against |

**189 installs nothing.** No npm package, no shadcn block, no registry. See `## Registry Safety`.

---

## 1 · Surface inventory

Split by cost, because the six-file card subtree is fenced by `?raw` source guards and a
`toHaveLength(6)` path pin, and everything else is not.

### 1a · The fenced card subtree — **NOT TOUCHED. That is the point.**

`PhaseNodeCard.test.tsx:100-107` declares `CARD_SUBTREE_PATHS`; `:113` joins them into
`cardSubtreeSource`; `:545` pins the list at exactly **6**. Seventeen negative fences and four
haystacks read that string.

| File | Lines | Why 189 does not touch it |
|---|---|---|
| `PhaseNodeCard.tsx` | 274 | It already renders `badges?: BadgeSlots` (`:249-264`). A new badge is DATA, not layout. |
| `phaseNodeCardContract.ts` | 214 | `BadgeSlots` (`:104`) already admits two. 189 fills slot 1; the type does not change. |
| `NodeCornerMarks.tsx` | 272 | Top-right is the ⛨ seal's (`:266`), and `external_action` is not in `GROUNDING_DIAL_TYPES`, so it carries no seal at all. Nothing to change. |
| `NodeRunOverlay.tsx` | 319 | ⚠ **ONE EXCEPTION** — `RING_STROKE` (`:134`) is `Record<CanvasReading, string>` and is TYPECHECK-FORCED by the 8th reading. One row added, nothing else. |
| `NodeIconWell.tsx` | 167 | It renders an already-resolved `icon` + `tint`. The 7th glyph and tint are resolved by the adapter. |
| `ownProperty.ts` | 86 | Zero-import leaf; read, never edited. |

⇒ **`CARD_SUBTREE_PATHS` stays at 6 and its `:545` pin does not move.** If a plan proposes a seventh
module in this directory-subtree, that is the signal to stop and re-read §C11 of RESEARCH — the
subtree is already +67.1 % (797 → 1332 L) and 189 has no refactor budget.

### 1b · The callers — where 189's frontend work actually lands

| File | What 189 adds | Forced by the compiler? |
|---|---|---|
| `frontend/src/types/index.ts:1020` | `"recorded-not-sent"` on `Phase["status"]` | — (the source of the forcing) |
| `frontend/src/lib/phaseState.ts:41` | `DB_PHASE_STATUS.recorded_not_sent → "recorded-not-sent"` | ❌ silent |
| `frontend/src/lib/phaseState.ts:87` | the 8th `CanvasReading` member | — (the source) |
| `frontend/src/lib/phaseState.ts:122` | one `case` arm in `canvasReading` | ❌ silent (`default:` absorbs it as `unknown`) |
| `frontend/src/lib/phaseGlyph.tsx:42-47,:60` | 1 import + 1 `PHASE_GLYPH_MARKS` entry | ❌ silent — **but a missing slug FAILS THE BUILD** |
| `components/workflows/soulData.ts:43` | 1 `PHASE_GLYPHS` entry | ❌ silent — ⚠ **same commit as `phaseGlyph.tsx`** (`phaseGlyph.tsx:34`) |
| `components/workflows/nodePresentation.ts:83` | 1 `ICON_TINT` entry | ❌ silent, pinned by `PhaseNodeCard.test.tsx:796` (`toHaveLength(6)`) |
| `components/workflows/runVocabulary.ts:61` | `RUN_READING_WORD["recorded-not-sent"]` — **the D-16 sentence's home** | ✅ FORCED |
| `components/workflows/runVocabulary.ts:170` | `STATIC_CLAUSE` row (value `null` — see §3) | ✅ FORCED |
| `components/workflows/runVocabulary.ts:239` | `RUN_READING_BORDER` — **deliberately left UNSET** (`Partial<>`) | ❌ silent, correct to omit |
| `components/workflows/runVocabulary.ts:313` | `RING_GEOMETRY` — **the 8th shape, §4** | ✅ FORCED |
| `components/workflows/NodeRunOverlay.tsx:134` | `RING_STROKE` row | ✅ FORCED |
| `components/workflows/phaseVocabulary.ts:152/:162/:176` | the three per-type map entries (§6) | ❌ silent |
| `components/workflows/phaseVocabulary.ts:516` | the new `derivedFace` tier (§6) | ❌ silent |
| `components/workflows/phaseVocabulary.ts` (new export) | `notConnectedOf(phase)` (§2) | — |
| `components/workflows/canvasModel.ts:121` | `PhaseNodeData.notConnected: boolean` | ❌ silent |
| `components/workflows/canvasModel.ts:285-302` | one line in `buildPhaseData` | ❌ silent |
| `components/workflows/canvasModel.ts:201-203` | ⚠ **PROSE CORRECTION ONLY** (D-21) | — |
| `components/workflows/PhaseNode.tsx:214-220` | the badge object + the tuple expression (§2) | ❌ silent |
| `components/workflows/definitionOps.ts:63/:76/:828/:874` | `PhaseTypeId`, `PHASE_TYPE_ORDER`, `SLUG_BASE`, `requiredConfigFor` | ✅ `SLUG_BASE` + the switch are FORCED; the union + ORDER are not |
| `components/workflows/definitionOps.ts` (new export) | ONE new refusal constant (§7, and see `## ⚠ CONFLICTS` 1) | — |
| `components/workflows/GovernanceSection.tsx:285-316` | the arming switch's refusing state (§7) | ❌ silent |
| `components/workflows/PhaseFormPanel.tsx:168` | `PHASE_TYPE_FRIENDLY` entry | ❌ silent |
| `components/workflows/PhaseFormPanel.tsx` (~`:1043`) | **ONE gated line** mounting `ExternalActionSection` (§7) | ❌ silent |
| `components/workflows/ExternalActionSection.tsx` | **NEW FILE** — the capability picker (§7) | — |
| `components/panel/PhaseCard.tsx:89` | `STATUS_META` row | ✅ FORCED |
| `components/panel/PhaseTimeline.tsx:57` | one `milestoneFor` arm | ❌ silent |

### 1c · Explicitly NOT touched, and why that is the design

| Surface | Decision |
|---|---|
| `WorkflowCanvas.tsx` | The badge and the reading both arrive on `data`. The G-5 hot file gets **zero** diff. |
| `FlowEdge.tsx` | **No ghost-detour edge** (D-21). The `GhostMarks` branch stays shipped and stays unreachable. |
| `NodeCornerMarks.tsx` (the ⛨ seal) | `external_action` is not in `GROUNDING_DIAL_TYPES` and its capabilities are disjoint from `KB_TOOLS`, so `groundingCauseOf` returns `null` and the node carries **no seal**. **That is correct, not a bug** — an external-action step reads no knowledge base and therefore has nothing to prove. Its governance reading is the armed edge + the D-18 badge. |
| `components/panel/PhaseCard.tsx` `PHASE_TYPE_LABEL` (`:43`) | **DECLINED, and the declination is recorded.** The table holds only 5 entries (`llm_emit` was already declined) and degrades an unmapped type to `UNKNOWN_PHASE_META` = *"Step"*. Adding a 7th would invent a panel vocabulary for a type the panel never gained one for. `STATUS_META` is a different table and is NOT declinable — it is typecheck-forced. |
| `WorkflowRunPage.tsx` `readBand` (`:265-306`) | Reads `workflow_runs.status`, not a phase status. A run containing a recorded-not-sent phase still **completes**, so the band reads *"✓ Complete"*. See `## ⚠ CONFLICTS` 5 — accepted, with the shipped F3 argument. |
| `themes/canvas-184.css` | 137-D, superseded. Never read it. |

---

## 2 · The badge contract (D-12, D-18)

### 2a · Where slot 1 sits, and who constructs the tuple

`BadgeSlots` (`phaseNodeCardContract.ts:104`) is an **ordered max-2 tuple union**:
`readonly [] | readonly [BadgeSlot] | readonly [BadgeSlot, BadgeSlot]`. Position 0 is slot 1.

**The tuple is constructed in exactly one place: `PhaseNode.tsx:214-220`.** `PhaseNodeCard` is not
edited.

```tsx
const notConnected: BadgeSlot = {
  testId: "canvas-not-connected",
  tone: "muted",
  label: "Not connected",
  dataAttr: { "data-not-connected": "true" },
}
// EXPLICIT BRANCHES, NEVER A SPREAD. `[...a, ...b]` widens BadgeSlots to BadgeSlot[]
// and silently retires the max-2 typecheck guard.
const badges: BadgeSlots = data.notConnected
  ? data.waitsForYou
    ? [notConnected, waitsForYou]   // slot 1 FIRST — the tuple is ordered
    : [notConnected]
  : data.waitsForYou
    ? [waitsForYou]
    : []
```

⚠ The two-badge branch is **unreachable from real data in 189** (`external_action` and
`llm_human_input` are different types), and it must still be written: the tuple type demands it be
representable, and the positive control for the max-2 guard needs it.

### 2b · The gating conditional

`notConnected` is resolved ONCE at projection time, following the shape every sibling field uses
(`isGrounded` `canvasModel.ts:255`, `isArmed` `:260`, `waitsForYou` `phaseVocabulary.ts:639`):

```ts
// phaseVocabulary.ts — a new named total predicate beside `waitsForYou`
export function notConnectedOf(phase: PhaseSpecJSON): boolean {
  if (phase.config.phase_type !== EXTERNAL_ACTION_PHASE_TYPE) return false
  // Phase 190 binds a destination here and this returns false. Until then nothing
  // in this app can be connected to anything, so an external-action step is always
  // not-connected. The TYPE test and the STATE test are separate lines ON PURPOSE.
  return true
}
```

`canvasModel.PhaseNodeData` gains `notConnected: boolean`; `buildPhaseData` (`:285-302`) gains one
line: `notConnected: notConnectedOf(phase),`.

### 2c · Geometry, typography and tone — against the shipped slot-2 badge

Both badges render through the SAME primitive (`StatusChip`, `PhaseNodeCard.tsx:249-264`), so
nothing below is new CSS.

| Property | Slot 1 — "Not connected" (189) | Slot 2 — "Waits for you" (shipped) |
|---|---|---|
| Element | `<span data-not-connected>` wrapping `<StatusChip>` | `<span data-waits-for-you>` wrapping `<StatusChip>` |
| Base classes | `inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium` (`StatusChip.tsx:42`) | identical |
| Tone | **`muted`** → `border-border bg-muted/40 text-muted-foreground` | `primary` → `border-primary/30 bg-primary/10 text-primary` |
| Glyph | **NONE** — `icon-convention.md` §4: *"the word-badge carries NO glyph"* | none |
| Row | `mt-2 flex flex-wrap items-center gap-1.5` — one shared row, badges in tuple order | same row |
| `data-testid` | `canvas-not-connected` | `canvas-waits-for-you` |

**Why `muted` and not `primary`.** `primary` is the live/waiting indigo and is spoken for by slot 2;
`success` would read as good news; the strong tokens are banked for Phase 188's run status.
"Not connected" is a calm design-time fact, not an alarm — `muted` is StatusChip's own
"calm terminal" tone and is the correct register. The **word** carries the meaning either way
(WCAG 1.4.1); tone is decoration.

### 2d · What happens at 190

The badge **retires by data, not by edit**: `notConnectedOf` returns `false` once a destination is
bound, the tuple expression falls to its existing branch, and `PhaseNode.tsx` is not touched. That
is the whole reason D-12 chose a state-conditional badge over a type-conditional one.

### 2e · The reservation sites that must be REWRITTEN, not deleted

All re-derived 2026-08-07.

| # | Site | Current text (abridged) | Required edit |
|---|---|---|---|
| S1 | `PhaseNodeCard.tsx:39-40` | *"Badge slot 1 stays EMPTY and RESERVED FOR PHASE 189 (D-12)"* | → *spent by 189 on the state-conditional "Not connected" badge*, and note it is passed by the adapter, not rendered specially by the card |
| S2 | `canvasModel.ts:138-139` | *"both badge slots are committed to 188/189. Badge slot 1 is deliberately EMPTY"* | → slot 1 is now SPENT; slot 2 unchanged. Also record that 188 declined its claim. |
| S3 | `NodeCornerMarks.tsx:24-27` (echoed `:217`, `:223`) | *"the freed slot belongs to 188 / 189"* | → the slot is spent; the seal's argument (governance spends no badge) is unchanged and must survive the edit |
| S4 | `PhaseNode.tsx:211` | *"Slot 1 is therefore still empty and now belongs to Phase 189 alone."* | → the paragraph becomes the record of what 189 spent it on and why the badge retires at 190 |
| S5 | `PhaseNode.tsx:259` | *"…or a badge slot 188/189 owns"* | → the budget is now FULL; a third badge is a typecheck error |
| S6 | `phaseNodeCardContract.ts:6-7` | *"189 adds a slot to a contract of this size rather than to a 797-line component"* | ⚠ **A SIXTH source site CONTEXT's list of five omits.** Update to past tense; the sentence is the record of why 188.2 cut where it did and must not be deleted |
| T1 | `PhaseNodeCard.test.tsx:2156` | *"Non-vacuity: it is a real badge row, and slot 1 is still empty and still reserved."* | ⚠ **The ASSERTION stays valid** — measured, the test passes `badges: [waitsBadge]` explicitly and asserts exactly one `[data-tone]`, which is the card's own budget test. **Only the COMMENT is falsified.** Rewrite the comment and ADD a two-badge render case as the positive control. |
| T2 | `WorkflowCanvas.test.tsx:422-423` | `describe("… Phase 185 frees slot 1")` / `it("NO phase node carries a grounding chip — slot 1 is empty and reserved")` | ⚠ **Measured, it asserts the absence of the retired GROUNDING chip specifically** (`[data-grounding]`, `[data-testid="canvas-grounding"]`) — **not the absence of any badge.** It therefore does NOT mechanically break. Rewrite the `describe`/`it` wording (which becomes misleading) and add the real 189 guard beside it: `[data-not-connected]` present on the `external_action` node and absent on **all six** other types. |

**The negative branch is falsifiable today.** `notConnectedOf` returns `false` for every one of the
six shipped types, so "the badge is absent unless the step is an external action" is driven from real
data. Only the *connected* half of the state test is unreachable until 190 — say that in the test's
own comment rather than leaving it to be discovered.

**Three invariants 189 must not break, all mechanically guarded:**
1. **No third badge** — `BadgeSlots`, control-tested with `@ts-expect-error` (RED at 34 type errors, green at 33). Re-observe the swing.
2. **No focusable control inside the card** — the badge is a `<span>` inside a `<span>`. 188.2 drove this RED against a planted `<button>`.
3. **Top-right is the seal's** — `phaseNodeCardContract.ts:196`, verbatim: *"188/189 may not take it."* The badge row is in the card body, bottom. No conflict.

---

## 3 · The status-word contract (D-07, D-16, D-17)

### 3a · Slug → status → reading → word

One value, four spellings, each in exactly one layer. **They are mechanically related, never
independently invented.**

| Layer | Home (re-derived) | Value |
|---|---|---|
| Postgres `workflow_phases.status` | migration 115 CHECK | `recorded_not_sent` (snake — D-17) |
| Wire | `api/workflow_runs.py` `status: str` | passes through untyped; description string only |
| Client status union | `types/index.ts:1020` | `"recorded-not-sent"` |
| Derivation, DB→status | `lib/phaseState.ts:41` `DB_PHASE_STATUS` | `recorded_not_sent: "recorded-not-sent"` |
| Derivation, status→reading | `lib/phaseState.ts:87` + `:122` | the 8th `CanvasReading`: `"recorded-not-sent"` |
| **Canvas word** | `runVocabulary.ts:61` `RUN_READING_WORD` | **`"Not sent — recorded"`** (D-16, verbatim) |
| Canvas clause | `runVocabulary.ts:170` `STATIC_CLAUSE` | **`null`** — see 3c |
| Panel word | `panel/PhaseCard.tsx:89` `STATUS_META` | `{ glyph: "↛", text: "Not sent", textClass: "text-panel-muted-foreground" }` |
| Panel announcer | `panel/PhaseTimeline.tsx:57` `milestoneFor` | `` `${ordinal}, ${phase.slug}, not sent` `` |

**The status member and the reading member are the SAME STRING** — `"recorded-not-sent"` — exactly as
`failed` and `skipped` already are. That is deliberate: it makes `canvasReading`'s new arm a
one-line identity and removes a place for the two unions to drift.

⚠ **A plan that puts `'Not sent — recorded'` into `workflow_phases_status_check` has misread D-17.**
The constraint takes the slug. The sentence lives 400 lines and one language away.

### 3b · The three surfaces D-07 names, and the component that owns each

| # | Surface | Component | What renders |
|---|---|---|---|
| 1 | **Canvas node** | `PhaseNodeCard.tsx:228-236` (the run line) + `NodeRunOverlay.tsx:256-293` (the ring) | `"Not sent — recorded"` as real text, plus the 8th ring shape (§4) |
| 2 | **Run surface** (the developer phase timeline in the chat thread) | `panel/PhaseCard.tsx` status atom + `panel/PhaseTimeline.tsx` announcer | `↛ Not sent` — the panel's own harness vocabulary |
| 3 | **Phase output** | the executor-authored `output.text`, rendered wherever a phase's output is read | the not-sent body block (§9c) |

**Two vocabularies is CORRECT here and is a shipped rule** (`lib/phaseState.ts:12-20`): the panel has
harness words, the canvas has business words, and only the DERIVATION is shared. 189 must not add a
second derivation, and must not re-word the panel's shipped six.

### 3c · Why the clause is `null`

`STATIC_CLAUSE`'s own rule (`runVocabulary.ts:143-149`): a clause is carried by the readings *"a
person cannot act on from the word alone"*. There is nothing for the person to do here — the approval
already happened and the run continued. And the D-16 word **already contains its own clause after an
em-dash**; appending `"— …"` would produce a two-em-dash sentence and restate the fact the badge and
the output body both carry. `null`, with that reasoning recorded in the table's comment.

### 3d · Non-collision table — checked against every word that already exists

D-07's binding constraint: *"running" and "waiting for you" may never share a word*, and the new word
must collide with neither, nor read as success.

| Existing word | Home | Collides with `"Not sent — recorded"`? |
|---|---|---|
| `Not started` | `runVocabulary.ts:62` | ❌ no — ⚠ **but it SHARES THE PREFIX `"Not "`.** A test asserting `.toContain("Not")` becomes ambiguous. **Use exact-match assertions.** |
| `Running` | `:63` | ❌ no |
| `Complete` | `:64` | ❌ no — and critically it does not read as success: the sentence opens with the negation |
| `Failed` | `:65` | ❌ no — and it must not read as failure either; nothing failed |
| `Skipped` | `:66` | ❌ no — and it must not read as skipped: the step DID run and a human DID approve |
| `Paused for your answer` | `:67` | ❌ no |
| `State unknown` | `:68` | ❌ no |
| Panel: `Locked · Running · Complete · Failed · Attempt · Skipped · Unknown` | `panel/PhaseCard.tsx:89-112` | ❌ `Not sent` collides with none |
| Run band: `● Running · Paused for your answer · Paused at the step limit · ✓ Complete · ✕ Failed · ⊘ Cancelled · State unknown` | `WorkflowRunPage.tsx:265-306` | ❌ no — and see `## ⚠ CONFLICTS` 5 |
| Badge slot 2: `Waits for you` | `PhaseNode.tsx:217` | ❌ no |
| Badge slot 1: `Not connected` (189) | §2 | ⚠ **shares the token `Not`** with the run word. They are on the same card at the same time. **Accepted and deliberate**: the badge is a DESIGN-TIME property (*this step cannot reach anything yet*), the run word is a RUN-TIME state (*this run did not send*). They differ in tense and object, exactly as `Waits for you` / `Paused for your answer` were required to (D-188-05). The suite must assert both strings render simultaneously and are not equal. |

### 3e · The fail-closed baseline, measured

Before any vocabulary exists, `phaseStatusFromDb("recorded_not_sent")` misses the own-property guard
→ `"unknown"` → `canvasReading` `default:` → `"unknown"` → **`"State unknown"`**, and
`WorkflowRunPage.tsx:302` says *"State unknown — this run reported a state we don't recognise."*
**Never "Complete."** This means migration 115 may land before the client vocabulary without the UI
ever lying — a genuine wave-ordering freedom, and the guard that must not regress.

---

## 4 · The 8th ring reading — the one genuinely open visual decision

`RING_GEOMETRY` (`runVocabulary.ts:313`) carries a **BUILD CRITERION**, not a preference
(`:294-312`, verbatim): *"The arc geometry IS the state; colour only ever reinforces it… with colour
switched off every reading must still be identifiable, and each row below is unique in a property a
test can assert."* An 8th reading owes an 8th shape.

### 4a · The seven shipped shapes, re-derived, with their rendered numbers at `r = 34` (`C = 213.628`)

| Reading | Spec | dasharray | dashoffset | Its unique property |
|---|---|---|---|---|
| `not-started` | `{kind:"none"}` | *(no arc element)* | — | the only reading with **NO arc** |
| `running` | `fraction` d .26 / g .74 · ×1 · centre `null` · **spinning** | `55.543 158.085` | `0` | the only one that **moves**; statically the only **short single arc** |
| `done` | `{kind:"solid"}` | *(none emitted)* | `0` | the only **closed, unbroken** ring |
| `failed` | `fraction` d .42 / g .08 · ×2 · centre .375 | `89.724 17.090 89.724 17.090` | `18.158` | the only ring snapped into **two** arcs |
| `skipped` | `{kind:"length"}` 5 / 7 | `5 7` | `0` | evenly dashed all the way round, **coarse** (~18 dashes) |
| `waiting-for-you` | `fraction` d .74 / g .26 · ×1 · centre .75 | `158.085 55.543` | `25.636` | the only ring with **ONE wide gap, at 12 o'clock** (the pause chip sits in it) |
| `unknown` | `{kind:"length"}` 1.5 / 6 | `1.5 6` | `0` | the only **dotted** ring — fine and sparse |

### 4b · **THE 8TH — `recorded-not-sent`** *(Claude's Discretion — decided here)*

```ts
"recorded-not-sent": {
  kind: "fraction",
  arc: { dash: 0.15, gap: 0.10, repeats: 4, gapCentre: 0.125 },
  spinning: false,
},
```

| Property | Value |
|---|---|
| dasharray at `r = 34` | `32.044 21.363 32.044 21.363 32.044 21.363 32.044 21.363` |
| dashoffset | `16.022` — computed by `ringDash` as `round3(d + g/2 − gapCentre·C)` = `32.044245 + 10.681415 − 26.703538` |
| Drawn fraction | **60 %** (4 × 0.15) |
| Element size | four **32.0 px** arcs separated by four **21.4 px** gaps |
| Gap clock positions | 4:30 · 7:30 · 10:30 · 1:30 |
| Animation | **NONE.** `spinning: false`, explicitly. The run is over for this phase; only `running` moves, and that is `running`'s own uniqueness property. |

**Its assertable unique property: it is the only reading drawn in FOUR arcs.** The emitted
`stroke-dasharray` names four dash/gap pairs; every other `fraction` row names one or two, `solid`
emits none, and the two `length` rows emit an unbounded texture. A test counts the pairs — that is a
machine check, not an eyeball.

**Why it survives greyscale, stated per neighbour:**

| Against | Separated by |
|---|---|
| `done` (closed ring) | 40 % of the ring is missing in four visible 21 px gaps. **This is the confusion that mattered most** — `recorded-not-sent` must never read as success — which is precisely why a *near-closed ring with one small notch* was rejected: it maximises confusability with the one reading it must be most distinct from. |
| `failed` (2 arcs) | count 4 vs 2, and arc length 32 px vs 89.7 px (2.8×). ⚠ Note two of my four gap centres (`.375`, `.875`) coincide with `failed`'s two — that is a value coincidence on the same 45° lattice, not a shape collision; the count and the arc length carry the distinction. |
| `running` (1 short arc) | count 4 vs 1. Holds under `prefers-reduced-motion`, when the spin is off and `running`'s "only one that moves" property is unavailable — which is exactly the case a length-based distinction would have failed. |
| `waiting-for-you` (1 wide gap at 12) | count 4 vs 1, and **no gap of mine lands at 12 o'clock** (0.75). The nearest are 60° away, so the pause chip's quadrant stays that reading's alone. |
| `skipped` (5/7 texture) | element size 32 px vs 5 px (6.4×) — chunky arcs against a fine texture. |
| `unknown` (1.5/6 dots) | element size 32 px vs 1.5 px (21×). |
| `not-started` (no arc) | an arc is drawn at all. |

**Why `repeats: 4` and not `3`.** Every shipped row tiles the circle **exactly**
(`repeats × (dash + gap) === 1`), so no seam appears at the path start. Three repeats require
`dash + gap = 1/3`, which is not expressible in the 2-decimal style the table uses and leaves a
sub-pixel seam. `4 × (0.15 + 0.10) = 1.00` exactly. **Add that invariant as an assertion over the
whole table** — it is currently true of all seven rows and asserted nowhere.

**Why `gapCentre: 0.125`.** `0.125` is unclaimed (claimed: `null`, `0.375`, `0.75`), it puts the four
gaps on the 45° diagonals so none sits on a cardinal point, and it keeps the computed dashoffset
**positive** (`16.022`) like every shipped row — `gapCentre: 0` or `0.25` would have produced the
table's first negative offset, which renders identically but invites a reviewer's question for no
gain.

### 4c · The stroke

```ts
// NodeRunOverlay.tsx:134 RING_STROKE
"recorded-not-sent": "hsl(var(--muted-foreground))",
```

**Why muted, and not a new colour.** The table's own rule: *"Colour REINFORCES; it never carries."*
`--success` would claim success. `--destructive` would claim failure — nothing failed.
`--warning` (amber) means *needs-you / paused*, and would say the person is still required when the
person has already answered. `--primary` means live. `--muted-foreground` is the calm-terminal token
`skipped` and `unknown` already share, and a duplicate token is established precedent in this table.
The SHAPE carries the distinction; that is the build criterion.

### 4d · The border

`RUN_READING_BORDER` (`runVocabulary.ts:239`) is a `Partial<Record<…>>` and **`recorded-not-sent` is
deliberately left OUT.** Only the three loud readings (`running`, `waiting-for-you`, `failed`) claim
the card border; the quiet ones stay quiet so the loud two keep pulling the eye. Record the absence
in the table's docblock beside the four existing ones — it is an editorial decision, not an omission.

---

## 5 · The 7th glyph and its tint

### 5a · The slug — **`outbox-tray`** 📤

**Verified against the INSTALLED set, this session, not inherited:**

```bash
node -e "const d=require('./node_modules/@iconify-json/fluent-emoji/icons.json'); …"
# @iconify-json/fluent-emoji  version 1.2.7   ·   3174 icons
# outbox-tray        PRESENT
# outbox             ABSENT      ← the empty-icon trap; never try it
```

| Candidate | Verdict |
|---|---|
| **`outbox-tray`** | ✅ **CHOSEN.** Semantically *"leaves here / goes outside"* — the type's nature, not any one capability. Distinct in silhouette from all six shipped marks (gear · memo · compass · handshake · raised-hand · package). |
| `satellite-antenna` | ✅ present — second choice, kept on file |
| `envelope`, `envelope-with-arrow`, `incoming-envelope` | ❌ **capability-specific.** The mark is keyed by `phase_type`, so it is ONE mark for the type, not three. An envelope would say *email* on a node whose capability might be a ticket. |
| `outbox` | ❌ **ABSENT from the set — fails the build.** |

**Presence is necessary, not sufficient** — `llm_batch_agents` shipped a slug that existed and
measured *"luminance 34.5 on Deep Midnight, ~4× dimmer than the other five, and disappeared"*
(`soulData.ts:36-40`). So the palette was measured too:

| Slug | Distinct fills | Mean luminance | Max |
|---|---|---|---|
| `handshake` (the brightest shipped) | 23 | **189.0** | 226.8 |
| `raised-hand` | 20 | 182.4 | 225.5 |
| `gear` | 18 | 175.7 | 226.5 |
| **`outbox-tray`** | 22 | **168.4** | 234.7 |
| `memo` | 28 | 164.1 | 226.1 |
| `compass` | 31 | 160.5 | 231.4 |
| `package` (the dimmest shipped) | 19 | **148.2** | 208.1 |

`outbox-tray` sits **inside the shipped band** (148.2 … 189.0) and far above the 34.5 that forced the
184 swap. ⚠ This is an unweighted palette estimate, not a rendered measurement — **U1 remains the
driven check.**

### 5b · The same-commit rule, as a build constraint

`phaseGlyph.tsx:34`, verbatim: *"Both maps below — this one and `soulData.PHASE_GLYPHS` — swapped in
the SAME commit: swapping one alone leaves `phaseGlyph()` returning the old component while the
string fallback changed, a silent split-brain."*

| Edit | File | Line |
|---|---|---|
| `external_action: "outbox-tray"` | `components/workflows/soulData.ts` | in `PHASE_GLYPHS`, `:43` |
| `import OutboxTray from "~icons/fluent-emoji/outbox-tray"` + `external_action: OutboxTray` | `lib/phaseGlyph.tsx` | imports `:42-47`, map `:60` |

**BOTH, or NEITHER, in one commit.** The fence is `soulData.test.ts` (`:131-148`, currently asserting
the six keys individually) — extend it to assert the two maps have **identical key sets**, which is
the split-brain guard stated as a property rather than as six comparisons.

### 5c · The tint *(Claude's Discretion — decided here)*

```ts
// nodePresentation.ts:83 ICON_TINT
external_action: "hsl(310 85% 66% / 0.38)",
```

Type colour is a **tint behind the icon ONLY** — never a card wash (137-B; Phase 188 needs the strong
colours for run status). The shipped hues are 200 · 220 · 239 · 170 · 38 · 258; the reserved status
hues are 239 (primary), 142 (success), 38 (warning), 0 (destructive). The two largest unused gaps are
**258 → 360** and **38 → 142**. The second is rejected: its midpoint (~90, lime) sits adjacent to the
`--success` family and would read as a success cue behind an icon. **310 (magenta)** is the midpoint
of the first — 52° from `llm_emit`'s violet 258 and 50° from destructive 0/360, its two nearest
neighbours. Alpha `0.38` is inside the shipped range (0.22 … 0.40).

⚠ `PhaseNodeCard.test.tsx:796` pins `Object.keys(ICON_TINT)` at **6** — move it to 7 in the same
commit.

---

## 6 · The vocabulary ladder (D-13)

### 6a · Tier 2 — the capability-derived face

`derivedFace` (`phaseVocabulary.ts:516-580`) is a **numbered, most-specific-first ladder** whose
order is itself a decision (D-187-04). 189 inserts one tier:

```ts
/** The three capabilities, and what each STEP does. Closed set — a name not in it
 *  falls through, and NEVER fabricates. */
const EXTERNAL_CAPABILITY_SENTENCES: Record<string, string> = {
  send_email:    "Sends an email",
  create_ticket: "Creates a ticket",
  post_message:  "Posts a message",
}
const EXTERNAL_ACTION_PHASE_TYPE = "external_action"
```

Placed as **tier (4)**, renumbering HUMAN INPUT → (5) and the null floor → (6):

```
(1) BOUND SKILL           → `Run the ${skillName}`                       — ungated
(2) TEMPLATE              → `Fill ${templateFilename}`                   — GATED on llm_emit
(3) FOLDER SCOPE          → `Search ${folderName}`                       — GATED on GROUNDING_DIAL_TYPES
(4) EXTERNAL CAPABILITY   → "Sends an email" / "Creates a ticket" / "Posts a message"
                            — GATED on phaseType === "external_action"   ← NEW
(5) HUMAN INPUT           → "Wait for your approval"                     — GATED on llm_human_input
(6) otherwise NULL        → the honest floor; the caller falls to the type sentence
```

**Why (4) and not RESEARCH's suggested `(3.5)`.** Tiers 1-3 all read a NAME out of injected
`NameContext` and can therefore fabricate; tiers 4 and 5 read the config alone and cannot. The
capability tier is a sibling of HUMAN INPUT, not of the three name tiers, so it belongs immediately
above it — and a decimal tier defeats the ordering test the numbering exists to force (a `3.5`
invites a `3.75`).

**Two things the source already demands:**
- The gate is a **named module-scope constant** (`EXTERNAL_ACTION_PHASE_TYPE`), following
  `HUMAN_INPUT_PHASE_TYPE` (`:454`) — never an inline literal.
- ⚠ **`GROUNDING_DIAL_TYPES` (`:277`) is READ and NEVER edited** (`:551`, a D-185-15 red line).
  `external_action` must not be added to it.

**The lookup is a WR-04 sink.** `capability` reaches this map from author-supplied JSONB, so it must
be own-guarded. ⚠ **`phaseVocabulary.ts` has ZERO import statements** (measured — only prose mentions
imports). Adding `import { own } from "./ownProperty"` would make it the file's first import ever.
Follow the `runVocabulary.ts:84-88` precedent instead — an inline
`Object.prototype.hasOwnProperty.call(...)` guard, the same form `nodePresentation.ts:128` uses for a
single lookup. `DerivedFaceInputs` gains `capability?: string`; `derivedFaceOf` (`:595`) reads
`config.capability` behind a `typeof === "string"` guard and declares no branch of its own.

### 6b · Tiers 3 and below — the per-type maps

| Map | Home | 189's entry | Why |
|---|---|---|---|
| `PHASE_TYPE_SENTENCES` (the tier-3 floor — **what users actually see**) | `phaseVocabulary.ts:152` | **`"Reach outside"`** | Matches the register of the shipped six ("Check with you", "Write it up"). Says the step's nature without claiming a specific act, which is exactly what the floor is for when no capability is chosen. It is also CONTEXT's own phrase for this node (*"this step reaches outside"*). |
| `PHASE_TYPE_SUBTITLES` (the ONE supporting line) | `:162` | **`"Stops for your approval before it acts outside"`** | Carries the type's one invariant fact (D-04). ⚠ Deliberately **survives Phase 190** — it says nothing about *not sending*, so it will not become a lie when the node starts sending. The not-sent fact is carried by the badge (design time) and the run word (run time), which is where D-12/D-16 put it. |
| `PHASE_TYPE_LABELS` (the ⌥ Technical-names vocabulary) | `:176` | **`"External action"`** | The reveal renders `` `${label} · ${slug}` `` → `External action · notify-owner`. |
| `PhaseFormPanel.PHASE_TYPE_FRIENDLY` (the panel header chip — a LOCAL 6-entry duplicate) | `PhaseFormPanel.tsx:168` | **`"External action"`** | Same word. The one shipped divergence in this map ("Needs a person" vs "Needs you") is not a licence to invent a second. |

### 6c · What the ⌥ reveal changes

The reveal swaps the **SUBTITLE**, never the title (149-C, D-187-16), and the swap already happens in
`PhaseNode.tsx:266`. So on an external-action node:

| ⌥ off | ⌥ on |
|---|---|
| title `Sends an email` · subtitle `Stops for your approval before it acts outside` | title `Sends an email` · subtitle `External action · notify-owner` |

**No new wiring.** `technicalLine` stays unspent — it is Phase 188's declined slot and 189 does not
claim it either (see §9a for the card-height consequence of not doing so).

### 6d · The step-type picker gets this for free

`StepTypePicker.tsx:185-186` renders each row as a **preview of the card**: `nodeTitle(minimalPhaseFor(type…))` + `PHASE_TYPE_SUBTITLES[type]` + `renderPhaseMark(type)` behind
`ICON_TINT[type]` (`:219`). So the row for the 7th type reads
**`Reach outside` / `Stops for your approval before it acts outside`** with the 📤 mark on the
magenta tint — with **zero picker-specific copy**. That is by construction, and it is the reason no
picker vocabulary is specified here.

⚠ `PHASE_TYPE_ORDER` (`definitionOps.ts:76`) is a fixed presentation tuple, and *"the picker's third
option moved"* is a UX regression a test catches. **Append `external_action` LAST**, after
`llm_emit` — no shipped position changes.

---

## 7 · The authoring surface

### 7a · `ExternalActionSection.tsx` — a NEW file, and `PhaseFormPanel` gets ONE gated line

This honours the shape Phase 185 proved and the hot-file ledger records verbatim: *"Keep this shape —
the next surface that needs the panel gets its own component and one gated line."* 185's whole-phase
diff on `PhaseFormPanel.tsx` was 23 insertions / 6 deletions, of which **only 4 insertions reached
the render body**.

**The mount** — beside the existing per-type branches, before the `</div>` at `PhaseFormPanel.tsx:1044`:

```tsx
{pt === "external_action" && (
  <ExternalActionSection capability={asStr(cfg.capability)} onChange={set("capability")} onPersist={onPersist} />
)}
```

**The component's contract, copying `GovernanceSection.tsx`'s own rules verbatim:**
- **It authors NO sentence of its own.** Every user-visible string is an identifier imported from
  `definitionOps.ts`, and its suite asserts character-identity against those names. A sentence inside
  a component is a sentence nobody can test for drift (T-187-10-05).
- **It consults no server and names no route.** A `?raw` fence proves it, with a positive control.
- **The option set is a closed THREE** — but the client renders the picker from server-supplied
  options where one exists, per `PhaseFormPanel.tsx:483` (*"THE OPTION SET IS THE SERVER'S… There is
  no frontend [source]"*). ⚠ D-20 keeps the three capability names **out of `GroundingBundle.tools`**
  on purpose, so if no server-supplied capability list ships in 189 the picker's three labels come
  from a closed client constant — **and that constant must be the same `EXTERNAL_CAPABILITY_SENTENCES`
  the node face reads**, never a second copy.
- Presentational and caller-driven: no context, no fetch, no store reference.

### 7b · The picker's states

| State | What renders |
|---|---|
| **Nothing chosen yet** | Three radio-style rows, none selected, under the heading **"What this step does outside"**. Below them, one honest note: **"Nothing is sent yet — this step records what it would do."** The canvas face falls to the tier-3 floor (`Reach outside`). |
| **`send_email` chosen** | That row selected. The canvas face becomes **`Sends an email`** on the next commit — derived at render, written nowhere. |
| **`create_ticket` chosen** | as above → **`Creates a ticket`** |
| **`post_message` chosen** | as above → **`Posts a message`** |
| **An unrecognised value in stored JSONB** | The own-guard misses, `derivedFace` falls THROUGH to the type sentence (`Reach outside`), and the picker shows **no** row selected. **Never fabricate a face for a capability the client does not know.** |

Reuse the shipped panel form primitives (`SelectField` / the segmented-chip idiom the relationships
picker uses) rather than authoring a new control. Three options do not warrant a combobox.

### 7c · The arming switch beside it — ON, and refusing

`GovernanceSection.tsx:285-316` renders the action-risk switch on **every** step type. For
`external_action` it must render **ON and non-interactive**, because D-04 makes the value structurally
`true` and a control that can be pressed but changes nothing is a lie.

**Reuse the 142-B refusal SHAPE, verbatim** — it already exists three feet away in the same file:

| Element | Shipped source | 189's use |
|---|---|---|
| The refused visual | `DIAL_BUTTON_REFUSED` (`:150-151`) — `cursor-not-allowed line-through opacity-[0.42]` | ⚠ do **not** strike through the ON switch — see below |
| `disabled` + `aria-disabled` | the loose dial button `:218-219` | on the arm switch when `phaseType === "external_action"` |
| The reason as **real DOM text**, wired by `aria-describedby` | `:222` + `:255-259` (`REFUSAL_CLASSES`) | identical — **never a `title` attribute** (the 184-07 lesson) |

**The visual state, precisely.** The switch renders in its ON position (`aria-checked="true"`, the
amber track `bg-[hsl(38_92%_60%/0.55)]` at `:304`), with `aria-disabled="true"`, `disabled`, and
`cursor-not-allowed`. It is **not** struck through and **not** dimmed to 0.42 — striking through a
control that is stating a TRUE and ACTIVE fact would read as "this protection is off". Strike-through
is 142-B's treatment for the *refused option*, not for the *enforced one*.

**The refusal sentence — ONE new `definitionOps.ts` constant** (see `## ⚠ CONFLICTS` 1 for why
authoring it is unavoidable):

```ts
/** Why the arming switch cannot be turned off on an external-action step (189 / D-04).
 *  The SHAPE is 185's refusal; the sentence is new because 185 authored none about arming. */
export const ACTION_RISK_LOCKED_REFUSAL =
  "This step reaches outside your workspace, so it always stops and asks you first. That cannot be switched off."
```

Rendered in `REFUSAL_CLASSES` (`:155-158`), the same amber block the grounding refusal uses, wired by
`aria-describedby` from the switch. `ACTION_RISK_ARMED_NOTE` (`:501`) still renders beneath it
unchanged — it says what arming *costs*; the new constant says why it *cannot be removed*.

### 7d · The grounding dial on this type — absent, and that is correct

`external_action` is not in `DIAL_TYPES` (`GovernanceSection.tsx:90`) and its three capabilities are
disjoint from `KB_TOOLS`, so the section renders `GROUNDING_NOTHING_TO_PROVE` = **"Nothing to prove
here"** (`definitionOps.ts:469`). That is the shipped, correct reading — the findings record names
*"a connector — it performs an action and makes no claim"* as exactly this case. **Do not add a
grounding dial, and do not treat the missing ⛨ seal as a bug.**

⚠ **One prose correction 189 owes in the same commit** — see `## ⚠ CONFLICTS` 4.

---

## 8 · The states matrix — the node card

Columns are what a person sees. `↔` means unchanged from the shipped card.

| State | Glyph + tint | Title (tier) | Subtitle | Badge slot 1 | Badge slot 2 | Ring | Run line | Border | Seal |
|---|---|---|---|---|---|---|---|---|---|
| **Not configured** (type chosen, no capability) | 📤 on magenta | `Reach outside` (tier 6 → type sentence) | `Stops for your approval before it acts outside` | **`Not connected`** | — | none (Builder) | none | default `border-border/50` | none |
| **Configured, not connected** (the 189 steady state) | 📤 on magenta | `Sends an email` (tier 4) | as above | **`Not connected`** | — | none (Builder) | none | default | none |
| **Selected** (Builder) | ↔ | ↔ | ↔ | ↔ | — | none | none | `border-primary` + ring shadow | none |
| **Running** | ↔ | ↔ | ↔ | **`Not connected`** (still) | — | 1 short arc, **spinning**, `--primary` | `Running` | `border-primary` | none |
| **Awaiting approval** (the armed checkpoint) | ↔ | ↔ | ↔ | **`Not connected`** | — | 1 wide gap at 12 o'clock, `--warning`, + the two-rectangle **pause chip** | `Paused for your answer — it needs your reply before it can continue` | `border-[hsl(var(--warning))]` | none |
| **Recorded, not sent** (189's terminal) | ↔ | ↔ | ↔ | **`Not connected`** | — | **4 arcs, `--muted-foreground`, still** | **`Not sent — recorded`** | **unchanged** (quiet state — no border claim) | none |
| **Failed** | ↔ | ↔ | ↔ | **`Not connected`** | — | 2 arcs, `--destructive` | `Failed — this step did not finish` | `border-destructive` | none |

**Two consequences that must be stated rather than discovered:**

1. **The badge persists through the run.** `notConnected` is design-time data and `PhaseNode` builds
   the badge tuple regardless of run mode, so an external-action node carries `Not connected` while
   it is running and after it has recorded. That is honest (the node genuinely is not connected) and
   it is why §3d requires the badge and the run word to coexist without reading as a duplication.

2. **⚠ The card is TALLER than its neighbours.** It is the only card carrying a badge **and** a
   two-line subtitle. Rough budget at 248 px wide: `pt-42` + title ≈ 17 + `mt-1` 4 + subtitle ≈ 30
   (two lines at 11 px `leading-snug`) + run line 4 + ≈ 15 + badge row `mt-2` 8 + ≈ 22 + `pb-20`
   ≈ **162 px**, against the run-mode floor of 120 (`PhaseNodeCard.tsx:104`) and the Builder floor of
   104 (`canvasModel.ts:70`). Both are `minHeight`, so the card grows downward and edges are
   unaffected (`EDGE_ANCHOR_Y` is measured from the node TOP — D-183-12). **U4 is the driven check**,
   and the acceptance is *"the spine's edge baseline does not move and no neighbour reflows"*, not
   *"all cards are the same height"*.

---

## 9 · Spacing, Typography, Color, Copywriting

### 9a · Spacing scale

189 introduces **no new spacing value**. Everything it renders reuses shipped Tailwind steps.

| Token | Value | Where 189 uses it |
|---|---|---|
| 1 | 4px | `mt-1` — subtitle and run line |
| 1.5 | 6px | `gap-1.5` — the badge row's inter-badge gap |
| 2 | 8px | `mt-2` — the badge row's top margin; `px-2` — the chip's horizontal padding |
| 5 | 20px | `px-5` / `pb-5` — the card's side and bottom padding |
| — | 42px | `pt-[42px]` — the card's top padding (D-185-17: 34 → 42, so the floating mark clears the title by 11px) |

⚠ **Measured exceptions to a strict 4-px grid, all pre-existing and all load-bearing:** `gap-1.5`
(6px), `py-0.5` (2px, the chip's vertical padding, `StatusChip.tsx:42`), `pt-[42px]`, the ring's
`top-[-31px]` and the icon well's `top-[-26px]` (**geometric derivations, not spacing** — the well is
62 px and the ring 72 px in a shared centre, so `(72 − 62)/2 = 5`; rounding either to the grid breaks
the concentricity). **189 must not "fix" any of these.**

### 9b · Typography

| Role | Size | Weight | Line height | Family | Source |
|---|---|---|---|---|---|
| Card title | 14px | 600 (`font-semibold`) | `leading-tight` (1.25) | Manrope (`font-headline`) | `PhaseNodeCard.tsx:200` — **`truncate`** |
| Card subtitle | 11px | 400 | `leading-snug` (1.375) | Inter | `:204-206` — wraps |
| **Card run line** | 11px | 400 | `leading-snug` | Inter | `:229-235` — `line-clamp-2`, `text-foreground/90` |
| **Badge label** | 11px | 500 (`font-medium`) | inherited | Inter | `StatusChip.tsx:42` |
| `technicalLine` (unspent) | 10px | 400 | `leading-snug` | JetBrains Mono | `:238-245` — declined by 188 and by 189 |
| Panel section heading | 11px | 500 | — | Inter | `GovernanceSection.tsx:202` |
| Panel note | 10.5px | 400 | `leading-snug` | Inter | `NOTE_CLASSES` `:153` |
| Panel refusal block | 12px | 400 | 1.7 | Inter | `REFUSAL_CLASSES` `:155-158` |
| Picker row | 12.5px | 400 | — | Inter | `StepTypePicker.tsx:207` |

**Four sizes on the card (14 / 11 / 11 / 10), two weights (400 / 600 + the badge's 500).** 189 adds
**no new size and no new weight.**

### 9c · Color

Deep Midnight (`frontend/src/index.css .dark`), measured.

| Role | Token | Value | 189's use |
|---|---|---|---|
| Dominant (60%) | `--background` | `216 45% 4%` | the canvas plane |
| Secondary (30%) | `--card` | `220 30% 7%` (the card renders `bg-card/30` + `backdrop-blur-sm`) | the node card, the panel |
| Accent (10%) | `--primary` | `239 100% 82%` | **reserved on this surface for: the `running` ring stroke · the `running` card border · the selected-card border + ring shadow · the "Waits for you" badge.** 189 spends NONE of it. |
| Warning | `--warning` | `38 92% 60%` | the waiting ring + border + pause chip; the arming switch's ON track; the refusal block. 189 spends it only through the **shipped** arming switch. |
| Success | `--success` | `142 71% 45%` | the `done` ring ONLY. **189 must never touch it** — that is the confusion this phase exists to prevent. |
| Destructive | `--destructive` | `0 72% 51%` | `failed` ring + border; the `error` verdict mark. 189 does not touch it. |
| Muted | `--muted-foreground` | `220 16% 65%` (≈7.7:1 on `--background`) | **189's whole colour spend**: the badge's `muted` tone and the 8th ring's stroke. |
| Type tint (new) | — | `hsl(310 85% 66% / 0.38)` | **the icon well ONLY** — never the card, never a border, never text. |

**Accent reserved for:** the four `--primary` sites listed above and nothing else. **189 introduces
exactly one new colour value — a per-type icon tint** — and otherwise spends only the calm muted
token. That is deliberate: 137-B banked the strong colours for run status and 189 is not run status.

### 9d · Copywriting contract

| Element | Copy (verbatim — these are the strings) |
|---|---|
| **Badge slot 1** | `Not connected` |
| **Run-time status word** (canvas) | `Not sent — recorded` |
| Run-time clause (canvas) | *(none — `null`)* |
| **Run-time status word** (developer panel) | `Not sent` (glyph `↛`) |
| Panel announcer | `Phase {i} of {N}, {slug}, not sent` |
| Node face — no capability chosen (tier 6) | `Reach outside` |
| Node face — capability chosen (tier 4) | `Sends an email` · `Creates a ticket` · `Posts a message` |
| Node supporting line | `Stops for your approval before it acts outside` |
| ⌥ Technical label | `External action` (renders `External action · {slug}`) |
| **Authoring — section heading** | `What this step does outside` |
| **Authoring — the three options** | `Sends an email` · `Creates a ticket` · `Posts a message` *(the SAME three strings as the node face — one constant, read twice)* |
| **Authoring — empty/no-capability note** | `Nothing is sent yet — this step records what it would do.` |
| **Arming refusal** (new `ACTION_RISK_LOCKED_REFUSAL`) | `This step reaches outside your workspace, so it always stops and asks you first. That cannot be switched off.` |
| Arming cost note (shipped, unchanged) | `When this step is reached the run stops and waits for your answer. It will not continue on its own.` |
| Governance section on this type (shipped, unchanged) | `Nothing to prove here` |
| **Destructive actions in this phase** | **NONE.** 189 deletes nothing, sends nothing and revokes nothing. No confirmation surface is specified, and a plan that adds one has misread the phase. |

**The phase OUTPUT body** *(Claude's Discretion — CONTEXT leaves the phrasing open; `<specifics>`
binds it to read unmistakably as not-sent, never as a receipt).* The executor writes `output.text` as
three blocks:

```
NOT SENT — recorded only.

What this step would have done
  Action:  Sends an email
  {resolved input key}: {value}
  {resolved input key}: {value}

No email was sent. Nothing left this workflow. This is a record of an intention,
not a receipt.
```

The closing negation is picked from a **closed table**, never improvised:

| capability | closing negation |
|---|---|
| `send_email` | `No email was sent.` |
| `create_ticket` | `No ticket was created.` |
| `post_message` | `No message was posted.` |

**Three rules the body must keep:** it opens with the negation (never with the action); it never uses
a checkmark, "done", "delivered", "sent to" or any past-tense success verb about the action itself;
and the final sentence names what the record is NOT. That is the `consequence ≠ receipt` rule the
Control Room already binds this codebase to.

---

## 10 · Accessibility and theme

| Requirement | How 189 meets it |
|---|---|
| **Never colour alone** (WCAG 1.4.1) | Every 189 signal is a WORD first: the badge is a label (no glyph), the run state is a sentence, the ring is a SHAPE whose colour only reinforces. |
| **Text contrast ≥ 4.5:1 on Deep Midnight** | The badge's `text-muted-foreground` = `220 16% 65%` ≈ **7.7:1** on `--background` (`index.css:128`, measured there). The run line is `text-foreground/90`. ⚠ **Never use `--muted-foreground-dim` for meaningful text**, and never the panel-scoped `--panel-*` tokens on the canvas (they are for `--panel-surface`). |
| **Graphic contrast ≥ 3:1** | The ring stroke is 3.5 px on the shared `hsl(var(--muted-foreground) / 0.35)` track; the 8th reading's stroke is the full-opacity muted token against it. |
| **Greyscale** | The 8th ring is identifiable by **arc count (4)** alone — §4b tabulates the separation against all seven. The badge is a word. The glyph is a shape. **Nothing 189 adds depends on hue.** |
| **One tab stop per node** | The badge is a `<span>` inside a `<span>`. No role, no tabindex, no handler. The card's own no-focusable-control walk covers it; 188.2 drove that RED against a planted `<button>`. |
| **Accessible name** | The node's `aria-label` already carries `Phase {i}: {title} ({phase_type})` (`canvasModel.ts:242-244`) and the canvas joins `runReadingLabel(...)` onto it — so a screen-reader user hears `"Not sent — recorded"` from the SAME string the sighted user reads. **Do not add a second announcement**; the ring is `aria-hidden`. |
| **The badge is announced** | It renders as real text inside the card, so it reaches the accessible tree through the card body. It carries no `aria-label` of its own — the word IS the label. |
| **Refusal reasons are real DOM text** | The arming refusal renders in a `<p id>` wired by `aria-describedby` — **never a `title`** (the 184-07 lesson, and 142-B's binding rule). |
| **Motion** | The 8th ring **does not animate**. The only animation on the card remains the `running` arc's spin, behind `prefers-reduced-motion`. ⚠ Under reduced motion the spin is off, which is exactly why §4b's separation from `running` is by arc COUNT and not by movement. |
| **Live regions** | 189 adds none. Per-node changes are never announced (a 5-phase run produces 10+ transitions); the panel's existing polite announcer gets one new `milestoneFor` sentence and nothing more. |

---

## 11 · ⚠ CONFLICTS AND TENSIONS WITH A LOCKED DECISION

Stated loudly rather than designed around. **No locked decision is re-opened.**

### 1 · D-04's *"reuse the 185 refusal vocabulary rather than authoring new copy"* is not literally satisfiable

**Measured.** `definitionOps.ts` exports eleven governance strings (`:450-502`). The only refusal
sentence is `GROUNDING_LOCK_REFUSAL` (`:490`), and it reads: *"Reading your files is what this step
is for, so it has to show where its answers came from. You can switch off the document tools below
— but that does not loosen the step, it stops it opening your files at all."* **Every clause of it
is about KB tools.** Rendered beside the arming switch on a step that reads no documents it would be
factually false.

**Resolution (mine, recorded).** The 185 **SHAPE** is reused verbatim — refused-never-hidden,
`aria-describedby`, the reason as real DOM text in `REFUSAL_CLASSES`, never a `title`. The
**SENTENCE** is one new constant, `ACTION_RISK_LOCKED_REFUSAL` (§7c), sited in `definitionOps.ts`
beside the other ten so it is testable for drift. D-04's intent — *don't invent a new refusal
mechanism* — is fully honoured; its literal wording is not, and that is stated rather than glossed.

### 2 · D-12's *"conditional on that state, not the type"* has an unreachable false branch in 189

**Measured.** No connection mechanism exists anywhere in the app (`grep -rni "\bmcp\b" backend/app`
= **0**), so `notConnectedOf` returns `true` for every `external_action` step. The badge is therefore
*de facto* type-conditional until 190.

**This does not contradict D-12**, whose stated purpose is clean retirement (*"when 190 wires the node
up the badge simply stops rendering"*). But the executor must know two things: the predicate must be
written as a TYPE test and a STATE test on **separate lines**, so 190 edits one line and
`PhaseNode.tsx` is untouched; and the falsifiable negative branch available today is the **other six
types**, which is what the test must drive.

### 3 · D-04 vs the shipped 185 rule *"a control that could never do anything is REMOVED, not disabled"*

**Measured.** `GovernanceSection.tsx:44-48` states the rule and applies it: the grounding dial is
*absent* on types that cannot satisfy it, replaced by the sentence `Nothing to prove here`. D-04
requires the arming switch to render **on and non-interactive** — i.e. disabled, the shape 142-B says
to avoid.

**Resolution (mine, recorded).** The 185 rule is really *replace a dead control with the sentence
that states the fact*. The arming switch here is not dead — it displays a value that is TRUE, ACTIVE
and the single most important thing on the panel for this type. Removing it would delete the reading,
which is precisely what 143-A forbids for the seal (*"hiding it deletes the reading at the moment it
matters most"*). So: **keep the switch, ON, non-interactive, with the reason as real DOM text** — and
do **not** strike it through, because strike-through is 142-B's treatment for a *refused option*, not
for an *enforced one*. §7c specifies the exact visual state.

### 4 · Two shipped docblocks become FALSE the moment D-03 lands — same-commit prose corrections

Neither is named in CONTEXT or RESEARCH. Both justify the two-type grounding gate with a claim D-03
falsifies:

| Site | Verbatim | Why it breaks |
|---|---|---|
| `phaseVocabulary.ts:271-276` | *"Mirrors the backend rule exactly: `available_tools` exists only on `LlmAgentPhaseConfig` and `LlmBatchAgentsPhaseConfig`…"* | D-03 puts `available_tools` on `ExternalActionPhaseConfig` too |
| `GovernanceSection.tsx:86-89` | the same sentence, re-typed | same |

**The CONSTANT must not change** (`GROUNDING_DIAL_TYPES` is a D-185-15 red line and the gate is still
correct — a third type carrying `available_tools` does not make it grounding-capable, because its
capabilities are disjoint from `KB_TOOLS`). **The REASON must be corrected in the same commit**: the
gate is *"the only types whose tools can intersect `KB_TOOLS`"*, not *"the only types with
`available_tools`"*.

### 5 · The run band will read *"✓ Complete"* over a node that says *"Not sent — recorded"*

**Measured.** `WorkflowRunPage.readBand` (`:265-306`) reads `workflow_runs.status`, and D-05 makes
the run CONTINUE — so a run whose external step recorded-not-sent completes normally.

**Accepted, with the shipped argument.** The band's own F3 note settles the same question for
`active`: *"The per-node readings carry the finer truth… so nothing is over-claimed by naming the
RUN running."* The RUN did complete. **No 189 change to `readBand`.** It is listed here so it reads
as a recorded decision rather than as a defect found in UAT, and it is a named UAT observable in §13.

### 6 · `canvasModel.ts:201-203` — D-21, restated so its scope cannot expand

The docblock says verbatim *"`false` is Phase 189's state — an external-action step whose checkpoint
the author turned off."* D-04 makes that state unreachable forever, and `checkpointOnTarget`
(`:274-276`) already cannot produce it. **The edit is: delete the sentence that names 189 as the
claimant of the `false` branch, and record why (D-04).** The `FlowEdge` `GhostMarks` branch stays
shipped and stays unreachable. **A plan that budgets work for a ghost-detour edge has misread this.**

---

## 12 · Claude's Discretion — decisions taken here, with their reasoning

| # | Decision | Reasoning |
|---|---|---|
| C1 | **The 8th ring** = `fraction`, dash `0.15` / gap `0.10`, **repeats 4**, `gapCentre 0.125`, not spinning | §4b — the only 4-arc reading; tiles the circle exactly with 2-dp numbers; separated from `done` by 40 % missing ring (the confusion that mattered most); separated from `running` by COUNT, which survives `prefers-reduced-motion` |
| C2 | Ring stroke = `--muted-foreground` | §4c — success/destructive/warning/primary each make a false claim; muted is the shipped calm-terminal token |
| C3 | `RUN_READING_BORDER` left UNSET | §4d — only the loud readings claim the border |
| C4 | `STATIC_CLAUSE` = `null` | §3c — the D-16 word carries its own clause; a second would double the em-dash and restate |
| C5 | Glyph = **`outbox-tray`** | §5a — present in the installed set (re-verified), type-level not capability-level, mean palette luminance 168.4 inside the shipped 148–189 band |
| C6 | Tint = `hsl(310 85% 66% / 0.38)` | §5c — midpoint of the largest unused hue gap, and the alternative gap's midpoint sits adjacent to `--success` |
| C7 | Badge tone = `muted`, no glyph | §2c — `primary` is slot 2's, `success` is a false claim, and the icon convention forbids a glyph on a word-badge |
| C8 | Capability tier numbered **(4)**, renumbering 4→5 and 5→6 | §6a — it is context-free like HUMAN INPUT, not name-reading like tiers 1-3; a decimal tier defeats the ordering test |
| C9 | Type sentence `Reach outside`; subtitle `Stops for your approval before it acts outside`; label `External action` | §6b — the subtitle is worded to survive Phase 190 rather than become a lie |
| C10 | Panel word `Not sent`, glyph **`↛`** | §3a — `↛` is measured **unused** in `frontend/src` (`⊘` has 5 uses and means *cancelled*; reusing it would give one glyph two meanings, which the icon convention forbids) |
| C11 | Panel `PHASE_TYPE_LABEL` **declined**, `STATUS_META` added | §1c — the shipped table already declined `llm_emit` and degrades honestly; `STATUS_META` is typecheck-forced and cannot be declined |
| C12 | `ExternalActionSection.tsx` as its own file, ONE gated line in `PhaseFormPanel` | §7a — the ledger's own instruction, and 185 proved the shape at 4 render-body insertions |
| C13 | Own-guard via inline `hasOwnProperty`, not an `ownProperty` import | §6a — `phaseVocabulary.ts` has **zero** imports today; the `runVocabulary.ts:84-88` precedent covers exactly this |
| C14 | The phase output body's three blocks + the closed negation table | §9d — closed table, no improvisation, negation first |

---

## 13 · How we'd know this failed

Concrete observable conditions. **The right-hand column is the honest half** — jsdom applies no CSS,
computes no stacking contexts, and `.click()` bypasses hit-testing, which is how `BUG-260806-01`
survived from 184-12 and how `BUG-260807-01` survived until this week.

| # | Failure we would see | Can jsdom see it? | Driven method |
|---|---|---|---|
| F1 | The 📤 mark renders but is invisible on Deep Midnight (the `llm_batch_agents` luminance-34.5 defect) | ❌ **NO** — jsdom paints nothing | **U1** — Chrome MCP `evaluate_script`, computed fill/luminance of the rendered mark against the other six on one canvas |
| F2 | The `Not connected` badge occludes, or is occluded by, the ⛨ seal, the verdict mark, or the ✕/＋ lane affordances | ❌ **NO** | **U2** — `document.elementFromPoint(x,y)` at the badge's centre and at each neighbour's, **with a falsification control observed swinging both ways**, exactly as `BUG-260806-01` was closed |
| F3 | The 8th ring is indistinguishable from `done`, `failed` or `skipped` with colour off — silently voiding a shipped BUILD CRITERION | ❌ **NO** | **U3** — read the `stroke-dasharray` / `stroke-dashoffset` presentation attributes for **all eight** readings and assert the 4-pair count is unique; then a `filter: grayscale(1)` visual pass. ⚠ `take_screenshot` times out repeatedly in this estate — prefer `evaluate_script` attribute reads |
| F4 | The badge pushes the card past its budget, or moves the spine's edge baseline, or reflows a neighbour | ❌ **NO** | **U4** — `getBoundingClientRect()` on the card and on an adjacent node before/after; assert `EDGE_ANCHOR_Y` is unmoved |
| F5 | The seven shipped readings stop being distinguishable by shape on a **live** run; the running arc stops spinning; a card with no reading is not still | ❌ **NO** | **U5** — the owed `D-188.2-DEF-07` row A2. **189 launches live runs under D-06; run A2 on the first one.** |
| F6 | A Builder card just looks wrong | ❌ **NO** | **U6** — the owed `D-188.2-DEF-08`, row A1's visual half. Zero cost; pair with U5 |
| F7 | `phaseStatusFromDb("recorded_not_sent")` resolves to `"done"` — an unrecognised state read as success | ✅ **YES** | `phaseState.test.ts` — assert `!== "done"` **and** `!== "unknown"` after the map lands |
| F8 | `runReadingWord` returns `"Complete"`, `"Running"` or the waiting word for the new reading | ✅ **YES** | exact-match assertions in `PhaseNodeCard.test.tsx` — ⚠ **never `.toContain("Not")`**, which is ambiguous against `"Not started"` |
| F9 | The badge appears on a step that is not an external action | ✅ **YES** | `WorkflowCanvas.test.tsx` — `[data-not-connected]` absent on all six other types, present on the seventh |
| F10 | A third badge compiles | ✅ **YES** | the `@ts-expect-error` control — observe it RED at 34 type errors and green at 33 |
| F11 | A focusable control lands inside the card | ✅ **YES** | the card suite's leaf walk — drive it RED against a planted `<button>` |
| F12 | `PHASE_GLYPHS` and `PHASE_GLYPH_MARKS` disagree (the split-brain) | ✅ **YES** | `soulData.test.ts` — assert **identical key sets**, not six individual keys |
| F13 | The picker offers six choices, or the seventh is not last | ✅ **YES** | `StepTypePicker.test.tsx` — ⚠ its `describe("the six choices")` and three `toHaveLength(6)` pins go RED; that is bookkeeping, not a broken feature |
| F14 | The refusal reason is delivered as a `title` attribute | ✅ **YES** | `GovernanceSection.test.tsx` — assert the sentence is real DOM text with `aria-describedby`, and that no `title` carries it |
| F15 | The arming switch is pressable on an external-action step | ✅ **YES** | assert `disabled` + `aria-disabled` + that `onGovernanceChange` is not called on click |
| F16 | Two capability sentences render for one step, or a capability the client does not know renders a fabricated face | ✅ **YES** | `phaseVocabulary.test.ts` — all three capabilities + an unknown value falling through to `Reach outside` |
| F17 | The phase output body reads as a receipt (a checkmark, "delivered", "sent to") | ✅ **YES** (backend) | a source/output fence over the executor's text, with a positive control |
| F18 | `PhaseNodeCard.tsx` or another fenced module is edited | ✅ **YES** | `git diff --stat` over the six fenced files must show **only** `NodeRunOverlay.tsx` (+1 `RING_STROKE` row), and `CARD_SUBTREE_PATHS` must still be 6 |

**Baselines to re-derive at plan time** (RESEARCH's are dated 2026-08-07 and its own note says
re-derive): `npx tsc --noEmit -p tsconfig.app.json` (**33**, and bare `--noEmit` checks ZERO files) ·
`node scripts/vitest-count-gate.cjs` (**45/45, total 2508**) · ⚠ **do NOT read the gate's
`failed 0` as "no regression"** (`D-188.2-DEF-01` — that column is rot on this machine; the COUNT
columns are the backstop).

---

## 14 · Pointer audit

The standing project rule is to re-derive, not inherit. Every `file:NNN` in this document was
re-derived on **2026-08-07** against the working tree.

**47 pointers verified EXACT**, including all four `icon-convention.md` §4 pointers 188.2 corrected
(`NodeCornerMarks.tsx:266` ⛨ · `PlaneEditingLayer.tsx:186` ＋ · `:234` ✕ · `definitionOps.ts:466`
`GOVERNANCE_SEAL_LABEL`) — **188.2's corrections hold.**

**7 corrections found:**

| # | Claimed | Measured | Source of the stale claim |
|---|---|---|---|
| P1 | `CARD_SUBTREE_PATHS` at `PhaseNodeCard.test.tsx:260-267`; `cardSubtreeSource` at `:269` | **`:100-107`** and **`:113`** — off by ~160 lines | RESEARCH §C13 (the `:545` length pin it also cites IS correct) |
| P2 | `canvasModel.ts:~447` reads `PHASE_TYPE_SUBTITLES[phaseType] ?? ""` | **`:297`**, inside `buildPhaseData` | RESEARCH §A1 row F6 |
| P3 | `PhaseFormPanel.tsx:169-175` `PHASE_TYPE_FRIENDLY` | **`:168-176`** | RESEARCH §A1 row F12 |
| P4 | `panel/PhaseTimeline.tsx:60-74` `milestoneFor` | **`:57-74`** | RESEARCH §B9 row 6 / §B8 |
| P5 | *"T2 currently asserts an absence on every node; after 189 it must assert absent-unless-not-connected"* | `WorkflowCanvas.test.tsx:423` asserts the absence of the retired **grounding chip** specifically (`[data-grounding]`, `canvas-grounding`). It does **not** mechanically break; only its wording misleads | RESEARCH §C10 characterisation |
| P6 | *"T1 must be rewritten"* | `PhaseNodeCard.test.tsx:2156`'s assertion passes `badges` explicitly and stays valid. **Only the comment is falsified** | RESEARCH §C10 characterisation |
| P7 | CONTEXT D-12 names **five** source sites; RESEARCH adds a sixth | Measured **six files**, and `NodeCornerMarks.tsx` states it at `:24-27`, `:217` **and** `:223` — more sites than either list | CONTEXT `<decisions>` D-12 / RESEARCH §C10 |

**Two independent re-verifications this session** (not inherited): `@iconify-json/fluent-emoji@1.2.7`
at **3174 icons** with `outbox-tray` PRESENT / `outbox` ABSENT; and the glyph palette luminances in
§5a, which are new measurements RESEARCH did not carry.

---

## 15 · Registry Safety

| Registry | Blocks used | Safety Gate |
|---|---|---|
| shadcn official | **none** — 189 adds no shadcn component | not required |
| third-party | **none declared** | not applicable — no `npx shadcn view` vetting was required, and none was performed |

189 installs no package, adds no dependency, and fetches no icon at runtime. The only
registry-adjacent item is a **slug inside the already-installed** `@iconify-json/fluent-emoji@1.2.7`
set, confirmed present by reading the installed `icons.json` directly (§5a) rather than by a network
lookup. `unplugin-icons` bundles it at build time — a missing slug fails the build, which is the
verify-or-bundle discipline stated as a mechanism.

---

## 16 · Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
