---
phase: 193-authoring-doors-template-placement
plan: 09
subsystem: workflow-authoring-doors
tags: [AUTH-01, restack, D-04, D-22, characterization, re-capture, structure]
requires:
  - "193-03 — the `DoorHeaderStrip.tsx` extraction (G-5 honoured by construction; it is the file this restack lands on)"
  - "193-05 — `doorVocabulary.ts`, so the restack changes structure without touching a governed word"
  - "193-08 — variant D shipped AND re-capture 1 of 2 recorded; this plan is the second and final half of that pair"
provides:
  - "D-04's shape on the govern strip: quiet escape · borrowed divider · primary door label · badge at the far edge, byte-untouched"
  - "D-22's agreement: the describe band's escape demoted identically, PROVED equal by comparing the two `?raw` sources"
  - "A four-child order pin on BOTH `inline` values, with the badge asserted LAST"
  - "Re-capture 2 of 2 — the STRUCTURE re-capture, complement of 193-08's words-only one, with per-capture tag deltas published"
affects:
  - "UAT rows U3 (govern strip) and U3b (describe band) — the acceptance bar, because the sketch draws NO mockup of either"
  - "193-11 — owns the count-gate pin sweep; `DoorHeaderStrip.test.tsx` is now 16 cases (was 12) and `WorkflowDoorSwitch.test.tsx` 33 (was 28)"
tech-stack:
  added: []
  patterns:
    - "`CanvasToolbar.tsx:212` decorative-rule idiom, borrowed verbatim rather than a new border utility"
    - "`starter-door-trigger` quiet-text-button treatment (underline on hover/focus-visible), borrowed for the demoted escape"
    - "assert-by-child-order with the LENGTH CHECK FIRST (192.1 / S-4), extended to a four-node strip"
    - "cross-component source equality: two class strings extracted from two `?raw` sources and compared, because no single DOM renders both"
    - "re-capture by VALIDATED ENCODER: re-encoding every OLD literal must reproduce the file's own bytes before one new byte is written"
key-files:
  created: []
  modified:
    - frontend/src/components/workflows/DoorHeaderStrip.tsx
    - frontend/src/components/workflows/DoorHeaderStrip.test.tsx
    - frontend/src/components/workflows/WorkflowDoorSwitch.tsx
    - frontend/src/components/workflows/WorkflowDoorSwitch.test.tsx
    - frontend/src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx
    - frontend/src/pages/WorkflowBuilderPage.header.test.tsx
decisions:
  - "D-03 / D-04 shipped: the escape drops its box, gains a borrowed divider, and the badge is byte-untouched — `git diff -U0` matches NO line naming it"
  - "D-22 shipped: the describe band demoted identically and NOT folded into the extracted strip — the non-action is an assertion, not an absence"
  - "D-05 survives: the `ml-auto` pair and the band-literal equality passed with ZERO edits"
  - "D-06 stays rejected: the control did not move into the host-band slot"
  - "Re-capture 2 of 2 is STRUCTURE-ONLY, and proved so: the ordered sequence of non-empty text nodes is identical in all six captures and all three bands"
  - "The 187-24 prose trap was worked AROUND, not fed: three grep criteria made their own tokens unusable in the touched file's prose, so the prose names them obliquely and says why"
metrics:
  duration: ~40 min
  completed: 2026-08-13
  tasks: 3
  commits: 3
  base_sha: 4037ff8cdbb18555a9ae60e08ddddfd619d9e642
  head_sha: 4ab5fa5a
---

# Phase 193 Plan 09: The Header-Strip Restack Summary

**The escape hatch stops reading as a peer of the door you are standing in — on BOTH doors — and
the second and final re-capture of the phase is proved to contain exactly two tag deltas and not
one changed word.**

---

## What shipped

### Task 1 — the govern strip restacked · commit `6e0bc162`

`DoorHeaderStrip.tsx`. The return control's class list goes:

```
before   rounded-md border border-border px-2.5 py-1 text-[13px] text-muted-foreground hover:text-foreground
after    px-1 py-1 text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground
         hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none
```

