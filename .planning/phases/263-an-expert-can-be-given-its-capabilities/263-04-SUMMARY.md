---
phase: 263-an-expert-can-be-given-its-capabilities
plan: 04
subsystem: experts / skills authoring UI
tags: [react, vitest, tdd, sketch-263-A, count-gate-adoption, PACK-14, PACK-15, PACK-16]

plan_base_commit: 14195207fbcf806a2ef37d1209b2126537e7a354
phase_base_commit: 48976e11e71a5986483546a5625e18064c3c474b   # READ from 263-01-SUMMARY.md, never re-derived

requires:
  - phase: 263-02
    provides: "ExpertDraftOutput.suggested_new_skills (REQUIRED, empty-able) + AuthoredSkillBody"
  - phase: 263-03
    provides: "draftSkillBody / ExpertMemberSkillsUnknownError / SkillBodyDisabledError / SuggestedNewSkill on the client"
provides:
  - "ProposedSkillCard — the ONE home of the dashed ⬡ 'does not exist' mark"
  - "SkillFormDialog.initialValues — pre-fill WITHOUT becoming an edit dialog"
  - "The studio's two headed groups, the held Save from BOTH entry points, and the approval round trip"
  - "SkillFormDialog.test.tsx adopted into BOTH count-gate knobs — it had run NOWHERE"
affects: [263 phase close, BUG-260921-01, SEED-303 S9]

tech-stack:
  added: []          # ⭐ this plan installs NOTHING — T-263-SC has no subject
  patterns:
    - "a design-system token string is COPIED verbatim, never re-expressed — and copied as a plain string, not through `cn()`, when a fence asserts it token-by-token"
    - "an UNREAD list and an EMPTY list are different facts; catching a fetch to `null` rather than `[]` is what keeps an advisory fence from becoming a lock"
    - "a `vi.mock` literal factory breaks the BARREL, not only the consumer — `lib/api.ts` re-exports BY NAME"
    - "keep a fence's own token OUT of prose, or `grep -c … == 0` can never be used again"

key-files:
  created:
    - frontend/src/components/experts/ProposedSkillCard.tsx
  modified:
    - frontend/src/components/skills/SkillFormDialog.tsx
    - frontend/src/components/skills/SkillFormDialog.test.tsx
    - frontend/src/components/experts/ExpertAuthoringStudio.tsx
    - frontend/src/components/experts/__tests__/ExpertAuthoringStudio.test.tsx
    - frontend/src/components/experts/__tests__/OrgExpertsTab.test.tsx
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
    - .planning/seeds/SEED-303-an-expert-adds-scope-it-does-not-replace-it.md
  byte_unchanged_by_assertion:
    - frontend/src/lib/api/skills.ts
    - frontend/src/types/index.ts
    - backend/app/api/skills.py

key-decisions:
  - "The count-gate entry is an ADOPTION, not a raise: `grep -ic skill scripts/vitest-count-gate.cjs` read 0 at the base"
  - "`listSkills` catches to `null`, not `[]` — an unread library may not hold Save (Rule 2)"
  - "Both closed `vi.mock` factories converted to Shape B: a literal breaks the BARREL, not only the consumer"
  - "The FLAG-01 'drafting is off' note lives in the STUDIO, not in the dialog — a second dialog prop was forbidden by the plan's own diff criterion"
  - "The library heading vouches for the RESOLVED count, not the selected one"
  - "`dangerouslySetInnerHTML` is deliberately NOT named in prose, so `grep -c … == 0` stays a usable fence"

requirements-completed: [PACK-14, PACK-15, PACK-16]

status: CHECKPOINT — tasks 1 and 2 complete; task 3 (G-4 lived-experience UAT, R-1..R-9) is OWED
metrics:
  duration: ~2h15m
  tasks: 2 of 3 (task 3 is a blocking human-verify checkpoint)
  commits: 5
  completed: 2026-09-21
---

# Phase 263 Plan 04: The skills an Expert needs — Summary

**Sketch 263 variant A is shipped: the `Bound Knowledge & Capabilities` card now carries two headed groups — solid `⚡` *In your library* beside dashed `⬡` *Proposed for this Expert* — `Save Expert` is held while any named capability is phantom from EITHER entry point, a proposal becomes real one human approval at a time through the dialog and the write path that already existed, and the suite that guards the dialog was adopted into a gate that had never once run it.**

