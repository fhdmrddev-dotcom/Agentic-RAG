# Phase 195 — Pre-Change Live Baseline (D-16)

**Driven:** 2026-08-17, by the orchestrator via Chrome MCP against the live local stack.
**Purpose:** discharge **D-16** — *"the phase's FIRST task is to prove SC#1 on a LIVE RUN before
changing anything."* A baseline only proves something if it **PREDATES** the change (the 188.1
lesson). This file is committed **before any source edit in Phase 195**.

⚠ **This is a MEASUREMENT, not a claim.** Everything below was read off the running app or the live
local DB this session. Where something was **not** exercised, it says so rather than implying it.

**Added 2026-08-17 by plan `195-01` task 1** (executor, no browser): the `BASE_SHA` artifact, the DB
pre-state, the `tsc`/count-gate/five-suite floor, the re-derived hot-file triples, the P7(a) md5s, and
the `PENDING` driven-evidence scaffold for task 2. **No pre-existing section was edited, reworded or
removed** — that content is driven evidence and the phase's record of it. **This plan modified no file
under `frontend/` or `backend/`**; a baseline commit that touched source would already be contaminated.

---

## Verdict

| Success criterion | Verdict |
|---|---|
| **SC#1** — a completed workflow that produced a file shows that file from the run surface | ✅ **MEASURED ALREADY-SATISFIED.** Listed, named, sized and carrying a real download control |
| **SC#2** — no second file UI | ❌ **FAILS TODAY, as expected.** Three live presentations measured below differ in element, icon token, padding and path rendering |
| **SC#3** — many files handled by the shipped pattern | n/a on this run (1 file). ⚠ The criterion names a **retired** pattern and is corrected by this phase (**D-11**) |

**Consequence: CONTEXT's framing is confirmed. SC#1 needed no plumbing; the phase is a
CONSOLIDATION + SCOPING phase.** Scope does **not** grow.

---

## BASE_SHA — the commit this phase is built on

> ⚠ Added by **plan 195-01 task 1**. `BASE_SHA` is an **artifact, not an assumption**: plan 07's
> P7(a) `git diff --numstat <base> HEAD -- MessageItem.tsx ExecuteCodeBody.tsx` assertion reads this
> value, and a `numstat`-empty check **passes trivially when the base SHA is wrong** (7/7 worktrees
> forked from the wrong base in Phase 194, 8/8 in 194.1).

```
BASE_SHA = f2eef045096efabdf7f05a1175271272b55617b9
```

| Field | Command | Value |
|---|---|---|
| `BASE_SHA` | `git rev-parse HEAD` | `f2eef045096efabdf7f05a1175271272b55617b9` |
| Base subject | `git log -1 --format=%s` | `docs(195): plans verified — 8 plans / 4 waves, checker PASSED first iteration` |
| Branch | `git rev-parse --abbrev-ref HEAD` | `develop` |

⚠ **The planning-time expectation was `8b71e9fc7710238e119b40143653fd453525d34c` and it is STALE.
Both are recorded; the expectation is marked stale BESIDE the measurement, never over it.** HEAD
advanced by four planning-only commits between the plan being written and task 1 running:

```
f2eef045 docs(195): plans verified — 8 plans / 4 waves, checker PASSED first iteration   ← BASE_SHA
01c44333 docs(195): track the pattern map — a worktree checks out TRACKED files only
b2c3674f docs(195): create phase plan — 8 plans in 4 waves
7d131463 docs(195): pre-change live baseline — SC#1 measured already-satisfied (D-16)
8b71e9fc docs(195): add validation strategy — 26 plants across 10 claims               ← planning-time expectation
```

**The phase is built on `f2eef045`, the MEASURED head — not on `8b71e9fc`.** All four intervening
commits are `docs(195):` planning documents; `git diff --numstat 8b71e9fc f2eef045 -- frontend backend`
is empty, so the two SHAs are equivalent *for P7(a)'s subject files* — but plan 07 must still assert
against `f2eef045`, because "equivalent today" is an inference and the recorded base is a fact.

