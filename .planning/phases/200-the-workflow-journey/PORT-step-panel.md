# PORT — the step panel

**Reference (absolute):** `.planning/sketches/200-journey-interactive/screens/step-panel.html`
**Targets:** `PhaseFormPanel.tsx` · `StepCardSection.tsx` · `stepCardSectionContext.ts` ·
`GovernanceSection.tsx` · `TemplateAttachSection.tsx` · new leaves `ToolChoiceSet.tsx`,
`StepReadiness.tsx`, `stepReadinessContext.ts`

⚠ `200-CHECKLIST.md` was **not** used to derive anything. Structure came from the sheet's markup.

---

## What was ported

**The card shape itself — the largest single miss.** The sheet draws every group as **two
nested elements**: a small-caps outside label over an inset panel `bg-deep-midnight-bg` that is
**darker** than the `bg-deep-midnight-card` aside around it. The shipped shell was one
`bg-muted/40` strip with an 11 px medium title. That nesting is the whole difference between
"a form with headings" and "a column of cards", and it is why `13/14` atoms could be green
while the result was not what was designed. `StepCardSection` now carries the sheet's shape,
and the two sections that own their own shells (`GovernanceSection`, `TemplateAttachSection`)
take the **same two class strings** — otherwise the one card carrying the governance decision
is the one that fails to look like a card.

**The seven cards, in the sheet's order** (asserted as an order, not a set):

| # | Card | Status |
|---|---|---|
| 0 | `Order is locked` | shipped rail — **not** one of the sheet's seven, kept because it states a rule nothing else says |
| 1 | `What it does` | **NEW** — instructions, plus that type's dials (creativity / max steps / time limit / parallel workers / merge / choices / timeout) |
| 2 | `Model` | shipped, unchanged |
| 3 | `What it can reach` | folders as **rows**, the sheet's own `<hr>`, then the tools, then the skill |
| 4 | `What it changes outside this workflow` | gains the sheet's amber left edge (`#F5A524` → `--warning`) |
| 5 | `What it delivers` | **NEW** — emitter + sourcing strictness + file check |
| 6 | `The file this step fills in` | re-shelled, moved to the sheet's position |
| 7 | `How strictly this step is held` | re-shelled |
| 8 | `N things still missing` | **NEW** — the closing checklist with jump rows |

**Header.** The sheet draws a **column**: bordered small-caps type badge on its own line, then
the step's name as the heading under it. Shipped had a single row with the badge crammed
between the name and the ✕.

**The tools moved INSIDE the reach card**, under the sheet's own `<hr>`. The sheet composes
folders and tools as one card in two halves; shipped had the tool list floating between two
unrelated number fields, which is why the card titled *what it can reach* read as though it
were only about folders.

