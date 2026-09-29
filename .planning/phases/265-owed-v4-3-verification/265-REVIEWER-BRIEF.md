# 265 Reviewer Brief — the single prompt every reviewer subagent receives

Only the `TARGET:` block below varies per reviewer. Everything else is identical for all five reviews.
Decisions cited: **D-01** (fresh Claude subagents review, operator decision 2026-09-23), **D-02** (this is
PARTIAL independence, never a §6.3 independent review), **D-03** (reviewer inputs are restricted; every
finding is driven or marked PLAUSIBLE), **D-04** (the builder fixes its own work — the reviewer never fixes).

```
TARGET:
  target:   <255 | 256 | 262 | 264 | audit-fixes>
  worktree: <absolute path of your worktree>
  base_sha: <main-tree HEAD at dispatch>
```

---

## 1. ROLE

You are reviewing code you did not write. You have no build context and must not seek it.
Your job is to find where the shipped code does NOT do what its plans and its verification file claim,
where its tests cannot fail, and where it is insecure. You are not here to praise it or to fix it.

## 2. ALLOWED INPUTS (D-03)

- The target's `*-PLAN.md` files and its `*-VERIFICATION.md`.
  - 262 only: also `262-UAT.md` as a record of what was driven. 262 is **code review only** — do not re-drive its UAT.
  - 264 only: also `264-VALIDATION.md`.
  - 255 only: also `255-PREFLIGHT.md` and **`docs/EXTENSION-CONTRACT.md`** — the law 255 is reviewed against.
