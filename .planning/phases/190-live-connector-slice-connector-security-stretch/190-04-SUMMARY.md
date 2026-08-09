---
phase: 190-live-connector-slice-connector-security-stretch
plan: 04
subsystem: planning-docs
tags: [roadmap-amendment, decision-register, mcp, connector-architecture, deploy-parity, hot-file-ledger, g5, g7, conn-02, conn-03]

# Dependency graph
requires:
  - phase: 189-governed-external-action-node-model
    plan: 16
    provides: "the precedent for correcting a ROADMAP clause with the superseded wording preserved inline"
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 03
    provides: "migrations 116 + 117, whose existence is what makes the cloud-parity queue re-derivable here"
provides:
  - "docs/CONNECTOR-ARCHITECTURE.md § 'Amendment — 2026-08-08 (Phase 190, D-01)' — appended, append-only, verdict untouched"
  - "the three structural reasons an MCP-backed action node cannot satisfy CONN-03, written where the next reader finds them"
  - ".planning/prd-reset/DECISIONS.md :: D-v3.6-02 — the superseding pointer entry, with D-v3.6-01 preserved and annotated"
  - "ROADMAP Phase-190 SC#1 corrected in the 189-16 style, '(MCP-backed action nodes)' preserved as struck-through superseded wording"
  - "D-32's scope fence restated verbatim in the ROADMAP Flags line (the G-7 written line a closure round must argue against)"
  - "the MEASURED cloud-parity queue: 104 -> 117, replacing two prose ranges that were each wrong at both ends"
  - "backend/app/services/harness/phase_types.py on CLAUDE.md's G-5 hot-file ledger with re-derivable figures"
affects: [190-13, 190-19, 190-secure-phase, open-platform-milestone, next-production-push]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "An amendment is APPENDED and dated; append-onlyness is asserted mechanically (`git diff -U0 | grep -c '^-[^-]'` = 0), not promised in prose"
    - "An amendment fences itself — the 'what does NOT change' list is what stops it being read as a reversal"
    - "A measured command in the doc beats a remembered claim: the amendment quotes the grep AND records that the grep is weaker than the test fence it cites"
    - "A superseded clause is struck through and kept, never deleted — otherwise the next reader concludes the roadmap always said this"
    - "Re-derive parity watermarks from git (`pending-cloud-migrations.sh`), never from the last document that quoted them"

key-files:
  created:
    - .planning/phases/190-live-connector-slice-connector-security-stretch/190-04-SUMMARY.md
  modified:
    - docs/CONNECTOR-ARCHITECTURE.md
    - .planning/prd-reset/DECISIONS.md
    - .planning/ROADMAP.md
    - CLAUDE.md

decisions:
  - "D-01's amendment is APPENDED as a dated section; the MCP-first / first-party-thin / Open-Platform-sequenced verdict is untouched in substance (0 lines removed from the doc)"
  - "D-v3.6-02 supersedes D-v3.6-01 on ONE clause only; D-v3.6-01 is preserved and carries a back-pointer so the supersession is legible from the old entry too"
  - "The cloud-parity queue is 104 -> 117. BOTH the ROADMAP's `099-113` and CONTEXT D-22's `099 -> 115` were wrong at BOTH ends; 099-103 are already on origin/production"
  - "phase_types.py's G-5 verdict is stated as FIRING (14 phases), not explained away — but deliberately not honoured in 190, because 190's change there is one function"
  - "190-RESEARCH's '~6th substantive touch on _exec_external_action's neighbourhood' is corrected to 2 commits / 1 phase (190 is the 3rd touch, 2nd phase)"

metrics:
  duration: "~35 min"
  completed: 2026-08-08
  tasks: 3
  commits: 3
  files-changed: 4
  production-source-files-changed: 0
---

# Phase 190 Plan 04: The D-01 ROADMAP Amendment Summary

The paper half of D-01: `docs/CONNECTOR-ARCHITECTURE.md` now carries a dated, append-only amendment recording that Phase 190 ships three first-party adapters behind an MCP-shaped seam and builds no MCP client — because a remote MCP server makes the outbound call in its own process, which puts the socket CONN-03 SC#2 must guard inside someone else's runtime.

## What Was Built

Nothing executable. Four documents, three commits, **zero production source files** (`git diff --numstat 86f914c5..HEAD` returns only `.planning/ROADMAP.md`, `.planning/prd-reset/DECISIONS.md`, `CLAUDE.md`, `docs/CONNECTOR-ARCHITECTURE.md`). `git diff backend/requirements.txt frontend/package.json` is empty — zero installs, satisfying threat T-190-SC.

