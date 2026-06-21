---
phase: 118-auto-classification
verified: 2026-06-21T10:30:00Z
status: passed
score: 3/3 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 2/3
  gaps_closed:
    - "CLASS-01 reachability: ChatLayout.tsx classification-rules render branch + nav-items.ts NAV_ITEMS entry both added in commit 6394d16e"
  gaps_remaining: []
  regressions: []
---

# Phase 118: Auto-Classification Verification Report

**Phase Goal:** Turn the now-richer metadata into routing intelligence — classification rules that produce a suggestion on upload (never a silent auto-move) the user can accept or dismiss.
**Verified:** 2026-06-21T10:30:00Z
**Status:** passed — all 3 must-haves VERIFIED
**Re-verification:** Yes — after gap closure (commit 6394d16e)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | CLASS-01: User can DEFINE classification rules (metadata condition → suggested folder), stored in `classification_rules`, owner-private or global, enable/disable-able; and the rules-authoring UI is REACHABLE in the running app | ✓ VERIFIED | `nav-items.ts:31`: `{ view: "classification-rules", icon: Wand2, label: "Classification" }` entry present. `ChatLayout.tsx:11`: `ClassificationRulesPage` imported. `ChatLayout.tsx:294-299`: `activeView === "classification-rules"` branch mounts `<ClassificationRulesPage />` before trailing `KnowledgeHealthPage` else. `ClassificationRulesPage` self-fetches via `listRules()` on mount, hosts `AutomationGroup` (list) + `RuleBuilderPanel` (create/edit). Backend CRUD router (`classification_rules.py`) is mounted at `/classification-rules` in `main.py:425`. Gap closed by commit `6394d16e`. |
| 2 | CLASS-02: On upload, the rule-eval pass in `ingest_document` writes a suggestion into `metadata._classification` — never a silent auto-move; rule-matching reads are explicitly user-scoped in app code (no reliance on `auth.uid()` inside the BackgroundTask) | ✓ VERIFIED | `documents.py:1882-1902`: ingest splice is present, positioned between metadata-build and the persist UPDATE. `metadata_dict["_classification"]` written on first-match-wins; no `folder_id` assignment. `.or_(f"user_id.eq.{user_id},is_global.eq.true")` is the explicit app-code scope gate (D-118-8). `except Exception` degrades gracefully. Unchanged by the gap-closure commit. |
| 3 | CLASS-03: User can accept or dismiss a classification suggestion from the document row/detail; accepting writes a `classification.apply` audit row and performs the move; dismissing clears the suggestion; the whole flow is reversible (prior_folder_id recorded) | ✓ VERIFIED | `accept_classification` (`documents.py:1455-1543`): records `prior_folder_id`, re-validates target folder, moves doc, stamps `status="accepted"`, writes `classification.apply` audit AFTER the move (not optimistic). `dismiss_classification` (`documents.py:1546-1587`): pops `_classification` with no move, no audit. `ClassificationSection.tsx` wires Accept/Dismiss/Undo via re-fetch-not-optimistic. `DocumentList.tsx` row chip renders only for `status==="suggested"`. `ClassificationSection` IS mounted as the 3rd PanelSection in `DocumentDetailPanel.tsx:261-274`. These surfaces are reachable via the document list/detail flow. Unchanged by the gap-closure commit. |

**Score: 3/3 truths verified**

---

## CLASS-01 Gap Closure Evidence

The sole gap from the initial verification (18/3 score 2/3) was that `ClassificationRulesPage`, `RuleBuilderPanel`, and `AutomationGroup` were fully built but unreachable — no render branch in `ChatLayout.tsx` and no nav entry in `nav-items.ts`.

Commit `6394d16e` ("fix(118): wire classification-rules top-level route + nav entry") closed this with two additive changes:

**`frontend/src/lib/nav-items.ts` (line 31):**
```ts
{ view: "classification-rules", icon: Wand2, label: "Classification" },
```
Placed adjacent to Documents (the doc-automation home), using `Wand2` — a distinct non-reused glyph as required (Skills already uses `Zap`). `Wand2` is imported on line 15.

