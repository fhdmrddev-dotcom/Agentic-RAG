---
phase: 217-the-library-one-home-for-documents
plan: 06
subsystem: frontend-design-system
tags: [shared-primitive, design-tokens, theme-parity, wcag, source-fence, sketch-contract]
requires:
  - ".planning/sketches/218-the-library-and-its-tabs/drive.cjs (fences A3b / A4 / A4b — the recorded inversion)"
  - "217-RESEARCH.md § D-217-20/21 — the tabs primitive, measured in tokens"
  - "frontend/src/components/workflows/library/gutterTokens.fences.test.ts:85-124 (the node:fs-over-?raw CSS idiom)"
provides:
  - "frontend/src/index.css — the --tab-active token pair, :root 0 0% 100% and .dark 220 25% 16%"
  - "frontend/tailwind.config.js — the tab-active colour mapping, so bg-tab-active resolves"
  - "frontend/src/components/ui/tabs.tsx — the corrected TabsTrigger: bg-tab-active + an inset ring"
  - "frontend/src/components/ui/__tests__/tabsContrast.test.ts — 14 cases; the FIRST suite in src/components/ui"
  - "a regenerated BUILD-CONTRACT.generated.md at 197 assertions"
affects:
  - "frontend/src/pages/SettingsPage.tsx — inherits a lighter, ringed active tab in BOTH themes; no Settings-local branch touched"
  - "frontend/src/pages/KnowledgeHealthPage.tsx — same, and its four tabs are pinned by sketch fence A9"
  - "the Library's own tab shell (217-09) — it mounts this primitive, so it inherits the fix by construction"
tech-stack:
  added: []
  patterns:
    - "the BLOCK-SELECTION CONTROL: when a fence parses per-theme CSS blocks, assert a token whose two values DIFFER — a wrong-block read is finite and passes every 'is it a number?' non-vacuity check"
    - "the RENAME MAP fence (A7b / A9c precedent) applied to a CLASS rather than a word: the replaced class is recorded in the fence, asserted GONE, its replacement asserted PRESENT"
    - "the second cue is an INSET RING (ring-1 ring-inset ring-border), which composes with shadow-sm through Tailwind's separate --tw-ring-shadow / --tw-shadow slots and changes no box size"
key-files:
  created:
    - "frontend/src/components/ui/__tests__/tabsContrast.test.ts"
  modified:
    - "frontend/src/index.css"
    - "frontend/tailwind.config.js"
    - "frontend/src/components/ui/tabs.tsx"
    - ".planning/sketches/218-the-library-and-its-tabs/drive.cjs"
    - ".planning/sketches/218-the-library-and-its-tabs/BUILD-CONTRACT.generated.md"
decisions: [D-217-02, D-217-11, D-217-20, D-217-21]
metrics:
  duration: "~30 min"
  completed: "2026-08-29"
  tasks: 3
  commits: 3
---

# Phase 217 Plan 06: The tab-bar inversion Summary

The shared `components/ui/tabs.tsx` primitive now paints the selected tab **lighter than its
track in both themes** from a new theme-paired `--tab-active` token, plus a second non-colour
cue (an inset ring) — closing the Deep Midnight inversion where the active tab measured
**seven lightness points darker** than the strip it sat in.

## What shipped

| Commit | What |
|---|---|
| `da73cfbf0` | `--tab-active` in both `index.css` blocks + the `tab-active` Tailwind mapping |
| `5f3247cae` | `TabsTrigger`: `bg-tab-active` + `ring-1 ring-inset ring-border`, `shadow-sm` kept |
| `b484f3901` | `tabsContrast.test.ts` (14 cases) + `drive.cjs` A3b rewritten as a rename map + `--emit` |

## The final token values, and the contrast measured rather than assumed

Assumption **A6** was open at plan time — the plan required the `--foreground`-over-`--tab-active`
ratio to be COMPUTED before the recommended values were committed. It was, in a scratch script
first and then inside the suite itself. Both clear the WCAG 2.1 AA 1.4.3 normal-text floor
comfortably, so the recommended values stood unchanged:

| Theme | `--tab-active` | L | `--muted` (the track) | Δ | `--foreground` over it |
|---|---|---|---|---|---|
| `:root` (light) | `0 0% 100%` | 100% | 94% | **+6** | **17.87 : 1** |
| `.dark` (Deep Midnight) | `220 25% 16%` | 16% | 11% | **+5** | **14.06 : 1** |

