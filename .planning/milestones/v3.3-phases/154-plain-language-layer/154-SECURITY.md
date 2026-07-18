---
phase: 154-plain-language-layer
requirement: LANG-01
audited: 2026-07-15
asvs_level: L1
block_on: default
threats_total: 4
threats_closed: 4
threats_open: 0
status: SECURED
register_authored_at_plan_time: true
---

# Phase 154 — Plain-Language Layer: Security Audit (SECURITY.md)

Verification of every declared threat mitigation against the **implemented code** (not
documentation/intent). The consolidated STRIDE register (3 plans) was authored at plan time
and is treated as COMPLETE — this audit verifies dispositions, it does not scan for new
threats. Implementation files were READ-ONLY throughout; only this SECURITY.md was written.

**Result: SECURED.** 4/4 threats resolved (3 `mitigate` verified in code, 1 `accept`
justification holds). 0 open. Diff scope confirmed against `git diff 16791253..HEAD`
(base = phase-153 tip). This is a display-only frontend phase (D-05): the diff touches only
`frontend/src/` + `.planning/` — zero backend, migration, enum, API-field, or audit-action
files, and zero dependency manifests.

The consolidated register recurs the same four threat IDs across the three waves against the
same underlying mitigation patterns; each is verified once below against ALL of its cited
surfaces (not a single grep match).

---

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-154-01 | Tampering (display-string → wire-value contract) | mitigate | CLOSED | Relabels change DISPLAY text only across ALL cited surfaces — verified per surface below. `usePlainLabel` (`termMap.ts:149-155`) returns a display string only; the map's `technical:` side is verbatim shipped copy, never a wire value (`termMap.ts:14-19` contract header + `:35-137` static literals). Contract-Safety Recipe (D-05a): `git diff --name-only 16791253..HEAD \| grep -E '^backend/\|^supabase/migrations/'` → NOTHING; `... \| grep -vE '^frontend/src/\|^\.planning/'` → NOTHING. |
| T-154-02 | Tampering (XSS) | mitigate | CLOSED | `PlainLabel.tsx:45-52` renders the label as an auto-escaped React text node (`{label}`); `grep 'dangerouslySetInnerHTML\s*='` in `PlainLabel.tsx` → 0 matches (the file appears in a repo-wide grep only via the `:5-6` comment asserting its ABSENCE, not a usage). `InfoHint` (`PlainLabel.tsx:23-35`) binds helper text via `title=`/`aria-label=` attributes (auto-escaped). Term-map values are static developer literals (`termMap.ts:35-137`) — no user/model-supplied text reaches any label sink. |
| T-154-04 | Tampering (regression, G-5) | mitigate | CLOSED | `MessageInput.tsx` diff is additive markup ONLY (helper `<p>` + label `<span>`; enum calls `onAgentModeChange("default")`/`("explorer")` intact at `:344`/`:358`). `git diff --name-only 16791253..HEAD \| grep -E 'MessageItem\.tsx\|StreamsProvider\.tsx'` → NEITHER in the diff (both G-5 hot files untouched). |
| T-154-03 | Information Disclosure (technical-name reveal) | accept | CLOSED | Accepted-risk entry recorded below. `termMap.ts` read in full: display copy only — NO keys/secrets/PII; technical values are field/status/enum LABEL words, not secret (D-01). The provider stores one non-sensitive boolean `"technical-names"` (`TechnicalNamesProvider.tsx:37,53-56,68-71`), not a session token. Zero packages installed: `tech-stack.added: []` in all 3 SUMMARYs and no `package.json`/lockfile in the diff → Package Legitimacy Gate not triggered. |

---

## Per-Surface Verification of T-154-01 (all cited files, not one)

The contract that must hold: relabels move DISPLAY strings; every enum / style-key / routing
key / audit-action / API field stays keyed on the RAW value.

1. **`termMap.ts`** — `usePlainLabel` (`:149-155`) reads the reveal boolean and returns
   `term.plain` / `term.technical`, both display strings; unknown key → `String(key)`
   passthrough (never a throw, never a fabricated wire value). Nothing in the file is posted
   to an API. PASS.
2. **`DocumentStatusBadge.tsx`** — `styles` map is typed `Record<Props["status"], string>`
   (`:10-15`) and the class lookup is `styles[status]` on the RAW `status` enum (`:39`); the
   spinner gate is `status === "processing"` (`:42`). The relabel computes a display-only
   `termKey` (`:27-33`) guarded by `` `ingest.${ingestionStep}` in TERM_MAP `` with a literal
   `"ingest."` prefix (prototype-pollution via `in` is impossible), then `usePlainLabel`
   (`:33`). The enum never becomes the style key. PASS.
