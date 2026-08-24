---
phase: 193-authoring-doors-template-placement
plan: 04
subsystem: sketch-generator
tags: [auth-01, d-23, sketch-164, build-contract, anti-drift, copy-table, generated-artifacts]
wave: 2
base_sha: 4ae3194af3daf7158da601079dcdd0c085ac8695
requires:
  - ".planning/sketches/164-telling-the-doors-apart/build.cjs (the COPY table + D_FROM_C derivation)"
  - ".planning/sketches/164-telling-the-doors-apart/emit.test.tsx.src (the jsdom DOM emitter)"
  - "frontend/src/components/workflows/WorkflowDoorSwitch.tsx (READ ONLY — never modified by this plan)"
provides:
  - "strip.labelGovern — the 21st governed COPY id, column D = `Build it myself`, produced by the generator"
  - "dom.generated.json with FOUR keys — chooser, describe, govern, runModal"
  - "A regenerated BUILD-CONTRACT.generated.md that 193-08 ports column D from"
affects:
  - "193-05 (ports the COPY table into doorVocabulary.ts)"
  - "193-08 (consumes column D)"
  - "193-09 (the D-04/D-22 restack — this plan names the surfaces it cannot show)"
  - "193-10 / 193-11 (UAT rows U3 / U3b / U4 / U5 / U6)"
tech-stack:
  added: []
  patterns:
    - "generate-the-contract-FROM-the-build (sketch 164's inverted arrow) extended to a fourth surface"
    - "audited-but-not-staged: a dump may enter the audit without entering the page, and the limit is written into the generated artifact"
key-files:
  created: []
  modified:
    - ".planning/sketches/164-telling-the-doors-apart/emit.test.tsx.src"
    - ".planning/sketches/164-telling-the-doors-apart/dom.generated.json"
    - ".planning/sketches/164-telling-the-doors-apart/build.cjs"
    - ".planning/sketches/164-telling-the-doors-apart/BUILD-CONTRACT.generated.md"
    - ".planning/sketches/164-telling-the-doors-apart/body.generated.html"
    - ".planning/sketches/164-telling-the-doors-apart/index.html"
    - ".planning/sketches/164-telling-the-doors-apart/README.md"
decisions:
  - "The govern dump is AUDITED but NOT STAGED — required, because without it the one id this plan adds would report a MISS; not staged, because the govern door IS the whole WorkflowBuilderPage. The limit is written into the generated contract's drift-risk table, not left to a code comment."
  - "`strip.labelGovern` has NO C value — the contract honestly renders *(inherit)*, because inventing one would be the re-typing D-02 forbids."
  - "The 🔧 glyph loss on the govern label is a CONSEQUENCE of D-23's wording, not a discretionary choice made here. Routed to UAT row U6 as an explicit observation point."
metrics:
  duration: "~30 min"
  completed: 2026-08-13
  tasks: 3
  commits: 3
  files_changed: 7
---

# Phase 193 Plan 04: The 21st Governed COPY Id Summary

`strip.labelGovern` is now a governed COPY id whose column D reads **`Build it myself`**, produced by
`build.cjs` and verified against the govern door's real rendered DOM — captured here for the first
time — with zero substitution misses on every variant and `D_FROM_C` untouched.

**Base SHA:** `4ae3194af3daf7158da601079dcdd0c085ac8695` (asserted; see *Worktree base drift* below).

## What was executed

| # | Task | Commit | Files |
|---|---|---|---|
| 1 | Capture the govern door's real DOM for the first time | `1605b3cd` | `emit.test.tsx.src`, `dom.generated.json`, `README.md` |
| 2 | Add `strip.labelGovern` to the COPY table and regenerate (D-23) | `56d745b0` | `build.cjs`, `BUILD-CONTRACT.generated.md`, `body.generated.html`, `index.html` |
| 3 | Record the regeneration in the sketch README | `ccd0309e` | `README.md` |

**Zero application source touched.** `git diff --stat 4ae3194a HEAD` lists exactly seven files, all
under `.planning/sketches/164-telling-the-doors-apart/`. Nothing under `frontend/`.

## The evidence the plan asked for, verbatim

### The `EMITTED` line

```
EMITTED chooser=2079B describe=24089B govern=2172B runModal=2914B
```

`dom.generated.json` keys, before → after: `chooser,describe,runModal` → **`chooser,describe,govern,runModal`**.

### The substitution audit — READ out of the regenerated contract, never predicted

| | before (`4ae3194a`) | after (`56d745b0`) |
|---|---|---|
| **Variant B** | 18 matched, zero misses | **19 matched, zero misses** |
| **Variant C** | 19 matched, zero misses | **19 matched, zero misses** |
| **Variant D** | 18 matched, zero misses | **19 matched, zero misses** |
| **total** | 55 | **57** |

The three "after" lines verbatim from `BUILD-CONTRACT.generated.md` §"Substitution audit":

```
- **Variant B** — 19 substitution(s) matched the real DOM; **zero misses**
- **Variant C** — 19 substitution(s) matched the real DOM; **zero misses**
- **Variant D** — 19 substitution(s) matched the real DOM; **zero misses**
```

