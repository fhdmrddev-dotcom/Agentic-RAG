---
phase: 189
plan: 14
subsystem: frontend-authoring-panel-governance
tags: [wave-7, hot-file-ledger-honoured, cross-language-fence, refusing-control, six-plants, react-refresh-constraint, ui-spec-7b-resolved]
requires:
  - "189-13 — EXTERNAL_CAPABILITY_SENTENCES, exported as ONE constant for this picker to read"
  - "189-12 — external_action in PhaseTypeId / PHASE_TYPE_ORDER / requiredConfigFor (the type the picker configures)"
  - "189-07 — the Pydantic-level action_risk_armed pin this plan gives an honest surface to"
  - "185-07 — GovernanceSection.tsx + its one-line mount: the whole-file analog, copied property by property"
  - "backend/app/models/harness.py ExternalActionPhaseConfig.capability — the Literal the client mirror is fenced against"
provides:
  - "ExternalActionSection.tsx — the capability picker, its OWN file, a presentational leaf (185 L)"
  - "the panel mount: ONE import + ONE gated JSX expression + one PHASE_TYPE_FRIENDLY entry — 11 insertions / 0 deletions, THREE of them JSX in the render body"
  - "EXTERNAL_ACTION_HEADING + EXTERNAL_ACTION_NOTHING_CHOSEN_NOTE — the two authoring sentences, imported never inlined"
  - "ACTION_RISK_LOCKED_REFUSAL — EXACTLY ONE new refusal sentence (D-24)"
  - "ARM_PINNED_TYPES — a named type gate that is NOT DIAL_TYPES and must never be merged with it"
  - "the D-23 CAPABILITY-half cross-language fence (189-12 built the PHASE-TYPE half)"
  - "the arming switch rendering ON, disabled, aria-disabled, explained in text, and NOT struck through"
affects:
  - "189-15 — the badge plan. It edits PhaseNode.tsx / canvasModel.ts / the prose sites; nothing here touches them"
  - "189-16 — UAT still owes the rendered checks; jsdom paints nothing and drove none of the visual halves"
  - "the tree's tsc baseline: 33 -> 33, unmoved. The count gate: 2587 / 46 files -> 2619 / 47 files."
tech-stack:
  added: []
  patterns:
    - "a hot-file ledger row honoured BY CONSTRUCTION and MEASURED afterwards (git diff --numstat), not asserted"
    - "a cross-language raw-source fence reading a Python Literal from a vitest suite, with a falsifiable extractor"
    - "a control that is PINNED rather than DEAD: rendered ON and non-interactive, refused-never-hidden, never struck through"
    - "a negative control written FIRST, because the pin could otherwise pass by disabling the control everywhere"
decisions:
  - "UI-SPEC §7b's picker-selection question, ASSIGNED IN WRITING BY 189-13, is RESOLVED AS OPTION (a): the stored capability renders pre-selected, because that is simply what the component does — it reflects the prop. No 'unset' representation was invented. `send_email` arrives on every placed node (189-12's requiredConfigFor), so the honest picker shows `Sends an email` selected on arrival, and the author changes it."
  - "The §7b 'no row selected' state stays REACHABLE and is DRIVEN — for an absent (\"\"), unrecognised, or inherited stored value. Three cases cover it and one went RED under a plant."
  - "The no-capability NOTE renders ONLY when no row is selected. UI-SPEC §9d names it the *empty/no-capability note*, and a note claiming nothing is ever sent would become a LIE the day Phase 190 wires the node up — the same reasoning that made 189-13 word the subtitle to survive 190. The design-time not-sent fact is the badge's (D-12) and the run-time one is the run word's (D-16)."
  - "⚠ THE RAW CAPABILITY ID NEVER REACHES THE DOM — no `value=`, no `data-capability`, no id-bearing test id. This was NOT a style choice: 189-13's own D-189-DEF-02 guard asserts the whole external-action panel's innerHTML contains none of the three names, so the obvious `data-capability={name}` spelling would have turned a shipped governance guard RED. Rows are addressed by accessible name (the sentence) instead."
  - "The panel's mount uses the INLINE literal `pt === \"external_action\"`, matching its six siblings, NOT a named constant — because `PhaseFormPanel.rails.test.tsx` fences `/pt === \"external_action\"[\\s\\S]{0,600}<ToolsField/` on source, and a named constant would have made that guard silently vacuous."
  - "`ARM_PINNED_TYPES` is a SEPARATE list from `DIAL_TYPES` and the docblock forbids merging them: they answer opposite questions about different fields (which steps can be held to their SOURCES vs which are always ARMED), and `external_action` is deliberately in one and deliberately absent from the other."
  - "The rendered arming state is `armPinned || actionRiskArmed`, not the prop — see Deviation 1. A freshly-placed step carries no stored bit."