### Task 1 — the appended amendment (`31cb7cea`, +86/−0)

`docs/CONNECTOR-ARCHITECTURE.md` § **"Amendment — 2026-08-08 (Phase 190, D-01): the first three connectors ship as first-party adapters behind an MCP-SHAPED seam"**.

It is an amendment, not a rewrite, and that is asserted rather than promised: `git diff -U0 docs/CONNECTOR-ARCHITECTURE.md | grep -c '^-[^-]'` printed **0**. Not one existing line was removed, renumbered or reflowed — including the doc's own dated 2026-08-07 re-open trigger and the 2026-08-08 two-way-connectors addition, both of which survive intact. This is the doc's own rule ("*never editing the verdict in place without a trace*") honoured literally.

Its six parts, in order:

1. **What changes, in one sentence** — only the clause that said the first three connectors would ride an MCP client on day one.
2. **What does NOT change** — four items, spelled out: MCP-first as the substrate direction; the be-callable-BY-the-tools-users-already-run bet (this app as an MCP *server*); first-party-thin as exactly this three-capability slice; broad catalog still deferring to Open Platform. The *"no arbitrary-code connector node, ever"* rule is named as untouched too.
3. **The three structural reasons**, each its own paragraph. Reason 1 carries the load-bearing sentence verbatim — *"the socket that matters is in someone else's process"* — and is flagged as the one that would be fatal alone. Reason 2: SC#4 would be satisfied for a credential that is not the one doing the sending. Reason 3: local MCP servers are a **second runtime**, which red line D-14 forbids in as many words.
4. **What ships instead** — one `ConnectorAdapter` protocol, three adapters whose sockets we own, the protocol deliberately MCP-shaped (named capability, JSON argument object, structured result, declared input schema) so a real MCP client registers adapters *through* the seam rather than beside it.
5. **The measured evidence** (below).
6. **The re-open trigger as a check** — a phase number appearing on `.planning/ROADMAP.md` for SEED-013.

### Task 2 — the register entry and the corrected criterion (`0fc1c2b8`, +20/−5)

`.planning/prd-reset/DECISIONS.md` gains **`D-v3.6-02`**, matching `D-v3.6-01`'s shape exactly (`## D-vX.Y-NN — title`, then `**Status:**` / `**Type:**`, then prose, then the closing "this is a pointer" sentence). It is a pointer: it does **not** restate the three reasons, because a pointer that duplicates its target rots. `D-v3.6-01` is preserved verbatim and gains one annotation line so the supersession is visible from the *old* entry as well as the new one — a reader who lands on `D-v3.6-01` by D-number cannot miss it. The Cross-references footer now names both entries as pointing at the same doc.

`.planning/ROADMAP.md` Phase-190 **Success Criterion 1** is corrected in the 189-16 / 185 house style:

> `(~~MCP-backed action nodes~~ **AMENDED 2026-08-08 … → FIRST-PARTY ADAPTERS behind an MCP-SHAPED seam; NO MCP client is built in 190**)` … *The superseded wording is preserved, not deleted.*

followed by the structural reason, an explicit **"Nothing is retreated from"** clause, the check-shaped re-open trigger, and the measured basis. `awk '/^#### Phase 190/,/^#### Phase 191/' … | grep -c "MCP-backed action nodes"` still returns **1** — the phrase a future reader would search for is still findable, marked as superseded rather than erased.

Three further edits inside the Phase 190 block:

- **Plans line verified against disk, not assumed.** `**Plans**: 19 plans in 8 waves`; `ls .planning/phases/190-*/190-*-PLAN.md | wc -l` → **19**; listed rows `^- \[.\] 190-` → **19**. All three agree, and `grep -c "Plans.*TBD"` → 0. No correction was needed — unlike 189-16, where the count self-contradicted.
- **D-32's scope fence restated verbatim in `**Flags**`** (all twelve items, with BUG-260808-02 marked DEFERRED-not-folded), closing with *"a round that adds one is a PHASE, not a gap."* This exists so a G-7 closure round has to argue against a written line rather than a remembered one.
- **The Phase 190 progress row** records plan 04's landing and the parity correction.

### Task 3 — parity proof and the ledger row (`00b682da`, +1/−0)

