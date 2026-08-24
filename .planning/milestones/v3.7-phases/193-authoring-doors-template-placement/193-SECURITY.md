---
phase: 193
slug: authoring-doors-template-placement
status: verified-with-one-open
threats_open: 1
threats_total: 51
threats_closed: 50
asvs_level: 2
created: 2026-08-14
audited_at_head: 743d31e4
audited_from_base: 501b3c14
register_authored_at_plan_time: true
requirements: [AUTH-01, AUTH-03]
---

# Phase 193 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

**51 threat entries across 11 plans — 46 `mitigate` verified CLOSED · 4 `accept` logged below ·
1 OPEN (`T-193-48`, a documentation-artifact assertion, not code).** All 11 PLAN files carry a
parseable `<threat_model>` block, so this audit ran in **verify-mitigations** mode rather than
retroactive-STRIDE: the register was complete at plan time and the auditor's job was to establish
that each named control is actually present at HEAD — and, per the 192.1 E-2 lesson, that each
fence **could fire**.

**Scope confirmed by measurement, not by assertion.** `git diff --stat 501b3c14..HEAD` over
non-`.planning` paths lists **23 files: 22 frontend + `scripts/vitest-count-gate.cjs` + `CLAUDE.md`.
Zero backend files. Zero migrations. Zero `package.json` / `package-lock.json` / `requirements.txt`
change** (`git diff --stat 501b3c14..HEAD -- frontend/package.json frontend/package-lock.json
backend/requirements.txt` → empty). The `<scope_note>` in the audit brief is therefore correct: no
new endpoint, no new RLS surface, no new dependency. `T-193-SC` (declared identically in all 11
plans) is closed by that same measurement.

---

## Trust Boundaries

| # | Boundary | Where it is crossed | Verified control |
|---|----------|---------------------|------------------|
| B-1 | **server `definition` JSON → the admission predicate** | `soulData.ts:244` `templateAdmission(def)` | Closed union return (`soulData.ts:242`); no definition-derived string reaches the DOM through it. `definition` arrives as a **jsonb string scalar on 194/223 live rows** and reaches the predicate UNPARSED — pinned as a case at `soulData.test.ts:350-354`, answering `"unknown"` (the safe arm). |
| B-2 | **uploaded `template_input` file → the fill engine** | `POST /workspace/{thread}/template` → `workspace.py:281` stamps `kind="template_input"` → `template_asset_service.py:197` stamps `provenance="template_input"` → `tool_dispatcher.py:3320` `engine = select_engine(src["provenance"])` | `template_render_service.py:936-959`: `template_input` ∈ `_RUN_REPLACE_PROVENANCES` → `"run_replace"`, with a hard `assert engine != "docxtpl"` on that branch. An untrusted upload is **structurally unable** to reach docxtpl/Jinja. |
| B-3 | **file picker → server upload validator** | `RunModal.tsx:373-381` (hidden input) → `workspace.py:184-209` `validate_upload` | Client `accept` list and the server `_ALLOWED_EXT` allowlist are the **same set** (OOXML by magic bytes; text-ish by utf-8-decodability + NUL reject; images by leading magic bytes). Size guard trips before any parse. Neither was touched by this phase. |
| B-4 | **captured DOM string → committed literal** | `WorkflowDoorSwitch.baseline.test.tsx`, `RunModal.test.tsx` | `CAPTURE_SHA` + retained `RECAPTURE_SHA_193_07`; non-vacuity floors before every `toBe`; marker rows. |
| B-5 | **generated contract (`.planning/` script) → in-package acceptance bar** | `.planning/sketches/164-.../build.cjs:451-458` writes `frontend/src/components/workflows/__contracts__/doors-copy.generated.md` | Fixed path built from `__dirname` with **zero interpolation from any input**; both copies md5-identical; sole consumer is `doorVocabulary.test.ts:71` via `?raw`. **See UF-1 — this boundary is new and unregistered.** |
| B-6 | **`props → rendered class string`** | `DoorHeaderStrip.tsx:139-165` | `inline` comes from the host page, never from user data; no runtime value exported. |

---

## Threat Register

Legend — **CLOSED** = the named control was located in shipped code/artifact at HEAD and shown to
be capable of firing. **OPEN** = the declared assertion does not hold as written.

### Plan 193-01 — the pre-change captures

