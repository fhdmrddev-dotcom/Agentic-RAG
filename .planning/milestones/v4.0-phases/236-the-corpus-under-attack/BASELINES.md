# Phase 236 — REVIEWER BASELINES (captured before the builder touched anything)

- **Captured by**: Claude (REVIEWER, AGENTS.md §6.1/§6.3 — builder is Gemini)
- **Date**: 2026-09-06
- **HEAD**: `f992f28e87a65b5e71337991d38ef4807576133f`
- **Working tree**: only `.agent-bus/OPEN.md` modified + untracked screenshots/graphify artefacts.
  **No source file dirty.** Zero Phase-236 source work had been done.

A baseline captured after the change measures the change against itself. These are the numbers
every later figure is compared against, and each was **re-derived**, not read from a claim.

## Gates

| Gate | Command | Baseline |
|---|---|---|
| CLAUDE.md size | `node scripts/check-claude-md-size.cjs` | **OK** — 80,822 chars, 53.9% of limit, headroom 69,178 |
| Backend unit | `pytest tests/unit -q --continue-on-collection-errors` (in `backend/`, venv) | ⚠ **CORRECTED — see below. First reading 71; TRUE baseline is 72 failed · 3930 passed · 2 xfailed · 2 xpassed · 0 collection errors** |
| Frontend count gate | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root) | ⛔ **VIOLATED — `failed 1`** · total **7787** · pinned total **6991** (`+796`) |

### ⚠ CORRECTION 2026-09-06 (at Phase 236 verification) — THIS FILE'S 71 WAS WRONG, AND THE ORIGINAL IS KEPT ABOVE RATHER THAN OVERWRITTEN

The first reading was `71 failed / 3931 passed`, taken in the main working tree and published here
as *"exactly the ceiling, zero headroom"*. **Re-measured at the same commit `f992f28e8`, in a
dedicated bootstrapped worktree, it reads `72 failed / 3930 passed` in 113.94s.** Two consecutive
runs on the phase tree also read 72 with byte-identical failure sets, so 72 is the stable figure
and the 71 was a single lucky sample.

⚠ **The consequence was real, not cosmetic:** when Phase 236's suite read 72 I first recorded the
ceiling as BROKEN and went looking for the builder's new failure. There was none — the sets diff to
empty in both directions. **A wrong baseline manufactures a defect in someone else's work.**

⚠ **The method error that made it undiagnosable: the first run was captured with `tail -30`, so it
preserved a COUNT and not a SET.** A count cannot be diffed and cannot attribute anything. Capture
the complete `FAILED` list every time:
`pytest tests/unit -q --continue-on-collection-errors 2>&1 | grep "^FAILED" | sort > <file>`

⚠ **CLAUDE.md's locked ceiling of `71` therefore does not match this tree either** — that is a
pre-existing discrepancy, not Phase 236's doing, and it needs an operator decision rather than a
silent edit.

⚠ **AGENTS.md §6.3:** this correction was written by the reviewer who published the wrong figure.
It is self-assessed; an independent re-derivation is worth having.

### Backend note
`71` is exactly the CLAUDE.md ceiling — **zero headroom**. Any new failure breaks the gate.
⚠ The passed count has grown: CLAUDE.md's v4.0 lock quotes `3497 passed`, this run reads **3931**.
The contract is the *failure ceiling*, not the passed total, so growth is the gate working.

### Frontend note — THE GATE IS RED AT BASELINE, AND IT IS **NOT** A FLAKE

Failing suite, taken from the gate's own persisted JSON **before any re-run** (SEED-171 procedure):

```
frontend/src/pages/__tests__/LibraryPage.initialTab.test.tsx
  X LibraryPage — initialTab ⭐ lands on Health when the CALLER asks for it — SURF-03's route exists at all
    Error: Unable to find an element by: [data-testid="health-coverage-ring"]
```