The property that matters is the **sign being the same in both themes**. What shipped before was
`--background`: light 97% over 94% (`+3`, correct) and dark 4% over 11% (`−7`, a hole). A NEW token
was required rather than a swap, and that was measured, not assumed — `--card` fails dark (7 < 11),
`--accent` fails light (92 < 94), `--background` fails dark, which is the bug itself.

`--background`, `--muted`, `--card`, `--accent` and `--border` are **byte-unchanged** (verified with
`git diff -U0 | grep` over those five declarations). Sketch fences `A4` / `A4b` measure `--muted`
against `--background` and still read `+3` / `−7` — the recorded finding is intact, not re-pointed.

## ⚠ The other surfaces this necessarily changes — a shared-primitive edit, not a Library edit

`grep -rln 'from "@/components/ui/tabs"'` returns exactly **two** non-test mounts today; the
Library's own tab shell (217-09) is the third. **Neither page is in this plan's `files_modified`,
and that is the point** — no Settings-local or Health-local branch was touched. They receive a
different rendering of a primitive they already mount.

Triples **re-derived from git in this worktree**, not copied from the CLAUDE.md ledger cells:

| File | commits / phases / lines | G-5 | What it inherits |
|---|---|---|---|
| `frontend/src/pages/SettingsPage.tsx` | **39 / 21 / 1500** | ⚠ FIRES | every tab across every Settings section: a lighter, ringed active chip in dark, and 100% vs 97% in light |
| `frontend/src/pages/KnowledgeHealthPage.tsx` | **11 / 5 / 571** | ⚠ FIRES | its four tabs (`most-retrieved` / `never-retrieved` / `stale` / `low-confidence`), which sketch fence `A9` pins by name |
| `frontend/src/components/ui/tabs.tsx` | **3 / 3 / 78** (was 2 / 2 / 53) | ⚠ **FIRES — it crossed the threshold IN THIS COMMIT** | — |

⚠ **`tabs.tsx` has no row in the CLAUDE.md hot-file ledger and did not need one until now** — it sat
at 2 phases (`043-02` install, `48-02` a transition fix) for the project's whole life and crossed to
**3** here. It is a shared primitive with three mounts, so it is exactly the shape the ledger's
completeness rule exists for. A row + a `docs/HOT-FILE-LEDGER.md` section are **OWED**; they are not
added here because `CLAUDE.md` and `docs/HOT-FILE-LEDGER.md` are outside this plan's `files_modified`
and are shared artifacts three wave-2 agents could race on. **Re-open trigger: the next phase whose
`files_modified` names `frontend/src/components/ui/tabs.tsx`, or 217's close, whichever is first.**

The token change is broader still and is stated rather than left implicit: `--tab-active` is a NEW
token, so it cannot regress anything that does not read it. **Only `bg-tab-active` reads it, and
only `TabsTrigger` writes that class** (`grep -rn "tab-active" frontend/src` → `index.css`,
`tabs.tsx`, `tailwind.config.js`, and this plan's suite). No existing token's value moved.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocking] `index.css` cannot be read through `?raw` under vitest**

- **Found during:** Task 3, first run of the new suite.
- **Issue:** The plan's `read_first` prescribed the `?raw` + CRLF discipline. Under vitest 4.1.0
  `test.css` defaults to `false`, so every CSS module — query string and all — is replaced with the
  empty string. `import cssSource from "@/index.css?raw"` resolved fine, `length` **0**, nothing
  threw and nothing warned. Nine cases went red, the first reading `expected 0 to be greater
  than 8000`.
- **Fix:** Adopted the already-documented, already-measured idiom from
  `frontend/src/components/workflows/library/gutterTokens.fences.test.ts:85-124` — a runtime
  `vi.importActual("node:fs")` (no static `node:*` specifier, so the `types: ["vite/client"]` tsc
  baseline is unmoved) with the path derived from `import.meta.url` by string surgery rather than
  `new URL(…, import.meta.url)`, which Vite statically rewrites into an asset reference.
- **Why it is recorded rather than waved through:** the failure mode is silent. Had the suite been
  written with the absence assertions first, it would have swept `""` and read green over nothing —
  the exact 192.1 failure that subtree keeps recording. **The length + identity non-vacuity block is
  what turned it into a red instead of a lie.**
- **Files:** `frontend/src/components/ui/__tests__/tabsContrast.test.ts` · **Commit:** `b484f3901`

**2. [Rule 1 - Bug] ⭐ `drive.cjs`'s `lightness()` block finder is positionally fragile, and it bit**