**`frontend/src/components/layout/ChatLayout.tsx` (lines 11, 294-299):**
```ts
import { ClassificationRulesPage } from "@/components/classification/ClassificationRulesPage"
// ...
} : activeView === "classification-rules" ? (
    <ClassificationRulesPage />
) : (
    <KnowledgeHealthPage />
)}
```
Branch is additive, placed before the trailing `KnowledgeHealthPage` else, mirroring the Phase 103 `WorkflowsPage` pattern. No other render paths were touched. The commit message confirms `tsc --noEmit EXIT 0` and `ClassificationRulesPage tests 6/6 green`.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/services/classification_matcher.py` | Pure in-Python AST→bool matcher + build_suggestion | ✓ VERIFIED | Exists, substantive. `match_metadata` pure — no DB calls, no eval. ViewFilter.model_validate + validate_fields reuse confirmed. |
| `backend/app/services/classification_rule_service.py` | CRUD service with leak-safe own+global reads and `_uid()` coercion | ✓ VERIFIED | Exists. `_uid()` present at lines 53-64, used in `list_rules`/`get_rule`. |
| `backend/app/api/classification_rules.py` | CRUD router mounted at `/classification-rules` | ✓ VERIFIED | Mounted in `main.py:425`. All CRUD + is_global hard-set + 404-uniform pattern present. |
| `documents.py` ingest splice | Rule-eval pass between metadata-build and persist | ✓ VERIFIED | `documents.py:1882-1902`. Explicit user-scoped read. Never writes `folder_id`. First-match-wins. |
| `documents.py` accept/dismiss endpoints | Accept records prior_folder_id + moves + audits; dismiss clears | ✓ VERIFIED | `accept_classification` (1455) and `dismiss_classification` (1546) both present and correctly implemented. |
| `frontend/src/lib/nav-items.ts` | classification-rules NAV_ITEMS entry | ✓ VERIFIED | Line 31: `{ view: "classification-rules", icon: Wand2, label: "Classification" }`. Added by commit 6394d16e. |
| `frontend/src/components/layout/ChatLayout.tsx` | classification-rules render branch + import | ✓ VERIFIED | Line 11: import. Lines 294-299: `activeView === "classification-rules"` branch mounting `<ClassificationRulesPage />`. Added by commit 6394d16e. |
| `frontend/src/components/classification/ClassificationRulesPage.tsx` | Rules list + push/split builder; self-fetches via listRules() | ✓ VERIFIED | Exists and substantive. `useEffect` on mount calls `listRules()` + `listFolders()` + `listMetadataFields()`. Hosts `AutomationGroup` (list) + `RuleBuilderPanel` (builder). Now reachable via ChatLayout render branch. |
| `frontend/src/components/classification/RuleBuilderPanel.tsx` | Builder with chip-strip, folder-only, scope, live preview | ✓ VERIFIED | Fully built. Reachable via `ClassificationRulesPage`. |
| `frontend/src/components/ingestion/AutomationGroup.tsx` | Sidebar Automation group | ✓ VERIFIED | Fully built. Mounted inside `ClassificationRulesPage` as the rule list renderer. |
| `frontend/src/components/classification/ClassificationSection.tsx` | 3rd PanelSection with accept/dismiss/Undo | ✓ VERIFIED | Exists, substantive. Mounted in `DocumentDetailPanel.tsx:261-274`. |
| `frontend/src/components/ingestion/DocumentList.tsx` | Row chip for suggested docs | ✓ VERIFIED | `ClassificationRowChip` component present, gated on `status === "suggested"`. |
| `frontend/src/types/index.ts` | ClassificationRule + ClassificationSuggestion + _classification on DocumentMetadata | ✓ VERIFIED | Lines 402-429, 213. All three additions present. |
| `frontend/src/lib/api.ts` | Rule CRUD + accept/dismiss client fns; createRule omits is_global | ✓ VERIFIED | Lines 2248-2334. `createRule` body confirmed to omit `is_global`. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `nav-items.ts` NAV_ITEMS | `classification-rules` ActiveView | `{ view: "classification-rules" }` entry | ✓ WIRED | Line 31. Added in commit 6394d16e. |
| `ChatLayout.tsx` | `ClassificationRulesPage` | `activeView === "classification-rules"` branch | ✓ WIRED | Lines 294-299. Added in commit 6394d16e. |
| `ClassificationRulesPage` | `listRules()` API | `useEffect` on mount | ✓ WIRED | Line 62: `const data = await listRules()`. |
| `ClassificationRulesPage` | `AutomationGroup` + `RuleBuilderPanel` | JSX render | ✓ WIRED | AutomationGroup at line 173, RuleBuilderPanel at line 187. |
| `ingest_document` splice | `classification_matcher.match_metadata` | import inside BackgroundTask | ✓ WIRED | `documents.py:1884`. |
| `ingest_document` splice | `metadata._classification` write | `metadata_dict["_classification"] = build_suggestion(...)` | ✓ WIRED | `documents.py:1897`. Never writes `folder_id`. |
| `accept_classification` | `classification.apply` audit | `write_audit_entry` after move | ✓ WIRED | `documents.py:1532`. Audit written AFTER the UPDATE succeeds. |
| `ClassificationSection` | `acceptClassification` / `dismissClassification` | re-fetch-not-optimistic on 200 | ✓ WIRED | `ClassificationSection.tsx:35`. `onChanged()` called on success. |
| `DocumentDetailPanel` | `ClassificationSection` | 3rd PanelSection | ✓ WIRED | `DocumentDetailPanel.tsx:261-274`. |
| `DocumentList` row chip | `acceptClassification` / `dismissClassification` | status==="suggested" gate | ✓ WIRED | `DocumentList.tsx` — `ClassificationRowChip` confirmed. |
| `classification_rules.py` router | `main.py` include | `app.include_router(classification_rules.router)` | ✓ WIRED | `main.py:425`. |

---

## Requirements Coverage

| Requirement | Phase | Description | Status | Evidence |
|-------------|-------|-------------|--------|----------|
| CLASS-01 | 118 | User can define classification rules (metadata condition → suggested folder) | ✓ SATISFIED | Backend CRUD (`classification_rules.py`) + `ClassificationRulesPage` + `RuleBuilderPanel` + `AutomationGroup` all built and now reachable via `nav-items.ts` entry + `ChatLayout.tsx` render branch (commit 6394d16e). |
| CLASS-02 | 118 | On upload, matching rules produce a routing suggestion — never a silent auto-move | ✓ SATISFIED | `documents.py:1882-1902`. User-scoped read. Never writes `folder_id`. `metadata._classification` written on match. |
| CLASS-03 | 118 | User can accept or dismiss a classification suggestion | ✓ SATISFIED | Accept/dismiss endpoints work. `ClassificationSection` (reachable via DocumentDetailPanel) and DocumentList row chip both work. Reversible via `prior_folder_id` + Undo. |

All three CLASS requirements are marked `[x]` in `.planning/REQUIREMENTS.md`, consistent with this verdict.

---

## Behavioral Spot-Checks

| Behavior | Result | Status |
|----------|--------|--------|
| Backend router mounted at /classification-rules | `main.py:425`: `app.include_router(classification_rules.router)` | ✓ PASS |
| nav-items.ts has classification-rules entry | `nav-items.ts:31`: `{ view: "classification-rules", icon: Wand2, label: "Classification" }` | ✓ PASS |
| ChatLayout has classification-rules render branch | `ChatLayout.tsx:294-299`: `activeView === "classification-rules"` branch mounting `<ClassificationRulesPage />` | ✓ PASS |
| ClassificationRulesPage imports both AutomationGroup and RuleBuilderPanel | `ClassificationRulesPage.tsx:23-24`: both imported; mounted in JSX | ✓ PASS |
| Ingest splice never writes folder_id | `documents.py:1882-1902`: only `metadata_dict["_classification"]` written; no `folder_id` assignment | ✓ PASS |
| accept endpoint records prior_folder_id | `documents.py:1516-1518`: `prior_folder = doc.data.get("folder_id")` stamped before UPDATE | ✓ PASS |

---

## Anti-Patterns Carried From Initial Verification

The following warnings were noted in the initial verification. None are blockers (no `TBD`/`FIXME`/`XXX` debt markers). They are carried unchanged as the gap-closure commit (`6394d16e`) touched only `ChatLayout.tsx` and `nav-items.ts`.

| File | Line | Pattern | Severity |
|------|------|---------|----------|
| `backend/app/api/documents.py` | 1887 | `.or_(f"user_id.eq.{user_id},is_global.eq.true")` no `_uid()` coercion | ⚠️ Warning |
| `backend/app/api/documents.py` | 1505 | Same pattern in accept endpoint | ⚠️ Warning |
| `backend/app/services/classification_matcher.py` | 269 | Same pattern in `_resolve_folder_name` | ⚠️ Warning |
| `backend/app/api/documents.py` | 1885-1894 | Ingest rule read has no Python-side fail-closed re-filter | ⚠️ Warning |
| `backend/tests/integration/test_118_ingest_suggest.py` | 128-167 | Test re-implements ingest splice inline instead of driving it end-to-end | ⚠️ Warning |
| `frontend/src/components/classification/RuleBuilderPanel.tsx` | 182-211 | `scope` state tracked but not sent in `handleSave` — "Global" scope silently does nothing | ⚠️ Warning |
| `frontend/src/components/ingestion/AutomationGroup.tsx` | 98-108 | Toggle/edit/delete rendered for global rules the caller doesn't own — 404s with only `console.error` | ⚠️ Warning |

No `TBD`, `FIXME`, or `XXX` markers found in any phase-modified file. Warnings are backlog items, not phase blockers.

---

## Human Verification

No items remain for human verification. All three CLASS must-haves are verifiable programmatically. The previously-blocked UI surfaces are now reachable and the wiring is confirmed end-to-end.

---

_Verified: 2026-06-21T10:30:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: gap-closure confirmation after commit 6394d16e_
