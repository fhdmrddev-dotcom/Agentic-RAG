---
phase: 189
plan: 03
subsystem: documentation
tags: [wave-1, sc3, recorded-decision, connectors, mcp-first, no-source-change, no-egress]
requires:
  - ".planning/research/deep-dive/{BEAM,GLEAN,N8N}.md (the 2026-07-24 crawl — read, not re-run)"
  - ".planning/seeds/SEED-013-external-integrations-api-mcp.md + SEED-014-automations-routines.md"
  - ".planning/prd-reset/DECISIONS.md D-v3.4-01 (the POINTER-entry shape D-10 mandates)"
  - "docs/SANDBOX-PACKAGES.md (the docs/ convention model: SCREAMING-KEBAB, no front matter, one H1, a 'Why this doc exists' blockquote)"
provides:
  - "SC#3 IN FULL — the own-framework-vs-Open-Platform verdict recorded durably under docs/, independent of every line of 189 code"
  - "docs/CONNECTOR-ARCHITECTURE.md — the verdict, its five-source basis, what it does NOT decide, and a DATED (2026-08-07) three-trigger re-open clause"
  - "D-v3.6-01 — the first v3.6 per-milestone entry in the D-numbered register, as a POINTER"
  - "the CLAUDE.md line that makes the sixth docs/ file discoverable rather than orphaned"
affects:
  - "189-16 (phase verification — SC#3 is now satisfiable by three greps, with no dependency on the engine, the migration or the canvas)"
  - "Phase 190 (CONN-02/03) — the doc names the credential model, the egress guard and the MCP spec-version pin as ITS work, not this phase's"
tech-stack:
  added: []
  patterns:
    - "docs/ convention copied exactly from SANDBOX-PACKAGES.md: SCREAMING-KEBAB filename, no YAML front matter, single H1, '> Why this doc exists' blockquote naming the dated cause"
    - "register entry copies D-v3.4-01's POINTER shape (Status/Type header pair, 2-4 short paragraphs, a closing 'this is a pointer; the full text lives in X' sentence) and deliberately NOT D-PRD-15's ### Context/### Decision/### Consequences full-ADR shape"
    - "every re-open trigger carries its own one-line OBSERVABLE, so a future reader can tell whether it fired rather than re-arguing it"
key-files:
  created:
    - docs/CONNECTOR-ARCHITECTURE.md
  modified:
    - .planning/prd-reset/DECISIONS.md
    - CLAUDE.md
decisions:
  - "The D-entry names CONN-01 as HALF discharged, not complete: this plan ships the recorded-decision half; the governed external_action node is code and CONN-01 stays Pending. requirements.mark-complete was deliberately NOT run."
  - "The basis is a BULLET LIST, not a table. grep -c '^|' on the doc returns 0 — a source table risked reading as the competitor scoring matrix D-11 forbids, and a reader cannot tell a 'basis matrix' from a 're-validation matrix' by shape alone."
  - "The doc states the measured zero-MCP-code fact (grep -rni '\\bmcp\\b' backend/app --include=*.py -> 0 hits) and that Phase 190 is STRETCH, so there is a real accepted path where the decision stands recorded and no connector ever ships. SC#4 constrains the prose, not just the code."
  - "The CLAUDE.md pointer went in the Rules list (one bullet) rather than into the Deployment or Sandbox sections — the verdict is a standing project rule about how this app reaches outside, and the Rules list is where a single-clause pointer costs no reflow."
metrics:
  duration: "~30 min"
  completed: 2026-08-07
  tasks: 2
  commits: 2
  files_created: 1
  files_modified: 2
  tests_added: 0
---

# Phase 189 Plan 03: SC#3 — The Recorded Connector Verdict Summary

**Success criterion #3 is shipped in full, and it now depends on nothing else in this phase:** the
MCP-first / first-party-thin / Open-Platform-sequenced verdict has a durable, discoverable, dated
home under `docs/`, and a citable `D-v3.6-01` pointer in the register `CLAUDE.md` points at.

## What was built

Three files, no source code, no test, no dependency, no egress.