| ID | Cat | Disp | Verdict | Evidence at HEAD |
|----|-----|------|---------|------------------|
| T-193-01 | Repudiation | mitigate | **CLOSED** | `WorkflowDoorSwitch.baseline.test.tsx:98` `CAPTURE_SHA = "501b3c141d5a…"` — and that SHA **is** the phase base commit (`docs(193): planned`), i.e. the capture provably predates every source edit. Format-asserted at `:386`. |
| T-193-02 | Tampering | mitigate | **CLOSED** | `git log --numstat 501b3c14..HEAD -- …baseline.test.tsx`: `011b1a79` +438/−0, then **no commit at all** until wave 4. Deletions occur only at `a961b9ad` (−20) and `4ab5fa5a` (−4), both titled `RE-CAPTURE 1 OF 2` / `2 OF 2`, plus −2 in the declared fast-fix. Zero deletions through waves 2–3, as required. |
| T-193-03 | Spoofing (of fact) | mitigate | **CLOSED** | Non-vacuity at `:409` (`length).toBeGreaterThan(0)`) and `:540` (`>200`) run before the equality; marker rows from `:414`. |
| T-193-04 | DoS | mitigate | **CLOSED** | `GSD_VITEST_MAX_WORKERS=4` used on every run recorded in the SUMMARYs and re-used by this audit; full gate re-run green (see Live gate evidence). |

### Plan 193-02 — the three-state predicate

| ID | Cat | Disp | Verdict | Evidence at HEAD |
|----|-----|------|---------|------------------|
| T-193-05 | Tampering | mitigate | **CLOSED** | `soulData.ts:242` `export type TemplateAdmission = "admits" \| "does-not-admit" \| "unknown"` — a closed union. The predicate (`:244-274`) returns only those three literals; no definition value is interpolated anywhere in it. |
| T-193-06 | Spoofing (of fact) | mitigate | **CLOSED** | Rules (1)/(2) at `soulData.ts:246-249` route nullish / non-array / empty-`phases` to `"unknown"`; the WR-05 arm at `:259` adds "phases that declare no `config`". Exercised by 16 table rows (`soulData.test.ts:320-383`) and by the **return-set** assertion at `:390-398` — `observed.size === 3` — which a collapsed predicate fails *even if every row expectation had been edited to agree*. |
| T-193-07 | Info Disclosure | **accept** | **LOGGED** | See Accepted Risks A-1. Verified: `asset_id` appears in production source only as a type member (`soulData.ts:91`) — every other occurrence is a test fixture. Never read, rendered or logged. |
| T-193-08 | DoS | mitigate | **CLOSED** | `soulData.ts:264-270`: two flat `some()`/`every()` walks, no nesting, no recursion, no regex. |

### Plan 193-03 — the DoorHeaderStrip extraction

| ID | Cat | Disp | Verdict | Evidence at HEAD |
|----|-----|------|---------|------------------|
| T-193-09 | DoS (ESM cycle) | mitigate | **CLOSED** | `DoorHeaderStrip.test.tsx:256-296`. Both regexes cover static / type-only / re-export / dynamic in bare **and** `.tsx`-suffixed spelling, each exercised by an inline positive control (`:263-278`), with `?raw` negatives (`:281-287`) and a non-vacuity floor on the subject (`:290`). `DoorHeaderStrip.tsx` names `WorkflowDoorSwitch` six times — **all six are comment prose** (`:11,14,35,61,64,142`), never a specifier. |
| T-193-10 | Tampering | mitigate | **CLOSED** | The 193-01 six-state capture and `WorkflowBuilderPage.header.test.tsx`'s band literal both pass at HEAD with the wave-3 commits making **zero** edits to either baseline file (numstat above). |
| T-193-11 | Spoofing (of fact) | mitigate | **CLOSED** | `DoorHeaderStrip.test.tsx:107-121`: `ml-auto` asserted as a **class token** (not substring) present standalone / absent inline, plus the rest-of-list equality against the class string extracted from the *other* suite's committed literal. Positive control at `:123-130`. |
| T-193-12 | Elevation of Privilege | mitigate | **CLOSED** | `grep -c "^export const" DoorHeaderStrip.tsx` → **0**. The file exports exactly `DoorHeaderStripProps` (`:118`) and the component (`:127`). |

### Plan 193-04 — the generated contract

