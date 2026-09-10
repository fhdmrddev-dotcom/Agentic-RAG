# Phase 237 — Reviewer Baseline (captured BEFORE any build work)

**Captured by:** claude (REVIEWER — not the builder, AGENTS.md 6.3)
**Date:** 2026-09-06
**Base commit:** `0798d25ea724aa642779cda352fd65b2ccd42313` (branch `develop`)
**Tree state at capture:** source-clean — the only working-tree entries are deleted `screenshots/*`
and an untracked `graphify-out/converted/*.md`. **No source file modified.** Gemini confirmed on
BUS-174: *"zero source touched."*

Every figure below was **re-measured**, never read from a claim.

---

## 1. Backend unit baseline

Command (the canonical one, run in `backend/` with the venv):

```
pytest tests/unit -q --continue-on-collection-errors
```

Verdict line, verbatim:

```
71 failed, 3946 passed, 2 xfailed, 2 xpassed, 44 warnings in 145.65s (0:02:25)
```

- **71 failed** — exactly the CLAUDE.md ceiling. **Zero headroom.** A 72nd failure breaks the gate.
- The **full failing SET** (all 71 node ids, not a tail) is saved so a later run is diffed by SET,
  never by count.
- `3946 passed` against the CLAUDE.md-quoted `3497`: growth, not drift. The ceiling is on *failed*.

## 2. Frontend count gate

`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, run from the repo root. Verdict line,
verbatim:

```
  total                                      6991    7787    +796
  total 7787  ·  failed 3  ·  pinned total 6991
FAIL  [failing-tests] 3 test(s) failed — the gate requires 0.
```

⛔ **THE GATE IS RED AT HEAD, ON A TREE WITH AN EMPTY FRONTEND DIFF.** `git diff --numstat HEAD --
frontend/` returns nothing, so both failing files are **provably unmodified**. This red is
**inherited**; it is not attributable to any Phase 237 work, and it existed before Gemini started.

Failing set, taken from the gate's **own persisted JSON report BEFORE anything was re-run**
(the SEED-171 procedure — capture the set, then re-run, never the reverse):

| File | Test | Signature |
|---|---|---|
| `src/pages/WorkflowBuilderPage.canvas.test.tsx` | canvas door — flag ON (D-183-01) | `STACK_TRACE_ERROR` |
| `src/components/library/__tests__/sketchComposition.test.tsx` | §2 positive control — "the mount harness works" | `STACK_TRACE_ERROR` |
| `src/components/library/__tests__/sketchComposition.test.tsx` | §2 positive control — "the four shipped tab triggers render" | `TestingLibraryElementError: Found multiple elements with the role "tab" and name "Documents"` |

- `WorkflowBuilderPage.canvas.test.tsx` **is** one of SEED-171's named flaky suites.
- `sketchComposition.test.tsx` **was not** — it is a **sixth** suite, the first outside the
  `workflows`/`pages` family, and its second failure is a **hard assertion, not a timeout**
  (leftover DOM from a sibling test in the same worker). Both of its failures are the suite's own
  **positive controls**. Written back into `SEED-171` at this baseline, and the seed's stale
  `title: FOUR …` corrected to six.
- Re-run in isolation: `46 passed | 1 skipped (47)` — clean, and its pin
  (`"sketchComposition.test.tsx": 47`) is intact. ⚠ Recorded as **provably unmodified**, NOT as
  "fine": one green sample of a flaky suite is not proof of innocence.

⚠ **Therefore "the count gate is green" is NOT a usable acceptance criterion for this phase** — it
was not reachable on a tree with zero source changes. At review time I diff the failing **SET**
against this one; a count comparison would be meaningless.

⚠ **`src/components/classification/` is in NEITHER gate knob.** Confirmed against the gate's own
emitted `npx vitest run …` argv, not inferred:

| Suite | in TARGETS (runs)? | in BASELINE (guarded)? |
|---|---|---|
| `ClassificationRulesPage.test.tsx` | ❌ | ❌ |
| `ClassificationSection.test.tsx` | ❌ | ❌ |
| `RuleBuilderPanel.test.tsx` | ❌ | ❌ |

**Consequence for this phase:** a green count gate at Phase 237's close says **nothing** about SC#1's
"same builder, same controls" or SC#3's build-time refusal, because the gate neither runs nor guards
the rule-builder UI. This is the Phase 214 shape (`WorkflowScheduleModal.test.tsx`) repeating.
Recorded as an inherited condition, never as a Gemini finding.

## 3. Migrations

- **High-water on disk: `172_connector_sync_runs.sql`.** Next number is **173**.
- ⛔ **The ROADMAP's Phase 237 `Migrations:` field says `162` and is STALE** (`ROADMAP.md:589`).
  162 is below the high-water, and migrations are monotonic — D-5 point 5 says gaps are never
  backfilled. `STATE.md`'s "next session" line already says **mig 173**; the two disagree. A
  DECISION for the operator if that number is load-bearing anywhere. Recorded, not settled
  agent-to-agent.
- `classification_rules` live DDL (from `supabase/full-schema.sql`) has **no `rule_scope` column** —
  the discriminator does not exist yet:

```sql
CREATE TABLE public.classification_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    org_id uuid NOT NULL,
    name text NOT NULL,
    match_expr jsonb NOT NULL,
    suggest_folder_id uuid,
    is_system_global boolean DEFAULT false NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