⛔ **THIS PLAN IS AT A BLOCKING CHECKPOINT.** Task 3 is the phase's G-4 lived-experience UAT scoreboard (R-1 … R-9). It needs a running stack, a live local Supabase, and real provider keys across eight providers. **Not one row has been driven.** Every row is recorded below as **OWED**, with its blocking reason and a named next step — never as a verdict.

## Performance

- **Duration:** ~2 h 15 m
- **Tasks:** 2 of 3 executed; both TDD, each RED-then-GREEN
- **Files:** 1 created, 9 modified
- **Commits:** 5 (4 code/test + this docs commit)

## Task Commits

| # | What | Commit |
|---|---|---|
| 1 | Task 1 RED — the dialog pre-fill, before it exists | `1e6a14f96` (test) |
| 2 | Task 1 GREEN — `initialValues` + the count-gate adoption | `7800fc267` (feat) |
| 3 | Task 2 RED — variant A, and the mock-factory landmine retired first | `78ab131d9` (test) |
| 4 | Task 2 GREEN — the ⬡ group, the held Save, the approval round trip | `397790a42` (feat) |
| 5 | This SUMMARY + the SEED-303 routing | (docs, this commit) |

## Worktree

`bash scripts/bootstrap-worktree.sh` ran FIRST, before the HEAD assertion, and reported `BOOTSTRAP OK`
(both junctions attached, both `.env` files copied).

⚠ **The mandated `git reset --hard` FIRED, as the orchestrator predicted and as it did on all three
prior waves.** The worktree arrived on branch `worktree-agent-ae0ae5f22214b1e32` at
`5ff8c58466b21037edb2a842039c78617b6bcbb6` — the default branch, not this plan's base. `git merge-base`
against the required base returned `658cb8547588ba16572dee766b7a4ee4af7aaf61`, so the reset was
applied and verified: HEAD `14195207fbcf806a2ef37d1209b2126537e7a354`, `git status --short` empty.

---

## What shipped

### Task 1 — the dialog pre-fills without becoming an edit dialog

One optional `initialValues` prop on `SkillFormDialog`'s `Props`, three `??` inside the EXISTING reset
effect, and `initialValues` added to that effect's dependency array. **That is the entire source
change**, and the diff proves it: three hunks, all inside `SkillFormDialog`'s `Props` / destructuring /
reset effect. `SkillForm`'s body and `SkillDetailPanel` are byte-unchanged — possible only because
`SkillFormProps` is a flat **controlled** set, so the pre-fill lands entirely in the modal's own effect.

⛔ **The shortcut that would have shipped a defect: passing a synthetic object as `skill`.**
`const isEdit = !!skill` flips, the title reads *Edit Skill*, and `listSkillFiles(skill.id)` fires
against an id that does not exist. Three of the five new cases exist only to make that falsifiable.

### Task 2 — sketch 263 variant A

- **`ProposedSkillCard.tsx`** (86 L, render-only): `⬡` glyph, the name in the mono scale, the one-line
  description, a ghost `Remove`, a violet `Create this skill →`, and an in-place `Drafting instructions…`
  busy state. Root tokens copied **verbatim** from `OrgIdentity.tsx`'s `AVATAR_PENDING`.
- **The studio's skills sub-block gains a FOURTH inner part**, between the active pills and the quick-add.
  The `Bound Knowledge & Capabilities` card's other two peers — Folders and Connections — are untouched.
  ⛔ No new studio screen and no wizard step: variants B and C were the REJECTED alternatives.
- **The client fence** disables `Save Expert` on the de-duplicated union of `suggestedNewSkills` and the
  `memberSkills` entries absent from `availableSkills`, and states the count in a **violet** banner.
- **The approval round trip**: `Create this skill →` → the card's generating state → `draftSkillBody` →
  `SkillFormDialog` pre-filled → `createSkill` on confirm → the name moves into the `⚡` rail.
- **The server's refusal**: `ExpertMemberSkillsUnknownError` renders `err.unknownSkills` as React text
  children in the destructive banner.

---

## The finding this plan was most likely to miss, and did not