| ID | Cat | Disp | Verdict | Evidence at HEAD |
|----|-----|------|---------|------------------|
| T-193-13 | Tampering | mitigate | **CLOSED — re-run live by this audit.** | `node build.cjs && node assemble.cjs` at HEAD → `git diff --numstat` on every generated path is **empty** (the one `M` git reported on `index.html` carries zero content hunks; it is a CRLF-normalization artifact, and the file was restored). Both contract copies md5-identical: `b51ae027…`. |
| T-193-14 | Spoofing (of fact) | mitigate | **CLOSED** | `build.cjs:459-469` collects `misses` from `applyLog` and sets `process.exitCode = 1` when non-empty. Live output at HEAD: `substitutions: 57 matched` / `zero missed substitutions`. |
| T-193-15 | Tampering | mitigate | **CLOSED** | `frontend/src/components/workflows/__emit164.test.tsx` does not exist; `git status --porcelain frontend/src/components/workflows/` is empty. |
| T-193-16 | Elevation of Privilege | **accept** | **LOGGED** | See A-2. `emit.test.tsx.src:24-29` mocks the full `@/lib/api` surface it touches. |

### Plan 193-05 — the vocabulary move + D-24(a) copy fence

| ID | Cat | Disp | Verdict | Evidence at HEAD |
|----|-----|------|---------|------------------|
| T-193-17 | Tampering | mitigate | **CLOSED** | `WorkflowDoorSwitch.test.tsx:488-492` sweeps **three** sources (`WorkflowDoorSwitch.tsx`, `DoorHeaderStrip.tsx`, and — via WR-01 — `@/pages/WorkflowBuilderPage.tsx`); needles are derived from the module namespace (`:499-509`), so the fence spells zero literals. Sweep green at `:551-558`. |
| T-193-18 | Spoofing (of fact) | mitigate | **CLOSED — this is the 192.1 E-2 check, and it is real here.** | `WorkflowDoorSwitch.test.tsx:515-548`: every swept source asserted `length > 1000` **before any negative**; needle-id set asserted `=== 21`; every needle asserted non-empty; ≥1 escaped spelling asserted to differ; an inline positive control proves `hitsIn` catches a planted literal in both spellings and stays clean on a control string; and `:535-537` asserts **no test file is in the sweep**. A renamed module would red the scope block, not pass silently. |
| T-193-19 | Tampering | mitigate | **CLOSED** | Both baselines pass at HEAD (167 cases green), and wave-3 commits touched neither baseline file. |
| T-193-20 | Elevation of Privilege | mitigate | **CLOSED** | `grep -c "^import\|require(" doorVocabulary.ts` → **0**; asserted in-suite at `doorVocabulary.test.ts:460-468` with a length floor of 500. |

### Plan 193-06 — the card mark

| ID | Cat | Disp | Verdict | Evidence at HEAD |
|----|-----|------|---------|------------------|
| T-193-21 | Spoofing (of fact) | **accept** | **LOGGED** | See A-3. |
| T-193-22 | Tampering (XSS) | mitigate | **CLOSED** | `WorkflowCard.tsx:545` — `templateAdmission(row.def) === "admits" ? [CARD_TEMPLATE_MARK] : []`. The mark is the module constant at `libraryVocabulary.ts:362`; **no definition value is interpolated**. Rendered as a JSX text node (React-escaped). The raw-HTML escape hatch remains fenced for this file by T-192-04's `librarySubtree.fences.test.ts` (`WorkflowCard.tsx` is in `LIBRARY_SUBTREE_PATHS`). |
| T-193-23 | Info Disclosure | mitigate | **CLOSED** | `grep -c "title=" library/WorkflowCard.tsx` → **0**; F1's AST-parsed subtree sweep green. |
| T-193-24 | DoS | mitigate | **CLOSED** | `WorkflowCard.tsx:545` calls the predicate inline where the shipped ownership predicate already runs; no new memo, no new index; the predicate itself is two flat array walks. |
| T-193-25 | Repudiation | mitigate | **CLOSED** | The correction ("the `@ts-expect-error` two-badge control guards `PhaseNodeCard`, **not** this file — there is no badge ceiling under `library/`") is written into the card's docblock **and** into the `CLAUDE.md` ledger cell added by 193-10. D-13 is enforced structurally by the child-count assertion, not by the false typecheck claim. |

### Plan 193-07 — the Run-modal template placement (the security-bearing plan)