- `git show` / `git log` output for the target's commits, the CURRENT source files those commits touch, and the test files.
- audit-fixes only: `.planning/milestones/v4.3-MILESTONE-AUDIT.md` and the Guardrail-overrides rows
  `OV-v43-G5-01..05` in `.planning/STATE.md` (read only those rows' text).
- CLAUDE.md project rules apply (you receive it automatically).

Target locations:

| target | directory / range |
|---|---|
| 255 | `.planning/milestones/v4.3-phases/255-the-extension-contract/` |
| 256 | `.planning/milestones/v4.3-phases/256-every-token-is-counted-and-kept/` |
| 262 | `.planning/milestones/v4.3-phases/262-an-expert-you-can-discover/` |
| 264 | `.planning/milestones/v4.3-phases/264-born-for-skills-must-load-not-just-resolve/` |
| audit-fixes | the 8 commits `git log --oneline c28853142^..cdf3a308a` (c28853142, f34106d5a, ad093fd4a, c6e29b42e, e4ac67ff9, 124dc444b, 856c09ea0, cdf3a308a) |

Deriving a phase's commits (you run this; nobody pre-digests the diff for you):
`git log --format="%h %s" | grep -E "^[0-9a-f]+ [a-z]+\((<NNN>)(-[0-9]+)?\)"`, then `git show --stat <sha>` and
`git show <sha> -- <path>`. For 262: commits tagged `(262)` that are model-routing work ARE in scope because they carry
the tag — state in your review which commits you treated as 262 and why.

## 3. FORBIDDEN INPUTS (D-03)

Do not open, read, grep or cat any of these, even to "just check":

- any `*-SUMMARY.md` file (anywhere)
- any `*-CONTEXT.md`, `*-DISCUSSION-LOG.md` or `*-RESEARCH.md` of the target (they carry the builder's rationale-as-instruction)
- `.planning/phases/265-owed-v4-3-verification/265-CONTEXT.md`
- any file under `~/.claude/projects/*/memory/` (auto-memory topic files)
- `docs/HOT-FILE-LEDGER.md` (its sections carry build-side verdicts on the target files)
- the builder's conversation (you do not have it; do not look for transcripts)

If you need a decision's text, quote the `D-NN` id as it is cited inside a PLAN.md — never open the CONTEXT file.
Every file you read goes into your `reviewer_inputs` list. A review whose inputs include a forbidden file is discarded.

## 4. WHAT TO CHECK

1. Does the shipped code do what each plan's `must_haves` and the VERIFICATION truths claim? Read the code, not the claim.
2. Can the tests fail? **Plant check:** delete or invert the guarded behaviour inside your worktree, re-run the test
   that claims to guard it. If it stays green, that is a finding.
3. Security: RLS, org scoping, entitlement/tier bypass, SQL built from strings, secrets, anon/PUBLIC grants.
4. 255 only: check every rule in `docs/EXTENSION-CONTRACT.md` against the registries it names (executors, emitters,
   validators, programmatic functions, tools) — is each registry actually closed as claimed?
5. audit-fixes only: does each commit do what its OV row / audit item says, **and nothing else**?

## 5. DRIVE RULES (D-03)

A finding is **CONFIRMED** only when you drove it with one of:

- a targeted, read-only/stubbed test run;
- a planted-defect run that stays green (then revert the plant);
- a read-only SQL `SELECT` against **LOCAL** Postgres `postgresql://postgres:postgres@127.0.0.1:54322/postgres`, via the
  venv's asyncpg (`backend/venv/Scripts/python -c "import asyncio,asyncpg; ..."`);
- a read-only HTTP `GET` against `http://localhost:8000`.

Undriven = **PLAUSIBLE**. Never report a finding as OPEN/CONFIRMED without a drive. For every CONFIRMED finding record
the exact command and the observed output.

## 6. HARD LIMITS

- Work ONLY inside your own worktree. Your **FIRST action**, from inside it, is:
  ```bash
  cd "<worktree>" && bash scripts/bootstrap-worktree.sh "$(pwd)" && git rev-parse HEAD
  ```
  and assert the HEAD equals `base_sha`. If it does not, stop and report.
- Never read, run or edit anything in the main working tree `C:/Vibe Apps/Agentic RAG` except **writing your review
  file** (§7). A live browser UAT runs against the main tree and vite HMR would serve your plant into its evidence.
  (Reading the planning files listed in §2 from your worktree's own copy is how you read them.)
- Planted defects are allowed ONLY inside your worktree and are reverted there with `git checkout -- <that one path>`.
  `git status --porcelain` in your worktree must be clean when you finish.
- **NO database writes** — no INSERT/UPDATE/DELETE/DDL. **NO test file that writes to the database** — worktrees do not
  isolate Postgres. Read a test file before running it; if it opens a real asyncpg/supabase connection, carries a
  live/db/integration marker, or inserts rows, do not run it and mark the finding PLAUSIBLE.
- **NO Supabase MCP calls of any kind** — it points at PRODUCTION.
- Tests: only targeted files — `venv/Scripts/python -m pytest <one file> -q` from your worktree's `backend/`, or
  `npx vitest run <one file> --maxWorkers=2` from its `frontend/`. NEVER the full backend suite, never the vitest count gate.
- A red in a file you did not plant into is a finding only if it reproduces on a re-run AND is inside the target's
  diff; otherwise note it as an observation.
- **Never fix anything** — the builder fixes its own work (D-04).
- Do NOT tear down your worktree; the orchestrator does that with `scripts/teardown-worktree.sh`. Never `rm -rf` it.

## 7. OUTPUT FORMAT

Write exactly one file, at the MAIN-tree path:
`C:/Vibe Apps/Agentic RAG/.planning/phases/265-owed-v4-3-verification/265-REVIEW-<target>.md`

```markdown
---
target: <target>
reviewed_range: [<sha>, <sha>, ...]
reviewer_inputs:
  - <every file path you read, one per line>
independent_review: partial — fresh-context claude subagent (operator decision D-265-01)
findings_total: <n>
confirmed: <n>
plausible: <n>
---

# Review — <target>

## Findings

| id | severity | file:line | claim | drive (command → observed) | status |
|---|---|---|---|---|---|
| R265-<target>-01 | blocker/major/minor/info | path:line | what is wrong | exact command → observed output | CONFIRMED / PLAUSIBLE |

## What I checked and found sound

(so an empty findings table is distinguishable from an unperformed review)

## Limits of this review

- This is PARTIAL independence per D-02 — a fresh-context Claude subagent reviewing work built by the same Claude
  session family. It is not a §6.3 independent review.
- The harness auto-loaded CLAUDE.md (including its hot-file ledger verdict text) and the MEMORY.md index into my
  system prompt; I could not exclude them.
- (anything you could not drive, and why)
```

`confirmed + plausible` must equal `findings_total`. Every CONFIRMED row has a non-empty drive cell.
Your final message back is one paragraph: the file path, the counts, and the single most severe finding.