3. **`SettingsPage.tsx`** — `<TabsTrigger value="0..4">` routing keys all unchanged (grep
   `:870-877`); only the child text of `value="1"` was swapped to `{retrievalTabLabel}`
   (`:874`) and the embedding `ProviderPicker title` to `{embeddingLabel}` (`:1182`).
   `activeTab`/`handleTabChange` key on the numeric `value`. PASS.
4. **`MessageInput.tsx`** — `onAgentModeChange("default")`/`("explorer")` intact (`:344`,
   `:358`); only the visible `<span>` label + additive helper `<p>` changed. PASS.
5. **`ControlRoomPage.tsx`** — diff swaps ONLY the `showTechnical` state SOURCE
   (`const [showTechnical,setShowTechnical]=useState(false)` → `useTechnicalNames()`) and
   rewires the four `() => setShowTechnical(...)` closures to the shared `toggleTechnical`;
   every `showTechnical={showTechnical}` leaf prop thread is byte-identical and ZERO audit
   `action_type` strings appear in the diff. PASS.
6. **`DocumentDetailPanel.tsx`** — one line: `<PanelSection title="Metadata">` →
   `title={usePlainLabel("doc.metadata_section")}` (`:231`) + the import; ConfidenceChip words
   untouched; no enum/API/audit change. PASS.

---

## Accepted Risks Log

### AR-154-03 — Technical field/enum/status names are revealable to every user (T-154-03)

- **Disposition:** accept (declared at plan time, D-01).
- **What is exposed:** with the "Show technical names" toggle ON, the UI shows today's raw
  display wording — e.g. `Chunking`, `Embedding`, `pending`/`processing`/`completed`/`failed`,
  `Metadata`, `Search & Retrieval`, `Embedding model`. These are field/step/status LABEL words.
- **Why acceptable:** these names are not secret; they are already observable in the shipped
  UI and network responses. The reveal exposes vocabulary, not data. No operator/VIS-01 gate is
  required (`TechnicalNamesProvider.tsx:22-24` header records this).
- **Not a secret store:** the only persisted value is a single boolean UI preference in
  `localStorage["technical-names"]` (`TechnicalNamesProvider.tsx:37,53-56,68-71`) — not a
  session token, credential, or PII.
- **No secrets/PII in the map:** `termMap.ts:35-137` was read in full — display copy only; no
  API keys, tokens, connection strings, or personal data.
- **Supply chain:** no dependencies added (`tech-stack.added: []` × 3 SUMMARYs; no
  `package.json`/lockfile in `git diff 16791253..HEAD`). Package Legitimacy Gate not triggered.

---

## Unregistered Flags

None. `154-03-SUMMARY.md` `## Threat Flags` reports "None"; `154-01`/`154-02` SUMMARYs declare
no new attack surface. The phase diff introduces no network endpoint, auth path, file-access
pattern, schema change, or dependency. Every changed source file maps to a declared threat
scope (T-154-01/02/03/04).

---

## Advisory Notes (from 154-REVIEW.md — NOT threat-register gaps, do NOT block ship)

Code-review findings, none of which contradicts a declared mitigation or contains a secret:

- **WR-01 (Warning, display-only) — RESOLVED in code.** The review flagged
  `settings.embedding.technical` as non-verbatim (`"embedding"` vs shipped `"Embedding model"`).
  The current `termMap.ts:130` reads `technical: "Embedding model"` (fix `8ba20bc2`), so the
  reveal now restores the exact shipped title. Display-only regardless; no wire/enum/audit
  contract was ever implicated. No security impact.
- **IN-01 (Info) — dead map entries.** `settings.temperature` / `settings.context_window` /
  `settings.reembed` are defined but unconsumed (`termMap.ts:117-136`). They hold only benign
  label copy (no secrets/PII) — an unused-code hygiene item, not a disclosure. No security
  impact.
- **IN-02 (Info) — inline hook placement.** `usePlainLabel("doc.metadata_section")` is called
  inline in JSX in `DocumentDetailPanel.tsx:231`; currently correct (unconditional, stable
  order). A rules-of-hooks robustness suggestion, not a security gap.

---

## Verdict

**SECURED** — 4/4 threats closed (ASVS L1, `block_on: default`; 0 blocker/open findings).
The three `mitigate` dispositions are present and correct in the implemented code across every
cited surface, and the one `accept` disposition (T-154-03) is justified and logged. The phase
is display-only: no client→server, auth, or data-access boundary is crossed or added; zero
backend/migration/enum/API/audit changes; zero dependency installs. Advisory review findings
are non-blocking and carry no security impact.

_Audited: 2026-07-15 · gsd-security-auditor · implementation files unmodified._