| ID | Cat | Disp | Verdict | Evidence at HEAD |
|----|-----|------|---------|------------------|
| T-193-26 | DoS (of a shipped capability) | mitigate | **CLOSED** | `RunModal.tsx:113` — `templateAdmission(def) !== "does-not-admit"`. A **positive-no-only** gate: `"unknown"` renders the control exactly as `"admits"` does. Proved at `RunModal.test.tsx:1163-1190`, where the `unknown` row and the `admits` row call **the same helper** (`:1126`) — a change that weakens `unknown` necessarily weakens `admits`. WFIN-01 is not strippable from the ~76 % of the library that answers `unknown`. |
| T-193-27 | Repudiation | mitigate | **CLOSED** | `RunModal.tsx:359` gates the wrapper on `(showTemplate \|\| launchError)`; `:421` gates the error `<p>` on `launchError` **alone**, outside the `showTemplate` fragment (`:361-420`). A launch failure on a non-admitting workflow is therefore still visible. Pinned by `RunModal.test.tsx:956-986`, a case captured at 193-01 *before* the cut existed. |
| T-193-28 | Info Disclosure | mitigate | **CLOSED — the headline check of this audit.** | (a) `git diff -U0 501b3c14..HEAD -- RunModal.tsx \| grep -c "Stored untrusted"` → **0**: the D-19 sentence is not in the phase diff at all, and the indentation was deliberately left at pre-193 depth so that check stays mechanical. (b) The sentence is present byte-exactly at `RunModal.tsx:434`. (c) It is byte-fenced inside **all six** re-captured baselines — `RunModal.test.tsx:683-685` asserts the full sentence in every state. (d) **The claim was re-verified against the code, not just against the string**: an uploaded template is stamped `kind='template_input'` (`workspace.py:281`) → `provenance="template_input"` (`template_asset_service.py:197`) → `select_engine` (`tool_dispatcher.py:3320`) → `"run_replace"` with `assert engine != "docxtpl"` (`template_render_service.py:947-951`). The Jinja path is unreachable for an upload. See OBS-1 for a wording nuance. |
| T-193-29 | Elevation of Privilege | mitigate | **CLOSED** | `RunModal.tsx:367-372` renders a `<p data-testid="run-template-label">`, not a `<label>`; the input at `:373-381` is `className="hidden" tabIndex={-1}` with `aria-label="Upload template file"`. Asserted at `RunModal.a11y.test.tsx:427-439` (`tagName !== "LABEL"`, no `htmlFor`), suite pinned at 20 and green. |
| T-193-30 | Tampering | mitigate | **CLOSED** | `RunModal.test.tsx:358` retains the original `CAPTURE_SHA` **beside** `RECAPTURE_SHA_193_07` at `:404`; both format-asserted at `:607-613`. The only capture delta is the inserted label node, and every capture still carries the provenance sentence. |

**Additionally verified for the file-upload control (audit brief item 2, beyond the register):**
`git diff -U0 501b3c14..HEAD -- RunModal.tsx | grep -n "accept=\|type=\"file\""` → **no hits**. The
`accept` list is unchanged by this phase, and it matches the server's `_ALLOWED_EXT` exactly
(`workspace.py:184-209`). **Nothing was introduced that widens what can be uploaded.**

### Plan 193-08 — shipping variant D

| ID | Cat | Disp | Verdict | Evidence at HEAD |
|----|-----|------|---------|------------------|
| T-193-31 | Tampering | mitigate | **CLOSED** | `doorVocabulary.test.ts:71` re-reads the contract at test time via `?raw`, with a non-vacuity floor of 2000 chars at `:317` and `GOVERNED_ID_COUNT = 21` at `:81`. Bar and module cannot drift silently. |
| T-193-32 | Spoofing (of fact) | mitigate | **CLOSED** | `grep -c "toContain" doorVocabulary.test.ts` → **0**; collisions declared as equalities (`:247`, `:440`). |
| T-193-33 | Tampering | mitigate | **CLOSED** | Codepoint assertions at `:361`, `:363`, `:369`, `:374`, plus the dash-block and middle-dot sweeps at `:379` / `:398`. |
| T-193-34 | Repudiation | mitigate | **CLOSED** | Nine re-captured literals published with a tags-vs-text diff (*structure identical: true*) in `193-08-SUMMARY.md`; count gate reports no `[count-decrease]`. |
| T-193-35 | DoS | **accept** | **LOGGED** | See A-4. Did not fire — `WorkflowBuilderPage.canvas.test.tsx` green in this audit's full gate run. |

### Plan 193-09 — the header restack