C is unchanged **because it declares no value for the new id** — that is the *(inherit)* decision
showing up in the arithmetic, not a missed substitution.

### The exact column-D cell

Extracted programmatically from the row, not eyeballed:

```
colD === "**Build it myself**" | exact match: true
```

Full row: `` | `strip.labelGovern` | govern-door header — the current-door label <span> | 🔧 Author & govern | Build it myself | *(inherit)* | **Build it myself** | ``

No `⬅ from C` marker on the cell — visible proof it took its **B** value, which is the derivation
D-02 protects.

### Row count vs entry count — correction P-5, and the two are NOT the same

| | value |
|---|---|
| COPY table **substantive rows** | **21** |
| `COPY[]` **array entries** | **22** |

`describe.hint` carries `shipped: null` (a composite descriptor, not a substitutable string) and is
filtered out of the table by `COPY.filter((c) => c.shipped)`. A reader who ports `COPY.length` ports
one entry too many.

### `D_FROM_C` unchanged

```
grep -c 'D_FROM_C = new Set(\["doorA.tier", "doorB.tier"\])' build.cjs  → 1
```

### Generated files are not hand-edited (T-193-13)

`node build.cjs && node assemble.cjs` run a **second** time left all three artifacts **md5-identical**:

```
b51ae0279a02d5ff6ff89cd9ae5d2222  BUILD-CONTRACT.generated.md
7e47cb684f33852ee55a37a8d5e257f2  body.generated.html
a5c1b1a7629a3ab8a76c81040d2127aa  index.html
```

A hand edit fails this by construction.

### The throwaway emitter did not survive (T-193-15)

`git status --porcelain frontend/src/components/workflows/__emit164.test.tsx` → EMPTY;
`ls` on that path → *No such file or directory*.

## ⚠ The `🔧` asymmetry — stated rather than smoothed, and routed to U6

Under D-23 the **govern** strip label loses its glyph:

| Band | shipped | variant D |
|---|---|---|
| govern | `🔧 Author & govern` | **`Build it myself`** — no glyph |
| describe | `⚡ Describe & run` | `⚡ Drafting it for you` — **keeps `⚡`** |