- **Byte-unchanged** (`git status --short` on the suite and on `LibraryPage.tsx` → empty).
- **NOT one of SEED-171's five cap-independent flaky suites** (those are `WorkflowsPage`,
  `library/WorkflowCard`, `WorkflowBuilderPage.session`, `WorkflowRunPage`, `WorkflowBuilderPage.canvas`).
- **Cause is named, in the repo, by another test**:
  `frontend/src/components/library/__tests__/SourcesAttentionSection.test.tsx:271` records verbatim
  that `health-coverage-ring` **"no longer exists"** and was re-pointed. `LibraryPage.initialTab.test.tsx:269`
  still asserts on it. **Phase 235 renamed the ring and updated one suite but not the other.**
- Last commits on the failing suite: `4e0b0323b` / `f88d0652a` / `4a59337c4` — all Phase 235.

⭐ **This red is INHERITED from Phase 235 and must not be attributed to Phase 236.** Equally, Phase 236
may not close on a green gate that was reached by deleting this assertion — the fix is to point it at
the ring's current testid, and that fix belongs to whoever owns the Phase 235 surface, not to the
adversarial-corpus work.

### Unpinned suites the gate ran but does not guard (`— N new`)
`PromptVariableChips` (3) · `RunHero` (18) · `automationFacts` (11) · `nodeEffectBanner` (8) ·
`toolReadOnlyMap` (7). TARGETS decides what RUNS; BASELINE decides what is GUARDED.

## Phase-236-specific baselines (the subject under test)

### Provider roster — derived from `MODEL_CAPABILITIES`, never re-typed
8 providers, matching the SC#10 roster rule exactly:

| provider | models | representative |
|---|---|---|
| anthropic | 7 | `claude-sonnet-5` |
| deepseek | 2 | `deepseek-v4-flash` |
| google | 7 | `gemini-2.5-pro` |
| minimax | 8 | `MiniMax-M2` |
| moonshot | 3 | `kimi-k2.6` |
| openai | 17 | `gpt-4o` |
| openrouter | 9 | `deepseek/deepseek-chat` |
| zhipu | 8 | `glm-4.5` |

### ⚠ SEED-188's own figures are STALE — corrected here, originals preserved

**(1) "FOUR modules carry the discipline" → the seed's own predicate now matches TWO.**
```
grep -rln "NEVER as a command\|ANTI-INJECTION" backend/app
  → eval_runner_service.py, skill_proposer_service.py   (+2 .pyc artefacts, not source)
```
`harness/phase_types.py` and `harness/validator_kinds.py` no longer match that wording.

**(2) The REAL defence surface at HEAD is EIGHT modules** (`treat .. as data|NEVER as a command|ANTI-INJECTION|prompt injection|untrusted content`):
```
backend/app/services/connectors/chat_tools.py
backend/app/services/connectors/service_tools.py
backend/app/services/embedding_service.py
backend/app/services/eval_runner_service.py
backend/app/services/harness/phase_types.py
backend/app/services/harness/validator_kinds.py
backend/app/services/skill_proposer_service.py
backend/app/services/tool_dispatcher.py
```
⭐ A corpus scoped to the seed's four would miss **`tool_dispatcher.py`** (the Phase 234 TRUST-03
fence) and **both `connectors/` tool modules** — which is where synced untrusted content actually
arrives, i.e. **exactly SC#1**.

**(3) "Zero prompt-injection tests" is stale.**
`backend/tests/unit/services/test_tool_dispatcher_trifecta_fence.py` ships **5 TRUST-03 cases**
(forced `ask` posture on mutating actions when connection content is in retrieval context; citation-
triggered fence; read-only actions unaffected; no-connection-content actions unaffected; already-denied
stays denied). SEED-188's finding is *narrower* than it was, not gone — none of these five puts
adversarial text in a document and asserts the model did not obey it.

## What SC#2 will be measured against

SC#2 requires that removing **any one named defence** turns the suite **red**, and that the output
names which defence was removed. The named set must be drawn from the **eight** modules above, and
the mutation drive must be run by the reviewer — a builder removing its own defence and observing
its own suite is self-assessment (AGENTS.md §6.3).