| ID | Cat | Disp | Verdict | Evidence at HEAD |
|----|-----|------|---------|------------------|
| T-193-36 | DoS (of an escape route) | mitigate | **CLOSED** | `DoorHeaderStrip.tsx:144-151` — still a real `<button type="button" data-testid="both-doors" onClick={goBoth}>`; the twin at `WorkflowDoorSwitch.tsx:268`. Child-order asserted in both variants; D-06 stays rejected. |
| T-193-37 | Info Disclosure | mitigate | **CLOSED** | `DoorHeaderStrip.tsx:155` — `<span aria-hidden="true" className="mx-0.5 h-4 w-px bg-border" />`, no testid, no text content. |
| T-193-38 | Tampering | mitigate | **CLOSED** | `git show -U0 6e0bc162 2d4ab344 -- DoorHeaderStrip.tsx WorkflowDoorSwitch.tsx \| grep -c "judge-locked\|ml-auto\|judge always-on"` → **0** on both source commits. The `ml-auto` pair test still passes unchanged. |
| T-193-39 | Repudiation | mitigate | **CLOSED** | Per-capture diffs published in `193-09-SUMMARY.md` § "Threat register — dispositions discharged"; gate reports no `[count-decrease]`. |
| T-193-40 | Spoofing (of fact) | mitigate | **CLOSED** | `WorkflowDoorSwitch.test.tsx:580-630`: both class strings extracted from `?raw` sources and compared; the extractor is positive-controlled inline and **throws** rather than returning `""` when the control is missing; each source asserted to declare exactly one `both-doors` control, so the non-greedy match cannot read into a neighbour. |

### Plan 193-10 — phase paperwork

| ID | Cat | Disp | Verdict | Evidence at HEAD |
|----|-----|------|---------|------------------|
| T-193-41 | Repudiation | mitigate | **CLOSED** | `CLAUDE.md` gains a `frontend/src/components/workflows/WorkflowDoorSwitch.tsx` hot-file row — **11 commits across 7 phases, 385 → 426 lines** — with re-derivation commands printed inside the cell. |
| T-193-42 | Spoofing (of fact) | mitigate | **CLOSED** | Word-level diff confirms the `WorkflowCard.tsx` correction is appended **beside** the previous value ("The cell read *6 commits across 2 phases · 567 → 721*; measured … **8 commits across 3 phases · 747 → 818 L**"), and that **G-5 now fires** on that file is stated plainly rather than softened. |
| T-193-43 | Repudiation | mitigate | **CLOSED** | Every `BASELINE` change in `scripts/vitest-count-gate.cjs` is an **increase** (17→36, 23→34, 32→40, 16→20, 80→90) plus five new pins; `BASELINE_TOTAL` 3384→3533. No pin lowered. Of the +255 lines, all but the 13 above are comment prose. |
| T-193-44 | Spoofing (of fact) | mitigate | **CLOSED** | `git show 59274715:…193-UAT.md` opens verbatim `0 driven · 0 passed · 0 failed · 8 owed`, with `driven: false`, `driven_rows: 0`. |
| T-193-45 | Tampering | mitigate | **CLOSED** | U4/U5 name `ephemeral-template-fill-101uat` explicitly (8 occurrences, incl. `193-UAT.md:325,328,358,369`), and the row's `published` status was re-queried live. |

### Plan 193-11 — the UAT drive

| ID | Cat | Disp | Verdict | Evidence at HEAD |
|----|-----|------|---------|------------------|
| T-193-46 | Spoofing (of fact) | mitigate | **CLOSED** | Every driven row records its own target slug and observed text; U3 records **both** `visual_workflow_canvas` states (`193-UAT.md:269`). |
| T-193-47 | Spoofing (of fact) | mitigate | **CLOSED** | `193-UAT.md:107` records the live re-query: `ephemeral-template-fill-101uat` present and `published`. |
| **T-193-48** | **Repudiation** | **mitigate** | **⛔ OPEN** | **See E-1.** The declared mechanical assertion — *"`grep -c "result: *$"` must be 0"* — does **not** hold: measured **2** (`193-UAT.md:202`, `:230` — U1 and U2). |
| T-193-49 | Tampering | mitigate | **CLOSED** | `193-11-SUMMARY.md:104` asserts `.planning/STATE.md` was hand-edited and **no `state.*` SDK verb was called**; frontmatter parses. |
| T-193-50 | Elevation of Privilege | mitigate | **CLOSED** | `193-11-SUMMARY.md:101-102` pastes the G-7 output verbatim: `plans: 11 total · 0 gap-closure` → G-7 clear, exit 0. No closure round; no capability smuggled. |