---

## Pre-change database state

Read-only `SELECT`s via the venv interpreter (`backend/venv/Scripts/python.exe` + `psycopg2` — a bare
`python -c "import psycopg2"` fails on this box). Postgres at `127.0.0.1:54322`. **No `UPDATE`,
`INSERT`, DDL or migration was run.**

| Figure | Query | Value |
|---|---|---|
| Total `workspace_files` rows | `select count(*) from workspace_files` | **86** |
| Rows on the target thread `1189a1a3-b836-4e7a-8aca-a021f1175e4a` | `select count(*) … where thread_id = '1189a1a3-…'` | **1** |

**The pre-existing terminal-arm evidence row, `workspace_files.id = d4598e01-a45b-430a-b30b-05ef7e9a3852`**
(`select path, size_bytes, mime_type, created_at from workspace_files where id = 'd4598e01-…'`):

| Field | Value |
|---|---|
| `path` | `/Northwind-QBR-Template.docx` |
| `size_bytes` | **39660** — the number arm 1's downloaded file must equal on disk |
| `mime_type` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| `created_at` | `2026-08-16 08:40:32.464150+00` |

**Zero drift** from RESEARCH § "The D-16 live baseline (R4)" on all four fields and both counts.

---

## Pre-change tree baselines — `tsc`, the count gate, and the five in-scope suites

⚠ **`GSD_VITEST_MAX_WORKERS=2` on every invocation, including the single runs** (`CLAUDE.md` §
Parallel execution — the cap ROTTED from 4 to 2; at 4 the gate reports phantom `STACK_TRACE_ERROR`
timeouts in files no plan touched).

⚠ **A growing gate total is the gate WORKING.** Its contract is *no per-file DECREASE* + *zero
failing*, never a fixed grand total. Every figure below is the MEASURED one.

### Typecheck

```bash
cd frontend && npx tsc --noEmit -p tsconfig.app.json
```

**33 errors** — matches the expectation, **unmoved** since 194.1. (A bare `tsc --noEmit` checks ZERO
files here; the `-p tsconfig.app.json` is load-bearing.)

### Count gate — VERDICT LINE VERBATIM

```bash
cd frontend && GSD_VITEST_MAX_WORKERS=2 node ../scripts/vitest-count-gate.cjs
```

```
  total                                      3898    3972     +74
  total 3972  ·  failed 0  ·  pinned total 3898
--------------------------------------------------------------
count gate OK — 75/75 pinned files present, no per-file decrease, 0 failing.
```

The last line above is the verdict line, quoted verbatim rather than summarised (the gate can present
`[missing-file]` WITH `failed 0`, which reads like a pass at a glance — 194).

⚠ **`CLAUDE.md` quotes `3918 / failed 0 / pinned 3868`. That figure is STALE by `+54 / +30` and is
marked stale here BESIDE the measurement, never over it.** `195-VALIDATION.md`'s `3972 / 3898 / 75/75`
is confirmed exactly.

⚠ **The gate covers ONE of this phase's five suites.** `TARGETS` has no entry for
`src/components/chat`, `src/lib` or `src/components/panel` — only `src/pages/WorkflowRunPage.test.tsx`
is gated. A green gate says nothing about four fifths of this phase, which is why the five below are
run explicitly.

### The five in-scope suites, each run individually

Command shape: `cd frontend && GSD_VITEST_MAX_WORKERS=2 npx vitest run --maxWorkers=2 <file>`

| Suite | Command (file argument) | Measured | Expected | Gated? |
|---|---|---|---|---|
| Run page | `src/pages/WorkflowRunPage.test.tsx` | **102 passed / 0 failed** | 102 | ✅ gated + pinned **EXACT, zero slack** |
| Panel file list | `src/components/panel/__tests__/FilesSection.test.tsx` | **11 passed / 0 failed** | 11 | ⚠ ungated |
| Chat final outputs | `src/__tests__/components/MessageItem.finalOutputs.test.tsx` | **11 passed / 0 failed** | 11 | ⚠ ungated |
| Icon module | `src/lib/__tests__/fileIcon.test.tsx` | **11 passed / 0 failed** | 11 | ⚠ ungated |
| Stop control | `src/components/chat/__tests__/StopControl.baseline.test.tsx` | **15 passed / 0 failed** | 15 | ⚠ ungated **AND greps `WorkflowRunPage.tsx?raw`** — assert it green after EVERY edit to that file (P9) |

