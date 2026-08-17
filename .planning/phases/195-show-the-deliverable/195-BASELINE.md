# Phase 195 — Pre-Change Live Baseline (D-16)

**Driven:** 2026-08-17, by the orchestrator via Chrome MCP against the live local stack.
**Purpose:** discharge **D-16** — *"the phase's FIRST task is to prove SC#1 on a LIVE RUN before
changing anything."* A baseline only proves something if it **PREDATES** the change (the 188.1
lesson). This file is committed **before any source edit in Phase 195**.

⚠ **This is a MEASUREMENT, not a claim.** Everything below was read off the running app or the live
local DB this session. Where something was **not** exercised, it says so rather than implying it.

**Added 2026-08-17 by plan `195-01` task 1** (executor, no browser): the `BASE_SHA` artifact, the DB
pre-state, the `tsc`/count-gate/five-suite floor, the re-derived hot-file triples, the P7(a) md5s, and
the placeholder driven-evidence scaffold for task 2 (**since DISCHARGED by task 3** — the scaffold's
markers are replaced by driven evidence below, and no placeholder token remains in this file).
**No pre-existing section was edited, reworded or
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

### ⚠ REFINED 2026-08-17 (task 2, live) — the token delta is THEME-CONDITIONAL

> **The line immediately above is PRESERVED, not rewritten.** It says the two icon rows use
> "**different design tokens**". That is true as a statement about the *class names* and it
> **OVERSTATES the visible delta**, because in the theme this app actually ships the two tokens
> resolve to the same colour. The correction is recorded BESIDE the original, per this project's
> standing rule (D-11), never over it.

Measured from the stylesheet **and** confirmed empirically in the browser:

| Theme | `--muted-foreground` | `--panel-muted-foreground` | Same? |
|---|---|---|---|
| **dark** (`src/index.css:105` / `:151`) — the shipped **Deep Midnight default** | `220 16% 65%` | `220 16% 65%` | ✅ **IDENTICAL** |
| **light** (`src/index.css:30` / `:59`) | `220 9% 46%` | `220 12% 40%` | ❌ **DIFFERENT** |

Both live rows resolved to `rgb(151, 161, 180)` (see arm 3), and probe elements rendered with each
class resolved identically — so the dark-theme coincidence is confirmed **empirically**, not merely
read off the stylesheet.

**Why the panel token exists at all**, recorded in the source rather than guessed:
`frontend/src/components/panel/PanelSection.tsx:85` — *"light `--muted-foreground` was 4.01:1"*, i.e.
**below the 4.5:1 AA floor** on the panel surface. `ConfidenceChip.tsx:49` records
`--panel-muted-foreground 220 16% 65% → 7.21:1 on #0c121d`.

⚠ **CONSEQUENCE FOR PLAN 195-03, and it is a real one.** A "one icon path" unification onto the global
`text-muted-foreground` would be:
1. a **no-op in every dark-theme screenshot** — so a visual diff in the shipped theme would show
   nothing and could be mistaken for "the change landed safely"; and
2. a **measured contrast REGRESSION in the light theme**, where the panel token exists precisely to
   clear AA.

The unification must therefore either keep the surface-specific token as a prop, or make the light-theme
contrast consequence an explicit, accepted decision. It must not be waved through on a dark-theme
screenshot.

---

## Driven evidence — arms 0-3 (plan 195-01 task 2)

> **DRIVEN 2026-08-17 by the ORCHESTRATOR via Chrome MCP**, Browser 1 (local, Windows), against the
> live local stack. Task 2 is a **blocking** `checkpoint:human-verify`: it needs a browser and a
> `.docx` reader, which the worktree/CLI executor does not have. The evidence below is recorded
> **verbatim, not summarised** — this section replaces the task-1 placeholder scaffold in full.
>
> The sections above carried a **partial** arm-1 readback driven at discuss-time (the region's DOM
> shape, the `aria-label`, the row geometry, the three-surface deltas). **What none of them proved was
> that the bytes transfer** — no file had ever been fetched to disk. That is exactly what arms 1 and 2
> add, and it is D-20's actual bar.
>
> ⚠ **ZERO ARMS WERE BLOCKED. Zero ⛔ rows.** Stated as a measured fact rather than left to silence —
> a baseline that lists only what passed is not a baseline.