⭐ **`grep -ic "skill" scripts/vitest-count-gate.cjs` returned `0` at the phase base.** Not one skills
suite was in either knob. `SkillFormDialog.test.tsx`'s **8 passing tests ran NOWHERE and guarded
NOTHING** — so the five cases this plan added to that file would have falsified nothing, and the dialog
that `PACK-15` turns on could have been deleted with the shared gate still green.

⚠ **It was on the wrong side of BOTH knobs, for two different reasons.** `src/components/skills` has no
bare-directory `TARGETS` entry, *and* the file is not under a `__tests__/` directory — it sits beside its
component. TARGETS decides what RUNS; BASELINE decides what is GUARDED. This is the state Phase 214
found `WorkflowScheduleModal.test.tsx` in, one knob over.

Adopted into both, pinned at the measured **13**. `ExpertAuthoringStudio.test.tsx` re-pinned **4 → 14**.

---

## The three plants, each differently shaped, each restored md5-identical

| # | Shape | Planted | Observed | Restored |
|---|---|---|---|---|
| A | boolean widened | `const isEdit = !!skill \|\| !!initialValues` | *"stays in CREATE mode"* RED — `Unable to find an element with the text: New Skill`; **12 of 13 stayed green** | `SkillFormDialog.tsx` md5 `d1ed2f65d49a521d887e71eb7e549448` before and after |
| B | `??` precedence swapped | `setName(initialValues?.name ?? skill?.name ?? "")` | *"lets a real skill WIN"* RED, alone | same md5 |
| C | one arm of a union deleted | `unresolvedCapabilities` built from the draft path only | *"holds Save for a phantom name typed into the quick-add box"* RED, **alone — the other 13 stayed green** | `ExpertAuthoringStudio.tsx` md5 `3521158c8c3c09dd378075ef2f0a0142` before and after |
| D | token set swapped | `PROPOSED_SKILL_TOKENS` → `border-destructive/40 bg-destructive/10 text-destructive` | *"renders a proposal as an opportunity"* RED — `expected 'flex items-start gap-2 rounded-md px…' to contain 'border-dashed'` | `ProposedSkillCard.tsx` md5 `2b94b46348a50681e73a9c4dc30aef02` before and after |

⭐ **Plant C is the one that earns its keep.** A fence watching only the draft path would have read green
over `handleAddCustomSkill` — a live phantom-name door with no relation to the draft — and that is
precisely the *"a green fence coexisting with the shipped defect"* shape this project keeps paying for.

⚠ **One plant was applied over-broadly and is recorded rather than hidden.** A `sed` for
`const isEdit = !!skill` matched **both** occurrences — the dialog's and `SkillDetailPanel`'s, where
`initialValues` is not in scope. The file was restored with `git checkout -- <one explicit path>` (⛔ no
blanket reset, no `git clean`), which rewound the not-yet-committed GREEN edit too; it was re-applied and
re-verified. The re-applied plants used a `node` replace that **throws if the string does not match**,
so a silent no-op plant is impossible. ⚠ The file is **CRLF**; a `\n`-only replace reads as a no-op and
would have made a plant look "survived" when it was never applied.

---

## Verification — every figure measured, never inherited

| Check | Result |
|---|---|
| `src/components/skills/SkillFormDialog.test.tsx` | **13 passed** (plan asked ≥ 13; 8 at base) |
| `src/components/experts/__tests__` | **19 passed** (14 studio + 5 OrgExpertsTab; plan asked ≥ 15, 9 at base) |
| Combined in-scope run (3 files) | **32 passed / 0 failed** — base was **17** |
| `grep -c "SkillFormDialog.test.tsx" scripts/vitest-count-gate.cjs` | **2** (one BASELINE basename, one TARGETS path) |
| `grep -c "initialValues" frontend/src/components/skills/SkillFormDialog.tsx` | **8** (plan asked ≥ 5) |
| `grep -c "draftSkillBody"` in the two experts suites | **7** and **1** — non-zero in BOTH |
| `grep -c "dangerouslySetInnerHTML"` across the three touched components | **0 / 0 / 0** |
| `git diff --stat <plan base>..HEAD -- lib/api/skills.ts types/index.ts api/skills.py` | **EMPTY** |
| `node scripts/check-hot-file-ledger.cjs 263` | **exit 0** — `scan list: 320 rows · subject: 27 files · watched: 10` · `ledger gate OK` |
| `node scripts/check-claude-md-size.cjs` | **exit 0** — `114813 chars · 76.5% · headroom 35187` |
| `node scripts/check-seeds-register.cjs --phase 263` | `seeds register gate OK` — 310/310 parsed |
| Backend `pytest tests/unit -q --continue-on-collection-errors` | **71 failed, 5368 passed, 2 xfailed, 2 xpassed** |
| Backend expert/skill sweep (5 files) | **41 passed** |