**150 tests across 5 files, 0 failing. Zero drift from every expected value.** No failing filenames
to capture, so the "capture failing filenames BEFORE re-running" rule had nothing to record.

---

## Hot-file triples, re-derived from git (not copied)

Recipe applied verbatim from `CLAUDE.md` § "Hot-file ledger", **with six-digit dated quick-task
buckets subtracted** — they are dated quick tasks, not phases.

```bash
git log --oneline -- <file> | wc -l                                    # commits
git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' \
  | sed -E 's/-.*//' | grep -E '^[0-9]+(\.[0-9]+)?$' | sort -u | wc -l  # phases
wc -l <file>                                                           # lines
```

| File | commits / phases / lines | Buckets returned (subtractions noted) | vs D-17 / RESEARCH R5 |
|---|---|---|---|
| `frontend/src/pages/WorkflowRunPage.tsx` | **12 / 3 / 1101** | `188 188.1 194.1` — zero quick-task buckets | **no drift** |
| `frontend/src/components/chat/OutputFileCard.tsx` | **7 / 6 / 187** | `075.2 075.4 075.7 095 095.1 155` — zero quick-task buckets | **no drift** · ⚠ ABSENT from the ledger |
| `frontend/src/components/panel/FilesSection.tsx` | **6 / 3 / 277** | `087 088 100` — zero quick-task buckets | **no drift** · ⚠ ABSENT from the ledger |
| `frontend/src/lib/fileIcon.tsx` | **1 / 1 / 105** | `095` — zero quick-task buckets | **no drift** |
| `frontend/src/components/chat/MessageItem.tsx` | **57 / 29 / 856** | 32 buckets raw; **3 subtracted as dated quick tasks (`260328`, `260405`, `260630`)** ⇒ **29** | **no drift** |

**ZERO DRIFT on all five** — D-17's and RESEARCH R5's figures were measured correctly and no commit
has landed on any of these files since 2026-08-17. Re-derived rather than quoted, because this
project's standing finding is that a triple written at a phase's close goes stale on the next commit.

Plan 08 consumes these for the same-commit ledger sync (`CLAUDE.md` row ↔ `docs/HOT-FILE-LEDGER.md`
section). ⚠ `WorkflowRunPage.tsx` becomes the **4th** phase when 195 lands; `OutputFileCard.tsx` (6)
and `FilesSection.tsx` (3, at threshold) both FIRE G-5 and are both invisible to the ledger today.

---

## Byte-identity pre-state for P7(a)

Plan 07 asserts that chat gains **no** capability (D-13) by proving these two files are byte-identical
to their state at `BASE_SHA`. The md5s are recorded so the assertion has a fact to compare against,
not an assumption — and so a `git`-only check can be corroborated by content.

```bash
git rev-parse HEAD
md5sum frontend/src/components/chat/MessageItem.tsx \
       frontend/src/components/chat/tool-bodies/ExecuteCodeBody.tsx
```

| File | md5 at `BASE_SHA` |
|---|---|
| `frontend/src/components/chat/MessageItem.tsx` | `4a83da8b27f91e70ff3e18d2ce181242` |
| `frontend/src/components/chat/tool-bodies/ExecuteCodeBody.tsx` | `386ed875acf6938f3fbcd0bac38777ab` |

⚠ **P7(a) is a `git` assertion, not a vitest one, and a `numstat`-empty check passes trivially when
the base SHA is wrong.** Plan 07 must (1) name `f2eef045…` explicitly rather than `HEAD~N`, and
(2) plant a one-character edit and prove the check FAILS, before trusting an empty result.