### 1. `docs/CONNECTOR-ARCHITECTURE.md` — 137 lines (new)

Section headings, in order:

| Heading | What it holds |
|---|---|
| `# Connector architecture — the own-framework-vs-Open-Platform verdict` (H1) | the "what this is" paragraph + the `> Why this doc exists` blockquote |
| `## The verdict` | MCP-first / first-party-thin / broad-catalog-sequenced, each clause spelled out, plus the no-arbitrary-code-node corollary |
| `## What this decision is based on` | the five named sources + the SEED-031 correction + the measured zero-MCP-code status |
| `## What it does NOT decide` | credentials, the SSRF/egress guard, who may extend the set, the MCP spec-version pin — all CONN-02/03 |
| `## The re-open trigger` | dated 2026-08-07; three triggers, each with an observable |
| `## Where the governed node model lives` | the 189 `external_action` node, and that 190 owns the first real call |

Conventions matched to `docs/SANDBOX-PACKAGES.md` exactly: SCREAMING-KEBAB filename, **no YAML front
matter**, one `#` H1, `##` sections, and a `> Why this doc exists` blockquote naming the dated cause
(here: the verdict was reached 2026-07-24 and then lived only in a research crawl and two dormant
seeds, where a decision reads as still-pending — which is D-10's rejected alternative stated as the
reason the file exists).

### 2. `.planning/prd-reset/DECISIONS.md` — +14 lines

Exact new heading:

```
## D-v3.6-01 — Connector-Architecture verdict (records CONN-01's decision half)
```

Placed at `:1411`, strictly after `D-v3.4-01` (`:1400`) and before `## Cross-references` (now
`:1424`), plus one bullet added inside `## Cross-references`. It copies `D-v3.4-01`'s pointer shape:
a `**Status:** Ratified 2026-08-07` / `**Type:** Per-milestone architectural decision (v3.6).` header
pair, short paragraphs naming only *what is locked* and *which requirement it discharges*, and the
closing sentence **"This is a pointer; the full text lives in `docs/CONNECTOR-ARCHITECTURE.md`."**

### 3. `CLAUDE.md` — +1 line, verbatim

```
- External integrations / connectors follow the recorded MCP-first verdict — `docs/CONNECTOR-ARCHITECTURE.md` (MCP-first, first-party-thin, broad catalog sequenced with Open Platform; dated re-open trigger inside; pointer entry `D-v3.6-01`). No MCP client exists in the backend today; live outbound egress is Phase 190 (STRETCH).
```

Added to the `## Rules` list after the Settings bullet. `git diff --stat CLAUDE.md` = **1 insertion,
0 deletions** — the T-189-09 cap (a reflow of a binding rules file is a diff nobody can review) held.

## Verification — measured, not asserted

| Check | Command | Result |
|---|---|---|
| No YAML front matter | `head -1 docs/CONNECTOR-ARCHITECTURE.md` | `# Connector architecture — …` ✅ single `#`, not `---` |
| Plan's own verify (task 1) | `grep -c "MCP-first" docs/CONNECTOR-ARCHITECTURE.md` | **3** ✅ |
| Basis named | `grep -c` × `SEED-013` / `SEED-014` | **9** / **5** ✅ |
| Crawl named | `grep -c` × `BEAM.md` / `GLEAN.md` / `N8N.md` | **1** / **1** / **1** ✅ |
| SEED-031 category-error guard | `grep -c "SEED-031"` | **2** ✅ (named only to say it is the LLM-provider seed, NOT connectors) |
| Re-open trigger present + dated | `grep -ci "re-open trigger"` / `grep -c "2026-08-07"` | **2** / **2** ✅ |
| Three triggers, each observable | `grep -c "Observable:"` | **3** ✅ |
| **No competitor scoring table (D-11)** | `grep -c "^\|" docs/CONNECTOR-ARCHITECTURE.md` | **0 table rows** ✅ |
| Plan's own verify (task 2) | `grep -c "D-v3.6-01" .planning/prd-reset/DECISIONS.md` | **2** ✅ (heading + Cross-references bullet) |
| Ordering | `grep -n '^## D-v3.4-01\|^## D-v3.6-01\|^## Cross-references'` | **1400 < 1411 < 1424** ✅ strictly between |
| **Not the full-ADR shape (D-10)** | `sed -n '/^## D-v3.6-01/,/^## Cross-references/p' … \| grep -c '^### '` | **0** ✅ no Context/Decision/Consequences |
| Discoverable | `grep -c "CONNECTOR-ARCHITECTURE" CLAUDE.md` | **1** ✅ |
| Blast radius | `git diff --stat 16270346..HEAD` | **3 files, 152 insertions, 0 deletions** — no source file, no test file ✅ |

