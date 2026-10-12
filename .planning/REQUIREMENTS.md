# Requirements: Milestone v4.6 Pay It Down

**Defined:** 2026-10-12 (operator intake; research skipped — every bug report carries a measured root cause)
**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviours (skills) that persist and can be shared.
**Milestone goal:** Every open **major** bug fixed and the v4.5 tech debt cleared. Repair only — no new user capability.

Seeds folded at intake: **SEED-221** (into FIX-10), **SEED-328** (into SEAM-01), **SEED-224** extraction half (into SEAM-02).

## v4.6 Requirements

### Major bugs (FIX)

- [ ] **FIX-01**: An ordinary org member can open Settings and use Memory, Audit Log and "Show technical names"; operator-only tabs stay hidden from them. — `BUG-261004-02`
- [ ] **FIX-02**: Uploading the same bytes while the first copy is still indexing never retires that copy and never 409s; exactly one copy stays visible in the Library and in search. — `BUG-261005-01`
- [ ] **FIX-03**: A watched OneDrive/SharePoint folder larger than one page imports every page, or fails loudly — it never silently restarts the listing at page 1. — `onedrive-adapter-…` WR-02
- [ ] **FIX-04**: A OneDrive search query cannot alter the Microsoft Graph request path. — `onedrive-adapter-…` WR-01
- [ ] **FIX-05**: Folder paths minted by the OneDrive adapter use one encoding, so a filing rule written against the displayed path matches. — `onedrive-adapter-…` WR-03
- [ ] **FIX-06**: A per-model timeout is the timeout the provider call actually gets, up to the maximum the UI accepts; a value above a real ceiling is refused with the reason; `max_retries` is chosen deliberately, not inherited from the SDK default. — `BUG-260916-01`
- [ ] **FIX-07**: One `ask_user` pause shows one answer input; the draft is the same wherever it appears; option selection is not conveyed by colour alone; no dead button remains. — `BUG-260918-01`
- [ ] **FIX-08**: Expanding the Chunks section on a 1,000-chunk document leaves every section below it reachable. — `BUG-260908-01`
- [ ] **FIX-09**: When an emit step fails, the reported cause is the check that actually failed — never "citations" when citation coverage was 100%. — `BUG-260730-02`
- [ ] **FIX-10**: A publish-gauntlet refusal shows the author the precise reason recorded in `harness_audit`, in plain words, never a machine code. — `BUG-260815-06` + `SEED-221`

### v4.5 audit debt (DEBT)

- [ ] **DEBT-07**: The harness freshness validator (`harness/freshness.py`) excludes archived (`retrievable=false`) documents. — W-1
- [ ] **DEBT-08**: A recorded decision states what happens to `message_artifacts` rows when their source document is disposed by retention, and the code enforces it if the decision requires. — W-2
- [ ] **DEBT-09**: The date-word→column map and the topics-is-a-list rule each have one home, imported by `retrieval_scope.py`, `document_search_service.py` and `view_filter_compiler.py`; a test fails if they diverge. — W-3
- [ ] **DEBT-10**: Both watch purge paths remove the stored file bytes as well as the document rows. — W-5 / `BUG-261012-01`
- [ ] **DEBT-11**: `DELETE /documents/{id}` answers 404, not 500, when the caller owns no such row. — W-5 / `BUG-261012-02`

### Owed G-5 extractions (SEAM)

Behaviour-preserving: the backend unit baseline ceiling (71 failed) is not exceeded and the frontend count gate shows no per-file decrease.

- [ ] **SEAM-01**: `backend/app/services/expert_scope.py` is extracted along its named seam (`docs/HOT-FILE-LEDGER.md`); every `SEED-328` item is fixed or recorded with a reason.
- [ ] **SEAM-02**: `backend/app/services/retrieval_service.py` is extracted along its named seam (`SEED-224`, owed since Phase 231).
- [ ] **SEAM-03**: `backend/app/services/tool_dispatcher.py` is split into registry and handlers (`OV-273-02`); the closed core stays at 30 tools and the registry is pinned identical before and after.

### Register hygiene (REG)

- [x] **REG-04**: `CLAUDE.md` measures below the 120,000-char warn band (`node scripts/check-claude-md-size.cjs` exit 0 with no warning), split by function into `docs/` under the same-commit sync rule — nothing deleted.
- [x] **REG-05**: The v4.5 bookkeeping drift is repaired — archived REQUIREMENTS FIND-01/02/03/06 status, ROADMAP 270/271 progress rows, and the missing SUMMARY requirement fields.

## Future Requirements (deferred)

- Owed operator verification carried from v4.5: 275 UAT (18 rows), 273 structured-path drive + WR-04/05, 271 G-4 sign-off + P-01/P-03, 272 re-drive, logged-in production smoke test — operator-driven, tracked in `STATE.md` "Owed".
- Medium/minor open bugs not named above (e.g. `BUG-260828-05`, `BUG-260828-06`, `BUG-260923-01`).

## Out of Scope

| Item | Reason |
|------|--------|
| Any new user-facing capability | Repair-only milestone by operator decision; a capability is a phase in a feature milestone |
| SEED-354 (hold private documents) | Extends retention — a feature, not debt |
| SEED-334 (272 SC#4 remaining providers) | Provider-quality work; carried |
| Open Platform (SEED-013) | Next feature slot, sequenced after this milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FIX-01 | Phase 283 | Pending |
| FIX-02 | Phase 280 | Pending |
| FIX-03 | Phase 280 | Pending |
| FIX-04 | Phase 280 | Pending |
| FIX-05 | Phase 280 | Pending |
| FIX-06 | Phase 282 | Pending |
| FIX-07 | Phase 282 | Pending |
| FIX-08 | Phase 283 | Pending |
| FIX-09 | Phase 281 | Pending |
| FIX-10 | Phase 281 | Pending |
| DEBT-07 | Phase 281 | Pending |
| DEBT-08 | Phase 280 | Pending |
| DEBT-09 | Phase 278 | Pending |
| DEBT-10 | Phase 280 | Pending |
| DEBT-11 | Phase 280 | Pending |
| SEAM-01 | Phase 279 | Pending |
| SEAM-02 | Phase 278 | Pending |
| SEAM-03 | Phase 278 | Pending |
| REG-04 | Phase 277 | Complete |
| REG-05 | Phase 277 | Complete |

**Coverage:** 20 v4.6 requirements · 20 mapped · 0 orphans · 0 duplicates (roadmap created 2026-10-12).

---
*Requirements defined: 2026-10-12*
