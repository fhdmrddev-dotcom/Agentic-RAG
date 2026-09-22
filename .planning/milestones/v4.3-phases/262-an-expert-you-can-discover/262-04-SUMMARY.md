---
phase: 262-an-expert-you-can-discover
plan: 04
subsystem: frontend-expert-catalog
tags: [PACK-12, PACK-13, detail-modal, rendered-content, ordered-handoff, tdd, count-gate, hot-file-ledger]
requires: ["262-01", "262-02", "262-03"]
provides:
  - "frontend/src/components/experts/catalog/ExpertDetailModal.tsx — the FIRST renderer of example_output anywhere in this repository"
  - "frontend/src/components/experts/catalog/startScopedChat.ts — PACK-13's ordered handoff onto the shipped thread.active_expert_id seam"
  - "the detail view mounted on the catalog page, with plan 03's `folders` prop finally bound"
  - "PACK-12's criterion proven as RENDERED CONTENT — zero test-hook queries in the suite"
affects:
  - "plan 05 (reachability triad): the page's props contract is UNCHANGED — { folders, onStartChat, onInspect? }"
  - "plan 05 builds `onStartChat` from `startScopedChat`, injecting ChatLayout's four shipped seams"
tech-stack:
  added: []
  patterns:
    - "dependency-injected ordering: the order IS the requirement, so every seam is a parameter and the call order is asserted from one shared log"
    - "React-state disclosure over the native element: hidden must mean NOT RENDERED, or a content assertion passes against text nobody can see"
    - "an honest line per optional field: a blank section states a fact nobody measured"
key-files:
  created:
    - frontend/src/components/experts/catalog/ExpertDetailModal.tsx
    - frontend/src/components/experts/catalog/startScopedChat.ts
    - frontend/src/components/experts/catalog/__tests__/ExpertDetailModal.test.tsx
    - frontend/src/components/experts/catalog/__tests__/startScopedChat.test.ts
  modified:
    - frontend/src/components/experts/catalog/ExpertCatalogPage.tsx
    - scripts/vitest-count-gate.cjs
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md
decisions:
  - "D-262-05 honoured MECHANICALLY: zero test-hook queries in the suite; every claim is rendered text."
  - "D-262-08's RE-AIM implemented: the seam is thread.active_expert_id, reached one register below the composer's handler."
  - "refreshThreads BEFORE selectThread is fenced by two cases, because it looks like a cache-warm and is not."
  - "The modal's action prompts ship as CONTENT, not triggers — no props contract in this phase carries a prompt, and no existing callback was re-pointed."
  - "The card face's scope words (Restricted/Biased) are reused in the modal badge, so the two catalog surfaces cannot disagree while a person moves between them."
metrics:
  duration: "~55m"
  tasks: 3
  completed: 2026-09-22
---

# Phase 262 Plan 04: The detail view and the ordered handoff Summary

The four presentation columns migration 189 added reach a normal user for the first time — including
`example_output`, which until this commit rendered in **zero components, admin surface included** —
and one control from that view produces a thread the **server** already knows is scoped, through the
seam Phase 260 shipped rather than a second mechanism.

**Commits:** `45ccc0060` · `1affd06a2` · `9c3459250` · `bb17939e0`

⛔ **The catalog is still NOT reachable at the end of this plan**, by design: the `ActiveView`
member, the `ChatLayout` branch and the entry actions land as one commit in plan 05 (D-262-03).

---

## Task 1 — six sections of content that had never been on screen

| Section | What it renders | When the column is absent |
|---|---|---|
| header | icon gem, name, scope badge, `category · System Template`/`Org Custom` | `Uncategorised`, never someone else's heading |
| — | the description, as "what it does" | *"The author has not described what this Expert does yet."* |
| Knowledge Composition | what the scope mode MEANS, in plain words | n/a — always renders |
| When To Summon This Expert | `when_to_use` **verbatim** | *"The author has not said when to use this Expert yet."* |
| Grounded Knowledge & Tool Envelope | folder **NAMES**, skill **NAMES**, connection **NAMES** | three separate honest lines |
| One-Click Action Prompts | each tile's `title` **and** its `prompt` | *"The author has not written any example prompts yet."* |
| Sample Deliverable Output | `example_output` verbatim, behind a disclosure | *"The author has not attached a sample deliverable yet."* |
| footer | **two** controls: `Close`, `Start Scoped Chat with Expert` | — |

