---
phase: 245
kind: uat-results
driven: 2026-09-13
driver: claude (solo — OV-SOLO-01)
environment: "local dev — vite :5173, backend :8000, Supabase :54322, Redis :6379; all five ports verified accepting real TCP connections before the drive"
thread: "Drive fixture 245-UAT-throwaway-DELETABLE (1e-mOprqjjxp3AHa8IPE8d4QnK4hYorSP) → Library folder 245-UAT-DELETABLE (e23b2c9e-e0c0-4818-89ce-5c381b193116)"
rows_driven: [233-row-1, 233-row-2, 233-row-3, 233-row-4, 233-row-5, 237-rule-builder-click]
rows_partial: [238-M-9]
rows_owed: [238-M-9-microsoft-arm, 233-row-3-refusal-arm]
---

# Phase 245 — UAT results, driven in a real browser

**Every row below states which requirement it discharges**, because the filename no longer says
(D-12). ⛔ **Not one verdict here rests on a test suite.** Each is an observation, and every
database claim is a measurement taken at a named moment.

## Setup, and the identity proof that gated everything

⭐ **D-10 was softened deliberately and it is recorded as `DEVIATION-245-02-A`.** D-10 assigned the
Drive-side setup to the operator; the claude.ai Drive MCP authenticates as `fhdmrd@gmail.com`, the
same account the app's `oauth_byo` Google connection uses, so Claude created the fixture and the
operator authorised both that and the local-corpus writes in chat before any of it ran.

**Fixture** — `245-UAT-throwaway-DELETABLE`, five files, exactly one native Google Doc (D-09/D-11):

| file | type | bytes | role |
|---|---|---|---|
| `245-UAT-native-doc-provenance-memo` | `application/vnd.google-apps.document` | 1024 | row 5's mechanism |
| `245-UAT-quarterly-report.pdf` | `application/pdf` | 1653 | |
| `245-UAT-policy-note.docx` | OOXML wordprocessing | 1084 | hand-built minimal zip, verified readable by `python-docx` |
| `245-UAT-readme.txt` | `text/plain` | 227 | |
| `245-UAT-unsupported.png` | `image/png` | 70 | intended unsupported bucket |

### ⛔ The identity proof — an equality, not a name match (C-1)

An invisible folder and a broken preview are indistinguishable, so this gated every row.

- `create_folder` (MCP) returned id **`1e-mOprqjjxp3AHa8IPE8d4QnK4hYorSP`**.
- The app's own Drive browser rendered the folder, and the React component rendering the selected
  node carried **`folderId = "1e-mOprqjjxp3AHa8IPE8d4QnK4hYorSP"`** — read off the live props.
- **Byte-identical. Same Drive, same folder, proven by id.**
- Corroboration: the app's single-file import modal listed all five files at their exact byte sizes
  (1.6 KB / 1.1 KB / 70 B / 227 B / 1 KB), and the preview POST went to
  `/connectors/connections/5deb27f0-b33b-4dc5-b45b-538de2842915/preview` — the Google connection id
  in the database.

⚠ **243's lesson applied**: *a click for `anthropic` selected `minimax`; a scoreboard with
unverified attribution is worse than none.* A name match would not have been enough.

### Row 2's baseline, captured immediately before the first preview

`documents 162 · document_chunks 7988 · folders 25 · ingestion_jobs 72`
(`max(created_at)` captured for each — **a count is not a set**.)

⚠ Noted while capturing: the Library header read **152 documents** while the database read **162**.
The screen and the corpus disagree. **This is precisely why row 2 is scored against the database.**

---

## DEBT-02 — Phase 233's five G-4 rows

### Row 2 — *close without confirming, four tables unchanged* — ✅ **PASS** (driven FIRST)

`233-VERIFICATION.md:88` says run it first: it is the one criterion whose failure is invisible from
the screen.

| table | before | after | Δ | `max(created_at)` changed |
|---|---|---|---|---|
| `documents` | 162 | 162 | **+0** | no |
| `document_chunks` | 7988 | 7988 | **+0** | no |
| `folders` | 25 | 25 | **+0** | no |
| `ingestion_jobs` | 72 | 72 | **+0** | no |

Window: `02:48:14Z` → `02:57:09Z` — nine minutes containing a full folder browse, **two** preview
calls and a cancel. ⭐ **`max(created_at)` is what makes this airtight**: counts alone cannot
distinguish *nothing written* from *written and removed*.