---

## Environment as measured

| Dependency | Reading |
|---|---|
| Supabase API / Postgres / Redis | ✅ `54321` / `54322` / `6379` |
| Backend (uvicorn) | ✅ `8000` |
| Frontend (vite) | ✅ `http://localhost:5173` — ⚠ **binds `[::1]` ONLY.** An IPv4 probe of `127.0.0.1:5173` reports it DOWN while it is running |
| Chrome extension | ✅ connected, local, `Browser 1` |
| `.docx` reader | ✅ Word 2016 present, `.docx` → `Word.Document.12` — **D-20's "open the file" bar is achievable** |
| Session | already authenticated as `fhdmrd@gmail.com` = `d8a54002-6a29-4b88-b918-cff2aa4a06d5`, the `user_id` owning every run below |

⚠ **`visual_workflow_canvas` reads `"everyone"` in the live local `app_settings.feature_visibility`.**
Its **cold default is `"off"` — hidden from EVERYONE, operators included**
(`backend/app/models/user_settings.py:1197-1203`), and `ChatLayout.tsx:752` gates the whole run view
on `activeView === "workflow-run" && canvasEnabled`. **RUN-02's surface therefore only exists where an
operator has flipped the canvas on.** Recorded because this is exactly the trap Phase 194.1's D-09
amendment hit — a receipt fed from a canvas-gated read would have been invisible at the shipped
default. It is **not** a blocker for v3.7 (the milestone is workflow completion and the operator has
flipped it locally), but a plan must not assume the surface is on for a fresh install.

---

## The run used, chosen on evidence

`northwind-qbr-fa65a43c` **v1**, `published`, definition `93a86e21-be72-49a0-be85-dd01a3aa38ca`.

Live DB confirms research exactly — **6 completed file-producing runs, each with EXACTLY ONE `.docx`
at 38-40 KB, `kind` NULL and `run_claim` NULL on every row:**

| Run | Thread | File id | Bytes |
|---|---|---|---|
| **`833e8e85`** ← used | `1189a1a3` | `d4598e01` | **39,660** |
| `27cf1ab9` | `fb2be102` | `6a4c403f` | 39,511 |
| `4bdd5f4c` | `bed9e525` | `8c604a85` | 38,367 |
| `9d619a30` | `21e81a99` | `40b9acec` | 39,644 |
| `b021c7b0` | `d6947e29` | `bb032418` | 39,698 |
| `cb0e2e95` | `7e05797b` | `369a083c` | 38,950 |

`b021c7b0` at **39,698 B** is the Phase 193.2 UAT hero run — it matches `STATE.md` byte for byte,
which independently corroborates both records.

⚠ **`run_claim` is NULL on all rows**, re-confirming **D-01**: it is Phase 141 template-asset context
isolation, **not** the attribution field. `kind` is NULL too. **No migration is warranted.**

**Path driven:** Chat → the Northwind thread whose spine reads
`gather-usage ✓ | gather-support ✓ | gather-commercial ✓ | synthesize ✓ | emit-qbr ✓` →
the panel receipt **"Open the run"** → the run surface. This is the documented thread→run seam
(`ChatLayout.tsx:366-372` `openRunSurface`), **not** a rail item — no nav item claims this view.

---

## What the run surface actually renders (`data-testid="run-deliverables"`)

```
What this run produced
Northwind-QBR-Template.docx
38.7 KB
```

| Property | Measured value |
|---|---|
| Heading | **`"What this run produced"`** — ⚠ the exact literal **D-02** says overclaims. Confirms research **F3** (`WorkflowRunPage.tsx:122`) is live, not historical |
| Row element | **`<button type="button">`** |
| `aria-label` | `"Download Northwind-QBR-Template.docx (38.7 KB)"` |
| `title` | `"/Northwind-QBR-Template.docx"` (full path) |
| Visible name | `Northwind-QBR-Template.docx` (**basename**) |
| Size text | `38.7 KB` — 39,660 / 1024 = 38.73 ⇒ **KiB** formatting |
| Icon | `lucide-file-text` · `h-4 w-4 shrink-0 text-muted-foreground` · **16×16 measured** |
| Extension ribbon | **absent** |
| Row height | **33 px** |
| `<button>` count in region | **1** |
| `<li>` count | 1 |

