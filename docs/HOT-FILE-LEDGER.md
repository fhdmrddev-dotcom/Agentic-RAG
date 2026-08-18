# Hot-file ledger — detail

Companion to the **hot-file ledger** table in `CLAUDE.md` (`## Workflow guardrails` → G-5).
`CLAUDE.md` holds the **audit scan list**: every hot file, its measured triple, its verdict.
This file holds each row's **narrative** — the measured reasons, the corrections recorded beside
their originals, the RED-driven plants, the invariants each file now carries, and the named seam
the next refactor should take.

## How to use it

- **`CLAUDE.md` is the guardrail.** The discuss-phase audit scans PLAN.md `files_modified`
  against the table there. That table is complete on purpose — a hot file missing from it is
  permanently invisible to its own guardrail, which is the failure this ledger exists to record.
- **This file is the evidence.** Read the section for a file *before* editing it. It tells you what
  the last phase measured, what it deliberately did not do, and what binds you.
- ⚠ **SAME-COMMIT SYNC RULE** (the `docs/SANDBOX-PACKAGES.md` pattern): a row in `CLAUDE.md` and
  its section here are updated in the **same commit**. A row without a section, or a section without
  a row, is drift.
- ⚠ **Never overwrite a superseded figure or verdict — record the correction BESIDE it.** Every
  section below already does this, repeatedly, and that habit is the point rather than a quirk.

## Provenance of this file

Extracted verbatim from `CLAUDE.md` on **2026-08-17**, when that file had grown to 197k chars
against a 150k limit and the ledger table alone was ~157k of it. **Cell text below is byte-identical
to what it replaced, with one narrow exception:** `\|` was unescaped back to `|`. That escaping was
a markdown-table artifact, and leaving it in would have broken every re-derive command the ledger
asks you to run. No other character was changed, and nothing was summarised or dropped.

⚠ Four rows (`api/workflows.py`, `builderStore.ts`, `WorkspacePanel.tsx`, `WorkflowRunPage.tsx`)
contained **raw unescaped `|`** inside code spans — `UUID | None`, `bool | None`,
`isHarness || phases.length > 0`, `panel|chat|workflows`. Those cells were splitting into phantom
columns and had been rendering as broken tables. Prose has no columns, so the extraction fixes them.

**The triples in each section header were re-derived from git at extraction time.** They are not
copied forward from the prose — the prose figures are, by this ledger's own repeated finding,
routinely stale.

---

## `frontend/src/components/chat/ToolCallPanel.tsx`

**Re-derived 2026-08-17 (extraction):** `47 commits / 19 phases / 995 L` · quick-task buckets excluded: `260322`, `260328`, `260630` · **G-5 FIRES** (19 phases vs threshold 3) — extraction due — ⚠ row read `satisfied (075.7)` for ~19 phases.

> ⚠ **THIS ROW WAS FOUND STALE AT EXTRACTION AND THE CORRECTION IS RECORDED BESIDE THE ORIGINAL, NEVER OVER IT.**
> The verbatim cells below are the text as it stood in `CLAUDE.md`, and they are **wrong about this file's hotness**.
> Measured at extraction: **47 commits / 19 phases / 995 L**.
> This is the identical failure mode `StreamsProvider.tsx` documents about itself — a row that is present
> and WRONG answers the auditor and stops the audit, which is worse than an absent one.

### Phases touched (verbatim)

067 / 067.5 / 075 / 075.4 / 075.6 / 075.7 (6+)

### G-5 status (verbatim)

satisfied (075.7 — 2026-05-24)

---

## `frontend/src/components/chat/MessageItem.tsx`

**Re-derived 2026-08-17 (extraction):** `57 commits / 29 phases / 856 L` · quick-task buckets excluded: `260328`, `260405`, `260630` · **G-5 FIRES** (29 phases vs threshold 3) — extraction due — ⚠ row read `satisfied (075.7)` for ~29 phases.

> ⚠ **THIS ROW WAS FOUND STALE AT EXTRACTION AND THE CORRECTION IS RECORDED BESIDE THE ORIGINAL, NEVER OVER IT.**
> The verbatim cells below are the text as it stood in `CLAUDE.md`, and they are **wrong about this file's hotness**.
> Measured at extraction: **57 commits / 29 phases / 856 L**.
> This is the identical failure mode `StreamsProvider.tsx` documents about itself — a row that is present
> and WRONG answers the auditor and stops the audit, which is worse than an absent one.

### Phases touched (verbatim)

075 / 075.1 / 075.4 / 075.6 / 075.7 (5+)

### G-5 status (verbatim)

satisfied (075.7 — 2026-05-24)

---

## `backend/app/api/threads.py`

**Re-derived 2026-08-17 (extraction):** `233 commits / 76 phases / 1322 L` · quick-task buckets excluded: `260328`, `260405` · **G-5 FIRES** (76 phases vs threshold 3) — extraction due — **hottest file in the repo**; row read `9+`.

**⚠ UPDATED THE SAME DAY — THE OBLIGATION WAS DISCHARGED, and the new triple is recorded BESIDE the one above, never over it: `234 commits / 76 phases / 1273 L`.** The phase count is unmoved at 76 because the discharge commit is tagged `refactor(threads)` — a non-numeric bucket, deliberately, since this was **not a phase** and inventing one would corrupt every future count. See **"G-5 discharge"** below.

### ⚠ CORRECTION 2026-08-18 (Phase 196, plan `196-09`) — **"hottest file in the repo" is REFUTED BY MEASUREMENT.** The original claim is preserved above and in `CLAUDE.md`, never overwritten.

The header line above, and the matching sentence in `CLAUDE.md`'s staleness paragraph, both call this file
**"the hottest file in the repository"** at **76 phases**. That was the best available reading on 2026-08-17
and it was wrong for a structural reason rather than a careless one: **the comparison set was the ledger
table, and the actual hottest file has never been in it.**

Measured 2026-08-18 with CLAUDE.md's own recipe, on this worktree, both files in one batch pass:

| File | commits | phases | lines |
|---|---:|---:|---:|
| `backend/app/api/threads.py` | 234 | **76** | 1273 |
| **`frontend/src/lib/api.ts`** | **170** | **97** | **6154** |

**`frontend/src/lib/api.ts` is hotter by 21 phases and is 4.8× the size, and it had no row at all.**

⚠ **The 97 is robust to the recipe's known noise, and both accountings are published so the next reader
re-derives rather than trusts.** `api.ts`'s bucket list contains **sixteen** bare two-digit tokens
(`03 07 08 11 12 13 15 16 27 29 31 32 46 48 49 56`) which may be pre-zero-padding-era phases or subject-line
false positives. **Discarding all sixteen still leaves 81.** `threads.py` carries **twenty** such tokens,
leaving **56** on the same strict accounting. So `api.ts` is hotter on the generous count (97 vs 76) **and**
on the strict one (81 vs 56) — the verdict does not depend on which convention you pick, which is the only
reason it is stated as a refutation rather than as a second reading.

**The correction is recorded here and in `CLAUDE.md` in the same commit** (the same-commit sync rule), and
`api.ts` now has a row and a section of its own. **Nothing about this file's own discharge changes** — the
SSE-transport cut, its evidence and its load-bearing invariants all stand exactly as written below. What is
corrected is a **superlative**, and superlatives derived from an incomplete scan list are precisely what this
ledger exists to stop being believed.

> ⚠ **THIS ROW WAS FOUND STALE AT EXTRACTION AND THE CORRECTION IS RECORDED BESIDE THE ORIGINAL, NEVER OVER IT.**
> The verbatim cells below are the text as it stood in `CLAUDE.md`, and they are **wrong about this file's hotness**.
> Measured at extraction: **233 commits / 76 phases / 1322 L**.
> This is the identical failure mode `StreamsProvider.tsx` documents about itself — a row that is present
> and WRONG answers the auditor and stops the audit, which is worse than an absent one.

### Phases touched (verbatim)

056 / 058 / 061 / 067 / 073 / 075 / 075.3 / 075.4 / 075.6 (9+)

### G-5 status (verbatim)

G-5 fires — extraction due

### G-5 discharge — 2026-08-17 (the SSE-transport cut)

**The obligation above is DISCHARGED by an extraction, not by an argument.** ⚠ **And the verdict it replaces was wrong in a second way that the staleness marker alone does not capture: `extraction due` reads as *"nobody has ever cut this file"*, and that is FALSE.** Four extractions had already shipped — Phase 089 moved the agent loop to `agent_loop.py`, Phase 145 the run lifecycle to `run_lifecycle.py`, and Phase 162.5 moved the title subsystem, model resolution, workflow kickoff and the producer shell to four more modules. The file that once owned all of them owns none. *A stale verdict can mislead about the WORK as well as about the NUMBER.*

**WHAT MOVED:** `_BACKGROUND_TASKS`, `_spawn`, `RUN_TASKS`, `TERMINAL_TYPES`, `_RUN_STATUS_TO_TERMINAL_TYPE`, `_emit`, `_emit_terminal` → **`backend/app/services/run_transport.py`**, a true leaf importing only `asyncio`, `json` and `uuid`.

**THE MEASURED REASON — a test rather than an argument, and it is the strongest evidence on this ledger for any seam:**

- **FOUR of the seven symbols had ZERO uses in `threads.py` outside their own definitions.** `_spawn`, `_BACKGROUND_TASKS`, `TERMINAL_TYPES` and `_RUN_STATUS_TO_TERMINAL_TYPE` existed in an HTTP route module *solely* so other modules could import them. `_emit_terminal` appeared only in its own docstring. Of the rest, `_emit` had 2 real call sites and `RUN_TASKS` 2.
- **`RUN_TASKS` alone has ELEVEN production import sites across SEVEN modules** — `admin.py`, `evals.py` (×4), `runs.py` (×2), `main.py`, `run_lifecycle.py`, `run_producer.py` (×2) — **and most are LATE, function-local imports carrying explicit `avoid circular import` comments.** That is the smell: a leaf concern parked inside a module that pulls in half the service graph, so every consumer has to import it at call time to escape the cycle.

**PROVED, NOT ASSERTED — four independent checks:**

1. **The moved block is byte-identical.** A scripted diff of the 79 moved lines against `git show`'s pre-move text returns `YES`, and the move was driven by a script with **ten pre-move assertions** on the block's boundaries (`_BACKGROUND_TASKS` at 159, `_spawn` at 162, … `_emit_terminal` closing at 233) so a drifted line number aborts rather than silently cutting the wrong span.
2. **One object, not two.** All seven symbols satisfy `app.api.threads.X is app.services.run_transport.X`.
3. ⚠ **That identity check was DRIVEN RED against a real plant** — appending a duplicate `RUN_TASKS = {}` to `threads.py` flipped it to `False`. *An identity assertion that has never been shown to fail is not evidence*, and this one now has been.
4. **The full backend suite's failure set is byte-identical before and after** — not merely the same count. `211 failed / 3964 passed / 29 skipped / 5 xfailed / 9 xpassed / 1 error` both times, and a `comm` diff of the **212 sorted failing node IDs** shows **zero newly-failing and zero newly-passing**. ⚠ **The "zero newly-passing" half matters as much as the other:** a test that started passing would have meant the suite was not really exercising the moved code.

⚠ **THE HONEST CAVEAT ON THAT EVIDENCE, stated rather than smoothed: the backend baseline is RED, at 211 pre-existing failures.** This is a **characterization baseline** (the 188.1 discipline — it PREDATES the change), not a green gate. Spot-checked, the failures are environmental — `httpcore.ConnectError: [Errno 11001] getaddrinfo failed` — and they reproduce on an untouched tree; local Supabase/Redis were verified OPEN on 54322/54321/6379 first, so "infra is down" was excluded rather than assumed. **A green suite would be better evidence and we do not have one.**

**THE FIGURES** (named blank/comment/docstring/code classifier, validated against a hand-counted control before any number was trusted): `threads.py` total **1323 → 1274**, **CODE 701 → 680**; `run_transport.py` 117 total / 33 CODE. **Subtree 1323 → 1391 (+5.1 %)** — far smaller than this project's frontend cuts (188.2 +67 %, 192 +126 %, 193 +124 %) because one concern landed in ONE module; **prose is 60.7 % of the new file**, dominant again, for the sixth cut running.

**THE INVARIANTS THAT NOW BIND, and the first is a red line:**

1. ⚠ **THE RE-IMPORT IN `threads.py` IS LOAD-BEARING AND MUST NOT BE "TIDIED" AWAY.** Every consumer still says `from app.api.threads import RUN_TASKS` / `_emit` / `_emit_terminal` / `_spawn`, and the tests that `patch("app.api.threads.RUN_TASKS")` still intercept **because the late-importing consumers read the attribute off `app.api.threads` at CALL time**. A linter that removes the `# noqa: F401` re-export, or a plan that repoints one consumer at `run_transport` directly **without moving that consumer's patch sites in the same commit**, breaks the patch surface silently — the tests would keep passing while patching an object nothing reads.
2. **Consumers were deliberately NOT repointed.** Doing so is a legitimate follow-up, but it is a *different* change with a *different* risk profile, and bundling it would have destroyed the byte-identity evidence above.
3. **`run_transport.py` must stay a leaf.** The moment it imports anything from `app.`, the cycle it was created to dissolve comes back.

⚠ **WHAT IS NOT DISCHARGED — the obligation is REDUCED, not retired, and the next seam is NAMED rather than implied.** At 1273 lines / 680 code lines the file still hosts **five concerns**: thread CRUD (`list`/`create`/`rename`/`delete`), the message read + run-enrichment (`get_messages`, `_enrich_messages_with_runs`), `send_message`'s kickoff orchestration, and **the three pure-read reconcile endpoints**. **The named next seam is that third cluster** — `get_snapshot` (146 L), `get_thread_workflow` (263 L) and `list_active_runs` (66 L), ~475 lines that write NOTHING and share one concern (D-v2.5-03, *"Realtime is a hint, not truth"* — the surfaces the client re-fetches on reconnect). ⚠ **It was deliberately not taken here, for a measured reason: `patch("app.api.threads.get_pg_pool")` appears at 23 sites and `generate_thread_title` at 39**, so moving *routes* — as opposed to a leaf of unused symbols — changes which module those patches must target. **That is a planned refactor phase with its own baselines, not a chat-turn edit.** Per G-5 the next phase touching this file still owes a refactor recommendation as its FIRST option; **it inherits `234 / 76 / 1273`, and that figure goes stale on the next commit touching the file.**

---

## `frontend/src/providers/StreamsProvider.tsx`

**Re-derived 2026-08-17 (extraction):** `84 commits / 33 phases / 4119 L` · quick-task buckets excluded: `260529` · **G-5 FIRES** (33 phases vs threshold 3) — honoured by construction (194.1) — largest file in the frontend tree.

### Phases touched (verbatim)

⚠ **THIS CELL READ `068 / 075 / 075.4 / 075.6 / 075.7 (5+)` FOR TWENTY-EIGHT PHASES AND THAT ORIGINAL IS KEPT VERBATIM, BESIDE THE CORRECTION AND NEVER OVER IT.** **RE-DERIVED 2026-08-16 at `14283ba8` by plan `194.1-08`: 82 commits / 34 phases / 4035 lines.** The phase list the `5+` stood in for is `068 068.5 075 075.1 075.2 075.4 075.5 075.6 075.7 075.9 076.1 076.2 086 088 092 094 095 095.1 096 098 099 101.1 127 138 145 149 166 174 176 188 189 194 194.1` **plus the dated quick-task bucket `260529`**. ⚠ **THE RAW RECIPE PRINTS 37 BUCKETS AND THE NUMERIC FILTER PRINTS 34; NEITHER IS THE PHASE COUNT.** The three non-numeric are `chat`, `SEED`, `streaming`; the numeric 34 still contains `260529`, a dated QUICK TASK, **so the strictly-phases figure is 33 and the recipe's 34 is what the command prints.** Both are recorded, the loser beside the winner, exactly as `WorkflowBuilderPage.tsx` and `publish_service.py` already document about their own recipes; `194.1-BASELINE.md` §7 published the same subtraction one arc earlier (33 numeric / 32 strict). ⚠ **THE WAVE-1 READING IS ALSO PRESERVED RATHER THAN OVERWRITTEN: `77 / 33 / 3660` at `a9e7d10c` (BASELINE §7), which this phase's own five commits then staled** — a figure written at a phase's open goes stale on that phase's own work, which is the fourth distinct file on this ledger to demonstrate it. **This is the largest file in the frontend tree.** Re-derive with: `git log --oneline -- frontend/src/providers/StreamsProvider.tsx | wc -l` → 82; `git log --format=%s -- <f> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' | sort -u` → the 37 raw buckets; the same pipeline `| grep -E '^[0-9]+(\.[0-9]+)?$' | sort -u | wc -l` → 34; `wc -l <f>` → 4035; `git show a9e7d10c:<f> | wc -l` → 3660.

### G-5 status (verbatim)