metrics:
  duration: "~120 min"
  completed: 2026-08-08
  tasks: 2
  commits: 2
  files_created: 2
  files_modified: 5
  tests_added: 32
---

# Phase 189 Plan 14: The Authoring Surface Summary

**The author can now choose what an external-action step does outside, from a
three-option mirror that cannot silently drift from the server's `Literal`; and the
arming switch beside it renders ON, refuses to move, and says why in text a screen
reader reaches.** The side panel — a hot-file-ledger row whose instruction is verbatim
*"the next surface that needs the panel gets its own component and one gated line"* —
grew by **11 insertions and 0 deletions, of which THREE JSX lines reach the render
body.** Six wrong fixes were planted into production source and every one was observed
RED, including the two that a reviewer would wave through: a picker that never looks
unset, and a "pinned" switch that is pinned only in its attributes.

## The commits

| SHA | Task | Scope |
|---|---|---|
| `0024e03e` | 1 | `ExternalActionSection` + its suite + the one gated panel line + the D-23 capability fence |
| `368ef797` | 2 | the ONE new refusal sentence, the refusing arming switch, and its seven guards |

```
$ git diff --name-only 0024e03e~1..HEAD
frontend/src/components/workflows/ExternalActionSection.test.tsx     (new)
frontend/src/components/workflows/ExternalActionSection.tsx          (new)
frontend/src/components/workflows/GovernanceSection.test.tsx
frontend/src/components/workflows/GovernanceSection.tsx
frontend/src/components/workflows/PhaseFormPanel.tsx
frontend/src/components/workflows/definitionOps.ts
scripts/vitest-count-gate.cjs

$ git diff --stat 0024e03e~1..HEAD -- <the six fenced card-subtree modules>   → (empty)
$ git diff --stat 0024e03e~1..HEAD -- backend/ supabase/                      → (empty)
$ git diff --diff-filter=D --name-only 0024e03e~1..HEAD                       → (empty)
```

---

## ⚠ THE LEDGER ROW, MEASURED — not claimed

The row's own words are the acceptance bar, and Phase 185 set the benchmark at **four**
render-body insertions for an entire governance feature.

```
$ git diff --numstat frontend/src/components/workflows/PhaseFormPanel.tsx
11      0       frontend/src/components/workflows/PhaseFormPanel.tsx
```

**Where all eleven went:**

| Insertions | Where | What |
|---|---|---|
| 1 | imports | `import { ExternalActionSection } from "./ExternalActionSection"` |
| 5 | `PHASE_TYPE_FRIENDLY` | one entry (`External action`) + a 4-line note on why the map's ONE shipped divergence is not a licence to invent a second |
| **5** | **the render body** | 1 blank + 1 comment + **3 JSX lines** |
| 0 | — | **nothing was deleted** |

**The render-body cost is THREE lines of JSX**, one under 185's four. Everything the
picker does lives in `ExternalActionSection.tsx` (185 L), which is `GovernanceSection.tsx`'s
whole-file shape with its six contract properties copied one by one:

| # | Property | How it is guarded here |
|---|---|---|
| 1 | authors NO sentence of its own | every string is an imported identifier; the suite asserts character-identity AND that the component's source contains none of the five sentences it renders |
| 2 | a LEAF | a source fence on `useContext\|useStore\|useEffect\|zustand`, with a positive control |
| 3 | a `?raw` fence proving it names no API route | four patterns + a five-line positive control block |
| 4 | any type gate is a NAMED module-scope constant | `EXTERNAL_ACTION_CAPABILITIES`, derived from the one sentence map |
| 5 | renders in EVERY state it can reach | a five-state loop asserting the section, the heading and three rows are present in all of them |
| 6 | reasons are real DOM text via `aria-describedby`, never `title` | a `not.toMatch(/title=/)` source fence, driven RED under PLANT F |

---

## ⚠ UI-SPEC §7b — RESOLVED, and the half that was already reachable

189-13 assigned this in writing with a recommendation. **The recommendation is taken,
and it turned out to require no code at all**: the component reflects its prop, so a
stored `send_email` renders selected because it IS selected. No "unset" representation
was invented — the D-15 fence in `test_189_external_action_model.py` forbids making the
field optional, and inventing a sentinel would have put a value in the JSONB that the
server's closed `Literal` refuses.

**The state UI-SPEC calls "nothing chosen yet" is therefore reached by three inputs, all
driven:**

| Input | Rendered |
|---|---|
| `""` (absent) | three rows, none selected, + the honest note |
| `"send_carrier_pigeon"` (unrecognised) | three rows, none selected, + the note, and **no row grew a label for it** |
| `"constructor"` / `"toString"` / `"__proto__"` (inherited) | three rows, none selected |

The membership test is `Array.prototype.includes`, never a bare object lookup, so an
inherited name can never resolve to a row **by construction** — but the probe is a case
of its own anyway, because "correct by construction" is the claim a later refactor
silently falsifies.

**One thing the assignment did not name, and it is a real constraint rather than a
preference:** the note is the *empty/no-capability note* by UI-SPEC §9d's own name, so it
renders only when no row is selected. Rendering it permanently would put a sentence on
screen that says nothing is ever sent — which becomes a **lie the day Phase 190 wires
the node up**, and is exactly the trap 189-13 worded the subtitle to avoid.

---

## ⚠ THE CAPABILITY ID MUST NOT REACH THE DOM — and 189-13's guard is why