### The count gate — verdict line VERBATIM, from the repo ROOT, `GSD_VITEST_MAX_WORKERS=2`

```
  total                                      7769    8523    +754
  total 8523  ·  failed 0  ·  pinned total 7769
count gate OK — 298/298 pinned files present, no per-file decrease, 0 failing.
```

| | orchestrator's pre-execution reading | **measured at this plan's HEAD** |
|---|---|---|
| grand total | 8500 | **8523** (+23) |
| pinned total | 7746 | **7769** (+23) |
| pinned files | 297/297 | **298/298** (+1) |

⭐ **`+23` is fully attributed, and the arithmetic closing with NO residual is what distinguishes growth
from drift:** `SkillFormDialog.test.tsx` adopted at **13** (it ran nowhere before, so it adds 13 to the
grand total *and* 13 to the pinned total, and 1 to the file count) plus `ExpertAuthoringStudio.test.tsx`
**4 → 14** = `+10`. `13 + 10 = 23`. No unexplained increment.

⚠ **A growing number is the gate WORKING.** The contract is *no per-file DECREASE* and *zero failing* —
never a fixed grand total. CLAUDE.md's recorded `7816 / 7020 / 241` is the **seventh** documented rot and
was already stale before this plan began.

⚠ **THE CAP WAS NEITHER ADJUSTED NOR NEEDED, and no gate run ever went red.** `2` throughout, `failed 0`
on every invocation. ⭐ Recorded as an OBSERVATION, never as proof of innocence: **none of SEED-171's
five cap-independent flaky suites went red, and none of them is in this plan's blast radius** — so this
is not evidence about them either way. One green sample of a flaky suite proves nothing.

### The typecheck — a SET DIFF, never "zero errors"

⛔ Run as `npx tsc -p tsconfig.app.json --noEmit`. The bare `npx tsc --noEmit` is **vacuous** here
(`frontend/tsconfig.json` is `{"files": [], "references": […]}` — it checks ZERO files and exits 0).

| | errors |
|---|---|
| Plan base `14195207f` | **72** |
| This plan's HEAD | **71** |

**Raw line-keyed diff** shows 4 "new" / 5 "gone", and **every one of those is the SAME inherited error at
a SHIFTED LINE** — my `Props` edit moved `SkillFormDialog.tsx` by +22 lines. Normalised line-insensitively
(file + code + message):

```
=== NEW at HEAD ===   (nothing)
=== GONE at HEAD ===
src/components/experts/ExpertAuthoringStudio.tsx: error TS6133: 'useCallback' is declared but its value is never read.
```

⭐ **Zero new errors; one fewer.** `useCallback` had been imported and unused since Phase 261;
`refreshAvailableSkills` now uses it. `ProposedSkillCard.tsx` contributes zero errors.

⚠ **A line-keyed diff would have reported four NEW errors in files I touched, and all four were false.**
Normalise away the `(line,col)` before comparing, or an edit that only shifts lines reads as a regression.

### The backend — a plan with no backend files, measured anyway

**71 failed / 5368 passed / 2 xfailed / 2 xpassed** — **exactly the CLAUDE.md ceiling, zero headroom**,
and exactly what `263-03-SUMMARY.md` recorded at its HEAD. `git diff --stat <plan base>..HEAD -- backend/ supabase/`
is **EMPTY**, so this is unchanged both by construction and by measurement. `grep "^FAILED" | grep -c "263"`
→ **0**. ⚠ The orchestrator's newly-observed flake
(`test_email_ingestion.py::test_ingest_email_populates_metadata_and_attachments`) did **not** appear.

---

