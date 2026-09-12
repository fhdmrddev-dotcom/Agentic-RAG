# Phase 245: The Verification Debt — Discharged or Retired in Writing - Context

**Gathered:** 2026-09-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Every v4.0 row that was never driven gets a verdict a person can read, and no phase's record calls a
self-verification a review — so v4.2 opens on ground whose measured extent is known.

**In scope:** 238's UAT residue (M-9 driven, M-8's headline corrected, S-1/S-2 retired in writing);
233's five G-4 operator rows driven live; the `verification_mode: self-verified` marker added to
238/240/241 plus an executable guard for it; SC#4 confirmed by citation; the stale-register
corrections named below.

**Out of scope:** any source change beyond a G-3-sized fast-fix (see D-15); 240's five mail G-4 rows
(deferred with triggers per D-12); a re-review of 238/240/241 (D-01 — DEBT-03 is an honesty
requirement, and re-reviewing is the named failure mode); a seeds-register sweep (D-14).

⛔ **Target 2-3 plans.** This is deliberately the smallest phase in the milestone, and the ROADMAP
names the temptation to grow it as the consolidation-milestone failure mode.

</domain>

<measured_at_head>
## ⚠ THREE OF THE FOUR SUCCESS CRITERIA ARE NOT IN THE STATE THE ROADMAP DESCRIBES

**Measured at HEAD on 2026-09-13 during this discussion, against the artifacts rather than against
the register.** This section is load-bearing: a planner reading the ROADMAP's scope text alone would
plan a phase whose largest task is already done, and would plan a re-drive of nine rows that were
driven six days ago. ⚠ **The precedent for why this check happened at all:**
`feedback_a_review_is_a_claim_about_code_not_the_code` — on 2026-09-10 two Phase 239 criticals were
escalated as live when they had been fixed two days earlier, in an ancestor of the escalator's own
base commit. **Each register only knows the one below it; the artifact is the bottom.**

| SC | What the ROADMAP / REQUIREMENTS / STATE.md say | **Measured at HEAD** |
|---|---|---|
| **#1** — 238's nine UAT rows | "blocked on one Azure app registration"; "⚠ **M-1 is driven first — it unblocks the other eight**" | ⭐ **ALL NINE ALREADY DRIVEN** on 2026-09-07 — `238-VERIFICATION.md:208-220`: **7 full pass, 2 half (M-8, M-9)**, S-1/S-2 ⛔ blocked on `SEED-256`. The operator completed the Azure registration *hours after* 238-SUMMARY was written (`238-SUMMARY.md:176-178`). **Four defects were found by driving and none by the 15-case unit suite.** |
| **#2** — 233's five G-4 rows | owed since the phase shipped, never run | ✅ **TRUE — genuinely owed.** The five rows are written verbatim at `233-VERIFICATION.md:80-88`, and *"Run row 2 first — it is the one criterion whose failure is invisible from the screen"* is already recorded there. **This is the phase's only substantial drive.** |
| **#3** — "self-verified" present, "reviewed" absent | three files to fix | ⚠ **All three ALREADY say it in prose, in their opening paragraph** (`238:3-9`, `240:9-13`, `241:25-29`). None carries a machine-readable marker. `reviewed` appears **11× in each**, in honest sentences *naming the review that is owed*. **SC#3 taken literally would delete the honesty it exists to protect.** |
| **#4** — `OV-SOLO-01` ruling in STATE.md | pending | ⭐ **ALREADY WRITTEN IN FULL** at `STATE.md:474-497`. All four elements present: solo continues · the dispatched code-review subagent is MANDATORY on trust boundaries and **is NOT an independent gate** · `/code-review ultra` ruled out on cost · re-arm trigger = *"Gemini's quota returns, or the v4.1 close, whichever is first."* |

### The stale claim has three register homes plus a memory file

*"238's nine rows are blocked on one Azure app registration, run M-1 first"* is **false at HEAD** and
appears in:

