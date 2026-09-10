---
phase: 231
slug: connection-scoped-visibility
document: threat-model
status: complete
mandatory: true   # ROADMAP flags 231 as carrying a MANDATORY threat model
author: claude (builder)
reviewer: gemini
date: 2026-09-05
---

# Phase 231 — Threat Model

> ⭐ **Why this phase carries a mandatory threat model.** Until migration 154, **every document in
> the corpus was deliberately placed by a person who could already read it.** That is the entire
> reason ownership-based RLS was sound — not a stated design principle, an accident of the manual
> upload rule. A watched connection breaks it: documents arrive that **nobody chose to upload**, and
> the question *"who may read this?"* stops having an obvious answer. This is where the milestone
> stops being a feature and becomes a permission model.

<trust_boundaries>
Connection owner (chooses a scope)
  -> connector_connections.default_ingest_visibility        [the CHOSEN value]
  -> ingest (mint_document_row)                             [stamps the choice onto the row]
  -> documents.ingest_visibility + source_connection_id     [the ENFORCED value]
  -> FOUR enforcement sites, all calling connection_doc_is_visible():
       1. documents SELECT policy            (RLS)
       2. document_chunks SELECT policy      (RLS)
       3. match_document_chunks              (SECURITY DEFINER — bypasses RLS)
       4. keyword_search_chunks              (SECURITY DEFINER — bypasses RLS)
  -> a second org member reading the Library, searching, or asking the agent
</trust_boundaries>

---

## Threats