**It NAMES; it does not COUNT.** The card face carries the folder count deliberately (sketch §1);
the admin tab's `📁 N folders / ⚡ N skills / 🔌 N conns` line is the exact shape PACK-12 exists to
replace and was not copied. `grep -cE "\.length\} *(folder|skill|conn)"` → **0**.

**The disclosure is React state, not the native HTML disclosure element.** A closed native element
keeps its content in the DOM, which would let a content assertion pass against text nobody can see —
and this whole requirement is about text nobody can see.

| Grep on `ExpertDetailModal.tsx` | Result |
|---|---|
| `clone\|dangerouslySetInnerHTML\|<details` (case-insensitive) | **0** |
| `\.length\} *(folder\|skill\|conn)` | **0** |
| `resolveFolderNames` | **2** |
| `example_output` | **3** — the first component in this repository to contain it |

⛔ **THE THREE FORBIDDEN LITERALS ARE NAMED HERE, NOT IN THE SOURCE.** The sketch's third footer
control is **`Clone & Customise (S8)`** (deferred by CONTEXT as a write on a read surface); the two
import specifiers `startScopedChat.ts` must not carry are **`@/lib/api`** and **`from "react"`**; the
two query identifiers the modal suite must not use are **`getByTestId`** and **`queryByTestId`**.
Spelling any of them in a comment satisfies the very grep that proves it absent — the trap plans 02
and 03 each recorded, one wave apart, and it fired here a **third** time (deviation 1 below).

---

## Task 2 — the content fence, and the folder that legitimately has no name

### The RED, quoted verbatim, captured before the honest resolver existed

`ExpertDetailModal.tsx` was temporarily planted with the **convenient** implementation — the one a
reviewer would have called correct — `resolveFolderNames(...).filter((f) => f.known)`:

```
     × (3) THE RED — a folder the caller cannot see is NAMED as such, never dropped, never blank 26ms

 FAIL  src/components/experts/catalog/__tests__/ExpertDetailModal.test.tsx > ExpertDetailModal — PACK-12's content, asserted as content > (3) THE RED — a folder the caller cannot see is NAMED as such, never dropped, never blank
TestingLibraryElementError: Unable to find an element with the text: a knowledge folder you cannot see. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.

      Tests  1 failed | 7 passed (8)
```

⭐ **Seven of eight cases PASSED against that stub**, which is the useful line. A modal that silently
shortens an Expert's knowledge list renders every other claim correctly — so the unnameable-folder
case is the only one that separates an honest modal from a convenient one, and it is not hypothetical:
`mig 188:29-37` seeds the one system Expert's folder into a **single** org, so every other tenant's
`listFolders()` resolves nothing for it. After restoring the honest resolver: **8 passed**.

The plant was restored and the restoration **proven, not asserted**: `git hash-object` read
`8379124492459dbf435762ae4ad537662f76d243` both before the plant and after the restore, and
`git diff --quiet` was clean. (A raw md5 would be confounded by CRLF normalisation.) **No gate was
running while the file was planted.**

### The eight cases

| Case | What it pins |
|---|---|
| (1) | `when_to_use` renders **verbatim**, and the honest stand-in is absent when the author wrote one |
| (2) | the sample deliverable's exact multi-line string is **ABSENT** before the disclosure click and **PRESENT** after |
| (3) | **THE RED** — the known folder by name, the unknown one as *"a knowledge folder you cannot see"*, the "binds none" line absent, and the raw id never rendered |
| (4) | `member_skills` and `required_connections` by name, with negative arms against the count vocabulary |
| (5) | both prompt tiles' titles **and** both prompts |
| (6) | both columns absent → both honest lines, **no disclosure control at all**, and `not.toContain("undefined")` over the whole document text |
| (7) | the footer's primary calls `onStartChat` **once** with the expert, and the view closes |
| (8) | the footer's deferred third control appears nowhere, and **zero disabled buttons** exist |

