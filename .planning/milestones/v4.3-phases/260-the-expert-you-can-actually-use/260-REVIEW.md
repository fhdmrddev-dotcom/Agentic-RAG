---
phase: 260-the-expert-you-can-actually-use
reviewer: claude
builder: gemini
review_type: independent (AGENTS.md 6.3 — whoever built it does not verify it)
fixes_applied_by: gemini (the builder fixed its own work; the reviewer did NOT become the builder)
separation_held: yes — third consecutive phase
base_sha: 051aee6c7 (the D-259-07 handover commit)
head_reviewed: 58fc88b6e
date: 2026-09-20
verdict: PASS — three findings, all fixed and each RE-DRIVEN; two residuals recorded, neither blocking
---

# Phase 260 — independent review

## Verdict

**PASS.** Three findings, **all fixed and every fix re-driven** with each planted file restored
md5-identical.

⭐ **The two constraints the handover made binding were both honoured, and both were checked rather
than believed.** `grep -ci expert` in `agent_loop.py` returns **0** — scope arrives as two *generic*
`RunContext` fields (`effective_folder_ids`, `effective_tools`), data handed **to** the loop and not
a branch inside it. And the composer gained **no new top-level control**: invite is a
`DropdownMenuItem` inside the existing `+` menu, the active Expert is a chip in the existing chips
row.

⚠ **The defect that mattered was invisible from the happy path.** The operator had the feature
working live before this review began. **It worked — and the scope silently failed OPEN on two
paths, while the UI kept asserting it was in force.**

## Baselines

| gate | pre-260 (`pytest-259-FIX`) | after 3 plans | after fixes (`58fc88b6e`) |
|---|---|---|---|
| backend pytest | **71 failed / 5162 passed** | 71 / **5172** | 71 / **5176** |
| vitest count gate | 8468 · failed 0 · 7727 pinned · 293/293 | **8468 · unchanged ⚠** | **8478 · 0 · 7737 · 295/295** |

⭐ **The backend failure SET was diffed, never the count** — `comm` empty in both directions at both
stages. ⚠ **The vitest total being UNCHANGED at 8468 was itself the finding** (`F-2`): a total that
does not move after a phase adds 323 lines of tests is the tell.

## Findings

| id | severity | finding | status |
|---|---|---|---|
| F-1 | **HIGH** | Thread scoping failed OPEN on two paths while the UI kept showing the Expert | **FIXED** (`801210c69`) |
| F-2 | **HIGH** | Both new frontend suites ran in no gate at all | **FIXED** (`801210c69`) |
| F-3 | MEDIUM | `core_tools` was a hardcoded second registry outside `_TOOL_REGISTRY` | **FIXED** (`801210c69`) |

### F-1 — the scope failed open, and the interface lied about it

`run_producer._resolve_thread_scoping` returned `(None, None, None)` — meaning *unrestricted* — on
two paths, **both driven against the real function**:

- **A.** any exception during resolution; the `except` block literally logged *"falling back to
  unrestricted chat"*
- **B.** the thread carried `active_expert_id`, but `resolve_expert_bundle` returned `None` — which
  happens when the bundle is missing **or cross-org and therefore invisible to the caller**

⛔ **Path B is the serious one.** `threads.active_expert_id` stayed set, so `ActiveExpertChip` kept
rendering *"Financial Analyzer"* while the agent searched the entire corpus. **The interface
asserted a scope that was not in force** — and no test could see it, because the happy path is
identical.

⚠ **This was the exact inverse of a decision taken two phases earlier.** `TIER-05` chose **strict
fail-closed**, and `D-258-06` **explicitly rejected** the fallback-to-permissive option for this
precise reason. It also broke `SC#1`, which requires the knowledge the agent works from to match
the bundle.

**Verified fixed — and verified NOT over-corrected**, which is the half that mattered:

```
C  plain chat, healthy        ->  allowed, unrestricted              ✓
D  expert resolves            ->  1 folder, 11 tools, 1 skill        ✓
B  expert unresolvable        ->  ValueError, run refused            ✓
A  plain chat + lookup blip   ->  RuntimeError, run refused          ⚠ see residual
```

⭐ **A fail-closed fix is only correct if it does not begin refusing what it should allow** — the
same lesson the Phase 259 folder fix taught, applied here before reporting. The fix also **resets
`threads.active_expert_id` to `NULL`** on the refusal path, so the chip disappears: **the UI and the
run now agree**, which was the actual defect.

The refusal surfaces through the producer's existing generic handler as a **clean failed run with a
readable reason** (`failed: ValueError: …`), not a crashed stream — checked at the call site, not
assumed.