### Arm 0 — environment probe (browser + `.docx` reader), driven FIRST not at close

`list_connected_browsers` → **ONE browser**, verbatim:

```json
{"deviceId":"a0b123bb-974d-4142-8ec6-599fec5e8930","name":"Browser 1","osPlatform":"Windows","isLocal":true}
```

**Not empty ⇒ arm 0 PASSES.** Ports measured accepting a real TCP connection (not "container up"):
`54321` ✅ · `54322` ✅ · `6379` ✅ · `8000` ✅ · `5173` ✅ — the last probed over **IPv6 `::1`**, since
an IPv4 probe reports it down while Vite is running (recorded in § Environment as measured above).
`.docx` reader: **Word present and used** — see arm 1.

Phase 194's eight UAT rows went entirely undriven because this probe was left to the end. Here it ran
first, and **no arm was blocked**.

### Arm 1 — terminal run, read-only, zero risk

Run **`833e8e85-92a2-451b-9af7-7cd085355ff7`** · thread **`1189a1a3-b836-4e7a-8aca-a021f1175e4a`** ·
definition `northwind-qbr-fa65a43c` v1.

**How the row was found (D-27 compliance — NOT `getElementById`):** the 5th button matching
`Quarterly Business Review — Northwind Logistics` in the thread sidebar, then the panel receipt
control whose text is exactly `Open the run`. Thread identity was CONFIRMED **independently from the
app's own network calls** — a `fetch` interceptor recorded
`http://localhost:8000/threads/1189a1a3-b836-4e7a-8aca-a021f1175e4a/{workflow,todos,workspace/files,ask_user/pending,tasks}`.

DOM readback of `[data-testid="run-deliverables"]`:

| Property | Measured |
|---|---|
| `h2` textContent | `What this run produced` |
| `li` count | **1** |
| `button` count in region | **1** |
| region textContent | `What this run producedNorthwind-QBR-Template.docx38.7 KB` |
| button `aria-label` | `Download Northwind-QBR-Template.docx (38.7 KB)` |
| button `title` | `/Northwind-QBR-Template.docx` |
| button rect | `w 1460 · h 33 · x 234 · y 1166` |
| button computed padding | `8px` |
| icon | `lucide lucide-file-text h-4 w-4 shrink-0 text-muted-foreground`, **16×16**, `rgb(151, 161, 180)` |
| `.EXT` ribbon | **absent** (`svg text` node count = 0) |

**THE DOWNLOAD WAS EXERCISED.** The operator clicked the row; the file landed at
`C:\Users\fhdmr\Downloads\Northwind-QBR-Template (3).docx` and was opened with `& '<path>'`.
Machine verification of the downloaded **bytes**:

| Check | Command | Result |
|---|---|---|
| On-disk size | `stat -c %s` | **39660 bytes — byte-exact with `workspace_files.size_bytes`** |
| md5 | `md5sum` | `927ff3706a257a0745f44774f9f186d3` |
| ZIP magic | `head -c 4 \| od -An -c` | `P K 003 004` |
| Package integrity | `zipfile.ZipFile(...).testzip()` | **`None` — zero CRC errors**, 17 entries |
| OOXML skeleton | namelist | `[Content_Types].xml` ✅ · `word/document.xml` ✅ · `_rels/.rels` ✅ |
| `word/document.xml` | len | 13,296 bytes |
| Extracted `<w:t>` text | regex | **5,843 characters of FILLED prose** |

Opening of the extracted text, verbatim: *"QUARTERLY BUSINESS REVIEW Northwind Logistics Review
period: Q3 2026 (1 July – 30 September 2026) | Account owner: Priya Raghunathan ACCOUNT HEALTH AMBER –
operational adoption is strong and the product is deep"*.

⚠ **The Word arm, recorded with its EXACT limit.** The operator invoked the system open handler on the
file (`& 'C:\Users\fhdmr\Downloads\Northwind-QBR-Template (3).docx'`), and the package was verified
**by machine** to be a structurally valid, CRC-clean OOXML document carrying real filled report prose —
**not** a placeholder dump and **not** a truncated stream. A separate **visual** confirmation that Word
rendered the page was **not reported back**. So: **the bytes and the package are PROVEN; the visual
render is INFERRED** from a valid package plus a successful open invocation. This is deliberately not
written as "opened in Word: yes" (unobserved) nor as "no" (false).