## Ledger hygiene — THREE triples re-derived, all THREE stale, one stale within a single phase

Re-derived with CLAUDE.md's three-command recipe at HEAD, never copied forward:

| File | Row said | **Re-derived** | Verdict |
|---|---|---|---|
| `frontend/src/components/experts/ExpertAuthoringStudio.tsx` | `1 / 1 / 1082` · `no (new)` | **`3 / 2 / 1475`** | ⚠ STALE by 2 commits and **393 lines**. Still below threshold (2 phases) |
| `frontend/src/components/skills/SkillFormDialog.tsx` | `12 / 8 / 635` · ⚠ FIRES | **`13 / 9 / 657`** | ⚠ STALE **one plan after 263 planning wrote it** |
| `scripts/vitest-count-gate.cjs` | `222 / 49 / 5787` · ⚠ FIRES | **`235 / 55 / 5923`** | ⚠ STALE a **seventh** time |
| `frontend/src/components/experts/ProposedSkillCard.tsx` | *(absent)* | **`1 / 1 / 86`** | ⭐ **Row added AT CREATION** — the gate's last `[no-row]` for this phase |

⚠ **`263-04-PLAN.md` predicted `2 / 1 / 1194` for the studio. The measured line count was `1475`** — so
even the plan's own correction of a stale cell was itself stale by 281 lines. **Run the recipe; never
quote a planned figure.**

⚠ **The three six-digit DATED QUICK-TASK buckets (`260807` · `260808` · `260814`) WERE subtracted** from
`vitest-count-gate.cjs`: raw bucket list **58**, phase count **55**. That subtraction is the step two
earlier passes of this same cell skipped.

⛔ **`ProposedSkillCard`'s row went into `docs/HOT-FILE-LEDGER.md` ONLY, not CLAUDE.md's abridged table**
— a deliberate deviation from the plan's action text. Reason: the gate reads **only** the detail file
(verified), CLAUDE.md's table is explicitly the **G-5-FIRING** list, and the file sits at 1 phase. This is
the precedent `263-02` set for `skill_body_authoring.py` in this same phase. The two rows that DO fire
(`SkillFormDialog.tsx`, `vitest-count-gate.cjs`) were updated in **both** registers, same commit.

---

## ⛔ UAT — NINE ROWS, NINE OWED. Nothing was driven.

**Task 3 is a `checkpoint:human-verify` with `gate="blocking"`, and auto mode is OFF**
(`workflow.auto_advance: false`, `_auto_chain_active: false`). The plan's own bar is explicit:

> *"an Expert whose capabilities match its description." A UAT row that does not re-drive the
> PhD-literature-review prompt end-to-end has NOT tested this phase.*

**None of that happened.** No backend was started, no frontend dev server was started, no live Supabase
was read, no provider was driven. Recording this as a decision, not as a claim that anything ran.

| # | Row | Verdict | Blocking reason | Named next step |
|---|---|---|---|---|
| **R-1** | The defect is gone — a FRESH doctoral-literature-review draft names its domain skills | ⛔ **OWED** | Needs backend + frontend + a live provider; an LLM draft cannot be simulated | **Drive this one FIRST** — it is `BUG-260921-01` itself. ⚠ Do NOT judge the existing `phd-lr` row: it is stale mid-development data from neither current path |
| **R-2** | Proposed reads as opportunity, not failure | ⛔ **OWED** (visual) | Chrome-driven visual judgement; the token fence is green but a fence is not a look | Screenshot both groups side by side after R-1 |
| **R-3** | One approval at a time, through the existing path | ⛔ **OWED** | Needs a live `POST /experts/draft-skill-body` and a real `POST /skills` row | `SELECT name FROM public.skills ORDER BY created_at DESC LIMIT 1` after confirming |
| **R-4** | Never auto-create | ⛔ **OWED** | Needs the BEFORE count the plan asked for | Record `SELECT count(*) FROM public.skills` **before** the session; R-4 is a delta, not an impression |
| **R-5** | Save says so before it saves, from BOTH doors | ⛔ **OWED** (live) | ⭐ Covered by automated fences — 3 separate assertions + plant C — but a disabled button is a *lived* property | Drive both doors in the browser after R-1 |
| **R-6** | The server is the real fence (direct `POST /experts`, no browser) | ⛔ **OWED** | Needs a REST client and a real bearer token | Quote the 422 body VERBATIM including `detail.unknown_skills`. ⛔ A 400 means the check landed inside the `try` |
| **R-7** | The second hollowness is closed (a DIFFERENT org member gets all skills) | ⛔ **OWED** | Needs two signed-in users in one org | This is `263-01`'s U-02; migration 191 must be confirmed applied first |
| **R-8** | FLAG-01 gates generation only | ⛔ **OWED** | Needs the Settings self-improvement flip against a live backend | The client half IS fenced (`SkillBodyDisabledError` still opens the dialog, instructions empty) — the server half is not |
| **R-9** | Cross-provider board for `emit_skill_body` — **8 rows** | ⛔ **OWED — ALL EIGHT** | Needs keys for the full native roster + OpenRouter | ⛔ DERIVE the roster by grouping `MODEL_CAPABILITIES` on `provider` and taking the newest REGISTRY-BACKED id — never re-type a list. ⚠ Recovery here is TWO rungs, not three (`strict=False` skips `strict_force`), so a thin emission gets ONE retry |