```

## 4. The engine at HEAD — where it actually lives

**There are already TWO evaluation call sites against ONE matcher, and their whitelists differ.**
This is the phase's own subject, measured rather than assumed:

| Site | File:line | Scope | Whitelist passed |
|---|---|---|---|
| post-extraction | `backend/app/services/ingest_enrich.py:531` | after read | `_METADATA_BUILTINS` ∪ enabled custom field defs |
| watch / preview | `backend/app/services/sources/preview_service.py:475` | at arrival | `set(_METADATA_BUILTINS)` — **the FULL builtin set** |

⚠ **SC#3's failure mode is LIVE at HEAD.** `_suggest_destination` builds
`preview_metadata = {"title": …, "date": …}` and nothing else, yet passes the **full** builtin
whitelist. So a rule keying on `document_type` / `topics` / `summary` / `author` / `language`
**validates, saves cleanly, and silently never matches at preview time** — verbatim ROADMAP failure
mode #2. The phase must close this; the baseline proves it is open right now.

Whitelist source: `_METADATA_BUILTINS = set(DocumentMetadata.model_fields)` (`documents.py:1791`)
→ **7 builtins**: `title`, `author`, `date`, `document_type`, `topics`, `language`, `summary`.

**The queue path DOES reach rule evaluation** — measured, not assumed, because the ROADMAP's own
D-5 point 3 got exactly this wrong once:
`ingestion_queue_service._process_job:222` → `ingest_splice.splice_document` →
`ingest_splice.py:618 enrich_for_ingest` → `ingest_enrich.py:531` rule eval → the splice writes
`enriched.metadata` back to the row. `BUG-260906-01`'s fix is in place.

## 5. SC#4 — the VIS-06 fence as it stands (to be re-proven, never re-written)

`backend/app/api/documents.py:1957-1985`, inside `accept_classification` (`:1892`):

```python
if (
    doc.data.get("source_connection_id")
    and doc.data.get("ingest_visibility") == "private"
    and folder.data.get("is_org_shared") is True
):
    if not force:
        raise HTTPException(status_code=403, detail={"error": "classification_refusal", ...})