**Test baselines were not re-run, and that is a reasoned omission rather than a skip:** this plan
touches zero `frontend/src`, zero `backend/app` and zero test files, so neither the vitest count gate
nor `npx tsc --noEmit -p tsconfig.app.json` has an input that could have moved. The plan's
`<verification>` says the same ("neither needs re-running for this plan, but neither may move
because of it").

## How the two anti-vacuity lessons from waves 1's earlier plans were applied

189-01 found a mandated control that falsified its own plan's regex; 189-02 found the plan's named
test file was the wrong file entirely. Both are the same failure: an inherited claim believed rather
than measured. Applied here:

- **Every anchor was re-derived, none inherited.** `DECISIONS.md` measured **1424 L before the
  edit** (the plan's stated figure — it held); `D-v3.4-01` and `## Cross-references` were located by
  string search, and their line numbers were only *read off afterwards*. `.planning/research/deep-dive/`
  was listed, not assumed: **exactly three files**, BEAM/GLEAN/N8N, as CONTEXT claimed.
- **No doc-fence grep test was invented.** This plan's verification is a set of greps whose expected
  values would change if the content were wrong (`^|` = 0 is the D-11 guard; `^### ` = 0 inside the
  new section is the D-10 guard). Neither is vacuous — both are counts of a thing the *rejected*
  shape would produce.

## Deviations from Plan

None on the plan's two tasks. One out-of-scope discovery, logged and **not** fixed:

**`docs/DEPLOYMENT-PIPELINE.md` exists on disk but is NOT tracked by git** (`git ls-files docs/`
returns four files; `git check-ignore` says it is not ignored). So the plan's phrase "all five
shipped `docs/` files" is true on disk and **false in the repository** — `CLAUDE.md:41` points at a
doc that has never been committed, and a fresh clone does not have it. This predates this plan, is
in nobody's blast radius here, and committing another author's untracked file is not this plan's
task. **Recorded for routing** — it is a one-file `/gsd:fast` (`git add docs/DEPLOYMENT-PIPELINE.md`)
once someone confirms the on-disk copy is the intended one. It does not affect this plan's must_have,
which is about `CLAUDE.md` *naming* the docs (that holds for all six).

## Requirements

**CONN-01 stays `Pending` and was deliberately NOT marked complete.** This plan discharges only its
recorded-decision half (SC#3); the governed `external_action` node — the other half of CONN-01's own
sentence — is 13 plans of code that have not shipped. `requirements.mark-complete` was not run.

## Threat surface

No new surface. The plan's register disposed T-189-08 (`accept`) and T-189-09 (`mitigate`), and both
held: the doc names **no** credential, endpoint, API key, internal hostname or IP (the n8n CVE's
metadata address was deliberately left out of the basis paragraph), and `CLAUDE.md` moved by exactly
one added line. Nothing in the doc implies an MCP client exists — it states the opposite, with the
measurement.

## Commits

| Commit | What |
|---|---|
| `d280f1c2` | `docs(189-03): record the MCP-first connector verdict under docs/` |
| `7b0e3e10` | `docs(189-03): add D-v3.6-01 pointer entry + the CLAUDE.md discoverability line` |

## Self-Check: PASSED

All three claimed files exist on disk (`docs/CONNECTOR-ARCHITECTURE.md`,
`.planning/prd-reset/DECISIONS.md`, `CLAUDE.md`) and both claimed commits resolve in
`git log --oneline --all` (`d280f1c2`, `7b0e3e10`).