**Two card titles are deliberately NOT re-spelled.** `How strictly it is held` and
`Files it starts from` are the sheet's words; the shipped words are `How strictly this step is
held` (whose one home doubles as the dial group's accessible name) and `The file this step
fills in` (which says what the file is FOR, which the sheet's does not). Both cards are
ported — shape and position; what is not ported is a second copy of their words.

---

## Behind a reveal (nothing dropped)

**The 28-chip tool wall.** The sheet draws **twelve** pills; the server offers **twenty-eight**
and the shipped set printed every one, which is the "dense form" half of the verdict — the two
CHOSEN tools, the only decision on the card, were lost inside it.

`ToolChoiceSet.tsx` spends the sheet's twelve-pill budget on the offered set and puts the rest
behind `Show N more` / `Show fewer`. **Two classes are pinned open at any count**, because
SEED-184 rule 3 forbids folding a decision:

1. **every SELECTED tool** — what the step can do is the decision the card exists to state;
2. **every UNREGISTERED tool** — the server already answers `unregistered_tool` for it, and
   folding it would put a finding somewhere the author cannot act on while quietly editing
   their stored value out of sight.

What is folded is the **unchosen and offered** remainder: a menu, not a fact. Same ids, same
order, same `data-tool` / `data-unregistered`, same comma seam.

*(The ⓘ hints, which already carry the exact technical term on hover, are untouched.)*

---

## What the sheet draws that is NOT on the wire

| Atom the sheet draws | What ships | Why |
|---|---|---|
| **A per-folder lock state** (`Locked — only the person who locked it can release it`, plus a `Lock` button per row) | **nothing renders** | `folder_scope` is a bare `string[]`. No lock bit, no holder, no wire field of any kind. A badge would be a fabricated fact on a governance surface. |
| **`Add a source`** (dashed button) | a **statement**, not a control | `folder_scope` is a read-only display here and no authoring control writes it — pinned by a source assertion in `WorkflowBuilderPage.header.test.tsx`, because a write raises `_folder_scope_requires_project` (422) and under D-186-04 would leave a permanently unsaveable draft. Ported as `STEP_CARD_NO_SOURCE_ADD`; asserted non-pressable against the seven-role control **set**, not `button` alone. |
| **`Will overwrite 1,200 records`** | **nothing renders** | No row count is computed anywhere in this product. A preflight count is a capability, not a label. |
| **`Choose a model`** (checklist row 1) | **not a gap** | A blank `model` MEANS *use the run's model* — the documented, correct state that 239 of 257 real phases hold. Calling it missing would nag every author about a default. |
| **`Connect a knowledge source`** (checklist row 2) | **not a gap** | An empty `folder_scope` is a step that reads nothing, which plenty legitimately are — and this panel cannot write the field anyway. A checklist row for a thing the surface refuses to let you fix is a dead end wearing a chevron. |
| **`GPT-4o` / `Claude 3.5 Sonnet` / `Llama 3 Instruct`** | registry only | Placeholders, not literals. Unchanged from 200-04. |
| **Material Symbols ligature names** (`folder`, `lock`, `shield`, `chevron_right`, …) | never as text | The icon authority is `icon-convention.md`. The chevron is `›`, `aria-hidden`. |

**The four conditions the checklist DOES claim** — each a field the executor genuinely requires
that genuinely holds nothing: a blank `prompt` on the five prompt-bearing types; a blank `fn`
on `programmatic`; no recognised `capability` on `external_action`; no bound template filename
on `llm_emit` **when the caller is wired for templates at all** (absence of the prop means "we
were not told", never "nothing is attached"). **Nothing renders at zero** — never
`0 things still missing`, never an "all set": a zero-state congratulation claims the step is
COMPLETE, and the publish gauntlet is the surface allowed to make that claim.

---

## Pins moved

**ONE**, and only its prose axis — the density characterization pin in `PhaseFormPanel.test.tsx`.

```
llm_agent   1403 → 1508   (+105)
llm_emit    1385 → 1506   (+121)
open        1640 → 1745   (+105)
```

Every character is attributed to a **named constant**, with no residual:

```
+105 = STEP_CARD_WHAT_IT_DOES_TITLE (12) + STEP_CARD_NO_SOURCE_ADD (93)
+121 = the same 105, + STEP_CARD_DELIVERS_TITLE (16)
```

⚠ **The half the pin actually guards is UNMOVED.** `helpLines` / `helpChars` still read an
exact `0 / 0` collapsed and `5 / 234` open — byte-identical to 199-06's and 200-04's readings —
so 199-06's subtraction is proven un-reversed rather than hoped un-reversed. A port that added
four named sections and reported its prose volume unchanged would have either not built them or
silently deleted something else to pay for them. The 199-06 and 200-04 readings stay on the page.

**No refusal was retired** — unlike the spine port, no pin here recorded a deliberate refusal to
build something the sheet draws.

**Pins that passed UNEDITED, and are load-bearing:**
- the **ABSOLUTE ZERO** hook count over `PhaseFormPanel?raw` — both new state holders
  (`ToolChoiceSet`, and none needed for readiness) live in leaves, the `FieldGuidance.tsx`
  precedent;
- the **four `<ModelField` mounts** as a sorted set of their `pt ===` guards, with `showFitness`
  on the deliverable only;
- the D-14 `[data-rail] === 0` byte-identity guard for a rails-absent render;
- `ARM_PINNED_TYPES === ["external_action"]`.

---

## Fixed in passing (Rule 1)

`CITATION_CAPTIONS[…]` was a **live WR-04 prototype-key sink** — a bracket read on a plain
object literal, fed by arbitrary wire data (`config.citation_policy`). A stored `constructor`
resolves `Object.prototype.constructor`, a **function**, which React does not render as text —
it **refuses the child outright**, so the caption vanished. Measured three files away in this
same phase. Now `own()`; absence renders nothing, honestly.

---

## Verification

| Suite | Result |
|---|---|
| `PhaseFormPanel.test.tsx` + `PhaseFormPanel.rails.test.tsx` | **106 / 106** |
| `StepPanelPort.test.tsx` (new, 25 cases) | **25 / 25** |
| `GovernanceSection` + `TemplateAttachSection` + `toolNames` | **107 / 107** |
| the four `WorkflowBuilderPage` suites | **260 / 260** |
| twelve further related suites (canvas, spine, door, definitionOps, hooks, …) | **919 / 919** |

`npx tsc -p tsconfig.app.json --noEmit` → **33 errors, unmoved**, all pre-existing across 19
other files; **zero** in any file this port touched. `eslint` clean on all nine.

⚠ Per the dispatch, `CLAUDE.md`, `docs/HOT-FILE-LEDGER.md` and `scripts/vitest-count-gate.cjs`
were **not touched** — a sibling agent is porting another screen in parallel. `StepPanelPort.test.tsx`
is a new gated-directory suite and will raise the count-gate total; that is the gate working.