⭐ The product also states it: **"Closed. 0 documents · 0 chunks · 0 jobs · 0 folders written."**
That is a claim on screen; the table above is the independent verification of that claim.

### Row 1 — *four buckets, counts sum, hatched segment reads as uncertainty* — ✅ **PASS**

| bucket | count | contents |
|---|---|---|
| Will be added | **3** | `policy-note.docx` (DOCX), `unsupported.png` (PNG), `readme.txt` (TXT) — each showing `/245-UAT-DELETABLE` as its landing place |
| Already here | **0** | labelled *"by source file, not content"* |
| Type not supported | **0** | |
| Can't tell without reading it | **2** | `quarterly-report.pdf` → *"may have no text"*; `native-doc-provenance-memo` → *"native Google file"* |

**3 + 0 + 0 + 2 = 5 = the folder's file count. Counts sum.** The segmented bar rendered a solid
segment plus a **hatched** segment, and the hatching maps to the *can't tell* bucket — uncertainty
is drawn differently from certainty, which is the sketch's bar. ⭐ **Each uncertain row names its
own cause**, and the confirm button read **"Add 3 · read 2"** — the product distinguishes what it
will add outright from what it must read to decide, rather than flattening both into one number.

⚠ The PNG landed in *will be added*, not *type not supported* — correct, PNG is in the supported
list (multimodal). No borderline judgement was needed, so N-3's tie-breaker did not apply.

### Row 3 — *confirm, counts match, bar dissolves* — ✅ **PASS** (one arm owed)

| table | before | after | Δ |
|---|---|---|---|
| `documents` | 162 | 167 | **+5** |
| `document_chunks` | 7988 | 7993 | **+5** |
| `folders` | 25 | 25 | +0 |
| `ingestion_jobs` | 72 | 77 | **+5** |

All five reached `status=completed`. The native Doc was exported by Drive and stored as
`245-UAT-native-doc-provenance-memo.pdf`. On the later single-file import the product printed its
own reconciliation: **"1 accounted · 0 unaccounted — preview said 1 — 1 accepted."**

⛔ **Owed arm:** *"a refusal names its cause"* was **not exercised** — nothing was refused in this
run, because every file imported cleanly. **Trigger:** the next drive that induces a refusal (an
oversized, permission-denied, or unreadable file). Recorded rather than claimed.

### Row 4 — *confirm the same folder twice, nothing re-imported or re-embedded* — ✅ **PASS**

Second preview of the identical folder: **0 will be added · 5 already here · 0 unsupported ·
0 can't tell.** Database across the second preview: `documents 167 → 167`, `chunks 7993 → 7993`,
`folders 25 → 25`, `jobs 77 → 77`, **no `max(created_at)` moved.**

⭐ **Stronger than idempotence:** the confirm button rendered `"Add 0"` with `disabled = true`
(read off the live DOM). A second import is not merely harmless — **it cannot be issued.**

### Row 5 — *a native Google Doc already in the Library resolves from "can't tell" to "already here"* — ✅ **PASS**

The cleanest row of the five, because the same file was observed in both states:

| | first preview (before import) | second preview (after import) |
|---|---|---|
| `245-UAT-native-doc-provenance-memo` | **Can't tell without reading it** — *"native Google file"* | **Already here** |
| *can't tell* bucket total | **2** | **0** |

The bucket the native Doc occupied emptied entirely once the content existed. **Exactly the
criterion**, and the reason D-11 put a native Doc in the fixture.

---

## DEBT-01 — Phase 238's residue

⚠ **Eleven-or-nine, stated explicitly** (the CONTEXT's count ambiguity, resolved rather than
inherited): 238's table holds **eleven** rows — `M-1…M-9` plus `S-1`/`S-2`. **"Nine" means the M
rows**; S-1/S-2 are two *additional* rows, not a subset.

### M-9 — ⚠ **PARTIAL — driven against Google Drive, which FAILED with a traced cause; the Microsoft arm is owed**

The rule was created **through the real surface** (`RuleBuilderPanel`) — see the 237 record below —
and stored correctly:

```
name: 245 UAT — Finance path rule (M-9)   rule_scope: watch   enabled: true
match_expr: {"op":"and","conditions":[{"op":"contains","field":"path","value":"/Finance/"}]}
suggest_folder_id: e23b2c9e-… (245-UAT-DELETABLE)
```