### Supply chain (all 11 plans)

| ID | Cat | Disp | Verdict | Evidence at HEAD |
|----|-----|------|---------|------------------|
| T-193-SC ×11 | Tampering | mitigate | **CLOSED** | `git diff --stat 501b3c14..HEAD -- frontend/package.json frontend/package-lock.json backend/requirements.txt` → **empty**. Zero packages installed. |

---

## Live gate evidence

Re-run by this audit at HEAD `743d31e4`, not quoted from a SUMMARY:

```
cd frontend && GSD_VITEST_MAX_WORKERS=4 npx vitest run \
  WorkflowDoorSwitch.test.tsx DoorHeaderStrip.test.tsx doorVocabulary.test.ts soulData.test.ts
  → 4 files, 125 passed, 0 failed

cd frontend && GSD_VITEST_MAX_WORKERS=4 npx vitest run \
  RunModal.test.tsx RunModal.a11y.test.tsx WorkflowCard.test.tsx WorkflowDoorSwitch.baseline.test.tsx
  → 4 files, 167 passed, 0 failed

cd frontend && GSD_VITEST_MAX_WORKERS=4 node ../scripts/vitest-count-gate.cjs
  → total 3561 · failed 0 · pinned total 3537 · 67/67 pinned files present
  → no per-file decrease · count gate OK

node .planning/sketches/164-telling-the-doors-apart/build.cjs && node …/assemble.cjs
  → 57 matched · zero missed substitutions · git diff --numstat on generated paths EMPTY
```

The 292 cases in the two targeted runs are the ones that carry this phase's security-bearing
assertions. **Every `?raw`-based negative in the phase has a paired non-vacuity floor** — swept
sources are asserted `length > 1000` (copy fence), `> 500` (cycle fence, zero-import fence),
`> 2000` (contract), `> 10000` (page-extraction fence) — so a renamed or moved module reds the
scope block instead of passing green against the empty string. That is the 192.1 E-2 defect,
checked for specifically and **not found** in this phase.

---

## Unregistered flags

Not blockers. Logged because they are new surface with no threat mapping, and the standing lesson
in this repo is that a guardrail cannot see what is absent from its list.

### UF-1 — a `.planning/` script now writes into `frontend/src/` (WARNING)

`build.cjs:451-458` writes `frontend/src/components/workflows/__contracts__/doors-copy.generated.md`.
This landed in review-resolution commit `6c060c4f` (WR-08), **after all eleven `<threat_model>`
blocks were authored**, so no `T-193-*` id covers it.

Verified benign as written: the path is assembled from `__dirname` with **no interpolation from any
input**, `mkdirSync` + `writeFileSync` only, both copies are md5-identical, and the single consumer
is a test (`doorVocabulary.test.ts:71`) — **no production module imports it**, so it never enters a
bundle.

**The residual is a durability one, and it is the reason this is logged rather than dismissed:** the
CONSUMER now survives `/gsd:complete-milestone` archiving `.planning/`, but the GENERATOR does not.
Once `.planning/` is archived, `T-193-13`'s acceptance criterion — *"re-running `build.cjs` must
produce an empty diff"* — becomes unrunnable, and the in-tree contract becomes an unregenerable
literal that nothing can prove is still derived. Suggested follow-up (a future phase, not this one):
move the emitter into the frontend package, or pin the contract's hash in the suite so a hand-edit
reds even with the generator gone.

### UF-2 — three plan SUMMARYs carry no `## Threat Flags` section at all (WARNING)

`193-04-SUMMARY.md`, `193-10-SUMMARY.md` and `193-11-SUMMARY.md` have **no threat-flag section in any
form** (`grep -i threat` → zero hits in all three). Eight of eleven plans reported "None" explicitly;
these three reported nothing. **193-04 is the plan that introduced the generator described in UF-1** —
i.e. the one plan whose missing section would have caught the one piece of unregistered surface. The
`## Threat Flags` list is therefore demonstrably not a complete inventory of this phase's new attack
surface, and was not treated as one by this audit.

### UF-3 — the new component sits outside the library subtree fences (INFO)

`DoorHeaderStrip.tsx` is a **new file at the `workflows/` root**, so `LIBRARY_SUBTREE_PATHS`
(12 modules, `librarySubtree.fences.test.ts:82-119`) does not cover it: neither the F1 no-`title=`
sweep nor the T-192-04 no-`dangerouslySetInnerHTML` sweep applies to it. Checked manually:
`dangerouslySetInnerHTML` → absent; one static `title=` on the judge badge (`:159`), carried
**verbatim** from `WorkflowDoorSwitch.tsx` and containing no user- or definition-derived data. No
action required; recorded so the gap in fence coverage is visible rather than assumed away.