⚠ **A REVIEWER ERROR IS RECORDED HERE RATHER THAN HIDDEN.** The first probe reported cases C and D
as failures, which would have been **two false findings reported as defects**. The cause was the
harness, not the code: `_resolve_thread_scoping` imports `aexec` **locally** from `app.utils.db`, so
patching it on `run_producer` patched nothing. **A probe that targets the wrong import proves
nothing about the code and looks exactly like a finding.**

### F-2 — 323 lines of new tests, running in no gate

`ComposerExpert.test.tsx` (187 lines) and `ExpertSpotlightCard.test.tsx` (136 lines) appeared
**zero times** in the count-gate output, and the grand total stayed at **8468 — byte-identical to
the pre-260 baseline**.

⚠ **The gate's own source had already predicted this**, in comments written by earlier phases:

> `src/components/chat` has NO bare-directory TARGETS entry, so a suite dropped there ... ran in no
> gate and guarded nothing for ~50 phases.

**Every test for the UI the operator had just used was guarding nothing.**

**Verified fixed:** both suites are in TARGETS **and** BASELINE, and the gate now reads
**`8478 · failed 0 · 7737 pinned · 295/295`**. ⭐ **The total RISING is the proof** — TARGETS decides
what runs, BASELINE decides what is guarded, and a suite can sit on the wrong side of exactly one.

### F-3 — a second tool registry, fenced by nothing

`core_tools` was a hardcoded twelve-name list inside `run_producer`, invisible to the
`len(_TOOL_REGISTRY) == 29` pin Phase 259 had added for exactly this class of drift.

⭐ **Fixing it found a real defect nobody was looking for: `fetch_document_chunk` does not exist in
`_TOOL_REGISTRY`.** Every Expert had been granted a phantom tool. The list is now `EXPERT_CORE_TOOLS`
in `tool_dispatcher.py`, **10 members**, with a module-level `assert` that it is a strict subset.

**Verified fixed by driving:** a planted `phantom_tool_planted` makes the import fail and **names the
offender**. File restored md5-identical.

## Residuals — recorded, neither blocking

**1. A transient failure reading `threads` now refuses the run for EVERY chat, including chats with
no Expert at all.** The `try` wraps the lookup that decides whether an Expert even applies, so
*"cannot tell"* becomes *"refuse"*. **Defensible** — a scope that cannot be read cannot be honoured
— but the blast radius is app-wide rather than Expert-only. ⛔ **Recorded as a DECISION rather than
left as an accident**; the narrow alternative is to move the `active_expert_id` lookup outside the
fail-closed boundary, accepting a small leak window in exchange.

**2. `EXPERT_CORE_TOOLS`' module-level `assert` is stripped under `python -O`** — driven: the
phantom survives and the module imports cleanly. **Not a real gap**, because
`test_expert_core_tools_is_strict_subset_of_tool_registry` pins both the subset property and
`len == 10`, and pytest does not run optimised. **The test is the guard; the assert is a bonus.**

## What was solid

- ⭐ **The red line held, and was measured** — `grep -ci expert` in `agent_loop.py` returns **0**. The
  loop gained two *generic* scoping inputs, guarded by `is not None` so existing behaviour is
  preserved exactly. `PACK-01` and `EXT-01` remain true retroactively.
- ⭐ **The composer budget was honoured to the letter** — no new `DropdownMenuTrigger`, no new
  top-level `<Button>`. Invite lives in the `+` menu that already held upload / connected files.
- ⭐ **Migration 188 actually populated the Financial Analyzer** — folder, document, chunks, plus
  `knowledge_folder_ids` and `member_skills`. **This closed the empty-bundle gap raised at
  handover**, and is why `PACK-05` is demonstrable rather than aspirational.
- **Empty folder scope is fail-CLOSED downstream** — the `tool_dispatcher` filter yields zero
  matches rather than unrestricted, which is the correct direction.

## Guardrails

- **G-2 FIRED and was honoured** — `/gsd:sketch` ran before planning; Option 1 (Action Tiles) was
  ratified as the winner before any implementation plan was authored.
- **G-8** — 3 plans, inside the 3-5 target.
- **Router stayed OUT of scope**, as the handover required. ⚠ The app still has **no router**, and
  nothing in this product is linkable — not a thread, not a run, not an Expert. **`/experts/<slug>`
  remains owed and is its own phase.**
- **The separation held for the third consecutive phase** — the builder fixed its own work and the
  reviewer re-drove it. The reviewer made **no source edits at all** in this phase.
