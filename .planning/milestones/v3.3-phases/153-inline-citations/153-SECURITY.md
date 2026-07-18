---
phase: 153-inline-citations
requirement: CITE-01
audited: 2026-07-15
asvs_level: L1
block_on: high
threats_total: 27
threats_closed: 27
threats_open: 0
status: SECURED
register_authored_at_plan_time: true
---

# Phase 153 — Inline Citations: Security Audit (SECURITY.md)

Verification of every declared threat mitigation against the **implemented code** (not
documentation/intent). Register was authored at plan time and is treated as COMPLETE — this
audit verifies dispositions, it does not scan for new threats. Implementation files were
READ-ONLY throughout.

**Result: SECURED.** 27/27 threats resolved (23 `mitigate` verified in code, 4 `accept`
justifications hold). 0 open. Diff scope confirmed against `git diff a6124113^..57d1a937`.

---

## Threat Verification

### 153-01 — backend (`citation_markers.py`, `agent_loop.py`)

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-153-01-01 | Spoofing/Repudiation | mitigate | CLOSED | `citation_markers.py:79-92` `_transform_prose` keeps `[n]` iff `1<=n<=k`, drops rest; `:95-109` `normalize_citation_markers` code-span-aware split. WIRED at settle `agent_loop.py:2808` (immediately after dedup `:2800`, before persist — no intervening await/raise). |
| T-153-01-02 | Tampering (shared path / SC#10) | mitigate | CLOSED | Injection `agent_loop.py:1824-1827` gated on `if retrieved_citations:`, NO `provider ==` fork. `apply_citation_instruction` (`citation_markers.py:169-176`) writes BOTH `active_system_prompt` (returned → native sites `agent_loop.py:2030`, `:2105`) AND first `role=="system"` in `messages` (compat), in place — never a new mid-list system message. `threads.py` NOT in phase diff. |
| T-153-01-03 | Tampering (byte-identical off-retrieval) | mitigate | CLOSED | `citation_markers.py:163-164` early-return `active_system_prompt` unchanged + `messages` untouched when `retrieved_citations` empty. |
| T-153-01-04 | Elevation of scope (workflow llm_emit) | accept | CLOSED | Injection is on the Deep agent-loop path only, gated on `retrieved_citations`. No workflow `citation_policy`/`llm_emit` code in the phase diff — accept justification holds. |
| T-153-01-05 | Tampering (poisoned doc → manifest) | mitigate | CLOSED | Manifest is advisory text built from the deduped set (`format_citation_manifest`); set-membership strip (T-153-01-01) means a poisoned instruction cannot fabricate a marker outside `unique_citations`. |
| T-153-01-SC | Tampering (pip installs) | accept | CLOSED | No `requirements*.txt`/`pyproject` in the phase diff — pure-Python over vendored deps. |

### 153-02 — frontend nav (`citationNav.tsx`, `index.css`, `App.tsx`, `IngestionPage.tsx`)

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-153-02-01 | Information Disclosure (Open document) | mitigate | CLOSED | **Shared chokepoint.** `citationNav.tsx:94-101` `openDocument` only `setPendingDocumentId` + `navigate("documents")` + optional inject — no fetch by raw id. `IngestionPage.tsx:152-156` consumes intent → `setSelectedDocId`; `:137-140` `selectedDoc = documents.find(...)` over the owner-scoped list. Foreign/unseeable id never resolves → panel never opens. No new unscoped fetch. |
| T-153-02-02 | Tampering (flash querySelector) | mitigate | CLOSED | `citationNav.tsx:142-146` `coerceIndex` → positive integer or null; `:168-172` `flash` returns early on null, interpolates only the validated integer into `[${attr}="${idx}"]`; missing target is a no-op (no throw). |
| T-153-02-03 | Tampering (shared render tokens) | mitigate | CLOSED | `index.css` diff = 100 insertions, 0 deletions — purely additive block; no existing `.dark` token/keyframe modified or removed. |
| T-153-02-SC | Tampering (npm installs) | accept | CLOSED | No `package.json`/lockfile in the phase diff. |

### 153-03 — footer (`CitationList.tsx`, `CitationCard.tsx`)

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-153-03-01 | Tampering/XSS | mitigate | CLOSED | 0 `dangerouslySetInnerHTML` in `CitationCard.tsx`/`CitationList.tsx` (git grep); filename/passage render as React text children (auto-escaped); `[n]`/Open are inert markup. |
| T-153-03-02 | Information Disclosure (row Open document) | mitigate | CLOSED | `CitationCard.tsx:154` `nav?.openDocument(citation.document_id)` → the T-153-02-01 owner-scoped chokepoint; no raw fetch. |
| T-153-03-03 | Spoofing (footer numbering) | mitigate | CLOSED | `CitationList.tsx:54` `n={i + 1}` over the backend-finalized `citations` array; no client-side membership re-derivation. |
| T-153-03-SC | Tampering (npm installs) | accept | CLOSED | No dependency manifest in the phase diff. |

### 153-04 — peek (`CitationPeek.tsx`)

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-153-04-01 | Tampering/XSS | mitigate | CLOSED | 0 `dangerouslySetInnerHTML` in `CitationPeek.tsx`; passage/filename render as React text nodes; `createPortal` (`:188`) hosts an owned node, model text never re-parsed as HTML. |
| T-153-04-02 | Information Disclosure (peek Open document) | mitigate | CLOSED | `CitationPeek.tsx:177` `nav.openDocument(citation.document_id)` → the T-153-02-01 chokepoint. |
| T-153-04-03 | Denial (a11y trap) | mitigate | CLOSED | `CitationPeek.tsx:117` `aria-modal={pinned ? "false" : undefined}` (non-trapping), `role="dialog"` labelled by head; Escape listener (`:75`) closes; pin toggle carries state-toggled accessible name (`Pin`/`Unpin citation {n}`). |
| T-153-04-SC | Tampering (npm installs) | accept | CLOSED | `createPortal` from react-dom, icons vendored; no manifest change. |

### 153-05 — assembly (`CitedMarkdown.tsx`, `MessageItem.tsx`, `AbsenceHint.tsx`)

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-153-05-01 | Tampering/XSS (V5) | mitigate | CLOSED | `CitedMarkdown.tsx:93-96` `DOMPurify.sanitize(marked.parse(content))`; markers built by `document.createElement("sup")` (`:70`) with `setAttribute`/`textContent` (`:71-77`); container set to sanitized html (`:126`); delegated listeners attached programmatically (`:228-232`), keyed on `closest([data-citation-marker])` (`:169`) — model text can never become an interactive marker. |
| T-153-05-02 | Spoofing (range-check) | mitigate | CLOSED | `CitedMarkdown.tsx:150` `if (n < 1 \|\| n > k) continue` ([0]/out-of-range stay literal), keyed 1:1 to `citations[n-1]` (`:155`); handler `nOf` re-checks range (`:170-173`). Belt-and-suspenders over the backend strip. |
| T-153-05-03 | Tampering ([n] in code/links) | mitigate | CLOSED | `CitedMarkdown.tsx:57-66` `isInSkippedAncestor` skips `code`/`pre`/`a`, called `:142`; markdown links become `<a>` → text skipped. |
| T-153-05-04 | Tampering (G-5 shared-path regression) | mitigate | CLOSED | `MessageItem.tsx:484-491` one additive ternary: cited → `CitedMarkdown`, else byte-identical `MarkdownRenderer` (assistant→dedup, user→raw); `StreamingNarration` (`:483`) unchanged. `StreamsProvider.tsx` NOT in the phase diff. |
| T-153-05-05 | Information Disclosure (marker/peek Open document) | mitigate | CLOSED | Marker/peek route through `CitationPeek` → `nav.openDocument` (T-153-04-02) → the T-153-02-01 chokepoint. |
| T-153-05-06 | Information Disclosure/Tampering (Absence ⓘ copy) | accept | CLOSED | `AbsenceHint.tsx:51,55` copy is static JSX strings — no model/user input flows in. Non-blocking: Radix `Tooltip` (not dialog/modal), no `role="alert"`/`"banner"`, no `aria-modal="true"`; trigger is `<button aria-label="About citations">` (`:40-42`); self-guards `if (!citations?.length) return null` (`:32`). |
| T-153-05-SC | Tampering (npm installs) | accept | CLOSED | Reuses vendored marked/dompurify/react-dom + Radix tooltip/lucide; no manifest change. |

---

## Special-Focus Verification (load-bearing claims, code-checked)

1. **Set-membership strip + wiring (T-153-01-01):** confirmed in `citation_markers.py` — strip drops out-of-range/non-member `[n]` and keeps survivors (identity renumber because manifest order == footer order by construction). Wired at the settle point `agent_loop.py:2808` before `_persist_assistant_message` reads `full_content`. PASS.
2. **Shared-path / SC#10 (T-153-01-02):** injection at `agent_loop.py:1824-1827` writes both `active_system_prompt` and `messages[0]`, no `provider ==` fork; both GatewayRequest sites (`:2030` native, `:2105` compat) forward `system_prompt=active_system_prompt`. `threads.py` absent from the phase diff. PASS.
3. **Owner-scoped Open document (T-153-02-01, shared by 03-02/04-02/05-05):** single chokepoint verified — `openDocument` sets view+intent only; `IngestionPage` resolves via `documents.find(...)` over the owner list; no new unscoped fetch-by-id anywhere. PASS.
4. **Owned-marker XSS + code/link skip (T-153-05-01 + T-153-05-03):** markers via `document.createElement` with programmatic attributes (never `innerHTML`/`dangerouslySetInnerHTML` on model text); TreeWalker skips `code`/`pre`/`a`. PASS.
5. **No new dependency (all -SC accepts):** `git diff a6124113^..57d1a937` shows 0 changes to `requirements*.txt`, `pyproject`, `package.json`, or lockfiles. PASS.

---

## Unregistered Flags

None. All five `## Threat Flags` / `## Threat Surface` sections in the plan SUMMARYs report
"None" / "No new security surface beyond the plan's threat_model," and the phase diff
introduces no new network endpoint, auth path, file-access, schema change, or dependency.
Every changed file maps to a declared threat scope.

---

## Advisory Notes (from 153-REVIEW.md — NOT threat-register gaps, do NOT block ship)

These are code-review robustness/UX findings. None contradicts a declared mitigation; each
is fail-safe for the declared threat. Recorded for traceability, not as OPEN threats.

- **MD-01 (Medium, UX):** "Open document" is a silent dead-end when a cited `document_id`
  is not in the owner-scoped list (e.g. superseded version row). Explicitly **fail-safe for
  security** (T-153-02-01 holds — a foreign doc still never opens); it is a broken-affordance
  UX gap, not a disclosure. Out of scope for this audit's dispositions.
- **LW-02 (Low, robustness):** `_strip_citation_note` uses a literal sentinel; user-derived
  system-prompt content containing `<<<CITATION_GUIDANCE>>>` could truncate that same user's
  own system prompt on a retrieval turn. RLS-scoped, self-inflicted only — it does NOT weaken
  the T-153-01-02 dual-channel/no-fork guarantee. Recommend an unspoofable delimiter/out-of-band
  presence tracking in a follow-up.
- **LW-01 (Low):** `hasInRangeMarker` (footer default-open) does not skip code/pre/a, so a
  `[n]` appearing only inside a code fence can open the footer with zero visible markers — a
  D-06/D-07 UX inconsistency, no security impact.
- **IN-04 (Info):** settle-point normalize is skipped on error/cancel/timeout paths, but those
  paths raise before `unique_citations` is populated → no `source_refs` → frontend renders via
  `MarkdownRenderer` and any `[n]` stays literal (no false interactive attribution). Honesty
  guarantee preserved by the frontend range-check + citations-absence on those paths.

---

## Verdict

**SECURED** — 27/27 threats closed (ASVS L1, `block_on: high`; 0 high/blocker findings).
The declared mitigations are present and correct in the implemented code; the four `accept`
dispositions are justified (no dependency installs, workflow path untouched, static teaching
copy). Advisory review findings are non-blocking and fail-safe.

_Audited: 2026-07-15 · gsd-security-auditor · implementation files unmodified._