⚠ **THE PREVIOUS VERDICT IN THIS CELL WAS `satisfied (075.7 — 2026-05-24)` AND IT IS KEPT VERBATIM BECAUSE THE POINT OF THIS ROW IS THAT IT WAS WRONG. G-5 FIRES HARDEST OF ANY FRONTEND FILE — 34 phases against a threshold of 3 — and it had been reading `satisfied` since Phase 075.7, twenty-eight phases earlier.** ⚠ **A ROW THAT IS PRESENT AND WRONG IS A WORSE FAILURE THAN AN ABSENT ONE, and that sentence is the reason this correction exists and must survive future edits:** the discuss-phase audit scans PLAN.md `files_modified` against this table, so an auditor who reaches this row reads *"the guardrail was honoured 28 phases ago"* **and stops looking**. An absent row at least produces a re-derivation (that is how `WorkflowsPage.tsx`, `WorkflowDoorSwitch.tsx`, `WorkflowBuilderPage.tsx` and `db/workflows.py` were eventually caught, after ten, six, ten and seventeen invisible phases). ⚠ **`194.1-SPEC.md`'s own G-5 constraint listed four files and MISSED THIS ONE ENTIRELY** — the phase touches it twice (R5, R6) — and it was `194.1-CONTEXT.md` **D-01** that found it by re-deriving instead of reading. **Honoured BY CONSTRUCTION, no override; `.planning/STATE.md` records `Phase 194.1 — NONE` with the offer-and-decline stated, so that absence is a MEASUREMENT (verified at this commit, `grep -n "Guardrail overrides" .planning/STATE.md` → the section at `:1729`).** **The measured reason, a test rather than an argument:** the file **already owned** both edit sites — `sendMessage`'s optimistic assistant insert (R5's gate) and `stopThread`'s run-id resolution (R6's fix) — and the new stopping slice sits **beside** the shipped `streamingThreads` slice, which is *the same concern (per-thread run liveness) in a second state*. The figures that would have moved had it gained a second concern: **`useState[(<]` 0 → 0** and **`useEffect(` 8 → 9**, the single increment being task 2's `useStreamsStore.subscribe` on the `streamingThreads` slice — **declared as the one allowed increment rather than left to read as drift** (`194.1-03-SUMMARY.md`). **The invariants that now bind this file, and the first is a red line rather than a preference:** (1) ⚠ **THE TERMINAL READING MAY NEVER BE SUPPRESSED BECAUSE A THREAD HAD BEEN STOPPING.** At the shipped `WORKER_COUNT=2` roughly half of stops still land on `✓ Complete` (the L-01 boundary — Phase 194 SC#2, FAILED; `finish_run` carries no terminal guard, `db/workflows.py:1458-1463`), so the honest surface shows `⊘ Stopping this run…` **and then** the terminal. A well-meaning plan that hides it is caught by plan 03's **P4**, a two-armed fence whose SOURCE arm had to be widened from one line to an **eight-line window** because the one-line form stayed GREEN under the very plant it was written for. (2) **The clear is keyed on the `streamingThreads` SLICE TRANSITION, not on `onTerminal`** — P3 measured that `onTerminal` misses **two of the four** delete routes, including the reconcile-derive route. (3) **No timer handle lives in the store** — three pure-data Sets, the handle in a provider ref; ⚠ the raw `grep -c "setTimeout|setInterval"` on `streamsStore.ts` is **1**, and the single hit is **the comment stating the rule**, so the fence strips comments, asserts 0 in CODE **and asserts the prose mention is PRESENT** so the strip can never cover for a real absence — *a later editor who tidies that comment breaks a real needle silently.* (4) **The false-cause line `press Stop again in a moment` is retired from production in BOTH resolvers** (it existed **twice**, `:2394` in `stopStream` and `:2457` in `stopThread` — BASELINE §5; the SPEC's single-resolver `grep == 0` acceptance was unsatisfiable as written, CONTEXT **D-22**); the sweep now reads **zero production hits**, and the three test files that still name it do so **to assert its absence**. ⚠ **TWO BEHAVIOUR CHANGES THAT MUST NOT BE READ AS DETAILS: on a HARNESS run there is now NO assistant bubble at kickoff at all**, so the composer Stop resolves a **`workflow_runs.id` from the thread frame** rather than the producer `runs.run_id` from the chat bucket — safe **only because `194-11` shipped the dual-id fallback on `DELETE /runs/{id}`**, whose clause (c) requires the anchor to still point at the run (true for exactly the live runs it serves). **Deep is unaffected BY CONSTRUCTION**, not by care: the gate keys on `workflowDefinitionId`, which a Deep send never sets — 174 D-14's byte-identity was re-proved against the real change, not merely against a plant. **And the kickoff gate MUST keep inserting a notice-bearing node on the 403 kill-switch and the network-failure arms** (**D-23**): both wrote onto the deleted placeholder *by id*, so removing it silently turned each `map` into a no-op and both honesty readings vanished — measured at BASELINE §8 by planting the gate before writing it, and fenced by **P10**, which was observed RED **naturally** (commit `5a365420` IS the plant). ⚠ **A hide-it-with-CSS implementation passes every honesty fence and fails only the node COUNT** (P8) — which is why R5's acceptance counts nodes rather than measuring visibility. **Per G-5 the next phase adding a genuinely second concern here owes a refactor recommendation FIRST; the natural seam is named rather than implied — the per-surface message buckets, the SSE subscription lifecycle, the mount/derive reconcile, `sendMessage`'s kickoff path and the run-liveness slices are five concerns in one 4035-line provider. It inherits `82 / 34 / 4035`, and that figure goes stale on the next commit touching the file.**

---

## `frontend/src/hooks/useMessages.ts`

**Re-derived 2026-08-17 (extraction):** `74 commits / 27 phases / 127 L` · quick-task buckets excluded: `260405` · **G-5 FIRES** (27 phases vs threshold 3) — extraction due — ⚠ row read `satisfied (075.7)` for ~27 phases.

> ⚠ **THIS ROW WAS FOUND STALE AT EXTRACTION AND THE CORRECTION IS RECORDED BESIDE THE ORIGINAL, NEVER OVER IT.**
> The verbatim cells below are the text as it stood in `CLAUDE.md`, and they are **wrong about this file's hotness**.
> Measured at extraction: **74 commits / 27 phases / 127 L**.
> This is the identical failure mode `StreamsProvider.tsx` documents about itself — a row that is present
> and WRONG answers the auditor and stops the audit, which is worse than an absent one.

### Phases touched (verbatim)

063 / 063.1 / 067 / 067.5 / 075.7 (5+)

### G-5 status (verbatim)

satisfied (075.7 — 2026-05-24)

---

## `backend/app/services/anthropic_service.py`

**Re-derived 2026-08-17 (extraction):** `11 commits / 10 phases / 354 L` · **G-5 FIRES** (10 phases vs threshold 3) — adapter-pattern audit due — row read `4+`.

> ⚠ **THIS ROW WAS FOUND STALE AT EXTRACTION AND THE CORRECTION IS RECORDED BESIDE THE ORIGINAL, NEVER OVER IT.**
> The verbatim cells below are the text as it stood in `CLAUDE.md`, and they are **wrong about this file's hotness**.
> Measured at extraction: **11 commits / 10 phases / 354 L**.
> This is the identical failure mode `StreamsProvider.tsx` documents about itself — a row that is present
> and WRONG answers the auditor and stops the audit, which is worse than an absent one.

### Phases touched (verbatim)

074 / 075 / 075.4 / 075.6 (4+)

### G-5 status (verbatim)

G-5 fires — adapter pattern audit due

---

## `frontend/src/components/workflows/WorkflowCanvas.tsx`

**Re-derived 2026-08-17 (extraction):** `23 commits / 6 phases / 1301 L` · **G-5 FIRES** (6 phases vs threshold 3) — satisfied (188.1).

### Phases touched (verbatim)

183 (183-06, 183-08, 183-09) / 184 (184-10, 184-12, 184-13) / 185 (185-01, 185-08, 185-10) / 187 (187-08, 187-27) / 188 (188-07) / 188.1 (188.1-03) — **13 plans across 6 phases**, **1593 → 1292 lines**, still the largest workflow file. ⚠ Both figures in this cell were previously wrong and are corrected on measurement (2026-08-06, `git log -- <file>` + `wc -l`): the touch list read *9 plans across 3 phases* and silently omitted **Phase 187 as well as** 188 / 188.1, and the line count read **1574**, which was already stale before this phase opened — the measured pre-move figure is 1593.

### G-5 status (verbatim)

**satisfied (188.1 — 2026-08-06).** `185-10` named the seam and 188.1 executed it: `PlaneEditingLayer` now lives in `PlaneEditingLayer.tsx` (268 L) and the exported `EDIT_AFFORDANCE` geometry table in `editAffordance.ts` (164 L), as a verbatim move measured at 22 insertions / 323 deletions with Plan 02's captured `AFFORDANCE_SHAPE_BASELINE` still deep-equal, `tsc` unmoved at 33 and `eslint src/components/workflows/` 6 → 5. The live ESM-cycle constraint `185-10` discovered — `WorkflowCanvas` imports `FlowEdge`'s VALUE at module scope for the `edgeTypes` map, so the extracted module must not import back — was **proved, not retired**: it is now enforced by a `?raw` cycle fence in `WorkflowCanvas.test.tsx` with inline positive controls, observed RED against a deliberate back-import, rather than by this prose. Note the file is still the largest in the tree at 1292 L; D5 (extracting the header / notice / bottom regions too) is deferred with its own trigger in `188.1-DEFERRED.md`.

---

## `frontend/src/components/workflows/PhaseNodeCard.tsx`

**Re-derived 2026-08-17 (extraction):** `11 commits / 6 phases / 280 L` · **G-5 FIRES** (6 phases vs threshold 3) — satisfied (188.2).

### Phases touched (verbatim)

184 (184-03, 184-08) / 185 (185-01 the 137-B rebuild, 185-08 docblocks, 185-09 the corner seal) / 188 (188-06 the run-reading arc, +301/−29) / 188.1 (188.1-04 the WR-04 own-guards, +47/−5) / **188.2 (188.2-06 THE CUT, 16 insertions / 499 deletions)** — **8 plans across 5 phases**, **797 → 274 lines**. ⚠ Two corrections on measurement (2026-08-07, `git log --oneline -- <file>` + `wc -l`): the cell read *7 plans across 4 phases, 797 lines* and did not yet name 188.2; and `git log` reports **10 commits** against those 8 plans, because 188-06 and 188.2-06 each landed twice. Both figures are defensible — the PLAN count is what this cell quotes, and the commit count is how it was derived, exactly as the `WorkflowCanvas.tsx` row above corrects itself on measurement.

### G-5 status (verbatim)

**satisfied (188.2 — 2026-08-07).** The debt named at the 188.1-05 checkpoint was paid by a dedicated refactor phase, and it is recorded here with re-derivable figures rather than an assertion. **All three D-03 numbers, before → after: total `797 → 274` (−65.6 %) · CODE `249 → 100` · BODY (separator → EOF) `427 → 169`.** They come from a named line classifier (blank / comment / code, counting `{/* … */}` JSX comment blocks as comment) which was VALIDATED against the pre-cut file's known `797/518/249/30` before any after-number was trusted — re-run independently in `188.2-07` and reproduced exactly. Re-derive with: `git log --oneline -- <file>`; `wc -l <file>`; `grep -n "── The card ──" <file>` → **106**, so the body is lines 106–274; and the classifier over `git show 95a4c915:<file>` for the before column. **Where the code went — five sibling modules:** `phaseNodeCardContract.ts` (214 L, the six slot-contract types, zero runtime exports), `ownProperty.ts` (86 L, the WR-04 `own<T>()` guard, zero imports), `NodeCornerMarks.tsx` (272 L, the verdict mark + the ⛨ governance seal), `NodeRunOverlay.tsx` (319 L, the status ring + arc + pause chip) and `NodeIconWell.tsx` (167 L, the 3D mark). **⚠ The SUBTREE GREW: 797 → 1332 L, +67.1 % — roughly EIGHT times 188.1's +8 %, and it is stated rather than smoothed** (five new files carry their own headers, imports, props types and wrappers, out of a 797-line file whose prose was already 65 % of it). The card's own docblock carries the same measured figure so the sum cannot later read as a regression. **PROVED, not asserted:** the rendered DOM is byte-identical to the tree as it shipped — three whole-`innerHTML` baselines and three geometry matrices captured on the UNMOVED tree (all five destination modules answered *No such file or directory* at the capture commit) held green with **ZERO re-capture**; all seventeen negative source fences were re-scoped to the six-file subtree BEFORE one line moved, and three of them (`onClick=`, the graph-package scope, `dangerouslySetInnerHTML=`) were driven RED against real plants inside real destination files. The three invariants still bind, and one is now stronger than this cell used to imply: **a third badge is a typecheck error** — asserted NOWHERE before 188.2-01, now mechanically guarded by an `@ts-expect-error` control observed RED at 34 type errors and back at 33; **no focusable control may live inside the card** (the ✕ and ＋ live on the lane), whose leaf walk was driven RED against a planted `<button>` in `NodeCornerMarks.tsx`; and **badge slot 1 is still EMPTY and reserved for 189** (D-12). Deferred with its own trigger in `188.2-DEFERRED.md`: four inline `hasOwnProperty` guards left unconsolidated, and the card's remaining 161 comment lines.

---

## `backend/app/services/harness/phase_types.py`

**Re-derived 2026-08-17 (extraction):** `38 commits / 15 phases / 2393 L` · **G-5 FIRES** (15 phases vs threshold 3) — extraction due — not taken in 190 (no 2nd concern).

### Phases touched (verbatim)

091 (091-03, 091-05, 091-08) / 092 (092-07 ×4) / 093 (093-05, 093-09) / 096 (×2) / 098 (098-03) / 099 (099-02 ×2) / 101 (101-05, 101-06) / 101.1 (101.1-03 ×2, -04, -06 ×4, -07) / 102 (102-04, 102-08) / 104 (104-03) / 120 (120-02) / 141 (141-02) / 185 (185-12) / 189 (189-09 the 7th executor, plus the WR-02 fix) — **35 commits across 14 phases** (+1 untagged `fix(ask_user)`), **1918 lines**. ⚠ **Added 2026-08-08 (plan `190-04`) with a correction to the figure that put it here:** `190-RESEARCH.md` § "G-5 hot-file ledger check" said 190 makes *"roughly its 6th substantive touch on `_exec_external_action`'s neighbourhood"*. Measured, that is FALSE in both directions and neither half was inherited — `git log --oneline -G"external_action" -- <file>` returns exactly **2** commits (`b09bb361` created the executor at 189-09; `8aa32de0` was 189's WR-02 fix), so 190 is the **3rd** touch on that neighbourhood and only its **2nd phase**; while the FILE itself is far hotter than the research implied at **35 commits / 14 phases**. Re-derive with: `git log --oneline -- backend/app/services/harness/phase_types.py | wc -l` → 35; `wc -l` → 1918; `git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)-]+).*/\1/' | sort -u` for the phase list; and `-G"external_action"` for the neighbourhood count.

### G-5 status (verbatim)

**G-5 FIRES ON THE COUNT — extraction due, and deliberately NOT taken in 190.** 14 phases is far past the ≥3 threshold, so the row states the fire rather than explaining it away. It is not honoured in 190 for a measured reason: 190's whole change to this file is **one function** — D-16's `ctx.is_golden_run` send gate plus a delegation to the connector registry — so it adds a call-out, not a concern. The five-plus concerns that make the file big (the emit path, the fill/render path, the ask_user path, the tool-context builders, the seven executors) are inherited from 091-102 and are untouched here. **The row exists so the NEXT phase inherits a measured count instead of re-deriving it — and per G-5, a phase that adds a SECOND concern to this file produces a refactor recommendation first.** The natural seam, named but not taken: one module per executor under `harness/phase_types/`, the same shape the 188.2 card cut used.

### Phase 196 (plan `196-03`) — re-derived, and honoured by construction for the second consecutive phase

**RE-DERIVED 2026-08-18 by plan `196-09`: `39 commits / 16 phases / 2424 L`** (was `38 / 15 / 2393` at the
2026-08-17 extraction; six-digit dated quick-task buckets: **checked, none exist** on this file). ⚠ **Stale by
one phase and 31 lines within a single day** — this ledger's most repeated finding, reproducing again.

**What 196 did:** added **one** async helper, `_effective_model_checked`, which calls the shipped
`_effective_model`, reads the org default off `ctx.user_settings.llm_model` and awaits Phase 149's
`_resolve_enabled_model` through a **function-local** import. Every other edit is a call-site repoint.
`_effective_model` itself is byte-unchanged, still sync and still exported — pinned by its own case.

**Why G-5 is honoured rather than triggered:** the ledger's own test for this file is *does the change add a
genuinely SECOND concern?* The five-plus concerns that make the file big (the emit path, the fill/render path,
the ask_user path, the tool-context builders, the seven executors) are untouched. One function plus call-site
edits is **a call-out, not a concern** — verbatim the test 190's clearance was recorded on. **The named seam,
one module per executor under `harness/phase_types/`, still stands and was not taken.**

**What now binds this file, and one of them is a signature widening the next editor will meet:**

1. ⚠ **`_build_phase_tool_context` is no longer `(phase, ctx)`** — it takes an optional keyword,
   `(phase, ctx, *, model=None)`. **This was a measured correction to `196-03`'s plan, which asserted all five
   call sites sat inside `async def`. `:455` does not** — it is a **sync** function called synchronously by
   **fifteen shipped test sites across seven files**, so making it async was never a one-word edit. It also
   could not be skipped: `run_task_sub_agent` reads `parent_ctx.model`, **not** the executor's local `model`,
   so `:455` is the site that actually decides which model an `llm_agent` / `llm_batch_agents` phase runs on.
   ⚠ **A stub lambda of the form `lambda phase, ctx: …` now raises `TypeError`** — two in
   `test_185_detection.py` did, and were widened to `lambda phase, ctx, **_: …`.
2. **The disabled-model substitution FAILS OPEN, deliberately** — a registry-read blip lets a disabled model
   run rather than sinking the phase, because an infrastructure hiccup must not look like an authoring error.
   Recorded in the helper's own docstring, not only here.
3. **An ENABLED model is a strict no-op** — same value, no sub-step, no audit row. Asserted with
   `assert not carriers.substeps` / `assert not carriers.audits`, the `test_149_default_guard.py:86`
   `assert not pool.calls` shape transposed onto both carriers.
4. **No 25th `harness_audit` kind was added and no migration ships.** `_AUDIT_EVENT_TYPES` is byte-unchanged;
   the substitution reuses `policy_applied`, which already means exactly this event.

⚠ **The plan's own line budget was MISSED and is recorded as a miss rather than reinterpreted:** *"fewer than
40 changed lines"* against **39 insertions / 47 total**. The budget was computed against a site inventory that
turned out to be wrong (invariant 1 above); the SHAPE criterion G-5 actually cares about is met.

---

## `frontend/src/pages/WorkflowsPage.tsx`

**Re-derived 2026-08-17 (extraction):** `34 commits / 12 phases / 1176 L` · **G-5 FIRES** (12 phases vs threshold 3) — satisfied (192 / 192.1).

### Phases touched (verbatim)

103 / 124 / 143 / 152 / 155 / 165 / 184 / 184.1 / 186 / 188 / **192 (192-06, 192-08, 192-10 — 5 commits; + CR-01 `60b8842f`; + GAP-CLOSURE ROUND 1: 192-14 ×2, 192-15 ×1)** / **192.1 (192.1-03 `790ce24d` THE FORK CUT, 192.1-06 `38cb3cab`, 192.1-07 `d5b788f6` — 3 commits)** — **33 commits across 12 phases**, **1407 → 1160 lines**. ⚠ **CORRECTED ON MEASUREMENT AGAIN (2026-08-13, plan `192.1-08`) — the THIRD consecutive time this cell has gone stale, and the third time it says so instead of being quietly overwritten.** The cell read *30 commits across 11 phases · 1407 → 1180*; measured at 192.1's close it is **33**, **12** and **1160**. ⚠ **And the single line count hides the shape of the move, so the arc is published beside it: `1180 → 1054` at the D-01 fork cut (**−126**), then `→ 1113` (192.1-06's identity memo + hoisted clock) and `→ 1160` (192.1-07's dialog mount) — a NET of only **−20** across a phase whose headline act was an extraction.** An extraction that removes 126 lines and a phase that adds 106 back are two different facts and neither may be quoted as the other. Re-derive with: `git log --oneline -- frontend/src/pages/WorkflowsPage.tsx | wc -l` → 33; `wc -l` → 1160; `git show 8fc9bd74:<file> | wc -l` → 1180 (192.1's base); `git show 790ce24d:<file> | wc -l` → 1054; `git show 6bdc4684:<file> | wc -l` → 1407. ⚠ **BOTH FIGURES IN THIS CELL WERE STALE AND ARE CORRECTED ON MEASUREMENT (2026-08-12, plan `192-16`), which is the habit the two rows above this one already keep.** The cell read *26 commits · 1407 → 1007*; measured, it is **30** and **1180**. The line count was stale in TWO independent ways, and the second one is the interesting one: (a) gap-closure round 1 added 153 lines (`1027 → 1180`), but (b) the cell's `1007` was **already wrong before this round opened** — `git show 60b8842f:<file> | wc -l` → **1027**, because the CR-01 honesty fix landed on the file AFTER 192-12 wrote this row. A figure written at a phase's close goes stale on that phase's own fix commit. Re-derive with: `git log --oneline -- frontend/src/pages/WorkflowsPage.tsx | wc -l` → 30; `wc -l` → 1180; `git show 6bdc4684:<file> | wc -l` → 1407; `git show 60b8842f:<file> | wc -l` → 1027. The PHASE list is unchanged at 11 — round 1 is Phase 192's own re-open, not a twelfth phase. ⚠ **Added 2026-08-10 during `/gsd:sketch 192`, and the reason it was added matters more than the number: this file was NEVER on the ledger.** Ten phases touched it and not one produced the refactor recommendation G-5 requires, because the audit step scans PLAN.md `files_modified` *against this table* — a hot file absent from the table is invisible to its own guardrail, permanently. Re-derive with: `git log --oneline -- frontend/src/pages/WorkflowsPage.tsx | wc -l` → 26; `wc -l` → 1007; `git show 6bdc4684:<file> | wc -l` → 1407 (`6bdc4684` is the last pre-192 commit on the file); `git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' | sort -u` for the phase list.

### G-5 status (verbatim)

**satisfied (192 — 2026-08-11).** The recommendation this row demanded was produced and TAKEN: Phase 192 cut the library view out into `components/workflows/library/` across three plans, and the figures are re-derivable rather than asserted. **PAGE `1407 → 1007` (−28.4 %) · CODE `1021 → 479` (−53.1 %).** They come from a named line classifier (blank / comment / code, JSX comment blocks counted as comment) VALIDATED against 188.2's own published known-good — the pre-cut `PhaseNodeCard.tsx` at `95a4c915`, `797/518/249/30` — which it reproduced exactly before any 192 number was trusted. **Where the code went — seven sibling modules** (`RunModal.tsx` 430 L and `WorkflowDeleteSheet.tsx` 296 L moved VERBATIM, their characterization baselines held with zero re-capture; `WorkflowCard.tsx` 545 L is a REWRITE replacing three card components, not a move; plus `LibraryToolbar.tsx` 358, `libraryFilter.ts` 284, `libraryVocabulary.ts` 162, `libraryRow.ts` 100). **⚠ THE SUBTREE GREW: `1407 → 3182 L, +126.2 %` — roughly EIGHT TIMES RESEARCH's own +5 %…+16 % estimate (assumption A2), and nearly DOUBLE 188.2's +67.1 %. It is stated rather than smoothed, and A2's two misses are named: it predicted the page at 250–400 L (measured 1007, a 2.5–4× miss) and it listed five destination modules where seven shipped.** The dominant term is prose, not logic — COMMENT `334 → 1523` (+355.9 %), 48 % of the new module lines, while CODE grew only +46.8 %. `WorkflowCard.tsx`'s own docblock carries the identical figure so the sum cannot later read as a regression. **PROVED, not asserted:** all five negative fences plus the `threadGroups` byte-identity fence were driven RED against real plants in production source and every file restored md5-identical (`192-12`); F4's plant was additionally shown to typecheck at the 33 baseline and lint at 0, which is the whole reason that fence exists. **The constraints that now bind:** nothing under `library/` may name a `WorkflowsPage` specifier in any import form (F4, driven RED in the bare, `.tsx`-suffixed and dynamic `import()` shapes); the page imports each library module, declares none of the six moved symbols and leaves NO re-export shim (the `OD` block, all three clauses driven RED); no `title=` attribute anywhere in the subtree (F1 — `WorkflowSoul.tsx:99` and `PhaseSpine.tsx:77` carry the two INHERITED ones and are consumed unchanged, out of scope by D-01); and no user-visible string may overstate the search (F5, swept over the subtree, not one module). **⚠ THE FILE IS NOT FINISHED, and the remaining stack is named rather than implied:** at **1180 L** (was written here as 1007; corrected on measurement — see the touch-list cell) it still hosts the Builder, the publish-gauntlet mount, the `WorkflowDoorSwitch`, the post-publish Run CTA banner, the two fork/create handlers with their slug/version mechanics, and the three-feed fetch orchestration. Per G-5, a phase that adds a SECOND concern here produces a refactor recommendation first. **⚠ GAP-CLOSURE ROUND 1 (2026-08-12) — THE ROW STAYS *SATISFIED*, and the reason is measured rather than argued.** Round 1 added **no second concern**: every line it wrote lands inside the two fork handlers and the page-level failure-notice region *this cell already names as remaining* — `onTweak` gains an open-the-existing-draft branch that reuses the shipped `onOpenDraft` seam (so 186-07's concurrency token is threaded by construction, not by discipline), plus one `forkFailed` state, one module-scope `isForkConflict` beside the existing `freshHash`, and ONE `<p role="status">` in the region that already hosts `failedSources`. **No toast library was acquired** — verified absent (zero `sonner` imports, no `ui/toast`) rather than assumed, and a gap round is the wrong place to add a dependency. The growth is `1027 → 1180` (**+153 L**), and it is stated rather than smoothed: the dominant term is prose again, exactly as the subtree figure above found. **The G-5 obligation is UNCHANGED and inherited forward: the next phase that adds a genuinely SECOND concern here still owes a refactor recommendation FIRST**, and the natural next seam is named — the two fork/create handlers with their slug/version mechanics are now the largest self-contained concern left on the page, and WR-08 (the 409 classification keying on error prose) is the trigger that will force someone into them. **⚠ PHASE 192.1 (2026-08-13) — THE SEAM THE CELL ABOVE NAMED WAS TAKEN, and the row stays *satisfied* on a measurement rather than on a claim.** The previous paragraph ended by naming *"the two fork/create handlers with their slug/version mechanics"* as the next seam; **`192.1-03` cut exactly that concern out** into `library/libraryFork.ts` (64 L — `freshHash` + `isForkConflict`) and `library/useWorkflowFork.ts` (517 L — both handlers, their two `LibraryRow → wire` adapters per D-29, the failure notice state and the two-step name prompt). G-5 was honoured in the order D-01 requires: **the extraction shipped in Wave 3, BEFORE the feature it made room for** (the 14th identity atom, Wave 6). **The measured figures, all four with their commands: PAGE `1407 → 1160` (−17.6 %) · CODE `1021 → 462` (−54.8 %) · SUBTREE (page + TWELVE modules) `1407 → 5297` (+276.5 %) · CODE `1021 → 2095` (+105.2 %).** Same named line classifier (blank / comment / code, JSX comment blocks counted as comment), **re-VALIDATED against 188.2's published known-good — `git show 95a4c915:frontend/src/components/workflows/PhaseNodeCard.tsx | node classify.cjs` → `797 / 518 / 249 / 30`, reproduced exactly — before a single 192.1 number was trusted.** ⚠ **THE SUBTREE-GROWTH FIGURE OWES SIX NUMBERS, NOT FOUR, and all six are published so none can be quoted as another.** 192.1's own delta has TWO defensible "before" readings and both are true: against the **phase base** `8fc9bd74` it is `3438 → 5297` (**+54.1 %**, CODE `1547 → 2095`, +35.4 %); against the **honest pre-CUT base** — `192.1-01` had already added `updated_at` to `libraryFilter.ts` (284 → 294) and `libraryRow.ts` (100 → 121), **+31 L**, so `192.1-BASELINE.md` §8b's `3438` was already stale at Wave 3's own base — it is `3469 → 5297` (**+52.7 %**, CODE `1550 → 2095`, +35.2 %). *A figure written at a phase's close goes stale on the next commit that touches any file it counted* — this cell has now demonstrated that three times about itself and once about its own baseline artifact. **Where the growth went — five NEW sibling modules** (`useWorkflowFork.ts` 517, `rowIdentity.ts` 509 the O(n) identity index + four-state lineage + D-31 ranker, `ForkNameDialog.tsx` 279, `relativeChanged.ts` 109 the nine bands, `libraryFork.ts` 64 = **1478 L**) **plus growth on three shipped ones** (`libraryVocabulary.ts` 223 → 439 +216, `WorkflowCard.tsx` 567 → 721 +154, `libraryRow.ts`/`libraryFilter.ts` +31) **minus the page's −20**. The nine per-file deltas sum to **exactly +1859**, which is the whole subtree delta — no unattributed residual. **The dominant term is PROSE again, for the third cut running: COMMENT `1725 → 2938` (+1213 L, 65.2 % of the growth) against CODE +548 (29.5 %) and BLANK +98.** `WorkflowCard.tsx`'s own docblock carries the identical figures so the sum cannot later read as a regression. **⚠ THE FILE IS STILL NOT FINISHED, and the remaining stack is re-named rather than inherited:** at **1160 L** it hosts the Builder, the publish-gauntlet mount, the `WorkflowDoorSwitch`, the post-publish Run CTA banner, the three-feed `allSettled` fetch orchestration, the `onOpenDraft` navigation, and now the identity `useMemo` + hoisted clock. The fork concern is **gone**. Per G-5, a phase that adds a genuinely SECOND concern here still owes a refactor recommendation FIRST; the natural next seam is the three-feed fetch orchestration with its `source-failed` partial-merge handling. **⚠ RE-DERIVED AT PHASE 193.2's CLOSE (2026-08-15) — `33 / 12 / 1160` IS STALE AND THE CORRECTED TRIPLE IS `34 commits / 12 phases / 1176 L`. THIS IS THIS CELL'S FOURTH CONSECUTIVE STALING, and the number is recorded BESIDE the previous value rather than over it, which is the fourth time this row has had to say that about itself.** ⚠ **The interesting half is that Phase 193.2 did NOT touch this file at all** — `git diff --name-only c1a6c122 HEAD` names only `WorkflowsPage.test.tsx`, and `git log --oneline c1a6c122 -- <file> | wc -l` already read **34** at the phase's base. **So the staleness is INHERITED, not this phase's**: the `33 / 1160` was already wrong when Phase 192.1 wrote it, in exactly the self-staling way the row's own third correction describes. `193.2-CONTEXT.md` D-01 and `193.2-BASELINE.md` §5 both measured `34 / 12 / 1176` at the phase's open and the figure has not moved since. The PHASE list is unchanged at 12. Re-derive with: `git log --oneline -- frontend/src/pages/WorkflowsPage.tsx | wc -l` → 34; `wc -l <file>` → 1176. **The G-5 obligation is UNCHANGED and inherited forward** — the file gained no concern this phase, and the next phase adding a genuinely second one still owes a refactor recommendation FIRST. It inherits `34 / 12 / 1176`. ⚠ **One invariant this phase ADDED without editing the file, and it binds anyone who edits it next:** `WorkflowsPage.tsx` is now inside the D-17 no-client-sort fence — `libraryFilter.test.ts` sweeps its stripped source and **fails any `rows.sort(` / `visibleRows.sort(` / `family.sort(` / `list.sort(`**, and any `sortOrder` / `sortBy` / `setSortOrder` / `orderBy` identifier (D-18). Both arms were **driven RED against real plants in production source, separately** — before 193.2 this module had **no sort coverage of any kind anywhere in the repository**, and the server `ORDER BY` is only sufficient while that stays true. The post-publish Run CTA on this page also received **its first automated coverage ever** (`run-cta` occurrences in its suite: **0 → 13**), with presence and absence shown to fire independently.

---

## `frontend/src/components/workflows/library/WorkflowCard.tsx`

**Re-derived 2026-08-17 (extraction):** `8 commits / 3 phases / 818 L` · **G-5 FIRES** (3 phases vs threshold 3) — ⚠ obligation UNDISCHARGED — next phase touching it owes a refactor rec FIRST.

### Phases touched (verbatim)

**192 (192-09 `a6183388` + `5f3ab7bd`, 192-12 `4ca5acf6`, 192-13 `efbd57e3`)** / **192.1 (192.1-06 `59c7a698` the 14th atom, 192.1-07 `b351627e` the D-15 amendment)** — **6 commits across 2 phases**, **567 → 721 lines** (545 at its 192-12 birth reading). ⚠ **Added 2026-08-13 by plan `192.1-08` under D-02, and the reason it is here is the whole point of the row: G-5 does NOT fire on this file, and it goes on the ledger anyway.** The standing lesson from Phase 192 is that *a guardrail cannot see what is absent from its list* — the audit step scans PLAN.md `files_modified` **against this table**, so `WorkflowsPage.tsx` escaped G-5 for ten consecutive phases purely by not being written down. A young file put on the ledger now inherits a measured count instead of forcing a re-derivation in 194. Re-derive with: `git log --oneline -- frontend/src/components/workflows/library/WorkflowCard.tsx | wc -l` → 6; `git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' | sort -u` → `192 192.1`; `wc -l` → 721; `git show 8fc9bd74:<file> | wc -l` → 567. ⚠ **CORRECTED ON MEASUREMENT (2026-08-13, plan `193-10`) — one day after the cell above was written, and the correction is stated BESIDE the previous value rather than replacing it, which is this table's habit.** The cell read *6 commits across 2 phases · 567 → 721*; measured at Phase 193's close it is **8 commits across 3 phases (`192 192.1 193`) · 747 → 818 L**. ⚠ **Note the "before" column moved too, and that is the interesting half:** `721` was already stale when it was written — `1ae9e4d2`, the `192.1-08` commit that WROTE this row, touched the file's own docblock, so `git show 1ae9e4d2:<file> | wc -l` → **747**. *A row that records a file's line count in a commit that edits that file goes stale on itself.* Phase 193 added one commit (`dc59a79d`, 193-06) and **+71 L**. Re-derive with: `git log --oneline -- frontend/src/components/workflows/library/WorkflowCard.tsx | wc -l` → 8; `git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' | sort -u` → `192 192.1 193`; `wc -l` → 818; `git show 1ae9e4d2:<file> | wc -l` → 747.

### G-5 status (verbatim)

**G-5 does NOT fire — 2 phases against a threshold of ≥ 3, stated plainly with the numbers rather than left for the next phase to work out.** At 192.1's open the file measured **4 commits in ONE phase, 567 L**; at its close, **6 commits in TWO phases, 721 L**. ⚠ **One correction on measurement, and it is against this phase's own CONTEXT (D-02):** D-02 says *"The **single** occurrence of that filename in `CLAUDE.md` sits inside the `WorkflowsPage.tsx` row's prose"* — `grep -o "WorkflowCard.tsx" CLAUDE.md | wc -l` returned **2** before this row existed (the *"545 L is a REWRITE"* clause and the *"carries the identical figure"* clause), both prose, neither a row. The conclusion is unchanged and the count is corrected. **What 192.1 added to it:** the 14th atom — one `data-testid="row-identity"` node at DOM position 2, asserted by CHILD ORDER and never by class name, unconditional on all three provenances including drafts (D-06/D-08/D-10) — and a comment-only amendment of 192's D-15 direct-flip decision in the dialog's own commit (D-19), with the original reasoning left visible. **The invariants that now bind this file:** exactly ONE `row-identity` node per card (D-11); all nine shipped testids survive verbatim; the card computes NOTHING about slugs or versions — it receives a resolved `identity` prop, which is a **required** prop, so `tsc` enumerates the call sites rather than a default hiding them; no owner display name anywhere in the subtree (a swept fence, D-09); no `title=` attribute (F1, AST-parsed since `192-05` because the raw form reds on the prose documenting it). Its suite went **39 → 80 cases**. **What this row is FOR:** when the next phase's `files_modified` names this file, it inherits `6 / 2 / 721` — and the moment a THIRD phase lands here, G-5 fires on the count and this cell must be re-derived, not re-read. **⚠ THAT MOMENT ARRIVED ONE DAY LATER. G-5 NOW FIRES ON THIS FILE — 3 phases (`192`, `192.1`, `193`) against a threshold of ≥ 3 — and it is stated plainly rather than softened.** The row above predicted the condition and the condition is now met; the sentence *"G-5 does NOT fire"* at the head of this cell is TRUE OF 192.1 AND FALSE AS OF 193, and both are left standing so a reader can see what changed it. ⚠ **The fire is NOT 193's debt and 193 owes no refactor here.** 193-06 added a mount, not a concern: **+71 L**, one plain-text segment spliced at index 0 of the shipped `identityParts` line, derived in-card from `row` via the shipped ownership-predicate precedent, with **no new prop, no new component, no new colour and no chip** — the D-13 shape, chosen on SEED-155 / U8 grounds. ⚠ **One inherited claim is CORRECTED here rather than repeated: the 188.2 two-badge ceiling and its `@ts-expect-error` control guard the CANVAS `PhaseNodeCard`, NOT this file. There is no badge ceiling of any kind under `library/`** — 193's research measured it, and no plan may claim a typecheck enforces D-13. **What 193 added to the invariants:** the mark renders on a POSITIVE `templateAdmission(def) === "admits"` only, and the two silent arms (`does-not-admit`, `unknown`) are asserted against ONE SHARED expected value, so they are indistinguishable **by construction** rather than by promise — absence of the mark may never be readable as an assertion that no template is needed (D-15). The provenance node is still at DOM position 2 by child order, unmoved. Its suite went **80 → 90** cases. **⚠ THE OBLIGATION IS INHERITED FORWARD, NOT DISCHARGED: per G-5 the NEXT phase whose `files_modified` names this file owes a refactor recommendation as its FIRST option, before the feature it came to build.** That was already recorded as a deferred item in `193-CONTEXT.md`, and it is repeated here because a deferral living only in one phase's context file is exactly as invisible as a hot file missing from this table. The next phase inherits `8 / 3 / 818`. **⚠ RE-DERIVED AT PHASE 193.2's CLOSE (2026-08-15): `8 / 3 / 818` — UNCHANGED, because `193.2` DELIBERATELY DID NOT TOUCH THIS FILE, and that is a decision rather than an accident.** `193.2-CONTEXT.md` **D-04** made it a scoping constraint at discuss time: this cell obliges the next phase naming the card in `files_modified` to produce a refactor recommendation as its FIRST option, so the phase was designed to reach every one of its outcomes without editing it — the ordering is server-side, the requirement field lives on the Builder header and the refusal lives in `publish_service.py`. **Measured, not asserted: the file appears in NO plan's `files_modified` across all ten plans, and `git diff --numstat c1a6c122 HEAD -- <file>` is EMPTY.** *A measurement about a file nobody edited belongs in this table for the same reason the absences do* — a reader who finds no 193.2 entry here should be able to tell "out of scope by decision" from "nobody checked". **Its inherited G-5 obligation passes forward UNTOUCHED and UNDISCHARGED: the next phase whose `files_modified` names this file still owes a refactor recommendation as its FIRST option, before the feature it came to build. It still inherits `8 / 3 / 818`.** ⚠ One item is carried forward with it: `SEED-155` records that the approved sketch drew a row atom the card **structurally cannot render**, and the deferred library-layout sketch (G-2 fires) is where both are settled — so the refactor recommendation and that sketch are likely to arrive in the same phase.

---

## `frontend/src/components/workflows/WorkflowDoorSwitch.tsx`

**Re-derived 2026-08-17 (extraction):** `12 commits / 8 phases / 522 L` · **G-5 FIRES** (8 phases vs threshold 3) — honoured by construction (193 / 193.1).

### Phases touched (verbatim)

124 (124-02 `0cbcadf3`, `d60d04b9`) / 155 (155-07 `d682882b`) / 184 (184-11 `04d4f8f7`) / 184.1 (184.1-01 `0e9466de` + `12c557b3`) / 186 (186-07 `30a45a9c`) / 187 (187-26 `74aff9f9`) / **193 (193-03 `34279f98` THE CUT, 193-05 `5488baae`, 193-09 `2d4ab344`)** — **11 commits across 7 phases**, **385 → 426 lines**. ⚠ **ADDED 2026-08-13 by plan `193-10` under D-07, and the reason it is here matters more than any number in it: THIS FILE WAS ABSENT FROM THIS TABLE UNTIL PHASE 193. Six phases touched it — 124, 155, 184, 184.1, 186, 187, against a threshold of three — and G-5 never fired once, because the discuss-phase audit scans PLAN.md `files_modified` *against this table*. A hot file missing from the table is permanently invisible to its own guardrail.** That is the identical failure `WorkflowsPage.tsx` suffered for ten consecutive phases, two rows above, and **that sentence is the reason this row exists and must survive future edits.** ⚠ One correction on measurement against this phase's own CONTEXT: **D-07 measured `8 commits / 6 phases / 385 L` at discuss time and every figure has moved** — 193's own three commits make it 11 and 7, and the file is 426 L. Re-derive with: `git log --oneline -- frontend/src/components/workflows/WorkflowDoorSwitch.tsx | wc -l` → 11; `git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' | sort -u` → `124 155 184 184.1 186 187 193`; `wc -l <file>` → 426; `git show 74aff9f9:<file> | wc -l` → 385 (the last pre-193 commit on the file).

### G-5 status (verbatim)

**G-5 FIRED at 193 and was HONOURED BY CONSTRUCTION — no override, no waiver.** ⚠ **D-09: a G-5 override was OFFERED AND DECLINED.** Editing the file in place and logging a waiver under `STATE.md → Guardrail overrides` was on the table and was rejected; **`.planning/STATE.md` records NO guardrail override for Phase 193**, and the absence is a measurement, not an omission. The extraction shipped **FIRST, in its own waves, BEFORE the copy change and the restack** — the 192.1 order (D-08): Wave 2 cut `DoorHeaderStrip.tsx` (168 L) out verbatim, Wave 3 moved all 21 governed strings into `doorVocabulary.ts` (269 L, a zero-import `.ts` leaf), and only then did Wave 4 apply variant D's words and Wave 5 the D-04/D-22 restack. **A baseline only proves something if it PREDATES the change** (the 188.1 lesson), which is why the wave split was load-bearing rather than cosmetic. **PROVED, not asserted:** `193-01`'s six whole-`innerHTML` captures were taken on the UNMOVED tree at `501b3c14` in commits touching no source file, and the nine-phase-old byte-exact band literal at `WorkflowBuilderPage.header.test.tsx:304` — which predates this phase entirely — passed the extraction with **ZERO edits**, `git diff --numstat` EMPTY across the whole of `193-05`. The two later re-captures are DECLARED (`193-08` words-only, `193-09` structure-only, each dated and reasoned in its own file), never quietly absorbed. **⚠ THE SUBTREE GREW: `385 → 863 L, +124.2 %` — close to 192's +126.2 %, roughly double 188.2's +67.1 % and 192.1's +52.7 %, and it is stated rather than smoothed.** Measured with a named blank/comment/code classifier (JSX `{/* … */}` blocks counted as comment) **VALIDATED against 188.2's published known-good — `git show 95a4c915:frontend/src/components/workflows/PhaseNodeCard.tsx` → `797 / 518 / 249 / 30`, reproduced exactly — before a single 193 number was trusted.** Per-column: total `385 → 863` · COMMENT `147 → 548` (+401) · CODE `227 → 273` (+46) · BLANK `11 → 42` (+31). **The dominant term is PROSE, for the fourth cut running: comment is 83.9 % of the +478, while CODE grew only +20.3 %.** The three per-file deltas sum to exactly +478 — no unattributed residual. **What now binds this file:** the **D-24(a) copy fence** — no governed door literal may appear outside `doorVocabulary.ts`, a RAW sweep (not the AST form) so that a docblock QUOTING a governed word is caught too, driven RED against a real plant in each swept component; the **D-24(b) ESM-cycle fence** — `DoorHeaderStrip.tsx` may not import back, driven RED against two real back-import plants, one per spelling of `allowImportingTsExtensions`; **D-05's `ml-auto` pair** — present standalone, absent `inline`, asserted against a class string READ OUT OF another suite's committed literal rather than re-typed; and **D-06's standing rejection** — the return control may NOT move into `headerLead`, because `headerLead` renders only when `inline` is true and the standalone band would lose its escape entirely. ⚠ **The `🔒 judge always-on` badge is byte-untouched by the restack** (`git diff -U0` matches no line naming it) and its far-edge position is now pinned by child order rather than by that one-time diff. **⚠ THE FILE IS NOT FINISHED, and the next seam is NAMED rather than implied:** at 426 L it still hosts three whole surfaces in one component — the govern door's delegation shell (`:178`), the describe door with its draft/soul-preview/KB-picker machinery (`:225`), and the two-card chooser (`:362`). **The describe door is the largest self-contained concern left**, and 197 / AUTH-02 (*deepen the fast door*) is the trigger that will force someone into it. Per G-5 a phase that adds a genuinely SECOND concern here produces a refactor recommendation FIRST — and this row exists so that phase inherits `11 / 7 / 426` instead of re-deriving it. **⚠ RE-DERIVED AT PHASE 193.1's CLOSE (2026-08-15) — `11 / 7 / 426` is STALE and the corrected figures are `12 commits / 8 phases / 522 L`.** The row above ends by saying it exists *"so that phase inherits `11 / 7 / 426` instead of re-deriving it"* — 193.1 re-derived it anyway, which is the habit this table asks for, and the number had already moved. Phase list now `124 155 184 184.1 186 187 193 193.1`. **G-5 fired again and was honoured by construction a second time:** 193.1 mounted ONE row on the describe door (`:390`, above the CTA group at `:396`) using the component Plan 06 built, and added the read that crosses the hand-off via the SHIPPED `initialProjectFolderId` mechanism (`:202-209`, added 187-26 for the identical problem) — **no store, no context, no global.** The describe door is still the largest self-contained concern left, and 197 / AUTH-02 is still the trigger. Re-derive: `git log --oneline -- <file> | wc -l` → 12; `wc -l <file>` → 522.

---

## `frontend/src/pages/WorkflowBuilderPage.tsx`

**Re-derived 2026-08-17 (extraction):** `41 commits / 12 phases / 2348 L` · quick-task buckets excluded: `260809`, `260814` · **G-5 FIRES** (12 phases vs threshold 3) — honoured by construction (193.1 / 193.2).

### Phases touched (verbatim)

103 / 124 / 183 / 184 / 184.1 / 185 / 186 / 187 / 190 / 193, **plus the quick task `260809-klo`** (`1c58a3fb`) — **33 commits across 10 phases**, **2055 lines**. ⚠ **ADDED 2026-08-14 by quick task `260814-q5r`, and the reason it is here is the whole point of the row: TEN PHASES TOUCHED THIS FILE AND G-5 NEVER FIRED ONCE**, because the discuss-phase audit scans PLAN.md `files_modified` *against this table* — a hot file missing from the table is permanently invisible to its own guardrail. That is the identical failure `WorkflowsPage.tsx` suffered for ten phases and `WorkflowDoorSwitch.tsx` for six, both rows above. **That sentence is the reason this row exists and must survive future edits.** ⚠ One correction on measurement against the plan that commissioned it: the plan's `<guardrails>` table derived *10 phases* with the standard `sed` recipe, and that recipe actually returns **eleven** buckets here — the eleventh is `260809`, a QUICK TASK, not a phase. The phase count of 10 is correct as written and the derivation is corrected beside it, so the next reader is not surprised by their own command's output. Re-derive with: `git log --oneline -- frontend/src/pages/WorkflowBuilderPage.tsx | wc -l` → 33; `git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' | sort -u` → the ten phases + `260809`; `wc -l <file>` → 2055 (at `4bb9c1ac`).

### G-5 status (verbatim)

**G-5 FIRES ON THE COUNT — extraction due, and deliberately NOT taken in `260814-q5r`.** 10 phases is far past the ≥3 threshold, so the row states the fire rather than explaining it away. It is not honoured here for a measured reason that is a test, not an argument: **the file gains no SECOND concern.** The whole change is one `useMemo` over a `.find()` the file ALREADY performs (`nameContext`, `:666-670`) plus one property on an object literal it already builds (`:2041-2045`) — and the `.find()` count goes from two to ONE, so the descriptor ends with a single home. ⚠ **The 2055 figure is measured at this task's BASE commit and goes stale inside this very task** — Task 3 edits this file after `CLAUDE.md` is committed in Task 1. That is the same self-staling this table has now documented three times about `WorkflowsPage.tsx` and once about `WorkflowCard.tsx`; it is stated rather than hidden, and the re-derive command above is the fix. **Per G-5, the next phase that adds a genuinely second concern here owes a refactor recommendation FIRST** — and the natural seam is named rather than implied: the page hosts the Builder shell, the canvas mount, the publish gauntlet, the template/asset descriptor resolution and the save/concurrency machinery in one component. **⚠ G-5 FIRED AT 193.1 AND WAS **HONOURED**, NOT DEFERRED — the extraction this row demanded for ten phases was finally taken. RE-DERIVED AT CLOSE (2026-08-15): `33 / 10 / 2055` → **40 commits / 11 phases / 2252 L**.** Phase list gains `193.1`. **`193.1-05` cut the pre-draft template concern out into `frontend/src/components/workflows/useTemplateFirstDraft.ts`, and it shipped in Wave 2 — BEFORE the feature that needed it** (the 192.1 D-01 order), with characterization baselines captured by `193.1-01` on the **UNMOVED** tree in commits touching no source file. **PROVED, not asserted: `git diff --numstat` was EMPTY across all six pre-draft captures and both nine-phase-old byte-exact pins (`header.test.tsx:382`, `describe.test.tsx:307`) — ZERO re-capture** through the cut. **⚠ Note the file GREW anyway, `2073 → 2252`, because Waves 4-5 then added the wire, the bind and both mounts on top of the cut; the extraction removed 28 lines and the feature added ~207. An extraction and a feature are two different facts and neither may be quoted as the other** — the same correction the `WorkflowsPage.tsx` row makes about itself. Subtree `2073 → 2324 (+12.1 %)`, the **smallest of this project's five cuts** (188.2 +67 %, 192 +126 %, 192.1 +53 %, 193 +124 %) because one concern landed in ONE module rather than five-plus; COMMENT is 73 % of the growth — prose dominant for the fifth cut running. ⚠ **A G-5 waiver was OFFERED AND DECLINED at discuss time (D-01), so `.planning/STATE.md` records NO guardrail override for Phase 193.1 — that absence is a measurement.** **The obligation is NOT discharged:** the page still hosts the Builder shell, the canvas mount, the publish gauntlet, the descriptor resolution and the save/concurrency machinery, so the next phase adding a genuinely second concern still owes a refactor recommendation FIRST. It inherits `40 / 11 / 2252`. **⚠ RE-DERIVED AT PHASE 193.2's CLOSE (2026-08-15): `40 / 11 / 2252` → `41 commits / 12 phases / 2348 L`** — recorded beside the previous value, not over it. Phase list gains `193.2`. ⚠ **THE PHASE COUNT WAS DISPUTED AND IS RESOLVED BY MEASUREMENT, ON EXACTLY THE TRAP THIS CELL ALREADY DOCUMENTS:** the standard `sed` recipe returns **fourteen** buckets here — `103 124 183 184 184.1 185 186 187 190 193 193.1 193.2 260809 260814` — of which `260809` and `260814` are **QUICK TASKS, not phases**. `193.2-09-SUMMARY.md` read **12**; the close-out brief's recipe returned **14**; **the 12 is correct and the 14 is what the command prints.** Both are recorded, the loser beside the winner. **G-5 fires (12 phases) and was honoured BY CONSTRUCTION for the second consecutive phase, on the same measured test:** 193.2 added **one gated sibling node inside an affordance the file already owns** — the AI-proposal mark, mounted inside `data-testid="builder-business-requirement"` and inside the **same** `canvasEnabled` ternary as `requirementAffordance` itself, plus two module-level copy constants declared beside the `REQUIREMENT_INVITATION` they extend. **0 deleted lines in this file, `useState(` count 6 → 6, `tsc` unmoved at 33 measured after every task.** ⚠ **A claim the plan made about this file was measured FALSE and is corrected rather than repeated: `FLAG_OFF_HEADER_MARKUP`'s nine-phase-old byte pin does NOT red when the mark is mounted outside the gate.** Its fixture carries no `business_requirement_seeded_by_ai`, so the mark never renders in that fixture at all — inside the gate or outside it — and the pin stayed **GREEN under the exact plant it was credited with catching** (`header.test.tsx` 32 passed while `canvas.test.tsx` reported the 2 failures). The protection is real and lives in the two new `canvas.test.tsx` cases instead; the pin is nevertheless byte-unmoved (`git diff --numstat` EMPTY). **The invariants that now bind this file:** the mark renders only inside that gate and inside that affordance, asserted by CONTAINMENT never by class name; the copy is **`AI-proposed`** with a `title` explanation, and **there is NO GLYPH — the word carries it** (`icon-convention.md` §4; `✦` is refused outright, being the shipped Working badge that owes a placement); the provenance is read **off the persisted definition with a strict `=== true`**, never mirrored into page state and never written `true` by any client path. It inherits `41 / 12 / 2348`.

---

### Phase 196 (plan `196-08`) — one hook call and one prop, in the shape the two leaf hooks beside it already use

**RE-DERIVED 2026-08-18 by plan `196-09`: `42 commits / 13 phases / 2398 L`** (`CLAUDE.md`'s row read
`41 / 12 / 2348`; quick-task buckets excluded: `260809`, `260814`). ⚠ **STALE — and this row's own text already
predicted its own staleness** (*"the 2055 figure is measured at this task's BASE commit and goes stale inside
this very task"*). Phase list gains `196`.

**What 196 did:** the Builder became the ONE owner of the author-model-registry read. It calls
`useModelRegistry()` once (`grep -c 'useModelRegistry'` here is exactly **2** — one import, one call), reads
the app-wide `TechnicalNamesProvider` boolean, and passes a **single spread-conditional prop** down to
`PhaseFormPanel`. Diff **+50 / −0**.

**Why G-5 is honoured rather than triggered:** the page gains **a hook call and a prop**, in the identical
shape of the two leaf hooks it already consumes. It gains no second concern — the Builder shell, the canvas
mount, the publish gauntlet, the template/asset descriptor resolution and the save/concurrency machinery are
all untouched. The named seam still stands and was not taken.

**⚠ THE INVARIANT THIS PHASE ADDED IS AN ABSENCE, AND IT IS A DELIBERATE TRADE RATHER THAN AN OVERSIGHT:**
the prop is passed **only on a `ready` registry read**. On `loading` / `unavailable` the AI model field is
**absent from the step form entirely.** Passing `models: []` was weighed and rejected: `ModelField` would then
render a calm, correct-looking control that offers nothing but its inherit option **and retains every stored
model as `(current) — not in the registry`** — telling an author that a perfectly registered model is unknown
and inviting them to change it. *An absent field writes nothing and says nothing false; a lying one does
both.* **`ModelField` cannot express "I could not read the registry"** — it takes rows, not a reading. **A
future phase that wants a degraded-but-present control must give the picker a third reading, deliberately, as
its own change.**

⚠ **A SECOND-ORDER CONSEQUENCE THAT COST 249 FAILING TESTS AND WILL RECUR:** because this page now reads the
api client **at mount**, every suite that stubs `@/lib/api` with an explicit factory rather than
`importOriginal` must **declare the new export**, or it throws at mount and takes the whole page down. Nine
suites needed one line each — `WorkflowBuilderPage.canvas` (124 cases) · `.describe` (30) · `.session` (22) ·
`.header` (20) · `.test` (15) · `WorkflowDoorSwitch.test` (15) · `.preDraft.baseline` (11) ·
`WorkflowsPage.test` (10) · `WorkflowDoorSwitch.baseline.test` (2). **This is the `getGroundingBundle`
precedent repeating one phase later**, and `WorkflowDoorSwitch.baseline.test.tsx` already carried a comment
from the previous occurrence. ⚠ **A red gate here is NOT automatically a SEED-171 flake** — 249 failures
naming one undeclared export was a real regression, and it was distinguished by correct triage (filenames read
from the gate's own persisted JSON **before** any re-run; the worker cap never touched).

**Per G-5 the next phase adding a genuinely second concern here owes a refactor recommendation FIRST; it
inherits `42 / 13 / 2398`.**

---

## `backend/app/api/workflows.py`

**Re-derived 2026-08-17 (extraction):** `35 commits / 17 phases / 1962 L` · quick-task buckets excluded: `260814` · **G-5 FIRES** (17 phases vs threshold 3) — extraction due — not taken in q5r (no 2nd concern).

### Phases touched (verbatim)

092 / 098 / 102 / 103 / 143 / 148 / 152 / 163 / 165 / 182 / 185 / 186 / 187 / 192 / 192.1 / 193, **plus the quick task `260809-klo`** (`3781a3fe`) — **32 commits across 16 phases**, **1719 → 1813 lines**. ⚠ **ADDED 2026-08-14 by quick task `260814-q5r`.** Sixteen phases — the second-hottest file on this ledger after `phase_types.py` — and it was **absent from this table**, so G-5 never fired on it once. Same invisibility failure as the row above. Re-derive with: `git log --oneline -- backend/app/api/workflows.py | wc -l` → 32; `git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' | sort -u` → the sixteen phases + `quick`; `git show 4bb9c1ac:<file> | wc -l` → 1719; `wc -l <file>` → 1813.

### G-5 status (verbatim)

**G-5 FIRES ON THE COUNT — extraction due, and deliberately NOT taken in `260814-q5r`.** The measured reason: the file gains **one read route for the template concern it already owns** — it already hosts the Phase 193 upload door that MINTS the very `asset_id` this route reads, twenty lines above. A door that mints an id and a door that reads it are one concern, not two. ⚠ **The +94 lines are dominated by PROSE, and it is stated rather than smoothed:** the route's body is ~15 statements; the rest is the docblock recording why this route exists instead of a widened `?template_asset_id=` on `/grounding-bundle` (that parameter is typed `UUID | None` while these asset ids are Storage PATHS — a **measured 422**, `uuid_parsing` at `['query','template_asset_id']`), and why the `..` fence is load-bearing rather than belt-and-braces. **What now binds this file:** the new route's two fences are its ONLY authorization boundary (the workflow cluster reads through a service-role pool that bypasses RLS), and both were driven RED against real plants — deleting the owner-prefix clause was shown to return `{'read':'ok','placeholders':['their_secret']}` for another user's asset. **Per G-5 the next phase that adds a genuinely second concern here owes a refactor recommendation FIRST;** the natural seam is that this one module hosts the definition CRUD, the validate/lint surface, the grounding palette, the publish gauntlet, the run launcher and the template door. **⚠ RE-DERIVED AT PHASE 193.1's CLOSE (2026-08-15): `32 / 16 / 1813` → **34 commits / 17 phases / 1951 L**.** ⚠ **CONTEXT D-01's own discuss-time re-measurement of `33 / 1813` was ALREADY STALE when written — the third time this table has documented a figure going stale about itself, and it is stated rather than overwritten.** Phase list gains `193.1`. **G-5 fired and was honoured by construction for the second consecutive phase, on the same measured test:** 193.1 added `POST /workflows/template/placeholders` — a **third door in the template block this module already owns**, sitting beside `POST /{id}/template` (Phase 193) and `GET /{id}/template/placeholders` (q5r). A door that mints an id, a door that reads it by id, and a door that reads it from bytes are one concern, not three. **What now binds the new door, and it is structural rather than a guard:** it injects **NO Supabase client and NO pool**, which makes the q5r cross-tenant class unreachable **by construction** — asserted by a signature/AST fence driven RED against a planted `get_pg_pool()`. It also adds the **zip-bomb cap the shipped size gates never covered** (`zf.read()` was unbounded; a 10 MB OOXML container can hold a multi-GB `word/document.xml`), driven RED at ×10,000,000. ⚠ **A parse failure may NEVER be indistinguishable from "no placeholders"** — corrupt or renamed files are 422, and the honesty property was measured to rest on **two** independent container gates, not one: removing `validate_upload` alone did not produce the lie. **Per G-5 the next phase adding a genuinely second concern still owes a refactor recommendation FIRST;** it inherits `34 / 17 / 1951`. **⚠ RE-DERIVED AT PHASE 193.2's CLOSE (2026-08-15): `34 / 17 / 1951` — UNCHANGED, and the non-move is a measurement rather than an omission.** ⚠ **Phase 193.2 did NOT touch this file**, which is worth recording because `193.2-CONTEXT.md` D-02 listed it as one of the six files in scope (*"it re-emits whatever the helper now says"*) and the ROADMAP's own flags predicted **"G-5 will fire on `backend/app/api/workflows.py`"**. It did not need to: D-12 makes `_interactive_phase_failures` the single source of the refusal literal, consumed verbatim by BOTH the publish gate and `/validate` → `blockedReason`, so rewriting the words in `publish_service.py` changed both surfaces **without one line landing here**. *A file predicted to be edited and then measurably not edited is a fact worth writing down, because the next reader would otherwise assume the prediction held.* **Its inherited G-5 obligation therefore passes forward completely untouched**; the next phase adding a genuinely second concern still owes a refactor recommendation FIRST, and it still inherits `34 / 17 / 1951`. Re-derive with `git log --oneline -- backend/app/api/workflows.py | wc -l` → 34 and `wc -l <file>` → 1951 (the recipe's 19 buckets include `260814` and `quick`, both quick tasks — 17 phases).

### Phase 196 (plan `196-06`) — re-derived, and honoured by construction for the third consecutive phase

**RE-DERIVED 2026-08-18 by plan `196-09`: `36 commits / 18 phases / 1984 L`** (`CLAUDE.md`'s row read
`35 / 17 / 1962`; quick-task bucket excluded: `260814`). ⚠ **`196-06` measured the identical triple at its own
close and called the row *"stale again, and by one phase — this plan's own commit is the 36th"*. It is the
FIFTH recorded staleness on this one file, and this close re-derived it independently rather than copying
`196-06`'s figure — the two agree, and the agreement is stated as a re-derivation rather than as a citation.**

**What 196 did:** both write doors — `create_draft` and `update_draft` — now refuse a **newly-introduced**
unregistered `config.model` with an object-shaped 400, after ownership and before any write. **All of the
logic lives in `backend/app/services/model_registry.py`**; this file's whole contribution is one import and two
call sites — **9 code lines** (plus 13 comment lines).

**Why G-5 is honoured rather than triggered:** this row's own named seam applies one test — *does this add a
genuinely SECOND concern?* A validation on the definition CRUD this module already owns is **a call-out, not a
concern**, the same verdict `260814-q5r`, `193.1` and `193.2` each reached on the same test. Taking the named
five-way split of a 1984-line module inside a model-picker phase would be smuggling a refactor phase.

**The invariants that now bind this file, and the first is the security one:**

1. ⚠ **A PATCH from a caller who does NOT own the row must FALL THROUGH to the existing 0-row UPDATE, never
   raise.** A 400 fired before ownership resolves is an **existence oracle wearing a different status code**.
   The shipped shape asks the cheap question first (`unregistered_phase_models(body)`), and only then pays for
   the owner-scoped read and the explicit `created_by == user_id` comparison. ⚠ **The bare `is not None` form
   is WRONG and was rejected on measurement — `get_definition` also returns GLOBAL PUBLISHED rows to
   non-owners**, so grandfathering off a stranger's global row would have re-opened the oracle by a second
   route. Pinned by `test_a_non_owner_patch_carrying_an_unregistered_model_is_the_same_dull_404`, including
   `isinstance(detail, str)` so a dict detail cannot creep in.
2. ⚠ **The stored-row read must stay LAZY.** 239 of 257 stored phases carry no model, so an unconditional
   pre-read would cost every autosave an extra query for a grandfather that can never apply — and it would
   change the call sequence every mocked-pool route test in `test_186_concurrent_patch.py` depends on. Pinned
   by `test_the_ordering_holds_for_a_blank_model_too`.
3. **Not a pre-emptive 404, deliberately** — that would turn an **owner's** PATCH of their own **published**
   row from today's `409 already_published` into a 404. Falling through preserves all three of today's
   refusals byte-for-byte.
4. ⚠ **The plan's `<15 changed lines` criterion was MISSED at 22 and is recorded as a miss, not
   reinterpreted.** Split: **9 code / 13 comment**. The overage is entirely the comment recording *why* the
   not-owned case falls through — the single most load-bearing line of reasoning in that plan.

**The publish route at `:1057-1120` is byte-unchanged, and the gap that leaves is measured rather than
waved at:** publish reads the **stored** definition, so a pre-196 definition could carry an unregistered model
and publish without meeting the refusal. Measured population: **0 of 257 stored phases**. No eighth gauntlet
stage was added — see **`SEED-176`**, which carries the mechanical re-open trigger.

---

---

## `backend/app/services/harness/grounding.py`

**Re-derived 2026-08-17 (extraction):** `18 commits / 5 phases / 1252 L` · quick-task buckets excluded: `260814` · **G-5 FIRES** (5 phases vs threshold 3) — honoured by construction (193.1).

### Phases touched (verbatim)

182 / 185 / 187 / 189, **plus the quick task `260809-klo`** (`3781a3fe`) — **15 commits across 4 phases**, **1150 → 1186 lines**. ⚠ **ADDED 2026-08-14 by quick task `260814-q5r`** — four phases against a threshold of three, absent from this table, same invisibility failure as the two rows above. Re-derive with: `git log --oneline -- backend/app/services/harness/grounding.py | wc -l` → 15; `git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' | sort -u` → `182 185 187 189` + `quick`; `git show 4bb9c1ac:<file> | wc -l` → 1150; `wc -l <file>` → 1186.

### G-5 status (verbatim)

**G-5 FIRES ON THE COUNT — extraction due, and deliberately NOT taken in `260814-q5r`.** The measured reason: the file gains **a return value on a resolver it already owns**, not a concern. `_resolve_template_placeholders` became the public `resolve_template_placeholders` returning `(names, read)` where `read` is `"ok" | "unreadable" | "not_requested"`; **no control flow changed** — each existing arm merely says which of the three it is. `GroundingBundle`'s dataclass, its `degraded` set and every existing consumer are byte-unaffected, and `assemble_grounding_bundle` unpacks and discards the status. **The invariant that now binds this file, and it is a red line rather than a preference: a template-read failure must NEVER enter `degraded`.** That set is consumed by `/validate`'s `grounding_unavailable_finding` and by the publish gauntlet, so an unreadable *document* landing there would become a validation finding and change publish behaviour far outside this concern — pinned by `test_grounding_bundle_has_no_template_read_axis`. The `"ok"`-with-`[]` arm (parser found no tokens) is the ONE arm that may honestly report an empty read; the no-bytes and exception arms are `"unreadable"`, and both are pinned independently so neither can carry the other. **Per G-5 the next phase that adds a genuinely second concern here owes a refactor recommendation FIRST.** **⚠ RE-DERIVED AT PHASE 193.1's CLOSE (2026-08-15): `15 / 4 / 1186` → **18 commits / 5 phases / 1252 L**.** Phase list gains `193.1`. **G-5 fires on the count and was honoured by construction — but the reason is worth reading, because this file is where Phase 193.1's central assumption was found to be FALSE.** `193.1-04` drove six real `/generate` calls and measured that **supplying `template_placeholders` did NOT flip the DELIVERABLE RULE's branch — 0 `render_template` phases on 3 of 3 runs.** The wire was never broken (all names reached the prompt; RESEARCH's four-hop trace re-verified **exact at HEAD**, all 18 claims). What failed was the **inference**: this file's grounding header HEDGED — *"(if the workflow must fill a template)"* — while `AUTHORING_SYSTEM_PROMPT`'s rule requires *"(i.e. the user **provided** a .docx to fill)"*. **Nothing asserted provision.** ⇒ `D-26`, and an unplanned plan `193.1-11` split the section into **two assertive arms**. Re-measured after: **Call B 0/3 → 3/3 `render_template`, key coverage 3-4/8 → 8/8, control unchanged at 0** — so the absent arm is provably no weaker and SC#4 holds. **What now binds this file:** the two arms must **assert opposite facts and share no sentence** (pinned by a case driven RED against a plant that collapsed them back into one) — a single string serving both meanings **was** the defect; and a template-read failure must still NEVER enter `degraded`. ⚠ **A DURABILITY HOLE was found in the pin that guards that last rule:** `test_grounding_bundle_has_no_template_read_axis` **passed** under a planted `degraded.add("template")`, because it asserts the absence of *fields* and a set member adds no field — yet it is credited in THREE places (its own docblock, `resolve_template_placeholders`'s docblock, and this ledger row) with defending a rule it cannot see. A permanent positive control now sits beside it; the original is untouched. **Per G-5 the next phase adding a genuinely second concern owes a refactor recommendation FIRST;** it inherits `18 / 5 / 1252`.

---

## `frontend/src/components/workflows/PhaseFormPanel.tsx`

**Re-derived 2026-08-17 (extraction):** `16 commits / 8 phases / 1167 L` · quick-task buckets excluded: `260814` · **G-5 FIRES** (8 phases vs threshold 3) — honoured by construction ×3 (185 / 193 / 193.1).

### Phases touched (verbatim)

**⚠ THIS CELL'S TOUCH LIST WAS WRONG IN BOTH DIRECTIONS AND IS CORRECTED ON MEASUREMENT (2026-08-15, Phase 193.1 close). It read `140 / 183 / 184 / 185 — 1095 L`. Measured: **16 commits across 8 phases — `103 155 183 184 185 189 193 193.1` — and 1167 L**. Phase **140 does not appear in the file's history at all**, while 103, 155, 189, 193 and 193.1 were all missing from the list. A ledger row that names a phase which never touched the file, and omits five that did, cannot be audited against — this is the same class of failure as a hot file being ABSENT from the table, which `WorkflowsPage.tsx` (ten phases) and `WorkflowDoorSwitch.tsx` (six) both suffered.** Re-derive with: `git log --oneline -- frontend/src/components/workflows/PhaseFormPanel.tsx | wc -l` → 16; `git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' | sort -u`; `wc -l <file>` → 1167.

### G-5 status (verbatim)

**G-5 FIRES ON THE COUNT (8 phases against a threshold of 3) — and it has now been honoured BY CONSTRUCTION three times running, which is why no extraction is due.** The row's standing order since 185 is *"the next surface that needs the panel gets its own component and one gated line"*. 185 obeyed it (23 ins / 6 del, only 4 insertions reaching the render body; the dial and its refusal live in `GovernanceSection.tsx`). 193 obeyed it. **193.1 obeyed it and PROVED it rather than promising it:** the three-bucket template name check ships as its own component `TemplateNameCheck.tsx` with sibling `templateNameBuckets.ts`, mounted by **ONE gated line at `:1116`** — panel diff **+31 / −0**, of which **zero** added lines contain `useMemo` / `useState` / `useEffect` / `.filter(` / `.map(`. **The one-line property is now MECHANICALLY GUARDED, not asserted:** a source fence splits the panel's `?raw` text, filters lines containing `<TemplateNameCheck`, asserts `toHaveLength(1)`, and asserts that same line carries both `pt === "llm_emit"` and `{...nameCheck}` — so neither a second mount nor an unpacked prop can land quietly. ⚠ **`193.1-CONTEXT.md` D-22 recorded this file as measuring `15 commits / 7 phases / 1136 L` at plan time; that is ALSO stale now** — stated beside the corrected figure rather than over it, per this table's habit. **Per G-5, a phase that adds a genuinely SECOND concern here owes a refactor recommendation FIRST; it inherits `16 / 8 / 1167`.**

### Phase 196 (plan `196-08`) — the FOURTH honouring of the one-gated-line order, and a SECOND source fence

**RE-DERIVED 2026-08-18 by plan `196-09`: `19 commits / 9 phases / 1216 L`** (`CLAUDE.md`'s row read
`16 / 8 / 1167`; quick-task bucket excluded: `260814`). ⚠ **STALE, and it is the third consecutive close at
which this file's row has been found stale** — `193.1-CONTEXT.md` D-22 read `15 / 7 / 1136`, the extraction
read `16 / 8 / 1167`, and both were true when written. Phase list gains `196`.

**What 196 did, and the headline is a DELETION:**

| Grep on this file | before | after |
|---|---:|---:|
| `label="AI model"` | **4** (`:877`, `:913`, `:965`, `:1067`) | **0** |
| `<ModelField` | 0 | **4** |
| `useMemo(` · `useState[(<]` · `useEffect(` | 0 · 0 · 0 | **0 · 0 · 0** |
| `.filter(` · `.map(` | 6 · 11 | **6 · 11** |

Four free-text `<TextField label="AI model">` mounts became four one-line gated `<ModelField>` mounts, each
`{...modelPicker}`-spread and each guarded by its own `pt === "…"` phase-type test. `showFitness` appears on
**exactly one** line and it is the `llm_emit` one (D-12). The panel's diff is **+81 / −18**, and the 18 removed
lines are the four deleted mounts plus two import/destructure lines — **this phase REPLACED a concern rather
than adding a second one**, which is the strongest form the standing order has been honoured in.

**⚠ THE NEW `<ModelField` FENCE IS A SECOND FENCE, NOT A WIDENING OF THE FIRST — and the reason belongs on
this row because a reader who assumes otherwise will delete one of them.** The shipped 193.1 fence is scoped
to **`<TemplateNameCheck`** (`toHaveLength(1)`, one gated line). It **could not have covered the picker**:
it filters this file's `?raw` source for that one token and asserts a count of one, so a `<ModelField` mount
is entirely outside the set it examines, and four of them would have landed with the 193.1 fence still green.
The new fence collects the lines carrying the picker's tag, asserts the **sorted SET** of their `pt ===`
guards equals `["llm_agent","llm_batch_agents","llm_emit","llm_single"]`, and adds an **ABSOLUTE zero** on
`useMemo` / `useState` / `useEffect` in the panel body.

- ⚠ **A `toHaveLength(4)` would NOT have been equivalent** — it passes a duplicated guard (two mounts both
  gated `llm_single`) and a missing type alike. The set comparison fails both, and the positive control
  exercises exactly those two shapes.
- **Both halves were driven RED against real plants in production source** (a stripped `llm_agent` guard; a
  real `useMemo` over `modelPicker.models`), then the file restored **md5-identical**. *A fence never seen red
  is not evidence.*

**The invariants that now bind this file:**

1. ⚠ **`ModelFieldProps` MUST stay ALIASED on import** (`type ModelFieldProps as PickerProps`). The type's
   name begins with the component's name, so `Pick<ModelFieldProps, …>` carries the literal `<ModelField`
   token on a line that is **not a mount and has no `pt ===` guard** — the exact shape the fence exists to
   reject. Unaliased, the mount count reads **5**. The alias is load-bearing, not cosmetic.
2. ⚠ **Prose in this file can break its own guardrails.** The 187-24 trap fired **three times in one plan**
   here: a docblock that wrote *"scoped to `<TemplateNameCheck`"* took the shipped fence 1 → 2 and turned it
   red; a docblock listing the compute tokens it promised were absent took the added-line grep to 2; a mount
   comment naming the registry hook took that grep to 3. **Every needle is now either named by role or built
   at runtime in the test** (`"<" + "ModelField"`, `"use" + "Memo("`). No criterion was relaxed in any of them.
3. **The Phase-103 helper sentence *"Leave blank to use the workspace default."* was WRONG, not merely old** —
   there is no workspace default in the code. It now reads *"Leave blank to use the run's model."*, and the
   assertion was updated to the shipped copy rather than loosened to a `/leave blank/i` regex that would have
   accepted the lie coming back.
4. **`FieldLabel` / `InfoHint` are still private to this file, and the extraction is DEFERRED on a reason
   with a three-arm re-open trigger recorded in source** (`196-08`). `ModelField` renders the same
   two-audience structure locally rather than importing them, because exporting them would make the pair a
   genuine ESM cycle the moment the panel imports the picker — which it now does. ⚠ **A change to this file's
   label structure must be mirrored in `ModelField.tsx`**, and the picker's rendered-role assertions
   (`getByRole("combobox", { name: /ai model/i })`) are what stop that duplication from drifting silently.

**Per G-5 the next phase adding a genuinely second concern here owes a refactor recommendation FIRST; it
inherits `19 / 9 / 1216`, and that figure goes stale on the next commit touching the file.**

---

## `backend/app/db/workflows.py`

**Re-derived 2026-08-17 (extraction):** `36 commits / 18 phases / 1656 L` · **G-5 FIRES** (18 phases vs threshold 3) — honoured by construction (193.2 / 194) — hottest backend module by phase.

### Phases touched (verbatim)

091 / 092 / 098 / 101.1 / 102 / 103 / 143 / 152 / 163 / 165 / 185 / 186 / 189 / 190 / 192 / 192.1 / **193.2 (193.2-03 `0d8b8bc5`)** — **31 commits across 17 phases**, **1296 → 1405 lines**. ⚠ **ZERO quick-task buckets on this file:** the standard `sed` recipe returns exactly 17 buckets and all seventeen are real phases — unlike `WorkflowBuilderPage.tsx`, `api/workflows.py` and `grounding.py` below, whose recipes return `260809` / `260814` / `quick` alongside the phases. ⚠ **ADDED 2026-08-15 by plan `193.2-10`, and the reason it is here matters more than any number in it: THIS FILE WAS ABSENT FROM THIS TABLE UNTIL PHASE 193.2. Seventeen phases touched it — it is the SECOND-HOTTEST BACKEND FILE IN THE TREE after `phase_types.py` — and G-5 never fired on it once, because the discuss-phase audit scans PLAN.md `files_modified` *against this table*. A hot file missing from the table is permanently invisible to its own guardrail.** That is the identical invisibility failure `WorkflowsPage.tsx` suffered for ten phases, `WorkflowDoorSwitch.tsx` for six and `WorkflowBuilderPage.tsx` for ten, **and that sentence is the reason this row exists and must survive future edits.** ⚠ One correction on measurement against this phase's own artifacts: `193.2-CONTEXT.md` D-01 and `193.2-BASELINE.md` §5 both measured `30 / 16 / 1296` at the phase's open and **all three figures moved on this phase's own commit** — stated beside the earlier value rather than over it, per this table's habit. Re-derive with: `git log --oneline -- backend/app/db/workflows.py | wc -l` → 31; `git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' | sort -u` → the seventeen phases above, no quick-task bucket; `wc -l <file>` → 1405; `git show c1a6c122:<file> | wc -l` → 1296.

### G-5 status (verbatim)

**G-5 FIRES HARDEST OF ANY BACKEND FILE BUT ONE (17 phases against a threshold of 3) — and it was honoured BY CONSTRUCTION in 193.2, not waived. A G-5 override was OFFERED AND DECLINED for the third consecutive phase, so `.planning/STATE.md` records NO guardrail override for Phase 193.2; that absence is a measurement, not an omission.** **The measured reason, which is a test rather than an argument:** the file already owns **three list-feed functions that ORDER their own rows**, and 193.2 changed the `ORDER BY` on two of them. *An ordering change to an ordering clause is not a second concern.* The measurement behind that claim is the complete non-comment diff — `git diff -U0 -- <file> | grep '^[-+]' | grep -v '^[-+][-+]' | grep -vE '^[-+]\s*#'` returned **exactly two lines**, both inside clauses the file already had; of the `+111 / −2`, **109 lines are recorded-decision comments**. Zero `WHERE` clauses, zero `params` appends, zero `$N` bindings, zero `SELECT` projections moved — which is also the whole of the security argument, because on a service-role pool that bypasses RLS the `WHERE` clause *is* the access boundary. ⚠ **D-16's DIVERGENCE IS WRITTEN HERE BECAUSE THAT IS D-16's OWN STATED CONDITION, and the row is half of it — the code at all three feed sites is the other half.** `BUG-260815-02` warned *"change them together or the feeds disagree"*, and this phase deliberately did not: `list_published_workflows` and `list_draft_workflows` — **the two feeds holding the author's OWN work** — now `ORDER BY updated_at DESC`, while `list_starter_workflows` **stays `ORDER BY name`**, because starters are a curated catalogue the author did not write and *"most recently updated starter"* is meaningless to someone browsing. The divergence is accepted with eyes open and is recorded in three places so the next reader finds a decision rather than an inconsistency. ⚠ **On the published feed, `ORDER BY updated_at DESC` IS `ORDER BY publish-time DESC`** — the publish flip is an `UPDATE`, `workflow_definitions_set_updated_at` is an **unconditional `BEFORE UPDATE` trigger**, and `workflow_definitions_block_published` then freezes the row, so the column cannot drift away from the publish moment afterwards; `created_at DESC` was rejected because the card's *"changed 2 minutes ago"* reads `updated_at` (192.1's `relativeChanged`), and the list and the card would then disagree by construction. ⚠ **NO MIGRATION WAS NEEDED AND HERE IS THE REASON RATHER THAN THE ASSURANCE:** there is no index on `name` either, so the shipped sort was **already** unindexed and the plan shape does not move; the table is 225 rows and the largest feed 118; `ls supabase/migrations/ | wc -l` reads **112 before and after**. Re-open at ~10k rows. ⚠ **THE SHARED-CONSUMER CONSEQUENCE, stated here rather than discovered later:** ~~with the default `owned_only=False`, `list_published_workflows` is **not only** the Workflows-page shelf — it also feeds the **composer's Harness workflow picker**, **`WorkspacePanel`'s run-soul** and **`threads.py`'s kickoff** (`:97` imports it). **All three move from alphabetical to recency**, a user-visible change OUTSIDE the library~~ → ⚠ **MEASURED FALSE AND CORRECTED BESIDE THE ORIGINAL (2026-08-16, driving UAT row U5). THREE OF THOSE FOUR CLAUSES ARE WRONG, and this row is where `193.2-UAT.md` §U5 and `193.2-VALIDATION.md` both inherited them — a sentence repeated across three artifacts is not three pieces of evidence.** `list_published_workflows` has **exactly ONE call site in the whole backend** (`api/workflows.py:339`). Consumer by consumer: **the composer's Harness workflow picker DOES NOT EXIST** — no production module under `frontend/src` renders an ordered list of published workflows in the composer; `MessageInput.tsx`'s two dropdowns are the model picker and the Agent-mode (General/Explorer) selector, and a workflow arrives from the Workflows-page RunModal with the composer **LOCKED** (`workflowLocked`), never chosen there. **`WorkspacePanel`'s run-soul is order-INSENSITIVE** — `published.find((w) => w.slug === slug)` (`:125-127`) returns the same row from any permutation. **`threads.py:97` is a DEAD IMPORT** — imported, never called (the original wording *"`:97` imports it"* was literally true and was read as *"consumes it"*). And a fourth consumer the row never named, **`ConnectionsTab.tsx:841`**, aggregates into *Used by* counts — permutation-invariant. **So the reorder is user-visible in exactly ONE surface: the library, already driven by UAT row U4 (rendered position 4, PASS).** The clause that survives measurement is the last one: no test and no frontend module asserts alphabetical order for any consumer — which is now *because none of them can see order*, not because coverage was missing. ⚠ **The `ORDER BY` is `updated_at DESC, id DESC`** (`:397`, `:704`) — the review's **WR-03** tiebreaker, and it is load-bearing rather than defensive: the live feed carries identical-timestamp PAIRS (156 published rows, e.g. two at `13:48:17`) that would otherwise be free to swap between reads. **The invariants that now bind this file:** the two author feeds order by recency and the starters feed does NOT, pinned by `test_the_two_author_feeds_order_by_recency_and_starters_stay_alphabetical` — the 192.1 scope fence `test_no_feed_orders_by_updated_at` **rewritten in place, never deleted**, with 192.1's reasoning kept verbatim under a `SUPERSEDED` marker and the old name quoted in the docstring so `git log -S` still finds the thread, and **driven RED clause-by-clause against the pre-change source** (a pytest run proves only that the FIRST clause fails, because `assert` short-circuits); the three feed sources each carry the literal tokens `D-16` **and** `BUG-260815-02` — ⚠ **the bare `D-16` needle is VACUOUS on the drafts feed and that was caught by MEASURING, not by reading**: `list_draft_workflows` has carried a *"D-16 IS A FENCE, NOT ADVICE"* docblock since **Phase 192.1**, where `D-16` names an entirely different decision, so one third of that fence could never have fired; and the three predicate byte-identity cases (F-2) stay unedited and green. **Per G-5 the next phase that adds a genuinely second concern here owes a refactor recommendation FIRST; the natural seam is named rather than implied — the three list feeds versus the single-definition read, and the publish-flip versus the run CRUD. It inherits `31 / 17 / 1405`.** ⚠ **RE-DERIVED HOURS LATER AT PHASE 193.2's ACTUAL CLOSE (2026-08-15, after the code-review fix pass): `31 / 17 / 1405` → `32 commits / 17 phases / 1447 L`.** Recorded beside, not over. ⚠ **This row went stale ON THE SAME DAY IT WAS WRITTEN, and that is the sharpest instance of the self-staling this table documents about itself** — the figures were measured at the close-out plan's HEAD and the review's WR-fix commits landed on the file afterwards. *A figure written at a plan's close goes stale on the next commit that touches the file, and "the next commit" can be the same afternoon.* The phase count is unmoved at 17. It inherits `32 / 17 / 1447`. **⚠ RE-DERIVED AT PHASE 194's CLOSE (2026-08-16, plan `194-13`): `32 / 17 / 1447` → `34 commits / 18 phases / 1582 L`** — recorded beside, not over. **This cell has now been corrected FOUR TIMES, twice within Phase 193.2 alone**, and the pattern it documents about itself held again: the `32 / 17 / 1447` was accurate at 193.2's close and was stale the moment Phase 194 opened. Phase list gains `194`. **G-5 FIRES (18 phases — this file is now the hottest backend module on this ledger by phase count) and was honoured BY CONSTRUCTION for the second consecutive phase, no override.** ⚠ **A G-5 override was OFFERED AND DECLINED for the FOURTH CONSECUTIVE PHASE (193, 193.1, 193.2, 194); `.planning/STATE.md` records NO guardrail override for Phase 194, and that absence was VERIFIED rather than assumed — it is a measurement, not an omission.** **The measured reason, a test rather than an argument:** `194-06` added **`cancel_phase` and `cancel_active_phases`** — two phase-status writers into a module that **already owned every `workflow_phases` writer in the tree** (`start_phase`, `complete_phase`, `fail_phase`, `skip_phase`, `record_phase_not_sent`). *A sixth and seventh writer of a status column the file already owns five writers for is not a second concern.* The change is **+136 / −1** across the whole phase, and the single deleted line is `finish_run`'s docstring first line — **corrected BESIDE its original, which is quoted verbatim inside the new docstring** (`194-06`), because it read *"(`completed` / `failed`)"* while two shipped callers had been passing `cancelled` for a year and a reader who trusted it drew exactly the wrong conclusion. **The invariants that now bind this file:** `cancel_phase` is **PHASE-KEYED** (`WHERE id = $1`) and `cancel_active_phases` is **RUN-KEYED with `AND status = 'active'`** — that clause is the only thing standing between the writer and a bulk terminalize of every phase on the run, it is fenced by `194-09`'s F-5 against a real widened-predicate plant, and **`194-13` watched it hold on LIVE data in both directions** (a `completed` phase and two `pending` phases survived a real heal untouched); the vocabulary is **`cancelled` and never `failed`/`skipped`** (D-04 — the phase did not fail and was not skipped, it ran and was interrupted), fenced by `194-09`'s F-6 over the composed VALUE rather than the module source, with the expected slug **derived** as migration 119's literals minus 115's; and ⚠ **`finish_run` WRITES NO `workflow_phases` ROW AND MUST NOT LEARN TO** — it is called on the `completed` success arm and by the delete cascade, so a phase write there would change behaviour on paths Phase 194 must not touch. **Per G-5 the next phase adding a genuinely second concern here owes a refactor recommendation FIRST; the natural seam is unchanged — the three list feeds versus the single-definition read, versus the publish-flip, versus the run CRUD, versus (now) the seven phase-status writers. It inherits `34 / 18 / 1582`.**

---

## `backend/app/services/harness/publish_service.py`

**Re-derived 2026-08-17 (extraction):** `19 commits / 7 phases / 1243 L` · **G-5 FIRES** (7 phases vs threshold 3) — honoured by construction (193.2).

### Phases touched (verbatim)

102 (×7) / 163 / 182 (×4) / 186 / 189 / 190 / **193.2 (193.2-06 `939b5c9f`)**, **plus the quick task `260809-klo`** (`3781a3fe`) — **17 commits across 7 phases**, **1047 → 1158 lines**. ⚠ **ADDED 2026-08-15 by plan `193.2-10`. THIS FILE WAS ABSENT FROM THIS TABLE UNTIL PHASE 193.2. Seven phases touched it and G-5 never fired once, because the discuss-phase audit scans PLAN.md `files_modified` *against this table*. A hot file missing from the table is permanently invisible to its own guardrail** — the same failure as the row above and as the three rows it names. ⚠ **The phase count is 7, not the 8 the raw recipe returns**, and the eighth bucket is `quick` (from `fix(quick-260809-klo)`), a QUICK TASK and not a phase — counted OUT here exactly as the `WorkflowBuilderPage.tsx` row already documents about its own recipe. ⚠ Corrections on measurement: `193.2-CONTEXT.md` D-01 and `193.2-BASELINE.md` §5 both read `16 / 6 / 1047`; both moved on this phase's commit. Re-derive with: `git log --oneline -- backend/app/services/harness/publish_service.py | wc -l` → 17; `git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' | sort -u` → `102 163 182 186 189 190 193.2 quick`; `wc -l <file>` → 1158; `git show c1a6c122:<file> | wc -l` → 1047.

### G-5 status (verbatim)

**G-5 FIRES ON THE COUNT (7 phases) — honoured BY CONSTRUCTION, no override.** **The measured reason:** `_interactive_phase_failures` **already composed this exact message** before 193.2 — two identical string literals, one per arm, at `:527-528` and `:537-538` of the pre-change file. The phase changed **the WORDS**, not the existence of the composition. Proved rather than asserted: `git diff -U0` reports every hunk at **line 501 or beyond**, i.e. inside the helper, so **stage 2.5 (`:190-208`) and `_block` (`:434-468`) are byte-untouched** — no check added, removed or weakened, no stage added, no control flow moved, the `continue`/`break` loop shape and the returned `{phase, message}` keys preserved. **The invariants that now bind this file:** the refusal's **two arms share no COMPLETE SENTENCE and cannot be collapsed** (arm 1 is about the STEP — *remove it*; arm 2 about a step's FAILURE ROUTE — *change it*) — ⚠ **a fence asserting only `a != b` would have passed a real plant that changed arm 2's second sentence to arm 1's while leaving the strings unequal; the shared-sentence clause is the one that fired, and it was driven RED to prove it**; **no internal identifier, slug or step number reaches the copy** (the retired message named `llm_human_input` and `ask_user` at a person who can see neither word on the canvas — the `BUG-260809-02` failure class), and F-3 is scoped over the **composed message VALUE, never the module source**, because this file's own docblocks legitimately quote both identifiers; **the model-authored phase label is clamped and single-lined by `_clean_label` / `_LABEL_MAX_CHARS = 72` before it enters user copy, an aria label and a PERSISTED audit row** — XSS is not the threat here, length and honesty are, and a 10 KB name would otherwise have produced a 10 KB refusal; an empty label degrades to a **name-free TRUE sentence, never a bare slug**; no branch may imply the gate is exhaustive over *"steps that involve a person"*, because it is not. ⚠ **THE GATE STAYS, AND WIDENING IT IS NOT MERELY OUT OF SCOPE — IT IS FORBIDDEN BY A SHIPPED FENCE.** `test_the_armed_checkpoint_is_not_a_validator` (`:898-936`) asserts `_interactive_phase_failures(armed) == []` and its docblock records that extending the helper to name armed phases is **CONFLICT-1 Option B, REJECTED** — it would make every `external_action` workflow unpublishable. Measured beside it and worth not re-deriving: an unrefused `external_action` **cannot wedge a publish** (auto-continued at `harness_engine.py:837`; the send skipped at `phase_types.py` GATE 1), so `SEED-164`'s *"always asks approval"* is true of a LIVE run and misleading as a publish-path claim. **Per G-5 the next phase adding a genuinely second concern owes a refactor recommendation FIRST; the natural next seam is the eight gauntlet stages versus the judge invocation versus the receipt writers. It inherits `17 / 7 / 1158`.** ⚠ **RE-DERIVED HOURS LATER AT PHASE 193.2's ACTUAL CLOSE (2026-08-15, after the code-review fix pass): `17 / 7 / 1158` → `19 commits / 7 phases / 1243 L`** — recorded beside, not over; stale on the same day it was written. **The two extra commits are WR-05 and WR-06, and WR-05 discharged a deferral this row's own phase had recorded as OWED.** ⚠ **AN INVARIANT WAS ADDED BY THAT FIX AND IT BINDS ANYONE EDITING THE STAGE-2.5 COMMENT: the sentence *"The full background-job publish that COULD validate interactive phases is the deferred Phase-103 rework"* is now QUOTED VERBATIM AS SUPERSEDED rather than deleted** — *a deferral that lives only in a deleted comment is exactly as invisible as one that was never written* — with the capability it names routed to `SEED-164`. ⚠ **And the fix recorded a second instance of this project's "a copy a machine cannot find is not a copy" lesson:** as shipped, that sentence was **split across two lines**, so a line-oriented `grep` for the phrase returned **NOTHING and read as "already fixed"**; it is now quoted **on one line on purpose**. (The first instance was `193.2-08`, where a verbatim rule written WRAPPED failed its own literal `grep -q`.) It inherits `19 / 7 / 1243`.

---

### Phase 196 (plan `196-02`) — one consumer rewired, and the gauntlet deliberately NOT extended

**RE-DERIVED 2026-08-18 by plan `196-09`: `20 commits / 8 phases / 1250 L`** (`CLAUDE.md`'s row read
`19 / 7 / 1243`; the raw recipe's 9th bucket is `quick`, a quick task, counted OUT exactly as this section
already documents about itself). Phase list gains `196`.

**What 196 did — ONE consumer, and it closes a critical bug.** `_judge_golden_output` (the gauntlet's
**hard wall**) resolved its judge model from `app.config.settings`, the **env-backed** pydantic singleton,
which is `None` on every box in this project. `BUG-260731-01` measured the consequence: the operator's
`app_settings.harness_judge_model` was ignored and every publish was graded by the hardcoded fallback
`claude-opus-4-8` — *a setting that fails in the expensive direction, silently, behind a gate.* This file's
consumer now resolves through `await load_app_settings_async()`, the DB-backed `UserEffectiveSettings` the
rest of the app uses.

⚠ **`resolve_judge_model`'s body, signature and resolution order are UNCHANGED — the defect lived entirely in
what the four consumers handed it.** It reads `getattr(settings, "harness_judge_model", None)`, which is
duck-typed and therefore accepts **either** settings object without complaint; that is what made passing the
wrong one silent by construction, and it is why the fix is at the call sites rather than in the resolver.

⚠ **THE LIVE CONSEQUENCE, NAMED HERE RATHER THAN DISCOVERED LATER: the publish-gauntlet judge on the
operator's box is now `deepseek-v4-pro`, not `claude-opus-4-8`.** That is the fix working. It is also a real
behaviour change on a gate, and it is owed a real publish shot — UAT row **U-B1**, not claimable from a unit
test.

**Why G-5 is honoured rather than triggered:** the change is **one expression on one existing call site**
inside a helper this file already owned. The 8-stage gauntlet gains no stage, its doubly-documented ordering
is untouched, and `_block` and stage 2.5 are byte-unchanged. ⚠ **`196-06` explicitly DECLINED to add an
eighth stage here for the unregistered-model gap** — a genuine second concern added to a doubly-documented
ordering, to catch a population measured at **zero of 257 stored phases**, while D-10's run-time check already
covers the dangerous half for every path. That decline is recorded with a mechanical re-open trigger in
**`SEED-176`**, not left as an omission.

**Per G-5 the next phase adding a genuinely second concern here owes a refactor recommendation FIRST; it
inherits `20 / 8 / 1250`.**

---

## `backend/app/services/workflow_authoring.py`

**Re-derived 2026-08-17 (extraction):** `12 commits / 6 phases / 572 L` · **G-5 FIRES** (6 phases vs threshold 3) — honoured by construction (193.2).

### Phases touched (verbatim)

103 / 165 / 182 / 187 / 189 / **193.2 (193.2-05 `0e203d64`, 193.2-07 `0cb3faf4`)** — **11 commits across 6 phases**, **389 → 540 lines**. ⚠ **ADDED 2026-08-15 by plan `193.2-10`. THIS FILE WAS ABSENT FROM THIS TABLE UNTIL PHASE 193.2. Six phases touched it and G-5 never fired once, because the discuss-phase audit scans PLAN.md `files_modified` *against this table*. A hot file missing from the table is permanently invisible to its own guardrail.** ⚠ **ZERO quick-task buckets — the recipe returns exactly six and all six are phases.** ⚠ **This cell's figures went stale TWICE INSIDE ONE PHASE and both corrections are stated beside their originals:** `193.2-CONTEXT.md` D-01 and `193.2-BASELINE.md` §5 measured `9 / 5 / 389`; `193.2-05-SUMMARY.md` recorded `9 / 5 / 389` and it *"was already stale by two commits and 151 lines"* when `193.2-07` read it; `193.2-07-SUMMARY.md` then measured `11 / 6 / 540`, which is what HEAD still reads. *A figure written at a plan's close goes stale on the next commit that touches the file.* Re-derive with: `git log --oneline -- backend/app/services/workflow_authoring.py | wc -l` → 11; `git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' | sort -u` → `103 165 182 187 189 193.2`; `wc -l <file>` → 540; `git show c1a6c122:<file> | wc -l` → 389.

### G-5 status (verbatim)

**G-5 FIRES ON THE COUNT (6 phases) — honoured BY CONSTRUCTION, no override.** **The measured reason:** `AUTHORING_SYSTEM_PROMPT` already carried a rule labelled *"CRITICAL — a wrong choice makes the workflow unpublishable"*, and 193.2 appended **ONE clause** to that same rule about another composition with the same consequence; the prompt already named the definition-level fields to set in one sentence, and **ONE field** (`business_requirement`) joined that same sentence; the file already owned the 187 `name_seeded_by_ai` stamp, and the requirement stamp is its **sibling on the same success path**. Proved rather than asserted: a line-by-line `difflib` over the **rendered prompt** returns **exactly three changed lines** across the whole constant, `new_block[:len(old_block)] == old_block` is `True` (a pure APPEND — the `CRITICAL` label line and the shipped template clause are byte-identical), and the model/stamp work landed at **0 deletions**. **The invariants that now bind this file:** ⚠ **the prompt-bullet LENGTH DISCIPLINE IS NOW MECHANICAL (F-8) where it had been prose since Phase 189 and guarded by nothing** — every phase-type bullet must sit within the module's own 104-char precedent, lengths **derived at runtime**, the bullet block located by SHAPE and its identity then proved against `WF_SCHEMA`'s seven `phase_type` consts rather than a hand-typed list, with a permanent inline 200-char plant; the `llm_human_input` bullet went **121 → 74** and what made it a nudge was its **TAIL** (*"— use for any 'confirm before finalizing' step"*, an active invitation to the ONE phase type the publish gate categorically refuses), not only its length; **the prompt may promise no unscheduled capability** — `planned` / `coming soon` / `deferred` / `future release` are absent case-insensitively and driven RED against a plausible plant, because `SEED-164` exists precisely because a docblock calling something *"the DEFERRED Phase-103 rework"* read like a plan for a year; **the provenance stamp is server-side, after validation, on the single success path, refuses an empty value AND refuses a normalised copy of `describe`**, and it **ignores the model's own claim in both directions** — genuinely reachable rather than hypothetical, because `WF_SCHEMA = WorkflowDefinition.model_json_schema()` now advertises the flag to the model; `_normalised_for_copy_check` **is not a similarity metric and must never become one**. ⚠ **`grounding.py` was DELIBERATELY NOT EDITED, and that is load-bearing rather than tidy** — one home per concern (*"the rule states the policy, the grounding states the FACTS the policy reads"*, `grounding.py:605-607`), so the 193.1 D-26 arms sit on an unchanged input and the two fixes stay independently attributable when re-driven; it is the only reason `193.2-FREQUENCY.md`'s SC#4 control is a valid control at all. ⚠ **Any claim about what this prompt DOES is a frequency claim (D-08): measured `business_requirement` 20/20 and `llm_human_input` 0/20 against a pre-fix 0/N and 2/2-with-a-template — a REDUCTION, NEVER AN ABSENCE**, which is why the publish gate stays. **Per G-5 the next phase adding a genuinely second concern owes a refactor recommendation FIRST; the natural next seam is the prompt literal versus the emit orchestration versus the post-validate stamps. It inherits `11 / 6 / 540`.** ⚠ **RE-DERIVED HOURS LATER AT PHASE 193.2's ACTUAL CLOSE (2026-08-15, after the code-review fix pass): `11 / 6 / 540` → `12 commits / 6 phases / 572 L`** — recorded beside, not over. **This is the THIRD time this one cell has been corrected, and the second time WITHIN A SINGLE PHASE** (`9 / 5 / 389` at discuss and in `193.2-05`'s summary → `11 / 6 / 540` at `193.2-07` → `12 / 6 / 572` after WR-06). The extra commit is WR-06, which **corrected the docblock's credit for the describe-copy check beside the original rather than over it**. The phase count is unmoved at 6. It inherits `12 / 6 / 572`.

---

## `backend/app/models/harness.py`

**Re-derived 2026-08-17 (extraction):** `17 commits / 16 phases / 611 L` · **G-5 FIRES** (16 phases vs threshold 3) — honoured by construction (193.2).

### Phases touched (verbatim)

090 / 091 / 093 / 098 / 099 / 100 / 101 / 101.1 / 102 / 103 / 143 / 185 / 187 / 189 / 190 / **193.2 (193.2-07 `efab299c`)** — **17 commits across 16 phases**, **578 → 611 lines**. ⚠ **ADDED 2026-08-15 by plan `193.2-10`, and it was DISCOVERED BY RESEARCH, NOT BY THE TABLE — which is the point. THIS FILE WAS ABSENT FROM THIS TABLE UNTIL PHASE 193.2. Sixteen phases touched it and G-5 never fired once, because the discuss-phase audit scans PLAN.md `files_modified` *against this table*. A hot file missing from the table is permanently invisible to its own guardrail.** ⚠ **`193.2-CONTEXT.md` D-01's own six-file table does not list it at all** — the phase's discuss step enumerated six hot files and this was a seventh; `193.2-RESEARCH.md` found it, `193.2-BASELINE.md` §5 confirmed the figure exactly (`16 / 15 / 578`), and `193.2-07` then moved all three. ⚠ **ZERO quick-task buckets.** Re-derive with: `git log --oneline -- backend/app/models/harness.py | wc -l` → 17; `git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' | sort -u` → the sixteen phases above; `wc -l <file>` → 611; `git show c1a6c122:<file> | wc -l` → 578.

### G-5 status (verbatim)

**G-5 FIRES ON THE COUNT (16 phases — the third-hottest file on this ledger) — honoured BY CONSTRUCTION, no override.** **The measured reason:** `WorkflowDefinition` already carried **`business_requirement`** (`:538`), and the new flag is declared **immediately after the field it describes**; the file already carried **an AI-provenance boolean** in `PhaseSpec.name_seeded_by_ai` (`:435`) with the same spelling and the same stamped-server-side rule, and this is its definition-level sibling; the file already carried **four additive-optional zero-migration locks** and this is a fifth with the identical argument. Proved rather than asserted: **33 insertions / 0 DELETIONS** — `_StrictBase`, every `required` list, every other field and both shipped `WorkflowDefinition` validators are byte-untouched, and a modification would have produced a deleted line. **The invariants that now bind this file:** **additive-optional, zero-migration growth ONLY** — `definition` is a JSONB column, so a row persisted before the commit `model_validate()`s clean and reads `False`; there is no column to add, no default to backfill, no constraint to alter, and `ls supabase/migrations/ | wc -l` reads **112 before and after**; **`extra="forbid"` is NOT relaxed**, proved by a probe in which an unknown key still raises `extra_forbidden`, so every other unknown key still fails loudly; the annotation is a plain `bool` with a `False` default and **never `bool | None`**, so absence has ONE spelling (D-185-08); and ⚠ **NO DERIVATION MAY LIVE IN THIS MODEL** — the save path persists `model_dump(mode="json")`, so a derivation would be **baked into the JSONB and a stale row could then lie about itself**; the file records that trap by name at `:424-434` and the new field's comment points back at it. ⚠ **A consequence discovered by measurement rather than anticipated:** because `WF_SCHEMA` is `WorkflowDefinition.model_json_schema()`, adding a field means **the emit tool now ADVERTISES it to the model** — which is why the payload-laundering rule is a reachable requirement rather than a hypothetical one, and both directions are pinned and each was driven RED (one of the plants failed **exactly one case out of thirty-three**, which is the only evidence that the second adversarial direction is not redundant). **Per G-5 the next phase adding a genuinely second concern owes a refactor recommendation FIRST; the natural next seam is the phase-config union versus the definition schema versus the run and receipt models. It inherits `17 / 16 / 611`.**

---

## `frontend/src/components/workflows/builderStore.ts`

**Re-derived 2026-08-17 (extraction):** `11 commits / 5 phases / 837 L` · quick-task buckets excluded: `260809` · **G-5 FIRES** (5 phases vs threshold 3) — honoured by construction (193.2).

### Phases touched (verbatim)

184 / 185 / 186 / 193 / **193.2 (193.2-09 `cbeabcc9`)**, **plus the quick task `260809-klo`** (`da668c96`) — **11 commits across 5 phases**, **785 → 837 lines**. ⚠ **ADDED 2026-08-15 by plan `193.2-10`, and it is the FIFTH absent file this one phase found where D-03 anticipated three. THIS FILE WAS ABSENT FROM THIS TABLE UNTIL PHASE 193.2. Five phases touched it and G-5 never fired once, because the discuss-phase audit scans PLAN.md `files_modified` *against this table*. A hot file missing from the table is permanently invisible to its own guardrail.** ⚠ **It appears in NO prior artifact of this phase** — not in `193.2-CONTEXT.md` D-01's six-file table, not in `193.2-RESEARCH.md`'s four-row list, not in `193.2-BASELINE.md` §5's seven triples. **`193.2-09` found it while re-deriving the figures for a file that WAS on the table**, which is the only reason it is here at all — and is the sharpest available demonstration that the audit cannot see what is absent from its list. ⚠ **THE PHASE COUNT IS 5, NOT THE 6 THE RAW RECIPE RETURNS, AND THIS WAS A DISPUTED FIGURE RESOLVED BY MEASUREMENT:** the sixth bucket is `260809`, from `feat(260809-klo)` — a QUICK TASK, not a phase. `193.2-09-SUMMARY.md` read **5**; the close-out brief's recipe returned **6**; the recipe was re-run at HEAD and the sixth bucket inspected commit-by-commit, and **the 5 is correct while the 6 is what the command prints**. Both are recorded, the loser beside the winner, exactly as the `WorkflowBuilderPage.tsx` row already documents about the identical trap. Re-derive with: `git log --oneline -- frontend/src/components/workflows/builderStore.ts | wc -l` → 11; `git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' | sort -u` → `184 185 186 193 193.2 260809`, of which `260809` is a quick task; `wc -l <file>` → 837; `git show c1a6c122:<file> | wc -l` → 785.

### G-5 status (verbatim)

**G-5 FIRES ON THE COUNT (5 phases against a threshold of 3) — honoured BY CONSTRUCTION, no override.** **The measured reason:** the store already owns the **`meta`-write concern** with three structural siblings (`setProjectFolder`, `setBusinessRequirement`, `setTemplateAsset`), and 193.2 added **one more key inside one of them**. The whole change is **+53 / −1**, and the single deleted line is the one-line `set(...)` that the multi-line one replaces; the shipped quick-260809-klo docblock is **byte-untouched**, with the new section prepended above it under an explicit *"everything below is the quick-260809-klo docblock, unedited"* divider so the two stay independently attributable. **The invariants that now bind this file:** the requirement's text and its provenance flag are written in **ONE `set()`** with `dirty` in the same write — the shape this store already keeps three times; the mark is **cleared on ANY edit**, with **no client-side *"is this still the AI's sentence?"* comparison, no trim, no empty-check, no null-coercion and no debounce** — a comparison would be a second copy of a server predicate, and a worse one, because the server holds no such predicate to be a copy OF; and the flag is written as an explicit **`false`, never `delete`** — the two are not interchangeable here, because `WorkflowDefinition` DECLARES the field as `bool = False` (no `| None`), so there is no round-trip identity to protect and what `false` buys is **EVIDENCE**: the demotion is directly observable on the PATCH body, where an absent key is indistinguishable from a store that never wrote the field at all. ⚠ **That last claim is not rhetoric — a real plant substituting the `delete` strategy reds the exact assertion**, and a separate plant narrowing `selectDefinition` to drop the index-signature key reds the wire round-trip case with `expected undefined to be true`. ⚠ **The honest whitespace consequence is in the comment rather than smoothed away:** editing a seeded value down to `"   "` clears the flag and leaves a whitespace value — correct on both halves, and today's behaviour unchanged. **Per G-5 the next phase adding a genuinely second concern owes a refactor recommendation FIRST; the natural next seam is the canvas/undo (zundo) slice versus the `meta`-write slice versus the save-state slot. It inherits `11 / 5 / 837`.**

---

## `frontend/src/components/panel/WorkspacePanel.tsx`

**Re-derived 2026-08-17 (extraction):** `16 commits / 10 phases / 646 L` · **G-5 FIRES** (10 phases vs threshold 3) — honoured by construction (194 / 194.1).

### Phases touched (verbatim)

087 / 088 / 094 / 095.1 / 100 / 124 / 155 / 188 / **194 (194-03 `580d3f60`)** — **14 commits across 9 phases**, **493 → 580 lines**. ⚠ **ZERO quick-task buckets:** the standard `sed` recipe returns exactly nine and all nine are real phases. ⚠ **ADDED 2026-08-16 by plan `194-13`. THIS FILE WAS ABSENT FROM THIS TABLE UNTIL PHASE 194. Eight phases touched it before this one and G-5 never fired once, because the discuss-phase audit scans PLAN.md `files_modified` *against this table*. A hot file missing from the table is permanently invisible to its own guardrail** — the identical failure `WorkflowsPage.tsx` suffered for ten phases, `WorkflowDoorSwitch.tsx` for six, `WorkflowBuilderPage.tsx` for ten and `db/workflows.py` for seventeen, **and that sentence is the reason this row exists and must survive future edits.** ⚠ **ONE CORRECTION ON MEASUREMENT AGAINST THIS PHASE'S OWN CONTEXT, and it is the reason the row was nearly missed again: `194-CONTEXT.md` D-01 states that this filename and `RunCard.tsx` *"occur only inside other rows' prose"*. THAT IS FALSE — `grep -o "WorkspacePanel.tsx" CLAUDE.md | wc -l` returned **0** before this row existed, and 0 for `RunCard.tsx` too. Neither name appeared in `CLAUDE.md` AT ALL.** *"Present but only in prose"* and *"absent entirely"* are different diagnoses with different fixes, and the wrong one would have had someone searching for a mention that was never there. D-01 also measured `13 / ~8` at discuss time; both figures have moved. Re-derive with: `git log --oneline -- frontend/src/components/panel/WorkspacePanel.tsx | wc -l` → 14; `git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' | sort -u` → `087 088 094 095.1 100 124 155 188 194`; `wc -l <file>` → 580; `git show 743965a1:<file> | wc -l` → 493.

### G-5 status (verbatim)

**G-5 FIRES ON THE COUNT (9 phases against a threshold of 3) — honoured BY CONSTRUCTION, no override. A G-5 override was OFFERED AND DECLINED for the FOURTH CONSECUTIVE PHASE (193, 193.1, 193.2, 194), and `.planning/STATE.md` records NO guardrail override for Phase 194 — VERIFIED at this commit rather than assumed, so that absence is a measurement.** **The measured reason, which is a test rather than an argument — five figures, each of which a second concern would have moved:** `useState[(<]` call sites **4 → 4** · `useEffect(` **3 → 3** · `fetch(` **0 → 0** · props on `WorkspacePanelProps` **5 → 5** · deleted lines in the file **1**, and that one line is `import { PanelRightClose, X } from "lucide-react"` re-added with `Square`. **The panel gained a CONTROL, not state ownership** — D-01's own stated STOP condition was *"if planning finds the Stop requires new state ownership in either file, that is a SECOND concern and the refactor recommendation is owed FIRST"*, and the measurement is what discharges it. **The invariants that now bind this file:** exactly ONE `data-testid="panel-stop-run"` node; the Stop calls **`stopThread(threadId)`** and **NOTHING here reads `workflowLock?.runId` or calls `cancelRun(` directly** (`grep -cE "workflowLock\??\.runId|cancelRun\("` → **0**) — that is D-08's *"four mounts, ONE mechanism"* held mechanically rather than by discipline, and it matters because `WorkflowLock.runId` carries **two id types** while its own JSDoc asserts only one; and the file's `:161-165` comment is the place Phase 188 recorded that two-id finding **and where it then sat invisible to Phase 194 until re-derived** — *a measurement that lives in one file's comment is invisible to the next phase*, which is why 194-11 copied it into `api/runs.py`'s route header as well. ⚠ **TWO PENDING PLANS WILL MOVE THESE FIGURES, AND THE NEXT EDITOR IS TOLD SO RATHER THAN LEFT TO DISCOVER IT: plans `194-05` and `194-07` had NOT run when this row was written, and `194-05`'s `files_modified` includes `CLAUDE.md` with the explicit must-have that this file and `RunCard.tsx` become ledger rows. Whoever lands `194-05` must UPDATE this row, never add a second one for the same file.** ⚠ **`RunCard.tsx` DELIBERATELY HAS NO ROW YET, and the reason is a measurement rather than an oversight:** `git log --oneline 743965a1..HEAD -- frontend/src/components/chat/RunCard.tsx` is **EMPTY** — Phase 194 has not touched it, and `194-13`'s non-goals forbid adding a ledger row for a file the phase did not touch. Its measured triple is **`20 commits / 8 phases / 550 L`** (the raw recipe prints 9 buckets; the 9th is `streaming`, an untagged 075.x fix/revert pair, not a phase) and it is carried in `194-HEAL-RECEIPT.md` § *Ledger* so it is not lost. **`194-07` is the plan that will touch it, and `194-05` owes its row.** **Per G-5 the next phase adding a genuinely second concern here owes a refactor recommendation FIRST; the natural seam is named rather than implied — the panel shell/collapse/mobile chrome versus the file+diff viewer versus the `ask_user` interrupt versus the run-soul read versus the phase spine. It inherits `14 / 9 / 580`.** ⚠ **RE-DERIVED AT `3b22a6c3` BY PLAN `194-05` — the plan this cell's own text names as owing the update, and the update is an UPDATE rather than a second row, exactly as instructed. THE TRIPLE IS UNMOVED: `14 / 9 / 580`.** Re-run at that commit: `git log --oneline -- <file> | wc -l` → 14; the `sed` bucket recipe → `087 088 094 095.1 100 124 155 188 194`; `wc -l <file>` → 580. **A non-move is recorded here for the same reason the `WorkflowCard.tsx` row records one: a reader who finds no `194-05` entry should be able to tell *"checked, unmoved"* from *"nobody checked"*.** ⚠ **AND THE CLAUSE ABOVE THAT SAYS `RunCard.tsx` *"DELIBERATELY HAS NO ROW YET"* IS NOW SUPERSEDED — KEPT VISIBLE RATHER THAN DELETED, because a deferral that lives only in a deleted sentence is exactly as invisible as one never written (193.2 WR-05). `194-05` added the `RunCard.tsx` row at the BOTTOM of this table. It did so on the G-5 COUNT (8 phases), NOT on a Phase-194 edit: `git log --oneline 743965a1..HEAD -- frontend/src/components/chat/RunCard.tsx` was STILL EMPTY at `3b22a6c3`, so `194-13`'s measurement stands unrefuted and the new row makes no honoured-by-construction claim.** Its measured triple is unchanged at **`20 / 8 / 550`**, and plan `194-07` — which declares that file in its `files_modified` — was executing on the same working tree at the time and will stale it. ⚠ **RE-DERIVED AT PHASE 194.1's CLOSE (2026-08-16, plan `194.1-08`, at `14283ba8`): `14 / 9 / 580` IS STALE AND THE CORRECTED TRIPLE IS `16 commits / 10 phases / 646 L` — recorded BESIDE the previous value, never over it. This row has now been re-derived three times (194-13, 194-05, 194.1-08) and moved on the third.** Phase list gains `194.1`; **ZERO quick-task buckets — the recipe returns exactly ten and all ten are real phases.** Re-derive with: `git log --oneline -- frontend/src/components/panel/WorkspacePanel.tsx | wc -l` → 16; the `sed` bucket recipe → `087 088 094 095.1 100 124 155 188 194 194.1`; `wc -l <f>` → 646; `git show a9e7d10c:<f> | wc -l` → 580. **G-5 FIRES (10 phases) and was honoured BY CONSTRUCTION for the second consecutive phase, no override — `.planning/STATE.md` records `Phase 194.1 — NONE`, verified at this commit rather than assumed.** **The measured reason, the same test this cell already uses: `useState[(<]` 4 → 4 · `useEffect(` 3 → 3 · `fetch(` 0 → 0 · props 5 → 5 · `stopThread(` 0 → 0** (`194.1-05-SUMMARY.md`). **The panel gained a CONTROL and a BOOLEAN, not state ownership** — one `<StopControl variant="panel">` replacing a hand-rolled button, and one new derived flag. ⚠ **THE DESIGN DECISION THAT MADE THAT POSSIBLE IS D-25 AND IT IS LOAD-BEARING: `showTimeline` IS BYTE-UNCHANGED.** `BUG-260816-01` is that a **finished** run still offered a Stop that did nothing; the obvious fix — narrowing `showTimeline` — would have **regressed the Phase-098 UAT run-honesty fix B**, because its `|| phases.length > 0` disjunct is exactly what keeps a finished run's timeline on screen. So **two consumers of one boolean became two booleans**: `showTimeline = isHarness || phases.length > 0` (`:380`, untouched) still gates the run soul, the run receipt, the timeline and `showBatchResults`, while the new `showStopRow = isHarness && threadId != null` (`:407`) gates only the control. ⚠ **The regression was not avoided by care — it was MEASURED: plant P1 narrowed `showTimeline` itself, and the no-Stop half of the very same test case STAYED GREEN while the timeline half red.** A single-assertion version of that case would have shipped the regression, which is the whole argument for asserting both halves in one case. **The invariants that now bind this file:** the Stop row gates on `isHarness`, whose lock invariant (`streamsStore.ts`, *a thread holds a lock **iff a non-terminal** Harness run owns its anchor*) is cleared on **every** terminal route — so a dead control is impossible by construction rather than by a status list this file would have to maintain; `showTimeline` and `showBatchResults` stay byte-identical and P2 reds against gating the row on them; **exactly one `<StopControl` mount and zero `stopThread(` call sites** (the dispatch lives inside the shared component); and ⚠ **NEITHER `cancelRun(` NOR the lock's id field may be SPELLED anywhere in this file, INCLUDING in the prose explaining their absence** — this module's own `WorkspacePanel.test.tsx` **F-1 / V-05** fence sweeps the RAW, un-stripped source of every production module under `panel/`, `chat/` and `workflows/`, and Phase 194.1 tripped it twice on docblocks that merely discussed the rules (`194.1-04` deviation 3 — the shipped fence's header states the remedy: write the call without its parenthesis, name the id field by role). ⚠ **`Stop all` is byte-untouched by decision** — a bulk control over N threads is not a per-thread mount, and the rows answer for it. ⚠ **The count-gate pin on `WorkspacePanel.test.tsx` was found STALE BY TWELVE before this phase added a case** (pin 41 against an actual of 53 — the gate was satisfied the whole time because its contract is *no DECREASE*, not equality) and now reads **58**; a reader who takes `58 − 41` as this phase's case count is wrong by more than double. *A pin is a floor, never a census.* **Per G-5 the next phase adding a genuinely second concern owes a refactor recommendation FIRST; the seam is unchanged — the panel shell/collapse/mobile chrome versus the file+diff viewer versus the `ask_user` interrupt versus the run-soul read versus the phase spine. It inherits `16 / 10 / 646`.**

---

## `backend/app/services/run_lifecycle.py`

**Re-derived 2026-08-17 (extraction):** `6 commits / 3 phases / 459 L` · **G-5 FIRES** (3 phases vs threshold 3) — at threshold — honoured by construction (194).

### Phases touched (verbatim)

145 / 147 / **194 (194-09 `e306e55b`)** — **4 commits across 3 phases**, **299 → 437 lines**. ⚠ **ZERO quick-task buckets:** the standard `sed` recipe returns exactly three and all three are real phases, unlike `WorkflowBuilderPage.tsx` / `api/workflows.py` / `publish_service.py`, whose recipes return `260809` / `260814` / `quick` alongside the phases. *A reader who finds no subtraction paragraph here should be able to tell "checked, none exist" from "nobody checked".* ⚠ **ADDED 2026-08-16 by plan `194-13`. THIS FILE WAS ABSENT FROM THIS TABLE UNTIL PHASE 194** — and it is the one row on this ledger added at the exact commit its count *reaches* the threshold, which is the only way a file ever gets onto a guardrail's list before the guardrail has already failed on it eight times. Re-derive with: `git log --oneline -- backend/app/services/run_lifecycle.py | wc -l` → 4; `git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' | sort -u` → `145 147 194`; `wc -l <file>` → 437; `git show 743965a1:<file> | wc -l` → 299.

### G-5 status (verbatim)

**G-5 FIRES AT EXACTLY THE THRESHOLD, and BOTH readings are stated so neither can be quoted as the other: TWO phases had touched this file when Phase 194 was scoped (below ≥3 — G-5 did NOT fire then), and THREE have touched it including 194 (at the threshold — G-5 fires from here on).** Honoured BY CONSTRUCTION either way, no override. **The measured reason, a test rather than an argument:** `194-09` added **one composition of two writes the file's own neighbour already performed** — `delete_workflow_cascade` (`api/workflows.py:1494-1518`) has composed exactly `finish_run` + the phase terminalize since Phase 152, **in the wrong file**; 194 MOVED that composition here rather than copying it. **138 insertions / 0 DELETIONS**, and zero deletions is what proves no shipped arm moved. **The invariants that now bind this file, and two of them are unusual enough to be worth reading before editing:** (1) **`cancel_workflow_run_internals` NEVER RAISES** — best-effort by contract (D-062-13), because "Postgres `runs.status` is the durable cancel record" and a workflow-side failure must never turn a successful Stop into an error; ⚠ **the direct consequence is that a clean return PROVES NOTHING, and any caller or receipt verifying this writer must RE-READ the row** (`194-13` did exactly that on live data, with a `WARNING`/`ERROR` log handler attached: 0 records captured). (2) **THE APP-SHUTDOWN GATE'S IDENTIFIER IS SPELLED NOWHERE IN THIS MODULE, INCLUDING IN THE PROSE EXPLAINING ITS ABSENCE** — a raw grep must count **ZERO**, so any occurrence at all means the gate was ADDED; the three-reason argument for its absence lives in the fence's docstring at `test_run_lifecycle.py::test_step_3b_carries_no_app_shutdown_gate`, and two fences bind in opposite directions (absence here, PRESENCE in `run_producer.py`'s F2 block, each RED-driven against its own plant). ⚠ **A later editor who "tidies" that docstring will break a real needle silently** — the same discipline applies to `finish_run` / `cancel_active_phases`, written without their opening parenthesis so the needle counts CALLS, not mentions. (3) **The anchor READ is ordered BEFORE the shipped 092-03 anchor clear** — `finish_run` keys its own clear on `active_workflow_run_id = $1`, so a clear that ran first would make the row unreachable **forever**; asserted by recorded call ORDER, because against a mock the `wf_id is None` consequence does not reproduce. (4) **ONE COMPOSITION, TWO CALLERS** — Step 3b's zombie arm and `api/runs.py`'s no-live-producer arm; a third caller calls THIS, it does not re-compose the two writes. ⚠ **`194-13` drove this composition against the two historically stuck rows and it is the one arm of the phase evidenced on REAL data**: both runs `active` → `cancelled`, both thread anchors cleared in the SAME transaction (proved by byte-identical `updated_at` microseconds on the run row and its thread row), and one interrupted phase terminalized as a consequence. **Per G-5 the next phase adding a genuinely second concern here owes a refactor recommendation FIRST; the natural seam is named rather than implied — the two atomic chat co-writers (`register_run_start` / `finalize_run_terminal`) versus the three-step cancel discipline (`_cancel_run_internals`) versus the workflow-side composition. It inherits `4 / 3 / 437`.**

---

## `backend/app/api/runs.py`

**Re-derived 2026-08-17 (extraction):** `35 commits / 16 phases / 1430 L` · **G-5 FIRES** (16 phases vs threshold 3) — honoured by construction (194).

### Phases touched (verbatim)

062 / 066 / 067 / 075 / 085 / 092 / 093 / 098 / 120 / 145 / 147 / 152 / 162.5 / 163 / 189 / **194 (194-11 `903ae2cf`)** — **33 commits across 16 phases**, **1208 → 1376 lines**. ⚠ **ZERO quick-task buckets:** the recipe returns exactly sixteen and all sixteen are real phases. ⚠ **ADDED 2026-08-16 by plan `194-13`. THIS FILE WAS ABSENT FROM THIS TABLE UNTIL PHASE 194 — and it was not merely missing a row, it was not MENTIONED anywhere: `grep -o "api/runs.py" CLAUDE.md | wc -l` returned **0**. Sixteen phases touched it and G-5 never fired once, because the discuss-phase audit scans PLAN.md `files_modified` *against this table*. A hot file missing from the table is permanently invisible to its own guardrail.** Re-derive with: `git log --oneline -- backend/app/api/runs.py | wc -l` → 33; `git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' | sort -u` → the sixteen phases above; `wc -l <file>` → 1376; `git show 743965a1:<file> | wc -l` → 1208.

### G-5 status (verbatim)

**G-5 FIRES HARD — 16 phases against a threshold of 3, the second-hottest API module in the tree after `api/workflows.py`'s 17. Honoured BY CONSTRUCTION, not waived: no override was taken and `.planning/STATE.md` records none for Phase 194.** **The measured reason, a test rather than an argument:** the route gains **a SECOND ID SHAPE on a door it already owns**, not a second concern — and it is the **THIRD** route on this prefix to gain the identical dual-id fallback, after `continue_run` (`:722-756`, 092-07) and `submit_ask_user_response` (`:537-584`, 093). **No new route** (D-08 forbids one, and a second cancel route would need its own ownership gate, its own `RUN_TASKS` resolution and its own audit verb), no forked writer, no relaxed path typing, **168 insertions / 0 deletions**, and `grep -c "_cancel_run_internals("` still returns **1**. **The invariants that now bind this file, and the first is an access boundary rather than a convenience:** the fallback's **THREE clauses** — `.eq("user_id", …)` on the `workflow_runs` select, `.eq("user_id", …)` on the `threads` anchor read, and the anchor-equality check — are **the only gate**, because the workflow cluster is read further down the route through a **service-role pool that BYPASSES RLS**; each has its OWN fence and its OWN RED-driven plant (Phase 190's CR-01 was a real credential exposure that 19 plans of RED-first self-checking missed). ⚠ **A single "cross-user → 404" case CANNOT red under any of them** — measured, not predicted: on the realistic world where the run and its thread share an owner, clauses (a) and (b) each block the request alone, so one plant reported no failure while only an isolating case failed. *A clause whose only test is a world where a sibling clause also holds has never actually been tested.* **404 — NEVER 403 — on every miss** (`grep -c "HTTP_403"` over the whole module is **0**, and that count is itself a fence), with body parity asserted on `res.json()` and not only on the status. **`run_id: UUID` is NOT relaxed**, asserted on the live signature via `inspect.signature` and on the wire (`/runs/not-a-uuid` → 422). And the forward resolution's **`run_id` REBIND to the producer id** is load-bearing rather than tidy: leaving the `workflow_runs.id` bound would miss `RUN_TASKS`, take the zombie arm, update **zero** `runs` rows and still return 204 — the same silent success, moved server-side. ⚠ **`194-13` measured this route's guard LIVE and left it intact** (`DELETE /runs/{id}` with no `Authorization` → **403 `Not authenticated`**, no row written), and healed the two stuck rows through the exported composition instead **rather than forging, minting or bypassing a token** — so the HTTP layer's evidence remains `194-11`'s six production-source plants and this ledger row does not claim otherwise. **Per G-5 the next phase adding a genuinely second concern here owes a refactor recommendation FIRST; the natural seam is named rather than implied — the SSE stream/replay surface (`replay_tail_consumer`, `stream_run`) versus the three lifecycle verbs on the same prefix (`continue_run`, `submit_ask_user_response`, `cancel_run`), all three of which now carry the same dual-id fallback, which is itself the strongest available argument that they belong in one module together. It inherits `33 / 16 / 1376`.**

---

## `backend/app/services/harness_engine.py`

**Re-derived 2026-08-17 (extraction):** `46 commits / 16 phases / 2567 L` · **G-5 FIRES** (16 phases vs threshold 3) — honoured by construction (194).

### Phases touched (verbatim)

091 / 092 / 093 / 094 / 096 / 098 / 099 / 101.1 / 102 / 120 / 152 / 163 / 185 / 187 / 189 / **194 (194-10 `db9caf7e`)** — **45 commits across 16 phases**, **2494 → 2536 lines**. ⚠ **THE NON-PHASE BUCKET IS NAMED RATHER THAN MERELY SUBTRACTED: the raw recipe prints 17 buckets and the 17th is `quick`, from `fix(quick-260731-3y4): allow-list the armed approval path — close T-185-04-01`, a QUICK TASK. The PHASE count is 16. Both are recorded, the loser beside the winner** — because the next reader will run the same command and see the 17, exactly as `WorkflowBuilderPage.tsx`, `api/workflows.py`, `publish_service.py` and `builderStore.ts` each document about their own recipes. ⚠ **ADDED 2026-08-16 by plan `194-13`. THIS FILE WAS ABSENT FROM THIS TABLE UNTIL PHASE 194.** Fifteen phases touched it before this one and G-5 never fired once, because the discuss-phase audit scans PLAN.md `files_modified` *against this table*. **A hot file missing from the table is permanently invisible to its own guardrail** — and this one is the **fourth-hottest backend file measured in this repository**, after `phase_types.py` (14 phases / 35 commits at the Phase-190 reading), `db/workflows.py` (18) and `api/workflows.py` (17). ⚠ It DOES occur once in this file already — `grep -o "harness_engine.py" CLAUDE.md | wc -l` → **1** — but that occurrence is **prose inside the `publish_service.py` row** (`harness_engine.py:837`, the auto-continue line), which is precisely the *"present but only in prose"* state that a row-scanning audit cannot see. Re-derive with: `git log --oneline -- backend/app/services/harness_engine.py | wc -l` → 45; `git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' | sort -u` → the sixteen phases above **plus `quick`**; `wc -l <file>` → 2536; `git show 743965a1:<file> | wc -l` → 2494.

### G-5 status (verbatim)

**G-5 FIRES HARD (16 phases against a threshold of 3) — honoured BY CONSTRUCTION, no override; `.planning/STATE.md` records none for Phase 194.** **The measured reason, a test rather than an argument: the file gains NO second concern.** It already owns the cancel/escape arm and already performs a phase-terminalize-then-run composition **three lines below** (`fail_phase` → `finish_run`, in the `fail_run` arm); `194-10` adds **one statement of the shape the arm's neighbour already uses**, at **42 insertions / 0 DELETIONS** in exactly two hunks (`+54`, the import name; `+1645`, the statement). **The invariants that now bind this file:** the terminalize is **PHASE-KEYED on the `phase_id` bound in the same loop iteration** — never the run-keyed sibling — so it **cannot reach a completed row by construction**, and both halves of that were RED-driven independently (a run-keyed plant and a wrong-row plant red *different* clauses); it is wrapped in **`asyncio.shield` inside its OWN `try/except` + `logger.exception`**, because cancellation is already in flight and an unshielded await would be cancelled **before** it wrote; and the **bare `raise` stays the handler's LAST statement**, asserted structurally by AST and behaviourally, each driven RED by its own plant. ⚠ **THE NEW WRITE SITS INSIDE THE SHIPPED 096-09 `if not is_app_shutting_down():` SCOPE, AND THAT IS A DECISION WITH A REASON, NOT AN ACCIDENT OF PLACEMENT:** on a graceful shutdown the run stays resumable and the boot sweep re-claims it, so a phase row left `active` is **correct** — that phase really is still pending work, and terminalizing it would strand a resumable run with a dead step. ⚠ **Note this is the OPPOSITE of `run_lifecycle.py`'s answer for Step 3b, and the two are not inconsistent:** Step 3b runs when the producer task is already **gone** (no resume is coming), while this arm runs *because* the producer is being cancelled, including by the graceful shutdown about to hand the run to the boot sweep. ⚠ **`grep -c "is_app_shutting_down"` reads 4 before and 4 after, but the needle is NOT discriminating in this file** the way it was deliberately made to be in `run_lifecycle.py` — this module names the identifier in code AND in two docblocks, so the count is a **stability** check, never an absence check. Do not over-read it. **Per G-5 the next phase adding a genuinely second concern here owes a refactor recommendation FIRST; the natural seam is named rather than implied — `run_workflow`'s ~500-line phase loop versus `_run_phase_with_gates`' retry/gate machinery versus the armed-checkpoint block versus the boot-time resume sweep (`resume_stranded_workflows`): four concerns in one module. It inherits `45 / 16 / 2536`.**

---

## `frontend/src/components/chat/RunCard.tsx`

**Re-derived 2026-08-17 (extraction):** `21 commits / 9 phases / 608 L` · **G-5 FIRES** (9 phases vs threshold 3) — honoured by construction (194).

### Phases touched (verbatim)

075.7 / 075.8 / 076.1 / 076.2 / 095 / 095.1 / 128 / 155, **plus the untagged `streaming` pair** (`0dce56aa` `fix(streaming): close silence gaps in multi-iteration agent runs (075.x follow-up)` + `61e5eb1e` `revert(streaming): remove silence-gap SSE changes that caused UI regressions`) — **20 commits across 8 phases**, **550 lines**. ⚠ **THE NON-PHASE BUCKET IS NAMED RATHER THAN SILENTLY SUBTRACTED: the standard `sed` recipe prints NINE buckets and the ninth is `streaming`, which is NOT A PHASE** — it is the untagged 075.x fix/revert pair above, so the PHASE count is **8**. **Both are recorded, the loser beside the winner**, because the next reader will run the same command and see the 9 — exactly as the `WorkflowBuilderPage.tsx` row already documents about its `260809` / `260814` quick-task buckets and the `publish_service.py` row about `quick`. ⚠ **ADDED 2026-08-16 by plan `194-05`. THIS FILE WAS ABSENT FROM THIS TABLE UNTIL PHASE 194. Eight phases touched it and G-5 never fired once, because the discuss-phase audit scans PLAN.md `files_modified` *against this table*. A hot file missing from the table is permanently invisible to its own guardrail** — the identical failure `WorkflowsPage.tsx` suffered for ten phases, `WorkflowDoorSwitch.tsx` for six, `WorkflowBuilderPage.tsx` for ten and `db/workflows.py` for seventeen, **and that sentence is the reason this row exists and must survive future edits.** ⚠ **TWO CORRECTIONS ON MEASUREMENT AGAINST THIS PHASE'S OWN CONTEXT, recorded BESIDE the originals rather than over them.** (1) `194-CONTEXT.md` D-01 measures this file at *"20 commits / ~9 buckets"* — **the commit count and the raw bucket count are exact, and the PHASE count it never states is 8**, which is the only figure G-5 reads. (2) D-01 says this filename and `WorkspacePanel.tsx` *"occur only inside other rows' prose"* — **THAT IS FALSE: `grep -o "RunCard.tsx" CLAUDE.md | wc -l` returned 0 before Phase 194, and 0 for `WorkspacePanel.tsx` too. Neither name appeared in `CLAUDE.md` AT ALL.** *"Present but only in prose"* and *"absent entirely"* are different diagnoses with different fixes, and the wrong one sends the next reader looking for a mention that was never there. D-01's conclusion is unchanged and **strengthened**. Re-derive with: `git log --oneline -- frontend/src/components/chat/RunCard.tsx | wc -l` → 20; `git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' | sort -u` → `075.7 075.8 076.1 076.2 095 095.1 128 155 streaming`; `wc -l <file>` → 550; `git show 743965a1:<file> | wc -l` → 550.

### G-5 status (verbatim)

**G-5 FIRES ON THE COUNT (8 phases against a threshold of 3). A G-5 override was OFFERED AND DECLINED for the FOURTH CONSECUTIVE PHASE (193, 193.1, 193.2, 194), and `.planning/STATE.md` records NO guardrail override for Phase 194 — VERIFIED at this commit rather than assumed (`grep -n "Guardrail overrides" .planning/STATE.md` returns entries for 193, 193.1, 193.2 and the v3.6 close, and none for 194), so that absence is a measurement, not an omission.** ⚠ **THIS ROW MAKES NO "HONOURED BY CONSTRUCTION" CLAIM, AND THE REASON IS A MEASUREMENT: AT THIS COMMIT PHASE 194 HAS NOT TOUCHED THIS FILE.** `git log --oneline 743965a1..HEAD -- frontend/src/components/chat/RunCard.tsx` is **EMPTY** and `wc -l` is unmoved at 550, so there is no Phase-194 edit for such a verdict to be about, and inventing one would be exactly the unearned claim this phase exists to remove — `194-13` measured the same thing and declined to write the row at all on those grounds. **This row is written on the G-5 COUNT instead, which is what the ledger is actually for: the audit must be able to SEE the file, and eight phases of invisibility are the whole argument.** ⚠ **THE FIGURES ABOVE WILL GO STALE AND THE COMMIT THAT STALES THEM IS ALREADY IDENTIFIED BY PLAN NUMBER: plan `194-07` declares this file in its `files_modified` and was executing on the same working tree while this row was written. Whoever lands `194-07` must RE-DERIVE this row and record the new triple BESIDE this one with the commit named — never over it.** **What 194 did adjacent to this file WITHOUT editing it, and why it supports D-01's no-second-concern reading:** the `cancelled` vocabulary already ships — `statusGlyph` returns `■` (`:534`) and `statusWord` returns `"cancelled"` (`:548`), both switching on the already-persisted `message.runStatus`, so a terminal-state extension here reads existing state rather than owning new state; and `194-04` chose `■` **by measurement** for the panel's stopped STEP (1 render in `frontend/src`, carrying no second meaning) **without editing this file at all**. **The invariants that now bind it:** the `cancelled` glyph/word pair is the SHIPPED starting point and may be extended but **not replaced without a stated reason** (D-14); ⚠ **`■` is NOT in `icon-convention.md` §4's canvas glyph table and neither is the validated sketch's `⏹`** — §4's rows are `⛨ 🔒 ⤳ ＋ ✕ ↶ ↷ ◆` plus the phase-type map, so a plan that promotes either mark to the canvas owes a FLAGGED PROPOSAL under §4; ⚠ **the Stop CONTROL is the lucide `Square` (`MessageInput.tsx:420`, `ActiveRunsTray.tsx:132`), never `■`** — `194-03` refused `■` for its Stop button because *"that is RunCard's cancelled-STATE glyph, a state and not a control"*, and `194-04` drew the complementary half of the same line; Phase 174's terminal-state tiering is inherited and is **not** re-litigated. ⚠ **THERE IS NO BADGE CEILING OF ANY KIND ON THIS FILE** — the 188.2 two-badge `@ts-expect-error` control guards the CANVAS `PhaseNodeCard`, not this one, and Phase 193 already had to correct that same inherited claim about `library/WorkflowCard.tsx`. **Per G-5 the next phase adding a genuinely second concern here owes a refactor recommendation FIRST; the natural seam is named rather than implied — the run-identity header versus the status/terminal vocabulary (`statusGlyph` / `statusWord` / `categorizeError`) versus the elapsed-timer machinery. It inherits `20 / 8 / 550`.** ⚠ **RE-DERIVED AT `d63b77b8` AFTER PLAN `194-07` LANDED — `20 / 8 / 550` IS STALE AND THE CORRECTED TRIPLE IS `21 commits / 9 phases / 608 L`. Recorded BESIDE the previous value rather than over it, exactly as the paragraph above instructed, and the staling commit is the one it named by plan number BEFORE it existed.** The phase list gains `194`; the raw `sed` recipe now prints **TEN** buckets and the tenth is still `streaming`, the untagged 075.x fix/revert pair, **so the PHASE count is 9 and the recipe's 10 is what the command prints** — the same loser-beside-the-winner correction this cell already makes about the 9-vs-8 reading. ⚠ **THIS ROW WENT STALE ON THE SAME DAY IT WAS WRITTEN — `194-05` wrote it at `3b22a6c3` and `194-07` staled it hours later at `157329ef`, while both plans were executing on the SAME working tree.** That is the sharpest instance of the self-staling this table documents about itself: the `WorkflowsPage.tsx` row has been corrected four times, the `db/workflows.py` row went stale on its own afternoon, and this one was *predicted by name* and staled anyway. **A prediction that a figure will rot is not a substitute for re-deriving it.** Re-derive with: `git log --oneline -- frontend/src/components/chat/RunCard.tsx | wc -l` → 21; `git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' | sort -u` → `075.7 075.8 076.1 076.2 095 095.1 128 155 194 streaming`; `wc -l <file>` → 608. ⚠ **THE "MAKES NO HONOURED-BY-CONSTRUCTION CLAIM" CLAUSE ABOVE IS NOW SUPERSEDED — kept visible rather than deleted (193.2 WR-05).** Phase 194 HAS now touched this file: `194-07` (`2a5962d3`) recorded the D-14 decision as a **comment only, zero deleted lines**. G-5 fires (9 phases) and IS now honoured by construction, on the same measured test the other rows use — `useState(` **3 → 3**, `fetch(` **0 → 0**, props **2 → 2**, **zero deleted lines**, 58 of the added lines comment. The file gained a recorded decision, not a concern. **It inherits `21 / 9 / 608`.** ⚠ **RE-DERIVED AT PHASE 194.1's CLOSE (2026-08-16, plan `194.1-08`, at `14283ba8`): `21 / 9 / 608` — CHECKED AND UNMOVED, and the non-move is a MEASUREMENT rather than an omission.** *A reader who finds no 194.1 entry in this row must be able to tell "checked, unmoved" from "nobody checked"* — this cell's own habit, applied to itself. **Phase 194.1 did not touch this file: `git diff --numstat a9e7d10c HEAD -- frontend/src/components/chat/RunCard.tsx` is EMPTY**, the `sed` recipe still returns ten buckets whose tenth is the untagged `streaming` fix/revert pair (so the PHASE count is still 9 and the recipe's 10 is still what the command prints), and `wc -l` is still 608. Re-derive with the three commands already given above. ⚠ **It was in scope to touch and deliberately was not, which is why the absence is worth writing down:** `194.1-CONTEXT.md` **D-02** named this file in the G-5 audit and stated *"`RunCard.tsx` is expected to be **untouched**; if a plan needs to edit it, that plan must say so and re-derive its triple"* — no plan needed to. The phase's own stopped-run receipt was built as a **new list-level component** (`ThreadRunLine.tsx`), a sibling of the transcript rather than an extension of the card, precisely so the card's inherited G-5 obligation would not have to be discharged inside a UI phase. ⚠ **The card's shipped `cancelled` vocabulary — `statusGlyph` → `■` (`:534`) and `statusWord` → `"cancelled"` (`:548`) — is UNTOUCHED and was the reference point for two decisions taken elsewhere:** the new run line uses `⊘` (shipped since 174 D1/D2) and is fenced against rendering `■` or `⏹` at all, and the Stop CONTROL on all four mounts stays the lucide `Square`. **A state mark and a control are different things, and this row is where that line was drawn** (194-03 / 194-04) and where it held. **Its inherited G-5 obligation therefore passes forward COMPLETELY UNTOUCHED AND UNDISCHARGED: the next phase whose `files_modified` names this file still owes a refactor recommendation as its FIRST option, before the feature it came to build. It still inherits `21 / 9 / 608`.**

---

## `frontend/src/components/chat/MessageInput.tsx`

**Re-derived 2026-08-17 (extraction):** `25 commits / 13 phases / 478 L` · **G-5 FIRES** (13 phases vs threshold 3) — honoured by construction (194.1).

### Phases touched (verbatim)

041 / 051 / **07** / 075.7 / 092 / 094 / 099 / **12** / 121 / 149 / 154 / 155 / **194.1 (194.1-04 `43855c54`)** — **25 commits across 13 phases**, **446 → 478 lines**. ⚠ **ADDED 2026-08-16 by plan `194.1-08`. THIS FILE WAS ABSENT FROM THIS TABLE UNTIL PHASE 194.1. Twelve phases touched it before this one and G-5 never fired once, because the discuss-phase audit scans PLAN.md `files_modified` *against this table*. A hot file missing from the table is permanently invisible to its own guardrail** — the identical failure `WorkflowsPage.tsx` suffered for ten phases, `WorkflowDoorSwitch.tsx` for six, `WorkflowBuilderPage.tsx` for ten and `db/workflows.py` for seventeen, **and that sentence is the reason this row exists and must survive future edits.** ⚠ It DID occur in `CLAUDE.md` before this row — `grep -c "MessageInput.tsx" CLAUDE.md` returned **2** — but **both occurrences were PROSE inside other rows** (`db/workflows.py`'s and `RunCard.tsx`'s cells), which is exactly the *"present but only in prose"* state a row-scanning audit cannot see. ⚠ **THE RAW RECIPE RETURNS FAR MORE THAN 13 BUCKETS AND THE EXTRAS ARE NAMED RATHER THAN SILENTLY SUBTRACTED:** `backend`, `model`, and **four whole untagged commit SUBJECTS** (`feat: Aether Intelligence design system…`, `feat: stop streaming button…`, `Fix LangSmith tracing…`, `Redesign chat UI with full`) — the `sed` recipe cannot parse an untagged subject and prints it entire. ⚠ **`07` and `12` are NOT typos and NOT truncations — they are REAL phases from the pre-zero-padding era**, verified commit-by-commit at `194.1-BASELINE.md` §7 (`feat(07-02): add agent mode selector…`, `feat(12-02): skill_activated indicator…`); `121` is a separate bucket. **ZERO dated quick-task buckets.** Re-derive with: `git log --oneline -- frontend/src/components/chat/MessageInput.tsx | wc -l` → 25; `git log --format=%s -- <f> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' | grep -E '^[0-9]+(\.[0-9]+)?$' | sort -u` → the thirteen above; `wc -l <f>` → 478; `git show a9e7d10c:<f> | wc -l` → 446.

### G-5 status (verbatim)

**G-5 FIRES ON THE COUNT (13 phases against a threshold of 3) — honoured BY CONSTRUCTION, no override. `.planning/STATE.md` records `Phase 194.1 — NONE` with the offer-and-decline stated; that absence was VERIFIED at this commit, so it is a measurement and not an omission.** **The measured reason, a test rather than an argument: the composer SWAPPED ONE CONTROL FOR ONE SHARED COMPONENT AND OWNS ZERO NEW STATE.** `useState[(<]` **1 → 1** · `useEffect(` **3 → 3** · props **16 → 15** — ⚠ **the props count went DOWN**, because the stop-dispatcher prop (`onStop`) was RETIRED rather than defaulted, which made the compiler **enumerate its own call sites**: `tsc` went 33 → **38** and all five errors were call sites still passing it, each superseded in place. **The pressed state lives in a `StreamsProvider` store slice (CONTEXT D-05), never in this mount — which is CONTEXT D-03's stated STOP CONDITION, and these counts are what discharge it.** ⚠ **THE ONE-MOUNT PROPERTY IS MECHANICAL, NOT A ONE-TIME GREP:** the suite splits this file's `?raw` text, filters lines containing `<StopControl`, asserts `toHaveLength(1)`, and asserts that one line carries **both** `threadId=` and `variant="composer"` — so neither a second mount nor an unpacked prop can land quietly (the 193.1 `<TemplateNameCheck` precedent). ⚠ **THE NEEDLE ONLY WORKS BECAUSE THE PROSE DELIBERATELY DOES NOT SPELL THE TOKENS, AND A LATER EDITOR WHO "TIDIES" THOSE DOCBLOCKS BREAKS REAL NEEDLES SILENTLY** — `grep -c "onStop"` must read **0** and `grep -c "<StopControl"` exactly **1**, and this file first measured **4** on three prose mentions plus the real mount (`194.1-04` deviation 5); the same discipline as `run_lifecycle.py`'s app-shutdown gate, and it also satisfies `WorkspacePanel.test.tsx`'s **F-1 / V-05** union fence, which sweeps `chat/**` RAW and un-stripped on purpose. ⚠ **TWO BEHAVIOUR CHANGES STATED PLAINLY: (1) the composer Stop is now GATED ON `threadId`** — `<StopControl threadId={null}>` renders nothing. It loses no live case and that is a measurement rather than a hope (`disabled={isStreaming}` where `isStreaming` reads `false` whenever there is no thread, so `disabled === true` **implies** a thread), but it is a real conditional the shipped button did not have, and **an inert control is exactly what this phase exists to remove**, so rendering nothing is the honest arm. **(2) it no longer reaches `stopStream`** — it used to (`ChatArea.tsx:361 onStop={stopStreaming}` → `useMessages.ts:118 stopStreaming: actions.stopStream`, CONTEXT **D-22**, which is why the SPEC's single-resolver acceptance was unsatisfiable) and now goes through `stopThread(threadId)`, retiring the second resolver as a **consequence** rather than as extra scope. ⚠ **`stopStream` ITSELF SURVIVES AND IS NOW DEAD CODE — deliberately NOT deleted**, because it is exported through `useMessages`' action surface and its removal is a Deep-path change; **the deferral is carried in TWO PRODUCTION FILES** (this file's `Props` docblock and `ChatArea.tsx`'s `inputBar` comment) as well as in `194.1-DEFERRED.md`, because a deferral that lives only in a deleted line is exactly as invisible as one never written (193.2 WR-05). **Re-open trigger: a phase that touches `useMessages`' action surface.** ⚠ **The width of the stopping row is UNGUARDED BY CONSTRUCTION** — jsdom returns 0 for all layout, so the fence is class-token identity on a fixed-size reservation wrapper (`h-8 w-8 rounded-lg shrink-0`), never geometry (CONTEXT **D-24**), and *"does the row twitch?"* is an operator judgement routed to **G-4 row 1**. The named one-line fallback if it does — clamp the composer variant's reading — is recorded in `StopControl.tsx`'s docblock and deliberately **not** taken pre-emptively. **Per G-5 the next phase adding a genuinely second concern owes a refactor recommendation FIRST; the natural seam is named rather than implied — the textarea/submit mechanics, the provider+model pickers, the agent-mode selector, the prefill plumbing and the workflow-lock chrome are five concerns in one composer. It inherits `25 / 13 / 478`, and that figure goes stale on the next commit touching the file.**

---

## `frontend/src/components/chat/MessageList.tsx`

**Re-derived 2026-08-17 (extraction):** `19 commits / 8 phases / 267 L` · **G-5 FIRES** (8 phases vs threshold 3) — honoured by construction (194.1).

### Phases touched (verbatim)

**32** / 063 / 068.5 / 076.1 / 083 / 092 / 095 / **194.1 (194.1-06 `60da7a00`)** — **19 commits across 8 phases**, **234 → 267 lines**. ⚠ **ADDED 2026-08-16 by plan `194.1-08`. THIS FILE WAS ABSENT FROM THIS TABLE UNTIL PHASE 194.1 — and unlike its sibling above it did not appear in `CLAUDE.md` AT ALL: `grep -c "MessageList.tsx" CLAUDE.md` returned **0**. Seven phases touched it before this one and G-5 never fired once**, because the audit scans `files_modified` against this table and **a hot file missing from the table is permanently invisible to its own guardrail.** ⚠ **THE PHASE COUNT HAS BEEN CORRECTED TWICE AND BOTH LOSERS ARE KEPT BESIDE THE WINNER: `194.1-SPEC.md` said *"≥6 phases"*; `194.1-CONTEXT.md` D-01 and `194.1-BASELINE.md` §7 measured **7** at wave 1 and explicitly corrected the SPEC; measured at this commit it is **8**, because this phase's own commit is the eighth bucket.** A figure written at a phase's open goes stale on that phase's own work. ⚠ **Non-phase raw buckets, named and subtracted:** `chat`, `phase`, plus three whole untagged commit subjects. **`32` IS a real old-era phase**, not a truncation — verified at BASELINE §7 (`feat(32-02): thread onSendMessage+showSuggestions through ChatArea→MessageList→MessageItem`). **ZERO dated quick-task buckets.** Re-derive with: `git log --oneline -- frontend/src/components/chat/MessageList.tsx | wc -l` → 19; the numeric `sed` recipe → the eight above; `wc -l <f>` → 267; `git show a9e7d10c:<f> | wc -l` → 234.

### G-5 status (verbatim)

**G-5 FIRES ON THE COUNT (8 phases) — honoured BY CONSTRUCTION, no override; `.planning/STATE.md` records `Phase 194.1 — NONE`, verified rather than assumed.** **The measured reason: ONE LIST-LEVEL MOUNT AND ONE PROP.** `useState[(<]` **0 → 0** · `useEffect(` **1 → 1** · props **6 → 7**. **The prop movement of exactly one is the only movement the phase allowed, and it is MECHANICALLY GUARDED rather than asserted** — a baseline case enumerates all seven members **in order**, so an eighth prop smuggled in later reds there first, by design. ⚠ **`ThreadRunLine` (the mounted component) OWNS ITS OWN `useState` PAIR AND TWO `useEffect`s, AND THAT IS NOT A D-03 VIOLATION — stated explicitly so a reader does not have to infer it.** D-03 forbids the **pressed state** living inside a **mount component**; this is neither — the pressed state is store-owned (D-05), and `ThreadRunLine` is not a mount but the line itself, which legitimately owns its own frame read and its own clock. **The invariants that now bind this file:** ⚠ **D-17 — `MessageList.tsx:217`'s `RunStatusStrip` is NOT replaced and NOT moved, and that is PROVED rather than promised**: `git diff -U0` reports exactly four hunks at base lines 5, 21, 45 and 189, while the `showJumpToLive` block opens at 192 and closes at 230, **so no hunk reaches it** — the new line is its **SIBLING**, and a case asserts the contrast on screen (at kickoff the chip is correctly absent, being gated on having scrolled away, while the run line is present). Any plan editing that block owes a stated reason. **Exactly ONE `<ThreadRunLine` mount**, at list level **after** the messages map and never inside the transcript (D-15). ⚠ **THE STEP COUNT ON THAT LINE COMES FROM TWO DIFFERENT DERIVATIONS AND THEY ARE NOT INTERCHANGEABLE — this is the sharpest trap the phase found, and it is recorded here because the wrong one TYPECHECKS.** `lib/phaseState.ts` maps the DB literal `completed` to the CLIENT member `done`, so `usePhases` returns `done` rows while `stepsFrom` counts `=== "completed"`; applying one derivation to both arms — **which is what plan 06's own text instructed** — would have reported **`0 of 3` on a run where three phases finished**, i.e. precisely the *"nothing survived"* reading 194 D-13 forbids, arrived at through the helper written to prevent it. Shipped as **`stepsFrom` over the WIRE** (stopped arm) and **`harnessBannerProgress` over the STORE** (live arm), with zero hand-rolled mappings; both docblocks say so. **A zero DENOMINATOR is refused (the segment is omitted, never printed as `0 of 0`) while a zero NUMERATOR is printed, because that one is a real measurement.** **Per G-5 the next phase adding a genuinely second concern owes a refactor recommendation FIRST; the natural seam is the message map versus the scroll/jump-to-live machinery versus the empty-state suggestions versus the run line's mount. It inherits `19 / 8 / 267`.**

---

## `frontend/src/components/chat/ChatArea.tsx`

**Re-derived 2026-08-17 (extraction):** `61 commits / 29 phases / 587 L` · **G-5 FIRES** (29 phases vs threshold 3) — honoured by construction (194.1) — **strongest FE extraction case**.

### Phases touched (verbatim)

043 / 044 / 045 / 052 / 057 / 058 / 060 / 063 / 063.1 / 067.2 / 067.3 / 068 / 068.5 / **07** / 075.1 / 075.4 / 076.1 / **08** / 087 / 092 / 094 / 099 / **12** / 121 / 128 / 149 / 176 / **32** / **194.1 (194.1-04 `43855c54`, 194.1-06 `60da7a00`)** — **61 commits across 29 phases**, **563 → 587 lines**. ⚠ **ADDED 2026-08-16 by plan `194.1-08` AS A DEVIATION, and the deviation is the finding: THIS FILE IS THE SECOND-HOTTEST FRONTEND MODULE IN THE TREE AFTER `StreamsProvider.tsx`, IT WAS ABSENT FROM `CLAUDE.md` ENTIRELY (`grep -c` → 0), AND `194.1-CONTEXT.md` D-01's OWN EIGHT-FILE G-5 AUDIT DOES NOT LIST IT — even though this phase edits it TWICE.** The audit that exists to catch invisible hot files was itself reading a list, and the list was short. **Twenty-eight phases touched it before this one and G-5 never fired once.** *That sentence is the reason this row exists and must survive future edits.* ⚠ **Non-phase raw buckets, named and subtracted:** the raw recipe prints 33 buckets; the four extras are `chat`, `docs`, `feat:`-style untagged subjects and `model`-shaped tags — **the NUMERIC filter returns 29 and all 29 are real phases, with ZERO dated quick-task buckets.** `07`, `08`, `12`, `32`, `44`, `45` are pre-zero-padding-era phases, not truncations (the same era BASELINE §7 verified commit-by-commit for `MessageInput.tsx`). ⚠ **THE LINE COUNT HAS THREE READINGS INSIDE ONE PHASE and all three are kept: `563` (BASELINE §3, wave 1) → `577` (measured by plan 06 at its base, after plan 04 grew it by 14) → `587` (here).** Plan 06 recorded the middle one *"corrected beside BASELINE's rather than over it, per this project's habit"*, and this row keeps the arc rather than only its endpoint. Re-derive with: `git log --oneline -- frontend/src/components/chat/ChatArea.tsx | wc -l` → 61; the numeric `sed` recipe → the 29 above; `wc -l <f>` → 587; `git show a9e7d10c:<f> | wc -l` → 563.

### G-5 status (verbatim)

**G-5 FIRES HARD — 29 phases against a threshold of 3, second only to `StreamsProvider.tsx` among frontend files on this ledger. Honoured BY CONSTRUCTION, no override; `.planning/STATE.md` records `Phase 194.1 — NONE`, verified at this commit.** **The measured reason, a test rather than an argument: `useState[(<]` 7 → 7 · `useEffect(` 4 → 4 · props 8 → 8 — every one unmoved across BOTH of this phase's edits** (`194.1-04-SUMMARY.md`, `194.1-06-SUMMARY.md`). The two changes are a **destructure REMOVED** (`stopStreaming` is no longer taken from `useMessages`, because the composer's Stop now dispatches inside the shared component) and **one existing prop passed one level further down** (`threadId` to `MessageList`). *A file that loses a destructure and forwards a prop it already holds has gained no concern.* **The invariants that now bind this file:** ⚠ **`onStop` must not reappear — `grep -c "onStop" ChatArea.tsx` is a fence at 0**, and it is only satisfiable because the `inputBar` comment names the retired prop **without spelling it**; a later editor who writes the identifier back into that prose breaks a real needle silently. **The `stopStream` deferral is recorded in this file's `inputBar` comment** as one of its two production homes (the other is `MessageInput.tsx`'s `Props` docblock) — **re-open trigger: a phase that touches `useMessages`' action surface.** ⚠ **Cancel-reachability is now CONDITIONAL on this file passing `threadId`**, where the shipped button needed nothing: the D-01 reachability case was re-pointed from a prop call to the store action, and a **complement case for the no-thread arm was added**, so the conditional is pinned in both directions rather than left to be discovered. **Per G-5 the next phase adding a genuinely second concern here owes a refactor recommendation FIRST — and at 29 phases this row is the strongest extraction case on the frontend side of this ledger. The natural seam is named rather than implied: the thread header + title editing, the message-loading/reconcile wiring, the composer bar assembly, the mode/prefill plumbing and the drawer/history chrome are five concerns in one component. It inherits `61 / 29 / 587`.**

---

### Phase 196 (plan `196-07`) — the ONE file in the phase where G-5 was honoured by REDUCTION, and the arithmetic is the record

**RE-DERIVED 2026-08-18 by plan `196-09`: `63 commits / 30 phases / 571 L`** (`CLAUDE.md`'s row read
`61 / 29 / 587`; six-digit dated quick-task buckets: **checked, none exist** on this file). Phase list gains
`196`. ⚠ **The line count went DOWN, which no other row on this ledger records** — 587 → **571**.

**The measurement, taken at THREE points with `grep -c` on the file itself and never copied forward:**

| | pre-Task-2 | post-Task-2 (the extraction) | post-Task-3 (the feature) | bar |
|---|---:|---:|---:|---|
| `useState[(<]` | **7** | **2** | **2** | 7 → 2 ✅ |
| `useEffect(` | **4** | **3** | **3** | 4 → 3 ✅ |
| `onStop` | 0 | 0 | **0** | the shipped fence, still 0 ✅ |
| `useComposerModel` | 0 | 2 | **2** | exactly 2 ✅ |
| `wc -l` | 587 | 571 | **571** | — |

⚠ **THE THIRD COLUMN IS THE ONE THAT MATTERS, and it is the whole argument for taking the seam FIRST.** The
feature — `BUG-260718-04`'s per-thread model restore — added **no hook at all** to the guarded file: `useState`
and `useEffect` are identical post-extraction and post-feature. **A naive D-18 would have written the restore
effect into this file and taken `useEffect` 4 → 5**, failing the very measurement Phase 194.1 recorded on this
row as its own honouring test. *This row's standing bar was met by making the file smaller, not by arguing the
addition was small.*

**WHAT MOVED:** the composer's whole provider/model machine → **`frontend/src/hooks/useComposerModel.ts`**,
together with three pure exported functions — `deriveLastUsedModel`, `resolveRestoreTarget` and
`applyRestoreInOrder`.

**The invariants that now bind the new hook, and the first two are subtle enough to be worth not
rediscovering:**

1. ⚠ **The restore is a SEED with a CLOSING WINDOW, not a policy — and the closing condition is TWO-armed.**
   *"Restore once per thread"* alone is insufficient: a thread with nothing to restore from never marks itself
   settled (correctly — messages arrive asynchronously, so *"no answer yet"* must not be read as *"no answer
   ever"*). The operator picks a model and sends; the reply lands carrying a different one; the effect
   re-evaluates, now finds a target, and **overwrites the pick the operator just made** — a fresh instance of
   the exact defect class the plan exists to remove. So **both** `setSelectedModel` (wrapped as `chooseModel`)
   **and** `handleProviderChange` call `settle()`.
2. ⚠ **`applyRestoreInOrder` is a separate exported function SOLELY so the ORDER is observable.** React
   batches the two setState calls, so an end-state assertion passes against a reversed implementation right up
   until `handleProviderChange` clobbers the restored model in production. The test asserts a **sequence** —
   `expect(order).toEqual(["provider:openai", "model:gpt-5.5"])`.
3. **`resolveRestoreTarget` refuses on TWO independent grounds with different owners** — *operator-disabled*
   (D-07's set, delivered by the new `disabled_models` field on `GET /settings/providers`) and *not offered by
   any provider*. Collapsing them would let the composer render a selection the `<select>` has no option for.
4. ⚠ **A Phase-194.1 comment in this file asserted `7 / 4` and was CORRECTED IN PLACE, with the superseded
   figure preserved beside the new one.** On this file the measurement **is** the guardrail: a stale figure
   answers the next auditor with a number that was true once and **stops the audit**.

⚠ **The `onStop` fence held at 0 across both tasks, and it is still only satisfiable because the `inputBar`
comment names the retired prop WITHOUT SPELLING IT.** That constraint now has a sibling: `useComposerModel`
must read **exactly 2**, and it read **3** on the first attempt because an explanatory comment named the hook.
Fixed by rewording the prose, never by waiving the criterion.

**Per G-5 this file remains the strongest frontend extraction case after `StreamsProvider.tsx`; the obligation
is REDUCED by this phase, not retired. It inherits `63 / 30 / 571`.**

---

## `frontend/src/components/panel/PendingAskCard.tsx`

**Re-derived 2026-08-17 (extraction):** `10 commits / 5 phases / 629 L` · **G-5 FIRES** (5 phases vs threshold 3) — honoured by construction (194.1).

### Phases touched (verbatim)

087 / 094 / 096 / 185 / **194.1 (194.1-05 `5aa9314e`)** — **10 commits across 5 phases**, **486 → 629 lines**. ⚠ **ADDED 2026-08-16 by plan `194.1-08` AS A DEVIATION, for the same reason as the row above it: THIS FILE WAS ABSENT FROM `CLAUDE.md` ENTIRELY (`grep -c` → 0), G-5 FIRES ON IT (5 phases), THIS PHASE EDITS IT, AND `194.1-CONTEXT.md` D-01's G-5 audit DOES NOT LIST IT.** `194.1-05-SUMMARY.md` flagged it for plan 08 (*"ABSENT — its `useState` count of 9 is the number a future D-03 check reads"*) and that flag is what carried it here — **a hot file missing from the table is permanently invisible to its own guardrail, and this is the second one this single phase found by measuring rather than by reading.** **ZERO quick-task buckets — the recipe returns exactly five and all five are real phases.** Re-derive with: `git log --oneline -- frontend/src/components/panel/PendingAskCard.tsx | wc -l` → 10; the numeric `sed` recipe → `087 094 096 185 194.1`; `wc -l <f>` → 629; `git show a9e7d10c:<f> | wc -l` → 486.

### G-5 status (verbatim)

**G-5 FIRES ON THE COUNT (5 phases) — honoured BY CONSTRUCTION, no override; `.planning/STATE.md` records `Phase 194.1 — NONE`, verified at this commit.** **The measured reason: `useState[(<]` 9 → 9 · `useEffect(` 2 → 2 · props 2 → 3 (ONE optional prop). The retirement is DERIVED, not stored** — one module constant, one optional prop, one derived expression and one render arm that **short-circuits ABOVE the gate it must not perturb**. **The invariants that now bind this file, and the first is a product rule rather than an implementation detail:** (1) **A PENDING APPROVAL IS RETIRED WITH A SENTENCE, NEVER REMOVED** — a card that vanishes mid-read is its own small dishonesty, and plant **P3** (return `null` when the run is over) reds the still-in-DOM assertion plus four riders. (2) **The retired card is UNDISPATCHABLE ON BOTH AXES, hard-`true`, with no `onClick`** — `disabled` is what the **browser** honours and `aria-disabled` is what a **screen reader** announces, and the shipped card drives both from one `canSubmit`, so a retirement touching only one would make the two audiences disagree; **P4** (retire visually but leave `aria-disabled={false}`) reds exactly one case. ⚠ **The server's 404 remains the AUTHORITY — this is defence in depth, never a replacement.** (3) **The retired sentence must be pairwise-distinct from the THREE shipped expiry literals over COMPLETE SENTENCES, not merely unequal** — `194.1-BASELINE.md` §9 read all three out of the module's own source rather than re-typing them (*a fence built on a re-typed literal tests the typing*), and the distinction earns its keep: **P5** (reuse the shipped 404 sentence wholesale) reds the four-way set-size clause, while **P5b** (a sentence unequal to it that reuses only its second half) **leaves the set-size clause GREEN at 4** and reds only the shared-complete-sentence clause. That is the 193.2 shape reproduced exactly, and it is the only evidence the stronger clause is not redundant. ⚠ **TWO TRAPS RECORDED SO NOBODY RE-DERIVES THEM: the three shipped literals are NOT three parallel strings** — one is a TEMPLATE literal that interpolates, so a fence harvesting double-quoted strings finds two and reports *"two of the three shipped sentences"*, which reads like a missing SENTENCE rather than a missing regex. **And the naive `expect(src).not.toContain('"No response within')` form FAILS**, because the sentence appears in double quotes inside a **comment** at `:207` documenting a real NaN/0 guard — ⚠ **a later plan must NOT "fix" that red by deleting the comment; the fence is what is mis-scoped in that scenario, never the documentation.** ⚠ **A dispatchability assertion here can pass VACUOUSLY and one did:** rendering a retired card cold and asserting `disabled === true` proves nothing, because `canSubmit` requires an answer and a plain `pending` card with nothing chosen is **already** disabled on both axes — the honest form drives the lived sequence on ONE instance (pick an answer → assert genuinely enabled → end the run → assert disabled), and only the RED gate caught the difference. **Per G-5 the next phase adding a genuinely second concern owes a refactor recommendation FIRST; the natural seam is the answer-choice form versus the countdown/expiry machinery versus the submit + error arms versus the retirement arm. It inherits `10 / 5 / 629`.**

---

## `frontend/src/pages/WorkflowRunPage.tsx`

**RE-DERIVED 2026-08-17 AT PHASE 195 CLOSE (plan `195-08`):** `14 commits / 4 phases / 1156 L` · **G-5 FIRES** (4 phases vs threshold 3) — **PAST the threshold now, not at it** — honoured by construction (194.1, **195**). **⚠ ONE SEAM OF THE FIVE THIS SECTION NAMED HAS BEEN TAKEN — see "The seam, TAKEN" below.**

> ⚠ **The extraction-time header is preserved verbatim beside the re-derivation, never over it**, because this file's own section is the one that records how fast a triple goes stale:
>
> **Re-derived 2026-08-17 (extraction):** `12 commits / 3 phases / 1101 L` · **G-5 FIRES** (3 phases vs threshold 3) — at threshold — honoured by construction (194.1).
>
> **It went stale the same day it was written** — Phase 195's three commits on this file landed hours later. The reading moved `12 → 14 commits`, `3 → 4 phases`, `1101 → 1156 lines`. Re-derive; do not quote.
>
> **Commands, run at `945b8b61`:** `git log --oneline -- frontend/src/pages/WorkflowRunPage.tsx | wc -l` → **14**; the numeric `sed` bucket recipe → `188 188.1 194.1 195` → **4**; `wc -l <f>` → **1156**. **Six-digit dated quick-task buckets: CHECKED, NONE EXIST** (`grep -E '^[0-9]{6}$'` over the bucket list returns empty) — stated so a reader can tell *"checked, none exist"* from *"nobody checked"*, which is this section's own standing request.

### Phases touched (verbatim)

188 / 188.1 / **194.1 (194.1-06 `d7f8232b` the `fmtElapsed` hoist, 194.1-07 `d1d0ef66` the mount)** — **12 commits across 3 phases**, **1046 → 1101 lines**. ⚠ **ADDED 2026-08-16 by plan `194.1-08`. THIS FILE WAS ABSENT FROM `CLAUDE.md` ENTIRELY (`grep -c` → 0) — and at 1101 lines it is one of the largest components in the frontend tree.** ⚠ **CONTEXT D-04 IS STALE AND ITS ORIGINAL INSTRUCTION IS QUOTED HERE RATHER THAN QUIETLY DROPPED: it says this row is to be written *"on the count of 2 (G-5 does NOT fire)"*, and that was TRUE when D-04 was written (BASELINE §7 measured `10 / 2 / 1046` at wave 1). It is FALSE as of this phase, because this phase's own two commits are the third bucket. `194.1-07-SUMMARY.md` measured `12 / 3 / 1101` at `c567a5a6` and warned plan 08 not to follow D-04 verbatim; this row is written on the MEASUREMENT.** The same thing happened to `library/WorkflowCard.tsx`, whose cell predicted the condition and had to be re-derived one day later. **ZERO quick-task buckets — the recipe returns exactly three and all three are real phases**, unlike `WorkflowBuilderPage.tsx` / `api/workflows.py` / `publish_service.py`, whose recipes print `260809` / `260814` / `quick` alongside theirs. *A reader who finds no subtraction paragraph here should be able to tell "checked, none exist" from "nobody checked".* Re-derive with: `git log --oneline -- frontend/src/pages/WorkflowRunPage.tsx | wc -l` → 12; the `sed` bucket recipe → `188 188.1 194.1`; `wc -l <f>` → 1101; `git show a9e7d10c:<f> | wc -l` → 1046.

### G-5 status (verbatim)

**G-5 FIRES AT EXACTLY THE THRESHOLD, and BOTH readings are stated so neither can be quoted as the other: TWO phases had touched this file when Phase 194.1 was scoped (below ≥3 — G-5 did NOT fire then, which is what D-04 recorded), and THREE have touched it including 194.1 (at the threshold — G-5 fires from here on).** Honoured BY CONSTRUCTION either way, no override; `.planning/STATE.md` records `Phase 194.1 — NONE`. **The measured reason: THE PAGE GAINED A CONTROL, NOT STATE OWNERSHIP.** `useState[(<]` **6 → 6** · `useEffect(` **7 → 7** · props **3 → 3** · `<StopControl` **0 → 1** · `workflowLock?.runId|cancelRun(` **0 → 0** · **zero deleted behaviour lines**, and **39 of the 46 added lines are the recorded-decision comment**. ⚠ **Until this phase, `grep -cE "onStop|stopThread|cancelRun|Stop"` over this file returned ZERO — the surface `▶ Run workflow` lands on had no Stop control of any kind**, which is `BUG-260816-01`'s second half and ROADMAP SC#2 for the phase. **The invariants that now bind this file:** (1) **the Stop is gated on the shipped `isTerminal` const already in scope and is NEVER re-derived** — ⚠ **five status cases, not two, and that is measured rather than argued: plant P1 (gating on `runStatus !== "completed"`) reds `⊘ Cancelled` and `✕ Failed` while `✓ Complete` STAYS GREEN**, so a `completed`-only pair of cases passes it outright. (2) **Direct flip — no sheet, no arm-to-confirm** (sketch 169-A); P3a and P3b each red, and P3b's ordering artefact is recorded rather than smoothed. (3) ⚠ **THE STOP IS RIGHT-*GROUPED* WITH THE SEAM LINK, NOT APPENDED AFTER IT, AND THE ARRANGEMENT IS LOAD-BEARING RATHER THAN TIDY:** `COPY_OPEN_THREAD` carries `ml-auto`, so a Stop appended after it would shove the seam link left every time the run went terminal — **G-4 row 2's *"the row twitches"* failure, built in.** Grouping pins the link's right edge; the shipped seam button is **byte-unchanged**; and the property is asserted by **CHILD ORDER** (`firstElementChild` is the slot, `lastElementChild` the seam link), **never by class name**. (4) **F1/F2 close the `src/pages` gap in the four-mount fence** — `WorkspacePanel.test.tsx`'s F-1/V-05 globs only `panel|chat|workflows`, so this mount would have been the ONE Stop outside the fence guarding the other three; **F2 was shown to red where F1 does not**, which is the only evidence it is not a redundant widening. (5) **`fmtElapsed` no longer lives here** — plan 06 hoisted it verbatim to `lib/fmtElapsed.ts` (one import added, seven lines removed, **both call sites byte-unchanged, zero behaviour lines changed**), and a byte-identity fence plus a boundary table both red on a one-character edit to the moved body. ⚠ **TWO LESSONS THIS FILE TAUGHT THE PHASE, recorded because they generalise: (a) plan 01's `expect(src.split("\n").length).toBe(1047)` line pin was ALREADY RED at plan 07's base and NOBODY COULD HAVE SEEN IT** — `src/components/chat` has no `TARGETS` entry, so that suite is **UNGATED** and the count gate never runs it. *A pin in an ungated suite is a pin nothing checks; if a phase pins a figure, pin it where the gate runs — or do not pin it.* **(b) a fence can red for a reason that has nothing to do with its subject:** `expectBandSentence` **sampled** where it had to **wait**, so under P1 it red on a band COUNT (an announcement race in a `useState` written from a `useEffect`) rather than on the gate the plant was aimed at — *a fence that reds for a reason other than its subject is not evidence for its subject*, and P1 had to be re-driven from scratch after the fix. **The count-gate pin on `WorkflowRunPage.test.tsx` is now 102 and is EXACT** (102 = 102 on the gate's own `actual`), unlike `WorkspacePanel.test.tsx`'s, which was found twelve cases behind. **Per G-5 the next phase adding a genuinely second concern owes a refactor recommendation FIRST; the natural seam is named rather than implied — the run read + its poll, the phase/spec join, the elapsed anchor, the deliverable list and the canvas mount are five concerns in one 1101-line component. It inherits `12 / 3 / 1101`.**

### The seam, TAKEN — Phase 195 (added 2026-08-17 by plan `195-08`)

⚠ **RECORDED BESIDE THE PREDICTION ABOVE, NEVER OVER IT.** The G-5 paragraph closes by naming a seam:

> *"the natural seam is named rather than implied — the run read + its poll, the phase/spec join, the elapsed anchor, **the deliverable list** and the canvas mount are five concerns in one 1101-line component."*

**Phase 195 took exactly ONE of the five it named: the deliverable list.** The prediction was correct and is left standing as evidence that a named seam is worth more than a general "extraction due" — a later phase could pick it up because someone had written down which five.

**What was taken, precisely.** The region's own byte formatter, its own basename, its own extension→glyph map, the three OOXML mime constants and its hand-rolled `<li><button>` row markup were **deleted** and replaced by a delegation to the shared `components/files/FileRow.tsx` (Radix `asChild`). Eight lucide file-glyph imports went with them. **This is the second-largest of the five concerns and the only one that was duplicated in two other files** — which is what made it the right one to take first, and it was taken because RUN-03 required it, not as a tidy-up.

⚠ **The file got BIGGER, not smaller (1101 → 1156), and that is the honest reading.** The deleted duplication was outweighed by (a) the docblock recording the extraction and its constraints, (b) the D-02 heading constant with its historical literal quoted beside it, and (c) the `useMemo` ordering derivation. **A refactor that removes duplication is not obliged to remove lines**, and a section claiming otherwise would be inviting the next reader to measure the wrong thing. The concern count fell by one; the line count rose by 55.

**THE FOUR CONCERNS THAT REMAIN, for the next phase that opens this file — the seam, restated on the current measurement:**

1. **the run read + its poll** — the largest remaining concern
2. **the phase/spec join**
3. **the elapsed anchor**
4. **the canvas mount**

**Per G-5 the next phase adding a genuinely second concern still owes a refactor recommendation FIRST. It inherits `14 / 4 / 1156`, and G-5 now fires PAST the threshold rather than at it.**

**The invariants Phase 195 added to this file, in addition to everything above:**

1. ⚠ **THE REGION'S HEADING MAKES NO AUTHORSHIP CLAIM, AND THAT IS A PRODUCT RULE RATHER THAN COPY.** `COPY_DELIVERABLE_HEADING` reads **`Files in this run's workspace`**; the historical `What this run produced` is quoted verbatim beside the constant. The read is **thread-scoped** (there is no run-attribution column on `workspace_files`, and the field that *looks* like one — `run_claim` — is NULL on every row and belongs to Phase 141 template-asset isolation). A thread legitimately holds files this run did not write. Measured: thread-scope is exact for **60 of 61** file-bearing runs and visibly wrong for one. **A word-level sweep fences the `<h2>` against `/this run (produced|made|created)/i`, and it is ORDERED BEFORE the equality assertion** — a failing `expect` aborts the case, so an equality placed first would swallow every observation of the sweep firing.
2. ⚠ **`COPY_NO_FILES_TERMINAL = "This run produced no files."` IS NOT THE SAME OVERCLAIM AND MUST NOT BE "FIXED".** A run is a subset of its thread, so an **empty** thread-scoped list *entails* the run produced nothing; the overclaim only bites in the non-empty direction. **D-15 ships both empty strings byte-identical** and a source fence pins each at exactly one occurrence. A plan that corrected this copy in the heading's name would break D-15. The reasoning is written into the page so the next reader does not correct it.
3. ⚠ **THE THREE-WAY EMPTY STATE IS THE MOST-SEEN STATE ON THIS SURFACE — 161 of 222 runs hit it.** Live → *"No files yet — this run hasn't written anything."* · terminal → *"This run produced no files."* · **nothing at all while the first read is in flight**. Three plants red one arm each (force always-terminal, force always-live, delete the `filesLoading ? null :` guard).
4. ⚠ **THE ORDERING IS `[...files].sort(byNewestFirst)`, NEVER `files.sort(...)`** — the provider hands out a stable array reference and an in-place sort mutates store state. **And the sort key is ABSENT on exactly the file the ordering exists to surface:** the reconciled GET supplies `created_at` on every row, but the live SSE payload carries `id/path/version/size/mime` only and the store **appends** it. A comparator that sorts a missing key LAST puts the just-produced deliverable at the BOTTOM, under the template it filled. Both regimes are pinned, **each fixture its own positive control** — a one-row list, or a list already in the right order, passes forever whether the page sorts or not.
5. ⚠ **THE ID-LESS ROW'S DEAD AFFORDANCE IS A `<span aria-disabled>`, NEVER A `<button>`, AND THE ELEMENT CHOICE IS LOAD-BEARING.** A shipped fence asserts the region holds **zero** `<button>` elements on that arm; re-implementing the cue as a disabled button reds it. Plan `195-02` planted this exact change one wave early and *measured* that a `<span>` affordance leaves the zero-button contract green — the conversion then observed the identical shape.
6. ⚠ **THE ORDERING IS SCOPED TO THIS PAGE ONLY.** The workspace panel keeps its shipped `path` ordering and **no decision authorises changing it** — stated so a reviewer can tell "scoped" from "forgotten".
7. ⚠ **`StopControl.baseline.test.tsx` IMPORTS THIS FILE AS `?raw` AND GREPS IT, AND THAT SUITE WAS UNGATED UNTIL PHASE 195.** It is now gated (adopted at plan `195-02`), but the lesson stands: **a refactor of this file can red source-level fences that have nothing to do with its subject.** Assert it green after every edit here.
8. ⚠ **FOUR IDENTIFIERS MUST NEVER APPEAR AS TOKENS IN THIS FILE — INCLUDING IN COMMENTS.** Raw-source absence fences assert this page names neither the panel's file-list component, nor the previewer, nor the viewed-thread selector hook, and that the Stop control appears exactly once. **Prose is not exempt** — the extraction docblock names all four in WORDS on purpose. This trap has now fired **seven** recorded times in this repository; do not "clarify" the docblock back into a red gate.

---

## `frontend/src/components/chat/OutputFileCard.tsx`

**ADDED 2026-08-17 by plan `195-08`. Re-derived at `945b8b61`:** `8 commits / 7 phases / 219 L` · **G-5 FIRES** (7 phases vs threshold 3) — honoured by construction (**195**).

> ⚠ **THIS FILE WAS ABSENT FROM `CLAUDE.md` ENTIRELY UNTIL THIS COMMIT** (`grep -c` → 0), while measuring **SEVEN phases** — more than double the threshold. It is the fourth file in three phases found to be invisible to its own guardrail by *measuring* rather than by reading (`StreamsProvider.tsx`, `ChatArea.tsx`, `PendingAskCard.tsx` before it). ⚠ **It was flagged as absent at Phase 195's WAVE 1 baseline and the flag is the only reason it is here** — nothing in the discuss-phase audit could see it, because the audit scans a table and the table had no row.

**Commands, run at `945b8b61`:** `git log --oneline -- frontend/src/components/chat/OutputFileCard.tsx | wc -l` → **8**; the numeric `sed` bucket recipe → `075.2 075.4 075.7 095 095.1 155 195` → **7**; `wc -l <f>` → **219**. **Six-digit dated quick-task buckets: CHECKED, NONE EXIST.**

### Phases touched

**075.2 / 075.4 / 075.7 / 095 / 095.1 / 155 / 195** — 8 commits across 7 phases, **187 → 219 lines** at Phase 195.

⚠ **The wave-1 baseline measured `7 / 6 / 187` and that figure is preserved here beside the current one**, because the delta is entirely this phase (`+1 commit, +1 phase, +32 lines`) and a reader comparing the two should be able to see that rather than infer it.

### G-5 status

**G-5 FIRES ON THE COUNT (7 phases) — honoured BY CONSTRUCTION, no override.** The extraction **IS** the requirement: RUN-03 says *no second file UI*, and Phase 195's structural first move was to lift the row markup out into a shared component before any surface was converted. There was no feature to do first.

**What Phase 195 did to this file, and the property that made it cheap:** its interior was re-implemented on `components/files/FileRow.tsx` (`asChild`) while its **public prop shape stayed BYTE-IDENTICAL** — the `interface OutputFileCardProps` block's md5 is unchanged and the interface remains **unexported**. ⚠ **That is why neither call site was opened**, which matters more than it sounds: one of them is `MessageItem.tsx` at **29 phases with an UNDISCHARGED G-5 extraction obligation**. Opening it would have been the expensive half of the plan and would have owed a refactor recommendation first.

⚠ **"Zero behaviour change" was proved on the RENDERED BYTES, not by the tests passing.** A before/after `outerHTML` capture across **23 states** (live plain/sized/zero-size/`supersedes`/both `variant` values/absolute url/extension-less/prototype-key/path-shaped/markup-shaped ×2/`.csv`/`.sh`; dead ×5; downloading; two error copies; plus the download call's *arguments* and the re-entrancy guard's call count) read **18/23 raw-identical and 23/23 once class-token ORDER is normalised away.** A conversion can satisfy 21 assertions and still move the DOM in ways none of them read.

⚠ **THE ONE ACCEPTED DELTA, stated as a delta and never claimed as identity:** the dead branch's name span emits `font-mono text-foreground/60 truncate` as `font-mono truncate text-foreground/60` — **same token set, different attribute order**, arising inside the shared row's `twMerge` composition. CSS class order in the attribute has no effect on cascade resolution, so the rendering is identical. *"18/23 raw-identical" is written that way on purpose; "the conversion is byte-identical" would have been false.*

**The invariants that now bind this file:**

1. ⚠ **THE DEAD-LINK STATE IS `BUG-260523-03`'s CUE AND SURVIVES BYTE-IDENTICAL.** A file with no `url` renders the dead root: `data-dead="true"`, a red-bordered affordance, and *"Download unavailable — this file has no link"*. ⚠ **The affordance is a `<span aria-disabled>` and the row holds ZERO `<button>` elements** — the same contract the run page carries, held on **both** sides of the seam rather than by luck on one. The gate is the `if (!file.url)` branch itself: no anchor exists to click, so `aria-disabled` is presentational and never authorization.
2. ⚠ **THE `Replaces:` SUBLINE IS WRITTEN IN BOTH BRANCHES AND BOTH ARMS MUST STAY INDEPENDENT.** Before Phase 195 the literal was written **twice** — once live, once dead — and *"a fence rendering only a `url`-bearing fixture structurally cannot see the dead branch."* It is now written **once**, inside the shared row. **The blast radius grew and that is the extraction working:** a one-character edit to the literal (`Replaces: ` → `Replaces:`) red **3** cases before and reds **4** now. **The independence survived** — deleting the live `supersedes` prop reds the live cases and leaves the dead one GREEN, and vice versa; the seam moved from *two blocks* to *two props* rather than vanishing.
3. ⚠ **`variant` IS INERT AND `is_hero` IS UNREAD — since Phase 095.1 (`D-095.1-06`), by operator-approved decision.** `hero` and `working` render the same tag, the same class list and the same children; the backend still WRITES `is_hero` and nothing reads it. A plant adding `variant === "hero" ? "shadow-lg" : ""` reds one case, so the inert flag cannot silently become behaviour again. ⚠ **This is pinned on the RENDERED SHAPE, not on the source** — a conversion reintroducing a hero difference through a mechanism the assertions do not read (a wrapper the caller supplies) would not red here.
4. ⚠ **THE `VITE_API_BASE_URL` READ, `resolveOutputUrl` AND THE PRESERVED STATIC `href` STAY LOCAL TO THIS FILE.** The shared row receives `name`, `sizeBytes`, `supersedes`, `errorText`, `trailing`, `density` — **no thread id, no file id, no URL**. There is no path by which the row could resolve or fetch another surface's file. ⚠ **`resolveOutputUrl` passes through any `url` not starting with `/`, so a `javascript:` value would be a real sink.** Pre-existing, byte-unchanged, and **ACCEPTED with its trigger restated: any change that lets a user or a connector supply `OutputFile.url`, or any phase opening `resolveOutputUrl` for another reason, adds a scheme allow-list in the same commit.**
5. ⚠ **THE IN-ROW DOWNLOAD ERROR AUTO-CLEARS AFTER 3 s AND THE RUN PAGE'S DOES NOT.** Chat's error is in-row with a `setTimeout`; the run page's is section-level (`data-testid="run-download-error"`) with **no** auto-clear. **The asymmetry is deliberate**, not drift. ⚠ **The 3 s timing is UNCOVERED on purpose** (it needs fake timers and is not a `D-08` state) — the timer's *presence* is asserted, its *timing* is not.
6. **The chat row is the ONE surface that keeps the full glyph:** `fileIcon()` at **30 px WITH the mono `.EXT` ribbon** and an inline category hex. The panel and the run page render a flat 16 px token-coloured glyph with no ribbon. **"One icon path" is a VISIBLE difference between surfaces, deliberately parameterised** (`ribbon` / `tone`), not a single appearance imposed on three places.

**Per G-5 the next phase adding a genuinely second concern owes a refactor recommendation FIRST. The natural seam, named rather than implied: this file is now three concerns in 219 lines — (a) the sandbox URL resolution + the download call + its re-entrancy guard, (b) the transient error state and its timer, and (c) the two-branch live/dead composition over the shared row. (c) is thin and is the part that just moved; (a) is the part with a security note attached to it and is the natural next cut. It inherits `8 / 7 / 219`.**

---

## `frontend/src/components/panel/FilesSection.tsx`

**ADDED 2026-08-17 by plan `195-08`. Re-derived at `945b8b61`:** `7 commits / 4 phases / 298 L` · **G-5 FIRES** (4 phases vs threshold 3) — honoured by construction (**195**).

> ⚠ **ALSO ABSENT FROM `CLAUDE.md` ENTIRELY UNTIL THIS COMMIT** (`grep -c` → 0). It sat at **3 phases — exactly at the threshold — invisible**, and Phase 195 made it the 4th.

**Commands, run at `945b8b61`:** `git log --oneline -- frontend/src/components/panel/FilesSection.tsx | wc -l` → **7**; the numeric `sed` bucket recipe → `087 088 100 195` → **4**; `wc -l <f>` → **298**. **Six-digit dated quick-task buckets: CHECKED, NONE EXIST.**

### Phases touched

**087 / 088 / 100 / 195** — 7 commits across 4 phases, **277 → 298 lines** at Phase 195. The wave-1 baseline measured `6 / 3 / 277`; preserved here beside the current figure.

### G-5 status

**G-5 FIRES ON THE COUNT (4 phases) — honoured BY CONSTRUCTION, no override.** Same reason as the two files above: the extraction is the requirement.

⚠ **THIS FILE IS THE REASON PHASE 195 EXISTS, AND IT SAID SO ABOUT ITSELF.** Its `formatBytes` carried a comment reading, verbatim:

> `// Copied verbatim from OutputFileCard.tsx:24-28 (the plan instructs copy, not`
> `// re-derive — the source fn is not exported). Keep byte-for-byte identical.`

**A confession of a duplication, checked in, with an instruction to keep the copy in sync by hand.** It was deleted **with the function it described** — not before it, not after it. ⚠ *A tombstone comment is a duplication that has been noticed and not fixed; finding one is a stronger signal than finding the duplication itself, because it proves someone already knew.*

**What Phase 195 deleted from this file:** the copied `formatBytes` **and its confession**, the inline mime-first `iconFor` with its own `codeExts` array, the three OOXML mime constants, and six lucide file-glyph imports. The section now delegates to the shared row (`asChild`, `density="panel"`).

**The invariants that now bind this file — the section keeps the a11y root, the shared row supplies only the presentation:**

1. ⚠ **THE SECTION OWNS `useViewingThread`, AND THE SHARED ROW MUST NEVER READ IT.** `grep -c useViewingThread` here → 3; on the shared row → **0**. A raw-source absence fence on the run page pins the same property from the other direction. **The shared row is PURELY PRESENTATIONAL and this is mechanically enforced, not a convention** — it may not call the viewed-thread hook and may not import or name the previewer.
2. ⚠ **ACTIVATION IS PREVIEW, NEVER DOWNLOAD — AND THE ASYMMETRY WITH THE RUN PAGE IS DELIBERATE.** Clicking a panel row opens `FilePreview`; clicking a run-page row downloads. **The shared row therefore parameterises the ACTIVATION rather than hardcoding it** (a callback prop — never a preview import). The panel row contains zero `<a>`, zero `<button>`, no `lucide-download` and no `aria-disabled`.
3. ⚠ **THE LISTBOX/OPTION ROLES AND THE ROVING `rowRefs` FOCUS LIVE HERE, SO THE SHARED ROW MUST FORWARD ITS REF.** The rows are `div[role="option"] tabindex` inside `role="listbox"`, and `rowRefs` drives ArrowDown/ArrowUp. ⚠ **THIS IS THE PROPERTY MOST LIKELY TO DIE SILENTLY AND IT NEARLY WENT UNTESTED.** The shared row's own suite tests a ref passed **to** the row; nothing tested a ref passed to the row's **caller-supplied child**, which is what `rowRefs` actually uses. **Had Radix's `Slot` swallowed that child ref, arrow-key navigation would have died for keyboard users only, with every shipped case and every shared-row case green.** It does not swallow it — but that is now a measurement, driven by a plant, not a hope.
4. **The label is the FULL PATH in `font-mono`, never the basename** (the run page deliberately shows the basename); the padding stays `px-2.5 py-2` (38 px, against the run page's `px-2 py-2` / 33 px); the fresh-write flash, `TemplateUpload` and the Template badge (passed as `trailingSlot`, rendering BEFORE the size cell) all stay in the section. Each has a plant proving its case can fail.
5. ⚠ **THE PANEL KEEPS `text-panel-muted-foreground`, AND THIS IS THE ONE INVARIANT A NORMAL TEST CANNOT DEFEND.** In the shipped **dark** theme `--muted-foreground` and `--panel-muted-foreground` are **byte-identical** (`220 16% 65%`) and they diverge **only in light**, where the panel token exists because the global one measured **4.01:1 — below the 4.5:1 AA floor** (`PanelSection.tsx:85`; the panel token measures 7.21:1). **So a real light-theme AA regression passes every `toHaveStyle`, every `getComputedStyle` and every dark-theme screenshot.** The only assertion that sees it is one on the **token NAME**. That reasoning is written into the suite's header so a future editor cannot "improve" it back into a resolved-colour check. **Never assert a resolved `rgb()` on this file.**
6. **The glyph delta is recorded as a DECISION, in a passing case rather than in prose.** Adopting the shared map moved four categories — tables `file-spreadsheet → table`, code `file-code → code`, images `file-image → image`, unknown `file → file-text`; `docx`/`pptx` unchanged. ⚠ **The nine code extensions the shared map omitted (`sh` `bash` `sql` `yml` `yaml` `css` `jsx` `mjs` `tsx`) were added in the same phase**, verified mechanically against this file's real pre-conversion **14-entry** list — *"nine"* was the briefing's number and the measured list was longer. **Zero missing, zero mis-categorised**, and a plant deleting the nine rows reds a case in **this** suite, so the panel defends the fix independently.

⚠ **The three `TS2304: Cannot find name 'WorkspaceFile'` errors in `__tests__/FilesSection.test.tsx` are PRE-EXISTING, are part of the baseline `tsc` count of 33, and were LEFT DELIBERATELY.** See the note under `CLAUDE.md`'s typecheck figure; fixing them takes the tree to 30.

**Per G-5 the next phase adding a genuinely second concern owes a refactor recommendation FIRST. The natural seam, named rather than implied: this file is now four concerns in 298 lines — (a) the viewed-thread read and the files list, (b) the listbox keyboard model and its roving refs, (c) the preview selection + `FilePreview` mount, and (d) the template upload + badge. (c) is the cleanest cut — it is the only one with its own child component already. It inherits `7 / 4 / 298`.**

---

## Phase 196 — ELEVEN files that were ABSENT from this ledger, and every one of them fires G-5

*(Added 2026-08-18 by plan `196-09`, discharging `196-CONTEXT.md` D-22 / D-23 for the subset Phase 196
actually modified. **Every triple below was re-derived in ONE batch pass at this close** with `CLAUDE.md`'s
own recipe — six-digit dated quick-task buckets subtracted — and **not one figure was copied** from D-22, from
`196-RESEARCH.md` §K.30, or from any earlier plan's summary. Several agree with an earlier reading anyway;
where they do, the agreement is a re-derivation and is stated as one.)*

⚠ **THIS IS THE `WorkflowsPage.tsx` FAILURE MODE ELEVEN TIMES OVER, and it is the largest single instance this
ledger has recorded.** Phase 196 modified 23 non-test source files. **Eleven of them had no row**, so the
discuss-phase audit — which scans PLAN.md `files_modified` *against the `CLAUDE.md` table* — could not fire on
any of them, ever, at any phase count. `WorkflowsPage.tsx` escaped for ten phases, `WorkflowDoorSwitch.tsx` for
six, `db/workflows.py` for seventeen, `ChatArea.tsx` for twenty-eight. **`backend/app/config.py` escaped for
forty-two, and `frontend/src/lib/api.ts` for ninety-seven.**

---

### `frontend/src/lib/api.ts`

**Re-derived 2026-08-18 (plan `196-09`): `170 commits / 97 phases / 6154 L`** · quick-task buckets excluded:
`260405`, `260814` · **G-5 FIRES HARDER THAN ANY FILE ON THIS LEDGER** (97 phases vs threshold 3) — **the
hottest file in the repository, and it had no row at all.**

⚠ **THIS ROW REFUTES A SENTENCE IN `CLAUDE.md`.** That file calls `backend/app/api/threads.py` at 76 phases
*"the hottest file in the repository"*. **It is not.** The full argument, both accountings and the preserved
original are in the `threads.py` section above under **"⚠ CORRECTION 2026-08-18"**; the short form is that
`api.ts` wins on the generous count (**97 vs 76**) and on the strict two-digit-discarding count (**81 vs 56**),
so the verdict does not depend on which convention you pick.

**What it is:** the ONE typed HTTP client for the entire frontend — every route the app calls, every request
and response type, in one 6154-line module. **Three plans of Phase 196 alone edited it** (`196-01` added
`ModelRegistryRow.emit_tier` / `ModelCapabilityPatch.emit_tier`; `196-04` added `AuthorModelRow` +
`getAuthorModelRegistry`; `196-07` added `disabled_models` to the providers response type).

**Why G-5 is honoured by construction for Phase 196 regardless of the count:** all three edits are **purely
additive** — `196-04`'s `git diff` shows **no `-` lines beyond the file header**, so `getModelRegistry`'s body
and `ModelRegistryRow` are byte-unchanged. No existing call was retyped, renamed or repointed.

**What binds this file, and the first is measured rather than advisory:**

1. ⚠ **A NEW EXPORT HERE IS A BREAKING CHANGE FOR EVERY SUITE THAT STUBS `@/lib/api` WITH AN EXPLICIT
   FACTORY.** Nine suites stub it that way, and an undeclared export **throws at mount** rather than returning
   `undefined`. Adding `getAuthorModelRegistry` cost **249 failing tests** until nine mock factories declared
   it (`196-08`); adding `getGroundingBundle` cost the same one phase earlier. *This is the file's single most
   expensive property and it is invisible from inside the file.*
2. **A client type must be STANDALONE, never a `Pick` or an `extends` of a richer server row.** `AuthorModelRow`
   is a structural six-field interface rather than `Pick<ModelRegistryRow, …>`, deliberately, so a field added
   to the operator row later **cannot travel to authors by inheritance**. `grep -c 'Pick<ModelRegistryRow\|extends ModelRegistryRow'`
   is a live fence at 0.
3. **The `.models` unwrap stays in the client** — callers receive the array, not the envelope.

**THE NAMED SEAM, so the next refactor has somewhere to start rather than a 6154-line wall:** this module is
already *de facto* partitioned by domain in its own ordering — threads/messages, documents/folders, skills,
workflows/harness, settings/providers, admin/registry, connectors. **A per-domain split under
`frontend/src/lib/api/` with a re-exporting barrel** preserves every `from "@/lib/api"` import site
unchanged — which is what makes it takeable at all, given property 1 above. ⚠ **The barrel is not optional:
repointing import sites and splitting the module in one commit would destroy the byte-identity evidence any
such cut needs.** **Per G-5 the next phase touching this file owes a refactor recommendation FIRST.**

---

### `backend/app/config.py`

**Re-derived 2026-08-18 (plan `196-09`): `71 commits / 42 phases / 1285 L`** · six-digit dated quick-task
buckets: **checked, none exist** · **G-5 FIRES** (42 phases vs threshold 3) — **the second-hottest file
measured anywhere in this project, and it was structurally invisible to its own guardrail for the project's
entire life.**

⚠ **THIS IS THE HEADLINE OF D-22 AND IT IS STATED PLAINLY RATHER THAN FOLDED INTO A LIST.** Forty-two phases
have edited this module. G-5 has **never fired on it once**, not because anyone waived it but because the
audit reads a table and this file was not in the table. That is the identical invisibility failure
`WorkflowsPage.tsx` (ten phases), `WorkflowDoorSwitch.tsx` (six) and `db/workflows.py` (seventeen) each
suffered — and it ran four times longer here than in any of them. ⚠ **`196-01` recorded `70 / 41 / 1275` at
its own close; this re-derivation reads `71 / 42 / 1285` the same day.** *A figure written at a plan's close
goes stale on the next commit, and here it went stale inside the same phase.*

**What it is — and this is why the count is so high:** the module hosts at least four separable concerns.
(a) The env-backed `Settings` pydantic singleton and its validators — the infra/secrets tier. (b)
**`MODEL_CAPABILITIES`**, the 61-row hardcoded model registry that is the source of truth for provider
routing, `emit_tier`, `native_tools`, context windows and timeouts. (c) `get_model_capability` /
`get_model_capability_async` — the read path, including the **DB overlay** from
`model_capabilities_overrides`. (d) `apply_setup_overlay` and the `INFRA_KEYS` file-store overlay.

**What Phase 196 did:** `196-01` appended `"emit_tier"` to the copy tuple in `get_model_capability_async`, so
the operator's override reaches the read path (D-14). One entry, in one tuple.

**What binds this file, and three of these are red lines:**

1. ⚠ **THE SYNC `get_model_capability` STILL NEVER READS THE DB, AND THAT IS NOW PINNED RATHER THAN LEFT TO BE
   REDISCOVERED.** `get_model_capability("glm-4.7-flash")` still returns `capability_source="inferred"` with no
   `emit_tier`. `test_sync_path_still_never_reads_the_db` asserts exactly that, so a later reader **cannot
   assume the overlay fixed both doors**. Only the async path is overlaid.
2. ⚠ **`_build_inferred_defaults` MUST NOT LEARN TO READ `forced_emission` OR `strict_json_schema`** — D-122-04
   forbids any derived view re-reading the deprecated flags. Measured at `196-01`'s close:
   `git diff <base> HEAD -- backend/app/config.py | grep "^+" | grep -c "forced_emission\|strict_json_schema\|_build_inferred_defaults"`
   → **0**.
3. ⚠ **AN ID ABSENT FROM `MODEL_CAPABILITIES` SILENTLY RESOLVES `capability_source=inferred` AND LOSES
   `emit_tier`** (SEED-040 / SEED-135). This is why the UAT roster rule insists on registry-backed ids: an
   unregistered id measures a *weaker* configuration than the one that ships, and nothing says so at the call
   site.
4. **The timeout bounds are the single source for the PATCH door.** `admin.py`'s `_MODEL_CAP_INT_BOUNDS`
   **imports** `_LLM_CALL_TIMEOUT_MIN_S` / `_MAX_S` from here rather than retyping them, asserted by an
   equality test — so the write door and the env parser cannot drift.
5. **`Settings.harness_judge_model` still exists here and is no longer read by any judge consumer.** It was
   deliberately NOT deleted in `196-02`: removing a field while rewiring its consumers would have made a red
   test ambiguous about which change caused it.

**THE NAMED SEAM:** **`MODEL_CAPABILITIES` and its two readers want their own module** —
`backend/app/services/model_registry.py` already exists (created by `196-04`) and is the natural home for the
*composition* of code-registry ∪ DB rows; the raw table plus `get_model_capability{,_async}` is the cut that
would take ~600 lines out of a 1285-line config module and leave the env/infra tier alone. ⚠ **The obstacle is
named too, so the next phase does not discover it mid-cut: `from app.config import settings` and
`from app.config import get_model_capability` are everywhere in the tree, so the cut must ship a re-export in
`config.py` in the same commit** — the `run_transport.py` precedent above, whose load-bearing-re-import
invariant applies here verbatim. **Per G-5 the next phase touching this file owes a refactor recommendation
FIRST.**

---

### `frontend/src/types/index.ts`

**Re-derived 2026-08-18 (plan `196-09`): `70 commits / 56 phases / 1154 L`** · quick-task bucket excluded:
`260405` · **G-5 FIRES** (56 phases vs threshold 3) — **the third-hottest file measured anywhere in this
project, behind only `api.ts` (97) and `config.py` (42)… and ahead of `config.py`, in fact. It had no row.**

**What it is:** the ONE shared frontend type module — every domain model, every union the UI switches on. Its
phase count is high for the same structural reason `api.ts`'s is: **almost any feature that adds a field
touches it**, which is exactly the property that makes a hot-file count meaningful and exactly the property a
missing row hides.

**What Phase 196 did:** `196-03` added `"model_fallback"` to the `EmitSubStep` union.

**Why G-5 is honoured by construction:** one member appended to one closed union. No type renamed, widened or
removed.

**⚠ WHAT BINDS THIS FILE: A UNION MEMBER ADDED HERE IS A CONTRACT THE RENDERING SIDE MUST HONOUR IN THE SAME
COMMIT.** `EmitSubStep` is consumed by `PhaseCard.tsx`'s `SUBSTEP_META` map; a member without an entry renders
as nothing, which on a run surface is a silent lie rather than a visible gap. `196-03` shipped both halves
together and pinned the whole union with an `it.each` over `SUBSTEPS`, so a future member with no meta entry
fails a test rather than a user.

**THE NAMED SEAM:** per-domain type modules under `frontend/src/types/` with a re-exporting barrel — the same
shape, the same barrel requirement and the same re-export invariant as `api.ts` above, and for the same
reason: `from "@/types"` is everywhere. **Per G-5 the next phase touching this file owes a refactor
recommendation FIRST.**

---

### `scripts/vitest-count-gate.cjs`

**Re-derived 2026-08-18 (plan `196-09`): `100 commits / 16 phases / 3215 L`** · quick-task buckets excluded:
`260807`, `260808`, `260814` · **G-5 FIRES** (16 phases vs threshold 3) — ⚠ **and this is the
`WorkflowsPage.tsx` failure mode ON THE FILE THAT ENFORCES THE GUARDRAILS.**

⚠ **Sixteen phases have edited the gate script and it has been invisible to its own guardrail for its entire
life.** The trajectory inside Phase 196 alone is the ledger's staleness finding in miniature, and all three
readings are kept: `196-05` measured **`98 / 16 / 3110`**, `196-07` **`99 / 16 / 3181`**, `196-08`
**`100 / 16 / 3215`** — and this close re-derives the last independently and agrees.

**What Phase 196 did:** `196-03` adopted `PhaseCard.test.tsx` (both knobs, pinned at 27); `196-05` added one
`TARGETS` entry and three `BASELINE` pins; `196-07` added two `TARGETS` entries and two `BASELINE` pins;
`196-08` **raised** one existing pin, `PhaseFormPanel.test.tsx` 24 → 38.

**Why G-5 is honoured by construction:** every edit is an append to `TARGETS` or `BASELINE` plus its comment
block. `196-05`'s and `196-07`'s diffs show **zero `-` lines** in the script.

**What binds this file:**

1. ⚠ **`TARGETS` AND `BASELINE` ARE TWO SEPARATE KNOBS AND ADOPTING A SUITE MEANS SETTING BOTH.** A `TARGETS`
   entry makes a suite **run**; a `BASELINE` pin makes it **guarded**. A suite in `TARGETS` only is executed
   and defended by nothing — which is precisely the state eight of Phase 195's nine suites were in.
2. ⚠ **A PIN'S VALUE MUST BE READ FROM THE GATE'S OWN `actual` COLUMN, NEVER FROM A DOCUMENT** — including
   from the plan that commissions it, and including from this ledger. `196-05` pinned `ModelField.test.tsx` at
   **32**, not the 31 its first green run measured, because a later task added a case; the pin was set from
   the column after that change.
3. ⚠ **RAISING A PIN NECESSARILY PRODUCES ONE `-` LINE, and an orchestrator check of the form
   `git diff … | grep -c '^-[^-]'` EXPECTING 0 IS WRONG.** A key cannot hold two values. **The gate's contract
   is no per-file DECREASE and zero failing — never a fixed total and never a zero-deletion diff.** `196-08`
   raised `PhaseFormPanel.test.tsx` 24 → 38 and would have been mis-flagged as a deletion by that check. The
   property actually worth guarding is that **sibling plans' entries are untouched**, which is a per-key
   assertion, not a line count.
4. **A GROWING GRAND TOTAL IS THE GATE WORKING.** Phase 196's arc: `4123` (wave 2) → `4197` → `4258` →
   `4277` → **`4291 · failed 0 · pinned 4217 · 89/89`**.

**THE NAMED SEAM:** the script is **3215 lines of which the great majority is the comment register** that makes
each pin auditable — and that register is the file's most valuable property, not its bloat. The honest cut is
therefore **not** prose removal but **data/logic separation**: `TARGETS` + `BASELINE` + their registers into a
sibling data module, leaving the runner, the report reader and the verdict formatter in the script. **Per G-5
the next phase touching this file owes a refactor recommendation FIRST.**

---

### `backend/app/main.py`

**Re-derived 2026-08-18 (plan `196-09`): `72 commits / 53 phases / 783 L`** · six-digit dated quick-task
buckets: **checked, none exist** · **G-5 FIRES** (53 phases vs threshold 3) — absent from this ledger until
now, at fifty-three phases.

**What it is:** the FastAPI application factory — every `include_router`, the lifespan, the middleware stack.
Its phase count is high for the structural reason that **every new route module must be registered here**,
which makes it a natural chokepoint rather than an accreting concern.

**What Phase 196 did:** `196-04` added one import name and one `include_router` line for the new
`GET /models/registry` route.

**Why G-5 is honoured by construction:** two lines, in the shape every prior router registration already uses.

**What binds this file:** ⚠ **a router registered here inherits ONLY its own dependencies.** The new
`model_registry` router carries **no prefix and no router-level dependency** — `Depends(get_current_user)`
alone, deliberately, following the `me_preferences.py` precedent. **`admin.py`'s router-level operator
default-deny is a property of THAT `APIRouter(prefix="/admin", …)` construction and does not extend to
siblings**; `196-04` proved the wall had not moved by asserting the 200 and the 404 **in one test with one
seeded identity**, so the two claims cannot drift apart and nobody can read the 200 as evidence the gate was
widened to produce it.

**THE NAMED SEAM:** none is proposed, and that is a verdict rather than an omission — a registration file with
53 phases and 783 lines is doing exactly one thing 40-odd times. **The G-5 obligation is recorded so the count
is inherited rather than re-derived; the next phase touching it should say the same thing unless the file has
started to hold logic.**

---

### `backend/app/api/admin.py`

**Re-derived 2026-08-18 (plan `196-09`): `32 commits / 12 phases / 1733 L`** · six-digit dated quick-task
buckets: **checked, none exist** · **G-5 FIRES** (12 phases vs threshold 3) — absent from this ledger until now.

⚠ **`196-01` recorded `30 / 11 / 1718` and `196-04` recorded `32 / 12 / 1733` FOUR HOURS LATER.** Both were
accurate when written. This close re-derives the second independently and agrees. *The ledger's most-repeated
finding, reproducing inside a single phase and inside a single afternoon.*

**What it is:** the operator Control-Room API — the model registry CRUD, the kill switches, the audit ledger
reads, the users roster, the feature-visibility map. Its router carries an **operator default-deny at the
router level**, which is the file's most important property.

**What Phase 196 did:** `196-01` added `_MODEL_CAP_ENUM_COLUMNS` and `_MODEL_CAP_INT_BOUNDS` beside their
int/bool siblings plus one `elif` inside the existing guard loop; `196-04` **removed 87 lines and added 13** —
`_registry_row` and the union composition moved OUT to `backend/app/services/model_registry.py`, leaving
`get_model_registry` a thin call.

**Why G-5 is honoured by construction:** `196-01` is two module constants and one `elif` inside a loop that
already existed; `196-04` is **subtractive in the right direction**.

**What binds this file, and the first is the SQLi boundary:**

1. ⚠ **`_MODEL_CAP_COLUMNS` MUST STAY IN THIS MODULE.** Its members are **interpolated into the upsert's column
   list** by `set_model_capability` (T-149-11), which makes that set the SQL-injection boundary. `196-04`
   deliberately did **not** move it with `_registry_row` — the leaf imports it **function-locally** instead —
   because moving the allowlist a hop away from the writer that enforces it is exactly the wrong direction.
   The function-local form is also what keeps the `admin.py` → service → `admin.py` cycle from having to
   resolve at import time.
2. ⚠ **WIDENING THAT SET IS LEGITIMATE ONLY IN THE SAME COMMIT AS THE NEW COLUMN'S OWN GUARD.** `196-01` took
   it 7 → 8 and **broke `test_149_model_write.py::test_columns_constant_is_exactly_the_seven_editable` — which
   is the guard WORKING, not noise.** The pin was renamed to `..._the_eight_editable` and given a docstring
   recording the rule and naming `_MODEL_CAP_ENUM_COLUMNS`.
3. **The guard loop's two shipped properties are inherited, not re-implemented:** an explicit `None` is a
   **Reset**, and the raise happens **before any DB touch**. The new `elif` sits inside that loop precisely so
   it cannot lose either. Every refusal case asserts the recording pool's `.calls` is empty — *a guard that
   raises after the upsert is not a guard, it is a log line.*
4. ⚠ **`_infer_provider_for` IS NOT THIS MODULE'S** — it lives in `app.config` and `admin.py` merely imports
   it (`:40`). `196-04`'s plan described it as an `admin.py` name that would "travel with" the extraction;
   reading the source showed there was nothing to carry.

**THE NAMED SEAM:** the module hosts the model-registry CRUD, the kill-switch grid, the audit reads and the
users roster — **four operator concerns in one router**. The registry CRUD is the natural first cut and
`196-04` has already taken the *composition* half of it. **Per G-5 the next phase adding a genuinely second
concern here owes a refactor recommendation FIRST.**

---

### `backend/app/api/settings.py`

**Re-derived 2026-08-18 (plan `196-09`): `30 commits / 16 phases / 616 L`** · six-digit dated quick-task
buckets: **checked, none exist** · **G-5 FIRES** (16 phases vs threshold 3) — absent from this ledger until now.

**What Phase 196 did:** `196-07` added `disabled_models` to the `GET /settings/providers` response — one
comprehension over a dict the handler had **already awaited**, and one return key.

**Why G-5 is honoured by construction:** one comprehension and one key, inside the handler that already
performed exactly that read. No new query, no new import, no new cache.

**⚠ WHAT BINDS THIS FILE — AND THE MOST IMPORTANT ENTRY IS A CORRECTION TO A PLAN'S STATED REASON, PRESERVED
HERE BECAUSE IT WOULD OTHERWISE BE INHERITED AS A MEASURED FACT:**

1. ⚠ **`196-07`'s plan asserted that *"a provider's `models` list is the OPERATOR's configured list and is NOT
   filtered by registry `enabled`"*. THAT IS FALSE ON THIS TREE.** `_build_providers`
   (`user_settings.py:712-713`, D-149-08) applies `if (disabled_ids) models = models.filter(...)` to the whole
   assembled list, and `load_app_settings_async` (`:947-954`) **warms the all-rows override cache immediately
   before** the sync builder runs, precisely so that filter can see disabled rows. `GET /providers` is on that
   async path. **A disabled model IS already excluded from `p.models`.**
2. **The field ships anyway, on a justification that survives measurement** — three reasons, none of them the
   plan's: (a) the restore's INPUT is **a message from history**, not the offered list, so a membership test
   against `p.models` conflates *"the operator disabled it"* with *"this provider never offered it"*, and D-18
   asks for D-07's rule **by name**; (b) the existing filter is **cache-warmth dependent** — `disabled_ids` is
   read from a module-level cache with a 30 s TTL that the *sync* loader does not warm, whereas the explicit
   field is computed from the dict the handler itself just awaited; (c) it costs one comprehension over an
   already-fetched dict.
3. ⚠ **`verified_models` AND THE `/settings` RESPONSE ARE OUT OF BOUNDS FOR THE MODEL-PICKER WORK — this is
   ROADMAP SC#3's scope fence and it lives at this file.** `196-07` touched the `/providers` handler **only**;
   `deprecated_models` is byte-unchanged and pinned by its own adversarial case.
4. **`resolved_harness_judge_model` (`:265-271`) is computed from the EFFECTIVE settings** — which is what made
   the Settings screen show the operator's pick resolved correctly **while the judge shot the registry
   default** for a year. `196-02` closed the asymmetry from the other side; this line was already right.

**THE NAMED SEAM:** the module hosts the app-settings read/write, the provider roster and the per-user
preference surface. At 616 lines it is the least urgent of this group. **Per G-5 the next phase adding a
genuinely second concern owes a refactor recommendation FIRST.**

---

### `backend/app/services/harness/validator_kinds.py`

**Re-derived 2026-08-18 (plan `196-09`): `12 commits / 5 phases / 749 L`** · six-digit dated quick-task
buckets: **checked, none exist** · **G-5 FIRES** (5 phases vs threshold 3) — absent from this ledger until now.
⚠ D-22 read `11 / 4 / 744`; **this is a re-derivation, not a copy**, and it moved.

**What Phase 196 did:** `196-02` rewired **consumer 4** — the in-run `llm_judge_rubric` validator — off the
env-backed `app.config.settings` singleton onto the DB-backed settings. **Exactly one hunk, at `:532-543`,
inside `_validate_llm_judge_rubric`.**

**What binds this file:**

1. ⚠ **`resolve_judge_model`'s BODY, SIGNATURE AND RESOLUTION ORDER ARE UNCHANGED AND MUST STAY THAT WAY** —
   `BUG-260731-01`'s defect lived entirely in **what the four consumers handed it**. It is duck-typed
   (`getattr(settings, "harness_judge_model", None)`) and therefore accepts either settings object without
   complaint, which is what made passing the wrong one silent by construction. **Fix the argument, never the
   resolver.**
2. **The rung order is `config["model"]` → `ctx.judge_model` → the resolved settings value.** `196-02` changed
   **only the third rung**; a precedence control asserts the first rung still wins and never reads the row.
3. ⚠ **THE FALLBACK LADDER AT `:83-86` STILL READS THE DEPRECATED-UNREAD `forced_emission` BOOL while the
   emission ladder reads `emit_tier` (D-122-04).** This is a real drift and it was **deliberately not fixed**
   inside a critical-bug plan: measured **0 of 61** registry rows disagree, both fallback candidates resolve
   identically under either flag, and changing inert code beside a binding test would have made a red result
   harder to attribute. **It is now a GATE rather than a note** — `backend/tests/unit/test_196_forced_emission_drift_trigger.py`
   fires the day the drift stops being latent. Full reasoning: **`SEED-175`**.

**THE NAMED SEAM:** the module holds the judge-model resolver, the verdict schema and the per-kind validator
implementations. The resolver is a two-screen leaf with four consumers across three modules and is the obvious
first cut — **but note that moving it changes `resolve_judge_model`'s import path at four sites and at every
test that patches it.** **Per G-5 the next phase adding a genuinely second concern owes a refactor
recommendation FIRST.**

---

### `backend/app/services/eval_runner_service.py`

**Re-derived 2026-08-18 (plan `196-09`): `12 commits / 7 phases / 959 L`** · six-digit dated quick-task
buckets: **checked, none exist** · **G-5 FIRES** (7 phases vs threshold 3) — absent from this ledger until now.

**What Phase 196 did:** `196-02` rewired **consumers 1 and 2** — the eval judge **shot** and the judge model
**recorded on the result row** — off the env singleton onto `await load_app_settings_async()`.

**What binds this file:**

1. ⚠ **CONSUMER 2 IS NOT INSIDE A LOOP, AND THE PLAN THAT SAID IT WAS COULD NOT BE EXECUTED AS WRITTEN.**
   `196-02` instructed *"resolve once above the loop"*; **no loop textually contains the call.** It lives in
   the `if status == "completed" and output.strip():` grading branch of **`_run_arm_body`**, a helper that
   `run_eval_job`'s `for case in cases:` loop calls **twice per case** (WITH arm and WITHOUT arm). Hoisting to
   `run_eval_job` needs a parameter threaded through `_run_arm` **and** `_run_arm_body` — exactly the signature
   change the same plan forbids. The resolution was hoisted to the **top of the grading block** instead.
2. **The property that actually mattered is satisfied and is arithmetic, not assertion:** `load_app_settings_async`
   is **TTL-cached at 30 s**, so this hoisted read and consumer 1's own resolution microseconds later collapse
   into **one** DB read per arm. Before: two `app.config.settings` reads per arm, zero DB reads. After: **at
   most one DB read per arm — not two, and never one per consumer.**
3. ⚠ **A TEST THAT DERIVES ITS EXPECTATION FROM THE ENV SINGLETON IS NOW WRONG BY CONSTRUCTION.**
   `test_judge_provider_independent` computed its expected provider from `app.config.settings` and would have
   **silently pinned the wrong model forever**. Its CLAIM — the judge routes to the judge model's own registry
   provider and never to `user_settings.active_provider` — was never violated; only the derivation had rotted.
   It now derives through the same source the code uses.

**THE NAMED SEAM:** the module holds job orchestration, the per-arm runner, the judge shot and result
persistence. **Per G-5 the next phase adding a genuinely second concern owes a refactor recommendation FIRST.**

---

### `frontend/src/components/admin/ModelRegistryTab.tsx`

**Re-derived 2026-08-18 (plan `196-09`): `10 commits / 4 phases / 1191 L`** · six-digit dated quick-task
buckets: **checked, none exist** · **G-5 FIRES** (4 phases vs threshold 3) — absent from this ledger until now.
⚠ D-22 read `9 / 3 / 1083`; re-derived, it has moved on both axes.

**What Phase 196 did:** `196-01` shipped the tab's **first enum column** — three user-facing sentences for the
three `emit_tier` values, an OVR/DEF tag, a Reset that writes explicit `null`, and the raw token only under the
⌥ Technical-names reveal. Neither existing primitive was reusable: `NUM_FIELDS` is int-only and `RowToggle` is
boolean.

**What binds this file:**

1. ⚠ **`null` RENDERS AS `coerce`, NOT AS BLANK — and that is an honesty decision, not a display default.**
   Blank would imply *"unknown"*, and the backend does not treat it that way: `forced_emit.py` reads
   `cap.get("emit_tier", "coerce")`, so an untracked model is **already** behaving as best-effort. A `—` would
   hide a live behaviour behind a shrug.
2. **The control writes through the same `onSetCapability` chokepoint every other cell uses.** No second write
   discipline was introduced.
3. ⚠ **THE OPEN-Q2 CAPTION IS LOAD-BEARING COPY, quoted here verbatim so it cannot be trimmed as filler:**
   *"Setting this records what you believe the provider supports; nothing verifies it against the provider."*
   Surfacing an already-doc-verified value makes no new provider claim; making it **editable** introduces an
   unverified operator assertion, and that sentence is the whole of this surface's answer to the
   provider-docs-first rule.
4. **No provider logo was added** (`grep -c '@lobehub/icons'` → 0) — the icon convention is a separate concern
   and this tab does not open it.

**THE NAMED SEAM:** the tab is a wide editable table whose column kinds (bool / int / enum / text) each carry
their own render, guard and reset semantics. **One module per column kind** is the cut. **Per G-5 the next
phase adding a genuinely second concern owes a refactor recommendation FIRST.**

---

### `frontend/src/components/panel/PhaseCard.tsx`

**Re-derived 2026-08-18 (plan `196-09`): `11 commits / 7 phases / 522 L`** · six-digit dated quick-task
buckets: **checked, none exist** · **G-5 FIRES** (7 phases vs threshold 3) — absent from this ledger until now.

**What Phase 196 did:** `196-03` added one `SUBSTEP_META` entry for the new `"model_fallback"` sub-step —
`node: "degraded"` with the `recovering` amber, because a model substitution is degraded-but-honest.

**⚠ WHAT BINDS THIS FILE, AND IT IS AN HONESTY RULE RATHER THAN A STYLE ONE: `model_fallback` DELIBERATELY DOES
NOT REUSE THE `recovering` STATUS.** It borrows the colour and not the word. A narrated-emit recovery and a
disabled-model substitution are **different events**, and collapsing them would put a lie on the run surface —
the operator would read *"recovering"* about a run that never faltered. The amber says *degraded*; the label
says what actually happened.

Second invariant: **`SUBSTEP_META` must stay total over `EmitSubStep`.** A union member with no entry renders
as nothing, which on a run surface is a silent lie rather than a visible gap. The suite pins it with an
`it.each` over the whole union, plus a positive control — and the file is **gated**, adopted into
`scripts/vitest-count-gate.cjs` by `196-03` on **both** knobs at 27 cases (up from 24).

**THE NAMED SEAM:** the card holds the phase header, the status vocabulary, the sub-step rail and the
per-type body. The **sub-step meta table** is a data leaf and is the obvious first extraction. **Per G-5 the
next phase adding a genuinely second concern owes a refactor recommendation FIRST.**

---

## Phase 196 — the phase's GUARDRAIL RECORD (G-1 / G-2 / G-3 / G-4 / G-5 / G-7)

*(Added 2026-08-18 by plan `196-09`. ⚠ **Why HERE and not only in a plan summary**, since the plan that
wrote this offered both homes: this file already carries the **G-5** half of every phase's guardrail
story, and G-2 and G-5 were the two rules that actually fired on Phase 196. Splitting one phase's
guardrail verdicts across two documents is how a decline gets read as an omission later. A plan
SUMMARY is a plan-level artifact; **a guardrail verdict is phase-level and outlives the plan**, so it
belongs beside the G-5 sections it sits with.)*

| Rule | Verdict | Reason |
|---|---|---|
| **G-1** phase chain cap | **did not fire** | 196 is not a `<base>.N` insert. |
| **G-2** sketch before plan for UX | ⚠ **FIRED, and was DECLINED on a reason** — see D-21 below | |
| **G-3** lightweight commands | **did not fire** | nine plans, a migration, a new route, four mounted pickers — far past `/gsd:fast`. |
| **G-4** lived-experience UAT | **fired; four rows RATIFIED, none yet DRIVEN** — see below | |
| **G-5** refactor between feature waves | ⚠ **FIRED on SIX ledger files and ELEVEN more that had no row** — honoured by construction in every case, one of them by REDUCTION | arithmetic in each section above |
| **G-7** gap-closure round cap | **did not fire** | no gap-closure round has run on this phase. |

### D-21 — G-2 fired and was DECLINED on a reason. No override is owed and none is recorded.

**The picker idiom already ships TWICE** — `JudgeModelPicker.tsx` (Phase 137.1, sketch 024-A) and
`ModelDefaultPreference.tsx` (Phase 167). **The acceptance bar therefore existed in CODE rather than
in a drawing**, and re-drawing an atom that already ships is precisely the structural sketch-to-build
drift `SEED-155` records: *a sketch that hand-writes its own CSS for a surface consuming an existing
component is a drawing, not an acceptance bar.* **The operator was offered a sketch and did not take
it.** Because the rule was honoured-with-a-reason rather than overridden, `.planning/STATE.md` records
**no guardrail override for Phase 196 — and that absence is a measurement, not an omission.**

⚠ **THE HONEST LIMIT OF THAT REASONING, stated rather than smoothed:** the decline is defensible for
the `<select>` and its `(current)` idiom, which both shipped pickers have. **It is WEAKER for the
`<optgroup>` fitness grouping, which NEITHER shipped picker has** — that is new visual vocabulary
whose only acceptance evidence is a render test. `196-05` and `196-08` each recorded this about
themselves, and it is carried here so the next phase touching the picker inherits the caveat rather
than the verdict alone.

### D-16 — judge FITNESS stayed OUT because of a MEASUREMENT GAP, not scope tidiness

`gemini-3.5-flash` is **`emit_tier: force`**, **registry-known**, and **still returned a null verdict**
at a real publish. **So `emit_tier` is NECESSARY BUT NOT SUFFICIENT for the judge role** — which means
a "judge fitness" facet built on the registry's emission vocabulary would have been built on an
unverified premise.

⚠ **The leading explanation for that failure is a HYPOTHESIS that has NEVER been live-verified, and
`SEED-135` rates it MEDIUM and forbids any document from citing it as fact until someone dumps the
sanitized Google tool payload.** It is therefore not restated here, in either seed written at this
close, or in either bug report — deliberately, and this sentence is the record that the omission is
the rule being obeyed rather than an oversight.

**What Phase 196 fixed instead is the judge WIRING (D-17)**, which is a different defect with its own
measurement: the knob the operator turns is now the control the code obeys. Fitness remains SEED-135's.

### G-4 — four rows ratified in `196-VALIDATION.md`, ALL FOUR still OWED

**Driven at phase verification by Chrome MCP, not by any plan.** Recorded here because *"the plans are
green"* and *"the rows ran"* are different claims, and this project's standing lesson is that closing a
phase with owed manual rows is legitimate **only when stated as a decision**:

| Row | What it must show | Why no plan could discharge it |
|---|---|---|
| **U-A1** | open a saved `llm_emit` step, touch nothing, close — `config.model` byte-unchanged **via DB** | now DRIVABLE for the first time (`196-08`); the suite pins the client half (`onChange`/`onPersist` zero-called across three stored values incl. an unknown one), which is real evidence and **not the same evidence** |
| **U-A2** | a `coerce` model distinguished from `force_strict` **before** committing the pick, in user words | ⚠ proved as **MARKUP**, never as human experience — a render test cannot prove a person notices |
| **U-B1** | set the judge knob, run a **real** publish, see **that model** named in the verdict receipt | the live judge is now `deepseek-v4-pro`; a unit test cannot prove a provider shot |
| **U-C1** | pick a model, send, navigate away, return, **REFRESH** — model still selected | ⚠ **jsdom has no page reload.** This row is the sole thing standing between `BUG-260718-04` and `closed` |

---

## Phase 196 — files NAMED by D-22 but deliberately left as names, and TEST files deliberately left unlisted

*(Added 2026-08-18 by plan `196-09`. Stated so both omissions read as decisions rather than oversights.)*

**`frontend/src/pages/SettingsPage.tsx` and `frontend/src/components/settings/ModelPillRow.tsx` stay
named-only, by decision.** `196-CONTEXT.md` D-22 named them alongside the eleven above, and Phase 196
**deliberately did not modify either** — that is ROADMAP **SC#3**'s scope fence, and this plan proved it with a
negative fence over the phase's real diff rather than asserting it. Writing detail sections about code a
model-picker phase does not touch would turn it into a documentation phase. **The re-open trigger already
recorded stands: the next phase whose `files_modified` names either of them owes it a row and a section.**

**Phase 196's TEST files are deliberately NOT given `CLAUDE.md` rows** — the same decision this ledger already
records for Phase 195's four new test files, for the same reason: **G-5 is about production concerns accreting
in one module; a test file's growth is the gate's business, not the ledger's**, and the mechanism that actually
watches them is `scripts/vitest-count-gate.cjs` (frontend) plus the backend suite baseline. They are **named
here** so a `grep` finds them and so the next refactorer knows where this phase's pins live:

- Backend, created: `test_196_emit_tier_two_layer_pin.py` · `test_196_emit_tier_overlay.py` ·
  `test_196_judge_model_db_backed.py` · `test_196_harness_enabled_check.py` ·
  `test_196_model_registry_route.py` · `test_196_save_refusal.py` · `test_196_providers_disabled_models.py` ·
  `test_196_forced_emission_drift_trigger.py`
- Backend, repaired by this phase's own changes: `test_149_model_write.py` (the seven-column pin, widened to
  eight — *its failing was the guard working*) · `test_eval_runner.py` (an expectation derived from the retired
  singleton) · `test_185_detection.py` (two stub lambdas that predate the widened builder signature)
- Frontend, created: `ModelField.test.tsx` · `modelFitness.test.ts` · `useModelRegistry.test.ts` ·
  `useComposerModel.test.ts` · `ChatArea.model.test.tsx`
- Frontend, edited: `PhaseCard.test.tsx` · `PhaseFormPanel.test.tsx` · `ModelRegistryTab.test.tsx` ·
  `ModelRegistryTab.a11y.test.tsx` · and the nine `@/lib/api` mock factories repaired by `196-08` —
  `WorkflowBuilderPage.canvas.test.tsx` · `WorkflowBuilderPage.describe.test.tsx` ·
  `WorkflowBuilderPage.session.test.tsx` · `WorkflowBuilderPage.header.test.tsx` ·
  `WorkflowBuilderPage.test.tsx` · `WorkflowBuilderPage.preDraft.baseline.test.tsx` ·
  `WorkflowDoorSwitch.test.tsx` · `WorkflowDoorSwitch.baseline.test.tsx` · `WorkflowsPage.test.tsx`

---

## Why `MessageItem.tsx` and `RunCard.tsx` owe NOTHING from Phase 195

*(Added 2026-08-17 by plan `195-08`. Recorded because it is a **structural** claim rather than luck, and because an absent entry would read as an oversight.)*

Both files are present in `CLAUDE.md` and both fire G-5 — `MessageItem.tsx` at **57 / 29 / 856** with its extraction obligation **UNDISCHARGED**, `RunCard.tsx` at **21 / 9 / 608**. Phase 195 converted the component `MessageItem.tsx` renders, and touched **neither file**.

**Why, mechanically:** `OutputFileCard`'s public prop shape stayed **byte-identical** — the props-interface block's md5 is unchanged, the interface is still unexported, and the exported function signature is unchanged. **Neither call site *could* have needed touching.** Proved three independent ways against a NAMED base SHA: a commit-to-commit `numstat` (empty), a working-tree `numstat` (empty), and **both files' md5s equal to the digests recorded at the phase's baseline**.

⚠ **All three arms are required, and the reason is a measured defect in the obvious one.** `git diff --numstat <BASE> HEAD` compares two **commits** — a working-tree edit is invisible to it by construction. Phase 195 planted **one space byte** into `MessageItem.tsx` and drove it: the `<BASE> HEAD` form returned **EMPTY** with the plant applied, while the working-tree form and the md5 both fired. **A `numstat`-empty check passes trivially both when the base SHA is wrong AND when the edit is not yet committed.** Corroborated independently from a second worktree two waves later, which reproduced the identical planted digest.

**What this means for the next phase:** ⚠ **if a future plan WIDENS `OutputFileCardProps`, `MessageItem.tsx` is opened — and it is a 29-phase file whose extraction obligation is UNDISCHARGED, so a refactor recommendation is owed FIRST.** The prop shape is the load-bearing boundary, not the component's internals.

⚠ **`RunCard.tsx` is owed nothing here for a different reason, and it is not a clean one:** Phase 195 measured that its file badge **reads 0 for a real workflow deliverable** and declined to fix it (`SEED-169`). The file is untouched because the lie was *filed*, not because there was nothing wrong with it.

---

## Young files — tracked, G-5 does not fire yet

These were created or grown in Phase 194.1 and were named in `CLAUDE.md` **in prose only**, which is
precisely the state a row-scanning audit cannot see. They now carry real rows in the `CLAUDE.md` table.
**The moment any of them reaches a THIRD phase, G-5 fires and it owes a full section here** — the
`library/WorkflowCard.tsx` precedent, whose cell predicted its own G-5 fire one phase ahead and was correct.

- `frontend/src/components/chat/StopControl.tsx` — **3 / 1 / 315** (re-derived 2026-08-17) — the ONE shared pressed-state component behind all four Stop mounts
- `frontend/src/components/chat/ThreadRunLine.tsx` — **1 / 1 / 357** (re-derived 2026-08-17) — the run-anchored line, two states
- `frontend/src/components/chat/ActiveRunsTray.tsx` — **2 / 1 / 164** (re-derived 2026-08-17)

**Added 2026-08-17 by plan `195-08` — Phase 195's new and newly-hot module. Same rule: a THIRD phase earns a full section.**

- `frontend/src/components/files/FileRow.tsx` — **1 / 1 / 275** (re-derived at `945b8b61`; buckets `195`; six-digit quick-task buckets: **checked, none exist**) — **the ONE row markup behind all three file surfaces** (chat's output card, the workspace panel's list, the workflow run page's deliverable region). Radix `asChild` + `Slottable`, so the **caller** supplies the wrapper element — an `<a>` in chat, a `div[role=option]` in the panel, a `<button>` on the run page — and the row supplies only the interior. Three densities (`chat` / `panel` / `run`) carry LAYOUT and TONE; they carry no behaviour. ⚠ **It is purely presentational BY ENFORCEMENT, not by convention:** raw-source absence fences on the run page forbid the viewed-thread hook and the previewer from ever appearing, so the activation is a **callback prop** and the row receives no thread id, no file id and no URL. ⚠ **It must forward its ref to the caller-supplied child** — the panel's roving keyboard focus depends on it, and that dependency is invisible from this file. **40 cases, gated.**
- `frontend/src/components/files/fileRowUtils.ts` — **1 / 1 / 133** (re-derived at `945b8b61`; buckets `195`; six-digit buckets: **checked, none exist**) — the ONE `formatBytes` (hoisted **byte-identical** from its origin, with a `?raw` identity fence proving it), `baseName`, the `FileSource` discriminated type, and `byNewestFirst`. ⚠ **`byNewestFirst` must sort a MISSING `created_at` FIRST, not last** — the live SSE payload carries no timestamp, so a comparator sorting a missing key last puts the just-produced deliverable at the bottom of the list. **22 cases, gated.**
- `frontend/src/lib/fileIcon.tsx` — **2 / 2 / 254** (re-derived at `945b8b61`; buckets `095 195`; six-digit buckets: **checked, none exist**) — was `1 / 1 / 105`; Phase 195 widened it into the ONE per-extension icon path for the whole app. Options: `ribbon` / `tone` / `className` / `mimeType`. ⚠ **The bare `text/` mime arm is a FALLTHROUGH and sits AFTER the extension lookup on purpose** — a literally-mime-first order regresses `script.py` served as `text/plain` from the Code glyph to a document one, which is a real combination the panel already handled correctly. Every *specific* mime branch is mime-first; only the bare fallthrough is not. ⚠ **An own-property guard on the map lookup is load-bearing** — `EXT_MAP["constructor"]` would otherwise return a function. **41 cases, gated.**
  > ⚠ **THIS BULLET CARRIES THE LEDGER'S OWN STANDING LESSON AS ITS REASON FOR EXISTING.** At **2 phases** G-5 does **not** fire on this file, and by the letter of the rule it needs no entry at all. It gets one anyway, because `WorkflowsPage.tsx` escaped G-5 **for ten phases purely by not being written down**, and `OutputFileCard.tsx` — two sections above — was invisible at **seven**. **A file that is not in the ledger cannot be seen by the audit that would have added it.** The cheapest moment to write the row is before the guardrail needs it.

**Added 2026-08-18 by plan `196-09` — Phase 196's six new production modules. Same rule: a THIRD phase earns a
full section.** ⚠ **They are listed BELOW the G-5 threshold on purpose**, on the `fileIcon.tsx` precedent —
`WorkflowsPage.tsx` escaped G-5 for ten phases, and `config.py` for forty-two, purely by not being written
down. Each is named by **what it is the ONE home for**, because that is the property a later phase needs.

- `backend/app/services/model_registry.py` — **3 / 1 / 368** (re-derived at this close; buckets `196`;
  six-digit buckets: **checked, none exist**) — **the ONE union composition**: `build_model_registry_rows()`
  (the code registry ∪ the DB override rows), `to_author_row()` (the six-key author allowlist),
  `registered_model_ids()` (the MEMBERSHIP set) and `assert_phase_models_registered()` (the save-path refusal).
  ⚠ **Already at THREE consumers in one phase** — the operator registry route, the author registry route and
  both write doors. ⚠ **The author projection is an explicit ALLOWLIST, never a `del` of unwanted keys**:
  `_registry_row` emits **14** fields, `to_author_row` emits **6**, **8 are dropped**, and the test asserts
  **key-set EQUALITY** plus a raw-body substring backstop so a leak nested below row top level still fails.
  ⚠ **The `enabled` semantics are `_registry_row`'s — an ABSENT override row means ENABLED** — which is what
  the RUNTIME enforcement (`_resolve_enabled_model`) agrees with. The narrower offerable-set helper behind
  `/me/preferences` disagrees (34 vs 69), and adopting it here would refuse a SAVE for ~32 models the engine
  happily runs. *A picker narrower than the engine is a different lie, not an absence of one.*
  ⚠ **MEMBERSHIP is not availability: a DISABLED model still SAVES** — making disabled a save-time refusal
  would mean disabling a model retroactively breaks every workflow naming it.
  ⚠ **`assert_phase_models_registered` raises on the FIRST offender, not on all of them** — deliberate, and a
  verifier expecting an array of offenders on the wire will not find one.
- `backend/app/api/model_registry.py` — **1 / 1 / 155** (buckets `196`) — **the ONE non-operator door onto the
  registry union**, `GET /models/registry`. No prefix, no router-level dependency, `Depends(get_current_user)`
  alone. ⚠ **`run_default_model` is COMPUTED, never guessed** — it walks the same chain `workflow_kickoff.py`
  walks and **fails SOFT to `null`**, because an honest absence degrades a label while a 500 takes the whole
  picker down. It deliberately does **not** read `_registry_row.is_default`, which answers a different
  question. The three candidate ids measured at the time — `app_settings.llm_model` = `deepseek-v4-flash`, the
  sub-agent default = `gpt-5.4-mini`, and the `gpt-5.4` that 18 stored phases happen to carry — **no two
  agree**, which is the whole argument for computing it.
- `frontend/src/components/workflows/ModelField.tsx` — **1 / 1 / 236** (buckets `196`) — **the ONE
  registry-backed picker**, mounted four times by `PhaseFormPanel.tsx`. ⚠ **A pure function of its props: no
  state, no effect, no fetch** — guarded behaviourally (zero calls on open) **and** structurally (a `?raw`
  source fence forbidding `useState` / `useEffect` **and any RUNTIME import of `@/lib/api`**, with both
  positive controls observed red). ⚠ **It renders the panel's two-audience label structure LOCALLY rather than
  importing `FieldLabel`**, because the panel is the module that imports *it* — see the `PhaseFormPanel.tsx`
  section. ⚠ **It cannot express "I could not read the registry"**; it takes rows, not a reading. The
  unknown-value caption sits **outside** the `<select>`, because a native `<option>` cannot host markup —
  which is also why fitness is `<optgroup>` grouping rather than a per-option suffix.
- `frontend/src/components/workflows/modelFitness.ts` — **1 / 1 / 130** (buckets `196`) — **the ONE
  tier→words vocabulary**, plus `EMIT_TIER_ORDER`, the read-time `coerce` default and the boundary guard.
  ⚠ **An unrecognised tier resolves with `hasOwnProperty`, NEVER with `?? floor`** — a plain object literal
  inherits `constructor` / `toString`, none of which is nullish, so a coalesce hands back a **FUNCTION** typed
  as the table's value type. That is a shipped bug this project has already had (`phaseStatusFromDb`), and
  this file exists partly so it is not had a third time. Words live here; the derivation lives on the server.
- `frontend/src/hooks/useComposerModel.ts` — **2 / 1 / 367** (buckets `196`) — **the ONE composer
  provider/model machine**, extracted out of `ChatArea.tsx` (which came out five `useState` and one
  `useEffect` lighter). Exports `deriveLastUsedModel`, `resolveRestoreTarget` and `applyRestoreInOrder`. Its
  three binding invariants — the two-armed closing window, the order-observable restore and the two independent
  refusal grounds — are written out in the `ChatArea.tsx` section rather than duplicated here. ⚠ **The one to
  watch: any future model-selection work in chat returns to this file.** ⚠ It aborts with a **`cancelled`
  flag, not an `AbortController`** — `getAuthorModelRegistry` accepts no signal, so the sibling hook's shape
  copied verbatim would have produced a controller that aborts nothing; the guard's real job is preventing a
  state update after unmount, and it says so.
- `frontend/src/hooks/useModelRegistry.ts` — **1 / 1 / 109** (buckets `196`) — **the ONE author-registry
  fetch**, owned above the panel by `WorkflowBuilderPage.tsx`. ⚠ **A failed read is `status: "failed"`, NEVER
  an empty success** — the whole point of the hook is that *"the registry is empty"* and *"I could not read the
  registry"* must not be the same value, because the second rendered as the first tells an author that a
  registered model is unknown. `grep -c 'getAuthorModelRegistry'` under `frontend/src/components/` is a live
  fence at **0**: components do not fetch.

⚠ **Phase 195's new TEST files are deliberately NOT listed as young files** (`files/__tests__/FileRow.test.tsx`, `files/__tests__/fileRowUtils.test.ts`, `files/__tests__/FileRow.sweep.test.ts`, `chat/__tests__/OutputFileCard.baseline.test.tsx`). **G-5 is about production concerns accreting in one module; a test file's growth is the gate's business, not the ledger's** — and all four are pinned FILE-LEVEL in `scripts/vitest-count-gate.cjs`, which is the mechanism that actually watches them. Stated rather than left silent, so their absence reads as a decision.

### The paragraph these rows replaced (verbatim)

Until the 2026-08-17 extraction these three files had **no rows at all** and were named only in this
paragraph, at the foot of the `CLAUDE.md` table. They now carry real rows. The original is kept
verbatim rather than deleted, because the reasoning in it is the reasoning for the rows:

> ⚠ **Three files Phase 194.1 created or grew are named here IN PROSE and DO NOT HAVE ROWS — and that weakness is stated rather than hidden, because *"present but only in prose"* is precisely the state a row-scanning audit cannot see** (`frontend/src/components/chat/MessageInput.tsx` sat in exactly that state inside two other rows' cells for twelve phases). They are named anyway so a `grep` finds them, with the triple each next reader inherits: **`frontend/src/components/chat/StopControl.tsx` `3 / 1 / 315`** (new — the ONE shared pressed-state component behind all four Stop mounts), **`frontend/src/components/chat/ThreadRunLine.tsx` `1 / 1 / 357`** (new — the run-anchored line, two states) and **`frontend/src/components/chat/ActiveRunsTray.tsx` `2 / 1 / 164`**. **G-5 does NOT fire on any of the three (1 phase each, against a threshold of 3), which is the whole reason they get a mention instead of a row.** Re-derive with the same three commands the rows above use. **The moment any of them reaches a SECOND phase, whoever touches it owes this table a real row** — the `library/WorkflowCard.tsx` precedent, whose cell predicted its own G-5 fire one phase ahead and was correct.