**None of RESEARCH's three high-cost refutations fired:** the download did not 404, did not yield 0
bytes, and the file did not open corrupt. The "no Python / no backend" premise of this phase holds.

### Arm 2 — live run, watched from launch (operator explicitly approved the spend)

Launched from the Workflows page. Card identified as `data-testid="published-card"`, title exactly
`Quarterly Business Review — Northwind Logistics` (the ONE card without a `(Q3 2026)` suffix), `v1`,
`published`, `Yours`, folder `📁 Template-Test`. Cross-checked against the DB: slug
**`northwind-qbr-fa65a43c`**, definition **`93a86e21-be72-49a0-be85-dd01a3aa38ca`** — the plan's named
target, so the correct workflow was launched and not a look-alike.

Launch dialog: KB select left at `Workflow default — 📁 Template-Test`; `kickoff_prompt` textarea set
to `Phase 195 D-16 baseline — live SC#1 arm 2. Produce the Northwind QBR deliverable.` Then
`▶ Run workflow`.

| Field | Value |
|---|---|
| NEW `run_id` | **`ab124064-18c5-47cf-b019-df75e7acbe4c`** |
| NEW `thread_id` | **`f02d78b0-5051-4f71-95ce-fbd9a853d830`** |
| run `created_at` | `2026-08-17 11:42:15.274499+00` |

**The empty state was captured BEFORE the file existed** — 4 s after launch the region read, verbatim:

```
What this run producedNo files yet — this run hasn't written anything.
```

…with `li` count **0**. This matters: the populated row that follows is a **transition observed**, not
a state found.

New `workspace_files` row, all four fields:

| id | path | size_bytes | mime_type | created_at |
|---|---|---|---|---|
| `6e05d3d3-95dc-4030-84d8-c468776b3e1b` | `/Northwind-QBR-Template.docx` | **38615** | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `2026-08-17 11:45:19.676226+00` |

**The surface updated LIVE with no reload.** `performance.getEntriesByType('navigation')[0].type` was
still `navigate` — a single SPA load, no reload since launch. Post-transition readback:

| Property | Measured |
|---|---|
| region textContent | `What this run producedNorthwind-QBR-Template.docx37.7 KB` |
| `li` count | **1** |
| `aria-label` | `Download Northwind-QBR-Template.docx (37.7 KB)` |
| `title` | `/Northwind-QBR-Template.docx` |
| Row height | **33 px** |
| Icon | `lucide lucide-file-text h-4 w-4 shrink-0 text-muted-foreground`, **16×16**, `rgb(151, 161, 180)` |
| `.EXT` ribbon | **absent** |

38615 / 1024 = 37.71 ⇒ **KiB formatting confirmed a SECOND time, on a SECOND file.**

**DB side-effect accounting:** `workspace_files` **86 → 87**, `workflow_runs` **226 → 227**. Exactly
+1 / +1 — the live arm wrote what a user's launch writes and nothing else.

#### ⚠ Mid-run vs terminal — measured to the millisecond, and this is the arm's most important number

| Event | Timestamp |
|---|---|
| file `created_at` | `11:45:19.676226+00` |
| run `updated_at` (the flip to `completed`) | `11:45:19.711959+00` |
| **delta** | **run terminal is 35.7 ms AFTER the file row** |

A 3-second DB poll saw `status=active files=0` then `status=completed files=1` — **too coarse to
separate them**; the millisecond comparison above is the authoritative reading. So: **the row does NOT
appear meaningfully mid-run.** It appears at the emit phase, ~36 ms before the run goes terminal.

⚠ **THIS IS A LOG, NOT A REFUTATION, AND THE REASON IS WRITTEN OUT SO A LATER READER CANNOT MISTAKE
ONE FOR THE OTHER.** RESEARCH § "What a REFUTATION looks like" rules on exactly this row: *"Row appears
only after the run goes terminal, never mid-run → Log as an observation. RUN-02 says 'when the run
finishes' — so this does not refute SC#1; seed it."* **36 ms before terminal IS "when the run
finishes."** RUN-02's bar is the finish, not the middle; a surface that populates at emit satisfies it
exactly. Scope does not grow. Nothing here is owed to a later plan beyond this record.