---

## Observations

### OBS-1 — the D-19 sentence is TRUE of the code, with one nuance worth stating and NOT rewording

The rendered claim is *"Stored untrusted — never run as code, never fed to the fill engine."*
Strictly, an uploaded `template_input` **is** fed to a fill engine — the **`run_replace`** engine
(non-Jinja, scalar substitution only). What it can never reach is **docxtpl/Jinja**, which is the
SSTI surface the Phase 152 threat model named, and that is enforced structurally
(`template_render_service.py:947-951`, reached from the live path at `tool_dispatcher.py:3320`).

**Recommendation: do not reword.** D-19 explicitly offered and rejected a reword, on the grounds that
improving a security claim's cadence is how such claims quietly weaken; the sentence also predates
this phase and is byte-fenced in six baselines. This is recorded so a future reader who traces the
code does not mistake the nuance for a lie in the UI.

---

## Accepted Risks Log

| ID | Threat | Owner | Rationale | Re-open trigger |
|----|--------|-------|-----------|-----------------|
| **A-1** | `T-193-07` — the predicate reads a field beyond the display read-shape (`definition.assets[].kind`) | Phase 193 (193-02) | `DefShape` is widened by exactly one optional `assets` member. Only `kind` is consumed; `asset_id` is declared because live rows carry it and is **never read, rendered or logged** — verified: every non-type occurrence in the tree is a test fixture. `tsc -p tsconfig.app.json` unmoved at 33 across the widening. | Any consumer reads a second key of `assets[]`, or any `assets`-derived value reaches the DOM or a log. |
| **A-2** | `T-193-16` — the throwaway sketch emitter running with real `@/lib/api` bindings | Phase 193 (193-04) | The emitter `vi.mock`s the whole `@/lib/api` surface it touches (`generateWorkflow`, `createWorkflowDraft`, `updateWorkflowDraft`, `listFolders`, `listSkills`) and runs under jsdom with no network. The mock set is shipped and unchanged. The emitter file itself does not exist in the tree (T-193-15). | The emitter is re-introduced without the mock block, or gains an unmocked api import. |
| **A-3** | `T-193-21` — D-15's silence on the card read as *"no template needed"* | Phase 193 (193-06), decided not defaulted | On the card, silence costs nothing and a fabricated claim costs trust: `"does-not-admit"` and `"unknown"` are **deliberately indistinguishable** and are asserted against one shared expected value, so their identity is structural rather than promised. The named check is UAT **U5**, driven against `ephemeral-template-fill-101uat`. The acceptance is recorded in the card's own docblock. | A future surface begins treating absence-of-mark as an assertion, or the two silent arms are given distinguishable renderings. |
| **A-4** | `T-193-35` — attributing the `WorkflowBuilderPage.canvas.test.tsx` ~14 % flake to this phase | Phase 193 (193-08) | Named in advance with its evidence (a Phase-184 suite, seen in main tree and worktree, pre-existing). Not fixed here — folding unrelated drift into a commit that did not cause it is the failure mode being avoided. **Did not fire**: the suite is green in this audit's full-gate run. | The flake rate rises, or it reds on a commit that touches the canvas path. |

---

## Escalations

### E-1 — ⛔ OPEN · `T-193-48`'s declared assertion does not hold

**Declared mitigation (`193-11-PLAN.md:302`):** *"The header tally is mechanical and
`grep -c "result: *$"` must be 0; a row that cannot be driven is ⛔ with a reason and a blocking id,
never dropped."*

**Measured at HEAD:**

```
grep -c "result: *$" .planning/phases/193-…/193-UAT.md   → 2
```

The two hits are U1 (`:202`) and U2 (`:230`), which carry a **blank** `result:` field rather than a
⛔ verdict token with a blocking id.

**What is genuinely mitigated, and why this is not a code risk.** The underlying threat — *a phase
closed claiming UAT it did not run* — is **not realized**. The artifact is honest in every other
respect: frontmatter reads `driven: partial · driven_rows: 6 · owed: 2`, the header reads
`6 driven · 5 pass · 1 partial · 0 fail · 2 owed`, and the reason U1/U2 are undriven is stated
prominently and correctly (*"they ask a person who has never used the Builder to predict what each
door does… an agent that has read the source is the worst possible subject"* — scoring them would be
a check that cannot fail). Phase verification is `human_needed`, not `passed`.