```

Owner-scoping baseline that must survive the widening:

- `ingest_enrich.py:517` — a service-role read gated **solely** by
  `.or_(user_id.eq.{coerce_uid(user_id)},is_system_global.eq.true)` …
- `ingest_enrich.py:526` — … plus the **fail-closed Python re-filter** (AR-118-02). Defence in
  depth, **not** redundancy — it must not be "simplified" away during the widening.
- `classification_rule_service.list_rules:95` — the same OR predicate. ⚠ **`preview_service` reads
  rules through `list_rules` and carries NO equivalent fail-closed re-filter.** That asymmetry is
  recorded here so it cannot later be mistaken for phase-introduced.
- The engine **never writes `folder_id`** — it writes one `metadata._classification` suggestion.
  `accept_classification` is the only mover, so "suggests, never moves" is structurally true at HEAD.

## 6. G-5 ledger state for the blast radius

Triples re-derived from git (`commits / phases / lines`; six-digit dated quick-task buckets subtracted):

| File | triple | ledger row? | G-5 |
|---|---|---|---|
| `backend/app/api/document_views.py` | 11 / **5** / 300 | ❌ none | ⛔ **FIRES — inherited, absent at 5 phases** |
| `backend/app/api/classification_rules.py` | 3 / **3** / 172 | ❌ none | ⛔ **FIRES — inherited** |
| `frontend/src/components/classification/RuleBuilderPanel.tsx` | 4 / **3** / 440 | ❌ none | ⛔ **FIRES — inherited** |
| `backend/app/services/classification_matcher.py` | 3 / 2 / 279 | ❌ none | ⚠ crosses to 3 if 237 touches it |
| `backend/app/services/classification_rule_service.py` | 3 / 2 / 156 | ❌ none | ⚠ crosses to 3 if 237 touches it |
| `backend/app/services/view_filter_compiler.py` | 3 / 2 / 277 | ❌ none | ⚠ crosses to 3 if 237 touches it |
| `backend/app/services/ingest_enrich.py` | — | ✅ present | |
| `backend/app/services/sources/preview_service.py` | — | ✅ present | |

⚠ **The ROADMAP's G-5 note names only `classification_matcher.py` and
`classification_rule_service.py`. It is incomplete by three files that ALREADY fire at HEAD.**
`node scripts/check-hot-file-ledger.cjs 237` will fail on them; that failure is **inherited debt,
not a Gemini defect**, and must be attributed as such.

Also re-derived: `backend/app/api/documents.py` = **85 / 33 / 2437**, which matches the CLAUDE.md
cell. The *ROADMAP Phase 229* text quotes `73 / 30 / 2562` — stale there.

## 7. SC#2 — the seam that already exists

Saved Views compile to three legs (`document_view_resolver.py:241-248`): `containment`, `custom`
(`metadata->>'field'`), and **`typed` — a real `documents` column**. The typed set is the exact seam
RULES-02 widens:

```python
PROMOTED_TYPED_COLUMNS: dict[str, str] = {
    "document_type": "document_type_norm",
    "date": "date_typed",
}
```

Source facts are **real columns**, not metadata keys — `documents.source_connection_id`,
`documents.source_state` (mig 170), `documents.ingest_visibility`. So SC#2's "where it came from as
ordinary fields" is a `PROMOTED_TYPED_COLUMNS` widening, **not** a new leg. A phase that adds a
fourth leg has taken the anti-pattern the phase exists to prevent.

⚠ `document_view_resolver.py:197` whitelists **only the `custom` leg**
(`if frag.leg == "custom" and frag.field not in whitelist`). A source field added as `typed` would
**bypass the whitelist check entirely** — verbatim ROADMAP failure mode *"the whitelist is bypassed
by one caller, and rule evaluation reads a field nobody vetted."* Named at baseline so SC#2's
implementation is checked against it rather than discovered after.

## 8. Pinning tests at HEAD (counts, so a weakening is visible)

| Suite | tests |
|---|---|
| `backend/tests/unit/test_113_view_filter_compiler.py` | 7 |
| `backend/tests/unit/test_114_view_filter_compiler.py` | 27 |
| `backend/tests/unit/test_118_rule_validation.py` | 8 |
| `backend/tests/unit/test_118_matcher.py` | present |
| `backend/tests/unit/test_ingest_enrich_shared.py` | present — the agreement test |
| `backend/tests/integration/test_118_rule_leak.py` | present — **the owner-scoping leak test; SC#4 leans on it** |
| `backend/tests/integration/test_118_ingest_suggest.py` | present |

## 9. Other gates, green at HEAD

- `node scripts/check-claude-md-size.cjs` → **OK**; `CLAUDE.md` 80,950 chars (54% of limit,
  69,050 headroom).
- `.planning/config.json` G-8 enforcement in place: `nyquist_validation:false`,
  `post_planning_gaps:false`, `plan_check:true`, `pattern_mapper:true`, `tdd_mode:true`,
  `security_enforcement:true`, `inline_plan_threshold:4`, `use_worktrees:true`.

## 10. Register cross-check

- `SEED-209` (`connector-ingestion-must-route-through-the-classification-splice`) —
  `status: planted`. Matches the ROADMAP's quoted sentence; very likely the intended fold.
- `SEED-243` (`find-the-document-not-just-the-answer`) — `status: planted`. ⚠ **The ROADMAP Flags
  line cites SEED-243 for "the folder-watch rules and the classification surface should be designed
  together", and that sentence does not match SEED-243's title.** Possible wrong seed id — flagged,
  not resolved.
- `SEED-252` (`metadata-driven-filing-many-rules-contribute-and-the-file-is-actually-moved`) —
  `status: planted`. The operator's ask. ⚠ Its *"actually moves the file"* half **conflicts** with
  SC#4's *"still only ever suggests"*. Not a defect — a boundary that needs stating, and an
  operator DECISION if 237 is meant to touch it.

---

## What I will re-measure at review time (nothing read from a claim)

1. Backend verdict line, and the failing **SET** diffed against §1's saved set — never the count alone.
2. Count gate verdict line verbatim, and the failing SET diffed against §2 (2 files / 3 tests, both provably unmodified) — a count comparison is meaningless here. Plus whether the three classification suites entered TARGETS
   and BASELINE. A green gate that still excludes them is not evidence for SC#1 or SC#3.
3. SC#3 **driven**: save a watch-scope rule naming `document_type` → must be refused at build time,
   with the reason shown.
4. SC#4 **driven**: a private-connection document with an org-shared target folder → 403
   `classification_refusal` under the widened engine, with `force=True` still the only override.
5. SC#1 / SC#2 **driven**, not asserted from a passing test — one builder covering both scopes, and
   a saved View filtering on a source field.
6. `node scripts/check-hot-file-ledger.cjs 237` — with §6's inherited failures attributed as inherited.