⛔ **`grep -c "getByTestId\|queryByTestId"` on the suite → 0.** Not one query reaches for a test hook,
and no exception was needed — `screen` and `document.body.textContent` cover the Radix portal.
⚠ The sample-deliverable assertions read `document.body.textContent` rather than a text matcher
**on purpose**: the default matcher collapses whitespace, so a reflowed multi-line sample would pass.

`grep -c "a knowledge folder you cannot see"` → **1**, and the case additionally pins the exported
constant against that literal, so the wording cannot drift without a failure.

---

## Task 3 — one action, and the order that makes it true

`startScopedChat(deps, expert)` fires **`createThread → setExpert → refreshThreads → selectThread →
navigate`**, every seam injected, no client function and no UI-library import
(`grep -cE "@/lib/api|from \"react\""` → **0**).

### The RED for the order

The two lines were swapped so the refetch ran *after* the selection — the change that looks like
tidying:

```
     × (1) fires its five seams in exactly one order 6ms
     × (2) refreshThreads runs BEFORE selectThread — the list must hold the patched row 1ms

AssertionError: expected [ 'createThread', 'setExpert', …(3) ] to deeply equal [ 'createThread', 'setExpert', …(3) ]
AssertionError: expected 3 to be less than 2

      Tests  2 failed | 4 passed (6)
```

Restored; `git hash-object` read `90a852d7fd33d4f69916177ed151ae4964f9169d` before and after. **6 passed.**

⚠ **Four of six cases passed against the swapped order**, which is precisely why case (2) exists as a
separate ordering fact rather than an inference from case (1): every seam was still called.

| Case | What it pins |
|---|---|
| (1) | the five-seam order, from one shared call log |
| (2) | `refreshThreads` strictly between `setExpert` and `selectThread` |
| (3) | `selectThread` receives the object `setExpert` **resolved**, identity-compared, and explicitly **not** the created row |
| (4) | the PATCH is addressed to the created thread id and the chosen Expert id |
| (5) | a **rejected patch**: no navigate, no select, no refresh, and the rejection reaches the caller |
| (6) | a **rejected creation**: neither the patch nor the navigation runs |

⛔ **Why `refreshThreads` is load-bearing, restated because it reads like tidiness:** `useThreads.newThread`
pushes the pre-patch row into its own list and the hook exposes **no updater for `active_expert_id`**.
Without the refetch, clicking that thread in the history column later makes `ChatArea`'s effect read
`null` and clear the spotlight **while the server still holds the Expert**.

### The page

`ExpertCatalogPage` now holds the inspected Expert in state, opens the detail view from the card's
`Details` control, and routes **both** the card's and the modal's start control into its `onStartChat`
prop. ⛔ `grep -c "listExperts("` → still exactly **1**; the page fetches nothing new. `folders`,
declared unbound by plan 03 against a zero-headroom typecheck, is finally consumed — and only ever
passed straight through, so nothing on this surface can name a folder the caller cannot see (T-262-14).

### Both knobs, same commit

Adopted with pins taken from the gate's **own printed `— N new` column**, never a local vitest tail:

```
  ExpertDetailModal.test.tsx                    —       8     new
  startScopedChat.test.ts                       —       6     new
```

`grep -c "ExpertDetailModal.test"` → **2** · `grep -c "startScopedChat.test"` → **2** (one TARGETS
entry and one BASELINE pin each).

---

## Gates

| Gate | Result |
|---|---|
| `vitest run src/components/experts/catalog` | **4 files / 32 passed**, exit 0 (18 inherited + 8 + 6) |
| `vitest-count-gate.cjs` (repo root, `GSD_VITEST_MAX_WORKERS=2`) | **`count gate OK` — 324/324 pinned present, no per-file decrease, 0 failing.** `total 8737 · pinned total 7996`. Pinned files **322 → 324 (+2 exactly)**; pinned total **7982 → 7996 (+14 = 8 + 6)** |
| `tsc -p tsconfig.app.json --noEmit` | **70 errors — SET DIFF against base EMPTY**, measured after each of the three tasks. ⛔ bare `tsc --noEmit` checks zero files |
| `check-hot-file-ledger.cjs --files <4>` | exit **0** — 328 rows, all watched files have rows |
| `check-claude-md-size.cjs` | exit **0** — `118985` chars (wave 3 left `118988`; this plan is net **−3**). No `[duplicate-row]`, no `[disposition-too-long]` |
| backend baseline harness | **not run, and not omitted — not required.** `git diff --stat 75070c5d2 HEAD -- backend/` is **EMPTY**; this plan touches zero backend files |