- **Found during:** Task 1, verifying the token values by parsing them back.
- **Issue:** `drive.cjs:129-134` locates a theme block with `css.indexOf(blockStart)` and then
  regex-searches FORWARD for the token. **The first literal `.dark` in `index.css` is at line 37,
  inside a Phase-192.2 PROSE COMMENT** (*"promoted OUT OF `.dark`-only"*), ~80 lines above the real
  `.dark {` selector. So "the dark block" actually begins in the middle of `:root`. Parsing the
  freshly-added `--tab-active` (declared at line 110, BELOW line 37) returned **100** — the LIGHT
  value — as the dark one. Measured, not theorised.
- **Why `A4` / `A4b` are nonetheless correct today, and were left alone:** `--muted` (line 29) and
  `--background` (line 19) are both declared **above** line 37, so the forward search still lands on
  their `.dark` declarations. They pass **by accident of ordering**, not by construction.
- **⚠ Why the obvious guard would not have caught it:** `100 > 11` PASSES. `100` is finite, so the
  plan's required per-parse non-vacuity control (*"each parsed lightness is a finite number, not
  `null`"*) passes too. A wrong-block read is invisible to every check except one that proves the
  two blocks are genuinely different.
- **Fix:** The vitest suite ports the *technique* and not the block finder — it strips `/* … */`
  comments first, then brace-matches the real `:root { … }` and `.dark { … }` bodies. It adds a
  **BLOCK-SELECTION CONTROL** asserting `L(--background)` is `97` in `:root` and `4` in `.dark`:
  two values 93 points apart, so any finder that returns the same body twice, or starts `.dark`
  inside `:root`, reds immediately.
- **Not fixed in `drive.cjs`, deliberately:** the plan's acceptance criterion requires
  `git diff drive.cjs` to show a hunk at `A3b` and **no hunk at `A4` / `A4b`**, and `lightness()`
  sits directly above `A4`. Editing it would touch that region and would change what two fences the
  plan explicitly protects actually measure. **The fragility is recorded here and in the suite's
  docblock; the next fence that parses a token declared below line 37 must not use that parser.**
- **Files:** `frontend/src/components/ui/__tests__/tabsContrast.test.ts` · **Commit:** `b484f3901`

### Judgement calls, stated rather than left implicit

- **The rename map lives in `drive.cjs`, not in `COPY.js`.** The `A7b2` / `A9c` precedents record
  the replaced word in `COPY`, but `COPY.js` is outside this plan's `files_modified`. The replaced
  class is instead recorded as a named constant in the fence itself
  (`TAB_ACTIVE_CLASS_REPLACED = "data-[state=active]:bg-background"`), so the rename is still
  auditable from the artifact that asserts it.
- **Two extra fences were added beside `A3b`**, not one: `A3b2` pins the second cue (inset ring
  present, `data-[state=active]:border` absent — the reflow guard) and `A3b3` pins the absence of a
  per-surface flag, which is D-217-20's rejected alternative. Both are inside the `A3b` hunk.

## The RED that was driven, and the restore

The plan required the suite to fail when `--tab-active`'s dark value is set below `--muted`.
**Observed, verbatim:**

```
× ⭐ dark: the same SIGN — this is the arm that shipped inverted
AssertionError: expected 6 to be greater than 11
Tests  1 failed | 13 passed (14)
```

The plant was `220 25% 16%` → `220 25% 6%`. `index.css` was then restored and verified
**md5-identical** to its pre-plant state (`2b45228c4da3acfeca4fa480d6219780`), with `git status`
clean for that file. ⚠ The first restore attempt (`sed -i`) rewrote the file's CRLF endings to LF;
`git diff` showed an empty content diff while `git status` showed ` M`. The file was restored
byte-exactly with `git checkout -- frontend/src/index.css` (the file was already committed in
Task 1). **A guard nobody has seen fire is not a guard — and a "restore" that changes bytes is not
a restore.**

The block-selection control's RED was also observed, and it was not planted: the `indexOf` parser
genuinely returned `100` for the dark block before the brace-matching finder replaced it.

## Verification