A file was placed at `/245-UAT-throwaway-DELETABLE/Finance/` and imported **through both doors**
(D-05's requirement):

| door | file | `source.path` | `folder_id` | `folder_suggestion` | rule fired |
|---|---|---|---|---|---|
| manual folder-import | `245-UAT-finance-invoice.txt` | **null** | None | absent | ❌ no |
| watch loop (`Sync now`, `last_status: success`) | `245-UAT-finance-statement-watch.txt` | **null** | None | absent | ❌ no |

⭐ **Driving BOTH doors is what produced the correct root cause, and it is not the one D-05
predicted.** Corpus-wide, grouped by source system: Gmail populates `path` (`/INBOX` ×25,
`/CATEGORY_FORUMS` ×2), Microsoft OneDrive populates it (`/Attachments/…` ×2 — 238's own M-6/M-7
documents), and **no Google Drive document has ever had one**, including the pre-existing `CV`
watch. The split is **by ADAPTER, not by door**. Filed as **`BUG-260913-01`**.

⚠ **This does NOT settle M-9**, and saying so is the point: **238 is a Microsoft Graph phase, so
M-9's own provider is OneDrive** — where `path` *is* populated. This drive exercised Google Drive
and found a wider, different defect. **M-9's Microsoft arm remains owed.** Trigger: a `/Finance/`
folder existing in the OneDrive account (an operator action), or the next phase touching Graph
ingestion.

### 237's rule-builder — ⭐ **CLICKED, and it covered MORE than D-14 predicted**

D-14 expected the M-9 click to cover only a single `path contains` rule, leaving 237's scope
selector and its out-of-scope condition filtering untouched. **The scope selector could not be
avoided**: `path` is an arrival-scope field, so creating the rule required switching the panel from
*"After extraction (Classification)"* to *"When files arrive (Watch)"*.

**Covered:** the rules page (`All (1) → All (2)`, `Arrival (0) → Arrival (1)`); the two-card scope
selector and the switch between them; the arrival field list, observed as exactly
`name · path · type · size · date · source_system · source_connection_id`; the condition operators
`is · is one of · contains · is empty`; the value input; the destination folder picker; save; and
the persisted `rule_scope: watch`.

**Still NOT covered:** **out-of-scope condition filtering on scope switch** — the behaviour where an
already-entered condition is dropped when the scope changes. The rule here was built scope-first,
so no condition ever had to be filtered. **Trigger:** the next classification-rules phase.

⚠ Also observed, unprompted and worth keeping: the panel renders a live
**"Would match 0 documents in your library — existing docs aren't moved — rules suggest on new
uploads only."** It is honest about both its scope and its blast radius at authoring time.

---

## Defects found by driving

**One, and it is a real one:** `BUG-260913-01` — the Google Drive adapter never writes
`metadata.source.path`, on either door, so **every path-based classification rule is silently inert
for every Google Drive document.** No error, no warning; the rule reads as active and does nothing.

⛔ **Not fixed here, by decision (D-16).** The G-3 line is ≤ 1 file / ≤ 10 lines / no schema or API
surface; this needs an adapter change plus a cross-adapter fence, and 245 has no plan budget.
**Filing it is the complete response.** ⭐ The fix owes a **fence**, not just a patch: this gap
existed on Microsoft until 238 and on Drive since 232, so a test asserting that *every* adapter
populates `source.path` is what stops the next adapter repeating it.

⚠ **The first diagnosis in that report was wrong and is preserved inside it rather than
overwritten** — it blamed the manual-import door, generalising from one door before the other was
measured. The watch arm is what redirected it to the adapter. **D-05's insistence on both doors is
the only reason the cause is right.**

## Reported-bugs observed while driving

None of `BUG-260909-03..07` were reproduced or contradicted in this session; the drive passed
through `frontend/sources` and the watch surfaces but did not exercise their specific claims. They
stay open, unchanged, and explicitly **not** folded (245 has no source-change budget).

## Teardown owed

Drive folder `1e-mOprqjjxp3AHa8IPE8d4QnK4hYorSP` (7 files incl. `Finance/`); Library folder
`245-UAT-DELETABLE` and its 5 documents + 2 Finance documents; the `Finance` watch; and the
classification rule `245 UAT — Finance path rule (M-9)`. ⚠ **Keep them until the verdict is
accepted** — they are this file's evidence.