### Arm 3 — the three-surface side-by-side (D-20's second half, F10's evidence)

Two surfaces measured **LIVE** on thread `1189a1a3`, in the same session, back to back:

| | **Run page** (`run-deliverables`) | **Panel** (`FilesSection`) |
|---|---|---|
| Element | `BUTTON` | `DIV[role=option]`, `tabindex="0"`, inside `role="listbox"` |
| Rendered text | `Northwind-QBR-Template.docx` + `38.7 KB` (**basename**) | `/Northwind-QBR-Template.docx` + `38.7 KB` (**full path**) |
| Computed padding | `8px` | `8px 10px` |
| Height | **33 px** | **38 px** |
| Icon class | `lucide-file-text h-4 w-4 shrink-0 text-muted-foreground` | `lucide-file-text h-4 w-4 flex-shrink-0 text-panel-muted-foreground` |
| Icon size | 16×16 | 16×16 |
| Icon computed colour | `rgb(151, 161, 180)` | `rgb(151, 161, 180)` |
| `.EXT` ribbon | absent | absent |
| `cursor` | (button) | `pointer` |
| Activation | download | preview |

**Third surface — chat — RENDERS NOTHING, re-confirmed LIVE.**
`document.querySelector('[data-testid="output-file-card"]')` → **null**; `[data-dead]` → **null**; on
the very thread that owns the deliverable.

⚠ **DECISION, recorded as a decision and not left as an omission.** D-20's three-surface bar is
discharged as **two live surfaces + one fixture**: the chat row is carried by plan **195-02**'s
`OutputFileCard.baseline.test.tsx` fence rather than by a live capture. The reason is that this is the
**stronger** artifact, not the cheaper one — **a fixture becomes a permanent fence that re-asserts
itself on every run of the suite; a live capture is a one-time screenshot that rots the moment the
component changes.** The plan's own text permits this ("or the side-by-side must be honestly recorded
as two live surfaces + one fixture"), and the underlying cause is D-14: a workflow emit returns `path`,
`RunCard` parses `output_files` out of `tool_calls`, so chat structurally has nothing to render for a
workflow deliverable. There is no live chat row to capture — not for this file, by construction.

### ⚠ NEW FINDING — the icon-token delta is THEME-CONDITIONAL, and this baseline's earlier reading OVERSTATED it

See the dedicated subsection under § "The three live presentations, side by side" above
(*"REFINED 2026-08-17"*). Summarised here so arm 3 is self-contained: the two tokens are **identical in
the shipped dark theme** and differ only in light, where the panel token exists to clear the AA
contrast floor. A "one icon path" unification onto the global token would be a **no-op in every
dark-theme screenshot** and a **measured contrast regression in light**. Plan **195-03** owns this.

---

## SC#1 CONFIRMED (live, pre-change)

**SC#1 — *a completed workflow that produced a file shows that file from the run surface* — is
CONFIRMED as a MEASUREMENT taken at `BASE_SHA = f2eef045…`, before this phase changed a line of
source.** Two independent runs, one pre-existing and terminal, one launched live this session:

| Evidence | Arm 1 (`833e8e85`) | Arm 2 (`ab124064`, live) |
|---|---|---|
| Region renders | ✅ `What this run produced` | ✅ empty state → populated row, **no reload** |
| Row named + sized | ✅ `Northwind-QBR-Template.docx` · `38.7 KB` | ✅ `Northwind-QBR-Template.docx` · `37.7 KB` |
| Download control real | ✅ `aria-label` + `title` + click | ✅ same shape |
| **Bytes transfer** | ✅ **39660 on disk = `size_bytes` exactly** | (arm 1 discharges the byte bar) |
| **File is a valid `.docx`** | ✅ CRC-clean OOXML, 17 entries, 5,843 chars of filled prose | — |
| Blocked / ⛔ | **none** | **none** |