| Check | Result |
|---|---|
| `npx vitest run src/components/ui/__tests__/tabsContrast.test.ts --maxWorkers=2` | ✅ **14 passed / 0 failed** (first green run, then again after the restore) |
| `node .planning/sketches/218-the-library-and-its-tabs/drive.cjs` | ✅ **197 passed · 0 failed · 197 assertions** (was `194 passed · 1 failed` with A3b firing by design) |
| `npx tsc --noEmit -p tsconfig.app.json` | ✅ **33 errors** — identical to the pre-plan baseline; **0 new** |
| `grep -c -- "--tab-active" frontend/src/index.css` | ✅ `2` (one per theme block) |
| `grep -n "tab-active" frontend/tailwind.config.js` | ✅ one mapping line (`:72`) |
| `grep "data-[state=active]:bg-background" tabs.tsx` | ✅ 0 hits |
| `grep "data-[state=active]:border" tabs.tsx` | ✅ 0 hits — the cue is a shadow |
| `grep "variant" tabs.tsx` | ✅ 0 hits |
| exports | ✅ `export { Tabs, TabsList, TabsTrigger, TabsContent }` unchanged |
| `git diff drive.cjs` hunk boundaries | ✅ one hunk, `@@ -118,9 +118,29 @@`, spanning `A3`…`A3c` only — **no hunk at `A4`, `A4b`, `A5*` or `A7*`** |
| `BUILD-CONTRACT.generated.md` | ✅ regenerated by `--emit` in the same commit; diff is one line, `195` → `197` |
| no other suite references the changed class | ✅ `grep -rln "state=active\]:bg-background\|bg-tab-active"` over all `*.test.ts(x)` returns only this plan's own suite |

### ⚠ Which side of the count gate this suite is on

**`src/components/ui` appears in NEITHER knob** — `grep -n "components/ui" scripts/vitest-count-gate.cjs`
returns **nothing**, so the directory is in neither `TARGETS` nor `BASELINE`. TARGETS decides what
RUNS; BASELINE decides what is GUARDED, and this suite is on the wrong side of **both**. It is
therefore invisible to the gate and its 14 cases do not appear in any total. **Plan 12 owns the
pins** (the plan says so explicitly, and `scripts/vitest-count-gate.cjs` is outside this plan's
`files_modified` and is a hot shared file three wave-2 agents could race on). The gate was not run
here: nothing in this plan's diff is inside a gated path, and a sibling agent was active.

### Owed — stated as a decision, never as a claim that everything ran

A token fence proves lightness. **It cannot prove perception, and jsdom cannot help**: every
`getBoundingClientRect` is zero and no colour is composited. These stay OWED:

- **G4-7** — toggle Deep Midnight ↔ light with a tab bar visible, and watch the selected tab.
- **G4-8** — open **Settings** and **Library Health** after this change (the regression targets for
  threat `T-217-20`; neither page is in `files_modified` and both inherit).
- **M-3** — the chip reads as **raised**, not merely *different*. This is the one D-217-21 is
  actually about, and it is the one no automated check in this plan can score.

**Run G4-8 first** — it is the only row that covers a surface this plan changed without editing.

## Threat model

| Threat | Disposition | Status |
|---|---|---|
| `T-217-20` — collateral regression on the two inheriting mounts | mitigate | ✅ confined to the shared primitive; no page-local branch edited; verified by grep that no other suite asserts on the changed class. ⚠ Its real coverage is manual row G4-8, which is OWED |
| `T-217-21` — active-tab text contrast | mitigate | ✅ closed by measurement: 17.87:1 light / 14.06:1 dark, both asserted IN the suite against a `4.5` constant, with the ratio function itself controlled (identical colours → 1, black on white → 21) |
| `T-217-22` — colour as the only cue | mitigate | ✅ the inset ring is required by the class string and asserted by both the `?raw` fence and sketch fence `A3b2`; the border form is asserted ABSENT so nothing reflows |
| `T-217-SC` — package installs | mitigate | ✅ none; no dependency added |

## Known stubs

None. Every surface this plan touches renders from real tokens.

## Self-Check: PASSED

- `frontend/src/index.css` — FOUND (contains `--tab-active` ×2)
- `frontend/tailwind.config.js` — FOUND (contains `tab-active`)
- `frontend/src/components/ui/tabs.tsx` — FOUND (contains `data-[state=active]:bg-tab-active`)
- `frontend/src/components/ui/__tests__/tabsContrast.test.ts` — FOUND
- `.planning/sketches/218-the-library-and-its-tabs/drive.cjs` — FOUND (197 assertions, 0 failing)
- `.planning/sketches/218-the-library-and-its-tabs/BUILD-CONTRACT.generated.md` — FOUND (197)
- commits `da73cfbf0`, `5f3247cae`, `b484f3901` — all present in `git log`