This falls directly out of D-23's wording — *"its string becomes variant D's door name — `Build it
myself`"* — and is **not a discretionary choice made while executing**. It is recorded in the sketch
README and flagged as an explicit **observation point for UAT row U6** (*"Open the govern door after
variant D lands. Does the header label agree with the door card that opened it?"*), so the operator
rules on it **by looking**. If the glyph should come back, that is a one-cell edit to the COPY table
plus a regenerate — never a code change.

## The three surfaces this sketch cannot accept, named in its own README

Recorded in the README's dated section so a later reader does not over-trust the page. This is the
SEED-155 exposure in its **"draws none"** form rather than its "draws a wrong one" form.

| Surface | Decisions | Mockup | Driven hardest at |
|---|---|---|---|
| Govern band restack (quiet escape + divider) | D-03 / D-04 | **none**, on either `inline` value | **U3** |
| Describe band restack (demotion only) | D-22 | **none** — decided after the sketch was drawn | **U3b** |
| `card.templateMark` / `run.templateLabel` / `run.templateAbsent` | D-13 / D-15 / D-17 | **none — a PROPOSAL**, no visual bar of any kind | **U4**, **U5** |

## Deviations from Plan

### Auto-fixed / judgement calls

**1. [Rule 3 — Blocking] The audit had to learn about the govern dump, or the plan's own acceptance criterion could not pass**

- **Found during:** Task 2.
- **Issue:** `build.cjs`'s aggregation loop ran `applyVariant` over `dom.chooser` and `dom.describe`
  only. `🔧 Author & govern` exists in **neither** — ripgrep counts exactly **1** occurrence of it in
  the whole of `dom.generated.json`, and it is inside the `govern` dump. Adding the COPY row without
  touching the loop would have reported **`⚠ MISSED: strip.labelGovern`** on B and D and exited
  non-zero, contradicting the plan's *"zero misses for every variant"* criterion and T-193-14.
- **Fix:** `const g = applyVariant(dom.govern, v.key)` folded into the `matched` / `attempted` sets.
  `panels` is deliberately **not** extended — see the decision below.
- **Why this is Rule 3 and not a plan rewrite:** the plan states the outcome (*"the audit
  re-verified against the real govern DOM"*, T-193-14) without naming the line; the loop's own
  shipped comment already defines a real miss as *"an entry that matched in **no** dump"*, so
  including a newly-captured dump is the mechanism working as written.
- **Commit:** `56d745b0`

**2. [Judgement] The govern dump is AUDITED but NOT STAGED — and the limit is written into the generated artifact**

- **Found during:** Task 2.
- **Decision:** the govern door is not rendered as a page stage. It *is* the entire
  `WorkflowBuilderPage`; staging it would put a second full app surface on a page whose question is
  about words on the doors.
- **The honesty risk this creates, and how it is closed:** the contract's *"What is drift-proof here,
  and what is not"* table would otherwise imply, by the presence of a govern dump, that this sketch
  makes a layout claim about the govern door. It does not. A row was therefore added to that
  **generated** table reading *"audited, NOT staged … ⚠ layout NOT claimed"*, so the limit survives
  in the artifact `193-08` reads rather than only in a source comment.
- **Commit:** `56d745b0`

**3. [Rule 1 — Stale fact] Two README figures had gone false and are corrected on measurement**

- **Found during:** Task 3.
- **Issue:** the README asserted *"it reports **37 matched, zero missed**"* and *"the regenerated
  substitution audit reports **D: 18 matched, zero misses**"*. The `37` was **already stale before
  this plan opened** — it was measured before variant D existed, and the base-`4ae3194a` figure was
  `55`. The `D: 18` went stale on this plan's own commit.
- **Fix:** both corrected in place with the correction stated openly (the project's
  correct-in-the-open habit) rather than silently overwritten. Neither operator decision was
  restated or changed — only the arithmetic beside them.
- **Commit:** `ccd0309e`

## ⚠ Corrections to the plan, on measurement

**1. Task 2's row-count command counts the wrong table — 25, not 21.**

The plan's literal criterion is:

```
grep -c '^| `' BUILD-CONTRACT.generated.md   → 21
```

Measured, that command returns **25**, and it returned **24 at the plan's own base**, because it also
matches the **four** AUTH-03 `TEMPLATE_PROPOSAL` rows (`card.templateMark`, `run.templateLabel`,
`run.templateAbsent`, `run.provenance`), which are a different table in the same file. The command is
wrong; **the criterion's intent — 21 substantive COPY rows — is satisfied.** Scoped to the COPY
table it reads exactly 21:

```bash
sed -n '/^| id | where | A · shipped/,/^### Composed string/p' BUILD-CONTRACT.generated.md | grep -c '^| `'
# → 21
```

**2. Task 1's emoji grep returns 0 under Git Bash — a broken tool, not an absent string.**

```
grep -c '🔧 Author &amp; govern' dom.generated.json   → 0     ← Git Bash mangles the 4-byte pattern
rg -c  '🔧 Author &amp; govern' dom.generated.json    → 1     ← present
node … d.govern.includes('🔧 Author &amp; govern')    → true  ← present
```

The other three substrings pass in every tool (`both-doors` 2, `judge-locked` 1, `ml-auto` 2). The
string **is** in the govern dump; only the Git Bash `grep` invocation cannot see it. Same class as
the `192-05` finding that a raw grep reds on the prose documenting it — **verify a green/red with a
second tool before believing it.**

## ⚠ Worktree base drift — 3 of 3 agents in this phase now

The HEAD assertion fired. This worktree spawned on `fda792141b0129de7b15dd40ddc1082e76f95a2a` with
merge-base `3781a3fe4690a9619e619f4cc412bd37a7dafc52`, **not** the dispatched base `4ae3194a`. That is
exactly the drift both Wave 1 agents hit an hour earlier — **3 of 3 in this phase**. Corrected with
`git reset --hard 4ae3194a`, re-bootstrapped, and the Wave 1 artifact sanity check
(`WorkflowDoorSwitch.baseline.test.tsx`) confirmed present before any file was read. Without the
assertion this plan would have regenerated the contract against a tree missing Wave 1 entirely.

## Verification

| Check | Result |
|---|---|
| `bootstrap-worktree.sh` ran first | ✅ (and again after the reset) |
| HEAD on `worktree-agent-*`, base `4ae3194a` | ✅ after correction |
| `GSD_VITEST_MAX_WORKERS=4` exported on the emitter run | ✅ |
| `dom.generated.json` → `chooser,describe,govern,runModal` | ✅ |
| govern dump contains `both-doors`, `judge-locked`, `ml-auto`, `🔧 Author &amp; govern` | ✅ (last one via rg/node — see correction 2) |
| `__emit164.test.tsx` absent from the app tree | ✅ |
| `grep -c 'id: "strip.labelGovern"' build.cjs` | ✅ 1 |
| `D_FROM_C` unchanged | ✅ 1 |
| COPY table substantive rows | ✅ 21 (scoped command — see correction 1) |
| column D cell `**Build it myself**` | ✅ exact |
| zero substitution misses, all variants | ✅ B 19 / C 19 / D 19 |
| second `build.cjs && assemble.cjs` run → md5-identical | ✅ all three artifacts |
| nothing modified outside the sketch dir | ✅ 7 files, all in it |
| STATE.md / ROADMAP.md untouched | ✅ (not in the diff) |
| forbidden `gsd-sdk query state.*` verbs | ✅ none called |

**Not run, and stated rather than implied:** `tsc -p tsconfig.app.json` and the vitest count gate.
This plan changes **zero** files under `frontend/`, so neither gate can move; the only frontend
interaction was the throwaway emitter, which ran green (1 file / 1 test passed) and was deleted.

## Self-Check: PASSED

All seven modified files exist on disk; all three commits (`1605b3cd`, `56d745b0`, `ccd0309e`) are
present in `git log`.