**Zero arms blocked; zero ⛔ rows.** None of RESEARCH's refutation rows fired: no absent row on a
terminal run, no 404, no 0-byte download, no corrupt open. The one refutation-table row that DID match
an observation — *"row appears only after the run goes terminal"* — is classified by that same table as
**a log, not a refutation** (RUN-02's bar is *"when the run finishes"*, and the row precedes terminal by
35.7 ms).

**Consequence: CONTEXT's framing (D-16) is confirmed by observation rather than inherited. SC#1 needed
no plumbing. Phase 195 remains a CONSOLIDATION + SCOPING phase and its scope does NOT grow.**

---

## What was NOT done, stated rather than implied

- ~~⚠ **The download was NOT exercised.** The control's presence, its `aria-label` and the DB byte size
  are measured; **a file was not fetched to disk.** Downloading requires the operator's explicit
  go-ahead, and exercising it is **D-20's** acceptance step (post-change), not D-16's baseline. The
  two `KB`-matching readings are consistent with a correct wiring but **do not prove the bytes
  transfer.**~~
  > ⚠ **SUPERSEDED 2026-08-17 by task 2, arm 1 — the original is struck through and PRESERVED, never
  > deleted.** The download **WAS** exercised at drive time, with the operator's explicit go-ahead.
  > The file was fetched to disk at `39660` bytes — **byte-exact with `workspace_files.size_bytes`** —
  > md5 `927ff3706a257a0745f44774f9f186d3`, ZIP magic `PK\x03\x04`, `testzip()` → `None` (zero CRC
  > errors, 17 entries), and `word/document.xml` carrying **5,843 characters of filled prose**. **The
  > bytes DO transfer, and that is now a measurement rather than an inference.** The original sentence
  > was correct when written (task 1, before the browser arm) and is kept so the record shows what was
  > and was not known at each step.
- **D-04's blind spot stands unexamined:** the 161 file-less workflow-run threads were not checked for
  whether any had an `llm_emit` phase. An **ACCEPTED BLIND SPOT**, not a proven absence.
- **`SC#3` was not exercised** — no run in the live DB has more than one deliverable (the 20-file
  thread is an agent chat, per D-01).

---

## What this baseline does NOT claim

Written after the drive, so that a later reader can tell **measured** from **assumed** without
re-deriving anything. Every item below is a KNOWN limit of this record, not a defect found.

1. **Whether any of the 161 file-less runs had an `llm_emit` phase — NOT CHECKED.**
   This is **D-04's ACCEPTED BLIND SPOT**, restated here rather than left in CONTEXT. The 161
   workflow-run threads with zero `workspace_files` rows are believed to be cancelled/failed runs or
   runs whose definition carries no emit phase — **believed, not proven.** "Did an emit phase silently
   lose a file?" is emit-path reliability, a different phase. This baseline does **not** license the
   claim that no file was ever lost.

2. **Whether the region ever shows a file from a PRIOR run on the same thread — NOT OBSERVED HERE.**
   This is **D-01's** known blind spot (the read is thread-scoped; a run is only *near*-1:1 with a
   thread — 226 runs / 222 distinct threads). Both arms ran on threads carrying exactly one file, so
   the cross-run case never arose and was **not** exercised. ⚠ **Note the direction, because it is
   counter-intuitive:** were it observed, it would **strengthen D-02's relabel** (the region must be
   labelled as the run's *workspace*, not as "what this run produced") **rather than refuting SC#1** —
   RESEARCH's refutation table rules on exactly this row. It is a *labelling* consequence, not a
   *plumbing* one.

3. **SC#3 is UNEXERCISED — no run in the live DB has more than one deliverable.**
   All six file-producing `northwind-qbr` runs carry exactly one `.docx`; the only 20-file thread is an
   agent chat (`execute_code` PNGs), per D-01. So the many-files presentation is **untested by
   observation** at this baseline. ⚠ SC#3 additionally names a **retired** pattern and is corrected by
   this phase (**D-11**) — an unexercised criterion AND a stale one.