1. `.planning/ROADMAP.md` → Phase 245 SC#1 and its Flags block
2. `.planning/REQUIREMENTS.md:160-163` → DEBT-01, and the traceability row at `:208`
3. `.planning/STATE.md` → "⛔ Two UAT sets are credential-blocked", item 4 (~`:379-387`)
4. `~/.claude/projects/C--Vibe-Apps-Agentic-RAG/memory/project_238_built_unreviewed.md` —
   *"9 UAT rows owed on ONE Azure app registration"*

⚠ **A second stale claim, independently measured:** the Flags block says *"`SEED-177` still reads
`status: planted`"*. It reads **`status: partially-answered`**, and its own frontmatter already
records the egress-fence trigger as *"ANSWERED by Phase 206 (2026-08-25)"*. **CLAUDE.md carries the
same false sentence**, so this one has two homes too.

⚠ **A count ambiguity to resolve, not inherit:** 238's table holds **eleven** rows — `M-1…M-9` plus
`S-1`, `S-2` — and its footer reads *"9 rows driven … 2 blocked (S-1, S-2)"*. So **"nine" = the M
rows**, and S-1/S-2 are two additional rows, not a subset. REQUIREMENTS' DEBT-01 wording
(*"9 UAT rows … SharePoint rows S-1/S-2 sit separately"*) agrees; STATE.md item 4 (*"238 | 9 |
blocked on … SharePoint rows S-1/S-2 separately on SEED-256"*) reads as though 9 includes them.
**Plans must say eleven-or-nine explicitly rather than repeating the bare number.**

</measured_at_head>

<decisions>
## Implementation Decisions

### DEBT-03 — the honesty marker (SC#3, SC#4)

- **D-01:** **DEBT-03's deliverable is a greppable marker plus untouched prose.** Add
  `verification_mode: self-verified` with the ⛔ `OV-SOLO-01` comment to all three VERIFICATION.md
  files — 243's established pattern, verbatim from `243-VERIFICATION.md:4`:
  `verification_mode: self-verified   # ⛔ OV-SOLO-01 / D-243-12 — NEVER "reviewed". No independent §6.3 reviewer exists.`
  **241 gains the field inside its existing frontmatter; 238 and 240 have NO frontmatter at all and
  gain a block.** ⛔ **Every honest sentence about the owed review stays.** Rationale: SC#3's
  *"does not find 'reviewed'"* is unsatisfiable — 33 occurrences across the three files are honest
  prose naming an owed review — and satisfying it literally would destroy the record. What
  *"cannot lapse unnoticed"* actually needs is machine-checkability, which prose does not give.
  ⛔ **This is NOT a licence to audit all 33 occurrences** — that was the rejected option, and it is
  the re-review the ROADMAP forbids.

- **D-02:** **Ship an executable guard, driven RED before it is trusted.**
  `scripts/check-verification-honesty.cjs` (naming follows the seven existing `scripts/check-*.cjs`)
  fails when a `*-VERIFICATION.md` lacks `verification_mode`, or carries a verdict-claiming
  "reviewed" while `OV-SOLO-01` is live. ⛔ **Drive it RED against a planted defect and restore the
  file md5-identical** — this project's standing rule is that a guard nobody has seen fire is not a
  guard. Rationale: 243 and 244 carry the field only because those phases remembered to; nothing
  checks it. CLAUDE.md's own finding is that *a fact in a register nobody re-reads is the same as no
  fact*, paid for twice on the `tsc --noEmit` gate alone.

- **D-03:** **The guard fires as a PostToolUse hook on any `*-VERIFICATION.md` write**, mirroring
  `.claude/hooks/hot-file-ledger-guard.js` (PostToolUse on a PLAN.md write). Rationale: it fires in
  the turn the verifier authors the file, not days later. CLAUDE.md's measured argument against
  CI-only applies directly — `develop` once ran **634 commits over 8 days without a push**, so an
  `on: push` gate could not have fired once in that window, and a verification written and committed
  in one session would slip past it entirely. ⛔ No CI backstop in this phase (the rejected third
  option) — it is a second file to keep in sync over a planning-doc rule.

- **D-04:** **SC#4 is discharged by citation, not by rewriting.** Record in 245's verdict that SC#4
  was measured satisfied at `STATE.md:474-497`, quoting the four elements and the re-arm trigger
  verbatim; touch STATE.md only to note the confirmation. ⛔ **Do not re-derive or overwrite the
  operator-authored ruling** — a criterion already true is discharged by evidence. ⚠ Making the
  re-arm trigger itself executable was **considered and NOT taken**; if a plan wants it, it is a new
  decision, not an extension of this one.

### DEBT-01 — 238's residue (SC#1)

- **D-05:** **Drive M-9 in full, through BOTH doors.** Create a `path contains '/Finance/'`
  classification rule through the real surface
  (`frontend/src/components/classification/RuleBuilderPanel.tsx`), then confirm it fires for a file
  that IS in that folder via **the watch loop AND the manual-import door**. Rationale: the
  manual-import arm is exactly where Defect 3 lived (`metadata.source` had two writers; only the
  watch one was fixed), so the arm with the worse track record is the one that must be driven. The
  connection is active and both doors work, so it is drivable today. ⛔ The half-arm-only option was
  rejected for this reason.

- **D-06:** **M-8's headline flips to ✅ PASS with its half-pass history preserved inline.** Its
  failing half — a disabled connection still reading — was fixed the same day at the choke point
  (`SourceRegistry.get_adapter` raising `SourceConnectionDisabled`), driven both directions on that
  row, and `BUG-260907-03` is closed. ⛔ **Do NOT re-drive it** (the rejected option): re-driving
  means disabling a live integration again for a result already in the file. Rationale: a row whose
  headline reads HALF PASS while its body reads FIXED is DEBT-03's failure mode mirrored — the
  document contradicts itself and a reader believes the wrong half. SC#1 admits only pass / blocked /
  retired, and "half" is none of those.

- **D-07:** **S-1 / S-2 are retired in writing across all three registers, in ONE commit** — 245's
  verdict file, `REQUIREMENTS.md`'s DEBT-01 row, and `SEED-256`'s frontmatter. This is the
  same-commit sync rule already used for `Dockerfile.sandbox` ↔ `docs/SANDBOX-PACKAGES.md` and for
  the hot-file ledger. Ground: `SEED-256` alone (no M365 work/school tenant), **confirmed live** —
  `check()` returned `drive_type: personal`. `SEED-256` already carries four concrete re-open
  triggers, so its side is a status flip plus a pointer, not new prose. ⛔ Seed-only was rejected:
  CLAUDE.md's own measurement is that the seeds register is swept by **nothing**, so a retirement
  held only by a seed is held by nothing.

- **D-08:** **Corrections go BESIDE the original, never over it** — in all four homes listed in
  `<measured_at_head>` (ROADMAP, REQUIREMENTS, STATE.md, the memory file). This is the house style
  and the project's most-repeated lesson: the CLAUDE.md count-gate figures, the `threads.py`
  superlative, the `sourceComposition` red figure each keep the wrong original with a dated
  correction beside it, **because the rot being visible IS the finding**. ⛔ Overwriting was
  rejected: it erases the evidence that three registers carried one false claim for six days, which
  is this phase's most transferable output.

### DEBT-02 — driving 233's five rows (SC#2)

- **D-09:** **Fixture is a dedicated throwaway Drive folder imported into an obviously-deletable
  Library folder.** A handful of files, **including one native Google Doc** (see D-11). Follows
  243's precedent — it seeded a 60-message thread titled *"deletable"* and left it in place for the
  row still owed. Purely additive, no existing row touched. ⭐ **The operational payoff: row 2's
  four-table unchanged-check becomes trivially provable, because the baseline is a folder that did
  not exist before.** ⛔ An existing real folder was rejected for re-introducing a live-corpus
  baseline.

- **D-10:** **The operator does the Drive-side setup; Claude drives rows 1-4 in a real browser.**
  Operator: create the throwaway Drive folder and confirm the Google connection is live (OAuth is
  the operator's; memory records Drive needing enabling in project `877112366454`). Claude: drive the
  rows via Chrome MCP, reading the database directly for row 2. ⚠ **Run row 2 first** — already
  named in `233-VERIFICATION.md:88` as the one criterion invisible from the screen. Rationale: the
  split follows the real boundary — credentials and source-side writes are the operator's,
  observation is Claude's. 243 established that self-driving is sound **when attribution is
  verifiable**, which it is here (one connection, not eight providers).

- **D-11:** **Row 5 runs after row 3, off the same fixture.** A native Google Doc rides in the
  throwaway folder; row 3's confirm imports it; row 5 then re-previews the same folder and checks
  that Doc reads *can't tell* → *already here*. ⭐ One fixture serves all five rows and the
  dependency becomes drive ORDER rather than extra setup. ⚠ **Rows 4 and 5 overlap** — both
  re-preview after an import — **so they may share one observation pass with two distinct
  assertions**, but each still gets its own written verdict.

- **D-12:** **Verdicts land in ONE `245-UAT-RESULTS.md`, in 243's shape** — frontmatter carrying
  `rows_driven` / `rows_partial` / `rows_owed`, plus a section per row. ⛔ Per-row files (244's shape)
  were rejected: they earn their keep when each row rides its own plan (244 had six), and this phase
  targets 2-3 plans, so five files would be overhead against G-8. ⚠ **The file covers 233's five
  rows AND 238's M-9 AND the 237 click — but every row states which requirement it discharges**
  (DEBT-01 vs DEBT-02), since the filename no longer says.

### Owed elsewhere — named, not folded

- **D-13:** **240's five G-4 mail rows are DEFERRED with a trigger each, not folded.** Out of 245's
  scope by the ROADMAP's own wording; folding five more live rows (M-4 disables a live integration,
  M-5 deletes at the source) into a 2-3 plan phase is the consolidation failure mode. ⛔ **But
  silence is how they got here** — all five are recorded in 245's verdict with a named trigger (the
  next phase touching mail ingestion, or the v4.1 close sweep), because *"the next milestone opens on
  ground whose measured extent is known"* is this phase's actual goal. ⚠ Note for the record:
  **no mail watch has ever run in this product** (`240-VERIFICATION.md` §2).

- **D-14:** **237's rule-builder is PARTIALLY discharged by the M-9 click, and the verdict must say
  exactly what it covered.** M-9 uses the real surface, so "never manually clicked" ends. ⛔ But 237
  shipped a **scope selector** and **out-of-scope condition filtering on scope switch**, which a
  single `path contains` rule does not exercise. Record what the click covered, what it did not, and
  a trigger for the rest. Rationale: claiming "clicked" on one of three behaviours is the same
  half-pass problem M-8 and M-9 are being corrected for.

- **D-15:** **`SEED-177`'s Flags item is recorded as REFUTED; the seed is touched only where it is
  actually wrong.** Write the measurement into 245's verdict, and fix the second home — **CLAUDE.md
  still says SEED-177 "still reads `status: planted`"**. ⛔ A correct seed is left alone, and **no
  broader trigger sweep happens here** (the rejected option): SEED-177 is high-priority with Open
  Platform attached, so ruling on its other triggers is a capability decision, not bookkeeping.

### Defect handling during drives

- **D-16:** **A defect found by driving is fast-fixed ONLY inside G-3's existing line — ≤ 1 file,
  ≤ 10 lines, no schema or API surface.** Anything larger is filed as a reported-bug and deferred to
  a named phase, however tempting. ⛔ Use the threshold already in CLAUDE.md rather than inventing a
  phase-local one. Rationale: driving has a strong defect-finding record here — **one Drive folder
  found six defects (2026-09-05); 238's rows found four, none caught by the unit suite** — and 238
  could fix same-day because it was a build phase with a plan budget. 245 has none. **A defect found
  here is evidence, and filing it is a complete response.** ⛔ The "any size if one re-run proves it"
  option was rejected for having no size bound.

### Claude's Discretion

- Exact field ordering and comment wording inside each new frontmatter block, provided the literal
  token `verification_mode: self-verified` is present and the guard accepts it.
- Whether the guard is a standalone `.cjs` that the hook shells out to, or logic inside the hook with
  the `.cjs` as the CI-callable entry point — as long as it can be invoked by hand and driven RED.
- How the 245 verdict file is named and structured beyond `245-UAT-RESULTS.md` (D-12).
- Which specific files go in the throwaway Drive fixture, beyond "a handful" and "one native Doc".

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The rows being discharged — read these FIRST, they contain the rows verbatim
- `.planning/milestones/v4.0-phases/238-microsoft-graph-onedrive/238-VERIFICATION.md` §"UAT — the
  G-4 table" (`:204-220`) — the eleven rows, their current verdicts, and the four defects driving
  found. **M-8 at `:215`, M-9 at `:216`, S-1/S-2 at `:217-218`.**
- `.planning/milestones/v4.0-phases/233-the-preview-see-it-before-it-lands/233-VERIFICATION.md`
  §"What was NOT done, stated as a decision" (`:78-88`) — **the five G-4 rows verbatim, and the
  "run row 2 first" instruction.**
- `.planning/milestones/v4.0-phases/233-the-preview-see-it-before-it-lands/233-UAT-FINDINGS.md` —
  what the 2026-09-05 operator Drive import actually found (**six defects; 5,600 automated tests
  found none of them**). Read before driving: it names the doors and the failure shapes.
- `.planning/milestones/v4.0-phases/240-mail-is-a-shape-not-a-fourth-adapter/240-VERIFICATION.md`
  §"⛔ OWED" (`:200-230`) — **240's five mail rows, deferred by D-13**, plus its §4 carry-forward
  list.

### The files being edited
- `.planning/milestones/v4.0-phases/238-microsoft-graph-onedrive/238-VERIFICATION.md` — no
  frontmatter today; gains a block (D-01).
- `.planning/milestones/v4.0-phases/240-mail-is-a-shape-not-a-fourth-adapter/240-VERIFICATION.md` —
  no frontmatter today; gains a block (D-01).
- `.planning/milestones/v4.0-phases/241-recall-at-corpus-scale/241-VERIFICATION.md` — **has**
  frontmatter (`status: human_needed`); gains the `verification_mode` field (D-01).
- `.planning/phases/243-the-thinking-block-and-the-follow-scroll-seam/243-VERIFICATION.md:1-6` —
  ⭐ **the pattern to copy, verbatim.**
- `.planning/STATE.md:474-497` — `OV-SOLO-01`, already complete (D-04); and item 4 (~`:379-387`),
  which carries the stale claim (D-08).
- `.planning/REQUIREMENTS.md:160-166` (DEBT-01/02/03) and `:208-210` (traceability rows).
- `.planning/ROADMAP.md` → Phase 245 block — SC#1 and Flags carry two stale claims (D-08, D-15).
- `.planning/seeds/SEED-256-*.md` — four re-open triggers already written; status flip only (D-07).
- `.planning/seeds/SEED-177-*.md` — reads `partially-answered`; **leave it alone** (D-15).
- `CLAUDE.md` — carries the false `SEED-177` sentence (D-15). ⚠ Subject to the 150,000-char gate:
  `node scripts/check-claude-md-size.cjs`.

### Guard precedents — copy the shape, do not invent one
- `scripts/check-hot-file-ledger.cjs` + `.claude/hooks/hot-file-ledger-guard.js` — ⭐ **the exact
  script+PostToolUse-hook pairing D-02/D-03 specify.**
- `scripts/check-claude-md-size.cjs` + `.claude/hooks/claude-md-size-guard.js` — the
  hook-plus-CI-backstop variant, **deliberately NOT copied** (D-03).
- `scripts/check-gap-closure-rounds.cjs` — the worded-escape-hatch pattern
  (`G-7 passed WITH OVERRIDES`), if the honesty guard needs one.

### Rules this phase is bound by
- `AGENTS.md` §6.3 (`:161-206`) — the two-agent separation `OV-SOLO-01` sets aside. ⚠ `:206` is
  blunt: *"The scripts enforce nothing"*.
- `CLAUDE.md` → "Workflow guardrails (MANDATORY)" — **G-3** (the ≤1 file / ≤10 line line D-16
  adopts), **G-4** (lived-experience UAT), **G-7** (gap-closure cap), **G-8** (3-5 plans).
- `CLAUDE.md` → "Reported bugs cross-check" and "Seeds register cross-check" — the four and two
  touchpoints.

### Surfaces the drives touch
- `frontend/src/components/classification/RuleBuilderPanel.tsx` — M-9's rule is created here; the
  surface 237 shipped and nobody clicked (D-05, D-14).
- `backend/app/api/classification_rules.py` — validates `rule_scope`; enforces
  `WATCH_ALLOWED_FIELDS` refusal (422).
- `frontend/src/components/sources/SourcePreviewPanel.tsx`,
  `frontend/src/components/sources/previewVocabulary.ts` — the four buckets and the *can't tell*
  wording rows 1 and 5 assert against.
- `.planning/sketches/233-the-source-says-what-it-did/` — 233's sketch; the bar for row 1's
  "hatched segment reads as uncertainty".

### Method precedents for the drive session
- `.planning/phases/243-the-thinking-block-and-the-follow-scroll-seam/243-UAT-RESULTS.md:1-12` —
  ⭐ **the frontmatter shape D-12 adopts.**
- `scripts/start-local-infra.ps1` — brings infra up and **verifies 54322 / 6379 / 54321 accept a
  real TCP connection**. Run before the drive session; "container running" is not the property
  needed.
- `docs/HOT-FILE-LEDGER.md` — if any fast-fix under D-16 touches a source file, its row is read
  first and `node scripts/check-hot-file-ledger.cjs 245` must pass.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`scripts/check-hot-file-ledger.cjs` + `.claude/hooks/hot-file-ledger-guard.js`** — the complete
  script+hook pairing D-02/D-03 need. Copy the exit-code convention (`0` clear · `1` violation ·
  `2` harness error) and the "print the derivation so the number is auditable" habit.
- **`243-VERIFICATION.md:4`** — the `verification_mode` line to replicate verbatim, comment included.
- **`243-UAT-RESULTS.md` frontmatter** — `phase` / `kind` / `driven` / `driver` / `environment` /
  `thread` / `rows_driven` / `rows_partial` / `rows_owed`. Reusable as-is; `thread` becomes the
  fixture folder identifier.
- **`SEED-256`'s four `trigger_when` arms** — already written and concrete; D-07 flips status and
  points at them rather than authoring new retirement prose.

### Established Patterns
- **Correct beside, never over** (D-08) — every stale figure in CLAUDE.md and the hot-file ledger
  keeps its wrong original with a dated correction beside it. Apply to all four homes.
- **Same-commit sync for a fact with multiple homes** (D-07) — `Dockerfile.sandbox` ↔
  `docs/SANDBOX-PACKAGES.md`; the ledger row ↔ its detail section.
- **Drive the guard RED before trusting it** (D-02) — and restore the victim file md5-identical.
  `check-claude-md-size.cjs`'s three findings were each driven against a planted defect.
- **`status:` frontmatter IS the index** — prose in a body saying "still open" is invisible to every
  scan. Binds D-07's seed flip and D-01's marker alike.
- ⛔ **Hand-edit `STATE.md`. Never call the `state.*` SDK verbs** — seven write false records and
  corrupted the file five times in Phase 190 alone while reporting success.

### Integration Points
- The new hook registers in `.claude/settings.json` PostToolUse alongside `hot-file-ledger-guard.js`
  and `claude-md-size-guard.js` — ⚠ a matcher on `Write|Edit` that must not fire on unrelated
  planning writes.
- The drive session needs local infra up (Supabase `54322`, Redis `6379`, API `54321`), vite, and
  the backend. ⚠ **The operator starts the backend.** ⚠ `vite` binds **IPv6 only** — probe
  `localhost`, never `127.0.0.1`. ⚠ A stale `uvicorn` can hold `:8000`; check
  `Get-NetTCPConnection` before trusting a live probe.
- The M-9 drive writes a real `classification_rules` row and imports real documents; the 233 drive
  writes documents, chunks, folders and ingestion_jobs. **Both are additive into deletable fixtures
  (D-09), and no test mutating the local DB may run concurrently** (worktree rule 4).

</code_context>

<specifics>
## Specific Ideas

- ⭐ **"A row is marked done on the strength of a passing test suite rather than a driven
  observation"** is the ROADMAP's own first named failure mode for this phase. It is also what
  nearly happened during this discussion in reverse: three registers said nine rows were owed, and
  only opening `238-VERIFICATION.md` showed they were driven. **Both directions of that error are in
  scope to prevent.**
- ⭐ **Row 2 of 233 is the whole argument for G-4 in one row:** *close without confirming → check
  `documents`, `document_chunks`, `folders`, `ingestion_jobs` are unchanged.* Nothing on screen can
  fail it, and nothing in the suite covers it. Drive it first, and measure all four tables.
- ⚠ **238's durable lesson, quoted because it shapes how the M-9 drive should be read:** *"the test
  doubles were mine, so they agreed with my implementation rather than with reality."* Four defects,
  three of them contradicting either Microsoft's docs or the phase's own written verdict.
- ⚠ **An observation 238 recorded and deliberately did not file**, worth a deliberate decision if a
  drive touches it: **deleting a watch cascade-deleted its entire run history** —
  `connector_sync_runs` and `connector_watch_items` rows gone. The M-7 evidence survived only
  because `documents.source_state` lives on the document. Phase 235 exists to make a source *say
  what it did*; a watch removal currently erases what it said.

</specifics>

<deferred>
## Deferred Ideas

- **240's five G-4 mail rows** (M-1…M-5) — deferred with a trigger each per **D-13**. Trigger: the
  next phase touching mail ingestion, or the v4.1 close sweep. ⚠ No mail watch has ever run.
- **237's scope selector + out-of-scope condition filtering** — the part of the rule-builder the M-9
  click will NOT cover (**D-14**). Trigger: the next classification-rules phase.
- **`SEED-177`'s remaining `trigger_when` arms** — not ruled on here (**D-15**); it is a capability
  decision. Trigger: `SEED-013` / Open Platform getting a phase number.
- **Making `OV-SOLO-01`'s re-arm trigger executable** — considered under **D-04** and not taken.
  Trigger: the v4.1 close, where the trigger fires and can be observed failing or working.
- **The 13 `SECURITY DEFINER` functions still `anon`-executable** (migration 177's own prediction) —
  unrelated to this phase, named so it is not lost. A role-by-role revoke achieves nothing while the
  `PUBLIC` grant stands.
- **`BUS-171` — the 23-item operator queue triage**, 6 days old and addressed to Claude. Parked at
  the v4.0 close and still parked; **parked is not dropped**. Not folded: it is a triage
  deliverable for the operator, not verification debt.

### Reviewed Todos (not folded)

No `gsd-sdk todo.match-phase` matches. **Reported-bugs cross-check (MANDATORY) — 25 open
`surface: Agentic-RAG` reports swept; overlapping ones REVIEWED and explicitly NOT folded:**

- `BUG-260909-03` (*a watch card reads its last run, not the connection it rides*),
  `BUG-260909-04` (*Sync now collapses the whole section*), `BUG-260909-05` (*`missing_since` never
  set*), `BUG-260909-06` (*a fix button labelled as a write only navigates*), `BUG-260909-07`
  (*"last read successfully" on a relative time*) — all `frontend/sources` / `backend/watches`,
  which the 233 and M-9 drives pass through. **Not folded:** 245 is a bookkeeping-and-drive phase
  with a 2-3 plan budget and no source change expected (**D-16**). ⚠ **They may well be OBSERVED
  while driving** — if so, the observation is recorded in `245-UAT-RESULTS.md` against the existing
  report id, which is evidence the report is still live, **not** a licence to fix it here.
- `BUG-260910-02` (*Phase 240 build review open warnings* — `backend/sources`, `frontend/sources`,
  `frontend/library`) — **not folded**, and it is 240's, whose rows D-13 defers. Same trigger.
- `BUG-260905-01` (*cloud import lives in chat and dumps into Library root*) — already
  **reviewed-not-folded by 238** on the grounds that its fix is *moving* a surface, not widening it;
  and SHELL-04 at Phase 244 claims it. Unchanged here.

</deferred>

---

*Phase: 245-the-verification-debt-discharged-or-retired-in-writing*
*Context gathered: 2026-09-13*