**Rows owed by the EARLIER plans, and where they land:** `U-02` (263-01) is **R-7** · `U-03` (263-02) is
**R-9** · `U-04` (263-02) is **R-8** · `U-05`/`U-06` (263-03) are **R-6**. ⛔ **All of them are still
owed.** No earlier plan's owed row was discharged by this one.

⚠ **What IS proven, and it is narrower than the rows above:** every behaviour in tasks 1 and 2 is driven
by 15 new automated cases, four of which were proven non-vacuous against planted defects. **That is
evidence about the component tree under jsdom. It is not evidence about the product.** G-4 is explicit
that wire format and a screenshot are insufficient; a green vitest run is weaker than either.

---

## Decisions Made

- **The count-gate entry is an ADOPTION, not a raise.** Measured, not assumed: `grep -ic "skill"` → 0.
  A grand total that does not move after a phase adds tests is the tell, not the reassurance.
- **`listSkills` catches to `null`, not `[]`.** An UNREAD library and an EMPTY one are different facts,
  and the old shape would have made a transient fetch failure lock `Save Expert` permanently on an Expert
  whose every capability is real. The fence is ADVISORY (D-263-09); the server is the real one.
- **Both closed `vi.mock` factories converted to Shape B** — and the reason is bigger than the missing
  keys (see Deviations).
- **The FLAG-01 "drafting is off" note lives in the STUDIO, not the dialog.** The plan's acceptance
  criterion limits `SkillFormDialog`'s diff to the `Props` interface, three `setX` lines and the
  dependency array; a `note` prop would have broken it, and `SkillFormDialog` has no `children`. The note
  renders under the proposal group (`data-testid="skill-body-disabled-note"`) and persists after the
  dialog closes, so the author sees why the body is empty at the moment they look at the empty field.
  ⚠ While the modal overlay is up the note is behind it — a real, accepted UX compromise, stated rather
  than smoothed over. The sketch does not cover the FLAG-01-off case at all, so this is discretion, not
  a deviation from the ratified design.
- **The library heading vouches for the RESOLVED count**, `memberSkills.length − phantomMemberSkills.length`,
  not the selected count. *"N skills this Expert can actually use"* over a phantom pill would be a false
  claim, and it is exactly the kind of content drift a presence assertion cannot see.
- **`unresolvedCapabilities` is de-duplicated** (`new Set`). The plan's formula concatenates; a name
  reachable through both doors would be counted twice and the banner states a COUNT.
- **`skillDialogInitial` is STATE, not a render-time literal.** `SkillFormDialog`'s reset effect now
  depends on that object's identity, so a fresh literal each render would wipe the author's typing.
- **`ProposedSkillCard` uses plain string concatenation, not `cn()`.** `cn` runs through `tailwind-merge`,
  which could silently drop one of the four tokens that carry the whole meaning of the card.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The closed `vi.mock` factories break the BARREL, not only the consumer**