4. **The chat surface is carried by a FIXTURE, not by a live capture.**
   D-20's three-surface bar is discharged as **two live surfaces + one fixture** — a recorded
   DECISION with its reason (see arm 3), not an omission. Chat renders **no** file card for a workflow
   deliverable at all (`[data-testid="output-file-card"]` → `null` on the owning thread), by
   construction: a workflow emit returns `path`, and `RunCard` parses `output_files` out of
   `tool_calls` (**D-14**). Plan **195-02**'s `OutputFileCard.baseline.test.tsx` is the artifact that
   carries the chat row. **This baseline does not claim a live chat capture exists.**

5. **The Word VISUAL RENDER is inferred, not observed.**
   Proven by machine: the downloaded package is a structurally valid, CRC-clean OOXML `.docx`
   containing real filled report prose, and the operator invoked the system open handler on it. **Not
   reported back:** a visual confirmation that Word painted the page. So the correct reading is
   *bytes + package PROVEN, visual render INFERRED*. This record deliberately does **not** say
   "opened in Word: yes" (unobserved) and deliberately does **not** say "no" (false).

6. **No arm was blocked.** There are **zero ⛔ rows** in this baseline — stated as a measured fact, not
   implied by silence. Nothing is owed to plan 195-08 as an inherited undriven row from wave 1.

---

## Consumed by

Which later plan reads which figure from this file. A figure with no consumer is a figure nobody will
notice going stale.

| Figure recorded here | Consumer | What it is used for |
|---|---|---|
| **`BASE_SHA = f2eef045096efabdf7f05a1175271272b55617b9`** | **195-07** | P7(a)'s `git diff --numstat <base> HEAD -- MessageItem.tsx ExecuteCodeBody.tsx` assertion. ⚠ Plan 07 must name `f2eef045…` **explicitly**, never `HEAD~N` — a `numstat`-empty check **passes trivially when the base SHA is wrong** (7/7 worktrees forked from the wrong base in Phase 194, 8/8 in 194.1) |
| **The two md5s** — `MessageItem.tsx` `4a83da8b27f91e70ff3e18d2ce181242`, `ExecuteCodeBody.tsx` `386ed875acf6938f3fbcd0bac38777ab` | **195-07** | Corroborates the `git`-only byte-identity check with **content**, so D-13 ("chat gains no new file affordance") is proved two independent ways |
| **The five hot-file triples** (`WorkflowRunPage.tsx` 12/3/1101 · `OutputFileCard.tsx` 7/6/187 · `FilesSection.tsx` 6/3/277 · `fileIcon.tsx` 1/1/105 · `MessageItem.tsx` 57/29/856) | **195-08** | The same-commit ledger sync — `CLAUDE.md` rows ↔ `docs/HOT-FILE-LEDGER.md` sections. ⚠ Re-derive at close: `WorkflowRunPage.tsx` becomes the **4th** phase when 195 lands |
| **`tsc --noEmit -p tsconfig.app.json` = 33 errors** | **EVERY plan** | The non-regression floor. 34 is a regression; the figure is unmoved since 194.1 |
| **The count-gate verdict line** — `count gate OK — 75/75 pinned files present, no per-file decrease, 0 failing.` (total 3972 · failed 0 · pinned 3898) | **EVERY plan** | The non-regression floor. ⚠ Its contract is *no per-file DECREASE* + *zero failing*, **never a fixed grand total** — a bigger number is the gate WORKING |
| **The five in-scope suite counts** (102 / 11 / 11 / 11 / 15 = 150 tests, 0 failing) | **EVERY plan** | Four of the five are **ungated**; a green count gate says nothing about them. `StopControl.baseline.test.tsx` greps `WorkflowRunPage.tsx?raw` — assert it green after EVERY edit to that file (P9) |
| **The three-surface deltas + the theme-conditional token finding** | **195-03** | The one-icon-path decision is measured against this pre-change record. ⚠ The unification is a **no-op in dark** and a **contrast regression in light** — see the REFINED subsection |
| **The chat-renders-nothing measurement** | **195-02** | Why the chat row ships as a fixture fence rather than a live capture |
| **The mid-run-vs-terminal 35.7 ms measurement** | **195-08** | Recorded as a LOG, not a defect — RUN-02's bar is *"when the run finishes"*. Nothing is owed; the entry exists so a later reader does not re-open it as a bug |

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