⚠ **This independently confirms F10: the run page does NOT use `fileIcon()`.** `fileIcon()` renders a
stacked hex-coloured glyph **plus a mono `.EXT` ribbon** at 30 px in chat; the run page renders a flat
16 px monochrome glyph and no ribbon. **"One icon path" is a VISIBLE change, not a no-op.**

---

## The three live presentations, side by side

| | **Run page** | **Panel (`FilesSection`)** | **Chat** |
|---|---|---|---|
| Element | `BUTTON` | `DIV role="option" tabindex="0"` inside `role="listbox"` | — |
| Icon class | `h-4 w-4 shrink-0 **text-muted-foreground**` | `h-4 w-4 flex-shrink-0 **text-panel-muted-foreground**` | — |
| Icon size | 16×16 | 16×16 | — |
| Name shown | `Northwind-QBR-Template.docx` (basename) | `/Northwind-QBR-Template.docx` (**full path, `font-mono`**) | — |
| Size | `38.7 KB` | `38.7 KB` | — |
| Padding | `px-2 py-2` | `px-2.5 py-2` | — |
| Height | **33 px** | **38 px** | — |
| Activation | download | `cursor-pointer` → **preview** | — |

⚠ **CHAT RENDERS NO FILE CARD FOR THIS DELIVERABLE AT ALL.** The only chat trace is plain markdown
inside the assistant message: *"Produced the filled deliverable: /Northwind-QBR-Template.docx"*.
`document.querySelector('[data-testid="output-file-card"],[data-dead]')` → **null**.

**This is a REAL PLANNING CONSEQUENCE, not trivia:**
1. It corroborates **D-14** — `RunCard`'s badge parses `output_files` out of `tool_calls` and a
   workflow emit returns `path`, so chat structurally has nothing to render.
2. It corroborates **D-13** — chat gains no NEW file affordance, and none exists to regress.
3. ⚠ **It refines D-20's acceptance bar:** the "three-surface side-by-side" **cannot use this file for
   the chat row**, because chat never renders one for a workflow deliverable. `OutputFileCard`'s chat
   row must be exercised with a **sandbox `output_files`** case (an `execute_code` run), or the
   side-by-side must be honestly recorded as **two live surfaces + one fixture**.

**Four measured deltas the extraction must reconcile** — none stylistic:
`text-muted-foreground` vs `text-panel-muted-foreground` (**different design tokens**, the panel's
being a deliberate Phase 088-05 AA-contrast choice) · basename vs full `font-mono` path · `px-2` vs
`px-2.5` · `button` vs `div[role=option]` with roving `tabindex`.

---

## Driven evidence — arms 0-3 (plan 195-01 task 2)

> ⚠ **PENDING** — task 2 is a **blocking** `checkpoint:human-verify`. It needs a browser and a `.docx`
> reader, which the executor does not have; **the orchestrator owns Chrome MCP and drives it.** Task 3
> replaces every `PENDING` below with the evidence VERBATIM, then writes the verdict line.
>
> The sections above already carry a **partial** arm-1 readback driven at discuss-time (the region's
> DOM shape, the `aria-label`, the row geometry, the three-surface deltas). **What none of them proves
> is that the bytes transfer** — no file was ever fetched to disk. That is precisely what arms 1 and 2
> add, and it is D-20's actual bar.

### Arm 0 — environment probe (browser + `.docx` reader), driven FIRST not at close

**PENDING.** Required: `list_connected_browsers` result recorded non-empty, or ⛔ **with the reason**.
Phase 194's eight UAT rows went entirely undriven because this was checked at the end.
*(Discuss-time reading, to be re-confirmed at drive time rather than inherited: Chrome extension
connected as `Browser 1`; Word 2016 present, `.docx` → `Word.Document.12`.)*