**A. Deploy-artifact parity is a no-op for this phase, and that is proved rather than asserted.** `bash scripts/check-deploy-drift.sh` → **`exit=0`**, `RESULT: PASS`, with 2 pre-existing non-blocking WARNs (seed-like migrations above #089 flagged for human review; `docker compose` unavailable in this shell, so the structural fallback ran — CI does the authoritative parse). `git diff --numstat deploy/onebox.env.example docker-compose.prod.yml docs/OPERATOR.md` prints **nothing**. The underlying reason, checked independently: `git diff 735d1033..HEAD -- backend/ frontend/ | grep -E '^\+.*(os\.getenv|os\.environ|settings\.[A-Z_]{4,}|import\.meta\.env)'` is **empty** across plans 01–03 — the phase reads **no new env var**, exactly as `190-RESEARCH.md` recommended, because all connector config lives in `connector_connections` and `SECRETS_ENCRYPTION_KEY` is reused unchanged. D-22's same-commit rule is therefore satisfied *by construction*, not by remembering to update three artefacts.

**B. `backend/app/services/harness/phase_types.py` joins the G-5 hot-file ledger**, with every figure produced by a named command (see Measured Figures). `git diff --numstat CLAUDE.md` → `1 0`; `git diff CLAUDE.md | grep -c '^-[^-]'` → **0** — one row appended inside the ledger table, nothing else in CLAUDE.md touched (not the ingestion rule, not the sandbox tag, not G-1…G-7).

## Measured Figures — every number here was re-derived, none inherited

| Figure | Command | Result |
|---|---|---|
| MCP code under `backend/app` | `grep -rni "\bmcp\b" backend/app --include=*.py \| wc -l` | **0** (unchanged from the 2026-08-07 measurement in the doc) |
| The real MCP fence | `python -m pytest tests/unit/test_189_no_egress.py -k mcp -q` | **2 passed, 0 failed**, 21 deselected |
| Amendment append-onlyness | `git diff -U0 docs/CONNECTOR-ARCHITECTURE.md \| grep -c '^-[^-]'` | **0** |
| Plan files on disk | `ls .planning/phases/190-*/190-*-PLAN.md \| wc -l` | **19** (matches the ROADMAP line and the 19 listed rows) |
| Deploy drift | `bash scripts/check-deploy-drift.sh; echo exit=$?` | **exit=0**, PASS, 2 non-blocking WARNs |
| `phase_types.py` commits | `git log --oneline -- backend/app/services/harness/phase_types.py \| wc -l` | **35** |
| `phase_types.py` size | `wc -l backend/app/services/harness/phase_types.py` | **1918** |
| `phase_types.py` distinct phases | `git log --format=%s -- <file> \| sed -E 's/^[a-z]+\(([^)-]+).*/\1/' \| sort -u` | **14** (091, 092, 093, 096, 098, 099, 101, 101.1, 102, 104, 120, 141, 185, 189) + 1 untagged `fix(ask_user)` |
| external-action neighbourhood | `git log --oneline -G"external_action" -- <file>` | **2** commits (`b09bb361` 189-09 created it; `8aa32de0` 189 WR-02) |
| Cloud-parity queue | `bash scripts/pending-cloud-migrations.sh` | **104 → 117** (fourteen files) |
| Production source touched | `git diff --numstat 86f914c5..HEAD` | **0** source files (4 docs only) |
| Package installs | `git diff 86f914c5..HEAD -- backend/requirements.txt frontend/package.json` | empty |

## Three Inherited Claims Measured FALSE

Per the standing "don't inherit unmeasured claims" rule, every figure this plan was handed was re-derived first. Three did not survive:

**1. The cloud-parity range was wrong in BOTH sources, and at BOTH ends.**

- ROADMAP said `migrations 099-113`.
- CONTEXT D-22 said `migrations 099 → 115`.
- Measured: **`104 → 117`**.

`git ls-tree --name-only origin/production supabase/migrations/` shows `099`–`103` are **already live** (production tip `4c9b487a`, the v3.3 Operator-UX deploy), so both prose ranges **over-stated the debt by five files** — the low end had gone unquestioned in both documents. At the high end the ROADMAP's `113` was stale by four (114 shipped with 185, 115 with 189, 116+117 at plan 190-03) and CONTEXT's `115` was stale by two. The plan asked which of the two conflicting ranges was wrong; the honest answer is **neither was right**. Derivation method: `scripts/pending-cloud-migrations.sh`, which diffs `HEAD` against `origin/production` — git is the only watermark this project has, because manual SQL-editor applies leave no other record. The bullet now says so and tells the reader to re-run the script rather than quote the line.

**2. `190-RESEARCH.md`'s "~6th substantive touch on `_exec_external_action`'s neighbourhood" is FALSE in both directions.** `git log -G"external_action"` on the file returns exactly **2** commits, both Phase 189 — so 190 is the **3rd** touch and only the **2nd phase** on that neighbourhood, not the 6th. But the FILE is considerably hotter than the research implied: **35 commits across 14 phases**. The ledger cell records both corrections with their commands, in the self-correcting style the `WorkflowCanvas.tsx` and `PhaseNodeCard.tsx` rows established.

**3. `grep -rni "\bmcp\b"` is a weaker fence than it looks — and the amendment says so.** The command returns 0, and the plan asked for that number quoted. It is quoted, but with the refinement Phase 189 discovered in `test_189_no_egress.py:60-70`: **`\bmcp\b` does not match `MCPClient`**, because after `MCP` comes `C` and there is no word boundary. So the amendment cites the *bare grep* as the historical measurement and names **Case A of `test_189_no_egress.py`** (`test_no_mcp_identifiers_in_backend_app`, with its own anti-vacuity control `test_the_mcp_matcher_actually_matches`) as the fence that actually keeps the zero true. Both were run: **2 passed**. Quoting the weaker command without saying it is weaker would have been exactly the inherited-claim failure this project keeps paying for.

## Deviations from Plan

**None that changed scope.** Three acceptance criteria were satisfied differently than their literal wording anticipated, each noted above rather than smoothed over:

1. The plan's Task-2 acceptance asked the summary to state *"which of the two conflicting ranges was wrong"*. Measurement found **both** were, at both ends. Recorded as such.
2. The plan's Task-3 premise (from RESEARCH) that this is `_exec_external_action`'s ~6th touch is corrected to the 3rd. The row still belongs on the ledger — the *file* fires G-5 hard at 14 phases — so the action was taken, with the reason restated accurately.
3. The plan's Task-1 acceptance asked for `grep -rni` with its measured `0`. Delivered, plus the honest caveat that the stronger fence is the test, not the grep.

**Not touched, deliberately:** the second `Cloud parity owed` bullet at `.planning/ROADMAP.md:940` still reads `099–113`. It belongs to the **shipped v3.5 milestone section** and is a historical record of what was owed at that close; editing it would rewrite history rather than correct a live number. The active-milestone bullet (line 739) is the one a deploy reads, and it is now measured.

## Threat-Model Dispositions

| Threat ID | Disposition | Evidence |
|---|---|---|
| T-190-04-01 (repudiation — quiet verdict rewrite) | **mitigated** | `git diff -U0 docs/CONNECTOR-ARCHITECTURE.md \| grep -c '^-[^-]'` = **0** |
| T-190-04-02 (tampering — a correction that erases its own history) | **mitigated** | `MCP-backed action nodes` still present in the Phase-190 block (count 1), struck through and dated; `superseded` present |
| T-190-04-03 (tampering — the zero-MCP claim) | **mitigated** | Fence RUN, not cited: `test_189_no_egress.py -k mcp` → 2 passed |
| T-190-04-04 (DoS — cloud deploy drift) | **mitigated** | `check-deploy-drift.sh` exit **0**; the three deploy artefacts have an empty numstat; zero new env vars read |
| T-190-04-G7 (tampering — scope creep in a closure round) | **mitigated** | D-32's twelve-item fence written into the ROADMAP Flags line |
| T-190-SC (supply chain) | **mitigated** | Documentation-only; `git diff` on `requirements.txt` / `package.json` is empty |

## No Threat Flags

No file changed here introduces network endpoints, auth paths, file access patterns or schema at a trust boundary. Documentation only.

## No Known Stubs

Nothing was stubbed. The amendment, the register entry, the corrected criterion, the fence restatement, the parity queue and the ledger row are each complete as written.

## For the Next Plan

- **190-13 (the executor)** inherits the amendment's substance: it wires `ConnectorAdapter` + registry, **not** an MCP client. If a later plan reaches for an MCP client, the ROADMAP Flags fence and `D-v3.6-02` are the written lines it must argue against.
- **190-19 (close)** should quote the cloud-parity queue as **104 → 117**, and should re-run `pending-cloud-migrations.sh` rather than quoting this summary.
- **The next phase that touches `phase_types.py`** now inherits a measured count (35 commits / 14 phases / 1918 L) and a named seam (one module per executor under `harness/phase_types/`). Per G-5, a phase that adds a *second* concern to that file produces a refactor recommendation first.
- **When SEED-013 gets a phase number**, that is the observable that re-opens D-01. It is written as a check in three places now: the amendment, `D-v3.6-02`'s target, and ROADMAP SC#1.

## Self-Check: PASSED

All four modified files exist on disk. All three task commits are reachable in `git log --all`: `31cb7cea`, `0fc1c2b8`, `00b682da`. No claimed artifact is missing.