```yaml
- threat_id: TM-231-01
  category: Information Disclosure
  component: the four enforcement sites
  disposition: mitigated
  threat: >
    The two SECURITY DEFINER bodies bypass RLS. If they widen before the policies do — or widen
    while a policy does not — the agent quotes chunks the Library refuses to show. A person then
    reads content in an answer that they cannot open, verify, or report.
  mitigation: >
    ONE transaction (migration 154), policies FIRST and DEFINER bodies LAST (H-1). All four call
    the SAME resolver, connection_doc_is_visible(), and none re-derives the rule — so the sites
    cannot drift apart by editing. A partial failure leaves the ANNOYING state (Library shows a row
    retrieval will not quote), never the LEAKING one.
  verification: >
    DRIVEN. tests/integration/test_231_connection_scoped_visibility.py asserts all four sites answer
    IDENTICALLY, and the lockstep test fails if any one disagrees. Driven RED first
    (UndefinedColumnError) so the guard is known to be capable of failing.

- threat_id: TM-231-02
  category: Information Disclosure / Fail-Open
  component: connection_doc_is_visible()
  disposition: mitigated
  threat: >
    A visibility value the predicate does not recognise — written by a future migration, a
    service-role script, or a rolled-back deploy — is treated as permissive, silently sharing a
    private corpus org-wide with every status green.
  mitigation: >
    The resolver is a CASE whose ELSE arm returns false, and NULL source_connection_id returns
    false. An unrecognised state is NOT a pass. It also does not re-check org membership, so there
    is exactly one place that decision is made rather than two that can disagree.
  verification: >
    DRIVEN. test_unrecognised_visibility_value_fails_closed drops the CHECK constraint deliberately,
    writes 'everyone-lol', and asserts all four sites still deny.

- threat_id: TM-231-03
  category: Elevation of Privilege
  component: the connecting user as a gateway
  disposition: mitigated (UI) / accepted-and-stated (model)
  threat: >
    A person connects their own Google Drive and sets the scope to the whole organisation. Their
    personal access to that source is now re-exported to every colleague — including people the
    source itself would refuse. This is a real privilege transfer and it is invisible unless the
    product says so.
  mitigation: >
    It is STATED, in the words of the choice itself. Sketch 228 variant B makes the sentence the
    option: "…including to people who cannot open the originals at the source." SEED-210's
    connection-scoped model is the operator's decided answer; SEED-211's metadata-derived (M-Files)
    per-document ACL model is RECORDED WITH A MIGRATION PATH, NOT BUILT.
  verification: >
    Pinned. ingestVisibility.test.tsx asserts that exact clause is present, so it cannot be edited
    away by someone tightening the copy.

- threat_id: TM-231-04
  category: Information Disclosure
  component: VIS-02 coverage — a configuration path with no sentence
  disposition: mitigated
  threat: >
    A person shares a corpus org-wide without ever reading who "org-wide" is, because the screen
    they used omitted the sentence — a second capability branch, an edit-later screen, a read-only
    view.
  mitigation: >
    The field is mounted UNCONDITIONALLY, outside every capability branch, and the create body sets
    the key on EVERY path rather than inside a branch. The footer returns a sentence for every
    value including unrecognised and null, so no surface can fall through to silence. Read-only
    viewers get variant A (the sentence) rather than a disabled control, satisfying the panel's
    "absent, not disabled" rule WITHOUT losing the sentence.
  verification: >
    Pinned. ingestVisibility.test.tsx drives seven values through the footer — including null,
    undefined, "" and an unknown string — and asserts none yields silence.

- threat_id: TM-231-05
  category: Spoofing / Provenance
  component: TRUST-04 citation + detail-panel marks
  disposition: mitigated
  threat: >
    A person cannot distinguish knowledge a colleague deliberately uploaded from knowledge a
    machine placed without review. Untrusted external content then carries the same authority as
    curated content, which is the precondition for the injection class SEED-188 describes.
  mitigation: >
    source_connection_id travels the whole retrieval path and both citation construction sites
    carry it. Absence is the signal, so the mark means something. A name that will not resolve says
    "a connection" rather than inventing one.
  verification: >
    Pinned. Four cases in CitationList.test.tsx, including the absence case and the unresolved-name
    case.

- threat_id: TM-231-06
  category: Elevation of Privilege (future)
  component: the inert `dept` branch (D-5)
  disposition: mitigated
  threat: >
    A department scope is written now and left resolving org-wide. The day someone adds the first
    department row, every document marked 'dept' silently keeps its org-wide reach — a widening
    nobody performed and nobody reviewed.
  mitigation: >
    The branch is DERIVED, not hard-coded: `NOT EXISTS (SELECT 1 FROM dept_members)`. While no
    department membership exists there is no narrower answer to give, so it reads org-wide — exactly
    today's behaviour. The moment departments become real it STOPS granting on its own and must be
    replaced with a real membership check. It fails CLOSED on activation. No UI offers the value.
  verification: >
    DRIVEN, both halves. test_dept_is_inert_and_does_not_invent_a_third_access_level asserts
    org-wide while dept_members is empty, then INSERTS a department member and asserts all four
    sites deny.

- threat_id: TM-231-07
  category: Information Disclosure
  component: fetch_full_document — a FIFTH retrieval path
  disposition: accepted, recorded, routed
  threat: >
    fetch_full_document is owner-scoped (`.eq("user_id", user_id)`) and does not consult the new
    predicate, so it is a fifth definition of "who may read this".
  mitigation: >
    None applied, deliberately. It is NARROWER than the new rule, never wider, so it fails CLOSED:
    a second org member can find an org-visible connection document via search but analyze_document
    on it returns nothing. That is a usability gap, not a leak. Widening it in Python, outside the
    transaction the four sites moved in, would create exactly the drift H-1 exists to prevent.
  verification: >
    NOT verified — it is not fixed. Recorded in place at retrieval_service.py and routed to the
    reviewer as a decision. ⚠ This is the one open item in this threat model.

- threat_id: TM-231-08
  category: Tampering
  component: scope chosen by the caller rather than the connection
  disposition: mitigated
  threat: >
    An import request carries its own visibility value and widens a document past what the
    connection's owner chose.
  mitigation: >
    connectors.py reads default_ingest_visibility from the resolved CONNECTION, never from the
    request body. mint_document_row writes the pair together or not at all, so a row can never
    claim a scope with no connection behind it.
  verification: >
    Structural — there is no request field to send. The connector import call site passes
    `conn.default_ingest_visibility` and `org_id` from the resolved active org.
```

---

## What this threat model does NOT cover, stated rather than implied

- **Content-level injection from synced documents** (`SEED-188`). This phase decides *who may read*
  a connection's documents; it does nothing about what those documents *say* to the agent. That is
  the sync phase's threat model (**Phase 234**, also flagged MANDATORY), and it is the larger risk.
- **The audit obligation.** ROADMAP Pitfall 3 requires one `audit_log` row per connection-sourced
  retrieval hit **from the first sync**, because retrofitting leaves the first months permanently
  unauditable. ⚠ **Not built in this phase.** *"Who saw content from connection C"* is not yet
  answerable in one query. **This is an open requirement, not an oversight to discover later.**
- **Revocation.** D-4 says disconnecting FREEZES a connection's documents rather than deleting
  them. `source_connection_id` is `ON DELETE SET NULL` so knowledge is never destroyed — but the
  freeze itself is Phase 234's, and there is no UI sentence for the frozen state yet (flagged in
  sketch 228 as owed).