- **Found during:** Task 2, before the first mount
- **Issue:** The plan named the landmine as *"any export the studio newly imports is `undefined` at
  mount"*. That is true but **not the whole failure**. `frontend/src/lib/api.ts` re-exports symbols
  **by name** from `./api/skills` and `./api/experts` (`listSkills … approveDescriptionProposal`;
  `listExperts`, `getExpert`). `SkillFormDialog` imports from that barrel. A literal factory that omits
  a re-exported name makes the **barrel itself** fail to load — so adding the missing keys to a closed
  factory would NOT have been sufficient.
- **Fix:** Converted `@/lib/api/experts` and `@/lib/api/skills` to Shape B (`importActual` spread) in
  **both** suites, and added the `@/lib/supabase` mock both now need. ⭐ Shape B also passes through the
  REAL `ExpertMemberSkillsUnknownError` / `SkillBodyDisabledError` classes, which is load-bearing: the
  studio branches on `instanceof`, and a `vi.fn()` stand-in would make that branch unreachable.
- **Verification:** `OrgExpertsTab.test.tsx`'s 5 cases and the studio's 4 pre-263 cases stayed green
  across the RED drive — 9 green / 10 red — so the conversion changed nothing it was not meant to.
- **Sequencing note:** the factories land in the **RED** commit, one commit BEFORE the consumer. That is
  stricter than the plan's same-commit obligation, not looser.
- **Committed in:** `78ab131d9`

**2. [Rule 2 - Missing critical functionality] An unread library would have locked Save forever**
- **Found during:** Task 2, writing the fence
- **Issue:** `listSkills().catch(() => [])` makes a transient fetch failure indistinguishable from an
  empty library. With the plan's literal formula, every `memberSkills` entry would then read as phantom
  and `Save Expert` would be disabled with **no recourse**, on an Expert whose capabilities are all real.