**Why it is still reported as OPEN rather than smoothed:** the mitigation the register declared is a
*mechanical* one, and a mechanical guard that does not hold is exactly the class of defect this gate
exists to surface (this repo has twice shipped a register entry whose assertion did not exist). The
gap is in a documentation artifact, not in implementation code, and no implementation file was
touched to reach this verdict.

**Two acceptable resolutions — the operator's call, and this auditor may not make either edit:**

1. **Two-line artifact fix** — replace the blank `result:` on U1 and U2 with
   `result: ⛔ not drivable by the assistant — operator-owned (see header)`, which restores
   `grep -c "result: *$"` → 0 and satisfies the "⛔ with a reason, never dropped" clause literally.
   Recommended: it is the cheaper of the two and makes the register true again.
2. **Amend the register** — record `T-193-48` as `accept` in this file's Accepted Risks Log, on the
   grounds that a *deliberately blank, prominently disclosed* result is the authored convention
   (`59274715` states "Every `result` field below is deliberately blank") and the honesty is carried
   by the frontmatter tally instead.

**This does not block the code.** No `mitigate` threat against implemented source is open.

### E-2 — the fast-fix commit `294a2ac8`, audited on its own (CLEAN)

Audited because no plan owned it and no plan-checker reviewed it. `git show 294a2ac8 --stat` → **5
files**: `WorkflowBuilderPage.tsx` (+28/−…), three of its suites, and the door baseline (−2, a
declared words-only re-capture). Reading the full source hunk: the change is **exactly** five
literal→governed-id substitutions (`DESCRIBE_H1`, `DESCRIBE_CTA`, `HINT_FRAG1-3`), one added import
block from `doorVocabulary`, and two comment corrections that had been naming a string the code no
longer renders. **No handler, no fetch, no prop, no conditional, no state, no auth path changed.
Nothing rode along.** The file was subsequently pulled *into* the D-24(a) sweep by WR-01
(`3f31e8cc`), so the copy gap that made this fix necessary is now mechanically guarded rather than
left to discipline.

---

## Security Audit Trail

| Item | Value |
|------|-------|
| Audited at HEAD | `743d31e4` |
| Audited from base | `501b3c14` (`docs(193): planned`) |
| Mode | verify-mitigations (all 11 plans carried a `<threat_model>` block) |
| Register source | `193-{01..11}-PLAN.md` `<threat_model>` blocks |
| Threat-flag source | `193-{01,02,03,05,06,07,08,09}-SUMMARY.md` `## Threat Flags` (3 plans have none — UF-2) |
| Backend / schema / migration changes | **none** — confirmed by diff, not by the plans' claim |
| Dependencies added | **none** — `package.json`, `package-lock.json`, `requirements.txt` all unchanged |
| Implementation files modified by this audit | **none** (`index.html` was regenerated for the T-193-13 idempotency check, verified content-identical, and restored) |
| ASVS level | 2 (project convention; not declared in any 193 artifact — no `<config>` block exists in this phase) |

---

## Sign-Off

**50 of 51 threat entries CLOSED. 1 OPEN (`T-193-48`), and it is a documentation-artifact assertion
with no implementation-code impact.** The four `accept` dispositions are logged above with re-open
triggers. No `transfer` dispositions were declared.

The three surfaces this phase's brief called security-bearing were each traced to code rather than
to prose:

- **The D-19 provenance sentence is byte-unchanged AND still true of the code** — the phase diff
  never touches it, six baselines byte-fence it, and the untrusted-upload → `run_replace` routing is
  enforced by `select_engine` on the live call path with an `assert` against the Jinja branch.
- **The upload control was not widened** — `accept=` and `type="file"` produce zero hits in the
  phase diff, and the client list matches the server allowlist exactly.
- **`templateAdmission`'s `unknown` arm is a positive-no-only gate at both call sites, in the
  correct direction each time** — `!== "does-not-admit"` in the Run modal (shows the control; WFIN-01
  cannot be stripped from the ~76 % of the library that answers `unknown`) and `=== "admits"` on the
  card (stays silent), with the asymmetry documented as a decision at `RunModal.tsx:93-112` and the
  jsonb string-scalar shape pinned as a test case.

Verdict: **OPEN_THREATS (1)** — resolve E-1 by either of the two named routes, then this phase is
clean for ship.