### Arm 1 — terminal run, read-only, zero risk

**PENDING.** Run `833e8e85-92a2-451b-9af7-7cd085355ff7` · thread `1189a1a3-b836-4e7a-8aca-a021f1175e4a`
· definition `northwind-qbr-fa65a43c` v1. Owed: the region's `h2` text, the `li` count, the button's
exact `aria-label`, **the downloaded file's on-disk byte size (must equal 39660)**, and
"opened in Word: yes/no".

### Arm 2 — live run, watched mid-run

**PENDING.** Owed: a NEW `run_id` + `thread_id`; the new `workspace_files` row's four fields
(`id`/`path`/`size_bytes`/`created_at`); whether the row appeared **mid-run** or only at terminal; and
"opened in Word: yes/no". ⚠ Launch `northwind-qbr-fa65a43c` v1 — **AVOID `compliance-gap-report`,
`pm-risk-register` and `risk-register`**: zero of their runs has ever produced a file.

### Arm 3 — the three-surface side-by-side (D-20's second half, F10's evidence)

**PENDING.** Owed: three rows' rendered text plus three icon-element descriptions (glyph size, `.EXT`
ribbon present y/n, computed colour). ⚠ **The measured chat gap refines this arm's bar:** chat renders
**no** file card for a workflow deliverable at all, so the chat row must be exercised with a **sandbox
`output_files`** case (an `execute_code` run) — or the side-by-side recorded honestly as **two live
surfaces + one fixture**.

### Verdict

**PENDING** — task 3 writes exactly one line: `SC#1 CONFIRMED (live, pre-change)` or `SC#1 REFUTED —
<observation> — <scope consequence>` from RESEARCH § "What a REFUTATION looks like". ⚠ **A row that
renders only after the run goes terminal does NOT refute SC#1** (RUN-02 says *"when the run
finishes"*) — log it. **A download that 404s or yields 0 bytes, or a file that opens corrupt, is a
BACKEND defect** that breaks this phase's "no Python" premise — escalate rather than proceed. ⚠ If any
arm returns ⛔, say so **in the verdict line itself**: a baseline that lists only what passed is not a
baseline.

---

## What was NOT done, stated rather than implied

- ⚠ **The download was NOT exercised.** The control's presence, its `aria-label` and the DB byte size
  are measured; **a file was not fetched to disk.** Downloading requires the operator's explicit
  go-ahead, and exercising it is **D-20's** acceptance step (post-change), not D-16's baseline. The
  two `KB`-matching readings are consistent with a correct wiring but **do not prove the bytes
  transfer.**
- **D-04's blind spot stands unexamined:** the 161 file-less workflow-run threads were not checked for
  whether any had an `llm_emit` phase. An **ACCEPTED BLIND SPOT**, not a proven absence.
- **`SC#3` was not exercised** — no run in the live DB has more than one deliverable (the 20-file
  thread is an agent chat, per D-01).

---

## Environment findings worth carrying (cost real calls this session)

1. ⚠ **The Chrome extension's coordinate clicks do NOT reach this React app.** Two
   `left_click` calls at correctly-measured centre coordinates left `aria-current` unchanged;
   `element.click()` navigated immediately. **Drive this app via `element.click()`**, and treat a
   silent no-op as an event-delivery problem, not a gated feature.
2. ⚠ **A 20-iteration click-and-read loop exceeded the 45 s CDP `Runtime.evaluate` window** and
   returned a timeout while the renderer stayed healthy. **Keep browser loops to ≤ 5 iterations.**
3. ⚠ **A 700 ms settle is too short** — two threads reported an EMPTY spine that was a load race, not
   an absence; one of them was the completed run. **A short wait manufactures false negatives.** Use
   ≥ 2.5 s after a thread selection.
4. Thread rows carry **no `data-thread-id`** — a specific thread cannot be addressed from the DOM.

---

*Baseline for Phase 195. Committed before any source change, per D-16.*