⚠ **These classes are DISCRETIONARY and have no mockup** (CONTEXT § Claude's Discretion). They are
named here in full because **UAT rows U3 and U3b are their only acceptance bar** and a row that
cannot name what it is judging cannot judge it. The `focus-visible:` trio is not decoration: the
box carried the only visible focus affordance, so dropping the outline without replacing it would
have been an accessibility regression smuggled in under a legibility fix. The treatment is
borrowed from the shipped quiet text button one screen away (`starter-door-trigger`), not invented.

The divider, inserted between the escape and the door label:

```tsx
<span aria-hidden="true" className="mx-0.5 h-4 w-px bg-border" />
```

`CanvasToolbar.tsx:212` **verbatim** — already in the token vocabulary, already `aria-hidden`,
already used to separate groups in a toolbar strip. No testid, deliberately: it is decoration.

The badge is byte-untouched, and that is measured rather than promised —
`git diff -U0 -- DoorHeaderStrip.tsx | grep -c "judge-locked\|ml-auto\|judge always-on"` → **0**.

### Task 2 — the describe band demoted identically · commit `2d4ab344`

`WorkflowDoorSwitch.tsx`. Same class string, **character for character** (Task 3 proves it by
machine). No divider: no locked-judge badge lives on that door, so a rule there would be a mark
dividing one thing from nothing. Nothing else in the band moved — the host-lead conditional, the
wrapper classes, the primary label span and `goBoth` are untouched, and the `DoorHeaderStrip`
mention count is unchanged at **7**.

### Task 3 — the shape pinned, and re-capture 2 of 2 · commit `4ab5fa5a`

Four suites, +9 cases net, all green.

---

## The proofs

### RED-first — four real plants in real files, each restored md5-identical

| # | Plant | Failure observed |
|---|---|---|
| **A** | re-box the govern control | `× standalone/inline: the return control's OWN node lost its box and kept its nature (D-04)` — `AssertionError: expected [ 'rounded-md', 'border', …(11) ] to not include 'border'` |
| **B** | delete the divider node | 4 cases red, incl. `AssertionError: expected [ <button …(3)></button>, …(2) ] to have a length of 4 but got 3` and `AssertionError: expected null to be 'true'` |
| **C** | diverge the describe control's class list | `× the two return-control class strings are EQUAL, character for character` — `AssertionError: expected 'rounded-md border border-border px-2.…' to be 'px-1 py-1 text-[13px] text-muted-fore…'` |
| **D** | plant a divider on the describe band | `× the describe band carries NO divider` — `AssertionError: expected [ <button …(3)></button>, …(2) ] to have a length of 2 but got 3` |

**md5 pairs — both sources restored identical after every plant:**

```
DoorHeaderStrip.tsx     1d37e6c4036c23fe9a65434853f73f94   before A / after A / after B
WorkflowDoorSwitch.tsx  1fd6fabb9fc401803d9b4426770a86e7   before C / after C / after D
```

### Re-capture 2 of 2 — STRUCTURE, and it is measured

**Method.** Each suite's OWN driver (`doorCapture`, `headerMarkup`), run **twice**, agreeing byte
for byte — `md5sum` on the two emitted payloads identical in both cases. Substituted by script,
never hand-edited. ⚠ **The encoder was VALIDATED BEFORE IT WAS TRUSTED**: re-stringifying every
*existing* literal had to reproduce each file's own bytes exactly, or the substitution refused to
run. Both files are CRLF, and that was caught by the validator rather than by luck.

`WorkflowDoorSwitch.baseline.test.tsx` — **4 changed lines, not 6**:

| capture | tag deltas | non-empty text nodes |
|---|---|---|
| CHOOSER_STANDALONE | **NONE — literal untouched** | 16 → 16, identical sequence |
| CHOOSER_INLINE | **NONE — literal untouched** | 17 → 17, identical sequence |
| DESCRIBE_STANDALONE | 1 return-control class list | 24 → 24, identical sequence |
| DESCRIBE_INLINE | 1 return-control class list | 25 → 25, identical sequence |
| GOVERN_STANDALONE | 1 class list **+ 1 INSERTED rule span** | 14 → 14, identical sequence |
| GOVERN_INLINE | 1 class list **+ 1 INSERTED rule span** | 16 → 16, identical sequence |

`WorkflowBuilderPage.header.test.tsx` — **1 changed line, not 3**:

| band | tag deltas | non-empty text nodes |
|---|---|---|
| 1 (breadcrumb) | **NONE — line byte-identical** | 3 → 3, identical sequence |
| 2 (the door band) | 1 class list **+ 1 INSERTED rule span** | 4 → 4, identical sequence |
| 3 (save cluster) | **NONE — line byte-identical** | 4 → 4, identical sequence |

The two permitted deltas, in full, and there were no others anywhere:

```
+ <button type="button" data-testid="both-doors" class="px-1 py-1 text-[13px] text-muted-foreground
    underline-offset-2 hover:text-foreground hover:underline focus-visible:text-foreground
    focus-visible:underline focus-visible:outline-none">
- <button type="button" data-testid="both-doors" class="rounded-md border border-border px-2.5 py-1
    text-[13px] text-muted-foreground hover:text-foreground">
+ <span aria-hidden="true" class="mx-0.5 h-4 w-px bg-border"></span>      (GOVERN rows + band 2 only)
```

⚠ **NOT ONE RENDERED WORD MOVED — and how that is measured is the load-bearing part.** A naive
index-wise diff of `split(/<[^>]*>/)` slots reports **21, 23 and 8** "changed" text nodes in
`GOVERN_STANDALONE`, `GOVERN_INLINE` and band 2. **Every one of those is the INDEX SHIFT an
inserted node causes**, and that artefact is exactly what would let a real word change hide inside
a structural re-capture. Compared as an **ordered sequence of non-empty text nodes**, all six
captures and all three bands are identical element for element. This is the precise complement of
193-08's proof, which held structure fixed and enumerated the word changes.

**Re-capture 2 of 2. The phase expects no third**, and both files now say so in their own
docblocks beside the dated 193-08 note, with the retired figures left standing.

### What was pinned

- **Child order, both `inline` values**: `[return control] [divider] [door label] [judge badge]`,
  **length checked first**, badge asserted **LAST** in both variants (D-04's far edge).
  The count went **3 → 4 in the restack's own commit** — which is precisely what 193-03 pinned it
  for, and the same deal is left for the next author.
- **The divider is decorative**: `aria-hidden="true"`, `textContent === ""`, zero child nodes, and
  the strip's whole text equals its other three children's concatenated — so a divider that ever
  gained a character reds rather than being read aloud (T-193-37).
- **The control's OWN node** carries no `border` / `border-border` / `rounded-md` token, is still a
  `<button type="button">`, and is still child 0 (T-193-36). Asserted on that node, never on the
  strip — the app's band wrapper legitimately carries a border, so the same check one level up
  would pass or fail for entirely the wrong reason.
- **D-22 by machine**: both class strings extracted from the two `?raw` sources and asserted equal,
  with an extractor positive control, a throw-on-absent negative, non-vacuity on both subjects, and
  a **one-control-per-source** check so the non-greedy match cannot read across into a neighbour's
  class list. The describe band is proved to carry no rule node, **with the govern band as the
  positive control that the same two queries DO find one** (192.1's *could it fire?* rule).
- **The deliberate non-action is an assertion**, not an absence: the describe band region — bounded
  **by content**, never by a character count — contains `both-doors` and does **not** contain
  `<DoorHeaderStrip`, with a positive control that the component *is* mounted elsewhere in the file.
- **D-05 survived untouched**: the 193-03 `ml-auto` pair and the band-literal class equality passed
  with **zero edits**.

---

## Deviations from Plan

### [Rule 2 — required for correctness] The demoted control keeps a visible focus affordance

**Found during:** Task 1. D-04 says "plain muted text"; taken literally, dropping the box removes
the only visible focus indicator the control had. **Fix:** the class list gains
`focus-visible:text-foreground focus-visible:underline` alongside `focus-visible:outline-none`,
copied from the shipped `starter-door-trigger` treatment one screen away rather than invented.
⚠ Note that `axe` would **not** have caught the absence — 193-07 already measured that row staying
green against a genuinely broken relationship — which is why this is asserted by construction and
named here rather than left to a scanner. **Files:** `DoorHeaderStrip.tsx`, `WorkflowDoorSwitch.tsx`.
**Commits:** `6e0bc162`, `2d4ab344`.

### [Rule 1 — correction on measurement] One pre-existing POSITIVE CONTROL re-anchored

`DoorHeaderStrip.test.tsx`'s positive control read the return control's class list for
`rounded-md` — a token the demotion removes. **It was re-anchored on `text-muted-foreground`, not
deleted.** Its job is unchanged: prove the reader really reads the named node's own list, so
`"".split(" ")` cannot masquerade as a passing absence. A positive control dropped because the
token it named moved leaves the negative half of its pair passing on a broken lookup forever. The
edit and its reason are recorded in the file's docblock. **Commit:** `4ab5fa5a`.

### [Rule 3 — a criterion corrected by scoping, never by mutilating prose] The 187-24 trap, fired a fifth time

Three of Task 1's acceptance criteria are greps over the very file whose docblock must explain the
change: `headerLead` → 0, `judge-locked|ml-auto|judge always-on` → 0 on changed lines, and
`w-px bg-border` → exactly 1. **Written naturally, the required prose would have tripped all
three.** The docblock therefore names those things obliquely — "the host-band slot that renders
only when `inline` is true", "the locked-judge badge", "the far-edge push class" — **and says
inside the file that it is doing so, and why.** The gates were not weakened and the prose was not
mutilated; this is the fifth firing of the trap in Phase 193 and the correction shape is the same
one 193-05 and 193-08 used.

### Not a deviation, stated so it is not read as one

- **Count-gate pins were NOT raised.** Task 3 says `193-11` owns that sweep, and it does. The gate
  passes on `no per-file decrease`, so the two suites that grew (`DoorHeaderStrip.test.tsx` 12 → 16,
  `WorkflowDoorSwitch.test.tsx` 28 → 33) are green while under-pinned. ⚠ The dispatch note said
  pinning one's own new cases was ratified in Wave 3; **the plan's explicit instruction was
  followed instead**, since 193-11 will sweep both anyway and a partial raise is harder to audit
  than none.
- **`WorkflowBuilderPage.tsx` was NOT touched.** The known ungoverned second copy of the CTA and
  the three hint fragments is still there and is still visible in the two `GOVERN_*` captures —
  it is deferred pending an operator decision and belongs to no plan in this phase.
- **`GSD_VITEST_MAX_WORKERS=2`** was used for every run, per the dispatch measurement, not the `=4`
  written into the plan's `<worktree_protocol>`. No worktree bootstrap was run: this executed on the
  primary tree.

---

## Verification

| Check | Result |
|---|---|
| `tsc --noEmit -p tsconfig.app.json` | **33** errors — baseline, unmoved |
| `eslint src/components/workflows/DoorHeaderStrip.tsx` | 0 / 0 (default + `eslint.a11y.config.js`) |
| `eslint src/components/workflows/WorkflowDoorSwitch.tsx` | 0 / 0 (default + `eslint.a11y.config.js`) |
| `eslint src/components/workflows/` | 10 — all inherited, **0 in either touched source** |
| the four touched suites | **98 passed / 98** |
| `node ../scripts/vitest-count-gate.cjs` (cap 2) | **exit 0** · total **3557** · **failed 0** · 67/67 pinned files present · no `[count-decrease]` |

The count gate executes the whole frontend suite, so `failed 0` at 3557 covers `src/pages/` and
`src/components/workflows/` in one measurement.

---

## Threat register — dispositions discharged

| Threat | How |
|---|---|
| **T-193-36** DoS of the escape route | Still a real `<button type="button">` with its handler; child-order case asserts it present and FIRST in both variants; a11y eslint clean on both files; **D-06 stays rejected** so the standalone band never loses its way back |
| **T-193-37** decorative node in the a11y tree | `aria-hidden="true"` (the shipped idiom), empty, zero children, and the strip's `textContent` proved to equal its other three children's concatenated |
| **T-193-38** the badge moved under cover of the restack | `git diff -U0` over `DoorHeaderStrip.tsx` matches **0** lines naming the badge, its testid or its far-edge push class; badge asserted LAST in both variants; the 193-03 `ml-auto` pair passes unchanged |
| **T-193-39** a regression absorbed into a "legitimate re-capture" | Per-capture tag deltas published above; exactly two shapes permitted and exactly two found; text proved unchanged **as a sequence**; `[count-decrease]` clean |
| **T-193-40** the two bands claimed to agree while differing | Asserted by extracting BOTH class strings from `?raw` sources and comparing — driven RED by plant C |
| **T-193-SC** package installs | **Zero packages installed.** The divider is a shipped Tailwind idiom; no icon library, no separator component |

---

## What the next agent needs

- **UAT rows U3 and U3b are owed and are the ONLY acceptance bar for this plan's pixels.** The
  sketch draws no mockup of either band. The exact classes to judge are named at the top of this
  file. Drive both `inline` values: the standalone govern band, the govern band merged into the
  Builder's header row (canvas gate ON), and the describe door's band.
- **`193-11`** inherits two under-pinned suites: `DoorHeaderStrip.test.tsx` **16** (pinned 12) and
  `WorkflowDoorSwitch.test.tsx` **33** (pinned 28).
- **No third re-capture is expected in Phase 193.** Both re-capture notes now live in the files
  themselves; a third would be a behaviour change to explain in its own plan.

## Self-Check: PASSED

All six declared files exist; all three commits (`6e0bc162`, `2d4ab344`, `4ab5fa5a`) are present in
`git log`; the working tree under `frontend/src` is clean.