- **Fix:** catch to `null`; apply the `memberSkills` arm only when `availableSkillsLoaded`. Proposals
  always count (they are known-phantom by the server's own judgement).
- **Verification:** the *"enables Save when every named capability exists"* case covers the loaded path;
  the unloaded path degrades to pre-263 behaviour.
- **Committed in:** `397790a42`

**3. [Rule 1 - Bug in my own prose] A comment burned the plan's own XSS fence**
- **Found during:** Task 2, running the threat-model grep
- **Issue:** The threat register asserts `grep -c "dangerouslySetInnerHTML"` returns **0** across the
  three touched components. My comments *saying* "no `dangerouslySetInnerHTML`" made it return **1** in
  two files — the grep reading non-zero against provably correct code, which is wave 3's finding #6
  arriving from the other direction.
- **Fix:** Reworded both comments to say *"no raw-HTML injection prop"* and to state, in the comment
  itself, that the prop is deliberately not named so the grep stays usable. The prohibition is still
  legible; the fence is still a fence.
- **Verification:** `0 / 0 / 0` across all three files.
- **Committed in:** `397790a42`

### Accepted plan-text divergences, recorded rather than silently applied

- **The `ProposedSkillCard` ledger row went to `docs/HOT-FILE-LEDGER.md` only**, not to CLAUDE.md's
  abridged table (plan action (i) asked for both). Reason above; the gate exits **0**.
- **One acceptance query needed a stronger form.** `screen.getByText(/In your library/i)` throws
  *"Found multiple elements"* — the `<label>` and its nested count `<span>` both match. Replaced with a
  `toHaveTextContent(/1 skill this Expert can actually use/i)` assertion on the heading, which is
  strictly stronger: it asserts the COUNT the heading vouches for, not merely the words above it.

**Total deviations:** 3 auto-fixed (1 blocking, 1 missing-functionality, 1 bug), 2 recorded divergences.
**Impact on plan:** no scope creep; no acceptance criterion weakened.

## Issues Encountered

- **The Bash tool refuses compound and heredoc-bearing commands in a worktree.** `cd X && cmd`,
  `cat >> file << EOF` and multi-command `for` loops were all rejected as unverifiable. Every file
  edit went through `Edit`/`Write`; every measurement went through single plain commands.
- ⚠ **The repo is CRLF.** A `node` string replace using `\n` reads as a silent no-op — a plant that
  "survived" because it was never applied. Every plant here **throws** when its target string does not
  match, which is what turns that silent failure loud.
- **Provider-docs-first:** ⚠ not applicable — this plan adds no provider-facing behaviour (the provider
  call lives in `263-02`'s service, which this plan only consumes through `263-03`'s route). Stated
  rather than claimed: Context7 MCP and the `ctx7` CLI do not exist in this environment and `npx --yes`
  is forbidden, so no provider documentation was read.
- ⚠ **Two seeds fired on this plan's `files_modified` and were NOT routed**, because no plan named them
  and routing is a discuss-phase act: **`SEED-280`** (*five suites run by the count gate and guarded by
  nothing*) and **`SEED-287`** (*a newly-written suite runs nowhere until somebody remembers to name it*).
  ⭐ **`263-04` is fresh evidence for both** — it found exactly that state on `SkillFormDialog.test.tsx`
  and fixed the one instance, not the mechanism. Named here so the next sweep sees the data point rather
  than re-discovering it. **`SEED-303` WAS routed** (frontmatter updated: S9 built at `263-04`, UAT owed,
  other arms still open — status stays `partially-answered`).

## Threat Flags

None. Every surface this plan adds is inside the plan's own `<threat_model>`:

- **T-263-20** (XSS) — mitigated: proposal names, descriptions and `unknown_skills` are all rendered as
  React text children (auto-escaped). `grep -c "dangerouslySetInnerHTML"` → **0** across all three
  touched components, and the grep is still usable because the token stays out of prose.
- **T-263-21** (the client fence is advisory) — mitigated by design and stated in code: the server
  re-checks independently (263-03), and the UI renders the server's own refusal rather than its own.
  ⛔ Driving it is **R-6**, and R-6 is OWED.
- **T-263-22** (an unreviewed body written to the library) — mitigated: the row is written only on human
  approval, through the dialog, through the existing `POST /skills`. ⛔ Never auto-created. Driving it is
  **R-4**, and R-4 is OWED.
- **T-263-23** (a second write path) — mitigated and ASSERTED: `frontend/src/lib/api/skills.ts` is
  byte-identical vs the plan base (`git diff --stat` empty). `createSkill` is the only write.
- **T-263-24** (a fabricated body presented as authored) — mitigated: on `SkillBodyDisabledError` the
  instructions field is **empty** and the reason is stated; any other failure clears the busy state and
  surfaces the real message. ⛔ The UI never invents text.
- **T-263-SC** — held: **this plan installed nothing.** No `npm install`, no `pip install`.

## Self-Check: PASSED

**Files claimed as created/modified — all present on disk:**

```
FOUND: frontend/src/components/experts/ProposedSkillCard.tsx
FOUND: frontend/src/components/skills/SkillFormDialog.tsx
FOUND: frontend/src/components/experts/ExpertAuthoringStudio.tsx
FOUND: scripts/vitest-count-gate.cjs
FOUND: docs/HOT-FILE-LEDGER.md
FOUND: .planning/phases/263-an-expert-can-be-given-its-capabilities/263-04-SUMMARY.md
```

**Commits claimed — all four resolve in `git log --oneline --all` (count: 4):**

```
397790a42 feat(263-04): ship variant A — the ⬡ proposal group, the held Save, the approval
78ab131d9 test(263-04): drive variant A RED, and retire the mock-factory landmine first
7800fc267 feat(263-04): pre-fill the existing dialog, and adopt its suite into both knobs
1e6a14f96 test(263-04): drive the dialog pre-fill RED before it exists
```

⚠ **What the self-check CANNOT attest, and the distinction matters:** it proves the files and commits
exist, not that the nine UAT rows were driven. **They were not.** See the OWED table above.

## Next Phase Readiness

⛔ **The phase is NOT closeable on this summary alone.** Tasks 1 and 2 are code-complete and gated;
Task 3 is a blocking human-verify checkpoint and nine rows are owed. **`R-1` is the first row to run** —
it is `BUG-260921-01` itself, and the operator's stated bar is *"an Expert whose capabilities match its
description."*

⛔ **`STATE.md` and `ROADMAP.md` were deliberately NOT touched** — the orchestrator owns those writes.

---
*Phase: 263-an-expert-can-be-given-its-capabilities*
*Plan 04 — the final plan of the phase*
*Status: CHECKPOINT (task 3 owed) · 2026-09-21*