⭐ **`count gate OK` was NOT used as an acceptance criterion.** The criteria were the per-file deltas
(all `0`), the `+2` pinned-file delta with its `+14` arithmetic fully attributed, and the
explicitly-run in-scope suites. ⚠ **Three gate runs, all `failed 0` on the first invocation, and the
cap was never adjusted** (held at `2`). Neither `sketchComposition.test.tsx` (the inherited base red)
nor `WorkflowBuilderPage.canvas.test.tsx` (SEED-171's fifth flaky suite) appeared in any run —
recorded as an observation, **never as proof of innocence**: one green sample of an intermittently
red suite proves nothing.

---

## Deviations from Plan

**1. [Scope, stated as a decision] The self-tripping grep fired a THIRD time, and the resolution is again a SUMMARY**
- **Found during:** Task 2, by running the acceptance grep against my own first draft
- **Issue:** the test file's docblock explained *why* it uses no test-hook queries — by naming both identifiers. `grep -c "getByTestId\|queryByTestId"` scored **1** against a required **0**. Identical in shape to plan 03's deviation 1 and plan 02's before it.
- **Fix:** the docblock now describes the prohibition in words and points here for the literals. Re-measured **0**. The same treatment was applied pre-emptively to the third footer control in `ExpertDetailModal.tsx` and to the two import specifiers in `startScopedChat.ts`, so neither grep ever scored non-zero.
- **Files modified:** `__tests__/ExpertDetailModal.test.tsx`
- **Commit:** `1affd06a2`
- ⚠ **This is the THIRD consecutive wave to record it, and plan 03 predicted exactly that** — *"it will recur again in plan 04 unless the rule moves somewhere executable."* It did. **The rule still lives only in SUMMARY files nobody re-reads.** Recorded again rather than quietly worked around: the fix is a lint rule or a grep helper that ignores comment lines (`stripComments.testutil.ts` already exists for the `?raw` case), not more care.

**2. [Scope, stated as a decision] The modal's action prompts ship as CONTENT, not as triggers**
- **Found during:** Task 1, reconciling the plan's stated behaviour with plan 03's handover
- **Issue:** the phase constraints require the prompt tile to have **its own** callback and forbid re-pointing an existing one. Plan 04's declared modal props are `expert / folders / open / onOpenChange / onStartChat`, and **plan 05's page contract is unchanged** — no prop in this phase carries a prompt.
- **Decision:** each tile renders its `title` **and** its `prompt` as readable content, with no button affordance. `onStartChat` was **not** re-pointed: doing so would start a conversation without the prompt the tile advertises, which is a control that lies about itself. Adding an optional `onRunPrompt` nothing supplies would ship a dead affordance, which is what D-262-02 refuses a whole requirement over.
- **Re-open trigger:** the first plan that declares a prompt-bearing callback on this surface. Recorded in the ledger section, not only here.

**3. [Rule 2 — missing correctness behaviour] Honest lines for THREE fields the plan did not name**
- **Found during:** Task 1
- **Issue:** the plan required honest lines for `when_to_use` and `example_output`. An Expert with **no** bound folders, **no** skills, **no** connections, **no** prompt suggestions or **no** description would have rendered blank sub-blocks — the identical failure one field over, and the seeded system Expert has empty `required_connections`.
- **Fix:** every optional collection and the description carry their own sentence; all seven live in one exported `HONEST` map so the suite asserts the exact wording rather than a paraphrase.
- **Commit:** `45ccc0060`

**4. [Observation, not a change] The modal's scope badge reuses the CARD's two words**
- The sketch header says `Union Scope` / `Strict Isolation`; the admin tab says the same; plan 03's card face ships `Biased` / `Restricted`. The badge reuses the **card's** words so the two catalog surfaces cannot disagree about one fact while a person moves between them, and the sketch's sentence-length meaning is rendered in the *Knowledge Composition* section instead — where it has room to be a sentence. Flagged rather than glossed: it is a one-word change if the operator prefers the sketch's vocabulary.

No Rule 4 (architectural) decisions were needed. No authentication gates. **No packages installed** —
the shipped shadcn `Dialog`, `lucide-react` and `@testing-library/*` were all already present (T-262-SC).

---

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or schema change.

- **T-262-13 mitigated and grep-asserted** — `example_output` is a React text child in a pre-formatted block; `grep -ciE "dangerouslySetInnerHTML"` → **0**, no rich-text pass, no raw-HTML escape hatch. React escapes the longest string an author controls.
- **T-262-14 mitigated by construction** — folder names come ONLY from the `folders` prop, which is the caller's own visible set passed straight through. The modal contains no fetch of any kind, so it **cannot** name a folder the caller has no access to; an unresolvable id renders the honest wording instead.
- **T-262-15 mitigated and DRIVEN** — case (5) asserts a rejected patch reaches neither `navigate` nor `selectThread`, and the rejection propagates. The spotlight is hydrated from the SERVER's `thread.active_expert_id`, never from client state.
- **T-262-16 mitigated and DRIVEN** — cases (1) and (2) pin `refreshThreads` before `selectThread`, so the list and the server agree and a later re-selection cannot silently un-scope.

⚠ **Re-flagged from wave 3, because this plan is the surface it breaks:** all 33 LOCAL orgs read
`enterprise`, while Phase 258 measured **2 of 2 PRODUCTION orgs at NULL tier**, on which
`entitlements.py` fails CLOSED. **A locally-green Expert catalog and detail view predict a wholesale
403 in production** until the cloud orgs carry a tier.

⚠ **Also re-flagged, unchanged:** D-262-10's `upgrade_hint` edge on the catalog page's refusal state
(one `<span>` to reverse) and D-262-03's reachability triad, which is plan 05's.

## Known Stubs

None. Both RED plants were restored inside their own tasks and both restorations are proven by
`git hash-object`; neither was ever committed. No TODO, no FIXME and no hardcoded roster survives.

⚠ **The stub scan's reading was `0 / 0 / 2` and both hits are INHERITED and already explained by plan
03** — `ExpertCatalogPage.tsx:124-125`, the search input's HTML `placeholder` attribute and its
`placeholder:text-muted-foreground` Tailwind class, both shipped UI copy from the sketch toolbar.
Neither line is in this plan's diff. Recorded rather than rounded down, for the same reason plan 03
gave: a summary that quietly reports the number it wanted is how a real stub gets through.

⚠ **One intentional incompleteness, which is a plan boundary rather than a stub:** the catalog — and
therefore this detail view — is **not mounted anywhere**. Plan 05 owns the `ActiveView` member, the
`ChatLayout` branch and the entry actions, as one commit, with wave 1's AST fence making the claim
provable rather than asserted.

## Self-Check: PASSED

```
FOUND: frontend/src/components/experts/catalog/ExpertDetailModal.tsx
FOUND: frontend/src/components/experts/catalog/startScopedChat.ts
FOUND: frontend/src/components/experts/catalog/__tests__/ExpertDetailModal.test.tsx
FOUND: frontend/src/components/experts/catalog/__tests__/startScopedChat.test.ts
FOUND: frontend/src/components/experts/catalog/ExpertCatalogPage.tsx
FOUND: scripts/vitest-count-gate.cjs
FOUND: CLAUDE.md
FOUND: docs/HOT-FILE-LEDGER.md
FOUND: 45ccc0060  FOUND: 1affd06a2  FOUND: 9c3459250  FOUND: bb17939e0
```

## TDD Gate Compliance

RED was driven per TASK, against a real plant, with the failing output quoted verbatim and the
restoration proven by `git hash-object` — twice (the known-names-only resolver, the swapped order).
Commit sequence is `feat` (45ccc0060) → `test` (1affd06a2) → `feat` (9c3459250), so a `test(...)`
commit exists and a `feat(...)` commit follows it. ⚠ The plan-level ordering is NOT a strict
RED-before-GREEN at the FIRST commit: task 1 shipped the component before its suite, mirroring
262-03 exactly. The RED discipline was honoured at the task level and is quoted above; the
commit-type sequence is recorded here rather than claimed to be something it is not.