The obvious spelling for a radio row is `data-capability={name}` or `value="send_email"`.
**Both would have turned a shipped governance guard RED.** `PhaseFormPanel.rails.test.tsx`
(189-13's D-189-DEF-02 closure) asserts:

```js
for (const capability of Object.keys(EXTERNAL_CAPABILITY_SENTENCES)) {
  expect(container.innerHTML).not.toContain(capability)
}
```

…over the WHOLE external-action panel, under three `toolOptions` shapes. That guard was
written to stop a capability being painted as an author-fixable tool chip, and it now
does double duty: it also forces the picker to speak in sentences. Rows are addressed in
the suite by accessible name, and the section carries its own copy of the assertion in
every state. `expect(container.innerHTML).not.toContain("line-through")` holds too — a
structurally required value is not an author-fixable error.

---

## D-23 — THE CROSS-LANGUAGE FENCE, AND ITS OBSERVED RED

189-12 built the PHASE-TYPE half of this fence. **The CAPABILITY half is this plan's**,
and it reads the server's own source through the same `?raw` loader:

```ts
const backendCapabilities = (source: string): string[] => {
  const match = source.match(/^\s*capability:\s*Literal\[([^\]]*)\]/m)
  if (!match) return []
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
}
expect(backend).toHaveLength(3)                             // D-15 — exactly three
expect([...EXTERNAL_ACTION_CAPABILITIES]).toEqual(backend)  // same members, same order
```

The reader is **falsifiable** (it returns `[]` on a source without the Literal, and
really does parse a planted one), and the haystack is proved non-empty before anything is
compared — without both, the fence would be two empty lists agreeing forever.

**PLANT A — a fourth capability added to the client map only:**

```
×  nothing chosen: three unselected rows under the heading, plus the honest note
   AssertionError: expected [ <button …(6)>…(2)</button>, …(3) ] to have a length of 3 but got 4
×  EXACTLY the same members, EXACTLY the same count, in the union's own order
   AssertionError: expected [ 'send_email', 'create_ticket', …(2) ]
                   to deeply equal [ 'send_email', 'create_ticket', …(1) ]
6 failed | 20 passed (26)
```

Restored by `cp` from a pre-plant backup, verified by **md5**
(`f759cd0aa228577d52bdd5184a23192e`, identical before and after), `grep -c "PLANT"` → **0**.

---

## ANTI-VACUITY: SIX PLANTS, EVERY ONE RED

All six driven into production source, observed, removed, and each restore verified by
md5. **`grep -c "PLANT"` → 0 across all four production files this plan touches.**

| Plant | The wrong fix | Failures | The one that caught it |
|---|---|---|---|
| **A** | a fourth client capability (the drift D-23 exists to stop) | 6 | the cross-language mirror fence — **only it can see a rename** |
| **B** | *"never leave the picker looking unset"* — fall back to the first row | 4 | `an UNRECOGNISED stored value selects NO row and fabricates nothing (T-189-39)` |
| **C** | a hand-typed tuple instead of `Object.keys(…)` | **1** | `the mirror is DERIVED from the one map` — exactly one failure, attributable to one claim |
| **D** | a "pinned" switch that is pinned only in its ATTRIBUTES (handler left open, `disabled` removed) | **1** | the DRIVEN CLICK. An attribute read alone would have passed |
| **E** | the pinned switch struck through with `DIAL_BUTTON_REFUSED` | **1** | `the switch is NOT struck through and NOT dimmed` |
| **F** | the refusal delivered as a `title` AS WELL AS real text | 2 | the new `[title]` sweep **and** the shipped `?raw` source fence — two independent nets |

**PLANT B is the one a reviewer waves through.** "Show something rather than nothing" is
a reasonable-sounding UX instinct, and it is precisely T-189-39: a fabricated selection
claiming a capability the step does not have. **PLANT D is the one an attribute test
cannot see** — `disabled` is a browser behaviour, so the handler is a second lock and
the click is the only thing that proves both.

---

## D-04 ON SCREEN — and the defect the plan did not predict

`GovernanceSection.tsx` now renders the action-risk switch, for `external_action`, as:

| Property | Value |
|---|---|
| `aria-checked` | `"true"` |
| `disabled` | present |
| `aria-disabled` | `"true"` |
| cursor | `cursor-not-allowed` |
| track | the shipped amber `bg-[hsl(38_92%_60%/0.55)]` — asserted, because `aria-checked` alone would pass on a switch that announces one state and paints the other |
| strike-through | **ABSENT**, asserted explicitly, with a positive control proving `line-through` really does render where 142-B puts it |
| the reason | `ACTION_RISK_LOCKED_REFUSAL` as real DOM text in the shipped `REFUSAL_CLASSES` block, wired by `aria-describedby`, with the id proved to resolve |
| `title` anywhere in the section | **zero elements**, asserted by `querySelectorAll("[title]")` |
| the handler | returns before writing — the callback is proven not to fire **by a driven click** |

**The section keeps the switch rather than removing it.** 185's rule — *a control that
could never do anything is REMOVED, not disabled* — is really *replace a DEAD control
with the sentence that states the fact*. This control is not dead; it displays the single
most important thing on the panel for this type, and hiding it would delete the reading at
the moment it matters most (143-A's argument for the seal, one surface along).

**The grounding dial is ABSENT on this type and that is correct** — `external_action` is
not in `DIAL_TYPES`, its capabilities are disjoint from `KB_TOOLS`, so the section renders
`Nothing to prove here` and carries no ⛨ seal. Asserted, together with the fact that a
stored escalation bit cannot conjure a dial back on this type either.

```
$ git diff frontend/src/components/workflows/GovernanceSection.tsx | grep -E "^[+-]" | grep -i "DIAL_TYPES"
+ * and cannot be disarmed by anyone. A NAMED module-scope constant, `DIAL_TYPES`' form,
+ * ⚠ THIS IS NOT `DIAL_TYPES` AND MUST NEVER BE MERGED WITH IT. …
```

**No `-` line touches `DIAL_TYPES` or the D-26 docblock 189-07 corrected** — both are
byte-identical to HEAD, and the only new mentions are prose forbidding the merge.

---

## The refusal sentence — ONE, counted before and after

| Point | `definitionOps.ts` `^export const` | The 185 governance block |
|---|---|---|
| HEAD (before this plan) | **26** | **13** |
| after Task 1 (the two AUTHORING sentences) | 28 | 13 |
| after Task 2 (the ONE refusal) | **29** | **14** |

**Task 2 added exactly ONE**, as its criterion requires. The two Task-1 additions are the
picker's heading and its no-capability note — they are authoring vocabulary, not
governance vocabulary, and they sit in their own block below the 185 one.

⚠ **UI-SPEC CONFLICTS 1 says `definitionOps.ts` exports "eleven governance strings
(`:450-502`)". Measured: THIRTEEN, at `:456-541`.** The count and both line numbers were
stale. The substance of the conflict is unaffected and its resolution stands — the one
shipped refusal sentence really is about KB tools in every clause, so it would be
factually false beside an arming switch on a step that opens no document.

---

## Verification

**The plan's `<verification>` block, run:**

```
$ npx vitest run ExternalActionSection.test.tsx GovernanceSection.test.tsx PhaseFormPanel.test.tsx
   25 / 49 / 19 — all green

$ npx vitest run src/components/workflows
   Test Files  36 passed (36)
   Tests       2195 passed (2195)          ← ZERO failures in the whole directory

$ npx tsc --noEmit -p tsconfig.app.json | grep -c "error TS"
33                        ← THE BASELINE, unmoved, and ZERO in any file this plan touched

$ npx vite build
✓ built in 29.85s

$ node scripts/vitest-count-gate.cjs
  total   2619  2619  0
  count gate OK — 47/47 pinned files present, no per-file decrease, 0 failing.

$ npx eslint <the three changed/new source files>
  (clean)

$ pytest tests/test_182_grounding_bundle.py -k external_action
  1 passed              ← V22, the D-20 server-side guard, still GREEN with a zero-line backend diff
```

**The count gate, COUNT columns — not the `failed` column (`D-188.2-DEF-01`), and this
time the FILE was named at every step (189-13's lesson):**

| Point | total | pinned files | pins moved |
|---|---|---|---|
| Baseline, re-derived before any edit | **2587** | 46/46 | — |
| After Task 1 | 2612 | **47/47** | `ExternalActionSection.test.tsx` **new pin, 25** |
| After Task 2 | **2619** | 47/47 | `GovernanceSection.test.tsx` 42 → 49 |

`PhaseFormPanel.test.tsx` (19) and `PhaseFormPanel.rails.test.tsx` (32) are **unmoved
beside the new suite** — the Phase-177 coverage-loss shape (a "net-new" file that quietly
REPLACES an existing one) made visible rather than assumed.

### Re-derived, not inherited

| Claim | How | Result |
|---|---|---|
| `tsc -p tsconfig.app.json` = 33 | run before any edit | ✅ **33** (and 33 after both tasks) |
| count gate **2508 / 45 files** (the plan's `<context>`) | run before any edit | ⚠ **STALE — 2587 / 46 of 46.** The FIFTH consecutive plan in this phase to inherit a stale gate figure |
| *"the new suite needs a `TARGETS` entry in the commit that creates it"* (plan + executor prompt) | read `TARGETS`, then ran the gate | ⚠ **FALSE.** `src/components/workflows` is already a **directory** entry, so the file RAN on creation. Only the `BASELINE` pin was owed. See Deviation 2 |
| *"the gate reports OK at 46 pinned files"* (plan acceptance) | run | ⚠ **47.** The plan's figure was derived from the stale 45 |
| `definitionOps.ts` exports **eleven** governance strings at `:450-502` (UI-SPEC) | `grep -c "^export const"` over the block | ⚠ **THIRTEEN, at `:456-541`** |
| the `GovernanceSection` mount is at `PhaseFormPanel.tsx:1046-1048` (PATTERNS) | symbol search | ✅ **exact** |
| `PHASE_TYPE_FRIENDLY` at `PhaseFormPanel.tsx:168-176` (UI-SPEC P3) | read | ⚠ **`:168-175`** — the map closes at 175; off by one at the end |
| `EXTERNAL_CAPABILITY_SENTENCES` is exported and closed at three | read + glob | ✅ `phaseVocabulary.ts:527`, and it is declared in **exactly one** non-test module in `frontend/src` (asserted by a src-wide `import.meta.glob`, with a positive control) |
| `EXTERNAL_ACTION_PHASE_TYPE` can be imported from `phaseVocabulary.ts` | grep | ⚠ **NO — it is module-PRIVATE** and pinned by a source test. A separate named gate was declared here rather than widening its export |
| the arming switch renders ON from the stored prop | read `requiredConfigFor` / `minimalPhaseFor` | ⚠ **FALSE — see Deviation 1** |

---

## Deviations from Plan

### 1. [Rule 1 — bug] ⚠ The switch would have rendered **OFF** on a freshly-placed step, and no planning document names it

- **Found during:** Task 2, reading `minimalPhaseFor` to write the fixture.
- **The issue.** UI-SPEC §7c says the switch *"renders in its ON position (`aria-checked="true"`)"* and D-04 says the value is structurally `true`. Both are true **of the server**: 189-07 pins `action_risk_armed` at the Pydantic level. But the panel reads `phase.action_risk_armed === true`, and **`minimalPhaseFor("external_action", …)` emits `{ capability: "send_email" }` and nothing else** — no `action_risk_armed`. So between placing the node and the definition's first server round trip, the prop is `false` and the shipped code would have painted the switch **OFF**: the exact lie D-04 exists to prevent, on the surface built to prevent it, in the interval where an author is actually looking at it.
- **Fix:** the rendered state is `armed = armPinned || actionRiskArmed`, where `armPinned` comes from the new named `ARM_PINNED_TYPES` gate. The rendered value is a fact about the TYPE that the stored bit merely echoes.
- **How it is guarded:** the case supplies **`actionRiskArmed: false` on purpose** and asserts `aria-checked="true"` — so a regression to reading the prop is red, not invisible.
- **Commit:** `368ef797`

### 2. [Documented, not auto-fixed] The `TARGETS` entry the plan required does not exist and must not

- The plan's action D and its acceptance criterion both require a `TARGETS` entry for the new suite "in the commit that creates the file", warning that earlier is an exit-2 error and later means it never runs.
- **Measured:** `TARGETS` already contains the **directory** `src/components/workflows`. The gate EXECUTED `ExternalActionSection.test.tsx` the moment it existed — checked by running the gate, not by reading the array. This is the same finding `GovernanceSection.test.tsx`'s own docblock recorded in 185 and `runVocabulary.test.ts`'s did in 189-10.
- **What WAS owed, and was added in-commit:** the `BASELINE` pin. 188-12's correction is the binding half — *an unpinned file is not lightly guarded, it is unguarded* — so the pin was not deferred "while the count grows". The reasoning is written into the gate beside the entry so the next plan does not re-litigate it.
- Consequence for the plan's other figure: pinned files **46 → 47**, not "OK at 46".

### 3. [Rule 3 — blocking] `EXTERNAL_ACTION_CAPABILITIES` cannot be EXPORTED from the component

- **Found during:** Task 1, `npx eslint` after the suite was already green.
- `react-refresh/only-export-components` is an **error** in this repo's config: a runtime export beside a component fails lint. (Measured on the analog: `GovernanceSection.tsx` exports two components and two TYPES, and no const — a shape that reads like style and is actually a constraint.)
- **Fix:** the const is module-private, and the suite reads the mirror from its ONE home, `EXTERNAL_CAPABILITY_SENTENCES` — which is the same object the component reads. The fence's subject is unchanged (the client's closed set vs the server's `Literal`), and two other guards keep the component honest about using it: a source assertion that it calls `Object.keys(EXTERNAL_CAPABILITY_SENTENCES)`, and a render assertion that the rows it actually paints equal those members in that order. **PLANT C proves the pair is not vacuous.**

### 4. [Rule 2] The picker's two sentences went to `definitionOps.ts`, not into the component

- The plan lists `definitionOps.ts` under Task 2's `<files>` only, but its must_have is unconditional: *"The new component AUTHORS NO SENTENCE OF ITS OWN … every user-visible string is an imported identifier."*
- `GovernanceSection.tsx` keeps its own `SECTION_HEADING` as a local const, so a local heading is precedented — but the strictest reading of the must_have was taken and **both** the heading and the note were exported from `definitionOps.ts`, where the suite can assert character-identity and a drift test can see them. `definitionOps.ts` is in the plan's own `files_modified`.
- The export counts are stated per task above so Task 2's *"exactly ONE"* criterion is checkable rather than muddied.

### 5. Out-of-scope, untouched

`scripts/_uat111*`, `scripts/_uat111_1/`, `scripts/pm-pack/out/`, `scripts/.sse_after_run1/` and the other pre-existing operator artifacts were **not staged, not modified, not deleted**. Every file in both commits was staged individually by path. `supabase/` and `backend/` were not touched, and **`requirements.mark-complete` was NOT run — CONN-01 stays `Pending`**, with two plans still owed (189-15, 189-16).

---

## Deferred Issues

- **UAT rows U1–U6 → 189-16.** Nothing here is a rendered check. jsdom applies no CSS and paints nothing, so the picker's rows, the amber refusal block and the pinned switch have been proved *structurally* and not *visually*. In particular: **no row of this plan proves the refusal block is legible on Deep Midnight**, and none proves the picker's selected row reads as selected without colour. Both are `evaluate_script` reads, not screenshots (`take_screenshot` times out in this estate).
- **`D-189-DEF-03` (189-11) is unchanged** — a live `external_action` run still shows "Complete" until reconcile. Phase 190's.
- **Cloud parity on migration 115 is still OWED** (standing queue, migs 099 onward).

## Authentication Gates

None.

## Known Stubs

**None.** The picker is wired to the panel's real write seam (`onChange` patches `config`, `onPersist` commits), its options come from the shipped closed set, and every state it can reach renders. No `TODO`, no "coming soon", no component receiving empty or mock data, no hardcoded empty value flowing to the UI.

## Threat Flags

None. This plan opens no route, reads no credential, makes no request and gains no privilege. Its own register is addressed rather than deferred:

| Threat | Disposition | Evidence |
|---|---|---|
| **T-189-05 / D-20** — EoP: the capability set becoming an author-facing option on OTHER step types | **mitigated** | The picker is mounted only under `pt === "external_action"`; its options come from a closed CLIENT constant, never `rails.toolOptions`; `toolOptions` was NOT widened (asserted on source by 189-13's guard, re-run green); **V22 re-run GREEN** with a zero-line backend diff. The panel's mount deliberately keeps the inline literal so 189-13's source fence stays non-vacuous. |
| **T-189-01** — EoP: the arming switch appearing to disarm this type | **mitigated** | `disabled` + `aria-disabled` + a handler guard, proven by a **DRIVEN CLICK**; **PLANT D** (attributes only) observed RED. The **six-type NEGATIVE CONTROL** is written first, so the pin cannot pass by disabling the switch everywhere. And Deviation 1 closed the interval where it would have read OFF. |
| **T-189-11** — Tampering: the client capability mirror drifting from the backend `Literal` | **mitigated** | A cross-language raw-source fence with a falsifiable extractor and a non-empty-haystack guard; **PLANT A** observed RED with the exact member diff. |
| **T-189-39** — Spoofing: a fabricated selection for an unknown stored capability | **mitigated** | Absent, unrecognised and inherited values all select nothing; **PLANT B** — the plausible wrong fix — observed RED. |
| **T-189-42** — Repudiation: a refusal reason delivered as a `title`, unreachable to a screen reader | **mitigated** | Real DOM text wired by `aria-describedby` with the id proved to resolve; **zero** `[title]` elements in the section; **PLANT F** observed RED on two independent nets. |
| **T-189-43** — Tampering: the component authoring its own sentences | **mitigated** | Every string imported and character-asserted; the component's source is asserted to contain **none** of the five sentences it renders; a `?raw` route/fetch/leaf fence with a positive control block. |
| **T-189-SC** — package installs | accept | **This plan installed NOTHING.** No npm package, no shadcn block, no registry read. |

## Self-Check: PASSED

| Claim | Verified |
|---|---|
| `frontend/src/components/workflows/ExternalActionSection.tsx` | FOUND |
| `frontend/src/components/workflows/ExternalActionSection.test.tsx` — 25 green | FOUND |
| `frontend/src/components/workflows/PhaseFormPanel.tsx` — the mount + the friendly label | FOUND |
| `frontend/src/components/workflows/definitionOps.ts` — `ACTION_RISK_LOCKED_REFUSAL` + the two authoring sentences | FOUND |
| `frontend/src/components/workflows/GovernanceSection.tsx` — `ARM_PINNED_TYPES` + the refusing switch | FOUND |
| `frontend/src/components/workflows/GovernanceSection.test.tsx` — 49 green (42 → 49) | FOUND |
| `scripts/vitest-count-gate.cjs` — the new pin + the moved pin, both in-commit | FOUND |
| `.planning/phases/189-.../189-14-SUMMARY.md` | FOUND |
| commits `0024e03e`, `368ef797` | FOUND in `git log` |
| `tsc --noEmit -p tsconfig.app.json` == 33 | **33** |
| `npx vite build` succeeds | **✓ built in 29.85s** |
| `src/components/workflows` sweep | **36 files / 2195 tests, 0 failed** |
| count gate OK, 47/47, no per-file decrease, 0 failing | **OK, 2619** |
| eslint clean on every file touched | **0 problems** |
| panel render-body insertions in single digits | **3 JSX lines (11 insertions / 0 deletions total)** |
| no plant residue — `grep -c "PLANT"` over the 4 production files touched | **0 / 0 / 0 / 0** |
| md5 restore of every planted source | `phaseVocabulary` `f759cd0a…` · `ExternalActionSection` `b8a57610…` · `GovernanceSection` `bbf756b4…` — identical before and after |
| `DIAL_TYPES` byte-identical to HEAD; the 189-07 D-26 docblock unchanged | **CONFIRMED — no `-` line touches either** |
| the six fenced card-subtree modules untouched | **zero-line diff across both commits** |
| `backend/` and `supabase/` untouched | **zero-line diff** |
| V22 green | **1 passed** |
| no file deleted in either commit | **CONFIRMED** |
| CONN-01 still `Pending` in REQUIREMENTS.md | **CONFIRMED — `requirements.mark-complete` not run** |
